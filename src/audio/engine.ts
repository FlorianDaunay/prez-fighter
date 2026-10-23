/** Web Audio: a small chiptune sequencer and synthesized sound effects. No audio files. */
import { useSettings } from "@/store/settings";
import { TRACKS, type Track, type Wave } from "./tracks";

let ctx: AudioContext | null = null;
let musicGain: GainNode;
let sfxGain: GainNode;
let noise: AudioBuffer;
let pulseWave: PeriodicWave;

function init() {
  if (ctx) return ctx;
  ctx = new AudioContext({ latencyHint: "interactive" });
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  musicGain = ctx.createGain();
  sfxGain = ctx.createGain();
  musicGain.connect(master);
  sfxGain.connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // 25 % duty pulse, the classic NES lead.
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
  pulseWave = ctx.createPeriodicWave(real, imag);
  applyVolumes();
  return ctx;
}

export function applyVolumes() {
  if (!ctx) return;
  const s = useSettings.getState();
  musicGain.gain.value = s.music * 0.5;
  sfxGain.gain.value = s.sfx;
}
useSettings.subscribe(applyVolumes);

/** Browsers start audio only after a user gesture. */
export function unlockAudio() {
  const c = init();
  if (c.state === "suspended") void c.resume();
}

const freq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function osc(wave: Wave, f: number, t: number, dur: number, vol: number, out: AudioNode, slideTo?: number) {
  const c = ctx!;
  const o = c.createOscillator();
  if (wave === "pulse") o.setPeriodicWave(pulseWave);
  else o.type = wave;
  o.frequency.setValueAtTime(f, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(vol * 0.6, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseHit(t: number, dur: number, vol: number, filter: BiquadFilterType, fq: number, out: AudioNode) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.value = fq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

// ---------------------------------------------------------------- music

let current: { id: string; track: Track; step: number; next: number; timer: number } | null = null;

function noteLength(arr: number[], i: number) {
  let n = 1;
  while (arr[(i + n) % arr.length] === -2 && n < 32) n++;
  return n;
}

function schedule() {
  if (!ctx || !current) return;
  const { track } = current;
  const stepDur = 60 / track.bpm / 4;
  const len = Math.max(track.lead.length, track.bass.length);
  while (current.next < ctx.currentTime + 0.12) {
    const i = current.step % len;
    const t = current.next;
    const lead = track.lead[i % track.lead.length];
    if (lead >= 0) osc(track.leadWave, freq(lead), t, stepDur * noteLength(track.lead, i % track.lead.length) * 0.95, 0.16 * (track.leadVol ?? 1), musicGain);
    const bass = track.bass[i % track.bass.length];
    if (bass >= 0) osc(track.bassWave, freq(bass), t, stepDur * noteLength(track.bass, i % track.bass.length) * 0.9, 0.22, musicGain);
    const arp = track.arp[i % track.arp.length];
    if (arp >= 0) osc("square", freq(arp + 12), t, stepDur * 0.6, 0.035, musicGain);
    const d = track.drums[i % track.drums.length];
    if (d === "k") osc("sine", 140, t, 0.16, 0.5, musicGain, 40);
    else if (d === "s") {
      noiseHit(t, 0.12, 0.22, "bandpass", 1800, musicGain);
      osc("triangle", 220, t, 0.06, 0.12, musicGain, 120);
    } else if (d === "h") noiseHit(t, 0.03, 0.08, "highpass", 7000, musicGain);
    else if (d === "o") noiseHit(t, 0.12, 0.08, "highpass", 6000, musicGain);
    current.step++;
    current.next += stepDur;
  }
}

export function playMusic(id: string) {
  const c = init();
  if (current?.id === id) return;
  stopMusic();
  const track = TRACKS[id] ?? TRACKS.title;
  current = { id, track, step: 0, next: c.currentTime + 0.08, timer: window.setInterval(schedule, 25) };
  schedule();
}

export function stopMusic() {
  if (current) clearInterval(current.timer);
  current = null;
}

// ---------------------------------------------------------------- effects

export type Sfx =
  | "light" | "heavy" | "block" | "whiff" | "jump" | "land" | "ko" | "super" | "support" | "proj" | "throw"
  | "counter" | "clash" | "wall" | "move" | "confirm" | "back" | "round" | "fight" | "perfect" | "status" | "select";

export function sfx(kind: Sfx, pan = 0) {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime + 0.005;
  const out = ctx.createStereoPanner();
  out.pan.value = Math.max(-1, Math.min(1, pan));
  out.connect(sfxGain);
  switch (kind) {
    case "light":
      noiseHit(t, 0.08, 0.5, "lowpass", 2500, out);
      osc("square", 180, t, 0.06, 0.18, out, 90);
      break;
    case "heavy":
      noiseHit(t, 0.2, 0.8, "lowpass", 1400, out);
      osc("sine", 120, t, 0.25, 0.6, out, 40);
      osc("square", 90, t, 0.12, 0.2, out, 50);
      break;
    case "block":
      osc("square", 900, t, 0.05, 0.12, out, 600);
      noiseHit(t, 0.05, 0.2, "highpass", 3000, out);
      break;
    case "whiff":
      noiseHit(t, 0.1, 0.12, "bandpass", 1200, out);
      break;
    case "jump":
      osc("square", 300, t, 0.1, 0.06, out, 600);
      break;
    case "land":
      osc("sine", 90, t, 0.08, 0.15, out, 50);
      break;
    case "ko":
      osc("sawtooth", 400, t, 0.9, 0.3, out, 50);
      noiseHit(t, 0.6, 0.6, "lowpass", 800, out);
      break;
    case "super":
      osc("sawtooth", 200, t, 0.6, 0.25, out, 1600);
      osc("square", 300, t + 0.1, 0.5, 0.15, out, 2400);
      break;
    case "support":
      [0, 4, 7, 12].forEach((n, i) => osc("pulse", freq(72 + n), t + i * 0.05, 0.12, 0.15, out));
      break;
    case "proj":
      osc("square", 600, t, 0.15, 0.1, out, 200);
      break;
    case "throw":
      osc("sine", 200, t, 0.3, 0.5, out, 50);
      noiseHit(t + 0.1, 0.25, 0.6, "lowpass", 900, out);
      break;
    case "counter":
      osc("square", 1200, t, 0.08, 0.2, out);
      osc("square", 1600, t + 0.08, 0.15, 0.2, out);
      break;
    case "clash":
      osc("triangle", 1500, t, 0.2, 0.25, out, 800);
      break;
    case "wall":
      osc("square", 120, t, 0.25, 0.2, out, 200);
      noiseHit(t, 0.2, 0.3, "lowpass", 600, out);
      break;
    case "status":
      [0, 3, 6].forEach((n, i) => osc("triangle", freq(76 - n), t + i * 0.06, 0.1, 0.15, out));
      break;
    case "move":
      osc("pulse", 880, t, 0.04, 0.08, out);
      break;
    case "select":
      osc("pulse", 660, t, 0.05, 0.1, out);
      osc("pulse", 990, t + 0.05, 0.08, 0.1, out);
      break;
    case "confirm":
      [0, 7, 12].forEach((n, i) => osc("pulse", freq(76 + n), t + i * 0.04, 0.1, 0.14, out));
      break;
    case "back":
      osc("pulse", 500, t, 0.08, 0.1, out, 300);
      break;
    case "round":
      osc("triangle", 880, t, 0.6, 0.3, out);
      osc("triangle", 1320, t, 0.6, 0.1, out);
      break;
    case "fight":
      [0, 4, 7, 12, 16].forEach((n, i) => osc("sawtooth", freq(60 + n), t + i * 0.03, 0.3, 0.12, out));
      break;
    case "perfect":
      [0, 4, 7, 11, 14].forEach((n, i) => osc("pulse", freq(72 + n), t + i * 0.08, 0.2, 0.15, out));
      break;
  }
}

// ---------------------------------------------------------------- announcer

export function announce(text: string) {
  if (!useSettings.getState().announcer || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  u.rate = 1.05;
  u.pitch = 0.7;
  u.volume = Math.min(1, useSettings.getState().sfx + 0.2);
  const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith("fr"));
  if (voice) u.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
