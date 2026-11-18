# Autocollant qui se décolle (Sticker Peel)

> Peel each scene off like a sticker to reveal the next: a corner curls, the paper back shows, and the next frame sits underneath. Use for drops, announcements, playful promos and list videos.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** playful transitions in promos, drops and list videos.

## Look

| Element | Starting value |
| --- | --- |
| Scenes | Full-frame flat colours, e.g. `#FF6B35`, `#127C77`, `#F4EEE2`, each with one big line of type |
| Paper back | Off-white `#F1ECE3` shading to `#BFB5A6` at the fold, so the curl reads as paper |
| Shadow | Soft drop shadow under the lifted part, about 10 px offset and 14 px blur |
| Stickers | Small die-cut badges with an 8–12 px white outline and a short drop shadow |
| Type | One heavy display font plus one editorial serif; text stays inside the safe area |

## Motion

- Start with a small corner lift (about 0.5 s) so the viewer sees what is about to happen.
- Peel along a straight diagonal fold in 1.2–1.7 s with an ease-in-out; vary the corner between transitions.
- The next scene's content is already in place underneath; only small stickers pop in after the peel (back-out, 400–500 ms).
- Keep at least 1.5 s of readable hold between peels.

## Inputs

Required: three or four short lines or images for the scenes. Optional: brand colours, product stills, the user's own photos or clips as scene backgrounds.

Build the peel in code: clip the top scene with a half-plane and draw the flap as its mirror across the fold line. Only generate imagery through `derush-image` (or ElevenLabs) when the user has none, and approve one test image first.

## Avoid

Peeling in random directions, a flap with no shading (it reads as a wipe), two peels at once.

## Review

Every fold edge is straight and the flap mirrors the removed corner; no scene shows blank space mid-peel; all text is readable during the holds.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-sticker-peel/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
