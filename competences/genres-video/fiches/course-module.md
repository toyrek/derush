# Leçon de cours en ligne (Course Module)

> Online course lesson editor for Claude: turns a teacher's recording (talking head, slides or screen) into a clean 3-10 min lesson with one learning objective, numbered steps, callouts, quiz cards, a recap, accessible captions (WCAG) and a transcript, consistent across every module.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

One lesson, one objective, nothing the learner has to rewind to understand.

- **Best for:** online courses, corporate training, onboarding lessons, university lectures, coaching programmes
- **Inputs:** lesson recording (face, slides, screen or all three), slide deck export or screen capture, course name
- **Formats:** 16:9 lesson; optional 9:16 promo clip per module
- **Durations:** 3-10 min per lesson (split longer recordings)
- **Genre preset:** `--genre course-module`

## How a pro cuts this

**Structure (% of lesson)**

| beat | % | what goes here |
| --- | --- | --- |
| objective | 8 | "By the end of this lesson you can..." on screen and said |
| why it matters | 10 | the problem this solves for the learner |
| teach | 55 | concept in 2-4 numbered steps, one idea per step |
| example / practice | 17 | worked example, then a quiz card or exercise prompt |
| recap + next lesson | 10 | 3 bullet recap, what comes next |

**Pacing.** ASL 4-10 s; visual change every 8 s (callout, step card, slide change). Slower than YouTube: learners
need time to read. Hold slides with text >= 1.5 s per line of text.

**Cut rules.**
- Keep the last good take (`--retakes`); remove fillers and long pauses but keep the teacher's rhythm.
- Jump cuts are acceptable in lessons; hide the obvious ones with a slide or a punch-in.
- Cut repetition and tangents; move asides to a "notes" document, not the video.
- Split recordings at topic shifts into separate lessons (`story.py outline` shows topic shifts).

**Transition grammar.** Cuts; a dissolve only at a scene change (talking head to slides). Same intro and outro card on
every module.

**Music and sound.** No music under teaching (bed at -32 dB only on the intro/outro card). Clear voice:
`"eq": "clear"`, de-ess, -16 LUFS for LMS/web. No SFX except a soft tick on a quiz reveal.

**Colour.** No look (accurate). Fix white balance and exposure only (auto correction).

**Captions.** Accessible subtitles, sentence case, <= 15 cps, 2 lines max, high contrast (`"preset": "clean"`);
always also deliver `.vtt`/`.srt` sidecars and a transcript.

**What the client judges.** Clarity, consistency across modules, accessibility.

**Common mistakes.** No stated objective; 25-minute lessons; reading slides aloud; music under explanation;
captions too fast; every module with a different look; missing transcript.

## Check before delivering

- Objective said and shown in the first 30 s; recap matches the objective.
- Every technical term spelled right in captions; captions <= 15 cps, never over code or the key part of a slide.
- Same intro, colours and caption style as the previous modules.
- `qc.py` passes; loudness consistent across modules (all at the same target).

---

_Adapté de « course-module », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
