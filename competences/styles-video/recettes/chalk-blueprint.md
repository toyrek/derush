# Plan à la craie (Chalk Blueprint)

> Sketch the product in thin chalk-white lines on a dark blue grid, then light the key parts in cyan and resolve to the logo. Use for developer tools, APIs and technical product promos.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** developer tools, APIs, infrastructure and planning apps where structure and precision are the story.

## Look

| Element | Starting value |
| --- | --- |
| Background | Deep blueprint `#13202E` with a faint chalk-dust texture and a 40 px grid at 8% white |
| Lines | 1.5–2 px chalk white `#DCE6EF`, construction circles and diagonals, small node dots |
| Accent | Cyan `#3AA0F0` for the active path, node and the second half of the wordmark |
| Type | Thin geometric sans, light weight, wide tracking; short lines typed on beside the drawing |

## Motion

- Lines draw on with stroke-dash animation, 400–900 ms per shape, construction lines first and the final shape last.
- Nodes pop in (120 ms) where lines meet; one path at a time turns cyan to show flow.
- The camera drifts slowly across a tiled pattern of the drawing (≤20 px/s) between beats.
- Captions type on at 25–35 characters per second next to the shape they describe.
- End: the drawing clears, the wordmark draws on, an underline extends, tagline types; hold 1.5 s.

## Inputs

Required: product name, 2–4 short lines on what it does, the UI or architecture to sketch (screenshots or a diagram). Optional: brand kit accent colour.

## Avoid

Filled shapes or gradients, more than one accent colour, drawing every UI detail, fast camera moves.

## Review

Every line reads on a phone screen; cyan marks only the active part; captions sit clear of lines; drawing matches the real product structure.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-chalk-blueprint/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
