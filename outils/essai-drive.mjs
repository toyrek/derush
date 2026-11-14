// Dérush — les essais de « Depuis mon Drive » (lib/drive-medias.mjs), pour qui modifie Dérush. Aucune vraie IA, aucun
// vrai Google Drive, aucun compte :
//   node outils/essai-drive.mjs [dossier où créer le dossier d'essai]
// L'essai crée son propre dossier (« derush-essai-drive-… ») dans le dossier donné, ou dans le dossier temporaire du
// système : un dossier de Dérush, une bibliothèque et un faux Google Drive (DERUSH_SUPPORT, DERUSH_BIBLIOTHEQUE,
// DERUSH_DRIVE), avec de vraies petites vidéos faites par FFmpeg, tournées sur plusieurs jours d'un « séjour au Japon »
// (dates de l'iPhone avec leur fuseau, date universelle d'Android, date dans le nom, EXIF d'une photo, un son), un
// fichier « resté sur le Drive » (un fichier creux : une taille, aucun bloc sur le disque), des fichiers cachés, une
// boucle de raccourcis et un raccourci qui sort du Drive. Il n'efface que ce dossier à la fin (il le garde si un essai
// échoue).
// L'IA est remplacée (un crochet de chargement de Node remplace lib/ia.mjs) par un faux Claude qui parle comme le vrai :
// il lit le plan ou la liste que Dérush lui prépare, choisit le dossier du Japon puis les fichiers du vendredi, et note
// tout ce qu'il reçoit. Les routes sont appelées directement (sans serveur), comme lib/serveur.mjs les appellera.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {register} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
if (/^-/.test(process.argv[2] ?? '')) { console.log(`Usage : node ${path.relative(process.cwd(), process.argv[1])} [dossier temporaire]`); process.exit(0); }
const parent = path.resolve(process.argv[2] ?? os.tmpdir());
fs.mkdirSync(parent, {recursive: true});
const dejaLa = fs.readdirSync(parent);
const T = fs.mkdtempSync(path.join(parent, 'derush-essai-drive-'));
// AVANT tout import de lib/ : ces dossiers sont lus une seule fois, au chargement
const SUPPORT = path.join(T, 'support');
const BIBLIO = path.join(T, 'bibliotheque');
const TMP = path.join(T, 'tmp');
const COMPTE = path.join(T, 'compte'); // comme ~/Library/CloudStorage/GoogleDrive-…
const DRIVE = path.join(COMPTE, 'Mon Drive');
for (const d of [SUPPORT, BIBLIO, TMP, DRIVE, path.join(T, 'sons')]) fs.mkdirSync(d, {recursive: true});
process.env.DERUSH_SUPPORT = SUPPORT;
process.env.DERUSH_BIBLIOTHEQUE = BIBLIO;
process.env.DERUSH_DRIVE = DRIVE;
process.env.DERUSH_SONS = path.join(T, 'sons');
process.env.DERUSH_SANS_MAJ = '1';
process.env.DERUSH_SANS_NAVIGATEUR = '1';
process.env.DERUSH_TREG_BASE = 'http://127.0.0.1:9';
process.env.TMPDIR = TMP;
process.env.TEMP = TMP;
process.env.TMP = TMP;
for (const k of ['TREG_TOKEN', 'ELEVENLABS_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY']) delete process.env[k];

