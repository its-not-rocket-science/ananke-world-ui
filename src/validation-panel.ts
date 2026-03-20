import { createWorld, stepWorld } from "@its-not-rocket-science/ananke";
import { escapeHtml } from "./data.js";
import type { PanelContext } from "./app-types.js";
import { KERNEL_CONTEXT } from "./models.js";

interface TrialSummary {
  seed: number;
  winnerTeam: number | null;
  duration: number;
  casualties: number;
  shockCurve: number[];
}

let latestTrials: TrialSummary[] = [];
let latestCsv = "";

export function mountValidationPanel(host: HTMLElement, context: PanelContext): void {
  const render = () => {
    const state = context.getState();
    const options = state.entities
      .map((entity) => `<option value="${escapeHtml(entity.id)}">${escapeHtml(entity.label)}</option>`)
      .join("");

    host.innerHTML = `
      <section class="panel-shell">
        <div class="panel-header">
          <div>
            <h2>Dashboard</h2>
            <p class="subtitle">Batch the current roster over many seeds to estimate win rates, casualty distributions, survival duration, and average shock progression.</p>
          </div>
          <div class="header-actions">
            <button class="primary" id="db-run">Run dashboard batch</button>
            <button id="db-copy-csv">Copy CSV</button>
          </div>
        </div>

        <div class="dashboard-layout">
          <div class="stack-lg">
            <div class="card">
              <h3>Batch setup</h3>
              <div class="three-up">
                <label><span>Trials</span><input id="db-trials" type="number" value="${state.dashboard.trials}" /></label>
                <label><span>Max ticks</span><input id="db-max-ticks" type="number" value="${state.dashboard.maxTicks}" /></label>
                <label><span>Team A entity</span><select id="db-team-a">${options}</select></label>
                <label><span>Team B entity</span><select id="db-team-b">${options}</select></label>
              </div>
              <p class="hint">Each trial rebuilds the world with a new seed while keeping the chosen roster loadouts stable.</p>
            </div>

            <div class="card">
              <h3>Win rate by faction</h3>
              ${renderBarChart(latestTrials)}
            </div>

            <div class="card">
              <h3>Casualty distribution</h3>
              ${renderHistogram(latestTrials)}
            </div>
          </div>

          <div class="stack-lg">
            <div class="card">
              <h3>Survival curves</h3>
              ${renderSurvivalCurve(latestTrials)}
            </div>
            <div class="card">
              <h3>Shock progression</h3>
              ${renderShockCurve(latestTrials)}
            </div>
            <div class="card">
              <h3>CSV export</h3>
              <textarea class="json-output" readonly>${escapeHtml(latestCsv || "Run the dashboard to produce a CSV export.")}</textarea>
            </div>
          </div>
        </div>
      </section>
    `;

    const teamASelect = host.querySelector<HTMLSelectElement>("#db-team-a");
    const teamBSelect = host.querySelector<HTMLSelectElement>("#db-team-b");
    if (teamASelect) teamASelect.value = state.dashboard.teamA[0] ?? state.entities[0]?.id ?? "";
    if (teamBSelect) teamBSelect.value = state.dashboard.teamB[0] ?? state.entities[1]?.id ?? state.entities[0]?.id ?? "";

    host.querySelector("#db-run")?.addEventListener("click", async () => {
      context.updateState((current) => {
        current.dashboard.trials = numberValue(host, "#db-trials", current.dashboard.trials);
        current.dashboard.maxTicks = numberValue(host, "#db-max-ticks", current.dashboard.maxTicks);
        current.dashboard.teamA = [stringValue(host, "#db-team-a", current.dashboard.teamA[0] ?? "")];
        current.dashboard.teamB = [stringValue(host, "#db-team-b", current.dashboard.teamB[0] ?? "")];
      });
      latestTrials = runDashboardTrials(context);
      latestCsv = toCsv(latestTrials);
      render();
    });

    host.querySelector("#db-copy-csv")?.addEventListener("click", async () => {
      if (!latestCsv) return;
      await navigator.clipboard.writeText(latestCsv);
    });
  };

  render();
}

function runDashboardTrials(context: PanelContext): TrialSummary[] {
  const state = context.getState();
  const entityA = state.entities.find((entity) => entity.id === state.dashboard.teamA[0]);
  const entityB = state.entities.find((entity) => entity.id === state.dashboard.teamB[0]);
  if (!entityA || !entityB) return [];

  const results: TrialSummary[] = [];
  for (let trial = 0; trial < state.dashboard.trials; trial++) {
    const seed = state.world.seed + trial;
    const world = createWorld(seed, [
      toEntitySpec(entityA, 1, trial),
      toEntitySpec(entityB, 2, trial),
    ]);

    const shockCurve: number[] = [];
    let duration = state.dashboard.maxTicks;
    let winnerTeam: number | null = null;
    for (let tick = 0; tick < state.dashboard.maxTicks; tick++) {
      stepWorld(world, new Map(), KERNEL_CONTEXT);
      const alive = world.entities.filter((entity) => !entity.injury.dead && entity.injury.consciousness >= 2000);
      shockCurve.push(world.entities.reduce((sum, entity) => sum + entity.injury.shock, 0) / world.entities.length);
      if (alive.length === 1) {
        duration = tick + 1;
        winnerTeam = alive[0]?.teamId ?? null;
        break;
      }
    }
    const casualties = world.entities.filter((entity) => entity.injury.dead || entity.injury.consciousness < 2000).length;
    results.push({ seed, winnerTeam, duration, casualties, shockCurve });
  }

  return results;
}

