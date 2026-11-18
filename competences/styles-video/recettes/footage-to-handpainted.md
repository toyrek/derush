# Rushes peints à la main (Footage to Handpainted)

> Turn real footage into a hand-painted look: live clips open into flat, brush-edged painted versions of the same shot, framed by a bold-caps and italic-serif title pair. Use for travel, lifestyle and reflective explainers without an on-camera host.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** travel diaries, lifestyle essays and calm idea pieces built from B-roll, where one moving subject (a ferry, a train, a cyclist) carries each beat.

## Look

| Element | Starting value |
| --- | --- |
| Footage | Real clips, warm graded, 1–3 s each, one clear moving subject |
| Painted layer | Flat brush-edged colour blocks with paper grain, e.g. coral `#D9533F`, teal `#4F9BA8`, cream `#F1E6CF`, moss `#6E8B3D` |
| Type | Heavy sans caps word plus a large italic serif line, cream on colour |
| Layout | Rounded painted window over the footage, ending on a full-frame painted hold |

## Motion

- Open on live footage for 1–1.5 s.
- A rounded window grows from one corner (600–800 ms, ease-out) and shows the same frame painted; the subject keeps moving inside it.
- Wipe the whole frame to the painted version along a brush-shaped edge in 500–700 ms.
- Title pair arrives after the paint settles: caps word fades up (300 ms), the italic line writes on 200 ms later.
- Hold the final painted frame at least 1.5 s; no camera shake.

## Inputs

Required: the user's footage and one key line per beat. Painted frames are generated: one frame per shot goes through `derush-image` (or ElevenLabs) as an image-to-image paint pass; approve one test frame before painting the rest, then animate stills with gentle drift. Optional: music, place names. Generated people are labelled as generated.

## Avoid

Painting real people's faces without consent, filter-style posterising, more than two type families, text over busy footage.

## Review

Painted frame matches the live shot's composition; the moving subject stays recognisable after painting; every title readable at 1× for two full reads; colours repeat across beats.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-footage-to-handpainted/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
