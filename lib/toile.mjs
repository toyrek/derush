// Dérush — « la toile » : une page web qui se dessine elle-même à un instant donné, rendue image par image en vidéo.
// C'est la façon de faire un tableau en mouvement, un dessin qui se trace, de l'encre, des particules : tout en code.
//   - Le contrat : la page définit `window.renderAt(t)` (t en secondes), qui dessine exactement l'image de cet instant,
//     sans horloge, sans hasard sans graine, sans état gardé d'une image à l'autre ; `window.__ready = true` quand ses
//     polices et ses images sont chargées. `window.toile = {duree, fps, largeur, hauteur, boucle, suite}` dit le reste.
//     Les pages de huashu-art-motion (`renderFrame(t)` et `prepare(t)`) sont reconnues aussi.
//   - Sans ce contrat (« --horloge ») : le temps du navigateur est avancé à la main, image par image (minuteries,
//     requestAnimationFrame, animations CSS, GSAP) ; les images sortent dans l'ordre, jamais au hasard.
//   - Le navigateur sans fenêtre est celui du moteur de rendu (aucun autre téléchargement) ; il est piloté par un tube,
//     jamais par un port ouvert. La page est servie depuis cet ordinateur (127.0.0.1) et ne peut rien charger
//     d'Internet : ses bibliothèques viennent du moteur de rendu (« /lib/ ») et de la compétence
//     tableaux-en-mouvement (« /tableaux/ »).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {FFMPEG, POLICE_GRAS, ffmpeg} from './outils.mjs';
import {RACINE_APP} from './moteurs.mjs';
import {MAC, WINDOWS, navigateurApp} from './plateforme.mjs';
import {navigateurRemotion} from './hyperframes.mjs';
import {dossierMoteurRendu, envNode} from './rendu.mjs';
import {cheminFiltre} from './couleurs.mjs';

/** Les bibliothèques qu'une toile peut importer depuis « /lib/<nom>/… » : celles du moteur de rendu, rien d'autre. */
export const BIBLIOTHEQUES = ['three', 'three.quarks', 'quarks.core', 'roughjs', 'simplex-noise', 'gsap', 'animejs', 'regl', 'zdog', 'konva', 'planck', 'lottie-web', 'hachure-fill', 'points-on-path', 'points-on-curve', 'path-data-parser'];
/** La carte d'import à poser dans la page : « import * as THREE from 'three' » marche alors sans chemin. */
export const CARTE_IMPORT = {
  imports: {
    three: '/lib/three/build/three.module.js', 'three/addons/': '/lib/three/examples/jsm/',
    'three.quarks': '/lib/three.quarks/dist/three.quarks.esm.js', 'quarks.core': '/lib/quarks.core/dist/quarks.core.esm.js',
    roughjs: '/lib/roughjs/bundled/rough.esm.js', 'simplex-noise': '/lib/simplex-noise/dist/esm/simplex-noise.js',
    gsap: '/lib/gsap/index.js', 'gsap/': '/lib/gsap/',
  },
};
export const dossierBibliotheques = () => process.env.DERUSH_TOILE_LIBS || path.join(dossierMoteurRendu(), 'node_modules');
export const DOSSIER_TABLEAUX = path.join(RACINE_APP, 'competences', 'tableaux-en-mouvement', 'moteur');
export const DOSSIER_GABARITS = path.join(RACINE_APP, 'modeles', 'toiles');
/** Les polices de Dérush (public/polices, avec leurs licences), servies sous « /polices/ ». */
export const DOSSIER_POLICES = path.join(RACINE_APP, 'public', 'polices');
export const LIMITES = {duree: 600, fps: 60, cote: 4320, flou: 32, images: 36000};

/** Le navigateur sans fenêtre : DERUSH_CHROME, celui du moteur de rendu, sinon Chrome, Edge ou Brave de l'ordinateur. */
export function navigateurToile() {
  const c = process.env.DERUSH_CHROME;
  if (c && fs.existsSync(c)) return c;
  return navigateurRemotion() ?? navigateurApp();
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.hdr': 'application/octet-stream', '.bin': 'application/octet-stream',
  '.glsl': 'text/plain; charset=utf-8', '.frag': 'text/plain; charset=utf-8', '.vert': 'text/plain; charset=utf-8',
};

/** Un chemin demandé, ramené dans son dossier : null s'il en sort (« .. », chemin absolu, caractère nul). */
export function cheminDans(racine, demande) {
  let rel;
  try { rel = decodeURIComponent(String(demande ?? '')); } catch { return null; }
  if (rel.includes('\0') || rel.includes('\\')) return null;
  const morceaux = rel.split('/').filter((m) => m && m !== '.');
  if (morceaux.some((m) => m === '..')) return null;
  const abs = path.resolve(racine, ...morceaux);
  const base = path.resolve(racine);
  return abs === base || abs.startsWith(base + path.sep) ? abs : null;
}

/**
 * Le petit serveur de la toile : le dossier de la page à la racine, « /lib/<bibliothèque>/ » (le moteur de rendu),
 * « /tableaux/ » (le moteur de dessin de la compétence) et « /polices/ » (les polices de Dérush). Lecture seule, sur
 * 127.0.0.1, port choisi par le système.
 */
