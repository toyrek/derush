# Clips d'un live de vente (Livestream Clips)

> Cut a recorded livestream sale into short product clips: one product per clip, a real hook first, then proof, the offer and one call to action. Use for live shopping replays that must become posts or ads.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

Use the creator's own recording and measured speech timing. Do not place graphics over someone else's speech, and keep the face and mouth clear.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** live shopping replays with several products that need one standalone vertical clip each.

## Look

| Element | Starting value |
| --- | --- |
| Format | 9:16, host centred, product beside the face, never over it |
| Hook | Top 12%, heavy sans, white with one yellow `#FFE14D` keyword |
| Product tag | White card lower left: name and one plain fact |
| Offer and CTA | Red bar `#FF3D5A` for the deal mechanic; white pill button for the call to action |

## Motion

- Open on the strongest spoken line about this product, verbatim, inside the first 2 s.
- Hook text pops in (scale 1.4 → 1, about 350 ms).
- Product tag slides in when the host names the product; offer bar at the move from proof to deal.
- Call to action in the last 2–3 s; pulse at most three times.

## Inputs

Required: the replay, its transcript, the product list. Optional: product photos, publishing window, price policy, target platform. Map product segments from transcript and frames, skip products whose pitch was cut off, and cut out room chatter: greetings, giveaways, stock counts, queue numbers.

## Avoid

Prices or discounts nobody said; two products in one clip; countdowns or 'today only' lines in clips posted later; banned claims for the market (miracle, cure, best ever); captions covering the product.

## Review

Each clip makes sense with no context; the hook is a real quote; every price matches the stream and the chosen price policy; product name and visuals agree.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-livestream-clips/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
