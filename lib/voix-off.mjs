// Dérush — la voix off proposée, avec des questions : pour qu'un vlog (un voyage, une journée) soit complet.
//
// 1. L'avis, sans IA (avisVoixOff) : d'après les rushes (la part de parole dans leur texte Whisper, les rushes muets ou
//    seulement d'ambiance), le genre de vidéo et une voix off déjà posée, Dérush dit si une voix off aiderait, et
//    pourquoi. L'interface allume alors le bouton du micro.
// 2. Les questions, sur un clic (questionsVoixOff) : une IA légère (niveau « Rapide », sans connecteur, sans web, sans
//    terminal) lit ce que Dérush sait des rushes (dates et heures de prise de vue, appareil, lieu s'il est connu,
//    l'analyse, les planches déjà faites, ce qui est dit) et prépare 3 à 6 questions courtes, chacune rattachée au
//    passage qu'elle éclaire, et une première idée du fil du film. Elle travaille dans un dossier à part
//    (.derush/voix-off/ia/ du projet), jamais dans le dossier de montage.
// 3. Les réponses : écrites, ou dites au micro (un enregistrement de Dérush, donc un média du projet, dont Whisper écrit
//    le texte). Tout est rangé dans .derush/voix-off/etat.json du projet.
// 4. Le choix de la personne : (moi) elle l'enregistre en lisant le texte écrit par l'IA ; (reponses) ses réponses
//    enregistrées font la voix off ; (ia) l'IA l'écrit et la fait dire par ElevenLabs, s'il est branché ; (aucune).
//    installerVoixOff pose contexte/voix-off.md dans le dossier de travail de l'IA de montage (et, pour « reponses », les
//    enregistrements dans contexte/voix-off/reponses/), consigneVoixOff dit la ligne de consigne qui va avec.
// 5. Le texte à lire : l'IA de montage l'écrit dans voix-off/texte.json de son dossier ; recueillirVoixOff le range dans
//    le projet à la fin de son travail (avec les questions qu'elle aurait posées elle-même, voix-off/questions.json), et
//    texteALire le rend, découpé par moment, pour l'afficher pendant l'enregistrement.
// Rien ne part chez une IA sans un clic : l'avis et l'état se calculent sur l'ordinateur.
import fs from 'node:fs';
import path from 'node:path';
import {lireJson, ecrireJson} from './outils.mjs';
import {arrondi, dureeLisible, texteDesMots, MODES, TYPES_VIDEO} from './commun.mjs';
import {lireMots, transcrire} from './transcription.mjs';
import {lireAnalyseIA, couperProprement} from './analyse.mjs';
import {lancerConseil, etatConseil, arreterConseil} from './conseil.mjs';
import {chargerCle} from './elevenlabs.mjs';
import {espaceDuProjet, METIERS} from './espaces.mjs';

/** Les choix possibles, dans l'ordre où l'interface les propose. */
export const CHOIX_VOIX_OFF = {
  moi: {nom: 'Je l’enregistre moi-même', description: 'Ton IA écrit le texte, moment par moment ; tu le lis au micro, il s’affiche pendant l’enregistrement.'},
  reponses: {nom: 'Mes réponses font la voix off', description: 'Tes réponses dites au micro deviennent la voix off : ton IA les monte sur les images.'},
  ia: {nom: 'Ton IA l’écrit et la fait dire', description: 'Une voix ElevenLabs lit le texte écrit d’après tes réponses.'},
  aucune: {nom: 'Pas de voix off', description: 'Le film se passe de voix off.'},
};
/** Le débit d'une voix off posée : 2,5 mots par seconde (150 mots par minute). */
export const DEBIT_MOTS_S = 2.5;
const DOSSIER_TRAVAIL_IA = 'voix-off'; // dans le dossier de montage : texte.json et questions.json, écrits par l'IA

const nombre = (v) => ((typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) ? Number(v) : null);
const court = (x, n) => couperProprement(x ?? '', n);
const maintenant = () => new Date().toISOString();
const pour100 = (x) => `${Math.round(x * 100)} %`;

// ——— Le rangement dans le projet ———

const dossierVoixOff = (P) => path.join(P.cache, 'voix-off');
const fichierEtat = (P) => path.join(dossierVoixOff(P), 'etat.json');
const etatVide = () => ({v: 1, compteur: 0, questions: [], fil: '', demande: '', questions_le: null, moteur: null, proposee: false, reponses: {}, choix: null, choix_le: null, texte: null});
/** L'état de la voix off d'un projet (questions, réponses, choix, texte à lire), toujours complet. */
export function lireVoixOff(P) {
  const e = lireJson(fichierEtat(P));
  if (!e || typeof e !== 'object') return etatVide();
  return {...etatVide(), ...e, questions: Array.isArray(e.questions) ? e.questions : [], reponses: e.reponses && typeof e.reponses === 'object' && !Array.isArray(e.reponses) ? e.reponses : {},
    choix: Object.hasOwn(CHOIX_VOIX_OFF, e.choix ?? '') ? e.choix : null};
}
const ecrireVoixOff = (P, e) => ecrireJson(fichierEtat(P), e);
const etatVierge = (e) => !e.questions.length && !Object.keys(e.reponses).length && !e.choix && !e.texte;
/** Oublie la voix off d'un projet (questions, réponses, choix, texte). Les enregistrements restent dans ses médias. */
export function oublierVoixOff(P) {
  if (etatConseil(cleQuestions(P))?.etat === 'en_cours') throw new Error('Les questions sont en cours de préparation : arrête-les d’abord.');
  fs.rmSync(fichierEtat(P), {force: true});
  return true;
}

// ——— Ce que Dérush sait des rushes ———

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const p2 = (n) => String(n).padStart(2, '0');
function dateLisible(a, mo, j, h, mi, approx) {
  const jour = `${JOURS[new Date(Date.UTC(a, mo - 1, j)).getUTCDay()]} ${j === 1 ? '1er' : j} ${MOIS[mo - 1]} ${a}`;
  return {cle_jour: `${a}-${p2(mo)}-${p2(j)}`, jour, heure: h == null ? null : `${p2(h)} h ${p2(mi)}`, t: Date.UTC(a, mo - 1, j, h ?? 0, mi ?? 0), approx: !!approx};
}
/**
 * La date d'un texte de caméra : « 2026-03-20T09:14:00+0900 » (iPhone : l'heure du lieu, exacte), « …Z » (la plupart
 * des caméras : temps universel, ramené à l'heure de cet ordinateur, donc approximative en voyage), ou sans fuseau.
 */
export function lireDatePrise(texte) {
  const x = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:[.,]\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(String(texte ?? '').trim());
  if (!x) return null;
  const [a, mo, j, h, mi] = x.slice(1, 6).map(Number);
  if (mo < 1 || mo > 12 || j < 1 || j > 31 || h > 23 || mi > 59) return null;
  if (x[7] && /^z$/i.test(x[7])) {
    const d = new Date(Date.UTC(a, mo - 1, j, h, mi));
    return dateLisible(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), true);
  }
  return dateLisible(a, mo, j, h, mi, false);
}
/** La date tirée du nom d'un fichier : « IMG_20260320_091400 », « PXL_20260320_091400123 », « 2026-03-20 09.14.00 », « VID-20260320-WA0003 ». */
export function dateDuNom(nom) {
  const x = /(?:^|[^0-9])(20\d{2})[-_.]?([01]\d)[-_.]?([0-3]\d)(?:[-_ T.]?([0-2]\d)[-_.h:]?([0-5]\d)(?=[-_.m:]?\d{2}|[^0-9]|$))?/.exec(String(nom ?? ''));
  if (!x) return null;
  const [a, mo, j] = x.slice(1, 4).map(Number);
  if (mo < 1 || mo > 12 || j < 1 || j > 31) return null;
  const h = x[4] != null ? Number(x[4]) : null;
  if (h != null && h > 23) return null;
  return dateLisible(a, mo, j, h, x[5] != null ? Number(x[5]) : null, true);
}
/**
 * Quand ce rush a été filmé : les données de la caméra, sinon son nom. {jour, heure, cle_jour, t, approx, source} ou null.
 * Une caméra qui n'écrit que le temps universel (Android : « …Z ») donne l'heure de cet ordinateur, fausse en voyage ;
 * si son nom porte l'heure du même moment (« VID_20241108_083012 », l'heure du lieu, à 14 h près), c'est le nom qui
 * dit l'heure vécue.
 */
