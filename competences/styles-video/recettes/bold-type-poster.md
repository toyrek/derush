# Affiche au mot géant (Bold Type Poster)

> Make a promotion poster built on one oversized word or number with the product overlapping it, plus a matching 3–6 second animated version. Use for launches, offers and benefit highlights.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** promotions, launches and benefit highlights, delivered as a still poster plus a 3–6 s animated version.

## Look

| Element | Starting value |
| --- | --- |
| Type | One oversized word or number filling 50–70% of the frame (condensed sans, heavy weight); one supporting line; small details |
| Product | One product photo or cutout overlapping the big type to create depth |
| Colour | Two flat colours plus black or white; the user's brand colours when supplied |
| Hierarchy | Big word → product → one line → small print. Nothing else |

## Motion (animated version)

- Big word enters by mask reveal or scale-down from 110% (400–600 ms, firm ease-out).
- Product slides in 100–200 ms later and settles on top of the type.
- Supporting line and small print fade in last; hold the full poster at least 2 s.
- Export the final frame as the still poster so both versions match.

## Inputs

Required: the exact copy (big word or number, supporting line), product image or brief, size and aspect ratio. Use the user's copy verbatim.

## Avoid

More than three type sizes, discount numbers or claims the user did not provide, text over the product's key detail.

## Review

Copy is exact; the big word is legible as a phone thumbnail; still and animated final frames are identical.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-bold-type-poster/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
