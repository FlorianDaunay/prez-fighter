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
  // Normals by style
  cross: { armF: [1.62, 0.0], armB: [0.6, 1.9], lean: 0.32, legF: [0.55, 0.4], legB: [-0.55, 0.15], expr: "focus" },
  hook: { armF: [1.3, 0.55], armB: [0.5, 1.9], lean: 0.28, head: 0.08, legF: [0.5, 0.4], legB: [-0.45, 0.15], expr: "shout" },
  slap: { armF: [1.35, 0.55], armB: [-0.5, 0.6], lean: 0.18, head: 0.12, expr: "shout" },
  haymaker: { armF: [1.55, -0.2], armB: [-0.6, 0.7], lean: 0.42, legF: [0.6, 0.5], legB: [-0.6, 0.2], expr: "shout" },
  chop: { armF: [1.25, 0.35], armB: [0.4, 1.5], lean: 0.3, head: 0.1, expr: "shout" },
  belly: { lean: -0.38, armF: [-0.55, 0.5], armB: [-0.75, 0.4], legF: [0.55, 0.3], legB: [-0.3, 0.1], squash: 1.06, expr: "shout" },
  sideKick: { legF: [1.78, 0.0], legB: [-0.28, 0.1], lean: -0.5, armF: [0.8, 1.1], armB: [-0.9, 0.6], expr: "focus" },
  knee: { legF: [1.65, 2.6], legB: [-0.15, 0.1], lean: 0.12, armF: [1.3, 1.0], armB: [1.1, 1.2], expr: "shout" },
  elbow: { armF: [1.7, -1.3], armB: [0.3, 1.5], lean: 0.5, head: 0.2, expr: "shout" },
  tackle: { lean: 0.75, head: 0.2, armF: [1.35, 0.35], armB: [1.15, 0.45], legF: [0.95, 1.1], legB: [-0.85, 0.35], expr: "shout" },
  slide: { lean: -0.65, legF: [1.52, 0.0], legB: [1.15, 1.3], armF: [0.2, 0.6], armB: [-1.3, 0.3], expr: "shout" },
  headbutt: { lean: 0.6, head: 0.4, armF: [0.3, 0.4], armB: [-0.45, 0.4], legF: [0.6, 0.5], legB: [-0.55, 0.2], expr: "shout" },
  // Specials
  palm: { armF: [1.55, -0.12], armB: [0.2, 1.3], lean: 0.42, legF: [0.95, 0.65], legB: [-0.65, 0.2], expr: "shout" },
  superman: { armF: [1.6, 0.0], armB: [-1.45, 0.2], legF: [0.35, 0.1], legB: [-0.95, 0.25], lean: 0.6, expr: "shout" },
  point: { armF: [1.72, 0.0], armB: [0.25, 0.35], lean: -0.05, head: -0.1, expr: "shout" },
  clap: { armF: [1.5, 0.65], armB: [1.5, 0.9], lean: 0.05, expr: "happy" },
  bow: { lean: 0.95, head: 0.3, armF: [0.3, 0.2], armB: [-0.3, 0.2], expr: "focus" },
  kneel: { legF: [1.5, 1.55], legB: [0.2, 1.75], lean: 0.1, armF: [1.2, 0.6], armB: [0.5, 1.2], expr: "focus" },
  pray: { legF: [1.5, 1.55], legB: [0.2, 1.75], lean: 0.05, head: -0.2, armF: [1.15, 1.65], armB: [1.1, 1.6], expr: "focus" },
  selfie: { armF: [2.35, 0.45], armB: [0.4, 1.6], head: -0.18, lean: -0.05, expr: "happy" },
  salute: { armF: [2.45, 2.35], armB: [0.1, 0.2], lean: -0.05, head: -0.05, expr: "focus" },
  crossArms: { armF: [0.95, 2.3], armB: [1.0, 2.2], lean: -0.1, head: -0.12, expr: "happy" },
  shrug: { armF: [0.95, 1.65], armB: [0.85, 1.75], head: 0.18, squash: 0.95, expr: "happy" },
  megaphone: { armF: [1.1, 1.95], armB: [-0.4, 0.6], lean: -0.12, head: -0.08, expr: "shout" },
  book: { armF: [1.0, 1.6], armB: [0.9, 1.7], head: 0.25, lean: 0.05, expr: "focus" },
  chainsaw: { armF: [1.45, 0.15], armB: [1.3, 0.38], lean: 0.18, legF: [0.6, 0.5], legB: [-0.6, 0.2], expr: "shout" },
  bigThrow: { armF: [1.6, -0.1], armB: [1.4, 0.0], lean: 0.35, legF: [0.7, 0.5], legB: [-0.6, 0.2], expr: "shout" },
  axeKick: { legF: [1.15, 0.05], legB: [-0.2, 0.1], lean: -0.15, armF: [0.9, 1.4], armB: [-0.8, 0.8], expr: "shout" },
  spin: { armF: [1.57, 0.0], armB: [-1.57, 0.0], lean: 0, expr: "shout" },
  wave: { armF: [2.7, 0.3], armB: [0.3, 1.5], expr: "happy" },
  conduct: { armF: [2.0, 0.5], armB: [1.2, 1.0], head: -0.1, expr: "focus" },
  // Air specials
  dropkick: { legF: [1.62, 0.05], legB: [1.45, 0.15], rot: -0.35, armF: [-0.6, 0.5], armB: [-0.9, 0.5], expr: "shout" },
  diveKick: { legF: [0.75, 0.0], legB: [-0.25, 1.3], lean: -0.3, armF: [2.4, 0.3], armB: [-2.0, 0.4], expr: "shout" },
  bodySlam: { rot: 0.55, lean: 0.3, armF: [1.7, 0.2], armB: [1.5, 0.3], legF: [0.4, 0.5], legB: [-0.4, 0.4], expr: "shout" },
};

