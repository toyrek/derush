// Dérush — essais de ce qui a été ajouté pour que tous les modèles montent comme le meilleur (version 11.1) :
// l'aide des commandes, la voix claire automatique (« léger » pour une voix déjà nettoyée), la brillance de la voix,
// le rythme (pauses, « euh », redites, mots repris), l'accroche écrite, ce qui est incrusté dans un rush, le carnet du
// monteur, le garde-fou du disque, la note du banc d'essai et sa garde (jamais la vraie installation, jamais un autre
// Dérush que le sien), les pièces du kit et, sur Mac, le détourage.
//   node outils/essai-ameliorations.mjs
// Aucun réseau, aucune IA. Tout est écrit dans un dossier temporaire (le carnet aussi : DERUSH_SUPPORT d'essai). Le banc
// n'y parle qu'à de faux Dérush (de petits serveurs sur 127.0.0.1), avec un dossier personnel d'essai.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {execFileSync, spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-essai-ameliorations-'));
const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
// le carnet s'écrit dans le dossier de Dérush : un dossier d'essai, jamais le vrai (lu à l'import de moteurs.mjs)
const supportVrai = process.env.DERUSH_SUPPORT;
process.env.DERUSH_SUPPORT = path.join(tmp, 'support');
const {FFMPEG, FFPROBE} = await import('../lib/outils.mjs');
const S = await import('../lib/son.mjs');
const R = await import('../lib/rythme.mjs');
const C = await import('../lib/controle.mjs');
const A = await import('../lib/analyse.mjs');
const K = await import('../lib/carnet.mjs');
const Q = await import('../lib/disque.mjs');
const B = await import('./banc-essai.mjs');

