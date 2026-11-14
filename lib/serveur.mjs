// Dérush — serveur local (127.0.0.1 seulement). Il sert l'interface, lit les rushes et lance les traitements.
// Toute requête porte le jeton de la session : une page web étrangère ne peut rien demander au serveur.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {pipeline} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {VERSION, EXT_MEDIAS, EXT_VIDEOS, EXT_SONS, EXT_IMAGES, nouvelId} from './commun.mjs';
import {POLICE, lancer, ffmpeg, lireJson, ecrireJson, arreterEnfants} from './outils.mjs';
import {ajouterMedia, ajouterMedias, retirerMedia, preparer, fichierLecture, isolerVoix, infosTechniques, besoinVersion} from './medias.mjs';
import {lancerAnalyseIA, etatAnalyseIA, arreterAnalyseIA, oublierAnalyseIA, lireMesures, lireAnalyseIA} from './analyse.mjs';
import {voixClaire, FORCES, echoPossible, deepFilter} from './son.mjs';
import {listeProfils, REGLAGES_COULEUR, filtreLut, cleLut} from './couleurs.mjs';
import {moteurs, transcrire, lireFichierTranscription, enregistrer} from './transcription.mjs';
import {etatMoteurs, installer, etatBlender, oublierBlender} from './moteurs.mjs';
import {exporterPack} from './pack.mjs';
import {creerVideo, etatRendu, installerRendu} from './rendu.mjs';
import {masquesMedia, dossierMasques} from './detourage.mjs';
import {etatElevenLabs, brancherElevenLabs, credits, listerVoix, STUDIO, MODELES_IMAGE, MODELES_VIDEO, LANGUES_DOUBLAGE, listerCreations, nouvelleCreation, lancerCreation, retirerCreation, etatBruitages, lancerBruitages, retirerBruitages, bruitageElevenLabs} from './elevenlabs.mjs';
import {MODELES, EFFORTS, QUALITES, RESEAUX, etatClaude, etatCodex, etatIA, claudeTravaille, etatDemande, demander, ajouterMessage, arreterDemande, arreterToutesLesDemandes, oublierDemande, decoupeDeClaude, synchroniserDemande, fichierDirect, fichierVue} from './claude.mjs';
import {IA, installerClaude, connecterClaude, lancerInstallationCodex, connecterCodex, installerGemini, connecterGemini, etatGemini, actionEnCours, oublierEtats, moteurChoisi} from './ia.mjs';
import {etatTreg, changerTreg, enregistrerJetonTreg, retirerJetonTreg, verifierTreg} from './treg.mjs';
import {etatProfil, lancerProfil, arreterProfil, changerProfil, effacerProfil} from './createur.mjs';
import {listerVideos, lancerAnalyse, etatAnalyse, arreterAnalyse, lancerPlan, etatPlan, arreterPlan, enregistrerPlan, textesDuPlan, fichierPlanche, publicationEnCours} from './publication.mjs';
import {arreterConseils, conseilEnCours} from './conseil.mjs';
import {etatSons, changerSons, dossierSons, telechargerRealSfx, installerEarshot, verifierEarshot, oublierEarshot} from './sons.mjs';
import {lireReglages, changerReglages} from './reglages.mjs';
import {listerCompetences, remotionPresent, telechargerRemotion} from './competences.mjs';
import {etatMaj, verifierMaj, mettreAJour, redemarrer, resumeMaj, plusTard, marquerVue, programmerMaj} from './maj.mjs';
import {installerBlender} from './installation.mjs';
import {ROLES, piece, listerPieces, ajouterPieces, televerserPiece, retirerPiece, changerRole, cheminApercu} from './pieces.mjs';
import {commencerEnregistrement, ajouterMorceau, terminerEnregistrement, annulerEnregistrement, enregistrementEnCours} from './enregistrement.mjs';
import {etatDrive, changerDrive, envoyerSurDrive, dossiersDrive} from './drive.mjs';
import {routesDrive, driveOccupe, arreterDrive} from './drive-medias.mjs';
import {routesVoixOff} from './voix-off.mjs';
import {routesSequences, donneesSequence} from './sequences.mjs';
import {choisirFichiers as choisirSysteme, montrer, ouvrir as ouvrirSysteme, dossierSupport, dossierVideos, mettreDossierALaCorbeille, NOM_SYSTEME, SYSTEME, MAC} from './plateforme.mjs';
import {lireRetours, marquerRetour} from './retours.mjs';
import {lireCarnet, retirerLecon, viderCarnet, ajouterLecons} from './carnet.mjs';
import {lireEspaces, trouverEspace, espaceDuProjet, creerClient, changerEspace, retirerEspace, noterDernier, poserLogo, cheminLogo, devinerMetier, apprend, METIERS} from './espaces.mjs';
import {noterVideo, leconDeNote, ficheDe, rattacherPublication} from './fiches.mjs';
import {listerSeries, lireSerie, creerSerie, retirerSerie, reglagesEpisode, compterEpisode, dossierSerie} from './series.mjs';
import {enregistrerPublication, relireChiffres, idDepuisLien, programmerSuivi} from './suivi.mjs';
import {tableauDeBord, vignettesDe, rapport} from './tableau.mjs';
import {lancerAnalyseRecette, lancerLectureIA, etatApprentissage, arreterApprentissage} from './apprentissage-ia.mjs';
import {lireProfil} from './createur.mjs';
import {menageTemporaire, placeLibre} from './disque.mjs';
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
  // les mêmes dossiers sur les trois systèmes (sous Linux, ils portent parfois leur nom français) ; un dossier absent est sauté
  const noms = ['Desktop', 'Bureau', 'Downloads', 'Téléchargements', 'Documents', 'Pictures', 'Images'];
  const maison = [...new Set([dossierVideos(), ...noms.map((d) => path.join(os.homedir(), d))])].filter((d) => fs.existsSync(d));
  let volumes = [];
  try { volumes = fs.readdirSync('/Volumes').map((v) => path.join('/Volumes', v)).filter((v) => { try { return fs.realpathSync(v) !== '/'; } catch { return false; } }); } catch { /* pas de disque externe */ }
  return {maison, volumes};
}
const DOSSIERS_IGNORES = /^(Library|node_modules|\.git|__pycache__|CodexBuilds|DerivedData|Pods|venv|\.venv)$|\.(app|photoslibrary|fcpbundle|imovielibrary|musiclibrary|tvlibrary|bundle|framework)$/i;

/**
 * Sans Spotlight (dossier non indexé) : une seule exploration, en largeur (les dossiers proches d'abord),
 * pour tous les fichiers cherchés, limitée à quelques secondes. Renvoie une Map index → chemin.
 */
async function chercherAPied(cherches) {
  const trouves = new Map();
  const restants = new Map(cherches.map((c) => [c.voulu, c]));
  const {maison, volumes} = dossiersProbables();
  // 3,5 s au plus dans tes dossiers, puis 2,5 s au plus sur les disques externes
  for (const [racines, delaiMs] of [[maison, 3500], [volumes, 2500]]) await explorer(racines, delaiMs, restants, trouves);
  return trouves;
}
/**
 * L'exploration ne fige jamais le serveur : les dossiers sont lus sans bloquer, huit à la fois, si bien que la lecture
 * d'une vidéo, le direct de l'IA et les signes de vie continuent pendant qu'on cherche (avant, tout attendait jusqu'à 6 s).
 */
