# Meilleurs moments d’un match (Sports Highlight)

> Sports highlight and recruiting-reel editor for Claude: finds the big moments in game footage from crowd and commentary peaks, orders them best-first or chronologically, adds freeze-frame spotlights on the athlete, a player ID card and a scoreboard, and cuts it to a high-energy track in 16:9 and 9:16.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

The plays that matter, in the right order, with the right player unmistakably marked.

- **Best for:** match and season highlights, recruiting / scouting reels, school and club sport, esports clips (see gaming-vod)
- **Inputs:** game footage (broadcast, sideline or phone), player name / number / position / stats, team logo, track
- **Formats:** 16:9 reel, 9:16 clips
- **Durations:** recruiting reel 2-4 min (under 5), match highlights 1-3 min, social clips 15-45 s
- **Genre preset:** `--genre sports-highlight` (`python CORE/scripts/editor.py genre sports-highlight`)

## How a pro cuts this

**Structure (% of length)**

| beat | % | what goes here |
| --- | --- | --- |
| best play | 10 | the single best moment first (recruiters often stop after 30 s) |
| highlights | 75 | 10-25 plays; recruiting: grouped by skill (scoring, defence, passing); match: chronological |
| stats / contact card | 15 | player card, stats, school, contact, coach reference |

**Pacing.** ASL 2-5 s. Each play: 1-2 s of set-up, the action, 0.5-1 s of reaction, out. Do not trim so tight the play
loses context (where the ball came from). Replays: one slow repeat for the very best plays only.

**Identification (what the client judges).** Before every play the viewer must know which player to watch: a freeze
frame with a spotlight / ring on the athlete for ~1 s, then the play at full speed. Same marker style every time.

**Cut rules.** Start each clip before the action (pass, snap, run-up); cut after the result and one reaction beat.
No cutaways in the middle of a play. Speed ramps only into the key contact (0.4-0.5x), then snap back.

**Transition grammar.** Straight cuts between plays on the beat; a dip to white (8-12 frames) before a replay; dip to
black before the player card. No glitch, no spin.

**Music and sound.** High-energy track (bed ~-10 dB), keep crowd roar and the ball sound under it; for recruiting reels
some coaches prefer game sound only: ask. SFX: an impact on a big hit or the freeze, sparingly.

**Colour.** `punchy` or `bleach-bypass` (gritty) for match reels; `documentary-natural` for recruiting (accurate jersey
colours). Match broadcast and phone footage first.

**Captions.** None on the plays. Text = player card, scoreboard / minute, skill labels ("Defence").

**What the client judges.** Clear player identification, best plays first, length under 5 min, correct stats.

**Common mistakes.** Opening with a slow intro; plays without a marker; 20 s of nothing before each play; music drowning
the action; wrong jersey number; long slow-motion everywhere.

## Check before delivering

- Every play has the marker on the right player (check jersey number on each freeze); plays start early enough to read.
- Best play inside the first 10 s; total under 5 min for recruiting.
- Stats, name, number, school spelled and correct (ask the player / coach to confirm).
- Freeze frames are silent by design: confirm the music covers them. `qc.py` passes loudness and flash checks.
- Tell the user the plays used (with source timestamps) and which candidates you rejected.

---

_Adapté de « sports-highlight », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
