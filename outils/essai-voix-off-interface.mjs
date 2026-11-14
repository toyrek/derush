// Dérush — les essais de l'interface de la voix off proposée (creerVoixOff et l'enregistreur de public/enregistrer.js,
// leur branchement dans public/app.js), pour qui modifie Dérush :
//   node outils/essai-voix-off-interface.mjs [dossier où créer le dossier d'essai]
// 1. Les petites aides de public/enregistrer.js, sans page : les questions numérotées à la fin d'une réponse de l'IA,
//    la réponse préparée par « Répondre », le moment du texte à lire, l'étape de la carte, les demandes toutes faites
//    (qui ne doivent jamais passer pour une recherche dans le Drive).
// 2. L'interface pour de vrai, dans Chrome sans fenêtre, avec un faux micro (sautée si Chrome ou FFmpeg manque ;
//    DERUSH_CHROME=<programme> pour en donner un) : le vrai serveur de Dérush, dans ce processus, sur un dossier de
//    Dérush, une bibliothèque, un dossier personnel et un faux Google Drive jetables (DERUSH_SUPPORT,
//    DERUSH_BIBLIOTHEQUE, HOME, DERUSH_DRIVE), un projet « Vlog Japon » de trois vraies petites vidéos faites par FFmpeg
//    (leur texte Whisper est écrit à la main : elles parlent très peu). L'IA légère des questions est un faux Claude
//    (lib/ia.mjs remplacé par un crochet de chargement, comme dans essai-voix-off) : aucune vraie IA n'est lancée. Dans
//    la page, la fenêtre « Ouvrir » de l'ordinateur, les liens et l'envoi à l'IA de montage sont coupés et notés : rien
//    ne s'ouvre, rien ne part. Ce qui est vérifié : le micro qui s'allume et sa bulle, la carte, ce que l'IA lira avant
//    le clic, les questions, une réponse écrite, une réponse dite au micro (jamais posée dans le montage), le choix,
//    le texte écrit par l'IA de montage qui défile pendant l'enregistrement et se retouche, « Répondre » sous les
//    questions de l'IA, « Pas de voix off », « Tout oublier ».
//    DERUSH_ESSAI_CAPTURES=<dossier> y garde une capture de chaque écran.
// Le dossier d'essai est effacé à la fin, sauf en cas d'échec.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {register} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Chrome garde le vrai dossier personnel (sur Mac, sans lui il ne charge aucune page) ; son profil, lui, est à part
const MAISON_REELLE = os.homedir();
if (/^-/.test(process.argv[2] ?? '')) { console.log(`Usage : node ${path.relative(process.cwd(), process.argv[1])} [dossier temporaire]`); process.exit(0); }
const parent = path.resolve(process.argv[2] ?? os.tmpdir());
fs.mkdirSync(parent, {recursive: true});
const T = fs.mkdtempSync(path.join(fs.realpathSync(parent), 'derush-essai-voix-off-interface-'));
// AVANT tout import de lib/ : ces dossiers sont lus une seule fois, au chargement
const SUPPORT = path.join(T, 'support');
const BIBLIO = path.join(T, 'bibliotheque');
const MAISON = path.join(T, 'maison');
const TMP = path.join(T, 'tmp');
const DRIVE = path.join(T, 'compte', 'Mon Drive'); // un faux Drive, vide : jamais celui de l'ordinateur
for (const d of [SUPPORT, BIBLIO, MAISON, TMP, DRIVE, path.join(T, 'sons')]) fs.mkdirSync(d, {recursive: true});
process.env.DERUSH_SUPPORT = SUPPORT; // « = », jamais « ??= »
process.env.DERUSH_BIBLIOTHEQUE = BIBLIO;
process.env.DERUSH_DRIVE = DRIVE;
process.env.DERUSH_SONS = path.join(T, 'sons');
process.env.DERUSH_SANS_MAJ = '1';
process.env.DERUSH_SANS_NAVIGATEUR = '1';
process.env.DERUSH_TREG_BASE = 'http://127.0.0.1:9';
process.env.HOME = MAISON;
process.env.USERPROFILE = MAISON;
process.env.TMPDIR = TMP;
process.env.TEMP = TMP;
process.env.TMP = TMP;
for (const k of ['TREG_TOKEN', 'ELEVENLABS_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY']) delete process.env[k];

