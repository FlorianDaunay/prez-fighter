/** Maps a fighter's state to a pose of the caricature rig. */
import { ROSTER } from "@/core/roster";
import type { Fighter, MoveDef } from "@/core/types";
import { STANCE, type Pose } from "./person";

type P = Partial<Pose>;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp2 = (a: [number, number], b: [number, number], t: number): [number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

export function blend(base: Pose, target: P, t: number): Pose {
  return {
    lean: lerp(base.lean, target.lean ?? base.lean, t),
    rot: lerp(base.rot, target.rot ?? base.rot, t),
    armF: lerp2(base.armF, target.armF ?? base.armF, t),
    armB: lerp2(base.armB, target.armB ?? base.armB, t),
    legF: lerp2(base.legF, target.legF ?? base.legF, t),
    legB: lerp2(base.legB, target.legB ?? base.legB, t),
    head: lerp(base.head, target.head ?? base.head, t),
    squash: lerp(base.squash, target.squash ?? base.squash, t),
    lift: lerp(base.lift ?? 0, target.lift ?? base.lift ?? 0, t),
    expr: t > 0.3 ? target.expr ?? base.expr : base.expr,
    shirtless: target.shirtless ?? base.shirtless,
  };
}

const CROUCH: P = { legF: [1.3, 2.3], legB: [0.4, 1.9], lean: 0.25, armF: [0.7, 1.9], armB: [0.5, 2.0] };
const AIR: P = { legF: [1.1, 1.9], legB: [0.5, 1.7], armF: [1.2, 1.0], armB: [0.9, 1.2] };
const BLOCK_ARMS: P = { armF: [0.95, 2.35], armB: [0.75, 2.45], lean: -0.05, expr: "focus" };

const POSES: Record<string, P> = {
  jab: { armF: [1.55, 0.05], armB: [0.35, 2.0], lean: 0.18, expr: "focus" },
  kick: { legF: [1.65, 0.05], legB: [-0.12, 0.1], lean: -0.25, armF: [0.9, 1.6], armB: [-0.6, 1.2], expr: "focus" },
  crouchJab: { ...CROUCH, armF: [1.5, 0.05], expr: "focus" },
  sweep: { ...CROUCH, legF: [1.52, 0.02], lean: 0.3, armB: [-0.3, 0.8], expr: "focus" },
  airKick: { ...AIR, legF: [1.05, 0.15], legB: [0.4, 1.7], expr: "focus" },
  airPunch: { ...AIR, armF: [1.0, 0.1], lean: 0.3, expr: "focus" },
  grab: { armF: [1.45, 0.3], armB: [1.3, 0.45], lean: 0.25, expr: "focus" },
  throw: { armF: [1.45, 0.05], armB: [-0.4, 0.8], lean: 0.2, expr: "shout" },
  dash: { lean: 0.45, armF: [1.6, 0.1], armB: [-0.5, 0.6], legF: [0.9, 0.8], legB: [-0.7, 0.5], expr: "shout" },
  uppercut: { armF: [2.6, 0.35], armB: [0.2, 1.4], lean: -0.1, legF: [0.9, 1.4], legB: [0.1, 0.6], expr: "shout" },
  both: { armF: [1.55, 0.05], armB: [-1.55, 0.05], lean: 0, legF: [0.5, 0.2], legB: [-0.5, 0.2], expr: "shout" },
  shout: { lean: -0.22, armF: [2.3, 0.3], armB: [-2.2, 0.3], head: -0.15, expr: "shout" },
  raise: { armF: [2.6, 0.2], armB: [0.3, 1.6], head: -0.1, expr: "shout" },
  decree: { armF: [2.65, 0.15], armB: [0.65, 2.2], head: -0.15, lean: -0.05, expr: "focus" },
  build: { armF: [1.25, 0.2], armB: [1.15, 0.3], lean: 0.4, legF: [0.6, 0.9], legB: [-0.2, 0.6], expr: "focus" },
  stomp: { legF: [0.25, 0.05], legB: [-0.45, 0.2], lean: -0.1, armF: [-0.4, 0.4], armB: [0.6, 0.4], expr: "shout" },
  flurry: { armF: [1.55, 0.1], armB: [1.4, 0.3], lean: 0.25, expr: "shout" },
  wobble: { lean: 0, armF: [0.3, 0.5], armB: [-0.3, 0.5], expr: "focus" },
  hug: { armF: [1.75, -0.35], armB: [1.55, -0.25], lean: 0.35, expr: "happy" },
  vArms: { armF: [2.65, 0.05], armB: [-2.65, 0.05], head: -0.1, expr: "shout" },
  sumo: { legF: [0.75, 0.6], legB: [-0.75, 0.6], armF: [1.5, 0.15], armB: [1.4, 0.3], lean: 0.35, expr: "shout" },
  flex: { armF: [1.57, 1.6], armB: [-1.57, -1.6], lean: -0.05, shirtless: true, expr: "focus" },
  raute: { armF: [0.42, 1.3], armB: [0.62, 1.15], lean: 0, expr: "neutral" },
};

/** Key frames of a move: when it starts hurting and when it stops. */
function window(def: MoveDef): [number, number] {
  let a = Infinity;
  let b = 0;
  for (const h of def.hitboxes ?? []) {
    a = Math.min(a, h.from);
    b = Math.max(b, h.to);
  }
  for (const p of def.projectiles ?? []) {
    a = Math.min(a, p.frame);
    b = Math.max(b, p.frame + (p.count ?? 1) * (p.interval ?? 0) + 4);
  }
  if (def.wall) {
    a = Math.min(a, def.wall.frame);
    b = Math.max(b, def.wall.frame + 8);
  }
  if (def.counter) {
    a = Math.min(a, def.counter[0]);
    b = Math.max(b, def.counter[1]);
  }
  if (a === Infinity) return [Math.floor(def.frames * 0.3), Math.floor(def.frames * 0.6)];
  return [a, Math.min(def.frames - 1, b)];
}

/** 0 → 1 during startup, 1 while active, back to 0 during recovery. */
export function extension(def: MoveDef, mf: number): number {
  const [a, b] = window(def);
  if (mf < a) return Math.min(1, (mf + 1) / Math.max(1, a));
  if (mf <= b) return 1;
  return Math.max(0, 1 - (mf - b) / Math.max(1, def.frames - b));
}

function winPose(charId: string, t: number): P {
  const bob = Math.sin(t * 0.15) * 0.1;
  switch (charId) {
    case "merguez":
      return POSES.raute;
    case "degaufre":
      return POSES.vArms;
    case "poutrine":
      return POSES.flex;
    case "tromp":
      return { armF: [1.4, 1.5 + bob], armB: [-1.2, 1.2], expr: "happy", lean: -0.1 };
    case "macaron":
      return { armF: [2.2, 0.2 + bob], armB: [-2.2, 0.2], expr: "happy" };
    case "meluchon":
      return { ...POSES.shout, expr: "shout" };
    default:
      return { armF: [2.6, 0.3 + bob], armB: [0.5, 2.2], expr: "happy", head: -0.1 };
  }
}

export function fighterPose(f: Fighter, t: number): Pose {
  const char = ROSTER[f.char];
  const s = f.stateFrame;
  const frozen = (f.status.freeze ?? 0) > 0;
  const stunned = (f.status.stun ?? 0) > 0;
  const breathe = Math.sin(t * 0.11 + f.char) * 0.04;
  let base: Pose = { ...STANCE, armF: [STANCE.armF[0] + breathe, STANCE.armF[1]], squash: 1 + breathe * 0.25 };
  if (frozen) return base;
  if (stunned && (f.state === "idle" || f.state === "walk" || f.state === "crouch")) {
    return blend(base, { lean: Math.sin(t * 0.18) * 0.25, head: Math.sin(t * 0.18 + 1) * 0.3, armF: [0.2, 0.3], armB: [-0.2, 0.3], expr: "hurt" }, 1);
  }
  switch (f.state) {
    case "intro":
    case "idle":
      return base;
    case "walk": {
      const ph = Math.sin(s * 0.2);
      const k = Math.max(0, Math.cos(s * 0.2));
      return blend(base, { legF: [0.15 + ph * 0.45, 0.25 + k * 0.5], legB: [-0.15 - ph * 0.45, 0.25 + (1 - k) * 0.5], lean: 0.14 }, 1);
    }
    case "crouch":
      return blend(base, CROUCH, Math.min(1, (s + 1) / 4));
    case "jump":
      return blend(base, { ...AIR, rot: f.vx * f.facing > 1 && f.y > 40 ? Math.min(0.0, 0) : 0 }, 1);
    case "blockstun": {
      const crouching = (f.prevInput & 2) !== 0;
      return blend(base, crouching ? { ...CROUCH, ...BLOCK_ARMS, lean: 0.15 } : BLOCK_ARMS, 1);
    }
    case "hitstun": {
      const k = Math.min(1, s / 3);
      return blend(base, { lean: -0.35, head: -0.35, armF: [0.8, 0.6], armB: [-0.7, 0.5], expr: "hurt" }, 1 - k * 0.3);
    }
    case "airHit":
      return blend(base, { rot: -0.9 - Math.min(0.6, s * 0.03), armF: [2.2, 0.4], armB: [-2.0, 0.4], legF: [0.6, 0.4], legB: [0.2, 0.3], head: -0.4, expr: "hurt" }, 1);
    case "knockdown":
      return blend(base, { rot: -Math.PI / 2, legF: [0.15, 0.1], legB: [0.05, 0.05], armF: [0.4, 0.2], armB: [-0.4, 0.2], lift: -55, expr: "ko", lean: 0 }, 1);
    case "getup": {
      const k = Math.min(1, s / 16);
      return blend(base, { rot: -Math.PI / 2, legF: [0.15, 0.1], legB: [0.05, 0.05], lift: -55, expr: "hurt", lean: 0 }, 1 - k);
    }
    case "ko":
      if (f.y > 0) return blend(base, { rot: -1.2 - s * 0.05, armF: [2.4, 0.3], armB: [-2.4, 0.3], expr: "ko" }, 1);
      return blend(base, { rot: -Math.PI / 2, legF: [0.15, 0.1], legB: [0.05, 0.05], armF: [2.6, 0.2], armB: [-0.4, 0.2], lift: -55, expr: "ko", lean: 0 }, 1);
    case "win":
      return blend(base, winPose(char.id, t), Math.min(1, s / 10));
    case "stun":
      return base;
    case "attack": {
      const def = f.move ? char.moves[f.move] : undefined;
      if (!def) return base;
      if (f.move === "jL" || f.move === "jH" || (f.y > 0 && def.pose !== "uppercut")) base = blend(base, AIR, 1);
      if (f.move === "cL" || f.move === "cH") base = blend(base, CROUCH, 1);
      const e = extension(def, f.moveFrame);
      let target: P = POSES[def.pose] ?? POSES.jab;
      if (def.pose === "throw" && f.moveFrame < window(def)[0]) target = { armF: [3.0, 0.6], armB: [0.6, 1.2], lean: -0.15, expr: "shout" };
      if (def.pose === "stomp" && f.moveFrame < window(def)[0]) target = { legF: [1.3, 1.7], legB: [-0.2, 0.2], lean: -0.15, armF: [0.3, 0.6], armB: [-0.3, 0.6], expr: "shout" };
      if (def.pose === "flurry") {
        const a = Math.sin(f.moveFrame * 1.3);
        target = { ...target, armF: [1.55, 0.1 + Math.max(0, a) * 1.2], armB: [1.45, 0.1 + Math.max(0, -a) * 1.2] };
      }
      if (def.pose === "wobble") target = { ...target, squash: 1 + Math.sin(f.moveFrame * 0.9) * 0.12, lean: Math.sin(f.moveFrame * 0.7) * 0.2 };
      const pose = blend(base, target, def.pose === "flex" || def.pose === "raute" || def.pose === "wobble" ? Math.min(1, (f.moveFrame + 1) / 4) : e);
      if (def.shout && f.moveFrame < 30 && pose.expr !== "happy") pose.expr = "shout";
      return pose;
    }
  }
  return base;
}

/** Pose for previews in menus (no Fighter needed). */
export function namedPose(name: string, k = 1): Pose {
  return blend(STANCE, POSES[name] ?? {}, k);
}
