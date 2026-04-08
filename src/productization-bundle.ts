import type { AppState } from "./models.js";

export const PRODUCTIZATION_BUNDLE_SCHEMA_VERSION = "1.0.0";
const SUPPORTED_MAJOR = PRODUCTIZATION_BUNDLE_SCHEMA_VERSION.split(".")[0];

export interface ProductizationBundle {
  schemaVersion: string;
  exportedAt: string;
  uiVersion: string;
  scenario: {
    world: AppState["world"];
    entities: AppState["entities"];
    sim: AppState["sim"];
  };
  replay?: {
    name: string;
    replayJson: string;
  };
}

export function buildProductizationBundle(state: AppState): ProductizationBundle {
  return {
    schemaVersion: PRODUCTIZATION_BUNDLE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    uiVersion: "0.2.0",
    scenario: {
      world: structuredClone(state.world),
      entities: structuredClone(state.entities),
      sim: structuredClone(state.sim),
    },
    ...(state.latestReplayJson
      ? {
          replay: {
            name: state.latestReplayName || "Latest replay",
            replayJson: state.latestReplayJson,
          },
        }
      : {}),
  };
}

export function parseProductizationBundle(raw: string): ProductizationBundle {
  const parsed = JSON.parse(raw) as Partial<ProductizationBundle>;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Bundle file is not a JSON object.");
  }
  if (!parsed.schemaVersion || typeof parsed.schemaVersion !== "string") {
    throw new Error("Bundle missing schemaVersion.");
  }
  const major = parsed.schemaVersion.split(".")[0];
  if (major !== SUPPORTED_MAJOR) {
    throw new Error(
      `Unsupported bundle schema ${parsed.schemaVersion}. Expected major version ${SUPPORTED_MAJOR}.x.`,
    );
  }
  if (!parsed.scenario?.world || !parsed.scenario?.entities || !parsed.scenario?.sim) {
    throw new Error("Bundle missing scenario payload.");
  }
  return parsed as ProductizationBundle;
}

