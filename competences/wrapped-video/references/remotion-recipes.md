# Remotion recipes for Wrapped scenes

Runnable scene components and the sequencing that strings them into a recap. All assume the `Wrapped` type from SKILL.md and a 1080×1920 / 30fps composition.

> **Dans Dérush.** Ces blocs forment un seul fichier, `remotion/src/wrapped.tsx` : le premier bloc ci-dessous (imports,
> exemple, `fr`) l'ouvre, puis viennent le type `Wrapped` et `BigNumber` de `SKILL.md` (sans leurs lignes `import` ni
> un second `const fr`), puis les blocs suivants. Ils ont été rendus image par image, puis en deux vidéos par la
> boucle de `batch-pipeline.md`. Changements par rapport à l'original : nombres à la française, polices du kit, barre
> de comparaison qui se remplit jusqu'au chiffre annoncé, textes au tutoiement, scènes d'intro, de persona et de carte
> finale écrites (l'original les laissait à faire).

```tsx
import React from 'react';
import {AbsoluteFill, Series, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {usePolices} from './pieces/commun';

export const EXEMPLE: Wrapped = {
  name: 'Inès', year: 2026, accent: '#FF5A36',
  big: {value: 1240, label: 'minutes de montage'},
  top: [
    {rank: 1, label: 'Clip de fin d’année', value: 42},
    {rank: 2, label: 'Interview du maire', value: 31},
    {rank: 3, label: 'Tournoi de foot', value: 18},
  ],
  persona: 'Tu es la monteuse de l’équipe',
  ahead: 92, peers: 'des jeunes de l’atelier', handle: '@atelier.video',
};

const fr = new Intl.NumberFormat('fr-FR');
const FONT = 'Montserrat';
```

## The one rule that prevents broken renders

Drive **all** animation from `useCurrentFrame()`. Never use `setState`, `setInterval`, `Date.now()`, or CSS `@keyframes`/`transition` for timing — the renderer snapshots discrete frames, so wall-clock animation flickers or freezes. Everything below derives its state purely from the current frame.

## Staggered top-X list

Each row springs in on a delayed frame so the list builds 1→5. One identical motion per row.

```tsx
export const TopList: React.FC<{items: Wrapped['top']; accent: string; title: string}> = ({items, accent, title}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{flexDirection: 'column', justifyContent: 'center', gap: 40, padding: '0 14%'}}>
      <span style={{fontFamily: FONT, fontWeight: 600, fontSize: 48, color: '#ffffffb0'}}>{title}</span>
      {items.map((it, i) => {
        const p = spring({frame: frame - i * 8, fps, config: {damping: 200}});   // rank 1 first, 8 frames apart
        return (
          <div key={it.rank} style={{opacity: p, transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px)`,
            display: 'flex', alignItems: 'baseline', gap: 28, fontFamily: FONT}}>
            <span style={{fontSize: 64, fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums'}}>{it.rank}</span>
            <span style={{fontSize: 58, fontWeight: 800, color: '#fff', flex: 1, lineHeight: 1.1}}>{it.label}</span>
            <span style={{fontSize: 44, fontWeight: 600, color: '#ffffff99', fontVariantNumeric: 'tabular-nums'}}>{fr.format(it.value)}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
```

## Comparison bar (the climax scene)

The bar fills to the very number announced, while it counts up. Phrase it as "plus que X % des…": the climax frame is then a full bar. (The original said "top 3 %" over a bar filled to 3 % — almost empty at the key moment.)

```tsx
// The climax: "more than 92 % of …" — the bar fills to 92 %, so the key frame is a full bar, not an empty one.
export const Percentile: React.FC<{ahead: number; peers: string; accent: string}> = ({ahead, peers, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame, fps, config: {damping: 200}});
  const pct = interpolate(p, [0, 1], [0, ahead]);
  return (
    <AbsoluteFill style={{flexDirection: 'column', justifyContent: 'center', padding: '0 14%', gap: 34, fontFamily: FONT}}>
      <span style={{fontSize: 60, fontWeight: 600, color: '#fff'}}>Tu as fait plus que</span>
      <span style={{fontFamily: 'Anton', fontSize: 240, color: accent, lineHeight: 1, fontVariantNumeric: 'tabular-nums'}}>{Math.round(pct)} %</span>
      <div style={{height: 28, borderRadius: 14, background: '#ffffff22'}}>
        <div style={{width: `${pct}%`, height: '100%', borderRadius: 14, background: accent}} />
      </div>
      <span style={{fontSize: 48, fontWeight: 600, color: '#ffffffa0'}}>{peers}</span>
    </AbsoluteFill>
  );
};
```

## Intro, persona, share card

```tsx
const Intro: React.FC<{name: string; year: number; accent: string}> = ({name, year, accent}) => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig();
  const p = spring({frame, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '0 14%',
      background: `linear-gradient(160deg, ${accent} 0%, #0a0a0a 75%)`, fontFamily: FONT}}>
      <span style={{fontSize: 110, fontWeight: 800, color: '#fff', opacity: p, transform: `translateY(${(1 - p) * 60}px)`}}>{name},</span>
      <span style={{fontSize: 64, fontWeight: 600, color: '#fff', opacity: p, textAlign: 'center'}}>ton année {year}</span>
    </AbsoluteFill>
  );
};
const Persona: React.FC<{text: string; accent: string}> = ({text, accent}) => (
  <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', padding: '0 14%', background: accent}}>
    <span style={{fontFamily: FONT, fontWeight: 800, fontSize: 96, color: '#fff', textAlign: 'center', lineHeight: 1.1}}>{text}</span>
  </AbsoluteFill>
);
// The share card: the destination. It does not move at all for its last 2 s.
const Outro: React.FC<Wrapped> = (w) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 10], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, padding: '0 14%', opacity: o, fontFamily: FONT}}>
      <span style={{fontSize: 52, fontWeight: 600, color: '#ffffffb0'}}>{w.name} · {w.year}</span>
      <span style={{fontFamily: 'Anton', fontSize: 200, color: w.accent, lineHeight: 1}}>{fr.format(w.big.value)}</span>
      <span style={{fontSize: 56, fontWeight: 800, color: '#fff', textAlign: 'center'}}>{w.big.label}</span>
      <span style={{fontSize: 46, fontWeight: 800, color: '#fff', textAlign: 'center', marginTop: 30}}>{w.persona}</span>
      {w.handle && <span style={{fontSize: 40, fontWeight: 600, color: w.accent, marginTop: 30}}>{w.handle}</span>}
    </AbsoluteFill>
  );
};

