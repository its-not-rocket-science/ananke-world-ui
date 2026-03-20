import type { AppState } from "./models.js";

export interface PanelContext {
  getState(): AppState;
  updateState(updater: (state: AppState) => void): void;
  navigate(tabId: string): void;
}
