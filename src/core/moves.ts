import type { CharacterDef, FightStyle, HitDef, MoveDef, MoveSlot, ProjDef, Stats } from "./types";

export const stats = (walk: number, jumpV: number, size: number, power: number, hp = 1000): Stats => ({ walk, jumpV, hp, size, power });

type Tweaks = Partial<Record<MoveSlot, Partial<MoveDef>>>;

/**
 * A character with the normals of their style, overridden by their own moves. `tweak` patches
 * an inherited normal (new name, pose…) without redefining it.
 */
export function build({ tweak, ...def }: CharacterDef & { tweak?: Tweaks }): CharacterDef {
  const moves: CharacterDef["moves"] = { ...normals(def.stats, def.style), ...def.moves };
  for (const slot of Object.keys(tweak ?? {}) as MoveSlot[]) {
    const base = moves[slot];
    if (base) moves[slot] = { ...base, ...tweak![slot] };
  }
  return { ...def, moves };
}

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

type NormalSlot = "L" | "H" | "fH" | "cL" | "cH" | "jL" | "jH" | "throw";

/** Per-style tuning: speed (startup/recovery), reach, damage, and the pose of each normal. */
const STYLE: Record<FightStyle, { speed: number; reach: number; dmg: number; poses: Partial<Record<NormalSlot, string>>; names: Partial<Record<NormalSlot, string>> }> = {
  allround: { speed: 1, reach: 1, dmg: 1, poses: {}, names: {} },
  boxer: { speed: 0.8, reach: 0.95, dmg: 0.9, poses: { H: "cross", jH: "airPunch" }, names: { L: "Jab", H: "Direct du droit" } },
  brawler: { speed: 1.15, reach: 1, dmg: 1.18, poses: { L: "slap", H: "haymaker" }, names: { L: "Gifle", H: "Coup de massue" } },
  grappler: { speed: 1.2, reach: 1.1, dmg: 1.12, poses: { L: "chop", H: "belly" }, names: { L: "Manchette", H: "Coup de bide" } },
  zoner: { speed: 1.05, reach: 1.35, dmg: 0.92, poses: { H: "sideKick", cH: "sweep" }, names: { H: "Chassé", cH: "Balayage long" } },
  rushdown: { speed: 0.75, reach: 0.9, dmg: 0.85, poses: { L: "jab", H: "knee", jL: "airKick" }, names: { L: "Jab éclair", H: "Coup de genou" } },
};

/** Default → + Heavy of each style (characters usually bring their own). */
function commandNormal(style: FightStyle, s: number, d: (n: number) => number): MoveDef {
  switch (style) {
    case "boxer":
      return { name: "Crochet", desc: "→ + Lourd : crochet qui avance, s'annule en spécial.", frames: 26, pose: "hook", motion: [{ from: 3, to: 8, vx: 3 }], hitboxes: [{ x: 62 * s, y: 125 * s, w: 60 * s, h: 40, from: 7, to: 9, hit: hit(d(70), 20, 14, 5) }], meterGain: 18 };
    case "brawler":
      return { name: "Coup de coude", desc: "→ + Lourd : coup plongeant, à garder debout.", frames: 34, pose: "elbow", hitboxes: [{ x: 60 * s, y: 130 * s, w: 60 * s, h: 60, from: 15, to: 18, hit: hit(d(80), 22, 14, 5, { overhead: true }) }], meterGain: 20 };
    case "grappler":
      return { name: "Plaquage", desc: "→ + Lourd : plaquage qui renverse.", frames: 40, pose: "tackle", motion: [{ from: 6, to: 16, vx: 6 }], hitboxes: [{ x: 50 * s, y: 80 * s, w: 70 * s, h: 90, from: 8, to: 16, hit: hit(d(90), 24, 16, 8, { knockdown: true }) }], meterGain: 22 };
    case "zoner":
      return { name: "Coup de pied retourné", desc: "→ + Lourd : très longue portée, lent.", frames: 36, pose: "sideKick", hitboxes: [{ x: 110 * s, y: 110 * s, w: 90 * s, h: 40, from: 12, to: 15, hit: hit(d(75), 21, 14, 8) }], meterGain: 20 };
    case "rushdown":
      return { name: "Glissade", desc: "→ + Lourd : glissade basse qui passe sous les projectiles.", frames: 32, pose: "slide", motion: [{ from: 4, to: 16, vx: 8 }], hitboxes: [{ x: 50 * s, y: 20, w: 70 * s, h: 30, from: 6, to: 16, hit: hit(d(60), 20, 14, 5, { low: true, knockdown: true }) }], meterGain: 18 };
    default:
      return { name: "Coup de tête", desc: "→ + Lourd : coup de boule qui avance.", frames: 30, pose: "headbutt", motion: [{ from: 4, to: 9, vx: 3.5 }], hitboxes: [{ x: 48 * s, y: 160 * s, w: 50 * s, h: 50, from: 9, to: 11, hit: hit(d(75), 22, 15, 6) }], meterGain: 18 };
  }
}

