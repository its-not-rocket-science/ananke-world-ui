import { mountScenarioBuilder } from "./scenario-builder.js";
import { mountSpeciesDesigner } from "./species-designer.js";
import { mountWorldSimulator } from "./world-simulator.js";
import { mountReplayViewer } from "./replay-viewer.js";
import { mountValidationPanel } from "./validation-panel.js";
import { createDefaultState } from "./models.js";
import type { AppState } from "./models.js";
import type { PanelContext } from "./app-types.js";

const TAB_IDS = ["scenario", "species", "world", "replay", "validation"] as const;
type TabId = (typeof TAB_IDS)[number];

const state: AppState = createDefaultState();
let activeTab: TabId = "scenario";

const context: PanelContext = {
  getState: () => state,
  updateState(updater) {
    updater(state);
  },
  navigate(tabId) {
    if ((TAB_IDS as readonly string[]).includes(tabId)) {
      activateTab(tabId as TabId);
    }
  },
};

function activateTab(id: TabId): void {
  activeTab = id;
  document.querySelectorAll("nav button").forEach((btn) => {
    const el = btn as HTMLButtonElement;
    el.classList.toggle("active", el.dataset["tab"] === id);
  });

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

function main(): void {
  initRouter();

  const scenarioEl = document.getElementById("tab-scenario");
  const speciesEl = document.getElementById("tab-species");
  const worldEl = document.getElementById("tab-world");
  const replayEl = document.getElementById("tab-replay");
  const validationEl = document.getElementById("tab-validation");

  if (scenarioEl) mountScenarioBuilder(scenarioEl, context);
  if (speciesEl) mountSpeciesDesigner(speciesEl, context);
  if (worldEl) mountWorldSimulator(worldEl, context);
  if (replayEl) mountReplayViewer(replayEl, context);
  if (validationEl) mountValidationPanel(validationEl, context);

  activateTab(activeTab);
}

main();
