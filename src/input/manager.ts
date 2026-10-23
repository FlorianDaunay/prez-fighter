/**
 * Keyboard + Gamepad API. Polled once per frame by the game loop; also turns raw presses into
 * menu navigation events (with key repeat) for the React screens.
 */
import { useSettings } from "@/store/settings";
import { ACTION_BITS, type Action, type DeviceId, type PadBinding } from "./bindings";

const keysDown = new Set<string>();
let pads: (Gamepad | null)[] = [];

export type MenuAction = "up" | "down" | "left" | "right" | "confirm" | "back" | "pause" | "extra" | "alt";
export interface MenuEvent {
  action: MenuAction;
  /** Player owning the device in local versus (null: not assigned). */
  player: 0 | 1 | null;
  device: DeviceId | "mouse";
}

type CaptureFn = (b: { key?: string; pad?: PadBinding; device: DeviceId }) => void;
let capture: CaptureFn | null = null;
let captureArmedAt = 0;

const STICK = 0.5;

const isNintendo = (p: Gamepad) => /nintendo|pro controller|joy-con|057e/i.test(p.id);

// ---------------------------------------------------------------- devices

export function pollPads() {
  pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
}

export function connectedPads(): Gamepad[] {
  return pads.filter((p): p is Gamepad => !!p && p.connected);
}

function padValue(p: Gamepad, bd: PadBinding): boolean {
  if (bd.kind === "button") return !!p.buttons[bd.index]?.pressed;
  const v = p.axes[bd.index] ?? 0;
  return bd.dir > 0 ? v > STICK : v < -STICK;
}

/** Directions from sticks and, for non-standard mappings, from a hat axis. */
function padDirections(p: Gamepad): number {
  let bits = 0;
  const x = p.axes[0] ?? 0;
  const y = p.axes[1] ?? 0;
  if (x < -STICK) bits |= ACTION_BITS.LEFT;
  if (x > STICK) bits |= ACTION_BITS.RIGHT;
  if (y < -STICK) bits |= ACTION_BITS.UP;
  if (y > STICK) bits |= ACTION_BITS.DOWN;
  if (p.mapping !== "standard" && p.axes.length > 9) {
    const h = p.axes[9];
    if (h >= -1.05 && h <= 1.05) {
      // 8-way hat: -1 = up, then clockwise in steps of 2/7.
      const pos = Math.round(((h + 1) * 7) / 2);
      if (pos === 7 || pos === 0 || pos === 1) bits |= ACTION_BITS.UP;
      if (pos >= 1 && pos <= 3) bits |= ACTION_BITS.RIGHT;
      if (pos >= 3 && pos <= 5) bits |= ACTION_BITS.DOWN;
      if (pos >= 5 && pos <= 7) bits |= ACTION_BITS.LEFT;
    }
  }
  return bits;
}

function actionsOf(device: DeviceId): Set<Action> {
  const s = useSettings.getState();
  const out = new Set<Action>();
  if (device === "kbA" || device === "kbB") {
    const prof = s.keys[device];
    for (const a of Object.keys(prof) as Action[]) if (prof[a].some((c) => keysDown.has(c))) out.add(a);
    return out;
  }
  const p = pads[Number(device.slice(3))];
  if (!p || !p.connected) return out;
  for (const a of Object.keys(s.pad) as Action[]) if (s.pad[a].some((bd) => padValue(p, bd))) out.add(a);
  const dirs = padDirections(p);
  if (dirs & ACTION_BITS.UP) out.add("UP");
  if (dirs & ACTION_BITS.DOWN) out.add("DOWN");
  if (dirs & ACTION_BITS.LEFT) out.add("LEFT");
  if (dirs & ACTION_BITS.RIGHT) out.add("RIGHT");
  return out;
}

export function deviceInput(device: DeviceId): number {
  let bits = 0;
  for (const a of actionsOf(device)) bits |= ACTION_BITS[a];
  return bits;
}

const ALL: DeviceId[] = ["kbA", "kbB", "pad0", "pad1", "pad2", "pad3"];

/** Input of a player. `solo`: every device controls player 1 (vs CPU, online). */
export function playerInput(player: 0 | 1, solo: boolean): number {
  const devices = solo ? ALL : useSettings.getState().sources[player];
  let bits = 0;
  for (const d of devices) bits |= deviceInput(d);
  return bits;
}

export function pausePressed(): boolean {
  return ALL.some((d) => actionsOf(d).has("PAUSE"));
}

export function playerOfDevice(device: DeviceId): 0 | 1 | null {
  const [a, b] = useSettings.getState().sources;
  if (a.includes(device)) return 0;
  if (b.includes(device)) return 1;
  return null;
}

// ---------------------------------------------------------------- capture (rebinding)

export function startCapture(fn: CaptureFn) {
  capture = fn;
  captureArmedAt = performance.now();
}
export function cancelCapture() {
  capture = null;
}
export const isCapturing = () => capture !== null;

// ---------------------------------------------------------------- menu navigation

