// Dérush — une vidéo, image par image : ce qu'il faut aux moteurs qui travaillent sur des images (lib/ralenti.mjs,
// lib/agrandir.mjs). FFmpeg sort les images d'un passage une à une (PNG, à cadence fixe, couleurs justes), Dérush les
// range par lots dans un dossier temporaire, le moteur les traite, et un second FFmpeg refait la vidéo avec ce qui sort.
// Un lot à la fois : le disque ne voit jamais toute la vidéo en images (une minute en 4K, ce serait des dizaines de Go).
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {FFMPEG, FFPROBE, lancer} from './outils.mjs';
import {filtres} from './medias.mjs';

/** Les cadences qu'on rencontre, exactes (les cadences NTSC sont des fractions). */
export const CADENCES = [[24000, 1001], [24, 1], [25, 1], [30000, 1001], [30, 1], [48, 1], [50, 1], [60000, 1001], [60, 1], [100, 1], [120000, 1001], [120, 1], [240, 1]];
const pgcd = (a, b) => (b ? pgcd(b, a % b) : Math.abs(a));
const fraction = (num, den) => { const g = pgcd(num, den) || 1; return {num: num / g, den: den / g, valeur: num / den, texte: den / g === 1 ? String(num / g) : `${num / g}/${den / g}`}; };

/** Une cadence donnée en texte (« 30 », « 29.97 », « 30000/1001 ») : {num, den, valeur, texte}, ou null. */
export function lireCadence(v) {
  const t = String(v ?? '').trim().replace(',', '.');
  let x;
  const f = /^(\d+)\/(\d+)$/.exec(t);
  if (f) x = Number(f[1]) / Number(f[2]);
  else if (/^\d+(\.\d+)?$/.test(t)) x = Number(t);
  else return null;
  if (!(x >= 1 && x <= 240)) return null;
  const connue = CADENCES.find(([n, d]) => Math.abs(n / d - x) < 0.01);
  if (connue) return fraction(...connue);
  return f ? fraction(Number(f[1]), Number(f[2])) : fraction(Math.round(x * 1000), 1000);
}

/** La cadence nominale d'un flux : une cadence connue si elle est proche (les téléphones filment en cadence variable). */
export function cadenceDuFlux(r, moyenne) {
  const val = (s) => { const [a, b] = String(s ?? '').split('/').map(Number); return a > 0 && b > 0 ? a / b : null; };
  for (const s of [r, moyenne]) {
    const x = val(s);
    const connue = x && CADENCES.find(([n, d]) => Math.abs(n / d - x) < 0.02);
    if (connue) return fraction(...connue);
  }
  const x = val(moyenne) ?? val(r) ?? 30;
  const proche = CADENCES.find(([n, d]) => Math.abs(n / d - x) < 0.6);
  return proche ? fraction(...proche) : lireCadence(x.toFixed(3)) ?? fraction(30, 1);
}

/** Ce qu'il faut savoir d'une vidéo pour la traiter image par image. */
export async function infosVideo(fichier) {
  let j;
  try {
    const {out} = await lancer(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', fichier]);
    j = JSON.parse(out.toString());
  } catch { throw new Error(`${path.basename(fichier)} : FFmpeg ne sait pas le lire comme une vidéo.`); }
  const vs = (j.streams ?? []).find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic);
  if (!vs) throw new Error(`${path.basename(fichier)} n’a pas d’image.`);
  const sd = (vs.side_data_list ?? []).find((s) => s.rotation != null);
  const rotation = ((Math.round(sd ? Number(sd.rotation) : Number(vs.tags?.rotate ?? 0)) % 360) + 360) % 360;
  let [largeur, hauteur] = [vs.width, vs.height];
  if (rotation % 180 === 90) [largeur, hauteur] = [hauteur, largeur];
  const duree = Number(j.format?.duration ?? vs.duration);
  return {
    largeur, hauteur, rotation, duree: duree > 0 ? duree : null, fps: cadenceDuFlux(vs.r_frame_rate, vs.avg_frame_rate),
    images: Number(vs.nb_frames) || null, codec: vs.codec_name, pix_fmt: vs.pix_fmt ?? null,
    hdr: ['arib-std-b67', 'smpte2084'].includes(vs.color_transfer), matrice: vs.color_space ?? null, plage: vs.color_range ?? null,
    son: (j.streams ?? []).some((s) => s.codec_type === 'audio'),
  };
}

/**
 * Les filtres qui sortent des images RVB justes : HDR ramené au SDR, matrice de couleurs lue dans le fichier (une
 * vidéo HD sans étiquette est en BT.709, comme la lisent les lecteurs ; FFmpeg, lui, supposerait BT.601). Renvoie
 * {filtres, attention}.
 */
