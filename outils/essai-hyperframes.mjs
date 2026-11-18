#!/usr/bin/env node
// Dérush — les essais d'HyperFrames, le second moteur de rendu (lib/hyperframes.mjs, outils/derush-hyperframes.mjs) :
// ce que la commande refuse, ce qu'elle impose (projet sans question ni compétence, catalogue fixé à la version
// installée, blocs sans licence refusés), son environnement (ni clé, ni télémétrie, rien dans le dossier personnel), et
// le projet réécrit après « init ». Puis, si un moteur est installé dans le dossier de Dérush donné par
// ESSAI_HYPERFRAMES_SUPPORT, un vrai projet : création, vérification, images, rendu d'un MP4.
//   node outils/essai-hyperframes.mjs [dossier où créer le dossier d'essai]
//   ESSAI_HYPERFRAMES_SUPPORT=<dossier de Dérush d'essai avec moteurs/hyperframes> node outils/essai-hyperframes.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('node outils/essai-hyperframes.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
fs.mkdirSync(base, {recursive: true});
const tmp = fs.mkdtempSync(path.join(base, 'derush-essai-hyperframes-'));
const reel = process.env.ESSAI_HYPERFRAMES_SUPPORT ? path.resolve(process.env.ESSAI_HYPERFRAMES_SUPPORT) : null;
Object.assign(process.env, {DERUSH_SUPPORT: path.join(tmp, 'support'), TREG_TOKEN: 'trg_live_secret', ELEVENLABS_API_KEY: 'sk_eleven', DERUSH_GEMINI_CLE: 'cle-gemini', HEYGEN_API_KEY: 'cle-heygen'});
fs.mkdirSync(process.env.DERUSH_SUPPORT, {recursive: true});
const H = await import(pathToFileURL(path.join(D, 'lib', 'hyperframes.mjs')).href);
const CMD = path.join(D, 'outils', 'derush-hyperframes.mjs');

