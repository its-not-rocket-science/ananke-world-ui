// src/main.ts — ananke-world-ui entry point
//
// Bootstraps the tab router and mounts each panel component.
// Each panel is a self-contained module that renders into its host element.

import { mountScenarioBuilder } from "./scenario-builder.js";
import { mountSpeciesDesigner } from "./species-designer.js";
import { mountWorldSimulator } from "./world-simulator.js";
import { mountReplayViewer } from "./replay-viewer.js";
import { mountValidationPanel } from "./validation-panel.js";

// ── Tab router ────────────────────────────────────────────────────────────────

const TAB_IDS = ["scenario", "species", "world", "replay", "validation"] as const;
type TabId = (typeof TAB_IDS)[number];

function activateTab(id: TabId): void {
  // Update nav buttons
  document.querySelectorAll("nav button").forEach((btn) => {
    const el = btn as HTMLButtonElement;
    el.classList.toggle("active", el.dataset["tab"] === id);
  });

  // Update panels
  TAB_IDS.forEach((tabId) => {
    const panel = document.getElementById(`tab-${tabId}`);
    if (panel) {
      panel.classList.toggle("active", tabId === id);
    }
  });
}

function initRouter(): void {
  document.querySelectorAll("nav button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = (btn as HTMLButtonElement).dataset["tab"] as TabId | undefined;
      if (id && (TAB_IDS as readonly string[]).includes(id)) {
        activateTab(id);
      }
    });
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function main(): void {
  initRouter();

  // Mount each panel into its host element.
  // Each mount function is responsible for rendering its own HTML and wiring events.
  const scenarioEl = document.getElementById("tab-scenario");
  const speciesEl = document.getElementById("tab-species");
  const worldEl = document.getElementById("tab-world");
  const replayEl = document.getElementById("tab-replay");
  const validationEl = document.getElementById("tab-validation");

  if (scenarioEl) mountScenarioBuilder(scenarioEl);
  if (speciesEl) mountSpeciesDesigner(speciesEl);
  if (worldEl) mountWorldSimulator(worldEl);
  if (replayEl) mountReplayViewer(replayEl);
  if (validationEl) mountValidationPanel(validationEl);
}

main();
