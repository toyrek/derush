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

- `scripts/` en entier : `plugin-cli.mjs` (le lanceur qui télécharge la dernière version), `locate.mjs` (son mode
  automatique met la clé Gemini dans l'adresse), `bake-basemap.mjs` (il pilote MapLibre et télécharge des fonds de
  carte tiers, sans dépendances installées dans Dérush) et leurs essais.
- `references/plugin-installation.md` (les règles du lanceur) et `references/skill-lifecycle.md` (installer des
  compétences avec `npx skills`) : dans Dérush, la commande et les compétences viennent avec l'app.
- Les autres compétences d'HyperFrames citées dans le texte ne sont pas dans Dérush : `media-use` (bâtie autour d'un
  compte HeyGen et de crédits payants), `reverse-any-video` et `style-sampling` (« HyperFrames Pro », payantes),
  `figma`, `slideshow`, `remotion-to-hyperframes`.
