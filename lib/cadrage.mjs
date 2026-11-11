// Dérush — recadrage automatique : où se trouve le sujet dans l'image, au fil du temps.
// Apple Vision repère visages, hauts du corps et zones qui attirent l'œil ; on en tire une « caméra »
// qui suit le sujet calmement (sans tremblement) et qui saute aux changements de plan.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg, lancer, ecrireJson, lireJson} from './outils.mjs';
import {arrondi} from './commun.mjs';
import {binVision} from './moteurs.mjs';

/** Choisit la cible d'une image : visages d'abord, puis haut du corps, puis zone saillante. */
function cible(e) {
  const visages = (e.visages ?? []).filter((b) => b[4] >= 0.5).sort((a, b) => b[2] * b[3] - a[2] * a[3]);
  if (visages.length) {
    const p = visages[0];
    let [x0, y0, x1, y1] = [p[0], p[1], p[0] + p[2], p[1] + p[3]];
    // les autres visages proches du principal restent dans le cadre (un plan à deux)
    for (const b of visages.slice(1)) {
      const nx0 = Math.min(x0, b[0]);
      const nx1 = Math.max(x1, b[0] + b[2]);
      if (nx1 - nx0 < 0.3) { x0 = nx0; x1 = nx1; y0 = Math.min(y0, b[1]); y1 = Math.max(y1, b[1] + b[3]); }
    }
    // un peu sous le visage : on garde de l'air au-dessus de la tête et on voit les épaules
    return {x: (x0 + x1) / 2, y: Math.min(1, (y0 + y1) / 2 + (y1 - y0) * 0.35), type: 'visage', n: visages.length};
  }
  const corps = (e.corps ?? []).filter((b) => b[4] >= 0.5).sort((a, b) => b[2] * b[3] - a[2] * a[3])[0];
  if (corps) return {x: corps[0] + corps[2] / 2, y: corps[1] + corps[3] * 0.4, type: 'corps'};
  const s = (e.saillance ?? []).sort((a, b) => b[4] - a[4])[0];
  if (s) return {x: s[0] + s[2] / 2, y: s[1] + s[3] / 2, type: 'sujet'};
  return {x: null, y: null, type: 'rien'};
}

const mediane = (v) => [...v].sort((a, b) => a - b)[v.length >> 1];

/** Lissage par plan de caméra : médiane (anti-saut), moyenne (douceur), zone morte (caméra posée). */
function lisser(points, coupes) {
  // trous : on garde la dernière position connue (ou la suivante, ou le centre)
  let dernier = points.find((p) => p.x != null) ?? {x: 0.5, y: 0.5};
  for (const p of points) {
    if (p.x == null) Object.assign(p, {x: dernier.x, y: dernier.y, type: dernier.type === 'rien' ? 'centre' : 'garde'});
    else dernier = p;
  }
  const bornes = [0, ...coupes.filter((c) => c > 0), Infinity];
  const res = [];
  for (let k = 0; k < bornes.length - 1; k++) {
    const seg = points.filter((p) => p.t >= bornes[k] && p.t < bornes[k + 1]);
    if (!seg.length) continue;
    const lisse = (cle) => {
      const med = seg.map((_, i) => mediane(seg.slice(Math.max(0, i - 2), i + 3).map((p) => p[cle])));
      return med.map((_, i) => {
        const fen = med.slice(Math.max(0, i - 2), i + 3);
        return fen.reduce((a, b) => a + b, 0) / fen.length;
      });
    };
    const xs = lisse('x');
    const ys = lisse('y');
    let cx = xs[0];
    let cy = ys[0];
    seg.forEach((p, i) => {
      // la caméra ne bouge que si le sujet s'éloigne vraiment
      if (Math.abs(xs[i] - cx) > 0.035) cx += (xs[i] - cx) * 0.6;
      if (Math.abs(ys[i] - cy) > 0.035) cy += (ys[i] - cy) * 0.6;
      res.push({t: arrondi(p.t, 3), x: arrondi(cx, 3), y: arrondi(cy, 3), type: p.type, ...(i === 0 && k > 0 ? {coupe: true} : {})});
    });
  }
  return res;
}

export async function faireCadrage(P, m, D, prog, fichierLecture) {
  if (m.type !== 'video') return false;
  const bin = await binVision();
  if (!bin) return false;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-cadrage-'));
  try {
    const fps = m.duree > 1800 ? 1 : 2;
    await ffmpeg(['-y', '-i', fichierLecture(P, m), '-map', '0:v:0', '-an', '-vf', `fps=${fps},scale=480:-2`, '-q:v', '5', path.join(tmp, 'f-%06d.jpg')], {duree: m.duree, prog: (p) => prog(p * 0.35)});
    const {out} = await lancer(bin, ['cadrage', tmp], {
      surStderr: (s) => {
        for (const x of s.matchAll(/progress=(\d+)%/g)) prog(0.35 + (Number(x[1]) / 100) * 0.6);
      },
    });
    const images = JSON.parse(out.toString()).images;
    const coupes = lireJson(path.join(D, 'analyse.json'))?.coupes_camera ?? [];
    const points = lisser(images.map((e, k) => ({t: k / fps, ...cible(e)})), coupes);
    const visages = points.filter((p) => p.type === 'visage').length;
    ecrireJson(path.join(D, 'cadrage.json'), {
      explication: 'Centre d’intérêt de l’image au fil du temps (x, y en fractions de l’image, origine en haut à gauche). type : visage, corps, sujet (zone qui attire l’œil), garde (position tenue), centre.',
      fps_echantillons: fps, points,
    }, 0);
    m.cadrage = {points: points.length, visages, part_visages: arrondi(visages / Math.max(1, points.length), 2)};
    return true;
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}
