# Cartes photo et texte (Cards And Text)

> Make a two-colour product promo that alternates bold short lines with stacks of duotone photo cards: cards fan in, gather, frame a big number, then line up under the closing line. Use for app launches, offers and feature lists that have a few strong images.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** launches, offers and feature lists backed by 3–5 strong images.

## Look

| Element | Starting value |
| --- | --- |
| Palette | Two tones only: deep maroon `#4B1430` and blush `#F4E4E1`, plus mid tone `#B07A89`; one orange accent `#FF8A3D` for numbers and check badges |
| Cards | Portrait cards 3:4, 24 px radius, deep soft shadow; every image converted to the two-tone duotone; light halftone or stripe texture allowed |
| Type | One tight grotesk, 800 weight, 78–110 px, letter spacing -0.04 em; numbers 200 px in the accent colour |
| Layout | Text on one side, cards on the other; never text on top of a card |
| Background | Maroon to start, blush after a circular wipe; text colour flips with it |

## Motion

- Cards slide in tilted ±10–16° (600 ms, 150 ms stagger); words rise in 120–140 ms apart.
- Change scene with a circular wipe (700 ms) while the cards regroup in the same move.
- For a number, push cards to the corners and count up over ~1 s, ending with one pulse.
- Close with the cards in a single row under the final line, slight alternating tilt; hold at least 1.5 s.

## Inputs

Required: product name, three or four short lines, any real number to feature, and 3–5 images: the user's own photos or product screenshots, or images generated through `derush-image` (or ElevenLabs) after one test image is approved. Label any generated people as generated. Optional: logo, brand colours to replace the two tones.

## Avoid

Full-colour photos next to duotone ones, more than four cards on screen, lines longer than five words, numbers the brief does not supply, text placed over card images.

## Review

Cards read as one two-tone set; lines hold long enough to read twice; the number matches the source; no card clips text.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-cards-and-text/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
