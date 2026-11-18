# Astuce cachée (Hidden Feature Demo)

> Make a hidden-feature product demo: a hook asks if viewers knew this trick, a close-up shows the exact press or move, and a callout names the result. Use for appliances, gadgets and apps with a useful feature people miss.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** appliances, gadgets, tools and apps where one lesser-known button, gesture or setting saves time.

## Look

| Element | Starting value |
| --- | --- |
| Shots | Wide shot of the product in its real setting, then tight close-ups on the control and the result |
| Hook | Bold white sans with a dark rounded backing, `#111317` at 80%, top third, 4–8 words |
| Focus | A soft circle or ring, accent `#FFD23F`, around the exact button or part |
| Steps | Numbered chips `1 2 3` with two-word actions |
| Result | One line naming what the feature gives, with a tick |

## Motion

- Open on the hook within the first 0.5 s, over the wide shot.
- Push in on the control over 600–900 ms; the focus ring draws on in 300 ms as the finger arrives.
- Hold the press long enough to see it (≥600 ms) and pulse the ring once.
- Cut to the result close-up; step chips and the result line land 300 ms apart.

## Inputs

Required: the real product, the exact feature and how to trigger it, what it produces. Optional: presenter, setting, call to action.

Shots the user cannot film are generated through `derush-image` (or ElevenLabs) from the product photo. Approve one test clip first; keep buttons and display text true to the real product. Generated people are labelled as generated.

## Avoid

Features the product does not have, button labels that change between shots, more than three steps, hiding the finger action behind text.

## Review

A viewer could repeat the trick after one watch; the ring sits on the correct control; on-screen text matches the real labels; generated content is labelled.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-hidden-feature-demo/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
