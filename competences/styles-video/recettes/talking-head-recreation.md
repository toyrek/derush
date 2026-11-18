# Face caméra comme une référence (Talking Head Recreation)

> Re-edit the creator's own talking-head footage with the cutting rhythm and packaging of a reference video they like: punch-ins, caption style, text cards, name tags and pacing, mapped beat by beat to their own words. Use when a creator asks to edit theirs like that one.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

Use the creator's own recording and measured speech timing. Do not place graphics over someone else's speech, and keep the face and mouth clear.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** creators who have their own talking-head recording and a reference edit whose style they want.

## Look

| Element | Starting value |
| --- | --- |
| Captions | Measured from the reference; sample: condensed caps, white, lime `#C6FF3D` keyword |
| Punch-ins | Reference zoom amount, usually 110–120%, centred above the eyes |
| Text cards | Reference card colour and two-word rhythm; sample: black with one lime word |
| Name tag | Reference position and length; sample: lower left, accent bar, 1.5 s |

## Motion

- First build a beat map of the reference: every cut, zoom, card, tag and B-roll with its timecode and job.
- Map each beat to the creator's line that does the same job (key line, number, list, call to action); match function, not timestamp.
- Keep the average shot length within ±20% of the reference.
- Punch-ins snap in about 120 ms on the key word; cards hold 1–1.5 s.

## Inputs

Required: the creator's recording(s), the reference video (file or link), measured speech timing for both. Optional: logo or product images for B-roll, notes on length. Swapping people or products inside the reference, or having no own footage, needs a different Skill.

## Avoid

Copying the reference's words, music, logos or footage into the output; forcing a beat where the creator says nothing that fits; punch-ins that crop the chin or forehead; captions that cover the mouth.

## Review

Deliver the beat map as matched, adapted or skipped with a reason for each; check every punch-in frame; the result is an editable composition, not a flattened file.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-talking-head-recreation/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