export async function filtresEntree(info) {
  const attention = [];
  const f = [];
  if (info.hdr) {
    if ((await filtres()).has('zscale')) f.push('zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv');
    else attention.push('Vidéo HDR : ce FFmpeg n’a pas zscale, les couleurs peuvent sortir délavées.');
    return {filtres: f, attention};
  }
  const m = String(info.matrice ?? '');
  const matrice = m === 'bt709' ? 'bt709' : ['smpte170m', 'bt470bg', 'bt601'].includes(m) ? 'bt601' : m === 'smpte240m' ? 'smpte240m' : (Math.min(info.largeur, info.hauteur) >= 720 ? 'bt709' : 'bt601');
  const plage = info.plage === 'pc' ? 'full' : 'tv';
  if (!/^(rgb|bgr|gbr|argb|abgr|rgba|bgra|gray|pal8)/.test(String(info.pix_fmt ?? ''))) f.push(`scale=in_color_matrix=${matrice}:in_range=${plage}:flags=accurate_rnd+full_chroma_int`);
  return {filtres: f, attention};
}

/** Les filtres de sortie : tailles paires, couleurs BT.709 en plage « tv », étiquetées (les mêmes dans tous les lecteurs). */
export const filtresSortie = ({largeur = null, hauteur = null} = {}) => [
  largeur && hauteur ? `scale=${largeur}:${hauteur}:flags=lanczos` : 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos',
  'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int', 'format=yuv420p',
  'setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709',
];
/** L'encodage H.264 des vidéos sorties (assez fin pour être remonté ensuite). */
export const ENCODAGE = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

/** Les programmes lancés ici : arrêtés si Dérush ou la commande s'arrête. */
const EN_COURS = new Set();
export function arreterProgrammes() { for (const p of EN_COURS) { try { p.kill('SIGKILL'); } catch { /* déjà fini */ } } EN_COURS.clear(); }
process.once('exit', arreterProgrammes);
function demarrer(args, stdio) {
  const p = spawn(FFMPEG, args, {stdio, windowsHide: true});
  EN_COURS.add(p);
  p.once('close', () => EN_COURS.delete(p));
  p.once('error', () => EN_COURS.delete(p));
  let err = '';
  p.stderr?.on('data', (d) => { err = `${err}${d}`.slice(-4000); });
  const fini = new Promise((ok, ko) => {
    p.once('error', (e) => ko(new Error(`FFmpeg n’a pas pu démarrer (${e.message}).`)));
    p.once('close', (code) => (code === 0 ? ok() : ko(new Error(`FFmpeg a échoué (code ${code}) : ${err.trim().split('\n').slice(-3).join(' | ') || 'sans message'}`))));
  });
  fini.catch(() => {}); // lue plus tard
  return {p, fini};
}

/**
 * Coupe un flux d'images PNG collées les unes aux autres (FFmpeg, -f image2pipe) en images. `surImage(buffer)` reçoit
 * chaque image entière. Lit les morceaux de chaque PNG sans tout recopier à chaque arrivée.
 */
export class LecteurPng {
  constructor(surImage) { this.surImage = surImage; this.morceaux = []; this.taille = 0; this.attendu = 8; }
  octets(pos, n) {
    const b = Buffer.alloc(n);
    let o = 0;
    let base = 0;
    for (const m of this.morceaux) {
      if (o >= n) break;
      const fin = base + m.length;
      if (pos + o < fin) { const de = pos + o - base; const k = Math.min(n - o, m.length - de); m.copy(b, o, de, de + k); o += k; }
      base = fin;
    }
    return b;
  }
  /** Ajoute ce qui vient d'arriver ; renvoie les images complètes. */
  ajouter(morceau) {
    this.morceaux.push(morceau);
    this.taille += morceau.length;
    const images = [];
    for (;;) {
      if (this.attendu === 8 && this.taille >= 8 && this.octets(0, 8).readUInt32BE(0) !== 0x89504e47) throw new Error('le flux d’images n’est pas du PNG.');
      if (this.taille < this.attendu + 8) break;
      const tete = this.octets(this.attendu, 8);
      const fin = this.attendu + 12 + tete.readUInt32BE(0);
      if (this.taille < fin) break;
      if (tete.toString('latin1', 4, 8) !== 'IEND') { this.attendu = fin; continue; }
      const tout = Buffer.concat(this.morceaux, this.taille);
      images.push(tout.subarray(0, fin));
      const reste = tout.subarray(fin);
      this.morceaux = reste.length ? [reste] : [];
      this.taille = reste.length;
      this.attendu = 8;
    }
    return images;
  }
}

/**
 * Décode un passage en images PNG (RVB, cadence fixe `fps`) et les passe une à une à `surImage(buffer, index)`, qui
 * peut être lente : FFmpeg attend (le flux n'est lu qu'à son rythme). Renvoie le nombre d'images.
 */
