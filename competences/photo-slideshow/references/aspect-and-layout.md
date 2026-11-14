# Aspect ratios & layout

A real photo folder mixes portrait phone shots (3:4, 9:16), landscape cameras (3:2, 4:3), and the odd square. The frame is one fixed shape. **Never stretch a photo to fit** — non-uniform scaling distorts faces and is the most jarring error in a slideshow. Choose a fitting strategy instead.

> **Dans Dérush.** Corrigé : dans l'original, la photo nette du fond flou restait en `cover`, si bien que le fond
> n'était jamais visible et que les portraits étaient recadrés. Elle passe en `contain` (réglage `fit` de
> `KenBurnsImage`). Le fond est flouté une seule fois avec FFmpeg (par `manifeste.py`) au lieu d'un flou CSS recalculé
> à chaque image. Les zones sûres sont celles du kit. Le bloc de code ci-dessous suit ceux de `ken-burns.md` dans
> `remotion/src/slideshow.tsx`.

## The three strategies

| Strategy | What it does | Trade-off | Use when |
|---|---|---|---|
| **Blurred pad** | photo fit (`contain`) over a scaled+blurred copy of itself (`cover`) | none visually; the modern default | mixed orientations |
| **Fill / cover** | photo fills the frame, edges cropped off | crops the subject's edges | photos roughly match frame shape |
| **Fit / letterbox** | photo fully visible on a solid/gradient | dead bars | every pixel matters (art, documents) |

Blurred-pad wins for mixed folders: it fills the frame, never crops the subject, and the soft blur reads as intentional depth rather than empty bars.

## Orientation detection and the blurred pad

Decide per photo from its natural dimensions (read, upright, by `manifeste.py`). A photo is "matched" to the frame if its aspect ratio is within ~15% of the frame's. The Ken Burns transform applies to the **front** photo only, in `contain` with a small drift; the blurred layer stays static, as a backdrop.

```tsx
// ===== references/aspect-and-layout.md
export function fitStrategy(imgW: number, imgH: number, frameW: number, frameH: number) {
  const mismatch = Math.abs(imgW / imgH - frameW / frameH) / (frameW / frameH);
  return mismatch < 0.15 ? 'cover' : 'blurred-pad';
}
// `fond`: the same photo blurred ONCE with FFmpeg (fast). Without it, a CSS blur recomputed on every frame (slow).
export const BlurredPad: React.FC<{src: string; fond?: string; children: React.ReactNode}> = ({src, fond, children}) => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    <Img src={fond ?? src} style={{width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.1)',
      filter: fond ? undefined : 'blur(40px) brightness(0.7)'}} />
    {children}
  </AbsoluteFill>
);
```

The blurred background, made once per photo (this is what `manifeste.py` does):

```bash
ffmpeg -i photo.jpg -vf "scale=480:-2,gblur=sigma=12,eq=brightness=-0.12" -q:v 4 flou/photo.jpg
```

### FFmpeg blurred-pad still (one photo, for the FFmpeg-only path)

```bash
ffmpeg -i photo.jpg -filter_complex \
  "[0]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40[bg];\
   [0]scale=1080:1920:force_original_aspect_ratio=decrease[fg];\
   [bg][fg]overlay=(W-w)/2:(H-h)/2" -frames:v 1 atelier/photo-pad.jpg
```

Then `insert.py atelier/photo-pad.jpg …` (see `ken-burns.md`) gives its Ken Burns clip.

## Multi-aspect export & safe zones

Compose with a safe zone so one master reframes cleanly to every platform — don't just letterbox a 16:9 into 9:16.

| Aspect | Use | Resolution | Safe zone |
|---|---|---|---|
| 9:16 | Reels, TikTok, Shorts, Stories | 1080×1920 | text clear of the top 10 %, the bottom 22 % and the right 14 % (TikTok, the widest; `ZONE_SURE` of the kit) |
| 16:9 | YouTube, desktop, TV | 1920×1080 | captions within center 90% |
| 1:1 | Feed posts | 1080×1080 | center square of the 16:9 frame |

Keep titles, dates and the outro CTA inside the zones that survive every crop. For vertical (9:16) slideshows of mostly-landscape photos, blurred-pad is almost mandatory — a landscape photo `contain`-fit into 9:16 leaves huge bars that the blur turns into a full, finished frame.

Render the composition once per aspect (one `<Composition>` per format, same component and props); the photos, motion and timing stay identical.
