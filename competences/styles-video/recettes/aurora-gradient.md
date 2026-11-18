# Aurore (Aurora Gradient)

> Make a SaaS hero film on a dark ground with slow, glowing aurora blobs, a short headline and a product dashboard that tilts into view. Use for app and dashboard launches that want a premium landing-page feel.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** SaaS launches, dashboard or analytics products, feature announcements and the first 10 s of a product page video.

## Look

| Element | Starting value |
| --- | --- |
| Background | Deep plum-black `#0B0610` |
| Aurora | 2–3 large blurred blobs (blur 80–140 px): magenta `#E8459A`, amber `#FFB547`, optional violet `#7A4DFF` |
| Type | Clean geometric sans, 600 weight, 80–110 px white headline, max 5 words, subtle soft shadow |
| UI | Real product dashboard on a white rounded card (radius 16–20 px), large soft shadow |
| Logo | Gradient app tile plus wordmark on a white rounded square or circle |

## Motion

- Blobs drift slowly and continuously (one loop per 6–10 s), never pausing; they are the only always-moving layer.
- Headline arrives word by word: fade up 24 px with blur clearing, 350 ms each, 120 ms apart.
- Logo tile grows from a dot into a rounded square or circle in 500 ms, then shrinks away.
- Dashboard enters as a 3D tilted card (rotateY 30–40°) that turns flat over 900 ms with a soft settle.
- One cursor click (150 ms press) closes the film.

## Inputs

Required: product name, logo, a headline of 2–5 words, one real dashboard screenshot. Optional: brand gradient colours, one metric shown in the UI (taken from the product, not invented).

## Avoid

Fast blob motion, more than three blob colours, invented metrics in the UI, text over the brightest blob without contrast, generic stock UI.

## Review

Headline contrast holds over every blob position; the dashboard is legible when flat; motion never stops completely before the last 1 s.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-aurora-gradient/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
