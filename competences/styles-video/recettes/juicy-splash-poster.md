# Affiche juteuse (Juicy Splash Poster)

> Create a juicy splash product poster: liquid bursts around a drink or food pack, fruit pieces fly out, drops freeze mid-air and the flavour name lands. Use for drinks, juices, sauces and snack flavour launches.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** beverages, juices, dairy, sauces and snack flavour launches where freshness is the selling point.

## Look

| Element | Starting value |
| --- | --- |
| Backdrop | Clean gradient in the flavour colour, e.g. mango `#FFB347` to `#FF7B2C`, light at the top |
| Splash | Glossy liquid crown or wave around the product, highlights at 70% white, edges sharp |
| Ingredients | 3–6 real fruit or ingredient pieces flying outward, sharp in front, blurred behind |
| Product | Centre, 55–70% of the frame height, cold drops on the surface |
| Type | Bold rounded sans for the flavour name in white with a soft shadow; one small detail line |

## Motion

- The splash erupts from behind the product in 400–600 ms, then slows almost to a freeze (time-ramp).
- Ingredients fly out on arcs at different depths and spin slowly while frozen.
- Drops trail down the product continuously, 1–2 px per frame.
- The flavour name scales up with a small bounce once the splash peaks; a gentle push-in of 4% runs underneath.

## Inputs

Required: product photo, flavour or product name, the real ingredients. Optional: volume, tagline, call to action.

Splash and ingredient elements are generated through `derush-image` (or ElevenLabs), or drawn as vector shapes for a graphic look. Approve one test still or clip first. Show only ingredients the product actually contains; keep the user's product photo for the pack.

## Avoid

Liquid that covers the label, ingredients the product does not contain, muddy colours mixing two flavours, endless chaos with no settled frame.

## Review

The label is readable at the peak; liquid colour matches the flavour; every ingredient is true; the final 1.5 s holds still.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-juicy-splash-poster/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
