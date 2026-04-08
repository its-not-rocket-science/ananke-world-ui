# Ananke World UI Productization Audit (Companion to Ananke Core)

## 1) Ranked feature list (by reduction in Ananke core adoption friction)

This ranking is optimized for **time-to-first-success** for new users integrating and validating Ananke core.

1. **Save / Load / Export (scenario + replay bundles)**
   - Biggest friction reducer: users can share reproducible failures, benchmark cases, and demos.
   - Enables asynchronous collaboration between engine and UI teams.
   - Makes every other panel useful because work can be persisted.

2. **Replay scrubber + deterministic inspection**
   - Core users need to understand *why* outcomes occurred, not only outcomes.
   - Fastest path from "sim runs" to "sim is debuggable".
   - Directly supports calibration, regression triage, and trust in deterministic playback.

3. **Encounter editor + timeline/event authoring**
   - Turns raw core primitives into user-composable scenarios.
   - Lowers barrier for creating meaningful test worlds without writing code.
   - Should feed directly into SimRunner/session startup.

4. **God-mode inspection tooling**
   - Critical for supportability and model comprehension (entity internals, command queues, injuries, AI state).
   - Best paired with replay scrubber so inspectors can bind to any tick.

5. **Inventory/equipment authoring surface**
   - Important for gameplay/content iteration, but lower than reproducibility + debugging.
   - Should remain schema-driven from content packs rather than bespoke UI rules.

6. **World map / terrain painting**
   - High perceived value but not required for first useful productization milestone.
   - Risky early investment if map semantics and terrain effects are still evolving in core.

---

## 2) Development order for maximum “first useful product” value

## Stage A — First Useful Product (thin MVP)
1. **Scenario Loader + Session Launcher**
2. **Deterministic Run Controls** (run/pause/step/seed display)
3. **Replay Scrubber** (tick slider + play + frame inspector)
4. **Save/Load/Export bundle** (`scenario.json` + `replay.json` + metadata)
5. **Minimal God-mode Inspector** (selected entity + world tick snapshot)

Rationale: this stage establishes the core loop: *load -> run -> inspect -> export evidence*.

## Stage B — v1 hardening
6. **Encounter Editor with timeline/event tracks**
7. **Inventory/Equipment editor bound to content pack schemas**
8. **Bridge snapshot viewer parity (3D + fallback 2D)**
9. **Batch replay compare / regression view**
10. **Map/Terrain authoring (if core contracts stabilized)**

---

## 3) Thin MVP scope

The MVP should answer one question well:
> "Can a non-core engineer reliably reproduce, inspect, and share an Ananke simulation outcome from the browser UI?"

### In-scope
- Open scenario from file or URL.
- Launch simulation session against core adapter (local or remote).
- Step/pause/resume and view current tick.
- Record replay stream and scrub by tick.
- Inspect selected entity state at current tick.
- Export artifact bundle with:
  - scenario spec
  - replay
  - build/runtime metadata (core version, ui version, seed)

### Explicitly out-of-scope for MVP
- Full terrain painting UX.
- Full inventory balancing suite.
- Complex campaign-level dashboards.
- UI-owned simulation behavior (no duplicated core rules).

---

## 4) Strong v1 scope

A strong v1 should include everything in MVP plus:
- Timeline-driven encounter editing (spawn/events/triggers).
- Content-pack-backed inventory/equipment authoring + validation.
- Comparison mode (two replays or two seeds side-by-side).
- “Shareable diagnostic package” export/import workflow.
- Version compatibility checks for scenario/replay/content-pack schemas.
- Permissioned god-mode overlays (injury, command queue, AI intent, hit traces).

---

## 5) API contract assumptions the UI should rely on

UI should treat core as the authoritative simulation engine and use stable contracts only.

## 5.1 Scenario loading contract

```ts
interface ScenarioDocument {
  schemaVersion: string;
  scenarioId: string;
  name: string;
  seed: number;
  entities: EntitySpec[];
  world?: WorldConfigRef;
  encounterTimeline?: TimelineEvent[];
  contentPackRefs?: ContentPackRef[];
  metadata?: Record<string, unknown>;
}
```

Assumptions:
- `schemaVersion` required and semver-gated.
- UI performs structural validation only; core validates semantic legality.
- Unknown optional fields are preserved on round-trip.

## 5.2 World snapshot contract

```ts
interface WorldSnapshot {
  schemaVersion: string;
  tick: number;
  simTimeMs?: number;
  entities: EntitySnapshot[];
  systems?: Record<string, unknown>; // optional subsystem payloads
  checksums?: { stateHash?: string };
}
```

