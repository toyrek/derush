# Jeu vidéo en pixel art (Pixel Art Explainer)

> Explain a topic as a retro pixel-art game scene with a character, a dialogue box and a facts counter. Use for gaming, retro and science topics aimed at a young or playful audience.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** game, retro-tech and simple science topics told as a tiny side-scrolling level.

## Look

| Element | Starting value |
| --- | --- |
| Canvas | Draw at 160×90 logical pixels and scale ×8 with nearest-neighbour; no anti-aliased edges |
| Palette | 16 colours or fewer: night sky `#1B1F3B` → `#7C63A6`, sea `#2E6FB0` / `#4FA3D9`, sand `#E8C27A`, hero red `#D64545`, coin gold `#FFD447` |
| Type | A pixel font (Press Start 2P or similar) for HUD and dialogue, cream `#FFF6D8` on `#14162B` boxes with a 6 px cream border |
| Layout | HUD chips in the top corners, the scene in the middle, a dialogue box with a speaker tag along the bottom |

## Motion

- Step all motion at 12 frames per second; sprites use 2-frame walk cycles.
- Type dialogue at about 25 characters per second with a blinking caret; hold the full line 1 s.
- Show the idea as an event in the level (water rises, a door opens) over 3–4 s, not as a text slide.
- Reward each fact with a 600 ms pickup: sprite hop, star in the HUD, `+1 FACT` pop that fades in 400 ms.

## Inputs

Required: the script or topic, 2–4 facts to explain, a name for the hero. Optional: a character sheet if the user already has one, sound effects, chiptune music. Draw sprites and tiles in code by default; generated backgrounds are optional and go through `derush-image` (or ElevenLabs) with one approved test frame first.

## Avoid

Smooth tweens or blur on sprites, real game characters or logos, facts the brief does not supply.

## Review

No blurred edges at full size; each line is readable before it changes; the hero never floats; the counter matches the facts told.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-pixel-art-explainer/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
