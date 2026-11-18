# Ruban d'encre (Ink Ribbon)

> Make a promo where one glossy ribbon sweeps through the frame and ties together outlined type, icon steps and the product name. Use for fintech, payments and workflow products whose story is a smooth flow from start to finish.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** payments, banking, logistics and workflow tools that can be told as three steps joined by one continuous motion.

## Look

| Element | Starting value |
| --- | --- |
| Palette | Deep green `#0E3A2C` or paper grey `#E9ECEF` grounds; ribbon blue `#2EA8F0` to pale `#BDE6FF`; ink `#111` |
| Ribbon | A wide SVG path with a gradient across its width and a soft highlight edge |
| Type | Clean grotesk; outlined repeat of the product name as a background pattern; solid black for the closing lockup |
| Icons | 2–3 circular line icons (document, shield, check) in one row |
| Accent | One sparkle mark that leads the eye; highlight the key word with a blue box |

## Motion

- The ribbon draws itself along its path in 900–1200 ms and keeps a slow drift; it passes behind type, never over the read word.
- Copy writes on word by word behind a moving sparkle (about 150 ms per word).
- Icons pop in left to right with a 150 ms stagger; the last one morphs into a check.
- Close on the product name typing on, a tagline with one highlighted word, held 1.5 s.

## Inputs

Required: product name, logo, a three-step flow in plain words, one closing question or call to action. Optional: brand colours for ground and ribbon.

## Avoid

More than one ribbon, ribbons crossing the read text, busy textures, steps that the product does not actually perform.

## Review

The ribbon is continuous from first to last shot; every line is readable with the ribbon behind it; the three steps match the product's real flow; lockup holds 1.5 s.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-ink-ribbon/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
