// Dérush — les trois assistants qui peuvent monter : Claude (Claude Code, avec un compte Claude), Codex (avec un compte
// ChatGPT) et Gemini (la commande « agy » d'Antigravity, avec un compte Google). Ici : les trouver, les installer, les
// connecter, et traduire « Rapide / Soigné / Maximum » pour chacun.
// Le lancement lui-même (dossier de travail, suivi en direct, vidéos livrées) est dans claude.mjs, commun aux deux.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {lancer, ecrireJson} from './outils.mjs';
import {DOSSIER_SUPPORT} from './moteurs.mjs';
import {MAC, WINDOWS, trouver, commandeNode, avecShell, pathAvec} from './plateforme.mjs';
import {lireReglages} from './reglages.mjs';

/** Les assistants, et ce que l'interface en montre. */
export const IA = {
  claude: {nom: 'Claude', compte: 'Compte Claude (Pro ou Max)', editeur: 'Anthropic'},
  codex: {nom: 'Codex', compte: 'Compte ChatGPT (Plus, Pro ou Business)', editeur: 'OpenAI'},
  gemini: {nom: 'Gemini', compte: 'Compte Google (Gemini)', editeur: 'Google'},
};
/** Les modèles de Claude (le premier est celui par défaut quand on ne choisit rien). */
export const MODELES = {
  'claude-opus-5-5': {nom: 'Opus 5.5', aide: 'Le plus soigné'},
  'claude-fable-5-2': {nom: 'Fable 5.2', aide: 'Le plus récent'},
  'claude-sonnet-5-5': {nom: 'Sonnet 5.5', aide: 'Le plus rapide'},
};
export const EFFORTS = {max: 'Maximum', high: 'Élevée', medium: 'Rapide'};
/** Trois niveaux, les mêmes pour les deux assistants. */
export const QUALITES = {
  rapide: {nom: 'Rapide', aide: 'Pour une retouche ou une question. Quelques minutes.'},
  soigne: {nom: 'Soigné', aide: 'Le bon équilibre pour une vidéo.'},
  max: {nom: 'Maximum', aide: 'Le plus beau résultat. Plus long.'},
};
/**
 * Le modèle de Gemini pour un niveau, pris dans la liste que la commande « agy models » donne (elle change souvent et
 * dépend du compte) : Rapide = le Flash le plus récent. Avec Gemini 4 Carbon : Soigné = Argon en réflexion haute,
 * Maximum = Carbon. Sans Carbon (un compte personnel en novembre 2026) : Soigné = Argon en réflexion moyenne,
 * Maximum = Argon en réflexion haute. Rien n'est écrit en dur : si la liste change, le choix suit.
 */
