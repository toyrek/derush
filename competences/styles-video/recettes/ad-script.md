# Script de pub qui n'en a pas l'air (Ad Script)

> Write a short product video script that plays like content rather than an ad: one angle, a concrete hook, the problem, on-screen proof, a payoff and one call to action, each beat mapped to a visual. Use before producing a product promo or creator-style ad.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** product promos, app launches and creator-style ads that need a script and shot plan before anything is made.

## Look

| Element | Starting value |
| --- | --- |
| Script table | Time · Beat · Line · Visual, one row per beat; active beat marked in coral `#FF6B4A` |
| Preview | A 9:16 or 16:9 frame per beat beside the table, matching the target format |
| Captions | Bold sans, white, one coloured keyword per line |
| Tone | Spoken first person or a viewer-facing line; plain words, no slogans |

## Motion

- Hook in the first 1.5 s: a concrete outcome or a surprising, true line.
- One beat every 2–5 s: hook, problem, proof, payoff, call to action.
- Proof is shown on screen (a demo, a before/after, a real screen), not just said.
- The call to action fills the last 2–3 s and asks for one thing.

## Inputs

Required: the product page or notes with the claims that can be made, who the viewer is, length and aspect ratio. Optional: existing footage or screen recordings, the offer, brand voice. Offer 2–3 angles (pain, transformation, demo, objection) and write the chosen one in full.

## Avoid

Invented prices, numbers, guarantees, reviews or endorsements; feature lists in place of benefits; more than one call to action; visuals the user cannot actually make; naming competitors.

## Review

The first two seconds say why the viewer should care; every claim points to a source; the script reads aloud within the length; each beat has a visual and caption the user can produce.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-ad-script/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
