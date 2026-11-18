# Logo glitch (Glitch Logo Sting)

> Make a 2–4 second glitch logo reveal with RGB split and slice displacement built from editable CSS/SVG layers. Use for openings and end cards of tech, music, gaming and fashion brands.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** 2–4 s logo openings and end cards for tech, music, gaming and fashion brands.

## Look

| Element | Starting value |
| --- | --- |
| Background | Near black `#050505` or the brand's dark colour |
| Logo | The user's SVG or transparent PNG, unchanged in shape and colour once settled |
| Glitch | RGB channel split (red and cyan copies offset 4–12 px), horizontal slice displacement, brief scan lines |

## Motion

1. 0–0.6 s: signal noise and scan lines; logo fragments flash in displaced slices.
2. 0.6–1.4 s: two or three sharp glitch bursts (2–4 frames each) with RGB split.
3. 1.4 s: the logo snaps clean and holds; one final 2-frame flicker is optional.
4. Add a short digital sound hit on the snap; keep it optional and replaceable.

Build with CSS/SVG layers (three logo copies with `mix-blend-mode: screen` and clip-path slices) so timing stays editable. Generated video is not needed.

## Inputs

Required: logo file. Optional: tagline, brand colour, sound preference.

## Avoid

Distorting the logo in the final hold, flashing faster than three times per second for more than a moment (photosensitivity), glitch that lasts longer than the clean hold.

## Review

Final frame matches the supplied logo exactly; flashes stay within accessibility limits; the sting reads at 2× playback speed too.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-glitch-logo-sting/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
