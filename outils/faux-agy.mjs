#!/usr/bin/env node
// Dérush — une fausse commande « agy » (pour qui modifie Dérush). Elle parle comme la vraie (agy 1.5.6, observée en
// novembre 2026) : --version, models, et -p … --output-format stream-json (init, step_update, result). Comme la vraie :
//   - elle refuse d'écrire dans son dossier si les réglages de la session (--settings) ne le permettent pas ;
//   - elle prévient si on lui demande « --mode auto » (ce mode n'existe pas pour tous les comptes) ;
//   - elle ne lit pas l'entrée standard : la demande est l'argument de -p.
// Elle sert à essayer le moteur Gemini sans compte Google :
//   DERUSH_AGY=$PWD/outils/faux-agy.mjs AGY_FAUX=montage AGY_FAUX_VIDEO=<une vidéo .mp4> AGY_FAUX_TABLE=<un timeline.json> \
//     DERUSH_SUPPORT=<dossier d'essai> DERUSH_BIBLIOTHEQUE=<dossier d'essai> DERUSH_SANS_NAVIGATEUR=1 node derush.mjs --port 4334
// AGY_FAUX : normal | montage (livre une vidéo et une table de montage) | conseil (écrit reponse.json) | auth | erreur.
// AGY_FAUX_RENDU=<Composition> : dans « montage », lance pour de vrai « node remotion/rendre.mjs <Composition> rendu/final.mp4 »
//   (le rendu passe alors par le relais de Dérush, comme avec la vraie commande).
// AGY_FAUX_MODELES=perso : la liste d'un compte personnel (Gemini 4 Argon et Flash, sans Carbon).
// AGY_FAUX_ANNEXES=1 : dans « montage », remet aussi deux fichiers dans rendu/livraison/annexes/.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const a = process.argv.slice(2);
const sc = process.env.AGY_FAUX ?? 'normal';
const dire = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
if (a[0] === '--version') { console.log('1.5.6'); process.exit(0); }
if (sc === 'auth') { console.error('ERROR: authentication required. Run `agy` to sign in.'); process.exit(1); }
if (a[0] === 'models') {
  const perso = ['gemini-4-argon-medium', 'gemini-4-argon-high', 'gemini-4-argon-low', 'gemini-3.8-flash-high', 'gemini-3.8-flash-medium', 'gemini-3.8-flash-low', 'claude-opus-5-5-high', 'claude-sonnet-5-5-medium', 'gpt-oss-120b-medium'];
  const tous = ['gemini-4-carbon-high', 'gemini-4-carbon-medium', 'gemini-4-carbon-low', ...perso, 'gemini-3.1-pro-high'];
  const nom = (s) => s.replace(/-(low|medium|high)$/, (x, e) => ` (${e[0].toUpperCase()}${e.slice(1)})`).split('-').map((x) => x[0].toUpperCase() + x.slice(1)).join(' ');
  console.log((process.env.AGY_FAUX_MODELES === 'perso' ? perso : tous).map((s) => `${s}\t${nom(s)}`).join('\n'));
  process.exit(0);
}
const i = a.findIndex((x) => x === '-p' || x === '--print' || x === '--prompt');
if (i < 0) { console.error('interactive mode is not available here'); process.exit(1); }
const prompt = a[i + 1] ?? '';
const opt = (n) => { const k = a.indexOf(n); return k >= 0 ? a[k + 1] : null; };
const conv = opt('--conversation') ?? 'faux0001-0000-4000-8000-000000000001';
if (opt('--mode') === 'auto') console.error('warning: --mode auto is not available for this account; continuing in the default mode.');
// les réglages de la session : en ligne (un objet JSON) ou dans un fichier
let reglages = null;
try { const v = opt('--settings'); if (v) reglages = JSON.parse(v.trim().startsWith('{') ? v : fs.readFileSync(v, 'utf8')); } catch { reglages = null; }
const permis = (action, cible) => (reglages?.permissions?.allow ?? []).some((r) => {
  const m = /^(\w+)\((.*)\)$/s.exec(r);
  if (!m || (m[1] !== action && !(action === 'read_file' && m[1] === 'write_file'))) return false;
  return m[2] === '*' || cible === m[2] || cible.startsWith(m[2].endsWith(path.sep) ? m[2] : m[2] + path.sep);
});
const refus = [];
// une trace de l'appel, pour les essais (jamais la demande elle-même)
fs.mkdirSync(process.env.AGY_FAUX_TRACE ?? process.cwd(), {recursive: true});
fs.writeFileSync(path.join(process.env.AGY_FAUX_TRACE ?? process.cwd(), '.agy-faux.json'), JSON.stringify({
  args: a.map((x) => (x === prompt ? `<prompt de ${prompt.length} caractères>` : x)), cwd: process.cwd(), reglages,
  treg: !!process.env.TREG_TOKEN, relais: !!process.env.DERUSH_RELAIS, boite: process.env.DERUSH_RELAIS_BOITE ?? null, relais_jeton: !!process.env.DERUSH_RELAIS_JETON,
  node_proxy: process.env.NODE_USE_ENV_PROXY ?? null, entree_standard: !process.stdin.isTTY,
}, null, 1));
dire({event: 'init', conversation_id: conv, init: {model: opt('--model') ?? 'gemini-3.8-flash-low', cwd: process.cwd(), tools: ['run_command', 'command_status', 'view_file', 'list_dir', 'grep_search', 'write_to_file', 'replace_file_content', 'read_url_content', 'search_web'], permission_mode: reglages?.toolPermission ?? 'request-review'}});
let n = 0;
dire({event: 'step_update', step_update: {conversation_id: conv, step_index: n, state: 'DONE', step_type: 'user_input'}});
/** Un outil : annoncé (ACTIVE), puis fini (DONE avec sa sortie) ou refusé (ERROR, comme la vraie commande sans permission). */
const outil = async (nom, parametres, faire = async () => 'ok', action = null, cible = null) => {
  const k = ++n;
  const base = {conversation_id: conv, step_index: k, step_type: 'tool', tool_name: nom};
  dire({event: 'step_update', step_update: {...base, state: 'ACTIVE', tool_info: {name: nom, parameters: parametres}}});
  await attendre(120);
  if (action && !permis(action, cible)) {
    refus.push({action, display_name: action === 'write_file' ? 'WriteFile' : action});
    dire({event: 'step_update', step_update: {...base, state: 'ERROR', duration_seconds: 0.03, tool_info: {name: nom, parameters: parametres, error: {type: 'TOOL_ERROR', message: `permission check failed for ${action} "${cible}": user denied permission for ${action}(${cible})\nDo not attempt to circumvent this denial.`}}}});
    return false;
  }
  const sortie = await faire();
  dire({event: 'step_update', step_update: {...base, state: 'DONE', duration_seconds: 0.15, tool_info: {name: nom, parameters: parametres, output: String(sortie ?? '')}}});
  return true;
};
const parler = async (texte) => {
  const k = ++n;
  for (const m of texte.match(/.{1,24}/gs) ?? []) { dire({event: 'step_update', step_update: {conversation_id: conv, step_index: k, state: 'ACTIVE', step_type: 'agent_response', text_delta: m}}); await attendre(30); }
  dire({event: 'step_update', step_update: {conversation_id: conv, step_index: k, state: 'DONE', step_type: 'agent_response', text_delta: '\n', duration_seconds: 0.4, usage: {input_tokens: 120, output_tokens: 40}}});
};
const ecrire = (nom, contenu) => outil('write_file', {Path: path.join(process.cwd(), nom)}, async () => { fs.mkdirSync(path.dirname(path.resolve(nom)), {recursive: true}); fs.writeFileSync(nom, contenu); return 'ok'; }, 'write_file', path.join(process.cwd(), nom));
const commande = (ligne, faire) => outil('run_command', {CommandLine: ligne}, faire);

