/**
 * Procedural backgrounds. Static layers are drawn once into offscreen canvases (two parallax
 * planes); `anim` adds cheap moving details every frame (flags, rain, snow, crowds).
 */
import { GROUND_Y, SCREEN_H, SCREEN_W, STAGE_W } from "@/core/constants";
import { drawSprite } from "./sprites";

type Ctx = CanvasRenderingContext2D;

export interface StageArt {
  sky: [string, string];
  far: (c: Ctx, w: number) => void;
  near: (c: Ctx, w: number) => void;
  floor: [string, string];
  anim?: (c: Ctx, t: number, cam: number) => void;
  front?: (c: Ctx, t: number, cam: number) => void;
}

// ---------------------------------------------------------------- helpers

let seed = 1;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function windows(c: Ctx, x: number, y: number, cols: number, rows: number, w: number, h: number, gx: number, gy: number, color: string, lit = 0) {
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      c.fillStyle = lit && rnd() < lit ? "#ffd977" : color;
      c.fillRect(x + i * (w + gx), y + j * (h + gy), w, h);
    }
}

function flag(c: Ctx, x: number, y: number, w: number, h: number, colors: string[], t = 0, vertical = true) {
  const n = colors.length;
  for (let i = 0; i < n; i++) {
    c.fillStyle = colors[i];
    c.beginPath();
    for (let k = 0; k <= 8; k++) {
      const fx = vertical ? x + (w / n) * i + ((w / n) * k) / 8 : x + (w * k) / 8;
      const wave = Math.sin(t * 0.08 + fx * 0.05) * 3 * ((fx - x) / w);
      const fy = vertical ? y + wave : y + (h / n) * i + wave;
      if (k === 0) c.moveTo(fx, fy);
      else c.lineTo(fx, fy);
    }
    for (let k = 8; k >= 0; k--) {
      const fx = vertical ? x + (w / n) * i + ((w / n) * k) / 8 : x + (w * k) / 8;
      const wave = Math.sin(t * 0.08 + fx * 0.05) * 3 * ((fx - x) / w);
      const fy = vertical ? y + h + wave : y + (h / n) * (i + 1) + wave;
      c.lineTo(fx, fy);
    }
    c.fill();
  }
}

const TRICOLOR = ["#1d3fa0", "#f4f4f4", "#d7262e"];

function pole(c: Ctx, x: number, top: number, bottom: number) {
  rect(c, x - 2, top, 4, bottom - top, "#555");
}

function crowd(c: Ctx, x0: number, x1: number, y: number, t: number, palette: string[], density = 18, scale = 1) {
  seed = 99;
  for (let x = x0; x < x1; x += density * scale) {
    const col = palette[Math.floor(rnd() * palette.length)];
    const bob = Math.sin(t * 0.12 + x * 0.3) * 2.5 * scale;
    const h = (24 + rnd() * 10) * scale;
    c.fillStyle = col;
    c.beginPath();
    c.ellipse(x, y - h + bob, 7 * scale, 8 * scale, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(x - 9 * scale, y - h + 6 * scale + bob, 18 * scale, h);
    if (rnd() < 0.25) {
      c.fillRect(x + 6 * scale, y - h - 14 * scale + bob - Math.abs(Math.sin(t * 0.1 + x)) * 6, 4 * scale, 18 * scale);
    }
  }
}

function tree(c: Ctx, x: number, y: number, s: number, leaf: string) {
  rect(c, x - 4 * s, y - 50 * s, 8 * s, 50 * s, "#5a4030");
  c.fillStyle = leaf;
  for (const [dx, dy, r] of [[0, -70, 30], [-22, -58, 22], [22, -58, 22], [0, -90, 22]]) {
    c.beginPath();
    c.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    c.fill();
  }
}

function sun(c: Ctx, x: number, y: number, r: number, color: string) {
  const g = c.createRadialGradient(x, y, r * 0.2, x, y, r * 2.5);
  g.addColorStop(0, color);
  g.addColorStop(0.4, color + "88");
  g.addColorStop(1, color + "00");
  c.fillStyle = g;
  c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
}

function text(c: Ctx, s: string, x: number, y: number, size: number, color: string, font = "Bungee, Impact, sans-serif") {
  c.font = `${size}px ${font}`;
  c.fillStyle = color;
  c.textAlign = "center";
  c.fillText(s, x, y);
}

function rain(c: Ctx, t: number, cam: number, color = "rgba(200,220,255,0.45)", n = 120) {
  c.strokeStyle = color;
  c.lineWidth = 1.5;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const x = ((i * 97 + t * 3 - cam * 0.2) % (SCREEN_W + 40) + SCREEN_W + 40) % (SCREEN_W + 40) - 20;
    const y = (i * 53 + t * 14) % SCREEN_H;
    c.moveTo(x, y);
    c.lineTo(x - 4, y + 14);
  }
  c.stroke();
}

function snow(c: Ctx, t: number, cam: number, n = 90) {
  c.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < n; i++) {
    const x = ((i * 113 + Math.sin(t * 0.02 + i) * 30 - cam * 0.3) % SCREEN_W + SCREEN_W) % SCREEN_W;
    const y = (i * 61 + t * (0.8 + (i % 5) * 0.25)) % SCREEN_H;
    c.beginPath();
    c.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2);
    c.fill();
  }
}

