import React from 'react';
import {Composition} from 'remotion';
import {Montage} from './Montage';
import {montage} from './donnees';
import {AFFICHER_CONSIGNES} from './reglages';
import {DemoPieces, DUREE_DEMO_S} from './pieces/Demo';

// La composition « Montage », au format et à la durée exacts du montage décidé dans Dérush.
// « Pieces » : la vitrine des pièces du kit (src/pieces), au même format, pour les voir avant de s'en servir.
export const Racine: React.FC = () => (
  <>
    <Composition
      id="Montage"
      component={Montage}
      durationInFrames={Math.max(1, montage.sortie.images)}
      fps={montage.sortie.fps}
      width={montage.sortie.largeur}
      height={montage.sortie.hauteur}
      defaultProps={{afficherConsignes: AFFICHER_CONSIGNES}}
    />
    <Composition
      id="Pieces"
      component={DemoPieces}
      durationInFrames={Math.round(DUREE_DEMO_S * montage.sortie.fps)}
      fps={montage.sortie.fps}
      width={montage.sortie.largeur}
      height={montage.sortie.hauteur}
    />
  </>
);
