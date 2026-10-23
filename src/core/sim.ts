/**
 * The fight simulation: `step(state, inputs)` advances one frame. Pure and deterministic
 * (no Math.random, no Date, no transcendental functions), so two peers fed the same inputs
 * compute the same state — the basis of rollback netcode.
 */
import {
  BODY_W, BUFFER_FRAMES, CROUCH_H, FIGHT_CALL_FRAME, GETUP_FRAMES, GRAVITY, INTRO_FRAMES, JUGGLE_LIMIT,
  JUMP_VX, KNOCKDOWN_FRAMES, MAX_SPREAD, METER_MAX, ROUND_END_FRAMES, SCREEN_W, STAGE_W, STAND_H, WALL_MARGIN,
} from "./constants";
import { ACTION_BUTTONS, BTN, cleanInput, has } from "./input";
import { ROSTER } from "./roster";
import type {
  BoxDef, Fighter, GameConfig, GameEvent, GameState, HitDef, MoveDef, MoveSlot, ProjDef, Projectile, StatusDef, Support, Wall, WallDef,
} from "./types";

// ---------------------------------------------------------------- creation & cloning

function newFighter(char: number, side: 0 | 1): Fighter {
  const def = ROSTER[char];
  return {
    char,
    x: STAGE_W / 2 + (side === 0 ? -180 : 180),
    y: 0,
    vx: 0,
    vy: 0,
    facing: side === 0 ? 1 : -1,
    hp: def.stats.hp,
    meter: 0,
    supportCd: 120,
    state: "intro",
    stateFrame: 0,
    lock: 0,
    move: null,
    moveFrame: 0,
    moveHit: false,
    boxHits: [],
    combo: 0,
    comboDamage: 0,
    juggle: 0,
    prevInput: 0,
    buffer: 0,
    bufferDir: 0,
    bufferAge: 0,
    status: {},
    armorHits: 0,
    airUsed: false,
    rounds: 0,
    shout: "",
    shoutFrames: 0,
    pushX: 0,
  };
}

export function createGame(config: GameConfig): GameState {
  return {
    frame: 0,
    config,
    fighters: [newFighter(config.chars[0], 0), newFighter(config.chars[1], 1)],
    projectiles: [],
    walls: [],
    supports: [],
    nextId: 1,
    phase: "intro",
    phaseFrame: 0,
    round: 1,
    timer: config.time * 60,
    hitstop: 0,
    freezeBy: -1,
    freezeFrames: 0,
    rng: (config.seed >>> 0) || 1,
    winner: -1,
    roundWinners: [],
    events: [],
  };
}

const cloneFighter = (f: Fighter): Fighter => ({ ...f, boxHits: f.boxHits.slice(), status: { ...f.status } });

/** Fast clone for rollback snapshots (definitions are immutable and shared). */
export function cloneState(s: GameState): GameState {
  return {
    ...s,
    fighters: [cloneFighter(s.fighters[0]), cloneFighter(s.fighters[1])],
    projectiles: s.projectiles.map((p) => ({ ...p })),
    walls: s.walls.map((w) => ({ ...w })),
    supports: s.supports.map((x) => ({ ...x, boxHits: x.boxHits.slice() })),
    roundWinners: s.roundWinners.slice(),
    events: s.events.slice(),
  };
}

/** Checksum of everything that matters, to detect desyncs between peers. */
export function hashState(s: GameState): number {
  let h = 2166136261;
  const mix = (n: number) => {
    h ^= Math.round(n * 64) | 0;
    h = Math.imul(h, 16777619);
  };
  mix(s.frame);
  mix(s.rng);
  mix(s.timer);
  mix(s.round);
  for (const f of s.fighters) {
    mix(f.x); mix(f.y); mix(f.vx); mix(f.vy); mix(f.hp); mix(f.meter); mix(f.lock); mix(f.moveFrame); mix(f.facing);
  }
  for (const p of s.projectiles) { mix(p.x); mix(p.y); mix(p.hitsLeft); }
  mix(s.projectiles.length);
  mix(s.supports.length);
  mix(s.walls.length);
  return h >>> 0;
}

// ---------------------------------------------------------------- helpers

const charOf = (f: Fighter) => ROSTER[f.char];
const moveOf = (f: Fighter): MoveDef | undefined => (f.move ? charOf(f).moves[f.move] : undefined);
const inWindow = (w: [number, number] | undefined, frame: number) => !!w && frame >= w[0] && frame <= w[1];
const sign = (n: number): 1 | -1 => (n >= 0 ? 1 : -1);

/** Deterministic triangle wave in [-1, 1]. */
const tri = (t: number) => 4 * Math.abs(t - Math.floor(t + 0.5)) - 1;

function nextRandom(s: GameState): number {
  // xorshift32
  let x = s.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}

function emit(s: GameState, e: GameEvent) {
  s.events.push(e);
}

const grounded = (f: Fighter) => f.y <= 0;
const isDown = (f: Fighter) => f.state === "knockdown" || f.state === "getup" || f.state === "ko";