export function serveurToile({racine, libs = dossierBibliotheques(), tableaux = DOSSIER_TABLEAUX} = {}) {
  const manquants = [];
  const estFichier = (f) => { try { return !!f && fs.statSync(f).isFile(); } catch { return false; } };
  const resoudre = (chemin) => {
    // ce qui est dans le dossier de la page passe d'abord (une page peut avoir son propre dossier « lib ») ; ensuite
    // seulement les bibliothèques du moteur de rendu, le moteur de dessin et les polices de Dérush
    const sien = cheminDans(racine, chemin);
    if (estFichier(sien)) return sien;
    if (chemin.startsWith('/lib/')) {
      const reste = chemin.slice(5);
      const nom = BIBLIOTHEQUES.find((b) => reste === b || reste.startsWith(`${b}/`));
      return nom ? cheminDans(path.join(libs, nom), reste.slice(nom.length)) : null;
    }
    if (chemin.startsWith('/tableaux/')) return cheminDans(tableaux, chemin.slice(10));
    if (chemin.startsWith('/polices/')) return cheminDans(DOSSIER_POLICES, chemin.slice(9));
    return sien;
  };
  const serveur = http.createServer((req, res) => {
    const refuser = (code, mot) => { res.writeHead(code, {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store'}); res.end(mot); };
    if (req.method !== 'GET' && req.method !== 'HEAD') return refuser(405, 'Lecture seule.');
    // seulement depuis cet ordinateur, et par son adresse (pas par un nom qui y mènerait)
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(String(req.headers.host ?? ''))) return refuser(403, 'Refusé.');
    let chemin;
    try { chemin = new URL(req.url, 'http://127.0.0.1').pathname; } catch { return refuser(400, 'Adresse illisible.'); }
    const f = resoudre(chemin);
    let st = null;
    try { st = f ? fs.statSync(f) : null; } catch { st = null; }
    if (!st || !st.isFile()) {
      if (manquants.length < 40 && chemin !== '/favicon.ico' && !manquants.includes(chemin)) manquants.push(chemin.slice(0, 200));
      return refuser(404, 'Introuvable.');
    }
    const type = TYPES[path.extname(f).toLowerCase()] ?? 'application/octet-stream';
    const entetes = {'content-type': type, 'cache-control': 'no-store', 'accept-ranges': 'bytes', 'x-content-type-options': 'nosniff'};
    // un morceau de fichier (une vidéo lue dans la page)
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
    if (m && (m[1] || m[2])) {
      const debut = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]));
      const fin = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
      if (debut > fin || debut >= st.size) { res.writeHead(416, {'content-range': `bytes */${st.size}`}); return res.end(); }
      res.writeHead(206, {...entetes, 'content-range': `bytes ${debut}-${fin}/${st.size}`, 'content-length': fin - debut + 1});
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(f, {start: debut, end: fin}).on('error', () => res.destroy()).pipe(res);
    }
    res.writeHead(200, {...entetes, 'content-length': st.size});
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(f).on('error', () => res.destroy()).pipe(res);
  });
  return new Promise((ok, ko) => {
    serveur.once('error', ko);
    serveur.listen(0, '127.0.0.1', () => ok({origine: `http://127.0.0.1:${serveur.address().port}`, manquants, fermer: () => new Promise((f) => { serveur.closeAllConnections?.(); serveur.close(() => f()); })}));
  });
}

/** Le protocole de Chrome par un tube (jamais un port) : des messages JSON séparés par un octet nul. */
function clientNavigateur(proc) {
  const ecrire = proc.stdio[3];
  const lire = proc.stdio[4];
  let n = 0;
  let mort = null;
  const attente = new Map();
  const ecouteurs = new Set();
  let morceaux = [];
  const recevoir = (texte) => {
    let m;
    try { m = JSON.parse(texte); } catch { return; }
    if (m.id && attente.has(m.id)) {
      const a = attente.get(m.id);
      attente.delete(m.id);
      clearTimeout(a.minuteur);
      if (m.error) a.ko(new Error(`${a.methode} : ${m.error.message}`)); else a.ok(m.result ?? {});
    } else if (m.method) for (const e of [...ecouteurs]) { try { e(m); } catch { /* un écouteur ne casse pas la lecture */ } }
  };
  lire.on('data', (d) => {
    let debut = 0;
    for (let i = d.indexOf(0); i >= 0; i = d.indexOf(0, debut)) {
      morceaux.push(d.subarray(debut, i));
      recevoir(Buffer.concat(morceaux).toString('utf8'));
      morceaux = [];
      debut = i + 1;
    }
    if (debut < d.length) morceaux.push(d.subarray(debut));
  });
  const finir = (pourquoi) => {
    if (mort) return;
    mort = new Error(pourquoi);
    for (const a of attente.values()) { clearTimeout(a.minuteur); a.ko(mort); }
    attente.clear();
  };
  proc.on('exit', (code) => finir(`Le navigateur s’est arrêté (code ${code}).`));
  proc.on('error', (e) => finir(`Le navigateur n’a pas pu se lancer : ${e.message}`));
  ecrire.on('error', () => finir('Le navigateur ne répond plus.'));
  const envoyer = (methode, params = {}, session = null, delai = 60000) => new Promise((ok, ko) => {
    if (mort) return ko(mort);
    const id = ++n;
    const minuteur = setTimeout(() => { attente.delete(id); ko(new Error(`${methode} : pas de réponse du navigateur en ${Math.round(delai / 1000)} s.`)); }, delai);
    attente.set(id, {ok, ko, methode, minuteur});
    ecrire.write(`${JSON.stringify({id, method: methode, params, ...(session ? {sessionId: session} : {})})}\0`);
  });
  return {envoyer, ecouter: (f) => { ecouteurs.add(f); return () => ecouteurs.delete(f); }, get mort() { return mort; }};
}

/** Attend un événement du navigateur (ou l'échec au bout du délai). */
const attendreEvenement = (client, test, delai, quoi) => new Promise((ok, ko) => {
  const minuteur = setTimeout(() => { arreter(); ko(new Error(`${quoi} : rien en ${Math.round(delai / 1000)} s.`)); }, delai);
  const arreter = client.ecouter((m) => { if (test(m)) { clearTimeout(minuteur); arreter(); ok(m); } });
});

