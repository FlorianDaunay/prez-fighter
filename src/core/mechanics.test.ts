import { describe, expect, it } from "vitest";
import { BTN } from "./input";
import { charIndex } from "./roster";
import { createGame, step } from "./sim";
import type { GameState } from "./types";

/** A fight between two characters, intro skipped, P1 on the left facing right. */
function fight(a: string, b: string, gap = 80): GameState {
  const s = createGame({ chars: [charIndex(a), charIndex(b)], stage: "elysee", rounds: 2, time: 99, seed: 1 });
  while (s.phase !== "fight") step(s, [0, 0]);
  s.fighters[0].x = 500;
  s.fighters[1].x = 500 + gap;
  step(s, [0, 0]);
  return s;
}

const idle = (s: GameState, n: number, p1 = 0, p2 = 0) => {
  for (let i = 0; i < n; i++) step(s, [p1, p2]);
};

describe("move mechanics", () => {
  it("→ + Heavy is a command normal", () => {
    const s = fight("lepain", "hollandaise", 200);
    step(s, [BTN.RIGHT | BTN.HEAVY, 0]);
    expect(s.fighters[0].move).toBe("fH");
    expect(s.fighters[0].state).toBe("attack");
  });

  it("Special in the air uses the air special", () => {
    const s = fight("atable", "hollandaise", 300);
    step(s, [BTN.UP, 0]);
    idle(s, 6);
    step(s, [BTN.SPECIAL, 0]);
    expect(s.fighters[0].move).toBe("jS");
  });

  it("pressing Special again during a rekka goes on with the follow-ups", () => {
    const s = fight("philippate", "hollandaise", 140);
    step(s, [BTN.RIGHT | BTN.SPECIAL, 0]);
    expect(s.fighters[0].move).toBe("sF");
    // Presses made during the hit freeze are buffered: the follow-up starts as soon as allowed.
    const pressThen = (slot: string) => {
      step(s, [BTN.SPECIAL, 0]);
      for (let i = 0; i < 15 && s.fighters[0].move !== slot; i++) step(s, [0, 0]);
      expect(s.fighters[0].move).toBe(slot);
    };
    idle(s, 10);
    pressThen("f1");
    idle(s, 8);
    pressThen("f2");
  });

  it("an on-hit chain does not continue on a whiff", () => {
    const s = fight("sarkozix", "hollandaise", 600);
    step(s, [BTN.RIGHT | BTN.SPECIAL, 0]);
    idle(s, 20);
    step(s, [BTN.SPECIAL, 0]);
    expect(s.fighters[0].move).toBe("sF");
  });

  it("a reflect sends the projectile back to its thrower", () => {
    const s = fight("pingpong", "macaron", 400);
    step(s, [0, BTN.SPECIAL]);
    // Wait until the unicorn is close, then smash it back.
    for (let i = 0; i < 120 && !s.projectiles.some((p) => p.owner === 1 && p.x - s.fighters[0].x < 110); i++) step(s, [0, 0]);
    const hp = s.fighters[0].hp;
    step(s, [BTN.UP | BTN.SPECIAL, 0]);
    let reflected = false;
    for (let i = 0; i < 30; i++) {
      step(s, [0, 0]);
      if (s.projectiles.some((p) => p.owner === 0 && p.vx > 0)) reflected = true;
    }
    expect(reflected).toBe(true);
    expect(s.fighters[0].hp).toBe(hp);
  });

  it("healing moves restore health, capped at the maximum", () => {
    const s = fight("bayonne", "hollandaise", 400);
    s.fighters[0].hp = 500;
    step(s, [BTN.UP | BTN.SPECIAL, 0]);
    expect(s.fighters[0].hp).toBe(610);
    const t = fight("bayonne", "hollandaise", 400);
    step(t, [BTN.UP | BTN.SPECIAL, 0]);
    expect(t.fighters[0].hp).toBe(1070);
  });

  it("rage adds 25 % damage", () => {
    const hitWith = (rage: boolean) => {
      const s = fight("zemmour", "hollandaise", 60);
      if (rage) s.fighters[0].status.rage = 200;
      const hp = s.fighters[1].hp;
      step(s, [BTN.LIGHT, 0]);
      idle(s, 20);
      return hp - s.fighters[1].hp;
    };
    const base = hitWith(false);
    expect(base).toBeGreaterThan(0);
    expect(hitWith(true)).toBe(Math.round(base * 1.25));
  });

  it("a stealing grab gives health back to the attacker", () => {
    const s = fight("poutou", "hollandaise", 70);
    s.fighters[0].hp = 400;
    s.fighters[0].meter = 1000;
    step(s, [BTN.SUPER, 0]);
    idle(s, 120);
    expect(s.fighters[0].hp).toBeGreaterThan(400);
    expect(s.fighters[1].hp).toBeLessThan(1050);
  });

  it("teleport moves the fighter behind the opponent", () => {
    const s = fight("philippate", "hollandaise", 200);
    step(s, [BTN.UP | BTN.SPECIAL, 0]);
    idle(s, 14);
    expect(s.fighters[0].x).toBeGreaterThan(s.fighters[1].x);
    expect(s.fighters[0].facing).toBe(-1);
  });
});
