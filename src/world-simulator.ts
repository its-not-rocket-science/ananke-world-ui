import { ReplayRecorder, createWorld, serializeReplay, stepWorld } from "@its-not-rocket-science/ananke";
import { createPreviewRenderer, type PreviewRenderer } from "./bridge/three-preview.js";
import { escapeHtml } from "./data.js";
import type { PanelContext } from "./app-types.js";
import { KERNEL_CONTEXT } from "./models.js";
import { buildProductizationBundle, parseProductizationBundle } from "./productization-bundle.js";
import { OptionalWorldServerAdapter } from "./world-server-adapter.js";

const SPEED_OPTIONS = [0.5, 1, 5, 20];

type WorldState = ReturnType<typeof createWorld>;

interface SimulationSession {
  world: WorldState;
  recorder: ReplayRecorder;
  log: string[];
  selectedEntityId: number | null;
  pendingCommands: Map<number, readonly CommandLike[]>;
}

interface CommandLike {
  kind: string;
  targetId?: number;
  dir?: { x: number; y: number; z: number };
  intensity?: number;
  mode?: string;
}

let activeSession: SimulationSession | null = null;
let runTimer: number | null = null;
let previewRendererPromise: Promise<PreviewRenderer> | null = null;
let previewRenderer: PreviewRenderer | null = null;
const worldServer = new OptionalWorldServerAdapter();
let worldServerModeMessage = "Multiplayer adapter idle.";
let worldServerSessionId = "";
let bundleStatusMessage = "No scenario bundle imported yet.";

