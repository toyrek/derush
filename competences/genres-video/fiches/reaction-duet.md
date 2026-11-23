# Réaction, duo, stitch (Reaction Duet)

> Reaction / duet / stitch editor: combines a source clip with the creator's facecam reaction in a picture-in-picture, split-screen or stitch layout, keeps the two in sync, ducks the source audio under the reactor's voice, freezes or zooms on the moment being reacted to, and delivers a 9:16 short with captions and an on-screen credit.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Source on one side, you on the other, perfectly in sync, the source politely ducking whenever you talk.

- **Best for:** reactions, commentary, duets, stitches, "expert reacts", breakdowns of someone else's clip
- **Inputs:** the source clip (`source.mp4`, yours to use or used under fair use with commentary), the facecam recording made while watching it, the source offset (where in the source your recording starts)
- **Formats:** 9:16 1080x1920 with captions; `captions.srt`
- **Duration target:** 15-60 s Shorts, up to 3 min

## How a pro cuts this

| beat | % | what happens |
| --- | --- | --- |
| hook | 0-10 | the most surprising moment of the source + your strongest reaction, in the first 1.5 s |
| context | 10-20 | who / what this is, one line, credit on screen |
| source + reactions | 20-80 | play the source; pause (freeze) or zoom where you talk over it |
| verdict | 80-95 | your take: the value you add |
| CTA | last 2 s | follow / part 2 |

- **Sync is sacred:** do NOT run autocut on a reaction (`--no-cut`); every removed pause would desync your face from the source. Cut only whole sections with `--cut` ranges and move the source the same amount (a new clip element with its own `clipOffset`).
- **Pacing:** ASL 2-4 s; a change every 3 s: zoom on the source detail, freeze-frame + callout, a punch-in on your face.
- **Audio:** source audio plays as a bed ducked ~10 dB whenever you speak (the plan `music` block does this); your voice leads.
- **Transitions:** cuts only; flash on the reveal moment at most once.
- **Colour:** correct the facecam only (`color` affects the speaker video); leave the source as is.
- **Captions:** your words only (the source can carry its own), preset `boxed` or `hormozi`, in the band between the two panes.
- **Client judges:** is the reaction genuine, does the commentary add value, hold rate.
- **Common mistakes:** drifting sync, source louder than the reactor, no credit, reacting with nothing to say, captions over the source's own subtitles.

## Check before delivering

- Lips and the source stay in sync at the start, middle and end (compare 3 stills).
- Reactor always intelligible; source audible in gaps; no clipping (`qc.py` -14 LUFS / -1 dBTP).
- Credit on screen the whole time; commentary present in every section.
- Captions don't cover the source's own text or the face.
- Tell the user: layout, offset used, length, file paths, and the rights caveat.

---

_Adapté de « reaction-duet », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
