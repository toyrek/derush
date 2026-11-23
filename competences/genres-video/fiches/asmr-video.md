# ASMR (ASMR Video)

> ASMR video editor for Claude: turns long trigger recordings (tapping, whispering, brushing, crinkles, roleplay, cooking sounds) into a calm, long-take ASMR video with untouched trigger audio, slow dissolves, no music and a quiet master, plus short vertical teasers.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Long, slow, quiet: the sound is the product and the edit's job is to stay out of the way.

- **Best for:** trigger videos (tapping, scratching, brushing, crinkles), whisper roleplay, soft-spoken tutorials, sleep videos, cooking and nature ASMR
- **Inputs:** one or more long takes with a good stereo or binaural mic track; optional close-up inserts
- **Formats:** 16:9 master, 9:16 teasers (30-60 s)
- **Durations:** 10-60 min full video, teasers 30-60 s
- **Genre preset:** `--genre asmr-video` (see `python CORE/scripts/editor.py genre asmr-video`)

## How a pro cuts this

**Structure (% of length)**

| beat | % | what goes here |
| --- | --- | --- |
| settle in | 10 | soft greeting or first gentle trigger, establishing frame, no surprises |
| triggers | 80 | trigger blocks of 2-8 min each, one trigger family per block, slow transitions between |
| wind down | 10 | slowest, quietest trigger, fade to black, no outro jingle or loud end screen |

**Pacing.** ASL 15-60 s. A cut is an event that can break relaxation, so cut only to change trigger, remove a
mistake, or move to a better angle. Never a pattern interrupt, never a zoom punch.

**Cut rules.**
- No autocut. Pauses are part of the experience: always run with `--no-cut`.
- Remove mistakes with explicit ranges (`--cut "312-318.5"`) or by leaving them out of the timeline spec.
- Join takes on silence or on the start of a trigger, never mid-sound. Crossfade audio 40-60 ms minimum.
- Keep binaural L/R as recorded: no mono fold, no panning, no stereo widening.

**Transition grammar.** Slow dissolves (1-2 s) between trigger blocks; one dip to black at the end. Nothing else.

**Music and sound.** No music, no SFX. The dialogue chain is the enemy here: noise reduction smears soft triggers and
compression lifts breaths into hiss. Turn denoise off (or the whole chain), keep a gentle high-pass at most.
Loudness: a quiet master around -20 LUFS / -3 dBTP (the genre preset). Do not brick-wall limit.

**Colour.** Soft and low-contrast: `faded` (preset) or `high-key` at low intensity for bright sets, `moody` for dark
sleep videos. Intensity 0.3-0.5. No grain (it reads as noise), no flicker, no light leaks.

**Captions.** None in the video. A small title card in the first seconds is optional. Upload `captions.srt` only for
whispered speech that matters (roleplay lines).

**What the client judges.** Audio fidelity (no hiss, no pumping, no clicks), calm pace, and that nothing jolts.

**Common mistakes.** Running autocut; denoising the triggers; loud intro sting; music under triggers; sudden
volume jumps between takes; normalising the whole video to -14 LUFS so whispers come out shouty.

## Check before delivering

- Listen with headphones to the start, every join and the end: no clicks, no level jumps, L/R not swapped.
- Measure: `python CORE/scripts/audio_chain.py measure asmr/final.mp4` shows about -20 LUFS and TP at or under -3.
- Contact sheet: soft, even exposure; no text left from the skin; nothing flashes (`qc.py` flash check passes).
- Tell the user which ranges were removed, that no noise reduction was applied, and which file to upload.

---

_Adapté de « asmr-video », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
