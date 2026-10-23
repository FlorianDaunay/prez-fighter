/**
 * Chiptune tracks. Some stages use public-domain tunes (Korobeiniki, Ode to Joy, Yankee Doodle,
 * La Marseillaise, Mo Li Hua) re-arranged; the others are generated from a seed, so every stage
 * has its own (deterministic) theme without shipping audio files.
 */

export type Wave = "square" | "pulse" | "triangle" | "sawtooth" | "sine";

export interface Track {
  bpm: number;
  /** One entry per 16th note: MIDI note, -1 = rest, -2 = hold. */
  lead: number[];
  bass: number[];
  arp: number[];
  /** One char per 16th: k kick, s snare, h hat, o open hat, . nothing. */
  drums: string;
  leadWave: Wave;
  bassWave: Wave;
  /** 0..1 volume of the lead. */
  leadVol?: number;
  swing?: number;
}

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(n: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
  if (!m) throw new Error("bad note " + n);
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

/** "E5:2 B4:1 .:1" — durations in eighths, "." = rest. Returns 16th steps. */
function melody(src: string): number[] {
  const out: number[] = [];
  for (const tok of src.trim().split(/\s+/)) {
    if (tok === "|") continue;
    const [n, d = "1"] = tok.split(":");
    const steps = Math.round(Number(d) * 2);
    out.push(n === "." ? -1 : midi(n));
    for (let i = 1; i < steps; i++) out.push(n === "." ? -1 : -2);
  }
  return out;
}

/** Bass line from chord roots (one chord per bar, 16 steps), with a pattern. */
function bassFrom(chords: string[], pattern = "R.R.5.R.R.R.5.8."): number[] {
  const out: number[] = [];
  for (const c of chords) {
    const root = midi(c.replace(/m$/, "") + "2");
    for (const ch of pattern) {
      if (ch === "R") out.push(root);
      else if (ch === "5") out.push(root + 7);
      else if (ch === "8") out.push(root + 12);
      else if (ch === "3") out.push(root + (c.endsWith("m") ? 3 : 4));
      else if (ch === "-") out.push(-2);
      else out.push(-1);
    }
  }
  return out;
}

function arpFrom(chords: string[], octave = 4, pattern = [0, 1, 2, 1]): number[] {
  const out: number[] = [];
  for (const c of chords) {
    const minor = c.endsWith("m");
    const root = midi(c.replace(/m$/, "") + octave);
    const tones = [root, root + (minor ? 3 : 4), root + 7, root + 12];
    for (let i = 0; i < 16; i++) out.push(i % 2 === 0 ? tones[pattern[(i / 2) % pattern.length]] : -1);
  }
  return out;
}

const DRUMS: Record<string, string> = {
  rock: "k.h.s.h.k.kts.h.".replace(/t/g, "h"),
  march: "k.s.k.s.k.sss.s.",
  disco: "k.o.k.o.k.o.k.ohs",
  slow: "k.......s.......",
  polka: "k.h.k.h.k.h.k.h.",
  epic: "k..kk.s.k..kk.ss",
  four: "k.h.s.h.k.h.s.hh",
};

const drum = (style: keyof typeof DRUMS, bars: number) => {
  const p = DRUMS[style].slice(0, 16).padEnd(16, ".");
  return p.repeat(bars);
};

// ---------------------------------------------------------------- generated tracks

type Mode = "major" | "minor" | "dorian" | "pent" | "harm";
const SCALES: Record<Mode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pent: [0, 2, 4, 7, 9],
  harm: [0, 2, 3, 5, 7, 8, 11],
};

const RHYTHMS = [
  [2, 2, 2, 2, 2, 2, 4],
  [4, 2, 2, 4, 4],
  [3, 3, 2, 3, 3, 2],
  [2, 1, 1, 2, 2, 4, 4],
  [6, 2, 4, 4],
  [2, 2, 4, 2, 2, 4],
  [1, 1, 2, 1, 1, 2, 4, 4],
];

