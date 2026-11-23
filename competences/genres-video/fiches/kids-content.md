# Vidéo pour enfants (Kids Content)

> Children's video editor for Claude: turns kids' songs, stories, simple lessons and family-channel footage into bright, simply cut 2-10 min videos and short clips with big sing-along captions at slow reading speed, repetition, friendly sound effects and safe, age-appropriate graphics.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Simple, bright, repeated and safe: a child can follow it and a parent can trust it.

- **Best for:** nursery rhymes, sing-alongs, alphabet/number lessons, storytime, family-friendly science, toy-free play ideas
- **Inputs:** host or song recording, simple B-roll or drawings, the lyrics or script, images for flash-card moments
- **Formats:** 16:9 episode, 9:16 short clips
- **Durations:** 2-10 min episodes, 30-60 s clips
- **Genre preset:** `--genre kids-content`

## How a pro cuts this

**Structure (% of episode)**

| beat | % | what goes here |
| --- | --- | --- |
| hello song / hook | 8 | the same friendly opening every episode, the topic in one picture |
| lesson / story | 70 | one idea at a time, each shown, said and written |
| repeat / sing-along | 15 | repeat the key words or chorus with the captions filling as they are sung |
| goodbye | 7 | the same goodbye each episode, calm ending |

**Pacing.** ASL 2-4 s; visual change every 3 s but never frantic. Repetition is a feature: show a new word, say it,
show it again. Hold flash-card images >= 2 s.

**Cut rules.**
- Simple straight cuts; keep the host's face visible when they talk to the child.
- Remove fillers and long pauses but keep a beat after a question so the child can answer.
- Every word on screen is spelled right and matches what is said.

**Transition grammar.** Cuts and a soft `pop`/`zoomIn` on graphics; one playful transition kind (wipe or iris).
No glitch, flash bursts or fast strobing.

**Music and sound.** Gentle bed ~-24 dB under speech; songs lead. SFX high but soft (~15/min): `pop`, `boing`,
`sparkle`, `ding` on correct answers; gains 0.3-0.4; nothing scary or loud.

**Colour.** Bright and soft: `pastel` or `high-key` at 0.5-0.7; never neon or harsh contrast.

**Captions.** Big sing-along words, 1-4 at a time, uppercase or clear sentence case, <= 12-13 cps for young readers
(`"cpsMax": 12`); `"mode": "fill"` or the `lyric` element for songs.

**What the client judges.** Safety, age-appropriateness, kids keep watching.

**Common mistakes.** Captions too fast; tiny text; flashing; loud SFX; inconsistent intro; a child's personal
details on screen; manipulative CTAs; spelling mistakes in a learning video.

## Check before delivering

- Every word on screen spelled right and matching the audio; captions slow enough to read along.
- `qc.py --kids` passes photosensitivity and loudness; no sudden loud sounds.
- No child's personal details; consent on file; no manipulative CTA; disclosures present.
- Same hello/goodbye and look as the channel's other episodes.

---

_Adapté de « kids-content », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