export async function decoderImages(fichier, {de = 0, duree = null, fps, filtres: avant = [], apres = []}, surImage) {
  const vf = [...avant, ...(fps ? [`fps=${fps}`] : []), ...apres, 'format=rgb24'].join(',');
  const args = ['-v', 'error', '-nostdin', ...(de > 0 ? ['-ss', String(de)] : []), ...(duree ? ['-t', String(duree)] : []), '-i', fichier,
    '-map', '0:v:0', '-an', '-sn', '-dn', '-vf', vf, '-f', 'image2pipe', '-c:v', 'png', '-compression_level', '1', 'pipe:1'];
  const {p, fini} = demarrer(args, ['ignore', 'pipe', 'pipe']);
  let n = 0;
  const lecteur = new LecteurPng();
  try {
    for await (const morceau of p.stdout) {
      for (const image of lecteur.ajouter(morceau)) await surImage(image, n++);
    }
    await fini;
  } catch (e) {
    try { p.kill('SIGKILL'); } catch { /* déjà fini */ }
    throw e;
  }
  return n;
}

/**
 * Un encodeur : des images PNG données une à une deviennent une vidéo MP4 H.264 à la cadence `fps`. `son` :
 * {fichier, de, duree} pour garder le son de ce passage. Renvoie {ecrire(buffer), finir(), arreter()}.
 */
export function encodeurImages(sortie, {fps, son = null, largeur = null, hauteur = null}) {
  const args = ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', 'pipe:0',
    ...(son ? [...(son.de > 0 ? ['-ss', String(son.de)] : []), ...(son.duree ? ['-t', String(son.duree)] : []), '-i', son.fichier] : []),
    '-map', '0:v:0', ...(son ? ['-map', '1:a:0?', '-c:a', 'aac', '-b:a', '192k'] : ['-an']),
    '-vf', filtresSortie({largeur, hauteur}).join(','), ...ENCODAGE, '-r', String(fps), sortie];
  const {p, fini} = demarrer(args, ['pipe', 'ignore', 'pipe']);
  let casse = null;
  p.stdin.on('error', (e) => { casse ??= e; });
  return {
    async ecrire(image) {
      if (casse) throw new Error(`l’encodeur s’est arrêté (${casse.message}).`);
      if (!p.stdin.write(image)) {
        await new Promise((ok) => { const fin = () => { p.stdin.off('drain', fin); p.off('close', fin); ok(); }; p.stdin.once('drain', fin); p.once('close', fin); });
      }
    },
    async finir() { p.stdin.end(); await fini; },
    arreter() { try { p.kill('SIGKILL'); } catch { /* déjà fini */ } },
  };
}

const nomImage = (i) => `${String(i).padStart(8, '0')}.png`;
/**
 * Fait passer les images d'un passage par lots : `taille` images par lot (le dossier `dossier/e`, numérotées depuis 1),
 * les `recouvrement` dernières d'un lot servant aussi de premières au suivant (le ralenti a besoin de l'image d'après).
 * `traiterLot({dossier, images, premier, dernier})` fait le travail du moteur ; `premier` : l'index (dans tout le
 * passage) de la première image du lot ; `dernier` : c'est le dernier lot. Renvoie le nombre d'images du passage.
 */
export async function parLots(fichier, decodage, {dossier, taille, recouvrement = 0}, traiterLot) {
  if (!(taille > recouvrement)) throw new Error('lot trop petit.');
  const e = path.join(dossier, 'e');
  fs.rmSync(e, {recursive: true, force: true});
  fs.mkdirSync(e, {recursive: true});
  let dansLot = 0; // les images du lot en cours (recouvrement compris)
  let premier = 0;
  let nouvelles = 0; // celles qui ne viennent pas du lot d'avant
  let lots = 0;
  const vider = async (dernier) => {
    await traiterLot({dossier: e, images: dansLot, premier, dernier});
    lots++;
    if (dernier) return;
    // les dernières images du lot deviennent les premières du suivant
    for (let i = 1; i <= dansLot - recouvrement; i++) fs.rmSync(path.join(e, nomImage(i)), {force: true});
    for (let i = 1; i <= recouvrement; i++) fs.renameSync(path.join(e, nomImage(dansLot - recouvrement + i)), path.join(e, nomImage(i)));
    premier += dansLot - recouvrement;
    dansLot = recouvrement;
    nouvelles = 0;
  };
  const total = await decoderImages(fichier, decodage, async (image) => {
    fs.writeFileSync(path.join(e, nomImage(++dansLot)), image);
    nouvelles++;
    if (dansLot === taille) await vider(false);
  });
  if (!total) throw new Error('ce passage ne contient aucune image.');
  // le dernier lot : ce qui reste (pour le ralenti, au moins la dernière image, qui n'a pas encore été tenue)
  if (nouvelles > 0 || lots === 0 || recouvrement > 0) await vider(true);
  return total;
}
export {nomImage};
