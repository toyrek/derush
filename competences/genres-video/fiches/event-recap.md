# Retour en images d’un événement (Event Recap)

> Event recap editor for Claude: turns conference, launch, meetup, festival, workshop or party footage into a 60-120 s beat-cut recap with speaker soundbites, sponsor visibility and a 9:16 version, plus short speaker clips.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Ninety seconds that make people who missed it wish they had come, and make the sponsors happy they paid.

- **Best for:** conferences, product launches, meetups, workshops, festivals, brand activations, corporate offsites
- **Inputs:** a folder of event clips (venue, crowd, stage, speakers), 2-4 speaker soundbites, logo, licensed track
- **Formats:** 16:9 recap, 9:16 recap, 9:16 speaker clips
- **Durations:** recap 60-120 s (vertical 30-60 s), speaker clips 15-45 s
- **Genre preset:** `--genre event-recap` (`python CORE/scripts/editor.py genre event-recap`)

## How a pro cuts this

**Structure (% of length)**

| beat | % | what goes here |
| --- | --- | --- |
| energy open | 15 | the best 3-4 shots: crowd peak, stage lights, applause; title hit on the drop |
| arrival / venue | 15 | doors, badges, signage, wide of the room filling up |
| speakers + soundbites | 35 | 2-3 short lines (5-8 s each) that say what the event was about, J-cut under crowd shots |
| crowd / moments | 20 | networking, laughter, demos, hands-on, sponsor booths |
| logo + next date | 15 | logo, "See you in 2027", URL / date |

**Pacing.** ASL 1-3 s on the music; soundbites slow it down (hold the speaker 2-4 s, then cut to the room while they keep
talking). Visual change at least every 4 s. Vary: three quick shots, one long one.

**Cut rules.** Cut on beats, change every 2nd or 4th beat, not every beat. A soundbite is a complete thought: cut after the
word decays, never mid-sentence. J-cut the speaker's voice 0.5-1 s under the previous crowd shot; L-cut it over a reaction.
Show it looked full: wides of a full room; never a wide of empty chairs.

**Transition grammar.** Cuts on the beat; whips between sections (one direction); a speed ramp into the title; a dip to
black before the logo. Pick two at most.

**Music and sound.** The track leads (bed ~-12 dB), dips 8 dB under soundbites, keeps crowd cheers and applause
breathing underneath. One impact on the title hit, one whoosh per whip; nothing else.

**Colour.** `punchy` or `clean-commercial` for corporate, `music-video-neon` for parties and festivals,
`teal-orange-pro` for a cinematic recap. Match stage and hall cameras first.

**Captions.** None on the montage. Speaker soundbites get a `lowerthird` (name, role) and, for the vertical version,
`clean` captions for the soundbite only.

**What the client judges.** Energy, sponsor logos visible, that it looks well attended, speakers looking good, the
next-date CTA.

**Common mistakes.** Opening on the logo; long speeches; every shot the same length; sponsors missing; music fading out
mid-phrase; empty-room shots; uncredited speakers.

## Check before delivering

- Contact sheet: titles and lower thirds inside safe zones, speaker names spelled as on the programme, logos sharp.
- Sponsors on the list each visible; no empty-room shots; no opted-out attendees.
- Soundbites complete and intelligible over the music; the track ends on a downbeat (`endButton`).
- `qc.py` passes loudness (-14 LUFS, -1 dBTP), black / flash frames and (for stage strobes) photosensitivity.
- Tell the client the music credit, which sponsors appear where, and the file list.

---

_Adapté de « event-recap », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
