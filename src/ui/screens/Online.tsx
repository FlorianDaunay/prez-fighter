import { useEffect, useRef, useState } from "react";
import { playMusic, sfx } from "@/audio/engine";
import { ROSTER } from "@/core/roster";
import { OnlineLink, type CtlMessage, type LinkStatus } from "@/net/online";
import { useSettings } from "@/store/settings";
import { Backdrop, Hints, MenuList, Portrait, Title } from "../components";
import { useApp } from "../store";
import { useMenu } from "../useMenu";
import { Figure } from "./Select";
import { MoveListModal } from "./MoveList";

const STATUS_TEXT: Record<LinkStatus, string> = {
  idle: "",
  opening: "Ouverture du salon…",
  waiting: "En attente d'un adversaire…",
  connecting: "Connexion…",
  connected: "Connecté !",
  closed: "Connexion fermée.",
  error: "Erreur",
};

/** Reads a join code from the URL (#join=ABCDE). */
export function joinCodeFromUrl(): string | null {
  const m = /join=([A-Z0-9]{4,8})/i.exec(location.hash);
  return m ? m[1].toUpperCase() : null;
}

export function Online() {
  const { link, set, go } = useApp();
  const name = useSettings((s) => s.name);
  const setSettings = useSettings((s) => s.set);
  const [status, setStatus] = useState<LinkStatus>(link?.status ?? "idle");
  const [detail, setDetail] = useState("");
  const [view, setView] = useState<"home" | "join" | "wait" | "lobby">(link?.status === "connected" ? "lobby" : "home");
  const [code, setCode] = useState("");
  const tried = useRef(false);

  useEffect(() => playMusic("select"), []);

  const makeLink = () => {
    const l = new OnlineLink(
      {
        status: (s, d) => {
          setStatus(s);
          setDetail(d ?? "");
          if (s === "connected") setView("lobby");
        },
        ctl: () => {},
        game: () => {},
      },
      name
    );
    set({ link: l });
    return l;
  };

  const host = async () => {
    link?.leave();
    const l = makeLink();
    setView("wait");
    try {
      const c = await l.host();
      setCode(c);
    } catch {
      /* status shows the error */
    }
  };

  const join = async (c: string) => {
    if (c.length < 4) return;
    link?.leave();
    const l = makeLink();
    setView("wait");
    setCode(c.toUpperCase());
    try {
      await l.join(c);
    } catch {
      /* status shows the error */
    }
  };

  useEffect(() => {
    const c = joinCodeFromUrl();
    if (c && !tried.current && !link) {
      tried.current = true;
      history.replaceState(null, "", location.pathname);
      void join(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shareUrl = code ? `${location.origin}${location.pathname}#join=${code}` : "";

  if (view === "lobby" && link) return <Lobby link={link} />;

  return (
    <Backdrop color="#2a8a4a">
      <div className="h-full grid md:grid-cols-2 gap-8 p-8 md:p-14 items-center">
        <div>
          <Title sub="Pair-à-pair, rollback netcode : chacun joue sans délai.">EN LIGNE</Title>
          <div className="mt-6 flex items-center gap-3">
            <label className="text-sm text-text-secondary">Ton pseudo</label>
            <input className="input w-56" maxLength={14} value={name} onChange={(e) => setSettings({ name: e.target.value })} />
          </div>
          <div className="mt-6">
            {view === "home" && (
              <MenuList
                onBack={() => go("menu")}
                items={[
                  { label: "Créer un salon", icon: "🏛️", desc: "Tu obtiens un code (et un lien) à envoyer à ton adversaire.", onSelect: host },
                  { label: "Rejoindre", icon: "🔑", desc: "Entre le code reçu (ou ouvre directement le lien partagé).", onSelect: () => setView("join") },
                  { label: "Retour", icon: "↩", onSelect: () => go("menu") },
                ]}
              />
            )}
            {view === "join" && <JoinForm onJoin={join} onBack={() => setView("home")} />}
            {view === "wait" && (
              <div className="panel p-6 anim-pop">
                {link?.isHost && code && (
                  <>
                    <p className="text-text-secondary text-sm">Code du salon</p>
                    <p className="font-arcade text-5xl tracking-[0.3em] text-accent my-2">{code}</p>
                    <div className="flex gap-2 items-center">
                      <input className="input flex-1 text-xs normal-case tracking-normal" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
                      <button className="btn" onClick={() => navigator.clipboard?.writeText(shareUrl)}>
                        Copier
                      </button>
                    </div>
                  </>
                )}
                <p className={`mt-4 font-arcade ${status === "error" || status === "closed" ? "text-danger" : "text-text-primary anim-blink"}`}>
                  {STATUS_TEXT[status]} {detail && `(${detail})`}
                </p>
                <button
                  className="btn mt-4"
                  onClick={() => {
                    link?.leave();
                    set({ link: null });
                    setView("home");
                    setStatus("idle");
                  }}
                >
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="hidden md:block panel p-6 text-sm text-text-secondary space-y-3">
          <h2 className="font-arcade text-accent">Comment ça marche ?</h2>
          <p>1. Un joueur crée le salon et envoie le code ou le lien.</p>
          <p>2. L'autre le rejoint : la connexion se fait directement entre vos deux navigateurs.</p>
          <p>3. Chacun choisit son personnage, puis c'est parti.</p>
          <p className="text-text-muted">
            Netcode à rollback : vos commandes s'appliquent tout de suite ; si celles de l'adversaire arrivent en retard, le jeu corrige en remontant quelques images. Le délai d'entrée (2 images par défaut) se règle dans les options.
          </p>
        </div>
      </div>
      <Hints items={[["↑↓", "Choisir"], ["Entrée / A", "Valider"], ["Échap / B", "Retour"]]} />
    </Backdrop>
  );
}

function JoinForm({ onJoin, onBack }: { onJoin: (c: string) => void; onBack: () => void }) {
  const [c, setC] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  useMenu((e) => {
    if (e.action === "back") onBack();
  });
  return (
    <form
      className="panel p-6 flex flex-col gap-4 anim-pop"
      onSubmit={(e) => {
        e.preventDefault();
        onJoin(c);
      }}
    >
      <label className="text-text-secondary text-sm">Code du salon</label>
      <input
        ref={ref}
        className="input text-3xl text-center"
        maxLength={8}
        value={c}
        onChange={(e) => setC(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
        onKeyDown={(e) => e.key === "Escape" && onBack()}
      />
      <div className="flex gap-3">
        <button type="submit" className="btn btn-primary flex-1">
          Rejoindre
        </button>
        <button type="button" className="btn" onClick={onBack}>
          Retour
        </button>
      </div>
    </form>
  );
}

function Lobby({ link }: { link: OnlineLink }) {
  const { set, go } = useApp();
  const side: 0 | 1 = link.isHost ? 0 : 1;
  const [mine, setMine] = useState(side === 0 ? 0 : 1);
  const [theirs, setTheirs] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [theirLocked, setTheirLocked] = useState(false);
  const [moves, setMoves] = useState(false);
  const [lost, setLost] = useState("");
  const state = useRef({ mine, locked, theirs, theirLocked });
  state.current = { mine, locked, theirs, theirLocked };

  const startMatch = (seed: number, chars: [number, number], stage: string, rounds: number, time: number) => {
    set({ mode: "online", chars, stage, seed, localSide: side, rules: { rounds, time } });
    go("fight");
  };

  useEffect(() => {
    link.handlers.ctl = (m: CtlMessage) => {
      if (m.t === "sync") {
        link.sendCtl({ t: "pick", char: state.current.mine, locked: state.current.locked });
      } else if (m.t === "pick") {
        setTheirs(m.char);
        setTheirLocked(m.locked);
        if (link.isHost && m.locked && state.current.locked) hostStart(state.current.mine, m.char);
      } else if (m.t === "start" && !link.isHost) {
        link.sendCtl({ t: "started" });
        startMatch(m.seed, m.chars, m.stage, m.rounds, m.time);
      } else if (m.t === "started" && link.isHost) {
        pending.current && startMatch(...pending.current);
      }
    };
    link.handlers.status = (s, d) => {
      if (s === "closed" || s === "error") setLost(d ?? s);
    };
    link.sendCtl({ t: "pick", char: mine, locked: false });
    link.sendCtl({ t: "sync" });
    return () => {
      link.handlers.ctl = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = useRef<[number, [number, number], string, number, number] | null>(null);
  const hostStart = (myChar: number, theirChar: number) => {
    const s = useSettings.getState();
    const chars: [number, number] = [myChar, theirChar];
    const stage = ROSTER[chars[Math.random() < 0.5 ? 0 : 1]].stage;
    const seed = (Math.random() * 65535) | 0;
    pending.current = [seed, chars, stage, s.rounds, s.time];
    link.sendCtl({ t: "start", seed, chars, stage, rounds: s.rounds, time: s.time });
  };

  const pick = (c: number, l: boolean) => {
    setMine(c);
    setLocked(l);
    link.sendCtl({ t: "pick", char: c, locked: l });
    if (l && link.isHost && state.current.theirLocked && state.current.theirs !== null) hostStart(c, state.current.theirs);
  };

  useMenu((e) => {
    if (moves) return;
    const n = ROSTER.length;
    if (e.action === "back") {
      sfx("back");
      if (locked) pick(mine, false);
      else {
        link.leave();
        set({ link: null });
        go("menu");
      }
      return;
    }
    if (locked) return;
    const d = e.action === "left" ? -1 : e.action === "right" ? 1 : e.action === "up" ? -4 : e.action === "down" ? 4 : 0;
    if (d) {
      pick((mine + d + n) % n, false);
      sfx("move");
    } else if (e.action === "confirm") {
      sfx("confirm");
      pick(mine, true);
    } else if (e.action === "extra") setMoves(true);
  });

  const me = ROSTER[mine];
  const them = theirs !== null ? ROSTER[theirs] : null;
  return (
    <Backdrop color={me.color}>
      <div className="h-full grid grid-rows-[auto_1fr] gap-4 p-6 pb-14">
        <div className="text-center">
          <h1 className="logo text-3xl">SALON {link.code}</h1>
          <p className="font-arcade text-sm text-text-secondary mt-1">
            Contre <span className="text-accent">{link.remoteName || "?"}</span> · {Math.round(link.rtt)} ms
          </p>
        </div>
        <div className="grid grid-cols-[1fr_minmax(0,1.4fr)_1fr] gap-4 min-h-0">
          <div className="panel p-4 flex flex-col items-center gap-2" style={{ borderColor: "#ff3b3b" }}>
            <span className="font-arcade text-sm text-[#ff3b3b]">VOUS {locked && "· PRÊT"}</span>
            <Figure char={mine} className="h-56 w-auto" />
            <p className="font-arcade">{me.name}</p>
            <p className="text-xs text-accent font-arcade">{me.title}</p>
          </div>
          <div className="grid grid-cols-4 gap-2 content-center">
            {ROSTER.map((c, i) => (
              <div key={c.id} className={`tile ${i === mine ? "p1" : ""} ${i === theirs ? "p2" : ""}`} style={{ background: `linear-gradient(160deg, ${c.color}, #111)` }} onClick={() => (i === mine ? pick(i, true) : pick(i, false))}>
                <Portrait look={c.look} size={140} className="w-full h-auto block" />
              </div>
            ))}
          </div>
          <div className="panel p-4 flex flex-col items-center gap-2" style={{ borderColor: "#3b8bff" }}>
            <span className="font-arcade text-sm text-[#3b8bff]">ADVERSAIRE {theirLocked && "· PRÊT"}</span>
            {them ? <Figure char={theirs!} flip className="h-56 w-auto" /> : <div className="h-56 flex items-center anim-blink">…</div>}
            <p className="font-arcade">{them?.name ?? "En train de choisir"}</p>
          </div>
        </div>
      </div>
      {lost && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <div className="panel p-6 text-center">
            <p className="font-arcade text-danger mb-4">Adversaire déconnecté ({lost}).</p>
            <button className="btn btn-primary" onClick={() => { set({ link: null }); go("menu"); }}>
              Menu principal
            </button>
          </div>
        </div>
      )}
      <Hints items={[["↑↓←→", "Choisir"], ["Entrée / A", "Prêt"], ["Tab / Y", "Coups"], ["Échap / B", "Quitter"]]} />
      {moves && <MoveListModal char={mine} onClose={() => setMoves(false)} />}
    </Backdrop>
  );
}
