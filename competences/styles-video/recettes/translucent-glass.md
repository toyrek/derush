# Verre dépoli (Translucent Glass)

> Make a soft product promo on layered translucent gradient ribbons: a frosted glass card, short lines that swap one at a time and a thin line icon that changes with each line. Use for calm SaaS launches, productivity apps and feature intros that should feel premium and light.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** calm launches and feature intros told as problem → fix → name.

## Look

| Element | Starting value |
| --- | --- |
| Background | Off-white `#FFF4EE` with 3–4 large ribbons in peach `#FFB199`, coral `#FF6F7D`, apricot `#FFD39A`, rose `#F7A6C1`; 50–85% opacity, multiply, 6 px blur |
| Glass card | Centred, ~60% of frame width, 40 px radius, white 30–60% fill, 14 px backdrop blur, white edge |
| Type | One rounded geometric sans, bold 50–60 px for the line, one accent word in coral `#E2575B`; wordmark 90–110 px |
| Icons | Single-weight line icons (6–8 px stroke) with a peach-to-coral gradient, drawn inside the card |
| Extras | At most two small glass chips with feature names; one dotted sunburst above the final wordmark |

## Motion

- Ribbons drift the whole time (60–140 px over 8 s, sine); the card only settles 6% on entry.
- Swap lines every 1.5–2 s (out 350 ms, in 450 ms); one line at a time.
- The icon follows the story: scattered shapes wobble on the problem, then collapse into one connected symbol on the fix (600–900 ms).
- End on the wordmark under a rotating sunburst (1.4 s); hold at least 1.5 s.

## Inputs

Required: product name, problem line, fix line and promise from the user's site or brief. Optional: logo, brand colours (kept soft), two feature names for chips, a UI screenshot inside the card.

## Avoid

Saturated or dark backgrounds, more than one accent colour on the card, long paragraphs, hard cuts, icons in mixed stroke weights, claims the site does not make.

## Review

Lines readable at 1×; ribbons move in every frame; each icon matches its line; text on glass passes 4.5:1.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-translucent-glass/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
