# Théâtre de papier (Toy-theatre paper collage)

> Un petit théâtre en carton : des papiers à motifs découpés, des figurines à marge blanche, chacune sur son plan.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« A seaside town on a toy-theatre stage: sea rows, harbour houses, a newspaper boat, a sun on a stick ») n'est qu'un exemple : dessine celui de la personne.

---

# Toy-theatre paper collage (`paperCraft.ts`)

**Medium, physically.** A cardboard toy theatre stood on a kraft-paper table, built from three
kinds of paper. Coloured and PRINTED papers, scissor-cut or torn: plain sugar paper for the deep
sea, printed papers for the rest (a wave print, a dot print, a stone print, a diamond print,
newsprint). GOUACHE CUT-OUTS: flat opaque paint laid in visible brush strokes on white card, cut
out with a white margin left round them like a sticker (sun, lighthouse, houses, gull, post).
And card itself: every piece has THICKNESS, a darker cut edge showing down-right of its face.

**The marks.** The gouache brush stroke (`gouache`: a flat base, then broad strokes a shade
lighter and darker in one direction, clipped), a painted shade laid along the side away from the
sun (`shadeSide`), and the printed motif (`wavePrint`, `dotPrint`, `diamondPrint`, `stonePrint`,
`newsPrint`, `woodPrint`). No drawn line anywhere.

**Edge.** Scissor-crisp or torn; then the card's cut edge (an offset copy in a darker tone); then
the white sticker margin, made by stroking the outline with a round join, which is exactly the
margin scissors leave. The margin never follows a concave detail too closely.

**Depth.** The flats stand apart. Each piece throws a soft shadow onto the flat behind whose
offset is the gap between them (`depth`); the proscenium throws its shadow into the stage along
the inner top and left. Flats are clipped to the theatre box: they slide in behind its walls.

**Order of marks.** Table (frame 0). The theatre (proscenium and floor) set down. Then the scene,
back to front: sky drop flown in, sun lowered on its stick, clouds, lighthouse pushed up behind
the headland, headland slid in from the wing, sea rows and quay slid in, houses stood up one by
one, the newspaper boat pushed on along its wave, front sea, post and gull, beach ground row,
curtains swung in, valance lowered.

**Palette.** Kraft `#b8905f`; proscenium teal `#2f6f73` with gold `#e1b54a`; theatre red `#b8302c`;
sea `#2c5d8a` / `#3d7db0` / `#4ba2a3`; gouache pastels for the houses. Light: the sun, upper left.

**Not its neighbour.** `fox` is cut paper with no paint, no print and no space between layers.
This is painted and printed paper in a stage space with real gaps, and it moves like stop-motion.

**Motion grammar.** STOP-MOTION ON TWOS: every pose is held for two frames. A piece travels held
above the stack (shadow wide and far, a hair of hand jitter), lands, jiggles (a few degrees, a
pixel or two of bounce, damped) and is still. Ink and paint never move.

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/paperCraft.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
