import { useState } from "react";
import { sfx } from "@/audio/engine";
import { SLOT_INPUT } from "@/core/moves";
import { ROSTER } from "@/core/roster";
import type { MoveSlot } from "@/core/types";
import { MovePreview } from "../components";
import { useMenu } from "../useMenu";

type Entry = { slot: MoveSlot | "support"; name: string; input: string; desc: string; kind: string };

export function moveEntries(char: number): Entry[] {
  const c = ROSTER[char];
  const out: Entry[] = [];
  const add = (slot: MoveSlot, kind: string) => {
    const m = c.moves[slot];
    if (m) out.push({ slot, name: m.name, input: SLOT_INPUT[slot], desc: m.desc ?? "", kind });
  };
  (["sN", "sF", "sD", "sU"] as MoveSlot[]).forEach((s) => add(s, "Spécial"));
  add("super", "Super");
  out.push({ slot: "support", name: c.support.name, input: "Soutien", desc: c.support.desc, kind: "Soutien" });
  add("throw", "Base");
  (["L", "H", "cL", "cH", "jL", "jH"] as MoveSlot[]).forEach((s) => add(s, "Base"));
  return out;
}

const KIND_COLOR: Record<string, string> = { Spécial: "#ffcc1a", Super: "#5ef0ff", Soutien: "#ff7ad9", Base: "#9093c9" };

/** Full-screen move list with an animated preview of the selected move. */
export function MoveListModal({ char, onClose }: { char: number; onClose: () => void }) {
  const entries = moveEntries(char);
  const [sel, setSel] = useState(0);
  const c = ROSTER[char];
  useMenu((e) => {
    if (e.action === "up") {
      setSel((s) => (s - 1 + entries.length) % entries.length);
      sfx("move");
    } else if (e.action === "down") {
      setSel((s) => (s + 1) % entries.length);
      sfx("move");
    } else if (e.action === "back" || e.action === "extra") {
      sfx("back");
      onClose();
    }
  });
  const cur = entries[sel];
  return (
    <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8">
      <div className="panel w-full max-w-6xl max-h-full overflow-hidden grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-0 anim-pop">
        <div className="p-4 overflow-y-auto max-h-[80vh]">
          <h2 className="font-arcade text-xl" style={{ color: c.color === "#f2f2f2" ? "#ffcc1a" : c.color }}>
            {c.name}
          </h2>
          <p className="text-xs text-text-muted mb-3">Liste des coups — ↑↓ pour voir l'aperçu</p>
          <div className="flex flex-col gap-1">
            {entries.map((e, i) => (
              <button
                key={e.slot}
                onMouseEnter={() => setSel(i)}
                className={`text-left px-3 py-1.5 rounded-control flex items-center gap-3 ${i === sel ? "bg-accent text-accent-foreground" : "hover:bg-surface-hover"}`}
              >
                <span className="text-[10px] font-arcade w-14 shrink-0" style={{ color: i === sel ? undefined : KIND_COLOR[e.kind] }}>
                  {e.kind}
                </span>
                <span className="font-arcade text-sm flex-1 truncate">{e.name}</span>
                <span className="text-xs opacity-80 shrink-0">{e.input}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-black/40 p-4 flex flex-col gap-3">
          <MovePreview char={char} slot={cur.slot} />
          <div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h3 className="font-arcade text-2xl text-accent">{cur.name}</h3>
              <span className="kbd">{cur.input}</span>
            </div>
            <p className="mt-2 text-text-secondary">{cur.desc || "Coup de base."}</p>
            <p className="mt-3 text-xs text-text-muted">
              Astuces : les coups de base qui touchent s'annulent en spécial ou en super. Maintiens la direction opposée pour garder (bas + arrière contre les coups bas). La Super se lance quand la jauge bleue est pleine.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
