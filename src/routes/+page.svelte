<script lang="ts">
  import PanelPlaceholder from '$lib/panels/PanelPlaceholder.svelte';
  import SimRunnerPanel from '$lib/panels/sim-runner/SimRunnerPanel.svelte';

  const panels = [
    {
      id: 'sim-runner',
      name: 'SimRunner',
      detail: 'Implemented first',
    },
    {
      id: 'world-builder',
      name: 'World Builder',
      detail: 'Scaffold only',
    },
    {
      id: 'entity-editor',
      name: 'Entity Editor',
      detail: 'Scaffold only',
    },
    {
      id: 'replay-viewer',
      name: 'Replay Viewer',
      detail: 'Scaffold only',
    },
    {
      id: 'dashboard',
      name: 'Dashboard',
      detail: 'Scaffold only',
    },
  ] as const;

  let activePanel: (typeof panels)[number]['id'] = 'sim-runner';
</script>

<div class="shell">
  <header class="topbar">
    <div class="title">
      <h1>Ananke World UI</h1>
      <p>Incremental SvelteKit scaffold with SimRunner delivered first.</p>
    </div>
    <div class="badge">Prototype → SvelteKit workbench</div>
  </header>

  <nav class="tabs" aria-label="Primary panels">
    {#each panels as panel}
      <button class:active={panel.id === activePanel} class="tab" on:click={() => (activePanel = panel.id)}>
        <span>{panel.name}</span>
        <small>{panel.detail}</small>
      </button>
    {/each}
  </nav>

  <main class="page-grid">
    <section class="hero">
      <div class="panel-header">
        <div>
          <h2>Build the app in slices, not all at once</h2>
          <p class="subtitle">
            This scaffold starts with the most central panel — SimRunner — then leaves the other four panels as planned
            shells so the app can iterate without spreading effort too thin.
          </p>
        </div>
        <span class="pill">SvelteKit foundation</span>
      </div>
      <div class="stats-grid">
        <div class="stat">
          <div class="muted">Framework</div>
          <strong>SvelteKit</strong>
        </div>
        <div class="stat">
          <div class="muted">3D preview</div>
          <strong>threejs-bridge</strong>
        </div>
        <div class="stat">
          <div class="muted">Delivery strategy</div>
          <strong>Incremental</strong>
        </div>
      </div>
    </section>

    {#if activePanel === 'sim-runner'}
      <SimRunnerPanel />
    {:else if activePanel === 'world-builder'}
      <PanelPlaceholder
        title="World Builder"
        summary="The SvelteKit shell is ready, but the implementation deliberately waits until SimRunner feedback settles."
        milestones={[
          'Map canvas for polity placement and location graph editing',
          'Campaign-state export wired into the shared app store',
          'Scenario presets that can launch directly into SimRunner',
        ]}
      />
    {:else if activePanel === 'entity-editor'}
      <PanelPlaceholder
        title="Entity Editor"
        summary="This panel will be the second data-authoring surface once the central loop is stable."
        milestones={[
          'Archetype stat controls and equipment selectors',
          'Live generated-individual preview backed by Ananke stable APIs',
          'Roster publishing directly into SimRunner sessions',
        ]}
      />
    {:else if activePanel === 'replay-viewer'}
      <PanelPlaceholder
        title="Replay Viewer"
        summary="Replay work is intentionally deferred until the runner’s recording model hardens."
        milestones={[
          'Replay scrubber using serialized output from SimRunner',
          '3D playback synchronized with tick timeline',
          'Entity inspector for any selected replay frame',
        ]}
      />
    {:else}
      <PanelPlaceholder
        title="Outcome Dashboard"
        summary="Aggregate analytics will land after the scenario and replay paths are both in place."
        milestones={[
          'Batch execution across seeds',
          'Win-rate and casualty charts',
          'CSV and image export for scenario balancing',
        ]}
      />
    {/if}
  </main>
</div>
