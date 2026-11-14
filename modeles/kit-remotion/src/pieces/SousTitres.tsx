// Dérush — des sous-titres soignés, mot à mot : 2 à 4 mots par bloc, coupés aux bons endroits (fin de phrase, virgule,
// pause), jamais un petit mot seul, le mot dit mis en valeur, un bloc sur une ligne (la taille s'ajuste jusqu'à 3,4 %
// de la hauteur ; en dessous, il passe sur deux lignes équilibrées), de
// vraies espaces même avec un contour épais (sinon « cettecollection »). Les temps viennent de sous-titres/mots.json
// (mots du montage, en secondes de la vidéo) ou de ta voix nettoyée.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ACCENT, largeurTexte, usePolices} from './commun';

export type Mot = {t: string; debut: number; fin: number};
export type Bloc = {mots: Mot[]; debut: number; fin: number};

const lettres = (t: string) => t.replace(/[^\p{L}\p{N}]/gu, '').length;

/** Les blocs : coupés en fin de phrase, après une virgule (2 mots au moins), sur une pause, ou quand c'est trop long. */
export function blocsDeMots(mots: Mot[], {maxMots = 4, maxLettres = 22, pause = 0.35} = {}): Bloc[] {
  // une ponctuation seule (« Fire ! » à la française) rejoint le mot d'avant, par une espace insécable : jamais un « ! » allumé tout seul
  const lies: Mot[] = [];
  for (const w of mots) {
    if (!w?.t?.trim()) continue;
    if (lies.length && /^[!?;:»…]+$/.test(w.t.trim())) { const p = lies[lies.length - 1]; lies[lies.length - 1] = {...p, t: `${p.t} ${w.t.trim()}`, fin: Math.max(p.fin, w.fin)}; }
    else lies.push(w);
  }
  const blocs: Mot[][] = [];
  let cur: Mot[] = [];
  for (const w of lies) {
    if (!w?.t?.trim()) continue;
    if (cur.length) {
      const prec = cur[cur.length - 1];
      const long = [...cur, w].map((x) => x.t).join(' ').length;
      const coupe = cur.length >= maxMots || long > maxLettres || /[.!?…]$/.test(prec.t) || w.debut - prec.fin > pause || (/[,;:]$/.test(prec.t) && cur.length >= 2);
      if (coupe) { blocs.push(cur); cur = []; }
    }
    cur.push(w);
  }
  if (cur.length) blocs.push(cur);
  // jamais un petit mot seul : il rejoint le bloc suivant (ou le précédent) s'il en est proche
  for (let i = 0; i < blocs.length; i++) {
    const b = blocs[i];
    if (b.length !== 1 || lettres(b[0].t) > 3) continue;
    const s = blocs[i + 1];
    const p = blocs[i - 1];
    if (s && s[0].debut - b[0].fin <= pause * 2 && [...b, ...s].map((x) => x.t).join(' ').length <= maxLettres + 6) { blocs[i + 1] = [...b, ...s]; blocs.splice(i, 1); i--; }
    else if (p && b[0].debut - p[p.length - 1].fin <= pause * 2) { p.push(...b); blocs.splice(i, 1); i--; }
  }
  return blocs.map((b) => ({mots: b, debut: b[0].debut, fin: b[b.length - 1].fin}));
}

export type SousTitresProps = {
  /** Les mots, en secondes de la vidéo (sous-titres/mots.json : {t, debut, fin}). */
  mots: Mot[];
  /** Secondes ajoutées au temps de l'image (si la pièce est dans une Sequence qui ne commence pas à 0). */
  decalage?: number;
  police?: string;
  poids?: number;
  /** Taille voulue, en part de la hauteur (0,046) ; elle baisse si le bloc ne tient pas sur une ligne (jamais sous 0,034). */
  taille?: number;
  couleur?: string;
  /** La couleur du mot qu'on entend. */
  accent?: string;
  /** Le centre des sous-titres, en part de la hauteur (0,69 : au-dessus des boutons et de la légende des réseaux). */
  y?: number;
  largeur?: number;
  /** Un contour (px) ; 0 = une ombre portée. */
  contour?: number;
  /** Une plaque sombre derrière (sur un fond clair : une page blanche, un ciel). */
  plaque?: boolean;
  majuscules?: boolean;
  maxMots?: number;
  maxLettres?: number;
};

export const SousTitres: React.FC<SousTitresProps> = ({
  mots, decalage = 0, police = 'Montserrat', poids = 800, taille = 0.046, couleur = '#FFFFFF', accent = ACCENT, y = 0.69, largeur = 0.86,
  contour = 0, plaque = false, majuscules = false, maxMots = 4, maxLettres = 22,
}) => {
  const ok = usePolices();
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const blocs = React.useMemo(() => blocsDeMots(mots, {maxMots, maxLettres}), [mots, maxMots, maxLettres]);
  if (!ok) return null;
  const t = frame / fps + decalage;
  const k = blocs.findIndex((b, i) => t >= b.debut - 0.04 && t < Math.min(blocs[i + 1] ? blocs[i + 1].debut - 0.02 : Infinity, b.fin + 0.5));
  if (k < 0) return null;
  const b = blocs[k];
  const txt = b.mots.map((w) => w.t).join(' ');
  const affiche = majuscules ? txt.toUpperCase() : txt;
  // la taille : celle voulue si le bloc tient sur une ligne, plus petite sinon ; en dessous du minimum, il passe sur deux lignes
  const voulue = height * taille;
  const mini = height * 0.034;
  const dispo = width * largeur - (plaque ? voulue * 0.9 : 0);
  const l = largeurTexte(affiche, police, poids, voulue) + (b.mots.length - 1) * (contour * 0.6 + voulue * 0.08);
  const fs = Math.max(mini, Math.min(voulue, (voulue * dispo) / Math.max(1, l)));
  const deuxLignes = l * (fs / voulue) > dispo + 1;
  const entree = Math.min(1, Math.max(0, (t - b.debut + 0.04) / 0.12));
  const dit = b.mots.reduce((n, w, i) => (t >= w.debut ? i : n), -1);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: height * y, transform: `translateY(-50%) translateY(${(1 - entree) * fs * 0.25}px) scale(${0.92 + 0.08 * entree})`,
        opacity: entree, textAlign: 'center', display: 'flex', justifyContent: 'center'}}>
        <div style={{fontFamily: police, fontWeight: poids, fontSize: fs, lineHeight: 1.18, color: couleur, maxWidth: width * largeur,
          whiteSpace: deuxLignes ? 'normal' : 'nowrap', textWrap: 'balance' as any, wordSpacing: `${contour * 0.6 + fs * 0.08}px`,
          textTransform: majuscules ? 'uppercase' : 'none',
          ...(plaque ? {background: 'rgba(8,8,12,.66)', padding: `${fs * 0.16}px ${fs * 0.42}px`, borderRadius: fs * 0.32, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone'} : {}),
          ...(contour > 0 ? {WebkitTextStroke: `${contour}px rgba(0,0,0,.92)`, paintOrder: 'stroke fill'} : {textShadow: '0 0.05em 0.22em rgba(0,0,0,.7), 0 0.02em 0.05em rgba(0,0,0,.6)'})}}>
          {b.mots.map((w, i) => {
            const pop = t >= w.debut ? Math.max(0, 1 - (t - w.debut) / 0.18) : 0;
            return (
              <React.Fragment key={i}>
                {i > 0 ? ' ' : null}
                <span style={{display: 'inline-block', color: i === dit ? accent : couleur, transform: `translateY(${-0.07 * pop}em)`}}>{majuscules ? w.t.toUpperCase() : w.t}</span>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
