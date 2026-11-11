// Dérush — lancement de FFmpeg / FFprobe, file d'attente des tâches, petits utilitaires fichiers.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {avecShell, POLICES_SYSTEME} from './plateforme.mjs';

export const FFMPEG = process.env.DERUSH_FFMPEG || 'ffmpeg';
export const FFPROBE = process.env.DERUSH_FFPROBE || 'ffprobe';

// Police pour les textes incrustés par FFmpeg (vignettes, storyboard). Chemins sans « : » ni « , ».
const POLICES = [
  process.env.DERUSH_POLICE,
  ...POLICES_SYSTEME.normale,
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/Library/Fonts/Arial.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/TTF/DejaVuSans.ttf',
  'C:/Windows/Fonts/arial.ttf',
];
const POLICES_GRAS = [
  process.env.DERUSH_POLICE_GRAS,
  ...POLICES_SYSTEME.grasse,
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/Library/Fonts/Arial Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
];
export const POLICE = POLICES.find((p) => p && fs.existsSync(p)) ?? null;
export const POLICE_GRAS = POLICES_GRAS.find((p) => p && fs.existsSync(p)) ?? POLICE;

/**
 * Lance une commande et attend sa fin. Rejette avec la fin de la sortie d'erreur si le code de retour n'est pas 0.
 * surStdout / surStderr reçoivent la sortie au fil de l'eau (utile pour les longs traitements).
 */
export function lancer(cmd, args, {surStdout, surStderr, cwd, env, silenceMax = 0} = {}) {
  return new Promise((ok, ko) => {
    const p = spawn(cmd, args, {stdio: ['ignore', 'pipe', 'pipe'], cwd, env: env ?? process.env, shell: avecShell(cmd), windowsHide: true});
    const morceaux = [];
    let err = '';
    // garde-fou : un programme qui ne dit plus rien pendant silenceMax ms est considéré comme bloqué
    let bloque = false;
    let minuteur = null;
    const reveil = () => {
      if (!silenceMax) return;
      clearTimeout(minuteur);
      minuteur = setTimeout(() => { bloque = true; p.kill('SIGKILL'); }, silenceMax);
    };
    reveil();
    p.stdout.on('data', (d) => { reveil(); if (surStdout) surStdout(d); else morceaux.push(d); });
    p.stderr.on('data', (d) => {
      reveil();
      const s = d.toString();
      surStderr?.(s);
      err += s;
      if (err.length > 400000) err = err.slice(-200000);
    });
    p.on('error', (e) => { clearTimeout(minuteur); ko(new Error(`Impossible de lancer ${cmd} : ${e.message}`)); });
    p.on('close', (code) => {
      clearTimeout(minuteur);
      if (bloque) return ko(new Error(`${path.basename(cmd)} ne répondait plus depuis ${Math.round(silenceMax / 1000)} s : arrêté.`));
      if (code === 0) ok({out: Buffer.concat(morceaux), err});
      else ko(new Error(`${path.basename(cmd)} a échoué (code ${code}) : ${err.trim().split('\n').slice(-6).join(' | ')}`));
    });
  });
}

/** FFmpeg avec suivi de progression (0 → 1) calculé sur la durée attendue. */
export function ffmpeg(args, {duree = 0, prog, surStderr, silenceMax = 0} = {}) {
  let tampon = '';
  return lancer(FFMPEG, ['-hide_banner', '-nostats', '-progress', 'pipe:1', ...args], {
    surStderr,
    silenceMax,
    surStdout: (d) => {
      tampon += d.toString();
      const lignes = tampon.split('\n');
      tampon = lignes.pop();
      for (const l of lignes) {
        const m = /^out_time_us=(\d+)/.exec(l);
        if (m && duree > 0 && prog) prog(Math.min(0.999, Number(m[1]) / 1e6 / duree));
      }
    },
  });
}

/** Une commande est-elle disponible dans le PATH ? */
export async function existe(cmd) {
  try {
    await lancer(cmd, ['-h']);
    return true;
  } catch (e) {
    return !/Impossible de lancer/.test(e.message);
  }
}

/** Écrit un JSON sans risque de fichier à moitié écrit (écriture puis renommage). */
export function ecrireJson(fichier, data, indent = 1) {
  fs.mkdirSync(path.dirname(fichier), {recursive: true});
  const tmp = `${fichier}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, indent));
  fs.renameSync(tmp, fichier);
}

export function lireJson(fichier, defaut = null) {
  try {
    return JSON.parse(fs.readFileSync(fichier, 'utf8'));
  } catch {
    return defaut;
  }
}

/** Taille lisible : « 12,4 Mo ». */
export function tailleLisible(o) {
  if (!Number.isFinite(o)) return '—';
  const u = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let i = 0;
  while (o >= 1000 && i < u.length - 1) { o /= 1000; i++; }
  return `${(Math.round(o * 10) / 10).toLocaleString('fr-FR')} ${u[i]}`;
}

/** Taille totale d'un dossier. */
export function tailleDossier(d) {
  let t = 0;
  for (const e of fs.readdirSync(d, {withFileTypes: true})) {
    const p = path.join(d, e.name);
    t += e.isDirectory() ? tailleDossier(p) : fs.statSync(p).size;
  }
  return t;
}

/**
 * File d'attente : une tâche à la fois (les traitements vidéo prennent déjà tous les cœurs).
 * Chaque tâche reçoit une fonction prog(0..1) pour signaler son avancement.
 */
export class FileDAttente {
  constructor() {
    this.attente = [];
    this.enCours = null;
    this.recents = [];
    this.n = 0;
    this.ecouteurs = new Set();
  }

  ajouter(nom, fn, meta = {}) {
    const t = {id: ++this.n, nom, etat: 'attente', progression: 0, meta, fn};
    this.attente.push(t);
    this.suivante();
    return t;
  }

  async suivante() {
    if (this.enCours || !this.attente.length) return;
    const t = (this.enCours = this.attente.shift());
    t.etat = 'en cours';
    t.debut = Date.now();
    try {
      t.resultat = await t.fn((p) => { t.progression = p; });
      t.etat = 'fini';
      t.progression = 1;
    } catch (e) {
      t.etat = 'erreur';
      t.erreur = e.message;
      console.error(`[${t.nom}]`, e.message);
    }
    t.fin = Date.now();
    this.recents.unshift(t);
    this.recents.length = Math.min(this.recents.length, 30);
    this.enCours = null;
    for (const f of this.ecouteurs) f(t);
    this.suivante();
  }

  /** Attend que la file soit vide (pour la ligne de commande). */
  vide() {
    return new Promise((ok) => {
      const verif = () => (!this.enCours && !this.attente.length ? ok() : setTimeout(verif, 200));
      verif();
    });
  }

  etat() {
    const vue = (t) => ({id: t.id, nom: t.nom, etat: t.etat, progression: Math.round(t.progression * 1000) / 1000, erreur: t.erreur, meta: t.meta, resultat: t.etat === 'fini' ? t.resultat : undefined, duree_s: t.fin ? Math.round((t.fin - t.debut) / 100) / 10 : undefined});
    return {en_cours: this.enCours ? vue(this.enCours) : null, attente: this.attente.map(vue), recents: this.recents.map(vue)};
  }
}
