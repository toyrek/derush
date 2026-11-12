// Dérush — les mises à jour. Dérush est un dossier cloné depuis GitHub : « Mettre à jour » récupère la dernière
// version publiée (git pull), puis Dérush redémarre. Rien n'est touché dans les projets, les moteurs ou les clés
// (ils sont ailleurs).
//
// Dérush regarde tout seul s'il y a du nouveau (peu après son lancement, puis toutes les six heures) et le dit :
// une petite fenêtre dans l'app (public/maj.js), et une phrase de l'IA à la fin de sa réponse (rappelMaj). Une copie
// qui ne vient pas de GitHub (app donnée en zip ou en image disque) est prévenue aussi, mais ne s'installe pas seule.
// Rien n'est envoyé : Dérush lit seulement le dépôt. On l'éteint dans Connexions (réglage « maj_prevenir »).
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {RACINE_APP, DOSSIER_SUPPORT} from './moteurs.mjs';
import {trouverGit} from './plateforme.mjs';
import {lancer} from './outils.mjs';
import {VERSION} from './commun.mjs';
import {lireReglages} from './reglages.mjs';

const git = () => process.env.DERUSH_GIT || trouverGit();
const estClone = () => fs.existsSync(path.join(RACINE_APP, '.git'));
// jamais de question posée dans un terminal que personne ne voit : sans accès, Git échoue tout de suite
const envGit = () => ({...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never'});
const g = async (args, silenceMax = 90000) => (await lancer(git(), ['-C', RACINE_APP, ...args], {silenceMax, env: envGit()})).out.toString().trim();

/** L'adresse du dépôt (package.json), et celle où ses fichiers se lisent tels quels. */
export const DEPOT = (() => {
  try { return String(JSON.parse(fs.readFileSync(path.join(RACINE_APP, 'package.json'), 'utf8')).repository?.url ?? '').replace(/^git\+/, '').replace(/\.git$/, ''); } catch { return ''; }
})() || 'https://github.com/toyrek/derush';
const brut = () => process.env.DERUSH_MAJ_SOURCE || `${DEPOT.replace('https://github.com/', 'https://raw.githubusercontent.com/')}/main`;

// ce que Dérush retient d'une fois sur l'autre (dans son dossier, à côté des réglages)
const fichierEtat = () => path.join(DOSSIER_SUPPORT, 'maj.json');
const lireEtat = () => { try { return JSON.parse(fs.readFileSync(fichierEtat(), 'utf8')); } catch { return {}; } };
function ecrireEtat(champs) {
  const e = {...lireEtat(), ...champs};
  try { fs.mkdirSync(DOSSIER_SUPPORT, {recursive: true}); fs.writeFileSync(fichierEtat(), JSON.stringify(e, null, 2)); } catch { /* dossier en lecture seule : on redira */ }
  return e;
}
const prevenir = () => lireReglages().maj_prevenir !== false;

/** Compare deux numéros de version (« 10.4 », « 10.10.1 ») : négatif, nul ou positif. */
export function comparerVersions(a, b) {
  const nombres = (v) => String(v ?? '').split('.').map((x) => parseInt(x, 10) || 0);
  const pa = nombres(a);
  const pb = nombres(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/**
 * Ce que docs/NOUVEAUTES.md dit des versions plus récentes que `depuis` (et pas plus récentes que `jusqua`) :
 * [{version, titre, resume}], la plus récente d'abord. Chaque version y commence par « **10.4 — Son titre.** ».
 */
export function lireNouveautes(texte, depuis, jusqua = null) {
  const propre = (s) => s.replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
  const phrases = (s) => s.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ«])/).filter(Boolean);
  const court = (s, max = 180) => (s.length <= max ? s : `${s.slice(0, max).replace(/\s+\S*$/, '')}…`);
  const liste = [];
  for (const bloc of String(texte ?? '').split(/\n(?=\*\*)/)) {
    const b = bloc.trim();
    let version;
    let titre = null;
    let corps;
    let m = /^\*\*(\d+(?:\.\d+)+) — ([^*]+?)\.?\*\*\s*([\s\S]*)$/.exec(b);
    if (m) [, version, titre, corps] = m;
    else if ((m = /^\*\*Nouveau dans la version (\d+)\.\*\*\s*([\s\S]*)$/.exec(b))) { version = `${m[1]}.0`; corps = m[2]; }
    else continue;
    if (comparerVersions(version, depuis) <= 0 || (jusqua && comparerVersions(version, jusqua) > 0)) continue;
    const lignes = corps.split('\n');
    const puces = lignes.filter((l) => /^\s*- /.test(l)).map((l) => propre(l.replace(/^\s*- /, '')));
    const suite = propre(lignes.filter((l) => !/^\s*- /.test(l)).join(' '));
    const resume = court(suite ? phrases(suite)[0] ?? suite : puces.slice(0, 2).map((p) => phrases(p)[0] ?? p).join(' '));
    liste.push({version, titre: titre ? propre(titre) : null, resume});
  }
  return liste.sort((x, y) => comparerVersions(y.version, x.version));
}
function nouveautesLocales(depuis) {
  try { return lireNouveautes(fs.readFileSync(path.join(RACINE_APP, 'docs', 'NOUVEAUTES.md'), 'utf8'), depuis, VERSION); } catch { return []; }
}

let dernier = null; // {le, possible, en_retard, version_distante, notes[], nouveautes[], message}
let enCours = null; // une seule vérification à la fois

export function etatMaj() {
  return {version: VERSION, clone: estClone(), git: !!git(), prevenir: prevenir(), ...(dernier ?? {})};
}

/** Une copie qui ne vient pas de GitHub lit la version publiée dans le dépôt, par internet (rien n'est envoyé). */
async function versionEnLigne() {
  const lire = async (chemin) => {
    const r = await fetch(`${brut()}/${chemin}`, {signal: AbortSignal.timeout(8000), headers: {'cache-control': 'no-cache'}});
    if (!r.ok) throw new Error(`réponse ${r.status}`);
    return r.text();
  };
  const version = /VERSION = '([^']+)'/.exec(await lire('lib/commun.mjs'))?.[1] ?? null;
  if (!version) return null;
  let nouveautes = [];
  if (comparerVersions(version, VERSION) > 0) { try { nouveautes = lireNouveautes(await lire('docs/NOUVEAUTES.md'), VERSION, version); } catch { /* pas de notes : on annonce quand même */ } }
  return {version_distante: version, nouveautes};
}