export function datePrise(m) {
  const d = lireDatePrise(m?.tournage?.date);
  const n = dateDuNom(m?.nom);
  if (d && d.approx && n?.heure) {
    const u = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(m.tournage.date).trim());
    const instant = u ? Date.UTC(Number(u[1]), Number(u[2]) - 1, Number(u[3]), Number(u[4]), Number(u[5])) : NaN;
    if (Math.abs(n.t - instant) <= 14 * 3600e3) return {...n, source: 'nom'};
  }
  if (d) return {...d, source: 'camera'};
  return n ? {...n, source: 'nom'} : null;
}
const quand = (d) => (d ? `${d.jour}${d.heure ? ` à ${d.heure}` : ''}${d.source === 'nom' ? ' (d’après le nom du fichier)' : d.approx ? ' (heure de cet ordinateur)' : ''}` : null);
/** Le lieu, s'il est connu (rangé par l'import, par exemple depuis le Drive) : du texte seulement. */
const lieuDe = (m) => {
  const l = m?.tournage?.lieu ?? m?.lieu ?? null;
  return typeof l === 'string' && l.trim() ? l.trim().slice(0, 120) : null;
};

/** Les secondes de parole d'une suite de mots : les mots voisins (moins de 0,8 s d'écart) forment une phrase. */
export function secondesDeParole(mots) {
  const w = (mots ?? []).filter((x) => !x.ev && Number.isFinite(x.d) && Number.isFinite(x.f) && x.f >= x.d).sort((a, b) => a.d - b.d);
  let total = 0;
  let a = null;
  let b = null;
  for (const x of w) {
    if (a == null) { a = x.d; b = x.f; continue; }
    if (x.d - b <= 0.8) b = Math.max(b, x.f);
    else { total += b - a; a = x.d; b = x.f; }
  }
  if (a != null) total += b - a;
  return total;
}
const MEMO_PAROLE = new Map(); // projet + rush → {signe, parole_s, mots} : la parole ne se recompte que si le texte a changé
function paroleDe(P, m) {
  const cle = `${P.racine}\0${m.id}`;
  const signe = JSON.stringify([m.transcription?.cree_le ?? null, m.transcription?.mots ?? null, !!m.transcription]);
  const vu = MEMO_PAROLE.get(cle);
  if (vu?.signe === signe) return vu;
  const mots = lireMots(P, m);
  const r = {signe, mots: mots ? mots.filter((x) => !x.ev).length : null, parole_s: mots ? Math.min(m.duree || Infinity, secondesDeParole(mots)) : null};
  MEMO_PAROLE.set(cle, r);
  return r;
}
/**
 * Ce qu'on entend dans un rush : « photo », « muet » (pas de son), « parle » (au moins un cinquième du temps),
 * « ambiance » (du son, presque pas de parole), « a_ecouter » (Whisper n'est pas encore passé), « inconnu » (pas de texte
 * possible : Whisper absent, ou en erreur).
 */
export function sonDuRush(P, m) {
  if (m.type === 'image') return {genre: 'photo', parole_s: 0};
  if (!m.audio) return {genre: 'muet', parole_s: 0};
  const p = m.transcription ? paroleDe(P, m) : null;
  if (p?.parole_s == null) {
    if (m.transcription && Number(m.transcription.mots) === 0) return {genre: 'ambiance', parole_s: 0};
    const enAttente = m.etapes?.texte === undefined && m.etat !== 'erreur';
    return {genre: enAttente ? 'a_ecouter' : 'inconnu', parole_s: null};
  }
  const part = m.duree > 0 ? p.parole_s / m.duree : 0;
  return {genre: part >= 0.2 ? 'parle' : 'ambiance', parole_s: p.parole_s};
}

const idsReponses = (e) => new Set(Object.values(e.reponses).map((r) => r?.media).filter(Boolean));
/** Les médias qui sont des réponses dites au micro (pour les écarter des rushes : pack, analyse, timeline). */
export const mediasReponses = (P) => idsReponses(lireVoixOff(P));
/** Une prise de voix faite dans Dérush (enregistrements/voix-off-…) : ce n'est pas un rush. */
const estPriseDeVoix = (P, m) => m.type === 'audio' && path.dirname(String(m.chemin ?? '')) === path.join(P.racine, 'enregistrements') && /^voix-off-/.test(m.nom ?? '');
/**
 * Les rushes : les médias du projet, sans les réponses enregistrées, ni les voix off posées, ni les prises de voix
 * faites dans Dérush, ni ceux en erreur.
 */
export function rushesDuProjet(P, e = lireVoixOff(P)) {
  const exclus = idsReponses(e);
  for (const s of P.d.superpositions ?? []) if (s?.voix_off && s.media) exclus.add(s.media);
  return (P.d.medias ?? []).filter((m) => m && !exclus.has(m.id) && m.etat !== 'erreur' && ['video', 'audio', 'image'].includes(m.type) && !estPriseDeVoix(P, m));
}
/** Un son seul sans parole est une musique (ou une ambiance à part), pas un rush à raconter. */
const estUnRush = (P, m) => m.type !== 'audio' || sonDuRush(P, m).genre === 'parle';

const RECIT = /(?<![\p{L}])(vlogs?|voyages?|séjours?|sejours?|journées?|journees?|souvenirs?|vacances|road ?trips?|travel|day in|week-?ends?|raconte|récits?|recits?|documentaires?|reportages?|carnets? de route|balades?|visites?)(?![\p{L}])/iu;
/** Le genre de film demandé : un récit (vlog, voyage, documentaire), une parole filmée (face caméra, podcast), ou ni l'un ni l'autre. */
export function genreDuProjet(P, demande = '') {
  const d = P.d ?? {};
  const type = d.brief?.type ?? '';
  let metier = null;
  try { metier = espaceDuProjet(P)?.metier?.type ?? null; } catch { /* sans espace */ }
  const textes = [d.titre, d.brief?.objectif, d.brief?.references, demande].filter(Boolean).join(' ');
  const recit = type === 'vlog' || type === 'trend' || type === 'evenement' || RECIT.test(textes) || ['vlog', 'documentaire'].includes(metier);
  const parole = !recit && (['face', 'podcast'].includes(type) || ['interview', 'chronique', 'humour'].includes(metier));
  const nom = TYPES_VIDEO[type]?.nom ?? (type === 'vlog' ? 'Vlog' : null);
  return {recit, parole, mode: d.mode ?? 'montage', type: type || null, nom, metier: metier ? METIERS[metier]?.nom ?? null : null};
}

/**
 * Une voix off serait-elle utile ? Sans IA, d'après les rushes. Renvoie
 * {conseillee, pourquoi, parole_s, duree_s, parole_par_minute, part_parole, rushes, muets, ambiance, parles, photos,
 *  a_ecouter, deja, refusee, en_attente, genre}.
 */
