/**
 * Computer opponent. Lives outside the simulation (it only produces inputs), so it may keep
 * its own memory and use Math.random: it never runs in online matches.
 */
import { METER_MAX } from "./constants";
import { BTN } from "./input";
import { ROSTER } from "./roster";
import type { Fighter, GameState, MoveSlot } from "./types";

/** Input that starts each special slot, for a fighter facing `fwd`. */
const specialInput = (slot: MoveSlot, fwd: number) =>
  BTN.SPECIAL | (slot === "sF" ? fwd : slot === "sD" ? BTN.DOWN : slot === "sU" ? BTN.UP : 0);

export const AI_LEVELS = [
  { name: "Stagiaire", reaction: 22, block: 0.2, aggression: 0.35, antiAir: 0.15, combo: 0.2 },
  { name: "Député", reaction: 14, block: 0.45, aggression: 0.5, antiAir: 0.4, combo: 0.5 },
  { name: "Ministre", reaction: 9, block: 0.7, aggression: 0.6, antiAir: 0.65, combo: 0.75 },
  { name: "Président", reaction: 5, block: 0.88, aggression: 0.7, antiAir: 0.85, combo: 0.95 },
];

interface Step {
  input: number;
  frames: number;
}

interface Seen {
  x: number;
  y: number;
  vy: number;
  state: Fighter["state"];
  move: Fighter["move"];
  projectileClose: boolean;
}

export class CpuBrain {
  private queue: Step[] = [];
  private history: Seen[] = [];
  private idle = 0;
  private level;

  constructor(private me: number, level: number) {
    this.level = AI_LEVELS[Math.max(0, Math.min(AI_LEVELS.length - 1, level))];
  }

  private push(...steps: Step[]) {
    this.queue.push(...steps);
  }

  next(s: GameState): number {
    const me = s.fighters[this.me];
    const opp = s.fighters[1 - this.me];
    const projectileClose = s.projectiles.some((p) => p.owner !== this.me && Math.abs(p.x - me.x) < 260 && Math.sign(me.x - p.x) === Math.sign(p.vx || me.x - p.x));
    this.history.push({ x: opp.x, y: opp.y, vy: opp.vy, state: opp.state, move: opp.move, projectileClose });
    if (this.history.length > 40) this.history.shift();
    const seen = this.history[Math.max(0, this.history.length - 1 - this.level.reaction)];

    if (s.phase !== "fight") {
      this.queue = [];
      return 0;
    }
    const fwd = me.facing === 1 ? BTN.RIGHT : BTN.LEFT;
    const back = me.facing === 1 ? BTN.LEFT : BTN.RIGHT;
    const dist = Math.abs(opp.x - me.x);
    const moves = ROSTER[me.char].moves;
    const r = Math.random;
    const busy = me.state === "attack" || me.state === "hitstun" || me.state === "blockstun" || me.state === "airHit" || me.state === "knockdown";

    // Defence reacts even in the middle of a plan.
    const threatened = (seen.state === "attack" && dist < 230) || seen.projectileClose;
    if (threatened && !busy && me.y === 0 && this.queue.length < 4) {
      const reflector = (["sU", "sD", "sN"] as MoveSlot[]).find((sl) => moves[sl]?.reflect);
      if (seen.projectileClose && reflector && r() < this.level.block * 0.5) {
        this.queue = [{ input: specialInput(reflector, fwd), frames: 1 }, { input: 0, frames: 24 }];
      } else if (r() < this.level.block) {
        const low = seen.move === "cL" || seen.move === "cH";
        this.queue = [{ input: back | (low ? BTN.DOWN : 0), frames: 10 }];
      }
    }
    // Anti-air
    const antiAir = !!(moves.sU?.hitboxes?.length || moves.sU?.projectiles?.length);
    if (antiAir && seen.state === "jump" && seen.y > 30 && seen.vy < 4 && dist < 200 && !busy && this.queue.length === 0 && r() < this.level.antiAir * 0.25) {
      this.push({ input: BTN.UP | BTN.SPECIAL, frames: 1 }, { input: 0, frames: 30 });
    }

    if (this.queue.length === 0) {
      if (busy) return me.state === "blockstun" ? back : 0;
      this.plan(s, me, opp, dist, fwd, back, moves, r);
    }
    const st = this.queue[0];
    if (!st) return 0;
    st.frames--;
    if (st.frames <= 0) this.queue.shift();
    return st.input;
  }