const listeners: ((e: MenuEvent) => void)[] = [];
/** The last subscriber (the screen on top) receives menu events. */
export function onMenu(fn: (e: MenuEvent) => void) {
  listeners.push(fn);
  return () => {
    const i = listeners.lastIndexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

let menuEnabled = true;
export const setMenuEnabled = (v: boolean) => {
  menuEnabled = v;
};

function dispatch(e: MenuEvent) {
  if (!menuEnabled) return;
  listeners[listeners.length - 1]?.(e);
}

const repeat = new Map<string, number>();
const prevPadButtons = new Map<string, boolean>();

function navFromDevice(device: DeviceId, now: number) {
  const acts = actionsOf(device);
  const player = playerOfDevice(device);
  const dirs: [Action, MenuAction][] = [["UP", "up"], ["DOWN", "down"], ["LEFT", "left"], ["RIGHT", "right"]];
  for (const [a, m] of dirs) {
    const key = device + a;
    if (acts.has(a)) {
      const next = repeat.get(key);
      if (next === undefined) {
        dispatch({ action: m, player, device });
        repeat.set(key, now + 320);
      } else if (now >= next) {
        dispatch({ action: m, player, device });
        repeat.set(key, now + 90);
      }
    } else repeat.delete(key);
  }
  if (device.startsWith("pad")) {
    const p = pads[Number(device.slice(3))];
    if (!p) return;
    const nin = isNintendo(p);
    const map: [number, MenuAction][] = [
      [nin ? 1 : 0, "confirm"],
      [nin ? 0 : 1, "back"],
      [9, "pause"],
      [3, "extra"],
      [2, "alt"],
    ];
    for (const [idx, m] of map) {
      const k = device + "b" + idx;
      const down = !!p.buttons[idx]?.pressed;
      if (down && !prevPadButtons.get(k)) dispatch({ action: m, player, device });
      prevPadButtons.set(k, down);
    }
  }
}

function keyMenuAction(code: string): { action: MenuAction; device: DeviceId } | null {
  const s = useSettings.getState();
  for (const dev of ["kbA", "kbB"] as const) {
    const k = s.keys[dev];
    if (k.LIGHT.includes(code)) return { action: "confirm", device: dev };
    if (k.HEAVY.includes(code)) return { action: "back", device: dev };
    if (k.SPECIAL.includes(code)) return { action: "extra", device: dev };
    if (k.ASSIST.includes(code)) return { action: "alt", device: dev };
  }
  if (code === "Enter" || code === "Space" || code === "NumpadEnter") return { action: "confirm", device: "kbA" };
  if (code === "Escape" || code === "Backspace") return { action: "back", device: "kbA" };
  if (code === "Tab") return { action: "extra", device: "kbA" };
  return null;
}

function onKeyDown(e: KeyboardEvent) {
  if (capture && performance.now() - captureArmedAt > 150) {
    e.preventDefault();
    const fn = capture;
    capture = null;
    fn(e.code === "Escape" ? { device: "kbA" } : { key: e.code, device: "kbA" });
    return;
  }
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
  if (e.code.startsWith("Arrow") || e.code === "Space" || e.code === "Tab") e.preventDefault();
  if (keysDown.has(e.code)) return;
  keysDown.add(e.code);
  const m = keyMenuAction(e.code);
  if (m) dispatch({ ...m, player: playerOfDevice(m.device) });
}

function onKeyUp(e: KeyboardEvent) {
  keysDown.delete(e.code);
}

const prevCapture = new Map<string, number[]>();
function captureFromPads() {
  if (!capture || performance.now() - captureArmedAt < 250) return;
  pads.forEach((p, i) => {
    if (!p) return;
    const id = ("pad" + i) as DeviceId;
    const before = prevCapture.get(id);
    const now = p.buttons.map((b) => (b.pressed ? 1 : 0) as number).concat(p.axes.map((v) => (v > 0.7 ? 1 : v < -0.7 ? -1 : 0)));
    prevCapture.set(id, now);
    if (!before) return;
    for (let k = 0; k < p.buttons.length; k++) {
      if (now[k] && !before[k]) {
        const fn = capture!;
        capture = null;
        fn({ pad: { kind: "button", index: k }, device: id });
        return;
      }
    }
    for (let a = 0; a < p.axes.length; a++) {
      const v = now[p.buttons.length + a];
      if (v !== 0 && before[p.buttons.length + a] === 0) {
        const fn = capture!;
        capture = null;
        fn({ pad: { kind: "axis", index: a, dir: v as 1 | -1 }, device: id });
        return;
      }
    }
  });
}

let started = false;
/** Starts the global listeners and the menu polling loop. */
export function startInput() {
  if (started) return;
  started = true;
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => keysDown.clear());
  const loop = () => {
    pollPads();
    const now = performance.now();
    if (capture) captureFromPads();
    else {
      prevCapture.clear();
      for (let i = 0; i < pads.length; i++) if (pads[i]) navFromDevice(("pad" + i) as DeviceId, now);
      // Keyboard directions also go through the repeat logic.
      navFromDevice("kbA", now);
      navFromDevice("kbB", now);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
