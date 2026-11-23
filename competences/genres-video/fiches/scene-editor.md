# Scène de fiction (Scene Editor)

> Narrative scene editor for scripted coverage (wide, mediums, overs, close-ups, inserts): builds line strings of every take, picks the best performance per line (emotion over continuity, Murch's Rule of Six), assembles the scene with J/L cuts and real reactions, times cuts to the end of thoughts and before blinks, checks the 180-degree and 30-degree rules, and hands over an EDL/FCPXML/OTIO turnover.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Coverage in, a scene that plays out: the best reading of every line, reactions that mean something, invisible cuts.

- **Best for:** short films, web series, sketches, music-video narrative scenes, branded drama
- **Inputs:** every take of every setup for one scene (`A_wide_t1.mp4`, `B_cu_anna_t3.mp4`...), the script page, script-supervisor notes if any (circled takes)
- **Formats:** 16:9 (or the project ratio, e.g. 2.39 letterbox) reference cut + EDL / FCPXML / OTIO turnover
- **Duration target:** the scene's natural length (rule of thumb ~1 min per script page)

## How a pro cuts this

| beat | % | what happens |
| --- | --- | --- |
| establish | 0-10 | where we are and who is there (wide or a telling detail); skip it if the previous scene already did |
| build | 10-70 | dialogue and action; coverage tightens as tension rises (wide -> medium -> close) |
| turn | 70-90 | the moment the scene is about: closest shot, longest hold, best reading |
| button / exit | 90-100 | a reaction, a look, a line; leave the scene early |

- **Choose by Rule of Six:** emotion 51 %, story 23 %, rhythm 10 %, eye-trace 7 %, 2D plane 5 %, 3D space 4 %. Never trade emotion or story for a continuity match.
- **Line strings:** for each line, watch every take of it back to back and mark the best reading. The last complete take is often the keeper, but performance beats polish.
- **Cut points:** at the end of a thought, 1-2 frames before a blink; cut on action about a third into the move; enter late, leave early.
- **J/L cuts:** dialogue split edits 4-12 frames; hold on the listener (L) when the reaction matters more than the speaker's face; bring the next scene's sound 1-2 s early.
- **Avoid "Dragnet" tennis** (every line its own straight cut). Reactions are story choices (Kuleshov): pick the one that tells the truth of the moment.
- **Continuity checks:** 180-degree line kept, >= 30 degrees or >= 1.2x size change between shots of the same person, eyelines matching, props/hands in the same place across the cut (but emotion wins).
- **Pacing:** ASL 3-8 s; let the turn breathe 1-3 s after the line lands.
- **Transitions:** cuts. Dissolve only for time passing; dip to black only at act ends.
- **Music/SFX:** temp score only if asked; room tone under every edit; ambience continuous across cuts.
- **Colour:** reference only (`documentary-natural` 0.3); the real grade comes after lock (`short-film-finisher`).
- **Client (director) judges:** performance choices, invisible cutting, rhythm.
- **Common mistakes:** keeping the clean take over the true one, cutting every line, holding the wide too long, crossing the line by accident, cutting on a blink-less stare mid-thought.

## Check before delivering

- Every line's chosen take noted (`takes_used.md`: line, take, why); circled takes respected or the choice explained.
- No accidental line crossing, no jump cuts between near-identical framings, eyelines match.
- Room tone under every edit; no audio pops at J/L points.
- Reactions are real reactions from the same scene (no stolen reactions in documentary-style pieces).
- Tell the user: scene length, takes used, which notes were addressed, version number, files.

---

_Adapté de « scene-editor », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