// ——— le faux Drive : de vraies petites vidéos, sur plusieurs jours ———
const ff = (args) => {
  const r = spawnSync(process.env.DERUSH_FFMPEG || 'ffmpeg', ['-v', 'error', '-y', ...args]);
  if (r.status !== 0) throw new Error(`FFmpeg : ${r.stderr?.toString().slice(-300)}`);
};
const dans = (rel) => { const f = path.join(DRIVE, ...rel.split('/')); fs.mkdirSync(path.dirname(f), {recursive: true}); return f; };
function video(rel, meta = {}, {son = true} = {}) {
  const f = dans(rel);
  const mov = /\.mov$/i.test(f);
  ff(['-f', 'lavfi', '-i', 'testsrc=d=1:s=160x90:r=10', ...(son ? ['-f', 'lavfi', '-i', 'sine=d=1'] : []), '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    ...(son ? ['-c:a', 'aac', '-shortest'] : []), ...(mov ? ['-movflags', 'use_metadata_tags'] : []), ...Object.entries(meta).flatMap(([k, v]) => ['-metadata', `${k}=${v}`]), '-f', mov ? 'mov' : 'mp4', f]);
  return f;
}
/** L'EXIF d'une photo (TIFF petit-boutiste : IFD0 → IFD Exif → DateTimeOriginal, OffsetTimeOriginal), en segment APP1. */
function segmentExif(quand, fuseau) {
  const exif = 26;
  const donnees = 56;
  const t = Buffer.alloc(donnees + 27);
  t.write('II', 0, 'latin1'); t.writeUInt16LE(42, 2); t.writeUInt32LE(8, 4);
  t.writeUInt16LE(1, 8); t.writeUInt16LE(0x8769, 10); t.writeUInt16LE(4, 12); t.writeUInt32LE(1, 14); t.writeUInt32LE(exif, 18); t.writeUInt32LE(0, 22);
  t.writeUInt16LE(2, exif);
  t.writeUInt16LE(0x9003, exif + 2); t.writeUInt16LE(2, exif + 4); t.writeUInt32LE(20, exif + 6); t.writeUInt32LE(donnees, exif + 10);
  t.writeUInt16LE(0x9011, exif + 14); t.writeUInt16LE(2, exif + 16); t.writeUInt32LE(7, exif + 18); t.writeUInt32LE(donnees + 20, exif + 22);
  t.writeUInt32LE(0, exif + 26);
  t.write(`${quand}\0`, donnees, 'latin1');
  t.write(`${fuseau}\0`, donnees + 20, 'latin1');
  const charge = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), t]);
  const tete = Buffer.alloc(4);
  tete.writeUInt16BE(0xffe1, 0);
  tete.writeUInt16BE(charge.length + 2, 2);
  return Buffer.concat([tete, charge]);
}
const JAPON = 'Voyages/Japon 2024';
video(`${JAPON}/Tokyo/IMG_0001.MOV`, {'com.apple.quicktime.creationdate': '2024-11-06T10:00:00+0900'}); // mercredi
video(`${JAPON}/Tokyo/IMG_0002.MOV`, {'com.apple.quicktime.creationdate': '2024-11-07T18:00:00+0900'}); // jeudi
video(`${JAPON}/Kyoto/IMG_0010.MOV`, {'com.apple.quicktime.creationdate': '2024-11-08T09:15:00+0900', 'com.apple.quicktime.location.ISO6709': '+35.0116+135.7681+050.000/'});
video(`${JAPON}/Kyoto/IMG_0011.MOV`, {'com.apple.quicktime.creationdate': '2024-11-08T16:40:00+0900'});
video(`${JAPON}/Kyoto/IMG_0013.MOV`, {'com.apple.quicktime.creationdate': '2024-11-09T11:00:00+0900'}); // samedi
// Android : l'heure universelle dans le fichier (jeudi 23 h 30), l'heure locale dans le nom (vendredi 8 h 30)
video(`${JAPON}/Kyoto/VID_20241108_083012.mp4`, {creation_time: '2024-11-07T23:30:12Z'});
// une photo : sa date et son fuseau dans l'EXIF
const jpg = dans(`${JAPON}/Kyoto/IMG_0012.JPG`);
ff(['-f', 'lavfi', '-i', 'testsrc=d=1:s=160x90', '-frames:v', '1', jpg]);
const brut = fs.readFileSync(jpg);
fs.writeFileSync(jpg, Buffer.concat([brut.subarray(0, 2), segmentExif('2024:11:08 12:30:00', '+09:00'), brut.subarray(2)]));
// un son : seulement l'heure universelle (vendredi 10 h UTC, soit 19 h au Japon)
const SON = dans(`${JAPON}/Osaka/ambiance.m4a`);
ff(['-f', 'lavfi', '-i', 'sine=d=1', '-c:a', 'aac', '-metadata', 'creation_time=2024-11-08T10:00:00Z', '-f', 'mp4', SON]);
// un fichier resté sur le Drive : une taille, aucun bloc (Google Drive le téléchargerait en le lisant)
const GOPR = dans(`${JAPON}/Kyoto/GOPR0099.MP4`);
fs.writeFileSync(GOPR, '');
fs.truncateSync(GOPR, 5e6);
fs.utimesSync(GOPR, new Date('2024-11-08T03:00:00Z'), new Date('2024-11-08T03:00:00Z'));
const CREUX = fs.statSync(GOPR).blocks === 0; // le disque de l'essai sait faire des fichiers creux (APFS, ext4…)
fs.writeFileSync(dans(`${JAPON}/Kyoto/GX010001.LRV`), 'doublon basse définition d’une GoPro');
video('Travail/Réunion/reunion.mp4', {creation_time: '2025-01-10T09:00:00Z'});
video('Profond/A/B/C/clip.mp4', {}, {son: false});
fs.writeFileSync(dans('Documents/notes.txt'), 'pas un média');
video('.cache/cache.mp4', {}, {son: false});
fs.symlinkSync(path.join(DRIVE, 'Voyages'), path.join(DRIVE, 'Voyages', 'boucle')); // un raccourci qui tourne en rond
const AILLEURS = path.join(T, 'ailleurs');
fs.mkdirSync(AILLEURS);
video('../../ailleurs/secret.mp4', {}, {son: false});
fs.symlinkSync(AILLEURS, path.join(DRIVE, 'Ailleurs')); // un raccourci qui sort du Drive
const avantOriginaux = new Map([GOPR, SON, jpg].map((f) => [f, {taille: fs.statSync(f).size, date: fs.statSync(f).mtimeMs}]));

