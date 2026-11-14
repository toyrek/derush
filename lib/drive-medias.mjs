// Dérush — « Depuis mon Drive » : retrouver des rushes dans le Google Drive de la personne, et les importer dans le projet.
//
// La personne écrit « va dans mon Drive, prends les vidéos de mon séjour au Japon et fais-moi un vlog du vendredi ».
// Dérush passe par le dossier Google Drive de l'ordinateur (Google Drive pour ordinateur, lib/drive.mjs) :
//   1. il en fait le plan SANS lire aucun fichier : dossiers, noms, tailles, dates de fichier (un « stat » ne télécharge
//      rien, même pour un fichier resté sur le Drive). Borné en profondeur, en nombre et en temps ; gardé 5 minutes ;
//   2. une IA légère (lib/conseil.mjs, niveau « rapide », dans un dossier à elle) choisit les dossiers d'après ce plan
//      résumé. Elle ne voit ni le Drive ni les fichiers : seulement le plan, sans aucun chemin de l'ordinateur ;
//   3. Dérush lit la vraie date et l'heure de prise de vue des fichiers de CES dossiers seulement (FFprobe pour les
//      vidéos et les sons, l'EXIF pour les photos JPEG), quatre à la fois, avec un cache par fichier (chemin, taille,
//      date). C'est là que Google Drive télécharge les fichiers qui ne sont que sur le Drive : la personne le voit et
//      dit oui avant (« a_confirmer »), ou choisit de s'en tenir aux noms et aux dates des fichiers ;
//   4. l'IA légère choisit les fichiers (le jour : « le vendredi » d'un séjour se déduit des dates ; le lieu ; le thème),
//      et Dérush en fait une phrase (« 6 vidéos du vendredi 8 novembre, Kyoto, 4,2 Go ») ;
//   5. après un clic de la personne, Dérush vérifie la place, copie (ou clone) les fichiers dans rushes/ du projet en
//      suivant la progression, et les ajoute aux médias comme un import normal, dans l'ordre de prise de vue.
// Il y a aussi le choix à la main, sans IA : parcourir le Drive par dossier et par jour, cocher, importer.
//
// Rien ne part à une IA sans le clic « Chercher » ; rien n'est copié sans le clic « Importer », qui suit un aperçu
// (combien de fichiers, combien de Go, la place qui restera). Les fichiers du Drive ne sont jamais modifiés.
import fs from 'node:fs';
import path from 'node:path';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {FFPROBE, lancer, lireJson, ecrireJson, tailleLisible} from './outils.mjs';
import {EXT_VIDEOS, EXT_SONS, EXT_IMAGES} from './commun.mjs';
import {DOSSIER_SUPPORT} from './moteurs.mjs';
import {dossiersDrive, aideInstallationDrive} from './drive.mjs';
import {lancerConseil, etatConseil, arreterConseil} from './conseil.mjs';
import {placeLibre, GO} from './disque.mjs';
import {ajouterMedias} from './medias.mjs';
import {cloner} from './plateforme.mjs';

/** Une erreur qui porte le code HTTP que la route doit rendre. */
export class ErreurDrive extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// ——— les bornes ———
const DUREE_PLAN = 5 * 60e3; // le plan du Drive est gardé 5 minutes
const LIMITES = {profondeur: 12, fichiers: 20000, entrees: 150000, dureeMs: 25000};
const MAX_DOSSIERS_IA = 600; // dossiers montrés à l'IA
const MAX_FICHIERS_DATES = 1500; // fichiers dont Dérush lit la date et que l'IA reçoit
const MAX_IMPORT = 500;
const LECTURES_EN_MEME_TEMPS = 4;
const DUREE_MAX_LECTURE = 90e3; // une lecture (un fichier que Google Drive télécharge lentement)
const DUREE_MAX_DATES = 5 * 60e3; // toutes les lectures d'une recherche
const SILENCE_MAX_COPIE = 3 * 60e3; // une copie qui ne reçoit plus rien depuis 3 minutes : Google Drive ne répond plus
const PLACE_MINI = 1.5 * GO;
const PLACE_CONFORT = 5 * GO;
const CLE_IA = 'drive-medias';

const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
const court = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t ? t.slice(0, n) : null; };
const pluriel = (n, mot, mots = `${mot}s`) => `${n} ${n > 1 ? mots : mot}`;

/** Le genre d'un fichier d'après son nom : 'video', 'photo', 'son', ou null (un document, une version basse de GoPro…). */
export function genreDe(nom) {
  if (/\.(lrv|thm)$/i.test(nom)) return null; // les doublons basse définition des GoPro
  if (EXT_VIDEOS.test(nom)) return 'video';
  if (EXT_IMAGES.test(nom)) return 'photo';
  if (EXT_SONS.test(nom)) return 'son';
  return null;
}

/**
 * Le fichier n'est-il que sur le Drive (pas encore sur l'ordinateur) ? Un fichier « en ligne seulement » a une taille
 * mais aucun bloc sur le disque (macOS, Windows et Linux le disent pareil). true / false, ou null si on ne sait pas.
 */
export function surLeDriveSeulement(st) {
  if (!Number.isFinite(st?.blocks)) return null;
  return st.size > 0 && st.blocks === 0;
}

/** Est-ce que `chemin` est dans `dossier` (ou est ce dossier) ? */
const dedans = (dossier, chemin) => { const r = path.relative(dossier, chemin); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

/** Les racines du Drive (« Mon Drive », « Drive partagés ») et l'enceinte où un raccourci a le droit de mener. */
function racinesDe(d) {
  const racines = [{nom: path.basename(d.monDrive), abs: d.monDrive}, ...(d.partages ? [{nom: path.basename(d.partages), abs: d.partages}] : [])];
  // les raccourcis du Drive mènent à un dossier caché du compte (à côté de « Mon Drive ») ; un Drive monté ailleurs
  // (Linux, essais) n'a pas ce compte au-dessus : l'enceinte est alors le Drive lui-même
  const enceinte = ['Mon Drive', 'My Drive'].includes(path.basename(d.monDrive)) ? path.dirname(d.monDrive) : d.monDrive;
  let vraie = enceinte;
  try { vraie = fs.realpathSync(enceinte); } catch { /* le Drive vient de partir */ }
  return {racines, enceinte: vraie};
}

/** Fait tourner `fn` sur une liste, `n` à la fois au plus. */
async function enParallele(liste, n, fn) {
  let i = 0;
  await Promise.all(Array.from({length: Math.max(0, Math.min(n, liste.length))}, async () => {
    while (i < liste.length) { const k = i++; await fn(liste[k], k); }
  }));
}

// ——— les dates écrites dans les noms (« VID_20241108_083012 », « 2024-11-08 08.30.12 », « IMG-20241108-WA0001 ») ———
const NOM_AVEC_HEURE = /(?:^|\D)(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])[ _T-]+(?:at[ _]|à[ _])?([01]\d|2[0-3])[-_.h:]?([0-5]\d)[-_.m:]?([0-5]\d)/i;
const NOM_SANS_HEURE = /(?:^|\D)(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?!\d)/;
const dateValide = (a, m, j) => { const d = new Date(Date.UTC(+a, +m - 1, +j)); return d.getUTCMonth() === +m - 1 && d.getUTCDate() === +j; };
/** La date (heure locale de la prise, sans fuseau) lue dans un nom de fichier : {l, heure} ou null. */
export function dateDuNom(nom) {
  const base = path.parse(String(nom)).name;
  let x = NOM_AVEC_HEURE.exec(base);
  if (x && dateValide(x[1], x[2], x[3])) return {l: `${x[1]}-${x[2]}-${x[3]}T${x[4]}:${x[5]}:${x[6]}`, heure: true};
  x = NOM_SANS_HEURE.exec(base);
  if (x && dateValide(x[1], x[2], x[3])) return {l: `${x[1]}-${x[2]}-${x[3]}`, heure: false};
  return null;
}

