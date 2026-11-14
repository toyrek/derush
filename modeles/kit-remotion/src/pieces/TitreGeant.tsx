// Dérush — l'accroche : un grand titre de 2 ou 3 mots qui dit le sujet d'un coup d'œil. Posé DERRIÈRE la personne
// filmée (la vidéo, puis ce titre, puis <PersonneDevant>), c'est l'accroche qui a le mieux marché (« RÉCEPTION PRESSE »,
// 13 à 19 % de la hauteur de l'image). Chaque ligne prend la plus grande taille qui tient dans la largeur.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {ACCENT, arrive, lignesDe, OMBRE_TEXTE, progres, sortie, tailleQuiTient, usePolices} from './commun';

export type TitreGeantProps = {
  /** 2 ou 3 mots ; « \n » choisit la coupure (sinon deux lignes à peu près égales). */
  texte: string;
  /** Une petite ligne au-dessus (« AKATA · HÉRITAGES ») : jamais sous 3,2 % de la hauteur. */
  surTitre?: string;
  police?: string;
  poids?: number;
  couleur?: string;
  /** La couleur de la dernière ligne (par défaut la même) ; et celle du sur-titre. */
  accent?: string;
  /** Le centre du bloc, en part de la hauteur (0,3 : au-dessus de la tête d'une personne cadrée en buste). */
  y?: number;
  /** La part de la largeur occupée (0,94). */
  largeur?: number;
  /** La taille maximale d'une ligne, en part de la hauteur (0,24). */
  tailleMax?: number;
  /** Entrée : « impact » (chaque ligne tombe en grand, floue, puis se pose) ou « monte » (sort d'un cache). */
  entree?: 'impact' | 'monte';
  /** Durée de la pièce en images : elle sort sur les 8 dernières (sinon, elle reste). */
  duree?: number;
};

export const TitreGeant: React.FC<TitreGeantProps> = ({
  texte, surTitre, police = 'Anton', poids = 400, couleur = '#FFFFFF', accent, y = 0.3, largeur = 0.94, tailleMax = 0.24,
  entree = 'impact', duree,
}) => {
  const ok = usePolices();
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  if (!ok) return null;
  const lignes = lignesDe(texte);
  const tailles = lignes.map((l) => tailleQuiTient([l], police, poids, width * largeur, height * tailleMax, height * 0.06, 0.01));
  const tailleSur = Math.max(height * 0.032, Math.min(height * 0.045, tailleQuiTient([surTitre ?? ''], 'Montserrat', 800, width * largeur * 0.9, height * 0.045, 8, 0.14)));
  const fin = sortie(frame, duree);
  // la vie : le bloc grossit à peine, tout le temps (2,5 % sur 3 s)
  const vie = 1 + 0.025 * Math.min(1, frame / (fps * 3));
  const sortieEchelle = 1 + (1 - fin) * 0.08;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: height * y, transform: `translateY(-50%) scale(${vie * sortieEchelle})`, opacity: fin,
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
        {surTitre ? (
          <div style={{fontFamily: 'Montserrat', fontWeight: 800, fontSize: tailleSur, letterSpacing: '0.14em', color: accent ?? ACCENT, textShadow: OMBRE_TEXTE,
            marginBottom: tailleSur * 0.6, opacity: progres(frame, 6, 16), transform: `translateY(${(1 - progres(frame, 6, 16)) * tailleSur}px)`, whiteSpace: 'nowrap'}}>
            {surTitre}
          </div>
        ) : null}
        {lignes.map((l, k) => {
          const p = arrive(frame, fps, k * 3, 13);
          const pm = progres(frame, k * 3, k * 3 + 12);
          const style: React.CSSProperties = entree === 'impact'
            ? {transform: `scale(${interpolate(p, [0, 1], [1.4, 1])})`, opacity: Math.min(1, p * 1.8), filter: `blur(${Math.max(0, (1 - p) * 14)}px)`}
            : {transform: `translateY(${(1 - pm) * 105}%)`};
          return (
            <div key={k} style={{overflow: entree === 'monte' ? 'hidden' : 'visible', lineHeight: 0.9, padding: entree === 'monte' ? '0.04em 0' : 0}}>
              <div style={{fontFamily: police, fontWeight: poids, fontSize: tailles[k], letterSpacing: '0.01em', whiteSpace: 'nowrap',
                color: k === lignes.length - 1 && accent ? accent : couleur, textShadow: '0 0.04em 0.18em rgba(0,0,0,.35)', ...style}}>
                {l}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
