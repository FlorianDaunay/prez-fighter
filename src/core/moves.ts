import type { HitDef, MoveDef, MoveSlot, ProjDef, Stats } from "./types";

/** Short builder for hit definitions. */
export const hit = (damage: number, hitstun: number, blockstun: number, push: number, extra: Partial<HitDef> = {}): HitDef => ({
  damage,
  hitstun,
  blockstun,
  push,
  ...extra,
});

/** A straight projectile thrown from the hand. */
export function shot(sprite: string, extra: Partial<ProjDef> = {}): ProjDef {
  return {
    frame: 12,
    x: 60,
    y: 115,
    vx: 7.5,
    w: 46,
    h: 40,
    life: 150,
    hit: hit(70, 22, 16, 5),
    sprite,
    ...extra,
  };
}

/** Standard special: projectile. */
export function projectileMove(name: string, desc: string, proj: ProjDef | ProjDef[], extra: Partial<MoveDef> = {}): MoveDef {
  return { name, desc, frames: 42, pose: "throw", projectiles: Array.isArray(proj) ? proj : [proj], meterGain: 60, ...extra };
}

/** Standard special: forward rush with a hitbox. */
export function dashMove(name: string, desc: string, extra: Partial<MoveDef> = {}, h: Partial<HitDef> = {}): MoveDef {
  return {
    name,
    desc,
    frames: 40,
    pose: "dash",
    motion: [{ from: 6, to: 22, vx: 10 }],
    hitboxes: [{ x: 50, y: 100, w: 80, h: 110, from: 7, to: 22, hit: hit(90, 24, 16, 9, { knockdown: true, ...h }) }],
    meterGain: 70,
    ...extra,
  };
}

/** Standard special: invincible rising anti-air. */
export function upperMove(name: string, desc: string, extra: Partial<MoveDef> = {}, h: Partial<HitDef> = {}): MoveDef {
  return {
    name,
    desc,
    frames: 46,
    pose: "uppercut",
    invuln: [1, 9],
    motion: [{ from: 3, to: 15, vx: 2.2, vy: 14 }],
    hitboxes: [{ x: 40, y: 150, w: 70, h: 120, from: 3, to: 14, hit: hit(105, 30, 18, 4, { launch: 12, knockdown: true, ...h }) }],
    meterGain: 70,
    ...extra,
  };
}

/** Normal attacks, scaled to the fighter's size and power. */
export function normals(stats: Stats): Record<"L" | "H" | "cL" | "cH" | "jL" | "jH" | "throw", MoveDef> {
  const s = stats.size;
  const p = stats.power;
  const d = (n: number) => Math.round(n * p);
  return {
    L: {
      name: "Coup léger",
      frames: 16,
      pose: "jab",
      hitboxes: [{ x: 58 * s, y: 128 * s, w: 54 * s, h: 28, from: 4, to: 6, hit: hit(d(35), 15, 10, 3) }],
      meterGain: 8,
    },
    H: {
      name: "Coup lourd",
      frames: 30,
      pose: "kick",
      motion: [{ from: 4, to: 10, vx: 2 }],
      hitboxes: [{ x: 74 * s, y: 100 * s, w: 76 * s, h: 38, from: 9, to: 12, hit: hit(d(85), 21, 15, 6) }],
      meterGain: 20,
    },
    cL: {
      name: "Léger accroupi",
      frames: 15,
      pose: "crouchJab",
      hitboxes: [{ x: 56 * s, y: 52 * s, w: 54 * s, h: 26, from: 4, to: 6, hit: hit(d(30), 14, 9, 3, { low: true }) }],
      meterGain: 8,
    },
    cH: {
      name: "Balayette",
      frames: 34,
      pose: "sweep",
      hitboxes: [{ x: 78 * s, y: 18, w: 86 * s, h: 28, from: 9, to: 12, hit: hit(d(80), 24, 16, 5, { low: true, knockdown: true }) }],
      meterGain: 20,
    },
    jL: {
      name: "Léger sauté",
      frames: 22,
      pose: "airKick",
      air: true,
      hitboxes: [{ x: 40 * s, y: 60 * s, w: 56 * s, h: 50, from: 4, to: 14, hit: hit(d(40), 16, 11, 3, { overhead: true }) }],
      meterGain: 8,
    },
    jH: {
      name: "Lourd sauté",
      frames: 26,
      pose: "airPunch",
      air: true,
      hitboxes: [{ x: 52 * s, y: 50 * s, w: 64 * s, h: 56, from: 7, to: 15, hit: hit(d(80), 22, 15, 5, { overhead: true }) }],
      meterGain: 18,
    },
    throw: {
      name: "Projection",
      desc: "Léger + Lourd au contact : impossible à garder.",
      frames: 40,
      pose: "grab",
      hitboxes: [{ x: 48 * s, y: 100, w: 52, h: 120, from: 3, to: 4, hit: hit(d(110), 30, 0, 12, { grab: true, knockdown: true, launch: 9 }) }],
      meterGain: 30,
    },
  };
}

export const SPECIAL_SLOTS: MoveSlot[] = ["sN", "sF", "sD", "sU", "super"];

/** How each slot is performed, for the move list. */
export const SLOT_INPUT: Record<MoveSlot, string> = {
  L: "Léger",
  H: "Lourd",
  cL: "↓ + Léger",
  cH: "↓ + Lourd",
  jL: "En l'air + Léger",
  jH: "En l'air + Lourd",
  throw: "Léger + Lourd (au contact)",
  sN: "Spécial",
  sF: "→ + Spécial",
  sD: "↓ + Spécial",
  sU: "↑ + Spécial",
  super: "Super (jauge pleine)",
};
