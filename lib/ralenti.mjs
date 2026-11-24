// Dérush — le ralenti (la commande derush-ralenti) : un passage N fois plus lent, sans saccades.
// Ralentir une vidéo à 30 images/s par 4, c'est montrer 120 images là où il y en a 30 : il faut inventer les autres.
//   - Assez d'images déjà (un rush filmé à 120 ou 240 images/s) : rien à inventer, les vraies images sont étalées.
//   - Sinon RIFE (lib/moteurs-pixels.mjs, installé d'un clic dans Connexions) invente les images d'entre-deux en suivant
//     le mouvement. Essayé le 24 nov. 2026 : sur une vraie vidéo (15 → 30 images/s), plus juste que FFmpeg
//     (SSIM 0,984 contre 0,980, et 0,986 contre 0,979 autour de la personne), et deux fois plus rapide.
//   - Sans RIFE (pas installé, ou pas sur Mac), FFmpeg (minterpolate, compensation de mouvement) fait le même travail,
//     un peu moins finement et plus lentement. Jamais le simple mélange de deux images : il laisse des fantômes.
// Les images vont par lots dans un dossier temporaire (lib/images-video.mjs) ; chaque lot reprend la dernière image du
// précédent, pour inventer aussi ce qui se passe entre les deux. Le son n'est pas gardé quand la vidéo est ralentie.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {etatMoteurPixels, lancerMoteurPixels, direErreursMoteur} from './moteurs-pixels.mjs';
import {infosVideo, lireCadence, filtresEntree, filtresSortie, ENCODAGE, parLots, encodeurImages, nomImage, arreterProgrammes} from './images-video.mjs';
import {FFMPEG, lancer} from './outils.mjs';
import {placeLibre} from './disque.mjs';

export const FOIS_MAX = 8;
const TOLERANCE = 0.004; // un écart de durée de 0,4 % au plus quand la cadence demandée tombe entre deux

/**
 * Le plan : combien d'images de sortie pour une image de la source (k), en fraction p/q (pour que chaque image
 * inventée tombe au bon instant d'un lot à l'autre). k ≤ 1 : les vraies images suffisent.
 */
export function planRalenti({fps, cadence, fois}) {
  const k = (fois * cadence.valeur) / fps.valeur;
  if (k <= 1 + TOLERANCE) return {k, p: 1, q: 1, inventer: false};
  let meilleur = null;
  for (let q = 1; q <= 12; q++) {
    const p = Math.round(k * q);
    const ecart = Math.abs(p / q - k) / k;
    if (ecart <= TOLERANCE) { meilleur = {p, q}; break; }
    if (!meilleur || ecart < meilleur.ecart) meilleur = {p, q, ecart};
  }
  if (meilleur.ecart > TOLERANCE) throw new Error(`cette cadence (${cadence.texte} images/s depuis ${fps.texte}) ne tombe pas juste : donne une cadence ronde (--cadence 30).`);
  const g = (a, b) => (b ? g(b, a % b) : a);
  const d = g(meilleur.p, meilleur.q);
  return {k, p: meilleur.p / d, q: meilleur.q / d, inventer: true};
}

/** La taille des lots : un multiple de q, assez petit pour tenir dans environ 600 Mo d'images. */
export function tailleLot({largeur, hauteur, p, q}) {
  const parImage = largeur * hauteur * 0.7; // une image PNG de vraie vidéo pèse environ 0,7 octet par pixel
  const sorties = Math.max(16, Math.floor(600e6 / parImage));
  const entrees = Math.max(q, Math.min(240, Math.floor((sorties * q) / p)));
  return Math.max(q, Math.floor(entrees / q) * q);
}

/** Les options lues et vérifiées ; renvoie {fois, cadence (ou null), de, a, moteur}. */
export function optionsRalenti({fois = 2, cadence = null, de = 0, a = null, moteur = 'auto'} = {}) {
  const f = Number(String(fois).replace(',', '.'));
  if (!(f >= 1 && f <= FOIS_MAX)) throw new Error(`--fois attend un nombre de 1 à ${FOIS_MAX} (2 : deux fois plus lent).`);
  const c = cadence == null ? null : lireCadence(cadence);
  if (cadence != null && !c) throw new Error('--cadence attend des images par seconde : 24, 25, 30, 50, 60 (ou 29.97).');
  const [d, fin] = [Number(de ?? 0), a == null ? null : Number(a)];
  if (!(d >= 0) || (fin != null && !(fin > d))) throw new Error('--de et --a : des secondes, avec --a plus grand que --de.');
  if (!['auto', 'rife', 'ffmpeg'].includes(moteur)) throw new Error('--moteur : auto, rife ou ffmpeg.');
  return {fois: f, cadence: c, de: d, a: fin, moteur};
}

