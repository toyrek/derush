// Dérush — le téléphone : suivre un montage depuis son téléphone, sur le même réseau (le Wi-Fi) que l'ordinateur.
//
// Le serveur de Dérush n'écoute que cet ordinateur (127.0.0.1), et cela ne change pas. Ce module ouvre une SECONDE
// porte, sur le réseau local, seulement quand la personne l'allume (« Suivre sur mon téléphone »). Elle ne sert que la
// page du téléphone (public/mobile/) et une poignée de routes : où en est le montage, les images du direct, les vidéos
// finies, écrire à l'IA, l'arrêter. Rien d'autre de Dérush n'y passe : ni les rushes, ni les réglages, ni les
// connexions, ni les clés.
//
// Qui a le droit : un téléphone relié. On le relie en scannant un code affiché sur l'ordinateur (il vaut dix minutes et
// ne sert qu'une fois), puis en cliquant « Relier ce téléphone » SUR l'ordinateur : une photo du code ne suffit pas. Le
// téléphone reçoit alors son propre jeton (32 octets tirés au hasard) ; Dérush n'en garde que l'empreinte, dans
// telephone.json (dossier de Dérush). Un téléphone se retire d'un clic, et « Couper » referme la porte.
//
// Au moment de relier, le téléphone et l'ordinateur affichent le même nombre à deux chiffres : on compare, puis on
// clique. Un autre appareil qui aurait pris le code en photo n'affiche pas ce nombre-là.
//
// Ce qu'il faut savoir : la liaison est en http, comme toute adresse d'un réseau local. Elle n'est donc pas chiffrée :
// elle est faite pour un réseau qu'on connaît (la maison, l'association), pas pour un Wi-Fi public. Dérush ne répond
// qu'aux adresses d'un réseau privé, jamais à Internet. Pour la même raison, le téléphone regarde seulement, tant que
// la personne n'a pas allumé « Écrire à l'IA depuis le téléphone ». Les images et les vidéos ne portent jamais le jeton
// dans leur adresse, mais un billet à part, qui ne vaut que pour elles et quelques heures.
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import dgram from 'node:dgram';
import {pipeline} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {VERSION} from './commun.mjs';
import {dossierSupport, garderEveillePendant} from './plateforme.mjs';
import {lireJson, ecrireJson, ffmpeg} from './outils.mjs';
import {cheminQr} from './qr.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ICI, '..', 'public');

/** Le port de la porte du téléphone (le suivant s'il est pris). Il est gardé : l'adresse reste la même d'un jour à l'autre. */
export const PORT_TELEPHONE = 4380;
const DUREE_CODE = 10 * 60e3; // un code de jumelage vaut dix minutes
const ESSAIS_CHIFFRES = 8; // au-delà, le code à six chiffres est annulé (il faut rouvrir la fenêtre)
const MAX_APPAREILS = 8;
const CORPS_MAX = 32 * 1024; // un message, jamais un fichier
const REFUS_MAX = 40; // mauvais codes ou mauvais jetons d'une même adresse, en dix minutes
const TRANCHE = 6 * 3600e3; // un billet d'images vaut entre six et douze heures
const EVEIL = 30 * 60; // l'ordinateur reste éveillé trente minutes après le dernier coup d'œil d'un téléphone (secondes)
const OUBLI = 60 * 24 * 3600e3; // un téléphone pas revu depuis soixante jours est retiré de la liste

// ——— le réseau local ———
/** Les quatre nombres d'une adresse IPv4 (« ::ffff:192.168.1.5 » compris), ou null. */
function octets(ip) {
  const m = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(String(ip ?? ''));
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.every((x) => x <= 255) ? o : null;
}
/**
 * Une adresse d'un réseau privé : la maison ou l'association (10.x, 172.16 à 172.31, 192.168.x), une liaison directe
 * (169.254.x), un réseau privé entre ses appareils comme Tailscale (100.64 à 100.127), ou cet ordinateur (127.x).
 * Tout le reste est Internet : Dérush n'y répond jamais.
 */
export function adressePrivee(ip) {
  const o = octets(ip);
  if (!o) return false;
  const [a, b] = o;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
}
// les cartes qui ne mènent pas au téléphone : tunnels, machines virtuelles, partage entre appareils Apple…
const CARTE_A_PART = /^(?:utun|tun|tap|ppp|wg|zt\w*|tailscale|docker|br-\w+|veth\w*|vmnet|vboxnet|bridge|awdl|llw|anpi|gif|stf|lo)\d*$|vEthernet|VirtualBox|VMware|Hyper-V|WSL|Loopback|Bluetooth|TAP-|Tunnel|VPN|Tailscale|ZeroTier|WireGuard/i;
/** La note d'une adresse : celles d'un réseau de maison d'abord, les tunnels et les machines virtuelles en dernier. */
function noteAdresse(ip, carte, sortie) {
  const [a, b] = octets(ip);
  let n = a === 192 ? 40 : a === 10 ? 30 : a === 172 ? 25 : a === 100 ? 10 : 1;
  if (CARTE_A_PART.test(carte)) n -= 30;
  else if (ip === sortie) n += 15; // celle par où cet ordinateur sort vers Internet : presque toujours le Wi-Fi
  return n;
}
/**
 * L'adresse par laquelle cet ordinateur sort vers Internet, sans rien envoyer : relier une prise UDP à une adresse
 * d'exemple (192.0.2.1 n'existe pas) fait seulement choisir la carte au système. null sans réseau.
 */
export function adresseDeSortie() {
  return new Promise((ok) => {
    let fini = false;
    const s = dgram.createSocket('udp4');
    const fin = (v) => { if (fini) return; fini = true; try { s.close(); } catch { /* déjà fermée */ } ok(v); };
    s.once('error', () => fin(null));
    try { s.connect(9, '192.0.2.1', () => { try { fin(s.address().address); } catch { fin(null); } }); } catch { fin(null); }
    setTimeout(() => fin(null), 400).unref?.();
  });
}
/**
 * Les adresses de cet ordinateur sur ses réseaux privés, la plus probable d'abord : [{ip, carte, conseillee}].
 * `cartes` : ce que rend os.networkInterfaces() (donné par les essais).
 */
