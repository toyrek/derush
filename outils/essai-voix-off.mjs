// Dérush — les essais de la voix off proposée (lib/voix-off.mjs), pour qui modifie Dérush :
//   node outils/essai-voix-off.mjs [dossier où créer le dossier d'essai]
// Aucune vraie IA, aucun Drive, aucune clé, aucun micro. L'essai crée son propre dossier (« derush-essai-voix-off-… »)
// dans le dossier donné, ou dans le dossier temporaire du système : un dossier de Dérush, une bibliothèque, un faux Drive
// (DERUSH_SUPPORT, DERUSH_BIBLIOTHEQUE, DERUSH_DRIVE). Il n'efface que ce dossier à la fin (gardé si un essai échoue, ou
// avec DERUSH_ESSAI_GARDER=1 pour relire ce que l'IA a reçu).
// Pour ne jamais lancer une vraie IA, lib/ia.mjs est remplacé pendant l'essai (un crochet de chargement de Node) :
// l'état des assistants dit « Claude prêt », et ce Claude est un faux script qui parle comme lui et écrit reponse.json.
// L'essai vérifie que le faux Claude est bien le seul programme lancé. Les projets sont dessinés à la main (médias,
// textes Whisper, analyses) : rien n'est mesuré ni transcrit pour de vrai.
// Ce qui est vérifié : les dates de prise de vue, la parole comptée, l'avis (rushes muets, d'ambiance, parlés, pas encore
// écoutés, voix off déjà là, musique et prises de voix écartées), les questions par le faux moteur (ce qu'il lit, ce qui
// est gardé, une réponse vide refusée), les réponses écrites et enregistrées, le choix, le contexte posé pour l'IA de
// montage (et rien pour un projet qui n'en veut pas), le texte à lire recueilli, et les routes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {register} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
if (/^-/.test(process.argv[2] ?? '')) { console.log(`Usage : node ${path.relative(process.cwd(), process.argv[1])} [dossier temporaire]`); process.exit(0); }
const parent = path.resolve(process.argv[2] ?? os.tmpdir());
fs.mkdirSync(parent, {recursive: true});
const dejaLa = fs.readdirSync(parent);
const T = fs.mkdtempSync(path.join(parent, 'derush-essai-voix-off-'));
// AVANT tout import de lib/ : ces dossiers sont lus une seule fois, au chargement
const SUPPORT = path.join(T, 'support');
const BIBLIO = path.join(T, 'bibliotheque');
const DRIVE = path.join(T, 'drive');
for (const d of [SUPPORT, BIBLIO, DRIVE, path.join(T, 'tmp')]) fs.mkdirSync(d, {recursive: true});
process.env.DERUSH_SUPPORT = SUPPORT;
process.env.DERUSH_BIBLIOTHEQUE = BIBLIO;
process.env.DERUSH_DRIVE = DRIVE;
Object.assign(process.env, {DERUSH_SANS_MAJ: '1', DERUSH_SANS_NAVIGATEUR: '1', DERUSH_TREG_BASE: 'http://127.0.0.1:9', TMPDIR: path.join(T, 'tmp'), TEMP: path.join(T, 'tmp'), TMP: path.join(T, 'tmp')});
for (const k of ['TREG_TOKEN', 'ELEVENLABS_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY']) delete process.env[k];