/** Normal attacks, scaled to the fighter's size and power and shaped by their style. */
export function normals(stats: Stats, style: FightStyle = "allround"): Record<NormalSlot, MoveDef> {
  const s = stats.size;
  const p = stats.power;
  const st = STYLE[style];
  const d = (n: number) => Math.round(n * p * st.dmg);
  const t = (n: number) => Math.max(2, Math.round(n * st.speed));
  const r = (n: number) => n * s * st.reach;
  const out: Record<NormalSlot, MoveDef> = {
    L: {
      name: "Coup léger",
      frames: t(16),
      pose: "jab",
      hitboxes: [{ x: r(58), y: 128 * s, w: r(54), h: 28, from: t(4), to: t(4) + 2, hit: hit(d(35), 15, 10, 3) }],
      meterGain: 8,
    },
    H: {
      name: "Coup lourd",
      frames: t(30),
      pose: "kick",
      motion: [{ from: 4, to: 10, vx: 2 }],
      hitboxes: [{ x: r(74), y: 100 * s, w: r(76), h: 38, from: t(9), to: t(9) + 3, hit: hit(d(85), 21, 15, 6) }],
      meterGain: 20,
    },
    fH: commandNormal(style, s, d),
    cL: {
      name: "Léger accroupi",
      frames: t(15),
      pose: "crouchJab",
      hitboxes: [{ x: r(56), y: 52 * s, w: r(54), h: 26, from: t(4), to: t(4) + 2, hit: hit(d(30), 14, 9, 3, { low: true }) }],
      meterGain: 8,
    },
    cH: {
      name: "Balayette",
      frames: t(34),
      pose: "sweep",
      hitboxes: [{ x: r(78), y: 18, w: r(86), h: 28, from: t(9), to: t(9) + 3, hit: hit(d(80), 24, 16, 5, { low: true, knockdown: true }) }],
      meterGain: 20,
    },
    jL: {
      name: "Léger sauté",
      frames: 22,
      pose: "airKick",
      air: true,
      hitboxes: [{ x: 40 * s, y: 60 * s, w: r(56), h: 50, from: t(4), to: 14, hit: hit(d(40), 16, 11, 3, { overhead: true }) }],
      meterGain: 8,
    },
    jH: {
      name: "Lourd sauté",
      frames: 26,
      pose: "airPunch",
      air: true,
      hitboxes: [{ x: 52 * s, y: 50 * s, w: r(64), h: 56, from: t(7), to: 15, hit: hit(d(80), 22, 15, 5, { overhead: true }) }],
      meterGain: 18,
    },
    throw: {
      name: "Projection",
      desc: "Léger + Lourd au contact : impossible à garder.",
      frames: 40,
      pose: "grab",
      hitboxes: [{ x: 48 * s, y: 100, w: style === "grappler" ? 80 : 52, h: 120, from: 3, to: 4, hit: hit(d(style === "grappler" ? 130 : 110), 30, 0, 12, { grab: true, knockdown: true, launch: 9 }) }],
      meterGain: 30,
    },
  };
  for (const k of Object.keys(st.poses) as NormalSlot[]) out[k].pose = st.poses[k]!;
  for (const k of Object.keys(st.names) as NormalSlot[]) out[k].name = st.names[k]!;
  return out;
}

export const SPECIAL_SLOTS: MoveSlot[] = ["sN", "sF", "sD", "sU", "jS", "super"];

/** How each slot is performed, for the move list. */
export const SLOT_INPUT: Record<MoveSlot, string> = {
  L: "Léger",
  H: "Lourd",
  fH: "→ + Lourd",
  cL: "↓ + Léger",
  cH: "↓ + Lourd",
  jL: "En l'air + Léger",
  jH: "En l'air + Lourd",
  throw: "Léger + Lourd (au contact)",
  sN: "Spécial",
  sF: "→ + Spécial",
  sD: "↓ + Spécial",
  sU: "↑ + Spécial",
  jS: "En l'air + Spécial",
  f1: "Spécial (enchaînement)",
  f2: "Spécial (enchaînement)",
  f3: "Spécial (enchaînement)",
  super: "Super (jauge pleine)",
};
