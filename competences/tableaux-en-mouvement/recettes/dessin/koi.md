# BD aux feutres (Marker comic)

> Des aplats au feutre à alcool, une ombre franche et un gros contour qui s'épaissit du côté de l'ombre.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« a Sanke koi turning under lily pads ») n'est qu'un exemple : dessine celui de la personne.

---

# Marker comic, drawn (koiDraw)

Module: `engine/src/canvas-core/koiDraw.ts` over `koi.ts` (optional `KoiClock` 4th argument to `drawKoi`; without it every branch takes the original call, and the plate's md5 is unchanged: 1x dfd5350f5c2b94d030d7c62e34d2dc7d, 2x 27ebed84ad3a09aac4336d124d6e2707).

**Process.** Non-photo-blue lay-in (spine gesture, masses, parts) -> flat cel fills lightest first, each laid in back-and-forth chisel-marker passes that start and stop past the pencil line; a wide area (the pond) is filled in blocks of short passes, so its leading edge is ragged, never a wipe -> hard shadow shapes and floor shadows -> details (scale arcs, fin rays, streaks, rings, gel-pen whites) -> the heavy brush-pen contour LAST, each stroke growing along its centreline.

**Stacking.** Every element is drawn in its own z order every frame and only its extent grows, so a fin laid before the body still sits under it. The marker is opaque here: pencil vanishes under it.

**Kit.** `koiDrawKit.ts`: `streaks`/`streakClip` (a marker or brush laying a flat), `cut` (a line's first q by arc length), `part`/`stagger`, `sequence`/`cueClock` (a strict cue table: a missing cue throws instead of drawing that mark finished at frame 0).

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/koiDraw.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
