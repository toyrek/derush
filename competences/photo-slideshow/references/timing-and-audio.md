# Timing & beat-synced slide changes

Pacing is what separates a slideshow that feels alive from a screensaver. The rule: **lock the music first, derive slide boundaries from it.** Detect beats once, offline, and bake them into props — audio analysis per frame is non-deterministic and slow.

> **Dans Dérush.** La détection des temps passe par `scenes.py --beats` de `ffmpeg-skill` (rien à installer ;
> l'original demandait `pip install librosa`, et son script plantait avec librosa 0.10.2 et plus). Corrigé : dans un
> `<TransitionSeries>`, chaque fondu raccourcit le film ; avec des durées égales aux écarts entre temps, chaque
> changement arrivait un fondu plus tôt que le précédent (une mesure entière de décalage au bout de 4 photos à 120 BPM),
> et l'intro n'était pas comptée. Vérifié sur une piste à 120 BPM : chaque fondu est centré sur son temps.
> Le bloc de code suit ceux de `aspect-and-layout.md` dans `remotion/src/slideshow.tsx`.

## Pacing budgets

| Beat | Budget | Why |
|---|---|---|
| Intro card | 1.5–2s | let the title and date range register before motion |
| Per photo | 3–6s | long enough to read the moment; Ken Burns needs room to travel |
| Caption fade | in ~0.3s after settle, out ~0.3s before leave | text shouldn't move with the photo |
| Transition | 0.4–0.6s | crossfade overlap |
| Outro card | 2–3s | the ending lands on intent, not a mid-photo cut |

A photo held under ~2.5s feels rushed — viewers need time to actually see it. This is the main reason slideshows feel different from a music-video montage of motion clips.

## Detect beats once

```bash
python3 .claude/skills/ffmpeg-skill/scripts/scenes.py remotion/public/musique.mp3 --beats --json > atelier/temps.json
```

The answer gives `beats` (seconds) and `beat_grid` with `tempo_bpm`, `confidence` and `usable`. `usable: false` means no steady pulse (speech, ambience, rubato): use the tempo alone, or a fixed grid.

## Beat seconds → frames → slide changes

Remotion timelines are in frames. Change every 2nd, 4th or 8th beat (a half-bar, a bar, two bars in 4/4) — every beat is too frantic for photos. The first photo lands on the first beat after the intro card. Then each sequence lasts its gap plus the transition, so each crossfade stays centred on its beat.

```tsx
// ===== references/timing-and-audio.md
// marks: one frame per photo change (marks[0] = from the intro card to photo 0) + the change to the outro card.
// stride = beats per photo (4 = one photo per bar in 4/4). The first photo lands on the first beat after the intro.
export function marksFromBeats(beatFrames: number[], stride: number, totalPhotos: number, introFrames: number) {
  const first = Math.max(0, beatFrames.findIndex((f) => f >= introFrames));
  const marks: number[] = [];
  for (let i = first; i < beatFrames.length && marks.length <= totalPhotos; i += stride) marks.push(beatFrames[i]);
  const gap = marks.length > 1 ? marks[marks.length - 1] - marks[marks.length - 2] : stride * 15;
  while (marks.length <= totalPhotos) marks.push((marks[marks.length - 1] ?? introFrames) + gap); // music shorter than the photos
  return marks;
}
export function bpmGrid({bpm = 120, beatsPerSlide = 4, fps = 30, totalPhotos, introFrames = 50}:
  {bpm?: number; beatsPerSlide?: number; fps?: number; totalPhotos: number; introFrames?: number}) {
  const slideFrames = Math.round((60 / bpm) * beatsPerSlide * fps);
  return Array.from({length: totalPhotos + 1}, (_, i) => introFrames + i * slideFrames);
}
// In a <TransitionSeries> each transition overlaps its two neighbours: a sequence lasts (gap to the next mark + the
// transition) so every crossfade stays centred on its mark, and the film ends exactly at the last mark + the outro.
export function seriesDurations(marks: number[], T: number, outroFrames: number) {
  return {
    intro: marks[0] + Math.ceil(T / 2),
    slides: marks.slice(0, -1).map((m, i) => marks[i + 1] - m + T),
    outro: outroFrames + Math.floor(T / 2),
    total: marks[marks.length - 1] + outroFrames,
  };
}
```

`marksDe` (in `templating-folder.md`) picks the beats or the grid and, by default, the smallest musical unit that gives 3 s or more per photo.

Two refinements that read as intentional editing:
- **Hit the drop with the hero shot.** Find the biggest energy jump (`scenes.py --audio-peaks` gives the loudness peaks, in seconds) and place the best photo's change on the beat closest to it.
- **Slow down on the keepers.** Give a few standout photos a double-length hold so the rhythm has dynamics, not a metronome.

## No-audio-analysis fallback (BPM grid)

When the track is steady, or the measure is not usable, a fixed BPM grid is plenty: slide duration in frames = `(60 / bpm) * beatsPerSlide * fps` (`bpmGrid` above). Use the measured `tempo_bpm`, or the tempo given with the track.

## Mounting the audio

Add the track once at the composition root; the total duration comes from the marks (`dureeDiaporama`). If the music is longer than the photos, it fades out over the last 1.5s instead of being cut dead (the `volume` function of `<Audio>` in `Slideshow`). To start the music later in the track, use `trimBefore` (in frames) on `<Audio>` — `startFrom`/`endAt`, in the original, are deprecated since Remotion 4.0.319.