/**
 * Regarde sur GitHub s'il y a une version plus récente (sans rien changer). `auto` : la vérification que Dérush fait
 * tout seul — elle n'attend pas longtemps et, si elle échoue (pas d'internet), elle ne dit rien.
 */
export function verifierMaj({auto = false} = {}) {
  enCours ??= verifier(auto).finally(() => { enCours = null; });
  return enCours;
}
async function verifier(auto) {
  const le = new Date().toISOString();
  if (!estClone() || !git()) {
    const message = !estClone()
      ? 'Cette copie de Dérush ne vient pas de GitHub : pour recevoir les mises à jour d’un clic, réinstalle-la avec le message d’installation.'
      : 'Git n’est pas installé sur cet ordinateur : il sert à recevoir les mises à jour.';
    const loin = await versionEnLigne().catch(() => null);
    if (loin || !auto || !dernier) dernier = {le, possible: false, message, ...(loin ?? {})};
    return etatMaj();
  }
  try {
    await g(['fetch', '--quiet', 'origin'], auto ? 30000 : 90000);
    const branche = await g(['rev-parse', '--abbrev-ref', 'HEAD']);
    const enRetard = Number(await g(['rev-list', '--count', `HEAD..origin/${branche}`])) || 0;
    let versionDistante = null;
    try { versionDistante = /VERSION = '([^']+)'/.exec(await g(['show', `origin/${branche}:lib/commun.mjs`]))?.[1] ?? null; } catch { /* fichier déplacé */ }
    const notes = enRetard ? (await g(['log', '--format=%s', '-n', '8', `HEAD..origin/${branche}`])).split('\n').filter(Boolean) : [];
    let nouveautes = [];
    if (versionDistante && comparerVersions(versionDistante, VERSION) > 0) {
      try { nouveautes = lireNouveautes(await g(['show', `origin/${branche}:docs/NOUVEAUTES.md`]), VERSION, versionDistante); } catch { /* pas de notes : on annonce quand même */ }
    }
    dernier = {le, possible: true, branche, en_retard: enRetard, version_distante: versionDistante, notes, nouveautes};
  } catch (e) {
    if (auto) return etatMaj(); // on garde ce qu'on savait
    dernier = {le, possible: false, message: `Impossible de joindre GitHub (${String(e.message).split('|')[0].slice(0, 160)}). Vérifie ta connexion à internet, puis réessaie.`};
  }
  return etatMaj();
}

/**
 * Ce que la petite fenêtre de l'app montre : une nouvelle version à annoncer (`a_montrer`), ou une version qui vient
 * d'arriver (`arrivee`, à la première ouverture après une mise à jour).
 */
