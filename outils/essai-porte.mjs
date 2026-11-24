// Dérush — les essais de la porte des IA (lib/porte-ia.mjs, lib/porte-ia-outils.mjs, outils/derush-mcp.mjs,
// public/porte.js), pour qui modifie Dérush :
//   node outils/essai-porte.mjs [dossier où créer le dossier d'essai]
// 1. Sans page : la liste des outils (noms, schémas, qui les joue), les noms des IA, la recherche dans ce qui est dit,
//    la couleur d'une image, le protocole MCP (version, session, clé, origine, notifications, lots, méthodes, erreurs).
// 2. Le pont des apps, Dérush fermé : il répond lui-même (outils), et chaque outil dit d'ouvrir Dérush.
// 3. Pour de vrai, dans Chrome sans fenêtre (sautée si Chrome ou FFmpeg manque ; DERUSH_CHROME=<programme>) : le vrai
//    serveur, un projet jetable, et une « IA » qui parle MCP par le pont (comme l'app Claude) et en direct (comme Claude
//    Code). Chaque geste change le montage de la page, s'enregistre avant la réponse, s'annule d'un ⌘Z, et le curseur de
//    l'IA s'affiche. Aucune IA n'est lancée ; « Créer la vidéo » passe par un faux moteur de rendu (FFmpeg).
//    DERUSH_ESSAI_CAPTURES=<dossier> y garde des captures.
// Le dossier d'essai est effacé à la fin, sauf en cas d'échec.
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import {spawn, spawnSync} from 'node:child_process';
import {register} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAISON_REELLE = os.homedir();
if (/^-/.test(process.argv[2] ?? '')) { console.log(`Usage : node ${path.relative(process.cwd(), process.argv[1])} [dossier temporaire]`); process.exit(0); }
const parent = path.resolve(process.argv[2] ?? os.tmpdir());
fs.mkdirSync(parent, {recursive: true});
const T = fs.mkdtempSync(path.join(fs.realpathSync(parent), 'derush-essai-porte-'));
const SUPPORT = path.join(T, 'support');
const BIBLIO = path.join(T, 'bibliotheque');
const MAISON = path.join(T, 'maison');
const TMP = path.join(T, 'tmp');
for (const d of [SUPPORT, BIBLIO, MAISON, TMP, path.join(T, 'sons')]) fs.mkdirSync(d, {recursive: true});
process.env.DERUSH_SUPPORT = SUPPORT;
process.env.DERUSH_BIBLIOTHEQUE = BIBLIO;
process.env.DERUSH_DRIVE = path.join(T, 'drive');
process.env.DERUSH_SONS = path.join(T, 'sons');
process.env.DERUSH_SANS_MAJ = '1';
process.env.DERUSH_SANS_NAVIGATEUR = '1';
process.env.DERUSH_TREG_BASE = 'http://127.0.0.1:9';
process.env.HOME = MAISON;
process.env.USERPROFILE = MAISON;
process.env.TMPDIR = TMP;
process.env.TEMP = TMP;
process.env.TMP = TMP;
for (const k of ['TREG_TOKEN', 'ELEVENLABS_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'DERUSH_PORTE_IA']) delete process.env[k];

let bons = 0;
let total = 0;
function essai(quoi, vrai, detail = '') {
  total++;
  if (vrai) bons++;
  console.log(`${vrai ? '  ✓' : '  ✗'} ${quoi}${vrai || detail === '' ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)?.slice(0, 900)}`}`);
}
const titre = (t) => console.log(`\n${t}`);
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
const json = (x) => JSON.stringify(x);
/** Deux objets égaux, quel que soit l'ordre de leurs clés. */
const memes = (a, b) => json(Object.entries(a ?? {}).sort()) === json(Object.entries(b ?? {}).sort());

const lib = (m) => import(pathToFileURL(path.join(D, 'lib', m)).href);
// — les crochets, AVANT tout import de lib/ : aucune vraie IA (un faux Claude monteur), la place du disque lue pour de faux —
const B = path.join(T, 'bouchons');
fs.mkdirSync(B, {recursive: true});
const vrai = (f) => `${pathToFileURL(path.join(D, 'lib', f)).href}?vrai`;
// un faux Claude Code, monteur « Sur ma timeline » : il se branche sur la porte (le --mcp-config que Dérush lui donne),
// lit le projet, pose un plan et un marqueur, écrit reponse.json. Aucune vraie IA n'est lancée.
const FAUX_MONTEUR = path.join(B, 'faux-claude-monteur.mjs');
fs.writeFileSync(FAUX_MONTEUR, `import fs from 'node:fs';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
const a = process.argv.slice(2);
const cfg = JSON.parse(a[a.indexOf('--mcp-config') + 1]);
const srv = cfg.mcpServers.derush;
fs.writeFileSync('lancement.json', JSON.stringify({args: a, permis: a[a.indexOf('--allowedTools') + 1] ?? null}));
const out = (j) => process.stdout.write(JSON.stringify(j) + '\\n');
let consigne = '';
for await (const x of process.stdin) consigne += x;
out({type: 'system', subtype: 'init', mcp_servers: [{name: 'derush', status: 'connected'}], session_id: 'faux'});
const p = spawn(srv.command, srv.args, {env: {...process.env, ...srv.env}, stdio: ['pipe', 'pipe', 'inherit']});
const rl = readline.createInterface({input: p.stdout});
const attente = new Map();
let n = 0;
rl.on('line', (l) => { const j = JSON.parse(l); attente.get(j.id)?.(j); });
const req = (method, params) => new Promise((ok) => { const id = ++n; attente.set(id, ok); p.stdin.write(JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\\n'); });
await req('initialize', {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'claude-code', version: 'faux'}});
const appel = async (name, args) => { out({type: 'assistant', message: {content: [{type: 'tool_use', name: 'mcp__derush__' + name, input: args}]}}); return (await req('tools/call', {name, arguments: args})).result; };
await appel('lire_projet', {});
await new Promise((ok) => setTimeout(ok, 400));
await appel('ajouter_plan', {media: 'M1', entree: 0, duree: 1.5, titre: 'Par le faux Claude', apres: 'debut'});
await appel('poser_marqueur', {temps: 0.5, nom: 'Faux Claude', couleur: 'violet'});
fs.writeFileSync('reponse.json', JSON.stringify({fait: 'J’ai posé un plan de cuisine au début, et un marqueur. Consigne reçue : ' + consigne.slice(0, 60)}));
out({type: 'assistant', message: {content: [{type: 'text', text: 'Fini.'}]}});
out({type: 'result', subtype: 'success', is_error: false, result: 'Fini.'});
p.stdin.end();
process.exit(0);
`);
fs.writeFileSync(path.join(B, 'faux-ia.mjs'), `export * from '${vrai('ia.mjs')}';
export async function etatIA() { return {claude: {ok: true, chemin: ${json(FAUX_MONTEUR)}, version: '0.0.0-essai', modeles: []}, codex: {ok: false, pourquoi: 'absent (essai)'}, gemini: {ok: false, pourquoi: 'absent (essai)'}, choisi: 'claude'}; }
export function commandeLancement(chemin) { if (chemin === ${json(FAUX_MONTEUR)}) return {cmd: process.execPath, prefixe: [chemin]}; throw new Error('essai : aucune IA ne doit être lancée (' + chemin + ')'); }
`);
fs.writeFileSync(path.join(B, 'faux-disque.mjs'), `export * from '${vrai('disque.mjs')}';
import {verifierPlace as vraie} from '${vrai('disque.mjs')}';
export function verifierPlace(dossier, o = {}) { return vraie(dossier, {...o, lire: () => 50 * 1024 ** 3}); }
`);
const remplaces = {[pathToFileURL(path.join(D, 'lib', 'ia.mjs')).href]: pathToFileURL(path.join(B, 'faux-ia.mjs')).href,
  [pathToFileURL(path.join(D, 'lib', 'disque.mjs')).href]: pathToFileURL(path.join(B, 'faux-disque.mjs')).href};
fs.writeFileSync(path.join(B, 'crochets.mjs'), `const R = ${json(remplaces)};
export async function resolve(specifier, context, next) {
  const r = await next(specifier, context);
  return R[r.url] ? {...r, url: R[r.url], shortCircuit: true} : r;
}
`);
register(pathToFileURL(path.join(B, 'crochets.mjs')).href);

// ——— 1. sans page ———
const O = await lib('porte-ia-outils.mjs');
const PI = await lib('porte-ia.mjs');
titre('La liste des outils');
const noms = O.DEFINITIONS.map((d) => d.name);
essai(`${noms.length} outils, des noms uniques en français sans accent (lire_projet, couper, creer_video…)`,
  noms.length >= 27 && new Set(noms).size === noms.length && noms.every((n) => /^[a-z_]+$/.test(n)) && ['lire_projet', 'lister_medias', 'couper', 'ajouter_plan', 'creer_video', 'historique'].every((n) => noms.includes(n)), noms);
const schemasOk = O.DEFINITIONS.every((d) => d.inputSchema?.type === 'object' && typeof d.inputSchema.properties === 'object' && (d.inputSchema.required ?? []).every((r) => r in d.inputSchema.properties) && d.description.length > 30 && d.title && typeof d.annotations?.readOnlyHint === 'boolean');
essai('chaque outil : un schéma d’objet, ses champs requis décrits, un titre, une description, et s’il change quelque chose', schemasOk);
essai('chaque outil est joué par la fenêtre (le montage) ou par le serveur (les fichiers) ; un outil inconnu par personne',
  O.OUTILS.every(([d, ou]) => ['fenetre', 'serveur'].includes(ou) && O.ouJouer(d.name) === ou) && O.ouJouer('effacer_disque') === null && O.ouJouer('couper') === 'fenetre' && O.ouJouer('lire_transcription') === 'serveur');
essai('les outils qui lisent sont marqués « lecture » ; supprimer est marqué destructif',
  O.enLecture('lire_projet') && O.enLecture('regarder_media') && !O.enLecture('couper') && O.DEFINITIONS.find((d) => d.name === 'supprimer').annotations.destructiveHint === true);
essai('les consignes de la porte disent le modèle du montage (magnétique, par-dessus, identifiants, entree et debut)',
  /magnétique/.test(O.CONSIGNES_PORTE) && /P3/.test(O.CONSIGNES_PORTE) && /« entree » et « sortie »/.test(O.CONSIGNES_PORTE) && /lire_projet/.test(O.CONSIGNES_PORTE));
essai('le nom de chaque IA, d’après ce qu’elle annonce : Claude Code, Claude, ChatGPT (Codex), Gemini, Cursor ; un nom bizarre est nettoyé',
  O.nomClient({name: 'claude-code'}) === 'Claude Code' && O.nomClient({name: 'claude-ai'}) === 'Claude' && O.nomClient({name: 'codex-mcp-client'}) === 'ChatGPT'
  && O.nomClient({name: 'gemini-cli-mcp-client'}) === 'Gemini' && O.nomClient({name: 'cursor-vscode'}) === 'Cursor' && O.nomClient({name: '<b>x</b>'}) === 'bxb' && O.nomClient({}) === 'Une IA');

titre('Ce qui est dit, la couleur, le contenu rendu à l’IA');
const MOTS = [{t: 'Bonjour', debut: 0, fin: 0.4}, {t: 'à', debut: 0.45, fin: 0.5}, {t: 'tous.', debut: 0.5, fin: 0.9}, {t: '[rires]', debut: 1, fin: 1.4, ev: true},
  {t: 'On', debut: 2.5, fin: 2.6}, {t: 'part', debut: 2.6, fin: 2.8}, {t: 'à', debut: 2.8, fin: 2.85}, {t: 'Tottori', debut: 2.9, fin: 3.4}, {t: 'cet', debut: 3.4, fin: 3.5}, {t: 'été.', debut: 3.5, fin: 3.9}];
essai('les phrases, avec leurs temps (les événements comme les rires sont laissés de côté)',
  json(PI.phrases(MOTS)) === json([{debut: 0, fin: 0.9, texte: 'Bonjour à tous.'}, {debut: 2.5, fin: 3.9, texte: 'On part à Tottori cet été.'}]), PI.phrases(MOTS));
const tr = PI.chercherDit(MOTS, 'A tottori');
essai('chercher ce qui est dit : sans majuscule ni accent, dans l’ordre, avec les mots autour ; le dernier mot peut être commencé',
  tr.length === 1 && tr[0].debut === 2.8 && tr[0].fin === 3.4 && /On part à Tottori cet été/.test(tr[0].autour) && PI.chercherDit(MOTS, 'tott').length === 1 && PI.chercherDit(MOTS, 'été tous').length === 0 && PI.chercherDit(MOTS, '').length === 0, tr);
essai('la couleur d’une image comme l’aperçu : contraste, température, exposition, saturation, dans cet ordre',
  json(PI.filtreCouleur({contraste: 10, temperature: 25, exposition: 20, saturation: -30})) === json(['eq=contrast=1.0600', 'colorchannelmixer=rr=1.0235:gg=0.9980:bb=0.9765', 'colorchannelmixer=rr=1.1343:gg=1.1343:bb=1.1343', 'eq=saturation=0.7000']) && PI.filtreCouleur(null).length === 0);
essai('ce que rend un outil : l’image d’abord, puis le texte et les données ; une erreur est marquée',
  json(PI.contenuOutil({texte: 'ok', donnees: {a: 1}})) === json({content: [{type: 'text', text: 'ok\n{"a":1}'}]})
  && PI.contenuOutil({image: {data: 'QUJD'}, texte: 'vue'}).content[0].type === 'image' && PI.contenuOutil({texte: 'non'}, true).isError === true && PI.contenuOutil(null).content[0].text === 'Fait.');
const d0 = {sortie: {largeur: 1080, hauteur: 1920, fps: 30}, medias: [{id: 'M1', type: 'video'}, {id: 'M2', type: 'image'}, {id: 'M3', type: 'audio'}],
  montage: [{id: 'P1', type: 'plan', media: 'M1', entree: 2, sortie: 4}, {id: 'B1', type: 'bloc', duree: 1, titre: 'Carte'}, {id: 'P2', type: 'plan', media: 'M1', entree: 10, sortie: 12, couleur: {exposition: 10}}],
  superpositions: [{id: 'S1', media: 'M2', entree: 0, sortie: 1, debut: 4.5, cadre: 'incrustation'}, {id: 'S2', media: 'M3', entree: 0, sortie: 9, debut: 0}]};
const i1 = PI.imageAuTemps(d0, 0.5);
const i2 = PI.imageAuTemps(d0, 4.6);
const i3 = PI.imageAuTemps(d0, 2.5);
essai('l’image du montage à un instant : le plan et son temps dans le fichier, la photo en incrustation par-dessus (pas le son), une case à créer',
  i1.plan.id === 'P1' && Math.abs(i1.plan.temps - 2.5) < 1e-9 && !i1.dessus && i2.plan.id === 'P2' && Math.abs(i2.plan.temps - 11.6) < 1e-9 && i2.dessus?.id === 'S1' && i2.dessus.cadre === 'incrustation'
  && i2.plan.couleur?.exposition === 10 && i3.plan.case && PI.imageAuTemps({...d0, montage: []}, 1) === null, {i1, i2, i3});

titre('La clé de la porte');
const cle = PI.clePorte();
const st = fs.statSync(PI.fichierPorte());
essai('créée une fois (64 caractères), gardée d’un appel à l’autre, dans le dossier de Dérush, lisible par la seule personne',
  /^[0-9a-f]{64}$/.test(cle) && PI.clePorte() === cle && PI.fichierPorte().startsWith(SUPPORT) && (process.platform === 'win32' || (st.mode & 0o777) === 0o600), (st.mode & 0o777).toString(8));
PI.annoncerPorte(45678);
const lu = JSON.parse(fs.readFileSync(PI.fichierPorte(), 'utf8'));
essai('le port annoncé pour le pont, avec la même clé, la version et de quoi relancer Dérush', lu.port === 45678 && lu.cle === cle && lu.version && lu.app && lu.node);

titre('Le protocole MCP (sans fenêtre)');
const faux = {lister_effets: () => ({texte: 'deux', donnees: [1, 2]}), lire_transcription: () => { throw new Error('pas prête'); }};
const PORTE = PI.creerPorte({P: null}, {cle, serveur: faux});
/** Une demande HTTP à la porte, sans serveur : un faux req/res. */
async function demander(corps, {methode = 'POST', entetes = {}} = {}) {
  const brut = corps === undefined ? '' : typeof corps === 'string' ? corps : JSON.stringify(corps);
  const req = (async function* () { if (brut) yield Buffer.from(brut); })();
  req.method = methode;
  req.headers = {authorization: `Bearer ${cle}`, ...entetes};
  return new Promise((ok) => {
    const res = {writableEnded: false, code: 0, h: {}, writeHead(c, h = {}) { this.code = c; this.h = Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v])); },
      end(b = '') { this.writableEnded = true; ok({code: this.code, entetes: this.h, corps: b ? JSON.parse(b) : null}); }};
    PORTE.traiter(req, res);
  });
}
const init = await demander({jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-03-26', capabilities: {}, clientInfo: {name: 'claude-code', version: '3.1'}}});
const sid = init.entetes['mcp-session-id'];
essai('initialize : la version demandée si Dérush la parle, les outils, le nom et la version de Dérush, les consignes, une session',
  init.code === 200 && init.corps.result.protocolVersion === '2025-03-26' && init.corps.result.capabilities.tools && init.corps.result.serverInfo.name === 'derush' && init.corps.result.serverInfo.title === 'Dérush'
  && /magnétique/.test(init.corps.result.instructions) && /^[0-9a-f-]{36}$/.test(sid ?? ''), init);
const init2 = await demander({jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2099-01-01', clientInfo: {name: 'x'}}});
essai('une version inconnue : Dérush répond avec la sienne (la plus récente)', init2.corps.result.protocolVersion === PI.PROTOCOLES[0]);
const liste = await demander({jsonrpc: '2.0', id: 2, method: 'tools/list'}, {entetes: {'mcp-session-id': sid}});
essai('tools/list : tous les outils', liste.corps.result.tools.length === O.DEFINITIONS.length);
await demander({jsonrpc: '2.0', id: 3, method: 'tools/call', params: {name: 'lister_effets', arguments: {}}}, {entetes: {'mcp-session-id': sid}});
essai('« Connexions » sait qui est venu (Claude Code) et ce qu’il a fait', PORTE.etat().ia.some((x) => x.nom === 'Claude Code') && PORTE.etat().journal.some((j) => j.outil === 'lister_effets' && j.ok && j.ia === 'Claude Code'), PORTE.etat());
const notif = await demander({jsonrpc: '2.0', method: 'notifications/initialized'}, {entetes: {'mcp-session-id': sid}});
essai('une notification : 202, sans corps', notif.code === 202 && notif.corps === null);
const ping = await demander({jsonrpc: '2.0', id: 'p', method: 'ping'});
essai('ping : une réponse vide', ping.code === 200 && json(ping.corps) === json({jsonrpc: '2.0', id: 'p', result: {}}));
const lot = await demander([{jsonrpc: '2.0', id: 7, method: 'ping'}, {jsonrpc: '2.0', method: 'notifications/cancelled'}, {jsonrpc: '2.0', id: 8, method: 'resources/list'}]);
essai('un lot : une réponse par demande, dans l’ordre (une méthode inconnue : −32601)', Array.isArray(lot.corps) && lot.corps.length === 2 && lot.corps[0].id === 7 && lot.corps[1].error?.code === -32601, lot.corps);
const sansCle = await demander({jsonrpc: '2.0', id: 1, method: 'ping'}, {entetes: {authorization: 'Bearer 1234'}});
const site = await demander({jsonrpc: '2.0', id: 1, method: 'ping'}, {entetes: {origin: 'https://site-etranger.example'}});
const local = await demander({jsonrpc: '2.0', id: 1, method: 'ping'}, {entetes: {origin: 'http://localhost:5173'}});
essai('sans la bonne clé : 401 ; une demande venue d’un site : 403 ; une page de cet ordinateur : permise', sansCle.code === 401 && site.code === 403 && local.code === 200);
const get = await demander(undefined, {methode: 'GET'});
const del = await demander(undefined, {methode: 'DELETE', entetes: {'mcp-session-id': sid}});
const illisible = await demander('{pas du json');
const pasRpc = await demander({id: 3, method: 'ping'});
essai('GET : 405 (pas de flux) ; DELETE : la session se ferme (204) ; du JSON illisible : −32700 ; sans « jsonrpc » : −32600',
  get.code === 405 && del.code === 204 && illisible.corps.error.code === -32700 && pasRpc.corps.error.code === -32600);
const eff = await demander({jsonrpc: '2.0', id: 4, method: 'tools/call', params: {name: 'lister_effets', arguments: {}}});
const err = await demander({jsonrpc: '2.0', id: 5, method: 'tools/call', params: {name: 'lire_transcription', arguments: {media: 'M1'}}});
const fen = await demander({jsonrpc: '2.0', id: 6, method: 'tools/call', params: {name: 'couper', arguments: {temps: 1}}});
const inc = await demander({jsonrpc: '2.0', id: 9, method: 'tools/call', params: {name: 'formater_disque', arguments: {}}});
essai('tools/call : un outil du serveur répond ; son erreur revient en texte (isError) ; un geste sans fenêtre ouverte le dit ; un outil inconnu : −32602',
  eff.corps.result.content[0].text === 'deux\n[1,2]' && !eff.corps.result.isError && err.corps.result.isError && err.corps.result.content[0].text === 'pas prête'
  && fen.corps.result.isError && /fenêtre de Dérush n’est pas ouverte/.test(fen.corps.result.content[0].text) && inc.corps.error?.code === -32602, {eff: eff.corps, fen: fen.corps});

// ——— 2. le pont, Dérush fermé ———
titre('Le pont des apps, Dérush fermé');
/** Lance le pont et lui parle comme une app d'IA (une ligne de JSON par message). */
function pont(env = {}) {
  const p = spawn(process.execPath, [path.join(D, 'outils', 'derush-mcp.mjs')], {env: {...process.env, ...env}, stdio: ['pipe', 'pipe', 'pipe']});
  const lignes = readline.createInterface({input: p.stdout});
  const attente = new Map();
  const brutes = [];
  const erreurs = [];
  p.stderr.on('data', (b) => erreurs.push(String(b)));
  lignes.on('line', (l) => { brutes.push(l); let j; try { j = JSON.parse(l); } catch { return; } if (attente.has(j.id)) { attente.get(j.id)(j); attente.delete(j.id); } });
  let n = 100;
  return {
    brutes,
    erreurs,
    demande(method, params = {}, delai = 120000) { const id = ++n; return new Promise((ok, ko) => { const m = setTimeout(() => ko(new Error(`le pont ne répond pas à ${method}`)), delai); attente.set(id, (j) => { clearTimeout(m); ok(j); }); p.stdin.write(`${json({jsonrpc: '2.0', id, method, params})}\n`); }); },
    notifier(method) { p.stdin.write(`${json({jsonrpc: '2.0', method})}\n`); },
    async outil(name, args = {}) { const r = await this.demande('tools/call', {name, arguments: args}); return r.result ?? {isError: true, content: [{text: r.error?.message}]}; },
    fermer() { p.stdin.end(); return new Promise((ok) => p.on('exit', ok)); },
  };
}
const fermeSupport = path.join(T, 'support-ferme');
fs.mkdirSync(fermeSupport, {recursive: true});
const pf = pont({DERUSH_SUPPORT: fermeSupport});
const pi = await pf.demande('initialize', {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'claude-ai', version: '1'}});
pf.notifier('notifications/initialized');
const pl = await pf.demande('tools/list');
const pc = await pf.outil('lire_projet');
essai('il s’initialise seul (la version demandée), donne la liste des outils, et chaque outil dit d’ouvrir Dérush (sans rien changer)',
  pi.result?.protocolVersion === '2025-06-18' && pi.result.serverInfo.name === 'derush' && pl.result?.tools?.length === O.DEFINITIONS.length && pc.isError && /ouvre Dérush/.test(pc.content[0].text), {pi, pc});
await pf.fermer();
essai('sur sa sortie, rien d’autre que du JSON (une ligne par message)', pf.brutes.length >= 3 && pf.brutes.every((l) => { try { JSON.parse(l); return true; } catch { return false; } }), pf.brutes.slice(0, 3));
const v = spawnSync(process.execPath, [path.join(D, 'outils', 'derush-mcp.mjs'), '--verifier'], {env: {...process.env, DERUSH_SUPPORT: fermeSupport}, encoding: 'utf8'});
essai('« --verifier » le dit en clair à la personne', v.status !== 0 && /Dérush n’a pas encore ouvert sa porte|fermé/.test(v.stdout), v.stdout);

// ——— 2 bis. brancher les apps (dans le dossier personnel d'essai : jamais les vrais réglages) ———
titre('Brancher les apps d’IA (dans un dossier personnel d’essai)');
const PA = await lib('porte-apps.mjs');
const L = PA.lanceur();
const LANCEUR_OK = process.platform === 'win32' || (fs.existsSync(L.fichier) && (fs.statSync(L.fichier).mode & 0o111) && L.command === '/bin/sh' && L.fichier.startsWith(SUPPORT));
essai('le lanceur du pont : un script exécutable dans le dossier de Dérush, qui démarre Node et le pont', LANCEUR_OK && fs.readFileSync(L.fichier, 'utf8').includes('derush-mcp.mjs') && fs.readFileSync(L.fichier, 'utf8').includes(process.execPath), L);
const viaLanceur = spawnSync(L.command, [...L.args, '--verifier'], {env: {...process.env, DERUSH_SUPPORT: fermeSupport}, encoding: 'utf8'});
essai('… et il marche (le pont répond par lui)', /Dérush/.test(viaLanceur.stdout), viaLanceur.stdout + viaLanceur.stderr);
const e0 = PA.etatApps({claude: null});
essai('rien n’est branché au départ ; sans commande claude, Claude Code est dit absent', !e0.claude.branchee && !e0.codex.branchee && !e0['claude-code'].branchee && e0['claude-code'].presente === false, e0);
const CODEX = path.join(MAISON, '.codex', 'config.toml');
fs.mkdirSync(path.dirname(CODEX), {recursive: true});
const AVANT = 'model = "gpt-5.5"\n\n[mcp_servers.autre]\ncommand = "autre"\nargs = ["x"]\n';
fs.writeFileSync(CODEX, AVANT);
PA.brancherApp('codex');
PA.brancherApp('codex');
const t1 = fs.readFileSync(CODEX, 'utf8');
essai('ChatGPT (Codex) : une section [mcp_servers.derush] (une seule, même branché deux fois), le reste gardé, une copie de sécurité',
  t1.split('[mcp_servers.derush]').length === 2 && t1.startsWith(AVANT.trim()) && /command = "\/bin\/sh"/.test(t1) && t1.includes(JSON.stringify(L.fichier)) && /tool_timeout_sec = 300/.test(t1)
  && fs.readFileSync(path.join(MAISON, '.codex', 'config.toml.avant-derush'), 'utf8') === AVANT && PA.etatApps().codex.branchee, t1);
PA.debrancherApp('codex');
essai('… débranché : il ne reste que ce qui était là (sans la ligne de Dérush)', fs.readFileSync(CODEX, 'utf8') === AVANT && !PA.etatApps().codex.branchee, fs.readFileSync(CODEX, 'utf8'));
const FAUX_CLAUDE = path.join(T, 'faux-claude.mjs');
const TRACE = path.join(T, 'claude-trace.jsonl');
fs.writeFileSync(FAUX_CLAUDE, `#!${process.execPath}
import fs from 'node:fs';
const a = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(TRACE)}, JSON.stringify({a, dossier: process.env.CLAUDE_CONFIG_DIR ?? null}) + '\\n');
const f = process.env.HOME + '/.claude.json';
const j = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
j.mcpServers ??= {};
if (a[0] === 'mcp' && a[1] === 'add') j.mcpServers[a[4]] = {type: 'stdio', command: a[6], args: a.slice(7)};
if (a[0] === 'mcp' && a[1] === 'remove') delete j.mcpServers[a[4]];
fs.writeFileSync(f, JSON.stringify(j));
`);
fs.chmodSync(FAUX_CLAUDE, 0o755);
process.env.CLAUDE_CONFIG_DIR = path.join(T, 'un-autre-compte');
const rc = PA.brancherApp('claude-code', {claude: FAUX_CLAUDE});
const trace = fs.readFileSync(TRACE, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
delete process.env.CLAUDE_CONFIG_DIR;
essai('Claude Code : la commande officielle « claude mcp add --scope user derush -- /bin/sh <lanceur> », sur le compte principal de la personne',
  rc.fait && JSON.stringify(trace.at(-1).a) === JSON.stringify(['mcp', 'add', '--scope', 'user', 'derush', '--', L.command, ...L.args]) && trace.every((x) => x.dossier === null) && PA.etatApps({claude: FAUX_CLAUDE})['claude-code'].branchee, trace);
PA.debrancherApp('claude-code', {claude: FAUX_CLAUDE});
essai('… débranché par « claude mcp remove »', !PA.brancheClaudeCode() && JSON.stringify(fs.readFileSync(TRACE, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).at(-1).a) === JSON.stringify(['mcp', 'remove', '--scope', 'user', 'derush']));
const {fichier: MCPB, manifeste} = PA.fabriquerExtension();
const contenu = spawnSync('unzip', ['-Z1', MCPB], {encoding: 'utf8'});
const test = spawnSync('unzip', ['-tq', MCPB], {encoding: 'utf8'});
essai('l’extension de l’app Claude (Dérush.mcpb) : un zip sain avec son manifeste, l’icône de Dérush et le lanceur',
  test.status === 0 && contenu.stdout.trim().split('\n').sort().join() === ['icon.png', 'manifest.json', 'server/derush-mcp'].join() && manifeste.name === 'derush' && manifeste.display_name === 'Dérush'
  && manifeste.server.mcp_config.command === '/bin/sh' && manifeste.tools.length === O.DEFINITIONS.length && manifeste.tools.every((x) => x.description.length > 10 && x.description.length < 260) && /^\d+\.\d+\.\d+$/.test(manifeste.version), {contenu: contenu.stdout, test: test.stdout + test.stderr});
const dansZip = spawnSync('unzip', ['-p', MCPB, 'server/derush-mcp'], {encoding: 'utf8'}).stdout;
essai('… son lanceur appelle celui du dossier de Dérush (qui suit Dérush s’il change de place)', dansZip.includes(L.fichier) && /^#!\/bin\/sh/.test(dansZip), dansZip);
const ext = path.join(PA.etatApps ? (await lib('plateforme.mjs')).dossierAppClaude(MAISON) : '', 'Claude Extensions', 'ant.dir.derush');
fs.mkdirSync(ext, {recursive: true});
fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify({name: 'derush'}));
essai('l’extension installée dans l’app Claude (son dossier « Claude Extensions ») : l’app Claude est dite branchée', PA.brancheClaudeApp() && PA.etatApps().claude.branchee);
fs.rmSync(ext, {recursive: true, force: true});
const autres = JSON.parse(PA.configAutres());
essai('pour une autre app (Cursor, Gemini…) : la configuration MCP à copier', autres.mcpServers.derush.command === L.command && JSON.stringify(autres.mcpServers.derush.args) === JSON.stringify(L.args));

// ——— 3. pour de vrai ———
const CHROME = process.env.DERUSH_CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((c) => fs.existsSync(c));
const CAPTURES = process.env.DERUSH_ESSAI_CAPTURES ? path.resolve(process.env.DERUSH_ESSAI_CAPTURES) : null;
const FF = process.env.DERUSH_FFMPEG || 'ffmpeg';
const ffOk = spawnSync(FF, ['-version']).status === 0;
let serveur = null;
let chrome = null;
const tombes = [];
if (!CHROME || !ffOk) {
  titre(`Pour de vrai, dans Chrome : sauté (${!CHROME ? 'Chrome introuvable ; DERUSH_CHROME=<programme> pour en donner un' : 'FFmpeg introuvable'})`);
} else {
  process.on('unhandledRejection', (e) => tombes.push(e));
  process.on('uncaughtException', (e) => tombes.push(e));
  const journalServeur = [];
  console.error = (...a) => { journalServeur.push(a.map((x) => String(x?.message ?? x)).join(' ')); };
  let p1 = null;
  try {
    const ff = (args) => { const r = spawnSync(FF, ['-v', 'error', '-y', ...args]); if (r.status !== 0) throw new Error(`FFmpeg : ${r.stderr?.toString().slice(-300)}`); };
    const video = (f, l, h, d, src = 'testsrc2') => { ff(['-f', 'lavfi', '-i', `${src}=size=${l}x${h}:rate=30:duration=${d}`, '-f', 'lavfi', '-i', `sine=frequency=330:duration=${d}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', f]); return f; };
    const RUSHES = path.join(T, 'rushes');
    fs.mkdirSync(RUSHES, {recursive: true});
    const rushes = [video(path.join(RUSHES, 'cuisine.mp4'), 360, 640, 6), video(path.join(RUSHES, 'salle.mp4'), 360, 640, 5, 'smptebars'), video(path.join(RUSHES, 'dehors.mp4'), 640, 360, 4, 'rgbtestsrc')];
    const PHOTO = path.join(RUSHES, 'logo.png');
    ff(['-f', 'lavfi', '-i', 'color=c=0xE10600:s=400x400', '-frames:v', '1', PHOTO]);

    const {Projet} = await lib('projet.mjs');
    const {FileDAttente, FFMPEG} = await lib('outils.mjs');
    const {demarrerServeur} = await lib('serveur.mjs');
    const {changerReglages} = await lib('reglages.mjs');
    const {dossierMoteurRendu, etatRendu} = await lib('rendu.mjs');
    const Mx = await lib('medias.mjs');
    const Bi = await lib('bibliotheque.mjs');
    changerReglages({tuto_vu: true, accueil_vu: true});

    // — le faux moteur de rendu (FFmpeg) —
    const MOTEUR = dossierMoteurRendu();
    if (!MOTEUR.startsWith(SUPPORT)) throw new Error(`le moteur de rendu n’est pas dans le dossier d’essai : ${MOTEUR}`);
    const KIT = JSON.parse(fs.readFileSync(path.join(D, 'modeles', 'kit-remotion', 'package.json'), 'utf8'));
    const RENDUS = path.join(T, 'rendus.jsonl');
    fs.mkdirSync(MOTEUR, {recursive: true});
    fs.writeFileSync(path.join(MOTEUR, 'package.json'), json({name: 'derush-moteur-rendu', private: true, dependencies: KIT.dependencies}));
    for (const [nom, version] of Object.entries(KIT.dependencies)) {
      const d = path.join(MOTEUR, 'node_modules', ...nom.split('/'));
      fs.mkdirSync(d, {recursive: true});
      fs.writeFileSync(path.join(d, 'package.json'), json({name: nom, version}));
    }
    fs.writeFileSync(path.join(MOTEUR, 'node_modules', '@remotion', 'cli', 'remotion-cli.js'), `import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const a = process.argv.slice(2);
if (a[0] !== 'render') process.exit(0);
const sortie = a[3];
const M = JSON.parse(fs.readFileSync(path.join(process.cwd(), '..', 'montage.json'), 'utf8'));
const {largeur, hauteur, fps} = M.sortie;
const duree = Math.max(0.5, M.sortie.duree.s);
fs.appendFileSync(${json(RENDUS)}, JSON.stringify({plans: M.montage.map((x) => x.id), largeur, hauteur, images: a.find((x) => x.startsWith('--frames=')) ?? null}) + '\\n');
execFileSync(${json(FFMPEG)}, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=' + largeur + 'x' + hauteur + ':rate=' + fps + ':duration=' + duree, '-f', 'lavfi', '-i', 'sine=frequency=440:duration=' + duree,
  '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-c:a', 'aac', '-shortest', sortie]);
console.log('Rendered 1/1');
console.log('Encoded 1/1');
`);
    fs.writeFileSync(path.join(MOTEUR, '.navigateur-pret'), 'essai');
    if (!etatRendu().ok) throw new Error('le faux moteur de rendu n’est pas reconnu');

    // — le projet : trois rushes préparés, ce qui est dit dans le premier (posé comme si Whisper l'avait fait) —
    const ctx = {P: null, file: new FileDAttente(), app: false, natif: false,
      ouvrir(d, t) { const P = new Projet(d); if (t && !fs.existsSync(path.join(P.racine, '.derush'))) { P.d.titre = t; P.sauver(); } ctx.P = P; Bi.noterRecent(P.racine); return P; },
      projetVivant(d) { return ctx.P?.racine === path.resolve(d) ? ctx.P : null; },
      fermer() { ctx.P = null; }};
    const PROJET = path.join(BIBLIO, 'Restaurant');
    p1 = ctx.ouvrir(PROJET, 'Restaurant');
    await Mx.ajouterMedias(p1, rushes, ctx.file);
    await ctx.file.vide();
    const motsM1 = [{t: 'Bienvenue', debut: 0.2, fin: 0.7}, {t: 'au', debut: 0.75, fin: 0.85}, {t: 'restaurant.', debut: 0.9, fin: 1.5}, {t: 'Ici', debut: 3, fin: 3.2}, {t: 'on', debut: 3.2, fin: 3.3}, {t: 'cuisine', debut: 3.3, fin: 3.7}, {t: 'les', debut: 3.7, fin: 3.8}, {t: 'ramens', debut: 3.8, fin: 4.3}, {t: 'maison.', debut: 4.3, fin: 4.8}];
    fs.mkdirSync(path.join(p1.cache, 'medias', 'M1'), {recursive: true});
    fs.writeFileSync(path.join(p1.cache, 'medias', 'M1', 'mots.json'), json({mots: motsM1}));
    p1.media('M1').transcription = true;
    p1.sauver();
    ({serveur} = await demarrerServeur(ctx, {port: 0}));
    const port = serveur.address().port;
    const base = `http://127.0.0.1:${port}`;
    const porte = JSON.parse(fs.readFileSync(path.join(SUPPORT, 'porte-ia.json'), 'utf8'));
    essai('le serveur ouvert annonce sa porte : son port et la clé', porte.port === port && porte.cle === cle);

    // — Chrome —
    const portLibre = () => new Promise((ok, ko) => { const s = net.createServer(); s.on('error', ko); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
    const PORT_CDP = await portLibre();
    chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${path.join(T, 'chrome')}`, '--window-size=1480,1000', '--autoplay-policy=no-user-gesture-required',
      `--remote-debugging-port=${PORT_CDP}`, `${base}/`], {stdio: 'ignore', env: {...process.env, HOME: MAISON_REELLE, USERPROFILE: MAISON_REELLE}});
    let ws = null;
    for (let i = 0; i < 120 && !ws; i++) {
      try { ws = (await (await fetch(`http://127.0.0.1:${PORT_CDP}/json/list`)).json()).find((x) => x.type === 'page' && x.url.startsWith(base))?.webSocketDebuggerUrl; } catch { /* Chrome démarre */ }
      if (!ws) await dormir(250);
    }
    if (!ws) throw new Error('Chrome ne répond pas');
    const sock = new WebSocket(ws);
    await new Promise((ok, ko) => { sock.onopen = ok; sock.onerror = ko; });
    let num = 0;
    const attente = new Map();
    const erreursPage = [];
    sock.onmessage = (m) => {
      const j = JSON.parse(m.data);
      if (j.id && attente.has(j.id)) { attente.get(j.id)(j); attente.delete(j.id); }
      if (j.method === 'Runtime.exceptionThrown') erreursPage.push(j.params.exceptionDetails.exception?.description ?? j.params.exceptionDetails.text);
      if (j.method === 'Runtime.consoleAPICalled' && j.params.type === 'error') erreursPage.push(j.params.args.map((a) => a.value ?? a.description).join(' '));
    };
    const cdp = (method, params = {}) => new Promise((ok, ko) => { const id = ++num; attente.set(id, (j) => (j.error ? ko(new Error(`${method} : ${j.error.message}`)) : ok(j.result))); sock.send(JSON.stringify({id, method, params})); });
    await cdp('Runtime.enable');
    const js = async (expr) => {
      const r = await cdp('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true});
      if (r.exceptionDetails) throw new Error(`JS : ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    };
    const jusqua = async (expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(`!!(${expr})`)) return true; await dormir(120); } return false; };
    const capture = async (nom) => { if (!CAPTURES) return; fs.mkdirSync(CAPTURES, {recursive: true}); const {data} = await cdp('Page.captureScreenshot', {format: 'png'}); fs.writeFileSync(path.join(CAPTURES, `${nom}.png`), Buffer.from(data, 'base64')); };
    const page = () => js('JSON.stringify({montage: window.derush.projet().montage, dessus: window.derush.projet().superpositions, indic: window.derush.projet().indications, style: window.derush.projet().style, sortie: window.derush.projet().sortie, h: window.derush.videos.historique()})').then(JSON.parse);
    const disque = () => JSON.parse(fs.readFileSync(path.join(PROJET, 'derush.json'), 'utf8'));

    const ouvert = await jusqua('window.derush && window.derush.projet() && window.derush.porte', 30000);
    essai('l’éditeur s’ouvre sur le projet, avec la porte', ouvert, ouvert ? '' : {erreurs: erreursPage.slice(0, 5)});
    if (!ouvert) throw new Error('l’éditeur ne s’est pas ouvert');
    // la garde : aucune fenêtre « Ouvrir », aucun envoi à une IA
    await js(`(() => { window.__urls = []; const vrai = window.fetch.bind(window); window.fetch = async (url, o = {}) => { const u = String(url); window.__urls.push(u); if (u.startsWith('/api/choisir') || /^\\/api\\/claude\\/(demander|ajouter)/.test(u)) return new Response('{"erreur":"coupé"}', {status: 400}); return vrai(url, o); }; return true; })()`);
    await jusqua("document.querySelector('#piste-montage')");
    essai('la fenêtre vient chercher les gestes des IA dès son ouverture', await jusqua('window.derush.porte.etat().tours > 0', 8000), await js('JSON.stringify(window.derush.porte.etat())'));

    titre('Une IA branchée par le pont (comme l’app Claude)');
    const ia = pont({DERUSH_SUPPORT: SUPPORT});
    const ii = await ia.demande('initialize', {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'claude-ai', version: '0.14'}});
    ia.notifier('notifications/initialized');
    const vue = await js("window.derush.api('GET', '/api/porte')");
    essai('le pont trouve Dérush ouvert : Dérush lui répond, et sait que Claude est branché', ii.result?.serverInfo?.version && ii.result.protocolVersion === '2025-06-18' && vue.ia.some((x) => x.nom === 'Claude') && vue.fenetre === true, {vue, erreurs: ia.erreurs, page: erreursPage.slice(0, 4), etat: await js('JSON.stringify(window.derush.porte.etat())').catch((e) => e.message), urls: await js("JSON.stringify(window.__urls.slice(-15))"), att: await js("window.derush.api('GET', '/api/porte/attente?t=0').then((r) => JSON.stringify(r)).catch((e) => 'ERR ' + e.message)"), vue2: await js("window.derush.api('GET', '/api/porte')")});
    const lp0 = await ia.outil('lire_projet');
    const v0 = JSON.parse(lp0.content[0].text.split('\n').slice(1).join('\n'));
    essai('lire_projet : le projet de la fenêtre (titre, format, montage vide, style)', !lp0.isError && v0.titre === 'Restaurant' && v0.montage.length === 0 && v0.format.fps === 30 && v0.style.sous_titres, lp0.content[0].text.slice(0, 400));
    const lm = await ia.outil('lister_medias');
    const medias = JSON.parse(lm.content[0].text.split('\n').slice(1).join('\n'));
    essai('lister_medias : les trois rushes, leur durée, et le début de ce qui est dit dans M1',
      medias.length === 3 && medias.map((m) => m.id).join() === 'M1,M2,M3' && Math.abs(medias[0].duree_s - 6) < 0.1 && medias[0].parle && /Bienvenue au restaurant/.test(medias[0].debut_de_ce_qui_est_dit) && medias[1].parle === false, medias);

    const a1 = await ia.outil('ajouter_plan', {media: 'M1', entree: 0, duree: 2, titre: 'Accueil'});
    await dormir(50);
    const pg1 = await page();
    const dk1 = disque();
    essai('ajouter_plan : P1 au montage (0 → 2 s), dans la page, et déjà enregistré quand l’IA a sa réponse',
      !a1.isError && pg1.montage.length === 1 && pg1.montage[0].id === 'P1' && pg1.montage[0].entree === 0 && pg1.montage[0].sortie === 2 && pg1.montage[0].titre === 'Accueil' && dk1.montage.length === 1 && dk1.montage[0].id === 'P1', {a1, pg1: pg1.montage});
    const curseur = await js("(() => { const c = document.querySelector('#tl-interieur .porte-curseur'); return c ? {nom: c.querySelector('.porte-nom').textContent, visible: c.classList.contains('visible'), bulle: c.querySelector('.porte-bulle').textContent, ia: c.style.getPropertyValue('--ia')} : null; })()");
    essai('le curseur de l’IA s’affiche sur la timeline, à son nom (Claude, en orange), et dit ce qu’elle fait', curseur?.nom === 'Claude' && curseur.visible && /pose « cuisine\.mp4 »/.test(curseur.bulle) && /#D97757/i.test(curseur.ia), curseur);
    await capture('01-curseur-de-l-ia');
    await ia.outil('ajouter_plan', {media: 'M2', entree: 1, duree: 2});
    const a3 = await ia.outil('ajouter_plan', {media: 'M3', duree: 1.5, apres: 'debut'});
    const pg2 = await page();
    essai('« apres: debut » : M3 en tête ; l’ordre du montage est P3, P1, P2', !a3.isError && pg2.montage.map((x) => x.id).join() === 'P3,P1,P2', pg2.montage.map((x) => x.id));
    const cp = await ia.outil('couper', {temps: 2.5});
    const pg3 = await page();
    essai('couper à 2,5 s : P1 coupé (0 → 1 s et 1 → 2 s dans son fichier), la seconde moitié est P4',
      !cp.isError && /P1 coupé/.test(cp.content[0].text) && pg3.montage.map((x) => x.id).join() === 'P3,P1,P4,P2' && pg3.montage[1].sortie === 1 && pg3.montage[2].entree === 1, pg3.montage);
    const bord = await ia.outil('couper', {temps: 1.5});
    const loin = await ia.outil('couper', {temps: 60});
    essai('couper sur un bord, ou après la fin : refusé, en clair, sans rien changer', bord.isError && /bord/.test(bord.content[0].text) && loin.isError && /rien dans le montage/.test(loin.content[0].text) && (await page()).montage.length === 4);
    const dp = await ia.outil('deplacer', {id: 'P2', apres: 'P3'});
    essai('deplacer P2 après P3', !dp.isError && (await page()).montage.map((x) => x.id).join() === 'P3,P2,P1,P4');
    const rg = await ia.outil('rogner', {id: 'P2', entree: 1.5});
    essai('rogner P2 : son début passe à 1,5 s dans le fichier', !rg.isError && (await page()).montage.find((x) => x.id === 'P2').entree === 1.5);
    const rgv = await ia.outil('rogner', {id: 'P2', entree: 3, sortie: 2});
    essai('rogner jusqu’à ne plus rien laisser : refusé', rgv.isError && /il ne reste rien/.test(rgv.content[0].text));
    const sn = await ia.outil('regler_son', {ids: ['P3', 'P2'], gain_db: -6, coupe: true});
    const ver = await ia.outil('regler_son', {ids: ['P1'], version: 'clair'});
    const pg4 = await page();
    essai('regler_son : −6 dB et son coupé sur deux plans ; une version pas encore prête est refusée',
      !sn.isError && pg4.montage.filter((x) => ['P3', 'P2'].includes(x.id)).every((x) => x.son.gain_db === -6 && x.son.actif === false) && ver.isError && /pas prête/.test(ver.content[0].text));
    const cl = await ia.outil('regler_couleur', {ids: ['P1', 'P4'], exposition: 30, temperature: -20});
    const cl2 = await ia.outil('regler_couleur', {ids: ['P1'], saturation: 150});
    const pg5 = await page();
    essai('regler_couleur : les réglages s’ajoutent (bornés à 100) et la page les garde ; le disque aussi',
      !cl.isError && cl2 && !cl2.isError && memes(pg5.montage.find((x) => x.id === 'P1').couleur, {exposition: 30, temperature: -20, saturation: 100}) && memes(pg5.montage.find((x) => x.id === 'P4').couleur, {exposition: 30, temperature: -20})
      && memes(disque().montage.find((x) => x.id === 'P1').couleur, {exposition: 30, saturation: 100, temperature: -20}) && !pg5.montage.find((x) => x.id === 'P3').couleur, pg5.montage.map((x) => [x.id, x.couleur]));
    const ti = await ia.outil('poser_effet', {modele: 'titre', debut: 0.5, fin: 2, reglages: {texte: 'RAMEN', position: 'haut'}});
    const tr1 = await ia.outil('poser_effet', {modele: 'zoom', temps: 1.6});
    const tr2 = await ia.outil('poser_effet', {modele: 'fondu', temps: 1.4});
    const pg6 = await page();
    const cps = pg6.indic.filter((i) => ['zoom', 'fondu'].includes(i.modele));
    essai('poser_effet : un titre (texte, position), puis deux transitions sur la même coupe : la seconde remplace la première',
      !ti.isError && pg6.indic.some((i) => i.modele === 'titre' && i.reglages.texte === 'RAMEN' && i.reglages.position === 'haut') && !tr1.isError && !tr2.isError && cps.length === 1 && cps[0].modele === 'fondu' && /remplace/.test(tr2.content[0].text), pg6.indic);
    const mauvais = await ia.outil('poser_effet', {modele: 'titre', reglages: {couleur_folle: 'x'}});
    const inconnu = await ia.outil('poser_effet', {modele: 'explosion'});
    essai('un réglage inconnu, un effet inconnu : refusés en le disant', mauvais.isError && /couleur_folle/.test(mauvais.content[0].text) && inconnu.isError && /lister_effets/.test(inconnu.content[0].text));
    const idTitre = pg6.indic.find((i) => i.modele === 'titre').id;
    const re = await ia.outil('regler_effet', {id: idTitre, reglages: {texte: 'RAMEN MAISON'}});
    essai('regler_effet : le texte du titre change, ses autres réglages restent', !re.isError && (await page()).indic.find((i) => i.id === idTitre).reglages.texte === 'RAMEN MAISON' && (await page()).indic.find((i) => i.id === idTitre).reglages.position === 'haut');
    const imp = await ia.outil('importer_medias', {chemins: [PHOTO]});
    const idPhoto = JSON.parse(imp.content[0].text.split('\n').slice(1).join('\n')).ajoutes[0]?.id;
    essai('importer_medias : la photo rejoint les médias', !imp.isError && idPhoto === 'M4', imp.content[0].text);
    await jusqua("window.derush.projet().medias.some((m) => m.id === 'M4' && m.largeur)", 20000);
    const pd = await ia.outil('poser_par_dessus', {media: 'M4', debut: 1, duree: 1.5, cadre: 'incrustation'});
    const pg7 = await page();
    essai('poser_par_dessus : le logo en incrustation de 1 à 2,5 s, sans son', !pd.isError && pg7.dessus.length === 1 && pg7.dessus[0].media === 'M4' && pg7.dessus[0].debut === 1 && pg7.dessus[0].cadre === 'incrustation' && pg7.dessus[0].son.actif === false, pg7.dessus);
    const du = await ia.outil('dupliquer', {id: 'P3'});
    const idDup = JSON.parse(du.content[0].text.split('\n').slice(1).join('\n')).id;
    essai('dupliquer P3 : la copie juste après lui', !du.isError && (await page()).montage.map((x) => x.id)[1] === idDup);
    const ca = await ia.outil('ajouter_case', {genre: 'carte', duree: 2, titre: 'Carte du quartier', consigne: 'Une carte de Tokyo, le restaurant épinglé.'});
    essai('ajouter_case : une case « Carte » de 2 s, à la fin, avec sa consigne', !ca.isError && (await page()).montage.at(-1).type === 'bloc' && (await page()).montage.at(-1).genre === 'carte' && (await page()).montage.at(-1).duree === 2);
    const sty = await ia.outil('regler_style', {look: 'trend', sous_titres: 'karaoke', accent: '#e10600'});
    const stx = await ia.outil('regler_style', {sous_titres: 'clignotant'});
    const pg8 = await page();
    essai('regler_style : le style Trend, des sous-titres karaoké, la couleur de l’accent ; une valeur inconnue refusée',
      !sty.isError && pg8.style.look === 'trend' && pg8.style.sous_titres.style === 'karaoke' && pg8.style.accent === '#E10600' && stx.isError, pg8.style);
    const fm = await ia.outil('regler_format', {format: 'carre'});
    essai('regler_format : carré 1080×1080', !fm.isError && (await page()).sortie.preset === 'carre' && (await page()).sortie.hauteur === 1080);
    await ia.outil('regler_format', {format: 'vertical'});
    const av = (await page()).montage.length;
    const sp = await ia.outil('supprimer', {ids: [idDup, 'P9']});
    const sp2 = await ia.outil('supprimer', {ids: [idDup]});
    essai('supprimer : un identifiant inconnu et rien ne part ; sinon l’élément part, le montage se recolle', sp.isError && /P9/.test(sp.content[0].text) && !sp2.isError && (await page()).montage.length === av - 1);
    const hA = (await page()).h;
    const an = await ia.outil('historique', {action: 'annuler'});
    const apresAn = await page();
    const rt = await ia.outil('historique', {action: 'retablir'});
    essai('historique : annuler remet la copie supprimée (un seul ⌘Z pour un geste de l’IA), rétablir la retire',
      !an.isError && apresAn.montage.length === av && apresAn.montage.some((x) => x.id === idDup) && !rt.isError && (await page()).montage.length === av - 1 && hA.annuler > 5, {hA, an: an.content[0].text});
    const lec = await ia.outil('lecture', {action: 'aller', temps: 2.2});
    essai('lecture : la tête de lecture va à 2,2 s', !lec.isError && Math.abs(await js('window.derush.temps()') - 2.2) < 0.05);

    titre('La vitesse et les fondus (Dérush 12)');
    const pv0 = await page();
    const idV = pv0.montage.find((x) => x.type === 'plan' && x.media === 'M1')?.id;
    const segAvant = await js(`(() => { const p = window.derush.projet(); return JSON.stringify(p.montage.map((x) => x.id)); })()`);
    const rv = await ia.outil('regler_vitesse', {ids: [idV], vitesse: 0.5});
    const pv1 = await page();
    const itV = pv1.montage.find((x) => x.id === idV);
    const dureeV = JSON.parse(rv.content[0].text.split('\n').slice(1).join('\n'))[0];
    essai('regler_vitesse ×0,5 : le plan garde son passage du fichier, il dure deux fois plus longtemps dans le montage',
      !rv.isError && itV.vitesse === 0.5 && Math.abs((dureeV.fin - dureeV.debut) - 2 * (itV.sortie - itV.entree)) < 0.05 && disque().montage.find((x) => x.id === idV)?.vitesse === 0.5, {rv: rv.content[0].text, itV});
    const rvPhoto = await ia.outil('regler_vitesse', {ids: [idV], vitesse: 500});
    essai('une vitesse hors des bornes (500) : refusée', rvPhoto.isError && /0.05 à 100/.test(rvPhoto.content[0].text));
    await js(`window.derush.aller(${dureeV.debut + 0.5})`);
    await dormir(300);
    const lecteur = await js("(() => { const v = [...document.querySelectorAll('#v-a, #v-b')].find((x) => !x.classList.contains('cache')); return v ? {vitesse: v.playbackRate, t: v.currentTime} : null; })()");
    essai('l’aperçu joue le plan à la moitié de sa vitesse, et 0,5 s de montage montrent 0,25 s du fichier',
      lecteur?.vitesse === 0.5 && Math.abs(lecteur.t - (itV.entree + 0.25)) < 0.08, lecteur);
    const badge = await js(`document.querySelector('#piste-montage .clip[data-id="${idV}"] .badges .vitesse')?.textContent`);
    essai('sur la timeline, le plan porte « ×0,5 »', badge === '×0,5', badge);
    const rf = await ia.outil('regler_fondu', {ids: [idV], entree: 1, courbe: 'douce'});
    const rfx = await ia.outil('regler_fondu', {ids: [idV], courbe: 'rebond'});
    await js(`window.derush.aller(${dureeV.debut + 0.5})`);
    await dormir(250);
    const opa = await js("(() => { const v = [...document.querySelectorAll('#v-a, #v-b')].find((x) => !x.classList.contains('cache')); return v ? Number(v.style.opacity || 1) : null; })()");
    essai('regler_fondu : un fondu d’entrée d’1 s en S ; à mi-chemin l’image est à moitié noire (aperçu) ; une courbe inconnue refusée',
      !rf.isError && json((await page()).montage.find((x) => x.id === idV).fondu) === json({entree: 1, sortie: 0, courbe: 'douce'}) && Math.abs(opa - 0.5) < 0.02 && rfx.isError, {opa, rf: rf.content[0].text});
    const pente = await js(`!!document.querySelector('#piste-montage .clip[data-id="${idV}"] .pente.entree')`);
    essai('sur la timeline, la pente du fondu d’entrée', pente);
    await capture('04-vitesse-fondu');
    const rf0 = await ia.outil('regler_fondu', {ids: [idV], entree: 0});
    const rv1 = await ia.outil('regler_vitesse', {ids: [idV], vitesse: 1});
    essai('fondu à 0 et vitesse 1 : le plan redevient comme avant', !rf0.isError && !rv1.isError && !(await page()).montage.find((x) => x.id === idV).fondu && !(await page()).montage.find((x) => x.id === idV).vitesse);

    titre('Arrêt sur image, à l’envers, son détaché, marqueurs, couleurs copiées (Dérush 12)');
    const donneesDe = (r) => JSON.parse(r.content.at(-1).text.split('\n').slice(1).join('\n'));
    const pa = await page();
    const cible = pa.montage.find((x) => x.type === 'plan' && x.media === 'M1');
    const nAvant = pa.montage.length;
    const ar = await ia.outil('arret_sur_image', {id: cible.id, secondes: 1.5});
    const pa2 = await page();
    const fige = ar.isError ? null : pa2.montage.find((x) => x.id === donneesDe(ar).id);
    const mFige = fige ? await js(`window.derush.projet().medias.find((m) => m.id === ${json(fige.media)})`) : null;
    essai('arret_sur_image : le plan coupé en deux, l’image figée (une photo PNG, 1,5 s) entre les deux moitiés',
      !ar.isError && pa2.montage.length === nAvant + 2 && mFige?.type === 'image' && /images figées/.test(mFige.chemin) && fs.existsSync(mFige.chemin) && Math.abs(fige.sortie - fige.entree - 1.5) < 0.04
      && pa2.montage[pa2.montage.findIndex((x) => x.id === fige.id) - 1]?.id === cible.id, {ar: ar.content.at(-1).text, fige, mFige});
    const autre = pa2.montage.find((x) => x.type === 'plan' && x.media === 'M2');
    const env = await ia.outil('a_l_envers', {id: autre.id});
    const pa3 = await page();
    const ret = pa3.montage.find((x) => x.id === autre.id);
    const mEnv = await js(`window.derush.projet().medias.find((m) => m.id === ${json(ret.media)})`);
    essai('a_l_envers : le plan pointe vers son passage retourné (un nouveau fichier, son compris), et se souvient d’où il vient',
      !env.isError && ret.media !== autre.media && ret.entree === 0 && Math.abs(ret.sortie - (autre.sortie - autre.entree)) < 0.06 && ret.envers?.media === autre.media && /à l’envers/.test(mEnv?.chemin ?? '') && fs.existsSync(mEnv.chemin), {env: env.content.at(-1).text, ret, mEnv: mEnv?.chemin});
    if (mEnv?.chemin) {
      const luma = (f, t) => spawnSync(FF, ['-v', 'error', '-ss', String(t), '-i', f, '-frames:v', '1', '-vf', 'scale=64:-2,format=gray', '-f', 'rawvideo', '-'], {encoding: 'buffer'}).stdout;
      const src = await js(`window.derush.projet().medias.find((m) => m.id === ${json(autre.media)}).chemin`);
      const d = autre.sortie - autre.entree;
      const egal = (a, b) => a && b && a.length === b.length && a.reduce((x, v, i) => x + Math.abs(v - b[i]), 0) / a.length < 6;
      essai('… la première image du passage retourné est la dernière du passage d’origine (et l’inverse)', egal(luma(mEnv.chemin, 0), luma(src, autre.entree + d - 1 / 30)) && egal(luma(mEnv.chemin, d - 1 / 30), luma(src, autre.entree)));
    }
    const env2 = await ia.outil('a_l_envers', {id: autre.id});
    const ret2 = (await page()).montage.find((x) => x.id === autre.id);
    essai('a_l_envers une seconde fois : le plan revient à l’endroit (son média, ses temps)', !env2.isError && ret2.media === autre.media && ret2.entree === autre.entree && ret2.sortie === autre.sortie && !ret2.envers);
    const dt = await ia.outil('detacher_son', {id: cible.id});
    const pa4 = await page();
    const son = dt.isError ? null : pa4.dessus.find((x) => x.id === donneesDe(dt).id);
    const segCible = await js(`(() => { const p = window.derush.projet(); let t = 0; for (const x of p.montage) { const d = x.type === 'plan' ? (x.sortie - x.entree) / (x.vitesse || 1) : x.duree; if (x.id === ${json(cible.id)}) return t; t += d; } return null; })()`);
    essai('detacher_son : un son par-dessus au même endroit (son seul), et le plan garde son image sans son',
      !dt.isError && son?.son_seul === true && son.media === cible.media && Math.abs(son.debut - segCible) < 0.04 && son.son.actif === true && pa4.montage.find((x) => x.id === cible.id).son.actif === false, {dt: dt.content.at(-1).text, son});
    await js(`window.derush.aller(${segCible + 0.2})`);
    await dormir(250);
    const dessusCache = await js("document.querySelector('#v-dessus').classList.contains('cache')");
    essai('… dans l’aperçu, un son détaché ne cache pas l’image du montage', dessusCache);
    const dt2 = await ia.outil('detacher_son', {id: cible.id});
    essai('détacher deux fois : refusé (le son du plan est déjà coupé)', dt2.isError && /coupé/.test(dt2.content.at(-1).text));
    const mk = await ia.outil('poser_marqueur', {temps: 1.25, nom: 'Le bol arrive', couleur: 'rouge'});
    const idK = mk.isError ? null : donneesDe(mk).id;
    await dormir(150);
    const surRegle = await js(`(() => { const e = document.querySelector('#regle .marqueur[data-marqueur="${idK}"]'); return e ? {nom: e.textContent.trim(), gauche: parseFloat(e.style.left)} : null; })()`);
    const mk2 = await ia.outil('poser_marqueur', {id: idK, nom: 'Le bol', couleur: 'vert'});
    const pa5 = await page();
    essai('poser_marqueur : un marqueur rouge sur la règle, à son temps ; renommé et recoloré par son identifiant ; enregistré',
      !mk.isError && /^K\d+$/.test(idK) && surRegle?.nom === 'Le bol arrive' && !mk2.isError && json(await js('window.derush.projet().marqueurs')) === json([{id: idK, t: 1.25, nom: 'Le bol', couleur: 'vert'}])
      && json(disque().marqueurs) === json([{id: idK, t: 1.25, nom: 'Le bol', couleur: 'vert'}]), {surRegle, m: await js('window.derush.projet().marqueurs'), d: disque().marqueurs});
    const lpm = donneesDe(await ia.outil('lire_projet'));
    essai('lire_projet donne les marqueurs à l’IA', lpm.marqueurs?.[0]?.nom === 'Le bol' && lpm.marqueurs[0].temps === 1.25);
    const smk = await ia.outil('supprimer', {ids: [idK]});
    essai('supprimer un marqueur', !smk.isError && (await js('window.derush.projet().marqueurs.length')) === 0);
    const avecCouleur = pa5.montage.find((x) => x.couleur);
    const sansCouleur = pa5.montage.filter((x) => x.type === 'plan' && !x.couleur && x.id !== fige?.id).slice(0, 2).map((x) => x.id);
    const cc = await ia.outil('copier_couleur', {de: avecCouleur.id, vers: sansCouleur});
    const pa6 = await page();
    essai('copier_couleur : les mêmes couleurs sur les plans choisis', !cc.isError && sansCouleur.every((id) => memes(pa6.montage.find((x) => x.id === id).couleur, avecCouleur.couleur)), {cc: cc.content.at(-1).text});
    await capture('05-gestes');
    const hist = await ia.outil('historique', {action: 'annuler'});
    essai('… et un seul « annuler » retire la copie des couleurs', !hist.isError && sansCouleur.every((id) => !(pa6.montage.find((x) => x.id === id) && (async () => 0)) || true) && (await page()).montage.filter((x) => sansCouleur.includes(x.id)).every((x) => !x.couleur));

    titre('Les transitions entre plans (Dérush 12)');
    const pt0 = await page();
    // deux plans vidéo qui se suivent, avec du fichier autour de leur coupe
    const paires = pt0.montage.map((x, i) => [pt0.montage[i - 1], x]).filter(([a, b]) => a && a.type === 'plan' && b.type === 'plan');
    const medDe = async (id) => js(`window.derush.projet().medias.find((m) => m.id === ${json(id)})`);
    let paire = null;
    for (const [a, b] of paires) { const ma = await medDe(a.media); const mb = await medDe(b.media); if (ma?.type === 'video' && mb?.type === 'video' && b.entree >= 0.3 && ma.duree - a.sortie >= 0.3) { paire = [a, b]; break; } }
    if (!paire) {
      // sinon on en fabrique une : M3 de 1 à 2 s, puis M2 de 1 à 2 s, à la fin
      await ia.outil('ajouter_plan', {media: 'M3', entree: 1, duree: 1});
      await ia.outil('ajouter_plan', {media: 'M2', entree: 1, duree: 1});
      const pt1 = await page();
      paire = [pt1.montage.at(-2), pt1.montage.at(-1)];
    }
    const [pa_, pb_] = paire;
    const tr = await ia.outil('poser_transition', {id: pb_.id, genre: 'enchaine', duree: 0.6});
    const trd = tr.isError ? null : donneesDe(tr);
    essai('poser_transition : un fondu enchaîné de 0,6 s, centré sur la coupe (enregistré sur le plan qui entre)',
      !tr.isError && trd.duree_tenue === 0.6 && disque().montage.find((x) => x.id === pb_.id)?.transition?.genre === 'enchaine', tr.content.at(-1).text);
    const coupe = await js(`(() => { const p = window.derush.projet(); let t = 0; for (const x of p.montage) { if (x.id === ${json(pb_.id)}) return t; t += x.type === 'plan' ? (x.sortie - x.entree) / (x.vitesse || 1) : x.duree; } return null; })()`);
    await js(`window.derush.aller(${coupe})`);
    await dormir(400);
    const vus = await js("[...document.querySelectorAll('#v-a, #v-b')].map((v) => ({cache: v.classList.contains('cache'), z: v.style.zIndex, o: v.style.opacity, t: v.currentTime}))");
    const dessus = vus.find((v) => v.z === '2');
    const dessous = vus.find((v) => v.z === '1');
    essai('dans l’aperçu, à la coupe : les deux plans visibles, celui qui entre par-dessus à moitié fondu',
      vus.every((v) => !v.cache) && dessus && dessous && Math.abs(Number(dessus.o) - 0.5) < 0.06, vus);
    const trv = await ia.outil('poser_transition', {temps: coupe + 0.01, genre: 'volet', duree: 10});
    essai('… changée en volet par le temps de la coupe ; une durée trop longue est raccourcie (et le résultat le dit)', !trv.isError && /Volet/.test(trv.content.at(-1).text) && donneesDe(trv).duree_tenue <= 2 * 0.31 + 0.01 || /raccourci/.test(trv.content.at(-1).text), trv.content.at(-1).text);
    const badgeTr = await js(`!!document.querySelector('#piste-montage .clip[data-id="${pb_.id}"] .trans-clip.volet')`);
    essai('sur la timeline, le début du plan porte la marque du volet', badgeTr);
    // une transition vers une photo (l'image figée posée plus haut) : dans l'aperçu, la photo arrive sur la vidéo qui continue
    const pPhoto = (await page()).montage.find((x, i, l) => i > 0 && l[i - 1].type === 'plan' && /Arrêt sur image/.test(x.titre ?? ''));
    if (pPhoto) {
      const trp = await ia.outil('poser_transition', {id: pPhoto.id, genre: 'enchaine', duree: 0.6});
      const coupeP = await js(`(() => { const p = window.derush.projet(); let t = 0; for (const x of p.montage) { if (x.id === ${json(pPhoto.id)}) return t; t += x.type === 'plan' ? (x.sortie - x.entree) / (x.vitesse || 1) : x.duree; } return null; })()`);
      await js(`window.derush.aller(${coupeP + 0.05})`);
      await dormir(400);
      const vuP = await js("(() => { const i = document.querySelector('#i-fixe-m'); const v = [...document.querySelectorAll('#v-a, #v-b')].find((x) => !x.classList.contains('cache')); return {photo: !i.classList.contains('cache'), zPhoto: i.style.zIndex, oPhoto: Number(i.style.opacity || 1), video: !!v, zVideo: v?.style.zIndex}; })()");
      essai('une transition vers une photo : dans l’aperçu, la photo arrive par-dessus la vidéo qui continue dessous',
        !trp.isError && vuP.photo && vuP.zPhoto === '2' && vuP.video && vuP.zVideo === '1' && vuP.oPhoto > 0.45 && vuP.oPhoto < 0.75, vuP);
      await ia.outil('poser_transition', {id: pPhoto.id, genre: 'aucune'});
    } else essai('une transition vers une photo : une image figée suit un plan', false, (await page()).montage.map((x) => [x.id, x.titre]));
    const tr0 = await ia.outil('poser_transition', {id: pb_.id, genre: 'aucune'});
    const premier = (await page()).montage[0].id;
    const trx = await ia.outil('poser_transition', {id: premier, genre: 'enchaine'});
    essai('« aucune » : la coupe redevient nette ; sur le premier plan du montage : refusé', !tr0.isError && !(await page()).montage.find((x) => x.id === pb_.id).transition && trx.isError, trx.content.at(-1).text);

    titre('Égaliser le son, couper sur le temps, ambiances (Dérush 12)');
    // un rush plus calme (−12 dB) et une musique à 120 BPM (un coup toutes les 0,5 s), faits par FFmpeg
    const CALME = path.join(T, 'rushes', 'calme.mp4');
    ff(['-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=30:duration=4', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=4', '-af', 'volume=0.25', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', CALME]);
    const MUSIQUE = path.join(T, 'rushes', 'tempo-120.wav');
    ff(['-f', 'lavfi', '-i', "aevalsrc='if(lt(mod(t\\,0.5)\\,0.04)\\,0.8*sin(2*PI*900*t)*exp(-60*mod(t\\,0.5))\\,0)':s=48000:d=12", MUSIQUE]);
    const impE = donneesDe(await ia.outil('importer_medias', {chemins: [CALME, MUSIQUE]}));
    const [idCalme, idMus] = impE.ajoutes.map((x) => x.id);
    await jusqua(`window.derush.projet().medias.filter((m) => [${json(idCalme)}, ${json(idMus)}].includes(m.id) && m.duree).length === 2`, 20000);
    const pc = donneesDe(await ia.outil('ajouter_plan', {media: idCalme, entree: 0.5, duree: 2}));
    // deux plans au son normal, frais (ceux d'avant ont été coupés ou réglés plus haut)
    const f1 = donneesDe(await ia.outil('ajouter_plan', {media: 'M3', entree: 0, duree: 2}));
    const f2 = donneesDe(await ia.outil('ajouter_plan', {media: 'M2', entree: 0, duree: 2}));
    const eg = await ia.outil('egaliser_son', {ids: [pc.id, f1.id, f2.id]});
    const egd = eg.isError ? null : donneesDe(eg);
    const gCalme = egd?.plans.find((x) => x.id === pc.id);
    essai('egaliser_son : le plan 12 dB plus calme reçoit environ +12 dB, les autres presque rien (le niveau du plan médian)',
      !eg.isError && gCalme && Math.abs(gCalme.gain_db - 12) <= 1 && egd.plans.filter((x) => x.id !== pc.id).every((x) => Math.abs(x.gain_db) <= 1) && (await page()).montage.find((x) => x.id === pc.id).son.gain_db === gCalme.gain_db, eg.content.at(-1).text);
    const am = await ia.outil('regler_couleur', {ids: [pc.id], ambiance: 'nb'});
    const amx = await ia.outil('regler_couleur', {ids: [pc.id], ambiance: 'sepia'});
    essai('regler_couleur « ambiance » : noir et blanc (saturation −100, contraste +20) ; une ambiance inconnue refusée', !am.isError && memes((await page()).montage.find((x) => x.id === pc.id).couleur, {saturation: -100, contraste: 20}) && amx.isError);
    const sMus = donneesDe(await ia.outil('poser_par_dessus', {media: idMus, debut: 0, duree: 12}));
    const cst = await ia.outil('couper_sur_le_temps', {musique: sMus.id});
    const cstd = cst.isError ? null : donneesDe(cst);
    const coupesApres = await js('(() => { const p = window.derush.projet(); let t = 0; const c = []; for (const x of p.montage) { t += x.type === "plan" ? (x.sortie - x.entree) / (x.vitesse || 1) : x.duree; c.push(Math.round(t * 1000) / 1000); } return c.slice(0, -1); })()');
    const surTemps = coupesApres.filter((c) => c <= 12.2).filter((c) => Math.abs(c / 0.5 - Math.round(c / 0.5)) * 0.5 <= 1 / 30 + 1e-6);
    essai('couper_sur_le_temps : la musique est à 120 BPM, et les coupes pendant la musique tombent sur ses temps (toutes les 0,5 s)',
      !cst.isError && Math.abs(cstd.tempo - 120) < 2 && cstd.calees >= 1 && surTemps.length >= coupesApres.filter((c) => c <= 12.2).length - cstd.laissees, {r: cst.content.at(-1).text, coupesApres});

    titre('Ce que lit le serveur (transcription, images, recherche, notes)');
    const lt = await ia.outil('lire_transcription', {media: 'M1', mots: true});
    const ltd = JSON.parse(lt.content[0].text.split('\n').slice(1).join('\n'));
    essai('lire_transcription : deux phrases avec leurs temps, et les mots', !lt.isError && ltd.phrases.length === 2 && ltd.phrases[1].texte === 'Ici on cuisine les ramens maison.' && ltd.mots.length === 9, ltd);
    const lt2 = await ia.outil('lire_transcription', {media: 'M2'});
    essai('un média sans transcription : dit en clair', /pas encore prête|Personne ne parle/.test(lt2.content[0].text));
    const ch = await ia.outil('chercher_medias', {dit: 'les ramens'});
    const chd = JSON.parse(ch.content[0].text.split('\n').slice(1).join('\n'));
    essai('chercher_medias : « les ramens » trouvé dans M1 à 3,7 s', !ch.isError && chd[0]?.media === 'M1' && chd[0].moments_ou_c_est_dit[0].debut === 3.7, chd);
    // ce qu'on voit : les étiquettes d'Apple Vision, posées ici comme Vision les range (un vrai Vision les fait sur Mac)
    fs.writeFileSync(path.join(PROJET, '.derush', 'medias', 'M2', 'etiquettes.json'), json({version: 1, etiquettes: [{id: 'beach', nom: 'plage', conf: 0.82, temps: [1, 3]}, {id: 'night_sky', nom: 'nuit', conf: 0.5, temps: [3]}]}));
    const vu1 = await ia.outil('chercher_medias', {montre: 'plages'});
    const vu2 = await ia.outil('chercher_medias', {montre: 'plage nuit'});
    const vu3 = await ia.outil('chercher_medias', {montre: 'beach'});
    const vu4 = await ia.outil('chercher_medias', {montre: 'girafe'});
    essai('chercher_medias « montre » : « plages » trouve la plage de M2 (1 s, 3 s) ; « plage nuit » seulement où les deux se voient (3 s) ; l’étiquette anglaise aussi ; une girafe nulle part',
      donneesDe(vu1)[0]?.media === 'M2' && json(donneesDe(vu1)[0].temps_ou_on_le_voit) === json([1, 3]) && json(donneesDe(vu2)[0]?.temps_ou_on_le_voit) === json([3]) && donneesDe(vu3)[0]?.media === 'M2' && /Aucun média/.test(vu4.content.at(-1).text), [vu1, vu2].map((x) => x.content.at(-1).text));
    // « Trouver un moment », dans le panneau des médias
    await js("(() => { const i = document.querySelector('#trouver'); i.value = 'plage'; i.dispatchEvent(new Event('input', {bubbles: true})); })()");
    const trouve = await jusqua("document.querySelector('#trouver-res .trouver-t[data-trouver=\"M2\"]')", 5000);
    const lignes = await js("[...document.querySelectorAll('#trouver-res .trouver-ligne')].map((l) => l.textContent.replace(/\\s+/g, ' ').trim())");
    essai('« Trouver un moment » : « plage » montre M2, ce qu’on y voit et ses temps (0:01, 0:03), à la place de la grille', trouve && /On voit : plage/.test(lignes.join(' ')) && /00:01/.test(lignes.join(' ')) && await js("document.querySelector('#grille-medias').classList.contains('cache')"), lignes);
    await js("document.querySelector('#trouver-res .trouver-t[data-trouver=\"M2\"][data-t=\"3\"]').click()");
    const ouvert3 = await jusqua("window.derush.ui().src && window.derush.ui().src.id === 'M2' && window.derush.ui().src.entree != null", 4000);
    essai('… une pastille ouvre le rush à ce moment, un passage choisi autour (prêt à poser)', ouvert3, await js('JSON.stringify(window.derush.ui().src)'));
    await js("(() => { const i = document.querySelector('#trouver'); i.value = 'cuisine les ramens'; i.dispatchEvent(new Event('input', {bubbles: true})); })()");
    await jusqua("/On le dit/.test(document.querySelector('#trouver-res').textContent)", 5000);
    essai('… et ce qui est dit (« on cuisine les ramens » dans M1)', /cuisine les ramens/.test(await js("document.querySelector('#trouver-res').textContent")));
    await capture('06-trouver');
    await js("(() => { const i = document.querySelector('#trouver'); i.value = ''; i.dispatchEvent(new Event('input', {bubbles: true})); })()");
    await jusqua("!document.querySelector('#grille-medias').classList.contains('cache')", 3000);
    const lmv = donneesDe(await ia.outil('lister_medias'));
    essai('lister_medias dit ce qu’on voit dans chaque média (en français)', json(lmv.find((m) => m.id === 'M2').montre) === json(['plage', 'nuit']), lmv.find((m) => m.id === 'M2'));
    const rm = await ia.outil('regarder_media', {media: 'M2', images: 4});
    essai('regarder_media : une planche JPEG de 4 images, et leurs temps dans le texte', !rm.isError && rm.content[0].type === 'image' && rm.content[0].mimeType === 'image/jpeg' && Buffer.from(rm.content[0].data, 'base64').subarray(0, 2).toString('hex') === 'ffd8' && /4 images/.test(rm.content[1].text), rm.content.at(-1));
    const vi = await ia.outil('voir_image', {temps: 1.2});
    essai('voir_image : l’image du montage à 1,2 s (le plan, et le logo en incrustation)', !vi.isError && vi.content[0].type === 'image' && /incrustation/.test(vi.content[1].text), vi.content.at(-1));
    const nt = await ia.outil('noter_media', {media: 'M2', notes: '0-5 s mire de couleurs, fixe, aucun mouvement.'});
    const lm2 = await ia.outil('lister_medias');
    essai('noter_media : la note revient dans lister_medias, gardée dans le projet (.derush)',
      !nt.isError && JSON.parse(lm2.content[0].text.split('\n').slice(1).join('\n')).find((m) => m.id === 'M2').notes === '0-5 s mire de couleurs, fixe, aucun mouvement.' && fs.existsSync(path.join(PROJET, '.derush', 'porte', 'notes.json')));
    const le = await ia.outil('lister_effets');
    essai('lister_effets : les 19 effets de Dérush, avec leurs réglages', JSON.parse(le.content[0].text.split('\n').slice(1).join('\n')).length === 19);

    titre('Une seconde IA, en direct (comme Claude Code)');
    const direct = async (corps, sid = null) => { const r = await fetch(`${base}/mcp`, {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${cle}`, ...(sid ? {'Mcp-Session-Id': sid} : {})}, body: json(corps)}); return {code: r.status, sid: r.headers.get('mcp-session-id'), corps: r.status === 202 ? null : await r.json()}; };
    const d1 = await direct({jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'codex-mcp-client', version: '0.6'}}});
    const d2 = await direct({jsonrpc: '2.0', id: 2, method: 'tools/call', params: {name: 'ajouter_plan', arguments: {media: 'M2', duree: 1}}}, d1.sid);
    await dormir(100);
    const nom2 = await js("document.querySelector('#tl-interieur .porte-curseur .porte-nom')?.textContent");
    essai('une app qui parle HTTP directement (Codex) : sa session, son geste, son nom sur le curseur (ChatGPT)', d1.code === 200 && d1.sid && !d2.corps.result.isError && nom2 === 'ChatGPT', {d2: d2.corps, nom2});
    const sansCleHttp = await fetch(`${base}/mcp`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: json({jsonrpc: '2.0', id: 1, method: 'ping'})});
    // fetch ne laisse pas changer le nom d'hôte : une vraie demande HTTP, comme celle d'une page piégée (DNS rebinding)
    const hote = await new Promise((ok) => {
      const corps = json({jsonrpc: '2.0', id: 1, method: 'ping'});
      const r = http.request({host: '127.0.0.1', port, path: '/mcp', method: 'POST', headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corps), Authorization: `Bearer ${cle}`, Host: `evil.example:${port}`}}, (res) => { res.resume(); ok({status: res.statusCode}); });
      r.on('error', () => ok({status: 0}));
      r.end(corps);
    });
    essai('sans la clé : 401 ; avec un autre nom d’hôte (rebinding) : refusé', sansCleHttp.status === 401 && hote.status === 403);
    const jeton = await fetch(`${base}/mcp`, {method: 'POST', headers: {'Content-Type': 'application/json', 'x-derush-jeton': 'x'}, body: json({jsonrpc: '2.0', id: 1, method: 'ping'})});
    essai('le jeton de la fenêtre n’ouvre pas la porte (seule la clé de la porte)', jeton.status === 401);

    titre('Connexions : la section de la porte');
    await js("document.querySelector('#b-connexions').click()");
    const sec = await jusqua("[...document.querySelectorAll('.feuille .cx-section h4')].some((h) => /Ouvre Dérush à tes IA/.test(h.textContent))", 15000);
    const cartes = await js("(() => { const s = [...document.querySelectorAll('.feuille .cx-section')].find((x) => /Ouvre Dérush à tes IA/.test(x.textContent)); return s ? {n: s.querySelectorAll('.cx-carte').length, titres: [...s.querySelectorAll('.cx-carte b')].map((b) => b.textContent.trim()), vivant: s.querySelector('.porte-vivant')?.textContent ?? '', ouverte: s.querySelector('[data-porte-ouvrir]')?.checked} : null; })()");
    essai('la section « Ouvre Dérush à tes IA » : trois cartes (Claude, ChatGPT, Claude Code), la porte ouverte, les IA venues à l’instant',
      sec && cartes?.n === 3 && cartes.titres.join() === 'Claude,ChatGPT,Claude Code' && cartes.ouverte === true && /Claude/.test(cartes.vivant) && /ChatGPT/.test(cartes.vivant), cartes);
    await dormir(500); // la feuille a fini d'arriver
    await capture('03-connexions-porte');
    const boutonCodex = await js("!!document.querySelector('.feuille [data-porte-app=brancher][data-app=codex]')");
    if (boutonCodex) {
      await js("document.querySelector('.feuille [data-porte-app=brancher][data-app=codex]').click()");
      await jusqua("document.querySelector('.feuille [data-porte-app=debrancher][data-app=codex]')", 8000);
      essai('« Brancher » ChatGPT : Dérush entre dans config.toml (du dossier personnel d’essai), la carte dit « Branché »', fs.readFileSync(CODEX, 'utf8').includes('[mcp_servers.derush]') && await js("!!document.querySelector('.feuille [data-porte-app=debrancher][data-app=codex]')"));
      await js("document.querySelector('.feuille [data-porte-app=debrancher][data-app=codex]').click()");
      await jusqua("document.querySelector('.feuille [data-porte-app=brancher][data-app=codex]')", 8000);
      essai('« Débrancher » : la section de Dérush repart', !fs.readFileSync(CODEX, 'utf8').includes('[mcp_servers.derush]'));
    } else essai('« Brancher » ChatGPT : le bouton est là (dossier .codex présent)', false, await js("document.querySelector('.feuille').innerText.slice(0, 600)"));
    await js("(() => { const c = document.querySelector('.feuille [data-porte-ouvrir]'); c.checked = false; c.dispatchEvent(new Event('change', {bubbles: true})); })()");
    await jusqua("document.querySelector('.feuille [data-porte-ouvrir]') && !document.querySelector('.feuille [data-porte-ouvrir]').checked && /Porte fermée/.test(document.querySelector('.feuille .porte-pied').textContent)", 8000);
    const ferme = await direct({jsonrpc: '2.0', id: 3, method: 'tools/call', params: {name: 'couper', arguments: {temps: 0.5}}}, d1.sid);
    const avantFerme = (await page()).montage.length;
    essai('porte fermée : un geste d’IA est refusé, sans rien changer', ferme.corps.result.isError && /porte de Dérush est fermée/.test(ferme.corps.result.content[0].text) && (await page()).montage.length === avantFerme, ferme.corps);
    await js("(() => { const c = document.querySelector('.feuille [data-porte-ouvrir]'); c.checked = true; c.dispatchEvent(new Event('change', {bubbles: true})); })()");
    await jusqua("document.querySelector('.feuille [data-porte-ouvrir]')?.checked", 8000);
    const rouverte = await direct({jsonrpc: '2.0', id: 4, method: 'tools/call', params: {name: 'lire_projet', arguments: {}}}, d1.sid);
    essai('… rouverte : les gestes repassent', !rouverte.corps.result.isError);
    await js("document.querySelector('.feuille [data-fermer]')?.click()");
    await dormir(300);

    titre('« Sur ma timeline » : ton IA monte ici, par la porte (un faux Claude)');
    await jusqua('window.derush.claude() && document.querySelector(\'[data-cl="mode-timeline"]\')', 15000);
    const avantTl = await page();
    await js("document.querySelector('[data-cl=\"mode-timeline\"]').click()");
    await jusqua('window.derush.ui().surTimeline === true', 3000);
    await js("window.derush.ecrire('Pose un plan de la cuisine au tout début, et marque le moment fort.')");
    await js('window.derush.envoyer()');
    const finTl = await jusqua("document.querySelector('#panneau-timeline.fini')", 60000);
    const apresTl = await page();
    const plan = apresTl.montage[0];
    const fLancement = path.join(PROJET, '.derush', 'sur-la-timeline', 'lancement.json');
    if (!fs.existsSync(fLancement)) console.log('    (diagnostic)', JSON.stringify({etat: await js("window.derush.api('GET', '/api/timeline')").catch((e) => e.message), panneau: await js("document.querySelector('#panneau-timeline')?.textContent ?? null"), sur: await js('window.derush.ui().surTimeline'), notes: await js("[...document.querySelectorAll('.note, .notes > *')].map((n) => n.textContent).slice(-4)"), serveur: journalServeur.slice(-4)}).slice(0, 1500));
    const lancement = fs.existsSync(fLancement) ? JSON.parse(fs.readFileSync(fLancement, 'utf8')) : {args: []};
    essai('le mode « Timeline » envoie la demande à l’IA avec la seule porte de Dérush (--strict-mcp-config, ses outils permis), et ses gestes arrivent dans la timeline',
      finTl && plan.titre === 'Par le faux Claude' && plan.media === 'M1' && (await js('window.derush.projet().marqueurs')).some((k) => k.nom === 'Faux Claude')
      && lancement.args.includes('--strict-mcp-config') && lancement.permis === 'mcp__derush', {montage: apresTl.montage.slice(0, 2), lancement: lancement.args.slice(-12)});
    const textePt = await js("document.querySelector('#panneau-timeline').textContent");
    essai('… le panneau dit ce que l’IA a fait (sa réponse)', /C’est fait/.test(textePt) && /posé un plan de cuisine/.test(textePt), textePt);
    await capture('07-sur-ma-timeline');
    await js("document.querySelector('#panneau-timeline [data-pt=\"annuler\"]').click()");
    await dormir(300);
    const annule = await page();
    essai('« Tout annuler » remet le montage d’avant la demande (le plan et le marqueur de l’IA repartent)', annule.montage.length === avantTl.montage.length && annule.montage[0].id === avantTl.montage[0].id && !(await js('window.derush.projet().marqueurs')).some((k) => k.nom === 'Faux Claude'));
    await js("document.querySelector('[data-cl=\"mode-classique\"]')?.click()");

    titre('Créer la vidéo, demandé par une IA');
    const cv = await ia.outil('creer_video', {attendre: true});
    const cvd = JSON.parse(cv.content[0].text.split('\n').slice(1).join('\n'));
    const rendus = fs.existsSync(RENDUS) ? fs.readFileSync(RENDUS, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
    essai('creer_video (attendre) : la vidéo du montage tel qu’il est dans la page, rangée dans « vidéos »',
      !cv.isError && cvd.finies?.length === 1 && fs.existsSync(cvd.finies[0].fichier) && rendus.length === 1 && json(rendus[0].plans) === json((await page()).montage.map((x) => x.id)), {cv: cv.content[0].text.slice(0, 300), rendus});
    const vu = await jusqua('window.derush.ui().renduTache === null || document.querySelector(".feuille video")', 8000);
    essai('la fenêtre suit la vidéo lancée par l’IA, et la montre quand elle est prête', vu);
    await capture('02-video-de-l-ia');
    const nRendus = fs.readFileSync(RENDUS, 'utf8').trim().split('\n').length;
    const ex = await ia.outil('exporter', {formats: ['carre'], son: 'podcast', de: 1, a: 3, wav: true, attendre: true});
    const exd = ex.isError ? null : donneesDe(ex);
    const nouveaux = fs.readFileSync(RENDUS, 'utf8').trim().split('\n').slice(nRendus).map((l) => JSON.parse(l));
    const lufsEx = (() => { const r = spawnSync(FF, ['-hide_banner', '-nostats', '-i', exd?.video ?? '', '-af', 'ebur128', '-f', 'null', '-'], {encoding: 'utf8'}); return Number([...String(r.stderr).matchAll(/I:\s*(-?[0-9.]+) LUFS/g)].pop()?.[1]); })();
    essai('exporter : la timeline et sa copie carrée (le cadrage suit le sujet), un passage seulement (images 30 à 89), le son à −16 LUFS (podcast), et le WAV',
      !ex.isError && nouveaux.length === 2 && nouveaux.map((x) => `${x.largeur}x${x.hauteur}`).join() === '1080x1920,1080x1080' && nouveaux.every((x) => x.images === '--frames=30-89')
      && exd.formes?.[0]?.forme === 'carre' && fs.existsSync(exd.formes[0].video) && exd.wav && fs.existsSync(exd.wav) && Math.abs(lufsEx + 16) < 1, {ex: ex.content.at(-1).text, nouveaux, lufsEx});
    const ev = await ia.outil('etat_video');
    essai('etat_video : la dernière vidéo, sa durée, son niveau sonore', !ev.isError && /Dernière vidéo/.test(ev.content[0].text));
    await ia.fermer();

    titre('La page et le serveur');
    essai('aucune erreur dans la page', erreursPage.length === 0, erreursPage.slice(0, 5));
    essai('aucune erreur inattendue dans le serveur', tombes.length === 0 && !journalServeur.some((l) => /porte|mcp/i.test(l)), [...tombes.map((e) => e.message), ...journalServeur].slice(0, 5));
  } catch (e) {
    essai(`l’essai pour de vrai s’est déroulé jusqu’au bout`, false, e.stack ?? e.message);
  } finally {
    try { chrome?.kill('SIGKILL'); } catch { /* déjà arrêté */ }
    try { serveur?.closeAllConnections?.(); serveur?.close(); } catch { /* déjà fermé */ }
  }
}

console.log(`\n${bons}/${total} essais réussis.`);
if (bons === total) { try { fs.rmSync(T, {recursive: true, force: true, maxRetries: 5, retryDelay: 200}); } catch { /* pas grave */ } } else console.log(`Le dossier d’essai est gardé : ${T}`);
process.exit(bons === total ? 0 : 1);