export function adressesLocales(sortie = null, cartes = os.networkInterfaces()) {
  const liste = [];
  for (const [carte, adresses] of Object.entries(cartes ?? {})) {
    for (const a of adresses ?? []) {
      const v4 = a.family === 'IPv4' || a.family === 4;
      if (!v4 || a.internal || !adressePrivee(a.address) || liste.some((x) => x.ip === a.address)) continue;
      liste.push({ip: a.address, carte, note: noteAdresse(a.address, carte, sortie)});
    }
  }
  liste.sort((x, y) => y.note - x.note || x.ip.localeCompare(y.ip, 'fr', {numeric: true}));
  return liste.map(({ip, carte}, k) => ({ip, carte, conseillee: k === 0}));
}

// ——— les téléphones ———
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const meme = (a, b) => {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};
/** Le nom d'un appareil, d'après ce que son navigateur annonce : « iPhone · Safari », « Android · Chrome ». */
export function nomAppareil(ua) {
  const t = String(ua ?? '');
  const modele = /Android [\d.]+; ([^;)]{2,24})\)/.exec(t)?.[1]?.replace(/ Build.*$/, '').trim();
  const quoi = /iPhone/.test(t) ? 'iPhone' : /iPad/.test(t) ? 'iPad' : /Android/.test(t) ? (modele && modele !== 'K' ? `Android (${modele})` : 'Android')
    : /Macintosh|Mac OS X/.test(t) ? 'Mac' : /Windows/.test(t) ? 'PC Windows' : /Linux|CrOS/.test(t) ? 'Ordinateur' : 'Appareil';
  const nav = /SamsungBrowser/.test(t) ? 'Samsung Internet' : /EdgA|EdgiOS|Edg\//.test(t) ? 'Edge' : /FxiOS|Firefox/.test(t) ? 'Firefox' : /OPR\/|OPT\//.test(t) ? 'Opera'
    : /CriOS|Chrome\//.test(t) ? 'Chrome' : /Safari/.test(t) ? 'Safari' : null;
  return nav ? `${quoi} · ${nav}` : quoi;
}
/** Le nom de cet ordinateur, lisible : « MacBook-Pro-de-Lea.local » devient « MacBook Pro de Lea ». */
export function nomOrdinateur(nom = os.hostname()) {
  return String(nom ?? '').replace(/\.(local|lan|home|localdomain)$/i, '').replace(/[-_]+/g, ' ').trim().slice(0, 40) || 'ton ordinateur';
}

function lireReglage(fichier) {
  const j = lireJson(fichier) ?? {};
  const appareils = (Array.isArray(j.appareils) ? j.appareils : [])
    .filter((a) => a && typeof a.id === 'string' && /^[a-f0-9]{64}$/.test(a.empreinte ?? '')).slice(-MAX_APPAREILS)
    .map((a) => ({id: a.id.slice(0, 24), nom: String(a.nom ?? 'Téléphone').slice(0, 60), empreinte: a.empreinte, relie_le: a.relie_le ?? null, vu_le: a.vu_le ?? null}));
  return {
    actif: j.actif === true,
    port: Number.isInteger(j.port) && j.port > 1023 && j.port < 65536 ? j.port : null,
    // le téléphone peut-il écrire à l'IA et l'arrêter ? Non, tant que la personne ne l'a pas allumé : il regarde. Une
    // liaison qui n'est pas chiffrée ne doit pas, d'office, pouvoir commander une IA qui travaille sur l'ordinateur.
    ecrire: j.ecrire === true,
    adresse: octets(j.adresse) ? String(j.adresse) : null,
    appareils,
  };
}

// ——— les réponses ———
class Refus extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4'};
// rien d'ailleurs ne se charge dans la page du téléphone, elle ne s'affiche dans aucune autre page, et elle ne dit à
// personne d'où l'on vient
const ENTETES = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
function envoyerJson(res, code, data) {
  const corps = JSON.stringify(data);
  res.writeHead(code, {...ENTETES, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(corps), 'Cache-Control': 'no-store'});
  res.end(corps);
}
/** Envoie un fichier, par morceaux quand le téléphone le demande (un iPhone ne lit une vidéo que comme ça). */
function envoyerFichier(req, res, fichier, {type = null, cache = 'no-store', telecharger = null} = {}) {
  let st;
  try { st = fs.statSync(fichier); } catch { throw new Refus(404, 'Introuvable.'); }
  if (!st.isFile()) throw new Refus(404, 'Introuvable.');
  const entetes = {...ENTETES, 'Content-Type': type ?? TYPES[path.extname(fichier).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': cache, 'Accept-Ranges': 'bytes'};
  if (telecharger) entetes['Content-Disposition'] = `attachment; filename="${telecharger.replace(/[^\w. -]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(telecharger)}`;
  const envoyer = (flux) => (req.method === 'HEAD' ? (flux.destroy(), res.end()) : pipeline(flux, res, () => {}));
  const plage = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? '').trim());
  if (plage && (plage[1] || plage[2])) {
    let a = plage[1] ? Number(plage[1]) : Math.max(0, st.size - Number(plage[2]));
    let b = plage[1] && plage[2] ? Number(plage[2]) : st.size - 1;
    b = Math.min(b, st.size - 1);
    if (a > b || a >= st.size) { res.writeHead(416, {...ENTETES, 'Content-Range': `bytes */${st.size}`}); return res.end(); }
    res.writeHead(206, {...entetes, 'Content-Length': b - a + 1, 'Content-Range': `bytes ${a}-${b}/${st.size}`});
    return envoyer(fs.createReadStream(fichier, {start: a, end: b}));
  }
  res.writeHead(200, {...entetes, 'Content-Length': st.size});
  return envoyer(fs.createReadStream(fichier));
}
function lireCorps(req) {
  return new Promise((ok, ko) => {
    if (!/^application\/json\b/i.test(String(req.headers['content-type'] ?? ''))) { req.resume(); return ko(new Refus(415, 'Demande refusée.')); }
    const morceaux = [];
    let taille = 0;
    req.on('data', (d) => {
      taille += d.length;
      if (taille > CORPS_MAX) { ko(new Refus(413, 'Message trop long.')); req.destroy(); } else morceaux.push(d);
    });
    req.on('end', () => {
      try { const j = JSON.parse(Buffer.concat(morceaux).toString('utf8') || '{}'); ok(j && typeof j === 'object' && !Array.isArray(j) ? j : {}); } catch { ko(new Refus(400, 'Demande illisible.')); }
    });
    const coupee = () => ko(new Refus(400, 'Demande interrompue.'));
    req.on('error', coupee);
    req.on('close', () => { if (!req.complete) coupee(); });
  });
}
function repondreErreur(res, e) {
  try {
    if (res.writableEnded) return;
    if (res.headersSent || res.destroyed) { res.destroy(); return; }
    const voulue = e instanceof Refus;
    if (!voulue && !['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ERR_STREAM_PREMATURE_CLOSE'].includes(e?.code)) console.error('[téléphone]', e?.message ?? e);
    // une erreur de Dérush (« L'IA travaille déjà… ») est dite telle quelle ; une erreur du système, jamais
    envoyerJson(res, voulue ? e.code : 500, {erreur: voulue ? e.message : 'Dérush n’a pas pu répondre : réessaie.'});
  } catch {
    try { res.destroy(); } catch { /* plus rien à couper */ }
  }
}

