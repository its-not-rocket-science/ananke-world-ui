import { ARCHETYPE_MAP, generateIndividual } from "@its-not-rocket-science/ananke";
import { ARMOUR_OPTIONS, ARCHETYPE_OPTIONS, WEAPON_OPTIONS, describeEntityTemplate, escapeHtml, entityTemplatesToJson, optionMarkup } from "./data.js";
import type { PanelContext } from "./app-types.js";
import type { EntityTemplate } from "./models.js";

export function mountSpeciesDesigner(host: HTMLElement, context: PanelContext): void {
  const render = () => {
    const state = context.getState();
    const current = state.entities[0];
    const preview = current ? previewFor(current) : "No entity templates yet.";
    const cards = state.entities
      .map(
        (entity) => `
          <article class="mini-card ${entity.id === current?.id ? "is-selected" : ""}">
            <div class="mini-card__title">
              <strong>${escapeHtml(entity.label)}</strong>
              <span class="pill">Team ${entity.teamId}</span>
            </div>
            <p class="muted">${escapeHtml(entity.archetype)} • ${escapeHtml(entity.weaponId ?? "unarmed")}</p>
            <pre class="inline-pre">${escapeHtml(describeEntityTemplate(entity))}</pre>
            <div class="button-row">
              <button data-action="entity-edit" data-id="${escapeHtml(entity.id)}">Load into editor</button>
              <button data-action="entity-remove" data-id="${escapeHtml(entity.id)}">Remove</button>
            </div>
          </article>`,
      )
      .join("");

    host.innerHTML = `
      <section class="panel-shell">
        <div class="panel-header">
          <div>
            <h2>Entity Editor</h2>
            <p class="subtitle">Author roster entries from Ananke archetypes, tune equipment loadouts, and preview the generated individual attributes before they enter simulations.</p>
          </div>
          <div class="header-actions">
            <button class="primary" id="ee-use-in-sim">Use current roster in Sim Runner</button>
          </div>
        </div>

        <div class="two-col-layout">
          <div class="stack-lg">
            <div class="card">
              <h3>Author archetype-backed loadout</h3>
              <div class="three-up">
                <label><span>Template label</span><input id="ee-label" type="text" value="${escapeHtml(current?.label ?? "New unit")}" /></label>
                <label><span>Template ID</span><input id="ee-id" type="text" value="${escapeHtml(current?.id ?? "new-unit")}" /></label>
                <label><span>Role</span><input id="ee-role" type="text" value="${escapeHtml(current?.role ?? "Skirmisher")}" /></label>
                <label><span>Base archetype</span><select id="ee-archetype">${optionMarkup(ARCHETYPE_OPTIONS, current?.archetype ?? ARCHETYPE_OPTIONS[0]?.value ?? "")}</select></label>
                <label><span>Weapon</span><select id="ee-weapon">${optionMarkup(WEAPON_OPTIONS, current?.weaponId ?? WEAPON_OPTIONS[0]?.value ?? "")}</select></label>
                <label><span>Armour</span><select id="ee-armour">${optionMarkup(ARMOUR_OPTIONS, current?.armourId ?? "")}</select></label>
                <label><span>Seed</span><input id="ee-seed" type="number" value="${current?.seed ?? 1}" /></label>
                <label><span>Team</span><input id="ee-team" type="number" value="${current?.teamId ?? 1}" /></label>
                <label><span>Body plan</span>
                  <select id="ee-body-plan">
                    <option value="humanoid" ${current?.bodyPlan === "humanoid" ? "selected" : ""}>humanoid</option>
                    <option value="quadruped" ${current?.bodyPlan === "quadruped" ? "selected" : ""}>quadruped</option>
                    <option value="custom" ${current?.bodyPlan === "custom" ? "selected" : ""}>custom</option>
                  </select>
                </label>
              </div>
              <div class="slider-grid">
                ${renderSlider("Mass overlay", "ee-mass", current?.overlay.massMul ?? 1, 0.7, 1.3, 0.01)}
                ${renderSlider("Peak force overlay", "ee-force", current?.overlay.peakForceMul ?? 1, 0.7, 1.4, 0.01)}
                ${renderSlider("Control overlay", "ee-control", current?.overlay.controlMul ?? 1, 0.7, 1.4, 0.01)}
                ${renderSlider("Reach overlay", "ee-reach", current?.overlay.reachMul ?? 1, 0.7, 1.3, 0.01)}
              </div>
              <div class="button-row">
                <button class="primary" id="ee-save">Save template</button>
                <button id="ee-randomize">Randomize seed</button>
                <button id="ee-duplicate">Duplicate current</button>
              </div>
            </div>

            <div class="card">
              <h3>Roster</h3>
              <div class="card-grid">${cards || `<p class="empty-state">No entity templates saved yet.</p>`}</div>
            </div>
          </div>

          <div class="stack-lg">
            <div class="card">
              <h3>Live generated preview</h3>
              <pre class="output tight">${escapeHtml(preview)}</pre>
            </div>
            <div class="card">
              <h3>Canonical export</h3>
              <p class="hint">This export preserves the editable archetype source plus its loadout and tuning overlay, which is what this app passes into the sim runner.</p>
              <textarea class="json-output" readonly>${escapeHtml(entityTemplatesToJson(state.entities))}</textarea>
            </div>
          </div>
        </div>
      </section>
    `;

    bindEditorEvents(render, context);
  };

  render();
}

