# Démo d'outils, face caméra (Workflow demonstration)

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** reusable design recipe; no executable template or rendered comparison yet.

## Reference and creative intent

Let the viewer understand both the person and the workflow: show the speaker for intent, the screen for evidence, and a short motion card for the takeaway. Each insert should answer the sentence immediately around it.

## Keep / replace

| Keep as a design principle | Replace for this episode |
| --- | --- |
| Presenter → tool detail → presenter cadence | Creator, workflow, narration and tool footage |
| Quiet captions and restrained emphasis | Actual words, logo, colors and screenshots |
| Clean transition from face to full-screen evidence | Insert content and its required reading time |
| Consistent card treatment and visual hierarchy | Brand assets and screen framing |

## Editing and motion

Build the spoken explanation first. Map every retained range from source in/out to output time; derive caption and insert positions from that map. A screen recording may cover an edit while the voice continues, but it must illustrate the retained thought. Keep full-screen inserts long enough to understand one action or one document excerpt. Use the presenter's return to separate sections instead of adding an unrelated transition at every cut.

Give each insert one focal target. A small zoom, cursor highlight or framed screenshot can direct attention; preserve the rest of the screen when it provides context. Avoid turning static screenshots into fake working UI. When reframing a landscape screen inside a vertical video, test text readability and choose a useful detail or picture-in-picture layout rather than squeezing the entire desktop into a narrow strip.

## Input contract and a new brief

Use the creator's presenter take, actual screen recording or screenshots, an intended sequence of steps, target format and measured speech timing. Existing material takes priority over generating replacements. Voice and background music are independent tracks; do not change speech speed merely to fit a reference's length.

> Turn my recording into a 45-second explanation of how I plan a newsletter. Use my Notion capture and draft screenshots. Keep my voice, show each screen when I discuss it, add quiet captions, and return to my face for the conclusion. Preserve the reference's pacing while fitting my actual words.

## Review and community handoff

Watch with sound to check whether the visuals demonstrate the spoken claim, captions survive the cut map, inserts remain legible and the presenter returns naturally. Compare equivalent beats, not arbitrary adjacent frames. A shared package needs the accepted source project, content slots, motion rules, an edit map, permitted example assets and its own real comparison.

## Provenance

Text from OpenMotion's Presenter Story recipes, Apache-2.0.
---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-presenter-story/references/workflow-demo/MOTION_DESIGN.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média, les liens vers des vidéos d’autres créateurs retirés. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