// ——— le faux Claude, et lib/ia.mjs remplacé ———
const B = path.join(T, 'bouchons');
fs.mkdirSync(B, {recursive: true});
const FAUX = path.join(B, 'faux-claude.mjs');
const JOURNAL = path.join(T, 'journal.jsonl');
process.env.FAUX_JOURNAL = JOURNAL;
fs.writeFileSync(FAUX, `import fs from 'node:fs';
const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
let consigne = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { consigne += d; });
process.stdin.on('end', () => {
  fs.appendFileSync(process.env.FAUX_JOURNAL, JSON.stringify({args: process.argv.slice(2), cwd: process.cwd(), consigne}) + '\\n');
  out({type: 'system', subtype: 'init', session_id: 'faux', mcp_servers: []});
  let rep;
  if (/fichiers\\.json/.test(consigne)) {
    out({type: 'assistant', message: {content: [{type: 'tool_use', name: 'Read', input: {file_path: 'fichiers.json'}}]}});
    const j = JSON.parse(fs.readFileSync('fichiers.json', 'utf8'));
    rep = {fichiers: j.fichiers.filter((f) => /^vendredi/.test(f.jour)).map((f) => f.id), lieu: 'Kyoto', phrase: 'Tout le vendredi à Kyoto.', question: null};
  } else {
    out({type: 'assistant', message: {content: [{type: 'tool_use', name: 'Read', input: {file_path: 'arborescence.json'}}]}});
    JSON.parse(fs.readFileSync('arborescence.json', 'utf8'));
    rep = /islande/i.test(consigne) ? {dossiers: [], question: 'Je ne trouve aucun dossier sur l’Islande : où sont ces vidéos ?'}
      : {dossiers: ['Voyages/Japon 2024'], pourquoi: 'Le dossier du séjour au Japon.', question: null}; // sans « Mon Drive/ » : Dérush le retrouve
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
// jamais un autre programme que le faux Claude
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

const DM = await import(`${D}/lib/drive-medias.mjs`);
const {etatDrive} = await import(`${D}/lib/drive.mjs`);
const {Projet} = await import(`${D}/lib/projet.mjs`);
const {arreterEnfants} = await import(`${D}/lib/outils.mjs`);

const resultats = [];
const essai = async (nom, verifier) => {
  let bon = false;
  let dit = '';
  try { const r = await verifier(); bon = r === true; if (!bon) dit = JSON.stringify(r)?.slice(0, 600) ?? ''; } catch (e) { dit = `a levé : ${e.stack ?? e.message}`; }
  console.log(`${bon ? '✓' : '✗'} ${nom}${bon ? '' : `\n   ${dit}`}`);
  resultats.push(bon);
};
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
const attendre = async (cond, ms = 30000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) return false; await pause(50); } return true; };
const journal = () => { try { return fs.readFileSync(JOURNAL, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const sansCheminDeLordinateur = (x) => !JSON.stringify(x).includes(T) && !JSON.stringify(x).includes(COMPTE);

// les routes, appelées comme lib/serveur.mjs les appellera
class ErreurHttp extends Error { constructor(code, message) { super(message); this.code = code; } }
const taches = [];
const file = {attente: [], enCours: null, ecouteurs: new Set(), ajouter(nom, fn, meta) { taches.push({nom, meta}); return {id: taches.length}; }, etat: () => ({})};
const P = new Projet(path.join(BIBLIO, 'Vlog Japon'));
async function appeler(methode, chemin, corps = null) {
  const url = new URL(`http://127.0.0.1${chemin}`);
  const res = {};
  try {
    const repondu = await DM.routesDrive({method: methode, corps}, res, url.pathname, url, {file}, {
      envoyerJson: (r, code, data) => { r.code = code; r.data = JSON.parse(JSON.stringify(data)); },
      lireCorps: async (q) => q.corps ?? {}, ErreurHttp, projet: () => P,
    });
    return repondu ? {code: res.code, data: res.data} : {code: null};
  } catch (e) { return {code: e instanceof ErreurHttp ? e.code : 500, erreur: e.message}; }
}
const recherche = async () => (await appeler('GET', '/api/drive/chercher')).data;
const attendreRecherche = async (etats, ms = 30000) => {
  const t0 = Date.now();
  let e = await recherche();
  while (!etats.includes(e.etat) && Date.now() - t0 < ms) { await pause(50); e = await recherche(); }
  return e;
};
const R = (rel) => `Mon Drive/${rel}`;

