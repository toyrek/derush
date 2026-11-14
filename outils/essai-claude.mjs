// Dérush — les essais du travail de l'IA de montage (lib/claude.mjs) et du relais de rendu (lib/relais.mjs), pour qui
// modifie Dérush. Aucune vraie IA, aucun compte, aucun appel réel :
//   node outils/essai-claude.mjs [dossier où créer le dossier d'essai]
// L'essai crée son propre dossier (« derush-essai-claude-… ») dans le dossier donné, ou dans le dossier temporaire du
// système : un dossier de Dérush, une bibliothèque et des sons jetables (DERUSH_SUPPORT, DERUSH_BIBLIOTHEQUE,
// DERUSH_SONS). Il n'efface que ce dossier à la fin (il le garde si un essai échoue).
// Pour ne jamais lancer une vraie IA, cinq modules de lib/ sont remplacés pendant l'essai (des crochets de chargement
// de Node) : ia.mjs (l'état des assistants dit « Claude prêt », et ce Claude est un faux script qui parle comme lui),
// sons.mjs (installerSons attend, comme une bibliothèque qui se range), rendu.mjs (le moteur de rendu est dit installé),
// pack.mjs (un dossier de travail minimal, sans FFmpeg) et disque.mjs (50 Go libres simulés : un disque presque plein
// refuserait chaque demande, et rien de lourd n'est écrit ici). L'essai vérifie que le faux Claude est bien celui qui serait
// lancé avant d'envoyer la moindre demande. Le relais rend avec un faux Remotion rangé dans le dossier d'essai.
// Ce qui est vérifié : deux demandes presque en même temps (une seule IA part), « Arrêter » pendant la préparation (l'IA
// ne part pas), « Pour qui ? » changé (dossier et conversation neufs), la clé Treg absente quand Treg est coupé, un
// projet qui ne s'écrit plus (Dérush ne s'arrête pas, la fin reste visible), les liens que le relais refuse (à la
// demande, juste avant le rendu, et après lui), la voix off (contexte, consigne, rappel, questions et texte rangés à la
// fin) et la consigne des rushes du Drive (« Depuis mon Drive »). Le Drive est un faux dossier (DERUSH_DRIVE), jamais
// celui de l'ordinateur.
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
const T = fs.mkdtempSync(path.join(parent, 'derush-essai-claude-'));
// AVANT tout import de lib/ : ces dossiers sont lus une seule fois, au chargement
const SUPPORT = path.join(T, 'support');
const BIBLIO = path.join(T, 'bibliotheque');
for (const d of [SUPPORT, BIBLIO, path.join(T, 'sons'), path.join(T, 'tmp')]) fs.mkdirSync(d, {recursive: true});
Object.assign(process.env, {DERUSH_SUPPORT: SUPPORT, DERUSH_BIBLIOTHEQUE: BIBLIO, DERUSH_SONS: path.join(T, 'sons'), DERUSH_SANS_MAJ: '1', DERUSH_SANS_NAVIGATEUR: '1',
  DERUSH_TREG_BASE: 'http://127.0.0.1:9', TMPDIR: path.join(T, 'tmp'), TEMP: path.join(T, 'tmp'), TMP: path.join(T, 'tmp'),
  // un Drive d'essai (absent tant que l'essai du Drive ne le crée pas) : jamais ~/Library/CloudStorage
  DERUSH_DRIVE: path.join(T, 'faux-drive')});
for (const k of ['TREG_TOKEN', 'ELEVENLABS_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY']) delete process.env[k];

