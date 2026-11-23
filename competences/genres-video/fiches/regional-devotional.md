# Chant et cérémonie religieuse (Regional Devotional)

> Devotional and regional-language video editor for Claude: turns bhajans, kirtans, aarti, satsang, katha, temple festivals, gurbani, qawwali and church or mosque recordings into respectful long-take films with large Indic-script lyrics or subtitles (Devanagari, Tamil, Telugu, Bengali, Gurmukhi, Gujarati, Kannada, Malayalam), plus WhatsApp-status-length verticals.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

The ritual sets the pace, the script is spelled right, and the clip fits on a WhatsApp status.

- **Best for:** bhajan, kirtan, aarti, satsang and katha, temple and festival coverage, gurbani, qawwali, hymns
- **Inputs:** the recording (one or more angles), the correct lyrics text in the regional script (from the singer,
- **Formats:** 16:9 full video, 9:16 status clips
- **Durations:** full as performed (1-60 min), status clips 15-60 s (WhatsApp status shows 60 s per part)
- **Genre preset:** `--genre regional-devotional` (see `python CORE/scripts/editor.py genre regional-devotional`)

## How a pro cuts this

**Structure (% of length)**

| beat | % | what goes here |
| --- | --- | --- |
| opening darshan / title | 8 | deity or altar, the venue, title in the regional script |
| ritual / bhajan | 80 | the performance in long takes: singer, instruments, devotees, close-ups of the ritual |
| closing aarti / blessing | 12 | aarti or final prayer complete, prasad, blessing, fade out |

**Pacing.** ASL 6-20 s. Hold through each line of a song; change angle on a line or a phrase change, never mid-word.
Repetitive sections (a 108-count mantra, the pheras of a ritual) keep their rhythm: shorten with long dissolves
between complete repetitions, never by chopping inside one.

**Cut rules.**
- No autocut: the singing has natural breaths and instrumental breaks (`--no-cut`).
- Cut on the tala (beat) or on the end of a line. Devotee reactions as cutaways over the song, never over a mantra.
- Never splice lines from different verses into a new verse.

**Transition grammar.** Straight cuts and slow dissolves (1-1.5 s); a dip to black at the end. No whips, no glitch.

**Music and sound.** The performance is the audio: no added music, no SFX. Gentle dialogue chain (no heavy
compression, the harmonium and dholak need dynamics). Crowd and bells stay.

**Colour.** `golden-hour` (preset) or `portra` for warm lamp-lit interiors; `indian-wedding` keeps reds and gold rich.
Intensity 0.5-0.7. Do not push saturation on saffron and red: it clips.

**Captions.** Large lyrics, one line at a time, in the regional script (`lyric` element or `captions` with
`preset: "karaoke"`). Optional second line in English or in Latin transliteration (`dual-subs` skin). Fonts must cover
the script: Noto Sans/Serif Devanagari, Tamil, Telugu, Bengali, Gurmukhi, Gujarati, Kannada, Malayalam.

**What the client judges.** Devotional feel, correct script and spelling (matras, conjuncts), that it plays on
WhatsApp, and that elders and the guru look dignified.

**Common mistakes.** Boxes or broken conjuncts from a font without the script; ASR lyrics with spelling errors;
comic sticker effects; cutting the aarti short; status clips over 16 MB; English-only captions for a Hindi audience.

## Check before delivering

- Contact sheet zoomed in: every matra, conjunct and nukta renders (no boxes, no dotted circles), lines not cut off.
- Lyrics match the agreed text word for word; names and honorifics (Shri, Ji, Sant, Guru) exactly as given.
- The full aarti or prayer is intact; no mid-line cuts; deity and guru never cropped.
- Status file under 16 MB and 60 s; plays on a phone; loudness -14 LUFS / -1 dBTP.
- Tell the user the audio rights question was settled (or that it still needs settling) before posting.

---

_Adapté de « regional-devotional », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
