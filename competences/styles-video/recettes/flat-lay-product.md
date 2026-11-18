# Vue de dessus (Flat Lay Product)

> Turn product shots into an overhead flat-lay animation where each item drops onto a coloured surface in rhythm, then the label and price settle. Use for product ranges, kits, bundles and what's-in-the-box posts.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** product ranges, gift sets, kits and what's-in-the-box overviews.

## Look

| Element | Starting value |
| --- | --- |
| Surface | Two or three bold colour blocks split on a diagonal, e.g. cobalt `#1F4FD8`, leaf `#2E9E5B`, cream `#F3EBDD`; flat, no gradient |
| Products | Cut-out top-down stills, soft contact shadow 18–24 px at 25% black, light from the top left |
| Props | 3–6 small props tied to the product, never covering a label |
| Type | One heavy condensed sans for the name, one plain sans for numbers; numbers like `01 02 03` on or beside each item |
| Layout | Items on a loose diagonal grid filling 70–85% of the frame; nothing cropped by the edge except props |

## Motion

- Each product drops in from above with a 1.06 → 1.0 scale and a short shadow tighten, 350–450 ms, 250–400 ms apart.
- Props scatter in after their product, 60–90 ms stagger, small random rotation (±12°).
- A slow camera push of 3–5% runs the whole shot; no spins.
- Name and price land last and hold at least 1.5 s.

## Inputs

Required: a cut-out top-down image of each product, product names, the exact copy and price if any. Optional: props, brand colours, a final call to action.

Missing product stills or props are generated through `derush-image` (or ElevenLabs). Approve one test image first, then generate the rest in a batch with the same light direction. Use the user's photo for the product itself.

## Avoid

Perspective angles mixed into the overhead view, props hiding labels, more than three surface colours, invented flavours or prices.

## Review

Labels are readable at 1× speed; shadows fall one way; the last frame shows the full set uncropped.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-flat-lay-product/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