// la page du téléphone : ces fichiers-là, et aucun autre
const STATIQUES = {
  '/': {f: ['mobile', 'index.html']},
  '/mobile.css': {f: ['mobile', 'mobile.css']},
  '/mobile.js': {f: ['mobile', 'mobile.js']},
  '/icone.png': {f: ['marque', 'derush-512.png'], cache: 'public, max-age=86400'},
  '/icone.svg': {f: ['icone.svg'], cache: 'public, max-age=86400'},
  '/anton.woff2': {f: ['polices', 'anton-400.woff2'], cache: 'public, max-age=604800'},
  '/geist-mono.woff2': {f: ['polices', 'geist-mono-500.woff2'], cache: 'public, max-age=604800'},
};

/** Le port demandé par DERUSH_TELEPHONE_PORT (0 : un port libre, pour les essais), sinon celui de Dérush. */
function portVoulu() {
  const v = process.env.DERUSH_TELEPHONE_PORT;
  const p = Number(v);
  return v !== undefined && v !== '' && Number.isInteger(p) && p >= 0 && p < 65536 ? p : PORT_TELEPHONE;
}

/**
 * La porte du téléphone. `source` dit ce que le téléphone voit et fait (voir sourceDerush, plus bas) :
 *   etat() → ce qu'affiche la page · image(genre, a, b) → un fichier du direct · video(nom) → {chemin, nom}
 *   affiche(nom) → l'image d'une vidéo · ecrire(texte) · arreter()
 * `eveil(secondes)` garde l'ordinateur éveillé pendant qu'un téléphone regarde (lib/plateforme.mjs).
 * Les essais donnent leur propre source, leur fichier de réglages, le port 0 et l'hôte 127.0.0.1 (ou les variables
 * DERUSH_TELEPHONE_PORT et DERUSH_TELEPHONE_HOTE, quand c'est le serveur de Dérush qui crée la porte) : ils n'ouvrent
 * jamais rien sur le réseau.
 */
