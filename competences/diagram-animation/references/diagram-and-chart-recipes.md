# Diagram & Chart Recipes — Cookbook

Runnable recipes for progressive diagram reveals, flowing connectors, and animated charts.

> **Dans Dérush.** Toutes les recettes sont en Remotion, pour le kit `remotion/` du dossier de travail ; elles ont été
> rendues image par image avant d'être livrées. Les versions de l'original pour une page web (GSAP, CSS, D3, Framer
> Motion, minuteurs `requestAnimationFrame`) ne sont pas reprises : voir `../SOURCE.md`. Elles utilisent les deux
> outils de `SKILL.md`, `useSeconds()` et `step()`, et ces imports :
>
> ```tsx
> import React from 'react';
> import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
> import {evolvePath, getLength, getPointAtLength} from '@remotion/paths';
> ```
>
> Les étiquettes utilisent `Montserrat` (police du kit) : appelle `usePolices()` de `src/pieces/commun.ts` dans la
> composition qui les affiche, et ne dessine rien tant qu'il ne renvoie pas `true`.

## Reveal order & pacing

1. **Containers/regions** first (faint), to establish the frame.
2. **Nodes** appear (scale 0.8→1 + fade), in reading/logical order.
3. **Edges** draw between now-visible nodes.
4. **Labels** fade in last, on the settled nodes.
5. **Highlight** sweeps the active path; everything else dims to ~0.35 opacity.

Hold each meaningful step 0.5–1.5s. For narrated diagrams, gate each step on the VO line, not a fixed timer.

> Dans Dérush : les temps des mots sont dans `sous-titres/mots.json` (temps du montage) ou dans la réponse
> `with-timestamps` d'une voix off ElevenLabs. Une étape commence sur le mot qui la nomme.

## 1. Staged region → node → edge → label reveal

```tsx
const ARCH_NODES = [
  {x: 50, y: 70, w: 120, fill: '#0A84FF', label: 'Web', lx: 110, ly: 95, ink: '#fff'},
  {x: 50, y: 130, w: 120, fill: '#0A84FF', label: 'Worker', lx: 110, ly: 155, ink: '#fff'},
  {x: 300, y: 100, w: 140, fill: '#30D158', label: 'Queue', lx: 370, ly: 125, ink: '#000'},
];
const ARCH_EDGES = ['M170 90 C240 90 240 120 300 120', 'M170 150 C240 150 240 120 300 120'];

export const Arch: React.FC = () => {
  const t = useSeconds();
  return (
    <svg viewBox="0 0 480 220" style={{width: '100%', height: '100%'}}>
      <rect x={20} y={40} width={180} height={140} rx={12} fill="#11161f" opacity={step(t, 0, 0.4)} />
      {ARCH_NODES.map((n, i) => {
        const p = step(t, 0.4 + i * 0.25, 0.45, Easing.out(Easing.back(1.5)));
        return (
          <g key={i} opacity={Math.min(1, p)}
             style={{transformBox: 'fill-box', transformOrigin: 'center', transform: `scale(${0.85 + 0.15 * p})`}}>
            <rect x={n.x} y={n.y} width={n.w} height={40} rx={8} fill={n.fill} />
          </g>
        );
      })}
      {ARCH_EDGES.map((d, i) => {
        const p = step(t, 1.05 + i * 0.2, 0.55);
        return p > 0 ? <path key={i} d={d} fill="none" stroke="#5b6472" strokeWidth={3} {...evolvePath(p, d)} /> : null;
      })}
      {ARCH_NODES.map((n, i) => (
        <text key={i} x={n.lx} y={n.ly} fill={n.ink} fontSize={13} fontFamily="Montserrat" fontWeight={600}
              textAnchor="middle" opacity={step(t, 1.4 + i * 0.12, 0.35)}>{n.label}</text>
      ))}
    </svg>
  );
};
```

## 2. Sequence diagram (lifelines + messages)

Reveal each message arrow in order; its label starts 0.2s before the arrow lands, then the step holds so it reads.

```tsx
const MSGS = [
  {d: 'M80 70 H320', label: 'demande'},
  {d: 'M320 110 H80', label: 'réponse'},
  {d: 'M80 150 H320', label: 'accusé'},
];
export const SequenceDiagram: React.FC = () => {
  const t = useSeconds();
  return (
    <svg viewBox="0 0 400 200" style={{width: '100%', height: '100%'}}>
      <line x1={80} y1={30} x2={80} y2={180} stroke="#2b3340" strokeWidth={2} />
      <line x1={320} y1={30} x2={320} y2={180} stroke="#2b3340" strokeWidth={2} />
      {MSGS.map((m, i) => {
        const start = i * 1.2;                                   // 0.5 draw + label + 0.6 hold
        const p = step(t, start, 0.5, Easing.inOut(Easing.quad));
        const l = step(t, start + 0.3, 0.3);
        const mid = getPointAtLength(m.d, getLength(m.d) / 2);
        return (
          <g key={i}>
            {p > 0 && <path d={m.d} stroke="#0A84FF" strokeWidth={3} fill="none" {...evolvePath(p, m.d)} />}
            <text x={mid.x} y={mid.y - 8 - 4 * (1 - l)} opacity={l} fill="#fff" fontSize={13} fontFamily="Montserrat"
                  fontWeight={600} textAnchor="middle">{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
};
```

