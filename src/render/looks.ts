/** Appearance of every fighter and support: colours, face shape, hair and accessories. */

export type HairStyle =
  | "sidePart" | "blondVolume" | "whiteBack" | "shortReceding" | "baldSides" | "slickBack" | "shortGrey"
  | "bobDark" | "swoop" | "thinBald" | "blackBack" | "bobBlond" | "blondBobLayered" | "slickDark"
  | "longBrown" | "greyHelmet" | "shortMessy" | "updoBlond" | "none";

export type Extra =
  | "glassesRect" | "glassesBig" | "kepi" | "mustache" | "pinRed" | "earrings" | "pearls" | "wrinkles"
  | "tanlines" | "beret" | "hood" | "goldWatch" | "lapelFlag" | "euStars" | "redBadge" | "frown" | "squint"
  | "bigChin" | "grin" | "pout" | "cheeks" | "pocketSquare" | "medals";

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  suit: string;
  shirt: string;
  tie: string | null;
  tieLong?: boolean;
  pants: string;
  shoes: string;
  /** Overall scale of the drawing (matches stats.size for fighters). */
  height: number;
  /** Torso width multiplier. */
  width: number;
  belly?: number;
  female?: boolean;
  face: { w: number; h: number; jaw: number; chin: number };
  nose: number;
  /** Nose shape: length forward vs height. */
  noseLong?: number;
  eye: string;
  brow: string;
  browThick: number;
  mouth: number;
  ears: number;
  extras: Extra[];
  collar: "tie" | "open" | "mao" | "blouse" | "tshirt" | "uniform";
  /** Hologram / special render tint. */
  tint?: string;
  alpha?: number;
}

const base: Look = {
  skin: "#f1c6a0",
  hair: "#3b2a1e",
  hairStyle: "sidePart",
  suit: "#1f2a44",
  shirt: "#ffffff",
  tie: "#2c4f8c",
  pants: "#1b2238",
  shoes: "#151515",
  height: 1,
  width: 1,
  face: { w: 25, h: 31, jaw: 0.75, chin: 1 },
  nose: 1,
  eye: "#2d2d2d",
  brow: "#3b2a1e",
  browThick: 3,
  mouth: 1,
  ears: 1,
  extras: [],
  collar: "tie",
};

const look = (patch: Partial<Look>): Look => ({ ...base, ...patch, face: { ...base.face, ...(patch.face ?? {}) } });

