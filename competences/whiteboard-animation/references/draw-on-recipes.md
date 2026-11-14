# Draw-On Recipes — Cookbook

Runnable mechanics for the whiteboard "draw-on" look: paths that draw themselves, a hand that tracks the drawing tip, multi-stroke sequencing, handwriting, fills, erase transitions — all frame-driven in Remotion.

> **Dans Dérush.** Les blocs ci-dessous forment un seul fichier, `remotion/src/tableau.tsx`, dans cet ordre. Ils ont été
> rendus image par image (feutre sur la pointe au milieu d'un trait, levées, remplissage, écriture, effacement) avant
> d'être livrés. Ils remplacent les recettes de l'original pour une page web (minuteurs `requestAnimationFrame`,
> `setTimeout`, transitions CSS, GSAP `DrawSVGPlugin` et `MotionPathPlugin`) et son portage Remotion, qui ne marchait
> pas. Noms en français : `trait` (stroke), `pointe` (nib), `feutre` (marker), `levée` (lift), `planche` (board).

```tsx
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {evolvePath, getLength, getPointAtLength} from '@remotion/paths';
import {largeurTexte, usePolices} from './pieces/commun';
```

## 1. The draw-on, measured on the real length

`evolvePath(k, d)` gives the `strokeDasharray` / `strokeDashoffset` pair that shows the path from its start up to the progress `k` (0 → 1). It measures the real length itself: no `pathLength="1"` on these paths, never both. `getPointAtLength` also works in real length, so the stroke and the nib always agree.

`linear` progress looks like a steady hand. A faint ease-out at the very end is fine; ease-in-out on a long line makes the nib visibly accelerate/brake.

## 2. The schedule — one stroke after another, at a steady pace

Every element of the board is listed in draw order. The schedule is computed once from the lengths: each stroke lasts its length divided by a speed (a steady hand: long primary strokes take longer than short connective ones), a word lasts its letter count × 0.18 s (handwriting draws fast: 150–250 ms a letter), and the hand lifts for 0.18 s between two strokes. Give `duree` instead of a speed to fit a whole drawing into the spoken line it illustrates.

```tsx
// One element of the board, in draw order. A stroke is one open path; `ecrit` is a word written by a moving mask.
export type Trait = {
  d: string;                 // the path the nib follows (for a word: its baseline, left → right)
  couleur?: string; epaisseur?: number;
  remplir?: string;          // fill that floods in behind the outline once it is drawn
  ecrit?: {texte: string; taille: number};
};
export type Place = Trait & {debut: number; fin: number; longueur: number};

// The schedule, computed once. Strokes run at constant speed (duration = length / speed): a steady hand.
// Give `duree` to fit a whole drawing into the spoken line instead of a fixed speed.
export function planifier(traits: Trait[], {depart = 0, vitesse = 900, duree, levee = 0.18, lettre = 0.18} = {} as
  {depart?: number; vitesse?: number; duree?: number; levee?: number; lettre?: number}) {
  const longueurs = traits.map((tr) => getLength(tr.d));
  const ecrit = traits.reduce((s, tr) => s + (tr.ecrit ? [...tr.ecrit.texte].length * lettre : 0), 0);
  const traces = longueurs.reduce((s, l, i) => s + (traits[i].ecrit ? 0 : l), 0);
  const v = duree ? traces / Math.max(0.2, duree - ecrit - levee * (traits.length - 1)) : vitesse;
  let t = depart;
  const plan: Place[] = traits.map((tr, i) => {
    const d = tr.ecrit ? [...tr.ecrit.texte].length * lettre : Math.max(0.12, longueurs[i] / v);
    const p = {...tr, debut: t, fin: t + d, longueur: longueurs[i]};
    t += d + levee;
    return p;
  });
  return {plan, fin: t - levee};
}

const ease = Easing.inOut(Easing.quad);
const vers = (a: {x: number; y: number}, b: {x: number; y: number}, k: number) => ({x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k});
const prog = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
```

## 3. Hand follows the tip (the core illusion)

The nib position is a pure function of the time: on the tip of the stroke being drawn; hopping between two strokes of one drawing, lifted (`levee` rises to 1 halfway); off the board during a hold between two beats (it leaves in 0.3 s and comes back in 0.3 s); off the board before the first and after the last stroke. It never slides across blank board while touching it.

```tsx
// Where the nib is at time t (seconds): on the tip of the stroke being drawn; hopping, lifted, between two strokes;
// off the board (`repos`) during a hold longer than `saut` seconds, and before the first and after the last stroke.
export function pointe(plan: Place[], t: number, repos: {x: number; y: number}, {saut = 0.6, aller = 0.3} = {}) {
  if (!plan.length || t < plan[0].debut - aller) return {...repos, levee: 1};
  const debut = (s: Place) => getPointAtLength(s.d, 0);
  const bout = (s: Place) => getPointAtLength(s.d, s.longueur);
  if (t < plan[0].debut) { const k = ease(prog(t, plan[0].debut - aller, plan[0].debut)); return {...vers(repos, debut(plan[0]), k), levee: 1 - k}; }
  for (let i = 0; i < plan.length; i++) {
    const s = plan[i];
    if (t <= s.fin) {
      const k = prog(t, s.debut, s.fin);
      const p = getPointAtLength(s.d, s.longueur * k);
      // writing: the nib bobs over the letters instead of gliding along the baseline
      const bob = s.ecrit ? -s.ecrit.taille * (0.3 + 0.18 * Math.sin(t * 38)) : 0;
      return {x: p.x, y: p.y + bob, levee: 0};
    }
    const n = plan[i + 1];
    if (!n) { const k = ease(prog(t, s.fin, s.fin + aller)); return {...vers(bout(s), repos, k), levee: k}; }
    if (t < n.debut) {
      if (n.debut - s.fin <= saut) { const k = ease(prog(t, s.fin, n.debut)); return {...vers(bout(s), debut(n), k), levee: Math.sin(Math.PI * k)}; }
      if (t < s.fin + aller) { const k = ease(prog(t, s.fin, s.fin + aller)); return {...vers(bout(s), repos, k), levee: k}; }
      if (t > n.debut - aller) { const k = ease(prog(t, n.debut - aller, n.debut)); return {...vers(repos, debut(n), k), levee: 1 - k}; }
      return {...repos, levee: 1};
    }
  }
  return {...repos, levee: 1};
}
```

## 4. Strokes, words and fills from one schedule

Fills come first in the drawing order of the SVG (they sit behind every outline) and flood in over 0.4 s once their outline is complete — "colored in after". A word is revealed left to right by a clip rectangle whose edge the nib rides: it looks written without per-glyph paths.

```tsx
// The strokes, the words and the fills, all read from the same schedule.
export const Planche: React.FC<{plan: Place[]; police?: string}> = ({plan, police = 'Permanent Marker'}) => {
  const t = useCurrentFrame() / useVideoConfig().fps;
  return (
    <>
      {plan.map((s, i) => s.remplir && (                       // fills first: they sit behind every outline
        <path key={`f${i}`} d={s.d} fill={s.remplir} opacity={ease(prog(t, s.fin, s.fin + 0.4))} />
      ))}
      {plan.map((s, i) => {
        const k = prog(t, s.debut, s.fin);                       // linear: constant speed, no ease on a long line
        if (k <= 0) return null;
        if (s.ecrit) {
          const a = getPointAtLength(s.d, 0);
          const id = `ecrit-${i}`;
          return (
            <g key={i}>
              <clipPath id={id}><rect x={a.x - s.ecrit.taille} y={a.y - s.ecrit.taille * 1.4} width={s.ecrit.taille + s.longueur * k} height={s.ecrit.taille * 2} /></clipPath>
              <text x={a.x} y={a.y} fontFamily={police} fontSize={s.ecrit.taille} fill={s.couleur ?? '#1a1a1a'} clipPath={`url(#${id})`}>{s.ecrit.texte}</text>
            </g>
          );
        }
        return <path key={i} d={s.d} fill="none" stroke={s.couleur ?? '#1a1a1a'} strokeWidth={s.epaisseur ?? 6}
                     strokeLinecap="round" strokeLinejoin="round" {...evolvePath(k, s.d)} />;
      })}
    </>
  );
};
```

## 5. The marker (the "hand")

A marker drawn in SVG: the nib is at (0, 0), so placing it is just a `translate` to the point. When it lifts, it rises a little and its shadow moves away from it. Keep the marker last in the SVG so nothing is ever drawn over it. To use a photo of a hand instead (given by the person, or generated with ElevenLabs), put an `<image href={staticFile('main.png')} x={-nibX} y={-nibY} width height />` in the same `<g>`, measure the nib once on still frames, and reuse that offset everywhere.

```tsx
// A marker drawn in SVG, nib at (0, 0), body up and to the right. No image to find, no rights to check.
export const Feutre: React.FC<{x: number; y: number; levee?: number; echelle?: number; encre?: string}> =
({x, y, levee = 0, echelle = 1, encre = '#1a1a1a'}) => (
  <g transform={`translate(${x} ${y}) scale(${echelle})`}>
    <g transform={`translate(${12 + 18 * levee} ${10 + 12 * levee}) rotate(-35)`} opacity={0.16 - 0.07 * levee}>
      <rect x={14} y={-12} width={216} height={24} rx={11} fill="#000" />
    </g>
    <g transform={`translate(0 ${-16 * levee}) rotate(-35)`}>
      <path d="M0 0 L17 -7 L17 7 Z" fill={encre} />
      <rect x={16} y={-9} width={30} height={18} rx={3} fill="#2a2a2a" />
      <rect x={44} y={-12} width={150} height={24} rx={10} fill="#f3f3f3" stroke="#c9c9c9" strokeWidth={2} />
      <rect x={186} y={-13} width={44} height={26} rx={9} fill={encre} />
    </g>
  </g>
);
```

## 6. Handwriting

`mot()` turns a word into an element of the schedule: its baseline becomes the nib's path, measured with the kit's `largeurTexte()` once the fonts are loaded (`usePolices()`). `Permanent Marker` is the kit's marker font. True per-letter draw-on would need a single-stroke font converted to paths; the kit has none, and tracing the outlines of an outline font does not look like writing.

```tsx
// A word laid out for the schedule: its baseline as the nib's path (the width is measured once the fonts are loaded).
export const mot = (texte: string, x: number, y: number, taille: number, police = 'Permanent Marker', couleur?: string): Trait =>
  ({d: `M${x} ${y} H${x + largeurTexte(texte, police, 400, taille)}`, ecrit: {texte, taille}, couleur});
