# Écrire ces raccords dans Remotion

> **Fichier écrit pour Dérush** d'après `.claude/skills/cut-the-curve/examples/gsap-implementation.md` du dépôt
> heygen-com/hyperframes (Apache-2.0, Copyright 2026 HeyGen, Inc.) : les mêmes gestes et les mêmes chiffres, réécrits
> pour le kit `remotion/`. Les gabarits GSAP d'origine ne sont pas repris (voir `../SOURCE.md`). Les règles sont dans
> `../SKILL.md`, les paramètres dans `catalogue.md`.

Tout se calcule depuis le numéro d'image. Les durées du catalogue sont en secondes : le plus simple est de travailler
en secondes, avec `t = frame / fps`, et de laisser `interpolate()` faire le reste. Rien à installer : `remotion` est
déjà dans le kit.

## Les courbes

| Dans le catalogue (nom GSAP) | Dans Remotion |
|---|---|
| `none` | linéaire : pas d'option `easing` |
| `power1.in` / `power1.out` | `Easing.in(Easing.quad)` / `Easing.out(Easing.quad)` |
| `power2.in` / `power2.out` | `Easing.in(Easing.cubic)` / `Easing.out(Easing.cubic)` |
| `power3.in` / `power3.out` | `Easing.in(Easing.poly(4))` / `Easing.out(Easing.poly(4))` |
| `power4.in` / `power4.out` | `Easing.in(Easing.poly(5))` / `Easing.out(Easing.poly(5))` |
| `expo.out` | `(t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))`. `Easing.out(Easing.exp)` s'arrête à 0,999 : il resterait pour toujours un flou de 0,01 px. |
| `back.out(1.4)` à `back.out(1.7)` | `Easing.out(Easing.back(1.4))` à `Easing.out(Easing.back(1.7))`, ou `spring()` avec un `damping` de 14 à 20 (`MOTION.md`) |
| `bounce.out`, `elastic.out` | bannis : ni `Easing.bounce`, ni `Easing.elastic` |
| `.inOut` | `Easing.inOut(…)` : jamais d'un côté d'une coupe |
| un changement instantané à la coupe | une condition sur le temps : `t < coupe ? … : …` |

`power4.in` puis `power4.out`, sur la même distance et la même durée, sont les deux moitiés d'un seul mouvement : à la
coupe, la vitesse est la même des deux côtés (cinq fois la vitesse moyenne). Pour 230 px en 0,33 s à 30 images par
seconde, la dernière image avant la coupe et la première après parcourent chacune 95 px.

## Les durées en images

| Secondes | à 25 i/s | à 30 i/s | à 60 i/s | Où |
|---|---|---|---|---|
| 0,022 | 0,55 | 0,66 | 1,3 | décalage entre deux mots qui sortent (coupe en cascade) |
| 0,05 | 1,25 | 1,5 | 3 | premier écart entre deux mots qui entrent |
| 0,10 à 0,20 | 2,5 à 5 | 3 à 6 | 6 à 12 | un mot d'une entrée en cascade |
| 0,18 | 4,5 | 5,4 | 10,8 | fondu d'un mot qui sort |
| 0,20 | 5 | 6 | 12 | sortie d'un zoom traversant |
| 0,33 | 8,25 | 10 | 20 | chaque moitié d'un cut-the-curve |
| 0,50 | 12,5 | 15 | 30 | entrée d'un zoom traversant |

Les valeurs avec une virgule ne s'arrondissent pas : en secondes, le calcul reste exact.

## Le code

À poser dans un fichier de `remotion/src/`, appelé depuis `Montage.tsx` à la place d'une case à créer, dans une
`<Sequence>` : `coupe` et `debut` se comptent alors en secondes depuis le début de cette Sequence. Ce sont des points de
départ à régler, pas des pièces finies : adapte les textes, les tailles et les couleurs au projet (`style` dans
`montage.json`).

Les scènes `a` et `b` voient les mêmes numéros d'image que le raccord. Si `b` a ses propres animations, enveloppe-la dans
`<Sequence from={Math.round(coupe * fps)} layout="none">` : elle compte alors ses images depuis la coupe.

### Outils communs