// ——— le faux Claude, et lib/ia.mjs remplacé ———
const B = path.join(T, 'bouchons');
fs.mkdirSync(B, {recursive: true});
const FAUX_CLAUDE = path.join(B, 'faux-claude.mjs');
const JOURNAL = path.join(T, 'journal.jsonl');
process.env.FAUX_JOURNAL = JOURNAL;
fs.writeFileSync(FAUX_CLAUDE, `import fs from 'node:fs';
const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
let consigne = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { consigne += d; });
process.stdin.on('end', () => {
  const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
  fs.appendFileSync(process.env.FAUX_JOURNAL, JSON.stringify({args: process.argv.slice(2), consigne, regles: lire('CONSIGNES.md'), rushes: lire('rushes.md'),
    planches: fs.existsSync('planches') ? fs.readdirSync('planches') : [], cle: ['ELEVENLABS_API_KEY', 'TREG_TOKEN'].some((k) => k in process.env)}) + '\\n');
  out({type: 'system', subtype: 'init', session_id: 'faux', mcp_servers: []});
  if (process.env.FAUX_SCENARIO === 'vide') fs.writeFileSync('reponse.json', JSON.stringify({fil: '', questions: []}));
  else fs.writeFileSync('reponse.json', process.env.FAUX_REPONSE ?? '{}');
  out({type: 'assistant', message: {content: [{type: 'text', text: 'Questions prêtes.'}]}});
  out({type: 'result', result: 'Questions prêtes.', is_error: false});
  setTimeout(() => process.exit(0), 20);
});
`);
const vrai = (f) => `${pathToFileURL(path.join(D, 'lib', f)).href}?vrai`;
fs.writeFileSync(path.join(B, 'faux-ia.mjs'), `export * from '${vrai('ia.mjs')}';
export async function etatIA() {
  return {claude: {ok: true, chemin: ${JSON.stringify(FAUX_CLAUDE)}, version: '0.0.0', modeles: []}, codex: {ok: false, pourquoi: 'absent (essai)'}, gemini: {ok: false, pourquoi: 'absent (essai)'}, choisi: 'claude'};
}
// jamais un autre programme que le faux Claude
export function commandeLancement(chemin) {
  if (chemin !== ${JSON.stringify(FAUX_CLAUDE)}) throw new Error('essai : programme inattendu ' + chemin);
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

const V = await import(`${D}/lib/voix-off.mjs`);
const {Projet} = await import(`${D}/lib/projet.mjs`);
const {reglageIA} = await import(`${D}/lib/ia.mjs`);

let bons = 0;
let total = 0;
const echecs = [];
const essai = async (quoi, verifier) => {
  total++;
  let r;
  try { r = await verifier(); } catch (e) { r = `a levé : ${e.message}`; }
  const bon = r === true;
  if (bon) bons++; else echecs.push(quoi);
  console.log(`${bon ? '✓' : '✗'} ${quoi}${bon ? '' : `\n   ${typeof r === 'string' ? r : JSON.stringify(r)?.slice(0, 600)}`}`);
};
const leve = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
const attendre = async (cond, ms = 20000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) return false; await pause(50); } return true; };
const journal = () => { try { return fs.readFileSync(JOURNAL, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };

// ——— des projets dessinés à la main ———
const SON = {codec: 'aac', canaux: 2, frequence: 48000};
/** Des mots de Whisper : un mot toutes les 0,4 s entre debut et fin. */
const parler = (debut, fin, mot = 'oui') => { const w = []; for (let t = debut; t + 0.35 <= fin; t += 0.4) w.push({t: mot, d: Math.round(t * 100) / 100, f: Math.round((t + 0.35) * 100) / 100}); return w; };
const projet = (nom, champs = {}) => { const P = new Projet(path.join(BIBLIO, nom)); Object.assign(P.d, champs); P.sauver(); return P; };
function media(P, {id, nom, type = 'video', duree = 30, son = true, mots, date, lieu, dossier = null, etapes = {}}) {
  const chemin = path.join(dossier ?? P.racine, nom);
  fs.mkdirSync(path.dirname(chemin), {recursive: true});
  fs.writeFileSync(chemin, `faux ${nom}`);
  const m = {id, nom, chemin, type, duree, audio: son ? SON : null, etat: 'pret', etapes: {...etapes}, transcription: null,
    tournage: {...(date ? {date} : {}), ...(lieu ? {lieu} : {})}, ajoute_le: new Date().toISOString()};
  if (mots) {
    fs.writeFileSync(path.join(P.dossierMedia(id), 'mots.json'), JSON.stringify({moteur: 'essai', mots}));
    m.transcription = {moteur: 'essai', mots: mots.length, cree_le: new Date().toISOString()};
    m.etapes.texte = true;
  }
  P.d.medias.push(m);
  P.sauver();
  return m;
}
/** Le texte d'un enregistrement arrive (comme Whisper le ferait) : son fichier mots.json et la marque du média. */
function transcrit(P, m, mots) {
  fs.writeFileSync(path.join(P.dossierMedia(m.id), 'mots.json'), JSON.stringify({moteur: 'essai', mots}));
  m.transcription = {moteur: 'essai', mots: mots.length, cree_le: new Date(Date.now() + 1000).toISOString()};
  P.sauver();
}

console.log('— Les dates de prise de vue, la parole —');
await essai('une date d’iPhone (avec son fuseau) donne le jour et l’heure du lieu, exacts', () => {
  const d = V.lireDatePrise('2026-03-20T09:14:00+0900');
  return (d?.jour === 'vendredi 20 mars 2026' && d.heure === '09 h 14' && d.approx === false && d.cle_jour === '2026-03-20') || d;
});
await essai('une date en temps universel (« Z ») est lue, et dite approximative', () => { const d = V.lireDatePrise('2026-03-20T00:14:00.000000Z'); return (d?.approx === true && /2026/.test(d.jour)) || d; });
await essai('la date tirée du nom d’un fichier (téléphone, WhatsApp), et rien pour un nom sans date', () => {
  const a = V.dateDuNom('IMG_20260321_181200.MOV');
  const b = V.dateDuNom('VID-20260320-WA0003.mp4');
  return (a?.jour === 'samedi 21 mars 2026' && a.heure === '18 h 12' && b?.jour === 'vendredi 20 mars 2026' && b.heure === null && V.dateDuNom('C0042.MP4') === null && V.lireDatePrise('n’importe quoi') === null) || {a, b};
});
await essai('Android au Japon (temps universel, nom à l’heure du lieu) : l’heure vécue vient du nom ; un nom d’un autre jour ne compte pas', () => {
  const a = V.datePrise({nom: 'VID_20241108_083012.mp4', tournage: {date: '2024-11-07T23:30:12.000000Z'}});
  const b = V.datePrise({nom: 'IMG_0010.MOV', tournage: {date: '2024-11-08T09:15:00+0900'}});
  const c = V.datePrise({nom: 'VID_20240101_120000.mp4', tournage: {date: '2024-11-07T23:30:12.000000Z'}});
  return (a?.jour === 'vendredi 8 novembre 2024' && a.heure === '08 h 30' && a.source === 'nom' && b?.heure === '09 h 15' && b.source === 'camera' && c?.source === 'camera' && c.approx === true) || {a, b, c};
});
await essai('la parole se compte en phrases : les mots voisins se suivent, un silence coupe', () => {
  const s = V.secondesDeParole([{t: 'a', d: 0, f: 0.4}, {t: 'b', d: 0.5, f: 0.9}, {t: 'c', d: 3, f: 3.4}, {t: '(rires)', d: 5, f: 9, ev: true}]);
  return Math.abs(s - 1.3) < 1e-9 || s;
});

console.log('— L’avis, sans IA —');
const J = projet('Japon', {titre: 'Séjour au Japon'});
J.d.brief.type = 'trend';
J.sauver();
media(J, {id: 'M1', nom: 'IMG_0042.MOV', son: false, date: '2026-03-20T09:14:00+0900', lieu: 'Kyoto, gare'});
media(J, {id: 'M2', nom: 'IMG_0043.MOV', son: false, date: '2026-03-20T12:40:00+0900'});
media(J, {id: 'M3', nom: 'IMG_20260321_181200.MOV', son: false});
// ce que l'analyse par l'IA a vu dans M1, et sa planche
fs.writeFileSync(path.join(J.dossierMedia('M1'), 'ia.json'), JSON.stringify({resume: 'Arrivée à la gare de Kyoto, foule et panneaux.', contenu: ['gare', 'foule'], moments: [{debut: 3, fin: 9, quoi: 'le quai', force: 4}], usage: 'ouverture'}));
fs.writeFileSync(path.join(J.dossierMedia('M1'), 'planche.jpg'), 'fausse planche');
let a = V.avisVoixOff(J);
await essai('trois rushes muets d’un voyage : voix off conseillée, 0 s de parole sur 90 s', () => (a.conseillee && a.parole_s === 0 && a.duree_s === 90 && a.muets === 3 && /parlent très peu/.test(a.pourquoi)) || a);
media(J, {id: 'M4', nom: 'musique.mp3', type: 'audio', duree: 120, mots: []});
await essai('une musique (un son seul sans parole) ne compte pas comme un rush', () => { const b = V.avisVoixOff(J); return (b.duree_s === 90 && b.conseillee) || b; });

const F = projet('Face', {titre: 'Mon avis sur le tome 3'});
F.d.brief.type = 'face';
media(F, {id: 'M1', nom: 'face.mov', duree: 60, mots: parler(1, 56)});
a = V.avisVoixOff(F);
await essai('un face caméra qui parle presque tout le temps : pas de voix off', () => (!a.conseillee && a.part_parole > 0.8 && a.parles === 1 && /parlent déjà/.test(a.pourquoi)) || a);

const A = projet('Balade', {titre: 'Balade du dimanche'});
media(A, {id: 'M1', nom: 'rue.mov', duree: 40, mots: []});
media(A, {id: 'M2', nom: 'parc.mov', duree: 40, mots: parler(10, 11.5)});
a = V.avisVoixOff(A);
await essai('des rushes avec seulement de l’ambiance (quelques mots) : voix off conseillée', () => (a.conseillee && a.ambiance === 2 && a.parole_s > 1 && a.parole_s < 2) || a);

const E = projet('Reunion', {titre: 'Réunion de quartier'});
media(E, {id: 'M1', nom: 'salle.mov', duree: 50});
a = V.avisVoixOff(E);
const Ev = projet('Osaka', {titre: 'Vlog à Osaka'});
media(Ev, {id: 'M1', nom: 'rue.mov', duree: 50});
const av = V.avisVoixOff(Ev);
await essai('des rushes pas encore écoutés : Dérush attend, sauf pour un vlog où la voix off est déjà conseillée', () => (!a.conseillee && a.en_attente && a.a_ecouter === 1 && av.conseillee && av.en_attente) || {a, av});

const Dj = projet('Deja');
media(Dj, {id: 'M1', nom: 'plan.mov', son: false});
media(Dj, {id: 'M2', nom: 'ma-voix.m4a', type: 'audio', duree: 25, mots: parler(0, 20)});
Dj.d.superpositions.push({id: 'S1', media: 'M2', voix_off: true, debut: 0, entree: 0, sortie: 25});
Dj.sauver();
a = V.avisVoixOff(Dj);
await essai('une voix off déjà posée (marquée voix_off) : rien à proposer, et elle ne compte pas comme un rush', () => (!a.conseillee && a.deja && a.rushes === 1) || a);
const Mv = projet('ModeVoix', {mode: 'voix'});
media(Mv, {id: 'M1', nom: 'plan.mov', duree: 20});
await essai('le mode « Voix off » sans voix posée : conseillée, même avant d’avoir écouté les rushes', () => { const b = V.avisVoixOff(Mv); return (b.conseillee && /mode « Voix off »/.test(b.pourquoi)) || b; });
const vide = projet('Vide');
await essai('un projet sans rushes : pas d’avis, et pas de questions possibles', () => (!V.avisVoixOff(vide).conseillee && /rushes/.test(leve(() => V.questionsVoixOff(vide)) ?? '')) || V.avisVoixOff(vide));

console.log('— Les questions, par un faux moteur —');
await essai('l’état et l’avis ne lancent aucune IA (rien ne part sans un clic), et disent ce qu’elle lirait', () => {
  const x = V.etatVoixOff(J, {elevenlabs: false});
  return (journal().length === 0 && x.envoi.rushes === 3 && x.envoi.planches === 1 && x.micro.allume && x.questions.length === 0) || x;
});
const REPONSE = {fil: 'Arrivée à Kyoto le matin, le marché à midi, puis le soir à Osaka.', questions: [
  {texte: 'Qu’as-tu ressenti en descendant du train à Kyoto ?', medias: ['M1'], debut: 3, fin: 9, pourquoi: 'ouvrir le film'},
  {texte: 'Qu’est-ce qui t’a surpris au marché ?', medias: ['M2'], debut: 500, fin: 600},
  {texte: 'Où étiez-vous en arrivant le soir ?', medias: ['M99'], debut: 2, fin: 4},
  {texte: ''},
]};
process.env.FAUX_REPONSE = JSON.stringify(REPONSE);
const suivi = V.questionsVoixOff(J, {demande: 'Fais-moi un vlog de la journée du vendredi'});
await attendre(() => V.etatQuestions(J)?.etat !== 'en_cours');
const lance = journal()[0];
await essai('les questions partent sur un clic, par une IA légère (niveau « Rapide ») sans web, sans terminal et sans clé', () => {
  const args = lance?.args ?? [];
  const outils = args.slice(args.indexOf('--tools') + 1);
  return (suivi?.etat === 'en_cours' && V.etatQuestions(J)?.etat === 'fini' && journal().length === 1 && args[args.indexOf('--model') + 1] === reglageIA('claude', 'rapide').modele
    && outils.includes('Read') && outils.includes('Write') && !outils.some((o) => /WebSearch|WebFetch|Bash/.test(o)) && args.includes('--strict-mcp-config') && lance.cle === false) || {suivi, etat: V.etatQuestions(J), args};
});
await essai('l’IA lit les rushes dans l’ordre du tournage, jour par jour, avec l’heure, le lieu, l’analyse et la planche', () => {
  const r = lance?.rushes ?? '';
  const i1 = r.indexOf('M1 ·');
  const i2 = r.indexOf('M2 ·');
  const i3 = r.indexOf('M3 ·');
  return (/## Vendredi 20 mars 2026/.test(r) && /## Samedi 21 mars 2026/.test(r) && /09 h 14/.test(r) && /Kyoto, gare/.test(r) && /gare de Kyoto/.test(r) && /muet/.test(r)
    && i1 < i2 && i2 < i3 && !/M4 ·/.test(r) && lance.planches.join() === 'M1.jpg' && /journée du vendredi/.test(lance.consigne) && /reponse\.json/.test(lance.consigne) && /tutoiement/.test(lance.regles)) || r.slice(0, 900);
});
let x = V.etatVoixOff(J, {elevenlabs: false});
await essai('les questions sont gardées : des rushes qui existent, des temps dans le rush, le fil et la demande', () => {
  const [q1, q2, q3] = x.questions;
  return (x.questions.length === 3 && q1.id === 'Q1' && q1.moment.quand === 'vendredi 20 mars 2026 à 09 h 14' && q1.moment.debut === 3 && q2.moment.debut === 29.5 && q2.moment.fin === 30
    && q3.moment === null && /Kyoto/.test(x.fil) && /vendredi/.test(x.demande) && x.moteur === 'claude' && x.micro.allume) || x.questions;
});
process.env.FAUX_SCENARIO = 'vide';
V.questionsVoixOff(J);
await attendre(() => V.etatQuestions(J)?.etat !== 'en_cours');
await essai('une IA qui ne rend aucune question : une erreur claire, et les questions d’avant restent', () => {
  const s = V.etatQuestions(J);
  return (s?.etat === 'erreur' && /aucune question/.test(s.erreur) && V.etatVoixOff(J, {elevenlabs: false}).questions.length === 3) || s;
});
delete process.env.FAUX_SCENARIO;

console.log('— Les réponses —');
const prises = [];
const file = {ajouter(nom, fn, meta) { prises.push({nom, meta}); return {}; }};
V.repondre(J, {question: 'Q1', texte: 'J’étais crevé, mais la gare était immense.'});
const enr = media(J, {id: 'M20', nom: 'voix-off-20261114-101500.m4a', type: 'audio', duree: 18, dossier: path.join(J.racine, 'enregistrements')});
V.repondre(J, {question: 'Q2', media: 'M20'}, {file});
x = V.etatVoixOff(J, {elevenlabs: false});
await essai('une réponse écrite est rangée, une réponse dite au micro passe en tête de la file pour recevoir son texte', () => {
  const [q1, q2] = x.questions;
  return (q1.reponse?.texte === 'J’étais crevé, mais la gare était immense.' && q2.reponse?.media?.id === 'M20' && q2.reponse.media.texte === null && q2.reponse.media.en_cours === true
    && prises.length === 1 && prises[0].meta.prioritaire === true && prises[0].meta.media === 'M20' && x.repondues === 2 && [...V.mediasReponses(J)].join() === 'M20') || {q: x.questions.slice(0, 2), prises};
});
transcrit(J, enr, [{t: 'Les', d: 0.2, f: 0.4}, {t: 'fraises', d: 0.45, f: 0.9}, {t: 'géantes,', d: 0.95, f: 1.4}, {t: 'incroyable.', d: 1.5, f: 2.2}]);
x = V.etatVoixOff(J, {elevenlabs: false});
await essai('une fois transcrite, la réponse enregistrée a son texte', () => (x.questions[1].reponse.media.texte === 'Les fraises géantes, incroyable.' && x.questions[1].reponse.media.en_cours === false) || x.questions[1].reponse);
await essai('les réponses enregistrées ne comptent pas comme des rushes (l’avis ne bouge pas)', () => { const b = V.avisVoixOff(J); return (b.rushes === 3 && b.duree_s === 90) || b; });
await essai('une réponse à une question inconnue, un enregistrement absent ou sans son : refusés', () => {
  const m = media(J, {id: 'M21', nom: 'muet.mov', son: false});
  const r = [leve(() => V.repondre(J, {question: 'Q42', texte: 'x'})), leve(() => V.repondre(J, {question: 'Q1', media: 'M404'})), leve(() => V.repondre(J, {question: 'Q1', media: m.id}))];
  J.d.medias = J.d.medias.filter((y) => y.id !== 'M21');
  J.sauver();
  return (/n’existe plus/.test(r[0]) && /pas dans le projet/.test(r[1]) && /pas de son/.test(r[2])) || r;
});
V.repondre(J, {question: 'Q3', texte: 'Dans le quartier de Namba.'});
const videe = V.repondre(J, {question: 'Q3', texte: ''});
await essai('une réponse vidée est retirée', () => (videe === null && V.etatVoixOff(J, {elevenlabs: false}).questions[2].reponse === null) || videe);
process.env.FAUX_REPONSE = JSON.stringify({fil: '', questions: [{texte: 'Quel goût avaient les fraises ?', medias: ['M2'], debut: 4, fin: 8}]});
V.questionsVoixOff(J, {demande: 'vlog du vendredi'});
await attendre(() => V.etatQuestions(J)?.etat !== 'en_cours');
x = V.etatVoixOff(J, {elevenlabs: false});
await essai('de nouvelles questions : celles qui ont une réponse restent, les autres partent, les numéros ne reviennent jamais', () => (x.questions.map((q) => q.id).join() === 'Q1,Q2,Q4' && /Kyoto/.test(x.fil) && x.questions[1].reponse.media.id === 'M20') || x.questions.map((q) => q.id));
await essai('l’IA qui repose des questions sait ce qui a déjà été raconté (et ce qui a été dit au micro)', () => { const r = journal().at(-1)?.rushes ?? ''; return (/déjà raconté/.test(r) && /gare était immense/.test(r) && /fraises géantes/.test(r)) || r.slice(0, 600); });

console.log('— Le choix —');
await essai('« ElevenLabs » sans ElevenLabs, « mes réponses » sans enregistrement, un choix inconnu : refusés', () => {
  const r = [leve(() => V.choisirVoixOff(J, 'ia', {elevenlabs: false})), leve(() => V.choisirVoixOff(A, 'reponses', {elevenlabs: false})), leve(() => V.choisirVoixOff(J, 'bof', {elevenlabs: false}))];
  return (/ElevenLabs n’est pas branché/.test(r[0]) && /Enregistre d’abord/.test(r[1]) && /inconnu/.test(r[2])) || r;
});
V.choisirVoixOff(J, 'moi', {elevenlabs: false});
x = V.etatVoixOff(J, {elevenlabs: false});
await essai('« je l’enregistre moi-même » : le micro reste allumé, les choix possibles sont dits', () => (x.choix === 'moi' && x.micro.allume && x.choix_possibles.reponses.ok && !x.choix_possibles.ia.ok && /ElevenLabs/.test(x.choix_possibles.ia.pourquoi ?? '')) || x);

console.log('— Le contexte de l’IA de montage —');
const atelier = path.join(J.racine, 'exports', 'pack-essai');
fs.mkdirSync(atelier, {recursive: true});
let r = V.installerVoixOff(atelier, J, {elevenlabs: false});
let md = fs.readFileSync(path.join(atelier, 'contexte', 'voix-off.md'), 'utf8');
await essai('« moi » : contexte/voix-off.md porte l’avis, le fil, les questions, les réponses, et ce qu’il faut écrire', () => (r?.mode === 'moi' && r.fichier === 'contexte/voix-off.md'
  && /Q1 · Qu’as-tu ressenti/.test(md) && /gare était immense/.test(md) && /fraises géantes/.test(md) && /vendredi 20 mars 2026 à 09 h 14/.test(md) && /voix-off\/texte\.json/.test(md)
  && /bouton du micro/.test(md) && /Arrivée à Kyoto/.test(md) && !fs.existsSync(path.join(atelier, 'contexte', 'voix-off'))
  && /contexte\/voix-off\.md/.test(V.consigneVoixOff(r)) && /voix-off\/texte\.json/.test(V.consigneVoixOff(r)) && /relis contexte\/voix-off\.md/.test(V.rappelVoixOff(r))) || {r, md: md.slice(0, 500)});
V.choisirVoixOff(J, 'reponses', {elevenlabs: false});
r = V.installerVoixOff(atelier, J, {elevenlabs: false});
md = fs.readFileSync(path.join(atelier, 'contexte', 'voix-off.md'), 'utf8');
const rep = path.join(atelier, 'contexte', 'voix-off', 'reponses');
await essai('« mes réponses » : les enregistrements et leurs mots sont posés pour l’IA, qui sait les monter', () => {
  const j = JSON.parse(fs.readFileSync(path.join(rep, 'Q2-M20.json'), 'utf8'));
  return (r.mode === 'reponses' && fs.readFileSync(path.join(rep, 'Q2-M20.m4a'), 'utf8') === 'faux voix-off-20261114-101500.m4a' && j.mots.length === 4 && j.mots[1].t === 'fraises'
    && /Ses réponses dites au micro font la voix off/.test(md) && /contexte\/voix-off\/reponses\/Q2-M20\.m4a/.test(md) && /monte-les/.test(V.consigneVoixOff(r))) || {r, md: md.slice(-900)};
});
V.choisirVoixOff(J, 'ia', {elevenlabs: true});
r = V.installerVoixOff(atelier, J, {elevenlabs: true});
md = fs.readFileSync(path.join(atelier, 'contexte', 'voix-off.md'), 'utf8');
const sansCle = V.installerVoixOff(atelier, J, {elevenlabs: false});
const mdSans = fs.readFileSync(path.join(atelier, 'contexte', 'voix-off.md'), 'utf8');
await essai('« ton IA la fait dire » : ElevenLabs s’il est branché, sinon le texte à lire (et les enregistrements d’avant sont retirés)', () => (r.mode === 'ia' && /voix ElevenLabs/.test(md) && /ElevenLabs/.test(V.consigneVoixOff(r))
  && sansCle.mode === 'moi' && /n’est plus branché/.test(mdSans) && !fs.existsSync(rep)) || {r, sansCle});

const atF = path.join(F.racine, 'exports', 'pack-essai');
fs.mkdirSync(path.join(atF, 'contexte', 'voix-off'), {recursive: true});
fs.writeFileSync(path.join(atF, 'contexte', 'voix-off.md'), 'ancien');
r = V.installerVoixOff(atF, F, {elevenlabs: true});
await essai('un projet qui n’en a pas besoin (face caméra, rien demandé) : rien n’est posé, l’ancien contexte est retiré, aucune consigne', () => (r === null && !fs.existsSync(path.join(atF, 'contexte', 'voix-off.md')) && !fs.existsSync(path.join(atF, 'contexte', 'voix-off')) && V.consigneVoixOff(r) === '' && V.rappelVoixOff(r) === '') || r);
V.choisirVoixOff(Ev, 'aucune', {elevenlabs: false});
const atEv = path.join(Ev.racine, 'exports', 'pack-essai');
r = V.installerVoixOff(atEv, Ev, {elevenlabs: true});
await essai('« pas de voix off » : rien n’est posé, la consigne dit de ne pas en proposer, plus de questions possibles', () => (r?.choix === 'aucune' && !fs.existsSync(path.join(atEv, 'contexte', 'voix-off.md'))
  && /n’en veut pas/.test(V.consigneVoixOff(r)) && !V.avisVoixOff(Ev).conseillee && /change ce choix/.test(leve(() => V.questionsVoixOff(Ev)) ?? '') && !V.etatVoixOff(Ev, {elevenlabs: false}).micro.allume) || r);
const atA = path.join(A.racine, 'exports', 'pack-essai');
r = V.installerVoixOff(atA, A, {elevenlabs: false});
md = fs.readFileSync(path.join(atA, 'contexte', 'voix-off.md'), 'utf8');
await essai('voix off conseillée, rien encore décidé : l’IA de montage la propose à la fin, avec ses questions dans voix-off/questions.json', () => (r?.mode === null && /Propose une voix off à la fin de ta réponse/.test(md)
  && /voix-off\/questions\.json/.test(md) && /propose-la à la fin/.test(V.consigneVoixOff(r))) || {r, md});

console.log('— Le texte à lire, et les questions de l’IA de montage —');
const debutIA = Date.now() - 1000;
fs.mkdirSync(path.join(atelier, 'voix-off'), {recursive: true});
fs.writeFileSync(path.join(atelier, 'voix-off', 'texte.json'), JSON.stringify({titre: 'Vendredi à Kyoto', moments: [
  {debut: 6, fin: 12, plans: 'le marché', texte: 'À midi, le marché de Nishiki : des fraises grosses comme le poing.'},
  {debut: 0, fin: 6, plans: 'la gare', texte: 'Vendredi matin, Kyoto.'},
  {debut: 12, texte: ''},
  {debut: 14, fin: 15, texte: 'Le soir, on a pris le train pour Osaka, fatigués mais heureux, en regardant défiler les lumières de la ville.'},
]}));
V.choisirVoixOff(J, 'moi', {elevenlabs: false});
r = V.recueillirVoixOff(atelier, J, debutIA);
let t = V.texteALire(J);
await essai('le texte écrit par l’IA est recueilli dans le projet, découpé par moment, dans l’ordre du film', () => (r.texte && t?.titre === 'Vendredi à Kyoto' && t.moments.length === 3 && t.moments[0].texte === 'Vendredi matin, Kyoto.'
  && t.moments[0].lecture_s === 1.2 && !t.moments[0].trop_long && t.moments[2].trop_long && t.source === 'ia' && t.mots > 20) || {r, t});
await essai('le temps de lecture ne compte que les mots : la ponctuation à la française (« : », « ? ») ne se lit pas', () => (t?.moments[1]?.mots === 12 && t.moments[1].lecture_s === 4.8) || t?.moments[1]);
x = V.etatVoixOff(J, {elevenlabs: false});
await essai('« moi », texte prêt : le micro s’allume pour l’enregistrer en le lisant', () => (x.micro.allume && /texte est prêt/.test(x.micro.pourquoi) && x.texte?.moments === 3) || x.micro);
const vieux = path.join(atA, 'voix-off', 'texte.json');
fs.mkdirSync(path.dirname(vieux), {recursive: true});
fs.writeFileSync(vieux, JSON.stringify({moments: [{debut: 0, fin: 3, texte: 'Un vieux texte.'}]}));
fs.utimesSync(vieux, new Date(Date.now() - 3600e3), new Date(Date.now() - 3600e3));
fs.writeFileSync(path.join(atA, 'voix-off', 'questions.json'), JSON.stringify({fil: 'Une balade, du matin au parc.', questions: [{texte: 'Pourquoi cette rue-là ?', medias: ['M1'], debut: 2, fin: 6}]}));
r = V.recueillirVoixOff(atA, A, debutIA);
x = V.etatVoixOff(A, {elevenlabs: false});
await essai('un texte d’une demande précédente est ignoré ; les questions posées par l’IA de montage arrivent dans la carte', () => (!r.texte && r.questions === 1 && V.texteALire(A) === null && x.proposee
  && x.questions[0].source === 'montage' && x.questions[0].id === 'Q1' && x.micro.allume) || {r, x: x.questions});
await essai('la personne peut retoucher le texte (ou l’écrire) ; un texte vide est refusé', () => {
  const v = V.ecrireTexte(J, {titre: 'À moi', moments: [{debut: 0, fin: 5, texte: 'Mon texte à moi.'}]});
  return (v.source === 'humain' && v.moments.length === 1 && /vide/.test(leve(() => V.ecrireTexte(J, {moments: [{debut: 0, texte: ' '}]})) ?? '')) || v;
});

console.log('— Les routes —');
class ErreurHttp extends Error { constructor(code, message) { super(message); this.code = code; } }
const appeler = async (P, methode, p, corps = {}, ctx = {}) => {
  const res = {};
  const aides = {envoyerJson: (r, code, data) => { r.code = code; r.data = data; }, lireCorps: async () => corps, ErreurHttp, projet: () => P, elevenlabs: false};
  try {
    const u = new URL(`http://127.0.0.1${p}`);
    const fait = await V.routesVoixOff({method: methode}, res, u.pathname, u, {P, ...ctx}, aides);
    return {fait, ...res};
  } catch (e) { return {erreur: e.message, code: e.code}; }
};
let g = await appeler(J, 'GET', '/api/voix-off');
await essai('GET /api/voix-off : l’avis, le micro, les questions, le choix, le texte, ce que l’IA lirait', () => (g.fait === true && g.code === 200 && g.data.avis && g.data.micro && g.data.questions.length === 3 && g.data.choix === 'moi' && g.data.texte?.moments === 1 && g.data.envoi.rushes === 3) || g);
g = await appeler(J, 'GET', '/api/autre');
const pasOuvert = await V.routesVoixOff({method: 'GET'}, {}, '/api/voix-off', new URL('http://127.0.0.1/api/voix-off'), {P: null}, {envoyerJson() {}, lireCorps: async () => ({}), ErreurHttp, projet: () => { throw new ErreurHttp(409, 'Aucun projet ouvert.'); }}).catch((e) => e.code);
await essai('une autre adresse n’est pas pour ces routes ; sans projet ouvert, 409', () => (g.fait === false && pasOuvert === 409) || {g, pasOuvert});
g = await appeler(J, 'POST', '/api/voix-off/choix', {choix: 'ia'});
const g2 = await appeler(J, 'POST', '/api/voix-off/reponses', {question: 'Q4', texte: 'Sucrées comme du miel.'}, {file});
await essai('POST choix refusé (ElevenLabs absent) : erreur 400 ; POST réponses : rangée, état rendu', () => (g.code === 400 && /ElevenLabs/.test(g.erreur) && g2.code === 200 && g2.data.reponse.texte === 'Sucrées comme du miel.' && g2.data.voix_off.repondues === 3) || {g, g2});
g = await appeler(J, 'GET', '/api/voix-off/texte');
const g3 = await appeler(J, 'POST', '/api/voix-off/texte', {moments: [{debut: 0, fin: 4, texte: 'Vendredi, Kyoto.'}, {debut: 4, fin: 8, texte: 'Le marché.'}]});
await essai('GET et POST du texte à lire', () => (g.data?.texte?.moments?.[0]?.texte === 'Mon texte à moi.' && g3.data?.texte?.moments?.length === 2) || {g, g3});
const avant = journal().length;
process.env.FAUX_REPONSE = JSON.stringify({fil: 'Le fil.', questions: [{texte: 'Comment s’appelait ce temple ?', medias: ['M3']}]});
g = await appeler(A, 'POST', '/api/voix-off/questions', {moteur: 'claude', demande: 'balade', qualite: 'n’importe'});
await attendre(() => V.etatQuestions(A)?.etat !== 'en_cours');
await essai('POST questions : l’IA part (une fois), le suivi est rendu, les questions arrivent', () => (g.code === 200 && g.data.suivi?.etat === 'en_cours' && journal().length === avant + 1 && V.etatQuestions(A).etat === 'fini'
  && V.etatVoixOff(A, {elevenlabs: false}).questions.some((q) => q.texte === 'Comment s’appelait ce temple ?')) || {g, s: V.etatQuestions(A)});
