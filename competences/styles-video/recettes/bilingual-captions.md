# Sous-titres bilingues (Bilingual Captions)

> Add two-line bilingual captions to a talking video: the spoken line on top, its translation underneath, timed and styled as one readable pair. Use for interviews, tutorials and talks published to two language audiences.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

Use the creator's own recording and measured speech timing. Do not place graphics over someone else's speech, and keep the face and mouth clear.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** interviews, tutorials, lessons and creator talks that need the original words and a translation on screen together.

## Look

| Element | Starting value |
| --- | --- |
| Caption box | Dark panel `rgba(14,18,16,.66)`, 16 px radius, centred in the bottom 15% safe area |
| Original line | Bold sans, white `#FFFFFF`, the word being spoken in `#FFD45C` |
| Translation | Same width, about 70% of the original size, light italic serif or the same sans in `#D9E6DC` |
| Layout | One line per language, about 42 characters each; use a font that covers both scripts |

## Motion

- The pair cuts in on the first word of the phrase; no fade longer than 150 ms.
- Word highlight on the original line follows the measured word timing, not an even spread.
- The translation fades up 120–250 ms after the original, so the eye reads top line first.
- Swap pairs on phrase boundaries with a 2–3 frame gap; clear the caption during silences over 1 s.

## Inputs

Required: the creator's recording, a word-timed transcript in the spoken language, and the target language (ask; do not guess it from the chat language). Optional: an approved translation or glossary, whether both languages share one style or get separate styles, brand kit fonts.

## Avoid

Translating names or terms the glossary keeps; three-line captions; a translation that outlives its phrase; captions over the mouth.

## Review

Every pair is readable twice at 1× speed; the translation says what was said, not more; no missing glyphs; highlight lands on each spoken word (±3 frames).

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-bilingual-captions/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