// ——— 1. ce qui se lit sans rien ouvrir ———
await essai('une date dans le nom : Android, Pixel, capture d’écran du Mac, WhatsApp ; rien quand il n’y en a pas', () => {
  const v = (n) => DM.dateDuNom(n);
  return (v('VID_20241108_083012.mp4')?.l === '2024-11-08T08:30:12' && v('PXL_20241108_083012345.mp4')?.l === '2024-11-08T08:30:12'
    && v('Enregistrement de l’écran 2024-11-08 à 08.30.12.mov')?.l === '2024-11-08T08:30:12' && v('IMG-20241108-WA0001.jpg')?.heure === false
    && v('IMG_0012.JPG') === null && v('clip_20241332.mp4') === null && v('GX010123.MP4') === null) || ['VID', 'PXL', 'Écran', 'WA', 'IMG', '13e mois'].map((n, k) => [n, [v('VID_20241108_083012.mp4'), v('PXL_20241108_083012345.mp4'), v('Enregistrement de l’écran 2024-11-08 à 08.30.12.mov'), v('IMG-20241108-WA0001.jpg'), v('IMG_0012.JPG'), v('clip_20241332.mp4')][k]]);
});
await essai('l’EXIF d’une photo : sa date et son fuseau ; rien dans une photo sans EXIF ni dans des octets quelconques', () => {
  const e = DM.lireExif(fs.readFileSync(jpg));
  return (e?.l === '2024-11-08T12:30:00' && e?.z === 540 && e?.i === Date.parse('2024-11-08T03:30:00Z') && DM.lireExif(brut) === null && DM.lireExif(Buffer.from('nimportequoi')) === null) || e;
});
await essai('« va dans mon Drive, récupère les vidéos » se reconnaît ; « monte la vidéo » non', () => DM.parleDuDrive('Va dans mon Drive, récupère les vidéos du Japon') && DM.parleDuDrive('prends les rushs de mon séjour sur le drive') && !DM.parleDuDrive('monte la vidéo du vendredi') && !DM.parleDuDrive('le drive-in de Kyoto'));
await essai('la consigne Drive de l’IA de montage : un fichier précis se copie depuis drive/, des rushes en nombre passent par « Depuis mon Drive »', async () => {
  const {consigneDrive} = await import(`${D}/lib/drive.mjs`);
  const c = consigneDrive('claude');
  return (/un son ou une image précis qu’il te nomme, copie-le depuis `drive\/` \(des rushes en nombre : « Depuis mon Drive », plus bas\)/.test(c) && !/une image du Drive, copie-le/.test(c)) || c;
});
await essai('un document du Drive (le brief, le logo) n’est pas une recherche de rushes ; des vidéos avec un document, si ; une seule règle (lib/commun.mjs)', async () => {
  const C = await import(`${D}/lib/commun.mjs`);
  const non = ['Va chercher mon brief dans mon Google Drive, et monte la vidéo en suivant ce qui y est écrit.', 'prends le logo dans mon Drive', 'récupère ma charte graphique sur le Drive'];
  const oui = ['va chercher le script et les vidéos du tournage sur mon Drive', 'va dans mon Drive, prends la vidéo du temple'];
  return (DM.parleDuDrive === C.parleDuDrive && !non.some(DM.parleDuDrive) && oui.every(DM.parleDuDrive)) || [non.map(DM.parleDuDrive), oui.map(DM.parleDuDrive)];
});

// ——— 2. sans Google Drive pour ordinateur ———
process.env.DERUSH_DRIVE = path.join(T, 'nulle-part');
const sans = await appeler('GET', '/api/drive/medias');
const chercheSans = await appeler('POST', '/api/drive/chercher', {demande: 'mes vidéos'});
await essai('sans Google Drive pour ordinateur : un état clair, le lien officiel de Google, et la recherche refusée avec la même phrase', () =>
  (sans.code === 200 && sans.data.installe === false && sans.data.lien === 'https://www.google.com/drive/download/' && /Google Drive pour ordinateur/.test(sans.data.texte)
    && etatDrive().installer?.lien === sans.data.lien && chercheSans.code === 409 && /Google Drive pour ordinateur/.test(chercheSans.erreur)) || {sans, chercheSans});
process.env.DERUSH_DRIVE = DRIVE;

// ——— 3. le plan du Drive : sans rien lire ———
const plan = await DM.planDuDrive();
const rels = plan.fichiers.map((f) => f.rel).sort();
const attendus = [`${JAPON}/Kyoto/GOPR0099.MP4`, `${JAPON}/Kyoto/IMG_0010.MOV`, `${JAPON}/Kyoto/IMG_0011.MOV`, `${JAPON}/Kyoto/IMG_0012.JPG`, `${JAPON}/Kyoto/IMG_0013.MOV`, `${JAPON}/Kyoto/VID_20241108_083012.mp4`,
  `${JAPON}/Osaka/ambiance.m4a`, `${JAPON}/Tokyo/IMG_0001.MOV`, `${JAPON}/Tokyo/IMG_0002.MOV`, 'Profond/A/B/C/clip.mp4', 'Travail/Réunion/reunion.mp4'].map(R).sort();
await essai('le plan : les vidéos, la photo et le son ; ni les fichiers cachés, ni les documents, ni les doublons GoPro, ni la boucle de raccourcis, ni ce qui sort du Drive', () =>
  JSON.stringify(rels) === JSON.stringify(attendus) || rels);
await essai('le plan compte par genre et par dossier, sous-dossiers compris', () => {
  const s = plan.stats.get(R(JAPON));
  return (s?.n === 9 && s.videos === 7 && s.photos === 1 && s.sons === 1 && s.ici === 0 && plan.stats.get(R(`${JAPON}/Kyoto`))?.ici === 6) || s;
});
await essai(`un fichier resté sur le Drive se reconnaît sans l’ouvrir (aucun bloc sur le disque)${CREUX ? '' : ' — disque sans fichiers creux : vérifié à moitié'}`, () => {
  const g = plan.parRel.get(R(`${JAPON}/Kyoto/GOPR0099.MP4`));
  return ((CREUX ? g?.local === false : g?.local !== null) && plan.fichiers.filter((f) => f !== g).every((f) => f.local === true)) || plan.fichiers.map((f) => [f.nom, f.local]);
});
await essai('faire le plan n’a lu aucun fichier (pas une seule lecture : Google Drive n’a rien téléchargé)', () => DM.lecturesFaites() === 0 || DM.lecturesFaites());
await essai('le plan est gardé quelques minutes, et refait quand on le demande', async () => (await DM.planDuDrive()) === plan && (await DM.planDuDrive({force: true})) !== plan);
const profond = await DM.planDuDrive({force: true, limites: {profondeur: 2}});
const petit = await DM.planDuDrive({force: true, limites: {fichiers: 3}});
await essai('le plan est borné : en profondeur (et le dit), en nombre de fichiers (et le dit)', () =>
  (!profond.parRel.has(R('Profond/A/B/C/clip.mp4')) && profond.partiel === 'profondeur' && petit.partiel === 'fichiers' && petit.fichiers.length < 11 && !!petit.texte_partiel) || {p: profond.partiel, f: petit.partiel, n: petit.fichiers.length});
