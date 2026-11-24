// Dérush — la mesure du mouvement d'une vidéo finie. Une image fixe ne dit pas si ça bouge : une planche peut être
// parfaite alors que la moitié du film est figée. Ici, FFmpeg compare chaque image à la précédente, en une passe :
//   - les passages figés (rien ne change du tout pendant 0,8 s ou plus), avec leurs temps ;
//   - les passages presque immobiles (un détail seulement bouge : un trait fin qui se trace, un curseur) : sur un
//     téléphone, ils se lisent comme une image fixe ;
//   - le mouvement seconde par seconde (un petit graphique en texte) : chaque geste prévu doit y faire une bosse ;
//   - les images vides (un aplat uni, sans rien dedans) : plus de 3 de suite, c'est un trou dans le film ;
//   - la fin tenue : combien de temps la dernière image reste sans changer (au-delà de 1,4 s, c'est trop) ;
//   - la part du film qui ne bouge pas : au-delà d'un tiers, il se regarde comme un diaporama.
// Rien n'est jugé à la place de l'IA : une tenue peut être voulue. C'est « à regarder », avec des nombres. Les seuils
// des images vides et de la fin tenue sont ceux des contrôles G2 et G3 de motionmaxxing (Apache-2.0), calculés ici
// sans reprendre son code.
import {spawn} from 'node:child_process';
import {FFMPEG} from './outils.mjs';

/**
 * L'écart moyen entre deux images (sur 255, à 320 px de large). Sous SEUIL_FIGE, rien n'a changé : une image tenue
 * donne 0. Sous SEUIL_CALME, presque rien : un trait fin qui se trace donne de 0,01 à 0,05, un plan qui vit 0,2 et plus.
 */
export const SEUIL_FIGE = 0.004;
export const SEUIL_CALME = 0.06;
export const DUREE_FIGEE = 0.8;
/** Sous cette entropie (0 = un aplat parfait, 1 = du bruit), une image est « vide ». */
export const SEUIL_VIDE = 0.02;
export const SUITE_VIDE = 3;
export const FIN_TENUE_MAX = 1.4;
const BARRES = '▁▂▃▄▅▆▇█';
const arrondi = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;

/** Les mesures d'une image à la suivante : [{t, ecart, entropie}] (t : le temps de la seconde image). */
export function mesuresImages(video, {largeur = 320, dureeMax = 15 * 60e3} = {}) {
  return new Promise((ok, ko) => {
    const p = spawn(FFMPEG, ['-v', 'error', '-i', video, '-an', '-vf', `scale=${largeur}:-2:flags=bilinear,format=gray,entropy,tblend=all_mode=difference,signalstats,metadata=print:file=-`, '-f', 'null', '-'], {stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true});
    let reste = '';
    let err = '';
    let cours = null;
    const r = [];
    const minuteur = setTimeout(() => { p.kill(); ko(new Error('La mesure du mouvement a pris trop de temps.')); }, dureeMax);
    const lire = (ligne) => {
      let m = /pts_time:([0-9.]+)/.exec(ligne);
      if (m) { cours = {t: Number(m[1]), ecart: null, entropie: null}; return; }
      if (!cours) return;
      // FFmpeg écrit les très petits nombres avec un exposant (« 9.6e-07 ») : il fait partie du nombre
      m = /lavfi\.entropy\.normalized_entropy\.normal\.Y=([0-9.eE+-]+)/.exec(ligne);
      if (m) { cours.entropie = Number(m[1]); return; }
      m = /lavfi\.signalstats\.YAVG=([0-9.eE+-]+)/.exec(ligne);
      if (m) { cours.ecart = Number(m[1]) || 0; r.push(cours); cours = null; }
    };
    p.stdout.on('data', (d) => { const l = (reste + d).split('\n'); reste = l.pop(); l.forEach(lire); });
    p.stderr.on('data', (d) => { err = (err + d).slice(-600); });
    p.on('error', (e) => { clearTimeout(minuteur); ko(e); });
    p.on('close', (code) => {
      clearTimeout(minuteur);
      if (reste) lire(reste);
      if (code !== 0 && !r.length) return ko(new Error(`FFmpeg n’a pas pu lire la vidéo : ${err.trim().slice(-200)}`));
      // certaines versions de FFmpeg rendent la toute première image telle quelle (comparée à rien) : elle ne compte pas
      ok(r.length && r[0].t < 1e-6 ? r.slice(1) : r);
    });
  });
}
/** L'ancien nom : les écarts seuls. */
export const ecartsImages = mesuresImages;

