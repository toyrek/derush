// Dérush — brancher les apps d'IA sur la porte des IA (lib/porte-ia.mjs), d'un clic dans « Connexions » :
// - l'app Claude : Dérush fabrique une extension (Dérush.mcpb) et l'ouvre dans Claude, qui demande à la personne de
//   l'installer (Mac) ; sous Windows, une entrée dans claude_desktop_config.json (avec une copie de sécurité) ;
// - Claude Code : la commande officielle `claude mcp add --scope user` ;
// - ChatGPT (Codex, l'app ChatGPT et l'app Codex) : une section [mcp_servers.derush] dans le config.toml de Codex
//   (avec une copie de sécurité, la première fois) ;
// - les autres (Cursor, Gemini, Windsurf…) : la configuration à copier.
// Toutes lancent le même pont (outils/derush-mcp.mjs) par le lanceur du dossier de Dérush, réécrit à chaque ouverture.
// Rien n'est branché sans un clic de la personne ; « Débrancher » retire ce que Dérush a ajouté, et seulement cela.
// Idée reprise d'Editroom (Robbie Tilton, licence MIT) : l'extension .mcpb et la section de Codex.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {dossierSupport, dossierAppClaude, appMac, ouvrirAvecApp, ecrireLanceur, MAC, WINDOWS} from './plateforme.mjs';
import {RACINE_APP} from './moteurs.mjs';
import {VERSION} from './commun.mjs';
import {DEFINITIONS, NOM_SERVEUR} from './porte-ia-outils.mjs';

const maison = () => process.env.HOME || os.homedir();
/** L'environnement de la commande claude de la personne (son compte principal : sans le dossier d'un autre compte). */
const envClaude = () => { const e = {...process.env}; delete e.CLAUDE_CONFIG_DIR; return e; };
const dossierPorte = () => path.join(dossierSupport(), 'porte');
/** Le lanceur du pont (réécrit s'il a changé) : {fichier, command, args}. */
export const lanceur = () => ecrireLanceur(dossierPorte(), 'derush-mcp', process.execPath, path.join(RACINE_APP, 'outils', 'derush-mcp.mjs'));

export const APPS = {
  claude: {nom: 'Claude', logo: 'claude', aide: 'L’app Claude : tu lui demandes un montage, elle le fait dans Dérush.'},
  'claude-code': {nom: 'Claude Code', logo: 'claude', aide: 'Claude dans le Terminal (et dans l’onglet Code de l’app Claude).'},
  codex: {nom: 'ChatGPT', logo: 'openai', aide: 'Codex : dans l’app ChatGPT, l’app Codex ou le Terminal.'},
};

// ——— l'app Claude ———
const configClaude = () => path.join(dossierAppClaude(maison()), 'claude_desktop_config.json');
const lireJsonSur = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
/** L'extension Dérush est-elle installée dans l'app Claude (ou Dérush ajouté à la main dans ses réglages) ? */
export function brancheClaudeApp() {
  const ext = path.join(dossierAppClaude(maison()), 'Claude Extensions');
  try {
    for (const d of fs.readdirSync(ext)) if (lireJsonSur(path.join(ext, d, 'manifest.json'))?.name === NOM_SERVEUR) return true;
  } catch { /* pas d'extensions */ }
  return !!lireJsonSur(configClaude())?.mcpServers?.[NOM_SERVEUR];
}
const appClaude = () => appMac(['Claude'], maison());

