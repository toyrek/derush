# Clip musical (Music Video)

> Music-video editor: syncs every performance take to the master track, builds a performance 'multicam' of takes, intercuts narrative footage, cuts on downbeats and phrase changes (varying every beat / every 2nd / every bar), uses speed ramps and flashes on hits, applies a heavy stylised grade, and delivers the 16:9 master plus 9:16 hook clips and clean/explicit versions.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Every take locked to the song, cuts that breathe with the music, a look as loud as the track.

- **Best for:** artist music videos, performance videos, dance videos, beat-synced montages, visualisers with footage
- **Inputs:** the master song (licensed / the artist's), performance takes shot to playback, narrative/B-roll clips
- **Formats:** 16:9 1920x1080 master (or 4K source), 9:16 hook clips (15-30 s chorus), clean/explicit versions
- **Duration target:** the song (2.5-5 min)

## How a pro cuts this

| section | cutting | what happens |
| --- | --- | --- |
| intro | slow (bar or 2 bars) | establish the world, the artist's first look |
| verse | every 1-2 beats in performance, holds on narrative | story moves |
| pre-chorus | accelerating | build: closer shots, faster |
| chorus | on the beat, biggest shots, hero performance take | energy peak, best lip-sync |
| bridge | change: slow-mo, different look or location | contrast |
| final chorus | fastest, every half beat on hits, flashes | climax |
| outro | resolve on the last downbeat | final image |

- **Pacing:** ASL 0.8-3 s; vary between every beat, every 2nd beat and every bar; hold longer on the best performance moments.
- **Cut rules:** cut on downbeats and phrase changes (every 4/8 bars), right before strong beats; lip sync must be frame-accurate on the sung words (performance cuts happen on beats, not mid-syllable).
- **Intercut:** performance carries the chorus; narrative carries verses; cutaways on instrumental bars.
- **Transitions:** cuts; flash-white / glitch / zoom-blur overlays on hits only; speed ramps (0.4x into a hit, snap back) on the drop.
- **Audio:** the song is the soundtrack, untouched (no dialogue chain, no ducking). Diegetic sound only if the intro/outro has a scene.
- **Colour:** stylised: `music-video-neon` 0.9, `cross-process`, `cinestill-800t` + halation, `infrared` for surreal; consistent per section.
- **Captions:** none (use `lyric-video` for lyrics).
- **Client (artist) judges:** lip sync, rhythm matching the song, the artist looking iconic.
- **Common mistakes:** cutting on every beat for 3 minutes, out-of-sync mouths, the hero take buried, no change in the bridge, a grade that turns skin green unintentionally.

## Check before delivering

- Lip sync checked at three chorus points (frame-accurate on hard consonants).
- Cuts land on beats; no section cut uniformly for > 30 s; bridge feels different.
- Song intact (no clicks at the start/end, ends on the last downbeat), loudness on target.
- `qc.py`: flash frames under the photosensitivity limit (< 3 flashes in any second).
- Tell the user: structure, takes used per section, look, files.

---

_Adapté de « music-video », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
