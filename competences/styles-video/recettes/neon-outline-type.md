# Néon (Neon Outline Type)

> Make a dark kinetic-type promo where outlined words glow, fill letter by letter and sit inside nested light frames. Use for hardware, gaming, audio and performance claims that need a bold short tagline.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** hardware teasers, gaming gear, audio products and any promo built on two or three punchy words per beat.

## Look

| Element | Starting value |
| --- | --- |
| Background | Near-black `#0C0A10`, a faint vignette, no texture |
| Outline | 2 px stroke in amber `#FF8A3D` with a soft glow (blur 8–14 px, 60% opacity) |
| Fill | Warm white `#FFF6EC` for filled letters; one optional hot accent `#FF3D7F` for a closing rule |
| Type | Heavy condensed or grotesk caps, 120–180 px, 1–3 words per line, max 3 lines |
| Frames | 2–4 nested rectangles or chevrons in the outline colour, 1.5 px, around the word block |

## Motion

- Each word enters as outline only, drawn with a stroke-dash sweep in 400–600 ms.
- Letters fill left to right with a 40–60 ms stagger, as if switched on; add one flicker (2 frames off) on the first fill.
- Frames scale out from the text block in a 120 ms stagger and settle with a slight overshoot.
- Change beats every 1.5–2 s: frames rotate into chevrons or collapse to a single line that carries the next word in.
- Close on a thin accent line that hands off to the logo.

## Inputs

Required: product name, a tagline split into 2–4 short beats, logo. Optional: one spec number, brand accent colour.

## Avoid

Glow on body copy, more than one accent colour per beat, lines longer than three words, outlines thinner than 1.5 px at 1080p, flicker loops.

## Review

Every beat is readable when fully filled for at least 600 ms; glow never merges letters; frames never cross the text; the logo holds for 1.5 s at the end.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-neon-outline-type/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
