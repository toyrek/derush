# Particules (Quantum Particles)

> Make a tech promo where thousands of fine particles drift, gather into shapes, swirl and finally form the logo mark. Use for AI, data, cloud and developer-tool launches.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** AI, data, cloud and developer-tool promos and logo openers of 6–15 s.

## Look

| Element | Starting value |
| --- | --- |
| Background | Deep navy `#050A1A` with a soft centre lift |
| Particles | 700–3,000 dots of 2–4 px; white `#EAF0FF` and electric blue `#4C7DFF`, additive blending |
| Shapes | Simple geometric targets: ring, sphere, hex cluster, dot grid, the logo mark |
| Type | Clean geometric sans (e.g. Manrope 600–800) in white; one short line at a time below the shape |
| Layout | Shape centred and large (40–60% of frame height); type never overlaps the cloud |

## Motion

- Start with particles already drifting so the first frame is alive.
- Each gather takes 0.8–1.2 s with per-particle stagger of up to 300 ms, so the shape assembles rather than snaps.
- Between shapes, break into a swirl or flow field for 1–1.5 s; keep velocities continuous.
- Copy lines fade in 200 ms after a shape settles and out before it breaks.
- The last gather forms the logo mark; the wordmark fades up beneath and the particles keep a subtle shimmer.

## Inputs

Required: product name, logo (simple shapes convert best), 2–3 copy lines in the user's words. Optional: brand colour for the particles.

## Avoid

Particles too large to read as dust, random jitter that hides the shape, text placed inside the cloud, more than two particle colours.

## Review

Every shape is recognisable when paused; frame-by-frame motion is deterministic from time; the logo reads at thumbnail size.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-quantum-particles/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