// un fichier .zip sans dépendance (les fichiers rangés tels quels : une extension pèse quelques centaines de Ko)
const TABLE_CRC = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(b) { let c = 0xffffffff; for (const x of b) c = TABLE_CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
/** Un zip : [{nom, donnees}] → Buffer (les fichiers compressés quand ça vaut la peine). */
export function zip(fichiers) {
  const locaux = [];
  const centraux = [];
  let decalage = 0;
  for (const {nom, donnees} of fichiers) {
    const n = Buffer.from(nom, 'utf8');
    const brut = Buffer.isBuffer(donnees) ? donnees : Buffer.from(donnees, 'utf8');
    const serre = zlib.deflateRawSync(brut);
    const deflate = serre.length < brut.length;
    const corps = deflate ? serre : brut;
    const crc = crc32(brut);
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt16LE(0x0800, 6); l.writeUInt16LE(deflate ? 8 : 0, 8);
    l.writeUInt16LE(0, 10); l.writeUInt16LE(0x21, 12); l.writeUInt32LE(crc, 14); l.writeUInt32LE(corps.length, 18); l.writeUInt32LE(brut.length, 22);
    l.writeUInt16LE(n.length, 26); l.writeUInt16LE(0, 28);
    locaux.push(l, n, corps);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(0x031e, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(deflate ? 8 : 0, 10);
    c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(corps.length, 20); c.writeUInt32LE(brut.length, 24);
    c.writeUInt16LE(n.length, 28); c.writeUInt16LE(0, 30); c.writeUInt16LE(0, 32); c.writeUInt16LE(0, 34); c.writeUInt16LE(0, 36);
    c.writeUInt32LE((0o100644 << 16) >>> 0, 38); c.writeUInt32LE(decalage, 42);
    centraux.push(c, n);
    decalage += 30 + n.length + corps.length;
  }
  const central = Buffer.concat(centraux);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(fichiers.length, 8); fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(central.length, 12); fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, central, fin]);
}
const semver = (v) => { const p = String(v).split('.').filter((x) => /^\d+$/.test(x)); while (p.length < 3) p.push('0'); return p.slice(0, 3).join('.'); };

/** L'extension de l'app Claude (Dérush.mcpb) : son manifeste, l'icône de Dérush et un lanceur qui appelle celui du dossier de Dérush. */
export function fabriquerExtension() {
  const l = lanceur();
  const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
  const manifeste = {
    manifest_version: '0.3', name: NOM_SERVEUR, display_name: 'Dérush', version: semver(VERSION),
    description: 'Monter tes vidéos dans Dérush : poser, couper, régler le son et la couleur, titrer, créer la vidéo.',
    long_description: 'Claude monte dans Dérush, le logiciel de montage de ton ordinateur. Tu vois chacun de ses gestes sur la timeline (son curseur), et chacun s’annule d’un ⌘Z. Dérush doit être ouvert, avec le projet à monter.',
    author: {name: 'IABAI (association YABAÏ)', url: 'https://github.com/toyrek/derush'},
    homepage: 'https://github.com/toyrek/derush', license: 'GPL-3.0', icon: 'icon.png',
    server: {type: 'binary', entry_point: 'server/derush-mcp', mcp_config: {command: '/bin/sh', args: ['${__dirname}/server/derush-mcp']}},
    tools: DEFINITIONS.map((d) => ({name: d.name, description: `${d.description.split(/(?<=[.:]) /)[0].replace(/[ :]+$/, '')}${/[.!?]$/.test(d.description.split(/(?<=[.:]) /)[0]) ? '' : '.'}`})),
    keywords: ['vidéo', 'montage', 'video', 'editing', 'derush'],
    compatibility: {platforms: ['darwin']},
  };
  const fichiers = [
    {nom: 'manifest.json', donnees: JSON.stringify(manifeste, null, 2)},
    {nom: 'server/derush-mcp', donnees: `#!/bin/sh\n# Dérush — démarre le pont de la porte des IA (le lanceur du dossier de Dérush).\nexec /bin/sh ${q(l.fichier)} "$@"\n`},
    {nom: 'icon.png', donnees: fs.readFileSync(path.join(RACINE_APP, 'public', 'marque', 'derush-512.png'))},
  ];
  fs.mkdirSync(dossierPorte(), {recursive: true});
  const f = path.join(dossierPorte(), 'Dérush.mcpb');
  fs.writeFileSync(f, zip(fichiers));
  return {fichier: f, manifeste};
}