  private plan(s: GameState, me: Fighter, opp: Fighter, dist: number, fwd: number, back: number, moves: (typeof ROSTER)[number]["moves"], r: () => number) {
    const L = this.level;
    // Super
    if (me.meter >= METER_MAX && dist < 420 && opp.state !== "knockdown" && r() < 0.05 + L.aggression * 0.05) {
      this.push({ input: BTN.SUPER, frames: 1 }, { input: 0, frames: 60 });
      return;
    }
    // Support
    if (me.supportCd === 0 && r() < 0.03 + L.aggression * 0.03) {
      this.push({ input: BTN.ASSIST, frames: 1 }, { input: 0, frames: 4 });
      return;
    }
    // Heal when hurt and out of reach.
    const healer = (["sU", "sD"] as MoveSlot[]).find((sl) => moves[sl]?.heal);
    if (healer && dist > 380 && me.hp < ROSTER[me.char].stats.hp * 0.6 && r() < 0.15) {
      this.push({ input: specialInput(healer, fwd), frames: 1 }, { input: 0, frames: 60 });
      return;
    }
    if (opp.state === "knockdown" || opp.state === "getup") {
      this.push({ input: r() < 0.5 ? fwd : 0, frames: 12 });
      return;
    }
    if (dist > 360) {
      if (moves.sN && r() < 0.35) this.push({ input: BTN.SPECIAL, frames: 1 }, { input: 0, frames: 30 });
      else if (r() < 0.12 && moves.sF) this.push({ input: fwd | BTN.SPECIAL, frames: 1 }, { input: 0, frames: 25 });
      else this.push({ input: fwd, frames: 14 + Math.floor(r() * 20) });
      return;
    }
    if (dist > 140) {
      const roll = r();
      if (roll < 0.25 * L.aggression + 0.1) {
        // Jump in, then a heavy or the air special.
        const air = moves.jS && r() < 0.4 ? BTN.SPECIAL : BTN.HEAVY;
        this.push({ input: BTN.UP | fwd, frames: 1 }, { input: fwd, frames: 14 }, { input: air, frames: 1 }, { input: 0, frames: 26 });
      } else if (roll < 0.3 && moves.fH) this.push({ input: fwd, frames: 6 }, { input: fwd | BTN.HEAVY, frames: 1 }, { input: 0, frames: 30 });
      else if (roll < 0.45) this.push({ input: fwd, frames: 10 + Math.floor(r() * 16) });
      else if (roll < 0.6 && moves.sN) this.push({ input: BTN.SPECIAL, frames: 1 }, { input: 0, frames: 25 });
      else if (roll < 0.7) this.push({ input: back, frames: 12 });
      else if (roll < 0.78 && moves.sF) this.push({ input: fwd | BTN.SPECIAL, frames: 1 }, { input: 0, frames: 30 });
      else this.push({ input: 0, frames: 8 + Math.floor(r() * 10) });
      return;
    }
    // Close range
    const roll = r();
    if (roll < 0.12) {
      this.push({ input: BTN.LIGHT | BTN.HEAVY, frames: 1 }, { input: 0, frames: 30 });
    } else if (roll < 0.12 + 0.5 * L.combo) {
      const slot = (["sF", "sD", "sU"] as MoveSlot[])[Math.floor(r() * 3)];
      this.push({ input: BTN.LIGHT, frames: 1 }, { input: 0, frames: 8 }, { input: BTN.HEAVY, frames: 1 }, { input: 0, frames: 9 }, { input: specialInput(slot, fwd), frames: 1 });
      // Follow the rekka through, pressing Special inside each chain window.
      let m = moves[slot];
      for (let depth = 0; m?.chain && depth < 3 && r() < 0.4 + L.combo * 0.6; depth++) {
        this.push({ input: 0, frames: m.chain.from + 2 }, { input: BTN.SPECIAL, frames: 1 });
        m = moves[m.chain.to];
      }
      this.push({ input: 0, frames: 34 });
    } else if (roll < 0.55 && moves.fH && r() < 0.35) {
      this.push({ input: fwd | BTN.HEAVY, frames: 1 }, { input: 0, frames: 30 });
    } else if (roll < 0.75) {
      this.push({ input: BTN.DOWN | BTN.HEAVY, frames: 1 }, { input: BTN.DOWN, frames: 28 });
    } else if (roll < 0.85) {
      this.push({ input: back, frames: 16 });
    } else {
      this.push({ input: BTN.DOWN | BTN.LIGHT, frames: 1 }, { input: BTN.DOWN, frames: 12 }, { input: BTN.LIGHT, frames: 1 }, { input: 0, frames: 12 });
    }
    void s;
    this.idle++;
  }
}
