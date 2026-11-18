# D'où vient cette compétence

**Source :** OpenMotion, https://github.com/nexu-io/openmotion — commit `2b57cf6908af2a31380955380f5a30eb1857a9c1` (18 novembre 2026).
**Licence :** Apache-2.0 (texte complet : `LICENSE`, et `../licences/openmotion.txt`). Le dépôt d'OpenMotion n'a pas de fichier NOTICE à sa racine.

## Ce qui est repris

- Les 96 recettes de style de la bibliothèque d'OpenMotion (`library/skills/openmotion-*/SKILL.md`, rangées en 7 familles dans `library/README.md`) : `recettes/<id>.md`, où `<id>` est le nom d'origine sans `openmotion-`.
- Les 3 guides de vidéos face caméra de `library/skills/openmotion-presenter-story/references/*/MOTION_DESIGN.md` : `recettes/presenter-listicle.md`, `recettes/workflow-demo.md`, `recettes/product-walkthrough.md`.

## Ce qui a été changé (Apache-2.0, §4 b : chaque fichier changé le dit à sa fin)

- Une seule compétence, `styles-video`, au lieu de 99 : moins de place dans la liste des compétences de l'IA. Les en-têtes YAML des recettes sont retirés ; leur description anglaise devient la citation sous le titre.
- Un nom et une description en français pour chaque style (`catalogue.json`, l'index `SKILL.md`, le choix d'un style dans Dérush) ; le corps des recettes reste en anglais.
- L'en-tête d'OpenMotion (son studio, ses outils de projet, « revision protection », ses outils de génération `openmotion_media_use` et `openmotion_assets_use`) est remplacé par celui de Dérush : HyperFrames ou le kit `remotion/`, `derush-image` (ChatGPT, Mode Hollywood) ou ElevenLabs, le kit média de la personne.
- « Brandkit » devient « brand kit » (le kit média de Dérush) ; « editable in Studio » perd « in Studio » ; la transcription renvoie aux transcriptions de Dérush ou à Whisper.
- Dans les 3 guides face caméra : les liens vers les vidéos d'autres créateurs, et leurs identifiants dans le catalogue d'OpenMotion, sont retirés ; le renvoi à `openmotion-recreate` devient « Comme cette vidéo ».

## Ce qui n'est pas repris

- `agents/openai.yaml` de chaque recette (l'affichage dans l'appli Codex).
- Les vidéos de `openmotion-presenter-story/assets/` (des vidéos d'autres créateurs).
- `openmotion-brandkit` (Dérush a son kit média), `openmotion-design-remix` (9,9 Mo de bibliothèques recopiées), `openmotion-growth-teardown` (une enquête sur une entreprise).
- Le catalogue de modèles d'OpenMotion (`library/templates/catalog/`) : il contient des images tirées de films de marques, dont les droits ne sont pas ceux d'OpenMotion.
- Le studio, le serveur MCP, la passerelle de modèles payants et la télémétrie d'OpenMotion (active par défaut chez lui).

## Rafraîchir

Retélécharger les mêmes fichiers à un nouveau commit, refaire les mêmes changements, relire les recettes nouvelles ou changées, puis relancer `node outils/essai-competences.mjs` : il vérifie que chaque style du catalogue a sa recette, qu'aucun outil d'OpenMotion n'y reste et que chaque recette dit sa provenance.
