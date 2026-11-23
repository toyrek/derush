# Recette (Recipe Video)

> Recipe and food video editor for Claude: turns cooking footage (overhead steps, pours, sizzles, the finished dish) into a 30-60 s vertical recipe reel that opens on the money shot, shows ingredients with readable quantities, speeds through the process and ends on the taste, plus a longer YouTube version.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Make them hungry in the first second, then make the recipe impossible to get wrong.

- **Best for:** recipe reels, food creators, restaurant dishes, meal prep, cocktail videos
- **Inputs:** overhead/step clips (one per step ideally), the finished-dish shot, optional voice or talking head, ingredient list with quantities
- **Formats:** 9:16 master, 4:5 and 1:1 feed, 16:9 long-form
- **Durations:** reel 30-60 s, long-form 5-12 min
- **Genre preset:** `--genre recipe-video`

## How a pro cuts this

**Structure (reel, % of length)**

| beat | % | what goes here |
| --- | --- | --- |
| money shot | 10 | the finished dish: cheese pull, cut-through, pour, steam, in the first second |
| ingredients | 15 | quick cuts or a flat-lay with a checklist of quantities |
| steps | 55 | one step per shot, fast-forward the waiting, verbs on screen |
| final reveal / taste | 15 | plating, the bite, the reaction |
| CTA | 5 | "save this", recipe link |

**Pacing.** ASL 1-2.5 s; visual change every 2 s. Speed process shots 2-4x (stirring, kneading, simmering), keep
pours and sizzles at real speed or slow (0.5x) for appetite.

**Cut rules.**
- Cut on action: hand enters, ingredient drops, pan tilts. Match cut bowl-to-bowl between steps.
- Hold each quantity on screen >= 1.5 s; never cover the food with text.
- Jump cuts are native here; keep one camera angle per step so the viewer stays oriented.

**Transition grammar.** Cuts on the beat, whip between big phases, flash only at the reveal. No dissolves.

**Music and sound.** Upbeat bed ~-20 dB, ducked under voice. Food sound is the star: keep sizzle, crunch, pour and
chop audible (`audio: "keep"` on those clips, music dips). SFX medium (~10/min): `pop` on ingredient cards,
`whoosh-short` on whips, `ding` when it comes out of the oven.

**Colour.** `food-pop` (rich warm reds, oranges, yellows) at 0.6-0.8, or `warm`; keep greens fresh, never neon.

**Captions.** Word-pop 1-3 words, uppercase, <= 17 cps (`"preset": "hormozi"` or the skin's), ingredient names as
`keywords`. Quantities go in cards, not in fast captions.

**What the client judges.** Appetite appeal and readable quantities.

**Common mistakes.** Opening on raw ingredients; text over the food; quantities too fast to read; cold grey grade;
music drowning the sizzle; missing an allergen; oven temperature wrong.

## Check before delivering

- Every quantity, temperature, time and allergen matches the user's recipe list.
- Money shot by 1 s; no text over the food; quantities on screen >= 1.5 s.
- Sizzle and crunch audible over the music; `qc.py` passes (-14 LUFS, -1 dBTP, safe zones).
- Colour looks appetising but true (no orange skin, no neon greens).

---

_Adapté de « recipe-video », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
