// toile.js — l'aide des toiles de Dérush. Aucune dépendance.
// Une toile est une page qui dessine exactement l'instant t : window.renderAt(t). Rien ici ne lit l'horloge : le même
// t donne toujours la même image. Importe ce qu'il te faut :
//   import {preparer, pret, avancee, rampe, courbes, bezier, ressort, graine, alea, bruit, tenu, battements} from './toile.js';

/** Garde v entre min et max. */
export const borne = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
/** Entre a et b, à la proportion p (0 donne a, 1 donne b). */
export const melange = (a, b, p) => a + (b - a) * p;
/** L'avancée, de 0 à 1, d'un geste qui part à `debut` et dure `duree` secondes. */
export const avancee = (t, debut, duree) => borne((t - debut) / Math.max(1e-6, duree));
/** Une valeur qui va de v0 à v1 entre les instants t0 et t1, le long d'une courbe (droite par défaut). */
export const rampe = (t, t0, t1, v0 = 0, v1 = 1, courbe = (p) => p) => melange(v0, v1, courbe(avancee(t, t0, t1 - t0)));

/**
 * Une courbe de Bézier comme en CSS : bezier(0.16, 1, 0.3, 1) rend une fonction p → valeur.
 * Une entrée : bezier(0.16, 1, 0.3, 1). Une sortie : bezier(0.7, 0, 0.84, 0). Un petit saut : bezier(0.34, 1.56, 0.64, 1).
 */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (u) => ((ax * u + bx) * u + cx) * u;
  const Y = (u) => ((ay * u + by) * u + cy) * u;
  const dX = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (p) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let u = p;
    for (let i = 0; i < 8; i++) { const e = X(u) - p; const d = dX(u); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; u -= e / d; }
    // si la recherche rapide s'égare, on coupe l'intervalle en deux
    if (!(u >= 0 && u <= 1) || Math.abs(X(u) - p) > 1e-4) { let a = 0, b = 1; u = p; for (let i = 0; i < 32; i++) { const e = X(u) - p; if (Math.abs(e) < 1e-6) break; if (e > 0) b = u; else a = u; u = (a + b) / 2; } }
    return Y(u);
  };
}
/** Les courbes de tous les jours : p de 0 à 1, résultat de 0 à 1. */
export const courbes = {
  droite: (p) => p,
  /** Arrive en douceur (l'essentiel du chemin au début) : une entrée. */
  entree: bezier(0.16, 1, 0.3, 1),
  /** Part en douceur et file (une sortie d'écran) : à faire durer moitié moins que l'entrée. */
  sortie: bezier(0.7, 0, 0.84, 0),
  /** Part et arrive en douceur : un déplacement d'un point à un autre. */
  aller: bezier(0.65, 0, 0.35, 1),
  /** Dépasse un peu, puis revient : un petit saut joyeux. */
  saut: bezier(0.34, 1.56, 0.64, 1),
};

/**
 * Un ressort, écrit comme une fonction du temps (jamais une vitesse qu'on additionne d'image en image) : 0 au départ,
 * 1 à l'arrivée. `s` = les secondes écoulées depuis le départ. `amorti` : 1 se pose sans dépasser (texte, interface),
 * 0,8 dépasse une fois (objet, logo), 0,5 rebondit deux fois (personnage). `frequence` : la vivacité, en allers-retours
 * par seconde.
 */
export function ressort(s, {amorti = 1, frequence = 2.2} = {}) {
  if (s <= 0) return 0;
  const w = 2 * Math.PI * frequence;
  const z = Math.max(0.05, amorti);
  if (Math.abs(z - 1) < 1e-4) return 1 - Math.exp(-w * s) * (1 + w * s);
  if (z < 1) { const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + (z * w / wd) * Math.sin(wd * s)); }
  const r = Math.sqrt(z * z - 1);
  const a = -w * (z - r), b = -w * (z + r);
  return 1 - (b * Math.exp(a * s) - a * Math.exp(b * s)) / (b - a);
}

