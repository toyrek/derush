# Dessins au tableau blanc (Whiteboard Doodle Explainer)

> Make a narrated whiteboard-doodle explainer: simple line drawings drawn in sync with the voice and a camera that pans along one long board. Use for lessons and step-by-step processes.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** lessons, step-by-step processes and concept explainers narrated without a presenter.

## Look

| Element | Starting value |
| --- | --- |
| Board | Clean white, no frame |
| Drawings | Simple black line doodles (SVG paths, 3–4 px stroke), one flat accent colour for the focus object |
| Text | Handwritten-style labels, five words or fewer |
| Layout | One idea per board; boards connect left to right like a long whiteboard |

## Motion

- Draw each doodle along its path in sync with narration (0.6–1.5 s per object), labels written after the object.
- Pan the camera to the next empty area of the board instead of cutting; the board history stays visible.
- Use the accent fill only when the narration names the key object.
- Finish with a pull-back showing the whole board as the summary.

## Inputs

Required: topic or script, target duration. Optional: voice, brand accent colour. Approve the first board and a voice sample before producing the rest.

## Avoid

Detailed illustrations, more than one accent colour, drawing that starts before the narration mentions it, a hand prop that covers the drawing.

## Review

Each drawing matches its sentence; pans never lose the reader; the final pull-back is legible; total text per board stays at or under five words.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-whiteboard-doodle/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
