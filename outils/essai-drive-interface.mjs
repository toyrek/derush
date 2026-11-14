// Dérush — les essais de l'interface « Depuis mon Drive » (public/drive.js et son branchement dans public/app.js), pour
// qui modifie Dérush :
//   node outils/essai-drive-interface.mjs [dossier où créer le dossier d'essai]
// 1. Les petites aides de public/drive.js, sans page : tailles, heures, jours, le bouton « Importer (N fichiers, X Go) »,
//    la demande renvoyée à l'IA de montage après l'import, le squelette d'un dessin ; et la règle parleDuDrive que
//    l'interface partage avec le serveur (lib/commun.mjs).
// 2. L'interface pour de vrai, dans Chrome sans fenêtre (sautée si Chrome manque ; DERUSH_CHROME=<programme> pour en
//    donner un) : le vrai serveur de Dérush, dans ce processus, sur un dossier de Dérush, une bibliothèque, un dossier
//    personnel et un faux Google Drive jetables (DERUSH_SUPPORT, DERUSH_BIBLIOTHEQUE, HOME, DERUSH_DRIVE), avec de
//    vraies petites vidéos d'un « séjour au Japon » faites par FFmpeg et un fichier « resté sur le Drive » (creux).
//    L'IA légère de la recherche est un faux Claude (lib/ia.mjs remplacé par un crochet de chargement, comme dans
//    essai-drive) : aucune vraie IA n'est lancée. Dans la page, la fenêtre « Ouvrir » de l'ordinateur, les liens et
//    l'envoi à l'IA de montage sont coupés et notés : rien ne s'ouvre, rien ne part.
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
const T = fs.mkdtempSync(path.join(fs.realpathSync(parent), 'derush-essai-drive-interface-'));
// AVANT tout import de lib/ : ces dossiers sont lus une seule fois, au chargement
const SUPPORT = path.join(T, 'support');
const BIBLIO = path.join(T, 'bibliotheque');
const MAISON = path.join(T, 'maison');
const TMP = path.join(T, 'tmp');
const COMPTE = path.join(T, 'compte'); // comme ~/Library/CloudStorage/GoogleDrive-…
const DRIVE = path.join(COMPTE, 'Mon Drive');
for (const d of [SUPPORT, BIBLIO, MAISON, TMP, DRIVE, path.join(T, 'sons')]) fs.mkdirSync(d, {recursive: true});
process.env.DERUSH_SUPPORT = SUPPORT; // « = », jamais « ??= »
process.env.DERUSH_BIBLIOTHEQUE = BIBLIO;
process.env.DERUSH_DRIVE = DRIVE; // jamais le Drive de l'ordinateur
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
  console.log(`${vrai ? '  ✓' : '  ✗'} ${quoi}${vrai || detail === '' ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)?.slice(0, 600)}`}`);
}
const titre = (t) => console.log(`\n${t}`);
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

// ——— 1. les petites aides, sans page ———
const DR = await import(pathToFileURL(path.join(D, 'public', 'drive.js')).href);
const C = await import(pathToFileURL(path.join(D, 'lib', 'commun.mjs')).href);
titre('Les petites aides de public/drive.js');
essai('les tailles comme le serveur : 0 o, 1,5 Ko, 420 Mo, 3,4 Go', DR.tailleLisible(0) === '0 o' && DR.tailleLisible(1500) === '1,5 Ko' && DR.tailleLisible(420e6) === '420 Mo' && DR.tailleLisible(3.4e9) === '3,4 Go',
  [0, 1500, 420e6, 3.4e9].map(DR.tailleLisible));
const fi = (rel, genre, quand, taille, extra = {}) => ({rel, nom: rel.split('/').pop(), dossier: rel.split('/').slice(0, -1).join('/'), genre, taille, local: extra.local ?? true, duree: extra.duree ?? null,
  date: quand ? {quand, jour: quand.slice(0, 10), nom_jour: extra.nom_jour ?? quand.slice(0, 10), fuseau: '+09:00', sur: 'connu', source: extra.source ?? 'prise'} : null});
essai('l’heure de la prise (« 09:15 »), rien sans heure ; les durées « 0:42 », « 1:02:03 », rien pour une photo',
  DR.heureDe(fi('a/x.mov', 'video', '2024-11-08 09:15', 1)) === '09:15' && DR.heureDe(fi('a/x.mov', 'video', '2024-11-08', 1)) === '' && DR.heureDe({}) === ''
  && DR.dureeLisible(42) === '0:42' && DR.dureeLisible(3723) === '1:02:03' && DR.dureeLisible(null) === '' && DR.depuis(12) === '12 s' && DR.depuis(125) === '2 min 05');
essai('un jour en court : « ven. 8 nov. »', DR.jourCourt('2024-11-08') === 'ven. 8 nov.', DR.jourCourt('2024-11-08'));
const liste = [
  fi('Mon Drive/J/a.mov', 'video', '2024-11-08 09:15', 4e8, {nom_jour: 'vendredi 8 novembre 2024'}),
  fi('Mon Drive/J/b.jpg', 'photo', '2024-11-08 12:30', 3e6, {nom_jour: 'vendredi 8 novembre 2024'}),
  fi('Mon Drive/J/c.mp4', 'video', '2024-11-09 10:00', 2e9, {local: false, nom_jour: 'samedi 9 novembre 2024'}),
  fi('Mon Drive/J/d.m4a', 'son', null, 5e6),
];
const g = DR.grouperParJour(liste);
essai('les fichiers rangés par jour, dans l’ordre, avec leurs comptes et leur poids ; une date inconnue a son groupe',
  g.length === 3 && g[0].nom === 'Vendredi 8 novembre 2024' && g[0].videos === 1 && g[0].photos === 1 && g[0].taille === 4.03e8 && g[1].fichiers[0].nom === 'c.mp4' && g[2].nom === 'Date inconnue' && g[2].sons === 1, g);
const n = DR.compter(liste);
essai('ce qui est coché : combien, combien d’octets, et ce qui n’est que sur le Drive', n.n === 4 && n.taille === 2.408e9 && n.en_ligne.n === 1 && n.en_ligne.taille === 2e9, n);
essai('le bouton : « Importer (6 fichiers, 1,2 Go) », « Importer (1 fichier, 420 Mo) », « Importer » sans rien',
  DR.libelleImporter(6, 1.2e9) === 'Importer (6 fichiers, 1,2 Go)' && DR.libelleImporter(1, 420e6) === 'Importer (1 fichier, 420 Mo)' && DR.libelleImporter(0, 0) === 'Importer');
essai('les médias arrivés : « M4 à M6 » quand ils se suivent, « M4, M6 » sinon, les douze premiers au plus',
  DR.listeMedias(['M4', 'M5', 'M6']) === 'M4 à M6' && DR.listeMedias(['M4', 'M6']) === 'M4, M6' && DR.listeMedias(['M7']) === 'M7' && DR.listeMedias([]) === ''
  && DR.listeMedias(Array.from({length: 15}, (_, k) => `M${2 * k + 1}`)).endsWith(' et 3 autres'));
const m1 = DR.messageApresImport('va dans mon Drive et fais-moi un vlog du vendredi', {ajoutes: ['M1', 'M2', 'M3']}, '3 vidéos du vendredi 8 novembre, Kyoto, 1,2 Go');
essai('la demande renvoyée à l’IA de montage : la demande d’origine, puis où sont les rushes (pas dans drive/)',
  m1.startsWith('va dans mon Drive et fais-moi un vlog du vendredi\n\n') && m1.includes('M1 à M3') && m1.includes('(3 vidéos du vendredi 8 novembre, Kyoto, 1,2 Go)') && m1.includes('ne va pas les chercher dans drive/'), m1);
essai('… déjà tous dans le projet : elle le dit ; rien d’importé : la demande seule',
  DR.messageApresImport('un vlog', {ajoutes: [], deja: 2}).includes('déjà dans le projet') && DR.messageApresImport('un vlog', {ajoutes: [], deja: 0}) === 'un vlog');
essai('les étapes de la recherche : le plan, les dossiers, les dates (même en attendant l’accord), les fichiers, prêt',
  ['plan', 'ia_dossiers', 'a_confirmer', 'dates', 'ia_fichiers', 'pret', 'erreur'].map(DR.etapeRecherche).join() === '0,1,2,2,3,4,-1');
const h1 = '<div class="x"><span data-v="etape">Dérush lit les dates</span><i data-v="barre" style="width:20%"></i><small data-v="temps">3 s</small></div>';
const h2 = '<div class="x"><span data-v="etape">Claude choisit</span><i data-v="barre" style="width:80%"></i><small data-v="temps">9 s</small></div>';
essai('le squelette d’un dessin ignore ce qui bouge (textes vivants, barres), pas le reste',
  DR.squelette(h1) === DR.squelette(h2) && DR.squelette(h1) !== DR.squelette(h1.replace('class="x"', 'class="y"')));
const oui = ['va dans mon Drive, prends les vidéos de mon séjour au Japon et fais-moi un vlog du vendredi', 'récupère les rushes de mon séjour au Japon sur le Drive'];
const non = ['monte la vidéo du vendredi', 'Envoie la vidéo sur mon Drive', 'le vendredi au Japon'];
essai('parleDuDrive (lib/commun.mjs, la règle de l’interface) : « va dans mon Drive, prends les vidéos… » oui ; « envoie la vidéo sur mon Drive » non',
  oui.every(C.parleDuDrive) && !non.some(C.parleDuDrive), [oui.map(C.parleDuDrive), non.map(C.parleDuDrive)]);

// ——— 2. l'interface pour de vrai ———
const CHROME = process.env.DERUSH_CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((c) => fs.existsSync(c));
const CAPTURES = process.env.DERUSH_ESSAI_CAPTURES ? path.resolve(process.env.DERUSH_ESSAI_CAPTURES) : null;
const ffOk = spawnSync(process.env.DERUSH_FFMPEG || 'ffmpeg', ['-version']).status === 0;
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
    // — le faux Drive : de vraies petites vidéos d'un séjour au Japon, sur plusieurs jours —
    const ff = (args) => { const r = spawnSync(process.env.DERUSH_FFMPEG || 'ffmpeg', ['-v', 'error', '-y', ...args]); if (r.status !== 0) throw new Error(`FFmpeg : ${r.stderr?.toString().slice(-300)}`); };
    const dans = (rel) => { const f = path.join(DRIVE, ...rel.split('/')); fs.mkdirSync(path.dirname(f), {recursive: true}); return f; };
    const video = (rel, meta = {}, d = 1) => {
      const f = dans(rel);
      const mov = /\.mov$/i.test(f);
      ff(['-f', 'lavfi', '-i', `testsrc=d=${d}:s=160x90:r=10`, '-f', 'lavfi', '-i', `sine=d=${d}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
        ...(mov ? ['-movflags', 'use_metadata_tags'] : []), ...Object.entries(meta).flatMap(([k, v]) => ['-metadata', `${k}=${v}`]), '-f', mov ? 'mov' : 'mp4', f]);
      return f;
    };
    const J = 'Voyages/Japon 2024';
    video(`${J}/Tokyo/IMG_0001.MOV`, {'com.apple.quicktime.creationdate': '2024-11-06T10:00:00+0900'}); // mercredi
    video(`${J}/Tokyo/IMG_0002.MOV`, {'com.apple.quicktime.creationdate': '2024-11-07T18:00:00+0900'}); // jeudi
    const KYOTO_1 = video(`${J}/Kyoto/IMG_0010.MOV`, {'com.apple.quicktime.creationdate': '2024-11-08T09:15:00+0900'}, 2); // vendredi
    video(`${J}/Kyoto/IMG_0011.MOV`, {'com.apple.quicktime.creationdate': '2024-11-08T16:40:00+0900'});
    video(`${J}/Kyoto/IMG_0013.MOV`, {'com.apple.quicktime.creationdate': '2024-11-09T11:00:00+0900'}); // samedi
    video(`${J}/Kyoto/VID_20241108_083012.mp4`, {creation_time: '2024-11-07T23:30:12Z'}); // Android : vendredi 8 h 30 au Japon
    ff(['-f', 'lavfi', '-i', 'sine=d=1', '-c:a', 'aac', '-metadata', 'creation_time=2024-11-08T10:00:00Z', '-f', 'mp4', dans(`${J}/Osaka/ambiance.m4a`)]); // vendredi 19 h
    const GOPR = dans(`${J}/Kyoto/GOPR0099.MP4`); // resté sur le Drive : une taille, aucun bloc
    fs.writeFileSync(GOPR, '');
    fs.truncateSync(GOPR, 5e6);
    fs.utimesSync(GOPR, new Date('2024-11-08T03:00:00Z'), new Date('2024-11-08T03:00:00Z'));
    const CREUX = fs.statSync(GOPR).blocks === 0;
    video('Travail/Réunion/reunion.mp4', {creation_time: '2025-01-10T09:00:00Z'});
    const avantDrive = new Map([KYOTO_1, GOPR].map((f) => [f, {taille: fs.statSync(f).size, date: fs.statSync(f).mtimeMs}]));

    // — le faux Claude, et lib/ia.mjs remplacé (jamais un autre programme) —
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
  fs.appendFileSync(process.env.FAUX_JOURNAL, JSON.stringify({cwd: process.cwd(), consigne}) + '\\n');
  out({type: 'system', subtype: 'init', session_id: 'faux', mcp_servers: []});
  if (/panne/i.test(consigne)) { out({type: 'result', result: 'je n’ai rien écrit', is_error: true}); setTimeout(() => process.exit(1), 20); return; }
  let rep;
  if (/fichiers\\.json/.test(consigne)) {
    out({type: 'assistant', message: {content: [{type: 'tool_use', name: 'Read', input: {file_path: 'fichiers.json'}}]}});
    const j = JSON.parse(fs.readFileSync('fichiers.json', 'utf8'));
    rep = {fichiers: j.fichiers.filter((f) => /^vendredi/.test(f.jour)).map((f) => f.id), lieu: 'Kyoto', phrase: 'Toute ta journée du vendredi, de Kyoto à Osaka.', question: null};
  } else {
    out({type: 'assistant', message: {content: [{type: 'tool_use', name: 'Read', input: {file_path: 'arborescence.json'}}]}});
    JSON.parse(fs.readFileSync('arborescence.json', 'utf8'));
    rep = /islande/i.test(consigne) && !/précision/i.test(consigne) ? {dossiers: [], question: 'Je ne trouve aucun dossier sur l’Islande : où sont ces vidéos ?'}
      : {dossiers: ['Voyages/Japon 2024'], pourquoi: 'Le dossier du séjour au Japon.', question: null};
  }
  fs.writeFileSync('reponse.json', JSON.stringify(rep));
  out({type: 'assistant', message: {content: [{type: 'tool_use', name: 'Write', input: {file_path: 'reponse.json'}}]}});
  out({type: 'result', result: 'fait', is_error: false});
  setTimeout(() => process.exit(0), 20);
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

    // — le vrai serveur, dans ce processus, sur un projet neuf —
    const lib = (m) => import(pathToFileURL(path.join(D, 'lib', m)).href);
    const {Projet} = await lib('projet.mjs');
    const {FileDAttente} = await lib('outils.mjs');
    const {demarrerServeur} = await lib('serveur.mjs');
    const {changerReglages} = await lib('reglages.mjs');
    const Bi = await lib('bibliotheque.mjs');
    changerReglages({tuto_vu: true, accueil_vu: true}); // ni tutoriel ni accueil par-dessus l'éditeur
    const ctx = {P: null, file: new FileDAttente(), app: false, natif: false,
      ouvrir(d, t) { const P = new Projet(d); if (t && !fs.existsSync(path.join(P.racine, '.derush'))) { P.d.titre = t; P.sauver(); } ctx.P = P; Bi.noterRecent(P.racine); return P; },
      projetVivant(d) { return ctx.P?.racine === path.resolve(d) ? ctx.P : null; },
      fermer() { ctx.P = null; }};
    const PROJET = path.join(BIBLIO, 'Vlog Japon');
    ctx.ouvrir(PROJET, 'Vlog Japon');
    ({serveur} = await demarrerServeur(ctx, {port: 0}));
    const base = `http://127.0.0.1:${serveur.address().port}`;

    // — Chrome sans fenêtre, piloté par son protocole —
    const portLibre = () => new Promise((ok, ko) => { const s = net.createServer(); s.on('error', ko); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
    const PORT_CDP = await portLibre();
    chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${path.join(T, 'chrome')}`, '--window-size=1480,1063',
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
      const p = await js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({block: 'center'}); const b = e.getBoundingClientRect(); return {x: b.left + b.width / 2, y: b.top + b.height / 2}; })()`);
      if (!p) return false;
      for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', {type, x: p.x, y: p.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1});
      await dormir(80);
      return true;
    };
    const ecrire = (sel, texte) => js(`(() => { const z = document.querySelector(${JSON.stringify(sel)}); if (!z) return false; z.focus(); z.value = ${JSON.stringify(texte)}; z.dispatchEvent(new Event('input', {bubbles: true})); return true; })()`);
    const touche = async (key, code = key, vk = 0, mod = 0) => { for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', {type, key, code, windowsVirtualKeyCode: vk, modifiers: mod}); await dormir(80); };
    const capture = async (nom) => { if (!CAPTURES) return; fs.mkdirSync(CAPTURES, {recursive: true}); const {data} = await cdp('Page.captureScreenshot', {format: 'png'}); fs.writeFileSync(path.join(CAPTURES, `${nom}.png`), Buffer.from(data, 'base64')); };
    const appels = (re) => js(`window.__appels.filter((a) => ${re}.test(a.m + ' ' + a.u)).map((a) => a.corps)`);
    const texteDe = (sel) => js(`(document.querySelector(${JSON.stringify(sel)})?.textContent ?? '').replace(/\\s+/g, ' ').trim()`);

    titre('L’éditeur et l’entrée « Depuis mon Drive »');
    const ouvert = await jusqua("window.derush && window.derush.projet() && document.querySelector('#p-medias .drive-grand')", 30000);
    essai('l’éditeur s’ouvre sur le projet', ouvert, ouvert ? '' : {page: await js("location.href + ' | ' + document.body.innerText.slice(0, 300)").catch((e) => e.message), erreurs: erreursPage.slice(0, 5)});
    if (!ouvert) throw new Error('l’éditeur ne s’est pas ouvert');
    // la garde : la fenêtre « Ouvrir » de l'ordinateur, les liens et l'envoi à l'IA de montage sont coupés et notés
    await js(`(() => {
      window.__appels = [];
      window.__faux = {drive: null};
      const vrai = window.fetch.bind(window);
      const json = (j, code = 200) => new Response(JSON.stringify(j), {status: code, headers: {'content-type': 'application/json'}});
      window.fetch = async (url, opts = {}) => {
        const u = String(url);
        const m = (opts.method || 'GET').toUpperCase();
        let corps = null;
        try { corps = opts.body ? JSON.parse(opts.body) : null; } catch { corps = null; }
        window.__appels.push({m, u, corps});
        if (u.startsWith('/api/choisir')) return json({erreur: 'coupé pendant l’essai'}, 400);
        if (u.startsWith('/api/lien')) return json({ok: true});
        if (m === 'POST' && /^\\/api\\/claude\\/(demander|ajouter)/.test(u)) return json({ok: true});
        if (u === '/api/drive' && m === 'GET' && window.__faux.drive) return json(window.__faux.drive);
        return vrai(url, opts);
      };
      return true;
    })()`);
    await jusqua("window.derush.claude() && window.derush.claude().claude && window.derush.claude().claude.ok", 15000);
    await capture('01-editeur');
    essai('le panneau des médias propose « Depuis mon Drive », la colonne de l’IA aussi', await js("!!document.querySelector('#p-medias [data-a=drive]') && !!document.querySelector('#claude [data-a=drive]')"));

    titre('« va dans mon Drive… » écrit à l’IA de montage');
    const DEMANDE = 'va dans mon Drive, prends les vidéos de mon séjour au Japon et fais-moi un vlog du vendredi';
    await js(`window.derush.ecrire(${JSON.stringify(DEMANDE)})`);
    await dormir(200);
    await clic('#cl-envoyer');
    await jusqua("window.derush.driveCarte()");
    essai('la demande ne part pas : Dérush propose d’abord de chercher dans le Drive (la carte, avec la demande)',
      (await appels('/claude\\/demander/')).length === 0 && (await js('window.derush.driveCarte()?.etape')) === 'proposer' && (await texteDe('.cl-drive blockquote')) === DEMANDE && !!(await js("document.querySelector('[data-cl=drive-chercher]') && document.querySelector('[data-cl=drive-tel-quel]')")));
    await capture('02-carte');
    await clic('[data-cl="drive-chercher"]');
    await jusqua("document.querySelector('.dr-feuille [name=demande]')");
    essai('« Chercher dans ton Drive » : la feuille, sur « Demander à l’IA », le champ déjà rempli ; rien ne part encore à l’IA',
      (await js("document.querySelector('.dr-feuille [name=demande]').value")) === DEMANDE && (await js("document.querySelector('.dr-onglets [data-dr=onglet-ia]').classList.contains('actif')")) && (await appels('/drive\\/chercher/')).every((c) => c === null));
    essai('la phrase « à savoir » est sous « Chercher » (ce qui part à l’IA, et ce qui n’y part pas)', /jamais les fichiers eux-mêmes/.test(await texteDe('.dr-a-savoir')) && (await js("document.querySelector('.dr-a-savoir').previousElementSibling.querySelector('[data-dr=chercher]') !== null")));
    essai('la carte de la colonne attend les rushes', (await js('window.derush.driveCarte()?.etape')) === 'attente');
    await capture('03-feuille');

    titre('La recherche, suivie par étapes (le faux Claude choisit)');
    await clic('[data-dr="chercher"]');
    const envoyee = (await appels('/POST \\/api\\/drive\\/chercher$/'))[0];
    essai('« Chercher » : la demande part, avec l’IA choisie', envoyee?.demande === DEMANDE && envoyee?.moteur === 'claude', envoyee);
    essai('les étapes s’affichent pendant la recherche, avec ce que fait Dérush', await jusqua("document.querySelector('.dr-etapes .dr-etape.encours, .dr-etapes .dr-etape.attend, .dr-choix')", 8000));
    await capture('04-suivi');
    if (CREUX) {
      essai('un fichier resté sur le Drive : la recherche attend l’accord, avec le texte du serveur et deux choix', await jusqua("document.querySelector('.dr-confirmer [data-dr=continuer-lire]') && document.querySelector('.dr-confirmer [data-dr=continuer-noms]')", 30000)
        && /que sur le Drive/.test(await texteDe('.dr-confirmer p')));
      await capture('05-accord');
      await clic('[data-dr="continuer-noms"]');
      essai('« Se fier aux noms des fichiers » : la recherche continue sans le télécharger', (await appels('/chercher\\/continuer/'))[0]?.lire === false);
    } else console.log('  (le disque de l’essai ne fait pas de fichiers creux : pas d’accord à demander)');
    essai('le choix arrive : la phrase du serveur en gros, la liste par jour', await jusqua("document.querySelector('.dr-choix .dr-resume b')", 30000) && /vendredi 8 novembre/.test(await texteDe('.dr-resume b')) && (await js("document.querySelectorAll('.dr-jour-groupe').length")) === 1);
    const lignes = await js("[...document.querySelectorAll('.dr-choix .dr-fichier')].map((l) => ({rel: l.dataset.drLigne, coche: l.querySelector('input').checked, heure: l.querySelector('.dr-heure').textContent, drive: !!l.querySelector('.dr-pastille'), genre: l.querySelector('.dr-genre').className}))");
    essai('les fichiers du vendredi, dans l’ordre de prise de vue, tous cochés, avec heure, genre et « sur le Drive »',
      lignes.length === 5 && lignes.every((l) => l.coche) && lignes.map((l) => l.heure).join() === lignes.map((l) => l.heure).sort().join()
      && lignes.some((l) => /son/.test(l.genre)) && lignes.filter((l) => l.drive).length === (CREUX ? 1 : 0) && lignes.every((l) => /2024|Japon/.test(l.rel)), lignes);
    const bouton = await texteDe('.dr-pied [data-dr=importer]');
    essai('le bouton dit combien de fichiers et de Go', /^Importer \(5 fichiers, [\d,]+ (Ko|Mo)\)$/.test(bouton), bouton);
    await capture('06-choix');
    const decoche = lignes.find((l) => l.drive)?.rel ?? lignes.at(-1).rel;
    await clic(`[data-dr-ligne="${decoche}"] input`);
    essai('décocher un fichier : le bouton, le pied et la case du jour suivent (sans tout redessiner)',
      /^Importer \(4 fichiers/.test(await texteDe('.dr-pied [data-dr=importer]')) && await js("document.querySelector('[data-dr-jour-tout]').indeterminate") && /4 fichiers cochés/.test(await texteDe('.dr-coches')));

    titre('L’aperçu, puis l’import');
    await clic('[data-dr="importer"]');
    await jusqua("document.querySelector('.dr-apercu')");
    const rels = (await appels('/importer\\/apercu/'))[0]?.fichiers ?? [];
    essai('« Importer » : d’abord l’aperçu, avec exactement les fichiers cochés', rels.length === 4 && !rels.includes(decoche) && (await appels('/POST \\/api\\/drive\\/importer$/')).length === 0, rels);
    const apercu = await js("({resume: document.querySelector('.dr-apercu-txt b')?.textContent, refus: document.querySelector('.dr-apercu').classList.contains('refus'), go: !!document.querySelector('[data-dr=importer-go]'), actif: !document.querySelector('[data-dr=importer-go]')?.disabled})");
    essai('l’aperçu montre ce que dit le serveur (fichiers, Go) et la place restante', /4 fichiers à importer/.test(apercu.resume ?? '') && /libres sur le disque/.test(await texteDe('.dr-apercu-txt small')), apercu);
    await capture('07-apercu');
    let importe = false;
    if (apercu.refus) {
      essai('pas assez de place sur le disque : refusé, « Importer maintenant » grisé, le texte du serveur dit pourquoi', !apercu.actif && (await texteDe('.dr-apercu-txt p')).length > 10);
      await clic('[data-dr="apercu-retour"]');
    } else {
      await clic('[data-dr="importer-go"]');
      essai('« Importer maintenant » : l’import part, avec les mêmes fichiers', ((await appels('/POST \\/api\\/drive\\/importer$/'))[0]?.fichiers ?? []).join() === rels.join());
      essai('l’import finit, la fin dit ce qui est arrivé', await jusqua("document.querySelector('.dr-fin .dr-fin-tete')", 60000) && /4 fichiers importés/.test(await texteDe('.dr-fin-tete')), await texteDe('.dr-fin-tete'));
      await capture('08-fin');
      await jusqua('window.derush.projet().medias.length === 4', 10000);
      const medias = await js('window.derush.projet().medias.map((m) => m.nom)');
      essai('les rushes sont dans les médias du projet, dans l’ordre de prise de vue', medias.length === 4 && medias[0] === 'VID_20241108_083012.mp4' && medias[1] === 'IMG_0010.MOV', medias);
      essai('… copiés dans rushes/ du projet ; les fichiers du Drive n’ont pas changé (taille, date)',
        fs.readdirSync(path.join(PROJET, 'rushes')).length === 4 && [...avantDrive].every(([f, a]) => fs.statSync(f).size === a.taille && fs.statSync(f).mtimeMs === a.date));
      essai('la carte de la colonne : les rushes sont là, la demande peut partir', (await js('window.derush.driveCarte()?.etape')) === 'pret');
      essai('la demande d’origine est proposée à l’IA de montage, à relire', (await js("document.querySelector('.dr-feuille [name=envoi]')?.value")) === DEMANDE && await js("!document.querySelector('[data-dr=envoyer]').disabled"));
      await clic('[data-dr="envoyer"]');
      await jusqua('!window.derush.driveCarte()', 5000);
      const parti = (await appels('/claude\\/demander/'))[0]?.message ?? '';
      essai('« Envoyer » : la demande part à l’IA de montage avec la liste des rushes arrivés ; la feuille et la carte se ferment',
        parti.startsWith(`${DEMANDE}\n\n`) && /M1 à M4/.test(parti) && /ne va pas les chercher dans drive\//.test(parti) && !(await js("document.querySelector('#voile:not(.cache) .dr')")) && !(await js('window.derush.driveCarte()')), parti);
      importe = true;
    }
    if (!importe) {
      // sans place pour importer, la demande attend toujours ses rushes : on la garde dans la zone d'écriture
      await touche('Escape', 'Escape', 27);
      await clic('[data-cl="drive-annuler"]');
    }

    titre('« Envoyer tel quel »');
    const AUTRE = 'récupère les photos de mon voyage sur le Drive';
    await js(`window.derush.ecrire(${JSON.stringify(AUTRE)})`);
    await clic('#cl-envoyer');
    await jusqua("window.derush.driveCarte()?.etape === 'proposer'");
    await clic('[data-cl="drive-tel-quel"]');
    await jusqua('!window.derush.driveCarte()', 5000);
    const tel = await appels('/claude\\/demander/');
    essai('la demande part telle quelle, sans détour par le Drive', tel.at(-1)?.message === AUTRE, tel);
    await js("window.derush.ecrire('monte la vidéo du vendredi')");
    await clic('#cl-envoyer');
    await dormir(400);
    essai('une demande qui ne parle pas du Drive part tout de suite', (await appels('/claude\\/demander/')).at(-1)?.message === 'monte la vidéo du vendredi' && !(await js('window.derush.driveCarte()')));

    titre('La question de l’IA, une erreur, Réessayer');
    await js("window.derush.drive({demande: 'les vidéos de mon séjour en Islande'})");
    await jusqua("document.querySelector('.dr-feuille [data-dr=chercher]')");
    await clic('[data-dr="chercher"]');
    essai('l’IA ne trouve pas : sa question, et un champ pour répondre', await jusqua("document.querySelector('.dr-question .dr-bulle-ia p')", 30000) && /Islande/.test(await texteDe('.dr-bulle-ia p')));
    await capture('09-question');
    await ecrire('[name=precision]', 'précision : c’était au Japon finalement');
    await clic('.dr-repondre [type=submit]');
    const precision = (await appels('/POST \\/api\\/drive\\/chercher$/')).at(-1);
    essai('« Répondre » : la même demande repart, avec la précision', precision?.demande === 'les vidéos de mon séjour en Islande' && /Japon/.test(precision?.precision ?? ''), precision);
    if (CREUX) { await jusqua("document.querySelector('[data-dr=continuer-noms]')", 30000); await clic('[data-dr="continuer-noms"]'); }
    essai('… et le choix arrive', await jusqua("document.querySelector('.dr-choix')", 30000));
    await clic('[data-dr="nouvelle"]');
    await jusqua("document.querySelector('.dr-feuille [name=demande]')");
    await ecrire('.dr-feuille [name=demande]', 'les vidéos du Japon, mais le serveur tombe en panne');
    await clic('[data-dr="chercher"]');
    essai('une erreur de l’IA : le message du serveur et « Réessayer »', await jusqua("document.querySelector('.dr-vide [data-dr=reessayer]')", 30000) && (await texteDe('.dr-vide p')).length > 3);
    await capture('10-erreur');
    const avantReessai = (await appels('/POST \\/api\\/drive\\/chercher$/')).length;
    await clic('[data-dr="reessayer"]');
    const reessai = (await appels('/POST \\/api\\/drive\\/chercher$/'));
    essai('« Réessayer » relance la même demande', reessai.length === avantReessai + 1 && reessai.at(-1)?.demande === 'les vidéos du Japon, mais le serveur tombe en panne');
    await jusqua("document.querySelector('.dr-vide [data-dr=reessayer]')", 30000);
    await touche('Escape', 'Escape', 27);
    essai('Échap ferme la feuille', await jusqua("document.querySelector('#voile').classList.contains('cache')", 3000));

    titre('« Choisir moi-même » : dossier par dossier, jour par jour');
    await js("window.derush.drive({onglet: 'main'})");
    essai('les racines du Drive, avec leurs comptes', await jusqua("document.querySelector('.dr-dossier[data-dr-dossier=\"Mon Drive\"]')", 30000) && /vidéo/.test(await texteDe('.dr-dossier[data-dr-dossier="Mon Drive"] small')));
    await clic('.dr-dossier[data-dr-dossier="Mon Drive"]');
    await jusqua("document.querySelector('.dr-dossier[data-dr-dossier=\"Mon Drive/Voyages\"]')");
    await clic('.dr-dossier[data-dr-dossier="Mon Drive/Voyages"]');
    await jusqua("document.querySelector('.dr-dossier[data-dr-dossier=\"Mon Drive/Voyages/Japon 2024\"]')");
    await clic('.dr-dossier[data-dr-dossier="Mon Drive/Voyages/Japon 2024"]');
    essai('un dossier : le fil d’Ariane, ses sous-dossiers, les puces de ses jours', await jusqua("document.querySelector('.dr-jour[data-dr-jour=\"2024-11-08\"]')")
      && (await texteDe('.dr-ariane')).replace(/\s/g, '') === 'DriveMonDriveVoyagesJapon2024' && (await js("document.querySelectorAll('.dr-dossier').length")) === 3);
    await capture('11-dossier');
    await clic('.dr-jour[data-dr-jour="2024-11-08"]');
    await jusqua("document.querySelector('.dr-jour.actif') && document.querySelector('.dr-fichier')");
    const vendredi = await js("[...document.querySelectorAll('.dr-fichier')].map((l) => l.dataset.drLigne.split('/').pop())");
    essai('un jour : tous les fichiers de ce jour, sous-dossiers compris, dans l’ordre de prise de vue',
      vendredi[0] === 'VID_20241108_083012.mp4' && vendredi.includes('ambiance.m4a') && vendredi.includes('IMG_0011.MOV') && !vendredi.includes('IMG_0013.MOV') && (await appels('/medias\\?dossier=.*jour=2024-11-08/')).length === 1, vendredi);
    await clic('[data-dr-ligne$="IMG_0011.MOV"] input');
    await clic('[data-dr-ligne$="ambiance.m4a"] input');
    essai('cocher : le pied compte, le bouton Importer suit', /^Importer \(2 fichiers/.test(await texteDe('.dr-pied [data-dr=importer]')) && /2 fichiers cochés/.test(await texteDe('.dr-coches')));
    await clic('.dr-ariane [data-dr-dossier="Mon Drive/Voyages"]');
    await jusqua("!document.querySelector('.dr-jour.actif')");
    essai('les cases cochées restent d’un dossier à l’autre', /^Importer \(2 fichiers/.test(await texteDe('.dr-pied [data-dr=importer]')));
    await clic('.dr-dossier[data-dr-dossier="Mon Drive/Voyages/Japon 2024"]');
    await jusqua("document.querySelector('[data-dr=lire-dates]')");
    const oublis = await js("window.__appels.filter((a) => a.u === '/api/drive/chercher/oublier').length");
    await clic('[data-dr="lire-dates"]');
    const lecture = (await appels('/POST \\/api\\/drive\\/chercher$/')).at(-1);
    essai('« Lire les dates de prise de vue » : une lecture sans IA, de ce dossier', lecture?.sans_ia === true && lecture?.dossiers?.[0] === 'Mon Drive/Voyages/Japon 2024', lecture);
    if (CREUX) {
      essai('… elle demande d’abord l’accord pour ce qui n’est que sur le Drive', await jusqua("document.querySelector('.dr-main .dr-confirmer')", 30000));
      await clic('[data-dr="continuer-noms"]');
    }
    essai('… puis la liste est relue, la lecture effacée', await jusqua(`!document.querySelector('.dr-confirmer') && !document.querySelector('.dr-lecture') && (window.__appels.filter((a) => a.u === '/api/drive/chercher/oublier').length > ${oublis})`, 30000));
    await capture('12-dates-lues');

    titre('Sans Google Drive pour ordinateur, sans IA');
    await touche('Escape', 'Escape', 27);
    await js("window.__faux.drive = {actif: true, synchronise: false, dossier: null, partages: false, connecteur: null, installer: {lien: 'https://www.google.com/drive/download/', texte: 'Installe Google Drive pour ordinateur (gratuit, sur le site de Google), connecte ton compte, puis rouvre cette fenêtre.'}}; window.derush.drive(); true");
    essai('la feuille explique (le texte du serveur) et donne le lien officiel', await jusqua("document.querySelector('.dr-absent [data-dr=installer]')") && /Installe Google Drive/.test(await texteDe('.dr-absent p')) && !(await js("document.querySelector('.dr-onglets')")));
    await capture('13-sans-drive');
    await clic('[data-dr="installer"]');
    essai('le lien s’ouvre par /api/lien, sur un clic', (await appels('/api\\/lien/')).at(-1)?.url === 'https://www.google.com/drive/download/');
    await touche('Escape', 'Escape', 27);
    await js("window.__faux.drive = null; window.derush.claude().claude.ok = false; window.derush.drive({demande: 'le vendredi au Japon'}); true");
    essai('sans IA branchée : pas de « Chercher », mais « Brancher mon IA » et « Choisir moi-même »', await jusqua("document.querySelector('.dr-demande [data-dr=connexions]')") && !(await js("document.querySelector('[data-dr=chercher]')")) && !!(await js("document.querySelector('.dr-demande [data-dr=onglet-main]')")));
    await touche('Escape', 'Escape', 27);
    await js('window.derush.claude().claude.ok = true; true');

    titre('Au bout du compte');
    essai('aucune erreur dans la page', erreursPage.length === 0, erreursPage.slice(0, 5));
    essai('aucune vraie IA : seul le faux Claude a été lancé, pour la recherche (jamais pour le montage)', (() => {
      let j = [];
      try { j = fs.readFileSync(JOURNAL, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { /* aucun lancement */ }
      return j.length >= 2 && j.every((x) => x.cwd.startsWith(path.join(SUPPORT, 'drive')));
    })());
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
