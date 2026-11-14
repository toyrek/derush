---
name: video-prompting
description: Écrire le prompt d'un plan vidéo généré avec Seedance 2 ou Veo 3.1 (à partir d'un texte, d'une image de départ ou d'arrivée), ou la planche d'un personnage inventé pour le garder identique d'un plan à l'autre ; à ouvrir avant de générer un plan vidéo, aussi quand une autre compétence renvoie à « veo-3 » ou « ai-video ».
---

# Video Prompting

> Fichier modifié pour Dérush le 14 novembre 2026 : ce qui a été retiré ou adapté est listé dans `SOURCE.md`.
> Original : Square-Zero-Labs/video-prompting-skill, licence Apache-2.0.

## Dans Dérush

- **Quand elle sert.** Au moment d'écrire le `prompt` d'un plan généré (`POST /v1/flows/video`) ou d'une planche de personnage (`POST /v1/flows/image`) : voir `OUTILS.md`, « Les images et les vidéos générées ». Ces appels passent par ElevenLabs ; s'il n'est pas branché, cette compétence ne sert pas.
- **Les modèles.** Dérush appelle Seedance 2 (`bytedance-seedance-v2-fast`, le moins cher, pris par défaut, 4 à 15 s ; `bytedance-seedance-v2`) et Veo 3.1 (`veo-3.1-fast-generate-001`, `veo-3.1-generate-001` ; 4, 6 ou 8 s, 9:16 ou 16:9). Choisis toi-même et dis lequel tu as pris ; ne demande à l'humain que s'il veut choisir.
- **Les réglages restent hors du prompt.** La durée, le format et la définition passent par `duration_secs`, `aspect_ratio` et `resolution`, jamais par le texte du prompt. Cette règle prime sur les gabarits d'autres compétences qui écrivent « 8-second vertical 9:16 » dans le prompt.
- **Une image de départ ou d'arrivée** passe par `start_frame` et `end_frame`. Regarde l'image toi-même avant d'écrire. Les références multiples de Seedance (`@Image`, `@Video`, `@Audio`), la retouche et la prolongation d'un plan ne font pas partie de l'appel décrit dans `OUTILS.md` : pour une suite, prends la dernière image d'un plan comme `start_frame` du suivant, et raccorde au montage.
- **Les crédits.** Un plan généré coûte cher : des plans courts (4 à 8 s), un prompt relu avec la liste de contrôle, une seule génération. Regarde le résultat ; ne régénère que si c'est raté, en ne changeant qu'une chose (`references/workflows/continuity-and-refinement.md`, « Refine a miss »).
- **Le son.** Avec `"generate_audio": false` (le cas courant : la musique, les bruitages et la voix viennent du studio ElevenLabs et du mixage), n'écris rien sur le son dans le prompt. Ne dirige le son (réplique entre guillemets, bruitages, ambiance) que si le plan doit garder le sien.
- **Les personnes.** Jamais le visage ni la voix d'une personne réelle, jamais une image des rushes où l'on reconnaît quelqu'un comme image de départ, rien qui puisse passer pour un vrai document. Les planches de personnage sont réservées aux personnages inventés, aux mascottes et aux objets.
- **Après.** Range le plan dans `remotion/public/`, garde son prompt à côté dans un fichier texte (il resservira pour une retouche), et dis à la fin quels plans tu as générés.

## Overview

Turn a user’s intent into either:

- a strong, model-compliant video prompt, or
- a strong image-model prompt for a character sheet that will later support image-to-video consistency.

Model-specific video guidance lives in `references/models/`. Workflow guidance lives in `references/workflows/`.
This file is the entry point: route to the right path, settle the minimum that is missing, then draft the prompt in the expected format.

## Model Index

- Seedance 2 (`bytedance-seedance-v2-fast`, `bytedance-seedance-v2`): `references/models/seedance2/prompting.md`
- Veo 3.1 (`veo-3.1-fast-generate-001`, `veo-3.1-generate-001`): `references/models/veo3/prompting.md`

## Workflow Index

- Character sheets for consistent characters: `references/workflows/character-sheets.md`
- Continuity inside a shot, physical motion, fixing a miss, final check: `references/workflows/continuity-and-refinement.md`

## Global video-prompt rules

These rules apply to every video model reference:

- Never include the model name, model version, duration, aspect ratio, resolution, or API/control parameter names in the final prompt text. The one exception is the timestamp blocks that order the beats of a complex shot (see `references/workflows/continuity-and-refinement.md`).
- Otherwise, use duration only as internal planning context for how many action beats the prompt can support.
- Parameters go outside the prompt, in the fields of the call (`duration_secs`, `aspect_ratio`, `resolution`, `generate_audio`).
- For image-to-video, treat the image as the visual anchor. Do not describe the image in depth unless a detail must change. Focus the prompt on motion, camera, emotion/performance, and audio.

## Workflow

### Step 1 — Route the request

Decide whether the job needs:

- a video-generation prompt, or
- a character-sheet prompt for an image model

Route to the character-sheet workflow when the job needs a reusable reference sheet, turnaround, expression sheet, costume sheet, or a consistent-character starting point for a longer image-to-video project.

If the job needs both, do them in this order:

1. Character sheet
2. Scene still / anchor frame
3. Video prompt

### Step 2 — If it is a video prompt, identify the model and input mode

If no model was named, choose one yourself from the Model Index (see « Dans Dérush ») and say which one you took.

Then settle the input mode: text-to-video (t2v), image-to-video (i2v, the image goes in `start_frame`), or first-and-last frame (`start_frame` and `end_frame`).

If i2v: look at the image yourself before writing. Use the image as an anchor according to the chosen model’s guidance (e.g., keep identity/wardrobe/composition stable; focus your text on motion/camera/what changes).

Recommend the shortest duration that fits the action instead of defaulting every request to the model's maximum.

### Step 3 — Load the correct reference and follow its format

For video prompts: open the model’s `prompting.md` from the Model Index and follow its rules strictly.

For character sheets: open `references/workflows/character-sheets.md` and follow its structure strictly. Treat this as an image-model prompt, not a video-model prompt.

### Step 4 — Draft the prompt in the right form

Draft the prompt using the structure and constraints from the markdown file you selected in Step 3.

For video prompts: follow the chosen model’s `prompting.md` exactly, including its preferred section order, dialogue/audio format, and any shot-structure guidance.
Before sending a video prompt, remove any prompt-internal references to model name/version, clip length, aspect ratio, resolution, or generation settings, and run the checklist in `references/workflows/continuity-and-refinement.md` (« Check the result »).

For character sheets: follow `references/workflows/character-sheets.md` exactly, including layout, consistency constraints, and expression-row guidance.

### Step 5 — Output

Default: the final prompt text only. It goes into the `prompt` field of the call; keep a copy next to the generated file.
Default formatting: a single line with no line breaks unless multiline formatting is explicitly requested. A complex timed shot is the exception: preserve the production-note sections and timeline line breaks of the continuity workflow.

If the human asks for options: provide 2–3 distinct prompt variants as text, each fully self-contained and compliant with the model’s formatting, before generating anything.

If the full consistency workflow is wanted, after the character-sheet prompt also write:

- one prompt for a first scene still that uses the character sheet as reference, and
- one prompt for the follow-on image-to-video shot
