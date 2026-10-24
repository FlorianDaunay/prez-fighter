import { useEffect } from "react";
import { playMusic, unlockAudio } from "@/audio/engine";
import { ROSTER } from "@/core/roster";
import { connectedPads } from "@/input/manager";
import { useApp } from "../store";
import { BASE_HINTS, Backdrop, Hints, MenuList, Portrait, Title } from "../components";
import { useMenu } from "../useMenu";

export const DISCLAIMER =
  "Prez Fighter est une œuvre de fiction parodique et satirique. Les personnages sont des caricatures fictives dont les noms ont été volontairement modifiés : leurs propos, programmes, coups spéciaux et biographies sont inventés ou grossis à des fins humoristiques et ne reflètent ni les positions réelles ni la vie privée de quiconque. Toute ressemblance avec des personnalités existantes est caricaturale et assumée comme telle. Aucun parti, gouvernement ou personne n'est associé à ce jeu ni ne le cautionne. La violence y est cartoon, comme dans un dessin animé.";

export function Boot() {
  const go = useApp((s) => s.go);
  const next = () => {
    unlockAudio();
    go("title");
  };
  useMenu(() => next());
  useEffect(() => {
    const k = () => next();
    window.addEventListener("pointerdown", k);
    return () => window.removeEventListener("pointerdown", k);
  });
  return (
    <Backdrop>
      <div className="h-full flex items-center justify-center p-6">
        <div className="panel max-w-2xl p-8 anim-pop">
          <h2 className="font-arcade text-2xl text-accent mb-4">⚠ Avertissement</h2>
          <p className="text-text-secondary leading-relaxed">{DISCLAIMER}</p>
          <p className="mt-4 text-text-muted text-sm">
            Jeu 100 % navigateur : sons et décors générés en direct, jeu en ligne en pair-à-pair (aucune donnée de partie ne passe par un serveur).
          </p>
          <p className="mt-6 text-center font-arcade text-accent anim-blink">Appuie sur une touche ou un bouton</p>
        </div>
      </div>
    </Backdrop>
  );
}

export function TitleScreen() {
  const go = useApp((s) => s.go);
  useEffect(() => playMusic("title"), []);
  useMenu((e) => {
    if (e.action === "confirm" || e.action === "pause") go("menu");
  });
  const half = Math.ceil(ROSTER.length / 2);
  return (
    <Backdrop color="#d7262e">
      <div className="h-full flex flex-col items-center justify-center gap-8 p-6 cursor-pointer" onClick={() => go("menu")}>
        <div className="flex flex-wrap justify-center gap-1 opacity-90 max-w-5xl">
          {ROSTER.slice(0, half).map((c, i) => (
            <div key={c.id} className="anim-float" style={{ animationDelay: `${i * 0.15}s` }}>
              <Portrait look={c.look} size={70} />
            </div>
          ))}
        </div>
        <div className="text-center anim-pop">
          <h1 className="logo text-6xl md:text-8xl">PREZ</h1>
          <h1 className="logo text-6xl md:text-8xl -mt-2">FIGHTER</h1>
          <p className="mt-6 font-arcade text-lg md:text-xl text-white stroke-text">Le Tournoi de l'Élysée</p>
        </div>
        <div className="flex flex-wrap justify-center gap-1 opacity-90 max-w-5xl">
          {ROSTER.slice(half).map((c, i) => (
            <div key={c.id} className="anim-float" style={{ animationDelay: `${i * 0.15 + 0.4}s` }}>
              <Portrait look={c.look} size={70} flip />
            </div>
          ))}
        </div>
        <p className="font-arcade text-accent text-xl anim-blink">Appuie sur Entrée / Start</p>
        <p className="absolute bottom-3 text-xs text-text-muted px-4 text-center">Parodie fictive — personnages caricaturaux aux noms modifiés. v{__APP_VERSION__}</p>
      </div>
    </Backdrop>
  );
}

