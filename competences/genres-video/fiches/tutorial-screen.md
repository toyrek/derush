# Tuto à l’écran (Tutorial Screen)

> Screen-tutorial editor for software how-tos, coding walkthroughs and course demos: promise, prerequisites, numbered steps, recap; cuts the waiting, typing and loading, punches in on the area being clicked, adds step chips, keyboard-shortcut and callout overlays, blurs private data, and delivers a 16:9 video with YouTube chapters and captions.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

A screen recording a viewer can follow without pausing: no waiting, the right thing magnified, every step labelled.

- **Best for:** software tutorials, coding walkthroughs, SaaS how-tos, course demos, bug-fix videos
- **Inputs:** a screen recording with your narration (best), or a screen recording + a facecam recorded at the same time; optional final project link
- **Formats:** 16:9 1920x1080 master, chapters, `captions.srt`; optional 9:16 tip clips
- **Duration target:** 5-15 min (one task per video); tips 30-60 s

## How a pro cuts this

| beat | % | what happens |
| --- | --- | --- |
| promise | 0-5 | show the finished result first (5-10 s), then say what you'll build |
| prerequisites | 5-10 | versions, accounts, files needed (a checklist card) |
| numbered steps | 10-90 | one step = one chapter; say it, do it, show the result |
| recap | 90-97 | the steps again in 15 s |
| next / CTA | 97-100 | link, next video |

- **Pacing:** ASL 3-8 s; cut every wait (loading, installs, typing long strings - show a 1 s speed-up or skip to the result). Something changes every 4-6 s: a zoom, a chip, a callout.
- **Cut rules:** never cut away the click that matters; keep the result on screen >= 1 s after each action. Don't cut mid-sentence of an explanation.
- **Zoom:** zoom in when the UI text is small or the action is in one corner (1.6-2.5x on the area), zoom out before the cursor travels across the screen. Smooth 0.4-0.6 s moves, not jumps.
- **Transitions:** cuts; a step-chip change marks a new step. No whooshes on every click.
- **Music/SFX:** quiet bed (28 LU under) or none; soft `click`/`ui-tap` only on the key clicks.
- **Colour:** none - accurate UI colours (`"color": {"auto": false}`).
- **Captions:** sidecar SRT (YouTube) or `clean` preset low on screen; keyboard shortcuts as their own chips.
- **Client judges:** can a viewer follow every step without pausing or hunting for the cursor.
- **Common mistakes:** 4K UI shown full-frame (unreadable), cursor lost, leaked secrets, dead air while something installs, steps not labelled, music louder than the narration.

## Check before delivering

- Watch every step at 1x: could you follow it without pausing? UI text >= ~24 px tall at 1080p when it matters.
- No secrets anywhere (scrub the contact sheet and the full video; also thumbnails).
- Results stay on screen >= 1 s after each action; no cursor-lost moments.
- Chapters match the steps; `qc.py` passes (-14 LUFS, -1 dBTP).
- Tell the user: seconds removed, steps and chapter times, what was blurred, file paths.

---

_Adapté de « tutorial-screen », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
