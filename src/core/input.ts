/** One frame of player input, packed in a small integer (sent over the network as is). */
export const BTN = {
  UP: 1,
  DOWN: 2,
  LEFT: 4,
  RIGHT: 8,
  LIGHT: 16,
  HEAVY: 32,
  SPECIAL: 64,
  ASSIST: 128,
  SUPER: 256,
} as const;

export type ButtonName = keyof typeof BTN;
export const BUTTON_NAMES = Object.keys(BTN) as ButtonName[];
export const ACTION_BUTTONS = BTN.LIGHT | BTN.HEAVY | BTN.SPECIAL | BTN.ASSIST | BTN.SUPER;

export const has = (input: number, bit: number) => (input & bit) !== 0;

/** Cancels opposite directions pressed together (SOCD: neutral horizontally, up wins vertically). */
export function cleanInput(input: number): number {
  let i = input;
  if (has(i, BTN.LEFT) && has(i, BTN.RIGHT)) i &= ~(BTN.LEFT | BTN.RIGHT);
  if (has(i, BTN.UP) && has(i, BTN.DOWN)) i &= ~BTN.DOWN;
  return i;
}
