# Mot en écho (Echo Stack Type)

> Stack one word many times in solid and outline rows that echo, offset and collapse to a beat, then resolve to a calm logo end card. Use for punchy product promos, manifestos and feature teasers.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** short product promos and teasers with one strong word per beat: the problem word, the verb that fixes it, the brand.

## Look

| Element | Starting value |
| --- | --- |
| Background | Ink navy `#14172A` for tension beats, warm paper `#EFE8DA` for resolution beats |
| Type | One ultra-condensed heavy sans in caps; the same word repeated 4–7 rows, alternating solid and 2 px outline |
| Accent | A single orange `#F2602B` mark per beat: a brush cross, a stamp or one solid row |
| Layout | Rows fill the full frame height; words may bleed past the edges on purpose, the hero row never does |

## Motion

- Rows stamp in top to bottom on the beat, 60–90 ms apart, each with a 4–8% scale settle.
- Echo rows trail the hero row with a 2–6 frame delay and a small x-offset, so the word visibly reverberates.
- On the next beat the stack collapses to one row (250 ms) and the new word bursts from it.
- Allow one rotation or skew moment per film (≤12°) for the turning point.
- End: everything clears to paper and the logo plus one-line tagline fade up over 400 ms and hold 1.5 s.

## Inputs

Required: 4–6 single words that tell the story, brand name, tagline, music tempo or a track. Optional: brand kit colours and font.

## Avoid

Sentences in stacks, more than one accent colour, echoes on the logo card, easing that bounces, beats faster than 4 per second.

## Review

Each word readable on its first frame of hold; stacks land on beats (±2 frames); hero row never cropped; end card holds still and clean.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-echo-stack-type/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
