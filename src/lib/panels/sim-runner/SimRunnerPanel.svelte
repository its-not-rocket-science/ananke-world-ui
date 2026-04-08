<script lang="ts">
  import { onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import Preview3D from '$lib/panels/sim-runner/Preview3D.svelte';
  import { appState } from '$lib/stores/app-state';
  import {
    SPEED_OPTIONS,
    buildSession,
    countQueuedCommands,
    getWinner,
    makePreviewPayload,
    stepSimulation,
    type CommandLike,
    type SimulationSession,
  } from '$lib/sim/sim-runner';
  import {
    buildProductizationBundle,
    parseProductizationBundle,
    type ProductizationBundle,
  } from '$lib/sim/productization-bundle';

  const initial = get(appState);

  let worldSeed = initial.world.seed;
  let maxTicks = initial.sim.maxTicks;
  let speed = initial.sim.speed;
  let session: SimulationSession | null = null;
  let timer: number | null = null;

  let commandEntityId = 1;
  let commandKind = 'move';
  let commandTargetId = 1;
  let direction = '1,0';
  let intensity = 10000;
  let bundleStatusMessage = 'No scenario bundle imported yet.';

  function syncSimulationConfig() {
    appState.update((state) => ({
      ...state,
      world: { ...state.world, seed: worldSeed },
      sim: { ...state.sim, maxTicks, speed },
    }));
  }

  function toggleEntity(id: string, checked: boolean) {
    appState.update((state) => ({
      ...state,
      sim: {
        ...state.sim,
        selectedEntityIds: checked
          ? [...new Set([...state.sim.selectedEntityIds, id])]
          : state.sim.selectedEntityIds.filter((item) => item !== id),
      },
    }));
  }

  function build() {
    syncSimulationConfig();
    session = buildSession(get(appState));
    commandEntityId = session.world.entities[0]?.id ?? 1;
    commandTargetId = session.world.entities[1]?.id ?? commandEntityId;
  }

  function pause() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function stepOnce() {
    if (!session) {
      build();
    }
    if (!session) return;

    const replay = stepSimulation(session, get(appState));
    appState.update((state) => ({
      ...state,
      latestReplayJson: replay.replayJson,
      latestReplayName: replay.replayName,
    }));
  }

  function start() {
    if (!session) {
      build();
    }
    if (!session) return;

    pause();
    const delay = Math.max(20, 220 / speed);
    timer = window.setInterval(() => {
      if (!session) return;
      stepOnce();
      if (session.world.tick >= maxTicks || getWinner(session.world)) {
        pause();
      }
    }, delay);
  }

  function reset() {
    pause();
    session = null;
  }

  function exportBundle() {
    const state = get(appState);
    const bundle = buildProductizationBundle(state);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const worldSlug = state.world.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
    link.href = URL.createObjectURL(blob);
    link.download = `ananke-bundle-${worldSlug || 'scenario'}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    bundleStatusMessage = `Exported bundle at ${bundle.exportedAt} (${bundle.replay ? 'includes replay' : 'scenario only'}).`;
  }

  async function importBundle(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      const parsed = parseProductizationBundle(await file.text());
      applyBundle(parsed);
      bundleStatusMessage = `Imported ${file.name} · schema ${parsed.schemaVersion} · exported ${new Date(parsed.exportedAt).toLocaleString()}.`;
      reset();
    } catch (error) {
      bundleStatusMessage = `Import failed: ${error instanceof Error ? error.message : 'Unknown error.'}`;
    } finally {
      input.value = '';
    }
  }

  function applyBundle(bundle: ProductizationBundle) {
    appState.update((state) => ({
      ...state,
      world: structuredClone(bundle.scenario.world),
      entities: structuredClone(bundle.scenario.entities),
      sim: structuredClone(bundle.scenario.sim),
      latestReplayJson: bundle.replay?.replayJson ?? '',
      latestReplayName: bundle.replay?.name ?? '',
    }));

    worldSeed = bundle.scenario.world.seed;
    maxTicks = bundle.scenario.sim.maxTicks;
    speed = bundle.scenario.sim.speed;
  }

  function queueCommand() {
    if (!session) {
      build();
    }
    if (!session) return;

    const [rawX, rawY] = direction.split(',').map((value) => Number.parseInt(value.trim(), 10));
    const x = Number.isFinite(rawX) ? rawX : 1;
    const y = Number.isFinite(rawY) ? rawY : 0;

    let command: CommandLike;
    if (commandKind === 'attack') {
      command = { kind: 'attack', targetId: commandTargetId, mode: 'strike', intensity };
    } else if (commandKind === 'flee') {
      command = { kind: 'move', dir: { x: -x, y: -y, z: 0 }, intensity, mode: 'run' };
    } else {
      command = { kind: 'move', dir: { x, y, z: 0 }, intensity, mode: 'run' };
    }

    const queue = session.pendingCommands.get(commandEntityId) ?? [];
    session.pendingCommands.set(commandEntityId, [...queue, command]);
    session = session;
  }

  $: previewPayload = session ? makePreviewPayload(session.world) : null;
  $: queuedCommands = session ? countQueuedCommands(session.pendingCommands) : 0;

  $: if (session && session.selectedEntityId === null) {
    session.selectedEntityId = session.world.entities[0]?.id ?? null;
  }

  onDestroy(() => {
    pause();
  });
</script>

<svelte:head>
  <title>Ananke World UI · SimRunner-first scaffold</title>
  <meta
    name="description"
    content="Incremental SvelteKit scaffold for Ananke World UI with a fully implemented SimRunner and threejs bridge preview panel."
  />
</svelte:head>

<section class="stack">
  <div class="card panel-header">
    <div>
      <h2>SimRunner</h2>
      <p class="subtitle">
        This first SvelteKit slice focuses on the central simulation workflow: select a roster, build a world, queue
        manual commands, step the Ananke tick loop, and inspect the live 3D preview.
      </p>
    </div>
    <div class="button-row">
      <button class="primary" on:click={build}>Build session</button>
      <button on:click={reset}>Reset</button>
    </div>
  </div>

  <div class="hero">
    <div class="hero-grid">
      <div class="stat">
        <div class="muted">Working slice</div>
        <strong>SimRunner</strong>
      </div>
      <div class="stat">
        <div class="muted">Selected roster</div>
        <strong>{$appState.sim.selectedEntityIds.length}</strong>
      </div>
      <div class="stat">
        <div class="muted">Latest replay</div>
        <strong>{$appState.latestReplayName || 'Not recorded yet'}</strong>
      </div>
      <div class="stat">
        <div class="muted">3D preview</div>
        <strong>threejs-bridge + fallback</strong>
      </div>
    </div>
    <div class="note muted">
      The remaining four panels are intentionally placeholders for now so the project can grow incrementally instead
      of shipping five half-built surfaces at once.
    </div>
  </div>

  <div class="dashboard-layout">
    <div class="stack">
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Scenario setup</h3>
            <p class="hint">Keep the seed and runtime controls here while the rest of the product is scaffolded.</p>
          </div>
          {#if session}
            <span class="pill">Tick {session.world.tick}</span>
          {/if}
        </div>

        <div class="form-grid">
          <label>
            <span>World seed</span>
            <input bind:value={worldSeed} type="number" />
          </label>
          <label>
            <span>Max ticks</span>
            <input bind:value={maxTicks} type="number" />
          </label>
          <label>
            <span>Speed</span>
            <select bind:value={speed}>
              {#each SPEED_OPTIONS as option}
                <option value={option}>{option}×</option>
              {/each}
            </select>
          </label>
        </div>

        <div class="roster-list" style="margin-top: 1rem;">
          {#each $appState.entities as entity}
            <label class="roster-item">
              <input
                checked={$appState.sim.selectedEntityIds.includes(entity.id)}
                type="checkbox"
                on:change={(event) => toggleEntity(entity.id, (event.currentTarget as HTMLInputElement).checked)}
              />
              <div>
                <strong>{entity.label}</strong>
                <div class="muted">{entity.role}</div>
                <div class="kv-grid" style="margin-top: 0.6rem;">
                  <span>Archetype</span><span>{entity.archetype}</span>
                  <span>Team</span><span>{entity.teamId}</span>
                  <span>Weapon</span><span>{entity.weaponId ?? 'Unarmed'}</span>
                </div>
              </div>
            </label>
          {/each}
        </div>

        <div class="button-row" style="margin-top: 1rem;">
          <button class="primary" on:click={start}>Run / resume</button>
          <button on:click={pause}>Pause</button>
          <button on:click={stepOnce}>Step one tick</button>
        </div>
      </div>

      <div class="card">
        <h3>Manual command builder</h3>
        <div class="form-grid">
          <label>
            <span>Selected entity</span>
            <select bind:value={commandEntityId}>
              {#each session?.world.entities ?? [] as entity}
                <option value={entity.id}>#{entity.id} (Team {entity.teamId})</option>
              {/each}
            </select>
          </label>
          <label>
            <span>Action</span>
            <select bind:value={commandKind}>
              <option value="move">move</option>
              <option value="attack">attack</option>
              <option value="flee">flee</option>
            </select>
          </label>
          <label>
            <span>Target entity</span>
            <select bind:value={commandTargetId}>
              {#each session?.world.entities ?? [] as entity}
                <option value={entity.id}>#{entity.id}</option>
              {/each}
            </select>
          </label>
          <label>
            <span>Direction x,y</span>
            <input bind:value={direction} />
          </label>
          <label>
            <span>Intensity</span>
            <input bind:value={intensity} type="number" />
          </label>
          <label>
            <span>Queued commands</span>
            <input readonly value={queuedCommands} />
          </label>
        </div>
        <div class="button-row" style="margin-top: 1rem;">
          <button class="primary" on:click={queueCommand}>Queue command for next tick</button>
        </div>
      </div>

      <div class="card">
        <h3>Session log</h3>
        <pre class="log">{session ? session.log.slice(-18).join('\n') : 'Build a session to start logging ticks.'}</pre>
      </div>

      <div class="card">
        <h3>Save / load / export bundle</h3>
        <div class="button-row">
          <button class="primary" on:click={exportBundle}>Export diagnostic bundle</button>
          <label class="inline-upload"
            ><span>Import bundle</span>
            <input type="file" accept=".json" on:change={importBundle} /></label
          >
        </div>
        <p class="hint">Bundles include scenario config, selected roster, runner settings, and latest replay JSON.</p>
        <pre class="log">{bundleStatusMessage}</pre>
      </div>
    </div>

    <div class="stack">
      <div class="card">
        <div class="card-header">
          <div>
            <h3>3D preview panel</h3>
            <p class="hint">
              On the client, this panel attempts to load <code>ananke-threejs-bridge</code>. If the optional package is
              absent, it falls back to a canvas renderer that still visualizes positions and rig-snapshot extraction.
            </p>
          </div>
          <span class="pill">Bridge ready</span>
        </div>
        <Preview3D payload={previewPayload} />
      </div>

      <div class="card">
        <h3>Live entity inspector</h3>
        <table class="entity-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Team</th>
              <th>Position</th>
              <th>Shock</th>
              <th>Consciousness</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {#if session}
              {#each session.world.entities as entity}
                <tr
                  class:selected={entity.id === session.selectedEntityId}
                  role="button"
                  tabindex="0"
                  on:click={() => {
                    if (!session) return;
                    session.selectedEntityId = entity.id;
                    session = session;
                  }}
                  on:keydown={(event) => {
                    if (!session || (event.key !== 'Enter' && event.key !== ' ')) return;
                    event.preventDefault();
                    session.selectedEntityId = entity.id;
                    session = session;
                  }}
                >
                  <td>#{entity.id}</td>
                  <td>{entity.teamId}</td>
                  <td>{entity.position_m.x}, {entity.position_m.y}</td>
                  <td>{entity.injury.shock.toFixed(0)}</td>
                  <td>{entity.injury.consciousness.toFixed(0)}</td>
                  <td>{entity.injury.dead ? 'dead' : 'active'}</td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="6" class="muted">No active simulation yet.</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>

      <div class="card">
        <h3>Incremental roadmap</h3>
        <div class="metrics-grid">
          <div class="metric">
            <div class="muted">Next panel</div>
            <strong>World Builder</strong>
          </div>
          <div class="metric">
            <div class="muted">After that</div>
            <strong>Entity Editor</strong>
          </div>
          <div class="metric">
            <div class="muted">Then</div>
            <strong>Replay + Dashboard</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
