import { escapeHtml, worldBlueprintToJson } from "./data.js";
import type { PanelContext } from "./app-types.js";
import type { StandingRule, WorldLocation, WorldPolity } from "./models.js";

export function mountScenarioBuilder(host: HTMLElement, context: PanelContext): void {
  const render = () => {
    const world = context.getState().world;
    const polityCards = world.polities
      .map(
        (polity) => `
          <article class="mini-card">
            <div class="mini-card__title">
              <span class="swatch" style="background:${escapeHtml(polity.color)}"></span>
              <strong>${escapeHtml(polity.name)}</strong>
            </div>
            <div class="kv-grid compact">
              <span>ID</span><span>${escapeHtml(polity.id)}</span>
              <span>Population</span><span>${polity.population.toLocaleString()}</span>
              <span>Treasury</span><span>${polity.treasury.toLocaleString()} cu</span>
              <span>Position</span><span>${polity.x}, ${polity.y}</span>
            </div>
            <button data-action="remove-polity" data-id="${escapeHtml(polity.id)}">Remove</button>
          </article>`,
      )
      .join("");

    const locationCards = world.locations
      .map(
        (location) => `
          <article class="mini-card">
            <div class="mini-card__title"><strong>${escapeHtml(location.name)}</strong></div>
            <div class="kv-grid compact">
              <span>Terrain</span><span>${escapeHtml(location.terrain)}</span>
              <span>Owner</span><span>${escapeHtml(location.polityId ?? "Unclaimed")}</span>
              <span>Links</span><span>${escapeHtml(location.linkedTo.join(", ") || "—")}</span>
              <span>Position</span><span>${location.x}, ${location.y}</span>
            </div>
            <button data-action="remove-location" data-id="${escapeHtml(location.id)}">Remove</button>
          </article>`,
      )
      .join("");

    const standingRows = world.standings
      .map(
        (standing, index) => `
          <tr>
            <td>${escapeHtml(standing.a)}</td>
            <td>${escapeHtml(standing.b)}</td>
            <td><span class="pill">${escapeHtml(standing.relation)}</span></td>
            <td><button data-action="remove-standing" data-index="${index}">Remove</button></td>
          </tr>`,
      )
      .join("");

    host.innerHTML = `
      <section class="panel-shell">
        <div class="panel-header">
          <div>
            <h2>World Builder</h2>
            <p class="subtitle">Shape the campaign graph, place polities on the map, and define the diplomatic starting state that the rest of the app consumes.</p>
          </div>
          <div class="header-actions">
            <button class="primary" id="wb-seed-apply">Randomize seed</button>
            <button id="wb-open-sim">Open in Sim Runner</button>
          </div>
        </div>

        <div class="two-col-layout">
          <div class="stack-lg">
            <div class="card">
              <h3>Map canvas</h3>
              <svg viewBox="0 0 480 280" class="map-canvas">
                ${renderLinks(world.locations)}
                ${world.locations
                  .map(
                    (location) => `<g>
                      <circle cx="${location.x}" cy="${location.y}" r="11" fill="${escapeHtml(findPolityColor(world.polities, location.polityId) ?? "#334155")}" stroke="#e2e8f0" stroke-width="1.5"></circle>
                      <text x="${location.x + 14}" y="${location.y + 4}" fill="#e2e8f0" font-size="11">${escapeHtml(location.name)}</text>
                    </g>`,
                  )
                  .join("")}
              </svg>
              <p class="hint">Locations are draggable in the roadmap spec; this reference build uses numeric coordinates for determinism and easy export.</p>
            </div>

            <div class="card">
              <h3>Polities</h3>
              <div class="three-up">
                <label><span>Name</span><input id="wb-polity-name" type="text" value="New polity" /></label>
                <label><span>ID</span><input id="wb-polity-id" type="text" value="new-polity" /></label>
                <label><span>Color</span><input id="wb-polity-color" type="text" value="#f59e0b" /></label>
                <label><span>Population</span><input id="wb-polity-population" type="number" value="5000" /></label>
                <label><span>Treasury</span><input id="wb-polity-treasury" type="number" value="2000" /></label>
                <label><span>HQ position</span><input id="wb-polity-position" type="text" value="240,140" /></label>
              </div>
              <button class="primary" id="wb-add-polity">Add polity</button>
              <div class="card-grid">${polityCards || `<p class="empty-state">No polities yet.</p>`}</div>
            </div>
          </div>

          <div class="stack-lg">
            <div class="card">
              <h3>Locations & edges</h3>
              <div class="three-up">
                <label><span>Name</span><input id="wb-location-name" type="text" value="New crossing" /></label>
                <label><span>ID</span><input id="wb-location-id" type="text" value="new-crossing" /></label>
                <label><span>Terrain</span><input id="wb-location-terrain" type="text" value="road" /></label>
                <label><span>Position</span><input id="wb-location-position" type="text" value="240,140" /></label>
                <label><span>Owner polity</span><input id="wb-location-owner" type="text" value="" placeholder="optional polity id" /></label>
                <label><span>Links</span><input id="wb-location-links" type="text" value="" placeholder="comma-separated ids" /></label>
              </div>
              <button class="primary" id="wb-add-location">Add location</button>
              <div class="card-grid">${locationCards || `<p class="empty-state">No locations yet.</p>`}</div>
            </div>

            <div class="card">
              <h3>Faction standings</h3>
              <div class="three-up">
                <label><span>Polity A</span><input id="wb-standing-a" type="text" value="${escapeHtml(world.polities[0]?.id ?? "")}" /></label>
                <label><span>Polity B</span><input id="wb-standing-b" type="text" value="${escapeHtml(world.polities[1]?.id ?? "")}" /></label>
                <label><span>Relation</span>
                  <select id="wb-standing-relation">
                    <option value="ally">ally</option>
                    <option value="neutral">neutral</option>
                    <option value="rival" selected>rival</option>
                    <option value="war">war</option>
                  </select>
                </label>
              </div>
              <button class="primary" id="wb-add-standing">Add standing</button>
              <table class="data-table">
                <thead><tr><th>A</th><th>B</th><th>Relation</th><th></th></tr></thead>
                <tbody>${standingRows || `<tr><td colspan="4" class="empty-cell">No standing rules yet.</td></tr>`}</tbody>
              </table>
            </div>

            <div class="card">
              <h3>Export</h3>
              <div class="inline-fields">
                <label><span>Scenario name</span><input id="wb-world-name" type="text" value="${escapeHtml(world.name)}" /></label>
                <label><span>Seed</span><input id="wb-world-seed" type="number" value="${world.seed}" /></label>
              </div>
              <textarea class="json-output" readonly>${escapeHtml(worldBlueprintToJson(world))}</textarea>
            </div>
          </div>
        </div>
      </section>
    `;

    bindEvents(render, context);
  };

  render();
}

