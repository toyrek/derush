# Provenance

- Source : https://github.com/shadcn-labs/snapcn (dossier `.claude/skills/motion-quality`), commit 18b973d7592adf2099a4d5cc2d8970862a4e1172 (12 novembre 2026).
- Auteur : Sri Nath (snap-cn). Licence MIT (texte dans `../licences/shadcn-labs.txt`).
- Intégrée à Dérush le 14 novembre 2026, après lecture : un seul fichier de texte, aucun programme, aucun appel réseau, aucune clé, aucune publicité. Relue une seconde fois le même jour sur une archive du commit retéléchargée (identifiée par `git get-tar-commit-id`), avec le texte de la licence comparé octet par octet.
- Retiré, parce que cela ne concerne que l'atelier de snapcn :
  - le renvoi à sa bibliothèque de mesure (`lib/motion-check`, `pnpm run motion:measure`), remplacé par une phrase qui garde son conseil (mesurer sur des PNG, jamais sur un MP4) ;
  - la fin de la partie sur l'aperçu (`RENDERED_DEMOS`, `PreviewStage`, `pnpm run render:previews`) ;
  - la partie « A render has no global CSS. The site does. » (la feuille de style de son site) ;
  - la liste « Repo gotchas » (son registre de composants, le cache de ses démos), dont seul le dernier point est gardé, sous le titre « Match the reference, do not eyeball it » ;
  - `metadata: internal: true` dans l'en-tête.
- Adapté :
  - la description : une phrase, sans les mots-clés ni le nom du produit ; `license: MIT` ajouté dans l'en-tête ;
  - « in this repo » devient « in the author's repo » ;
  - une note « Dans Dérush », en tête, dit comment mesurer des images avec le kit (`npx remotion still`, `node remotion/images.mjs`, FFmpeg) et ce que la règle sur les courbes change pour la courbe `glisse` du kit.
- Les mesures citées (0,284 px → 0,014 px, 3,41 % → 0,22 %…) sont celles de l'auteur : Dérush ne les a pas refaites. Trois calculs ont été faits pour Dérush (50 px en 14 images) : `cubic-bezier(0.22, 1, 0.36, 1)` fige bien 5 images (le chiffre de l'auteur), la courbe `glisse` du kit en fige 6, la courbe modérée que l'auteur conseille en fige 3.
- Non repris : les autres compétences de snapcn (`remotion-kinetic-typography`, `remotion-logo-animation`…), qui installent ses composants en ligne et font la publicité de son offre payante ; leurs règles sur le texte sont celles de ce fichier.
