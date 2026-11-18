# Avant / après (Before and After)

> Make a before-and-after product video: show the problem, the product being used, then the visible result with a split wipe and clear labels. Use for cleaning, beauty, haircare, tools and fix-it products.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** products whose value is a visible change — stains removed, frizz calmed, scratches filled, rooms tidied.

## Look

| Element | Starting value |
| --- | --- |
| Frames | Same subject, same angle, same light for before and after; vertical or horizontal split |
| Labels | Small caps pills: `BEFORE` in slate `#5B6573`, `AFTER` in fresh green `#18B26B`, white text |
| Divider | 4 px white line with a round handle, soft shadow |
| Product | A clean product shot between the two halves or in the corner, 20–30% of the frame |
| Type | One plain bold sans for a 3–6 word result line |

## Motion

- Hold the before for 1–1.5 s so the problem is clear.
- Show the product in use for 1.5–2.5 s (pour, spray, brush, wipe).
- The divider wipes across in 900–1200 ms, revealing the after; a short sparkle or tick marks the end.
- End on the after with the product and the result line, held 1.5 s.

## Inputs

Required: the real product, a true description of the result. Optional: the user's own before and after footage, presenter, timing claim.

When the user has no footage, the before, use and after shots are generated through `derush-image` (or ElevenLabs) from the product photo. Approve one test clip first, then generate the rest with the same subject and lighting. Generated people and results are labelled as generated; never present them as a real customer.

## Avoid

Changing angle, light or subject between before and after, exaggerated results, invented time claims, beauty filters on the after only.

## Review

Before and after match framing within 5%; the change shown is the one the product claims; labels never cover the change; generated content is labelled.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-before-after/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
