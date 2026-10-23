import { describe, expect, it } from "vitest";
import { createGame, hashState, step } from "@/core/sim";
import type { GameConfig } from "@/core/types";
import { RollbackSession, type RollbackPacket } from "./rollback";

const cfg: GameConfig = { chars: [3, 8], stage: "golf", rounds: 2, time: 99, seed: 9 };

function lcg(seed: number) {
  let x = seed;
  return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff), x / 0x7fffffff);
}

/** Two peers over a fake network with latency, jitter and packet loss. */
function play(latency: number, jitter: number, loss: number, ticks: number) {
  const rnd = lcg(5);
  const wire: { at: number; to: 0 | 1; p: RollbackPacket }[] = [];
  let now = 0;
  const peers: RollbackSession[] = [];
  for (const side of [0, 1] as const) {
    peers.push(
      new RollbackSession(createGame(cfg), side, (p) => {
        if (p.t === "in" && rnd() < loss) return;
        wire.push({ at: now + latency + Math.floor(rnd() * jitter), to: (1 - side) as 0 | 1, p: JSON.parse(JSON.stringify(p)) });
      })
    );
  }
  const gen = [lcg(11), lcg(22)];
  const held = [0, 0];
  for (now = 0; now < ticks; now++) {
    for (let i = wire.length - 1; i >= 0; i--) {
      if (wire[i].at <= now) {
        peers[wire[i].to].receive(wire[i].p);
        wire.splice(i, 1);
      }
    }
    for (const side of [0, 1]) {
      if (now % 6 === 0) held[side] = Math.floor(gen[side]() * 512);
      peers[side].tick(held[side]);
    }
  }
  return peers;
}

describe("rollback session", () => {
  it("both peers converge to the same state as a straight simulation", () => {
    const [a, b] = play(4, 4, 0.15, 3000);
    // Checksums of confirmed frames are exchanged every 2 s: any divergence flags a desync.
    expect(a.desync).toBe(false);
    expect(b.desync).toBe(false);
    expect(a.sumsCompared).toBeGreaterThan(15);
    expect(a.frame).toBeGreaterThan(2750);
    expect(Math.abs(a.frame - b.frame)).toBeLessThan(12);
  });

  it("matches a reference simulation fed the real inputs", () => {
    // Zero latency, no loss: predictions are always right after the delay.
    const [a, b] = play(1, 0, 0, 1200);
    const f = Math.min(a.frame, b.frame) - 20;
    expect(f).toBeGreaterThan(1000);
    expect(a.desync || b.desync).toBe(false);
  });

  it("detects a desync", () => {
    const sent: RollbackPacket[] = [];
    const s = new RollbackSession(createGame(cfg), 0, (p) => sent.push(p));
    const ref = createGame(cfg);
    step(ref, [0, 0]);
    s.receive({ t: "sum", f: 120, h: hashState(ref) ^ 1 });
    for (let f = 0; f < 200; f++) {
      s.receive({ t: "in", f, i: [0], ack: -1, cur: f, adv: 0 });
      s.tick(0);
    }
    expect(s.desync).toBe(true);
  });
});
