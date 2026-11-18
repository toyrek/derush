# Coins de visée (Corner Frames)

> Make a clean tech promo where four corner brackets glide from target to target: headline, product card, key number, logo. Use for developer tools, analytics and other technical SaaS.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** technical promos that point at one thing at a time: a dashboard, a metric, the logo.

## Look

| Element | Starting value |
| --- | --- |
| Background | Deep navy `#0A1220` with a faint 40 px grid at 6% opacity |
| Brackets | Four L-shaped corners, 46 px arms, 4 px stroke, cyan `#5BE0E6`; a small mono label (`TARGET 01`, metric name) rides above the top-left corner |
| Type | Grotesk sans for headlines (700, 90–110 px); mono for labels and small data, tracked +12% |
| Accent | One signal colour, lime `#B8F25C`, used only for live states and the key change |
| Product | Dark UI card `#101C2E` with a 1 px border, chart line in the bracket colour |

## Motion

- Brackets start at the screen corners and slide in to frame the first headline (700 ms, expo in-out), each corner 30 ms after the last.
- Every new beat moves the same four brackets to the next target instead of cutting; the label text swaps halfway through the move.
- Zoom the product card 1.2× toward the key metric while the brackets tighten around it; count the number to its value over ~1 s.
- A soft scan line crosses the frame every few seconds; on the end card the corners flash the accent colour twice.

## Inputs

Required: product name, logo, 1–2 headline lines, one real metric with unit and source, a UI screenshot to rebuild. Optional: brand colours, call to action.

## Avoid

Framing more than one thing at once, metrics without a source, brackets drifting off the target, glow effects everywhere, more than one accent colour.

## Review

Brackets enclose each target with even padding; no text sits under a corner; the key number is legible for at least one second.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-corner-frames/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
