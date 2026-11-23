# Concert à plusieurs caméras (Concert Multicam)

> Concert and live-music multicam editor for Claude: lines up 2-4 camera angles of a gig, switches angles to follow the music, lays the board mix (or the best camera audio) under the picture, and delivers the full show, per-song files and vertical clips.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

A live show cut so the picture follows the music: the singer on the line, the guitarist on the solo, the crowd on

- **Best for:** band gigs, live sessions, recitals, classical and devotional concerts, DJ sets, school shows
- **Inputs:** 2-4 camera files of the same performance (each with its own audio), optional board-mix WAV, set list
- **Formats:** 16:9 full show and per-song files, 9:16 clips
- **Durations:** song = song length; full show as played (trim tuning and long talk); clips 15-60 s
- **Genre preset:** `--genre concert-multicam` (`python CORE/scripts/editor.py genre concert-multicam`)

## How a pro cuts this

**Structure (% of the show)**

| beat | % | what goes here |
| --- | --- | --- |
| walk-on / crowd | 5 | crowd noise, lights, the band walking on, first chord |
| songs | 88 | each song: wide to establish, then follow the music |
| encore / bow | 7 | applause, the bow, crowd wide, title + date |

**Angle grammar.** Wide at the start of each song and every 30-60 s as a reset; the lead vocal on verses; the soloist on
the solo (this is what the client judges); the drummer on fills and the build; the crowd on the drop or a sing-along.
Change angle on downbeats and phrase changes, not mid-word of a lyric. ASL 2-6 s: shorter on fast songs, 6-10 s holds on
ballads. Never cut to a camera that is refocusing or panning.

**Sync.** Lip and finger sync is everything. The picture must match the mix to the frame; check hard hits (snare,
plosives) at the start, middle and end of each song.

**Transition grammar.** Hard cuts on the beat. Dissolves only on ballads (0.5-1 s). Dip to black between songs in the
full-show file. No whips, no glitch.

**Sound.** The performance is the audio: board mix blended with an audience / camera mic for room and applause. No music
bed, no SFX, no ducking. Keep the master's own dynamics.

**Colour.** Stage light is extreme: `cinestill-800t` with a little `halation` for night shows, `music-video-neon` for
clubs, `documentary-natural` for recitals. Match cameras first (`color.match`), then the look.

**Captions.** None on the performance. Titles only: artist, venue, date, song titles as small lower thirds.

**What the client judges.** Angles that follow the music, sound, energy, the band looking good, sync.

**Common mistakes.** Cutting on every beat (seasick); missing the solo; out-of-sync picture; using the camera mic's
distorted audio; a lower third on every song; crushed blacks hiding the drummer.

## Check before delivering

- Sync on hard hits (snare, kick, plosives) at the start, middle and end of each song; drift means a camera's frame
  rate differed: re-prep it.
- The solo is on the soloist; the wide reset appears regularly; no shot on a focusing / panning camera.
- Strobes: `qc.py` photosensitivity check (>= 3 flashes in 1 s) often fires on concert light; warn the client, add a
  warning card at the start if it stays.
- Loudness at -14 LUFS without squashing the mix; no clipping on the drops.
- Tell the user which angles were used, the sync offsets, and that waveform auto-sync is not done by the engine.

---

_Adapté de « concert-multicam », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
