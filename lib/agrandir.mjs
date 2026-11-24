// Dérush — l'agrandisseur (la commande derush-agrandir) : une image ou une vidéo trop petite, agrandie en inventant les
// détails, par Real-ESRGAN (lib/moteurs-pixels.mjs, installé d'un clic dans Connexions). Deux modèles :
//   - « dessin » (realesr-animevideov3, ×2, ×3 ou ×4) : dessins, animation, motion design, captures d'écran, textes ;
//     rapide (essayé le 24 nov. 2026 sur un Mac M4 : 1,3 s par image de 1080 × 1920 agrandie en 2160 × 3840). Sur une
//     image filmée, il donne un air de dessin animé.
//   - « photo » (realesrgan-x4plus, ×4 seulement) : photos nettes. Lent : 11 s par image de 540 × 960, 45 s par image de
//     1080 × 1920 ; pour une vidéo, Dérush mesure d'abord le temps (sur un morceau d'image) et le dit.
// Mesuré le 24 nov. 2026 (une image réduite au quart, agrandie, comparée à la vraie, SSIM) : sur un dessin du film de
// Tottori, simple 0,876, dessin 0,911, photo 0,916 ; sur une vidéo filmée sombre, à contre-jour, simple 0,985, dessin
// 0,927, photo 0,862 (« photo » y invente des boucles de cheveux et durcit les contours). L'aide le dit à l'IA.
// Une vidéo passe par lots (lib/images-video.mjs) ; son son est gardé tel quel. Rien n'est inventé au-delà de ×4.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {etatMoteurPixels, lancerMoteurPixels, direErreursMoteur, taillePng} from './moteurs-pixels.mjs';
import {infosVideo, filtresEntree, parLots, encodeurImages, arreterProgrammes} from './images-video.mjs';
import {FFMPEG, FFPROBE, lancer} from './outils.mjs';
import {placeLibre} from './disque.mjs';
import {MAC} from './plateforme.mjs';