// ——— les faux : un Claude qui parle comme le vrai, et les modules remplacés ———
const B = path.join(T, 'bouchons');
fs.mkdirSync(B, {recursive: true});
const FAUX_CLAUDE = path.join(B, 'faux-claude.mjs');
const JOURNAL = path.join(T, 'journal.jsonl');
process.env.FAUX_JOURNAL = JOURNAL;
fs.writeFileSync(FAUX_CLAUDE, `import fs from 'node:fs';
import path from 'node:path';
const noter = (x) => fs.appendFileSync(process.env.FAUX_JOURNAL, JSON.stringify({pid: process.pid, ...x}) + '\\n');
const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
const a = process.argv;
noter({quoi: 'lance', cwd: path.basename(process.cwd()), reprise: a.includes('--resume') ? a[a.indexOf('--resume') + 1] : null, treg: 'TREG_TOKEN' in process.env});
out({type: 'system', subtype: 'init', session_id: 'faux-' + process.pid, mcp_servers: []});
if (process.env.FAUX_MODE === 'casse') setTimeout(() => { fs.chmodSync(process.env.FAUX_DOSSIER_ETAT, 0o555); process.exit(1); }, 300);
let tampon = '';
process.stdin.on('data', (d) => {
  tampon += d;
  let i;
  while ((i = tampon.indexOf('\\n')) >= 0) {
    const l = tampon.slice(0, i); tampon = tampon.slice(i + 1);
    let j; try { j = JSON.parse(l); } catch { continue; }
    if (j.type !== 'user') continue;
    out({type: 'user', message: j.message});
    noter({quoi: 'lit', texte: String(j.message?.content ?? '')});
    if (process.env.FAUX_MODE === 'voix-off') {
      fs.mkdirSync('voix-off', {recursive: true});
      fs.writeFileSync('voix-off/questions.json', JSON.stringify({fil: 'Une journée à Kyoto, du matin au soir.', questions: [{texte: 'Où étais-tu à ce moment-là ?', medias: ['M1'], debut: 2, fin: 6, pourquoi: 'le lieu'}, {texte: 'Qu’as-tu ressenti en arrivant ?', medias: ['M1'], debut: 8, fin: 12, pourquoi: 'l’émotion'}]}));
      fs.writeFileSync('voix-off/texte.json', JSON.stringify({titre: 'Vendredi à Kyoto', moments: [{debut: 0, fin: 6, plans: 'la rue', texte: 'Ce matin-là, Kyoto se réveillait à peine.'}]}));
    }
    setTimeout(() => { out({type: 'assistant', message: {content: [{type: 'text', text: 'Réponse du faux Claude.'}]}}); out({type: 'result', result: 'Réponse du faux Claude.', is_error: false}); }, 300);
  }
});
process.stdin.on('end', () => setTimeout(() => process.exit(0), 50));
`);
const vrai = (f) => `${pathToFileURL(path.join(D, 'lib', f)).href}?vrai`;
fs.writeFileSync(path.join(B, 'faux-ia.mjs'), `export * from '${vrai('ia.mjs')}';
export const FAUX = true;
export async function etatIA() {
  await new Promise((r) => setTimeout(r, Number(process.env.DELAI_ETAT ?? 0)));
  return {claude: {ok: true, chemin: ${JSON.stringify(FAUX_CLAUDE)}, version: '0.0.0', modeles: []}, codex: {ok: false, pourquoi: 'absent (essai)'}, gemini: {ok: false, pourquoi: 'absent (essai)'}, choisi: 'claude'};
}
// jamais un autre programme que le faux Claude
export function commandeLancement(chemin) {
  if (chemin !== ${JSON.stringify(FAUX_CLAUDE)}) throw new Error('essai : programme inattendu ' + chemin);
  return {cmd: process.execPath, prefixe: [chemin]};
}
`);
fs.writeFileSync(path.join(B, 'faux-sons.mjs'), `export * from '${vrai('sons.mjs')}';
export async function installerSons(atelier, noter = () => {}) {
  const ms = Number(process.env.DELAI_SONS ?? 0);
  if (ms) { noter('onde', 'Range la bibliothèque de sons (essai)'); await new Promise((r) => setTimeout(r, ms)); }
  return {actif: false};
}
`);
fs.writeFileSync(path.join(B, 'faux-rendu.mjs'), `export * from '${vrai('rendu.mjs')}';
export const etatRendu = () => ({ok: true});
`);
fs.writeFileSync(path.join(B, 'faux-pack.mjs'), `import fs from 'node:fs';
import path from 'node:path';
export * from '${vrai('pack.mjs')}';
export async function exporterPack(P) {
  const dossier = path.join(P.racine, 'exports', 'pack-neuf-' + Date.now());
  fs.mkdirSync(path.join(dossier, 'remotion'), {recursive: true});
  fs.writeFileSync(path.join(dossier, 'montage.json'), '{}');
  fs.writeFileSync(path.join(dossier, 'CLAUDE.md'), '# essai\\n');
  return {dossier};
}
`);
fs.writeFileSync(path.join(B, 'faux-disque.mjs'), `import {verifierPlace as vraie} from '${vrai('disque.mjs')}';
export * from '${vrai('disque.mjs')}';
export function verifierPlace(dossier, o = {}) { return vraie(dossier, {...o, lire: () => Number(process.env.FAUX_PLACE ?? 50 * 1024 ** 3)}); }
`);
const remplaces = Object.fromEntries(['ia', 'sons', 'rendu', 'pack', 'disque'].map((n) => [pathToFileURL(path.join(D, 'lib', `${n}.mjs`)).href, pathToFileURL(path.join(B, `faux-${n}.mjs`)).href]));
fs.writeFileSync(path.join(B, 'crochets.mjs'), `const R = ${JSON.stringify(remplaces)};
export async function resolve(specifier, context, next) {
  const r = await next(specifier, context);
  return R[r.url] ? {...r, url: R[r.url], shortCircuit: true} : r;
}
`);
register(pathToFileURL(path.join(B, 'crochets.mjs')).href);