function canAct(f: Fighter, s: GameState): boolean {
  if (s.phase !== "fight") return false;
  if ((f.status.stun ?? 0) > 0 || (f.status.freeze ?? 0) > 0) return false;
  return f.state === "idle" || f.state === "walk" || f.state === "crouch" || (f.state === "jump" && !f.airUsed);
}

interface Rect { x: number; y: number; w: number; h: number }

const overlap = (a: Rect, b: Rect) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

function hurtbox(f: Fighter): Rect {
  const size = charOf(f).stats.size;
  const h = (f.state === "crouch" || (f.state === "attack" && (f.move === "cL" || f.move === "cH")) ? CROUCH_H : STAND_H) * size;
  return { x: f.x, y: f.y + h / 2, w: BODY_W * size, h };
}

const boxAt = (x: number, y: number, facing: number, b: BoxDef): Rect => ({ x: x + b.x * facing, y: y + b.y, w: b.w, h: b.h });

function cameraCenter(s: GameState) {
  const c = (s.fighters[0].x + s.fighters[1].x) / 2;
  return Math.min(STAGE_W - SCREEN_W / 2, Math.max(SCREEN_W / 2, c));
}

function setShout(f: Fighter, text: string | undefined) {
  if (!text) return;
  f.shout = text;
  f.shoutFrames = 75;
}

function addStatus(f: Fighter, st: StatusDef) {
  f.status[st.kind] = Math.max(f.status[st.kind] ?? 0, st.frames);
}

// ---------------------------------------------------------------- spawning

function spawnProjectile(s: GameState, owner: number, pd: ProjDef, k: number, fromX: number, fromY: number, facing: 1 | -1) {
  const opp = s.fighters[1 - owner];
  let x = fromX + pd.x * facing;
  let y = fromY + pd.y;
  const origin = pd.origin ?? "self";
  if (origin === "sky") {
    x = opp.x + (pd.x + k * 60) * facing;
    y = pd.y;
  } else if (origin === "oppGround") {
    x = opp.x;
    y = pd.y;
  } else if (origin === "screenBack") {
    x = cameraCenter(s) - facing * (SCREEN_W / 2 + 40);
    y = pd.y;
  }
  const spread = pd.spreadVy ? pd.spreadVy[k % pd.spreadVy.length] : 0;
  const p: Projectile = {
    id: s.nextId++,
    owner,
    def: pd,
    x,
    y,
    vx: pd.vx * facing,
    vy: (pd.vy ?? 0) + spread,
    age: 0,
    hitsLeft: pd.hits ?? 1,
    lastHit: -100,
    phase: nextRandom(s),
  };
  s.projectiles.push(p);
  emit(s, { type: "proj", p: owner, x, y, s: pd.sprite });
}

function spawnProjectilesAt(s: GameState, owner: number, list: ProjDef[] | undefined, frame: number, x: number, y: number, facing: 1 | -1) {
  if (!list) return;
  for (const pd of list) {
    const count = pd.count ?? 1;
    for (let k = 0; k < count; k++) {
      if (frame === pd.frame + k * (pd.interval ?? 0)) spawnProjectile(s, owner, pd, k, x, y, facing);
    }
  }
}

function spawnWall(s: GameState, owner: number, wd: WallDef, x: number, facing: 1 | -1) {
  const wx = Math.min(STAGE_W - WALL_MARGIN, Math.max(WALL_MARGIN, x + wd.x * facing));
  // One wall per owner: a new one replaces the old.
  s.walls = s.walls.filter((w) => w.owner !== owner);
  s.walls.push({ owner, def: wd, x: wx, age: 0, hp: wd.hp, struck: false });
  emit(s, { type: "wall", p: owner, x: wx, y: 0, s: wd.sprite });
}

function spawnSupport(s: GameState, p: number) {
  const f = s.fighters[p];
  const sd = charOf(f).support;
  let x = f.x - f.facing * 70;
  let y = 0;
  if (sd.entry === "drive") x = cameraCenter(s) - f.facing * (SCREEN_W / 2 + 60);
  if (sd.entry === "drop") y = 320;
  if (sd.entry === "fly") y = 110;
  x = sd.entry === "drive" ? x : Math.min(STAGE_W - WALL_MARGIN, Math.max(WALL_MARGIN, x));
  const sup: Support = { owner: p, x, y, facing: f.facing, age: 0, boxHits: [] };
  s.supports = s.supports.filter((o) => o.owner !== p);
  s.supports.push(sup);
  f.supportCd = sd.cooldown;
  setShout(f, sd.shout);
  emit(s, { type: "support", p, x, y: 0, s: sd.look });
}

// ---------------------------------------------------------------- moves

function startMove(s: GameState, p: number, slot: MoveSlot) {
  const f = s.fighters[p];
  const def = charOf(f).moves[slot];
  if (!def) return false;
  f.state = "attack";
  f.stateFrame = 0;
  f.move = slot;
  f.moveFrame = 0;
  f.moveHit = false;
  f.boxHits = [];
  f.armorHits = 0;
  if (!grounded(f)) f.airUsed = true;
  else f.vx = 0;
  if (slot !== "super") f.meter = Math.min(METER_MAX, f.meter + (def.meterGain ?? 0));
  setShout(f, def.shout);
  if (def.selfStatus) addStatus(f, def.selfStatus);
  emit(s, { type: "whiff", p, x: f.x, y: f.y, s: slot });
  return true;
}

