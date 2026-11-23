# Vlog (Vlog)

> YouTube vlog editor: turns a day of handheld A-roll, B-roll and phone clips into a chronological story - cold open on the best moment, title, story beats with jump cuts, J/L cuts and B-roll, music that changes per segment, locator/map graphics, end screen - plus Shorts cutdowns and thumbnail stills.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

A day of footage becomes a story with a cold open, a shape and a personality.

- **Best for:** daily / weekly vlogs, travel days, behind-the-scenes, events from the creator's point of view
- **Inputs:** many clips in shooting order (talking A-roll + B-roll), optional music tracks (licensed), a B-roll folder
- **Formats:** 16:9 1920x1080 (or 4K source) master, 9:16 Shorts cutdowns, 3 thumbnail stills
- **Duration target:** 8-20 min (any length that holds); Shorts 30-60 s

## How a pro cuts this

| beat | % | what happens |
| --- | --- | --- |
| cold open | 0-5 | the best / funniest / highest-stakes moment of the day, 5-15 s |
| title / promise | 5-8 | title card or spoken promise of what today is |
| story beats | 8-90 | chronological; each beat = A-roll line + 2-4 B-roll shots + a music change |
| re-engagement | ~every 3 min | a reveal, a twist, a new place |
| resolution + outro | 90-100 | how it ended, one CTA, end screen space (last 10-20 s) |

- **Pacing:** ASL 3-6 s; a visual change every 4-5 s, faster in the first minute. Hold on real emotion.
- **Cut rules:** jump cuts in talking bits are fine; B-roll covers the boring ones. Top and tail every clip (enter late, leave early). Keep the moments with personality over the "clean" ones.
- **J/L cuts:** bring the next place's ambience in 0.5-1 s before its picture (J); let a line run over B-roll (L).
- **Transitions:** cuts; whip or zoom between locations (matching motion) with a whoosh; dip to black only for a day change.
- **Music:** a different track per segment, cut on a downbeat at the segment change; 20-24 LU under talking, up to full in montages. Room tone / ambience under montages so places feel real.
- **Colour:** one look across phone + camera: correct each clip, then `portra` or `kodachrome` 0.6-0.8 (travel `ektachrome`).
- **Captions:** subtitles as sidecar SRT for YouTube; burned `clean` preset only on Shorts.
- **Client judges:** retention graph, authentic personality, no dead air.
- **Common mistakes:** 60 s of "good morning" before anything happens, music too loud under speech, every clip at the same length, no ambience, ending three times.

## Check before delivering

- Something happens in the first 10 s; the title promise is paid off.
- Music changes land on bars and never fight speech; ambience under montages; no digital-silence holes.
- One consistent look across cameras; faces natural.
- `qc.py` passes (-14 LUFS, -1 dBTP, no black frames); end-screen space kept.
- Tell the user: runtime, structure (beats with times), music used (licences), files.

---

_Adapté de « vlog », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