function rng(seed: number) {
  let x = seed * 2654435761 >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

interface GenOpts {
  seed: number;
  key: string;
  mode: Mode;
  bpm: number;
  /** Scale degrees (0-based) of each bar's chord. */
  prog: number[];
  drums: keyof typeof DRUMS;
  leadWave?: Wave;
  bassWave?: Wave;
  bassPattern?: string;
}

function generate(o: GenOpts): Track {
  const r = rng(o.seed);
  const scale = SCALES[o.mode];
  const tonic = midi(o.key + "4");
  const deg = (d: number) => {
    const oct = Math.floor(d / scale.length);
    const i = ((d % scale.length) + scale.length) % scale.length;
    return tonic + scale[i] + 12 * oct;
  };
  // A motif per section, AABA structure over the progression.
  const makeBar = (chordDeg: number) => {
    const rhythm = RHYTHMS[Math.floor(r() * RHYTHMS.length)];
    const out: number[] = [];
    let cur = chordDeg + (r() < 0.5 ? 2 : 4);
    for (const d of rhythm) {
      const stepMove = [-2, -1, -1, 0, 1, 1, 2, 3][Math.floor(r() * 8)];
      cur = Math.max(chordDeg - 2, Math.min(chordDeg + 9, cur + stepMove));
      const rest = r() < 0.08;
      out.push(rest ? -1 : deg(cur));
      for (let i = 1; i < d; i++) out.push(rest ? -1 : -2);
    }
    return out.slice(0, 16);
  };
  const half = Math.ceil(o.prog.length / 2);
  const a = o.prog.slice(0, half).map(makeBar);
  const b = o.prog.slice(half).map(makeBar);
  const lead = [...a.flat(), ...b.flat(), ...a.flat(), ...b.map((bar, i) => (i === b.length - 1 ? [deg(0), -2, -2, -2, -2, -2, -2, -2, -1, -1, -1, -1, -1, -1, -1, -1] : bar)).flat()];
  const names = (deg0: number) => {
    const m = deg(deg0) % 12;
    const third = (deg(deg0 + 2) - deg(deg0) + 12) % 12;
    const n = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][m];
    return n + (third === 3 ? "m" : "");
  };
  const chords = [...o.prog, ...o.prog].map(names);
  return {
    bpm: o.bpm,
    lead,
    bass: bassFrom(chords, o.bassPattern),
    arp: arpFrom(chords, 4, [0, 2, 1, 3]),
    drums: drum(o.drums, chords.length),
    leadWave: o.leadWave ?? "pulse",
    bassWave: o.bassWave ?? "triangle",
  };
}

function fixed(bpm: number, lead: string, chords: string[], style: keyof typeof DRUMS, leadWave: Wave = "pulse", bassPattern?: string): Track {
  return { bpm, lead: melody(lead), bass: bassFrom(chords, bassPattern), arp: arpFrom(chords), drums: drum(style, chords.length), leadWave, bassWave: "triangle" };
}

const korobeiniki =
  "E5:2 B4:1 C5:1 D5:2 C5:1 B4:1 A4:2 A4:1 C5:1 E5:2 D5:1 C5:1 B4:3 C5:1 D5:2 E5:2 C5:2 A4:2 A4:2 .:2 " +
  ".:1 D5:2 F5:1 A5:2 G5:1 F5:1 E5:3 C5:1 E5:2 D5:1 C5:1 B4:2 B4:1 C5:1 D5:2 E5:2 C5:2 A4:2 A4:2 .:2";
const odeToJoy =
  "E5:2 E5:2 F5:2 G5:2 G5:2 F5:2 E5:2 D5:2 C5:2 C5:2 D5:2 E5:2 E5:3 D5:1 D5:4 " +
  "E5:2 E5:2 F5:2 G5:2 G5:2 F5:2 E5:2 D5:2 C5:2 C5:2 D5:2 E5:2 D5:3 C5:1 C5:4";
