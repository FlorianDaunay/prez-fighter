/** Cached portrait canvases (busts) for the HUD and the menus. */
import { LOOKS } from "./looks";
import { drawBust, type Expr } from "./person";

const cache = new Map<string, HTMLCanvasElement>();

export function portrait(lookId: string, size = 128, facing: 1 | -1 = 1, expr: Expr = "neutral", bg?: string): HTMLCanvasElement {
  const key = `${lookId}|${size}|${facing}|${expr}|${bg ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
  }
  const look = LOOKS[lookId];
  const scale = (size / 128) * 1.75 / Math.max(0.9, look.height);
  drawBust(ctx, look, size / 2 - 4 * facing, size * 0.47, scale, facing, expr);
  if (look.tint) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = look.tint;
    ctx.fillRect(0, 0, size, size);
  }
  cache.set(key, c);
  return c;
}

const urls = new Map<string, string>();
export function portraitUrl(lookId: string, size = 128, facing: 1 | -1 = 1, expr: Expr = "neutral"): string {
  const key = `${lookId}|${size}|${facing}|${expr}`;
  let u = urls.get(key);
  if (!u) {
    u = portrait(lookId, size, facing, expr).toDataURL();
    urls.set(key, u);
  }
  return u;
}
