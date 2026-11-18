# Liste face caméra (Presenter listicle)

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** reusable design recipe; no executable template or rendered comparison yet.

## Reference and creative intent

Make each idea easy to remember: presenter establishes the point, a large keyword names it, then a card or screen excerpt supports it. Return to the person between ideas so the film feels spoken rather than like a slideshow.

## Keep / replace

| Keep as a design principle | Replace for this episode |
| --- | --- |
| Face-first framing and clear voice | Presenter footage and actual spoken content |
| Number → concise keyword → supporting example | Point count, order, keywords and evidence |
| One dominant message at a time | Brand type, accent color and cards |
| Short graphic entrances, longer reading holds | Holds fitted to measured speech and text length |

## Editing and motion

Use an intact sentence or clear clause as each point's base. Trim only the repetitions and pauses covered by the editing brief; retain context and natural breaths. Align each number/keyword to the relevant spoken phrase, using measured cues. A brief scale or vertical reveal can introduce the label; settle before the next graphic arrives. Put proof cards between or beside presenter passages, then return to the face. Avoid stacking labels, captions and cards over the mouth or gestures.

For vertical delivery, preview the full 9:16 composition with the destination's UI overlays in mind. Caption placement follows the real frame and face position, not a universal fixed coordinate. Keep captions short enough to read, separate from the larger idea label, and synchronized with the retained recording. Keep the voice clear when adding music or action sounds.

## Input contract and a new brief

Required for a presenter adaptation: the creator's recording; the target topic, language and output format; transcript/timings when supplied, otherwise a declared way to obtain them. Supporting examples and brand kit are conditional on the requested story. Do not substitute the original creator's face or voice into the new episode.

> Use my recording to explain three ways to prepare a product launch. Keep my natural delivery, remove the repeated introduction, add a numbered title for each step and use my screenshots as proof cards. Follow this reference's clear presenter/keyword/card rhythm. Export a vertical version and retain an editable project.

## Review and community handoff

Check each title against the actual sentence, the continuity of every audio cut, the full face safe area, and the reading time of each example. Compare the hook, first point, evidence card and closing beat separately; do not claim identical timecodes when the new speech is longer. Package the approved result with an edit map and actual before/after media, preserving source attribution and asset permissions.

## Provenance

Text from OpenMotion's Presenter Story recipes, Apache-2.0.
---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-presenter-story/references/presenter-listicle/MOTION_DESIGN.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média, les liens vers des vidéos d’autres créateurs retirés. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
