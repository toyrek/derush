# Article illustré (Article Illustrations)

> Turn the key ideas of an article into hand-drawn line-illustration cards with a small mascot and handwritten captions. Use for blog posts, newsletters and method write-ups that need a short visual summary.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** blog posts, newsletters and method articles where 2–5 ideas need one picture each.

## Look

| Element | Starting value |
| --- | --- |
| Card | White 16:9 card on a warm grey desk `#E9E6DF`, 14 px radius, soft shadow; one idea per card |
| Line | Black `#1E1E1E` 5 px round strokes with a slight hand-drawn wobble; few fills |
| Accent | At most two accents per card: orange-red `#E4572E`, blue `#2F6DB5`, light blue fill `#CFE3F7` |
| Mascot | A round outlined character with dot eyes and an orange scarf, doing the idea, not watching it |
| Type | Handwritten captions (Caveat) 42–54 px; a small spaced sans header with the article title and figure count |

## Motion

- Draw the main line in 0.8–1.3 s, then let the mascot act it out (climb, push, carry) over 2–3 s.
- Write captions left to right in 0.8–0.9 s; the second caption arrives once the action makes the point.
- Slide cards like a carousel: out left and in from the right over 500 ms, slightly rotated.
- Small payoffs (a flag, a growing shape) pop with a 400 ms overshoot.

## Inputs

Required: the article text, the 2–5 ideas to illustrate, the article title. Optional: brand colours, a mascot the user owns. Everything is drawn in code; no generated media is required.

## Avoid

Infographic clutter, stock icons, more than one sentence of caption, numbers not in the article (or computed and stated plainly, like 1.01^365 ≈ 38), copying another illustrator's character.

## Review

Each card states one idea from the article; captions match its wording or meaning; the mascot is part of the action; nothing touches the card edge during the slide.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-article-illustrations/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
