#!/usr/bin/env node
// Dérush — le pont de la porte des IA : ce que lance une app d'IA (l'app Claude, Codex et l'app ChatGPT, Claude Code,
// Gemini, Cursor…) pour monter dans Dérush. Elle lui parle en MCP par l'entrée et la sortie standard (une ligne de JSON
// par message) ; le pont passe chaque message à Dérush ouvert sur cet ordinateur (lib/porte-ia.mjs : le port et la clé
// sont dans porte-ia.json, dans le dossier de Dérush). Dérush fermé : le pont répond lui-même (la liste des outils), et
// chaque outil dit d'ouvrir Dérush. Rien d'autre que du JSON ne sort sur la sortie standard ; les messages vont sur
// la sortie d'erreur.
//   node outils/derush-mcp.mjs            (lancé par l'app d'IA)
//   node outils/derush-mcp.mjs --verifier (dit si Dérush répond, pour la personne)
import fs from 'node:fs';
import http from 'node:http';
import readline from 'node:readline';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const lib = (m) => import(pathToFileURL(path.join(ICI, '..', 'lib', m)).href);
const {dossierSupport} = await lib('plateforme.mjs');
const {DEFINITIONS, CONSIGNES_PORTE, NOM_SERVEUR, nomClient} = await lib('porte-ia-outils.mjs');
const {VERSION} = await lib('commun.mjs');
const PROTOCOLES = ['2025-06-18', '2025-03-26', '2024-11-05'];
const FICHIER = path.join(dossierSupport(), 'porte-ia.json');

const dire = (...a) => process.stderr.write(`[derush-mcp] ${a.join(' ')}\n`);
const ecrire = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
const lirePorte = () => { try { return JSON.parse(fs.readFileSync(FICHIER, 'utf8')); } catch { return null; } };

let session = null; // l'identifiant de session donné par Dérush
let protocole = null;
let initialisation = null; // le message initialize de l'app, pour le rejouer quand Dérush s'ouvre (ou se relance)
let nomIA = process.env.DERUSH_PORTE_IA || null; // le nom montré sur le curseur de l'IA

/** Envoie un message à Dérush ; rend {code, corps, entetes} ou lève une erreur « fermé ». */
function poster(msg, porte) {
  return new Promise((ok, ko) => {
    const corps = JSON.stringify(msg);
    const req = http.request({
      host: '127.0.0.1', port: porte.port, path: '/mcp', method: 'POST',
      headers: {
        'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'Content-Length': Buffer.byteLength(corps),
        Authorization: `Bearer ${porte.cle}`, ...(session ? {'Mcp-Session-Id': session} : {}), ...(protocole ? {'MCP-Protocol-Version': protocole} : {}),
        ...(nomIA ? {'x-derush-ia': nomIA} : {}),
      },
    }, (res) => {
      let b = '';
      res.setEncoding('utf8');
      res.on('data', (x) => { b += x; });
      res.on('end', () => ok({code: res.statusCode, corps: b, entetes: res.headers}));
    });
    req.on('error', (e) => ko(Object.assign(new Error('fermé'), {ferme: true, cause: e})));
    req.setTimeout(300000, () => req.destroy(new Error('trop long')));
    req.end(corps);
  });
}

/** Le message passe à Dérush ; null si Dérush est fermé. */
async function versDerush(msg, {rejouer = true} = {}) {
  const porte = lirePorte();
  if (!porte?.port || !porte?.cle) return null;
  let r;
  try { r = await poster(msg, porte); } catch (e) { if (e.ferme) return null; throw e; }
  if (r.entetes['mcp-session-id']) session = String(r.entetes['mcp-session-id']);
  if (r.code === 202) return {vide: true};
  // Dérush relancé avec une autre clé (dossier de Dérush refait) : on relit le fichier une fois
  if (r.code === 401 && rejouer) return versDerush(msg, {rejouer: false});
  let j = null;
  try { j = JSON.parse(r.corps); } catch { /* pas du JSON */ }
  if (!j) throw new Error(`Dérush a répondu ${r.code}.`);
  return {json: j};
}

