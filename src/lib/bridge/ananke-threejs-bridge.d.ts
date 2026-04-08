declare module 'ananke-threejs-bridge' {
  export interface BridgePreviewPayload {
    tick: number;
    entities: Array<{
      id: number;
      teamId: number;
      x: number;
      y: number;
      shock: number;
      consciousness: number;
      dead: boolean;
    }>;
    sourceWorld?: unknown;
  }

  export interface BridgePreviewRenderer {
    render(payload: BridgePreviewPayload): void;
    destroy(): void;
  }

  export function createPreviewRenderer(host: HTMLElement): BridgePreviewRenderer;
}
