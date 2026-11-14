# Character-sheet prompting for image models

> Fichier modifié pour Dérush le 14 novembre 2026 (voir `SOURCE.md` à la racine de la compétence) : le mode « planche d'identité photographique d'une personne réelle » et ses deux gabarits sont retirés.
>
> **Règle de Dérush.** Une planche ne sert qu'à un personnage inventé, une mascotte ou un objet. Jamais le visage d'une personne réelle, jamais une photo ni une image des rushes passée en référence. La planche se génère avec `POST /v1/flows/image` ; elle part ensuite dans `images` (jusqu'à 10 images de référence) pour l'image de scène, et l'image de scène dans `start_frame` pour le plan vidéo.

Use this reference when the job needs a reusable character sheet or turnaround to keep a character consistent across multiple generated images and later image-to-video shots.

This workflow is for prompting an image model, not a video model.

## Goal

Produce a sheet that makes the character easy to reuse:

- stable face, build, hair, outfit, and silhouette
- multiple angles on one sheet
- optional expressions, hands, props, and costume details
- minimal ambiguity before generating a first in-scene still

Recommended downstream order:

1. Generate the character sheet
2. Generate a scene still using the sheet as reference
3. Generate image-to-video shots from that scene still

## Clarify the job first

Settle only what is missing (decide yourself from the brief and the project's brand; ask the human only when a real choice is open):

1. Visual style: cinematic photoreal, anime, 3D, painterly, comic, etc.
2. Character basics: age range, gender presentation, ethnicity or skin tone if relevant, body type, height impression
3. Hair and face anchors: hairstyle, color, facial structure, eye color, notable features
4. Wardrobe anchors: outfit, shoes, outerwear, accessories, props
5. Sheet scope: turnaround only, turnaround plus expressions, or full production sheet
6. Intended use: general reference, scene-still generation, or direct reference for image-to-video

If an image of the invented character already exists (a mascot, an earlier generation, a drawing), treat it as the identity anchor and describe the sheet around that anchor instead of reinventing the character.

## Core prompting approach

Character-sheet prompts work best when they are explicit about layout and consistency constraints.

Write prompts in this order:

1. State that the output is a character sheet / turnaround / model sheet
2. Define the character identity in concrete visual terms
3. Lock the outfit and silhouette
4. Specify the required views or panels
5. Specify rendering constraints that preserve sameness across panels
6. Specify the background and presentation style

Prefer one character per sheet. If the project needs multiple characters, write a separate sheet prompt for each one.

## What to include

Default panel set:

- full-body front view
- full-body 3/4 view
- side profile
- back view

Optional panel set:

- expression row
- hand poses
- prop close-ups
- fabric or accessory detail callouts

When including an expression row, ask for clearly different emotions rather than subtle near-duplicates. Mix calm, positive, negative, and high-energy states, and explicitly include some open-mouth expressions when the character design supports it, such as speaking, laughing, barking, shouting, panting, or surprise.

Useful consistency language:

- `the exact same character in every panel`
- `consistent facial proportions across all views`
- `same hairstyle, same outfit, same colors, same body proportions`
- `clean model sheet presentation`
- `full body visible in each main panel`

## Background and composition

For a true production sheet, default to a simple neutral background:

- white
- light gray
- pale beige studio backdrop

Avoid busy scenery unless an in-world presentation board is explicitly wanted. Background simplicity helps the sheet function as a reusable identity reference.

Use even lighting and avoid dramatic cinematic shadows unless a stylized sheet is wanted.

## Pose and camera behavior

By default, keep poses readable and repeatable across panels:

- calm, readable stance
- enough separation from the body to show clothing silhouette
- avoid foreshortening that hides anatomy

Keep camera perspective neutral. Avoid extreme lens effects unless a stylized presentation is explicitly wanted.

## What to avoid

Avoid prompt language that encourages the model to redesign the character between panels:

- changing outfits unless variants are requested
- changing hairstyles across views
- dramatic pose variation that hides anatomy
- cropped figures when a full reference is needed
- story-heavy backgrounds that compete with the sheet

Avoid vague wording like `various looks` or `multiple versions` unless exploration is the goal. For consistency work, you want one locked design.

## Prompt patterns

### Basic turnaround sheet

`Create a clean character turnaround sheet for a single [style] character. The character is [identity description]. They wear [outfit description]. Show the exact same character in full body from front view, 3/4 view, side profile, and back view. Keep facial proportions, hairstyle, outfit, colors, and body proportions completely consistent across every panel. Clean model sheet presentation, evenly lit, neutral plain background, no scene elements, no extra characters, high detail.`

### Turnaround plus expressions

`Create a professional character sheet for a single [style] character. The character is [identity description]. They wear [outfit description]. Include full-body front, 3/4, side, and back views, plus a top row of clearly distinct expression studies showing neutral, joy, skepticism, frustration, and surprise, with at least two expressions using an open mouth where appropriate for the character. The same exact character must appear in every panel with identical facial structure, hairstyle, outfit, palette, and body proportions. Clean layout, neutral background, studio lighting, production design sheet style.`

### Full production sheet with props

`Create a detailed production character sheet for a single [style] character intended for consistent downstream image-to-video reference. The character is [identity description]. Core outfit: [outfit description]. Include full-body front, 3/4, side, and back views, an expression row with clearly varied emotions and at least two open-mouth expressions where appropriate, and small callout panels for [props/accessories]. Keep the exact same character design across all panels with consistent anatomy, face, hair, wardrobe, materials, and color palette. Clean presentation board, minimal neutral background, readable spacing, high detail, no environment scene.`

### Wardrobe-only update

`Using the established character sheet as reference, keep the exact same character and preserve face, body proportions, hair, posture, camera setup, and overall presentation. Change only the wardrobe to [outfit description]. The updated images should feel like the same character in the same controlled session with a new outfit, without redesigning the character or changing the identity.`

## After the sheet

To continue into generation, the next deliverable should usually be a scene-still prompt that references the sheet while adding the environment and framing:

- keep the character identity and wardrobe from the sheet fixed
- add the specific setting, lighting, and shot composition
- avoid introducing new costume or hair changes unless requested

Then write the image-to-video prompt from that scene still, focusing on motion and camera rather than identity redesign.

## Output defaults

Default: the final prompt text only (it goes into the `prompt` field of the call).

For the fuller package, write:

- the character-sheet prompt
- the first scene-still prompt
- the follow-on image-to-video prompt
