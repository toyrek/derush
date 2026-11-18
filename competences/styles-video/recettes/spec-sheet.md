# Fiche technique (Spec Sheet)

> Add a spec-table overlay to a presenter review: black dot-matrix table, condensed type and a red row for the spec being discussed, with values appearing as they are spoken. Use for gadget, software and pricing reviews.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

Use the creator's own recording and measured speech timing. Do not place graphics over someone else's speech, and keep the face and mouth clear.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** gadget, camera, software and pricing reviews where numbers matter.

## Look

| Element | Starting value |
| --- | --- |
| Table | Black panel `#0B0B0B`, dot-matrix or monospace figures, hairline row rules `#333` |
| Type | Condensed sans in caps for labels, tabular numbers for values |
| Accent | One red highlight row, `#E5322D`, for the spec currently being discussed |
| Placement | Side panel (16:9) or lower half (9:16); the presenter stays visible |

## Motion

- Add a row the moment the spec is said: label slides in 6–8 px, value counts or flips to its final number in 300–500 ms.
- Move the red highlight to the active row; previous rows stay visible in grey.
- Comparisons use two aligned columns, never two separate tables.
- Collapse the panel when the talk moves away from specs.

## Inputs

Required: presenter recording with timings, a spec list with sources (manufacturer page, measured result or the user's own test). Optional: product image for the panel header.

## Avoid

Numbers that were not spoken or sourced, more than eight rows, animated counters on values that are not quantities, red used for anything except the active row.

## Review

Every value matches its source and the speech; units are correct; the active row changes in sync with the voice; the table never covers the face.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-spec-sheet/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
