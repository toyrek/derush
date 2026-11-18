# Plongée dans les mots (Push-In Type)

> Make a product promo where the camera keeps pushing forward through layers of big words until it lands on the logo. Use for app and SaaS launch teasers, feature one-liners and short brand openers.

**Dans Dérush.** Fais ce style avec HyperFrames (`derush-hyperframes`, HTML et GSAP : souvent le plus direct pour ces recettes) ou avec le kit `remotion/` ; cette recette donne la direction artistique, pas un modèle prêt. Les couleurs, polices et temps ci-dessous sont des points de départ : le kit média de la personne (`contexte/espace/kit/`) et sa charte passent avant. Une image qui manque : `derush-image` (ChatGPT, le graphiste de l'équipe en Mode Hollywood), sinon les images d'ElevenLabs s'il est branché, sinon dessinée en code ; une voix ou une musique : ElevenLabs ou la bibliothèque de sons. N'invente jamais une citation, un chiffre, une caractéristique ou une date. Les textes à l'écran sont dans la langue de la vidéo.

**Status:** recipe / draft. No executable template or rendered comparison yet.

**Use for:** app and SaaS launch teasers, 6–15 s feature one-liners and brand openers built from a few short words.

## Look

| Element | Starting value |
| --- | --- |
| Background | Warm paper `#F2EEE6`, flat; thin crop-mark corners and faint guide lines in `#16161A` at 25% |
| Type | One heavy grotesk (e.g. Inter Tight 800), all caps, 2–3 words per layer, ink `#16161A` |
| Accents | One signal colour `#F0532B` for the key word, short yellow `#F7C534` slashes that fly past |
| Layout | Every layer centred on the same axis so the push reads as one camera move |
| End card | Logo, product name and a one-line promise at normal scale on the paper |

## Motion

- The camera never stops: each layer grows from about 60% to 100% over 0.8–1.2 s, then rushes past to 600–900% in 0.4–0.6 s with 6–12 px blur and fades out.
- The next layer is already emerging behind the one leaving; overlap the two by 150–250 ms so there is no empty frame.
- Push through a letter's counter (the hole in an O or A) when the copy allows it; it sells the depth.
- Accent slashes cross the frame on each pass in 300 ms.
- Ease into the end card over 0.8 s and hold it at least 2 s.

## Inputs

Required: product name, 3–5 short copy beats in the user's words, logo. Optional: brand font and colours, website for copy.

## Avoid

More than three words per layer, rotating or tilting the camera, cutting instead of pushing, small body copy in the push.

## Review

Every layer is readable for at least 0.5 s at rest; no frame is empty; the final logo is sharp and unscaled; the push direction never reverses.

## Provenance

Written for OpenMotion after surveying publicly listed workflow names and descriptions in ChatCut's preset gallery (November 2026). Original text; no ChatCut prompts, source code, templates or media are included. Apache-2.0, like the rest of the repository.

---
_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion (https://github.com/nexu-io/openmotion, commit 2b57cf6, `library/skills/openmotion-push-in-type/SKILL.md`) : l'en-tête et les outils d'OpenMotion remplacés par ceux de Dérush (HyperFrames ou le kit remotion/, derush-image, ElevenLabs), « Brandkit » devenu le kit média. Licence Apache-2.0 : voir LICENSE, à côté de SKILL.md._
