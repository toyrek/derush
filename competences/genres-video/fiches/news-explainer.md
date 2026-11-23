# Actu expliquée (News Explainer)

> News and explainer editor for Claude: turns a presenter clip, voice-over or interview into a sourced, inverted-pyramid explainer (key fact first, why it matters, context, data, what next) with attribution on screen, charts and maps, neutral music, accurate captions, a 16:9 master and vertical cutdowns.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

The fact first, the source on screen, the context after, and nothing the evidence doesn't support.

- **Best for:** news updates, market and policy explainers, "what happened and why", research summaries, local news
- **Inputs:** presenter clip or VO, the sources (links, documents, data), optional B-roll/maps/stills with their licences
- **Formats:** 16:9 master, 9:16 cutdowns
- **Durations:** 60 s-8 min master; 30-60 s cutdowns
- **Genre preset:** `--genre news-explainer`

## How a pro cuts this

**Structure (inverted pyramid, % of length)**

| beat | % | what |
| --- | --- | --- |
| key fact | 10 | the news in one sentence, on screen as a headline, in the first 3 s |
| why it matters | 15 | who is affected and how much |
| context | 35 | how we got here: timeline, map, background |
| data / evidence | 25 | the numbers as charts, each with its source; quotes with attribution |
| what next | 15 | what happens next, what is unknown, where to read more |

**Pacing.** ASL 3-6 s, visual change at least every 5 s (graphic, B-roll, punch-in). Max gap 0.4 s, fillers removed,
retakes removed. Calm, not frantic: a news explainer earns trust by not shouting.

**Cut rules.**
- No hype hook: the hook is the fact itself. No greeting, no "in this video".
- Every jump cut in a presenter piece is fine at this pace, but cover interview cuts with B-roll or a graphic.
- Hold a chart until it has been read (>= 4 s), and say the number while it is on screen.
- Separate fact from analysis visibly (presenter on camera for analysis, graphics for facts).
- Never change a quote's meaning with the shot around it (Kuleshov) or by trimming its qualifier.

**Transition grammar.** Straight cuts; J/L cuts 2-4 frames on presenter joins; a short dissolve only between sections.
No whips, glitches or flashes.

**Music and sound.** Neutral bed at -28 dB under speech, ducked; none under quotes from victims or sensitive topics.
SFX very low (a soft `ui-tap` on a chart reveal at most). Dialogue clear: `broadcast` EQ, de-ess.

**Colour.** Natural: `documentary-natural` at 0.4-0.5 (or `none`). No stylised looks on real-world footage.

**Captions.** Two-line sentence-case subtitles (`"preset": "clean"`, <= 20 cps), names and numbers checked against the
sources. Sidecar SRT for YouTube. Lower third for every person who speaks, with role.

**What the client judges.** Accuracy, attribution on screen, clarity, and speed to publish.

**Common mistakes.** A number on screen without a source; a misleading thumbnail or headline; a chart axis that
exaggerates; old footage presented as new (label "File footage, 2023"); stock music too dramatic; captions with
mis-heard names; "BREAKING" on a non-breaking story.

## Check before delivering

- Every number, name, date and quote on screen matches its source; every data graphic has a source chip.
- No graphic covers a face; ticker and captions don't overlap; nothing outside the 5% title-safe area.
- Charts honest: bars start at zero, units shown, period labelled.
- Archive or file footage is labelled; nothing implies "live" or "breaking".
- `qc.py`: loudness -14 LUFS / -1 dBTP, captions within 20 cps, no flash frames.
- Tell the user which claims you could not verify.

---

_Adapté de « news-explainer », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