const C = await import(`${D}/lib/claude.mjs`);
const {Projet} = await import(`${D}/lib/projet.mjs`);
const {changerReglages} = await import(`${D}/lib/reglages.mjs`);
const {creerClient} = await import(`${D}/lib/espaces.mjs`);
const {ouvrirRelais, lienInterdit} = await import(`${D}/lib/relais.mjs`);
const {dossierMoteurRendu} = await import(`${D}/lib/rendu.mjs`);
// ni le Drive de l'ordinateur, ni Treg
changerReglages({drive_claude: false, treg_ia: false});

const resultats = [];
const essai = async (nom, verifier) => {
  let bon = false;
  let dit = '';
  try { const r = await verifier(); bon = r === true; if (!bon) dit = JSON.stringify(r)?.slice(0, 500) ?? ''; } catch (e) { dit = `a levé : ${e.message}`; }
  console.log(`${bon ? '✓' : '✗'} ${nom}${bon ? '' : `\n   ${dit}`}`);
  resultats.push(bon);
};
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
const attendre = async (cond, ms = 20000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) return false; await pause(100); } return true; };
const journal = () => { try { return fs.readFileSync(JOURNAL, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const lancements = () => journal().filter((x) => x.quoi === 'lance');
const lireEtat = (P) => JSON.parse(fs.readFileSync(path.join(P.racine, 'claude', 'etat.json'), 'utf8'));
/** Un projet d'essai, avec un dossier de travail déjà prêt (la conversation reprend là). */
const projet = (nom, {espace = null, etat = {}} = {}) => {
  const racine = path.join(BIBLIO, nom);
  const P = new Projet(racine);
  P.d.medias.push({id: 'M1', nom: 'rush.mp4', type: 'video', chemin: path.join(racine, 'absent.mp4'), audio: false, transcription: true});
  if (espace) P.d.espace = espace;
  P.sauver();
  const atelier = path.join(racine, 'exports', 'pack-essai');
  fs.mkdirSync(path.join(atelier, 'remotion'), {recursive: true});
  fs.writeFileSync(path.join(atelier, 'montage.json'), '{}');
  fs.writeFileSync(path.join(atelier, 'CLAUDE.md'), '# essai\n');
  fs.mkdirSync(path.join(racine, 'claude'), {recursive: true});
  fs.writeFileSync(path.join(racine, 'claude', 'etat.json'), JSON.stringify({atelier: 'exports/pack-essai', echanges: [], versions: [], sessions: {}, ...etat}));
  return P;
};
const nouvelEssai = () => { fs.writeFileSync(JOURNAL, ''); delete process.env.DELAI_ETAT; delete process.env.DELAI_SONS; delete process.env.FAUX_MODE; };

// ——— le relais de rendu : un faux Remotion dans le moteur du dossier d'essai ———
console.log('— Le relais de rendu : les liens que l’IA pose dans le kit —');
const MOTEUR = dossierMoteurRendu();
const paquet = (nom, code) => { const d = path.join(MOTEUR, 'node_modules', ...nom.split('/')); fs.mkdirSync(d, {recursive: true}); fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({name: nom, type: 'module', main: 'index.mjs'})); fs.writeFileSync(path.join(d, 'index.mjs'), code); };
paquet('@remotion/bundler', `export async function bundle(o) { await new Promise((r) => setTimeout(r, Number(process.env.FAUX_ASSEMBLAGE_MS ?? 0))); return o.outDir; }\n`);
paquet('@remotion/renderer', `import fs from 'node:fs';\nexport async function selectComposition() { return {durationInFrames: 2, fps: 30, width: 2, height: 2}; }\nexport async function renderMedia(o) { fs.writeFileSync(o.outputLocation, 'faux rendu'); o.onProgress?.({renderedFrames: 2, encodedFrames: 2, stitchStage: 'muxing'}); }\n`);
const A = path.join(T, 'atelier-relais');
for (const d of ['remotion/public', 'remotion/src', 'rendu', 'plans']) fs.mkdirSync(path.join(A, d), {recursive: true});
fs.writeFileSync(path.join(A, 'plans', 'p1.mp4'), 'plan');
fs.symlinkSync('../../plans', path.join(A, 'remotion', 'public', 'plans')); // comme Dérush le pose
const LISIBLE = path.join(T, 'rushes');
fs.mkdirSync(LISIBLE, {recursive: true});
fs.writeFileSync(path.join(LISIBLE, 'gros-rush.mp4'), 'rush');
fs.writeFileSync(path.join(LISIBLE, '.env.local'), 'CLE=secrete');
fs.symlinkSync(path.join(LISIBLE, 'gros-rush.mp4'), path.join(A, 'plans', 'gros-rush.mp4')); // un très gros rush lié
const DEHORS = path.join(T, 'dehors');
fs.mkdirSync(DEHORS, {recursive: true});
fs.writeFileSync(path.join(DEHORS, 'secret.txt'), 'secret');
const lisibles = [A, LISIBLE];
const poser = (rel, cible) => { const f = path.join(A, rel); fs.symlinkSync(cible, f); return () => fs.rmSync(f, {force: true}); };

await essai('les liens posés par Dérush (plans, un rush lié depuis son disque) sont acceptés', () => lienInterdit(A, lisibles) === null);
let retirer = poser('remotion/public/vol.txt', path.join(DEHORS, 'secret.txt'));
await essai('un lien de public/ vers un fichier que l’IA n’a pas le droit de lire est refusé', () => lienInterdit(A, lisibles) === 'remotion/public/vol.txt' || lienInterdit(A, lisibles));
retirer();
retirer = poser('remotion/public/cle', path.join(LISIBLE, '.env.local'));
await essai('un fichier de clés est refusé, même dans un dossier lisible', () => lienInterdit(A, lisibles) === 'remotion/public/cle' || lienInterdit(A, lisibles));
retirer();
fs.symlinkSync(path.join(DEHORS, 'secret.txt'), path.join(LISIBLE, 'cache.txt'));
retirer = poser('remotion/public/rushes', LISIBLE);
await essai('un lien caché derrière un dossier lié est trouvé', () => lienInterdit(A, lisibles) === 'remotion/public/rushes/cache.txt' || lienInterdit(A, lisibles));
retirer();
fs.rmSync(path.join(LISIBLE, 'cache.txt'));
retirer = poser('remotion/src/donnees-volees.json', path.join(DEHORS, 'secret.txt'));
await essai('un lien de src/ vers ailleurs est refusé aussi', () => lienInterdit(A, lisibles) === 'remotion/src/donnees-volees.json' || lienInterdit(A, lisibles));
retirer();

const relais = await ouvrirRelais(A, {lisibles});
const rendre = async (nom) => {
  const r = await fetch(`${relais.url}/rendre`, {method: 'POST', headers: {'x-derush-relais': relais.jeton}, body: JSON.stringify({args: ['Montage', path.join(A, 'rendu', nom)]})});
  const t = await r.text();
  return {t, code: /##DERUSH-RELAIS code=(\d+)##/.exec(t)?.[1] ?? `HTTP ${r.status}`, video: fs.existsSync(path.join(A, 'rendu', nom))};
};
await essai('un rendu sans lien interdit se fait (faux Remotion de l’essai)', async () => { const r = await rendre('propre.mp4'); return (r.code === '0' && r.video) || r; });
retirer = poser('remotion/public/vol.txt', path.join(DEHORS, 'secret.txt'));
await essai('un rendu demandé avec un lien interdit est refusé, sans vidéo', async () => { const r = await rendre('refuse.mp4'); return (r.code === 'HTTP 400' && /Rendu refusé/.test(r.t) && !r.video) || r; });
retirer();
// un rendu prend du temps : le second attend son tour, et l'IA pose un lien interdit pendant ce temps
process.env.FAUX_ASSEMBLAGE_MS = '1500';
const premier = rendre('premier.mp4');
await pause(300);
const second = rendre('second.mp4');
await pause(300);
retirer = poser('remotion/public/vol.txt', path.join(DEHORS, 'secret.txt'));
const [r1, r2] = await Promise.all([premier, second]);
retirer();
delete process.env.FAUX_ASSEMBLAGE_MS;
await essai('un lien posé pendant qu’un rendu attend son tour : ce rendu ne part pas', () => (r2.code === '1' && /Rendu refusé : remotion\/public\/vol\.txt/.test(r2.t) && !/Vidéo rendue/.test(r2.t) && !r2.video) || r2);
await essai('un lien posé pendant le rendu : la vidéo de ce rendu est retirée', () => (r1.code === '1' && /Vidéo rendue/.test(r1.t) && /est retirée/.test(r1.t) && !r1.video) || r1);
await essai('sans lien interdit, le rendu suivant repart normalement', async () => { const r = await rendre('apres.mp4'); return (r.code === '0' && r.video) || r; });
// l'IA change le dossier du direct en lien vers un autre dossier : en retirant ce rendu, Dérush n'efface rien là-bas
const AILLEURS = path.join(DEHORS, 'direct-ailleurs');
fs.mkdirSync(AILLEURS, {recursive: true});
fs.writeFileSync(path.join(AILLEURS, 'precieux.txt'), 'à garder');
fs.rmSync(path.join(A, 'rendu', '.direct'), {recursive: true, force: true});
fs.symlinkSync(AILLEURS, path.join(A, 'rendu', '.direct'));
process.env.FAUX_ASSEMBLAGE_MS = '1000';
const piege = rendre('piege.mp4');
await pause(300);
retirer = poser('remotion/public/vol.txt', path.join(DEHORS, 'secret.txt'));
const r3 = await piege;
retirer();
delete process.env.FAUX_ASSEMBLAGE_MS;
await essai('en retirant un rendu, rien n’est effacé à travers un lien posé par l’IA', () => (r3.code === '1' && !r3.video && fs.existsSync(path.join(AILLEURS, 'precieux.txt'))) || {r3, garde: fs.readdirSync(AILLEURS)});
relais.fermer();

// ——— l'IA de montage (lib/claude.mjs), avec le faux Claude ———
console.log('— Le travail de l’IA de montage (un faux Claude) —');
// la garde : jamais une demande si le Claude qui serait lancé n'est pas le faux
const etats = await C.etatIA();
if (etats?.claude?.chemin !== FAUX_CLAUDE) {
  console.error('✗ Les crochets de l’essai ne remplacent pas lib/ia.mjs : l’essai s’arrête avant toute demande (une vraie IA serait lancée).');
  console.log(`Dossier d’essai gardé : ${T}`);
  process.exit(1);
}

nouvelEssai();
process.env.DELAI_ETAT = '400'; // la vérification des assistants prend du temps (comme « claude --version » quand sa mémoire a expiré)
let P = projet('deux-demandes');
const deux = await Promise.allSettled([C.demander(P, {message: 'Premier message'}), pause(50).then(() => C.demander(P, {message: 'Second message'}))]);
await attendre(() => !C.claudeTravaille());
await essai('deux demandes presque en même temps (double ⌘↵) : une seule IA part, la seconde est refusée', () => (deux[0].status === 'fulfilled' && deux[1].status === 'rejected' && /travaille déjà/.test(deux[1].reason?.message) && lancements().length === 1) || {deux: deux.map((x) => x.status === 'fulfilled' ? 'accepté' : x.reason?.message), lances: lancements().length});
await essai('la conversation garde le premier message et sa réponse', () => lireEtat(P).echanges.map((x) => `${x.role}:${x.texte}`).join(' | ') === 'humain:Premier message | claude:Réponse du faux Claude.' || lireEtat(P).echanges);

nouvelEssai();
process.env.DELAI_SONS = '1500'; // la bibliothèque de sons se range pendant la préparation
P = projet('arret-preparation');
await C.demander(P, {message: 'Monte la vidéo'});
await pause(300);
const arrete = C.arreterDemande(P);
await attendre(() => !C.claudeTravaille());
await pause(300);
await essai('« Arrêter » pendant la préparation : l’IA n’est jamais lancée', () => (arrete === true && lancements().length === 0) || {arrete, lances: lancements()});
await essai('la conversation dit que le travail a été arrêté', () => lireEtat(P).echanges.at(-1)?.arret === true || lireEtat(P).echanges.at(-1));

nouvelEssai();
const client = creerClient({nom: 'Client essai'});
P = projet('pour-qui', {espace: client.id, etat: {espace: 'moi', sessions: {claude: 'session-de-moi'}, moteur: 'claude',
  echanges: [{role: 'humain', texte: 'Une vidéo pour moi'}, {role: 'claude', moteur: 'claude', texte: 'Voici ta vidéo, dans ton style perso UNIVERS-DE-MOI'}]}});
await essai('« Pour qui ? » changé depuis le dossier de travail : l’interface le sait', () => C.etatDemande(P).espace_change === true);
const repris = await C.demander(P, {message: 'Continue'});
await attendre(() => !C.claudeTravaille());
const lance = lancements()[0];
const lu = journal().find((x) => x.quoi === 'lit')?.texte ?? '';
await essai('« Continuer » après un changement de « Pour qui ? » : ni l’ancien dossier ni l’ancienne conversation', () => (repris.reprise === false && lance && lance.reprise === null && lance.cwd !== 'pack-essai') || {repris, lance});
await essai('ce que l’IA d’alors a répondu (l’univers de « Moi ») ne part pas vers le client ; mes messages, oui', () => (lu.includes('Continue') && lu.includes('Une vidéo pour moi') && !lu.includes('UNIVERS-DE-MOI')) || lu.slice(0, 600));
await essai('le nouveau dossier est noté pour le client', () => { const e = lireEtat(P); return (e.espace === client.id && e.espace_depuis === 2 && e.atelier !== 'exports/pack-essai' && !C.etatDemande(P).espace_change) || {espace: e.espace, depuis: e.espace_depuis, atelier: e.atelier}; });

nouvelEssai();
process.env.TREG_TOKEN = 'trg_essai_factice'; // une fausse clé : rien n'est envoyé à Treg
changerReglages({treg_ia: false});
P = projet('treg-coupe');
await C.demander(P, {message: 'Monte'});
await attendre(() => !C.claudeTravaille());
const coupe = lancements()[0];
nouvelEssai();
changerReglages({treg_ia: true});
P = projet('treg-donne');
await C.demander(P, {message: 'Monte'});
await attendre(() => !C.claudeTravaille());
const donne = lancements()[0];
changerReglages({treg_ia: false});
delete process.env.TREG_TOKEN;
await essai('Treg coupé dans Connexions : la clé Treg n’est pas dans l’environnement de Claude (qui a un terminal)', () => coupe?.treg === false || coupe);
await essai('Treg donné : la clé est là (l’essai voit bien la différence)', () => donne?.treg === true || donne);

nouvelEssai();
process.env.FAUX_MODE = 'casse'; // le disque du projet ne s'écrit plus (plein, débranché) au moment où l'IA échoue
P = projet('projet-casse');
process.env.FAUX_DOSSIER_ETAT = path.join(P.racine, 'claude');
await C.demander(P, {message: 'Monte'});
const fini = await attendre(() => !C.claudeTravaille());
await pause(300);
const vu = C.etatDemande(P);
fs.chmodSync(path.join(P.racine, 'claude'), 0o755);
await essai('le projet ne s’écrit plus quand l’IA échoue : Dérush continue, et la fin du travail reste visible', () => (fini && /n’a pas pu écrire dans le dossier du projet/.test(vu.echanges.at(-1)?.texte ?? '') && vu.echanges.at(-1)?.erreur === true) || vu.echanges.at(-1));
C.oublierDemande(P);
await essai('« Effacer la conversation » efface aussi cette fin gardée en mémoire', () => C.etatDemande(P).echanges.length === 0 || C.etatDemande(P).echanges);

// ——— la voix off (lib/voix-off.mjs) et les rushes du Drive, dans ce que reçoit l'IA de montage ———
console.log('— La voix off et le Drive dans les consignes de l’IA de montage —');
const VO = await import(`${D}/lib/voix-off.mjs`);
const lireConsignes = (P) => { try { return fs.readFileSync(path.join(P.racine, lireEtat(P).atelier, '.derush', 'consignes.md'), 'utf8'); } catch { return ''; } };
const dansAtelier = (P, rel) => fs.existsSync(path.join(P.racine, lireEtat(P).atelier, rel));
/** Un projet de vlog : un rush muet de 20 s (une voix off est alors conseillée), et une conversation déjà commencée
 * avec Claude (un message repris porte le rappel des connexions). */
const vlog = (nom) => { const P = projet(nom, {etat: {espace: 'moi', moteur: 'claude', sessions: {claude: `session-${nom}`}}}); P.d.medias[0].duree = 20; P.sauver(); return P; };

nouvelEssai();
process.env.FAUX_MODE = 'voix-off'; // le faux Claude écrit ses questions et le texte à lire dans voix-off/
P = vlog('vlog-du-vendredi');
await C.demander(P, {message: 'Fais-moi un vlog de la journée du vendredi'});
await attendre(() => !C.claudeTravaille());
let consignes = lireConsignes(P);
let luVO = journal().find((x) => x.quoi === 'lit')?.texte ?? '';
await essai('un vlog muet : contexte/voix-off.md est posé, et la consigne dit de le lire', () => (dansAtelier(P, 'contexte/voix-off.md') && /- Voix off : lis contexte\/voix-off\.md/.test(consignes)) || consignes.slice(-1500));
await essai('… et dans cet ordre : une première version livrée sans attendre, puis des questions courtes et numérotées à la fin de la réponse', () => /Voix off, dans cet ordre : livre d’abord une première version complète, sans attendre de réponse ; tes questions viennent ensuite, à la fin de ta réponse : 3 à 5, courtes, numérotées/.test(consignes) || consignes.slice(-1500));
await essai('le rappel de chaque message le redit (une conversation reprise relit le contexte du jour)', () => luVO.includes('voix off : relis contexte/voix-off.md') || luVO.slice(-800));
const eVO = VO.lireVoixOff(P);
await essai('à la fin du travail, les questions de l’IA et le texte à lire sont rangés dans le projet (le micro peut s’allumer)', () => (eVO.questions.length === 2 && eVO.questions.every((q) => q.source === 'montage' && q.medias[0] === 'M1') && eVO.texte?.source === 'ia' && VO.etatVoixOff(P).micro?.allume === true) || {questions: eVO.questions, texte: eVO.texte, micro: VO.etatVoixOff(P).micro});

nouvelEssai();
P = vlog('vlog-sans-voix-off');
VO.choisirVoixOff(P, 'aucune');
await C.demander(P, {message: 'Fais-moi un vlog de la journée du vendredi'});
await attendre(() => !C.claudeTravaille());
consignes = lireConsignes(P);
luVO = journal().find((x) => x.quoi === 'lit')?.texte ?? '';
await essai('« pas de voix off » choisi : la consigne le dit, sans proposer de voix off ni de questions', () => (/l’humain n’en veut pas pour ce projet/.test(consignes) && !/Voix off, dans cet ordre/.test(consignes) && !/Un vlog \(une journée/.test(consignes) && !dansAtelier(P, 'contexte/voix-off.md') && luVO.includes('pas de voix off (choix de l’humain)')) || consignes.slice(-1500));

nouvelEssai();
P = projet('vlog-sans-avis'); // un rush sans durée connue : Dérush ne peut pas encore juger
await C.demander(P, {message: 'Monte mes rushes'});
await attendre(() => !C.claudeTravaille());
consignes = lireConsignes(P);
await essai('rien de conseillé ni de commencé : la règle générale du vlog (proposer, livrer d’abord, questions numérotées, leur format)', () => (/- Un vlog \(une journée, un voyage, une sortie\) ou tout montage dont les rushes parlent peu se raconte/.test(consignes) && /voix-off\/questions\.json : \{"fil"/.test(consignes) && !dansAtelier(P, 'contexte/voix-off.md')) || consignes.slice(-1500));
await essai('Drive pas donné : pas de consigne « Depuis mon Drive »', () => !/Depuis mon Drive/.test(consignes) || consignes.slice(-1500));

nouvelEssai();
fs.mkdirSync(path.join(T, 'faux-drive', 'Voyages', 'Japon'), {recursive: true});
changerReglages({drive_claude: true});
P = projet('drive-donne');
await C.demander(P, {message: 'Va dans mon Drive, prends les vidéos du Japon'});
await attendre(() => !C.claudeTravaille());
changerReglages({drive_claude: false});
consignes = lireConsignes(P);
await essai('Drive donné : l’IA ne copie pas les rushes du Drive par lots, elle envoie vers « Depuis mon Drive »', () => /ne les copie pas toi-même par lots depuis drive\/\. Dis-lui d’utiliser « Depuis mon Drive »/.test(consignes) || consignes.slice(-2000));

// la fin : seul le dossier que cet essai a créé est effacé (gardé si un essai a échoué, pour regarder)
const tousBons = resultats.every(Boolean);
if (tousBons) fs.rmSync(T, {recursive: true, force: true});
await essai('le dossier donné n’a rien perdu : seul le dossier d’essai créé dedans est effacé', () => path.dirname(T) === parent && dejaLa.every((n) => fs.existsSync(path.join(parent, n))) && (!tousBons || !fs.existsSync(T)));
console.log(`\n${resultats.filter(Boolean).length} essais réussis sur ${resultats.length}`);
if (!resultats.every(Boolean)) console.log(`Dossier d’essai gardé : ${T}`);
process.exit(resultats.every(Boolean) ? 0 : 1);
