# Trame de journal (Newsprint halftone)

> Une impression de journal : des points noirs, une seule couleur orange, une encre qui bave dans le papier.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« a steam train crossing a stone viaduct at golden hour ») n'est qu'un exemple : dessine celui de la personne.

---

# Newsprint halftone (`halftone.ts`, `halftoneScene.ts`, `halftoneKit.ts`)

**Medium.** A web-offset newspaper press. The photograph is broken by a contact screen into an
AM halftone: dots on a fixed grid, their AREA carrying the tone. Two plates only: black on the
45 degree screen and one warm orange spot on its own screen at 15 (30 degrees apart, so they
rosette, never moire). Oil ink on unbleached groundwood newsprint.

**Marks.** Only dots. No line anywhere: every edge is where dot size changes. Dots are area-true
(`sqrt(t / pi)`), swell past 70% until they join into a solid with pinholes, and GAIN in the
midtones where their edge is longest; each is an irregular heptagon bitten by a per-dot hash,
with a soft halo of spread ink under it (a blurred copy of the same dots). Highlights under ~4%
drop out to bare paper; shadows plug.

**Edge.** The photo's rectangle on a sheet with a bare newsprint margin. The spot is laid a hair
wide (paper fan-out across the web) and off register, so a thin orange lip shows at dark edges.

**Order.** Build the ORIGINAL first (`halftoneScene.ts`): a pinhole camera over real structure in
metres, painted into two float separations (black density, spot density) with per-pixel sky, fells,
walled pasture and beck, canvas-painted viaduct and train (material id in the blue channel for
stone courses), and a steam plume as a union of shaded billows with a march toward the sun for
self-shadow. Then screen each separation into dots. The spot is a WARMTH, not a colour: only the
sunlit stone, the plume's lit rim and the glow carry much of it.

**Palette.** Black #1d1a17, spot orange #e86a2c, newsprint #e6dfcc.

**Paper.** Newsprint: a slow grey-cream pulp cloud, short dark groundwood fibres, pale surface
fibres, the odd bark shive.

**Not risograph.** Riso is flat stencil drums of bright soy ink overprinting into new colours,
hand-cut shapes, spot tints. This is a photograph: a continuous tone per ink, only dot size,
dull oil ink, gain and fibre, one warm spot in a grey world. No shapes, only tone.

**Motion grammar (make-ready).** The delivery pile at the end of the press. On every beat a new
sheet is thrown on top (slides in from the head of the sheet, lands in 6 frames with its shadow
on the sheet below). The first sheets carry the spot unit alone, coming up to colour: thin and
streaked along the feed where the rollers starve, evening out ink key by ink key across the width
(smoothly, the oscillators smear the keys). Then the black unit comes up over it the same way.
Last, the pressman nudges the spot into register over a few sheets; the final sheet is the still.

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/halftone.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
