// src/replay-viewer.ts — Phase 4 stub: Replay Viewer
//
// Allows loading a serialized replay JSON file, deserializing it, and scrubbing
// through the tick timeline.
//
// Full tick-by-tick animation is planned for ROADMAP Phase 4.
//
// Ananke imports:
//   - deserializeReplay()  — parse serialized JSON back to a Replay object
//   - replayTo()           — reconstruct WorldState at a specific tick
//   - KernelContext        — required by replayTo

import {
  deserializeReplay,
  replayTo,
} from "@its-not-rocket-science/ananke";
import type { KernelContext, Replay } from "@its-not-rocket-science/ananke";
import { q } from "@its-not-rocket-science/ananke";

const CTX: KernelContext = { tractionCoeff: q(0.85) };

export function mountReplayViewer(host: HTMLElement): void {
  host.innerHTML = `
    <h2>Replay Viewer</h2>
    <p class="subtitle">
      Load a serialized replay JSON file (produced by <code>serializeReplay()</code>)
      and inspect simulation state at any tick.
      Phase 4 — live animation not yet implemented.
    </p>

    <div class="card">
      <label>Replay JSON file</label>
      <input type="file" id="rv-file" accept=".json" style="color:#e2e8f0;margin-bottom:0.75rem" />

      <div id="rv-scrubber" style="display:none">
        <label>Tick: <span id="rv-tick-label">0</span></label>
        <input type="range" id="rv-tick" min="0" max="0" value="0" />
        <button class="primary" id="rv-goto" style="margin-top:0.5rem">Go to tick</button>
      </div>

      <div class="output" id="rv-output">Load a replay JSON file to begin.</div>

      <!-- TODO Phase 4: add a canvas/SVG overlay that renders entity positions  -->
      <!-- per tick using extractRigSnapshots() for 3-D pose data, or a simple  -->
      <!-- 2-D dot plot from entity.pos for a quick overhead view.              -->
    </div>
  `;

  let currentReplay: Replay | null = null;

  const fileInput = host.querySelector<HTMLInputElement>("#rv-file");
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const json = evt.target?.result;
      if (typeof json !== "string") return;
      try {
        currentReplay = deserializeReplay(json);
        const maxTick = currentReplay.frames.at(-1)?.tick ?? 0;

        const scrubber = host.querySelector<HTMLElement>("#rv-scrubber");
        const tickInput = host.querySelector<HTMLInputElement>("#rv-tick");
        const tickLabel = host.querySelector<HTMLElement>("#rv-tick-label");
        const output = host.querySelector<HTMLElement>("#rv-output");

        if (scrubber) scrubber.style.display = "block";
        if (tickInput) {
          tickInput.max = String(maxTick);
          tickInput.value = "0";
        }
        if (tickLabel) tickLabel.textContent = "0";
        if (output) {
          output.textContent =
            `Replay loaded: ${currentReplay.frames.length} frames, ` +
            `ticks 0–${maxTick}.\n` +
            `Use the slider or "Go to tick" to inspect state.`;
        }

        tickInput?.addEventListener("input", () => {
          if (tickLabel) tickLabel.textContent = tickInput.value;
        });
      } catch (err) {
        const output = host.querySelector<HTMLElement>("#rv-output");
        if (output) output.textContent = `Failed to load replay: ${err instanceof Error ? err.message : String(err)}`;
      }
    };
    reader.readAsText(file);
  });

  host.querySelector("#rv-goto")?.addEventListener("click", () => {
    if (!currentReplay) return;
    const tickInput = host.querySelector<HTMLInputElement>("#rv-tick");
    const output = host.querySelector<HTMLElement>("#rv-output");
    if (!tickInput || !output) return;

    const targetTick = parseInt(tickInput.value, 10);
    if (isNaN(targetTick)) return;

    try {
      const world = replayTo(currentReplay, targetTick, CTX);
      const lines: string[] = [`State at tick ${targetTick}:`];

      for (const [id, entity] of world.entities) {
        const c = entity.condition;
        lines.push(
          `  Entity ${id}: pos=(${entity.pos.x},${entity.pos.y}) ` +
          (c
            ? `shock=${c.shockQ ?? 0}  conscious=${String(c.isConscious ?? true)}`
            : "(no condition)"),
        );
      }

      output.textContent = lines.join("\n");
    } catch (err) {
      output.textContent = `replayTo error: ${err instanceof Error ? err.message : String(err)}`;
    }
  });
}