export function avisVoixOff(P, {demande = ''} = {}) {
  const e = lireVoixOff(P);
  const rushes = rushesDuProjet(P, e);
  const deja = (P.d.superpositions ?? []).some((s) => s?.voix_off);
  const genre = genreDuProjet(P, demande || e.demande);
  const compte = {rushes: 0, muets: 0, ambiance: 0, parles: 0, photos: 0, a_ecouter: 0, inconnus: 0};
  let duree = 0;
  let ecoute = 0;
  let parole = 0;
  for (const m of rushes) {
    // un son seul sans parole est une musique, pas un rush : il ne compte pas
    if (!estUnRush(P, m)) continue;
    compte.rushes++;
    const s = sonDuRush(P, m);
    if (s.genre === 'photo') { compte.photos++; continue; }
    duree += m.duree || 0;
    if (s.genre === 'muet') compte.muets++;
    else if (s.genre === 'ambiance') compte.ambiance++;
    else if (s.genre === 'parle') compte.parles++;
    else if (s.genre === 'a_ecouter') compte.a_ecouter++;
    else compte.inconnus++;
    if (s.parole_s != null) { ecoute += m.duree || 0; parole += s.parole_s; }
  }
  const part = ecoute > 0 ? parole / ecoute : 0;
  const base = {parole_s: arrondi(parole, 1), duree_s: arrondi(duree, 1), parole_par_minute: duree > 0 ? arrondi(parole / (duree / 60), 1) : 0, part_parole: arrondi(part, 3),
    ...compte, deja, refusee: e.choix === 'aucune', en_attente: false, genre};
  const avis = (conseillee, pourquoi, plus = {}) => ({conseillee, pourquoi, ...base, ...plus});
  if (!compte.rushes) return avis(false, 'Pas encore de rushes : dépose tes vidéos, Dérush te dira si une voix off aiderait.');
  if (e.choix === 'aucune') return avis(false, 'Tu as choisi de te passer de voix off pour ce projet.');
  if (deja) return avis(false, 'Ta voix off est déjà dans le montage.');
  if (genre.mode === 'voix') return avis(true, `Tu as choisi le mode « ${MODES.voix.nom} » : il ne manque plus que ta voix.`);
  if (duree === 0) {
    return compte.photos >= 3 ? avis(true, `${compte.photos} photos sans un mot : une voix off leur donne un fil, comme un carnet de voyage qu’on raconte.`) : avis(false, 'Trop peu de matière pour juger : ajoute tes vidéos.');
  }
  const detail = [compte.muets ? `${compte.muets} muet${compte.muets > 1 ? 's' : ''}` : '', compte.ambiance ? `${compte.ambiance} avec seulement de l’ambiance` : ''].filter(Boolean).join(', ');
  const parleCombien = `${dureeLisible(parole)} de parole sur ${dureeLisible(duree)} de rushes`;
  // la plupart des rushes ne sont pas encore écoutés : on ne juge que si le genre le dit
  if (ecoute < duree * 0.5) {
    if (compte.a_ecouter) {
      return genre.recit && !genre.parole
        ? avis(true, 'Pour un vlog ou un voyage, une voix off raconte la journée et relie les moments. (Dérush écoute encore tes rushes.)', {en_attente: true})
        : avis(false, 'Dérush écoute encore tes rushes : il te dira bientôt si une voix off aiderait.', {en_attente: true});
    }
    if (!genre.recit) return avis(false, 'Dérush n’a pas pu écouter tes rushes (installe Whisper dans les Réglages) : il ne peut pas juger.');
    return avis(true, 'Pour un vlog ou un voyage, une voix off raconte la journée et relie les moments.');
  }
  if (genre.parole && part >= 0.25) return avis(false, `Tes rushes parlent déjà (${pour100(part)} du temps) : pour ce genre de vidéo, la voix off n’est pas nécessaire.`);
  if (part < 0.15) return avis(true, `Tes rushes parlent très peu (${parleCombien}${detail ? ` ; ${detail}` : ''}) : une voix off raconterait ce qu’on voit, ce que tu as vécu, et ferait le lien entre les moments.`);
  if (genre.recit && part < 0.4) return avis(true, `Pour un vlog ou un voyage, une voix off relie les moments : tes rushes ne parlent que ${pour100(part)} du temps (${parleCombien}).`);
  return avis(false, `Tes rushes parlent déjà (${pour100(part)} du temps) : la voix off n’est pas nécessaire.`);
}

// ——— Les questions, par une IA légère ———

const cleQuestions = (P) => `voix-off:${P.racine}`;
const REGLES = `Tu es l'assistant de Dérush, un logiciel de montage vidéo. Un humain va faire un film avec ses rushes, souvent
un vlog (un voyage, une journée, un événement). Tu l'aides à écrire sa voix off en lui posant de bonnes questions : ce que
les images ne disent pas (où il était, ce qu'il a ressenti, ce qui l'a surpris, ce qui s'est passé juste avant ou après, le
nom d'un lieu, d'un plat, d'une rue, une anecdote). Tu ne modifies rien et tu ne publies rien. Tu écris en français simple,
au tutoiement.`;

/** Le texte d'un rush, par phrases d'environ 12 mots avec le temps de la première, coupé à n signes. */
function texteHorodate(mots, n) {
  const w = (mots ?? []).filter((x) => !x.ev);
  const lignes = [];
  let taille = 0;
  for (let i = 0; i < w.length; i += 12) {
    const l = `[${arrondi(w[i].d, 1)} s] ${texteDesMots(w.slice(i, i + 12))}`;
    if (taille + l.length > n) { lignes.push('[…]'); break; }
    lignes.push(l);
    taille += l.length + 1;
  }
  return lignes.join('\n');
}
const planche = (P, m) => path.join(P.cache, 'medias', m.id, 'planche.jpg');
const JOUR_DEMANDE = new RegExp(`(?<![\\p{L}])(${JOURS.join('|')})(?![\\p{L}])`, 'iu');

/**
 * Ce que l'IA lira (rushes.md et les planches). Avec D, les fichiers sont écrits dans ce dossier ; sans, seulement
 * comptés (l'interface montre ce qui partira avant le clic).
 */
