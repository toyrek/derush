# Storyboard animé (Storyboard To Motion)

> Turn an approved static storyboard into a multi-shot motion piece where every shot is its own editable composition that settles exactly on its storyboard frame. Use for product promos and launch films planned frame by frame first.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** product promos, launch films and feature explainers whose frames were approved as stills before animation.

## Look

| Element | Starting value |
| --- | --- |
| Settled frame | The approved storyboard frame itself: same layout, copy and crop |
| Palette | Taken from the storyboard or brand kit; sample: navy `#16223A`, sun yellow `#FFD54A`, paper `#EEF1FA` |
| Type | The storyboard's display face for headlines and one text face for UI and body copy |
| Text | Headlines, numbers and labels stay live text so they can be edited later; never baked into images |

## Motion

- One composition per shot, placed in order. Do not merge the film into one composition.
- Each shot has three phases: enter 0.4–0.8 s, hold the exact storyboard state for at least 1.2 s, exit 0.3–0.5 s.
- Layers enter in reading order: background, headline, product proof, labels, accent; 80–120 ms stagger.
- Use one shared easing family for the whole film (fast-out entrances, ease-in exits).
- The next shot enters already moving in the direction the last one left, so no frame between shots is blank.

## Inputs

Required: the approved storyboard frames (images or HTML), shot order, target length per shot, final copy. Optional: brand fonts, real product screenshots, a music track to time the cuts.

## Avoid

Animating before the stills are approved; simplifying product UI until it no longer explains the feature; idle drift, bounce or random rotation with no job; everything entering at once; an outgoing shot that fades to nothing on its last frame.

## Review

Freeze each hold and compare it to its storyboard frame; scrub every seam ±5 frames for blank or doubled frames; confirm each shot can be opened and edited on its own.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-storyboard-to-motion/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
