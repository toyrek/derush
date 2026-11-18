# Affiche pop couleurs (Color Pop Poster)

> Animate a colour-pop promo poster: two high-contrast saturated colours, a huge headline that slams in, the product in the centre and callout arrows. Use for sales, drinks, snacks and launch promos that need to stop the scroll.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** promotions, flavour launches, seasonal offers and any product post that needs one loud message.

## Look

| Element | Starting value |
| --- | --- |
| Colours | Two clashing brights plus white, e.g. cobalt `#1D3FE0` and tangerine `#FF7A1A` on off-white `#F7F3EA` |
| Headline | Heavy rounded or grotesque sans, 2–3 words, 140–200 px at 720p, tight leading 0.9 |
| Product | Centre-bottom, 50–65% of the frame height, slight shadow, rays or circles behind it |
| Callouts | Hand-drawn-style arrows with 2–3 word labels in the accent colour |
| Footer | Small offer line and call to action in caps |

## Motion

- The headline slams in word by word, scale 1.3 → 1.0 in 180–250 ms with a short 2–4 px shake.
- Background rays or rings spin slowly (20–30° over the shot) or pulse once on the beat.
- The product pops up from the bottom with a 6% overshoot, 400 ms.
- Callout arrows draw on in 300 ms each, then their labels type in; offer line lands last.

## Inputs

Required: product photo, the exact headline, offer or price if any. Optional: 1–3 callout facts, brand colours, call to action.

Missing product cut-outs or props (fruit slices, ice) are generated through `derush-image` (or ElevenLabs); approve one test image before generating the rest. Use the real product photo for the product itself.

## Avoid

More than two bright colours, headline longer than one line per word group, fake discounts, rays so busy the product disappears.

## Review

The headline reads in under one second; the colour pair passes contrast for every text block; callouts point at real features; the final frame holds 1.5 s.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-color-pop-poster/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
