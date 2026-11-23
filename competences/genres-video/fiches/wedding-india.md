# Mariage indien (Wedding India)

> Indian wedding film editor for Claude: sorts multi-day footage by event (Haldi, Mehndi, Sangeet, baraat, pheras or Nikah, vidaai, reception) and cuts a 3-7 min cinematic highlight, per-event 9:16 reels, a fast teaser and a long traditional film, with respectful ritual pacing and titles in Devanagari, Tamil, Gujarati or other Indic scripts.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Several days, five or six functions, hundreds of relatives: one film per event, one highlight that carries the whole

- **Best for:** Hindu, Sikh, Muslim, Jain and mixed Indian weddings; destination weddings; engagement (roka, sagai)
- **Inputs:** footage per function (ideally one folder per event), photos, the couple's song choices, mantra / vow audio
- **Formats:** 16:9 highlight and full film, 9:16 per-event reels and teaser
- **Durations:** teaser 30-60 s (within days), per-event reel 30-90 s, highlight 3-7 min, traditional film 1-3 h
- **Genre preset:** `--genre wedding-india` (`python CORE/scripts/editor.py genre wedding-india`)

## How a pro cuts this

**Highlight structure (% of length)**

| beat | % | what goes here |
| --- | --- | --- |
| haldi | 12 | turmeric close-ups, laughter, water / flowers thrown |
| mehndi | 12 | henna detail macros, the groom's name hidden in the design, dholki |
| sangeet | 18 | family performances, the couple's dance, peak energy on the drop |
| baraat / arrival | 12 | horse or car, dhol, dancing relatives, the varmala |
| pheras / nikah | 26 | the ritual heart: agni, mantras, the seven rounds, sindoor, mangalsutra; or qubool hai and the nikahnama |
| vidaai / reception | 20 | the emotional goodbye, then the stage, cake, the last dance |

Per-event reel: open on the strongest image of that event, 3-4 beats of build, end on a family moment. Same skin and
grade for every event so the set looks like one wedding.

**Ritual pacing.** Ceremonies are repetitive but sacred. Never cut the seven pheras into seven 1-second flashes: show
the first round in full (or most of it), dissolve through the middle rounds, hold the last round and the reaction.
Let a mantra or the qubool hai play with the music dipped right down, or none. Hold the sindoor and mangalsutra moments 3-5 s. Cut the
celebrations on the beat (ASL 1.5-3.5 s), the rituals on the phrase (4-8 s holds).

**Cut rules.** No jump cuts inside a ritual; cover with a different angle or a detail (hands, fire, flowers). Never
place a laughing face over a crying vidaai moment (Kuleshov). Never reorder a ritual: the family knows the order.
Every elder on the list appears at least once, ideally in a clean close-up.

**Transition grammar.** Cuts on the beat for haldi, mehndi, sangeet, baraat; slow dissolves (0.8-1.2 s) inside pheras
and vidaai; dip to black between events in the long film. Whip only in sangeet / baraat.

**Music and sound.** A different licensed song per event is normal; the highlight can carry two songs joined on a
downbeat. Song leads (bed ~-6 dB) and dips fully for mantras, vows and the vidaai. Keep natural dhol and crowd sound.

**Colour.** `indian-wedding` (warm gold, rich reds, skin kept natural) at 0.6-0.75; never push reds so far the bridal
lehenga clips. Haldi yellow should look yellow, not orange skin.

**Titles and captions.** Event names as titles in the family's script (हल्दी, मेहंदी, संगीत, फेरे; or Tamil, Gujarati...).
No creator captions in the highlight. Mantra translation subtitles only if the family asks.

**What the client judges.** Every elder present, ritual respect, colour of the outfits, the sangeet energy, the teaser
arriving within days.

**Common mistakes.** One assembly for all events; pheras rushed; a missing grandparent; orange skin from haldi; music
over the mantras; misspelled names in the regional script; boxes instead of letters (font without that script).

## Check before delivering

- Contact sheet: the regional script renders with correct conjuncts and matras (no boxes, no broken ि placement).
  If it is wrong, the font lacks the script: fix `fontsUrl`.
- Every elder on the family's list ticked off; names in both scripts spelled as the family wrote them.
- Pheras / Nikah: rituals in the correct order, mantras audible, no music over them, no rushed rounds.
- Skin natural under haldi yellow and stage lights; reds not clipping. `qc.py` passes loudness and flash checks.
- Tell the family what each file is, which events are done, and how many correction rounds remain (often 2).

---

_Adapté de « wedding-india », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
