import { useEffect, useState } from "react";
import { playMusic, sfx } from "@/audio/engine";
import { ROSTER } from "@/core/roster";
import { STAGES, stageIndex } from "@/core/stages";
import { Backdrop, Hints, Portrait, Stars } from "../components";
import { useApp } from "../store";
import { useMenu } from "../useMenu";
import { MoveListModal } from "./MoveList";
import { Figure } from "./Select";

export function Roster() {
  const go = useApp((s) => s.go);
  const [sel, setSel] = useState(0);
  const [moves, setMoves] = useState(false);
  useEffect(() => playMusic("select"), []);
  useMenu((e) => {
    if (moves) return;
    const n = ROSTER.length;
    const d = e.action === "left" ? -1 : e.action === "right" ? 1 : e.action === "up" ? -5 : e.action === "down" ? 5 : 0;
    if (d) {
      setSel((s) => (s + d + n) % n);
      sfx("move");
    } else if (e.action === "confirm" || e.action === "extra") {
      sfx("select");
      setMoves(true);
    } else if (e.action === "back") {
      sfx("back");
      go("menu");
    }
  });
  const c = ROSTER[sel];
  return (
    <Backdrop color={c.color}>
      <div className="h-full grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-6 p-6 md:p-10 pb-14 overflow-y-auto">
        <div className="flex flex-col gap-3">
          <h1 className="logo text-4xl">LE CASTING</h1>
          <div className="grid grid-cols-5 gap-2">
            {ROSTER.map((r, i) => (
              <div key={r.id} className={`tile ${i === sel ? "p1" : ""}`} style={{ background: `linear-gradient(160deg, ${r.color}, #111)` }} onMouseEnter={() => setSel(i)} onClick={() => setMoves(true)}>
                <Portrait look={r.look} size={120} className="w-full h-auto block" />
              </div>
            ))}
          </div>
          <p className="text-xs text-text-muted">Tous les personnages sont des caricatures fictives aux noms modifiés.</p>
        </div>
        <div key={c.id} className="panel p-5 flex flex-col gap-3 anim-slideR">
          <div className="flex gap-4 items-center">
            <div className="rounded-tile shrink-0" style={{ background: `linear-gradient(180deg, ${c.color}88, transparent)` }}>
              <Figure char={sel} className="h-52 w-auto" />
            </div>
            <div>
              <p className="text-xs font-arcade text-text-muted">{c.origin === "fr" ? "Candidat français" : "Invité international"}</p>
              <h2 className="font-arcade text-3xl leading-tight">{c.name}</h2>
              <p className="font-arcade text-accent">{c.title}</p>
              <p className="text-xs text-text-secondary mt-1">Arène : {STAGES[stageIndex(c.stage)].name}</p>
              <div className="grid grid-cols-2 gap-x-4 text-xs text-text-secondary mt-2">
                <span>Puissance <Stars n={c.rating.power} /></span>
                <span>Vitesse <Stars n={c.rating.speed} /></span>
                <span>Portée <Stars n={c.rating.range} /></span>
                <span>Difficulté <Stars n={c.rating.difficulty} color="#ff7ad9" /></span>
              </div>
            </div>
          </div>
          <p className="leading-relaxed">{c.lore}</p>
          {c.why && (
            <p className="leading-relaxed">
              <b className="font-arcade text-accent text-sm">Pourquoi il/elle débarque : </b>
              {c.why}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-black/30 rounded-tile p-3">
              <p className="font-arcade text-xs text-[#ff7ad9]">Soutien{c.support.members > 1 ? ` · groupe de ${c.support.members}` : ""}</p>
              <p className="font-arcade">{c.support.name}</p>
              <p className="text-sm text-text-secondary">{c.support.desc}</p>
            </div>
            <div className="bg-black/30 rounded-tile p-3">
              <p className="font-arcade text-xs text-accent">Répliques</p>
              {c.quotes.map((q) => (
                <p key={q} className="text-sm italic text-text-secondary">« {q} »</p>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["sN", "sF", "sD", "sU", "jS", "super"] as const).filter((s) => c.moves[s]).map((s) => (
              <span key={s} className="text-xs bg-black/40 rounded-pill px-3 py-1">
                <b className="font-arcade">{c.moves[s]?.name}</b>
              </span>
            ))}
          </div>
          <button className="btn btn-primary self-start" onClick={() => setMoves(true)}>
            Voir les coups (aperçus animés)
          </button>
        </div>
      </div>
      <Hints items={[["↑↓←→", "Choisir"], ["Entrée / A", "Liste des coups"], ["Échap / B", "Retour"]]} />
      {moves && <MoveListModal char={sel} onClose={() => setMoves(false)} />}
    </Backdrop>
  );
}
