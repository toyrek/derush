# Machine à sous (Split Slot Type)

> Cut words into slices that slide apart and reassemble, and spin a slot-machine column to swap one benefit word at a time. Use for product promos that rotate through features, audiences or use cases.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** promos that keep one fixed phrase and swap the last word ("Back up your photos / notes / code"), or a headline that breaks to reveal the next.

## Look

| Element | Starting value |
| --- | --- |
| Background | Deep night `#0A1018`, flat, no texture |
| Type | Rounded geometric heavy sans; white `#F2F5F8` for the fixed phrase, mint `#2FD6A3` for the word that lands |
| Slot window | Fixed word baseline; neighbours above and below dimmed to 35% and clipped by a soft mask |
| Layout | One line centred, or left-aligned phrase plus slot column; end card logo with a one-line tagline |

## Motion

- Split: the word is cut into 3–5 horizontal slices that shoot apart sideways with motion blur (300–400 ms) and lock back into the next word.
- Slot: the column spins with accelerating then decelerating easing (600–900 ms), overshoots 4–6 px and settles; the landed word turns mint.
- Hold each landed word 700–1000 ms before the next spin.
- Optional scatter: letters fly out as loose glyphs and regroup into the logo (≤1 s).

## Inputs

Required: the fixed phrase, 3–6 swap words of similar length, brand name and tagline. Optional: brand kit colours, music tempo for spin timing.

## Avoid

Swap words that differ wildly in length, spins with no hold, more than one accent colour, slicing the logo.

## Review

Landed word sits exactly on the baseline; every swap word readable for at least 0.7 s; slices never leave gaps in the final word; mask hides neighbours cleanly.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-split-slot-type/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
