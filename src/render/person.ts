/**
 * Procedural caricature rig: a body built from angles (forward kinematics) and a 3/4 head with
 * exaggerated features. Everything is drawn facing right; the caller mirrors with `facing`.
 */
import type { Look } from "./looks";

export type Expr = "neutral" | "hurt" | "shout" | "happy" | "ko" | "focus";

export interface Pose {
  lean: number;
  rot: number;
  armF: [number, number];
  armB: [number, number];
  legF: [number, number];
  legB: [number, number];
  head: number;
  squash: number;
  expr: Expr;
  shirtless?: boolean;
  /** Raises the body (jumps are handled by the caller; this is for crouch adjustments). */
  lift?: number;
}

export const STANCE: Pose = {
  lean: 0.08,
  rot: 0,
  armF: [0.55, 1.75],
  armB: [0.25, 1.9],
  legF: [0.32, 0.3],
  legB: [-0.32, 0.12],
  head: 0,
  squash: 1,
  expr: "neutral",
};

const L = { torso: 52, thigh: 32, shin: 32, ua: 27, fa: 25 };
const OUT = "#14110f";
/** Caricature: heads are drawn bigger than the body would allow. */
const HEAD_SCALE = 1.3;

const dir = (a: number) => [Math.sin(a), Math.cos(a)] as const;

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

function limb(ctx: CanvasRenderingContext2D, pts: number[][], width: number, color: string) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = width + 5;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function blob(ctx: CanvasRenderingContext2D, path: () => void, fill: string, outline = 3) {
  ctx.beginPath();
  path();
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = OUT;
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  ctx.fill();
}

interface Joints {
  hip: [number, number];
  neck: [number, number];
  shoulder: [number, number];
  knees: [number, number][];
  feet: [number, number][];
  shinAngles: number[];
}

function solve(p: Pose): Joints {
  const legs = [p.legB, p.legF].map(([a, bend]) => {
    const [sx, sy] = dir(a);
    const knee: [number, number] = [sx * L.thigh, sy * L.thigh];
    const b = a - bend;
    const [tx, ty] = dir(b);
    const foot: [number, number] = [knee[0] + tx * L.shin, knee[1] + ty * L.shin];
    return { knee, foot, b };
  });
  const drop = Math.max(legs[0].foot[1], legs[1].foot[1]);
  const hipY = -drop - 5 - (p.lift ?? 0);
  const [lx, ly] = dir(Math.PI + p.lean);
  const hip: [number, number] = [0, hipY];
  const neck: [number, number] = [hip[0] + lx * L.torso * p.squash, hip[1] + ly * L.torso * p.squash];
  const shoulder: [number, number] = [hip[0] + lx * (L.torso - 7) * p.squash, hip[1] + ly * (L.torso - 7) * p.squash];
  return {
    hip,
    neck,
    shoulder,
    knees: legs.map((l) => [l.knee[0], l.knee[1] + hipY]),
    feet: legs.map((l) => [l.foot[0], l.foot[1] + hipY]),
    shinAngles: legs.map((l) => l.b),
  };
}

