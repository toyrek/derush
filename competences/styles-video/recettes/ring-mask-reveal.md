# Formes qui dévoilent (Ring Mask Reveal)

> Make a flat geometric promo where circles, pills and bars act as masks that open, overlap and carry words between scenes. Use for modular or design-led SaaS products that want a clean, playful brand film.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** design tools, builders, modular products and brand intros with a three-word idea (for example "plan, build, ship").

## Look

| Element | Starting value |
| --- | --- |
| Palette | Ink `#24183F`, orange `#FF8A3D`, sky `#7CC4FF`, paper `#EEF0F6`; flat fills only |
| Shapes | Circles, rounded pills and full-height bars; overlaps change colour where two shapes cross |
| Type | One tight sans, 600–700 weight; words sit inside a shape and are clipped by it |
| Layout | Shapes fill most of the frame; a small logo stays top right on every scene |

## Motion

- Circles expand from points to full size in 500–700 ms with a soft overshoot, revealing the word inside.
- Three circles slide together and morph into three vertical bars (700 ms), each carrying one word.
- A bar widens to fill the frame and becomes the next background; that is the scene cut, no fades.
- Text is masked, never faded: it slides through the shape edge and is clipped by it (300–400 ms).
- End on one circle closing onto the logo, held 1.5 s.

## Inputs

Required: product name, logo, one headline and three short words or phrases that describe what it does. Optional: brand colours (keep to four), a one-line closing claim.

## Avoid

Gradients, drop shadows, more than four colours, words split across two shapes for longer than a transition, linear easing.

## Review

Each word is fully inside its shape when it holds; every scene cut comes from a shape growing, not a crossfade; text never touches the frame edge; logo is legible at the end.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-ring-mask-reveal/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