export function modeleGemini(qualite, disponibles = []) {
  const a = disponibles.filter((s) => /^gemini-[\w.-]+$/.test(s));
  const premier = (...motifs) => { for (const m of motifs) { const x = a.find((s) => m.test(s)); if (x) return x; } return a[0] ?? null; };
  if (qualite === 'rapide') return premier(/flash.*-medium$/, /flash/, /-low$/, /-medium$/);
  const carbon = a.some((s) => /^gemini-4-carbon/.test(s));
  if (qualite === 'soigne') {
    return carbon
      ? premier(/^gemini-4-argon-high$/, /^gemini-4-carbon-medium$/, /^gemini-4.*-medium$/, /pro.*-high$/, /-high$/)
      : premier(/^gemini-4-argon-medium$/, /^gemini-4.*-medium$/, /pro.*-medium$/, /pro.*-high$/, /^gemini-4.*-high$/, /-medium$/, /-high$/);
  }
  return premier(/^gemini-4-carbon-high$/, /^gemini-4-argon-high$/, /^gemini-4.*-high$/, /pro.*-high$/, /-high$/);
}
/** Ce qu'un niveau veut dire pour chaque assistant : le modèle et la réflexion. Un modèle choisi à la main passe devant. */
export function reglageIA(moteur, qualite, modele = null, effort = null, disponibles = []) {
  // anciens appels (modèle + effort de Claude) : on retrouve le niveau
  if (!QUALITES[qualite]) qualite = effort === 'medium' ? 'rapide' : effort === 'high' ? 'soigne' : 'max';
  if (moteur === 'gemini') {
    const choisi = typeof modele === 'string' && disponibles.includes(modele) ? modele : modeleGemini(qualite, disponibles);
    return {qualite, modele: choisi, effort: {rapide: 'low', soigne: 'medium', max: 'high'}[qualite]};
  }
  if (moteur === 'codex') {
    return {qualite, modele: typeof modele === 'string' && /^[\w.:-]{2,60}$/.test(modele) ? modele : null, effort: {rapide: 'low', soigne: 'medium', max: 'high'}[qualite]};
  }
  const m = MODELES[modele] ? modele : qualite === 'rapide' ? 'claude-sonnet-5-5' : 'claude-opus-5-5';
  return {qualite, modele: m, effort: {rapide: 'medium', soigne: 'high', max: 'max'}[qualite]};
}
/** « gemini-4-carbon-high » → « Gemini 4 Carbon ». */
const nomGemini = (slug) => (slug ? String(slug).replace(/-(low|medium|high|max)$/, '').split('-').map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(' ') : 'Gemini');
export const nomModele = (moteur, modele) => (moteur === 'codex' ? (modele || 'Codex') : moteur === 'gemini' ? nomGemini(modele) : (MODELES[modele]?.nom ?? 'Claude'));