let bons = 0;
let total = 0;
function essai(quoi, vrai, detail = '') {
  total++;
  if (vrai) bons++;
  console.log(`${vrai ? '  ✓' : '  ✗'} ${quoi}${vrai || detail === '' ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)?.slice(0, 700)}`}`);
}
const titre = (t) => console.log(`\n${t}`);
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

// ——— 1. les petites aides, sans page ———
const ENR = await import(pathToFileURL(path.join(D, 'public', 'enregistrer.js')).href);
const C = await import(pathToFileURL(path.join(D, 'lib', 'commun.mjs')).href);
titre('Les petites aides de public/enregistrer.js');
essai('les temps : « 0:06 », « 1:12 » ; les durées à lire : « 45 s », « 1 min 12 », « 2 min »',
  ENR.minSec(6) === '0:06' && ENR.minSec(72.4) === '1:12' && ENR.minSec(-3) === '0:00' && ENR.dureeParlee(45) === '45 s' && ENR.dureeParlee(72) === '1 min 12' && ENR.dureeParlee(120) === '2 min');
const reponseIA = 'Voilà ton vlog du vendredi (42 s).\n\nPour la voix off, quelques questions :\n\n1. Où étais-tu au lever du jour ?\n2. **Le marché** : qu’as-tu goûté ?\n3. Avec qui as-tu dîné ce soir-là ?\n\nRéponds-moi et j’écris le texte.';
essai('les questions numérotées à la fin d’une réponse (suivies d’une phrase), le gras retiré',
  JSON.stringify(ENR.questionsALaFin(reponseIA)) === JSON.stringify(['Où étais-tu au lever du jour ?', 'Le marché : qu’as-tu goûté ?', 'Avec qui as-tu dîné ce soir-là ?']), ENR.questionsALaFin(reponseIA));
essai('« 1) … », des lignes vides et une ligne en retrait entre les questions : lues aussi',
  ENR.questionsALaFin('Dis-moi :\n1) Où ?\n\n2) Quand ?\n   (pour le plan du temple)\n3) Avec qui ?').length === 3);
essai('rien pour une liste de ce que l’IA a fait, une seule question, une numérotation qui saute, ou une liste suivie d’un long texte',
  !ENR.questionsALaFin('J’ai fait :\n1. Coupé les silences.\n2. Ajouté des sous-titres.').length && !ENR.questionsALaFin('Une question :\n1. Où étais-tu ?').length
  && !ENR.questionsALaFin('1. Où ?\n3. Quand ?').length && !ENR.questionsALaFin('1. Où ?\n2. Quand ?\nUn.\nDeux.\nTrois.').length && !ENR.questionsALaFin('').length);
const prep = ENR.reponsePreparee(3);
const prep2 = ENR.reponsePreparee(2, 'Merci !');
essai('« Répondre » prépare une ligne par question, le curseur après « 1. » ; ce qui était écrit reste devant',
  prep.texte === '1. \n2. \n3. ' && prep.curseur === 3 && prep2.texte === 'Merci !\n\n1. \n2. ' && prep2.curseur === 'Merci !\n\n1. '.length, [prep, prep2]);
const moments = [{debut: 0, fin: 3}, {debut: 3, fin: 6}, {debut: 6, fin: 12}];
essai('le moment du texte à lire : celui qui a commencé, aucun avant le premier',
  ENR.momentCourant(moments, 0) === 0 && ENR.momentCourant(moments, 3.5) === 1 && ENR.momentCourant(moments, 99) === 2 && ENR.momentCourant([{debut: 2, fin: 4}], 1) === -1 && ENR.momentCourant([], 3) === -1);
const etat = (x) => ({questions: [], micro: {allume: false}, avis: {}, ...x});
essai('l’étape de la carte : cachée, à proposer, en préparation, des questions, choisie, posée ; jamais avec « Pas de voix off »',
  ENR.etapeCarte(null) === 'cachee' && ENR.etapeCarte(etat({})) === 'cachee' && ENR.etapeCarte(etat({micro: {allume: true}})) === 'proposer'
  && ENR.etapeCarte(etat({suivi: {etat: 'en_cours'}})) === 'preparation' && ENR.etapeCarte(etat({questions: [{id: 'Q1'}]})) === 'questions'
  && ENR.etapeCarte(etat({questions: [{id: 'Q1'}], choix: 'reponses'})) === 'choisi' && ENR.etapeCarte(etat({choix: 'moi', avis: {deja: true}})) === 'posee'
  && ENR.etapeCarte(etat({avis: {deja: true}})) === 'cachee' && ENR.etapeCarte(etat({choix: 'aucune', micro: {allume: true}, questions: [{id: 'Q1'}]})) === 'cachee');
essai('la carte repliée le dit en un mot : « 2/5 réponses », « ton texte est prêt »',
  ENR.resumeCarte(etat({questions: [1, 2, 3, 4, 5].map((n) => ({id: `Q${n}`})), repondues: 2})) === '2/5 réponses' && ENR.resumeCarte(etat({choix: 'moi', texte: {moments: 3}})) === 'ton texte est prêt');
essai('les demandes que la carte prépare ne passent jamais pour une recherche dans le Drive (parleDuDrive)',
  Object.values(ENR.DEMANDES_VOIX_OFF).every((t) => !C.parleDuDrive(t)) && Object.keys(ENR.DEMANDES_VOIX_OFF).join() === 'texte,reponses,ia,posee');

// ——— 2. l'interface pour de vrai ———
const CHROME = process.env.DERUSH_CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((c) => fs.existsSync(c));
const CAPTURES = process.env.DERUSH_ESSAI_CAPTURES ? path.resolve(process.env.DERUSH_ESSAI_CAPTURES) : null;
const FFMPEG = process.env.DERUSH_FFMPEG || 'ffmpeg';
const ffOk = spawnSync(FFMPEG, ['-version']).status === 0;
let serveur = null;
let chrome = null;
const tombes = [];
if (!CHROME || !ffOk) {
  titre(`L’interface dans Chrome : sautée (${!CHROME ? 'Chrome introuvable ; DERUSH_CHROME=<programme> pour en donner un' : 'FFmpeg introuvable'})`);
} else {
  process.on('unhandledRejection', (e) => tombes.push(e));
  process.on('uncaughtException', (e) => tombes.push(e));
  const journalServeur = [];
  console.error = (...a) => { journalServeur.push(a.map((x) => String(x?.message ?? x)).join(' ')); };
  try {
    // — le faux Claude des questions, et lib/ia.mjs remplacé (jamais un autre programme) —
    const B = path.join(T, 'bouchons');
    fs.mkdirSync(B, {recursive: true});
    const FAUX = path.join(B, 'faux-claude.mjs');
    const JOURNAL = path.join(T, 'journal-ia.jsonl');
    process.env.FAUX_JOURNAL = JOURNAL;
    fs.writeFileSync(FAUX, `import fs from 'node:fs';
const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
let consigne = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { consigne += d; });
process.stdin.on('end', () => {
  const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
  fs.appendFileSync(process.env.FAUX_JOURNAL, JSON.stringify({cwd: process.cwd(), consigne, rushes: lire('rushes.md'), planches: fs.existsSync('planches') ? fs.readdirSync('planches') : []}) + '\\n');
  out({type: 'system', subtype: 'init', session_id: 'faux', mcp_servers: []});
  out({type: 'assistant', message: {content: [{type: 'tool_use', name: 'Read', input: {file_path: 'rushes.md'}}]}});
  setTimeout(() => {
    fs.writeFileSync('reponse.json', process.env.FAUX_REPONSE ?? '{}');
    out({type: 'assistant', message: {content: [{type: 'tool_use', name: 'Write', input: {file_path: 'reponse.json'}}]}});
    out({type: 'result', result: 'Questions prêtes.', is_error: false});
    setTimeout(() => process.exit(0), 20);
  }, 1200);
});
`);
    const vrai = (f) => `${pathToFileURL(path.join(D, 'lib', f)).href}?vrai`;
    fs.writeFileSync(path.join(B, 'faux-ia.mjs'), `export * from '${vrai('ia.mjs')}';
