# ananke-world-ui — Roadmap

## Phase 1 (current): Scenario Builder

A two-fighter combat scenario builder.

- Dropdown selectors for archetype (from `ARCHETYPE_MAP`) and weapon (from `ITEM_MAP`)
- World seed input
- "Run Fight" button: calls `createWorld()` + `stepWorld()` loop up to 2000 ticks
- Displays winner, ticks elapsed, final shock/consciousness state per entity
- TODO: live tick-by-tick animation using `requestAnimationFrame` + a simple canvas overlay

## Phase 2: Species Designer

Visual sliders for archetype variance parameters.

- Range inputs for `statureVar`, `massVar`, `actuatorScaleVar`, `peakForceVar`,
  `actuatorSpeedVar`, `reachVar` — mutates a copy of the base archetype
- Calls `generateIndividual(seed, mutatedArchetype)` on every slider change
- Shows formatted `IndividualAttributes` output: mass, stature, reach, combat block, cognition block
- "Randomize seed" button for exploring variation
- Side-by-side comparison: two individuals from the same archetype with different seeds

## Phase 3: World Simulation

Campaign-scale polity simulation.

- Polity name, population, and treasury inputs for up to 4 polities
- Shared-location configuration (trade route setup)
- Runs `stepPolityDay()` loop for configurable number of days
- **Territory map**: SVG grid coloured by polityId ownership; updates after each run
- Trade income chart (simple bar per polity)
- "Declare war" button between polity pairs — reruns with `declareWar()` applied
- Move simulation loop to a Web Worker to keep UI responsive during long runs

## Phase 4: Replay Viewer

Inspect serialized simulation replays.

- File input accepting `serializeReplay()` JSON output
- Tick scrubber slider (0 → max tick)
- "Go to tick" button calls `replayTo()` and renders entity state
- **Overhead canvas**: 2-D dot plot of entity positions at each tick
- Play/pause button for automatic playback at configurable speed (ticks/second)
- Hover tooltip showing entity ID, archetype, shock level

## Phase 5: Validation Dashboard

Full in-browser validation suite.

- All `CALIBRATION_*` scenarios from the Ananke validation framework, ported to browser-runnable form
- Aggregate pass/fail badge and individual scenario status table
- Export results as JSON for comparison against CI baseline
- "Run single scenario" buttons for faster iteration
- Links to relevant ROADMAP entries and empirical dataset sources for each scenario