const PATH_OUTILS = [path.dirname(process.execPath), path.join(os.homedir(), '.local', 'bin'), ...(WINDOWS ? [] : ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'])];
export const envOutils = (extra = []) => pathAvec([...extra, ...PATH_OUTILS]);
const comparer = (a, b) => { const x = a.split('.').map(Number); const y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

/**
 * L'environnement donné à l'IA : le PATH des outils, et aucune clé secrète de l'ordinateur, sauf celles que Dérush lui
 * confie (ElevenLabs, Treg). Une clé d'API Anthropic ou OpenAI qui traînerait ferait payer à l'usage au lieu du compte.
 */
export function envIA(extra = []) {
  const env = envOutils(extra);
  for (const k of Object.keys(env)) {
    if (/^(CLAUDE_|CODEX_)/i.test(k) || ['ELEVENLABS_API_KEY', 'TREG_TOKEN'].includes(k)) continue;
    if (/(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)/i.test(k)) delete env[k];
  }
  return env;
}

/**
 * Comment lancer un programme installé par npm : sous Windows, les « .cmd » passent par l'interpréteur de commandes, qui
 * abîme les arguments ; on lance plutôt Node sur le script JavaScript du paquet. Renvoie {cmd, prefixe}.
 */
export function commandeLancement(chemin) {
  try {
    if (WINDOWS && /\.cmd$/i.test(chemin)) {
      const m = /"%~?dp0%\\?([^"]+\.(?:js|mjs|cjs))"/i.exec(fs.readFileSync(chemin, 'utf8'));
      if (m) return {cmd: process.execPath, prefixe: [path.join(path.dirname(chemin), m[1])]};
      return {cmd: chemin, prefixe: [], shell: true};
    }
    const reel = fs.realpathSync(chemin);
    if (/\.(js|mjs|cjs)$/i.test(reel)) return {cmd: process.execPath, prefixe: [reel]};
  } catch { /* on lance tel quel */ }
  return {cmd: chemin, prefixe: []};
}

// ——— Claude Code ———
let memoClaude = {t: 0, v: null};
/** Cherche Claude Code (celui de l'app Claude, celui de l'installateur officiel, ou un autre) et garde le plus récent. */
export async function etatClaude(force = false) {
  if (!force && memoClaude.v && Date.now() - memoClaude.t < 120000) return memoClaude.v;
  const candidats = [];
  if (process.env.DERUSH_CLAUDE) candidats.push(process.env.DERUSH_CLAUDE);
  // l'app Claude (bureau) embarque Claude Code
  const bureaux = MAC ? [path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude-code')]
    : WINDOWS ? [path.join(process.env.APPDATA ?? '', 'Claude', 'claude-code'), path.join(process.env.LOCALAPPDATA ?? '', 'Claude', 'claude-code')] : [];
  for (const bureau of bureaux) {
    try {
      for (const v of fs.readdirSync(bureau)) {
        for (const h of fs.readdirSync(path.join(bureau, v))) {
          const d = path.join(bureau, v, h);
          candidats.push(MAC ? path.join(d, 'claude.app', 'Contents', 'MacOS', 'claude') : path.join(d, 'claude.exe'));
        }
      }
    } catch { /* l'app Claude n'est pas installée */ }
  }
  const exe = WINDOWS ? ['claude.exe', 'claude.cmd'] : ['claude'];
  for (const d of [path.join(os.homedir(), '.local', 'bin'), path.join(os.homedir(), '.claude', 'local'), '/opt/homebrew/bin', '/usr/local/bin', ...(WINDOWS ? [path.join(process.env.APPDATA ?? '', 'npm')] : [])]) for (const x of exe) candidats.push(path.join(d, x));
  const dansLePath = trouver('claude');
  if (dansLePath) candidats.push(dansLePath);
  let mieux = null;
  for (const c of [...new Set(candidats.filter((x) => x && fs.existsSync(x)))]) {
    try {
      const {out} = await lancer(c, ['--version'], {env: envOutils(), silenceMax: 20000});
      const version = /(\d+\.\d+\.\d+)/.exec(out.toString())?.[1];
      if (version && (!mieux || comparer(version, mieux.version) > 0)) mieux = {chemin: c, version};
    } catch { /* ce binaire ne se lance pas : on passe au suivant */ }
  }
  let v;
  if (!mieux) v = {ok: false, installable: true, pourquoi: 'Claude Code n’est pas encore installé.'};
  else {
    let connecte = false;
    try { connecte = JSON.parse((await lancer(mieux.chemin, ['auth', 'status'], {env: envIA(), silenceMax: 20000})).out.toString()).loggedIn === true; } catch { /* pas connecté */ }
    v = connecte
      ? {ok: true, ...mieux, nom: `Claude Code ${mieux.version}`, detail: 'Connecté à ton compte Claude.'}
      : {ok: false, ...mieux, connectable: true, pourquoi: 'Claude Code n’est pas connecté à ton compte Claude.'};
  }
  memoClaude = {t: Date.now(), v};
  return v;
}
export const oublierEtats = () => { memoClaude.t = 0; memoCodex.t = 0; memoGemini.t = 0; };
/** L'état des trois assistants, et celui que l'humain a choisi (ou le premier prêt). */
export async function etatIA(force = false) {
  const [claude, codex, gemini] = await Promise.all([etatClaude(force), etatCodex(force), etatGemini(force)]);
  return {claude, codex, gemini, choisi: moteurChoisi({claude, codex, gemini})};
}
export function moteurChoisi(etats) {
  const prefere = lireReglages().ia_moteur ?? null;
  if (prefere && etats?.[prefere]?.ok) return prefere;
  for (const m of ['claude', 'codex', 'gemini']) if (etats?.[m]?.ok) return m;
  return IA[prefere] ? prefere : 'claude';
}

// ——— Codex ———
const DOSSIER_OUTILS = path.join(DOSSIER_SUPPORT, 'outils');
let memoCodex = {t: 0, v: null};
/** Cherche Codex (celui que Dérush a installé, ou un autre) ; dit s'il est connecté à un compte ChatGPT. */
export async function etatCodex(force = false) {
  if (!force && memoCodex.v && Date.now() - memoCodex.t < 60000) return memoCodex.v;
  const bin = WINDOWS ? 'codex.cmd' : 'codex';
  const candidats = [process.env.DERUSH_CODEX, path.join(DOSSIER_OUTILS, 'node_modules', '.bin', bin), trouver('codex'),
    path.join(os.homedir(), '.local', 'bin', 'codex'), '/opt/homebrew/bin/codex', '/usr/local/bin/codex', ...(WINDOWS ? [path.join(process.env.APPDATA ?? '', 'npm', 'codex.cmd')] : [])];
  let mieux = null;
  for (const c of [...new Set(candidats.filter((x) => x && fs.existsSync(x)))]) {
    try {
      const {out} = await lancer(c, ['--version'], {env: envOutils(), silenceMax: 20000});
      const version = /(\d+\.\d+\.\d+)/.exec(out.toString())?.[1];
      if (version && (!mieux || comparer(version, mieux.version) > 0)) mieux = {chemin: c, version};
    } catch { /* ce binaire ne se lance pas */ }
  }
  let v;
  if (!mieux) v = {ok: false, installable: true, pourquoi: 'Codex n’est pas encore installé.'};
  else {
    let connecte = false;
    try { const r = await lancer(mieux.chemin, ['login', 'status'], {env: envIA(), silenceMax: 20000}); const s = `${r.out.toString()}\n${r.err}`; connecte = /logged in/i.test(s) && !/not logged in/i.test(s); } catch { /* pas connecté */ }
    v = connecte
      ? {ok: true, ...mieux, nom: `Codex ${mieux.version}`, detail: 'Connecté à ton compte ChatGPT.'}
      : {ok: false, ...mieux, connectable: true, pourquoi: 'Codex n’est pas connecté à ton compte ChatGPT.'};
  }
  memoCodex = {t: Date.now(), v};
  return v;
}
/** Installe Codex dans le dossier de Dérush (rien n'est installé ailleurs sur l'ordinateur). */
export async function installerCodex() {
  fs.mkdirSync(DOSSIER_OUTILS, {recursive: true});
  if (!fs.existsSync(path.join(DOSSIER_OUTILS, 'package.json'))) ecrireJson(path.join(DOSSIER_OUTILS, 'package.json'), {name: 'derush-outils', private: true}, 2);
  await lancer(commandeNode('npm'), ['install', '--no-audit', '--no-fund', '--loglevel=error', '@openai/codex@latest'], {cwd: DOSSIER_OUTILS, env: envOutils()});
  memoCodex.t = 0;
  return etatCodex(true);
}

// ——— installer et connecter, en un clic ———
const EN_COURS = new Map(); // nom → {etat, message}
export const actionEnCours = (nom) => EN_COURS.get(nom) ?? null;
function suivre(nom, promesse) {
  EN_COURS.set(nom, {etat: 'en_cours'});
  promesse.then(() => EN_COURS.delete(nom), (e) => EN_COURS.set(nom, {etat: 'erreur', message: String(e?.message ?? e).slice(0, 300)}));
}
/** Lance une commande de connexion qui ouvre le navigateur (l'humain se connecte lui-même), sans attendre. */
function ouvrirConnexion(chemin, args) {
  const p = spawn(chemin, args, {env: envOutils(), stdio: 'ignore', detached: !WINDOWS, shell: avecShell(chemin), windowsHide: true});
  p.on('error', () => {});
  p.unref();
  // la commande attend la fin de la connexion dans le navigateur : on l'arrête au bout de 15 minutes au plus
  setTimeout(() => { try { p.kill(); } catch { /* déjà fini */ } }, 15 * 60000).unref();
}
/** Installe Claude Code avec l'installateur officiel d'Anthropic. */
export function installerClaude() {
  const [cmd, args] = WINDOWS
    ? ['powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://claude.ai/install.ps1 | iex']]
    : ['bash', ['-c', 'curl -fsSL https://claude.ai/install.sh | bash']];
  suivre('claude', lancer(cmd, args, {env: envOutils()}));
}
export function connecterClaude(chemin) { ouvrirConnexion(chemin, ['auth', 'login']); }
export function lancerInstallationCodex() { suivre('codex', installerCodex()); }
export function connecterCodex(chemin) { ouvrirConnexion(chemin, ['login']); }

// ——— Gemini : la commande « agy » (Antigravity CLI) ———
// Écrit d'après la documentation officielle (antigravity.google/docs, novembre 2026) puis ajusté sur la vraie commande
// (agy 1.5.6) : « agy -p … --output-format stream-json », reprise avec « --conversation <id> », modèles listés par
// « agy models », bac à sable « --sandbox », permissions de la session par « --settings » (lib/gemini.mjs).
let memoGemini = {t: 0, v: null};
/** Cherche la commande agy ; dit si elle est connectée à un compte Google, et quels modèles elle propose. */
export async function etatGemini(force = false) {
  if (!force && memoGemini.v && Date.now() - memoGemini.t < 60000) return memoGemini.v;
  const exe = WINDOWS ? 'agy.exe' : 'agy';
  const candidats = [process.env.DERUSH_AGY, path.join(os.homedir(), '.local', 'bin', exe), trouver('agy'), '/opt/homebrew/bin/agy', '/usr/local/bin/agy',
    ...(WINDOWS ? [path.join(process.env.LOCALAPPDATA ?? '', 'agy', 'bin', exe)] : [])];
  let mieux = null;
  for (const c of [...new Set(candidats.filter((x) => x && fs.existsSync(x)))]) {
    try {
      const {out} = await lancer(c, ['--version'], {env: envOutils(), silenceMax: 20000});
      const version = /(\d+\.\d+\.\d+)/.exec(out.toString())?.[1];
      if (version && (!mieux || comparer(version, mieux.version) > 0)) mieux = {chemin: c, version};
    } catch { /* ce binaire ne se lance pas */ }
  }
  let v;
  if (!mieux) v = {ok: false, installable: true, pourquoi: 'Gemini (la commande agy d’Antigravity) n’est pas encore installé.'};
  else {
    // « agy models » ne répond que connecté : il donne en même temps la liste des modèles du compte (Gemini 4 Argon,
    // Flash, Carbon pour certains comptes… et d'autres marques, que Dérush ne propose pas ici)
    let modeles = [];
    let dit = '';
    try { const r = await lancer(mieux.chemin, ['models'], {env: envIA(), silenceMax: 30000}); dit = `${r.out.toString()}\n${r.err ?? ''}`; } catch (e) { dit = String(e?.message ?? e); }
    modeles = [...new Set(dit.match(/\bgemini-[\w.]+(?:-[\w.]+)*\b/g) ?? [])];
    v = modeles.length && !/authentication required/i.test(dit)
      ? {ok: true, ...mieux, modeles, nom: `Gemini (agy ${mieux.version})`, detail: 'Connecté à ton compte Google.'}
      : {ok: false, ...mieux, connectable: true, pourquoi: 'Gemini n’est pas connecté à ton compte Google.'};
  }
  memoGemini = {t: Date.now(), v};
  return v;
}
/** Installe la commande agy avec l'installateur officiel de Google. */
export function installerGemini() {
  const [cmd, args] = WINDOWS
    ? ['powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://antigravity.google/cli/install.ps1 | iex']]
    : ['bash', ['-c', 'curl -fsSL https://antigravity.google/cli/install.sh | bash']];
  suivre('gemini', lancer(cmd, args, {env: envOutils()}).then(() => { memoGemini.t = 0; }));
}
/**
 * La connexion de Gemini demande un vrai terminal (agy ouvre le navigateur à son premier lancement) : on ouvre donc une
 * fenêtre de terminal sur la commande, et l'humain se connecte lui-même.
 */
