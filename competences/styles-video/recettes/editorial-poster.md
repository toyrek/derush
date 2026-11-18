# Affiche magazine (Editorial Poster)

> Make a calm magazine-style poster with generous white space, one object, a large serif word and small grid type, then animate it as a short series. Use for product drops, issue announcements and quiet brand campaigns.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** lifestyle product drops, magazine or newsletter issues, gallery and event posters, and quiet brand series.

## Look

| Element | Starting value |
| --- | --- |
| Paper | Warm off-white `#F2EFE8`; series variants on pale sage `#DCE0D3` or stone `#E6E0D6`; faint dot grain |
| Type | One large italic serif word (180–240 px at 1280×720); labels in a small sans, caps, tracked 0.18em |
| Grid | Hairline rules `#1E1D1A` at 1 px; 48–56 px margins; issue number set large in the serif |
| Object | One hero object, centred or on the right third, with a soft contact shadow; no props |
| Space | At least 40% of the frame stays empty |

## Motion

- Rules draw in first (0.8–0.9 s), so the grid reads before anything else.
- The object rises 30–40 px into place over 1.1 s; any fine details (stems, steam) draw on after it.
- The title word sets letter by letter from below (80 ms stagger), then labels and copy fade up.
- For a series, wipe the next poster up from the bottom in 0.9 s while the old one drifts up 60 px; repeat the same build.
- Keep a slow 3% push across each poster so the hold never feels frozen.

## Inputs

Required: the headline word or phrase, the object (photo cut-out or description), issue or date line. Optional: a second and third poster for a series, brand colours, body copy (one or two sentences).

## Avoid

Filling the empty space, more than one accent colour, drop shadows on type, decorative icons, stretched or distorted serif lettering.

## Review

Each poster still works as a single frame; the headline never touches the frame edge, including descenders; margins are equal on all sides; the object and title never overlap.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-editorial-poster/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
