// Dérush — ajout et préparation des rushes : sonde technique, proxy de lecture, courbe du son, vignettes, analyse.
import fs from 'node:fs';
import path from 'node:path';
import {FFMPEG, FFPROBE, lancer, ffmpeg} from './outils.mjs';
import {ecrireJson} from './outils.mjs';
import {nouvelId, arrondi, EXT_IMAGES, EXT_RAW} from './commun.mjs';
import {faireCadrage} from './cadrage.mjs';
import {lancerPython} from './moteurs.mjs';

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

/** Fiche technique d'un fichier (FFprobe). */
export async function sonder(chemin) {
  if (EXT_RAW.test(chemin)) throw new Error('Format RAW de caméra (RED, Blackmagic, ARRI…) : FFmpeg ne sait pas le lire. Exporte d’abord une version ProRes ou H.264 depuis le logiciel de la caméra ou DaVinci Resolve.');
  // macOS peut refuser la lecture sur place (Bureau, Documents… protégés) : on le dit clairement
  try {
    fs.closeSync(fs.openSync(chemin, 'r'));
  } catch (e) {
    throw new Error(e.code === 'EPERM' || e.code === 'EACCES' ? `Accès refusé par macOS (${e.code}).` : `Fichier introuvable (${e.code}).`);
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
  const duree = Number(j.format.duration ?? vs?.duration ?? as?.duration);
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
  }
  return info;
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
  const m = {id: nouvelId(P.d, 'M'), nom: path.basename(chemin), chemin, ...info, ajoute_le: new Date().toISOString(),
    etat: 'attente', etapes: {}, vignettes: null, analyse: null, transcription: null, erreur: null};
  P.d.medias.push(m);
  P.sauver();
  preparer(P, m, file);
  return m;
}

/** Retire un rush qui n'est plus utilisé dans le montage (le fichier d'origine n'est jamais touché). */
export function retirerMedia(P, id) {
  if (P.d.montage.some((it) => it.media === id)) throw new Error('Ce rush est utilisé dans le montage : retire d’abord ses plans.');
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
];

/** Une étape de préparation manque-t-elle (par exemple une nouveauté de Dérush sur un ancien projet) ? */
export const etapesManquantes = (m) => ETAPES.some(([nom]) => m.etapes?.[nom] !== true && m.etapes?.[nom] !== false);

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
  const affiche = path.join(P.cache, 'affiche.jpg');
  if (fs.existsSync(affiche)) return;
  const m = P.d.medias.find((x) => x.type === 'video' && x.etapes?.proxy === true);
  if (!m) return;
  try {
    await ffmpeg(['-y', '-ss', (m.duree * 0.3).toFixed(3), '-i', fichierLecture(P, m), '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', affiche]);
  } catch { /* pas grave : la bibliothèque affichera une couleur */ }
}

/** Met en file les étapes de préparation qui ne sont pas encore faites. */
export function preparer(P, m, file) {
  m.etat = 'attente';
  file.ajouter(`Préparation · ${m.nom}`, async (prog) => {
    m.etat = 'analyse';
    m.erreur = null;
    const D = P.dossierMedia(m.id);
    const etapes = ETAPES;
    const erreurs = [];
    let fait = 0;
    for (const [nom, fn, poids] of etapes) {
      if (m.etapes[nom] !== true && m.etapes[nom] !== false) {
        try {
          const r = await fn(P, m, D, (p) => prog(fait + p * poids));
          m.etapes[nom] = r !== false;
        } catch (e) {
          m.etapes[nom] = 'erreur';
          erreurs.push(`${nom} : ${e.message}`);
        }
        P.sauver();
      }
      fait += poids;
    }
    // affiche du projet dans la bibliothèque : une image du premier rush vidéo
    const affiche = path.join(P.cache, 'affiche.jpg');
    if (m.type === 'video' && !fs.existsSync(affiche)) {
      try {
        await ffmpeg(['-y', '-ss', (m.duree * 0.3).toFixed(3), '-i', fichierLecture(P, m), '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', affiche]);
      } catch { /* pas grave : la bibliothèque affichera une couleur */ }
    }
    m.etat = erreurs.length ? 'erreur' : 'pret';
    m.erreur = erreurs.join(' · ') || null;
    P.sauver();
    return {media: m.id, etat: m.etat};
  }, {media: m.id, type: 'preparation'});
}

