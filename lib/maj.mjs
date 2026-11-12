// Dérush — les mises à jour. Pendant la bêta, Dérush est un dossier cloné depuis GitHub (dépôt privé) : « Mettre à
// jour » récupère la dernière version publiée (git pull), puis Dérush redémarre. Rien n'est touché dans les projets,
// les moteurs ou les clés (ils sont ailleurs).
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {RACINE_APP} from './moteurs.mjs';
import {trouverGit} from './plateforme.mjs';
import {lancer} from './outils.mjs';
import {VERSION} from './commun.mjs';

const git = () => process.env.DERUSH_GIT || trouverGit();
const estClone = () => fs.existsSync(path.join(RACINE_APP, '.git'));
let dernier = null; // {le, possible, en_retard, version_distante, notes[], message}

export function etatMaj() {
  return {version: VERSION, clone: estClone(), git: !!git(), ...(dernier ?? {})};
}
const g = async (args) => (await lancer(git(), ['-C', RACINE_APP, ...args], {silenceMax: 90000})).out.toString().trim();

/** Regarde sur GitHub s'il y a une version plus récente (sans rien changer). */
export async function verifierMaj() {
  const le = new Date().toISOString();
  if (!estClone()) {
    dernier = {le, possible: false, message: 'Cette copie de Dérush ne vient pas de GitHub : réinstalle-la avec la commande d’installation pour recevoir les mises à jour.'};
    return etatMaj();
  }
  if (!git()) {
    dernier = {le, possible: false, message: 'Git n’est pas installé sur cet ordinateur : il sert à recevoir les mises à jour.'};
    return etatMaj();
  }
  try {
    await g(['fetch', '--quiet', 'origin']);
    const branche = await g(['rev-parse', '--abbrev-ref', 'HEAD']);
    const enRetard = Number(await g(['rev-list', '--count', `HEAD..origin/${branche}`])) || 0;
    let versionDistante = null;
    try { versionDistante = /VERSION = '([^']+)'/.exec(await g(['show', `origin/${branche}:lib/commun.mjs`]))?.[1] ?? null; } catch { /* fichier déplacé */ }
    const notes = enRetard ? (await g(['log', '--format=%s', '-n', '8', `HEAD..origin/${branche}`])).split('\n').filter(Boolean) : [];
    dernier = {le, possible: true, branche, en_retard: enRetard, version_distante: versionDistante, notes};
  } catch (e) {
    dernier = {le, possible: false, message: `Impossible de joindre GitHub (${String(e.message).split('|')[0].slice(0, 160)}). As-tu bien accès au dépôt de la bêta ?`};
  }
  return etatMaj();
}

/** Installe la dernière version (sans jamais écraser un fichier modifié à la main). */
export async function mettreAJour() {
  if (!estClone() || !git()) throw new Error('Cette copie de Dérush ne peut pas se mettre à jour toute seule.');
  const modifs = await g(['status', '--porcelain', '--untracked-files=no']);
  if (modifs) throw new Error('Des fichiers de Dérush ont été modifiés à la main : la mise à jour ne les écrase pas. Demande à ton IA de régler ça (« git status » dans le dossier de Dérush).');
  const avant = await g(['rev-parse', 'HEAD']);
  await g(['pull', '--ff-only', '--quiet']);
  const apres = await g(['rev-parse', 'HEAD']);
  let version = VERSION;
  try { version = /VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(RACINE_APP, 'lib', 'commun.mjs'), 'utf8'))?.[1] ?? VERSION; } catch { /* illisible */ }
  dernier = {le: new Date().toISOString(), possible: true, en_retard: 0, version_distante: version, notes: []};
  return {ok: true, change: avant !== apres, version};
}

/** Relance Dérush dans un nouveau processus, une fois celui-ci arrêté (après une mise à jour). */
export function redemarrer(args = ['--app']) {
  // dans l'app Mac native : la coque se ferme avec le serveur, puis macOS la rouvre (et son serveur avec elle)
  const paquet = process.env.DERUSH_APP_BUNDLE;
  if (paquet && fs.existsSync(paquet)) {
    spawn('/bin/sh', ['-c', 'sleep 1.6; open -n "$0"', paquet], {detached: true, stdio: 'ignore'}).unref();
    setTimeout(() => process.exit(0), 400);
    return;
  }
  const script = path.join(RACINE_APP, 'derush.mjs');
  const code = `setTimeout(() => require('child_process').spawn(process.execPath, ${JSON.stringify([script, ...args])}, {detached: true, stdio: 'ignore', windowsHide: true}).unref(), 1500)`;
  spawn(process.execPath, ['-e', code], {detached: true, stdio: 'ignore', windowsHide: true}).unref();
  setTimeout(() => process.exit(0), 400);
}
