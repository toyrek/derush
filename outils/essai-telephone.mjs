// Dérush — les essais de « Suivre sur mon téléphone » (lib/telephone.mjs, public/mobile/, public/telephone.js), pour
// qui modifie Dérush :
//   node outils/essai-telephone.mjs [dossier où créer le dossier d'essai]
// Rien ne s'ouvre sur le réseau : la porte du téléphone écoute cet ordinateur seul (127.0.0.1), sur un port libre. Aucune
// IA, aucun appel réel : la porte reçoit une fausse source (ce que le téléphone voit et fait), et la vraie source de
// Dérush n'est essayée qu'en lecture, sur un projet jetable (jamais « écrire » : il lancerait une IA).
// Ce qui est vérifié : les adresses d'un réseau privé et leur ordre, la porte fermée tant qu'on ne l'allume pas, la page
// (aucun secret dedans, rien d'ailleurs, jamais dans un cadre), le jumelage (le code, les six chiffres, le nombre à
// comparer, le clic sur l'ordinateur, le refus, la fin des dix minutes, un code qui ne sert qu'une fois), le jeton (son
// empreinte seule est gardée), les billets des images et des vidéos, l'écriture coupée par défaut, les fichiers servis
// (par morceaux, jamais hors du projet, jamais un lien), trop d'essais, la porte qui se rouvre au lancement, ce que le
// téléphone reçoit de Dérush (aucun chemin de l'ordinateur), les routes du serveur de Dérush, et les deux pages.
// La fabrication de l'image d'une vidéo demande FFmpeg (sautée sinon). Le dossier d'essai est effacé à la fin, sauf en
// cas d'échec.
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
const T = fs.mkdtempSync(path.join(fs.realpathSync(parent), 'derush-essai-telephone-'));
// AVANT tout import de lib/ : le dossier de Dérush, la bibliothèque et le dossier personnel sont lus au chargement
const SUPPORT = path.join(T, 'support');
const BIBLIO = path.join(T, 'bibliotheque');
const MAISON = path.join(T, 'maison');
for (const d of [SUPPORT, BIBLIO, path.join(MAISON, 'Documents'), path.join(T, 'tmp')]) fs.mkdirSync(d, {recursive: true});
Object.assign(process.env, {DERUSH_SUPPORT: SUPPORT, DERUSH_BIBLIOTHEQUE: BIBLIO, DERUSH_SANS_MAJ: '1', DERUSH_SANS_NAVIGATEUR: '1', DERUSH_DRIVE: path.join(T, 'pas-de-drive'),
  HOME: MAISON, USERPROFILE: MAISON, TMPDIR: path.join(T, 'tmp'),
  // la porte créée par le serveur de Dérush : cet ordinateur seul, un port libre
  DERUSH_TELEPHONE_HOTE: '127.0.0.1', DERUSH_TELEPHONE_PORT: '0'});
for (const k of ['TREG_TOKEN', 'ELEVENLABS_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY']) delete process.env[k];
if (os.homedir() !== MAISON) { console.error('Le dossier personnel d’essai n’est pas pris en compte : essais abandonnés.'); process.exit(1); }

const tombes = [];
process.on('unhandledRejection', (e) => tombes.push(e));
process.on('uncaughtException', (e) => tombes.push(e));
const journal = [];
console.error = (...a) => { journal.push(a.map((x) => String(x?.message ?? x)).join(' ')); };

const lib = (m) => import(pathToFileURL(path.join(D, 'lib', m)).href);
const T_ = await lib('telephone.mjs');
const {FFMPEG, FileDAttente} = await lib('outils.mjs');
const {Projet} = await lib('projet.mjs');
const {VERSION} = await lib('commun.mjs');