let ok = 0;
let ko = 0;
const essai = (nom, cond, detail = '') => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`); } };
const refus = (args) => { try { H.preparerCommande(args, tmp); return null; } catch (e) { return e.message; } };

console.log('Ce que la commande refuse');
essai('ce qui parle à HeyGen ou sort du rendu local : auth, events, feedback, usage, cloud, upgrade, preview, publish, telemetry', ['auth', 'events', 'feedback', 'usage', 'cloud', 'upgrade', 'preview', 'publish', 'telemetry', 'open', 'reverse'].every((c) => /n’est pas permis/.test(refus([c, 'x']) ?? '')));
essai('sans commande : la liste de ce qui est permis', /Commandes : init, lint, check/.test(refus([]) ?? ''));
essai('un bloc qui télécharge des images sans licence est refusé (photos d’artistes, promotion de HeyGen)', /sans licence/.test(refus(['add', 'carousel-orbit-3']) ?? '') && /sans licence/.test(refus(['add', 'heygen-avatar-promo-card']) ?? '') && H.BLOCS_REFUSES.size === 28);
essai('« add » sans bloc : il dit comment chercher', /catalog --query/.test(refus(['add']) ?? ''));

console.log('Ce qu’elle impose');
const init = H.preparerCommande(['init', 'hf', '--resolution', 'portrait', '--video', 'x.mp4'], tmp);
essai('init : sans question, sans compétences, sans transcription ; jamais --video ni --capture', JSON.stringify(init) === JSON.stringify(['init', 'hf', '--resolution', 'portrait', 'x.mp4', '--non-interactive', '--skip-skills', '--skip-transcribe']), JSON.stringify(init));
const projet = path.join(tmp, 'projet');
fs.mkdirSync(projet);
essai('catalog hors projet : rien n’est créé', H.preparerCommande(['catalog', '--json'], projet)[0] === 'catalog' && !fs.existsSync(path.join(projet, 'hyperframes.json')));
fs.writeFileSync(path.join(projet, 'hyperframes.json'), JSON.stringify({registry: 'https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry', paths: {blocks: 'compositions'}}));
const add = H.preparerCommande(['add', 'data-chart'], projet);
const hj = JSON.parse(fs.readFileSync(path.join(projet, 'hyperframes.json'), 'utf8'));
essai('add : le catalogue fixé au commit de la version installée, sans toucher au reste ; jamais le presse-papiers', hj.registry === H.REGISTRE_HYPERFRAMES && /f291b125983a180ef9dd8744536c90023e5a1998/.test(hj.registry) && hj.paths.blocks === 'compositions' && add.includes('--no-clipboard'), JSON.stringify({hj, add}));

console.log('Son environnement');
const env = H.envHyperframes(process.env);
essai('aucune clé : ni Treg, ni ElevenLabs, ni Gemini, ni HeyGen', !['TREG_TOKEN', 'ELEVENLABS_API_KEY', 'DERUSH_GEMINI_CLE', 'HEYGEN_API_KEY'].some((k) => k in env));
essai('télémétrie, mises à jour, compétences et modules à la volée coupés', ['HYPERFRAMES_NO_TELEMETRY', 'DO_NOT_TRACK', 'HYPERFRAMES_NO_UPDATE_CHECK', 'HYPERFRAMES_SKIP_SKILLS', 'HYPERFRAMES_NO_OPTIONAL_INSTALL', 'HYPERFRAMES_NO_AUTO_INSTALL'].every((k) => env[k] === '1'));
essai('ses dossiers dans celui de Dérush, rien dans le dossier personnel', [env.HYPERFRAMES_CONFIG_DIR, env.HYPERFRAMES_CACHE_DIR].every((d) => d.startsWith(H.dossierHyperframes())));
essai('le bac à sable de Chrome coupé seulement dans celui d’une IA', !('HYPERFRAMES_CHROME_SANDBOX' in env) && H.envHyperframes(process.env, {bacASable: true}).HYPERFRAMES_CHROME_SANDBOX === '0');
essai('Node 22 ou plus', H.nodeAssezRecent('22.0.0') && !H.nodeAssezRecent('20.12.0'));
const etat = H.etatHyperframes();
essai('pas installé : dit, et installable (avec Node 22)', etat.ok === false && (etat.installable === H.nodeAssezRecent()) && /pas encore installé|Node 22/.test(etat.pourquoi), JSON.stringify(etat));

console.log('Le projet réécrit après « init »');
const p2 = path.join(tmp, 'p2');
fs.mkdirSync(p2);
fs.writeFileSync(path.join(p2, 'index.html'), '<html></html>');
fs.writeFileSync(path.join(p2, 'hyperframes.json'), JSON.stringify({registry: 'https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry'}));
fs.writeFileSync(path.join(p2, 'package.json'), JSON.stringify({name: 'p2', scripts: {dev: 'npx --yes hyperframes@0.9.64 preview', render: 'npx --yes hyperframes@0.9.64 render', publish: 'npx --yes hyperframes@0.9.64 publish'}}));
for (const n of ['CLAUDE.md', 'AGENTS.md']) fs.writeFileSync(path.join(p2, n), 'Run `npx hyperframes events` and /reverse-any-video (HyperFrames Pro).');
H.apresInit(p2);
const pk = JSON.parse(fs.readFileSync(path.join(p2, 'package.json'), 'utf8'));
const cl = fs.readFileSync(path.join(p2, 'CLAUDE.md'), 'utf8');
essai('catalogue fixé, raccourcis par derush-hyperframes (plus de npx, plus de preview ni de publish)', JSON.parse(fs.readFileSync(path.join(p2, 'hyperframes.json'), 'utf8')).registry === H.REGISTRE_HYPERFRAMES && !JSON.stringify(pk).includes('npx') && !pk.scripts.publish && pk.scripts.render === 'derush-hyperframes render', JSON.stringify(pk));
essai('CLAUDE.md et AGENTS.md : les consignes de Dérush (plus de télémétrie ni de compétence payante)', /derush-hyperframes/.test(cl) && !/events|Pro\)/.test(cl) && fs.readFileSync(path.join(p2, 'AGENTS.md'), 'utf8') === cl);

console.log('La commande derush-hyperframes');
const aide = spawnSync(process.execPath, [CMD, '--help'], {encoding: 'utf8'});
essai('--help : le mode d’emploi complet, code 0', aide.status === 0 && /render -o \.\.\/rendu\/final\.mp4/.test(aide.stdout) && /window\.__timelines/.test(aide.stdout) && /\.env/.test(aide.stdout));
const auth = spawnSync(process.execPath, [CMD, 'auth', 'login'], {encoding: 'utf8'});
essai('une commande refusée : un message clair, code 1, avant même de chercher le moteur', auth.status === 1 && /n’est pas permis/.test(auth.stderr));
const absent = spawnSync(process.execPath, [CMD, 'check'], {encoding: 'utf8', cwd: projet});
essai('moteur absent : il dit qu’il sera installé et de rendre avec le kit en attendant', absent.status === 1 && /kit remotion/.test(absent.stderr));

console.log('Un vrai projet (moteur installé)');
const pret = reel && fs.existsSync(path.join(reel, 'moteurs', 'hyperframes', 'node_modules', 'hyperframes', 'package.json'));
if (!pret) console.log('  · (non essayé ici : ESSAI_HYPERFRAMES_SUPPORT ne mène pas à un moteur installé)');
else {
  const W = path.join(tmp, 'atelier');
  fs.mkdirSync(path.join(W, 'rendu'), {recursive: true});
  const lancer = (args, cwd) => spawnSync(process.execPath, [CMD, ...args], {encoding: 'utf8', cwd, env: {...process.env, DERUSH_SUPPORT: reel}, timeout: 180000});
  const i = lancer(['init', 'hf', '--resolution', 'portrait'], W);
  const HF = path.join(W, 'hf');
  essai('init : un projet prêt, au catalogue fixé, avec les consignes de Dérush', i.status === 0 && fs.existsSync(path.join(HF, 'index.html')) && JSON.parse(fs.readFileSync(path.join(HF, 'hyperframes.json'), 'utf8')).registry === H.REGISTRE_HYPERFRAMES && /derush-hyperframes/.test(fs.readFileSync(path.join(HF, 'CLAUDE.md'), 'utf8')), i.stderr.slice(-300));
  let html = fs.readFileSync(path.join(HF, 'index.html'), 'utf8');
  html = html.replace(/data-duration="10"/g, 'data-duration="2"').replace('>Title</h1>', '>ESSAI</h1>').replace('// Example: tl.fromTo', 'tl.fromTo("#title", {opacity: 0, y: 80}, {opacity: 1, y: 0, duration: 0.5}, 0.1);\n      // tl.fromTo');
  fs.writeFileSync(path.join(HF, 'index.html'), html);
  const c = lancer(['check', '--json'], HF);
  let jc = null;
  try { jc = JSON.parse(c.stdout); } catch { /* pas du JSON */ }
  essai('check : le projet est lu par le vrai navigateur, sans erreur', jc?.lint?.errorCount === 0 && jc?.browserSkipped === false, c.stdout.slice(0, 300) || c.stderr.slice(-300));
  const r = lancer(['render', '-o', '../rendu/final.mp4', '--quality', 'draft'], HF);
  const mp4 = path.join(W, 'rendu', 'final.mp4');
  const sonde = fs.existsSync(mp4) ? spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', mp4], {encoding: 'utf8'}) : null;
  const j = sonde ? JSON.parse(sonde.stdout) : null;
  essai('render : un MP4 de 1080×1920 et 2 s dans rendu/', r.status === 0 && j?.streams?.[0]?.width === 1080 && j.streams[0].height === 1920 && Math.abs(Number(j.format.duration) - 2) < 0.1, r.stderr.slice(-300));
  essai('rien n’est écrit dans le dossier personnel de l’essai', !fs.existsSync(path.join(os.homedir(), '.cache', 'hyperframes')));
  // Gemini : son bac à sable coupe le réseau local ; la commande passe par la boîte du relais de Dérush
  const script = path.join(tmp, 'par-la-boite.mjs');
  fs.writeFileSync(script, `import {spawnSync} from 'node:child_process';