function preparerLecture(P, e, rushes, {demande = '', D = null} = {}) {
  const dates = new Map(rushes.map((m) => [m.id, datePrise(m)]));
  const ordre = rushes.slice().sort((a, b) => (dates.get(a.id)?.t ?? Infinity) - (dates.get(b.id)?.t ?? Infinity) || String(a.nom).localeCompare(String(b.nom)));
  const jourVise = JOUR_DEMANDE.exec(demande)?.[1]?.toLowerCase() ?? null;
  // les planches déjà faites (analyse) : 12 au plus, celles du jour demandé d'abord, puis les rushes qui parlent peu
  const avecPlanche = ordre.filter((m) => m.type !== 'audio' && fs.existsSync(planche(P, m)));
  const rang = (m) => (jourVise && dates.get(m.id)?.jour.startsWith(jourVise) ? 0 : 2) + (sonDuRush(P, m).genre === 'parle' ? 1 : 0);
  const planches = new Set(avecPlanche.slice().sort((a, b) => rang(a) - rang(b)).slice(0, 12).map((m) => m.id));
  const parRush = Math.max(200, Math.min(900, Math.floor(60000 / Math.max(1, ordre.length))));
  let textes = 0;
  const g = genreDuProjet(P, demande);
  const b = P.d.brief ?? {};
  const L = [`# Les rushes du projet « ${P.d.titre ?? ''} »`, ''];
  if (demande) L.push(`Ce que l'humain veut faire : « ${demande} »`);
  const infos = [[g.nom ?? '', 'Genre de vidéo'], [MODES[g.mode]?.nom ?? '', 'Mode'], [b.objectif, 'Objectif'], [b.public, 'Public'], [b.ton, 'Ton'], [b.duree_visee, 'Durée visée'], [g.metier, 'Métier du créateur']];
  for (const [v, k] of infos) if (v) L.push(`- ${k} : ${String(v).slice(0, 300)}`);
  const deja = e.questions.filter((q) => e.reponses[q.id]);
  if (deja.length) {
    L.push('', '## Ce qu’il a déjà raconté (ne repose pas ces questions)', '');
    for (const q of deja) {
      const r = e.reponses[q.id];
      const m = r.media ? P.d.medias.find((x) => x.id === r.media) : null;
      const dit = m ? texteDesMots((lireMots(P, m) ?? []).filter((x) => !x.ev)) : '';
      L.push(`- ${q.texte}`, `  → ${[r.texte, dit].filter(Boolean).join(' / ').slice(0, 600) || '(enregistré, pas encore transcrit)'}`);
    }
  }
  let jour = null;
  for (const m of ordre) {
    const d = dates.get(m.id);
    const cle = d?.cle_jour ?? 'inconnu';
    if (cle !== jour) {
      jour = cle;
      L.push('', `## ${d ? d.jour.charAt(0).toUpperCase() + d.jour.slice(1) : 'Date inconnue'}`);
    }
    const s = sonDuRush(P, m);
    const nature = m.type === 'image' ? 'photo' : `${m.type === 'audio' ? 'son' : 'vidéo'} de ${dureeLisible(m.duree)}`;
    L.push('', `### ${m.id} · « ${m.nom} » — ${nature}`);
    if (d) L.push(`- Filmé : ${quand(d)}`);
    if (m.tournage?.appareil) L.push(`- Appareil : ${String(m.tournage.appareil).slice(0, 80)}`);
    if (lieuDe(m)) L.push(`- Lieu : ${lieuDe(m)}`);
    const son = {photo: null, muet: 'muet (pas de son)', ambiance: 'seulement de l’ambiance (presque pas de parole)', parle: `on y parle (${dureeLisible(s.parole_s ?? 0)} de parole)`, a_ecouter: 'pas encore écouté', inconnu: 'pas de texte'}[s.genre];
    if (son) L.push(`- Son : ${son}`);
    const a = lireAnalyseIA(P, m);
    if (a?.resume) L.push(`- Ce qu’on y voit : ${a.resume}${a.contenu?.length ? ` (${a.contenu.join(', ')})` : ''}`);
    if (a?.moments?.length) L.push(`- Meilleurs moments : ${a.moments.map((x) => `${x.debut}–${x.fin} s : ${x.quoi}`).join(' ; ')}`);
    if (a?.usage) L.push(`- Usage : ${a.usage}`);
    if (planches.has(m.id)) {
      L.push(`- Planche : planches/${m.id}.jpg (12 images avec leur temps)`);
      if (D) { try { fs.copyFileSync(planche(P, m), path.join(D, 'planches', `${m.id}.jpg`)); } catch { planches.delete(m.id); } }
    }
    if (s.genre === 'parle' || (s.genre === 'ambiance' && s.parole_s > 0)) {
      const t = texteHorodate(lireMots(P, m), parRush);
      if (t) { textes++; L.push('- Ce qui est dit (temps dans le rush) :', '```', t, '```'); }
    }
  }
  const md = `${L.join('\n').trim()}\n`;
  if (D) fs.writeFileSync(path.join(D, 'rushes.md'), md);
  return {rushes: ordre.length, planches: planches.size, textes, jour: jourVise, taille: Buffer.byteLength(md)};
}

