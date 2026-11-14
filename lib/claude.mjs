// Dérush — la conversation avec l'IA qui monte : Claude (Claude Code, compte Claude), Codex (compte ChatGPT) ou Gemini
// (la commande agy d'Antigravity, compte Google).
// Dérush prépare le dossier de montage, y installe ce que l'humain a joint (références, charte, vidéos, archives…), les
// compétences et les connexions, puis lance l'IA dedans. Elle répond, monte une ou plusieurs vidéos, ou les publie ;
// Dérush suit son travail en direct (les images qu'elle regarde, son rendu image par image) et récupère tout.
// Le nom du fichier est resté « claude.mjs » : c'était le seul assistant avant Dérush 7.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {slug, MODES} from './commun.mjs';
import {WINDOWS, arreterArbre, lier, garderEveille, cloner, preparerLancement} from './plateforme.mjs';
import {ffmpeg, lancer, FFMPEG, ecrireJson, lireJson, tailleLisible} from './outils.mjs';
import {exporterPack} from './pack.mjs';
import {etatRendu, installerRendu, dossierMoteurRendu, controlerVideo} from './rendu.mjs';
import {controlerTextes} from './controle.mjs';
import {brillance, avisBrillance} from './son.mjs';
import {controlerRythme} from './rythme.mjs';
import {recueillirCarnet, texteCarnet, FICHIER_IA} from './carnet.mjs';
import {espaceDuProjet, trouverEspace, apprend, installerEspace, consigneEspace} from './espaces.mjs';
import {creerFiche, enregistrerFiche, rattacherPublication, ficheDe} from './fiches.mjs';
import {installerRecette} from './recette.mjs';
import {installerSerie, consigneSerie} from './series.mjs';
import {installerVoixOff, consigneVoixOff, rappelVoixOff, recueillirVoixOff, avisVoixOff} from './voix-off.mjs';
import {enregistrerPublication, idDepuisLien} from './suivi.mjs';
import {dejaEnvoyee} from './youtube.mjs';
import {verifierPlace} from './disque.mjs';
import {moteurs, transcrire} from './transcription.mjs';
import {etatBlender, PYTHON, RACINE_APP, DOSSIER_SUPPORT} from './moteurs.mjs';
import {consigneElevenLabs, chargerCle, listerCreations, occupe} from './elevenlabs.mjs';
import {boiteAOutils, guideMotion, consigneCompetences} from './recettes.mjs';
import {attacherPieces, attendrePieces, installerContexte, listerPieces} from './pieces.mjs';
import {argsConnecteursClaude, intrus, refuser, refuses, NOM_CONNECTEUR, PREFIXE_OUTILS, installerDrive, consigneDrive, noterConnecteur, dossiersDrive, etatDrive} from './drive.mjs';
import {consigneTreg, rappelTreg, argsCodexTreg, NOMS_TREG, noterConnecteurTreg, jetonTreg, etatTreg} from './treg.mjs';
import {installerCompetences, DOSSIER_COMMANDES} from './competences.mjs';
import {IA, MODELES, EFFORTS, QUALITES, reglageIA, envIA, etatClaude, etatCodex, etatIA, moteurChoisi, argsCodex, lireEvenementCodex, argsGemini, lecteurGemini, refusGemini, commandeLancement} from './ia.mjs';
import {outilsLisibles, reglagesGemini, envGemini} from './gemini.mjs';
import {lireReglages} from './reglages.mjs';
import {rappelMaj} from './maj.mjs';
import {ouvrirRelais} from './relais.mjs';
import {installerSons, envSons, ecritsSons, lusSons, consigneSons, rappelSons, partieSons} from './sons.mjs';
import {installerProfil, consigneCreateur} from './createur.mjs';
import {coupesLivrees, decoupeDuDossier, etatLivree} from './sequences.mjs';

export {MODELES, EFFORTS, QUALITES, etatClaude, etatCodex, etatIA};
/** La longueur maximale d'un message (un brief entier tient largement ; au-delà, mieux vaut un fichier joint). */
export const LONGUEUR_MESSAGE = 24000;
export const RESEAUX = {
  tiktok: {nom: 'TikTok', aide: 'Part en brouillon dans ta boîte TikTok : tu publies depuis l’app.'},
  youtube: {nom: 'YouTube Shorts', aide: 'Non répertoriée, sauf si tu choisis Publique.'},
  instagram: {nom: 'Instagram Reels', aide: 'Publiée directement sur ton compte professionnel.'},
  linkedin: {nom: 'LinkedIn', aide: 'Publiée directement sur ton profil.'},
};

// ——— État d'une conversation : ce qui est écrit dans le projet (claude/etat.json) et ce qui tourne en ce moment ———
const EN_COURS = new Map(); // racine du projet → {proc, etape, debut, activite[], vues[], atelier, …}
const fichierEtat = (P) => path.join(P.racine, 'claude', 'etat.json');
function lireEtat(P) {
  const e = lireJson(fichierEtat(P)) ?? {atelier: null, echanges: [], versions: []};
  // avant Dérush 7, une seule conversation (Claude) : on la range avec les autres
  e.sessions ??= e.session ? {claude: e.session} : {};
  return e;
}
function ecrireEtat(P, e) {
  etatVu = null;
  fs.mkdirSync(path.dirname(fichierEtat(P)), {recursive: true});
  ecrireJson(fichierEtat(P), e, 2);
}
// Pour ce qui ne fait que lire (l'interface relit la conversation toutes les secondes pendant le travail de l'IA) : la
// dernière lecture est gardée tant que le fichier n'a pas changé (date, taille, numéro). Ce qu'elle rend ne se modifie
// jamais : pour changer l'état, lireEtat puis ecrireEtat.
let etatVu = null; // {fichier, marque, e}
function lireEtatVu(P) {
  const fichier = fichierEtat(P);
  let marque = null;
  try { const st = fs.statSync(fichier); marque = `${st.mtimeMs}:${st.size}:${st.ino}`; } catch { /* pas encore de conversation */ }
  if (etatVu?.fichier === fichier && etatVu.marque === marque) return etatVu.e;
  const e = lireEtat(P);
  etatVu = {fichier, marque, e};
  return e;
}
export const claudeTravaille = () => EN_COURS.size > 0;
/** Une empreinte du montage : dit si l'humain a changé quelque chose depuis que l'IA a reçu son dossier. */
const empreinte = (P) => crypto.createHash('sha1').update(JSON.stringify([P.d.montage, P.d.superpositions ?? [], P.d.indications ?? [], P.d.style ?? {}, P.d.brief ?? {}, P.d.sortie, P.d.medias.map((m) => m.id), P.d.espace ?? 'moi'])).digest('hex').slice(0, 16);
/**
 * « Pour qui ? » a-t-il changé depuis que le dossier de travail a été préparé ? Ce dossier et la conversation de l'IA
 * portent l'univers de l'espace d'alors (le profil, le carnet et la recette de « Moi » qu'elle a lus, ses compositions
 * dans ce style) : un autre espace ne doit jamais les recevoir. Un dossier d'avant cette règle (sans « espace ») est
 * pris pour celui de l'espace actuel.
 */
const espaceChange = (P, e, espace = espaceDuProjet(P)) => !!e.atelier && !!e.espace && e.espace !== (espace?.id ?? 'moi');

/** La découpe choisie par l'IA (quand elle est passée par recouper.mjs), pour la remettre dans la timeline de Dérush. */
export function decoupeDeClaude(P) {
  const e = lireEtatVu(P);
  const M = e.atelier ? lireJson(path.join(P.racine, e.atelier, 'montage.json')) : null;
  // montage.json est écrit par l'IA (par recouper.mjs, ou retouché à la main) : rien n'y est sûr. Un plan mal écrit
  // (sans « entree », sans durée) est laissé de côté, il ne fait jamais tomber la lecture de la conversation.
  if (!M || M.decoupe !== 'ia' || !Array.isArray(M.montage)) return null;
  const connus = new Set(P.d.medias.map((m) => m.id));
  const sec = (v) => (v == null || v === '' ? NaN : Number(v));
  const plans = M.montage.filter((it) => it?.type === 'plan' && connus.has(it.source?.id)).map((it) => {
    const image = it.source.type === 'image';
    return {media: it.source.id, titre: String(it.titre ?? ''), entree: image ? 0 : sec(it.source.entree?.s), sortie: sec(image ? it.duree?.s : it.source.sortie?.s)};
  }).filter((p) => Number.isFinite(p.entree) && Number.isFinite(p.sortie) && p.sortie > p.entree);
  return plans.length ? plans : null;
}
/** La timeline de Dérush vient de reprendre la découpe de l'IA : les deux sont de nouveau d'accord. */
export function synchroniserDemande(P) {
  const e = lireEtat(P);
  if (e.atelier) ecrireEtat(P, {...e, empreinte: empreinte(P), decoupe_reprise: true});
}

/**
 * Le rendu en direct : ce que rendre.mjs écrit pendant qu'il rend (progression et petites images). L'interface ne montre
 * que le dernier rendu de la demande : on ne lit que lui (le nom de son dossier commence par l'heure du rendu), pas
 * tous les rendus d'essai et la liste de toutes leurs images à chaque relecture.
 */
function directDe(atelier, depuis) {
  const D = path.join(atelier, 'rendu', '.direct');
  let dossiers = [];
  try { dossiers = fs.readdirSync(D).sort(); } catch { return []; }
  for (const id of dossiers.reverse()) {
    const x = lireJson(path.join(D, id, 'etat.json'));
    if (!x || !(Date.parse(x.debut) >= depuis - 5000)) continue;
    let images = [];
    try { images = fs.readdirSync(path.join(D, id)).map((f) => /^f-(\d{5})\.jpg$/.exec(f)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b); } catch { /* dossier en cours d'écriture */ }
    return [{id, titre: x.titre, composition: x.composition, etape: x.etape, total: x.total, rendues: x.rendues, fps: x.fps, largeur: x.largeur, hauteur: x.hauteur, pas_s: x.pas_s ?? 0.5, debut: x.debut, fin: x.fin, erreur: x.erreur, images}];
  }
  return [];
}
/** Le fichier d'une image du direct (ou null), pour la route qui la sert. */
export function fichierDirect(P, id, nom) {
  if (!/^[\w-]+$/.test(id) || !/^f-\d{5}\.jpg$/.test(nom)) return null;
  // pendant le travail (une image demandée toutes les 180 ms), le dossier de travail est déjà connu : on ne relit pas
  // toute la conversation pour chaque petite image
  let atelier = EN_COURS.get(P.racine)?.atelier ?? null;
  if (!atelier) { const e = lireEtatVu(P); atelier = e.atelier ? path.join(P.racine, e.atelier) : null; }
  if (!atelier) return null;
  const f = path.join(atelier, 'rendu', '.direct', id, nom);
  return fs.existsSync(f) ? f : null;
}
/** Une image que l'IA a regardée pendant son travail (son n° dans la liste du direct). */
export function fichierVue(P, n) {
  const c = EN_COURS.get(P.racine) ?? DERNIERES_VUES.get(P.racine);
  const v = c?.vues?.[Number(n)];
  return v && fs.existsSync(v.chemin) ? v.chemin : null;
}
const DERNIERES_VUES = new Map();

/** Les vidéos d'une version (les anciennes versions n'en avaient qu'une). */
const videosDe = (v) => (v.videos?.length ? v.videos : [{nom: v.nom, titre: null, duree: v.duree, largeur: v.largeur, hauteur: v.hauteur, taille_lisible: v.taille_lisible, controles: v.controles, vignettes: v.vignettes ?? null}]);