function specialSlot(f: Fighter, input: number): MoveSlot {
  const fwd = f.facing === 1 ? BTN.RIGHT : BTN.LEFT;
  if (has(input, BTN.UP)) return "sU";
  if (has(input, BTN.DOWN)) return "sD";
  if (has(input, fwd)) return "sF";
  return "sN";
}

const NORMALS: MoveSlot[] = ["L", "H", "cL", "cH", "jL", "jH"];

/** Reads buffered buttons and starts an action if allowed. Returns true if something started. */
function tryActions(s: GameState, p: number, input: number): boolean {
  const f = s.fighters[p];
  const opp = s.fighters[1 - p];
  if (!f.buffer || s.phase !== "fight") return false;
  const moves = charOf(f).moves;
  const free = canAct(f, s);
  const inMove = f.state === "attack" && f.move !== null;
  if (has(f.buffer, BTN.ASSIST) && f.supportCd === 0 && (free || inMove)) {
    f.buffer &= ~BTN.ASSIST;
    spawnSupport(s, p);
  }
  const b = f.buffer;
  if (!b) return false;
  const isNormal = inMove && NORMALS.includes(f.move!);
  const cancelSpecial = inMove && f.moveHit && isNormal;
  const cancelSuper = inMove && f.moveHit && f.move !== "super" && f.move !== "throw";
  const cancelChain = inMove && f.moveHit && (f.move === "L" || f.move === "cL");
  const air = !grounded(f);
  const consume = () => {
    f.buffer = 0;
    f.bufferAge = 0;
  };

  if (has(b, BTN.SUPER) && f.meter >= METER_MAX && moves.super && !air && (free || cancelSuper)) {
    consume();
    f.meter = 0;
    startMove(s, p, "super");
    s.freezeBy = p;
    s.freezeFrames = 48;
    emit(s, { type: "super", p, x: f.x, y: f.y, s: moves.super.name });
    return true;
  }
  if (has(b, BTN.SPECIAL) && (free || cancelSpecial)) {
    const slot = specialSlot(f, input);
    const def = moves[slot];
    if (def && (!air || def.air)) {
      consume();
      return startMove(s, p, slot);
    }
  }
  if (!free && !cancelChain) return false;
  const lightHeavy = (has(b, BTN.LIGHT) && (has(b, BTN.HEAVY) || has(input, BTN.HEAVY))) || (has(b, BTN.HEAVY) && has(input, BTN.LIGHT));
  if (lightHeavy && !air && free && grounded(opp) && !isDown(opp) && Math.abs(opp.x - f.x) < 95 * charOf(f).stats.size) {
    consume();
    return startMove(s, p, "throw");
  }
  if (has(b, BTN.HEAVY)) {
    consume();
    return startMove(s, p, air ? "jH" : has(input, BTN.DOWN) ? "cH" : "H");
  }
  if (has(b, BTN.LIGHT) && free) {
    consume();
    return startMove(s, p, air ? "jL" : has(input, BTN.DOWN) ? "cL" : "L");
  }
  return false;
}

function movement(s: GameState, p: number, input: number) {
  const f = s.fighters[p];
  if (!grounded(f) || f.state === "jump") return;
  const st = charOf(f).stats;
  const slow = (f.status.slow ?? 0) > 0 ? 0.5 : 1;
  const fwd = f.facing === 1 ? BTN.RIGHT : BTN.LEFT;
  const back = f.facing === 1 ? BTN.LEFT : BTN.RIGHT;
  if (has(input, BTN.UP)) {
    f.state = "jump";
    f.stateFrame = 0;
    f.airUsed = false;
    f.vy = st.jumpV * (slow < 1 ? 0.8 : 1);
    f.vx = has(input, fwd) ? JUMP_VX * f.facing * slow : has(input, back) ? -JUMP_VX * f.facing * slow : 0;
    f.y = 0.01;
    return;
  }
  if (has(input, BTN.DOWN)) {
    if (f.state !== "crouch") f.stateFrame = 0;
    f.state = "crouch";
    f.vx = 0;
    return;
  }
  if (has(input, fwd) || has(input, back)) {
    if (f.state !== "walk") f.stateFrame = 0;
    f.state = "walk";
    f.vx = (has(input, fwd) ? st.walk : -st.walk * 0.8) * f.facing * slow;
    return;
  }
  if (f.state !== "idle") f.stateFrame = 0;
  f.state = "idle";
  f.vx = 0;
}

