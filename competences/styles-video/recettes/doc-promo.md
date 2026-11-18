# Mini-documentaire de marque (Doc Promo)

> Tell a short documentary-style brand story: one real person, a specific moment, honest subtitles, a cut to the product doing its job, and a quiet end card. Use for app and service promos that show a moment instead of listing features.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** app, tool and service promos, customer stories and founder notes where one believable moment sells better than a feature list.

## Look

| Element | Starting value |
| --- | --- |
| Frame | 2.39:1 letterbox inside 16:9; handheld drift of 4–6 px; warm practical light against teal shadows |
| Grade | Soft teal shadows `#173037`, warm highlights `#F2A55E`, lifted blacks, gentle vignette |
| Type | Lower-third name and role in a plain sans with a 4 px accent bar; mono timestamp in a corner; centred subtitles with soft shadow |
| Product | The real interface shown full screen, scaled to fill 80% of the frame |
| End card | Product name in a serif, one honest line underneath, same warm light |

## Motion

- Three beats in about 8–15 s: the person and the problem, the product working, the person afterwards with the end card.
- Hard cuts between beats; each shot carries a slow push or pull of 8–12%.
- Subtitles reveal word by word at the spoken pace and never sit over the face.
- On the product beat, show a before-to-after change happening on screen (a scan, a progress pass, a check appearing every 400–500 ms).

## Inputs

Required: the product's real UI recording or screenshots, the one moment to tell, the exact line the person says. Optional: a filmed person, location, brand colours.

If no footage of a person exists, the person and room are generated through `derush-image` (or ElevenLabs); approve one test clip before generating the rest, keep the same person and light across clips, and label the person as generated. Use the user's real interface for every product shot.

## Avoid

Invented testimonials or numbers, fake interfaces, stock montage, more than one claim, a generated person presented as a real customer.

## Review

The story reads with the sound off; subtitles match the line exactly; the UI is the real product; generated people are labelled; the end card holds 2 s.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-doc-promo/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
