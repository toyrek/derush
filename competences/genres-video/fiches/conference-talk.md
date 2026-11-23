# Conférence, table ronde (Conference Talk)

> Conference talk editor for Claude: turns a keynote, panel, meetup or webinar recording (speaker camera plus slides) into a clean 16:9 session video with a title card, speaker lower third, slide inserts, trimmed dead air and applause, accessible captions and chapters, plus a 60-90 s highlight and vertical quote clips.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

The talk as the audience should have seen it: the speaker when they matter, the slide when it matters, and nothing lost.

- **Best for:** keynotes, conference sessions, meetups, panels, webinars, lectures, TEDx-style talks
- **Inputs:** speaker camera (or the event's program feed), the slide recording or slide images, speaker name/title, event logo
- **Formats:** 16:9 full session; 16:9 highlight; 9:16 quote clips
- **Durations:** session 10-60 min as given; highlight 60-90 s; quote clips 20-45 s
- **Genre preset:** `--genre conference-talk`

## How a pro cuts this

**Structure (session, % of length)**

| beat | % | what |
| --- | --- | --- |
| title card | 2 | session title, speaker, event, date (3-5 s) |
| talk | 90 | the talk in order; trim walk-on, mic fiddling, "can you hear me", long applause |
| Q&A | 6 | keep the best 1-3 questions, repeat the question as a caption if the mic missed it |
| end card | 2 | event logo, links, next event |

Highlight (60-90 s): the strongest 3-5 lines in talk order, each a complete thought, cold open on the best line.

**Pacing.** This is long-form for a patient audience: ASL 6-20 s, a visual change at least every 20 s (slide insert,
punch-in, wide). Do not tighten pauses like a reel: the speaker's timing is part of the talk. Max gap 1.2 s, fillers kept
natural (only um/uh go), no retake removal (a talk has no retakes).

**Cut rules.**
- Cut to the slide when the speaker says "as you can see", reads a number or points at the screen; hold the slide at
  least 4-6 s (people read it), longer for dense slides; go back to the speaker for stories, jokes and emotion.
- Slide + speaker picture-in-picture for long slide sections so the face stays present.
- Trim applause to 1-2 s after the opening and the ending; never cut a laugh off.
- Cover the few autocut joins with a slide insert or a punch-in (>= 1.2x) so no jump cut shows.

**Transition grammar.** Straight cuts between speaker and slide (a 0.3 s dissolve at most), dip to black between
sessions or before Q&A. Nothing else.

**Music and sound.** Music on the title and end cards only (bed -30 dB). Under the talk: none. Clean the room: light
denoise, `broadcast` EQ, de-ess; level the speaker; keep audience laughter. SFX none.

**Colour.** Accurate, not stylised: correct the white balance of stage light, `cool-corporate` or
`documentary-natural` at 0.4-0.5. Match the slide recording's brightness to the camera so cuts don't flash.

**Captions.** Accessible subtitles, sentence case, two lines, <= 15 cps (`"preset": "clean"`), plus sidecar SRT/VTT for
the platform. Speaker name as a lower third at first appearance.

**What the client judges.** Slides readable, the speaker looks good, the sound is clear, names right, and it is on
the website quickly.

**Common mistakes.** Slides too small or on screen too briefly; the speaker cut out while telling a story; reel-style
tightening; loud music under speech; missing lower third; a wrong job title; Q&A questions inaudible.

## Check before delivering

- Slides readable at 1080p on a phone; slide inserts held long enough to read; no slide covered by a lower third.
- Speaker name, title and session title spelled exactly as the event program.
- No jump cut visible; applause trimmed but laughs intact; the opening line is not cut.
- Captions match the audio (names, numbers, jargon); `qc.py` passes caption timing and loudness.
- Q&A voices audible or the question captioned; no audience member shown without consent.

---

_Adapté de « conference-talk », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