function runMove(s: GameState, p: number) {
  const f = s.fighters[p];
  const def = moveOf(f);
  if (!def) return;
  const mf = f.moveFrame;
  const slow = (f.status.slow ?? 0) > 0 ? 0.6 : 1;
  if (def.motion) {
    let moving = false;
    for (const m of def.motion) {
      if (mf < m.from || mf > m.to) continue;
      if (m.vx !== undefined) {
        f.vx = m.vx * f.facing * slow;
        moving = true;
      }
      if (m.vy !== undefined && mf === m.from) f.vy = m.vy;
    }
    if (!moving && grounded(f)) f.vx = 0;
  }
  spawnProjectilesAt(s, p, def.projectiles, mf, f.x, f.y, f.facing);
  if (def.wall && mf === def.wall.frame) spawnWall(s, p, def.wall, f.x, f.facing);
}

function endMove(f: Fighter) {
  f.move = null;
  f.moveFrame = 0;
  f.stateFrame = 0;
  if (grounded(f)) {
    f.state = "idle";
    f.vx = 0;
  } else {
    f.state = "jump";
    f.airUsed = true;
  }
}

// ---------------------------------------------------------------- hits

interface Attack {
  attacker: number;
  hit: HitDef;
  /** Where the blow comes from (attacker or projectile x). */
  fromX: number;
  isProjectile: boolean;
  isSuper: boolean;
  air: boolean;
}

type HitResult = "hit" | "block" | "miss" | "armor" | "counter";

function holdingBack(f: Fighter, fromX: number): boolean {
  const input = f.prevInput;
  const towards = fromX > f.x ? BTN.RIGHT : BTN.LEFT;
  const away = towards === BTN.RIGHT ? BTN.LEFT : BTN.RIGHT;
  return has(input, away) && !has(input, towards);
}

function canBlock(f: Fighter): boolean {
  if (!grounded(f)) return false;
  if ((f.status.stun ?? 0) > 0 || (f.status.freeze ?? 0) > 0) return false;
  return f.state === "idle" || f.state === "walk" || f.state === "crouch" || f.state === "blockstun";
}

function applyAttack(s: GameState, victimIdx: number, atk: Attack, at: { x: number; y: number }): HitResult {
  const v = s.fighters[victimIdx];
  const a = s.fighters[atk.attacker];
  const h = atk.hit;
  if (v.state === "ko" || isDown(v)) return "miss";
  if (v.state === "airHit" && v.juggle >= JUGGLE_LIMIT) return "miss";
  const vMove = v.state === "attack" ? moveOf(v) : undefined;
  if (vMove && inWindow(vMove.invuln, v.moveFrame)) return "miss";
  if (h.grab && (!grounded(v) || v.state === "hitstun" || v.state === "blockstun" || v.state === "airHit")) return "miss";

  const dir = sign(v.x - atk.fromX); // push direction

  // Counter stance
  if (vMove && inWindow(vMove.counter, v.moveFrame) && !h.unblockable && !h.grab) {
    emit(s, { type: "counter", p: victimIdx, x: v.x, y: v.y + 110 });
    setShout(v, "Contre !");
    s.hitstop = 14;
    v.move = null;
    v.state = "idle";
    if (!atk.isProjectile && !isDown(a)) {
      const counterHit: HitDef = { damage: 100, hitstun: 30, blockstun: 0, push: 9, knockdown: true, launch: 9, unblockable: true };
      applyAttack(s, atk.attacker, { attacker: victimIdx, hit: counterHit, fromX: v.x, isProjectile: false, isSuper: false, air: false }, { x: a.x, y: a.y + 100 });
    }
    return "counter";
  }

  // Block
  const blockable = !h.unblockable && !h.grab;
  if (blockable && canBlock(v) && holdingBack(v, atk.fromX)) {
    const crouching = has(v.prevInput, BTN.DOWN);
    const overhead = h.overhead || atk.air;
    const ok = (!h.low || crouching) && (!overhead || !crouching);
    if (ok) {
      const chip = h.chip ?? Math.floor(h.damage / (atk.isSuper ? 4 : 8));
      v.hp = s.config.training ? Math.max(1, v.hp - chip) : v.hp - chip;
      v.state = "blockstun";
      v.stateFrame = 0;
      v.lock = h.blockstun;
      v.pushX = h.push * 0.9 * dir;
      v.meter = Math.min(METER_MAX, v.meter + chip);
      a.meter = Math.min(METER_MAX, a.meter + (atk.isSuper ? 0 : Math.floor(h.damage * 0.15)));
      s.hitstop = Math.max(s.hitstop, 4);
      emit(s, { type: "block", p: victimIdx, x: at.x, y: at.y, v: chip });
      if (v.hp <= 0) knockOut(s, victimIdx, dir);
      return "block";
    }
  }

  // Armor
  if (vMove && inWindow(vMove.armor, v.moveFrame) && v.armorHits < 1 && !h.grab) {
    v.armorHits++;
    const dmg = Math.floor(h.damage * 0.5);
    v.hp -= dmg;
    s.hitstop = Math.max(s.hitstop, 6);
    emit(s, { type: "hit", p: victimIdx, x: at.x, y: at.y, v: dmg, s: "armor" });
    if (v.hp <= 0) knockOut(s, victimIdx, dir);
    return "armor";
  }

  // Clean hit
  const scale = Math.max(0.35, 1 - 0.1 * v.combo);
  const taxed = (v.status.taxed ?? 0) > 0 ? 1.3 : 1;
  const dmg = Math.max(1, Math.round(h.damage * scale * taxed));
  v.hp -= dmg;
  if (s.config.training) v.hp = Math.max(1, v.hp);
  v.combo++;
  v.comboDamage += dmg;
  v.move = null;
  v.moveFrame = 0;
  a.meter = Math.min(METER_MAX, a.meter + (atk.isSuper ? 0 : Math.floor(dmg * 0.5)));
  v.meter = Math.min(METER_MAX, v.meter + Math.floor(dmg * 0.35));
  if (h.meterDrain) v.meter = Math.max(0, v.meter - h.meterDrain);
  if (h.status) {
    addStatus(v, h.status);
    emit(s, { type: "status", p: victimIdx, x: v.x, y: v.y + 180, s: h.status.kind });
  }
  s.hitstop = Math.max(s.hitstop, h.hitstop ?? Math.min(14, 5 + Math.floor(h.damage / 14)));
  emit(s, { type: h.grab ? "throw" : "hit", p: victimIdx, x: at.x, y: at.y, v: dmg, s: h.damage >= 80 ? "heavy" : "light" });

  if (v.hp <= 0) {
    knockOut(s, victimIdx, dir);
    return "hit";
  }
  const airborne = !grounded(v) || v.state === "airHit";
  if (h.launch || airborne) {
    v.state = "airHit";
    v.vy = h.launch ?? (airborne ? 6 : 7);
    v.vx = h.push * 0.6 * dir;
    v.y = Math.max(v.y, 0.01);
    v.juggle++;
  } else if (h.knockdown) {
    v.state = "knockdown";
    v.lock = KNOCKDOWN_FRAMES;
    v.pushX = h.push * dir;
    v.vx = 0;
  } else {
    v.state = "hitstun";
    v.lock = h.hitstun;
    v.pushX = h.push * dir;
    v.vx = 0;
  }
  v.stateFrame = 0;
  return "hit";
}

