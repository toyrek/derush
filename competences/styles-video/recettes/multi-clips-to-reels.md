# Plein de clips en un Reel (Multi Clips To Reels)

> Turn a folder of short clips into one vertical reel: review every clip, skip the weak ones, order the keepers and cut them on the beat with a short title. Use for trips, events, product footage and recaps.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** trips, events, product shoots and weekly recaps made from many short clips.

## Look

| Element | Starting value |
| --- | --- |
| Format | 9:16 vertical, 15–30 s; a short title in a heavy display font with one accent such as `#C8F03C` |
| Framing | Reframe each landscape clip around its subject; never squash or letterbox by default |
| Cut rhythm | Cuts land on beats, usually every 2 beats; faster in the middle, a longer last shot |
| Overlays | Thin progress bar and the title only; no stickers over faces |
| Review board | Grid of source clips with a pick number or skip reason on each |

## Motion

- Review the source clips first and mark picks and skips with a reason (shaky, duplicate, dark, no subject).
- Order the picks for a small arc: opener, detail, wide, people, closer.
- Cut on the beat with a 6–8% punch-in that eases out over the shot; an optional 1–2 frame flash on hard cuts.
- Bring the title in on the first beat and keep it at most 3 s unless the user wants it throughout.

## Inputs

Required: the source clips (user footage). Optional: a music track or BPM, the title, preferred length, logos or a closing card.

## Avoid

Using every clip, cutting off the beat, cropping away the subject, repeating the same shot twice, music louder than any speech kept in the reel.

## Review

Each skip has a reason; every cut is on a beat; subjects stay centred after reframing; length matches the brief.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-multi-clips-to-reels/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
