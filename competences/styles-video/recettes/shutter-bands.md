# Bandes de volet (Shutter Bands)

> Make a bold typographic promo where horizontal colour bands slide across like a shutter to switch between scenes of big condensed words. Use for brand launches, service promos and short social teasers.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** punchy promos built from a few strong words, a promise and a logo.

## Look

| Element | Starting value |
| --- | --- |
| Palette | Three flat colours: navy `#0E1A2B`, ivory `#F2EEE6`, one loud accent such as orange `#FF5A1F` |
| Type | A tall condensed display face in caps for single words (180–220 px); a heavy grotesk for sentences (130–150 px) |
| Bands | Six equal horizontal strips covering the frame, each a single flat colour |
| Rows | Scenes are built from three full-width rows, alternating dark and light, each holding one word or one short phrase |
| End card | Logo and one plain tagline on navy |

## Motion

- Opening rows carry marquee words that drift sideways at a steady pace, alternate rows moving in opposite directions.
- Shutter transition: bands slide in from alternating sides in 300–350 ms with 30–40 ms stagger, the scene swaps underneath, then the bands exit to the opposite side.
- Inside a scene, each row slides in on its own (450 ms, expo out) so the sentence builds row by row.
- Hold every scene 1.2–1.8 s; use a slow 3–4% scale push on held text so it never freezes.

## Inputs

Required: brand name, 3–6 short words or phrases from the user's own messaging, logo, tagline. Optional: one real proof point (e.g. an on-time rate) with its source, brand colours.

## Avoid

More than three colours, words over eight letters in condensed rows, invented stats, more than four shutters in 15 s.

## Review

Every held word is fully on screen; bands cover the frame completely before each swap; one accent element per scene.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-shutter-bands/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