export const MODELES = {
  dessin: {nom: 'realesr-animevideov3', echelles: [2, 3, 4], aide: 'dessins, animation, motion design, captures d’écran, textes, logos : rapide, traits nets'},
  photo: {nom: 'realesrgan-x4plus', echelles: [4], aide: 'photos nettes : lent ; sur une image filmée sombre ou floue, il invente des détails, et un agrandissement simple y reste plus fidèle'},
};
export const FOIS_MAX = 4;
export const LONG = 20 * 60; // au-delà, une vidéo n'est agrandie que si on le demande (--long)
export const LONG_MAX = 4 * 3600;
const IMAGES = /\.(png|jpe?g|webp|bmp|tiff?|gif|heic|heif|avif)$/i;
const LUES = /\.(png|jpe?g|webp)$/i; // ce que Real-ESRGAN lit lui-même
const pair = (x) => Math.max(2, Math.round(x / 2) * 2);
const duree = (s) => (s < 90 ? `${Math.max(1, Math.round(s))} s` : s < 5400 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')}`);
export const direDuree = duree;

/** L'échelle du moteur pour un agrandissement de `f` : la plus petite qui suffit. */
export const echelleMoteur = (modele, f) => MODELES[modele].echelles.find((s) => s >= f - 1e-6) ?? MODELES[modele].echelles.at(-1);

/** La taille d'arrivée : `cote` (le petit côté voulu) ou `fois`. Renvoie {f, largeur, hauteur}. */
export function tailleVoulue({largeur, hauteur}, {cote = null, fois = null, video = false}) {
  if (cote == null && fois == null) throw new Error('dis la taille voulue : --cote 2160 (le petit côté, en pixels) ou --fois 2.');
  if (cote != null && fois != null) throw new Error('--cote ou --fois, pas les deux.');
  const f = fois != null ? Number(String(fois).replace(',', '.')) : Number(cote) / Math.min(largeur, hauteur);
  if (!Number.isFinite(f) || f <= 0) throw new Error('--cote et --fois attendent un nombre.');
  if (f < 1.05) throw new Error(`elle fait déjà ${largeur} × ${hauteur} : rien à agrandir.`);
  if (f > FOIS_MAX + 1e-6) throw new Error(`×${f.toFixed(1)}, c'est trop : au-delà de ×${FOIS_MAX}, les détails seraient tous inventés. Pars d'une image plus grande.`);
  const [l, h] = video ? [pair(largeur * f), pair(hauteur * f)] : [Math.round(largeur * f), Math.round(hauteur * f)];
  if (video && (Math.max(l, h) > 3840 || Math.min(l, h) > 2160)) throw new Error(`${l} × ${h} : une vidéo s'agrandit jusqu'à la 4K (2160 × 3840) au plus.`);
  if (!video && Math.max(l, h) > 8192) throw new Error(`${l} × ${h} : une image s'agrandit jusqu'à 8192 pixels de côté au plus.`);
  return {f, largeur: l, hauteur: h};
}

/** Une image prête pour le moteur (PNG, JPEG ou WebP) : la même, ou convertie dans `tmp`. */
async function imageLisible(entree, tmp) {
  if (LUES.test(entree)) return entree;
  const png = path.join(tmp, 'depart.png');
  try {
    await lancer(FFMPEG, ['-v', 'error', '-nostdin', '-y', '-i', entree, '-frames:v', '1', png]);
  } catch {
    if (!MAC) throw new Error(`${path.basename(entree)} : image illisible (convertis-la en PNG).`);
    await lancer('sips', ['-s', 'format', 'png', entree, '--out', png]).catch(() => { throw new Error(`${path.basename(entree)} : image illisible (convertis-la en PNG).`); });
  }
  return png;
}
async function infosImage(fichier) {
  const t = taillePng(fichier);
  const {out} = await lancer(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,pix_fmt', '-of', 'json', fichier]);
  const s = JSON.parse(out.toString()).streams?.[0] ?? {};
  const largeur = t?.largeur ?? s.width;
  const hauteur = t?.hauteur ?? s.height;
  if (!largeur || !hauteur) throw new Error(`${path.basename(fichier)} : taille illisible.`);
  return {largeur, hauteur, alpha: /^(rgba|bgra|argb|abgr|ya|yuva|gbrap|pal8)/.test(String(s.pix_fmt ?? ''))};
}

/** Passe une image (fichier) dans le moteur ; renvoie le temps pris (s). */
async function passer(modele, s, entree, sortie) {
  const t = Date.now();
  const r = await lancerMoteurPixels('realesrgan', ['-i', entree, '-o', sortie, '-n', MODELES[modele].nom, '-s', String(s), '-m', 'models', '-f', 'png']);
  if (!fs.existsSync(sortie)) throw new Error(`Real-ESRGAN n’a rien écrit${direErreursMoteur(r.erreurs) ? ` (${direErreursMoteur(r.erreurs)})` : ''}.`);
  return (Date.now() - t) / 1000;
}

/**
 * Le temps que prendra un agrandissement : le moteur passe deux carrés de l'image (un tout petit, pour ce qu'il met à
 * démarrer, et un plus grand), et le temps par pixel donne celui d'une image entière. `image` : un PNG de départ.
 */
export async function mesurerTemps({image, largeur, hauteur, modele, s, images = 1, lot = 1, tmp}) {
  const cote = Math.min(largeur, hauteur);
  const [petit, grand] = [Math.min(64, cote), Math.min(512, cote)];
  const carre = async (c, nom) => {
    const f = path.join(tmp, `${nom}.png`);
    await lancer(FFMPEG, ['-v', 'error', '-nostdin', '-y', '-i', image, '-vf', `crop=${c}:${c}`, '-frames:v', '1', f]);
    return f;
  };
  const tp = await passer(modele, s, await carre(petit, 'petit'), path.join(tmp, 'petit-x.png'));
  const tg = grand > petit ? await passer(modele, s, await carre(grand, 'grand'), path.join(tmp, 'grand-x.png')) : tp;
  const pente = grand > petit ? Math.max(0, (tg - tp) / (grand ** 2 - petit ** 2)) : tp / (petit ** 2);
  const depart = Math.max(0, tp - pente * petit ** 2);
  const parImage = pente * largeur * hauteur;
  return {par_image_s: Math.round(parImage * 100) / 100, demarrage_s: Math.round(depart * 10) / 10, total_s: Math.round(parImage * images + depart * Math.ceil(images / lot))};
}

// DERUSH_ESSAI_LOT : des lots plus petits, pour les essais
const tailleLot = (l, h) => Number(process.env.DERUSH_ESSAI_LOT) || Math.max(4, Math.min(120, Math.floor(800e6 / (l * h * 0.7))));

/**
 * Agrandit une image ou une vidéo. Options : {cote | fois, modele, de, a, long, estimer}. `prog({fait, total})` suit
 * une vidéo. Renvoie le compte rendu ; avec `estimer`, seulement les temps prévus (rien n'est agrandi).
 */
export async function agrandir(entree, sortie, {cote = null, fois = null, modele = null, de = 0, a = null, long = false, estimer = false} = {}, prog = () => {}) {
  if (!fs.existsSync(entree)) throw new Error(`introuvable : ${entree}.`);
  if (modele != null && !MODELES[modele]) throw new Error('--modele : dessin (dessins, animation, captures) ou photo (photos et vidéos filmées).');
  const e = etatMoteurPixels('realesrgan');
  if (!e.ok) throw new Error(`l’agrandisseur (Real-ESRGAN) n’est pas prêt : ${e.pourquoi}${e.installable ? ` La personne l’installe dans Connexions › Agrandisseur (${e.a_telecharger}).` : ''} Sans lui, un agrandissement simple (FFmpeg, scale=…:flags=lanczos) n’ajoute aucun détail.`);
  const image = IMAGES.test(entree);
  const t0 = Date.now();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-agrandir-'));
  const parts = []; // les sorties à moitié écrites, effacées si la commande est interrompue
  const nettoyer = () => { fs.rmSync(tmp, {recursive: true, force: true}); for (const f of parts) fs.rmSync(f, {force: true}); };
  process.once('exit', nettoyer);
  try {
    if (image) {
      const depart = await imageLisible(entree, tmp);
      const info = await infosImage(depart);
      const voulue = tailleVoulue(info, {cote, fois});
      const m = modele ?? 'photo';
      const s = echelleMoteur(m, voulue.f);
      if (estimer) {
        const est = {};
        for (const k of modele ? [modele] : Object.keys(MODELES)) est[k] = await mesurerTemps({image: depart, ...info, modele: k, s: echelleMoteur(k, voulue.f), tmp});
        return {estimation: est, depart: {largeur: info.largeur, hauteur: info.hauteur}, largeur: voulue.largeur, hauteur: voulue.hauteur, images: 1};
      }
      if (!sortie) throw new Error('il manque la sortie (-o image-grande.png).');
      const ext = path.extname(sortie).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) throw new Error('la sortie d’une image est un .png, un .jpg ou un .webp.');
      if (info.alpha && /\.jpe?g$/.test(ext)) throw new Error('cette image a de la transparence : sors-la en .png ou en .webp.');
      fs.mkdirSync(path.dirname(path.resolve(sortie)), {recursive: true});
      const brut = path.join(tmp, 'agrandie.png');
      await passer(m, s, depart, brut);
      const t = taillePng(brut);
      const part = path.join(path.dirname(path.resolve(sortie)), `.${path.basename(sortie)}.part-${process.pid}${ext}`);
      parts.push(part);
      if (t?.largeur === voulue.largeur && t?.hauteur === voulue.hauteur && ext === '.png') fs.copyFileSync(brut, part);
      else await lancer(FFMPEG, ['-v', 'error', '-nostdin', '-y', '-i', brut, '-vf', `scale=${voulue.largeur}:${voulue.hauteur}:flags=lanczos`, ...(/\.jpe?g$/.test(ext) ? ['-pix_fmt', 'yuvj444p', '-q:v', '2'] : ext === '.webp' ? ['-quality', '92'] : []), '-frames:v', '1', part]);
      fs.renameSync(part, sortie);
      return {sortie: path.resolve(sortie), type: 'image', modele: m, echelle_moteur: s, depart: {largeur: info.largeur, hauteur: info.hauteur}, largeur: voulue.largeur, hauteur: voulue.hauteur, secondes: Math.round((Date.now() - t0) / 100) / 10, attention: []};
    }

    // une vidéo
    const info = await infosVideo(entree);
    const [d, fin] = [Number(de ?? 0), a == null ? null : Number(a)];
    if (!(d >= 0) || (fin != null && !(fin > d))) throw new Error('--de et --a : des secondes, avec --a plus grand que --de.');
    if (info.duree != null && d >= info.duree) throw new Error(`--de ${d} : la vidéo ne dure que ${info.duree.toFixed(2)} s.`);
    const bout = Math.min(fin ?? Infinity, info.duree ?? Infinity);
    const dureePassage = Number.isFinite(bout) ? bout - d : null;
    const voulue = tailleVoulue(info, {cote, fois, video: true});
    const nImages = Math.max(1, Math.round((dureePassage ?? 10) * info.fps.valeur));
    const {filtres: entreeF, attention} = await filtresEntree(info);
    // une image du milieu du passage, pour mesurer le temps
    const milieu = path.join(tmp, 'milieu.png');
    await lancer(FFMPEG, ['-v', 'error', '-nostdin', '-y', '-ss', String(d + (dureePassage ?? 0) / 2), '-i', entree, '-frames:v', '1', '-vf', [...entreeF, 'format=rgb24'].join(','), milieu]);
    const choix = modele ? [modele] : Object.keys(MODELES);
    const est = {};
    for (const k of choix) {
      const s = echelleMoteur(k, voulue.f);
      est[k] = await mesurerTemps({image: milieu, largeur: info.largeur, hauteur: info.hauteur, modele: k, s, images: nImages, lot: tailleLot(info.largeur * s, info.hauteur * s), tmp});
    }
    const resume = {estimation: est, depart: {largeur: info.largeur, hauteur: info.hauteur}, largeur: voulue.largeur, hauteur: voulue.hauteur, images: nImages, duree_s: dureePassage};
    if (estimer) return resume;
    if (!modele) throw Object.assign(new Error(`choisis le modèle d’une vidéo : --modele dessin (${MODELES.dessin.aide} ; ici environ ${duree(est.dessin.total_s)}) ou --modele photo (${MODELES.photo.aide} ; ici environ ${duree(est.photo.total_s)}).`), {resume});
    const prevu = est[modele].total_s;
    if (prevu > (long ? LONG_MAX : LONG)) {
      throw Object.assign(new Error(long
        ? `environ ${duree(prevu)} : au-delà de ${duree(LONG_MAX)}, Dérush refuse. Prends un passage plus court (--de, --a)${modele === 'photo' ? ' ou --modele dessin' : ''}.`
        : `environ ${duree(prevu)} de travail (${est[modele].par_image_s} s par image, ${nImages} images) : trop long pour le faire sans le dire. Prends seulement le passage monté (--de, --a)${modele === 'photo' ? `, ou --modele dessin (environ ${duree((await mesurerTemps({image: milieu, largeur: info.largeur, hauteur: info.hauteur, modele: 'dessin', s: echelleMoteur('dessin', voulue.f), images: nImages, tmp})).total_s)})` : ''}, ou ajoute --long si la personne est d’accord pour attendre.`), {resume});
    }
    if (!sortie) throw new Error('il manque la sortie (-o video-4k.mp4).');
    if (path.extname(sortie).toLowerCase() !== '.mp4') throw new Error('la sortie d’une vidéo est un .mp4.');
    if (path.resolve(entree) === path.resolve(sortie)) throw new Error('la sortie doit être un autre fichier que la vidéo de départ.');
    const libre = placeLibre(tmp);
    if (libre != null && libre < 2e9) throw new Error(`il ne reste que ${(libre / 1e9).toFixed(1)} Go sur le disque : il en faut au moins 2 pour les images de travail.`);
    fs.mkdirSync(path.dirname(path.resolve(sortie)), {recursive: true});
    const s = echelleMoteur(modele, voulue.f);
    const tmpSortie = `${sortie}.part-${process.pid}.mp4`;
    parts.push(tmpSortie);
    const encodeur = encodeurImages(tmpSortie, {fps: info.fps.texte, son: info.son ? {fichier: entree, de: d, duree: dureePassage} : null, largeur: voulue.largeur, hauteur: voulue.hauteur});
    const so = path.join(tmp, 's');
    let faites = 0;
    let total;
    try {
      total = await parLots(entree, {de: d, duree: dureePassage, fps: info.fps.texte, filtres: entreeF}, {dossier: tmp, taille: tailleLot(info.largeur * s, info.hauteur * s)}, async ({dossier, images: c}) => {
        fs.rmSync(so, {recursive: true, force: true});
        fs.mkdirSync(so);
        const r = await lancerMoteurPixels('realesrgan', ['-i', dossier, '-o', so, '-n', MODELES[modele].nom, '-s', String(s), '-m', 'models', '-f', 'png']);
        const sorties = fs.readdirSync(so).filter((f) => f.endsWith('.png')).sort();
        if (sorties.length !== c) throw new Error(`Real-ESRGAN n’a pas fini son lot (${sorties.length} images sur ${c}${direErreursMoteur(r.erreurs) ? ` : ${direErreursMoteur(r.erreurs)}` : ''}).`);
        for (const f of sorties) await encodeur.ecrire(fs.readFileSync(path.join(so, f)));
        faites += c;
        prog({fait: faites, total: Math.max(faites, nImages)});
      });
      await encodeur.finir();
      fs.renameSync(tmpSortie, sortie);
    } catch (err) {
      encodeur.arreter();
      arreterProgrammes();
      fs.rmSync(tmpSortie, {force: true});
      throw err;
    }
    const fait = await infosVideo(sortie);
    return {sortie: path.resolve(sortie), type: 'video', modele, echelle_moteur: s, depart: resume.depart, largeur: fait.largeur, hauteur: fait.hauteur, images: total,
      duree_s: fait.duree != null ? Math.round(fait.duree * 1000) / 1000 : null, son: fait.son, prevu_s: prevu, secondes: Math.round((Date.now() - t0) / 100) / 10, attention};
  } finally {
    nettoyer();
    process.removeListener('exit', nettoyer);
  }
}
