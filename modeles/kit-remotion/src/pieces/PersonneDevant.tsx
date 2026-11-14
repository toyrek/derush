// Dérush — la personne filmée, détourée, posée par-dessus un titre : c'est elle qui fait passer le titre DERRIÈRE.
// Les images viennent de la commande `derush-detourer` (remotion/public/detourage/…) : d_<n>.webp, n = numéro de
// l'image dans la vidéo d'origine. La réponse de la commande donne la ligne à coller, valeurs comprises.
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

export type PersonneDevantProps = {
  /** Le dossier dans public/ (« detourage/m1-chronique-0.2-2.8 »). */
  dossier: string;
  /** La cadence de la vidéo d'origine (images par seconde). */
  fps: number;
  /** Les numéros de la première et de la dernière image détourées. */
  premiere: number;
  derniere: number;
  /** Le temps de la vidéo d'origine (s) à la première image de la Sequence : le même que le début du plan (trimBefore / fps). */
  debutSource?: number;
  /** Le même cadrage que la vidéo dessous (position, taille, zoom) : sinon la personne ne tombe pas sur elle-même. */
  style?: React.CSSProperties;
};

export const PersonneDevant: React.FC<PersonneDevantProps> = ({dossier, fps, premiere, derniere, debutSource, style}) => {
  const frame = useCurrentFrame();
  const {fps: fpsVideo} = useVideoConfig();
  const t = (debutSource ?? premiere / fps) + frame / fpsVideo;
  const n = Math.min(derniere, Math.max(premiere, Math.floor(t * fps + 1e-3)));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <Img src={staticFile(`${dossier}/d_${String(n).padStart(5, '0')}.webp`)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style}} />
    </AbsoluteFill>
  );
};
