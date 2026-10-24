/**
 * Pure data model of a fight. Everything here is plain JSON (no classes, no functions) so a
 * state can be cloned, hashed and rolled back cheaply. Units: pixels and frames (60 per second).
 * x grows to the right, y is the height above the ground.
 */

export type StatusKind =
  | "slow" // moves at half speed
  | "reverse" // left and right are swapped
  | "stun" // cannot act (dizzy)
  | "freeze" // cannot move nor act (ice)
  | "taxed" // takes +30% damage
  | "dot" // loses a little health over time
  | "shield" // own: blocks the next projectile
  | "rage"; // own: deals +25% damage

export interface StatusDef {
  kind: StatusKind;
  frames: number;
}

/** What happens to the one who gets touched. */
export interface HitDef {
  damage: number;
  /** Damage taken when blocking (default: damage / 8). */
  chip?: number;
  hitstun: number;
  blockstun: number;
  /** Horizontal push on the victim, away from the attacker. */
  push: number;
  /** Launches the victim upwards (juggle) with this vertical speed. */
  launch?: number;
  knockdown?: boolean;
  /** Must be blocked crouching. */
  low?: boolean;
  /** Must be blocked standing (jump attacks are overhead automatically). */
  overhead?: boolean;
  unblockable?: boolean;
  /** Command grab: unblockable, misses airborne opponents. */
  grab?: boolean;
  status?: StatusDef;
  meterDrain?: number;
  /** Fraction of the damage given back to the attacker as health. */
  steal?: number;
  /** Freeze frames on contact (default from damage). */
  hitstop?: number;
}

export interface BoxDef {
  /** Offset of the box centre from the owner's feet, x towards where the owner faces. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HitboxDef extends BoxDef {
  from: number;
  to: number;
  hit: HitDef;
  /** Re-hits every N frames while active (multi-hit moves). */
  every?: number;
}

export type ProjOrigin = "self" | "sky" | "oppGround" | "screenBack";

export interface ProjDef {
  /** Frame of the move at which the first one spawns. */
  frame: number;
  count?: number;
  /** Frames between two spawns when count > 1. */
  interval?: number;
  origin?: ProjOrigin;
  x: number;
  y: number;
  vx: number;
  vy?: number;
  /** Added to vy each frame (negative = falls). */
  gravity?: number;
  /** Per-spawn vertical speed offsets, cycled. */
  spreadVy?: number[];
  /** Vertical wobble amplitude (triangle wave, deterministic). */
  wave?: number;
  bounce?: boolean;
  w: number;
  h: number;
  life: number;
  /** How many hits it deals before vanishing (multi-hit when > 1, every 8 frames). */
  hits?: number;
  /** Ignores walls and other projectiles. */
  pierce?: boolean;
  /** Seconds-long cloud that stays in place. */
  linger?: boolean;
  hit: HitDef;
  /** Visual: key understood by the renderer (emoji, label, shape). */
  sprite: string;
  size?: number;
  color?: string;
}

export interface WallDef {
  frame: number;
  x: number;
  w: number;
  h: number;
  life: number;
  /** Projectiles it can absorb before breaking. */
  hp: number;
  sprite: string;
  /** Hits the opponent while it rises (first 10 frames). */
  hit?: HitDef;
}

export interface MotionDef {
  from: number;
  to: number;
  vx?: number;
  vy?: number;
}

export type MoveSlot =
  | "L" | "H" | "fH" | "cL" | "cH" | "jL" | "jH" | "throw"
  | "sN" | "sF" | "sD" | "sU" | "jS" | "super"
  /** Follow-ups, only reachable through a chain. */
  | "f1" | "f2" | "f3";

/** Pressing Special again during [from, until] goes on with another move (rekka). */
export interface ChainDef {
  to: MoveSlot;
  from: number;
  until: number;
  /** Only if the current move touched. */
  onHit?: boolean;
}

export interface MoveDef {
  name: string;
  /** One-line explanation for the move list. */
  desc?: string;
  frames: number;
  /** Pose key understood by the renderer. */
  pose: string;
  hitboxes?: HitboxDef[];
  projectiles?: ProjDef[];
  motion?: MotionDef[];
  wall?: WallDef;
  invuln?: [number, number];
  armor?: [number, number];
  /** If hit during this window, the attack is cancelled and the opponent is stunned. */
  counter?: [number, number];
  selfStatus?: StatusDef;
  /** Usable in the air. */
  air?: boolean;
  /** Text bubble shouted at the start. */
  shout?: string;
  /** Visual effect key drawn around the fighter during the move. */
  fx?: string;
  meterGain?: number;
  /** Teleports next to (behind) the opponent at the given frame. */
  teleport?: number;
  chain?: ChainDef;
  /** Sends back the opponent's projectiles touched during this window. */
  reflect?: [number, number];
  /** Health restored when the move starts. */
  heal?: number;
}

