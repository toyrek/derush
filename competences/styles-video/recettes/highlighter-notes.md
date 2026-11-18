# Notes surlignées (Highlighter Notes)

> Add calm highlighter-note graphics to a presenter video: off-white paper cards, charcoal text and one yellow highlighter stroke on the key line. Use for study tips, book notes and knowledge talks recorded by the creator.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

Use the creator's own recording and measured speech timing. Do not place graphics over someone else's speech, and keep the face and mouth clear.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** study tips, book notes and calm knowledge talks with one presenter.

## Look

| Element | Starting value |
| --- | --- |
| Paper | Off-white card, `#F4F1EA`, faint paper grain; full-frame insert or a side card beside the presenter |
| Text | Charcoal `#2B2B2B`; one serif for quotes, one plain sans for labels |
| Accent | A single yellow highlighter stroke, `#FFE14D` at 85% opacity, behind the key words only |
| Everything else | No icons, gradients or badges. One accent per screen |

## Motion

- Write the line onto the card with a short fade-up (300–400 ms), then hold it still.
- Draw the highlighter left to right behind the key phrase in 400–600 ms, starting on the spoken word. Slightly uneven stroke ends read as hand-made.
- Cut back to the presenter between notes. A note stays at least as long as it takes to read twice.
- Lower-third captions stay small and separate from the note card.

## Inputs

Required: the presenter's recording, measured speech timing, the 3–6 lines worth noting. Optional: book cover or source title.

## Avoid

Highlighting more than one phrase per card, bouncy easing, music louder than the voice, notes that paraphrase what was not said.

## Review

Each highlight lands on its spoken word (±3 frames); each note is readable at 1× speed; face and mouth are never covered; at most one accent colour on screen.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-highlighter-notes/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