/**
 * Ralentit un passage. `prog({fait, total})` suit le travail (en images de sortie). Renvoie le compte rendu :
 * {sortie, moteur, fois, cadence, images_source, images, duree_source_s, duree_s, largeur, hauteur, son, secondes, attention}.
 */
export async function ralentir(entree, sortie, options = {}, prog = () => {}) {
  const o = optionsRalenti(options);
  if (!fs.existsSync(entree)) throw new Error(`introuvable : ${entree}.`);
  if (path.extname(sortie).toLowerCase() !== '.mp4') throw new Error('la sortie est une vidéo .mp4.');
  if (path.resolve(entree) === path.resolve(sortie)) throw new Error('la sortie doit être un autre fichier que la vidéo de départ.');
  fs.mkdirSync(path.dirname(path.resolve(sortie)), {recursive: true});
  const t0 = Date.now();
  const info = await infosVideo(entree);
  if (info.duree != null && o.de >= info.duree) throw new Error(`--de ${o.de} : la vidéo ne dure que ${info.duree.toFixed(2)} s.`);
  const fin = Math.min(o.a ?? Infinity, info.duree ?? Infinity);
  const duree = Number.isFinite(fin) ? fin - o.de : null;
  // la cadence de sortie : celle demandée (celle du montage), sinon celle de la source, 60 au plus
  const cadence = o.cadence ?? (info.fps.valeur > 60.5 ? lireCadence(60) : info.fps);
  const plan = planRalenti({fps: info.fps, cadence, fois: o.fois});
  const {filtres: entreeF, attention} = await filtresEntree(info);
  const sonGarde = o.fois === 1 && info.son; // seulement quand la vidéo garde sa durée (plus d'images par seconde)
  const tmpSortie = `${sortie}.part-${process.pid}.mp4`;
  const rife = etatMoteurPixels('rife');
  let moteur = !plan.inventer ? 'images' : o.moteur === 'ffmpeg' ? 'ffmpeg' : rife.ok ? 'rife' : 'ffmpeg';
  if (plan.inventer && o.moteur === 'rife' && !rife.ok) throw new Error(`le ralenti fluide (RIFE) n’est pas prêt : ${rife.pourquoi} La personne l’installe dans Connexions › Ralenti fluide (${rife.a_telecharger ?? '18 Mo'}). Sans lui : --moteur ffmpeg.`);
  if (plan.inventer && moteur === 'ffmpeg' && o.moteur === 'auto') attention.push(rife.installable ? 'RIFE n’est pas installé : ralenti fait par FFmpeg, un peu moins fin. La personne peut installer le ralenti fluide dans Connexions.' : `RIFE n’est pas disponible ici (${rife.pourquoi}) : ralenti fait par FFmpeg.`);
  const totalEstime = duree ? Math.round(duree * info.fps.valeur * plan.k) : null;
  let images = 0;
  let imagesSource = null;
  // une commande interrompue (process.exit) ne laisse pas de vidéo à moitié écrite
  const effacerPart = () => fs.rmSync(tmpSortie, {force: true});
  process.once('exit', effacerPart);
  try {
    if (moteur === 'images' || moteur === 'ffmpeg') {
      // un seul passage de FFmpeg : étaler les vraies images, ou les inventer par compensation de mouvement
      // deux copies de la dernière image : FFmpeg a de quoi aller jusqu'au bout (sans elles, il s'arrête trois images
      // avant), et la dernière image est tenue le temps de son image, comme avec RIFE ; puis le compte d'images est coupé juste
      const tenue = (2 / info.fps.valeur).toFixed(6);
      const vf = [...entreeF, `tpad=stop_mode=clone:stop_duration=${tenue}`, `setpts=${o.fois}*PTS`,
        moteur === 'images' ? `fps=${cadence.texte}` : `minterpolate=fps=${cadence.texte}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`,
        ...filtresSortie()].join(',');
      const dureeSortie = duree ? duree * o.fois : null;
      await lancer(FFMPEG, ['-v', 'error', '-nostdin', '-y', '-progress', 'pipe:1', ...(o.de > 0 ? ['-ss', String(o.de)] : []), ...(duree ? ['-t', String(duree)] : []), '-i', entree,
        '-map', '0:v:0', ...(sonGarde ? ['-map', '0:a:0?', '-c:a', 'aac', '-b:a', '192k'] : ['-an']), '-vf', vf, ...ENCODAGE, '-r', cadence.texte,
        ...(totalEstime ? ['-frames:v', String(totalEstime)] : []), tmpSortie], {
        surStdout: (d) => { const m = /out_time_us=(\d+)/.exec(String(d)); if (m && dureeSortie) prog({fait: Math.round((Number(m[1]) / 1e6) * cadence.valeur), total: Math.round(dureeSortie * cadence.valeur)}); },
      });
    } else {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-ralenti-'));
      const nettoyer = () => fs.rmSync(tmp, {recursive: true, force: true});
      process.once('exit', nettoyer);
      try {
        const libre = placeLibre(tmp);
        if (libre != null && libre < 2e9) throw new Error(`il ne reste que ${(libre / 1e9).toFixed(1)} Go sur le disque : il en faut au moins 2 pour les images de travail.`);
        const {p, q} = plan;
        // DERUSH_ESSAI_LOT : des lots plus petits, pour les essais (un multiple de q)
        const m = Number(process.env.DERUSH_ESSAI_LOT) > 0 ? Math.max(q, Math.floor(Number(process.env.DERUSH_ESSAI_LOT) / q) * q) : tailleLot({largeur: info.largeur, hauteur: info.hauteur, p, q});
        const encodeur = encodeurImages(tmpSortie, {fps: cadence.texte, son: sonGarde ? {fichier: entree, de: o.de, duree} : null});
        const s = path.join(tmp, 's');
        try {
          imagesSource = await parLots(entree, {de: o.de, duree, fps: info.fps.texte, filtres: entreeF}, {dossier: tmp, taille: m + 1, recouvrement: 1}, async ({dossier, images: c, premier, dernier}) => {
            // le lot : c vraies images (de premier à premier + c − 1), complété par des copies de la dernière jusqu'à un
            // multiple de q, pour que chaque image inventée tombe à son instant exact
            const cPlein = Math.ceil(c / q) * q;
            for (let i = c + 1; i <= cPlein; i++) fs.copyFileSync(path.join(dossier, nomImage(c)), path.join(dossier, nomImage(i)));
            const n = (cPlein * p) / q;
            // à garder : jusqu'à l'image de départ du lot suivant ; au dernier lot, de quoi faire la durée juste
            const garder = dernier ? Math.round(((premier + c) * p) / q) - images : ((c - 1) * p) / q;
            fs.rmSync(s, {recursive: true, force: true});
            fs.mkdirSync(s);
            if (c === 1) {
              // une seule image (la dernière du passage) : elle est tenue, rien à inventer
              const im = fs.readFileSync(path.join(dossier, nomImage(1)));
              for (let i = 0; i < garder; i++) await encodeur.ecrire(im);
            } else {
              const r = await lancerMoteurPixels('rife', ['-i', dossier, '-o', s, '-m', 'rife-v4.6', '-n', String(n)]);
              const sorties = fs.readdirSync(s).filter((f) => f.endsWith('.png')).sort();
              if (sorties.length !== n) throw new Error(`RIFE n’a pas fini son lot (${sorties.length} images sur ${n}${direErreursMoteur(r.erreurs) ? ` : ${direErreursMoteur(r.erreurs)}` : ''}).`);
              for (let i = 0; i < Math.min(garder, n); i++) await encodeur.ecrire(fs.readFileSync(path.join(s, sorties[i])));
            }
            for (let i = c + 1; i <= cPlein; i++) fs.rmSync(path.join(dossier, nomImage(i)), {force: true});
            images += garder;
            prog({fait: images, total: Math.max(images, totalEstime ?? images)});
          });
          await encodeur.finir();
        } catch (e) { encodeur.arreter(); throw e; }
      } finally {
        nettoyer();
        process.removeListener('exit', nettoyer);
      }
    }
    fs.renameSync(tmpSortie, sortie);
  } catch (e) {
    arreterProgrammes();
    fs.rmSync(tmpSortie, {force: true});
    throw e;
  } finally { process.removeListener('exit', effacerPart); }
  const fait = await infosVideo(sortie);
  return {
    sortie: path.resolve(sortie), moteur, fois: o.fois, cadence: cadence.texte, images_source: imagesSource, images: fait.images ?? images ?? null,
    duree_source_s: duree != null ? Math.round(duree * 1000) / 1000 : null, duree_s: fait.duree != null ? Math.round(fait.duree * 1000) / 1000 : null,
    largeur: fait.largeur, hauteur: fait.hauteur, son: fait.son, secondes: Math.round((Date.now() - t0) / 100) / 10, attention,
  };
}