g = await appeler(A, 'DELETE', '/api/voix-off');
await essai('DELETE : la voix off du projet est oubliée (les médias restent)', () => (g.code === 200 && V.etatVoixOff(A, {elevenlabs: false}).questions.length === 0 && A.d.medias.length === 2) || g);
await essai('en tout, le faux Claude n’a été lancé qu’aux quatre clics de l’essai', () => journal().length === 4 || journal().length);

// la fin : seul le dossier que cet essai a créé est effacé (gardé si un essai a échoué, pour regarder)
const tousBons = bons === total;
const garder = !!process.env.DERUSH_ESSAI_GARDER; // pour relire ce que l'IA a reçu (journal.jsonl, contexte/voix-off.md)
if (tousBons && !garder) fs.rmSync(T, {recursive: true, force: true});
await essai('le dossier donné n’a rien perdu : seul le dossier d’essai créé dedans est effacé', () => (path.dirname(T) === parent && dejaLa.every((n) => fs.existsSync(path.join(parent, n))) && (!tousBons || garder || !fs.existsSync(T))) || T);
console.log(`\n${bons} essais réussis sur ${total}`);
if (bons !== total || garder) console.log(`Dossier d’essai gardé : ${T}\nÉchecs : ${echecs.join(' | ')}`);
process.exit(bons === total ? 0 : 1);