export function MainMenu() {
  const { go, set } = useApp();
  useEffect(() => playMusic("title"), []);
  const start = (mode: "arcade" | "versus" | "cpu" | "training") => {
    set({ mode, arcade: null });
    go("select");
  };
  const pads = connectedPads().length;
  return (
    <Backdrop>
      <div className="h-full grid md:grid-cols-[1fr_1fr] gap-8 p-8 md:p-14 items-center">
        <div>
          <Title sub="Sélectionne un mode de jeu">PREZ FIGHTER</Title>
          <div className="mt-8">
            <MenuList
              onBack={() => go("title")}
              items={[
                { label: "Arcade", icon: "trophy", desc: "Six combats contre l'ordinateur pour conquérir l'Élysée. Les invités étrangers attendent au bout.", onSelect: () => start("arcade") },
                { label: "Versus local", icon: "gamepad", desc: "Deux joueurs sur la même machine (clavier partagé et/ou manettes).", onSelect: () => start("versus") },
                { label: "Contre l'ordi", icon: "robot", desc: "Un combat rapide contre l'ordinateur. Difficulté réglable dans les options.", onSelect: () => start("cpu") },
                { label: "En ligne", icon: "globe", desc: "Combat en pair-à-pair avec un code de salon. Netcode à rollback : pas de lag d'entrée.", onSelect: () => go("online") },
                { label: "Entraînement", icon: "glove", desc: "Vie et jauge infinies, mannequin immobile. Pour réviser ses combos.", onSelect: () => start("training") },
                { label: "Personnages", icon: "scroll", desc: "Le casting, son lore (très) caricatural et la liste des coups avec aperçus animés.", onSelect: () => go("roster") },
                { label: "Commandes", icon: "joystick", desc: `Clavier et manettes, tout est remappable. ${pads ? `${pads} manette(s) détectée(s).` : "Aucune manette détectée : appuie sur un bouton de la manette."}`, onSelect: () => go("controls") },
                { label: "Options", icon: "gear", desc: "Son, durée des rounds, difficulté, thème.", onSelect: () => go("options") },
                { label: "Mentions", icon: "info", desc: "Avertissement, crédits et informations.", onSelect: () => go("credits") },
              ]}
            />
          </div>
        </div>
        <div className="hidden md:flex justify-center">
          <div className="grid grid-cols-5 gap-2 rotate-3 opacity-80">
            {ROSTER.map((c, i) => (
              <div key={c.id} className="anim-float rounded-tile overflow-hidden border-2 border-black/50" style={{ background: c.color, animationDelay: `${i * 0.1}s` }}>
                <Portrait look={c.look} size={84} flip={i % 2 === 1} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <Hints items={BASE_HINTS} />
    </Backdrop>
  );
}

export function Credits() {
  const go = useApp((s) => s.go);
  useMenu((e) => {
    if (e.action === "back" || e.action === "confirm") go("menu");
  });
  return (
    <Backdrop>
      <div className="h-full overflow-y-auto p-8 md:p-14">
        <Title>Mentions</Title>
        <div className="panel mt-6 p-6 max-w-3xl space-y-4 text-text-secondary leading-relaxed">
          <h2 className="font-arcade text-accent">Fiction et parodie</h2>
          <p>{DISCLAIMER}</p>
          <p>
            Les citations prêtées aux personnages sont, au mieux, de lointains clins d'œil à des formules publiques connues, détournées pour l'humour ; elles ne sont pas des propos rapportés.
          </p>
          <h2 className="font-arcade text-accent">Musique et sons</h2>
          <p>
            Tout est synthétisé en direct par le navigateur. Certains décors reprennent des airs du domaine public réarrangés en chiptune (Korobeiniki, l'Ode à la joie, Yankee Doodle, La Marseillaise, Mo Li Hua) ; les autres thèmes sont générés.
          </p>
          <h2 className="font-arcade text-accent">Jeu en ligne</h2>
          <p>
            Connexion directe entre navigateurs (WebRTC via PeerJS) ; le serveur public PeerJS ne sert qu'à la mise en relation. Seules les entrées manette/clavier transitent entre les joueurs.
          </p>
          <h2 className="font-arcade text-accent">Données</h2>
          <p>Les réglages sont enregistrés uniquement dans ce navigateur (localStorage).</p>
        </div>
      </div>
      <Hints items={[["Échap / B", "Retour"]]} />
    </Backdrop>
  );
}
