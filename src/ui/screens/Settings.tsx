import { useEffect, useState } from "react";
import { playMusic, sfx } from "@/audio/engine";
import { AI_LEVELS } from "@/core/ai";
import { ACTIONS, DEVICES, describeKey, describePad, type Action, type DeviceId } from "@/input/bindings";
import { cancelCapture, connectedPads, deviceInput, startCapture } from "@/input/manager";
import { BTN } from "@/core/input";
import { themes, useActiveTheme, useThemeStore } from "@/themes";
import { useSettings } from "@/store/settings";
import { Backdrop, Hints, Title } from "../components";
import { useApp } from "../store";
import { useMenu } from "../useMenu";

// ---------------------------------------------------------------- options

interface Row {
  label: string;
  value: string;
  change: (d: number) => void;
  desc?: string;
}

function OptionRows({ rows, onBack }: { rows: Row[]; onBack: () => void }) {
  const [sel, setSel] = useState(0);
  useMenu((e) => {
    if (e.action === "up") setSel((s) => (s - 1 + rows.length) % rows.length);
    else if (e.action === "down") setSel((s) => (s + 1) % rows.length);
    else if (e.action === "left") rows[sel].change(-1);
    else if (e.action === "right" || e.action === "confirm") rows[sel].change(1);
    else if (e.action === "back") {
      sfx("back");
      onBack();
      return;
    } else return;
    sfx("move");
  });
  return (
    <div className="flex flex-col gap-1.5 max-w-2xl">
      {rows.map((r, i) => (
        <div
          key={r.label}
          onMouseEnter={() => setSel(i)}
          className={`flex items-center justify-between gap-4 px-4 py-2 rounded-control cursor-pointer ${i === sel ? "bg-accent text-accent-foreground" : "bg-surface/70"}`}
        >
          <span className="font-arcade text-sm">{r.label}</span>
          <span className="flex items-center gap-3 font-arcade text-sm">
            <button onClick={() => r.change(-1)} className="opacity-70 hover:opacity-100">
              ◀
            </button>
            <span className="min-w-[9em] text-center">{r.value}</span>
            <button onClick={() => r.change(1)} className="opacity-70 hover:opacity-100">
              ▶
            </button>
          </span>
        </div>
      ))}
      <p className="text-sm text-text-secondary mt-2 min-h-[2.5em]">{rows[sel]?.desc}</p>
    </div>
  );
}

const cycle = <T,>(list: T[], cur: T, d: number): T => list[(list.indexOf(cur) + d + list.length) % list.length];
const pct = (v: number) => `${Math.round(v * 100)} %`;

export function Options() {
  const s = useSettings();
  const go = useApp((st) => st.go);
  const theme = useActiveTheme();
  const selectTheme = useThemeStore((t) => t.selectTheme);
  useEffect(() => playMusic("title"), []);
  const vol = (v: number, d: number) => Math.max(0, Math.min(1, Math.round((v + d * 0.1) * 10) / 10));
  const rows: Row[] = [
    { label: "Musique", value: pct(s.music), change: (d) => s.set({ music: vol(s.music, d) }) },
    { label: "Effets sonores", value: pct(s.sfx), change: (d) => s.set({ sfx: vol(s.sfx, d) }) },
    { label: "Annonceur (voix)", value: s.announcer ? "Oui" : "Non", change: () => s.set({ announcer: !s.announcer }), desc: "Utilise la synthèse vocale du navigateur." },
    { label: "Manches gagnantes", value: String(s.rounds), change: (d) => s.set({ rounds: cycle([1, 2, 3], s.rounds, d) }) },
    { label: "Durée d'un round", value: s.time ? `${s.time} s` : "Infinie", change: (d) => s.set({ time: cycle([30, 60, 99, 0], s.time, d) }) },
    { label: "Difficulté de l'ordi", value: AI_LEVELS[s.cpuLevel].name, change: (d) => s.set({ cpuLevel: cycle([0, 1, 2, 3], s.cpuLevel, d) }), desc: "Stagiaire, Député, Ministre ou Président." },
    { label: "Délai d'entrée en ligne", value: `${s.inputDelay} image${s.inputDelay > 1 ? "s" : ""}`, change: (d) => s.set({ inputDelay: cycle([0, 1, 2, 3, 4], s.inputDelay, d) }), desc: "Plus de délai = moins de corrections (rollback) visibles. 2 est un bon compromis." },
    { label: "Tremblements d'écran", value: s.screenShake ? "Oui" : "Non", change: () => s.set({ screenShake: !s.screenShake }) },
    { label: "Thème des menus", value: theme.name, change: (d) => selectTheme(cycle(themes.map((t) => t.id), theme.id, d)), desc: theme.description },
  ];
  return (
    <Backdrop>
      <div className="h-full overflow-y-auto p-8 md:p-14">
        <Title sub="← → pour changer une valeur">OPTIONS</Title>
        <div className="mt-6">
          <OptionRows rows={rows} onBack={() => go("menu")} />
        </div>
      </div>
      <Hints items={[["↑↓", "Choisir"], ["←→", "Modifier"], ["Échap / B", "Retour"]]} />
    </Backdrop>
  );
}

