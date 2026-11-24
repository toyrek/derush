# Briques de jeu (Toy brick)

> Des briques en plastique vues de face, avec leurs tenons, leurs reflets et leurs joints.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« a brick-built harbour tugboat on a baseplate ») n'est qu'un exemple : dessine celui de la personne.

---

# Toy brick · `toyBrick.ts`

**Medium, physically.** Moulded ABS toy bricks, rendered in orthographic view (azimuth 45, elevation 30). Zero hand marks. Real units (`toyBrickKit.ts`): 1 stud pitch = 20 LDU, brick 24, plate 8, stud 12 wide and 4 high, so the 5:6 brick proportion is right by construction. Never name the trademark anywhere.

**The mark.** The part. Flat plastic fill in a real toy-brick colour (fixed table, spec 13 rule 9), one tone per face by the cube rule (top +0.10, lit +Z side 0, far +X side -0.22), a bevel highlight where a top meets a visible side and down each visible vertical corner, a dark seam hairline where one part meets the next, studs as real cylinders (shadow crescent on the top they stand on, lit left / dark right side band, top ellipse, highlight crescent toward the light).

**The edge.** Crisp plastic edges, softened only by the bevel strip. The only blur in the plate is the ground shadow: each part's box swept along the light onto the baseplate, filled at 1/5 size and drawn back up.

**Order.** Instruction-booklet grammar: bare backdrop, the baseplate drops in, then step by step (each step starts on a beat, parts seat in at most four 5-frame slots), bottom up and back to front inside a course; parts fall straight down their insertion axis on an ease-out, ghosted from 35% alpha while travelling, seat with a one-frame 0.5 LDU press-fit. The current step's parts wear the booklet's yellow outline until the next step begins. A short settle (the whole model pressed home, 1 LDU) and the hold.

**Painter's order.** No z-buffer: per frame, parts are ordered by pairwise separating axes on their boxes (X, then Z, then Y), only for pairs whose screen boxes overlap (Kahn's sort). Settled parts are cached as one layer keyed by the exact set of settled ids; anything moving is drawn over it, followed by every settled part that stands in front of it.

**Palette & backdrop.** Blue water baseplate, Light/Dark Bluish Grey quay, Red + Black hull, Reddish Brown deck, White superstructure, Medium Azure glass, Yellow funnel, Orange/Reddish Brown crates. One flat studio backdrop colour.

**Not its neighbour.** `fox` (cut-paper collage) is torn paper with a lift shadow per piece and a hand behind every edge; here the look is manufactured and the process is assembly, not drawing.

**Motion grammar.** Rigid: no squash, no stretch, no bounce. Take-apart is the build reversed frame for frame.

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/toyBrick.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
