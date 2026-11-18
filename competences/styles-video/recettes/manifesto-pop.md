# Manifeste pop (Manifesto Pop)

> Make a manifesto-style promo: blurred pop-art dots on warm paper, then heavy stacked words building toward the product reveal. Use for brand launches and problem-to-solution teasers.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** launch teasers that argue a point in big words: problem, turn, product.

## Look

| Element | Starting value |
| --- | --- |
| Paper | Warm off-white `#F3EFE6` with a fine dot grain at ~35% |
| Pop dots | Large soft circles in a teal-to-mustard gradient (`#0F6E6E` → `#E9A126`), blurred ~14 px, laid out on a grid |
| Type | Ultra-black geometric sans (weight 900), tight tracking, line height 0.9; 90–120 px for lines, 200+ px for the one number |
| Accent | Teal for the number or list highlight, mustard for the turning phrase; gradient fill only on the product name |
| Props | Oversized curly braces in the gradient to hold a list; a thin ring behind the logo |

## Motion

- Dots pulse from the centre outward, then pour into one big dot that carries the first short line (≈ 600 ms).
- Manifesto lines build word by word every 100–120 ms with a back-out pop (300 ms).
- Braces slide in from the centre and clamp the list; list items drop in one by one, then the braces open and leave.
- The turning line arrives with its accent words; the product name pops in last with the ring drawing around it.

## Inputs

Required: product name, a 3–5 line manifesto from the user (problem → turn → product), any real number used. Optional: logo mark, brand colours to replace teal and mustard.

## Avoid

Full sentences longer than eight words, more than one number, decorative fonts, mixing gradient fills across many words, invented statistics.

## Review

Each line keeps ≥ 60 px margins; the number is real and sourced; the product name is the last thing on screen.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-manifesto-pop/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
