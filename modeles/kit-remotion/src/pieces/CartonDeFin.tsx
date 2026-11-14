// Dérush — le carton de fin : jamais sur une image figée. Le fond continue de vivre (la vidéo, floutée et assombrie,
// qui avance), et par-dessus : la couverture ou l'image du sujet, le titre, l'auteur, l'éditeur.
//   <CartonDeFin titre="FIRE !" auteur="Hideko Mizuno" editeur="Akata · Collection Héritages" image="fin/couverture.jpg">
//     <Video src={staticFile('plans/M1.mp4')} trimBefore={1300} muted />
//   </CartonDeFin>
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ACCENT, arrive, progres, sortie, tailleQuiTient, usePolices} from './commun';

export type CartonDeFinProps = {
  /** Le fond qui continue de bouger (la vidéo, ralentie ou non) : il est flouté et assombri ici. */
  children?: React.ReactNode;
  titre: string;
  auteur?: string;
  editeur?: string;
  /** Une ligne de plus (« VOLUME 1 », « EN LIBRAIRIE »). */
  detail?: string;
  /** Une image dans public/ (la couverture, une affiche), posée en haut, en léger relief. */
  image?: string;
  accent?: string;
  policeTitre?: string;
  flou?: number;
  sombre?: number;
  duree?: number;
};

export const CartonDeFin: React.FC<CartonDeFinProps> = ({
  children, titre, auteur, editeur, detail, image, accent = ACCENT, policeTitre = 'Anton', flou = 18, sombre = 0.55, duree,
}) => {
  const ok = usePolices();
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const f = progres(frame, 0, 14);
  const fin = sortie(frame, duree, 10);
  const vertical = height > width;
  const fsTitre = ok ? tailleQuiTient([titre], policeTitre, 400, width * 0.84, height * (vertical ? 0.1 : 0.14), height * 0.05, 0.01) : height * 0.08;
  const fs = height * (vertical ? 0.028 : 0.04);
  const entre = (k: number) => {
    const q = arrive(frame, fps, 6 + k * 4, 16);
    return {opacity: Math.min(1, q * 1.6), transform: `translateY(${(1 - q) * fs * 1.4}px)`};
  };
  const qi = arrive(frame, fps, 2, 15);
  return (
    <AbsoluteFill style={{opacity: fin}}>
      <AbsoluteFill style={{filter: `blur(${flou * f}px) brightness(${1 - sombre * f})`, transform: `scale(${1.08 + 0.03 * (frame / (fps * 4))})`}}>{children}</AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 30%, rgba(0,0,0,${0.45 * f}) 100%)`}} />
      {ok ? (
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: fs * 0.7, padding: `${height * 0.12}px ${width * 0.08}px ${height * 0.22}px`}}>
          {image ? (
            <div style={{perspective: 1200, marginBottom: fs * 0.6, opacity: Math.min(1, qi * 1.5)}}>
              <Img src={staticFile(image)} style={{height: height * (vertical ? 0.32 : 0.42), borderRadius: 10, boxShadow: '0 30px 70px rgba(0,0,0,.6)',
                transform: `rotateY(${(1 - qi) * -28 - 6}deg) rotateZ(${(1 - qi) * -4}deg) scale(${0.85 + 0.15 * qi})`}} />
            </div>
          ) : null}
          <div style={{fontFamily: policeTitre, fontSize: fsTitre, lineHeight: 0.92, color: '#fff', textAlign: 'center', whiteSpace: 'nowrap', textShadow: '0 0.05em 0.3em rgba(0,0,0,.5)', ...entre(0)}}>{titre}</div>
          {auteur ? <div style={{fontFamily: 'Montserrat', fontWeight: 800, fontSize: fs * 1.15, color: '#fff', letterSpacing: '0.02em', textAlign: 'center', ...entre(1)}}>{auteur}</div> : null}
          {editeur ? <div style={{fontFamily: 'Montserrat', fontWeight: 600, fontSize: fs * 0.9, color: accent, letterSpacing: '0.12em', textTransform: 'uppercase', padding: `${fs * 0.35}px ${fs * 0.8}px`,
            border: `1.5px solid ${accent}`, borderRadius: fs, ...entre(2)}}>{editeur}</div> : null}
          {detail ? <div style={{fontFamily: 'Montserrat', fontWeight: 800, fontSize: fs * 0.85, color: 'rgba(255,255,255,.75)', letterSpacing: '0.2em', textTransform: 'uppercase', ...entre(3)}}>{detail}</div> : null}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
