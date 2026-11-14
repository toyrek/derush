# Provenance

- Source : https://github.com/calesthio/generative-media-skills (dossier `skills/production/audio-craft/captions-media-accessibility`).
- Licence : MIT, « Copyright (c) 2026 generative-media-skills contributors » (texte exact dans `LICENSE` et dans `../licences/calesthio.txt`). Auteur du dépôt : calesthio.
- Commit : 8c85352d5d75d4dcbe58480bd138e37b9742bab1 (14 juillet 2026).
- Intégrée à Dérush le 14 novembre 2026, après lecture : un guide en texte, sans programme, sans appel réseau, sans clé ; rien à installer.
- Ce qui a été retiré ou adapté pour Dérush :
  - Non copiés : `EVAL.md` et `tests/` (réservés au dépôt d'origine).
  - Retiré : `scripts/validate_captions.py` (validateur SRT et WebVTT, Python, bibliothèque standard, sans réseau) et la partie « Bundled caption validator » qui le décrivait : Dérush a déjà ce contrôle avec `subtitle-skill` et `qc-skill`, et les appels d'exemple partaient de la racine du dépôt d'origine.
  - Description (en-tête) réécrite en une phrase, en français.
  - Ajouté en tête : un encadré « Dans Dérush » (sous-titres déjà prêts dans `sous-titres/`, `subtitle-skill`, kit `remotion/`, `qc-skill`, `derush-controle`, et les usages du français : espaces avant la ponctuation double, guillemets, temps de lecture).