function knockOut(s: GameState, idx: number, dir: number) {
  const v = s.fighters[idx];
  v.hp = 0;
  v.state = "ko";
  v.stateFrame = 0;
  v.move = null;
  v.vy = 10;
  v.y = Math.max(v.y, 0.01);
  v.vx = 5 * dir;
  s.hitstop = 30;
  emit(s, { type: "ko", p: idx, x: v.x, y: v.y + 100 });
}

function fighterAttacks(s: GameState, p: number) {
  const f = s.fighters[p];
  const def = moveOf(f);
  if (!def?.hitboxes || f.state !== "attack") return;
  const victim = s.fighters[1 - p];
  const vb = hurtbox(victim);
  def.hitboxes.forEach((hb, i) => {
    if (f.moveFrame < hb.from || f.moveFrame > hb.to) return;
    const last = f.boxHits[i];
    if (last !== undefined && (!hb.every || f.moveFrame - last < hb.every)) return;
    const box = boxAt(f.x, f.y, f.facing, hb);
    if (!overlap(box, vb)) return;
    const res = applyAttack(s, 1 - p, { attacker: p, hit: hb.hit, fromX: f.x, isProjectile: false, isSuper: f.move === "super", air: f.move === "jL" || f.move === "jH" }, { x: (box.x + vb.x) / 2, y: Math.min(box.y, vb.y + vb.h / 2 - 10) });
    if (res !== "miss") {
      f.boxHits[i] = f.moveFrame;
      if (res !== "counter") f.moveHit = true;
    }
  });
}

function supportAttacks(s: GameState) {
  for (const sup of s.supports) {
    const sd = ROSTER[s.fighters[sup.owner].char].support;
    if (!sd.hitboxes) continue;
    const victim = s.fighters[1 - sup.owner];
    const vb = hurtbox(victim);
    sd.hitboxes.forEach((hb, i) => {
      if (sup.age < sd.actFrame + hb.from || sup.age > sd.actFrame + hb.to) return;
      const last = sup.boxHits[i];
      if (last !== undefined && (!hb.every || sup.age - last < hb.every)) return;
      const box = boxAt(sup.x, sup.y, sup.facing, hb);
      if (!overlap(box, vb)) return;
      const res = applyAttack(s, 1 - sup.owner, { attacker: sup.owner, hit: hb.hit, fromX: sup.x, isProjectile: true, isSuper: false, air: false }, { x: vb.x, y: box.y });
      if (res !== "miss") sup.boxHits[i] = sup.age;
    });
  }
}

// ---------------------------------------------------------------- per-frame updates