export const LOOKS: Record<string, Look> = {
  macaron: look({
    hair: "#4a3424",
    hairStyle: "sidePart",
    suit: "#1d2c57",
    pants: "#18244a",
    tie: "#2f4c8f",
    eye: "#3b74c4",
    brow: "#4a3424",
    face: { w: 24, h: 31, jaw: 0.7, chin: 1.05 },
    ears: 1.25,
    extras: ["grin", "lapelFlag"],
  }),
  lepain: look({
    female: true,
    hair: "#e8c773",
    hairStyle: "blondVolume",
    suit: "#14244f",
    pants: "#14244f",
    shirt: "#dfe8f5",
    tie: null,
    collar: "blouse",
    skin: "#f3c9a6",
    eye: "#3a6a8a",
    brow: "#b8955a",
    browThick: 2.5,
    face: { w: 25, h: 31, jaw: 0.85, chin: 1.08 },
    mouth: 1.2,
    height: 1.02,
    extras: ["bigChin", "grin"],
  }),
  meluchon: look({
    hair: "#dcdcdc",
    hairStyle: "whiteBack",
    suit: "#2b2b30",
    pants: "#26262b",
    shirt: "#f0f0f0",
    tie: null,
    collar: "mao",
    skin: "#e9b996",
    brow: "#7a7a7a",
    browThick: 4,
    face: { w: 26, h: 31, jaw: 0.9, chin: 1 },
    nose: 1.15,
    extras: ["redBadge", "wrinkles", "frown"],
  }),
  sarkozix: look({
    hair: "#2f241c",
    hairStyle: "shortReceding",
    suit: "#1a1f33",
    pants: "#161a2b",
    tie: "#1b1b26",
    skin: "#e8b48c",
    height: 0.88,
    eye: "#3a2a1a",
    brow: "#2f241c",
    face: { w: 24, h: 30, jaw: 0.75, chin: 0.95 },
    nose: 1.35,
    noseLong: 1.25,
    extras: ["goldWatch", "squint"],
  }),
  hollandaise: look({
    hair: "#2c2622",
    hairStyle: "baldSides",
    suit: "#22232b",
    pants: "#1d1e25",
    tie: "#3a3f59",
    skin: "#f0c4a2",
    width: 1.12,
    belly: 4,
    face: { w: 28, h: 30, jaw: 1, chin: 0.9 },
    nose: 0.9,
    extras: ["glassesRect", "cheeks"],
  }),
  chirashi: look({
    hair: "#3d3b3a",
    hairStyle: "slickBack",
    suit: "#1f2a3d",
    pants: "#1b2333",
    tie: "#7a1f2b",
    height: 1.1,
    skin: "#e7b48f",
    face: { w: 23, h: 35, jaw: 0.7, chin: 1.12 },
    nose: 1.7,
    noseLong: 1.5,
    ears: 1.35,
    extras: ["grin", "wrinkles"],
  }),
  degaufre: look({
    hair: "#8c8c8c",
    hairStyle: "shortGrey",
    suit: "#5d6b34",
    pants: "#535f2e",
    shirt: "#c9c19a",
    tie: "#4b5528",
    collar: "uniform",
    height: 1.16,
    skin: "#ecc0a0",
    face: { w: 23, h: 34, jaw: 0.75, chin: 1.05 },
    nose: 1.9,
    noseLong: 1.7,
    ears: 1.3,
    extras: ["kepi", "mustache", "medals"],
  }),
  royaume: look({
    female: true,
    hair: "#3a2a22",
    hairStyle: "bobDark",
    suit: "#f4f1ea",
    pants: "#f4f1ea",
    shirt: "#ffffff",
    tie: null,
    collar: "blouse",
    shoes: "#7a1f2b",
    skin: "#f0c7a5",
    height: 0.95,
    eye: "#3a2a22",
    face: { w: 24, h: 30, jaw: 0.75, chin: 1 },
    mouth: 1.25,
    extras: ["grin", "earrings", "pearls"],
  }),
  tromp: look({
    hair: "#f2c94c",
    hairStyle: "swoop",
    suit: "#1b2340",
    pants: "#19203a",
    tie: "#d0201f",
    tieLong: true,
    skin: "#f0a35e",
    height: 1.12,
    width: 1.18,
    belly: 8,
    eye: "#2d4a6b",
    brow: "#e3b448",
    face: { w: 28, h: 31, jaw: 1, chin: 0.95 },
    mouth: 0.8,
    extras: ["tanlines", "pout", "squint", "lapelFlag"],
  }),
  poutrine: look({
    hair: "#c9b08a",
    hairStyle: "thinBald",
    suit: "#20232a",
    pants: "#1d2026",
    tie: "#6b1d26",
    skin: "#efc3a3",
    height: 0.92,
    eye: "#6aa0c8",
    brow: "#b59b74",
    browThick: 2,
    face: { w: 24, h: 30, jaw: 0.85, chin: 0.95 },
    mouth: 0.8,
    extras: ["frown"],
  }),
  pingpong: look({
    hair: "#151515",
    hairStyle: "blackBack",
    suit: "#22252c",
    pants: "#1e2026",
    tie: "#b3261e",
    skin: "#f0caa0",
    width: 1.1,
    belly: 4,
    eye: "#222",
    brow: "#151515",
    face: { w: 29, h: 31, jaw: 1, chin: 0.9 },
    nose: 0.9,
    extras: ["cheeks", "grin"],
  }),
  merguez: look({
    female: true,
    hair: "#c9b48a",
    hairStyle: "bobBlond",
    suit: "#d4452f",
    pants: "#1d1d22",
    shirt: "#1d1d22",
    tie: null,
    collar: "blouse",
    skin: "#f1cdb0",
    height: 0.96,
    width: 1.1,
    eye: "#4e6b85",
    brow: "#a8936b",
    face: { w: 26, h: 30, jaw: 0.9, chin: 0.95 },
    mouth: 1,
    extras: ["frown", "cheeks"],
  }),

  // Supports
  brigitte: look({ female: true, hair: "#efd38a", hairStyle: "blondBobLayered", suit: "#3aa6c9", pants: "#e8e8e8", tie: null, collar: "blouse", shirt: "#ffffff", height: 0.9, width: 0.85, extras: ["grin"] }),
  bardelle: look({ hair: "#1c1a1a", hairStyle: "slickDark", suit: "#1a2a5a", pants: "#162248", tie: "#1a2a5a", height: 0.98, face: { w: 23, h: 30, jaw: 0.8, chin: 1 }, extras: ["grin"] }),
  hologram: look({ hair: "#dcdcdc", hairStyle: "whiteBack", suit: "#2b2b30", tie: null, collar: "mao", brow: "#7a7a7a", browThick: 4, nose: 1.15, extras: ["frown"], tint: "#44c8ff", alpha: 0.55, face: { w: 26, h: 31, jaw: 0.9, chin: 1 } }),
  carla: look({ female: true, hair: "#4a3020", hairStyle: "longBrown", suit: "#1a1a1a", pants: "#1a1a1a", collar: "blouse", tie: null, shirt: "#1a1a1a", height: 0.98, width: 0.85, extras: [] }),
  scooter: look({ hairStyle: "none", suit: "#22232b", tie: "#3a3f59", width: 1.1, extras: ["glassesRect"] }),
  bernadette: look({ female: true, hair: "#b8b2a8", hairStyle: "greyHelmet", suit: "#6e5a8a", pants: "#4a3d5c", tie: null, collar: "blouse", height: 0.88, extras: ["glassesBig", "pearls"] }),
  resistants: look({ hair: "#2b2018", hairStyle: "shortMessy", suit: "#5a4632", pants: "#3b3328", shirt: "#d9cfb8", tie: null, collar: "open", height: 0.86, extras: ["beret", "mustache"] }),
  militants: look({ hair: "#5a3b26", hairStyle: "shortMessy", suit: "#e05297", pants: "#2a3550", shirt: "#ffffff", tie: null, collar: "tshirt", height: 0.86, extras: ["grin"] }),
  elon: look({ hair: "#2a221c", hairStyle: "shortMessy", suit: "#111111", pants: "#1a1a1a", shirt: "#111", tie: null, collar: "tshirt", height: 1.02, extras: ["grin"] }),
  trolls: look({ hair: "#222", hairStyle: "none", suit: "#3a3a46", pants: "#2a2a33", shirt: "#3a3a46", tie: null, collar: "tshirt", height: 0.84, extras: ["hood"] }),
  pandas: look({ hairStyle: "none" }),
  ursula: look({ female: true, hair: "#e9d39a", hairStyle: "updoBlond", suit: "#1f4fa8", pants: "#1f4fa8", tie: null, collar: "blouse", shirt: "#ffffff", height: 0.95, width: 0.9, extras: ["grin", "euStars"] }),
};