const yankee =
  "C5 C5 D5 E5 C5 E5 D5 G4 C5 C5 D5 E5 C5:2 B4:2 C5 C5 D5 E5 F5 E5 D5 C5 B4 G4 A4 B4 C5:2 C5:2";
const marseillaise =
  ".:5 D4:1 D4:1 D4:1 G4:2 G4:2 A4:2 A4:2 D5:3 B4:1 G4:2 G4:1 B4:1 G4:2 E4:2 C5:4 A4:1 F#4:1 G4:4 .:2 " +
  "G4:2 B4:2 D5:2 G5:2 F#5:2 E5:2 D5:4 C5:2 A4:2 F#4:2 A4:2 G4:6 .:2";
const moLiHua =
  "E5:2 E5:1 G5:1 A5:1 C6:1 C6:1 A5:1 G5:2 G5:1 A5:1 G5:4 E5:2 E5:1 G5:1 A5:1 C6:1 C6:1 A5:1 G5:2 G5:1 A5:1 G5:4 " +
  "G5:2 G5:2 G5:2 E5:1 G5:1 A5:2 A5:2 G5:4 E5:2 D5:1 E5:1 G5:2 E5:1 D5:1 C5:2 C5:1 D5:1 C5:4";

export const TRACKS: Record<string, Track> = {
  title: generate({ seed: 7, key: "D", mode: "harm", bpm: 132, prog: [0, 5, 3, 4, 0, 5, 6, 4], drums: "epic", leadWave: "sawtooth" }),
  select: generate({ seed: 31, key: "A", mode: "dorian", bpm: 118, prog: [0, 3, 0, 4, 0, 3, 5, 4], drums: "four" }),
  elysee: generate({ seed: 11, key: "C", mode: "major", bpm: 128, prog: [0, 4, 5, 3, 0, 4, 3, 4], drums: "rock" }),
  meeting: generate({ seed: 23, key: "E", mode: "minor", bpm: 138, prog: [0, 5, 2, 6, 0, 3, 4, 4], drums: "epic", leadWave: "sawtooth" }),
  republique: generate({ seed: 41, key: "G", mode: "minor", bpm: 112, prog: [0, 3, 6, 2, 0, 3, 4, 0], drums: "march", leadWave: "square" }),
  yacht: generate({ seed: 53, key: "F", mode: "dorian", bpm: 122, prog: [0, 3, 0, 3, 5, 4, 3, 4], drums: "disco", bassPattern: "R.8.R.8.R.8.R.85" }),
  correze: generate({ seed: 67, key: "B", mode: "pent", bpm: 96, prog: [0, 3, 2, 4, 0, 3, 1, 4], drums: "slow", leadWave: "triangle" }),
  salon: generate({ seed: 79, key: "G", mode: "major", bpm: 140, prog: [0, 4, 0, 4, 3, 0, 4, 0], drums: "polka", leadWave: "square", bassPattern: "R...5...R...5..." }),
  arc: fixed(108, marseillaise, ["G", "G", "D", "C", "G", "G", "D", "D", "G"], "march", "square"),
  plage: generate({ seed: 97, key: "A", mode: "major", bpm: 116, prog: [0, 5, 3, 4, 0, 5, 1, 4], drums: "four", leadWave: "triangle" }),
  golf: fixed(124, yankee, ["C", "C", "C", "G"], "march"),
  kremlin: fixed(150, korobeiniki, ["Am", "Am", "E", "Am", "Dm", "C", "E", "Am"], "rock", "square"),
  muraille: fixed(92, moLiHua, ["C", "C", "C", "C", "C", "F", "Am", "C"], "slow", "triangle"),
  bruxelles: fixed(126, odeToJoy, ["C", "G", "C", "G", "C", "G", "C", "C"], "four"),
  assemblee: generate({ seed: 113, key: "D", mode: "minor", bpm: 134, prog: [0, 6, 5, 4, 0, 6, 3, 4], drums: "rock", leadWave: "sawtooth" }),
};
