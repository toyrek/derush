# Autocollants qui rebondissent (Sticker Bounce)

> Make a playful promo where benefits arrive as die-cut stickers with white borders and offset shadows that bounce, stack and wobble. Use for creator tools, social apps and consumer products with short, upbeat claims.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** creator and social apps, consumer launches, feature lists with 3–4 short benefits and upbeat ads for short-form feeds.

## Look

| Element | Starting value |
| --- | --- |
| Background | Flat sky blue `#93D0FF` (or one brand pastel) |
| Stickers | Shapes with a 6–10 px white border, 3 px navy `#121A3A` outline and a hard navy offset shadow (6–10 px down-right) |
| Colours | White, orange `#FF7A1A` and navy only on stickers |
| Type | Rounded heavy sans (800–900 weight), navy, short lowercase lines; the hero word in caps as its own sticker |
| Shapes | Star burst, arrow, blob hand, speech bubble, heart; 2–4 on screen |

## Motion

- Each sticker pops: scale 0 → 112% → 96% → 100% with a slight rotation (±6°), 350–450 ms.
- Stickers arrive in a 120–200 ms stagger, layered so later ones overlap earlier ones.
- Held stickers wobble gently (±2° over 1.2 s) so the frame never feels frozen.
- Benefit lines stack one per beat, each with a little drop-in of 20 px.
- Exit by peeling: a sticker scales to 0 with a quick tilt in 200 ms; end on the logo as one big sticker.

## Inputs

Required: product name, logo, 3–4 benefits of 2–3 words each, a one-line closing claim. Optional: brand pastel and accent, shapes that fit the product (hands, stars, arrows).

## Avoid

Soft blurred shadows, gradients, more than three sticker colours, stickers covering text, bounce on every element at once.

## Review

Every benefit line is readable for 1 s; stickers never cover each other's text; outline and shadow offsets are identical on every sticker; logo sticker holds 1.5 s.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-sticker-bounce/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
