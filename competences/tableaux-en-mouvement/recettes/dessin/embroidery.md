# Broderie à la main (Hand embroidery)

> Des points de fil de coton sur une toile de lin tendue dans un tambour.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« a botanical wreath with a honeybee ») n'est qu'un exemple : dessine celui de la personne.

---

# Hand embroidery (`embroidery.ts`)

**Medium, physically.** Six-stranded cotton floss split to two or three strands (one gold thread for
accents), worked with a crewel needle through natural plain-weave linen stretched drum-tight in a
beech hoop with a brass screw clamp.

**The marks.** A stitch is a length of twisted thread between two holes (`St`: a, b, width, colour).
- Stem stitch (overlapping, slanted: a rope) for stems; two rows for a main stem.
- Split stitch (each stitch coming up through the last) for the edges that the fills butt against.
- Satin laid side by side ACROSS a form, direction following it: across a petal, round an abdomen. Spans past ~9 mm are split at the axis.
- Fishbone: from a leaf's edge to its midrib, slanting to the tip, alternating sides.
- Long-and-short: rows from an edge toward a target, the first row alternating long and short, the thread stepping from colour A to colour B.
- French knots (a bead with its wraps and one glint) for flower centres, lavender, stamens, pollen.
- Running stitch for a flight line; single straight stitches for legs and wing veins.

**Edge.** The edge of every shape is the ends of its stitches: a row of pinches into the cloth. No
drawn outline; outlines are thread too.

**Rendering a stitch.** Pinched ends, a lit side and a shade side (one named light, upper left), slanted
grooves where the strands twist with a glint on each twist, and a hair of cast shadow down-right.
Sheen strength depends on the stitch's angle to the light, which is why stitch direction reads as form.

**Order.** Stems (stem stitch), stalks, split-stitch edges; then fills (leaves, shaded leaves, poppy,
daisies, forget-me-nots); then knots; then the bee, last; the needle is parked in the cloth.

**Palette.** Oatmeal linen; sage, olive, moss greens; white and shell; butter and ochre; cornflower;
two lavenders; poppy coral to oxblood; bee gold and umber; silver for wings.

**Ground.** The linen is computed per device pixel: warp over weft and weft over warp at alternating
crossings, each thread a rounded cord that rises where it passes over, slubs, the odd darker thread,
pin-holes between. Slack cloth outside the hoop in soft folds. The hoop's ring casts its shadow onto
the cloth inside at upper left and outside at lower right.

**What makes it NOT its neighbour** (`fox`, cut paper): nothing is a flat piece; every mark is a line
with a direction, and tone comes from stitch direction, not from fills.

**Motion grammar.** Stitches are made one by one: each grows from the hole it came up through toward
the hole it goes down, with the needle at its head and the working thread trailing from the eye; a
knot shows its wraps going round before it is pulled down into a bead. A stitch takes a moment plus a
little per millimetre; a knot takes three wraps. Checkpoint layers every 180 stitches keep frames cheap.

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/embroidery.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