function updateProjectiles(s: GameState) {
  for (const pr of s.projectiles) {
    const d = pr.def;
    pr.age++;
    if (!d.linger) {
      pr.vy -= d.gravity ?? 0;
      pr.x += pr.vx;
      pr.y += pr.vy;
    }
    if (d.bounce && pr.y < d.h / 2) {
      pr.y = d.h / 2;
      pr.vy = Math.max(6, Math.abs(pr.vy) * 0.8);
    } else if (d.gravity && pr.y < 0 && !d.bounce) {
      pr.hitsLeft = 0;
    }
    if ((d.origin === "sky" || d.origin === undefined) && pr.vy < 0 && pr.y < d.h / 2 - 10) pr.hitsLeft = 0;
  }
  // Projectile vs projectile
  const list = s.projectiles;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.owner === b.owner || a.hitsLeft <= 0 || b.hitsLeft <= 0) continue;
      if (a.def.pierce && b.def.pierce) continue;
      if (!overlap(projRect(a), projRect(b))) continue;
      if (!a.def.pierce) a.hitsLeft = 0;
      if (!b.def.pierce) b.hitsLeft = 0;
      emit(s, { type: "clash", p: a.owner, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
  }
  // Projectile vs walls
  for (const pr of list) {
    if (pr.def.pierce || pr.hitsLeft <= 0) continue;
    for (const w of s.walls) {
      if (w.owner === pr.owner || w.hp <= 0) continue;
      if (overlap(projRect(pr), wallRect(w))) {
        pr.hitsLeft = 0;
        w.hp--;
        emit(s, { type: "block", p: w.owner, x: w.x, y: pr.y });
      }
    }
  }
  // Projectile vs fighters
  for (const pr of list) {
    if (pr.hitsLeft <= 0 || pr.age - pr.lastHit < 8) continue;
    const victimIdx = 1 - pr.owner;
    const victim = s.fighters[victimIdx];
    const vb = hurtbox(victim);
    const r = projRect(pr);
    if (!overlap(r, vb)) continue;
    const res = applyAttack(s, victimIdx, { attacker: pr.owner, hit: pr.def.hit, fromX: pr.vx !== 0 ? pr.x - pr.vx * 4 : s.fighters[pr.owner].x, isProjectile: true, isSuper: false, air: false }, { x: pr.x, y: Math.min(r.y, vb.y + vb.h / 2) });
    if (res === "miss") continue;
    pr.lastHit = pr.age;
    pr.hitsLeft = res === "counter" ? 0 : pr.hitsLeft - 1;
  }
  s.projectiles = list.filter((pr) => pr.hitsLeft > 0 && pr.age < pr.def.life && pr.x > -300 && pr.x < STAGE_W + 300);
}

export function projRect(pr: Projectile): Rect {
  const wave = pr.def.wave ? tri(pr.age / 40 + pr.phase) * pr.def.wave : 0;
  return { x: pr.x, y: pr.y + wave, w: pr.def.w, h: pr.def.h };
}

export function wallRect(w: Wall): Rect {
  const rise = Math.min(1, (w.age + 1) / 10);
  const h = w.def.h * rise;
  return { x: w.x, y: h / 2, w: w.def.w, h };
}

function updateWalls(s: GameState) {
  for (const w of s.walls) {
    w.age++;
    if (w.def.hit && !w.struck && w.age <= 10) {
      const victimIdx = 1 - w.owner;
      if (overlap(wallRect(w), hurtbox(s.fighters[victimIdx]))) {
        const res = applyAttack(s, victimIdx, { attacker: w.owner, hit: w.def.hit, fromX: w.x - (s.fighters[w.owner].facing * 10), isProjectile: true, isSuper: false, air: false }, { x: w.x, y: 60 });
        if (res !== "miss") w.struck = true;
      }
    }
  }
  s.walls = s.walls.filter((w) => w.hp > 0 && w.age < w.def.life);
}

function updateSupports(s: GameState) {
  for (const sup of s.supports) {
    const sd = ROSTER[s.fighters[sup.owner].char].support;
    if (sd.entry === "drop") sup.y = Math.max(0, sup.y - 26);
    if (sd.entry === "drive" && sup.age >= sd.actFrame) sup.x += (sd.speed ?? 10) * sup.facing;
    if (sup.age >= sd.actFrame) {
      const rel = sup.age - sd.actFrame;
      spawnProjectilesAt(s, sup.owner, sd.projectiles, rel, sup.x, sup.y, sup.facing);
      if (sd.wall && rel === sd.wall.frame) spawnWall(s, sup.owner, sd.wall, sup.x, sup.facing);
      if (rel === 0 && sd.ownerStatus) addStatus(s.fighters[sup.owner], sd.ownerStatus);
    }
    sup.age++;
  }
  s.supports = s.supports.filter((sup) => sup.age < ROSTER[s.fighters[sup.owner].char].support.frames);
}

function physics(s: GameState, p: number) {
  const f = s.fighters[p];
  const frozen = (f.status.freeze ?? 0) > 0 && f.state !== "airHit" && f.state !== "ko";
  if (f.pushX !== 0) {
    f.x += f.pushX;
    f.pushX *= 0.82;
    if (Math.abs(f.pushX) < 0.2) f.pushX = 0;
  }
  if (frozen) return;
  f.x += f.vx;
  if (f.y > 0 || f.vy > 0) {
    f.vy -= GRAVITY;
    f.y += f.vy;
    if (f.y <= 0) {
      f.y = 0;
      f.vy = 0;
      land(s, p);
    }
  }
}

