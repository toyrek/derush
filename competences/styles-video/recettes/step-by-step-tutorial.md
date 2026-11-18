# Tuto pas à pas (Step By Step Tutorial)

> Turn one product into a short how-to: one close-up per step, a big step number, a short caption and a progress bar. Use for accessories, kitchen tools, skincare and gadgets that need a few clear steps.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** product how-tos with three to five steps.

## Look

| Element | Starting value |
| --- | --- |
| Background | Warm neutral set, `#F1E9DE` wall and `#C9A47E` counter; one product in focus |
| Step badge | Large serif numeral `01`–`05` in `#2A2420` with a small caps label, top left |
| Caption | White pill `#FFFBF5`, one sans font at 32–36 px, the key words in `#C2552F` |
| Progress | One thin segment per step across the top, filling while the step plays |
| Framing | Wide establishing shot, then a tight close-up on the part that matters for each step |

## Motion

- Push in from the wide shot to each step's detail in 500–700 ms with an ease-in-out; hold the close-up while the action happens.
- Each step lasts 2–3 s. The badge rolls up and the next one rolls in (350–400 ms) on the cut.
- Show the action itself changing: a level rising, a number counting, a part clicking in.
- End on the finished result in a wider frame with a small "done" chip.

## Inputs

Required: the product, the real steps in order, and one sentence per step. Optional: brand colours, a voiceover script, own footage.

When no footage exists, generate the close-ups and the finished-result shot through `derush-image` (or ElevenLabs). Approve one test image or clip with the user before generating the rest, and label any generated person as generated.

## Avoid

More than five steps, captions longer than seven words, steps the product cannot actually do, hands or faces that change between shots.

## Review

Steps appear in the real order; each caption can be read twice before the cut; the product looks the same in every close-up; the last frame shows the finished result.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-step-by-step-tutorial/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
