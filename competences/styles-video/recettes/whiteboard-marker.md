# Tableau blanc au feutre (Whiteboard Marker)

> Add hand-written whiteboard graphics to a presenter video: marker keywords in blue and coral, arrows that link ideas as they are said. Use for concept breakdowns and lessons recorded by the creator.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

Use the creator's own recording and measured speech timing. Do not place graphics over someone else's speech, and keep the face and mouth clear.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** concept breakdowns and whiteboard-style lessons over a presenter recording.

## Look

| Element | Starting value |
| --- | --- |
| Board | White `#FAFAF7` with a very light grid or none |
| Ink | Handwritten-style font for keywords; marker blue `#2F6BFF` for ideas, coral `#FF6F59` for the contrast or warning |
| Connectors | Hand-drawn arrows, circles and underlines as SVG paths with slightly irregular strokes |
| Layout | Ideas accumulate on one board; earlier items dim to 40% instead of disappearing |

## Motion

- Animate keywords as if written: SVG stroke-dashoffset or a left-to-right mask, 400–700 ms per word.
- Draw an arrow only when the presenter links two ideas; the arrow finishes before the second idea appears.
- Use coral once per board for the "but" or the mistake.
- End each section on the completed board for 1.5–2 s, then return to the presenter.

## Inputs

Required: presenter recording, transcript with timings, the idea list and how ideas connect. Optional: brand kit colours to replace blue and coral.

## Avoid

Clip-art icons, typed computer fonts for keywords, boards with more than six ideas, arrows that do not match a spoken link.

## Review

Every written word matches the speech; arrows connect the ideas the presenter linked; the final board is legible on a phone screen.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-whiteboard-marker/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
