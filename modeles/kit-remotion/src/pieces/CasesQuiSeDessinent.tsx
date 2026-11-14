// Dérush — des cases de bande dessinée qui se tracent sur l'image (« le découpage », « les cases », « la mise en
// page ») : chaque cadre se dessine d'un trait, l'un après l'autre. Donne les cases (parts de l'image), ou une grille.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {progres, sortie} from './commun';

export type Case = [number, number, number, number];
export type CasesQuiSeDessinentProps = {
  /** Les cases : [x, y, largeur, hauteur] en parts de l'image. Sinon, une grille dans `zone`. */
  cases?: Case[];
  grille?: {lignes: number; colonnes: number};
  /** Où poser la grille : [x, y, largeur, hauteur] (par défaut au centre, hors des zones des réseaux). */
  zone?: Case;
  gouttiere?: number;
  couleur?: string;
  /** L'épaisseur du trait, en part de la largeur (0,007). */
  epaisseur?: number;
  /** Images pour tracer une case (14) ; images entre deux cases (5). */
  trace?: number;
  decalage?: number;
  duree?: number;
};

export const CasesQuiSeDessinent: React.FC<CasesQuiSeDessinentProps> = ({
  cases, grille = {lignes: 3, colonnes: 2}, zone = [0.08, 0.16, 0.84, 0.6], gouttiere = 0.02, couleur = '#FFFFFF', epaisseur = 0.007, trace = 14, decalage = 5, duree,
}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const liste: Case[] = cases ?? (() => {
    const [zx, zy, zl, zh] = zone;
    const l = (zl - gouttiere * (grille.colonnes - 1)) / grille.colonnes;
    const h = (zh - gouttiere * (width / height) * (grille.lignes - 1)) / grille.lignes;
    const r: Case[] = [];
    for (let i = 0; i < grille.lignes; i++) for (let j = 0; j < grille.colonnes; j++) r.push([zx + j * (l + gouttiere), zy + i * (h + gouttiere * (width / height)), l, h]);
    return r;
  })();
  const ep = width * epaisseur;
  const fin = sortie(frame, duree);
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: fin}}>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0, overflow: 'visible', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.45))'}}>
        {liste.map(([x, y, l, h], k) => {
          const X = x * width;
          const Y = y * height;
          const L = l * width;
          const H = h * height;
          const tour = 2 * (L + H);
          const p = progres(frame, k * decalage, k * decalage + trace);
          return (
            <rect key={k} x={X} y={Y} width={L} height={H} rx={ep * 0.6} fill="none" stroke={couleur} strokeWidth={ep} strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={tour} strokeDashoffset={tour * (1 - p)} opacity={p > 0 ? 1 : 0} />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
