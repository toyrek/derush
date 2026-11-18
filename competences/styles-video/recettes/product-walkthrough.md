# Visite d'un produit, face caméra (Product walkthrough)

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** reusable design recipe; no executable template or rendered comparison yet.

## Reference and creative intent

Start with a relatable problem, show the person using the product, demonstrate the useful result and close with the creator's own conclusion. Motion should make the product action easier to follow.

## Keep / replace

| Keep as a design principle | Replace for this episode |
| --- | --- |
| Hook → demonstration → result → takeaway | Product story, presenter and actual claims |
| Presenter and screen visible together when useful | Camera footage and screen recordings |
| Callouts attached to the relevant action | Text, target positions and brand styling |
| Deliberate switches between face, screen and result | Shot lengths fitted to the new recording |

## Editing and motion

Choose the spoken hook and demonstration before decorating the timeline. Match the callout's entrance to the actual click, result or spoken point, using measured media time. Keep one primary screen region readable; show the presenter in a smaller window only when their reaction or explanation helps. A full-screen face shot can reset attention between dense interface sections.

Anchor labels to the target in the current shot; recompute those positions after reframing. Keep faces and subtitles clear of picture-in-picture borders and screen controls. Use a consistent transition family and reserve stronger motion for major changes in the story. An edited demonstration should show the real product state; illustrative mockups need their own label.

## Input contract and a new brief

Use the creator's presenter take, the actual product screen recording, screenshots of the outcome, approved product facts, target aspect ratio and measured dialogue/caption cues. A brand kit can supply colors and logos. Do not reuse the reference's endorsement, presenter identity or performance claims as the new product's facts.

> Use my camera recording and screen capture to explain how I turn one interview into a short clip. Keep me on screen for the introduction, show the selected timeline range as I describe the edit, highlight the captions and end on the exported result. Make a clear vertical walkthrough with my own words.

## Review and community handoff

Check that each screen state, label and narration agree; verify the product sequence and every cut in normal-speed playback with sound. Compare the reference and new film at the hook, main demonstration, result and close. Share a template only after the new editable project and actual export have been reviewed, with sources, input slots and permitted assets recorded.

## Provenance

Text from OpenMotion's Presenter Story recipes, Apache-2.0.
---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-presenter-story/references/product-walkthrough/MOTION_DESIGN.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média, les liens vers des vidéos d’autres créateurs retirés. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