export function mountWorldSimulator(host: HTMLElement, context: PanelContext): void {
  const render = async () => {
    const state = context.getState();
    const availableEntities = state.entities;
    const selected = availableEntities.filter((entity) => state.sim.selectedEntityIds.includes(entity.id));
    const session = activeSession;
    const rows = session
      ? session.world.entities
          .map(
            (entity) => `
              <tr class="${entity.id === session.selectedEntityId ? "is-selected-row" : ""}" data-entity-id="${entity.id}">
                <td>#${entity.id}</td>
                <td>Team ${entity.teamId}</td>
                <td>${entity.position_m.x}, ${entity.position_m.y}</td>
                <td>${entity.injury.shock.toFixed(0)}</td>
                <td>${entity.injury.consciousness.toFixed(0)}</td>
                <td>${entity.injury.dead ? "dead" : "active"}</td>
              </tr>`,
          )
          .join("")
      : `<tr><td colspan="6" class="empty-cell">No active simulation yet.</td></tr>`;

    host.innerHTML = `
      <section class="panel-shell">
        <div class="panel-header">
          <div>
            <h2>Sim Runner</h2>
            <p class="subtitle">Run the Ananke tick loop, dispatch manual commands, inspect entity state live, and persist a replay that the replay viewer can scrub later.</p>
          </div>
          <div class="header-actions">
            <button class="primary" id="sr-build-world">Build session</button>
            <button id="sr-open-replay">Open latest replay</button>
          </div>
        </div>

        <div class="dashboard-layout">
          <div class="stack-lg">
            <div class="card">
              <h3>Scenario setup</h3>
              <div class="three-up">
                <label><span>World seed</span><input id="sr-seed" type="number" value="${state.world.seed}" /></label>
                <label><span>Max ticks</span><input id="sr-max-ticks" type="number" value="${state.sim.maxTicks}" /></label>
                <label><span>Speed</span>
                  <select id="sr-speed">${SPEED_OPTIONS.map((value) => `<option value="${value}" ${state.sim.speed === value ? "selected" : ""}>${value}×</option>`).join("")}</select>
                </label>
              </div>
              <div class="selection-list">
                ${availableEntities
                  .map(
                    (entity) => `
                      <label class="selection-item">
                        <input type="checkbox" data-select-entity="${escapeHtml(entity.id)}" ${state.sim.selectedEntityIds.includes(entity.id) ? "checked" : ""} />
                        <span>${escapeHtml(entity.label)} <em>(${escapeHtml(entity.archetype)})</em></span>
                      </label>`,
                  )
                  .join("") || `<p class="empty-state">Create entities in the Entity Editor first.</p>`}
              </div>
              <div class="button-row">
                <button class="primary" id="sr-start">Run / resume</button>
                <button id="sr-pause">Pause</button>
                <button id="sr-step">Step one tick</button>
                <button id="sr-reset">Reset</button>
              </div>
            </div>

            <div class="card">
              <h3>Manual command builder</h3>
              <div class="three-up">
                <label><span>Selected entity</span>
                  <select id="sr-command-entity">
                    ${(session?.world.entities ?? [])
                      .map((entity) => `<option value="${entity.id}" ${entity.id === session?.selectedEntityId ? "selected" : ""}>#${entity.id} (Team ${entity.teamId})</option>`)
                      .join("")}
                  </select>
                </label>
                <label><span>Action</span>
                  <select id="sr-command-kind">
                    <option value="move">move</option>
                    <option value="attack">attack</option>
                    <option value="flee">flee</option>
                  </select>
                </label>
                <label><span>Target entity</span>
                  <select id="sr-command-target">
                    ${(session?.world.entities ?? [])
                      .map((entity) => `<option value="${entity.id}">#${entity.id}</option>`)
                      .join("")}
                  </select>
                </label>
                <label><span>Direction x,y</span><input id="sr-command-dir" type="text" value="1,0" /></label>
                <label><span>Intensity (Q-ish)</span><input id="sr-command-intensity" type="number" value="10000" /></label>
                <label><span>Queued commands</span><input id="sr-command-count" type="text" readonly value="${session ? countQueuedCommands(session.pendingCommands) : 0}" /></label>
              </div>
              <button class="primary" id="sr-queue-command">Queue command for next tick</button>
              <p class="hint">Move uses direction vectors, attack targets the chosen entity, and flee issues a run command in the opposite direction.</p>
            </div>

            <div class="card">
              <h3>Save / load / export bundle</h3>
              <div class="button-row">
                <button class="primary" id="sr-export-bundle">Export diagnostic bundle</button>
                <label class="inline-upload"><span>Import bundle</span><input id="sr-import-bundle" type="file" accept=".json" /></label>
              </div>
              <p class="hint">Bundles include scenario config, selected roster, runner settings, and latest replay JSON (if present).</p>
              <pre class="output tight">${escapeHtml(bundleStatusMessage)}</pre>
            </div>

            <div class="card">
              <h3>Optional multiplayer world-server adapter</h3>
              <div class="three-up">
                <label><span>Mode</span>
                  <select id="sr-multiplayer-enabled">
                    <option value="false" ${state.world.multiplayer.enabled ? "" : "selected"}>Browser-local</option>
                    <option value="true" ${state.world.multiplayer.enabled ? "selected" : ""}>world-server</option>
                  </select>
                </label>
                <label><span>Base URL</span><input id="sr-server-base" type="text" value="${escapeHtml(state.world.multiplayer.baseUrl)}" /></label>
                <label><span>Poll interval (ms)</span><input id="sr-server-poll" type="number" value="${state.world.multiplayer.pollMs}" /></label>
              </div>
              <div class="button-row">
                <button class="primary" id="sr-server-connect">Connect adapter</button>
                <button id="sr-server-session">Create remote session</button>
              </div>
              <pre class="output tight">${escapeHtml(worldServerModeMessage)}${worldServerSessionId ? `\nSession: ${worldServerSessionId}` : ""}</pre>
            </div>
          </div>

          <div class="stack-lg">
            <div class="card">
              <div class="card-header-inline">
                <h3>3D preview panel</h3>
                <button id="sr-load-preview">Lazy-load preview</button>
              </div>
              <div id="sr-preview-host" class="preview-host"><p class="empty-state">Preview not loaded yet.</p></div>
            </div>

            <div class="card">
              <h3>Live entity inspector</h3>
              <table class="data-table compact-rows">
                <thead><tr><th>ID</th><th>Team</th><th>Pos</th><th>Shock</th><th>Consciousness</th><th>Status</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>

            <div class="card">
              <h3>Session log</h3>
              <pre class="output session-log">${escapeHtml(session?.log.slice(-18).join("\n") || "Build a session to start logging ticks.")}</pre>
            </div>
          </div>
        </div>
      </section>
    `;

    bindEvents(host, context, render);
    if (session && previewRenderer) {
      previewRenderer.render(makePreviewPayload(session.world));
    }
  };

  void render();
}

function bindEvents(host: HTMLElement, context: PanelContext, rerender: () => Promise<void>): void {
  host.querySelectorAll<HTMLInputElement>("[data-select-entity]").forEach((input) => {
    input.addEventListener("change", () => {
      context.updateState((state) => {
        const id = input.dataset.selectEntity;
        if (!id) return;
        if (input.checked) {
          state.sim.selectedEntityIds = [...new Set([...state.sim.selectedEntityIds, id])];
        } else {
          state.sim.selectedEntityIds = state.sim.selectedEntityIds.filter((item) => item !== id);
        }
      });
    });
  });

  host.querySelector("#sr-build-world")?.addEventListener("click", () => {
    context.updateState((state) => {
      state.world.seed = numberValue(host, "#sr-seed", state.world.seed);
      state.sim.maxTicks = numberValue(host, "#sr-max-ticks", state.sim.maxTicks);
      state.sim.speed = floatValue(host, "#sr-speed", state.sim.speed);
    });
    activeSession = buildSession(context);
    void rerender();
  });

  host.querySelector("#sr-start")?.addEventListener("click", () => {
    if (!activeSession) activeSession = buildSession(context);
    clearRunTimer();
    const stepDelay = Math.max(20, 220 / context.getState().sim.speed);
    runTimer = window.setInterval(() => {
      if (!activeSession) return;
      stepSimulation(activeSession, context);
      if (activeSession.world.tick >= context.getState().sim.maxTicks || hasWinner(activeSession.world)) {
        clearRunTimer();
      }
      void rerender();
    }, stepDelay);
  });

  host.querySelector("#sr-pause")?.addEventListener("click", () => {
    clearRunTimer();
  });

  host.querySelector("#sr-step")?.addEventListener("click", () => {
    if (!activeSession) activeSession = buildSession(context);
    if (activeSession) {
      stepSimulation(activeSession, context);
      void rerender();
    }
  });

  host.querySelector("#sr-reset")?.addEventListener("click", () => {
    clearRunTimer();
    activeSession = null;
    void rerender();
  });

  host.querySelector("#sr-queue-command")?.addEventListener("click", async () => {
    if (!activeSession) {
      activeSession = buildSession(context);
    }
    const session = activeSession;
    if (!session) return;

    const entityId = numberValue(host, "#sr-command-entity", session.world.entities[0]?.id ?? 1);
    const commandKind = stringValue(host, "#sr-command-kind", "move");
    const targetId = numberValue(host, "#sr-command-target", entityId);
    const intensity = numberValue(host, "#sr-command-intensity", 10000);
    const [x, y] = pairValue(host, "#sr-command-dir", 1, 0);

    const queue = session.pendingCommands.get(entityId) ?? [];
    let command: CommandLike;
    if (commandKind === "attack") {
      command = { kind: "attack", targetId, mode: "strike", intensity };
    } else if (commandKind === "flee") {
      command = { kind: "move", dir: { x: -x, y: -y, z: 0 }, intensity, mode: "run" };
    } else {
      command = { kind: "move", dir: { x, y, z: 0 }, intensity, mode: "run" };
    }
    session.pendingCommands.set(entityId, [...queue, command]);

    if (context.getState().world.multiplayer.enabled && worldServerSessionId) {
      await worldServer.sendCommands(worldServerSessionId, { entityId, command });
      worldServerModeMessage = `${worldServerModeMessage}\nQueued command for remote entity #${entityId}.`;
    }
    void rerender();
  });

  host.querySelector("#sr-open-replay")?.addEventListener("click", () => {
    context.navigate("replay");
  });

  host.querySelector("#sr-export-bundle")?.addEventListener("click", () => {
    const state = context.getState();
    const bundle = buildProductizationBundle(state);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const download = document.createElement("a");
    const slug = slugify(state.world.name || "scenario");
    download.href = url;
    download.download = `${slug}-bundle-${Date.now()}.json`;
    download.click();
    URL.revokeObjectURL(url);
    bundleStatusMessage = `Exported schema ${bundle.schemaVersion} bundle for "${state.world.name}" at ${bundle.exportedAt}.`;
    void rerender();
  });

  host.querySelector<HTMLInputElement>("#sr-import-bundle")?.addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const bundle = parseProductizationBundle(await file.text());
      context.updateState((state) => {
        state.world = bundle.scenario.world;
        state.entities = bundle.scenario.entities;
        state.sim = bundle.scenario.sim;
        state.latestReplayJson = bundle.replay?.replayJson ?? "";
        state.latestReplayName = bundle.replay?.name ?? "";
      });
      activeSession = null;
      clearRunTimer();
      bundleStatusMessage = `Imported ${file.name} (schema ${bundle.schemaVersion}, exported ${bundle.exportedAt}).`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      bundleStatusMessage = `Import failed: ${message}`;
    }
    void rerender();
  });

  host.querySelector("#sr-load-preview")?.addEventListener("click", async () => {
    const previewHost = host.querySelector<HTMLElement>("#sr-preview-host");
    if (!previewHost) return;
    if (!previewRendererPromise) {
      previewRendererPromise = createPreviewRenderer(previewHost).then((renderer) => {
        previewRenderer = renderer;
        return renderer;
      });
    }
    await previewRendererPromise;
    if (activeSession && previewRenderer) {
      previewRenderer.render(makePreviewPayload(activeSession.world));
    }
  });

  host.querySelectorAll<HTMLTableRowElement>("[data-entity-id]").forEach((row) => {
    row.addEventListener("click", () => {
      if (!activeSession) return;
      activeSession.selectedEntityId = Number.parseInt(row.dataset.entityId ?? "0", 10) || null;
      void rerender();
    });
  });

  host.querySelector("#sr-server-connect")?.addEventListener("click", async () => {
    context.updateState((state) => {
      state.world.multiplayer.enabled = stringValue(host, "#sr-multiplayer-enabled", "false") === "true";
      state.world.multiplayer.baseUrl = stringValue(host, "#sr-server-base", state.world.multiplayer.baseUrl);
      state.world.multiplayer.pollMs = numberValue(host, "#sr-server-poll", state.world.multiplayer.pollMs);
    });
    const result = await worldServer.connect(context.getState().world.multiplayer.baseUrl);
    worldServerModeMessage = `${result.message}\nPolling: ${context.getState().world.multiplayer.pollMs} ms.`;
    void rerender();
  });

  host.querySelector("#sr-server-session")?.addEventListener("click", async () => {
    const state = context.getState();
    const selected = state.entities.filter((entity) => state.sim.selectedEntityIds.includes(entity.id));
    if (selected.length === 0) {
      worldServerModeMessage = "Select at least one roster entry before creating a world-server session.";
      void rerender();
      return;
    }
    worldServerSessionId = await worldServer.createSession({
      seed: state.world.seed,
      entities: selected.map((entity, index) => toEntitySpec(entity, index + 1)),
    });
    worldServerModeMessage = `${worldServerModeMessage}\nCreated adapter session.`;
    void rerender();
  });
}

