import { useEffect, useMemo, useRef, useState } from "react";
import { announce, playMusic, sfx } from "@/audio/engine";
import { ROSTER, shortName } from "@/core/roster";
import { STAGES, stageIndex } from "@/core/stages";
import { setMenuEnabled } from "@/input/manager";
import { MatchRunner } from "@/game/runner";
import { portraitUrl } from "@/render/portraits";
import { buildStage } from "@/render/stages";
import { useSettings } from "@/store/settings";
import { BASE_HINTS, Backdrop, Hints, MenuList, Title } from "../components";
import { useApp } from "../store";
import { useMenu } from "../useMenu";
import { MoveListModal } from "./MoveList";

// ---------------------------------------------------------------- stage select

const thumbs = new Map<string, string>();
function stageThumb(id: string): string {
  let u = thumbs.get(id);
  if (!u) {
    const l = buildStage(id);
    const c = document.createElement("canvas");
    c.width = 480;
    c.height = 270;
    const x = c.getContext("2d")!;
    x.scale(0.5, 0.5);
    x.drawImage(l.far, -80, 0);
    x.drawImage(l.near, -160, 0);
    u = c.toDataURL("image/jpeg", 0.8);
    thumbs.set(id, u);
  }
  return u;
}

export function StageSelect() {
  const { chars, go, set } = useApp();
  const options = useMemo(
    () => [
      { id: "home1", label: `Chez ${shortName(chars[0])}`, stage: ROSTER[chars[0]].stage },
      { id: "home2", label: `Chez ${shortName(chars[1])}`, stage: ROSTER[chars[1]].stage },
      ...STAGES.map((s) => ({ id: s.id, label: s.name, stage: s.id })),
      { id: "random", label: "Aléatoire", stage: "" },
    ],
    [chars]
  );
  const [sel, setSel] = useState(1);
  const choose = (i: number) => {
    const o = options[i];
    const stage = o.stage || STAGES[Math.floor(Math.random() * STAGES.length)].id;
    set({ stage, seed: Date.now() & 0xffff });
    go("fight");
  };
  useMenu((e) => {
    if (e.action === "left" || e.action === "up") {
      setSel((s) => (s - 1 + options.length) % options.length);
      sfx("move");
    } else if (e.action === "right" || e.action === "down") {
      setSel((s) => (s + 1) % options.length);
      sfx("move");
    } else if (e.action === "confirm") {
      sfx("confirm");
      choose(sel);
    } else if (e.action === "back") {
      sfx("back");
      go("select");
    }
  });
  const cur = options[sel];
  return (
    <Backdrop>
      <div className="h-full flex flex-col items-center justify-center gap-6 p-6 pb-14">
        <Title>CHOIX DE L'ARÈNE</Title>
        <div className="flex items-center gap-6 w-full max-w-4xl">
          <button className="btn" onClick={() => setSel((s) => (s - 1 + options.length) % options.length)}>
            ◀
          </button>
          <div key={cur.id} className="flex-1 anim-pop">
            {cur.stage ? (
              <img src={stageThumb(cur.stage)} className="w-full rounded-card border-4 border-black/70 shadow-overlay" alt="" />
            ) : (
              <div className="w-full aspect-video rounded-card border-4 border-black/70 bg-surface flex items-center justify-center font-arcade text-6xl">?</div>
            )}
            <p className="text-center font-arcade text-2xl mt-3">{cur.label}</p>
            {cur.stage && cur.id.startsWith("home") && <p className="text-center text-text-secondary">{STAGES[stageIndex(cur.stage)].name}</p>}
          </div>
          <button className="btn" onClick={() => setSel((s) => (s + 1) % options.length)}>
            ▶
          </button>
        </div>
        <button className="btn btn-primary" onClick={() => choose(sel)}>
          COMBATTRE
        </button>
      </div>
      <Hints items={[["←→", "Changer"], ["Entrée / A", "Combattre"], ["Échap / B", "Retour"]]} />
    </Backdrop>
  );
}

// ---------------------------------------------------------------- fight