let VIDEOTOOLBOX = null;
/** La puce du Mac sait-elle encoder en H.264 (VideoToolbox) ? Bien plus rapide pour les vidéos lourdes. */
async function videotoolbox() {
  if (VIDEOTOOLBOX == null) {
    try {
      const {out} = await lancer(FFMPEG, ['-hide_banner', '-encoders']);
      VIDEOTOOLBOX = process.platform === 'darwin' && /h264_videotoolbox/.test(out.toString());
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
  const vf = [sdr, `${paysage ? 'scale=-2:540' : 'scale=540:-2'}:flags=bicubic`, 'format=yuv420p'].filter(Boolean).join(',');
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
  const h = 96;
  const l = Math.max(2, Math.round((h * m.largeur) / m.hauteur / 2) * 2);
  await ffmpeg(['-y', '-i', fichierLecture(P, m), '-map', '0:v:0', '-an', '-vf', `fps=${(1 / pas).toFixed(6)},scale=${l}:${h},tile=${n}x1`,
    '-frames:v', '1', '-q:v', '5', path.join(D, 'vignettes.jpg')], {duree: m.duree, prog});
  m.vignettes = {n, pas: arrondi(pas, 6), l, h};
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

/** Coupes de caméra (changements de plan dans le rush), silences, volume sonore (LUFS). */
async function faireAnalyse(P, m, D, prog) {
  if (m.type === 'image') return false;
  const res = {coupes_camera: [], silences: [], lufs: null, crete_dbfs: null,
    reglages: {coupes_camera: 'score de changement d’image > 0,32', silences: 'sous -38 dBFS pendant au moins 0,35 s'}};
  if (m.type === 'video') {
    await ffmpeg(['-i', fichierLecture(P, m), '-map', '0:v:0', '-an', '-vf', "select='gt(scene,0.32)',showinfo", '-f', 'null', '-'], {
      duree: m.duree, prog: (p) => prog(p * 0.5),
      surStderr: parLignes((l) => {
        const x = /Parsed_showinfo.*?pts_time:\s*([0-9.]+)/.exec(l);
        if (x) res.coupes_camera.push(arrondi(Number(x[1]), 3));
      }),
    });
  }
  if (m.audio) {
    let debut = null;
    const {err} = await ffmpeg(['-i', m.chemin, '-map', '0:a:0', '-vn', '-af', 'silencedetect=noise=-38dB:d=0.35,ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], {
      duree: m.duree, prog: (p) => prog(0.5 + p * 0.5),
      surStderr: parLignes((l) => {
        let x = /silence_start:\s*(-?[0-9.]+)/.exec(l);
        if (x) debut = Math.max(0, Number(x[1]));
        x = /silence_end:\s*([0-9.]+)/.exec(l);
        if (x && debut != null) { res.silences.push([arrondi(debut, 3), arrondi(Number(x[1]), 3)]); debut = null; }
      }),
    });
    if (debut != null) res.silences.push([arrondi(debut, 3), arrondi(m.duree, 3)]);
    const I = [...err.matchAll(/I:\s*(-?[0-9.]+) LUFS/g)].pop();
    const pk = [...err.matchAll(/Peak:\s*(-?[0-9.]+|-inf) dBFS/g)].pop();
    res.lufs = I ? Number(I[1]) : null;
    res.crete_dbfs = pk && pk[1] !== '-inf' ? Number(pk[1]) : null;
  }
  ecrireJson(path.join(D, 'analyse.json'), res);
  m.analyse = {coupes_camera: res.coupes_camera.length, silences: res.silences.length, lufs: res.lufs};
  return true;
}
