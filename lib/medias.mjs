// Dérush — ajout et préparation des rushes : sonde technique, proxy de lecture, courbe du son, vignettes, analyse.
import fs from 'node:fs';
import path from 'node:path';
import {FFMPEG, FFPROBE, lancer, ffmpeg} from './outils.mjs';
import {ecrireJson} from './outils.mjs';
import {nouvelId, arrondi, EXT_IMAGES, EXT_RAW} from './commun.mjs';
import {faireCadrage} from './cadrage.mjs';
import {lancerPython} from './moteurs.mjs';
import {cloner, MAC, NOM_SYSTEME} from './plateforme.mjs';
import {lutDe, cleLut, filtreLut, filtreCube} from './couleurs.mjs';

const STANDARDS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 100, 119.88, 120];
const ratio = (txt) => {
  const [a, b] = String(txt || '0/1').split('/').map(Number);
  return b ? a / b : a || 0;
};

/** Cadence nominale : on préfère une valeur standard (les téléphones filment en cadence variable). */
function cadence(vs) {
  for (const txt of [vs.r_frame_rate, vs.avg_frame_rate]) {
    const v = ratio(txt);
    if (v > 0 && v <= 240 && STANDARDS.some((s) => Math.abs(s - v) < 0.02)) return {fps: v, txt};
  }
  const v = ratio(vs.avg_frame_rate) || ratio(vs.r_frame_rate) || 30;
  const proche = STANDARDS.reduce((a, s) => (Math.abs(s - v) < Math.abs(a - v) ? s : a), 30);
  return {fps: Math.abs(proche - v) < 1 ? proche : arrondi(v, 3), txt: vs.avg_frame_rate};
}

function rotationDe(vs) {
  const sd = (vs.side_data_list || []).find((s) => s.rotation != null);
  const r = sd ? Number(sd.rotation) : Number(vs.tags?.rotate || 0);
  return ((Math.round(r) % 360) + 360) % 360;
}

let FILTRES = null;
/** Filtres présents dans la version de FFmpeg installée (certains, comme zscale, sont optionnels). */
export async function filtres() {
  if (!FILTRES) {
    const {out} = await lancer(FFMPEG, ['-hide_banner', '-filters']);
    FILTRES = new Set(out.toString().split('\n').map((l) => l.trim().split(/\s+/)[1]).filter(Boolean));
  }
  return FILTRES;
}

/** Conversion HDR (HLG / PQ des iPhone) vers SDR BT.709, sinon les couleurs sortent délavées. */
export async function filtreSdr(m) {
  if (!m.hdr) return null;
  if ((await filtres()).has('zscale')) return 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv';
  return null;
}

// Une image fixe peut durer ce qu'on veut dans le montage (jusqu'à une minute par plan).
export const DUREE_IMAGE = 60;

/** Infos de tournage lisibles dans les métadonnées (date, appareil), quand elles existent. */
function tournage(j, vs) {
  const t = {...(j.format?.tags ?? {}), ...(vs?.tags ?? {})};
  const cle = (re) => Object.entries(t).find(([k]) => re.test(k))?.[1];
  const date = cle(/^(com\.apple\.quicktime\.creationdate|creation_time|date)$/i);
  const appareil = [cle(/^(com\.apple\.quicktime\.make|make)$/i), cle(/^(com\.apple\.quicktime\.model|model)$/i)].filter(Boolean).join(' ').trim();
  const logiciel = cle(/^(com\.apple\.quicktime\.software|encoder|software)$/i);
  return {...(date ? {date: String(date)} : {}), ...(appareil ? {appareil} : {}), ...(logiciel ? {logiciel: String(logiciel).slice(0, 80)} : {})};
}

/** Une image fixe (photo, logo, capture…) : taille lue par macOS (sips), qui connaît aussi HEIC et TIFF. */
async function sonderImage(chemin) {
  let largeur = null;
  let hauteur = null;
  try {
    const {out} = await lancer('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', chemin]);
    largeur = Number(/pixelWidth:\s*(\d+)/.exec(out.toString())?.[1]) || null;
    hauteur = Number(/pixelHeight:\s*(\d+)/.exec(out.toString())?.[1]) || null;
  } catch { /* on essaiera FFprobe */ }
  if (!largeur) {
    const {out} = await lancer(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', chemin]);
    [largeur, hauteur] = out.toString().trim().split(',').map(Number);
  }
  if (!largeur || !hauteur) throw new Error('Image illisible.');
  return {type: 'image', duree: DUREE_IMAGE, fps: null, fps_txt: null, largeur, hauteur, rotation: 0, hdr: false, codec: path.extname(chemin).slice(1).toLowerCase(),
    audio: null, taille: fs.statSync(chemin).size, conteneur: 'image'};
}

/** La durée d'un fichier qui ne la porte pas : FFmpeg le parcourt en entier sans rien décoder, et dit où il s'arrête. */
async function dureeParcourue(chemin) {
  let fin = 0;
  try {
    await lancer(FFMPEG, ['-v', 'error', '-nostats', '-progress', 'pipe:1', '-i', chemin, '-map', '0:v?', '-map', '0:a?', '-c', 'copy', '-f', 'null', '-'], {
      surStdout: parLignes((l) => { const x = /^out_time_us=(\d+)/.exec(l); if (x) fin = Math.max(fin, Number(x[1])); }),
    });
  } catch { /* illisible jusqu'au bout : on garde ce qui a été parcouru */ }
  return fin / 1e6;
}

