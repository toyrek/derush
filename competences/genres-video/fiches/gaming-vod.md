# Meilleurs moments d’un live de jeu (Gaming VOD)

> Gaming stream and VOD editor for Claude: mines a long Twitch / YouTube / Kick stream recording for the loudest, most chaotic moments, cuts each into a punchy 9:16 clip with facecam on top and gameplay below, word-pop captions, zooms and meme-timed sound effects, plus a 16:9 best-of.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Six hours of stream in, the eight moments chat lost its mind over out, each one a vertical clip that lands the punchline.

- **Best for:** Twitch / YouTube / Kick streams, let's plays, esports scrims, reaction streams
- **Inputs:** the VOD (gameplay + facecam in one file, or separate facecam and gameplay recordings), streamer name
- **Formats:** 9:16 clips (facecam top, gameplay bottom), 16:9 best-of
- **Durations:** clips 20-60 s, best-of 5-10 min
- **Genre preset:** `--genre gaming-vod` (`python CORE/scripts/editor.py genre gaming-vod`)

## How a pro cuts this

**Clip structure (% of a 30-45 s clip)**

| beat | % | what goes here |
| --- | --- | --- |
| peak moment | 10 | the funniest frame / scream / clutch first, or a 1 s flash-forward of it |
| setup | 20 | just enough context: what is about to go wrong |
| the play | 50 | the action, cut tight, zooms on the key frame |
| reaction | 15 | the streamer's face and words: this is the payoff, let it breathe |
| CTA | 5 | handle / "full stream on YouTube", or loop back to the start |

**Pacing.** ASL 1-3 s, a visual change every 2 s; remove dead time (menus, loading, walking) completely. Comedic timing
beats rhythm: keep the half-second pause before the punchline.

**Cut rules.** Jump cuts are native here. Never cut off the reaction early; never put an SFX on top of the streamer's
own punchline. One zoom punch on the key frame (1.15-1.3x), alternate sizes.

**Transition grammar.** Hard cuts, zoom punches, flash on the impact, a whip between clips in a compilation. Glitch only
for a fail moment.

**Music and sound.** Game audio + voice, ducked music bed only where it was quiet (bed ~-22 dB). Meme SFX are high
density (up to ~20/min): `record-scratch`, `boing`, `tape-stop`, `impact`, `bass-drop`, but each motivated by a moment.

**Colour.** `gaming-vivid` or `punchy`, light (0.5-0.6) so the game UI keeps its colours.

**Captions.** Word-pop, 1-3 words, uppercase: `"preset": "beast"` or `"hormozi"`, keywords in accent, emoji on key words.

**What the client judges.** Comedic timing, the reaction landing, readable gameplay in the vertical crop.

**Common mistakes.** Too much setup; reaction cut off; gameplay squashed so small it is unreadable; SFX over the joke;
copyrighted stream music left in; captions over the facecam.

## Check before delivering

- Contact sheet: facecam and gameplay both readable, captions not over the face or the HUD, nothing in the bottom 25%
  (TikTok UI) or the right 14%.
- The reaction is complete; the punchline is not covered by an SFX.
- No copyrighted stream music, no visible personal info, no slurs from chat on screen.
- `qc.py`: loudness -14 LUFS, photosensitivity (game flashes + `flash` elements) passes or is flagged to the user.
- Tell the user which timestamps each clip came from and which peak-detector candidates were rejected.

---

_Adapté de « gaming-vod », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
