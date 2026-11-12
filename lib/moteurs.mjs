// Dérush — moteurs qui tournent sur le Mac : Whisper (texte), Demucs (voix), Apple Vision (recadrage et détourage).
// Ils s'installent une fois dans ~/Library/Application Support/Dérush (rien n'est mis dans les projets).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {lancer, FFMPEG, FFPROBE} from './outils.mjs';
import {MAC, WINDOWS, SYSTEME, NOM_SYSTEME, dossierSupport, trouver} from './plateforme.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
export const RACINE_APP = path.join(ICI, '..');
export const DOSSIER_SUPPORT = dossierSupport();
const VENV = path.join(DOSSIER_SUPPORT, 'moteurs', 'python');
export const PYTHON = WINDOWS ? path.join(VENV, 'Scripts', 'python.exe') : path.join(VENV, 'bin', 'python');
// Whisper : MLX sur les Mac à puce Apple (le plus rapide), faster-whisper partout ailleurs (Windows, Linux, Mac Intel)
export const WHISPER_MLX = MAC && os.arch() === 'arm64';
export const MODELE_WHISPER = process.env.DERUSH_MODELE_WHISPER || (WHISPER_MLX ? 'mlx-community/whisper-large-v3-turbo' : 'large-v3-turbo');
const DEPOT_MODELE = WHISPER_MLX ? MODELE_WHISPER : 'mobiuslabsgmbh/faster-whisper-large-v3-turbo';
const HF = process.env.HF_HOME ? path.join(process.env.HF_HOME, 'hub') : path.join(os.homedir(), '.cache', 'huggingface', 'hub');
const VISION = path.join(RACINE_APP, 'bin', 'derush-vision');

export function uv() {
  const exe = WINDOWS ? 'uv.exe' : 'uv';
  for (const c of [process.env.DERUSH_UV, path.join(os.homedir(), '.local', 'bin', exe), path.join(os.homedir(), '.cargo', 'bin', exe), '/opt/homebrew/bin/uv', '/usr/local/bin/uv']) if (c && fs.existsSync(c)) return c;
  return trouver('uv');
}

/**
 * L'environnement pour lancer uv. Si son cache habituel est inutilisable (un lien vers un disque débranché, par
 * exemple), uv s'arrête avant d'avoir rien fait : on lui donne alors un cache dans le dossier de Dérush.
 */
export function envUv() {
  if (process.env.UV_CACHE_DIR) return process.env;
  const defaut = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'uv');
  try { fs.lstatSync(defaut); } catch { return process.env; } // pas encore de cache : uv le créera
  try { fs.statSync(defaut); return process.env; } catch { return {...process.env, UV_CACHE_DIR: path.join(DOSSIER_SUPPORT, 'cache-uv')}; }
}

function modeleWhisperPresent() {
  const d = path.join(HF, `models--${DEPOT_MODELE.replace('/', '--')}`, 'snapshots');
  try {
    return fs.readdirSync(d).some((s) => ['weights.safetensors', 'weights.npz', 'model.safetensors', 'model.bin'].some((f) => fs.existsSync(path.join(d, s, f))));
  } catch {
    return false;
  }
}

let memo = {t: 0, v: null};
async function modules() {
  if (memo.v && Date.now() - memo.t < 30000) return memo.v;
  const v = {mlx_whisper: false, demucs: false, detourage: false};
  if (fs.existsSync(PYTHON)) {
    try {
      const {out} = await lancer(PYTHON, ['-c', 'import importlib.util as u; print(",".join(n for n in ["mlx_whisper", "faster_whisper", "demucs", "soundfile", "Vision", "PIL", "numpy"] if u.find_spec(n)))']);
      const s = out.toString().trim().split(',');
      v.mlx_whisper = s.includes(WHISPER_MLX ? 'mlx_whisper' : 'faster_whisper');
      v.demucs = s.includes('demucs') && s.includes('soundfile');
      v.detourage = s.includes('Vision') && s.includes('PIL') && s.includes('numpy');
    } catch { /* environnement abîmé : on proposera de réinstaller */ }
  }
  memo = {t: Date.now(), v};
  return v;
}

