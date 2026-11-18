# Affiche risographie (Retro Print Poster)

> Build a two-ink risograph-style poster: cream paper, halftone shapes, condensed type, slight misregistration and grain, with each ink layer stamping in. Use for gigs, events, sales and nostalgic announcements.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** gig and event posters, pop-ups and markets, seasonal sales and nostalgic brand moments.

## Look

| Element | Starting value |
| --- | --- |
| Paper | Cream `#F1E6CF` with fine noise grain and a soft warm edge burn |
| Inks | Two spot colours that overprint with multiply, such as red `#E2483A` and blue `#1F3F94`; never more than two plus paper |
| Shapes | Halftone dots (12–16 px grid) whose size grows toward one side; simple bold forms such as sun, waves, stripes |
| Type | Condensed display caps (150–180 px) for the headline; condensed sans caps for details |
| Details | A round badge, a rotated stamp or a ring of circular text; 1–3 px misregistration between inks |

## Motion

- Halftone blooms from the centre outward over 1.5 s, so frame one already shows dots.
- Line work slides in 0.5 s per layer with a 100 ms stagger, like a second pass through the press.
- Headline lines stamp in one by one (320 ms, fast-in ease) with a short offset ghost in the other ink that settles into register.
- Details type on in steps (0.6–0.7 s); a stamp lands at about 60% of the timeline with a 2-frame shake.
- Keep a stepped 1 px registration wobble (6 per second) on one ink and slow drift on the big shape.

## Inputs

Required: headline, date, time and place, exactly as they will be printed. Optional: a second ink colour, a simple motif (sun, waves, an instrument), a stamp line such as an offer.

## Avoid

Gradients, glossy highlights, photos of people, more than two inks, decorative text the user did not supply, misregistration so large the headline doubles.

## Review

Every date, time and place matches the brief; the headline reads at thumbnail size; overprint areas look darker, not muddy; nothing is cut at the frame edge.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-retro-print-poster/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
