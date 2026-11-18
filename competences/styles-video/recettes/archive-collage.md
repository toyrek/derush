# Collage d'archives (Archive Collage)

> Make a retro biography explainer from paper-puppet cutouts, archive photos, op-art backdrops, big condensed numbers and taped notes on blueprint paper. Use for a person's life story, a founder story or a company history.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** biographies, founder and inventor stories, company milestones and "how it started" explainers.

## Look

| Element | Starting value |
| --- | --- |
| Paper | Cream `#EEE6D3`, navy blueprint `#1C3550` with a faint 40 px grid, torn edges between scenes |
| Accents | Mid blue `#2F6FA3` for op-art rings, mustard `#E3B23C` for result words, stamp red `#C8423A` for dates |
| Subject | Photo cutout or paper puppet with a thick white sticker outline and a soft shadow |
| Type | Condensed poster face for numbers and results (150–300 px); small tracked monospace for captions and file labels |
| Props | Taped note cards, ribbons, stamps and line-drawn schematics of the subject's work |

## Motion

- Count meaningful numbers up beat by beat (one step every 0.6–0.8 s) with a short overshoot.
- Change scene with a torn-paper sheet passing through in 0.8–1 s.
- Draw schematics along their lines in 0.6 s per part; note cards drop in with 0.4 s back-ease.
- Let the subject's object travel (a path, a launch, a delivery) to carry the story into the result word.

## Inputs

Required: the person or company, 5–8 sourced facts with dates and outcomes, narration script, aspect ratio. Optional: real archive photos (preferred), voice, music. Puppet portraits, places and props that are missing are generated through `derush-image` (or ElevenLabs); one test cutout is approved before the set. Label generated people and illustrated reconstructions as generated, never as archive evidence.

## Avoid

Unsourced years or numbers, name-and-date lists with no cause and effect, generated images passed off as historical photos.

## Review

Every fact matches its source; each big number means something in the story; generated imagery is labelled; torn transitions never cover a reading line.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-archive-collage/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
