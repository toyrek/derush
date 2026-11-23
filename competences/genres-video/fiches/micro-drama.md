# Mini-série verticale (Micro-Drama)

> Vertical micro-drama series editor: cuts scripted footage into binge-able 60-120 s 9:16 episodes - a 3-5 s recap or cold conflict open, one escalation and one turn per episode, tight dialogue with J/L cuts and reaction shots, a cliffhanger in the last 3 s, episode cards and a consistent series template - plus a trailer cut.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Vertical episodes that end where the viewer can't stop: recap, conflict, turn, cliffhanger.

- **Best for:** vertical drama series, short web series, branded drama, story-driven creator series
- **Inputs:** scene footage shot vertical (or 16:9 to reframe), the script with episode breaks, series title, music cues
- **Formats:** 9:16 1080x1920 numbered episode set, dialogue subtitles (`captions.srt` per episode), a 30-60 s trailer
- **Duration target:** 60-120 s per episode

## How a pro cuts this

| beat | % | what happens |
| --- | --- | --- |
| recap / cold conflict | 0-10 | 3-5 s of last episode's cliffhanger, or open mid-argument |
| escalation | 10-55 | the problem gets worse; no exposition scenes |
| turn | 55-85 | a reveal, a betrayal, a decision |
| cliffhanger | last 3-8 s | cut on the question (a look, a door, a phone screen), smash to the end card |

- **Pacing:** ASL 1.5-3.5 s in dialogue (tight coverage, close-ups: phones are small screens); hold 1-2 s on the key reaction.
- **Cut rules:** enter scenes late, leave early; cut exposition to the bone; best performance over cleanest take. Reactions are where the drama is.
- **J/L cuts:** 4-12 frames on dialogue; L-cut lines over the listener's face in confrontations.
- **Transitions:** cuts; a smash cut into the cliffhanger end card; `flash-white` for a flashback in/out (with `vhs-tape` style or `sepia` look for the flashback).
- **Music/SFX:** tension score 18-22 LU under dialogue; a `heartbeat` or `riser` into the cliffhanger, `boom` on the end card; silence on the reveal line.
- **Colour:** `fuji-eterna` or `moody` 0.6-0.8 for the series, consistent across all episodes.
- **Captions:** clean dialogue subtitles (preset `clean`), sentence case, inside 10-85 % height (many viewers watch muted).
- **Client judges:** binge-ability (episode-to-episode retention), cliffhanger strength, acting reads on a phone.
- **Common mistakes:** slow openings re-explaining the story, wide shots on a phone, every episode ending on a fade, inconsistent looks between episodes, subtitles covering mouths.

## Check before delivering

- Each episode opens in conflict within 3 s and ends on an open question in the last 3 s.
- Continuity across episodes (costume, props, time of day); one look for the series.
- Subtitles match the dialogue and avoid mouths; names spelled consistently.
- `qc.py` passes per episode (-14 LUFS, length <= 3 min for Reels/Shorts).
- Tell the user: episode list with lengths and cliffhangers, files.

---

_Adapté de « micro-drama », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
