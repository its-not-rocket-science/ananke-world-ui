import { deserializeReplay, replayTo, serializeReplay } from "@its-not-rocket-science/ananke";
import type { Replay } from "@its-not-rocket-science/ananke";
import { createPreviewRenderer, type PreviewRenderer } from "./bridge/three-preview.js";
import { escapeHtml } from "./data.js";
import type { PanelContext } from "./app-types.js";
import { KERNEL_CONTEXT } from "./models.js";

let activeReplay: Replay | null = null;
let replayName = "";
let selectedEntityId: number | null = null;
let playbackTimer: number | null = null;
let previewRendererPromise: Promise<PreviewRenderer> | null = null;
let previewRenderer: PreviewRenderer | null = null;

export function mountReplayViewer(host: HTMLElement, context: PanelContext): void {
  const render = async () => {
    const replay = activeReplay;
    const maxTick = replay?.frames.at(-1)?.tick ?? 0;
    const tick = Number.parseInt((host.querySelector<HTMLInputElement>("#rv-tick")?.value ?? "0"), 10) || 0;
    const world = replay ? replayTo(replay, Math.min(tick, maxTick), KERNEL_CONTEXT) : null;
    const inspectorRows = world
      ? world.entities
          .map(
            (entity) => `
              <button class="entity-chip ${selectedEntityId === entity.id ? "is-selected" : ""}" data-entity-pick="${entity.id}">
                #${entity.id} • team ${entity.teamId} • shock ${entity.injury.shock.toFixed(0)}
              </button>`,
          )
          .join("")
      : `<p class="empty-state">Load the latest replay from the sim runner or import JSON from disk.</p>`;

    const selectedEntity = world?.entities.find((entity) => entity.id === selectedEntityId) ?? world?.entities[0] ?? null;
    const exportJson = replay && world ? exportClip(replay, Math.max(0, tick - 20), Math.min(maxTick, tick + 20)) : "";

    host.innerHTML = `
      <section class="panel-shell">
        <div class="panel-header">
          <div>
            <h2>Replay Viewer</h2>
            <p class="subtitle">Scrub through recorded fights, inspect per-tick state, sync the preview panel to the scrubber, and export focused clips for debugging or sharing.</p>
          </div>
          <div class="header-actions">
            <button class="primary" id="rv-load-latest">Load latest sim replay</button>
            <label class="inline-upload"><span>Import JSON</span><input id="rv-file" type="file" accept=".json" /></label>
          </div>
        </div>

        <div class="dashboard-layout">
          <div class="stack-lg">
            <div class="card">
              <h3>Scrubber</h3>
              <div class="inline-fields wrap">
                <label><span>Replay</span><input type="text" readonly value="${escapeHtml(replayName || "No replay loaded")}" /></label>
                <label><span>Tick</span><input id="rv-tick" type="range" min="0" max="${maxTick}" value="${Math.min(tick, maxTick)}" /></label>
                <label><span>Tick value</span><input id="rv-tick-number" type="number" min="0" max="${maxTick}" value="${Math.min(tick, maxTick)}" /></label>
              </div>
              <div class="button-row">
                <button class="primary" id="rv-play">Play</button>
                <button id="rv-pause">Pause</button>
                <button id="rv-reverse">Reverse</button>
                <button id="rv-export-clip">Copy ±20 tick clip</button>
              </div>
            </div>

            <div class="card">
              <div class="card-header-inline">
                <h3>3D preview panel</h3>
                <button id="rv-load-preview">Lazy-load preview</button>
              </div>
              <div id="rv-preview-host" class="preview-host"><p class="empty-state">Preview not loaded yet.</p></div>
            </div>

            <div class="card">
              <h3>Timeline entity inspector</h3>
              <div class="chip-wrap">${inspectorRows}</div>
            </div>
          </div>

          <div class="stack-lg">
            <div class="card">
              <h3>Selected entity state</h3>
              <pre class="output tight">${escapeHtml(formatEntity(selectedEntity, world?.tick ?? 0))}</pre>
            </div>
            <div class="card">
              <h3>Sub-replay export</h3>
              <textarea class="json-output" readonly>${escapeHtml(exportJson)}</textarea>
            </div>
          </div>
        </div>
      </section>
    `;

    bindEvents(host, context, render);
    if (world && previewRenderer) {
      previewRenderer.render({
        tick: world.tick,
        sourceWorld: world,
        entities: world.entities.map((entity) => ({
          id: entity.id,
          teamId: entity.teamId,
          x: entity.position_m.x,
          y: entity.position_m.y,
          shock: entity.injury.shock,
          consciousness: entity.injury.consciousness,
          dead: entity.injury.dead,
        })),
      });
    }
  };

  void render();
}

