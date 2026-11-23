# Explication sans visage (Faceless Explainer)

> Faceless-channel editor: turns a script (or a recorded voice-over) into a finished explainer with no presenter on camera - offline TTS voice-over (Kokoro / Windows SAPI / say), one visual per sentence (B-roll, photos, charts, maps, kinetic type), heavy word-synced captions and a consistent channel template, in 16:9 and 9:16.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Script in, explainer out: a natural voice-over, a new visual every sentence, captions that carry muted viewers.

- **Best for:** explainers, top-N lists, history/facts, finance or tech breakdowns, article-to-video
- **Inputs:** a script (`script.txt`) or a recorded VO (`voice.wav`), a folder of visuals (clips/photos named after what they show), optional music
- **Formats:** 16:9 1920x1080 master + 9:16 cutdown; `captions.srt`, chapters for long ones
- **Duration target:** 60 s - 15 min; Shorts 30-60 s

## How a pro cuts this

| beat | % | what happens |
| --- | --- | --- |
| hook | 0-5 | the most surprising fact or question, on screen as text, by 2 s |
| promise | 5-10 | what the viewer will know by the end |
| points / chapters | 10-85 | one visual per sentence; a chapter card between sections |
| payoff | 85-95 | the answer, the twist, the number |
| CTA / next | 95-100 | one line + end screen space |

- **Script first:** short sentences (8-16 words), one claim each, numbers written as digits. Read it aloud before generating.
- **Pacing:** a new visual every 2-4 s (one per sentence, two for long ones); text changes every 1.5-3 s in Shorts. Leave 0.3-0.5 s of air between sections (pauses in the script via line breaks).
- **Visual rules:** the visual matches the *words being said* (literal for nouns, metaphor for ideas). Numbers become `counter`/`bars`/`linechart`, places become `map`, lists become `steps`/`checklist`. Never the same stock clip twice.
- **Transitions:** cuts on sentence ends; one soft transition kind (`fade` 0.3 s) between chapters only.
- **Music/SFX:** a bed 20-24 LU under the VO, ducked ("speech-aware"); whoosh on chapter cards, ticks on counters; sparse.
- **Colour:** unify mixed stock with one look: `documentary-natural` 0.5, or `finance-navy` / `cool-corporate` for money/tech.
- **Captions:** preset `boxed` or `clean` (16:9), `hormozi` (9:16); <= 20 cps; key words in accent.
- **Client judges:** audio that doesn't sound robotic, cut density, accuracy, a recognisable template.
- **Common mistakes:** monotone TTS at default speed, visuals unrelated to the words, a 20 s logo intro, wall-to-wall text, music louder than the voice, the same stock clip reused.

## Check before delivering

- Every sentence has a matching visual; no repeats; no visual left on screen > 6 s without motion.
- VO natural (rate, pronunciation of names); captions match the script; numbers and dates verified.
- Music never masks the VO; `qc.py` -14 LUFS / -1 dBTP; no black frames between clips.
- Rights: every clip, photo and track is licensed or the user's own; credits in the description if required (CC BY).
- Tell the user: the voice used, video length, chapter list, file paths.

---

_Adapté de « faceless-explainer », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
