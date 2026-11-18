# Pixels deux couleurs (One Bit Dither)

> Make a two-colour product promo where pixel-grid dither patterns assemble into shapes, product UI and headline cards. Use for developer tools, infrastructure and SaaS launches that want a crisp technical feel.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** software launches, API and infrastructure products, changelog teasers and feature promos with 3–5 short claims.

## Look

| Element | Starting value |
| --- | --- |
| Palette | Exactly two inks: deep navy `#0F1830` and warm paper `#F5F1E8`. One small accent (`#FF4F6D`) only on the logo mark |
| Texture | Ordered 4×4 dither on a canvas, 6–10 px cells; 40–80 px checker blocks for transitions |
| Type | One grotesk sans, 600 weight, tight leading (1.0), set on solid navy or paper cards so it never sits on noise |
| Layout | Full-frame dither field, one headline card, product UI shown as a dithered thumbnail inside a hard-edged frame |

## Motion

- Fields resolve from sparse dots to full pattern by raising the dither threshold over 600–900 ms; never blur.
- Shapes (rings, waves, a product screenshot) form from noise in 1–1.5 s, then hold still for at least 1 s.
- Scene changes use a checkerboard wipe: blocks flip in a diagonal stagger of 20–30 ms per block, about 500 ms in total.
- Headline cards pop in with a 2-frame offset glitch, then stay perfectly still while read.

## Inputs

Required: product name and logo, 3–5 claims taken from the product's own site, one real UI screenshot to dither. Optional: a customer quote with attribution, a URL for the end card.

## Avoid

More than two inks in the dither, text placed over moving noise, smooth gradients, dithering the logo itself, claims the site does not make.

## Review

Every headline reads on a solid card; no frame is pure noise for more than 1 s; the screenshot is still recognisable after dithering; end card shows name and URL for at least 1.5 s.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-one-bit-dither/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
