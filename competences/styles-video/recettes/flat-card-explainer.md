# Cartes d'interface (Flat Card Explainer)

> Make a SaaS explainer from flat UI cards: scattered windows show the problem, a cursor tidies them, a simple board shows the product working. Use for workflow, task and collaboration tools.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** showing how a SaaS product works in 3–4 steps without screen recordings.

## Look

| Element | Starting value |
| --- | --- |
| Background | Very light grey `#F2F2F6` with a white centre glow |
| Cards | Flat white windows with an indigo `#5458E8` title bar, yellow `#F7C744` text bars and pink `#F0507A` blocks; radius 8 px, soft drop shadow |
| Type | Geometric sans in italics for captions (500, 54–60 px) with the key words in extra bold indigo or pink |
| UI | Simplified boards, lists and avatars rebuilt from the user's product; real labels, no lorem ipsum |
| Cursor | Dark arrow cursor with a white outline that performs every action |

## Motion

- Problem: 6–8 cards pop in across the frame (60 ms stagger) and drift slowly.
- Gather: the cursor arrives and the cards fly into one neat stack (600 ms each, power3 in-out, 50 ms stagger).
- Show: the stack opens into the product view; the cursor drags one item to its next state in ~700 ms and a check mark pops.
- Close: the view scales away and the call to action rises with a hand-drawn underline drawn in 500 ms.

## Inputs

Required: product name, the 3–4 workflow steps, real board or list labels, call to action. Optional: screenshots to copy the layout from, brand colours.

## Avoid

Pixel-perfect UI with tiny unreadable text, more than one cursor action per step, captions longer than six words, invented customer numbers.

## Review

Card labels are readable at 1×; the cursor reaches each target before acting; captions never overlap cards.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-flat-card-explainer/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
