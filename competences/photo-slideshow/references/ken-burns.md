# Ken Burns — seeded per-photo motion

The goal: every still gets a slow, continuous pan+zoom, but **each photo moves differently** and the difference is **deterministic** (seeded by its index). Deterministic matters for video: a frame renderer may render frame 200 before frame 10, so randomness must come from a pure function of the index, never `Math.random()`.

> **Dans Dérush.** Le vocabulaire de mouvements, le générateur `mulberry32` et l'ancrage sur le sujet sont ceux de
> l'auteur. Corrigés et vérifiés : le calcul de la dérive (l'original découvrait un bord vide jusqu'à 36 px à la fin
> des mouvements « zoom arrière + diagonale »), le tirage qui évite deux fois le même mouvement (annoncé, pas fait),
> le réglage `fit` pour le fond flou (l'original recadrait toujours en `cover`). Ces blocs ouvrent le fichier
> `remotion/src/slideshow.tsx` (suite dans les autres références) :

```tsx
import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {usePolices} from './pieces/commun';
```

## The motion vocabulary, the seeded PRNG, the component

Eight moves cover it: zoom-in or zoom-out, crossed with a pan direction. `mulberry32` is a tiny, fast, well-distributed 32-bit PRNG: seeded with the photo index, photo 0 always gets the same move. The moves are precomputed for the whole list, and one that equals the previous photo's is re-rolled — cheap, and worth it for the polish.

```tsx
// ===== references/ken-burns.md
export const MOVES = [
  {zoom: 'in', pan: [1, 0]},   // zoom in, drift right
  {zoom: 'in', pan: [-1, 0]},  // zoom in, drift left
  {zoom: 'in', pan: [0, 1]},   // zoom in, drift down
  {zoom: 'in', pan: [0, -1]},  // zoom in, drift up
  {zoom: 'out', pan: [1, 1]},  // pull back, diagonal
  {zoom: 'out', pan: [-1, -1]},
  {zoom: 'out', pan: [1, -1]},
  {zoom: 'in', pan: [-1, 1]},
] as const;
export type Motion = {k: number; move: (typeof MOVES)[number]; zoomAmt: number; panAmt: number};

const mulberry32 = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// One motion per photo, decided once for the whole list: seeded by the index (identical on every render),
// and re-rolled when it would repeat the previous photo's move.
export function motionsFor(count: number): Motion[] {
  const out: Motion[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(i * 2654435761);      // spread indices apart
    let k = Math.floor(rng() * MOVES.length);
    if (i > 0 && k === out[i - 1].k) k = (k + 1 + Math.floor(rng() * (MOVES.length - 1))) % MOVES.length;
    out.push({k, move: MOVES[k], zoomAmt: 0.06 + rng() * 0.06, panAmt: 24 + rng() * 36});  // 0.06–0.12 zoom, 24–60 px drift
  }
  return out;
}

export const KenBurnsImage: React.FC<{src: string; motion: Motion; durationInFrames: number; anchor?: [number, number]; fit?: 'cover' | 'contain'}> =
({src, motion, durationInFrames, anchor = [0.5, 0.5], fit = 'cover'}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const {move, zoomAmt, panAmt} = motion;
  // p: 0 → 1 over the slide, eased like real Ken Burns (no jolt)
  const p = interpolate(frame, [0, durationInFrames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin)});
  const base = 1.05;
  const max = base + zoomAmt;
  const scale = move.zoom === 'in' ? base + zoomAmt * p : max - zoomAmt * p;
  // The drift is widest when the photo is largest: it grows with a zoom-in and shrinks back with a pull-back.
  const k = move.zoom === 'in' ? p : 1 - p;
  // Moving the photo right uncovers its LEFT edge: the room there is (scale − 1) × size × anchor.
  const room = (dir: number, a: number, size: number) => (max - 1) * size * (dir > 0 ? a : 1 - a);
  // cover: never more than 90 % of that room. contain (over the blurred pad): a small drift.
  const reach = (dir: number, a: number, size: number) => (fit === 'cover' ? Math.min(panAmt, 0.9 * room(dir, a, size)) : panAmt * 0.5);
  const x = move.pan[0] * reach(move.pan[0], anchor[0], width) * k;
  const y = move.pan[1] * reach(move.pan[1], anchor[1], height) * k;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Img src={src} style={{width: '100%', height: '100%', objectFit: fit,
        transformOrigin: `${anchor[0] * 100}% ${anchor[1] * 100}%`,
        transform: `translate(${x}px, ${y}px) scale(${scale})`}} />
    </AbsoluteFill>
  );
};
```

## The safe-drift math

With `transform-origin` at the anchor `a` (0–1) and a scale `s`, the photo overflows the frame by `(s − 1) × size × a` on the side before the anchor and `(s − 1) × size × (1 − a)` after it. Moving the photo right uncovers its LEFT edge, so a rightward drift must stay under the left overflow — and so on for each direction. The component takes that room at the largest scale and stays under 90 % of it; since the drift grows with a zoom-in and shrinks back with a pull-back, it is safe at every frame, not only at the end. Checked on all eight moves, centred (zoom change 0.06) and anchored on the upper third (0.12), at the first, middle and last frame, over a magenta background: no edge uncovered.

## Subject-aware anchoring

A pan that pushes a face out of frame looks broken. If subject coordinates are known (a manual focal point in the manifest), set the anchor toward the subject so it stays framed as the image scales.

```ts
// focal point in 0–1 image space → the `anchor` prop of KenBurnsImage
const anchor: [number, number] = focal ? [focal.x, focal.y] : [0.5, 0.5];
```

Without detection, a useful heuristic: anchor portraits toward the upper third (faces sit high), landscapes at center.

## Why not animate width/height

Animating `width`/`height` (or `top`/`left`) triggers layout on every frame — it stutters and can flicker on a renderer. `transform: scale()/translate()` is composited on the GPU and is frame-exact. Always Ken Burns with `transform`.

## FFmpeg equivalent

> Dans Dérush, cette partie remplace les commandes `zoompan` de l'original : elles étiraient toute photo qui n'avait
> pas le format du cadre, zoomaient vers le coin haut gauche faute de `x`/`y`, et s'arrêtaient net en fin de zoom.

When Remotion isn't the right tool, `insert.py` of `ffmpeg-skill` does a Ken Burns on one photo: it fills the frame (centre crop, never distorted), turns an EXIF-rotated photo upright, and zooms linearly.

```bash
python3 .claude/skills/ffmpeg-skill/scripts/insert.py photo.jpg --duration 5 --zoom in --pan right --zoom-amount 1.10 \
  --width 1080 --height 1920 --fps 30 -o atelier/clip_001.mp4
```

Keep `--zoom-amount` between 1.06 and 1.12 (its default, 1.3, is a crash-zoom for a slideshow), and vary `--zoom in|out` and `--pan left|right|up|down` per photo from the same seeded list. For a photo of another shape, make its blurred-pad still first (`aspect-and-layout.md`). Remotion is far easier for varied, beat-synced, captioned sets; reach for this path only for quick, uniform batches.
