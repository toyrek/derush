# Templating a folder of photos → a video

The payoff of a code-driven slideshow: point it at a folder, derive the entire timeline from the file list, render once. Nothing is hardcoded — count, order, captions and per-photo durations all come from a manifest. Swap the folder, re-render, done.

> **Dans Dérush.** L'original construisait le manifeste avec `sharp` et `exifr` (à installer ; `sharp` télécharge un
> binaire), gardait un chemin du disque que Remotion ne peut pas servir (photos vides), plantait à la première HEIC
> d'iPhone, lisait la taille avant la rotation EXIF (portraits pris pour des paysages), mettait en tête toutes les
> photos sans date (WhatsApp, captures) et affichait le nom du fichier en légende. Son rendu (`--props=photos.json`)
> plantait (la composition lisait `slides`, absent), et `Caption` n'était défini nulle part. Tout est refait ici et a
> été essayé : cinq photos (dont une tournée par l'EXIF, une HEIC, une datée par son nom WhatsApp), une musique,
> la vidéo rendue.

## Build the manifest

```python
# python3 manifeste.py <photo folder> [captions.json] > atelier/manifeste.json   (from the pack folder)
# Copies every photo, upright and lighter, into remotion/public/photos/ (the originals are never touched), makes its
# blurred background once, and writes the list the Slideshow reads. Python standard library + FFmpeg (+ sips for HEIC).
import json, os, re, subprocess, sys, tempfile

EXT = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}
OUT = 'remotion/public/photos'
src_dir = sys.argv[1]
captions = json.load(open(sys.argv[2], encoding='utf-8')) if len(sys.argv) > 2 else {}   # {"IMG_2034.jpg": "Le premier jour"}

def natural(name):                       # photo2 before photo10
    return [int(x) if x.isdigit() else x.lower() for x in re.split(r'(\d+)', name)]

def run(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=120)

def capture_date(path, name):
    # 1. the camera's EXIF capture date, as FFmpeg reads it
    r = run('ffprobe', '-v', 'error', '-select_streams', 'v:0', '-read_intervals', '%+#1', '-show_entries', 'frame_tags', '-of', 'json', path)
    try:
        for frame in json.loads(r.stdout or '{}').get('frames', []):
            for k, v in (frame.get('tags') or {}).items():
                m = re.match(r'(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})', v) if k.endswith('DateTimeOriginal') else None
                if m:
                    return '%s-%s-%sT%s:%s' % m.groups()
    except ValueError:
        pass
    # 2. a date in the file name: IMG-20240612-WA0001 (WhatsApp), PXL_20240612_…, IMG_20240612_…, 2024-06-12 …
    m = re.search(r'(20\d\d)[-_]?([01]\d)[-_]?([0-3]\d)', name)
    return '%s-%s-%sT00:00' % m.groups() if m else None

names = sorted((n for n in os.listdir(src_dir) if os.path.splitext(n)[1].lower() in EXT), key=natural)
os.makedirs(OUT + '/flou', exist_ok=True)
photos, last = [], ''
with tempfile.TemporaryDirectory() as tmp:
    for i, name in enumerate(names, start=1):
        path = os.path.join(src_dir, name)
        date = capture_date(path, name)
        if os.path.splitext(name)[1].lower() in ('.heic', '.heif'):   # Remotion's browser cannot show HEIC
            jpg = os.path.join(tmp, f'{i}.jpg')
            if run('sips', '-s', 'format', 'jpeg', path, '--out', jpg).returncode != 0:
                print(f'{name} : conversion HEIC impossible, photo ignorée', file=sys.stderr)
                continue
            path = jpg
        dst, blur = f'{OUT}/{i:03d}.jpg', f'{OUT}/flou/{i:03d}.jpg'
        # FFmpeg turns an EXIF-rotated photo upright on decode; long side at most 2400 px
        fit = "scale='if(gt(iw,ih),min(2400,iw),-2)':'if(gt(iw,ih),-2,min(2400,ih))'"
        if run('ffmpeg', '-v', 'error', '-y', '-i', path, '-vf', fit, '-q:v', '3', dst).returncode != 0:
            print(f'{name} : illisible, photo ignorée', file=sys.stderr)
            continue
        run('ffmpeg', '-v', 'error', '-y', '-i', dst, '-vf', 'scale=480:-2,gblur=sigma=12,eq=brightness=-0.12', '-q:v', '4', blur)
        w, h = map(int, run('ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', dst).stdout.strip().split(','))
        last = date or last                   # an undated photo keeps its place next to its neighbours
        p = {'src': f'photos/{i:03d}.jpg', 'fond': f'photos/flou/{i:03d}.jpg', 'width': w, 'height': h, 'date': date, '_ordre': (last, i)}
        if captions.get(name):                # a caption only when the person gave one: never "IMG_2034" on screen
            p['caption'] = captions[name]
        photos.append(p)
photos.sort(key=lambda p: p.pop('_ordre'))
json.dump({'photos': photos}, sys.stdout, ensure_ascii=False, indent=1)
```

Decisions baked in here, all common slideshow pain points:
- **Natural sort** so `IMG_2` precedes `IMG_10` (lexical sort puts `10` before `2`).
- **EXIF capture date** (as FFmpeg reads it) for true chronological order — file dates are unreliable after copying; otherwise a date in the file name (WhatsApp, Pixel, screenshots); a photo with neither keeps its place next to its neighbours.
- **Upright, lighter copies** in `remotion/public/photos/` (Remotion only serves `public/`), HEIC converted to JPEG first; **sizes read on the upright copy**.
- **Captions only from the person** (`captions.json` keyed by file name) — never a camera file name on screen.

## The data-driven composition

The composition reads `photos` and the timing; it hardcodes nothing. Theme lives in one object so 50 renders stay consistent. These blocks end `remotion/src/slideshow.tsx`, after those of `ken-burns.md`, `aspect-and-layout.md` and `timing-and-audio.md`.

```tsx
// ===== references/templating-folder.md
export const THEME = {bg: '#0b0b0f', font: 'Montserrat', accent: '#ffffff', transitionFrames: 15, introFrames: 50, outroFrames: 75};
export type Photo = {src: string; width: number; height: number; fond?: string; caption?: string; focal?: [number, number]};
export type SlideshowProps = {
  photos: Photo[]; title: string; dateRange?: string; outro?: string;
  music?: string | null;      // a file in remotion/public/
  beats?: number[];           // beat times in seconds (scenes.py --beats); empty: a fixed BPM grid
  bpm?: number;               // the measured tempo, or a tapped one
  stride?: number;            // beats per photo; by default the musical unit (2, 4, 8…) that gives 3 s or more
};
// The photo changes, in frames — the same function for the composition and for calculateMetadata.
export function marksDe(p: SlideshowProps, fps: number) {
  const bpm = p.bpm ?? 120;
  const stride = p.stride ?? ([2, 4, 8, 16].find((s) => (s * 60) / bpm >= 3) ?? 16);
  return p.beats?.length
    ? marksFromBeats(p.beats.map((s) => Math.round(s * fps)), stride, p.photos.length, THEME.introFrames)
    : bpmGrid({bpm, beatsPerSlide: stride, fps, totalPhotos: p.photos.length, introFrames: THEME.introFrames});
}
export const dureeDiaporama = (p: SlideshowProps, fps: number) => seriesDurations(marksDe(p, fps), THEME.transitionFrames, THEME.outroFrames).total;

const Card: React.FC<{title: string; subtitle?: string}> = ({title, subtitle}) => (
  <AbsoluteFill style={{background: THEME.bg, color: THEME.accent, fontFamily: THEME.font,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 18, padding: '0 8%', textAlign: 'center'}}>
    <div style={{fontSize: 84, fontWeight: 800, lineHeight: 1.05}}>{title}</div>
    {subtitle && <div style={{fontSize: 40, fontWeight: 600, opacity: 0.7}}>{subtitle}</div>}
  </AbsoluteFill>
);

// caption in a fixed lower zone (above the platform's bottom 22 %): in ~0.3 s after the slide settles, out before it leaves
const Caption: React.FC<{text: string; durationInFrames: number}> = ({text, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const T = THEME.transitionFrames, f = Math.round(fps * 0.3);
  const o = interpolate(frame, [T + f, T + 2 * f, durationInFrames - T - 2 * f, durationInFrames - T - f], [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * 0.25}}>
      <div style={{opacity: o, color: '#fff', fontFamily: THEME.font, fontWeight: 600, fontSize: Math.round(height * 0.03),
        padding: '12px 26px', borderRadius: 14, background: 'rgba(0,0,0,.55)'}}>{text}</div>
    </AbsoluteFill>
  );
};

export const Slideshow: React.FC<SlideshowProps> = (props) => {
  const {photos, music, title, dateRange, outro = 'Merci'} = props;
  const ok = usePolices();                                  // the kit's fonts, loaded before anything is drawn
  const {width, height, durationInFrames, fps} = useVideoConfig();
  if (!ok) return null;
  const T = THEME.transitionFrames;
  const d = seriesDurations(marksDe(props, fps), T, THEME.outroFrames);
  const motions = motionsFor(photos.length);
  const fadeOut = Math.round(1.5 * fps);
  const cut = (key: string) => <TransitionSeries.Transition key={key} timing={linearTiming({durationInFrames: T})} presentation={fade()} />;
  return (
    <AbsoluteFill style={{background: THEME.bg}}>
      {/* the music fades out over the last 1.5 s instead of being cut dead */}
      {music && <Audio src={staticFile(music)} volume={(f) => interpolate(f, [durationInFrames - fadeOut, durationInFrames], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={d.intro}><Card title={title} subtitle={dateRange} /></TransitionSeries.Sequence>
        {photos.flatMap((p, i) => {
          const src = staticFile(p.src);
          const pad = fitStrategy(p.width, p.height, width, height) === 'blurred-pad';
          const kb = <KenBurnsImage src={src} motion={motions[i]} durationInFrames={d.slides[i]} anchor={p.focal} fit={pad ? 'contain' : 'cover'} />;
          return [
            cut(`t${i}`),
            <TransitionSeries.Sequence key={`s${i}`} durationInFrames={d.slides[i]}>
              {pad ? <BlurredPad src={src} fond={p.fond ? staticFile(p.fond) : undefined}>{kb}</BlurredPad> : kb}
              {p.caption && <Caption text={p.caption} durationInFrames={d.slides[i]} />}
            </TransitionSeries.Sequence>,
          ];
        })}
        {cut('t-fin')}
        <TransitionSeries.Sequence durationInFrames={d.outro}><Card title={outro} /></TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

export const ALBUM: SlideshowProps = {
  title: 'Atelier d’été', dateRange: 'Juillet 2026', music: null, bpm: 120,
  photos: [
    {src: 'photos/p1.jpg', width: 1600, height: 1200, caption: 'Le premier jour'},
    {src: 'photos/p2.jpg', width: 1200, height: 1600, fond: 'photos/flou/p2.jpg', focal: [0.5, 0.33]},
    {src: 'photos/p3.jpg', width: 1080, height: 1080, caption: 'La répétition'},
    {src: 'photos/p4.jpg', width: 1800, height: 1200},
  ],
};
// in Racine.tsx:
// <Composition id="Diaporama" component={Slideshow} width={1080} height={1920} fps={30} durationInFrames={300}
//   defaultProps={ALBUM} calculateMetadata={({props}) => ({durationInFrames: dureeDiaporama(props, 30)})} />
```

## Render

```bash
python3 manifeste.py "<photo folder>" captions.json > atelier/manifeste.json
python3 .claude/skills/ffmpeg-skill/scripts/scenes.py remotion/public/musique.mp3 --beats --json > atelier/temps.json
python3 - <<'EOF'
import json
m = json.load(open('atelier/manifeste.json')); t = json.load(open('atelier/temps.json'))
g = t.get('beat_grid') or {}
props = {'title': 'Atelier d’été', 'dateRange': 'Juillet 2026', 'outro': 'Merci à tous', 'music': 'musique.mp3',
         'beats': t.get('beats', []) if g.get('usable') else [], 'bpm': g.get('tempo_bpm') or 120, **m}
json.dump(props, open('atelier/diaporama.json', 'w', encoding='utf-8'), ensure_ascii=False)
EOF
node remotion/images.mjs Diaporama --images 30,…          # stills: put these props in defaultProps first
node remotion/rendre.mjs Diaporama rendu/final.mp4 --props "$(cat atelier/diaporama.json)"
```

The title, the dates and the closing line come from the person. Several albums: one at a time (`manifeste.py` rewrites `remotion/public/photos/`), each rendered to its own file in `rendu/livraison/`.

## Pure-FFmpeg pipeline (no Remotion)

With the tools of `ffmpeg-skill`: one Ken Burns clip per photo (`insert.py`, varied per photo), crossfades (`join.py`), then the music (`audio.py`). Tried on two photos: 4 s + 4 s with a 0.5 s fade gives 7.5 s — count the overlaps when you fit the clips to the music.

```bash
S=.claude/skills/ffmpeg-skill/scripts
python3 $S/insert.py remotion/public/photos/001.jpg --duration 4 --zoom in --pan up --zoom-amount 1.1 --width 1080 --height 1920 --fps 30 -o atelier/c1.mp4
python3 $S/insert.py atelier/002-pad.jpg --duration 4 --zoom out --zoom-amount 1.08 --width 1080 --height 1920 --fps 30 -o atelier/c2.mp4
python3 $S/join.py atelier/c1.mp4 atelier/c2.mp4 --transition fade --duration 0.5 -o atelier/joint.mp4
python3 $S/audio.py atelier/joint.mp4 --replace remotion/public/musique.mp3 --fade-out 1.5 -o rendu/final.mp4
```

`002-pad.jpg` is the blurred-pad still of a photo of another shape (`aspect-and-layout.md`). For varied motion, captions, beat-sync and intro/outro, Remotion is dramatically simpler — use this path only for quick, uniform batches.