function toCsv(trials: TrialSummary[]): string {
  const rows = ["seed,winnerTeam,duration,casualties,meanShock"];
  for (const trial of trials) {
    const meanShock = trial.shockCurve.length === 0 ? 0 : trial.shockCurve.reduce((sum, value) => sum + value, 0) / trial.shockCurve.length;
    rows.push(`${trial.seed},${trial.winnerTeam ?? "draw"},${trial.duration},${trial.casualties},${meanShock.toFixed(2)}`);
  }
  return rows.join("\n");
}

function renderBarChart(trials: TrialSummary[]): string {
  if (trials.length === 0) {
    return `<p class="empty-state">Run a batch to see win rates.</p>`;
  }

  const team1Wins = trials.filter((trial) => trial.winnerTeam === 1).length;
  const team2Wins = trials.filter((trial) => trial.winnerTeam === 2).length;
  const draws = trials.length - team1Wins - team2Wins;
  const max = Math.max(team1Wins, team2Wins, draws, 1);
  return renderSimpleBars([
    { label: "Team 1", value: team1Wins, color: "#8b5cf6", max },
    { label: "Team 2", value: team2Wins, color: "#14b8a6", max },
    { label: "Draw", value: draws, color: "#64748b", max },
  ]);
}

function renderHistogram(trials: TrialSummary[]): string {
  if (trials.length === 0) {
    return `<p class="empty-state">Run a batch to see casualty counts.</p>`;
  }

  const counts = new Map<number, number>();
  for (const trial of trials) {
    counts.set(trial.casualties, (counts.get(trial.casualties) ?? 0) + 1);
  }
  const max = Math.max(...counts.values(), 1);
  return renderSimpleBars(
    [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([casualties, value]) => ({
      label: `${casualties} down`,
      value,
      color: "#f97316",
      max,
    })),
  );
}

function renderSurvivalCurve(trials: TrialSummary[]): string {
  if (trials.length === 0) {
    return `<p class="empty-state">Run a batch to see survival curves.</p>`;
  }

  const maxDuration = Math.max(...trials.map((trial) => trial.duration), 1);
  const points = trials
    .map((trial, index) => {
      const x = (index / Math.max(trials.length - 1, 1)) * 320;
      const y = 160 - (trial.duration / maxDuration) * 140;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return `<svg viewBox="0 0 340 180" class="chart-svg"><polyline fill="none" stroke="#38bdf8" stroke-width="3" points="${points}" /></svg>`;
}

function renderShockCurve(trials: TrialSummary[]): string {
  if (trials.length === 0) {
    return `<p class="empty-state">Run a batch to see mean shock over time.</p>`;
  }

  const maxLength = Math.max(...trials.map((trial) => trial.shockCurve.length), 1);
  const averages = Array.from({ length: maxLength }, (_, index) => {
    const values = trials.map((trial) => trial.shockCurve[index]).filter((value): value is number => typeof value === "number");
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
  const maxShock = Math.max(...averages, 1);
  const points = averages
    .map((value, index) => `${((index / Math.max(maxLength - 1, 1)) * 320).toFixed(1)},${(160 - (value / maxShock) * 140).toFixed(1)}`)
    .join(" ");
  return `<svg viewBox="0 0 340 180" class="chart-svg"><polyline fill="none" stroke="#a78bfa" stroke-width="3" points="${points}" /></svg>`;
}

function renderSimpleBars(bars: Array<{ label: string; value: number; color: string; max: number }>): string {
  return `
    <div class="bar-stack">
      ${bars
        .map(
          (bar) => `
            <div class="bar-row">
              <span>${escapeHtml(bar.label)}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${(bar.value / Math.max(bar.max, 1)) * 100}%;background:${escapeHtml(bar.color)}"></div></div>
              <strong>${bar.value}</strong>
            </div>`,
        )
        .join("")}
    </div>
  `;
}

function stringValue(host: HTMLElement, selector: string, fallback: string): string {
  return (host.querySelector<HTMLInputElement | HTMLSelectElement>(selector)?.value ?? fallback).trim();
}

function numberValue(host: HTMLElement, selector: string, fallback: number): number {
  return Number.parseInt(stringValue(host, selector, String(fallback)), 10) || fallback;
}

function toEntitySpec(entity: { seed: number; archetype: string; weaponId?: string; armourId?: string }, teamId: number, trial: number) {
  return {
    id: teamId,
    teamId,
    seed: entity.seed + trial,
    archetype: entity.archetype,
    weaponId: entity.weaponId ?? "wpn_boxing_gloves",
    ...(entity.armourId ? { armourId: entity.armourId } : {}),
  };
}
