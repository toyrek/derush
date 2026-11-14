---
name: photo-slideshow
description: À ouvrir pour faire une vidéo à partir d'un dossier de photos (diaporama, vidéo souvenir, récap d'un atelier, d'un voyage ou d'un événement, photos en musique) : un Ken Burns différent pour chaque photo sans bord vide, une seule transition, les changements de photo sur les temps de la musique, les photos verticales et horizontales mélangées sur fond flou, cartons d'ouverture et de fin.
---

# Slideshow Video

> **Dans Dérush.** Ce savoir vient d'iart.ai (voir `SOURCE.md`). Le goût de l'auteur est gardé ; son code était faux
> à plusieurs endroits et demandait des installations. Tout a été refait avec les outils d'ici et essayé de bout en
> bout : dossier de photos (dont une photo tournée par l'EXIF et une HEIC) → manifeste → temps de la musique →
> vidéo rendue, synchro vérifiée sur un temps.
>
> | Ce qu'il te faut | Où c'est |
> |---|---|
> | Préparer les photos | `manifeste.py` (`references/templating-folder.md`) : Python sans dépendance + FFmpeg (+ `sips` pour une HEIC, sur Mac). Les originaux ne sont jamais modifiés. |
> | Les temps de la musique | `scenes.py musique.mp3 --beats --json` de la compétence `ffmpeg-skill` (dans `.claude/skills/ffmpeg-skill/scripts/`) |
> | Le diaporama | la composition `Slideshow` (Remotion, kit `remotion/`), déclarée dans `remotion/src/Racine.tsx` |
> | Sans Remotion | `insert.py`, `join.py`, `audio.py` de `ffmpeg-skill` (`references/templating-folder.md`) |
> | Regarder avant de rendre | `node remotion/images.mjs Diaporama --images …`, puis `node remotion/rendre.mjs`, `derush-controle`, `derush-son mesurer` |
>
> La vidéo est verticale (1080 × 1920) par défaut : c'est le format des réseaux. Les légendes ne viennent que de la
> personne : jamais un nom de fichier (« IMG_2034 ») à l'écran. Les passages « Dans Dérush » sont des ajouts ; le
> reste est le texte de l'auteur.

Turn a set of photos into a finished video that feels shot, not assembled. The craft is giving each still its own gentle motion (Ken Burns), changing slides on the music, handling photos of different shapes gracefully, and reading a whole folder so the same template renders any set of images.

## When to use

- A folder of photos → one finished MP4 (the headline use case).
- "Memories", recap, year-in-review, wedding/trip montage with music.
- Any still-image set that needs motion, transitions, and synced pacing.

## The one rule that makes a slideshow look professional

**No two slides may move the same way.** The instant-giveaway of an amateur slideshow is every photo doing the identical slow zoom-in. Vary direction, zoom in vs. out, and start scale per photo — but make it **deterministic** (seeded by index), so re-renders are identical and a frame-based renderer stays stable. Precompute the moves for the whole list and re-roll any that equals the previous one (`motionsFor` in `references/ken-burns.md`).

## Per-photo Ken Burns

Each slide picks one move from a small vocabulary so the set has rhythm without repetition. Animate `scale` and `translate` together; never animate `width`/`height` (it reflows and flickers).

| Knob | Range | Why |
|---|---|---|
| Zoom | in `1.05→1.11–1.17` or out the other way | subtle: a 6–12 % change; more than ~15 % feels like a crash-zoom |
| Pan | one of L/R/up/down/diagonal | direction chosen by seed, never all the same |
| Ease | `easeInOutSine` | slow, continuous — Ken Burns has no acceleration jolt |
| Anchor | `transform-origin` toward the subject | keeps a face/horizon in frame while panning |

A start scale of 1.05 is **not** enough by itself to hide the edges: scaled about its anchor, the photo only overflows the frame by (scale − 1) × size × anchor on each side — 27 px at 1.05 on a 1080 px side — while a drift can reach 60 px. The drift must stay inside that room, on the side it uncovers, at every frame. `KenBurnsImage` (`references/ken-burns.md`) caps it at 90 % of the room; it was checked on all eight moves, centred and anchored on the upper third, with no uncovered edge.

## Transitions between photos

Pick **one** transition and keep it consistent — mixing wipes, spins and cubes screams "template." A 0.4–0.6s crossfade is the safe, timeless default; a soft push works for travel sequences. Overlap outgoing and incoming slides so the cut is never hard unless cutting on a beat.

```tsx
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
// <TransitionSeries.Sequence durationInFrames={hold}> ...slide... </TransitionSeries.Sequence>
// <TransitionSeries.Transition timing={linearTiming({durationInFrames: 15})} presentation={fade()} />
```

Each transition overlaps its two neighbours, so the film is shorter than the sum of the sequences: a sequence lasts (gap to the next change + the transition) for every crossfade to stay centred on its change (`seriesDurations` in `references/timing-and-audio.md`).

## Beat / music-synced slide changes

A slideshow lives or dies on pacing. Lock the track first, get the beat timestamps, then snap each slide change to a beat. Detect beats once (offline) and bake them into props — never analyze audio per frame.

```bash
python3 .claude/skills/ffmpeg-skill/scripts/scenes.py musique.mp3 --beats --json > atelier/temps.json
# → "beats": [0.249, 0.749, …] (seconds), "beat_grid": {"tempo_bpm": 120.0, "usable": true, …}
```

Then convert beat seconds → frame numbers and assign slide boundaries. Hold each photo for a musical unit (often every 2nd or 4th beat — every beat is too frantic for photos). For the count→frame math, the rhythm-to-slide assignment, and a no-audio-analysis fallback (fixed BPM grid), see `references/timing-and-audio.md`.

> Dans Dérush : par défaut, l'unité est la plus petite (2, 4, 8… temps) qui donne 3 secondes ou plus par photo. Si
> `usable` vaut `false` (pas de pulsation nette), passe le tempo seul : la grille fixe suffit.

## Mixed aspect-ratio photos

A real folder mixes portrait phone shots and landscape cameras. Never stretch — distortion is unforgivable. Three strategies, in order of preference:

| Strategy | Look | Use when |
|---|---|---|
| **Blurred pad** | photo fit inside frame, a scaled+blurred copy fills the bars | mixed orientations, default choice |
| **Fill (cover)** | photo fills frame, edges cropped | photos roughly match the frame shape |
| **Fit (letterbox)** | photo fully visible on solid/gradient | every pixel matters (documents, art) |

Blurred-pad is the modern standard because it fills the frame without cropping the subject. Render the same source twice: a `cover` blurred layer behind, the `contain` sharp photo on top. See `references/aspect-and-layout.md` for the component and the orientation-detection logic.

## Captions, dates, intro/outro

- **Captions/dates**: from the person (a `captions.json` keyed by file name) or the EXIF date; keep them in a fixed lower zone, fade in after the slide settles (~0.3s), out before it leaves.
- **Intro card**: title + date range, held 1.5–2s, before the first photo.
- **Outro card**: a closing line or a contact/CTA, held 2–3s, so the video ends on intent, not a fade to black mid-photo.

> Dans Dérush : un nom de fichier n'est jamais une légende (`IMG_2034`, `IMG-20240612-WA0001`, `PXL_…`, `DSC…`). Pas
> de légende vaut mieux qu'une légende inventée.

## Templating a folder → a video

The payoff: point the pipeline at a folder, derive the timeline from the file list, render once. Nothing about the photos is hardcoded — count, order, captions and durations all come from data.

```bash
python3 manifeste.py "<photo folder>" captions.json > atelier/manifeste.json   # photos copied upright into remotion/public/photos/
python3 .claude/skills/ffmpeg-skill/scripts/scenes.py remotion/public/musique.mp3 --beats --json > atelier/temps.json
# merge title, music, beats and photos into atelier/diaporama.json (references/templating-folder.md), then:
node remotion/images.mjs Diaporama --images 30,…            # stills first, with the real photos in defaultProps
node remotion/rendre.mjs Diaporama rendu/final.mp4 --props "$(cat atelier/diaporama.json)"
```

Keep colors, fonts, transition and slide duration in one theme object so every render stays consistent and only the photos change. See `references/templating-folder.md` for the manifest builder (natural sort, EXIF capture date, upright copies, blurred backgrounds), the full data-driven `<Slideshow>`, and an FFmpeg-only path for when Remotion isn't the right tool.

## Output checklist

- Every photo's motion is seeded by index — varied direction/zoom, no two identical in a row.
- All motion is a pure function of `useCurrentFrame()`; the drift never uncovers an edge.
- One consistent transition (crossfade default), overlapped not hard-cut.
- Slide changes land on beats; photos hold ≥1 musical unit (3–6s), not every beat.
- Mixed aspect ratios handled by blurred-pad — nothing stretched.
- Captions only from the person, in a fixed zone; intro and outro cards bookend the set.
- Photos, captions and durations come from the folder manifest — one template, any set.

## Deliver & verify

> Dans Dérush, cette partie remplace celle de l'original (`npx remotion`, scripts du dépôt, GIF de démonstration).

This is heavy-tier: the deliverable is an MP4, not a live page. A slideshow ingests a whole folder of user photos — the verify pass is mostly *did every photo actually load and reframe without distortion*.

**Contract:**
- The composition `Diaporama` (component `Slideshow`) in the kit, its length from `calculateMetadata` (`dureeDiaporama`), Ken Burns, transitions and beat timing all pure functions of `useCurrentFrame()`; motion seeded by index, not `Math.random()`.
- Photos in `remotion/public/photos/`, loaded via `staticFile()` and `<Img>` (which waits for each image before its frame renders); the kit fonts awaited with `usePolices()`.

**Verify loop — stills → inspect → render.**

1. `node remotion/images.mjs Diaporama --images …`: the intro card, a frame in the middle of each photo, a frame on a change (mid-crossfade), the outro. With the real photos.
2. Inspect for **fidelity** (correct photo on each slide, upright; caption/date text right; blurred-pad fills mixed aspect ratios without stretch) and **artifacts** (photo blank/not loaded, stretched, an uncovered edge, caption in a platform zone).
3. `node remotion/rendre.mjs Diaporama rendu/final.mp4 --props "$(cat atelier/diaporama.json)"`; then `derush-son mesurer rendu/final.mp4` (aim −14 LUFS; if the music is off, prepare it first with `derush-son mixer`, see `OUTILS.md`), and `derush-controle rendu/final.mp4`.

## Reference files

- `references/ken-burns.md` — the seeded `<KenBurnsImage>` Remotion component: a per-photo motion vocabulary chosen by `mulberry32(index)`, no repeat twice in a row, subject-aware `transform-origin`, the safe-drift math, and the FFmpeg equivalent (`insert.py`).
- `references/timing-and-audio.md` — beat detection with `scenes.py`, beat-seconds → frames, musical-unit slide assignment, the BPM-grid fallback, the transition overlap, pacing budgets per photo, and the music (fade-out, trims).
- `references/aspect-and-layout.md` — orientation detection, the blurred-pad / cover / contain layouts as components, the blurred background made once with FFmpeg, and the platform zones for 9:16, 16:9 and 1:1.
- `references/templating-folder.md` — the folder → manifest builder, the full data-driven `<Slideshow>` with intro/outro cards and captions, the props merge, the render, and a pure-FFmpeg pipeline.
