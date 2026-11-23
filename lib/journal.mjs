// Dérush — le journal des erreurs et le diagnostic de « Signaler un bug ».
// - Ce qui a mal tourné (une erreur du programme, de l'interface, d'un rendu, d'une IA) est noté dans un petit
//   fichier du dossier de Dérush (journal-erreurs.jsonl, les 300 dernières lignes), sans rien de personnel :
//   ni dossier personnel, ni adresse, ni clé (nettoyer()).
// - Rien ne part tout seul. Le journal reste sur l'ordinateur ; il n'est envoyé que si la personne clique
//   « Envoyer » dans « Signaler un bug », après avoir vu ce qui part (lib/asso.mjs).
// - analyser() lit ces erreurs et l'état de l'ordinateur, et dit ce qui a le plus de chances d'être la cause, avec
//   un geste à essayer : la personne est aidée tout de suite, et l'équipe reçoit un rapport déjà trié.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DOSSIER_SUPPORT} from './moteurs.mjs';
import {VERSION} from './commun.mjs';

const fichier = () => path.join(DOSSIER_SUPPORT, 'journal-erreurs.jsonl');
const MAX_LIGNES = 300;
const MAX_TEXTE = 1200;

/** Retire d'un texte ce qui est personnel ou secret : le dossier personnel, les adresses, les clés, les jetons. */
export function nettoyer(texte) {
  let t = String(texte ?? '');
  const maison = os.homedir();
  if (maison && maison.length > 3) t = t.split(maison).join('~');
  t = t.replace(/\/(Users|home)\/[^/\s"'`:]+/g, '~').replace(/[A-Za-z]:\\Users\\[^\\\s"'`:]+/g, '~');
  t = t.replace(/\/Volumes\/[^/\s"'`:]+/g, '/Volumes/<disque>');
  t = t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<e-mail>');
  // les clés d'API et les jetons, sous leurs formes courantes
  t = t.replace(/\b(sk|pk|rk|xi|trg|ghp|gho|ghu|ghs|github_pat|AIza|ya29)[-_.][-_.A-Za-z0-9]{12,}/g, '<clé>');
  t = t.replace(/\b(sk-ant|sk-proj|trg_live|trg_test)[-_A-Za-z0-9]{8,}/g, '<clé>');
  t = t.replace(/\b(bearer|authorization|x-derush-jeton|jeton|token|api[-_ ]?key|cl[eé])\b(["']?\s*[:=]\s*["']?|\s+)[-_.A-Za-z0-9]{16,}/gi, '$1 <clé>');
  t = t.replace(/([?&](c|cle|jeton|token|key|code|access_token)=)[^&\s"'`]+/gi, '$1<clé>');
  t = t.replace(/\b[a-f0-9]{32,}\b/gi, '<empreinte>');
  return t;
}

const court = (t, n = MAX_TEXTE) => { const s = nettoyer(t).replace(/\s+\n/g, '\n').trim(); return s.length > n ? `${s.slice(0, n)}…` : s; };

function lireLignes() {
  try { return fs.readFileSync(fichier(), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; }
}

/**
 * Note une erreur. `source` : 'programme' (le serveur de Dérush), 'interface', 'ia', 'rendu', 'outil'.
 * La même erreur répétée dans la minute ne fait qu'une ligne (son compteur monte). Ne lève jamais d'erreur.
 */
export function noterErreur({source = 'programme', message, detail = null, ou = null} = {}) {
  try {
    const m = court(message, 500);
    if (!m) return;
    const lignes = lireLignes();
    const derniere = lignes.at(-1);
    const maintenant = Date.now();
    if (derniere && derniere.message === m && derniere.source === source && maintenant - Date.parse(derniere.quand) < 60000) {
      derniere.fois = (derniere.fois ?? 1) + 1;
      derniere.quand = new Date(maintenant).toISOString();
    } else {
      lignes.push({quand: new Date(maintenant).toISOString(), version: VERSION, source: String(source).slice(0, 20), message: m,
        ...(detail ? {detail: court(detail)} : {}), ...(ou ? {ou: court(ou, 160)} : {})});
    }
    fs.mkdirSync(DOSSIER_SUPPORT, {recursive: true});
    fs.writeFileSync(fichier(), `${lignes.slice(-MAX_LIGNES).map((l) => JSON.stringify(l)).join('\n')}\n`);
  } catch { /* le journal ne doit jamais empêcher Dérush de marcher */ }
}

/** Les dernières erreurs notées, de la plus récente à la plus ancienne. */
export const lireErreurs = (n = 30) => lireLignes().slice(-n).reverse();
/** Vide le journal (après un envoi, si la personne le demande). */
export function viderJournal() { try { fs.rmSync(fichier(), {force: true}); } catch { /* déjà vide */ } }

// ——— l'analyse : ce que les erreurs et l'état de l'ordinateur laissent penser ———
// Chaque règle : ce qu'elle cherche dans les erreurs (ou dans l'état), le nom de la cause, le geste à essayer.
const REGLES = [
  {si: /not logged in|loggedIn.{0,6}false|invalid api key|unauthorized|401\b|session.{0,20}expir|se connecter|me connecter|pas connect/i, cause: 'Ton IA n’est plus connectée à ton compte.', geste: 'Ouvre Connexions, puis « Me connecter » sous ton IA.'},
  {si: /usage limit|rate.?limit|quota|limite hebdomadaire|limit reached|429\b|forfait.{0,20}épuis/i, cause: 'Le quota de ton IA est atteint.', geste: 'Attends l’heure de recharge (Connexions la donne), ou choisis une autre IA dans « Qui monte ? ».'},
  {si: /ENOSPC|EDQUOT|no space left|disque plein|plus de place/i, cause: 'Le disque est plein.', geste: 'Libère de la place (la corbeille, de vieux exports), puis recommence.'},
  {si: /ffmpeg.{0,40}(introuvable|not found|ENOENT)|spawn ffmpeg ENOENT|ffprobe.{0,30}ENOENT/i, cause: 'FFmpeg est introuvable.', geste: 'Relance l’installation : Réglages › Moteurs, ou « node derush.mjs installer ».'},
  {si: /chrome|chromium|headless|browser.{0,30}(launch|start|démarr)|navigateur.{0,30}(démarr|lancer)/i, cause: 'Le navigateur sans fenêtre du rendu n’a pas démarré.', geste: 'Réinstalle le moteur de rendu : Réglages › « Fabriquer la vidéo » › Installer.'},
  {si: /remotion|bundle|webpack|render(Media|Frames)|composition.{0,30}(introuvable|not found)/i, cause: 'Le rendu de la vidéo (Remotion) a échoué.', geste: 'Redemande la vidéo ; si l’erreur revient, réinstalle le moteur de rendu dans Réglages.'},
  {si: /hyperframes/i, cause: 'HyperFrames, le second moteur de rendu, a échoué.', geste: 'Vérifie que Node.js est en version 22 ou plus, puis redemande la vidéo.'},
  {si: /whisper|transcri/i, cause: 'L’écriture du texte des rushes (Whisper) a échoué.', geste: 'Réglages › « Texte mot à mot » : réinstalle Whisper, puis relance « Transcrire ».'},
  {si: /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network|réseau|injoignable|fetch failed|hors ligne/i, cause: 'Internet ne répondait pas à ce moment-là.', geste: 'Vérifie ta connexion, puis recommence.'},
  {si: /EACCES|EPERM|operation not permitted|permission denied|accès refusé/i, cause: 'Dérush n’a pas eu le droit de lire ou d’écrire un fichier.', geste: 'Sur Mac : Réglages Système › Confidentialité › Fichiers et dossiers, autorise Dérush ; ou déplace tes rushes dans Vidéos.'},
  {si: /ENOENT|introuvable|no such file|fichier manquant|n’existe plus/i, cause: 'Un fichier a été déplacé ou supprimé.', geste: 'Remets le rush à sa place (ou rebranche son disque), puis clique « Retrouver » sur sa vignette.'},
  {si: /out of memory|heap|ENOMEM|mémoire/i, cause: 'L’ordinateur a manqué de mémoire.', geste: 'Ferme les autres applications lourdes, puis recommence ; en 4K, exporte d’abord en 1080p.'},
  {si: /elevenlabs/i, cause: 'ElevenLabs n’a pas répondu comme prévu.', geste: 'Connexions › ElevenLabs : vérifie qu’il est branché et qu’il te reste des crédits.'},
  {si: /treg|youtube.{0,30}(envoi|upload)|publication/i, cause: 'La publication (Treg) a échoué.', geste: 'Connexions › Treg : relie de nouveau tes réseaux, puis redemande la publication.'},
  {si: /EADDRINUSE|port.{0,20}(occupé|in use)/i, cause: 'Un autre Dérush tourne déjà.', geste: 'Quitte l’autre fenêtre de Dérush (ou redémarre l’ordinateur), puis rouvre-le.'},
  {si: /TypeError|ReferenceError|undefined is not|Cannot read propert|is not a function|SyntaxError/i, cause: 'Une erreur dans le programme de Dérush.', geste: 'Envoie-nous ce rapport : c’est à nous de la corriger. En attendant, ferme et rouvre Dérush.'},
];

/**
 * Lit les erreurs (et l'état de l'ordinateur) et rend les causes probables, la plus fréquente d'abord :
 * [{cause, geste, fois, exemple}]. `etat` : la liste du bilan ({nom, ok, requis, detail}).
 */
export function analyser(erreurs = [], etat = []) {
  const pistes = new Map();
  const ajouter = (cause, geste, exemple, fois = 1) => {
    const p = pistes.get(cause);
    if (p) p.fois += fois; else pistes.set(cause, {cause, geste, fois, ...(exemple ? {exemple: court(exemple, 160)} : {})});
  };
  for (const e of erreurs) {
    const texte = `${e.message ?? ''} ${e.detail ?? ''}`;
    const r = REGLES.find((x) => x.si.test(texte));
    if (r) ajouter(r.cause, r.geste, e.message, e.fois ?? 1);
  }
  // ce qui manque sur l'ordinateur, même sans erreur notée
  for (const x of etat) {
    if (x.ok || !x.requis) continue;
    ajouter(`Il manque « ${x.nom} » sur cet ordinateur.`, 'Relance l’installation : « node derush.mjs installer », ou Réglages › Moteurs.', x.detail);
  }
  return [...pistes.values()].sort((a, b) => b.fois - a.fois).slice(0, 5);
}

const systeme = () => {
  const noms = {darwin: 'macOS', win32: 'Windows', linux: 'Linux'};
  return `${noms[process.platform] ?? process.platform} ${os.release()} (${os.arch()}), Node ${process.versions.node}, ${Math.round(os.totalmem() / 2 ** 30)} Go de mémoire`;
};

/**
 * Le diagnostic complet, tel qu'il est montré puis envoyé : {texte, pistes, erreurs}. `etat` : le bilan de
 * l'installation ; `plus` : des lignes en plus ({cle: valeur}), comme l'IA choisie.
 */
export function diagnostic({etat = [], plus = {}, combien = 12} = {}) {
  const erreurs = lireErreurs(combien);
  const pistes = analyser(erreurs, etat);
  const l = [];
  l.push(`Dérush ${VERSION} — ${systeme()}`);
  for (const [k, v] of Object.entries(plus)) if (v != null && v !== '') l.push(`${k} : ${court(v, 200)}`);
  l.push('');
  l.push('— Analyse —');
  if (pistes.length) for (const p of pistes) l.push(`• ${p.cause}${p.fois > 1 ? ` (${p.fois} fois)` : ''}`);
  else l.push(erreurs.length ? '• Aucune cause connue reconnue dans ces erreurs.' : '• Aucune erreur notée par Dérush.');
  l.push('');
  l.push('— Ce qui est installé —');
  for (const x of etat) l.push(`${x.ok ? '✓' : x.requis ? '✗' : '·'} ${x.nom} — ${court(x.detail ?? '', 120)}`);
  l.push('');
  l.push(`— Dernières erreurs (${erreurs.length}) —`);
  for (const e of erreurs) {
    l.push(`[${String(e.quand).slice(0, 16).replace('T', ' ')}] ${e.source}${e.fois > 1 ? ` ×${e.fois}` : ''}${e.version && e.version !== VERSION ? ` (v${e.version})` : ''} : ${e.message}`);
    if (e.ou) l.push(`    ${e.ou}`);
    if (e.detail) l.push(`    ${String(e.detail).split('\n').slice(0, 4).join('\n    ')}`);
  }
  return {texte: nettoyer(l.join('\n')).slice(0, 9000), pistes, erreurs: erreurs.length};
}