const Bg: React.FC<{children: React.ReactNode; color?: string}> = ({children, color}) =>
  <AbsoluteFill style={{background: color ?? '#0a0a0a'}}>{children}</AbsoluteFill>;
```

## Sequencing scenes into the film

Use `<Series>` to lay scenes back-to-back without computing absolute frames by hand. Wrap each in a full-bleed background.

```tsx
// Smallest stat first, the climax last, then the still card. 3 + 4 + 4 + 3 + 4 + 4 = 22 s at 30 fps.
export const WrappedVideo: React.FC<Wrapped> = (w) => {
  const ok = usePolices();
  if (!ok) return null;
  return (
    <AbsoluteFill style={{background: '#0a0a0a'}}>
      <Series>
        <Series.Sequence durationInFrames={90}><Intro name={w.name} year={w.year} accent={w.accent} /></Series.Sequence>
        <Series.Sequence durationInFrames={120}><Bg><TopList items={w.top} accent={w.accent} title="Tes vidéos les plus vues" /></Bg></Series.Sequence>
        <Series.Sequence durationInFrames={120}><Bg><BigNumber value={w.big.value} label={w.big.label} accent={w.accent} /></Bg></Series.Sequence>
        <Series.Sequence durationInFrames={90}><Persona text={w.persona} accent={w.accent} /></Series.Sequence>
        <Series.Sequence durationInFrames={120}><Bg><Percentile ahead={w.ahead} peers={w.peers} accent={w.accent} /></Bg></Series.Sequence>
        <Series.Sequence durationInFrames={120}><Bg><Outro {...w} /></Bg></Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
```

`<Series.Sequence>` resets each child's `useCurrentFrame()` to 0 at its own start, so every scene's springs animate from the beginning — no per-scene frame math. The sum of the sequences (here 660 frames) is the composition's `durationInFrames`.

## Transitions between scenes

For a polished cut, use `@remotion/transitions` (in the kit) instead of hard cuts:

```tsx
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={120}>{/* scene A */}</TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: 12})} />
  <TransitionSeries.Sequence durationInFrames={120}>{/* scene B */}</TransitionSeries.Sequence>
</TransitionSeries>
```

Keep transitions short (8–15 frames) and consistent. A quick fade or vertical slide matches the story-swipe feel; avoid mixing many transition types. Each transition overlaps its two neighbours: the film gets shorter by the transition's length, so recompute `durationInFrames`.

## Fonts

Load a heavy display weight — bold numerals carry the whole look. The kit already ships them locally (no network at render time): `Anton` and `Bebas Neue` for numbers, `Montserrat` and `Poppins` 800 for words. Wait for them with `usePolices()` (from `src/pieces/commun.ts`) before drawing, as `WrappedVideo` does, or the first frames render in a fallback font.

Use `fontVariantNumeric: "tabular-nums"` on every counter so digits don't jitter as they roll.

## Animation cheatsheet

- `spring({ frame, fps, config: { damping: 200 } })` → smooth 0→1, no overshoot. Lower damping = bouncier.
- `interpolate(spring01, [0,1], [from,to])` → map progress to any range; add `{ extrapolateRight: "clamp" }` to freeze at the end.
- Counters: `Math.round(interpolate(p, [0,1], [0, value]))` + `new Intl.NumberFormat('fr-FR').format()` + `tabular-nums`.
- Stagger: feed `frame - i*delay` into each item's spring.
- Hold still: when a scene's payoff is reached, stop animating — let it sit so it can be screenshotted.
