import { createWorld } from "@its-not-rocket-science/ananke";

export interface ServerSessionSpec {
  seed: number;
  entities: Array<{
    id: number;
    teamId: number;
    seed: number;
    archetype: string;
    weaponId?: string;
    armourId?: string;
  }>;
}

export interface ServerSnapshot {
  tick: number;
  replayJson?: string;
  entities: Array<{
    id: number;
    teamId: number;
    x: number;
    y: number;
    shock: number;
    consciousness: number;
    dead: boolean;
  }>;
}

export interface WorldServerAdapter {
  connect(baseUrl: string): Promise<{ ok: boolean; mode: "remote" | "local-fallback"; message: string }>;
  createSession(spec: ServerSessionSpec): Promise<string>;
  sendCommands(sessionId: string, commands: Record<string, unknown>): Promise<void>;
  pollState(sessionId: string): Promise<ServerSnapshot>;
  close(sessionId: string): Promise<void>;
}

interface MemorySession {
  state: ReturnType<typeof createWorld>;
}

export class OptionalWorldServerAdapter implements WorldServerAdapter {
  private baseUrl = "";
  private remoteEnabled = false;
  private readonly memorySessions = new Map<string, MemorySession>();

  async connect(baseUrl: string): Promise<{ ok: boolean; mode: "remote" | "local-fallback"; message: string }> {
    this.baseUrl = baseUrl.replace(/\/$/, "");

    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (response.ok) {
        this.remoteEnabled = true;
        return { ok: true, mode: "remote", message: `Connected to ${this.baseUrl}` };
      }
    } catch {
      // Remote server is optional.
    }

    this.remoteEnabled = false;
    return {
      ok: true,
      mode: "local-fallback",
      message: "world-server unavailable; using in-browser fallback adapter",
    };
  }

  async createSession(spec: ServerSessionSpec): Promise<string> {
    if (this.remoteEnabled) {
      const response = await fetch(`${this.baseUrl}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(spec),
      });
      const data = (await response.json()) as { sessionId: string };
      return data.sessionId;
    }

    const sessionId = `local-${crypto.randomUUID()}`;
    this.memorySessions.set(sessionId, {
      state: createWorld(spec.seed, spec.entities.map((entity) => ({
        id: entity.id,
        teamId: entity.teamId,
        seed: entity.seed,
        archetype: entity.archetype,
        weaponId: entity.weaponId ?? "wpn_boxing_gloves",
        ...(entity.armourId ? { armourId: entity.armourId } : {}),
      }))),
    });
    return sessionId;
  }

  async sendCommands(sessionId: string, commands: Record<string, unknown>): Promise<void> {
    if (this.remoteEnabled) {
      await fetch(`${this.baseUrl}/sessions/${sessionId}/commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(commands),
      });
    }
  }

  async pollState(sessionId: string): Promise<ServerSnapshot> {
    if (this.remoteEnabled) {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/state`);
      return (await response.json()) as ServerSnapshot;
    }

    const session = this.memorySessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown local session: ${sessionId}`);
    }

    return {
      tick: session.state.tick,
      entities: session.state.entities.map((entity) => ({
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

  async close(sessionId: string): Promise<void> {
    if (this.remoteEnabled) {
      await fetch(`${this.baseUrl}/sessions/${sessionId}`, { method: "DELETE" });
      return;
    }

    this.memorySessions.delete(sessionId);
  }
}
