# Logo en verre liquide (Liquid Glass Logo)

> Make a 4 second logo reveal where a glossy glass app icon ripples into focus, then slides aside for the wordmark. Use for app openers, end cards and launch teasers.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** app openers, end cards and launch teasers that need a premium 3–5 s logo moment.

## Look

| Element | Starting value |
| --- | --- |
| Background | Pure black `#000000` or very dark grey |
| Glass tile | Rounded square (22% corner radius), translucent fill, white inner highlight, iridescent rim from cyan `#6FE3FF` through violet `#A98BFF` to warm `#FFD38A` |
| Mark | The user's logo inside the tile, white, slightly refracted while the glass moves |
| Wordmark | Rounded geometric sans (e.g. Unbounded 600) in white |
| Glow | Soft outer glow at 20–30% under the tile |

## Motion

- 0–1.2 s: the tile grows from 80% with a ripple distortion that settles to zero.
- 1.2–2 s: one specular streak sweeps across the glass in 600 ms.
- 2–3 s: the tile shrinks and slides left; the wordmark resolves from a brief colour-fringed blur (≤250 ms).
- 3–4 s: hold the lockup clean; a slow sheen may pass again on longer versions.

## Inputs

Required: logo (SVG or transparent PNG), wordmark text. Optional: brand colours for the rim, tagline.

## Avoid

Distorting the logo in the final hold, rainbow rims on the wordmark, glass tiles with no contrast against the background.

## Review

The final lockup matches the supplied logo exactly; distortion is zero by the hold; the lockup reads at small size.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-liquid-glass-logo/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
