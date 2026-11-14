// Dérush — les essais de l'envoi vers YouTube (pour qui modifie Dérush), contre un faux Treg et un faux YouTube :
// aucun appel réel, aucune clé, rien de publié.
//   node outils/essai-youtube.mjs [dossier où créer le dossier d'essai]
// L'essai crée son propre dossier (« derush-essai-youtube-… ») dans le dossier donné, ou dans le dossier temporaire du
// système, et n'efface que celui-là à la fin (il le garde si un essai échoue). Le dossier donné n'est jamais vidé.
// Le faux serveur joue la porte directe de Treg (/call/youtube.youtube.video.upload, /call/youtube.youtube.video.detail,
// /call/<adresse entière>) et l'adresse d'envoi de YouTube (/depot). Il marque ses propres refus de X-Treg-Error, comme
// le vrai Treg ; sans cet en-tête, c'est « YouTube » qui répond. Les essais passent par la vraie commande
// (outils/publier-youtube.mjs) et par le vrai relais (lib/relais.mjs) : son adresse locale (Codex) et sa boîte, par
// fichiers (Gemini).
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// un dossier neuf à lui, créé dans le dossier donné : jamais le dossier donné lui-même (il peut contenir autre chose),
// et jamais un nom fixe (deux essais lancés en même temps ne s'effacent pas l'un l'autre)
if (/^-/.test(process.argv[2] ?? '')) { console.log(`Usage : node ${path.relative(process.cwd(), process.argv[1])} [dossier temporaire]`); process.exit(0); }
const parent = path.resolve(process.argv[2] ?? os.tmpdir());
fs.mkdirSync(parent, {recursive: true});
const essais = fs.mkdtempSync(path.join(parent, 'derush-essai-youtube-'));
// un faux projet Dérush (derush.json + .derush/ + vidéos/), pour le journal des envois ; et des vidéos hors projet.
// La « vidéo » est un fichier de 3 Mo d'octets au hasard : l'envoi ne regarde que son nom et sa taille.
const projet = path.join(essais, 'projet');
fs.mkdirSync(path.join(projet, '.derush'), {recursive: true});
fs.mkdirSync(path.join(projet, 'vidéos'), {recursive: true});
fs.mkdirSync(path.join(projet, 'exports', 'pack', 'a-publier'), {recursive: true});
fs.writeFileSync(path.join(projet, 'derush.json'), '{}');
const octets = crypto.randomBytes(3_000_000);
const videoProjet = path.join(projet, 'vidéos', 'essai.mp4');
fs.writeFileSync(videoProjet, octets);
fs.symlinkSync(videoProjet, path.join(projet, 'exports', 'pack', 'a-publier', 'essai.mp4'));
const video = path.join(essais, 'hors-projet.mp4');
fs.writeFileSync(video, octets);
const ailleurs = path.join(essais, 'ailleurs.mp4');
fs.writeFileSync(ailleurs, octets);
const taille = octets.length;
const journalProjet = path.join(projet, '.derush', 'youtube-envois.json');

