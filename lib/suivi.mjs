// Dérush — le suivi des vues : ce que deviennent les vidéos publiées, relu à J+1, J+7 et J+30.
//
// Chaque publication (faite par l'IA avec Treg, ou liée à la main par son lien) est rangée dans l'espace de son projet
// (espaces/<id>/suivi.json), rattachée à la fiche de son montage. Dérush relit ses chiffres par la porte directe de
// Treg (https://treg.to/call/…, avec la clé Treg de la personne, en LECTURE seulement : aucune écriture sur aucun
// compte) : YouTube (vues, j'aime, commentaires) et TikTok (vues, j'aime, commentaires, partages, sur les dernières
// vidéos du compte relié à Treg). Instagram ne passe pas par là : l'IA peut le relire à la demande (avec Treg).
// LinkedIn est rangé avec la fiche, mais ses chiffres ne sont pas relus.
//
// Les vues brutes ne disent rien seules : elles dépendent de la taille du compte. Chaque vidéo est comparée à la
// MÉDIANE des vues de son compte (ses vidéos récentes) : son « multiple ». 3 fois la médiane, c'est un vrai succès ;
// sous 0,5, elle a moins marché que d'habitude (même règle que le profil du créateur, competences/derush-createur).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import {DOSSIER_ESPACES, lireEspaces, apprend} from './espaces.mjs';

export const JOURS = [1, 7, 30];
export const BASE_TREG = (process.env.DERUSH_TREG_BASE || 'https://treg.to').replace(/\/+$/, '');
const JOUR_MS = 86400e3;
const fichier = (id) => path.join(DOSSIER_ESPACES, id, 'suivi.json');
const vide = () => ({v: 1, publications: {}, medianes: {}});
// « null », rien ou un texte vide : on ne sait pas. Number(null) vaut 0, et « 0 vue » n'est pas « pas lu ».
const nombre = (v) => { if (typeof v !== 'number' && (typeof v !== 'string' || !v.trim())) return null; const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : null; };