function cow(c: Ctx, x: number, y: number, s: number) {
  c.fillStyle = "#f4f4f4";
  c.beginPath();
  c.ellipse(x, y - 32 * s, 38 * s, 22 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#222";
  c.beginPath();
  c.ellipse(x - 10 * s, y - 38 * s, 10 * s, 8 * s, 0.4, 0, Math.PI * 2);
  c.ellipse(x + 18 * s, y - 28 * s, 8 * s, 6 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#f4f4f4";
  for (const lx of [-25, -12, 14, 26]) c.fillRect(x + lx * s, y - 14 * s, 6 * s, 14 * s);
  c.beginPath();
  c.ellipse(x + 42 * s, y - 42 * s, 13 * s, 11 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#f2a3a3";
  c.beginPath();
  c.ellipse(x + 50 * s, y - 38 * s, 7 * s, 6 * s, 0, 0, Math.PI * 2);
  c.fill();
}

function onion(c: Ctx, x: number, base: number, w: number, h: number, colors: string[]) {
  rect(c, x - w * 0.35, base - h * 0.5, w * 0.7, h * 0.5, "#c9a26b");
  c.fillStyle = colors[0];
  c.beginPath();
  c.moveTo(x - w / 2, base - h * 0.5);
  c.bezierCurveTo(x - w * 0.7, base - h * 0.9, x - w * 0.05, base - h * 1.05, x, base - h * 1.3);
  c.bezierCurveTo(x + w * 0.05, base - h * 1.05, x + w * 0.7, base - h * 0.9, x + w / 2, base - h * 0.5);
  c.fill();
  c.strokeStyle = colors[1];
  c.lineWidth = 4;
  for (let i = -1; i <= 1; i++) {
    c.beginPath();
    c.moveTo(x + i * w * 0.25, base - h * 0.52);
    c.quadraticCurveTo(x + i * w * 0.2, base - h * 0.9, x, base - h * 1.28);
    c.stroke();
  }
}

function mountains(c: Ctx, w: number, base: number, color: string, peaks: number, height: number, snowCap?: string) {
  seed = peaks * 7 + Math.round(height);
  const pts: [number, number][] = [[0, base]];
  for (let i = 0; i <= peaks * 2; i++) {
    const x = (w / (peaks * 2)) * i;
    const y = i % 2 ? base - height * (0.6 + rnd() * 0.4) : base - height * (0.15 + rnd() * 0.25);
    pts.push([x, y]);
  }
  pts.push([w, base]);
  c.fillStyle = color;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.fill();
  if (!snowCap) return;
  c.fillStyle = snowCap;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    if (y > base - height * 0.55) continue;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - 26, y + 30);
    c.lineTo(x - 8, y + 24);
    c.lineTo(x + 4, y + 34);
    c.lineTo(x + 24, y + 28);
    c.closePath();
    c.fill();
  }
}

function palmTree(c: Ctx, x: number, y: number, s: number) {
  c.strokeStyle = "#7a5a3a";
  c.lineWidth = 10 * s;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + 20 * s, y - 120 * s, x + 6 * s, y - 220 * s);
  c.stroke();
  c.fillStyle = "#2e7d32";
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55;
    c.beginPath();
    c.moveTo(x + 6 * s, y - 220 * s);
    c.quadraticCurveTo(x + 6 * s + Math.cos(a) * 60 * s, y - 230 * s + Math.sin(a) * 40 * s - 10 * s, x + 6 * s + Math.cos(a) * 100 * s, y - 210 * s + Math.sin(a) * 30 * s + 30 * s);
    c.quadraticCurveTo(x + 6 * s + Math.cos(a) * 50 * s, y - 220 * s + Math.sin(a) * 20 * s, x + 6 * s, y - 216 * s);
    c.fill();
  }
}

function container(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  rect(c, x, y, w, h, color);
  c.fillStyle = "rgba(0,0,0,0.22)";
  for (let i = x + 6; i < x + w - 4; i += 9) c.fillRect(i, y + 4, 3, h - 8);
  c.strokeStyle = "rgba(0,0,0,0.5)";
  c.lineWidth = 2;
  c.strokeRect(x, y, w, h);
}

/** Stage-wide bunting: a rope of little triangular flags. */
function bunting(c: Ctx, x0: number, x1: number, y: number, sag: number, colors: string[]) {
  c.strokeStyle = "#333";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x0, y);
  c.quadraticCurveTo((x0 + x1) / 2, y + sag * 2, x1, y);
  c.stroke();
  const n = Math.floor((x1 - x0) / 34);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const fx = x0 + (x1 - x0) * t;
    const fy = y + sag * 4 * t * (1 - t);
    c.fillStyle = colors[i % colors.length];
    c.beginPath();
    c.moveTo(fx - 10, fy);
    c.lineTo(fx + 10, fy);
    c.lineTo(fx, fy + 18);
    c.fill();
  }
}

// ---------------------------------------------------------------- stages

const H = GROUND_Y;

