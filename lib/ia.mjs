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
import {MAC, WINDOWS, SYSTEME, trouver, commandeNode, pathAvec, envSansNavigateur, preparerLancement} from './plateforme.mjs';
import {lireReglages} from './reglages.mjs';
import {etatTreg} from './treg.mjs';

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
  rapide: {nom: 'Rapide', aide: 'Pour une retouche ou une question : souvent 5 à 10 minutes.'},
  soigne: {nom: 'Soigné', aide: 'Le bon équilibre pour une vidéo : souvent 15 à 30 minutes.'},
  max: {nom: 'Maximum', aide: 'Le plus beau résultat : souvent 40 à 70 minutes, l’IA pèse chaque choix.'},
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
 * La clé Treg ne part que si l'humain a laissé Treg à son IA (l'interrupteur de Connexions) : coupé, l'IA ne l'a pas.
 * `confier` à false : aucune de ces deux clés (les vérifications de version et de compte n'en ont jamais besoin, et
 * agy ne doit jamais recevoir la clé Treg, même pour dire quels modèles il a).
 */
export function envIA(extra = [], confier = true) {
  const env = envOutils(extra);
  const confiees = confier ? ['ELEVENLABS_API_KEY', ...(etatTreg().actif ? ['TREG_TOKEN'] : [])] : [];
  for (const k of Object.keys(env)) {
    if (/^(CLAUDE_|CODEX_)/i.test(k) || confiees.includes(k)) continue;
    if (/(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)/i.test(k)) delete env[k];
  }
  return env;
}

/**
 * Comment lancer un programme installé par npm : sous Windows, les « .cmd » passent par l'interpréteur de commandes, qui
 * abîme les arguments ; on lance plutôt Node sur le script JavaScript du paquet. Renvoie {cmd, prefixe}.
 */
/**
 * Ce que lance un script « .cmd » ou « .bat » de Windows (d'après son texte) : {cmd, prefixe}, ou null s'il n'y a rien à
 * en tirer. Les fichiers qu'il désigne depuis son propre dossier (« %dp0% », « %~dp0 ») : node.exe n'est que
 * l'interpréteur que npm cherche à côté ; la cible est le script JavaScript (lancé par Node), ou le programme (.exe) de
 * l'outil — les versions récentes de Claude Code installées par npm mènent à un claude.exe. Exportée pour les essais.
 */
export function cibleDuScript(texte, dossier, {existe = fs.existsSync, node = process.execPath, joindre = path.join} = {}) {
  const cibles = [...String(texte).matchAll(/"%~?dp0%?\\?([^"%]+?\.(?:js|mjs|cjs|exe|com))"/gi)]
    .map((m) => joindre(dossier, m[1])).filter((f) => !/[\\/]node\.exe$/i.test(f));
  const script = cibles.filter((f) => /\.(js|mjs|cjs)$/i.test(f)).pop();
  if (script) return {cmd: node, prefixe: [script]};
  const programme = cibles.filter((f) => /\.(exe|com)$/i.test(f) && existe(f)).pop();
  return programme ? {cmd: programme, prefixe: []} : null;
}
export function commandeLancement(chemin) {
  try {
    if (WINDOWS && /\.(cmd|bat)$/i.test(chemin)) {
      // ce que le script lance (son JavaScript, ou le programme de l’outil) ; sinon le script lui-même, par cmd.exe, avec
      // des arguments protégés (preparerLancement, lib/plateforme.mjs)
      return cibleDuScript(fs.readFileSync(chemin, 'utf8'), path.dirname(chemin)) ?? {cmd: chemin, prefixe: []};
    }
    const reel = fs.realpathSync(chemin);
    if (/\.(js|mjs|cjs)$/i.test(reel)) return {cmd: process.execPath, prefixe: [reel]};
  } catch { /* on lance tel quel */ }
  return {cmd: chemin, prefixe: []};
}
/**
 * Pose une question courte à un assistant (sa version, son compte), lancé comme pour un montage. Sous Windows, un
 * « codex.cmd » rangé dans un dossier dont le nom a une espace (C:\Users\Jean Dupont\…) ne se lançait pas par
 * l'interpréteur de commandes, qui coupait le chemin à l'espace : Codex, tout juste installé, était dit « pas installé ».
 */