let scenario = 'normal';
let recus = Buffer.alloc(0);
let journal = [];
let coupe = false;
const CLE = 'trg_essai_0000';
const json = (res, code, objet, entetes = {}) => { res.writeHead(code, {'content-type': 'application/json', ...entetes}); res.end(typeof objet === 'string' ? objet : JSON.stringify(objet)); };
const refusTreg = (res, code, detail) => json(res, code, {detail}, {'x-treg-error': '1'});
const serveur = http.createServer((req, res) => {
  let [chemin, q = ''] = req.url.split(/\?(.*)/s);
  const question = new URLSearchParams(q);
  // le dépôt qui passe par Treg : /call/<adresse entière> ; Treg vérifie la clé et ajoute l'autorisation
  let parTreg = false;
  if (chemin.startsWith('/call/http://')) {
    if (req.headers['x-treg-token'] !== CLE) { req.resume(); return refusTreg(res, 401, 'invalid token'); }
    parTreg = true;
    chemin = new URL(chemin.slice('/call/'.length)).pathname;
  }
  if (req.method === 'POST' && chemin === '/call/youtube.youtube.video.upload') {
    let corps = '';
    req.on('data', (d) => { corps += d; });
    req.on('end', () => {
      journal.push({ouverture: {jeton: req.headers['x-treg-token'], question: Object.fromEntries(question), corps: JSON.parse(corps), taille_annoncee: req.headers['x-upload-content-length']}});
      if (scenario === 'cle') return refusTreg(res, 401, 'invalid token');
      if (scenario === 'non-relie') return refusTreg(res, 404, 'no youtube credential in this org — youtube.youtube.video.upload is a marketplace endpoint\n  connect one:  treg connections connect --provider youtube');
      if (scenario === 'youtube-401') return json(res, 401, {error: {code: 401, message: 'Request had invalid authentication credentials.', status: 'UNAUTHENTICATED'}});
      if (scenario === 'droit') return json(res, 403, {error: {code: 403, message: 'Insufficient Permission: request had insufficient authentication scopes.', errors: [{reason: 'insufficientPermissions'}]}});
      if (scenario === 'quota') return json(res, 403, {error: {code: 403, message: 'The request cannot be completed because you have exceeded your quota.', errors: [{domain: 'youtube.quota', reason: 'quotaExceeded'}]}});
      if (scenario === 'sans-adresse') return json(res, 200, '');
      res.writeHead(200, {'content-type': 'application/json', location: `http://127.0.0.1:${serveur.address().port}/depot?upload_id=essai123`});
      res.end('');
    });
    return;
  }
  if (req.method === 'GET' && chemin === '/call/youtube.youtube.video.detail') {
    journal.push({detail: Object.fromEntries(question)});
    if (req.headers['x-treg-token'] !== CLE) return refusTreg(res, 401, 'invalid token');
    if (scenario === 'detail-muet') return refusTreg(res, 404, 'unknown endpoint');
    if (scenario === 'detail-lent') return; // Treg ou YouTube qui tarde : la commande attend (jusqu'à 45 s)
    const demandee = journal.find((x) => x.ouverture)?.ouverture.corps.status.privacyStatus;
    return json(res, 200, {items: [{id: question.get('id'), status: {privacyStatus: scenario === 'prive' ? 'private' : demandee, uploadStatus: scenario === 'rejet' ? 'rejected' : 'uploaded', ...(scenario === 'rejet' ? {rejectionReason: 'duplicate'} : {})}}]});
  }
  if (req.method === 'PUT' && chemin === '/depot') {
    const plage = req.headers['content-range'] ?? '';
    // « YouTube » qui réclame l'autorisation pour le dépôt direct : seul le passage par Treg est accepté
    if (scenario === 'depot-401' && !parTreg) { journal.push({depot_refuse: plage || 'tout le fichier'}); req.resume(); return json(res, 401, {error: {code: 401, message: 'Login Required.'}}); }
    if (/^bytes \*\//.test(plage)) { // « où en es-tu ? »
      journal.push({question_etat: plage, recu: recus.length, par_treg: parTreg});
      res.writeHead(308, recus.length ? {range: `bytes=0-${recus.length - 1}`} : {});
      return res.end();
    }
    journal.push({depot: {plage: plage || 'tout le fichier', annonce: req.headers['content-length'], par_treg: parTreg}});
    req.on('data', (d) => {
      if (scenario === 'coupure' && !coupe && recus.length + d.length > taille / 3) { // on garde un tiers, puis la liaison tombe
        const garde = Math.max(0, Math.floor(taille / 3) - recus.length);
        recus = Buffer.concat([recus, d.subarray(0, garde)]);
        coupe = true;
        return req.socket.destroy();
      }
      recus = Buffer.concat([recus, d]);
    });
    req.on('end', () => {
      if (recus.length < taille) { res.writeHead(308, {range: `bytes=0-${recus.length - 1}`}); return res.end(); }
      const o = journal.find((x) => x.ouverture)?.ouverture.corps;
      json(res, 200, {id: 'ESSAI_abc123', snippet: {title: o?.snippet.title}, status: {privacyStatus: o?.status.privacyStatus, uploadStatus: 'uploaded'}});
    });
    return;
  }
  res.writeHead(404); res.end();
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${serveur.address().port}`;

const TITRE = 'Essai Dérush — vidéo de test (à supprimer)';
const lancer = (env, args = [], {titre = TITRE, fichier = video} = {}) => new Promise((ok) => {
  const p = spawn(process.execPath, [`${D}/outils/publier-youtube.mjs`, fichier, '--titre', titre, '--description', 'Une mire.\n\n#test', '--tags', 'test,mire', ...args],
    {env: {PATH: process.env.PATH, HOME: process.env.HOME, DERUSH_TREG_BASE: base, ...env}});
  let out = ''; let err = '';
  p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => { let j = null; try { j = JSON.parse(out.trim().split('\n').at(-1)); } catch { /* pas de JSON */ } ok({code, j, avancement: err.trim().split('\n').filter(Boolean).length}); });
});
const resultats = [];
const essai = async (nom, s, env, args, verifier, options) => {
  scenario = s; recus = Buffer.alloc(0); journal = []; coupe = false;
  const r = await lancer(env, args, options);
  let bon = false;
  try { bon = !!verifier(r); } catch (e) { console.log(`   (la vérification a levé : ${e.message})`); }
  console.log(`${bon ? '✓' : '✗'} ${nom} → code ${r.code}, ${JSON.stringify(r.j)?.slice(0, 330)}${bon ? '' : `\n   journal : ${JSON.stringify(journal).slice(0, 700)}`}`);
  resultats.push(bon);
};
const cle = {TREG_TOKEN: CLE};
const entier = () => recus.length === taille && Buffer.compare(recus, octets) === 0;
const ouv = () => journal.find((x) => x.ouverture)?.ouverture;

console.log('— La commande, avec la clé —');
await essai('envoi normal', 'normal', cle, [], (r) => r.code === 0 && r.j.ok && r.j.id === 'ESSAI_abc123' && r.j.lien === 'https://youtu.be/ESSAI_abc123' && r.j.lien_short === 'https://youtube.com/shorts/ESSAI_abc123' && r.j.visibilite === 'unlisted' && !r.j.note && !r.j.deja
  && entier() && ouv().jeton === CLE && ouv().question.uploadType === 'resumable' && ouv().question.part === 'id,snippet,status' && ouv().corps.status.privacyStatus === 'unlisted' && ouv().corps.status.selfDeclaredMadeForKids === false
  && ouv().corps.snippet.title === TITRE && ouv().corps.snippet.tags.join() === 'test,mire' && ouv().taille_annoncee === String(taille) && journal.some((x) => x.detail?.id === 'ESSAI_abc123') && journal.filter((x) => x.depot).length === 1 && !journal.find((x) => x.depot).depot.par_treg);
await essai('visibilité publique demandée, vidéo IA, sans prévenir les abonnés', 'normal', cle, ['--visibilite', 'public', '--ia', '--sans-notifier'], (r) => r.j.ok && r.j.visibilite === 'public' && ouv().corps.status.containsSyntheticMedia === true && ouv().question.notifySubscribers === 'false');
await essai('coupure au milieu, puis reprise', 'coupure', cle, [], (r) => r.code === 0 && r.j.ok && entier() && journal.some((x) => x.question_etat) && journal.filter((x) => x.depot).length === 2 && /^bytes \d+-\d+\/\d+$/.test(journal.filter((x) => x.depot)[1].depot.plage));
await essai('YouTube réclame l’autorisation pour le dépôt : passage par Treg', 'depot-401', cle, [], (r) => r.code === 0 && r.j.ok && entier() && journal.some((x) => x.depot_refuse) && journal.some((x) => x.depot?.par_treg) && journal.filter((x) => x.ouverture).length === 1);
await essai('YouTube la garde en privé (application pas encore auditée)', 'prive', cle, [], (r) => r.code === 0 && r.j.ok && r.j.visibilite === 'private' && /gardé la vidéo en privé/.test(r.j.note) && /non répertoriée/.test(r.j.note));
await essai('YouTube la refuse après l’envoi (doublon)', 'rejet', cle, [], (r) => r.code === 0 && r.j.ok && /doublon/.test(r.j.note));
await essai('YouTube ne dit pas où en est la vidéo : l’envoi reste bon', 'detail-muet', cle, [], (r) => r.code === 0 && r.j.ok && r.j.visibilite === 'unlisted' && !r.j.note);

console.log('— Les refus, dits simplement —');
await essai('pas de clé Treg', 'normal', {}, [], (r) => r.code === 1 && r.j.raison === 'cle_manquante' && journal.length === 0);
await essai('clé refusée par Treg', 'cle', cle, [], (r) => r.code === 1 && r.j.raison === 'cle_refusee' && recus.length === 0);
await essai('YouTube pas relié dans Treg', 'non-relie', cle, [], (r) => r.code === 1 && r.j.raison === 'youtube_non_relie' && /n’est pas relié/.test(r.j.message));
await essai('liaison YouTube expirée (401 de YouTube, pas de Treg)', 'youtube-401', cle, [], (r) => r.code === 1 && r.j.raison === 'youtube_non_relie' && /expiré/.test(r.j.message));
await essai('YouTube relié sans le droit de publier', 'droit', cle, [], (r) => r.code === 1 && r.j.raison === 'youtube_non_relie' && /droit de publier/.test(r.j.message));
await essai('quota du jour atteint (403 quotaExceeded)', 'quota', cle, [], (r) => r.code === 1 && r.j.raison === 'quota' && /demain/.test(r.j.message));
await essai('adresse d’envoi absente', 'sans-adresse', cle, [], (r) => r.code === 1 && r.j.raison === 'treg' && recus.length === 0);
await essai('titre trop long', 'normal', cle, [], (r) => r.code === 1 && r.j.raison === 'titre' && journal.length === 0, {titre: 'x'.repeat(120)});
await essai('visibilité inconnue', 'normal', cle, ['--visibilite', 'tout-le-monde'], (r) => r.code === 1 && r.j.raison === 'visibilite' && journal.length === 0);

console.log('— Ce que l’humain a demandé (donné par Dérush) —');
await essai('YouTube pas demandé dans ce message', 'normal', {...cle, DERUSH_YOUTUBE_PERMIS: '0'}, [], (r) => r.code === 1 && r.j.raison === 'non_demande' && journal.length === 0);
await essai('« publique » alors que l’humain a choisi non répertoriée', 'normal', {...cle, DERUSH_YOUTUBE_PERMIS: '1', DERUSH_YOUTUBE_VISIBILITE: 'unlisted'}, ['--visibilite', 'public'], (r) => r.code === 1 && r.j.raison === 'visibilite' && journal.length === 0);
await essai('« publique » choisie par l’humain', 'normal', {...cle, DERUSH_YOUTUBE_PERMIS: '1', DERUSH_YOUTUBE_VISIBILITE: 'public'}, ['--visibilite', 'public'], (r) => r.code === 0 && r.j.visibilite === 'public');

console.log('— Pas de double envoi (vidéo d’un projet) —');
const lien = path.join(projet, 'exports', 'pack', 'a-publier', 'essai.mp4');
await essai('premier envoi, par le lien a-publier/', 'normal', cle, [], (r) => r.code === 0 && r.j.ok && !r.j.deja && entier() && Object.values(JSON.parse(fs.readFileSync(journalProjet, 'utf8')))[0].id === 'ESSAI_abc123', {fichier: lien});
await essai('second envoi du même fichier : rien ne part', 'normal', cle, [], (r) => r.code === 0 && r.j.ok && r.j.deja === true && r.j.lien === 'https://youtu.be/ESSAI_abc123' && /déjà sur YouTube/.test(r.j.note) && journal.length === 0, {fichier: videoProjet});
await essai('second envoi sans clé : le lien est rendu quand même', 'normal', {}, [], (r) => r.code === 0 && r.j.deja === true && journal.length === 0, {fichier: videoProjet});
await essai('--encore : l’humain veut la renvoyer', 'normal', cle, ['--encore'], (r) => r.code === 0 && r.j.ok && !r.j.deja && entier(), {fichier: videoProjet});
await essai('un envoi raté ne laisse pas de trace', 'quota', cle, ['--encore'], (r) => r.code === 1 && r.j.raison === 'quota' && Object.keys(JSON.parse(fs.readFileSync(journalProjet, 'utf8'))).length === 1, {fichier: videoProjet});
{
  // la commande arrêtée pendant qu'elle redemande à YouTube où en est la vidéo (délai de l'outil de l'IA, « Arrêter ») :
  // la vidéo est déjà sur la chaîne, le journal doit le dire avant cette attente
  fs.rmSync(journalProjet, {force: true});
  scenario = 'detail-lent'; recus = Buffer.alloc(0); journal = []; coupe = false;
  const p = spawn(process.execPath, [`${D}/outils/publier-youtube.mjs`, videoProjet, '--titre', TITRE], {env: {PATH: process.env.PATH, HOME: process.env.HOME, DERUSH_TREG_BASE: base, ...cle}});
  const lu = () => { try { return Object.values(JSON.parse(fs.readFileSync(journalProjet, 'utf8')))[0]?.id ?? null; } catch { return null; } };
  for (let i = 0; i < 100 && !(lu() && journal.some((x) => x.detail)); i++) await new Promise((ok) => setTimeout(ok, 100));
  const attend = p.exitCode === null && journal.some((x) => x.detail);
  const note = lu();
  p.kill('SIGKILL');
  await new Promise((ok) => (p.exitCode !== null || p.signalCode ? ok() : p.on('close', ok)));
  const bon = attend && note === 'ESSAI_abc123' && entier();
  console.log(`${bon ? '✓' : '✗'} arrêtée pendant la relecture chez YouTube : l’envoi est déjà noté${bon ? '' : ` (attend : ${attend}, noté : ${note}, reçu entier : ${entier()})`}`);
  resultats.push(bon);
}
await essai('relancée ensuite : la vidéo ne repart pas', 'normal', cle, [], (r) => r.code === 0 && r.j.ok && r.j.deja === true && r.j.lien === 'https://youtu.be/ESSAI_abc123' && journal.length === 0, {fichier: videoProjet});

console.log('— Le relais de Codex (la clé reste hors du bac à sable) —');
process.env.DERUSH_TREG_BASE = base;
process.env.TREG_TOKEN = CLE;
const {ouvrirRelais} = await import(`${D}/lib/relais.mjs`);
const atelier = path.join(projet, 'exports', 'pack');
const notes = [];
const ouvrir = (youtube) => ouvrirRelais(atelier, {youtube: youtube && {...youtube, videos: path.join(projet, 'vidéos'), surEnvoi: (t) => notes.push(t)}});
const parRelais = (relais, jeton = relais.jeton) => ({DERUSH_RELAIS: relais.url, DERUSH_RELAIS_JETON: jeton});
fs.rmSync(journalProjet, {force: true});
let relais = await ouvrir({permis: true, visibilite: 'unlisted'});
await essai('envoi par le relais', 'normal', parRelais(relais), [], (r) => r.code === 0 && r.j.ok && r.j.id === 'ESSAI_abc123' && entier() && ouv().jeton === CLE && notes.length === 1 && fs.existsSync(journalProjet), {fichier: lien});
await essai('le relais ne renvoie pas une vidéo déjà envoyée', 'normal', parRelais(relais), [], (r) => r.code === 0 && r.j.deja === true && journal.length === 0, {fichier: lien});
await essai('le relais refuse « publique » si l’humain a choisi autre chose', 'normal', parRelais(relais), ['--visibilite', 'public', '--encore'], (r) => r.code === 1 && r.j.raison === 'visibilite' && journal.length === 0, {fichier: lien});
await essai('le relais refuse une vidéo hors du projet', 'normal', parRelais(relais), [], (r) => r.code === 1 && r.j.raison === 'fichier' && journal.length === 0, {fichier: ailleurs});
await essai('le relais refuse un mauvais jeton', 'normal', parRelais(relais, 'faux'), [], (r) => r.code === 1 && r.j.raison === 'relais' && journal.length === 0, {fichier: lien});
await essai('le relais dit le refus de YouTube', 'quota', parRelais(relais), ['--encore'], (r) => r.code === 1 && r.j.raison === 'quota', {fichier: lien});
await relais.fermer?.();
relais = await ouvrir({permis: false, visibilite: null});
await essai('le relais refuse si YouTube n’a pas été demandé', 'normal', parRelais(relais), ['--encore'], (r) => r.code === 1 && r.j.raison === 'non_demande' && journal.length === 0, {fichier: lien});
await relais.fermer?.();

console.log('— Le relais par fichiers (la boîte : pour le bac à sable de Gemini, sans réseau local) —');
const ouvrirBoite = (youtube) => ouvrirRelais(atelier, {boite: true, youtube: youtube && {...youtube, videos: path.join(projet, 'vidéos'), surEnvoi: (t) => notes.push(t)}});
const parBoite = (relais, jeton = relais.jeton) => ({DERUSH_RELAIS_BOITE: relais.boite, DERUSH_RELAIS_JETON: jeton});
fs.rmSync(journalProjet, {force: true});
notes.length = 0;
relais = await ouvrirBoite({permis: true, visibilite: 'unlisted'});
await essai('la boîte existe, dans le dossier de travail', 'normal', {}, ['--help'], () => relais.boite === path.join(atelier, 'rendu', '.relais') && fs.statSync(relais.boite).isDirectory());
await essai('envoi par la boîte', 'normal', parBoite(relais), [], (r) => r.code === 0 && r.j.ok && r.j.id === 'ESSAI_abc123' && entier() && ouv().jeton === CLE && notes.length === 1 && fs.existsSync(journalProjet), {fichier: lien});
await essai('la boîte ne renvoie pas une vidéo déjà envoyée', 'normal', parBoite(relais), [], (r) => r.code === 0 && r.j.deja === true && journal.length === 0, {fichier: lien});
await essai('la boîte refuse « publique » si l’humain a choisi autre chose', 'normal', parBoite(relais), ['--visibilite', 'public', '--encore'], (r) => r.code === 1 && r.j.raison === 'visibilite' && journal.length === 0, {fichier: lien});
await essai('la boîte refuse une vidéo hors du projet', 'normal', parBoite(relais), [], (r) => r.code === 1 && r.j.raison === 'fichier' && journal.length === 0, {fichier: ailleurs});
await essai('la boîte refuse un mauvais jeton', 'normal', parBoite(relais, 'faux'), [], (r) => r.code === 1 && r.j.raison === 'relais' && journal.length === 0, {fichier: lien});
await essai('la boîte dit le refus de YouTube', 'quota', parBoite(relais), ['--encore'], (r) => r.code === 1 && r.j.raison === 'quota', {fichier: lien});
await essai('les demandes traitées ne restent pas dans la boîte', 'normal', {}, ['--help'], () => fs.readdirSync(relais.boite).every((f) => !/^demande-/.test(f)));
const boiteFermee = relais.boite;
await relais.fermer?.();
await essai('la boîte est retirée à la fin du travail', 'normal', {}, ['--help'], () => !fs.existsSync(boiteFermee));
relais = await ouvrirBoite({permis: false, visibilite: null});
await essai('la boîte refuse si YouTube n’a pas été demandé', 'normal', parBoite(relais), ['--encore'], (r) => r.code === 1 && r.j.raison === 'non_demande' && journal.length === 0, {fichier: lien});
await relais.fermer?.();

console.log(`\n${resultats.filter(Boolean).length} essais réussis sur ${resultats.length}`);
serveur.close();
// seul le dossier que cet essai a créé est effacé, et gardé si un essai a échoué (pour regarder)
const tousBons = resultats.every(Boolean);
if (tousBons) fs.rmSync(essais, {recursive: true, force: true});
else console.log(`Dossier d’essai gardé : ${essais}`);
process.exit(tousBons ? 0 : 1);