let bons = 0;
let total = 0;
function essai(quoi, vrai, detail = '') {
  total++; if (vrai) bons++;
  console.log(`${vrai ? '  ✓' : '  ✗'} ${quoi}${vrai || !detail ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)?.slice(0, 500)}`}`);
}
const titre = (t) => console.log(`\n${t}`);
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';

// ——— une fausse source : ce que le téléphone voit et fait, sans Dérush derrière ———
const IMAGE = path.join(T, 'image.jpg');
fs.writeFileSync(IMAGE, Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex'));
const VIDEO = path.join(T, 'film.mp4');
fs.writeFileSync(VIDEO, Buffer.from(Array.from({length: 5000}, (_, i) => i % 251)));
const recus = {ecrits: [], arrets: 0, images: []};
const fausseSource = () => ({
  etat: async () => ({ordinateur: 'Ordinateur d’essai', projet: {titre: 'Projet d’essai'}, travail: {titre: 'L’IA monte ta vidéo', etape: 'ia', depuis_s: Math.round(Date.now() / 1000) % 1000, pct: null}, file: null, fil: [], videos: []}),
  image: async (genre, a, b) => { recus.images.push([genre, a, b]); return genre === 'direct' && a === 'r1' ? IMAGE : genre === 'vue' && a === '3' ? IMAGE : null; },
  video: async (nom) => (nom === 'film-été.mp4' ? {chemin: VIDEO, nom} : null),
  affiche: async (nom) => (nom === 'film-été.mp4' ? IMAGE : null),
  ecrire: async (texte) => { if (texte === 'déjà') throw new Error('L’IA travaille déjà sur ce projet.'); recus.ecrits.push(texte); return {ok: true, pendant: true}; },
  arreter: async () => { recus.arrets++; return true; },
});
const CARTES = {lo0: [{address: '127.0.0.1', family: 'IPv4', internal: true}], en0: [{address: '192.168.1.23', family: 'IPv4', internal: false}, {address: 'fe80::1', family: 'IPv6', internal: false}]};
let decalage = 0; // l'horloge de la porte, avancée par les essais
const eveils = []; // ce que la porte demande pour garder l'ordinateur éveillé (jamais le vrai : un faux, compté)
const fauxEveil = (s) => { const p = {secondes: s, arrete: false, kill() { p.arrete = true; }, once() {}}; eveils.push(p); return p; };
const nouvelle = (nom, plus = {}) => T_.creerTelephone({source: fausseSource(), fichier: path.join(T, `${nom}.json`), port: 0, hote: '127.0.0.1', cartes: () => CARTES, maintenant: () => Date.now() + decalage, eveil: fauxEveil, ...plus});
/** Une demande à la porte : {code, j (JSON), t (texte), h (en-têtes)}. */
const demande = (tel, chemin, {methode = 'GET', corps, jeton, entetes = {}, hote = null, brut = null} = {}) => new Promise((ok) => {
  const h = {...(jeton ? {'x-derush-telephone': jeton} : {}), ...(corps !== undefined ? {'content-type': 'application/json'} : {}), 'user-agent': IPHONE, ...entetes, ...(hote ? {host: hote} : {})};
  const req = http.request({host: '127.0.0.1', port: tel.port, method: methode, path: chemin, headers: h}, (res) => {
    const m = [];
    res.on('data', (d) => m.push(d));
    res.on('end', () => { const b = Buffer.concat(m); let j = null; try { j = JSON.parse(b.toString('utf8')); } catch { /* pas du JSON */ } ok({code: res.statusCode, j, t: b.toString('utf8'), octets: b, h: res.headers}); });
  });
  req.on('error', (e) => ok({code: 0, erreur: e.code}));
  req.end(brut ?? (corps !== undefined ? JSON.stringify(corps) : undefined));
});
const moi = () => crypto.randomBytes(15).toString('base64url');
/** Relie un téléphone par le vrai chemin : le code, la demande, le clic « Relier » ; rend son jeton. */
async function relier(tel, ua = IPHONE) {
  const e = await tel.ouvrirJumelage();
  const code = new URL(e.jumelage.lien).hash.slice(3);
  const m = moi();
  await demande(tel, '/api/jumeler', {methode: 'POST', corps: {code, moi: m}, entetes: {'user-agent': ua}});
  tel.repondre(tel.etat().demandes[0].id, true);
  return (await demande(tel, '/api/jumeler', {methode: 'POST', corps: {moi: m}})).j.jeton;
}

const portes = [];
let serveur = null;
try {
  // ————————————————————————————————————————————————————————————————————————————————
  titre('Les adresses du réseau');
  const privees = ['10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.20', '169.254.10.1', '100.64.0.1', '100.127.255.254', '127.0.0.1', '::ffff:192.168.1.5'];
  const publiques = ['8.8.8.8', '172.32.0.1', '172.15.255.255', '100.128.0.1', '100.63.255.255', '192.169.1.1', '11.0.0.1', '::1', 'fe80::1', 'abc', '999.1.1.1', '192.168.1', '', null, undefined];
  essai('adressePrivee : la maison, l’association, un partage de connexion, Tailscale, cet ordinateur', privees.every(T_.adressePrivee), privees.filter((a) => !T_.adressePrivee(a)));
  essai('… et jamais une adresse d’Internet (ni une adresse mal écrite)', !publiques.some(T_.adressePrivee), publiques.filter(T_.adressePrivee));
  const cartes = {
    lo0: [{address: '127.0.0.1', family: 'IPv4', internal: true}],
    en0: [{address: 'fe80::1c2:3ff', family: 'IPv6', internal: false}, {address: '192.168.1.23', family: 'IPv4', internal: false}],
    utun4: [{address: '10.8.0.2', family: 'IPv4', internal: false}],
    bridge100: [{address: '192.168.64.1', family: 'IPv4', internal: false}],
    'vEthernet (WSL)': [{address: '172.20.48.1', family: 'IPv4', internal: false}],
    en7: [{address: '169.254.44.2', family: 'IPv4', internal: false}],
    en9: [{address: '203.0.113.7', family: 'IPv4', internal: false}],
    tailscale0: [{address: '100.101.102.103', family: 4, internal: false}],
  };
  let adr = T_.adressesLocales('192.168.1.23', cartes);
  essai('adressesLocales : le Wi-Fi d’abord (conseillé), les tunnels et les machines virtuelles après', adr[0]?.ip === '192.168.1.23' && adr[0].conseillee && adr.filter((a) => a.conseillee).length === 1 && adr.findIndex((a) => a.ip === '10.8.0.2') > adr.findIndex((a) => a.ip === '169.254.44.2'), adr);
  essai('… sans l’adresse de l’ordinateur lui-même, ni IPv6, ni une adresse d’Internet ; Tailscale reste proposé', !adr.some((a) => ['127.0.0.1', '203.0.113.7'].includes(a.ip) || a.ip.includes(':')) && adr.some((a) => a.ip === '100.101.102.103') && adr.length === 6, adr.map((a) => a.ip));
  adr = T_.adressesLocales('10.8.0.2', cartes);
  essai('… avec un VPN allumé (l’ordinateur sort par le tunnel), le Wi-Fi reste devant', adr[0]?.ip === '192.168.1.23', adr.map((a) => a.ip));
  const windows = T_.adressesLocales(null, {'Local Area Connection': [{address: '192.168.0.12', family: 'IPv4', internal: false}], 'vEthernet (Default Switch)': [{address: '172.24.16.1', family: 'IPv4', internal: false}], Tailscale: [{address: '100.90.1.2', family: 'IPv4', internal: false}], 'Wi-Fi': [{address: '10.0.0.7', family: 'IPv4', internal: false}]});
  essai('… sous Windows : « Wi-Fi » et « Local Area Connection » devant les cartes de machines virtuelles et les tunnels', windows.slice(0, 2).map((a) => a.ip).sort().join() === '10.0.0.7,192.168.0.12' && windows.at(-1).ip === '100.90.1.2', windows);
  essai('… et sans réseau : aucune adresse', T_.adressesLocales(null, {lo0: cartes.lo0}).length === 0 && T_.adressesLocales(null, {}).length === 0);
  const sortie = await T_.adresseDeSortie();
  essai('adresseDeSortie : une adresse IPv4 ou rien, sans jamais rester bloquée', sortie === null || /^\d+\.\d+\.\d+\.\d+$/.test(sortie), sortie);
  const noms = [[IPHONE, 'iPhone · Safari'], [ANDROID, 'Android (Pixel 10) · Chrome'], ['Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36', 'Android · Chrome'],
    ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1', 'iPad · Chrome'], ['Mozilla/5.0 (Android 15; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0', 'Android · Firefox'],
    ['Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0 Mobile Safari/537.36', 'Android (SM-S911B) · Samsung Internet'], ['', 'Appareil'], [undefined, 'Appareil']];
  essai('nomAppareil : « iPhone · Safari », « Android (Pixel 10) · Chrome »…', noms.every(([ua, n]) => T_.nomAppareil(ua) === n), noms.map(([ua]) => T_.nomAppareil(ua)));
  essai('nomOrdinateur : « MacBook-Pro-de-Lea.local » devient « MacBook Pro de Lea »', T_.nomOrdinateur('MacBook-Pro-de-Lea.local') === 'MacBook Pro de Lea' && T_.nomOrdinateur('DESKTOP-AB12') === 'DESKTOP AB12' && T_.nomOrdinateur('') === 'ton ordinateur');

  // ————————————————————————————————————————————————————————————————————————————————
  titre('La porte : fermée tant qu’on ne l’allume pas');
  const tel = nouvelle('telephone');
  portes.push(tel);
  let e = await tel.demarrer();
  essai('au lancement, sans réglage : éteinte, rien n’écoute, rien n’est écrit', !e.actif && !e.ecoute && e.port === null && !fs.existsSync(path.join(T, 'telephone.json')) && e.appareils.length === 0, e);
  let erreur = null;
  try { await tel.ouvrirJumelage(); } catch (x) { erreur = x.message; }
  essai('pas de code à scanner tant que la porte est éteinte', /Allume d’abord/.test(erreur ?? ''), erreur);
  e = await tel.allumer();
  const reglage = () => JSON.parse(fs.readFileSync(path.join(T, 'telephone.json'), 'utf8'));
  essai('« Allumer » : la porte écoute, et le réglage est gardé', e.actif && e.ecoute && e.port > 0 && reglage().actif === true, e);
  essai('… lisible par la personne seule, et le téléphone regarde seulement (écrire à l’IA est coupé)', (process.platform === 'win32' || (fs.statSync(path.join(T, 'telephone.json')).mode & 0o777) === 0o600) && e.ecrire === false && reglage().ecrire === false, [e.ecrire, reglage()]);
  essai('… son adresse est celle de l’ordinateur sur le réseau', e.adresse === '192.168.1.23' && e.court === `192.168.1.23:${e.port}` && e.jumelage === null, e);

  titre('La page du téléphone');
  let r = await demande(tel, '/');
  const csp = r.h['content-security-policy'] ?? '';
  essai('GET / : la page, jamais gardée en mémoire, jamais dans un cadre', r.code === 200 && /text\/html/.test(r.h['content-type']) && r.h['cache-control'] === 'no-store' && r.h['x-frame-options'] === 'DENY' && /frame-ancestors 'none'/.test(csp), [r.code, r.h]);
  essai('… rien d’ailleurs ne s’y charge, seuls les scripts de Dérush s’exécutent, et elle ne dit pas d’où l’on vient', /default-src 'self'/.test(csp) && /script-src 'self'(;|$)/.test(csp) && /object-src 'none'/.test(csp) && /form-action 'none'/.test(csp) && r.h['referrer-policy'] === 'no-referrer' && r.h['x-content-type-options'] === 'nosniff', csp);
  const page = r.t;
  essai('… sans script ni style écrit dans la page, sans adresse d’un autre site', !/<script(?![^>]*\bsrc=)/i.test(page) && !/\son[a-z]+\s*=/i.test(page) && !/https?:\/\//i.test(page.replace(/<!--[\s\S]*?-->/g, '')) && /<script type="module" src="\/mobile\.js">/.test(page));
  const fichiers = await Promise.all(['/mobile.js', '/mobile.css', '/anton.woff2', '/geist-mono.woff2', '/icone.png', '/icone.svg'].map((p) => demande(tel, p)));
  essai('ses fichiers : le programme, le style, les deux polices, l’icône', fichiers.every((x) => x.code === 200) && /javascript/.test(fichiers[0].h['content-type']) && /text\/css/.test(fichiers[1].h['content-type']) && fichiers[2].h['content-type'] === 'font/woff2' && fichiers[4].h['content-type'] === 'image/png', fichiers.map((x) => [x.code, x.h?.['content-type']]));
  const ailleurs = await Promise.all(['/app.js', '/index.html', '/style.css', '/commun.js', '/mobile/mobile.js', '/../lib/telephone.mjs', '/%2e%2e/derush.mjs', '/api/telephone', '/api/claude', '/video?nom=x.mp4', '/media/M1/lecture'].map((p) => demande(tel, p)));
  essai('rien d’autre de Dérush n’est servi par cette porte (ni l’app, ni ses routes)', ailleurs.every((x) => x.code === 401 || x.code === 404) && !ailleurs.some((x) => x.code === 200), ailleurs.map((x) => x.code));
  r = await demande(tel, '/api/ping');
  essai('/api/ping : « Dérush est là », rien de plus', r.code === 200 && JSON.stringify(r.j) === '{"derush":true,"telephone":true}', r.j);
  r = await demande(tel, '/', {hote: 'un-site.example'});
  const parNom = await demande(tel, '/', {hote: 'mon-ordinateur.local:4380'});
  const parChiffres = await demande(tel, '/', {hote: '192.168.1.23:4380'});
  essai('une demande faite au nom d’un site est refusée ; par l’adresse de l’ordinateur ou son nom « .local », elle passe', r.code === 403 && parNom.code === 200 && parChiffres.code === 200, [r.code, parNom.code, parChiffres.code]);
  r = await demande(tel, '/api/etat');
  const mauvais = await demande(tel, '/api/etat', {jeton: crypto.randomBytes(32).toString('base64url')});
  essai('sans téléphone relié : 401 (sans jeton, avec un faux jeton)', r.code === 401 && mauvais.code === 401 && /pas relié/.test(r.j?.erreur ?? ''), [r.code, mauvais.code, r.j]);

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Relier un téléphone');
  e = await tel.ouvrirJumelage();
  const code = new URL(e.jumelage.lien).hash.slice(3);
  essai('le code à scanner : l’adresse de l’ordinateur, le code après le « # », six chiffres, dix minutes', e.jumelage.lien === `http://192.168.1.23:${e.port}/#j=${code}` && /^[\w-]{22}$/.test(code) && /^\d{6}$/.test(e.jumelage.chiffres) && e.jumelage.expire_dans_s > 590 && e.jumelage.expire_dans_s <= 600, e.jumelage);
  essai('… avec son dessin (un code QR de la bonne taille)', e.jumelage.qr?.taille >= 29 && /^M[\d Mhvz-]+$/.test(e.jumelage.qr.d.slice(0, 40)), e.jumelage.qr?.taille);
  const m1 = moi();
  r = await demande(tel, '/api/jumeler', {methode: 'POST', corps: {code: 'x'.repeat(22), moi: m1}});
  essai('un mauvais code : inconnu, et l’ordinateur ne voit aucune demande', r.code === 200 && r.j.etat === 'inconnu' && tel.etat().demandes.length === 0, r.j);
  const sansType = await demande(tel, '/api/jumeler', {methode: 'POST', brut: JSON.stringify({code, moi: m1}), entetes: {'content-type': 'text/plain'}});
  const sansMoi = await demande(tel, '/api/jumeler', {methode: 'POST', corps: {code, moi: 'court'}});
  const tropGros = await demande(tel, '/api/jumeler', {methode: 'POST', corps: {code, moi: m1, plus: 'x'.repeat(40000)}});
  const illisible = await demande(tel, '/api/jumeler', {methode: 'POST', brut: '{pas du json', entetes: {'content-type': 'application/json'}});
  essai('une demande mal faite est refusée (pas du JSON, sans identifiant, trop lourde, illisible)', sansType.code === 415 && sansMoi.code === 400 && [413, 0].includes(tropGros.code) && illisible.code === 400 && tel.etat().demandes.length === 0, [sansType.code, sansMoi.code, tropGros.code, illisible.code]);
  r = await demande(tel, '/api/jumeler', {methode: 'POST', corps: {code, moi: m1}});
  e = tel.etat();
  essai('le bon code : le téléphone attend, avec son nom et un nombre à deux chiffres', r.j.etat === 'attente' && r.j.nom === 'iPhone · Safari' && /^\d\d$/.test(r.j.nombre) && !('jeton' in r.j), r.j);
  essai('… l’ordinateur voit la demande, avec le même nombre', e.demandes.length === 1 && e.demandes[0].nom === 'iPhone · Safari' && e.demandes[0].nombre === r.j.nombre, e.demandes);
  const nombre = r.j.nombre;
  r = await demande(tel, '/api/jumeler', {methode: 'POST', corps: {moi: m1}});
  essai('sa page rechargée pendant l’attente : reconnue par son identifiant seul, même nombre', r.j.etat === 'attente' && r.j.nombre === nombre && tel.etat().demandes.length === 1, r.j);
  const idDemande = e.demandes[0].id;
  e = tel.repondre(idDemande, true);
  essai('« Relier ce téléphone » : il est dans la liste, et le code ne vaut plus rien', e.appareils.length === 1 && e.appareils[0].nom === 'iPhone · Safari' && e.jumelage === null && e.demandes.length === 0, e);
  r = await demande(tel, '/api/jumeler', {methode: 'POST', corps: {moi: m1}});
  const jeton = r.j.jeton;
  essai('le téléphone reçoit son jeton (43 signes tirés au hasard)', r.j.etat === 'relie' && /^[\w-]{43}$/.test(jeton ?? ''), r.j);
  const garde = fs.readFileSync(path.join(T, 'telephone.json'), 'utf8');
  essai('Dérush n’en garde que l’empreinte : le jeton n’est ni dans son fichier, ni dans ce que voit la fenêtre', !garde.includes(jeton) && /"empreinte": ?"[a-f0-9]{64}"/.test(garde) && !JSON.stringify(tel.etat()).includes(jeton) && !JSON.stringify(tel.etat()).includes('empreinte'));
  r = await demande(tel, '/api/jumeler', {methode: 'POST', corps: {code, moi: moi()}});
  essai('le même code pris en photo par un autre appareil : il ne vaut plus', r.j.etat === 'perime', r.j);
  erreur = null;
  try { tel.repondre(idDemande, true); } catch (x) { erreur = x.message; }
  essai('accepter deux fois la même demande : refusé', /n’est plus là/.test(erreur ?? '') && tel.etat().appareils.length === 1, erreur);

  titre('Refuser, les six chiffres, les dix minutes');
  e = await tel.ouvrirJumelage();
  let m2 = moi();
  r = await demande(tel, '/api/jumeler', {methode: 'POST', corps: {chiffres: e.jumelage.chiffres.replace(/(\d{3})/, '$1 '), moi: m2}, entetes: {'user-agent': ANDROID}});
  essai('les six chiffres tapés à la main (avec une espace) : la demande arrive', r.j.etat === 'attente' && r.j.nom === 'Android (Pixel 10) · Chrome' && tel.etat().demandes.length === 1, r.j);
  tel.repondre(tel.etat().demandes[0].id, false);
  r = await demande(tel, '/api/jumeler', {methode: 'POST', corps: {moi: m2}});
  essai('« Refuser » : le téléphone l’apprend, et n’est pas dans la liste', r.j.etat === 'refuse' && tel.etat().appareils.length === 1 && tel.etat().demandes.length === 0, r.j);
  e = await tel.ouvrirJumelage();
  const faux = e.jumelage.chiffres === '000000' ? '111111' : '000000';
  const essais = [];
  for (let k = 0; k < 8; k++) essais.push((await demande(tel, '/api/jumeler', {methode: 'POST', corps: {chiffres: faux, moi: moi()}})).j.etat);
  r = await demande(tel, '/api/jumeler', {methode: 'POST', corps: {chiffres: e.jumelage.chiffres, moi: moi()}});
  essai('huit mauvais codes à six chiffres : le code est annulé, même le bon ne passe plus', essais.every((x) => x === 'inconnu') && r.j.etat === 'perime' && tel.etat().jumelage === null, [essais, r.j]);
  e = await tel.ouvrirJumelage();
  const codeLong = new URL(e.jumelage.lien).hash.slice(3);
  const attentes = [];
  for (let k = 0; k < 4; k++) attentes.push((await demande(tel, '/api/jumeler', {methode: 'POST', corps: {code: codeLong, moi: moi()}})).j.etat);
  essai('trois téléphones attendent au plus ; le quatrième est prié de patienter', attentes.join() === 'attente,attente,attente,occupe' && tel.etat().demandes.length === 3, attentes);
  decalage += 13e3;
  essai('un téléphone qui a refermé sa page ne reste pas à l’écran de l’ordinateur', tel.etat().demandes.length === 0);
  decalage += 10 * 60e3;
  r = await demande(tel, '/api/jumeler', {methode: 'POST', corps: {code: codeLong, moi: moi()}});
  essai('après dix minutes, le code ne vaut plus', r.j.etat === 'perime' && tel.etat().jumelage === null, r.j);
  e = await tel.ouvrirJumelage();
  tel.fermerJumelage();
  r = await demande(tel, '/api/jumeler', {methode: 'POST', corps: {code: new URL(e.jumelage.lien).hash.slice(3), moi: moi()}});
  essai('la fenêtre refermée sur l’ordinateur : son code ne vaut plus', r.j.etat === 'perime', r.j);

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Ce que le téléphone relié reçoit');
  r = await demande(tel, '/api/etat', {jeton});
  const billet = r.j?.billet;
  essai('/api/etat : la version, son nom, ses droits, ce que dit la source, un billet pour les fichiers', r.code === 200 && r.j.version === VERSION && r.j.appareil === 'iPhone · Safari' && r.j.peut.ecrire === false && r.j.projet.titre === 'Projet d’essai' && /^[a-f0-9]{12}\.\d+\.[\w-]{32}$/.test(billet ?? '') && /^[a-f0-9]{16}$/.test(r.j.v), r.j);
  essai('… jamais gardé en mémoire par le téléphone', r.h['cache-control'] === 'no-store');
  essai('un téléphone regarde : l’ordinateur est gardé éveillé une demi-heure (une seule demande, pas une par relecture)', eveils.length === 1 && eveils[0].secondes === 1800, eveils.map((x) => x.secondes));
  const pareil = await demande(tel, `/api/etat?v=${r.j.v}`, {jeton});
  essai('… rien n’a changé (le chrono avance tout seul) : « pareil », avec le chrono', pareil.j.pareil === true && pareil.j.v === r.j.v && typeof pareil.j.depuis_s === 'number' && !('projet' in pareil.j), pareil.j);
  essai('le jeton ne passe que par l’en-tête : dans l’adresse, il est refusé', (await demande(tel, `/api/etat?t=${jeton}`)).code === 401 && (await demande(tel, `/image/direct/r1/f-00001.jpg?t=${jeton}`)).code === 401);
  r = await demande(tel, `/image/direct/r1/f-00001.jpg?k=${billet}`);
  essai('une image du direct, avec le billet', r.code === 200 && r.h['content-type'] === 'image/jpeg' && r.octets.length === 22 && /private/.test(r.h['cache-control']), [r.code, r.h]);
  const sansBillet = await demande(tel, '/image/direct/r1/f-00001.jpg');
  const billetRetouche = await demande(tel, `/image/direct/r1/f-00001.jpg?k=${billet.slice(0, -1)}${billet.at(-1) === 'A' ? 'B' : 'A'}`);
  const billetAutre = await demande(tel, `/image/direct/r1/f-00001.jpg?k=${billet.replace(/^[a-f0-9]{12}/, 'abcdefabcdef')}`);
  essai('… sans billet, avec un billet retouché ou celui d’un autre : 401', sansBillet.code === 401 && billetRetouche.code === 401 && billetAutre.code === 401, [sansBillet.code, billetRetouche.code, billetAutre.code]);
  essai('le billet ne sert qu’aux fichiers : il n’ouvre ni l’état, ni l’écriture', (await demande(tel, `/api/etat?k=${billet}`)).code === 401 && (await demande(tel, `/api/ecrire?k=${billet}`, {methode: 'POST', corps: {message: 'x'}})).code === 401);
  const mauvaisNoms = await Promise.all(['/image/direct/r1/autre.jpg', '/image/direct/..%2F..%2Fx/f-00001.jpg', '/image/direct/r1/f-00001.jpg/..', '/image/vue/abc', '/image/vue/4', '/image/direct/r2/f-00001.jpg'].map((p) => demande(tel, `${p}?k=${billet}`)));
  essai('une image qui n’existe pas, ou un nom qui n’est pas celui d’une image du direct : 404', mauvaisNoms.every((x) => x.code === 404), mauvaisNoms.map((x) => x.code));
  r = await demande(tel, `/image/vue/3?k=${billet}`);
  essai('une image que l’IA regarde', r.code === 200 && r.h['content-type'] === 'image/jpeg');
  const nomVideo = encodeURIComponent('film-été.mp4');
  r = await demande(tel, `/video/${nomVideo}?k=${billet}`);
  essai('une vidéo, en entier', r.code === 200 && r.h['content-type'] === 'video/mp4' && r.octets.length === 5000 && r.h['accept-ranges'] === 'bytes' && !r.h['content-disposition'], [r.code, r.h]);
  r = await demande(tel, `/video/${nomVideo}?k=${billet}`, {entetes: {range: 'bytes=100-199'}});
  const fin = await demande(tel, `/video/${nomVideo}?k=${billet}`, {entetes: {range: 'bytes=-10'}});
  const suite = await demande(tel, `/video/${nomVideo}?k=${billet}`, {entetes: {range: 'bytes=4990-'}});
  const dehors = await demande(tel, `/video/${nomVideo}?k=${billet}`, {entetes: {range: 'bytes=9000-'}});
  essai('… par morceaux (ce qu’un iPhone demande) : le milieu, la fin, la suite ; hors du fichier : 416', r.code === 206 && r.h['content-range'] === 'bytes 100-199/5000' && r.octets.length === 100 && r.octets[0] === 100 && fin.code === 206 && fin.h['content-range'] === 'bytes 4990-4999/5000' && suite.octets.length === 10 && dehors.code === 416, [r.code, r.h?.['content-range'], fin.h?.['content-range'], dehors.code]);
  r = await demande(tel, `/video/${nomVideo}?k=${billet}&dl=1`);
  essai('… « Enregistrer sur mon téléphone » : envoyée comme un fichier à garder, sous son nom', /^attachment; filename="film-_t_\.mp4"; filename\*=UTF-8''film-%C3%A9t%C3%A9\.mp4$/.test(r.h['content-disposition'] ?? ''), r.h['content-disposition']);
  r = await demande(tel, `/video/${nomVideo}?k=${billet}`, {methode: 'HEAD'});
  essai('… HEAD : la taille, sans le fichier', r.code === 200 && r.h['content-length'] === '5000' && r.octets.length === 0);
  const inconnues = await Promise.all([`/video/autre.mp4?k=${billet}`, `/video/${encodeURIComponent('../film.mp4')}?k=${billet}`, `/video/%E0%A4%A?k=${billet}`, `/affiche/autre.mp4?k=${billet}`].map((p) => demande(tel, p)));
  essai('une vidéo inconnue, un nom qui sort du dossier, une adresse mal écrite : 404', inconnues.every((x) => x.code === 404), inconnues.map((x) => x.code));
  r = await demande(tel, `/affiche/${nomVideo}?k=${billet}`);
  essai('l’image d’une vidéo', r.code === 200 && r.h['content-type'] === 'image/jpeg');

  titre('Écrire à l’IA, l’arrêter : seulement si la personne l’a allumé');
  r = await demande(tel, '/api/ecrire', {methode: 'POST', jeton, corps: {message: 'Raccourcis la fin.'}});
  const arret = await demande(tel, '/api/arreter', {methode: 'POST', jeton, corps: {}});
  essai('coupé (le réglage de départ) : écrire et arrêter sont refusés, rien n’arrive à l’IA', r.code === 403 && arret.code === 403 && /regarder/.test(r.j.erreur) && recus.ecrits.length === 0 && recus.arrets === 0, [r.code, arret.code, recus]);
  e = tel.regler({ecrire: true});
  essai('« Écrire à l’IA depuis le téléphone » allumé : gardé dans le réglage, dit au téléphone', e.ecrire === true && reglage().ecrire === true && (await demande(tel, '/api/etat', {jeton})).j.peut.ecrire === true);
  r = await demande(tel, '/api/ecrire', {methode: 'POST', jeton, corps: {message: '  Raccourcis la fin.  '}});
  essai('… le message arrive à l’IA, sans ses espaces autour', r.code === 200 && r.j.ok === true && recus.ecrits.join() === 'Raccourcis la fin.', [r.j, recus.ecrits]);
  const vide = await demande(tel, '/api/ecrire', {methode: 'POST', jeton, corps: {message: '   '}});
  const pasTexte = await demande(tel, '/api/ecrire', {methode: 'POST', jeton, corps: {message: {a: 1}}});
  const deja = await demande(tel, '/api/ecrire', {methode: 'POST', jeton, corps: {message: 'déjà'}});
  essai('… un message vide est refusé ; ce que Dérush refuse est dit tel quel au téléphone', vide.code === 400 && pasTexte.code === 400 && deja.code === 409 && deja.j.erreur === 'L’IA travaille déjà sur ce projet.' && recus.ecrits.length === 1, [vide.code, pasTexte.code, deja]);
  const sansJeton = await demande(tel, '/api/ecrire', {methode: 'POST', corps: {message: 'x'}});
  const parFormulaire = await demande(tel, '/api/ecrire', {methode: 'POST', jeton, brut: 'message=x', entetes: {'content-type': 'application/x-www-form-urlencoded'}});
  essai('… jamais sans jeton, jamais par le formulaire d’une autre page', sansJeton.code === 401 && parFormulaire.code === 415 && recus.ecrits.length === 1, [sansJeton.code, parFormulaire.code]);
  r = await demande(tel, '/api/arreter', {methode: 'POST', jeton, corps: {}});
  essai('« Arrêter » : transmis à Dérush', r.code === 200 && r.j.ok === true && recus.arrets === 1, r.j);
  tel.regler({ecrire: false});
  essai('… recoupé : de nouveau refusé', (await demande(tel, '/api/ecrire', {methode: 'POST', jeton, corps: {message: 'x'}})).code === 403 && recus.ecrits.length === 1);

  titre('Le téléphone vu de l’ordinateur, retirer un téléphone');
  e = tel.etat();
  essai('la fenêtre sait qu’il regarde en ce moment ; la barre du haut aussi', e.appareils[0].en_ligne === true && e.en_ligne === 1 && JSON.stringify(tel.resume()) === '{"actif":true,"en_ligne":1}', [e.appareils, tel.resume()]);
  decalage += 20e3;
  essai('… et qu’il ne regarde plus, quinze secondes après sa dernière demande', tel.etat().appareils[0].en_ligne === false && tel.resume().en_ligne === 0);
  const jeton2 = await relier(tel, ANDROID);
  const jeton3 = await relier(tel);
  e = tel.etat();
  essai('un deuxième téléphone du même nom porte un numéro', e.appareils.map((a) => a.nom).join(' | ') === 'iPhone · Safari | Android (Pixel 10) · Chrome | iPhone · Safari (2)', e.appareils.map((a) => a.nom));
  const billet2 = (await demande(tel, '/api/etat', {jeton: jeton2})).j.billet;
  tel.retirer(e.appareils[1].id);
  essai('« Retirer » : son jeton et son billet ne valent plus ; les autres téléphones restent', (await demande(tel, '/api/etat', {jeton: jeton2})).code === 401 && (await demande(tel, `/image/vue/3?k=${billet2}`)).code === 401 && (await demande(tel, '/api/etat', {jeton})).code === 200 && (await demande(tel, '/api/etat', {jeton: jeton3})).code === 200 && tel.etat().appareils.length === 2);
  r = await demande(tel, '/api/oublier', {methode: 'POST', jeton: jeton3, corps: {}});
  essai('« Ne plus suivre sur ce téléphone » : il se retire lui-même', r.code === 200 && (await demande(tel, '/api/etat', {jeton: jeton3})).code === 401 && tel.etat().appareils.length === 1);
  decalage += 13 * 3600e3;
  essai('un billet ne vaut que quelques heures (treize heures plus tard : 401) ; le jeton, lui, tient', (await demande(tel, `/image/vue/3?k=${billet}`)).code === 401 && (await demande(tel, '/api/etat', {jeton})).code === 200);
  const neuf = (await demande(tel, '/api/etat', {jeton})).j.billet;
  essai('… le téléphone en reçoit un autre avec l’état', neuf !== billet && (await demande(tel, `/image/vue/3?k=${neuf}`)).code === 200);

  titre('Couper, rallumer, relancer Dérush');
  const port = tel.port;
  const avantCoupure = eveils.length;
  essai('tant qu’il regarde, le garde-éveil est renouvelé (toutes les cinq minutes au plus), jamais par quelqu’un qui n’est pas relié', avantCoupure >= 2 && avantCoupure <= 8 && eveils.every((x) => x.secondes === 1800), avantCoupure);
  e = await tel.eteindre();
  essai('« Couper » rend aussi la main à la mise en veille de l’ordinateur', eveils.slice(0, avantCoupure).every((x) => x.arrete));
  r = await demande({port}, '/api/ping');
  essai('« Couper » : plus rien n’écoute, le réglage le retient, le téléphone reste dans la liste', !e.actif && !e.ecoute && r.code === 0 && reglage().actif === false && e.appareils.length === 1, [e, r]);
  e = await tel.allumer();
  essai('rallumée : le téléphone déjà relié retrouve Dérush sans se relier', e.ecoute && (await demande(tel, '/api/etat', {jeton})).code === 200);
  // « relancer Dérush » : une autre porte lit le même réglage
  await tel.fermer();
  const relancee = nouvelle('telephone');
  portes.push(relancee);
  e = await relancee.demarrer();
  essai('Dérush relancé : la porte se rouvre toute seule (elle était allumée), avec ses téléphones', e.actif && e.ecoute && e.appareils.length === 1 && (await demande(relancee, '/api/etat', {jeton})).code === 200, e);
  essai('… un billet d’avant le relancement ne vaut plus (sa clé est tirée à chaque lancement)', (await demande(relancee, `/image/vue/3?k=${neuf}`)).code === 401);
  fs.writeFileSync(path.join(T, 'abime.json'), '{"actif": true, "port": 80, "ecrire": "oui", "appareils": [{"id": "x", "empreinte": "pas une empreinte"}, null, {"id": "abcdef012345", "nom": 7, "empreinte": "' + 'a'.repeat(64) + '"}]}');
  const abimee = nouvelle('abime');
  portes.push(abimee);
  e = await abimee.demarrer();
  essai('un réglage abîmé ou réécrit à la main : rien d’inattendu (port refusé, écriture coupée, téléphones sans empreinte écartés)', e.ecoute && e.ecrire === false && e.appareils.length === 1 && e.appareils[0].nom === '7' && e.port !== 80, e);

  const il_y_a = (jours) => new Date(Date.now() + decalage - jours * 24 * 3600e3).toISOString();
  fs.writeFileSync(path.join(T, 'anciens.json'), JSON.stringify({actif: false, appareils: [
    {id: 'aaaaaaaaaaaa', nom: 'Ancien', empreinte: 'a'.repeat(64), relie_le: il_y_a(200), vu_le: il_y_a(90)},
    {id: 'bbbbbbbbbbbb', nom: 'Jamais revenu', empreinte: 'b'.repeat(64), relie_le: il_y_a(61), vu_le: null},
    {id: 'cccccccccccc', nom: 'Récent', empreinte: 'c'.repeat(64), relie_le: il_y_a(300), vu_le: il_y_a(3)},
    {id: 'dddddddddddd', nom: 'Tout neuf', empreinte: 'd'.repeat(64), relie_le: il_y_a(1), vu_le: null}]}));
  const anciens = nouvelle('anciens');
  portes.push(anciens);
  e = await anciens.demarrer();
  essai('un téléphone pas revu depuis deux mois est retiré de la liste au lancement ; les autres restent, et rien ne s’ouvre', e.appareils.map((a) => a.nom).join() === 'Récent,Tout neuf' && !e.ecoute && JSON.parse(fs.readFileSync(path.join(T, 'anciens.json'), 'utf8')).appareils.length === 2, e.appareils);

  titre('Trop d’essais');
  const assaut = nouvelle('assaut');
  portes.push(assaut);
  await assaut.allumer();
  const bon = await relier(assaut);
  const codes = [];
  for (let k = 0; k < 45; k++) codes.push((await demande(assaut, '/api/etat', {jeton: crypto.randomBytes(32).toString('base64url')})).code);
  r = await demande(assaut, '/api/etat', {jeton: bon});
  essai('quarante faux jetons d’une même adresse : elle est mise en attente (429), dix minutes', codes.slice(0, 40).every((c) => c === 401) && codes.at(-1) === 429 && r.code === 429 && /Trop d’essais/.test(r.j.erreur), [codes.filter((c) => c === 401).length, codes.at(-1), r.code]);
  decalage += 11 * 60e3;
  essai('… puis elle peut de nouveau demander', (await demande(assaut, '/api/etat', {jeton: bon})).code === 200);
  // deux Dérush sur le même ordinateur : le second prend le port suivant
  const premier = T_.creerTelephone({source: fausseSource(), fichier: path.join(T, 'premier.json'), port: 0, hote: '127.0.0.1', cartes: () => CARTES, eveil: fauxEveil});
  portes.push(premier);
  await premier.allumer();
  const second = T_.creerTelephone({source: fausseSource(), fichier: path.join(T, 'second.json'), port: premier.port, hote: '127.0.0.1', cartes: () => CARTES, eveil: fauxEveil});
  portes.push(second);
  e = await second.allumer();
  essai('le port déjà pris par un autre Dérush : le suivant est pris, et gardé pour la prochaine fois', e.ecoute && e.port !== premier.port && JSON.parse(fs.readFileSync(path.join(T, 'second.json'), 'utf8')).port === e.port, [premier.port, e.port]);

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Ce que le téléphone voit du travail de l’IA');
  const NOMS = {ia: {claude: {nom: 'Claude'}, codex: {nom: 'Codex'}}, qualites: {max: {nom: 'Maximum'}}};
  essai('personne ne travaille : rien', T_.travailPourTelephone({echanges: []}) === null && T_.travailPourTelephone(null) === null);
  const base = {moteur: 'claude', qualite: 'max', depuis_s: 90, progression: 0.5, activite: [], n_activite: 0, messages: [], ecoute: true, habituel_s: 2100, direct: {vues: [], rendus: []}};
  let t = T_.travailPourTelephone({en_cours: {...base, etape: 'preparation'}}, {noms: NOMS});
  essai('la préparation : « Dérush prépare tes rushes », la jauge à 50 %', t.etape === 'preparation' && t.titre === 'Dérush prépare tes rushes' && t.pct === 50 && t.nom_ia === 'Claude' && t.niveau === 'Maximum' && t.image === null && t.habituel_s === 2100, t);
  essai('… « tes plans » quand la timeline en a déjà', T_.travailPourTelephone({en_cours: {...base, etape: 'preparation'}}, {noms: NOMS, aDesPlans: true}).titre === 'Dérush prépare tes plans');
  t = T_.travailPourTelephone({en_cours: {...base, etape: 'claude', activite: [{t: 10, icone: 'crayon', texte: 'Écrit le montage'}, {t: 30, icone: 'oeil', texte: 'Regarde la planche'}], n_activite: 2, direct: {vues: [{n: 3, nom: 'planche.jpg', t: 60}], rendus: []}}}, {noms: NOMS});
  essai('le montage : la phrase du dernier geste, l’image que l’IA regarde, pas de jauge mesurée', t.etape === 'ia' && t.titre === 'Claude regarde et vérifie' && t.pct === null && t.image.src === '/image/vue/3' && !t.image.direct && /planche\.jpg/.test(t.image.legende) && t.gestes.length === 2 && t.gestes[0].icone === 'crayon', t);
  const rendu = {id: 'r-12', titre: 'Mon film', etape: 'rendu', total: 200, rendues: 50, largeur: 1080, hauteur: 1920, images: [1, 2, 7]};
  t = T_.travailPourTelephone({en_cours: {...base, etape: 'claude', direct: {vues: [{n: 3, nom: 'planche.jpg', t: 60}], rendus: [rendu]}}}, {noms: NOMS});
  essai('le rendu : en direct, la dernière image rendue, 25 %', t.etape === 'rendu' && t.titre === 'Claude fabrique la vidéo' && t.pct === 25 && t.rendu.pct === 25 && t.image.src === '/image/direct/r-12/f-00007.jpg' && t.image.direct === true && t.image.largeur === 1080, t);
  t = T_.travailPourTelephone({en_cours: {...base, etape: 'livraison', reponse: 'C’est prêt.', direct: {vues: [], rendus: [{...rendu, etape: 'fini', rendues: 200, fin: new Date().toISOString()}]}}}, {noms: NOMS});
  essai('le contrôle : sa réponse est déjà lisible, l’image n’est plus « en direct »', t.etape === 'livraison' && /Dérush vérifie la vidéo/.test(t.titre) && t.reponse === 'C’est prêt.' && t.image.direct === false && /Dernier rendu/.test(t.image.legende), t);
  essai('l’arrêt demandé, une IA inconnue', T_.travailPourTelephone({en_cours: {...base, etape: 'claude', arret: true, moteur: 'autre'}}, {noms: NOMS}).titre === 'Arrêt en cours…' && T_.travailPourTelephone({en_cours: {...base, etape: 'claude', moteur: 'autre'}}, {noms: NOMS}).nom_ia === 'L’IA');
  const phrases = [[null, 'Claude ouvre ton dossier'], [{icone: 'globe', texte: 'x'}, 'Claude publie ta vidéo'], [{icone: 'film', texte: 'Rend la vidéo'}, 'Claude fabrique la vidéo'], [{icone: 'bulle', texte: 'Je garde ce plan'}, 'Claude réfléchit'], [{icone: 'outil', texte: 'Lit la compétence montage'}, 'Claude relit ses fiches de montage'], [{icone: 'outil', texte: 'Coupe'}, 'Claude monte ta vidéo']];
  essai('phraseGeste : les mêmes phrases que dans la fenêtre de l’ordinateur', phrases.every(([a, p]) => T_.phraseGeste(a, 'Claude') === p), phrases.map(([a]) => T_.phraseGeste(a, 'Claude')));
  const fil = T_.filPourTelephone({echanges: [{role: 'humain', texte: 'Fais un vlog.', quand: 'a', pieces: [{id: 'J1', chemin: '/Users/moi/secret.png'}]}, {role: 'claude', moteur: 'codex', texte: 'x'.repeat(7000), quand: 'b', duree_s: 60, version: 2}, {role: 'claude', texte: 'Forfait épuisé.', quand: 'c', erreur: true}, {role: 'humain', texte: 'Plus court.', quand: 'd', pendant: true}],
    en_cours: {ecoute: true, messages: [{quand: 'd', lu: false, apres: false}]}}, {noms: NOMS});
  essai('la conversation : qui parle, la version, la durée, une erreur ; un long texte est coupé', fil.length === 4 && fil[0].de === 'moi' && fil[1].de === 'ia' && fil[1].nom_ia === 'Codex' && fil[1].version === 2 && fil[1].texte.length === 6000 && fil[2].erreur === true && fil[2].nom_ia === 'Claude', fil.map((x) => ({...x, texte: x.texte.slice(0, 20)})));
  essai('… les pièces jointes sont comptées, jamais leur chemin ; un message écrit pendant le travail dit s’il est lu', fil[0].pieces === 1 && !JSON.stringify(fil).includes('/Users/') && fil[3].pendant === 'bientot', [fil[0], fil[3]]);
  essai('… les quatorze derniers échanges seulement', T_.filPourTelephone({echanges: Array.from({length: 40}, (_, k) => ({role: 'humain', texte: `m${k}`, quand: String(k)}))}).length === 14);

  // ————————————————————————————————————————————————————————————————————————————————
  titre('La vraie source de Dérush, sur un projet jetable (en lecture seulement)');
  const dossier = path.join(BIBLIO, 'Projet du téléphone');
  fs.mkdirSync(path.join(dossier, 'vidéos'), {recursive: true});
  const P = new Projet(dossier);
  P.d.titre = 'Projet du téléphone';
  P.sauver();
  const ffmpegLa = spawnSync(FFMPEG, ['-version']).status === 0;
  const film = path.join(dossier, 'vidéos', 'projet-claude-v1.mp4');
  if (ffmpegLa) spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=180x320:rate=10:duration=1', '-pix_fmt', 'yuv420p', film]);
  if (!fs.existsSync(film)) fs.writeFileSync(film, 'pas une vraie vidéo');
  fs.writeFileSync(path.join(dossier, 'vidéos', 'hors-conversation.mp4'), 'une vidéo créée par la timeline');
  let lienPose = false;
  try { fs.symlinkSync(path.join(dossier, 'derush.json'), path.join(dossier, 'vidéos', 'lien.mp4')); lienPose = true; } catch { /* Windows sans droit de créer un lien */ }
  fs.mkdirSync(path.join(dossier, 'claude'), {recursive: true});
  fs.writeFileSync(path.join(dossier, 'claude', 'etat.json'), JSON.stringify({atelier: null, moteur: 'claude', sessions: {}, echanges: [{role: 'humain', texte: 'Fais un vlog de 20 s.', quand: '2026-11-20T10:00:00.000Z'}, {role: 'claude', moteur: 'claude', texte: 'C’est prêt.', quand: '2026-11-20T10:20:00.000Z', duree_s: 1200, version: 1}],
    versions: [{n: 1, cree_le: '2026-11-20T10:20:00.000Z', moteur: 'claude', nom: 'projet-claude-v1.mp4', description: 'Un vlog de 20 s.', duree: 1, largeur: 180, hauteur: 320, videos: [{nom: 'projet-claude-v1.mp4', titre: null, description: 'Un vlog de 20 s.', duree: 1, largeur: 180, hauteur: 320}]}]}));
  const ctx = {P, file: new FileDAttente(), projetVivant: (d) => (path.resolve(d) === P.racine ? P : null)};
  const S = T_.sourceDerush(ctx);
  const etat = await S.etat();
  essai('le projet ouvert : son titre, sa conversation, personne au travail', etat.projet.titre === 'Projet du téléphone' && etat.projet.ouvert === true && etat.travail === null && etat.fil.length === 2 && etat.fil[1].de === 'ia' && etat.fil[1].version === 1 && etat.ia.nom === 'Claude', etat);
  const v1 = etat.videos.find((x) => x.nom === 'projet-claude-v1.mp4');
  essai('ses vidéos : celle de l’IA (version, description, adresse) et celle créée par la timeline', !!v1 && v1.version === 1 && v1.description === 'Un vlog de 20 s.' && v1.src === '/video/projet-claude-v1.mp4' && v1.affiche === '/affiche/projet-claude-v1.mp4' && etat.videos.some((x) => x.nom === 'hors-conversation.mp4' && x.origine === 'rendu'), etat.videos);
  const texte = JSON.stringify(etat);
  essai('rien de l’ordinateur ne part : ni le dossier du projet, ni le dossier personnel, ni un chemin', !texte.includes(T) && !texte.includes(MAISON) && !/"chemin"|"atelier|"racine"/.test(texte), texte.slice(0, 300));
  essai('le fichier d’une vidéo : seulement un .mp4 du dossier « vidéos », par son simple nom', (await S.video('projet-claude-v1.mp4'))?.chemin === film && (await S.video('../derush.json')) === null && (await S.video('derush.json')) === null && (await S.video('absente.mp4')) === null && (await S.video(path.join(dossier, 'vidéos', 'projet-claude-v1.mp4'))) === null && (await S.video(null)) === null);
  if (lienPose) essai('… jamais un lien vers un autre fichier du disque (un projet reçu peut en contenir)', (await S.video('lien.mp4')) === null && (await S.affiche('lien.mp4')) === null);
  else console.log('  – (lien vers un autre fichier : pas essayé, ce système ne laisse pas en créer)');
  essai('l’affiche du projet : absente tant qu’elle n’est pas faite, puis servie', etat.projet.affiche === null && (await S.image('projet')) === null && (fs.writeFileSync(path.join(P.cache, 'affiche.jpg'), fs.readFileSync(IMAGE)), (await S.etat()).projet.affiche === '/image/projet') && (await S.image('projet')) === path.join(P.cache, 'affiche.jpg'));
  essai('une image du direct sans travail en cours : rien', (await S.image('direct', 'r1', 'f-00001.jpg')) === null && (await S.image('vue', '0')) === null);
  if (ffmpegLa && fs.statSync(film).size > 500) {
    const a = await S.affiche('projet-claude-v1.mp4');
    const deux = await Promise.all([S.affiche('projet-claude-v1.mp4'), S.affiche('projet-claude-v1.mp4')]);
    essai('l’image d’une vidéo : fabriquée une fois dans le projet (.derush/telephone), puis resservie', !!a && a.startsWith(path.join(P.cache, 'telephone')) && fs.statSync(a).size > 200 && deux[0] === a && deux[1] === a && fs.readdirSync(path.join(P.cache, 'telephone')).length === 1, a);
    fs.writeFileSync(path.join(dossier, 'vidéos', 'projet-claude-v1-couverture.jpg'), fs.readFileSync(IMAGE));
    essai('… la couverture choisie dans « Partager » passe devant', (await S.affiche('projet-claude-v1.mp4')) === path.join(dossier, 'vidéos', 'projet-claude-v1-couverture.jpg'));
  } else console.log('  – (image d’une vidéo : pas essayée, FFmpeg est absent)');
  essai('une vidéo qui n’est pas une vidéo : pas d’image, et Dérush ne tombe pas', (await S.affiche('hors-conversation.mp4')) === null);
  essai('« Arrêter » sans travail en cours : rien à arrêter', (await S.arreter()) === false);
  ctx.P = null;
  const sans = await S.etat();
  essai('aucun projet ouvert : le téléphone le dit, et aucune vidéo n’est servie', sans.projet === null && sans.videos.length === 0 && (await S.video('projet-claude-v1.mp4')) === null && typeof sans.ordinateur === 'string', sans);
  let refusee = null;
  try { await S.ecrire('Bonjour'); } catch (x) { refusee = x.message; }
  essai('… et écrire est refusé avant toute IA', /Aucun projet/.test(refusee ?? ''), refusee);

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Le serveur de Dérush : ses routes pour la fenêtre « Suivre sur mon téléphone »');
  const {demarrerServeur} = await lib('serveur.mjs');
  const ctxServeur = {P: null, file: new FileDAttente(), app: false, natif: false, ouvrir() { return null; }, fermer() { ctxServeur.P = null; }};
  ({serveur} = await demarrerServeur(ctxServeur, {port: 0}));
  const adresse = `http://127.0.0.1:${serveur.address().port}`;
  const jetonFenetre = /name="derush-jeton" content="([^"]+)"/.exec(await (await fetch(`${adresse}/`)).text())?.[1];
  const api = async (methode, p, corps) => {
    const x = await fetch(`${adresse}${p}`, {method: methode, headers: {'x-derush-jeton': jetonFenetre, 'x-derush-fenetre': 'essai', ...(corps !== undefined ? {'content-type': 'application/json'} : {})}, body: corps !== undefined ? JSON.stringify(corps) : undefined});
    return {code: x.status, j: await x.json().catch(() => null)};
  };
  r = await api('GET', '/api/telephone');
  essai('GET /api/telephone : éteint au départ, écriture coupée', r.code === 200 && r.j.actif === false && r.j.ecoute === false && r.j.ecrire === false && r.j.appareils.length === 0, r.j);
  essai('… jamais sans le jeton de la fenêtre', (await fetch(`${adresse}/api/telephone`)).status === 403);
  r = await api('GET', '/api/file');
  essai('GET /api/file dit si le suivi est allumé et si l’IA travaille (une demande partie du téléphone s’affiche dans la fenêtre)', r.j.ia === false && JSON.stringify(r.j.telephone) === '{"actif":false,"en_ligne":0}', r.j);
  r = await api('POST', '/api/telephone/jumelage', {});
  essai('pas de code tant que ce n’est pas allumé (409, avec la phrase)', r.code === 409 && /Allume d’abord/.test(r.j?.erreur ?? ''), r);
  r = await api('POST', '/api/telephone/allumer', {});
  const portTel = r.j?.port;
  essai('POST /api/telephone/allumer : la porte écoute (ici sur cet ordinateur seul, un port libre)', r.code === 200 && r.j.ecoute === true && portTel > 0 && fs.existsSync(path.join(SUPPORT, 'telephone.json')), r.j);
  r = await api('POST', '/api/telephone/jumelage', {});
  const lien = r.j?.jumelage?.lien ?? '';
  essai('… /jumelage : un code à scanner (s’il y a un réseau), jamais un jeton', r.code === 200 && (r.j.adresse === null ? r.j.jumelage === null : /#j=[\w-]{22}$/.test(lien)) && !/jeton|empreinte/.test(JSON.stringify(r.j)), r.j);
  const reponsePorte = await demande({port: portTel}, '/api/etat');
  essai('… la porte ouverte par le serveur répond, et demande un téléphone relié', reponsePorte.code === 401, reponsePorte.code);
  if (lien) {
    const mm = moi();
    await demande({port: portTel}, '/api/jumeler', {methode: 'POST', corps: {code: new URL(lien).hash.slice(3), moi: mm}});
    r = await api('GET', '/api/telephone');
    const refus = await api('POST', '/api/telephone/repondre', {demande: 'inconnue', accepter: true});
    const oui = await api('POST', '/api/telephone/repondre', {demande: r.j.demandes[0]?.id, accepter: true});
    const jt = (await demande({port: portTel}, '/api/jumeler', {methode: 'POST', corps: {moi: mm}})).j?.jeton;
    const vu = await demande({port: portTel}, '/api/etat', {jeton: jt});
    essai('… /repondre : une demande inconnue est refusée (409) ; la vraie relie le téléphone, qui reçoit l’état de Dérush', refus.code === 409 && oui.code === 200 && oui.j.appareils.length === 1 && vu.code === 200 && vu.j.projet === null && vu.j.version === VERSION && vu.j.peut.ecrire === false, [refus.code, oui.j?.appareils, vu.j]);
    const ecrit = await demande({port: portTel}, '/api/ecrire', {methode: 'POST', jeton: jt, corps: {message: 'Bonjour'}});
    essai('… écrire depuis ce téléphone : refusé (coupé), sans rien lancer', ecrit.code === 403, ecrit);
    r = await api('POST', '/api/telephone/regler', {ecrire: true});
    const ecrit2 = await demande({port: portTel}, '/api/ecrire', {methode: 'POST', jeton: jt, corps: {message: 'Bonjour'}});
    essai('… /regler allume l’écriture ; sans projet ouvert, Dérush le dit au téléphone (409) et aucune IA ne part', r.j.ecrire === true && ecrit2.code === 409 && /Aucun projet/.test(ecrit2.j.erreur), [r.j.ecrire, ecrit2]);
    r = await api('POST', '/api/telephone/retirer', {id: oui.j.appareils[0].id});
    essai('… /retirer : le téléphone ne passe plus', r.j.appareils.length === 0 && (await demande({port: portTel}, '/api/etat', {jeton: jt})).code === 401);
  } else console.log('  – (jumelage par le serveur : pas essayé, cet ordinateur n’a aucun réseau privé)');
  r = await api('POST', '/api/telephone/eteindre', {});
  essai('POST /api/telephone/eteindre : plus rien n’écoute', r.j.ecoute === false && r.j.actif === false && (await demande({port: portTel}, '/api/ping')).code === 0, r.j);
  essai('une action inconnue : 404', (await api('POST', '/api/telephone/autre', {})).code === 404);

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Les pages');
  const lire = (...p) => fs.readFileSync(path.join(D, ...p), 'utf8');
  const mobileJs = lire('public', 'mobile', 'mobile.js');
  const mobileCss = lire('public', 'mobile', 'mobile.css');
  const telJs = lire('public', 'telephone.js');
  const telCss = lire('public', 'telephone.css');
  const index = lire('public', 'index.html');
  const app = lire('public', 'app.js');
  essai('la page du téléphone ne met jamais son jeton dans une adresse, et n’exécute jamais un texte reçu', !/[?&]t=\$\{/.test(mobileJs) && !/location\.(hash|href|search)\s*=/.test(mobileJs) && !/\beval\(|new Function\(|document\.write\(/.test(mobileJs) && /'X-Derush-Telephone': jeton/.test(mobileJs));
  essai('… le code scanné quitte la barre d’adresse tout de suite', /history\.replaceState\(null, '', location\.pathname\)/.test(mobileJs));
  essai('… elle ne demande rien à un autre site (ni police, ni image, ni script)', !/https?:\/\//.test(mobileJs.replace(/\/\/[^\n]*/g, '')) && !/url\(\s*['"]?https?:/.test(mobileCss) && !/@import/.test(mobileCss));
  essai('… elle marche sur un téléphone d’il y a quelques années (pas de .at(), pas de attente au premier niveau)', !/\.at\(/.test(mobileJs) && !/^await /m.test(mobileJs) && !/structuredClone|replaceAll\(/.test(mobileJs));
  const classes = (css) => [...new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{[^{}]*\}/g, '{}').matchAll(/\.([a-zA-Z][\w-]*)/g)].map((x) => x[1]))];
  const horsMobile = classes(mobileCss).filter((c) => !c.startsWith('m-') && !['ic', 'plein', 'hors', 'direct', 'travail', 'texte', 'calme', 'affiche', 'joue', 'libre', 'fine', 'faite', 'ici', 'parole', 'dernier', 'neuf', 'haute', 'moi', 'ia', 'erreur', 'arret', 'coupe', 'vue', 'sombre', 'large', 'rouge', 'actives', 'petite'].includes(c));
  essai('le style du téléphone : ses classes commencent par « m- » (sauf leurs variantes)', horsMobile.length === 0, horsMobile);
  const horsTel = classes(telCss).filter((c) => !c.startsWith('tel-') && !['feuille', 'tel', 'sous-titre', 'btn', 'ic', 'actif', 'en-ligne', 'sans', 'court', 'allume'].includes(c));
  essai('le style de la fenêtre : ses classes commencent par « tel- » (style.css a des classes courtes)', horsTel.length === 0, horsTel);
  essai('la fenêtre de l’ordinateur est branchée : le bouton de la barre, son dessin, le module, le lien dans la bulle de travail', /id="b-telephone"/.test(index) && /<symbol id="i-tel-direct"/.test(index) && /href="\/telephone\.css"/.test(index) && /import \{creerTelephone\} from '\/telephone\.js'/.test(app) && /data-cl="telephone"/.test(app) && /TEL\.majBouton\(r\.telephone\)/.test(app));
  essai('… et elle ne montre jamais un jeton : seulement le code, tant qu’il vaut', !/jeton/i.test(telJs.replace(/\/\/[^\n]*/g, '')) && /\/api\/telephone\/fermer/.test(telJs));
  const sourceTel = lire('lib', 'telephone.mjs');
  essai('lib/telephone.mjs ne demande jamais quel système tourne (lib/plateforme.mjs le sait)', !/process\.platform/.test(sourceTel));

  titre('Au bout du compte');
  essai('aucune erreur n’est restée sans personne pour l’attraper', tombes.length === 0, tombes.map((x) => String(x?.stack ?? x).slice(0, 300)));
} catch (e) {
  essai('les essais sont allés au bout', false, e.stack);
} finally {
  for (const p of portes) { try { await p.fermer(); } catch { /* déjà fermée */ } }
  serveur?.close();
  if (bons === total) fs.rmSync(T, {recursive: true, force: true});
  else console.log(`\nLe dossier d’essai est gardé pour comprendre : ${T}`);
}
console.log(`\n${bons} essais réussis sur ${total}`);
process.exit(bons === total ? 0 : 1); // obligatoire : les états des moteurs en cours de calcul retiennent le processus