function questionner(chemin, args, options) {
  const {cmd, prefixe} = commandeLancement(chemin);
  return lancer(cmd, [...prefixe, ...args], options);
}

// ——— l'état d'un assistant, gardé un moment ———
/** Une vérification qui vient de finir sert encore, même à qui demande de revérifier (deux écrans le demandent coup sur coup). */
const FRAIS = 2000;
/**
 * La mémoire de l'état d'un assistant, valable `duree` ms. Une seule vérification à la fois : pendant qu'elle tourne,
 * les autres demandes attendent la même au lieu de relancer chacune les mêmes programmes (à l'ouverture d'un projet,
 * Dérush lançait tout en double). Après oublier(), la demande suivante revérifie, et le résultat d'une vérification
 * commencée avant (une installation a fini entre-temps) n'est pas gardé.
 */
function memoire(duree) {
  const m = {t: 0, v: null, tour: 0, enCours: null};
  /** L'état gardé, s'il sert encore (à qui force : seulement s'il vient d'être vérifié). */
  m.connu = (force = false) => (m.v && Date.now() - m.t < (force ? FRAIS : duree) ? m.v : null);
  m.garder = (v) => { m.t = Date.now(); m.v = v; return v; };
  m.oublier = () => { m.t = 0; m.tour++; };
  /** Lance `calcul` (ou attend celui qui tourne déjà). `calcul` reçoit valable() : faux si l'état a été oublié en route. */
  m.verifier = (calcul) => {
    if (m.enCours?.tour === m.tour) return m.enCours.p;
    const tour = m.tour;
    const valable = () => tour === m.tour;
    const p = calcul(valable).then((v) => (valable() ? m.garder(v) : v)).finally(() => { if (m.enCours?.p === p) m.enCours = null; });
    m.enCours = {p, tour};
    return p;
  };
  return m;
}
/** `force` vaut true (tout revérifier), un nom (« codex ») ou une liste de noms : cet assistant en fait-il partie ? */
const vise = (force, nom) => (force === true ? nom !== 'gemini' || geminiSert() : force === nom || (Array.isArray(force) && force.includes(nom)));

// ——— Claude Code ———
const memoClaude = memoire(120000);
/** Cherche Claude Code (celui de l'app Claude, celui de l'installateur officiel, ou un autre) et garde le plus récent. */
export async function etatClaude(force = false) {
  return memoClaude.connu(force) ?? memoClaude.verifier(verifierClaude);
}
async function verifierClaude() {
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
      const {out} = await questionner(c, ['--version'], {env: envIA([], false), silenceMax: 20000});
      const version = /(\d+\.\d+\.\d+)/.exec(out.toString())?.[1];
      if (version && (!mieux || comparer(version, mieux.version) > 0)) mieux = {chemin: c, version};
    } catch { /* ce binaire ne se lance pas : on passe au suivant */ }
  }
  if (!mieux) return {ok: false, installable: true, pourquoi: 'Claude Code n’est pas encore installé.'};
  let connecte = false;
  try { connecte = JSON.parse((await questionner(mieux.chemin, ['auth', 'status'], {env: envIA([], false), silenceMax: 20000})).out.toString()).loggedIn === true; } catch { /* pas connecté */ }
  return connecte
    ? {ok: true, ...mieux, nom: `Claude Code ${mieux.version}`, detail: 'Connecté à ton compte Claude.'}
    : {ok: false, ...mieux, connectable: true, pourquoi: 'Claude Code n’est pas connecté à ton compte Claude.'};
}
/** Oublie les états gardés : tous (sans rien dire), ou ceux des assistants nommés (« codex », ['claude', 'gemini']). */
export const oublierEtats = (lesquels = true) => {
  if (vise(lesquels, 'claude')) memoClaude.oublier();
  if (vise(lesquels, 'codex')) memoCodex.oublier();
  if (vise(lesquels, 'gemini')) oublierGemini();
};
/**
 * L'état des trois assistants, et celui que l'humain a choisi (ou le premier prêt). `force` : true pour tout revérifier
 * (« Réessayer »), ou le nom, ou la liste des noms, des seuls assistants à revérifier (celui qu'on vient d'installer ou
 * de connecter) ; les autres gardent leur dernier état. « Tout revérifier » épargne agy : voir geminiSert.
 */