## 3. Flowing connector — marching dash + traveling packet

```tsx
const LINK = 'M20 40 H380';
export const Connector: React.FC<{reverse?: boolean}> = ({reverse = false}) => {
  const t = useSeconds();
  const k = (t / 1.6) % 1;                                       // one trip every 1.6 s
  const packet = getPointAtLength(LINK, getLength(LINK) * (reverse ? 1 - k : k));
  const march = 22 * ((t / 0.7) % 1) * (reverse ? 1 : -1);       // 22 = dash (10) + gap (12)
  return (
    <svg viewBox="0 0 400 80" style={{width: '100%', height: '100%'}}>
      <path d={LINK} stroke="#2b3340" strokeWidth={4} fill="none" />
      <path d={LINK} stroke="#0A84FF" strokeWidth={4} fill="none" strokeDasharray="10 12" strokeDashoffset={march} />
      <circle cx={packet.x} cy={packet.y} r={5} fill="#7cc4ff" />
    </svg>
  );
};
```

Reverse direction (data flowing back): `reverse` flips the sign of the dash offset and runs the packet from the end to the start.

## 4. Bar chart — grow + stagger (HTML)

```tsx
export const BarChart: React.FC<{values?: number[]}> = ({values = [60, 85, 40]}) => {
  const t = useSeconds();
  return (
    <div style={{display: 'flex', gap: 12, alignItems: 'flex-end', height: 200}}>
      {values.map((v, i) => (
        <div key={i} style={{width: 48, height: `${v}%`, background: '#0A84FF', transformOrigin: 'bottom',
          transform: `scaleY(${step(t, i * 0.08, 0.6, Easing.bezier(0.22, 1, 0.36, 1))})`}} />
      ))}
    </div>
  );
};
```

For SVG bars, grow `height` and move `y` together so the bar rises from the baseline (see `Bars` in `SKILL.md`).

## 5. Line chart — draw-on, points, area

The dots pop when the line reaches them; the area under the line fades in after the stroke completes.

```tsx
const PTS = [[20, 160], [110, 120], [200, 135], [290, 70], [380, 40]];
const toPath = (pts: number[][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
const LINE = toPath(PTS);
const TOTAL = getLength(LINE);
const AT = PTS.map((_, i) => (i ? getLength(toPath(PTS.slice(0, i + 1))) / TOTAL : 0)); // where each point sits, 0–1

export const LineChart: React.FC = () => {
  const t = useSeconds();
  const p = step(t, 0, 1.1, Easing.inOut(Easing.quad));
  return (
    <svg viewBox="0 0 400 200" style={{width: '100%', height: '100%'}}>
      <path d={`${LINE} L380 180 L20 180 Z`} fill="#30D158" opacity={0.18 * step(t, 1.1, 0.4)} />
      {p > 0 && <path d={LINE} stroke="#30D158" strokeWidth={4} fill="none" strokeLinejoin="round" {...evolvePath(p, LINE)} />}
      {PTS.map(([x, y], i) => {
        const a = Math.min(AT[i], 0.92);
        const pop = interpolate(p, [a, a + 0.08], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2))});
        return <circle key={i} cx={x} cy={y} r={6 * pop} fill="#30D158" />;
      })}
    </svg>
  );
};
```

## 6. Count-up number

```tsx
export const CountUp: React.FC<{to: number; dur?: number; decimals?: number; prefix?: string; suffix?: string}> =
({to, dur = 1.2, decimals = 0, prefix = '', suffix = ''}) => {
  const t = useSeconds();
  const fmt = new Intl.NumberFormat('fr-FR', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
  const v = to * step(t, 0, dur, Easing.out(Easing.cubic));      // easeOutCubic
  return <span style={{fontVariantNumeric: 'tabular-nums'}}>{prefix + fmt.format(v) + suffix}</span>;
};
// <CountUp to={97.4} decimals={1} suffix=" %" />  →  97,4 %
```

## 7. Spring bars + frame count

```tsx
export const Bar: React.FC<{value: number; index: number}> = ({value, index}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const delay = index * 4;
  const grow = spring({frame: frame - delay, fps, config: {damping: 14}});
  return <rect x={index * 60} y={200 - value * grow} width={40} height={value * grow} fill="#0A84FF" />;
};

export const SpringCount: React.FC<{to: number}> = ({to}) => {
  const frame = useCurrentFrame();
  const e = interpolate(frame, [0, 36], [0, to], {extrapolateRight: 'clamp', easing: (k) => 1 - Math.pow(1 - k, 3)});
  return <text x={200} y={60} fill="#fff" fontSize={28} fontFamily="Montserrat" fontWeight={800}
               style={{fontVariantNumeric: 'tabular-nums'}}>{Math.round(e).toLocaleString('fr-FR')}</text>;
};
```

Because Remotion renders per-frame deterministically, the same diagram renders identically to PNG sequence/MP4 every time — ideal for repeatable data exports.

## The last frame of every step

A video has no "reduced motion" mode: the viewer sees exactly what is rendered. What replaces it is a rule for every
recipe above — when a step ends, all of it is on screen: nodes at full opacity, edges fully drawn, bars at full
height, counters on their final value. Cut to the next shot only after that frame.

---
Reveal nodes before edges before labels, and a diagram explains itself.
