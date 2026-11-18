# Analyse plan par plan (Shot Breakdown)

> Break a reference video into a shot-by-shot board: one card per shot with a frame grab, timecode, shot size, lens, movement, why it cuts there and what it adds to the story. Use before recreating a reference or briefing a shoot.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** studying a reference film, ad or trailer before recreating its rhythm, or briefing a shoot from it.

## Look

| Element | Starting value |
| --- | --- |
| Board | Charcoal `#131518`, cards `#1C1F24`, cream text `#EDE6D6` |
| Accent | Amber `#F2A541` only on the turning-point shots and the playhead |
| Type | Plain sans for notes, monospace for timecodes and shot numbers |
| Layout | Three-column grid, one card per shot: grab on top, then Frame, Lens, Cut and Why rows; a strip of all shots above |

## Motion

- When the board is rendered as video, a playhead crosses the shot strip and each card fills as it passes that cut.
- Grab wipes in over 0.4 s; note rows follow with a 100 ms stagger.
- Six shots build in about 3 s; then the turning points get the amber outline and the rest dim to 55%.
- Finish on the one-line visual rule for the whole sequence.

## Inputs

Required: a reference video the user may analyse, and measured shot boundaries (detect cuts, then confirm against frames). Optional: transcript or audio notes, the user's goal, a shot limit. With more than 20 shots, report the count and ask which range to cover.

## Avoid

Describing only what is visible without saying why; stating lens or focal length as fact when it is an estimate (mark it); notes about frames nobody inspected; copying the reference's text or footage into the user's own video.

## Review

Each card's grab matches its timecode; shot count equals cut count; every card answers why the cut lands there; the closing rule is one or two sentences the user can shoot or edit to.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-shot-breakdown/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