export function connecterGemini(chemin) {
  memoGemini.t = 0;
  const sans = (p) => { p.on('error', () => {}); p.unref(); };
  if (MAC) {
    const f = path.join(DOSSIER_SUPPORT, 'connecter-gemini.command');
    fs.mkdirSync(DOSSIER_SUPPORT, {recursive: true});
    fs.writeFileSync(f, `#!/bin/zsh\nclear\necho "Dérush — connexion de Gemini"\necho "Connecte-toi avec ton compte Google dans la page qui s'ouvre, puis ferme cette fenêtre."\necho\n"${chemin}"\n`);
    fs.chmodSync(f, 0o755);
    return sans(spawn('open', [f], {stdio: 'ignore', detached: true}));
  }
  if (WINDOWS) return sans(spawn('cmd', ['/c', 'start', '', 'cmd', '/k', chemin], {stdio: 'ignore', detached: true, windowsHide: false}));
  for (const [t, a] of [['x-terminal-emulator', ['-e', chemin]], ['gnome-terminal', ['--', chemin]], ['konsole', ['-e', chemin]], ['xterm', ['-e', chemin]]]) {
    if (trouver(t)) return sans(spawn(t, a, {stdio: 'ignore', detached: true}));
  }
  throw new Error('Ouvre un terminal, tape « agy », connecte-toi avec ton compte Google, puis reviens ici.');
}
/**
 * Les arguments de « agy » pour une demande : sans fenêtre (-p), suivi en direct (stream-json), bac à sable du terminal
 * allumé, et les réglages de cette session (reglagesGemini, lib/gemini.mjs) : sans eux, agy refuse tout ce qu'il
 * devrait demander, même d'écrire dans son dossier de travail. Modèle choisi, conversation reprise. Jamais sans bac à
 * sable, et pas de « --mode auto » : ce mode n'existe pas pour tous les comptes (agy l'ignore alors, avec un avertissement).
 */