let ok = 0;
let ko = 0;
const essai = (nom, vrai, detail = '') => { if (vrai) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`); } };
const ff = (args) => execFileSync(FFMPEG, ['-v', 'error', '-y', ...args]);
const lancer = (script, args, env = {}) => spawnSync(process.execPath, [script, ...args], {encoding: 'utf8', env: {...process.env, ...env}});

console.log('L’aide des commandes (l’IA n’a pas à ouvrir leur code)');
for (const [nom, script, mot] of [['derush-son', 'derush-son.mjs', 'brillance'], ['derush-controle', 'derush-controle.mjs', 'accroche'], ['derush-detourer', 'derush-detourer.mjs', 'PersonneDevant'], ['banc d’essai', 'banc-essai.mjs', '--support']]) {
  const r = lancer(path.join(ICI, script), ['--help']);
  essai(`${nom} --help : le mode d’emploi complet, code 0`, r.status === 0 && r.stdout.includes(mot) && /Usage|usage/.test(r.stdout), `${r.status} ${r.stdout.slice(0, 80)}`);
}
const im = lancer(path.join(RACINE, 'modeles', 'kit-remotion', 'images.mjs'), ['--help']);
essai('node remotion/images.mjs --help : sans rien assembler, code 0', im.status === 0 && /Pieces/.test(im.stdout), `${im.status} ${im.stderr.slice(0, 120)}`);
const inconnu = lancer(path.join(ICI, 'derush-son.mjs'), ['bidule']);
essai('derush-son avec une commande inconnue : une erreur qui renvoie à --help, code 1', inconnu.status === 1 && /--help/.test(inconnu.stdout));

console.log('La voix : déjà nettoyée ou non, et ses aigus');
// une voix de test (sinus haché) : propre (silence entre les mots), puis avec un souffle de ventilation
const propre = path.join(tmp, 'propre.wav');
const sale = path.join(tmp, 'sale.wav');
ff(['-f', 'lavfi', '-i', 'sine=f=180:d=6', '-af', "volume='if(lt(mod(t,0.5),0.3),1,0)':eval=frame", '-ar', '48000', '-ac', '1', propre]);
ff(['-i', propre, '-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.012:d=6', '-filter_complex', '[0:a][1:a]amix=inputs=2:normalize=0', '-ar', '48000', '-ac', '1', sale]);
const fp = await S.fondSonore(propre);
const fs2 = await S.fondSonore(sale);
essai('une voix sans souffle (silence entre les mots) : déjà nettoyée', fp?.deja_nettoye === true, JSON.stringify(fp));
essai('une voix avec un souffle de ventilation (écart sous 36 dB) : à débruiter', fs2?.deja_nettoye === false && fs2.ecart_db < 36, JSON.stringify(fs2));
const auto1 = await S.voixClaire(propre, path.join(tmp, 'auto-propre.wav'), {force: 'auto'});
essai('voix claire « auto » sur une voix propre : « léger », sans débruitage, et dit pourquoi', auto1.force === 'leger' && auto1.fait.some((x) => /aucun débruitage/.test(x)) && /déjà été nettoyée/.test(auto1.pourquoi ?? ''), `${auto1.force} ${auto1.pourquoi}`);
const auto2 = await S.voixClaire(sale, path.join(tmp, 'auto-sale.wav'), {force: 'auto'});
essai('voix claire « auto » sur une voix avec souffle : « normal », souffle retiré', auto2.force === 'normal' && auto2.fait.some((x) => /souffle retiré/.test(x)), `${auto2.force}`);
essai('la voix claire donne la brillance avant et après', Number.isFinite(auto2.avant.brillance_db) && Number.isFinite(auto2.apres.brillance_db));
essai('une voix sans aigus (sous −16 dB) : « sourde », avec le conseil', /sourde/.test(S.avisBrillance(-18.3) ?? '') && /derush-son clair/.test(S.avisBrillance(-16.8) ?? ''));
essai('une voix nette (−15 à −11) : rien à dire ; au-dessus de −8 : elle siffle', S.avisBrillance(-13.6) === null && S.avisBrillance(-11) === null && /siffler/.test(S.avisBrillance(-6) ?? ''));
const bil = await S.bilanSon(propre);
essai('derush-son mesurer donne la brillance et le conseil qui va avec', Number.isFinite(bil.brillance_db) && bil.conseils.some((x) => /sourde/.test(x)), JSON.stringify(bil));
const mauvaise = lancer(path.join(ICI, 'derush-son.mjs'), ['clair', propre, path.join(tmp, 'x.wav'), '--force', 'tres-fort']);
essai('une force inconnue est refusée clairement', mauvaise.status === 1 && /Force inconnue/.test(mauvaise.stdout));

console.log('Le rythme de la parole');
const ph = (txt, t0, pas = 0.3) => txt.split(' ').map((t, k) => ({t, d: t0 + k * pas, f: t0 + k * pas + 0.25}));
const r1 = R.jugerRythme([...ph('Salut. Salut, je vais vous parler de Fire', 0), ...ph('J’ ai hâte de le lire franchement', 3), ...ph('le le découpage euh est super', 6.2), ...ph('et j’ ai hâte de le lire', 9.5)]);
essai('une redite (« j’ai hâte de le lire », Whisper coupe « j’ » du reste) : trouvée, en entier', r1.redites.length === 1 && /^j’ai hâte de le lire/i.test(r1.redites[0].texte), JSON.stringify(r1.redites));
essai('un mot repris (« le le ») : trouvé ; « Salut. Salut, » (voulu) : non', r1.reprises.length === 1 && r1.reprises[0].texte === 'le le', JSON.stringify(r1.reprises));
essai('un « euh » : trouvé, avec son temps', r1.hesitations.length === 1 && r1.hesitations[0].mot === 'euh' && Math.abs(r1.hesitations[0].a - 7.1) < 0.01, JSON.stringify(r1.hesitations));
essai('les pauses de plus de 0,7 s : trouvées, et le temps qu’on pourrait gagner', r1.pauses.length === 2 && r1.gain_possible_s > 1.5, `${JSON.stringify(r1.pauses)} ${r1.gain_possible_s}`);
essai('« nous nous », « vous vous » : jamais un mot repris', R.jugerRythme(ph('nous nous sommes vus et vous vous souvenez', 0)).reprises.length === 0);
const tard = R.jugerRythme(ph('bonjour à tous et bienvenue', 1.4));
essai('une parole qui commence tard (1,4 s) : signalée', tard.debut_parole_s === 1.4 && tard.attention.some((x) => /ne commence qu/.test(x)));
const net = R.jugerRythme(ph('une phrase nette sans rien à redire du tout', 0.1));
essai('une parole nette : rien à regarder, et le débit en mots par minute', net.attention.length === 0 && net.debit_mots_min > 150, `${JSON.stringify(net.attention)} ${net.debit_mots_min}`);

console.log('L’accroche écrite (les 2 premières secondes)');
const vocab = C.vocabulaire(['Réception presse de chez Akata', 'service presse', 'la collection Héritages']);
const ligne = (t, h, y = 0.3) => ({t, h, x: 0.1, y, l: 0.8, confiance: 1, mots: t.split(' ').map((m, k) => ({t: m, x: 0.1 + k * 0.2, y, l: 0.18, h}))});
const lecture = (lignes, ips = 3) => ({images: Array.from({length: 9}, (_, k) => ({t: k / ips, lignes}))});
const a1 = C.accrocheEcrite(lecture([ligne('RÉCEPTION', 0.127), ligne('PRESSE', 0.154, 0.45)]), vocab);
essai('un grand titre (15 % de la hauteur) : accroche franche', a1.ok && a1.hauteur_pct === 15.4 && a1.texte === 'PRESSE', JSON.stringify(a1));
const a2 = C.accrocheEcrite(lecture([ligne('SERVICE PRESSE', 0.015, 0.1), ligne('de chez Akata', 0.047, 0.7)]), vocab);
essai('une étiquette et des sous-titres seulement (4,7 %) : accroche discrète, avec le conseil', !a2.ok && a2.hauteur_pct === 4.7 && /derrière la personne/.test(a2.detail), JSON.stringify(a2));
const a3 = C.accrocheEcrite(lecture([ligne('PLANETES', 0.12)]), vocab, {filme: ['planetes']});
essai('un grand texte filmé (un livre) ne compte pas comme accroche', !a3.ok, JSON.stringify(a3));
const a4 = C.accrocheEcrite({images: [{t: 0, lignes: []}]}, vocab);
essai('aucun texte : accroche discrète, et on le dit', !a4.ok && /aucun texte/.test(a4.detail));
essai('la phrase de l’accroche discrète est à part (« Accroche discrète : … »)', C.phrases({problemes: [], attention: [{type: 'accroche', texte: '', a: '0 s', detail: 'aucun texte'}]})[0] === 'Accroche discrète : aucun texte');

console.log('Ce qui est déjà incrusté dans un rush');
const tr = A.transitionsRapides([3, 16, 16.167, 16.267, 18.933, 19.233, 19.4, 25, 48.133]);
essai('des coupes serrées (moins de 0,4 s) : une transition d’appli ; une coupe seule : un plan', tr.length === 2 && tr[0].de === 16 && tr[0].coupes === 3 && tr[1].coupes === 3, JSON.stringify(tr));
const lu = A.texteLu([
  {t: 48, lignes: [{t: 'CapCut', h: 0.03, confiance: 1}]},
  {t: 48.5, lignes: [{t: 'CaoCut', h: 0.03, confiance: 1}]},
  {t: 16, lignes: [{t: 'BAN DE SANG', h: 0.013, confiance: 1}, {t: 'Ordre de conscription', h: 0.136, confiance: 1}]},
  {t: 18, lignes: [{t: 'Ordre de conscription', h: 0.13, confiance: 1}]},
]);
essai('le logo d’une appli (même mal lu : « CaoCut ») : trouvé une fois', lu.logos.length === 1 && lu.logos[0].t === 48, JSON.stringify(lu.logos));
essai('le grand texte est gardé (de 16 à 18 s), les bulles d’une page filmée non', lu.texte.length === 1 && lu.texte[0].de === 16 && lu.texte[0].a === 18, JSON.stringify(lu.texte));
const res = A.resumeIncrustes({transitions_rapides: tr, images_noires: [[16, 16.067], [48.133, 50.1]], logos: lu.logos, son_coupe: [[48.135, 50.155]], texte: lu.texte});
essai('le résumé dit tout en une phrase', /2 transitions rapides/.test(res) && /2 passages noirs/.test(res) && /logo CapCut/.test(res) && /son coupé net/.test(res) && /Ordre de conscription/.test(res), res);
essai('un rush propre : aucun résumé', A.resumeIncrustes({transitions_rapides: [], images_noires: [], logos: [], son_coupe: [], texte: []}) === '');

console.log('Le carnet du monteur');
const lecons = K.leconsDe('# Notes\n- Ses rushes sortent de CapCut : logo sur les 2 dernières secondes, à couper.\n- court\n- Clé : sk-abcdefghijklmnopqrstuvwx à garder\n* La voix de ses chroniques est déjà nettoyée par le téléphone : « léger ».\nUne phrase sans tiret.\n- Trois\n- ' + 'x'.repeat(400));
essai('les leçons : une par ligne « - », ni trop courtes, ni secrètes, 300 signes au plus', lecons.length === 3 && !lecons.some((l) => /sk-/.test(l)) && lecons[2].length === 298, JSON.stringify(lecons.map((l) => l.slice(0, 40))));
essai('un carnet vide : pas de CARNET.md', K.texteCarnet() === null);
const aj = K.ajouterLecons(lecons.slice(0, 2), {projet: 'Chronique manga', ia: 'claude', modele: 'claude-opus-5-5'});
const aj2 = K.ajouterLecons(['Ses rushes sortent de CapCut : logo sur les 2 dernières secondes, à couper.', 'Une leçon toute neuve sur les sous-titres.']);
essai('les leçons s’ajoutent, sans doublon', aj.length === 2 && aj2.length === 1 && K.lireCarnet().length === 3);
const at = path.join(tmp, 'atelier');
fs.mkdirSync(at);
fs.writeFileSync(path.join(at, K.FICHIER_IA), '- Une leçon écrite pendant ce travail-ci, pour la suite.\n');
const debut = Date.now();
essai('après un travail : les leçons de carnet-ia.md sont recueillies', K.recueillirCarnet(at, debut, {projet: 'Essai'}).length === 1);
fs.utimesSync(path.join(at, K.FICHIER_IA), new Date(debut - 3600e3), new Date(debut - 3600e3));
essai('un carnet-ia.md d’un travail précédent n’est pas relu', K.recueillirCarnet(at, debut).length === 0);
const texte = K.texteCarnet();
essai('CARNET.md : les leçons, les plus récentes d’abord, et ce qu’il faut écrire à la fin', /^# Carnet du monteur/.test(texte) && texte.indexOf('pendant ce travail-ci') < texte.indexOf('CapCut') && texte.includes('carnet-ia.md'), texte.slice(0, 200));
essai('une leçon s’efface, puis tout le carnet', K.retirerLecon(K.lireCarnet()[0].id) && K.lireCarnet().length === 3 && (K.viderCarnet(), K.lireCarnet().length === 0));

console.log('Le garde-fou du disque');
essai('la place libre se lit', Q.placeLibre(tmp) > 0);
essai('sous le minimum : refus, avec ce qu’il faut faire', (() => { const v = Q.verifierPlace(tmp, {mini: 1e15, confort: 2e15}); return !v.ok && /Libère de la place/.test(v.texte); })());
essai('sous le confort : on prévient sans refuser', (() => { const v = Q.verifierPlace(tmp, {mini: 1, confort: 1e15}); return v.ok && v.prevenir && /Il ne reste que/.test(v.texte); })());
const m = path.join(tmp, 'menage');
for (const n of ['derush-voix-ancien', 'derush-assemblage-recent', 'autre-ancien']) { fs.mkdirSync(path.join(m, n), {recursive: true}); fs.writeFileSync(path.join(m, n, 'f'), 'x'); }
const vieux = new Date(Date.now() - 7 * 3600e3);
for (const n of ['derush-voix-ancien', 'autre-ancien']) fs.utimesSync(path.join(m, n), vieux, vieux);
fs.symlinkSync(path.join(m, 'autre-ancien'), path.join(m, 'derush-lien'));
const men = Q.menageTemporaire({dossier: m});
essai('le ménage : seulement les dossiers « derush- » de plus de 6 h (ni les récents, ni ceux des autres, ni un lien)', men.n === 1 && !fs.existsSync(path.join(m, 'derush-voix-ancien')) && fs.existsSync(path.join(m, 'derush-assemblage-recent')) && fs.existsSync(path.join(m, 'autre-ancien')) && fs.existsSync(path.join(m, 'derush-lien')), JSON.stringify(men));

console.log('La note du banc d’essai');
const parfait = B.noter({video: 'v.mp4', textes_a_corriger: 0, accroche_pct: 15, brillance_db: -13.6, pauses: 0, hesitations: 0, redites: 0, reprises: 0, lufs: -14, crete_dbtp: -1.7});
essai('un montage sans défaut mesuré : 100', parfait.note === 100 && !parfait.pourquoi.length);
const moyen = B.noter({video: 'v.mp4', textes_a_corriger: 32, accroche_pct: 4.7, brillance_db: -16.8, pauses: 1, hesitations: 0, redites: 1, reprises: 0, lufs: -14.1, crete_dbtp: -1.7});
essai('32 mots collés, une accroche discrète, une voix sourde, deux accrocs : 34, avec les raisons', moyen.note === 34 && moyen.pourquoi.length === 4, JSON.stringify(moyen));
essai('aucune vidéo livrée : 0', B.noter({video: null}).note === 0);

// Le banc lance une vraie IA : il ne doit jamais travailler dans la vraie installation, ni piloter un autre Dérush que
// le sien (l'app ouverte de la personne : il y créerait ses projets et l'éteindrait à la fin).
console.log('La garde du banc : jamais le dossier de la vraie installation');
{
  const G = path.join(tmp, 'banc-garde');
  const vrai = path.join(G, 'Support', 'Dérush');
  fs.mkdirSync(vrai, {recursive: true});
  fs.symlinkSync(vrai, path.join(G, 'lien'));
  fs.mkdirSync(path.join(G, 'essai'), {recursive: true});
  fs.mkdirSync(path.join(G, 'Support', 'Dérush-essai'), {recursive: true});
  const garde = (s) => B.dossierInterdit(s, vrai);
  essai('le même chemin est refusé', garde(vrai) === true);
  essai('le même dossier par un lien est refusé', garde(path.join(G, 'lien')) === true);
  essai('un dossier rangé dans la vraie installation est refusé (même pas encore créé)', garde(path.join(vrai, 'essai')) === true);
  essai('le même chemin avec « é » décomposé est refusé', garde(path.join(G, 'Support', 'Dérush'.normalize('NFD'))) === true);
  if (fs.existsSync(path.join(G, 'support', 'dérush'))) essai('le même dossier écrit avec une autre casse est refusé', garde(path.join(G, 'support', 'dérush')) === true);
  essai('un chemin relatif vers le même dossier est refusé', garde(path.relative(process.cwd(), vrai)) === true);
  essai('un dossier d’essai à part est accepté', garde(path.join(G, 'essai')) === false);
  essai('un dossier voisin au nom proche est accepté', garde(path.join(G, 'Support', 'Dérush-essai')) === false);
  essai('un dossier d’essai pas encore créé est accepté', garde(path.join(G, 'nouveau', 'support')) === false);
  essai('sans vraie installation connue, rien n’est refusé', B.dossierInterdit(vrai, '') === false);
}

// Une copie du banc, à côté d'un faux derush.mjs : même si une garde sautait, aucun vrai Dérush ne serait lancé.
console.log('Le banc ne pilote jamais un autre Dérush que le sien');
{
  const D = path.join(tmp, 'banc-port');
  const arbre = path.join(D, 'arbre');
  fs.mkdirSync(path.join(arbre, 'outils'), {recursive: true});
  for (const f of ['banc-essai.mjs', 'commande.mjs']) fs.copyFileSync(path.join(ICI, f), path.join(arbre, 'outils', f));
  // le faux Dérush note chaque requête, refuse de créer un projet, s'éteint sur « quitter » (et de lui-même au bout de 2 min)
  fs.writeFileSync(path.join(arbre, 'derush.mjs'), `
import http from 'node:http';
import fs from 'node:fs';
const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
const note = (x) => fs.appendFileSync(process.env.FAUX_JOURNAL, x + '\\n');
fs.appendFileSync(process.env.FAUX_JOURNAL + '.lance', 'lancé\\n');
setTimeout(() => process.exit(0), 120e3).unref();
http.createServer((req, res) => {
  note(req.method + ' ' + req.url);
  const json = (code, o) => { res.writeHead(code, {'content-type': 'application/json'}); res.end(JSON.stringify(o)); };
  if (req.url === '/') { res.writeHead(200, {'content-type': 'text/html'}); return res.end('<meta name="derush-jeton" content="jetonB">'); }
  if (req.url === '/api/etat') return json(200, {bibliotheque: process.env.FAUX_BIBLIO === 'la-sienne' ? process.env.DERUSH_BIBLIOTHEQUE : '/ailleurs'});
  if (req.method === 'POST' && req.url === '/api/projets') return json(500, {erreur: 'refusé par l’essai'});
  if (req.method === 'POST' && req.url === '/api/quitter') { json(200, {ok: true}); return setTimeout(() => process.exit(0), 50); }
  return json(200, {ok: true});
}).listen(port, '127.0.0.1');
`);
  const cas = path.join(D, 'cas.json');
  fs.writeFileSync(cas, JSON.stringify([{nom: 'Essai', medias: [cas], consigne: 'rien'}]));
  const portLibre = () => new Promise((r) => { const s = http.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
  // un dossier personnel d'essai : la vraie installation n'est même pas regardée
  const lancerBanc = (port, extra = {}) => new Promise((r) => {
    const env = {...process.env, HOME: path.join(D, 'maison'), ...extra};
    for (const k of ['TREG_TOKEN', 'ELEVENLABS_API_KEY', 'DERUSH_SUPPORT', 'DERUSH_BIBLIOTHEQUE']) delete env[k];
    const p = spawn(process.execPath, [path.join(arbre, 'outils', 'banc-essai.mjs'), cas, '--support', path.join(D, 'essai'), '--sortie', path.join(D, `sortie-${port}`), '--port', String(port)],
      {env, stdio: ['ignore', 'pipe', 'pipe']});
    let sortie = '';
    p.stdout.on('data', (d) => { sortie += d; });
    p.stderr.on('data', (d) => { sortie += d; });
    const minuterie = setTimeout(() => p.kill(), 90e3);
    p.on('exit', (code) => { clearTimeout(minuterie); r({code, sortie}); });
  });
  const journal = (n) => { const f = path.join(D, `journal-${n}.txt`); fs.writeFileSync(f, ''); return f; };
  const envois = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').filter((x) => x && !x.startsWith('GET'));

  // un Dérush tourne déjà sur le port (l'app de la personne) : il ne reçoit qu'un « ping »
  const recues = [];
  const A = http.createServer((req, res) => {
    recues.push(`${req.method} ${req.url}`);
    const json = (code, o) => { res.writeHead(code, {'content-type': 'application/json'}); res.end(JSON.stringify(o)); };
    if (req.url === '/api/ping') return json(200, {derush: true});
    if (req.url === '/') { res.writeHead(200, {'content-type': 'text/html'}); return res.end('<meta name="derush-jeton" content="jetonA">'); }
    if (req.url === '/api/etat') return json(200, {bibliotheque: '/Users/quelqu-un/Movies/Dérush'});
    if (req.method === 'POST' && req.url === '/api/projets') return json(500, {erreur: 'refusé par l’essai'});
    return json(200, {ok: true});
  });
  const portA = await portLibre();
  await new Promise((r) => A.listen(portA, '127.0.0.1', r));
  const j2 = journal(2);
  const r2 = await lancerBanc(portA, {FAUX_JOURNAL: j2, FAUX_BIBLIO: 'la-sienne'});
  await new Promise((r) => { A.close(r); A.closeAllConnections?.(); });
  const postsA = recues.filter((x) => !x.startsWith('GET'));
  essai('port déjà pris par un Dérush : le banc s’arrête et le dit', r2.code === 1 && /port .* déjà pris/.test(r2.sortie), `${r2.code} ${r2.sortie.slice(0, 200)}`);
  essai('… sans rien créer chez lui ni l’éteindre, et sans lancer le sien', !postsA.length && !fs.existsSync(`${j2}.lance`), JSON.stringify(postsA));

  // le Dérush qui répond n'est pas sur la bibliothèque du banc : le banc l'arrête lui-même, sans rien lui envoyer
  const j3 = journal(3);
  const p3 = await portLibre();
  const r3 = await lancerBanc(p3, {FAUX_JOURNAL: j3, FAUX_BIBLIO: 'autre'});
  essai('un Dérush sur une autre bibliothèque : le banc s’arrête et le dit', r3.code === 1 && /n’est pas celui du banc/.test(r3.sortie), `${r3.code} ${r3.sortie.slice(0, 200)}`);
  essai('… sans lui créer de projet ni rien lui envoyer', envois(j3).length === 0, JSON.stringify(envois(j3)));

  // le sien : le banc l'éteint à la fin, même après une erreur
  const j4 = journal(4);
  const p4 = await portLibre();
  const r4 = await lancerBanc(p4, {FAUX_JOURNAL: j4, FAUX_BIBLIO: 'la-sienne'});
  essai('son propre Dérush : le banc y crée son projet, puis l’éteint (même après une erreur)', envois(j4).includes('POST /api/projets') && envois(j4).includes('POST /api/quitter'), `${JSON.stringify(envois(j4))} ${r4.sortie.slice(0, 300)}`);
  // un faux Dérush encore là (si une garde a sauté) : éteint ici, sans attendre ses 2 minutes
  for (const p of [portA, p3, p4]) await fetch(`http://127.0.0.1:${p}/api/quitter`, {method: 'POST', signal: AbortSignal.timeout(1000)}).catch(() => {});
}

