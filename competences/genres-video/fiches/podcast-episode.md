# Épisode de podcast filmé (Podcast Episode)

> Full video-podcast episode editor: switches 2-4 synced cameras to whoever is talking with wide-shot resets, removes fillers and crosstalk lightly so people still sound like themselves, matches speaker levels, builds a cold-open teaser, name cards and chapters, and delivers the 16:9 YouTube episode, an audio-only MP3/WAV at -16 LUFS and the material for clips.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

A full episode that looks like a studio show and sounds like a podcast: right camera, clean audio, chapters.

- **Best for:** video podcasts, long-form interviews, panel shows, livestream conversations
- **Inputs:** one camera file per person, each with its own mic, starting at the same moment (or one wide shot); optional wide; host/guest names and roles; intro/outro music
- **Formats:** 16:9 1920x1080 episode (-14 LUFS for YouTube), audio-only MP3 (-16 LUFS) and WAV, chapters, show notes draft, thumbnails
- **Duration target:** 30-120 min

## How a pro cuts this

| beat | % | what happens |
| --- | --- | --- |
| cold-open teaser | 0-2 | 30-60 s: the best 2-3 lines of the episode, then a hard cut |
| intro | 2-4 | show sting/music, who the guest is |
| conversation | 4-96 | chronological; chapters at topic shifts every 5-15 min |
| outro + CTA | 96-100 | thanks, where to find the guest, next episode |

- **Pacing:** ASL 4-12 s set by who speaks; minimum shot 2 s; wide reset every 30-60 s and when both talk.
- **Switching:** cut to the speaker at the start of their sentence, not on a one-word "yeah"; show the listener's real reaction now and then (L-cut), never fake one.
- **Cut rules:** light: drop um/uh, false starts and long dead air; keep "you know", laughs and thinking pauses that carry meaning (`fillers: keep-natural`). Cut crosstalk only between words. Don't reorder what people said except for the teaser.
- **Transitions:** cuts only; dip to black only into the outro.
- **Music/SFX:** music only on intro/outro (and under the teaser); no SFX in the conversation.
- **Colour:** match cameras first (same white balance and exposure), then a gentle look (`portra` 0.5 or `cool-corporate` 0.5).
- **Audio:** each voice levelled, de-essed, light denoise; room tone under cuts; -16 LUFS audio feed, -14 LUFS YouTube.
- **Captions:** optional on 16:9 (sidecar SRT always); burned captions belong on the clips.
- **Client judges:** audio quality, the guest looking good, clip quality later.
- **Common mistakes:** ping-pong cutting on every "mm-hm", one voice louder than the other, removing every pause, music under the whole talk, missing name cards, no chapters.

## Check before delivering

- The camera follows the speaker; no shot shorter than 2 s; a wide reset at least every minute of long answers.
- Both voices at the same perceived level; no clipped laughs; room tone under cuts.
- Names and roles spelled right; chapters valid and correctly timed.
- Audio feed -16 LUFS, YouTube -14 LUFS (`qc.py`); duration and A/V sync right at the end of the episode.
- Tell the user: minutes removed, chapter list, files for each platform.

---

_Adapté de « podcast-episode », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