// ——— la date de prise de vue lue dans le fichier ———
const anneeCroyable = (ms) => { const a = new Date(ms).getUTCFullYear(); return a >= 2000 && a <= new Date().getUTCFullYear() + 1; };
/** « +09:00 », « +0900 », « Z » → minutes (null si illisible). */
export function decalageDe(s) {
  const x = /^([+-])(\d{2}):?(\d{2})$/.exec(String(s ?? '').trim());
  if (!x) return null;
  const z = (x[1] === '-' ? -1 : 1) * (Number(x[2]) * 60 + Number(x[3]));
  return Math.abs(z) <= 14 * 60 ? z : null;
}
/** Une date avec son fuseau (« 2024-11-08T14:30:12+0900 », celle de l'iPhone) : {i (instant), l (locale), z (minutes)}. */
function dateAvecFuseau(s) {
  const x = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?\s*([+-]\d{2}:?\d{2})$/.exec(String(s ?? '').trim());
  if (!x) return null;
  const z = decalageDe(x[7]);
  const l = `${x[1]}-${x[2]}-${x[3]}T${x[4]}:${x[5]}:${x[6]}`;
  const i = Date.parse(`${l}Z`) - (z ?? 0) * 60000;
  if (z == null || !Number.isFinite(i) || !anneeCroyable(i)) return null;
  return {i, l, z};
}
/** Une date en temps universel (« creation_time » : 2024-11-07T23:30:12.000000Z) : {i} seulement, le fuseau manque. */
function dateUniverselle(s) {
  const t = String(s ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(t)) return null;
  const i = Date.parse(/Z$|[+-]\d{2}:?\d{2}$/.test(t) ? t.replace(' ', 'T') : `${t.replace(' ', 'T')}Z`);
  return Number.isFinite(i) && anneeCroyable(i) ? {i} : null;
}
/** Le lieu d'une prise (ISO 6709 : « +35.0116+135.7681+050.000/ ») arrondi au kilomètre : « 35.01,135.77 ». */
function lieuDe(s) {
  const x = /^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/.exec(String(s ?? '').trim());
  if (!x) return null;
  const [la, lo] = [Number(x[1]), Number(x[2])];
  if (!(Math.abs(la) <= 90 && Math.abs(lo) <= 180) || (la === 0 && lo === 0)) return null;
  return `${la.toFixed(2)},${lo.toFixed(2)}`;
}

/** L'EXIF d'une photo JPEG (ses premiers octets seulement) : {i, l, z} ou null. */
export function lireExif(b) {
  if (!b || b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let o = 2;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) return null;
    const marque = b[o + 1];
    if (marque === 0xff) { o++; continue; }
    if (marque === 0x01 || (marque >= 0xd0 && marque <= 0xd8)) { o += 2; continue; }
    if (marque === 0xda || marque === 0xd9) return null; // l'image commence : pas d'EXIF avant
    const long = b.readUInt16BE(o + 2);
    if (marque === 0xe1 && b.toString('latin1', o + 4, o + 10) === 'Exif\0\0') return lireTiff(b.subarray(o + 10, Math.min(b.length, o + 2 + long)));
    o += 2 + long;
  }
  return null;
}
function lireTiff(t) {
  if (t.length < 8) return null;
  const ordre = t.toString('latin1', 0, 2);
  if (ordre !== 'II' && ordre !== 'MM') return null;
  const le = ordre === 'II';
  const u16 = (o) => (le ? t.readUInt16LE(o) : t.readUInt16BE(o));
  const u32 = (o) => (le ? t.readUInt32LE(o) : t.readUInt32BE(o));
  const entrees = (o) => {
    const r = new Map();
    if (!(o >= 8 && o + 2 <= t.length)) return r;
    const n = u16(o);
    for (let k = 0; k < n && k < 400; k++) {
      const e = o + 2 + k * 12;
      if (e + 12 > t.length) break;
      r.set(u16(e), {type: u16(e + 2), n: u32(e + 4), v: e + 8});
    }
    return r;
  };
  const texte = (x) => {
    if (!x || x.type !== 2 || x.n > 64) return null;
    const deb = x.n <= 4 ? x.v : u32(x.v);
    if (deb + x.n > t.length) return null;
    return t.toString('latin1', deb, deb + x.n).replace(/\0[\s\S]*$/, '').trim() || null;
  };
  const ifd0 = entrees(u32(4));
  const exif = ifd0.has(0x8769) ? entrees(u32(ifd0.get(0x8769).v)) : new Map();
  const quand = texte(exif.get(0x9003)) ?? texte(exif.get(0x9004)) ?? texte(ifd0.get(0x0132));
  const x = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(quand ?? '');
  if (!x || !dateValide(x[1], x[2], x[3])) return null;
  const l = `${x[1]}-${x[2]}-${x[3]}T${x[4]}:${x[5]}:${x[6]}`;
  if (!anneeCroyable(Date.parse(`${l}Z`))) return null;
  const z = decalageDe(texte(exif.get(0x9011)) ?? texte(exif.get(0x9010)));
  return {i: z != null ? Date.parse(`${l}Z`) - z * 60000 : null, l, z};
}

let LECTURES = 0; // les fichiers vraiment lus (pour les essais : un cache qui marche n'en lit plus)
export const lecturesFaites = () => LECTURES;

/**
 * La date de prise de vue d'un fichier, lue dans le fichier : {i, l, z, d (durée), g (lieu)}, des champs à null quand
 * ils manquent, ou null si le fichier n'a pas pu être lu (il sera relu la prochaine fois).
 * C'est ici que Google Drive télécharge un fichier resté sur le Drive (au moins son début).
 */
