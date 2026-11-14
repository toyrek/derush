# Continuity inside a shot, physical motion, fixing a miss

> Fichier composé pour Dérush le 14 novembre 2026 à partir du guide « Seedance 2.5 prompting » de l'auteur (`references/models/seedance2-5/prompting.md` dans le dépôt d'origine ; voir `SOURCE.md` à la racine de la compétence). Dérush n'appelle pas Seedance 2.5 : seules les parties de méthode qui ne dépendent pas de ce modèle sont gardées, telles que l'auteur les a écrites. Sont retirés : les capacités et les réglages propres à ce modèle et à son fournisseur, les rôles des références (`@Image`, `@Video`, `@Audio`), la synchronisation labiale sur un son fourni, la retouche d'un plan.
>
> Le guide d'origine vise des plans allant jusqu'à 30 s. Pour les plans de 4 à 8 s de Dérush, la forme simple suffit presque toujours ; la forme minutée ne sert que si plusieurs actions doivent s'enchaîner dans l'ordre.

Use this workflow with Seedance 2 and Veo 3.1, on top of the model guide.

## Build the prompt

Write a short production note rather than a keyword pile. Include only sections that solve a real control problem in the shot.

For a simple shot, use:

1. subject and setting
2. one action arc
3. shot size and one camera move
4. lighting and one coherent visual treatment
5. sound
6. final image

For a complex or long shot, use:

1. **Format:** continuous take or planned cuts; natural speed or a specific speed effect
2. **Starting state:** positions, object ownership, environment state, and camera position
3. **Timeline:** chronological beats that inherit the prior beat's physical state
4. **Camera:** framing, screen-space placement, path, triggers, and stopping point
5. **Continuity:** the few identities, objects, counts, directions, and visual properties that cannot drift
6. **Audio:** dialogue, room tone, contact sounds, music, or silence
7. **Ending state:** the exact final arrangement and whether to hold it
8. **Constraints:** only specific likely failure modes

Prefer concrete visible direction over adjectives. Replace `dynamic`, `epic`, or `cinematic` with observable choices such as subject placement, lens feel, camera height, light direction, motion speed, performance, and sound.

Keep one coherent style and one lighting logic. Do not stack conflicting aesthetics or incompatible light sources.

## Direct time and continuity

Use timestamps when several events must occur in order, actions exchange physical state, dialogue must fit, or the ending must land at a specific point. Omit timestamps for a simple short action.

Treat timestamps as approximate allocations, not frame-accurate commands. Make adjacent blocks cover the whole externally selected duration without gaps or overlaps.

Make each beat begin from the result of the prior beat:

- Record which hand holds each object.
- Record whether a door, lid, container, or garment is open, closed, attached, or removed.
- Preserve object counts and identities after transfers.
- Preserve travel direction and screen direction.
- State how an action settles instead of stopping at peak motion.

Write cause before reaction. Separate contact, resulting motion, sound, and human response. For example: the tray contacts the cup handle; the cup tips; the ceramic strikes the counter; the customer hears it and looks down.

Handle occlusion explicitly. State how a subject enters the obstruction, how long it remains hidden when timing matters, and which identity, clothing, object, speed, and direction must reappear on the other side. Do not allow the hidden interval to become a reset point.

End deliberately. Specify the subject and object positions, camera composition, residual motion, and hold. Do not leave unused time after the final described action.

## Direct camera, performance, physics, and audio

### Camera

Specify composition as well as motion:

- initial shot size and camera height
- subject position in the frame
- movement path and speed
- visible event that starts the move
- event or mark where it stops
- whether to preserve the action axis

Prefer one motivated camera idea per beat. For a continuous take, describe a physically connected route. For cuts, name each shot and transition instead of combining incompatible moves.

### Performance and dialogue

Block acting into observable actions, gaze, pauses, breath, and restrained facial changes. Avoid vague emotional labels when a performance note can show the emotion.

When dialogue must be generated from text, put exact spoken lines in straight double quotes. State who speaks, when the line begins and ends, what the speaker does before and after it, and who stays silent. Keep dialogue short enough for the allocated time. Use a dedicated block for an important line rather than stacking complex movement over it.

