# Version dans une autre langue (Localise and Dub)

> Localisation and dubbing editor for Claude: takes a finished video and makes a version in another language: transcript, translation, subtitles per language (SRT/VTT/TTML), and an offline TTS voice-over dub time-fitted to the original lines and mixed over the music and effects. Honest about limits: translation needs Claude or an optional local model, voices depend on installed TTS, and lip-sync is not done locally.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Same edit, new language: subtitles you can trust, and a dub that lands on the original timing.

- **Best for:** explainers, tutorials, courses, product demos, talks, short documentaries, faceless channels
- **Inputs:** the finished video (or its work folder), the target language(s), a glossary of names and product terms
- **Formats:** whatever the original is; each language gets its own master + subtitle files
- **Durations:** unchanged from the original (dub lines are fitted to it)
- **Genre preset:** `--genre localise-dub` (see `python CORE/scripts/editor.py genre localise-dub`)

## How a pro cuts this

**Structure.** The original structure stays 100%. Localisation changes words and voices, not the edit.

**Pacing and timing.** Each translated line must fit the time the original line had. Translations run 10-30% longer
(German, Spanish, Hindi) or shorter (Chinese). Fit in this order: rewrite shorter (best), adjust TTS `--rate` within
0.85-1.15 (about +-15%), let the line borrow up to 0.3 s of the following pause, and only then extend the shot
(a freeze or slower B-roll in a re-edit). Never speed a voice above 1.15: it sounds rushed.

**Cut rules.** No new cuts. Keep the original J/L timing: the dub line starts where the original line started
(+-0.1 s), so on-screen actions and graphics still match the words.

**Transition grammar.** Unchanged from the original.

**Music and sound.** Dub over the music-and-effects bed (no original voice). If there is no M&E, either separate it
(`stems.py`) or keep the original voice ducked ~18 dB under the dub ("UN-style" voice-over), which is honest and
common for interviews. Same loudness as the original (-14 LUFS / -1 dBTP for web).

**Colour.** Untouched. Re-use the original grade.

**Captions.** Target-language subtitles, sentence case, <= 42 chars per line, <= 17-20 cps (Netflix-style rules
built into `deliver.py`). Burned-in creator captions in the new language only if the original had them.
Translated on-screen text (titles, lower thirds, cards) must be edited in the plan too.

**What the client judges.** Natural sound, timing, translation accuracy, and that names and terms are consistent.

**Common mistakes.** Literal translation that overruns the line; speeding TTS to 1.4x; original voice bleeding under
the dub; untranslated graphics; subtitles that still follow the source sentence breaks; promising lip-sync.

## Check before delivering

- A fluent speaker has read the translation (names, numbers, units, claims). Note who checked it.
- Every dub line starts within 0.1 s of the original line; no overlaps between lines (`qc.py` silence and loudness pass).
- No original voice audible under the dub (unless the voice-over style was chosen on purpose).
- Subtitles parse, <= 42 chars per line, reading speed within limits (`qc.py` caption checks).
- On-screen text translated and rendered with a font that has the script.
- Tell the user plainly: voice is synthetic, no lip-sync, which steps were machine translation.

---

_Adapté de « localise-dub », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
