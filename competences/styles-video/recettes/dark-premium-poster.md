# Affiche noire premium (Dark Premium Poster)

> Animate a dark premium product poster: near-black stage, one spotlight, slow reveal of the product with a light sweep and refined condensed type. Use for perfume, drinks, audio gear and launch teasers that should feel expensive.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** premium launches, limited editions and teasers for perfume, spirits, sparkling drinks, headphones and watches.

## Look

| Element | Starting value |
| --- | --- |
| Stage | Near-black `#0B0B0F` with a soft spotlight pool, `#2A2A33` at the centre; faint film grain at 4% |
| Product | Centre or slightly right, 55–70% of the frame height, rim light on one edge, reflection on a dark floor |
| Accent | One metal or brand tone only, e.g. warm gold `#C9A45C` or violet `#7B4DFF` |
| Type | Large condensed caps for the name, wide-tracked small caps (letter-spacing 0.25–0.35 em) for details |
| Details | Two or three thin spec lines in the corners, hairline rules at 30% white |

## Motion

- Open in darkness; the spotlight fades up over 800–1200 ms to reveal the product.
- A diagonal light sweep crosses the product once in 700–900 ms.
- The product rises 10–20 px or rotates ≤8°, slow and eased (power2), never bouncy.
- Name letters fade in with tracking tightening from 0.5 em to 0.3 em over 1 s; spec lines follow.

## Inputs

Required: a clean photo or cut-out of the real product, product name, the exact detail lines. Optional: accent colour, release date, edition number.

Backgrounds, smoke or reflections that the photo lacks are generated through `derush-image` (or ElevenLabs). Approve one test still first; keep the user's product pixels for the product itself.

## Avoid

Glows on every element, more than one accent colour, fast cuts, busy backgrounds, crushed blacks that hide the product edge.

## Review

The product silhouette stays readable against black; one light sweep only; type is aligned to one grid; small caps are at least 18 px at 720p.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-dark-premium-poster/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
