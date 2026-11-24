# Estampe japonaise (ukiyo-e) (Ukiyo-e colour woodblock)

> Un trait gravé dans le bois, des aplats de couleur un peu décalés et des dégradés essuyés au chiffon.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« two grey herons in rain on a wooden drum bridge ») n'est qu'un exemple : dessine celui de la personne.

---

# Ukiyo-e colour woodblock (`woodcut.ts`, `woodcutKit.ts`)

**Medium.** Water-based pigment with rice paste, brushed onto carved cherry blocks and printed by
hand onto damp kozo washi with a baren, one block per colour, the sheet laid each time against
the kento (an L-notch and a straight guide in the block's margin).

**Marks.** The KEYBLOCK line (sumi) is a ridge left standing between two knife cuts: its width
steps where the carver re-set the knife and wanders a little between (`carved()`), the two edges
wobble independently, and every end is a flat oblique chisel cut. No brush swell, no pen taper.
Solid blacks (crest, primaries, neck streaks) are knife-edged areas (`gouged()`). Colour is FLAT,
shaped only by where the wood was left standing; large flats show the plank's growth rings and
the goma-zuri speckle where the baren rubbed thin (`grain()`). Tone is only BOKASHI: the inked
block wiped with a damp cloth so the colour runs from full to nothing with a wavering edge.

**Edge.** The keyline's hard knife edge. Colour flats land a hair off their keylines (kento
registration is good, never perfect): each block has its own small offset. A colour block is
CUT AWAY where another subject owns the area (the sky block is carved round the herons and the
bridge), so white is bare paper, never a pale ink.

**Order.** Keyblock first (the kento pressed blind into the bottom margin with it). Then the
colour blocks, lightest to darkest: usuzumi sky, kihada yellow, far bank, heron grey, wood,
near bank, water, rain grey. Bokashi blocks last: the sky darkening to the top, the river
deepening toward us, the bridge's shade on the water beneath it.

**Palette.** Sumi #1f1b18, usuzumi #c6c1b0, yellow #d49c3a, heron grey #9fa4a4, far bank #adaf9c,
wood #a77a4a, water #9ab5c4, near bank #7d8a73, rain #8a8983, bero-ai #2c4a78, indigo #3a4557.

**Paper.** Warm kozo washi, a faint cloud, long soft curling bast fibres; a bare margin.

**Not riso, not halftone.** No screen, no dots, no fluorescent overprints mixing into new colours.
Flat knife-shaped colour, one carved key line, bokashi for tone.

**Motion grammar (the pulls).** Each block is a PULL: the baren works over the back of the sheet
in overlapping zig-zag rows and the colour comes through where it has passed, only over the
block's own area (a small block is a quick pull). A breath between pulls while the next block is
inked. The last pull lands, and the print is the still.

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/woodcut.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
