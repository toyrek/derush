// Dérush — les essais du serveur local (pour qui modifie lib/serveur.mjs) : ce qui ne doit plus jamais le faire tomber
// (une erreur du système dans une route, une copie coupée, un fichier illisible), les fichiers servis (plus aucun
// fichier laissé ouvert), la recherche d'un fichier glissé (qui ne fige plus le serveur), la corbeille (jamais les
// fichiers de la personne, jamais pendant un travail), les notes et le carnet, le lien d'une publication, l'aperçu des
// couleurs, la page (jamais dans un cadre, la clé de la fenêtre, seuls ses scripts), Gemini dans Connexions, l'espace
// d'un projet changé depuis la bibliothèque, les dossiers dont on ne fait pas un projet, « ?force= » de Connexions,
// et le branchement des trois nouveautés (« Depuis mon Drive », la voix off, les vidéos d'un projet) : leurs routes
// répondent, leurs gardes tiennent. Le Drive est un faux dossier (DERUSH_DRIVE), absent : « pas de Drive ».
//   node outils/essai-serveur.mjs [dossier où créer le dossier d'essai]
// Aucune IA, aucun appel réel, aucune clé : le vrai code de lib/ sur un dossier de Dérush, une bibliothèque ET un
// dossier personnel jetables (DERUSH_SUPPORT, DERUSH_BIBLIOTHEQUE, HOME) : la corbeille d'essai est donc dans le
// dossier d'essai, et la recherche « à pied » ne fouille que lui. Rien n'est lu ni écrit dans la vraie installation.
// Jamais /api/connexions/maj/installer hors travail (il mettrait Dérush à jour), ni une vraie action de Gemini.
// L'aperçu des couleurs demande FFmpeg (sauté sinon). Le dossier d'essai est effacé à la fin, sauf en cas d'échec.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
if (/^-/.test(process.argv[2] ?? '')) { console.log(`Usage : node ${path.relative(process.cwd(), process.argv[1])} [dossier temporaire]`); process.exit(0); }
const parent = path.resolve(process.argv[2] ?? os.tmpdir());
fs.mkdirSync(parent, {recursive: true});
const T = fs.mkdtempSync(path.join(fs.realpathSync(parent), 'derush-essai-serveur-'));
// AVANT tout import de lib/ : le dossier de Dérush, la bibliothèque et le dossier personnel sont lus au chargement
const SUPPORT = path.join(T, 'support');
const BIBLIO = path.join(T, 'bibliotheque');
const MAISON = path.join(T, 'maison');
for (const d of [SUPPORT, BIBLIO, path.join(MAISON, 'Documents')]) fs.mkdirSync(d, {recursive: true});
process.env.DERUSH_SUPPORT = SUPPORT; // « = », jamais « ??= »
process.env.DERUSH_BIBLIOTHEQUE = BIBLIO;
process.env.DERUSH_SANS_MAJ = '1';
process.env.DERUSH_SANS_NAVIGATEUR = '1';
process.env.DERUSH_DRIVE = path.join(T, 'pas-de-drive'); // jamais le Drive de l'ordinateur ; absent : « pas de Drive »
process.env.HOME = MAISON;
process.env.USERPROFILE = MAISON;
process.env.TMPDIR = path.join(T, 'tmp');
fs.mkdirSync(process.env.TMPDIR, {recursive: true});
delete process.env.TREG_TOKEN; // jamais la vraie clé
if (os.homedir() !== MAISON) { console.error('Le dossier personnel d’essai n’est pas pris en compte : essais abandonnés.'); process.exit(1); }

// une erreur que personne n'attrape faisait tomber Dérush : ici elle est comptée, et l'essai le dit
const tombes = [];
process.on('unhandledRejection', (e) => tombes.push(e));
process.on('uncaughtException', (e) => tombes.push(e));
// ce que le serveur écrit dans son journal (les erreurs du système y vont en détail) : gardé ici, pas affiché
const journal = [];
console.error = (...a) => { journal.push(a.map((x) => String(x?.message ?? x)).join(' ')); };

const lib = (m) => import(pathToFileURL(path.join(D, 'lib', m)).href);
const E = await lib('espaces.mjs');
const F = await lib('fiches.mjs');
const Su = await lib('suivi.mjs');
const K = await lib('carnet.mjs');
const B = await lib('bibliotheque.mjs');
const {Projet} = await lib('projet.mjs');
const {FileDAttente, FFMPEG} = await lib('outils.mjs');
const {demarrerServeur, cleFenetre, forceDemandee} = await lib('serveur.mjs');
const SOURCE = fs.readFileSync(path.join(D, 'lib', 'serveur.mjs'), 'utf8');

