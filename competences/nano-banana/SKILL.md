---
name: nano-banana
description: >-
  Écrire le prompt d'une image générée ou retouchée avec les modèles d'image Gemini (« Nano Banana » :
  gemini-3.1-flash-image et gemini-3-pro-image) : fond de carton, illustration, miniature, affiche,
  image de départ d'un plan vidéo, série d'images cohérente ; à ouvrir avant de générer une image.
metadata:
  version: 1.0.0
license: MIT
---

# Nano Banana (image prompt craft)

Write prompts that get studio-quality images out of **Nano Banana** — Google's Gemini image model
(**Nano Banana Pro = Gemini 3 Pro Image**; the Flash variant is faster/cheaper). This skill is the
**prompt-craft** layer: how to ask for the right image well.

> Fast-moving area — re-verify model names/capabilities quarterly.

## Dans Dérush

- **Quand elle sert.** Avant d'écrire le `prompt` d'une image générée (`POST /v1/flows/image`, voir
  `OUTILS.md`, « Les images et les vidéos générées »). L'appel passe par ElevenLabs ; s'il n'est pas
  branché, cette compétence ne sert pas.
- **Les modèles.** `gemini-3.1-flash-image` (« Nano Banana 2 », rapide, pris par défaut) et
  `gemini-3-pro-image` (« Nano Banana Pro » : du texte dans l'image, une série cohérente). Le même appel
  propose aussi `gpt-image-2` et `bytedance-seedream-5-pro` ; ce guide est écrit pour les deux modèles
  Gemini.
- **Les réglages passent par l'appel** : `aspect_ratio` (9:16, 16:9, 1:1, 4:5, 3:4, 4:3), `resolution`
  (1K, 2K, 4K) et jusqu'à 10 images de référence dans `images`. Si le format est aussi écrit dans le
  prompt, ce doit être le même. Pour retoucher une image, envoie-la dans `images` avec la consigne dans
  le prompt.
- **Un texte posé sur la vidéo reste un calque Remotion** (net, modifiable, animable) : demande alors une
  image sans texte, avec une zone libre pour le titre. Le texte rendu dans l'image ne sert qu'aux images
  fixes (miniature, affiche, carte). Relis-le lettre à lettre, accents (é, è, à, ç, œ) et guillemets
  compris.
- **Les crédits.** Chaque image coûte des crédits à l'humain : un prompt réfléchi, une génération à la
  bonne définition, et on ne régénère que si c'est raté. Regarde d'abord ce qui existe déjà dans
  `contexte/creations/`.
- **Les personnes.** Jamais le visage d'une personne réelle dans une image générée, jamais une photo ni
  une image des rushes où l'on reconnaît quelqu'un envoyée au modèle pour être retouchée, rien qui puisse
  passer pour un vrai document.
- **La marque.** « brand-profile.md », dans ce guide, c'est la marque du projet :
  `contexte/espace/ESPACE.md` pour un client (couleurs, logo, interdits), sinon le profil du créateur dans
  `contexte/createur/` ; la couleur d'accent et les polices sont dans `style` (`montage.json`), la charte
  et le logo joints dans `contexte/INDEX.md`. Ne demande rien à l'humain si ces fichiers répondent.
- **Après.** Range l'image dans `remotion/public/images/`, réutilise-la d'une version à l'autre, et dis à
  la fin quelles images tu as générées. Rien n'est publié sans demande (`derush-publier`).

## Reach for Nano Banana when… (match the job)

Its real strengths: **legible in-image text**, **multi-image/character consistency**,
**conversational editing**, and **infographics / factual scenes**. Its edges: **photoreal human
portraits / luxury product realism** and **surreal/fine-art** aesthetics. Don't default it to every
job. (Details: `references/when-and-how-to-prompt.md`.)

## Step 0 — Read the brand + the job

Load `brand-profile.md` (colours, visual style, do/don't). Identify the **job** (quote graphic /
carousel / thumbnail / infographic / product shot / background / ad / edit) and the **platform
aspect ratio**.

## Step 1 — Write the prompt (natural language, not keyword spam)

Describe, don't pad. Include **subject · composition/camera · action/context · lighting/atmosphere ·
style/medium · constraints + exact text**. Drop "4k, masterpiece, trending on artstation" tokens —
modern Gemini models reason over natural language. Bake in the **brand** palette/style. Set the
**aspect ratio**. One careful generation at the resolution the image needs (see « Dans Dérush »). See
`references/when-and-how-to-prompt.md`.

## Step 2 — Use the superpowers deliberately

- **Text:** put the **exact words in quotes** + font + placement; settle the **copy first** (the
  text-first approach), keep it short, and **verify the spelling** in the output.
- **Consistency:** use **reference images** and a **locked style description**; generate a set **one at
  a time** ("everything the same except X"); hold the aspect ratio; review for drift.
- **Editing:** natural-language changes to a hero image for locale/seasonal/A-B variants.

See `references/text-and-consistency.md`.

## Step 3 — Pick the recipe

Adapt a pattern for the job (quote graphic, carousel set, thumbnail, infographic, product/lifestyle,
background, ad), with the right aspect ratio and brand grounding. See `references/social-recipes.md`.

## Step 4 — Verify, disclose, ship

- **Verify** rendered text and any infographic **data** before publishing (the model can misspell /
  misplace facts).
- **Disclose** AI generation per platform/region (Meta "Made with AI", EU AI Act); every image carries
  a **SynthID** watermark (+ C2PA) — don't strip it or pass the image off as a non-AI photo.
- **Ship:** save the image in `remotion/public/images/` and say at the end which images were generated.

## Quality bar — self-check

- Did I **match the tool to the job** (and say when the result is at the model's edge)?
- Is the prompt **natural-language and specific** (subject/composition/lighting/style/text), **brand-
  grounded**, with the **right aspect ratio**?
- For text: **exact words in quotes** + font + placement, **copy-first**, **spelling verified**?
- For sets: **references + locked style**, one-at-a-time, reviewed for drift?
- Did I handle **SynthID + disclosure**, **verify text/data**, and **refuse real people / IP**?

## Edge cases & pushback

- **"logo, 4k, masterpiece, trending…"** → rewrite into a specific scene description; drop token spam.
- **Real person / copyrighted character / brand style** → refuse; offer an original alternative.
- **"Post it as a normal photo"** → SynthID + disclosure; don't disguise AI imagery.
- **Long paragraph of in-image text** → expect errors; shorten + verify (or set the text in Remotion).

## Related

- `carousel-writer` (image-prompt-pack), `reels-script`, `thumbnail-design` — consuming skills.
- `brand-profile` — the visual brand; `caption-writer`/`hook-writer` — the in-image copy.
- `video-prompting` — to animate a still into a video shot (the image becomes the first frame).

## References

- `references/when-and-how-to-prompt.md` — when to reach for it, its edges, and the prompt anatomy.
- `references/text-and-consistency.md` — the two superpowers: legible in-image text and multi-image consistency/editing.
- `references/social-recipes.md` — adaptable prompt patterns per social job + aspect ratios.
- `references/examples.md` — weak→strong prompts, a consistent carousel, an edit, and honest scope.
