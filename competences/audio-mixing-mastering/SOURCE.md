# Provenance

- Source : https://github.com/calesthio/generative-media-skills (dossier `skills/production/audio-craft/audio-mixing-mastering`).
- Licence : MIT, « Copyright (c) 2026 generative-media-skills contributors » (texte exact dans `LICENSE` et dans `../licences/calesthio.txt`). Auteur du dépôt : calesthio.
- Commit : 8c85352d5d75d4dcbe58480bd138e37b9742bab1 (14 juillet 2026).
- Intégrée à Dérush le 14 novembre 2026, après lecture : un guide en texte, sans programme, sans appel réseau, sans clé ; rien à installer.
- Ce qui a été retiré ou adapté pour Dérush :
  - Non copiés : `EVAL.md` et `tests/` (réservés au dépôt d'origine).
  - Retiré : `scripts/measure_loudness.py` (mesure du volume avec le filtre loudnorm de FFmpeg ; Python, bibliothèque standard, sans réseau, lecture seule) et la partie « Bundled loudness measurement tool » qui le décrivait : dans Dérush, la mesure se fait avec `derush-son mesurer` (et `media-analysis`, `qc-skill`).
  - Description (en-tête) réécrite en une phrase, en français.
  - Ajouté en tête : un encadré « Dans Dérush » (`derush-son clair`, `mixer`, `mesurer`, `audio-production`, cible habituelle des réseaux).
