# Album jeunesse (Storybook pencil + watercolour)

> Un crayon tendre et une aquarelle douce, pensés pour un personnage qui revient d'une page à l'autre.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« Bit, waving, in storybook pencil and watercolour ») n'est qu'un exemple : dessine celui de la personne.

---

# Storybook pencil + watercolour, drawn (`storybookDraw.ts`)

**Medium.** Soft graphite and pan watercolour on warm cold-press, the hand of `storybook.ts`.
The character is `drawBit`, called UNCHANGED through `Phase`, a `Gfx` subclass that decides which
of its groups draw in each pass and how far along each stroke is (a census pass records every
group's kind, bounding box and stroke count once).

**Order of marks.** (1) Construction in blue-grey: head and body ovals, gesture line, shoulder
line, the face cross, arm gestures, the footprint; left in the finished page as picture books
do. (2) A light pencil drawing of Bit, head first and down (groups ordered by the top of their
box), every contour drawn stroke by stroke at 0.36 alpha, 0.62 width. (3) Washes: the sheet's
warm ground, sky, peach light, grass, shadow, four flowers, then Bit back to front in
`drawBit`'s own order (legs, boots, arms, hands, body, collar, antenna glow, bulb, head,
cheeks), each spreading from the upper-left of its shape (toward the light). (4) The final line
at full weight, head first, then ground line, grass, pebbles, flower stems; last, paint flicked
off the brush.

**Gotcha paid for.** A gradient (`g.glow`) painted into a POOLED layer changes how Chromium later
rasterises pencil strokes into that same layer: 1/255 on every stroke pixel, so frame order
leaked into pixels (5/6, then 4/8 probe frames differed). The glow is painted on its own cached
surface and copied in; the pool never sees a gradient. Now 8/8 identical.

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/storybookDraw.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
