# Plan bleu (cyanotype) (Cyanotype blueprint)

> Un dessin technique à l'encre blanche sur un fond bleu de Prusse, tracé à la règle et au compas.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« a watch movement's going train, plan and section A-A ») n'est qu'un exemple : dessine celui de la personne.

---

# Cyanotype blueprint (`blueprint.ts`, kit in `blueprintKit.ts`)

**Medium, physically.** A ruling pen and a spring-bow compass loaded with white ink on
Prussian-blue cyanotype stock. The stock never exposed evenly: brighter where the arc lamp
stood, mottled (`blueMottle`), two old fold lines, dust. The ink breaks up on the tooth of the
sheet (`draftTooth`) and white on blue blooms, so every line gets a faint halo (`inkGroup`).

**The marks.** Ruled lines that are never dead straight (a 0.6 px bow, seeded). Compass circles
that ARE true round (`circle`: the compass does not wobble, the freehand does). Chain lines,
long dash then short dash, for centres and pitch circles (`chain`, `chainRing`). Section lining
at 45 degrees that starts and stops just inside each part (`hatch`), adjacent parts lined in
opposing directions, thin sections filled solid, shafts and pinions never sectioned. Filled
arrowheads. Single-stroke inclined gothic capitals from `drafting.ts`; dimension figures read
from the bottom of the sheet (unidirectional).

**Edge.** A thin, even pen line with a slight taper where the nib lifts. No tone except section
lining. No light and no cast shadow: an orthographic drawing has none, and faking one breaks the
medium.

**Line hierarchy.** Visible outlines heavy white (1.4 to 1.9); section lining, pitch circles,
dimensions and leaders thin cyan (0.75 to 1); construction and projection lines thinner, dim
cyan, left on the sheet as real drafting leaves them.

**Order of marks.** Bare sheet. Border ruled stroke by stroke, then zone marks. Title-block box
ruled (early). Construction: centre lines, line of centres, pitch circles swung, projection lines
dropped, datum lines across. Ruling-pen outlines: the plate, then each wheel from the top of the
stack down, rim and teeth first, crossings window by window, each pinion before the wheel it
rides on (a lower wheel is clipped by the METAL of every part above it, never by its
crossings). Section outlines, then section lining. Details. Dimensions (witness lines, dimension
line, arrows, figure). Tables, notes, balloons. The title-block lettering last, the title itself
the very last stroke.

**Palette.** Ground `#123a63`, white ink `#f1f7fb`, cyan `#a7d8ec`, dim `#7fbcd8`.

**Not its nearest neighbour (pocketWatch, ballpoint).** Ballpoint builds TONE from where hatch
sits on a lit form; the blueprint has no light at all, and its only tone is a convention
(section lining). Ballpoint lines are freehand and continuous; here circles are compass-true,
lines are ruled, and centres are broken chain lines. The ground is the negative (white on blue),
and the sheet carries a drawing office's furniture: border zones, title block, scale, notes.

**Motion grammar.** A drafting office has no camera moves and nothing ever fades: the nib travels
along each stroke (`progress`), compass circles swing from where the needle-leg starts, section
lines run on one stroke at a time, lettering is written stroke by stroke. Long ruled strokes are
fast, lettering is slow. Finished parts are flattened onto one cached surface keyed by how many
parts are finished, so only the stroke being drawn costs anything.

**Realism for a mechanism.** Name the kinematics, not just the parts: every mesh sits at centre
distance = module x (Z1 + Z2) / 2; a wheel tooth is phased onto the line of centres with a pinion
GAP facing it; pinion leaves have parallel flanks and deep roots; the train ratio is stated and
true (64/8 x 60/8 = 60, the seconds arbor).

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/blueprint.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
