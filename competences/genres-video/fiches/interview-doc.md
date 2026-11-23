# Documentaire, interview (Interview Documentary)

> Documentary / interview editor: transcribes the interviews, builds a paper edit and a radio edit (the story in sound first), then covers every interview cut with B-roll, a second angle or a punch-in, with J/L cuts, room tone, light filler removal and a constructed-quote (Frankenbite) guard; delivers the film, a textless version, captions and a music cue sheet.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Real people, their real words, shaped into a story that is honest and moving.

- **Best for:** mini-docs, brand documentaries, oral histories, profiles, NGO stories, YouTube documentaries
- **Inputs:** interview recordings (A-cam, optional B-cam), B-roll and archive in a folder, names/titles of everyone, music (licensed)
- **Formats:** 16:9 1920x1080 master, textless version, captions (SRT/VTT), music cue sheet, 9:16 cutdowns
- **Duration target:** 3-30 min (shorts 3-8, festival 15-30+)

## How a pro cuts this

| beat | % | what happens |
| --- | --- | --- |
| cold open | 0-5 | the most human moment or the central question |
| world / character | 5-20 | who, where, what life looked like |
| inciting question | 20-30 | what changed / what is at stake |
| development | 30-70 | the journey, obstacles, other voices |
| climax | 70-85 | the hardest or truest moment, given room to breathe |
| resolution | 85-100 | what it means now; end on an image or a line, not a summary |

- **Workflow:** transcribe -> paper edit (pick soundbites in `paper_edit.md`) -> radio edit (sound only, no pictures; it must work with eyes closed) -> cover -> fine cut -> lock -> grade/mix.
- **Pacing:** interview shots 5-15 s, B-roll 2-5 s; breathe 1-3 s after an emotional line (silence, a wide, B-roll with ambience).
- **Cut rules:** cut at the end of a thought; keep breaths before emotional lines; remove only um/uh (`keep-natural`). Keep the person sounding like themselves.
- **Every interview cut is covered:** B-roll overlapping 0.5-1 s each side, a B-cam angle, or a >= 1.2x punch-in. Otherwise it is a jump cut and `editor.py review` flags it.
- **J/L cuts:** next speaker's voice under the end of B-roll (J); a line continuing over a location (L); 0.3-1 s.
- **Transitions:** cuts; dissolves for time passing; dip to black between chapters.
- **Music/SFX:** score bed 26-30 LU under voices, entering on emotional turns and leaving before the important line; ambience under all B-roll; no SFX.
- **Colour:** `documentary-natural` 0.5 or `fuji-eterna` 0.5; match A- and B-cam; skin true.
- **Captions:** sentence-case subtitles (preset `clean` or sidecar), <= 17 cps; name supers (lower thirds) on first appearance.
- **Client judges:** story, truthfulness, emotional arc, everyone looking dignified.
- **Common mistakes:** Frankenbites, uncovered jump cuts, wall-to-wall music, B-roll that illustrates literally every noun, cutting the pause before the tears, wrong name spellings.

## Check before delivering

- No constructed quotes; every reordered answer listed and approved; reactions honest.
- No uncovered interview jump cut (`review.md` clean); room tone under every audio edit.
- Names/titles/places triple-checked; captions match the audio.
- Music never covers an important line; `qc.py` passes.
- Tell the user: structure with times, reordering decisions, deliverables, file paths.

---

_Adapté de « interview-doc », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
