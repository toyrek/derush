# Essai vidéo (Video Essay)

> Video-essay and documentary-style YouTube editor: script-first, voice-over-led edits with archival footage, B-roll, quote cards, maps, timelines, charts and chapter cards, cut at the pace of an argument (4-8 s shots), filmic grade, sourced on-screen attribution and YouTube chapters.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

An argument told in pictures: VO leads, every visual is evidence, chapters keep the viewer oriented.

- **Best for:** analysis, history, film/media essays, science and culture deep dives
- **Inputs:** the recorded VO (or on-camera narration), archival clips/stills and B-roll in a folder, sources list, optional music
- **Formats:** 16:9 1920x1080 master, chapters text, `captions.srt`; optional 9:16 teaser
- **Duration target:** 10-40 min

## How a pro cuts this

| beat | % | what happens |
| --- | --- | --- |
| cold open | 0-5 | the most intriguing image or question, before any title |
| thesis | 5-10 | what this video argues, in one sentence |
| chapters | 10-85 | 3-6 chapters, each: claim -> evidence (clip/quote/chart) -> implication |
| turn / counter-argument | 85-92 | the strongest objection, answered |
| conclusion | 92-100 | thesis restated as an insight; end on an image, not "thanks for watching" |

- **Pacing:** ASL 4-8 s; a visual change at least every 6 s. Let a key archival moment play 8-12 s with its own sound. Slow down for the emotional chapter, quicken in montage sections.
- **Cut rules:** cut the VO first (radio edit), then picture. Visuals land 0.1 s before the words that need them. Pauses between chapters are allowed (0.6-1 s).
- **J/L cuts:** archival sound up under the end of a VO line (J) so the clip "speaks"; L-cut the VO over the next visual.
- **Transitions:** cut; dip to black or a chapter card between chapters; dissolves for time passing.
- **Music/SFX:** score bed 24-28 LU under VO, changes mood per chapter; drop it for the revelation. SFX almost none (page-turn on cards).
- **Colour:** unify archive and new footage: `documentary-natural` 0.5 or `fuji-eterna` 0.6; archive can stay as is with `sepia` for flashbacks.
- **Captions:** sidecar SRT; on-screen text only for quotes, names, dates and sources.
- **Client judges:** clarity of the argument, research visuals, accuracy, chapters that make sense.
- **Common mistakes:** visuals that decorate instead of prove, unattributed quotes, music wall-to-wall, a 2-minute intro, uncredited clips.

## Check before delivering

- Every claim on screen has a source; every quote is verbatim and in context.
- Chapters valid (first at 0:00, >= 3, each >= 10 s) and match the cards.
- VO intelligible over music everywhere; archive audio levels matched.
- `qc.py` passes; no black frames between cutaways.
- Tell the user: runtime, chapter list, sources used, files.

---

_Adapté de « video-essay », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
