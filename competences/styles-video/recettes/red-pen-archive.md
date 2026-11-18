# Archives au stylo rouge (Red-Pen Archive)

> Add archive-paper graphics to a presenter video where one red pen circles, strikes and corrects claims with cited sources. Use for history, investigations and fact-checks.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

Use the creator's own recording and measured speech timing. Do not place graphics over someone else's speech, and keep the face and mouth clear.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** history, investigations and fact-checks where a claim is examined and corrected.

## Look

| Element | Starting value |
| --- | --- |
| Paper | Aged archive paper `#EFE6D2`, light fold lines and edge wear |
| Type | Typewriter face for documents and quotes; dates in larger type |
| Accent | One red pen `#C8102E`: circles, strike-throughs, margin notes and corrected numbers |
| Evidence | Documents, photos and screenshots the user supplied or cited, shown as paper inserts |

## Motion

- Slide documents in like they are placed on a desk (slight rotation, 200–300 ms), then hold.
- The red pen acts only on the spoken claim: circle it, strike it, write the correction beside it, each stroke 300–600 ms.
- Push in slowly (2–4% scale over the shot) on the evidence being read.
- Cut back to the presenter for the conclusion.

## Inputs

Required: presenter recording with timings, the claims and their corrections, the source for every correction. Optional: archive images with usage rights.

## Avoid

Fabricated documents or quotes presented as real, correcting a claim without a source, more than one red mark per beat.

## Review

Every correction cites a real source; struck text is the claim actually spoken; generated or reconstructed documents are labelled as illustrations.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-red-pen-archive/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