await outil('view_file', {AbsolutePath: path.join(process.cwd(), 'AGENTS.md')});
let reponse = 'Voilà.';
if (sc === 'conseil') {
  // un avis : la réponse est un fichier JSON du dossier
  reponse = (await ecrire('reponse.json', process.env.AGY_FAUX_REPONSE ?? '{"ok": true}')) ? 'Mon avis est dans reponse.json.' : '';
} else if (sc === 'montage') {
  // un montage : la table de montage tenue à jour, puis une vidéo livrée
  let ok = true;
  if (process.env.AGY_FAUX_TABLE) ok = await ecrire('rendu/timeline.json', fs.readFileSync(process.env.AGY_FAUX_TABLE, 'utf8'));
  if (ok && process.env.AGY_FAUX_RENDU) {
    // le vrai script de rendu du kit : il passe par le relais de Dérush (la boîte), comme avec la vraie commande
    await commande(`node remotion/rendre.mjs ${process.env.AGY_FAUX_RENDU} rendu/final.mp4`, () => new Promise((fini) => {
      const p = spawn(process.execPath, ['remotion/rendre.mjs', process.env.AGY_FAUX_RENDU, 'rendu/final.mp4'], {stdio: ['ignore', 'pipe', 'pipe']});
      let dit = '';
      p.stdout.on('data', (d) => { dit += d; });
      p.stderr.on('data', (d) => { dit += d; });
      p.on('close', (code) => fini(`Command exited with code ${code}.\n\nCommand output:\n${dit.slice(-1500)}`));
    }));
  } else if (ok) {
    await commande('node remotion/rendre.mjs Montage rendu/final.mp4', async () => { fs.mkdirSync('rendu', {recursive: true}); if (process.env.AGY_FAUX_VIDEO) fs.copyFileSync(process.env.AGY_FAUX_VIDEO, 'rendu/final.mp4'); return 'Command exited with code 0.'; });
  }
  // d'autres fichiers remis avec la vidéo (AGY_FAUX_ANNEXES=1) : Dérush doit les ranger à côté d'elle
  if (ok && process.env.AGY_FAUX_ANNEXES) {
    await ecrire('rendu/livraison/annexes/storyboard.md', '# Storyboard\n\n0 s : titre. 3 s : date et lieu. 6 s : carton de fin.\n');
    await ecrire('rendu/livraison/annexes/sons/polices-et-sons.md', '# Polices et sons\n\nAnton (SIL Open Font License). Aucun son.\n');
  }
  reponse = ok ? 'J’ai monté ta vidéo : un titre au début, les deux meilleurs passages, une musique douce dessous. Dis-moi si le titre te convient.' : '';
}
if (reponse) await parler(reponse);
else console.error(`jetski: no output produced — a tool required the "${refus[0]?.action ?? 'write_file'}" permission that headless mode cannot prompt for, so it was auto-denied. Add an allow-rule under permissions.allow in settings.json.`);
dire({event: 'result', result: {conversation_id: conv, status: sc === 'erreur' ? 'ERROR' : 'SUCCESS', response: reponse ? `${reponse}\n` : '', ...(sc === 'erreur' ? {error: 'model overloaded'} : {}), duration_seconds: 1.2, num_turns: 1, usage: {input_tokens: 120, output_tokens: 40, total_tokens: 160}, ...(refus.length ? {denied_actions: refus} : {})}});
process.exit(0);