DM.oublierPlan();

// ——— 4. le choix à la main : parcourir par dossier et par jour ———
const racine = await appeler('GET', '/api/drive/medias');
const japon = await appeler('GET', `/api/drive/medias?dossier=${encodeURIComponent(R(JAPON))}`);
const vendrediNom = await appeler('GET', `/api/drive/medias?dossier=${encodeURIComponent(R(JAPON))}&jour=2024-11-08`);
await essai('parcourir : les racines, puis un dossier (ses sous-dossiers, ses jours), sans aucun chemin de l’ordinateur', () =>
  (racine.data?.installe === true && racine.data.sous_dossiers.map((x) => x.rel).join() === 'Mon Drive' && japon.code === 200
    && japon.data.sous_dossiers.map((x) => x.nom).join() === 'Kyoto,Osaka,Tokyo' && japon.data.jours.length > 0 && japon.data.comptes.n === 9 && sansCheminDeLordinateur([racine, japon])) || {racine, japon});
await essai('par jour, avant toute lecture : la date du nom d’une vidéo Android suffit à la ranger au vendredi', () =>
  (vendrediNom.data?.fichiers.some((f) => f.nom === 'VID_20241108_083012.mp4' && f.date.source === 'nom') && vendrediNom.data.fichiers.every((f) => f.date.jour === '2024-11-08')) || vendrediNom.data?.fichiers);
const hors = await appeler('GET', `/api/drive/medias?dossier=${encodeURIComponent('Mon Drive/../..')}`);
const jourFaux = await appeler('GET', `/api/drive/medias?dossier=${encodeURIComponent(R(JAPON))}&jour=vendredi`);
await essai('un dossier qui n’est pas dans le Drive, un jour illisible : refusés', () => (hors.code === 404 && jourFaux.code === 400) || {hors, jourFaux});

// ——— 5. la recherche par l'IA ———
const avantRecherche = await recherche();
await essai('avant toute recherche, l’état dit déjà ce qui partira chez l’IA (la phrase de « Chercher » vient du serveur)', () => (avantRecherche?.etat === 'aucune' && /jamais les fichiers eux-mêmes/.test(avantRecherche.a_savoir ?? '')) || avantRecherche);
const vide = await appeler('POST', '/api/drive/chercher', {demande: '  '});
await essai('une recherche sans demande est refusée avec une phrase qui aide', () => (vide.code === 400 && /Écris ce que tu cherches/.test(vide.erreur)) || vide);
const DEMANDE = 'Va dans mon Drive, prends les vidéos de mon séjour au Japon et fais-moi un vlog du vendredi';
const lance = await appeler('POST', '/api/drive/chercher', {demande: DEMANDE});
const deux = await appeler('POST', '/api/drive/chercher', {demande: DEMANDE});
await essai('la recherche part tout de suite, une seule à la fois', () => (lance.code === 200 && ['plan', 'ia_dossiers'].includes(lance.data.etat) && /jamais les fichiers/.test(lance.data.a_savoir) && deux.code === 409) || {lance, deux});
let e = await attendreRecherche(CREUX ? ['a_confirmer', 'erreur'] : ['pret', 'erreur']);
const IA_DOSSIER = path.join(SUPPORT, 'drive', 'ia');
const arbo = fs.readFileSync(path.join(IA_DOSSIER, 'arborescence.json'), 'utf8');
await essai('l’IA reçoit le plan résumé du Drive : les dossiers, leurs comptes et leurs jours, sans un seul chemin de l’ordinateur, sans ce qui n’est pas un média', () => {
  const j = JSON.parse(arbo);
  const k = j.dossiers.find((x) => x.chemin === R(`${JAPON}/Kyoto`));
  return (k?.videos === 5 && k.photos === 1 && k.exemples.length > 0 && j.dossiers.some((x) => x.chemin === R(JAPON)) && !arbo.includes(T) && !/secret|notes\.txt|cache\.mp4|boucle/.test(arbo)) || j;
});
const premier = journal()[0];
await essai('l’IA légère : le niveau rapide (Sonnet), aucun connecteur, seulement lire et écrire sa réponse, dans son dossier à elle', () =>
  (premier && premier.args.join(' ').includes('--model claude-sonnet-5-5') && premier.args.includes('--strict-mcp-config') && !premier.args.includes('Bash') && !premier.args.includes('WebSearch')
    && premier.args.slice(premier.args.indexOf('--tools') + 1).join(' ') === 'Read Write Skill' && fs.realpathSync(premier.cwd) === fs.realpathSync(IA_DOSSIER) && premier.consigne.includes(DEMANDE)) || premier);
