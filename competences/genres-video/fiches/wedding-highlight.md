# Film de mariage (Wedding Highlight)

> Wedding highlight editor for Claude: turns a day of wedding footage, photos, vows and speeches into a 3-5 min cinematic highlight film, a 60 s vertical teaser and a ceremony cut, cut on the music with the vows as the story spine. Western weddings, elopements, engagement and anniversary films.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

The couple's day as a 3-5 minute film that makes the family cry at the right moment, plus a teaser they can post this week.

- **Best for:** Western weddings, elopements, civil ceremonies, engagement and anniversary films
- **Inputs:** clips from the day (prep, ceremony, portraits, party), optional photos, the vows/speech audio (camera or lav), one licensed song
- **Formats:** 16:9 highlight (master), 9:16 teaser, 16:9 ceremony
- **Durations:** teaser 30-60 s, highlight 3-5 min, ceremony as it happened (lightly cut)
- **Genre preset:** `--genre wedding-highlight` (see `python CORE/scripts/editor.py genre wedding-highlight`)

## How a pro cuts this

**Structure (highlight, % of length)**

| beat | % | what goes here |
| --- | --- | --- |
| prep / anticipation | 15 | details (rings, dress, invitations), getting ready, nerves, a letter being read |
| first look / arrival | 15 | the reveal, walk down the aisle, the partner's face |
| vows / ceremony | 25 | the vows as the spoken spine, ring exchange, the kiss, recessional |
| speeches | 15 | 2-3 best lines (laugh + tear), cut as soundbites over reactions |
| celebration peak | 20 | entrance, first dance, party at the song's biggest section |
| send-off | 10 | sparklers / exit / last portrait, end on a resolved bar |

**Pacing.** ASL 2-4 s; let emotional shots hold 4-6 s (a tear, a parent's face) and run party shots at 1-2 s.
Visual change at least every 4 s. Vary shot length: never a metronome.

**Cut rules.**
- Story comes from sound: lay the vows and speech lines first (radio edit), then cover with picture.
- Cut on the beat in the party, on the phrase in the ceremony. Keep the breath before an emotional line.
- No visible jump cuts in vows or speeches: cover every join with B-roll of the couple, guests or details.
- J-cut the vows 0.5-1.5 s under the last music shot; L-cut a laugh line over the reaction it caused.
- Never fake a reaction (a guest crying at a different line) and never splice words into vows the person did not say.

**Transition grammar.** Straight cuts on beats by default; one dissolve family for time passing (prep to ceremony),
a dip to black before the send-off. Whip only in the party section. No more than two transition kinds per film.

**Music and sound.** The song leads (bed ~-6 dB), dips under vows and speech (`duck: "speech-aware"`). Cut the song to
length on bar lines (`fitTo: "beats"`) and end on a hit, not a fade. Keep natural sound (cheers, laughter, glasses) under
the music in the party. SFX almost none (a soft whoosh on a whip at most).

**Colour.** `wedding-pastel` (soft, lifted blacks) or `portra` for warm skin; `kodak-2383` for a cinematic feel.
Intensity 0.6-0.8. Match cameras first (`color.match`), skin before look.

**Captions.** None in the highlight. In the teaser and the ceremony cut, vow subtitles with `"preset": "clean"`.
Couple names + date as a `titlecard` or `text` at the open or the end.

**What the client judges.** Emotion, that every important person is in it (parents, grandparents, wedding party),
skin that looks like them, the song, and getting the teaser fast (within days).

**Common mistakes.** Opening on a logo; using every drone shot; music too loud over vows; uncovered jump cuts in
speeches; a missing grandparent; party shots all the same length; a fade-out in the middle of a phrase.

## Check before delivering

- Contact sheet: skin looks natural, horizon level, no guest who asked not to be filmed, names spelled right.
- Watch the vows section with headphones: music dips, every word clear, no click at joins, no uncovered jump cut.
- Every key family member appears at least once (ask the couple for the list and tick it off).
- The film ends on a downbeat, not mid-phrase; `qc.py` passes loudness (-14 LUFS, -1 dBTP) and has no flash frames.
- Tell the couple what is in each file, the song credit, and how many revision rounds remain (two is common).

---

_Adapté de « wedding-highlight », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