### Physical motion

Break motion into contacts and transfers of force:

- approach
- contact or weight shift
- resulting motion
- recovery or settling state

For liquids, fabric, hair, smoke, particles, and wheeled objects, state the force direction, contact surface, and final state. Replace `realistic physics` with the actual physical sequence.

### Audio

Only when the shot keeps its own sound (see `SKILL.md`, « Dans Dérush »).

Treat audio as part of the same timeline:

- name room tone and environmental ambience
- name contact sounds at the action that causes them
- specify music style and when it enters, changes, or stops
- say `no music` when only production sound is wanted
- say `silent` or `faint room tone only` when silence is intentional

Avoid redundant sound layers. Keep generated sound restrained when the clip will sit under an external voiceover or licensed track.

## Image-to-video

Animate; do not rewrite. Treat the image as the authority for identity, wardrobe, scene, palette, and opening composition. Describe motion, camera, performance, physics, sound, and deliberate changes.

When an end image is available, describe the path between the frames and the final action state. Do not overconstrain every intermediate pose.

To continue a shot, use the previous clip's exact final frame as the opening image. State what has already finished, what remains fixed, and the first new action. Do not narrate or replay the earlier clip.

## Use templates

Use a single line for a simple shot. Use the multiline schema for a complex timeline; it is the exception to the skill's default single-line output when structure improves temporal control.

### Simple shot

`[Subject] in [setting and light] [performs one action arc]. [Shot size and one motivated camera move]. [Coherent visual treatment]. [Audio]. End on [specific final image and residual motion]. [Only necessary constraints].`

### Complex timed shot

```text
FORMAT: [continuous take or cuts; natural speed or intentional speed effect]
STARTING STATE: [subject positions, object ownership, environment, camera]
TIMELINE:
[0-Xs]: [first action]
[X-Ys]: [next action beginning from the prior result]
[Y-Zs]: [final action and settling state]
CAMERA: [framing, subject placement, path, triggers, stopping point]
CONTINUITY: [essential identity, object, count, direction, wardrobe, and geometry invariants]
AUDIO: [dialogue, ambience, contact sounds, music or silence]
ENDING STATE: [exact final composition and hold]
CONSTRAINTS: [specific cuts, repetitions, duplicates, transfers, text, logos, or artifacts to prevent]
```

Do not write the duration, aspect ratio, resolution, or model name into `FORMAT`. Use the externally selected duration only to replace the timestamp placeholders.

### Continuation

`The start frame is the exact opening frame. Preserve [successful identities, objects, layout, light, camera, and completed state]. Do not replay [completed action]. [Ordered continuation]. End with [new exact state]. [Audio]. [Specific constraints].`

## Refine a miss

Change one variable at a time:

- If action order fails, rewrite the starting state and the transition between the affected beats.
- If continuity drifts, shorten and repeat only the essential invariant list.
- If the camera fails, preserve the successful action and rewrite only composition, trigger, path, or stopping mark.
- If dialogue overlaps action, give the line its own block and state when mouths remain closed.
- If the ending drifts, reserve a final settling block and define the last frame.
- If a simple shot stretches or repeats, shorten the external duration instead of inventing filler.

Do not rewrite the whole brief when most of the result works.

## Check the result

Before sending the prompt, verify:

- Match beat complexity to the selected duration.
- Cover the complete timeline without contradictory actions.
- Make each beat inherit physical state from the prior beat.
- Specify cause before reaction and contact before motion.
- Give the camera composition, motivation, and stopping point.
- Preserve essential identity, wardrobe, props, counts, directions, and object ownership.
- For text-generated dialogue, give the dialogue a speaker, quoted line, time allocation, and performance.
- Give fluids, fabric, particles, and impacts a settling state.
- Define the exact ending frame or continuation state.
- Use only targeted negative constraints.
- Remove the model name, version, duration statement, aspect ratio, resolution, and API settings from the final prompt text; keep timestamp blocks when needed for temporal control.