/** L'outil Apple Vision : déjà compilé, ou compilé à la volée si les outils de développement Apple sont là. */
export async function binVision() {
  if (!MAC) return null; // Apple Vision n'existe que sur macOS
  if (fs.existsSync(VISION)) return VISION;
  fs.mkdirSync(path.dirname(VISION), {recursive: true});
  for (const dev of ['/Library/Developer/CommandLineTools', null]) {
    try {
      await lancer('/usr/bin/swiftc', ['-O', path.join(RACINE_APP, 'outils', 'vision.swift'), '-o', VISION], {env: dev ? {...process.env, DEVELOPER_DIR: dev} : process.env});
      return VISION;
    } catch { /* on essaie autrement */ }
  }
  return null;
}

/** État de chaque moteur, avec une phrase simple quand il n'est pas prêt. */
export async function etatMoteurs() {
  const m = await modules();
  const peutInstaller = !!uv();
  const surMac = (x) => (MAC ? x : {ok: false, installable: false, nom: x.nom, pourquoi: `Sur Mac seulement (Apple Vision). Sous ${NOM_SYSTEME}, Dérush recadre au centre.`});
  return {
    whisper: m.mlx_whisper && modeleWhisperPresent()
      ? {ok: true, nom: 'Whisper large-v3-turbo', detail: WHISPER_MLX ? 'Sur ton Mac, gratuit, accéléré par la puce Apple.' : 'Sur ton ordinateur, gratuit (faster-whisper).'}
      : {ok: false, installable: peutInstaller, taille: '1,7 Go', nom: 'Whisper', pourquoi: m.mlx_whisper ? 'Le modèle Whisper n’est pas encore téléchargé.' : 'Whisper n’est pas encore installé.'},
    voix: m.demucs
      ? {ok: true, nom: 'Demucs (htdemucs)', detail: 'Sépare la voix de la musique et du bruit, sur ton ordinateur.'}
      : {ok: false, installable: peutInstaller, taille: '450 Mo', nom: 'Demucs', pourquoi: 'La séparation de la voix n’est pas encore installée.'},
    detourage: !MAC ? surMac({nom: 'Détourage'}) : m.detourage
      ? {ok: true, nom: 'Détourage (Apple Vision)', detail: 'Détoure la personne filmée, pour passer un titre derrière elle. Sur ton Mac.'}
      : {ok: false, installable: peutInstaller, taille: '40 Mo', nom: 'Détourage', pourquoi: 'Le détourage de la personne n’est pas encore installé.'},
    vision: !MAC ? surMac({nom: 'Apple Vision'}) : fs.existsSync(VISION)
      ? {ok: true, nom: 'Apple Vision', detail: 'Repère visages et sujets pour le recadrage. Intégré à macOS.'}
      : {ok: false, installable: false, nom: 'Apple Vision', pourquoi: 'L’outil de recadrage n’a pas pu être préparé sur cet ordinateur.'},
  };
}

