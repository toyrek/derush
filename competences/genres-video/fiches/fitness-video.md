# Sport, entraînement (Fitness Video)

> Fitness and workout video editor for Claude: turns exercise footage into a 30-90 s vertical workout reel or a follow-along session with rep counters, interval timers, exercise name cards, right-vs-wrong form split screens and music cut to the BPM.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Clear form, honest timers, and energy that makes the viewer get up and do it.

- **Best for:** workout reels, exercise tutorials, HIIT/follow-along sessions, coach tips, yoga flows
- **Inputs:** exercise clips (one per move), optional talking-head tips, the workout plan (moves, reps, work/rest seconds), a track
- **Formats:** 9:16 master, 4:5 and 1:1 feed; 16:9 for full follow-along sessions
- **Durations:** reel 30-90 s; follow-along = the real workout length
- **Genre preset:** `--genre fitness-video`

## How a pro cuts this

**Structure (reel, % of length)**

| beat | % | what goes here |
| --- | --- | --- |
| result / hook | 10 | the hardest or most impressive rep, or the promise ("5 moves, no equipment") |
| exercise 1 | 25 | name card, 2-4 clean reps, one form cue |
| exercise 2 | 25 | same pattern |
| exercise 3 | 25 | same pattern |
| finisher + CTA | 15 | the burnout move, "save this workout" |

**Pacing.** ASL 1.5-3 s; visual change every 2.5 s. Cut on the rep (the bottom or top of the movement), on the beat
when you can. Follow-alongs hold one wide shot per move with the timer running: don't cut away from the form.

**Cut rules.**
- Show the full range of motion at least once per move, from an angle where the form is visible.
- Right vs wrong form side by side, same angle, wrong side clearly marked.
- Never speed up a demonstration rep (it misleads the tempo); speed up only transitions and setup.

**Transition grammar.** Cuts on the beat, whip between exercises, flash on the finisher. No dissolves.

**Music and sound.** BPM-matched bed ~-16 dB (cut on `downbeats`), ducked under the coach. SFX medium (~12/min):
`countdown-beep` before a work interval, `ding` at rest, `whoosh-short` between moves.

**Colour.** `punchy` or `gaming-vivid` for energy, `high-key` for yoga/wellness. Keep skin natural.

**Captions.** Word-pop 1-3 words, uppercase, <= 17 cps; move names and cues as `tile`s, not captions.

**What the client judges.** Clear form, timer accuracy, energy.

**Common mistakes.** Cutting mid-rep; timers that don't match the real interval; text over the body; music that
fights the coach; a wrong-form clip with no clear "wrong" mark; health claims.

## Check before delivering

- Every timer and rep count matches the workout plan; no move cut mid-rep.
- Form visible in every demo; wrong-form shots clearly marked; no medical claims.
- `qc.py`: photosensitivity passes (flashes on the finisher can trip it), safe zones clear, -14 LUFS.

---

_Adapté de « fitness-video », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
