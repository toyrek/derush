# Hommage, souvenir (Memorial Tribute)

> Memorial and tribute video editor: arranges a life's photos and clips in a family-approved chronological arc (opening portrait, childhood, young adult, family, later years, closing portrait with dates), 4-7 s per photo with slow push-ins, gentle dissolves on musical phrases, a quiet licensed song, names and dates checked three times, and a glitch-free 16:9 master plus a loopable version for the venue.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

A life told with dignity: the right photos, in the right order, at a pace that lets people remember.

- **Best for:** funerals and celebrations of life, remembrance days, milestone tributes (retirement, anniversary)
- **Inputs:** photos (scanned / phone copies) in the family's order, optional short clips and voice recordings, one song the family chose (licensed for the use), names, dates, a closing line
- **Formats:** 16:9 1920x1080 master (venue screen / TV), a looping version for the reception, optional 9:16 for family sharing
- **Duration target:** 3-10 min (about 12-15 photos per song minute at 4-5 s each)

## How a pro cuts this

| beat | % | what happens |
| --- | --- | --- |
| opening portrait + name | 0-8 | the best-loved portrait, name and dates |
| childhood | 8-28 | earliest photos, family of origin |
| young adult | 28-48 | school, work, friends, wedding |
| family | 48-73 | children, grandchildren, homes, celebrations |
| later years | 73-90 | recent joy, the face people remember |
| closing portrait + dates | 90-100 | a final portrait and a short line ("Forever in our hearts") |

- **Pacing:** 4-7 s per photo (longer for group photos: more faces need more time), ASL varies with the music; never uniform.
- **Cut rules:** change photos on musical phrases (every 2 or 4 bars), not on every beat. Group by era or event; keep siblings and partners near each other.
- **Motion:** slow push-in (Ken Burns) on photos; never so tight that heads are cut; static for small/low-resolution scans.
- **Transitions:** dissolves 0.8-1.2 s (the one place they belong); dip to black between eras if the music pauses. No flashy effects.
- **Music:** gentle, leads the piece; one or two songs; end on the song's real ending (fade only at a phrase end). Under a recorded voice or speech, duck it.
- **Colour:** keep photos natural; a soft unifying look (`dreamy` 0.4 or `vintage-70s` 0.3) only if the family likes it; black-and-white photos stay black-and-white.
- **Text:** names and dates only, plus era titles if wanted; large, high-contrast, on screen >= 3 s.
- **Client (family) judges:** dignity, accuracy, everyone included, no glitches.
- **Common mistakes:** a wrong name or date, someone left out, faces cropped by the 16:9 frame, rushed pace, an upbeat song cut mid-phrase, glitch effects, a file that doesn't play on the venue's laptop.

## Check before delivering

- Every name and date checked three times against the family's written list.
- Everyone the family named appears; nobody they excluded does; order approved in writing.
- No cropped heads, no upside-down or low-res stretched scans; black-and-white photos untouched.
- Song ends on its real ending; no glitches; `qc.py` passes (no black gaps, no flashes).
- Watch the whole video once before sending. Tell the family: length, song, order summary, files, and how to play it.

---

_Adapté de « memorial-tribute », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