export async function etatIA() {
  return {claude: {ok: true, chemin: ${JSON.stringify(FAUX)}, version: '0.0.0', modeles: []}, codex: {ok: false, pourquoi: 'absent (essai)'}, gemini: {ok: false, pourquoi: 'absent (essai)'}, choisi: 'claude'};
}
export function commandeLancement(chemin) {
  if (chemin !== ${JSON.stringify(FAUX)}) throw new Error('essai : programme inattendu ' + chemin);
  return {cmd: process.execPath, prefixe: [chemin]};
}
`);
    const remplaces = {[pathToFileURL(path.join(D, 'lib', 'ia.mjs')).href]: pathToFileURL(path.join(B, 'faux-ia.mjs')).href};
    fs.writeFileSync(path.join(B, 'crochets.mjs'), `const R = ${JSON.stringify(remplaces)};
export async function resolve(specifier, context, next) {
  const r = await next(specifier, context);
  return R[r.url] ? {...r, url: R[r.url], shortCircuit: true} : r;
}
`);
    register(pathToFileURL(path.join(B, 'crochets.mjs')).href);

    // — le projet : trois vraies petites vidéos du vendredi au Japon, qui parlent très peu —
    const lib = (m) => import(pathToFileURL(path.join(D, 'lib', m)).href);
    const {Projet} = await lib('projet.mjs');
    const {FileDAttente} = await lib('outils.mjs');
    const {demarrerServeur} = await lib('serveur.mjs');
    const {changerReglages} = await lib('reglages.mjs');
    const {ajouterMedias} = await lib('medias.mjs');
    const {planche} = await lib('analyse.mjs');
    const V = await lib('voix-off.mjs');
    const Bi = await lib('bibliotheque.mjs');
    changerReglages({tuto_vu: true, accueil_vu: true}); // ni tutoriel ni accueil par-dessus l'éditeur
    const RUSHES = path.join(T, 'rushes');
    fs.mkdirSync(RUSHES, {recursive: true});
    const ff = (args) => { const r = spawnSync(FFMPEG, ['-v', 'error', '-y', ...args]); if (r.status !== 0) throw new Error(`FFmpeg : ${r.stderr?.toString().slice(-300)}`); };
    const video = (nom, quand, d, son = true) => {
      const f = path.join(RUSHES, nom);
      ff(['-f', 'lavfi', '-i', `testsrc=d=${d}:s=320x180:r=15`, ...(son ? ['-f', 'lavfi', '-i', `sine=f=330:d=${d}`] : []), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...(son ? ['-c:a', 'aac', '-shortest'] : ['-an']),
        '-movflags', 'use_metadata_tags', '-metadata', `com.apple.quicktime.creationdate=${quand}`, '-f', 'mov', f]);
      return f;
    };
    const chemins = [
      video('IMG_0101.MOV', '2024-11-08T06:12:00+0900', 8), // le temple au lever du jour : de l'ambiance
      video('IMG_0102.MOV', '2024-11-08T12:40:00+0900', 6, false), // le marché : muet
      video('IMG_0103.MOV', '2024-11-08T19:05:00+0900', 8), // le dîner : quelques mots
    ];
    const ctx = {P: null, file: new FileDAttente(), app: false, natif: false,
      ouvrir(d, t) { const P = new Projet(d); if (t && !fs.existsSync(path.join(P.racine, '.derush'))) { P.d.titre = t; P.sauver(); } ctx.P = P; Bi.noterRecent(P.racine); return P; },
      projetVivant(d) { return ctx.P?.racine === path.resolve(d) ? ctx.P : null; },
      fermer() { ctx.P = null; }};
    const P = ctx.ouvrir(path.join(BIBLIO, 'Vlog Japon'), 'Vlog Japon');
    P.d.brief = {...(P.d.brief ?? {}), type: 'trend', objectif: 'Un vlog de ma journée du vendredi à Kyoto'};
    P.sauver();
    await ajouterMedias(P, chemins, ctx.file);
    await Promise.race([ctx.file.vide(), dormir(90000)]);
    // ce que Whisper aurait écrit : presque rien (le temple : un mot ; le dîner : quelques mots)
    const ecrireMots = (m, mots) => {
      fs.writeFileSync(path.join(P.dossierMedia(m.id), 'mots.json'), JSON.stringify({moteur: 'essai', mots}));
      m.transcription = {moteur: 'essai', mots: mots.length, cree_le: new Date().toISOString()};
      m.etapes = {...(m.etapes ?? {}), texte: true};
    };
    const [M1, M2, M3] = P.d.medias;
    ecrireMots(M1, [{t: 'Wow.', d: 2.1, f: 2.6}]);
    ecrireMots(M3, [{t: 'Kanpai', d: 1.0, f: 1.5}, {t: 'tout', d: 1.6, f: 1.8}, {t: 'le', d: 1.85, f: 1.95}, {t: 'monde !', d: 2.0, f: 2.6}]);
    P.sauver();
    // les planches d'images (d'ordinaire faites par l'analyse) : l'IA des questions les regardera
    for (const m of [M1, M3]) await planche(P, m);
    const avis0 = V.avisVoixOff(P);
    essai('le projet d’essai : trois rushes du vendredi, datés, qui parlent très peu (l’avis conseille une voix off)',
      P.d.medias.length === 3 && avis0.conseillee && avis0.muets === 1 && !!M1.tournage?.date, {avis: avis0, date: M1.tournage});

    ({serveur} = await demarrerServeur(ctx, {port: 0}));
    const base = `http://127.0.0.1:${serveur.address().port}`;

    // — Chrome sans fenêtre, avec un faux micro, piloté par son protocole —
    const portLibre = () => new Promise((ok, ko) => { const s = net.createServer(); s.on('error', ko); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
    const PORT_CDP = await portLibre();
    chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${path.join(T, 'chrome')}`, '--window-size=1480,1063',
      '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required',
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
    /** Un vrai clic de souris au milieu de l'élément (amené à l'écran). */
    const clic = async (sel) => {
      await js("document.querySelectorAll('#notes .note').forEach((n) => n.remove()); true");
      const p = await js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({block: 'center'}); const b = e.getBoundingClientRect(); return {x: b.left + b.width / 2, y: b.top + b.height / 2}; })()`);
      if (!p) return false;
      for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', {type, x: p.x, y: p.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1});
      await dormir(100);
      return true;
    };
    const taper = async (sel, texte) => {
      await js(`(() => { const z = document.querySelector(${JSON.stringify(sel)}); if (z) z.value = ''; return true; })()`);
      await clic(sel);
      await cdp('Input.insertText', {text: texte});
      await dormir(80);
    };
    const touche = async (key, code = key, vk = 0, mod = 0) => { for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', {type, key, code, windowsVirtualKeyCode: vk, modifiers: mod}); await dormir(100); };
    const capture = async (nom) => { if (!CAPTURES) return; await dormir(450); fs.mkdirSync(CAPTURES, {recursive: true}); const {data} = await cdp('Page.captureScreenshot', {format: 'png'}); fs.writeFileSync(path.join(CAPTURES, `${nom}.png`), Buffer.from(data, 'base64')); };
    const appels = (re) => js(`window.__appels.filter((a) => ${re}.test(a.m + ' ' + a.u)).map((a) => a.corps)`);
    const texteDe = (sel) => js(`(document.querySelector(${JSON.stringify(sel)})?.textContent ?? '').replace(/\\s+/g, ' ').trim()`);
    const lancements = () => { try { return fs.readFileSync(JOURNAL, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
    const etatServeur = () => V.lireVoixOff(ctx.P);

    titre('Le micro qui s’allume, sa bulle, la carte');
    const ouvert = await jusqua("window.derush && window.derush.projet() && document.querySelector('#p-medias .enregistrer-grand')", 30000);
    essai('l’éditeur s’ouvre sur le projet', ouvert, ouvert ? '' : {page: await js("location.href + ' | ' + document.body.innerText.slice(0, 300)").catch((e) => e.message), erreurs: erreursPage.slice(0, 5)});
    if (!ouvert) throw new Error('l’éditeur ne s’est pas ouvert');
    // la garde : la fenêtre « Ouvrir » de l'ordinateur, les liens et l'envoi à l'IA de montage sont coupés et notés
    await js(`(() => {
      window.__appels = [];
      const vrai = window.fetch.bind(window);
      const json = (j, code = 200) => new Response(JSON.stringify(j), {status: code, headers: {'content-type': 'application/json'}});
      window.fetch = async (url, opts = {}) => {
        const u = String(url);
        const m = (opts.method || 'GET').toUpperCase();
        let corps = null;
        try { corps = typeof opts.body === 'string' ? JSON.parse(opts.body) : null; } catch { corps = null; }
        window.__appels.push({m, u, corps});
        if (u.startsWith('/api/choisir')) return json({erreur: 'coupé pendant l’essai'}, 400);
        if (u.startsWith('/api/lien')) return json({ok: true});
        if (m === 'POST' && /^\\/api\\/claude\\/(demander|ajouter)/.test(u)) return json({ok: true});
        return vrai(url, opts);
      };
      window.confirm = () => true;
      return true;
    })()`);
    const allume = await jusqua("window.derush.voixOff.etat()?.micro?.allume && document.querySelector('#p-medias .enregistrer-grand.vo-allume')", 20000);
    essai('le bouton du micro s’allume (halo), et dit pourquoi dans sa bulle (le texte du serveur)', allume
      && (await texteDe('#p-medias .vo-bulle .vo-bulle-txt')) === (await js('window.derush.voixOff.etat().micro.pourquoi')) && /parlent très peu/.test(await texteDe('#p-medias .vo-bulle')),
    await texteDe('#p-medias .vo-bulle'));
    essai('… le bouton le dit aussi en petit, et l’onglet « Médias » n’a pas de point (on est dessus)',
      (await texteDe('#p-medias .enregistrer-grand small')) === 'une voix off est conseillée' && !(await js("getComputedStyle(document.querySelector('[data-panneau=medias]'), '::after').content.includes('\"')")));
    essai('la carte « Une voix off ? » est dans la colonne de l’IA : la raison, « Pose-moi des questions », les choix possibles seulement',
      await jusqua("document.querySelector('#claude .vo-carte[data-etape=proposer] [data-cl=vo-ouvrir]')")
      && JSON.stringify(await js("[...document.querySelectorAll('#claude .vo-carte .vo-puce')].map((b) => b.dataset.choix)")) === '["moi","aucune"]',
    await js("document.querySelector('#claude .vo-carte')?.outerHTML.slice(0, 600)"));
    essai('rien n’est parti chez une IA : l’avis se calcule sur l’ordinateur', lancements().length === 0);
    await dormir(1200); // l'éditeur finit d'arriver
    await capture('01-micro-allume');
    await clic('#claude .vo-carte [data-cl="vo-replier"]');
    essai('la carte se replie en une ligne qui dit l’essentiel (« conseillée »), et se rouvre',
      await jusqua("document.querySelector('#claude .vo-carte.replie')") && /conseillée/.test(await texteDe('#claude .vo-carte.replie .vo-carte-tete small'))
      && !(await js("document.querySelector('#claude .vo-carte.replie [data-cl=vo-ouvrir]')")));
    await capture('01b-carte-repliee');
    await clic('#claude .vo-carte [data-cl="vo-replier"]');
    await jusqua("document.querySelector('#claude .vo-carte:not(.replie) [data-cl=vo-ouvrir]')");
    await js("document.querySelector('[data-panneau=texte]').click(); true");
    await dormir(300);
    essai('sur un autre panneau, l’onglet « Médias » porte un point rouge', await js("getComputedStyle(document.querySelector('[data-panneau=medias]'), '::after').content !== 'none'"));
    await js("document.querySelector('[data-panneau=medias]').click(); true");
    await clic('#p-medias .vo-bulle [data-vo-bulle="masquer"]');
    essai('la bulle se ferme d’un clic ; le micro, lui, reste allumé', await jusqua("!document.querySelector('#p-medias .vo-bulle') && document.querySelector('#p-medias .enregistrer-grand.vo-allume')"));

    titre('« Ma voix » dans le choix d’enregistrement');
    await clic('#p-medias .enregistrer-grand');
    await jusqua("document.querySelector('.feuille .enr-carte.conseille[data-enr=voix]')");
    essai('« Ma voix » s’allume, et la raison est dite sous les deux cartes, avec « Pose-moi des questions »',
      !!(await js("document.querySelector('.feuille .enr-carte.conseille[data-enr=voix]')")) && /parlent très peu/.test(await texteDe('.feuille .enr-conseil')) && !!(await js("document.querySelector('.feuille .enr-conseil [data-enr=questions]')")));
    await capture('02-ma-voix-conseillee');
    await touche('Escape', 'Escape', 27);

    titre('Ce que l’IA lira, avant tout clic');
    await clic('#claude .vo-carte [data-cl="vo-ouvrir"]');
    await jusqua("document.querySelector('.vo-feuille .vo-lira')");
    const lira = await texteDe('.vo-feuille .vo-lira');
    essai('la feuille dit ce que l’IA lira : 3 rushes, 2 planches d’images, 2 textes ; et rien d’autre',
      /3 rushes/.test(lira) && /2 planches d’images/.test(lira) && /2 textes/.test(lira) && /Ni tes vidéos, ni internet/.test(lira), lira);
    essai('… avec la raison de Dérush, un champ pour ce qu’on veut faire, « Préparer mes questions » ; toujours aucune IA lancée',
      !!(await js("document.querySelector('.vo-feuille .vo-avis') && document.querySelector('.vo-feuille [data-vo-demande]') && document.querySelector('.vo-feuille [data-vo=preparer]:not([disabled])')")) && lancements().length === 0);
    await taper('.vo-feuille [data-vo-demande]', 'un vlog de ma journée du vendredi');
    await capture('03-ce-que-l-ia-lira');
    process.env.FAUX_REPONSE = JSON.stringify({fil: 'Le jour se lève sur le temple, puis la foule du marché à midi, et la soirée finit au dîner avec les amis.',
      questions: [
        {texte: 'Où étais-tu au lever du jour, devant ce temple ?', medias: [M1.id], debut: 1, fin: 4, pourquoi: 'Pour ouvrir le film sur le lieu.'},
        {texte: 'Qu’as-tu goûté au marché à midi ?', medias: [M2.id], debut: 0.5, fin: 3, pourquoi: 'Le marché est muet : ta voix le racontera.'},
        {texte: 'Qui était avec toi au dîner ?', medias: [M3.id], debut: 0, fin: 3, pourquoi: 'Pour finir sur les gens.'},
      ]});
    await clic('.vo-feuille [data-vo="preparer"]');
    const demandes = await appels('/POST \\/api\\/voix-off\\/questions$/');
    essai('« Préparer mes questions » : un seul envoi, avec ce qu’on veut faire et l’IA choisie',
      demandes.length === 1 && demandes[0].demande === 'un vlog de ma journée du vendredi' && demandes[0].moteur === 'claude', demandes);
    essai('… la feuille suit le travail de l’IA, étape par étape', await jusqua("document.querySelector('.vo-feuille .vo-etapes li')", 8000));
    await capture('04-preparation');
    const prets = await jusqua("document.querySelectorAll('.vo-feuille .vo-q').length === 3", 30000);
    essai('les questions arrivent dans la feuille, avec le fil proposé', prets && /Le jour se lève sur le temple/.test(await texteDe('.vo-feuille .vo-fil')));
    const lance = lancements();
    essai('le faux Claude a été lancé une fois, dans le dossier à part du projet (jamais le dossier de montage), avec les planches',
      lance.length === 1 && lance[0].cwd === path.join(P.racine, '.derush', 'voix-off', 'ia') && lance[0].planches.length === 2 && /vendredi/.test(lance[0].consigne), lance.map((x) => ({cwd: x.cwd, planches: x.planches})));
    const moment = await js("(() => { const q = document.querySelector('.vo-feuille .vo-q'); return {quand: q.querySelector('.vo-moment-txt b')?.textContent, vig: !!q.querySelector('.vo-vig > i[style*=vignettes]'), petit: q.querySelector('.vo-moment-txt small')?.textContent}; })()");
    essai('chaque question montre son moment : le jour et l’heure de prise, une vignette du rush à cet instant, le nom et les temps',
      /vendredi 8 novembre 2024 à 06 h 12/.test(moment.quand ?? '') && moment.vig && /IMG_0101\.MOV · 0:01 – 0:04/.test(moment.petit ?? ''), moment);
    await capture('05-questions');
    await clic('.vo-feuille [data-q="Q1"] .vo-vig');
    essai('un clic sur la vignette rejoue le moment dans la feuille, à partir de son début (1 s)',
      await jusqua("(() => { const v = document.querySelector('.vo-feuille [data-q=Q1] video.vo-apercu'); return v && v.readyState >= 1 && v.currentTime >= 0.9; })()", 10000),
      await js("(() => { const v = document.querySelector('.vo-feuille video.vo-apercu'); return v ? {t: v.currentTime, r: v.readyState, e: v.error?.message} : null; })()"));

    titre('Une réponse écrite');
    const ECRIT = 'On est partis à 6 h pour le temple Kiyomizu, il n’y avait personne.';
    await taper('.vo-feuille [data-vo-texte="Q1"]', ECRIT);
    const ecrite = await (async () => { const t0 = Date.now(); while (Date.now() - t0 < 6000) { if (etatServeur().reponses.Q1?.texte === ECRIT) return true; await dormir(150); } return false; })();
    essai('elle part toute seule chez Dérush un instant après la frappe', ecrite, etatServeur().reponses);
    essai('… sans que la feuille se redessine sous les doigts (le champ garde la main), et la question est marquée répondue',
      (await js("document.activeElement?.dataset?.voTexte")) === 'Q1' && (await js("document.querySelector('[data-q=Q1]').classList.contains('repondue')")) && (await texteDe('[data-vo-compte]')) === '1/3');

    titre('Une réponse dite au micro');
    await clic('.vo-feuille [data-q="Q2"] [data-vo="micro"]');
    const enPrise = await jusqua("document.querySelector('[data-q=Q2] .vo-prise [data-vo=stop]')", 10000);
    essai('« Répondre au micro » : le micro s’ouvre dans la question, avec le temps et le niveau ; les autres micros attendent',
      enPrise && (await js("window.derush.enregistre()")) && (await js("[...document.querySelectorAll('.vo-feuille [data-vo=micro]')].every((b) => b.disabled)")));
    await dormir(2600);
    await capture('06-reponse-au-micro');
    await touche('Escape', 'Escape', 27);
    essai('… Échap ne ferme pas la feuille pendant la prise (rien ne se perd)', !!(await js("document.querySelector('.vo-feuille [data-q=Q2] .vo-prise')")));
    const avantMedias = ctx.P.d.medias.length;
    await clic('.vo-feuille [data-q="Q2"] [data-vo="stop"]');
    const rangee = await jusqua("document.querySelector('[data-q=Q2] .vo-ecoute')", 30000);
    const r2 = etatServeur().reponses.Q2;
    const m4 = ctx.P.d.medias.find((m) => m.id === r2?.media);
    essai('la prise devient un média du projet (« voix-off-… »), rattaché à la question', rangee && ctx.P.d.medias.length === avantMedias + 1 && !!m4 && /^voix-off-/.test(m4.nom ?? '') && m4.type === 'audio', {r2, nom: m4?.nom});
    essai('… et rien n’est posé dans le montage : aucune voix off par-dessus, ni côté serveur ni dans la page',
      !(ctx.P.d.superpositions ?? []).length && (await js('window.derush.projet().superpositions.length')) === 0 && !(await js('window.derush.enregistre()')));
    essai('… l’avis ne la compte pas comme un rush (toujours 3)', V.avisVoixOff(ctx.P).rushes === 3);
    // Whisper (simulé) écrit ce qui a été dit ; l'interface le relit
    ecrireMots(m4, [{t: 'Des', d: 0.2, f: 0.4}, {t: 'takoyakis', d: 0.45, f: 1.0}, {t: 'brûlants.', d: 1.05, f: 1.5}]);
    ctx.P.sauver();
    await js('window.derush.voixOff.charger()');
    essai('ce qu’il a dit s’affiche sous la question, avec « Écouter »', await jusqua("/takoyakis/.test(document.querySelector('[data-q=Q2] .vo-transcrit')?.textContent)", 8000)
      && /Écouter · 0:0\d/.test(await texteDe('[data-q=Q2] [data-vo=ecouter]')));
    await capture('07-reponse-dite');
    await clic('.vo-feuille [data-q="Q2"] [data-vo="ecouter"]');
    essai('« Écouter » lit la réponse dite (le bouton le montre), un second clic l’arrête',
      await jusqua("document.querySelector('[data-q=Q2] [data-vo=ecouter].lit')", 6000)
      && await clic('.vo-feuille [data-q="Q2"] [data-vo="ecouter"]') && await jusqua("!document.querySelector('[data-q=Q2] [data-vo=ecouter].lit')", 4000));

    titre('Le choix');
    const choix = await js("[...document.querySelectorAll('.vo-feuille .vo-choix')].map((b) => [b.dataset.choix, b.disabled])");
    essai('la feuille propose : moi, mes réponses (possible maintenant), pas de voix off ; pas ElevenLabs (pas branché)',
      JSON.stringify(choix) === '[["moi",false],["reponses",false],["aucune",false]]', choix);
    await clic('.vo-feuille [data-vo="choix"][data-choix="reponses"]');
    essai('« Mes réponses font la voix off » part chez Dérush (que l’IA lira à sa prochaine demande)', await jusqua("document.querySelector('.vo-feuille .vo-choix.actif[data-choix=reponses]')") && etatServeur().choix === 'reponses');
    await capture('08-choix');
    await clic('.vo-feuille [data-fermer]');
    await jusqua("document.querySelector('#claude .vo-carte[data-etape=choisi]')");
    essai('la carte le dit, avec « Demander le montage »', /réponses dites au micro feront la voix off/.test(await texteDe('#claude .vo-carte')) && !!(await js("document.querySelector('#claude .vo-carte [data-quoi=reponses]')")));
    await capture('09-carte-choisi');
    await clic('#claude .vo-carte [data-quoi="reponses"]');
    essai('« Demander le montage » prépare la demande dans la zone d’écriture, sans l’envoyer',
      (await js("document.querySelector('#cl-texte').value")) === ENR.DEMANDES_VOIX_OFF.reponses && (await appels('/claude\\/demander/')).length === 0 && !(await js("!!window.derush.driveCarte()")));
    await js("window.derush.ecrire(''); true");
    await clic('#claude .vo-carte [data-cl="vo-changer"]');
    await jusqua("document.querySelector('#claude .vo-carte .vo-puce[data-choix=moi]')");
    await clic('#claude .vo-carte .vo-puce[data-choix="moi"]');
    essai('« Changer », puis « Je l’enregistre » : le choix suit, la carte propose de demander le texte à l’IA',
      await jusqua("document.querySelector('#claude .vo-carte [data-quoi=texte]')") && etatServeur().choix === 'moi');

    titre('Le texte écrit par l’IA de montage, et ses questions');
    const atelier = path.join(T, 'atelier');
    fs.mkdirSync(path.join(atelier, 'voix-off'), {recursive: true});
    fs.writeFileSync(path.join(atelier, 'voix-off', 'texte.json'), JSON.stringify({titre: 'Vendredi à Kyoto', moments: [
      {debut: 0, fin: 3, plans: 'le temple au lever du jour', texte: 'Vendredi, six heures. Kyoto dort encore.'},
      {debut: 3, fin: 6, plans: 'le marché', texte: 'À midi, le marché de Nishiki déborde : des takoyakis brûlants, des brochettes, des gens partout, et nous qui goûtons absolument tout ce qui passe.'},
      {debut: 6, fin: 12, plans: 'le dîner', texte: 'Et le soir, on trinque avec les amis.'},
    ]}));
    fs.writeFileSync(path.join(atelier, 'voix-off', 'questions.json'), JSON.stringify({fil: 'Du temple au dîner.', questions: [
      {texte: 'Comment s’appelait le restaurant du dîner ?', medias: [M3.id], debut: 0, fin: 4, pourquoi: 'Pour le nommer dans la voix off.'},
      {texte: 'Qu’est-ce qui t’a surpris au temple ?', medias: [M1.id], debut: 2, fin: 6, pourquoi: 'Une anecdote pour l’ouverture.'},
    ]}));
    const recu = V.recueillirVoixOff(atelier, ctx.P, 0);
    essai('Dérush range le texte et les questions de l’IA de montage (comme à la fin de son travail)', recu.texte === true && recu.questions === 2, recu);
    await js("document.querySelectorAll('#notes .note').forEach((n) => n.remove()); true");
    await js('window.derush.voixOff.charger()');
    const pret = await jusqua("document.querySelector('#claude .vo-carte [data-cl=vo-enregistrer]') && /texte est prêt/.test(document.querySelector('#p-medias .vo-bulle')?.textContent)", 10000);
    essai('la carte : « Ton texte est prêt », « Enregistrer en le lisant » ; la bulle du micro aussi', pret, await texteDe('#claude .vo-carte'));
    essai('… et une seule note le dit : le texte écrit, les questions de l’IA, le micro allumé',
      /a écrit le texte de ta voix off et te pose 2 questions/.test(await texteDe('#notes')) && (await js("document.querySelectorAll('#notes .note').length")) === 1, await texteDe('#notes'));
    essai('la bulle du micro revient : la raison a changé depuis qu’elle a été fermée', /texte est prêt/.test(await texteDe('#p-medias .vo-bulle')));
    await capture('10-texte-pret');

    titre('Le texte à lire pendant l’enregistrement');
    await clic('#claude .vo-carte [data-cl="vo-enregistrer"]');
    const panneau = await jusqua("document.querySelector('#enr.avec-texte .enr-moment')", 10000);
    essai('le panneau de la voix off montre le texte, moment par moment, le premier éclairé',
      panneau && (await js("document.querySelectorAll('#enr .enr-moment').length")) === 3 && (await js("document.querySelector('#enr .enr-moment.ici')?.dataset.k")) === '0' && /Vendredi à Kyoto/.test(await texteDe('#enr .enr-texte-tete')));
    essai('… un moment trop long pour ses images est signalé', /Un peu long/.test(await texteDe('#enr .enr-moment[data-k="1"] .enr-long')) && /1 moment un peu long/.test(await texteDe('#enr .enr-texte-tete')));
    await capture('11-texte-a-lire');
    await clic('#enr [data-enr="retoucher"]');
    await jusqua("document.querySelector('#enr [data-texte-k=\"1\"]')");
    essai('« Retoucher » : chaque moment devient un champ, et l’enregistrement attend', !!(await js("document.querySelector('#enr [data-enr=go]').disabled")));
    await js(`(() => { const t = document.querySelector('#enr [data-texte-k="1"]'); t.value = 'À midi, le marché de Nishiki.'; t.dispatchEvent(new Event('input', {bubbles: true})); return true; })()`);
    await clic('#enr [data-enr="texte-garder"]');
    essai('« Garder » : le texte retouché est rangé (l’IA lira cette version), et il n’est plus trop long',
      await jusqua("!document.querySelector('#enr [data-texte-k]') && !document.querySelector('#enr .enr-long')", 8000) && V.texteALire(ctx.P)?.moments[1]?.texte === 'À midi, le marché de Nishiki.' && V.texteALire(ctx.P)?.source === 'humain');
    essai('« Enregistrer » attend que le micro soit ouvert, puis s’offre', await jusqua("!document.querySelector('#enr [data-enr=go]').disabled", 10000));
    await clic('#enr [data-enr="go"]');
    const defile = await jusqua("document.querySelector('#enr.en-cours') && document.querySelector('#enr .enr-moment.ici')?.dataset.k === '1'", 9000);
    essai('pendant la prise (sans montage à lire), le texte avance avec le temps : le deuxième moment s’éclaire après 3 s', defile, await js("document.querySelector('#enr .enr-moment.ici')?.dataset.k"));
    await capture('12-prise-avec-texte');
    await clic('#enr [data-enr="fermer"]');
    essai('« Fermer » pendant la prise la jette : le panneau part, le micro se libère', await jusqua("!document.querySelector('#enr') && !window.derush.enregistre()", 8000));

    titre('« Répondre » sous les questions de l’IA de montage');
    fs.mkdirSync(path.join(ctx.P.racine, 'claude'), {recursive: true});
    const maintenant = Date.now();
    fs.writeFileSync(path.join(ctx.P.racine, 'claude', 'etat.json'), JSON.stringify({atelier: null, versions: [], sessions: {}, echanges: [
      {role: 'humain', texte: 'Fais-moi un vlog de ma journée du vendredi.', quand: new Date(maintenant - 60000).toISOString()},
      {role: 'claude', moteur: 'claude', texte: reponseIA, quand: new Date(maintenant - 1000).toISOString(), duree_s: 312},
    ]}));
    await js('window.derush.relireIA()');
    essai('la dernière réponse de l’IA finit par des questions : « Répondre », et « Au micro » (il reste des questions de voix off)',
      await jusqua("document.querySelector('#claude .cl-repondre [data-cl=repondre][data-n=\"3\"]') && document.querySelector('#claude .cl-repondre [data-cl=vo-ouvrir]')", 10000));
    await clic('#claude .cl-repondre [data-cl="repondre"]');
    const zone = await js("(() => { const t = document.querySelector('#cl-texte'); return {v: t.value, s: t.selectionStart, focus: document.activeElement === t}; })()");
    essai('« Répondre » prépare « 1. », « 2. », « 3. » dans la zone d’écriture, le curseur sur la première ; rien ne part',
      zone.v === '1. \n2. \n3. ' && zone.s === 3 && zone.focus && (await appels('/claude\\/demander/')).length === 0, zone);
    await capture('13-repondre');
    await clic('#claude .cl-repondre [data-cl="vo-ouvrir"]');
    essai('« Au micro » ouvre les questions : celles de l’IA de montage sont marquées', await jusqua("document.querySelectorAll('.vo-feuille .vo-q').length === 4 && document.querySelectorAll('.vo-feuille .vo-source').length === 2", 8000));
    await capture('14-questions-du-montage');
    await touche('Escape', 'Escape', 27);
    await js("window.derush.ecrire(''); true");

    titre('« Pas de voix off », puis changer d’avis, puis tout oublier');
    await clic('#claude .vo-carte [data-cl="vo-changer"]');
    await jusqua("document.querySelector('#claude .vo-carte .vo-puce[data-choix=aucune]')");
    await clic('#claude .vo-carte .vo-puce[data-choix="aucune"]');
    essai('« Pas de voix off » : la carte s’en va, le micro s’éteint, sa bulle aussi',
      await jusqua("!document.querySelector('#claude .vo-carte') && !document.querySelector('#p-medias .vo-allume') && !document.querySelector('#p-medias .vo-bulle')", 8000) && etatServeur().choix === 'aucune');
    await clic('#claude [data-cl="menu"]');
    await clic('#claude .ia-menu [data-cl="vo-ouvrir"]');
    essai('le menu « … » de la colonne garde l’entrée « Voix off » : la feuille rouvre, le choix se change',
      await jusqua("document.querySelector('.vo-feuille .vo-choix.actif[data-choix=aucune]')", 8000));
    await clic('.vo-feuille [data-vo="oublier"]');
    const oublie = await jusqua("document.querySelector('.vo-feuille [data-vo=preparer]')", 8000);
    essai('« Tout oublier » : questions, réponses et choix effacés ; les enregistrements restent dans les médias ; le micro se rallume',
      oublie && !etatServeur().questions.length && !etatServeur().choix && !!ctx.P.d.medias.find((m) => m.id === m4.id) && await jusqua("document.querySelector('#p-medias .vo-allume')", 8000));
    await capture('15-tout-oublie');
    await touche('Escape', 'Escape', 27);

    titre('Avec ElevenLabs (un état dessiné dans la page : aucune clé, aucun appel)');
    await js(`(() => { const x = structuredClone(window.derush.voixOff.etat()); x.elevenlabs = true; x.choix_possibles.ia = {...x.choix_possibles.ia, ok: true, pourquoi: null}; window.derush.voixOff.poser(x); return true; })()`);
    essai('ElevenLabs branché : la carte propose aussi « Voix ElevenLabs »',
      await jusqua("document.querySelector('#claude .vo-carte .vo-puce[data-choix=ia]')") && JSON.stringify(await js("[...document.querySelectorAll('#claude .vo-carte .vo-puce')].map((b) => b.dataset.choix)")) === '["moi","ia","aucune"]');
    await js(`(() => { const x = structuredClone(window.derush.voixOff.etat()); Object.assign(x, {choix: 'ia', elevenlabs: false, micro: {allume: false, pourquoi: null}}); x.choix_possibles.ia.ok = false; window.derush.voixOff.poser(x); return true; })()`);
    essai('« Ton IA l’écrit et la fait dire » choisi, puis ElevenLabs débranché : la carte le dit et renvoie vers Connexions',
      await jusqua("document.querySelector('#claude .vo-carte .vo-attention') && document.querySelector('#claude .vo-carte [data-cl=vo-connexions]')"));
    await capture('16-elevenlabs-debranche');
    await js('window.derush.voixOff.charger()');
    essai('… et l’état du serveur revient à la lecture suivante', await jusqua("document.querySelector('#claude .vo-carte[data-etape=proposer]')", 8000));

    titre('Au bout du compte');
    essai('aucune erreur dans la page', erreursPage.length === 0, erreursPage.slice(0, 5));
    essai('aucune vraie IA : seul le faux Claude a été lancé, une fois, pour les questions ; aucune demande de montage envoyée',
      lancements().length === 1 && (await appels('/claude\\/(demander|ajouter)/')).length === 0);
    try { await cdp('Browser.close'); } catch { /* déjà fermé */ }
    sock.close();
    await Promise.race([ctx.file.vide(), dormir(20000)]);
    essai('le serveur n’a laissé tomber aucune erreur', tombes.length === 0, tombes.map((e) => String(e?.stack ?? e).slice(0, 300)));
  } catch (e) {
    essai('les essais de l’interface sont allés au bout', false, e.stack);
  }
}
try { chrome?.kill(); } catch { /* déjà fermé */ }
serveur?.close();
await dormir(300);
if (bons === total) fs.rmSync(T, {recursive: true, force: true});
else console.log(`\nLe dossier d’essai est gardé pour comprendre : ${T}`);
console.log(`\n${bons} essais réussis sur ${total}`);
process.exit(bons === total ? 0 : 1); // les états des moteurs en cours de calcul retiendraient le processus
