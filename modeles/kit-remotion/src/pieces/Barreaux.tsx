// Dérush — des barreaux de prison qui tombent devant l'image (« incarcéré », « enfermé », « prisonnier ») : ils
// tombent l'un après l'autre, du milieu vers les bords, rebondissent à peine, et l'image s'assombrit derrière. Pose un
// choc métallique réel sur l'image où ils touchent le sol : le premier barreau (celui du milieu) `chute` images après
// le début, le dernier `Math.round((nombre - 1) / 2 * decalage) + chute` images après (11 et 17 avec les réglages de départ).
import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {progres, sortie} from './commun';

export type BarreauxProps = {
  nombre?: number;
  /** L'épaisseur d'un barreau, en part de la largeur (0,034). */
  epaisseur?: number;
  couleur?: string;
  reflet?: string;
  /** Images entre deux barreaux (2). */
  decalage?: number;
  /** La durée de la chute de chaque barreau, en images (11) : il touche le sol à la fin. */
  chute?: number;
  /** Les deux traverses horizontales, posées après les barreaux. */
  traverses?: boolean;
  /** L'image derrière s'assombrit (0 à 1, 0,3). */
  assombrir?: number;
  duree?: number;
};

export const Barreaux: React.FC<BarreauxProps> = ({
  nombre = 7, epaisseur = 0.034, couleur = '#1d2026', reflet = '#9ea6b2', decalage = 2, chute = 11, traverses = true, assombrir = 0.3, duree,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const e = width * epaisseur;
  const pasX = (width - e) / (nombre - 1);
  const fin = sortie(frame, duree, 10);
  const metal = `linear-gradient(90deg, ${couleur} 0%, ${reflet} 32%, ${couleur} 58%, #0b0c0f 100%)`;
  const poses = (nombre - 1) * decalage + chute;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: fin}}>
      <AbsoluteFill style={{background: `rgba(0,0,0,${assombrir * progres(frame, 0, chute + 4)})`}} />
      {Array.from({length: nombre}, (_, k) => {
        // l'ordre de chute part du milieu : l'œil suit, puis la cage se referme
        const ordre = Math.abs(k - (nombre - 1) / 2);
        const debut = Math.round(ordre * decalage);
        // la chute dure `chute` images, de plus en plus vite (la pesanteur), puis un tout petit rebond vers le haut
        // (1,5 % de la hauteur, amorti en 8 images) : le barreau ne descend jamais plus bas que le sol
        const f = frame - debut;
        const p = Math.min(1, Math.max(0, f / Math.max(1, chute)));
        const r = (f - chute) / 8;
        const rebond = r > 0 && r < 1 ? Math.sin(r * Math.PI) * (1 - r) * 0.015 : 0;
        const y = -height * (1.05 * (1 - p * p) + rebond);
        return (
          <div key={k} style={{position: 'absolute', left: k * pasX, top: -height * 0.02, width: e, height: height * 1.04, background: metal, borderRadius: e / 2,
            transform: `translateY(${y}px)`, boxShadow: `${e * 0.5}px 0 ${e * 0.9}px rgba(0,0,0,.5)`}} />
        );
      })}
      {traverses ? [0.16, 0.84].map((yy, i) => {
        const q = spring({frame: frame - poses - i * 2, fps, config: {damping: 14, stiffness: 220}});
        return (
          <div key={yy} style={{position: 'absolute', left: -e, right: -e, top: height * yy, height: e * 0.9, background: `linear-gradient(180deg, ${reflet}, ${couleur} 60%, #0b0c0f)`,
            borderRadius: e / 2, transform: `scaleX(${q})`, transformOrigin: i === 0 ? 'left center' : 'right center', boxShadow: `0 ${e * 0.5}px ${e}px rgba(0,0,0,.5)`}} />
        );
      }) : null}
    </AbsoluteFill>
  );
};
