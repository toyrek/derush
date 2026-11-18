# Provenance

- Source : https://github.com/bangtutorial/bang-motion (la compétence est à la racine du dépôt), commit
  c1aa65e921c970d858705fcb4a53a8294d1a4131 (15 septembre 2026, version 1.19.0 ; c'est encore le dernier commit de
  `main` le 18 novembre 2026).
- Auteur : Bang Tutorial (https://youtube.com/bangtutorial). Licence MIT, « Copyright (c) 2026 Bang Tutorial » (texte
  exact dans `LICENSE` et dans `../licences/bangtutorial.txt`). L'en-tête du SKILL.md déclare aussi `license: MIT`.
- Intégrée à Dérush le 18 novembre 2026, après lecture de tous les fichiers de la compétence, sur l'archive du commit
  identifiée par `git get-tar-commit-id`. Le texte est en indonésien : il est gardé tel quel, sans traduction.
- Ce qu'elle apprend : faire des motion designs qui bougent comme une vidéo et non comme des diapositives (ouvertures,
  promos, bumpers, intros, typographie cinétique, bandeaux, explainers en six styles), avec des lois vérifiables (pas
  de « PPT », un style tiré de la marque et écrit avant le code, tout calculé à partir du temps), des menus (19 concepts
  d'ouverture, transitions, fonds, rendus d'objets) et des pages de départ. La livraison prévue par l'auteur est une
  page `index.html` animée avec GSAP (et Three.js), rendue en MP4 image par image avec puppeteer et FFmpeg.

## Ce qui est repris

- `SKILL.md`, sans aucun changement (son en-tête avait déjà `name: bang-motion`, une description et la licence).
- `references/` : `anti-ppt.md`, `architecture.md`, `explainer.md`, `kartun-panggung.md`, `opener-konsep.md`,
  `techniques.md`, sans changement.
- `assets/` : les sept pages de départ (`starter-opener.html` et les six `starter-explainer…html`), sans changement.

## Ce qui n'a pas été repris

- `references/ae-bridge-higgsfield.md` et `scripts/ae/bridge/` (`aset-svg.py`, `rig-tokoh.py`, `svg2png.cjs`,
  `package.json`) : construire un dessin animé directement dans After Effects par le pont MCP de Higgsfield, un service
  à compte. Pour regarder ses planches, le guide faisait passer les images par ce service (`media_import_url`) puis
  les retéléchargeait avec `curl` depuis un CDN tiers ; `svg2png.cjs` demandait puppeteer.
- `scripts/snap.mjs` (images clés) et `scripts/export-frames.mjs` (export MP4 image par image) : ils demandent
  puppeteer (« npm i puppeteer » en tête de chaque programme, qui télécharge aussi un navigateur), que Dérush n'a pas.
  Lus : ils ouvrent la page dans ce navigateur et l'enregistrent en PNG, rien d'autre ne part sur le réseau que ce que
  la page charge elle-même ; `export-frames.mjs` lit par défaut `http://127.0.0.1:5178`.
- `scripts/kepala-ekspresi.py` : les expressions d'une tête de personnage générée (Pillow, numpy et opencv-python ;
  opencv n'est pas dans le Python de Dérush). `kartun-panggung.md` prévoit déjà la tête vectorielle de la page de
  départ quand il n'y a pas de tête générée.
- `scripts/vo-pauses.html` : une page où une personne choisit un fichier audio pour trouver les pauses de la voix off,
  à la place de `ffmpeg silencedetect`. Dérush a FFmpeg.
- `scripts/serve.py` : un petit serveur sans cache (127.0.0.1, port 5178) pour travailler en plusieurs fichiers ; la
  livraison prévue est une seule page, ouverte sans serveur.
- `references/roadmap.md` (pour faire évoluer la compétence), `README.md`, `CHANGELOG.md`, `.claude-plugin/`
  (manifestes du greffon), `icon.png`, `icon.svg` et les treize images de `docs/gallery/` (1,7 Mo).
- `SKILL.md` parle toujours de ces fichiers (tableau « Isi paket », alur kerja, partie After Effects) : son texte n'a
  pas été touché.

## Dans Dérush (à savoir avant de s'en servir)

- Ses pages (HTML animé avec GSAP, et Three.js pour `starter-opener.html`) deviennent des vidéos avec HyperFrames, le
  second moteur de rendu de Dérush : un projet `derush-hyperframes init`, la page en `index.html` (une timeline GSAP en
  pause, enregistrée dans `window.__timelines`), puis `derush-hyperframes snapshot` pour regarder et `render` pour la
  vidéo. Ses scripts puppeteer (non repris) ne servent donc plus. Dans le kit `remotion/`, GSAP est aussi installé
  (3.15) : une timeline en pause, avancée avec `tl.seek(image / fps)` à chaque image.
- Les pages de départ chargent GSAP 3.12.5 (cdnjs ou jsdelivr), Three.js 0.161.0 (jsdelivr) et leurs polices sur Google
  Fonts au moment où on les ouvre : rien n'est envoyé, mais il faut Internet, et ce code n'est pas vérifié par une
  empreinte (pas d'attribut `integrity`).
- After Effects, le pont MCP de Higgsfield et ses générateurs d'images et de vidéos (`gpt_image_2`,
  `remove_background`, `media_import_url`, cités dans `explainer.md`, `opener-konsep.md` et `techniques.md`) : absents
  de Dérush. Les passages qui en parlent restent dans le texte mais ne s'appliquent pas ; l'auteur y demande le plus
  souvent l'accord de la personne (et le coût) avant de générer.

## Ce qui a été vérifié

- Pas de clé, pas de compte à créer, pas de publicité, aucune consigne qui chercherait à détourner l'IA, aucun
  caractère invisible (cherchés : espaces de largeur nulle, caractères de sens d'écriture, étiquettes Unicode). Le seul
  accès au réseau des fichiers repris est le chargement des pages de départ (GSAP, Three.js, polices).
- L'en-tête n'a aucune clé qui lance quelque chose ou donne des droits (`hooks`, `mcpServers`, `allowed-tools`,
  `shell`, `context`, `agent`) et le texte aucun « !`commande` » : le « `!` » de `SKILL.md` (ligne 308) et de
  `techniques.md` est le point d'exclamation, entre deux accents graves ; ni Claude Code ni Dérush ne le prennent pour
  une commande (vérifié avec leurs deux expressions).
- Les droits des images : `explainer.md` propose pour un explainer d'actualité des photos libres vérifiées (Wikimedia
  Commons avec sa licence, NASA, DVIDS, crédit à l'écran), mais aussi l'image `og:image` d'un article « avec le crédit »
  et des personnes découpées dans une capture virale ou un mème. Un crédit ne donne pas le droit de réutiliser une
  photo : ces deux pistes ne valent qu'avec des images dont la personne a les droits.
