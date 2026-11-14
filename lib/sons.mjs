// Dérush — de vrais sons pour les vidéos.
// Trois outils, donnés à l'IA quand l'interrupteur « Vrais sons » de Connexions est allumé :
// - la bibliothèque de sons libres (Musique › Sons, ou le réglage sons_dossier), remplie avec la compétence
//   sons-openverse (API Openverse, sans clé) : un dossier par type, CREDITS.md, catalog.csv. Elle est reliée dans le
//   dossier de travail de l'IA (sons/), jamais copiée ;
// - Real SFX (github.com/Clipwing/skills) : pose de vrais sons à l'image près. Dérush ne le livre pas : il le
//   télécharge chez l'utilisateur, à la version examinée. Sa configuration, son index et ses goûts sont rangés dans le
//   dossier de Dérush (variables REAL_SFX_*) : son propre dossier n'est jamais modifié ;
// - Earshot (github.com/Leonxlnx/earshot) : écouter, choisir, fabriquer des sons en code. Facultatif (2,5 Go avec ses
//   deux modèles). Installé dans les moteurs de Dérush, ou repris s'il est déjà sur l'ordinateur. « earshot llm »
//   (qui envoie le son à Google) est coupé.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RACINE_APP, DOSSIER_SUPPORT, uv, envUv} from './moteurs.mjs';
import {MAC, WINDOWS, dossierMusique, lier, delier, trouver, cheminCmd, texteCmd} from './plateforme.mjs';
import {lancer, lireJson, ecrireJson} from './outils.mjs';
import {lireReglages, changerReglages} from './reglages.mjs';
import {envOutils} from './ia.mjs';
import {DOSSIER_TELECHARGE, DOSSIER_COMMANDES, pythonPourIA, oublierCompetences} from './competences.mjs';

const EXT = new Set(['.wav', '.mp3', '.flac', '.aif', '.aiff', '.ogg', '.m4a', '.aac', '.opus']);
/** Ce que Dérush range pour les sons : ce qu'il sait d'Earshot, la signature de l'index, les bruitages refaits. Une IA n'y écrit pas. */
export const DOSSIER_ETAT_SONS = path.join(DOSSIER_SUPPORT, 'sons');
/**
 * Ce que Real SFX écrit lui-même (sa configuration, son index, ses goûts) : le seul dossier d'état donné en écriture à
 * une IA en bac à sable. Ce que Dérush croit sur parole (où Earshot range ses modèles) n'y est jamais : une IA qui
 * pouvait réécrire ce fichier se faisait ouvrir en écriture le dossier qu'elle y mettait, jusqu'au dossier personnel.
 */
const DOSSIER_ETAT_REALSFX = path.join(DOSSIER_ETAT_SONS, 'real-sfx');
const DOSSIER_REALSFX = path.join(DOSSIER_TELECHARGE, 'real-sfx');
const DOSSIER_SKILL_EARSHOT = path.join(DOSSIER_TELECHARGE, 'earshot');
const MOTEUR_EARSHOT = path.join(DOSSIER_SUPPORT, 'moteurs', 'earshot');
const SCRIPT_OPENVERSE = path.join(RACINE_APP, 'competences', 'sons-openverse', 'scripts', 'openverse.py');
/**
 * Les versions examinées : Dérush télécharge exactement celles-là (pour en changer, relire le code d'abord). Chacune est
 * désignée par son commit : une étiquette (« v0.4.1 ») peut être déplacée par l'auteur ou par qui prend son compte.
 */
export const VERSIONS_SONS = {
  realsfx: {depot: 'Clipwing/skills', commit: 'edbefcbc3474869e6cc1e8a7ca583b0efd0dab7e', dossier: 'skills/real-sfx'},
  earshot: {depot: 'Leonxlnx/earshot', version: 'v0.4.1', commit: '4ac3d2ac2b151e1c23376f9ce7f3047a17050013'},
};
const F = {
  config: path.join(DOSSIER_ETAT_REALSFX, 'real-sfx-config.json'),
  index: path.join(DOSSIER_ETAT_REALSFX, 'real-sfx-index.json'),
  gouts: path.join(DOSSIER_ETAT_REALSFX, 'real-sfx-gouts.json'),
  ambiances: path.join(DOSSIER_ETAT_REALSFX, 'real-sfx-ambiances.json'),
  etat: path.join(DOSSIER_ETAT_SONS, 'etat.json'),
  // (l'ancien « earshot.json », qu'une IA en bac à sable pouvait réécrire, n'est plus lu)
  earshot: path.join(DOSSIER_ETAT_SONS, 'etat-earshot.json'),
};
/** Les outils d'autres auteurs lancés par Dérush lui-même ne reçoivent aucune des clés qu'il garde (ElevenLabs, Treg, Google). */
function envTiers() {
  const env = envOutils();
  for (const k of ['ELEVENLABS_API_KEY', 'TREG_TOKEN', 'GEMINI_API_KEY', 'GOOGLE_API_KEY']) delete env[k];
  return env;
}

