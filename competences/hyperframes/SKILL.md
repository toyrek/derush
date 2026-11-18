---
name: hyperframes
description: Read first to make, edit, animate or render any video with HyperFrames (HTML rendered to video), including launch films, explainers, music videos, charts, maps, vertical clips, title cards, captions and overlays. Holds the render contract, the work loop and what each kind of video needs.
---

<!-- Modifié pour Dérush (IABAI) le 18 novembre 2026, d'après HyperFrames 0.9.64 (Apache-2.0, HeyGen, Inc.) : la commande s'appelle derush-hyperframes, et ce qui envoie des données à HeyGen (télémétrie, avis, usage, compte) est retiré. Détail dans SOURCE.md. -->

**Dans Dérush :** la commande est `derush-hyperframes <commande>` : la version 0.9.64 installée et relue par Dérush, sans télémétrie ni compte HeyGen (aide : `derush-hyperframes --help`). Partout où ce guide écrit `derush-hyperframes`, c'est `derush-hyperframes`. Dérush refuse ce qui parle à HeyGen ou sort du rendu local : `events`, `feedback`, `usage`, `auth`, `cloud`, `lambda`, `publish`, `preview`, `open`, `catch-up`, `upgrade`, `telemetry`, `media-treatment`, `reverse`, `templates`. Ne les lance pas, n'envoie aucun avis. Il n'y a ni Studio ni application de bureau : tu travailles seul ; regarde tes images avec `snapshot`, puis rends dans `../rendu/final.mp4`. Les compétences media-use, figma, slideshow, reverse-any-video et style-sampling citées ici ne sont pas dans Dérush : pour les sons, les voix et les images, prends les outils de Dérush (OUTILS.md). Le dossier `scripts/` d'origine n'est pas livré.

# HyperFrames

HyperFrames renders HTML to video by seeking a paused timeline frame by frame, so every render is identical; the person edits the same files in the Studio preview. Use it unless another framework or a plain browser recording is asked for. Run the CLI as `derush-hyperframes <command>` (`/hyperframes-cli`).

`index.html` is the root composition: it declares the video's variables and mounts one scene per sub-composition from `compositions/`. Media and fonts live in `assets/`. A new project: `derush-hyperframes init <dir> --skip-skills --skill=hyperframes`. A website as the subject: `derush-hyperframes capture <url> --json`.

Build what was asked: no voiceover or captions and no new aspect ratio unless the request or the source calls for them; a film over ~15 s that tells something gets music and sound on its visible actions unless the person asked for silence (`references/sound.md`). A new video is 1920×1080 at 30 fps. A question, a hold or a loose idea gets an answer or a proposal, not an edit. Before hand-writing a named effect, transition, caption style, chart or card, search the registry (`/hyperframes-registry`). Any media (a presenter or avatar, footage, voice, music): `/media-use`, which says when HeyGen is needed and what is free. Show real things from their source (the product's screens, the brand's logo, a real place's imagery); draw only what has none.

## Contract

`derush-hyperframes check --json` reports most violations with a `Fix:` line.

1. Every timed element has `class="clip"`, `data-start` and `data-duration` in seconds, and shows over `[start, start + duration)`: land an end state just before its end. `data-track-index` is only a Studio lane (clips that never overlap share one: `references/format.md`); paint order is `z-index`.
2. The video's length is the root's `data-duration`: overrun is cut, an early end holds the last frame.
3. Each composition builds one paused timeline and registers it after its tweens: `window.__timelines["<data-composition-id>"] = tl`.
4. No `Date.now()`, unseeded `Math.random()`, network fetches, timers or `repeat: -1`. Everything visible is a function of timeline time.
5. Never tween `display`, `visibility` or `autoAlpha` on a `.clip`; animate a child.
6. No CSS `transform` on an element GSAP transforms; animate transforms, not `left`/`top`/`width`/`height`.
7. Never `play()`, `pause()` or seek media. A `<video>` keeps its sound with `data-has-audio="true"`, else it is `muted`; music, voice, replacement sound and J/L cuts are a separate `<audio>`.
8. Every `<audio>` has an `id` or it is left out of the mix. No `crossorigin` on media. Time the `<video>`, never its wrapper.
9. Only the bundled fonts (`references/format.md`) resolve by name; any other family needs `@font-face` to a file in `assets/fonts/`.
10. Asset paths: `assets/...` (no leading `/`), in sub-compositions too.
11. Grades, grain, blur and vignettes on footage go through `derush-hyperframes media-treatment` (`/media-use`), never CSS filters.
12. A scene file puts its styles, markup and scripts inside `<template>` and styles its root as `#root`. Intended overflow or overlap: `data-layout-allow-overflow`, `data-layout-allow-overlap`.

## Keep it editable

Studio edits the tags you write.

- One scene per sub-composition, short readable ids; the root holds only scene hosts, media and audio.
- Timed elements are written in the HTML, not made by script, each with a stable `id`.
- Copy, brand colours and swappable media are variables (`data-var-text`, `data-var-src`, `var(--id)`).
- One kind per track: `data-track-kind="graphics"` on scene and overlay hosts, `captions` on the one host that holds every caption group.
- Content stays inside the 90% action-safe box, captions and key text inside 80% title-safe; Studio draws the guides, never add them.

## Work loop

- An existing project: `derush-hyperframes timeline --json` shows what plays when; before any change, `derush-hyperframes history --since mine --who <you>` shows what the person changed since your last turn: build on it (`/hyperframes-cli`).
- A new film over ~15 s that tells something: its type's file (below), then `references/story.md`: three storylines that are three different films, in words only; the person picks unless they asked for the file or no stops. Then `SPEC.md` (`references/spec.md`): every adjective as a number, the defaults banned by name, the shots by frame.
- After your last edit: `derush-hyperframes check --json`; fix every error, weigh every warning. A film: `derush-hyperframes snapshot --review` and `references/review.md`, ending in `REVIEW.md`. A small edit: snapshot what you changed (`--at`, `--range`, `--composition`) and look before you reply.
- Render when the person approves the Studio preview, asks for the file or asks for no stops, after your check and review pass; otherwise stop at the preview and wait.


## What to read

| The request | Read |
| --- | --- |
| A video to copy or remake | `/reverse-any-video` |
| An episode in a proven style | `/style-sampling` |
| Another film's style on a new topic | `references/look.md` |
| Launch, promo, feature | `references/types/launch.md` |
| Explainer, tutorial | `references/types/explainer.md` |
| Music video | `references/types/music.md` |
| Chart, numbers | `references/types/data.md` |
| Vertical or social clip | `references/types/vertical.md` |
| 3D, simulation, generative | `references/types/3d.md` |
| Character, mascot, story short | `references/types/character.md` |
| A real place or map; a website, PR or script; kinetic type | `references/film.md` |
| Captions; cards over a talking head | `references/captions.md`; `references/overlays.md` |
| Motion: eases, titles, cuts, punch-ins, speed, holds | `references/motion.md` |
| Scenes, attributes, media, lint; GSAP, Lottie, 3D, canvas | `references/format.md`; `references/runtimes.md` |

In Dérush, the CLI is `derush-hyperframes` (pinned by Dérush) and the skills come with Dérush.
