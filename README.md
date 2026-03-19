# ananke-world-ui

A standalone browser UI for designing worlds and running
[Ananke](https://github.com/its-not-rocket-science/ananke) simulations without writing code.

Runs entirely in the browser — no server required.  The Ananke simulation engine is imported as
an ESM module and executes locally in the JavaScript engine.

---

## Features

| Tab | Description | Status |
|---|---|---|
| Scenario Builder | Pick two archetypes and weapons, run a fight, see the winner | Phase 1 |
| Species Designer | Adjust archetype parameters, preview generated individual attributes | Phase 2 stub |
| World Sim | Set up polities, run `stepPolityDay` loops, see treasury and morale | Phase 3 stub |
| Replay Viewer | Load a serialized replay JSON, scrub through the tick timeline | Phase 4 stub |
| Validation | Run emergent validation scenarios in-browser, see PASS/FAIL | Phase 5 stub |

---

## Quick start

```bash
npm install
npm run dev
# Open http://localhost:5173
```

---

## Screenshots

_Placeholder — screenshots will be added once the UI reaches Phase 2._

---

## Architecture

- Pure browser application — no Node.js runtime at run time
- TypeScript compiled via Vite (bundler mode; no separate `tsc` step needed for dev)
- `@its-not-rocket-science/ananke` is imported as a normal ESM dependency; all physics
  computation runs in the browser's JS engine
- No web workers yet; long simulations block the main thread briefly (Phase 3+ should move
  the simulation loop to a Worker)
- State is ephemeral — there is no persistence layer in Phase 1

### File layout

```
index.html            Main HTML; tab nav
src/
  main.ts             Tab router, mounts each panel
  scenario-builder.ts Phase 1 — fight runner
  species-designer.ts Phase 2 stub — archetype preview
  world-simulator.ts  Phase 3 stub — polity simulation
  replay-viewer.ts    Phase 4 stub — replay scrubber
  validation-panel.ts Phase 5 stub — validation dashboard
vite.config.ts        Vite build config
tsconfig.json         TypeScript config (bundler mode)
```

---

## Link

Core simulation engine: https://github.com/its-not-rocket-science/ananke
