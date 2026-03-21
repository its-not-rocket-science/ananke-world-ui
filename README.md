# ananke-world-ui

An incremental **SvelteKit** scaffold for the Ananke product UI. This iteration deliberately implements **SimRunner first**, keeps the remaining four product panels as placeholders, and wires the preview surface to **threejs-bridge** with a graceful fallback renderer.

## Current status

This repo now focuses on a staged rollout instead of trying to finish all five product panels at once:

1. **SimRunner** — implemented first as the central workflow
2. **World Builder** — scaffold placeholder
3. **Entity Editor** — scaffold placeholder
4. **Replay Viewer** — scaffold placeholder
5. **Outcome Dashboard** — scaffold placeholder

## What is implemented in this slice

- SvelteKit application shell with panel navigation
- Shared app state store for world seed, roster, and replay metadata
- A functional SimRunner panel that can:
  - select the active roster
  - build a session with `createWorld`
  - run / pause / single-step the Ananke tick loop
  - queue simple `move`, `attack`, and `flee` commands
  - record replay output via `ReplayRecorder`
  - preview the fight in a 3D panel
- Dynamic preview integration that attempts to load `ananke-threejs-bridge`
- Canvas fallback preview when the optional bridge package is unavailable

## Project structure

```text
src/
├── app.css
├── app.html
├── lib/
│   ├── bridge/
│   │   └── three-preview.ts
│   ├── models.ts
│   ├── panels/
│   │   ├── PanelPlaceholder.svelte
│   │   └── sim-runner/
│   │       ├── Preview3D.svelte
│   │       └── SimRunnerPanel.svelte
│   ├── sim/
│   │   └── sim-runner.ts
│   └── stores/
│       └── app-state.ts
└── routes/
    ├── +layout.svelte
    └── +page.svelte
```

## Development

```bash
npm install
npm run dev
```

## Notes on the 3D preview bridge

The preview component tries to import `ananke-threejs-bridge` dynamically on the client. That package is listed as an **optional dependency** so the app can still run in environments where the bridge package is not available yet. In that case, the UI falls back to a built-in canvas renderer that still visualizes entity positions and rig snapshot extraction.

## Next recommended slices

1. Build the **World Builder** panel and feed its scenario data directly into SimRunner.
2. Build the **Entity Editor** so the roster is no longer hard-coded.
3. Add the **Replay Viewer** once the recording UX is stable.
4. Add the **Outcome Dashboard** after scenario and replay pipelines are both settled.