/** Dérush vient de s'ouvrir (ou de se relancer) : on lui rejoue l'initialisation de l'app. */
async function initialiserDerush() {
  if (!initialisation) return false;
  session = null;
  const r = await versDerush({...initialisation, id: `pont-${Date.now()}`});
  if (!r) return false;
  await versDerush({jsonrpc: '2.0', method: 'notifications/initialized'}).catch(() => {});
  return true;
}

const FERME = 'Dérush n’est pas ouvert sur cet ordinateur : ouvre Dérush (et le projet à monter), puis recommence. Rien n’a été changé.';
let derushVu = false; // l'initialisation a-t-elle été faite par Dérush lui-même ?

async function traiter(msg) {
  const id = msg?.id;
  const requete = typeof msg?.method === 'string' && id !== undefined && id !== null;
  if (msg?.method === 'initialize') {
    initialisation = msg;
    protocole = PROTOCOLES.includes(msg.params?.protocolVersion) ? msg.params.protocolVersion : PROTOCOLES[0];
    nomIA = process.env.DERUSH_PORTE_IA || nomClient(msg.params?.clientInfo);
  }
  let r = null;
  try {
    // une session faite pendant que Dérush était fermé : il s'est ouvert depuis, on l'initialise d'abord
    if (initialisation && !derushVu && msg?.method !== 'initialize') derushVu = await initialiserDerush();
    r = await versDerush(msg);
    if (r && msg?.method === 'initialize') derushVu = true;
    if (!r) derushVu = false;
  } catch (e) {
    dire('erreur :', e.message);
    if (requete) ecrire({jsonrpc: '2.0', id, error: {code: -32603, message: `Dérush n’a pas pu répondre : ${e.message}`}});
    return;
  }
  if (r?.json) return ecrire(r.json);
  if (r?.vide || !requete) return;
  // Dérush est fermé : le pont répond lui-même
  switch (msg.method) {
    case 'initialize':
      return ecrire({jsonrpc: '2.0', id, result: {protocolVersion: protocole, capabilities: {tools: {listChanged: false}}, serverInfo: {name: NOM_SERVEUR, title: 'Dérush', version: VERSION}, instructions: CONSIGNES_PORTE}});
    case 'ping': return ecrire({jsonrpc: '2.0', id, result: {}});
    case 'tools/list': return ecrire({jsonrpc: '2.0', id, result: {tools: DEFINITIONS}});
    case 'tools/call': return ecrire({jsonrpc: '2.0', id, result: {content: [{type: 'text', text: FERME}], isError: true}});
    default: return ecrire({jsonrpc: '2.0', id, error: {code: -32601, message: `Méthode inconnue : ${msg.method}`}});
  }
}

if (process.argv.includes('--verifier')) {
  const porte = lirePorte();
  if (!porte) { console.log(`Dérush n’a pas encore ouvert sa porte (${FICHIER} manque) : ouvre Dérush une fois.`); process.exit(1); }
  const r = await versDerush({jsonrpc: '2.0', id: 1, method: 'ping'}).catch(() => null);
  console.log(r?.json ? `Dérush répond (port ${porte.port}).` : 'Dérush est fermé pour l’instant : la porte s’ouvrira avec lui.');
  process.exit(r?.json ? 0 : 2);
}

const lignes = readline.createInterface({input: process.stdin, crlfDelay: Infinity});
const enCours = new Set();
lignes.on('line', (l) => {
  const t = l.trim();
  if (!t) return;
  let msg;
  try { msg = JSON.parse(t); } catch { return ecrire({jsonrpc: '2.0', id: null, error: {code: -32700, message: 'JSON illisible.'}}); }
  // un lot de messages (ancien protocole) : chacun à son tour, réponses ensemble
  const p = Array.isArray(msg) ? Promise.all(msg.map(traiter)) : traiter(msg);
  enCours.add(p);
  p.finally(() => enCours.delete(p));
});
lignes.on('close', async () => {
  await Promise.allSettled([...enCours]);
  process.exit(0);
});