/** Installe un moteur (whisper, voix ou detourage) : environnement Python isolé, paquets, puis modèle s'il en faut un. */
export async function installer(nom, prog = () => {}) {
  const u = uv();
  if (!u) throw new Error('L’outil « uv » est introuvable : installe-le (https://docs.astral.sh/uv/) puis réessaie.');
  if (nom === 'detourage' && !MAC) throw new Error('Le détourage utilise Apple Vision : il n’existe que sur Mac.');
  fs.mkdirSync(path.dirname(VENV), {recursive: true});
  if (!fs.existsSync(PYTHON)) {
    prog(0.02);
    await lancer(u, ['venv', '--python', '3.12', VENV], {env: envUv()});
  }
  prog(0.06);
  const paquets = {whisper: [WHISPER_MLX ? 'mlx-whisper' : 'faster-whisper'], voix: ['demucs', 'soundfile'], detourage: ['pyobjc-framework-Vision', 'pyobjc-framework-Quartz', 'pillow', 'numpy'], outils: ['pillow', 'numpy']}[nom];
  if (!paquets) throw new Error(`Moteur inconnu : ${nom}.`);
  await lancer(u, ['pip', 'install', '--python', PYTHON, ...paquets], {env: envUv()});
  memo.t = 0;
  prog(0.3);
  const suivre = (s) => {
    for (const x of s.matchAll(/(\d+)%\|/g)) prog(0.3 + (Number(x[1]) / 100) * 0.69);
  };
  if (nom === 'whisper') await lancer(PYTHON, ['-c', `from huggingface_hub import snapshot_download; snapshot_download("${DEPOT_MODELE}")`], {surStderr: suivre});
  else if (nom === 'voix') await lancer(PYTHON, ['-c', 'from demucs.pretrained import get_model; get_model("htdemucs")'], {surStderr: suivre});
  memo.t = 0;
  return etatMoteurs();
}

/** Lance un script Python de Dérush ; il écrit « progress=NN% » sur sa sortie d'erreur. */
export function lancerPython(script, args, prog) {
  return lancer(PYTHON, [path.join(RACINE_APP, 'outils', script), ...args], {
    env: {...process.env, DERUSH_FFMPEG: FFMPEG, DERUSH_FFPROBE: FFPROBE, PYTHONUNBUFFERED: '1', TOKENIZERS_PARALLELISM: 'false'},
    surStderr: (s) => {
      for (const x of s.matchAll(/progress=(\d+)%/g)) prog?.(Number(x[1]) / 100);
    },
  });
}

let memoBlender = null;
export const oublierBlender = () => { memoBlender = null; };
/**
 * Blender, pour la 3D réaliste. On garde son vrai chemin : appelé par un lien (~/.local/bin/blender…),
 * il cherche ses fichiers à côté du lien et ne démarre pas.
 */
export async function etatBlender() {
  if (memoBlender) return memoBlender;
  const apps = [];
  const lister = (d, re, sous) => { try { for (const f of fs.readdirSync(d)) if (re.test(f)) apps.push(path.join(d, f, ...sous)); } catch { /* dossier absent */ } };
  if (MAC) for (const d of ['/Applications', path.join(os.homedir(), 'Applications')]) lister(d, /^Blender.*\.app$/i, ['Contents', 'MacOS', 'Blender']);
  if (WINDOWS) for (const b of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']].filter(Boolean)) lister(path.join(b, 'Blender Foundation'), /^Blender/i, ['blender.exe']);
  const candidats = [process.env.DERUSH_BLENDER, ...apps, '/opt/homebrew/bin/blender', '/usr/local/bin/blender', '/snap/bin/blender', '/usr/bin/blender',
    path.join(os.homedir(), '.local', 'share', 'flatpak', 'exports', 'bin', 'org.blender.Blender'), '/var/lib/flatpak/exports/bin/org.blender.Blender', trouver('blender')].filter((c) => c && fs.existsSync(c));
  let mieux = null;
  for (const c of candidats) {
    try {
      const reel = fs.realpathSync(c);
      const {out} = await lancer(reel, ['--version'], {silenceMax: 20000});
      const version = /Blender (\d+\.\d+(?:\.\d+)?)/.exec(out.toString())?.[1];
      if (version && (!mieux || version.localeCompare(mieux.version, undefined, {numeric: true}) > 0)) mieux = {chemin: reel, version};
    } catch { /* celui-ci ne se lance pas : on passe au suivant */ }
  }
  memoBlender = mieux
    ? {ok: true, ...mieux, nom: `Blender ${mieux.version}`, detail: `Blender ${mieux.version}. L’IA s’en sert pour la 3D réaliste.`}
    : {ok: false, installable: true, pourquoi: 'Blender n’est pas installé : l’IA fait la 3D dans la page (Three.js). Pour une 3D réaliste, installe Blender.'};
  return memoBlender;
}