export function argsGemini({demande, session = null, modele = null, reglages}) {
  if (reglages?.enableTerminalSandbox !== true || reglages?.toolPermission !== 'proceed-in-sandbox') throw new Error('Gemini ne se lance jamais sans son bac à sable.');
  return ['-p', demande, '--output-format', 'stream-json', '--sandbox', '--settings', JSON.stringify(reglages),
    ...(modele ? ['--model', modele] : []), ...(session ? ['--conversation', session] : [])];
}
/** Les outils d'agy qui ne sont pas un geste à montrer : attendre, suivre une commande déjà annoncée, finir. */
const OUTILS_MUETS = /^(command_status|send_command_input|wait|wait_5_seconds|finish|list_permissions|ask_permission|ask_custom_permission|ask_question|manage_task|manage_inbox|list_resources|read_resource|list_plugin_accounts|send_message|schedule)$/;
/**
 * Le nom d'un outil d'agy, ramené à ceux que Dérush sait décrire (Bash, Read, Write, Edit, WebSearch, WebFetch). Les
 * noms relevés dans les événements de la vraie commande (agy 1.5.6) : run_command {CommandLine}, read_file {Path,
 * StartLine, EndLine}, write_file {Path}, edit_file {Path}, search_web {query}. La liste d'outils qu'elle annonce au
 * départ en porte d'autres (view_file, write_to_file, replace_file_content, list_dir, grep_search, read_url_content,
 * generate_image, browser_…, call_mcp_tool) : ils sont reconnus aussi. Renvoie null pour un outil qui ne se montre pas.
 */
