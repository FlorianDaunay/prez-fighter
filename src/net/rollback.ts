/**
 * Rollback netcode (GGPO-style). Each peer simulates immediately with a guess of the remote
 * input (its last known one); when the real input arrives and differs, the state is restored
 * from a snapshot and re-simulated. A small input delay keeps rollbacks short.
 * Transport-agnostic: give it a `send` function and feed it received messages.
 */
import { cloneState, hashState, step } from "@/core/sim";
import type { GameState } from "@/core/types";

export interface InputPacket {
  t: "in";
  /** Frame of the first input in `i`. */
  f: number;
  i: number[];
  /** Highest frame of the receiver's inputs the sender has (contiguous). */
  ack: number;
  /** Sender's current simulation frame (for time sync). */
  cur: number;
  /** Sender's own view of how far ahead it runs. */
  adv: number;
}

export interface ChecksumPacket {
  t: "sum";
  f: number;
  h: number;
}

export type RollbackPacket = InputPacket | ChecksumPacket;

export interface RollbackOptions {
  delay?: number;
  maxRollback?: number;
}

export class RollbackSession {
  state: GameState;
  readonly local: 0 | 1;
  readonly delay: number;
  readonly maxRollback: number;
  private localInputs = new Map<number, number>();
  private remoteInputs = new Map<number, number>();
  private predicted = new Map<number, number>();
  private snapshots = new Map<number, GameState>();
  private sums = new Map<number, number>();
  private remoteSums = new Map<number, number>();
  /** Highest contiguous remote input frame received. */
  private remoteContig: number;
  /** Highest local frame the remote confirmed. */
  private remoteAck = -1;
  private remoteCur = 0;
  private remoteAdv = 0;
  private rollbackFrom = Infinity;
  private ticks = 0;
  private lastSumFrame = 0;
  lastRollback = 0;
  stalls = 0;
  desync = false;
  sumsCompared = 0;

  constructor(state: GameState, local: 0 | 1, private send: (p: RollbackPacket) => void, opts: RollbackOptions = {}) {
    this.state = state;
    this.local = local;
    this.delay = opts.delay ?? 2;
    this.maxRollback = opts.maxRollback ?? 8;
    for (let f = 0; f < this.delay; f++) {
      this.localInputs.set(f, 0);
      this.remoteInputs.set(f, 0);
    }
    this.remoteContig = this.delay - 1;
  }

  /** Frame about to be simulated. */
  get frame() {
    return this.state.frame;
  }

  /** How far ahead of the remote peer we run, in frames (latency cancels out, GGPO-style). */
  get advantage() {
    return (this.frame - this.remoteCur - this.remoteAdv) / 2;
  }

  receive(p: RollbackPacket) {
    if (p.t === "sum") {
      this.remoteSums.set(p.f, p.h);
      this.checkSum(p.f);
      return;
    }
    this.remoteAck = Math.max(this.remoteAck, p.ack);
    if (p.cur >= this.remoteCur) {
      this.remoteCur = p.cur;
      this.remoteAdv = p.adv;
    }
    p.i.forEach((input, k) => {
      const f = p.f + k;
      if (this.remoteInputs.has(f)) return;
      this.remoteInputs.set(f, input);
      const guess = this.predicted.get(f);
      if (guess !== undefined && guess !== input) this.rollbackFrom = Math.min(this.rollbackFrom, f);
    });
    while (this.remoteInputs.has(this.remoteContig + 1)) this.remoteContig++;
  }

  private remoteFor(f: number): number {
    const real = this.remoteInputs.get(f);
    if (real !== undefined) return real;
    // Prediction: the last known input keeps being held.
    for (let g = Math.min(f, this.remoteContig); g >= 0; g--) {
      const v = this.remoteInputs.get(g);
      if (v !== undefined) return v;
    }
    return 0;
  }

  private simulate(f: number) {
    const mine = this.localInputs.get(f) ?? 0;
    const theirs = this.remoteFor(f);
    if (!this.remoteInputs.has(f)) this.predicted.set(f, theirs);
    else this.predicted.delete(f);
    this.snapshots.set(f, cloneState(this.state));
    step(this.state, this.local === 0 ? [mine, theirs] : [theirs, mine]);
  }

  /** Checksums confirmed frames every 2 seconds (the snapshot after frame f is final once f is confirmed). */
  private checkConfirmed() {
    const f = this.lastSumFrame + 120;
    const after = this.snapshots.get(f + 1);
    if (f + 1 > this.remoteContig || !after) return;
    this.lastSumFrame = f;
    const h = hashState(after);
    this.sums.set(f, h);
    this.send({ t: "sum", f, h });
    this.checkSum(f);
  }

  private checkSum(f: number) {
    const a = this.sums.get(f);
    const b = this.remoteSums.get(f);
    if (a === undefined || b === undefined) return;
    this.sumsCompared++;
    if (a !== b) this.desync = true;
  }

  /** Sends our unacknowledged inputs (redundantly, so lost packets do not matter). */
  private flush() {
    const latest = this.frame + this.delay;
    const from = Math.max(this.remoteAck + 1, latest - 40);
    const list: number[] = [];
    for (let f = from; f <= latest; f++) {
      const v = this.localInputs.get(f);
      if (v === undefined) break;
      list.push(v);
    }
    if (list.length) this.send({ t: "in", f: from, i: list, ack: this.remoteContig, cur: this.frame, adv: this.frame - this.remoteCur });
  }

  /**
   * One tick (call at 60 Hz). `input` is the local player's current input. Returns false when
   * the simulation had to wait for the remote peer.
   */
  tick(input: number): boolean {
    this.ticks++;
    // Rollback if a prediction was wrong.
    if (this.rollbackFrom < this.frame) {
      const from = this.rollbackFrom;
      const snap = this.snapshots.get(from);
      if (snap) {
        const target = this.frame;
        this.state = cloneState(snap);
        for (let f = from; f < target; f++) this.simulate(f);
        this.lastRollback = target - from;
      }
    }
    this.rollbackFrom = Infinity;

    // Too far ahead of what we know: wait.
    const tooFar = this.frame - this.remoteContig > this.maxRollback;
    // Time sync: the peer that runs ahead gives frames back, smoothly.
    const ahead = this.advantage >= 1.5 && this.ticks % 4 === 0;
    if (tooFar || ahead) {
      this.stalls++;
      this.flush();
      return false;
    }
    const target = this.frame + this.delay;
    if (!this.localInputs.has(target)) this.localInputs.set(target, input);
    this.flush();
    this.simulate(this.frame);
    this.checkConfirmed();
    this.cleanup();
    return true;
  }

  private cleanup() {
    const keep = Math.min(this.remoteContig, this.frame) - this.maxRollback - 4;
    for (const map of [this.snapshots, this.predicted, this.localInputs, this.remoteInputs] as Map<number, unknown>[]) {
      if (map.size < 200) continue;
      for (const k of map.keys()) if (k < keep) map.delete(k);
    }
    if (this.sums.size > 50) {
      for (const k of this.sums.keys()) if (k < keep - 600) this.sums.delete(k);
      for (const k of this.remoteSums.keys()) if (k < keep - 600) this.remoteSums.delete(k);
    }
  }
}