export async function lirePrise(abs, genre) {
  LECTURES++;
  if (genre === 'photo') {
    if (!/\.jpe?g$/i.test(abs)) return {i: null, l: null, z: null, d: null, g: null};
    let fd = null;
    try {
      fd = await fs.promises.open(abs, 'r');
      const b = Buffer.alloc(256 * 1024);
      const {bytesRead} = await fd.read(b, 0, b.length, 0);
      const e = lireExif(b.subarray(0, bytesRead));
      return {i: e?.i ?? null, l: e?.l ?? null, z: e?.z ?? null, d: null, g: null};
    } catch { return null; } finally { await fd?.close().catch(() => {}); }
  }
  let j;
  try {
    const {out} = await lancer(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_entries', 'format=duration:format_tags:stream=codec_type:stream_tags', abs], {dureeMax: DUREE_MAX_LECTURE});
    j = JSON.parse(out.toString());
  } catch { return null; }
  const tags = new Map();
  for (const s of [...(j.streams ?? []), j.format ?? {}]) for (const [k, v] of Object.entries(s.tags ?? {})) tags.set(k.toLowerCase(), v);
  const p = dateAvecFuseau(tags.get('com.apple.quicktime.creationdate')) ?? dateUniverselle(tags.get('creation_time'));
  const duree = Number(j.format?.duration);
  return {i: p?.i ?? null, l: p?.l ?? null, z: p?.z ?? null, d: duree > 0 ? Math.round(duree * 10) / 10 : null,
    g: lieuDe(tags.get('com.apple.quicktime.location.iso6709') ?? tags.get('location') ?? tags.get('location-eng'))};
}

// ——— le cache des dates (chemin dans le Drive, taille, date du fichier) ———
const FICHIER_DATES = path.join(DOSSIER_SUPPORT, 'drive', 'dates.json');
let DATES = null;
const cleDate = (f) => `${f.rel}\n${f.taille}\n${Math.round(f.modifie)}`;
function cacheDates() {
  if (!DATES) { const x = lireJson(FICHIER_DATES); DATES = x && typeof x === 'object' && !Array.isArray(x) ? x : {}; }
  return DATES;
}
function sauverDates() {
  const c = cacheDates();
  const cles = Object.keys(c);
  if (cles.length > 30000) for (const k of cles.sort((a, b) => (c[a].t ?? 0) - (c[b].t ?? 0)).slice(0, cles.length - 30000)) delete c[k];
  try { ecrireJson(FICHIER_DATES, c, 0); } catch { /* disque plein : on relira la prochaine fois */ }
}
const aLire = (f) => f.genre !== 'photo' || /\.jpe?g$/i.test(f.nom);

// ——— les dates finales : le jour et l'heure locales de chaque prise ———
const pad = (n) => String(n).padStart(2, '0');
const texteDecalage = (z) => `${z < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(z) / 60))}:${pad(Math.abs(z) % 60)}`;
const heureLocale = (i, z) => new Date(i + z * 60000).toISOString().slice(0, 19);
const decalageOrdinateur = (i) => -new Date(i).getTimezoneOffset();
/**
 * Le fuseau d'une vidéo qui n'a que son heure universelle, déduit de l'heure locale écrite dans son nom (Android :
 * « VID_20241108_083012 ») : l'écart arrondi à la demi-heure, s'il tombe juste (à 12 minutes près : le nom donne parfois
 * le début de la prise, la date la fin).
 */
function deduireDecalage(nomCommeUtc, instant) {
  const brut = (nomCommeUtc - instant) / 60000;
  const z = Math.round(brut / 30) * 30;
  return Math.abs(brut - z) <= 12 && Math.abs(z) <= 14 * 60 ? z : null;
}

/**
 * Donne à chaque fichier sa date (f.date) : {instant, local, jour, fuseau, sur, source, heure, duree, gps}.
 *  source : 'prise' (lue dans le fichier), 'nom' (lue dans son nom), 'fichier' (la date du fichier sur le Drive).
 *  sur    : comment le fuseau est connu : 'connu', 'deduit' (le nom, ou les autres fichiers du dossier : un séjour se
 *           filme dans un seul fuseau), 'ordinateur' (celui de cet ordinateur, faute de mieux), 'local', 'nom'.
 */
export function resoudreDates(liste, {cache = cacheDates(), ordi = decalageOrdinateur} = {}) {
  const brut = new Map();
  for (const f of liste) {
    const c = cache[cleDate(f)] ?? null;
    let z = Number.isFinite(c?.z) ? c.z : null;
    let sur = z != null ? 'connu' : null;
    if (z == null && Number.isFinite(c?.i) && f.nom_date?.heure) {
      const d = deduireDecalage(Date.parse(`${f.nom_date.l}Z`), c.i);
      if (d != null) { z = d; sur = 'deduit'; }
    }
    brut.set(f, {c, z, sur});
  }
  const parDossier = new Map();
  const tous = new Map();
  const compter = (m, k, z) => { const x = m.get(k) ?? new Map(); x.set(z, (x.get(z) ?? 0) + 1); m.set(k, x); };
  for (const [f, b] of brut) if (b.z != null) { compter(parDossier, f.dossier, b.z); compter(tous, '', b.z); }
  const majorite = (x) => (x ? [...x.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null : null);
  const majTous = majorite(tous.get(''));
  for (const [f, b] of brut) {
    const devine = (i) => {
      const z = majorite(parDossier.get(f.dossier)) ?? majTous;
      return z != null ? {z, sur: 'deduit'} : {z: ordi(i), sur: 'ordinateur'};
    };
    const {c} = b;
    let instant; let local; let z; let sur; let source; let heure = true;
    if (c && Number.isFinite(c.i)) {
      source = 'prise';
      instant = c.i;
      ({z, sur} = b.z != null ? b : devine(c.i));
      local = heureLocale(instant, z);
    } else if (c?.l) {
      source = 'prise'; // une photo sans fuseau : son heure est déjà locale
      local = c.l;
      z = devine(Date.parse(`${c.l}Z`)).z;
      sur = 'local';
      instant = Date.parse(`${local}Z`) - z * 60000;
    } else if (f.nom_date) {
      source = 'nom';
      heure = f.nom_date.heure;
      local = heure ? f.nom_date.l : `${f.nom_date.l}T12:00:00`;
      z = devine(Date.parse(`${local}Z`)).z;
      sur = 'nom';
      instant = Date.parse(`${local}Z`) - z * 60000;
    } else {
      source = 'fichier';
      instant = f.modifie;
      ({z, sur} = devine(instant));
      local = heureLocale(instant, z);
    }
    f.date = {instant, local, jour: local.slice(0, 10), fuseau: texteDecalage(z), sur, source, heure, duree: c?.d ?? null, gps: c?.g ?? null};
  }
  return liste;
}
const trierChrono = (liste) => liste.slice().sort((a, b) => a.date.instant - b.date.instant || a.rel.localeCompare(b.rel, 'fr'));

/** « vendredi 8 novembre 2024 » (ou sans l'année). */
export function nomJour(jour, {annee = true, semaine = true} = {}) {
  const d = new Date(`${jour}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return jour;
  return d.toLocaleDateString('fr-FR', {...(semaine ? {weekday: 'long'} : {}), day: 'numeric', month: 'long', ...(annee ? {year: 'numeric'} : {}), timeZone: 'UTC'});
}
const aujourdhui = () => nomJour(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));

/** Combien par jour : [{jour, nom, videos, photos, sons, taille}], dans l'ordre. */
function parJour(liste) {
  const m = new Map();
  for (const f of liste) {
    const j = m.get(f.date.jour) ?? {jour: f.date.jour, nom: nomJour(f.date.jour), videos: 0, photos: 0, sons: 0, taille: 0};
    j[{video: 'videos', photo: 'photos', son: 'sons'}[f.genre]]++;
    j.taille += f.taille;
    m.set(f.date.jour, j);
  }
  return [...m.values()].sort((a, b) => a.jour.localeCompare(b.jour));
}

// ——— 1. le plan du Drive (sans rien lire) ———
let PLAN = null;
let PLAN_EN_COURS = null;

/**
 * Le plan du Drive : {racines, dossiers (chemin → {rel, nom, parent}), enfants, fichiers, parRel, stats, partiel, le}.
 * Chaque fichier : {rel, abs, dossier, nom, genre, taille, modifie, local, nom_date}. Les chemins « rel » commencent par
 * le nom de la racine (« Mon Drive/Voyages/… ») et c'est tout ce qui sort de ce module : jamais le chemin de l'ordinateur.
 * null s'il n'y a pas de Drive sur l'ordinateur.
 */
export async function planDuDrive({force = false, limites = {}} = {}) {
  const d = dossiersDrive();
  if (!d) return null;
  const L = {...LIMITES, ...limites};
  const cle = `${d.monDrive}\n${d.partages ?? ''}\n${JSON.stringify(L)}`;
  if (!force && PLAN?.cle === cle && Date.now() - PLAN.le < DUREE_PLAN) return PLAN;
  if (PLAN_EN_COURS?.cle === cle) return PLAN_EN_COURS.promesse;
  const promesse = parcourir(d, L).then((p) => { p.cle = cle; PLAN = p; return p; }).finally(() => { if (PLAN_EN_COURS?.promesse === promesse) PLAN_EN_COURS = null; });
  PLAN_EN_COURS = {cle, promesse};
  return promesse;
}
export const oublierPlan = () => { PLAN = null; };

async function parcourir(d, L) {
  const debut = Date.now();
  const {racines, enceinte} = racinesDe(d);
  const fichiers = [];
  const dossiers = new Map();
  const enfants = new Map();
  const vus = new Set();
  let entrees = 0;
  let arret = null; // pourquoi le parcours s'est arrêté avant la fin
  let tropProfond = false;
  const stop = () => {
    if (!arret) {
      if (Date.now() - debut > L.dureeMs) arret = 'temps';
      else if (fichiers.length >= L.fichiers) arret = 'fichiers';
      else if (entrees >= L.entrees) arret = 'entrees';
    }
    return !!arret;
  };
  let niveau = [];
  for (const r of racines) {
    let vrai = r.abs;
    try { vrai = fs.realpathSync(r.abs); } catch { continue; }
    if (vus.has(vrai)) continue;
    vus.add(vrai);
    dossiers.set(r.nom, {rel: r.nom, nom: r.nom, parent: null});
    niveau.push({abs: r.abs, vrai, rel: r.nom});
  }
  for (let prof = 0; niveau.length && !stop(); prof++) {
    const suivant = [];
    await enParallele(niveau, 8, async (dos) => {
      if (stop()) return;
      let noms;
      try { noms = await fs.promises.readdir(dos.abs, {withFileTypes: true}); } catch { return; }
      entrees += noms.length;
      noms.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      const candidats = [];
      for (const e of noms) {
        // les fichiers cachés, les fichiers de verrou d'Office, l'icône d'un dossier sur Mac
        if (e.name.startsWith('.') || e.name.startsWith('~$') || e.name === 'Icon\r' || /[/\\\0]/.test(e.name)) continue;
        const abs = path.join(dos.abs, e.name);
        let vrai = path.join(dos.vrai, e.name);
        let estDossier = e.isDirectory();
        if (e.isSymbolicLink()) {
          // un raccourci du Drive : suivi seulement s'il mène à un dossier de ce même Drive, et une seule fois
          try {
            vrai = await fs.promises.realpath(abs);
            if (!dedans(enceinte, vrai) || !(await fs.promises.stat(vrai)).isDirectory()) continue;
            estDossier = true;
          } catch { continue; }
        }
        const rel = `${dos.rel}/${e.name}`;
        if (estDossier) {
          if (vus.has(vrai)) continue; // déjà vu (une boucle de raccourcis, un raccourci vers un dossier déjà parcouru)
          if (prof + 1 > L.profondeur) { tropProfond = true; continue; }
          vus.add(vrai);
          dossiers.set(rel, {rel, nom: e.name, parent: dos.rel});
          suivant.push({abs, vrai, rel});
          continue;
        }
        if (!e.isFile()) continue;
        const genre = genreDe(e.name);
        if (genre) candidats.push({abs, rel, dossier: dos.rel, nom: e.name, genre});
      }
      // la taille et la date de chaque fichier : un « stat », qui ne télécharge rien
      await enParallele(candidats, 8, async (c) => {
        if (stop()) return;
        try {
          const st = await fs.promises.stat(c.abs);
          if (!st.isFile()) return;
          fichiers.push({...c, taille: st.size, modifie: st.mtimeMs, local: surLeDriveSeulement(st) == null ? null : !surLeDriveSeulement(st), nom_date: dateDuNom(c.nom)});
        } catch { /* parti entre-temps */ }
      });
    });
    niveau = suivant;
  }
  fichiers.sort((a, b) => a.rel.localeCompare(b.rel, 'fr'));
  for (const x of dossiers.values()) if (x.parent) { const l = enfants.get(x.parent) ?? []; l.push(x.rel); enfants.set(x.parent, l); }
  for (const l of enfants.values()) l.sort((a, b) => a.localeCompare(b, 'fr'));
  // les comptes de chaque dossier, sous-dossiers compris
  const stats = new Map();
  for (const f of fichiers) {
    for (let r = f.dossier, direct = true; r; r = dossiers.get(r)?.parent, direct = false) {
      const s = stats.get(r) ?? {videos: 0, photos: 0, sons: 0, taille: 0, ici: 0, en_ligne: 0, n: 0};
      s[{video: 'videos', photo: 'photos', son: 'sons'}[f.genre]]++;
      s.taille += f.taille;
      s.n++;
      if (direct) s.ici++;
      if (f.local === false) s.en_ligne++;
      stats.set(r, s);
    }
  }
  const partiel = arret ?? (tropProfond ? 'profondeur' : null);
  return {racines: racines.map((r) => r.nom), racinesAbs: racines, enceinte, dossiers, enfants, fichiers, parRel: new Map(fichiers.map((f) => [f.rel, f])), stats,
    partiel, texte_partiel: partiel ? textepartiel(partiel, L) : null, le: Date.now(), duree_ms: Date.now() - debut};
}
const textepartiel = (pourquoi, L) => (pourquoi === 'profondeur' ? 'Certains dossiers sont rangés très profond : Dérush ne les a pas tous ouverts.'
  : pourquoi === 'fichiers' ? `Ton Drive contient énormément de vidéos, de photos et de sons : Dérush s’est arrêté aux ${L.fichiers.toLocaleString('fr-FR')} premiers. Ouvre un dossier pour y regarder de plus près.`
    : 'Ton Drive est très grand : Dérush n’en a parcouru qu’une partie. Ouvre un dossier pour y regarder de plus près.');

/** Les fichiers d'un dossier, sous-dossiers compris. */
const fichiersSous = (plan, rel) => plan.fichiers.filter((f) => f.dossier === rel || f.dossier.startsWith(`${rel}/`));

/** Ce qu'on montre d'un fichier : jamais son chemin sur l'ordinateur. */
export const vueFichier = (f) => ({rel: f.rel, nom: f.nom, dossier: f.dossier, genre: f.genre, taille: f.taille, local: f.local,
  date: f.date ? {quand: f.date.heure ? f.date.local.slice(0, 16).replace('T', ' ') : f.date.local.slice(0, 10), jour: f.date.jour, nom_jour: nomJour(f.date.jour), fuseau: f.date.fuseau, sur: f.date.sur, source: f.date.source} : null,
  duree: f.date?.duree ?? null});
const vueDossier = (plan, rel) => {
  const s = plan.stats.get(rel) ?? {videos: 0, photos: 0, sons: 0, taille: 0, ici: 0, en_ligne: 0, n: 0};
  return {rel, nom: plan.dossiers.get(rel)?.nom ?? rel, ...s, sous_dossiers: plan.enfants.get(rel)?.length ?? 0};
};

/**
 * Le choix à la main : un dossier du Drive (ses sous-dossiers, ses fichiers, ses jours). `jour` (AAAA-MM-JJ) : les
 * fichiers de ce jour-là dans tout le dossier, sous-dossiers compris. Les dates sont celles qu'on connaît sans rien
 * lire (déjà lues, ou lues dans le nom, ou la date du fichier) : « Lire les dates » (une recherche sans IA) les précise.
 */
export async function listerDrive({dossier = '', jour = null, rafraichir = false} = {}) {
  const d = dossiersDrive();
  if (!d) return {installe: false, ...aideInstallationDrive()};
  const plan = await planDuDrive({force: !!rafraichir});
  const base = {installe: true, drive: path.basename(d.monDrive), partiel: plan.partiel, texte_partiel: plan.texte_partiel};
  dossier = String(dossier ?? '').replace(/\/+$/, '');
  if (!dossier) return {...base, dossier: '', parent: null, chemin: [], sous_dossiers: plan.racines.map((r) => vueDossier(plan, r)), fichiers: [], jours: [], total: 0};
  if (!plan.dossiers.has(dossier)) throw new ErreurDrive(404, 'Ce dossier n’est pas (ou plus) dans ton Drive.');
  if (jour != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(jour))) throw new ErreurDrive(400, 'Jour illisible.');
  const tous = resoudreDates(fichiersSous(plan, dossier));
  const choisis = trierChrono(jour ? tous.filter((f) => f.date.jour === jour) : tous.filter((f) => f.dossier === dossier));
  return {...base, dossier, parent: plan.dossiers.get(dossier).parent, chemin: dossier.split('/'),
    sous_dossiers: (plan.enfants.get(dossier) ?? []).map((r) => vueDossier(plan, r)).filter((x) => x.n > 0),
    fichiers: choisis.slice(0, 2000).map(vueFichier), total: choisis.length, jours: parJour(tous), comptes: vueDossier(plan, dossier)};
}

// ——— l'IA légère ———
const dossierIA = () => path.join(DOSSIER_SUPPORT, 'drive', 'ia');
const REGLES_DOSSIERS = `Tu aides Dérush, un logiciel de montage vidéo, à retrouver des rushes dans le Google Drive de la personne.
Tu ne vois PAS le Drive : seulement son plan, dans arborescence.json (chaque dossier qui contient des vidéos, des photos ou des sons, sous-dossiers compris : combien, leur poids, les jours de leurs fichiers, quelques noms). Tu ne lis rien d'autre, tu ne cherches rien sur le web, tu ne lances rien.
Ta seule tâche : choisir les dossiers où se trouvent les fichiers que la personne demande.
- Un dossier choisi compte avec tous ses sous-dossiers. Choisis le plus petit ensemble qui contient tout ce qui peut servir : pour « le vendredi de mon séjour au Japon », le dossier du séjour entier. Dérush lira ensuite les vraies dates de prise de vue, et tu choisiras les fichiers du bon jour.
- Les jours d'un dossier viennent des noms ou des dates des fichiers sur le Drive (souvent le jour de l'envoi) : un indice, pas la date de la prise.
- Recopie les chemins exactement comme dans arborescence.json.
- Si rien ne correspond vraiment, ne devine pas : laisse « dossiers » vide et pose une question courte et simple à la personne.
Écris ta réponse dans le fichier reponse.json de ce dossier, et rien d'autre :
{"dossiers": ["Mon Drive/…"], "pourquoi": "une phrase simple pour la personne", "question": null}`;
const REGLES_FICHIERS = `Tu aides Dérush, un logiciel de montage vidéo, à choisir des rushes dans le Google Drive de la personne, pour le montage qu'elle demande.
Tu ne vois PAS les fichiers : seulement leur liste, dans fichiers.json. Dérush y a lu le jour et l'heure de prise de vue de chaque fichier ; « jours » résume ce qu'il y a chaque jour. Tu ne lis rien d'autre, tu ne cherches rien sur le web, tu ne lances rien.
Chaque fichier : id, dossier, nom, genre (video, photo, son), quand (date et heure locales de la prise, avec le fuseau), jour, sur (d'où vient la date : « prise » = lue dans le fichier, la plus sûre ; « prise, fuseau déduit » ; « prise, fuseau inconnu » ; « nom du fichier » ; « date du fichier » = la date sur le Drive, souvent celle de l'envoi, la moins sûre), duree_s, mo (poids en Mo), gps (latitude,longitude) quand il est connu.
Choisis tous les fichiers qui servent la demande :
- le jour demandé : « le vendredi » d'un séjour, c'est le vendredi qui tombe pendant les dates du séjour (regarde « jours ») ; « hier », « samedi dernier » se comptent depuis aujourd'hui ;
- le lieu et le thème, d'après les dossiers, les noms et les coordonnées GPS ;
- les vidéos d'abord ; les photos et les sons aussi s'ils vont avec (un vlog se nourrit de plans fixes et d'ambiances) ;
- ne laisse pas de côté un fichier du bon jour sans raison : la personne triera au montage.
Si rien ne correspond, ou si la demande peut viser deux jours très différents, ne devine pas : laisse « fichiers » vide et pose une question courte et simple.
Écris ta réponse dans le fichier reponse.json de ce dossier, et rien d'autre :
{"fichiers": ["F1", "F2"], "lieu": "le lieu en un ou deux mots, ou null", "phrase": "ce que tu as choisi, en une phrase simple pour la personne", "question": null}`;

/** Demande un avis à l'IA légère, dans son dossier à elle. Rend {…réponse validée, moteur}. */
async function demanderIA(r, {consigne, systeme, valider}) {
  // une consultation d'avant encore en route (elle met un instant à s'arrêter) : on attend qu'elle soit sortie, sinon
  // la nouvelle serait rattachée à l'ancienne et ne finirait jamais
  for (let i = 0; etatConseil(CLE_IA)?.etat === 'en_cours' && i < 50; i++) { arreterConseil(CLE_IA); await pause(200); }
  if (r.annule) throw new Error('Arrêté.');
  if (etatConseil(CLE_IA)?.etat === 'en_cours') throw new Error('La recherche précédente ne s’est pas encore arrêtée : réessaie dans un instant.');
  return new Promise((ok, ko) => {
    lancerConseil({cle: CLE_IA, dossier: dossierIA(), consigne, systeme, moteur: r.moteur, qualite: 'rapide', attendu: 'reponse.json', delaiMs: 8 * 60000, valider,
      surFin: (err, rep, c) => (err ? ko(err) : ok({...rep, moteur: c.moteur}))});
  });
}

/** Le plan résumé que l'IA reçoit pour choisir les dossiers. Aucun chemin de l'ordinateur, seulement ceux du Drive. */
function planPourIA(plan) {
  resoudreDates(plan.fichiers);
  const jours = new Map();
  for (const f of plan.fichiers) {
    for (let r = f.dossier; r; r = plan.dossiers.get(r)?.parent) {
      const x = jours.get(r) ?? {du: f.date.jour, au: f.date.jour};
      if (f.date.jour < x.du) x.du = f.date.jour;
      if (f.date.jour > x.au) x.au = f.date.jour;
      jours.set(r, x);
    }
  }
  let liste = [...plan.stats.entries()].filter(([rel, s]) => s.n > 0 && plan.dossiers.get(rel)?.parent);
  const total = liste.length;
  if (liste.length > MAX_DOSSIERS_IA) {
    const prof = (rel) => rel.split('/').length;
    liste = liste.sort((a, b) => prof(a[0]) - prof(b[0]) || b[1].n - a[1].n).slice(0, MAX_DOSSIERS_IA);
  }
  liste.sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  const exemples = new Map();
  for (const f of plan.fichiers) { const l = exemples.get(f.dossier) ?? []; if (l.length < 4) l.push(f.nom.slice(0, 60)); exemples.set(f.dossier, l); }
  return {
    drive: plan.racines.join(' et '), aujourd_hui: aujourdhui(), partiel: plan.texte_partiel,
    dossiers: liste.map(([rel, s]) => ({chemin: rel, videos: s.videos, photos: s.photos, sons: s.sons, dans_ce_dossier: s.ici, go: Math.round((s.taille / 1e9) * 10) / 10,
      jours: jours.get(rel) ? (jours.get(rel).du === jours.get(rel).au ? jours.get(rel).du : `du ${jours.get(rel).du} au ${jours.get(rel).au}`) : null,
      sous_dossiers: plan.enfants.get(rel)?.length ?? 0, exemples: exemples.get(rel) ?? []})),
    ...(total > liste.length ? {autres_dossiers_non_montres: total - liste.length} : {}),
  };
}
/** Un chemin rendu par l'IA, retrouvé dans le plan (elle oublie parfois « Mon Drive/ » devant). */
function dossierConnu(plan, x) {
  const c = String(x ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (plan.dossiers.has(c)) return c;
  for (const r of plan.racines) if (plan.dossiers.has(`${r}/${c}`)) return `${r}/${c}`;
  return null;
}

const texteSur = (d) => (d.source === 'nom' ? 'nom du fichier' : d.source === 'fichier' ? 'date du fichier'
  : d.sur === 'connu' || d.sur === 'local' ? 'prise' : d.sur === 'deduit' ? 'prise, fuseau déduit' : 'prise, fuseau inconnu');
/** La liste des fichiers que l'IA reçoit pour choisir (un fichier par ligne : elle se lit par morceaux). */
function fichiersPourIA(r, liste, ids) {
  const jours = parJour(liste).map((j) => ({jour: j.nom, date: j.jour, videos: j.videos, photos: j.photos, sons: j.sons, mo: Math.round(j.taille / 1e6)}));
  const lignes = [...ids.entries()].map(([id, f]) => JSON.stringify({id, dossier: f.dossier, nom: f.nom, genre: f.genre,
    quand: `${f.date.heure ? f.date.local.slice(0, 16).replace('T', ' ') : f.date.local.slice(0, 10)} ${f.date.fuseau}`, jour: nomJour(f.date.jour), sur: texteSur(f.date),
    ...(f.date.duree ? {duree_s: f.date.duree} : {}), mo: Math.round(f.taille / 1e5) / 10, ...(f.date.gps ? {gps: f.date.gps} : {})}));
  return `{"demande": ${JSON.stringify(r.demande)},\n"aujourd_hui": ${JSON.stringify(aujourdhui())},\n"dossiers": ${JSON.stringify(r.dossiers)},\n"jours": ${JSON.stringify(jours)},\n"fichiers": [\n${lignes.join(',\n')}\n]}\n`;
}

/** « 4 vidéos, 1 photo et 1 son du vendredi 8 novembre, Kyoto, 1,2 Go ». */
export function phraseDuChoix(liste, lieu = null) {
  const n = {video: 0, photo: 0, son: 0};
  let taille = 0;
  for (const f of liste) { n[f.genre]++; taille += f.taille; }
  const morceaux = [n.video && pluriel(n.video, 'vidéo'), n.photo && pluriel(n.photo, 'photo'), n.son && pluriel(n.son, 'son')].filter(Boolean);
  const comptes = morceaux.length > 1 ? `${morceaux.slice(0, -1).join(', ')} et ${morceaux.at(-1)}` : morceaux[0] ?? 'aucun fichier';
  const jours = [...new Set(liste.map((f) => f.date.jour))].sort();
  const quand = !jours.length ? '' : jours.length === 1 ? ` du ${nomJour(jours[0], {annee: false})}`
    : ` du ${nomJour(jours[0], {annee: false, semaine: false})} au ${nomJour(jours.at(-1), {annee: false, semaine: false})}`;
  return `${comptes}${quand}${lieu ? `, ${lieu}` : ''}, ${tailleLisible(taille)}`;
}
function choixDe(liste, rep = {}) {
  const tries = trierChrono(liste);
  const enLigne = tries.filter((f) => f.local === false);
  return {fichiers: tries.map(vueFichier), n: tries.length, taille: tries.reduce((a, f) => a + f.taille, 0),
    videos: tries.filter((f) => f.genre === 'video').length, photos: tries.filter((f) => f.genre === 'photo').length, sons: tries.filter((f) => f.genre === 'son').length,
    en_ligne: {n: enLigne.length, taille: enLigne.reduce((a, f) => a + f.taille, 0)}, jours: parJour(tries),
    lieu: rep.lieu ?? null, phrase: rep.phrase ?? null, resume: phraseDuChoix(tries, rep.lieu)};
}

// ——— 2 à 4. la recherche (suivie par sondage) ———
let RECHERCHE = null;
const EN_ROUTE = new Set(['plan', 'ia_dossiers', 'a_confirmer', 'dates', 'ia_fichiers']);
const QUI_TOURNE = new Set(['plan', 'ia_dossiers', 'dates', 'ia_fichiers']); // « a_confirmer » attend la personne : rien ne tourne
const ETAPES = {
  plan: 'Dérush parcourt ton Drive : les noms, les tailles et les dates des fichiers, sans rien télécharger',
  dates: 'Dérush lit le jour et l’heure de chaque prise',
};
export const rechercheEnCours = () => !!RECHERCHE && QUI_TOURNE.has(RECHERCHE.etat);

/**
 * Lance une recherche. Rend la main tout de suite ; suivre avec etatRecherche().
 *  demande  ce que la personne a écrit (« prends les vidéos de mon séjour au Japon et fais-moi un vlog du vendredi »)
 *  precision sa réponse à une question de l'IA
 *  dossiers + sansIA : le choix à la main (lire les vraies dates de ces dossiers, sans IA)
 */
export function lancerRecherche({demande = '', precision = '', dossiers = null, sansIA = false, moteur = null} = {}) {
  if (!dossiersDrive()) throw new ErreurDrive(409, aideInstallationDrive().texte);
  if (rechercheEnCours()) throw new ErreurDrive(409, 'Une recherche dans ton Drive est déjà en cours : attends-la, ou arrête-la.');
  // une recherche qui attendait la réponse de la personne : elle a écrit autre chose, la nouvelle remplace l'ancienne
  if (RECHERCHE?.etat === 'a_confirmer') arreterRecherche();
  const r = {etat: 'plan', demande: court(demande, 1200), precision: court(precision, 600), sansIA: !!sansIA, moteur: ['claude', 'codex', 'gemini'].includes(moteur) ? moteur : null,
    debut: Date.now(), fin: null, etape: ETAPES.plan, progression: null, dossiers: [], pourquoi: null, confirmer: null, choix: null, question: null,
    erreur: null, nom_ia: null, annule: false, attente: null, dates_partielles: false};
  if (r.sansIA) {
    if (!Array.isArray(dossiers) || !dossiers.length) throw new ErreurDrive(400, 'Choisis au moins un dossier.');
    r.dossiersDemandes = dossiers.slice(0, 30).map(String);
  } else if (!r.demande) throw new ErreurDrive(400, 'Écris ce que tu cherches dans ton Drive (par exemple : « les vidéos de mon séjour au Japon, le vendredi »).');
  RECHERCHE = r;
  deroulerRecherche(r).catch((e) => {
    if (r.annule) r.etat = 'arrete';
    else { r.etat = 'erreur'; r.erreur = e?.message ?? String(e); }
  }).finally(() => { r.fin = Date.now(); r.attente = null; r.etape = null; r.progression = r.etat === 'pret' || r.etat === 'dates_lues' ? r.progression : null; });
  return etatRecherche();
}

async function deroulerRecherche(r) {
  const verifier = () => { if (r.annule) throw new Error('Arrêté.'); };
  const plan = await planDuDrive();
  verifier();
  if (!plan) throw new Error(aideInstallationDrive().texte);
  if (r.sansIA) {
    r.dossiers = [...new Set(r.dossiersDemandes.map((x) => dossierConnu(plan, x)).filter(Boolean))];
    if (!r.dossiers.length) throw new Error('Ce dossier n’est pas (ou plus) dans ton Drive.');
  } else {
    if (!plan.fichiers.length) { r.etat = 'question'; r.question = 'Dérush ne trouve aucune vidéo, aucune photo et aucun son dans ton Drive. Sont-ils rangés ailleurs ?'; return; }
    r.etat = 'ia_dossiers';
    r.etape = 'L’IA regarde le plan de ton Drive et choisit les dossiers';
    fs.rmSync(dossierIA(), {recursive: true, force: true});
    fs.mkdirSync(dossierIA(), {recursive: true});
    ecrireJson(path.join(dossierIA(), 'arborescence.json'), planPourIA(plan));
    const rep = await demanderIA(r, {
      systeme: REGLES_DOSSIERS,
      consigne: `Demande de la personne : « ${r.demande} »${r.precision ? `\nSa précision : « ${r.precision} »` : ''}\nNous sommes le ${aujourdhui()}.\nLis arborescence.json, choisis les dossiers, et écris reponse.json.`,
      valider: (x) => {
        const ds = [...new Set((Array.isArray(x?.dossiers) ? x.dossiers : []).map((c) => dossierConnu(plan, c)).filter(Boolean))];
        // un dossier et son parent : le parent suffit
        const uniques = ds.filter((c) => !ds.some((y) => y !== c && c.startsWith(`${y}/`))).slice(0, 30);
        if (!uniques.length && !court(x?.question, 300)) throw new Error('L’IA n’a choisi aucun dossier de ton Drive. Réessaie, ou dis-le autrement.');
        return {dossiers: uniques, pourquoi: court(x?.pourquoi, 300), question: uniques.length ? null : court(x?.question, 300)};
      },
    });
    verifier();
    r.nom_ia = rep.moteur;
    if (!rep.dossiers.length) { r.etat = 'question'; r.question = rep.question; return; }
    r.dossiers = rep.dossiers;
    r.pourquoi = rep.pourquoi;
  }
  const choisis = [...new Map(r.dossiers.flatMap((dos) => fichiersSous(plan, dos)).map((f) => [f.rel, f])).values()];
  if (!choisis.length) { r.etat = 'question'; r.question = 'Ces dossiers ne contiennent ni vidéo, ni photo, ni son. Où sont tes rushes ?'; return; }
  if (choisis.length > MAX_FICHIERS_DATES) {
    r.etat = 'question';
    r.question = `Ces dossiers contiennent ${choisis.length} fichiers : c’est trop pour les passer en revue d’un coup. Précise un lieu, un jour ou un dossier plus petit.`;
    return;
  }

  // 3. les vraies dates : ce qui n'est que sur le Drive se télécharge en les lisant, la personne dit oui avant
  const cache = cacheDates();
  const aDater = choisis.filter((f) => aLire(f) && !cache[cleDate(f)]);
  const enLigne = aDater.filter((f) => f.local === false);
  let lireEnLigne = true;
  if (enLigne.length) {
    const taille = enLigne.reduce((a, f) => a + f.taille, 0);
    r.etat = 'a_confirmer';
    r.etape = null;
    r.confirmer = {fichiers: aDater.length, en_ligne: enLigne.length, taille_en_ligne: taille, sur_ordinateur: aDater.length - enLigne.length,
      texte: enLigne.length > 1
        ? `${enLigne.length} fichiers ne sont que sur le Drive (${tailleLisible(taille)}). Pour lire leur jour et leur heure de prise de vue, Google Drive va les télécharger : au moins leur début, parfois en entier. Sinon, Dérush se fie à leurs noms et aux dates des fichiers, moins sûres.`
        : `1 fichier n’est que sur le Drive (${tailleLisible(taille)}). Pour lire son jour et son heure de prise de vue, Google Drive va le télécharger : au moins son début, parfois en entier. Sinon, Dérush se fie à son nom et à la date du fichier, moins sûrs.`};
    lireEnLigne = await new Promise((ok) => { r.attente = ok; });
    r.attente = null;
    verifier();
    r.confirmer = null;
  }
  r.etat = 'dates';
  r.etape = ETAPES.dates;
  const liste = aDater.filter((f) => lireEnLigne || f.local !== false);
  r.progression = {fait: 0, total: liste.length};
  const limite = Date.now() + DUREE_MAX_DATES;
  let nouveaux = 0;
  await enParallele(liste, LECTURES_EN_MEME_TEMPS, async (f) => {
    if (r.annule || Date.now() > limite) return;
    const p = await lirePrise(f.abs, f.genre).catch(() => null);
    if (p) { cache[cleDate(f)] = {...p, t: Date.now()}; nouveaux++; }
    r.progression.fait++;
  });
  if (nouveaux) sauverDates();
  verifier();
  r.dates_partielles = Date.now() > limite;
  resoudreDates(choisis);
  if (r.sansIA) {
    r.etat = 'dates_lues';
    r.choix = choixDe(choisis);
    return;
  }

  // 4. l'IA choisit les fichiers
  r.etat = 'ia_fichiers';
  r.etape = 'L’IA choisit les fichiers qui vont avec ta demande';
  r.progression = null;
  const tries = trierChrono(choisis);
  const ids = new Map(tries.map((f, k) => [`F${k + 1}`, f]));
  fs.writeFileSync(path.join(dossierIA(), 'fichiers.json'), fichiersPourIA(r, tries, ids));
  const rep = await demanderIA(r, {
    systeme: REGLES_FICHIERS,
    consigne: `Demande de la personne : « ${r.demande} »${r.precision ? `\nSa précision : « ${r.precision} »` : ''}\nNous sommes le ${aujourdhui()}.\nLis fichiers.json, choisis les fichiers, et écris reponse.json.`,
    valider: (x) => {
      const pris = [...new Set((Array.isArray(x?.fichiers) ? x.fichiers : []).map((id) => String(id).trim()).filter((id) => ids.has(id)))];
      if (!pris.length && !court(x?.question, 300)) throw new Error('L’IA n’a choisi aucun fichier. Réessaie, ou dis-le autrement.');
      return {ids: pris, lieu: court(x?.lieu, 40), phrase: court(x?.phrase, 300), question: pris.length ? null : court(x?.question, 300)};
    },
  });
  verifier();
  r.nom_ia = rep.moteur;
  if (!rep.ids.length) { r.etat = 'question'; r.question = rep.question; return; }
  r.choix = choixDe(rep.ids.map((id) => ids.get(id)), rep);
  r.etat = 'pret';
}

/** Où en est la recherche (pour l'interface). */
/** Ce qui part chez l'IA légère, dit sous « Chercher » avant toute recherche (et dans chaque état). */
const A_SAVOIR = 'Dérush envoie à ton IA le plan de ton Drive (les noms des dossiers et des fichiers, leur nombre, leurs dates), jamais les fichiers eux-mêmes.';
export function etatRecherche() {
  const r = RECHERCHE;
  if (!r) return {etat: 'aucune', a_savoir: A_SAVOIR};
  const c = ['ia_dossiers', 'ia_fichiers'].includes(r.etat) ? etatConseil(CLE_IA) : null;
  return {etat: r.etat, demande: r.demande, precision: r.precision, sans_ia: r.sansIA, depuis_s: Math.round(((r.fin ?? Date.now()) - r.debut) / 1000),
    etape: c?.etapes?.at(-1)?.texte ?? r.etape, progression: r.progression, dossiers: r.dossiers, pourquoi: r.pourquoi, confirmer: r.confirmer,
    choix: r.choix, question: r.question, erreur: r.erreur, dates_partielles: r.dates_partielles, nom_ia: c?.nom_ia ?? r.nom_ia ?? null,
    // ce que la personne doit savoir avant de cliquer « Chercher » : ce qui part à l'IA, et ce qui n'y part pas
    a_savoir: A_SAVOIR};
}
/** « Lire les dates » (true) ou « Se fier aux noms et aux dates des fichiers » (false), quand la recherche le demande. */
export function continuerRecherche(lire) {
  const r = RECHERCHE;
  if (!r || r.etat !== 'a_confirmer' || !r.attente) throw new ErreurDrive(409, 'Aucune recherche n’attend ta réponse.');
  r.attente(lire !== false);
  return etatRecherche();
}
export function arreterRecherche() {
  const r = RECHERCHE;
  if (!r || !EN_ROUTE.has(r.etat)) return false;
  r.annule = true;
  r.etat = 'arrete';
  arreterConseil(CLE_IA);
  r.attente?.(false);
  return true;
}
export function oublierRecherche() {
  if (rechercheEnCours()) return;
  if (RECHERCHE?.etat === 'a_confirmer') arreterRecherche();
  RECHERCHE = null;
}

// ——— 5. l'import dans le projet ———
let IMPORT = null;
export const importEnCours = () => IMPORT?.etat === 'en_cours';
/** Un travail du Drive en cours (la recherche, ou un import) : Dérush ne se met pas à jour, ne ferme rien. */
export const driveOccupe = () => rechercheEnCours() || importEnCours();
const registreDe = (P) => path.join(P.cache, 'drive-imports.json');

/** Un fichier hors du plan (un Drive trop grand pour être parcouru en entier) : retrouvé par son chemin, sans en sortir. */
function entreeHorsPlan(plan, rel) {
  const morceaux = String(rel).split('/');
  if (morceaux.length < 2 || morceaux.some((m) => !m || m === '.' || m === '..' || /[\\\0]/.test(m))) return null;
  const racine = plan.racinesAbs.find((x) => x.nom === morceaux[0]);
  if (!racine) return null;
  const abs = path.join(racine.abs, ...morceaux.slice(1));
  try {
    if (!dedans(plan.enceinte, fs.realpathSync(abs))) return null;
    const st = fs.statSync(abs);
    const genre = genreDe(abs);
    if (!st.isFile() || !genre) return null;
    const lu = surLeDriveSeulement(st);
    return {abs, rel: morceaux.join('/'), dossier: morceaux.slice(0, -1).join('/'), nom: morceaux.at(-1), genre, taille: st.size, modifie: st.mtimeMs, local: lu == null ? null : !lu, nom_date: dateDuNom(morceaux.at(-1))};
  } catch { return null; }
}
async function entreesDe(rels) {
  if (!dossiersDrive()) throw new ErreurDrive(409, aideInstallationDrive().texte);
  if (!Array.isArray(rels) || !rels.length) throw new ErreurDrive(400, 'Choisis au moins un fichier.');
  const uniques = [...new Set(rels.map(String))];
  if (uniques.length > MAX_IMPORT) throw new ErreurDrive(400, `${MAX_IMPORT} fichiers au plus par import : choisis-en une partie.`);
  const plan = await planDuDrive();
  const liste = [];
  const manquants = [];
  for (const rel of uniques) {
    const f = plan.parRel.get(rel) ?? entreeHorsPlan(plan, rel);
    if (f) liste.push(f); else manquants.push(path.basename(rel));
  }
  if (manquants.length) throw new ErreurDrive(404, `${pluriel(manquants.length, 'fichier est introuvable', 'fichiers sont introuvables')} dans ton Drive : ${manquants.slice(0, 3).join(', ')}${manquants.length > 3 ? '…' : ''}`);
  return trierChrono(resoudreDates(liste));
}
/** Déjà importé dans ce projet (le même fichier du Drive, la même taille, la même date) et toujours là ? */
function dejaImporte(P, reg, f) {
  const nom = reg[cleDate(f)];
  if (!nom) return null;
  const chemin = path.resolve(P.racine, 'rushes', nom);
  return P.d.medias.find((m) => m.chemin === chemin) && fs.existsSync(chemin) ? chemin : null;
}

/**
 * Ce qui va se passer si la personne clique « Importer » : combien de fichiers, combien de Go, ce qui doit encore être
 * téléchargé, et la place qui restera. `lire` : la place libre (pour les essais).
 */
export async function apercuImport(P, rels, {lire = placeLibre} = {}) {
  return (await preparerImport(P, rels, lire)).apercu;
}
async function preparerImport(P, rels, lire) {
  const liste = await entreesDe(rels);
  const reg = lireJson(registreDe(P)) ?? {};
  const nouveaux = liste.filter((f) => !dejaImporte(P, reg, f));
  const taille = nouveaux.reduce((a, f) => a + f.taille, 0);
  const enLigne = nouveaux.filter((f) => f.local === false);
  const tailleEnLigne = enLigne.reduce((a, f) => a + f.taille, 0);
  const libre = lire(P.racine);
  const reste = libre == null ? null : libre - taille;
  const ok = reste == null || reste >= PLACE_MINI;
  // Google Drive garde aussi sa copie de ce qu'il télécharge, souvent sur le même disque
  const prevenir = ok && reste != null && reste - tailleEnLigne < PLACE_CONFORT;
  // la règle : il doit RESTER 1,5 Go après l'import (« Il faut 5 Mo et il ne reste que 338 Mo » se contredisait)
  const texte = !ok ? `Il doit rester au moins ${(PLACE_MINI / GO).toFixed(1).replace('.', ',')} Go sur le disque du projet après l’import : il en reste ${tailleLisible(libre)}, et ces fichiers prennent ${tailleLisible(taille)}. Libère de la place, ou choisis moins de fichiers.`
    : prevenir ? `Il ne restera que ${tailleLisible(Math.max(0, reste - tailleEnLigne))} environ sur le disque${tailleEnLigne ? ' (Google Drive garde aussi une copie de ce qu’il télécharge)' : ''} : le montage peut manquer de place.`
      : null;
  return {liste, apercu: {n: liste.length, nouveaux: nouveaux.length, deja: liste.length - nouveaux.length, taille, en_ligne: {n: enLigne.length, taille: tailleEnLigne},
    libre, ok, prevenir, texte, resume: `${pluriel(nouveaux.length, 'fichier')} à importer, ${tailleLisible(taille)}${enLigne.length ? `, dont ${tailleLisible(tailleEnLigne)} à télécharger depuis le Drive` : ''}`}};
}

/** Un nom de fichier sûr et libre dans un dossier. */
function nomLibre(dossier, nom) {
  const propre = path.basename(nom).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180) || 'rush';
  const {name, ext} = path.parse(propre);
  let essai = propre;
  for (let k = 2; fs.existsSync(path.join(dossier, essai)) || fs.existsSync(path.join(dossier, `${essai}.derush-part`)); k++) essai = `${name}-${k}${ext}`;
  return path.join(dossier, essai);
}

/** Copie avec suivi des octets ; s'arrête si Google Drive n'envoie plus rien pendant 3 minutes. */
async function copierAvecSuivi(src, dst, suivi, job) {
  let n = 0;
  let dernier = Date.now();
  const lire = fs.createReadStream(src, {highWaterMark: 4 << 20});
  const compter = new Transform({transform(morceau, _e, fini) { n += morceau.length; dernier = Date.now(); suivi(n); fini(null, morceau); }});
  const garde = setInterval(() => { if (Date.now() - dernier > SILENCE_MAX_COPIE) lire.destroy(new Error('Google Drive n’envoie plus rien depuis 3 minutes (connexion coupée ?).')); }, 5000);
  job.couper = () => lire.destroy(new Error('Arrêté.'));
  try {
    await pipeline(lire, compter, fs.createWriteStream(dst));
  } finally {
    clearInterval(garde);
    job.couper = null;
  }
}

/**
 * Importe des fichiers du Drive dans le projet (après le clic de la personne) : vérifie la place, copie (ou clone)
 * chaque fichier dans rushes/, puis l'ajoute aux médias comme un import normal (sonde, première image, préparation),
 * dans l'ordre de prise de vue. Rend la main tout de suite ; suivre avec etatImport().
 */
export async function lancerImport(P, rels, file, {lire = placeLibre, encoreOuvert = () => true} = {}) {
  if (importEnCours()) throw new ErreurDrive(409, 'Un import depuis ton Drive est déjà en cours : attends-le, ou arrête-le.');
  const {apercu: a, liste} = await preparerImport(P, rels, lire);
  if (!a.ok) throw new ErreurDrive(507, a.texte);
  if (importEnCours()) throw new ErreurDrive(409, 'Un import depuis ton Drive est déjà en cours : attends-le, ou arrête-le.');
  const job = {etat: 'en_cours', projet: P.racine, n: liste.length, fait: 0, deja: 0, ajoutes: [], erreurs: [], octets: 0, taille: a.taille, fichier: null,
    debut: Date.now(), fin: null, annule: false, couper: null, prevenir: a.texte, encoreOuvert};
  IMPORT = job;
  deroulerImport(P, liste, file, job).catch((e) => { job.erreurs.push(e.message); job.etat = 'erreur'; })
    .finally(() => { job.fin = Date.now(); job.fichier = null; if (job.etat === 'en_cours') job.etat = job.annule ? 'arrete' : 'fini'; });
  return etatImport();
}

async function deroulerImport(P, liste, file, job) {
  const dossier = path.join(P.racine, 'rushes');
  fs.mkdirSync(dossier, {recursive: true});
  const reg = lireJson(registreDe(P)) ?? {};
  for (const f of liste) {
    if (job.annule) break;
    // le projet a été fermé (ou rouvert : un autre objet le porte) : on n'y écrit plus
    if (!job.encoreOuvert()) { job.erreurs.push('Le projet a été fermé : l’import s’est arrêté. Ce qui était déjà importé y reste.'); job.etat = 'erreur'; return; }
    job.fichier = f.nom;
    if (dejaImporte(P, reg, f)) { job.deja++; job.fait++; continue; }
    const cible = nomLibre(dossier, f.nom);
    const part = `${cible}.derush-part`;
    const avant = job.octets;
    try {
      // un clone (instantané, sans place prise) seulement pour un fichier déjà sur l'ordinateur ; ce qui n'est que sur
      // le Drive passe par une copie suivie, pour voir le téléchargement avancer
      let fait = false;
      if (f.local !== false) fait = await cloner(f.abs, part);
      if (!fait) await copierAvecSuivi(f.abs, part, (n) => { job.octets = avant + n; }, job);
      fs.renameSync(part, cible);
      try { fs.utimesSync(cible, new Date(), new Date(f.modifie)); } catch { /* la date d'origine n'est qu'un plus */ }
    } catch (e) {
      fs.rmSync(part, {force: true});
      if (job.annule) break;
      if (['ENOSPC', 'EDQUOT'].includes(e?.code)) { job.erreurs.push(`Le disque est plein : l’import s’arrête (${pluriel(job.ajoutes.length, 'fichier importé', 'fichiers importés')}).`); job.etat = 'erreur'; return; }
      job.erreurs.push(`${f.nom} : ${e?.code === 'ENOENT' ? 'il n’est plus dans le Drive' : e.message}`);
      job.octets = avant + f.taille;
      job.fait++;
      continue;
    }
    job.octets = avant + f.taille;
    if (!job.encoreOuvert()) { fs.rmSync(cible, {force: true}); job.erreurs.push('Le projet a été fermé : l’import s’est arrêté. Ce qui était déjà importé y reste.'); job.etat = 'erreur'; return; }
    const r = await ajouterMedias(P, [cible], file);
    if (r.erreurs.length || !r.ajoutes.length) {
      fs.rmSync(cible, {force: true});
      job.erreurs.push(r.erreurs[0] ?? `${f.nom} : illisible`);
    } else {
      reg[cleDate(f)] = path.basename(cible);
      try { ecrireJson(registreDe(P), reg); } catch { /* le registre évite seulement un double import */ }
      job.ajoutes.push(r.ajoutes[0]);
    }
    job.fait++;
  }
}

export function etatImport() {
  const j = IMPORT;
  if (!j) return {etat: 'aucun'};
  return {etat: j.etat, projet: path.basename(j.projet), n: j.n, fait: j.fait, deja: j.deja, ajoutes: j.ajoutes, erreurs: j.erreurs.slice(0, 50), octets: j.octets, taille: j.taille,
    progression: j.taille ? Math.min(1, j.octets / j.taille) : j.n ? j.fait / j.n : 1, fichier: j.fichier, depuis_s: Math.round(((j.fin ?? Date.now()) - j.debut) / 1000), prevenir: j.prevenir,
    texte: j.etat === 'en_cours' ? `${j.fait} sur ${j.n}${j.fichier ? ` : ${j.fichier}` : ''}`
      : `${pluriel(j.ajoutes.length, 'fichier importé', 'fichiers importés')}${j.deja ? `, ${j.deja} déjà là` : ''}${j.erreurs.length ? `, ${pluriel(j.erreurs.length, 'problème')}` : ''}.`};
}
export function arreterImport() {
  if (!importEnCours()) return false;
  IMPORT.annule = true;
  IMPORT.couper?.();
  return true;
}
/** À la fermeture de Dérush : la recherche et l'import s'arrêtent (rien n'est laissé à moitié dans le projet). */
export function arreterDrive() { arreterRecherche(); arreterImport(); }

/** Le message de la personne parle-t-il d'aller chercher des rushes dans son Drive ? Une seule règle, partagée avec l'interface. */
export {parleDuDrive} from './commun.mjs';

// ——— les routes (branchées par lib/serveur.mjs) ———
/**
 * Les routes de « Depuis mon Drive ». Rend true si elle a répondu.
 *  GET  /api/drive/medias?dossier=…&jour=AAAA-MM-JJ&rafraichir=1   parcourir le Drive à la main (sans dossier : les racines)
 *  POST /api/drive/chercher {demande, precision?, moteur?}          la recherche par l'IA ; ou {dossiers: […], sans_ia: true}
 *  GET  /api/drive/chercher                                         où elle en est (sondage)
 *  POST /api/drive/chercher/continuer {lire}                        réponse à « a_confirmer » (lire les dates ou non)
 *  POST /api/drive/chercher/arreter, /api/drive/chercher/oublier
 *  POST /api/drive/importer/apercu {fichiers: [rel…]}               ce qui va se passer (fichiers, Go, place)
 *  POST /api/drive/importer {fichiers: [rel…]}                      l'import dans le projet ouvert
 *  GET  /api/drive/importer                                         où il en est (sondage)
 *  POST /api/drive/importer/arreter
 */
export async function routesDrive(req, res, p, url, ctx, {envoyerJson, lireCorps, ErreurHttp, projet}) {
  if (!p.startsWith('/api/drive/')) return false;
  const M = req.method;
  const corps = async () => { const c = await lireCorps(req); return c && typeof c === 'object' && !Array.isArray(c) ? c : {}; };
  try {
    if (M === 'GET' && p === '/api/drive/medias') {
      const s = url.searchParams;
      envoyerJson(res, 200, await listerDrive({dossier: s.get('dossier') ?? '', jour: s.get('jour') || null, rafraichir: s.get('rafraichir') === '1'}));
      return true;
    }
    if (p === '/api/drive/chercher' && M === 'GET') { envoyerJson(res, 200, etatRecherche()); return true; }
    if (p === '/api/drive/chercher' && M === 'POST') {
      const c = await corps();
      envoyerJson(res, 200, lancerRecherche({demande: c.demande, precision: c.precision, dossiers: c.dossiers, sansIA: c.sans_ia === true, moteur: c.moteur}));
      return true;
    }
    if (p === '/api/drive/chercher/continuer' && M === 'POST') { const c = await corps(); envoyerJson(res, 200, continuerRecherche(c.lire !== false)); return true; }
    if (p === '/api/drive/chercher/arreter' && M === 'POST') { envoyerJson(res, 200, {ok: arreterRecherche()}); return true; }
    if (p === '/api/drive/chercher/oublier' && M === 'POST') { oublierRecherche(); envoyerJson(res, 200, {ok: true}); return true; }
    if (p === '/api/drive/importer/apercu' && M === 'POST') { const c = await corps(); envoyerJson(res, 200, await apercuImport(projet(), c.fichiers)); return true; }
    if (p === '/api/drive/importer' && M === 'GET') { envoyerJson(res, 200, etatImport()); return true; }
    if (p === '/api/drive/importer' && M === 'POST') {
      const c = await corps();
      const P = projet();
      envoyerJson(res, 200, await lancerImport(P, c.fichiers, ctx?.file, {encoreOuvert: () => !ctx || ctx.P === P}));
      return true;
    }
    if (p === '/api/drive/importer/arreter' && M === 'POST') { envoyerJson(res, 200, {ok: arreterImport()}); return true; }
  } catch (e) {
    if (e instanceof ErreurDrive) throw new ErreurHttp(e.code, e.message);
    throw e;
  }
  return false;
}
