import { useEffect, useRef, useState, type ReactNode } from "react";
import { sfx } from "@/audio/engine";
import { BTN } from "@/core/input";
import { ROSTER } from "@/core/roster";
import { createGame, step } from "@/core/sim";
import type { GameState, MoveSlot } from "@/core/types";
import type { MenuEvent } from "@/input/manager";
import { Renderer } from "@/render/renderer";
import { portraitUrl } from "@/render/portraits";
import { spriteUrl } from "@/render/sprites";
import { useMenu } from "./useMenu";

// ---------------------------------------------------------------- layout

export function Backdrop({ color = "#1d3fa0", children }: { color?: string; children: ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: `radial-gradient(ellipse at 30% 20%, ${color}55, transparent 60%), radial-gradient(ellipse at 80% 90%, #d7262e44, transparent 55%), rgb(var(--color-canvas))` }}>
      <div className="stripes absolute inset-0 pointer-events-none" />
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}

export function Hints({ items }: { items: [string, string][] }) {
  return (
    <div className="absolute bottom-0 inset-x-0 flex flex-wrap justify-center gap-x-6 gap-y-1 px-4 py-2 bg-black/50 text-xs text-text-secondary">
      {items.map(([k, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="kbd">{k}</span> {label}
        </span>
      ))}
    </div>
  );
}

export const BASE_HINTS: [string, string][] = [
  ["↑↓←→", "Naviguer"],
  ["Entrée / A", "Valider"],
  ["Échap / B", "Retour"],
];

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="anim-slideL">
      <h1 className="logo text-4xl md:text-5xl">{children}</h1>
      {sub && <p className="mt-2 text-text-secondary font-arcade text-sm tracking-wide">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- menu list

export interface MenuItem {
  label: string;
  desc?: string;
  disabled?: boolean;
  onSelect: () => void;
  icon?: string;
}

export function MenuList({ items, onBack, initial = 0, onFocus }: { items: MenuItem[]; onBack?: () => void; initial?: number; onFocus?: (i: number) => void }) {
  const [sel, setSel] = useState(initial);
  const move = (d: number) => {
    let i = sel;
    for (let k = 0; k < items.length; k++) {
      i = (i + d + items.length) % items.length;
      if (!items[i].disabled) break;
    }
    setSel(i);
    onFocus?.(i);
    sfx("move");
  };
  useMenu((e: MenuEvent) => {
    if (e.action === "up") move(-1);
    else if (e.action === "down") move(1);
    else if (e.action === "confirm" && !items[sel]?.disabled) {
      sfx("confirm");
      items[sel].onSelect();
    } else if (e.action === "back" && onBack) {
      sfx("back");
      onBack();
    }
  });
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={`menu-item ${i === sel ? "active" : ""} ${it.disabled ? "disabled" : ""}`}
          onMouseEnter={() => !it.disabled && setSel(i)}
          onClick={() => {
            if (it.disabled) return;
            sfx("confirm");
            it.onSelect();
          }}
        >
          <span>
            {it.icon && <img src={spriteUrl(it.icon, 64)} alt="" className="inline-block w-8 h-8 mr-3 align-middle" />}
            {it.label}
          </span>
        </div>
      ))}
      <p className="min-h-[3em] mt-2 text-sm text-text-secondary max-w-md">{items[sel]?.desc}</p>
    </div>
  );
}

export function Portrait({ look, size = 96, flip = false, className = "" }: { look: string; size?: number; flip?: boolean; className?: string }) {
  return <img src={portraitUrl(look, 160, flip ? -1 : 1)} width={size} height={size} className={className} alt="" draggable={false} />;
}

export function Stars({ n, color = "#ffcc1a" }: { n: number; color?: string }) {
  return (
    <span className="tracking-tight" style={{ color }}>
      {"★".repeat(n)}
      <span className="opacity-25">{"★".repeat(5 - n)}</span>
    </span>
  );
}

// ---------------------------------------------------------------- live move preview

