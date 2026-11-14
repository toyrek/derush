// Dérush — les essais de l'interface « plusieurs vidéos dans une timeline » (public/sequences.js et son branchement dans
// public/app.js), pour qui modifie Dérush :
//   node outils/essai-sequences-interface.mjs [dossier où créer le dossier d'essai]
// 1. Les petites aides de public/sequences.js, sans page : durées, tailles, la forme d'un format, l'ordre après un glissé,
//    ce que « Créer toutes les vidéos » va faire, ce que disent les boutons sous les vidéos de l'IA.
// 2. L'interface pour de vrai, dans Chrome sans fenêtre (sautée si Chrome manque ; DERUSH_CHROME=<programme> pour en
//    donner un ; sautée aussi sans FFmpeg) : le vrai serveur de Dérush, dans ce processus, sur un dossier de Dérush, une
//    bibliothèque, un dossier personnel et un faux Google Drive jetables (DERUSH_SUPPORT, DERUSH_BIBLIOTHEQUE, HOME,
//    DERUSH_DRIVE). Les rushes sont de petites vidéos faites par FFmpeg ; trois vidéos « livrées par l'IA » sont écrites
//    dans le projet comme lib/claude.mjs les range. Aucune IA n'est lancée (lib/ia.mjs est remplacé par un crochet de
//    chargement, et la page coupe l'envoi à l'IA) ; « Créer toutes les vidéos » passe par un faux moteur de rendu qui
//    fabrique chaque vidéo avec FFmpeg (rien n'est téléchargé : l'essai s'arrête si ce faux moteur n'est pas reconnu) ;
//    la place libre sur le disque est lue pour de faux (FAUX_PLACE, 50 Go par défaut).
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
const T = fs.mkdtempSync(path.join(fs.realpathSync(parent), 'derush-essai-sequences-interface-'));
// AVANT tout import de lib/ : ces dossiers sont lus une seule fois, au chargement
const SUPPORT = path.join(T, 'support');
const BIBLIO = path.join(T, 'bibliotheque');
const MAISON = path.join(T, 'maison');
const TMP = path.join(T, 'tmp');
const DRIVE = path.join(T, 'compte', 'Mon Drive');
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
  console.log(`${vrai ? '  ✓' : '  ✗'} ${quoi}${vrai || detail === '' ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)?.slice(0, 700)}`}`);
}
const titre = (t) => console.log(`\n${t}`);
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
const json = (x) => JSON.stringify(x);

// ——— 1. les petites aides, sans page ———
const SQ = await import(pathToFileURL(path.join(D, 'public', 'sequences.js')).href);
titre('Les petites aides de public/sequences.js');
essai('la durée d’un onglet : « 0:09 », « 1:05 », « 1:02:03 », « 0:01 » pour un plan très court, rien pour une vidéo vide',
  SQ.dureeOnglet(9) === '0:09' && SQ.dureeOnglet(65.4) === '1:05' && SQ.dureeOnglet(3723) === '1:02:03' && SQ.dureeOnglet(0.4) === '0:01' && SQ.dureeOnglet(0) === '' && SQ.dureeOnglet(null) === '',
  [9, 65.4, 3723, 0.4, 0].map(SQ.dureeOnglet));
essai('les durées et les tailles en clair, comme le serveur : « 18 s », « 1 min 05 », « 1 h 02 », « 1,5 Ko », « 17,4 Mo »',
  SQ.dureeTexte(18) === '18 s' && SQ.dureeTexte(65) === '1 min 05' && SQ.dureeTexte(3720) === '1 h 02' && SQ.tailleLisible(1500) === '1,5 Ko' && SQ.tailleLisible(17.4e6) === '17,4 Mo');
essai('la petite forme d’un format : 9:16 debout, 16:9 couché, 1:1 carré',
  json(SQ.formeOnglet(1080, 1920)) === json({l: 7, h: 13}) && json(SQ.formeOnglet(1920, 1080)) === json({l: 13, h: 7}) && json(SQ.formeOnglet(1080, 1080)) === json({l: 13, h: 13}));
essai('l’ordre après un glissé : « a » posé en dernier, « c » posé en premier ; un id inconnu ne change rien',
  json(SQ.ordreApres(['a', 'b', 'c'], 'a', 2)) === json(['b', 'c', 'a']) && json(SQ.ordreApres(['a', 'b', 'c'], 'c', 0)) === json(['c', 'a', 'b']) && json(SQ.ordreApres(['a', 'b'], 'z', 0)) === json(['a', 'b'])
  && SQ.placeDepot([100, 200, 300], 250) === 2 && SQ.placeDepot([100, 200, 300], 50) === 0);
essai('des noms entre guillemets : un, deux, et « et 2 autres » au-delà de trois',
  SQ.listeNoms(['A']) === '« A »' && SQ.listeNoms(['A', 'B']) === '« A » et « B »' && SQ.listeNoms(['A', 'B', 'C', 'D', 'E']) === '« A », « B », « C » et 2 autres');
const sup = SQ.phraseSuppression({plans: 4, effets: 2});
essai('supprimer : ce que la vidéo emporte, et que les médias restent ; une vidéo vide le dit',
  sup.startsWith('Ce qu’elle contient quitte le projet : 4 plans et 2 effets ou titres.') && sup.includes('Tes médias restent') && SQ.phraseSuppression({}).startsWith('Elle est vide.'), sup);
const plan = {a_rendre: 2, vides: ['Brouillon'], duree_s: 18, taille_lisible: 'environ 17,4 Mo', place: {ok: true, texte: null, libre_lisible: '8,9 Go'}};
const R1 = SQ.resumePlan(plan);
essai('« Créer toutes les vidéos » : combien, combien de temps, combien de place, la vidéo vide laissée de côté, le bouton',
  R1.total === '2 vidéos à créer · 18 s en tout · environ 17,4 Mo' && R1.vides === 'La vidéo vide « Brouillon » est laissée de côté.' && R1.bouton === 'Créer les 2 vidéos' && R1.ok
  && R1.place.texte === 'Il reste 8,9 Go sur le disque du projet.' && R1.place.classe === 'ok', R1);
const R2 = SQ.resumePlan({...plan, place: {ok: false, texte: 'Il ne reste que 0,7 Go sur ton disque…'}});
const R3 = SQ.resumePlan({a_rendre: 0, vides: ['A', 'B'], duree_s: 0, place: {ok: true}});
essai('… un disque presque plein : le texte du serveur, et le bouton grisé ; rien à créer : grisé aussi',
  R2.ok === false && R2.place.classe === 'refus' && R2.place.texte.startsWith('Il ne reste que') && R3.ok === false && R3.bouton === 'Rien à créer' && R3.vides === 'Les vidéos vides « A » et « B » sont laissées de côté.');
const L = (x, o) => SQ.libelleVideoIA(x, o);
essai('sous une vidéo de l’IA : « Mettre dans ma timeline » (« Vers ma timeline » dans un lot), plan par plan ou comme un seul plan',
  L({timeline: 'plans'}).bouton === 'Mettre dans ma timeline' && L({timeline: 'plans'}).court === 'Vers ma timeline' && L({timeline: 'plans'}).sous === 'plan par plan, à retoucher' && L({timeline: 'fichier'}).sous === 'comme un seul plan (le fichier)');
essai('… déjà dans la timeline : « Ouvrir « son nom d’aujourd’hui » », ou « Dans ta timeline » si elle est ouverte ; supprimée depuis : de nouveau « Mettre »',
  L({dans_timeline: {id: 'V3', nom: 'X'}}, {noms: {V3: 'Y', V1: 'Z'}, ouverte: 'V1'}).bouton === 'Ouvrir « Y »' && L({dans_timeline: {id: 'V3', nom: 'X'}}, {noms: {V3: 'Y'}, ouverte: 'V3'}).quoi === 'ici'
  && L({dans_timeline: {id: 'V3', nom: 'X'}, timeline: 'plans'}, {noms: {V1: 'Z'}, ouverte: 'V1'}).quoi === 'mettre');
const lot = (n, dedans) => ({videos: Array.from({length: n}, (_, k) => ({rang: k, dans_timeline: k < dedans ? {id: `V${k + 2}`} : null}))});
essai('au-dessus d’un lot : « Mettre les 3 vidéos… », « …les 2 autres… », « …l’autre… », puis « Les 3 sont dans ta timeline »',
  SQ.libelleLotIA(lot(3, 0)).bouton === 'Mettre les 3 vidéos dans ma timeline' && SQ.libelleLotIA(lot(3, 1)).bouton === 'Mettre les 2 autres dans ma timeline'
  && SQ.libelleLotIA(lot(3, 2)).bouton === 'Mettre l’autre dans ma timeline' && SQ.libelleLotIA(lot(3, 3)).quoi === 'ici' && SQ.libelleLotIA(lot(3, 3)).bouton === 'Les 3 sont dans ta timeline');
const ph1 = SQ.phraseApresIA({faites: [{nom: 'Le matin', mode: 'plans', deja: false}]});
const ph2 = SQ.phraseApresIA({faites: [{nom: 'A', mode: 'plans', deja: true}, {nom: 'B', mode: 'plans'}, {nom: 'C', mode: 'fichier'}]});
essai('la note après : une vidéo (plan par plan), plusieurs (combien de nouvelles, laquelle est ouverte)',
  ph1 === '« Le matin » est dans ta timeline, plan par plan : retouche-la comme tu veux.' && ph2 === '3 vidéos dans ta timeline (2 nouvelles, 1 déjà là) : « A », « B » et « C ». « A » est ouverte.', [ph1, ph2]);
const E = SQ.etatRendus([{t: {etat: 'fini'}}, {t: {etat: 'en cours', progression: 0.5}}, {t: null}]);
essai('le suivi de « Créer toutes les vidéos » : finies, en cours, et le titre de la fin',
  E.total === 3 && E.finies === 1 && !E.fini && Math.abs(E.progression - 0.5) < 1e-9 && SQ.titreRendus({total: 2, finies: 2}) === 'Tes deux vidéos sont prêtes'
  && SQ.titreRendus({total: 3, finies: 2}) === '2 vidéos sur 3 sont prêtes' && SQ.etatRendus([{t: {etat: 'erreur'}}, {t: {etat: 'inconnu'}}]).fini, E);

// ——— 2. l'interface pour de vrai ———
const CHROME = process.env.DERUSH_CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((c) => fs.existsSync(c));
const CAPTURES = process.env.DERUSH_ESSAI_CAPTURES ? path.resolve(process.env.DERUSH_ESSAI_CAPTURES) : null;
const FF = process.env.DERUSH_FFMPEG || 'ffmpeg';
const ffOk = spawnSync(FF, ['-version']).status === 0;
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
    const ff = (args) => { const r = spawnSync(FF, ['-v', 'error', '-y', ...args]); if (r.status !== 0) throw new Error(`FFmpeg : ${r.stderr?.toString().slice(-300)}`); };
    const video = (f, l, h, d, src = 'testsrc2') => { ff(['-f', 'lavfi', '-i', `${src}=size=${l}x${h}:rate=30:duration=${d}`, '-f', 'lavfi', '-i', `sine=frequency=330:duration=${d}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', f]); return f; };
    const RUSHES = path.join(T, 'rushes');
    fs.mkdirSync(RUSHES, {recursive: true});
    const rushes = [video(path.join(RUSHES, 'vendredi-matin.mp4'), 360, 640, 4), video(path.join(RUSHES, 'vendredi-temple.mp4'), 360, 640, 5, 'smptebars'), video(path.join(RUSHES, 'vendredi-soir.mp4'), 640, 360, 4, 'rgbtestsrc')];

    // — les crochets : lib/ia.mjs (aucune IA lancée) et la place sur le disque (lue pour de faux) —
    const B = path.join(T, 'bouchons');
    fs.mkdirSync(B, {recursive: true});
    const FAUX = path.join(B, 'faux-claude.mjs');
    fs.writeFileSync(FAUX, 'process.exit(1); // jamais lancé : l’essai ne parle à aucune IA\n');
    const vrai = (f) => `${pathToFileURL(path.join(D, 'lib', f)).href}?vrai`;
    fs.writeFileSync(path.join(B, 'faux-ia.mjs'), `export * from '${vrai('ia.mjs')}';
export async function etatIA() {
  return {claude: {ok: true, chemin: ${json(FAUX)}, version: '0.0.0', modeles: []}, codex: {ok: false, pourquoi: 'absent (essai)'}, gemini: {ok: false, pourquoi: 'absent (essai)'}, choisi: 'claude'};
}
export function commandeLancement(chemin) { throw new Error('essai : aucune IA ne doit être lancée (' + chemin + ')'); }
`);
    fs.writeFileSync(path.join(B, 'faux-disque.mjs'), `export * from '${vrai('disque.mjs')}';
import {verifierPlace as vraie} from '${vrai('disque.mjs')}';
export function verifierPlace(dossier, o = {}) { return vraie(dossier, {...o, lire: () => Number(process.env.FAUX_PLACE ?? 50 * 1024 ** 3)}); }
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

    const lib = (m) => import(pathToFileURL(path.join(D, 'lib', m)).href);
    const {Projet} = await lib('projet.mjs');
    const {FileDAttente, FFMPEG} = await lib('outils.mjs');
    const {demarrerServeur} = await lib('serveur.mjs');
    const {changerReglages} = await lib('reglages.mjs');
    const {dossierMoteurRendu, etatRendu} = await lib('rendu.mjs');
    const Mx = await lib('medias.mjs');
    const Bi = await lib('bibliotheque.mjs');
    changerReglages({tuto_vu: true, accueil_vu: true}); // ni tutoriel ni accueil par-dessus l'éditeur

    // — le faux moteur de rendu, dans le dossier de Dérush d'essai : les paquets du kit (vides) et un remotion-cli qui
    //   fabrique la vidéo avec FFmpeg et note ce qu'il a reçu —
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
fs.appendFileSync(${json(RENDUS)}, JSON.stringify({video: M.projet?.video?.nom ?? null, plans: M.montage.map((x) => x.id), largeur, hauteur}) + '\\n');
execFileSync(${json(FFMPEG)}, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=' + largeur + 'x' + hauteur + ':rate=' + fps + ':duration=' + duree, '-f', 'lavfi', '-i', 'sine=frequency=440:duration=' + duree,
  '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-c:a', 'aac', '-shortest', sortie]);
console.log('Rendered 1/1');
console.log('Encoded 1/1');
`);
    fs.writeFileSync(path.join(MOTEUR, '.navigateur-pret'), 'essai');
    // jamais d'installation pour de vrai (npm, navigateur de rendu) : sans ce faux moteur reconnu, l'essai s'arrête
    if (!etatRendu().ok) throw new Error(`le faux moteur de rendu n’est pas reconnu (rien n’est installé) : ${json(etatRendu())}`);

    // — le projet : trois rushes préparés, et trois vidéos « livrées par l'IA », rangées comme lib/claude.mjs les range —
    const ctx = {P: null, file: new FileDAttente(), app: false, natif: false,
      ouvrir(d, t) { const P = new Projet(d); if (t && !fs.existsSync(path.join(P.racine, '.derush'))) { P.d.titre = t; P.sauver(); } ctx.P = P; Bi.noterRecent(P.racine); return P; },
      projetVivant(d) { return ctx.P?.racine === path.resolve(d) ? ctx.P : null; },
      fermer() { ctx.P = null; }};
    const PROJET = path.join(BIBLIO, 'Japon');
    const P0 = ctx.ouvrir(PROJET, 'Japon');
    await Mx.ajouterMedias(P0, rushes, ctx.file);
    await ctx.file.vide();
    const VIDEOS = path.join(PROJET, 'vidéos');
    fs.mkdirSync(VIDEOS, {recursive: true});
    fs.mkdirSync(path.join(PROJET, 'claude'), {recursive: true});
    fs.mkdirSync(path.join(PROJET, 'exports', 'pack-ia'), {recursive: true});
    fs.writeFileSync(path.join(PROJET, 'exports', 'pack-ia', 'montage.json'), json({decoupe: 'libre', montage: []}));
    for (const [n, d] of [['japon-claude-v1-1-le-matin.mp4', 3], ['japon-claude-v1-2-le-temple.mp4', 3], ['japon-claude-v1-3.mp4', 2]]) video(path.join(VIDEOS, n), 360, 640, d);
    const v = (nom, titreV, extra = {}) => ({nom, titre: titreV, largeur: 1080, hauteur: 1920, fps: 30, duree: 3, controles: [{ok: true, t: 'Format 9:16'}], ...extra});
    fs.writeFileSync(path.join(PROJET, 'claude', 'etat.json'), json({
      atelier: 'exports/pack-ia', moteur: 'claude', sessions: {claude: 'session-essai'}, sequence: P0.d.sequence, sequence_nom: 'Vidéo 1',
      echanges: [{role: 'humain', texte: 'Fais-moi 3 TikToks de la journée du vendredi.', quand: '2026-11-14T15:00:00.000Z'},
        {role: 'claude', texte: 'Voici tes 3 TikToks du vendredi.', quand: '2026-11-14T15:07:00.000Z', version: 1, moteur: 'claude', duree_s: 412}],
      versions: [{n: 1, moteur: 'claude', qualite: 'max', cree_le: '2026-11-14T15:07:00.000Z', atelier: 'exports/pack-ia', videos: [
        v('japon-claude-v1-1-le-matin.mp4', 'Le matin', {coupes: [{type: 'plan', media: 'M1', entree: 0.5, sortie: 2.5, titre: 'La rue'}, {type: 'plan', media: 'M2', entree: 1, sortie: 2, titre: 'Le temple au loin'}]}),
        v('japon-claude-v1-2-le-temple.mp4', 'Le temple', {coupes: [{type: 'plan', media: 'M2', entree: 0, sortie: 3, titre: 'Le temple'}]}),
        v('japon-claude-v1-3.mp4', null, {duree: 2}),
      ]}],
    }));
    ({serveur} = await demarrerServeur(ctx, {port: 0}));
    const base = `http://127.0.0.1:${serveur.address().port}`;

    // — Chrome sans fenêtre, piloté par son protocole —
    const portLibre = () => new Promise((ok, ko) => { const s = net.createServer(); s.on('error', ko); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
    const PORT_CDP = await portLibre();
    chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${path.join(T, 'chrome')}`, '--window-size=1480,1200',
      // un faux micro, accepté sans question : pour essayer qu'une prise en cours garde la vidéo ouverte
      '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
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
    // le milieu de l'élément, amené à l'écran (dans la colonne de l'IA qui défile, par exemple)
    const centre = (sel) => js(`(() => { const e = document.querySelector(${json(sel)}); if (!e) return null; e.scrollIntoView({block: 'nearest', inline: 'nearest'}); const b = e.getBoundingClientRect(); return {x: b.left + b.width / 2, y: b.top + b.height / 2}; })()`);
    const souris = (type, p, o = {}) => cdp('Input.dispatchMouseEvent', {type, x: p.x, y: p.y, button: 'left', buttons: type === 'mouseReleased' || type === 'mouseMoved' ? (o.buttons ?? 0) : 1, clickCount: o.n ?? 1});
    /** Un vrai clic de souris au milieu de l'élément. */
    const clic = async (sel) => { const p = await centre(sel); if (!p) return false; await souris('mousePressed', p); await souris('mouseReleased', p); await dormir(80); return true; };
    const doubleClic = async (sel) => { const p = await centre(sel); if (!p) return false; for (const n of [1, 2]) { await souris('mousePressed', p, {n}); await souris('mouseReleased', p, {n}); } await dormir(120); return true; };
    const glisser = async (de, vers, pas = 14) => {
      await souris('mousePressed', de);
      for (let i = 1; i <= pas; i++) { await souris('mouseMoved', {x: de.x + ((vers.x - de.x) * i) / pas, y: de.y + ((vers.y - de.y) * i) / pas}, {buttons: 1}); await dormir(16); }
      await souris('mouseReleased', vers);
      await dormir(150);
    };
    const touche = async (key, code = key, vk = 0, mod = 0) => { for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', {type, key, code, windowsVirtualKeyCode: vk, modifiers: mod}); await dormir(80); };
    const taper = (texte) => cdp('Input.insertText', {text: texte});
    const capture = async (nom) => { if (!CAPTURES) return; fs.mkdirSync(CAPTURES, {recursive: true}); const {data} = await cdp('Page.captureScreenshot', {format: 'png'}); fs.writeFileSync(path.join(CAPTURES, `${nom}.png`), Buffer.from(data, 'base64')); };
    const appels = (re) => js(`window.__appels.filter((a) => ${re}.test(a.m + ' ' + a.u)).map((a) => a.corps)`);
    const texteDe = (sel) => js(`(document.querySelector(${json(sel)})?.textContent ?? '').replace(/\\s+/g, ' ').trim()`);
    const liste = () => js('JSON.stringify(window.derush.videos.liste().map((v) => [v.id, v.nom, v.plans, v.ouverte]))').then(JSON.parse);
    const serveurVideos = () => js("window.derush.api('GET', '/api/sequences')");
    // le projet relu sur le disque, comme Dérush le rouvrira
    const disque = () => JSON.parse(fs.readFileSync(path.join(PROJET, 'derush.json'), 'utf8'));
    const contenuSurDisque = (id) => { const d = disque(); return d.sequence === id ? d.montage : d.sequences.find((s) => s.id === id)?.montage; };

    titre('Une seule vidéo : juste le « + »');
    const ouvert = await jusqua("window.derush && window.derush.projet() && window.derush.videos && document.querySelector('#b-seq-plus')", 30000);
    essai('l’éditeur s’ouvre sur le projet', ouvert, ouvert ? '' : {page: await js("location.href + ' | ' + document.body.innerText.slice(0, 300)").catch((e) => e.message), erreurs: erreursPage.slice(0, 5)});
    if (!ouvert) throw new Error('l’éditeur ne s’est pas ouvert');
    // la garde : la fenêtre « Ouvrir », les liens, une installation et tout envoi à une IA sont coupés et notés ;
    // confirm() est noté (les gestes des vidéos demandent dans la page, jamais par une boîte du navigateur)
    await js(`(() => {
      window.__appels = [];
      window.__confirm = [];
      window.confirm = (t) => { window.__confirm.push(t); return false; };
      const vrai = window.fetch.bind(window);
      const json = (j, code = 200) => new Response(JSON.stringify(j), {status: code, headers: {'content-type': 'application/json'}});
      window.fetch = async (url, opts = {}) => {
        const u = String(url);
        const m = (opts.method || 'GET').toUpperCase();
        let corps = null;
        try { corps = opts.body ? JSON.parse(opts.body) : null; } catch { corps = null; }
        window.__appels.push({m, u, corps});
        if (u.startsWith('/api/choisir') || u.startsWith('/api/moteurs/installer')) return json({erreur: 'coupé pendant l’essai'}, 400);
        if (u.startsWith('/api/lien')) return json({ok: true});
        if (m === 'POST' && /^\\/api\\/(claude\\/(demander|ajouter)|voix-off\\/questions|drive\\/chercher|conseil|publication)/.test(u)) return json({erreur: 'coupé pendant l’essai'}, 400);
        return vrai(url, opts);
      };
      return true;
    })()`);
    await jusqua('window.derush.claude() && window.derush.claude().versions && window.derush.claude().versions.length', 15000);
    await capture('01-une-video');
    essai('pas d’onglets : la barre des vidéos est cachée, le « + Vidéo » est dans les outils de la timeline',
      await js("document.querySelector('#sequences').classList.contains('cache') && !document.querySelector('#b-seq-plus').classList.contains('cache')"));
    await js("window.derush.poserMedias(['M1', 'M2'])");
    await jusqua("window.derush.projet().montage.length === 2");
    await dormir(700);
    const V1 = await js('window.derush.videos.ouverte()');
    essai('deux plans posés dans la vidéo, enregistrés (avec la vidéo ouverte dans la requête)',
      contenuSurDisque(V1)?.length === 2 && (await appels('/PUT \\/api\\/projet/')).some((c) => c?.sequence === V1), contenuSurDisque(V1));

    titre('« + » : une copie de la vidéo, dans un onglet');
    await clic('#b-seq-plus');
    await jusqua("document.querySelector('.seq-menu')");
    essai('le « + » propose une vidéo vide (au format de celle-ci) ou la copie de celle-ci',
      /Nouvelle vidéo.*vide, au format 9:16/.test(await texteDe('.seq-menu')) && /Dupliquer « Vidéo 1 »/.test(await texteDe('.seq-menu')));
    await capture('02-menu-plus');
    await clic('.seq-menu [data-seq-act=copie]');
    await jusqua('window.derush.videos.liste().length === 2');
    await dormir(400);
    const apresCopie = await js("JSON.stringify({ouverte: window.derush.videos.ouverte(), plans: window.derush.projet().montage.map((x) => x.id), h: window.derush.videos.historique()})").then(JSON.parse);
    const V2 = apresCopie.ouverte;
    essai('la copie s’ouvre : deux onglets, ses plans ont des ids neufs, l’historique repart de zéro',
      V2 !== V1 && apresCopie.plans.length === 2 && !apresCopie.plans.includes('P1') && apresCopie.h.annuler === 0
      && !(await js("document.querySelector('#sequences').classList.contains('cache')")) && (await js("document.querySelectorAll('.seq-onglet').length")) === 2
      && (await js("document.querySelector('#b-seq-plus').classList.contains('cache')")), apresCopie);
    essai('l’onglet ouvert montre son nom, son format et sa durée', /Vidéo 1 \(copie\)\s*9:16 · 0:09/.test(await texteDe('.seq-onglet.ouverte')), await texteDe('.seq-onglet.ouverte'));
    essai('l’écran de l’IA dit pour quelle vidéo vaut la demande', /Ta demande vaut pour « Vidéo 1 \(copie\) »\s*2 sur 2/.test(await texteDe('.cl-video-ouverte')), await texteDe('.cl-video-ouverte'));
    await capture('03-deux-videos');

    titre('Basculer garde tout, et ⌘Z ne mélange jamais deux vidéos');
    const P3 = apresCopie.plans[0];
    await js(`window.derush.selectionner(${json(P3)})`);
    await touche('Backspace', 'Backspace', 8);
    await jusqua('window.derush.projet().montage.length === 1');
    await touche('z', 'KeyZ', 90, 2);
    const annule = await js('window.derush.projet().montage.length');
    await js(`window.derush.selectionner(${json(P3)})`);
    await touche('Backspace', 'Backspace', 8);
    await dormir(700);
    essai('dans une vidéo, ⌘Z annule comme avant (un plan supprimé revient, puis repart)', annule === 2 && (await js('window.derush.projet().montage.length')) === 1);
    await clic(`.seq-onglet[data-seq="${V1}"]`);
    await jusqua(`window.derush.videos.ouverte() === ${json(V1)}`);
    await dormir(500);
    const apresBascule = await js("JSON.stringify({plans: window.derush.projet().montage.map((x) => x.id), h: window.derush.videos.historique(), sel: window.derush.ui().sel})").then(JSON.parse);
    essai('un clic sur l’onglet : la vidéo 1 revient telle quelle, sans sélection ni historique',
      json(apresBascule.plans) === json(['P1', 'P2']) && apresBascule.h.annuler === 0 && apresBascule.h.refaire === 0 && apresBascule.sel === null, apresBascule);
    essai('… et la copie est gardée avec sa retouche (un plan), sur le disque', contenuSurDisque(V2)?.length === 1 && contenuSurDisque(V1)?.length === 2, [contenuSurDisque(V1), contenuSurDisque(V2)]);
    essai('l’enregistrement part avant le changement de vidéo', await js(`(() => { const a = window.__appels.map((x) => x.m + ' ' + x.u); const k = a.lastIndexOf('POST /api/sequences/activer'); return k > 0 && a.slice(0, k).reverse().find((x) => x.startsWith('PUT ') || x.startsWith('POST /api/sequences')) === 'PUT /api/projet'; })()`));
    await touche('z', 'KeyZ', 90, 2);
    await dormir(600);
    essai('⌘Z juste après le changement : rien à annuler, aucune des deux vidéos ne bouge',
      (await js('window.derush.projet().montage.length')) === 2 && contenuSurDisque(V2)?.length === 1 && /Rien à annuler/.test(await texteDe('#notes')));
    await capture('04-bascule');

    titre('Renommer (double-clic), glisser pour l’ordre');
    await doubleClic('.seq-onglet.ouverte');
    const champ = await jusqua("document.querySelector('.seq-renommer') === document.activeElement", 4000);
    await js("document.querySelector('.seq-renommer').select()");
    await taper('Vendredi');
    await capture('05-renommer');
    await touche('Enter', 'Enter', 13);
    await jusqua("!document.querySelector('.seq-renommer')");
    await dormir(400);
    essai('double-clic sur l’onglet ouvert : un champ, Entrée garde le nom (le serveur aussi)',
      champ && (await liste()).find((x) => x[0] === V1)?.[1] === 'Vendredi' && disque().sequences.find((s) => s.id === V1)?.nom === 'Vendredi');
    await doubleClic('.seq-onglet.ouverte');
    await jusqua("document.querySelector('.seq-renommer')", 4000);
    await js("document.querySelector('.seq-renommer').select()");
    await taper('À ne pas garder');
    await touche('Escape', 'Escape', 27);
    await dormir(300);
    essai('Échap annule le nom tapé', !(await js("!!document.querySelector('.seq-renommer')")) && (await liste()).find((x) => x[0] === V1)?.[1] === 'Vendredi');
    const de = await centre(`.seq-onglet[data-seq="${V2}"]`);
    const vers = await js(`(() => { const b = document.querySelector('.seq-onglet[data-seq="${V1}"]').getBoundingClientRect(); return {x: b.left + 6, y: b.top + b.height / 2}; })()`);
    await glisser(de, vers);
    await dormir(500);
    essai('glisser la copie avant la vidéo 1 : le nouvel ordre, enregistré, sans changer de vidéo ouverte',
      json((await liste()).map((x) => x[0])) === json([V2, V1]) && json(disque().sequences.map((s) => s.id)) === json([V2, V1]) && (await js('window.derush.videos.ouverte()')) === V1
      && (await appels('/POST \\/api\\/sequences\\/ordre/')).some((c) => json(c?.ids) === json([V2, V1])), await liste());
    await capture('06-ordre');

    titre('Une vidéo vide, puis la supprimer (confirmation dans la page)');
    await clic('#sequences [data-seq-plus]');
    await jusqua("document.querySelector('.seq-menu [data-seq-act=vide]')");
    await clic('.seq-menu [data-seq-act=vide]');
    await jusqua('window.derush.videos.liste().length === 3');
    await dormir(500);
    const V3 = await js('window.derush.videos.ouverte()');
    essai('« Nouvelle vidéo » : un troisième onglet, vide, ouvert ; l’aperçu propose de commencer',
      ![V1, V2].includes(V3) && (await js('window.derush.projet().montage.length')) === 0 && /vide/.test(await texteDe('.seq-onglet.ouverte')) && (await js("!document.querySelector('#vide').classList.contains('cache')")));
    await js(`(() => { const e = document.querySelector('.seq-onglet[data-seq="${V3}"]'); const b = e.getBoundingClientRect(); e.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX: b.left + 20, clientY: b.top + 10})); return true; })()`);
    await jusqua("document.querySelector('.seq-menu [data-seq-act=supprimer]')");
    essai('le clic droit sur un onglet : renommer, dupliquer, supprimer', /Renommer.*Dupliquer.*Supprimer/.test(await texteDe('.seq-menu')));
    await capture('07-menu-onglet');
    await clic('.seq-menu [data-seq-act=supprimer]');
    await jusqua("document.querySelector('#feuille .seq-confirmer')");
    essai('« Supprimer… » demande dans la page, avec ce qui part et ce qui reste ; aucune boîte du navigateur',
      /Supprimer « Vidéo 3 » \?/.test(await texteDe('#feuille')) && /Elle est vide/.test(await texteDe('#feuille')) && (await js('window.__confirm.length')) === 0, await texteDe('#feuille'));
    await capture('08-confirmer');
    await clic('#feuille [data-oui]');
    await jusqua('window.derush.videos.liste().length === 2');
    await dormir(400);
    essai('supprimée : deux onglets, sa voisine est ouverte ; une copie de sécurité est gardée',
      !(await liste()).some((x) => x[0] === V3) && [V1, V2].includes(await js('window.derush.videos.ouverte()')) && fs.readdirSync(path.join(PROJET, '.derush', 'videos-supprimees')).some((f) => f.startsWith(`${V3}-`)));

    titre('Pendant une prise de voix, la vidéo ouverte ne change pas');
    const ouverteAvantPrise = await js('window.derush.videos.ouverte()');
    await js("window.derush.enregistrer('voix')");
    const prise = await jusqua('window.derush.enregistre()', 8000);
    const autre = (await liste()).find((x) => x[0] !== ouverteAvantPrise)?.[0];
    await clic(`.seq-onglet[data-seq="${autre}"]`);
    await dormir(600);
    essai('le micro est ouvert : un clic sur un autre onglet ne l’ouvre pas, et Dérush dit pourquoi',
      prise && (await js('window.derush.videos.ouverte()')) === ouverteAvantPrise && /Un enregistrement est ouvert/.test(await texteDe('#notes')), {prise, ouverte: await js('window.derush.videos.ouverte()')});
    await clic('[data-enr="fermer"]');
    await jusqua('!window.derush.enregistre()', 8000);

    titre('« Créer la vidéo » : celle-ci, ou toutes');
    await js('window.derush.videos.activer(' + json(V1) + ')');
    await jusqua(`window.derush.videos.ouverte() === ${json(V1)}`);
    await js("window.derush.menu('creer-video')");
    await jusqua("document.querySelector('#feuille .seq-choix')");
    essai('avec deux vidéos, « Créer la vidéo » propose celle-ci (choisie) ou toutes, et dit qu’elle est figée au clic',
      (await js("document.querySelector('#feuille [data-choix=une]').classList.contains('actif')")) && /Celle-ci · « Vendredi »/.test(await texteDe('#feuille .seq-choix')) && /Toutes les vidéos \(2\)/.test(await texteDe('#feuille .seq-choix'))
      && /figée au clic/.test(await texteDe('#feuille .seq-creer-corps')));
    process.env.FAUX_PLACE = String(0.7 * 1024 ** 3);
    await clic('#feuille [data-choix=toutes]');
    await jusqua("document.querySelector('#feuille .seq-plan')");
    await dormir(300);
    essai('un disque presque plein : le texte du serveur, et le bouton grisé', /Il ne reste que 0,7 Go/.test(await texteDe('#feuille .seq-creer-corps')) && (await js("document.querySelector('#feuille [data-go]').disabled")));
    await capture('09-creer-disque-plein');
    delete process.env.FAUX_PLACE;
    await js('window.derush.menu("creer-toutes")');
    await jusqua("document.querySelector('#feuille .seq-plan') && !document.querySelector('#feuille [data-go]').disabled");
    essai('« Créer toutes les vidéos » : les deux vidéos, leur durée, la place estimée, la place libre, avant de lancer',
      (await js("document.querySelectorAll('#feuille .seq-plan-ligne').length")) === 2 && /^2 vidéos à créer · 14 s en tout · environ [\d,]+ Mo$/.test(await texteDe('#feuille .seq-total'))
      && /Il reste 53,7 Go sur le disque du projet/.test(await texteDe('#feuille .seq-creer-corps')) && (await texteDe('#feuille [data-go]')) === 'Créer les 2 vidéos'
      && !(await appels('/POST \\/api\\/sequences\\/rendre/')).length, await texteDe('#feuille .seq-creer-corps'));
    await capture('10-creer-toutes');
    await clic('#feuille [data-go]');
    await jusqua("document.querySelector('#seq-rendus')");
    essai('le clic lance une tâche par vidéo (dans la file : « Création de la vidéo · Vendredi »…), et le suivi s’affiche',
      (await appels('/POST \\/api\\/sequences\\/rendre/')).length === 1 && (await js("document.querySelectorAll('#seq-rendus .seq-rendu').length")) === 2);
    await capture('11-suivi');
    const finis = await jusqua("document.querySelector('.seq-rendus-feuille.fini')", 180000);
    const lignes = await js("JSON.stringify([...document.querySelectorAll('.seq-rendu')].map((e) => e.className + ' | ' + e.textContent.replace(/\\s+/g, ' ').trim()))").then(JSON.parse);
    const rendus = fs.existsSync(RENDUS) ? fs.readFileSync(RENDUS, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
    const faites = fs.readdirSync(VIDEOS).filter((f) => !/^japon-claude/.test(f) && f.endsWith('.mp4'));
    essai('la fin : « Tes deux vidéos sont prêtes », chacune avec son état et « Voir »',
      finis && /Tes deux vidéos sont prêtes/.test(await texteDe('#feuille h3')) && lignes.length === 2 && lignes.every((l) => /e-fini/.test(l) && /Voir/.test(l)), lignes);
    essai('chaque vidéo a été rendue avec ses propres plans, à son nom, dans « vidéos »',
      rendus.length === 2 && json(rendus.map((r) => r.video)) === json(['Vidéo 1 (copie)', 'Vendredi']) && rendus[0].plans.length === 1 && rendus[1].plans.length === 2
      && faites.some((f) => /vendredi/.test(f)) && faites.some((f) => /copie/.test(f)), {rendus, faites});
    await capture('12-fini');
    await clic('#feuille [data-voir]');
    await jusqua("document.querySelector('#feuille [data-retour]')");
    essai('« Voir » : la vidéo, son nom (« … est prête »), et un retour à la liste', /« Vidéo 1 \(copie\) » est prête/.test(await texteDe('#feuille h3')));
    await capture('13-voir');
    await clic('#feuille [data-retour]');
    await jusqua("document.querySelector('.seq-rendus-feuille.fini')");
    essai('… le retour montre de nouveau toutes les vidéos', (await js("document.querySelectorAll('#feuille .seq-rendu').length")) === 2);
    await clic('#feuille [data-fermer]');
    await dormir(300);

    titre('Les vidéos livrées par l’IA, dans la timeline');
    await js("(() => { const b = document.querySelector('[data-cl=vo-replier]'); if (b) b.click(); return true; })()");
    await jusqua("document.querySelector('[data-cl=seq-mettre-tout]')");
    const boutons = await js("JSON.stringify([...document.querySelectorAll('.cl-seq')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()))").then(JSON.parse);
    essai('sous chaque vidéo du lot : « Vers ma timeline », plan par plan (deux), comme un seul plan (la troisième) ; au-dessus : les trois d’un coup',
      boutons.length === 3 && boutons.filter((b) => /^Vers ma timeline\s*plan par plan, à retoucher$/.test(b)).length === 2 && /^Vers ma timeline\s*comme un seul plan \(le fichier\)$/.test(boutons[2])
      && /Mettre les 3 vidéos dans ma timeline/.test(await texteDe('[data-cl=seq-mettre-tout]')), boutons);
    essai('la vidéo ouverte est celle du dossier de travail de l’IA : rien à choisir', !(await js("!!document.querySelector('.ia-change')")));
    await js("(() => { const h = document.querySelector('#cl-haut'); const e = document.querySelector('.cl-lot'); h.scrollTop = e.getBoundingClientRect().top - h.getBoundingClientRect().top + h.scrollTop - 12; return true; })()");
    await capture('14-ia');
    essai('les cartes de l’IA tiennent dans la colonne (rien ne déborde)', await js("(() => { const h = document.querySelector('#cl-haut'); return h.scrollWidth <= h.clientWidth + 1; })()"));
    await clic('[data-cl=seq-mettre]');
    await jusqua('window.derush.videos.liste().length === 3');
    await dormir(600);
    const ia1 = await js("JSON.stringify({ouverte: window.derush.videos.liste().find((v) => v.ouverte), montage: window.derush.projet().montage.map((x) => [x.media, x.entree, x.sortie]), h: window.derush.videos.historique()})").then(JSON.parse);
    essai('« Mettre dans ma timeline » : « Le matin » devient une vidéo de la timeline, plan par plan, et s’ouvre',
      ia1.ouverte?.nom === 'Le matin' && ia1.ouverte?.origine?.mode === 'plans' && json(ia1.montage) === json([['M1', 0.5, 2.5], ['M2', 1, 2]]) && ia1.h.annuler === 0, ia1);
    essai('la note le dit, et l’onglet porte l’étincelle de l’IA', /« Le matin » est dans ta timeline, plan par plan/.test(await texteDe('#notes')) && (await js("!!document.querySelector('.seq-onglet.ouverte .seq-ia')")));
    await jusqua("document.querySelector('.ia-change.seq')", 8000);
    essai('une autre vidéo est ouverte que celle du dossier de l’IA : l’écran de l’IA le dit, et propose de repartir d’elle',
      /L’IA a préparé son dossier pour « Vendredi »/.test(await texteDe('.ia-change.seq')) && (await js("document.querySelector('.ia-change [data-depart=nouveau]').classList.contains('actif')")), await texteDe('.ia-change'));
    essai('« Ta demande vaut pour « Le matin » »', /Ta demande vaut pour « Le matin »\s*3 sur 3/.test(await texteDe('.cl-video-ouverte')), await texteDe('.cl-video-ouverte'));
    await jusqua("/Dans ta timeline/.test(document.querySelector('.cl-seq.ici')?.textContent ?? '')", 8000);
    essai('l’écran de l’IA se relit : sous « Le matin », « Dans ta timeline » ; au-dessus, « les 2 autres »',
      /Dans ta timeline/.test(await texteDe('.cl-seq.ici')) && /Mettre les 2 autres dans ma timeline/.test(await texteDe('[data-cl=seq-mettre-tout]')));
    await capture('15-apres-ia');
    await clic('[data-cl=seq-mettre-tout]');
    await jusqua('window.derush.videos.liste().length === 5', 20000);
    await dormir(800);
    const ia2 = await js("JSON.stringify(window.derush.videos.liste().map((v) => [v.nom, v.plans, v.origine && v.origine.mode, v.ouverte]))").then(JSON.parse);
    essai('« Mettre les 3 vidéos » : les deux autres arrivent (la troisième comme un seul plan, son fichier devenu un média), « Le matin » n’est pas refaite',
      json(ia2.slice(2).map((x) => [x[0], x[2]])) === json([['Le matin', 'plans'], ['Le temple', 'plans'], ['Version 1 de l’IA · 3', 'fichier']]) && ia2.filter((x) => x[0] === 'Le matin').length === 1
      && (await js("window.derush.projet().medias.some((m) => m.nom === 'japon-claude-v1-3.mp4')")), ia2);
    await jusqua("document.querySelector('[data-cl=seq-ouvrir]')", 8000);
    await capture('16-lot');
    essai('au-dessus, « Les 3 sont dans ta timeline » ; sous les autres, « Ouvrir « … » »',
      /Les 3 sont dans ta timeline/.test(await texteDe('.seq-lot.ici')) && (await js("document.querySelectorAll('[data-cl=seq-ouvrir]').length")) === 2);
    const cible = await js("document.querySelector('[data-cl=seq-ouvrir]').dataset.seq");
    await clic('[data-cl=seq-ouvrir]');
    await jusqua(`window.derush.videos.ouverte() === ${json(cible)}`, 8000);
    await capture('16b-ouvrir');
    essai('« Ouvrir « … » » ouvre cette vidéo dans la timeline', (await js('window.derush.videos.ouverte()')) === cible,
      await js("JSON.stringify({ouverte: window.derush.videos.ouverte(), notes: document.querySelector('#notes').textContent.slice(0, 300)})"));

    titre('Une timeline en retard sur le serveur : Dérush relit le projet');
    const avant = await js('window.derush.videos.ouverte()');
    await js(`(() => { window.derush.projet().sequence = 'V999'; const t = document.querySelector('#titre-projet'); t.value = 'Japon (essai)'; t.dispatchEvent(new Event('input', {bubbles: true})); return true; })()`);
    const relu = await jusqua(`window.derush.projet().sequence === ${json(avant)}`, 8000);
    essai('un enregistrement refusé pour une autre vidéo (sequence_ignoree) : la timeline revient à la vidéo du serveur, et le dit',
      relu && /Dérush a relu ton projet/.test(await texteDe('#notes')) && disque().sequence === avant && disque().titre === 'Japon (essai)');
    await capture('17-relu');

    titre('Pour finir');
    const d = disque();
    essai('relu sur le disque : cinq vidéos, leurs noms, la vidéo ouverte', d.sequences.length === 5 && d.sequences.map((s) => s.nom).join() === 'Vidéo 1 (copie),Vendredi,Le matin,Le temple,Version 1 de l’IA · 3' && d.sequence === avant, d.sequences.map((s) => s.nom));
    essai('aucune IA lancée, rien d’installé, aucune boîte confirm()', !(await appels('/(claude\\/demander|moteurs\\/installer)/')).length && (await js('window.__confirm.length')) === 0);
    const errs = erreursPage.filter((e) => !/favicon/i.test(e));
    essai('aucune erreur dans la page', !errs.length, errs.slice(0, 5));
    const errServeur = journalServeur.filter((l) => /TypeError|ReferenceError|SyntaxError/.test(l));
    essai('aucune erreur de programme côté serveur', !errServeur.length, errServeur.slice(0, 3));
  } catch (e) {
    essai(`l’essai de l’interface a pu aller au bout (${e.message})`, false, e.stack?.split('\n').slice(0, 4).join(' | '));
  } finally {
    try { chrome?.kill('SIGTERM'); } catch { /* déjà fermé */ }
    try { serveur?.close(); serveur?.closeAllConnections?.(); } catch { /* déjà fermé */ }
  }
  if (tombes.length) essai('aucune erreur perdue en route', false, tombes.map((e) => String(e?.message ?? e)).slice(0, 3));
}

console.log(`\n${bons}/${total} essais réussis.`);
if (bons === total) {
  await dormir(300);
  fs.rmSync(T, {recursive: true, force: true});
} else console.log(`Dossier d’essai gardé : ${T}`);
process.exit(bons === total ? 0 : 1);
