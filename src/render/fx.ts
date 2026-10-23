/** Sprites for projectiles, walls, special supports and move effects; plus the particle system. */
import type { Projectile, Wall } from "@/core/types";

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------- emoji cache

const emojiCache = new Map<string, HTMLCanvasElement>();
export function emoji(e: string, size: number): HTMLCanvasElement {
  const key = e + "|" + Math.round(size);
  let c = emojiCache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    const s = Math.ceil(size * 1.4);
    c.width = s;
    c.height = s;
    const x = c.getContext("2d")!;
    x.font = `${size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(e, s / 2, s / 2 + size * 0.05);
    emojiCache.set(key, c);
  }
  return c;
}

export function drawEmoji(c: Ctx, e: string, x: number, y: number, size: number, flip = false, rot = 0) {
  const img = emoji(e, size);
  c.save();
  c.translate(x, y);
  if (rot) c.rotate(rot);
  if (flip) c.scale(-1, 1);
  c.drawImage(img, -img.width / 2, -img.height / 2);
  c.restore();
}

function bubbleText(c: Ctx, s: string, x: number, y: number, w: number, h: number, color: string) {
  c.save();
  c.translate(x, y);
  c.fillStyle = "#fff";
  c.strokeStyle = "#111";
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(-w / 2, -h / 2, w, h, 8);
  c.fill();
  c.stroke();
  c.fillStyle = color;
  c.font = `${Math.min(h * 0.62, (w / Math.max(4, s.length)) * 1.7)}px Bungee, Impact, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(s, 0, 2);
  c.restore();
}

// ---------------------------------------------------------------- projectiles

