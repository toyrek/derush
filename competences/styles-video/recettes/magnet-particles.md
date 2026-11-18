# Points aimantés (Magnet Particles)

> Make a minimal brand reveal where a loose cloud of dots is pulled into a line of text, scattered into an orbit, then pulled again into the logo. Use for product intros, collaboration and planning tools, and launches whose message is bringing things together.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** logo intros and tools whose message is bringing scattered parts together.

## Look

| Element | Starting value |
| --- | --- |
| Background | Flat warm paper `#F4F1EA`; no gradient (it bands and costs file size) |
| Particles | 800–1,500 square dots, 3–4 px, charcoal `#1E2A2F` at 90%; the logo mark's dots switch to teal `#0F9C8C` |
| Type | Text targets drawn from a bold grotesk at 170–200 px so the dot shapes stay legible; supporting line in a clean sans at 32–36 px |
| Accent | Teal only on the logo mark and one phrase of the tagline |
| Caption | Optional small uppercase label top-left, letter spacing 0.18 em, grey |

## Motion

- Open on the dot cloud already filling the frame, sliding slowly as one body (about 30 px/s).
- Pull into the first line with expo-in-out over 0.9 s per dot, start times spread by 0.3 s so the word assembles from many directions; hold 1–1.5 s perfectly still.
- Release into an elliptical orbit (800 ms power3-out), rotate slowly, then pull into the logo with a slight sideways curve (1 s).
- Teal fades into the logo dots after they land; tagline fades up 600 ms later and holds 1.5 s.

## Inputs

Required: brand name, one short line (two to four words), logo mark as a simple shape or SVG, tagline. Optional: brand accent colour, a label for the top corner.

## Avoid

Thin or script fonts as targets, jittering dots during holds, more than one line of particle text, thousands of tiny dots (they turn to noise and bloat the file), colour on every dot.

## Review

Both particle texts read clearly when settled; holds are still; the logo matches the supplied mark; the exported file stays small enough for its destination (check bitrate on the dot-motion segments).

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-magnet-particles/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