/** Before the active frames, some poses wind up first (raised arm, chambered leg…). */
export const WINDUP: Record<string, P> = {
  throw: { armF: [3.0, 0.6], armB: [0.6, 1.2], lean: -0.15, expr: "shout" },
  bigThrow: { armF: [3.0, 0.4], armB: [2.8, 0.5], lean: -0.25, expr: "shout" },
  stomp: { legF: [1.3, 1.7], legB: [-0.2, 0.2], lean: -0.15, armF: [0.3, 0.6], armB: [-0.3, 0.6], expr: "shout" },
  haymaker: { armF: [-1.3, 1.0], armB: [1.0, 1.2], lean: -0.2, expr: "shout" },
  chop: { armF: [2.9, 0.3], armB: [0.6, 1.4], lean: -0.1, expr: "focus" },
  elbow: { armF: [-0.9, 1.6], armB: [0.6, 1.4], lean: -0.15, expr: "focus" },
  headbutt: { lean: -0.3, head: -0.35, armF: [0.5, 0.8], armB: [-0.3, 0.6], expr: "focus" },
  axeKick: { legF: [2.2, 0.1], legB: [-0.1, 0.05], lean: -0.4, armF: [0.6, 1.2], armB: [-0.6, 0.8], expr: "focus" },
  slap: { armF: [-0.9, 1.0], armB: [0.8, 1.2], lean: -0.1, expr: "focus" },
  hook: { armF: [0.9, 1.6], armB: [0.6, 1.8], lean: -0.1, head: -0.05, expr: "focus" },
  tackle: { lean: 0.3, armF: [0.6, 1.0], armB: [0.4, 1.0], legF: [0.8, 1.2], legB: [-0.3, 0.5], expr: "focus" },
  superman: { armF: [-1.0, 1.4], armB: [0.8, 1.0], legF: [1.4, 1.8], legB: [-0.2, 0.2], lean: -0.15, expr: "shout" },
  sideKick: { legF: [1.5, 2.5], legB: [-0.2, 0.1], lean: -0.3, armF: [0.8, 1.2], armB: [-0.8, 0.7], expr: "focus" },
};

/** Poses that keep moving while active (frame-driven). */
function animated(name: string, target: P, mf: number): P {
  switch (name) {
    case "spin": {
      const a = Math.cos(mf * 0.55) * 1.57;
      return { ...target, armF: [1.57 + a * 0.4, 0.05], armB: [-1.57 + a * 0.4, 0.05], lean: Math.sin(mf * 0.55) * 0.15 };
    }
    case "wave":
      return { ...target, armF: [2.7, 0.3 + Math.sin(mf * 0.5) * 0.6] };
    case "conduct":
      return { ...target, armF: [2.0 + Math.sin(mf * 0.45) * 0.5, 0.5 + Math.cos(mf * 0.45) * 0.5] };
    case "chainsaw":
      return { ...target, lean: 0.18 + Math.sin(mf * 1.7) * 0.04, squash: 1 + Math.sin(mf * 2.1) * 0.02 };
    case "clap": {
      const k = Math.abs(Math.sin(mf * 0.6));
      return { ...target, armF: [1.5, 0.3 + k * 0.6], armB: [1.5, 0.5 + k * 0.6] };
    }
    case "selfie":
      return { ...target, head: -0.18 + Math.sin(mf * 0.2) * 0.06 };
    default:
      return target;
  }
}

/** Poses reached quickly and held for the whole move rather than following the hit window. */
const HELD = new Set(["flex", "raute", "wobble", "spin", "wave", "conduct", "clap", "selfie", "pray", "kneel", "crossArms", "shrug", "salute", "megaphone", "book", "chainsaw", "bow"]);

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
      const winding = !!WINDUP[def.pose] && f.moveFrame < window(def)[0];
      if (winding) target = WINDUP[def.pose];
      else target = animated(def.pose, target, f.moveFrame);
      if (def.pose === "flurry") {
        const a = Math.sin(f.moveFrame * 1.3);
        target = { ...target, armF: [1.55, 0.1 + Math.max(0, a) * 1.2], armB: [1.45, 0.1 + Math.max(0, -a) * 1.2] };
      }
      if (def.pose === "wobble") target = { ...target, squash: 1 + Math.sin(f.moveFrame * 0.9) * 0.12, lean: Math.sin(f.moveFrame * 0.7) * 0.2 };
      const held = HELD.has(def.pose) || winding;
      const pose = blend(base, target, held ? Math.min(1, (f.moveFrame + 1) / 4) : e);
      if (def.shout && f.moveFrame < 30 && pose.expr !== "happy") pose.expr = "shout";
      return pose;
    }
  }
  return base;
}

/** Whether the renderer knows this pose key (used by the roster checks). */
export const hasPose = (name: string) => name in POSES;

/** Pose for previews in menus (no Fighter needed). */
export function namedPose(name: string, k = 1): Pose {
  return blend(STANCE, POSES[name] ?? {}, k);
}
