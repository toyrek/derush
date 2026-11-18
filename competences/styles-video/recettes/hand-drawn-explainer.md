# Dessin animé au trait (Hand-Drawn Explainer)

> Make a narrated explainer in black-and-white line-art cartoon scenes with simple characters, push-ins to the detail that matters and handwritten notes. Use for everyday science, life tips and "why does this happen" questions.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** everyday science, life tips, money and habit explainers narrated without a presenter.

## Look

| Element | Starting value |
| --- | --- |
| Paper | Light warm grey `#E9E9E6`, no texture beyond a faint vignette |
| Line art | Black `#1E1E1E` outlines, 3–5 px, white `#FAFAF7` fills and one or two flat greys `#C9C9C4`; no colour |
| Characters | Round heads, dot eyes, simple bodies; consistent across scenes |
| Notes | Handwritten labels and arrows on the drawing, four words or fewer |
| Captions | Small cream chip `#F7F3E3` with a thin black border at the bottom centre |

## Motion

- Reveal each new scene as a sketch: strokes draw in 0.5 s, staggered 20–40 ms, fills follow.
- Push the camera in to the detail the sentence explains (2–2.5×, 0.8–1 s ease-in-out) and pull back when it is done.
- Write notes left to right in 0.4–0.6 s after their arrow is drawn.
- Keep small acting beats between lines: a blink, a raised arm, a changed mouth.

## Inputs

Required: topic or exact script, target duration, aspect ratio. Optional: voice, existing character art. Scene illustrations and short motion clips are generated through `derush-image` (or ElevenLabs): approve one scene image with a short voice sample first, then the full illustrated preview, then one animated clip, and only then the rest. Label generated characters as generated; do not draw real people.

## Avoid

Colour accents, crowded backgrounds that compete with the subject, notes that state facts the script does not, push-ins on details the narration skips.

## Review

Each scene matches its sentence; characters look the same in every scene; notes are readable at 1× speed; captions never cover the drawn subject.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-hand-drawn-explainer/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