if (CREUX) {
  await essai('avant de lire les dates : la personne voit combien de fichiers Google Drive devra télécharger, et rien n’est lu avant son oui', () =>
    (e.etat === 'a_confirmer' && e.confirmer.en_ligne === 1 && e.confirmer.taille_en_ligne === 5e6 && e.confirmer.fichiers === 9 && /télécharger/.test(e.confirmer.texte)
      && e.dossiers.join() === R(JAPON) && DM.lecturesFaites() === 0) || {e, lectures: DM.lecturesFaites()});
  await essai('… au singulier pour un seul fichier (« son jour », « le télécharger »)', () =>
    (/^1 fichier n’est que sur le Drive/.test(e.confirmer?.texte) && /lire son jour et son heure/.test(e.confirmer.texte) && /va le télécharger/.test(e.confirmer.texte) && !/\bleur\b/.test(e.confirmer.texte)) || e.confirmer?.texte);
  await appeler('POST', '/api/drive/chercher/continuer', {lire: true});
  e = await attendreRecherche(['pret', 'erreur', 'question']);
}
const choix = e.choix;
const ordre = ['VID_20241108_083012.mp4', 'IMG_0010.MOV', 'GOPR0099.MP4', 'IMG_0012.JPG', 'IMG_0011.MOV', 'ambiance.m4a'];
await essai('l’IA choisit les fichiers du vendredi du séjour, rangés dans l’ordre de prise de vue', () =>
  (e.etat === 'pret' && JSON.stringify(choix.fichiers.map((f) => f.nom)) === JSON.stringify(ordre)) || {etat: e.etat, erreur: e.erreur, noms: choix?.fichiers.map((f) => [f.nom, f.date?.quand])});
await essai('la phrase qui résume le choix : combien, quel jour, où, combien de Go', () =>
  /^4 vidéos, 1 photo et 1 son du vendredi 8 novembre, Kyoto, [\d,]+ (Mo|Go)$/.test(choix?.resume ?? '') || choix?.resume);
const par = new Map((choix?.fichiers ?? []).map((f) => [f.nom, f.date]));
await essai('les vraies heures locales : iPhone (fuseau écrit), Android (fuseau déduit de son nom), son (fuseau du séjour), photo (EXIF), fichier resté sur le Drive (date du fichier)', () =>
  (par.get('IMG_0010.MOV')?.quand === '2024-11-08 09:15' && par.get('IMG_0010.MOV').sur === 'connu' && par.get('VID_20241108_083012.mp4')?.quand === '2024-11-08 08:30' && par.get('VID_20241108_083012.mp4').sur === 'deduit'
    && par.get('ambiance.m4a')?.quand === '2024-11-08 19:00' && par.get('ambiance.m4a').fuseau === '+09:00' && par.get('IMG_0012.JPG')?.quand === '2024-11-08 12:30'
    && par.get('GOPR0099.MP4')?.source === 'fichier' && par.get('GOPR0099.MP4').quand === '2024-11-08 12:00') || [...par.entries()]);