```

## 7. Erase / wipe transitions

Clear a section before the next. **Wipe**: a clip rectangle whose left edge travels across the board, left → right, over 0.6 s (see the full composition below). **Reverse draw-on** (un-draw, the nib following backward):

```tsx
// Un-draw one stroke from its end back to its start, the nib following backward.
export const Defaire: React.FC<{d: string; debut: number; duree: number}> = ({d, debut, duree}) => {
  const t = useCurrentFrame() / useVideoConfig().fps;
  const k = 1 - prog(t, debut, debut + duree);                     // 1 → 0
  const p = getPointAtLength(d, getLength(d) * k);
  return (
    <>
      {k > 0 && <path d={d} fill="none" stroke="#1a1a1a" strokeWidth={6} strokeLinecap="round" {...evolvePath(k, d)} />}
      {k > 0 && k < 1 && <Feutre x={p.x} y={p.y} />}
    </>
  );
};
```

Pick one wipe direction for the whole piece so transitions feel intentional.

## 8. A full board

Two beats and a wipe: a light bulb drawn in 1.6 s (the length of its spoken line), its glow filled after the outline, a 0.8 s hold with the hand off the board, then an arrow, a box and the word "PLAN" written inside it, a hold, and the wipe. The composition and its length both come from the same `tableau()` function.

```tsx
// ===== a full board: two beats, then a wipe (1920 × 1080)
// The whole schedule in one function: the composition draws from it, calculateMetadata takes its length from it.
export function tableau() {
  const beat1 = planifier([
    {d: 'M500 560 C 440 520, 430 420, 500 370 C 560 330, 640 340, 680 390 C 730 450, 700 520, 640 560 Z', remplir: '#FFE066', epaisseur: 7},
    {d: 'M520 590 H 620', epaisseur: 7},
    {d: 'M530 620 H 610', epaisseur: 7},
    {d: 'M545 540 L 560 480 L 575 520 L 590 480 L 605 540', epaisseur: 5},
  ], {depart: 0.4, duree: 1.6});                                    // fitted to a 1.6 s spoken line
  const beat2 = planifier([
    {d: 'M760 460 C 880 420, 1020 420, 1150 460', epaisseur: 6},
    {d: 'M1120 432 L 1155 462 L 1112 482', epaisseur: 6},
    {d: 'M1200 360 H 1620 V 580 H 1200 Z', epaisseur: 7},
    mot('PLAN', 1290, 510, 110),
  ], {depart: beat1.fin + 0.8});                                    // a 0.8 s hold, the hand off the board
  const essuie = beat2.fin + 1.0;                                    // wipe left → right, 0.6 s
  return {plan: [...beat1.plan, ...beat2.plan], essuie, fin: essuie + 0.6 + 0.4};
}

