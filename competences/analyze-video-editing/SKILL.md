---
name: analyze-video-editing
description: À ouvrir quand la personne demande pourquoi une vidéo finie fonctionne ou ce qu'on peut en apprendre (film, documentaire, bande-annonce, clip, publicité, vidéo de référence), pour la décortiquer plan par plan (coupes, caméra, parole, son, titres, rythme, structure) en séparant le mesuré, le vu et l'interprété, et en tirer des principes à transposer sans la copier.
---

# Analyze Video Editing

## Dans Dérush

Les deux programmes d'origine ne sont pas livrés : l'un demandait d'installer des bibliothèques Python, l'autre envoyait le son à un service en ligne. La méthode reste entière, avec les outils qui sont déjà là.

- **La référence** est un fichier donné par la personne (`references/`, `contexte/`, ou un média du projet). Pour un lien, demande-lui le fichier : rien n'est installé pour télécharger une vidéo. Ne réutilise jamais les images ni le son de la référence dans le montage.
- **Pour reprendre le style d'un reel ou d'un TikTok** sur les rushes de la personne (coupes par seconde, zooms, bruitages, niveau de la musique, avec un essai comparé image par image), la compétence `steal` est plus directe. Ici, on comprend comment un montage fonctionne pour en tirer des principes ; les deux se complètent.
- **Les mesures**, avec les compétences `media-analysis` et `ffmpeg-skill` (`<ffmpeg-skill>` est son dossier) et FFmpeg :
  - coupes, silences, niveau du son : `media-analysis analyze <ref> --kind scene_detection --kind silence --kind loudness --json` ;
  - profil de style (durée des plans, coupes par minute, sous-titres incrustés) : `media-analysis style profile <ref> --out atelier/ref/style.json` (crée d'abord le dossier `atelier/ref/`) ;
  - tempo et temps de la musique : `python3 <ffmpeg-skill>/scripts/scenes.py <ref> --beats --json` ;
  - une planche de tout le film : `python3 <ffmpeg-skill>/scripts/look.py <ref> --tiles 6x5 --width 1600 -o atelier/ref/planche.png` ;
  - 12 images serrées sur 2 secondes autour d'une coupe, d'un noir ou d'un titre (T − 1 s) : `ffmpeg -v error -y -ss <T-1> -t 2 -i <ref> -vf "fps=6,scale='min(400,iw)':-2,tile=6x2:nb_frames=12" -frames:v 1 atelier/ref/bande-<T>.jpg` ;
  - le son en image : `ffmpeg -v error -y -ss <début> -t <durée> -i <ref> -filter_complex "[0:a]showspectrumpic=s=1600x900:legend=1:color=rainbow:scale=log:win_func=hann[s]" -map "[s]" -frames:v 1 atelier/ref/spectre.png` ;
  - le niveau par demi-seconde : `ffmpeg -v error -i <ref> -vn -af "aresample=48000,asetnsamples=n=24000,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=atelier/ref/niveaux.txt" -f null -`.
- **Si la référence est un média du projet**, Dérush l'a déjà préparée : `analyse/<rush>.json` (coupes de caméra, silences) et `transcriptions/<rush>.json` (les mots, avec leurs temps).
- **L'écoute reste sur l'ordinateur** : Earshot s'il est installé (compétence `earshot`). N'envoie jamais le son à un modèle en ligne, sauf si la personne le demande.
- **Le texte à l'écran et le mouvement de caméra** se lisent sur la planche et les bandes d'images : aucun programme ne les estime ici. Écris « semble » quand tu déduis.
- **Ensuite** : écris les principes retenus dans ton plan (`rendu/timeline.json`), monte avec la méthode de `MOTION.md` et le kit Remotion, puis compare ton montage à la référence : `media-analysis style profile rendu/final.mp4 --out atelier/ref/mon-style.json`, puis `media-analysis style diff atelier/ref/style.json atelier/ref/mon-style.json --json`.

## The method

Study how a finished video creates attention, emotion, and momentum. Treat the film as synchronized picture, sound, speech, typography, and structure—not merely a list of cuts.

## Start with a source you can inspect

Work from a local file. If download rights or site access are unclear, ask the user for a local copy.

Analyze a representative range first when the film is long.

Gather the evidence before interpreting: probe facts, shot boundaries, black and quiet intervals, audio levels, beat estimates, transcript cues; a contact sheet for the visual rhythm across the range; representative frames of each shot; dense strips of frames around major cuts, black intervals, and other events.

Scene detection, beat tracking, and text reading are candidate generators. They reduce scrubbing; they do not replace watching and editorial judgment.

When sound design, music continuity, or effects matter, pair semantic listening with signal evidence: a spectrogram and half-second loudness windows over the passage, then a focused pass around a cut, dropout, black interval, or suspected fade.

Read [references/audio-and-timing.md](references/audio-and-timing.md) before accepting a model's classification of quiet material.

## Build the breakdown in three layers

Keep these labels explicit:

1. **Measured:** timestamps, shot duration, hard-cut score, black frames, silence, audio level, detected beat, transcript words.
2. **Observed:** composition, subject, camera behavior, lighting, lens feel, text treatment, performance, apparent B-roll or interview mode.
3. **Interpreted:** tension, release, emphasis, contrast, narrative function, or why a juxtaposition works.

Never present a motion classifier or music estimate as certainty. Say “appears handheld” or “likely music re-entry” when it is an inference.

## Analyze the synchronized layers

For every important beat, ask:

- **Picture:** What is shown? What changes at the cut? Is the framing wide, medium, close, insert, or abstract?
- **Camera:** Static, locked-off, handheld, stabilized walk, pan, tilt, push-in, pull-out, rack focus, or subject motion inside a fixed frame?
- **Edit:** Hard cut, match cut, jump cut, dip to black, fade, dissolve, speed change, montage, or an unusually long hold?
- **Speech:** What line lands here? Is the next image literal illustration, contrast, reaction, or tonal counterpoint?
- **Sound:** Dialogue, room tone, ambience, effects, score, pulse, silence. What enters, exits, or changes level before or after the visual edit?
- **Typography:** Subtitle, chapter title, credit, label, or graphic motif? Record position, size, color, case, duration, entrance, and whether it obscures or complements the image.
- **Function:** Hook, escalation, orientation, reset, thesis, proof, character introduction, montage, transition, or payoff?

Read [references/editorial-analysis.md](references/editorial-analysis.md) for the reporting vocabulary and [references/audio-and-timing.md](references/audio-and-timing.md) for sound-driven analysis.

## Report at two scales

Create both:

- a **micro timeline** for the most instructive section, often every meaningful change over the first 60–180 seconds;
- a **macro grammar** for the whole film: recurring shot families, average shot length, interview/B-roll pattern, graphic system, music arcs, chapter resets, and escalation strategy.

A useful synthetic row looks like:

```text
01:03.875–01:06.167 | hard cut | handheld exterior insert |
score re-enters and beat becomes explicit | large chapter title fills frame |
turns a reflective line into a formal chapter launch
```

Avoid false precision in prose. Use frame-accurate numbers in the evidence table, then readable `mm:ss` timestamps in the explanation.

## Turn analysis into reusable learning

Extract principles, not imitations. For each device, state:

- the viewer problem it solves;
- the preconditions that make it work;
- the cost or risk;
- one way to adapt it to a different subject.

Example: “A four-second dip to black works here because the opening movement has accumulated tension and the continuing environmental sound prevents the reset from feeling like the video ended.”

If the user wants to apply the result, hand the evidence and selected principles to the `find-broll` skill for cutaway sourcing, then build the edit (see « Dans Dérush »). Do not encode the reference film's exact timings, fonts, or transitions as defaults.

## Quality bar

- Inspect representative frames and event strips yourself.
- Verify the transcript against picture when wording drives the edit.
- Check false cuts caused by flashes, large titles, or camera whip.
- Distinguish source subtitles from platform captions.
- Describe sound only to the resolution supported by the evidence.
- Prefer long-context semantic listening to establish cue identity, then focused passes around transitions.
- Verify alleged silence, ambience, music endings, and fades against the spectrogram and loudness trace.
- Cite the public source when the report refers to it.
- Do not redistribute the reference media.