function gesteGemini(nom, parametres = {}) {
  const n = String(nom ?? '').toLowerCase();
  if (OUTILS_MUETS.test(n)) return null;
  const p = parametres && typeof parametres === 'object' ? parametres : {};
  const valeur = (motif) => { const k = Object.keys(p).find((x) => motif.test(x)); return k ? p[k] : null; };
  const fichier = valeur(/path|file|uri/i);
  if (/browser/.test(n)) return {outil: 'WebFetch', entree: {url: String(valeur(/url/i) ?? '')}};
  if (/command|shell|terminal|bash/.test(n)) return {outil: 'Bash', entree: {command: String(valeur(/command|cmd|script/i) ?? ''), description: String(valeur(/description|summary|explanation/i) ?? '')}};
  if (/mcp/.test(n) || n.includes('/')) return {outil: `mcp__${n.replace(/^(call_)?mcp[_:/]*(tool)?/, '').replace(/[/:]/g, '__') || 'outil'}`, entree: p};
  if (/search/.test(n) && /web|google/.test(n)) return {outil: 'WebSearch', entree: {query: String(valeur(/query|search/i) ?? '')}};
  if (/url|fetch|browser|web/.test(n)) return {outil: 'WebFetch', entree: {url: String(valeur(/url/i) ?? '')}};
  if (/image/.test(n) && /generat|creat/.test(n)) return {outil: 'Bash', entree: {command: '', description: 'Crée une image'}};
  if (/subagent/.test(n)) return {outil: 'Bash', entree: {command: '', description: 'Confie une partie du travail à un assistant'}};
  if (/write|create/.test(n) && fichier) return {outil: 'Write', entree: {file_path: String(fichier)}};
  if (/edit|replace|patch|modify|sed/.test(n) && fichier) return {outil: 'Edit', entree: {file_path: String(fichier)}};
  if (/read|view|open|list|grep|find|search/.test(n)) return {outil: 'Read', entree: {file_path: String(fichier ?? valeur(/query|pattern/i) ?? '')}};
  if (/skill/.test(n)) return {outil: 'Skill', entree: {skill: String(valeur(/name|skill/i) ?? '')}};
  return {outil: n || 'outil', entree: p};
}
/** Ce qu'agy n'a pas eu le droit de faire, en mots simples (les noms sont ceux de ses permissions). */
export function refusGemini(action) {
  const a = String(action ?? '').toLowerCase();
  if (/write/.test(a)) return 'écrire un fichier hors de son dossier de travail';
  if (/read_file|view/.test(a)) return 'lire un fichier hors de son dossier de travail';
  if (/command|unsandboxed/.test(a)) return 'lancer une commande hors de son bac à sable';
  if (/execute_url|browser/.test(a)) return 'ouvrir un navigateur';
  if (/url/.test(a)) return 'lire une page web';
  if (/mcp/.test(a)) return 'utiliser un connecteur';
  return `faire « ${a || 'une action'} »`;
}
/**
 * Lit les événements de « agy --output-format stream-json » (une ligne JSON par événement : init, step_update, result).
 * Renvoie une fonction : événement → {session, geste, texte, refus, fin: {reponse, erreur, refus}}. Le texte arrive par
 * morceaux (text_delta) : on le rend entier quand l'étape se termine. `refus` : une action refusée faute de permission
 * (sans écran, agy ne peut pas demander) ; `fin.refus` : toutes celles de la demande. `fin.reponse` : le compte rendu,
 * c'est-à-dire ce que Gemini a écrit après sa dernière commande (la « response » d'agy recolle tout ce qu'il a dit
 * depuis le début, phrases d'étape comprises).
 */
