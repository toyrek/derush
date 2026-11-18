# Livre de contes (Storybook Myth)

> Tell a fable, myth or legend as painted picture-book scenes with a parchment text page and drifting light. Use for folk tales, bedtime stories and mythology explainers.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** fables, myths, legends and bedtime stories narrated over a few painted scenes.

## Look

| Element | Starting value |
| --- | --- |
| Painting | Watercolour-style night or dusk scenes: soft washes, wobbly hill edges, gentle paper grain (soft-light, about 55%) |
| Palette | Night sky `#0D1838` → `#6E5E8C`, hills `#283862` / `#131E3A`, moon `#F6E7B0`, lantern gold `#FFD27A`, hero orange `#E07A35` |
| Type | An old-style serif (Cormorant Garamond or similar): italic gold title `#F2D58A`, story lines in dark brown on a parchment page `#F1E4C6` with a red drop cap `#A33A2A` |
| Layout | Title top left, one painted scene full frame, the story page low on the left |

## Motion

- Push the camera in slowly, 5–6% over a scene.
- Move the hero along a path with a walk cycle; small props (tail, lantern) swing on their own sine.
- Let light carry the magic: stars join into a shape line by line (300 ms apart), glows grow over 1.5–2 s, motes drift along an arc.
- Write each story line onto the page in about 1.5 s; crossfade the page between lines in 300 ms.

## Inputs

Required: the story text or the tale's name, the 3–5 beats to show, the main character. Optional: narration, music, a style reference the user owns. Generated pieces go through `derush-image` (or ElevenLabs); one test painted scene is approved before batch generation. Label generated people as generated.

## Avoid

Retelling a protected modern book or film, scary imagery for young audiences, more than one story line on the page, claiming a myth's origin or date without a source.

## Review

Page text matches the narration word for word; the hero is never cut by the frame; glows never wash out the title; each scene holds 1 s after its last line.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-storybook-myth/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
