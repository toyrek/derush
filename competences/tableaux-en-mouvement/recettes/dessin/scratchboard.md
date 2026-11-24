# Carte à gratter (Scratchboard)

> Du blanc gratté dans le noir : chaque trait est de l'encre enlevée.

**Dans Dérush.** C'est une matière de dessin : elle se trace en code, dans une page rendue image par image par `derush-toile` (lis d'abord `SKILL.md` de la compétence tableaux-en-mouvement). La fiche, en anglais, dit ce que la matière est vraiment (le support, l'outil, les marques, les bords, l'ordre des gestes, la palette, le papier) et sa façon de bouger (« Motion grammar »). Les fichiers `.ts` et les fonctions qu'elle nomme sont ceux du moteur d'anidoodle, qui n'est pas livré avec Dérush : prends-en l'idée et écris ta propre fonction de dessin (Canvas 2D ; `roughjs` pour un trait à la main, `simplex-noise` pour le grain du papier). Le sujet de l'exemple (« a lynx, head and shoulders, in moonlight ») n'est qu'un exemple : dessine celui de la personne.

---

# Scratchboard · `scratchboard.ts`

**Medium, physically.** A board of white china clay under a coat of black India ink. Nothing is added: every mark is ink scraped away with a steel knife or scratch nib, so every mark is white on black and the picture is found by removing the dark. A cut is widest where the blade bites in and tapers as it lifts; the clay chips a hair at its edges (the `draftTooth` tile over a clean copy of the cuts).

**The marks.** Fur as tapered white flicks cut in the direction the hair grows (streamlines of a hand-placed flow field, length from a hand-placed hair-length field); each flick's width follows the tone along its length, so a hair crossing a dark marking thins out as it crosses it. Parallel hatching follows form on hairless surfaces (nose leather, irises as radial cuts). A shorter crossing set of cuts at ±35° gives the mid tones. Lights are cut so densely they close up into bold scraped areas; catchlights are scraped flat with the blade.

**The edge.** Lit contours are a row of short bright flicks cut along the lie of the hair (on skin edges such as ears, a clean knife line). Shadow-side edges are lost into the board, rimmed only faintly by the sky.

**Order.** The knife reveals from black: contour highlights where the moon catches the edges; a sparse layer of flicks everywhere the light reaches, to set the lie of the coat; then the light mass is built: mid tones, the crossing cuts, the lights until they close; last the details (nose hatch, irises, whiskers) and the catchlights.

**Palette & board.** #0c0b0a board, #ebe5d8 clay. No grey ink: grey is only how close together the white cuts are.

**Not its neighbour.** `mellan` and `pocketWatch` add dark marks to light paper; here every mark removes dark, the ground is black, and tone rises with the number and width of cuts. Hatching exists but fur flicks dominate.

**Motion grammar.** Frame 0 is the black board. Long knife lines are watched being cut (a tip travelling along the line); fur flicks arrive whole, many per frame, region by region. Nothing fades; nothing is ever re-inked.

---
_Adapté pour Dérush le 24 novembre 2026 depuis anidoodle (https://github.com/alexgreensh/anidoodle, commit 4ae27d2, `skills/anidoodle/references/styles/scratchboard.md`) : le titre français, la phrase et l'en-tête « Dans Dérush » sont ajoutés ; le texte de la fiche, sous le trait, est inchangé. Copyright 2026 Alex Greenshpun. Licence Apache-2.0 : voir `LICENSE` et `NOTICE-anidoodle.txt`, à côté de SKILL.md._
