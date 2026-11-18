# Magazine noir et blanc (Monochrome Magazine)

> Package a presenter video as a black-and-white magazine spread: alternating black and warm-white pages, giant keywords that frame the speaker, thin page furniture and an outlined closing line. Use for lifestyle, fashion and personal interviews recorded by the creator.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

Use the creator's own recording and measured speech timing. Do not place graphics over someone else's speech, and keep the face and mouth clear.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** lifestyle routines, outfit and packing talks, personal stories and interview portraits.

## Look

| Element | Starting value |
| --- | --- |
| Pages | Alternate warm white `#F2EEE6` and black `#121212`; the presenter stays in full colour on both |
| Keyword | Heavy grotesque, 240–320 px, filled with footage or a colour gradient taken from the scene; sits behind the presenter's shoulders, never over the face |
| Headline | Rounded geometric sans, 56–72 px, short phrase |
| Furniture | 14 px tracked uppercase labels in the top corners (issue name, section number) and a hairline rule |
| Ending | One outlined line, 2 px stroke, no fill |

## Motion

- Wipe between black and white pages left to right in 400–500 ms on a sentence boundary.
- Slide each keyword through the frame behind the speaker over 1.8–2.4 s with a gentle ease-out; the section number changes with it.
- Small tags and numbers fade up 300 ms after the keyword.
- Reveal the closing outline line with a 0.8–1 s left-to-right wipe.

## Inputs

Required: the presenter's recording, transcript with word timing, a subject cutout or matte of the presenter (made from the recording), and 3–5 keywords that were actually said. Optional: issue name, brand signature.

## Avoid

Desaturating the presenter, a keyword per sentence, letters crossing the face, cutouts from blurry or occluded footage, labels with facts the speaker did not give.

## Review

Face fully visible in every frame; each keyword appears on its spoken word (±3 frames); page colours alternate cleanly; the cutout edge holds up at full size.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-monochrome-magazine/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
