import { ReplayRecorder, createWorld, serializeReplay, stepWorld } from '@its-not-rocket-science/ananke';
import { KERNEL_CONTEXT, type AppState, type EntityTemplate } from '$lib/models';
import type { PreviewPayload } from '$lib/bridge/three-preview';

export const SPEED_OPTIONS = [0.5, 1, 5, 20] as const;

type WorldState = ReturnType<typeof createWorld>;

export interface CommandLike {
  kind: string;
  targetId?: number;
  dir?: { x: number; y: number; z: number };
  intensity?: number;
  mode?: string;
}

export interface SimulationSession {
  world: WorldState;
  recorder: ReplayRecorder;
  log: string[];
  selectedEntityId: number | null;
  pendingCommands: Map<number, readonly CommandLike[]>;
}

export function buildSession(state: AppState): SimulationSession {
  const selected = state.entities.filter((entity) => state.sim.selectedEntityIds.includes(entity.id));
  const entities = selected.map((entity, index) => toEntitySpec(entity, index + 1));
  const world = createWorld(state.world.seed, entities);
  const recorder = new ReplayRecorder(world);

  return {
    world,
    recorder,
    log: [`Built session for ${state.world.name} with ${entities.length} entities.`],
    selectedEntityId: world.entities[0]?.id ?? null,
    pendingCommands: new Map(),
  };
}

export function stepSimulation(session: SimulationSession, state: AppState): { replayJson: string; replayName: string } {
  const before = new Map(
    session.world.entities.map((entity) => [entity.id, { shock: entity.injury.shock, dead: entity.injury.dead }]),
  );
  const commands = new Map(session.pendingCommands.entries());

  session.recorder.record(session.world.tick, commands as never);
  stepWorld(session.world, commands as never, KERNEL_CONTEXT);
  session.pendingCommands.clear();

  const deltas = session.world.entities
    .map((entity) => {
      const previous = before.get(entity.id);
      const shockDelta = previous ? entity.injury.shock - previous.shock : 0;
      const status = entity.injury.dead ? 'dead' : entity.injury.consciousness < 2000 ? 'fading' : 'active';
      return `t${session.world.tick} • #${entity.id} ${status} @ (${entity.position_m.x},${entity.position_m.y}) Δshock=${shockDelta.toFixed(0)}`;
    })
    .join('\n');
  session.log.push(deltas);

  const winner = getWinner(session.world);
  if (winner) {
    session.log.push(`Winner: Team ${winner} at tick ${session.world.tick}.`);
  }

  return {
    replayJson: serializeReplay(session.recorder.toReplay()),
    replayName: `${state.world.name} @ tick ${session.world.tick}`,
  };
}

export function getWinner(world: WorldState): number | null {
  const livingTeams = new Set(
    world.entities
      .filter((entity) => !entity.injury.dead && entity.injury.consciousness >= 2000)
      .map((entity) => entity.teamId),
  );

  return livingTeams.size === 1 ? [...livingTeams][0] ?? null : null;
}

export function makePreviewPayload(world: WorldState): PreviewPayload {
  return {
    tick: world.tick,
    sourceWorld: world,
    entities: world.entities.map((entity) => ({
      id: entity.id,
      teamId: entity.teamId,
      x: entity.position_m.x,
      y: entity.position_m.y,
      shock: entity.injury.shock,
      consciousness: entity.injury.consciousness,
      dead: entity.injury.dead,
    })),
  };
}

export function countQueuedCommands(commands: Map<number, readonly CommandLike[]>): number {
  return [...commands.values()].reduce((sum, list) => sum + list.length, 0);
}

export function toEntitySpec(entity: EntityTemplate, id: number) {
  return {
    id,
    teamId: entity.teamId,
    seed: entity.seed,
    archetype: entity.archetype,
    weaponId: entity.weaponId ?? 'wpn_boxing_gloves',
    ...(entity.armourId ? { armourId: entity.armourId } : {}),
  };
}
