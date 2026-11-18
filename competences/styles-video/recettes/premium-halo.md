# Halo premium (Premium Halo)

> Make a high-end product promo on deep blue: a comet draws a glowing halo around the headline, the halo tilts into a light floor, the product rises into it and frosted glass spec chips orbit in. Use for premium hardware, wearables, audio and flagship app launches.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** premium hardware, wearables and flagship launches.

## Look

| Element | Starting value |
| --- | --- |
| Background | Radial deep blue: `#12306E` centre to `#040A20` edges |
| Halo | Cyan `#5CE1FF` ring, 8–10 px stroke with a strong glow, comet head in white-to-cyan, faint full-circle guide at 12% |
| Product | Centred, 70–75% of frame height, soft cyan rim glow, slow light sweep |
| Type | One clean geometric sans; 60–70 px headline with one cyan phrase; wordmark 40–46 px with 0.4 em letter spacing |
| Chips | Frosted glass cards (white 5–16% fill, 12 px blur, 1 px cyan edge), 30 px title and 18 px detail |

## Motion

- The comet starts drawing the halo at frame 0 and closes the ring in about 1.7 s, then keeps orbiting.
- Headline lines de-blur and rise inside the ring (600 ms, 300 ms stagger); the ring pulses once when it closes.
- The ring tilts into a flattened floor ellipse below the product (1 s power3) while the product rises 260 px into place (1.1 s), then floats a few pixels.
- Spec chips arrive from their corners (550 ms, 220 ms stagger) and drift ±8 px; the wordmark tightens in from wide spacing.

## Inputs

Required: product name, a two-part headline, three or four real specs with short details, a product shot or clean render from the user. If no product image exists, generate one through `derush-image` (or ElevenLabs) after one test image is approved. Optional: brand accent to replace cyan, launch date the user confirms.

## Avoid

More than four chips, chips covering the product, warm or neon accents next to the cyan, spec numbers not on the official spec sheet, fast spins of the product.

## Review

Specs match the source; chips never overlap the product; the halo is visible in every frame.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-premium-halo/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
