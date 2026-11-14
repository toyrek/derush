# Seedance 2.0 prompting (ByteDance Seed / Volcengine guides)

> Fichier modifié pour Dérush le 14 novembre 2026 (voir `SOURCE.md` à la racine de la compétence) : les parties sur les références multiples, la retouche et la prolongation d'un plan sont retirées, parce que l'appel décrit dans `OUTILS.md` ne les propose pas.

Use this reference when the shot is generated with Seedance 2 (`bytedance-seedance-v2-fast` or `bytedance-seedance-v2`).

Sources:

- Volcengine prompt guide: `https://www.volcengine.com/docs/82379/2222480`
- Seed blog launch post: `https://seed.bytedance.com/en/blog/official-launch-of-seedance-2-0`
- Volcengine SDK tutorial: `https://www.volcengine.com/docs/82379/2291680`
- Seedance 2.0 model page: `https://seed.bytedance.com/en/seedance2_0`

## What Seedance 2.0 is good at

Seedance 2.0 is a unified multimodal audio-video model. The official launch materials emphasize:

- Stronger motion stability and physical plausibility in complex multi-subject scenes
- Up to `15-second` high-quality multi-shot audio-video output
- Stereo / two-channel audio generation with dialogue, ambience, music, and sound effects aligned to picture

The model itself also accepts several images, video clips and audio clips as references. The call described in Dérush's `OUTILS.md` does not pass them: its only image inputs are `start_frame` and `end_frame`.

## Clarify the job first

Settle only what is missing (decide yourself from the brief; ask the human only when a real choice is open):

1. Is it fresh generation from text, or does the shot start from (or end on) an image?
2. Is it a single-shot clip or a multi-shot sequence?
3. What clip length should be set in the generation controls? Take the shortest length that fits the action (4 to 8 seconds in Dérush); go up to `15 seconds` only when the brief really asks for a longer multi-shot sequence.
4. What should happen with audio: silent visuals, ambience only, music, dialogue, voiceover, or layered sound design? (In Dérush the usual answer is none: `generate_audio` is false and nothing about sound goes in the prompt.)

## Core prompting approach

Seedance 2.0 responds well to director-style prompts with temporal beats.

The official examples also show that literal labels work well. It is fine to write prompts with short sections such as:

- `Setting:`
- `Action:`
- `Camera:`
- `Style:`
- `Audio:`
- `Shot 1:`, `Shot 2:`, `Final shot:`

Write prompts in this order:

1. Output goal: what kind of clip to create
2. Subject and setting anchors
3. Action progression over time
4. Camera plan
5. Lighting / material / style anchors
6. Audio plan

Prefer concrete visible behavior over abstract mood words.

## Motion and scene construction

The official materials highlight complex sports, fight choreography, dance, and multi-character interaction. To exploit that:

- Describe motion in chronological beats
- Call out cause and effect when actions interact
- Specify visible physical outcomes: balance shifts, fabric drag, splashing water, ice shavings, mud spray, recoil, impact
- Keep action readable; do not stack too many simultaneous beats into a short clip

Good Seedance prompts often read like a compact shot breakdown rather than a keyword list.

## Camera language

Seedance 2.0 is explicitly marketed around camera control, so use standard film verbs:

- `slow push-in`
- `fast pan`
- `tracking shot`
- `profile shot`
- `orbit`
- `low-angle follow`
- `close-up`
- `top-lit close-up`

For multi-shot prompts, describe the transition between shots so the sequence feels planned:

- `opening with...`
- `the shot transitions to...`
- `the camera pans to reveal...`
- `the ending shot pushes in on...`

## Audio direction

Only when the shot keeps its own sound (see `SKILL.md`, « Dans Dérush »).

Audio is a first-class part of the model, not an afterthought. When sound matters, specify:

- Dialogue or exact spoken line
- Background ambience
- Music style
- Foley details
- Sync moments where sound should hit the action

Examples of useful audio phrasing:

- `Only the sound of rain is heard at first.`
- `Pure natural trigger sounds, no background music.`
- `Laughter and cheering rise as the family photo comes together.`
- `Voiceover enters only in the final product close-up.`

If the clip should be silent except for one sound family, say that directly.

## Best practices

- Match prompt complexity to clip length; `15 seconds` can handle 2 to 4 clear beats or a short multi-shot sequence.
- Duration is controlled outside the prompt. Use it only to plan beat complexity; do not write the duration into the prompt prose.
- Do not include the Seedance model name/version, duration, aspect ratio, resolution, or generation settings in the final prompt text.
- For single-shot prompts, keep one main camera move and one main action arc.
- For multi-shot prompts, keep the shot order explicit and coherent.
- For multi-shot prompts, explicit labels like `Shot 1`, `Shot 2`, `Cut to close-up`, and `Final shot` are consistent with the official examples.
- Describe motion and camera in visible terms, not abstract intensity words.
- If a prompt includes dialogue, keep it brief so it fits the shot timing.
- Never use the portrait or the voice of a real person (Dérush rule; the official materials themselves say authorization or identity verification may be required).

## Mode-specific guidance

### Text-to-video

- Start with subject, setting, and the visual premise.
- Add the action beats in time order.
- Add the camera plan.
- Add audio layers only if they materially improve the shot.

### Image-to-video

- Look at the image first.
- Use the image as the anchor for identity, wardrobe, scene, and style.
- Focus your text on motion, camera, and audio changes. Do not describe the input image in depth unless a visible detail must change.

### Continuing a shot

- Use the last frame of the previous shot as `start_frame`.
- State what should remain consistent.
- Describe how the next action begins from the current end-state.

## Recommended template

Use a single-line prompt by default unless multiline formatting is asked for:

Single-shot / continuous-shot pattern:

`[Direct opening sentence, e.g. "Single continuous cinematic shot, no music." or "Vertical ASMR video. No music. Macro details."] Setting: ... Action: ... Camera: ... Style: ... Audio: ... Final shot: ...`

Multi-shot pattern:

`[Direct opening sentence or premise.] Shot 1: ... Shot 2: ... Cut to close-up: ... Final shot: ... Style: ... Audio: ...`

If the shot starts from an image, introduce it the way the official examples do, in natural language:

- `Based on the reference image, ...`

## Planning checklist

Use this as an internal drafting checklist before writing the final prompt:

- Single-shot or multi-shot goal
- Subject and setting
- Action beat 1
- Action beat 2
- Action beat 3
- Camera plan
- Lighting / texture anchors
- Style direction
- Audio plan
