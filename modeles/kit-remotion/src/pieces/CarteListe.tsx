// Dérush — une carte qui se remplit au fil de ce qui est dit : une collection et ses titres, une liste, un lieu et ses
// adresses. Chaque élément arrive au moment où on le nomme (`a`, en secondes depuis le début de la pièce).
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ACCENT, arrive, progres, sortie, tailleQuiTient, usePolices} from './commun';

export type ElementCarte = string | {texte: string; a?: number};
export type CarteListeProps = {
  titre: string;
  /** Une petite ligne au-dessus du titre (« LA COLLECTION »). */
  surTitre?: string;
  elements: ElementCarte[];
  /** Le centre de la carte, en parts de l'image (0,5 ; 0,6). */
  x?: number;
  y?: number;
  largeur?: number;
  accent?: string;
  fond?: string;
  policeTitre?: string;
  police?: string;
  duree?: number;
};

export const CarteListe: React.FC<CarteListeProps> = ({
  titre, surTitre, elements, x = 0.5, y = 0.6, largeur = 0.84, accent = ACCENT, fond = 'rgba(14,14,20,.84)', policeTitre = 'Anton', police = 'Montserrat', duree,
}) => {
  const ok = usePolices();
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  if (!ok) return null;
  const L = width * largeur;
  const pad = L * 0.07;
  const fsTitre = tailleQuiTient([titre], policeTitre, 400, L - pad * 2, height * 0.07, height * 0.035, 0.01);
  const fsPuce = Math.max(height * 0.024, Math.min(height * 0.03, fsTitre * 0.42));
  const p = arrive(frame, fps, 0, 18);
  const fin = sortie(frame, duree);
  const liste = elements.map((e, i) => (typeof e === 'string' ? {texte: e, a: 0.45 + i * 0.32} : {texte: e.texte, a: e.a ?? 0.45 + i * 0.32}));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: width * x - L / 2, top: height * y, width: L, transform: `translateY(-50%) translateY(${(1 - p) * height * 0.05}px) scale(${0.94 + 0.06 * p})`,
        opacity: Math.min(1, p * 1.5) * fin, background: fond, borderRadius: L * 0.045, padding: pad, boxSizing: 'border-box',
        border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 30px 80px rgba(0,0,0,.45)', backdropFilter: 'blur(10px)'}}>
        <div style={{position: 'absolute', left: 0, top: pad, bottom: pad, width: fsPuce * 0.22, background: accent, borderRadius: 4, transform: `scaleY(${progres(frame, 4, 16)})`}} />
        {surTitre ? <div style={{fontFamily: police, fontWeight: 800, fontSize: fsPuce * 0.86, letterSpacing: '0.16em', color: accent, marginBottom: fsPuce * 0.7, textTransform: 'uppercase',
          opacity: progres(frame, 3, 12)}}>{surTitre}</div> : null}
        <div style={{fontFamily: policeTitre, fontSize: fsTitre, lineHeight: 1.08, paddingTop: fsTitre * 0.04, color: '#fff', whiteSpace: 'nowrap', opacity: progres(frame, 2, 12),
          transform: `translateY(${(1 - progres(frame, 2, 12)) * fsTitre * 0.3}px)`}}>{titre}</div>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: fsPuce * 0.45, marginTop: fsPuce * 0.9}}>
          {liste.map((e, i) => {
            const q = arrive(frame, fps, Math.round(e.a * fps), 14);
            return (
              <div key={i} style={{fontFamily: police, fontWeight: 600, fontSize: fsPuce, color: '#fff', padding: `${fsPuce * 0.38}px ${fsPuce * 0.7}px`, borderRadius: fsPuce,
                background: 'rgba(255,255,255,.09)', border: `1.5px solid ${accent}`, whiteSpace: 'nowrap', opacity: Math.min(1, q * 1.6),
                transform: `scale(${0.7 + 0.3 * q}) translateY(${(1 - q) * fsPuce * 0.4}px)`}}>
                {e.texte}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