console.log('Les pièces du kit');
const P = path.join(RACINE, 'modeles', 'kit-remotion', 'src', 'pieces');
const index = fs.readFileSync(path.join(P, 'index.ts'), 'utf8');
const pieces = ['TitreGeant', 'PersonneDevant', 'SousTitres', 'Etiquette', 'CarteListe', 'Barreaux', 'VieuxPapier', 'CasesQuiSeDessinent', 'BoutonAbonnement', 'CartonDeFin'];
essai('les dix pièces existent et sont exportées', pieces.every((p) => fs.existsSync(path.join(P, `${p}.tsx`)) && index.includes(`export {${p}`)));
const lisez = fs.readFileSync(path.join(P, 'LISEZMOI.md'), 'utf8');
essai('chacune a sa ligne dans LISEZMOI.md, et la recette de l’accroche derrière la personne', pieces.every((p) => lisez.includes(`\`${p}\``)) && /derush-detourer/.test(lisez));
essai('la composition « Pieces » est déclarée dans Racine.tsx', /id="Pieces"/.test(fs.readFileSync(path.join(RACINE, 'modeles', 'kit-remotion', 'src', 'Racine.tsx'), 'utf8')));
essai('aucune pièce ne dépend de l’horloge (pas de Date.now, setTimeout, requestAnimationFrame)', pieces.every((p) => !/Date\.now|setTimeout|setInterval|requestAnimationFrame/.test(fs.readFileSync(path.join(P, `${p}.tsx`), 'utf8'))));

