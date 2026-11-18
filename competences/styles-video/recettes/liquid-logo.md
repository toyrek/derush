# Logo liquide (Liquid Logo)

> Make a logo reveal where glossy liquid drops flow in, merge and settle into the logo mark. Use for drinks, beauty, wellness and any brand with a fluid, friendly feel.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** logo openers and end cards for drinks, beauty, wellness and friendly consumer brands.

## Look

| Element | Starting value |
| --- | --- |
| Background | Deep blue `#06224A` to `#0A3C7A` gradient with soft light rays from the top |
| Liquid | Merging blobs built with an SVG goo filter (blur then alpha threshold); aqua `#3BD2FF` to blue `#1E6BFF` gradient fill; specular highlight on top |
| Mark | The logo as a solid shape that the liquid settles into; must be simple and closed |
| Wordmark | Rounded sans (e.g. Nunito 800) in white |
| Extras | A few floating bubbles at 30–50% opacity |

## Motion

- Drops enter from the frame edges and orbit the centre for 1.5–2.5 s, merging and splitting.
- They pull into the logo shape over 1–1.5 s; the goo filter makes the joins look wet.
- Swap the liquid for the crisp logo with a 300 ms crossfade so the final mark is exact.
- The wordmark rises 20 px and fades in; hold 2 s with a slow shine.

## Inputs

Required: logo (simple SVG shape works best), brand name. Optional: brand colours, tagline. Liquid is drawn in SVG; when the user wants photoreal liquid, generate one test clip through `derush-image` (or ElevenLabs), get it approved before any further generation, and still finish on the exact logo.

## Avoid

Thin or detailed logos that the goo destroys, more than two liquid colours, the liquid still wobbling in the final hold.

## Review

The final logo is the exact supplied shape; blobs never cover the wordmark; motion stays smooth at 30 fps.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-liquid-logo/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
