// src/world-simulator.ts — Phase 3 stub: World Simulator
//
// Lets users set up polities, run stepPolityDay loops, and view final state.
// Full territory map and visual rendering are planned for ROADMAP Phase 3.
//
// Ananke imports:
//   - createPolity()        — build a Polity from spec
//   - createPolityRegistry() — wrap polities in a registry
//   - stepPolityDay()       — advance one simulated day
//   - PolityRegistry, Polity, PolityPair

import {
  createPolity,
  createPolityRegistry,
  stepPolityDay,
} from "@its-not-rocket-science/ananke/dist/src/polity.js";
import type { PolityRegistry } from "@its-not-rocket-science/ananke/dist/src/polity.js";
import { q } from "@its-not-rocket-science/ananke";

const DEFAULT_DAYS = 30;

export function mountWorldSimulator(host: HTMLElement): void {
  host.innerHTML = `
    <h2>World Simulator</h2>
    <p class="subtitle">
      Configure two polities, run a ${DEFAULT_DAYS}-day simulation, and see the outcome.
      Phase 3 — territory map visualization is not yet implemented.
    </p>

    <div class="card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
        <div>
          <label>Polity A — Name</label>
          <input type="text" id="ws-name-a" value="Kingdom of Aldenmoor" />
          <label>Polity A — Population</label>
          <input type="number" id="ws-pop-a" value="5000" />
          <label>Polity A — Starting Treasury (cu)</label>
          <input type="number" id="ws-treasury-a" value="2000" />
        </div>
        <div>
          <label>Polity B — Name</label>
          <input type="text" id="ws-name-b" value="Free City of Vareth" />
          <label>Polity B — Population</label>
          <input type="number" id="ws-pop-b" value="3000" />
          <label>Polity B — Starting Treasury (cu)</label>
          <input type="number" id="ws-treasury-b" value="4000" />
        </div>
      </div>

      <label style="margin-top:0.5rem">Days to simulate</label>
      <input type="number" id="ws-days" value="${DEFAULT_DAYS}" style="width:100px" />

      <label>World seed</label>
      <input type="number" id="ws-seed" value="1" style="width:100px" />

      <div style="margin-top:0.75rem">
        <button class="primary" id="ws-run">Run Simulation</button>
      </div>

      <div class="output" id="ws-output">Configure polities and click "Run Simulation".</div>

      <!-- TODO Phase 3: render a territory map using SVG or canvas.          -->
      <!-- Each polity's locationIds would be drawn as cells on a grid,       -->
      <!-- coloured by polityId, with trade routes shown as lines.            -->
    </div>
  `;

  host.querySelector("#ws-run")?.addEventListener("click", () => {
    runWorldSim(host);
  });
}

function runWorldSim(host: HTMLElement): void {
  const nameA      = (host.querySelector<HTMLInputElement>("#ws-name-a"))?.value     ?? "Polity A";
  const nameB      = (host.querySelector<HTMLInputElement>("#ws-name-b"))?.value     ?? "Polity B";
  const popA       = parseInt((host.querySelector<HTMLInputElement>("#ws-pop-a"))?.value ?? "5000", 10);
  const popB       = parseInt((host.querySelector<HTMLInputElement>("#ws-pop-b"))?.value ?? "3000", 10);
  const treasuryA  = parseInt((host.querySelector<HTMLInputElement>("#ws-treasury-a"))?.value ?? "2000", 10);
  const treasuryB  = parseInt((host.querySelector<HTMLInputElement>("#ws-treasury-b"))?.value ?? "4000", 10);
  const days       = parseInt((host.querySelector<HTMLInputElement>("#ws-days"))?.value ?? "30", 10);
  const seed       = parseInt((host.querySelector<HTMLInputElement>("#ws-seed"))?.value ?? "1", 10);
  const output     = host.querySelector<HTMLElement>("#ws-output");
  if (!output) return;

  output.textContent = "Running…";

  setTimeout(() => {
    try {
      // Build two polities sharing one trade location
      const polityA = createPolity({
        id: "polity-a",
        name: nameA,
        population: isNaN(popA) ? 5000 : popA,
        locationIds: ["loc-border", "loc-a-capital"],
        treasury_cu: isNaN(treasuryA) ? 2000 : treasuryA,
        morale_Q: q(0.65),
        stability_Q: q(0.70),
      });

      const polityB = createPolity({
        id: "polity-b",
        name: nameB,
        population: isNaN(popB) ? 3000 : popB,
        locationIds: ["loc-border", "loc-b-capital"],
        treasury_cu: isNaN(treasuryB) ? 4000 : treasuryB,
        morale_Q: q(0.60),
        stability_Q: q(0.75),
      });

      const registry: PolityRegistry = createPolityRegistry([polityA, polityB]);

      const pairs = [
        {
          polityAId: "polity-a",
          polityBId: "polity-b",
          sharedLocations: 1,
          routeQuality_Q: q(0.60),
        },
      ];

      const safeDays = isNaN(days) || days < 1 ? DEFAULT_DAYS : Math.min(days, 365);
      const safeSeed = isNaN(seed) ? 1 : seed;

      let totalTradeIncome = 0;

      for (let day = 0; day < safeDays; day++) {
        const result = stepPolityDay(registry, pairs, safeSeed, day);
        for (const tr of result.tradeResults) {
          totalTradeIncome += tr.incomeEach_cu * 2; // both sides receive incomeEach
        }
      }

      const a = registry.polities.get("polity-a")!;
      const b = registry.polities.get("polity-b")!;

      const lines: string[] = [
        `Days simulated : ${safeDays}`,
        `World seed     : ${safeSeed}`,
        ``,
        `${a.name}`,
        `  Population : ${a.population}`,
        `  Treasury   : ${a.treasury_cu} cu`,
        `  Morale     : ${a.morale_Q}`,
        `  Stability  : ${a.stability_Q}`,
        ``,
        `${b.name}`,
        `  Population : ${b.population}`,
        `  Treasury   : ${b.treasury_cu} cu`,
        `  Morale     : ${b.morale_Q}`,
        `  Stability  : ${b.stability_Q}`,
        ``,
        `Total trade income (both sides): ${totalTradeIncome} cu over ${safeDays} days`,
        ``,
        `TODO Phase 3: territory map visualization`,
      ];

      output.textContent = lines.join("\n");
    } catch (err) {
      output.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }, 0);
}
