# Provenance

- Source : https://github.com/charlie947/motion-graphics-skills (dossier `skills/motion-effects`), commit 229022ebca76972e119e36ada23a1648d51665ab (11 octobre 2026).
- Auteur : Charlie Hills. Licence MIT (texte dans `../licences/charlie947.txt`). Aucun SKILL.md du dépôt ne déclare d'autre licence.
- Intégrée à Dérush le 14 novembre 2026, après lecture : deux fichiers de texte (SKILL.md et `references/effects.md`), aucun programme, aucun appel réseau, aucune clé. Relue une seconde fois le même jour sur une archive du commit retéléchargée (identifiée par `git get-tar-commit-id`), avec le texte de la licence comparé octet par octet.
- Les seize recettes de `references/effects.md` sont celles de l'auteur ; une seule expression y a changé (les couleurs se prennent dans « the brand », plus dans son fichier `MOTION.md`).
- Retiré :
  - la ligne qui proposait d'installer HyperFrames (`npx skills add heygen-com/hyperframes`) et le texte d'export à coller, écrit pour une page HTML ;
  - les renvois à deux autres compétences de l'auteur, non livrées (`brand-intake`, `reel-export`) et à ses fichiers `brand.md` et `MOTION.md` (dans Dérush, `MOTION.md` est le guide « Bien animer », qu'on ne réécrit pas) ;
  - ce qui ne vaut que pour une page HTML : `window.seek()`, la lecture automatique et `?render`, la leçon « A blank page is usually a name declared twice ».
- Adapté :
  - la description : une phrase, sans la liste de phrases déclencheuses ; `license: MIT` ajouté dans l'en-tête ;
  - l'étape 1 ne demande plus d'attendre une réponse : les quatre choix se prennent dans le brief et les pièces jointes, et l'IA ne pose une question que si quelqu'un est là pour répondre ;
  - l'étape 3 construit une composition Remotion (`useCurrentFrame()`) au lieu d'un fichier `effect.html` ; les règles de l'auteur (une seule horloge, la boucle de 8 s, le retour au départ, du vrai contenu, rien du réseau, l'effet à l'échelle de l'image) sont gardées ;
  - l'étape 4 vérifie « la marque » au lieu de son `MOTION.md` ; l'étape 5 rend un MP4 (et un GIF si on en veut un) avec les outils de Dérush, à la cadence du projet ;
  - deux leçons de « What I learned the hard way » sont dites pour une composition (la police chargée avant la première image, une seule unité de temps convertie une fois) ; la passation propose une version verticale au lieu de `reel-export` ;
  - une note « Dans Dérush », en tête : où écrire l'effet, le calcul des images (images = secondes × fps ; à 30 images par seconde 0, 66, 198, 240), où est la marque, les polices, les contrôles (`node remotion/images.mjs`, `derush-controle`), les annotations de planche de démonstration à ne pas reprendre (effets 07, 08, 10 et 16, vérifiées dans les recettes), la police variable de l'effet 10, et l'accord avec `MOTION.md` et `video-design`.
- Non repris du dépôt : `prompts/effects.md` (les mêmes effets en textes à coller, avec un lien vers une lettre d'information) et les images de démonstration. La compétence `vox-explainer` du même dépôt n'a pas été retenue.
