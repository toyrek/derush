# Shorts tirés d'un long (Shortlist Shorts)

> Cut one long podcast, interview, course or livestream into stand-alone vertical shorts by building a scored shortlist first, then finishing one short for approval before the batch. Use when the user wants clips, highlights or shorts from a long recording.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** cutting one long podcast, interview, course or livestream into several stand-alone vertical shorts.

## Method: shortlist before cutting

1. Use the word-timed transcripts Dérush already made (`transcriptions/`), or Whisper. Do not guess words from frames.
2. Build a shortlist table before editing anything: start–end time, the hook line quoted from the transcript, why it stands alone, a 0–100 score and any risk (needs earlier context, names a private person, unclear audio).
3. Let the user pick. Default to offering at least four candidates when the recording supports them; if there are fewer strong moments, say so instead of padding.
4. Finish one short first for style approval, then batch the rest with the same style.

## Selection rules

| Rule | Starting value |
| --- | --- |
| Length | 20–75 s, never above 90 s unless asked |
| Count | Roughly one candidate per 5–10 minutes of source; total shorts no more than half the source length |
| Strong signals | A hook in the first 1–3 s, a clear payoff, emotion or contrast, a specific example or number |
| Red flags | Needs earlier context, table-of-contents summaries, cut-off endings |

## Edit and format

Start on the hook sentence; remove filler and long pauses but keep natural breaths. Reframe to 9:16 after checking where the face or screen content actually is: face-follow crop for a single speaker, stacked layout for two speakers, full frame on a blurred background for screen recordings. Add word-timed captions in the lower third, clear of platform UI.

## Review

Each short makes sense without the original; the first line is the hook; captions match the speech; crops never cut off the active speaker.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-shortlist-shorts/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