function land(s: GameState, p: number) {
  const f = s.fighters[p];
  emit(s, { type: "land", p, x: f.x, y: 0 });
  if (f.state === "airHit") {
    f.state = "knockdown";
    f.lock = KNOCKDOWN_FRAMES;
    f.stateFrame = 0;
    f.vx = 0;
  } else if (f.state === "ko") {
    f.vx = 0;
  } else if (f.state === "jump") {
    f.state = "idle";
    f.stateFrame = 0;
    f.vx = 0;
  } else if (f.state === "attack") {
    const def = moveOf(f);
    if (def?.air || f.move === "jL" || f.move === "jH" || f.moveFrame > (def?.frames ?? 0) - 6) endMove(f);
    else f.vx = 0;
  }
}

function separate(s: GameState) {
  const [a, b] = s.fighters;
  if (a.state === "ko" || b.state === "ko") {
    clamp(a);
    clamp(b);
    return;
  }
  const minDist = (BODY_W * (charOf(a).stats.size + charOf(b).stats.size)) / 2;
  const dx = b.x - a.x;
  if (Math.abs(dx) < minDist && Math.abs(a.y - b.y) < 110 && !isDown(a) && !isDown(b)) {
    const push = (minDist - Math.abs(dx)) / 2;
    const d = dx === 0 ? (a.facing === 1 ? 1 : -1) : sign(dx);
    a.x -= push * d;
    b.x += push * d;
  }
  clamp(a);
  clamp(b);
  // Keep both on screen
  const spread = b.x - a.x;
  if (Math.abs(spread) > MAX_SPREAD) {
    const excess = (Math.abs(spread) - MAX_SPREAD) / 2;
    const d = sign(spread);
    a.x += excess * d;
    b.x -= excess * d;
  }
}

function clamp(f: Fighter) {
  if (f.x < WALL_MARGIN) f.x = WALL_MARGIN;
  if (f.x > STAGE_W - WALL_MARGIN) f.x = STAGE_W - WALL_MARGIN;
}

function updateFacing(s: GameState) {
  const [a, b] = s.fighters;
  for (const [f, o] of [[a, b], [b, a]] as const) {
    if (!grounded(f)) continue;
    if (f.state === "idle" || f.state === "walk" || f.state === "crouch" || f.state === "intro" || f.state === "getup") {
      if (Math.abs(o.x - f.x) > 2) f.facing = sign(o.x - f.x);
    }
  }
}

function tickFighter(s: GameState, p: number) {
  const f = s.fighters[p];
  f.stateFrame++;
  if (f.shoutFrames > 0) f.shoutFrames--;
  if (f.supportCd > 0 && s.phase === "fight") f.supportCd--;
  for (const k of Object.keys(f.status) as (keyof Fighter["status"])[]) {
    const left = (f.status[k] ?? 0) - 1;
    if (k === "dot" && left % 30 === 0 && f.hp > 1) f.hp -= 8;
    if (left <= 0) delete f.status[k];
    else f.status[k] = left;
  }
  if (f.state === "attack") {
    f.moveFrame++;
    const def = moveOf(f);
    if (!def || f.moveFrame >= def.frames) endMove(f);
  } else if (f.state === "hitstun" || f.state === "blockstun") {
    if (--f.lock <= 0) {
      f.state = "idle";
      f.stateFrame = 0;
    }
  } else if (f.state === "knockdown") {
    if (--f.lock <= 0) {
      f.state = "getup";
      f.lock = GETUP_FRAMES;
      f.stateFrame = 0;
    }
  } else if (f.state === "getup") {
    if (--f.lock <= 0) {
      f.state = "idle";
      f.stateFrame = 0;
    }
  }
  if (f.state !== "hitstun" && f.state !== "airHit" && f.state !== "knockdown" && f.state !== "blockstun") {
    if (f.combo > 0 && (f.state === "idle" || f.state === "getup" || f.state === "walk" || f.state === "crouch" || f.state === "jump" || f.state === "attack")) {
      f.combo = 0;
      f.comboDamage = 0;
      f.juggle = 0;
    }
  }
  if (s.config.training && f.state === "idle" && f.stateFrame > 40) {
    f.hp = charOf(f).stats.hp;
  }
  if (s.config.training) f.meter = METER_MAX;
}

function readInput(f: Fighter, raw: number): number {
  let input = cleanInput(raw);
  if ((f.status.reverse ?? 0) > 0) {
    const l = has(input, BTN.LEFT);
    const r = has(input, BTN.RIGHT);
    input &= ~(BTN.LEFT | BTN.RIGHT);
    if (l) input |= BTN.RIGHT;
    if (r) input |= BTN.LEFT;
  }
  const pressed = input & ~f.prevInput & ACTION_BUTTONS;
  f.prevInput = input;
  if (pressed) {
    f.buffer |= pressed;
    f.bufferAge = 0;
  } else if (f.buffer && ++f.bufferAge > BUFFER_FRAMES) {
    f.buffer = 0;
    f.bufferAge = 0;
  }
  return input;
}

// ---------------------------------------------------------------- round flow

