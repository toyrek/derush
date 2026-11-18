# Panneau à volets (Giant Flip Type)

> Fill the frame edge to edge with giant caps and huge numbers that flip like a split-flap board from one statement to the next. Use for bold product promos, launch stats and countdown-style teasers.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** promos built on three or four short statements or one hero number ("2× faster", "10,000 teams") that must hit hard.

## Look

| Element | Starting value |
| --- | --- |
| Background | Cool paper `#ECEFF4`; ink `#10141F` |
| Type | Grotesque black weight, caps, set so each line spans the full frame width; numbers in tabular figures |
| Accent | One orange block `#FF5A26` with paper-coloured text for the single key word |
| Layout | Three stacked lines filling 80–90% of the height, or one number filling the frame; small logo end card |

## Motion

- Each line is a flap: top half folds down over a hairline split in 160–220 ms, the bottom half follows with a small bounce-free settle.
- Lines flip in a 70–100 ms stagger, top to bottom.
- Numbers roll digit by digit through the flap, landing on the real value; hold 1 s.
- The accent block slides in behind its word in 200 ms after the flip.
- End: the board flips to blank paper and the logo appears small and still for 1.5 s.

## Inputs

Required: 3–4 short statements, any real number with its source, brand name and tagline. Optional: brand kit colours, music for flip timing.

## Avoid

Lines too long to fill the width at large size, invented statistics, more than one accent per board, shadow-heavy 3D flaps.

## Review

Every line fills the width without cropping a letter; numbers match the source; the split hairline is aligned across lines; end card readable.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-giant-flip-type/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