// ce qu'une image fixe ne dit pas au navigateur : sous temps arrêté, une page immobile ne rend rien. Ce point animé,
// invisible, lui fait rendre une image à chaque pas.
/** Les paramètres ajoutés à l'adresse de la page (« film=aube&w=1080 ») : des lettres, des chiffres et des signes simples. */
export function requeteSure(q) {
  const s = String(q ?? '').replace(/^[?&]+/, '');
  if (!s) return '';
  if (s.length > 600 || !/^[\w.~%=&+,:;@!*()'-]*$/.test(s)) throw new Error('Les paramètres de la page (--parametres) sont illisibles : écris-les comme « film=aube&w=1080 ».');
  return `&${s}`;
}
/** Ce que le serveur n'a pas trouvé, dit en clair : une bibliothèque absente du moteur de rendu, ou un fichier oublié. */
export function direManquants(manquants = [], libs = dossierBibliotheques()) {
  return manquants.map((m) => {
    const b = m.startsWith('/lib/') ? BIBLIOTHEQUES.find((x) => m.slice(5) === x || m.slice(5).startsWith(`${x}/`)) : null;
    if (m.startsWith('/lib/') && !b) return `${m} : cette bibliothèque n’est pas dans la liste (derush-toile bibliotheques)`;
    if (b && !fs.existsSync(path.join(libs, b, 'package.json'))) return `${m} : la bibliothèque ${b} n’est pas encore dans le moteur de rendu (Dérush le met à jour au début du prochain montage)`;
    return `${m} : introuvable`;
  });
}

const BATTEMENT = `(() => { const poser = () => { if (document.getElementById('__derush_bat') || !document.documentElement) return; const s = document.createElement('style'); s.textContent = '@keyframes __derush_bat{from{transform:translateX(0)}to{transform:translateX(1px)}}#__derush_bat{position:fixed;left:0;top:0;width:1px;height:1px;opacity:.004;pointer-events:none;z-index:2147483647;animation:__derush_bat 97ms linear infinite alternate}'; const b = document.createElement('div'); b.id = '__derush_bat'; (document.head || document.documentElement).appendChild(s); (document.body || document.documentElement).appendChild(b); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser); else poser(); })();`;

/**
 * Ouvre une page dans le navigateur sans fenêtre et la prépare. Renvoie de quoi la dessiner et la photographier :
 * {infos, rendre(t), avancer(ms), capturer(format), evaluer(expr), refus, erreurs, fermer()}.
 * `page` : un fichier .html ; `racine` : le dossier servi (celui de la page par défaut).
 */
export async function ouvrirToile({page, racine = null, largeur = null, hauteur = null, echelle = 1, transparent = false, horloge = false, gl = null, attente = 45000, bacASable = false, libs, tableaux, requete = ''} = {}) {
  const parametres = requeteSure(requete);
  const fichier = path.resolve(String(page ?? ''));
  if (!fs.existsSync(fichier) || !/\.html?$/i.test(fichier)) throw new Error(`La page est introuvable, ou n’est pas un fichier .html : ${page}`);
  const base = path.resolve(racine ?? path.dirname(fichier));
  const rel = path.relative(base, fichier);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('La page doit être dans le dossier servi (--racine).');
  const chrome = navigateurToile();
  if (!chrome) throw new Error('Aucun navigateur sans fenêtre : le moteur de rendu de Dérush n’est pas encore installé (il s’installe au premier montage), et ni Chrome, ni Edge, ni Brave ne sont sur cet ordinateur.');
  const serveur = await serveurToile({racine: base, libs, tableaux});
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-toile-'));
  const sansFenetre = /headless-shell/i.test(path.basename(chrome));
  const moteurGl = gl === 'logiciel' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : MAC ? ['--use-angle=metal'] : WINDOWS ? ['--use-angle=d3d11'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const args = ['--remote-debugging-pipe', ...(sansFenetre ? [] : ['--headless=new']), '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-component-update',
    '--disable-background-networking', '--disable-sync', '--disable-default-apps', '--metrics-recording-only', '--no-pings', '--mute-audio', '--hide-scrollbars',
    '--force-color-profile=srgb', '--disable-features=Translate,MediaRouter,OptimizationHints,AutofillServerCommunication', '--autoplay-policy=no-user-gesture-required',
    // aucun nom ne se résout, sauf cet ordinateur : la page ne peut rien charger d'Internet
    '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', ...moteurGl,
    ...(bacASable || (process.platform === 'linux' && process.getuid?.() === 0) ? ['--no-sandbox'] : []), `--user-data-dir=${profil}`, 'about:blank'];
  const proc = spawn(chrome, args, {stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'], windowsHide: true});
  const client = clientNavigateur(proc);
  const refus = [];
  const erreurs = [];
  let session = null;
  const S = (methode, params, delai) => client.envoyer(methode, params, session, delai);
  const fermer = async () => {
    try { await client.envoyer('Browser.close', {}, null, 3000); } catch { /* déjà parti */ }
    try { proc.kill(); } catch { /* déjà parti */ }
    await serveur.fermer();
    try { fs.rmSync(profil, {recursive: true, force: true, maxRetries: 3}); } catch { /* le système le fera */ }
  };
  try {
    const {targetId} = await client.envoyer('Target.createTarget', {url: 'about:blank'});
    ({sessionId: session} = await client.envoyer('Target.attachToTarget', {targetId, flatten: true}));
    client.ecouter((m) => {
      if (m.sessionId !== session) return;
      if (m.method === 'Runtime.exceptionThrown') erreurs.push(String(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 400));
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') erreurs.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400));
      if (m.method === 'Fetch.requestPaused') {
        const u = String(m.params.request.url);
        const permis = u.startsWith(`${serveur.origine}/`) || /^(data|blob|about):/i.test(u);
        if (!permis && refus.length < 40 && !refus.includes(u.slice(0, 200))) refus.push(u.slice(0, 200));
        S(permis ? 'Fetch.continueRequest' : 'Fetch.failRequest', permis ? {requestId: m.params.requestId} : {requestId: m.params.requestId, errorReason: 'BlockedByClient'}).catch(() => {});
      }
    });
    await S('Page.enable');
    await S('Runtime.enable');
    await S('Fetch.enable', {patterns: [{urlPattern: '*'}]});
    const L = Math.round(largeur ?? 1920);
    const H = Math.round(hauteur ?? 1080);
    await S('Emulation.setDeviceMetricsOverride', {width: L, height: H, deviceScaleFactor: echelle, mobile: false});
    if (transparent) await S('Emulation.setDefaultBackgroundColorOverride', {color: {r: 0, g: 0, b: 0, a: 0}});
    if (horloge) {
      await S('Page.addScriptToEvaluateOnNewDocument', {source: BATTEMENT});
      await S('Emulation.setVirtualTimePolicy', {policy: 'pause', initialVirtualTime: 1700000000});
    }
    const charge = attendreEvenement(client, (m) => m.sessionId === session && m.method === 'Page.loadEventFired', attente, 'Le chargement de la page');
    const adresse = `${serveur.origine}/${rel.split(path.sep).map(encodeURIComponent).join('/')}?render=1${parametres}`;
    const nav = await S('Page.navigate', {url: adresse});
    if (nav.errorText) throw new Error(`La page ne s’ouvre pas : ${nav.errorText}`);
    if (horloge) {
      // sous temps arrêté, le chargement avance par petits pas, tant que la page n'est pas là
      const t0 = Date.now();
      let fini = false;
      charge.then(() => { fini = true; }).catch(() => { fini = true; });
      while (!fini && Date.now() - t0 < attente) {
        const pas = attendreEvenement(client, (m) => m.sessionId === session && m.method === 'Emulation.virtualTimeBudgetExpired', 15000, 'Le temps de la page');
        await S('Emulation.setVirtualTimePolicy', {policy: 'pauseIfNetworkFetchesPending', budget: 50});
        await pas.catch(() => {});
      }
    }
    await charge;
    const evaluer = async (expression, delai = 60000) => {
      const r = await S('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, delai);
      if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).slice(0, 600));
      return r.result?.value;
    };
    // prête ? la page le dit (window.__ready) ; sinon : chargée, et ses polices aussi
    const t0 = Date.now();
    for (;;) {
      const etat = await evaluer(`(() => { if (window.__bootFailed) return {echec: String(window.__bootFailed).slice(0, 600)}; const dit = typeof window.__ready !== 'undefined' || (typeof window.renderFrame === 'function' && typeof window.prepare === 'function'); return {pret: dit ? window.__ready === true : (document.readyState === 'complete' && (!document.fonts || document.fonts.status === 'loaded'))}; })()`);
      if (etat?.echec) throw new Error(`La page dit qu’elle n’a pas pu démarrer : ${etat.echec}`);
      if (etat?.pret) break;
      if (Date.now() - t0 > attente) throw new Error(`La page n’est pas prête au bout de ${Math.round(attente / 1000)} s (window.__ready n’est jamais passé à true).${serveur.manquants.length ? ` Introuvable : ${direManquants(serveur.manquants, libs).slice(0, 4).join(' ; ')}.` : ''}${erreurs.length ? ` Ses erreurs : ${erreurs.slice(0, 3).join(' | ')}` : ''}`);
      if (horloge) {
        const pas = attendreEvenement(client, (m) => m.sessionId === session && m.method === 'Emulation.virtualTimeBudgetExpired', 15000, 'Le temps de la page');
        await S('Emulation.setVirtualTimePolicy', {policy: 'pauseIfNetworkFetchesPending', budget: 50});
        await pas.catch(() => {});
      } else await new Promise((f) => setTimeout(f, 80));
    }
    const infos = await evaluer(`(() => {
      const f = typeof window.renderAt === 'function' ? 'renderAt' : typeof window.renderFrame === 'function' ? 'renderFrame' : null;
      window.__derushRendre = f === 'renderAt' ? (t) => window.renderAt(t) : f === 'renderFrame' ? (async (t) => { if (typeof window.prepare === 'function') await window.prepare(t); return window.renderFrame(t); }) : null;
      const o = (window.toile && typeof window.toile === 'object') ? window.toile : {};
      const nb = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
      const c = document.querySelector('canvas');
      return {contrat: f, duree: nb(o.duree) ?? nb(window.__total) ?? nb(window.DURATION), fps: nb(o.fps), largeur: nb(o.largeur) ?? (Array.isArray(window.__size) ? nb(window.__size[0]) : null),
        hauteur: nb(o.hauteur) ?? (Array.isArray(window.__size) ? nb(window.__size[1]) : null), boucle: o.boucle === true, suite: o.suite === true, toile: c ? [c.width, c.height] : null, titre: document.title.slice(0, 120)};
    })()`);
    // la page dit sa taille : la fenêtre la prend (sauf si la demande en impose une)
    const Lf = Math.round(largeur ?? infos.largeur ?? L);
    const Hf = Math.round(hauteur ?? infos.hauteur ?? H);
    if (Lf !== L || Hf !== H) await S('Emulation.setDeviceMetricsOverride', {width: Lf, height: Hf, deviceScaleFactor: echelle, mobile: false});
    let tHorloge = 0;
    return {
      infos: {...infos, largeur: Lf, hauteur: Hf, echelle, navigateur: path.basename(chrome), horloge},
      refus, erreurs, evaluer, manquants: serveur.manquants,
      /** Dessine l'instant t (contrat). */
      async rendre(t) {
        if (!infos.contrat) throw new Error('Cette page n’a pas window.renderAt(t) : rends-la avec --horloge, ou ajoute-lui ce contrat.');
        await evaluer(`window.__derushRendre(${Number(t)})`, 120000);
      },
      /** Avance le temps du navigateur de `ms` (mode horloge). */
      async avancer(ms) {
        const pas = attendreEvenement(client, (m) => m.sessionId === session && m.method === 'Emulation.virtualTimeBudgetExpired', 60000, 'Le temps de la page');
        await S('Emulation.setVirtualTimePolicy', {policy: 'pauseIfNetworkFetchesPending', budget: ms});
        await pas;
        tHorloge += ms;
        return tHorloge;
      },
      /** L'image affichée : un Buffer PNG (ou JPEG de qualité 95 avec « jpeg »). */
      async capturer(format = 'png') {
        const r = await S('Page.captureScreenshot', format === 'jpeg' ? {format: 'jpeg', quality: 95, optimizeForSpeed: true} : {format: 'png', optimizeForSpeed: true}, 120000);
        return Buffer.from(r.data, 'base64');
      },
      fermer,
    };
  } catch (e) { await fermer(); throw e; }
}

/** L'encodage selon la sortie : .mp4 (H.264), .mov (ProRes 4444, fond transparent), .webm (VP9, fond transparent). */
export function argsEncodage(sortie, {fps, transparent = false, flou = 1, crf = 14, son = null} = {}) {
  const ext = path.extname(sortie).toLowerCase();
  if (!['.mp4', '.mov', '.webm'].includes(ext)) throw new Error('La sortie est un .mp4, un .mov (fond transparent) ou un .webm (fond transparent).');
  if (transparent && ext === '.mp4') throw new Error('Un fond transparent demande une sortie .mov (ProRes 4444) ou .webm : le MP4 n’a pas de transparence.');
  // le flou de mouvement : N images par image, mélangées (obturateur à 180°), une gardée sur N
  const melange = flou > 1 ? [`tmix=frames=${flou}`, `select='not(mod(n+1\\,${flou}))'`] : [];
  const pair = "scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos";
  const entree = ['-f', 'image2pipe', '-framerate', String(fps * flou), '-c:v', transparent ? 'png' : 'png', '-i', '-'];
  const audio = son ? ['-i', son] : [];
  const sortieSon = son ? ['-map', '0:v:0', '-map', '1:a:0', '-c:a', ext === '.webm' ? 'libopus' : 'aac', '-b:a', '192k', '-shortest'] : ['-an'];
  let video;
  if (ext === '.mp4') {
    // les couleurs de la vidéo HD (BT.709, plage « tv »), étiquetées : les mêmes dans tous les lecteurs
    video = ['-vf', [...melange, pair, 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int', 'format=yuv420p', 'setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709'].join(','),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
  } else if (ext === '.mov') {
    video = ['-vf', [...melange, pair].join(','), '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', transparent ? 'yuva444p10le' : 'yuv444p10le', '-vendor', 'apl0'];
  } else {
    video = ['-vf', [...melange, pair].join(','), '-c:v', 'libvpx-vp9', '-pix_fmt', transparent ? 'yuva420p' : 'yuv420p', '-b:v', '0', '-crf', String(Math.max(10, crf + 6)), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2'];
  }
  return ['-v', 'error', '-y', ...entree, ...audio, ...video, '-r', String(fps), ...sortieSon, sortie];
}

// une valeur absente (null, vide) n'est pas zéro : elle prend la valeur par défaut
const borne = (v, min, max, defaut) => { const n = v == null || v === '' ? NaN : Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };

/**
 * Rend une toile en vidéo. `prog({image, total})` suit le rendu. Renvoie {sortie, images, fps, duree, largeur,
 * hauteur, secondes, contrat, refus, erreurs}.
 */
export async function rendreToile({page, sortie, racine = null, fps = null, duree = null, de = 0, a = null, largeur = null, hauteur = null, echelle = 1, transparent = false, horloge = false,
  flou = 1, crf = 14, son = null, gl = null, bacASable = false, libs, tableaux, requete = '', prog = () => {}} = {}) {
  if (!sortie) throw new Error('Il manque la sortie (-o film.mp4).');
  const t0 = Date.now();
  const T = await ouvrirToile({page, racine, largeur, hauteur, echelle, transparent, horloge, gl, bacASable, libs, tableaux, requete});
  let ff = null;
  try {
    if (!horloge && !T.infos.contrat) throw new Error('Cette page n’a pas window.renderAt(t). Ajoute-lui ce contrat (une fonction qui dessine exactement l’instant t), ou rends-la telle qu’elle joue avec --horloge.');
    const F = Math.round(borne(fps ?? T.infos.fps, 1, LIMITES.fps, 30));
    const total = borne(duree ?? T.infos.duree, 0.04, LIMITES.duree, NaN);
    if (!Number.isFinite(total)) throw new Error('Il manque la durée : --duree 8 (en secondes), ou window.toile = {duree: 8} dans la page.');
    const debut = borne(de, 0, total, 0);
    const fin = borne(a ?? total, debut, total, total);
    const N = Math.round(borne(flou, 1, LIMITES.flou, 1));
    if (horloge && debut > 0) throw new Error('Avec --horloge, le rendu part du début de la page : --de n’est pas possible.');
    // les images 0 à n-1 : jamais l'image n (dans une boucle, ce serait l'image 0 une seconde fois)
    const n = Math.max(1, Math.round((fin - debut) * F));
    if (n * N > LIMITES.images) throw new Error(`Trop d’images à rendre (${n * N}) : raccourcis, baisse les images par seconde ou le flou.`);
    fs.mkdirSync(path.dirname(path.resolve(sortie)), {recursive: true});
    ff = spawn(FFMPEG, argsEncodage(sortie, {fps: F, transparent, flou: N, crf, son}), {stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true});
    let errFf = '';
    ff.stderr.on('data', (d) => { errFf = (errFf + d).slice(-2000); });
    const finFf = new Promise((ok) => ff.on('close', (code) => ok(code)));
    ff.stdin.on('error', () => { /* ffmpeg est parti : son code le dira */ });
    const pousser = (buf) => new Promise((ok) => { if (ff.stdin.destroyed || !ff.stdin.writable) return ok(); if (ff.stdin.write(buf)) ok(); else ff.stdin.once('drain', ok); });
    const dt = 1000 / F;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < N; k++) {
        // l'obturateur à 180° : les images mélangées couvrent la première moitié du temps de l'image
        const t = debut + (i + (N > 1 ? k / (2 * N) : 0)) / F;
        if (horloge) { if (i || k) await T.avancer(N > 1 ? (k === 0 ? dt - dt * (N - 1) / (2 * N) : dt / (2 * N)) : dt); }
        else await T.rendre(t);
        await pousser(await T.capturer('png'));
      }
      if (i % 5 === 0 || i === n - 1) prog({image: i + 1, total: n});
    }
    ff.stdin.end();
    const code = await finFf;
    if (code !== 0) throw new Error(`L’encodage a échoué : ${errFf.trim().slice(-400) || `ffmpeg, code ${code}`}`);
    return {sortie: path.resolve(sortie), images: n, fps: F, duree: n / F, largeur: Math.round(T.infos.largeur * echelle), hauteur: Math.round(T.infos.hauteur * echelle), flou: N, transparent,
      contrat: T.infos.contrat ?? (horloge ? 'horloge' : null), navigateur: T.infos.navigateur, boucle: T.infos.boucle, refus: T.refus, manquants: direManquants(T.manquants, libs), erreurs: T.erreurs.slice(0, 12), secondes: Math.round((Date.now() - t0) / 100) / 10};
  } catch (e) {
    try { ff?.stdin.destroy(); ff?.kill(); } catch { /* déjà parti */ }
    throw e;
  } finally { await T.fermer(); }
}

/** Des images fixes de la toile, aux instants donnés (secondes) : `dossier/t-0001.50.png`. Pour regarder avant de rendre. */
export async function imagesToile({page, instants = [0], dossier, racine = null, largeur = null, hauteur = null, echelle = 1, transparent = false, gl = null, bacASable = false, libs, tableaux, requete = ''} = {}) {
  if (!dossier) throw new Error('Il manque le dossier des images (-o dossier).');
  const T = await ouvrirToile({page, racine, largeur, hauteur, echelle, transparent, gl, bacASable, libs, tableaux, requete});
  try {
    if (!T.infos.contrat) throw new Error('Cette page n’a pas window.renderAt(t) : des images à des instants choisis demandent ce contrat.');
    const dir = path.resolve(dossier);
    fs.mkdirSync(dir, {recursive: true});
    const fichiers = [];
    for (const t of instants.slice(0, 200)) {
      await T.rendre(Number(t));
      const f = path.join(dir, `t-${Number(t).toFixed(2).padStart(7, '0')}.png`);
      fs.writeFileSync(f, await T.capturer('png'));
      fichiers.push(f);
    }
    return {fichiers, infos: T.infos, refus: T.refus, manquants: direManquants(T.manquants, libs), erreurs: T.erreurs.slice(0, 12)};
  } finally { await T.fermer(); }
}

const empreinte = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

/**
 * Vérifie le contrat d'une toile, avant de la rendre en entier :
 *   - « à froid » : l'image d'un instant, demandée seule sur une page neuve, est la même qu'après les images d'avant
 *     (sinon la page garde un état d'une image à l'autre : le rendu dépendrait de l'ordre) ;
 *   - « deux fois » : le même instant demandé deux fois donne la même image (sinon : une horloge ou du hasard) ;
 *   - la boucle (si la page le dit ou si on le demande) : la dernière image s'enchaîne avec la première.
 * Renvoie {ok, points: [{nom, ok, detail}], infos}.
 */
export async function verifierToile({page, racine = null, fps = null, duree = null, largeur = null, hauteur = null, boucle = null, gl = null, bacASable = false, libs, tableaux, requete = ''} = {}) {
  const points = [];
  const ouvrir = () => ouvrirToile({page, racine, largeur, hauteur, gl, bacASable, libs, tableaux, requete});
  let T = await ouvrir();
  let infos = T.infos;
  try {
    points.push({nom: 'le contrat', ok: !!infos.contrat, detail: infos.contrat ? `window.${infos.contrat}(t) est là` : 'pas de window.renderAt(t) : seule la lecture avec --horloge est possible'});
    if (!infos.contrat) return {ok: false, points, infos, refus: T.refus, manquants: direManquants(T.manquants, libs), erreurs: T.erreurs.slice(0, 12)};
    const F = Math.round(borne(fps ?? infos.fps, 1, LIMITES.fps, 30));
    const total = borne(duree ?? infos.duree, 0.04, LIMITES.duree, NaN);
    if (!Number.isFinite(total)) throw new Error('Il manque la durée : --duree 8 (en secondes), ou window.toile = {duree: 8} dans la page.');
    const n = Math.max(2, Math.round(total * F));
    const instants = [0.2, 0.55, 0.85].map((p) => Math.min(n - 1, Math.max(1, Math.round(p * n))) / F);
    // dans l'ordre, après l'image d'avant
    const chaudes = [];
    for (const t of instants) { await T.rendre(t - 1 / F); await T.rendre(t); chaudes.push(await T.capturer('png')); }
    // deux fois de suite
    await T.rendre(instants[1]);
    const a1 = empreinte(await T.capturer('png'));
    await T.rendre(instants[1]);
    const a2 = empreinte(await T.capturer('png'));
    chaudes[1] = await T.capturer('png');
    points.push({nom: 'deux fois le même instant', ok: a1 === a2, detail: a1 === a2 ? 'la même image' : `deux images différentes à ${instants[1].toFixed(2)} s : une horloge (Date.now, performance.now) ou du hasard sans graine`});
    // la boucle : la dernière image s'enchaîne avec la première (un pas normal, pas un saut)
    const enBoucle = boucle ?? infos.boucle;
    let couture = null;
    if (enBoucle) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-couture-'));
      try {
        const prendre = async (t, nom) => { await T.rendre(t); const f = path.join(tmp, nom); fs.writeFileSync(f, await T.capturer('png')); return f; };
        const fa = await prendre((n - 2) / F, 'a.png');
        const fb = await prendre((n - 1) / F, 'b.png');
        const f0 = await prendre(0, 'c.png');
        const pas = await ecartImages(fa, fb);
        const saut = await ecartImages(fb, f0);
        couture = {pas, saut};
        const bon = saut <= Math.max(pas * 2.5, 0.6);
        points.push({nom: 'la boucle', ok: bon, detail: bon ? `la dernière image s’enchaîne avec la première (écart ${saut.toFixed(2)}, un pas normal fait ${pas.toFixed(2)})` : `un saut à la couture : écart ${saut.toFixed(2)} entre la dernière image et la première, pour un pas normal de ${pas.toFixed(2)}`});
      } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
    }
    const vus = {refus: [...T.refus], manquants: direManquants(T.manquants, libs), erreurs: T.erreurs.slice(0, 12)};
    await T.fermer();
    T = null;
    // à froid : une page neuve par instant, dans un autre ordre
    if (infos.suite) points.push({nom: 'à froid', ok: true, detail: 'la page dit qu’elle se rend dans l’ordre (window.toile.suite) : pas de contrôle à froid ; ne la rends jamais en plusieurs morceaux'});
    else {
      // chaque instant, sur une page neuve : dessiné une première fois (un cache peut se remplir à ce moment-là), puis
      // une seconde, qui doit être l'image obtenue après les autres. L'écart se mesure (0 = identiques, sur 255).
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-froid-'));
      const ecart = async (a, b) => {
        if (empreinte(a) === empreinte(b)) return 0;
        const fa = path.join(tmp, 'a.png'), fb = path.join(tmp, 'b.png');
        fs.writeFileSync(fa, a); fs.writeFileSync(fb, b);
        return ecartImages(fa, fb);
      };
      const TOLERANCE = 0.05;
      const differents = [];
      let premier = 0;
      try {
        for (const i of [2, 0, 1]) {
          const U = await ouvrir();
          try {
            await U.rendre(instants[i]);
            const une = await U.capturer('png');
            await U.rendre(instants[i]);
            const deux = await U.capturer('png');
            premier = Math.max(premier, await ecart(une, deux));
            const e = await ecart(deux, chaudes[i]);
            if (e > TOLERANCE) differents.push({t: instants[i], e});
          } finally { await U.fermer(); }
        }
      } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
      points.push({nom: 'à froid', ok: !differents.length, detail: differents.length ? `l’image dépend de ce qui a été rendu avant, à ${differents.map((x) => `${x.t.toFixed(2)} s (écart ${x.e.toFixed(2)})`).join(', ')} : un ressort ou une simulation qui s’additionne d’image en image. Écris chaque mouvement comme une fonction de t (ou dis window.toile.suite = true si c’est voulu)` : 'la même image, seule ou après les autres'});
      // sans gravité pour un rendu dans l'ordre, mais bon à savoir : le tout premier dessin n'est pas celui d'après
      if (premier > TOLERANCE) points.push({nom: 'le premier dessin', ok: true, detail: `la première image dessinée après l’ouverture de la page n’est pas tout à fait celle d’après (écart ${premier.toFixed(2)}) : un cache se remplit au premier dessin. Sans gravité pour un rendu dans l’ordre ; un rendu qui commence au milieu (--debut) peut avoir une première image un peu différente`});
    }
    return {ok: points.every((p) => p.ok), points, infos, couture, ...vus};
  } finally { if (T) await T.fermer(); }
}

/** L'écart moyen entre deux images (0 = identiques, sur 255), mesuré par FFmpeg. */
export function ecartImages(a, b) {
  return new Promise((ok, ko) => {
    // les deux images sont d'abord mises au même format (trois plans rouge, vert, bleu), puis soustraites
    const p = spawn(FFMPEG, ['-v', 'error', '-i', a, '-i', b, '-lavfi', '[0:v]format=gbrp[x];[1:v]format=gbrp[y];[x][y]blend=all_mode=difference,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'], {stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true});
    let s = '';
    p.stdout.on('data', (d) => { s += d; });
    p.on('error', ko);
    // FFmpeg écrit les très petits nombres avec un exposant (« 9.6e-07 ») : il fait partie du nombre
    p.on('close', () => { const m = /YAVG=([0-9.eE+-]+)/.exec(s); const v = m ? Number(m[1]) : NaN; if (Number.isFinite(v)) ok(v); else ko(new Error('FFmpeg n’a pas pu comparer les deux images.')); });
  });
}

/**
 * Une planche : les images côte à côte, leur instant écrit dessus, pour tout regarder d'un coup d'œil. `ratio` =
 * hauteur / largeur de la page. Renvoie le fichier écrit (.jpg).
 */
export async function plancheToile(fichiers, sortie, {instants = [], ratio = 9 / 16} = {}) {
  const liste = fichiers.slice(0, 48);
  const n = liste.length;
  if (!n) throw new Error('Aucune image pour la planche.');
  const debout = ratio > 1.05;
  const l = debout ? 300 : ratio > 0.8 ? 360 : 480;
  const h = Math.round((l * ratio) / 2) * 2;
  const col = Math.min(n, debout ? 6 : 4);
  const args = ['-y'];
  for (const f of liste) args.push('-i', f);
  const temps = (k) => (Number.isFinite(Number(instants[k])) ? `,drawtext=fontfile=${cheminFiltre(POLICE_GRAS)}:text='${Number(instants[k]).toFixed(2)} s':fontsize=18:fontcolor=white:box=1:boxcolor=0x000000@0.6:boxborderw=5:x=8:y=h-th-8` : '');
  const cellule = (k, avecTemps) => `[${k}:v]scale=${l}:${h}:force_original_aspect_ratio=decrease,pad=${l}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x101010,format=rgb24${avecTemps ? temps(k) : ''}[c${k}]`;
  const graphe = (avecTemps) => (n === 1 ? `${cellule(0, avecTemps)};[c0]null`
    : `${liste.map((_, k) => cellule(k, avecTemps)).join(';')};${liste.map((_, k) => `[c${k}]`).join('')}xstack=inputs=${n}:layout=${liste.map((_, k) => `${(k % col) * l}_${Math.floor(k / col) * h}`).join('|')}:fill=0x101010`);
  fs.mkdirSync(path.dirname(path.resolve(sortie)), {recursive: true});
  const faire = (avecTemps) => ffmpeg([...args, '-filter_complex', graphe(avecTemps), '-frames:v', '1', '-q:v', '3', sortie]);
  try {
    if (!POLICE_GRAS) throw new Error('Aucune police pour écrire les temps.');
    await faire(true);
  } catch {
    // sans police (ou un FFmpeg qui ne sait pas écrire) : la planche sans les temps vaut mieux que pas de planche
    await faire(false);
  }
  return path.resolve(sortie);
}

// ——— les pages de départ (modeles/toiles/<nom>/) ———
const lireJsonSur = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
/** Les pages de départ : [{nom, titre, pour, bibliotheques, suite}], dans l'ordre de leur numéro. */
export function gabarits(dossier = DOSSIER_GABARITS) {
  let noms = [];
  try { noms = fs.readdirSync(dossier); } catch { return []; }
  return noms.filter((n) => /^[a-z][a-z0-9-]*$/.test(n)).map((n) => {
    const j = lireJsonSur(path.join(dossier, n, 'gabarit.json'));
    return j && fs.existsSync(path.join(dossier, n, 'index.html')) ? {nom: n, ordre: Number(j.ordre) || 99, titre: String(j.titre ?? n), pour: String(j.pour ?? ''), bibliotheques: Array.isArray(j.bibliotheques) ? j.bibliotheques.map(String) : [], suite: j.suite === true} : null;
  }).filter(Boolean).sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom));
}
/**
 * Copie une page de départ dans un dossier neuf (jamais par-dessus des fichiers), avec l'aide commune « toile.js ».
 * Renvoie {dossier, fichiers}.
 */
export function copierGabarit(nom, destination, dossier = DOSSIER_GABARITS) {
  const g = gabarits(dossier).find((x) => x.nom === String(nom ?? ''));
  if (!g) throw new Error(`Page de départ inconnue : ${nom}. Celles qui existent : ${gabarits(dossier).map((x) => x.nom).join(', ') || 'aucune'}.`);
  if (!destination) throw new Error('Il manque le dossier où créer la toile (derush-toile gabarit croquis toile).');
  const cible = path.resolve(destination);
  let deja = [];
  try { deja = fs.readdirSync(cible).filter((n) => !n.startsWith('.')); } catch { /* le dossier n'existe pas encore */ }
  if (deja.length) throw new Error(`Le dossier ${destination} a déjà des fichiers : choisis un dossier neuf.`);
  fs.mkdirSync(cible, {recursive: true});
  const fichiers = [];
  const copier = (de, vers) => {
    for (const n of fs.readdirSync(de)) {
      if (n === 'gabarit.json' || n.startsWith('.')) continue;
      const src = path.join(de, n);
      const st = fs.lstatSync(src);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { fs.mkdirSync(path.join(vers, n), {recursive: true}); copier(src, path.join(vers, n)); } else if (st.isFile()) { fs.copyFileSync(src, path.join(vers, n)); fichiers.push(path.relative(cible, path.join(vers, n))); }
    }
  };
  const commun = path.join(dossier, '_commun');
  if (fs.existsSync(commun)) copier(commun, cible);
  copier(path.join(dossier, g.nom), cible);
  return {dossier: cible, fichiers: fichiers.sort(), gabarit: g};
}

/** Les bibliothèques qu'une page peut importer : [{nom, version, presente}], et la carte d'import à poser dans la page. */
export function etatBibliotheques(libs = dossierBibliotheques()) {
  return BIBLIOTHEQUES.map((nom) => { const j = lireJsonSur(path.join(libs, nom, 'package.json')); return {nom, version: j?.version ?? null, presente: !!j}; });
}
export const baliseCarteImport = () => `<script type="importmap">${JSON.stringify(CARTE_IMPORT)}</script>`;

/** Lance la commande derush-toile hors d'un bac à sable (pour le relais) ; renvoie {code, sortie, erreurs}, même en échec. */
export function lancerToile(args, {cwd = process.cwd(), dureeMax = 60 * 60e3} = {}) {
  const env = {...envNode()};
  for (const k of ['DERUSH_RELAIS', 'DERUSH_RELAIS_BOITE', 'DERUSH_RELAIS_JETON', 'CODEX_SANDBOX']) delete env[k];
  return new Promise((ok, ko) => {
    const p = spawn(process.execPath, [path.join(RACINE_APP, 'outils', 'derush-toile.mjs'), ...args.map(String)], {cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true});
    let sortie = '';
    let erreurs = '';
    const garde = setTimeout(() => p.kill(), dureeMax);
    p.stdout.on('data', (d) => { sortie = (sortie + d).slice(-200000); });
    p.stderr.on('data', (d) => { erreurs = (erreurs + d).slice(-200000); });
    p.on('error', (err) => { clearTimeout(garde); ko(err); });
    p.on('close', (code) => { clearTimeout(garde); ok({code: code ?? 1, sortie, erreurs}); });
  });
}