function resetRound(s: GameState) {
  s.fighters.forEach((f, i) => {
    const fresh = newFighter(f.char, i as 0 | 1);
    fresh.rounds = f.rounds;
    fresh.meter = f.meter;
    s.fighters[i] = fresh;
  });
  s.projectiles = [];
  s.walls = [];
  s.supports = [];
  s.phase = "intro";
  s.phaseFrame = 0;
  s.timer = s.config.time * 60;
}

function endRound(s: GameState, winner: number) {
  s.phase = "roundEnd";
  s.phaseFrame = 0;
  s.roundWinners.push(winner);
  if (winner === -1) {
    s.fighters[0].rounds++;
    s.fighters[1].rounds++;
  } else {
    s.fighters[winner].rounds++;
    const w = s.fighters[winner];
    if (w.hp === charOf(w).stats.hp) emit(s, { type: "perfect", p: winner, x: w.x, y: 0 });
  }
}

function phaseUpdate(s: GameState) {
  s.phaseFrame++;
  if (s.phase === "intro") {
    if (s.phaseFrame === 1) emit(s, { type: "round", p: -1, x: 0, y: 0, v: s.round });
    if (s.phaseFrame === FIGHT_CALL_FRAME) emit(s, { type: "fight", p: -1, x: 0, y: 0 });
    if (s.phaseFrame >= INTRO_FRAMES) {
      s.phase = "fight";
      s.phaseFrame = 0;
      for (const f of s.fighters) {
        f.state = "idle";
        f.stateFrame = 0;
      }
    }
  } else if (s.phase === "fight") {
    if (s.config.time > 0 && !s.config.training && s.timer > 0) {
      s.timer--;
      if (s.timer === 0) {
        const [a, b] = s.fighters;
        const ra = a.hp / charOf(a).stats.hp;
        const rb = b.hp / charOf(b).stats.hp;
        emit(s, { type: "timeout", p: -1, x: 0, y: 0 });
        endRound(s, ra === rb ? -1 : ra > rb ? 0 : 1);
      }
    }
  } else if (s.phase === "roundEnd") {
    if (s.phaseFrame === 80) {
      s.fighters.forEach((f) => {
        if (f.state !== "ko" && grounded(f) && f.state !== "attack") {
          f.state = "win";
          f.stateFrame = 0;
          f.vx = 0;
        }
      });
    }
    if (s.phaseFrame >= ROUND_END_FRAMES) {
      const target = s.config.rounds;
      const [a, b] = s.fighters;
      if (a.rounds >= target || b.rounds >= target || s.round >= 9) {
        s.phase = "matchEnd";
        s.phaseFrame = 0;
        s.winner = a.rounds === b.rounds ? -1 : a.rounds > b.rounds ? 0 : 1;
      } else {
        s.round++;
        resetRound(s);
      }
    }
  }
}

// ---------------------------------------------------------------- main step

export function step(s: GameState, inputs: readonly [number, number] | number[]) {
  s.frame++;
  s.events = [];

  if (s.freezeFrames > 0) {
    s.freezeFrames--;
    s.fighters.forEach((f, i) => {
      if (i !== s.freezeBy) readInput(f, inputs[i]);
    });
    if (s.freezeFrames === 0) s.freezeBy = -1;
    return;
  }
  if (s.hitstop > 0) {
    s.hitstop--;
    s.fighters.forEach((f, i) => readInput(f, inputs[i]));
    return;
  }

  phaseUpdate(s);
  if (s.phase === "intro") return;

  const playing = s.phase === "fight";
  const ins = s.fighters.map((f, i) => readInput(f, playing ? inputs[i] : 0));

  for (let p = 0; p < 2; p++) {
    const f = s.fighters[p];
    if (!playing) continue;
    const started = tryActions(s, p, ins[p]);
    if (!started && canAct(f, s) && f.state !== "jump") movement(s, p, ins[p]);
    if ((f.status.freeze ?? 0) > 0 || (f.status.stun ?? 0) > 0) {
      if (f.state === "walk" || f.state === "crouch") f.state = "idle";
      if (grounded(f) && f.state !== "airHit") f.vx = 0;
    }
  }
  for (let p = 0; p < 2; p++) if (s.fighters[p].state === "attack") runMove(s, p);
  for (let p = 0; p < 2; p++) physics(s, p);
  separate(s);

  // Both fighters' blows are resolved against the same frame.
  fighterAttacks(s, 0);
  fighterAttacks(s, 1);
  supportAttacks(s);
  updateProjectiles(s);
  updateWalls(s);
  updateSupports(s);
  updateFacing(s);
  for (let p = 0; p < 2; p++) tickFighter(s, p);

  if (s.phase === "fight") {
    const [a, b] = s.fighters;
    if (a.state === "ko" || b.state === "ko") {
      endRound(s, a.state === "ko" && b.state === "ko" ? -1 : a.state === "ko" ? 1 : 0);
    }
  }
}

/** Helpers used by the renderer and the AI. */
export const sim = { hurtbox, cameraCenter, moveOf, canAct, grounded, tri };
