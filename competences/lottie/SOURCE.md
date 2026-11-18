# Provenance

- Source : https://github.com/diffusionstudio/lottie (dossier `skills/text-to-lottie`), commit
  3c72912fad543897f90045ed4d355813837927fc (25 juillet 2026 ; c'est encore le dernier commit de `main` le
  18 novembre 2026, et le contenu de la compétence date du 5 juillet 2026, commit f7d4f9f).
- Auteur : Diffusion Studio Inc. Licence MIT, « Copyright (c) 2026 Diffusion Studio Inc. » (texte exact, qui n'a pas
  de ligne de titre, dans `LICENSE` et dans `../licences/diffusionstudio.txt`). Le SKILL.md d'origine ne déclare pas
  de licence.
- Intégrée à Dérush le 18 novembre 2026, après lecture de tous les fichiers du dossier, sur l'archive du commit
  identifiée par `git get-tar-commit-id` : du texte, aucun programme, aucune clé, aucune publicité, aucune consigne
  qui chercherait à détourner l'IA, aucun caractère invisible.
- Ce qu'elle apprend : écrire à la main une animation Lottie (le JSON) propre et sobre : la structure du format, les
  `slots`, le texte, les courbes nommées d'après le geste, le découpage en chapitres et ses raccords, les règles de
  goût, et des recettes (logo, typographie, bandeau de nom, icônes et chargements, micro-interactions, schémas,
  chiffres et graphiques, promo de produit, caméra, effets, SVG).

## Ce qui est repris

- `SKILL.md` et les 17 guides de `references/`.

## Ce qui a été changé

- L'en-tête : `name: text-to-lottie` devient `name: lottie`, le nom du dossier, et `license: MIT` est ajouté. La
  description et tout le texte de `SKILL.md` sont ceux de l'auteur, sans traduction (le titre reste « Text To
  Lottie »).
- `references/player-contract.md` : retiré la commande qui installait le lecteur officiel quand il manque
  (`npx degit diffusionstudio/lottie my-animation`, `cd my-animation`, `npm install`, `npm run dev`). Elle
  téléchargeait la dernière version du dépôt, sans version fixée, puis `npm install` lançait son script `postinstall`
  (`node scripts/copy-canvaskit.mjs`) et `npm run dev` un serveur Vite. À sa place, une note « Dans Dérush » en
  français : ne pas l'installer sans que la personne le demande, où se joue une animation Lottie dans le kit, et ce
  qui ne vaut que pour ce lecteur. Le reste du fichier est inchangé.

## Ce qui n'a pas été repris

- `evals/` (quatre fichiers d'essai de la compétence : `output-rubric.md`, `trigger-prompts.json`,
  `routing-prompts.json`, `reference-loading-prompts.json`). `SKILL.md` les cite dans « Maintenance Evals » et dit de ne
  pas les lire pendant le travail.
- Tout le reste du dépôt : le lecteur (une application Vite et SolidJS, `src/`, `vite-plugins/`, `scripts/`,
  `public/`, `index.html`, `package.json`, `bun.lock`), ses polices Inter et JetBrains Mono, ses icônes, les README et
  les GIF de démonstration (4,2 Mo).

## Ce qui manque à Dérush (à savoir avant de s'en servir)

- Le lecteur officiel, que la compétence tient pour la seule référence (« Verify in Skottie ») : il affiche les scènes
  avec Skia Skottie (canvaskit-wasm 0.41.1), lit `public/projects/<projet>/<scène-N>/lottie.json`, répond sur
  `/__context`, se fige sur une image avec `?frame=N`, montre un panneau des réglages (`controls.json`) et y réécrit
  les `slots` par `/__scenes/lottie`. Dérush ne le livre pas et ne l'installe pas.
- Dans Dérush, une animation Lottie passe par `@remotion/lottie` et lottie-web 5.13.0, dans le kit `remotion/` : un
  autre moteur que Skottie, qui peut rendre autrement les masques, les dégradés, les effets et le texte. lottie-web
  5.13.0 lit bien les `slots` (vérifié dans son code). `<Lottie>` reçoit le JSON (`animationData`) et un dossier
  d'images (`assetsPath`), mais aucun fichier de police : le texte natif (`ty: 5`) s'affiche avec les polices que la
  page connaît, pas avec le fichier posé à côté du JSON comme pour Skottie.
