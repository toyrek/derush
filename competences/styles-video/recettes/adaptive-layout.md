# Mise en page adaptable (Adaptive Layout)

> Make a product promo where one set of selling points re-flows between desktop, tablet and phone layouts on a dark grid, after a stretched-type opener. Use for design systems, responsive tools, multi-platform apps and any product that promises to fit every screen.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** responsive tools, design systems and multi-platform apps.

## Look

| Element | Starting value |
| --- | --- |
| Background | Deep navy `#0D1330` with a faint 40 px blueprint grid in sky blue at 6% opacity |
| Accent | Sky `#5CC8FF` for the lead card and highlights, amber `#FFB547` for icon tiles; everything else white or `#1B2556` |
| Type | One heavy grotesk (800 weight), 120–140 px for the opener, 34–54 px card titles, 19–22 px card lines |
| Frame | A thin rounded outline (2 px sky at 55%) that stands for the device; radius grows as the frame narrows (28 → 44 px) |
| Cards | Three cards with the same title, line and small visual in every layout; the first card is the filled lead card |

## Motion

- Opener: the headline snaps out of a light streak (scaleX 2.4 → 1, scaleY 0.08 → 1, 550 ms, expo-out).
- Layout changes are a single 700 ms power3-in-out move of the frame and all cards together, cards staggered by 50 ms. Never cut between layouts.
- Each layout holds 1.2–1.6 s with a short side label (Desktop / Tablet / Phone) fading in after the move settles.
- Close by collapsing the cards into the logo mark (500 ms), logo and tagline pop in with a small overshoot.

## Inputs

Required: product name, three selling points with one line each, a tagline. Optional: logo, brand colours, real UI crops for the card visuals, supported breakpoints.

## Avoid

Changing the wording between layouts, more than three cards, text that reflows mid-move into overlap, decorative device mockups that hide the cards, invented platform support.

## Review

Same three points, same order, in every layout; no text clips during a move; each layout readable for 1 s+; labels name only supported platforms.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-adaptive-layout/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
