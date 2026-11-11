import React from 'react';
import {Composition} from 'remotion';
import {Montage} from './Montage';
import {montage} from './donnees';
import {AFFICHER_CONSIGNES} from './reglages';

// Une seule composition, au format et à la durée exacts du montage décidé dans Dérush.
export const Racine: React.FC = () => (
  <Composition
    id="Montage"
    component={Montage}
    durationInFrames={Math.max(1, montage.sortie.images)}
    fps={montage.sortie.fps}
    width={montage.sortie.largeur}
    height={montage.sortie.hauteur}
    defaultProps={{afficherConsignes: AFFICHER_CONSIGNES}}
  />
);
