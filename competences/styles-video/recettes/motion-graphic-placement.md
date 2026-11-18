# Où mettre les animations (Motion Graphic Placement)

> Plan where motion graphics go in a talking video: tie each graphic to a line that earns it, such as a number, a list or a quote, match the graphic type to that line and keep face and captions clear. Use for talking-head, lecture, tutorial and podcast edits.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

Use the creator's own recording and measured speech timing. Do not place graphics over someone else's speech, and keep the face and mouth clear.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** talking-head, lecture, tutorial, interview and podcast videos that need graphics placed with intent.

## Look

| Element | Starting value |
| --- | --- |
| Number card | Saturated blue `#1F3BFF`, white figures, before → after |
| Steps card | White card, numbered blue dots, one short line per step |
| Quote card | Charcoal `#15171C`, serif quote, amber `#FFC53D` on the key words |
| Position | Opposite the face; above the caption zone; one card family for the whole video |

## Motion

- Each graphic lands on its trigger word (±3 frames) and enters in 300–400 ms.
- Hold at least twice the reading time; exit before the next trigger.
- Density: one meaningful graphic every 5–8 s in landscape, every 3–5 s in vertical; tighter in the first 15 s.
- Match type to the line: number → counter, steps → list, choice → split card, opinion → quote, name → lower third, call to action → button card.
- After a full-screen graphic, leave at least 1.5 s before the next one.

## Inputs

Required: the creator's recording, a word-timed transcript, the aspect ratio. Optional: brand style, existing graphics to reuse. Write the plan (trigger word, timecode, type, position) before building.

## Avoid

Graphics on a timer; the same form twice in a row unless it is a deliberate series; covering face, hands, product or captions; full-screen takeovers where a card is enough; illustrating filler words.

## Review

Every graphic in the plan has a trigger word and timecode; check the frame at each one for overlap; nothing appears before its line is spoken.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-motion-graphic-placement/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
