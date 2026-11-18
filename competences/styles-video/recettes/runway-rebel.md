# Défilé rebelle (Runway Rebel)

> Pair bold white uppercase words with thin yellow serif numerals over a presenter video, plus an occasional full-screen yellow card. Use for creator advice, fashion talk and hot takes recorded by the creator.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

Use the creator's own recording and measured speech timing. Do not place graphics over someone else's speech, and keep the face and mouth clear.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** creator advice, fashion and lifestyle opinions, and short punchy talks with one or two numbers.

## Look

| Element | Starting value |
| --- | --- |
| Words | Extra-bold geometric sans, uppercase, white `#FFFFFF`, stacked in two lines with a staggered indent |
| Numerals | Hairline high-contrast serif in yellow `#F2F21B`, larger than the words and overlapping them |
| Card | Full-screen yellow `#F2F21B` with navy `#10204A` words filled by a slice of the presenter shot |
| Layout | Words in the lower third or beside the face; numerals behind or beside the words |

## Motion

- Words rise 20 px with a short fade (200–250 ms) one line at a time.
- Thin numerals draw or fade in slowly (500–700 ms) after the words, so the weight contrast reads.
- The yellow card cuts in on the strongest line, holds 1–1.5 s, then cuts back on the next sentence.
- Keep the presenter shot steady; a gentle 2% push-in at most.

## Inputs

Required: the presenter's recording, measured speech timing, the key phrases and numbers exactly as spoken. Optional: a darker or bluer grade of the shot for contrast.

## Avoid

Yellow on the bold words, more than one numeral on screen, cards on every line, words over the face, invented counts.

## Review

Words and numbers match the speech; the thin numeral is still readable on a phone; one yellow card per 20–30 s at most; face and mouth stay clear.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-runway-rebel/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
