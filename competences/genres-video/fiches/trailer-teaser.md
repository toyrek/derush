# Bande-annonce, teaser (Trailer / Teaser)

> Trailer and teaser editor for films, series, games, events, courses and launches: abridged three-act structure, copy cards between acts, dialogue buttons, music-driven cutting with risers into hits, 0.5-1 s of silence before the drop, an accelerating montage, the title card and a button after it. Teaser 30-60 s (mood + one hook), trailer 90-150 s.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Sell the feeling, hide the plot: three acts, cards, risers, silence, hit, title, button.

- **Best for:** short-film / feature / series trailers, event and product hype, course or channel trailers
- **Inputs:** the film or footage (clips or one long file), the strongest dialogue lines, the music (licensed; ideally a trailer track with builds and hits), title, date / CTA copy
- **Formats:** 16:9 1920x1080 (2.39 letterbox optional), 9:16 teaser, textless version, stems
- **Duration target:** teaser 30-60 s, trailer 90-150 s

## How a pro cuts this

| act | % | what happens |
| --- | --- | --- |
| act 1: world | 0-30 | calm open on an image + a line; who and where; music low |
| card | - | copy card ("THIS WINTER"), 1.5-2.5 s, between acts |
| act 2: conflict | 30-65 | the problem, the stakes; dialogue lines as buttons; music builds |
| silence / drop | - | 0.5-1 s of near-silence before the big hit |
| act 3: montage | 65-88 | accelerating cuts on the beat (every beat, then every half beat), biggest images |
| title | 88-96 | title card on a hit |
| button | 96-100 | one last line or joke after the title, then date / CTA |

- **Pacing:** act 1 holds 3-5 s; act 2 2-3 s; act 3 0.5-1.2 s on the beat. Vary: never cut on every beat for long.
- **Cut rules:** cut on downbeats and phrase changes; put lines in the music's gaps; end dialogue on a hit. Out-of-context lines are normal in trailers, but they must not misrepresent the film's genre or a real person's words.
- **Transitions:** hard cuts and dip-to-black between acts; flash-white on hits sparingly; no wipe zoo.
- **Music/SFX:** music leads (no ducking except under lines); risers into hits (`riser` at hit - 1.2 s, `riser-long` at hit - 4 s), `braam` / `impact` / `boom` on hits, `sub-drop` under the title; silence before the drop.
- **Colour:** `teal-orange-pro` 0.8-1.0 or the film's own look pushed; `bleach-bypass` for action.
- **Captions:** none; text is copy cards and the title.
- **Client judges:** what it makes you feel, what it hides, whether you'd watch the film.
- **Common mistakes:** telling the whole plot, the twist in the trailer, cards on screen too short to read, every cut on every beat, no silence before the drop, the title without a hit, music cut mid-phrase.

## Check before delivering

- No spoilers the user flagged; dialogue lines represent the film honestly.
- Every card readable (>= 1.5 s, <= 4 words); title on a hit; button after the title.
- Silence before the drop actually silent; music ends on a resolved bar; no music cut mid-phrase.
- `qc.py`: -14 LUFS / -1 dBTP; flash frames under the photosensitivity limit (< 3 flashes per second).
- Tell the user: structure with times, music used (licence), files.

---

_Adapté de « trailer-teaser », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
