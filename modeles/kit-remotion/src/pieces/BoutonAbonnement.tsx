// Dérush — le bouton d'abonnement, sur la phrase qui le demande : il arrive, un curseur vient cliquer, il devient
// « ABONNÉ » et la cloche sonne. Pose un vrai clic sur l'image `clic`.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {arrive, glisse, progres, sortie, usePolices} from './commun';

export type BoutonAbonnementProps = {
  texte?: string;
  fait?: string;
  accent?: string;
  /** Le centre du bouton, en parts de l'image (0,5 ; 0,62 : au-dessus des boutons des réseaux). */
  x?: number;
  y?: number;
  /** La hauteur des lettres, en part de la hauteur (0,036). */
  taille?: number;
  /** L'image du clic (22). */
  clic?: number;
  curseur?: boolean;
  duree?: number;
};

const Cloche: React.FC<{taille: number; couleur: string; angle: number}> = ({taille, couleur, angle}) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" style={{transform: `rotate(${angle}deg)`, transformOrigin: '50% 10%'}}>
    <path fill={couleur} d="M12 2a1.5 1.5 0 0 0-1.5 1.5v.6A6 6 0 0 0 6 10v4.2l-1.6 2.3A1 1 0 0 0 5.2 18h13.6a1 1 0 0 0 .8-1.5L18 14.2V10a6 6 0 0 0-4.5-5.9v-.6A1.5 1.5 0 0 0 12 2Zm-2.5 17.5a2.5 2.5 0 0 0 5 0Z" />
  </svg>
);
const Coche: React.FC<{taille: number}> = ({taille}) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24"><path fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

export const BoutonAbonnement: React.FC<BoutonAbonnementProps> = ({
  texte = 'S’ABONNER', fait = 'ABONNÉ', accent = '#FF0033', x = 0.5, y = 0.62, taille = 0.036, clic = 22, curseur = true, duree,
}) => {
  const ok = usePolices();
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  if (!ok) return null;
  const fs = height * taille;
  const p = arrive(frame, fps, 0, 14);
  const appuye = frame >= clic && frame < clic + 4 ? 0.92 : 1;
  const abonne = frame >= clic + 2;
  const onde = progres(frame, clic, clic + 14);
  const cloche = abonne ? Math.sin((frame - clic) * 1.1) * 22 * Math.exp(-(frame - clic) / 9) : 0;
  const fin = sortie(frame, duree);
  // le curseur : arrive d'en bas à droite, se pose sur le bouton au moment du clic, puis s'en va
  const c = progres(frame, 4, clic, glisse);
  const part = progres(frame, clic + 8, clic + 18);
  const cx = interpolate(c, [0, 1], [width * 0.95, width * x + fs * 0.6]) + part * width * 0.3;
  const cy = interpolate(c, [0, 1], [height * 0.95, height * y + fs * 0.3]) + part * height * 0.15;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: fin}}>
      <div style={{position: 'absolute', left: width * x, top: height * y, transform: `translate(-50%, -50%) scale(${(0.6 + 0.4 * p) * appuye})`, opacity: Math.min(1, p * 1.8)}}>
        <div style={{position: 'relative', display: 'flex', alignItems: 'center', gap: fs * 0.45, padding: `${fs * 0.55}px ${fs * 1.0}px`, borderRadius: fs * 2,
          background: abonne ? '#2b2b30' : accent, boxShadow: '0 14px 40px rgba(0,0,0,.4)', overflow: 'visible'}}>
          {onde > 0 && onde < 1 ? <div style={{position: 'absolute', left: '50%', top: '50%', width: fs * 6, height: fs * 6, marginLeft: -fs * 3, marginTop: -fs * 3, borderRadius: '50%',
            border: `${fs * 0.12}px solid ${accent}`, transform: `scale(${0.3 + onde})`, opacity: 1 - onde}} /> : null}
          {abonne ? <Coche taille={fs * 1.05} /> : null}
          <span style={{fontFamily: 'Montserrat', fontWeight: 800, fontSize: fs, letterSpacing: '0.06em', color: '#fff', whiteSpace: 'nowrap'}}>{abonne ? fait : texte}</span>
          <Cloche taille={fs * 1.15} couleur="#fff" angle={cloche} />
        </div>
      </div>
      {curseur && frame >= 4 && part < 1 ? (
        <svg width={fs * 1.6} height={fs * 1.6} viewBox="0 0 24 24" style={{position: 'absolute', left: cx, top: cy, opacity: 1 - part, filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.5))',
          transform: `scale(${frame >= clic && frame < clic + 4 ? 0.85 : 1})`}}>
          <path fill="#fff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" d="M5 2.5l13 12.2-6.2.5 3.6 6.6-2.6 1.4-3.6-6.6L5 21Z" />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};