// ——— Claude Code ———
const fichierClaudeCode = () => path.join(maison(), '.claude.json');
/** Dérush est-il dans les serveurs MCP de Claude Code (portée « utilisateur ») ? Seule cette entrée est lue. */
export const brancheClaudeCode = () => !!lireJsonSur(fichierClaudeCode())?.mcpServers?.[NOM_SERVEUR];

// ——— Codex (ChatGPT) ———
const dossierCodex = () => process.env.CODEX_HOME || path.join(maison(), '.codex');
const fichierCodex = () => path.join(dossierCodex(), 'config.toml');
const ENTETE = `[mcp_servers.${NOM_SERVEUR}]`;
const NOTE_CODEX = '# Dérush (la porte des IA) : ajouté par Dérush ; « Débrancher » dans Dérush › Connexions le retire.';
/** Le texte de config.toml sans la section de Dérush (ni ses sous-tables, ni sa ligne d'explication). */
export function sansDerush(texte) {
  const res = [];
  let dedans = false;
  for (const ligne of String(texte).split(/\r?\n/)) {
    const t = ligne.trim();
    if (/^\[/.test(t)) dedans = t === ENTETE || t.startsWith(`[mcp_servers.${NOM_SERVEUR}.`);
    if (dedans || t === NOTE_CODEX) continue;
    res.push(ligne);
  }
  while (res.length && res.at(-1).trim() === '') res.pop();
  return res.join('\n');
}
export const brancheCodex = () => { try { return fs.readFileSync(fichierCodex(), 'utf8').split(/\r?\n/).some((l) => l.trim() === ENTETE); } catch { return false; } };
/** Une chaîne TOML (guillemets doubles ; JSON écrit les mêmes échappements). */
const toml = (s) => JSON.stringify(String(s));
function brancherCodex() {
  const l = lanceur();
  fs.mkdirSync(dossierCodex(), {recursive: true});
  const f = fichierCodex();
  const avant = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const copie = path.join(dossierCodex(), 'config.toml.avant-derush');
  if (avant && !fs.existsSync(copie)) fs.writeFileSync(copie, avant);
  const base = sansDerush(avant);
  const section = [NOTE_CODEX, ENTETE, `command = ${toml(l.command)}`, `args = [${l.args.map(toml).join(', ')}]`, 'startup_timeout_sec = 30', 'tool_timeout_sec = 300'].join('\n');
  fs.writeFileSync(f, `${base ? `${base}\n\n` : ''}${section}\n`);
}
function debrancherCodex() {
  const f = fichierCodex();
  if (!fs.existsSync(f)) return;
  const reste = sansDerush(fs.readFileSync(f, 'utf8'));
  fs.writeFileSync(f, reste ? `${reste}\n` : '');
}

// ——— l'état, et les gestes ———
/** Où en est chaque app : présente sur cet ordinateur, branchée sur Dérush. `claude` : le chemin de la commande claude. */
export function etatApps({claude = null} = {}) {
  return {
    claude: {...APPS.claude, presente: !!appClaude() || WINDOWS || brancheClaudeApp(), branchee: brancheClaudeApp(), possible: MAC || WINDOWS},
    'claude-code': {...APPS['claude-code'], presente: !!claude, branchee: brancheClaudeCode(), possible: true},
    codex: {...APPS.codex, presente: !!appMac(['ChatGPT', 'Codex'], maison()) || fs.existsSync(dossierCodex()), branchee: brancheCodex(), possible: true},
  };
}
/** La configuration à copier dans une autre app d'IA (Cursor, Gemini, Windsurf…). */
export function configAutres() {
  const l = lanceur();
  return JSON.stringify({mcpServers: {[NOM_SERVEUR]: {command: l.command, args: l.args}}}, null, 2);
}

/**
 * Branche une app. Rend {fait, attente?, message}. `claude` : le chemin de la commande claude (Claude Code).
 * L'app Claude sur Mac : l'extension s'ouvre dans Claude, qui demande à la personne de l'installer (« attente »).
 */
export function brancherApp(app, {claude = null, ouvrir = true} = {}) {
  if (app === 'codex') {
    brancherCodex();
    return {fait: true, message: 'Dérush est dans les réglages de Codex : redémarre l’app ChatGPT (ou Codex) pour qu’elle le voie.'};
  }
  if (app === 'claude-code') {
    if (!claude) throw new Error('Claude Code n’est pas sur cet ordinateur.');
    const l = lanceur();
    spawnSync(claude, ['mcp', 'remove', '--scope', 'user', NOM_SERVEUR], {encoding: 'utf8', timeout: 20000, env: envClaude()});
    const r = spawnSync(claude, ['mcp', 'add', '--scope', 'user', NOM_SERVEUR, '--', l.command, ...l.args], {encoding: 'utf8', timeout: 20000, env: envClaude()});
    if (r.status !== 0) throw new Error(`Claude Code a refusé : ${String(r.stderr || r.stdout || r.error?.message || '').trim().slice(0, 300)}`);
    return {fait: true, message: 'Dérush est dans Claude Code : une nouvelle session le verra (/mcp pour vérifier).'};
  }
  if (app === 'claude') {
    if (WINDOWS) {
      const f = configClaude();
      const j = lireJsonSur(f) ?? {};
      if (fs.existsSync(f) && !fs.existsSync(`${f}.avant-derush`)) fs.copyFileSync(f, `${f}.avant-derush`);
      const l = lanceur();
      j.mcpServers = {...(j.mcpServers ?? {}), [NOM_SERVEUR]: {command: l.command, args: l.args}};
      fs.mkdirSync(path.dirname(f), {recursive: true});
      fs.writeFileSync(f, JSON.stringify(j, null, 2));
      return {fait: true, message: 'Dérush est dans les réglages de l’app Claude : quitte-la et rouvre-la.'};
    }
    if (!MAC) throw new Error('L’app Claude n’existe pas pour ce système : branche Claude Code, ou copie la configuration.');
    const {fichier} = fabriquerExtension();
    const a = appClaude();
    if (!a) throw new Error('L’app Claude n’est pas sur ce Mac (claude.ai/download).');
    if (ouvrir) ouvrirAvecApp(fichier, a);
    return {fait: false, attente: true, fichier, message: 'Claude s’ouvre et te propose l’extension Dérush : clique sur « Installer ».'};
  }
  throw new Error(`App inconnue : ${app}`);
}
/** Débranche une app : retire ce que Dérush a ajouté. L'extension de l'app Claude se retire dans Claude (rien ne la supprime d'ici). */
export function debrancherApp(app, {claude = null} = {}) {
  if (app === 'codex') { debrancherCodex(); return {fait: true, message: 'Dérush n’est plus dans les réglages de Codex.'}; }
  if (app === 'claude-code') {
    if (!claude) throw new Error('Claude Code n’est pas sur cet ordinateur.');
    spawnSync(claude, ['mcp', 'remove', '--scope', 'user', NOM_SERVEUR], {encoding: 'utf8', timeout: 20000, env: envClaude()});
    return {fait: !brancheClaudeCode(), message: 'Dérush n’est plus dans Claude Code.'};
  }
  if (app === 'claude') {
    const f = configClaude();
    const j = lireJsonSur(f);
    if (j?.mcpServers?.[NOM_SERVEUR]) { delete j.mcpServers[NOM_SERVEUR]; fs.writeFileSync(f, JSON.stringify(j, null, 2)); }
    return {fait: !brancheClaudeApp(), message: brancheClaudeApp() ? 'Dans l’app Claude : Réglages › Extensions › Dérush › Désinstaller.' : 'Dérush n’est plus dans l’app Claude.'};
  }
  throw new Error(`App inconnue : ${app}`);
}
