# Extraits tirés d’un long (Clip Miner Pro)

> Professional clip-mining editor: finds the 5-15 strongest stand-alone moments in a long recording (podcast, interview, livestream, webinar, talk), checks each one makes sense without the episode, trims it to clean sentence boundaries, reframes 16:9 to 9:16 on the speaker's face, adds a hook title, captions and a CTA back to the full episode.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Mines a long recording for clips that stand on their own, then cuts each one like a short-form editor.

- **Best for:** podcasts, interviews, webinars, livestreams, keynotes, long YouTube videos
- **Inputs:** one long video (16:9 or 9:16), the episode title for the CTA
- **Formats:** 9:16 1080x1920 per clip (captioned + clean), `captions.srt` per clip
- **Duration target:** 20-60 s per clip (30-90 s for podcast stories); 5-15 clips

## How a pro cuts this

**What makes a clip:** it starts on a hook sentence (claim, number, question, contrast, story start), it has one idea, and it ends on a payoff line. Somebody who never saw the episode must understand it. Reject clips that need earlier context ("as I said", "that's why he...").

| beat | % | what happens |
| --- | --- | --- |
| hook | 0-10 | first spoken sentence is the hook; hook title on screen 0-2.5 s |
| context | 10-20 | only the minimum needed to follow |
| story / value | 20-85 | the moment itself, trimmed of tangents |
| payoff | 85-95 | the line that lands |
| CTA | last 2 s | "full episode: <title>" |

- **Pacing:** ASL 2-4 s; a punch-in or reframe change every 2.5-3 s on a single wide speaker; keep the speaker's rhythm (podcasts breathe more than reels).
- **Cut rules:** start and end on whole sentences only. Remove tangents inside the clip with `--cut` ranges, keep breaths. Never splice two unrelated sentences into a new claim (Frankenbite) - if you must join lines from different parts, tell the user and keep the meaning.
- **Two speakers:** `--reframe 9:16` follows the active speaker; for a conversation where both react, `track.py reframe --layout stack2` puts them top and bottom.
- **Transitions:** cut. Punch-ins hide jump cuts. No flashy transitions on serious topics.
- **Music/SFX:** usually none, or a very low bed (24 LU under). One pop on the hook title, nothing on every word.
- **Colour:** keep the episode's look; correct only. `clean-commercial` 0.5 if the source is flat.
- **Captions:** preset `hormozi` or `boxed`, 2-3 words, <= 17 cps, `dodgeFace: true`; name the speaker with a `lowerthird` the first time.
- **Client judges:** does each clip stand alone, hook strength, watch-through, clicks back to the episode.
- **Common mistakes:** clips that start mid-thought, inside jokes that need context, 90 s rambles, captions over the face, clips that all sound the same (vary topics and emotion).

## Check before delivering

- Every clip makes sense to a stranger; starts on a hook sentence, ends on a payoff, no mid-word starts.
- Face stays in frame after the reframe (scrub the contact sheet at 4-5 points per clip).
- No constructed quotes; speaker names and titles correct.
- Captions inside the 9:16 safe zone and clear of the face; <= 17 cps.
- `qc.py` passes (-14 LUFS, -1 dBTP, length under the platform limit).
- Tell the user: each clip's source time range, hook, length and file path.

---

_Adapté de « clip-miner-pro », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
