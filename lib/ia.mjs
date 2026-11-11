// Dérush — les deux assistants qui peuvent monter : Claude (Claude Code, avec un compte Claude) et Codex (avec un compte
// ChatGPT). Ici : les trouver, les installer, les connecter, et traduire « Rapide / Soigné / Maximum » pour chacun.
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
/** Ce qu'un niveau veut dire pour chaque assistant : le modèle et la réflexion. Un modèle choisi à la main passe devant. */
export function reglageIA(moteur, qualite, modele = null, effort = null) {
  // anciens appels (modèle + effort de Claude) : on retrouve le niveau
  if (!QUALITES[qualite]) qualite = effort === 'medium' ? 'rapide' : effort === 'high' ? 'soigne' : 'max';
  if (moteur === 'codex') {
    return {qualite, modele: typeof modele === 'string' && /^[\w.:-]{2,60}$/.test(modele) ? modele : null, effort: {rapide: 'low', soigne: 'medium', max: 'high'}[qualite]};
  }
  const m = MODELES[modele] ? modele : qualite === 'rapide' ? 'claude-sonnet-5-5' : 'claude-opus-5-5';
  return {qualite, modele: m, effort: {rapide: 'medium', soigne: 'high', max: 'max'}[qualite]};
}
export const nomModele = (moteur, modele) => (moteur === 'codex' ? (modele || 'Codex') : (MODELES[modele]?.nom ?? 'Claude'));

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
export const oublierEtats = () => { memoClaude.t = 0; memoCodex.t = 0; };
/** L'état des deux assistants, et celui que l'humain a choisi (ou le premier prêt). */
export async function etatIA(force = false) {
  const [claude, codex] = await Promise.all([etatClaude(force), etatCodex(force)]);
  return {claude, codex, choisi: moteurChoisi({claude, codex})};
}
export function moteurChoisi(etats) {
  const prefere = lireReglages().ia_moteur ?? null;
  if (prefere && etats?.[prefere]?.ok) return prefere;
  if (etats?.claude?.ok) return 'claude';
  if (etats?.codex?.ok) return 'codex';
  return prefere ?? 'claude';
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
