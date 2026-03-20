import { extractRigSnapshots } from "@its-not-rocket-science/ananke";

export interface PreviewPayload {
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

export interface PreviewRenderer {
  render(payload: PreviewPayload): void;
  destroy(): void;
}

export async function createPreviewRenderer(host: HTMLElement): Promise<PreviewRenderer> {
  host.innerHTML = `<div class="preview-loading">Loading 3D preview bridge…</div>`;

  try {
    const specifier = "ananke-threejs-bridge";
    const bridgeModule = await import(/* @vite-ignore */ specifier);
    if (typeof bridgeModule.createPreviewRenderer === "function") {
      return bridgeModule.createPreviewRenderer(host);
    }
  } catch {
    // Gracefully fall through to the local fallback renderer.
  }

  return createFallbackRenderer(host);
}

function createFallbackRenderer(host: HTMLElement): PreviewRenderer {
  host.innerHTML = `
    <div class="preview-fallback">
      <canvas width="480" height="280"></canvas>
      <div class="preview-caption">
        <strong>Fallback preview</strong>
        <span>The optional <code>ananke-threejs-bridge</code> package is unavailable, so this canvas uses extracted rig snapshots and world positions.</span>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) {
    return { render() {}, destroy() {} };
  }

  return {
    render(payload) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#0f172a";
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.strokeStyle = "#243041";
      context.lineWidth = 1;
      for (let x = 0; x <= canvas.width; x += 40) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
        context.stroke();
      }
      for (let y = 0; y <= canvas.height; y += 40) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();
      }

      const snapshots = payload.sourceWorld ? extractRigSnapshots(payload.sourceWorld as never) : [];
      const minX = Math.min(...payload.entities.map((entity) => entity.x), 0);
      const maxX = Math.max(...payload.entities.map((entity) => entity.x), 1);
      const minY = Math.min(...payload.entities.map((entity) => entity.y), 0);
      const maxY = Math.max(...payload.entities.map((entity) => entity.y), 1);
      const scaleX = maxX === minX ? 1 : (canvas.width - 60) / (maxX - minX);
      const scaleY = maxY === minY ? 1 : (canvas.height - 60) / (maxY - minY);

      payload.entities.forEach((entity, index) => {
        const px = 30 + (entity.x - minX) * scaleX;
        const py = 30 + (entity.y - minY) * scaleY;
        const hue = entity.teamId === 1 ? 265 : 175;
        context.fillStyle = entity.dead ? "#ef4444" : `hsl(${hue} 70% 60%)`;
        context.beginPath();
        context.arc(px, py, 10, 0, Math.PI * 2);
        context.fill();

        const rigInfo = snapshots[index];
        context.strokeStyle = "rgba(255,255,255,0.35)";
        context.beginPath();
        context.moveTo(px, py);
        context.lineTo(px, py - (rigInfo ? 22 : 16));
        context.stroke();

        context.fillStyle = "#e2e8f0";
        context.font = "12px system-ui";
        context.fillText(`#${entity.id}`, px - 8, py - 14);
      });

      context.fillStyle = "#cbd5e1";
      context.font = "12px system-ui";
      context.fillText(`Tick ${payload.tick}`, 16, 18);
      context.fillText(`Rig snapshots: ${snapshots.length}`, 16, canvas.height - 14);
    },
    destroy() {
      host.innerHTML = "";
    },
  };
}
