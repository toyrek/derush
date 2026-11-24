# Tableau noir à la craie (Chalkboard)

> De la craie frottée sur l'ardoise, sa poussière autour, et le fantôme des leçons effacées.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« the phases of the moon ») n'est qu'un exemple : dessine celui de la personne.

---

# Chalkboard, written on (`moonPhasesDraw.ts`)

The draw-on version of the chalkboard plate (`moonPhases.ts`, recipe in `styles.md`). The plate takes
an optional `Clock` (`(id) => progress`); without one it draws the finished board byte for byte
(verified: md5 unchanged at scale 1 and 2), so the film's last 30 frames are the still.

**Order, as a teacher works a board.** The felt eraser first: yesterday's lesson ("HOMEWORK P 42",
"NEWTON / 3RD LAW") is swept off left to right, behind the eraser only the ghost remains, and the wide
arcs of haze grow as it goes. Then the title, underlined twice in yellow; the month's arc and arrowhead
in blue and "29.5 DAYS"; then each moon in turn: the whole lit face scumbled with the side of the chalk,
the highlands built up across it (the maria are just less chalk), the lit limb worked a second time,
craters tapped in, the firm limb line, the faint dark limb, the terminator, and its label written under
it before the next moon starts; the full moon is smudged round with a finger. Stars dotted in last, the
Plough dotted and joined in blue, the pink note written and circled.

**Motion grammar.** Scumbles arrive drag by drag (the last drag part-way); lines grow along the stroke
with their dust; letters are written stroke by stroke (`drafting.ts` progress). One cue table on the
5-frame grid, checked at load.

**Frame 0** is the board as the teacher finds it: yesterday's lesson still on it. The ghosts are made
by erasing it, which is what ghosts on a real board are.

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/moonPhasesDraw.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