export function Fight() {
  const app = useApp();
  const { mode, chars, stage, seed, link, localSide, go, set } = app;
  const settings = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runnerRef = useRef<MatchRunner | null>(null);
  const [paused, setPaused] = useState(false);
  const [moves, setMoves] = useState(false);
  const [netMsg, setNetMsg] = useState("");
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    const online = mode === "online" && link;
    const training = mode === "training";
    const cpuLevel = mode === "arcade" ? Math.min(3, Math.floor((app.arcade?.index ?? 0) / 2) + settings.cpuLevel) : settings.cpuLevel;
    const runner = new MatchRunner(
      canvasRef.current!,
      {
        config: {
          chars,
          stage,
          rounds: training ? 1 : online && app.rules ? app.rules.rounds : settings.rounds,
          time: training ? 0 : online && app.rules ? app.rules.time : settings.time,
          training,
          seed,
        },
        cpu: mode === "versus" || online ? [null, null] : [null, training ? null : cpuLevel],
        solo: mode !== "versus",
        tags: online ? (localSide === 0 ? ["VOUS", link!.remoteName || "J2"] : [link!.remoteName || "J1", "VOUS"]) : mode === "versus" ? ["J1", "J2"] : ["J1", training ? "MANNEQUIN" : "ORDI"],
        online: online ? { link: link!, local: localSide, delay: settings.inputDelay } : undefined,
        training,
      },
      {
        onEnd: (s) => {
          set({ lastResult: s });
          go("results");
        },
        onPause: (p) => {
          setPaused(p);
          setMenuEnabled(p);
        },
      }
    );
    if (training) {
      // The dummy does nothing: an empty input stream.
      runner.state.fighters[1].supportCd = 999999;
    }
    runnerRef.current = runner;
    if (online) {
      link!.handlers.game = (p) => runner.receive(p);
      link!.handlers.status = (s, d) => {
        if (s === "closed" || s === "error") setNetMsg(`Connexion perdue (${d ?? s}).`);
      };
    }
    setMenuEnabled(false);
    playMusic(STAGES[stageIndex(stage)].music);
    runner.start();
    return () => {
      runner.stop();
      setMenuEnabled(true);
      if (online) link!.handlers.game = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey]);

  const resume = () => runnerRef.current?.setPaused(false);

  return (
    <div className="h-full w-full bg-black flex items-center justify-center">
      <div className="relative" style={{ width: "min(100vw, calc(100vh * 16 / 9))", aspectRatio: "16 / 9" }}>
        <canvas ref={canvasRef} width={960} height={540} className="w-full h-full block" style={{ imageRendering: "auto" }} />
        {paused && !moves && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="panel p-6 w-80 anim-pop">
              <h2 className="logo text-3xl mb-4 text-center">PAUSE</h2>
              <MenuList
                onBack={resume}
                items={[
                  { label: "Reprendre", onSelect: resume },
                  { label: "Liste des coups", onSelect: () => setMoves(true) },
                  { label: "Recommencer", onSelect: () => setRestartKey((k) => k + 1) },
                  { label: "Changer de perso", onSelect: () => go(mode === "arcade" ? "menu" : "select") },
                  { label: "Menu principal", onSelect: () => go("menu") },
                ]}
              />
            </div>
          </div>
        )}
        {moves && <MoveListModal char={chars[mode === "online" ? localSide : 0]} onClose={() => setMoves(false)} />}
        {netMsg && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="panel p-6 text-center">
              <p className="font-arcade text-danger mb-4">{netMsg}</p>
              <button className="btn btn-primary" onClick={() => go("menu")}>
                Menu principal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- results

export function Results() {
  const { lastResult, mode, arcade, go, set, link, localSide } = useApp();
  const s = lastResult!;
  const w = s.winner;
  const human0Won = w === 0;
  const winner = w >= 0 ? ROSTER[s.fighters[w].char] : null;
  const loser = w >= 0 ? ROSTER[s.fighters[1 - w].char] : null;
  const quote = useMemo(() => (winner ? winner.quotes[Math.floor(Math.random() * winner.quotes.length)] : ""), [winner]);
  useEffect(() => {
    playMusic("select");
    if (winner) announce(`Victoire de ${winner.name}`);
    else announce("Match nul");
  }, [winner]);

  let items: { label: string; onSelect: () => void; desc?: string }[] = [];
  if (mode === "arcade" && arcade) {
    if (human0Won) {
      const nextIndex = arcade.index + 1;
      if (nextIndex >= arcade.ladder.length) items = [{ label: "Voir la fin", onSelect: () => go("arcadeEnd") }];
      else {
        const opp = arcade.ladder[nextIndex];
        items = [
          {
            label: "Combat suivant",
            desc: `Prochain adversaire : ${ROSTER[opp].name}${ROSTER[opp].origin === "intl" ? " (invité international)" : ""}`,
            onSelect: () => {
              set({ arcade: { ...arcade, index: nextIndex }, chars: [arcade.char, opp], stage: ROSTER[opp].stage, seed: Date.now() & 0xffff });
              go("fight");
            },
          },
          { label: "Abandonner", onSelect: () => go("menu") },
        ];
      }
    } else {
      items = [
        ...(arcade.continues > 0
          ? [{ label: `Continuer (${arcade.continues})`, onSelect: () => {
              set({ arcade: { ...arcade, continues: arcade.continues - 1 }, seed: Date.now() & 0xffff });
              go("fight");
            } }]
          : []),
        { label: "Abandonner", onSelect: () => go("menu") },
      ];
    }
  } else if (mode === "online") {
    items = [
      { label: "Retour au salon", desc: "Rechoisir les personnages avec le même adversaire.", onSelect: () => go("online") },
      { label: "Quitter", onSelect: () => {
          link?.leave();
          set({ link: null });
          go("menu");
        } },
    ];
  } else {
    items = [
      { label: "Revanche", onSelect: () => {
          set({ seed: Date.now() & 0xffff });
          go("fight");
        } },
      { label: "Changer de personnages", onSelect: () => go("select") },
      { label: "Menu principal", onSelect: () => go("menu") },
    ];
  }

  const youWon = mode === "online" ? w === localSide : mode === "versus" ? null : human0Won;
  const headline = w < 0 ? "MATCH NUL" : youWon === null ? `JOUEUR ${w + 1} GAGNE !` : youWon ? "VICTOIRE !" : "DÉFAITE…";

  return (
    <Backdrop color={winner?.color ?? "#555"}>
      <div className="h-full grid md:grid-cols-2 gap-6 p-8 md:p-14 items-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="logo text-5xl md:text-6xl anim-pop">{headline}</h1>
          {winner && (
            <div className="flex items-end gap-4">
              <img src={portraitUrl(winner.look, 256, 1, "happy")} className="w-56 h-56 rounded-card border-4 border-accent anim-pop" style={{ background: winner.color }} alt="" />
              {loser && <img src={portraitUrl(loser.look, 128, -1, "ko")} className="w-24 h-24 rounded-card border-2 border-black/60 grayscale opacity-80" style={{ background: loser.color }} alt="" />}
            </div>
          )}
          {winner && (
            <div className="panel p-4 max-w-md anim-slideL">
              <p className="font-arcade text-accent text-sm">{winner.name}</p>
              <p className="text-lg italic">« {quote} »</p>
            </div>
          )}
          {mode === "arcade" && arcade && (
            <p className="font-arcade text-sm text-text-secondary">
              Combat {Math.min(arcade.index + 1, arcade.ladder.length)} / {arcade.ladder.length}
            </p>
          )}
        </div>
        <div>
          <MenuList items={items} />
        </div>
      </div>
      <Hints items={BASE_HINTS} />
    </Backdrop>
  );
}

export function ArcadeEnd() {
  const { arcade, go } = useApp();
  const c = ROSTER[arcade?.char ?? 0];
  useMenu((e) => {
    if (e.action === "confirm" || e.action === "back") go("menu");
  });
  useEffect(() => {
    playMusic("title");
    sfx("perfect");
    announce(`${c.name}, président du tournoi !`);
  }, [c]);
  const endings: Record<string, string> = {
    macaron: "Réélu par 49.3 voix contre 0, il décrète la start-up nation obligatoire. Sa première loi : le K.O. devient une compétence transversale.",
    lepain: "Elle installe une boulangerie dans la cour de l'Élysée. La baguette est déclarée arme diplomatique. Les croissants, « suspects ».",
    meluchon: "Il proclame la VIe République depuis 7 hologrammes simultanés. Le 8e, en panne, est accusé de trahison.",
    sarkozix: "Il réforme le tournoi en 48 heures, épouse la ceinture de champion et part en jogging autour de la planète.",
    hollandaise: "Président normal d'un tournoi anormal, il rentre en scooter. Il pleut. Il sourit. C'est normal.",
    chirashi: "Il dissout le tournoi par réflexe, puis fête ça au Salon de l'Agriculture avec 3 000 poignées de main et une pomme.",
    degaufre: "« Je vous ai compris », dit-il à la foule. Personne n'ose lui demander quoi. Il se retire à Colombey avec la coupe.",
    royaume: "Elle fait chanter « Fraternité » au stade entier, puis invente le mot « victoritude », immédiatement contesté par l'Académie.",
    tromp: "Il rebaptise l'Élysée « Trompe Tower », taxe la défaite à 200 % et se déclare vainqueur de tournois qui n'ont pas encore eu lieu.",
    poutrine: "Les résultats officiels lui donnent 146 % des voix. Il fête ça torse nu sur un ours, au sommet de la tour Eiffel.",
    pingpong: "Il rachète le tournoi, puis le pays organisateur, puis le concept de tournoi. Le trophée est désormais fabriqué à Shenzhen.",
    merguez: "Elle signe calmement le traité de paix, range la coupe dans son sac à main et repart en Thalys. Ponctuelle.",
  };
  return (
    <Backdrop color={c.color}>
      <div className="h-full flex flex-col items-center justify-center gap-6 p-8 text-center">
        <h1 className="logo text-5xl md:text-7xl anim-pop">VAINQUEUR DU TOURNOI</h1>
        <img src={portraitUrl(c.look, 256, 1, "happy")} className="w-64 h-64 rounded-card border-4 border-accent anim-float" style={{ background: c.color }} alt="" />
        <p className="font-arcade text-2xl">{c.name}</p>
        <p className="panel p-5 max-w-2xl text-lg leading-relaxed">{endings[c.id]}</p>
        <p className="text-text-muted text-sm">(Fin fictive et parodique.)</p>
        <button className="btn btn-primary" onClick={() => go("menu")}>
          Menu principal
        </button>
      </div>
    </Backdrop>
  );
}