export const STAGE_ART: Record<string, StageArt> = {
  elysee: {
    sky: ["#7fb6ea", "#d6ecff"],
    far(c, w) {
      seed = 3;
      for (let x = 0; x < w; x += 70) rect(c, x, H - 190 - rnd() * 60, 66, 300, "#b8c2cf");
      // Eiffel tower silhouette
      c.fillStyle = "#8a96a6";
      c.beginPath();
      c.moveTo(w * 0.78 - 60, H - 120);
      c.quadraticCurveTo(w * 0.78 - 10, H - 260, w * 0.78 - 3, H - 400);
      c.lineTo(w * 0.78 + 3, H - 400);
      c.quadraticCurveTo(w * 0.78 + 10, H - 260, w * 0.78 + 60, H - 120);
      c.fill();
    },
    near(c, w) {
      const top = H - 300;
      rect(c, 80, top, w - 160, 300, "#e9dfc9");
      rect(c, 80, top - 20, w - 160, 24, "#d8cbb0");
      windows(c, 120, top + 50, Math.floor((w - 240) / 70), 2, 34, 70, 36, 50, "#5d6f86");
      const cx = w / 2;
      rect(c, cx - 140, top - 70, 280, 370, "#efe6d2");
      c.fillStyle = "#d8cbb0";
      c.beginPath();
      c.moveTo(cx - 150, top - 70);
      c.lineTo(cx, top - 130);
      c.lineTo(cx + 150, top - 70);
      c.fill();
      for (let i = 0; i < 6; i++) rect(c, cx - 120 + i * 46, top - 40, 16, 340, "#fbf6ea");
      rect(c, cx - 50, H - 130, 100, 130, "#3a3f4a");
      pole(c, cx, top - 175, top - 128);
      // Red carpet + gravel
      rect(c, 0, H, w, 70, "#d9c7a0");
      c.fillStyle = "#b8201f";
      c.beginPath();
      c.moveTo(cx - 60, H);
      c.lineTo(cx + 60, H);
      c.lineTo(cx + 140, SCREEN_H);
      c.lineTo(cx - 140, SCREEN_H);
      c.fill();
    },
    floor: ["#d9c7a0", "#c4b088"],
    anim(c, t, cam) {
      const cx = STAGE_W / 2 - cam;
      flag(c, cx + 2, H - 300 - 174, 50, 32, TRICOLOR, t);
    },
  },

  meeting: {
    sky: ["#060b1f", "#13224d"],
    far(c, w) {
      for (let i = 0; i < 8; i++) {
        const x = (w / 8) * i + 40;
        const g = c.createLinearGradient(x, 0, x, H);
        g.addColorStop(0, "rgba(120,170,255,0.45)");
        g.addColorStop(1, "rgba(120,170,255,0)");
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(x - 10, 0);
        c.lineTo(x + 10, 0);
        c.lineTo(x + 90, H);
        c.lineTo(x - 90, H);
        c.fill();
      }
    },
    near(c, w) {
      rect(c, w / 2 - 260, 60, 520, 230, "#0e1a3d");
      c.strokeStyle = "#3a6cf0";
      c.lineWidth = 6;
      c.strokeRect(w / 2 - 260, 60, 520, 230);
      text(c, "LE PEUPLE", w / 2, 160, 56, "#ffffff");
      text(c, "A FAIM (DE PAIN)", w / 2, 230, 40, "#7fa7ff");
      rect(c, 0, H - 30, w, 30, "#1a2a5a");
      rect(c, 0, H, w, 70, "#0f1a3c");
    },
    floor: ["#0f1a3c", "#0a1230"],
    anim(c, t, cam) {
      crowd(c, -cam * 0.8 - 40, SCREEN_W + 40, SCREEN_H + 30, t, ["#1a2a5a", "#243a7a", "#101c40", "#2f4a9a"], 22, 1.6);
      for (let i = 0; i < 6; i++) {
        const x = ((i * 190 - cam * 0.8) % (SCREEN_W + 200) + SCREEN_W + 200) % (SCREEN_W + 200) - 100;
        flag(c, x, SCREEN_H - 120 + Math.sin(t * 0.1 + i) * 5, 46, 30, TRICOLOR, t + i * 20);
      }
    },
  },

  republique: {
    sky: ["#f2a65a", "#f7d9a6"],
    far(c, w) {
      seed = 8;
      for (let x = 0; x < w; x += 110) {
        const h = 200 + rnd() * 50;
        rect(c, x, H - h, 104, h, "#d9c2a0");
        rect(c, x, H - h - 16, 104, 16, "#6b7a8f");
        windows(c, x + 10, H - h + 20, 4, 5, 14, 22, 10, 14, "#7b6a58", 0.2);
      }
    },
    near(c, w) {
      const cx = w / 2;
      rect(c, cx - 70, H - 200, 140, 200, "#b8ad9a");
      rect(c, cx - 50, H - 260, 100, 60, "#a59a86");
      c.fillStyle = "#4f6b5a";
      c.beginPath();
      c.ellipse(cx, H - 320, 26, 60, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(cx, H - 390, 16, 0, Math.PI * 2);
      c.fill();
      c.fillRect(cx + 14, H - 440, 6, 80);
      c.beginPath();
      c.arc(cx + 17, H - 445, 9, 0, Math.PI * 2);
      c.fill();
      for (let x = 60; x < w; x += 300) if (Math.abs(x - cx) > 180) tree(c, x, H, 1.6, "#5c7f3a");
      rect(c, 0, H, w, 70, "#9a958c");
    },
    floor: ["#9a958c", "#86817a"],
    anim(c, t, cam) {
      crowd(c, -cam * 0.9 - 20, SCREEN_W + 40, H - 40, t, ["#8a2a2a", "#3a3a4a", "#6a3a2a", "#c8102e"], 20, 1.1);
      for (let i = 0; i < 5; i++) {
        const x = ((i * 230 - cam * 0.9) % (SCREEN_W + 230) + SCREEN_W + 230) % (SCREEN_W + 230) - 80;
        pole(c, x, H - 150, H - 40);
        flag(c, x + 2, H - 150, 50, 32, ["#c8102e"], t + i * 13);
      }
    },
  },

  yacht: {
    sky: ["#ff8a5b", "#ffd28a"],
    far(c, w) {
      sun(c, w * 0.6, H - 170, 60, "#fff1b0");
      rect(c, 0, H - 140, w, 140, "#2a6f9a");
      c.fillStyle = "#4a8fba";
      for (let i = 0; i < 40; i++) c.fillRect((i * 97) % w, H - 130 + (i * 31) % 120, 40, 3);
      c.fillStyle = "#6a6a7a";
      c.beginPath();
      c.moveTo(0, H - 140);
      c.lineTo(160, H - 220);
      c.lineTo(340, H - 160);
      c.lineTo(420, H - 140);
      c.fill();
    },
    near(c, w) {
      rect(c, 0, H - 40, w, 40, "#ffffff");
      c.strokeStyle = "#e3b23c";
      c.lineWidth = 5;
      for (let x = 0; x < w; x += 60) {
        c.beginPath();
        c.moveTo(x, H - 40);
        c.lineTo(x, H - 80);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(0, H - 80);
      c.lineTo(w, H - 80);
      c.stroke();
      rect(c, 0, H, w, 70, "#b07a4a");
      c.fillStyle = "#9a6a3e";
      for (let x = 0; x < w; x += 40) c.fillRect(x, H, 2, 70);
      text(c, "BLING", 160, H - 100, 30, "#e3b23c");
    },
    floor: ["#b07a4a", "#8f5f36"],
    anim(c, t, cam) {
      c.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 6; i++) {
        const x = ((i * 170 + t * 0.4 - cam * 0.5) % SCREEN_W + SCREEN_W) % SCREEN_W;
        c.fillRect(x, H - 120 + Math.sin(t * 0.05 + i) * 4, 30, 2);
      }
    },
  },

  correze: {
    sky: ["#5d6773", "#9aa3ad"],
    far(c, w) {
      c.fillStyle = "#56705a";
      c.beginPath();
      c.moveTo(0, H - 120);
      for (let x = 0; x <= w; x += 80) c.lineTo(x, H - 150 - Math.sin(x * 0.01) * 40);
      c.lineTo(w, H);
      c.lineTo(0, H);
      c.fill();
      rect(c, w * 0.5 - 30, H - 260, 60, 140, "#8c8478");
      c.fillStyle = "#5a5450";
      c.beginPath();
      c.moveTo(w * 0.5 - 36, H - 260);
      c.lineTo(w * 0.5, H - 340);
      c.lineTo(w * 0.5 + 36, H - 260);
      c.fill();
    },
    near(c, w) {
      seed = 5;
      for (let x = 20; x < w; x += 170) {
        rect(c, x, H - 150, 130, 150, "#bdb3a2");
        c.fillStyle = "#4b4f5a";
        c.beginPath();
        c.moveTo(x - 10, H - 150);
        c.lineTo(x + 65, H - 210);
        c.lineTo(x + 140, H - 150);
        c.fill();
        windows(c, x + 18, H - 120, 3, 2, 22, 28, 18, 20, "#3f4d5c", 0.3);
      }
      rect(c, 0, H, w, 70, "#4a4d52");
    },
    floor: ["#4a4d52", "#3a3c40"],
    front(c, t, cam) {
      rain(c, t, cam);
    },
  },

  salon: {
    sky: ["#d8d2c4", "#efe9dc"],
    far(c, w) {
      c.strokeStyle = "#9a9284";
      c.lineWidth = 6;
      for (let x = 0; x < w; x += 120) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x + 60, 140);
        c.lineTo(x + 120, 0);
        c.stroke();
      }
      rect(c, 0, 140, w, 10, "#9a9284");
      for (let x = 0; x < w; x += 260) {
        rect(c, x + 20, 170, 220, 46, "#2e7d32");
        text(c, "SALON DE L'AGRI", x + 130, 202, 18, "#fff");
      }
    },
    near(c, w) {
      for (let x = 0; x < w; x += 140) {
        rect(c, x, H - 60, 120, 60, "#e3c46a");
        c.strokeStyle = "#c9a54a";
        c.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          c.beginPath();
          c.moveTo(x, H - 60 + k * 15);
          c.lineTo(x + 120, H - 60 + k * 15);
          c.stroke();
        }
      }
      cow(c, 200, H - 60, 1.5);
      cow(c, w - 260, H - 60, 1.4);
      rect(c, w / 2 - 70, H - 110, 140, 50, "#8b5a2b");
      c.fillStyle = "#d22";
      for (let i = 0; i < 12; i++) {
        c.beginPath();
        c.arc(w / 2 - 55 + (i % 6) * 22, H - 118 - Math.floor(i / 6) * 14, 9, 0, Math.PI * 2);
        c.fill();
      }
      rect(c, 0, H, w, 70, "#b39a6a");
    },
    floor: ["#b39a6a", "#9a8358"],
  },

  arc: {
    sky: ["#c9b48a", "#ead9b0"],
    far(c, w) {
      const cx = w / 2;
      c.fillStyle = "#b8a27a";
      c.fillRect(cx - 190, H - 380, 380, 380);
      c.fillStyle = "#ead9b0";
      c.beginPath();
      c.moveTo(cx - 70, H);
      c.lineTo(cx - 70, H - 200);
      c.arc(cx, H - 200, 70, Math.PI, 0);
      c.lineTo(cx + 70, H);
      c.fill();
      c.fillStyle = "#a08a64";
      c.fillRect(cx - 200, H - 400, 400, 30);
      c.fillRect(cx - 190, H - 330, 380, 12);
    },
    near(c, w) {
      for (let x = 30; x < w; x += 230) tree(c, x, H, 1.3, "#6f7a45");
      rect(c, 0, H, w, 70, "#a39a86");
    },
    floor: ["#a39a86", "#8d846f"],
    anim(c, t, cam) {
      crowd(c, -cam - 30, SCREEN_W + 30, H - 6, t, ["#6a5a3a", "#4a4030", "#7a6a4a", "#5a6a3a"], 26, 1);
      const cx = (SCREEN_W + (STAGE_W - SCREEN_W) * 0.45) / 2 - cam * 0.45;
      flag(c, cx - 30, H - 330, 60, 120, TRICOLOR, t);
    },
  },

  plage: {
    sky: ["#7ec8f0", "#d8f1ff"],
    far(c, w) {
      rect(c, 0, H - 120, w, 120, "#3f8fbf");
      // Fort in the sea
      c.fillStyle = "#9a8f80";
      c.beginPath();
      c.ellipse(w * 0.7, H - 110, 90, 26, 0, 0, Math.PI * 2);
      c.fill();
      c.fillRect(w * 0.7 - 88, H - 150, 176, 40);
      windows(c, w * 0.7 - 70, H - 140, 8, 1, 8, 12, 12, 0, "#4a443c");
    },
    near(c, w) {
      rect(c, 0, H - 30, w, 100, "#ead39a");
      for (const [x, col] of [[180, "#e05297"], [w - 300, "#3b6fd8"], [w / 2 + 120, "#f2c94c"]] as [number, string][]) {
        rect(c, x - 2, H - 140, 4, 120, "#666");
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(x - 70, H - 130);
        c.quadraticCurveTo(x, H - 190, x + 70, H - 130);
        c.fill();
      }
    },
    floor: ["#ead39a", "#d9bf82"],
    anim(c, t) {
      c.strokeStyle = "#333";
      c.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const x = (i * 260 + t * (0.6 + i * 0.1)) % (SCREEN_W + 60) - 30;
        const y = 90 + i * 30 + Math.sin(t * 0.05 + i) * 10;
        const f = Math.sin(t * 0.25 + i) * 6;
        c.beginPath();
        c.moveTo(x - 12, y - f);
        c.quadraticCurveTo(x - 6, y - 6, x, y);
        c.quadraticCurveTo(x + 6, y - 6, x + 12, y - f);
        c.stroke();
      }
    },
  },

  golf: {
    sky: ["#5aa9f0", "#c6e6ff"],
    far(c, w) {
      c.fillStyle = "#7cbf5a";
      c.beginPath();
      c.moveTo(0, H - 80);
      c.quadraticCurveTo(w * 0.3, H - 160, w * 0.6, H - 90);
      c.quadraticCurveTo(w * 0.8, H - 50, w, H - 120);
      c.lineTo(w, H);
      c.lineTo(0, H);
      c.fill();
      rect(c, w * 0.15, H - 360, 120, 300, "#c9a43a");
      windows(c, w * 0.15 + 12, H - 340, 4, 9, 18, 18, 8, 12, "#7a5f1a", 0.3);
      text(c, "TROMPE", w * 0.15 + 60, H - 370, 26, "#c9a43a");
    },
    near(c, w) {
      for (const x of [90, w - 120]) {
        rect(c, x - 6, H - 200, 12, 200, "#8a6a4a");
        c.fillStyle = "#3f8a3a";
        for (let k = 0; k < 6; k++) {
          c.beginPath();
          c.ellipse(x + Math.cos(k) * 40, H - 200 + Math.sin(k) * 10, 50, 12, k, 0, Math.PI * 2);
          c.fill();
        }
      }
      rect(c, w / 2 + 200, H - 120, 3, 120, "#ddd");
      c.fillStyle = "#d0201f";
      c.beginPath();
      c.moveTo(w / 2 + 203, H - 120);
      c.lineTo(w / 2 + 240, H - 108);
      c.lineTo(w / 2 + 203, H - 96);
      c.fill();
      rect(c, 0, H, w, 70, "#5fae45");
    },
    floor: ["#5fae45", "#4f963a"],
  },

  kremlin: {
    sky: ["#0d1b33", "#2a3f63"],
    far(c, w) {
      rect(c, 0, H - 120, w, 120, "#8a2420");
      for (let x = 0; x < w; x += 24) rect(c, x, H - 132, 14, 14, "#8a2420");
      rect(c, w * 0.15, H - 260, 50, 140, "#8a2420");
      c.fillStyle = "#8a2420";
      c.beginPath();
      c.moveTo(w * 0.15 - 6, H - 260);
      c.lineTo(w * 0.15 + 25, H - 330);
      c.lineTo(w * 0.15 + 56, H - 260);
      c.fill();
      c.fillStyle = "#e33";
      c.beginPath();
      c.arc(w * 0.15 + 25, H - 335, 7, 0, Math.PI * 2);
      c.fill();
    },
    near(c, w) {
      const cx = w * 0.62;
      rect(c, cx - 140, H - 160, 280, 160, "#b5523b");
      onion(c, cx, H - 160, 80, 220, ["#2a8a4a", "#f2c94c"]);
      onion(c, cx - 100, H - 160, 50, 150, ["#c8102e", "#ffffff"]);
      onion(c, cx + 100, H - 160, 50, 160, ["#2a5bd7", "#f2c94c"]);
      onion(c, cx - 50, H - 160, 40, 120, ["#f2c94c", "#2a8a4a"]);
      onion(c, cx + 50, H - 160, 40, 130, ["#e05297", "#2a5bd7"]);
      rect(c, 0, H, w, 70, "#d8dde6");
    },
    floor: ["#d8dde6", "#b9c0cc"],
    front(c, t, cam) {
      snow(c, t, cam);
    },
  },

  muraille: {
    sky: ["#f28c4a", "#ffd39a"],
    far(c, w) {
      sun(c, w * 0.3, H - 200, 50, "#fff0b0");
      for (const [col, base, amp] of [["#b07a6a", H - 140, 120], ["#8a5a5a", H - 90, 90]] as [string, number, number][]) {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(0, H);
        for (let x = 0; x <= w; x += 40) c.lineTo(x, base - Math.abs(Math.sin(x * 0.006 + amp)) * amp);
        c.lineTo(w, H);
        c.fill();
      }
      c.strokeStyle = "#c9a07a";
      c.lineWidth = 10;
      c.beginPath();
      for (let x = 0; x <= w; x += 20) {
        const y = H - 120 - Math.abs(Math.sin(x * 0.006 + 90)) * 70;
        if (x === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    },
    near(c, w) {
      rect(c, 0, H - 40, w, 40, "#b08a64");
      for (let x = 0; x < w; x += 40) rect(c, x, H - 62, 26, 22, "#b08a64");
      for (const x of [60, w - 140]) {
        rect(c, x, H - 220, 90, 180, "#9a7654");
        c.fillStyle = "#6a2a20";
        c.beginPath();
        c.moveTo(x - 20, H - 220);
        c.quadraticCurveTo(x + 45, H - 250, x + 110, H - 220);
        c.lineTo(x + 45, H - 270);
        c.fill();
      }
      rect(c, 0, H, w, 70, "#a07c5a");
    },
    floor: ["#a07c5a", "#8a6a4a"],
    anim(c, t, cam) {
      for (let i = 0; i < 5; i++) {
        const x = ((i * 240 - cam * 0.95) % (SCREEN_W + 240) + SCREEN_W + 240) % (SCREEN_W + 240) - 60;
        const y = 120 + Math.sin(t * 0.04 + i) * 6;
        c.fillStyle = "#d7261e";
        c.beginPath();
        c.ellipse(x, y, 16, 20, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#f2c94c";
        c.fillRect(x - 4, y + 18, 8, 10);
      }
    },
  },

  bruxelles: {
    sky: ["#7a8ea8", "#c8d4e2"],
    far(c, w) {
      seed = 12;
      for (let x = 0; x < w; x += 90) rect(c, x, H - 160 - rnd() * 80, 84, 300, "#9aa6b6");
    },
    near(c, w) {
      const g = c.createLinearGradient(0, H - 330, 0, H);
      g.addColorStop(0, "#9fc3e0");
      g.addColorStop(1, "#4f7da6");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(w * 0.2, H);
      c.lineTo(w * 0.2, H - 260);
      c.quadraticCurveTo(w * 0.5, H - 380, w * 0.8, H - 260);
      c.lineTo(w * 0.8, H);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.4)";
      c.lineWidth = 2;
      for (let x = w * 0.2; x < w * 0.8; x += 30) {
        c.beginPath();
        c.moveTo(x, H);
        c.lineTo(x, H - 300);
        c.stroke();
      }
      rect(c, 0, H, w, 70, "#7d8590");
    },
    floor: ["#7d8590", "#6a717b"],
    anim(c, t, cam) {
      for (let i = 0; i < 4; i++) {
        const x = ((i * 300 + 80 - cam) % (SCREEN_W + 300) + SCREEN_W + 300) % (SCREEN_W + 300) - 100;
        pole(c, x, H - 260, H);
        flag(c, x + 2, H - 260, 70, 46, ["#1f3fa8"], t + i * 10);
        c.fillStyle = "#ffd400";
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          c.fillRect(x + 37 + Math.cos(a) * 13, H - 237 + Math.sin(a) * 13 + Math.sin(t * 0.08 + x * 0.05) * 2, 3, 3);
        }
      }
    },
  },

  assemblee: {
    sky: ["#3a1f1f", "#6a3a32"],
    far(c, w) {
      for (let r = 0; r < 6; r++) {
        c.strokeStyle = r % 2 ? "#8a1f24" : "#a5262c";
        c.lineWidth = 26;
        c.beginPath();
        c.ellipse(w / 2, H + 40, 300 + r * 70, 160 + r * 50, 0, Math.PI, Math.PI * 2);
        c.stroke();
      }
    },
    near(c, w) {
      rect(c, w / 2 - 120, H - 150, 240, 150, "#c9a46a");
      rect(c, w / 2 - 90, H - 200, 180, 50, "#8b5a2b");
      flag(c, w / 2 - 160, H - 300, 60, 40, TRICOLOR, 0);
      rect(c, 0, H, w, 70, "#5a2a22");
    },
    floor: ["#5a2a22", "#4a221c"],
    anim(c, t, cam) {
      crowd(c, -cam * 0.5, SCREEN_W, H - 150, t, ["#2a2a2a", "#3a3a4a", "#4a3a3a"], 30, 0.8);
    },
  },

  lehavre: {
    sky: ["#7f9bb8", "#d9e2ea"],
    far(c, w) {
      rect(c, 0, H - 110, w, 110, "#5a7a96");
      // Saint-Joseph tower and gantry cranes
      rect(c, w * 0.22 - 18, H - 380, 36, 270, "#9aa4ae");
      c.fillStyle = "#9aa4ae";
      c.beginPath();
      c.moveTo(w * 0.22 - 18, H - 380);
      c.lineTo(w * 0.22, H - 440);
      c.lineTo(w * 0.22 + 18, H - 380);
      c.fill();
      for (const x of [w * 0.5, w * 0.68, w * 0.86]) {
        c.strokeStyle = "#c8562a";
        c.lineWidth = 8;
        c.beginPath();
        c.moveTo(x - 40, H - 110);
        c.lineTo(x - 40, H - 300);
        c.moveTo(x + 40, H - 110);
        c.lineTo(x + 40, H - 300);
        c.moveTo(x - 90, H - 300);
        c.lineTo(x + 140, H - 300);
        c.stroke();
      }
    },
    near(c, w) {
      const cols = ["#c8102e", "#2a7ab8", "#e8a33a", "#2e7d32", "#8a3ab8", "#e05a2a"];
      seed = 17;
      for (let x = 20; x < w - 100; x += 130) {
        const stack = 1 + Math.floor(rnd() * 3);
        for (let k = 0; k < stack; k++) container(c, x, H - 58 * (k + 1), 120, 56, cols[Math.floor(rnd() * cols.length)]);
      }
      rect(c, 0, H, w, 70, "#8a8f94");
      c.fillStyle = "#f2c230";
      for (let x = 0; x < w; x += 60) c.fillRect(x, H + 6, 30, 5);
    },
    floor: ["#8a8f94", "#6a6f74"],
    anim(c, t, cam) {
      for (let i = 0; i < 4; i++) {
        const x = ((i * 280 + t * (0.9 + i * 0.2) - cam * 0.3) % (SCREEN_W + 120) + SCREEN_W + 120) % (SCREEN_W + 120) - 60;
        drawSprite(c, "gull", x, 70 + i * 30 + Math.sin(t * 0.05 + i) * 12, 34);
      }
    },
  },

  matignon: {
    sky: ["#8fc3ec", "#e6f3ff"],
    far(c, w) {
      seed = 5;
      for (let x = 0; x < w; x += 90) tree(c, x + rnd() * 40, H - 60, 1.4 + rnd() * 0.4, "#3f7d3a");
    },
    near(c, w) {
      const top = H - 260;
      rect(c, 160, top, w - 320, 260, "#ece2cc");
      rect(c, 160, top - 18, w - 320, 22, "#d6c9ac");
      c.fillStyle = "#4a5a6a";
      c.beginPath();
      c.moveTo(150, top - 18);
      c.lineTo(w / 2, top - 70);
      c.lineTo(w - 150, top - 18);
      c.fill();
      windows(c, 200, top + 40, Math.floor((w - 400) / 64), 2, 30, 76, 34, 44, "#6a7d92");
      rect(c, w / 2 - 44, H - 120, 88, 120, "#2f3b2a");
      pole(c, w / 2, top - 150, top - 70);
      rect(c, 0, H, w, 70, "#5a9a4a");
      c.fillStyle = "#4e8a40";
      for (let x = 0; x < w; x += 80) c.fillRect(x, H, 40, 70);
    },
    floor: ["#5a9a4a", "#3f7a33"],
    anim(c, t, cam) {
      flag(c, STAGE_W / 2 - cam + 2, H - 260 - 150, 50, 32, TRICOLOR, t);
    },
  },

  pau: {
    sky: ["#6fb0e8", "#dcefff"],
    far(c, w) {
      mountains(c, w, H - 60, "#8a9ab8", 5, 300, "#ffffff");
      mountains(c, w, H - 40, "#6a8a6a", 7, 140);
    },
    near(c, w) {
      const cx = w / 2;
      rect(c, cx - 260, H - 220, 520, 220, "#c9b48a");
      for (const x of [cx - 300, cx + 220]) {
        rect(c, x, H - 320, 80, 320, "#bfa77a");
        c.fillStyle = "#6a4a3a";
        c.beginPath();
        c.moveTo(x - 10, H - 320);
        c.lineTo(x + 40, H - 400);
        c.lineTo(x + 90, H - 320);
        c.fill();
      }
      for (let x = cx - 250; x < cx + 250; x += 40) rect(c, x, H - 240, 24, 22, "#c9b48a");
      windows(c, cx - 200, H - 180, 6, 2, 26, 44, 42, 30, "#4a3a2a");
      rect(c, cx - 40, H - 110, 80, 110, "#5a3a22");
      rect(c, 0, H, w, 70, "#a89068");
    },
    floor: ["#a89068", "#8a7454"],
    anim(c, t, cam) {
      flag(c, STAGE_W / 2 - 300 + 40 - cam, H - 470, 46, 30, ["#f2c230", "#c8102e"], t, false);
    },
  },

  tiktok: {
    sky: ["#0b0b14", "#1a1030"],
    far(c, w) {
      for (let i = 0; i < 14; i++) {
        c.fillStyle = i % 2 ? "rgba(255,0,80,0.18)" : "rgba(0,240,255,0.18)";
        c.beginPath();
        c.arc((w / 14) * i + 30, 120 + (i % 3) * 60, 60, 0, Math.PI * 2);
        c.fill();
      }
    },
    near(c, w) {
      const cx = w / 2;
      c.fillStyle = "#111";
      c.strokeStyle = "#ffffff";
      c.lineWidth = 6;
      c.beginPath();
      c.roundRect(cx - 120, 40, 240, 380, 28);
      c.fill();
      c.stroke();
      text(c, "♪", cx, 230, 120, "#25f4ee");
      text(c, "♪", cx + 6, 236, 120, "#fe2c55");
      text(c, "♪", cx + 3, 233, 120, "#ffffff");
      for (const x of [cx - 380, cx + 380]) {
        c.strokeStyle = "#f4f4f4";
        c.lineWidth = 10;
        c.beginPath();
        c.arc(x, 200, 70, 0, Math.PI * 2);
        c.stroke();
        rect(c, x - 3, 270, 6, H - 270, "#444");
      }
      rect(c, 0, H, w, 70, "#1a1a28");
    },
    floor: ["#1a1a28", "#0e0e18"],
    anim(c, t, cam) {
      for (let i = 0; i < 8; i++) {
        const y = SCREEN_H - ((t * (1.2 + (i % 3) * 0.4) + i * 70) % (SCREEN_H + 60));
        const x = ((STAGE_W / 2 + 150 + (i % 4) * 22 - cam) + Math.sin(t * 0.05 + i) * 18);
        drawSprite(c, "heart", x, y, 22 + (i % 3) * 6);
      }
      text(c, (1200 + Math.floor(t * 37) % 99999).toString() + " ♥", STAGE_W / 2 + 190 - cam, 420, 22, "#ffffff");
    },
  },

  cannes: {
    sky: ["#f7a35c", "#ffe3b0"],
    far(c, w) {
      sun(c, w * 0.7, H - 150, 50, "#ffd27a");
      rect(c, 0, H - 120, w, 120, "#3a7ab8");
      for (const x of [w * 0.2, w * 0.45, w * 0.8]) {
        c.fillStyle = "#ffffff";
        c.beginPath();
        c.moveTo(x - 60, H - 130);
        c.lineTo(x + 60, H - 130);
        c.lineTo(x + 40, H - 112);
        c.lineTo(x - 50, H - 112);
        c.fill();
        rect(c, x - 20, H - 150, 40, 20, "#ffffff");
      }
    },
    near(c, w) {
      const cx = w / 2;
      for (let i = 0; i < 5; i++) rect(c, cx - 220 + i * 20, H - 20 - i * 18, 440 - i * 40, 20, "#d7262e");
      rect(c, cx - 260, H - 300, 520, 200, "#e9e2d2");
      text(c, "FESTIVAL", cx, H - 210, 48, "#c9a227");
      for (const x of [140, 300, w - 300, w - 140]) palmTree(c, x, H, 1);
      rect(c, 0, H, w, 70, "#e8d4a8");
    },
    floor: ["#e8d4a8", "#c9b080"],
    anim(c, t, cam) {
      for (let i = 0; i < 6; i++) {
        if ((t + i * 37) % 90 < 4) {
          const x = ((i * 170 - cam * 0.8) % SCREEN_W + SCREEN_W) % SCREEN_W;
          c.fillStyle = "rgba(255,255,255,0.8)";
          c.beginPath();
          c.arc(x, SCREEN_H - 60, 30, 0, Math.PI * 2);
          c.fill();
        }
      }
      crowd(c, -cam * 0.8 - 40, SCREEN_W + 40, SCREEN_H + 30, t, ["#1a1a1a", "#3a3a3a", "#c8102e", "#e8e8e8"], 26, 1.4);
    },
  },

  plateau: {
    sky: ["#0a1a3a", "#13306a"],
    far(c, w) {
      for (let i = 0; i < 5; i++) {
        const x = (w / 5) * i + 20;
        rect(c, x, 80, w / 5 - 40, 200, "#0e2350");
        c.strokeStyle = "#2f6ad8";
        c.lineWidth = 3;
        c.strokeRect(x, 80, w / 5 - 40, 200);
      }
    },
    near(c, w) {
      const cx = w / 2;
      rect(c, cx - 300, 60, 600, 150, "#0b1736");
      c.strokeStyle = "#e8e8e8";
      c.lineWidth = 4;
      c.strokeRect(cx - 300, 60, 600, 150);
      text(c, "DÉBAT", cx, 140, 64, "#ffffff");
      text(c, "SANS LIMITE DE TEMPS", cx, 190, 26, "#ffcc1a");
      c.fillStyle = "#e8e8ee";
      c.beginPath();
      c.ellipse(cx, H - 70, 240, 30, 0, 0, Math.PI * 2);
      c.fill();
      rect(c, cx - 240, H - 70, 480, 70, "#c9ced8");
      for (const x of [120, w - 120]) {
        rect(c, x - 4, H - 160, 8, 160, "#222");
        rect(c, x - 30, H - 200, 60, 40, "#333");
        rect(c, x + 30, H - 190, 20, 20, "#555");
      }
      rect(c, 0, H, w, 70, "#16224a");
    },
    floor: ["#16224a", "#0c1430"],
    anim(c, t, cam) {
      if (Math.floor(t / 40) % 2 === 0) {
        rect(c, 30, 24, 120, 30, "#d7262e");
        text(c, "EN DIRECT", 90, 46, 18, "#ffffff");
      }
      void cam;
    },
  },

  usine: {
    sky: ["#7a7f86", "#c9ccd0"],
    far(c, w) {
      rect(c, w * 0.1, H - 260, w * 0.8, 260, "#6a6a70");
      for (let i = 0; i < 8; i++) {
        c.fillStyle = "#5a5a60";
        c.beginPath();
        const x = w * 0.1 + i * (w * 0.1);
        c.moveTo(x, H - 260);
        c.lineTo(x + w * 0.05, H - 300);
        c.lineTo(x + w * 0.1, H - 260);
        c.fill();
      }
      for (const x of [w * 0.25, w * 0.6]) rect(c, x, H - 420, 40, 160, "#5a4a40");
    },
    near(c, w) {
      c.strokeStyle = "#555";
      c.lineWidth = 3;
      for (let x = 0; x < w; x += 24) {
        c.beginPath();
        c.moveTo(x, H - 140);
        c.lineTo(x + 24, H - 116);
        c.moveTo(x + 24, H - 140);
        c.lineTo(x, H - 116);
        c.stroke();
      }
      rect(c, 0, H - 142, w, 4, "#555");
      rect(c, w / 2 - 260, H - 240, 520, 70, "#f4f1e6");
      text(c, "USINE EN GRÈVE", w / 2, H - 190, 44, "#d7262e");
      for (const x of [200, w - 260]) {
        rect(c, x, H - 70, 50, 70, "#3a3a40");
      }
      rect(c, 0, H, w, 70, "#6a6a6a");
    },
    floor: ["#6a6a6a", "#4a4a4a"],
    anim(c, t, cam) {
      for (const bx of [200, STAGE_W - 260]) {
        const x = bx + 25 - cam;
        for (let i = 0; i < 4; i++) {
          c.fillStyle = i % 2 ? "rgba(255,200,40,0.9)" : "rgba(255,90,20,0.9)";
          c.beginPath();
          c.ellipse(x + Math.sin(t * 0.3 + i) * 6, H - 74 - i * 7, 12 - i * 2, 14 - i * 2, 0, 0, Math.PI * 2);
          c.fill();
        }
      }
      for (const cx of [0.25, 0.6]) {
        const x = 40 + cx * (SCREEN_W + 400) * 0.6 - cam * 0.45;
        for (let i = 0; i < 5; i++) {
          const k = ((t * 0.5 + i * 20) % 100) / 100;
          c.fillStyle = `rgba(90,90,96,${0.5 * (1 - k)})`;
          c.beginPath();
          c.arc(x + k * 60, H - 430 - k * 160, 20 + k * 30, 0, Math.PI * 2);
          c.fill();
        }
      }
    },
  },

  pyrenees: {
    sky: ["#5fa8e8", "#d8eeff"],
    far(c, w) {
      mountains(c, w, H - 80, "#7a8aa8", 4, 340, "#ffffff");
      mountains(c, w, H - 50, "#4f8a4a", 6, 170);
    },
    near(c, w) {
      rect(c, w * 0.15, H - 130, 200, 130, "#9a8e7e");
      c.fillStyle = "#5a4a40";
      c.beginPath();
      c.moveTo(w * 0.15 - 20, H - 130);
      c.lineTo(w * 0.15 + 100, H - 200);
      c.lineTo(w * 0.15 + 220, H - 130);
      c.fill();
      rect(c, w * 0.15 + 80, H - 70, 40, 70, "#4a3020");
      seed = 41;
      for (let i = 0; i < 9; i++) drawSprite(c, "sheep", w * 0.45 + rnd() * w * 0.5, H - 20 - rnd() * 40, 40);
      rect(c, 0, H, w, 70, "#6aa84a");
    },
    floor: ["#6aa84a", "#4a8a33"],
    anim(c, t, cam) {
      for (let i = 0; i < 3; i++) {
        const x = ((i * 380 + t * 0.3 - cam * 0.2) % (SCREEN_W + 300) + SCREEN_W + 300) % (SCREEN_W + 300) - 150;
        c.fillStyle = "rgba(255,255,255,0.85)";
        for (const [dx, r] of [[0, 30], [30, 38], [64, 28]]) {
          c.beginPath();
          c.arc(x + dx, 80 + i * 40, r, 0, Math.PI * 2);
          c.fill();
        }
      }
    },
  },

  buenosaires: {
    sky: ["#74acdf", "#e4f2ff"],
    far(c, w) {
      seed = 29;
      for (let x = 0; x < w; x += 60) rect(c, x, H - 160 - rnd() * 120, 54, 300, "#a8b8c8");
      rect(c, w * 0.5 - 8, H - 360, 16, 260, "#d8dde4");
    },
    near(c, w) {
      const top = H - 280;
      rect(c, 120, top, w - 240, 280, "#e8a3a8");
      rect(c, 120, top - 16, w - 240, 18, "#d88a90");
      windows(c, 160, top + 40, Math.floor((w - 320) / 70), 2, 32, 70, 38, 50, "#7a4a50");
      const cx = w / 2;
      rect(c, cx - 110, top + 120, 220, 16, "#d88a90");
      rect(c, cx - 50, H - 130, 100, 130, "#5a3a3a");
      pole(c, cx, top - 120, top - 16);
      rect(c, 0, H, w, 70, "#c9c2b6");
    },
    floor: ["#c9c2b6", "#a8a094"],
    anim(c, t, cam) {
      flag(c, STAGE_W / 2 - cam + 2, H - 280 - 118, 54, 34, ["#74acdf", "#ffffff", "#74acdf"], t, false);
      for (let i = 0; i < 30; i++) {
        const x = ((i * 67 + t * 0.6) % SCREEN_W);
        const y = (i * 41 + t * (1 + (i % 4) * 0.3)) % SCREEN_H;
        c.fillStyle = i % 2 ? "#74acdf" : "#ffffff";
        c.fillRect(x, y, 5, 3);
      }
      void cam;
    },
  },

  london: {
    sky: ["#7a8492", "#c4cad2"],
    far(c, w) {
      const x = w * 0.75;
      rect(c, x - 26, H - 420, 52, 320, "#8a8478");
      rect(c, x - 34, H - 330, 68, 60, "#9a9488");
      c.fillStyle = "#f4f1e6";
      c.beginPath();
      c.arc(x, H - 300, 22, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#6a6458";
      c.beginPath();
      c.moveTo(x - 30, H - 420);
      c.lineTo(x, H - 500);
      c.lineTo(x + 30, H - 420);
      c.fill();
      seed = 13;
      for (let i = 0; i < w; i += 70) rect(c, i, H - 120 - rnd() * 80, 64, 200, "#9a9ea6");
    },
    near(c, w) {
      const cx = w / 2;
      rect(c, 80, H - 320, w - 160, 320, "#3a2a24");
      c.fillStyle = "#4a3630";
      for (let y = H - 320; y < H; y += 12) for (let x = 80 + ((y / 12) % 2) * 12; x < w - 80; x += 24) c.fillRect(x, y, 22, 10);
      windows(c, 140, H - 280, Math.floor((w - 280) / 90), 2, 44, 70, 46, 40, "#d8dde4");
      rect(c, cx - 50, H - 170, 100, 170, "#111");
      text(c, "10", cx, H - 110, 28, "#f4f4f4");
      c.fillStyle = "#e8c04a";
      c.beginPath();
      c.arc(cx + 30, H - 80, 5, 0, Math.PI * 2);
      c.fill();
      rect(c, 0, H, w, 70, "#5a5e66");
    },
    floor: ["#5a5e66", "#3a3e46"],
    anim(c, t, cam) {
      rain(c, t, cam, "rgba(220,230,240,0.35)", 70);
    },
  },

  rome: {
    sky: ["#f2b46a", "#ffe8c4"],
    far(c, w) {
      const cx = w / 2;
      c.fillStyle = "#c9a37a";
      c.beginPath();
      c.ellipse(cx, H - 60, 380, 260, 0, Math.PI, Math.PI * 2);
      c.fill();
      c.fillStyle = "#8a6a4a";
      for (let row = 0; row < 3; row++)
        for (let i = -6; i <= 6; i++) {
          const x = cx + i * 50;
          const y = H - 110 - row * 70;
          if (Math.abs(i) * 50 > 330 - row * 40) continue;
          c.beginPath();
          c.ellipse(x, y, 14, 26, 0, Math.PI, Math.PI * 2);
          c.fill();
          c.fillRect(x - 14, y, 28, 24);
        }
    },
    near(c, w) {
      for (const x of [60, 200, w - 200, w - 60]) drawSprite(c, "column", x, H - 120, 240);
      rect(c, 0, H, w, 70, "#d8b98a");
    },
    floor: ["#d8b98a", "#b89a6a"],
    anim(c, t, cam) {
      flag(c, STAGE_W / 2 - cam - 30, 40, 60, 40, ["#008c45", "#f4f5f0", "#cd212a"], t);
    },
  },

  pyongyang: {
    sky: ["#9ab8d8", "#e8f0f8"],
    far(c, w) {
      const cx = w * 0.5;
      rect(c, cx - 22, H - 430, 44, 330, "#d8d0c0");
      c.fillStyle = "#d7262e";
      c.beginPath();
      c.moveTo(cx - 26, H - 430);
      c.quadraticCurveTo(cx, H - 500, cx + 26, H - 430);
      c.fill();
      seed = 61;
      for (let x = 0; x < w; x += 80) rect(c, x, H - 150 - rnd() * 90, 70, 200, "#b8c0c8");
    },
    near(c, w) {
      rect(c, 100, H - 180, w - 200, 70, "#e8e2d4");
      for (let x = 140; x < w - 140; x += 120) rect(c, x, H - 300, 70, 120, "#d7262e");
      rect(c, 0, H, w, 70, "#c9c4b8");
      c.fillStyle = "#b0aba0";
      for (let x = 0; x < w; x += 80) c.fillRect(x, H + 30, 60, 4);
    },
    floor: ["#c9c4b8", "#a8a398"],
    anim(c, t, cam) {
      crowd(c, -cam * 0.6 - 20, SCREEN_W + 40, H - 110, t, ["#3a4a3a", "#2a3a2a", "#4a5a3a"], 16, 0.8);
      bunting(c, 0, SCREEN_W, 30, 20, ["#d7262e", "#1d3fa0", "#ffffff"]);
    },
  },
};

// ---------------------------------------------------------------- pre-rendering

export interface StageLayers {
  art: StageArt;
  far: HTMLCanvasElement;
  near: HTMLCanvasElement;
}

const FAR_PARALLAX = 0.45;

export function buildStage(id: string): StageLayers {
  const art = STAGE_ART[id] ?? STAGE_ART.assemblee;
  const farW = Math.ceil(SCREEN_W + (STAGE_W - SCREEN_W) * FAR_PARALLAX);
  const far = document.createElement("canvas");
  far.width = farW;
  far.height = SCREEN_H;
  const fc = far.getContext("2d")!;
  const g = fc.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, art.sky[0]);
  g.addColorStop(1, art.sky[1]);
  fc.fillStyle = g;
  fc.fillRect(0, 0, farW, SCREEN_H);
  art.far(fc, farW);
  const near = document.createElement("canvas");
  near.width = STAGE_W;
  near.height = SCREEN_H;
  const nc = near.getContext("2d")!;
  art.near(nc, STAGE_W);
  const fg = nc.createLinearGradient(0, GROUND_Y, 0, SCREEN_H);
  fg.addColorStop(0, art.floor[0]);
  fg.addColorStop(1, art.floor[1]);
  nc.fillStyle = fg;
  nc.globalAlpha = 0.55;
  nc.fillRect(0, GROUND_Y, STAGE_W, SCREEN_H - GROUND_Y);
  nc.globalAlpha = 1;
  nc.fillStyle = "rgba(0,0,0,0.25)";
  nc.fillRect(0, GROUND_Y, STAGE_W, 3);
  return { art, far, near };
}

/** Draws the background for a camera left edge `cam` (world x). */
export function drawStage(c: Ctx, layers: StageLayers, cam: number, t: number) {
  c.drawImage(layers.far, -cam * FAR_PARALLAX, 0);
  c.drawImage(layers.near, -cam, 0);
  layers.art.anim?.(c, t, cam);
}