/** Un lien tel qu'on le garde : une adresse https entière, 400 signes au plus (sinon null). */
export function lienPropre(lien) {
  if (typeof lien !== 'string' || !lien.trim()) return null;
  try { const u = new URL(lien.trim()); return u.protocol === 'https:' && u.href.length <= 400 ? u.href : null; } catch { return null; }
}
/** L'adresse lue (https seulement) et son site sans « www. » ni « m. », ou null. */
function adresse(lien) {
  let u;
  try { u = new URL(String(lien ?? '').trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const h = u.hostname.replace(/^(?:www|m)\./, '');
  // le site lui-même ou l'un de ses sous-domaines : « fauxyoutube.com » n'est pas YouTube
  return {u, h, est: (d) => h === d || h.endsWith(`.${d}`)};
}

/**
 * Le réseau et l'identifiant d'une vidéo d'après son lien (null si on ne le reconnaît pas). Un lien TikTok doit dire
 * quelle vidéo c'est (…/video/123…) : le lien court de l'app (vm.tiktok.com/…, tiktok.com/t/…), un compte ou une
 * publication photo ne se retrouvent jamais dans la liste lue chez Treg (voir raisonLienRefuse).
 */
export function idDepuisLien(lien) {
  const a = adresse(lien);
  if (!a) return null;
  const {u, h, est} = a;
  if (h === 'youtu.be') { const id = u.pathname.slice(1).split('/')[0]; return /^[\w-]{6,20}$/.test(id) ? {reseau: 'youtube', id} : null; }
  if (est('youtube.com')) {
    const v = u.searchParams.get('v');
    const m = /^\/(?:shorts|embed|live)\/([\w-]{6,20})/.exec(u.pathname);
    const id = v ?? m?.[1];
    return id && /^[\w-]{6,20}$/.test(id) ? {reseau: 'youtube', id} : null;
  }
  if (est('tiktok.com')) { const m = /\/video\/(\d{6,25})/.exec(u.pathname); return m ? {reseau: 'tiktok', id: m[1]} : null; }
  if (est('instagram.com')) { const m = /^\/(?:[\w.]{1,30}\/)?(?:reel|reels|p|tv)\/([\w-]{5,40})/.exec(u.pathname); return m ? {reseau: 'instagram', id: m[1]} : null; }
  if (est('linkedin.com')) return {reseau: 'linkedin', id: null};
  return null;
}

/** Pourquoi un lien n'est pas suivi, en une phrase pour la personne (quand idDepuisLien ne rend rien). */
export function raisonLienRefuse(lien) {
  const a = adresse(lien);
  if (a?.est('tiktok.com')) {
    if (/^\/@[^/]+\/?$/.test(a.u.pathname)) return 'Ce lien est celui d’un compte TikTok : ouvre la vidéo, puis copie son lien.';
    if (/\/photo\//.test(a.u.pathname)) return 'Ce lien est celui d’une publication photo : Dérush ne suit que les vidéos.';
    return 'Ce lien court de TikTok ne dit pas quelle vidéo c’est : ouvre la vidéo sur tiktok.com et copie son adresse complète (elle contient « /video/ » suivi de chiffres).';
  }
  return 'Ce lien n’est pas celui d’une vidéo YouTube, TikTok, Instagram ou LinkedIn.';
}

export function lireSuivi(id) {
  try { const d = JSON.parse(fs.readFileSync(fichier(id), 'utf8')); return {...vide(), ...d, publications: d.publications ?? {}, medianes: d.medianes ?? {}}; } catch { return vide(); }
}
function ecrireSuivi(id, d) {
  fs.mkdirSync(path.dirname(fichier(id)), {recursive: true});
  const tmp = `${fichier(id)}.part`;
  fs.writeFileSync(tmp, JSON.stringify(d, null, 1));
  fs.renameSync(tmp, fichier(id));
}

/**
 * Range une publication à suivre : {reseau, lien, id?, cle_fiche?, titre?, projet?, publie_le?}. Une publication
 * déjà connue (même réseau, même vidéo) est mise à jour, jamais doublée. Renvoie sa clé, ou null.
 * `suivi` dit qui relit ses chiffres : « treg » (YouTube, TikTok), « ia » (Instagram, à la demande), « aucun » (LinkedIn).
 */
export function enregistrerPublication(espaceId, p) {
  const e = lireEspaces().espaces.find((x) => x.id === espaceId);
  if (!apprend(e)) return null;
  const lu = idDepuisLien(p.lien);
  const reseau = p.reseau ?? lu?.reseau;
  if (typeof reseau !== 'string' || !/^[a-z]{2,20}$/.test(reseau)) return null;
  const id = p.id ?? lu?.id ?? null;
  const lien = lienPropre(p.lien);
  // un brouillon (TikTok, publié ensuite depuis l'app) n'a ni lien ni identifiant : sa clé vient de sa fiche
  const date = Date.parse(p.publie_le ?? '');
  const cle = `${reseau}:${id ?? lien ?? `brouillon-${p.cle_fiche ?? (Number.isFinite(date) ? date : Date.now())}`}`;
  const d = lireSuivi(espaceId);
  let avant = Object.hasOwn(d.publications, cle) ? d.publications[cle] : null;
  // La même vidéo, déjà suivie sous une autre clé : le brouillon envoyé par l'IA (sans lien), publié depuis, dont la
  // personne colle le lien ; ou un brouillon retrouvé qui porte déjà cet identifiant. Elle est reprise sous la nouvelle
  // clé, avec ses lectures, au lieu d'être suivie (et comptée) deux fois.
  let reprise = false;
  if (id) {
    for (const [k, x] of Object.entries(d.publications)) {
      if (k === cle || x?.reseau !== reseau) continue;
      if (!(x.id === id || (!x.id && !x.lien && p.cle_fiche && x.cle_fiche === p.cle_fiche))) continue;
      const lectures = new Map();
      for (const l of [...(x.lectures ?? []), ...(avant?.lectures ?? [])]) if (!lectures.has(l.jours) || String(l.quand ?? '') >= String(lectures.get(l.jours).quand ?? '')) lectures.set(l.jours, l);
      avant = {...x, ...(avant ?? {}), lectures: [...lectures.values()].sort((a, b) => a.jours - b.jours)};
      delete d.publications[k];
      reprise = true;
    }
  }
  avant ??= {lectures: []};
  // elle a maintenant son identifiant : ce qui disait « introuvable » ne vaut plus
  if (reprise || (id && !avant.id)) { delete avant.essais_vains; delete avant.dernier_essai; delete avant.introuvable; }
  d.publications[cle] = {...avant, cle, reseau, id: id ?? avant.id ?? null, lien: lien ?? avant.lien ?? null, cle_fiche: p.cle_fiche ?? avant.cle_fiche ?? null,
    titre: String(p.titre ?? avant.titre ?? '').slice(0, 160) || null, projet: String(p.projet ?? avant.projet ?? '').slice(0, 120) || null,
    legende: String(p.legende ?? avant.legende ?? '').slice(0, 600) || null, etat: p.etat ?? (reprise && avant.etat === 'brouillon' ? 'publie' : avant.etat) ?? null,
    publie_le: p.publie_le ?? avant.publie_le ?? new Date().toISOString(), suivi: reseau === 'youtube' || reseau === 'tiktok' ? 'treg' : reseau === 'linkedin' ? 'aucun' : 'ia', lectures: avant.lectures ?? []};
  ecrireSuivi(espaceId, d);
  return cle;
}

/** La dernière lecture d'une publication : la plus récente (elles sont rangées par étape, pas par date), ou null. */
export function derniereLecture(p) {
  let d = null;
  for (const l of p?.lectures ?? []) if (!d || String(l.quand ?? '') >= String(d.quand ?? '')) d = l;
  return d;
}

/**
 * Les lectures à faire maintenant : la dernière étape atteinte (J+1, J+7 ou J+30) si elle n'est pas encore lue, et une
 * relecture forcée au plus toutes les 6 h. Une étape manquée reste vide : la relire après coup rangerait les chiffres
 * d'aujourd'hui sous « J+1 ». Une publication que Treg ne retrouve pas (brouillon jamais publié, vidéo retirée) est
 * réessayée de moins en moins souvent (un jour après le 1er essai vain, deux après le 2e… sept au plus), puis plus du
 * tout (`introuvable`) — sauf si la personne le demande (`force`).
 */
export function lecturesDues(d, maintenant = Date.now(), {force = false} = {}) {
  const dues = [];
  for (const p of Object.values(d.publications)) {
    const age = maintenant - Date.parse(p.publie_le);
    if (!(age >= 0)) continue;
    const faits = new Set((p.lectures ?? []).map((l) => l.jours));
    const jour = [...JOURS].reverse().find((j) => age >= j * JOUR_MS);
    const lue = derniereLecture(p);
    const derniere = lue?.quand ? Date.parse(lue.quand) : 0;
    if (jour && !faits.has(jour)) {
      if (!force && (p.introuvable || ((p.essais_vains ?? 0) > 0 && maintenant - Date.parse(p.dernier_essai) < Math.min(p.essais_vains, 7) * JOUR_MS))) continue;
      dues.push({cle: p.cle, jours: jour});
    } else if (force && maintenant - derniere > 6 * 3600e3 && age < 90 * JOUR_MS) dues.push({cle: p.cle, jours: Math.max(0, Math.floor(age / JOUR_MS))});
  }
  return dues;
}

const mediane = (xs) => { const t = xs.filter((x) => x != null).sort((a, b) => a - b); if (!t.length) return null; const m = Math.floor(t.length / 2); return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2; };
/** Le multiple d'une vidéo : ses vues ÷ la médiane de son compte (null si on ne sait pas). */
export function multiple(vues, med) { return vues != null && med > 0 ? Math.round((vues / med) * 100) / 100 : null; }

// ——— la porte directe de Treg (lecture seulement) ———
/** Une panne de réseau dite en une phrase simple (jamais « connect ECONNREFUSED… ») ; `injoignable` : inutile d'insister. */
function panne(e) {
  const horsLigne = ['ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'ENETDOWN', 'EHOSTUNREACH'].includes(e?.code);
  const lent = e?.message === 'pas de réponse' || e?.code === 'ETIMEDOUT';
  const err = new Error(horsLigne ? 'Pas d’internet pour l’instant : Dérush relira tes vues plus tard.' : lent ? 'Treg n’a pas répondu à temps : réessaie plus tard.' : 'Treg ne répond pas pour l’instant : réessaie plus tard.');
  err.injoignable = true;
  return err;
}
function requete(adresse, {methode = 'GET', entetes = {}, corps = null, delaiMs = 20000} = {}) {
  return new Promise((ok, ko) => {
    const u = new URL(adresse);
    const r = (u.protocol === 'http:' ? http : https).request(u, {method: methode, headers: entetes}, (res) => {
      const morceaux = [];
      res.on('data', (x) => morceaux.push(x));
      res.on('end', () => ok({statut: res.statusCode ?? 0, corps: Buffer.concat(morceaux).toString('utf8')}));
      res.on('error', (e) => ko(panne(e)));
    });
    r.setTimeout(delaiMs, () => r.destroy(new Error('pas de réponse')));
    r.on('error', (e) => ko(panne(e)));
    if (corps) r.write(corps);
    r.end();
  });
}
/** Lit une fiche de Treg ; renvoie le JSON de la réponse, ou lève une erreur claire. */
async function lire(fiche, {query = {}, body = null, cle, base}) {
  const adresse = `${base}/call/${fiche}?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]))}`;
  const corps = body ? JSON.stringify(body) : null;
  const r = await requete(adresse, {methode: body ? 'POST' : 'GET', corps, entetes: {'X-Treg-Token': cle, Accept: 'application/json', ...(corps ? {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corps)} : {})}});
  if (r.statut === 401) throw new Error('Treg ne reconnaît pas ta clé (Connexions › Treg).');
  if (r.statut === 404) throw new Error(`Ce réseau n’est pas relié à ton compte Treg (${fiche.split('.')[0]}).`);
  if (r.statut === 429) throw new Error('Treg demande de ralentir : réessaie plus tard.');
  if (r.statut >= 400) throw new Error(`Treg a répondu ${r.statut}.`);
  try { return JSON.parse(r.corps); } catch { throw new Error('Réponse de Treg illisible.'); }
}
/** Les objets « vidéo » d'une réponse, où qu'ils soient (Treg relaie la réponse du réseau telle quelle). */
function objetsAvec(x, cle, r = []) {
  if (Array.isArray(x)) for (const y of x) objetsAvec(y, cle, r);
  else if (x && typeof x === 'object') { if (cle in x) r.push(x); else for (const v of Object.values(x)) objetsAvec(v, cle, r); }
  return r;
}

/** YouTube : les chiffres de ces vidéos (50 au plus par appel). */
export async function chiffresYouTube(ids, {cle, base = BASE_TREG}) {
  const r = {};
  for (let i = 0; i < ids.length; i += 50) {
    const j = await lire('youtube.youtube.video.detail', {query: {part: 'statistics,snippet', id: ids.slice(i, i + 50).join(',')}, cle, base});
    for (const it of objetsAvec(j, 'statistics')) {
      const s = it.statistics ?? {};
      r[it.id] = {vues: nombre(s.viewCount), jaime: nombre(s.likeCount), commentaires: nombre(s.commentCount), publie_le: it.snippet?.publishedAt ?? null};
    }
  }
  return r;
}
/** YouTube : la médiane des vues des dernières vidéos de la chaîne (de plus de 3 jours). */
export async function medianeYouTube({cle, base = BASE_TREG}) {
  const ch = await lire('youtube.youtube.channel.profile', {query: {part: 'contentDetails', mine: true}, cle, base});
  const uploads = objetsAvec(ch, 'relatedPlaylists')[0]?.relatedPlaylists?.uploads ?? objetsAvec(ch, 'contentDetails')[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return null;
  const pl = await lire('youtube.youtube.channel.videos.uploads', {query: {part: 'contentDetails', playlistId: uploads, maxResults: 50}, cle, base});
  const ids = objetsAvec(pl, 'videoId').map((x) => x.videoId).filter(Boolean);
  if (!ids.length) return null;
  const st = await chiffresYouTube(ids, {cle, base});
  const vieilles = Object.values(st).filter((x) => !x.publie_le || Date.now() - Date.parse(x.publie_le) > 3 * JOUR_MS);
  return {valeur: mediane(vieilles.map((x) => x.vues)), n: vieilles.length, le: new Date().toISOString()};
}
/** TikTok : les 20 dernières vidéos du compte, avec leurs chiffres. */
export async function videosTikTok({cle, base = BASE_TREG, pages = 3, jusqua = null}) {
  const r = {};
  let curseur = null;
  for (let k = 0; k < pages; k++) {
    const j = await lire('tiktok.tiktok.user.videos', {query: {fields: 'id,title,video_description,create_time,view_count,like_count,comment_count,share_count,share_url'}, body: {max_count: 20, ...(curseur ? {cursor: curseur} : {})}, cle, base});
    const vids = objetsAvec(j, 'view_count');
    for (const v of vids) r[String(v.id)] = {vues: nombre(v.view_count), jaime: nombre(v.like_count), commentaires: nombre(v.comment_count), partages: nombre(v.share_count), lien: v.share_url ?? null,
      texte: String(v.title ?? v.video_description ?? '').slice(0, 300), publie_le: v.create_time ? new Date(v.create_time * 1000).toISOString() : null};
    const d = j?.data ?? {};
    // on s'arrête quand il n'y en a plus, ou quand on est remonté avant la plus ancienne publication cherchée
    const plusVieille = Math.min(...vids.map((v) => Number(v.create_time) * 1000).filter(Number.isFinite));
    if (!d.has_more || !d.cursor || (jusqua && plusVieille < jusqua)) break;
    curseur = d.cursor;
  }
  return r;
}
// les mots qui ne disent rien d'une vidéo (de 4 lettres et plus : les plus courts sont déjà écartés), sans accents
const MOTS_VIDES = new Set(('pour avec dans sans sous vers chez entre notre votre leur leurs nous vous elle elles cette cela ceci sont etes etre avoir fait faire '
  + 'plus moins tout tous toute toutes tres trop mais donc alors comme quand quoi quel quelle aussi encore deja bien video videos tiktok pourtoi foryou viral '
  + 'this that with your from have what when they them here there about just like more some will').split(' '));
const mots = (t) => new Set(String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((m) => m.length >= 4 && !MOTS_VIDES.has(m)));
/**
 * Un brouillon TikTok (sans lien) retrouvé dans la liste du compte : une vidéo publiée après lui (30 jours au plus),
 * qui n'est pas déjà celle d'une autre publication (`pris`), et dont la légende reprend au moins la moitié des mots du
 * brouillon (2 au moins, sans les mots vides : « pour », « avec », « vous »… ne prouvent rien). Deux vidéos à égalité :
 * aucune — mieux vaut ne rien lire que les vues d'une autre vidéo. Renvoie son identifiant ou null ({id, communs} avec
 * `detail`).
 */
export function retrouverBrouillon(p, vids, {pris = new Set(), detail = false} = {}) {
  const depuis = Date.parse(p.publie_le);
  const siens = mots(`${p.titre ?? ''} ${p.legende ?? ''}`);
  if (siens.size < 2) return null;
  let mieux = null;
  let egalite = false;
  for (const [id, v] of Object.entries(vids)) {
    if (pris.has(id) || !v.publie_le) continue;
    const t = Date.parse(v.publie_le);
    if (t < depuis - 3600e3 || t > depuis + 30 * JOUR_MS) continue;
    const communs = [...mots(v.texte)].filter((m) => siens.has(m)).length;
    if (communs < 2 || communs * 2 < siens.size) continue;
    if (!mieux || communs > mieux.communs) { mieux = {id, communs}; egalite = false; } else if (communs === mieux.communs) egalite = true;
  }
  if (!mieux || egalite) return null;
  return detail ? mieux : mieux.id;
}

const RELECTURES = new Map(); // espace → sa relecture en cours
/**
 * Relit les chiffres dus d'un espace (ou tous avec `force`), par la porte directe de Treg. Les médianes sont gardées
 * 24 h. Renvoie {lues, erreurs, sans_cle}. Sans clé Treg, rien n'est lu (sans_cle: true) : l'IA peut le faire.
 * Une seule relecture à la fois par espace (le tour des 3 heures et le bouton « Relire les vues » peuvent tomber
 * ensemble) : la seconde reçoit le résultat de la première, ou passe juste après elle si elle est forcée.
 */
export function relireChiffres(espaceId, options = {}) {
  const enCours = RELECTURES.get(espaceId);
  if (enCours) { const suite = () => relireChiffres(espaceId, options); return options.force ? enCours.then(suite, suite) : enCours; }
  const p = relire(espaceId, options).finally(() => RELECTURES.delete(espaceId));
  RELECTURES.set(espaceId, p);
  return p;
}
async function relire(espaceId, {cle = process.env.TREG_TOKEN, base = BASE_TREG, force = false, maintenant = Date.now()} = {}) {
  const d = lireSuivi(espaceId);
  const dues = lecturesDues(d, maintenant, {force}).filter((x) => d.publications[x.cle]?.suivi === 'treg');
  if (!dues.length) return {lues: 0, erreurs: [], sans_cle: !cle};
  if (!cle) return {lues: 0, erreurs: [], sans_cle: true};
  const erreurs = [];
  const quand = new Date(maintenant).toISOString();
  // Ce qui est lu en ligne est gardé ici, puis reporté d'un coup dans le fichier RELU à la fin : pendant les appels
  // (jusqu'à 20 s chacun), une publication a pu être liée, ou des chiffres rangés par l'IA. Rien de cela n'est écrasé.
  const lectures = new Map(); // clé → {chiffres, id, publie_le}
  const vaines = new Set(); // Treg a répondu, sans cette vidéo
  const medianes = {};
  let coupe = false; // Treg injoignable : une seule phrase, et inutile d'essayer l'autre réseau
  const echec = (reseau, e) => {
    if (e?.injoignable) { coupe = true; if (!erreurs.includes(e.message)) erreurs.push(e.message); } else erreurs.push(`${reseau} : ${e.message}`);
  };
  // YouTube (une vidéo sans identifiant ne pourra jamais être lue)
  for (const x of dues) if (d.publications[x.cle].reseau === 'youtube' && !d.publications[x.cle].id) vaines.add(x.cle);
  const yt = dues.filter((x) => d.publications[x.cle].reseau === 'youtube' && d.publications[x.cle].id);
  if (yt.length) {
    try {
      const st = await chiffresYouTube(yt.map((x) => d.publications[x.cle].id), {cle, base});
      for (const x of yt) {
        const s = st[d.publications[x.cle].id];
        if (s) lectures.set(x.cle, {chiffres: {vues: s.vues, jaime: s.jaime, commentaires: s.commentaires}, publie_le: s.publie_le}); else vaines.add(x.cle);
      }
      // la médiane de la chaîne : celle de la personne, donc seulement pour « Moi » (un client a sa propre chaîne)
      const m = d.medianes.youtube;
      if (espaceId === 'moi' && (!m || maintenant - Date.parse(m.le) > JOUR_MS)) { const nm = await medianeYouTube({cle, base}); if (nm?.valeur > 0) medianes.youtube = nm; }
    } catch (e) { echec('YouTube', e); }
  }
  // TikTok : la liste lue est celle du compte relié à Treg ; une vidéo n'y est reconnue que par son identifiant, son
  // lien de partage, ou (un brouillon publié depuis l'app) par sa date et sa légende
  const tt = coupe ? [] : dues.filter((x) => d.publications[x.cle].reseau === 'tiktok');
  if (tt.length) {
    try {
      // jusqu'où remonter : la plus ancienne publication cherchée — mais une vidéo liée par son lien et jamais lue a pu
      // être publiée bien avant (sa date est celle du collage) : toutes les pages sont alors lues
      const dateSure = (p) => !p.lien || (p.lectures ?? []).length > 0;
      const jusqua = tt.every((x) => dateSure(d.publications[x.cle])) ? Math.min(...tt.map((x) => Date.parse(d.publications[x.cle].publie_le)).filter(Number.isFinite)) : null;
      const vids = await videosTikTok({cle, base, jusqua: Number.isFinite(jusqua) ? jusqua : null});
      const pris = new Set(Object.values(d.publications).filter((p) => p.reseau === 'tiktok' && p.id).map((p) => String(p.id)));
      const trouvees = new Map(); // clé de la publication → identifiant de sa vidéo
      const brouillons = [];
      for (const x of tt) {
        const p = d.publications[x.cle];
        const id = p.id ?? Object.entries(vids).find(([, v]) => v.lien && p.lien && v.lien.split('?')[0] === p.lien.split('?')[0])?.[0] ?? null;
        if (id) { trouvees.set(x.cle, String(id)); pris.add(String(id)); } else if (!p.lien) brouillons.push(x);
      }
      // chaque brouillon cherche sa vidéo parmi celles qui ne sont à personne ; une vidéo voulue par deux brouillons va
      // au plus ressemblant (à égalité : à aucun), jamais aux deux
      const voeux = brouillons.map((x) => ({x, ...(retrouverBrouillon(d.publications[x.cle], vids, {pris, detail: true}) ?? {})})).filter((v) => v.id);
      for (const v of voeux) if (voeux.every((w) => w === v || w.id !== v.id || w.communs < v.communs)) trouvees.set(v.x.cle, v.id);
      for (const x of tt) {
        const id = trouvees.get(x.cle);
        const v = id ? vids[id] : null;
        if (v) lectures.set(x.cle, {chiffres: {vues: v.vues, jaime: v.jaime, commentaires: v.commentaires, partages: v.partages}, id, publie_le: v.publie_le}); else vaines.add(x.cle);
      }
      const vues = Object.values(vids).filter((v) => !v.publie_le || maintenant - Date.parse(v.publie_le) > 3 * JOUR_MS).map((v) => v.vues);
      const m = vues.length >= 3 ? mediane(vues) : null;
      if (espaceId === 'moi' && m > 0) medianes.tiktok = {valeur: m, n: vues.length, le: quand};
    } catch (e) { echec('TikTok', e); }
  }
  // le report : aucune attente entre la relecture du fichier et son écriture
  const frais = lireSuivi(espaceId);
  let lues = 0;
  for (const x of dues) {
    if (!Object.hasOwn(frais.publications, x.cle)) continue; // retirée, ou reprise sous une autre clé pendant la relecture
    const p = frais.publications[x.cle];
    const l = lectures.get(x.cle);
    if (!l) {
      if (!vaines.has(x.cle)) continue; // Treg n'a pas répondu : ce n'est pas un essai vain
      p.essais_vains = (p.essais_vains ?? 0) + 1;
      p.dernier_essai = quand;
      if (p.essais_vains >= 10 || maintenant - Date.parse(p.publie_le) > 45 * JOUR_MS) p.introuvable = true;
      continue;
    }
    if (l.id && !p.id) p.id = l.id;
    // la vraie date de publication, dite par le réseau : un lien collé après coup portait l'heure du collage, un
    // brouillon celle de son envoi — J+1, J+7 et J+30 se comptent depuis la vraie
    const vraie = Date.parse(l.publie_le ?? '');
    if (Number.isFinite(vraie) && vraie <= maintenant && Math.abs(vraie - Date.parse(p.publie_le)) > 3600e3) p.publie_le = new Date(vraie).toISOString();
    const age = maintenant - Date.parse(p.publie_le);
    const faits = new Set((p.lectures ?? []).map((y) => y.jours));
    const etape = [...JOURS].reverse().find((j) => age >= j * JOUR_MS);
    const jours = etape && !faits.has(etape) ? etape : Math.max(0, Math.floor(age / JOUR_MS));
    p.lectures = [...(p.lectures ?? []).filter((y) => y.jours !== jours), {quand, jours, ...l.chiffres}].sort((a, b) => a.jours - b.jours);
    delete p.essais_vains;
    delete p.dernier_essai;
    delete p.introuvable;
    lues++;
  }
  Object.assign(frais.medianes, medianes);
  ecrireSuivi(espaceId, frais);
  return {lues, erreurs, sans_cle: false};
}

/** Range des chiffres lus par l'IA (Instagram, ou tout réseau sans clé) : [{cle, vues, jaime, …}] ; renvoie le nombre rangé. */
export function rangerChiffresIA(espaceId, lectures, {medianes = {}} = {}, maintenant = Date.now()) {
  const d = lireSuivi(espaceId);
  let n = 0;
  for (const l of Array.isArray(lectures) ? lectures : []) {
    // seulement une publication suivie ici : jamais « __proto__ » ni une autre clé héritée, rendue par l'IA
    if (typeof l?.cle !== 'string' || !Object.hasOwn(d.publications, l.cle)) continue;
    const p = d.publications[l.cle];
    const age = maintenant - Date.parse(p.publie_le);
    const jours = [...JOURS].reverse().find((j) => age >= j * JOUR_MS) ?? 0;
    const chiffres = Object.fromEntries(['vues', 'jaime', 'commentaires', 'partages', 'enregistrements', 'portee'].map((k) => [k, nombre(l[k])]).filter(([, v]) => v != null));
    if (!Object.keys(chiffres).length) continue;
    p.lectures = [...(p.lectures ?? []).filter((x) => x.jours !== jours), {quand: new Date(maintenant).toISOString(), jours, par: 'ia', ...chiffres}].sort((a, b) => a.jours - b.jours);
    n++;
  }
  // une médiane à 0 (ou « null », que l'IA écrit quand elle ne sait pas) n'en est pas une : elle effacerait tous les multiples du réseau
  for (const [r, m] of Object.entries(medianes ?? {})) if (/^[a-z]{2,20}$/.test(r) && nombre(m?.valeur) > 0) d.medianes[r] = {valeur: nombre(m.valeur), n: nombre(m.n) ?? null, le: new Date(maintenant).toISOString(), par: 'ia'};
  ecrireSuivi(espaceId, d);
  return n;
}

/**
 * Les publications d'un espace avec leur dernière lecture et leur multiple : pour le tableau de bord et la recette.
 * La médiane de référence, par réseau : celle du compte (lue par Treg ou par l'IA, et pour « Moi » seulement celle des
 * comptes Treg de la personne), sinon celle donnée par défaut (le profil du créateur), sinon celle des vidéos suivies
 * de l'espace sur ce réseau (3 au moins). `source_mediane` dit laquelle : « compte » ou « espace ».
 */
export function publicationsAvecChiffres(espaceId, {medianesParDefaut = {}} = {}) {
  const d = lireSuivi(espaceId);
  const pubs = Object.values(d.publications);
  const duCompte = (r) => { const m = d.medianes[r]; return m?.valeur > 0 && (espaceId === 'moi' || m.par === 'ia') ? m.valeur : null; };
  const deLEspace = new Map();
  for (const r of new Set(pubs.map((p) => p.reseau))) {
    const vues = pubs.filter((p) => p.reseau === r).map((p) => derniereLecture(p)?.vues).filter((x) => Number.isFinite(x));
    if (vues.length >= 3) deLEspace.set(r, mediane(vues));
  }
  return pubs.map((p) => {
    const l = derniereLecture(p);
    const compte = duCompte(p.reseau) ?? (medianesParDefaut[p.reseau] > 0 ? medianesParDefaut[p.reseau] : null);
    const med = compte ?? deLEspace.get(p.reseau) ?? null;
    return {...p, derniere: l, mediane: med, source_mediane: med == null ? null : compte != null ? 'compte' : 'espace', multiple: multiple(l?.vues ?? null, med)};
  }).sort((a, b) => String(b.publie_le).localeCompare(String(a.publie_le)));
}

let minuterie = null;
/** Relit les chiffres dus de tous les espaces, maintenant puis toutes les 3 heures (seulement avec la clé Treg). */
export function programmerSuivi({toutesLes = 3 * 3600e3, auDemarrage = 90e3} = {}) {
  if (minuterie) return;
  const tour = async () => {
    if (!process.env.TREG_TOKEN) return;
    for (const e of lireEspaces().espaces) if (apprend(e)) { try { await relireChiffres(e.id); } catch { /* le prochain tour réessaiera */ } }
  };
  setTimeout(tour, auDemarrage).unref?.();
  minuterie = setInterval(tour, toutesLes);
  minuterie.unref?.();
}