export async function etatIA(force = false) {
  const [claude, codex, gemini] = await Promise.all([etatClaude(vise(force, 'claude')), etatCodex(vise(force, 'codex')), etatGemini(vise(force, 'gemini'))]);
  return {claude, codex, gemini, choisi: moteurChoisi({claude, codex, gemini})};
}
/**
 * Le dernier état connu des trois assistants, rendu tout de suite (null tant qu'aucun n'a été vérifié) ; s'il a
 * vieilli, la vérification repart derrière, sans qu'on l'attende. Pour ce qui est relu en boucle pendant que l'IA
 * travaille : le suivi en direct ne doit pas se figer le temps de relancer « claude --version ».
 */
export function etatIAConnu() {
  const etats = {claude: memoClaude.v, codex: memoCodex.v, gemini: memoGemini.v};
  etatIA().catch(() => {});
  return etats.claude && etats.codex && etats.gemini ? {...etats, choisi: moteurChoisi(etats)} : null;
}
export function moteurChoisi(etats) {
  const prefere = lireReglages().ia_moteur ?? null;
  if (prefere && etats?.[prefere]?.ok) return prefere;
  for (const m of ['claude', 'codex', 'gemini']) if (etats?.[m]?.ok) return m;
  return IA[prefere] ? prefere : 'claude';
}