export function resumeMaj() {
  const e = lireEtat();
  const distante = dernier?.version_distante ?? null;
  const disponible = !!distante && comparerVersions(distante, VERSION) > 0;
  const attend = disponible && e.plus_tard?.version === distante && Date.now() < Date.parse(e.plus_tard.jusqu_a ?? 0);
  const arrivee = e.lancee && comparerVersions(VERSION, e.lancee) > 0 ? {version: VERSION, depuis: e.lancee, nouveautes: nouveautesLocales(e.lancee)} : null;
  return {
    version: VERSION, disponible, version_distante: disponible ? distante : null, nouveautes: disponible ? dernier.nouveautes ?? [] : [],
    peut_installer: estClone() && !!git() && dernier?.possible !== false,
    a_montrer: disponible && !attend && prevenir(), arrivee, depot: DEPOT,
  };
}
/** « Plus tard » : on n'en reparle pas avant demain (vingt heures), même si Dérush est relancé entre-temps. */
export function plusTard() {
  const v = dernier?.version_distante;
  if (v) ecrireEtat({plus_tard: {version: v, jusqu_a: new Date(Date.now() + 20 * 3600e3).toISOString()}});
  return resumeMaj();
}
/** La personne a vu ce que la nouvelle version apporte : on ne le redit plus. */
export function marquerVue() {
  ecrireEtat({lancee: VERSION});
  return resumeMaj();
}

/**
 * La phrase glissée dans la demande à l'IA quand une nouvelle version attend : l'IA la dit à la fin de sa réponse.
 * Une seule fois par version (la petite fenêtre, elle, revient chaque jour).
 */
export function rappelMaj() {
  const r = resumeMaj();
  if (!r.disponible || !prevenir() || lireEtat().ia?.version === r.version_distante) return '';
  ecrireEtat({ia: {version: r.version_distante, le: new Date().toISOString()}});
  const quoi = r.nouveautes[0]?.titre ? ` (${r.nouveautes[0].titre})` : '';
  const comment = r.peut_installer
    ? 'que je peux l’installer d’un clic, avec le bouton « Mettre à jour » de Dérush ou dans Connexions'
    : 'que je peux l’installer en recollant le message d’installation de Dérush à mon IA';
  return `\n(Une nouvelle version de Dérush est sortie : la ${r.version_distante}${quoi}. Termine ta réponse par une phrase qui me le dit, et rappelle-moi ${comment}. Ne l’installe pas toi-même et ne touche pas au dossier de Dérush.)`;
}

/** Dérush regarde tout seul s'il y a du nouveau : peu après son lancement, puis toutes les six heures. */
export function programmerMaj() {
  const e = lireEtat();
  // la dernière version ouverte sur cet ordinateur : elle sert à dire, après une mise à jour, ce qui vient d'arriver
  if (!e.lancee || comparerVersions(VERSION, e.lancee) < 0) ecrireEtat({lancee: VERSION});
  if (process.env.DERUSH_SANS_MAJ === '1') return;
  const regarder = () => { if (prevenir()) verifierMaj({auto: true}).catch(() => {}); };
  setTimeout(regarder, Number(process.env.DERUSH_MAJ_DELAI_MS) || 6000).unref?.();
  setInterval(regarder, 6 * 3600e3).unref?.();
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
  dernier = {le: new Date().toISOString(), possible: true, en_retard: 0, version_distante: version, notes: [], nouveautes: []};
  return {ok: true, change: avant !== apres, version};
}

/** Relance Dérush dans un nouveau processus, une fois celui-ci arrêté (après une mise à jour), avec les mêmes options. */
export function redemarrer(args = process.argv.slice(2)) {
  // dans l'app Mac native : la coque se ferme avec le serveur, puis macOS la rouvre (et son serveur avec elle)
  const paquet = process.env.DERUSH_APP_BUNDLE;
  if (paquet && fs.existsSync(paquet)) {
    // une app lancée avec ses propres dossiers (un essai) revient avec les mêmes ; pilotée sans fenêtre, elle le reste
    const garder = Object.entries(process.env).filter(([k, v]) => /^DERUSH_(SUPPORT|BIBLIOTHEQUE|COQUE_PILOTE|GIT|MAJ_SOURCE|MAJ_DELAI_MS)$/.test(k) && v);
    const options = [...(process.env.DERUSH_COQUE_PILOTE ? ['-g', '-j'] : []), ...garder.flatMap(([k, v]) => ['--env', `${k}=${v}`])];
    spawn('/bin/sh', ['-c', 'app="$0"; sleep 1.6; exec open -n "$@" "$app"', paquet, ...options], {detached: true, stdio: 'ignore'}).unref();
    setTimeout(() => process.exit(0), 400);
    return;
  }
  const script = path.join(RACINE_APP, 'derush.mjs');
  const code = `setTimeout(() => require('child_process').spawn(process.execPath, ${JSON.stringify([script, ...args])}, {detached: true, stdio: 'ignore', windowsHide: true}).unref(), 1500)`;
  spawn(process.execPath, ['-e', code], {detached: true, stdio: 'ignore', windowsHide: true}).unref();
  setTimeout(() => process.exit(0), 400);
}
