# Mots orange bruts (Orange Unfiltered)

> Stamp grainy orange keywords straight onto a presenter video: heavy uppercase words typed in letter by letter around the face, with no boxes or panels. Use for fitness tips, hot takes and outdoor vlogs recorded by the creator.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

Use the creator's own recording and measured speech timing. Do not place graphics over someone else's speech, and keep the face and mouth clear.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** fitness and sport tips, quick opinions and walk-and-talk vlogs where the keyword is the whole graphic.

## Look

| Element | Starting value |
| --- | --- |
| Words | Heavy geometric sans, uppercase, tight tracking; 90–160 px on a 1080 p frame |
| Colour | Orange `#FF6A13` with fine film grain inside the letters; no outline, a very soft shadow for contrast |
| Placement | Corners and the sky or ground around the presenter; never across eyes or mouth |
| Everything else | No boxes, bars, icons or panels. One or two words on screen at a time |

## Motion

- Type each word letter by letter, 35–50 ms per letter, each letter popping from 115% to 100%.
- Stack a second word under the first only when it finishes the phrase; it starts after the first word completes.
- Cut words off hard on the next beat; no fade-outs longer than 100 ms.
- Contrast pairs ("slow" / "fast") use opposite corners so the eye travels.

## Inputs

Required: the presenter's recording, measured speech timing, the keywords exactly as spoken. Optional: one number worth stamping (a pace, a percentage, a count).

## Avoid

Full sentences, words that were not said, more than two words at once, other colours, text crossing the face, slow fades.

## Review

Every word matches the speech and appears on its spoken syllable (±2 frames); grain is visible but letters stay sharp; words clear the face; nothing stays on screen after its beat.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-orange-unfiltered/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
