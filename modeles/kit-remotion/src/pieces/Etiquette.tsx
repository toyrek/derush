// Dérush — une étiquette : le nom qu'on prononce (« SERVICE PRESSE · AKATA »), sur une barre qui s'ouvre de gauche à
// droite. Lisible sur un téléphone : jamais sous 2,8 % de la hauteur de l'image.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ACCENT, progres, sortie, tailleQuiTient, usePolices} from './commun';

export type EtiquetteProps = {
  /** Le texte ; ce qui suit « · » (ou `accent`) prend la couleur d'accent. */
  texte: string;
  accent?: string;
  couleur?: string;
  couleurAccent?: string;
  fond?: string;
  /** Le coin haut gauche, en parts de l'image (0,06 ; 0,12 : sous la zone du haut des réseaux). */
  x?: number;
  y?: number;
  /** La hauteur des lettres, en part de la hauteur de l'image (0,034 ; jamais sous 0,028). */
  taille?: number;
  /** La largeur maximale, en part de la largeur (0,8) : le texte rétrécit pour tenir, il ne déborde jamais. */
  largeurMax?: number;
  police?: string;
  poids?: number;
  duree?: number;
};

export const Etiquette: React.FC<EtiquetteProps> = ({
  texte, accent, couleur = '#FFFFFF', couleurAccent = ACCENT, fond = 'rgba(10,10,14,.92)', x = 0.06, y = 0.12, taille = 0.034, largeurMax = 0.8,
  police = 'Montserrat', poids = 800, duree,
}) => {
  const ok = usePolices();
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  if (!ok) return null;
  const [a, b] = accent ? [texte, accent] : texte.split(/\s*·\s*/, 2);
  const complet = b ? `${a} · ${b}` : a;
  const fs = Math.max(height * 0.028, tailleQuiTient([complet.toUpperCase()], police, poids, width * largeurMax - height * taille * 1.6, height * Math.max(0.028, taille), 8, 0.08));
  const ouvre = progres(frame, 0, 10);
  const lettres = progres(frame, 5, 15);
  const fin = sortie(frame, duree);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: width * x, top: height * y, display: 'flex', alignItems: 'stretch', opacity: fin,
        transform: `translateX(${(1 - fin) * -fs}px)`, filter: 'drop-shadow(0 8px 22px rgba(0,0,0,.35))'}}>
        <div style={{width: fs * 0.28, background: couleurAccent, transform: `scaleY(${progres(frame, 0, 7)})`, transformOrigin: 'top'}} />
        <div style={{background: fond, padding: `${fs * 0.42}px ${fs * 0.62}px`, clipPath: `inset(0 ${(1 - ouvre) * 100}% 0 0)`}}>
          <div style={{fontFamily: police, fontWeight: poids, fontSize: fs, lineHeight: 1, letterSpacing: '0.08em', whiteSpace: 'nowrap', color: couleur,
            textTransform: 'uppercase', opacity: lettres, transform: `translateX(${(1 - lettres) * -fs * 0.6}px)`}}>
            {a}{b ? <><span style={{opacity: 0.55}}>{' · '}</span><span style={{color: couleurAccent}}>{b}</span></> : null}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