function bindEvents(render: () => void, context: PanelContext): void {
  const host = document;
  host.getElementById("wb-add-polity")?.addEventListener("click", () => {
    context.updateState((state) => {
      const name = valueOf("wb-polity-name");
      const id = slugOf(valueOf("wb-polity-id"));
      const color = valueOf("wb-polity-color") || "#f59e0b";
      const population = numberOf("wb-polity-population", 5000);
      const treasury = numberOf("wb-polity-treasury", 2000);
      const [x, y] = pairOf("wb-polity-position", 240, 140);
      if (!id) return;
      const polity: WorldPolity = { id, name: name || id, color, population, treasury, x, y };
      state.world.polities = [...state.world.polities.filter((item) => item.id !== id), polity];
    });
    render();
  });

  host.getElementById("wb-add-location")?.addEventListener("click", () => {
    context.updateState((state) => {
      const name = valueOf("wb-location-name");
      const id = slugOf(valueOf("wb-location-id"));
      const terrain = valueOf("wb-location-terrain") || "road";
      const polityId = valueOf("wb-location-owner");
      const linkedTo = valueOf("wb-location-links")
        .split(",")
        .map((item) => slugOf(item))
        .filter(Boolean);
      const [x, y] = pairOf("wb-location-position", 240, 140);
      if (!id) return;
      const location: WorldLocation = {
        id,
        name: name || id,
        terrain,
        linkedTo,
        x,
        y,
        ...(polityId ? { polityId } : {}),
      };
      state.world.locations = [...state.world.locations.filter((item) => item.id !== id), location];
    });
    render();
  });

  host.getElementById("wb-add-standing")?.addEventListener("click", () => {
    context.updateState((state) => {
      const standing: StandingRule = {
        a: slugOf(valueOf("wb-standing-a")),
        b: slugOf(valueOf("wb-standing-b")),
        relation: (valueOf("wb-standing-relation") as StandingRule["relation"]) || "neutral",
      };
      if (!standing.a || !standing.b) return;
      state.world.standings = [...state.world.standings, standing];
    });
    render();
  });

  host.getElementById("wb-seed-apply")?.addEventListener("click", () => {
    context.updateState((state) => {
      state.world.seed = Math.floor(Math.random() * 100000);
    });
    render();
  });

  host.getElementById("wb-open-sim")?.addEventListener("click", () => {
    const worldNameInput = document.getElementById("wb-world-name") as HTMLInputElement | null;
    const worldSeedInput = document.getElementById("wb-world-seed") as HTMLInputElement | null;
    context.updateState((state) => {
      if (worldNameInput?.value) state.world.name = worldNameInput.value;
      if (worldSeedInput?.value) state.world.seed = Number.parseInt(worldSeedInput.value, 10) || state.world.seed;
    });
    context.navigate("world");
  });

  document.querySelectorAll<HTMLElement>("[data-action='remove-polity']").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      context.updateState((state) => {
        state.world.polities = state.world.polities.filter((item) => item.id !== id);
        state.world.locations = state.world.locations.map((location) =>
          location.polityId === id ? { ...location, polityId: undefined as never } : location,
        ).map((location) => {
          if (location.polityId !== undefined) return location;
          const { polityId: _ignored, ...rest } = location as WorldLocation & { polityId?: string };
          return rest as WorldLocation;
        });
        state.world.standings = state.world.standings.filter((standing) => standing.a !== id && standing.b !== id);
      });
      render();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-action='remove-location']").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      context.updateState((state) => {
        state.world.locations = state.world.locations
          .filter((item) => item.id !== id)
          .map((location) => ({ ...location, linkedTo: location.linkedTo.filter((link) => link !== id) }));
      });
      render();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-action='remove-standing']").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number.parseInt(button.dataset.index ?? "-1", 10);
      context.updateState((state) => {
        state.world.standings = state.world.standings.filter((_, itemIndex) => itemIndex !== index);
      });
      render();
    });
  });
}

