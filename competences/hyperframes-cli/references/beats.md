<!-- Modifié pour Dérush (IABAI) le 18 novembre 2026, d'après HyperFrames 0.9.64 (Apache-2.0, HeyGen, Inc.) : la commande s'appelle derush-hyperframes, et ce qui envoie des données à HeyGen (télémétrie, avis, usage, compte) est retiré. Détail dans SOURCE.md. -->
# Generate a project beat grid

Use `hyperframes beats` when an existing HyperFrames project needs the Studio-compatible beat file for its music track. This is a CLI utility, not a complete video workflow.

```bash
derush-hyperframes beats
derush-hyperframes beats ./my-video
derush-hyperframes beats ./my-video --json
```

Given an audio or video file instead of a folder (`derush-hyperframes beats music.mp3 --json`), `beats` analyses that file and prints `{ ok, file, count, bpm, beatTimes }`; it writes nothing.

The project must contain a local music `<audio>` source. Mark it with `data-timeline-role="music"`; an id containing `music`, `bgm`, or `soundtrack` is also recognized. The command decodes that file with ffmpeg, tracks its beats, and writes `beats/<audio-relative-path>.json`.

If the track has no steady beat, the command fails and writes nothing. If ffmpeg is missing, run `derush-hyperframes doctor`.

For a whole video cut to a music track, see `/hyperframes` → `references/film.md`.
