# Visite d'un assistant IA (AI Assistant Tour)

> Make an AI assistant feature tour: orb intro, a prompt that types a real request, a tilted answer card that streams in, and quick result actions. Use for chatbot, copilot and AI feature launches.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** launching an AI assistant, copilot or chat feature step by step.

## Look

| Element | Starting value |
| --- | --- |
| Background | Soft pastel gradient, blue `#EEF4FF` → lilac `#F6F0FF` → pink `#FDEFFA`, with faint concentric rings |
| Mark | A glossy orb with a conic gradient of blue `#3E8BFF`, violet `#7B5CFF` and pink `#F27AD4`; small rotated-square sparkles |
| Prompt box | Large white rounded field (radius 36 px) with a violet outline, mode chips and a dark send button |
| Answer card | White card, radius 28 px, a gradient user bubble at the top right, short structured lines with tinted labels |
| Type | Clean neo-grotesk; 80–90 px for the wordmark, 40–46 px typed prompt, 24–26 px answer text |

## Motion

- Orb spins in (700 ms, back-out) next to the wordmark; sparkles rotate slowly throughout.
- Prompt box rises, placeholder swaps to typed text at a natural pace (about 18 characters per second) with a blinking caret.
- Cursor clicks send; the answer card tilts up from 28° (600 ms) and lines appear one by one, 300 ms apart.
- Feature beats such as edit, save or voice get one screen each with a cursor hover that reveals the actions.

## Inputs

Required: assistant name, 2–4 features to show, one real example prompt and answer produced by the product, logo or orb colours. Optional: screenshots of the real interface, generated example images through `derush-image` (or ElevenLabs) (approve one test image before generating a set).

## Avoid

Answers the product cannot give, wall-of-text responses, unreadably fast typing, more than five feature beats in 30 s.

## Review

Prompt and answer come from the real product; typing finishes before the cut; the cursor never covers text being read.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-ai-assistant-tour/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