const {ouvrirRelais} = await import(${JSON.stringify(pathToFileURL(path.join(D, 'lib', 'relais.mjs')).href)});
const atelier = process.argv[2];
const r = await ouvrirRelais(atelier, {boite: true, lisibles: [atelier]});
const {spawn} = await import('node:child_process');
const run = (args) => new Promise((ok) => { const p = spawn(process.execPath, [${JSON.stringify(CMD)}, ...args], {cwd: process.argv[3], env: {...process.env, DERUSH_RELAIS_BOITE: r.boite, DERUSH_RELAIS_JETON: r.jeton}}); let o = '', e = ''; p.stdout.on('data', (d) => { o += d; }); p.stderr.on('data', (d) => { e += d; }); p.on('close', (code) => ok({code, o, e})); });
const rendu = await run(['render', '-o', '../rendu/boite.mp4', '--quality', 'draft']);
const dehors = await run(['render', '-o', '/tmp/dehors-derush.mp4']);
r.fermer();
// Codex : par l'adresse locale du relais
const r2 = await ouvrirRelais(atelier, {});
const parAdresse = await new Promise((ok) => { const p = spawn(process.execPath, [${JSON.stringify(CMD)}, 'render', '-o', '../rendu/adresse.mp4', '--quality', 'draft'], {cwd: process.argv[3], env: {...process.env, DERUSH_RELAIS: r2.url, DERUSH_RELAIS_JETON: r2.jeton}}); let e = ''; p.stderr.on('data', (d) => { e += d; }); p.on('close', (code) => ok({code, e: e.slice(0, 300)})); });
r2.fermer();
console.log(JSON.stringify({rendu: {code: rendu.code, e: rendu.e.slice(0, 300)}, dehors: {code: dehors.code, e: dehors.e.slice(-300)}, adresse: parAdresse}));
`);
  const b = spawnSync(process.execPath, [script, W, HF], {encoding: 'utf8', env: {...process.env, DERUSH_SUPPORT: reel}, timeout: 300000});
  let jb = null;
  try { jb = JSON.parse(b.stdout.trim().split('\n').at(-1)); } catch { /* pas de réponse */ }
  essai('par la boîte du relais (le bac à sable de Gemini) : HyperFrames rend hors du bac à sable, dans le dossier de travail', jb?.rendu?.code === 0 && fs.existsSync(path.join(W, 'rendu', 'boite.mp4')) && /hors du bac à sable/.test(jb.rendu.e), b.stdout.slice(-400) || b.stderr.slice(-400));
  essai('… et refuse une vidéo rendue hors du dossier de travail', jb?.dehors?.code === 1 && /doit rester dans le dossier de travail/.test(jb.dehors.e) && !fs.existsSync('/tmp/dehors-derush.mp4'), JSON.stringify(jb?.dehors));
  essai('par l’adresse locale du relais (Codex) : le même rendu, hors du bac à sable', jb?.adresse?.code === 0 && fs.existsSync(path.join(W, 'rendu', 'adresse.mp4')) && /hors du bac à sable/.test(jb.adresse.e), JSON.stringify(jb?.adresse));
}

console.log(`\n${ok} essais réussis sur ${ok + ko}`);
if (!ko) fs.rmSync(tmp, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${tmp}`);
process.exit(ko ? 1 : 0);
