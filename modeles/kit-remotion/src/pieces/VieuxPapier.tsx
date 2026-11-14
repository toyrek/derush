// Dérush — l'image vire au vieux papier (« vintage », « à l'ancienne », un souvenir) : sépia, grain qui vit, bords
// assombris. Entoure ce qui doit vieillir : <VieuxPapier><Img …/></VieuxPapier>.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {progres} from './commun';

export type VieuxPapierProps = {
  children: React.ReactNode;
  /** Jusqu'où l'image vieillit (0 à 1). */
  force?: number;
  /** Images pour y arriver (12). */
  entree?: number;
  /** Le grain (0 à 1, 0,4) et les bords sombres (0 à 1, 0,55). */
  grain?: number;
  vignette?: number;
};

export const VieuxPapier: React.FC<VieuxPapierProps> = ({children, force = 1, entree = 12, grain = 0.4, vignette = 0.55}) => {
  const frame = useCurrentFrame();
  const p = progres(frame, 0, entree) * force;
  // le grain change toutes les deux images, comme une vieille pellicule (calculé d'après le numéro d'image)
  const graine = Math.floor(frame / 2) % 97;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{filter: `sepia(${0.85 * p}) saturate(${1 - 0.3 * p}) contrast(${1 + 0.1 * p}) brightness(${1 - 0.05 * p})`}}>{children}</AbsoluteFill>
      <AbsoluteFill style={{background: `rgba(255,226,170,${0.16 * p})`, mixBlendMode: 'multiply', pointerEvents: 'none'}} />
      <AbsoluteFill style={{opacity: grain * p, mixBlendMode: 'multiply', pointerEvents: 'none'}}>
        <svg width="100%" height="100%" preserveAspectRatio="none">
          <filter id={`grain-${graine}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={graine} stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.33  0 0 0 0 0.22  0 0 0 0.9 0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#grain-${graine})`} />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 52%, rgba(45,28,10,${vignette * p}) 100%)`, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