export type SupportEntry = "walk" | "fly" | "drop" | "drive";

export interface SupportDef {
  name: string;
  desc: string;
  /** Number of people drawn (a group shares the same power as one person). */
  members: number;
  look: string;
  entry: SupportEntry;
  /** Frames on screen. */
  frames: number;
  /** Frame at which it acts. */
  actFrame: number;
  /** Horizontal speed while acting (for supports that charge across the screen). */
  speed?: number;
  hitboxes?: HitboxDef[];
  projectiles?: ProjDef[];
  wall?: WallDef;
  /** Status given to its owner. */
  ownerStatus?: StatusDef;
  shout: string;
  cooldown: number;
}

export interface Stats {
  /** Walk speed in px/frame. */
  walk: number;
  jumpV: number;
  /** Health points (all around 1000). */
  hp: number;
  /** Body size multiplier (height, reach). */
  size: number;
  /** Damage multiplier of normal attacks. */
  power: number;
}

/** Shape of the normal attacks: frame data, reach and damage trade-offs. */
export type FightStyle = "allround" | "boxer" | "brawler" | "grappler" | "zoner" | "rushdown";

export interface CharacterDef {
  id: string;
  name: string;
  /** Short epithet shown under the name. */
  title: string;
  origin: "fr" | "intl";
  /** Main colour used in menus and HUD. */
  color: string;
  look: string;
  stage: string;
  stats: Stats;
  style: FightStyle;
  moves: Partial<Record<MoveSlot, MoveDef>>;
  support: SupportDef;
  lore: string;
  /** International fighters: why they crash the French tournament. */
  why?: string;
  quotes: string[];
  /** Rating 1..5 for menus. */
  rating: { power: number; speed: number; range: number; difficulty: number };
}

export type FighterState =
  | "idle" | "walk" | "crouch" | "jump" | "attack" | "hitstun" | "blockstun"
  | "airHit" | "knockdown" | "getup" | "stun" | "ko" | "win" | "intro";

export interface Fighter {
  char: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  /** 0..1000, super at 1000. */
  meter: number;
  supportCd: number;
  state: FighterState;
  stateFrame: number;
  /** Frames left in hitstun/blockstun/knockdown/stun. */
  lock: number;
  move: MoveSlot | null;
  moveFrame: number;
  /** The current move touched something (for cancels). */
  moveHit: boolean;
  /** Frame (move-relative) each hitbox last hit, per hitbox index. */
  boxHits: number[];
  /** Hits received in the current combo and their total. */
  combo: number;
  comboDamage: number;
  juggle: number;
  prevInput: number;
  /** Buttons pressed recently (edge), kept a few frames so early presses still count. */
  buffer: number;
  bufferDir: number;
  bufferAge: number;
  status: Partial<Record<StatusKind, number>>;
  armorHits: number;
  /** An air attack was used during this jump. */
  airUsed: boolean;
  rounds: number;
  /** Frames left of a shout bubble, and its text. */
  shout: string;
  shoutFrames: number;
  pushX: number;
}

export interface Projectile {
  id: number;
  owner: number;
  def: ProjDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  hitsLeft: number;
  lastHit: number;
  phase: number;
}

export interface Wall {
  owner: number;
  def: WallDef;
  x: number;
  age: number;
  hp: number;
  /** Already hit the opponent while rising. */
  struck: boolean;
}

export interface Support {
  owner: number;
  x: number;
  y: number;
  facing: 1 | -1;
  age: number;
  boxHits: number[];
}

export type GamePhase = "intro" | "fight" | "roundEnd" | "matchEnd";

export interface GameEvent {
  type:
    | "hit" | "block" | "whiff" | "ko" | "round" | "fight" | "super" | "support"
    | "proj" | "throw" | "counter" | "wall" | "land" | "timeout" | "perfect" | "status" | "clash";
  p: number;
  x: number;
  y: number;
  v?: number;
  s?: string;
}

export interface GameConfig {
  chars: [number, number];
  stage: string;
  /** Rounds to win the match. */
  rounds: number;
  /** Seconds per round, 0 = infinite. */
  time: number;
  /** Training: health and meter refill. */
  training?: boolean;
  seed: number;
}

export interface GameState {
  frame: number;
  config: GameConfig;
  fighters: [Fighter, Fighter];
  projectiles: Projectile[];
  walls: Wall[];
  supports: Support[];
  nextId: number;
  phase: GamePhase;
  phaseFrame: number;
  round: number;
  timer: number;
  hitstop: number;
  /** Player index doing a super cinematic, -1 if none, with frames left. */
  freezeBy: number;
  freezeFrames: number;
  rng: number;
  winner: number;
  /** Winner of each finished round (-1 = draw). */
  roundWinners: number[];
  events: GameEvent[];
}
