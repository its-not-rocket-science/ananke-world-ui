<script lang="ts">
  export let title: string;
  export let summary: string;
  export let milestones: string[] = [];
</script>

<section class="stack">
  <div class="card panel-header">
    <div>
      <h2>{title}</h2>
      <p class="subtitle">{summary}</p>
    </div>
    <span class="badge">Incremental scaffold</span>
  </div>

  <div class="placeholder-card">
    <h3>Planned next slices</h3>
    <ul class="placeholder-list">
      {#each milestones as milestone}
        <li>{milestone}</li>
      {/each}
    </ul>
  </div>
</section>