export function creerTelephone({source, fichier = path.join(dossierSupport(), 'telephone.json'), port = portVoulu(), hote = process.env.DERUSH_TELEPHONE_HOTE || '0.0.0.0', cartes = () => os.networkInterfaces(), maintenant = () => Date.now(), eveil = garderEveillePendant} = {}) {
  let R = lireReglage(fichier);
  let serveur = null;
  let portEcoute = null;
  let erreur = null;
  let sortie = null; // l'adresse par où l'ordinateur sort vers Internet (relue à chaque ouverture de la fenêtre)
  let jumelage = null; // {code, chiffres, expire, essais, demandes: Map(moi → {id, moi, nom, depuis, vu})}
  const acceptes = new Map(); // moi → {jeton, nom, le} : le jeton attend son téléphone, deux minutes
  const refuses = new Map(); // moi → quand
  const enLigne = new Map(); // id d'appareil → dernier signe
  const refus = new Map(); // adresse → {n, depuis}
  let ecritLe = 0;
  let eveilLe = 0; // la dernière fois que l'ordinateur a été gardé éveillé pour un téléphone
  const eveils = new Set(); // ce qui le garde éveillé en ce moment (arrêté quand la porte se ferme)
  // la clé des billets : tirée à chaque lancement de Dérush, jamais écrite nulle part
  const cleBillets = crypto.randomBytes(32);
  const signer = (texte) => crypto.createHmac('sha256', cleBillets).update(texte).digest('base64url').slice(0, 32);
  /**
   * Le billet d'un téléphone : ce que portent les adresses de ses images et de ses vidéos (une balise ne peut pas
   * envoyer d'en-tête). Il ne sert qu'à lire ces fichiers, jamais à écrire, et change toutes les six heures.
   */
  const billet = (a) => { const fin = Math.floor(maintenant() / TRANCHE) + 2; return `${a.id}.${fin}.${signer(`${a.id}.${fin}`)}`; };
  function parBillet(b) {
    const m = /^([a-f0-9]{6,24})\.(\d{1,8})\.([\w-]{32})$/.exec(String(b ?? ''));
    if (!m || Number(m[2]) * TRANCHE <= maintenant() || !meme(m[3], signer(`${m[1]}.${m[2]}`))) return null;
    return R.appareils.find((a) => a.id === m[1]) ?? null;
  }

  const ecrire = () => { try { fs.mkdirSync(path.dirname(fichier), {recursive: true}); ecrireJson(fichier, R); try { fs.chmodSync(fichier, 0o600); } catch { /* Windows : les droits du dossier personnel */ } } catch { /* disque plein : gardé pour ce lancement */ } };
  const jumelageValide = () => { if (jumelage && maintenant() > jumelage.expire) jumelage = null; return jumelage; };
  const menage = () => {
    const t = maintenant();
    for (const [k, v] of acceptes) if (t - v.le > 120e3) acceptes.delete(k);
    for (const [k, v] of refuses) if (t - v > 600e3) refuses.delete(k);
    for (const [k, v] of refus) if (t - v.depuis > 600e3) refus.delete(k);
    const j = jumelageValide();
    // un téléphone qui a demandé puis refermé sa page ne reste pas à l'écran
    if (j) for (const [k, d] of j.demandes) if (t - d.vu > 12e3) j.demandes.delete(k);
  };
  const compterRefus = (ip) => { if (refus.size > 400) menage(); const r = refus.get(ip); if (!r || maintenant() - r.depuis > 600e3) refus.set(ip, {n: 1, depuis: maintenant()}); else r.n++; };
  const tropDeRefus = (ip) => { const r = refus.get(ip); return !!r && maintenant() - r.depuis <= 600e3 && r.n > REFUS_MAX; };

  /** Le téléphone qui porte ce jeton, ou null. */
  function reconnaitre(jeton) {
    if (typeof jeton !== 'string' || jeton.length < 30 || jeton.length > 80) return null;
    const e = Buffer.from(sha(jeton), 'hex');
    let trouve = null;
    for (const a of R.appareils) if (crypto.timingSafeEqual(e, Buffer.from(a.empreinte, 'hex'))) trouve = a;
    return trouve;
  }
  function noterVu(a) {
    const t = maintenant();
    enLigne.set(a.id, t);
    // la date du dernier passage de chacun : écrite sur le disque une fois par minute au plus
    a.vu_le = new Date(t).toISOString();
    if (t - ecritLe > 60e3) { ecritLe = t; ecrire(); }
    // Un téléphone regarde : l'ordinateur ne s'endort pas (sinon cette page ne répondrait plus), et reste éveillé une
    // demi-heure après son dernier coup d'œil. Renouvelé toutes les cinq minutes au plus.
    if (t - eveilLe > 5 * 60e3) {
      eveilLe = t;
      try { const p = eveil(EVEIL); if (p) { eveils.add(p); p.once?.('exit', () => eveils.delete(p)); } } catch { /* sans garde-éveil */ }
    }
  }

  /** Un téléphone qui a le code demande à être relié : il attend le clic fait sur l'ordinateur. */
  function demander({code, chiffres, moi, ip, ua}) {
    menage();
    const pret = acceptes.get(moi);
    if (pret) return {etat: 'relie', jeton: pret.jeton, nom: pret.nom};
    if (refuses.has(moi)) return {etat: 'refuse'};
    const j = jumelageValide();
    if (!j) return {etat: 'perime'};
    // un téléphone dont la demande est déjà là (elle a été faite avec le bon code) est reconnu par son identifiant seul :
    // sa page peut se recharger pendant qu'il attend
    let d = j.demandes.get(moi);
    if (!d) {
      const parCode = typeof code === 'string' && meme(code, j.code);
      const parChiffres = !parCode && typeof chiffres === 'string' && meme(chiffres.replace(/\D/g, ''), j.chiffres);
      if (!parCode && !parChiffres) {
        compterRefus(ip);
        if (typeof chiffres === 'string' && ++j.essais >= ESSAIS_CHIFFRES) jumelage = null;
        return {etat: 'inconnu'};
      }
      if (j.demandes.size >= 3) return {etat: 'occupe'};
      // `nombre` : affiché sur le téléphone ET sur l'ordinateur, pour être sûr de relier le bon
      d = {id: crypto.randomBytes(6).toString('hex'), moi, nom: nomAppareil(ua), nombre: String(crypto.randomInt(10, 100)), depuis: maintenant(), vu: maintenant()};
      j.demandes.set(moi, d);
    }
    d.vu = maintenant();
    return {etat: 'attente', nom: d.nom, nombre: d.nombre};
  }

  async function traiter(req, res) {
    const ip = String(req.socket.remoteAddress ?? '').replace(/^::ffff:/i, '');
    // jamais Internet : seulement une adresse d'un réseau privé
    if (!adressePrivee(ip)) throw new Refus(403, 'Dérush ne répond qu’au réseau local.');
    // l'adresse demandée est celle de l'ordinateur (des chiffres, ou son nom sur le réseau), jamais le nom d'un site
    const hoteDemande = String(req.headers.host ?? '').replace(/:\d+$/, '');
    if (!octets(hoteDemande) && hoteDemande !== 'localhost' && !/^[a-z0-9-]{1,63}\.local$/i.test(hoteDemande)) throw new Refus(403, 'Adresse refusée.');
    if (tropDeRefus(ip)) throw new Refus(429, 'Trop d’essais : attends quelques minutes.');
    let url;
    try { url = new URL(req.url, 'http://telephone'); } catch { throw new Refus(400, 'Adresse illisible.'); }
    const p = url.pathname;
    const lecture = req.method === 'GET' || req.method === 'HEAD';

    // — la page : aucun secret dedans, elle est la même pour tout le monde —
    if (lecture && STATIQUES[p]) {
      const s = STATIQUES[p];
      return envoyerFichier(req, res, path.join(PUBLIC, ...s.f), {cache: s.cache ?? 'no-store'});
    }
    if (lecture && p === '/api/ping') return envoyerJson(res, 200, {derush: true, telephone: true});
    if (req.method === 'POST' && p === '/api/jumeler') {
      const {code = null, chiffres = null, moi = null} = await lireCorps(req);
      if (typeof moi !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(moi)) throw new Refus(400, 'Demande incomplète.');
      return envoyerJson(res, 200, demander({code, chiffres, moi, ip, ua: req.headers['user-agent']}));
    }

    // — tout le reste : un téléphone relié. Son jeton voyage en en-tête, jamais dans une adresse ; une image ou une vidéo
    // (une balise ne peut pas envoyer d'en-tête) porte son billet, qui ne vaut que pour elles —
    const fichier = lecture && /^\/(image|video|affiche)\//.test(p);
    const appareil = fichier ? parBillet(url.searchParams.get('k')) ?? reconnaitre(req.headers['x-derush-telephone']) : reconnaitre(req.headers['x-derush-telephone']);
    if (!appareil) { compterRefus(ip); throw new Refus(401, 'Ce téléphone n’est pas relié.'); }
    noterVu(appareil);
    let x;
    if (lecture && p === '/api/etat') {
      const e = {version: VERSION, appareil: appareil.nom, peut: {ecrire: R.ecrire}, billet: billet(appareil), ...(await source.etat())};
      // « v » : l'empreinte de ce qui s'affiche, sans le chrono (il avance tout seul). La page qui a déjà cet état ne
      // reçoit qu'un « pareil ».
      const v = sha(JSON.stringify(e, (k, val) => (k === 'depuis_s' ? undefined : val))).slice(0, 16);
      if (url.searchParams.get('v') === v) return envoyerJson(res, 200, {pareil: true, v, depuis_s: e.travail?.depuis_s ?? null});
      return envoyerJson(res, 200, {...e, v});
    }
    if (lecture && (x = /^\/image\/direct\/([\w-]{1,80})\/(f-\d{5}\.jpg)$/.exec(p))) {
      const f = await source.image('direct', x[1], x[2]);
      if (!f) throw new Refus(404, 'Image introuvable.');
      return envoyerFichier(req, res, f, {cache: 'private, max-age=3600'});
    }
    if (lecture && p === '/image/projet') {
      const f = await source.image('projet');
      if (!f) throw new Refus(404, 'Image introuvable.');
      return envoyerFichier(req, res, f, {cache: 'private, max-age=600'});
    }
    if (lecture && (x = /^\/image\/vue\/(\d{1,6})$/.exec(p))) {
      const f = await source.image('vue', x[1]);
      if (!f) throw new Refus(404, 'Image introuvable.');
      return envoyerFichier(req, res, f, {type: TYPES[path.extname(f).toLowerCase()] ?? 'image/jpeg', cache: 'private, max-age=600'});
    }
    if (lecture && (x = /^\/(video|affiche)\/([^/]{1,200})$/.exec(p))) {
      let nom = null;
      try { nom = decodeURIComponent(x[2]); } catch { /* adresse mal écrite */ }
      if (x[1] === 'affiche') {
        const f = nom ? await source.affiche(nom) : null;
        if (!f) throw new Refus(404, 'Pas d’image.');
        return envoyerFichier(req, res, f, {cache: 'private, max-age=600'});
      }
      const v = nom ? await source.video(nom) : null;
      if (!v) throw new Refus(404, 'Vidéo introuvable.');
      return envoyerFichier(req, res, v.chemin, {type: 'video/mp4', cache: 'private, no-cache', telecharger: url.searchParams.get('dl') === '1' ? v.nom : null});
    }
    if (req.method === 'POST' && p === '/api/ecrire') {
      if (!R.ecrire) throw new Refus(403, 'Sur l’ordinateur, ce téléphone a seulement le droit de regarder.');
      const {message = ''} = await lireCorps(req);
      if (typeof message !== 'string' || !message.trim()) throw new Refus(400, 'Écris d’abord ton message.');
      try { return envoyerJson(res, 200, await source.ecrire(message.trim())); } catch (e) { throw new Refus(409, String(e?.message ?? e).slice(0, 400)); }
    }
    if (req.method === 'POST' && p === '/api/arreter') {
      if (!R.ecrire) throw new Refus(403, 'Sur l’ordinateur, ce téléphone a seulement le droit de regarder.');
      await lireCorps(req);
      return envoyerJson(res, 200, {ok: !!(await source.arreter())});
    }
    // « Ne plus suivre sur ce téléphone » : il se retire lui-même
    if (req.method === 'POST' && p === '/api/oublier') {
      await lireCorps(req);
      retirer(appareil.id);
      return envoyerJson(res, 200, {ok: true});
    }
    throw new Refus(404, 'Introuvable.');
  }

  function ecouter() {
    if (serveur) return Promise.resolve(true);
    erreur = null;
    const s = http.createServer((req, res) => { traiter(req, res).catch((e) => repondreErreur(res, e)); });
    s.maxConnections = 96;
    s.headersTimeout = 15e3;
    return new Promise((ok) => {
      const essayer = (pt, reste) => {
        const surErreur = (e) => {
          if (e.code === 'EADDRINUSE' && reste > 0 && pt !== 0) return essayer(pt + 1, reste - 1);
          erreur = e.code === 'EADDRINUSE' ? 'Un autre programme occupe déjà la porte du téléphone.' : 'Dérush n’a pas pu s’ouvrir au réseau de cet ordinateur.';
          ok(false);
        };
        s.once('error', surErreur);
        s.listen(pt, hote, () => {
          s.removeListener('error', surErreur);
          s.on('error', () => { /* une coupure du réseau ne fait pas tomber Dérush */ });
          serveur = s;
          portEcoute = s.address().port;
          if (port !== 0 && R.port !== portEcoute) { R.port = portEcoute; ecrire(); }
          ok(true);
        });
      };
      essayer(port === 0 ? 0 : R.port ?? port, 10);
    });
  }
  function fermer() {
    const s = serveur;
    serveur = null;
    portEcoute = null;
    jumelage = null;
    enLigne.clear();
    // la porte fermée, plus rien ne retient l'ordinateur éveillé
    for (const p of eveils) { try { p.kill?.(); } catch { /* déjà parti */ } }
    eveils.clear();
    eveilLe = 0;
    if (!s) return Promise.resolve();
    return new Promise((ok) => { s.close(() => ok()); s.closeAllConnections?.(); });
  }

  /** Les téléphones qu'on n'a pas revus depuis deux mois (changés, réinitialisés, reliés une seule fois) s'en vont. */
  function oublierLesAnciens() {
    const t = maintenant();
    const gardes = R.appareils.filter((a) => { const vu = Date.parse(a.vu_le ?? a.relie_le ?? ''); return !Number.isFinite(vu) || t - vu < OUBLI; });
    if (gardes.length !== R.appareils.length) { R.appareils = gardes; ecrire(); }
  }
  /** Au lancement de Dérush : la porte se rouvre si la personne l'avait laissée allumée. */
  async function demarrer() { oublierLesAnciens(); if (R.actif) await ecouter(); return etat(); }
  async function allumer() {
    oublierLesAnciens();
    R.actif = true;
    ecrire();
    await ecouter();
    return etat();
  }
  async function eteindre() {
    R.actif = false;
    ecrire();
    await fermer();
    return etat();
  }
  /** Un nouveau code à scanner (l'ancien ne vaut plus rien). La porte doit être allumée. */
  async function ouvrirJumelage() {
    if (!serveur) throw new Error('Allume d’abord le suivi sur téléphone.');
    sortie = await adresseDeSortie();
    jumelage = {code: crypto.randomBytes(16).toString('base64url'), chiffres: String(crypto.randomInt(0, 1e6)).padStart(6, '0'), expire: maintenant() + DUREE_CODE, essais: 0, demandes: new Map()};
    return etat();
  }
  function fermerJumelage() { jumelage = null; return etat(); }
  /** Le clic fait sur l'ordinateur : relier ce téléphone, ou le refuser. */
  function repondre(id, accepter) {
    menage();
    const j = jumelageValide();
    const d = j ? [...j.demandes.values()].find((x) => x.id === id) : null;
    if (!d) throw new Error('Cette demande n’est plus là : scanne de nouveau le code avec ton téléphone.');
    j.demandes.delete(d.moi);
    if (!accepter) { refuses.set(d.moi, maintenant()); return etat(); }
    const jeton = crypto.randomBytes(32).toString('base64url');
    // deux « iPhone · Safari » : le second porte un numéro
    const pris = new Set(R.appareils.map((a) => a.nom));
    let nom = d.nom;
    for (let k = 2; pris.has(nom); k++) nom = `${d.nom} (${k})`;
    R.appareils = [...R.appareils, {id: crypto.randomBytes(6).toString('hex'), nom, empreinte: sha(jeton), relie_le: new Date(maintenant()).toISOString(), vu_le: null}].slice(-MAX_APPAREILS);
    ecrire();
    acceptes.set(d.moi, {jeton, nom, le: maintenant()});
    jumelage = null; // le code a servi : il ne vaut plus rien
    return etat();
  }
  function retirer(id) {
    R.appareils = R.appareils.filter((a) => a.id !== id);
    enLigne.delete(id);
    ecrire();
    return etat();
  }
  /** Les réglages : `ecrire` (le téléphone peut écrire à l'IA et l'arrêter), `adresse` (une autre adresse de l'ordinateur). */
  function regler({ecrire: e, adresse} = {}) {
    if (typeof e === 'boolean') R.ecrire = e;
    if (adresse === null || octets(adresse)) R.adresse = adresse;
    ecrire();
    return etat();
  }

  /** Ce que la fenêtre de l'ordinateur affiche. Jamais un jeton : seulement le code à scanner, tant qu'il vaut. */
  function etat() {
    menage();
    const adr = adressesLocales(sortie, cartes());
    const choisie = adr.find((a) => a.ip === R.adresse) ?? adr[0] ?? null;
    const base = choisie && portEcoute ? `http://${choisie.ip}:${portEcoute}` : null;
    const j = jumelageValide();
    const lien = j && base ? `${base}/#j=${j.code}` : null;
    const t = maintenant();
    return {
      actif: R.actif, ecoute: !!serveur, port: portEcoute, erreur, ecrire: R.ecrire,
      adresses: adr, adresse: choisie?.ip ?? null, court: base ? base.replace(/^http:\/\//, '') : null,
      jumelage: lien ? {lien, chiffres: j.chiffres, qr: cheminQr(lien), expire_dans_s: Math.max(0, Math.round((j.expire - t) / 1000))} : null,
      demandes: j ? [...j.demandes.values()].map((d) => ({id: d.id, nom: d.nom, nombre: d.nombre, depuis_s: Math.round((t - d.depuis) / 1000)})) : [],
      appareils: R.appareils.map((a) => ({id: a.id, nom: a.nom, relie_le: a.relie_le, vu_le: a.vu_le, en_ligne: t - (enLigne.get(a.id) ?? 0) < 12e3})),
      en_ligne: R.appareils.filter((a) => t - (enLigne.get(a.id) ?? 0) < 12e3).length,
    };
  }
  /** Le résumé pour la barre du haut : allumé ? combien de téléphones regardent en ce moment ? */
  const resume = () => { const t = maintenant(); return {actif: !!serveur, en_ligne: R.appareils.filter((a) => t - (enLigne.get(a.id) ?? 0) < 12e3).length}; };

  return {etat, resume, demarrer, allumer, eteindre, fermer, ouvrirJumelage, fermerJumelage, repondre, retirer, regler, get port() { return portEcoute; }};
}

// ——— ce que le téléphone voit de Dérush ———
/** Ce que l'IA est en train de faire, dit simplement (la même phrase que dans la fenêtre de l'ordinateur). */
export function phraseGeste(a, qui = 'L’IA') {
  if (!a) return `${qui} ouvre ton dossier`;
  const t = String(a.texte ?? '').toLowerCase();
  if (a.icone === 'globe') return `${qui} publie ta vidéo`;
  if (a.icone === 'cube') return `${qui} travaille en 3D`;
  if (a.icone === 'onde') return `${qui} crée le son`;
  if (a.icone === 'film' && /rend/.test(t)) return `${qui} fabrique la vidéo`;
  if (a.icone === 'crayon') return `${qui} écrit le montage`;
  if (a.icone === 'loupe') return `${qui} se renseigne`;
  if (a.icone === 'nuage') return `${qui} regarde ton Drive`;
  if (a.icone === 'oeil' || /vérif|contrôl|mesur|regard|compar/.test(t)) return `${qui} regarde et vérifie`;
  if (/compétence/.test(t)) return `${qui} relit ses fiches de montage`;
  if (a.icone === 'bulle') return `${qui} réfléchit`;
  return `${qui} monte ta vidéo`;
}
const court = (t, n) => { const s = String(t ?? ''); return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s; };

/**
 * Le travail en cours, pour la page du téléphone : l'étape, une phrase, la jauge, l'image du direct, les derniers gestes.
 * `d` : ce que rend etatDemande (lib/claude.mjs) ; `noms` : {ia: {claude: {nom}}, qualites: {max: {nom}}} ;
 * `aDesPlans` : la timeline du projet a déjà des plans.
 */
export function travailPourTelephone(d, {noms = {}, aDesPlans = false} = {}) {
  const e = d?.en_cours;
  if (!e) return null;
  const qui = noms.ia?.[e.moteur]?.nom ?? 'L’IA';
  const r = e.direct?.rendus?.at(-1) ?? null;
  const enRendu = !!r && !['fini', 'erreur'].includes(r.etape);
  const pctRendu = r?.total ? Math.min(100, Math.round((100 * (r.rendues ?? 0)) / r.total)) : 0;
  const etape = e.etape === 'preparation' ? 'preparation' : e.etape === 'livraison' ? 'livraison' : enRendu ? 'rendu' : 'ia';
  const titre = e.arret ? 'Arrêt en cours…'
    : etape === 'preparation' ? (aDesPlans ? 'Dérush prépare tes plans' : 'Dérush prépare tes rushes')
      : etape === 'livraison' ? (e.reponse ? `${qui} a fini : Dérush vérifie la vidéo` : 'Dérush récupère tes vidéos')
        : enRendu ? (r.etape === 'assemblage' ? `${qui} prépare le rendu` : r.etape === 'son' ? `${qui} mixe le son` : `${qui} fabrique la vidéo`)
          : phraseGeste(e.activite?.at(-1), qui);
  const pct = etape === 'preparation' ? Math.max(4, Math.round((e.progression ?? 0) * 100)) : enRendu && r.etape === 'rendu' ? Math.max(3, pctRendu) : null;
  // l'image : la dernière image rendue, ou celle que l'IA regarde si elle est plus récente
  const vue = e.direct?.vues?.at(-1) ?? null;
  const debut = Date.now() - (e.depuis_s ?? 0) * 1000;
  const vuePlusRecente = !!vue && (!r || !enRendu) && (!r?.fin || vue.t * 1000 + debut > Date.parse(r.fin));
  const image = r?.images?.length && !vuePlusRecente
    ? {src: `/image/direct/${encodeURIComponent(r.id)}/f-${String(r.images.at(-1)).padStart(5, '0')}.jpg`, direct: enRendu, legende: court(`${enRendu ? 'En direct' : 'Dernier rendu'}${r.titre ? ` · ${r.titre}` : ''}`, 80), largeur: r.largeur ?? null, hauteur: r.hauteur ?? null}
    : vue ? {src: `/image/vue/${vue.n}`, direct: false, legende: court(`${qui} regarde « ${vue.nom} »`, 80), largeur: null, hauteur: null} : null;
  // les messages écrits pendant ce travail : lus, en route, ou gardés pour la fin
  const messages = (e.messages ?? []).map((m) => ({quand: m.quand, etat: m.lu ? 'lu' : m.apres ? 'apres' : e.ecoute ? 'bientot' : 'apres'}));
  return {
    etape, titre, pct, depuis_s: e.depuis_s ?? 0, habituel_s: e.habituel_s ?? null, arret: !!e.arret, ecoute: !!e.ecoute,
    ia: e.moteur ?? null, nom_ia: qui, niveau: noms.qualites?.[e.qualite]?.nom ?? null, publication: !!e.publier,
    rendu: enRendu && r.total ? {titre: r.titre ?? null, pct: pctRendu} : null,
    image,
    gestes: (e.activite ?? []).slice(-8).map((a) => ({icone: String(a.icone ?? ''), texte: court(a.texte, 160), parole: a.icone === 'bulle'})),
    n_gestes: e.n_activite ?? (e.activite ?? []).length,
    reponse: e.reponse ? court(e.reponse, 6000) : null,
    messages,
  };
}
/** La conversation, pour le téléphone : les derniers échanges, sans rien de l'ordinateur (ni chemins, ni pièces). */
export function filPourTelephone(d, {noms = {}, max = 14} = {}) {
  const etats = new Map((d?.en_cours?.messages ?? []).map((m) => [m.quand, m.lu ? 'lu' : m.apres || !d.en_cours.ecoute ? 'apres' : 'bientot']));
  return (d?.echanges ?? []).slice(-max).map((x) => {
    const humain = x.role === 'humain';
    return {
      de: humain ? 'moi' : 'ia', ...(humain ? {} : {ia: x.moteur ?? 'claude', nom_ia: noms.ia?.[x.moteur ?? 'claude']?.nom ?? 'L’IA'}),
      texte: court(x.texte, 6000), quand: x.quand ?? null,
      ...(x.duree_s ? {duree_s: x.duree_s} : {}), ...(x.erreur ? {erreur: true} : {}), ...(x.arret ? {arret: true} : {}), ...(x.version ? {version: x.version} : {}),
      ...(humain && x.pendant ? {pendant: etats.get(x.quand) ?? 'lu'} : {}), ...(humain && x.pieces?.length ? {pieces: x.pieces.length} : {}),
    };
  });
}

/**
 * La source de Dérush pour la porte du téléphone. `ctx` : le contexte du serveur ({P, file, projetVivant}). Le téléphone
 * suit le projet où l'IA travaille (même refermé sur l'ordinateur), sinon le projet ouvert.
 */
export function sourceDerush(ctx) {
  const modules = Promise.all([import('./claude.mjs'), import('./ia.mjs'), import('./publication.mjs')]);
  const projetSuivi = (C) => {
    for (const racine of C.projetsAuTravail()) { const P = ctx.projetVivant?.(racine) ?? (ctx.P?.racine === racine ? ctx.P : null); if (P) return P; }
    return ctx.P ?? null;
  };
  // la liste des vidéos lit plusieurs petits fichiers : gardée trois secondes (le téléphone relit l'état chaque seconde)
  let videosVues = {cle: null, liste: []};
  const videosDe = (Pub, P, d) => {
    const cle = `${P.racine}\n${(d.versions ?? []).length}\n${Math.floor(Date.now() / 3000)}`;
    if (videosVues.cle !== cle) {
      const descriptions = new Map((d.versions ?? []).flatMap((v) => (v.videos ?? []).map((x) => [x.nom, x.description ?? v.description ?? null])));
      let liste = [];
      try { liste = Pub.listerVideos(P); } catch { /* dossier illisible : pas de vidéo à montrer */ }
      videosVues = {cle, liste: liste.slice(0, 12).map((x) => ({
        nom: x.nom, titre: court(x.titre ?? P.d.titre, 80), origine: x.origine, version: x.version ?? null, description: descriptions.get(x.nom) ? court(descriptions.get(x.nom), 300) : null,
        duree: x.duree ?? null, largeur: x.largeur ?? null, hauteur: x.hauteur ?? null, taille_lisible: x.taille_lisible, le: x.modifie_le,
        src: `/video/${encodeURIComponent(x.nom)}`, affiche: `/affiche/${encodeURIComponent(x.nom)}`,
      }))};
    }
    return videosVues.liste;
  };
  /** Le fichier d'une vidéo du projet suivi : seulement un .mp4 de son dossier « vidéos », par son simple nom. */
  const fichierVideo = (P, nom) => {
    if (!P || typeof nom !== 'string' || path.basename(nom) !== nom || !/\.mp4$/i.test(nom)) return null;
    const f = path.join(P.racine, 'vidéos', nom);
    // un vrai fichier, jamais un lien vers un autre endroit du disque (un projet reçu peut en contenir)
    try { return fs.lstatSync(f).isFile() ? f : null; } catch { return null; }
  };
  const affichesEnCours = new Map();

  return {
    async etat() {
      const [C, I, Pub] = await modules;
      const P = projetSuivi(C);
      const ordinateur = nomOrdinateur();
      const rien = {ordinateur, projet: null, travail: null, file: null, fil: [], videos: []};
      if (!P) return rien;
      let d;
      // un projet devenu illisible (parti à la corbeille, disque débranché) : « aucun projet », pas une panne
      try { d = C.etatDemande(P); } catch { return rien; }
      const noms = {ia: I.IA, qualites: I.QUALITES};
      // la file de Dérush (préparation des rushes, création d'une vidéo, export) : ce qui tourne, et ce qui attend
      const f = ctx.file?.etat?.() ?? null;
      const tache = f?.en_cours ? {nom: court(f.en_cours.nom, 90), pct: Math.round((f.en_cours.progression ?? 0) * 100), attente: f.attente?.length ?? 0} : null;
      const sortie = P.d.sortie ?? {};
      return {
        ordinateur,
        projet: {titre: court(P.d.titre, 80), largeur: sortie.largeur ?? null, hauteur: sortie.hauteur ?? null, ouvert: ctx.P === P, rushes: P.d.medias?.length ?? 0,
          affiche: fs.existsSync(path.join(P.cache, 'affiche.jpg')) ? '/image/projet' : null},
        travail: travailPourTelephone(d, {noms, aDesPlans: !!P.d.montage?.length}),
        file: tache,
        fil: filPourTelephone(d, {noms}),
        videos: videosDe(Pub, P, d),
        ia: {nom: I.IA[d.moteur]?.nom ?? null},
      };
    },
    /** Une image : celle d'un rendu de l'IA (« direct »), celle qu'elle regarde (« vue »), ou l'affiche du projet. */
    async image(genre, a, b) {
      const [C] = await modules;
      const P = projetSuivi(C);
      if (!P) return null;
      if (genre === 'projet') { const f = path.join(P.cache, 'affiche.jpg'); return fs.existsSync(f) ? f : null; }
      return genre === 'direct' ? C.fichierDirect(P, a, b) : C.fichierVue(P, a);
    },
    async video(nom) {
      const [C] = await modules;
      const f = fichierVideo(projetSuivi(C), nom);
      return f ? {chemin: f, nom} : null;
    },
    /** L'image d'une vidéo : la couverture choisie dans « Partager », sinon une image prise au tiers de la vidéo. */
    async affiche(nom) {
      const [C, , Pub] = await modules;
      const P = projetSuivi(C);
      const video = fichierVideo(P, nom);
      if (!video) return null;
      const couverture = Pub.fichierCouverture(P, nom);
      if (fs.existsSync(couverture)) return couverture;
      const st = fs.statSync(video);
      const D = path.join(P.cache, 'telephone');
      const sortie = path.join(D, `affiche-${crypto.createHash('sha1').update(`${nom}\n${st.size}\n${Math.round(st.mtimeMs)}`).digest('hex').slice(0, 16)}.jpg`);
      if (fs.existsSync(sortie)) return sortie;
      // une seule fabrication à la fois par image (le téléphone en demande plusieurs d'un coup)
      const deja = affichesEnCours.get(sortie);
      if (deja) return deja;
      const duree = videosVues.liste.find((x) => x.nom === nom)?.duree ?? 0;
      const fabrication = (async () => {
        fs.mkdirSync(D, {recursive: true});
        const tmp = `${sortie}.${crypto.randomBytes(4).toString('hex')}.part.jpg`;
        try {
          for (const t of [Math.min(8, duree * 0.3), 0]) {
            try { await ffmpeg(['-y', '-ss', t.toFixed(2), '-i', video, '-frames:v', '1', '-vf', "scale='min(720,iw)':-2", '-q:v', '4', tmp]); } catch { /* pas d'image à cet instant : on essaie le début */ }
            if (fs.existsSync(tmp)) break;
          }
          if (!fs.existsSync(tmp)) return null;
          fs.renameSync(tmp, sortie);
          // pas d'empilement : les vingt-quatre images les plus récentes suffisent
          try {
            const toutes = fs.readdirSync(D).filter((n) => /^affiche-[a-f0-9]{16}\.jpg$/.test(n)).map((n) => ({n, t: fs.statSync(path.join(D, n)).mtimeMs})).sort((x, y) => y.t - x.t);
            for (const v of toutes.slice(24)) fs.rmSync(path.join(D, v.n), {force: true});
          } catch { /* le ménage attendra */ }
          return sortie;
        } finally { fs.rmSync(tmp, {force: true}); affichesEnCours.delete(sortie); }
      })();
      affichesEnCours.set(sortie, fabrication);
      return fabrication;
    },
    /** Un message du téléphone : lu en route si l'IA travaille, sinon une nouvelle demande, à la suite de la conversation. */
    async ecrire(texte) {
      const [C] = await modules;
      const P = projetSuivi(C);
      if (!P) throw new Error('Aucun projet n’est ouvert sur ton ordinateur.');
      if (C.travailleSur(P)) { const r = C.ajouterMessage(P, texte); return {ok: true, pendant: true, lu_en_route: !!r.lu_en_route}; }
      // avec l'IA et le niveau choisis sur l'ordinateur ; elle repart de son dossier de travail s'il existe
      const r = await C.demander(P, {message: texte, file: ctx.file});
      return {ok: true, lance: true, ia: r.moteur ?? null};
    },
    async arreter() {
      const [C] = await modules;
      const P = projetSuivi(C);
      return P ? C.arreterDemande(P) : false;
    },
  };
}
