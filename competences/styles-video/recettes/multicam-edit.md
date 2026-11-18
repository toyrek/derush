# Montage multicaméra (Multicam Edit)

> Sync a multi-camera recording and cut a speaker-follow draft: show whoever is talking, go wide for crosstalk and keep reaction shots short. Use for podcasts, interviews and panels shot on several cameras.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

Use the creator's own recording and measured speech timing. Do not place graphics over someone else's speech, and keep the face and mouth clear.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** podcasts, interviews and panels recorded on two or more cameras plus separate microphones.

## Look

| Element | Starting value |
| --- | --- |
| Program | 16:9; a close-up for one speaker, the wide for overlap, laughter and openings |
| Reactions | Listener close-up, 0.5–1 s, only on a visible response |
| Review board | Colour per camera in the cut track: teal `#2BD9B4`, blue `#7FA8FF`, amber `#FFB547` for reactions |
| Masters | Synced master and cut draft on separate timelines; never a nested multicam object |

## Motion

- Cut 4–8 frames after a new speaker starts, or on their breath.
- Minimum shot 1.5 s; reactions are the only exception.
- Go wide when two voices overlap for more than 0.8 s.
- At most two reaction shots per minute; on long turns, break with the wide every 20–40 s.

## Inputs

Required: every camera file and separate audio recording from one session. Optional: speaker names, which microphone belongs to whom, the preferred reference recorder. Work out the structure from transcript overlap first: same words at the same time means separate angles; no shared words and back-to-back times means one camera that restarted.

## Avoid

Guessing offsets; silent time-stretching (a drifting offset means a bad match, clock drift or dropped frames to report); cutting on every word; a reaction shot that steals the punchline; editing the user's existing main timeline.

## Review

Check lip sync at the start, middle and end of each angle (±1 frame); every cut follows the active voice; list any low-confidence match instead of hiding it.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-multicam-edit/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