/** `sx, sy`: screen position of the projectile centre. */
export function drawProjectile(c: Ctx, p: Projectile, sx: number, sy: number, t: number) {
  const d = p.def;
  const dir = p.vx < 0 ? -1 : p.vx > 0 ? 1 : p.owner === 0 ? 1 : -1;
  const s = d.sprite;
  if (s.startsWith("#text:")) {
    bubbleText(c, s.slice(6), sx, sy, d.w, d.h, d.color ?? "#c8102e");
    return;
  }
  if (!s.startsWith("#")) {
    const spin = s === "🍎" || s === "🪙" || s === "🏓" || s === "⌚" || s === "🧰" ? p.age * 0.25 * dir : 0;
    drawEmoji(c, s, sx, sy, d.size ?? Math.max(d.w, d.h) * 0.95, dir < 0 && s !== "🚀", spin);
    if (s === "🚀") {
      c.fillStyle = `rgba(255,${150 + Math.random() * 80},40,0.8)`;
      c.beginPath();
      c.ellipse(sx, sy - d.h * 0.55, 10, 18 + Math.random() * 10, 0, 0, Math.PI * 2);
      c.fill();
    }
    return;
  }
  c.save();
  c.translate(sx, sy);
  switch (s) {
    case "#flame": {
      const cols = ["#1d3fa0", "#ffffff", "#d7262e"];
      for (let i = 0; i < 3; i++) {
        const f = Math.sin(t * 0.5 + i) * 4;
        c.fillStyle = cols[i];
        c.beginPath();
        c.ellipse(-dir * (14 - i * 10), 0, 22 - i * 4, 14 + f, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = "#ffd94a";
      c.beginPath();
      c.ellipse(dir * 16, -2, 8, 6, 0, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case "#wave": {
      const g = c.createLinearGradient(0, -d.h / 2, 0, d.h / 2);
      g.addColorStop(0, "#9fd0ff");
      g.addColorStop(1, d.color ?? "#1e3a8a");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-dir * d.w / 2, d.h / 2);
      c.quadraticCurveTo(-dir * d.w * 0.4, -d.h * 0.6, dir * d.w * 0.25, -d.h / 2);
      c.quadraticCurveTo(dir * d.w * 0.6, -d.h * 0.4, dir * d.w * 0.3, -d.h * 0.15);
      c.quadraticCurveTo(dir * d.w * 0.1, -d.h * 0.25, dir * d.w * 0.15, 0);
      c.lineTo(dir * d.w / 2, d.h / 2);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.8)";
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.arc(dir * (d.w * 0.25 + Math.sin(t * 0.3 + i) * 10), -d.h / 2 + i * 6, 6, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case "#holowave":
    case "#radio": {
      const col = s === "#radio" ? "rgba(240,240,200," : "rgba(80,210,255,";
      c.lineWidth = 5;
      c.save();
      c.scale(dir, 1);
      for (let i = 0; i < 4; i++) {
        c.strokeStyle = col + (0.9 - i * 0.2) + ")";
        c.beginPath();
        c.arc(-30, 0, 18 + i * 12 + (t % 10), -0.9, 0.9);
        c.stroke();
      }
      c.restore();
      if (s === "#radio") {
        c.fillStyle = "#fff";
        c.font = "12px Bungee, Impact";
        c.textAlign = "center";
        c.fillText("18 JUIN", 0, d.h / 2 + 4);
      }
      break;
    }
    case "#jet":
      c.fillStyle = "rgba(160,220,255,0.9)";
      c.beginPath();
      c.ellipse(0, 0, d.w / 2, d.h / 3, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#fff";
      c.beginPath();
      c.ellipse(dir * 6, -3, 6, 3, 0, 0, Math.PI * 2);
      c.fill();
      break;
    case "#flash": {
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + t * 0.1;
        const r = i % 2 ? 14 : 34;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.fill();
      c.restore();
      drawEmoji(c, "📸", sx, sy, 30);
      return;
    }
    case "#picket": {
      const rise = Math.min(1, p.age / 6);
      c.translate(0, d.h / 2 - d.h * rise);
      for (let i = -1; i <= 1; i++) {
        c.fillStyle = "#7a5230";
        c.fillRect(i * 24 - 2, -10, 5, d.h * 0.7);
        c.fillStyle = "#fff";
        c.fillRect(i * 24 - 18, -50, 36, 40);
        c.fillStyle = "#c8102e";
        c.font = "10px Bungee, Impact";
        c.textAlign = "center";
        c.fillText("GRÈVE", i * 24, -26);
      }
      break;
    }
    case "#rain": {
      c.fillStyle = "#6d7682";
      for (const [x, y, r] of [[-30, -d.h / 2 + 10, 26], [0, -d.h / 2, 32], [32, -d.h / 2 + 10, 24]]) {
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = "rgba(170,200,255,0.9)";
      c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i < 14; i++) {
        const x = -50 + i * 8;
        const y = -d.h / 2 + 30 + ((t * 9 + i * 37) % (d.h - 30));
        c.moveTo(x, y);
        c.lineTo(x - 3, y + 12);
      }
      c.stroke();
      break;
    }
    case "#curve": {
      c.strokeStyle = "#222";
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(-d.w / 2, -d.h / 2);
      c.lineTo(-d.w / 2, d.h / 2);
      c.lineTo(d.w / 2, d.h / 2);
      c.stroke();
      c.strokeStyle = "#1fb34a";
      c.lineWidth = 10;
      c.beginPath();
      c.moveTo(-d.w / 2 + 10, -d.h / 2 + 20);
      c.quadraticCurveTo(0, d.h / 2 + 30, d.w / 2 - 20, -d.h / 2 + 10);
      c.stroke();
      c.fillStyle = "#1fb34a";
      c.beginPath();
      c.moveTo(d.w / 2 - 4, -d.h / 2 - 6);
      c.lineTo(d.w / 2 - 36, -d.h / 2 + 4);
      c.lineTo(d.w / 2 - 14, -d.h / 2 + 30);
      c.fill();
      break;
    }
    case "#crack": {
      c.strokeStyle = "#2a1a10";
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(-dir * 60, 0);
      for (let i = 0; i < 6; i++) c.lineTo(-dir * 60 + dir * i * 22, (i % 2 ? -1 : 1) * 8);
      c.stroke();
      c.fillStyle = "rgba(160,130,90,0.7)";
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.arc(dir * (10 + i * 8), -8 - ((t + i * 5) % 20), 5, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case "#gas": {
      c.globalAlpha = 0.75;
      for (let i = 0; i < 6; i++) {
        c.fillStyle = i % 2 ? "#b8d86a" : "#8fbf4a";
        c.beginPath();
        c.arc(Math.sin(t * 0.07 + i * 2) * 22, Math.cos(t * 0.05 + i) * 18, 26, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      c.fillStyle = "#333";
      c.font = "12px Bungee, Impact";
      c.textAlign = "center";
      c.fillText("GAZ", 0, 4);
      break;
    }
    case "#blizzard": {
      c.fillStyle = "rgba(220,240,255,0.35)";
      c.beginPath();
      c.ellipse(0, 0, d.w / 2, d.h / 2, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#fff";
      for (let i = 0; i < 40; i++) {
        const a = i * 2.4 + t * 0.15;
        const r = (i * 7) % (d.w / 2);
        c.fillRect(Math.cos(a) * r, Math.sin(a) * r * (d.h / d.w), 4, 4);
      }
      break;
    }
    case "#beam": {
      const cols = ["#1d3fa0", "#ffffff", "#d7262e"];
      const h = d.h / 3;
      c.shadowColor = "#fff";
      c.shadowBlur = 20;
      cols.forEach((col, i) => {
        c.fillStyle = col;
        c.fillRect(-d.w / 2, -d.h / 2 + i * h + Math.sin(t * 0.6 + i) * 2, d.w, h);
      });
      c.shadowBlur = 0;
      break;
    }
    case "#scan": {
      c.fillStyle = "rgba(255,30,30,0.18)";
      c.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
      c.strokeStyle = "rgba(255,60,60,0.9)";
      c.lineWidth = 3;
      for (let y = -d.h / 2; y < d.h / 2; y += 14) {
        c.beginPath();
        c.moveTo(-d.w / 2, y + (t % 14));
        c.lineTo(d.w / 2, y + (t % 14));
        c.stroke();
      }
      c.fillStyle = "#fff";
      c.font = "16px Bungee, Impact";
      c.textAlign = "center";
      c.fillText("-50", 0, -d.h / 2 - 6);
      break;
    }
    case "#stamp": {
      c.fillStyle = "#6b3e1e";
      c.fillRect(-20, -d.h / 2 - 60, 40, 70);
      c.fillStyle = "#3a2210";
      c.fillRect(-d.w / 2, -d.h / 2, d.w, d.h * 0.45);
      c.fillStyle = "#c8102e";
      c.fillRect(-d.w / 2, d.h * -0.05, d.w, d.h * 0.55);
      c.fillStyle = "#fff";
      c.font = `${d.h * 0.42}px Bungee, Impact`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("49.3", 0, d.h * 0.24);
      break;
    }
    default:
      c.fillStyle = d.color ?? "#ff0";
      c.beginPath();
      c.arc(0, 0, d.w / 2, 0, Math.PI * 2);
      c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------- walls

export function drawWall(c: Ctx, w: Wall, sx: number, groundY: number) {
  const rise = Math.min(1, (w.age + 1) / 10);
  const h = w.def.h * rise;
  const x = sx - w.def.w / 2;
  const y = groundY - h;
  const fade = w.age > w.def.life - 30 ? (w.def.life - w.age) / 30 : 1;
  c.save();
  c.globalAlpha = Math.max(0, fade);
  switch (w.def.sprite) {
    case "#wall-border":
      c.fillStyle = "#1d3fa0";
      c.fillRect(x, y, 8, h);
      c.fillRect(x + w.def.w - 8, y, 8, h);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i % 2 ? "#ffffff" : "#d7262e";
        c.fillRect(x, y + 14 + i * 26, w.def.w, 14);
      }
      c.fillStyle = "#fff";
      c.font = "11px Bungee, Impact";
      c.textAlign = "center";
      c.fillText("STOP", sx, y + 10);
      break;
    case "#wall-brick":
      c.fillStyle = "#a8432a";
      c.fillRect(x, y, w.def.w, h);
      c.strokeStyle = "#e8d6b0";
      c.lineWidth = 2;
      for (let yy = 0; yy < h; yy += 14) {
        c.beginPath();
        c.moveTo(x, y + yy);
        c.lineTo(x + w.def.w, y + yy);
        c.stroke();
        const off = (yy / 14) % 2 ? 0 : 12;
        for (let xx = off; xx < w.def.w; xx += 24) {
          c.beginPath();
          c.moveTo(x + xx, y + yy);
          c.lineTo(x + xx, y + yy + 14);
          c.stroke();
        }
      }
      break;
    case "#wall-china":
      c.fillStyle = "#b8a07a";
      c.fillRect(x, y + 14, w.def.w, h - 14);
      for (let i = 0; i < 3; i++) c.fillRect(x + i * (w.def.w / 3) + 2, y, w.def.w / 3 - 6, 16);
      c.strokeStyle = "#8a7454";
      c.lineWidth = 2;
      c.strokeRect(x, y + 14, w.def.w, h - 14);
      break;
    case "#wall-paper":
      for (let i = 0; i < Math.floor(h / 6); i++) {
        c.fillStyle = i % 2 ? "#f4f4ef" : "#e4e4dc";
        c.fillRect(x + Math.sin(i * 1.7) * 4, groundY - (i + 1) * 6, w.def.w, 6);
      }
      c.fillStyle = "#1f4fa8";
      c.fillRect(x - 4, y - 8, w.def.w + 8, 14);
      c.fillStyle = "#ffd400";
      c.font = "10px Bungee, Impact";
      c.textAlign = "center";
      c.fillText("DIRECTIVE", sx, y + 3);
      break;
    case "#wall-gantry":
      c.fillStyle = "#8a9099";
      c.fillRect(x, y, 8, h);
      c.fillRect(x + w.def.w - 8, y, 8, h);
      c.fillRect(x - 10, y, w.def.w + 20, 12);
      c.fillStyle = "#1f6f3a";
      c.fillRect(x - 6, y + 14, w.def.w + 12, 20);
      c.fillStyle = "#fff";
      c.font = "9px Bungee, Impact";
      c.textAlign = "center";
      c.fillText("ÉCOTAXE", sx, y + 28);
      break;
  }
  c.restore();
}

// ---------------------------------------------------------------- special supports

export function drawScooter(c: Ctx, x: number, groundY: number, facing: number, t: number) {
  c.save();
  c.translate(x, groundY);
  c.scale(facing, 1);
  for (const wx of [-36, 36]) {
    c.fillStyle = "#111";
    c.beginPath();
    c.arc(wx, -16, 16, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#888";
    c.beginPath();
    c.arc(wx, -16, 6, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "#e8e8e8";
  c.strokeStyle = "#111";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-50, -30);
  c.lineTo(30, -30);
  c.lineTo(44, -70);
  c.lineTo(54, -70);
  c.lineTo(46, -24);
  c.lineTo(-50, -20);
  c.closePath();
  c.fill();
  c.stroke();
  // Rider
  c.fillStyle = "#22232b";
  c.beginPath();
  c.ellipse(-12, -62, 18, 26, 0.2, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.strokeStyle = "#22232b";
  c.lineWidth = 9;
  c.beginPath();
  c.moveTo(-6, -70);
  c.lineTo(44, -68);
  c.stroke();
  // Full-face helmet
  c.fillStyle = "#1a1a1a";
  c.beginPath();
  c.arc(-6, -104, 20, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#4a6a8a";
  c.beginPath();
  c.ellipse(4, -102, 11, 8, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // Speed lines
  c.strokeStyle = "rgba(255,255,255,0.7)";
  c.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(x - facing * (70 + i * 10 + (t % 8)), groundY - 30 - i * 14);
    c.lineTo(x - facing * (110 + i * 14), groundY - 30 - i * 14);
    c.stroke();
  }
}

export function drawPanda(c: Ctx, x: number, groundY: number, t: number, facing: number) {
  const r = 26;
  c.save();
  c.translate(x, groundY - r);
  c.rotate((t * 0.25 * facing) % (Math.PI * 2));
  c.fillStyle = "#fafafa";
  c.strokeStyle = "#111";
  c.lineWidth = 3;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = "#111";
  for (const [ex, ey, er] of [[-17, -19, 8], [17, -19, 8], [-8, -4, 5], [8, -4, 5], [0, 8, 4], [-22, 10, 7], [22, 10, 7]] as number[][]) {
    c.beginPath();
    c.arc(ex, ey, er, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "#fff";
  c.beginPath();
  c.arc(-7, -5, 1.6, 0, Math.PI * 2);
  c.arc(9, -5, 1.6, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Trolls carry laptops; drawn on top of the person rig. */
export function drawLaptop(c: Ctx, x: number, y: number, facing: number) {
  c.save();
  c.translate(x, y);
  c.scale(facing, 1);
  c.fillStyle = "#cfd3da";
  c.fillRect(-4, -26, 30, 20);
  c.fillStyle = "#4ab0ff";
  c.fillRect(-1, -23, 24, 14);
  c.fillStyle = "#9aa0aa";
  c.fillRect(-8, -6, 38, 5);
  c.restore();
}

// ---------------------------------------------------------------- particles

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: "spark" | "ring" | "dust" | "text" | "emoji" | "star" | "flash";
  color: string;
  size: number;
  text?: string;
  rot?: number;
}

export class Particles {
  list: Particle[] = [];

  add(p: Partial<Particle> & Pick<Particle, "x" | "y" | "kind">) {
    if (this.list.length > 400) this.list.shift();
    this.list.push({ vx: 0, vy: 0, life: 20, max: p.life ?? 20, color: "#fff", size: 10, ...p });
  }

  burst(x: number, y: number, color: string, n: number, speed: number, size = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, kind: "spark", color, size, life: 14 + Math.random() * 10 });
    }
  }

  update() {
    for (const p of this.list) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.kind === "dust" || p.kind === "emoji" || p.kind === "star") p.vy += 0.15;
      if (p.kind === "text") p.vy *= 0.92;
      p.vx *= 0.94;
      p.life--;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  /** Positions are world coordinates (x, height); converted with the camera. */
  draw(c: Ctx, cam: number, groundY: number) {
    for (const p of this.list) {
      const k = p.life / p.max;
      const sx = p.x - cam;
      const sy = groundY - p.y;
      c.globalAlpha = Math.min(1, k * 1.5);
      switch (p.kind) {
        case "spark":
          c.strokeStyle = p.color;
          c.lineWidth = p.size;
          c.beginPath();
          c.moveTo(sx, sy);
          c.lineTo(sx - p.vx * 2.5, sy + p.vy * 2.5);
          c.stroke();
          break;
        case "ring":
          c.strokeStyle = p.color;
          c.lineWidth = 4 * k + 1;
          c.beginPath();
          c.arc(sx, sy, p.size * (1.6 - k), 0, Math.PI * 2);
          c.stroke();
          break;
        case "flash": {
          c.fillStyle = p.color;
          c.beginPath();
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 + (p.rot ?? 0);
            const r = (i % 2 ? 0.35 : 1) * p.size * (1.2 - k * 0.4);
            c.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
          }
          c.fill();
          break;
        }
        case "dust":
          c.fillStyle = p.color;
          c.beginPath();
          c.arc(sx, sy, p.size * (1.5 - k * 0.5), 0, Math.PI * 2);
          c.fill();
          break;
        case "text":
          c.font = `${p.size}px Bungee, Impact, sans-serif`;
          c.textAlign = "center";
          c.lineWidth = 5;
          c.strokeStyle = "#111";
          c.strokeText(p.text ?? "", sx, sy);
          c.fillStyle = p.color;
          c.fillText(p.text ?? "", sx, sy);
          break;
        case "emoji":
        case "star":
          drawEmoji(c, p.text ?? "⭐", sx, sy, p.size, false, (p.rot ?? 0) + (1 - k) * 3);
          break;
      }
    }
    c.globalAlpha = 1;
  }
}

/** Emoji emitted around a fighter while a move with this fx key runs. */
export const FX_EMOJI: Record<string, string> = {
  sparkle: "✨",
  maple: "🍁",
  dragon: "🐉",
  hearts: "💗",
  percent: "💲",
  scissors: "✂️",
  stars: "⭐",
  cheese: "🧀",
  golf: "⛳",
  bear: "🐻",
  heels: "👠",
  polls: "📈",
  smile: "😁",
  dust: "💨",
  flurry: "👊",
  jelly: "🍮",
  diamond: "💠",
  flex: "💪",
  silk: "🎀",
  speed: "💨",
  both: "↔️",
  lightning: "⚡",
  podium: "🎤",
  quake: "💥",
  shout: "📢",
  explosion: "💥",
};