function bindEditorEvents(render: () => void, context: PanelContext): void {
  document.getElementById("ee-save")?.addEventListener("click", () => {
    context.updateState((state) => {
      const template = collectForm();
      state.entities = [...state.entities.filter((item) => item.id !== template.id), template];
      if (!state.sim.selectedEntityIds.includes(template.id)) {
        state.sim.selectedEntityIds = [...state.sim.selectedEntityIds, template.id].slice(-4);
      }
    });
    render();
  });

  document.getElementById("ee-randomize")?.addEventListener("click", () => {
    const input = document.getElementById("ee-seed") as HTMLInputElement | null;
    if (input) {
      input.value = String(Math.floor(Math.random() * 100000));
      render();
    }
  });

  document.getElementById("ee-duplicate")?.addEventListener("click", () => {
    context.updateState((state) => {
      const template = collectForm();
      const duplicate: EntityTemplate = {
        ...template,
        id: `${template.id}-${Math.floor(Math.random() * 1000)}`,
        label: `${template.label} Copy`,
      };
      state.entities = [...state.entities, duplicate];
    });
    render();
  });

  document.getElementById("ee-use-in-sim")?.addEventListener("click", () => {
    context.navigate("world");
  });

  document.querySelectorAll<HTMLElement>("[data-action='entity-edit']").forEach((button) => {
    button.addEventListener("click", () => {
      const entity = context.getState().entities.find((item) => item.id === button.dataset.id);
      if (!entity) return;
      fillForm(entity);
      render();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-action='entity-remove']").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      context.updateState((state) => {
        state.entities = state.entities.filter((item) => item.id !== id);
        state.sim.selectedEntityIds = state.sim.selectedEntityIds.filter((item) => item !== id);
        state.dashboard.teamA = state.dashboard.teamA.filter((item) => item !== id);
        state.dashboard.teamB = state.dashboard.teamB.filter((item) => item !== id);
      });
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>("#ee-seed, #ee-mass, #ee-force, #ee-control, #ee-reach").forEach((input) => {
    input.addEventListener("input", () => {
      const previewTarget = document.querySelector<HTMLElement>(".output.tight");
      if (previewTarget) previewTarget.textContent = previewFor(collectForm());
    });
  });
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("#ee-label, #ee-id, #ee-role, #ee-archetype, #ee-weapon, #ee-armour, #ee-team, #ee-body-plan").forEach((input) => {
    input.addEventListener("input", () => {
      const previewTarget = document.querySelector<HTMLElement>(".output.tight");
      if (previewTarget) previewTarget.textContent = previewFor(collectForm());
    });
  });
}

function collectForm(): EntityTemplate {
  const weaponId = valueOf("ee-weapon");
  const armourId = valueOf("ee-armour");
  return {
    id: slugOf(valueOf("ee-id") || "new-unit"),
    label: valueOf("ee-label") || "New unit",
    archetype: valueOf("ee-archetype") || ARCHETYPE_OPTIONS[0]?.value || "HUMAN_BASE",
    seed: numberOf("ee-seed", 1),
    teamId: numberOf("ee-team", 1),
    ...(weaponId ? { weaponId } : {}),
    ...(armourId ? { armourId } : {}),
    role: valueOf("ee-role") || "Skirmisher",
    bodyPlan: (valueOf("ee-body-plan") as EntityTemplate["bodyPlan"]) || "humanoid",
    overlay: {
      massMul: floatOf("ee-mass", 1),
      peakForceMul: floatOf("ee-force", 1),
      controlMul: floatOf("ee-control", 1),
      reachMul: floatOf("ee-reach", 1),
    },
  };
}

function fillForm(entity: EntityTemplate): void {
  setValue("ee-label", entity.label);
  setValue("ee-id", entity.id);
  setValue("ee-role", entity.role);
  setValue("ee-archetype", entity.archetype);
  setValue("ee-weapon", entity.weaponId ?? "");
  setValue("ee-armour", entity.armourId ?? "");
  setValue("ee-seed", String(entity.seed));
  setValue("ee-team", String(entity.teamId));
  setValue("ee-body-plan", entity.bodyPlan);
  setValue("ee-mass", String(entity.overlay.massMul));
  setValue("ee-force", String(entity.overlay.peakForceMul));
  setValue("ee-control", String(entity.overlay.controlMul));
  setValue("ee-reach", String(entity.overlay.reachMul));
}

function renderSlider(label: string, id: string, value: number, min: number, max: number, step: number): string {
  return `
    <label class="slider-row">
      <span>${escapeHtml(label)} <strong>${value.toFixed(2)}×</strong></span>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
    </label>
  `;
}

function previewFor(template: EntityTemplate): string {
  const archetype = ARCHETYPE_MAP.get(template.archetype);
  if (!archetype) {
    return `Unknown archetype: ${template.archetype}`;
  }

  const individual = generateIndividual(template.seed, archetype);
  const mass = (individual.morphology.mass_kg * template.overlay.massMul) / 1000;
  const peakForce = Number(individual.performance.peakForce_N) * template.overlay.peakForceMul;
  const stability = Number(individual.control.stability) * template.overlay.controlMul;
  const reachScale = Number(individual.morphology.reachScale) * template.overlay.reachMul;
  const reaction = individual.control.reactionTime_s / 1000;

  return [
    `${template.label} (${template.archetype})`,
    `Weapon: ${template.weaponId ?? "None"}`,
    `Armour: ${template.armourId ?? "None"}`,
    `Body plan: ${template.bodyPlan}`,
    `Role: ${template.role}`,
    "",
    `Mass: ${mass.toFixed(1)} kg`,
    `Peak force: ${peakForce.toFixed(0)}`,
    `Stability: ${stability.toFixed(0)}`,
    `Reach scale: ${reachScale.toFixed(2)}`,
    `Reaction time: ${reaction.toFixed(2)} s`,
    `Cognition (linguistic/logical/kinesthetic): ${individual.cognition?.linguistic ?? "n/a"} / ${individual.cognition?.logicalMathematical ?? "n/a"} / ${individual.cognition?.bodilyKinesthetic ?? "n/a"}`,
  ].join("\n");
}

function valueOf(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value.trim() ?? "";
}

function numberOf(id: string, fallback: number): number {
  return Number.parseInt(valueOf(id), 10) || fallback;
}

function floatOf(id: string, fallback: number): number {
  return Number.parseFloat(valueOf(id)) || fallback;
}

function setValue(id: string, value: string): void {
  const input = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (input) input.value = value;
}

function slugOf(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
