# Cours en diapos papier (Editorial Webinar)

> Build calm paper-textured course slides with typewriter type, staged timelines, comparisons and checklists, plus a round presenter bubble. Use for lessons, webinars and framework explainers.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

Use the creator's own recording and measured speech timing. Do not place graphics over someone else's speech, and keep the face and mouth clear.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** online courses, webinars and teaching outlines where one idea is explained per slide.

## Look

| Element | Starting value |
| --- | --- |
| Paper | Warm off-white `#EFEBE3` with faint grain; no gradients, cards or shadows |
| Type | One typewriter face (Courier Prime or similar): titles 76–92 px bold, body 25–34 px, small spaced kickers in `#8A8378` |
| Accent | Brick red `#C2492F` only for the current item, the active node and ticks; ink `#24221F` for lines and text |
| Diagrams | Hairline rules (2 px), hollow circle nodes, outlined boxes; one diagram per slide |
| Presenter | The creator's recording cropped into a 210 px circle, lower right, with a thin ink ring |

## Motion

- Type the title in 1–1.2 s with a red block caret; draw the rule under it in 500 ms.
- Reveal diagram parts in reading order, 300–420 ms apart: line draws, then nodes pop, then labels fade up 14 px.
- Switch slides with a 300 ms fade-up; never overlap two slides.
- Draw checkmarks in 350 ms on the spoken word; the chosen option gets a soft 4 px red halo.

## Inputs

Required: the lesson outline or script, the creator's recording, measured speech timing. Optional: module number and lesson code, a logo for the end slide.

## Avoid

Icons, stock photos, a second accent colour, prices or results the lesson does not state.

## Review

Each reveal lands on its phrase (±3 frames); the presenter circle never overlaps a diagram or covers the face; numbers match the script.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-editorial-webinar/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
