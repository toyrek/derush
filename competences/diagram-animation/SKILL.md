---
name: diagram-animation
description: À ouvrir pour animer un schéma ou des chiffres dans une vidéo (schéma de fonctionnement, organigramme, étapes d'un dispositif révélées une à une, données qui circulent sur une liaison, barres qui montent, courbe qui se trace, compteur qui défile jusqu'au chiffre exact), avec des recettes Remotion prêtes et vérifiées.
---

# Diagram & Data Animation

> **Dans Dérush.** Ce savoir vient d'iart.ai (voir `SOURCE.md`). L'original visait d'abord une page web (GSAP, CSS,
> D3, Framer Motion). Ici la sortie est une vidéo : toutes les recettes sont réécrites pour le kit `remotion/` de ton
> dossier de travail, et vérifiées image par image.
>
> | Ce qu'il te faut | Où c'est |
> |---|---|
> | Une seule horloge | `useCurrentFrame()` (ou les secondes qu'on en tire, plus bas). Jamais de minuteur, de `Date.now()`, de `Math.random()` ni d'animation CSS : le rendu sauterait ou resterait figé. |
> | Tracer une liaison, une courbe | `evolvePath(progression, tracé)` de `@remotion/paths` (déjà dans le kit) ; le point qui voyage : `getPointAtLength()` |
> | Des nombres justes en français | `new Intl.NumberFormat('fr-FR')` : 1 284 000 ; 97,4 %. Chiffres à chasse fixe : `fontVariantNumeric: 'tabular-nums'` |
> | Les textes | une police du kit (`Montserrat`, `Poppins`, `Anton`…), attendue avec `usePolices()` de `src/pieces/commun.ts` |
> | Caler chaque étape sur la voix | les temps des mots : `sous-titres/mots.json`, ou ceux d'une voix off ElevenLabs (`with-timestamps`) |
> | Poser le schéma dans le film | un composant dans `remotion/src/`, dans une `<Sequence from durationInFrames>` de `Montage.tsx`, ou sa propre composition déclarée dans `Racine.tsx` |
> | Regarder avant de rendre | `node remotion/images.mjs <Composition> --images 0,45,90` ; puis `node remotion/rendre.mjs` et `derush-controle` |
>
> Chaque chiffre montré vient d'une vraie source, citée dans la fiche de publication. Les passages « Dans Dérush »
> sont des ajouts ; le reste est le texte de l'auteur.

Make structure and data legible by revealing it over time — one idea per beat. Build progressive node/edge reveals, flowing connectors, and animated charts (bars grow, lines draw, numbers count up) for video.

## When to use

- Architecture, flow, or sequence diagrams that build step by step.
- Animated charts: bars grow, lines draw on, numbers count up.
- "How it works" walkthroughs and process explainers.
- Showing data or signal flowing along connectors.

## Core principle: progressive disclosure

Never show everything at once. Reveal in this order: **nodes → edges → labels**. Highlight the active element and dim the rest (focus + context). Pace to comprehension, not flash — hold each step 0.5–1.5s so it lands. Keep a consistent visual grammar: color means meaning, and that mapping never changes mid-piece.

## Quick reference

| Goal | Mechanism | Easing |
|---|---|---|
| Node appear | scale 0.8→1 + opacity, `transform-origin:center` | `Easing.out(Easing.back(1.5))` / ease-out |
| Edge connect | `evolvePath(p, d)` (stroke-dashoffset len→0) | ease-in-out, 0.4–0.7s |
| Flowing data | `strokeDashoffset` driven by the frame, looping + traveling dot | `linear`, loops |
| Bar grow | height (or `scaleY`) 0→1 from the baseline | ease-out, stagger 0.06s |
| Line chart | `evolvePath(p, d)` on the series path | ease-in-out, 0.8–1.2s |
| Count-up | interpolate value with eased `t` | `easeOutCubic` |
| Highlight | active full-opacity, others `opacity:.35` | 0.3s |

## Two helpers every recipe uses

```tsx
import React from 'react';
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {evolvePath, getLength, getPointAtLength} from '@remotion/paths';

// One clock: seconds since the start of the <Sequence>. Every value below is a pure function of it.
export const useSeconds = () => useCurrentFrame() / useVideoConfig().fps;
// 0 → 1 progress of a step that starts at `start` s and lasts `dur` s
export const step = (t: number, start: number, dur: number, easing = Easing.out(Easing.cubic)) =>
  interpolate(t, [start, start + dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing});
```

## Progressive node/edge reveal

```tsx
const NODES = [60, 200, 340];
const EDGES = ['M88 100 H172', 'M228 100 H312'];

export const Flow: React.FC = () => {
  const t = useSeconds();
  return (
    <svg viewBox="0 0 400 200" style={{width: '100%', height: '100%'}}>
      {NODES.map((cx, i) => {
        const p = step(t, i * 0.35, 0.45, Easing.out(Easing.back(1.6)));   // 0.45 s each, 0.35 s apart
        return (
          <g key={cx} opacity={Math.min(1, p)}
             style={{transformBox: 'fill-box', transformOrigin: 'center', transform: `scale(${0.8 + 0.2 * p})`}}>
            <circle cx={cx} cy={100} r={28} fill="#0A84FF" />
          </g>
        );
      })}
      {EDGES.map((d, i) => {
        const p = step(t, 0.25 + i * 0.35, 0.5, Easing.inOut(Easing.quad)); // each edge lands on a visible node
        return p > 0 ? <path key={d} d={d} stroke="#888" strokeWidth={3} fill="none" {...evolvePath(p, d)} /> : null;
      })}
    </svg>
  );
};
```

`evolvePath` measures the real length of each path, so one progress value (0→1) drives any edge length. Reveal nodes first, then draw edges between the now-visible nodes.

## Flowing connector (marching dash + traveling dot)

```tsx
const WIRE = 'M88 100 H312';
export const FlowLine: React.FC = () => {
  const t = useSeconds();
  const dot = getPointAtLength(WIRE, getLength(WIRE) * ((t / 1.4) % 1));    // one trip every 1.4 s
  return (
    <svg viewBox="0 0 400 200" style={{width: '100%', height: '100%'}}>
      {/* marching dash: the offset moves by the sum of the dash pattern (8 + 8) every 0.6 s */}
      <path d={WIRE} stroke="#0A84FF" strokeWidth={4} fill="none" strokeDasharray="8 8" strokeDashoffset={-16 * ((t / 0.6) % 1)} />
      <circle cx={dot.x} cy={dot.y} r={5} fill="#7cc4ff" />
    </svg>
  );
};
```

## Charts

Bar grow (from the baseline, staggered):

```tsx
const VALUES = [60, 85, 40];
export const Bars: React.FC = () => {
  const t = useSeconds();
  return (
    <svg viewBox="0 0 400 200" style={{width: '100%', height: '100%'}}>
      {VALUES.map((v, i) => {
        const p = step(t, i * 0.06, 0.6, Easing.bezier(0.22, 1, 0.36, 1)); // stagger 0.06 s
        const h = v * 1.8 * p;
        return <rect key={i} x={70 + i * 100} y={180 - h} width={60} height={h} fill="#0A84FF" />;
      })}
    </svg>
  );
};
```

Line chart draw-on (the whole series path strokes in):

```tsx
const SERIES = 'M20 160 L110 120 L200 135 L290 70 L380 40';
export const Line: React.FC = () => {
  const p = step(useSeconds(), 0, 1, Easing.inOut(Easing.quad));           // 0.8–1.2 s
  return (
    <svg viewBox="0 0 400 200" style={{width: '100%', height: '100%'}}>
      {p > 0 && <path d={SERIES} stroke="#30D158" strokeWidth={4} fill="none" strokeLinejoin="round" {...evolvePath(p, SERIES)} />}
    </svg>
  );
};
```

Count-up with eased interpolation:

```tsx
const fr = new Intl.NumberFormat('fr-FR');                                  // 1 284 000 on every machine
export const Count: React.FC<{to: number; dur?: number}> = ({to, dur = 1.2}) => {
  const v = to * step(useSeconds(), 0, dur, Easing.out(Easing.cubic));      // easeOutCubic
  return <span style={{fontVariantNumeric: 'tabular-nums'}}>{fr.format(Math.round(v))}</span>;
};
```

Highlight (focus + context) — the active element full, the rest at 0.35, 0.3 s fades:

```tsx
export const focus = (t: number, activeFrom: number, activeTo: number) =>
  0.35 + 0.65 * Math.min(step(t, activeFrom - 0.3, 0.3), 1 - step(t, activeTo, 0.3));
// <g opacity={focus(t, 2.0, 3.5)}>…</g>
```

> Dans Dérush : chaque nombre animé doit tomber sur la valeur exacte à sa dernière image (`Math.round` à la fin, le
> bon nombre de décimales), et rester affiché le temps d'être lu.

## Output checklist

- Reveal order is nodes → edges → labels; nothing dumps in all at once.
- Each step holds long enough to read (0.5–1.5s).
- Color grammar is consistent and meaningful.
- Active element highlighted, context dimmed.
- Every animation reaches its last step before the cut; count-ups land on the EXACT values.

## Deliver & verify

> Dans Dérush, cette partie remplace celle de l'original (une page HTML vérifiée avec Playwright).

1. The diagram is a component in `remotion/src/`, every value derived from the frame (no timers, no `Date.now()`, no `Math.random()`, no CSS animation or transition).
2. Freeze the moments that matter with `node remotion/images.mjs <Composition> --images …`: the first frame, a frame in the middle of each step, the last frame of each step. Open the full-size images.
3. Check **fidelity** — the reveal appears in order (nodes → edges → labels, each step present at its frame), connectors point at the right nodes, count-ups land on the exact values in French format — and **artifacts** (clipped labels, off-canvas nodes, text drawn before the kit fonts loaded, jumps between two steps).
4. Render with `node remotion/rendre.mjs`, then run `derush-controle` on the video (cut or hidden text, glued words).

## Reference files

- `references/diagram-and-chart-recipes.md` — fuller Remotion code: staged region → node → edge → label reveal, sequence diagram, flowing connector both ways, bar chart in HTML, line chart with points and area, count-up with decimals, spring bars.
