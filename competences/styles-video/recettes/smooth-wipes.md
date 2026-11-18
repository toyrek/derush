# Volets arrondis (Smooth Wipes)

> Make a punchy product promo where flat colour panels with rounded corners wipe across the frame between big type beats. Use for app launches, offers and short social promos.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** app launches, feature promos and offers told in 4–6 short beats.

## Look

| Element | Starting value |
| --- | --- |
| Colours | Three flat brand colours, e.g. forest `#0E3B2E`, cream `#F3EFE4`, coral `#FF6B4A`; text always in one of the other two |
| Panels | Full-frame rectangles with 60–120 px corner radius on the leading edge |
| Type | Heavy condensed sans (e.g. Anton or Oswald 700), all caps, 2–3 words per beat, 30–60% of frame height |
| Product | One product UI card or phone frame for the proof beat |
| Logo | Small logo top left on every beat; large lockup on the end card |

## Motion

- Each wipe crosses the frame in 450–650 ms with a strong ease-in-out; the rounded leading edge leads.
- The new beat's type rides in on the panel, 80–150 ms behind its edge, so text and panel move as one.
- Alternate wipe directions (right, up, left) to keep rhythm; one beat every 1.2–1.8 s.
- The proof beat can count a number up or tick a UI state while it holds.
- End on the logo with a 2 s hold.

## Inputs

Required: product name, logo, 4–6 copy beats in the user's words, brand colours. Optional: product screenshot, real number for the proof beat.

## Avoid

Sharp-cornered or diagonal wipes, gradients, more than three colours, numbers the user did not give.

## Review

Every beat reads at a glance; no text is clipped by a panel edge in transit; colour contrast stays at least 4.5:1.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-smooth-wipes/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
