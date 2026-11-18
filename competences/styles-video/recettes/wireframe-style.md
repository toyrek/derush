# Filaire rouge (Wireframe Style)

> Package a presenter video with letter-by-letter wide red keywords, small script lead-ins and quick cuts to hollow line-drawn wireframes of the objects being named. Use for tech, gear and setup talks recorded by the creator.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

Use the creator's own recording and measured speech timing. Do not place graphics over someone else's speech, and keep the face and mouth clear.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** setup tours, gear talks and tech opinions with one presenter.

## Look

| Element | Starting value |
| --- | --- |
| Base | The real recording; object inserts sit on a dark teal backdrop `#10313A` |
| Keyword | Extra-wide sans in red `#E3264A`, 80–110 px, wide tracking, one or two words per beat |
| Lead-in | Small white handwritten script `#F4EFE6` above the keyword, three to five words |
| Wireframe | Hollow white line drawing `#EAF6F8`, 1.5 px strokes, mesh rings, thin grey dimension lines `#9FC3C9` with a short measurement label |

## Motion

- Keywords appear letter by letter on the spoken word: each letter pops from 30% to 100% in 200–250 ms, 50–70 ms apart.
- Cut to an object insert with a soft white flash (50% opacity, under 250 ms) when the speech names the object.
- Draw the wireframe along its strokes in 0.8–1.2 s; dimension lines follow 200–300 ms later.
- Push 3–5% on every insert; return to the presenter for the conclusion.

## Inputs

Required: the presenter's recording, its transcript with word timing, and the objects worth showing. Optional: clean photos or clips of each object to trace. Wireframes are drawn as editable SVG from those references; missing object references may be generated through `derush-image` (or ElevenLabs) after one test image is approved.

## Avoid

Keywords on every sentence, wireframes of objects never mentioned, measurements that were not supplied, inserts longer than their sentence.

## Review

Keywords land within ±3 frames of their spoken words; each wireframe matches its object; face and mouth stay clear; text never overlaps the drawing.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-wireframe-style/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