let bons = 0;
let total = 0;
function essai(quoi, vrai, detail = '') {
  total++; if (vrai) bons++;
  console.log(`${vrai ? '  ✓' : '  ✗'} ${quoi}${vrai || !detail ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)?.slice(0, 400)}`}`);
}
const titre = (t) => console.log(`\n${t}`);
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
const empreinte = (b) => crypto.createHash('sha1').update(b).digest('hex').slice(0, 10);
const CORBEILLE = path.join(MAISON, '.Trash');
/** Tout ce qu'il y a dans la corbeille d'essai (Mac : .Trash ; Linux : .local/share/Trash/files), chemins relatifs. */
function dansLaCorbeille() {
  const r = [];
  const tour = (d, pre = '') => { let es = []; try { es = fs.readdirSync(d, {withFileTypes: true}); } catch { return; } for (const e of es) { r.push(pre + e.name); if (e.isDirectory()) tour(path.join(d, e.name), `${pre}${e.name}/`); } };
  tour(CORBEILLE);
  tour(path.join(MAISON, '.local', 'share', 'Trash', 'files'));
  return r;
}
/** Les fichiers que ce programme tient ouverts (Mac, Linux), ou null si on ne sait pas les compter. */
const ouvertsIci = () => { for (const d of ['/proc/self/fd', '/dev/fd']) { try { return fs.readdirSync(d).length; } catch { /* pas ce système */ } } return null; };

let serveur = null;
let serveur2 = null;
try {
  const nouveauCtx = () => {
    const ctx = {P: null, file: new FileDAttente(), app: false, natif: false,
      ouvrir(d, t) { const P = new Projet(d); if (t && !fs.existsSync(path.join(P.racine, '.derush'))) { P.d.titre = t; P.sauver(); } ctx.P = P; B.noterRecent(P.racine); return P; },
      fermer() { ctx.P = null; }};
    return ctx;
  };
  const ctx = nouveauCtx();
  ({serveur} = await demarrerServeur(ctx, {port: 0}));
  const PORT = serveur.address().port;
  const base = `http://127.0.0.1:${PORT}`;
  const pageAccueil = await fetch(`${base}/`);
  const jeton = /name="derush-jeton" content="([^"]+)"/.exec(await pageAccueil.text())?.[1];
  const FENETRE = 'essai';
  const api = async (methode, p, corps) => {
    const r = await fetch(`${base}${p}`, {method: methode, headers: {'x-derush-jeton': jeton, 'x-derush-fenetre': FENETRE, ...(corps !== undefined ? {'content-type': 'application/json'} : {})}, body: corps !== undefined ? JSON.stringify(corps) : undefined});
    return {code: r.status, j: await r.json().catch(() => null)};
  };
  const vivant = async () => { try { return (await (await fetch(`${base}/api/ping`, {signal: AbortSignal.timeout(3000)})).json()).derush === true; } catch { return false; } };
  /** Une requête écrite à la main : des en-têtes, un début de corps, puis la coupure (ou l'attente de la réponse). */
  const brute = ({methode = 'POST', chemin, entetes = {}, debut = null, couper = true, entier = false, attente = 250}) => new Promise((ok) => {
    const req = http.request({host: '127.0.0.1', port: PORT, method: methode, path: chemin, headers: {'x-derush-jeton': jeton, 'x-derush-fenetre': FENETRE, ...entetes}});
    let fini = false;
    const rendre = (x) => { if (!fini) { fini = true; ok(x); } };
    req.on('error', () => rendre({code: 0, coupe: true}));
    req.on('response', (res) => { let t = ''; res.on('data', (d) => { t += d; }); res.on('end', () => { let j = null; try { j = JSON.parse(t); } catch { /* pas du JSON */ } rendre({code: res.statusCode, j}); req.destroy(); }); res.on('error', () => rendre({code: res.statusCode, coupe: true})); });
    if (entier) req.end(debut);
    else if (debut) req.write(debut);
    if (entier) setTimeout(() => { req.destroy(); rendre({code: 0, muet: true}); }, 8000);
    else if (couper) setTimeout(() => { req.destroy(); setTimeout(() => rendre({code: 0, coupe: true}), 150); }, attente);
    else setTimeout(() => { req.destroy(); rendre({code: 0, muet: true}); }, 4000);
  });

  // ————————————————————————————————————————————————————————————————————————————————
  titre('La page : jamais dans un cadre');
  essai('GET / : la page, avec le jeton, et l’interdiction d’être mise dans un cadre', pageAccueil.status === 200 && !!jeton && pageAccueil.headers.get('x-frame-options') === 'DENY' && /frame-ancestors 'none'/.test(pageAccueil.headers.get('content-security-policy') ?? ''), [pageAccueil.status, Object.fromEntries(pageAccueil.headers)]);
  let r = await fetch(`${base}/`, {headers: {'sec-fetch-dest': 'iframe', 'sec-fetch-site': 'cross-site'}});
  let corps = await r.text();
  essai('demandée comme le cadre d’un autre site : refusée, sans le jeton', r.status === 403 && !corps.includes(jeton) && !/derush-jeton/.test(corps), [r.status, corps.slice(0, 80)]);
  essai('… et seuls les scripts servis par Dérush s’y exécutent (script-src \'self\', en plus de la balise de la page)', /script-src 'self'/.test(pageAccueil.headers.get('content-security-policy') ?? ''), pageAccueil.headers.get('content-security-policy'));
  essai('le serveur ne coupe plus un envoi de plus de 5 minutes (requestTimeout à 0)', serveur.requestTimeout === 0, serveur.requestTimeout);

  titre('La clé de la fenêtre (quand le lanceur la donne)');
  const cle = cleFenetre();
  const fichierCle = path.join(SUPPORT, 'cle-fenetre');
  essai('cleFenetre : 48 signes, la même à chaque appel, rangée dans le dossier de Dérush pour la personne seule', /^[a-f0-9]{48}$/.test(cle) && cleFenetre() === cle && fs.readFileSync(fichierCle, 'utf8') === cle && (process.platform === 'win32' || (fs.statSync(fichierCle).mode & 0o777) === 0o600), (fs.statSync(fichierCle).mode & 0o777).toString(8));
  fs.writeFileSync(fichierCle, 'abîmée');
  const refaite = cleFenetre();
  essai('une clé abîmée est refaite', /^[a-f0-9]{48}$/.test(refaite) && refaite !== cle && fs.readFileSync(fichierCle, 'utf8') === refaite);
  const ctx2 = nouveauCtx();
  ({serveur: serveur2} = await demarrerServeur(ctx2, {port: 0, cle: refaite}));
  const base2 = `http://127.0.0.1:${serveur2.address().port}`;
  r = await fetch(`${base2}/`);
  corps = await r.text();
  const r2 = await fetch(`${base2}/?c=${'0'.repeat(48)}`);
  const corps2 = await r2.text();
  const r3 = await fetch(`${base2}/?c=${refaite}`);
  const corps3 = await r3.text();
  essai('avec la clé : la page sans clé ou avec une mauvaise clé n’a pas le jeton ; avec la bonne, si', r.status === 403 && !/derush-jeton/.test(corps) && /depuis son icône/.test(corps) && r2.status === 403 && !/derush-jeton/.test(corps2) && r3.status === 200 && /name="derush-jeton" content="[a-f0-9]{36}"/.test(corps3), [r.status, r2.status, r3.status]);
  r = await fetch(`${base2}/api/ping`).then((x) => x.json());
  essai('… et le reste répond comme avant (le signe de vie)', r.derush === true, r);
  serveur2.close(); serveur2 = null;

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Rien ne fait tomber le serveur');
  r = await api('POST', '/api/projets', {titre: 'Projet solide', espace: 'moi'});
  const P1 = ctx.P;
  essai('un projet d’essai est ouvert', r.code === 200 && !!P1, r);
  // 1. un dossier où l'on ne peut plus écrire (carte verrouillée, disque en lecture seule) : l'enregistrement échoue
  fs.chmodSync(P1.racine, 0o555);
  r = await api('PUT', '/api/projet', {titre: 'Projet solide, renommé'});
  fs.chmodSync(P1.racine, 0o755);
  const ecritureRefusee = !(process.getuid?.() === 0 || process.platform === 'win32'); // root et Windows écrivent quand même
  essai('enregistrer dans un dossier verrouillé : une erreur dite en français, pas un code du système (le détail va au journal)', !ecritureRefusee || (r.code === 500 && /droit d’écrire/.test(r.j?.erreur ?? '') && !/EACCES|EPERM/.test(r.j?.erreur ?? '') && journal.some((l) => /EACCES|EPERM/.test(l))), [r, journal.slice(-2)]);
  essai('… et Dérush est toujours là', await vivant() && tombes.length === 0, tombes.map((e) => String(e?.message ?? e)));
  r = await api('PUT', '/api/projet', {titre: 'Projet solide'});
  essai('… l’enregistrement suivant passe', r.code === 200, r);
  // 2. une requête coupée avant la fin de son corps (fenêtre fermée ou rechargée)
  await brute({chemin: '/api/reglages/interface', entetes: {'content-type': 'application/json', 'content-length': 200000}, debut: '{"tuto_vu": true, "bourrage": "'});
  await dormir(150);
  essai('une requête coupée en route : Dérush est toujours là', await vivant() && tombes.length === 0, tombes.map((e) => String(e?.message ?? e)));
  // 3. une copie de rush coupée en route
  const rushes = path.join(P1.racine, 'rushes');
  await brute({chemin: '/api/televerser?nom=gros-rush.mp4', entetes: {'content-type': 'application/octet-stream', 'content-length': 50e6}, debut: Buffer.alloc(300000, 7)});
  await dormir(300);
  essai('une copie de rush coupée en route : Dérush est toujours là', await vivant() && tombes.length === 0, tombes.map((e) => String(e?.message ?? e)));
  essai('… et le fichier à moitié copié ne reste pas dans rushes/', !fs.existsSync(rushes) || fs.readdirSync(rushes).length === 0, fs.existsSync(rushes) ? fs.readdirSync(rushes) : []);
  await brute({chemin: '/api/televerser?nom=charte.pdf&usage=reference', entetes: {'content-type': 'application/octet-stream', 'content-length': 50e6}, debut: Buffer.alloc(300000, 7)});
  await dormir(300);
  const refs = path.join(P1.racine, 'references');
  essai('une référence coupée en route : rien ne reste dans references/, et Dérush est toujours là', (!fs.existsSync(refs) || fs.readdirSync(refs).length === 0) && P1.d.references.length === 0 && await vivant() && tombes.length === 0, fs.existsSync(refs) ? fs.readdirSync(refs) : []);
  // une pièce jointe coupée en route (une capture collée, un fichier glissé sous Windows ou Linux, puis ⌘R)
  const piecesP1 = path.join(P1.racine, 'claude', 'pieces');
  await brute({chemin: '/api/claude/pieces/televerser?nom=capture.png', entetes: {'content-type': 'application/octet-stream', 'content-length': 50e6}, debut: Buffer.alloc(300000, 7)});
  await dormir(300);
  essai('une pièce jointe coupée en route : Dérush est toujours là, et rien ne reste dans ses pièces', await vivant() && tombes.length === 0 && (!fs.existsSync(piecesP1) || fs.readdirSync(piecesP1).length === 0), [tombes.map((e) => String(e?.message ?? e)), fs.existsSync(piecesP1) ? fs.readdirSync(piecesP1) : []]);
  r = await brute({chemin: '/api/claude/pieces/televerser?nom=film.mov', entetes: {'content-type': 'application/octet-stream', 'content-length': 9e15}, debut: Buffer.alloc(1000, 7), couper: false});
  essai('… une pièce jointe plus grosse que la place libre : refusée tout de suite (507)', r.code === 507 && /place/.test(r.j?.erreur ?? '') && (!fs.existsSync(piecesP1) || fs.readdirSync(piecesP1).length === 0), r);
  // 4. un fichier plus gros que la place libre : refusé avant de commencer
  r = await brute({chemin: '/api/televerser?nom=enorme.mov', entetes: {'content-type': 'application/octet-stream', 'content-length': 9e15}, debut: Buffer.alloc(1000, 7), couper: false});
  essai('un fichier plus gros que la place libre : refusé tout de suite (507), avec la raison', r.code === 507 && /place/.test(r.j?.erreur ?? '') && (!fs.existsSync(rushes) || fs.readdirSync(rushes).length === 0), r);
  // 5. une copie qui va au bout marche toujours (un fichier qui n'est pas un média est refusé après coup, et retiré)
  r = await brute({chemin: '/api/televerser?nom=notes.pdf&usage=reference', entetes: {'content-type': 'application/octet-stream', 'content-length': 5000}, debut: Buffer.alloc(5000, 65), entier: true});
  essai('une référence copiée jusqu’au bout : rangée dans references/, entière', r.code === 200 && r.j?.ajoutes?.length === 1 && fs.statSync(path.join(refs, 'notes.pdf')).size === 5000, r);
  // 6. un fichier qu'on peut voir mais pas lire, et un dossier à la place d'un fichier
  const illisible = path.join(T, 'illisible');
  fs.mkdirSync(path.join(illisible, '.derush'), {recursive: true});
  fs.writeFileSync(path.join(illisible, '.derush', 'affiche.jpg'), Buffer.alloc(40000, 1));
  fs.chmodSync(path.join(illisible, '.derush', 'affiche.jpg'), 0o000);
  await fetch(`${base}/affiche?j=${jeton}&dossier=${encodeURIComponent(illisible)}`).then((x) => x.arrayBuffer()).catch(() => null);
  await dormir(150);
  fs.chmodSync(path.join(illisible, '.derush', 'affiche.jpg'), 0o644);
  essai('servir un fichier illisible : Dérush est toujours là', await vivant() && tombes.length === 0, tombes.map((e) => String(e?.message ?? e)));
  const faux = path.join(T, 'faux-fichier');
  fs.mkdirSync(path.join(faux, '.derush', 'affiche.jpg'), {recursive: true});
  r = await fetch(`${base}/affiche?j=${jeton}&dossier=${encodeURIComponent(faux)}`);
  await r.arrayBuffer().catch(() => null);
  await dormir(100);
  essai('un dossier à la place d’un fichier : 404, et Dérush est toujours là', r.status === 404 && await vivant() && tombes.length === 0, [r.status, tombes.map((e) => String(e?.message ?? e))]);

  titre('Les fichiers servis : plus aucun fichier laissé ouvert');
  const lourd = path.join(T, 'lourd');
  fs.mkdirSync(path.join(lourd, '.derush'), {recursive: true});
  fs.writeFileSync(path.join(lourd, '.derush', 'affiche.jpg'), Buffer.alloc(8e6, 3));
  const lectureAbandonnee = () => new Promise((ok) => {
    const req = http.get({host: '127.0.0.1', port: PORT, path: `/affiche?j=${jeton}&dossier=${encodeURIComponent(lourd)}`, headers: {range: 'bytes=1000-'}}, (res) => { res.once('data', () => { req.destroy(); ok(res.statusCode); }); });
    req.on('error', () => ok(0));
  });
  const avantLectures = ouvertsIci();
  const codes = [];
  for (let k = 0; k < 40; k++) codes.push(await lectureAbandonnee());
  await dormir(600);
  const apresLectures = ouvertsIci();
  essai('40 lectures abandonnées en route (un saut dans une vidéo) : les fichiers sont refermés', codes.every((c) => c === 206) && (avantLectures == null || apresLectures - avantLectures <= 3), {avant: avantLectures, apres: apresLectures, codes: [...new Set(codes)]});
  r = await fetch(`${base}/affiche?j=${jeton}&dossier=${encodeURIComponent(lourd)}`, {headers: {range: 'bytes=100-199'}});
  const morceau = Buffer.from(await r.arrayBuffer());
  essai('une plage d’octets est toujours servie juste', r.status === 206 && morceau.length === 100 && r.headers.get('content-range') === 'bytes 100-199/8000000', [r.status, morceau.length, r.headers.get('content-range')]);

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Retrouver un fichier glissé, sans figer le serveur');
  essai('lib/serveur.mjs ne teste plus le système lui-même (process.platform) : la recherche marche aussi sous Windows et Linux', !/process\.platform/.test(SOURCE) && /!MAC \? fichiers\.map\(\(\) => null\)/.test(SOURCE));
  // un dossier personnel de 16 000 dossiers, et le fichier cherché tout au bout de l'exploration
  const docs = path.join(MAISON, 'Documents');
  for (let a = 0; a < 16; a++) for (let b = 0; b < 1000; b++) fs.mkdirSync(path.join(docs, `tournage-${String(a).padStart(2, '0')}`, `jour-${String(b).padStart(4, '0')}`), {recursive: true});
  const nomCherche = `rush-essai-${crypto.randomBytes(4).toString('hex')}.mov`;
  const cache = path.join(docs, 'tournage-15', 'jour-0999', nomCherche);
  fs.writeFileSync(cache, Buffer.alloc(4321, 9));
  const stCache = fs.statSync(cache);
  let pire = 0;
  let dernier = performance.now();
  const tic = setInterval(() => { const m = performance.now(); pire = Math.max(pire, m - dernier - 10); dernier = m; }, 10);
  const debutRecherche = performance.now();
  // (jamais la recherche d'un fichier absent ici : elle irait fouiller les vrais disques externes de la machine)
  r = await api('POST', '/api/localiser', {fichiers: [{nom: nomCherche, taille: stCache.size, modifie: stCache.mtimeMs}, {}]});
  const dureeRecherche = Math.round(performance.now() - debutRecherche);
  clearInterval(tic);
  essai('un fichier que Spotlight ne connaît pas est retrouvé « à pied » dans les dossiers habituels', r.code === 200 && r.j?.chemins?.length === 2 && !!r.j.chemins[0] && fs.realpathSync(r.j.chemins[0]) === fs.realpathSync(cache) && r.j.chemins[1] === null, r);
  essai(`… et pendant cette recherche (${dureeRecherche} ms), le serveur n’est jamais resté figé plus de 250 ms`, pire < 250, `${Math.round(pire)} ms de gel`);
  fs.rmSync(docs, {recursive: true, force: true});

  // ————————————————————————————————————————————————————————————————————————————————
  titre('La corbeille : jamais les fichiers de la personne, jamais pendant un travail');
  await ctx.file.vide();
  // un dossier de tournage, ouvert comme projet
  const tournage = path.join(T, 'tournages', 'Mariage');
  fs.mkdirSync(tournage, {recursive: true});
  for (const n of ['IMG_0001.MOV', 'IMG_0002.MOV']) fs.writeFileSync(path.join(tournage, n), Buffer.alloc(2000, 5));
  r = await api('POST', '/api/projets/ouvrir', {dossier: tournage});
  essai('un dossier de tournage ouvert comme projet : pas marqué comme un dossier de Dérush', r.code === 200 && fs.existsSync(path.join(tournage, 'derush.json')) && !fs.existsSync(path.join(tournage, '.derush', 'dossier-neuf')), r);
  await api('POST', '/api/projets/fermer');
  r = await api('POST', '/api/projets/corbeille', {dossier: tournage});
  let liste = (await api('GET', '/api/bibliotheque')).j?.projets ?? [];
  essai('« Corbeille » sur ce projet : les rushes d’origine restent à leur place, seul le projet s’en va', r.code === 200 && r.j?.garde === true && /restent à leur place/.test(r.j?.message ?? '') && fs.existsSync(path.join(tournage, 'IMG_0001.MOV')) && fs.existsSync(path.join(tournage, 'IMG_0002.MOV')) && !fs.existsSync(path.join(tournage, 'derush.json')) && fs.readdirSync(tournage).every((n) => /^IMG_/.test(n)), [r, fs.existsSync(tournage) ? fs.readdirSync(tournage) : 'dossier parti']);
  essai('… le montage est dans la corbeille (récupérable), et le projet n’est plus dans la bibliothèque', dansLaCorbeille().some((n) => /^Projet Dérush - Mariage\/derush\.json$/.test(n)) && !liste.some((x) => x.dossier === tournage), dansLaCorbeille());
  // un projet de la bibliothèque : le dossier entier
  r = await api('POST', '/api/projets', {titre: 'À jeter', espace: 'moi'});
  const aJeter = ctx.P.racine;
  await api('POST', '/api/projets/fermer');
  r = await api('POST', '/api/projets/corbeille', {dossier: aJeter});
  essai('un projet de la bibliothèque part en entier à la corbeille', r.code === 200 && !r.j?.garde && !fs.existsSync(aJeter) && dansLaCorbeille().includes('À jeter/derush.json'), [r, dansLaCorbeille()]);
  // un dossier vide choisi ailleurs : Dérush l'a rempli lui-même
  const ailleurs = path.join(T, 'ailleurs', 'Clip du printemps');
  fs.mkdirSync(ailleurs, {recursive: true});
  r = await api('POST', '/api/projets/ouvrir', {dossier: ailleurs});
  await api('POST', '/api/projets/fermer');
  r = await api('POST', '/api/projets/corbeille', {dossier: ailleurs});
  essai('un projet créé dans un dossier vide, hors de la bibliothèque : le dossier entier', r.code === 200 && !r.j?.garde && !fs.existsSync(ailleurs) && dansLaCorbeille().includes('Clip du printemps/derush.json'), [r, dansLaCorbeille()]);
  // le même dossier neuf, où la personne a posé ensuite ses rushes d'origine, importés sur place
  const neufRempli = path.join(T, 'ailleurs', 'Reportage');
  fs.mkdirSync(neufRempli, {recursive: true});
  r = await api('POST', '/api/projets/ouvrir', {dossier: neufRempli});
  fs.mkdirSync(path.join(neufRempli, 'Carte SD'));
  const original = path.join(neufRempli, 'Carte SD', 'C0001.MP4');
  fs.writeFileSync(original, Buffer.alloc(3000, 4));
  ctx.P.d.medias.push({id: 'M1', nom: 'C0001.MP4', chemin: original, type: 'video', etat: 'pret', duree: 1});
  ctx.P.sauver();
  await api('POST', '/api/projets/fermer');
  r = await api('POST', '/api/projets/corbeille', {dossier: neufRempli});
  essai('un dossier neuf où la personne a posé ses rushes (lus sur place) : ils restent, seul le projet s’en va', r.code === 200 && r.j?.garde === true && fs.existsSync(original) && !fs.existsSync(path.join(neufRempli, 'derush.json')), [r, fs.existsSync(neufRempli) ? fs.readdirSync(neufRempli) : 'dossier parti']);
  r = await api('POST', '/api/projets/corbeille', {dossier: path.join(T, 'tournages')});
  essai('un dossier qui n’est pas un projet : refusé, rien ne bouge', r.code === 400 && fs.existsSync(path.join(tournage, 'IMG_0001.MOV')), r);
  // pendant un travail du projet
  r = await api('POST', '/api/projets', {titre: 'En plein travail', espace: 'moi'});
  const enTravail = ctx.P.racine;
  let finir = null;
  ctx.file.ajouter('Voix claire · essai', () => new Promise((ok) => { finir = ok; }), {type: 'voix'});
  await api('POST', '/api/projets/fermer');
  r = await api('POST', '/api/projets/corbeille', {dossier: enTravail});
  essai('« Corbeille » pendant un travail du projet : refusé, le projet ne bouge pas', r.code === 409 && /travail/.test(r.j?.erreur ?? '') && fs.existsSync(path.join(enTravail, 'derush.json')), r);
  finir();
  await ctx.file.vide();
  r = await api('POST', '/api/projets/corbeille', {dossier: enTravail});
  essai('… le travail fini, il part', r.code === 200 && !fs.existsSync(enTravail), r);

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Un travail en cours : la même réponse partout');
  r = await api('POST', '/api/projets', {titre: 'Prise de voix', espace: 'moi'});
  const avantPrise = (await fetch(`${base}/api/ping`).then((x) => x.json())).occupe;
  r = await api('POST', '/api/enregistrements', {genre: 'voix', mime: 'audio/webm'});
  const pendantPrise = (await fetch(`${base}/api/ping`).then((x) => x.json())).occupe;
  await api('DELETE', `/api/enregistrements/${r.j?.id}`);
  const apresPrise = (await fetch(`${base}/api/ping`).then((x) => x.json())).occupe;
  essai('/api/ping dit « occupé » pendant une prise de voix (la fenêtre qui se ferme ne coupe plus la prise)', avantPrise === false && pendantPrise === true && apresPrise === false, {avantPrise, pendantPrise, apresPrise});
  essai('la mise à jour, la corbeille et /api/ping lisent le même « travail en cours », analyses de l’IA comprises', /const travailEnCours = \(\) => .*claudeTravaille\(\).*conseilEnCours\(\).*publicationEnCours\(\).*enregistrementEnCours\(\)/.test(SOURCE) && /if \(travailEnCours\(\)\) throw new Error\('Un travail est en cours/.test(SOURCE) && /occupe: travailEnCours\(\)/.test(SOURCE));

  titre('Connexions : Gemini');
  r = await api('POST', '/api/connexions/gemini/action-qui-n-existe-pas', {});
  essai('les actions de Gemini arrivent à leur route (avant : « Route inconnue. »)', r.code === 400 && /Action inconnue/.test(r.j?.erreur ?? ''), r);
  essai('… « installer » et « connecter » y sont reconnues', /\/api\/connexions\/gemini\/(installer|connecter)/.test('/api/connexions/gemini/installer') && /\(claude\|codex\|gemini\|ia\|/.test(SOURCE) && /id === 'gemini' && action === 'installer'/.test(SOURCE) && /id === 'gemini' && action === 'connecter'/.test(SOURCE));

  // ————————————————————————————————————————————————————————————————————————————————
  titre('La note d’une vidéo et le carnet : une seule leçon, toujours celle d’aujourd’hui');
  r = await api('POST', '/api/projets', {titre: 'Chronique du lundi', espace: 'moi'});
  const Pn = ctx.P;
  const VIDEO = 'chronique-claude-v1.mp4';
  F.enregistrerFiche(Pn, F.creerFiche({P: Pn, espace: E.trouverEspace('moi'), version: {n: 1, moteur: 'claude'}, video: {nom: VIDEO, titre: 'Chronique du lundi', duree: 41, largeur: 1080, hauteur: 1920}}), E.trouverEspace('moi'));
  const duCarnet = (id = 'moi') => K.lireCarnet(id).filter((l) => l.source === 'note' && /Chronique du lundi/.test(l.texte)).map((l) => l.texte);
  r = await api('POST', '/api/claude/note', {video: VIDEO, note: 1, mot: 'trop long au début'});
  essai('un mot sous une vidéo : une leçon dans le carnet de l’espace', r.code === 200 && r.j?.carnet === 'ajoute' && duCarnet().length === 1 && /trop long au début/.test(duCarnet()[0]), [r.j?.carnet, duCarnet()]);
  r = await api('POST', '/api/claude/note', {video: VIDEO, note: -1, mot: 'trop long au début'});
  essai('le pouce bascule : toujours une seule leçon, qui ne dit plus « aimé »', r.code === 200 && duCarnet().length === 1 && /trop long au début/.test(duCarnet()[0]) && !/\(aimé\)/.test(duCarnet()[0]), duCarnet());
  r = await api('POST', '/api/claude/note', {video: VIDEO, note: -1, mot: 'finalement parfait comme ça'});
  essai('le mot change : la nouvelle leçon remplace l’ancienne', r.code === 200 && duCarnet().length === 1 && /finalement parfait/.test(duCarnet()[0]), duCarnet());
  r = await api('POST', '/api/claude/note', {video: VIDEO, note: -1, mot: 'finalement parfait comme ça'});
  essai('le même avis renvoyé : rien ne change', r.code === 200 && r.j?.carnet === null && duCarnet().length === 1, [r.j?.carnet, duCarnet()]);
  r = await api('POST', '/api/claude/note', {video: VIDEO, note: -1, mot: ''});
  essai('« Effacer mon mot » : la leçon quitte le carnet (l’IA ne la relira plus)', r.code === 200 && r.j?.fiche?.mot === null && r.j?.carnet === 'retire' && duCarnet().length === 0, [r.j?.carnet, duCarnet()]);
  r = await api('POST', '/api/claude/note', {video: VIDEO, note: 1, mot: 'garde ce rythme de coupe'});
  const posee = K.lireCarnet('moi').find((l) => /garde ce rythme de coupe/.test(l.texte));
  K.retirerLecon(posee?.id, 'moi');
  r = await api('POST', '/api/claude/note', {video: VIDEO, note: -1, mot: 'garde ce rythme de coupe'});
  essai('une leçon effacée à la main dans le carnet n’y revient pas pour un pouce basculé', !!posee && r.code === 200 && duCarnet().length === 0, duCarnet());

  titre('Lier une publication : suivie dans l’espace pour lequel la vidéo a été montée');
  const client = E.creerClient({nom: 'Boulangerie Essai'});
  await api('PUT', '/api/projet', {espace: client.id});
  r = await api('POST', '/api/claude/note', {video: VIDEO, note: 1, mot: 'un mot écrit chez le client'});
  essai('le projet passé chez un client : un mot sur la vidéo de « Moi » n’entre pas au carnet du client', r.code === 200 && duCarnet(client.id).length === 0 && !K.lireCarnet(client.id).some((l) => /chez le client/.test(l.texte)), K.lireCarnet(client.id));
  r = await api('POST', '/api/suivi/lier', {video: VIDEO, lien: 'https://www.youtube.com/watch?v=essaiSERV01'});
  essai('le lien d’une vidéo montée pour « Moi », collé depuis le projet passé chez un client : accepté, suivi chez « Moi »', r.code === 200 && r.j?.espace?.id === 'moi' && !!Su.lireSuivi('moi').publications['youtube:essaiSERV01'] && !Su.lireSuivi(client.id).publications['youtube:essaiSERV01'] && F.ficheDe(Pn, VIDEO).publications?.length === 1, r);
  await api('PUT', '/api/projet', {espace: 'neutre'});
  r = await api('POST', '/api/suivi/lier', {video: VIDEO, lien: 'https://www.youtube.com/watch?v=essaiSERV02'});
  essai('un projet de « Personne » : toujours refusé', r.code === 400 && /Personne/.test(r.j?.erreur ?? '') && !Su.lireSuivi('moi').publications['youtube:essaiSERV02'], r);
  await api('PUT', '/api/projet', {espace: 'moi'});

  titre('Le tableau de bord : les vignettes d’un espace qui existe, et de lui seul');
  const horsEspaces = path.join(T, 'hors-espaces');
  fs.mkdirSync(horsEspaces, {recursive: true});
  const photo = path.join(horsEspaces, 'photo.vignettes.jpg');
  fs.writeFileSync(photo, Buffer.alloc(3000, 2));
  fs.writeFileSync(path.join(horsEspaces, 'fiches.jsonl'), `${JSON.stringify({type: 'fiche', cle: 'abc', quand: new Date().toISOString(), video: 'photo.mp4', titre: 'Photo', vignettes: photo})}\n`);
  const chemin = path.relative(E.DOSSIER_ESPACES, horsEspaces);
  r = await fetch(`${base}/api/tableau/vignettes?espace=${encodeURIComponent(chemin)}&cle=abc`, {headers: {'x-derush-jeton': jeton, 'x-derush-fenetre': FENETRE}});
  await r.arrayBuffer().catch(() => null);
  essai('un « espace » qui pointe hors du dossier des espaces (../) : 404, rien n’est servi', r.status === 404, [r.status, chemin]);

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Importer une transcription');
  Pn.d.medias.push({id: 'M1', nom: 'absent.mp4', chemin: path.join(T, 'absent.mp4'), type: 'video', duree: 12, largeur: 1920, hauteur: 1080, audio: true, etapes: {}, etat: 'pret'});
  r = await api('POST', '/api/medias/M1/transcription', {nom: 'export.json', contenu: JSON.stringify({segments: [{start: 0, text: 'Bonjour à tous'}, {start: 3, text: 'on commence'}]})});
  essai('une transcription dont aucun mot n’a de fin : une erreur dite en français (400), pas une erreur du programme', r.code === 400 && !/Cannot read|undefined/.test(r.j?.erreur ?? '') && /mot/.test(r.j?.erreur ?? ''), r);

  titre('Changer les couleurs pendant la préparation');
  const me = Pn.media('M1');
  let finirPreparation = null;
  ctx.file.ajouter('Préparation · absent.mp4', () => new Promise((ok) => { finirPreparation = () => { me.etapes.proxy = true; ok({}); }; }), {media: 'M1', type: 'preparation'});
  r = await api('POST', '/api/medias/M1/couleur', {profil: 'slog3'});
  let apresPreparation = null;
  const ecoute = (t) => { if (t.meta?.media === 'M1' && apresPreparation === null) apresPreparation = {...me.etapes}; };
  ctx.file.ecouteurs.add(ecoute);
  finirPreparation();
  await ctx.file.vide();
  ctx.file.ecouteurs.delete(ecoute);
  essai('l’aperçu que la préparation en cours finit avec les anciennes couleurs est remis à faire (il n’est pas sauté ensuite)', r.code === 200 && me.couleur?.profil === 'slog3' && apresPreparation !== null && apresPreparation.proxy !== true, {r, apresPreparation});

  titre('L’aperçu des couleurs de la caméra');
  const ff = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25:duration=2', '-pix_fmt', 'yuv420p', path.join(T, 'mire.mp4')]);
  if (ff.status !== 0) console.log('  (FFmpeg absent : les essais de l’aperçu des couleurs sont sautés)');
  else {
    Pn.d.medias.push({id: 'M2', nom: 'mire.mp4', chemin: path.join(T, 'mire.mp4'), type: 'video', duree: 2, largeur: 640, hauteur: 360, audio: false, etapes: {}, etat: 'pret'});
    const DM = path.join(Pn.cache, 'medias', 'M2');
    const apercu = async (profil) => { const x = await fetch(`${base}/media/M2/couleur-apercu?j=${jeton}&profil=${profil}&t=1&v=${Math.random()}`); return {code: x.status, type: x.headers.get('content-type'), e: empreinte(Buffer.from(await x.arrayBuffer()))}; };
    const normal = await apercu('normal');
    const slog3 = await apercu('slog3');
    essai('un aperçu par profil : deux images différentes', normal.code === 200 && slog3.code === 200 && /image\/jpeg/.test(normal.type) && normal.e !== slog3.e, [normal, slog3]);
    for (const n of fs.readdirSync(DM)) if (/^apercu-couleur/.test(n)) fs.rmSync(path.join(DM, n));
    // la personne passe vite d'un profil à l'autre
    const demandes = [];
    for (const p of ['slog3', 'normal', 'slog3', 'normal', 'slog3', 'normal']) { demandes.push(apercu(p).then((x) => ({p, ...x}))); await dormir(30); }
    const recus = await Promise.all(demandes);
    essai('six choix rapprochés : chaque réponse montre bien le profil demandé', recus.every((x) => x.code === 200 && x.e === (x.p === 'normal' ? normal.e : slog3.e)), recus.map((x) => `${x.p}:${x.code}:${x.e === (x.p === 'normal' ? normal.e : slog3.e) ? 'bon' : 'AUTRE'}`));
    const fichiers = fs.readdirSync(DM).filter((n) => /apercu-couleur/.test(n)).sort();
    essai('un fichier par réglage (deux ici), aucun fichier commun, aucun fichier à moitié écrit', fichiers.length === 2 && fichiers.every((n) => /^apercu-couleur-[a-f0-9]{12}\.jpg$/.test(n)), fichiers);
    const d0 = performance.now();
    const encore = await apercu('slog3');
    essai('revenir à un profil déjà vu : la même image, sans rien refabriquer', encore.e === slog3.e && fs.readdirSync(DM).filter((n) => /apercu-couleur/.test(n)).length === 2 && performance.now() - d0 < 1500, [encore, Math.round(performance.now() - d0)]);
  }

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Changer l’espace d’un projet depuis la bibliothèque');
  {
    await api('POST', '/api/projets/fermer');
    const client = E.creerClient({nom: 'Client Pour Qui'});
    const ferme = path.join(BIBLIO, 'Episode ferme');
    const Pf = new Projet(ferme);
    Object.assign(Pf.d, {espace: 'moi', serie: {id: 'S1', nom: 'Chroniques', espace: 'moi'}});
    Pf.sauver();
    r = await api('POST', '/api/projets/espace', {dossier: ferme, espace: client.id});
    let j = JSON.parse(fs.readFileSync(path.join(ferme, 'derush.json'), 'utf8'));
    essai('un épisode de Moi passé à un client (projet fermé) : il n’est plus l’épisode d’une série de Moi', r.code === 200 && j.espace === client.id && !j.serie, [r, j.espace, j.serie]);
    Object.assign(j, {serie: {id: 'S2', nom: 'Recettes', espace: client.id}});
    fs.writeFileSync(path.join(ferme, 'derush.json'), JSON.stringify(j));
    r = await api('POST', '/api/projets/espace', {dossier: ferme, espace: client.id});
    j = JSON.parse(fs.readFileSync(path.join(ferme, 'derush.json'), 'utf8'));
    essai('… redonné au même espace : il reste l’épisode de sa série', r.code === 200 && j.serie?.id === 'S2', j.serie);
    // fermé, mais encore chargé : une tâche (voix claire, texte…) tient son objet et l'enregistrera en finissant
    const vivants = new Map();
    ctx.projetVivant = (d) => vivants.get(path.resolve(d)) ?? null;
    const charge = path.join(BIBLIO, 'Encore charge');
    const Pv = new Projet(charge);
    vivants.set(Pv.racine, Pv);
    r = await api('POST', '/api/projets/espace', {dossier: charge, espace: client.id});
    Pv.sauver(); // la tâche finit
    j = JSON.parse(fs.readFileSync(path.join(charge, 'derush.json'), 'utf8'));
    essai('un projet fermé encore chargé par une tâche : le nouvel espace tient quand elle enregistre', r.code === 200 && Pv.d.espace === client.id && j.espace === client.id, [r, Pv.d.espace, j.espace]);
    fs.rmSync(path.join(charge, 'derush.json'));
    r = await api('POST', '/api/projets/espace', {dossier: charge, espace: 'moi'});
    essai('… mis à la corbeille entre-temps : refusé, et derush.json n’est pas refait à son ancien endroit', r.code === 400 && !fs.existsSync(path.join(charge, 'derush.json')), r);
    delete ctx.projetVivant;
  }

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Ouvrir un dossier : jamais le dossier personnel, ce qui est rangé juste dedans, ni un disque entier');
  {
    const parc = path.join(T, 'parcourir');
    const videP = path.join(parc, 'Vide');
    fs.mkdirSync(videP, {recursive: true});
    fs.writeFileSync(path.join(videP, '.DS_Store'), '');
    const lu = async (d) => (await api('GET', `/api/parcourir?dossier=${encodeURIComponent(d)}`)).j ?? {};
    const [a, b, c] = [await lu(videP), await lu(parc), await lu(path.join(BIBLIO, 'Episode ferme'))];
    essai('/api/parcourir dit du dossier lui-même s’il est déjà un projet, ou vide (fichiers du système à part)', a.projet === false && a.vide === true && b.projet === false && b.vide === false && c.projet === true && c.vide === false, [a.projet, a.vide, b.projet, b.vide, c.projet, c.vide]);
    fs.mkdirSync(path.join(MAISON, 'Documents'), {recursive: true}); // vide
    const images = path.join(MAISON, 'Images');
    fs.mkdirSync(images, {recursive: true});
    fs.writeFileSync(path.join(images, '.localized'), '');
    const musique = path.join(MAISON, 'Musique');
    fs.mkdirSync(musique, {recursive: true});
    fs.writeFileSync(path.join(musique, 'chanson.mp3'), 'x');
    const refus = [];
    // la racine du disque en dernier, et seulement si le reste est déjà refusé : sans la garde, on y écrirait
    for (const d of [MAISON, path.join(MAISON, 'Documents'), images, musique, path.parse(T).root]) {
      if (refus.length) break;
      r = await api('POST', '/api/projets/ouvrir', {dossier: d});
      if (!(r.code === 400 && /dossier à l’intérieur/.test(r.j?.erreur ?? '') && !fs.existsSync(path.join(d, 'derush.json')))) refus.push([d, r]);
    }
    essai('le dossier personnel, les Documents (même vides), Images, Musique, la racine du disque : refusés, rien n’y est écrit', refus.length === 0 && ctx.P === null, refus);
    const monFilm = path.join(MAISON, 'Mon film');
    fs.mkdirSync(monFilm);
    r = await api('POST', '/api/projets/ouvrir', {dossier: monFilm});
    const okNeuf = r.code === 200 && fs.existsSync(path.join(monFilm, 'derush.json'));
    await api('POST', '/api/projets/fermer');
    const ancien = path.join(MAISON, 'Ancien projet');
    new Projet(ancien).sauver();
    r = await api('POST', '/api/projets/ouvrir', {dossier: ancien});
    await api('POST', '/api/projets/fermer');
    essai('… mais un dossier neuf et vide créé là, ou un projet déjà là, s’ouvrent', okNeuf && r.code === 200, [okNeuf, r]);
  }

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Revérifier les connexions : seulement ce qui est demandé');
  {
    const fd = (q) => (typeof forceDemandee === 'function' ? forceDemandee(new URL(`http://127.0.0.1/api/connexions${q}`)) : null);
    const cas = [
      ['', (x) => x.tout === false && x.ia === false],
      ['?force=1', (x) => x.tout === true && x.ia === true],
      ['?force', (x) => x.tout === true && x.ia === true],
      ['?force=ia', (x) => x.tout === false && x.ia === true && !x.noms.includes('blender') && !x.noms.includes('earshot')],
      ['?force=claude', (x) => x.tout === false && JSON.stringify(x.ia) === '["claude"]'],
      [`?force=${encodeURIComponent('blender,earshot')}`, (x) => x.tout === false && x.ia === false && x.noms.includes('blender') && x.noms.includes('earshot')],
      ['?force=realsfx', (x) => x.tout === false && x.ia === false],
      ['?force=ia,gemini', (x) => JSON.stringify(x.ia) === '["claude","codex","gemini"]'],
    ];
    const rates = cas.filter(([q, ok]) => { const x = fd(q); return !x || !ok(x); }).map(([q]) => [q, fd(q)]);
    essai('« ?force= » lu comme une liste : rien, tout (1), ia, un assistant, blender et earshot ; un nom inconnu ignoré', rates.length === 0, rates);
    essai('… Connexions ne relance Blender et Earshot que s’ils sont demandés, et l’éditeur lit la même liste', /force\.tout \|\| force\.noms\.includes\('blender'\)\) oublierBlender\(\)/.test(SOURCE) && /force\.tout \|\| force\.noms\.includes\('earshot'\)\) \{ oublierEarshot\(\)/.test(SOURCE) && /lireIA\(force\.ia\)/.test(SOURCE) && /const force = forceDemandee\(url\)\.ia;/.test(SOURCE) && !/searchParams\.has\('force'\);\s*\n\s*if \(force\) \{ oublierEtats\(\)/.test(SOURCE));
  }

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Depuis mon Drive, la voix off, les vidéos d’un projet : branchés');
  {
    const C = await lib('commun.mjs');
    const Me = await lib('medias.mjs');
    r = await api('POST', '/api/projets', {titre: 'Vlog du vendredi', espace: 'moi'});
    const P = ctx.P;
    // les vidéos du projet (lib/sequences.mjs)
    r = await api('GET', '/api/sequences');
    const une = r.code === 200 && r.j?.sequences?.length === 1 && r.j.sequence === P.d.sequence;
    const premiere = P.d.sequence;
    r = await api('POST', '/api/sequences', {});
    const deuxieme = r.j?.ajoutee;
    essai('/api/sequences : la vidéo du projet, puis une nouvelle vidéo ouverte (avec le projet entier)', une && r.code === 200 && r.j?.sequences?.length === 2 && r.j.sequence === deuxieme && r.j.projet?.sequence === deuxieme, r);
    r = await api('PUT', '/api/projet', {sequence: premiere, titre: 'Vlog du vendredi'});
    const ignore = r.j;
    r = await api('PUT', '/api/projet', {sequence: deuxieme, titre: 'Vlog du vendredi'});
    essai('PUT /api/projet dit si un enregistrement visait une autre vidéo (sequence_ignoree)', ignore?.ok === true && ignore.sequence_ignoree === true && r.j?.sequence_ignoree === false && r.j?.sequence === deuxieme, [ignore, r.j]);
    r = await api('GET', '/api/sequences/rendre');
    essai('« Créer toutes les vidéos » : ce qui va se passer, avant (deux vidéos vides, rien à créer)', r.code === 200 && r.j?.videos?.length === 2 && r.j.a_rendre === 0 && typeof r.j.taille_lisible === 'string', r);
    r = await api('DELETE', '/api/sequences/V999999');
    essai('une vidéo qui n’existe pas : 404, pas « Route inconnue »', r.code === 404 && !/Route inconnue/.test(r.j?.erreur ?? ''), r);
    // « Créer la vidéo » : la vidéo ouverte, figée au clic (la file est occupée : la tâche attend son tour)
    let relache = null;
    ctx.file.ajouter('Essai : la file est occupée', () => new Promise((ok) => { relache = ok; }));
    r = await api('POST', '/api/rendre', {});
    const tache = r.j?.tache;
    await api('POST', '/api/sequences/activer', {id: premiere});
    const enAttente = ctx.file.etat().attente.find((t) => t.id === tache);
    relache?.();
    await ctx.file.vide();
    const finie = ctx.file.etat().recents.find((t) => t.id === tache);
    essai('« Créer la vidéo » porte le nom et l’id de la vidéo ouverte au clic, même si on en ouvre une autre pendant l’attente', enAttente?.nom === `Création de la vidéo · ${P.d.sequences.find((x) => x.id === deuxieme)?.nom}` && enAttente.meta?.sequence === deuxieme && finie?.etat === 'erreur' && /montage est vide/.test(finie.erreur ?? ''), [enAttente, finie]);
    // un rush utilisé seulement dans une vidéo rangée ne se retire pas
    P.d.medias.push({id: 'M900', nom: 'rush-rangé.mp4', type: 'video', chemin: path.join(T, 'absent.mp4')});
    const rangee = P.d.sequences.find((x) => x.id !== P.d.sequence);
    rangee.montage = [{id: 'P900', type: 'plan', media: 'M900', entree: 0, sortie: 2}];
    let refuse = '';
    try { Me.retirerMedia(P, 'M900'); } catch (e) { refuse = e.message; }
    rangee.montage = [];
    P.d.medias = P.d.medias.filter((m) => m.id !== 'M900');
    essai('un rush utilisé dans une autre vidéo du projet ne se retire pas (ses plans disparaîtraient)', /autre vidéo du projet \(« .+ »\)/.test(refuse), refuse);
    // la voix off (lib/voix-off.mjs)
    r = await api('GET', `/api/voix-off?demande=${encodeURIComponent('un vlog du vendredi')}`);
    const etatVO = r;
    r = await api('GET', '/api/voix-off/n-existe-pas');
    essai('/api/voix-off : l’avis et le micro, sans IA ; une adresse inconnue reste « Route inconnue »', etatVO.code === 200 && typeof etatVO.j?.avis?.conseillee === 'boolean' && typeof etatVO.j?.micro?.allume === 'boolean' && r.code === 404 && /Route inconnue/.test(r.j?.erreur ?? ''), [etatVO, r]);
    r = await api('POST', '/api/voix-off/choix', {choix: 'n-importe-quoi'});
    const mauvais = r;
    r = await api('POST', '/api/voix-off/questions', {demande: 'vlog'});
    essai('/api/voix-off : un choix inconnu, des questions sans rushes : 400 et un message en français (aucune IA lancée)', mauvais.code === 400 && r.code === 400 && !!r.j?.erreur && !(await lib('conseil.mjs')).conseilEnCours(), [mauvais, r]);
    // « Depuis mon Drive » (lib/drive-medias.mjs), sans Drive sur l'ordinateur
    r = await api('GET', '/api/drive/medias');
    essai('/api/drive/medias sans Drive : installe:false et le lien d’installation', r.code === 200 && r.j?.installe === false && /^https:\/\//.test(r.j?.lien ?? '') && !!r.j?.texte, r);
    r = await api('POST', '/api/drive/chercher', {demande: 'les vidéos du Japon, un vlog du vendredi'});
    const sansDrive = r;
    r = await api('GET', '/api/drive/chercher');
    essai('chercher sans Drive : 409 (avec la phrase d’installation), et rien ne tourne', sansDrive.code === 409 && !!sansDrive.j?.erreur && r.code === 200 && typeof r.j?.etat === 'string' && !(await lib('drive-medias.mjs')).driveOccupe(), [sansDrive, r]);
    r = await api('GET', '/api/drive/importer');
    essai('l’état de l’import se lit (aucun)', r.code === 200 && r.j?.etat === 'aucun', r);
    // une seule fenêtre modifie : l'aperçu d'un import, qui ne change rien, reste permis aux autres
    ctx.fenetrePrincipale = FENETRE;
    const autre = async (methode, p, corps) => { const x = await fetch(`${base}${p}`, {method: methode, headers: {'x-derush-jeton': jeton, 'x-derush-fenetre': 'autre-fenetre', 'content-type': 'application/json'}, body: JSON.stringify(corps)}); return {code: x.status, j: await x.json().catch(() => null)}; };
    const apercu = await autre('POST', '/api/drive/importer/apercu', {fichiers: []});
    const chercher = await autre('POST', '/api/drive/chercher', {demande: 'les vidéos du Japon'});
    const nouvelle = await autre('POST', '/api/sequences', {});
    ctx.fenetrePrincipale = null;
    essai('une autre fenêtre : l’aperçu d’un import passe (lecture seule), chercher et ajouter une vidéo sont refusés', apercu.j?.remplacee !== true && chercher.code === 409 && chercher.j?.remplacee === true && nouvelle.code === 409 && nouvelle.j?.remplacee === true, [apercu, chercher, nouvelle]);
    essai('une recherche ou un import depuis le Drive compte comme un travail en cours, et s’arrête avec Dérush (quitter, mise à jour)', /const travailEnCours = \(\) => .*\|\| driveOccupe\(\)\);/.test(SOURCE) && (SOURCE.match(/arreterConseils\(\); arreterDrive\(\); arreterEnfants\(\);/g) ?? []).length === 2);
    const oui = ['Va dans mon Drive, récupère les vidéos du Japon et fais-moi un vlog du vendredi', 'J’ai mis tout mon séjour au Japon sur mon Google Drive, fais-moi un vlog de la journée du vendredi', 'prends les rushs de mon séjour sur le drive'];
    const non = ['monte la vidéo du vendredi', 'Envoie la vidéo sur mon Drive', 'Mets les 10 TikToks dans mon Drive', 'le drive-in de Kyoto'];
    essai('parleDuDrive (partagé avec l’interface) : « va dans mon Drive… » oui ; « envoie la vidéo sur mon Drive » non', oui.every(C.parleDuDrive) && !non.some(C.parleDuDrive), [oui.map(C.parleDuDrive), non.map(C.parleDuDrive)]);
    await api('POST', '/api/projets/fermer');
  }

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Au bout du compte');
  await ctx.file.vide();
  essai('toujours vivant après tout ça, et aucune erreur n’est restée sans personne pour l’attraper', await vivant() && tombes.length === 0, tombes.map((e) => String(e?.stack ?? e).slice(0, 300)));
} catch (e) {
  essai('les essais sont allés au bout', false, e.stack);
} finally {
  serveur?.close();
  serveur2?.close();
  if (bons === total) fs.rmSync(T, {recursive: true, force: true});
  else console.log(`\nLe dossier d’essai est gardé pour comprendre : ${T}`);
}
console.log(`\n${bons} essais réussis sur ${total}`);
process.exit(bons === total ? 0 : 1); // obligatoire : les états des moteurs en cours de calcul retiennent le processus
