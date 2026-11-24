# Crayons de couleur (Coloured pencil)

> Des hachures toutes dans le même sens sur un papier à grain, les couleurs posées par couches.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« a wind-up tin robot mending a music box while a crow steals a screw ») n'est qu'un exemple : dessine celui de la personne.

---

# Coloured pencil (`colouredPencil.ts`, kit `colouredPencilKit.ts`)

**Medium, physically.** Wax-based coloured pencils, sharp but not needle-fine, on cream cartridge
paper with a real tooth. The lead only lands on the ridges of the sheet, so every passage of
colour is speckled with the cream of the valleys. Pressing harder fills more valleys. Wax layers
sit on top of each other, and a second hue hatched over the first mixes optically.

**The mark.** A short, straight, slightly bowed hatch stroke: pressure comes in fast and lifts off
in a long flick. Strokes go side by side in strips, almost all in ONE dominant diagonal (lower-left
to upper-right, `ANG = -1.02`). Tone comes from pressure (stroke alpha plus the tooth level of
the pass) and from stacking passes, never from a flat fill.

**The edge.** Mostly none: an edge is where the hatching stops, with a stroke or two running
over it. A few thin, broken contours in a darker pencil (sepia-graphite) go on LAST, heavier on
the shade side and lost where the light is.

**Order of marks** (one pass each, replayed in this order by the film):
1. faint graphite lay-in: construction lines ruled freehand that run past the corners
2. big local-colour passes, light to dark: wall, sky, wood, then each object
3. second-hue layering over the first (violet over dusk blue, blue over teal, red-brown over ochre)
4. darks: cast shadows and deep places CROSS-hatched in a second direction (`X2`), never filled
5. contours, rivets, feather edges, grain
6. the lamp's halo: yellow over paper that was deliberately left near-bare

**Palette.** Cream paper `#f3ecdc`. Dusk blue and violet wall, indigo-to-rose sky, ochre and
red-brown wood, mahogany and felt red box, teal tin with blue over it, brick-red enamel, a
graphite-black crow with a blue-violet sheen, yellow and amber light.

**Paper.** One tooth field per sheet, slightly streaked along the hatch diagonal. Every pass is
punched by the SAME field at one of three pressure thresholds (light, medium, burnished), so the
valleys stay cream through all the layers. That shared field is what makes it read as pencil.

**Form.** One light. Colour thickens toward the edge of every form (`edgeDist` in the density
field). Solid forms keep a paler band on their TOP face. Cast shadows are hand-placed from the
lamp's position.

**Not crayon (balloon).** Crayon is a fat, waxy back-and-forth scribble with round ends, a white
crayon burnish and a fat contour gone over twice. Coloured pencil is fine, parallel, one-direction
hatching with speckled tooth, hue layering, cross-hatched darks and sparse thin contours.
**Not ballpoint (pocketWatch).** Ballpoint is one colour with tone only from where the lines
sit. Here tone comes from pressure and colour layering.

**Motion grammar.** The film is the drawing. Frame 0 is the bare sheet. Each pass lays its marks
in order, strip by strip, at a pace set by stroke length plus a fixed cost for every lift of the
pencil. There is a 5-frame beat between passes. Finished passes are cached as one composite and
the pass in hand is redrawn up to the mark the hand has reached. The last 35 frames are the still.

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/colouredPencil.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
