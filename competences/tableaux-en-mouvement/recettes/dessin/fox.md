# Collage de papiers déchirés (Cut-paper collage)

> Aucun trait : des papiers déchirés au bord blanc et d’autres coupés net, chacun avec sa petite ombre.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« a fox at dusk ») n'est qu'un exemple : dessine celui de la personne.

---

# Cut-paper collage, laid down (`foxDraw.ts` over `fox.ts`)

The fox plate made the way a collage artist makes it, bottom of the stack up. `fox.ts` gained an
optional `Stage` (per piece: settled, not yet placed, or held in the hand with an offset and a
lift) threaded through its layer function; without one its output is byte-identical to the still
(md5 checked before and after). Frame 0 is the bare backing board. Four passes with a beat of
rest between: sky and dusk bands, hill and pines tier by tier, the fox from the far sweep of the
brush forward to the glint in its eye, then leaves and grass. Each piece travels held above the
stack (its shadow wide, far and soft), is lowered and pressed, and the shadow pulls in tight.
Big full-bleed sheets slide in from their own edge fast; small pieces are fiddly and slow. When
every layer is down the frame is drawn exactly as `fox` draws it, so the held last second is the
hero still byte for byte.

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/foxDraw.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
