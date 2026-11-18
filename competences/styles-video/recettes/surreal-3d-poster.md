# Affiche 3D surréaliste (Surreal 3D Poster)

> Build a surreal 3D product poster: the product stands in a soft sculptural world of tubes, arches or floating forms in one muted palette, with oversized thin type behind it. Use for beauty, wellness and design-led product launches.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** beauty, wellness and design-led products that sell on mood rather than specs.

## Look

| Element | Starting value |
| --- | --- |
| World | Smooth clay-like forms — looping tubes, arches, spheres, steps — in one tone, e.g. stone `#D9D3C7` with shadows `#B8B0A2` |
| Light | Large soft key from the top left, gentle ambient occlusion, no hard specular spots |
| Product | Centre, 45–60% of the frame height, standing on or inside a form, crisp and true to the photo |
| Type | Oversized thin sans or serif word behind the product, `#FFFFFF` or a tone 10% lighter than the world; small script or caps tagline |
| Icons | Up to four thin line icons with two-word labels near the bottom |

## Motion

- Forms drift and rotate slowly (5–10° over the whole shot), each on its own sine timing; nothing snaps.
- The product rises from behind a form or a sphere rolls aside to reveal it, 900–1200 ms, ease in-out.
- The big word scales from 1.08 to 1.0 behind the product over 2 s, so depth reads.
- Icons fade up last, 120 ms apart.

## Inputs

Required: a cut-out photo of the real product, product name, a one-line tagline. Optional: up to four benefit labels, palette.

The sculptural world is generated through `derush-image` (or ElevenLabs). Approve one test still first. Composite the user's product photo on top; never regenerate the product itself.

## Avoid

More than two hues, glossy plastic look, forms crossing the product label, physics-breaking speed.

## Review

The world reads as one material; the label is sharp; the big word sits behind the product; motion is slow enough to loop.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-surreal-3d-poster/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
