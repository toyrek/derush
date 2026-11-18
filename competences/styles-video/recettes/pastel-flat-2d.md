# Aplats pastel (Pastel Flat 2D)

> Make a narrated explainer in soft pastel flat 2D scenes: rounded shapes, gentle light changes, small character actions and short uppercase caption chips. Use for product introductions, brand education and calm how-it-works stories.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** product introductions, brand stories, onboarding and "how it works" explainers narrated without a presenter.

## Look

| Element | Starting value |
| --- | --- |
| Palette | Lavender `#B9A7D6`, peach `#F8D9C4`, mint `#BFE3D6`, blush `#F4A9A8`, butter `#FFD98A`; no pure black or white fills |
| Shapes | Flat vector, rounded corners (8–40 px), no outlines, at most one soft shadow tone per object |
| Characters | Simple round heads, dot eyes, small bodies; same proportions in every scene |
| Light | Sky and window colours shift to show time or progress |
| Captions | Dark rounded chip `#24212B`, cream uppercase monospace text, 18–22 px, bottom centre, two to five words |

## Motion

- Hold each shot 3–5 s with a slow 4–8% push or pull so nothing is static.
- Show progress through small changes: windows lighting one by one (250 ms each, 300–400 ms apart), a shutter rising in 0.9 s, bread rising over 1.5–2 s.
- Change shots with a 300–400 ms cross-fade on a sentence boundary.
- Swap captions on the spoken phrase with a small 200 ms scale-in.

## Inputs

Required: topic or exact script, target duration, aspect ratio. Optional: brand colours, voice, product screenshots. Scene images and animated clips are generated through `derush-image` (or ElevenLabs): approve one scene image and a short voice sample first, then the full still preview, then one animated clip before generating the rest. Label generated characters as generated.

## Avoid

Saturated or neon colours, gradients on every object, long captions, characters changing proportions between shots, product claims the brief does not support.

## Review

Every shot shows one visible change; characters stay consistent; captions match the narration word for word in meaning; pastel contrast still keeps captions readable.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-pastel-flat-2d/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
