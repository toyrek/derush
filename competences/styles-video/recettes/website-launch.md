# Lancement d'un site (Website Launch Film)

> Make a 15–30 second launch film from a product website, using its real logo, colours, copy and screenshots in one motion style (kinetic type, isometric card flight or chalk blueprint). Use for product and feature launches.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** a 15–30 s product or feature launch made from the product's own website.

## Gather from the site

Logo, brand colours, fonts (or the closest licensed match), the headline, three benefit lines and two or three real UI screenshots. Use only what the site shows; ask for missing copy instead of inventing claims.

## Pick one motion style

| Style | What moves | Good for |
| --- | --- | --- |
| Kinetic type | Words roll, slot-machine flip or break apart into the next line; one word per beat | Strong headline, little UI |
| Isometric card flight | UI screenshots as tilted cards flying through a shallow 3D space, settling flat for the key screen | Rich product UI |
| Chalk blueprint | Thin white line drawings on a dark blue grid sketch the UI, then fill with the real screenshot | Developer and technical tools |

## Structure

1. Hook (0–3 s): the headline in the chosen style.
2. Proof (3–20 s): one benefit per beat, each paired with a real screen.
3. Close (last 3–5 s): logo, one call to action, the URL.

## Motion

Cut on the beat of the music (pick the track first and mark beats). Each benefit holds long enough to read twice. Use one easing family for the whole film. Screens are real captures, never mock UI.

## Avoid

Invented features or metrics, fake customer logos, more than three benefits, mixing two motion styles in one film.

## Review

Every claim and screen exists on the site; brand colours match; cuts fall on beats; the URL and call to action are correct.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-website-launch/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
