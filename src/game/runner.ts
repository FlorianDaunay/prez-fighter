/**
 * Runs a match: fixed 60 Hz simulation (accumulator), rendering at display rate.
 * Offline: inputs from devices and/or the CPU. Online: rollback session.
 */
import { CpuBrain } from "@/core/ai";
import { createGame, step } from "@/core/sim";
import type { GameConfig, GameState } from "@/core/types";
import { pausePressed, playerInput, pollPads } from "@/input/manager";
import type { OnlineLink } from "@/net/online";
import { RollbackSession } from "@/net/rollback";
import { Renderer, type HudInfo } from "@/render/renderer";

export interface MatchSetup {
  config: GameConfig;
  /** CPU level per player (null = human). */
  cpu: [number | null, number | null];
  /** Every device controls player 1 (single-human modes). */
  solo: boolean;
  tags: [string, string];
  online?: { link: OnlineLink; local: 0 | 1; delay: number };
  training?: boolean;
}

const STEP_MS = 1000 / 60;

export class MatchRunner {
  state: GameState;
  private renderer: Renderer;
  private raf = 0;
  private acc = 0;
  private last = 0;
  private brains: (CpuBrain | null)[];
  private rb: RollbackSession | null = null;
  private ended = false;
  private pauseHeld = false;
  paused = false;
  private waiting = false;

  constructor(canvas: HTMLCanvasElement, private setup: MatchSetup, private cb: { onEnd: (s: GameState) => void; onPause: (p: boolean) => void }) {
    this.state = createGame(setup.config);
    this.renderer = new Renderer(canvas);
    this.renderer.setStage(setup.config.stage);
    this.renderer.reset(this.state);
    this.brains = setup.cpu.map((lvl, i) => (lvl === null ? null : new CpuBrain(i, lvl)));
    if (setup.online) {
      const { link, local, delay } = setup.online;
      this.rb = new RollbackSession(this.state, local, (p) => link.sendGame(p), { delay });
    }
  }

  /** Feed a packet received from the network. */
  receive = (p: Parameters<RollbackSession["receive"]>[0]) => this.rb?.receive(p);

  start() {
    if (import.meta.env.DEV) (window as unknown as { __match: MatchRunner }).__match = this;
    this.last = performance.now();
    const loop = (now: number) => {
      this.acc += Math.min(now - this.last, 100);
      this.last = now;
      let ticks = 0;
      while (this.acc >= STEP_MS && ticks < 4) {
        this.tick();
        this.acc -= STEP_MS;
        ticks++;
      }
      if (ticks === 4) this.acc = 0;
      const info: HudInfo = { tags: this.setup.tags, training: this.setup.training };
      if (this.rb && this.setup.online) {
        info.net = { ping: this.setup.online.link.rtt, rollback: this.rb.lastRollback, desync: this.rb.desync, waiting: this.waiting };
      }
      this.renderer.draw(this.state, info);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  setPaused(p: boolean) {
    if (this.rb) return;
    this.paused = p;
    this.cb.onPause(p);
  }

  private tick() {
    pollPads();
    const pause = pausePressed();
    if (pause && !this.pauseHeld && !this.rb && this.state.phase !== "matchEnd") this.setPaused(!this.paused);
    this.pauseHeld = pause;
    if (this.paused) return;

    if (this.rb) {
      this.waiting = !this.rb.tick(playerInput(0, true));
      this.state = this.rb.state;
    } else {
      const inputs: [number, number] = [0, 0];
      for (const p of [0, 1] as const) {
        const brain = this.brains[p];
        inputs[p] = brain ? brain.next(this.state) : this.setup.solo && p === 1 ? 0 : playerInput(p, this.setup.solo);
      }
      step(this.state, inputs);
    }
    if (this.state.phase === "matchEnd" && this.state.phaseFrame > 50 && !this.ended) {
      this.ended = true;
      this.cb.onEnd(this.state);
    }
  }
}
