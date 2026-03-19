// src/scenario-builder.ts — Phase 1: Scenario Builder
//
// Lets users pick two archetypes and weapons, then run a fight via the
// Ananke simulation kernel.  Shows the winner and fight duration.
//
// Ananke imports used:
//   - createWorld()     — deterministic WorldState from EntitySpec[]
//   - stepWorld()       — advances simulation one tick
//   - ARCHETYPE_MAP     — available archetype keys
//   - ITEM_MAP          — available weapon/armour item keys
//   - KernelContext     — minimal context for stepWorld
//   - Entity (via WorldState.entities)

import {
  createWorld,
  stepWorld,
  ARCHETYPE_MAP,
  ITEM_MAP,
} from "@its-not-rocket-science/ananke";
import type { KernelContext } from "@its-not-rocket-science/ananke";
import { q } from "@its-not-rocket-science/ananke";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TICKS = 2000;

// Minimal KernelContext: traction on firm ground, no terrain or weather modifiers.
const CTX: KernelContext = {
  tractionCoeff: q(0.85),
};

// Human-readable labels for a curated subset of archetypes
const ARCHETYPE_OPTIONS: { key: string; label: string }[] = [
  { key: "KNIGHT_INFANTRY",  label: "Knight (Infantry)"    },
  { key: "PRO_BOXER",        label: "Pro Boxer"             },
  { key: "AMATEUR_BOXER",    label: "Amateur Boxer"         },
  { key: "GRECO_WRESTLER",   label: "Greco Wrestler"        },
  { key: "HUMAN_BASE",       label: "Human (Base)"          },
  { key: "ORC",              label: "Orc"                   },
  { key: "ELF",              label: "Elf"                   },
  { key: "DWARF",            label: "Dwarf"                 },
  { key: "TROLL",            label: "Troll"                 },
  { key: "GOBLIN",           label: "Goblin"                },
];

// Curated weapon options (keys must exist in ITEM_MAP)
const WEAPON_OPTIONS: { key: string; label: string }[] = [
  { key: "fist",         label: "Fists (unarmed)"   },
  { key: "longsword",    label: "Longsword"          },
  { key: "shortsword",   label: "Shortsword"         },
  { key: "dagger",       label: "Dagger"             },
  { key: "spear",        label: "Spear"              },
  { key: "mace",         label: "Mace"               },
  { key: "greataxe",     label: "Greataxe"           },
];

// Filter to only options that are actually in ITEM_MAP (guards against version drift)
const VALID_WEAPON_OPTIONS = WEAPON_OPTIONS.filter((w) => ITEM_MAP.has(w.key));
const VALID_ARCHETYPE_OPTIONS = ARCHETYPE_OPTIONS.filter((a) =>
  ARCHETYPE_MAP.has(a.key),
);

// ── UI rendering ──────────────────────────────────────────────────────────────

function buildOptionElements(
  options: { key: string; label: string }[],
): string {
  return options
    .map((o) => `<option value="${o.key}">${o.label}</option>`)
    .join("\n");
}

