# Provenance

- Source : https://github.com/heygen-com/hyperframes, commit cb072eb047efafe9749ae81613ccbb8036be3e21 (14 novembre 2026,
  branche `main`). Deux compétences internes du dépôt (marquées `metadata: internal: true`, absentes de sa liste
  publique ; copies identiques dans `.agents/skills/`) :
  - `.claude/skills/motion-doctrine/SKILL.md` → `SKILL.md`, à partir de « Part 1 — The Seam Law » ;
  - `.claude/skills/cut-the-curve/SKILL.md` → `references/catalogue.md` ;
  - `.claude/skills/cut-the-curve/examples/gsap-implementation.md` → réécrit pour Remotion dans `references/remotion.md`
    (mêmes gestes, mêmes chiffres, aucun gabarit GSAP repris).
- Auteur : HeyGen, Inc. Licence Apache-2.0, « Copyright 2026 HeyGen, Inc. » (texte exact dans `LICENSE` et dans
  `../licences/heygen-com.txt`). Le dépôt n'a pas de fichier NOTICE à sa racine (seulement deux `NOTICE.md` pour des
  vidéos d'essai de son moteur, sans rapport avec ces textes). Les SKILL.md d'origine ne déclarent aucune autre licence.
- Ce n'est ni une compétence officielle ni un produit de HeyGen ou de HyperFrames, et son nom ne reprend pas leurs marques.
  Chaque fichier modifié le dit en tête.
- Intégrée à Dérush le 14 novembre 2026, après lecture : trois fichiers de texte, dont du code d'exemple en TSX à recopier
  dans le kit. Aucun programme livré, aucun appel réseau, aucune clé, rien à installer.

## Ce qui a été retiré

- `scripts/seam-gate.mjs`, `scripts/seam-stamp.mjs` et `references/seam-gate.md`. Le vérificateur lançait un serveur
  d'aperçu (hors du dépôt de l'auteur : `npx --yes hyperframes preview`, téléchargé et lancé sans rien demander) et Chrome
  avec un port de débogage ; le second programme écrivait du GSAP dans `index.html`. Ils sont remplacés par « The Seam
  Check » : les huit mêmes contrôles, à faire sur les images rendues, avec les seuils de son programme (15 px/s pour un
  élément arrêté, un rapport de vitesses de 3, 12 px et 5 % pour le porteur).
- La phrase qui faisait passer ces règles avant toute autre consigne (« These rules SUPERSEDE generic / upstream motion
  guidance », dans la description et dans le chapeau). Ici, `MOTION.md` et la demande de la personne passent avant.
- La table des renvois vers des compétences absentes de Dérush (`oversized-cursor`, `seam-craft`, `text-beat-economics`,
  `brand-faithful`, `captions-overlay`, la compétence `hyperframes`), l'ordre de travail `ledger.json` → `seam-stamp` →
  `seam-gate`, et le piège propre à ce moteur (`data-start`, `autoAlpha`), remplacé par son équivalent Remotion
  (`<Sequence from>`).
- Tout ce qui ne vaut que pour le moteur HyperFrames : les gabarits GSAP (`tl.to`, `tl.set`, versions « worker » et
  « registry » avec les jetons `__OLD__`, `__NEW__`, `__T__`, `__DUR__`, `__DX__`, `__DXIN__`), l'injecteur, `#root`,
  `#el-<sid>`, `.beat`, `immediateRender`. Le gabarit « registry » du zoom traversant (2,5×, 8 px, `power3.out`)
  contredisait le tableau de l'auteur (1,2×, 10 px, `expo.out`) : seul le tableau est gardé.
- `metadata: internal: true` et la liste de mots-clés de la description.
- Non repris du même dépôt : `seam-craft` (le rendu des raccords dans ce moteur ; sa seule règle utile, le fond opaque
  sous un raccord, est déjà dans `references/catalogue.md` §3) et `captions-overlay`.

## Ce qui a été adapté

- Les deux compétences sont réunies en une : la loi (`motion-doctrine`) dans `SKILL.md`, le catalogue (`cut-the-curve`)
  dans `references/catalogue.md`. Le reste du texte de l'auteur est gardé en anglais, mot pour mot sauf les points
  ci-dessous.