export const Tableau: React.FC = () => {
  const ok = usePolices();                                           // Permanent Marker must be loaded before measuring
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  if (!ok) return null;
  const t = frame / fps;
  const {plan, essuie} = tableau();
  const w = interpolate(t, [essuie, essuie + 0.6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad)});
  const nib = pointe(plan, t, {x: width * 0.82, y: height + 220});  // rest: below the frame, out of sight
  return (
    <AbsoluteFill style={{background: '#FBFBF8'}}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{width: '100%', height: '100%'}}>
        <clipPath id="essuie"><rect x={width * w} y={0} width={width} height={height} /></clipPath>
        <g clipPath="url(#essuie)"><Planche plan={plan} /></g>
        <Feutre x={nib.x} y={nib.y} levee={nib.levee} />
      </svg>
    </AbsoluteFill>
  );
};
// In Racine.tsx:
// <Composition id="Tableau" component={Tableau} width={1920} height={1080} fps={30} durationInFrames={300}
//   calculateMetadata={() => ({durationInFrames: Math.ceil(tableau().fin * 30)})} />
```

Freeze it with `node remotion/images.mjs Tableau --images 24,60,165,200` (mid-stroke, filled bulb, mid-word, finished board) before rendering. For a vertical video, write the paths in a 1080 × 1920 board and keep the drawing out of the platform zones (`ZONE_SURE` in `src/pieces/commun.ts`).