/** Le dossier des annexes d'une version, à côté de ses vidéos : « <titre>-<ia>-v<n>-annexes ». */
const dossierAnnexes = (nomVideo) => { const m = /^(.*-v\d+)(?:-\d+(?:-[\w-]+)?)?\.mp4$/i.exec(String(nomVideo ?? '')); return m ? `${m[1]}-annexes` : null; };
/** Les fichiers d'un dossier (trois niveaux au plus, sans fichiers cachés ni liens), dans l'ordre. */
function fichiersDe(dossier, depuis = 0, max = 200) {
  const liste = [];
  const parcourir = (d, rel, niveau) => {
    let noms = [];
    try { noms = fs.readdirSync(d).sort((a, b) => a.localeCompare(b, 'fr', {numeric: true})); } catch { return; }
    for (const n of noms) {
      if (n.startsWith('.') || liste.length >= max) continue;
      const f = path.join(d, n);
      let st;
      try { st = fs.lstatSync(f); } catch { continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { if (niveau < 3) parcourir(f, path.join(rel, n), niveau + 1); } else if (st.isFile() && st.mtimeMs >= depuis - 2000) liste.push({nom: path.join(rel, n), fichier: f, taille: st.size});
    }
  };
  parcourir(dossier, '', 0);
  return liste;
}
/**
 * Range un fichier livré (une vidéo, un master de plusieurs gigaoctets) à côté des vidéos du projet : un clone quand le
 * disque le permet (instantané, sans place prise en double), sinon une vraie copie, qui ne bloque pas Dérush pendant
 * qu'elle se fait.
 */
async function rangerFichier(src, dst) {
  fs.rmSync(dst, {force: true});
  if (!(await cloner(src, dst))) await fs.promises.copyFile(src, dst);
}
/**
 * Les autres fichiers que l'IA remet avec sa vidéo (image fixe, storyboard, master, liste des polices et des sons…) :
 * elle les met dans rendu/livraison/annexes/, Dérush les range à côté de la vidéo (6 Go au plus). Renvoie leur nombre.
 */
async function rangerAnnexes(atelier, depuis, cible) {
  let total = 0;
  let n = 0;
  for (const x of fichiersDe(path.join(atelier, 'rendu', 'livraison', 'annexes'), depuis)) {
    if (total + x.taille > 6e9) break;
    try { const vers = path.join(cible, x.nom); fs.mkdirSync(path.dirname(vers), {recursive: true}); await rangerFichier(x.fichier, vers); total += x.taille; n++; } catch { /* ce fichier reste dans le dossier de travail */ }
  }
  return n;
}
/** L'empreinte de la piste son d'une vidéo (ses paquets, sans les décoder), ou null : la même pour deux formats d'un même montage. */
async function empreinteSon(video) {
  try { return /MD5=([0-9a-f]{32})/i.exec((await lancer(FFMPEG, ['-v', 'error', '-i', video, '-map', '0:a:0', '-c', 'copy', '-f', 'md5', '-'], {silenceMax: 60000})).out.toString())?.[1] ?? null; } catch { return null; }
}
/** Les annexes rangées avec une version (lues sur le disque : rien à enregistrer). */
function annexesDe(dossierVideos, nomVideo) {
  const d = dossierAnnexes(nomVideo);
  if (!d) return null;
  const liste = fichiersDe(path.join(dossierVideos, d), 0, 200);
  if (!liste.length) return null;
  return {dossier: d, chemin: path.join(dossierVideos, d), nombre: liste.length, taille_lisible: tailleLisible(liste.reduce((s, x) => s + x.taille, 0)), fichiers: liste.slice(0, 40).map((x) => ({nom: x.nom, taille_lisible: tailleLisible(x.taille)}))};
}

/** Tout ce que l'interface affiche : la conversation, les pièces jointes, les vidéos, et le travail en cours (en direct). */
// Combien de temps une vidéo prend d'habitude, sur cet ordinateur, pour chaque IA et chaque niveau : pour dire à
// l'humain à quoi s'attendre (une demande au niveau Maximum dure souvent une heure).
const FICHIER_DUREES = path.join(DOSSIER_SUPPORT, 'durees-ia.json');
function noterDuree(c) {
  const d = lireJson(FICHIER_DUREES) ?? {};
  const cle = `${c.moteur}:${c.qualite}`;
  d[cle] = [...(d[cle] ?? []), Math.round((Date.now() - c.debut) / 1000)].slice(-12);
  try { ecrireJson(FICHIER_DUREES, d); } catch { /* pas grave */ }
}
/** La durée habituelle (médiane des dernières vidéos), en secondes, ou null si ce niveau n'a encore rien livré ici. */
export function dureeHabituelle(moteur, qualite) {
  const l = [...(lireJson(FICHIER_DUREES)?.[`${moteur}:${qualite}`] ?? [])].sort((a, b) => a - b);
  return l.length ? l[Math.floor(l.length / 2)] : null;
}

export function etatDemande(P) {
  const e = lireEtatVu(P); // jamais modifié ici : tout ce qui est rendu est recopié
  const c = EN_COURS.get(P.racine);
  const atelierPret = !!e.atelier && fs.existsSync(path.join(P.racine, e.atelier, 'montage.json'));
  const dossierVideos = path.join(P.racine, 'vidéos');
  // claude/etat.json est dans le projet : un fichier réécrit à la main (ou par une IA) ne doit faire passer ni une
  // version sans numéro, ni un autre fichier du disque (« ../derush.json ») pour une vidéo de l'IA. Ces vidéos sont
  // proposées ailleurs (sources du studio, publication) : seul un nom de vidéo .mp4 du dossier « vidéos » est gardé.
  const sures = (e.versions ?? []).filter((v) => Number.isInteger(v?.n));
  const nomSur = (x) => typeof x?.nom === 'string' && path.basename(x.nom) === x.nom && /\.mp4$/i.test(x.nom);
  const derniere = Math.max(0, ...sures.map((v) => v.n));
  // la découpe de l'IA dans son dossier de travail (recouper.mjs) : elle vaut pour la dernière version, si elle est seule
  const decoupeDossier = !c && atelierPret ? (decoupeDeClaude(P)?.length ?? 0) : 0;
  const versions = sures.map((v) => {
    // « rang » : la place de la vidéo dans sa version (ce que /api/sequences/depuis-ia attend) ; « timeline » : ce
    // qu'elle deviendrait dans la timeline (plan par plan, ou un seul plan, le fichier) ; « dans_timeline » : la vidéo
    // du projet qui en est déjà faite. Les passages eux-mêmes (« coupes ») restent dans le projet.
    const videos = videosDe(v).map((x, k) => ({...x, rang: k, ...etatLivree(P, v, k, v.n === derniere ? decoupeDossier : 0)}))
      .filter((x) => nomSur(x) && fs.existsSync(path.join(dossierVideos, x.nom))).map(({coupes, ...x}) => ({...x, chemin: path.join(dossierVideos, x.nom)}));
    const annexes = videos.length ? annexesDe(dossierVideos, videos[0].nom) : null;
    // son dossier de travail : celui qu'elle a retenu, ou (version d'avant cette règle) celui de la conversation si
    // c'est la dernière version ; sinon aucun
    const atelierV = v.atelier ? path.join(P.racine, v.atelier) : v.n === derniere && atelierPret ? path.join(P.racine, e.atelier) : null;
    const atelier_present = !!atelierV && fs.existsSync(path.join(atelierV, 'montage.json'));
    const avecDossier = videos.map((x) => ({...x, atelier_present}));
    return videos.length ? {...v, ...avecDossier[0], videos: avecDossier, atelier_present, ...(annexes ? {annexes} : {})} : null;
  }).filter(Boolean);
  const session = atelierPret ? (e.sessions[e.moteur ?? 'claude'] ?? e.sessions.claude ?? e.sessions.codex ?? e.sessions.gemini ?? null) : null;
  // une autre vidéo du projet est ouverte que celle du dossier de travail (un dossier d'avant les vidéos : la seule)
  const autreVideo = atelierPret && !!e.sequence && !!P.d.sequence && e.sequence !== P.d.sequence;
  // une fin de travail que Dérush n'a pas pu écrire dans le projet (disque plein, débranché) : montrée quand même
  const finNonEcrite = !c ? DERNIERES_VUES.get(P.racine)?.finNonEcrite : null;
  return {
    ...e,
    ...(finNonEcrite ? {echanges: [...(e.echanges ?? []), finNonEcrite]} : {}),
    // pendant le travail, l'interface ne se sert pas des tables de montage des versions (elle suit celle du direct) :
    // elles pèsent neuf dixièmes de la réponse, relue toutes les secondes. La relecture de la fin les rapporte.
    versions: c ? versions.map(({table, ...v}) => v) : versions,
    atelier: atelierPret ? e.atelier : null, session,
    atelier_chemin: atelierPret ? path.join(P.racine, e.atelier) : null,
    pieces: listerPieces(P),
    // l'humain a retouché son montage depuis (ou ouvert une autre vidéo du projet) : l'IA travaille encore sur l'ancien,
    // sauf si on repart du montage
    montage_change: atelierPret && ((!!e.empreinte && e.empreinte !== empreinte(P)) || autreVideo),
    // la vidéo du projet pour laquelle le dossier de travail a été préparé, si ce n'est plus celle qui est ouverte
    sequence_atelier: atelierPret && e.sequence ? {id: e.sequence, nom: P.d.sequences?.find((x) => x.id === e.sequence)?.nom ?? e.sequence_nom ?? null} : null,
    sequence_change: autreVideo,
    // « Pour qui ? » a changé depuis que l'IA a reçu son dossier : la prochaine demande repartira d'un dossier et d'une
    // conversation neufs, quoi qu'on choisisse (voir lancerDemande)
    espace_change: atelierPret && !!e.espace && espaceChange(P, e),
    // l'IA a choisi elle-même les passages : on peut les reprendre dans la timeline
    decoupe_ia: !e.decoupe_reprise ? decoupeDossier : 0,
    en_cours: c ? {
      etape: c.etape, depuis_s: Math.round((Date.now() - c.debut) / 1000), progression: c.progression, activite: c.activite.slice(-40), n_activite: c.nActivite,
      message: c.message, moteur: c.moteur, qualite: c.qualite, modele: c.modele, effort: c.effort, reprise: c.reprise, arret: c.annule, publier: !!c.publier,
      // les messages écrits pendant le travail, et si l'IA les lit en route (Claude) ou après (Codex, Gemini)
      messages: c.messages.map((m) => ({texte: m.texte, quand: m.quand, lu: m.lu, envoye: m.envoye})), ecoute: c.moteur === 'claude', habituel_s: dureeHabituelle(c.moteur, c.qualite),
      // le direct : les images que l'IA regarde, et ses rendus image par image
      // … et sa table de montage, au fur et à mesure qu'elle la remplit
      direct: {vues: c.vues.slice(-24).map((v) => ({n: v.n, nom: v.nom, t: v.t})), rendus: c.atelier ? directDe(c.atelier, c.debutIA ?? c.debut) : [], table: c.atelier ? tableIA(c.atelier, c.debutIA ?? c.debut) : null},
    } : null,
  };
}

const RESEAU_TREG = {tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram', linkedin: 'LinkedIn'};
// ce que dit une IA quand la conversation à reprendre n'existe plus chez elle (Claude Code : « No conversation found
// with session ID… » ; il efface les siennes après un mois et les range par dossier : un projet déplacé les perd)
const PERDUE = (nom) => `${nom} ne retrouve plus la conversation d’avant (elle a été effacée chez lui, ou le projet a été déplacé). Renvoie ton message : il repartira du dossier de travail, avec le résumé de nos échanges.`;
const SESSION_PERDUE = /no (?:saved )?(?:conversation|session|thread|rollout)s?\b[^\n]{0,60}\bfound|(?:conversation|session|thread|rollout)\b[^\n]{0,80}(?:not found|does not exist|no longer exists|introuvable)/i;
/** Une ligne lisible pour chaque geste de l'IA (ce qu'elle lit, écrit, lance, publie). */
function decrire(outil, entree, atelier) {
  const dehors = (f) => { const rel = path.relative(atelier, String(f ?? '')); return rel.startsWith('..') || path.isAbsolute(rel); };
  const nom = (f) => (f ? (dehors(f) ? path.basename(String(f)) : path.relative(atelier, String(f)) || path.basename(String(f))) : '');
  if (outil === 'Read') return {icone: 'oeil', texte: dehors(entree.file_path) && /[\\/]\.claude[\\/]/.test(String(entree.file_path)) ? 'Relit ses notes' : `Lit ${nom(entree.file_path)}`};
  if (outil === 'Write') return {icone: 'crayon', texte: `Écrit ${nom(entree.file_path)}`};
  if (outil === 'Edit' || outil === 'NotebookEdit') return {icone: 'crayon', texte: `Modifie ${nom(entree.file_path ?? entree.notebook_path)}${entree.autres ? ` (et ${entree.autres} autre${entree.autres > 1 ? 's' : ''})` : ''}`};
  if (outil === 'Skill') return {icone: 'outil', texte: `Ouvre la compétence « ${entree.skill ?? ''} »`};
  if (outil === 'WebSearch') return {icone: 'loupe', texte: `Cherche sur le web : ${String(entree.query ?? '').slice(0, 80)}`};
  if (outil === 'WebFetch') return {icone: 'loupe', texte: 'Lit une page web'};
  // Treg : la publication sur les réseaux
  const treg = /^mcp__(?:treg|claude_ai_Treg)__(\w+)$/.exec(outil);
  if (treg) {
    const id = String(entree.endpoint_id ?? '');
    const reseau = RESEAU_TREG[id.split('.')[0]] ?? null;
    if (treg[1] === 'call') {
      const quoi = /publish\.status|container\.status/.test(id) ? 'Vérifie la publication' : /profile/.test(id) ? 'Regarde ton compte' : /\.(init|upload|create)$/.test(id) ? 'Envoie la vidéo' : /publish|post\.create/.test(id) ? 'Publie' : /finalize/.test(id) ? 'Termine l’envoi' : 'Appelle';
      return {icone: 'globe', texte: `${quoi}${reseau ? ` sur ${reseau}` : ' avec Treg'}`};
    }
    return {icone: 'globe', texte: treg[1] === 'catalog_get' ? `Prépare la publication${reseau ? ` sur ${reseau}` : ''}` : 'Regarde Treg'};
  }
  // le connecteur Google Drive (Claude)
  if (outil.startsWith(PREFIXE_OUTILS)) {
    const quoi = outil.slice(PREFIXE_OUTILS.length);
    if (quoi === 'search_files') return {icone: 'nuage', texte: `Cherche dans ton Google Drive${entree.query ? ` : ${String(entree.query).slice(0, 70)}` : ''}`};
    if (quoi === 'create_file') return {icone: 'nuage', texte: `Crée « ${String(entree.title ?? entree.name ?? 'un document').slice(0, 60)} » sur ton Google Drive`};
    if (quoi === 'copy_file') return {icone: 'nuage', texte: 'Copie un fichier de ton Google Drive'};
    if (quoi === 'list_recent_files') return {icone: 'nuage', texte: 'Regarde tes fichiers récents du Google Drive'};
    return {icone: 'nuage', texte: quoi === 'get_file_metadata' || quoi === 'get_file_permissions' ? 'Regarde un fichier de ton Google Drive' : 'Lit un fichier de ton Google Drive'};
  }
  if (outil === 'Bash') {
    const c = String(entree.command ?? '');
    // une description vide ou de remplissage (« bash_placeholder ») ne dit rien à l'humain : on décrit la commande nous-mêmes
    const dit = String(entree.description ?? '').trim().replace(/^\w*placeholder\w*$/i, '');
    const eleven = /elevenlabs|api\.elevenlabs\.io/i.test(c);
    const envoi = /curl[^\n]*-X\s*PUT|litterbox|upload_url|uploadUrl/i.test(c);
    const icone = eleven ? 'onde' : envoi ? 'globe' : /rendre\.mjs|remotion\s+render|npm run rendu|ffmpeg/.test(c) ? 'film' : /blender/i.test(c) ? 'cube' : /remotion\s+still|look\.py|ffprobe|check\.py|loudness\.py/.test(c) ? 'oeil' : /SKILL\.md/.test(c) ? 'outil' : 'outil';
    const competence = /(?:skills)[\\/]([\w.-]+)[\\/]SKILL\.md/.exec(c)?.[1];
    const defaut = eleven ? 'Crée avec ElevenLabs' : envoi ? 'Envoie la vidéo sur le réseau' : /rendre\.mjs|remotion\s+render|npm run rendu/.test(c) ? 'Rend la vidéo' : /remotion\s+still/.test(c) ? 'Regarde une image du rendu' : /blender/i.test(c) ? 'Travaille dans Blender'
      : competence ? `Lit la compétence « ${competence} »` : /ffprobe|check\.py|loudness\.py/.test(c) ? 'Mesure la vidéo' : /ffmpeg/.test(c) ? 'Traite la vidéo avec FFmpeg' : /^(cat|sed|head|tail|less|rg|grep|ls|find)\b/.test(c.trim()) ? 'Lit le dossier' : 'Lance une commande';
    return {icone, texte: dit || defaut};
  }
  return {icone: 'outil', texte: outil.replace(/^mcp__[^_]+(?:_[^_]+)*__/, '')};
}

const CONSIGNES = (moteur, espace = null) => `Tu es lancé par Dérush, un logiciel de montage vidéo. Tu es le monteur : l'humain te parle comme dans une conversation, et il ne peut pas te répondre pendant que tu travailles.
- S'il demande une ou plusieurs vidéos (ou une modification), va jusqu'au bout sans demander d'accord ni poser de question. Si une étape de CLAUDE.md ou de LISEZMOI-IA.md dit d'attendre un accord, fais le choix le plus sûr, continue, et dis-le à la fin.
- S'il pose une question, demande un avis ou t'envoie seulement de la matière (références, charte…), réponds-lui simplement, sans fabriquer de vidéo.
- Ce qu'il t'a donné (références, vidéos, charte graphique, logo, polices, archives, créations ElevenLabs) est dans contexte/ : lis contexte/INDEX.md, regarde les pièces, et respecte la charte s'il y en a une.
- Travaille uniquement dans ce dossier. Le kit remotion/ est déjà installé (node_modules présent) : pars de lui.${moteur === 'codex' ? '\n- Tu travailles dans un bac à sable : tu peux écrire dans ce dossier et dans le dossier temporaire (et, par leurs commandes, dans la bibliothèque de sons), et le réseau est ouvert (ElevenLabs, Treg, Openverse). N’installe rien ailleurs. Le navigateur de rendu ne peut pas démarrer dans ce bac à sable : pour rendre, lance toujours « node remotion/rendre.mjs <Composition> <fichier.mp4> » — Dérush fait alors le rendu pour toi et te renvoie sa sortie. « npx remotion render », « remotion still » et « remotion studio » ne marchent pas ici : pour regarder une image, tire-la de la vidéo rendue avec FFmpeg (ou look.py de ffmpeg-skill).' : moteur === 'gemini' ? '\n- Tu travailles dans un bac à sable : tu peux écrire dans ce dossier et dans le dossier temporaire (et, par leurs commandes, dans la bibliothèque de sons), et tu ne lis que ce dossier et les outils de Dérush. Le réseau est ouvert pour tes commandes (ElevenLabs, Openverse, une page à lire) : curl, Python et Node y passent tout seuls. N’installe rien ailleurs. Le navigateur de rendu ne peut pas démarrer dans ce bac à sable : pour rendre, lance toujours « node remotion/rendre.mjs <Composition> <fichier.mp4> » — Dérush fait alors le rendu pour toi et te renvoie sa sortie ; un rendu prend souvent une à trois minutes : attends la fin de la commande avant de continuer. « npx remotion render », « remotion still » et « remotion studio » ne marchent pas ici : pour regarder une image, tire-la de la vidéo rendue avec FFmpeg (ou look.py de ffmpeg-skill). Ne demande jamais à sortir du bac à sable : personne n’est là pour te répondre, ce sera refusé ; si une commande utile échoue à cause de lui, continue sans elle et dis-le à la fin. Tu n’as pas les outils Treg (voir plus bas).' : ''}
- Le format de sortie est celui du projet (montage.json, « sortie ») ; s'il te demande un autre format (paysage 16:9, carré, 4:5…) ou plusieurs, fais une composition par format. Les rushes peuvent être de formats différents : cadre chacun pour remplir l'image sans le déformer.
- Rends toujours avec « node remotion/rendre.mjs <Composition> <fichier.mp4> » (ou « npm run rendu » dans remotion/) : l'humain voit ton rendu en direct dans Dérush, image par image. N'utilise « npx remotion render » qu'en dernier recours.
- Une seule vidéo : livre-la dans rendu/final.mp4. Plusieurs vidéos (plusieurs clips, plusieurs formats, plusieurs langues) : une composition par vidéo, et livre-les toutes dans rendu/livraison/, avec rendu/livraison/livraison.json : [{"fichier": "clip-1.mp4", "titre": "Titre court", "coupes": [{"plan": "M1", "de": 12.4, "a": 18.9}, …]}, …]. « coupes » : les passages de chaque vidéo, dans l'ordre (le format de coupes.json pour recouper.mjs, temps du rush) ; avec eux, l'humain peut mettre chaque vidéo dans sa timeline et la retoucher plan par plan. À chaque nouvelle demande, remplace ce que tu avais livré.
- D'autres fichiers à remettre avec la vidéo (image fixe, storyboard, master de haute qualité, liste des polices et des sons, sous-titres…) : mets-les dans rendu/livraison/annexes/. Dérush les range à côté de la vidéo et les montre à l'humain ; ne les mets pas ailleurs.
- La table de montage : dès que ton plan est prêt, écris rendu/timeline.json, et tiens-le à jour jusqu'à la fin. C'est la liste de ce que tu poses sur la vidéo : {"duree_s": 27.4, "blocs": [{"id": "titre-intro", "piste": "texte", "nom": "Titre d'intro", "debut_s": 0, "duree_s": 2.4, "detail": "« SHIBUYA » derrière la personne, police Anton, jaune", "texte": "SHIBUYA"}]}. Un bloc par élément : chaque plan gardé (piste "plan", avec "source" = l'id du rush, et "de" / "a" = le passage du rush, en secondes), chaque titre ou texte à l'écran ("texte", avec son "texte"), les sous-titres ("sous-titres"), chaque effet ou transition ("effet"), chaque musique, voix ou bruitage ("son"). Des noms courts et clairs, en français ; les mêmes "id" d'une version à l'autre ; avec plusieurs vidéos, ajoute "video" (le nom du fichier livré). L'humain voit ces blocs en direct dans sa timeline et te demande des réglages en citant leur "id" : applique exactement ces réglages, sans toucher au reste, puis remets le fichier à jour.
- Un « son tendance » (une musique du commerce qui marche sur TikTok ou Instagram) ne se met jamais dans le fichier : le réseau couperait le son ou retirerait la vidéo. Si l'humain en veut un, monte sur le rythme (dis le tempo que tu as pris), garde ta bande son discrète ou absente à cet endroit, et dis-lui quel son choisir dans l'app au moment de publier.
- Travaille comme un monteur exigeant : suis « La méthode » de MOTION.md (tout regarder, préparer la matière, contrôler avant le rendu complet, puis après). Avant de finir, vérifie chaque vidéo (« Vérifier avant de livrer » dans LISEZMOI-IA.md) : lance « derush-controle » sur la vidéo et corrige tout ce qu'il signale, regarde des images du rendu en pleine taille.
${apprend(espace) ? "- Le carnet du monteur : CARNET.md (s'il est là) dit ce que les montages précédents de cet espace ont appris (les rushes, les goûts, les pièges des outils) ; lis-le avant de commencer. À la fin, écris dans carnet-ia.md ce que ce montage t'a appris d'utile pour les prochains : 1 à 5 lignes « - … », rien de personnel ni de secret. Si mon message corrige ta vidéo précédente, ajoute une ligne « - Goût : … » qui dit la préférence générale que cette correction révèle (ce que je veux d'habitude, pas ce cas précis). Dérush le garde d'un projet à l'autre ; ta propre mémoire, elle, est perdue au projet suivant (n'y range pas ces leçons)." : espace && espace.type !== 'neutre' ? "- Pas de carnet pour ce projet : l'apprentissage est coupé pour cet espace (c'est un choix de l'humain, dans « Mes espaces »). N'écris rien dans carnet-ia.md ; le reste de ce qui est dit sur l'espace du projet vaut toujours." : "- Pas de carnet pour ce projet (il n'est rattaché à personne) : n'écris rien dans carnet-ia.md."}
- Écris la description de chaque commande en français, en quelques mots simples : l'humain la lit pendant que tu travailles. Les phrases que tu écris entre deux étapes sont en français elles aussi.
- Termine par un message court pour l'humain (8 lignes au plus), en français simple et sans jargon : ce que tu as fait, ce que tu n'as pas pu faire, et une ou deux idées pour aller plus loin. N'y mets ni chemin de fichier ni nom de fichier ou de code : l'humain regarde les vidéos directement dans Dérush.`;

/**
 * Pour le rappel des connexions : les vidéos du projet dans Dérush (lib/sequences.mjs), quand il y en a plusieurs. La
 * demande vaut pour la vidéo ouverte ; un dossier de travail repris peut avoir été préparé pour une autre.
 */
function rappelVideos(P, e) {
  const liste = Array.isArray(P.d.sequences) ? P.d.sequences : [];
  if (liste.length < 2) return '';
  const nom = (id) => liste.find((x) => x.id === id)?.nom ?? null;
  const ouverte = nom(P.d.sequence);
  const atelier = e.sequence && e.sequence !== P.d.sequence ? (nom(e.sequence) ?? e.sequence_nom) : null;
  return ` ; dans Dérush, ce projet a ${liste.length} vidéos et celle qui est ouverte est « ${ouverte} »${atelier ? ` (ton dossier de travail a été préparé pour « ${atelier} »)` : ''}`;
}

/**
 * Un vlog se raconte : quand les rushes parlent peu, l'IA de montage propose une voix off et pose ses questions à la fin
 * de sa réponse, après avoir livré (lib/voix-off.mjs les range ; l'interface les montre et allume le bouton du micro).
 * `voixOff` : ce qu'installerVoixOff a posé (null : rien de conseillé ni de commencé). Rien si l'humain n'en veut pas,
 * si sa façon de la faire est déjà choisie (consigneVoixOff dit alors quoi faire), ni hors des modes à rushes filmés
 * (en mode « voix off », la consigne du mode dit déjà quoi faire tant que rien n'est commencé).
 */
function consigneRecit(voixOff, mode) {
  if (voixOff?.choix === 'aucune' || voixOff?.mode) return '';
  if (mode !== 'montage' && !(mode === 'voix' && voixOff)) return '';
  const ordre = 'livre d’abord une première version complète, sans attendre de réponse ; tes questions viennent ensuite, à la fin de ta réponse : 3 à 5, courtes, numérotées, chacune sur un moment précis des rushes (où il était, ce qui s’est passé, ce qu’il a ressenti), au tutoiement, jamais fermées';
  if (voixOff) return `- Voix off, dans cet ordre : ${ordre}.`;
  return `- Un vlog (une journée, un voyage, une sortie) ou tout montage dont les rushes parlent peu se raconte. Si une voix off le rendrait plus complet, propose-la : ${ordre}. Écris-les aussi dans voix-off/questions.json : {"fil": "le fil du film en 2 à 4 phrases", "questions": [{"texte": "la question", "medias": ["M3"], "debut": 12, "fin": 25, "pourquoi": "ce que la réponse apportera"}]} (debut et fin en secondes dans le rush). Dérush les lui montre et allume le bouton du micro : il répond par écrit ou à voix haute, puis choisit de la lire lui-même, de garder ses réponses, ou une voix ElevenLabs. Si les rushes se suffisent (on parle à la caméra, une interview), ne pose pas de question.`;
}

/**
 * Des rushes à aller chercher dans le Drive : c'est « Depuis mon Drive » qui le fait (lib/drive-medias.mjs), pas l'IA de
 * montage. Elle copierait depuis drive/ sans plan borné, sans les vraies dates de prise de vue, et Google Drive
 * téléchargerait sans que la personne voie combien de fichiers ni de Go.
 */
const CONSIGNE_RUSHES_DU_DRIVE = '- Des rushes à prendre dans son Drive (« va dans mon Drive, prends les vidéos de mon séjour ») : ne les copie pas toi-même par lots depuis drive/. Dis-lui d’utiliser « Depuis mon Drive » dans Dérush (à l’import des médias) : Dérush y trouve les bons dossiers, lit le vrai jour et la vraie heure de chaque prise, lui montre combien de fichiers et de Go avant de les télécharger, puis les met dans le projet dans l’ordre où ils ont été filmés ; il te renverra sa demande ensuite. Un ou deux fichiers précis qu’il te nomme, tu peux les copier.';

/** Les vidéos que l'IA a livrées pendant ce travail : rendu/livraison/ (plusieurs), sinon rendu/final.mp4. */
function livraisons(atelier, depuis) {
  const R = path.join(atelier, 'rendu');
  const recente = (f) => { try { const st = fs.statSync(f); return st.isFile() && st.size > 10000 && st.mtimeMs >= depuis - 2000; } catch { return false; } };
  const L = path.join(R, 'livraison');
  let liste = [];
  try {
    const manifeste = lireJson(path.join(L, 'livraison.json'));
    const decrites = Array.isArray(manifeste) ? manifeste : Array.isArray(manifeste?.videos) ? manifeste.videos : [];
    const vues = new Set();
    for (const x of decrites) {
      const f = path.join(L, path.basename(String(x?.fichier ?? '')));
      if (/\.(mp4|mov)$/i.test(f) && recente(f) && !vues.has(f)) { vues.add(f); liste.push({fichier: f, titre: String(x.titre ?? '').slice(0, 80) || null, description: String(x.description ?? '').slice(0, 300) || null, coupes: Array.isArray(x.coupes) ? x.coupes.slice(0, 300) : null}); }
    }
    for (const n of fs.readdirSync(L).sort((a, b) => a.localeCompare(b, 'fr', {numeric: true}))) {
      const f = path.join(L, n);
      if (/\.(mp4|mov)$/i.test(n) && recente(f) && !vues.has(f)) liste.push({fichier: f, titre: null, description: null});
    }
  } catch { /* pas de dossier livraison */ }
  if (!liste.length && recente(path.join(R, 'final.mp4'))) liste = [{fichier: path.join(R, 'final.mp4'), titre: null, description: null}];
  if (!liste.length) {
    try {
      const videos = fs.readdirSync(R).filter((f) => /\.(mp4|mov)$/i.test(f)).map((f) => path.join(R, f)).filter(recente).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      if (videos[0]) liste = [{fichier: videos[0], titre: null, description: null}];
    } catch { /* pas de dossier rendu */ }
  }
  return liste.slice(0, 20);
}
/** Ce que l'IA a publié (rendu/publications.json, écrit pendant ce travail), vérifié avant d'être montré. */
function publications(atelier, depuis) {
  const f = path.join(atelier, 'rendu', 'publications.json');
  try { if (fs.statSync(f).mtimeMs < depuis - 2000) return []; } catch { return []; }
  const liste = lireJson(f);
  if (!Array.isArray(liste)) return [];
  const texte = (v, n) => (v == null ? null : String(v).slice(0, n));
  return liste.filter((x) => x && RESEAUX[x.reseau]).slice(0, 20).map((x) => ({
    reseau: x.reseau,
    etat: ['publie', 'brouillon', 'en_cours', 'echec'].includes(x.etat) ? x.etat : 'en_cours',
    lien: /^https:\/\/[^\s"<>]+$/.test(String(x.lien ?? '')) ? String(x.lien) : null,
    visibilite: texte(x.visibilite, 20), titre: texte(x.titre, 200), legende: texte(x.legende, 2400),
    hashtags: Array.isArray(x.hashtags) ? x.hashtags.slice(0, 30).map((h) => String(h).slice(0, 80)) : [],
    message: texte(x.message, 400), video: texte(x.video, 200),
  }));
}
/** Les crédits des sons à citer (rendu/credits-sons.md, écrit pendant ce travail) : seulement s'il y en a vraiment. */
function creditsSons(atelier, depuis) {
  const f = path.join(atelier, 'rendu', 'credits-sons.md');
  try { if (fs.statSync(f).mtimeMs < depuis - 2000) return null; } catch { return null; }
  let t = '';
  try { t = fs.readFileSync(f, 'utf8'); } catch { return null; }
  const lignes = t.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[-•*]\s+\S/.test(l)).map((l) => l.replace(/^[-•*]\s+/, '').slice(0, 400)).slice(0, 30);
  return lignes.length ? {nombre: lignes.length, texte: `Sons :\n${lignes.map((l) => `- ${l}`).join('\n')}`} : null;
}
/**
 * La table de montage de l'IA (rendu/timeline.json, qu'elle tient à jour pendant son travail) : ce qu'elle pose sur la
 * vidéo, bloc par bloc — plans, titres et textes, sous-titres, effets, sons. Dérush la montre en direct dans la
 * timeline ; l'humain clique un bloc pour demander un réglage précis. Tout est vérifié et borné avant d'être montré.
 */
const PISTES_TABLE = ['plan', 'texte', 'sous-titres', 'effet', 'son'];
export function tableIA(atelier, depuis = 0) {
  const f = path.join(atelier, 'rendu', 'timeline.json');
  try { if (fs.statSync(f).mtimeMs < depuis - 2000) return null; } catch { return null; }
  const j = lireJson(f);
  const liste = Array.isArray(j) ? j : Array.isArray(j?.blocs) ? j.blocs : null;
  if (!liste) return null;
  const nombre = (v, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.round(Math.min(max, Math.max(min, n)) * 1000) / 1000 : null; };
  const texte = (v, n) => (v == null || v === '' ? null : String(v).replace(/\s+/g, ' ').trim().slice(0, n));
  const vus = new Set();
  const blocs = [];
  for (const b of liste.slice(0, 300)) {
    if (!b || typeof b !== 'object') continue;
    const debut = nombre(b.debut_s ?? b.debut, 0, 36000);
    const duree = nombre(b.duree_s ?? b.duree ?? (b.fin_s != null && debut != null ? Number(b.fin_s) - debut : null), 0.04, 36000);
    if (debut == null || duree == null) continue;
    let id = String(b.id ?? '').replace(/[^\w.-]/g, '').slice(0, 60) || `bloc-${blocs.length + 1}`;
    while (vus.has(id)) id = `${id}-bis`;
    vus.add(id);
    blocs.push({id, piste: PISTES_TABLE.includes(b.piste) ? b.piste : 'effet', nom: texte(b.nom, 80) ?? id, debut_s: debut, duree_s: duree, detail: texte(b.detail, 300), texte: texte(b.texte, 300),
      video: b.video ? path.basename(String(b.video)).slice(0, 120) : null, source: texte(b.source, 20),
      // le passage du rush (en secondes du rush) : de quoi refaire ce plan dans la timeline de Dérush
      ...(b.de != null && b.de !== '' && nombre(b.de, 0, 360000) != null ? {de: nombre(b.de, 0, 360000)} : {}), ...(b.a != null && b.a !== '' && nombre(b.a, 0, 360000) != null ? {a: nombre(b.a, 0, 360000)} : {})});
  }
  if (!blocs.length) return null;
  blocs.sort((a, b) => a.debut_s - b.debut_s);
  return {duree_s: nombre(j?.duree_s, 0, 36000) ?? Math.max(...blocs.map((b) => b.debut_s + b.duree_s)), blocs};
}
/** Une bande d'images de la vidéo, pour la piste de l'IA dans la timeline. */
async function vignettesVideo(fichier, info, sortie) {
  if (!info?.duree || !info.largeur) return null;
  const n = Math.max(6, Math.min(120, Math.round(info.duree / 1.5)));
  const h = 96;
  const l = Math.max(2, Math.round((h * info.largeur) / info.hauteur / 2) * 2);
  try {
    await ffmpeg(['-y', '-i', fichier, '-map', '0:v:0', '-an', '-vf', `fps=${(n / info.duree).toFixed(6)},scale=${l}:${h},tile=${n}x1`, '-frames:v', '1', '-q:v', '5', sortie], {duree: info.duree});
    return {n, pas: info.duree / n, l, h};
  } catch {
    return null;
  }
}

/** Les textes que l'humain a relus dans « Partager » : l'IA les publie tels quels, sans les réécrire. */
function textesValides(textes, reseaux) {
  if (!textes || typeof textes !== 'object') return null;
  const blocs = reseaux.filter((r) => textes[r]?.legende).map((r) => {
    const t = textes[r];
    return [`${RESEAUX[r].nom} :`, t.titre ? `- titre : ${String(t.titre).slice(0, 120)}` : null, `- légende : ${String(t.legende).slice(0, 5000)}`,
      Array.isArray(t.hashtags) && t.hashtags.length ? `- hashtags : ${t.hashtags.slice(0, 30).join(' ')}` : null,
      t.premier_commentaire ? `- premier commentaire (à me redonner à la fin, je l’épinglerai moi-même) : ${String(t.premier_commentaire).slice(0, 600)}` : null].filter(Boolean).join('\n');
  });
  if (!blocs.length) return null;
  const manquants = reseaux.filter((r) => !textes[r]?.legende).map((r) => RESEAUX[r].nom);
  return `J’ai déjà relu et validé les textes : publie-les tels quels, sans les réécrire ni les raccourcir (suis la compétence derush-publier pour le reste).\n\n${blocs.join('\n\n')}${manquants.length ? `\n\nPour ${manquants.join(' et ')}, écris toi-même le titre, la légende et les hashtags.` : ''}`;
}

/** Ce que l'humain a demandé de publier depuis une vidéo : {video, reseaux[], visibilite} vérifié, et le message qui va avec. */
export function demandePublication(P, e, publier) {
  if (!publier || typeof publier !== 'object') return null;
  const reseaux = [...new Set((Array.isArray(publier.reseaux) ? publier.reseaux : []).filter((r) => RESEAUX[r]))];
  if (!reseaux.length) throw new Error('Choisis au moins un réseau où publier.');
  const nom = path.basename(String(publier.video ?? ''));
  // une vidéo livrée par l'IA, ou fabriquée par « Créer la vidéo » (elles sont toutes dans le dossier « vidéos »)
  const video = (e.versions ?? []).flatMap(videosDe).find((x) => x.nom === nom) ?? (/\.mp4$/i.test(nom) ? {nom, titre: P.d.titre} : null);
  if (!video || !fs.existsSync(path.join(P.racine, 'vidéos', nom))) throw new Error('Cette vidéo n’existe plus.');
  const visibilite = ['public', 'unlisted', 'private'].includes(publier.visibilite) ? publier.visibilite : 'unlisted';
  const liste = reseaux.map((r) => RESEAUX[r].nom);
  const quoi = liste.length > 1 ? `${liste.slice(0, -1).join(', ')} et ${liste.at(-1)}` : liste[0];
  const texte = `Publie la vidéo « ${video.titre ?? nom} » (le fichier a-publier/${nom}) sur ${quoi}.${reseaux.includes('youtube') ? ` Sur YouTube : ${visibilite === 'public' ? 'publique' : visibilite === 'private' ? 'privée' : 'non répertoriée'}.` : ''} ${textesValides(publier.textes, reseaux) ?? 'Écris pour chaque réseau le titre, la légende et les hashtags qui lui vont, en suivant la compétence derush-publier.'}${publier.consigne ? `\n\nCe que je veux en plus : ${String(publier.consigne).slice(0, 1000)}` : ''}`;
  return {nom, reseaux, visibilite, texte};
}

// ——— YouTube demandé avec ses propres mots (hors de la fenêtre « Partager ») ———
const LETTRE = '[\\p{L}\\p{N}]'; // une lettre ou un chiffre (les « \\b » de JavaScript ne connaissent pas les accents)
const BLANC = '[ \\u00a0\\u202f]+';
// un verbe d'envoi : publie, poste, envoie, partage, diffuse, téléverse, « mets en ligne », « mets-la sur YouTube »
const VERBE_ENVOI = new RegExp(`(?<!${LETTRE})(?:publi(?:e[rsz]?|ée?s?|ons|ant|cations?)|post(?:e[rsz]?|ée?s?|ons|ant)|envo(?:ie[sz]?|is?|yer|yez|yons)|upload\\p{L}*|t[ée]l[ée]vers\\p{L}*|partag(?:e[rsz]?|ée?s?|eons)|diffus(?:e[rsz]?|ée?s?|ons|ion)`
  + `|(?:mets?|mettre)(?:-\\p{L}+)?${BLANC}(?:\\S+${BLANC}){0,2}en${BLANC}ligne|mise${BLANC}en${BLANC}ligne|(?:mets?|mettre)(?:-\\p{L}+)?${BLANC}(?:(?!comme(?!${LETTRE}))\\S+${BLANC}){0,3}sur${BLANC}(?:(?:ma|la|notre)${BLANC}cha[iî]ne${BLANC})?youtube)(?!${LETTRE})`, 'giu');
// une négation dans le même bout de phrase, avant le verbe (« ne la publie pas », « sans publier », « pas besoin de poster »)…
const NON_AVANT = new RegExp(`(?:(?<!${LETTRE})n['’]|(?<!${LETTRE})(?:ne|sans|pas|jamais|[ée]vite\\p{L}*|interdit\\p{L}*|aucune?)(?!${LETTRE}))[^,:()]*$`, 'iu');
// … ou juste après lui (« publie pas », « publie-la surtout pas »)
const NON_APRES = new RegExp(`^(?:-\\p{L}+)*${BLANC}(?:surtout${BLANC}|encore${BLANC})?(?:pas|rien|jamais)(?!${LETTRE})`, 'iu');
// « n'oublie pas de… », « n'hésite pas à… », « pourquoi pas… » ne sont pas des refus
const FAUX_NON = new RegExp(`n['’]\\s?(?:oublie[sz]?|h[ée]site[sz]?)\\s+pas(?!${LETTRE})|pourquoi\\s+pas(?!${LETTRE})`, 'giu');
const MOT_SHORTS = new RegExp(`(?<!${LETTRE})shorts?(?!${LETTRE})`, 'iu');
const AUTRE_RESEAU = /tiktok|insta|reels?|linkedin|facebook|snap/i;
const MOT_PUBLIC = new RegExp(`(?<!${LETTRE})publi(?:c|que)s?(?!${LETTRE})`, 'iu');
/**
 * L'humain demande-t-il, avec ses propres mots, d'envoyer la vidéo sur YouTube ? Il faut un verbe d'envoi dans la même
 * phrase que YouTube (ou « Shorts », quand aucun autre réseau n'y est nommé), sans négation : « au format YouTube
 * Shorts », « 3 shorts pour TikTok » ou « ne publie surtout pas sur YouTube » n'ouvrent rien. Renvoie null, ou la
 * visibilité permise au plus : « public » seulement s'il a écrit le mot, sinon non répertoriée.
 */
export function youtubeDemande(message) {
  const texte = String(message ?? '');
  for (const brute of texte.split(/[.!?;\n]+/)) {
    const phrase = brute.replace(FAUX_NON, 'pense');
    if (!/you\s?tube/i.test(phrase) && !(MOT_SHORTS.test(phrase) && !AUTRE_RESEAU.test(phrase))) continue;
    for (const m of phrase.matchAll(VERBE_ENVOI)) {
      if (NON_AVANT.test(phrase.slice(0, m.index)) || NON_APRES.test(phrase.slice(m.index + m[0].length))) continue;
      return {visibilite: MOT_PUBLIC.test(texte) ? 'public' : 'unlisted'};
    }
  }
  return null;
}

/**
 * Envoie un message à l'IA : elle répond, monte une ou plusieurs vidéos, ou publie.
 * message : ce que l'humain écrit · pieces : les pièces jointes à ce message · moteur ('claude' | 'codex' | 'gemini') · qualite
 * ('rapide' | 'soigne' | 'max') · modele, effort (réglages fins, facultatifs) · publier : {video, reseaux, visibilite} ·
 * nouveau : repartir du montage actuel de Dérush (nouveau dossier de travail). Rend la main tout de suite.
 */
export function demander(P, options = {}, surFin = null) { return lancerDemande(P, options, surFin); }
/**
 * `suite` ne vient jamais de l'interface : c'est Dérush qui enchaîne, après un travail, les messages écrits pendant ce
 * travail ({de : le travail qui garde encore le projet occupé, etats : l'état des assistants, déjà lu}).
 */
async function lancerDemande(P, {message, moteur = null, qualite = null, modele = null, effort = null, nouveau = false, file = null, pieces = [], publier = null, dejaAffiche = false} = {}, surFin = null, suite = null) {
  const ids = (Array.isArray(pieces) ? pieces : []).map(String).filter((x) => /^J\d+$/.test(x));
  const pris = () => { const o = EN_COURS.get(P.racine); return !!o && o !== suite?.de; };
  if (pris()) throw new Error('L’IA travaille déjà sur ce projet.');
  // La seule attente de cette fonction, AVANT de lire la conversation : de la garde qui suit jusqu'à EN_COURS.set, tout
  // se fait d'une traite. Deux demandes presque en même temps (un double ⌘↵, un double clic sur « Publier », deux
  // fenêtres) ne peuvent donc plus passer toutes les deux et lancer deux IA dans le même dossier.
  const etats = suite?.etats ?? await etatIA();
  if (pris()) throw new Error('L’IA travaille déjà sur ce projet.');
  const e = lireEtat(P);
  e.echanges ??= [];
  e.versions ??= [];
  const pub = demandePublication(P, e, publier);
  // Treg coupé dans Connexions : l'IA n'aurait ni ses outils ni sa clé (plus bas), elle ne pourrait que le constater
  // après des minutes de travail. On le dit tout de suite.
  if (pub && !etatTreg().actif) throw new Error('Treg est coupé pour ton IA : rallume-le dans Connexions › Treg (« Donner Treg à l’IA »), puis publie de nouveau.');
  // YouTube seul, sans la clé Treg : l'IA ne pourrait que le constater (voir lib/youtube.mjs). On le dit tout de suite.
  if (pub && pub.reseaux.every((r) => r === 'youtube') && !jetonTreg()) throw new Error('YouTube a besoin de ta clé Treg : le connecteur Treg de ton compte Claude ne lui suffit pas. Ouvre Connexions › Treg › « Relier mes réseaux », colle ta clé, puis publie de nouveau.');
  // un long brief collé tel quel passe en entier ; au-delà de la limite, on le dit au lieu de couper sans prévenir
  let texte = String(message ?? '').trim();
  if (texte.length > LONGUEUR_MESSAGE) throw new Error(`Ton message est trop long (${texte.length.toLocaleString('fr-FR')} caractères, ${LONGUEUR_MESSAGE.toLocaleString('fr-FR')} au plus). Mets ce texte dans un fichier et joins-le avec le trombone : ton IA le lira en entier.`);
  if (pub) texte = texte ? `${pub.texte}\n\n${texte}` : pub.texte;
  if (!texte && !ids.length) throw new Error('Écris d’abord ce que tu veux que l’IA fasse.');
  if (!texte) texte = 'Voici de la matière pour la suite : regarde-la et dis-moi ce que tu en tires.';
  // le mode « motion design » part d'une simple description : rien à importer
  const mode = MODES[P.d.mode] ? P.d.mode : 'montage';
  if (!P.d.medias.length && !ids.length && !pub && MODES[mode].matiere) throw new Error('Importe d’abord au moins une vidéo, un son ou une photo, ou joins un fichier à ton message.');
  // l'assistant : celui demandé, sinon celui choisi dans Dérush, sinon le premier prêt
  if (!IA[moteur]) moteur = etats.choisi;
  const ia = etats[moteur];
  if (!ia?.ok) throw new Error(`${ia?.pourquoi ?? `${IA[moteur].nom} n’est pas prêt.`} Ouvre Connexions pour le brancher.`);
  // Gemini n'a pas les outils Treg : seul YouTube passe (par la commande de Dérush). On le dit avant de le lancer.
  if (pub && moteur === 'gemini' && pub.reseaux.some((r) => r !== 'youtube')) throw new Error('Avec Gemini, Dérush ne sait publier que sur YouTube. Pour TikTok, Instagram et LinkedIn, choisis Claude ou Codex (« Qui monte ? »), puis publie de nouveau.');
  // le modèle de Claude : celui de la demande, sinon celui choisi dans Connexions, sinon celui du niveau
  const reglage = reglageIA(moteur, qualite ?? lireReglages().ia_qualite ?? 'max', modele ?? (moteur === 'claude' ? lireReglages().ia_modele ?? null : null), effort, ia.modeles ?? []);
  const nomIA = IA[moteur].nom;
  // pour qui est ce projet. Si « Pour qui ? » a changé depuis que le dossier de travail a été préparé, on ne garde ni ce
  // dossier ni la conversation de l'IA, quoi que l'interface ait demandé (« Continuer », « Partager ») : voir espaceChange
  const espace = espaceDuProjet(P);
  const autreEspace = espaceChange(P, e, espace);
  if (autreEspace) nouveau = true;
  // le dossier de travail est gardé (même si l'on change d'assistant) ; la conversation, elle, est propre à chacun
  const garderAtelier = !nouveau && !!e.atelier && fs.existsSync(path.join(P.racine, e.atelier, 'montage.json'));
  const sessionAvant = garderAtelier ? (e.sessions[moteur] ?? null) : null;
  if (garderAtelier && !e.espace) e.espace = espace?.id ?? 'moi'; // un dossier d'avant cette règle : pris pour celui d'aujourd'hui
  // le message de l'humain s'affiche tout de suite dans la conversation, avec ses pièces jointes
  const n = e.echanges.length;
  const jointes = attacherPieces(P, ids, n);
  if (!dejaAffiche) e.echanges.push({role: 'humain', texte, quand: new Date().toISOString(), pieces: jointes, ...(pub ? {publier: {reseaux: pub.reseaux, video: pub.nom}} : {})});
  ecrireEtat(P, e);
  const c = {proc: null, etape: garderAtelier ? 'claude' : 'preparation', debut: Date.now(), debutIA: null, activite: [], nActivite: 0, vues: [], atelier: garderAtelier ? path.join(P.racine, e.atelier) : null,
    progression: 0, annule: false, message: texte, moteur, qualite: reglage.qualite, modele: reglage.modele, effort: reglage.effort, reprise: garderAtelier, publier: pub,
    // ce que l'humain écrit pendant le travail : lu au prochain geste par Claude, ou envoyé à la suite pour les autres
    // (à la suite d'un travail, ses messages sont repris, déjà lus : ils font partie de cette demande)
    etat: e, messages: (suite?.de?.messages ?? []).map((m) => ({...m, lu: true, envoye: true})), enAttente: [], ecrire: null, envoyes: 0, rejoues: 0, file, surFin};
  EN_COURS.set(P.racine, c);
  occupe(true); // l'IA peut dépenser des crédits ElevenLabs : les coûts mesurés pendant ce temps ne seraient pas justes
  const noter = (icone, t) => { c.nActivite++; c.activite.push({t: Math.round((Date.now() - c.debut) / 1000), icone, texte: t}); if (c.activite.length > 300) c.activite.splice(0, 100); };
  // ce qui s'est dit avant, pour un assistant qui ne peut pas reprendre sa propre conversation (nouveau dossier, autre
  // assistant, conversation perdue). D'un autre espace, seuls mes messages passent (sans les textes d'une publication) :
  // les réponses de l'IA d'alors parlent de l'univers de cet espace-là.
  const depuisEspace = autreEspace ? n : (e.espace_depuis ?? 0);
  const historique = e.echanges.slice(0, n).map((x, k) => ({x, k})).filter(({x, k}) => x.texte && !x.erreur && !x.arret && (k >= depuisEspace || (x.role === 'humain' && !x.publier))).slice(-10)
    .map(({x}) => (x.role === 'humain' ? `- Moi : ${String(x.texte).slice(0, 600)}` : `- ${IA[x.moteur ?? 'claude']?.nom ?? 'L’IA'} : ${String(x.texte).slice(0, 400)}`));
  const siArrete = () => { if (c.annule) throw new Error('Arrêté.'); };

  const travail = (async () => {
    let atelier = c.atelier;
    let session = sessionAvant;
    // la place sur le disque : un disque plein arrête le travail en route (rendus à moitié écrits)
    const place = verifierPlace(P.racine);
    if (!place.ok) throw new Error(place.texte);
    if (place.prevenir) noter('attention', place.texte);
    c.placeTexte = place.prevenir ? place.texte : null;
    if (!garderAtelier) {
      // 1. le dossier de montage : le pack complet, avec son kit prêt à rendre
      // les médias qu'on vient de déposer finissent d'abord de se préparer (texte, images, son) : l'IA en a besoin
      if (file && (file.enCours || file.attente.length)) { noter('outil', 'Attend la fin de la préparation de tes médias'); await file.vide(); }
      if (c.annule) throw new Error('Arrêté.');
      // le texte mot à mot des rushes qui parlent : sans lui, l'IA ne peut ni choisir les bonnes phrases ni sous-titrer
      const utilises = P.d.montage.length ? new Set([...P.d.montage, ...(P.d.superpositions ?? [])].map((it) => it.media).filter(Boolean)) : new Set(P.d.medias.map((m) => m.id));
      const sansTexte = P.d.medias.filter((m) => utilises.has(m.id) && m.audio && !m.transcription);
      if (sansTexte.length && (await moteurs()).whisper?.ok) {
        for (const [k, m] of sansTexte.entries()) {
          if (c.annule) throw new Error('Arrêté.');
          noter('texte', `Écrit le texte de « ${m.nom} »`);
          try { await transcrire(P, m, 'whisper', (p) => { c.progression = ((k + p) / sansTexte.length) * 0.3; }); } catch { /* pas de texte pour ce rush : l'IA fera sans */ }
        }
      }
      if (!etatRendu().ok) { noter('outil', 'Installe le moteur de rendu (une seule fois)'); await installerRendu((p) => { c.progression = p * 0.3; }); siArrete(); }
      noter('film', P.d.medias.length ? (P.d.montage.length ? `Prépare ton montage pour ${nomIA}` : `Prépare tes rushes pour ${nomIA} (sans découpe)`) : `Prépare le dossier de travail de ${nomIA}`);
      // pourIA : toujours le kit, jamais de zip ni de copie des rushes complets, quoi que disent les réglages d'export
      const pack = await exporterPack(P, (p) => { c.progression = 0.3 + p * 0.7; }, {pourIA: true});
      if (c.annule) { fs.rmSync(pack.dossier, {recursive: true, force: true}); throw new Error('Arrêté.'); }
      atelier = pack.dossier;
      c.atelier = atelier;
      const lien = path.join(atelier, 'remotion', 'node_modules');
      if (!fs.existsSync(lien) && !lier(path.join(dossierMoteurRendu(), 'node_modules'), lien)) throw new Error('Impossible de relier le moteur de rendu au dossier de travail.');
      e.atelier = path.relative(P.racine, atelier);
      e.empreinte = empreinte(P);
      // la vidéo du projet que porte ce dossier (lib/sequences.mjs)
      e.sequence = P.d.sequence ?? null;
      e.sequence_nom = P.d.sequences?.find((x) => x.id === P.d.sequence)?.nom ?? null;
      // pour qui ce dossier a été préparé, et à partir de quel échange (voir espaceChange et « historique »)
      e.espace = espace?.id ?? 'moi';
      if (autreEspace) e.espace_depuis = n;
      e.sessions = {};
      session = null;
      ecrireEtat(P, e);
    }
    siArrete();
    // 2. les pièces jointes : prêtes (aperçus, planches, texte, zip ouverts), puis installées dans contexte/
    // (« Arrêter » pendant cette préparation : revérifié après chaque attente, pour que l'IA ne soit jamais lancée ensuite)
    if (listerPieces(P).some((x) => x.en_preparation)) { noter('trombone', `Prépare tes pièces jointes pour ${nomIA}`); await attendrePieces(P); siArrete(); }
    const {lignes, cibles: piecesLiees} = installerContexte(P, atelier, {echanges: e.echanges, creations: listerCreations(P).filter((x) => x.etat === 'pret'), message: n});
    // pour qui est ce projet : son espace (métier, marque, logo) et ce qui y marche ; un épisode reçoit sa série
    try { installerEspace(atelier, espace); installerRecette(atelier, espace); } catch { /* sans contexte d'espace */ }
    let serie = null;
    try { serie = installerSerie(atelier, P); } catch { /* sans série */ }
    // la voix off proposée (lib/voix-off.mjs) : l'avis de Dérush (d'après ce message aussi : « un vlog du vendredi »),
    // les questions, les réponses et le choix de l'humain, reposés à chaque demande dans contexte/voix-off.md (une
    // conversation reprise reçoit donc les réponses du jour). Rien pour une publication.
    let voixOff = null;
    if (!pub) try { voixOff = installerVoixOff(atelier, P, {avis: avisVoixOff(P, {demande: texte})}); } catch { /* sans voix off */ }
    // le profil du créateur (ce que l'IA a appris de ses comptes) : seulement pour un projet à « Moi » (jamais chez un
    // client), s'il existe et s'il veut bien le donner ; un dossier repris perd celui d'une demande précédente
    const profilDonne = espace?.type === 'moi' ? installerProfil(atelier) : (fs.rmSync(path.join(atelier, 'contexte', 'createur'), {recursive: true, force: true}), false);
    // le Drive synchronisé, lié dans le dossier (rien n'est copié) ; le connecteur est passé à Claude plus bas
    installerDrive(atelier);
    // les vrais sons (bibliothèque reliée dans sons/, commandes, index de Real SFX) : avant les compétences, car le
    // guide d'Earshot peut arriver à ce moment-là
    const sons = await installerSons(atelier, noter);
    siArrete();
    // la bibliothèque de compétences, reliée pour les deux assistants
    installerCompetences(atelier);
    // la vidéo à publier, reliée dans a-publier/
    if (pub) {
      const A = path.join(atelier, 'a-publier');
      fs.mkdirSync(A, {recursive: true});
      if (!lier(path.join(P.racine, 'vidéos', pub.nom), path.join(A, pub.nom))) fs.copyFileSync(path.join(P.racine, 'vidéos', pub.nom), path.join(A, pub.nom));
    }
    // le rendu en direct du travail précédent n'a plus lieu d'être ; les publications non plus
    fs.rmSync(path.join(atelier, 'rendu', '.direct'), {recursive: true, force: true});
    // les outils du kit sont ceux de cette version de Dérush : le rendu en direct, et le relais de rendu (Codex, Gemini)
    try {
      const kit = path.join(RACINE_APP, 'modeles', 'kit-remotion');
      fs.copyFileSync(path.join(kit, 'rendre.mjs'), path.join(atelier, 'remotion', 'rendre.mjs'));
      // recouper.mjs aussi, toujours : un dossier repris gardait l'ancien, qui effaçait la voix off et les retouches de
      // l'IA ; le nouveau lit les mêmes fichiers (montage.origine.json, mots.origine.json, transcriptions/)
      fs.copyFileSync(path.join(kit, 'recouper.mjs'), path.join(atelier, 'remotion', 'recouper.mjs'));
      if (!fs.existsSync(path.join(atelier, 'remotion', 'images.mjs'))) fs.copyFileSync(path.join(kit, 'images.mjs'), path.join(atelier, 'remotion', 'images.mjs'));
      // les pièces du kit (src/pieces) : ajoutées à un pack plus ancien, jamais par-dessus celles que l'IA a changées
      if (!fs.existsSync(path.join(atelier, 'remotion', 'src', 'pieces'))) fs.cpSync(path.join(kit, 'src', 'pieces'), path.join(atelier, 'remotion', 'src', 'pieces'), {recursive: true});
    } catch { /* le kit d'origine reste utilisable */ }
    c.etape = 'claude';
    c.progression = 1;
    // 3. l'IA, dans ce dossier
    const pj = lignes.length ? `\n\nPièces jointes à ce message (détails dans contexte/INDEX.md) :\n${lignes.join('\n')}` : '';
    // Blender, s'il est là : son dossier passe en tête du PATH (la commande « blender » mène alors au vrai programme)
    const blender = await etatBlender();
    siArrete();
    // une conversation reprise ne relit pas ses consignes de départ : on lui redit où en sont les connexions
    const rappel = `(Connexions en ce moment : ElevenLabs ${chargerCle() ? 'branché' : 'pas branché'} ; Treg ${rappelTreg(moteur)} ; Google Drive ${etatDrive().actif ? 'donné' : 'pas donné'} ; Blender ${blender.ok ? 'installé' : 'absent'} ; vrais sons ${rappelSons()} ; ${espace?.type === 'client' ? `ce projet est pour ${espace.nom}, un client : contexte/espace/ESPACE.md (sa marque), et rien de mon univers à moi` : espace?.type === 'neutre' ? 'ce projet n’est rattaché à personne : aucun profil' : `mon profil de créateur ${profilDonne ? 'est dans contexte/createur/ (lis-le)' : 'n’est pas donné'}`}${serie ? ` ; épisode de la série « ${serie.nom} » : contexte/serie/SERIE.md` : ''}${rappelVoixOff(voixOff) ? ` ; ${rappelVoixOff(voixOff)}` : ''}${rappelVideos(P, e)}. Si tu me réponds en français, tutoie-moi, comme Dérush.)${MODES[mode].consigne ? `\n(${MODES[mode].consigne})` : ''}`;
    const reprise = !!session; // une conversation déjà commencée avec cette IA
    const ecrireDemande = (suivie) => (suivie
      ? `${texte}${pj}\n\n(Si je te demande une vidéo ou une modification : refais-la, livre-la comme d'habitude, remets rendu/timeline.json à jour, vérifie-la, puis dis-moi en quelques phrases ce que tu as changé, sans chemin ni nom de fichier. Si c'est une question, réponds simplement.)\n${rappel}`
      : `Voici un pack de montage Dérush${garderAtelier ? ' (un autre assistant y a déjà travaillé : ses compositions et ses rendus sont dans remotion/ et rendu/, pars de là)' : ''}. Lis CLAUDE.md, puis LISEZMOI-IA.md et montage.json, regarde le storyboard, et lis contexte/INDEX.md (ce que je t'ai donné).\n\nCe que je veux :\n« ${texte} »${pj}${historique.length ? `\n\nNotre conversation jusqu'ici (ce que j'ai demandé reste valable sauf si ma nouvelle demande dit le contraire) :\n${historique.join('\n')}` : ''}\n\nSi je te demande une ou plusieurs vidéos : monte-les, livre-les (rendu/final.mp4, ou rendu/livraison/ s'il y en a plusieurs), vérifie-les, puis dis-moi en quelques phrases ce que tu as fait, sans chemin ni nom de fichier (je regarde les vidéos dans Dérush). Si c'est une question, réponds simplement.`);
    // ce que l'humain a écrit pendant la préparation part avec la demande
    const ajouts = c.enAttente.splice(0).map((x) => x.texte);
    for (const x of c.messages) x.lu = true;
    const complement = (ajouts.length ? `\n\nAjouté pendant que Dérush préparait ton dossier :\n${ajouts.map((t) => `- ${t}`).join('\n')}` : '') + rappelMaj();
    let demande = ecrireDemande(reprise) + complement;
    const env = {...envIA([DOSSIER_COMMANDES, ...(fs.existsSync(PYTHON) ? [path.dirname(PYTHON)] : []), ...(blender.ok ? [path.dirname(blender.chemin)] : [])]), ...envSons()};
    // Treg coupé dans Connexions (« Donner Treg à l'IA ») : ni ses outils (lib/drive.mjs, lib/treg.mjs), ni sa clé dans
    // l'environnement (Claude a un terminal : la clé y suffirait pour publier), ni l'envoi sur YouTube par la commande
    // ou par le relais. Gemini n'a jamais la clé : c'est Dérush qui la garde.
    const tregDonne = etatTreg(moteur).actif;
    if (!tregDonne || moteur === 'gemini') delete env.TREG_TOKEN;
    // YouTube : ce que l'humain a demandé dans CE message (la fenêtre « Partager », ou ses propres mots : un verbe d'envoi
    // près de « YouTube », sans négation), pour la commande derush-youtube et pour le relais de Codex et de Gemini : rien
    // ne part sans cela, jamais en public s'il a choisi autre chose, ni s'il n'a pas écrit « public » lui-même
    const parPartage = !!pub?.reseaux?.includes('youtube');
    const parMots = parPartage ? null : youtubeDemande(message);
    const youtube = {permis: tregDonne && (parPartage || !!parMots), visibilite: parPartage ? pub.visibilite : parMots?.visibilite ?? null, coupe: !tregDonne};
    env.DERUSH_YOUTUBE_PERMIS = youtube.permis ? '1' : '0';
    if (youtube.visibilite) env.DERUSH_YOUTUBE_VISIBILITE = youtube.visibilite; else delete env.DERUSH_YOUTUBE_VISIBILITE;
    // les guides du dossier sont remis à jour à chaque demande : Blender ou ElevenLabs ont pu être branchés entre-temps
    try {
      fs.writeFileSync(path.join(atelier, 'OUTILS.md'), boiteAOutils({blender, elevenlabs: chargerCle(), sons: partieSons()}));
      fs.writeFileSync(path.join(atelier, 'MOTION.md'), guideMotion());
      const carnet = apprend(espace) ? texteCarnet(espace.id) : null;
      if (carnet) fs.writeFileSync(path.join(atelier, 'CARNET.md'), carnet); else fs.rmSync(path.join(atelier, 'CARNET.md'), {force: true});
      fs.rmSync(path.join(atelier, FICHIER_IA), {force: true});
    } catch { /* dossier en lecture seule : l'IA garde les guides d'origine */ }
    const recit = pub ? '' : consigneRecit(voixOff, mode);
    const consignes = `${CONSIGNES(moteur, espace)}\n${consigneEspace(espace)}${serie ? `\n${consigneSerie(serie)}` : ''}${consigneVoixOff(voixOff) ? `\n${consigneVoixOff(voixOff)}` : ''}${recit ? `\n${recit}` : ''}\n${blender.ok
      ? `- Blender ${blender.version} est installé ici : ${blender.chemin}. Pour de la 3D réaliste, lance-le sans interface : "${blender.chemin}" -b --factory-startup --python scene.py. La marche à suivre et les pièges sont dans OUTILS.md, partie « La 3D avec Blender ».`
      : '- Blender n’est pas installé sur cet ordinateur : pour la 3D, utilise three.js avec @remotion/three, déjà dans le kit.'}\n${consigneElevenLabs(sons.actif)}\n${consigneDrive(moteur)}${etatDrive().actif && etatDrive().synchronise ? `\n${CONSIGNE_RUSHES_DU_DRIVE}` : ''}\n${consigneTreg(moteur)}\n${consigneCompetences(moteur)}${sons.actif ? `\n${consigneSons()}` : ''}${profilDonne ? `\n${consigneCreateur()}` : ''}`;
    fs.mkdirSync(path.join(atelier, '.derush'), {recursive: true});
    const fichierConsignes = path.join(atelier, '.derush', 'consignes.md');
    fs.writeFileSync(fichierConsignes, c.placeTexte ? `${consignes}\n- Le disque de l'ordinateur est presque plein. ${c.placeTexte} Garde peu de rendus d'essai, efface au fil de l'eau tes fichiers intermédiaires lourds (extractions d'images, essais), et regarde « df -h . » avant un gros rendu. N'efface jamais rien d'autre que tes propres fichiers.` : consignes);
    if (moteur !== 'claude') {
      // Codex et Gemini lisent AGENTS.md : les consignes de Dérush, puis le guide du dossier
      let guide = '';
      try { guide = fs.readFileSync(path.join(atelier, 'CLAUDE.md'), 'utf8'); } catch { /* pas de guide */ }
      fs.writeFileSync(path.join(atelier, 'AGENTS.md'), `# Consignes de Dérush\n\n${consignes}\n\n${guide ? `# Le guide du dossier (CLAUDE.md, valable pour toi aussi)\n\n${guide}` : ''}`);
    }
    const debutIA = Date.now();
    c.debutIA = debutIA;
    const textes = []; // tout ce que l'IA écrit, pour retrouver son compte rendu
    const noterSession = (s) => { if (s && s !== e.sessions[moteur]) { session = s; e.sessions[moteur] = s; e.moteur = moteur; try { ecrireEtat(P, e); } catch { /* disque plein ou débranché : elle sera écrite à la fin du travail */ } } };
    // une conversation que l'IA ne connaît plus (effacée chez elle après un mois, projet déplacé ou renommé) : elle est
    // oubliée ici aussi, pour ne pas buter dessus à chaque message
    const oublierSession = () => { session = null; delete e.sessions[moteur]; try { ecrireEtat(P, e); } catch { /* elle sera oubliée à la fin du travail */ } demande = ecrireDemande(false) + complement; };
    // une image que l'IA regarde (un rendu, une planche, une référence) : elle passe en direct dans Dérush
    const voir = (f) => c.vues.push({n: c.vues.length, chemin: path.resolve(atelier, f), nom: path.basename(f), t: Math.round((Date.now() - c.debut) / 1000)});
    const brancher = (proc, ok, ko, lire, finir, entree = demande, flux = false) => {
      c.proc = proc;
      garderEveille(proc.pid); // un montage peut durer une heure : l'ordinateur ne doit pas s'endormir en route
      let tampon = '';
      let err = '';
      // Node décode lui-même : un caractère accentué coupé entre deux morceaux (64 ko) attend sa fin au lieu de devenir « �� »
      proc.stdout.setEncoding('utf8');
      proc.stderr.setEncoding('utf8');
      proc.stdout.on('data', (d) => {
        tampon += d;
        let i;
        while ((i = tampon.indexOf('\n')) >= 0) {
          const ligne = tampon.slice(0, i);
          tampon = tampon.slice(i + 1);
          let j;
          try { j = JSON.parse(ligne); } catch { continue; }
          lire(j);
        }
      });
      proc.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
      proc.on('error', (x) => ko(new Error(`${nomIA} n’a pas pu se lancer : ${x.message}`)));
      proc.on('close', (code) => {
        if (c.annule) return ko(new Error('Arrêté.'));
        finir(code, err);
      });
      proc.stdin.on('error', () => { /* l'IA s'est arrêtée avant de lire */ });
      if (!flux) return proc.stdin.end(entree);
      // Claude lit des messages JSON, un par ligne, tant que son entrée reste ouverte : un message écrit pendant son
      // travail lui arrive au geste suivant (il en tient compte sans s'arrêter). L'entrée se ferme quand tout est lu.
      const ecrire = (t) => {
        if (proc.stdin.destroyed || proc.stdin.writableEnded) return false;
        proc.stdin.write(`${JSON.stringify({type: 'user', message: {role: 'user', content: t}})}\n`);
        c.envoyes++;
        return true;
      };
      ecrire.proc = proc; // ce lien sert à ne jamais confondre avec l'entrée d'un Claude relancé
      c.ecrire = ecrire;
      ecrire(entree);
    };

    let fin = null;
    if (moteur === 'claude') {
      // Claude ne doit voir que les connecteurs donnés (Drive, Treg) : s'il démarre avec un autre, on l'arrête tout de
      // suite (avant qu'il ait rien fait), on ajoute ce connecteur aux refusés, et on le relance
      const lancerClaude = () => new Promise((ok, ko) => {
        if (c.annule) return ko(new Error('Arrêté.')); // arrêté pendant la préparation (ou entre deux lancements) : Claude ne part pas
        const dejaRefuses = new Set(refuses());
        const args = ['-p', '--model', reglage.modele, '--effort', reglage.effort, '--input-format', 'stream-json', '--output-format', 'stream-json', '--replay-user-messages', '--verbose',
          '--permission-mode', 'auto', '--permission-prompts', 'none', ...argsConnecteursClaude(atelier),
          '--append-system-prompt-file', fichierConsignes, ...(session ? ['--resume', session] : []),
          '--tools', 'Bash', 'Edit', 'Read', 'Write', 'Skill', 'WebSearch', 'WebFetch'];
        const {cmd, prefixe} = commandeLancement(ia.chemin);
        const l = preparerLancement(cmd, [...prefixe, ...args], {cwd: atelier, env, stdio: ['pipe', 'pipe', 'pipe'], detached: !WINDOWS, windowsHide: true});
        const proc = spawn(l.cmd, l.args, l.options);
        c.envoyes = 0;
        c.rejoues = 0;
        let relancer = false;
        let resultat = null;
        const aVoir = new Map(); // les images que Claude demande à lire (par geste) : montrées une fois la lecture réussie
        brancher(proc, ok, ko, (j) => {
          if (relancer) return;
          if (j.type === 'system' && j.subtype === 'init') {
            // un connecteur déjà refusé dont les outils sont de toute façon interdits ne relance pas Claude
            const autres = intrus(j.mcp_servers).filter((x) => !dejaRefuses.has(x));
            if (autres.length) { relancer = true; refuser(autres); arreterArbre(proc); return; }
            // la conversation est notée tout de suite : même arrêtée en route, elle pourra être reprise
            noterSession(j.session_id);
            const statut = (s) => (['connected', 'pending'].includes(s.status) ? 'connecte' : /auth/i.test(s.status) ? 'a_autoriser' : 'echec');
            const drive = (j.mcp_servers ?? []).find((s) => s.name === NOM_CONNECTEUR);
            if (drive) {
              noterConnecteur(statut(drive));
              noter(statut(drive) === 'connecte' ? 'nuage' : 'attention', statut(drive) === 'connecte' ? 'Ton Google Drive est branché' : 'Google Drive pas disponible cette fois (connecteur à autoriser dans l’app Claude)');
            }
            const treg = (j.mcp_servers ?? []).find((s) => NOMS_TREG.includes(s.name));
            if (treg) noterConnecteurTreg(statut(treg));
          }
          if (j.type === 'assistant') {
            for (const b of j.message?.content ?? []) {
              if (b.type === 'tool_use') {
                const x = decrire(b.name, b.input ?? {}, atelier);
                noter(x.icone, x.texte);
                // une image que Claude regarde : montrée quand sa lecture a réussi (une lecture refusée ne montre rien)
                const f = b.name === 'Read' ? String(b.input?.file_path ?? '') : '';
                if (/\.(png|jpe?g|webp|gif)$/i.test(f)) { if (b.id) aVoir.set(b.id, f); else voir(f); }
              }
              if (b.type === 'text' && b.text?.trim()) { noter('bulle', b.text.trim().slice(0, 600)); textes.push(b.text.trim()); }
            }
          }
          // le résultat d'une lecture d'image : réussie, l'image passe en direct
          if (j.type === 'user' && Array.isArray(j.message?.content)) {
            for (const b of j.message.content) {
              if (b.type !== 'tool_result' || !aVoir.has(b.tool_use_id)) continue;
              if (!b.is_error) voir(aVoir.get(b.tool_use_id));
              aVoir.delete(b.tool_use_id);
            }
          }
          // un message de l'humain que Claude vient de prendre (le premier est la demande elle-même)
          if (j.type === 'user' && !(Array.isArray(j.message?.content) && j.message.content.some((b) => b.type === 'tool_result'))) {
            // un message relu : la demande (la première fois), ou un message de l'humain écrit en route. Une compétence
            // chargée arrive aussi comme un message : elle ne compte pas.
            const t = typeof j.message?.content === 'string' ? j.message.content : (j.message?.content ?? []).map((b) => b.text ?? '').join('');
            const m = c.messages.find((x) => x.envoye && !x.lu && t.includes(x.texte));
            if (m) {
              c.rejoues++;
              m.lu = true;
              noter('bulle', `${nomIA} lit ton message : « ${m.texte.slice(0, 80)}${m.texte.length > 80 ? '…' : ''} »`);
            } else if (c.rejoues === 0) c.rejoues++;
          }
          if (j.type === 'result') {
            resultat = j;
            clearTimeout(c.gardeEntree);
            clearTimeout(c.gardeFin);
            // tout est lu : l'entrée se ferme et Claude s'arrête. Un message arrivé juste à la fin ouvre un tour de plus.
            if (c.rejoues >= c.envoyes) {
              proc.stdin.end();
              // Claude Code attend ses tâches de fond avant de quitter (une recherche dans tout le disque, un rendu
              // oublié…) : sa réponse est là, on ne le laisse pas faire attendre l'humain plus de 20 secondes
              c.gardeFin = setTimeout(() => { if (proc.exitCode == null) { noter('outil', 'Dérush arrête une tâche de fond restée ouverte'); arreterArbre(proc); } }, 20000);
            } else c.gardeEntree = setTimeout(() => { try { proc.stdin.end(); } catch { /* déjà fermée */ } }, 60000);
          }
        }, (code, err) => {
          clearTimeout(c.gardeEntree);
          clearTimeout(c.gardeFin);
          if (c.ecrire?.proc === proc) c.ecrire = null;
          if (relancer) return ok(null);
          // la conversation à reprendre n'existe plus chez Claude : il repart une fois sans elle, avec le résumé des échanges
          if (!resultat && session && SESSION_PERDUE.test(err)) {
            noter('attention', 'La conversation d’avant n’existe plus chez Claude : il repart du dossier de travail, avec le résumé de nos échanges');
            oublierSession();
            return ok(null);
          }
          if (!resultat) return ko(new Error(`Claude Code s’est arrêté sans répondre${err.trim() ? ` : ${err.trim().split('\n').slice(-3).join(' ')}` : ` (code ${code})`}.`));
          ok(resultat);
        }, demande, true);
        // ce que l'humain a écrit pendant que Claude démarrait (ou envoyé à un Claude arrêté pour être relancé) : envoyé
        // tout de suite après la demande
        for (const m of c.messages.filter((x) => !x.lu)) { m.envoye = !!c.ecrire?.(enveloppe(m.texte)); }
        c.enAttente = c.enAttente.filter((x) => !x.envoye);
      });
      for (let essai = 1; !fin; essai++) {
        fin = await lancerClaude();
        if (!fin && essai >= 4) throw new Error('Claude n’a pas pu démarrer avec tes seules connexions Dérush. Coupe le Drive ou Treg dans Connexions, puis réessaie.');
      }
    } else if (moteur === 'codex') {
      // Codex : toujours dans son bac à sable (écriture dans le dossier de travail, le dossier temporaire et le dossier
      // Dérush du Drive ; réseau ouvert pour ElevenLabs et Treg). Le rendu Remotion passe par le relais de Dérush.
      const ecrits = [os.tmpdir(), ...ecritsSons()];
      c.relais = await ouvrirRelais(atelier, {surRendu: (compo) => noter('film', `Dérush rend « ${compo} » pour Codex`),
        youtube: {...youtube, videos: path.join(P.racine, 'vidéos'), surEnvoi: () => noter('globe', 'Dérush envoie la vidéo sur YouTube')}});
      env.DERUSH_RELAIS = c.relais.url;
      env.DERUSH_RELAIS_JETON = c.relais.jeton;
      const d = etatDrive().actif ? dossiersDrive() : null;
      if (d) { const dd = path.join(d.monDrive, 'Dérush'); try { fs.mkdirSync(dd, {recursive: true}); ecrits.push(dd); } catch { /* Drive en lecture seule */ } }
      fin = await new Promise((ok, ko) => {
        if (c.annule) return ko(new Error('Arrêté.')); // arrêté pendant la préparation : Codex ne part pas (le relais se ferme plus bas)
        const args = argsCodex({session, reglage, ecrits, mcp: argsCodexTreg()});
        const {cmd, prefixe} = commandeLancement(ia.chemin);
        const l = preparerLancement(cmd, [...prefixe, ...args], {cwd: atelier, env, stdio: ['pipe', 'pipe', 'pipe'], detached: !WINDOWS, windowsHide: true});
        const proc = spawn(l.cmd, l.args, l.options);
        let termine = false;
        let erreur = null;
        let alerte = null;
        brancher(proc, ok, ko, (j) => {
          const x = lireEvenementCodex(j);
          if (x.session) noterSession(x.session);
          if (x.geste) { const g = decrire(x.geste.outil, x.geste.entree, atelier); noter(g.icone, g.texte); }
          if (x.texte) { noter('bulle', x.texte.slice(0, 600)); textes.push(x.texte); }
          if (x.alerte) { alerte = x.alerte; if (!/reconnect|retry|stream/i.test(x.alerte)) noter('attention', x.alerte.slice(0, 200)); }
          if (x.erreur) erreur = x.erreur;
          if (x.fin) termine = true;
        }, (code, err) => {
          if (!termine) {
            const dit = String(erreur ?? alerte ?? (err.trim() ? err.trim().split('\n').slice(-3).join(' ') : `code ${code}`));
            if (session && SESSION_PERDUE.test(dit)) { oublierSession(); return ko(new Error(PERDUE('Codex'))); }
            return ko(new Error(`Codex s’est arrêté avant la fin : ${dit}`));
          }
          ok({result: textes.at(-1) ?? '', is_error: !!erreur});
        });
      }).finally(() => { c.relais?.fermer(); c.relais = null; });
    } else {
      // Gemini (la commande agy) : toujours dans le bac à sable de son terminal, avec des permissions données pour cette
      // seule demande (lib/gemini.mjs) : écrire dans le dossier de travail (et la bibliothèque de sons), lire les outils
      // de Dérush et ce que l'humain a donné, rien d'autre de l'ordinateur. Ce bac à sable coupe le réseau local : le
      // rendu et l'envoi sur YouTube passent par la boîte du relais (des fichiers du dossier de travail). La clé Treg
      // ne lui est pas donnée : c'est Dérush qui la garde.
      const ecrits = [atelier, os.tmpdir(), ...ecritsSons()];
      // les rushes de l'humain : clonés dans le dossier de travail, sauf un très gros rush d'un autre disque, posé en lien
      // (le bac à sable doit alors pouvoir lire le fichier d'origine)
      const lus = [...outilsLisibles([...(blender.ok ? [blender.chemin] : []), ...lusSons()]), ...piecesLiees, ...P.d.medias.map((m) => m.chemin).filter((f) => fs.existsSync(f)), ...(pub ? [path.join(P.racine, 'vidéos', pub.nom)] : [])];
      const d = etatDrive().actif ? dossiersDrive() : null;
      if (d) {
        // le Drive que l'humain a donné : à lire en entier, à écrire seulement dans son dossier « Dérush »
        lus.push(d.monDrive, ...(d.partages ? [d.partages] : []));
        const dd = path.join(d.monDrive, 'Dérush');
        try { fs.mkdirSync(dd, {recursive: true}); ecrits.push(dd); } catch { /* Drive en lecture seule */ }
      }
      const reglages = reglagesGemini({ecrits, lus});
      // ce que ce bac à sable a le droit de lire (sous son nom et sous son vrai chemin) : le relais, qui rend hors du bac
      // à sable, refuse un lien de remotion/ qui mène ailleurs, et une image que Gemini n'a pas pu lire n'est pas montrée
      const lisibles = [...new Set([...ecrits, ...lus].flatMap((d) => { try { return [path.resolve(d), fs.realpathSync(d)]; } catch { return [path.resolve(d)]; } }))];
      const lisible = (fichier) => { let r = path.resolve(fichier); try { r = fs.realpathSync(r); } catch { /* absent : jugé sur son nom */ } return lisibles.some((d) => r === d || (!path.relative(d, r).startsWith('..') && !path.isAbsolute(path.relative(d, r)))); };
      c.relais = await ouvrirRelais(atelier, {boite: true, lisibles, surRendu: (compo) => noter('film', `Dérush rend « ${compo} » pour Gemini`),
        youtube: {...youtube, videos: path.join(P.racine, 'vidéos'), surEnvoi: () => noter('globe', 'Dérush envoie la vidéo sur YouTube')}});
      if (c.relais.boite) env.DERUSH_RELAIS_BOITE = c.relais.boite; else env.DERUSH_RELAIS = c.relais.url;
      env.DERUSH_RELAIS_JETON = c.relais.jeton;
      Object.assign(env, envGemini(env));
      fin = await new Promise((ok, ko) => {
        if (c.annule) return ko(new Error('Arrêté.')); // arrêté pendant la préparation : Gemini ne part pas (le relais se ferme plus bas)
        const args = argsGemini({demande, session, modele: reglage.modele, reglages});
        const {cmd, prefixe} = commandeLancement(ia.chemin);
        const l = preparerLancement(cmd, [...prefixe, ...args], {cwd: atelier, env, stdio: ['pipe', 'pipe', 'pipe'], detached: !WINDOWS, windowsHide: true});
        const proc = spawn(l.cmd, l.args, l.options);
        const lire = lecteurGemini();
        let resultat = null;
        brancher(proc, ok, ko, (j) => {
          const x = lire(j);
          if (x.session) noterSession(x.session);
          if (x.geste) {
            const g = decrire(x.geste.outil, x.geste.entree, atelier);
            noter(g.icone, g.texte);
            // une image que son bac à sable ne le laisse pas lire n'est pas montrée (il ne l'a pas vue)
            const f = x.geste.outil === 'Read' ? String(x.geste.entree?.file_path ?? '') : '';
            if (/\.(png|jpe?g|webp|gif)$/i.test(f) && lisible(path.resolve(atelier, f))) voir(f);
          }
          if (x.refus) noter('attention', `Gemini n’a pas eu le droit de ${refusGemini(x.refus)}`);
          if (x.texte) { noter('bulle', x.texte.slice(0, 600)); textes.push(x.texte); }
          if (x.fin) resultat = x.fin;
        }, (code, err) => {
          if (!resultat && session && SESSION_PERDUE.test(err)) { oublierSession(); return ko(new Error(PERDUE('Gemini'))); }
          if (!resultat) return ko(new Error(/authentication required/i.test(err) ? 'Gemini n’est plus connecté à ton compte Google. Ouvre Connexions, puis « Me connecter ».' : `Gemini s’est arrêté avant la fin : ${err.trim() ? err.trim().split('\n').slice(-3).join(' ').slice(0, 400) : `code ${code}`}`));
          // rien n'a été dit et une action a été refusée : agy s'arrête là, sans réponse
          if (!resultat.reponse && !textes.length && resultat.refus?.length) return ko(new Error(`Gemini s’est arrêté : il n’a pas eu le droit de ${resultat.refus.map(refusGemini).join(', ')}.`));
          ok({result: resultat.reponse || textes.at(-1) || '', is_error: !!resultat.erreur});
        }, '');
      }).finally(() => { c.relais?.fermer(); c.relais = null; });
    }
    // 4. les vidéos livrées (une, ou plusieurs dans rendu/livraison/), et ce qui a été publié
    c.etape = 'livraison';
    const livrees = livraisons(atelier, debutIA);
    // la table de montage de l'IA, rangée avec la version (le n° de la vidéo remplace le nom de son fichier). Dans une
    // conversation reprise, une IA qui n'a pas touché à ses blocs ne réécrit pas toujours sa table : celle qu'elle
    // avait écrite vaut encore pour la nouvelle vidéo (sinon les blocs disparaîtraient de la timeline après un réglage).
    const table = tableIA(atelier, debutIA) ?? (reprise && livrees.length ? tableIA(atelier, 0) : null);
    if (table) for (const b of table.blocs) { const k = b.video ? livrees.findIndex((l) => path.basename(l.fichier) === b.video) : -1; b.video = k >= 0 ? k : null; }
    const publiees = publications(atelier, debutIA);
    const credits = creditsSons(atelier, debutIA);
    // le carnet du monteur : ce que l'IA a appris, gardé pour le projet suivant
    const lecons = recueillirCarnet(atelier, debutIA, {espace: espace?.id ?? 'moi', projet: P.d.titre ?? null, ia: moteur, modele: reglage.modele ?? null, source: reprise && e.versions.length ? 'correction' : 'ia'});
    if (lecons.length) noter('texte', `${nomIA} note ${lecons.length} leçon${lecons.length > 1 ? 's' : ''} dans le carnet du monteur`);
    // la voix off : le texte à lire et les questions que l'IA a écrits (voix-off/ de son dossier), rangés dans le projet ;
    // l'interface les montre et allume le bouton du micro
    try {
      const vo = recueillirVoixOff(atelier, P, debutIA);
      if (vo.texte) noter('texte', `${nomIA} a écrit le texte de ta voix off`);
      if (vo.questions) noter('texte', `${nomIA} te pose ${vo.questions} question${vo.questions > 1 ? 's' : ''} pour ta voix off`);
    } catch { /* la vidéo reste livrée */ }
    const quand = new Date().toISOString();
    e.sessions[moteur] = session;
    e.moteur = moteur;
    e.modele = reglage.modele;
    e.effort = reglage.effort;
    e.decoupe_reprise = false; // l'IA a peut-être recoupé : sa découpe peut de nouveau être reprise
    // Claude Code reprend parfois la parole après son compte rendu (une tâche de fond qui se termine) : sa dernière
    // phrase est alors un détail, et le vrai compte rendu est juste avant. On garde les deux.
    const dernier = String(fin.result ?? '').trim();
    const compteRendu = dernier.length < 400 ? textes.slice(-4).reverse().find((x) => x.length >= 400 && x !== dernier) : null;
    const reponse = {role: 'claude', moteur, texte: (compteRendu ? `${compteRendu}\n\n${dernier}` : dernier) || `(${nomIA} n’a rien écrit.)`, quand, qualite: reglage.qualite, modele: reglage.modele, effort: reglage.effort,
      duree_s: Math.round((Date.now() - c.debut) / 1000), erreur: fin.is_error === true, refus: fin.permission_denials?.length ?? 0, ...(publiees.length ? {publications: publiees} : {}), ...(credits ? {credits_sons: credits} : {})};
    if (livrees.length) {
      const nv = (e.versions.at(-1)?.n ?? 0) + 1;
      const dossier = path.join(P.racine, 'vidéos');
      fs.mkdirSync(dossier, {recursive: true});
      const videos = [];
      const mesures = [];
      const rythmes = new Map(); // empreinte du son → rythme déjà jugé (plusieurs formats d'un même montage : une seule écoute)
      for (const [k, l] of livrees.entries()) {
        const m = {};
        mesures.push(m);
        noter('oeil', livrees.length > 1 ? `Dérush contrôle la vidéo ${k + 1} sur ${livrees.length}` : 'Dérush contrôle la vidéo');
        const suffixe = livrees.length > 1 ? `-${k + 1}${l.titre ? `-${slug(l.titre, 24)}` : ''}` : '';
        const nom = `${slug(P.d.titre) || 'montage'}-${moteur}-v${nv}${suffixe}.mp4`;
        const video = path.join(dossier, nom);
        await rangerFichier(l.fichier, video);
        let controles = [];
        let info = null;
        let reseau = null;
        let son = null;
        try { ({controles, info, reseau, son} = await controlerVideo(P, video, null)); } catch { /* la vidéo reste livrée, sans contrôles */ }
        if (son?.apres?.i != null && son.apres.i > -60) m.lufs = son.apres.i;
        // les textes à l'écran (sur le Mac) : des mots collés, un texte coupé au bord ou caché par le réseau
        if (info) {
          noter('oeil', 'Dérush lit les textes à l’écran, écoute la voix et le rythme');
          // Whisper réécoute la vidéo finie : jusqu'à 5 minutes (au-delà, la livraison attendrait trop ; l'IA a
          // derush-controle), et une seule fois pour les vidéos qui ont la même piste son (plusieurs formats)
          const cleSon = info.son && info.duree <= 300 ? await empreinteSon(video) : null;
          // le rythme (Whisper) et la voix (FFmpeg) pendant la lecture des textes (Apple Vision) : ils ne se gênent pas
          const [rt, ry, b] = await Promise.all([
            controlerTextes(video, {pack: atelier, plateforme: reseau, ips: info.duree > 600 ? 1 : info.duree > 180 ? 2 : 3}).catch(() => null),
            info.duree > 300 ? null : cleSon && rythmes.has(cleSon) ? rythmes.get(cleSon) : controlerRythme(video, {langue: P.d.langue || 'fr'}).catch(() => null),
            brillance(video, {duree: info.duree}),
          ]);
          if (cleSon && ry) rythmes.set(cleSon, ry);
          const extrait = (l) => l.slice(0, 3).join(' · ') + (l.length > 3 ? ' …' : '');
          if (rt?.ok) {
            const autres = rt.phrases.slice(rt.problemes.length).filter((x) => !x.startsWith('Accroche discrète'));
            controles.push(rt.problemes.length
              ? {ok: false, t: `Textes à l’écran : ${rt.problemes.length} à corriger`, d: extrait(rt.phrases.slice(0, rt.problemes.length))}
              : {ok: true, t: 'Textes à l’écran : aucun mot collé ni coupé', d: autres.length ? `À regarder : ${extrait(autres)}` : null});
            // l'accroche : un grand texte dans les deux premières secondes
            const a = rt.accroche;
            m.accroche = a ?? null;
            if (a) controles.push(a.ok
              ? {ok: true, t: `Accroche : « ${a.texte} » en grand (${String(a.hauteur_pct).replace('.', ',')} % de la hauteur)`, d: null}
              : {ok: false, t: 'Accroche discrète', d: a.detail});
          }
          // la voix : assez d'aigus pour qu'on la comprenne sans effort
          m.brillance_db = b;
          if (ry?.ok) m.rythme = ry;
          if (b != null && info.son) controles.push(avisBrillance(b) ? {ok: false, t: `Voix : aigus ${String(b).replace('.', ',')} dB`, d: avisBrillance(b)} : {ok: true, t: `Voix : nette (aigus ${String(b).replace('.', ',')} dB)`, d: null});
          // le rythme de la parole : pauses qui traînent, « euh », redites
          if (ry?.ok && ry.mots >= 8) controles.push(ry.attention.length
            ? {ok: false, t: `Rythme : ${ry.attention.length} point${ry.attention.length > 1 ? 's' : ''} à regarder`, d: extrait(ry.attention)}
            : {ok: true, t: 'Rythme : ni pause qui traîne, ni « euh », ni redite', d: ry.debit_mots_min ? `${ry.debit_mots_min} mots par minute.` : null});
        }
        // un autre format que celui du projet : c'est voulu (plusieurs formats, ou un format demandé)
        if (info && (info.largeur !== P.d.sortie.largeur || info.hauteur !== P.d.sortie.hauteur) && controles[0]) controles[0] = {ok: true, info: true, t: `Format : ${info.largeur} × ${info.hauteur}, ${info.fps} images/s`, d: 'Un autre format que celui du projet.'};
        const vignettes = await vignettesVideo(video, info, path.join(dossier, `${nom.replace(/\.mp4$/, '')}.vignettes.jpg`));
        // les passages de cette vidéo (lib/sequences.mjs), lus maintenant que le dossier de travail est le sien : de quoi
        // la mettre plus tard dans la timeline, plan par plan. Ceux de livraison.json, sinon (une seule vidéo) la
        // découpe de recouper.mjs.
        let coupes = [];
        try { coupes = coupesLivrees(atelier, l.coupes, P); if (!coupes.length && livrees.length === 1) coupes = decoupeDuDossier(atelier, P); } catch { coupes = []; }
        videos.push({nom, titre: l.titre ?? (livrees.length > 1 ? `Vidéo ${k + 1}` : null), description: l.description, taille_lisible: tailleLisible(fs.statSync(video).size), duree: info?.duree ?? null, largeur: info?.largeur ?? null, hauteur: info?.hauteur ?? null, fps: info?.fps ?? null, controles, vignettes,
          ...(coupes.length ? {coupes} : {})});
      }
      // les autres fichiers remis avec la vidéo : rangés à côté d'elle
      const nAnnexes = await rangerAnnexes(atelier, debutIA, path.join(dossier, dossierAnnexes(videos[0].nom) ?? `${slug(P.d.titre) || 'montage'}-${moteur}-v${nv}-annexes`));
      if (nAnnexes) noter('trombone', `Dérush range ${nAnnexes} fichier${nAnnexes > 1 ? 's' : ''} joint${nAnnexes > 1 ? 's' : ''} à la vidéo`);
      e.versions.push({n: nv, cree_le: quand, moteur, qualite: reglage.qualite, modele: reglage.modele, effort: reglage.effort, ...videos[0], titre: undefined, coupes: undefined, videos, ...(table ? {table} : {}),
        atelier: path.relative(P.racine, atelier)});
      reponse.version = nv;
      // la fiche de chaque vidéo (son « ADN »), dans le projet et dans son espace : la matière de l'apprentissage
      for (const [k, v] of videos.entries()) {
        try {
          const tableVideo = table ? {...table, blocs: table.blocs.filter((b) => b.video == null || b.video === k)} : null;
          enregistrerFiche(P, creerFiche({P, espace, version: e.versions.at(-1), video: {...v, vignettes: path.join(dossier, `${v.nom.replace(/\.mp4$/, '')}.vignettes.jpg`)}, table: tableVideo, mesures: mesures[k], reponse: reponse.texte}), espace);
        } catch { /* la vidéo reste livrée, sans fiche */ }
      }
    }
    // les publications faites par l'IA : rattachées à la fiche de leur vidéo, et suivies (vues relues à J+1, J+7, J+30)
    // Elles se suivent dans l'espace pour lequel la vidéo a été montée (celui de sa fiche), pas dans celui du projet
    // d'aujourd'hui : une vidéo de « Moi » publiée depuis un projet passé chez un client reste chez « Moi », avec son
    // titre et sa légende. Si cet espace n'existe plus (client retiré), rien n'est suivi.
    const nomPublie = publiees.length ? (pub?.nom ?? e.versions.at(-1)?.videos?.[0]?.nom ?? null) : null;
    const espaceVideo = nomPublie ? ficheDe(P, nomPublie)?.espace ?? null : null;
    const suivi = espaceVideo && espaceVideo !== espace?.id ? trouverEspace(espaceVideo) : espace;
    if (publiees.length && apprend(suivi)) {
      for (const p of publiees.filter((x) => x.etat === 'publie' || x.etat === 'brouillon')) {
        try {
          let id = idDepuisLien(p.lien)?.id ?? null;
          if (!id && p.reseau === 'youtube' && nomPublie) {
            const fichier = path.join(P.racine, 'vidéos', nomPublie);
            const envoi = fs.existsSync(fichier) ? dejaEnvoyee({fichier, taille: fs.statSync(fichier).size}) : null;
            id = envoi?.id ?? null;
          }
          const f = nomPublie ? rattacherPublication(P, nomPublie, {reseau: p.reseau, lien: p.lien, id, etat: p.etat, quand}, suivi) : null;
          enregistrerPublication(suivi.id, {reseau: p.reseau, id, lien: p.lien, cle_fiche: f?.cle ?? null, titre: p.titre ?? f?.titre ?? P.d.titre, projet: P.d.titre, legende: p.legende, etat: p.etat, publie_le: quand});
        } catch { /* la publication reste notée dans la conversation */ }
      }
    }
    // les publications sont aussi rangées avec la vidéo publiée, pour les retrouver sous sa carte
    if (publiees.length && pub) {
      for (const v of e.versions) for (const x of videosDe(v)) if (x.nom === pub.nom) x.publications = [...(x.publications ?? []), ...publiees.map((p) => ({...p, quand}))].slice(-20);
      for (const v of e.versions) if (v.nom === pub.nom) v.publications = videosDe(v)[0]?.publications;
    }
    e.echanges.push(reponse);
    ecrireEtat(P, e);
    return reponse;
  })();

  // ——— la fin du travail ———
  const liberer = () => { if (EN_COURS.get(P.racine) === c) EN_COURS.delete(P.racine); }; // jamais l'entrée d'un autre travail
  const prevenir = (err, r) => { try { surFin?.(err, r); } catch (x) { console.error('Dérush : ce qui suit une demande à l’IA a échoué :', x); } };
  /** Écrit dans la conversation la fin d'un travail qui n'a pas abouti ; si le projet ne s'écrit plus, elle reste en mémoire. */
  const noterFin = (fin) => {
    try {
      const x = lireEtat(P);
      x.echanges ??= [];
      x.echanges.push(fin);
      ecrireEtat(P, x);
    } catch (x) {
      // le dossier du projet ne s'écrit plus (disque plein, disque débranché) : Dérush ne doit pas s'arrêter pour autant
      console.error(`Dérush n’a pas pu noter la fin du travail dans le projet : ${x?.message ?? x}`);
      c.finNonEcrite = {...fin, texte: `Dérush n’a pas pu écrire dans le dossier du projet (disque plein, ou débranché ?). ${fin.texte}`};
    }
  };
  travail.then((r) => {
    DERNIERES_VUES.set(P.racine, c);
    occupe(false);
    if (r?.version) noterDuree(c);
    prevenir(null, r);
    // Ce qui n'a pas été lu (Codex et Gemini ne lisent rien en route ; Claude a pu finir juste avant) part à la suite.
    // Le projet reste occupé entre les deux travaux : l'interface continue de suivre (sinon elle annonçait la fin, et le
    // second travail tournait sans rien montrer), et aucune autre demande ne se glisse entre les deux.
    if (c.annule || !c.messages.some((x) => !x.lu)) return liberer();
    Object.assign(c, {etape: 'suite', proc: null, ecrire: null});
    noter('bulle', `${nomIA} reçoit maintenant ce que tu as écrit pendant son travail`);
    setTimeout(async () => {
      try {
        const etatsSuite = await etatIA();
        const restants = c.messages.filter((x) => !x.lu);
        if (c.annule || !restants.length) return liberer();
        await lancerDemande(P, {message: restants.map((x) => x.texte).join('\n\n'), moteur: c.moteur, qualite: c.qualite, file: c.file, dejaAffiche: true}, c.surFin, {de: c, etats: etatsSuite});
      } catch (err) {
        // le message n'a pas pu partir (l'IA n'est plus prête…) : c'est dit dans la conversation, il n'est pas perdu sans un mot
        liberer();
        noterFin({role: 'claude', moteur, texte: `Ton message écrit pendant le travail n’a pas pu partir : renvoie-le. (${String(err?.message ?? err).slice(0, 300)})`, quand: new Date().toISOString(), erreur: true, qualite: reglage.qualite});
      }
    }, 400);
  }, (err) => {
    DERNIERES_VUES.set(P.racine, c);
    liberer();
    occupe(false);
    // l'échec (ou l'arrêt) reste visible dans la conversation, et ce qui a été écrit pendant le travail sans être lu aussi
    const perdu = c.messages.some((x) => !x.lu) ? ' Ce que tu as écrit pendant le travail n’a pas été lu : renvoie-le.' : '';
    noterFin(c.annule
      ? {role: 'claude', moteur, texte: `Arrêté avant la fin. Écris un message pour reprendre, ou pour changer de direction.${perdu}`, quand: new Date().toISOString(), arret: true, qualite: reglage.qualite}
      : {role: 'claude', moteur, texte: `${err?.message ?? String(err)}${perdu}`, quand: new Date().toISOString(), erreur: true, qualite: reglage.qualite});
    prevenir(err, null);
  }).catch((x) => console.error('Dérush : la fin d’un travail de l’IA a échoué :', x)); // rien ici ne doit arrêter Dérush
  return {ok: true, reprise: garderAtelier, moteur};
}

/** Le message de l'humain tel que l'IA le reçoit en plein travail. */
const enveloppe = (t) => `(Message de l’humain pendant ton travail, à prendre en compte maintenant, sans recommencer ce qui est déjà bien.)\n${t}`;
/**
 * Un message écrit pendant que l'IA travaille. Il s'affiche tout de suite dans la conversation. Claude le lit au geste
 * suivant, sans s'arrêter ; Codex et Gemini ne lisent rien en route : il leur est envoyé, tout seul, dès qu'ils ont fini.
 * Pendant la préparation (avant le lancement de l'IA), il rejoint la demande.
 */
export function ajouterMessage(P, message) {
  const c = EN_COURS.get(P.racine);
  if (!c) throw new Error('Ton IA ne travaille pas en ce moment : envoie ton message normalement.');
  const texte = String(message ?? '').trim();
  if (!texte) throw new Error('Écris d’abord ton message.');
  if (texte.length > 4000) throw new Error('Pendant le travail, un message court (4 000 caractères au plus). Pour un long texte, attends la fin ou joins un fichier.');
  if (c.annule) throw new Error('L’IA est en train de s’arrêter.');
  const m = {texte, quand: new Date().toISOString(), lu: false, envoye: false};
  c.messages.push(m);
  c.etat.echanges.push({role: 'humain', texte, quand: m.quand, pendant: true});
  ecrireEtat(P, c.etat);
  if (c.moteur === 'claude' && c.ecrire?.(enveloppe(texte))) m.envoye = true;
  else c.enAttente.push(m);
  // lu en route : par Claude seulement, si son entrée est ouverte (ou pas encore : il le recevra en démarrant). Une fois
  // sa réponse rendue, le message part à la suite, comme pour Codex et Gemini.
  const enRoute = c.moteur === 'claude' && (m.envoye || (!c.ecrire && ['preparation', 'claude'].includes(c.etape)));
  return {ok: true, lu_en_route: enRoute, envoye: m.envoye};
}

/** Arrête le travail en cours (l'IA et tout ce qu'elle a lancé). */
export function arreterDemande(P) {
  const c = EN_COURS.get(P.racine);
  if (!c) return false;
  c.annule = true;
  arreterArbre(c.proc);
  c.relais?.fermer();
  // encore en préparation : le travail s'arrête à la fin de l'étape en cours, et l'IA n'est pas lancée (siArrete)
  return true;
}

/** Dérush se quitte : toutes les IA au travail s'arrêtent, avec ce qu'elles ont lancé. */
export function arreterToutesLesDemandes() {
  for (const c of EN_COURS.values()) {
    c.annule = true;
    try { arreterArbre(c.proc); } catch { /* déjà finie */ }
    try { c.relais?.fermer(); } catch { /* pas de relais */ }
  }
}

/** Efface la conversation (le prochain message repartira du montage actuel). Les vidéos et les pièces jointes restent. */
export function oublierDemande(P) {
  if (EN_COURS.has(P.racine)) throw new Error('L’IA travaille encore.');
  const e = lireEtat(P);
  ecrireEtat(P, {...e, atelier: null, session: null, sessions: {}, echanges: [], espace: null, espace_depuis: 0});
  delete DERNIERES_VUES.get(P.racine)?.finNonEcrite;
}
export {moteurChoisi};
