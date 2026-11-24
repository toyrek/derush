# Les documents de méthode de huashu-art-motion

Ces documents sont ceux de l'auteur du moteur de dessin (`moteur/`), en chinois, repris tels quels (MIT). Ils servent quand tu écris une scène pour ce moteur ou que tu cherches comment un style a été peint.

## Comment les lire dans Dérush

- `scripts/engine/…` : le dossier `moteur/` de cette compétence. Dans une page servie par `derush-toile`, c'est `/tableaux/…`.
- `render.py`, `qa.py`, `uv run …`, Playwright : rien de cela n'existe ici. Des images fixes : `derush-toile images … --planche`. Le contrôle : `derush-toile verifier`. La vidéo : `derush-toile rendre` (il mesure aussi le mouvement).
- `--film gallery` devient `--parametres "film=gallery"` ; `--solo <id>` : dans la page, `window.renderSolo('<id>', lt)` dessine une seule scène.
- `scripts/analyze/…`, `scripts/audio/…`, `demos/`, `reference_films/`, `拆解/`, `生图/`, `原片/` : pas livrés.
- Les fiches de style (`风格配方/<id>.md`) sont dans `recettes/art/<id>.md`.
- Les polices chinoises lourdes ne sont pas livrées (voir `SOURCE.md`) : écris tes textes avec les polices latines du moteur ou celles de Dérush (`/polices/`).

## Les fichiers

| Ici | Nom d'origine | De quoi il parle |
|---|---|---|
| `02-mecanisme.md` | `02-机制.md` | les cinq couches d’un film « à travers les époques » (seulement pour ce genre de film) |
| `04-dessin-en-code.md` | `04-纯代码绘制.md` | dessiner en code : la chaîne, les « moteurs de rendu » de lib/paint.js, les pièges |
| `05-rythme-et-musique.md` | `05-节奏与配乐.md` | le rythme : la grille de temps, les croches à 128 BPM |
| `07-ce-qui-marche.md` | `07-正面经验.md` | ce qui a marché, style par style |
| `08-ecrire-un-style.md` | `08-风格作者规范.md` | écrire une scène : l’interface, ce qu’il faut lire d’abord, les exigences, la vérification |
| `09-grammaires-video.md` | `09-视频动画语法.md` | huit grammaires de vidéos qui expliquent (maths, keynote, graphiques, tableau blanc, typo…) et les clips réglés par un fichier |
| `15-style-d-une-scene-a-l-autre.md` | `15-跨场景风格提炼.md` | tirer un style de plusieurs œuvres, et le porter sur un autre sujet |
| `16-protocole-95-points.md` | `16-风格演示95分协议.md` | le protocole pour amener une démonstration de style à 95 points |
| `18-matiere-et-personnages.md` | `18-媒介层与角色入画.md` | la couche de matière (lib/medium.js) et faire entrer un personnage dans le tableau |
| `palettes.md` | `色板.md` | les palettes (lib/palettes.js) |
| `langage-camera.md` | `镜头语言.md` | le langage de la caméra |
| `finesse-des-personnages.md` | `角色精细度.md` | jusqu’où détailler un personnage |
| `index-des-styles.md` | `风格配方/INDEX.md` | l’index des styles : lesquels sont éprouvés par un rendu, lesquels sont encore des études |
| `transitions.md` | `风格配方/_转场_迁移测试.md` | les transitions ajoutées avec les nouveaux styles |
| `musique-en-code.md` | `风格配方/_音轨_艺术史速通.md` | une musique composée en code pour un film rapide (méthode et exemple original) |

Quand un document en cite un autre par son nom d'origine, retrouve-le dans ce tableau.
