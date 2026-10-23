# Prez Fighter — Le Tournoi de l'Élysée

Jeu de combat 2D parodique dans le navigateur : des caricatures de politiciens français (et quelques invités internationaux) s'affrontent avec des coups tirés de leurs programmes et de leurs petites phrases. Chacun a un **soutien** (une personne ou un groupe) qu'il peut appeler en plein combat.

> ⚠️ **Œuvre de fiction parodique.** Les personnages sont des caricatures fictives aux noms volontairement modifiés ; leurs propos, programmes et biographies sont inventés ou grossis pour l'humour et ne reflètent ni les positions réelles ni la vie privée de quiconque. Aucun parti, gouvernement ou personne n'est associé à ce jeu.

## Jouer

- **Arcade** : 6 combats contre l'ordi, les invités étrangers en boss.
- **Versus local** : 2 joueurs (clavier partagé et/ou manettes).
- **Contre l'ordi** et **Entraînement**.
- **En ligne** : pair-à-pair (WebRTC/PeerJS) avec un code ou un lien de salon, **netcode à rollback** (aucun délai sur ses propres commandes).

### Commandes par défaut

| Action | Clavier gauche | Clavier droite | Manette (positions) |
| --- | --- | --- | --- |
| Déplacements | Z Q S D (W A S D en QWERTY) | Flèches | Croix / stick gauche |
| Léger · Lourd · Spécial | F · G · H | K · L · M | Gauche · Haut · Bas |
| Soutien · Super | R · T | I · O | Droite · R/ZR |
| Projection (Léger+Lourd) | V | P | L/ZL |
| Pause | Échap | Retour arrière | + / Start |

Spéciaux : **Spécial**, **→ + Spécial**, **↓ + Spécial**, **↑ + Spécial** ; **Super** quand la jauge bleue est pleine. Garde : maintenir la direction opposée à l'adversaire (en bas pour les coups bas). Les coups de base qui touchent s'annulent en spécial ou en super.

Tout se remappe dans **Commandes** (capture touche/bouton/axe), y compris l'attribution des appareils à chaque joueur. Manette Switch Pro en USB : reconnue en disposition standard sous Chrome/Edge (A valide, B revient dans les menus).

## Le casting

Candidats français : Emmanuel Macaron, Marine Le Pain, Jean-Luc Méluchon, Nicolas Sarkozix, François Hollandaise, Jacques Chirashi, Charles de Gaufre, Ségolène Royaume.
Invités internationaux : Donald Trompe (+ Elon Mousse), Vladimir Poutrine (+ l'Usine à Trolls), Xi Pingpong (+ les Pandas Diplomatiques), Angela Merguez (+ Ursula von der Lait).

Lore, soutiens et liste des coups avec aperçus animés : menu **Personnages**.

## Développement

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # simulation, rollback, pistes audio
npm run build      # typecheck + build statique dans dist/
```

Architecture :

```
src/core/     simulation pure et déterministe (pas de DOM) : règles, roster, IA
src/net/      rollback netcode (testé avec latence/pertes simulées) + lien PeerJS
src/render/   rendu canvas procédural : personnages caricaturés, décors, effets, HUD
src/audio/    synthé chiptune + bruitages (Web Audio, aucun fichier)
src/input/    clavier + Gamepad API, remappage, navigation des menus
src/ui/       écrans React (menus style arcade)
src/themes/   système de thèmes (tokens → variables CSS → Tailwind)
```

Tout est généré par le code (graphismes, musique, sons) : aucun asset externe hormis les polices Google Fonts.

## Déploiement

Site statique : `.github/workflows/deploy.yml` publie `dist/` sur GitHub Pages à chaque push sur `main` (Settings → Pages → Source : GitHub Actions).
