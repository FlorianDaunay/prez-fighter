import { describe, expect, it } from "vitest";
import { BTN } from "./input";
import { ROSTER } from "./roster";
import { cloneState, createGame, hashState, step } from "./sim";
import type { GameConfig } from "./types";

const config = (a = 0, b = 1): GameConfig => ({ chars: [a, b], stage: "elysee", rounds: 2, time: 99, seed: 42 });

/** Pseudo-random but reproducible input stream. */
function inputs(seed: number, frames: number): [number, number][] {
  let x = seed;
  const rnd = () => ((x = (x * 1103515245 + 12345) & 0x7fffffff), x / 0x7fffffff);
  const out: [number, number][] = [];
  let a = 0, b = 0;
  for (let i = 0; i < frames; i++) {
    if (i % 7 === 0) a = Math.floor(rnd() * 512);
    if (i % 5 === 0) b = Math.floor(rnd() * 512);
    out.push([a, b]);
  }
  return out;
}

const runAll = (cfg: GameConfig, ins: [number, number][]) => {
  const s = createGame(cfg);
  for (const i of ins) step(s, i);
  return s;
};

describe("simulation", () => {
  it("every character has its full move set and support", () => {
    for (const c of ROSTER) {
      for (const slot of ["L", "H", "cL", "cH", "jL", "jH", "throw", "sN", "sF", "sD", "sU", "super"] as const) {
        expect(c.moves[slot], `${c.id}.${slot}`).toBeDefined();
      }
      expect(c.support.name).toBeTruthy();
    }
    expect(new Set(ROSTER.map((c) => c.id)).size).toBe(ROSTER.length);
  });

  it("is deterministic for every match-up", () => {
    for (let a = 0; a < ROSTER.length; a++) {
      const b = (a * 5 + 3) % ROSTER.length;
      const ins = inputs(a + 1, 2400);
      expect(hashState(runAll(config(a, b), ins))).toBe(hashState(runAll(config(a, b), ins)));
    }
  });

  it("rolling back and re-simulating gives the same state", () => {
    const ins = inputs(7, 1500);
    const straight = runAll(config(2, 9), ins);
    const s = createGame(config(2, 9));
    const snaps = new Map<number, ReturnType<typeof cloneState>>();
    let cur = s;
    for (let f = 0; f < ins.length; f++) {
      snaps.set(f, cloneState(cur));
      // Every 9 frames, roll back 6 frames and re-simulate.
      if (f % 9 === 8) {
        cur = cloneState(snaps.get(f - 6)!);
        for (let g = f - 6; g < f; g++) step(cur, ins[g]);
      }
      step(cur, ins[f]);
    }
    expect(hashState(cur)).toBe(hashState(straight));
  });

  it("never mutates the snapshot it was cloned from", () => {
    const s = createGame(config());
    for (let i = 0; i < 200; i++) step(s, [BTN.RIGHT, BTN.LEFT]);
    const snap = cloneState(s);
    const h = hashState(snap);
    for (let i = 0; i < 300; i++) step(s, [BTN.LIGHT | BTN.RIGHT, BTN.SPECIAL]);
    expect(hashState(snap)).toBe(h);
  });

  it("random play reaches the end of a match without errors", () => {
    for (let a = 0; a < ROSTER.length; a++) {
      const s = createGame({ ...config(a, (a + 1) % ROSTER.length), time: 30 });
      const ins = inputs(100 + a, 60 * 200);
      for (const i of ins) {
        step(s, i);
        if (s.phase === "matchEnd") break;
        for (const f of s.fighters) {
          expect(Number.isFinite(f.x) && Number.isFinite(f.y)).toBe(true);
        }
      }
      expect(s.phase).toBe("matchEnd");
    }
  });

  it("a light punch at close range hurts", () => {
    const s = createGame(config());
    while (s.phase !== "fight") step(s, [0, 0]);
    s.fighters[0].x = 600;
    s.fighters[1].x = 660;
    const hp = s.fighters[1].hp;
    step(s, [BTN.LIGHT, 0]);
    for (let i = 0; i < 20; i++) step(s, [0, 0]);
    expect(s.fighters[1].hp).toBeLessThan(hp);
  });

  it("holding back blocks", () => {
    const s = createGame(config());
    while (s.phase !== "fight") step(s, [0, 0]);
    s.fighters[0].x = 600;
    s.fighters[1].x = 660;
    const hp = s.fighters[1].hp;
    step(s, [BTN.HEAVY, BTN.RIGHT]);
    for (let i = 0; i < 25; i++) step(s, [0, BTN.RIGHT]);
    const lost = hp - s.fighters[1].hp;
    expect(lost).toBeGreaterThan(0);
    expect(lost).toBeLessThan(20);
  });

  it("a super needs a full gauge", () => {
    const s = createGame(config());
    while (s.phase !== "fight") step(s, [0, 0]);
    step(s, [BTN.SUPER, 0]);
    expect(s.freezeBy).toBe(-1);
    s.fighters[0].meter = 1000;
    step(s, [0, 0]);
    step(s, [BTN.SUPER, 0]);
    expect(s.freezeBy).toBe(0);
    expect(s.fighters[0].meter).toBe(0);
  });
});
