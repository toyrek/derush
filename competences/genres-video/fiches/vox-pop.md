# Micro-trottoir (Vox Pop)

> Vox-pop and street-interview editor: puts the question on screen, then many short answers grouped by intent (yes / no / surprising / funny), each trimmed to its strongest sentence, joined with quick J-cuts, name and location supers, and a closing answer that lands - in 16:9 and 9:16.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

One question, many voices, grouped so the range of opinion becomes a story.

- **Best for:** street interviews, event/campus questions, brand "what do you think" pieces, social Q&A series
- **Inputs:** interview clips (one per person is easiest), the question, first names / locations people agreed to show, release forms
- **Formats:** 16:9 1920x1080 master + 9:16 cutdown; `captions.srt` (street audio: captions matter)
- **Duration target:** 45 s - 4 min

## How a pro cuts this

| beat | % | what happens |
| --- | --- | --- |
| question card | 0-6 | the question on screen (and asked aloud once) |
| group A | 6-36 | answers with one intent (e.g. "yes"), fastest and clearest first |
| group B | 36-66 | the contrasting intent |
| surprise / outlier | 66-86 | the unexpected or funniest answer |
| closing answer | 86-100 | the line that sums it up or makes people comment |

- **Pacing:** each answer 2-5 s (one sentence); ASL 2-5 s; runs of 3-4 rapid one-word answers are great.
- **Cut rules:** start each answer on its first meaningful word (drop "um, well, I guess"); end on the strong word. Keep the person's real tone.
- **J/L cuts:** the next person's first word 0.1-0.3 s under the end of the previous face (J) keeps it rolling; group changes get a hard cut or a question card.
- **Transitions:** cuts; whip only between locations if the series uses it.
- **Music/SFX:** light bed 26 LU under, ducked; a `pop` on the question card; no laugh effects.
- **Colour:** street footage varies: auto-correct each clip, `documentary-natural` 0.4.
- **Captions:** always (noisy street audio) - preset `boxed` (9:16) or `clean` (16:9); names via supers.
- **Client judges:** range of voices, pace, fairness, readable captions.
- **Common mistakes:** all answers the same intent, long answers, captions missing on wind-blown audio, names wrong, cutting someone into saying the opposite.

## Check before delivering

- Every answer answers the question shown and keeps its meaning.
- Names and places correct; nobody shown who declined.
- Captions on every answer, synced; audio intelligible over street noise.
- `qc.py` passes; tell the user: number of answers used, grouping, files.

---

_Adapté de « vox-pop », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