/** Fiche technique d'un fichier (FFprobe). */
export async function sonder(chemin) {
  if (EXT_RAW.test(chemin)) throw new Error('Format RAW de caméra (RED, Blackmagic, ARRI…) : FFmpeg ne sait pas le lire. Exporte d’abord une version ProRes ou H.264 depuis le logiciel de la caméra ou DaVinci Resolve.');
  // le système peut refuser la lecture sur place (sur Mac : Bureau, Documents… protégés) : on le dit clairement
  try {
    fs.closeSync(fs.openSync(chemin, 'r'));
  } catch (e) {
    if (e.code !== 'EPERM' && e.code !== 'EACCES') throw new Error(`Fichier introuvable (${e.code}).`);
    throw new Error(`Accès refusé par ${NOM_SYSTEME} (${e.code}).${MAC ? ' Autorise Dérush dans Réglages Système › Confidentialité et sécurité › Fichiers et dossiers.' : ''}`);
  }
  if (EXT_IMAGES.test(chemin)) return sonderImage(chemin);
  let j;
  try {
    const {out} = await lancer(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', chemin]);
    j = JSON.parse(out.toString());
  } catch {
    throw new Error('Fichier illisible : ce n’est pas une vidéo, un son ou une image que FFmpeg sait ouvrir.');
  }
  const vs = j.streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic);
  const as = j.streams.find((s) => s.codec_type === 'audio');
  if (!vs && !as) throw new Error('Ce fichier ne contient ni image ni son.');
  let duree = Number(j.format.duration ?? vs?.duration ?? as?.duration);
  // un fichier écrit au fil de l'eau (la prise d'une fenêtre gardée telle quelle, une capture d'écran interrompue) ne
  // porte pas sa durée : on la mesure en le parcourant. Une image seule n'en a pas besoin.
  if (!(duree > 0) && Number(vs?.nb_frames) !== 1 && !/image2|_pipe/.test(j.format.format_name ?? '')) duree = await dureeParcourue(chemin);
  // une seule image (une photo dans un conteneur vidéo, par exemple) : on la traite comme une image fixe
  if (vs && !as && (!(duree > 0) || Number(vs.nb_frames) === 1)) return sonderImage(chemin);
  if (!(duree > 0)) throw new Error('Durée illisible.');
  const info = {type: vs ? 'video' : 'audio', duree: arrondi(duree, 4), fps: null, fps_txt: null, largeur: null, hauteur: null, rotation: 0, hdr: false,
    codec: (vs ?? as).codec_name, audio: as ? {codec: as.codec_name, canaux: as.channels, frequence: Number(as.sample_rate)} : null,
    taille: Number(j.format.size) || fs.statSync(chemin).size, conteneur: j.format.format_name,
    debit_kbps: Number(j.format.bit_rate) ? Math.round(Number(j.format.bit_rate) / 1000) : null, tournage: tournage(j, vs)};
  if (vs) {
    const c = cadence(vs);
    info.fps = c.fps;
    info.fps_txt = c.txt;
    info.rotation = rotationDe(vs);
    info.largeur = vs.width;
    info.hauteur = vs.height;
    if (info.rotation % 180 === 90) [info.largeur, info.hauteur] = [info.hauteur, info.largeur];
    info.hdr = ['arib-std-b67', 'smpte2084'].includes(vs.color_transfer);
    Object.assign(info, technique(vs));
  }
  return info;
}

