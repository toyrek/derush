# Film de marque (Brand Film)

> Brand film editor for Claude: turns founder and team interviews, product and place B-roll and a licensed track into a 2-3 min mission-driven hero film plus 60 s and 30 s cutdowns and social verticals, with brand-guide lower thirds and colour-matched cameras.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

The company's reason to exist in 2-3 minutes: people first, product second, logo last.

- **Best for:** about-us films, founder stories, manifesto films, recruiting films, corporate hero videos
- **Inputs:** 1-4 interviews (founder, team, customer), B-roll of people/product/place, logo PNG, brand fonts and colours, one licensed track
- **Formats:** 16:9 hero master, 9:16 and 4:5 cutdowns
- **Durations:** hero 90-180 s, cutdowns 60 s and 30 s
- **Genre preset:** `--genre brand-film` (`python CORE/scripts/editor.py genre brand-film`)

## How a pro cuts this

**Structure (hero, % of length)**

| beat | % | what goes here |
| --- | --- | --- |
| hook | 8 | one striking image or line that is not the logo; the question the film answers |
| problem / world | 17 | the world before: the customer's pain, the founder's frustration |
| mission / solution | 35 | why the company exists, how it works, shown not told |
| proof / people | 25 | team, customers, results, real moments |
| vision + logo | 15 | where it goes next, final line, logo lockup and URL |

**Pacing.** ASL 3-6 s; interview shots 5-10 s, B-roll 2-4 s; a visual change at least every 5 s. Breathe 1-2 s after
the emotional line before the next idea.

**Cut rules.**
- Paper edit first: build the story from soundbites (`story.py outline`, `selects.py`), radio edit, then cover.
- No visible jump cuts: cover every interview join with B-roll (>= 0.5 s each side), a second angle or a >= 1.2x punch-in.
- J-cut the next speaker 0.3-1 s under B-roll; L-cut a strong line over the people it is about.
- Keep the best performance, not the cleanest take. Light filler removal; keep the breath before a key line.
- No frankenbites: never join words from different answers into a claim the person did not make.

**Transition grammar.** Straight cuts and split edits; one dissolve family for time/mood shifts; match cuts between
ideas if the footage offers them. No whips, glitches or flashy wipes.

**Music and sound.** Licensed track as a bed (~-22 dB), ducked under speech, lifted in B-roll gaps; build to the
vision section and land the logo on a downbeat (`fitTo: "beats"`, `endButton: true`). Room tone under every join.
SFX low (about 4/min): a soft whoosh into the logo at most.

**Colour.** Match cameras first (`color.match` to one hero frame), skin before look. `kodak-2383` for cinematic,
`clean-commercial` or `cool-corporate` for tech, `portra` for warm human brands. Intensity 0.5-0.7.

**Captions.** Brand-font subtitles, `"preset": "clean"`, sentence case, <= 17 cps. Lower thirds in brand colours.

**What the client judges.** Brand compliance (fonts, colours, logo), executives looking good, message clarity.

**Common mistakes.** Opening on the logo; a CEO monologue with no pictures; stock-looking B-roll that decorates;
mismatched skin between cameras; music that fights the voice; wrong job title in a lower third.

## Check before delivering

- Every name and title spelled as the client wrote it; logo clear space respected; colours match the brand hex.
- Skin matches across cameras on the contact sheet and in the full render; no uncovered jump cut.
- Every claim has a source; no constructed quotes; releases on file.
- `qc.py` passes (-14 LUFS, -1 dBTP), music ends on a resolved bar, captions <= 17 cps.

---

_Adapté de « brand-film », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