function arm(ctx: CanvasRenderingContext2D, look: Look, j: Joints, p: Pose, front: boolean) {
  const [a, bend] = front ? p.armF : p.armB;
  const ua = a + p.lean;
  const [ux, uy] = dir(ua);
  const sh: [number, number] = [j.shoulder[0] + (front ? 3 : -3), j.shoulder[1] + 2];
  const el = [sh[0] + ux * L.ua, sh[1] + uy * L.ua];
  const [fx, fy] = dir(ua + bend);
  const hand = [el[0] + fx * L.fa, el[1] + fy * L.fa];
  const sleeve = p.shirtless ? look.skin : front ? look.suit : shade(look.suit, -0.08);
  limb(ctx, [sh, el, hand], 12, sleeve);
  if (front && look.extras.includes("goldWatch")) {
    ctx.fillStyle = "#e8c04a";
    ctx.beginPath();
    ctx.arc(el[0] + fx * (L.fa - 5), el[1] + fy * (L.fa - 5), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  blob(ctx, () => ctx.arc(hand[0], hand[1], 7, 0, Math.PI * 2), front ? look.skin : shade(look.skin, -0.06), 2.5);
}

function leg(ctx: CanvasRenderingContext2D, look: Look, j: Joints, i: number) {
  const front = i === 1;
  const color = front ? look.pants : shade(look.pants, -0.08);
  const hip: [number, number] = [j.hip[0] + (front ? 4 : -4), j.hip[1]];
  limb(ctx, [hip, j.knees[i], j.feet[i]], 15, color);
  const [fx, fy] = j.feet[i];
  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(-j.shinAngles[i]);
  blob(ctx, () => ctx.ellipse(6, 0, 12, 6.5, 0, 0, Math.PI * 2), look.shoes, 2.5);
  ctx.restore();
}

function torso(ctx: CanvasRenderingContext2D, look: Look, j: Joints, p: Pose) {
  const [hx, hy] = j.hip;
  const [nx, ny] = j.neck;
  const ax = nx - hx, ay = ny - hy;
  const len = Math.hypot(ax, ay) || 1;
  const px = -ay / len, py = ax / len; // perpendicular (points forward when upright)
  const wh = 15 * look.width;
  const ws = 19 * look.width;
  const belly = look.belly ?? 0;
  const body = p.shirtless ? look.skin : look.suit;
  blob(ctx, () => {
    ctx.moveTo(hx - px * wh, hy - py * wh);
    ctx.lineTo(nx - px * ws, ny - py * ws + 4);
    ctx.quadraticCurveTo(nx, ny - 3, nx + px * ws, ny + py * ws + 4);
    ctx.quadraticCurveTo(hx + ax * 0.45 + px * (wh + belly + 4), hy + ay * 0.45 + py * (wh + belly + 4), hx + px * wh, hy + py * wh);
    ctx.closePath();
  }, body, 3);
  const at = (t: number, side: number) => [hx + ax * t + px * side, hy + ay * t + py * side] as const;
  if (p.shirtless) {
    ctx.strokeStyle = shade(look.skin, -0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const a = at(0.72, 2), b = at(0.62, ws * 0.7), c = at(0.7, -ws * 0.5);
    ctx.moveTo(c[0], c[1]);
    ctx.quadraticCurveTo(a[0], a[1] + 6, b[0], b[1]);
    const d = at(0.35, 2), e = at(0.25, 2);
    ctx.moveTo(d[0], d[1]);
    ctx.lineTo(e[0], e[1]);
    ctx.stroke();
    return;
  }
  // Belt line
  if (look.collar === "uniform") {
    const b1 = at(0.12, -wh), b2 = at(0.12, wh + belly);
    ctx.strokeStyle = "#3b2a17";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(b1[0], b1[1]);
    ctx.lineTo(b2[0], b2[1]);
    ctx.stroke();
  }
  // Shirt / collar on the front side
  const vL = at(1, ws * 0.05);
  const vR = at(1, ws * 0.75);
  const vBottom = at(look.collar === "tie" ? 0.55 : 0.7, ws * 0.42);
  if (look.collar === "tie" || look.collar === "blouse" || look.collar === "open" || look.collar === "uniform") {
    blob(ctx, () => {
      ctx.moveTo(vL[0], vL[1]);
      ctx.lineTo(vR[0], vR[1]);
      ctx.lineTo(vBottom[0], vBottom[1]);
      ctx.closePath();
    }, look.shirt, 2);
    if (look.tie) {
      const tl = look.tieLong ? 0.02 : 0.25;
      const t1 = at(0.98, ws * 0.36), t2 = at(0.88, ws * 0.28), t3 = at(tl, ws * 0.38 + belly * 0.6), t4 = at(0.88, ws * 0.5);
      blob(ctx, () => {
        ctx.moveTo(t1[0], t1[1]);
        ctx.lineTo(t2[0], t2[1]);
        ctx.lineTo(t3[0] - 3, t3[1]);
        ctx.lineTo(t3[0] + 2, t3[1] + 5);
        ctx.lineTo(t3[0] + 6, t3[1]);
        ctx.lineTo(t4[0], t4[1]);
        ctx.closePath();
      }, look.tie, 1.5);
    }
    // Lapels
    ctx.strokeStyle = shade(look.suit, -0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(vL[0], vL[1]);
    ctx.lineTo(vBottom[0] - 2, vBottom[1] + 2);
    ctx.lineTo(at(0.2, ws * 0.3)[0], at(0.2, ws * 0.3)[1]);
    ctx.stroke();
  } else if (look.collar === "mao") {
    ctx.strokeStyle = shade(look.suit, 0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const c1 = at(0.98, 0), c2 = at(0.98, ws * 0.8);
    ctx.moveTo(c1[0], c1[1]);
    ctx.lineTo(c2[0], c2[1]);
    const z1 = at(0.95, ws * 0.5), z2 = at(0.08, ws * 0.55);
    ctx.moveTo(z1[0], z1[1]);
    ctx.lineTo(z2[0], z2[1]);
    ctx.stroke();
  } else if (look.collar === "tshirt") {
    ctx.strokeStyle = shade(look.suit, -0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const c = at(0.98, ws * 0.4);
    ctx.arc(c[0], c[1], 6, 0, Math.PI);
    ctx.stroke();
  }
  const pin = at(0.78, ws * 0.12);
  if (look.extras.includes("redBadge")) {
    blob(ctx, () => {
      ctx.moveTo(pin[0] - 4, pin[1] - 4);
      ctx.lineTo(pin[0] + 4, pin[1] - 4);
      ctx.lineTo(pin[0], pin[1] + 4);
      ctx.closePath();
    }, "#d11a2a", 1);
  }
  if (look.extras.includes("lapelFlag")) {
    ctx.fillStyle = "#1d4fb8";
    ctx.fillRect(pin[0] - 4, pin[1] - 3, 3, 6);
    ctx.fillStyle = "#fff";
    ctx.fillRect(pin[0] - 1, pin[1] - 3, 3, 6);
    ctx.fillStyle = "#d11a2a";
    ctx.fillRect(pin[0] + 2, pin[1] - 3, 3, 6);
  }
  if (look.extras.includes("medals")) {
    const m = at(0.7, ws * 0.15);
    ["#d4a017", "#c8102e", "#2a5bd7"].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(m[0] - 8 + i * 6, m[1] - 3, 5, 7);
    });
  }
  if (look.extras.includes("pearls")) {
    ctx.fillStyle = "#fbf6ea";
    for (let i = 0; i < 6; i++) {
      const q = at(0.96 - Math.sin((i / 5) * Math.PI) * 0.1, ws * (0.1 + i * 0.13));
      ctx.beginPath();
      ctx.arc(q[0], q[1], 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (look.extras.includes("euStars")) {
    ctx.fillStyle = "#ffd400";
    const c = at(0.6, ws * 0.1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.fillRect(c[0] + Math.cos(a) * 7 - 1, c[1] + Math.sin(a) * 7 - 1, 2.5, 2.5);
    }
  }
}

// ---------------------------------------------------------------- head

function hairBack(ctx: CanvasRenderingContext2D, look: Look, fw: number, fh: number) {
  const c = look.hair;
  switch (look.hairStyle) {
    case "blondVolume":
      blob(ctx, () => {
        ctx.moveTo(-fw * 0.2, -fh * 1.05);
        ctx.bezierCurveTo(-fw * 1.6, -fh * 0.9, -fw * 1.5, fh * 0.8, -fw * 1.1, fh * 1.25);
        ctx.quadraticCurveTo(-fw * 0.4, fh * 1.35, -fw * 0.2, fh * 0.6);
        ctx.lineTo(fw * 0.3, -fh * 0.3);
        ctx.closePath();
      }, c);
      break;
    case "bobDark":
    case "bobBlond":
    case "blondBobLayered":
      blob(ctx, () => {
        ctx.moveTo(fw * 0.3, -fh * 1.0);
        ctx.bezierCurveTo(-fw * 1.5, -fh * 1.15, -fw * 1.45, fh * 0.3, -fw * 1.15, fh * (look.hairStyle === "blondBobLayered" ? 1.05 : 0.8));
        ctx.lineTo(-fw * 0.2, fh * 0.85);
        ctx.lineTo(fw * 0.2, -fh * 0.2);
        ctx.closePath();
      }, c);
      break;
    case "longBrown":
      blob(ctx, () => {
        ctx.moveTo(fw * 0.3, -fh * 1.0);
        ctx.bezierCurveTo(-fw * 1.4, -fh * 1.1, -fw * 1.4, fh * 1.4, -fw * 0.9, fh * 2.1);
        ctx.lineTo(-fw * 0.1, fh * 1.6);
        ctx.lineTo(fw * 0.2, -fh * 0.2);
        ctx.closePath();
      }, c);
      break;
    default:
      break;
  }
}

function hairFront(ctx: CanvasRenderingContext2D, look: Look, fw: number, fh: number) {
  const c = look.hair;
  const hi = shade(c, 0.18);
  switch (look.hairStyle) {
    case "sidePart": // Short, thick, combed to the side with a soft quiff.
      blob(ctx, () => {
        ctx.moveTo(-fw * 1.02, fh * 0.15);
        ctx.bezierCurveTo(-fw * 1.15, -fh * 0.9, -fw * 0.2, -fh * 1.28, fw * 0.55, -fh * 1.02);
        ctx.quadraticCurveTo(fw * 1.05, -fh * 0.82, fw * 0.9, -fh * 0.52);
        ctx.quadraticCurveTo(fw * 0.4, -fh * 0.75, -fw * 0.05, -fh * 0.62);
        ctx.quadraticCurveTo(-fw * 0.45, -fh * 0.5, -fw * 0.55, -fh * 0.1);
        ctx.lineTo(-fw * 0.62, fh * 0.15);
        ctx.closePath();
      }, c);
      ctx.strokeStyle = hi;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-fw * 0.3, -fh * 1.05);
      ctx.quadraticCurveTo(fw * 0.3, -fh * 1.0, fw * 0.75, -fh * 0.7);
      ctx.stroke();
      break;
    case "blondVolume":
      blob(ctx, () => {
        ctx.moveTo(-fw * 1.1, fh * 0.2);
        ctx.bezierCurveTo(-fw * 1.3, -fh * 1.2, fw * 0.6, -fh * 1.45, fw * 1.15, -fh * 0.55);
        ctx.quadraticCurveTo(fw * 1.2, -fh * 0.1, fw * 1.0, fh * 0.15);
        ctx.quadraticCurveTo(fw * 0.85, -fh * 0.55, fw * 0.1, -fh * 0.55);
        ctx.quadraticCurveTo(-fw * 0.5, -fh * 0.4, -fw * 0.55, fh * 0.2);
        ctx.closePath();
      }, c);
      ctx.strokeStyle = hi;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-fw * 0.6, -fh * 0.9);
      ctx.quadraticCurveTo(fw * 0.4, -fh * 1.1, fw * 1.0, -fh * 0.4);
      ctx.stroke();
      break;
    case "whiteBack": // Receding, combed back, white.
      blob(ctx, () => {
        ctx.moveTo(-fw * 1.02, fh * 0.2);
        ctx.bezierCurveTo(-fw * 1.15, -fh * 0.85, -fw * 0.4, -fh * 1.18, fw * 0.1, -fh * 1.0);
        ctx.quadraticCurveTo(-fw * 0.2, -fh * 0.82, -fw * 0.4, -fh * 0.45);
        ctx.quadraticCurveTo(-fw * 0.5, -fh * 0.1, -fw * 0.55, fh * 0.2);
        ctx.closePath();
      }, c);
      ctx.strokeStyle = shade(c, -0.2);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-fw * (0.1 + i * 0.25), -fh * (0.98 - i * 0.05));
        ctx.quadraticCurveTo(-fw * (0.6 + i * 0.15), -fh * 0.8, -fw * (0.9 + i * 0.05), -fh * 0.2);
        ctx.stroke();
      }
      break;
    case "shortReceding":
      blob(ctx, () => {
        ctx.moveTo(-fw * 1.0, fh * 0.1);
        ctx.bezierCurveTo(-fw * 1.1, -fh * 0.95, -fw * 0.1, -fh * 1.18, fw * 0.55, -fh * 0.95);
        ctx.lineTo(fw * 0.45, -fh * 0.7);
        ctx.lineTo(fw * 0.15, -fh * 0.82);
        ctx.quadraticCurveTo(-fw * 0.3, -fh * 0.6, -fw * 0.5, -fh * 0.3);
        ctx.lineTo(-fw * 0.58, fh * 0.1);
        ctx.closePath();
      }, c);
      break;
    case "baldSides":
      blob(ctx, () => {
        ctx.moveTo(-fw * 1.02, fh * 0.25);
        ctx.quadraticCurveTo(-fw * 1.12, -fh * 0.55, -fw * 0.6, -fh * 0.82);
        ctx.quadraticCurveTo(-fw * 0.7, -fh * 0.3, -fw * 0.45, -fh * 0.05);
        ctx.lineTo(-fw * 0.55, fh * 0.25);
        ctx.closePath();
      }, c);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(fw * 0.05, -fh * 0.82, fw * 0.3, fh * 0.1, -0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "slickBack":
      blob(ctx, () => {
        ctx.moveTo(-fw * 1.02, fh * 0.15);
        ctx.bezierCurveTo(-fw * 1.15, -fh * 0.9, -fw * 0.3, -fh * 1.2, fw * 0.45, -fh * 0.98);
        ctx.quadraticCurveTo(fw * 0.1, -fh * 0.82, -fw * 0.25, -fh * 0.72);
        ctx.quadraticCurveTo(-fw * 0.55, -fh * 0.4, -fw * 0.55, fh * 0.15);
        ctx.closePath();
      }, c);
      ctx.strokeStyle = hi;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fw * 0.3, -fh * 0.98);
      ctx.quadraticCurveTo(-fw * 0.4, -fh * 1.05, -fw * 0.95, -fh * 0.35);
      ctx.stroke();
      break;
    case "shortGrey":
      blob(ctx, () => {
        ctx.moveTo(-fw * 1.0, fh * 0.15);
        ctx.quadraticCurveTo(-fw * 1.05, -fh * 0.55, -fw * 0.5, -fh * 0.6);
        ctx.lineTo(-fw * 0.5, fh * 0.15);
        ctx.closePath();
      }, c);
      break;
    case "bobDark":
    case "bobBlond":
    case "blondBobLayered":
    case "updoBlond": {
      const straight = look.hairStyle === "bobBlond";
      blob(ctx, () => {
        ctx.moveTo(-fw * 1.1, fh * 0.55);
        ctx.bezierCurveTo(-fw * 1.35, -fh * 1.0, fw * 0.5, -fh * 1.45, fw * 1.15, -fh * 0.5);
        if (straight) {
          // Straight fringe at brow level.
          ctx.lineTo(fw * 1.12, -fh * 0.32);
          ctx.lineTo(-fw * 0.1, -fh * 0.36);
        } else {
          ctx.quadraticCurveTo(fw * 0.7, -fh * 0.75, fw * 0.1, -fh * 0.55);
          ctx.quadraticCurveTo(-fw * 0.3, -fh * 0.3, -fw * 0.45, fh * 0.1);
        }
        ctx.lineTo(-fw * 0.55, fh * 0.55);
        ctx.closePath();
      }, c);
      ctx.strokeStyle = hi;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-fw * 0.8, -fh * 0.8);
      ctx.quadraticCurveTo(0, -fh * 1.15, fw * 0.8, -fh * 0.65);
      ctx.stroke();
      if (look.hairStyle === "updoBlond") {
        blob(ctx, () => ctx.ellipse(-fw * 1.0, -fh * 0.5, fw * 0.32, fh * 0.26, -0.4, 0, Math.PI * 2), c, 2);
      }
      break;
    }
    case "swoop": // The legendary comb-over swoop.
      blob(ctx, () => {
        ctx.moveTo(-fw * 1.08, fh * 0.1);
        ctx.bezierCurveTo(-fw * 1.3, -fh * 1.0, -fw * 0.2, -fh * 1.35, fw * 0.8, -fh * 1.05);
        ctx.quadraticCurveTo(fw * 1.45, -fh * 0.85, fw * 1.25, -fh * 0.45);
        ctx.quadraticCurveTo(fw * 0.95, -fh * 0.7, fw * 0.45, -fh * 0.62);
        ctx.quadraticCurveTo(-fw * 0.2, -fh * 0.55, -fw * 0.5, -fh * 0.2);
        ctx.lineTo(-fw * 0.6, fh * 0.1);
        ctx.closePath();
      }, c);
      ctx.strokeStyle = shade(c, -0.18);
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-fw * (0.9 - i * 0.1), -fh * (0.5 + i * 0.12));
        ctx.quadraticCurveTo(fw * 0.2, -fh * (1.2 - i * 0.05), fw * (1.15 - i * 0.1), -fh * (0.55 + i * 0.05));
        ctx.stroke();
      }
      break;
    case "thinBald":
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(-fw * (0.95 - i * 0.04), fh * 0.1 - i * 4);
        ctx.quadraticCurveTo(-fw * (1.0 - i * 0.05), -fh * 0.5, -fw * (0.55 - i * 0.12), -fh * (0.75 + i * 0.03));
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.ellipse(fw * 0.1, -fh * 0.82, fw * 0.32, fh * 0.1, -0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "blackBack":
      blob(ctx, () => {
        ctx.moveTo(-fw * 1.04, fh * 0.15);
        ctx.bezierCurveTo(-fw * 1.2, -fh * 1.15, fw * 0.1, -fh * 1.45, fw * 0.75, -fh * 0.95);
        ctx.quadraticCurveTo(fw * 0.4, -fh * 0.8, -fw * 0.1, -fh * 0.78);
        ctx.quadraticCurveTo(-fw * 0.5, -fh * 0.5, -fw * 0.55, fh * 0.15);
        ctx.closePath();
      }, c);
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(fw * (0.6 - i * 0.2), -fh * (0.95 + i * 0.05));
        ctx.quadraticCurveTo(-fw * 0.3, -fh * (1.2 - i * 0.05), -fw * 0.95, -fh * (0.3 + i * 0.1));
        ctx.stroke();
      }
      break;
    case "slickDark":
      blob(ctx, () => {
        ctx.moveTo(-fw * 1.02, fh * 0.1);
        ctx.bezierCurveTo(-fw * 1.1, -fh * 1.0, -fw * 0.1, -fh * 1.25, fw * 0.75, -fh * 0.9);
        ctx.quadraticCurveTo(fw * 0.85, -fh * 0.65, fw * 0.6, -fh * 0.62);
        ctx.quadraticCurveTo(0, -fh * 0.72, -fw * 0.5, -fh * 0.25);
        ctx.lineTo(-fw * 0.58, fh * 0.1);
        ctx.closePath();
      }, c);
      break;
    case "longBrown":
      blob(ctx, () => {
        ctx.moveTo(-fw * 1.1, fh * 0.6);
        ctx.bezierCurveTo(-fw * 1.3, -fh * 1.1, fw * 0.6, -fh * 1.4, fw * 1.1, -fh * 0.3);
        ctx.quadraticCurveTo(fw * 0.6, -fh * 0.75, -fw * 0.1, -fh * 0.6);
        ctx.quadraticCurveTo(-fw * 0.5, -fh * 0.2, -fw * 0.55, fh * 0.6);
        ctx.closePath();
      }, c);
      break;
    case "greyHelmet":
      blob(ctx, () => {
        ctx.moveTo(-fw * 1.15, fh * 0.2);
        ctx.bezierCurveTo(-fw * 1.4, -fh * 1.3, fw * 0.9, -fh * 1.5, fw * 1.1, -fh * 0.45);
        ctx.quadraticCurveTo(fw * 0.6, -fh * 0.7, -fw * 0.2, -fh * 0.55);
        ctx.quadraticCurveTo(-fw * 0.5, -fh * 0.2, -fw * 0.55, fh * 0.2);
        ctx.closePath();
      }, c);
      break;
    case "shortMessy":
      blob(ctx, () => {
        ctx.moveTo(-fw * 1.0, fh * 0.1);
        ctx.lineTo(-fw * 1.1, -fh * 0.6);
        ctx.lineTo(-fw * 0.7, -fh * 1.05);
        ctx.lineTo(-fw * 0.3, -fh * 1.1);
        ctx.lineTo(fw * 0.1, -fh * 1.2);
        ctx.lineTo(fw * 0.5, -fh * 1.05);
        ctx.lineTo(fw * 0.85, -fh * 0.75);
        ctx.lineTo(fw * 0.5, -fh * 0.68);
        ctx.lineTo(0, -fh * 0.7);
        ctx.lineTo(-fw * 0.5, -fh * 0.3);
        ctx.lineTo(-fw * 0.58, fh * 0.1);
        ctx.closePath();
      }, c);
      break;
    case "none":
      break;
  }
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: Look, expr: Expr, far: boolean) {
  if (expr === "ko") {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.stroke();
    return;
  }
  if (expr === "hurt") {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r * 0.7);
    ctx.lineTo(x + r * 0.6, y);
    ctx.lineTo(x - r, y + r * 0.7);
    ctx.stroke();
    return;
  }
  const squint = look.extras.includes("squint") || expr === "focus";
  const ry = (squint ? 0.55 : expr === "happy" ? 0.7 : 0.85) * r;
  if (look.extras.includes("tanlines")) {
    ctx.fillStyle = "#f6e2c8";
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  blob(ctx, () => ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2), "#ffffff", 2);
  const ix = x + r * 0.35 * (far ? 1 : 0.6);
  ctx.fillStyle = look.eye;
  ctx.beginPath();
  ctx.arc(ix, y, Math.min(r * 0.55, ry), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(ix, y, Math.min(r * 0.28, ry * 0.6), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(ix - 1, y - 2, 1.6, 1.6);
}

export function drawHead(ctx: CanvasRenderingContext2D, look: Look, expr: Expr) {
  const { w: fw, h: fh, jaw, chin } = look.face;
  hairBack(ctx, look, fw, fh);
  // Face: cranium + jaw drawn as one outlined shape.
  const cranium = () => ctx.ellipse(0, -4, fw, fh * 0.88, 0, 0, Math.PI * 2);
  const jawPath = () => {
    ctx.moveTo(-fw * 0.92, 2);
    ctx.quadraticCurveTo(-fw * 0.7 * jaw, fh * 0.9 * chin, fw * 0.25, fh * chin);
    ctx.quadraticCurveTo(fw * 0.9 * jaw + 2, fh * 0.85 * chin, fw * 0.98, -2);
    ctx.closePath();
  };
  ctx.lineWidth = 4;
  ctx.strokeStyle = OUT;
  ctx.fillStyle = look.skin;
  for (const shape of [cranium, jawPath]) {
    ctx.beginPath();
    shape();
    ctx.stroke();
  }
  for (const shape of [cranium, jawPath]) {
    ctx.beginPath();
    shape();
    ctx.fill();
  }
  const er = look.ears;
  blob(ctx, () => ctx.ellipse(-fw * 0.5, 3, 5 * er, 8 * er, 0.15, 0, Math.PI * 2), look.skin, 2.5);
  ctx.strokeStyle = "rgba(120,60,40,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-fw * 0.5, 3, 3 * er, -1.2, 1.2);
  ctx.stroke();
  if (look.extras.includes("cheeks")) {
    ctx.fillStyle = "rgba(230,110,110,0.35)";
    ctx.beginPath();
    ctx.ellipse(fw * 0.05, fh * 0.32, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (look.extras.includes("wrinkles")) {
    ctx.strokeStyle = "rgba(90,50,30,0.45)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-fw * 0.1, -fh * 0.48);
    ctx.quadraticCurveTo(fw * 0.35, -fh * 0.55, fw * 0.75, -fh * 0.46);
    ctx.moveTo(fw * 0.4, fh * 0.12);
    ctx.quadraticCurveTo(fw * 0.25, fh * 0.35, fw * 0.32, fh * 0.55);
    ctx.stroke();
  }
  // Eyes
  const ey = -fh * 0.12;
  const er2 = 5.2;
  eye(ctx, fw * 0.12, ey, er2, look, expr, false);
  eye(ctx, fw * 0.68, ey, er2 * 0.8, look, expr, true);
  // Brows
  const frown = look.extras.includes("frown") || expr === "shout" || expr === "focus";
  const raise = expr === "hurt" ? -4 : 0;
  ctx.strokeStyle = look.brow;
  ctx.lineCap = "round";
  ctx.lineWidth = look.browThick;
  ctx.beginPath();
  ctx.moveTo(fw * 0.12 - 7, ey - 8 + raise);
  ctx.lineTo(fw * 0.12 + 6, ey - 8 + (frown ? 3 : -1) + raise);
  ctx.moveTo(fw * 0.68 - 4, ey - 8 + (frown ? 3 : -1) + raise);
  ctx.lineTo(fw * 0.68 + 6, ey - 9 + raise);
  ctx.stroke();
  // Glasses
  if (look.extras.includes("glassesRect") || look.extras.includes("glassesBig")) {
    const big = look.extras.includes("glassesBig");
    ctx.strokeStyle = big ? "#5a3b26" : "#2a2a2a";
    ctx.lineWidth = big ? 2.5 : 1.8;
    const gw = big ? 9 : 8, gh = big ? 8 : 5.5;
    ctx.beginPath();
    if (big) {
      ctx.ellipse(fw * 0.12, ey, gw, gh, 0, 0, Math.PI * 2);
      ctx.moveTo(fw * 0.68 + gw * 0.8, ey);
      ctx.ellipse(fw * 0.68, ey, gw * 0.8, gh, 0, 0, Math.PI * 2);
    } else {
      ctx.rect(fw * 0.12 - gw, ey - gh, gw * 2, gh * 2);
      ctx.rect(fw * 0.68 - gw * 0.75, ey - gh, gw * 1.5, gh * 2);
    }
    ctx.moveTo(fw * 0.12 + gw, ey - 1);
    ctx.lineTo(fw * 0.68 - gw * 0.75, ey - 1);
    ctx.moveTo(fw * 0.12 - gw, ey - 1);
    ctx.lineTo(-fw * 0.42, ey + 2);
    ctx.stroke();
  }
  // Nose
  const n = look.nose;
  const nl = look.noseLong ?? 1;
  blob(ctx, () => {
    ctx.moveTo(fw * 0.5, ey + 1);
    ctx.quadraticCurveTo(fw * 0.85 + 7 * n * nl, ey + 6 * n, fw * 0.8 + 6 * n * nl, ey + 12 * n);
    ctx.quadraticCurveTo(fw * 0.7, ey + 14 * n, fw * 0.5, ey + 11 * n);
  }, look.skin, 2.5);
  // Mustache
  const my = Math.max(fh * 0.42, ey + 13 * n + 4);
  if (look.extras.includes("mustache")) {
    blob(ctx, () => ctx.ellipse(fw * 0.55, my - 4, 9, 3.5, 0, 0, Math.PI * 2), "#3d3d3d", 1.5);
  }
  // Mouth
  const mw = 10 * look.mouth;
  const mx = fw * 0.5;
  ctx.lineCap = "round";
  if (expr === "shout" || expr === "hurt" || expr === "ko") {
    blob(ctx, () => ctx.ellipse(mx, my + 2, mw * 0.55, expr === "shout" ? 7 : 4.5, 0, 0, Math.PI * 2), "#5a1414", 2);
    if (expr === "shout") {
      ctx.fillStyle = "#e86a6a";
      ctx.beginPath();
      ctx.ellipse(mx, my + 6, mw * 0.3, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (look.extras.includes("pout") && expr !== "happy") {
    blob(ctx, () => ctx.ellipse(mx + 2, my, 4, 3.2, 0, 0, Math.PI * 2), "#b3524a", 1.5);
  } else if (look.extras.includes("grin") || expr === "happy") {
    blob(ctx, () => {
      ctx.moveTo(mx - mw * 0.7, my - 2);
      ctx.quadraticCurveTo(mx, my - 1, mx + mw * 0.6, my - 3);
      ctx.quadraticCurveTo(mx + mw * 0.2, my + 8, mx - mw * 0.7, my - 2);
    }, "#ffffff", 2);
  } else {
    const down = look.extras.includes("frown") ? 3 : -2;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(mx - mw * 0.6, my + down * 0.3);
    ctx.quadraticCurveTo(mx, my - down, mx + mw * 0.5, my + down * 0.3);
    ctx.stroke();
  }
  if (look.extras.includes("bigChin")) {
    ctx.strokeStyle = "rgba(90,50,30,0.4)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(fw * 0.3, fh * chin - 6);
    ctx.lineTo(fw * 0.32, fh * chin - 1);
    ctx.stroke();
  }
  if (look.extras.includes("earrings")) {
    blob(ctx, () => ctx.arc(-fw * 0.5, 13, 3, 0, Math.PI * 2), "#f7f1e1", 1.5);
  }
  hairFront(ctx, look, fw, fh);
  // Hats
  if (look.extras.includes("kepi")) {
    ctx.save();
    ctx.translate(0, -fh * 0.78);
    ctx.rotate(-0.08);
    blob(ctx, () => ctx.rect(-fw * 0.95, -fh * 0.55, fw * 1.85, fh * 0.6), "#4d5a2a", 3);
    ctx.fillStyle = "#2d331a";
    ctx.fillRect(-fw * 0.95, -fh * 0.55, fw * 1.85, 6);
    ctx.fillStyle = "#d9b23a";
    ctx.fillRect(-fw * 0.95, -fh * 0.05 - 7, fw * 1.85, 4);
    ctx.fillStyle = "#ffd94a";
    for (const sx of [0.1, 0.45]) {
      ctx.beginPath();
      ctx.arc(fw * sx, -fh * 0.3, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    blob(ctx, () => {
      ctx.moveTo(fw * 0.35, 0);
      ctx.quadraticCurveTo(fw * 1.3, 2, fw * 1.35, 8);
      ctx.lineTo(fw * 0.4, 6);
      ctx.closePath();
    }, "#1d1f12", 2);
    ctx.restore();
  }
  if (look.extras.includes("beret")) {
    blob(ctx, () => ctx.ellipse(-fw * 0.05, -fh * 0.95, fw * 1.05, fh * 0.32, -0.15, 0, Math.PI * 2), "#1a1a1a", 2.5);
  }
  if (look.extras.includes("hood")) {
    blob(ctx, () => {
      ctx.moveTo(fw * 0.9, fh * 0.9);
      ctx.bezierCurveTo(fw * 1.4, -fh * 1.4, -fw * 1.8, -fh * 1.6, -fw * 1.2, fh * 1.1);
      ctx.lineTo(-fw * 0.6, fh * 1.0);
      ctx.bezierCurveTo(-fw * 1.0, -fh * 0.6, fw * 0.6, -fh * 1.0, fw * 0.75, fh * 0.6);
      ctx.closePath();
    }, look.suit, 3);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(fw * 0.2, -fh * 0.3, fw * 0.9, fh * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- whole body

export interface DrawOpts {
  x: number;
  y: number;
  facing: 1 | -1;
  scale: number;
  alpha?: number;
}

export function drawPerson(ctx: CanvasRenderingContext2D, look: Look, pose: Pose, o: DrawOpts) {
  const s = o.scale * look.height;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(o.facing * s, s);
  if (look.alpha !== undefined || o.alpha !== undefined) ctx.globalAlpha = (look.alpha ?? 1) * (o.alpha ?? 1);
  const j = solve(pose);
  if (pose.rot) {
    ctx.translate(0, j.hip[1]);
    ctx.rotate(pose.rot);
    ctx.translate(0, -j.hip[1]);
  }
  arm(ctx, look, j, pose, false);
  leg(ctx, look, j, 0);
  leg(ctx, look, j, 1);
  torso(ctx, look, j, pose);
  // Neck + head
  const [nx, ny] = j.neck;
  limb(ctx, [[nx, ny + 6], [nx + 1, ny - 4]], 11, look.skin);
  ctx.save();
  ctx.translate(nx + 3, ny - look.face.h * 1.05);
  ctx.rotate(pose.lean * 0.4 + pose.head);
  ctx.scale(HEAD_SCALE, HEAD_SCALE);
  drawHead(ctx, look, pose.expr);
  ctx.restore();
  arm(ctx, look, j, pose, true);
  ctx.restore();
}

/** Portrait: head and shoulders, used in menus and the HUD. */
export function drawBust(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, scale: number, facing: 1 | -1 = 1, expr: Expr = "neutral") {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * scale, scale);
  if (look.alpha !== undefined) ctx.globalAlpha = look.alpha;
  // Shoulders
  blob(ctx, () => {
    ctx.moveTo(-48 * look.width, 70);
    ctx.quadraticCurveTo(-46 * look.width, 22, -6, 20);
    ctx.lineTo(14, 20);
    ctx.quadraticCurveTo(50 * look.width, 22, 52 * look.width, 70);
    ctx.closePath();
  }, look.suit, 3);
  if (look.collar === "tie" || look.collar === "blouse" || look.collar === "open" || look.collar === "uniform") {
    blob(ctx, () => {
      ctx.moveTo(-4, 20);
      ctx.lineTo(18, 20);
      ctx.lineTo(8, 46);
      ctx.closePath();
    }, look.shirt, 2);
    if (look.tie) {
      blob(ctx, () => {
        ctx.moveTo(4, 21);
        ctx.lineTo(11, 21);
        ctx.lineTo(13, 70);
        ctx.lineTo(4, 70);
        ctx.closePath();
      }, look.tie, 1.5);
    }
  }
  if (look.extras.includes("pearls")) {
    ctx.fillStyle = "#fbf6ea";
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(-10 + i * 5, 24 + Math.sin((i / 6) * Math.PI) * 8, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (look.extras.includes("redBadge")) {
    ctx.fillStyle = "#d11a2a";
    ctx.beginPath();
    ctx.moveTo(-26, 36);
    ctx.lineTo(-18, 36);
    ctx.lineTo(-22, 44);
    ctx.fill();
  }
  limb(ctx, [[4, 24], [4, 10]], 14, look.skin);
  ctx.translate(4, -18);
  drawHead(ctx, look, expr);
  ctx.restore();
}
