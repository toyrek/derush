# Provenance

- Source : https://github.com/heygen-com/hyperframes, version 0.9.64 (étiquette `v0.9.64`, commit
  f291b125983a180ef9dd8744536c90023e5a1998, publiée le 17 novembre 2026 ; la même que le moteur que Dérush installe).
- Auteur : HeyGen, Inc. Licence Apache-2.0, « Copyright 2026 HeyGen, Inc. » (texte exact dans `LICENSE` et dans
  `../licences/heygen-com.txt`). Le dépôt n'a pas de fichier NOTICE à sa racine.
- Ce n'est ni une compétence officielle ni un produit de HeyGen ou de HyperFrames : c'est leur texte, adapté à Dérush.
  Chaque fichier modifié le dit en tête (un commentaire « Modifié pour Dérush »).
- Intégrée à Dérush le 18 novembre 2026, après lecture de tous les fichiers. Elle va avec le moteur HyperFrames que Dérush
  installe chez l'utilisateur (`lib/hyperframes.mjs`) et la commande `derush-hyperframes`
  (`outils/derush-hyperframes.mjs`), qui coupe la télémétrie et refuse ce qui parle à HeyGen.

## Ce qui a changé partout

- `npx hyperframes`, `npx --yes hyperframes@…` et `node <SKILLS>/hyperframes/scripts/plugin-cli.mjs` sont devenus
  `derush-hyperframes` : le lanceur d'origine (`plugin-cli.mjs`) téléchargeait la dernière version publiée sur npm
  (`hyperframes@>=0.9.34`), et non celle que Dérush a relue.
- En tête de chaque `SKILL.md`, les paragraphes « Running the CLI » et « Usage beacon » sont remplacés par une note
  « Dans Dérush » : le « beacon » envoyait le nom de la compétence à la télémétrie d'HyperFrames à chaque démarrage.
- Retirés : les avis envoyés après un rendu (`feedback --rating`, `feedback --search-miss`), la lecture du forfait
  HeyGen au début d'une vidéo (`usage --json` : la commande lisait le jeton de Claude Code dans le trousseau, ou
  `~/.codex/auth.json`, pour interroger api.anthropic.com ou chatgpt.com), la partie « The HyperFrames desktop app »
  (la publicité de leur application de bureau et de son assistant), la télémétrie.

## Ce qui n'a pas été repris

- `references/contributing.md` (proposer un bloc au dépôt d'HyperFrames).
- Les lignes qui envoient un avis quand une recherche ne trouve rien (`feedback --search-miss`) : l'IA le dit dans son
  compte rendu.

## Les blocs dans Dérush

- Le catalogue est lu au commit de la version installée (`hyperframes.json` du projet, fixé par `derush-hyperframes`),
  jamais à la branche `main`, qui change tous les jours.
- 28 blocs téléchargent à l'ajout des fichiers de `static.heygen.ai` sans licence (photos d'artistes, visages) ou font
  la publicité de HeyGen : `derush-hyperframes add` les refuse (liste dans `lib/hyperframes.mjs`, `BLOCS_REFUSES`).
- Les blocs qui imitent l'interface d'une marque (TikTok, Instagram, X, Spotify, Slack, ChatGPT, Claude, YouTube…) ne
  servent que si la vidéo parle vraiment de ce service, jamais pour faire croire à un vrai message ou à un vrai compte.
- La plupart des blocs chargent GSAP (licence gratuite de Webflow) et des polices Google pendant le rendu : il faut
  Internet ; sans lui, le rendu se fait avec d'autres polices.
