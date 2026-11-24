# Pixel art (grille de 120) (Pixel art)

> Une grille de 120 cases de côté et 16 couleurs, posées case par case, sans lissage.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« a cat mid-pounce after fireflies in a moonlit garden ») n'est qu'un exemple : dessine celui de la personne.

---

# Pixel art · `pixelArt.ts`

**Medium, physically.** Cells, laid one at a time on a 120 x 120 grid (square format), each cell exactly one of sixteen palette colours declared up front (`PALETTE`), the grid blown up by a whole number with smoothing off (`blit` in `pixelArtKit.ts`: integer cell size, one `fillRect` per run, nothing else touches the canvas). No anti-aliasing, taper, wobble, texture tile or paper: machine crispness is the medium.

**The mark.** The single cell (pencil), the bucket fill, the dither cluster. A half tint is a 2x2 ordered dither (`PixelDraft.dith`), never an alpha blend. Glows are authored stamps (core, lit ring, falloff that thins cell by cell), not checker circles.

**The edge.** The staircase, kept clean: consistent run lengths along a curve, no doubled corners, no orphan cells (`cleanMask` removes one-cell nubs and fills one-cell notches). Faces, ears and eyes are laid by hand as an ASCII sprite (`HEAD`); a formula cannot place an ear tip.

**Order.** Blocking in flat mid colours (pencil the edge, bucket the mass; the subject first goes down coarse, in 2x2 cells) -> line cleanup (the silhouette swept once round, cells taken off and put on) -> shading clusters and the sky's dither bands -> highlights and rim light -> the light sources and their glow dither LAST. A beat of rest between passes.

**Palette & light.** Sixteen colours: four night blues, moon white and its cool rim, three greens plus one firefly-lit leaf, two cat darks, three glow warms. The fireflies are the light (warm edges on the paw, muzzle, inner ear, eyeshine); the moon only rims the cat's back cool.

**Not its neighbour.** `koi` (marker comic) makes a contour stroke, thick-thin, and a painted cel shadow. Here there is no stroke at all: the cell is the mark, the staircase the edge, the dither the tone.

**Motion grammar.** Cels held for 3 frames (3 divides the 15-frame beat), a 10 fps feel. The process film replays the recorded op list: every cell the finished still contains was laid, in order, by a pass (`celPlan`). For character loops: pose-to-pose phases, whole-cell teleports between authored poses, never tweened positions.

**Gate.** Every pixel of a rendered frame is a palette colour (checked by decoding the still: 0 off-palette pixels at scale 2).

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/pixelArt.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