function bindEvents(host: HTMLElement, context: PanelContext, rerender: () => Promise<void>): void {
  host.querySelector("#rv-load-latest")?.addEventListener("click", () => {
    const { latestReplayJson, latestReplayName } = context.getState();
    if (!latestReplayJson) return;
    activeReplay = deserializeReplay(latestReplayJson);
    replayName = latestReplayName || "Latest sim replay";
    selectedEntityId = activeReplay.initialState.entities[0]?.id ?? null;
    void rerender();
  });

  host.querySelector<HTMLInputElement>("#rv-file")?.addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    activeReplay = deserializeReplay(await file.text());
    replayName = file.name;
    selectedEntityId = activeReplay.initialState.entities[0]?.id ?? null;
    void rerender();
  });

  host.querySelector("#rv-play")?.addEventListener("click", () => {
    clearTimer();
    playbackTimer = window.setInterval(() => adjustTick(host, 1, rerender), 120);
  });

  host.querySelector("#rv-pause")?.addEventListener("click", () => {
    clearTimer();
  });

  host.querySelector("#rv-reverse")?.addEventListener("click", () => {
    clearTimer();
    playbackTimer = window.setInterval(() => adjustTick(host, -1, rerender), 120);
  });

  host.querySelector("#rv-tick")?.addEventListener("input", () => syncTickInputs(host, rerender));
  host.querySelector("#rv-tick-number")?.addEventListener("input", () => syncTickInputs(host, rerender));

  host.querySelectorAll<HTMLElement>("[data-entity-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedEntityId = Number.parseInt(button.dataset.entityPick ?? "0", 10) || null;
      void rerender();
    });
  });

  host.querySelector("#rv-export-clip")?.addEventListener("click", async () => {
    const replay = activeReplay;
    if (!replay) return;
    const tick = Number.parseInt((host.querySelector<HTMLInputElement>("#rv-tick-number")?.value ?? "0"), 10) || 0;
    await navigator.clipboard.writeText(exportClip(replay, Math.max(0, tick - 20), tick + 20));
  });

  host.querySelector("#rv-load-preview")?.addEventListener("click", async () => {
    const previewHost = host.querySelector<HTMLElement>("#rv-preview-host");
    if (!previewHost) return;
    if (!previewRendererPromise) {
      previewRendererPromise = createPreviewRenderer(previewHost).then((renderer) => {
        previewRenderer = renderer;
        return renderer;
      });
    }
    await previewRendererPromise;
    void rerender();
  });
}

function syncTickInputs(host: HTMLElement, rerender: () => Promise<void>): void {
  const slider = host.querySelector<HTMLInputElement>("#rv-tick");
  const number = host.querySelector<HTMLInputElement>("#rv-tick-number");
  if (!slider || !number) return;
  if (document.activeElement === slider) {
    number.value = slider.value;
  } else {
    slider.value = number.value;
  }
  void rerender();
}

function adjustTick(host: HTMLElement, delta: number, rerender: () => Promise<void>): void {
  const slider = host.querySelector<HTMLInputElement>("#rv-tick");
  const number = host.querySelector<HTMLInputElement>("#rv-tick-number");
  if (!slider || !number) return;
  const max = Number.parseInt(slider.max || "0", 10) || 0;
  const next = Math.min(max, Math.max(0, (Number.parseInt(slider.value, 10) || 0) + delta));
  slider.value = String(next);
  number.value = String(next);
  void rerender();
}

function clearTimer(): void {
  if (playbackTimer !== null) {
    window.clearInterval(playbackTimer);
    playbackTimer = null;
  }
}

function formatEntity(entity: Replay["initialState"]["entities"][number] | null | undefined, tick: number): string {
  if (!entity) {
    return "No entity selected.";
  }

  return [
    `Tick: ${tick}`,
    `Entity: #${entity.id}`,
    `Team: ${entity.teamId}`,
    `Position: (${entity.position_m.x}, ${entity.position_m.y})`,
    `Shock: ${entity.injury.shock.toFixed(0)}`,
    `Consciousness: ${entity.injury.consciousness.toFixed(0)}`,
    `Dead: ${String(entity.injury.dead)}`,
    `Fluid loss: ${entity.injury.fluidLoss?.toFixed?.(0) ?? "n/a"}`,
  ].join("\n");
}

function exportClip(replay: Replay, startTick: number, endTick: number): string {
  const startState = replayTo(replay, startTick, KERNEL_CONTEXT);
  const frames = replay.frames
    .filter((frame) => frame.tick >= startTick && frame.tick <= endTick)
    .map((frame) => ({
      tick: frame.tick - startTick,
      commands: frame.commands,
    }));
  return serializeReplay({ initialState: startState, frames });
}
