# Feutrine animée (Felt Stop Motion)

> Make warm handmade felt scenes with stitched edges, cosy props and stop-motion wobble. Use for gentle brand spots, seasonal greetings and small product stories.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** cosy brand moments, seasonal greetings and small product stories for cafés, shops and makers.

## Look

| Element | Starting value |
| --- | --- |
| Material | Wool felt: fuzzy edges, fibre texture, dashed cream stitching `#FFF4E2` 6–9 px inside each shape, soft drop shadows |
| Palette | Dusty rose wall `#E7B49B`, teal `#3E8E8A`, tomato `#C8553D`, mustard `#F2D27A`, wood `#9A6A47` |
| Props | Rounded household objects with simple happy faces; one hero object and one partner object per scene |
| Type | A rounded sans (Fredoka or similar) on stitched felt banners and badges |

## Motion

- Hold every pose for 1/12 s and add a 1–2 px wobble between poses, as if hand-placed.
- Enter with a hop (one or two bounces over 900 ms), then do one clear action: pour, wrap, open.
- Draw yarn lines (pour, steam, ribbon) as growing strokes over 500–1200 ms.
- End on a small payoff shape, such as steam that curls into a heart, held for 1 s.

## Inputs

Required: the brand or occasion, the one action to show, the line of copy. Optional: a product photo, brand colours, music. Generated pieces go through `derush-image` (or ElevenLabs); one test image or clip is approved before batch generation. Label generated people as generated. Simple prop scenes can be built from code shapes instead.

## Avoid

Shiny or plastic materials, more than two moving props, real logos drawn in felt without permission, copy that promises what the brand does not offer.

## Review

Text banners are never covered by a moving prop; the wobble stays under 2 px so text stays readable; the action reads in one viewing; the payoff is on screen for at least 1 s.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-felt-stop-motion/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
