/** Draws a GameState on a 960×540 canvas: stage, fighters, effects and HUD. */
import { GROUND_Y, METER_MAX, SCREEN_H, SCREEN_W, STAGE_W } from "@/core/constants";
import { ROSTER, shortName } from "@/core/roster";
import { projRect, sim } from "@/core/sim";
import type { Fighter, GameEvent, GameState, StatusKind, Support } from "@/core/types";
import { announce, sfx } from "@/audio/engine";
import { useSettings } from "@/store/settings";
import { FX_SPRITE, Particles, drawLaptop, drawPanda, drawProjectile, drawScooter, drawWall } from "./fx";
import { drawSprite } from "./sprites";
import { LOOKS } from "./looks";
import { drawPerson } from "./person";
import { extension, fighterPose, namedPose } from "./poses";
import { portrait } from "./portraits";
import { buildStage, drawStage, type StageLayers } from "./stages";

export interface HudInfo {
  tags: [string, string];
  net?: { ping: number; rollback: number; desync: boolean; waiting: boolean };
  training?: boolean;
}

const STATUS_LABEL: Record<StatusKind, string> = {
  slow: "RALENTI",
  reverse: "COMMANDES INVERSÉES",
  stun: "SONNÉ",
  freeze: "GELÉ",
  taxed: "TAXÉ +30 %",
  dot: "AFFAIBLI",
  shield: "BOUCLIER",
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private scratch: HTMLCanvasElement;
  private sctx: CanvasRenderingContext2D;
  private stage: StageLayers | null = null;
  private stageId = "";
  readonly particles = new Particles();
  private shake = 0;
  private hpShown = [1000, 1000];
  private cam = (STAGE_W - SCREEN_W) / 2;
  private lastFrame = -1;
  private message: { text: string; sub?: string; color: string; at: number; dur: number } | null = null;
  private t = 0;

  /** Preview mode (menus): no HUD, no sound. */
  constructor(canvas: HTMLCanvasElement, private preview = false) {
    this.ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
    this.scratch = document.createElement("canvas");
    this.scratch.width = 440;
    this.scratch.height = 470;
    this.sctx = this.scratch.getContext("2d")!;
  }

  setStage(id: string) {
    if (this.stageId === id) return;
    this.stageId = id;
    this.stage = buildStage(id);
  }

  reset(state: GameState) {
    this.hpShown = state.fighters.map((f) => f.hp);
    this.lastFrame = -1;
    this.particles.list = [];
    this.message = null;
  }

  // ---------------------------------------------------------------- events

  private onEvents(state: GameState) {
    if (state.frame === this.lastFrame) return;
    const fresh = state.frame !== this.lastFrame;
    this.lastFrame = state.frame;
    if (!fresh) return;
    this.particles.update();
    for (const e of state.events) this.event(state, e);
    // Move effects
    for (const f of state.fighters) {
      if (f.state !== "attack" || !f.move) continue;
      const def = ROSTER[f.char].moves[f.move];
      if (!def?.fx) continue;
      if (extension(def, f.moveFrame) > 0.6 && f.moveFrame % 3 === 0) {
        const e = FX_SPRITE[def.fx];
        if (e) {
          const size = ROSTER[f.char].stats.size;
          this.particles.add({
            kind: "emoji",
            text: e,
            x: f.x + f.facing * (20 + Math.random() * 60) * size,
            y: f.y + (40 + Math.random() * 130) * size,
            vx: f.facing * (1 + Math.random() * 2),
            vy: -1 - Math.random() * 2,
            size: 22 + Math.random() * 12,
            life: 26,
            rot: Math.random(),
          });
        }
      }
    }
    for (const f of state.fighters) {
      if ((f.status.stun ?? 0) > 0 && state.frame % 10 === 0) {
        this.particles.add({ kind: "star", text: "star", x: f.x + (Math.random() - 0.5) * 50, y: f.y + 200, vy: -1, size: 16, life: 24 });
      }
    }
  }

  private flashMessage(text: string, color: string, dur = 60, sub?: string) {
    this.message = { text, color, dur, at: this.t, sub };
  }

  private event(state: GameState, e: GameEvent) {
    if (this.preview) {
      if (e.type === "hit" || e.type === "block" || e.type === "throw") this.particles.burst(e.x, e.y, "#fff2a0", 8, 6, 3);
      return;
    }
    const pan = (e.x - (this.cam + SCREEN_W / 2)) / (SCREEN_W / 2);
    const P = this.particles;
    switch (e.type) {
      case "hit": {
        const heavy = e.s === "heavy";
        sfx(heavy ? "heavy" : "light", pan);
        P.add({ kind: "flash", x: e.x, y: e.y, size: heavy ? 46 : 30, color: e.s === "armor" ? "#9fd0ff" : "#fff6a0", life: 8, rot: Math.random() });
        P.burst(e.x, e.y, heavy ? "#ffb02e" : "#fff2a0", heavy ? 14 : 8, heavy ? 9 : 6, heavy ? 4 : 3);
        if (heavy) this.shake = Math.max(this.shake, 8);
        if (e.s === "armor") P.add({ kind: "text", text: "ARMURE", x: e.x, y: e.y + 40, vy: -1.5, size: 20, color: "#9fd0ff", life: 40 });
        break;
      }
      case "throw":
        sfx("throw", pan);
        this.shake = 12;
        P.burst(e.x, e.y, "#fff", 18, 10);
        break;
      case "block":
        sfx("block", pan);
        P.add({ kind: "ring", x: e.x, y: e.y, size: 26, color: "#7fd0ff", life: 10 });
        P.burst(e.x, e.y, "#bfe6ff", 6, 5, 2);
        break;
      case "whiff":
        sfx("whiff", pan);
        break;
      case "ko":
        sfx("ko", pan);
        this.shake = 20;
        P.add({ kind: "flash", x: e.x, y: e.y, size: 120, color: "#ffffff", life: 14 });
        this.flashMessage("K.O. !", "#ff3b3b", 90);
        announce("K.O. !");
        break;
      case "round": {
        sfx("round");
        const final = state.fighters[0].rounds === state.config.rounds - 1 && state.fighters[1].rounds === state.config.rounds - 1;
        this.flashMessage(final ? "MANCHE FINALE" : `ROUND ${e.v}`, "#ffd94a", 66);
        announce(final ? "Manche finale" : `Round ${e.v}`);
        break;
      }
      case "fight":
        sfx("fight");
        this.flashMessage("COMBAT !", "#ff5a2e", 45);
        announce("Combat !");
        break;
      case "super": {
        sfx("super", pan);
        if (e.s) announce(e.s);
        break;
      }
      case "support":
        sfx("support", pan);
        break;
      case "proj":
        sfx("proj", pan);
        break;
      case "counter":
        sfx("counter", pan);
        P.add({ kind: "text", text: "CONTRE !", x: e.x, y: e.y + 60, vy: -2, size: 30, color: "#ffd94a", life: 50 });
        P.add({ kind: "ring", x: e.x, y: e.y, size: 60, color: "#ffd94a", life: 16 });
        break;
      case "clash":
        sfx("clash", pan);
        P.add({ kind: "flash", x: e.x, y: e.y, size: 40, color: "#fff", life: 10 });
        break;
      case "wall":
        sfx("wall", pan);
        for (let i = 0; i < 8; i++) P.add({ kind: "dust", x: e.x + (Math.random() - 0.5) * 60, y: 6, vx: (Math.random() - 0.5) * 3, vy: -1, size: 8, color: "rgba(180,160,130,0.7)", life: 24 });
        break;
      case "land":
        if (Math.random() < 0.6) P.add({ kind: "dust", x: e.x, y: 4, vx: 0, vy: -0.6, size: 9, color: "rgba(200,190,170,0.6)", life: 16 });
        break;
      case "timeout":
        this.flashMessage("TEMPS !", "#ffd94a", 90);
        announce("Temps écoulé !");
        break;
      case "perfect":
        sfx("perfect");
        P.add({ kind: "text", text: "PARFAIT !", x: e.x, y: 260, vy: -0.5, size: 40, color: "#7dff7a", life: 100 });
        announce("Parfait !");
        break;
      case "status":
        sfx("status", pan);
        if (e.s) P.add({ kind: "text", text: STATUS_LABEL[e.s as StatusKind] ?? e.s, x: e.x, y: e.y, vy: -1.2, size: 18, color: "#c9a0ff", life: 60 });
        break;
    }
  }

  // ---------------------------------------------------------------- drawing

  draw(state: GameState, info: HudInfo) {
    this.t++;
    this.onEvents(state);
    const c = this.ctx;
    const [a, b] = state.fighters;
    const target = Math.min(STAGE_W - SCREEN_W, Math.max(0, (a.x + b.x) / 2 - SCREEN_W / 2));
    this.cam += (target - this.cam) * 0.25;
    if (Math.abs(target - this.cam) < 0.3) this.cam = target;
    const cam = this.cam;
    const shakeOn = useSettings.getState().screenShake;
    const sx = shakeOn ? (Math.random() - 0.5) * this.shake : 0;
    const sy = shakeOn ? (Math.random() - 0.5) * this.shake : 0;
    this.shake *= 0.85;
    if (this.shake < 0.5) this.shake = 0;

    c.save();
    c.translate(sx, sy);
    if (this.stage) drawStage(c, this.stage, cam, this.t);
    else {
      c.fillStyle = "#222";
      c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
    for (const w of state.walls) drawWall(c, w, w.x - cam, GROUND_Y);
    // Shadows
    for (const f of state.fighters) {
      const size = ROSTER[f.char].stats.size;
      const k = Math.max(0.3, 1 - f.y / 300);
      c.fillStyle = "rgba(0,0,0,0.28)";
      c.beginPath();
      c.ellipse(f.x - cam, GROUND_Y + 2, 44 * size * k, 9 * k, 0, 0, Math.PI * 2);
      c.fill();
    }
    for (const s of state.supports) this.drawSupport(state, s, cam);
    const order = [0, 1].sort((i, j) => (state.fighters[i].state === "attack" ? 1 : 0) - (state.fighters[j].state === "attack" ? 1 : 0));
    for (const i of order) this.drawFighter(state.fighters[i], i, cam);
    for (const p of state.projectiles) {
      const r = projRect(p);
      drawProjectile(c, p, r.x - cam, GROUND_Y - r.y, this.t);
    }
    this.particles.draw(c, cam, GROUND_Y);
    this.stage?.art.front?.(c, this.t, cam);
    for (const f of state.fighters) this.drawShout(f, cam);
    c.restore();

    if (this.preview) return;
    if (state.freezeBy >= 0) this.drawSuperCutIn(state);
    this.drawHud(state, info);
    this.drawMessages(state);
  }

  private drawFighter(f: Fighter, idx: number, cam: number) {
    const look = LOOKS[ROSTER[f.char].look];
    const pose = fighterPose(f, this.t + idx * 37);
    const s = this.sctx;
    s.clearRect(0, 0, this.scratch.width, this.scratch.height);
    drawPerson(s, look, pose, { x: 220, y: 450, facing: f.facing, scale: 1 });
    const flash = (f.state === "hitstun" || f.state === "airHit") && f.stateFrame < 3 ? 0.75 : 0;
    const frozen = (f.status.freeze ?? 0) > 0;
    const tint = frozen ? "#9fe0ff" : (f.status.taxed ?? 0) > 0 ? "#ffb347" : (f.status.slow ?? 0) > 0 ? "#9ad07a" : null;
    if (flash || tint) {
      s.save();
      s.globalCompositeOperation = "source-atop";
      s.globalAlpha = flash || 0.35;
      s.fillStyle = flash ? "#ffffff" : tint!;
      s.fillRect(0, 0, this.scratch.width, this.scratch.height);
      s.restore();
    }
    const c = this.ctx;
    const x = f.x - cam;
    const y = GROUND_Y - f.y;
    const superGlow = f.move === "super" && f.state === "attack";
    if (superGlow) {
      c.save();
      c.shadowColor = ROSTER[f.char].color;
      c.shadowBlur = 24;
    }
    const invuln = f.state === "getup" || (f.state === "attack" && (() => {
      const d = sim.moveOf(f);
      return d?.invuln && f.moveFrame >= d.invuln[0] && f.moveFrame <= d.invuln[1];
    })());
    if (invuln && this.t % 4 < 2 && f.state === "getup") c.globalAlpha = 0.7;
    c.drawImage(this.scratch, x - 220, y - 450);
    c.globalAlpha = 1;
    if (superGlow) c.restore();
    // Status icons above the head
    const size = ROSTER[f.char].stats.size;
    const icons: string[] = [];
    if ((f.status.slow ?? 0) > 0) icons.push("snail");
    if ((f.status.reverse ?? 0) > 0) icons.push("swap");
    if ((f.status.taxed ?? 0) > 0) icons.push("dollar");
    if (frozen) icons.push("ice");
    icons.forEach((ic, k) => drawSprite(c, ic, x + (k - (icons.length - 1) / 2) * 26, y - 235 * size, 22));
    if ((f.status.stun ?? 0) > 0) {
      for (let k = 0; k < 3; k++) {
        const a = this.t * 0.12 + (k * Math.PI * 2) / 3;
        drawSprite(c, "star", x + Math.cos(a) * 30, y - 215 * size + Math.sin(a) * 8, 16);
      }
    }
  }

  private drawSupport(state: GameState, s: Support, cam: number) {
    const owner = state.fighters[s.owner];
    const def = ROSTER[owner.char].support;
    const x = s.x - cam;
    const y = GROUND_Y - s.y;
    const fadeIn = Math.min(1, s.age / 8);
    const fadeOut = Math.min(1, (def.frames - s.age) / 10);
    const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    if (def.look === "scooter") {
      drawScooter(c, x, y, s.facing, this.t);
      c.restore();
      return;
    }
    if (def.look === "pandas") {
      for (let i = 0; i < 3; i++) drawPanda(c, x - s.facing * i * 58, y, this.t + i * 7, s.facing);
      c.restore();
      return;
    }
    const look = LOOKS[def.look];
    const acting = s.age >= def.actFrame;
    const k = acting ? Math.max(0, 1 - (s.age - def.actFrame) / 30) : Math.min(1, s.age / Math.max(1, def.actFrame));
    const pose = namedPose(acting ? "throw" : "raise", acting ? 1 : k * 0.3);
    if (def.look === "hologram") c.globalAlpha = alpha * (0.6 + Math.sin(this.t * 0.7) * 0.15);
    const n = def.members;
    for (let i = n - 1; i >= 0; i--) {
      const ox = -s.facing * (i - (n - 1) / 2) * 46;
      const sc = n > 1 ? 0.85 : 0.95;
      const sctx = this.sctx;
      sctx.clearRect(0, 0, this.scratch.width, this.scratch.height);
      drawPerson(sctx, look, { ...pose, expr: acting ? "shout" : pose.expr }, { x: 220, y: 450, facing: s.facing, scale: sc });
      if (look.tint) {
        sctx.save();
        sctx.globalCompositeOperation = "source-atop";
        sctx.globalAlpha = 0.5;
        sctx.fillStyle = look.tint;
        sctx.fillRect(0, 0, this.scratch.width, this.scratch.height);
        sctx.fillStyle = "rgba(255,255,255,0.25)";
        for (let yy = (this.t * 2) % 6; yy < this.scratch.height; yy += 6) sctx.fillRect(0, yy, this.scratch.width, 2);
        sctx.restore();
      }
      c.drawImage(this.scratch, x + ox - 220, y - 450);
      if (def.look === "trolls") drawLaptop(c, x + ox + s.facing * 8, y - 75, s.facing);
    }
    if (def.look === "elon" && !acting) drawSprite(c, "rocket", x + s.facing * 30, y - 120, 34, Math.PI + 0.5 * s.facing);
    if (def.look === "ursula") {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + this.t * 0.05;
        drawSprite(c, "star", x + Math.cos(a) * 70, y - 120 + Math.sin(a) * 70, 12);
      }
    }
    if (def.look === "carla" && !acting) drawSprite(c, "guitar", x + s.facing * 18, y - 80, 40, 0, s.facing < 0);
    // Name tag
    if (s.age < 50) {
      c.globalAlpha = alpha;
      c.font = "14px Bungee, Impact";
      c.textAlign = "center";
      c.lineWidth = 4;
      c.strokeStyle = "#111";
      c.strokeText(def.name, x, y - 230);
      c.fillStyle = ROSTER[owner.char].color === "#f2f2f2" ? "#ffd94a" : "#fff";
      c.fillText(def.name, x, y - 230);
    }
    c.restore();
  }

  private drawShout(f: Fighter, cam: number) {
    if (f.shoutFrames <= 0 || !f.shout) return;
    const c = this.ctx;
    const size = ROSTER[f.char].stats.size;
    const x = f.x - cam + f.facing * 50;
    const y = GROUND_Y - f.y - 245 * size;
    const pop = Math.min(1, (75 - f.shoutFrames) / 6);
    c.save();
    c.globalAlpha = Math.min(1, f.shoutFrames / 10);
    c.translate(x, y);
    c.scale(pop, pop);
    c.font = "16px Bungee, Impact, sans-serif";
    const w = c.measureText(f.shout).width + 22;
    c.fillStyle = "#fff";
    c.strokeStyle = "#111";
    c.lineWidth = 3;
    c.beginPath();
    c.roundRect(-w / 2, -18, w, 34, 12);
    c.moveTo(-f.facing * 10, 16);
    c.lineTo(-f.facing * 26, 30);
    c.lineTo(-f.facing * 2, 16);
    c.fill();
    c.stroke();
    c.fillStyle = "#fff";
    c.fillRect(-f.facing * 20 - 6, 12, 18, 6);
    c.fillStyle = "#111";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(f.shout, 0, 0);
    c.restore();
  }

  private drawSuperCutIn(state: GameState) {
    const c = this.ctx;
    const f = state.fighters[state.freezeBy];
    const char = ROSTER[f.char];
    const k = 1 - state.freezeFrames / 48;
    c.fillStyle = "rgba(0,0,0,0.45)";
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const slide = Math.min(1, k * 4);
    const left = state.freezeBy === 0;
    c.save();
    c.translate(SCREEN_W / 2, SCREEN_H / 2 - 40);
    c.rotate(-0.12);
    c.fillStyle = char.color;
    c.fillRect(-SCREEN_W, -70, SCREEN_W * 2, 140);
    c.fillStyle = "rgba(255,255,255,0.25)";
    for (let i = 0; i < 12; i++) c.fillRect(-SCREEN_W + ((i * 160 + k * 900) % (SCREEN_W * 2)), -70, 40, 140);
    const p = portrait(char.look, 220, left ? 1 : -1, "shout");
    c.drawImage(p, (left ? -1 : 1) * (SCREEN_W / 2 - 160) * (1 - 0.6 * slide) - 110 + (left ? -300 : 300) * (1 - slide), -150);
    c.font = "44px Bungee, Impact";
    c.textAlign = "center";
    c.lineWidth = 8;
    c.strokeStyle = "#111";
    c.strokeText(char.moves.super!.name.toUpperCase(), (left ? 120 : -120), 18);
    c.fillStyle = "#fff";
    c.fillText(char.moves.super!.name.toUpperCase(), (left ? 120 : -120), 18);
    c.restore();
  }

  private drawHud(state: GameState, info: HudInfo) {
    const c = this.ctx;
    const BAR_W = 330;
    state.fighters.forEach((f, i) => {
      const char = ROSTER[f.char];
      const max = char.stats.hp;
      if (this.hpShown[i] > f.hp) {
        if (f.combo === 0 || f.state === "knockdown") this.hpShown[i] = Math.max(f.hp, this.hpShown[i] - 6);
      } else this.hpShown[i] = f.hp;
      const left = i === 0;
      const x0 = left ? 100 : SCREEN_W - 100 - BAR_W;
      // Portrait
      const pimg = portrait(char.look, 76, left ? 1 : -1, f.state === "ko" ? "ko" : f.state === "hitstun" || f.state === "airHit" ? "hurt" : "neutral");
      const px = left ? 16 : SCREEN_W - 92;
      c.fillStyle = "#111";
      c.fillRect(px - 3, 7, 82, 82);
      c.fillStyle = char.color;
      c.fillRect(px, 10, 76, 76);
      c.drawImage(pimg, px, 10);
      // Health
      c.fillStyle = "#111";
      c.beginPath();
      c.roundRect(x0 - 4, 18, BAR_W + 8, 30, 6);
      c.fill();
      c.fillStyle = "#3a0d0d";
      c.fillRect(x0, 22, BAR_W, 22);
      const lag = (this.hpShown[i] / max) * BAR_W;
      const hp = (Math.max(0, f.hp) / max) * BAR_W;
      c.fillStyle = "#e23b2e";
      c.fillRect(left ? x0 + BAR_W - lag : x0, 22, lag, 22);
      const g = c.createLinearGradient(0, 22, 0, 44);
      const low = f.hp / max < 0.25;
      g.addColorStop(0, low && this.t % 20 < 10 ? "#ff8a3a" : "#ffe14a");
      g.addColorStop(1, low ? "#e2621a" : "#f2a81a");
      c.fillStyle = g;
      c.fillRect(left ? x0 + BAR_W - hp : x0, 22, hp, 22);
      c.fillStyle = "rgba(255,255,255,0.35)";
      c.fillRect(left ? x0 + BAR_W - hp : x0, 23, hp, 5);
      // Name + tag
      c.font = "16px Bungee, Impact";
      c.textAlign = left ? "left" : "right";
      c.lineWidth = 4;
      c.strokeStyle = "#111";
      const label = `${info.tags[i]} · ${char.name.toUpperCase()}`;
      c.strokeText(label, left ? x0 : x0 + BAR_W, 68);
      c.fillStyle = "#fff";
      c.fillText(label, left ? x0 : x0 + BAR_W, 68);
      // Round pips
      for (let r = 0; r < state.config.rounds; r++) {
        const rx = left ? x0 + BAR_W - 12 - r * 22 : x0 + 12 + r * 22;
        c.fillStyle = "#111";
        c.beginPath();
        c.arc(rx, 62, 8, 0, Math.PI * 2);
        c.fill();
        if (r < f.rounds) {
          c.fillStyle = "#ffd94a";
          c.beginPath();
          c.arc(rx, 62, 6, 0, Math.PI * 2);
          c.fill();
        }
      }
      // Super meter
      const mw = 250;
      const mx = left ? 20 : SCREEN_W - 20 - mw;
      const full = f.meter >= METER_MAX;
      c.fillStyle = "#111";
      c.beginPath();
      c.roundRect(mx - 3, SCREEN_H - 34, mw + 6, 20, 5);
      c.fill();
      const mv = (f.meter / METER_MAX) * mw;
      c.fillStyle = full ? (this.t % 16 < 8 ? "#5ef0ff" : "#2aa8ff") : "#2a6cff";
      c.fillRect(left ? mx : mx + mw - mv, SCREEN_H - 31, mv, 14);
      c.font = "13px Bungee, Impact";
      c.textAlign = left ? "left" : "right";
      c.fillStyle = full ? "#fff" : "#9fb8ff";
      c.strokeStyle = "#111";
      c.lineWidth = 3;
      const sl = full ? "SUPER PRÊT !" : "SUPER";
      c.strokeText(sl, left ? mx + 4 : mx + mw - 4, SCREEN_H - 40);
      c.fillText(sl, left ? mx + 4 : mx + mw - 4, SCREEN_H - 40);
      // Support icon with cooldown
      const sup = char.support;
      const ix = left ? mx + mw + 34 : mx - 34;
      const iy = SCREEN_H - 34;
      const ready = f.supportCd === 0;
      c.save();
      c.beginPath();
      c.arc(ix, iy, 22, 0, Math.PI * 2);
      c.fillStyle = ready ? char.color : "#333";
      c.fill();
      c.clip();
      const supImg = sup.look === "scooter" ? null : portrait(sup.look === "pandas" ? "pingpong" : sup.look, 48, left ? 1 : -1);
      if (supImg) c.drawImage(supImg, ix - 24, iy - 24);
      else drawSprite(c, "scooter", ix, iy, 28);
      if (sup.look === "pandas") {
        c.fillStyle = char.color;
        c.fillRect(ix - 24, iy - 24, 48, 48);
        drawSprite(c, "panda", ix, iy, 30);
      }
      if (!ready) {
        c.fillStyle = "rgba(0,0,0,0.6)";
        c.beginPath();
        c.moveTo(ix, iy);
        c.arc(ix, iy, 24, -Math.PI / 2, -Math.PI / 2 + (f.supportCd / sup.cooldown) * Math.PI * 2);
        c.fill();
      }
      c.restore();
      c.strokeStyle = ready ? "#fff" : "#666";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(ix, iy, 22, 0, Math.PI * 2);
      c.stroke();
      // Combo counter (shown on the attacker's side)
      if (f.combo >= 2) {
        const ax = left ? SCREEN_W - 200 : 200;
        c.font = "34px Bungee, Impact";
        c.textAlign = "center";
        c.lineWidth = 6;
        c.strokeStyle = "#111";
        c.strokeText(`${f.combo} COUPS`, ax, 150);
        c.fillStyle = "#ffd94a";
        c.fillText(`${f.combo} COUPS`, ax, 150);
        c.font = "16px Bungee, Impact";
        c.strokeText(`${f.comboDamage} dégâts`, ax, 174);
        c.fillStyle = "#fff";
        c.fillText(`${f.comboDamage} dégâts`, ax, 174);
      }
    });
    // Timer
    c.fillStyle = "#111";
    c.beginPath();
    c.roundRect(SCREEN_W / 2 - 38, 8, 76, 58, 10);
    c.fill();
    c.font = "38px Bungee, Impact";
    c.textAlign = "center";
    c.fillStyle = state.timer > 0 && state.timer < 600 && this.t % 30 < 15 ? "#ff5a3a" : "#ffd94a";
    const time = state.config.time === 0 || info.training ? "∞" : String(Math.ceil(state.timer / 60));
    c.fillText(time, SCREEN_W / 2, 52);
    if (info.net) {
      c.font = "11px Inter, sans-serif";
      c.textAlign = "center";
      c.fillStyle = info.net.desync ? "#ff5a3a" : "rgba(255,255,255,0.8)";
      c.fillText(`${Math.round(info.net.ping)} ms · rb ${info.net.rollback}${info.net.desync ? " · DÉSYNC" : ""}${info.net.waiting ? " · attente…" : ""}`, SCREEN_W / 2, 82);
    }
    if (info.training) {
      c.font = "14px Bungee, Impact";
      c.fillStyle = "#7dff7a";
      c.fillText("ENTRAÎNEMENT", SCREEN_W / 2, 84);
    }
  }

  private drawMessages(state: GameState) {
    const c = this.ctx;
    let text = "";
    let color = "#fff";
    let scale = 1;
    if (this.message && this.t - this.message.at < this.message.dur) {
      text = this.message.text;
      color = this.message.color;
      scale = Math.min(1, (this.t - this.message.at) / 8) * (1 + Math.max(0, 0.3 - (this.t - this.message.at) * 0.04));
    }
    if (state.phase === "roundEnd" && state.phaseFrame > 90) {
      const w = state.roundWinners[state.roundWinners.length - 1];
      text = w === -1 ? "ÉGALITÉ" : `${shortName(state.fighters[w].char).toUpperCase()} GAGNE`;
      color = "#ffd94a";
      scale = Math.min(1, (state.phaseFrame - 90) / 8);
    }
    if (!text) return;
    c.save();
    c.translate(SCREEN_W / 2, SCREEN_H / 2 - 30);
    c.scale(scale, scale);
    c.font = "72px Bungee, Impact";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineWidth = 12;
    c.strokeStyle = "#111";
    c.strokeText(text, 0, 0);
    c.fillStyle = color;
    c.fillText(text, 0, 0);
    c.restore();
  }
}
