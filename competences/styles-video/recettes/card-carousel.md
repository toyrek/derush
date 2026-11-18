# Carrousel de cartes (Card Carousel)

> Slide a row of bright benefit cards sideways like a carousel, each card one colour, one icon or object and two or three words. Use for product promos that list features, plans or use cases.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** feature round-ups, plan comparisons and "what you can do" promos with 4–8 short points.

## Look

| Element | Starting value |
| --- | --- |
| Background | Near-black `#0B0D14` stage |
| Cards | Portrait cards 3:4, radius 20 px, solid colours that rotate: tangerine `#F2643A`, violet `#5B4BF0`, mint `#1FA67A`, magenta `#E0459B` |
| Type | White bold sans, 2–4 words per card, set large; a small brand mark in one corner |
| Object | One glossy illustrated object or icon per card, centred, with soft highlight |

## Motion

- The row glides left continuously at a steady speed (one card width per 0.8–1.2 s) with gentle ease at start and end.
- The card crossing centre scales to 1.08 and lifts its shadow; others stay at 0.94.
- Each card's object turns or bobs slightly (≤8°) while centred.
- Words on the centre card stagger in by word, 80 ms apart.
- End: the row slows, the centre card expands to the end card with logo and tagline in 500 ms.

## Inputs

Required: 4–8 benefit phrases, brand name, tagline. Optional: icons or object images; glossy objects are generated through `derush-image` (or ElevenLabs) after one test image is approved. brand kit colours replace the defaults.

## Avoid

Paragraphs on cards, jittery speed changes, more than four card colours, cards that repeat within one screen width.

## Review

Centre card always fully inside the frame; each card readable while centred; colours alternate without neighbours matching; motion speed steady.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-card-carousel/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