// ——— Codex ———
const DOSSIER_OUTILS = path.join(DOSSIER_SUPPORT, 'outils');
const memoCodex = memoire(60000);
/** Cherche Codex (celui que Dérush a installé, ou un autre) ; dit s'il est connecté à un compte ChatGPT. */
export async function etatCodex(force = false) {
  return memoCodex.connu(force) ?? memoCodex.verifier(verifierCodex);
}
async function verifierCodex() {
  const bin = WINDOWS ? 'codex.cmd' : 'codex';
  const candidats = [process.env.DERUSH_CODEX, path.join(DOSSIER_OUTILS, 'node_modules', '.bin', bin), trouver('codex'),
    path.join(os.homedir(), '.local', 'bin', 'codex'), '/opt/homebrew/bin/codex', '/usr/local/bin/codex', ...(WINDOWS ? [path.join(process.env.APPDATA ?? '', 'npm', 'codex.cmd')] : [])];
  let mieux = null;
  for (const c of [...new Set(candidats.filter((x) => x && fs.existsSync(x)))]) {
    try {
      const {out} = await questionner(c, ['--version'], {env: envIA([], false), silenceMax: 20000});
      const version = /(\d+\.\d+\.\d+)/.exec(out.toString())?.[1];
      if (version && (!mieux || comparer(version, mieux.version) > 0)) mieux = {chemin: c, version};
    } catch { /* ce binaire ne se lance pas */ }
  }
  if (!mieux) return {ok: false, installable: true, pourquoi: 'Codex n’est pas encore installé.'};
  let connecte = false;
  try { const r = await questionner(mieux.chemin, ['login', 'status'], {env: envIA([], false), silenceMax: 20000}); const s = `${r.out.toString()}\n${r.err}`; connecte = /logged in/i.test(s) && !/not logged in/i.test(s); } catch { /* pas connecté */ }
  return connecte
    ? {ok: true, ...mieux, nom: `Codex ${mieux.version}`, detail: 'Connecté à ton compte ChatGPT.'}
    : {ok: false, ...mieux, connectable: true, pourquoi: 'Codex n’est pas connecté à ton compte ChatGPT.'};
}
/** Installe Codex dans le dossier de Dérush (rien n'est installé ailleurs sur l'ordinateur). */
export async function installerCodex() {
  fs.mkdirSync(DOSSIER_OUTILS, {recursive: true});
  if (!fs.existsSync(path.join(DOSSIER_OUTILS, 'package.json'))) ecrireJson(path.join(DOSSIER_OUTILS, 'package.json'), {name: 'derush-outils', private: true}, 2);
  await lancer(commandeNode('npm'), ['install', '--no-audit', '--no-fund', '--loglevel=error', '@openai/codex@latest'], {cwd: DOSSIER_OUTILS, env: envOutils()});
  memoCodex.oublier();
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
  const {cmd, prefixe} = commandeLancement(chemin);
  const l = preparerLancement(cmd, [...prefixe, ...args], {env: envOutils(), stdio: 'ignore', detached: !WINDOWS, windowsHide: true});
  const p = spawn(l.cmd, l.args, l.options);
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
const memoGemini = memoire(30 * 60000);
// Ce que la dernière vraie vérification a trouvé (connecté, modèles du compte) : gardé d'une ouverture à l'autre, pour
// ne pas relancer « agy models » à chaque démarrage. Chaque lancement d'agy démarre son serveur de langage et son
// outil de mise à jour (une seconde de calcul, un journal de plus) ; et une commande qui doit se reconnecter pourrait
// ouvrir une page dans le navigateur. Dérush ne la lance donc que quand Gemini sert (choisi, ou vérifié dans Connexions).
const FICHIER_GEMINI = path.join(DOSSIER_SUPPORT, 'etat-gemini.json');
const DUREE_GEMINI = 12 * 3600 * 1000;
// « Tout revérifier » (etatIA(true), le bouton « Réessayer » de l'éditeur par exemple) ne relance agy que si Gemini
// sert : il est l'IA choisie, on vient de l'installer ou de le connecter d'ici, ou sa dernière vraie vérification a
// plus de 30 secondes. Le demander par son nom (etatGemini(true), etatIA('gemini')) le revérifie toujours : c'est ce
// que fait Connexions, qui ne revérifie que l'IA dont elle attend la connexion (toutes les 5 s, puis toutes les 15 s)
// et, une fois, ce qu'une installation vient d'installer quand elle finit (pendant l'installation, elle relit l'état
// sans rien revérifier). Avant, elle revérifiait tout toutes les 3,5 s pendant un quart d'heure après n'importe quelle
// installation, et agy était relancé des centaines de fois pour rien.
const REPOS_GEMINI = 30000;
let geminiAttendu = 0; // jusqu'à quand on guette un changement (installation ou connexion lancée d'ici)
let geminiVerifieLe = 0; // la fin de la dernière vraie vérification (agy lancé)
const geminiSert = () => lireReglages().ia_moteur === 'gemini' || Date.now() < geminiAttendu || Date.now() - geminiVerifieLe > REPOS_GEMINI;
const guetterGemini = () => { geminiAttendu = Date.now() + 15 * 60000; };
/** Oublie l'état de Gemini (après une installation ou une connexion) : la prochaine vérification relance agy. */
function oublierGemini() { memoGemini.oublier(); try { fs.rmSync(FICHIER_GEMINI, {force: true}); } catch { /* déjà parti */ } }
/** Cherche la commande agy ; dit si elle est connectée à un compte Google, et quels modèles elle propose. */
export async function etatGemini(force = false) {
  const connu = memoGemini.connu(force);
  if (connu) return connu;
  const exe = WINDOWS ? 'agy.exe' : 'agy';
  const candidats = [process.env.DERUSH_AGY, path.join(os.homedir(), '.local', 'bin', exe), trouver('agy'), '/opt/homebrew/bin/agy', '/usr/local/bin/agy',
    ...(WINDOWS ? [path.join(process.env.LOCALAPPDATA ?? '', 'agy', 'bin', exe)] : [])];
  const presents = [...new Set(candidats.filter((x) => x && fs.existsSync(x)))];
  if (!presents.length) return memoGemini.garder({ok: false, installable: true, pourquoi: 'Gemini (la commande agy d’Antigravity) n’est pas encore installé.'});
  if (!force) {
    // la dernière vérification suffit tant qu'elle est récente et que Gemini n'est pas l'IA choisie
    let garde = null;
    try { garde = JSON.parse(fs.readFileSync(FICHIER_GEMINI, 'utf8')); } catch { /* jamais vérifié */ }
    if (garde?.v && presents.includes(garde.v.chemin) && (lireReglages().ia_moteur !== 'gemini' || Date.now() - garde.t < DUREE_GEMINI)) return memoGemini.garder(garde.v);
  }
  // la vraie vérification : agy est lancé (une seule fois, même si plusieurs écrans la demandent en même temps)
  return memoGemini.verifier(async (valable) => {
    let mieux = null;
    for (const c of presents) {
      try {
        const {out} = await lancer(c, ['--version'], {env: envSansNavigateur(envIA([], false)).env, silenceMax: 20000});
        const version = /(\d+\.\d+\.\d+)/.exec(out.toString())?.[1];
        if (version && (!mieux || comparer(version, mieux.version) > 0)) mieux = {chemin: c, version};
      } catch { /* ce binaire ne se lance pas */ }
    }
    let v;
    if (!mieux) v = {ok: false, installable: true, pourquoi: 'Gemini (la commande agy d’Antigravity) ne se lance pas sur cet ordinateur.'};
    else {
      // « agy models » ne répond que connecté : il donne en même temps la liste des modèles du compte (Gemini 4 Argon,
      // Flash, Carbon pour certains comptes… et d'autres marques, que Dérush ne propose pas ici). Lancé sans
      // navigateur : s'il veut qu'on se connecte, il ne peut pas ouvrir de page, et Dérush le dit dans Connexions.
      const sans = envSansNavigateur(envIA([], false));
      let dit = '';
      try { const r = await lancer(mieux.chemin, ['models'], {env: sans.env, silenceMax: 30000}); dit = `${r.out.toString()}\n${r.err ?? ''}`; } catch (e) { dit = String(e?.message ?? e); }
      const modeles = [...new Set(dit.match(/\bgemini-[\w.]+(?:-[\w.]+)*\b/g) ?? [])];
      v = modeles.length && !/authentication required/i.test(dit) && !sans.demande()
        ? {ok: true, ...mieux, modeles, nom: `Gemini (agy ${mieux.version})`, detail: 'Connecté à ton compte Google.'}
        : {ok: false, ...mieux, connectable: true, pourquoi: 'Gemini n’est pas connecté à ton compte Google.'};
      // oublié en route (une installation ou une connexion vient de finir) : ce résultat n'est pas gardé
      if (valable()) { try { fs.mkdirSync(DOSSIER_SUPPORT, {recursive: true}); fs.writeFileSync(FICHIER_GEMINI, JSON.stringify({t: Date.now(), v})); } catch { /* pas grave */ } }
    }
    geminiVerifieLe = Date.now();
    return v;
  });
}
/** Installe la commande agy avec l'installateur officiel de Google. */
export function installerGemini() {
  const [cmd, args] = WINDOWS
    ? ['powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://antigravity.google/cli/install.ps1 | iex']]
    : ['bash', ['-c', 'curl -fsSL https://antigravity.google/cli/install.sh | bash']];
  guetterGemini();
  suivre('gemini', lancer(cmd, args, {env: envOutils()}).then(() => { oublierGemini(); }));
}
/**
 * La connexion de Gemini demande un vrai terminal (agy ouvre le navigateur à son premier lancement) : on ouvre donc une
 * fenêtre de terminal sur la commande, et l'humain se connecte lui-même.
 */
