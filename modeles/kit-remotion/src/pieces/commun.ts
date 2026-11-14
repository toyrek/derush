// Dérush — ce que partagent les pièces du kit : les polices (attendues avant toute mesure de texte), la mesure du texte,
// les courbes d'animation. Tout se calcule à partir du numéro d'image : aucune animation ne dépend de l'horloge.
import {useEffect, useState} from 'react';
import {continueRender, delayRender, Easing, interpolate, spring, staticFile} from 'remotion';
// @ts-ignore (JavaScript pur : le même fichier que dans l'app Dérush)
import {chargerPolices} from '../moteur.js';

const BASE = staticFile('polices').replace(/\/polices$/, '');
let pretes = false;
let attente: Promise<unknown> | null = null;

/**
 * Attend les polices du kit avant de dessiner. Une mesure faite avant leur chargement est fausse (et `measureText` de
 * @remotion/layout-utils la garde en cache : le texte déborde ensuite). Renvoie true quand elles sont là.
 */
export function usePolices(): boolean {
  const [ok, setOk] = useState(pretes);
  const [poignee] = useState(() => (pretes ? null : delayRender('Les polices du kit')));
  useEffect(() => {
    if (poignee == null) return;
    const fini = () => { setOk(true); continueRender(poignee); };
    attente ??= Promise.resolve(chargerPolices(BASE)).then(() => (document as any).fonts?.ready).then(() => { pretes = true; });
    attente.then(fini, fini);
  }, [poignee]);
  return ok;
}

let toile: CanvasRenderingContext2D | null = null;
/** La largeur d'un texte en pixels, mesurée sur une toile (les polices doivent être chargées : usePolices). */
export function largeurTexte(txt: string, famille: string, poids: number, taille: number, espacementEm = 0): number {
  toile ??= document.createElement('canvas').getContext('2d');
  if (!toile) return txt.length * taille * 0.6;
  toile.font = `${poids} ${taille}px "${famille}"`;
  return toile.measureText(txt).width + espacementEm * taille * Math.max(0, [...txt].length - 1);
}

/** La plus grande taille (px), entre `mini` et `maxi`, pour que chaque ligne tienne dans `largeur` pixels. */
export function tailleQuiTient(lignes: string[], famille: string, poids: number, largeur: number, maxi: number, mini = 8, espacementEm = 0): number {
  const l100 = Math.max(1, ...lignes.map((l) => largeurTexte(l, famille, poids, 100, espacementEm)));
  return Math.max(mini, Math.min(maxi, (largeur / l100) * 100));
}

/** Coupe un texte en lignes : là où il y a « \n », sinon en deux lignes à peu près égales (un seul mot : une ligne). */
export function lignesDe(txt: string): string[] {
  if (txt.includes('\n')) return txt.split('\n').map((l) => l.trim()).filter(Boolean);
  const mots = txt.trim().split(/\s+/);
  if (mots.length < 2) return [txt.trim()];
  let mieux = 1;
  let ecart = Infinity;
  for (let i = 1; i < mots.length; i++) {
    const e = Math.abs(mots.slice(0, i).join(' ').length - mots.slice(i).join(' ').length);
    if (e < ecart) { ecart = e; mieux = i; }
  }
  return [mots.slice(0, mieux).join(' '), mots.slice(mieux).join(' ')];
}

/** Ce qui glisse ralentit en douceur ; ce qui arrive rebondit à peine (amorti 14 à 20 : léger rebond). */
export const glisse = Easing.bezier(0.16, 1, 0.3, 1);
export const arrive = (frame: number, fps: number, delai = 0, amorti = 16) =>
  spring({frame: frame - delai, fps, config: {damping: amorti, mass: 0.7, stiffness: 170}});
/** De 0 à 1 entre deux images, en glissant. */
export const progres = (frame: number, de: number, a: number, courbe = glisse) =>
  interpolate(frame, [de, a], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: courbe});
/** 1 puis 0 sur les `n` dernières images d'une pièce de `duree` images (toujours 1 si la durée n'est pas donnée). */
export const sortie = (frame: number, duree?: number, n = 8) => (duree ? Math.min(1, Math.max(0, (duree - frame) / n)) : 1);

export const ACCENT = '#FFD60A';
export const OMBRE_TEXTE = '0 0.06em 0.25em rgba(0,0,0,.55), 0 0.02em 0.05em rgba(0,0,0,.45)';
/** Les zones que TikTok, Reels et Shorts couvrent (boutons, légende) : rien d'important dedans. Parts de l'image. */
export const ZONE_SURE = {haut: 0.1, bas: 0.22, gauche: 0.05, droite: 0.14};
