import { q } from '@its-not-rocket-science/ananke';

export interface WorldBlueprint {
  name: string;
  seed: number;
}

export interface EntityTemplate {
  id: string;
  label: string;
  archetype: string;
  seed: number;
  teamId: number;
  weaponId?: string;
  armourId?: string;
  role: string;
  bodyPlan: 'humanoid' | 'quadruped' | 'custom';
  overlay: {
    massMul: number;
    peakForceMul: number;
    controlMul: number;
    reachMul: number;
  };
}

export interface SimulationPreset {
  selectedEntityIds: string[];
  maxTicks: number;
  speed: number;
}

export interface DashboardConfig {
  trials: number;
  maxTicks: number;
  teamA: string[];
  teamB: string[];
}

export interface AppState {
  world: WorldBlueprint;
  entities: EntityTemplate[];
  sim: SimulationPreset;
  latestReplayJson: string;
  latestReplayName: string;
  dashboard: DashboardConfig;
}

export const KERNEL_CONTEXT = {
  tractionCoeff: q(0.85),
};

export function createDefaultState(): AppState {
  return {
    world: {
      name: 'Frontier archipelago',
      seed: 42,
    },
    entities: [
      {
        id: 'captain-1',
        label: 'Alden Captain',
        archetype: 'KNIGHT_INFANTRY',
        seed: 11,
        teamId: 1,
        weaponId: 'wpn_longsword',
        armourId: 'arm_plate',
        role: 'Frontline captain',
        bodyPlan: 'humanoid',
        overlay: {
          massMul: 1,
          peakForceMul: 1,
          controlMul: 1,
          reachMul: 1,
        },
      },
      {
        id: 'raider-1',
        label: 'Vareth Raider',
        archetype: 'PRO_BOXER',
        seed: 17,
        teamId: 2,
        weaponId: 'wpn_boxing_gloves',
        role: 'Shock skirmisher',
        bodyPlan: 'humanoid',
        overlay: {
          massMul: 0.96,
          peakForceMul: 1.12,
          controlMul: 1.04,
          reachMul: 0.94,
        },
      },
      {
        id: 'scout-1',
        label: 'Border Scout',
        archetype: 'HUMAN_BASE',
        seed: 23,
        teamId: 1,
        weaponId: 'wpn_spear',
        armourId: 'arm_leather',
        role: 'Recon and screening',
        bodyPlan: 'humanoid',
        overlay: {
          massMul: 0.9,
          peakForceMul: 0.95,
          controlMul: 1.08,
          reachMul: 1.03,
        },
      },
    ],
    sim: {
      selectedEntityIds: ['captain-1', 'raider-1'],
      maxTicks: 600,
      speed: 1,
    },
    latestReplayJson: '',
    latestReplayName: '',
    dashboard: {
      trials: 24,
      maxTicks: 500,
      teamA: ['captain-1'],
      teamB: ['raider-1'],
    },
  };
}
