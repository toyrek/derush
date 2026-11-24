# Risographie (Risograph)

> Deux ou trois encres superposées, un peu décalées, avec leurs trames : le blanc, c'est le papier.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« a lighthouse at sunset ») n'est qu'un exemple : dessine celui de la personne.

---

# Risograph, pulled drum by drum (`lighthouseDraw.ts` over `lighthouse.ts`)

A riso print is not drawn, it is fed: the same sheet goes through the machine once per ink, a
different drum loaded each time. `lighthouse.ts` only gained `export` on its three plate
functions (md5 of the hero still checked before and after: unchanged). Frame 0 is the bare sheet
with its trim marks. Yellow first: the ink lands at the nip, a straight front travelling down the
sheet at constant feed speed (a short grip and release at the ends) with the drum's shadow riding
just ahead of it. A breath while the drum is swapped. Pink over the dry yellow at its own
registration offset, so every overprint is born at the nip line (coral sky, orange sun). Swap.
Blue last, the key plate: dusk violet, green turf, the shadow side of every form and the crayon
key lines arrive in one sweep. Each ink's swatch in the colour bar prints with its own drum. The
held finish is `drawLighthouse` itself, so the last second is the hero still byte for byte.
Motion grammar: the only moving thing is the nip line. Never a fade.

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/lighthouseDraw.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