// le détourage, sur Mac (Apple Vision) : une petite vidéo, un passage
console.log('Le détourage (sur Mac)');
const pyEssai = supportVrai ? path.join(supportVrai, 'moteurs', 'python', 'bin', 'python') : null;
if (process.platform === 'darwin' && pyEssai && fs.existsSync(pyEssai)) {
  const v = path.join(tmp, 'mire.mp4');
  ff(['-f', 'lavfi', '-i', 'testsrc2=s=540x960:r=30:d=1', '-pix_fmt', 'yuv420p', v]);
  const d = path.join(tmp, 'pack');
  fs.mkdirSync(path.join(d, 'remotion', 'public'), {recursive: true});
  fs.writeFileSync(path.join(d, 'montage.json'), '{}');
  const r = spawnSync(process.execPath, [path.join(ICI, 'derush-detourer.mjs'), v, '--de', '0.2', '--a', '0.5'], {cwd: d, encoding: 'utf8', env: {...process.env, DERUSH_SUPPORT: supportVrai ?? ''}});
  let j = null; try { j = JSON.parse(r.stdout); } catch { /* pas du JSON */ }
  essai('derush-detourer dans un pack : les images du passage dans remotion/public/detourage/, et la ligne à coller', r.status === 0 && j?.ok && j.premiere === 6 && j.derniere === 15 && /^detourage\//.test(j.public) && /<PersonneDevant dossier="detourage\//.test(j.piece) && fs.existsSync(path.join(d, 'remotion', 'public', j.public, 'd_00006.webp')) && fs.existsSync(path.join(d, 'remotion', 'public', j.public, 'detourage.json')), `${r.status} ${r.stdout.slice(0, 300)} ${r.stderr.slice(0, 200)}`);
  const r2 = spawnSync(process.execPath, [path.join(ICI, 'derush-detourer.mjs'), v, '--de', '0.8', '--a', '0.2'], {cwd: d, encoding: 'utf8', env: {...process.env, DERUSH_SUPPORT: supportVrai}});
  essai('un passage vide est refusé clairement', r2.status === 1 && /Passage vide/.test(r2.stdout));
  // le passage seul : FFmpeg se place juste avant l'image i0 et s'arrête après i1, au lieu de décoder tout le rush
  // (un faux FFmpeg note ce qu'on lui demande ; la cadence donnée, puis lue dans le fichier)
  const note = path.join(tmp, 'ffmpeg-args.txt');
  const fauxFf = path.join(tmp, 'faux-ffmpeg');
  fs.writeFileSync(fauxFf, `#!/bin/sh\nprintf '%s\\n' "$@" > '${note}'\n`, {mode: 0o755});
  const passe = (args) => {
    fs.rmSync(note, {force: true});
    const p = spawnSync(pyEssai, [path.join(ICI, 'detourer.py'), 'decoupes', v, path.join(tmp, 'decoupes'), ...args], {encoding: 'utf8', env: {...process.env, DERUSH_FFMPEG: fauxFf, DERUSH_FFPROBE: FFPROBE}});
    const a = fs.existsSync(note) ? fs.readFileSync(note, 'utf8').split('\n') : [];
    return {ok: p.status === 0, ss: Number(a[a.indexOf('-ss') + 1]), images: Number(a[a.indexOf('-frames:v') + 1]), a, err: p.stderr.slice(-200)};
  };
  const p1 = passe(['1700', '1705', '1920', '30']);
  essai('detourer.py decoupes, images 1700 à 1705 à 30 i/s : il saute à 56,65 s et s’arrête après 6 images', p1.ok && Math.abs(p1.ss - 1699.5 / 30) < 1e-4 && p1.images === 6, `${p1.a.join(' ')} ${p1.err}`);
  const p2 = passe(['15', '20']);
  essai('… sans cadence donnée, il la lit dans le fichier (30 i/s) et saute quand même', p2.ok && Math.abs(p2.ss - 14.5 / 30) < 1e-4 && p2.images === 6, `${p2.a.join(' ')} ${p2.err}`);
} else console.log('  (sauté : sur Mac, donne un dossier de Dérush d’essai qui a le moteur de détourage, DERUSH_SUPPORT=… ; jamais la vraie installation)');

fs.rmSync(tmp, {recursive: true, force: true});
console.log(`\n${ok} essais réussis sur ${ok + ko}.`);
process.exit(ko ? 1 : 0);
