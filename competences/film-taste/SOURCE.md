# Provenance

- Source : https://github.com/edothedev/claude-video-kit (dossier `.claude/skills/film-taste`), commit db1f96a15342a9d0252088822188a2d873cd2e48 (14 octobre 2026).
- Auteur : edotheDev. Licence MIT (texte dans `LICENSE`, et dans `../licences/edothedev.txt`).
- Intégrée à Dérush le 14 novembre 2026, après lecture : un seul fichier de texte, pas de code, pas d'appel réseau, pas de clé, aucune publicité.
- Ce qui a été retiré ou adapté pour Dérush (le reste est le texte de l'auteur, mot pour mot, en anglais) :
  - la description : elle demandait de charger la page « avant chaque vidéo ». Elle dit maintenant quand l'ouvrir (film de marque, documentaire, teaser, récit, ou un montage qui fait « IA », « banque d'images », « gabarit », « diaporama ») ;
  - un encadré « Dans Dérush » en tête : la demande de la personne, la recette du métier, le kit de marque de l'espace et `MOTION.md` passent avant ce goût ; les outils d'ici (kit Remotion, FFmpeg, `derush-son`, `derush-controle`, `derush-detourer`) ;
  - des notes « Dans Dérush » sous six parties, là où ce goût de film contredit les formats courts de Dérush ou cite un outil absent : les droits sur les images prises ailleurs ; les sous-titres mot à mot et les entrées en `spring()` du kit, la plaque sombre sur fond clair, les zones sûres de `montage.json` ; la fin qui boucle d'un format court ; la musique instrumentale (comment le vérifier ici), un bruitage par accent dans un format court, `derush-son mixer` et `mesurer` ; la génération avec ElevenLabs seulement ; la relecture avec les commandes de Dérush et `carnet-ia.md` ;
  - une phrase retirée, dans « Sound » : « No denoise, EQ or compression chain unless asked. » Dérush nettoie une voix avec `derush-son clair`, qui mesure d'abord et ne débruite pas une voix déjà propre ;
  - le renvoi à la compétence `video-qa` du même dépôt (absente de Dérush) retiré de « Review like a viewer ».
- Non repris du dépôt : ses autres compétences, ses agents, ses programmes et son dossier `docs/examples/` (extraits de films de tiers).