const listeIA = fs.readFileSync(path.join(IA_DOSSIER, 'fichiers.json'), 'utf8');
await essai('l’IA reçoit les fichiers un par ligne, avec le jour, l’heure, le fuseau et d’où vient la date ; sans chemin de l’ordinateur', () => {
  const j = JSON.parse(listeIA);
  return (j.fichiers.length === 9 && listeIA.split('\n').length > 9 && j.jours.some((x) => x.jour === 'vendredi 8 novembre 2024' && x.videos === 4)
    && j.fichiers.some((f) => f.nom === 'IMG_0010.MOV' && f.quand === '2024-11-08 09:15 +09:00' && f.sur === 'prise' && f.gps === '35.01,135.77') && !listeIA.includes(T) && sansCheminDeLordinateur(e)) || j;
});
const lectures1 = DM.lecturesFaites();
await essai(`les dates lues sont gardées : ${lectures1} lectures pour 9 fichiers, rangées dans le dossier de Dérush`, () => {
  const c = JSON.parse(fs.readFileSync(path.join(SUPPORT, 'drive', 'dates.json'), 'utf8'));
  return (lectures1 === 9 && Object.keys(c).length === 8) || {lectures1, c: Object.keys(c)};
});
// la même recherche : rien n'est relu (et, pour le fichier resté sur le Drive, la personne choisit de s'en passer)
await appeler('POST', '/api/drive/chercher', {demande: DEMANDE});
e = await attendreRecherche(['a_confirmer', 'pret', 'erreur']);
if (e.etat === 'a_confirmer') { await appeler('POST', '/api/drive/chercher/continuer', {lire: false}); e = await attendreRecherche(['pret', 'erreur']); }
await essai('une deuxième recherche ne relit rien : le cache par fichier (chemin, taille, date) répond', () => (e.etat === 'pret' && DM.lecturesFaites() === lectures1 + (CREUX ? 0 : 1) && e.choix.n === 6) || {e: e.etat, lectures: DM.lecturesFaites()});
// une question plutôt qu'une devinette
await appeler('POST', '/api/drive/chercher', {demande: 'fais-moi un vlog de mon voyage en Islande'});
e = await attendreRecherche(['question', 'pret', 'erreur']);
await essai('rien ne correspond : l’IA pose une question au lieu de deviner, et rien n’est lu', () => (e.etat === 'question' && /Islande/.test(e.question) && DM.lecturesFaites() === lectures1 + (CREUX ? 0 : 1)) || e);
// « Arrêter » pendant que la personne réfléchit
if (CREUX) {
  await appeler('POST', '/api/drive/chercher', {demande: DEMANDE});
  const attente = await attendreRecherche(['a_confirmer', 'erreur']);
  const occupe = DM.driveOccupe();
  // elle écrit autre chose au lieu de répondre : la nouvelle recherche remplace celle qui attendait
  const remplace = await appeler('POST', '/api/drive/chercher', {demande: `${DEMANDE}, à Kyoto`});
  e = await attendreRecherche(['a_confirmer', 'erreur']);
  await essai('une recherche qui attend la réponse de la personne n’occupe pas Dérush, et une nouvelle demande la remplace', () =>
    (attente.etat === 'a_confirmer' && occupe === false && remplace.code === 200 && e.etat === 'a_confirmer' && /Kyoto/.test(e.demande)) || {attente: attente.etat, occupe, remplace, e: e.etat});
  const stop = await appeler('POST', '/api/drive/chercher/arreter');
  const apres = await recherche();
  await pause(300);
  await essai('« Arrêter » pendant la question des téléchargements : la recherche s’arrête, rien n’est lu', async () =>
    (e.etat === 'a_confirmer' && stop.data?.ok === true && apres.etat === 'arrete' && (await recherche()).etat === 'arrete' && DM.lecturesFaites() === lectures1) || {e: e.etat, stop, apres});
}
const lancementsIA = journal().length;
const lectures2 = DM.lecturesFaites();
// le choix à la main : lire les vraies dates d'un dossier, sans IA
await appeler('POST', '/api/drive/chercher', {dossiers: [R(`${JAPON}/Tokyo`)], sans_ia: true});
e = await attendreRecherche(['dates_lues', 'erreur']);
const tokyo = await appeler('GET', `/api/drive/medias?dossier=${encodeURIComponent(R(`${JAPON}/Tokyo`))}`);
await essai('à la main, sans IA : les dates d’un dossier se lisent (déjà gardées : rien n’est relu), aucune IA lancée', () =>
  (e.etat === 'dates_lues' && e.choix.n === 2 && journal().length === lancementsIA && DM.lecturesFaites() === lectures2
    && tokyo.data.fichiers.map((f) => `${f.nom} ${f.date.quand} ${f.date.source}`).join(' | ') === 'IMG_0001.MOV 2024-11-06 10:00 prise | IMG_0002.MOV 2024-11-07 18:00 prise') || {e, tokyo: tokyo.data?.fichiers});

// ——— 6. l'import dans le projet ———
const rushes = choix.fichiers.map((f) => f.rel);
const apercu = await appeler('POST', '/api/drive/importer/apercu', {fichiers: rushes});
await essai('avant d’importer : combien de fichiers, combien de Go, ce qui reste à télécharger, la place libre', () =>
  (apercu.code === 200 && apercu.data.n === 6 && apercu.data.nouveaux === 6 && apercu.data.taille === choix.taille && apercu.data.en_ligne.n === (CREUX ? 1 : 0) && /6 fichiers à importer/.test(apercu.data.resume)
    // la vraie place de ce disque : refusé sous 1,5 Go restants (un essai ne dépend pas de la place de l'ordinateur : l'import ci-dessous la donne)
    && apercu.data.ok === (apercu.data.libre - apercu.data.taille >= 1.5 * 1024 ** 3)) || apercu);
