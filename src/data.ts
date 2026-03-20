import {
  ARCHETYPE_MAP,
  ITEM_MAP,
  STARTER_ARMOUR,
  STARTER_WEAPONS,
  generateIndividual,
} from "@its-not-rocket-science/ananke";
import type { EntityTemplate, WorldBlueprint } from "./models.js";

export interface SelectOption {
  value: string;
  label: string;
}

export const ARCHETYPE_OPTIONS: SelectOption[] = [...ARCHETYPE_MAP.keys()]
  .sort()
  .map((key) => ({ value: key, label: key.replaceAll("_", " ") }));

const starterWeaponIds = new Set(STARTER_WEAPONS.map((weapon) => weapon.id));
const starterArmourIds = new Set(STARTER_ARMOUR.map((armour) => armour.id));

export const WEAPON_OPTIONS: SelectOption[] = [...ITEM_MAP.entries()]
  .filter(([key, value]) => value.kind === "weapon" && starterWeaponIds.has(key))
  .map(([key, value]) => ({ value: key, label: value.name }))
  .sort((a, b) => a.label.localeCompare(b.label));

export const ARMOUR_OPTIONS: SelectOption[] = [
  { value: "", label: "None" },
  ...[...ITEM_MAP.entries()]
    .filter(([key, value]) => value.kind === "armour" && starterArmourIds.has(key))
    .map(([key, value]) => ({ value: key, label: value.name }))
    .sort((a, b) => a.label.localeCompare(b.label)),
];

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function optionMarkup(options: SelectOption[], selected: string): string {
  return options
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`,
    )
    .join("\n");
}

export function describeEntityTemplate(template: EntityTemplate): string {
  const archetype = ARCHETYPE_MAP.get(template.archetype);
  if (!archetype) {
    return `${template.label}: unknown archetype ${template.archetype}`;
  }

  const individual = generateIndividual(template.seed, archetype);
  const mass = (individual.morphology.mass_kg * template.overlay.massMul) / 1000;
  const stature = individual.morphology.stature_m / 1000;
  const reachScale = Number(individual.morphology.reachScale) * template.overlay.reachMul;
  const peakForce = Number(individual.performance.peakForce_N) * template.overlay.peakForceMul;
  const control = Number(individual.control.stability) * template.overlay.controlMul;

  return [
    `${template.label}`,
    `Role: ${template.role}`,
    `Mass: ${mass.toFixed(1)} kg`,
    `Stature: ${stature.toFixed(2)} m`,
    `Reach scale: ${reachScale.toFixed(2)}`,
    `Peak force: ${peakForce.toFixed(0)}`,
    `Control stability: ${control.toFixed(0)}`,
  ].join("\n");
}

export function worldBlueprintToJson(world: WorldBlueprint): string {
  return JSON.stringify(world, null, 2);
}

export function entityTemplatesToJson(entities: EntityTemplate[]): string {
  return JSON.stringify(entities, null, 2);
}