/** Le format exact de l'image : pixels, profondeur, couleurs, cadence variable. Sert à choisir comment l'IA le reçoit. */
function technique(vs) {
  const f = (x) => { const [a, b] = String(x ?? '').split('/').map(Number); return a > 0 && b > 0 ? a / b : null; };
  const r = f(vs.r_frame_rate);
  const moy = f(vs.avg_frame_rate);
  const bits = Number(vs.bits_per_raw_sample) || (/(10|12|16)(le|be)?$/.exec(vs.pix_fmt ?? '')?.[1] ? Number(/(10|12|16)(le|be)?$/.exec(vs.pix_fmt)[1]) : 8);
  return {
    pix_fmt: vs.pix_fmt ?? null, profil_codec: vs.profile ?? null, bits,
    transfert: vs.color_transfer ?? null, primaires: vs.color_primaries ?? null, matrice: vs.color_space ?? null, plage: vs.color_range ?? null,
    fps_variable: !!(r && moy && Math.abs(r - moy) / r > 0.01),
  };
}
/** Complète les informations techniques d'un rush importé avant la version 11 (une seule lecture par ffprobe). */
export async function infosTechniques(m) {
  if (m.type !== 'video' || m.pix_fmt !== undefined) return m;
  try {
    const {out} = await lancer(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-print_format', 'json', '-show_streams', m.chemin]);
    const vs = JSON.parse(out.toString()).streams?.[0];
    if (vs) Object.assign(m, technique(vs));
  } catch { /* fichier débranché : on garde ce qu'on sait */ }
  return m;
}

// ——— La version de montage : le fichier que l'IA et le rendu reçoivent ———
// Le moteur de rendu (Remotion, par WebCodecs) lit directement le H.264 et le HEVC en 4:2:0, 8 ou 10 bits (iPhone sans
// HDR, DJI, GoPro…), le VP9 et l'AV1 : ces rushes vont tels quels à l'IA, clonés (aucune copie sur le même disque). Les
// autres (ProRes, DNxHD, H.264 4:2:2 des caméras, HDR, Log converti, vidéo tournée) passent une seule fois par une
// version de montage en H.264, faite en tâche de fond après l'import, rangée dans le dossier du rush et réutilisée.
const LISIBLES = {h264: ['yuv420p', 'yuvj420p'], hevc: ['yuv420p', 'yuvj420p', 'yuv420p10le'], vp9: ['yuv420p', 'yuv420p10le'], av1: ['yuv420p', 'yuv420p10le']};
const CONTENEURS = /mov|mp4|matroska|webm/;
/** Ce rush peut-il aller tel quel à l'IA ? Sinon, pourquoi (et faut-il le réencoder, ou seulement changer d'emballage). */
export function besoinVersion(m) {
  if (m.type !== 'video') return null;
  if (m.hdr) return {genre: 'reencoder', raison: 'vidéo HDR, ramenée en couleurs normales (SDR)'};
  if (lutDe(m)) return {genre: 'reencoder', raison: 'couleurs de la caméra converties (Log)'};
  if ((m.rotation ?? 0) % 360) return {genre: 'reencoder', raison: 'vidéo tournée'};
  if (m.pix_fmt === undefined) return {genre: 'inconnu', raison: 'format à vérifier'};
  if (!(LISIBLES[m.codec] ?? []).includes(m.pix_fmt)) return {genre: 'reencoder', raison: `format de caméra (${m.codec}${m.pix_fmt ? `, ${m.pix_fmt}` : ''})`};
  if (!CONTENEURS.test(m.conteneur ?? '')) return {genre: 'emballer', raison: 'emballage (conteneur) à changer'};
  return null;
}
const RECETTE_VERSION = 1; // à monter si la façon de faire la version de montage change : les anciennes sont refaites
/** Le nom du fichier de la version de montage : il change avec ce qui la décide (HDR, LUT, rotation, recette). */
function nomVersion(m, b) {
  const cle = JSON.stringify([RECETTE_VERSION, b.genre, m.hdr, cleLut(m), m.rotation ?? 0]);
  let h = 0;
  for (const ch of cle) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `montage-${h.toString(36)}.mp4`;
}
/** La version de montage est-elle déjà là (ou inutile) ? */
export function versionPrete(P, m) {
  const b = besoinVersion(m);
  return !b || (b.genre !== 'inconnu' && fs.existsSync(path.join(P.cache, 'medias', m.id, nomVersion(m, b))));
}
/**
 * Le fichier à donner à l'IA pour ce rush : l'original s'il se lit tel quel, sinon sa version de montage (faite si
 * elle manque). `lut` : chemin d'un fichier .cube à appliquer (couleurs Log), donné par lib/couleurs.mjs.
 */
export async function fichierPourIA(P, m, prog = () => {}, {lut = lutDe(m)} = {}) {
  await infosTechniques(m);
  const b = besoinVersion(m);
  if (!b) return m.chemin;
  const D = P.dossierMedia(m.id);
  const sortie = path.join(D, nomVersion(m, b));
  if (fs.existsSync(sortie)) return sortie;
  // déjà en train de se faire (la préparation en tâche de fond, et une demande à l'IA qui arrive) : on l'attend
  if (VERSIONS_EN_COURS.has(sortie)) return VERSIONS_EN_COURS.get(sortie);
  const travail = faireVersion(m, b, D, sortie, prog, lut).finally(() => VERSIONS_EN_COURS.delete(sortie));
  VERSIONS_EN_COURS.set(sortie, travail);
  return travail;
}
const VERSIONS_EN_COURS = new Map();
async function faireVersion(m, b, D, sortie, prog, lut) {
  // le ménage : les versions d'une ancienne recette ou d'un ancien profil de couleur, et les écritures interrompues
  // (jamais celle qu'un autre travail est en train de faire pour ce rush)
  for (const f of fs.readdirSync(D)) {
    const perime = /^montage-.*\.mp4$/.test(f) || f === 'montage.part.mp4'
      || (/^\.montage-.*\.part\.mp4$/.test(f) && !VERSIONS_EN_COURS.has(path.join(D, f.slice(1).replace(/\.part\.mp4$/, '.mp4'))));
    if (perime) fs.rmSync(path.join(D, f), {force: true});
  }
  // un fichier provisoire propre à cette version : deux versions du même rush (le profil de couleur a changé pendant
  // que la première se faisait) ne s'écrivent jamais l'une dans l'autre
  const tmp = path.join(D, `.${path.basename(sortie, '.mp4')}.part.mp4`);
  const son = ['-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', tmp];
  try {
    if (b.genre === 'emballer') {
      await ffmpeg(['-y', '-i', m.chemin, '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'copy', ...son], {duree: m.duree, prog});
    } else {
      const filtres = [await filtreSdr(m), lut ? filtreCube(lut) : null,
        // au plus 3840 de côté : au-delà, rien ne se verrait de plus dans une vidéo 4K, et l'encodage resterait long
        "scale='if(gt(iw,ih),min(iw,3840),-2)':'if(gt(iw,ih),-2,min(ih,3840))':flags=lanczos", 'format=yuv420p'].filter(Boolean).join(',');
      const cadence = m.fps_variable && m.fps ? ['-fps_mode', 'cfr', '-r', String(arrondi(m.fps, 4))] : [];
      const debit = Math.round(Math.min(3840 * 2160, (m.largeur || 1920) * (m.hauteur || 1080)) * (m.fps || 30) * 0.22 / 1000);
      let fait = false;
      if (await videotoolbox()) {
        try {
          await ffmpeg(['-y', '-i', m.chemin, '-map', '0:v:0', '-map', '0:a:0?', '-vf', filtres, ...cadence, '-c:v', 'h264_videotoolbox', '-b:v', `${debit}k`, '-maxrate', `${Math.round(debit * 1.5)}k`,
            '-profile:v', 'high', ...son], {duree: m.duree, prog, silenceMax: 60000});
          fait = true;
        } catch (e) { if (/ne répondait plus/.test(e.message)) VIDEOTOOLBOX = false; }
      }
      if (!fait) {
        await ffmpeg(['-y', '-i', m.chemin, '-map', '0:v:0', '-map', '0:a:0?', '-vf', filtres, ...cadence, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', ...son], {duree: m.duree, prog});
      }
    }
    fs.renameSync(tmp, sortie);
  } catch (e) {
    // rien ne reste d'une version ratée (pour un long rush 4K, plusieurs gigaoctets)
    fs.rmSync(tmp, {force: true});
    throw e;
  }
  return sortie;
}

/**
 * Pose un fichier dans le dossier de l'IA : un clone (APFS sur Mac, reflink ailleurs), instantané et sans place prise,
 * que l'IA peut modifier sans toucher au rush ; sinon une vraie copie. Ces deux-là sont sans risque pour l'original.
 * `lienSiGros` : au-delà de cette taille (un rush sur un autre disque), un lien symbolique plutôt qu'une copie de
 * plusieurs gigaoctets. Attention, un lien n'est PAS sans risque : écrire dans ce fichier, c'est écrire dans le rush
 * d'origine. Celui qui appelle doit le savoir (le résultat 'lien') et l'IA en être prévenue.
 * Renvoie 'clone', 'copie' ou 'lien'.
 */
export async function poserFichier(src, dst, {lienSiGros = Infinity} = {}) {
  fs.rmSync(dst, {force: true});
  if (await cloner(src, dst)) return 'clone';
  // pas de clone possible ici (autre disque, autre système de fichiers)
  if (fs.statSync(src).size > lienSiGros) {
    fs.symlinkSync(src, dst);
    return 'lien';
  }
  await fs.promises.copyFile(src, dst);
  return 'copie';
}

/** Fichier utilisé pour la lecture dans l'interface : le proxy s'il existe, sinon l'original. */
export function fichierLecture(P, m) {
  const D = path.join(P.cache, 'medias', m.id);
  for (const f of ['proxy.mp4', 'proxy.m4a', 'proxy.jpg']) {
    const p = path.join(D, f);
    if (fs.existsSync(p)) return p;
  }
  return m.chemin;
}

/** Ajoute un rush au projet (une seule fois par chemin) et lance sa préparation. */
export async function ajouterMedia(P, chemin, file) {
  chemin = path.resolve(chemin);
  const deja = P.d.medias.find((m) => m.chemin === chemin);
  if (deja) return deja;
  const info = await sonder(chemin);
  // un autre import du même fichier a pu passer pendant la sonde : le rush n'entre qu'une fois
  const entreTemps = P.d.medias.find((m) => m.chemin === chemin);
  if (entreTemps) return entreTemps;
  const m = {id: nouvelId(P.d, 'M'), nom: path.basename(chemin), chemin, ...info, ajoute_le: new Date().toISOString(),
    etat: 'attente', etapes: {}, vignettes: null, analyse: null, transcription: null, erreur: null};
  P.d.medias.push(m);
  P.sauver();
  // une image du rush tout de suite (un dixième de seconde) : il se voit et se monte sans attendre sa préparation
  await affichetteASonTour(P, m);
  if (P.d.medias.includes(m)) preparer(P, m, file);
  return m;
}

/** Taille des vignettes d'un rush : 96 px de haut, largeur paire. */
const tailleVignette = (m) => ({h: 96, l: Math.max(2, Math.round((96 * m.largeur) / m.hauteur / 2) * 2)});

/**
 * Une seule image, prise près du début : la carte du rush et ses plans dans la timeline ont quelque chose à montrer
 * pendant que les vraies vignettes se fabriquent. Elle est marquée « provisoire ».
 */
async function faireAffichette(P, m) {
  if (m.type !== 'video' || m.vignettes || !P.d.medias.includes(m)) return;
  try {
    const D = P.dossierMedia(m.id);
    const {l, h} = tailleVignette(m);
    const sdr = await filtreSdr(m);
    const tmp = path.join(D, 'vignettes.part.jpg');
    // l'image est réduite AVANT la conversion des couleurs (HDR, Log) : convertir une image 4K pour en garder 96 px de
    // haut coûtait neuf fois le calcul. Deux fils suffisent pour une seule image (un décodeur 4K en prend sinon dix).
    await ffmpeg(['-y', '-threads', '2', '-ss', Math.min(1, m.duree * 0.1).toFixed(3), '-i', m.chemin, '-map', '0:v:0', '-an', '-frames:v', '1',
      '-vf', [`scale=${l}:${h}`, sdr, filtreLut(m)].filter(Boolean).join(','), '-q:v', '5', tmp], {silenceMax: 20000});
    if (!P.d.medias.includes(m)) return; // retiré entre-temps
    fs.renameSync(tmp, path.join(D, 'vignettes.jpg'));
    m.vignettes = {n: 1, pas: m.duree, l, h, provisoire: true};
    P.sauver();
  } catch { /* pas grave : les vraies vignettes arrivent juste après */ }
}

// Trois premières images à la fois au plus : un dépôt de trente rushes 4K lançait trente FFmpeg d'un coup (12 Go de
// mémoire demandés, et trois fois plus lent qu'à tour de rôle).
let placesAffichettes = 3;
const attenteAffichettes = [];
async function affichetteASonTour(P, m) {
  if (placesAffichettes > 0) placesAffichettes--;
  else await new Promise((ok) => attenteAffichettes.push(ok));
  try {
    await faireAffichette(P, m);
  } finally {
    const suivant = attenteAffichettes.shift();
    if (suivant) suivant(); else placesAffichettes++;
  }
}

// ——— La préparation légère : ce qui rend un rush agréable à manier, fait tout de suite ———
// Les vignettes (lues sur les images clés de l'original : une à deux secondes même en 4K) et la courbe du son. Elle ne
// passe pas par la file d'attente : même si un rendu ou un proxy est en cours, un rush qu'on vient de déposer s'affiche.
// Deux rushes à la fois au plus.
const LEGERES = new Map(); // « projet + rush » → la promesse de sa préparation légère
const cleLegere = (P, m) => `${P.racine}\n${m.id}`;
/**
 * Ce rush est-il toujours dans son projet, et ces objets sont-ils toujours les bons ? Non s'il a été retiré, ou si le
 * projet a été relu sur le disque depuis (une préparation plus récente porte alors d'autres objets) : un travail de
 * fond qui continue ne doit plus rien enregistrer, il réécrirait l'ancien état du projet.
 */
function enVie(P, m) {
  if (!P.d.medias.includes(m)) return false;
  const e = EN_FILE.get(`preparation\n${cleLegere(P, m)}`);
  return !e || e.m === m;
}
/** Un rush retiré pendant qu'on travaillait pour lui : ce qui vient d'être écrit dans son dossier s'en va avec lui. */
function oublierSiRetire(P, m) {
  if (!P.d.medias.some((x) => x.id === m.id)) fs.rmSync(path.join(P.cache, 'medias', m.id), {recursive: true, force: true});
}
let placesLegeres = 2;
const attenteLegere = [];
function preparerVite(P, m) {
  const k = cleLegere(P, m);
  if (LEGERES.has(k)) return LEGERES.get(k);
  const p = (async () => {
    if (placesLegeres > 0) placesLegeres--;
    else await new Promise((ok) => attenteLegere.push(ok));
    try {
      if (!enVie(P, m)) return;
      const D = P.dossierMedia(m.id);
      // pas encore de vraies vignettes, ou plus de fichier (les couleurs du rush viennent de changer : l'ancienne
      // planche est effacée, et la timeline n'aurait plus d'images jusqu'à la fin du nouvel aperçu)
      if (m.type === 'video' && m.etapes.vignettes !== true && (!m.vignettes || m.vignettes.provisoire || !fs.existsSync(path.join(D, 'vignettes.jpg')))) {
        try { await faireVignettesRapides(P, m, D); } catch { /* les vignettes exactes seront faites après le proxy */ }
        if (enVie(P, m)) P.sauver();
      }
      if (enVie(P, m) && m.etapes.ondes !== true && m.etapes.ondes !== false) {
        try { m.etapes.ondes = (await faireOndes(P, m, D, () => {})) !== false; } catch { /* refait avec la préparation complète */ }
        if (enVie(P, m)) P.sauver();
      }
    } finally {
      oublierSiRetire(P, m);
      const suivant = attenteLegere.shift();
      if (suivant) suivant(); else placesLegeres++;
    }
  })().catch(() => {}).finally(() => LEGERES.delete(k));
  LEGERES.set(k, p);
  return p;
}

/**
 * Des vignettes en une ou deux secondes : on ne lit que les images clés de l'original (la puce du Mac aide pour les
 * formats lourds). Elles sont justes à une seconde près pour un film de téléphone ou de caméra ; les vignettes exactes
 * les remplacent quand le proxy est prêt.
 */
async function faireVignettesRapides(P, m, D) {
  const n = Math.max(8, Math.min(120, Math.round(m.duree / 2)));
  const pas = m.duree / n;
  const {l, h} = tailleVignette(m);
  const sdr = await filtreSdr(m);
  const lourd = ['hevc', 'prores', 'av1', 'vp9'].includes(m.codec) || m.largeur * m.hauteur > 3840 * 2160;
  const tmp = path.join(D, 'vignettes.part.jpg');
  // on ne garde qu'une image de temps en temps et on la réduit AVANT de convertir ses couleurs (HDR, Log) : en 4K,
  // la conversion de chaque image clé coûtait bien plus que tout le reste
  const args = (puce) => ['-y', ...(puce ? ['-hwaccel', 'videotoolbox'] : []), '-skip_frame', 'nokey', '-i', m.chemin, '-map', '0:v:0', '-an',
    '-vf', [`fps=${(1 / pas).toFixed(6)}`, `scale=${l}:${h}`, sdr, filtreLut(m), `tile=${n}x1`].filter(Boolean).join(','), '-frames:v', '1', '-q:v', '5', tmp];
  try {
    await ffmpeg(args(lourd && MAC), {duree: m.duree, silenceMax: 45000});
  } catch (e) {
    if (!(lourd && MAC)) throw e;
    await ffmpeg(args(false), {duree: m.duree, silenceMax: 45000});
  }
  if (m.etapes.vignettes === true || !enVie(P, m)) return; // les vignettes exactes sont arrivées entre-temps, ou le rush est parti
  fs.renameSync(tmp, path.join(D, 'vignettes.jpg'));
  m.vignettes = {n, pas: arrondi(pas, 6), l, h, provisoire: true};
}

/**
 * Ajoute plusieurs rushes d'un coup (un dépôt depuis le Finder) : ils sont sondés ensemble, inscrits dans l'ordre du
 * dépôt, puis reçoivent leur première image (trois à la fois). Renvoie {ajoutes: [ids], erreurs: [textes]}.
 */
export async function ajouterMedias(P, chemins, file) {
  const liste = [...new Set(chemins.map((c) => path.resolve(String(c))))];
  const sondes = await Promise.all(liste.map(async (chemin) => {
    const deja = P.d.medias.find((m) => m.chemin === chemin);
    if (deja) return {chemin, deja};
    try { return {chemin, info: await sonder(chemin)}; } catch (e) { return {chemin, erreur: e.message}; }
  }));
  const ajoutes = [];
  const erreurs = [];
  const nouveaux = [];
  for (const s of sondes) {
    if (s.erreur) { erreurs.push(`${path.basename(s.chemin)} : ${s.erreur}`); continue; }
    // « déjà là ? » est regardé de nouveau ici : un autre dépôt du même fichier a pu passer pendant les sondes
    const deja = s.deja ?? P.d.medias.find((m) => m.chemin === s.chemin);
    if (deja) { ajoutes.push(deja.id); continue; }
    const m = {id: nouvelId(P.d, 'M'), nom: path.basename(s.chemin), chemin: s.chemin, ...s.info, ajoute_le: new Date().toISOString(),
      etat: 'attente', etapes: {}, vignettes: null, analyse: null, transcription: null, erreur: null};
    P.d.medias.push(m);
    nouveaux.push(m);
    ajoutes.push(m.id);
  }
  if (nouveaux.length) P.sauver();
  // la première image de chacun (trois à la fois), puis sa préparation, dans l'ordre du dépôt
  let suite = Promise.resolve();
  for (const m of nouveaux) {
    const image = affichetteASonTour(P, m);
    suite = suite.then(() => image).then(() => { if (P.d.medias.includes(m)) preparer(P, m, file); }).catch((e) => console.error(`[Import · ${m.nom}]`, e.message));
  }
  // la réponse n'attend pas plus de quelques secondes : pour un très gros dépôt, les premières images qui manquent
  // encore arrivent ensuite d'elles-mêmes, comme les vignettes
  let minuteur;
  await Promise.race([suite, new Promise((ok) => { minuteur = setTimeout(ok, 5000); })]);
  clearTimeout(minuteur);
  return {ajoutes, erreurs};
}

/**
 * Retire un rush qui n'est plus utilisé, ni dans le montage ni par-dessus (une voix off, une image posée) ; le fichier
 * d'origine n'est jamais touché. Sa préparation, si elle tourne encore, s'arrête à la fin de son étape.
 */
export function retirerMedia(P, id) {
  if ([...P.d.montage, ...(P.d.superpositions ?? [])].some((it) => it.media === id)) throw new Error('Ce rush est utilisé dans le montage (ou posé par-dessus) : retire d’abord ses plans.');
  // les autres vidéos du projet (lib/sequences.mjs, sans l'importer : medias → sequences → rendu → pack → medias
  // bouclerait) : un rush retiré ferait disparaître leurs plans à la relecture
  const autre = (P.d.sequences ?? []).find((s) => s.id !== P.d.sequence && [...(s.montage ?? []), ...(s.superpositions ?? [])].some((it) => it?.media === id));
  if (autre) throw new Error(`Ce rush est utilisé dans une autre vidéo du projet (« ${autre.nom} ») : retire d’abord ses plans.`);
  P.d.medias = P.d.medias.filter((m) => m.id !== id);
  fs.rmSync(path.join(P.cache, 'medias', id), {recursive: true, force: true});
  P.sauver();
}

const ETAPES = [
  ['proxy', (...a) => faireProxy(...a), 0.4],
  ['ondes', (...a) => faireOndes(...a), 0.12],
  ['vignettes', (...a) => faireVignettes(...a), 0.08],
  ['analyse', (...a) => faireAnalyse(...a), 0.25],
  ['cadrage', (P, m, D, prog) => faireCadrage(P, m, D, prog, fichierLecture), 0.15],
  // le texte mot à mot, tout de suite (Whisper, sur l'ordinateur, gratuit) : l'IA n'aura plus à l'attendre au moment de
  // monter, et les mesures du son savent où l'on parle. Seulement si Whisper est installé ; jamais ElevenLabs (payant).
  ['texte', async (P, m, D, prog) => {
    if (!m.audio || m.duree > 2 * 3600) return false;
    if (m.transcription) return true;
    const T = await import('./transcription.mjs');
    WHISPER = !!(await T.moteurs()).whisper?.ok;
    if (!WHISPER) return false; // il sera fait dès que Whisper sera installé (texteEnAttente)
    await T.transcrire(P, m, 'whisper', prog);
    // le texte arrive après coup (Whisper installé depuis) : les mesures du son qui s'en servent (écho, bruit de fond
    // derrière la voix) sont à refaire ; elles viennent juste après
    delete m.etapes.mesures;
    return true;
  }, 0.2],
  // les mesures de l'image et du son (pastilles des vignettes, Log probable, souffle, écho) : sur l'aperçu, très vite
  ['mesures', async (P, m, D, prog) => (await import('./analyse.mjs')).mesurerMedia(P, m, D, prog), 0.08],
  // ce qui est déjà incrusté dans le rush (images noires, transitions rapides d'une appli, son coupé, logo, texte) : l'IA
  // le sait avant de regarder, au lieu de le découvrir
  ['incrustes', async (P, m, D, prog) => (await import('./analyse.mjs')).reperesIncrustes(P, m, D, prog), 0.06],
  // en dernier (c'est le plus long, et seulement pour les formats que le rendu ne lit pas tel quel) : la version de
  // montage que l'IA recevra, prête avant même qu'on lui demande quoi que ce soit
  ['montage', async (P, m, D, prog) => {
    await infosTechniques(m);
    const b = besoinVersion(m);
    if (!b || b.genre === 'inconnu') return false;
    await fichierPourIA(P, m, prog, {lut: lutDe(m)});
    return true;
  }, 0.3],
];
// La version de montage a sa propre tâche, mise en file à la fin de la préparation : c'est un réencodage entier, et une
// demande de la personne (créer la vidéo, un texte, une voix claire) n'a pas à l'attendre derrière chaque rush.
const TACHES = {
  preparation: {etapes: ETAPES.filter(([nom]) => nom !== 'montage'), nom: (m) => `Préparation · ${m.nom}`},
  version: {etapes: ETAPES.filter(([nom]) => nom === 'montage'), nom: (m) => `Version de montage · ${m.nom}`},
};
// les étapes dont le résultat dépend des couleurs choisies pour le rush (profil Log, LUT de la caméra)
const DEPEND_DES_COULEURS = new Set(['proxy', 'vignettes', 'mesures', 'montage']);
const cleCouleurs = (m) => JSON.stringify(m.couleur ?? null);

let WHISPER = null; // Whisper est-il installé ? null : pas encore regardé depuis le lancement
/**
 * Un rush qui parle mais n'a pas eu son texte, faute de Whisper le jour de sa préparation : il le reçoit dès que
 * Whisper est là (à l'installation pour le projet ouvert, à l'ouverture pour les autres).
 */
const texteEnAttente = (m) => m.etapes?.texte === false && !!m.audio && !m.transcription && !(m.duree > 2 * 3600);
const aFaire = (m, nom) => (m.etapes?.[nom] !== true && m.etapes?.[nom] !== false) || (nom === 'texte' && WHISPER !== false && texteEnAttente(m));

/** Une étape de préparation manque-t-elle (par exemple une nouveauté de Dérush sur un ancien projet) ? */
export const etapesManquantes = (m) => ETAPES.some(([nom]) => aFaire(m, nom));

/** Sépare la voix de tout le reste (Demucs) : voix.flac et fond.flac dans le cache du rush. */
export async function isolerVoix(P, m, prog) {
  if (!m.audio) throw new Error('Ce rush n’a pas de son.');
  const D = P.dossierMedia(m.id);
  await lancerPython('voix.py', [m.chemin, D], prog);
  m.voix = {moteur: 'demucs htdemucs', cree_le: new Date().toISOString()};
  P.sauver();
  return m.voix;
}

/** Fichier de la version du son demandée (voix seule, fond seul), s'il existe. */
export function fichierSon(P, m, version) {
  if (!version || version === 'original') return null;
  const f = path.join(P.cache, 'medias', m.id, `${version}.flac`);
  return fs.existsSync(f) ? f : null;
}

/** Affiche du projet dans la bibliothèque (une image du premier rush vidéo prêt), si elle manque. */
export async function creerAffiche(P) {
  DERNIER_PROJET = P; // appelée à chaque ouverture d'un projet
  const affiche = path.join(P.cache, 'affiche.jpg');
  if (fs.existsSync(affiche)) return;
  const m = P.d.medias.find((x) => x.type === 'video' && x.etapes?.proxy === true);
  if (!m) return;
  try {
    await ffmpeg(['-y', '-ss', (m.duree * 0.3).toFixed(3), '-i', fichierLecture(P, m), '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', affiche]);
  } catch { /* pas grave : la bibliothèque affichera une couleur */ }
}

const EN_FILE = new Map(); // « tâche + projet + rush » → {P, m, encore, remplacee} : la tâche qui attend ou qui tourne
let DERNIER_PROJET = null; // le dernier projet ouvert ou préparé
const FILES_ECOUTEES = new WeakSet();
/** Whisper vient d'être installé : les rushes du projet ouvert qui attendaient leur texte le reçoivent tout de suite. */
function ecouterInstallations(file) {
  if (!file?.ecouteurs || FILES_ECOUTEES.has(file)) return;
  FILES_ECOUTEES.add(file);
  file.ecouteurs.add((t) => {
    if (t.meta?.type !== 'installation' || t.meta?.moteur !== 'whisper' || t.etat !== 'fini') return;
    WHISPER = null;
    const P = DERNIER_PROJET;
    if (P) for (const m of P.d.medias) if (texteEnAttente(m)) preparer(P, m, file);
  });
}

/**
 * Met une tâche d'un rush dans la file, une seule fois. Si elle y est déjà (le projet rouvert, les couleurs changées,
 * « Réessayer »), elle suffit : en attente, elle lira l'état du rush quand elle tournera ; en route, elle refera un tour
 * à la fin de son étape. Si le projet a été relu sur le disque (d'autres objets pour le même rush), l'ancienne tâche
 * s'arrête sans rien enregistrer et la nouvelle prend sa suite.
 */
function mettreEnFile(P, m, file, genre) {
  const k = `${genre}\n${cleLegere(P, m)}`;
  const deja = EN_FILE.get(k);
  if (deja && deja.m === m) { deja.encore = true; return; }
  if (deja) deja.remplacee = true;
  const e = {P, m, encore: false, remplacee: false};
  EN_FILE.set(k, e);
  file.ajouter(TACHES[genre].nom(m), async (prog) => {
    try {
      return await derouler(e, genre, prog, file);
    } finally {
      if (EN_FILE.get(k) === e) EN_FILE.delete(k);
    }
  }, {media: m.id, type: genre});
}

/** Les étapes d'une tâche (la préparation, ou la version de montage) qui ne sont pas encore faites, dans l'ordre. */
async function derouler(e, genre, prog, file) {
  const {P, m} = e;
  const {etapes} = TACHES[genre];
  const total = etapes.reduce((a, [, , p]) => a + p, 0);
  // le rush a été retiré, ou le projet relu sur le disque, pendant que la tâche attendait ou tournait : elle s'arrête
  // là, sans rien enregistrer (elle réécrirait l'ancien état du projet), et rien ne reste d'un rush retiré
  const perdu = () => (e.remplacee ? 'remplacee' : P.d.medias.includes(m) ? null : 'retire');
  const sortir = (etat) => { if (etat === 'retire') oublierSiRetire(P, m); return {media: m.id, etat}; };
  if (perdu()) return sortir(perdu());
  const D = P.dossierMedia(m.id);
  let erreurs = [];
  tours: for (;;) {
    e.encore = false;
    erreurs = [];
    if (genre === 'preparation') { m.etat = 'analyse'; m.erreur = null; }
    let fait = 0;
    for (const [nom, fn, poids] of etapes) {
      // la courbe du son et les vignettes rapides sont peut-être encore en train de se faire à côté : on les laisse finir
      if (nom === 'ondes' || nom === 'vignettes') await LEGERES.get(cleLegere(P, m));
      if (perdu()) return sortir(perdu());
      if (aFaire(m, nom)) {
        const couleurs = cleCouleurs(m);
        let resultat;
        let erreur = null;
        try {
          resultat = await fn(P, m, D, (p) => prog((fait + p * poids) / total));
        } catch (x) {
          erreur = x;
        }
        if (perdu()) return sortir(perdu());
        // les couleurs du rush ont changé pendant l'étape : son résultat est déjà faux. On ne la marque pas faite, et on
        // reprend au début (l'aperçu d'abord, puis ce qui en dépend)
        if (DEPEND_DES_COULEURS.has(nom) && couleurs !== cleCouleurs(m)) continue tours;
        if (erreur) {
          m.etapes[nom] = 'erreur';
          erreurs.push(`${nom} : ${erreur.message}`);
        } else m.etapes[nom] = resultat !== false;
        P.sauver();
        // une préparation a été redemandée pendant l'étape : des étapes ont pu être remises à faire. On reprend au
        // début, dans l'ordre ; celles qui sont faites sont passées aussitôt
        if (e.encore) continue tours;
      }
      fait += poids;
    }
    if (!e.encore) break;
  }
  if (genre === 'version') {
    if (erreurs.length) {
      m.etat = 'erreur';
      m.erreur = [m.erreur, ...erreurs].filter(Boolean).join(' · ');
      P.sauver();
    }
    return {media: m.id, etat: m.etat};
  }
  // affiche du projet dans la bibliothèque : une image du premier rush vidéo
  const affiche = path.join(P.cache, 'affiche.jpg');
  if (m.type === 'video' && !fs.existsSync(affiche)) {
    try {
      await ffmpeg(['-y', '-ss', (m.duree * 0.3).toFixed(3), '-i', fichierLecture(P, m), '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', affiche]);
    } catch { /* pas grave : la bibliothèque affichera une couleur */ }
    if (perdu()) {
      // l'affiche du projet ne vient pas d'un rush qui n'y est plus
      if (perdu() === 'retire') fs.rmSync(affiche, {force: true});
      return sortir(perdu());
    }
  }
  m.etat = erreurs.length ? 'erreur' : 'pret';
  m.erreur = erreurs.join(' · ') || null;
  // la version de montage, pour les formats que le rendu ne lit pas tels quels : à la suite, dans sa propre tâche
  if (aFaire(m, 'montage')) {
    await infosTechniques(m);
    const b = besoinVersion(m);
    if (!b || b.genre === 'inconnu') m.etapes.montage = false;
    else if (versionPrete(P, m)) m.etapes.montage = true;
    else mettreEnFile(P, m, file, 'version');
  }
  if (perdu()) return sortir(perdu());
  P.sauver();
  return {media: m.id, etat: m.etat};
}

/** Met en file les étapes de préparation qui ne sont pas encore faites. */
export function preparer(P, m, file) {
  m.etat = 'attente';
  DERNIER_PROJET = P;
  ecouterInstallations(file);
  preparerVite(P, m);
  mettreEnFile(P, m, file, 'preparation');
}

let VIDEOTOOLBOX = null;
/** La puce du Mac sait-elle encoder en H.264 (VideoToolbox) ? Bien plus rapide pour les vidéos lourdes. */
async function videotoolbox() {
  if (VIDEOTOOLBOX == null) {
    try {
      const {out} = await lancer(FFMPEG, ['-hide_banner', '-encoders']);
      VIDEOTOOLBOX = MAC && /h264_videotoolbox/.test(out.toString());
    } catch { VIDEOTOOLBOX = false; }
  }
  return VIDEOTOOLBOX;
}

async function faireProxy(P, m, D, prog) {
  if (m.type === 'image') {
    // une image légère pour l'affichage (HEIC, TIFF, PNG géants…) : sips, l'outil d'images de macOS
    const tmp = path.join(D, 'proxy.part.jpg');
    try {
      // réduite si elle dépasse 2160 px, jamais agrandie
      await lancer('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', ...(Math.max(m.largeur, m.hauteur) > 2160 ? ['-Z', '2160'] : []), m.chemin, '--out', tmp]);
    } catch {
      await ffmpeg(['-y', '-i', m.chemin, '-frames:v', '1', '-vf', "scale='min(2160,iw)':-2", '-q:v', '3', tmp]);
    }
    fs.renameSync(tmp, path.join(D, 'proxy.jpg'));
    return true;
  }
  if (m.type !== 'video') {
    if (/\.(mp3|wav|m4a|aac|ogg|oga|opus|flac)$/i.test(m.chemin)) return false; // le navigateur le lit tel quel
    await ffmpeg(['-y', '-i', m.chemin, '-map', '0:a:0', '-vn', '-c:a', 'aac', '-b:a', '160k', path.join(D, 'proxy.part.m4a')], {duree: m.duree, prog});
    fs.renameSync(path.join(D, 'proxy.part.m4a'), path.join(D, 'proxy.m4a'));
    return true;
  }
  const paysage = m.largeur >= m.hauteur;
  const sdr = await filtreSdr(m);
  // l'image est réduite à 540 px AVANT la conversion des couleurs (HDR vers SDR, LUT d'un profil Log) : en 4K, la
  // conversion de chaque image prenait cinq à six fois plus de temps, pour un aperçu identique
  const vf = [`${paysage ? 'scale=-2:540' : 'scale=540:-2'}:flags=bicubic`, sdr, filtreLut(m), 'format=yuv420p'].filter(Boolean).join(',');
  const tmp = path.join(D, 'proxy.part.mp4');
  const son = ['-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', tmp];
  // image clé toutes les 6 images : on peut se placer à l'image près sans attendre.
  // Les formats lourds (HEVC des iPhone, ProRes, AV1, plus que 4K) passent par la puce du Mac ; le reste, le logiciel
  // va aussi vite. Si la puce ne démarre pas, on repasse au logiciel.
  const lourd = ['hevc', 'prores', 'av1', 'vp9'].includes(m.codec) || m.largeur * m.hauteur > 3840 * 2160;
  if (lourd && await videotoolbox()) {
    try {
      await ffmpeg(['-y', '-hwaccel', 'videotoolbox', '-i', m.chemin, '-map', '0:v:0', '-map', '0:a:0?', '-vf', vf,
        '-c:v', 'h264_videotoolbox', '-b:v', '2500k', '-g', '6', '-bf', '0', ...son], {duree: m.duree, prog, silenceMax: 45000});
      fs.renameSync(tmp, path.join(D, 'proxy.mp4'));
      return true;
    } catch (e) {
      // format que la puce ne sait pas lire : on passe au logiciel. Si la puce est bloquée, on ne la réessaie plus.
      if (/ne répondait plus/.test(e.message)) VIDEOTOOLBOX = false;
    }
  }
  await ffmpeg(['-y', '-i', m.chemin, '-map', '0:v:0', '-map', '0:a:0?', '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24',
    '-g', '6', '-bf', '0', ...son], {duree: m.duree, prog});
  fs.renameSync(tmp, path.join(D, 'proxy.mp4'));
  return true;
}

/** Niveau en 0..100 : 0 = −60 dBFS ou moins, 100 = 0 dBFS. */
const niveau = (v) => (v <= 33 ? 0 : Math.max(0, Math.min(100, Math.round(((20 * Math.log10(v / 32768) + 60) / 60) * 100))));

async function faireOndes(P, m, D, prog) {
  if (!m.audio) return false;
  const pps = m.duree > 1200 ? 50 : 100;
  const sr = 8000;
  const par = sr / pps;
  const total = m.duree * sr;
  const niveaux = [];
  let max = 0;
  let n = 0;
  let lus = 0;
  let reste = null;
  await lancer(FFMPEG, ['-v', 'error', '-i', m.chemin, '-map', '0:a:0', '-ac', '1', '-ar', String(sr), '-f', 's16le', 'pipe:1'], {
    surStdout: (d) => {
      const b = reste ? Buffer.concat([reste, d]) : d;
      const fin = b.length - (b.length % 2);
      for (let i = 0; i < fin; i += 2) {
        const v = Math.abs(b.readInt16LE(i));
        if (v > max) max = v;
        if (++n === par) { niveaux.push(niveau(max)); max = 0; n = 0; }
      }
      reste = fin < b.length ? b.subarray(fin) : null;
      lus += fin / 2;
      prog(Math.min(0.99, lus / total));
    },
  });
  if (n) niveaux.push(niveau(max));
  ecrireJson(path.join(D, 'ondes.json'), {pps, echelle: '0 = -60 dBFS ou moins, 100 = 0 dBFS (crête)', niveaux}, 0);
  return true;
}

async function faireVignettes(P, m, D, prog) {
  if (m.type === 'image') {
    const h = 96;
    const l = Math.max(2, Math.round((h * m.largeur) / m.hauteur / 2) * 2);
    await ffmpeg(['-y', '-i', fichierLecture(P, m), '-frames:v', '1', '-vf', `scale=${l}:${h}`, '-q:v', '4', path.join(D, 'vignettes.jpg')]);
    m.vignettes = {n: 1, pas: m.duree, l, h};
    return true;
  }
  if (m.type !== 'video') return false;
  const n = Math.max(8, Math.min(120, Math.round(m.duree / 2)));
  const pas = m.duree / n;
  const {l, h} = tailleVignette(m);
  const tmp = path.join(D, 'vignettes.exactes.jpg');
  await ffmpeg(['-y', '-i', fichierLecture(P, m), '-map', '0:v:0', '-an', '-vf', `fps=${(1 / pas).toFixed(6)},scale=${l}:${h},tile=${n}x1`,
    '-frames:v', '1', '-q:v', '5', tmp], {duree: m.duree, prog});
  fs.renameSync(tmp, path.join(D, 'vignettes.jpg'));
  // « v » change à chaque nouvelle planche : l'interface recharge l'image (les vignettes provisoires avaient le même nombre)
  m.vignettes = {n, pas: arrondi(pas, 6), l, h, v: Date.now() % 1e9}; // « v » change à chaque nouvelle planche : l'interface la recharge
  return true;
}

/** Découpe un flux de texte en lignes complètes. */
const parLignes = (fn) => {
  let reste = '';
  return (s) => {
    reste += s;
    const lignes = reste.split(/\r?\n|\r/);
    reste = lignes.pop();
    lignes.forEach(fn);
  };
};

/**
 * Coupes de caméra (changements de plan dans le rush), images noires, silences, son coupé net (silence numérique, souvent
 * une transition d'appli), volume sonore (LUFS). Un seul passage sur l'image, un seul sur le son.
 */
async function faireAnalyse(P, m, D, prog) {
  if (m.type === 'image') return false;
  const res = {coupes_camera: [], images_noires: [], silences: [], son_coupe: [], lufs: null, crete_dbfs: null,
    reglages: {coupes_camera: 'score de changement d’image > 0,32', images_noires: 'image presque noire pendant au moins 0,04 s',
      silences: 'sous -38 dBFS pendant au moins 0,35 s', son_coupe: 'silence numérique (sous -90 dBFS) pendant au moins 0,03 s'}};
  if (m.type === 'video') {
    await ffmpeg(['-i', fichierLecture(P, m), '-map', '0:v:0', '-an', '-vf', "blackdetect=d=0.04:pix_th=0.10,select='gt(scene,0.32)',showinfo", '-f', 'null', '-'], {
      duree: m.duree, prog: (p) => prog(p * 0.5),
      surStderr: parLignes((l) => {
        const x = /Parsed_showinfo.*?pts_time:\s*([0-9.]+)/.exec(l);
        if (x) res.coupes_camera.push(arrondi(Number(x[1]), 3));
        const n = /black_start:\s*([0-9.]+)\s+black_end:\s*([0-9.]+)/.exec(l);
        if (n) res.images_noires.push([arrondi(Number(n[1]), 3), arrondi(Number(n[2]), 3)]);
      }),
    });
  }
  if (m.audio) {
    // deux détecteurs : 0 = les silences (pauses), 1 = le son coupé net
    const debut = [null, null];
    const listes = [res.silences, res.son_coupe];
    const {err} = await ffmpeg(['-i', m.chemin, '-map', '0:a:0', '-vn', '-af', 'silencedetect=noise=-38dB:d=0.35,silencedetect=noise=-90dB:d=0.03,ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], {
      duree: m.duree, prog: (p) => prog(0.5 + p * 0.5),
      surStderr: parLignes((l) => {
        const k = Number(/Parsed_silencedetect_(\d)/.exec(l)?.[1] ?? 0) === 1 ? 1 : 0;
        let x = /silence_start:\s*(-?[0-9.]+)/.exec(l);
        if (x) debut[k] = Math.max(0, Number(x[1]));
        x = /silence_end:\s*([0-9.]+)/.exec(l);
        if (x && debut[k] != null) { listes[k].push([arrondi(debut[k], 3), arrondi(Number(x[1]), 3)]); debut[k] = null; }
      }),
    });
    for (const k of [0, 1]) if (debut[k] != null) listes[k].push([arrondi(debut[k], 3), arrondi(m.duree, 3)]);
    const I = [...err.matchAll(/I:\s*(-?[0-9.]+) LUFS/g)].pop();
    const pk = [...err.matchAll(/Peak:\s*(-?[0-9.]+|-inf) dBFS/g)].pop();
    res.lufs = I ? Number(I[1]) : null;
    res.crete_dbfs = pk && pk[1] !== '-inf' ? Number(pk[1]) : null;
  }
  ecrireJson(path.join(D, 'analyse.json'), res);
  m.analyse = {coupes_camera: res.coupes_camera.length, silences: res.silences.length, lufs: res.lufs};
  return true;
}