const PLACE = () => 100 * 1024 ** 3;
await essai('pas assez de place : refusé, avec la règle (1,5 Go doivent rester), ce qui reste et ce que prennent les fichiers', async () => {
  const a = await DM.apercuImport(P, rushes, {lire: () => 1e9});
  let refus = null;
  try { await DM.lancerImport(P, rushes, file, {lire: () => 1e9}); } catch (x) { refus = x; }
  return (a.ok === false && /^Il doit rester au moins 1,5 Go sur le disque du projet après l’import : il en reste 1 Go, et ces fichiers prennent [\d,]+ (Ko|Mo)\./.test(a.texte) && refus?.code === 507 && !fs.existsSync(path.join(P.racine, 'rushes'))) || {a, refus: refus?.message};
});
const hors1 = await appeler('POST', '/api/drive/importer', {fichiers: ['Mon Drive/../ailleurs/secret.mp4']});
const hors2 = await appeler('POST', '/api/drive/importer', {fichiers: ['Mon Drive/Ailleurs/secret.mp4']});
const doc = await appeler('POST', '/api/drive/importer', {fichiers: ['Mon Drive/Documents/notes.txt']});
await essai('rien ne s’importe hors du Drive (« .. », raccourci qui en sort) ni ce qui n’est pas un média', () => (hors1.code === 404 && hors2.code === 404 && doc.code === 404 && !fs.existsSync(path.join(P.racine, 'rushes'))) || {hors1, hors2, doc});
let imp;
try { imp = {code: 200, data: await DM.lancerImport(P, rushes, file, {lire: PLACE})}; } catch (x) { imp = {code: x.code, erreur: x.message}; }
const pendant = await appeler('GET', '/api/drive/importer');
await attendre(() => DM.etatImport().etat !== 'en_cours', 60000);
const fin = DM.etatImport();
await essai('l’import : copié dans rushes/ du projet, ajouté aux médias dans l’ordre de prise de vue, préparation lancée', () =>
  (imp.code === 200 && imp.data.etat === 'en_cours' && pendant.data?.n === 6 && fin.etat === 'fini' && fin.ajoutes.length === 5 && JSON.stringify(P.d.medias.map((m) => m.nom)) === JSON.stringify(['VID_20241108_083012.mp4', 'IMG_0010.MOV', 'IMG_0012.JPG', 'IMG_0011.MOV', 'ambiance.m4a'])
    && P.d.medias.every((m) => path.dirname(m.chemin) === path.join(P.racine, 'rushes')) && taches.filter((t) => t.meta?.type === 'preparation').length === 5 && fin.octets === fin.taille) || {imp, fin, medias: P.d.medias.map((m) => m.nom)});
await essai('un fichier illisible (le faux fichier resté sur le Drive) : dit dans l’import, et sa copie effacée ; aucun morceau de copie qui traîne', () =>
  (fin.erreurs.length === 1 && /GOPR0099/.test(fin.erreurs[0]) && !fs.readdirSync(path.join(P.racine, 'rushes')).some((n) => /GOPR|derush-part/.test(n))) || {erreurs: fin.erreurs, rushes: fs.readdirSync(path.join(P.racine, 'rushes'))});
await essai('les fichiers du Drive ne sont pas touchés ; la copie garde la date d’origine', () => {
  const copie = fs.statSync(path.join(P.racine, 'rushes', 'IMG_0012.JPG'));
  return ([...avantOriginaux].every(([f, a]) => fs.statSync(f).size === a.taille && fs.statSync(f).mtimeMs === a.date) && copie.size === fs.statSync(jpg).size && Math.abs(copie.mtimeMs - fs.statSync(jpg).mtimeMs) < 1000)
    || [...avantOriginaux].map(([f, a]) => [path.basename(f), a, fs.statSync(f).size]);
});
// le projet fermé pendant l'import : plus rien n'y est écrit
await DM.lancerImport(P, [R(`${JAPON}/Tokyo/IMG_0001.MOV`)], file, {lire: PLACE, encoreOuvert: () => false});
await attendre(() => DM.etatImport().etat !== 'en_cours', 20000);
const ferme = DM.etatImport();
await essai('le projet fermé pendant l’import : l’import s’arrête et n’y écrit plus rien', () =>
  (ferme.etat === 'erreur' && /projet a été fermé/.test(ferme.erreurs[0]) && P.d.medias.length === 5 && !fs.existsSync(path.join(P.racine, 'rushes', 'IMG_0001.MOV'))) || ferme);
await DM.lancerImport(P, rushes, file, {lire: PLACE}).catch((x) => console.log(`   (second import refusé : ${x.message})`));
await attendre(() => DM.etatImport().etat !== 'en_cours', 60000);
const encore = DM.etatImport();
await essai('importer deux fois la même chose : rien n’est copié deux fois, aucun média en double', () =>
  (encore.deja === 5 && encore.ajoutes.length === 0 && P.d.medias.length === 5 && fs.readdirSync(path.join(P.racine, 'rushes')).filter((n) => !n.startsWith('.')).length === 5) || {encore, n: P.d.medias.length});
await essai('les routes de « Depuis mon Drive » laissent passer celles du serveur (/api/drive, « Envoyer sur mon Drive »)', async () =>
  (await appeler('GET', '/api/drive')).code === null && (await appeler('POST', '/api/drive/envoyer', {})).code === null && (await appeler('GET', '/api/drive/inconnue')).code === null);
await essai('plus rien en route : Dérush peut se fermer ou se mettre à jour', () => DM.driveOccupe() === false);

// la fin : les préparations légères lancées par l'import finissent avant l'effacement (seul le dossier de l'essai part)
await attendre(() => P.d.medias.every((m) => m.type !== 'video' || m.etapes?.ondes !== undefined), 20000);
arreterEnfants();
await pause(400);
const tousBons = resultats.every(Boolean);
if (tousBons) fs.rmSync(T, {recursive: true, force: true});
await essai('le dossier donné n’a rien perdu : seul le dossier d’essai créé dedans est effacé', () => path.dirname(T) === parent && dejaLa.every((n) => fs.existsSync(path.join(parent, n))) && (!tousBons || !fs.existsSync(T)));
console.log(`\n${resultats.filter(Boolean).length} essais réussis sur ${resultats.length}`);
if (!resultats.every(Boolean)) console.log(`Dossier d’essai gardé : ${T}`);
process.exit(resultats.every(Boolean) ? 0 : 1);
