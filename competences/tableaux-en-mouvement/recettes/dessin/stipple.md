# Pointillé à la plume (Pen-and-ink stipple)

> Rien que des points d'encre : plus ils sont serrés, plus c'est sombre.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« a nautilus shell sawn in half, chambers lit from the upper left, cast shadow in dots ») n'est qu'un exemple : dessine celui de la personne.

---

# Stipple (pen-and-ink dots) · `stipple.ts`

**Medium, physically.** One technical pen (0.25 mm), never changed, touched straight down onto hot-press bristol thousands of times. No line, no hatch, no wash. The pen is held a touch off vertical, so each dot is slightly oval and slightly ragged; now and then it drags a hair of tail as it lifts, now and then it runs dry and a dot comes up grey.

**The mark.** A dot of one size. Tone is only how many dots sit in a square centimetre (weighted-Voronoi / Secord 2002 distribution: blue noise, no clumps, spacing ~1.5 px / tone^0.64 at 1080). Built as variable-radius Poisson-disk sampling over a 1-px tone raster computed from the subject's real structure and one lamp (`stippleKit.ts`).

**The edge.** There are no contours. An edge is where dot density changes; in full light the edge is simply lost (the upper-left rim of the shell).

**Order.** Darkest masses first (chamber shadows, the body chamber's cast shadow, contact shadow), then out into the mid tones, then a few sparse passes over the lit nacre. Each pass works across the sheet in patches (a snake of ~84 px cells), not in a raster. A beat of rest between passes.

**Palette & paper.** Carbon black a hair warm (#15120e) on bright bristol (#fbfaf5); the core `paper` tile at 5%, nothing else.

**Not its neighbour.** `mellan` is one continuous line whose width carries tone; `pocketWatch` builds tone with hatching directions. Stipple has no direction at all: the only variable is density.

**Motion grammar.** Marks arrive; nothing moves. A film is the stippler's time-lapse: dots accumulate pass by pass (~100 per frame), the dark masses establish the drawing before any light tone exists. Never fade dots in; never move them.

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/stipple.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