// ——— la bibliothèque ———
/** Le dossier de la bibliothèque de sons. */
export const dossierSons = () => process.env.DERUSH_SONS || lireReglages().sons_dossier || path.join(dossierMusique(), 'Sons');
/** Le nom du dossier tel que la personne le voit (« Musique › Sons »). */
function nomLisible(d) {
  const rel = path.relative(os.homedir(), d);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return d;
  const fr = {Music: 'Musique', Movies: 'Vidéos', Videos: 'Vidéos', Desktop: 'Bureau', Downloads: 'Téléchargements'};
  return rel.split(path.sep).map((x, i) => (i === 0 ? fr[x] ?? x : x)).join(' › ');
}
/** Là où la compétence sons-openverse compte ses appels (le même endroit que hors de Dérush : une seule limite par jour). */
const etatOpenverse = () => (MAC ? path.join(os.homedir(), 'Library', 'Application Support', 'sons-openverse')
  : WINDOWS ? path.join(process.env.APPDATA || os.homedir(), 'sons-openverse')
    : path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'), 'sons-openverse'));

let memoCompte = {t: 0, v: null};
/** Combien de sons, par type (le premier dossier), et une signature qui change dès que la bibliothèque change. */
function compter(force = false) {
  // « force » : un compte de moins d'une seconde suffit (etatSons vient de le faire, juste avant l'index)
  if (memoCompte.v && Date.now() - memoCompte.t < (force ? 1000 : 15000)) return memoCompte.v;
  const racine = dossierSons();
  const types = {};
  let nombre = 0;
  let recent = 0;
  const visiter = (d, prof) => {
    let noms = [];
    try { noms = fs.readdirSync(d, {withFileTypes: true}); } catch { return; }
    // la signature se lit sur les dossiers, pas sur chaque fichier : un son ajouté, retiré ou renommé change la date
    // de son dossier (20 000 sons : 20 000 lectures de moins, à chaque fois)
    try { recent = Math.max(recent, fs.statSync(d).mtimeMs); } catch { /* dossier parti entre-temps */ }
    for (const n of noms) {
      if (n.name.startsWith('.')) continue;
      const f = path.join(d, n.name);
      if (n.isDirectory()) { if (prof < 4) visiter(f, prof + 1); continue; }
      if (!EXT.has(path.extname(n.name).toLowerCase())) continue;
      nombre++;
      const t = prof ? path.relative(racine, d).split(path.sep)[0] : 'divers';
      types[t] = (types[t] ?? 0) + 1;
    }
  };
  visiter(racine, 0);
  let catalogue = 0;
  try { catalogue = fs.statSync(path.join(racine, 'catalog.csv')).mtimeMs; } catch { /* pas de catalogue */ }
  memoCompte = {t: Date.now(), v: {nombre, types, signature: `${racine}|${nombre}|${Math.round(recent)}|${Math.round(catalogue)}`}};
  return memoCompte.v;
}

// ——— Real SFX ———
const etatRealSfx = () => (fs.existsSync(path.join(DOSSIER_REALSFX, 'scripts', 'mix.py')) && fs.existsSync(path.join(DOSSIER_REALSFX, 'SKILL.md'))
  ? {ok: true, version: VERSIONS_SONS.realsfx.commit.slice(0, 7)}
  : {ok: false, installable: true, taille: '9 Mo', pourquoi: 'Real SFX n’est pas encore téléchargé.'});
const envRealSfx = () => ({DERUSH_REALSFX: DOSSIER_REALSFX, REAL_SFX_CONFIG: F.config, REAL_SFX_INDEX: F.index, REAL_SFX_TASTE: F.gouts, REAL_SFX_STEADY: F.ambiances});
/**
 * Le dossier d'état de Real SFX : un vrai dossier (jamais un lien posé là), où passent une fois les fichiers rangés
 * avant dans sons/ (l'index et les goûts sont gardés). Une IA en bac à sable écrit dans ce dossier ; Dérush, lui, y
 * écrit hors de tout bac à sable (la configuration, l'index refait avant chaque demande). Un de ces fichiers changé en
 * lien (ou en second nom d'un autre fichier) ferait écrire Dérush ailleurs, jusqu'à ~/.zshrc : le lien est retiré.
 */
function rangerEtatRealSfx() {
  try {
    try { if (fs.lstatSync(DOSSIER_ETAT_REALSFX).isSymbolicLink()) fs.unlinkSync(DOSSIER_ETAT_REALSFX); } catch { /* pas encore là */ }
    fs.mkdirSync(DOSSIER_ETAT_REALSFX, {recursive: true});
    for (const f of [F.config, F.index, F.gouts, F.ambiances]) {
      try {
        const st = fs.lstatSync(f);
        if (st.isSymbolicLink() || (st.isFile() && st.nlink > 1)) fs.unlinkSync(f);
      } catch { /* pas encore là */ }
      const ancien = path.join(DOSSIER_ETAT_SONS, path.basename(f));
      try { if (!fs.existsSync(f) && fs.lstatSync(ancien).isFile()) fs.renameSync(ancien, f); } catch { /* rien à déplacer */ }
    }
  } catch { /* dossier de Dérush en lecture seule */ }
}
/** La configuration de Real SFX : une seule bibliothèque (celle de la personne), plus ses sons d'interface fournis. */
function configRealSfx() {
  const cfg = {libraries: [{name: 'main', path: dossierSons(), tier: 'main'}], uisfx: {path: 'vendor/node_modules/uisfx', default_pack: 'studio'}, skip_dir_names: [], index_path: F.index};
  const texte = JSON.stringify(cfg, null, 1);
  rangerEtatRealSfx();
  let avant = '';
  try { avant = fs.readFileSync(F.config, 'utf8'); } catch { /* première fois */ }
  if (avant !== texte) fs.writeFileSync(F.config, texte);
}
/** Refait l'index de Real SFX quand la bibliothèque a changé. Renvoie true s'il a été refait. */
export async function indexerSons(noter = () => {}) {
  if (!etatRealSfx().ok) return false;
  const py = pythonPourIA();
  if (!py) return false;
  configRealSfx();
  const {signature} = compter(true);
  const note = lireJson(F.etat, {}) ?? {};
  if (note.signature === signature && fs.existsSync(F.index)) return false;
  noter();
  await lancer(py, [path.join(DOSSIER_REALSFX, 'scripts', 'build_index.py')], {env: {...envTiers(), ...envRealSfx(), PYTHONUTF8: '1'}, silenceMax: 900000});
  ecrireJson(F.etat, {...note, signature});
  return true;
}
/** Télécharge Real SFX depuis son dépôt officiel, à la version examinée (à l'installation, ou depuis Connexions). */
export async function telechargerRealSfx() {
  const v = VERSIONS_SONS.realsfx;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-realsfx-'));
  try {
    const archive = path.join(tmp, 'depot.tar.gz');
    const r = await fetch(`https://codeload.github.com/${v.depot}/tar.gz/${v.commit}`, {redirect: 'follow'});
    if (!r.ok) throw new Error(`Le dépôt de Real SFX ne répond pas (${r.status}).`);
    fs.writeFileSync(archive, Buffer.from(await r.arrayBuffer()));
    const sortie = path.join(tmp, 'x');
    fs.mkdirSync(sortie);
    await lancer('tar', ['-xzf', archive, '-C', sortie]);
    const source = path.join(sortie, fs.readdirSync(sortie)[0], ...v.dossier.split('/'));
    if (!fs.existsSync(path.join(source, 'SKILL.md')) || !fs.existsSync(path.join(source, 'scripts', 'mix.py'))) throw new Error('Real SFX est introuvable dans l’archive téléchargée.');
    fs.rmSync(DOSSIER_REALSFX, {recursive: true, force: true});
    fs.mkdirSync(DOSSIER_TELECHARGE, {recursive: true});
    fs.cpSync(source, DOSSIER_REALSFX, {recursive: true});
    fs.writeFileSync(path.join(DOSSIER_REALSFX, 'SOURCE.md'), `# Provenance\n\n- Source : https://github.com/${v.depot}/tree/${v.commit}/${v.dossier}, téléchargée le ${new Date().toISOString().slice(0, 10)} sur cet ordinateur.\n- Licences (d'après son README) : scripts sous licence MIT ; sons d'interface uisfx : code MIT, sons CC0. Fait par Alexander Korbanov (Clipwing).\n- Dérush ne le livre pas : il le télécharge chez toi, à la version qu'il a examinée, et ne modifie pas ce dossier (sa configuration et son index sont rangés dans le dossier de Dérush).\n`);
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
  oublierCompetences();
  try { fs.rmSync(F.etat, {force: true}); } catch { /* pas d'index à oublier */ }
  return etatRealSfx();
}

// ——— Earshot ———
let memoEarshot = {t: 0, v: null};
export const oublierEarshot = () => { memoEarshot.t = 0; };
const exeEarshot = WINDOWS ? path.join('Scripts', 'earshot.exe') : path.join('bin', 'earshot');
/** Earshot : celui de Dérush, sinon celui que l'ordinateur a déjà (dans le PATH, ou un clone dans le dossier personnel). */
function cheminEarshot() {
  const maison = os.homedir();
  // DERUSH_EARSHOT=derush : ne regarder que celui de Dérush (pour l'essayer sans reprendre celui de l'ordinateur)
  if (process.env.DERUSH_EARSHOT === 'derush') { const c = path.join(MOTEUR_EARSHOT, '.venv', exeEarshot); return fs.existsSync(c) ? c : null; }
  const candidats = [process.env.DERUSH_EARSHOT, lireReglages().earshot, path.join(MOTEUR_EARSHOT, '.venv', exeEarshot), trouver(WINDOWS ? 'earshot.exe' : 'earshot'),
    path.join(maison, 'Outils', 'earshot', '.venv', exeEarshot), path.join(maison, 'earshot', '.venv', exeEarshot)];
  return candidats.find((c) => c && fs.existsSync(c)) ?? null;
}
const maisonEarshotDerush = path.join(MOTEUR_EARSHOT, 'cache');
const contient = (dossier, f) => f === dossier || f.startsWith(dossier.endsWith(path.sep) ? dossier : dossier + path.sep);
const reel = (f) => { try { return fs.realpathSync(f); } catch { return path.resolve(f); } };
/**
 * Là où un Earshot déjà sur l'ordinateur range ses modèles (dit par « earshot doctor »). Ce dossier est donné en
 * écriture à une IA en bac à sable : jamais le dossier personnel ni un dossier qui le contient, jamais rien du dossier
 * de Dérush ni de l'app, et seulement un dossier dont le nom dit qu'il est à Earshot (ses deux places habituelles :
 * ~/.cache/earshot, ou .cache dans son clone « earshot »), pas ~/Library/LaunchAgents. Sinon null (Earshot marche
 * alors sans garder ses calculs).
 */
function maisonSure(m, programme = null) {
  if (typeof m !== 'string' || !m || !path.isAbsolute(m)) return null;
  const r = reel(m);
  // jamais le dossier où est le programme d'Earshot lui-même (l'IA y changerait ce que Dérush lance hors du bac à sable)
  if (programme && (contient(r, reel(programme)) || contient(path.resolve(m), path.resolve(programme)))) return null;
  for (const garde of [os.homedir(), DOSSIER_SUPPORT, RACINE_APP].flatMap((g) => [path.resolve(g), reel(g)])) {
    if (contient(r, garde) || contient(path.resolve(m), garde)) return null; // lui-même, ou un dossier qui le contient
  }
  for (const garde of [DOSSIER_SUPPORT, RACINE_APP].flatMap((g) => [path.resolve(g), reel(g)])) if (contient(garde, r)) return null;
  const aEarshot = (d) => /earshot/i.test(path.basename(d)) || (path.basename(d) === '.cache' && /earshot/i.test(path.basename(path.dirname(d))));
  return aEarshot(r) && aEarshot(path.resolve(m)) ? m : null;
}
export function etatEarshot() {
  if (memoEarshot.v && Date.now() - memoEarshot.t < 60000) return memoEarshot.v;
  const chemin = cheminEarshot();
  let v;
  if (!chemin) v = {ok: false, installable: !!uv(), taille: '2,5 Go', pourquoi: 'Earshot n’est pas installé (facultatif).'};
  else {
    const note = lireJson(F.earshot, {}) ?? {};
    const connu = note.chemin === chemin ? note : {};
    const derush = chemin.startsWith(MOTEUR_EARSHOT);
    v = connu.modeles === false
      ? {ok: false, chemin, derush, installable: true, taille: '1,1 Go', pourquoi: 'Les deux modèles d’Earshot ne sont pas encore téléchargés.'}
      : {ok: true, chemin, derush, verifie: connu.modeles === true, maison: derush ? maisonEarshotDerush : maisonSure(connu.maison, chemin)};
  }
  memoEarshot = {t: Date.now(), v};
  return v;
}
/** Demande à Earshot où sont ses modèles et s'ils sont là (une à deux secondes ; rien n'est téléchargé). */
export async function verifierEarshot() {
  const chemin = cheminEarshot();
  if (!chemin) return etatEarshot();
  const derush = chemin.startsWith(MOTEUR_EARSHOT);
  try {
    const {out} = await lancer(chemin, ['doctor', '--json'], {env: {...envTiers(), EARSHOT_OFFLINE: '1', ...(derush ? {EARSHOT_HOME: maisonEarshotDerush} : {})}, silenceMax: 120000});
    const texte = out.toString();
    const j = JSON.parse(texte.slice(texte.indexOf('{')));
    const caches = Object.values(j.models_cached ?? {});
    ecrireJson(F.earshot, {chemin, maison: j.earshot_home ?? null, modeles: caches.length > 0 && caches.every(Boolean), quand: new Date().toISOString()});
  } catch { ecrireJson(F.earshot, {chemin, maison: null, modeles: null, quand: new Date().toISOString()}); }
  try { fs.rmSync(path.join(DOSSIER_ETAT_SONS, 'earshot.json'), {force: true}); } catch { /* l'ancien fichier, plus lu */ }
  oublierEarshot();
  return etatEarshot();
}
/** Le guide officiel d'Earshot pour une IA : recopié du clone s'il y en a un, sinon téléchargé à la version installée. */
async function installerSkillEarshot(chemin) {
  const v = VERSIONS_SONS.earshot;
  const clone = chemin ? path.join(path.dirname(chemin), '..', '..', 'skills', 'earshot', 'SKILL.md') : null;
  let texte = null;
  if (clone && fs.existsSync(clone)) texte = fs.readFileSync(clone, 'utf8');
  else {
    const r = await fetch(`https://raw.githubusercontent.com/${v.depot}/${v.commit}/skills/earshot/SKILL.md`, {redirect: 'follow'});
    if (!r.ok) throw new Error(`Le guide d’Earshot ne répond pas (${r.status}).`);
    texte = await r.text();
  }
  if (!/^---\r?\nname:\s*earshot/m.test(texte)) throw new Error('Le guide d’Earshot téléchargé n’a pas la forme attendue.');
  fs.mkdirSync(DOSSIER_SKILL_EARSHOT, {recursive: true});
  fs.writeFileSync(path.join(DOSSIER_SKILL_EARSHOT, 'SKILL.md'), texte);
  fs.writeFileSync(path.join(DOSSIER_SKILL_EARSHOT, 'SOURCE.md'), `# Provenance\n\n- Source : https://github.com/${v.depot} (${clone && fs.existsSync(clone) ? 'recopié de l’installation de cet ordinateur' : `version ${v.version}, commit ${v.commit.slice(0, 7)}`}), le ${new Date().toISOString().slice(0, 10)}.\n- Licence : MIT (Leon Lin). Les deux modèles viennent de leurs auteurs : CLAP (Apache-2.0), AST (BSD-3-Clause).\n- Dans Dérush, la commande « earshot » est déjà prête, et « earshot llm » (envoi du son à Google) est coupée.\n`);
  oublierCompetences();
}
/** Installe Earshot dans les moteurs de Dérush : Python à part, torch en version CPU, puis ses deux modèles (1,1 Go). */
export async function installerEarshot(journal = () => {}) {
  const v = VERSIONS_SONS.earshot;
  let chemin = cheminEarshot();
  if (!chemin) {
    const u = uv();
    if (!u) throw new Error('L’outil « uv » est introuvable : installe-le (https://docs.astral.sh/uv/) puis réessaie.');
    const venv = path.join(MOTEUR_EARSHOT, '.venv');
    const py = WINDOWS ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python');
    fs.mkdirSync(MOTEUR_EARSHOT, {recursive: true});
    if (!fs.existsSync(py)) { journal('Earshot : son environnement Python…'); await lancer(u, ['venv', '--python', '3.12', venv], {env: envUv()}); }
    journal('Earshot : torch en version processeur (CPU)…');
    await lancer(u, ['pip', 'install', '--python', py, 'torch', '--index-url', 'https://download.pytorch.org/whl/cpu'], {env: envUv()});
    journal('Earshot : le programme…');
    await lancer(u, ['pip', 'install', '--python', py, `earshot @ https://github.com/${v.depot}/archive/${v.commit}.tar.gz`], {env: envUv()});
    chemin = path.join(venv, exeEarshot);
    if (!fs.existsSync(chemin)) throw new Error('Earshot s’est installé, mais sa commande est introuvable.');
  }
  const derush = chemin.startsWith(MOTEUR_EARSHOT);
  journal('Earshot : ses deux modèles (1,1 Go la première fois)…');
  await lancer(chemin, ['doctor', '--fetch'], {env: {...envTiers(), ...(derush ? {EARSHOT_HOME: maisonEarshotDerush} : {})}, silenceMax: 1800000});
  await installerSkillEarshot(chemin);
  return verifierEarshot();
}

// ——— l'état, l'interrupteur ———
/** Ce que Connexions montre, et ce dont l'IA dispose. */
export function etatSons() {
  const r = lireReglages();
  const dossier = dossierSons();
  const c = compter();
  // jamais décidé : allumé si la personne a déjà des sons, éteint sinon (rien n'est imposé)
  const actif = typeof r.sons === 'boolean' ? r.sons : c.nombre > 0;
  return {actif, dossier, nom: nomLisible(dossier), existe: fs.existsSync(dossier), nombre: c.nombre, types: c.types, realsfx: etatRealSfx(), earshot: etatEarshot()};
}
/** Donne (ou retire) les vrais sons à l'IA. Allumer crée la bibliothèque si elle n'existe pas. */
export function changerSons(actif) {
  if (actif) fs.mkdirSync(dossierSons(), {recursive: true});
  changerReglages({sons: !!actif});
  memoCompte.t = 0;
  return etatSons();
}

// ——— les commandes que l'IA trouve dans son PATH ———
function ecrireCommande(nom, sh, cmd) {
  try {
    fs.mkdirSync(DOSSIER_COMMANDES, {recursive: true});
    if (WINDOWS) fs.writeFileSync(path.join(DOSSIER_COMMANDES, `${nom}.cmd`), texteCmd(cmd));
    else { const f = path.join(DOSSIER_COMMANDES, nom); fs.writeFileSync(f, sh); fs.chmodSync(f, 0o755); }
  } catch { /* dossier en lecture seule */ }
}
const retirerCommande = (nom) => { try { fs.rmSync(path.join(DOSSIER_COMMANDES, WINDOWS ? `${nom}.cmd` : nom), {force: true}); } catch { /* absente */ } };
// real-sfx <script> … lance scripts/<script>.py de Real SFX, depuis n'importe quel dossier.
// Real SFX et Earshot sont des outils d'autres auteurs : leurs commandes ne reçoivent pas les clés données à l'IA.
const CODE_REALSFX = "import os, sys, runpy; d = os.environ['DERUSH_REALSFX']; a = sys.argv[1:]; n = os.path.basename(a[0] if a else '').replace('.py', ''); f = os.path.join(d, 'scripts', n + '.py'); os.path.isfile(f) or sys.exit('real-sfx : commande inconnue. Exemples : real-sfx look, from_cues, mix, verify, critique, levels, sheet, search'); sys.argv = [f] + a[1:]; sys.path.insert(0, os.path.dirname(f)); runpy.run_path(f, run_name='__main__')";
const sq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
// sous Windows, les chemins partent du dossier des commandes (voir cheminCmd : cmd.exe lit mal « Dérush » écrit en UTF-8)
const enCmd = (cible) => cheminCmd(DOSSIER_COMMANDES, cible);
/**
 * Le texte des commandes de son, pour Mac et Linux (`sh`) et pour Windows (`cmd`) ; null quand la commande n'a pas lieu
 * d'être (sons éteints, outil absent).
 */
export function textesCommandesSons(e, py = pythonPourIA()) {
  const maison = e.earshot?.derush ? maisonEarshotDerush : null;
  return {
    'sons-openverse': e.actif && py && fs.existsSync(SCRIPT_OPENVERSE) ? {
      sh: `#!/bin/sh\nSONS_COMMANDE=sons-openverse\nexport SONS_COMMANDE\nexec "${py}" ${sq(SCRIPT_OPENVERSE)} "$@"\n`,
      cmd: `@echo off\nset "SONS_COMMANDE=sons-openverse"\n"${enCmd(py)}" "${enCmd(SCRIPT_OPENVERSE)}" %*\n`} : null,
    'real-sfx': e.actif && py && e.realsfx?.ok ? {
      sh: `#!/bin/sh\nunset ELEVENLABS_API_KEY TREG_TOKEN\nDERUSH_REALSFX=${sq(DOSSIER_REALSFX)}\nexport DERUSH_REALSFX\nexec "${py}" -c "${CODE_REALSFX}" "$@"\n`,
      cmd: `@echo off\nset "ELEVENLABS_API_KEY="\nset "TREG_TOKEN="\nset "DERUSH_REALSFX=${enCmd(DOSSIER_REALSFX)}"\n"${enCmd(py)}" -c "${CODE_REALSFX}" %*\n`} : null,
    earshot: e.actif && e.earshot?.ok ? {
      sh: `#!/bin/sh\ncase "$1" in llm) echo "earshot llm est coupé dans Dérush : il envoie le son à Google." >&2; exit 2;; esac\nunset ELEVENLABS_API_KEY TREG_TOKEN GEMINI_API_KEY GOOGLE_API_KEY\n[ -n "$EARSHOT_THREADS" ] || EARSHOT_THREADS=3\nexport EARSHOT_THREADS\n${maison ? `EARSHOT_HOME=${sq(maison)}\nexport EARSHOT_HOME\n` : ''}exec ${sq(e.earshot.chemin)} "$@"\n`,
      cmd: `@echo off\nif /I "%~1"=="llm" (echo earshot llm est coupe dans Derush : il envoie le son a Google. 1>&2 & exit /b 2)\nset "ELEVENLABS_API_KEY="\nset "TREG_TOKEN="\nset "GEMINI_API_KEY="\nset "GOOGLE_API_KEY="\nif "%EARSHOT_THREADS%"=="" set "EARSHOT_THREADS=3"\n${maison ? `set "EARSHOT_HOME=${enCmd(maison)}"\n` : ''}"${enCmd(e.earshot.chemin)}" %*\n`} : null,
  };
}
function preparerCommandesSons(e) {
  for (const [nom, t] of Object.entries(textesCommandesSons(e))) {
    if (t) ecrireCommande(nom, t.sh, t.cmd);
    else retirerCommande(nom);
  }
}

// ——— dans le dossier de travail de l'IA ———
/** Relie la bibliothèque dans le dossier de travail (sons/), prépare les commandes et l'index de Real SFX. */
export async function installerSons(atelier, noter = () => {}) {
  const lien = path.join(atelier, 'sons');
  try { if (fs.lstatSync(lien).isSymbolicLink()) delier(lien); } catch { /* absent */ }
  let e = etatSons();
  if (e.actif) {
    fs.mkdirSync(e.dossier, {recursive: true});
    lier(e.dossier, lien);
    if (e.earshot.chemin && !e.earshot.verifie && e.earshot.ok) { try { await verifierEarshot(); e = etatSons(); } catch { /* on fera sans Earshot */ } }
    if (e.earshot.ok && !fs.existsSync(path.join(DOSSIER_SKILL_EARSHOT, 'SKILL.md'))) { try { await installerSkillEarshot(e.earshot.chemin); } catch { /* l'IA aura quand même la commande et OUTILS.md */ } }
    if (e.realsfx.ok) { try { await indexerSons(() => noter('onde', 'Range ta bibliothèque de sons')); } catch { /* l'IA refera l'index elle-même si besoin */ } }
  }
  preparerCommandesSons(e);
  return e;
}
/** Les variables que l'IA reçoit pour ses commandes de son. */
export function envSons() {
  const e = etatSons();
  if (!e.actif) return {};
  return {SONS_BIBLIOTHEQUE: e.dossier, SONS_ETAT: etatOpenverse(), ...(e.realsfx.ok ? envRealSfx() : {})};
}
/** Les dossiers hors du dossier de travail où Codex (bac à sable) doit pouvoir écrire : sons téléchargés, index, compteur. */
export function ecritsSons() {
  const e = etatSons();
  if (!e.actif) return [];
  rangerEtatRealSfx();
  // le cache d'Earshot : celui de Dérush, ou celui qu'« earshot doctor » a dit, revérifié ici (jamais lu tel quel)
  const maison = !e.earshot.ok ? null : e.earshot.derush ? maisonEarshotDerush : maisonSure(e.earshot.maison, e.earshot.chemin);
  const d = [e.dossier, DOSSIER_ETAT_REALSFX, etatOpenverse(), ...(maison ? [maison] : [])];
  for (const x of d) { try { fs.mkdirSync(x, {recursive: true}); } catch { /* lecture seule */ } }
  return d.filter((x) => fs.existsSync(x));
}
/** Ce qu'un bac à sable qui limite aussi la lecture (Gemini) doit pouvoir lire en plus : Earshot et son Python. */
export function lusSons() {
  const e = etatSons();
  if (!e.actif || !e.earshot.ok || !e.earshot.chemin) return [];
  const bin = path.dirname(e.earshot.chemin);
  const python = path.join(bin, WINDOWS ? 'python.exe' : 'python');
  const venv = path.dirname(bin);
  // hors d'un environnement Python (Homebrew, pipx…) : le programme seul, Dérush en déduit son installation
  if (!/^\.?venv$/.test(path.basename(venv))) return [e.earshot.chemin, python];
  // …/earshot/.venv/bin/earshot : l'environnement, et le dossier au-dessus seulement si c'est bien un clone d'Earshot
  // (ses sources). Un environnement posé dans le dossier personnel (~/.venv) ne donne jamais ce dossier-là à lire.
  const M = os.homedir();
  const projet = path.dirname(venv);
  const clone = fs.existsSync(path.join(projet, 'skills', 'earshot', 'SKILL.md')) || fs.existsSync(path.join(projet, 'earshot', '__init__.py'));
  return [venv, ...(clone ? [projet] : []), python].filter((d) => !contient(d, M) && !contient(reel(d), reel(M)));
}

// ——— ce que Dérush dit à l'IA ———
const typesLisibles = (types) => Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t, n]) => `${t} ${n}`).join(', ');
/** La consigne de départ. Vide quand les vrais sons ne sont pas donnés. */
export function consigneSons() {
  const e = etatSons();
  if (!e.actif) return '';
  const L = [`- Vrais sons (l’humain te les a donnés) : sa bibliothèque de sons libres est reliée ici, dans \`sons/\`${e.nombre ? ` (${e.nombre} sons : ${typesLisibles(e.types)})` : ' (encore vide)'}, avec \`sons/catalog.csv\` (le type, le titre et la licence de chaque fichier) et \`sons/CREDITS.md\`. Pour les bruitages d’une vidéo (coupes, apparitions, impacts, clics, pops…), ces vrais sons passent avant les sons de synthèse du kit, les sons calculés en code et les sons générés. Ne modifie, ne renomme et ne supprime rien dans \`sons/\` : copie ce que tu utilises. La marche à suivre est dans OUTILS.md, partie « Les vrais sons ».`,
    '  • S’il en manque un : la commande `sons-openverse` (compétence du même nom) cherche des sons libres et ne garde que ceux qu’on a le droit de poser sur une vidéo commerciale. Trois recherches par vidéo au plus.'];
  if (e.realsfx.ok) L.push('  • Pour les poser : la commande `real-sfx` (compétence `real-sfx`) choisit les sons, les place à l’image près sous la voix et la musique, et note son propre travail. Suis la marche d’OUTILS.md plutôt que de mixer les bruitages à la main.');
  if (e.earshot.ok) L.push('  • Pour écouter : la commande `earshot` (compétence `earshot`) décrit un son, classe des candidats, vérifie le niveau et la synchro d’une vidéo, et fabrique des sons en code (`earshot sfx`). Elle est déjà installée : n’installe rien, et ne lance jamais `earshot llm`.');
  else L.push('  • Tu ne peux pas entendre : ne dis jamais qu’un son « sonne bien ». Dis ce que tu as mesuré.');
  L.push('  • Si une vidéo utilise un son marqué « crédit obligatoire », écris ses crédits dans `rendu/credits-sons.md` (`sons-openverse credits FICHIERS…`) et dis-le en une ligne à la fin : Dérush les montre à l’humain, qui les colle dans sa description. Si tu publies, ajoute-les toi-même à la légende.');
  return L.join('\n');
}
/** Pour une conversation reprise, qui ne relit pas ses consignes de départ. */
export function rappelSons() {
  const e = etatSons();
  if (!e.actif) return 'pas donnés';
  return `donnés (sons/, ${e.nombre} sons${e.realsfx.ok ? ', real-sfx' : ''}${e.earshot.ok ? ', earshot' : ''} : voir OUTILS.md, « Les vrais sons »)`;
}
/** La partie « Les vrais sons » d'OUTILS.md. Vide quand ils ne sont pas donnés. */
export function partieSons() {
  const e = etatSons();
  if (!e.actif) return '';
  const L = ['## Les vrais sons', '',
    `L'humain t'a donné sa bibliothèque de sons libres : \`sons/\` (${e.nombre ? `${e.nombre} sons : ${typesLisibles(e.types)}` : 'encore vide'}). Ce sont de vrais enregistrements, déjà triés par licence. **Pour les bruitages, ils passent avant tout le reste** : les sons de synthèse du kit (\`remotion/public/sons/\`), les sons calculés en code et les sons générés ne servent que s'il n'y a vraiment rien d'autre.`, '',
    '- `sons/<type>/…` : un dossier par type (`whoosh`, `impact`, `riser`, `pop`, `click`, `chime`, `foley`, `ambience`…).',
    '- `sons/catalog.csv` : pour chaque fichier, son type, son titre, son auteur, sa licence et `credit` (`obligatoire` ou `facultatif`).',
    '- Ne modifie rien dans `sons/` : copie ce que tu utilises dans `remotion/public/son/`. La bibliothèque sert à toutes les vidéos de l\'humain.', '',
    '### Trouver un son qui manque', '',
    '```', 'sons-openverse chercher "fast whoosh" --duree shortest      # mots en anglais ; OK = utilisable, ~ = à éviter, NON = refusé',
    'sons-openverse telecharger 3 --type whoosh                  # le n° 3 de la recherche, rangé dans sons/whoosh/ avec son crédit',
    'sons-openverse quota                                        # 20 appels par minute, 200 par jour, pour tout l\'ordinateur', '```', '',
    '- Seulement les sons qu\'on a le droit de poser sur une vidéo commerciale (domaine public et CC BY) : la commande trie pour toi. La compétence `sons-openverse` explique pourquoi.',
    '- Trois recherches par vidéo au plus, et seulement pour un son dont la vidéo a besoin. Prends 2 ou 3 candidats, pas 10.',
    `- ${e.earshot.ok ? 'Fais décrire chaque son téléchargé par `earshot describe` avant de t\'en servir : un titre ment souvent. Un son qui n\'est pas ce que dit son type : `sons-openverse retirer FICHIER`.' : 'Un titre ment souvent : regarde la durée et les mots-clés, et mesure le fichier (`ffprobe`) avant de t\'en servir.'}`,
    '- Pour un gros choc sous une musique qui a déjà de la basse, cherche un choc médium (`thud`, `slam`, `knock`) plutôt qu\'un « cinematic boom ».', ''];
  if (e.realsfx.ok) {
    L.push('### Poser les sons avec Real SFX', '',
      'Real SFX pose de vrais sons sur une vidéo finie, à l\'image près, en gardant sa voix et sa musique. Dans Dérush, sa commande est `real-sfx <script> …` (pour `python scripts/<script>.py …` dans sa compétence), et sa bibliothèque est déjà branchée sur `sons/` : ne lance ni `setup`, ni `listen install`, ni `hear install`.', '',
      '1. **Monte la vidéo avec sa voix et sa musique, sans aucun bruitage** (ni sons du kit, ni sons générés), et rends-la : `rendu/sans-bruitages.mp4`.',
      '2. **Écris la liste des accents** dans `rendu/son/cues.json`. Tu connais leurs images : `t` est en secondes (image ÷ cadence).',
      '   ```json',
      '   [{"t": 0.60, "type": "hit", "g": 1.0}, {"t": 2.00, "type": "pop", "g": 0.7}, {"t": 4.00, "type": "wipe", "g": 0.45},',
      '    {"t": 8.17, "type": "whoosh", "len": 0.6, "g": 0.3}, {"t": 10.0, "type": "riser", "len": 0.4, "g": 0.4}]',
      '   ```',
      '   - `type` : `whoosh` (passage d\'air ; `t` = l\'instant où il passe au plus fort), `wipe` (coupe, changement de scène), `hit` (impact, tampon, titre qui claque), `thump` (choc sourd), `riser` (montée ; `t` = son début), `pop`, `click`, `tick`, `chime` (tintement, case cochée), `glass`, `water`, `key` (frappe au clavier : `len` secondes, `n` touches).',
      '   - `g` : la force, de 0,2 (discret) à 1 (le moment le plus fort) ; `len` : la durée, pour `whoosh` et `riser`.',
      '   - Un son par moment, pas un bruit sur chaque coupe, et du silence autour des phrases importantes.',
      '3. `real-sfx from_cues rendu/son/cues.json --video rendu/sans-bruitages.mp4 --out rendu/son/feuille.json --ui library`',
      '   - Lis la ligne `declared N events: M voiced, K silent` : un type sans son dans la bibliothèque reste muet. Cherche-le avec `sons-openverse`, lance `sons-openverse indexer`, puis relance cette commande.',
      '   - Un type à toi (`bead`, `crack`…) se branche en une option : `--kind bead=click`, ou `--kind crack=slices:ID` (les numéros viennent de `real-sfx search --query "mot"`).',
      '4. `real-sfx mix rendu/son/feuille.json --out rendu/son/mix.mp4 --voice-safe --target-lufs -14` (ajoute `--plan` une première fois pour voir quel son va où ; sans voix dans la vidéo, enlève `--voice-safe`).',
      '5. `real-sfx verify rendu/son/mix_resolved_cues.json rendu/son/mix_sfx_track.wav`, puis `real-sfx critique` avec les mêmes fichiers : corrige les trois pires points (`real-sfx sheet set rendu/son/feuille.json --at T --label NOM gain_db=-4`, ou `file=sons/…` pour changer de son), et remixe. Deux tours suffisent.',
      '6. Livre `rendu/son/mix.mp4` comme vidéo finale (copie-la en `rendu/final.mp4`, ou dans `rendu/livraison/`), puis vérifie-la comme d\'habitude.', '',
      'À savoir :',
      '- Après le premier mixage, `real-sfx sheet freeze rendu/son/feuille.json rendu/son/mix_resolved_cues.json` fige les sons choisis. Désigne un son par son fichier (`file=…`), pas par son numéro : les numéros changent quand l\'index est refait.',
      '- `sheet set … --unset CLE` avale tout ce qui suit : fais-le dans un appel à part.',
      '- Un critère de la critique peut rester bas pour une bonne raison (un rythme dense voulu par le montage) : dis-le, n\'ajoute pas un son pour le remonter.',
      '- Une vidéo courte ou une retouche pressée : tu peux poser trois ou quatre sons toi-même (`<Audio>` dans la composition, 6 à 14 dB sous la voix), sans passer par Real SFX.', '');
  } else {
    L.push('### Poser les sons', '',
      'Copie les fichiers choisis dans `remotion/public/son/` et pose-les dans ta composition (`<Audio src={staticFile(…)} />` dans une `<Sequence from={image}>`), sur l\'image exacte de chaque accent, 6 à 14 dB sous la voix. Un son par moment, pas un bruit sur chaque coupe.', '');
  }
  if (e.earshot.ok) {
    L.push('### Écouter et fabriquer avec Earshot', '',
      'Tu ne peux pas entendre : `earshot` écoute pour toi, sur cet ordinateur. Chaque appel charge ses modèles (20 à 40 secondes) : groupe tes questions.', '',
      '| Besoin | Commande |', '|---|---|',
      '| Ce qu\'est vraiment un son | `earshot describe sons/whoosh/x.mp3` |',
      '| Le meilleur parmi des candidats | `earshot rank "a fast crisp air whoosh" sons/whoosh/ --top 3` (décris le son, pas son usage) |',
      '| Le meilleur moment d\'un long enregistrement | `earshot find x.mp3 "a single clean hit" --top 3` |',
      '| Écouter la vidéo finie : niveaux, événements, synchro avec les coupes | `earshot timeline rendu/final.mp4` (`--cues` avec `{"fps": 30, "events": [{"f": 18, "kind": "hit", "id": "titre"}]}`) |',
      '| Des mesures exactes (LUFS, crête) | `earshot measure rendu/final.mp4` (sans modèle, immédiat) |',
      '| Fabriquer un son en code (sans enregistrement) | `earshot sfx list --kind whoosh`, puis `earshot sfx render whoosh_fast/crisp -o x.wav --dur 0.8 --apex 0.32` |', '',
      '- Cite le chiffre quand tu juges un son (« fast whoosh, z +5,1 ; −14,0 LUFS »), et dis que c\'est une mesure, pas une écoute.',
      '- `earshot critique` compare à des films de lancement de produits : ce n\'est pas la bonne mesure pour une vidéo de réseaux sociaux.',
      '- `earshot llm` est coupé : il enverrait le son à Google.', '');
  }
  L.push('### Les crédits', '',
    '- Un son `credit = obligatoire` (licence CC BY) doit être cité là où la vidéo est publiée. Les autres sont dans le domaine public.',
    '- Quand la vidéo est finie : `sons-openverse credits sons/whoosh/a.mp3 sons/pop/b.mp3 > rendu/credits-sons.md` avec les fichiers vraiment utilisés (Real SFX les liste dans `rendu/son/mix_cue_report.md`). S\'il n\'y a aucun crédit obligatoire, n\'écris pas le fichier.',
    '- Dis-le en une ligne dans ton message final. Dérush montre ces crédits à l\'humain sous ta réponse ; si tu publies la vidéo, ajoute-les à la fin de la légende.', '');
  return `${L.join('\n')}\n`;
}
