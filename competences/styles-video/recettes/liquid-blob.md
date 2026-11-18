# Goutte liquide (Liquid Blob)

> Make a soft product promo where one rounded colour blob splits, stretches, floods the screen and melts into the next scene and finally the app icon. Use for calm consumer apps, planners, wellness and productivity tools.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** friendly app promos where the transitions carry the mood: planners, wellness, finance.

## Look

| Element | Starting value |
| --- | --- |
| Background | Pale blue-white `#EEF3F9` |
| Blob | One saturated colour, e.g. `#2F6BFF`; shapes are circles and squircles merged with a goo filter (blur ≈ 22 px, alpha threshold) |
| End icon | The final squircle takes a two-stop gradient, blue to mint `#2BD4A4` |
| Type | Rounded geometric sans, extra bold, 84–110 px; white on the blob, deep navy `#0D1B33` on the background |
| Layout | Blob centred and large (300–480 px); short lines centred over or under it |

## Motion

- Every scene change is a shape change: the squircle shrinks to a circle, splits into three droplets that stretch apart (900 ms, power3 in-out), then rushes back and merges.
- The merged blob grows to flood the frame (≈ 700 ms) and becomes the background for the next line.
- A secondary white droplet can pull a smaller drop away to illustrate one idea, such as no clashes.
- Finish by draining the colour back into one gradient squircle that springs to size with the wordmark (600 ms, back-out), then a slow squash-and-stretch breath.

## Inputs

Required: app name, 2–4 short lines from the user's messaging, tagline. Optional: app icon to match in the final shape, brand colour, one product screenshot to show on the flooded background.

## Avoid

Several blob colours at once, text on top of a moving blob edge, hard cuts between scenes, sharp corners, sound-effect-heavy bounces.

## Review

Text never sits across a blob edge; merges read as liquid without flicker; the wordmark fits inside the final shape.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-liquid-blob/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