export function connecterGemini(chemin) {
  oublierGemini();
  guetterGemini();
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
  const args = ['-p', demande, '--output-format', 'stream-json', '--sandbox', '--settings', JSON.stringify(reglages),
    ...(modele ? ['--model', modele] : []), ...(session ? ['--conversation', session] : [])];
  if (ligneTropLongue(args)) throw new Error('Cette demande est trop longue pour Gemini sur cet ordinateur : ton message, la conversation et la liste de tes fichiers lui arrivent sur une seule ligne. Raccourcis ton message (ou mets ton texte dans un fichier joint avec le trombone), ou choisis Claude ou Codex pour cette fois (« Qui monte ? »).');
  return args;
}
/**
 * Une ligne de commande a une longueur limite : 32 767 caractères en tout sous Windows, 128 Ko par argument sous Linux
 * (macOS en accepte bien plus). agy reçoit la demande et ses permissions en arguments : un très long brief sur un projet
 * de dizaines de rushes peut la dépasser, et le système ne répond alors qu'une erreur en anglais (« spawn ENAMETOOLONG »).
 */
export function ligneTropLongue(args, systeme = SYSTEME) {
  // Windows : chaque argument est mis entre guillemets, et chacun de ses guillemets est précédé d'une barre
  if (systeme === 'windows') return args.reduce((n, a) => n + String(a).length + (String(a).match(/"/g)?.length ?? 0) + 3, 0) > 32000;
  if (systeme === 'linux') return args.some((a) => Buffer.byteLength(String(a)) > 130000);
  return false;
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
/**
 * Ce qu'agy n'a pas eu le droit de faire, en mots simples (les noms sont ceux de ses permissions). La phrase se lit
 * après « n'a pas eu le droit de » : elle commence toujours par une consonne (« de écrire », « de ouvrir » étaient des fautes).
 */
export function refusGemini(action) {
  const a = String(action ?? '').toLowerCase();
  if (/write/.test(a)) return 'créer ou de modifier un fichier hors de son dossier de travail';
  if (/read_file|view/.test(a)) return 'lire un fichier hors de son dossier de travail';
  if (/command|unsandboxed/.test(a)) return 'lancer une commande hors de son bac à sable';
  if (/execute_url|browser/.test(a)) return 'piloter un navigateur';
  if (/url/.test(a)) return 'lire une page web';
  if (/mcp/.test(a)) return 'se servir d’un connecteur';
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
 * Les connecteurs (serveurs MCP) que la personne a branchés dans son propre Codex, hors de Dérush : les noms des tables
 * « [mcp_servers.nom] » du config.toml de son dossier Codex. Seuls ces noms sont lus ; rien n'est modifié.
 */
export function connecteursCodex(fichier = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'config.toml')) {
  let texte = '';
  try { texte = fs.readFileSync(fichier, 'utf8'); } catch { return []; }
  const noms = new Set();
  const nom = '(?:"([^"\\n]+)"|\'([^\'\\n]+)\'|([A-Za-z0-9_-]+))';
  // [mcp_servers.nom], [mcp_servers."nom"], et leurs sous-tables ([mcp_servers.nom.env])
  for (const m of texte.matchAll(new RegExp(`^[ \\t]*\\[[ \\t]*mcp_servers[ \\t]*\\.[ \\t]*${nom}[ \\t]*[.\\]]`, 'gm'))) noms.add(m[1] ?? m[2] ?? m[3]);
  // sous une table [mcp_servers] : « nom = { … } » ou « nom.command = … »
  for (const bloc of texte.matchAll(/^[ \t]*\[[ \t]*mcp_servers[ \t]*\][^\n]*\n([\s\S]*?)(?=^[ \t]*\[|(?![\s\S]))/gm)) {
    for (const m of bloc[1].matchAll(new RegExp(`^[ \\t]*${nom}[ \\t]*[.=]`, 'gm'))) noms.add(m[1] ?? m[2] ?? m[3]);
  }
  // Codex n'accepte que ces noms-là ; un autre ne pourrait pas être désigné sans risque sur la ligne de commande
  return [...noms].filter((n) => /^[A-Za-z0-9_-]+$/.test(n));
}
/**
 * Les arguments de `codex exec` : bac à sable « écriture dans le dossier de travail », réseau autorisé (ElevenLabs, Treg),
 * et quelques dossiers en écriture en plus (le moteur de rendu, le dossier temporaire). Jamais sans bac à sable.
 * `mcp` : les connecteurs que Dérush donne (Treg). Ceux du Codex de la personne (`aCouper`) sont éteints pour cette
 * demande : l'IA d'un montage ne reçoit que ce qui est donné dans Connexions.
 */
export function argsCodex({session = null, reglage, ecrits = [], mcp = [], aCouper = connecteursCodex()}) {
  const donnes = new Set(mcp.map((a) => /^mcp_servers\.([A-Za-z0-9_-]+)\./.exec(String(a))?.[1]).filter(Boolean));
  const commun = ['--json', '--skip-git-repo-check', '-c', 'sandbox_workspace_write.network_access=true', '-c', `model_reasoning_effort=${toml(reglage.effort)}`,
    // l'environnement que Dérush donne à Codex est déjà trié (envIA) : on garde la clé ElevenLabs pour ses commandes,
    // mais la clé Treg reste à Codex (pour son serveur MCP) et n'arrive pas dans le terminal
    '-c', 'shell_environment_policy.ignore_default_excludes=true', '-c', 'shell_environment_policy.exclude=["TREG_TOKEN"]',
    ...(reglage.modele ? ['-m', reglage.modele] : []),
    ...aCouper.filter((n) => /^[A-Za-z0-9_-]+$/.test(n) && !donnes.has(n)).flatMap((n) => ['-c', `mcp_servers.${n}.enabled=false`]), ...mcp];
  return session
    ? ['exec', 'resume', ...commun, '-c', 'sandbox_mode="workspace-write"', '-c', `sandbox_workspace_write.writable_roots=${toml(ecrits)}`, session, '-']
    : ['exec', ...commun, '-s', 'workspace-write', ...ecrits.flatMap((d) => ['--add-dir', d]), '-'];
}
/**
 * Traduit un événement de `codex exec --json` en gestes lisibles. Renvoie {session, geste: {outil, entree} | null,
 * texte, erreur, fin}. Les « items » d'erreur qui ne sont que des avertissements de configuration sont ignorés.
 * `connecteur` : le nom du serveur MCP dont Codex appelle un outil, dit dès que l'appel commence (avant sa réponse),
 * pour que l'appelant puisse arrêter Codex s'il se sert d'un connecteur que Dérush ne lui a pas donné.
 */
export function lireEvenementCodex(j) {
  const it = j.item ?? {};
  if (j.type === 'thread.started') return {session: j.thread_id};
  if (j.type === 'turn.failed') return {erreur: j.error?.message ?? 'Codex a échoué.'};
  // une erreur « en route » (connexion coupée puis reprise, serveur MCP absent) n'arrête pas forcément le travail
  if (j.type === 'error') return {alerte: j.message ?? 'Erreur de Codex.'};
  if (j.type === 'turn.completed') return {fin: true, usage: j.usage ?? null};
  if (j.type === 'item.started' && it.type === 'command_execution') return {geste: {outil: 'Bash', entree: {command: String(it.command ?? '').replace(/^\S*(?:zsh|bash|sh|pwsh|powershell)(?:\.exe)?\s+-\w*c\s+/, '').replace(/^'(.*)'$/s, '$1').replace(/^"(.*)"$/s, '$1')}}};
  if (j.type === 'item.started' && it.type === 'mcp_tool_call') return {connecteur: String(it.server ?? '')};
  if (j.type !== 'item.completed') return {};
  if (it.type === 'agent_message') return {texte: String(it.text ?? '').trim()};
  if (it.type === 'file_change') {
    const chemins = (it.changes ?? []).map((x) => x.path).filter(Boolean);
    return chemins.length ? {geste: {outil: 'Edit', entree: {file_path: chemins[0], autres: chemins.length - 1}}} : {};
  }
  if (it.type === 'mcp_tool_call') return {connecteur: String(it.server ?? ''), geste: {outil: `mcp__${it.server ?? 'outil'}__${it.tool ?? ''}`, entree: it.arguments ?? {}}};
  if (it.type === 'web_search') return {geste: {outil: 'WebSearch', entree: {query: it.query ?? ''}}};
  return {};
}
