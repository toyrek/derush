# Cartes en vol 3D (Isometric Card Flight)

> Fly real product screenshots as tilted isometric cards through a shallow 3D space, with bold copy on bright colour cards, settling flat on the key screen. Use for software and app promos with rich UI.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** SaaS and app launches where the product UI is the proof: dashboards, calendars, booking flows, editors.

## Look

| Element | Starting value |
| --- | --- |
| Background | Soft sage `#C9DCD2` or the brand's lightest tint |
| Cards | Rounded 24 px cards in 3–4 saturated colours, e.g. coral `#F07A4C`, cobalt `#2F5BEA`, sun `#F4C542`, pink `#EC5C8E`; screenshots on white cards with soft shadow |
| Type | Large lowercase grotesque, 2–3 short lines per card, tight leading |
| Layout | Cards tilted about rotateX 55°, rotateZ -40° in flight; one card at a time owns the frame |

## Motion

- Cards enter from below the frame on an isometric path (700–900 ms, ease-out) with a 120 ms stagger.
- The hero card rotates from tilted to flat and scales up to fill 70–80% of the frame in 600 ms; hold 1–1.5 s.
- Screens stack and fan in depth: each layer 30–60 px apart on z, sliding at slightly different speeds.
- Transitions are card swaps: the current card flies out along the same diagonal as the next one arrives.
- End on a flat logo card with tagline, still for 1.5 s.

## Inputs

Required: 3–5 real UI screenshots from the product, 3 benefit lines, logo and tagline. Optional: brand kit, music. Ask for missing screenshots rather than mocking fake UI.

## Avoid

Fake metrics inside screenshots, steep angles that make UI unreadable on the hero card, more than four card colours, spinning cards.

## Review

Hero screenshot is flat and legible for at least 1 s; card colours repeat consistently; no card corner cropped during its hold; copy readable at 1×.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-isometric-card-flight/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
