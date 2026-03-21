<script lang="ts">
  import { browser } from '$app/environment';
  import { onDestroy, onMount } from 'svelte';
  import { createPreviewRenderer, type PreviewPayload, type PreviewRenderer } from '$lib/bridge/three-preview';

  export let payload: PreviewPayload | null = null;

  let host: HTMLDivElement;
  let renderer: PreviewRenderer | null = null;

  onMount(async () => {
    if (!browser || !host) return;
    renderer = await createPreviewRenderer(host);
    if (payload) {
      renderer.render(payload);
    }
  });

  $: if (renderer && payload) {
    renderer.render(payload);
  }

  onDestroy(() => {
    renderer?.destroy();
  });
</script>

<div class="preview-shell" bind:this={host}>
  {#if !payload}
    <p class="muted">Build a session to initialize the 3D preview panel.</p>
  {/if}
</div>