Assumptions:
- Produced by core at run-time and during replay reconstruction.
- Sufficient for inspectors and rendering adapters.
- Treated as immutable UI input.

## 5.3 Replay contract

```ts
interface ReplayDocument {
  schemaVersion: string;
  initialState: WorldSnapshot;
  frames: Array<{
    tick: number;
    commands?: Record<number, unknown[]>;
    events?: unknown[];
    snapshotRef?: string; // optional keyframe reference
  }>;
  metadata?: { coreVersion?: string; seed?: number };
}
```

Assumptions:
- Deterministic `replayTo(tick)` equivalent exists in core service/SDK.
- UI never re-simulates rules; it requests reconstructed snapshots.
- Optional keyframes are allowed for performance.

## 5.4 Bridge snapshot contract (render bridge)

```ts
interface BridgeSnapshot {
  tick: number;
  entities: Array<{
    id: number;
    teamId: number;
    x: number;
    y: number;
    z?: number;
    orientation?: number;
    dead?: boolean;
    annotations?: Record<string, unknown>;
  }>;
  fx?: unknown[];
}
```

Assumptions:
- Bridge payload is a projection from core snapshot, not a separate state source.
- If bridge unavailable, fallback renderer consumes same `BridgeSnapshot`.

## 5.5 Content pack contract

```ts
interface ContentPackManifest {
  packId: string;
  version: string;
  schemaVersion: string;
  dependencies?: Array<{ packId: string; versionRange: string }>;
  assets?: Record<string, string>;
  archetypes?: Record<string, unknown>;
  items?: Record<string, unknown>;
  validationRules?: unknown[];
}
```

Assumptions:
- Content packs are externalized and versioned independently.
- UI reads manifests and schemas for forms; core resolves final runtime behavior.

---

## 6) Exact integration boundary (prevent simulation logic duplication)

## UI responsibility
- Session orchestration (create/start/pause/step/close).
- Input authoring (scenario/timeline/inventory forms).
- Visualization (inspector, charts, 2D/3D projection).
- Artifact import/export and compatibility messaging.
- Lightweight syntactic validation and UX affordances.

## Core responsibility
- Simulation state transitions.
- Deterministic replay reconstruction.
- Semantic validation of scenarios and commands.
- Combat/AI/physics/injury/economy rules.
- Canonical serialization formats and migrations.

## Hard rule
> If code changes world state according to game/simulation rules, it belongs in core—not in world-ui.

---

## 7) Core repo changes needed to support world-ui cleanly

1. **Stabilize versioned schemas** for scenario, snapshot, replay, and content-pack manifest.
2. **Publish a thin transport-neutral adapter SDK** (TS types + client) for browser consumers.
3. **Expose deterministic replay APIs** with optional keyframes for fast random access.
4. **Provide schema + semantic validation endpoints** (or SDK functions) with machine-readable errors.
5. **Add capability discovery endpoint** (supported schema versions, optional modules, bridge features).
6. **Return compatibility metadata in every session** (`coreVersion`, schema versions, feature flags).
7. **Define command envelope contract** with idempotency and tick-target semantics.
8. **Ship snapshot hashing/checksum utilities** to verify replay fidelity and detect drift.
9. **Standardize error codes** for UI messaging (validation, unsupported schema, determinism mismatch).
10. **Document migration policy** for forward/backward compatibility between UI and core versions.

---

## 8) Anti-patterns to avoid

- **Re-implementing simulation steps in UI** for convenience or preview.
- **Tight coupling UI to unstable internal core structures** (private fields / inferred invariants).
- **One-off JSON shapes per panel** instead of shared contracts.
- **Rendering model as source of truth** (bridge state diverging from core snapshot).
- **Silent schema coercion** that mutates user input without explicit warnings.
- **Replay playback that depends on frame-rate timing** rather than tick index.
- **Panel-specific adapters each doing custom fetch/retry/version handling**.
- **Shipping authoring UX before save/export contract is stable**.
- **Embedding content definitions in UI code** instead of content-pack manifests.
- **Ignoring determinism diagnostics** (no hashes, no version stamps, no seed provenance).

---

## 9) Why this ordering fits current repo state

- The current repo already emphasizes a **SimRunner-first scaffold**, with other panels intentionally placeholders.
- There is already a seed/session/tick loop path and replay serialization hook, which aligns with MVP reproducibility goals.
- There is already an optional world server adapter concept (remote vs local fallback), which is a good basis for a clean integration boundary.

Therefore, the highest ROI path is to harden **contracts + replay/export loop** before expanding map/terrain and deeper authoring surfaces.
