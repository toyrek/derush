# Papier découpé animé (Paper Stop Motion)

> Explain how something works with flat cut-paper pieces, sticky notes and red marker notes, moved frame by frame. Use for science, engineering and how-it-works explainers.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** how-it-works topics (flight, weather, machines) explained in one or two scenes.

## Look

| Element | Starting value |
| --- | --- |
| Cut-outs | Flat paper shapes with a 6 px white border and a hard offset shadow `5px 7px` at 25% navy |
| Palette | Sky paper `#7EC3E6`, cream clouds `#F4EBD8`, red `#E8503A`, teal `#2E8FA3`, grass `#7DB65B` |
| Notes | Yellow `#FFE77A` and mint `#9FE0C8` sticky notes with tape, handwritten font (Caveat); red marker text `#D7322B` (Permanent Marker) |
| Labels | A torn cream title strip top left; a dark readout tag top right for one measured value |

## Motion

- Move every piece on twos (12 poses per second) with a 1–2 px jitter so it feels shot by hand.
- Show the mechanism with marker strokes drawn in 600–900 ms (arrows, squiggles), then let the object act.
- Move the world, not the camera: background pieces slide past at different speeds while the hero stays near centre.
- Slap notes on with a 400 ms overshoot; write marker text left to right in about 900 ms.

## Inputs

Required: the topic and the 2–3 steps of the explanation, any measured values to show. Optional: narration, music, reference photos. Generated pieces go through `derush-image` (or ElevenLabs); one test paper still or clip is approved before batch generation. Label generated people as generated. Most pieces can be drawn in code instead.

## Avoid

Smooth tweens, gradients inside pieces, values not in the brief, marker text that crosses an arrow or a note.

## Review

Readout values come from the brief; notes and marker text never overlap; the hero stays fully in frame while the world moves; each step is on screen while it is narrated.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-paper-stop-motion/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
