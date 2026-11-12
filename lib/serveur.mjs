// Dérush — serveur local (127.0.0.1 seulement). Il sert l'interface, lit les rushes et lance les traitements.
// Toute requête porte le jeton de la session : une page web étrangère ne peut rien demander au serveur.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {VERSION, EXT_MEDIAS, EXT_VIDEOS, EXT_SONS, EXT_IMAGES, nouvelId} from './commun.mjs';
import {POLICE, lancer, lireJson, ecrireJson, arreterEnfants} from './outils.mjs';
import {ajouterMedia, ajouterMedias, retirerMedia, preparer, fichierLecture, isolerVoix} from './medias.mjs';
import {moteurs, transcrire, lireFichierTranscription, enregistrer} from './transcription.mjs';
import {etatMoteurs, installer, etatBlender, oublierBlender} from './moteurs.mjs';
import {exporterPack} from './pack.mjs';
import {creerVideo, etatRendu, installerRendu} from './rendu.mjs';
import {masquesMedia, dossierMasques} from './detourage.mjs';
import {etatElevenLabs, brancherElevenLabs, credits, listerVoix, STUDIO, MODELES_IMAGE, MODELES_VIDEO, LANGUES_DOUBLAGE, listerCreations, nouvelleCreation, lancerCreation, retirerCreation, etatBruitages, lancerBruitages, retirerBruitages, bruitageElevenLabs} from './elevenlabs.mjs';
import {MODELES, EFFORTS, QUALITES, RESEAUX, etatClaude, etatCodex, etatIA, claudeTravaille, etatDemande, demander, arreterDemande, arreterToutesLesDemandes, oublierDemande, decoupeDeClaude, synchroniserDemande, fichierDirect, fichierVue} from './claude.mjs';
import {IA, installerClaude, connecterClaude, lancerInstallationCodex, connecterCodex, installerGemini, connecterGemini, etatGemini, actionEnCours, oublierEtats} from './ia.mjs';
import {etatTreg, changerTreg, enregistrerJetonTreg, retirerJetonTreg, verifierTreg} from './treg.mjs';
import {etatProfil, lancerProfil, arreterProfil, changerProfil, effacerProfil} from './createur.mjs';
import {listerVideos, lancerAnalyse, etatAnalyse, arreterAnalyse, lancerPlan, etatPlan, arreterPlan, enregistrerPlan, textesDuPlan, fichierPlanche, publicationEnCours} from './publication.mjs';
import {arreterConseils} from './conseil.mjs';
import {etatSons, changerSons, dossierSons, telechargerRealSfx, installerEarshot, verifierEarshot, oublierEarshot} from './sons.mjs';
import {lireReglages, changerReglages} from './reglages.mjs';
import {listerCompetences, remotionPresent, telechargerRemotion} from './competences.mjs';
import {etatMaj, verifierMaj, mettreAJour, redemarrer} from './maj.mjs';
import {installerBlender} from './installation.mjs';
import {ROLES, piece, listerPieces, ajouterPieces, televerserPiece, retirerPiece, changerRole, cheminApercu} from './pieces.mjs';
import {etatDrive, changerDrive, envoyerSurDrive, dossiersDrive} from './drive.mjs';
import {choisirFichiers as choisirSysteme, montrer, ouvrir as ouvrirSysteme, dossierSupport, NOM_SYSTEME, SYSTEME} from './plateforme.mjs';
import {lireRetours, marquerRetour} from './retours.mjs';
import {RACINE_BIBLIO, listerProjets, creerDossierProjet, mettreALaCorbeille} from './bibliotheque.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ICI, '..', 'public');

/** Le fichier voulu ? Même nom, même taille, même date (à 2 s près). */
function memeFichier(c, voulu, taille, modifie) {
  if (path.basename(c).normalize('NFC') !== voulu) return false;
  try {
    const st = fs.statSync(c);
    return st.isFile() && st.size === Number(taille) && (!modifie || Math.abs(st.mtimeMs - Number(modifie)) <= 2000);
  } catch {
    return false;
  }
}

/** Les dossiers où l'on range d'habitude ses rushes, puis les disques externes (sans les dossiers synchronisés). */
function dossiersProbables() {
  const maison = ['Movies', 'Desktop', 'Downloads', 'Documents', 'Pictures'].map((d) => path.join(os.homedir(), d)).filter((d) => fs.existsSync(d));
  let volumes = [];
  try { volumes = fs.readdirSync('/Volumes').map((v) => path.join('/Volumes', v)).filter((v) => { try { return fs.realpathSync(v) !== '/'; } catch { return false; } }); } catch { /* pas de disque externe */ }
  return {maison, volumes};
}
const DOSSIERS_IGNORES = /^(Library|node_modules|\.git|__pycache__|CodexBuilds|DerivedData|Pods|venv|\.venv)$|\.(app|photoslibrary|fcpbundle|imovielibrary|musiclibrary|tvlibrary|bundle|framework)$/i;

/**
 * Sans Spotlight (dossier non indexé) : une seule exploration, en largeur (les dossiers proches d'abord),
 * pour tous les fichiers cherchés, limitée à quelques secondes. Renvoie une Map index → chemin.
 */
function chercherAPied(cherches) {
  const trouves = new Map();
  const restants = new Map(cherches.map((c) => [c.voulu, c]));
  const {maison, volumes} = dossiersProbables();
  // 2 s dans tes dossiers, puis 2 s sur les disques externes
  for (const [racines, delaiMs] of [[maison, 3500], [volumes, 2500]]) explorer(racines, delaiMs, restants, trouves);
  return trouves;
}
function explorer(racines, delaiMs, restants, trouves) {
  const file = racines.map((d) => [d, 0]);
  const vus = new Set();
  const fin = Date.now() + delaiMs;
  for (let k = 0; k < file.length && restants.size && Date.now() < fin; k++) {
    const [d, prof] = file[k];
    // les raccourcis (liens) vers un disque externe sont suivis, sans jamais repasser deux fois au même endroit
    try { const vrai = fs.realpathSync(d); if (vus.has(vrai)) continue; vus.add(vrai); } catch { continue; }
    let entrees;
    try { entrees = fs.readdirSync(d, {withFileTypes: true}); } catch { continue; }
    for (const e of entrees) {
      if (e.name.startsWith('.')) continue;
      const c = path.join(d, e.name);
      let dossier = e.isDirectory();
      let fichier = e.isFile();
      if (e.isSymbolicLink()) {
        try { const st = fs.statSync(c); dossier = st.isDirectory(); fichier = st.isFile(); } catch { continue; }
      }
      if (dossier) {
        if (prof < 8 && !DOSSIERS_IGNORES.test(e.name)) file.push([c, prof + 1]);
        continue;
      }
      const x = restants.get(e.name.normalize('NFC'));
      if (x && fichier && memeFichier(c, x.voulu, x.taille, x.modifie)) {
        trouves.set(x.index, c);
        restants.delete(x.voulu);
      }
    }
  }
}

/**
 * Retrouve sur le disque des fichiers glissés depuis le Finder : le navigateur ne donne pas leur chemin, mais on connaît
 * leur nom, leur taille et leur date. D'abord Spotlight (instantané), sinon une recherche rapide dans les dossiers
 * habituels. On peut alors les lire sur place, sans copie, même s'ils pèsent des dizaines de Go.
 */
/** Les dossiers d'où viennent les médias des projets récents : on y cherche en premier (instantané). */
function dossiersConnus(ctx) {
  const projets = new Set([...(ctx.P ? [ctx.P.racine] : []), ...listerProjets().map((p) => p.dossier)]);
  const dossiers = new Set();
  for (const d of projets) {
    const j = d === ctx.P?.racine ? ctx.P.d : lireJson(path.join(d, 'derush.json'));
    for (const m of j?.medias ?? []) dossiers.add(path.dirname(m.chemin));
    for (const r of j?.references ?? []) dossiers.add(path.dirname(r.chemin));
  }
  return [...dossiers];
}

