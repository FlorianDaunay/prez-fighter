import { BTN } from "@/core/input";

export type Action = "UP" | "DOWN" | "LEFT" | "RIGHT" | "LIGHT" | "HEAVY" | "SPECIAL" | "ASSIST" | "SUPER" | "THROW" | "PAUSE";

export const ACTIONS: { id: Action; label: string }[] = [
  { id: "UP", label: "Haut / Saut" },
  { id: "DOWN", label: "Bas / Accroupi" },
  { id: "LEFT", label: "Gauche" },
  { id: "RIGHT", label: "Droite" },
  { id: "LIGHT", label: "Coup léger" },
  { id: "HEAVY", label: "Coup lourd" },
  { id: "SPECIAL", label: "Spécial" },
  { id: "ASSIST", label: "Soutien" },
  { id: "SUPER", label: "Super" },
  { id: "THROW", label: "Projection (Léger+Lourd)" },
  { id: "PAUSE", label: "Pause" },
];

/** Bits each action sets in the frame input. */
export const ACTION_BITS: Record<Action, number> = {
  UP: BTN.UP,
  DOWN: BTN.DOWN,
  LEFT: BTN.LEFT,
  RIGHT: BTN.RIGHT,
  LIGHT: BTN.LIGHT,
  HEAVY: BTN.HEAVY,
  SPECIAL: BTN.SPECIAL,
  ASSIST: BTN.ASSIST,
  SUPER: BTN.SUPER,
  THROW: BTN.LIGHT | BTN.HEAVY,
  PAUSE: 0,
};

export type PadBinding = { kind: "button"; index: number } | { kind: "axis"; index: number; dir: 1 | -1 };

export type KeyProfile = Record<Action, string[]>;
export type PadProfile = Record<Action, PadBinding[]>;

export type DeviceId = "kbA" | "kbB" | "pad0" | "pad1" | "pad2" | "pad3";
export const DEVICES: { id: DeviceId; label: string }[] = [
  { id: "kbA", label: "Clavier — gauche" },
  { id: "kbB", label: "Clavier — droite" },
  { id: "pad0", label: "Manette 1" },
  { id: "pad1", label: "Manette 2" },
  { id: "pad2", label: "Manette 3" },
  { id: "pad3", label: "Manette 4" },
];

export const DEFAULT_KEYS: Record<"kbA" | "kbB", KeyProfile> = {
  kbA: {
    UP: ["KeyW"],
    DOWN: ["KeyS"],
    LEFT: ["KeyA"],
    RIGHT: ["KeyD"],
    LIGHT: ["KeyF"],
    HEAVY: ["KeyG"],
    SPECIAL: ["KeyH"],
    ASSIST: ["KeyR"],
    SUPER: ["KeyT"],
    THROW: ["KeyV"],
    PAUSE: ["Escape"],
  },
  kbB: {
    UP: ["ArrowUp"],
    DOWN: ["ArrowDown"],
    LEFT: ["ArrowLeft"],
    RIGHT: ["ArrowRight"],
    LIGHT: ["KeyK", "Numpad1"],
    HEAVY: ["KeyL", "Numpad2"],
    SPECIAL: ["Semicolon", "Numpad3"],
    ASSIST: ["KeyI", "Numpad4"],
    SUPER: ["KeyO", "Numpad5"],
    THROW: ["KeyP", "Numpad6"],
    PAUSE: ["Backspace"],
  },
};

const b = (index: number): PadBinding => ({ kind: "button", index });

/** Standard mapping (Xbox layout positions; a Switch Pro controller maps the same positions). */
export const DEFAULT_PAD: PadProfile = {
  UP: [b(12)],
  DOWN: [b(13)],
  LEFT: [b(14)],
  RIGHT: [b(15)],
  LIGHT: [b(2)],
  HEAVY: [b(3)],
  SPECIAL: [b(0)],
  ASSIST: [b(1)],
  SUPER: [b(5), b(7)],
  THROW: [b(4), b(6)],
  PAUSE: [b(9)],
};

export function describePad(bd: PadBinding): string {
  if (bd.kind === "axis") return `Axe ${bd.index}${bd.dir > 0 ? "+" : "−"}`;
  const names: Record<number, string> = {
    0: "Bas (A/B)",
    1: "Droite (B/A)",
    2: "Gauche (X/Y)",
    3: "Haut (Y/X)",
    4: "L / LB",
    5: "R / RB",
    6: "ZL / LT",
    7: "ZR / RT",
    8: "− / Select",
    9: "+ / Start",
    10: "Stick G",
    11: "Stick D",
    12: "Croix ↑",
    13: "Croix ↓",
    14: "Croix ←",
    15: "Croix →",
    16: "Home",
    17: "Capture",
  };
  return names[bd.index] ?? `Bouton ${bd.index}`;
}

let layoutMap: Map<string, string> | null = null;
/** Keyboard layout aware labels (AZERTY shows Z/Q/S/D for physical W/A/S/D). */
export async function loadKeyboardLayout() {
  const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard;
  try {
    if (kb?.getLayoutMap) layoutMap = await kb.getLayoutMap();
  } catch {
    /* not available */
  }
}

export function describeKey(code: string): string {
  const fromLayout = layoutMap?.get(code);
  if (fromLayout) return fromLayout.toUpperCase();
  const special: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Space: "Espace",
    Escape: "Échap",
    Backspace: "Retour",
    Enter: "Entrée",
    ShiftLeft: "Maj G",
    ShiftRight: "Maj D",
    ControlLeft: "Ctrl G",
    ControlRight: "Ctrl D",
    Semicolon: "M",
  };
  if (special[code]) return special[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Pavé " + code.slice(6);
  return code;
}