export function lecteurGemini() {
  const textes = new Map(); // n° d'étape → texte en cours
  const vus = new Set(); // les outils déjà annoncés
  const refuses = new Set(); // les refus déjà dits
  let derniers = []; // ce qui a été dit depuis le dernier outil
  return (j) => {
    // la conversation est connue dès le début : même arrêtée en route, elle pourra être reprise
    if (j?.event === 'init') return {session: j.conversation_id ?? j.init?.conversation_id ?? null};
    if (j?.event === 'result') {
      const r = j.result ?? {};
      const refus = [...new Set((r.denied_actions ?? []).map((d) => String(d?.action ?? d?.display_name ?? '')).filter(Boolean))];
      const erreur = r.status && r.status !== 'SUCCESS' ? String(r.error?.message ?? r.error ?? r.status) : null;
      return {session: r.conversation_id ?? null, fin: {reponse: derniers.join('\n\n') || String(r.response ?? '').trim(), erreur, refus}};
    }
    if (j?.event !== 'step_update') return {};
    const s = j.step_update ?? {};
    const x = {session: s.conversation_id ?? null};
    if (s.step_type === 'tool') {
      const nom = s.tool_name ?? s.tool_info?.name;
      if (nom && !vus.has(s.step_index)) { vus.add(s.step_index); derniers = []; const g = gesteGemini(nom, s.tool_info?.parameters); if (g) x.geste = g; }
      const message = s.state === 'ERROR' ? String(s.tool_info?.error?.message ?? '') : '';
      if (nom && /denied permission|permission check failed/i.test(message) && !refuses.has(nom)) { refuses.add(nom); x.refus = nom; }
    }
    if (s.step_type === 'agent_response') {
      if (typeof s.text_delta === 'string') textes.set(s.step_index, (textes.get(s.step_index) ?? '') + s.text_delta);
      if (s.state === 'DONE') { const t = (textes.get(s.step_index) ?? '').trim(); textes.delete(s.step_index); if (t) { x.texte = t; derniers.push(t); } }
    }
    return x;
  };
}