async function localiserTous(fichiers, ctx) {
  if (process.platform !== 'darwin') return fichiers.map(() => null);
  const res = await Promise.all(fichiers.map(async ({nom, taille, modifie}) => {
    if (!nom) return null;
    const voulu = String(nom).normalize('NFC');
    try {
      const exact = String(nom).replace(/["\\]/g, '\\$&');
      const {out} = await lancer('mdfind', [`kMDItemFSName == "${exact}"cd`]);
      for (const c of out.toString().split('\n')) if (c && memeFichier(c, voulu, taille, modifie)) return c;
    } catch { /* Spotlight indisponible */ }
    return null;
  }));
  let cherches = fichiers.map((f, index) => ({index, voulu: String(f.nom ?? '').normalize('NFC'), taille: f.taille, modifie: f.modifie})).filter((x) => x.voulu && !res[x.index]);
  // d'abord les dossiers d'où tu as déjà importé (souvent le même dossier de tournage)
  if (cherches.length) {
    for (const d of dossiersConnus(ctx)) {
      for (const x of cherches) if (!res[x.index] && memeFichier(path.join(d, x.voulu), x.voulu, x.taille, x.modifie)) res[x.index] = path.join(d, x.voulu);
    }
    cherches = cherches.filter((x) => !res[x.index]);
  }
  if (cherches.length) for (const [index, c] of chercherAPied(cherches)) res[index] = c;
  return res;
}

/** Ajoute des fichiers de référence pour l'IA (image, modèle 3D, PDF…), lus sur place. */
function ajouterReferences(P, chemins, cible) {
  const ajoutes = [];
  for (const c of chemins) {
    const ch = path.resolve(String(c));
    let st;
    try { st = fs.statSync(ch); } catch { continue; }
    if (!st.isFile()) continue;
    const deja = P.d.references.find((r) => r.chemin === ch && r.cible === (cible || null));
    if (deja) continue;
    const ref = {id: nouvelId(P.d, 'R'), nom: path.basename(ch), chemin: ch, cible: cible || null, taille: st.size, ajoute_le: new Date().toISOString()};
    P.d.references.push(ref);
    ajoutes.push(ref);
  }
  P.sauver();
  return ajoutes;
}

/** La fenêtre « Ouvrir » du système pour choisir des fichiers (ils restent à leur place). Annuler renvoie une liste vide. */
function choisirFichiers(usage, natif = false) {
  // depuis le Google Drive : la fenêtre s'ouvre directement dans le dossier synchronisé
  const drive = usage === 'drive' ? dossiersDrive()?.monDrive : null;
  const invite = usage === 'drive'
    ? 'Choisis dans ton Google Drive ce que tu donnes à Claude : vidéos, références, charte, logo, documents…'
    : usage === 'reference'
      ? 'Choisis des fichiers pour l’IA : images, modèle 3D, logo, document…'
      : usage === 'piece'
        ? 'Choisis ce que tu donnes à l’IA : références, vidéos, charte graphique, logo, polices, archives zip, documents…'
        : 'Choisis les vidéos, les sons ou les photos à importer dans Dérush';
  // dans l'app native, c'est elle qui ouvre la fenêtre « Ouvrir » (attachée à sa fenêtre) : on lui dit quoi afficher
  if (natif) return Promise.resolve({natif: {invite, depart: drive ?? null}});
  return choisirSysteme({invite, depart: drive});
}
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.flac': 'audio/flac',
};

class ErreurHttp extends Error {
  constructor(code, message, extra) { super(message); this.code = code; this.extra = extra; }
}

function envoyerJson(res, code, data) {
  const corps = JSON.stringify(data);
  res.writeHead(code, {'Content-Type': TYPES['.json'], 'Content-Length': Buffer.byteLength(corps), 'Cache-Control': 'no-store'});
  res.end(corps);
}

/** Envoie un fichier en gérant les plages d'octets (indispensable pour se déplacer dans une vidéo). */
function envoyerFichier(req, res, fichier, type) {
  const st = fs.statSync(fichier);
  type ??= TYPES[path.extname(fichier).toLowerCase()] ?? 'application/octet-stream';
  const plage = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (plage) {
    let a = plage[1] ? Number(plage[1]) : 0;
    let b = plage[2] ? Number(plage[2]) : st.size - 1;
    if (!plage[1] && plage[2]) { a = Math.max(0, st.size - Number(plage[2])); b = st.size - 1; }
    b = Math.min(b, st.size - 1);
    if (a > b || a >= st.size) {
      res.writeHead(416, {'Content-Range': `bytes */${st.size}`});
      return res.end();
    }
    res.writeHead(206, {'Content-Type': type, 'Content-Length': b - a + 1, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache'});
    fs.createReadStream(fichier, {start: a, end: b}).pipe(res);
  } else {
    res.writeHead(200, {'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache'});
    fs.createReadStream(fichier).pipe(res);
  }
}

function lireCorps(req, limite = 60e6) {
  return new Promise((ok, ko) => {
    const morceaux = [];
    let taille = 0;
    req.on('data', (d) => {
      taille += d.length;
      if (taille > limite) { ko(new ErreurHttp(413, 'Requête trop lourde.')); req.destroy(); } else morceaux.push(d);
    });
    req.on('end', () => {
      const txt = Buffer.concat(morceaux).toString('utf8');
      if (!txt) return ok({});
      try { ok(JSON.parse(txt)); } catch { ko(new ErreurHttp(400, 'JSON invalide.')); }
    });
    req.on('error', ko);
  });
}

/** Nom de fichier sûr et unique dans un dossier. */
function nomLibre(dossier, nom) {
  const propre = path.basename(nom).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180) || 'rush';
  const {name, ext} = path.parse(propre);
  let essai = propre;
  for (let k = 2; fs.existsSync(path.join(dossier, essai)); k++) essai = `${name}-${k}${ext}`;
  return path.join(dossier, essai);
}

/** Les fichiers du projet qui peuvent servir de départ à une création ElevenLabs (vidéo, son, image). */
function sourcesStudio(P) {
  const genreDe = (nom) => (EXT_VIDEOS.test(nom) ? 'video' : EXT_SONS.test(nom) ? 'son' : EXT_IMAGES.test(nom) ? 'image' : null);
  const S = [];
  for (const m of P.d.medias) S.push({cle: `media:${m.id}`, nom: m.nom, genre: m.type === 'audio' ? 'son' : m.type, origine: 'Rush', chemin: m.chemin});
  for (const v of etatDemande(P).versions.slice().reverse()) {
    for (const x of v.videos) S.push({cle: `claude:${x.nom}`, nom: x.titre ? `${x.titre} (version ${v.n})` : `Vidéo de Claude, version ${v.n}`, genre: 'video', origine: 'Vidéo de Claude', chemin: x.chemin});
  }
  for (const x of listerPieces(P)) if (!x.introuvable && ['video', 'son', 'image'].includes(x.type)) S.push({cle: `piece:${x.id}`, nom: x.nom, genre: x.type, origine: 'Pièce jointe', chemin: x.chemin});
  for (const c of listerCreations(P)) {
    const g = c.etat === 'pret' && c.chemin ? genreDe(c.chemin) : null;
    if (g) S.push({cle: `creation:${c.id}`, nom: c.titre, genre: g, origine: 'Création', chemin: c.chemin});
  }
  return S.filter((s) => s.genre && s.chemin && fs.existsSync(s.chemin));
}

const ouvrirDansFinder = (c) => ouvrirSysteme(c);

/**
 * ctx : {P (projet ouvert ou null), file, ouvrir(dossier), fermer(), app}
 */
export function demarrerServeur(ctx, {port = 4321, essais = 10, modeApp = false} = {}) {
  const actionsConnexions = new Map(); // blender, remotion… : {etat, message}
  const modeAppActif = modeApp;
  const JETON = crypto.randomBytes(18).toString('hex');
  const file = ctx.file;
  ctx.dernierSigne = Date.now();
  // les fenêtres ouvertes (identifiant → dernier signe de vie) et la fenêtre principale, seule autorisée à modifier
  ctx.fenetres = new Map();
  ctx.fenetrePrincipale = null;
  ctx.fermeeA = 0;
  ctx.demarreA = Date.now();
  const indexHtml = () => fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').replace('%%JETON%%', JETON).replaceAll('%%VERSION%%', VERSION);
  const projet = () => {
    if (!ctx.P) throw new ErreurHttp(409, 'Aucun projet ouvert.');
    return ctx.P;
  };
  // L'état des moteurs (Whisper, les IA, Blender…) : il faut lancer plusieurs programmes pour le connaître, une bonne
  // seconde la première fois. L'interface ne l'attend donc jamais : il est calculé dès le démarrage, gardé en mémoire
  // et sur le disque (pour l'ouverture suivante), et rafraîchi en arrière-plan.
  const FICHIER_MOTEURS = path.join(dossierSupport(), 'etat-moteurs.json');
  let moteursVus = lireJson(FICHIER_MOTEURS)?.moteurs ?? null;
  let moteursLe = 0; // quand l'état en mémoire a été calculé par CE serveur (0 : il vient du disque)
  let calcul = null;
  const tousMoteurs = () => {
    calcul ??= (async () => {
      const [t, e, ia, blender] = await Promise.all([moteurs(), etatMoteurs(), etatIA(), etatBlender()]);
      const resume = (x) => (x.ok ? {ok: true, nom: x.nom, detail: `${x.nom}. ${x.detail}`} : {ok: false, pourquoi: x.pourquoi});
      const m = {whisper: t.whisper, elevenlabs: t.elevenlabs, voix: e.voix, vision: e.vision, detourage: e.detourage, rendu: etatRendu(), blender, sons: etatElevenLabs(), drive: etatDrive(), treg: etatTreg(), claude: resume(ia.claude), codex: resume(ia.codex), gemini: resume(ia.gemini), ia_choisie: ia.choisi};
      moteursVus = m;
      moteursLe = Date.now();
      try { ecrireJson(FICHIER_MOTEURS, {le: new Date().toISOString(), version: VERSION, moteurs: m}); } catch { /* disque plein : tant pis */ }
      return m;
    })().finally(() => { calcul = null; });
    return calcul;
  };
  tousMoteurs().catch(() => {});
  /** L'état connu, tout de suite : frais s'il a moins de 20 s, sinon le dernier connu pendant qu'on le recalcule. */
  const moteursTout2Suite = async () => {
    if (moteursVus && Date.now() - moteursLe < 20000) return {moteurs: moteursVus, attente: false};
    // un état déjà connu (celui de l'ouverture précédente) part tout de suite ; l'interface recevra le nouveau ensuite
    if (moteursVus) { tousMoteurs().catch(() => {}); return {moteurs: moteursVus, attente: true}; }
    // toute première ouverture : on laisse un quart de seconde au calcul
    const frais = await Promise.race([tousMoteurs().catch(() => null), new Promise((ok) => setTimeout(ok, 250, null))]);
    return frais ? {moteurs: frais, attente: false} : {moteurs: {}, attente: true};
  };

  const routes = async (req, res, url) => {
    const p = url.pathname;
    const m = (re) => re.exec(p);
    let x;

    // — interface —
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
      res.writeHead(200, {'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store'});
      return res.end(indexHtml());
    }
    if (req.method === 'GET' && p === '/commun.js') return envoyerFichier(req, res, path.join(ICI, 'commun.mjs'), TYPES['.js']);
    if (req.method === 'GET' && /^\/[a-z0-9-]+\.(js|css|svg|png)$/.test(p)) {
      const f = path.join(PUBLIC, p.slice(1));
      if (!fs.existsSync(f)) throw new ErreurHttp(404, 'Introuvable.');
      return envoyerFichier(req, res, f);
    }
    // les logos des connexions (Simple Icons, CC0) et la marque (Dérush par IABAI)
    if (req.method === 'GET' && (x = m(/^\/(logos|marque)\/([a-z0-9-]+\.(?:svg|png|ico))$/))) {
      const f = path.join(PUBLIC, x[1], x[2]);
      if (!fs.existsSync(f)) throw new ErreurHttp(404, 'Introuvable.');
      return envoyerFichier(req, res, f);
    }
    // polices et bruitages de l'habillage (les mêmes fichiers que dans le kit de rendu)
    if (req.method === 'GET' && (x = m(/^\/(polices|sons)\/([a-z0-9-]+\.(?:woff2|wav))$/))) {
      // un bruitage refait avec ElevenLabs remplace celui d'origine (le kit de rendu reçoit le même)
      const f = (x[1] === 'sons' && bruitageElevenLabs(x[2].replace(/\.wav$/, ''))) || path.join(PUBLIC, x[1], x[2]);
      if (!fs.existsSync(f)) throw new ErreurHttp(404, 'Introuvable.');
      return envoyerFichier(req, res, f);
    }
    if (req.method === 'GET' && p === '/api/ping') return envoyerJson(res, 200, {derush: true, version: VERSION, fenetres: ctx.fenetres.size, occupe: !!(file.enCours || file.attente.length || claudeTravaille() || publicationEnCours())});

    // — fichiers (jeton dans l'adresse : les balises <video> ne peuvent pas envoyer d'en-tête) —
    if ((x = m(/^\/media\/(M\d+)\/(lecture|ondes|vignettes|mots|analyse|cadrage|voix|fond)$/))) {
      if (url.searchParams.get('j') !== JETON) throw new ErreurHttp(403, 'Jeton manquant.');
      const P = projet();
      const me = P.media(x[1]);
      if (!me) throw new ErreurHttp(404, 'Rush inconnu.');
      const D = path.join(P.cache, 'medias', me.id);
      const f = {lecture: fichierLecture(P, me), voix: path.join(D, 'voix.flac'), fond: path.join(D, 'fond.flac')}[x[2]] ?? path.join(D, `${x[2]}.${x[2] === 'vignettes' ? 'jpg' : 'json'}`);
      if (!fs.existsSync(f)) throw new ErreurHttp(404, 'Pas encore prêt.');
      return envoyerFichier(req, res, f);
    }
    // masque de la personne détourée, pour une image d'un rush (aperçu du titre « derrière la personne »)
    if ((x = m(/^\/media\/(M\d+)\/masque\/(\d+)$/))) {
      if (url.searchParams.get('j') !== JETON) throw new ErreurHttp(403, 'Jeton manquant.');
      const P = projet();
      const me = P.media(x[1]);
      const f = me ? path.join(dossierMasques(P, me), `m_${x[2]}.png`) : null;
      if (!f || !fs.existsSync(f)) throw new ErreurHttp(404, 'Pas encore détouré.');
      return envoyerFichier(req, res, f);
    }
    // une vidéo créée par Dérush (dossier « vidéos » du projet), ou sa planche de contrôle
    if (p === '/video') {
      if (url.searchParams.get('j') !== JETON) throw new ErreurHttp(403, 'Jeton manquant.');
      const P = projet();
      const f = path.join(P.racine, 'vidéos', path.basename(String(url.searchParams.get('nom') ?? '')));
      if (!/\.(mp4|jpg)$/.test(f) || !fs.existsSync(f)) throw new ErreurHttp(404, 'Vidéo introuvable.');
      return envoyerFichier(req, res, f);
    }
    // la conversation avec Claude : aperçu ou fichier d'une pièce jointe, images du rendu en direct, images qu'il regarde
    if ((x = m(/^\/claude\/(piece\/(J\d+)\/(apercu|fichier)|direct\/([\w-]+)\/(f-\d{5}\.jpg)|vue\/(\d+))$/))) {
      if (url.searchParams.get('j') !== JETON) throw new ErreurHttp(403, 'Jeton manquant.');
      const P = projet();
      const f = x[2] ? (x[3] === 'apercu' ? cheminApercu(P, x[2]) : piece(P, x[2])?.chemin) : x[4] ? fichierDirect(P, x[4], x[5]) : fichierVue(P, x[6]);
      if (!f || !fs.existsSync(f)) throw new ErreurHttp(404, 'Introuvable.');
      return envoyerFichier(req, res, f);
    }
    // une création ElevenLabs (musique, voix, image, vidéo…)
    if ((x = m(/^\/creation\/(C\d+)$/))) {
      if (url.searchParams.get('j') !== JETON) throw new ErreurHttp(403, 'Jeton manquant.');
      const c = listerCreations(projet()).find((y) => y.id === x[1]);
      if (!c?.chemin || !fs.existsSync(c.chemin)) throw new ErreurHttp(404, 'Pas encore prête.');
      return envoyerFichier(req, res, c.chemin);
    }
    if (p === '/planche') {
      if (url.searchParams.get('j') !== JETON) throw new ErreurHttp(403, 'Jeton manquant.');
      let f = null;
      try { f = fichierPlanche(projet(), url.searchParams.get('video'), url.searchParams.get('nom')); } catch { /* nom refusé */ }
      if (!f) throw new ErreurHttp(404, 'Pas encore prête.');
      return envoyerFichier(req, res, f);
    }
    if (p === '/affiche') {
      if (url.searchParams.get('j') !== JETON) throw new ErreurHttp(403, 'Jeton manquant.');
      const f = path.join(String(url.searchParams.get('dossier') ?? ''), '.derush', 'affiche.jpg');
      if (!fs.existsSync(f)) throw new ErreurHttp(404, 'Pas d’affiche.');
      return envoyerFichier(req, res, f);
    }

    // — API —
    if (!p.startsWith('/api/')) throw new ErreurHttp(404, 'Introuvable.');
    // une fenêtre qui se ferme le signale (navigator.sendBeacon ne peut pas envoyer d'en-tête : jeton dans l'adresse)
    if (req.method === 'POST' && p === '/api/fenetre-fermee') {
      if (url.searchParams.get('j') !== JETON) throw new ErreurHttp(403, 'Jeton manquant.');
      ctx.fenetres.delete(String(url.searchParams.get('f') ?? ''));
      ctx.fermeeA = Date.now();
      req.resume();
      res.writeHead(204, {'Cache-Control': 'no-store'});
      return res.end();
    }
    if (req.headers['x-derush-jeton'] !== JETON) throw new ErreurHttp(403, 'Jeton manquant.');
    ctx.dernierSigne = Date.now();
    // Une seule fenêtre modifie le projet : la dernière ouverte. Une ancienne fenêtre (cachée, endormie par Chrome…)
    // ne peut donc jamais écraser le travail fait dans la nouvelle.
    const fenetre = String(req.headers['x-derush-fenetre'] ?? '').slice(0, 64);
    if (fenetre) {
      ctx.fenetres.set(fenetre, Date.now());
      if (req.method === 'GET' && p === '/api/etat') ctx.fenetrePrincipale = fenetre;
    }
    // les demandes qui ne modifient rien (signe de vie, recherche d'un fichier, fenêtre « Ouvrir ») restent permises
    const modifie = req.method !== 'GET' && !['/api/signe', '/api/quitter', '/api/localiser', '/api/choisir'].includes(p);
    if (modifie && ctx.fenetrePrincipale && fenetre !== ctx.fenetrePrincipale) {
      throw new ErreurHttp(409, 'Dérush est ouvert dans une autre fenêtre.', {remplacee: true});
    }

    if (req.method === 'GET' && p === '/api/etat') {
      const mo = await moteursTout2Suite();
      return envoyerJson(res, 200, {
        version: VERSION, systeme: SYSTEME, mode: ctx.P ? 'projet' : 'bibliotheque', app: !!ctx.app, natif: !!ctx.natif, bibliotheque: RACINE_BIBLIO,
        racine: ctx.P?.racine ?? null, projet: ctx.P?.d ?? null, file: file.etat(), moteurs: mo.moteurs, moteurs_en_attente: mo.attente, police: !!POLICE,
        reglages: {tuto_vu: !!lireReglages().tuto_vu, accueil_vu: !!lireReglages().accueil_vu},
      });
    }
    if (req.method === 'GET' && p === '/api/file') return envoyerJson(res, 200, {file: file.etat(), medias: ctx.P?.d.medias ?? []});
    if (req.method === 'POST' && p === '/api/signe') return envoyerJson(res, 200, {ok: true});
    if (req.method === 'POST' && p === '/api/quitter') {
      envoyerJson(res, 200, {ok: true});
      // rien ne reste en arrière-plan : les traitements et l'IA s'arrêtent avec Dérush
      setTimeout(() => { try { arreterToutesLesDemandes(); arreterConseils(); arreterEnfants(); } catch { /* rien à arrêter */ } process.exit(0); }, 300);
      return null;
    }

    // bibliothèque
    if (req.method === 'GET' && p === '/api/bibliotheque') return envoyerJson(res, 200, {racine: RACINE_BIBLIO, projets: listerProjets()});
    if (req.method === 'POST' && p === '/api/projets') {
      const {titre} = await lireCorps(req);
      const P = ctx.ouvrir(creerDossierProjet(titre), titre);
      return envoyerJson(res, 200, {ok: true, racine: P.racine});
    }
    if (req.method === 'POST' && p === '/api/projets/ouvrir') {
      const {dossier} = await lireCorps(req);
      const d = path.resolve(String(dossier ?? ''));
      if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) throw new ErreurHttp(400, 'Dossier introuvable.');
      const P = ctx.ouvrir(d);
      return envoyerJson(res, 200, {ok: true, racine: P.racine});
    }
    if (req.method === 'POST' && p === '/api/projets/fermer') {
      ctx.fermer();
      return envoyerJson(res, 200, {ok: true});
    }
    if (req.method === 'POST' && p === '/api/projets/corbeille') {
      const {dossier} = await lireCorps(req);
      const d = path.resolve(String(dossier ?? ''));
      if (ctx.P?.racine === d) ctx.fermer();
      try { mettreALaCorbeille(d); } catch (e) { throw new ErreurHttp(400, e.message); }
      return envoyerJson(res, 200, {ok: true});
    }

    // les petits réglages de l'interface (le tutoriel a-t-il été vu ?)
    if (req.method === 'POST' && p === '/api/reglages/interface') {
      const {tuto_vu, accueil_vu} = await lireCorps(req);
      if (typeof tuto_vu === 'boolean') changerReglages({tuto_vu});
      if (typeof accueil_vu === 'boolean') changerReglages({accueil_vu});
      return envoyerJson(res, 200, {tuto_vu: !!lireReglages().tuto_vu, accueil_vu: !!lireReglages().accueil_vu});
    }

    // moteurs
    if (req.method === 'GET' && p === '/api/moteurs') return envoyerJson(res, 200, await tousMoteurs());
    // ElevenLabs : la page d'autorisation s'ouvre dans le navigateur, l'outil officiel range la clé
    if (req.method === 'POST' && p === '/api/elevenlabs/brancher') return envoyerJson(res, 200, brancherElevenLabs());
    if (req.method === 'POST' && p === '/api/moteurs/installer') {
      const {nom} = await lireCorps(req);
      const noms = {whisper: 'Installation de Whisper', voix: 'Installation de la séparation de la voix', detourage: 'Installation du détourage', rendu: 'Installation du moteur de rendu'};
      if (!noms[nom]) throw new ErreurHttp(400, 'Moteur inconnu.');
      const t = file.ajouter(noms[nom], (prog) => (nom === 'rendu' ? installerRendu(prog) : installer(nom, prog)), {type: 'installation', moteur: nom});
      return envoyerJson(res, 200, {tache: t.id});
    }

    // projet
    if (req.method === 'PUT' && p === '/api/projet') {
      const P = projet();
      P.appliquer(await lireCorps(req));
      return envoyerJson(res, 200, {ok: true, modifie_le: P.d.modifie_le});
    }
    if (req.method === 'POST' && p === '/api/medias') {
      const P = projet();
      const {chemins = []} = await lireCorps(req);
      return envoyerJson(res, 200, await ajouterMedias(P, chemins, file));
    }
    // fichiers glissés depuis le Finder : où sont-ils sur le disque ?
    if (req.method === 'POST' && p === '/api/localiser') {
      const {fichiers = []} = await lireCorps(req);
      const chemins = await localiserTous(fichiers.slice(0, 200).map((f) => f ?? {}), ctx);
      return envoyerJson(res, 200, {chemins});
    }
    // fichiers de référence pour l'IA (sur le projet, ou sur une case à créer)
    if (req.method === 'POST' && p === '/api/references') {
      const P = projet();
      const {chemins = [], cible = null} = await lireCorps(req);
      const ajoutes = ajouterReferences(P, chemins, cible);
      return envoyerJson(res, 200, {ajoutes, references: P.d.references});
    }
    if ((x = m(/^\/api\/references\/(R\d+)$/)) && req.method === 'DELETE') {
      const P = projet();
      P.d.references = P.d.references.filter((r) => r.id !== x[1]);
      P.sauver();
      return envoyerJson(res, 200, {references: P.d.references});
    }
    if (req.method === 'POST' && p === '/api/televerser') {
      const P = projet();
      const nom = url.searchParams.get('nom') ?? 'rush';
      // une référence pour l'IA (n'importe quel fichier) : rangée dans references/ du projet
      if (url.searchParams.get('usage') === 'reference') {
        const dossierRef = path.join(P.racine, 'references');
        fs.mkdirSync(dossierRef, {recursive: true});
        const cibleRef = nomLibre(dossierRef, path.basename(nom));
        await new Promise((ok, ko) => {
          const out = fs.createWriteStream(cibleRef);
          req.pipe(out);
          out.on('finish', ok);
          out.on('error', ko);
          req.on('error', ko);
        });
        const ajoutes = ajouterReferences(P, [cibleRef], url.searchParams.get('cible'));
        return envoyerJson(res, 200, {ajoutes, references: P.d.references});
      }
      if (!EXT_MEDIAS.test(nom)) throw new ErreurHttp(400, 'Ce fichier n’est ni une vidéo, ni un son, ni une image.');
      const dossier = path.join(P.racine, 'rushes');
      fs.mkdirSync(dossier, {recursive: true});
      const cible = nomLibre(dossier, nom);
      await new Promise((ok, ko) => {
        const out = fs.createWriteStream(cible);
        req.pipe(out);
        out.on('finish', ok);
        out.on('error', ko);
        req.on('error', ko);
      });
      try {
        const me = await ajouterMedia(P, cible, file);
        return envoyerJson(res, 200, {ajoutes: [me.id], erreurs: []});
      } catch (e) {
        fs.rmSync(cible, {force: true});
        throw new ErreurHttp(400, e.message);
      }
    }
    if ((x = m(/^\/api\/medias\/(M\d+)$/)) && req.method === 'DELETE') {
      try { retirerMedia(projet(), x[1]); } catch (e) { throw new ErreurHttp(409, e.message); }
      return envoyerJson(res, 200, {ok: true});
    }
    if ((x = m(/^\/api\/medias\/(M\d+)\/(preparer|transcrire|voix|transcription|detourer)$/))) {
      const P = projet();
      const me = P.media(x[1]);
      if (!me) throw new ErreurHttp(404, 'Rush inconnu.');
      if (x[2] === 'preparer' && req.method === 'POST') {
        for (const k of Object.keys(me.etapes)) if (me.etapes[k] === 'erreur') delete me.etapes[k];
        preparer(P, me, file);
        return envoyerJson(res, 200, {ok: true});
      }
      if (x[2] === 'transcrire' && req.method === 'POST') {
        const {moteur = 'whisper'} = await lireCorps(req);
        const t = file.ajouter(`Texte · ${me.nom}`, (prog) => transcrire(P, me, moteur, prog), {media: me.id, type: 'transcription'});
        return envoyerJson(res, 200, {tache: t.id});
      }
      // détourer la personne entre deux temps du rush (pour l'aperçu d'un titre qui passe derrière elle)
      if (x[2] === 'detourer' && req.method === 'POST') {
        const {debut = 0, fin = 0} = await lireCorps(req);
        const t = file.ajouter(`Détourage · ${me.nom}`, (prog) => masquesMedia(P, me, debut, fin, prog), {media: me.id, type: 'detourage'});
        return envoyerJson(res, 200, {tache: t.id});
      }
      if (x[2] === 'voix' && req.method === 'POST') {
        const t = file.ajouter(`Voix · ${me.nom}`, (prog) => isolerVoix(P, me, prog), {media: me.id, type: 'voix'});
        return envoyerJson(res, 200, {tache: t.id});
      }
      if (x[2] === 'transcription' && req.method === 'DELETE') {
        fs.rmSync(path.join(P.cache, 'medias', me.id, 'mots.json'), {force: true});
        me.transcription = null;
        P.sauver();
        return envoyerJson(res, 200, {ok: true});
      }
      if (x[2] === 'transcription' && req.method === 'POST') {
        const {nom = 'transcription.json', contenu = ''} = await lireCorps(req);
        let r;
        try { r = lireFichierTranscription(nom, contenu); } catch (e) { throw new ErreurHttp(400, e.message); }
        if (r.mots.at(-1).f > me.duree + 5) throw new ErreurHttp(400, `Cette transcription dure ${Math.round(r.mots.at(-1).f)} s alors que le rush en fait ${Math.round(me.duree)} : est-ce le bon fichier ?`);
        return envoyerJson(res, 200, enregistrer(P, me, r, `import (${path.extname(nom).slice(1) || 'fichier'})`));
      }
    }
    if (req.method === 'POST' && p === '/api/choisir') {
      const {usage = null, natif = false} = await lireCorps(req).catch(() => ({}));
      return envoyerJson(res, 200, await choisirFichiers(usage, !!natif && !!ctx.natif));
    }
    if (req.method === 'GET' && p === '/api/parcourir') {
      const dossier = path.resolve(url.searchParams.get('dossier') || os.homedir());
      let entrees;
      try { entrees = fs.readdirSync(dossier, {withFileTypes: true}); } catch (e) { throw new ErreurHttp(400, `Dossier illisible : ${e.message}`); }
      const liste = entrees.filter((e) => !e.name.startsWith('.'))
        .map((e) => {
          let estDossier = e.isDirectory();
          if (e.isSymbolicLink()) { try { estDossier = fs.statSync(path.join(dossier, e.name)).isDirectory(); } catch { /* lien cassé */ } }
          const media = !estDossier && EXT_MEDIAS.test(e.name);
          let taille = null;
          if (media) { try { taille = fs.statSync(path.join(dossier, e.name)).size; } catch { /* ignoré */ } }
          return {nom: e.name, chemin: path.join(dossier, e.name), type: estDossier ? 'dossier' : media ? 'media' : 'autre', taille, projet: estDossier && fs.existsSync(path.join(dossier, e.name, 'derush.json'))};
        })
        .filter((e) => e.type !== 'autre')
        .sort((a, b) => (a.type === b.type ? a.nom.localeCompare(b.nom, 'fr', {numeric: true}) : a.type === 'dossier' ? -1 : 1));
      const raccourcis = [['Bureau', path.join(os.homedir(), 'Desktop')], ['Vidéos', path.join(os.homedir(), 'Movies')], ['Téléchargements', path.join(os.homedir(), 'Downloads')], ['Documents', path.join(os.homedir(), 'Documents')], ['Dossier personnel', os.homedir()], ...(ctx.P ? [['Projet', ctx.P.racine]] : [])]
        .filter(([, c]) => fs.existsSync(c)).map(([nom, chemin]) => ({nom, chemin}));
      return envoyerJson(res, 200, {dossier, parent: path.dirname(dossier) !== dossier ? path.dirname(dossier) : null, entrees: liste, raccourcis});
    }
    if (req.method === 'POST' && p === '/api/exporter') {
      const P = projet();
      const t = file.ajouter('Préparation du pack pour l’IA', (prog) => exporterPack(P, prog), {type: 'export'});
      return envoyerJson(res, 200, {tache: t.id});
    }
    // « Créer la vidéo » : le montage et son habillage, rendus en MP4 puis contrôlés
    if (req.method === 'POST' && p === '/api/rendre') {
      const P = projet();
      const {plateforme = null} = await lireCorps(req).catch(() => ({}));
      const t = file.ajouter('Création de la vidéo', (prog) => creerVideo(P, {plateforme}, prog), {type: 'rendu'});
      return envoyerJson(res, 200, {tache: t.id});
    }
    // « Demander à Claude » : Dérush lance Claude Code dans le dossier de montage et suit son travail
    if (req.method === 'GET' && p === '/api/claude') {
      const P = projet();
      const ia = await etatIA(url.searchParams.has('force'));
      const r = lireReglages();
      return envoyerJson(res, 200, {claude: ia.claude, codex: ia.codex, gemini: ia.gemini, ia: {choisi: ia.choisi, qualite: QUALITES[r.ia_qualite] ? r.ia_qualite : 'max', modele: MODELES[r.ia_modele] ? r.ia_modele : null, noms: IA}, qualites: QUALITES, reseaux: RESEAUX,
        modeles: MODELES, efforts: EFFORTS, roles: ROLES, elevenlabs: etatElevenLabs().ok, drive: etatDrive(), treg: etatTreg(ia.choisi), ...etatDemande(P)});
    }
    // les pièces jointes : des fichiers du Mac (fenêtre « Ouvrir » ou glissés), ou envoyés par la fenêtre (copier-coller)
    if (req.method === 'POST' && p === '/api/claude/pieces') {
      const P = projet();
      const {chemins = []} = await lireCorps(req);
      const r = ajouterPieces(P, chemins.slice(0, 100));
      return envoyerJson(res, 200, {ajoutees: r.ajoutees.map((y) => y.id), erreurs: r.erreurs});
    }
    if (req.method === 'POST' && p === '/api/claude/pieces/televerser') {
      const P = projet();
      const y = await televerserPiece(P, url.searchParams.get('nom') ?? 'piece', req);
      return envoyerJson(res, 200, {ajoutees: [y.id], erreurs: []});
    }
    if ((x = m(/^\/api\/claude\/pieces\/(J\d+)$/))) {
      const P = projet();
      if (req.method === 'DELETE') return envoyerJson(res, 200, {ok: retirerPiece(P, x[1])});
      if (req.method === 'PUT') {
        const {role} = await lireCorps(req);
        try { return envoyerJson(res, 200, {piece: changerRole(P, x[1], role)}); } catch (e) { throw new ErreurHttp(400, e.message); }
      }
    }
    // une vidéo de Claude, mise dans les médias du projet (pour la retoucher ou la poser dans la timeline)
    if (req.method === 'POST' && p === '/api/claude/videos/medias') {
      const P = projet();
      const {nom} = await lireCorps(req);
      const f = path.join(P.racine, 'vidéos', path.basename(String(nom ?? '')));
      if (!/\.mp4$/.test(f) || !fs.existsSync(f)) throw new ErreurHttp(404, 'Vidéo introuvable.');
      try { return envoyerJson(res, 200, {media: (await ajouterMedia(P, f, file)).id}); } catch (e) { throw new ErreurHttp(400, e.message); }
    }

    // — Connexions : les deux assistants, ElevenLabs, les vrais sons, Google Drive, Treg, Blender, les compétences, les mises à jour —
    if (req.method === 'GET' && p === '/api/connexions') {
      const force = url.searchParams.has('force');
      if (force) { oublierEtats(); oublierBlender(); oublierEarshot(); verifierEarshot().catch(() => {}); }
      const [ia, blender] = await Promise.all([etatIA(force), etatBlender()]);
      const r = lireReglages();
      const sans = ({chemin, ...x}) => x; // les chemins des programmes restent ici
      const so = etatSons();
      return envoyerJson(res, 200, {
        systeme: NOM_SYSTEME, version: VERSION,
        claude: {...sans(ia.claude), action: actionEnCours('claude')}, codex: {...sans(ia.codex), action: actionEnCours('codex')}, gemini: {...sans(ia.gemini), action: actionEnCours('gemini')},
        choisi: ia.choisi, qualite: QUALITES[r.ia_qualite] ? r.ia_qualite : 'max', qualites: QUALITES,
        modele: MODELES[r.ia_modele] ? r.ia_modele : null, modeles: MODELES, // le modèle de Claude choisi à la main (null : selon le niveau)
        elevenlabs: etatElevenLabs(), drive: etatDrive(), treg: etatTreg(ia.choisi), blender: sans(blender), blender_action: actionsConnexions.get('blender') ?? null,
        competences: {nombre: listerCompetences().length, remotion: remotionPresent(), action: actionsConnexions.get('remotion') ?? null},
        sons: {actif: so.actif, nom: so.nom, nombre: so.nombre,
          realsfx: {ok: so.realsfx.ok, action: actionsConnexions.get('realsfx') ?? null},
          earshot: {ok: so.earshot.ok, deja: !!so.earshot.chemin && !so.earshot.derush, installable: so.earshot.ok || so.earshot.installable !== false, pourquoi: so.earshot.pourquoi ?? null, action: actionsConnexions.get('earshot') ?? null}},
        maj: {...etatMaj(), action: actionsConnexions.get('maj') ?? null},
      });
    }
    if (req.method === 'POST' && (x = m(/^\/api\/connexions\/(claude|codex|ia|treg|drive|elevenlabs|blender|competences|maj|sons|realsfx|earshot)\/([a-z-]+)$/))) {
      const corps = await lireCorps(req).catch(() => ({}));
      const [, id, action] = x;
      const suivre = (cle, promesse) => {
        actionsConnexions.set(cle, {etat: 'en_cours'});
        promesse.then(() => actionsConnexions.delete(cle), (e) => actionsConnexions.set(cle, {etat: 'erreur', message: String(e?.message ?? e).slice(0, 300)}));
      };
      try {
        if (id === 'claude' && action === 'installer') installerClaude();
        else if (id === 'claude' && action === 'connecter') { const c = await etatClaude(true); if (!c.chemin) throw new Error('Installe d’abord Claude Code.'); connecterClaude(c.chemin); }
        else if (id === 'codex' && action === 'installer') lancerInstallationCodex();
        else if (id === 'codex' && action === 'connecter') { const c = await etatCodex(true); if (!c.chemin) throw new Error('Installe d’abord Codex.'); connecterCodex(c.chemin); }
        else if (id === 'gemini' && action === 'installer') installerGemini();
        else if (id === 'gemini' && action === 'connecter') { const c = await etatGemini(true); if (!c.chemin) throw new Error('Installe d’abord Gemini.'); connecterGemini(c.chemin); }
        else if (id === 'ia' && action === 'choisir') {
          const champs = {};
          if (IA[corps.moteur]) champs.ia_moteur = corps.moteur;
          if (QUALITES[corps.qualite]) champs.ia_qualite = corps.qualite;
          if ('modele' in corps) champs.ia_modele = MODELES[corps.modele] ? corps.modele : null;
          changerReglages(champs);
        } else if (id === 'treg' && action === 'jeton') enregistrerJetonTreg(corps.cle);
        else if (id === 'treg' && action === 'retirer') retirerJetonTreg();
        else if (id === 'treg' && action === 'activer') changerTreg(!!corps.actif);
        else if (id === 'drive' && action === 'activer') changerDrive(!!corps.actif);
        else if (id === 'elevenlabs' && action === 'brancher') brancherElevenLabs();
        else if (id === 'blender' && action === 'installer') suivre('blender', installerBlender());
        else if (id === 'competences' && action === 'remotion') suivre('remotion', telechargerRemotion());
        else if (id === 'sons' && action === 'activer') changerSons(!!corps.actif);
        else if (id === 'sons' && action === 'ouvrir') { const d = dossierSons(); fs.mkdirSync(d, {recursive: true}); ouvrirSysteme(d); }
        else if (id === 'realsfx' && action === 'installer') suivre('realsfx', telechargerRealSfx());
        else if (id === 'earshot' && action === 'installer') suivre('earshot', installerEarshot());
        else if (id === 'maj' && action === 'verifier') await verifierMaj();
        else if (id === 'maj' && action === 'installer') {
          const r = await mettreAJour();
          envoyerJson(res, 200, {ok: true, ...r});
          // on redémarre seulement quand plus rien ne tourne (une IA au travail, une tâche en cours)
          if (r.change && !file.enCours && !file.attente.length && !claudeTravaille()) setTimeout(() => redemarrer(modeAppActif ? ['--app'] : []), 600);
          return;
        } else throw new Error('Action inconnue.');
      } catch (e) { throw new ErreurHttp(400, e.message); }
      return envoyerJson(res, 200, {ok: true});
    }
    // les liens vers les sites des connexions (s'ouvrent dans le navigateur de l'ordinateur)
    if (req.method === 'POST' && p === '/api/lien') {
      const {url: lien} = await lireCorps(req);
      let u;
      try { u = new URL(String(lien)); } catch { throw new ErreurHttp(400, 'Lien invalide.'); }
      const permis = ['treg.to', 'claude.ai', 'claude.com', 'anthropic.com', 'chatgpt.com', 'openai.com', 'elevenlabs.io', 'blender.org', 'github.com', 'nodejs.org', 'ffmpeg.org', 'brew.sh', 'drive.google.com', 'google.com',
        'youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com', 'linkedin.com', 'antigravity.google'];
      if (u.protocol !== 'https:' || !permis.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) throw new ErreurHttp(400, 'Lien non autorisé.');
      ouvrirSysteme(u.href);
      return envoyerJson(res, 200, {ok: true});
    }

    // — Google Drive : donné à Claude ou non, et « Envoyer sur mon Drive » (copie dans Mon Drive › Dérush › <projet>) —
    if (p === '/api/drive' && req.method === 'GET') return envoyerJson(res, 200, etatDrive());
    if (p === '/api/drive' && req.method === 'PUT') { const {actif} = await lireCorps(req); return envoyerJson(res, 200, changerDrive(actif)); }
    if (p === '/api/drive/envoyer' && req.method === 'POST') {
      const P = projet();
      const {video, creation} = await lireCorps(req);
      const f = video ? path.join(P.racine, 'vidéos', path.basename(String(video))) : listerCreations(P).find((y) => y.id === creation)?.chemin;
      if (!f || !fs.existsSync(f)) throw new ErreurHttp(404, 'Fichier introuvable.');
      try { return envoyerJson(res, 200, envoyerSurDrive(P, f)); } catch (e) { throw new ErreurHttp(400, e.message); }
    }

    // — le studio ElevenLabs : musiques, voix, dialogues, bruitages, voix nettoyées, doublages, images, vidéos —
    if (req.method === 'GET' && p === '/api/studio') {
      const P = projet();
      return envoyerJson(res, 200, {
        elevenlabs: etatElevenLabs(), studio: STUDIO, modeles_image: MODELES_IMAGE, modeles_video: MODELES_VIDEO, langues: LANGUES_DOUBLAGE,
        creations: listerCreations(P).map(({chemin, ...c}) => c), sources: sourcesStudio(P).map(({chemin, ...s}) => s), bruitages: etatBruitages(),
      });
    }
    if (req.method === 'GET' && p === '/api/studio/voix') {
      try { return envoyerJson(res, 200, {voix: await listerVoix()}); } catch (e) { throw new ErreurHttp(400, e.message); }
    }
    if (req.method === 'GET' && p === '/api/studio/credits') return envoyerJson(res, 200, {credits: await credits()});
    if (req.method === 'POST' && p === '/api/studio/creer') {
      const P = projet();
      const d = await lireCorps(req);
      const sources = sourcesStudio(P);
      const trouver = (cle) => sources.find((s) => s.cle === cle) ?? null;
      const demande = {type: String(d.type ?? ''), prompt: d.prompt, texte: d.texte, voix: d.voix, modele: d.modele, langue: d.langue, duree_s: d.duree_s, instrumental: d.instrumental, boucle: d.boucle, bruitages: d.bruitages, format: d.format, resolution: d.resolution, son: d.son, repliques: Array.isArray(d.repliques) ? d.repliques.slice(0, 40) : undefined};
      // le fichier de départ (musique pour une vidéo, voix à nettoyer, doublage) et l'image de référence
      if (['musique_video', 'nettoyer', 'doublage'].includes(demande.type)) {
        const s = trouver(d.source);
        if (!s) throw new ErreurHttp(400, 'Choisis d’abord le fichier de départ.');
        if (demande.type === 'musique_video' && s.genre !== 'video') throw new ErreurHttp(400, 'Il faut une vidéo pour composer une musique dessus.');
        demande.fichier = s.chemin;
        demande.titre = demande.type === 'doublage' ? `${s.nom} en ${LANGUES_DOUBLAGE[demande.langue] ?? demande.langue}` : s.nom;
      }
      if (['image', 'video'].includes(demande.type) && d.image) {
        const s = trouver(d.image);
        if (s?.genre === 'image') demande.image = s.chemin;
      }
      if (['musique', 'bruitage', 'image', 'video'].includes(demande.type) && !String(demande.prompt ?? '').trim()) throw new ErreurHttp(400, 'Décris d’abord ce que tu veux.');
      if (demande.type === 'voix' && (!String(demande.texte ?? '').trim() || !demande.voix)) throw new ErreurHttp(400, 'Écris le texte et choisis une voix.');
      if (demande.type === 'dialogue' && !(demande.repliques ?? []).some((r) => String(r?.texte ?? '').trim() && r.voix)) throw new ErreurHttp(400, 'Écris au moins une réplique avec sa voix.');
      let c;
      try { c = nouvelleCreation(P, demande); } catch (e) { throw new ErreurHttp(400, e.message); }
      lancerCreation(P, c.id);
      return envoyerJson(res, 200, {creation: c.id});
    }
    if ((x = m(/^\/api\/studio\/creations\/(C\d+)(\/medias)?$/))) {
      const P = projet();
      if (req.method === 'DELETE' && !x[2]) return envoyerJson(res, 200, {ok: retirerCreation(P, x[1])});
      if (req.method === 'POST' && x[2]) {
        const c = listerCreations(P).find((y) => y.id === x[1]);
        if (!c?.chemin || !fs.existsSync(c.chemin)) throw new ErreurHttp(404, 'Création pas encore prête.');
        try { return envoyerJson(res, 200, {media: (await ajouterMedia(P, c.chemin, file)).id}); } catch (e) { throw new ErreurHttp(400, e.message); }
      }
    }
    if (p === '/api/studio/bruitages' && req.method === 'POST') {
      try { return envoyerJson(res, 200, lancerBruitages()); } catch (e) { throw new ErreurHttp(400, e.message); }
    }
    if (p === '/api/studio/bruitages' && req.method === 'DELETE') {
      try { return envoyerJson(res, 200, retirerBruitages()); } catch (e) { throw new ErreurHttp(409, e.message); }
    }
    if (req.method === 'POST' && p === '/api/claude/demander') {
      const P = projet();
      const corps = await lireCorps(req);
      // les textes relus dans « Partager » partent tels quels (jamais ceux que la page enverrait elle-même)
      if (corps.publier && typeof corps.publier === 'object') {
        let textes = null;
        if (corps.publier.avec_plan) { try { textes = textesDuPlan(P, corps.publier.video, Array.isArray(corps.publier.reseaux) ? corps.publier.reseaux : []); } catch { /* pas de plan */ } }
        corps.publier = {...corps.publier, textes};
      }
      try { return envoyerJson(res, 200, await demander(P, {...corps, file: ctx.file})); } catch (e) { throw new ErreurHttp(400, e.message); }
    }
    if (req.method === 'POST' && p === '/api/claude/arreter') return envoyerJson(res, 200, {ok: arreterDemande(projet())});
    if (req.method === 'GET' && p === '/api/claude/decoupe') return envoyerJson(res, 200, {plans: decoupeDeClaude(projet()) ?? []});
    if (req.method === 'POST' && p === '/api/claude/synchroniser') { synchroniserDemande(projet()); return envoyerJson(res, 200, {ok: true}); }
    if (req.method === 'POST' && p === '/api/claude/oublier') {
      try { oublierDemande(projet()); } catch (e) { throw new ErreurHttp(409, e.message); }
      return envoyerJson(res, 200, {ok: true});
    }
    // — Après le montage, avant la publication : l'analyse de viralité et le plan de partage —
    if (req.method === 'GET' && p === '/api/publication/videos') return envoyerJson(res, 200, {videos: listerVideos(projet())});
    if (req.method === 'GET' && p === '/api/publication/analyse') {
      try { return envoyerJson(res, 200, etatAnalyse(projet(), url.searchParams.get('video'))); } catch (e) { throw new ErreurHttp(400, e.message); }
    }
    if (req.method === 'POST' && p === '/api/publication/analyse') {
      const {video, arreter = false, qualite = null} = await lireCorps(req);
      const P = projet();
      try {
        if (arreter) arreterAnalyse(P, video);
        else { const r = lireReglages(); lancerAnalyse(P, video, {moteur: r.ia_moteur ?? null, qualite: qualite === 'rapide' ? 'rapide' : 'soigne'}); }
        return envoyerJson(res, 200, etatAnalyse(P, video));
      } catch (e) { throw new ErreurHttp(400, e.message); }
    }
    if (req.method === 'GET' && p === '/api/publication/plan') {
      try { return envoyerJson(res, 200, etatPlan(projet(), url.searchParams.get('video'))); } catch (e) { throw new ErreurHttp(400, e.message); }
    }
    if (req.method === 'POST' && p === '/api/publication/plan') {
      const {video, arreter = false, reseaux, consigne = '', qualite = null} = await lireCorps(req);
      const P = projet();
      try {
        if (arreter) arreterPlan(P, video);
        else { const r = lireReglages(); lancerPlan(P, video, {reseaux, consigne, moteur: r.ia_moteur ?? null, qualite: qualite === 'rapide' ? 'rapide' : 'soigne'}); }
        return envoyerJson(res, 200, etatPlan(P, video));
      } catch (e) { throw new ErreurHttp(400, e.message); }
    }
    if (req.method === 'PUT' && p === '/api/publication/plan') {
      const {video, reseaux} = await lireCorps(req);
      try { return envoyerJson(res, 200, {plan: enregistrerPlan(projet(), video, reseaux)}); } catch (e) { throw new ErreurHttp(400, e.message); }
    }
    // Le profil du créateur : ce que l'IA a appris de ses comptes (lib/createur.mjs). Un seul profil, pour tous les projets.
    if (req.method === 'GET' && p === '/api/createur') return envoyerJson(res, 200, await etatProfil());
    if (req.method === 'POST' && p === '/api/createur/analyser') {
      const {moteur, qualite, mot} = await lireCorps(req);
      await lancerProfil({moteur, qualite, mot});
      return envoyerJson(res, 200, await etatProfil());
    }
    if (req.method === 'POST' && p === '/api/createur/arreter') { arreterProfil(); return envoyerJson(res, 200, await etatProfil()); }
    if (req.method === 'POST' && p === '/api/createur/donner') { const {actif} = await lireCorps(req); changerProfil(actif !== false); return envoyerJson(res, 200, await etatProfil()); }
    if (req.method === 'DELETE' && p === '/api/createur') { effacerProfil(); return envoyerJson(res, 200, await etatProfil()); }
    // Treg, vu par Dérush : la clé marche-t-elle, quels réseaux sont reliés ?
    if (req.method === 'GET' && p === '/api/treg') {
      const ia = await etatIA();
      return envoyerJson(res, 200, {...etatTreg(ia.choisi), verification: await verifierTreg(url.searchParams.has('force'))});
    }
    if (req.method === 'GET' && p === '/api/retours') return envoyerJson(res, 200, {retours: lireRetours(projet())});
    if (req.method === 'POST' && p === '/api/retours/marquer') {
      const {cle, etat} = await lireCorps(req);
      marquerRetour(projet(), cle, etat);
      return envoyerJson(res, 200, {ok: true});
    }
    if (req.method === 'POST' && p === '/api/ouvrir') {
      const {chemin} = await lireCorps(req);
      const c = path.resolve(String(chemin ?? ''));
      const dansProjet = ctx.P && (c === ctx.P.racine || c.startsWith(ctx.P.racine + path.sep));
      // seulement un dossier du projet ouvert, ou le dossier d'un projet Dérush (bibliothèque)
      if (!(dansProjet || fs.existsSync(path.join(c, 'derush.json'))) || !fs.existsSync(c)) throw new ErreurHttp(400, 'Chemin hors des projets.');
      // un fichier se montre dans le Finder (sélectionné) ; un dossier s'ouvre
      montrer(c);
      return envoyerJson(res, 200, {ok: true});
    }
    throw new ErreurHttp(404, 'Route inconnue.');
  };

  const serveur = http.createServer(async (req, res) => {
    try {
      // seuls 127.0.0.1 et localhost sont acceptés (protection contre le « DNS rebinding »)
      const hote = (req.headers.host ?? '').replace(/:\d+$/, '');
      if (!['127.0.0.1', 'localhost'].includes(hote)) throw new ErreurHttp(403, 'Hôte refusé.');
      await routes(req, res, new URL(req.url, 'http://127.0.0.1'));
    } catch (e) {
      if (res.headersSent) return res.end();
      envoyerJson(res, e.code ?? 500, {erreur: e.message, ...(e.extra ?? {})});
      if (!e.code) console.error(e);
    }
  });

  return new Promise((ok, ko) => {
    const essayer = (pt, reste) => {
      serveur.once('error', (e) => (e.code === 'EADDRINUSE' && reste > 0 ? essayer(pt + 1, reste - 1) : ko(e)));
      serveur.listen(pt, '127.0.0.1', () => ok({serveur, port: pt, url: `http://127.0.0.1:${pt}/`}));
    };
    essayer(port, essais);
  });
}
