# Vectoriel à plat (dessiné à la plume) (Flat vector)

> Des formes à l'outil plume, des aplats, de longues ombres et un grain sur les côtés à l'ombre.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« a regatta of small sailboats on a bay under hills, the leader rounding the mark ») n'est qu'un exemple : dessine celui de la personne.

---

# Flat vector (modern flat illustration)

Module: `engine/src/canvas-core/flatVector.ts`. Hero: a regatta of small sailboats on a bay under hills; the leader rounds the orange mark.

**Medium, physically.** The pen tool in a vector app. Each shape is a closed path of hand-placed anchors (corner anchors for sails and hulls, smooth ones for hills and water); its single flat fill lands the instant the path closes. Long shadows are separate shapes with a linear transparency ramp. Texture is a raster grain brush painted over the shade side of a shape, clipped to it.

**The marks.** Anchor, anchor, anchor, close, fill. No strokes anywhere: an edge exists only where two fills meet, and it is mathematically crisp. Depth from overlapping planes and atmospheric colour (lilac -> sage -> deep teal).

**Order.** Background planes (sky, clouds, far and mid hills, the bay's bands, the sun's glitter) -> midground (shore, town, headland, lighthouse, foreground rocks) -> the boats (wake, hull, sails, boom, mast, bow wave), buoy, chop -> long shadows and shade facets -> grain brush, shape by shape.

**Palette.** 13 swatches in one key: warm cream sky, lilac/sage/teal hills, three blues, coral, mustard, navy, bone.

**Light.** Low sun off-frame LEFT: glitter runs off the left edge, right-facing slopes and rock facets are in shade, every shadow is thrown right and ramps to nothing.

**Not cut paper (fox).** No torn fibres, no lift shadow under every piece, no drawn line. Edges are perfect; the only shadows are cast.

**Process UI.** While a path is being drawn: the blue path, white square anchors, the current anchor filled with its bezier handles. The UI is not a mark; it is gone when the path closes.

**Cost.** Finished grain per shape is cached in its own bbox surface; only in-progress grain is recomputed.

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/flatVector.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
