# Champ de bulles (Bubble Field)

> Make a playful brand promo on a full field of bobbing gradient bubbles that clear for heavy serif headlines, with one hero bubble that rolls across the type and floods the screen for the brand word. Use for consumer apps, audio and wellness products, and launches that want a bold, friendly opener.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** consumer, audio and wellness brands; teasers ending on one brand word.

## Look

| Element | Starting value |
| --- | --- |
| Background | Cool light grey `#E9EDF3` |
| Bubbles | Circles with a diagonal gradient pink `#FF4F7B` → violet `#9B5CFF` → cyan `#3ED6E8`; sizes 90–180 px; small ±20° hue variation between bubbles |
| Type | A heavy display serif, 150–250 px, navy `#14213D`; one supporting sans line at 34–40 px |
| Hero bubble | One 280–320 px bubble with a soft violet shadow; it is the only object that crosses the text |
| End | Full-bleed version of the bubble gradient with the brand word in white |

## Motion

- Fill the frame within 0.6 s: bubbles pop in (450 ms, back-out), then bob 10–12 px and pulse 4%.
- Clear the field at about 2 s: bubbles push outward and fade in 700 ms while the hero bubble pops in at centre.
- Headline lines rise 40 px in 500 ms; the hero bubble rolls across them in 1–1.5 s arcs, covering a few letters at a time.
- The hero bubble scales up to flood the screen (700 ms); the brand word lands with a small overshoot.

## Inputs

Required: brand name, a two-line problem headline, a one-line promise. Optional: brand gradient (three stops), logo, a product shot to sit inside the final flood.

## Avoid

Flat single-colour bubbles, more than one bubble crossing text, thin serif weights that break at small sizes, letting the bubble cover the whole headline at once, copy the brand does not use.

## Review

Frame 0.5 s shows a full field; the headline stays readable 1 s+ with the bubble in front; the flood has no blank frame.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-bubble-field/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