function consigneQuestions(demande) {
  return `Dans ce dossier :
- rushes.md : ce que Dérush sait de chaque rush (date et heure de prise de vue, appareil, lieu s'il est connu, ce que
  l'analyse y a vu, ce qui est dit), rangés dans l'ordre où ils ont été filmés, jour par jour ;
- planches/<ID>.jpg : pour certains rushes, 12 images avec leur temps (de gauche à droite, puis de haut en bas).
${demande ? `\nCe que l'humain veut faire : « ${demande} ».\n` : ''}
Lis rushes.md, regarde les planches, puis écris le fichier reponse.json, un objet JSON :
{"fil": "la première idée du fil du film, en 2 à 4 phrases : le début, le milieu, la fin, dans l'ordre où les choses ont été vécues",
 "questions": [{"texte": "la question", "medias": ["<ID du rush qu'elle éclaire>"], "debut": secondes, "fin": secondes,
   "pourquoi": "ce que la réponse apportera au film, en une phrase"}]}

Les questions :
- 3 à 6, dans l'ordre du film ; chacune courte (15 mots au plus), concrète, sur un seul moment, au tutoiement ;
- jamais une question fermée (oui ou non), jamais ce que l'image montre déjà : demande ce qu'elle ne dit pas (où, pourquoi,
  ce qu'il a ressenti, ce qui l'a surpris, ce qui s'est passé avant ou après, le nom d'un lieu ou d'un plat) ;
- chacune éclaire un passage précis : l'ID du rush (M…) et ses temps en secondes dans ce rush, tirés de rushes.md ou des
  planches (pour une photo, sans temps) ;
- si la demande vise un jour, un lieu ou un moment (« le vendredi »), seulement sur les rushes de ce jour ou de ce lieu ;
- rien d'intime ni de sensible (santé, argent, adresse, noms de famille) ;
- pas une question à laquelle il a déjà répondu (« Ce qu'il a déjà raconté »).
N'invente rien : si tu ne sais pas où c'est, demande-le.`;
}

/** Une réponse de l'IA (questions et fil) nettoyée : des rushes qui existent, des temps dans le rush. Lève une erreur si rien ne reste. */
export function validerQuestions(r, P) {
  const medias = new Map((P.d.medias ?? []).map((m) => [m.id, m]));
  const liste = Array.isArray(r?.questions) ? r.questions : [];
  const questions = [];
  for (const q of liste) {
    const texte = court(typeof q === 'string' ? q : q?.texte ?? q?.question, 200);
    if (!texte) continue;
    const brut = Array.isArray(q?.medias) ? q.medias : q?.media ? [q.media] : [];
    const ids = [...new Set(brut.map(String))].filter((id) => medias.has(id)).slice(0, 4);
    const m = ids.length ? medias.get(ids[0]) : null;
    let debut = m && m.type !== 'image' ? nombre(q?.debut) : null;
    let fin = debut != null ? nombre(q?.fin) : null;
    if (debut != null) {
      const d = Number(m.duree) || 0;
      debut = arrondi(Math.min(Math.max(0, debut), Math.max(0, d - 0.5)), 2);
      fin = fin != null && fin > debut ? arrondi(Math.min(fin, d), 2) : arrondi(Math.min(d, debut + 5), 2);
    }
    questions.push({texte, pourquoi: court(q?.pourquoi, 200), medias: ids, debut, fin});
    if (questions.length >= 6) break;
  }
  if (!questions.length) throw new Error('L’IA n’a proposé aucune question utilisable. Réessaie.');
  return {fil: court(r?.fil, 700), questions};
}

/** Range des questions dans le projet. Celles qui ont déjà une réponse restent (rien de ce qu'a dit la personne ne se perd). */
function poserQuestions(P, r, {source, moteur = null, demande = null}) {
  const e = lireVoixOff(P);
  const gardees = e.questions.filter((q) => e.reponses[q.id]);
  for (const id of Object.keys(e.reponses)) if (!gardees.some((q) => q.id === id)) delete e.reponses[id];
  let n = Number(e.compteur) || 0;
  for (const q of e.questions) n = Math.max(n, Number(/^Q(\d+)$/.exec(q.id)?.[1]) || 0);
  const nouvelles = r.questions.map((q) => ({id: `Q${++n}`, ...q, source, cree_le: maintenant()}));
  Object.assign(e, {compteur: n, questions: [...gardees, ...nouvelles], fil: r.fil || e.fil, questions_le: maintenant(), moteur: moteur ?? e.moteur, ...(demande != null ? {demande: String(demande).slice(0, 500)} : {})});
  if (source === 'montage') e.proposee = true;
  ecrireVoixOff(P, e);
  return nouvelles;
}

/**
 * Lance la préparation des questions par une IA légère (sur un clic de la personne). Rend la main tout de suite : le
 * suivi se lit avec etatQuestions(P) (etatConseil : étapes, erreur), les questions arrivent dans l'état du projet.
 */
export function questionsVoixOff(P, {moteur = null, qualite = 'rapide', demande = ''} = {}) {
  const cle = cleQuestions(P);
  const deja = etatConseil(cle);
  if (deja?.etat === 'en_cours') return deja;
  const e = lireVoixOff(P);
  if (e.choix === 'aucune') throw new Error('Tu as choisi de te passer de voix off pour ce projet : change ce choix d’abord.');
  const rushes = rushesDuProjet(P, e).filter((m) => estUnRush(P, m));
  if (!rushes.length) throw new Error('Dépose d’abord tes rushes : les questions partent de ce qu’ils montrent.');
  const D = path.join(dossierVoixOff(P), 'ia');
  fs.rmSync(D, {recursive: true, force: true});
  fs.mkdirSync(path.join(D, 'planches'), {recursive: true});
  const texteDemande = String(demande ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  preparerLecture(P, e, rushes, {demande: texteDemande, D});
  lancerConseil({cle, dossier: D, consigne: consigneQuestions(texteDemande), systeme: REGLES, competences: ['storytelling-and-narrative'],
    moteur, qualite: qualite === 'soigne' ? 'soigne' : 'rapide', attendu: 'reponse.json', delaiMs: 8 * 60000,
    valider: (r) => validerQuestions(r, P),
    surFin: (err, r, c) => { if (!err && r) poserQuestions(P, r, {source: 'ia', moteur: c.moteur, demande: texteDemande}); }});
  return etatConseil(cle);
}
export const etatQuestions = (P) => etatConseil(cleQuestions(P));
export const arreterQuestions = (P) => arreterConseil(cleQuestions(P));

// ——— Les réponses et le choix ———

const enCoursDeTexte = new Set(); // projet + média : un texte de réponse déjà demandé à Whisper
/** Le texte d'un enregistrement de réponse, par Whisper, en priorité dans la file (sans attendre les autres rushes). */
function demanderTexte(P, m, file) {
  const cle = `${P.racine}\0${m.id}`;
  if (!file?.ajouter || !m.audio || m.transcription || enCoursDeTexte.has(cle)) return false;
  enCoursDeTexte.add(cle);
  file.ajouter(`Texte de ta réponse · ${m.nom}`, async (prog) => {
    try {
      if (m.transcription) return true;
      if (!P.d.medias.includes(m)) return false; // retiré du projet entre-temps
      await transcrire(P, m, 'whisper', prog);
      return true;
    } catch { return false; /* Whisper absent : la préparation du rush s'en chargera quand il sera là */ } finally { enCoursDeTexte.delete(cle); }
  }, {media: m.id, type: 'transcription', prioritaire: true});
  return true;
}

/**
 * La réponse de la personne à une question : écrite (texte), dite au micro (media : l'id de l'enregistrement fait dans
 * Dérush, déjà dans les médias), ou les deux. Un champ absent garde sa valeur ; vide partout, la réponse est retirée.
 * Avec `file` (la file des tâches), l'enregistrement passe en tête pour recevoir son texte.
 */
export function repondre(P, {question, texte, media} = {}, {file = null} = {}) {
  const e = lireVoixOff(P);
  const q = e.questions.find((x) => x.id === question);
  if (!q) throw new Error('Cette question n’existe plus.');
  let m = null;
  if (media != null && media !== '') {
    m = (P.d.medias ?? []).find((x) => x.id === String(media));
    if (!m) throw new Error('Cet enregistrement n’est pas dans le projet.');
    if (!m.audio) throw new Error('Cet enregistrement n’a pas de son.');
  }
  const avant = e.reponses[q.id] ?? {};
  const r = {
    texte: texte === undefined ? avant.texte ?? '' : String(texte ?? '').replace(/\r/g, '').trim().slice(0, 4000),
    media: media === undefined ? avant.media ?? null : m?.id ?? null,
    question: q.texte,
    le: maintenant(),
  };
  if (!r.texte && !r.media) delete e.reponses[q.id];
  else e.reponses[q.id] = r;
  ecrireVoixOff(P, e);
  if (m) demanderTexte(P, m, file);
  return r.texte || r.media ? r : null;
}

/** Les réponses dites au micro, avec leur média et leur texte (null tant que Whisper n'est pas passé). */
function reponsesEnregistrees(P, e) {
  const L = [];
  for (const q of e.questions) {
    const r = e.reponses[q.id];
    const m = r?.media ? (P.d.medias ?? []).find((x) => x.id === r.media) : null;
    if (!m) continue;
    const mots = lireMots(P, m);
    L.push({q, r, m, mots: mots ? mots.filter((x) => !x.ev) : null});
  }
  return L;
}

/** Le choix de la personne (moi, reponses, ia, aucune), ou null pour revenir à « pas encore choisi ». */
export function choisirVoixOff(P, choix, {elevenlabs = null} = {}) {
  if (choix !== null && !Object.hasOwn(CHOIX_VOIX_OFF, String(choix))) throw new Error('Choix de voix off inconnu.');
  const e = lireVoixOff(P);
  if (choix === 'reponses' && !reponsesEnregistrees(P, e).length) throw new Error('Enregistre d’abord au moins une réponse au micro : ce sont elles qui feront la voix off.');
  if (choix === 'ia' && !(elevenlabs ?? chargerCle())) throw new Error('ElevenLabs n’est pas branché : branche-le dans Connexions, ou enregistre la voix toi-même.');
  e.choix = choix;
  e.choix_le = maintenant();
  ecrireVoixOff(P, e);
  return choix;
}

// ——— Le texte à lire ———

/** Les mots à dire : la ponctuation isolée (« : », « ? » à la française) ne se lit pas. */
const compterMots = (t) => String(t ?? '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
/** Un texte de voix off (de l'IA ou retouché par la personne) nettoyé : des moments dans l'ordre, avec leurs temps. Null s'il est vide. */
export function validerTexte(t) {
  const brut = Array.isArray(t) ? t : Array.isArray(t?.moments) ? t.moments : [];
  const moments = [];
  for (const x of brut) {
    const texte = String(x?.texte ?? '').replace(/\s+/g, ' ').trim().slice(0, 1500);
    const debut = nombre(x?.debut);
    if (!texte || debut == null || debut < 0) continue;
    const fin = nombre(x?.fin);
    moments.push({debut: arrondi(debut, 2), fin: fin != null && fin > debut ? arrondi(fin, 2) : null, plans: court(x?.plans, 200), texte});
  }
  moments.sort((a, b) => a.debut - b.debut);
  moments.splice(80);
  if (!moments.length) return null;
  moments.forEach((x, i) => { if (x.fin == null) x.fin = arrondi(moments[i + 1]?.debut > x.debut ? moments[i + 1].debut : x.debut + Math.max(2, compterMots(x.texte) / DEBIT_MOTS_S), 2); });
  return {titre: court(t?.titre, 120), video: court(t?.video, 160) || null, moments};
}
/** La personne retouche le texte à lire (ou l'écrit elle-même). */
export function ecrireTexte(P, t) {
  const v = validerTexte(t);
  if (!v) throw new Error('Le texte est vide : écris au moins un moment.');
  const e = lireVoixOff(P);
  e.texte = {...v, source: 'humain', cree_le: maintenant()};
  ecrireVoixOff(P, e);
  return texteALire(P);
}
/**
 * Le texte de voix off à lire au micro, découpé par moment du film : {titre, video, source, cree_le, mots, lecture_s,
 * moments: [{debut, fin, plans, texte, mots, lecture_s, trop_long}]}, ou null. « trop_long » : il faudrait lire plus vite
 * que 2,5 mots par seconde pour tenir dans le moment.
 */
export function texteALire(P) {
  const e = lireVoixOff(P);
  if (!e.texte?.moments?.length) return null;
  let mots = 0;
  const moments = e.texte.moments.map((x) => {
    const n = compterMots(x.texte);
    mots += n;
    const lecture = arrondi(n / DEBIT_MOTS_S, 1);
    return {...x, mots: n, lecture_s: lecture, trop_long: lecture > (x.fin - x.debut) * 1.15 + 0.3};
  });
  return {titre: e.texte.titre ?? '', video: e.texte.video ?? null, source: e.texte.source ?? 'ia', cree_le: e.texte.cree_le ?? null, mots, lecture_s: arrondi(mots / DEBIT_MOTS_S, 1), moments};
}

/**
 * À la fin d'un travail de l'IA de montage : range dans le projet ce qu'elle a écrit dans voix-off/ de son dossier
 * depuis `depuis` (ms) : le texte à lire (texte.json) et les questions qu'elle propose (questions.json). Renvoie
 * {texte: bool, questions: n}.
 */
export function recueillirVoixOff(atelier, P, depuis = 0) {
  const r = {texte: false, questions: 0};
  const recent = (f) => { try { return fs.statSync(f).mtimeMs >= depuis; } catch { return false; } };
  const ft = path.join(atelier, DOSSIER_TRAVAIL_IA, 'texte.json');
  if (recent(ft)) {
    const v = validerTexte(lireJson(ft));
    if (v) {
      const e = lireVoixOff(P);
      e.texte = {...v, source: 'ia', cree_le: maintenant()};
      ecrireVoixOff(P, e);
      r.texte = true;
    }
  }
  const fq = path.join(atelier, DOSSIER_TRAVAIL_IA, 'questions.json');
  if (recent(fq) && lireVoixOff(P).choix !== 'aucune') {
    try { r.questions = poserQuestions(P, validerQuestions(lireJson(fq), P), {source: 'montage'}).length; } catch { /* rien d'utilisable */ }
  }
  return r;
}

// ——— Ce que reçoit l'IA de montage ———

const lignesMoment = (P, q) => {
  const m = q.medias?.length ? (P.d.medias ?? []).find((x) => x.id === q.medias[0]) : null;
  if (!m) return null;
  const d = datePrise(m);
  return `${q.medias.join(', ')} « ${m.nom} »${q.debut != null ? `, de ${q.debut} s à ${q.fin} s dans le rush` : ''}${d ? ` (filmé ${quand(d)})` : ''}`;
};
/** Le mode réellement suivi : « ia » sans ElevenLabs et « reponses » sans enregistrement retombent sur « moi ». */
function modeSuivi(e, {elevenlabs, enregistrees}) {
  if (e.choix === 'ia' && !elevenlabs) return 'moi';
  if (e.choix === 'reponses' && !enregistrees) return 'moi';
  return e.choix;
}
const FORMAT_TEXTE = `\`voix-off/texte.json\` (le texte de la voix off, que Dérush affiche pendant l'enregistrement) :
\`\`\`json
{"titre": "Vendredi à Kyoto", "video": "nom du fichier livré (s'il y en a plusieurs)",
 "moments": [{"debut": 0, "fin": 6.5, "plans": "ce qu'on voit, en quelques mots", "texte": "ce qui est dit"}]}
\`\`\`
\`debut\` et \`fin\` : en secondes dans la vidéo montée. Environ ${String(DEBIT_MOTS_S).replace('.', ',')} mots par seconde de film au plus (un moment de 6 s : 15 mots).`;
const FORMAT_QUESTIONS = `\`voix-off/questions.json\` (Dérush les affiche dans une carte et allume le bouton du micro) :
\`\`\`json
{"fil": "le fil du film en 2 à 4 phrases", "questions": [{"texte": "la question", "medias": ["M3"], "debut": 12, "fin": 25, "pourquoi": "ce que la réponse apportera"}]}
\`\`\`
\`debut\` et \`fin\` : en secondes dans le rush (M3), 3 à 6 questions.`;

function contexteEnTexte(P, e, avis, {elevenlabs, enregistrees, mode}) {
  const L = ['# La voix off de ce projet', ''];
  L.push(`Avis de Dérush (sans IA, d'après les rushes) : ${avis.conseillee ? 'une voix off est conseillée' : 'pas de voix off nécessaire'} — ${avis.pourquoi}`);
  if (avis.duree_s > 0) L.push(`Parole dans les rushes : ${dureeLisible(avis.parole_s)} sur ${dureeLisible(avis.duree_s)} (${Math.round(avis.part_parole * 100)} %).`);
  if (e.demande) L.push(`Ce que l'humain voulait faire quand il a demandé les questions : « ${e.demande} »`);
  if (e.fil) L.push('', '## Le fil proposé', '', e.fil);
  if (e.questions.length) {
    L.push('', '## Les questions posées à l’humain, et ses réponses', '');
    L.push('Ses réponses sont la matière de la voix off : ses mots, ses souvenirs. Ne les contredis pas et n’invente rien de plus sur ce qu’il a vécu.', '');
    for (const q of e.questions) {
      L.push(`### ${q.id} · ${q.texte}`);
      const lm = lignesMoment(P, q);
      if (lm) L.push(`- Moment : ${lm}`);
      const r = e.reponses[q.id];
      if (!r) { L.push('- (pas encore de réponse)', ''); continue; }
      if (r.texte) L.push(`- Réponse écrite : « ${r.texte} »`);
      if (r.media) {
        const x = enregistrees.find((y) => y.q.id === q.id);
        if (!x) L.push('- Réponse enregistrée : retirée du projet depuis.');
        else {
          const dit = x.mots?.length ? texteDesMots(x.mots) : null;
          L.push(`- Réponse dite au micro : ${x.m.id} « ${x.m.nom} » (${dureeLisible(x.m.duree)})${mode === 'reponses' ? ` — contexte/voix-off/reponses/${q.id}-${x.m.id}${path.extname(x.m.chemin ?? x.m.nom ?? '') || '.m4a'}` : ''}`);
          L.push(dit ? `  Ce qu'il dit : « ${dit.slice(0, 2000)} »` : '  (son texte n’est pas encore écrit : écoute-le, ou transcris-le avec les outils du dossier)');
        }
      }
      L.push('');
    }
  }
  L.push('', '## Ce que l’humain a choisi', '');
  if (mode === 'moi') {
    if (e.choix === 'ia') L.push('Il avait choisi une voix ElevenLabs, mais ElevenLabs n’est plus branché : fais comme s’il l’enregistrait lui-même, et dis-lui qu’il peut rebrancher ElevenLabs dans Connexions.', '');
    else if (e.choix === 'reponses') L.push('Il voulait que ses réponses enregistrées fassent la voix off, mais aucune n’est encore enregistrée : fais comme s’il l’enregistrait lui-même.', '');
    L.push('**Il enregistre la voix off lui-même, en lisant ton texte.**',
      '1. Monte le film en laissant de la place à la voix : des plans un peu plus longs, le son d’origine bas là où elle parlera.',
      '2. Écris le texte qu’il lira, découpé par moment du film, dans `voix-off/texte.json` (format plus bas) : à la première personne, avec ses mots à lui (reprends ses réponses), des phrases courtes faciles à dire, rien de ce que l’image montre déjà.',
      '3. À la fin de ta réponse, dis-lui qu’il peut enregistrer sa voix avec le bouton du micro : Dérush lui affiche ce texte pendant l’enregistrement.',
      'Quand sa voix sera là (marquée `voix_off` dans montage.json), remonte les images sur ce qu’elle dit.');
  } else if (mode === 'reponses') {
    L.push('**Ses réponses dites au micro font la voix off.**',
      'Elles sont dans `contexte/voix-off/reponses/` : le son (`Q…-M….m4a`) et ses mots avec leurs temps (`.json`, en secondes dans l’enregistrement).',
      '1. Nettoie sa voix sans la dénaturer (`derush-son clair`), mets-la à un niveau régulier.',
      '2. Garde ses mots : tu peux couper les hésitations, les redites et les phrases ratées, jamais changer le sens ni l’ordre d’une phrase.',
      '3. Ordonne les passages pour suivre le fil du film, et pose chacun sur les images dont il parle (le moment de sa question), le son d’origine bas sous la voix.',
      '4. Des sous-titres calés sur ses mots.',
      '5. Écris aussi dans `voix-off/texte.json` ce qu’il dit, moment par moment (format plus bas) : Dérush l’affiche.');
  } else if (mode === 'ia') {
    L.push('**Tu écris la voix off et tu la fais dire par une voix ElevenLabs.**',
      '1. Écris le texte dans `voix-off/texte.json` (format plus bas) : à la première personne, avec ses mots et ses souvenirs (ses réponses), des phrases courtes.',
      '2. Fais-le dire par une voix française naturelle d’ElevenLabs (OUTILS.md, partie « ElevenLabs » : text-to-speech), une seule génération par moment.',
      '3. Cale les images et les sous-titres sur la voix. Dis-lui quelle voix tu as prise. Ne clone jamais sa voix sans qu’il le demande.');
  } else if (e.questions.length) {
    L.push('Il n’a pas encore choisi. Monte comme il le demande. À la fin de ta réponse, rappelle-lui en une phrase les façons de faire sa voix off : il l’enregistre en lisant ton texte, ses réponses dites au micro deviennent la voix off'
      + `${elevenlabs ? ', ou une voix ElevenLabs la dit' : ''} ; il répond aux questions dans la carte « Voix off » de Dérush.`);
  } else {
    L.push('Rien n’est encore décidé. **Propose une voix off à la fin de ta réponse**, en une phrase, et pose-lui 3 à 5 questions courtes et concrètes qui l’aideraient à la raconter (où il était, ce qu’il a ressenti, ce qui l’a surpris, ce qui s’est passé avant ou après), chacune sur un moment précis des rushes, au tutoiement, jamais une question fermée.',
      'Écris-les aussi dans `voix-off/questions.json` (format plus bas). Ne fais pas de voix off sans son accord.');
  }
  // rien de décidé ni demandé : d'abord les questions ; le texte, seulement s'il demande la voix off
  if (!e.choix && !e.questions.length) L.push('', '## Les fichiers à écrire', '', FORMAT_QUESTIONS, '', `S'il te demande d'écrire la voix off : ${FORMAT_TEXTE}`);
  else L.push('', '## Les fichiers à écrire', '', FORMAT_TEXTE);
  return `${L.join('\n').trim()}\n`;
}

/**
 * Pose la voix off dans le dossier de travail de l'IA de montage (à chaque demande, comme installerSerie) :
 * contexte/voix-off.md, et pour « reponses » les enregistrements dans contexte/voix-off/reponses/. Rien pour un projet
 * qui n'en veut pas (choix « aucune ») ni pour un projet sans voix off conseillée et sans questions. Renvoie
 * {choix, mode, fichier, questions, reponses, enregistrees, conseillee, elevenlabs}, ou null.
 */
export function installerVoixOff(dossier, P, {elevenlabs = null, avis = null} = {}) {
  const fichier = path.join(dossier, 'contexte', 'voix-off.md');
  const D = path.join(dossier, 'contexte', 'voix-off');
  fs.rmSync(fichier, {force: true});
  fs.rmSync(D, {recursive: true, force: true});
  const e = lireVoixOff(P);
  if (e.choix === 'aucune') return {choix: 'aucune', mode: 'aucune', fichier: null};
  const a = avis ?? avisVoixOff(P);
  if (etatVierge(e) && !a.conseillee) return null;
  const branche = elevenlabs ?? chargerCle();
  const enregistrees = reponsesEnregistrees(P, e);
  const mode = modeSuivi(e, {elevenlabs: branche, enregistrees: enregistrees.length});
  if (mode === 'reponses') {
    fs.mkdirSync(path.join(D, 'reponses'), {recursive: true});
    for (const x of enregistrees) {
      const base = `${x.q.id}-${x.m.id}`;
      try { fs.copyFileSync(x.m.chemin, path.join(D, 'reponses', `${base}${path.extname(x.m.chemin) || '.m4a'}`), fs.constants.COPYFILE_FICLONE); } catch { /* l'enregistrement reste dans les médias du pack */ }
      ecrireJson(path.join(D, 'reponses', `${base}.json`), {question: x.q.texte, media: x.m.id, nom: x.m.nom, duree_s: arrondi(x.m.duree ?? 0, 2),
        explication: 'Temps en secondes dans l’enregistrement.', mots: (x.mots ?? []).map((w) => ({t: w.t, debut: w.d, fin: w.f}))});
    }
  }
  fs.mkdirSync(path.dirname(fichier), {recursive: true});
  fs.writeFileSync(fichier, contexteEnTexte(P, e, a, {elevenlabs: branche, enregistrees, mode}));
  return {choix: e.choix, mode, fichier: 'contexte/voix-off.md', questions: e.questions.length, reponses: Object.keys(e.reponses).length, enregistrees: enregistrees.length, conseillee: a.conseillee, elevenlabs: !!branche};
}

/** La ligne de consigne qui va avec ce qu'installerVoixOff a posé (vide s'il n'a rien posé). */
export function consigneVoixOff(r) {
  if (!r) return '';
  if (r.choix === 'aucune') return '- Voix off : l’humain n’en veut pas pour ce projet. N’en propose pas et n’en ajoute pas, sauf s’il la demande dans son message.';
  const quoi = {
    moi: 'il l’enregistre lui-même : écris le texte à lire, moment par moment, dans voix-off/texte.json, et dis-lui à la fin qu’il peut l’enregistrer avec le bouton du micro.',
    reponses: 'ses réponses dites au micro (contexte/voix-off/reponses/) font la voix off : monte-les sur les images dont elles parlent.',
    ia: 'écris la voix off dans voix-off/texte.json et fais-la dire par une voix ElevenLabs.',
  }[r.mode] ?? (r.questions
    ? 'il n’a pas encore choisi comment la faire : rappelle-le-lui en une phrase à la fin de ta réponse.'
    : 'elle aiderait ce film : propose-la à la fin de ta réponse, avec 3 à 5 questions courtes sur des moments précis, écrites aussi dans voix-off/questions.json.');
  return `- Voix off : lis contexte/voix-off.md avant de monter (l’avis de Dérush, les questions, les réponses de l’humain, son choix) ; ${quoi}`;
}
/** Le petit rappel redit à chaque message d'une conversation reprise. */
export const rappelVoixOff = (r) => (r?.fichier ? 'voix off : relis contexte/voix-off.md (réponses et choix à jour)' : r?.choix === 'aucune' ? 'pas de voix off (choix de l’humain)' : '');

// ——— Ce que voit l'interface ———

/**
 * Tout ce que l'interface montre : l'avis (et si le bouton du micro s'allume), les questions avec leur moment et leur
 * réponse, le choix, le texte à lire, le suivi de l'IA qui prépare les questions, et ce qu'elle lira si on clique.
 */
export function etatVoixOff(P, {elevenlabs = null, demande = ''} = {}) {
  const e = lireVoixOff(P);
  const avis = avisVoixOff(P, {demande});
  const branche = !!(elevenlabs ?? chargerCle());
  const medias = new Map((P.d.medias ?? []).map((m) => [m.id, m]));
  const questions = e.questions.map((q) => {
    const r = e.reponses[q.id] ?? null;
    const m = r?.media ? medias.get(r.media) : null;
    const mots = m ? lireMots(P, m) : null;
    const d = q.medias?.length && medias.get(q.medias[0]) ? datePrise(medias.get(q.medias[0])) : null;
    return {id: q.id, texte: q.texte, pourquoi: q.pourquoi ?? '', source: q.source ?? 'ia',
      moment: q.medias?.length ? {medias: q.medias.map((id) => ({id, nom: medias.get(id)?.nom ?? null})), debut: q.debut ?? null, fin: q.fin ?? null, quand: d ? quand(d) : null} : null,
      reponse: r ? {texte: r.texte ?? '', le: r.le ?? null, media: r.media ? (m
        ? {id: m.id, nom: m.nom, duree_s: arrondi(m.duree ?? 0, 1), texte: mots ? texteDesMots(mots.filter((x) => !x.ev)) : null,
          en_cours: !mots && (enCoursDeTexte.has(`${P.racine}\0${m.id}`) || (m.etapes?.texte === undefined && !!m.audio))}
        : {id: r.media, retire: true}) : null} : null};
  });
  const enregistrees = reponsesEnregistrees(P, e).length;
  const t = texteALire(P);
  const s = etatQuestions(P);
  const rushes = rushesDuProjet(P, e).filter((m) => estUnRush(P, m));
  // ce que l'IA lirait : compté sans rien lire de lourd (cet état est demandé souvent)
  const genres = rushes.map((m) => sonDuRush(P, m));
  const envoi = {rushes: rushes.length, planches: Math.min(12, rushes.filter((m) => m.type !== 'audio' && fs.existsSync(planche(P, m))).length),
    textes: genres.filter((g) => g.genre === 'parle' || (g.genre === 'ambiance' && g.parole_s > 0)).length};
  // le bouton du micro : allumé quand une voix off aiderait et que rien n'est décidé, ou quand la personne a choisi de
  // l'enregistrer elle-même ; éteint si elle est déjà posée, refusée, ou confiée aux réponses ou à ElevenLabs
  let pourquoi = null;
  if (avis.deja || e.choix === 'aucune' || e.choix === 'reponses' || e.choix === 'ia') pourquoi = null;
  else if (e.choix === 'moi') pourquoi = t ? 'Ton texte est prêt : enregistre ta voix off en le lisant.' : 'Tu enregistres ta voix off toi-même : ton IA peut t’écrire le texte à lire.';
  else if (avis.conseillee) pourquoi = avis.pourquoi;
  else if (e.proposee || questions.length) pourquoi = 'Ton IA propose une voix off : réponds à ses questions.';
  return {
    avis,
    micro: {allume: !!pourquoi, pourquoi},
    questions, fil: e.fil, demande: e.demande, questions_le: e.questions_le, moteur: e.moteur, proposee: !!e.proposee,
    repondues: questions.filter((q) => q.reponse).length,
    choix: e.choix, choix_le: e.choix_le,
    choix_possibles: Object.fromEntries(Object.entries(CHOIX_VOIX_OFF).map(([k, c]) => [k, {...c,
      ok: k === 'reponses' ? enregistrees > 0 : k === 'ia' ? branche : true,
      pourquoi: k === 'reponses' && !enregistrees ? 'Réponds d’abord à une question au micro.' : k === 'ia' && !branche ? 'ElevenLabs n’est pas branché (Connexions).' : null}])),
    texte: t ? {moments: t.moments.length, mots: t.mots, lecture_s: t.lecture_s, source: t.source, cree_le: t.cree_le} : null,
    suivi: s,
    // ce que l'IA lira si la personne demande les questions (rien n'est envoyé sans ce clic)
    envoi,
    elevenlabs: branche,
  };
}

// ——— Les routes ———

const MOTEURS = new Set(['claude', 'codex', 'gemini']);
/**
 * Les routes de la voix off, à appeler depuis lib/serveur.mjs. Renvoie true si elle a répondu.
 *  GET    /api/voix-off                    l'état complet (etatVoixOff) ; ?demande=… pour l'avis d'une demande en cours
 *  POST   /api/voix-off/questions          {moteur?, qualite?: 'rapide'|'soigne', demande?} → {ok, suivi}
 *  POST   /api/voix-off/questions/arreter  → {ok}
 *  POST   /api/voix-off/reponses           {question, texte?, media?} → {ok, reponse, voix_off}
 *  POST   /api/voix-off/choix              {choix: 'moi'|'reponses'|'ia'|'aucune'|null} → {ok, voix_off}
 *  GET    /api/voix-off/texte              → {texte: texteALire(P)}
 *  POST   /api/voix-off/texte              {titre?, moments: [{debut, fin, texte, plans?}]} → {ok, texte}
 *  DELETE /api/voix-off                    tout oublier (les enregistrements restent dans les médias) → {ok}
 */
export async function routesVoixOff(req, res, p, url, ctx, {envoyerJson, lireCorps, ErreurHttp, projet, elevenlabs = null} = {}) {
  if (p !== '/api/voix-off' && !p.startsWith('/api/voix-off/')) return false;
  const P = typeof projet === 'function' ? projet() : projet ?? ctx?.P;
  if (!P) throw new ErreurHttp(409, 'Aucun projet ouvert.');
  const branche = () => (typeof elevenlabs === 'function' ? !!elevenlabs() : typeof elevenlabs === 'boolean' ? elevenlabs : chargerCle());
  const faire = (fn) => { try { return fn(); } catch (e) { throw new ErreurHttp(400, e.message); } };
  const etat = () => etatVoixOff(P, {elevenlabs: branche()});
  const M = req.method;
  if (p === '/api/voix-off' && M === 'GET') { envoyerJson(res, 200, etatVoixOff(P, {elevenlabs: branche(), demande: String(url?.searchParams?.get('demande') ?? '').slice(0, 500)})); return true; }
  if (p === '/api/voix-off' && M === 'DELETE') { faire(() => oublierVoixOff(P)); envoyerJson(res, 200, {ok: true}); return true; }
  if (p === '/api/voix-off/questions' && M === 'POST') {
    const {moteur = null, qualite = 'rapide', demande = ''} = await lireCorps(req);
    const suivi = faire(() => questionsVoixOff(P, {moteur: MOTEURS.has(moteur) ? moteur : null, qualite, demande: typeof demande === 'string' ? demande : ''}));
    envoyerJson(res, 200, {ok: true, suivi});
    return true;
  }
  if (p === '/api/voix-off/questions/arreter' && M === 'POST') { envoyerJson(res, 200, {ok: arreterQuestions(P)}); return true; }
  if (p === '/api/voix-off/reponses' && M === 'POST') {
    const corps = await lireCorps(req);
    const reponse = faire(() => repondre(P, {question: String(corps.question ?? ''), ...(Object.hasOwn(corps, 'texte') ? {texte: corps.texte} : {}), ...(Object.hasOwn(corps, 'media') ? {media: corps.media} : {})}, {file: ctx?.file ?? null}));
    envoyerJson(res, 200, {ok: true, reponse, voix_off: etat()});
    return true;
  }
  if (p === '/api/voix-off/choix' && M === 'POST') {
    const {choix = null} = await lireCorps(req);
    faire(() => choisirVoixOff(P, choix, {elevenlabs: branche()}));
    envoyerJson(res, 200, {ok: true, voix_off: etat()});
    return true;
  }
  if (p === '/api/voix-off/texte' && M === 'GET') { envoyerJson(res, 200, {texte: texteALire(P)}); return true; }
  if (p === '/api/voix-off/texte' && M === 'POST') {
    const corps = await lireCorps(req);
    const texte = faire(() => ecrireTexte(P, corps));
    envoyerJson(res, 200, {ok: true, texte});
    return true;
  }
  return false;
}
