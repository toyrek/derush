# Lookbook, tenues (Fashion Lookbook)

> Fashion lookbook and outfit-reel editor for Claude: cuts runway, studio or street-style footage on the beat into a 15-60 s lookbook with outfit-change transitions, product tags and prices, true-to-garment colour, in 9:16, 4:5 and 16:9.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Every look on the beat, every garment its true colour, every tag readable: a collection that sells.

- **Best for:** brand collection drops, boutique and D2C catalogue reels, stylists, outfit-transition creators, runway recaps
- **Inputs:** clips per look (walks, turns, details), product names / prices / SKUs, logo, licensed track
- **Formats:** 9:16 master, 4:5 feed, 16:9 for the website / YouTube
- **Durations:** 15-60 s (3-8 looks)
- **Genre preset:** `--genre fashion-lookbook` (`python CORE/scripts/editor.py genre fashion-lookbook`)

## How a pro cuts this

**Structure (% of length, 4 looks)**

| beat | % | what goes here |
| --- | --- | --- |
| look 1 | 25 | strongest silhouette first: full body, then 1-2 details, tag |
| look 2 | 25 | full body, movement (turn, walk), detail, tag |
| look 3 | 25 | same grammar, different energy |
| hero look + tag | 25 | the look the brand pushes most, held longer, logo + CTA ("Shop the drop") |

**Pacing.** ASL 0.8-2 s on the beat; full-body shots 1.5-2.5 s (the customer must see the fit), details 0.5-1 s. Change
outfit on a downbeat or a phrase change; inside a look cut every beat or every 2nd beat.

**Cut rules.** The outfit change is the event: hide it in a motivated transition (spin, hand over the lens, jump, walk
past the camera), cut on the action a third of the way in. Keep the model's position matched across an outfit change
(same framing, same spot) so the swap reads as magic.

**Transition grammar.** Cuts on the beat; one outfit-change transition family (match cut, whip or speed ramp) used
consistently; a dip to black only before the logo.

**Music and sound.** The track leads (no duck), cut on bar lines, ending on a hit. Optional fabric / heel foley, one
whoosh per whip.

**Colour.** Garment colour accuracy matters more than mood: e-commerce returns come from wrong colour. Use
`clean-commercial` or `high-key` lightly (0.3-0.5) or no look at all; correct white balance first. The preset's
`pastel` look is for editorial / brand-mood versions only, never the shop version.

**Captions.** None. Product tags (name, price) per look, small and inside the safe zone.

**What the client judges.** Garment colour accuracy, fit visible, rhythm, tags correct.

**Common mistakes.** A stylised grade shifting a red dress to orange; tags with wrong prices; outfit changes off the
beat; details only and no full body; text under the platform buttons.

## Check before delivering

- Colour: every garment matches its reference photo (hold them side by side); whites are white.
- Tags: names, prices and currency exactly as the client wrote them; each tag on screen >= 1.5 s; safe zones respected
  in 9:16 and 4:5.
- Outfit changes on downbeats; each look shows the full body at least once.
- `qc.py` passes loudness and flash checks; the track ends on a hit.
- Tell the client the look order, the track credit and which version is the colour-accurate shop version.

---

_Adapté de « fashion-lookbook », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