export function mountScenarioBuilder(host: HTMLElement): void {
  const archetypeOpts = buildOptionElements(VALID_ARCHETYPE_OPTIONS);
  const weaponOpts = buildOptionElements(VALID_WEAPON_OPTIONS);

  host.innerHTML = `
    <h2>Scenario Builder</h2>
    <p class="subtitle">
      Pick two fighters, arm them, and run a fight.
      The simulation runs ${MAX_TICKS} ticks deterministically in the browser.
    </p>

    <div class="card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
        <div>
          <label>Fighter A — Archetype</label>
          <select id="sb-arch-a">${archetypeOpts}</select>
          <label>Fighter A — Weapon</label>
          <select id="sb-wpn-a">${weaponOpts}</select>
        </div>
        <div>
          <label>Fighter B — Archetype</label>
          <select id="sb-arch-b">${archetypeOpts}</select>
          <label>Fighter B — Weapon</label>
          <select id="sb-wpn-b">${weaponOpts}</select>
        </div>
      </div>

      <label style="margin-top:0.5rem">World seed</label>
      <input type="number" id="sb-seed" value="42" style="width:120px" />

      <div style="margin-top:0.75rem">
        <button class="primary" id="sb-run">Run Fight</button>
      </div>

      <div class="output" id="sb-output">Results will appear here.</div>

      <!-- TODO Phase 1: live tick-by-tick animation using requestAnimationFrame -->
      <!-- Each frame would advance one tick, update a canvas/SVG overlay,      -->
      <!-- and yield to the event loop so the UI stays responsive.              -->
    </div>
  `;

  // Default fighter B to a different archetype if possible
  const selectB = host.querySelector<HTMLSelectElement>("#sb-arch-b");
  if (selectB && VALID_ARCHETYPE_OPTIONS.length > 1) {
    selectB.value = VALID_ARCHETYPE_OPTIONS[1]?.key ?? selectB.value;
  }

  host.querySelector("#sb-run")?.addEventListener("click", () => {
    runFight(host);
  });
}

function runFight(host: HTMLElement): void {
  const archA = (host.querySelector<HTMLSelectElement>("#sb-arch-a"))?.value ?? "KNIGHT_INFANTRY";
  const archB = (host.querySelector<HTMLSelectElement>("#sb-arch-b"))?.value ?? "PRO_BOXER";
  const wpnA  = (host.querySelector<HTMLSelectElement>("#sb-wpn-a"))?.value ?? "longsword";
  const wpnB  = (host.querySelector<HTMLSelectElement>("#sb-wpn-b"))?.value ?? "fist";
  const seed  = parseInt(
    (host.querySelector<HTMLInputElement>("#sb-seed"))?.value ?? "42",
    10,
  );

  const output = host.querySelector<HTMLElement>("#sb-output");
  if (!output) return;
  output.textContent = "Running…";

  // Build world in the next microtask so the "Running…" message paints first
  setTimeout(() => {
    try {
      const world = createWorld(isNaN(seed) ? 42 : seed, [
        { id: 1, teamId: 1, seed: 1, archetype: archA, weaponId: wpnA },
        { id: 2, teamId: 2, seed: 2, archetype: archB, weaponId: wpnB },
      ]);

      let tick = 0;
      let winner = "Draw (timeout)";
      let endedEarly = false;

      for (tick = 0; tick < MAX_TICKS; tick++) {
        // No commands — entities use autonomous AI intent derived inside stepWorld
        stepWorld(world, new Map(), CTX);

        // Check if any entity is dead or unconscious
        const entities = [...world.entities.values()];
        const dead = entities.filter((e) => e.condition?.isConscious === false || e.dead);

        if (dead.length > 0) {
          const survivors = entities.filter((e) => !dead.includes(e));
          if (survivors.length > 0) {
            const s = survivors[0];
            winner = s
              ? `Fighter ${s.teamId === 1 ? "A" : "B"} (${s.id === 1 ? archA : archB}) wins`
              : "All fighters down";
          } else {
            winner = "Both fighters down simultaneously";
          }
          endedEarly = true;
          break;
        }
      }

      const lines: string[] = [
        `Seed: ${seed}`,
        `Fighter A: ${archA} with ${wpnA}`,
        `Fighter B: ${archB} with ${wpnB}`,
        `Ticks run: ${tick + (endedEarly ? 0 : MAX_TICKS)}`,
        `Result: ${winner}`,
      ];

      // Append final condition snapshot for each entity
      for (const [id, entity] of world.entities) {
        const c = entity.condition;
        if (c) {
          lines.push(
            `  Entity ${id}: shock=${(c.shockQ ?? 0).toFixed(0)}  ` +
            `conscious=${String(c.isConscious ?? true)}  ` +
            `fatigue=${(c.fatigueQ ?? 0).toFixed(0)}`,
          );
        }
      }

      output.textContent = lines.join("\n");
    } catch (err) {
      output.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }, 0);
}
