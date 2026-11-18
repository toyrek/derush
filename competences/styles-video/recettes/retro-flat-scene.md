# Illustration rétro (Retro Flat Scene)

> Make a two-tone flat illustration story on orange, with a character at a computer, big gesture close-ups and a burst reveal of the product. Use for AI tools and apps that want a warm, story-led promo instead of screenshots.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** AI builders, productivity apps and launch films that tell a "before → click → result" story in 4–6 shots.

## Look

| Element | Starting value |
| --- | --- |
| Palette | Orange ground `#F07F3C`, brown-black ink `#22140C`, cream `#FFF1DF` highlights; nothing else |
| Drawing | Flat vector shapes, 3–4 px ink outlines, rounded corners, no gradients; a soft cream glow allowed around screens |
| Characters | Simple silhouettes: round head, hoodie, no facial detail beyond two dots or closed eyes |
| Type | One display serif or wide sans for the hero word on screen; plain sans for small UI labels |
| UI | Product screens redrawn as simple line icons, not screenshots |

## Motion

- Establish the scene (person at desk, screen glowing) with a slow 3–4% push-in over 2 s.
- Cut to a big hand or icon close-up; the gesture lands with a squash (90% → 105% → 100%) in 300 ms.
- The reveal is a burst: cream rays shoot out from the screen in 400 ms, then shrink to a spiky badge behind the product mark.
- Screen text types on at 40 ms per letter.
- End on the icon, burst and product name in cream, held 1.5 s.

## Inputs

Required: product name, the one action the user takes, the result in a few words, logo. Optional: a 4–6 shot storyboard, one UI element worth redrawing.

## Avoid

Detailed faces, extra colours, real screenshots, more than one character, text longer than 5 words on any screen.

## Review

Story reads with sound off (before, action, result); each shot holds at least 1 s; ink weight is consistent across shots; product name is legible on orange.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-retro-flat-scene/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