// ——— lancer Codex, et lire ce qu'il fait ———
/** Une valeur TOML (pour les options -c de Codex). */
const toml = (v) => (Array.isArray(v) ? `[${v.map(toml).join(', ')}]` : typeof v === 'string' ? JSON.stringify(v) : String(v));
/**
 * Les arguments de `codex exec` : bac à sable « écriture dans le dossier de travail », réseau autorisé (ElevenLabs, Treg),
 * et quelques dossiers en écriture en plus (le moteur de rendu, le dossier temporaire). Jamais sans bac à sable.
 */
export function argsCodex({session = null, reglage, ecrits = [], mcp = []}) {
  const commun = ['--json', '--skip-git-repo-check', '-c', 'sandbox_workspace_write.network_access=true', '-c', `model_reasoning_effort=${toml(reglage.effort)}`,
    // l'environnement que Dérush donne à Codex est déjà trié (envIA) : on garde la clé ElevenLabs pour ses commandes,
    // mais la clé Treg reste à Codex (pour son serveur MCP) et n'arrive pas dans le terminal
    '-c', 'shell_environment_policy.ignore_default_excludes=true', '-c', 'shell_environment_policy.exclude=["TREG_TOKEN"]',
    ...(reglage.modele ? ['-m', reglage.modele] : []), ...mcp];
  return session
    ? ['exec', 'resume', ...commun, '-c', 'sandbox_mode="workspace-write"', '-c', `sandbox_workspace_write.writable_roots=${toml(ecrits)}`, session, '-']
    : ['exec', ...commun, '-s', 'workspace-write', ...ecrits.flatMap((d) => ['--add-dir', d]), '-'];
}
/**
 * Traduit un événement de `codex exec --json` en gestes lisibles. Renvoie {session, geste: {outil, entree} | null,
 * texte, erreur, fin}. Les « items » d'erreur qui ne sont que des avertissements de configuration sont ignorés.
 */
export function lireEvenementCodex(j) {
  const it = j.item ?? {};
  if (j.type === 'thread.started') return {session: j.thread_id};
  if (j.type === 'turn.failed') return {erreur: j.error?.message ?? 'Codex a échoué.'};
  // une erreur « en route » (connexion coupée puis reprise, serveur MCP absent) n'arrête pas forcément le travail
  if (j.type === 'error') return {alerte: j.message ?? 'Erreur de Codex.'};
  if (j.type === 'turn.completed') return {fin: true, usage: j.usage ?? null};
  if (j.type === 'item.started' && it.type === 'command_execution') return {geste: {outil: 'Bash', entree: {command: String(it.command ?? '').replace(/^\S*(?:zsh|bash|sh|pwsh|powershell)(?:\.exe)?\s+-\w*c\s+/, '').replace(/^'(.*)'$/s, '$1').replace(/^"(.*)"$/s, '$1')}}};
  if (j.type !== 'item.completed') return {};
  if (it.type === 'agent_message') return {texte: String(it.text ?? '').trim()};
  if (it.type === 'file_change') {
    const chemins = (it.changes ?? []).map((x) => x.path).filter(Boolean);
    return chemins.length ? {geste: {outil: 'Edit', entree: {file_path: chemins[0], autres: chemins.length - 1}}} : {};
  }
  if (it.type === 'mcp_tool_call') return {geste: {outil: `mcp__${it.server ?? 'outil'}__${it.tool ?? ''}`, entree: it.arguments ?? {}}};
  if (it.type === 'web_search') return {geste: {outil: 'WebSearch', entree: {query: it.query ?? ''}}};
  return {};
}
