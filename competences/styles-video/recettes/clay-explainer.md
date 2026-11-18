# Pâte à modeler (Clay Explainer)

> Tell a simple science or story idea with plasticine characters, soft studio light and stop-motion timing. Use for kids' lessons, science basics and friendly brand stories.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** children's lessons, everyday science and gentle brand stories with one or two characters.

## Look

| Element | Starting value |
| --- | --- |
| Material | Rounded plasticine shapes with lumpy edges, a top-left highlight and a grounded shadow |
| Palette | Mint sky `#A6D8CB`, grass `#7DB86A`, soil `#A9784F`, water `#3C8FD1`, sun `#F2A93B`, warm brown text `#5A2E1A` |
| Characters | Simple faces: two dot eyes, a curved mouth, pink cheeks; expressions change by swapping the mouth shape |
| Type | A rounded sans (Fredoka or similar) on clay plaques and a step chip |

## Motion

- Animate on twos: hold each pose for 1/12 s and let the clay surface shift slightly between poses.
- Grow and squash with overshoot: a character fills up over 2–3 s, then settles with a 5–8% bounce.
- Show a process as repeating small actions: drops rise or fall in loops of 0.9–1.6 s, staggered 300–400 ms.
- Change the step chip at each new idea with a quick 250 ms bump.

## Inputs

Required: the script or question, 2–4 steps to show, the main character idea. Optional: voice-over, music, a reference image of a character the user owns. Generated pieces go through `derush-image` (or ElevenLabs); one test image or clip is approved before batch generation. Label generated people as generated. Simple scenes can be built from code shapes instead.

## Avoid

Glossy plastic or 3D-render looks, realistic people, more than two characters talking at once, science claims the brief does not support.

## Review

Movement reads as stepped, not smooth; each step chip matches the narration; characters stay inside the frame at their largest size; faces stay readable on a phone.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-clay-explainer/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
