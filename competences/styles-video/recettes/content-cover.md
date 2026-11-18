# Couverture de vidéo (Content Cover)

> Read a video or article, pull its strongest line, and lay out a set of cover options in bold and safe styles, then pick and finish one. Use for video thumbnails, social covers and article headers.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** Video thumbnails, vertical social covers, podcast episode art and article headers made from the content itself.

## Look

| Element | Starting value |
| --- | --- |
| Format | 3:4 vertical or 16:9 thumbnail, as the platform needs; show options side by side, the pick enlarged |
| Bold set | Yellow `#FFD43B` or red `#E8322B` ground, heavy condensed caps 3–5 words, a rotated sticker tag |
| Safe set | Off-white `#F4EFE6` or navy `#1C2340`, a serif or clean sans headline, one quiet accent |
| Person | A real frame of the creator, cut out, face large and unobstructed |
| Proof | Source panel showing the transcript line the title came from, highlighted in `#FFE24A` |

## Motion

- Highlight the chosen transcript line in 0.6 s and pop 2–3 keywords as chips.
- Generate four options, two bold and two safe, each popping in 350 ms apart.
- Mark the pick with a check, fade the rest in 0.5 s, then scale the pick to fill the frame in 0.9 s.
- Finish on the chosen cover held for 2 s with a label of its format.

## Inputs

Required: the video transcript or article text, at least one clear frame of the creator if they appear. Optional: channel style or past covers, platform and ratio, words that must or must not appear.

If no usable frame exists, a cover portrait may be generated through `derush-image` (or ElevenLabs) only with the user's consent, after one approved test image, and it is labelled as generated.

## Avoid

Titles the content does not deliver on, expressions the creator never made, more than six words, small text.

## Review

Every headline is traceable to a line in the source; the face and headline are readable at 160 px wide; bold and safe sets look clearly different; the final cover is exported at the platform's size.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-content-cover/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