const SLOT_SCRIPT: Record<MoveSlot | "support", (k: number) => number> = {
  L: (k) => (k === 6 ? BTN.LIGHT : 0),
  H: (k) => (k === 6 ? BTN.HEAVY : 0),
  cL: (k) => (k < 40 ? BTN.DOWN : 0) | (k === 8 ? BTN.LIGHT : 0),
  cH: (k) => (k < 50 ? BTN.DOWN : 0) | (k === 8 ? BTN.HEAVY : 0),
  jL: (k) => (k === 4 ? BTN.UP | BTN.RIGHT : 0) | (k === 16 ? BTN.LIGHT : 0),
  jH: (k) => (k === 4 ? BTN.UP | BTN.RIGHT : 0) | (k === 16 ? BTN.HEAVY : 0),
  throw: (k) => (k === 6 ? BTN.LIGHT | BTN.HEAVY : 0),
  sN: (k) => (k === 6 ? BTN.SPECIAL : 0),
  sF: (k) => (k === 6 ? BTN.SPECIAL | BTN.RIGHT : 0),
  sD: (k) => (k === 6 ? BTN.SPECIAL | BTN.DOWN : 0),
  sU: (k) => (k === 6 ? BTN.SPECIAL | BTN.UP : 0),
  super: (k) => (k === 6 ? BTN.SUPER : 0),
  support: (k) => (k === 6 ? BTN.ASSIST : 0),
};

function distanceFor(char: number, slot: MoveSlot | "support"): number {
  if (slot === "support") return 300;
  const def = ROSTER[char].moves[slot as MoveSlot];
  if (slot === "throw" || slot === "sD" && def?.hitboxes?.some((h) => h.hit.grab)) return 75;
  if (def?.projectiles?.length || def?.wall) return 330;
  if (slot === "sF") return 230;
  return 110;
}

function previewState(char: number, slot: MoveSlot | "support"): GameState {
  const dummy = char === 4 ? 0 : 4;
  const s = createGame({ chars: [char, dummy], stage: ROSTER[char].stage, rounds: 1, time: 0, training: true, seed: 3 });
  while (s.phase !== "fight") step(s, [0, 0]);
  s.fighters[0].x = 470;
  s.fighters[1].x = 470 + distanceFor(char, slot);
  s.fighters[0].supportCd = 0;
  s.fighters[1].supportCd = 999999;
  return s;
}

/** Plays a move in a loop with the real simulation and renderer. */
export function MovePreview({ char, slot, className = "" }: { char: number; slot: MoveSlot | "support"; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const r = new Renderer(canvas, true);
    r.setStage(ROSTER[char].stage);
    let state = previewState(char, slot);
    r.reset(state);
    const cycle = slot === "super" ? 210 : slot === "support" ? 170 : 130;
    let k = 0;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += Math.min(100, now - last);
      last = now;
      while (acc >= 1000 / 60) {
        acc -= 1000 / 60;
        if (k >= cycle) {
          k = 0;
          state = previewState(char, slot);
        }
        step(state, [SLOT_SCRIPT[slot](k), 0]);
        k++;
      }
      r.draw(state, { tags: ["", ""] });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [char, slot]);
  return <canvas ref={ref} width={960} height={540} className={`w-full aspect-video rounded-tile border-2 border-black/60 bg-black ${className}`} />;
}

/** Tiny CSS flags (flag emoji do not render on Windows). */
export function Flag({ country, className = "" }: { country: string; className?: string }) {
  const base = `inline-block w-6 h-4 rounded-[2px] border border-black/60 overflow-hidden align-middle ${className}`;
  switch (country) {
    case "us":
      return (
        <span className={base} style={{ background: "repeating-linear-gradient(180deg,#b22234 0 2px,#fff 2px 4px)", position: "relative" }}>
          <span style={{ position: "absolute", left: 0, top: 0, width: "45%", height: "55%", background: "#3c3b6e" }} />
        </span>
      );
    case "ru":
      return <span className={base} style={{ background: "linear-gradient(180deg,#fff 0 33%,#0039a6 33% 66%,#d52b1e 66%)" }} />;
    case "cn":
      return (
        <span className={base} style={{ background: "#de2910", color: "#ffde00", fontSize: 9, lineHeight: "10px", paddingLeft: 2 }}>
          ★
        </span>
      );
    case "de":
      return <span className={base} style={{ background: "linear-gradient(180deg,#000 0 33%,#dd0000 33% 66%,#ffce00 66%)" }} />;
    default:
      return <span className={base} style={{ background: "linear-gradient(90deg,#1d3fa0 0 33%,#fff 33% 66%,#d7262e 66%)" }} />;
  }
}

export const COUNTRY: Record<string, string> = { tromp: "us", poutrine: "ru", pingpong: "cn", merguez: "de" };
