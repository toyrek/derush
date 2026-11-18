# Révélation à la lumière (Relight Reveal)

> Reveal a product in a dark scene with sweeping light beams and a final full relight, with short lines of type between passes. Use for premium hardware, security and night-mode product promos.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** premium hardware, audio, security and "see what was hidden" product promos of 6–15 s.

## Look

| Element | Starting value |
| --- | --- |
| Background | Near black `#05080D` with a faint cool vignette |
| Light | One soft beam in warm amber `#FFB547` or the brand colour, 120–220 px wide with a heavy blur; a hot white core at 60% |
| Product | Product still or cutout, mostly in shadow; only the area under the beam is lit, plus a thin rim light |
| Type | Condensed bold sans (e.g. Barlow Condensed 700) in off-white `#EEF4F8`, 2–6 words per line |
| Relight | One moment where the whole frame floods with the beam colour and the product is fully lit |

## Motion

- Open on darkness with the beam already moving; it crosses the product in 1.2–1.8 s and lights only what it touches.
- A second pass comes from the opposite side, 0.3 s after a line of type fades up.
- Build to the relight: two beams cross, then the frame floods in 250–400 ms and holds 1–1.5 s.
- Drop back to dark for the logo lockup with a slow 3 s shimmer across the mark.

## Inputs

Required: product image (cutout preferred) or a brief, logo, 2–3 copy lines in the user's words. Optional: brand colour for the beam. When there is no product image, generate one still through `derush-image` (or ElevenLabs) on a plain dark background, get the test image approved before any batch generation, and keep the product shape exact.

## Avoid

Lighting the whole product before the relight, more than one beam colour, strobing faster than three flashes per second, text sitting on the beam's hot core.

## Review

Product shape and logo are unaltered; every line of type is readable against both dark and flooded frames; flashes stay within photosensitivity limits.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-relight-reveal/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