async function explorer(racines, delaiMs, restants, trouves) {
  const file = racines.map((d) => [d, 0]);
  const vus = new Set();
  const fin = Date.now() + delaiMs;
  const fini = () => !restants.size || Date.now() >= fin;
  const lire = async ([d, prof]) => {
    let entrees;
    try {
      // les raccourcis (liens) vers un disque externe sont suivis, sans jamais repasser deux fois au même endroit
      const vrai = await fs.promises.realpath(d);
      if (vus.has(vrai)) return;
      vus.add(vrai);
      entrees = await fs.promises.readdir(d, {withFileTypes: true});
    } catch { return; }
    for (const e of entrees) {
      if (!restants.size) return;
      if (e.name.startsWith('.')) continue;
      const c = path.join(d, e.name);
      let dossier = e.isDirectory();
      let fichier = e.isFile();
      if (e.isSymbolicLink()) {
        try { const st = await fs.promises.stat(c); dossier = st.isDirectory(); fichier = st.isFile(); } catch { continue; }
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
  };
  const recherche = (async () => {
    for (let k = 0; k < file.length && !fini();) {
      const lot = file.slice(k, k + 8);
      k += lot.length;
      await Promise.all(lot.map(lire));
    }
  })();
  // un disque qui se réveille peut retenir une seule lecture bien plus longtemps que la limite : la réponse, elle, n'attend pas
  let minuteur;
  await Promise.race([recherche, new Promise((ok) => { minuteur = setTimeout(ok, delaiMs + 250); })]);
  clearTimeout(minuteur);
}

/** Fait `fn` sur chaque élément, `n` à la fois au plus (jamais 200 programmes lancés d'un coup). */
async function parLots(liste, n, fn) {
  const res = new Array(liste.length);
  let k = 0;
  await Promise.all(Array.from({length: Math.min(n, liste.length)}, async () => {
    while (k < liste.length) { const i = k++; res[i] = await fn(liste[i], i); }
  }));
  return res;
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
  // Spotlight n'existe que sur Mac ; la suite (les dossiers déjà connus, puis les dossiers habituels) marche partout
  const res = !MAC ? fichiers.map(() => null) : await parLots(fichiers, 6, async ({nom, taille, modifie}) => {
    if (!nom) return null;
    const voulu = String(nom).normalize('NFC');
    try {
      const exact = String(nom).replace(/["\\]/g, '\\$&');
      const {out} = await lancer('mdfind', [`kMDItemFSName == "${exact}"cd`]);
      for (const c of out.toString().split('\n')) if (c && memeFichier(c, voulu, taille, modifie)) return c;
    } catch { /* Spotlight indisponible */ }
    return null;
  });
  let cherches = fichiers.map((f, index) => ({index, voulu: String(f.nom ?? '').normalize('NFC'), taille: f.taille, modifie: f.modifie})).filter((x) => x.voulu && !res[x.index]);
  // d'abord les dossiers d'où tu as déjà importé (souvent le même dossier de tournage)
  if (cherches.length) {
    for (const d of dossiersConnus(ctx)) {
      for (const x of cherches) if (!res[x.index] && memeFichier(path.join(d, x.voulu), x.voulu, x.taille, x.modifie)) res[x.index] = path.join(d, x.voulu);
    }
    cherches = cherches.filter((x) => !res[x.index]);
  }
  if (cherches.length) for (const [index, c] of await chercherAPied(cherches)) res[index] = c;
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
        : usage === 'lut'
          ? 'Choisis le LUT de ta caméra (un fichier .cube, donné par le fabricant)'
          : usage === 'logo'
            ? 'Choisis le logo (une image PNG, JPEG, WebP ou SVG)'
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

/**
 * Ce qu'on dit à la personne quand c'est le système qui refuse (disque plein, dossier verrouillé, disque débranché…) :
 * une phrase en français, jamais un code. Une erreur ordinaire garde son propre message.
 */
function messageSysteme(e) {
  switch (e?.code) {
    case 'ENOSPC': case 'EDQUOT': return 'Le disque est plein : libère de la place, puis réessaie.';
    case 'EACCES': case 'EPERM': case 'EROFS': return 'Dérush n’a pas le droit d’écrire ici (disque verrouillé ou en lecture seule ?).';
    case 'ENOENT': case 'ENOTDIR': case 'EIO': case 'ENXIO': return 'Un fichier ou un dossier est introuvable (disque débranché, fichier déplacé ?).';
    case 'EBUSY': return 'Ce fichier est utilisé par un autre programme : réessaie dans un instant.';
    case 'EMFILE': case 'ENFILE': return 'Trop de fichiers sont ouverts en même temps : réessaie dans un instant.';
    case 'ECONNRESET': case 'ECONNABORTED': case 'EPIPE': case 'ERR_STREAM_PREMATURE_CLOSE': return 'La requête a été interrompue.';
    default: return typeof e?.code === 'string' && e.syscall ? 'Le système a refusé l’opération : réessaie.' : String(e?.message ?? e ?? 'Erreur inattendue.');
  }
}

/**
 * Répond à une requête qui a échoué, sans jamais échouer à son tour. Seule une ErreurHttp choisit son statut : une
 * erreur du système porte un code en lettres (« ENOSPC », « EACCES », « ECONNRESET »), qui, pris pour un statut, faisait
 * tomber tout Dérush (disque plein, dossier en lecture seule, copie interrompue).
 */
function repondreErreur(res, e) {
  try {
    const voulue = Number.isInteger(e?.code) && e.code >= 400 && e.code <= 599;
    const interrompue = ['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ERR_STREAM_PREMATURE_CLOSE'].includes(e?.code);
    if (!voulue && !interrompue) console.error(e);
    // la réponse est déjà partie en entier : rien à ajouter ; à moitié partie, ou plus personne au bout : on coupe
    if (res.writableEnded) return;
    if (res.headersSent || res.destroyed) { res.destroy(); return; }
    envoyerJson(res, voulue ? e.code : ['ENOSPC', 'EDQUOT'].includes(e?.code) ? 507 : 500, {erreur: voulue ? e.message : messageSysteme(e), ...(e?.extra ?? {})});
  } catch {
    try { res.destroy(); } catch { /* plus rien à couper */ }
  }
}

/** Envoie un fichier en gérant les plages d'octets (indispensable pour se déplacer dans une vidéo). */
function envoyerFichier(req, res, fichier, type) {
  // le fichier a pu partir entre-temps (un aperçu refait, un disque débranché)
  let st;
  try { st = fs.statSync(fichier); } catch { throw new ErreurHttp(404, 'Introuvable.'); }
  if (!st.isFile()) throw new ErreurHttp(404, 'Introuvable.');
  // pipeline referme le fichier quand la fenêtre abandonne la lecture (chaque saut dans une vidéo en abandonne une :
  // avec .pipe, le fichier restait ouvert pour toujours) et coupe la réponse si le fichier devient illisible, au lieu
  // de faire tomber Dérush
  const envoyer = (flux) => pipeline(flux, res, () => {});
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
    envoyer(fs.createReadStream(fichier, {start: a, end: b}));
  } else {
    res.writeHead(200, {'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache'});
    envoyer(fs.createReadStream(fichier));
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
    // une requête coupée en route (fenêtre fermée ou rechargée) : une erreur ordinaire, jamais un code du système
    const coupee = () => ko(new ErreurHttp(400, 'Requête interrompue.'));
    req.on('error', coupee);
    req.on('close', () => { if (!req.complete) coupee(); });
  });
}

/** Pas assez de place pour le fichier envoyé (rush, référence, pièce jointe) : on le dit avant de commencer, pas au bout de dix minutes de copie. */
function verifierPlaceEnvoi(req, dossier) {
  const taille = Number(req.headers['content-length']);
  const libre = placeLibre(dossier);
  if (libre != null && Number.isFinite(taille) && taille + 200e6 > libre) {
    throw new ErreurHttp(507, 'Il n’y a pas assez de place sur le disque pour copier ce fichier dans le projet : libère de la place, puis réessaie.');
  }
}

/**
 * Écrit le corps d'une requête dans un fichier (un rush ou une référence copiés dans le projet). Si la copie s'arrête
 * en route (fenêtre fermée, disque plein), le fichier à moitié écrit ne reste pas dans le projet, et la raison est dite.
 */
async function recevoirFichier(req, cible) {
  verifierPlaceEnvoi(req, path.dirname(cible));
  const sortie = fs.createWriteStream(cible);
  try {
    await new Promise((ok, ko) => pipeline(req, sortie, (e) => (e ? ko(e) : ok())));
  } catch (e) {
    // on attend que le fichier soit refermé (Windows refuse d'effacer un fichier encore ouvert), puis on l'efface
    await new Promise((ok) => (sortie.closed ? ok() : sortie.once('close', ok)));
    fs.rmSync(cible, {force: true});
    const systeme = ['ENOSPC', 'EDQUOT', 'EACCES', 'EPERM', 'EROFS'].includes(e?.code);
    throw new ErreurHttp(['ENOSPC', 'EDQUOT'].includes(e?.code) ? 507 : 400, systeme ? `${messageSysteme(e)} La copie est annulée.` : 'La copie a été interrompue : rien n’a été ajouté.');
  }
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

// ——— la corbeille : jamais les fichiers de la personne ———
const FICHIERS_DU_SYSTEME = /^(\.DS_Store|\.localized|Thumbs\.db|desktop\.ini)$/i;
const MARQUE_NEUF = 'dossier-neuf'; // dans .derush/ : ce dossier était vide quand Dérush y a créé le projet

/**
 * Un dossier dont Dérush ne fait pas un projet (il écrirait le sien au milieu de tout) : la racine d'un disque, le
 * dossier personnel, le Bureau, les Documents, les Téléchargements, les Vidéos, et tout autre dossier rangé juste dans
 * le dossier personnel (Images, Musique, Bibliothèque…) sauf un dossier neuf, encore tout à fait vide, que la personne
 * vient d'y créer. Un projet déjà là (derush.json) s'ouvre toujours.
 */
function dossierTropLarge(d) {
  if (fs.existsSync(path.join(d, 'derush.json'))) return false;
  const maison = os.homedir();
  if (path.dirname(d) === d || d === maison) return true;
  // un disque branché (/Volumes/…, /media/…) : son dossier n'est pas sur le même disque que celui qui le contient
  try { if (fs.statSync(d).dev !== fs.statSync(path.dirname(d)).dev) return true; } catch { /* illisible : on regarde la suite */ }
  if ([path.join(maison, 'Desktop'), path.join(maison, 'Documents'), path.join(maison, 'Downloads'), dossierVideos()].includes(d)) return true;
  if (path.dirname(d) !== maison) return false;
  // les dossiers du système y portent une marque (.localized sur Mac, desktop.ini sur Windows) : ils ne sont pas vides
  try { return !fs.readdirSync(d).every((n) => n === '.DS_Store'); } catch { return true; }
}
// les sous-dossiers qu'un projet remplit lui-même (copies, enregistrements, créations, vidéos faites, cache)
const SOUS_DOSSIERS_DE_DERUSH = new Set(['.derush', 'rushes', 'references', 'enregistrements', 'creations', 'vidéos', 'exports', 'claude']);

/**
 * Un dossier que Dérush a rempli lui-même : rangé dans la bibliothèque, ou vide le jour où le projet y a été créé.
 * Tout autre dossier (un dossier de tournage ouvert comme projet) est d'abord celui de la personne. Et même dans un
 * dossier de Dérush, un rush ou une référence lus sur place (posés là par la personne, hors des sous-dossiers que
 * Dérush remplit) sont à elle : le dossier entier ne part plus avec eux.
 */
function dossierDeDerush(d) {
  if (d === RACINE_BIBLIO || RACINE_BIBLIO.startsWith(d + path.sep) || d === os.homedir()) return false;
  if (!(path.dirname(d) === RACINE_BIBLIO || fs.existsSync(path.join(d, '.derush', MARQUE_NEUF)))) return false;
  const j = lireJson(path.join(d, 'derush.json'));
  for (const x of [...(j?.medias ?? []), ...(j?.references ?? [])]) {
    if (!x?.chemin) continue;
    const rel = path.relative(d, path.resolve(String(x.chemin)));
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel) && !SOUS_DOSSIERS_DE_DERUSH.has(rel.split(path.sep)[0].normalize('NFC'))) return false;
  }
  return true;
}

/**
 * Retire un projet d'un dossier qui est d'abord celui de la personne : seul ce que Dérush y a écrit pour lui
 * (derush.json et .derush/) part à la corbeille, dans un dossier à son nom. Le dossier lui-même, ses rushes d'origine
 * et ses vidéos restent à leur place (avant, tout le dossier partait, alors que l'avertissement disait le contraire).
 */
function retirerProjetDuDossier(d) {
  const lot = fs.mkdtempSync(path.join(d, '.derush-corbeille-'));
  const paquet = path.join(lot, `Projet Dérush - ${path.basename(d)}`.slice(0, 120));
  const pieces = ['derush.json', '.derush'].filter((n) => fs.existsSync(path.join(d, n)));
  try {
    fs.mkdirSync(paquet);
    for (const n of pieces) fs.renameSync(path.join(d, n), path.join(paquet, n));
    mettreDossierALaCorbeille(paquet);
  } catch (e) {
    // la corbeille a refusé : tout revient à sa place
    for (const n of pieces) {
      try { if (fs.existsSync(path.join(paquet, n)) && !fs.existsSync(path.join(d, n))) fs.renameSync(path.join(paquet, n), path.join(d, n)); } catch { /* resté dans le paquet, jamais effacé */ }
    }
    throw e;
  } finally {
    // ne s'effacent que vides
    for (const x of [paquet, lot]) { try { fs.rmdirSync(x); } catch { /* déjà parti, ou il y reste quelque chose */ } }
  }
}

/**
 * La clé de la fenêtre : un secret durable, rangé dans le dossier de Dérush et lisible par la personne seule (0600).
 * Quand le lanceur la donne à demarrerServeur ({cle}), la page d'accueil — qui porte le jeton de la session — n'est
 * servie qu'à l'adresse qui porte cette clé (« /?c=… »). Un autre compte du même ordinateur partage 127.0.0.1 mais ne
 * peut pas lire ce dossier : il n'obtient plus le jeton, donc plus aucun droit.
 */
export function cleFenetre() {
  const f = path.join(dossierSupport(), 'cle-fenetre');
  const lire = () => { try { const c = fs.readFileSync(f, 'utf8').trim(); return /^[a-f0-9]{48}$/.test(c) ? c : null; } catch { return null; } };
  let cle = lire();
  if (!cle) {
    cle = crypto.randomBytes(24).toString('hex');
    try {
      fs.mkdirSync(path.dirname(f), {recursive: true});
      fs.writeFileSync(f, cle, {mode: 0o600, flag: 'wx'});
    } catch (e) {
      // un autre lancement vient de l'écrire : c'est la sienne qui compte ; un fichier abîmé est refait
      const autre = e?.code === 'EEXIST' ? lire() : null;
      if (autre) cle = autre;
      else { try { fs.rmSync(f, {force: true}); fs.writeFileSync(f, cle, {mode: 0o600}); } catch { /* dossier illisible : la clé ne vaut que pour ce lancement */ } }
    }
  }
  try { fs.chmodSync(f, 0o600); } catch { /* sans droits à régler (Windows) : ceux du dossier personnel s'appliquent */ }
  return cle;
}
const memeCle = (a, b) => {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};
/**
 * Ce que « ?force= » demande de revérifier (Connexions, la Mise en route, l'éditeur). Absent : rien. « 1 » ou vide : tout.
 * Sinon des noms séparés par des virgules : claude, codex, gemini, ia (les trois), blender, earshot ; un nom inconnu
 * (realsfx) est ignoré. `ia` va tel quel à etatIA et oublierEtats (lib/ia.mjs) : false, true (« ia » ou tout : agy n'est
 * relancé que si Gemini sert, voir geminiSert) ou la liste des assistants nommés.
 */
export function forceDemandee(url) {
  if (!url.searchParams.has('force')) return {tout: false, ia: false, noms: []};
  const brut = String(url.searchParams.get('force')).trim().toLowerCase();
  if (brut === '' || brut === '1') return {tout: true, ia: true, noms: []};
  const noms = brut.split(',').map((n) => n.trim()).filter(Boolean);
  const nommes = ['claude', 'codex', 'gemini'].filter((n) => noms.includes(n));
  // « ia » : les trois, comme « tout » ; Gemini nommé en plus est revérifié pour de bon
  const ia = noms.includes('ia') ? (nommes.includes('gemini') ? ['claude', 'codex', 'gemini'] : true) : nommes.length ? nommes : false;
  return {tout: false, ia, noms};
}

/** Ce que reçoit une demande de la page qui n'y a pas droit (un cadre dans une autre page, une adresse sans la clé) : jamais le jeton. */
const PAGE_REFUSEE = '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Dérush</title><body style="margin:0;height:100vh;display:grid;place-items:center;background:#141416;color:#f2f2f4;font:16px/1.5 -apple-system,system-ui,sans-serif"><p style="max-width:26em;padding:0 24px;text-align:center"><b>Dérush s’ouvre depuis son icône.</b><br><span style="opacity:.65">Cette adresse seule ne suffit pas : ferme cette page, puis lance Dérush comme d’habitude.</span></p></body></html>';

/**
 * ctx : {P (projet ouvert ou null), file, ouvrir(dossier), fermer(), app}
 */
const NE = Date.now(); // l'heure de ce lancement

/**
 * `cle` : la clé de la fenêtre (cleFenetre()), quand le lanceur ouvre la fenêtre à l'adresse qui la porte. Sans elle,
 * la page d'accueil est servie à toute demande locale, comme avant.
 */
export function demarrerServeur(ctx, {port = 4321, essais = 10, modeApp = false, cle = null} = {}) {
  // le ménage : les dossiers temporaires de Dérush de plus de 6 heures (un rendu interrompu, un essai arrêté)
  try { menageTemporaire(); } catch { /* rien de grave */ }
  // le suivi des vues : les chiffres dus relus par Treg (avec la clé), au démarrage puis toutes les 3 heures
  try { programmerSuivi(); } catch { /* sans suivi */ }
  const actionsConnexions = new Map(); // blender, remotion… : {etat, message}
  const JETON = crypto.randomBytes(18).toString('hex');
  const file = ctx.file;
  ctx.dernierSigne = Date.now();
  // les fenêtres ouvertes (identifiant → dernier signe de vie) et la fenêtre principale, seule autorisée à modifier
  ctx.fenetres = new Map();
  ctx.fenetrePrincipale = null;
  ctx.fermeeA = 0;
  ctx.demarreA = Date.now();
  /**
   * Un travail est-il en cours ? La file (préparations, exports, rendus), l'IA qui monte, une analyse faite par l'IA
   * (viralité, plan de partage, profil, recette, médias, questions de la voix off), une prise de voix ou de caméra, une
   * recherche ou un import « Depuis mon Drive ». C'est la seule réponse du serveur à cette question : la mise à jour, la
   * corbeille et « occupe » (la fenêtre qui se ferme) lisent la même.
   */
  const travailEnCours = () => !!(file?.enCours || file?.attente.length || claudeTravaille() || conseilEnCours() || publicationEnCours() || enregistrementEnCours() || driveOccupe());
  // les projets ouverts depuis le dernier moment de calme : un travail en cours ne peut venir que de l'un d'eux
  const ouverts = new Set(ctx.P ? [ctx.P.racine] : []);
  const noterOuvert = (d) => { if (!travailEnCours()) ouverts.clear(); ouverts.add(path.resolve(d)); };
  // l'aperçu avant/après des couleurs : une seule fabrication à la fois par rush (dossier du rush → la fabrication en cours)
  const apercusCouleur = new Map();
  // le dernier état connu des trois IA : la relecture du travail en cours ne relance pas leurs vérifications
  let iaVue = null;
  const lireIA = async (force = false) => (iaVue = await etatIA(force));
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
      // Jamais dans le cadre d'une autre page : un site ouvert à côté pourrait y cacher Dérush sous de faux boutons, et
      // ce cadre prendrait la place de la fenêtre principale. Les en-têtes l'interdisent au navigateur ; une demande
      // qui s'annonce comme un cadre, ou qui n'a pas la clé de la fenêtre (quand il y en a une), ne reçoit pas le jeton.
      // Et seuls les scripts servis par Dérush s'exécutent : un attribut on… glissé dans la page ne ferait rien.
      const entetes = {'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "frame-ancestors 'none'; script-src 'self'"};
      const cadre = ['iframe', 'frame', 'embed', 'object', 'fencedframe'].includes(req.headers['sec-fetch-dest']);
      if (cadre || (cle && !memeCle(url.searchParams.get('c'), cle))) {
        res.writeHead(403, entetes);
        return res.end(PAGE_REFUSEE);
      }
      res.writeHead(200, entetes);
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
    if (req.method === 'GET' && p === '/api/ping') return envoyerJson(res, 200, {derush: true, version: VERSION, ne: NE, fenetres: ctx.fenetres.size, occupe: travailEnCours()});

    // — fichiers (jeton dans l'adresse : les balises <video> ne peuvent pas envoyer d'en-tête) —
    // les couleurs de la caméra : avant / après, sur une image du rush (l'original à gauche, converti à droite)
    if ((x = m(/^\/media\/(M\d+)\/couleur-apercu$/))) {
      if (url.searchParams.get('j') !== JETON) throw new ErreurHttp(403, 'Jeton manquant.');
      const P = projet();
      const me = P.media(x[1]);
      if (!me || me.type !== 'video') throw new ErreurHttp(404, 'Rush inconnu.');
      const profil = url.searchParams.get('profil') ?? 'normal';
      const im = lireMesures(P, me)?.image;
      const essai = {...me, couleur: profil === 'lut' ? {profil, lut_fichier: url.searchParams.get('lut') || me.couleur?.lut_fichier} : profil === 'auto' || profil === 'dlogm' ? {profil: 'auto', ombres: im?.ombres ?? 0.12, lumieres: im?.hautes_lumieres ?? 0.7} : {profil}};
      // les mesures de l'original (pas de l'aperçu déjà converti) pour la conversion automatique
      const filtre = filtreLut(essai);
      const t = Math.max(0, Math.min(me.duree - 0.1, Number(url.searchParams.get('t')) || me.duree * 0.4));
      // Un fichier par réglage (rush, profil, LUT, instant). Avant, toutes les demandes écrivaient « apercu-couleur.jpg » :
      // en passant vite d'un profil à l'autre, l'image montrée était souvent celle d'un autre profil. Revenir à un
      // profil déjà vu est maintenant immédiat.
      const D = P.dossierMedia(me.id);
      let empreinte = '';
      try { const st = fs.statSync(me.chemin); empreinte = `${st.size}:${Math.round(st.mtimeMs)}`; } catch { /* rush parti : FFmpeg le dira */ }
      const cleApercu = crypto.createHash('sha1').update(JSON.stringify([me.chemin, empreinte, filtre, cleLut(essai), t.toFixed(2)])).digest('hex').slice(0, 12);
      const sortie = path.join(D, `apercu-couleur-${cleApercu}.jpg`);
      if (!fs.existsSync(sortie)) {
        // Une seule fabrication à la fois pour ce rush : celle-ci attend la précédente, et ne part pas du tout si la
        // page ne l'attend plus (un autre profil a été choisi entre-temps). Dix choix rapides ne lancent plus dix FFmpeg.
        const avant = apercusCouleur.get(D) ?? Promise.resolve();
        const fabrication = avant.catch(() => {}).then(async () => {
          if (res.destroyed || fs.existsSync(sortie)) return;
          // écrit à côté puis renommé : jamais une image à moitié écrite ; réduit avant la conversion (le LUT d'une image 4K coûtait cher pour rien)
          const tmp = path.join(D, `apercu-couleur-${cleApercu}.${crypto.randomBytes(4).toString('hex')}.part.jpg`);
          try {
            await ffmpeg(['-y', '-ss', t.toFixed(3), '-i', me.chemin, '-frames:v', '1', '-filter_complex', `scale=480:-2,split[a][b];${filtre ? `[b]${filtre}[d];[a][d]` : '[a][b]'}hstack`, '-q:v', '3', tmp]);
            if (!fs.existsSync(tmp)) throw new Error('aucune image à cet instant du rush.');
            fs.renameSync(tmp, sortie);
          } finally { fs.rmSync(tmp, {force: true}); }
          // pas d'empilement : les seize aperçus les plus récents de ce rush suffisent (et l'ancien fichier unique s'en va)
          try {
            fs.rmSync(path.join(D, 'apercu-couleur.jpg'), {force: true});
            const tous = fs.readdirSync(D).filter((n) => /^apercu-couleur-[a-f0-9]{12}\.jpg$/.test(n)).map((n) => ({n, t: fs.statSync(path.join(D, n)).mtimeMs})).sort((a, b) => b.t - a.t);
            for (const v of tous.slice(16)) fs.rmSync(path.join(D, v.n), {force: true});
          } catch { /* le ménage attendra */ }
        });
        apercusCouleur.set(D, fabrication);
        try { await fabrication; } catch (e) { throw new ErreurHttp(500, `Aperçu impossible : ${String(e?.message ?? e).slice(0, 160)}`); } finally { if (apercusCouleur.get(D) === fabrication) apercusCouleur.delete(D); }
        // la page est partie avant son tour : rien n'a été fabriqué, rien à envoyer
        if (!fs.existsSync(sortie)) { res.destroy(); return null; }
      }
      return envoyerFichier(req, res, sortie);
    }
    if ((x = m(/^\/media\/(M\d+)\/(lecture|ondes|vignettes|mots|analyse|cadrage|voix|fond|clair|planche|mesures|ia)$/))) {
      if (url.searchParams.get('j') !== JETON) throw new ErreurHttp(403, 'Jeton manquant.');
      const P = projet();
      const me = P.media(x[1]);
      if (!me) throw new ErreurHttp(404, 'Rush inconnu.');
      const D = path.join(P.cache, 'medias', me.id);
      const f = {lecture: fichierLecture(P, me), voix: path.join(D, 'voix.flac'), fond: path.join(D, 'fond.flac'), clair: path.join(D, 'clair.flac')}[x[2]] ?? path.join(D, `${x[2]}.${['vignettes', 'planche'].includes(x[2]) ? 'jpg' : 'json'}`);
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
    // les demandes qui ne modifient rien (signe de vie, recherche d'un fichier, fenêtre « Ouvrir », l'aperçu d'un import
    // depuis le Drive) restent permises
    const modifie = req.method !== 'GET' && !['/api/signe', '/api/quitter', '/api/localiser', '/api/choisir', '/api/drive/importer/apercu'].includes(p);
    if (modifie && ctx.fenetrePrincipale && fenetre !== ctx.fenetrePrincipale) {
      throw new ErreurHttp(409, 'Dérush est ouvert dans une autre fenêtre.', {remplacee: true});
    }

    if (req.method === 'GET' && p === '/api/etat') {
      const mo = await moteursTout2Suite();
      return envoyerJson(res, 200, {
        version: VERSION, systeme: SYSTEME, mode: ctx.P ? 'projet' : 'bibliotheque', app: !!ctx.app, natif: !!ctx.natif, bibliotheque: RACINE_BIBLIO,
        racine: ctx.P?.racine ?? null, projet: ctx.P?.d ?? null, file: file.etat(), moteurs: mo.moteurs, moteurs_en_attente: mo.attente, police: !!POLICE,
        reglages: {tuto_vu: !!lireReglages().tuto_vu, accueil_vu: !!lireReglages().accueil_vu, disposition: lireReglages().disposition ?? null},
        maj: resumeMaj(), ne: NE,
      });
    }
    if (req.method === 'GET' && p === '/api/file') return envoyerJson(res, 200, {file: file.etat(), medias: ctx.P?.d.medias ?? []});
    if (req.method === 'POST' && p === '/api/signe') return envoyerJson(res, 200, {ok: true});
    if (req.method === 'POST' && p === '/api/quitter') {
      envoyerJson(res, 200, {ok: true});
      // rien ne reste en arrière-plan : les traitements, l'IA et une copie depuis le Drive s'arrêtent avec Dérush
      setTimeout(() => { try { arreterToutesLesDemandes(); arreterConseils(); arreterDrive(); arreterEnfants(); } catch { /* rien à arrêter */ } process.exit(0); }, 300);
      return null;
    }

    // bibliothèque
    if (req.method === 'GET' && p === '/api/bibliotheque') return envoyerJson(res, 200, {racine: RACINE_BIBLIO, projets: listerProjets(), espaces: lireEspaces().espaces.map(({id, nom, type}) => ({id, nom, type})), dernier: lireEspaces().dernier});
    if (req.method === 'POST' && p === '/api/projets') {
      const {titre, espace = null, serie = null} = await lireCorps(req);
      const neuf = creerDossierProjet(titre);
      noterOuvert(neuf);
      const P = ctx.ouvrir(neuf, titre);
      // pour qui (un espace qui existe), et peut-être un épisode d'une série de cet espace
      const e = trouverEspace(espace) ?? trouverEspace(lireEspaces().dernier) ?? trouverEspace('moi');
      const s = serie?.id ? lireSerie(e.id, serie.id) : null;
      if (s) { P.appliquer({...reglagesEpisode(s), espace: e.id}); P.d.serie = {id: s.id, nom: s.nom, espace: e.id}; P.sauver(); compterEpisode(e.id, s.id); }
      else P.appliquer({espace: e.id});
      noterDernier(e.id);
      return envoyerJson(res, 200, {ok: true, racine: P.racine, espace: e.id, serie: P.d.serie ?? null});
    }
    // changer l'espace d'un projet depuis la bibliothèque (sans l'ouvrir : derush.json modifié à part, sans le reste)
    if (req.method === 'POST' && p === '/api/projets/espace') {
      const {dossier, espace} = await lireCorps(req);
      const d = path.resolve(String(dossier ?? ''));
      if (!trouverEspace(espace)) throw new ErreurHttp(400, 'Espace inconnu.');
      // d'abord : un projet parti (à la corbeille) n'est pas réécrit à son ancien endroit, même s'il est encore chargé
      const j = lireJson(path.join(d, 'derush.json'));
      if (!j) throw new ErreurHttp(400, 'Projet introuvable.');
      // Un projet encore chargé (ouvert, ou fermé pendant qu'une tâche y travaille) change par son objet : écrit à part,
      // il serait réécrit avec l'ancien espace au prochain enregistrement de cette tâche.
      const vivant = ctx.projetVivant?.(d) ?? (ctx.P?.racine === d ? ctx.P : null);
      if (vivant) { vivant.appliquer({espace}); return envoyerJson(res, 200, {ok: true}); }
      j.espace = espace;
      // une série appartient à un espace : passé ailleurs, le projet n'en est plus un épisode
      if (j.serie && j.serie.espace !== espace) j.serie = null;
      ecrireJson(path.join(d, 'derush.json'), j, 1);
      return envoyerJson(res, 200, {ok: true});
    }
    if (req.method === 'POST' && p === '/api/projets/ouvrir') {
      const {dossier} = await lireCorps(req);
      const d = path.resolve(String(dossier ?? ''));
      if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) throw new ErreurHttp(400, 'Dossier introuvable.');
      if (dossierTropLarge(d)) throw new ErreurHttp(400, 'Choisis un dossier à l’intérieur, ou un dossier vide : Dérush ne fait pas un projet de ton dossier personnel, de ton Bureau, de tes Documents ni d’un disque entier.');
      // Un dossier vide où Dérush crée le projet lui appartient en entier. Un dossier déjà rempli (un dossier de
      // tournage) reste celui de la personne : « Corbeille » n'y prendra que le projet, jamais ses fichiers.
      let vide = false;
      try { vide = !fs.existsSync(path.join(d, 'derush.json')) && fs.readdirSync(d).every((n) => FICHIERS_DU_SYSTEME.test(n)); } catch { /* illisible : pas vide */ }
      noterOuvert(d);
      const P = ctx.ouvrir(d);
      if (vide) {
        try { fs.mkdirSync(P.cache, {recursive: true}); fs.writeFileSync(path.join(P.cache, MARQUE_NEUF), 'Ce dossier était vide quand Dérush y a créé ce projet.\n'); } catch { /* sans marque : la corbeille ne prendra que le projet */ }
      }
      return envoyerJson(res, 200, {ok: true, racine: P.racine});
    }
    if (req.method === 'POST' && p === '/api/projets/fermer') {
      ctx.fermer();
      return envoyerJson(res, 200, {ok: true});
    }
    if (req.method === 'POST' && p === '/api/projets/corbeille') {
      const {dossier} = await lireCorps(req);
      const d = path.resolve(String(dossier ?? ''));
      if (!fs.existsSync(path.join(d, 'derush.json'))) throw new ErreurHttp(400, 'Ce dossier n’est pas un projet Dérush.');
      // Un travail en cours sur ce projet (préparation, voix, export, IA) continuerait après son départ et le referait
      // à son ancien endroit, réduit à derush.json : il réapparaissait dans la bibliothèque. On attend, ou on arrête.
      if ((ouverts.has(d) || ctx.P?.racine === d) && travailEnCours()) throw new ErreurHttp(409, 'Un travail est encore en cours (préparation, export, IA…) : attends qu’il finisse, ou arrête-le, avant de mettre ce projet à la corbeille.');
      if (ctx.P?.racine === d) ctx.fermer();
      try {
        if (dossierDeDerush(d)) {
          mettreALaCorbeille(d);
          return envoyerJson(res, 200, {ok: true});
        }
        // le dossier de la personne (ouvert comme projet) : seul le projet s'en va, ses fichiers restent
        retirerProjetDuDossier(d);
        return envoyerJson(res, 200, {ok: true, garde: true, message: `Le projet est retiré de Dérush et son montage est dans la corbeille. Le dossier « ${path.basename(d)} » et tes fichiers restent à leur place.`});
      } catch (e) {
        throw new ErreurHttp(400, e?.code === 'EXDEV' ? 'Ce projet est sur un autre disque : Dérush ne peut pas le déplacer dans la corbeille de l’ordinateur. Mets son dossier à la corbeille toi-même.' : typeof e?.code === 'string' ? messageSysteme(e) : e.message);
      }
    }

    // les petits réglages de l'interface (le tutoriel a-t-il été vu ?)
    if (req.method === 'POST' && p === '/api/reglages/interface') {
      const {tuto_vu, accueil_vu, disposition} = await lireCorps(req);
      if (typeof tuto_vu === 'boolean') changerReglages({tuto_vu});
      if (typeof accueil_vu === 'boolean') changerReglages({accueil_vu});
      // la disposition de l'éditeur (largeur des colonnes, hauteur de la timeline), comme on l'a réglée à la souris
      if (disposition === null) changerReglages({disposition: null});
      else if (disposition && typeof disposition === 'object') {
        const d = {};
        for (const k of ['g', 'd', 't']) if (Number.isFinite(Number(disposition[k]))) d[k] = Math.round(Math.min(2000, Math.max(100, Number(disposition[k]))));
        changerReglages({disposition: d});
      }
      return envoyerJson(res, 200, {tuto_vu: !!lireReglages().tuto_vu, accueil_vu: !!lireReglages().accueil_vu});
    }

    // ——— les espaces : pour qui est un projet (Moi, un client, Personne) ———
    if (req.method === 'GET' && p === '/api/espaces') {
      const d = lireEspaces();
      const titres = (() => { try { return listerProjets().filter((x) => (x.espace ?? 'moi') === 'moi').map((x) => x.titre).slice(0, 30); } catch { return []; } })();
      return envoyerJson(res, 200, {dernier: d.dernier,
        espaces: d.espaces.map((e) => ({...e, logo: !!e.marque.logo, apprend: apprend(e), lecons: e.type === 'neutre' ? 0 : lireCarnet(e.id).length, series: e.type === 'neutre' ? 0 : listerSeries(e.id).length})),
        metiers: Object.fromEntries(Object.entries(METIERS).map(([k, m]) => [k, {nom: m.nom, exemples: m.exemples}])),
        metier_propose: devinerMetier({niche: lireProfil()?.niche ?? '', titres})});
    }
    if (req.method === 'POST' && p === '/api/espaces') {
      const {nom, metier = null, marque = {}} = await lireCorps(req);
      try { return envoyerJson(res, 200, {espace: creerClient({nom, metier, marque})}); } catch (e) { throw new ErreurHttp(400, e.message); }
    }
    if (req.method === 'POST' && p === '/api/espaces/dernier') { const {id} = await lireCorps(req); noterDernier(String(id ?? '')); return envoyerJson(res, 200, {ok: true}); }
    {
      const m = /^\/api\/espaces\/([a-z0-9-]{2,40})(?:\/(logo|carnet|series))?(?:\/([a-z0-9-]{2,60}))?$/.exec(p);
      if (m) {
        const [, id, quoi, sous] = m;
        const e = trouverEspace(id);
        if (!e) throw new ErreurHttp(404, 'Espace inconnu.');
        try {
          if (!quoi && req.method === 'PUT') return envoyerJson(res, 200, {espace: changerEspace(id, await lireCorps(req))});
          if (!quoi && req.method === 'DELETE') return envoyerJson(res, 200, {ok: retirerEspace(id)});
          if (quoi === 'logo' && req.method === 'GET') { const l = cheminLogo(e); if (!l || !fs.existsSync(l)) throw new ErreurHttp(404, 'Pas de logo.'); return envoyerFichier(req, res, l); }
          if (quoi === 'logo' && req.method === 'POST') { const {chemin} = await lireCorps(req); return envoyerJson(res, 200, {espace: poserLogo(id, path.resolve(String(chemin ?? '')))}); }
          if (quoi === 'carnet' && req.method === 'GET') return envoyerJson(res, 200, {lecons: lireCarnet(id).slice().reverse()});
          if (quoi === 'carnet' && req.method === 'DELETE' && sous) return envoyerJson(res, 200, {ok: retirerLecon(sous, id)});
          if (quoi === 'carnet' && req.method === 'DELETE') { viderCarnet(id); return envoyerJson(res, 200, {ok: true}); }
          if (quoi === 'series' && req.method === 'GET' && !sous) return envoyerJson(res, 200, {series: listerSeries(id)});
          if (quoi === 'series' && req.method === 'DELETE' && sous) return envoyerJson(res, 200, {ok: retirerSerie(id, sous)});
          if (quoi === 'series' && req.method === 'GET' && sous) { const ds = dossierSerie(id, sous); const a = ds && path.join(ds, 'apercu.jpg'); if (!a || !fs.existsSync(a)) throw new ErreurHttp(404, 'Pas d’aperçu.'); return envoyerFichier(req, res, a); }
        } catch (err) { if (err instanceof ErreurHttp) throw err; throw new ErreurHttp(400, err.message); }
      }
    }
    // ——— une vidéo livrée : sa note (👍 / 👎 et un mot), sa série, sa publication à suivre ———
    // les notes déjà posées sur les vidéos livrées de ce projet, et ce qui les suit (pour les cartes de la conversation)
    if (req.method === 'GET' && p === '/api/claude/notes') {
      const P = projet();
      const d = path.join(P.racine, '.derush', 'fiches');
      const notes = {};
      try { for (const n of fs.readdirSync(d)) { const x = lireJson(path.join(d, n)); if (x?.video) notes[x.video] = {note: x.note ?? null, mot: x.mot ?? null, espace: x.espace ?? null, publications: (x.publications ?? []).map((q) => ({reseau: q.reseau, lien: q.lien ?? null}))}; } } catch { /* aucune fiche */ }
      const e = espaceDuProjet(P);
      return envoyerJson(res, 200, {notes, espace: e ? {id: e.id, nom: e.nom, type: e.type, apprend: apprend(e)} : null, serie: P.d.serie ?? null});
    }
    if (req.method === 'POST' && p === '/api/claude/note') {
      const P = projet();
      const {video, note = 0, mot = ''} = await lireCorps(req);
      const e = espaceDuProjet(P);
      try {
        // la fiche d'avant : l'interface renvoie le mot avec chaque pouce (sinon il serait effacé), il n'est pas nouveau
        const avant = ficheDe(P, String(video ?? ''));
        const fiche = noterVideo(P, String(video ?? ''), {note, mot}, e);
        // Une seule leçon par vidéo dans le carnet, toujours celle d'aujourd'hui. Quand le mot ou le pouce change,
        // l'ancienne leçon s'en va (du carnet de l'espace pour lequel la vidéo a été livrée) : un mot effacé ou remplacé
        // ne reste pas une consigne pour l'IA, et « aimé » ne reste pas écrit sur une vidéo qui ne l'est plus.
        const sansEtat = (t) => String(t ?? '').replace(/ \((?:aimé|pas aimé|sans note)\) : /, ' : ');
        const ancienne = avant?.mot ? leconDeNote(avant) : null;
        const change = fiche.mot !== (avant?.mot ?? null) || fiche.note !== (avant?.note ?? null);
        const carnetDeLaVideo = fiche.espace && trouverEspace(fiche.espace) ? fiche.espace : e?.id;
        let retirees = 0;
        if (ancienne && change && carnetDeLaVideo) {
          for (const x of lireCarnet(carnetDeLaVideo)) if (x.source === 'note' && sansEtat(x.texte) === sansEtat(ancienne) && retirerLecon(x.id, carnetDeLaVideo)) retirees++;
        }
        // Un mot dit ce que la personne veut : il rejoint le carnet de l'espace — s'il est nouveau, ou s'il y était
        // encore (une leçon que la personne a effacée de son carnet n'y revient pas pour un pouce basculé), et si la
        // vidéo a été livrée pour cet espace (un projet passé chez un client après coup ne lui apporte pas les goûts de « Moi »).
        const l = leconDeNote(fiche);
        let ajoutees = 0;
        if (l && (fiche.mot !== (avant?.mot ?? null) || retirees) && apprend(e) && fiche.espace === e.id) ajoutees = ajouterLecons([l], {espace: e.id, projet: P.d.titre ?? null, source: 'note'}).length;
        return envoyerJson(res, 200, {fiche, carnet: ajoutees ? 'ajoute' : retirees ? 'retire' : null});
      } catch (err) { throw new ErreurHttp(400, err.message); }
    }
    if (req.method === 'POST' && p === '/api/series') {
      const P = projet();
      const {video, nom} = await lireCorps(req);
      const e = espaceDuProjet(P);
      const etat = etatDemande(P);
      const v = (etat.versions ?? []).find((x) => (x.videos ?? []).some((y) => y.nom === video));
      const vid = v?.videos?.find((y) => y.nom === video);
      if (!vid) throw new ErreurHttp(400, 'Vidéo introuvable dans ce projet.');
      // une vidéo livrée pour un autre espace (projet passé chez un client après coup) ne devient pas son modèle :
      // l'habillage de « Moi » n'entre jamais dans les épisodes d'un client, ni l'inverse
      const ficheV = ficheDe(P, video);
      if (ficheV?.espace && ficheV.espace !== e.id) throw new ErreurHttp(400, `Cette vidéo a été montée pour « ${trouverEspace(ficheV.espace)?.nom ?? 'un autre espace'} » : elle ne peut pas devenir le modèle d’une série de « ${e.nom} ».`);
      const reponse = [...(etat.echanges ?? [])].reverse().find((x) => x.role !== 'humain' && x.version === v.n)?.texte ?? '';
      try {
        // le dossier de travail de CETTE version (pas celui de la conversation en cours, qui peut être un autre montage)
        const derniere = Math.max(0, ...(etat.versions ?? []).map((x) => x.n ?? 0));
        const atelierV = v.atelier ? path.join(P.racine, v.atelier) : v.n === derniere ? etat.atelier_chemin : null;
        if (!atelierV || !fs.existsSync(atelierV)) throw new Error('Le dossier de travail de ce montage n’existe plus : il ne peut pas devenir un modèle.');
        const serie = creerSerie({P, espaceId: e.id, atelier: atelierV, version: {...v, reponse}, video: vid, fiche: ficheDe(P, video), nom,
          vignettes: path.join(P.racine, 'vidéos', `${String(video).replace(/\.mp4$/i, '')}.vignettes.jpg`)});
        return envoyerJson(res, 200, {serie});
      } catch (err) { throw new ErreurHttp(400, err.message); }
    }
    if (req.method === 'POST' && p === '/api/suivi/lier') {
      const P = projet();
      const {video, lien} = await lireCorps(req);
      const e = espaceDuProjet(P);
      const lu = idDepuisLien(lien);
      if (!lu) throw new ErreurHttp(400, 'Ce lien n’est pas celui d’une vidéo YouTube, TikTok, Instagram ou LinkedIn.');
      const f = ficheDe(P, String(video ?? ''));
      if (!apprend(e)) throw new ErreurHttp(400, e?.type === 'neutre' || !e ? 'Ce projet est rattaché à « Personne » : ses vidéos ne sont pas suivies.' : `« ${e.nom} » n’apprend rien pour l’instant : ses vidéos ne sont pas suivies (réglable dans Mes espaces).`);
      // Les vues d'une vidéo livrée pour un autre espace ne se mêlent pas aux chiffres de celui-ci : elles sont suivies
      // dans l'espace pour lequel elle a été montée (avant, le lien était refusé en disant qu'elles s'y suivaient, et
      // rien ne les suivait nulle part).
      const cible = f?.espace && f.espace !== e.id ? trouverEspace(f.espace) : e;
      if (!apprend(cible)) throw new ErreurHttp(400, cible ? `Cette vidéo a été montée pour « ${cible.nom} », qui n’apprend rien pour l’instant : ses vues ne sont pas suivies (réglable dans Mes espaces).` : 'L’espace pour lequel cette vidéo a été montée n’existe plus : ses vues ne sont pas suivies.');
      const cle = enregistrerPublication(cible.id, {reseau: lu.reseau, id: lu.id, lien: String(lien), cle_fiche: f?.cle ?? null, titre: f?.titre ?? P.d.titre, projet: P.d.titre});
      if (f) rattacherPublication(P, String(video), {reseau: lu.reseau, lien: String(lien), id: lu.id, quand: new Date().toISOString()}, cible);
      return envoyerJson(res, 200, {ok: true, cle, reseau: lu.reseau, espace: {id: cible.id, nom: cible.nom}});
    }
    if (req.method === 'POST' && p === '/api/suivi/relire') {
      const {espace = 'moi'} = await lireCorps(req);
      if (!trouverEspace(espace)) throw new ErreurHttp(400, 'Espace inconnu.');
      return envoyerJson(res, 200, await relireChiffres(espace, {force: true}));
    }
    if (req.method === 'POST' && p === '/api/suivi/relire-ia') {
      const {espace = 'moi', moteur = null} = await lireCorps(req);
      try { await lancerLectureIA(espace, {moteur}); } catch (err) { throw new ErreurHttp(400, err.message); }
      return envoyerJson(res, 200, {ok: true, ...etatApprentissage(espace)});
    }
    // ——— le tableau de bord du créateur ———
    if (req.method === 'GET' && p === '/api/tableau') {
      const espace = url.searchParams.get('espace') || 'moi';
      try { return envoyerJson(res, 200, {...tableauDeBord(espace, {periode: url.searchParams.get('periode') || '90'}), analyses: etatApprentissage(espace)}); } catch (err) { throw new ErreurHttp(400, err.message); }
    }
    if (req.method === 'GET' && p === '/api/tableau/vignettes') {
      // seulement un espace qui existe : un identifiant comme « ../../ailleurs » ferait lire un dossier hors des espaces
      const espace = url.searchParams.get('espace') || 'moi';
      const f = trouverEspace(espace) ? vignettesDe(espace, url.searchParams.get('cle') || '') : null;
      if (!f) throw new ErreurHttp(404, 'Pas d’image.');
      return envoyerFichier(req, res, f);
    }
    if (req.method === 'POST' && p === '/api/tableau/rapport') {
      const {espace = 'moi', periode = '30'} = await lireCorps(req);
      try { const r = rapport(espace, {periode}); montrer(r.fichier); return envoyerJson(res, 200, r); } catch (err) { throw new ErreurHttp(400, err.message); }
    }
    if (req.method === 'POST' && p === '/api/recette/analyser') {
      const {espace = 'moi', moteur = null} = await lireCorps(req);
      try { await lancerAnalyseRecette(espace, {moteur}); } catch (err) { throw new ErreurHttp(400, err.message); }
      return envoyerJson(res, 200, {ok: true, ...etatApprentissage(espace)});
    }
    if (req.method === 'POST' && p === '/api/recette/arreter') { const {espace = 'moi'} = await lireCorps(req); arreterApprentissage(espace); return envoyerJson(res, 200, {ok: true}); }

    // le carnet du monteur : ce que l'IA a appris d'un montage à l'autre (lu et effacé par la personne)
    if (req.method === 'GET' && p === '/api/carnet') return envoyerJson(res, 200, {lecons: lireCarnet().slice().reverse()});
    if (req.method === 'DELETE' && p === '/api/carnet') { viderCarnet(); return envoyerJson(res, 200, {ok: true}); }
    if (req.method === 'DELETE' && p.startsWith('/api/carnet/')) return envoyerJson(res, 200, {ok: retirerLecon(decodeURIComponent(p.slice('/api/carnet/'.length)))});

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

    // — les vidéos d'un projet (lib/sequences.mjs) : onglets au-dessus de la timeline, « Créer toutes les vidéos », une
    //   vidéo livrée par l'IA qui devient une vidéo du projet —
    if (await routesSequences(req, res, p, url, ctx, {envoyerJson, lireCorps, ErreurHttp, projet})) return null;

    // projet
    if (req.method === 'PUT' && p === '/api/projet') {
      const P = projet();
      // {sequence, sequence_ignoree} : un enregistrement parti avant un changement de vidéo n'écrase pas l'autre vidéo
      const r = P.appliquer(await lireCorps(req));
      return envoyerJson(res, 200, {ok: true, modifie_le: P.d.modifie_le, ...r});
    }
    if (req.method === 'POST' && p === '/api/medias') {
      const P = projet();
      const {chemins = []} = await lireCorps(req);
      return envoyerJson(res, 200, await ajouterMedias(P, chemins, file));
    }
    // — la voix off proposée, avec des questions (lib/voix-off.mjs) : l'avis, les questions de l'IA légère sur un clic,
    //   les réponses écrites ou dites au micro, le choix, le texte à lire —
    if (p === '/api/voix-off' || p.startsWith('/api/voix-off/')) {
      if (await routesVoixOff(req, res, p, url, ctx, {envoyerJson, lireCorps, ErreurHttp, projet})) return null;
    }
    // enregistrer sa voix (micro) ou soi-même (webcam) : la fenêtre envoie l'enregistrement morceau par morceau
    if (req.method === 'POST' && p === '/api/enregistrements') {
      const {genre, mime} = await lireCorps(req);
      try { return envoyerJson(res, 200, commencerEnregistrement(projet(), {genre, mime})); } catch (e) { throw new ErreurHttp(400, e.message); }
    }
    if ((x = m(/^\/api\/enregistrements\/([a-f0-9]{16})\/morceau$/)) && req.method === 'POST') {
      try { return envoyerJson(res, 200, await ajouterMorceau(projet(), x[1], url.searchParams.get('n'), req)); } catch (e) { throw new ErreurHttp(400, e.message); }
    }
    if ((x = m(/^\/api\/enregistrements\/([a-f0-9]{16})\/fin$/)) && req.method === 'POST') {
      try { return envoyerJson(res, 200, await terminerEnregistrement(projet(), x[1], file)); } catch (e) { throw new ErreurHttp(400, e.message); }
    }
    if ((x = m(/^\/api\/enregistrements\/([a-f0-9]{16})$/)) && req.method === 'DELETE') return envoyerJson(res, 200, {ok: annulerEnregistrement(projet(), x[1])});
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
        await recevoirFichier(req, cibleRef);
        const ajoutes = ajouterReferences(P, [cibleRef], url.searchParams.get('cible'));
        return envoyerJson(res, 200, {ajoutes, references: P.d.references});
      }
      if (!EXT_MEDIAS.test(nom)) throw new ErreurHttp(400, 'Ce fichier n’est ni une vidéo, ni un son, ni une image.');
      const dossier = path.join(P.racine, 'rushes');
      fs.mkdirSync(dossier, {recursive: true});
      const cible = nomLibre(dossier, nom);
      await recevoirFichier(req, cible);
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
    // ——— 11.0 : analyser les médias (sans la timeline), la voix claire, les couleurs de la caméra ———
    if (req.method === 'POST' && p === '/api/medias/analyser') {
      const {ids = [], moteur = null, qualite = 'rapide'} = await lireCorps(req);
      try { await lancerAnalyseIA(projet(), Array.isArray(ids) ? ids.map(String) : [], {moteur, qualite}); } catch (e) { throw new ErreurHttp(409, e.message); }
      return envoyerJson(res, 200, {ok: true});
    }
    if (req.method === 'GET' && p === '/api/medias/analyse') return envoyerJson(res, 200, etatAnalyseIA(projet()) ?? {});
    if (req.method === 'POST' && p === '/api/medias/analyse/arreter') { arreterAnalyseIA(projet()); return envoyerJson(res, 200, {ok: true}); }
    if (req.method === 'POST' && p === '/api/medias/analyse/oublier') { oublierAnalyseIA(projet()); return envoyerJson(res, 200, {ok: true}); }
    if (req.method === 'GET' && p === '/api/couleurs/profils') return envoyerJson(res, 200, {profils: listeProfils(), reglages: REGLAGES_COULEUR});
    if ((x = m(/^\/api\/medias\/(M\d+)\/(fiche|voix-claire|couleur)$/))) {
      const P = projet();
      const me = P.media(x[1]);
      if (!me) throw new ErreurHttp(404, 'Rush inconnu.');
      // tout ce que la section Médias sait d'un rush : mesures, analyse de l'IA, profil de couleur, voix claire
      if (x[2] === 'fiche' && req.method === 'GET') {
        await infosTechniques(me);
        return envoyerJson(res, 200, {mesures: lireMesures(P, me), ia: lireAnalyseIA(P, me), couleur: me.couleur ?? null, clair: me.clair ?? null,
          version: besoinVersion(me), echo_possible: await echoPossible(), deepfilter: !!deepFilter(),
          technique: {codec: me.codec, pix_fmt: me.pix_fmt ?? null, bits: me.bits ?? null, transfert: me.transfert ?? null, primaires: me.primaires ?? null, fps_variable: !!me.fps_variable}});
      }
      if (x[2] === 'voix-claire' && req.method === 'POST') {
        if (!me.audio) throw new ErreurHttp(400, 'Ce média n’a pas de son.');
        const {force = 'auto', echo = false} = await lireCorps(req);
        if (!FORCES[force] && force !== 'auto') throw new ErreurHttp(400, 'Force inconnue.');
        const t = file.ajouter(`Voix claire · ${me.nom}`, async (prog) => {
          const r = await voixClaire(me.chemin, path.join(P.dossierMedia(me.id), 'clair.flac'), {force, echo: !!echo, prog});
          me.clair = {force: r.force, echo: !!echo, cree_le: new Date().toISOString(), moteur: r.moteur, decalage_ms: r.decalage_ms, lufs: r.apres?.lufs ?? null, fait: r.fait};
          P.sauver();
          return {media: me.id};
        }, {media: me.id, type: 'voix'});
        return envoyerJson(res, 200, {tache: t.id});
      }
      if (x[2] === 'voix-claire' && req.method === 'DELETE') {
        fs.rmSync(path.join(P.cache, 'medias', me.id, 'clair.flac'), {force: true});
        me.clair = null;
        for (const it of [...P.d.montage, ...(P.d.superpositions ?? [])]) if (it.media === me.id && it.son?.version === 'clair') it.son.version = 'original';
        P.sauver();
        return envoyerJson(res, 200, {ok: true});
      }
      if (x[2] === 'couleur' && req.method === 'POST') {
        const {profil = 'normal', lut_fichier = null} = await lireCorps(req);
        const ids = new Set(['normal', 'auto', 'lut', 'dlogm', ...listeProfils().map((y) => y.id)]);
        if (!ids.has(profil)) throw new ErreurHttp(400, 'Profil inconnu.');
        if (profil === 'lut' && !(lut_fichier && /\.cube$/i.test(lut_fichier) && fs.existsSync(lut_fichier))) throw new ErreurHttp(400, 'Choisis un fichier .cube (le LUT de ta caméra).');
        const mes = lireMesures(P, me)?.image;
        // le D-Log M n'a pas de formule publiée : sans le LUT de DJI, c'est la conversion automatique
        const p = profil === 'dlogm' ? (lut_fichier ? 'lut' : 'auto') : profil;
        me.couleur = p === 'normal' ? {profil: 'normal'} : p === 'lut' ? {profil: 'lut', lut_fichier, camera: profil === 'dlogm' ? 'dlogm' : null} : p === 'auto' ? {profil: 'auto', camera: profil === 'dlogm' ? 'dlogm' : null, ombres: mes?.ombres ?? 0.12, lumieres: mes?.hautes_lumieres ?? 0.7} : {profil: p};
        // l'aperçu, les vignettes, les mesures et la version de montage sont refaits avec les nouvelles couleurs
        const FICHIERS_ETAPE = {proxy: ['proxy.mp4'], vignettes: ['vignettes.jpg'], mesures: ['planche.jpg'], montage: []};
        const aRefaire = (etapes) => {
          for (const k of etapes) {
            delete me.etapes[k];
            for (const f of FICHIERS_ETAPE[k]) fs.rmSync(path.join(P.cache, 'medias', me.id, f), {force: true});
          }
          P.sauver();
        };
        // Une préparation de ce rush tourne en ce moment : l'étape qu'elle est en train de faire finit avec les anciennes
        // couleurs et se marque « faite », si bien que la préparation suivante la sautait (l'aperçu restait gris alors
        // que la fiche disait « converti »). Les étapes qu'elle n'avait pas encore finies sont donc remises à faire à
        // sa fin, juste avant que la nouvelle préparation commence.
        const enRoute = file.enCours?.meta?.type === 'preparation' && file.enCours.meta.media === me.id ? file.enCours : null;
        const pasFinies = Object.keys(FICHIERS_ETAPE).filter((k) => me.etapes[k] !== true && me.etapes[k] !== false);
        aRefaire(Object.keys(FICHIERS_ETAPE));
        if (enRoute && pasFinies.length) {
          const apres = (t) => { if (t !== enRoute) return; file.ecouteurs.delete(apres); try { aRefaire(pasFinies); } catch { /* projet parti entre-temps */ } };
          file.ecouteurs.add(apres);
        }
        preparer(P, me, file);
        return envoyerJson(res, 200, {ok: true, couleur: me.couleur});
      }
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
        if (!r?.mots?.length) throw new ErreurHttp(400, 'Aucun mot de ce fichier n’a de temps de début et de fin : Dérush ne peut pas le caler sur le rush.');
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
      const raccourcis = [['Bureau', path.join(os.homedir(), 'Desktop')], ['Vidéos', dossierVideos()], ['Téléchargements', path.join(os.homedir(), 'Downloads')], ['Documents', path.join(os.homedir(), 'Documents')], ['Dossier personnel', os.homedir()], ...(ctx.P ? [['Projet', ctx.P.racine]] : [])]
        .filter(([, c]) => fs.existsSync(c)).map(([nom, chemin]) => ({nom, chemin}));
      // le dossier lui-même : déjà un projet, ou vide (le bouton dit « Ouvrir ce projet » ou « Créer le projet ici »)
      const estProjet = fs.existsSync(path.join(dossier, 'derush.json'));
      const vide = entrees.every((e) => FICHIERS_DU_SYSTEME.test(e.name));
      return envoyerJson(res, 200, {dossier, parent: path.dirname(dossier) !== dossier ? path.dirname(dossier) : null, entrees: liste, raccourcis, projet: estProjet, vide});
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
      // la vidéo ouverte, figée au clic : si la personne en ouvre une autre pendant que la tâche attend dans la file,
      // c'est bien celle-ci qui sera créée (creerVideo lirait sinon P.d au démarrage de la tâche)
      let donnees = null;
      try { donnees = donneesSequence(P, P.d.sequence); } catch { /* sans liste de vidéos : la vidéo ouverte, lue au départ */ }
      const nomV = (P.d.sequences?.length ?? 0) > 1 ? ` · ${P.d.sequences.find((s) => s.id === P.d.sequence)?.nom ?? ''}` : '';
      const t = file.ajouter(`Création de la vidéo${nomV}`, (prog) => creerVideo(P, {plateforme, donnees}, prog), {type: 'rendu', sequence: P.d.sequence});
      return envoyerJson(res, 200, {tache: t.id});
    }
    // « Demander à Claude » : Dérush lance Claude Code dans le dossier de montage et suit son travail
    if (req.method === 'GET' && p === '/api/claude') {
      const P = projet();
      // Pendant que l'IA travaille, cette route est relue en continu (le direct, la bulle de travail) : l'état des IA
      // n'y change pas, et le revérifier (toutes les minutes, une demi-seconde de programmes lancés) figeait ce tour-là.
      const force = forceDemandee(url).ia;
      const ia = !force && iaVue && claudeTravaille() ? {...iaVue, choisi: moteurChoisi(iaVue)} : await lireIA(force);
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
      // une copie coupée en route (fenêtre rechargée, disque plein) ne fait plus tomber Dérush : repondreErreur la dit
      verifierPlaceEnvoi(req, P.racine);
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

    // — « Ajouter une compétence » : lire un dépôt GitHub, choisir, ajouter, mettre en pause, retirer, mettre à jour,
    //   chercher dans l'annuaire skills.sh (lib/competences-ajoutees.mjs) —
    if (p.startsWith('/api/competences/')) {
      const CA = await import('./competences-ajoutees.mjs');
      const quoi = p.slice('/api/competences/'.length);
      try {
        if (req.method === 'GET' && quoi === 'ajoutees') return envoyerJson(res, 200, {competences: CA.listerAjoutees()});
        if (req.method === 'GET' && quoi === 'annuaire') return envoyerJson(res, 200, {resultats: await CA.chercherAnnuaire(url.searchParams.get('q'))});
        if (req.method === 'POST') {
          const c = await lireCorps(req).catch(() => ({}));
          if (quoi === 'explorer') return envoyerJson(res, 200, await CA.explorer(String(c.lien ?? '')));
          if (quoi === 'ajouter') return envoyerJson(res, 200, await CA.ajouter(c.id, Array.isArray(c.chemins) ? c.chemins.map(String) : []));
          if (quoi === 'abandonner') { CA.abandonner(c.id); return envoyerJson(res, 200, {ok: true}); }
          if (quoi === 'activer') return envoyerJson(res, 200, {competence: CA.activer(String(c.nom ?? ''), c.actif !== false)});
          if (quoi === 'retirer') return envoyerJson(res, 200, {ok: CA.retirer(String(c.nom ?? ''))});
          if (quoi === 'verifier') return envoyerJson(res, 200, await CA.verifierMisesAJour());
          if (quoi === 'mise-a-jour') return envoyerJson(res, 200, await CA.preparerMiseAJour(String(c.nom ?? '')));
        }
      } catch (err) { throw new ErreurHttp(400, err.message); }
      throw new ErreurHttp(404, 'Route inconnue.');
    }

    // — Connexions : les deux assistants, ElevenLabs, les vrais sons, Google Drive, Treg, Blender, les compétences, les mises à jour —
    if (req.method === 'GET' && p === '/api/connexions') {
      // seul ce qui est demandé est revérifié : une IA attendue ne relance plus Blender ni Earshot (et inversement)
      const force = forceDemandee(url);
      if (force.ia) oublierEtats(force.ia);
      if (force.tout || force.noms.includes('blender')) oublierBlender();
      if (force.tout || force.noms.includes('earshot')) { oublierEarshot(); verifierEarshot().catch(() => {}); }
      const [ia, blender] = await Promise.all([lireIA(force.ia), etatBlender()]);
      const r = lireReglages();
      const sans = ({chemin, ...x}) => x; // les chemins des programmes restent ici
      const so = etatSons();
      return envoyerJson(res, 200, {
        systeme: NOM_SYSTEME, version: VERSION,
        claude: {...sans(ia.claude), action: actionEnCours('claude')}, codex: {...sans(ia.codex), action: actionEnCours('codex')}, gemini: {...sans(ia.gemini), action: actionEnCours('gemini')},
        choisi: ia.choisi, qualite: QUALITES[r.ia_qualite] ? r.ia_qualite : 'max', qualites: QUALITES,
        modele: MODELES[r.ia_modele] ? r.ia_modele : null, modeles: MODELES, // le modèle de Claude choisi à la main (null : selon le niveau)
        elevenlabs: etatElevenLabs(), drive: etatDrive(), treg: etatTreg(ia.choisi), blender: sans(blender), blender_action: actionsConnexions.get('blender') ?? null,
        competences: {nombre: listerCompetences().length, remotion: remotionPresent(), action: actionsConnexions.get('remotion') ?? null,
          ajoutees: listerCompetences().filter((s) => s.source === 'ajoutee').length},
        sons: {actif: so.actif, nom: so.nom, nombre: so.nombre,
          realsfx: {ok: so.realsfx.ok, action: actionsConnexions.get('realsfx') ?? null},
          earshot: {ok: so.earshot.ok, deja: !!so.earshot.chemin && !so.earshot.derush, installable: so.earshot.ok || so.earshot.installable !== false, pourquoi: so.earshot.pourquoi ?? null, action: actionsConnexions.get('earshot') ?? null}},
        maj: {...etatMaj(), action: actionsConnexions.get('maj') ?? null},
      });
    }
    if (req.method === 'POST' && (x = m(/^\/api\/connexions\/(claude|codex|gemini|ia|treg|drive|elevenlabs|blender|competences|maj|sons|realsfx|earshot)\/([a-z-]+)$/))) {
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
        else if (id === 'maj' && action === 'prevenir') changerReglages({maj_prevenir: !!corps.actif});
        else if (id === 'maj' && action === 'installer') {
          // jamais pendant un travail : le programme changerait sous les pieds de l'IA, d'un export ou d'une prise
          // (une analyse de l'IA — viralité, plan de partage, profil, recette — compte aussi : avant, elle était coupée en route)
          if (travailEnCours()) throw new Error('Un travail est en cours (ton IA, une analyse, un export, un enregistrement) : mets à jour quand il sera fini.');
          const r = await mettreAJour();
          envoyerJson(res, 200, {ok: true, ...r});
          // rien ne reste derrière le redémarrage : ce qui aurait commencé entre-temps s'arrête avec l'ancien programme
          if (r.change) setTimeout(() => { try { arreterToutesLesDemandes(); arreterConseils(); arreterDrive(); arreterEnfants(); } catch { /* rien à arrêter */ } redemarrer(); }, 600);
          return;
        } else throw new Error('Action inconnue.');
      } catch (e) { throw new ErreurHttp(400, e.message); }
      return envoyerJson(res, 200, {ok: true});
    }
    // les mises à jour : ce que la petite fenêtre montre, « Plus tard », « J'ai vu »
    if (req.method === 'GET' && p === '/api/maj') return envoyerJson(res, 200, resumeMaj());
    if (req.method === 'POST' && p === '/api/maj/plus-tard') return envoyerJson(res, 200, plusTard());
    if (req.method === 'POST' && p === '/api/maj/vu') return envoyerJson(res, 200, marquerVue());
    // les liens vers les sites des connexions (s'ouvrent dans le navigateur de l'ordinateur)
    if (req.method === 'POST' && p === '/api/lien') {
      const {url: lien} = await lireCorps(req);
      let u;
      try { u = new URL(String(lien)); } catch { throw new ErreurHttp(400, 'Lien invalide.'); }
      const permis = ['treg.to', 'claude.ai', 'claude.com', 'anthropic.com', 'chatgpt.com', 'openai.com', 'elevenlabs.io', 'blender.org', 'github.com', 'nodejs.org', 'ffmpeg.org', 'brew.sh', 'drive.google.com', 'google.com',
        'youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com', 'linkedin.com', 'antigravity.google', 'skills.sh'];
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
    // — « Depuis mon Drive » (lib/drive-medias.mjs) : parcourir le Drive par dossier et par jour, la recherche par l'IA
    //   légère (sur un clic), les vraies dates de prise de vue (avec l'accord de la personne), l'import dans le projet —
    if (await routesDrive(req, res, p, url, ctx, {envoyerJson, lireCorps, ErreurHttp, projet})) return null;

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
    // un message écrit pendant que l'IA travaille (Claude le lit en route ; Codex et Gemini le reçoivent ensuite)
    if (req.method === 'POST' && p === '/api/claude/ajouter') {
      const {message} = await lireCorps(req);
      try { return envoyerJson(res, 200, ajouterMessage(projet(), message)); } catch (e) { throw new ErreurHttp(400, e.message); }
    }
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
      repondreErreur(res, e);
    }
  });
  // Un envoi de fichier (un rush de 20 Go copié dans le projet depuis un disque lent) peut durer plus de 5 minutes :
  // Node coupe par défaut toute requête plus longue. Le serveur n'écoute que cet ordinateur : pas de limite.
  serveur.requestTimeout = 0;

  return new Promise((ok, ko) => {
    const essayer = (pt, reste) => {
      serveur.once('error', (e) => (e.code === 'EADDRINUSE' && reste > 0 ? essayer(pt + 1, reste - 1) : ko(e)));
      serveur.listen(pt, '127.0.0.1', () => { programmerMaj(); ok({serveur, port: pt, url: `http://127.0.0.1:${pt}/`}); });
    };
    essayer(port, essais);
  });
}
