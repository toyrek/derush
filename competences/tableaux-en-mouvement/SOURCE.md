# D'où vient cette compétence

Lue et assemblée le 24 novembre 2026. Quatre origines ; chacune garde sa licence (`LICENSE`, et les textes complets dans `../licences/`).

| Partie | Source | Version | Licence | Auteur |
|---|---|---|---|---|
| `moteur/`, `recettes/art/` (53 fiches), `references/huashu/` (15 documents) | https://github.com/alchaincyf/huashu-art-motion | commit `a97c45018d46e950d56d61981138e08f4e092909` | MIT | alchaincyf (花叔) |
| `recettes/dessin/` (32 fiches), `references/anidoodle/` (9 documents) | https://github.com/alexgreensh/anidoodle | commit `4ae27d2c281fcfd01bce87ab13dc5ad4df81a795` | Apache-2.0 (notice : `NOTICE-anidoodle.txt`) | Alex Greenshpun |
| `recettes/mouvement/` (15 fiches), `references/jury.md`, `references/ecrire-un-style-de-mouvement.md` | https://github.com/Vincentwei1021/mg-styles-15 | commit `46fd009ff0988be7ab1d9a64dfe14e501c6c2521` | MIT | Vincentwei1021 |
| `SKILL.md`, `methode.md`, `catalogue.json`, les en-têtes « Dans Dérush » | écrits pour Dérush | — | celle de Dérush | IABAI |

`methode.md` reprend des idées du cours public « Motion Design with Fable 5.2 » de seeco (@seeconvm, 16 novembre 2026) : le cours n'a pas de licence, aucun de ses passages n'est recopié.

## Ce qui est repris, et ce qui a été changé

**huashu-art-motion (MIT).**
- `moteur/` : `scripts/engine/` du dépôt, soit `engine.js`, `transitions.js`, `index.html`, les trois films (`eras.js`, `eras_gallery.js`, `eras_style_studies.js`), les 53 scènes de `scenes/`, les bibliothèques de `lib/` (dont `three.min.js`, MIT, avec `THREE_LICENSE.txt`), les clips réglés par un fichier (`clip.html`, `clip.js`, `clips/`, `clip_schema.json`, les exemples de `examples/` qui n'ont pas besoin d'image) et les polices de `lib/fonts/` (SIL OFL 1.1 : `LICENSES.md`, `OFL.txt`).
- Un seul fichier du moteur est changé, et il le dit en tête : `lib/fonts.js`. Les quatre graisses chinoises `NotoSansSC-500/700/800/900.woff` (5,7 Mo) et `NotoSerifJP-600.woff` (4,4 Mo, citée par aucune scène) ne sont pas livrées ; les familles « PuHui-* » pointent vers `NotoSansSC-sub.woff`. `lib/fonts/index.json` perd la ligne de NotoSerifJP. Le texte latin sort comme dans l'original (les 11 images d'essai de la galerie sont identiques à l'octet près) ; un texte chinois hors du sous-ensemble retombe sur une police du système.
- Les fiches de `references/风格配方/` : `recettes/art/<id>.md`, avec un titre français, une phrase et un en-tête « Dans Dérush » ; le texte de la fiche est inchangé.
- 15 documents de méthode (`references/huashu/`, renommés en lettres simples ; `LISEZ-MOI.md` donne la correspondance) : inchangés à une ligne de provenance près.

**anidoodle (Apache-2.0, §4 b : chaque fichier changé le dit à sa fin).**
- Les 30 fiches de style de `skills/anidoodle/references/styles/` et la ligne du registre (`engine/styles.gen.json`) des deux styles sans fiche (`balloon`, `mellan`) : `recettes/dessin/<id>.md`, avec un titre français, une phrase et un en-tête « Dans Dérush ».
- 9 documents de méthode de `skills/anidoodle/references/` (`anatomy`, `camera`, `craft-bar`, `determinism-and-contract`, `motion-grammar`, `realism-and-craft`, `storytelling`, `styles`, `working-method`) : inchangés à une ligne de provenance près.

**mg-styles-15 (MIT).**
- Les 15 fiches de `prompts/` : `recettes/mouvement/<id>.md`, avec un titre français, une phrase et un en-tête « Dans Dérush » ; `rubric.md` et `template.md` : `references/jury.md` et `references/ecrire-un-style-de-mouvement.md`, avec un en-tête « Dans Dérush ».

## Ce qui n'est pas repris

- **huashu-art-motion** : les programmes Python (`render.py`, `qa.py`, `scripts/analyze/`, `scripts/audio/` : Dérush rend et contrôle avec `derush-toile`, sans Playwright) ; `demos/` et `reference_films/` (4 Mo et 1,5 Mo de films d'exemple, dont un « Rick & Morty » et un « SpaceX ») ; `assets/` (49 Mo d'images et de vidéos de démonstration) ; les exemples de clips qui demandent une image (`t2_fullbleed_pulse`, `t2_keynote_ui`, `y2_vox`) ; les documents sur la voix clonée, sur son service de voix et sur les images générées (`06`, `12`, `13`, `口播API`, `images`, `voice-model-review`, `03`, `10`, `11`, `镜头表模板`) ; `about-author.md`.
- **anidoodle** : son moteur (`skills/anidoodle/engine/`, 13 Mo de TypeScript avec sa propre chaîne de fabrication et Playwright), sa musique composée en code, son pack de sons, ses images de référence. Les fiches nomment des fonctions de ce moteur : l'en-tête « Dans Dérush » le dit.
- **mg-styles-15** : ses démonstrations (`demos/`, `videos/`, `lib/`, `site/` : 560 Mo).
- Les noms d'artistes et de studios restent dans les fiches (un choix de l'équipe de Dérush, le 24 novembre 2026) : une fiche donne une manière, jamais un personnage, un logo ou une œuvre ; chaque en-tête le rappelle.

## Rafraîchir

Dans un dossier temporaire : retélécharger les dépôts à un nouveau commit ; recopier `scripts/engine/` (mêmes fichiers) et refaire le changement de `lib/fonts.js` ; refaire les fiches (titre français, phrase, en-tête, pied de provenance), en relisant celles qui sont nouvelles ou changées ; mettre à jour `catalogue.json` et les tableaux de `SKILL.md`. Puis `node outils/essai-tableaux.mjs` (chaque style a sa fiche et sa provenance, le moteur rend la galerie) et `node outils/essai-competences.mjs`.
