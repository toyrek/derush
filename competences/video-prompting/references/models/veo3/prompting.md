# Veo 3 / Veo 3.1 prompting (Google Cloud guide)

> Fichier modifié pour Dérush le 14 novembre 2026 (voir `SOURCE.md` à la racine de la compétence) : l'IA regarde elle-même l'image de départ, et les images de départ et d'arrivée passent par `start_frame` et `end_frame`.

Use this reference when the shot is generated with Veo 3.1 (`veo-3.1-fast-generate-001` or `veo-3.1-generate-001`).

Source: Google Cloud blog `The ultimate prompting guide for Veo 3.1` (`https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1`).

## Core model capability to leverage

Veo 3.1 supports video generation with audio, so you can direct:

- Dialogue (what is said)
- Sound effects (SFX)
- Ambient noise / soundscape

## A prompt formula that works

Use this five-part structure for consistent control:

`[Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]`

- Cinematography: camera work + shot composition
- Subject: main character/focal point
- Action: what the subject does (prefer clear beats)
- Context: environment/background elements
- Style & ambiance: aesthetic + mood + lighting

## Cinematography language (high leverage)

Be explicit about camera and optics using standard terms:

- Camera movement: `dolly shot`, `tracking shot`, `crane shot`, `aerial view`, `slow pan`, `POV shot`
- Composition: `wide shot`, `close-up`, `extreme close-up`, `low angle`, `two-shot`
- Lens & focus: `shallow depth of field`, `wide-angle lens`, `soft focus`, `macro lens`, `deep focus`

## Direct the soundstage (audio)

Only when the shot keeps its own sound (see `SKILL.md`, « Dans Dérush »).

Use clear, literal audio instructions:

- Dialogue: use quotation marks for exact speech.
  - Example: `A woman says, "We have to leave now."`
- Sound effects: call out effects explicitly.
  - Example: `SFX: thunder cracks in the distance.`
- Ambient noise: define the background soundscape.
  - Example: `Ambient noise: the quiet hum of a starship bridge.`

If you want no dialogue, say so directly and specify only SFX/ambience.

## Negative prompts (exclude by describing the desired absence)

Instead of abstract “no X”, describe the scene including the exclusion:

- Prefer: `a desolate landscape with no buildings or roads`
- Over: `no man-made structures`

## Prompt enhancement workflow (expand a rough prompt)

If the brief gives only a short idea, expand it by adding:

- Cinematography choices (shot + movement + lens/focus)
- Concrete subject details (wardrobe/props/age range/materials)
- Action beats (2–4 timed steps)
- Lighting and mood anchors
- Audio cues (dialogue/SFX/ambient)

Do not include the Veo model name/version, duration, aspect ratio, resolution, or generation settings in the final prompt text. Keep those as external parameters when needed.

## Advanced workflow: “first and last frame” transition

For controlled transformations/camera moves between two endpoints:

1. Create a starting frame image (it goes in `start_frame`).
2. Create an ending frame image (different POV or end-state; it goes in `end_frame`).
3. Prompt Veo to transition from the first frame to the last frame, describing the camera move/transformation and key beats.

## If i2v / “first frame provided”: look at the image first

If the shot starts from an image (`start_frame`), look at it yourself before writing. Use the image to anchor the subject identity, wardrobe/props, and the environment, then describe motion, camera, and the soundstage additions.
Do not describe the input image in depth unless a visible detail must change.
