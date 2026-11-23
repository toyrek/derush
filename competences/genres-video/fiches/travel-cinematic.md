# Film de voyage (Travel Cinematic)

> Cinematic travel film editor for Claude: turns trip footage, drone shots and phone clips into a music-led 1-3 min travel film and a 9:16 teaser, with match cuts, direction-matched whips, speed ramps, ambience under the music and a filmic grade.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

A place, felt: arrival, discovery, the peak moment and the sunset, cut on the music so the viewer wants to book a ticket.

- **Best for:** trip films, destination and hotel promos, drone montages, road trips, honeymoon films
- **Inputs:** clips (gimbal, drone, phone, GoPro), optional VO or a few spoken lines, one licensed song, ambience clips
- **Formats:** 16:9 master, 9:16 teaser
- **Durations:** film 1-3 min, teaser 15-45 s
- **Genre preset:** `--genre travel-cinematic` (`python CORE/scripts/editor.py genre travel-cinematic`)

## How a pro cuts this

**Structure (% of length)**

| beat | % | what goes here |
| --- | --- | --- |
| arrival / establishing | 15 | plane window, road, first wide or drone reveal, the title |
| discovery | 35 | streets, food, people, textures; details and wides alternating |
| peak moment | 30 | the big view, the jump, the festival: the song's biggest section, speed ramps |
| reflection / sunset | 20 | slower shots, golden or blue hour, the last wide, the place name |

**Pacing.** ASL 1-3 s on the beat; drone and wide reveals 3-5 s; details 0.8-1.5 s. Change shot every 1, 2 or 4 beats:
mix them so it breathes. Slow the cut rate in the reflection section.

**Cut rules.** Match cuts carry the film: shape (a round window to a round bowl), motion (pan right into pan right),
colour. Whip transitions only between shots that both move the same direction. Cut on action a third of the way into a
move. Keep camera motion continuous across a cut (don't cut from a fast push to a static frame unless it is the drop).

**Transition grammar.** Cuts on the beat; one whip family in one direction; speed ramps into the peak; dissolve or dip to
black only for the reflection section. No more than two transition kinds.

**Music and sound.** The song leads (near full level, no duck unless there is VO), cut to length on bar lines and end on
a hit. Layer ambience (waves, market, wind) 15-20 dB under the music; drop the music for 1 s before the peak so the
ambience and the hit land. Whoosh on whips, nothing else.

**Colour.** `teal-orange-pro` (the preset grade), `ektachrome` or `fuji-velvia` for landscapes, `golden-hour` warmth,
`cinestill-800t` for night cities. Intensity 0.7-0.85. Match drone and phone first.

**Captions.** None. Place names as small titles (`chip` or `text`), the destination as a title card.

**What the client judges.** Visual flow, a sense of place, the music hit points, colour.

**Common mistakes.** Every drone shot used; shots all the same length; whips in opposite directions; music fading
mid-phrase; tilted horizons; over-saturated skin; silent visuals with no ambience.

## Check before delivering

- Contact sheet: horizons level, skin not orange, sky not posterised, titles with correct diacritics.
- Whips match direction; ramps feel motivated; no jump from fast motion to static by accident.
- The song ends on a downbeat; ambience audible but under the music; `qc.py` passes loudness, black / flash frames.
- Drone shots legal for where they were flown; strangers in close-up OK to show.
- Tell the user the song credit, the look, and the shot list order.

---

_Adapté de « travel-cinematic », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
