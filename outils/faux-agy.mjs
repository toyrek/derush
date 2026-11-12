#!/usr/bin/env node
// Dérush — une fausse commande « agy » (pour qui modifie Dérush) : elle parle comme la documentation officielle le décrit
// (antigravity.google/docs/cli/headless) : --version, models, et -p … --output-format stream-json. Elle sert à essayer
// le moteur Gemini sans la vraie commande ni compte Google :
//   DERUSH_AGY=$PWD/outils/faux-agy.mjs AGY_FAUX=montage AGY_FAUX_VIDEO=<une vidéo .mp4> AGY_FAUX_TABLE=<un timeline.json> \
//     DERUSH_SUPPORT=<dossier d'essai> DERUSH_BIBLIOTHEQUE=<dossier d'essai> DERUSH_SANS_NAVIGATEUR=1 node derush.mjs --port 4334
// AGY_FAUX : normal | montage (livre une vidéo et une table de montage) | conseil (écrit reponse.json) | auth | erreur.
import fs from 'node:fs';
import path from 'node:path';
const a = process.argv.slice(2);
const sc = process.env.AGY_FAUX ?? 'normal';
const dire = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
if (a[0] === '--version') { console.log('agy 1.6.2'); process.exit(0); }
if (sc === 'auth') { console.error('ERROR: authentication required. Run `agy` to sign in.'); process.exit(1); }
if (a[0] === 'models') { console.log(['gemini-4-carbon-high', 'gemini-4-carbon-medium', 'gemini-4-carbon-low', 'gemini-4-argon-high', 'gemini-4-argon-medium', 'gemini-3.8-flash-high', 'gemini-3.8-flash-medium', 'gemini-3.1-pro-high'].map((s) => `  ${s}`).join('\n')); process.exit(0); }
const i = a.findIndex((x) => x === '-p' || x === '--print' || x === '--prompt');
if (i < 0) { console.error('interactive mode is not available here'); process.exit(1); }
const prompt = a[i + 1] ?? '';
const opt = (n) => { const k = a.indexOf(n); return k >= 0 ? a[k + 1] : null; };
const conv = opt('--conversation') ?? 'conv_faux_0001';
fs.writeFileSync(path.join(process.cwd(), '.agy-faux.json'), JSON.stringify({args: a.map((x) => (x === prompt ? `<prompt de ${prompt.length} caractères>` : x)), cwd: process.cwd(), treg: !!process.env.TREG_TOKEN, relais: !!process.env.DERUSH_RELAIS, cle_gemini: !!process.env.GEMINI_API_KEY, agents_md: fs.existsSync('AGENTS.md'), competences: fs.existsSync('.agents/skills') ? fs.readdirSync('.agents/skills').length : 0}, null, 1));
dire({event: 'init', init: {cwd: process.cwd(), tools: ['run_command', 'read_file', 'write_file', 'search_web'], permission_mode: 'request-review', model: opt('--model')}});
let n = 0;
const outil = async (nom, parametres, sortie = 'ok') => { const k = ++n; dire({event: 'step_update', step_update: {conversation_id: conv, step_index: k, state: 'ACTIVE', step_type: 'tool', tool_name: nom}}); await attendre(150); dire({event: 'step_update', step_update: {conversation_id: conv, step_index: k, state: 'DONE', step_type: 'tool', tool_name: nom, tool_info: {name: nom, parameters: parametres, output: sortie}, duration_seconds: 0.15}}); };
const parler = async (texte) => { const k = ++n; for (const m of texte.match(/.{1,24}/gs)) { dire({event: 'step_update', step_update: {conversation_id: conv, step_index: k, state: 'ACTIVE', step_type: 'agent_response', text_delta: m}}); await attendre(20); } dire({event: 'step_update', step_update: {conversation_id: conv, step_index: k, state: 'DONE', step_type: 'agent_response'}}); };
await outil('read_file', {path: path.join(process.cwd(), 'AGENTS.md')});
let reponse = 'Voilà.';
if (sc === 'conseil') {
  // un avis : la réponse est un fichier JSON du dossier
  await outil('write_file', {path: path.join(process.cwd(), 'reponse.json')});
  fs.writeFileSync('reponse.json', process.env.AGY_FAUX_REPONSE ?? '{"ok": true}');
  reponse = 'Mon avis est dans reponse.json.';
} else if (sc === 'montage') {
  // un montage : une vidéo livrée, et la table de montage tenue à jour
  fs.mkdirSync('rendu', {recursive: true});
  await outil('run_command', {command: 'node remotion/rendre.mjs Montage rendu/final.mp4', description: 'Rend la vidéo'});
  if (process.env.AGY_FAUX_VIDEO) fs.copyFileSync(process.env.AGY_FAUX_VIDEO, 'rendu/final.mp4');
  if (process.env.AGY_FAUX_TABLE) fs.copyFileSync(process.env.AGY_FAUX_TABLE, 'rendu/timeline.json');
  reponse = 'J’ai monté ta vidéo : un titre au début, les deux meilleurs passages, une musique douce dessous. Dis-moi si le titre te convient.';
}
await parler(reponse);
dire({event: 'result', result: {conversation_id: conv, status: sc === 'erreur' ? 'ERROR' : 'SUCCESS', response: reponse, ...(sc === 'erreur' ? {error: 'model overloaded'} : {}), duration_seconds: 1.2, num_turns: 1, usage: {input_tokens: 1200, output_tokens: 80, thinking_tokens: 0, cache_read_tokens: 0, total_tokens: 1280}}});