```tsx
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

const serre = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const p2in = Easing.in(Easing.cubic); // power2.in
const p2out = Easing.out(Easing.cubic); // power2.out
const p3in = Easing.in(Easing.poly(4)); // power3.in
const p4in = Easing.in(Easing.poly(5)); // power4.in
const p4out = Easing.out(Easing.poly(5)); // power4.out
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)); // expo.out
/** Le temps en secondes depuis le début de la Sequence. */
const useTemps = () => useCurrentFrame() / useVideoConfig().fps;
```

### Cut-the-curve (catalogue §3) : le raccord par défaut entre deux scènes animées

```tsx
/**
 * `coupe` en secondes. `dx`, `dy` : la course en px (−230 = vers la gauche, le sens par défaut).
 * `echelle` : laisse 0, ou 0.08 pour ajouter un léger recul (sortie 1 → 0,92, entrée 1,08 → 1 : les deux rétrécissent).
 */
export const CutTheCurve: React.FC<{
  coupe: number;
  a: React.ReactNode;
  b: React.ReactNode;
  dx?: number;
  dy?: number;
  duree?: number;
  flou?: number;
  echelle?: number;
  fond?: string;
}> = ({coupe, a, b, dx = -230, dy = 0, duree = 0.33, flou = 8, echelle = 0, fond = '#000'}) => {
  const t = useTemps();
  const avant = t < coupe; // une seule scène visible par image : la coupe n'est pas un fondu
  const sortie = [coupe - duree, coupe];
  const entree = [coupe, coupe + duree];
  // sortie : 0 → 1, elle accélère (power4.in) ; entrée : −1 → 0, déjà lancée dans le même sens, elle ralentit (power4.out)
  const k = avant
    ? interpolate(t, sortie, [0, 1], {...serre, easing: p4in})
    : interpolate(t, entree, [-1, 0], {...serre, easing: p4out});
  const opacite = avant
    ? interpolate(t, sortie, [1, 0], {...serre, easing: p2in}) // s'éteint juste à la coupe
    : interpolate(t, entree, [0.35, 1], {...serre, easing: p4out}); // s'allume à 0,35, en plein trajet
  const f = Math.abs(k) * flou;
  return (
    <AbsoluteFill style={{backgroundColor: fond}}>
      {/* le fond opaque : sans lui, un éclair à la coupe */}
      <AbsoluteFill style={{opacity: opacite}}>
        <AbsoluteFill
          style={{
            transform: `translate(${k * dx}px, ${k * dy}px) scale(${1 - k * echelle})`,
            filter: f > 0.05 ? `blur(${f}px)` : undefined,
          }}
        >
          {avant ? a : b}
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

La scène `b` arrive composée : aucune de ses propres entrées ne grandit depuis petit pendant le raccord (coupe + 0,5 s).
L'opacité et le flou sont sur deux conteneurs différents, comme le demande le catalogue.

### Zoom traversant, avant et arrière (catalogue §1 et §2) : échanger deux titres

```tsx
/** `sens` : 1 = on avance (tout grandit) ; −1 = on recule (tout rétrécit), pour une arrivée. `flou` : 10 pour un texte, 18 à 20 en plein cadre. */
export const ZoomTraversant: React.FC<{
  coupe: number;
  a: React.ReactNode;
  b: React.ReactNode;
  sens?: 1 | -1;
  flou?: number;
}> = ({coupe, a, b, sens = 1, flou = 10}) => {
  const t = useTemps();
  const avant = t < coupe; // jamais les deux textes à l'écran
  const sortie = [coupe - 0.2, coupe];
  const entree = [coupe, coupe + 0.5];
  const taille = avant
    ? interpolate(t, sortie, [1, sens === 1 ? 1.2 : 0.8], {...serre, easing: p3in})
    : interpolate(t, entree, [sens === 1 ? 0.75 : 1.25, 1], {...serre, easing: expoOut});
  const f = avant
    ? interpolate(t, sortie, [0, flou], {...serre, easing: p3in})
    : interpolate(t, entree, [flou, 0], {...serre, easing: expoOut});
  // l'opacité de sortie est linéaire, à part : en power3.in elle resterait trop longtemps près de 1
  const opacite = avant
    ? interpolate(t, sortie, [1, 0.15], serre)
    : interpolate(t, entree, [0.15, 1], {...serre, easing: expoOut});
  return (
    <AbsoluteFill style={{opacity: opacite}}>
      <AbsoluteFill
        style={{
          transform: `scale(${taille})`,
          filter: f > 0.05 ? `blur(${f}px)` : undefined,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {avant ? a : b}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

### Coupe en cascade (catalogue §4) : d'une ligne de texte à la suivante, mot par mot

```tsx
export const CoupeEnCascade: React.FC<{
  coupe: number;
  motsA: string[];
  motsB: string[];
  course?: number;
  style?: React.CSSProperties;
}> = ({coupe, motsA, motsB, course = 230, style}) => {
  const t = useTemps();
  const avant = t < coupe; // échange franc des deux lignes à la coupe
  // entrées : un écart de 0,05 s, qui rétrécit de 16 % à chaque mot (la cascade accélère)
  const departs: number[] = [];
  let ecart = 0.05;
  let d = coupe;
  for (let i = 0; i < motsB.length; i++) {
    departs.push(d);
    d += ecart;
    ecart *= 0.84;
  }
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.3em', ...style}}>
        {(avant ? motsA : motsB).map((mot, i) => {
          if (avant) {
            const s = coupe - 0.32 + i * 0.022; // les sorties partent avant la coupe, dans l'ordre de lecture
            const x = interpolate(t, [s, s + 0.34], [0, -course], {...serre, easing: p4in});
            const o = interpolate(t, [s, s + 0.18], [1, 0], {...serre, easing: Easing.in(Easing.quad)});
            return (
              <span key={i} style={{display: 'inline-block', transform: `translateX(${x}px)`, opacity: o}}>
                {mot}
              </span>
            );
          }
          const s = departs[i];
          const x = interpolate(t, [s, s + 0.3], [course, 0], {...serre, easing: p4out});
          // invisible tant qu'il n'est pas parti, puis allumé à 0,35 : il est déjà en mouvement
          const o = t < s ? 0 : interpolate(t, [s, s + 0.3], [0.35, 1], {...serre, easing: p4out});
          return (
            <span key={i} style={{display: 'inline-block', transform: `translateX(${x}px)`, opacity: o}}>
              {mot}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

Avec moins de sept mots, le dernier mot qui sort est éteint plus de 0,02 s avant la coupe (0,14 s avant, moins 0,022 s
par mot qui le précède) : quelques images vides, un temps mort. Une ligne courte sort donc d'un bloc : un seul
élément, `x` de 0 à −230 en 0,34 s (`power4.in`), et un fondu qui dure presque toute la course et finit 0,02 s avant
la coupe.

### Flou de mise au point (catalogue §5) : la seule coupe qu'on veut voir

```tsx
/** La sortie reste opaque jusqu'à la coupe : c'est le flou qui cache l'échange. Courbes douces (power2), pas d'élan. */
export const MiseAuPoint: React.FC<{
  coupe: number;
  a: React.ReactNode;
  b: React.ReactNode;
  dx?: number;
  flou?: number;
}> = ({coupe, a, b, dx = -80, flou = 12}) => {
  const t = useTemps();
  const avant = t < coupe;
  const k = avant
    ? interpolate(t, [coupe - 0.3, coupe], [0, 1], {...serre, easing: p2in})
    : interpolate(t, [coupe, coupe + 0.35], [1, 0], {...serre, easing: p2out});
  const x = avant ? k * dx : -k * dx; // même sens des deux côtés
  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${x}px) scale(${1 + 0.06 * k})`,
        filter: k > 0.005 ? `blur(${k * flou}px)` : undefined,
      }}
    >
      {avant ? a : b}
    </AbsoluteFill>
  );
};
```

### Entrée en cascade (catalogue §6) : un titre, une ouverture de partie, une liste

```tsx
type Poids = 'lourd' | 'normal' | 'leger';
// course (px), durée (s), puis l'écart avant l'élément suivant (s) : positif = un vide, négatif = il part avant la fin
const CASCADE: Record<Poids, {y: number; duree: number; ecart: number}> = {
  lourd: {y: 70, duree: 0.18, ecart: 2 / 60}, // le mot d'appui : plus loin, plus longtemps
  normal: {y: 45, duree: 0.15, ecart: -1 / 60},
  leger: {y: 40, duree: 0.12, ecart: -2 / 60}, // un petit mot, la ponctuation
};

export const EntreeEnCascade: React.FC<{
  debut: number;
  mots: {texte: string; poids?: Poids}[];
  style?: React.CSSProperties;
}> = ({debut, mots, style}) => {
  const t = useTemps();
  let s = debut;
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.3em', ...style}}>
      {mots.map((m, i) => {
        const r = CASCADE[m.poids ?? 'normal'];
        const depart = s;
        s += r.duree + r.ecart;
        const y = interpolate(t, [depart, depart + r.duree], [r.y, 0], {...serre, easing: p4out});
        // l'opacité passe de 0 à 1 d'un coup, jamais en fondu
        return (
          <span key={i} style={{display: 'inline-block', opacity: t < depart ? 0 : 1, transform: `translateY(${y}px)`}}>
            {m.texte}
          </span>
        );
      })}
    </div>
  );
};
```

Pour allonger le sommet, coupe le dernier mot en morceaux (« lourd », avec la plus grande course).

### Glissade lent-rapide-lent (catalogue §7) : déplacer un groupe déjà en place

```tsx
/** Position (px) à l'instant `t` pour une glissade de `distance` px qui part à `debut` (en secondes). */
export const glissade = (t: number, debut: number, distance: number, duree = 0.57) => {
  const a = debut + duree * 0.21; // fin de la mise en route : 11 % de la distance en 21 % du temps
  const b = debut + duree * 0.386; // fin de la poussée : 78 % de la distance, à vitesse constante
  if (t <= a) return interpolate(t, [debut, a], [0, distance * 0.111], {...serre, easing: p3in});
  if (t <= b) return interpolate(t, [a, b], [distance * 0.111, distance * 0.778], serre);
  return interpolate(t, [b, debut + duree], [distance * 0.778, distance], {...serre, easing: p4out}); // la traîne
};
```

Les valeurs de l'auteur pour 270 px vers la gauche en 0,57 s : −30 px en 0,12 s, puis −210 px en 0,10 s, puis −270 px
en 0,35 s. Pour 150 px : −15, −115, −150, aux mêmes temps. Fais apparaître le nouveau contenu pendant la poussée.

## Les plages de réglage

| Technique | Réglage | Par défaut | Plage |
|---|---|---|---|
| Zoom traversant | échelle de sortie | 1,2 (avant) / 0,8 (arrière) | ± 0,1 |
| | échelle d'entrée | 0,75 (avant) / 1,25 (arrière) | ± 0,1 |
| | flou à la coupe | 10 px pour un texte, 18 à 20 px en plein cadre | |
| | opacité à la coupe | 0,15 | 0,1 à 0,2 |
| | durée de la sortie | 0,2 s | 0,15 à 0,3 s |
| | durée de l'entrée | 0,5 s | 0,4 à 0,6 s |
| Cut-the-curve | course | 230 px (12 % de 1920) | 150 à 300 px |
| | flou à la coupe | 8 px | 6 à 10 px |
| | durée de la sortie | 0,33 s | 0,2 à 0,4 s |
| | durée de l'entrée | 0,33 à 0,42 s | au moins celle de la sortie |
| Flou de mise au point | flou au pic | 12 px | 8 à 12 px, jamais sous 6, 16 à 18 au plus |

## À savoir

- `fade()`, `slide()` et `wipe()` de `@remotion/transitions` sont un fondu ou un trajet complet de l'image : ce ne sont
  pas des cut-the-curve. Garde-les pour ce que `MOTION.md` permet entre deux rushes filmés.
- Ne floute jamais une vidéo directement : floute le conteneur qui l'entoure.
- Contrôle chaque raccord sur les images : `node remotion/images.mjs --de <s> --a <s> --pas 1`, puis la liste
  « The Seam Check » de `../SKILL.md`.