- La description : une phrase, en français, qui dit quand l'ouvrir ; `license: Apache-2.0` ajouté dans l'en-tête.
- Une partie « Dans Dérush » en tête de `SKILL.md` : qui décide (`MOTION.md` et la personne), où ces règles s'appliquent
  (les scènes animées dans le kit `remotion/`, pas les coupes entre deux rushes filmés), deux sortes de transitions au
  plus, les secondes et les images, les distances pour une image de 1080 px de petit côté, la coupe sur une image
  entière, le plan des raccords dans `rendu/timeline.json`, les contrôles (`node remotion/images.mjs`, FFmpeg avec Codex
  ou Gemini, `derush-controle`), et ce qui reste vrai de `MOTION.md` (le zoom lent de 2 à 4 % sur un plan filmé, le fond
  qui bouge sous le carton de fin, les zones sûres et le temps de lecture, le léger rebond de `spring()`).
- Le fondu enchaîné : « Never a crossfade » ne vaut plus qu'entre scènes animées ; il reste permis entre deux rushes
  filmés.
- Le sens par défaut « LEFT » de l'auteur est expliqué : le contenu part vers la gauche, comme une page tournée dans le
  sens de lecture.
- Le nombre de transitions : les « 2–3 » de l'auteur sont ramenés aux deux sortes de `MOTION.md`.
- Le registre des vecteurs s'écrit dans le plan (`rendu/timeline.json`), plus dans `ledger.json`.
- Dans le catalogue : « `tl.set` » devient « one frame », « tween » devient « interpolation », le fond opaque est dit
  sans `#root`, le « push-slide » est décrit sans le nom du registre, `power5.out` (que GSAP n'a pas) devient
  `Easing.out(Easing.poly(6))`, et les chevauchements de la cascade sont précisés en images de 1/60 s (celles du code de
  l'auteur).
- `references/remotion.md`, écrit pour Dérush à partir de `gsap-implementation.md` : la table des courbes GSAP →
  Remotion (`power4` = `Easing.poly(5)`, `power3` = `Easing.poly(4)`… ; `expo.out` écrit à la main, parce que
  `Easing.out(Easing.exp)` s'arrête à 0,999), les durées en images à 25, 30 et 60 i/s, le code de chaque technique
  (`CutTheCurve`, `ZoomTraversant`, `CoupeEnCascade`, `MiseAuPoint`, `EntreeEnCascade`, `glissade`) avec les chiffres de
  l'auteur, ses plages de réglage, et des notes : les transitions de `@remotion/transitions` ne sont pas des cut-the-curve,
  une vidéo ne se floute pas directement, une scène qui arrive peut compter ses images depuis la coupe, une ligne de
  moins de sept mots sort d'un bloc.

## Ce qui a été corrigé

- « Total ≈ 0.4s » du zoom traversant : 0,2 s de sortie et 0,5 s d'entrée font 0,7 s sur la ligne de temps ; 0,4 s est la
  durée ressentie (`expo.out` a fait 94 % de l'entrée après 0,2 s). La phrase dit les deux.
- « exit opacity completes at ~25–30% of its travel » (§3 et §4) ne collait pas avec les chiffres de l'auteur : avec
  0,18 s de fondu sur 0,34 s de trajet en `power4.in`, le mot est éteint à 53 % du temps, quand il n'a parcouru que 4 %
  du trajet ; dans son code, le fondu d'une scène entière finit à la coupe. Les deux phrases disent maintenant ce que
  font ses chiffres.

## Ce qui a été vérifié

- Les correspondances de courbes avec la version de Remotion du kit (4.0.538) : `Easing.in(Easing.poly(5))` finit avec
  une pente de 5, comme `power4.in` ; `Easing.out(Easing.exp)(1)` vaut 0,99902 ; `Easing.out(Easing.back(1.7))` monte à
  1,0998.
- Le code de `references/remotion.md`, assemblé avec Remotion 4.0.538 et React, puis rendu en texte image par image (sans
  navigateur ni vidéo) : chaque composant donne les valeurs attendues. Pour cut-the-curve à 30 i/s : 61 px sur la
  dernière image rendue avant la coupe, 95 px sur la première après (la vitesse des deux courbes est la même à la
  coupe : 95 px par image) ; opacité 0,27 puis 0,35 de part et d'autre. Il n'a pas été essayé dans un vrai montage
  rendu.