/** Les passages figés d'une suite de mesures : [{de, a, duree}] (au moins `dureeMin` secondes sous le seuil). */
export function passagesFiges(mesures, {seuil = SEUIL_FIGE, dureeMin = DUREE_FIGEE} = {}) {
  const r = [];
  let debut = null;
  let avant = mesures.length ? mesures[0].t - (mesures[1] ? mesures[1].t - mesures[0].t : 1 / 30) : 0;
  const fermer = (fin) => { if (debut != null && fin - debut >= dureeMin - 1e-6) r.push({de: arrondi(debut), a: arrondi(fin), duree: arrondi(fin - debut)}); debut = null; };
  for (const e of mesures) {
    if (e.ecart < seuil) { if (debut == null) debut = avant; } else fermer(avant);
    avant = e.t;
  }
  fermer(avant);
  return r;
}
/** Les suites d'images vides (un aplat uni) de plus de `suite` images : [{de, a, images}]. */
export function imagesVides(mesures, {seuil = SEUIL_VIDE, suite = SUITE_VIDE} = {}) {
  const r = [];
  let debut = null;
  let n = 0;
  const fermer = (fin) => { if (n > suite) r.push({de: arrondi(debut), a: arrondi(fin), images: n}); debut = null; n = 0; };
  let avant = 0;
  for (const e of mesures) {
    if (e.entropie != null && e.entropie < seuil) { if (debut == null) debut = e.t; n++; } else if (debut != null) fermer(avant);
    avant = e.t;
  }
  if (debut != null) fermer(avant);
  return r;
}
/** Le mouvement moyen de chaque seconde, et son dessin en barres (une barre par seconde, « · » : rien ne bouge). */
export function parSeconde(mesures) {
  const s = [];
  for (const e of mesures) { const i = Math.max(0, Math.floor(e.t - 1e-6)); (s[i] ??= []).push(e.ecart); }
  const valeurs = Array.from(s, (v) => (v?.length ? arrondi(v.reduce((a, b) => a + b, 0) / v.length) : 0));
  const max = Math.max(1e-6, ...valeurs);
  return {valeurs, graphe: valeurs.map((v) => (v < SEUIL_FIGE ? '·' : BARRES[Math.min(7, Math.floor((v / max) * 8))])).join('')};
}
/** Les passages presque immobiles qui ne sont pas déjà des passages figés : [{de, a, duree}]. */
export function passagesCalmes(mesures, figes, {dureeMin = DUREE_FIGEE} = {}) {
  const dans = (c) => figes.reduce((n, f) => n + Math.max(0, Math.min(c.a, f.a) - Math.max(c.de, f.de)), 0);
  return passagesFiges(mesures, {seuil: SEUIL_CALME, dureeMin}).filter((c) => dans(c) < c.duree * 0.8);
}

const temps = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

/**
 * Le bilan du mouvement d'une vidéo : {ok, duree_s, images, figes, calmes, vides, fin_tenue_s, part_figee,
 * plus_long_s, par_seconde, graphe, attention: [phrases]}. `part_figee` : la part des images où presque rien ne bouge.
 * `attention` : ce qu'il faut regarder, en clair.
 */
