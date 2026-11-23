# Clip de paroles (Lyric Video)

> Lyric-video editor: times every lyric line to the sung vocal (Whisper word timestamps, optionally on a Demucs vocal stem), shows each line with a karaoke fill as it is sung and the next line dimmed, over artwork, footage or a beat-reactive background, and delivers a 16:9 lyric video, a 9:16 chorus clip and an .srt of the lyrics.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

The words land exactly when they are sung, readable on any background, in the artist's look.

- **Best for:** song releases, sing-alongs, devotional and worship lyrics, karaoke versions
- **Inputs:** the song (master), the approved lyrics text, cover art / background footage
- **Formats:** 16:9 1920x1080, 9:16 chorus clip (15-30 s), lyrics `.srt`
- **Duration target:** the song

## How a pro cuts this

| section | what happens |
| --- | --- |
| intro | title + artist on the artwork until the first sung word |
| verses | one line at a time, low-to-mid frame, calm motion |
| chorus | bigger type or a different layout; the same design each chorus so it feels like a hook |
| bridge | a visual change (colour, background) |
| outro | title card again, credits |

- **Timing:** each line appears 0.1-0.2 s before its first sung word and leaves 0.2 s after the last; words fill as sung. No line on screen < 1 s.
- **Line length:** <= 42 characters (16:9), <= 26 (9:16); split long lines at the singer's breath.
- **Readability:** contrast over any background (shadow/box/dim the background with `vignette`); avoid the face if footage has a singer.
- **Motion:** gentle (`maskUp`, `fade`); beat pulses on the chorus only; never shake text people must read.
- **Audio:** the song untouched (`"audio": {"voice": false}`), normalised to -14 LUFS.
- **Colour:** follow the cover art; a look on footage only (`music-video-neon`, `dreamy`, `vintage-70s`).
- **Client (artist) judges:** sync, readability, matches the release artwork.
- **Common mistakes:** lyrics typed from Whisper (wrong words), lines late by half a second, two lines changing at once, tiny type, text over the singer's mouth.

## Check before delivering

- Every word matches the approved lyrics (diff your `lines` against the lyric sheet).
- Sync checked at the first line, each chorus start and the last line (+-0.1 s).
- Readable on the darkest and brightest background moments; inside safe areas.
- Song audio intact and on loudness target.
- Tell the user: line count, any lines you split, files.

---

_Adapté de « lyric-video », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
