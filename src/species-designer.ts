// src/species-designer.ts — Phase 2 stub: Species Designer
//
// Visual sliders for archetype parameters, calling generateIndividual() and
// displaying the resulting IndividualAttributes.
//
// Full implementation planned in ROADMAP Phase 2.
// Currently renders the UI scaffolding with a preview call to generateIndividual
// using the built-in KNIGHT_INFANTRY archetype.

import {
  generateIndividual,
  ARCHETYPE_MAP,
} from "@its-not-rocket-science/ananke";

export function mountSpeciesDesigner(host: HTMLElement): void {
  host.innerHTML = `
    <h2>Species Designer</h2>
    <p class="subtitle">
      Adjust archetype parameters and preview the generated individual.
      Phase 2 — sliders not yet wired to archetype mutation.
    </p>

    <div class="card">
      <label>Base Archetype</label>
      <select id="sd-arch">
        ${[...ARCHETYPE_MAP.keys()]
          .map((k) => `<option value="${k}">${k}</option>`)
          .join("\n")}
      </select>

      <label>Seed</label>
      <input type="number" id="sd-seed" value="1" style="width:120px" />

      <!-- TODO Phase 2: expose statureVar, massVar, actuatorScaleVar, peakForceVar,
           actuatorSpeedVar, reachVar as range inputs, build a mutated Archetype on
           the fly, and pass it to generateIndividual() -->

      <label style="margin-top:0.5rem">Stature variance (placeholder — not wired)</label>
      <input type="range" id="sd-statureVar" min="0" max="100" value="50" disabled />

      <label>Mass variance (placeholder — not wired)</label>
      <input type="range" id="sd-massVar" min="0" max="100" value="50" disabled />

      <label>Actuator scale variance (placeholder — not wired)</label>
      <input type="range" id="sd-actuatorVar" min="0" max="100" value="50" disabled />

      <div style="margin-top:0.75rem">
        <button class="primary" id="sd-preview">Generate Preview</button>
      </div>

      <div class="output" id="sd-output">Press "Generate Preview" to see individual attributes.</div>
    </div>
  `;

  host.querySelector("#sd-preview")?.addEventListener("click", () => {
    previewIndividual(host);
  });

  // Trigger initial preview
  previewIndividual(host);
}

function previewIndividual(host: HTMLElement): void {
  const archKey =
    (host.querySelector<HTMLSelectElement>("#sd-arch"))?.value ?? "KNIGHT_INFANTRY";
  const seed = parseInt(
    (host.querySelector<HTMLInputElement>("#sd-seed"))?.value ?? "1",
    10,
  );
  const output = host.querySelector<HTMLElement>("#sd-output");
  if (!output) return;

  const arch = ARCHETYPE_MAP.get(archKey);
  if (!arch) {
    output.textContent = `Unknown archetype: ${archKey}`;
    return;
  }

  try {
    const individual = generateIndividual(isNaN(seed) ? 1 : seed, arch);

    // Format key attributes for display
    const lines: string[] = [
      `Archetype : ${archKey}`,
      `Seed      : ${seed}`,
      `---`,
      `Mass      : ${individual.mass_kg} (${(individual.mass_kg / 1000).toFixed(1)} kg)`,
      `Stature   : ${individual.stature_m} (${(individual.stature_m / 1000).toFixed(2)} m)`,
      `Reach     : ${individual.reach_m} (${(individual.reach_m / 1000).toFixed(2)} m)`,
    ];

    if (individual.combat) {
      lines.push(
        `Stability : ${individual.combat.stabilityQ}`,
        `Reaction  : ${individual.combat.reactionTime_s} s (×1000)`,
        `Strength  : ${individual.combat.peakForce_N}`,
      );
    }

    if (individual.cognition) {
      lines.push(
        `--- Cognition ---`,
        `Linguistic: ${individual.cognition.linguisticVerbal ?? "n/a"}`,
        `Logical   : ${individual.cognition.logicalMathematical ?? "n/a"}`,
        `Kinesthetic: ${individual.cognition.bodilyKinesthetic ?? "n/a"}`,
      );
    }

    output.textContent = lines.join("\n");
  } catch (err) {
    output.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