function buildSession(context: PanelContext): SimulationSession {
  const state = context.getState();
  const selected = state.entities.filter((entity) => state.sim.selectedEntityIds.includes(entity.id));
  const entities = selected.map((entity, index) => toEntitySpec(entity, index + 1));

  const world = createWorld(state.world.seed, entities);
  const recorder = new ReplayRecorder(world);
  return {
    world,
    recorder,
    log: [`Built session for ${state.world.name} with ${entities.length} entities.`],
    selectedEntityId: world.entities[0]?.id ?? null,
    pendingCommands: new Map(),
  };
}

function stepSimulation(session: SimulationSession, context: PanelContext): void {
  const before = new Map(session.world.entities.map((entity) => [entity.id, { shock: entity.injury.shock, dead: entity.injury.dead }]));
  const commands = new Map(session.pendingCommands.entries());
  session.recorder.record(session.world.tick, commands as never);
  stepWorld(session.world, commands as never, KERNEL_CONTEXT);
  session.pendingCommands.clear();

  const deltas = session.world.entities
    .map((entity) => {
      const previous = before.get(entity.id);
      const shockDelta = previous ? entity.injury.shock - previous.shock : 0;
      const status = entity.injury.dead ? "dead" : entity.injury.consciousness < 2000 ? "fading" : "active";
      return `t${session.world.tick} • #${entity.id} ${status} @ (${entity.position_m.x},${entity.position_m.y}) Δshock=${shockDelta.toFixed(0)}`;
    })
    .join("\n");
  session.log.push(deltas);

  const winner = hasWinner(session.world);
  if (winner) {
    session.log.push(`Winner: Team ${winner} at tick ${session.world.tick}.`);
  }

  const replayJson = serializeReplay(session.recorder.toReplay());
  context.updateState((state) => {
    state.latestReplayJson = replayJson;
    state.latestReplayName = `${state.world.name} @ tick ${session.world.tick}`;
  });

  if (previewRenderer) {
    previewRenderer.render(makePreviewPayload(session.world));
  }
}