function renderLinks(locations: WorldLocation[]): string {
  const seen = new Set<string>();
  const markup: string[] = [];
  for (const location of locations) {
    for (const neighborId of location.linkedTo) {
      const neighbor = locations.find((item) => item.id === neighborId);
      if (!neighbor) continue;
      const edgeId = [location.id, neighbor.id].sort().join("::");
      if (seen.has(edgeId)) continue;
      seen.add(edgeId);
      markup.push(
        `<line x1="${location.x}" y1="${location.y}" x2="${neighbor.x}" y2="${neighbor.y}" stroke="#475569" stroke-width="2" stroke-dasharray="6 4"></line>`,
      );
    }
  }
  return markup.join("");
}

function findPolityColor(polities: WorldPolity[], polityId?: string): string | undefined {
  return polities.find((polity) => polity.id === polityId)?.color;
}

function valueOf(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value.trim() ?? "";
}

function numberOf(id: string, fallback: number): number {
  return Number.parseInt(valueOf(id), 10) || fallback;
}

function pairOf(id: string, fallbackX: number, fallbackY: number): [number, number] {
  const values = valueOf(id).split(",").map((item) => Number.parseInt(item.trim(), 10));
  const left = values[0];
  const right = values[1];
  return [typeof left === "number" && Number.isFinite(left) ? left : fallbackX, typeof right === "number" && Number.isFinite(right) ? right : fallbackY];
}

function slugOf(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