// ---------------------------------------------------------------- controls

type Tab = "kbA" | "kbB" | "pad" | "devices";
const TABS: { id: Tab; label: string }[] = [
  { id: "devices", label: "Joueurs" },
  { id: "kbA", label: "Clavier gauche" },
  { id: "kbB", label: "Clavier droite" },
  { id: "pad", label: "Manettes" },
];

function InputTester({ device }: { device: DeviceId }) {
  const [bits, setBits] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setBits(deviceInput(device));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [device]);
  const items: [string, number][] = [["↑", BTN.UP], ["↓", BTN.DOWN], ["←", BTN.LEFT], ["→", BTN.RIGHT], ["L", BTN.LIGHT], ["H", BTN.HEAVY], ["S", BTN.SPECIAL], ["Sout.", BTN.ASSIST], ["Super", BTN.SUPER]];
  return (
    <div className="flex gap-1 flex-wrap">
      {items.map(([l, b]) => (
        <span key={l} className={`px-1.5 py-0.5 rounded-control text-[10px] font-arcade ${bits & b ? "bg-accent text-accent-foreground" : "bg-black/40 text-text-muted"}`}>
          {l}
        </span>
      ))}
    </div>
  );
}

export function Controls() {
  const go = useApp((s) => s.go);
  const s = useSettings();
  const [tab, setTab] = useState<Tab>("devices");
  const [sel, setSel] = useState(0);
  const [waiting, setWaiting] = useState<Action | null>(null);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 1000);
    return () => {
      clearInterval(id);
      cancelCapture();
    };
  }, []);

  const rows = tab === "devices" ? DEVICES.length * 2 + 1 : ACTIONS.length + 1;
  const tabIdx = TABS.findIndex((t) => t.id === tab);

  const capture = (a: Action) => {
    setWaiting(a);
    startCapture((b) => {
      setWaiting(null);
      if (tab === "pad" && b.pad) s.setPad(a, b.pad);
      else if ((tab === "kbA" || tab === "kbB") && b.key) s.setKey(tab, a, b.key);
      sfx("confirm");
    });
  };

  const activate = (i: number) => {
    if (tab === "devices") {
      if (i === rows - 1) return s.resetControls();
      const player = (i % 2) as 0 | 1;
      const dev = DEVICES[Math.floor(i / 2)].id;
      s.toggleSource(player, dev);
      return;
    }
    if (i === rows - 1) return s.resetControls();
    capture(ACTIONS[i].id);
  };

  useMenu(
    (e) => {
      if (waiting) return;
      if (e.action === "up") setSel((x) => (x - (tab === "devices" ? 2 : 1) + rows) % rows);
      else if (e.action === "down") setSel((x) => (x + (tab === "devices" ? 2 : 1)) % rows);
      else if (e.action === "left" && tab === "devices" && sel % 2 === 1) setSel(sel - 1);
      else if (e.action === "right" && tab === "devices" && sel % 2 === 0 && sel < rows - 1) setSel(sel + 1);
      else if (e.action === "extra" || e.action === "alt" || ((e.action === "left" || e.action === "right") && tab !== "devices")) {
        const d = e.action === "left" || e.action === "alt" ? -1 : 1;
        setTab(TABS[(tabIdx + d + TABS.length) % TABS.length].id);
        setSel(0);
      } else if (e.action === "confirm") activate(sel);
      else if (e.action === "back") {
        sfx("back");
        go("menu");
        return;
      } else return;
      sfx("move");
    },
    true
  );

  const pads = connectedPads();

  return (
    <Backdrop>
      <div className="h-full overflow-y-auto p-6 md:p-10 pb-16">
        <Title sub="Tout est configurable : choisis une ligne et valide, puis appuie sur la touche ou le bouton voulu.">COMMANDES</Title>
        <div className="flex gap-2 mt-5 flex-wrap">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setSel(0); }} className={`btn text-sm ${t.id === tab ? "btn-primary" : ""}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 mt-5">
          <div className="panel p-4">
            {tab === "devices" ? (
              <>
                <p className="text-sm text-text-secondary mb-3">
                  En versus local, chaque joueur est contrôlé par les appareils cochés. En solo (arcade, ordi, en ligne), tous les appareils contrôlent le joueur 1.
                </p>
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 items-center">
                  <span />
                  <span className="font-arcade text-xs text-[#ff3b3b]">J1</span>
                  <span className="font-arcade text-xs text-[#3b8bff]">J2</span>
                  {DEVICES.map((d, k) => {
                    const pad = d.id.startsWith("pad") ? pads.find((p) => p.index === Number(d.id.slice(3))) : null;
                    return [
                      <span key={d.id} className="text-sm">
                        {d.label} {pad && <span className="text-text-muted text-xs">— {pad.id.slice(0, 40)}</span>}
                        {d.id.startsWith("pad") && !pad && <span className="text-text-muted text-xs"> (non branchée)</span>}
                      </span>,
                      ...([0, 1] as const).map((p) => {
                        const i = k * 2 + p;
                        const on = s.sources[p].includes(d.id);
                        return (
                          <button key={d.id + p} onClick={() => { setSel(i); activate(i); }} className={`w-9 h-7 rounded-control font-arcade text-xs ${sel === i ? "ring-2 ring-accent" : ""} ${on ? "bg-accent text-accent-foreground" : "bg-black/40"}`}>
                            {on ? "✔" : ""}
                          </button>
                        );
                      }),
                    ];
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1">
                {ACTIONS.map((a, i) => {
                  const binds = tab === "pad" ? s.pad[a.id].map(describePad) : s.keys[tab][a.id].map(describeKey);
                  return (
                    <div key={a.id} onMouseEnter={() => setSel(i)} onClick={() => activate(i)} className={`flex items-center justify-between px-3 py-1.5 rounded-control cursor-pointer ${sel === i ? "bg-accent text-accent-foreground" : "bg-black/20"}`}>
                      <span className="text-sm">{a.label}</span>
                      <span className="flex gap-1">
                        {waiting === a.id ? (
                          <span className="font-arcade text-xs anim-blink">Appuie… (Échap = annuler)</span>
                        ) : binds.length ? (
                          binds.map((b) => <span key={b} className="kbd">{b}</span>)
                        ) : (
                          <span className="text-xs opacity-60">—</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={() => s.resetControls()} className={`btn mt-4 text-sm ${sel === rows - 1 ? "btn-primary" : ""}`}>
              Réinitialiser les commandes
            </button>
          </div>
          <div className="panel p-4 space-y-3 text-sm">
            <h2 className="font-arcade text-accent">Testeur d'entrées</h2>
            {DEVICES.filter((d) => !d.id.startsWith("pad") || pads.some((p) => p.index === Number(d.id.slice(3)))).map((d) => (
              <div key={d.id}>
                <p className="text-xs text-text-muted mb-1">{d.label}</p>
                <InputTester device={d.id} />
              </div>
            ))}
            <h2 className="font-arcade text-accent pt-2">Manettes</h2>
            {pads.length === 0 && <p className="text-text-muted">Aucune manette détectée. Branche-la (USB ou Bluetooth) puis appuie sur un bouton.</p>}
            {pads.map((p) => (
              <p key={p.index} className="text-xs">
                <b>Manette {p.index + 1}</b> : {p.id} {p.mapping === "standard" ? "(disposition standard)" : "(disposition non standard : remappe les boutons ici)"}
              </p>
            ))}
            <p className="text-xs text-text-muted">
              Manette Switch Pro (USB) : reconnue en disposition standard sous Chrome/Edge. Dans les menus, A (droite) valide et B (bas) revient, comme sur Switch. Le stick gauche et la croix déplacent toujours.
            </p>
          </div>
        </div>
      </div>
      <Hints items={[["↑↓", "Choisir"], ["Entrée / A", "Modifier"], ["Tab / Y · X", "Onglet"], ["Échap / B", "Retour"]]} />
    </Backdrop>
  );
}
