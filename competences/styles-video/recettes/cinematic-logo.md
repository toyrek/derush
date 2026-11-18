# Logo de cinéma (Cinematic Logo)

> Reveal a logo like a film studio ident: dark set, warm light rays, drifting dust, a metallic mark drawn in light and a slow camera pull. Use for channel intros, brand openers and premium launch stings.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** brand openers, channel intros, end idents and premium launch stings where the logo is the whole shot.

## Look

| Element | Starting value |
| --- | --- |
| Set | Near-black navy `#0A0B12` with a soft radial lift behind the mark; optional 2.39:1 letterbox bars |
| Light | Warm volumetric rays `#FFD696` at 15–20% opacity, one horizontal lens streak in cool `#AAD2FF` |
| Mark | The supplied logo as vector, filled with a brushed metal gradient (gold `#D9A75A` or steel `#C9D1D9`) and a soft glow |
| Type | Wordmark in a wide geometric sans, tracked 0.4em; tagline smaller, muted, tracked wider |
| Texture | 40–80 dust motes at three depths, far ones blurred; light vignette |

## Motion

- Open on light already in frame: rays and dust are visible from frame one, never a black start.
- Draw the logo outline in light over 1.2–1.8 s, then fill with metal in 0.6 s while the outline fades.
- Fire one lens streak and glint as the fill lands (300 ms in, 900 ms out), then sweep a highlight across the mark in 1.1 s.
- Resolve the wordmark letter by letter from blur (120 ms stagger), add the tagline 1 s later.
- The camera eases from 110% to 100% across the whole shot; hold the final lock-up at least 2 s.

## Inputs

Required: the logo as SVG or a clean transparent PNG, the exact brand name. Optional: tagline, brand colours, preferred metal (gold, steel, copper), duration (5–10 s).

## Avoid

Redrawing or restyling the logo's shape, more than one streak or flare, spinning or flipping the mark in 3D, glow so strong the edges blur, text that the brand did not supply.

## Review

The logo geometry matches the supplied file exactly; frame 0.5 s already shows light; the wordmark is sharp and readable for the final 2 s; no element is clipped by the letterbox.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-cinematic-logo/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