export async function mesurerMouvement(video, {seuil = SEUIL_FIGE, dureeMin = DUREE_FIGEE} = {}) {
  const calme = SEUIL_CALME;
  let mesures;
  try { mesures = await mesuresImages(video); } catch (e) { return {ok: false, pourquoi: e.message, attention: []}; }
  if (mesures.length < 2) return {ok: false, pourquoi: 'La vidéo est trop courte pour mesurer son mouvement.', attention: []};
  const pas = (mesures.at(-1).t - mesures[0].t) / (mesures.length - 1) || 1 / 30;
  const duree = mesures.at(-1).t + pas;
  const figes = passagesFiges(mesures, {seuil, dureeMin});
  const calmes = passagesCalmes(mesures, figes, {dureeMin});
  const vides = imagesVides(mesures);
  const immobiles = mesures.filter((e) => e.ecart < calme).length;
  const part = immobiles / mesures.length;
  // la fin tenue : les dernières images qui ne changent plus
  let tenues = 0;
  for (let i = mesures.length - 1; i >= 0 && mesures[i].ecart < seuil; i--) tenues++;
  const finTenue = arrondi(tenues * pas);
  const {valeurs, graphe} = parSeconde(mesures);
  const attention = [];
  // « image fixe » : rien ne change du tout (un détail seul qui bouge est dit « presque rien ne bouge », plus bas)
  const sansRien = mesures.filter((e) => e.ecart < seuil).length / mesures.length;
  if (sansRien > 0.98) attention.push('La vidéo ne bouge pas du tout : c’est une image fixe.');
  else {
    const ailleurs = figes.filter((f) => f.a < duree - pas * 2);
    if (ailleurs.length) attention.push(`L’image est figée ${ailleurs.length > 1 ? `à ${ailleurs.length} endroits` : 'à un endroit'} : ${ailleurs.slice(0, 8).map((f) => `de ${temps(f.de)} à ${temps(f.a)} (${f.duree.toFixed(1)} s)`).join(', ')}. Si ce n’est pas voulu, fais vivre quelque chose (un fond, une lumière, un lent travelling).`);
    const calmesAilleurs = calmes.filter((f) => f.a < duree - pas * 2 || f.duree > 2);
    if (calmesAilleurs.length) attention.push(`Presque rien ne bouge ${calmesAilleurs.length > 1 ? `à ${calmesAilleurs.length} endroits` : 'à un endroit'} : ${calmesAilleurs.slice(0, 8).map((f) => `de ${temps(f.de)} à ${temps(f.a)} (${f.duree.toFixed(1)} s)`).join(', ')}. Un détail seulement change (un trait fin, un point) : sur un téléphone, ça se lit comme une image fixe. Si ce n’est pas voulu, donne plus de corps au geste ou fais vivre le reste (la caméra, un fond).`);
    if (finTenue > FIN_TENUE_MAX) attention.push(`La fin est tenue ${finTenue.toFixed(1)} s sans que rien ne change : au-delà de ${String(FIN_TENUE_MAX).replace('.', ',')} s, c’est trop. Raccourcis-la, ou garde le texte stable sur un fond qui vit.`);
    if (part > 1 / 3 && duree > 4) attention.push(`${Math.round(part * 100)} % du film ne bouge pas : il se regarde comme un diaporama. Donne un mouvement à chaque plan (une entrée, une sortie, la caméra).`);
  }
  if (vides.length) attention.push(`Des images vides (un aplat uni, sans rien dedans) : ${vides.slice(0, 6).map((v) => `de ${temps(v.de)} à ${temps(v.a)} (${v.images} images)`).join(', ')}. Un trou de plus de ${SUITE_VIDE} images se voit : fais entrer la suite plus tôt, ou garde un décor.`);
  return {ok: true, duree_s: arrondi(duree), images: mesures.length + 1, figes, calmes, vides, fin_tenue_s: finTenue, part_figee: arrondi(part, 3), plus_long_s: figes.reduce((m, f) => Math.max(m, f.duree), 0),
    par_seconde: valeurs, graphe, attention};
}

/** Le bilan en quelques lignes de texte (pour les commandes données à l'IA). */
export function direMouvement(m) {
  if (!m?.ok) return [`Mouvement : pas mesuré (${m?.pourquoi ?? 'mesure impossible'}).`];
  const l = [`Mouvement, seconde par seconde (· = rien ne bouge) : ${m.graphe}`];
  l.push(m.figes.length ? `Passages figés (${m.figes.length}) : ${m.figes.slice(0, 10).map((f) => `${temps(f.de)} → ${temps(f.a)}`).join(', ')}.` : 'Aucun passage figé.');
  if (m.calmes?.length) l.push(`Presque immobile (${m.calmes.length}) : ${m.calmes.slice(0, 10).map((f) => `${temps(f.de)} → ${temps(f.a)}`).join(', ')}.`);
  l.push(`Images vides : ${m.vides.length ? m.vides.slice(0, 6).map((v) => `${temps(v.de)} → ${temps(v.a)}`).join(', ') : 'aucune'}. Fin tenue : ${m.fin_tenue_s.toFixed(1)} s.`);
  for (const a of m.attention) l.push(`À regarder : ${a}`);
  return l;
}
