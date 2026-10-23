import { useEffect, useRef, useState } from "react";
import { playMusic, sfx } from "@/audio/engine";
import { ROSTER, shortName } from "@/core/roster";
import type { MenuEvent } from "@/input/manager";
import { LOOKS } from "@/render/looks";
import { drawPerson } from "@/render/person";
import { namedPose } from "@/render/poses";
import { STANCE } from "@/render/person";
import { useSettings } from "@/store/settings";
import { Backdrop, COUNTRY, Flag, Hints, Portrait, Stars } from "../components";
import { useApp } from "../store";
import { useMenu } from "../useMenu";
import { MoveListModal } from "./MoveList";

const COLS = 4;

/** Small animated full-body figure. */
export function Figure({ char, flip = false, className = "" }: { char: number; flip?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!.getContext("2d")!;
    const look = LOOKS[ROSTER[char].look];
    let raf = 0;
    let t = 0;
    const loop = () => {
      t++;
      if (t % 2 === 0) {
        c.clearRect(0, 0, 300, 340);
        const b = Math.sin(t * 0.06) * 0.05;
        const pose = t % 360 < 300 ? { ...STANCE, armF: [STANCE.armF[0] + b, STANCE.armF[1]] as [number, number], squash: 1 + b * 0.2 } : namedPose(t % 720 < 360 ? "decree" : "shout");
        drawPerson(c, look, pose, { x: 150, y: 330, facing: flip ? -1 : 1, scale: 1.25 / Math.max(1, look.height) });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [char, flip]);
  return <canvas ref={ref} width={300} height={340} className={className} />;
}

function Info({ char, side, locked, label }: { char: number; side: 0 | 1; locked: boolean; label: string }) {
  const c = ROSTER[char];
  const color = side === 0 ? "#ff3b3b" : "#3b8bff";
  return (
    <div key={char} className={`panel p-3 flex flex-col gap-2 h-full min-h-0 ${side === 0 ? "anim-slideL" : "anim-slideR"}`} style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <span className="font-arcade text-sm" style={{ color }}>
          {label}
        </span>
        {locked && <span className="font-arcade text-xs bg-accent text-accent-foreground px-2 rounded-pill anim-pop">PRÊT !</span>}
      </div>
      <div className="relative flex justify-center rounded-tile" style={{ background: `linear-gradient(180deg, ${c.color}66, transparent)` }}>
        <Figure char={char} flip={side === 1} className="h-48 lg:h-60 w-auto" />
        {COUNTRY[c.id] && <Flag country={COUNTRY[c.id]} className="absolute top-2 right-2 scale-150" />}
      </div>
      <div>
        <h2 className="font-arcade text-lg leading-tight">{c.name}</h2>
        <p className="text-xs text-accent font-arcade">{c.title}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-3 text-xs text-text-secondary">
        <span>Puissance <Stars n={c.rating.power} /></span>
        <span>Vitesse <Stars n={c.rating.speed} /></span>
        <span>Portée <Stars n={c.rating.range} /></span>
        <span>Difficulté <Stars n={c.rating.difficulty} color="#ff7ad9" /></span>
      </div>
      <div className="text-xs">
        <span className="text-text-muted">Soutien : </span>
        <span className="font-arcade text-[11px]">{c.support.name}</span>
        {c.support.members > 1 && <span className="text-text-muted"> (groupe de {c.support.members})</span>}
      </div>
      <p className="text-xs text-text-secondary leading-snug overflow-y-auto min-h-0">{c.why ? <><b className="text-accent">Pourquoi il/elle est là : </b>{c.why}</> : c.lore}</p>
    </div>
  );
}

export function CharSelect() {
  const { mode, go, set, chars } = useApp();
  const twoHumans = mode === "versus";
  const [cursor, setCursor] = useState<[number, number]>([chars[0], chars[1]]);
  const [locked, setLocked] = useState<[boolean, boolean]>([false, false]);
  const [moves, setMoves] = useState<number | null>(null);
  const cpuLevel = useSettings((s) => s.cpuLevel);
  useEffect(() => playMusic("select"), []);

  /** Which cursor an event drives. */
  const who = (e: MenuEvent): 0 | 1 => {
    if (twoHumans) {
      if (e.player !== null) return e.player;
      return locked[0] ? 1 : 0;
    }
    if (mode === "arcade") return 0;
    return locked[0] ? 1 : 0;
  };

  const finish = (c: [number, number]) => {
    if (mode === "arcade") {
      const others = ROSTER.map((_, i) => i).filter((i) => i !== c[0]);
      const shuffled = others.sort(() => Math.random() - 0.5);
      const fr = shuffled.filter((i) => ROSTER[i].origin === "fr");
      const intl = shuffled.filter((i) => ROSTER[i].origin === "intl");
      // Four French rivals, then the foreign guests as bosses.
      const ladder = [...fr.slice(0, 4), ...intl.slice(0, 2)];
      if (ladder.length < 6) ladder.push(...fr.slice(4, 4 + 6 - ladder.length));
      set({ arcade: { char: c[0], ladder, index: 0, continues: 3 }, chars: [c[0], ladder[0]], stage: ROSTER[ladder[0]].stage, seed: Date.now() & 0xffff });
      go("fight");
      return;
    }
    set({ chars: c });
    go("stage");
  };

  useMenu((e) => {
    if (moves !== null) return;
    const p = who(e);
    if (e.action === "back") {
      sfx("back");
      if (locked[1]) setLocked([locked[0], false]);
      else if (locked[0]) setLocked([false, false]);
      else go("menu");
      return;
    }
    if (locked[p]) return;
    const move = (d: number) => {
      const n = ROSTER.length;
      const next = [...cursor] as [number, number];
      next[p] = (cursor[p] + d + n) % n;
      setCursor(next);
      sfx("move");
    };
    if (e.action === "left") move(-1);
    else if (e.action === "right") move(1);
    else if (e.action === "up") move(-COLS);
    else if (e.action === "down") move(COLS);
    else if (e.action === "extra") {
      setMoves(cursor[p]);
      sfx("select");
    } else if (e.action === "alt") {
      const next = [...cursor] as [number, number];
      next[p] = Math.floor(Math.random() * ROSTER.length);
      setCursor(next);
      sfx("select");
    } else if (e.action === "confirm") {
      sfx("confirm");
      const l = [...locked] as [boolean, boolean];
      l[p] = true;
      setLocked(l);
      const done = mode === "arcade" ? l[0] : l[0] && l[1];
      if (done) setTimeout(() => finish(cursor), 450);
    }
  });

  const sideLabel = (i: 0 | 1) => {
    if (i === 0) return "JOUEUR 1";
    if (mode === "versus") return "JOUEUR 2";
    if (mode === "training") return "MANNEQUIN";
    return `ORDI · niveau ${cpuLevel + 1}`;
  };
  const showP2 = mode !== "arcade";
  const tileClick = (i: number) => {
    const p = mode === "versus" ? (locked[0] ? 1 : 0) : locked[0] ? 1 : 0;
    const next = [...cursor] as [number, number];
    next[p] = i;
    setCursor(next);
    if (cursor[p] === i) {
      const l = [...locked] as [boolean, boolean];
      l[p] = true;
      setLocked(l);
      sfx("confirm");
      if (mode === "arcade" ? l[0] : l[0] && l[1]) setTimeout(() => finish(next), 450);
    } else sfx("move");
  };

  const prompt = mode === "arcade" ? "Choisis ton candidat" : !locked[0] ? "Joueur 1 : choisis ton candidat" : mode === "versus" ? "Joueur 2 : à toi !" : "Choisis ton adversaire";

  return (
    <Backdrop color={ROSTER[cursor[locked[0] && showP2 ? 1 : 0]].color}>
      <div className="h-full grid grid-rows-[auto_1fr] gap-3 p-4 pb-12">
        <div className="text-center">
          <h1 className="logo text-3xl md:text-4xl">CHOISIS TON CANDIDAT</h1>
          <p className="font-arcade text-sm text-accent mt-1">{prompt}</p>
        </div>
        <div className={`grid gap-4 min-h-0 ${showP2 ? "grid-cols-[1fr_minmax(0,1.5fr)_1fr]" : "grid-cols-[1fr_minmax(0,1.5fr)]"}`}>
          <Info char={cursor[0]} side={0} locked={locked[0]} label={sideLabel(0)} />
          <div className="flex flex-col justify-center gap-2 min-h-0">
            {[0, 1, 2].map((row) => (
              <div key={row}>
                {row === 2 && <p className="font-arcade text-xs text-accent mb-1 text-center">— Invités internationaux —</p>}
                {row === 0 && <p className="font-arcade text-xs text-text-secondary mb-1 text-center">— Candidats français —</p>}
                <div className="grid grid-cols-4 gap-2">
                  {ROSTER.slice(row * COLS, row * COLS + COLS).map((c, k) => {
                    const i = row * COLS + k;
                    const p1 = cursor[0] === i;
                    const p2 = showP2 && cursor[1] === i && (locked[0] || mode === "versus");
                    return (
                      <div key={c.id} className={`tile ${p1 ? "p1" : ""} ${p2 ? "p2" : ""}`} style={{ background: `linear-gradient(160deg, ${c.color}, #111)` }} onClick={() => tileClick(i)}>
                        <Portrait look={c.look} size={160} className="w-full h-auto block" />
                        <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[10px] md:text-xs font-arcade text-center truncate px-1">{shortName(i)}</div>
                        {COUNTRY[c.id] && <Flag country={COUNTRY[c.id]} className="absolute top-1 right-1" />}
                        {p1 && <span className="absolute top-0 left-0 bg-[#ff3b3b] text-[10px] font-arcade px-1">J1</span>}
                        {p2 && <span className="absolute top-0 left-6 bg-[#3b8bff] text-[10px] font-arcade px-1">{mode === "versus" ? "J2" : "CPU"}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {showP2 && <Info char={cursor[1]} side={1} locked={locked[1]} label={sideLabel(1)} />}
        </div>
      </div>
      <Hints items={[["↑↓←→", "Choisir"], ["Entrée / A", "Valider"], ["Tab / Y", "Liste des coups"], ["X", "Aléatoire"], ["Échap / B", "Retour"]]} />
      {moves !== null && <MoveListModal char={moves} onClose={() => setMoves(null)} />}
    </Backdrop>
  );
}