/** Un tirage au hasard qui se répète : alea(42) rend une fonction () → nombre entre 0 et 1, toujours la même suite. */
export function alea(graine_ = 1) {
  let a = (graine_ >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
/**
 * Remplace Math.random par un tirage à graine : à appeler une fois, en haut de la page, quand une bibliothèque tire au
 * hasard toute seule (three.quarks, roughjs sans graine). Rend la fonction de tirage.
 */
export function graine(n = 1) { const r = alea(n); Math.random = r; return r; }
/** Un nombre au hasard qui ne dépend que de ses entrées (une case, un numéro de trait) : hasard(3, 7) est toujours le même. */
export function hasard(...n) { let h = 2166136261; for (const v of n) { h ^= Math.round(v * 1000) | 0; h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; }
/**
 * Un bruit doux à une dimension (une valeur qui se promène entre -1 et 1) : un tremblement de main, une lumière qui
 * respire. bruit(t * 0.8, 3) : la même courbe pour la même graine.
 */
export function bruit(x, graine_ = 0) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return melange(hasard(i, graine_) * 2 - 1, hasard(i + 1, graine_) * 2 - 1, u);
}
/**
 * Le temps « tenu » : l'image ne change que toutes les `pose` images (un dessin à la main se fait à 2 ou 3 images par
 * pose). tenu(t, 30, 3) rend le temps du début de la pose.
 */
export const tenu = (t, fps, pose = 2) => Math.floor(t * fps / pose + 1e-6) * pose / fps;
/** La grille de temps d'une musique : {images, secondes, instant(n)} pour un tempo donné. */
export function battements({bpm, fps}) {
  const images = Math.round(fps * 60 / bpm);
  return {images, secondes: images / fps, instant: (n) => n * images / fps};
}

/**
 * Déclare la toile et prépare son canevas : preparer({duree: 6, fps: 30, largeur: 1920, hauteur: 1080}) rend
 * {toile, canvas, ctx, L, H}. Le canevas est celui de la page (<canvas id="toile">), créé s'il manque.
 */
export function preparer({duree, fps = 30, largeur = 1920, hauteur = 1080, boucle = false, suite = false, contexte = '2d'} = {}) {
  window.__ready = false;
  window.toile = {duree, fps, largeur, hauteur, boucle, suite};
  let canvas = document.getElementById('toile');
  if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'toile'; document.body.appendChild(canvas); }
  canvas.width = largeur;
  canvas.height = hauteur;
  canvas.style.cssText = `display:block;width:${largeur}px;height:${hauteur}px`;
  return {toile: window.toile, canvas, ctx: contexte ? canvas.getContext(contexte) : null, L: largeur, H: hauteur};
}
/** Charge une image du dossier de la page : `const photo = await image('fond.jpg')`. */
export const image = (src) => new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ko(new Error(`image introuvable : ${src}`)); im.src = src; });
/**
 * Dit que la page est prête, une fois les polices et tout ce qu'on lui donne chargés : pret(document.fonts.load('96px Titre'), image('fond.jpg')).
 * Hors d'un rendu (la page ouverte dans un navigateur), elle joue en boucle, pour regarder.
 */
export async function pret(...attentes) {
  try {
    await Promise.all(attentes);
    if (document.fonts?.ready) await document.fonts.ready;
  } catch (e) { window.__bootFailed = String(e?.message ?? e); throw e; }
  if (typeof window.renderAt !== 'function') { window.__bootFailed = 'window.renderAt(t) manque : la page doit le définir avant d’appeler pret().'; return; }
  window.renderAt(0);
  window.__ready = true;
  if (!new URLSearchParams(location.search).has('render')) {
    const d = window.toile?.duree || 1;
    const t0 = performance.now();
    const tour = () => { window.renderAt(((performance.now() - t0) / 1000) % d); requestAnimationFrame(tour); };
    requestAnimationFrame(tour);
  }
}