function hasWinner(world: WorldState): number | null {
  const livingTeams = new Set(
    world.entities
      .filter((entity) => !entity.injury.dead && entity.injury.consciousness >= 2000)
      .map((entity) => entity.teamId),
  );
  return livingTeams.size === 1 ? [...livingTeams][0] ?? null : null;
}

function makePreviewPayload(world: WorldState) {
  return {
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
  };
}

function clearRunTimer(): void {
  if (runTimer !== null) {
    window.clearInterval(runTimer);
    runTimer = null;
  }
}

function countQueuedCommands(commands: Map<number, readonly CommandLike[]>): number {
  return [...commands.values()].reduce((sum, list) => sum + list.length, 0);
}

function stringValue(host: HTMLElement, selector: string, fallback: string): string {
  return (host.querySelector<HTMLInputElement | HTMLSelectElement>(selector)?.value ?? fallback).trim();
}

function numberValue(host: HTMLElement, selector: string, fallback: number): number {
  return Number.parseInt(stringValue(host, selector, String(fallback)), 10) || fallback;
}

function floatValue(host: HTMLElement, selector: string, fallback: number): number {
  return Number.parseFloat(stringValue(host, selector, String(fallback))) || fallback;
}

function pairValue(host: HTMLElement, selector: string, fallbackX: number, fallbackY: number): [number, number] {
  const values = stringValue(host, selector, `${fallbackX},${fallbackY}`)
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10));
  const x = values[0];
  const y = values[1];
  return [typeof x === "number" && Number.isFinite(x) ? x : fallbackX, typeof y === "number" && Number.isFinite(y) ? y : fallbackY];
}

function toEntitySpec(entity: { teamId: number; seed: number; archetype: string; weaponId?: string; armourId?: string }, id: number) {
  return {
    id,
    teamId: entity.teamId,
    seed: entity.seed,
    archetype: entity.archetype,
    weaponId: entity.weaponId ?? "wpn_boxing_gloves",
    ...(entity.armourId ? { armourId: entity.armourId } : {}),
  };
}

function slugify(value: string): string {
  const next = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return next || "scenario";
}
