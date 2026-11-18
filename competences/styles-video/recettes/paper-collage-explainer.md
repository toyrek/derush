# Collage de papier (Paper Collage Explainer)

> Make a narrated explainer or story ad from large paper-cutout collage scenes assembled on the narration beats. Use for video essays and explainers with no presenter on camera.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** narrated explainers, video essays and story-led ads without a presenter on camera.

## Look

| Element | Starting value |
| --- | --- |
| Scene | 6–8 large, separate cutout pieces per scene: one hero subject, two or three context pieces, texture and a headline strip |
| Material | Torn paper edges, halftone photo cutouts, newsprint and kraft textures, a visible drop shadow under each piece |
| Palette | Muted base (cream, newsprint grey) plus one saturated accent per film |
| Type | Bold condensed headline on a paper strip; short phrases, not sentences |

## Motion

- Assemble each scene piece by piece on the narration beats: pieces slide or drop in 250–400 ms with a small overshoot, never fly from off-screen corners.
- Keep a slow camera drift (2–3% over the scene) so a still collage feels alive.
- Move between scenes by reusing one piece as the bridge, or with a paper-tear wipe.
- Keep generated pieces as separate layers so each one stays editable.

## Inputs

Required: topic or script (write the narration first), aspect ratio. Optional: voice choice, music, user images. Generate missing pieces with `derush-image` (or ElevenLabs); one style test image is approved before the full set is generated.

## Avoid

Collages with more than eight pieces, small pieces that read as clutter, flattened single-image scenes, archival-looking images presented as real history.

## Review

Each scene has one clear subject; pieces arrive on the words they illustrate; text strips are readable on a phone; all pieces remain separate editable layers.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-paper-collage-explainer/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
