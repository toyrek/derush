# Voyage sur carte en papier (Paper Map Journey)

> Make a paper-cut map video: a red route drawn between stops with pop-up landmarks and one fact per stop. Use for travel itineraries, destination introductions and expansion stories.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** travel explainers, itineraries, destination introductions and expansion stories (offices, stores, launches).

## Look

| Element | Starting value |
| --- | --- |
| Map | Cream paper base `#F3EEDF`, mint paper terrain `#BFE3D0`, water in pale blue; layered cut-paper edges with soft shadows |
| Route | One red line `#D7263D`, dashed while travelling, solid once completed |
| Stops | Paper-cut landmark or photo cutout per stop, with a small label tag |
| Type | Clean sans for place names; a bigger number for day or stop order |

## Motion

- Open on the whole country or region, then zoom to the first stop (1–1.5 s ease-in-out).
- Draw the route between stops along an SVG path; the camera follows the line head.
- At each stop, pop the landmark up from the map like a pop-up book (300 ms), hold 2–4 s with one fact.
- Close by pulling back to show the full completed route.

## Inputs

Required: place list in order, one fact per stop, aspect ratio. Optional: photos, narration. Map outlines must come from an open dataset with its licence recorded; do not trace copyrighted maps.

## Avoid

Wrong geography or invented borders, more than five stops in 30 seconds, labels that overlap the route.

## Review

Stop order and positions are geographically correct; each label is readable; the route never jumps; the map data source and licence are recorded.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-paper-map-journey/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
