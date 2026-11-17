// Dérush — Gemini, l'œil et l'oreille du Mode Hollywood. Gemini est la seule IA qui voit ET entend une vidéo. En Mode
// Hollywood, Dérush lui fait regarder et écouter les rushes avant le montage (un index : ce qu'on voit, ce qu'on entend,
// les meilleurs moments, les défauts, avec leurs temps), puis la vidéo livrée (son avis, image et son). Claude reste le
// monteur : il reçoit l'index, et peut poser une question sur un passage (commande derush-gemini).
//
// Deux voies, la première qui répond :
//   - la commande Gemini (agy, connectée au compte Google de la personne) : son outil de lecture de fichier lui donne
//     l'image ET le son d'une vidéo (vérifié avec agy 1.5.9, le 15 nov. 2026). Elle tourne dans son bac à sable, avec
//     le seul droit de lire le dossier de la vidéo (lib/gemini.mjs) ; une réponse donnée sans avoir ouvert la vidéo est
//     écartée. C'est la voie par défaut ;
//   - la clé Google AI Studio (l'API), en secours (ou d'abord, si la personne la choisit). Elle est rangée dans .env.local
//     du dossier de Dérush (DERUSH_GEMINI_CLE), jamais affichée ni renvoyée à l'interface, jamais dans une adresse
//     (en-tête x-goog-api-key), jamais dans l'environnement d'une IA (envIA la retire).
// Rien ne part chez Google sans le Mode Hollywood allumé (ou un clic sur « Vérifier »).
// API : generativelanguage.googleapis.com/v1beta — models (la liste), upload/v1beta/files (l'envoi en deux temps),
// files/<id> (l'attente), models/<modèle>:generateContent. DERUSH_GEMINI_BASE la remplace dans les essais.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DOSSIER_SUPPORT} from './moteurs.mjs';
import {lireReglages, changerReglages, rangerCle} from './reglages.mjs';
import {ffmpeg, lancer, lireJson, ecrireJson, FFPROBE} from './outils.mjs';
import {etatGeminiGarde, etatGeminiRecent, argsGemini, lecteurGemini, envIA} from './ia.mjs';
import {reglagesGemini} from './gemini.mjs';
import {envSansNavigateur} from './plateforme.mjs';
import {listerCompetences} from './competences.mjs';
import {espaceDuProjet, espaceEnTexte} from './espaces.mjs';

export const NOM_CLE = 'DERUSH_GEMINI_CLE';
const BASE = () => (process.env.DERUSH_GEMINI_BASE || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
const VERSION_INDEX = 2; // à augmenter quand la consigne change : les index d'avant sont refaits (2 : la grille du réalisateur)
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const court = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

export class ErreurGemini extends Error {
  constructor(genre, message) { super(message); this.genre = genre; }
}

// ——— la clé ———
/** La clé rangée (relue dans .env.local à chaque fois : une clé rangée depuis le Terminal compte tout de suite). */
export function cleGemini() {
  let cle = null;
  try {
    for (const l of fs.readFileSync(path.join(DOSSIER_SUPPORT, '.env.local'), 'utf8').split(/\r?\n/)) {
      const m = /^DERUSH_GEMINI_CLE=(.*)$/.exec(l.trim());
      if (m && m[1].trim()) cle = m[1].trim();
    }
  } catch { /* pas de fichier */ }
  return cle ?? (process.env[NOM_CLE] || null);
}
/** Range la clé collée par la personne (jamais affichée ensuite). */
export function enregistrerCleGemini(cle) {
  const c = String(cle ?? '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9_\-.:~+/=]{20,400}$/.test(c) || /^https?:|@/.test(c)) throw new Error('Ce n’est pas une clé Google AI Studio : copie-la entière depuis aistudio.google.com (Clés API), puis colle-la ici.');
  rangerCle(NOM_CLE, c);
  changerReglages({gemini_api: null});
  return true;
}
export function retirerCleGemini() { rangerCle(NOM_CLE, null); changerReglages({gemini_api: null}); return true; }

/** Ce qui ne doit jamais sortir d'ici : la clé, si un message de Google la répétait. */
function masquer(t) {
  const cle = cleGemini();
  let s = String(t ?? '');
  if (cle) s = s.split(cle).join('•••');
  return s.replace(/\s+/g, ' ').trim().slice(0, 400);
}

/** Un appel à l'API, avec la clé dans l'en-tête. Les refus de Google deviennent des phrases. */
async function appel(chemin, {methode = 'GET', json = null, corps = null, entetes = {}, delai = 120000} = {}) {
  const cle = cleGemini();
  if (!cle) throw new ErreurGemini('cle', 'Pas de clé Gemini : colle ta clé Google AI Studio dans Connexions › Mode Hollywood.');
  let r;
  try {
    r = await fetch(`${BASE()}${chemin}`, {method: methode, headers: {'x-goog-api-key': cle, ...(json ? {'content-type': 'application/json'} : {}), ...entetes},
      body: json ? JSON.stringify(json) : corps ?? undefined, signal: AbortSignal.timeout(delai)});
  } catch (e) {
    throw new ErreurGemini('reseau', e?.name === 'TimeoutError' ? 'Gemini met trop de temps à répondre : réessaie.' : 'Google ne répond pas : vérifie ta connexion à Internet.');
  }
  const texte = await r.text();
  let j = null;
  try { j = texte ? JSON.parse(texte) : null; } catch { /* pas du JSON */ }
  if (!r.ok) {
    const m = j?.error?.message ?? texte;
    const details = JSON.stringify(j?.error?.details ?? '');
    if (/API_KEY_INVALID|API key not valid|API key expired/i.test(`${m} ${details}`)) throw new ErreurGemini('cle', 'Google refuse cette clé (fausse, supprimée ou expirée) : crée-en une dans Google AI Studio, puis colle-la de nouveau.');
    // l'offre gratuite ne donne pas ce modèle (« Free Tier », limite 0) : il reste fermé tant que le projet de la clé n'a
    // pas la facturation, même avec du crédit acheté ailleurs
    if (r.status === 429 && /free.?tier/i.test(`${m} ${details}`) && /limit: 0\b/.test(m)) {
      const modele = /model: ([\w.-]+)/.exec(m)?.[1] ?? 'ce modèle';
      throw new ErreurGemini('gratuit', `${modele} est fermé à ta clé : son projet Google est encore en offre gratuite. Dans Google AI Studio, active la facturation du projet de cette clé (Clés API › son projet), puis clique sur « Vérifier ».`);
    }
    if (r.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(`${j?.error?.status ?? ''} ${m}`)) throw new ErreurGemini('quota', `Quota Gemini atteint pour cette clé : ${masquer(m)}`);
    if (r.status === 403) throw new ErreurGemini('droits', `Google refuse : ${masquer(m)}`);
    if (r.status === 404) throw new ErreurGemini('introuvable', `Introuvable chez Google : ${masquer(m)}`);
    // un modèle débordé (« high demand », 503) ou un raté chez Google (500) : on réessaie un peu plus tard, puis un autre modèle
    if (r.status === 503 || r.status === 500 || /UNAVAILABLE|overloaded|high demand/i.test(`${j?.error?.status ?? ''} ${m}`)) throw new ErreurGemini('occupe', `Gemini est très demandé en ce moment (${r.status}).`);
    throw new ErreurGemini('autre', `Gemini a répondu ${r.status} : ${masquer(m)}`);
  }
  return {j, r};
}

// ——— les modèles : le plus fort que la clé peut utiliser ———
const FAMILLES = [['carbon', 100], ['hydrogen', 90], ['argon', 80], ['ultra', 75], ['pro', 70], ['flash', 50]];
/** Le rang d'un modèle : la famille d'abord (Carbon, Hydrogen, Argon, Pro, Flash), puis la version ; les « lite » et préversions après. */
export function rangModele(m) {
  const n = `${m.name ?? ''} ${m.displayName ?? ''}`.toLowerCase();
  let r = 0;
  for (const [k, v] of FAMILLES) if (n.includes(k)) r = Math.max(r, v);
  if (/lite/.test(n)) r = Math.min(r, 30);
  const version = Number(/gemini[- ](\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0);
  return r * 1000 + version * 10 - (/preview|exp/.test(n) ? 1 : 0);
}
/** Les modèles de la clé qui savent répondre (generateContent) et regarder une vidéo, du plus fort au plus faible. */
export async function modelesGemini() {
  const tous = [];
  let page = '';
  for (let i = 0; i < 5; i++) {
    const {j} = await appel(`/v1beta/models?pageSize=200${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`, {delai: 20000});
    tous.push(...(j?.models ?? []));
    page = j?.nextPageToken;
    if (!page) break;
  }
  return tous.filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent') && /^models\/gemini/i.test(m.name ?? '')
    && !/embed|tts|image|imagen|live|native-audio|aqa|robotics|computer-use|learnlm/i.test(m.name))
    .sort((a, b) => rangModele(b) - rangModele(a));
}

/** Une question de quelques jetons à un modèle : répond-il pour cette clé ? (Sur l'offre gratuite, un refus ne coûte rien.) */
async function essaiCourt(modele) {
  await appel(`/v1beta/models/${modele}:generateContent`, {methode: 'POST', delai: 45000, json: {contents: [{role: 'user', parts: [{text: 'Réponds OK.'}]}], generationConfig: {maxOutputTokens: 8}}});
}
/** Des ratés passagers (pas de réseau, Google débordé) : ils n'éteignent pas le Mode Hollywood. */
const PASSAGERS = ['reseau', 'occupe'];
/**
 * Vérifie la clé auprès de Google (la liste des modèles), essaie le plus fort, et le choisit s'il répond (sinon le
 * suivant ; un modèle fermé à l'offre gratuite est noté dans « fermes ») : gardé 6 heures dans les réglages.
 * {ok, modele, nom, autres, le} ou {ok: false, pourquoi, genre}. Rien n'est envoyé d'autre que la clé. Plusieurs
 * demandes en même temps (trois rushes regardés à la fois) partagent une seule vérification.
 */
let verificationEnCours = null;
export function verifierCleGemini({force = false} = {}) {
  if (!cleGemini()) return Promise.resolve({ok: false, pourquoi: 'Pas encore de clé.', genre: 'cle'});
  const deja = lireReglages().gemini_api;
  if (!force && deja?.le && Date.now() - Date.parse(deja.le) < 6 * 3600e3) return Promise.resolve(deja);
  verificationEnCours ??= verifier(deja).finally(() => { verificationEnCours = null; });
  return verificationEnCours;
}
async function verifier(deja) {
  const cle = cleGemini();
  let r;
  try {
    const liste = await modelesGemini();
    if (!liste.length) r = {ok: false, pourquoi: 'La clé est acceptée, mais aucun modèle Gemini capable de regarder une vidéo n’est ouvert pour elle.', genre: 'droits'};
    else {
      const id = (m) => m.name.replace(/^models\//, '');
      const fermes = [];
      let choisi = null;
      for (const m of liste.slice(0, 4)) {
        try { await essaiCourt(id(m)); choisi = m; break; } catch (e) {
          if (e.genre === 'gratuit') { fermes.push({modele: id(m), nom: m.displayName ?? id(m), raison: e.message}); continue; }
          if (['occupe', 'quota'].includes(e.genre)) { choisi = m; break; } // débordé pour l'instant : il reste le choix
          if (e.genre === 'cle') throw e;
          fermes.push({modele: id(m), nom: m.displayName ?? id(m), raison: e.message});
        }
      }
      choisi ??= liste.find((m) => !fermes.some((f) => f.modele === id(m))) ?? liste[0];
      r = {ok: true, modele: id(choisi), nom: choisi.displayName ?? id(choisi), autres: liste.filter((m) => m !== choisi && !fermes.some((f) => f.modele === id(m))).slice(0, 5).map(id),
        limite: choisi.inputTokenLimit ?? null, fermes: fermes.slice(0, 3)};
    }
  } catch (e) {
    // un raté passager n'efface pas une vérification réussie
    if (PASSAGERS.includes(e.genre) && deja?.ok) return deja;
    r = {ok: false, pourquoi: e.message, genre: e.genre ?? 'autre'};
  }
  r.le = new Date().toISOString();
  if (cleGemini() === cle) changerReglages({gemini_api: r}); // une autre clé collée entre-temps : ce résultat n'est plus le sien
  return r;
}

// ——— les deux voies : la commande Gemini (le compte Google), la clé ———
/** Les modèles Gemini de la commande (ni l'orchestrateur, ni les autres marques qu'elle propose). */
const geminiDeLaCommande = (v) => (v?.ok ? (v.modeles ?? []).filter((s) => /^gemini-\d/.test(s) && !/orchestrator|embed|tts|image|live/.test(s)) : []);
const FAMILLES_COMMANDE = ['carbon', 'hydrogen', 'argon', 'pro', 'flash'];
/**
 * Le modèle de la commande pour regarder : le plus fort du compte (Gemini 4 Carbon, Hydrogen, Argon, puis Flash), en
 * réflexion haute (le nom du modèle la porte : gemini-4-hydrogen-high).
 */
export function modeleCommande(modeles = []) {
  for (const f of FAMILLES_COMMANDE) {
    const de = modeles.filter((s) => new RegExp(`-${f}(-|$)`).test(s));
    if (de.length) return de.find((s) => /-high$/.test(s)) ?? de.find((s) => /-medium$/.test(s)) ?? de[0];
  }
  return modeles[0] ?? null;
}
/** « gemini-4-hydrogen-high » → « Gemini 4 Hydrogen ». */
export const nomCommande = (slug) => String(slug ?? '').replace(/-(low|medium|high|xhigh|max)$/, '').split('-').map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(' ');
/** La commande Gemini est-elle prête à regarder (connectée, avec un modèle Gemini) ? Sans la relancer. */
export const commandePrete = () => geminiDeLaCommande(etatGeminiGarde()).length > 0;
/**
 * Les voies pour regarder, dans l'ordre où on les essaie : la commande d'abord (le compte Google), la clé en secours ;
 * l'inverse si la personne a choisi la clé (« hollywood_voie »). Une clé que Google refuse ne compte pas.
 */
export function voiesGemini() {
  const r = lireReglages();
  const cleBonne = !!cleGemini() && !(r.gemini_api?.ok === false && !PASSAGERS.includes(r.gemini_api.genre));
  const v = [commandePrete() && 'commande', cleBonne && 'cle'].filter(Boolean);
  return r.hollywood_voie === 'cle' ? v.reverse() : v;
}
export const changerVoie = (voie) => { changerReglages({hollywood_voie: voie === 'cle' ? 'cle' : null}); return etatGeminiCle(); };

/**
 * L'état pour Connexions : la commande (prête, son modèle), la clé (posée, vérifiée, son modèle), la voie, le Mode
 * Hollywood. Jamais la clé elle-même. Mode Hollywood allumé, la clé est revérifiée en fond quand il le faut : jamais
 * vérifiée (rangée depuis le Terminal, ou avant une mise à jour), un modèle plus fort fermé il y a plus d'une heure (la
 * facturation a pu être activée depuis), ou un raté passager il y a plus d'une minute.
 */
export function etatGeminiCle() {
  const reglages = lireReglages();
  const v = reglages.gemini_api ?? null;
  const cle = !!cleGemini();
  const depuis = v?.le ? Date.now() - Date.parse(v.le) : Infinity;
  const aRevoir = !v || (v.ok && v.fermes?.length && depuis > 3600e3) || (!v.ok && PASSAGERS.includes(v.genre) && depuis > 60e3);
  if (cle && hollywoodVoulu() && aRevoir && !verificationEnCours) verifierCleGemini({force: true}).catch(() => null);
  const modeleCmd = modeleCommande(geminiDeLaCommande(etatGeminiGarde()));
  const voies = voiesGemini();
  return {cle, ok: cle && !!v?.ok, modele: v?.modele ?? null, nom: v?.nom && /^gemini-/.test(v.nom) ? nomCommande(v.nom) : v?.nom ?? null, autres: v?.autres ?? [], fermes: v?.fermes ?? [], verifie_le: v?.le ?? null,
    pourquoi: !cle ? 'Pas encore de clé.' : v && !v.ok ? v.pourquoi : null,
    commande: {prete: !!modeleCmd, modele: modeleCmd, nom: modeleCmd ? nomCommande(modeleCmd) : null},
    voie: reglages.hollywood_voie === 'cle' ? 'cle' : 'commande', voies, prete: voies.length > 0,
    nom_oeil: voies[0] === 'commande' ? nomCommande(modeleCmd) : voies[0] === 'cle' ? nomCommande(v?.modele ?? 'gemini') : null,
    hollywood: hollywoodActif(), hollywood_demande: hollywoodVoulu()};
}
/**
 * Le Mode Hollywood est-il voulu ? Choisi (Classique ou Hollywood, dans la zone d'écriture ou Connexions) ; sans choix,
 * allumé seulement pour qui a posé une clé (son geste valait accord). Une commande Gemini connectée ne l'allume pas
 * toute seule : le dérushage à l'import se sert du compte Google de la personne, elle le choisit.
 */
const hollywoodVoulu = () => { const h = lireReglages().hollywood; return h === true || (h == null && !!cleGemini()); };
/** Le Mode Hollywood est-il allumé (voulu, et une voie existe : la commande connectée, ou une clé pas encore refusée) ? */
export const hollywoodActif = () => hollywoodVoulu() && voiesGemini().length > 0;
export const changerHollywood = (actif) => { changerReglages({hollywood: !!actif}); return etatGeminiCle(); };

// ——— envoyer une vidéo, demander ———
/** Une version légère pour Gemini (il regarde à une image par seconde) : 720 px de petit côté, 10 i/s, son mono. */
export async function versionLegere(source, sortie, {de = null, duree = null, son = true, video = true} = {}) {
  const avant = de != null ? ['-ss', String(Math.max(0, de))] : [];
  const pendant = duree != null ? ['-t', String(Math.max(0.5, duree))] : [];
  const image = video ? ['-map', '0:v:0', '-vf', "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)',fps=10", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-pix_fmt', 'yuv420p'] : ['-vn'];
  const audio = son ? ['-map', '0:a:0?', '-c:a', 'aac', '-ac', '1', '-b:a', '64k'] : ['-an'];
  await ffmpeg(['-y', ...avant, '-i', source, ...pendant, ...image, ...audio, '-movflags', '+faststart', sortie]);
  return sortie;
}

/** Envoie un fichier à Gemini (Files API, en deux temps), attend qu'il soit lu : {name, uri, mimeType, expirationTime}. */
export async function envoyerAGemini(fichier, mime, nom = path.basename(fichier)) {
  const taille = fs.statSync(fichier).size;
  const {r} = await appel('/upload/v1beta/files', {methode: 'POST', json: {file: {display_name: court(nom, 120)}},
    entetes: {'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(taille), 'X-Goog-Upload-Header-Content-Type': mime}});
  const adresse = r.headers.get('x-goog-upload-url');
  if (!adresse) throw new ErreurGemini('autre', 'Google n’a pas donné d’adresse pour envoyer la vidéo.');
  let r2;
  try {
    r2 = await fetch(adresse, {method: 'POST', headers: {'Content-Length': String(taille), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize'},
      body: fs.readFileSync(fichier), signal: AbortSignal.timeout(15 * 60e3)});
  } catch { throw new ErreurGemini('reseau', 'L’envoi de la vidéo à Gemini a été coupé : réessaie.'); }
  const j2 = await r2.json().catch(() => null);
  if (!r2.ok || !j2?.file?.name) throw new ErreurGemini('autre', `L’envoi à Gemini a échoué (${r2.status}).`);
  let f = j2.file;
  for (let i = 0; f.state === 'PROCESSING' && i < 180; i++) {
    await attendre(2000);
    f = (await appel(`/v1beta/${f.name}`, {delai: 20000})).j ?? f;
  }
  if (f.state && f.state !== 'ACTIVE') throw new ErreurGemini('autre', `Gemini n’a pas pu lire ce fichier (${f.state}).`);
  return f;
}

/**
 * Demande à Gemini, avec le meilleur modèle de la clé ; s'il est refusé (quota, droits), le suivant. Les images sont
 * lues en basse résolution (moins chères) ; sans cette option, on redemande sans elle. Renvoie {texte, modele, usage}.
 */
export async function demanderAGemini(parts, {json = true, delai = 10 * 60e3, temperature = 0.2} = {}) {
  const v = lireReglages().gemini_api?.ok ? lireReglages().gemini_api : await verifierCleGemini({force: true});
  if (!v.ok) throw new ErreurGemini(v.genre ?? 'cle', v.pourquoi);
  const essais = [v.modele, ...(v.autres ?? [])].filter(Boolean).slice(0, 4);
  let derniere = null;
  const refuses = []; // pourquoi les modèles d'avant n'ont pas répondu
  for (const modele of essais) {
    // basse résolution d'abord ; deux nouveaux essais (après 5 puis 15 s) quand le modèle est débordé
    for (const [basse, pause] of [[true, 0], [true, 5000], [true, 15000], [false, 0]]) {
      if (pause) { if (derniere?.genre !== 'occupe') continue; await attendre(pause); }
      else if (!basse && !(derniere?.genre === 'autre' && /mediaResolution|media_resolution/i.test(derniere.message))) continue;
      try {
        const {j} = await appel(`/v1beta/models/${modele}:generateContent`, {methode: 'POST', delai,
          json: {contents: [{role: 'user', parts}], generationConfig: {temperature, ...(json ? {responseMimeType: 'application/json'} : {}), ...(basse ? {mediaResolution: 'MEDIA_RESOLUTION_LOW'} : {})}}});
        const texte = (j?.candidates?.[0]?.content?.parts ?? []).map((p) => (p.thought ? '' : p.text ?? '')).join('');
        if (!texte.trim()) throw new ErreurGemini('vide', `Gemini n’a rien répondu (${j?.candidates?.[0]?.finishReason ?? j?.promptFeedback?.blockReason ?? 'sans raison donnée'}).`);
        // le modèle d'avant est fermé à cette clé (quota, droits, retiré) : celui-ci devient le choix ; s'il était
        // seulement débordé, il reste le choix pour la fois suivante
        if (modele !== v.modele && refuses.length && refuses.every((g) => g !== 'occupe')) changerReglages({gemini_api: {...v, modele, nom: nomCommande(modele), autres: essais.filter((x) => x !== modele)}});
        return {texte, modele, usage: j?.usageMetadata ?? null};
      } catch (e) {
        derniere = e;
        if (e.genre === 'occupe' || (basse && e.genre === 'autre' && /mediaResolution|media_resolution/i.test(e.message))) continue;
        break;
      }
    }
    // débordé, à court de quota ou fermé à cette clé : le modèle suivant (Carbon → Hydrogen → Argon…)
    if (!['quota', 'droits', 'introuvable', 'occupe', 'gratuit'].includes(derniere?.genre)) throw derniere;
    refuses.push(derniere.genre);
  }
  throw derniere ?? new ErreurGemini('autre', 'Gemini n’a pas répondu.');
}

// ——— le réalisateur : son rôle, sa grille, ses compétences ———
// Par la commande, Gemini travaille dans un petit dossier (« le plateau ») : la vidéo légère, AGENTS.md (son rôle et
// la grille du réalisateur, que la commande lit d'elle-même) et .agents/skills/ (les mêmes compétences que le monteur).
/** La grille d'analyse du réalisateur : le résumé de editing-montage, cutting-rhythm, film-taste, viral-hooks, talking-head-b-roll. */
export const GRILLE_REALISATEUR = `## La grille du réalisateur
Juge chaque rush et chaque montage comme un réalisateur-monteur de vidéos pour les réseaux (TikTok, Reels, Shorts) et YouTube :
1. L'accroche : ce qui arrête le pouce dans les deux premières secondes (une phrase forte qui se comprend seule, une émotion, une action, une image qui surprend, un contraste).
2. La vérité : un rire, une surprise, une gêne, une tendresse vraie vaut plus qu'un beau plan vide.
3. La parole : une phrase qui se comprend sans contexte, nette, pas couverte ; où elle commence et finit exactement (couper juste avant l'attaque, juste après le dernier mot, jamais au milieu d'un mot).
4. L'image : nette, stable, bien exposée, lisible en vertical (le sujet au centre) ; un mouvement de caméra qui sert ou qui gêne.
5. Le son : une voix couverte par d'autres voix ou par la musique, le vent, la saturation, un son coupé net, une musique d'ambiance (droits d'auteur).
6. Les plans de coupe : ce qui peut illustrer une parole (détails, lieux, ambiances, réactions).
7. Ce qui ne doit pas finir dans un montage : flou, tremblé, doigt devant l'objectif, écran noir, logo ou carton d'une appli, texte déjà incrusté, données personnelles lisibles (écran de téléphone, plaque), une personne qui dit ne pas vouloir être filmée.
8. Les raccords : un début et une fin propres ; un geste ou un mot coupé se voit.
La note, de 1 à 5 : 5 = à garder absolument, 4 = très bon, 3 = utile, 2 = faible, 1 = à jeter.`;
const ROLE_REALISATEUR = `# Ton rôle : le réalisateur de l'équipe (Mode Hollywood de Dérush)
Tu es Gemini, l'œil et l'oreille d'une équipe de montage : toi seul regardes ET écoutes les vidéos. Claude, le monteur, construit
le montage à partir de ce que tu vois et entends, puis te le montre. Ton travail : le dérushage (chaque rush, passage par
passage, image et son), la proposition de découpage, et le contrôle du montage fini, comme un réalisateur exigeant et juste.
- Tu ne modifies rien, tu n'écris aucun fichier, tu ne lances aucune commande, tu ne vas pas sur le web : tu regardes, tu écoutes, tu réponds.
- Tu réponds en français simple. Tu ne nommes personne : tu décris (« la jeune femme au maillot bleu »).
- N'invente rien : un temps, une phrase, un défaut que tu n'as pas vu ou entendu n'existe pas. Si tu n'es pas sûr, dis-le.
- Tes compétences sont dans .agents/skills/ : les mêmes que celles du monteur. Pour juger : editing-montage (le rôle de chaque
  plan, l'ordre, les durées, les raccords), cutting-rhythm (le rythme des coupes), film-taste (ce qui fait « monté par une
  personne »), viral-hooks (les accroches), storytelling-and-narrative, talking-head-b-roll (la parole et les plans de coupe),
  short-form-video-script, derush-viralite (juger une vidéo courte), platform-specs-and-validation (les formats des réseaux).
  La grille ci-dessous les résume : ouvre un SKILL.md quand une question l'exige.

${GRILLE_REALISATEUR}
`;
/**
 * Pour qui est la vidéo : le titre du projet et son espace (la personne elle-même ou un client, son métier, sa marque),
 * comme le monteur le reçoit (contexte/espace/ESPACE.md). Sans lui, le réalisateur ne sait pas qu'un « Merci Yabai »
 * vaut de l'or dans un vlog de YABAÏ.
 */
export function contexteProjet(P) {
  let t = '';
  try { t = espaceEnTexte(espaceDuProjet(P)) ?? ''; } catch { /* sans espace */ }
  return `${P?.d?.titre ? `Le projet s'appelle « ${P.d.titre} ».\n` : ''}${t}`.trim().slice(0, 2500);
}
const blocContexte = (c) => (c ? `\nPour qui est cette vidéo (garde-le en tête pour juger : une marque ou une personne nommée, remerciée ou montrée compte beaucoup) :\n${c}\n` : '');

/** Prépare le plateau du réalisateur dans `dossier` : son rôle (AGENTS.md) et les compétences (liens). Renvoie ce qu'il doit pouvoir lire. */
function preparerPlateau(dossier) {
  fs.writeFileSync(path.join(dossier, 'AGENTS.md'), ROLE_REALISATEUR);
  const base = path.join(dossier, '.agents', 'skills');
  fs.mkdirSync(base, {recursive: true});
  const lus = new Set();
  for (const c of listerCompetences()) {
    try { fs.symlinkSync(c.dossier, path.join(base, c.nom), 'dir'); lus.add(path.dirname(c.dossier)); } catch { /* déjà là, ou un disque sans liens : tant pis pour celle-ci */ }
  }
  return [...lus];
}

/** Le genre d'un refus de la commande Gemini (le quota du compte, la connexion, le reste). */
/** Ce que dit Gemini quand la commande ne lui a donné que les images d'une vidéo, pas son son. */
const SANS_SON = /(?:seules?|uniquement|que) des images|aucune piste (?:son|sonore|audio)|piste (?:audio|sonore|son) (?:non|pas|inexploitable)|non audible|n['’]a renvoyé (?:que|aucune)|pas reçu (?:le|de) son|aucun flux (?:audio|sonore)|son non (?:transmis|reçu|disponible)/i;
// un raté passager du côté de Google (flux coupé, modèle débordé) : « occupe », réessayé une fois
const genreCommande = (m) => (/quota|rate.?limit|resource.?exhausted|\b429\b|too many requests/i.test(m) ? 'quota' : /authenticat|sign.?in|log.?in|not connected/i.test(m) ? 'commande'
  : /stream was interrupted|interrupted|overloaded|unavailable|high demand|try again|temporar|deadline|\b50[03]\b/i.test(m) ? 'occupe' : 'autre');
/**
 * Demande à la commande Gemini (le compte Google) de regarder ET écouter un fichier et de répondre à une consigne.
 * Dans son bac à sable, avec le seul droit de lire le dossier du fichier, sans web. Si elle répond sans avoir ouvert le
 * fichier, la réponse est écartée (elle aurait été inventée). Renvoie {texte, modele}.
 */
export async function demanderParCommande(fichier, consigne, {modele = null, delai = 10 * 60e3, quoi = 'la vidéo'} = {}) {
  const etat = await etatGeminiRecent();
  const modeles = geminiDeLaCommande(etat);
  if (!modeles.length) throw new ErreurGemini('commande', etat?.ok ? 'La commande Gemini n’a aucun modèle Gemini pour ton compte.' : (etat?.pourquoi ?? 'La commande Gemini n’est pas connectée à ton compte Google.'));
  const choisi = modele && modeles.includes(modele) ? modele : modeleCommande(modeles);
  // le plateau : un dossier à lui (son rôle, ses compétences), d'où il lit le fichier sans jamais rien écrire à côté
  const plateau = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-plateau-'));
  const competences = preparerPlateau(plateau);
  const media = quoi === 'la vidéo';
  // Le son à part, en MP3 : par la commande, une vidéo n'arrive parfois au modèle qu'en images (constaté le 15 nov.
  // 2026 avec Hydrogen : selon les moments, aucune piste son reçue), et un .m4a ou un .wav sont refusés ; un MP3
  // s'entend toujours. Les mêmes temps que la vidéo, de 0 à la fin.
  const sonSeul = media && /\.(m4a|mp3|wav|aac|aiff?|flac|ogg|opus)$/i.test(fichier);
  let son = null;
  if (media) {
    try { await ffmpeg(['-y', '-i', fichier, '-vn', '-map', '0:a:0', '-ac', '1', '-b:a', '64k', '-c:a', 'libmp3lame', path.join(plateau, 'son.mp3')]); son = path.join(plateau, 'son.mp3'); } catch { /* pas de son, ou pas d'encodeur MP3 */ }
  }
  const regles = `Tu peux aussi lire tes compétences (.agents/skills/). N'utilise aucun autre outil : ni commande, ni recherche, ni web, et n'écris aucun fichier. Réponds seulement ce qui est demandé.`;
  const aOuvrir = sonSeul ? [son ?? path.resolve(fichier)] : [path.resolve(fichier), ...(son ? [son] : [])];
  const demande = !media
    ? `${consigne}\n\nLe fichier à lire : ${path.resolve(fichier)}\nOuvre-le avec ton outil de lecture de fichier, en entier. ${regles}`
    : sonSeul ? `${consigne}\n\nLe fichier à écouter : ${aOuvrir[0]}\nOuvre-le avec ton outil de lecture de fichier, en entier. ${regles}`
      : son ? `${consigne}\n\nLes fichiers de ce passage (les mêmes temps, de 0 à la fin) :\n- l'image : ${aOuvrir[0]}\n- le son : ${son}\nOuvre les DEUX avec ton outil de lecture de fichier, en entier : la vidéo te donne l'image, le MP3 te donne le son (les paroles, la musique, les bruits). ${regles}`
        : `${consigne}\n\nLe fichier à regarder (il n'a pas de son) : ${aOuvrir[0]}\nOuvre-le avec ton outil de lecture de fichier, en entier. ${regles}`;
  const args = argsGemini({demande, modele: choisi, reglages: reglagesGemini({lus: [plateau, path.dirname(path.resolve(fichier)), ...competences], web: false})});
  // un essai : la commande lancée, ses événements lus ; la réponse gardée seulement si la vidéo et le son ont été ouverts
  const unEssai = async () => {
    const lire = lecteurGemini();
    let fin = null;
    const ouverts = new Set();
    let tampon = '';
    const ligne = (l) => {
      let j;
      try { j = JSON.parse(l); } catch { return; }
      const x = lire(j);
      if (x.geste?.outil === 'Read') { const f = String(x.geste.entree?.file_path ?? ''); for (const a of (media ? aOuvrir : [fichier])) if (f.endsWith(path.basename(a))) ouverts.add(a); }
      if (x.fin) fin = x.fin;
    };
    try {
      await lancer(etat.chemin, args, {cwd: plateau, env: envSansNavigateur(envIA([], false)).env, dureeMax: delai, silenceMax: Math.min(delai, 5 * 60e3),
        surStdout: (d) => { tampon += d.toString(); const L = tampon.split('\n'); tampon = L.pop(); for (const l of L) ligne(l); }});
      if (tampon.trim()) ligne(tampon);
    } catch (e) { throw new ErreurGemini(genreCommande(e.message), `La commande Gemini : ${court(e.message, 300)}`); }
    if (!fin) throw new ErreurGemini('autre', 'La commande Gemini s’est arrêtée sans répondre.');
    if (fin.erreur) throw new ErreurGemini(genreCommande(fin.erreur), `La commande Gemini : ${court(fin.erreur, 300)}`);
    const manque = (media ? aOuvrir : [fichier]).filter((a) => !ouverts.has(a));
    if (manque.length) throw new ErreurGemini('autre', fin.refus?.length ? `La commande Gemini n’a pas eu le droit d’ouvrir ${quoi}.` : `La commande Gemini a répondu sans ouvrir ${media && !sonSeul && son && !manque.includes(aOuvrir[0]) ? 'le son' : quoi} : sa réponse est écartée.`);
    if (!String(fin.reponse ?? '').trim()) throw new ErreurGemini('vide', 'La commande Gemini n’a rien répondu.');
    return fin.reponse;
  };
  try {
    let texte = await unEssai();
    // il dit n'avoir reçu que les images, pas le son (rare, au hasard, même en MP3 : une fois sur 42 le 15 nov.) : un
    // nouvel essai ; s'il n'entend toujours rien, sa réponse est gardée, marquée « sourd » (le monteur se fiera à Whisper)
    let sourd = !!son && SANS_SON.test(texte);
    if (sourd) { try { const t2 = await unEssai(); if (!SANS_SON.test(t2)) { texte = t2; sourd = false; } } catch { /* la première réponse reste */ } }
    return {texte, modele: choisi, sourd};
  } finally { fs.rmSync(plateau, {recursive: true, force: true}); }
}

/**
 * La porte commune : Gemini regarde (et écoute) un fichier léger et répond à une consigne, par la première voie qui
 * répond (la commande, puis la clé ; voiesGemini). Avec la clé, le fichier part par l'envoi de fichier, ou avec la
 * question s'il est petit (`inline`, moins de 15 Mo). Renvoie {texte, modele, voie, envoye}.
 */
export async function regarderAvecGemini(fichier, mime, consigne, {nom = path.basename(fichier), json = true, inline = false, delai = 10 * 60e3} = {}) {
  const voies = voiesGemini();
  if (!voies.length) throw new ErreurGemini('cle', 'Gemini n’est pas branché : connecte la commande Gemini à ton compte Google, ou colle ta clé, dans Connexions › Mode Hollywood.');
  let derniere = null;
  for (const voie of voies) {
    try {
      if (voie === 'commande') {
        // un raté passager (flux coupé, modèle débordé) : un nouvel essai, dix secondes plus tard
        try { return {...(await demanderParCommande(fichier, consigne, {delai})), voie, envoye: null}; } catch (e) {
          if (e.genre !== 'occupe') throw e;
          await attendre(10000);
          return {...(await demanderParCommande(fichier, consigne, {delai})), voie, envoye: null};
        }
      }
      const taille = fs.statSync(fichier).size;
      const envoye = inline && taille < 15 * 1024 * 1024 ? null : await envoyerAGemini(fichier, mime, nom);
      const media = envoye ? {fileData: {mimeType: envoye.mimeType ?? mime, fileUri: envoye.uri}} : {inlineData: {mimeType: mime, data: fs.readFileSync(fichier).toString('base64')}};
      return {...(await demanderAGemini([media, {text: consigne}], {json, delai})), voie, envoye};
    } catch (e) { derniere = e; }
  }
  throw derniere;
}

/** Le JSON d'une réponse (parfois entouré de ```json … ```). */
export function lireReponseJson(texte) {
  const t = String(texte ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch { /* on cherche l'objet */ }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* illisible */ } }
  return null;
}

// ——— regarder un rush : l'index ———
export const consigneIndex = (nom, duree, audio, contexte = '') => `Tu es le réalisateur de l'équipe (ton rôle et ta grille : AGENTS.md). ${audio ? 'Écoute' : 'Regarde ET écoute'} ce rush en entier (« ${nom} », ${duree.toFixed(1)} s) : c'est le dérushage.
${blocContexte(contexte)}Réponds en JSON, en français, avec exactement cette forme :
{"resume": "ce que ${audio ? 'contient ce son' : 'montre et dit ce rush'}, en deux phrases concrètes",
 "contenu": ["lieux, personnes (sans les nommer), objets, actions : 3 à 8 mots-clés"],
 "lieu": "", "ambiance": "", "personnes": "",
 "moments": [{"de": 0.0, "a": 4.5, "image": "${audio ? '' : 'ce qu’on voit : cadre, action, mouvement de caméra'}", "son": "ce qu'on entend : les paroles (citées quand elles sont courtes), la musique, l'ambiance, les bruits", "interet": 3, "type": "parole"}],
 "repliques": [{"de": 0.0, "a": 2.1, "qui": "qui parle, décrit", "texte": "la phrase, mot pour mot"}],
 "meilleurs": [{"de": 0.0, "a": 3.0, "role": "accroche", "pourquoi": ""}],
 "problemes": [{"de": 0.0, "a": 1.0, "quoi": ""}],
 "texte_a_l_ecran": [{"a": 2.0, "texte": ""}],
 "usage": "à quoi ce rush servira le mieux dans une vidéo, en une phrase",
 "note": 3,
 "conseil": "ce que tu en ferais au montage, en une ou deux phrases : où couper, avec quoi le marier"}
Règles :
- Les temps sont en secondes depuis le début de ce rush, au dixième. Ne donne que des temps que tu as vus ou entendus.
- « moments » couvre tout le rush, dans l'ordre, par passages de 2 à 15 secondes. « interet » : de 1 (à jeter) à 5 (à garder absolument). « type » : parole, action, ambiance, plan de coupe, transition ou raté.
- « repliques » : les phrases qui comptent (pas tout), mot pour mot, avec qui les dit ; une liste vide s'il n'y a pas de parole.
- « meilleurs » : trois au plus, les passages à garder, bornés au mot ou au geste près. « role » : accroche, temoignage, reaction, plan de coupe, ambiance, chute ou transition.
- « problemes » : avec la grille (flou, tremblé, sombre, voix couverte, vent, saturé, son coupé net${audio ? '' : ', doigt devant l’objectif, logo d’appli, texte déjà incrusté, données personnelles lisibles'}, personne qui refuse d'être filmée).
- « note » : de 1 à 5, selon la grille.
- Ne nomme personne : décris (« un jeune en sweat rouge »). N'invente rien : si tu n'es pas sûr, dis-le.`;

/** Nettoie l'index rendu par Gemini : des temps bornés à la durée du rush, des textes courts. */
export function nettoyerIndex(x, duree) {
  const t = (v) => { const n = num(v); return n == null ? null : Math.round(Math.min(Math.max(0, n), duree) * 10) / 10; };
  const liste = (v, max, f) => (Array.isArray(v) ? v : []).map(f).filter(Boolean).slice(0, max);
  return {
    resume: court(x?.resume, 500), lieu: court(x?.lieu, 160), ambiance: court(x?.ambiance, 200), personnes: court(x?.personnes, 300),
    moments: liste(x?.moments, 200, (m) => { const de = t(m?.de); const a = t(m?.a); return de != null && a != null && a > de ? {de, a, image: court(m.image, 300), son: court(m.son, 300), interet: Math.min(5, Math.max(1, Math.round(num(m.interet) ?? 3))), type: court(m.type, 20)} : null; }),
    meilleurs: liste(x?.meilleurs, 12, (m) => { const de = t(m?.de); const a = t(m?.a); return de != null && a != null && a > de ? {de, a, ...(court(m.role, 20) ? {role: court(m.role, 20)} : {}), pourquoi: court(m.pourquoi, 240)} : null; }),
    problemes: liste(x?.problemes, 20, (m) => { const de = t(m?.de); const a = t(m?.a); return de != null && a != null && a >= de ? {de, a, quoi: court(m.quoi, 200)} : null; }),
    texte_a_l_ecran: liste(x?.texte_a_l_ecran, 30, (m) => { const a = t(m?.a); return a != null && court(m?.texte, 1) ? {a, texte: court(m.texte, 160)} : null; }),
    contenu: liste(x?.contenu, 10, (c) => court(c, 40) || null),
    repliques: liste(x?.repliques, 40, (m) => { const de = t(m?.de); const a = t(m?.a); return de != null && court(m?.texte, 1) ? {de, a: a != null && a >= de ? a : de, qui: court(m.qui, 80), texte: court(m.texte, 300)} : null; }),
    usage: court(x?.usage, 200),
    note: num(x?.note) != null ? Math.min(5, Math.max(1, Math.round(num(x.note)))) : null,
    conseil: court(x?.conseil, 300),
  };
}

/**
 * Fait regarder (et écouter) un rush par Gemini : son index, gardé dans le projet (.derush/medias/<id>/gemini.json) et
 * refait seulement si le fichier ou le modèle change. Renvoie {index, modele, deja}.
 */
const EN_REGARD = new Map(); // dossier du rush → la demande en cours : deux demandes pour le même rush n'en font qu'une
export function regarderRush(P, m, options = {}) {
  const k = path.join(P.cache, 'medias', m.id);
  if (!EN_REGARD.has(k)) EN_REGARD.set(k, regarderRushUneFois(P, m, options).finally(() => EN_REGARD.delete(k)));
  return EN_REGARD.get(k);
}
async function regarderRushUneFois(P, m, {source = m.chemin} = {}) {
  const audio = m.type === 'audio';
  const st = fs.statSync(source);
  const D = path.join(P.cache, 'medias', m.id);
  const f = path.join(D, 'gemini.json');
  const v = lireReglages().gemini_api;
  const cle = `${st.size}:${Math.round(st.mtimeMs)}:${VERSION_INDEX}`;
  const deja = lireJson(f);
  if (deja?.cle === cle && deja.index) return {index: deja.index, modele: deja.modele, voie: deja.voie ?? 'cle', deja: true};
  // le même rush en deux fichiers (une copie réexportée) : il reprend le dérushage de son jumeau, Gemini ne le revoit pas
  for (const id of doublonsDe(P, m)) {
    const j = lireJson(path.join(P.cache, 'medias', id, 'gemini.json'));
    if (!j?.index || !String(j.cle ?? '').endsWith(`:${VERSION_INDEX}`)) continue;
    fs.mkdirSync(D, {recursive: true});
    ecrireJson(f, {...j, cle, jumeau: id, cree_le: new Date().toISOString()}, 1);
    return {index: j.index, modele: j.modele, voie: j.voie ?? 'cle', deja: true, jumeau: id};
  }
  const duree = Math.max(0.5, Number(m.duree) || 0);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-gemini-'));
  try {
    const leger = await versionLegere(source, path.join(tmp, audio ? 'son.m4a' : 'rush.mp4'), {video: !audio, duree: Math.min(duree, 45 * 60)});
    const {texte, modele, voie, envoye, sourd} = await regarderAvecGemini(leger, audio ? 'audio/mp4' : 'video/mp4', consigneIndex(m.nom, duree, audio, contexteProjet(P)), {nom: m.nom});
    const brut = lireReponseJson(texte);
    if (!brut) throw new ErreurGemini('autre', 'Gemini a répondu, mais pas dans la forme demandée.');
    const index = nettoyerIndex(brut, duree);
    if (sourd) index.sourd = true; // il n'a eu que les images : le monteur se fie au texte de Whisper pour les paroles
    fs.mkdirSync(D, {recursive: true});
    ecrireJson(f, {cle, modele: modele ?? v?.modele ?? null, voie, cree_le: new Date().toISOString(), fichier: envoye ? {name: envoye.name, uri: envoye.uri, expire_le: envoye.expirationTime ?? null} : null, index}, 1);
    return {index, modele, voie, deja: false};
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}

/**
 * Le dérushage de Gemini dans la forme de l'analyse de Dérush (ia.json : résumé, contenu, moments, défauts, usage,
 * note) : ce que montre la section « Médias », et que l'IA de montage reçoit avec chaque rush.
 */
export function analyseDepuisIndex(x) {
  const force = (de, a) => Math.max(0, ...x.moments.filter((m) => m.a > de && m.de < a).map((m) => m.interet)) || 4;
  return {
    resume: court(x.resume, 400),
    contenu: (x.contenu?.length ? x.contenu : [x.lieu, x.personnes]).map((c) => court(c, 40)).filter(Boolean).slice(0, 10),
    moments: x.meilleurs.slice(0, 4).map((b) => ({debut: b.de, fin: b.a, quoi: court(`${b.role ? `${b.role.charAt(0).toUpperCase()}${b.role.slice(1)} : ` : ''}${b.pourquoi}`, 160), force: force(b.de, b.a)})),
    defauts: x.problemes.slice(0, 5).map((p) => court(`${p.quoi} (${temps(p.de)} → ${temps(p.a)})`, 140)),
    usage: court(x.usage || x.conseil, 200),
    note: x.note ?? 3,
  };
}
/** Range le dérushage de Gemini comme l'analyse d'un média (ia.json), sans écraser celle d'une autre IA. Renvoie le résumé pour m.ia, ou null. */
export function rangerAnalyse(P, m, r, {ecraser = false} = {}) {
  const f = path.join(P.cache, 'medias', m.id, 'ia.json');
  const avant = lireJson(f);
  if (avant && avant.moteur !== 'gemini' && !ecraser) return null;
  const a = analyseDepuisIndex(r.index);
  const d = doublonsDe(P, m);
  const t = accordTexte(P, m, r.index);
  a.defauts = [...(d.length ? [`Le même rush que ${d.join(', ')} (en double)`] : []), ...(t?.etat === 'whisper_seul' ? [`Texte automatique faux (${t.musique ? 'musique' : 'pas de parole'})`] : []), ...(r.index.sourd ? ['Son non entendu par Gemini : texte de Whisper à vérifier'] : []), ...a.defauts].slice(0, 5);
  const quand = new Date().toISOString();
  fs.mkdirSync(path.dirname(f), {recursive: true});
  ecrireJson(f, {...a, moteur: 'gemini', modele: r.modele ?? null, cree_le: quand});
  return {resume: a.resume, note: a.note, moments: a.moments.length, cree_le: quand};
}

// ——— l'alliance : Whisper et Gemini pour le texte, Dérush pour les doublons ———
const normTexte = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const motsDe = (t) => normTexte(t).split(' ').filter((w) => w.length >= 3);
/**
 * Le texte automatique (Whisper : chaque mot et son temps) et ce que Gemini entend se vérifient l'un l'autre. Whisper
 * invente souvent sur une musique, un bruit ou un silence (« Sous-titres par… », « J'abite. J'abite… ») ; Gemini sait
 * si c'est une parole, et qui parle. Renvoie {etat, extrait, musique}, ou null s'il n'y a rien à comparer :
 * « whisper_seul » (des mots écrits, mais Gemini n'entend aucune parole nette), « gemini_seul » (Gemini cite des
 * paroles que Whisper n'a pas), « differents » (pas les mêmes mots), « ok ».
 */
export function accordTexte(P, m, x) {
  if (x.sourd) return null; // il n'a pas entendu ce rush : rien à comparer
  const mots = (lireJson(path.join(P.cache, 'medias', m.id, 'mots.json'))?.mots ?? []).filter((w) => !w.ev);
  const texteW = mots.map((w) => w.t).join(' ').replace(/\s+(?=['’.,!?…])/g, '').trim();
  const motsW = new Set(motsDe(texteW));
  const sons = x.moments.map((y) => y.son).join(' ');
  const parleG = (x.repliques?.length ?? 0) > 0 || /«/.test(sons);
  const musique = /\b(musique|chanson|chant|chante)/.test(normTexte(sons));
  const motsG = motsDe((x.repliques ?? []).map((r) => r.texte).join(' '));
  if (motsW.size >= 3 && !parleG) return {etat: 'whisper_seul', extrait: court(texteW, 90), musique};
  if (motsG.length >= 3 && motsW.size < 2) return {etat: 'gemini_seul', extrait: '', musique};
  if (motsG.length >= 4 && motsW.size >= 4 && motsG.filter((w) => motsW.has(w)).length / motsG.length < 0.4) return {etat: 'differents', extrait: court(texteW, 90), musique};
  return motsW.size || motsG.length ? {etat: 'ok', extrait: '', musique} : null;
}
const texteAutoEnMots = (a) => (!a || a.etat === 'ok' ? '' : a.etat === 'whisper_seul'
  ? `⚠️ Le texte automatique (Whisper) a écrit « ${a.extrait} », mais Gemini n'entend ${a.musique ? 'que de la musique' : 'aucune parole nette'} : ne le sous-titre pas sans vérifier.`
  : a.etat === 'gemini_seul' ? '⚠️ Le texte automatique est vide, mais Gemini entend des paroles (ses répliques, plus bas) : sous-titre à partir d’elles, en vérifiant les temps.'
    : `⚠️ Whisper et Gemini n'entendent pas les mêmes mots (Whisper : « ${a.extrait} ») : pour le sens, préfère les répliques de Gemini ; pour couper, les temps de Whisper.`);

/**
 * Les doublons d'un rush : le même rush en deux fichiers (une copie réexportée, un envoi en double), reconnus par Dérush
 * sans IA, à la durée (au quart de seconde) et à la courbe du son (presque la même, crête par crête). Gemini, qui regarde
 * un rush à la fois, ne peut pas les voir. Renvoie les ids des autres fichiers du même rush.
 */
export function doublonsDe(P, m) {
  const courbe = (x) => lireJson(path.join(P.cache, 'medias', x.id, 'ondes.json'))?.niveaux ?? null;
  const a = courbe(m);
  if (!a || a.length < 50) return [];
  const correle = (u, v) => {
    const n = Math.min(u.length, v.length);
    let su = 0; let sv = 0;
    for (let i = 0; i < n; i++) { su += u[i]; sv += v[i]; }
    const mu = su / n; const mv = sv / n;
    let c = 0; let du = 0; let dv = 0;
    for (let i = 0; i < n; i++) { c += (u[i] - mu) * (v[i] - mv); du += (u[i] - mu) ** 2; dv += (v[i] - mv) ** 2; }
    return du > n && dv > n ? c / Math.sqrt(du * dv) : 0; // un son plat (silence) ne prouve rien
  };
  return P.d.medias.filter((x) => x !== m && x.type === m.type && x.duree > 0 && Math.abs(x.duree - m.duree) <= 0.25)
    .filter((x) => { const b = courbe(x); return b && correle(a, b) > 0.97; }).map((x) => x.id);
}

/** L'index d'un rush déjà regardé (ou null). */
export const indexDe = (P, m) => lireJson(path.join(P.cache, 'medias', m.id, 'gemini.json'))?.index ?? null;

const temps = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
/** L'index d'un rush, en Markdown (pour l'IA de montage). */
export function indexEnTexte(m, x, {texte = null, doublons = []} = {}) {
  const L = [`## ${m.id} — ${m.nom}${m.duree ? ` (${temps(m.duree)})` : ''}`, ''];
  if (doublons.length) L.push(`⚠️ Le même rush que ${doublons.join(', ')} (le même fichier en deux exemplaires) : n'en garde qu'un.`, '');
  if (x.sourd) L.push('⚠️ Gemini n’a pas pu entendre ce rush (la commande ne lui a donné que les images) : pour les paroles et le son, fie-toi au texte de Whisper et vérifie à l’écoute.', '');
  if (x.resume) L.push(x.resume, '');
  if (texteAutoEnMots(texte)) L.push(texteAutoEnMots(texte), '');
  const infos = [['Note du réalisateur', x.note ? `${x.note}/5` : ''], ['Usage', x.usage], ['Conseil', x.conseil], ['Lieu', x.lieu], ['Ambiance', x.ambiance], ['Personnes', x.personnes], ['Contenu', (x.contenu ?? []).join(', ')]].filter(([, v]) => v);
  if (infos.length) L.push(...infos.map(([k, v]) => `- ${k} : ${v}`), '');
  if (x.meilleurs.length) L.push('**Les meilleurs moments** :', ...x.meilleurs.map((b) => `- ${temps(b.de)} → ${temps(b.a)}${b.role ? ` (${b.role})` : ''} : ${b.pourquoi}`), '');
  if (x.repliques?.length) L.push('**Les répliques** :', ...x.repliques.map((b) => `- ${temps(b.de)}${b.qui ? ` — ${b.qui}` : ''} : « ${b.texte} »`), '');
  if (x.problemes.length) L.push('**Défauts** :', ...x.problemes.map((b) => `- ${temps(b.de)} → ${temps(b.a)} : ${b.quoi}`), '');
  if (x.texte_a_l_ecran.length) L.push('**Texte filmé** :', ...x.texte_a_l_ecran.map((b) => `- à ${temps(b.a)} : « ${b.texte} »`), '');
  if (x.moments.length) L.push('**Moment par moment** (intérêt de 1 à 5) :', ...x.moments.map((b) => `- ${temps(b.de)} → ${temps(b.a)} [${b.interet}${b.type ? ` · ${b.type}` : ''}] ${[b.image, b.son ? `son : ${b.son}` : ''].filter(Boolean).join(' — ')}`), '');
  return L.join('\n');
}

/**
 * Avant le montage : Gemini regarde et écoute les rushes (ceux du montage, sinon tous ; 3 heures au plus ; ceux qu'il a
 * déjà vus comptent toujours), deux ou trois à la fois, puis Dérush pose l'index dans le dossier de travail (contexte/gemini/). Un rush déjà regardé ne repart pas.
 * `budgetMs` : le montage n'attend pas plus ; ce qui n'est pas fini continue en fond (pour la demande suivante, et pour
 * derush-gemini). Renvoie {rushes, nouveaux, restants, erreurs, arret} ; s'arrête net sur une clé refusée ou un quota.
 */
const EN_FOND = new Map(); // racine du projet → promesse : un seul regard de fond à la fois par projet
export async function regarderPourMontage(P, atelier, {noter = () => {}, annule = () => false, budgetMs = 4 * 60e3} = {}) {
  const utilises = P.d.montage.length ? new Set([...P.d.montage, ...(P.d.superpositions ?? [])].map((it) => it.media).filter(Boolean)) : null;
  // un rush déjà vu compte toujours (rien à attendre : le réalisateur choisit parmi tout ce qu'il a vu) ; à regarder
  // maintenant : ceux du montage s'il y en a un, sinon tous, trois heures au plus
  let total = 0;
  const liste = P.d.medias.filter((m) => (m.type === 'video' || m.type === 'audio') && m.duree > 0 && fs.existsSync(m.chemin))
    .filter((m) => {
      if (indexDe(P, m)) return true;
      if (utilises && !utilises.has(m.id)) return false;
      total += m.duree;
      return total <= 3 * 3600;
    });
  const res = {rushes: 0, nouveaux: 0, restants: 0, erreurs: [], arret: null, analyses: 0};
  const fin = Date.now() + budgetMs;
  let k = 0;
  const suivant = async () => {
    while (k < liste.length && !res.arret && !annule() && Date.now() < fin) {
      const m = liste[k++];
      try {
        const r = await (async () => {
          if (!indexDe(P, m)) noter('oeil', `Gemini regarde et écoute « ${m.nom} » (${k}/${liste.length})`);
          return regarderRush(P, m);
        })();
        // son dérushage devient aussi l'analyse du média (section « Médias »), si aucune autre IA ne l'a déjà faite
        try { const ia = rangerAnalyse(P, m, r); if (ia) { m.ia = ia; res.analyses = (res.analyses ?? 0) + 1; } } catch { /* l'index suffit */ }
        res.rushes++;
        if (!r.deja) res.nouveaux++;
      } catch (e) {
        if (['cle', 'quota'].includes(e.genre)) res.arret = e.message;
        else res.erreurs.push(`${m.nom} : ${e.message}`);
      }
    }
  };
  // trois à la fois par la clé ; deux par la commande (chaque commande démarre aussi son propre serveur)
  const travail = Promise.all(Array.from({length: voiesGemini()[0] === 'commande' ? 2 : 3}, () => suivant()));
  await Promise.race([travail, attendre(Math.max(0, budgetMs))]);
  // ce qui reste : regardé en fond (le montage commence sans l'attendre), une seule fois par projet
  const restants = liste.filter((m) => !indexDe(P, m));
  res.restants = restants.length;
  if (res.analyses) { try { P.sauver?.(); } catch { /* le projet sera sauvé plus tard */ } }
  if (restants.length && !res.arret && !EN_FOND.has(P.racine)) {
    const fond = travail.then(async () => {
      for (const m of liste.filter((x) => !indexDe(P, x))) { try { await regarderRush(P, m); } catch (e) { if (['cle', 'quota'].includes(e.genre)) break; } }
    }).catch(() => {}).finally(() => EN_FOND.delete(P.racine));
    EN_FOND.set(P.racine, fond);
  }
  if (!atelier) return res;
  // l'index dans le dossier de travail
  const G = path.join(atelier, 'contexte', 'gemini');
  fs.rmSync(G, {recursive: true, force: true});
  const vus = liste.map((m) => [m, indexDe(P, m)]).filter(([, x]) => x);
  if (vus.length) {
    fs.mkdirSync(G, {recursive: true});
    // ce que Dérush ajoute : le texte automatique vérifié par Gemini, et les doublons (le même rush en deux fichiers)
    const plus = new Map(vus.map(([m, x]) => [m.id, {texte: accordTexte(P, m, x), doublons: doublonsDe(P, m)}]));
    for (const [m, x] of vus) ecrireJson(path.join(G, `${m.id}.json`), {id: m.id, nom: m.nom, duree: m.duree, ...x, texte_auto: plus.get(m.id).texte, doublons: plus.get(m.id).doublons}, 1);
    const paires = [...new Set(vus.flatMap(([m]) => plus.get(m.id).doublons.map((d) => [m.id, d].sort().join(' = '))))];
    const douteux = vus.filter(([m]) => plus.get(m.id).texte?.etat === 'whisper_seul').map(([m]) => m.id);
    fs.writeFileSync(path.join(G, 'INDEX.md'), [`# Ce que Gemini a vu et entendu dans tes rushes`, '',
      `${vus.length} rush${vus.length > 1 ? 's' : ''}, regardés et écoutés par Gemini (une image par seconde, le son en entier)${res.restants ? ` ; ${res.restants} autre${res.restants > 1 ? 's' : ''} pas encore (Gemini continue : derush-gemini peut t'en dire plus sur un passage)` : ''}. Les temps partent du début de chaque rush. C'est un repère, pas une vérité : vérifie toujours avec les images et le texte du rush avant de couper.`, '',
      ...(paires.length ? [`**Doublons** (le même rush en deux fichiers, reconnus par Dérush à la durée et au son) : ${paires.join(' · ')}. N'en garde qu'un de chaque.`, ''] : []),
      ...(douteux.length ? [`**Texte automatique à ne pas croire** (Whisper a écrit des mots où Gemini n'entend aucune parole : musique, bruit ou silence) : ${douteux.join(', ')}.`, ''] : []),
      ...vus.map(([m, x]) => indexEnTexte(m, x, plus.get(m.id)))].join('\n'));
  }
  res.rushes = vus.length;
  return res;
}

// ——— les questions du monteur : un passage, ou sa vidéo finie avant de la livrer ———
const tempsCourt = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`);
/**
 * Le contrôle d'une vidéo finie par le réalisateur (15 minutes au plus) : sa note, ce qui marche et ce qui coince, ses
 * remarques avec les temps. En texte, pour le monteur (derush-gemini --controle, ou le relais pour une IA dans un bac à
 * sable). `contexte` : pour qui est la vidéo (contexte/espace/ESPACE.md).
 */
export async function controlerVideo(video, {titre = null, contexte = ''} = {}) {
  let duree = null;
  try { const {out} = await lancer(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]); duree = Number(String(out).trim()) || null; } catch { /* durée inconnue */ }
  if (duree && duree > 15 * 60) throw new ErreurGemini('autre', '15 minutes au plus pour un contrôle : contrôle ta vidéo par morceaux (derush-gemini <fichier> <de> <à> "…").');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-gemini-'));
  try {
    const leger = await versionLegere(video, path.join(tmp, 'controle.mp4'));
    const {texte, modele, voie} = await regarderAvecGemini(leger, 'video/mp4', consigneAvis(titre, duree, contexte), {delai: 10 * 60e3});
    const a = lireAvis(texte, duree);
    const corriger = a.remarques.filter((r) => r.gravite === 'a_corriger');
    return `Le contrôle du réalisateur (Gemini · ${voie === 'commande' ? nomCommande(modele) : modele}) : ${a.note ?? '?'}/10\n${a.resume}\n\n${a.remarques.length ? a.remarques.map((r) => `- ${tempsCourt(r.a)} [${r.gravite === 'a_corriger' ? 'à corriger' : 'à regarder'}] ${r.quoi}${r.conseil ? ` → ${r.conseil}` : ''}`).join('\n') : '- Rien à corriger.'}\n\n${corriger.length ? `${corriger.length} point${corriger.length > 1 ? 's' : ''} à corriger avant de livrer. Ses temps sont à une image par seconde : vérifie-les avec les images.` : 'Rien à corriger : tu peux livrer.'}\n`;
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}
/** Une question du monteur sur un passage (90 secondes au plus) d'un rush ou d'une vidéo. En texte, avec ses temps depuis le début du fichier. */
export async function questionPassage(fichier, {de, a, question}) {
  if (!Number.isFinite(de) || !Number.isFinite(a) || !String(question ?? '').trim()) throw new ErreurGemini('autre', 'il manque quelque chose. Écris : derush-gemini <rush ou fichier> <de> <à> "ta question" (aide : derush-gemini --help).');
  if (!(a > de) || de < 0) throw new ErreurGemini('autre', 'le passage doit aller de <de> à <à>, avec <à> plus grand que <de>.');
  if (a - de > 90) throw new ErreurGemini('autre', '90 secondes au plus par question : découpe ton passage.');
  const son = /\.(m4a|mp3|wav|aac|aiff?|flac|ogg)$/i.test(fichier);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-gemini-'));
  try {
    const leger = await versionLegere(fichier, path.join(tmp, son ? 'passage.m4a' : 'passage.mp4'), {de, duree: a - de, video: !son});
    // par la commande Gemini, sinon par la clé (un court passage part alors avec la question ; plus lourd, par l'envoi de fichier)
    const {texte, modele, voie} = await regarderAvecGemini(leger, son ? 'audio/mp4' : 'video/mp4', `Tu aides un monteur vidéo. Voici un passage de « ${path.basename(fichier)} », de ${de.toFixed(1)} s à ${a.toFixed(1)} s (le passage commence à 0 dans ce que tu reçois). ${son ? 'Écoute-le' : 'Regarde-le ET écoute-le'}, puis réponds à sa question, en français, en quelques phrases précises. Donne tes temps en secondes depuis le début du fichier : ajoute ${de.toFixed(1)} s aux temps du passage. Si tu n'es pas sûr, dis-le.\n\nSa question : ${String(question).trim()}`, {json: false, inline: true, delai: 5 * 60e3});
    return `${texte.trim()}\n\n(Gemini · ${voie === 'commande' ? nomCommande(modele) : modele} · passage de ${de.toFixed(1)} à ${a.toFixed(1)} s de ${path.basename(fichier)} ; des repères à une image par seconde, à vérifier avec les images.)\n`;
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}

// ——— le découpage proposé par le réalisateur ———
const consigneDecoupage = (demande, n, contexte = '') => `Tu es le réalisateur de l'équipe (ton rôle et ta grille : AGENTS.md). Tu as dérushé ${n} rush${n > 1 ? 's' : ''} : ton dérushage est dans le fichier à lire (rush par rush : ce qu'on voit et entend, les répliques, les meilleurs moments, les défauts, ta note et ton conseil, avec leurs temps).
${blocContexte(contexte)}La demande de la personne au monteur : « ${demande} »
Propose le découpage de cette vidéo : quels passages, dans quel ordre, coupés où, et pourquoi. Le monteur (Claude) le construira (textes, sous-titres, musique, effets) et pourra s'en écarter en le disant. Avant de choisir, lis editing-montage, cutting-rhythm et viral-hooks dans .agents/skills/ (et la compétence de la plateforme visée, s'il y en a une).
Réponds en JSON, en français :
{"idee": "la vidéo en une phrase : ce qu'elle raconte, et pourquoi on la regarde jusqu'au bout",
 "duree": 30, "format": "9:16",
 "accroche": "ce qui ouvre la vidéo, et pourquoi ça arrête le pouce",
 "plans": [{"rush": "M12", "de": 4.2, "a": 7.9, "role": "accroche", "pourquoi": "", "texte": "un texte à l'écran, s'il en faut un"}],
 "son": "la voix, la musique, les ambiances : ce qui porte la vidéo",
 "rythme": "le rythme des coupes, en une phrase",
 "a_eviter": ["ce qu'il ne faut surtout pas montrer, avec le rush et les temps"]}
Règles : seulement des rushes et des temps de ton dérushage (une réplique coupée au mot près, un geste entier) ; la durée totale des plans proche de « duree » ; si la demande ne dit ni durée ni format, choisis ce qui sert le mieux la vidéo (vertical, de 20 à 45 s, pour un réseau).`;

/** Le découpage rendu par Gemini, vérifié : des rushes qui existent, des temps dans leur durée. */
export function lireDecoupage(texte, medias) {
  const x = lireReponseJson(texte);
  if (!x || !Array.isArray(x.plans)) return null;
  const parId = new Map(medias.map((m) => [m.id, m]));
  const plans = x.plans.map((p) => {
    const m = parId.get(String(p?.rush ?? '').trim());
    const de = num(p?.de); const a = num(p?.a);
    if (!m || de == null || a == null) return null;
    const fin = Math.min(a, Number(m.duree) || a);
    return fin > de && de >= 0 ? {rush: m.id, nom: m.nom, de: Math.round(de * 10) / 10, a: Math.round(fin * 10) / 10, role: court(p.role, 20), pourquoi: court(p.pourquoi, 240), texte: court(p.texte, 120)} : null;
  }).filter(Boolean).slice(0, 40);
  if (!plans.length) return null;
  return {idee: court(x.idee, 300), duree: num(x.duree), format: court(x.format, 12), accroche: court(x.accroche, 300), plans,
    total: Math.round(plans.reduce((n, p) => n + p.a - p.de, 0) * 10) / 10, son: court(x.son, 300), rythme: court(x.rythme, 200),
    a_eviter: (Array.isArray(x.a_eviter) ? x.a_eviter : []).map((t) => court(t, 200)).filter(Boolean).slice(0, 8)};
}
/** Le découpage en Markdown, pour le monteur. */
export function decoupageEnTexte(d) {
  return [`# Le découpage proposé par le réalisateur (Gemini)`, '',
    `**L'idée** : ${d.idee}`, `**Durée visée** : ${d.duree ? `${d.duree} s` : 'libre'} · **format** : ${d.format || 'libre'} · **total des plans** : ${d.total} s`, `**L'accroche** : ${d.accroche}`, '',
    '| # | Rush | De → à | Rôle | Pourquoi | Texte à l’écran |', '|---|---|---|---|---|---|',
    ...d.plans.map((p, i) => `| ${i + 1} | ${p.rush} | ${temps(p.de)} → ${temps(p.a)} | ${p.role} | ${p.pourquoi.replace(/\|/g, '/')} | ${p.texte.replace(/\|/g, '/')} |`), '',
    ...(d.son ? [`**Le son** : ${d.son}`] : []), ...(d.rythme ? [`**Le rythme** : ${d.rythme}`] : []),
    ...(d.a_eviter.length ? ['', '**À éviter** :', ...d.a_eviter.map((t) => `- ${t}`)] : []), '',
    'C’est une proposition : tu restes le monteur. Vérifie chaque coupe sur les images et le texte des rushes (au mot près), et dis pourquoi dans ton compte rendu si tu t’en écartes.'].join('\n');
}
/**
 * Après le dérushage, le réalisateur propose le découpage de la vidéo demandée (une fois, d'après son index ; il lit
 * editing-montage, cutting-rhythm et viral-hooks). Posé dans contexte/gemini/DECOUPAGE.md et decoupage.json. Renvoie
 * le découpage, ou null (pas d'index, pas de demande, ou Gemini n'a pas répondu à temps : le montage part sans).
 */
export async function proposerDecoupage(P, atelier, demande, {delai = 6 * 60e3} = {}) {
  const G = path.join(atelier, 'contexte', 'gemini');
  const index = path.join(G, 'INDEX.md');
  if (!fs.existsSync(index) || !String(demande ?? '').trim()) return null;
  const n = fs.readdirSync(G).filter((f) => /^M\d+\.json$/.test(f)).length;
  const consigne = consigneDecoupage(court(demande, 1500), n, contexteProjet(P));
  let derniere = null;
  for (const voie of voiesGemini()) {
    try {
      const {texte} = voie === 'commande'
        ? await demanderParCommande(index, consigne, {delai, quoi: 'ton dérushage'})
        : await demanderAGemini([{text: `${consigne}\n\n${fs.readFileSync(index, 'utf8')}`}], {delai});
      const d = lireDecoupage(texte, P.d.medias);
      if (!d) throw new ErreurGemini('autre', 'Le découpage rendu par Gemini est illisible.');
      ecrireJson(path.join(G, 'decoupage.json'), {...d, voie, cree_le: new Date().toISOString()}, 1);
      fs.writeFileSync(path.join(G, 'DECOUPAGE.md'), decoupageEnTexte(d));
      return d;
    } catch (e) { derniere = e; }
  }
  if (derniere) throw derniere;
  return null;
}

// ——— le dérushage en fond : Gemini regarde chaque rush dès qu'il est prêt ———
const OEIL = new Map(); // racine du projet → {P, attente, en_cours, faits, total, erreurs, arret}
const enParallele = () => (voiesGemini()[0] === 'commande' ? 2 : 3);
/**
 * Mode Hollywood : Gemini regarde et écoute ces rushes en fond, deux à la fois (trois par la clé), sans rien bloquer :
 * dès qu'un rush est préparé à l'import, ou quand on passe en Hollywood (ceux du projet qu'il n'a pas encore vus). Un
 * rush déjà regardé, en route ou en attente ne repart pas ; trois heures de rushes au plus par projet. Son dérushage
 * devient aussi l'analyse du média. S'arrête sur un quota, une clé refusée, une commande déconnectée ou le mode coupé.
 */
export function regarderEnFond(P, medias) {
  if (!P || !hollywoodActif()) return null;
  let o = OEIL.get(P.racine);
  if (!o || (!o.en_cours.size && !o.attente.length)) { o = {P, attente: [], en_cours: new Set(), faits: 0, total: 0, secondes: o?.secondes ?? 0, erreurs: [], arret: null}; OEIL.set(P.racine, o); }
  o.P = P;
  o.arret = null;
  for (const m of medias) {
    if ((m.type !== 'video' && m.type !== 'audio') || !(m.duree > 0) || m.etat === 'erreur' || !m.chemin || !fs.existsSync(m.chemin)) continue;
    if (o.attente.includes(m.id) || o.en_cours.has(m.id) || indexDe(P, m)) continue;
    if (o.secondes + m.duree > 3 * 3600) break;
    o.secondes += m.duree;
    o.attente.push(m.id);
    o.total++;
  }
  while (o.en_cours.size < enParallele() && o.attente.length && !o.arret) regarderLeSuivant(o);
  return etatOeil(P);
}
function regarderLeSuivant(o) {
  const id = o.attente.shift();
  const m = o.P.d.medias.find((x) => x.id === id);
  if (!m) return;
  o.en_cours.add(id);
  regarderRush(o.P, m).then((r) => {
    o.faits++;
    // le projet a été relu entre-temps (ou le rush retiré) : l'index est gardé, mais rien n'est réécrit dans l'ancien état
    if (!o.P.d.medias.includes(m)) return;
    const ia = rangerAnalyse(o.P, m, r);
    if (ia) { m.ia = ia; try { o.P.sauver?.(); } catch { /* sauvé plus tard */ } }
  }).catch((e) => {
    o.erreurs.push(`${m.nom} : ${e.message}`);
    if (['quota', 'cle', 'commande'].includes(e.genre)) o.arret = e.message;
  }).finally(() => {
    o.en_cours.delete(id);
    if (!hollywoodActif()) o.arret ??= 'Mode Hollywood coupé : Gemini s’arrête.';
    while (o.en_cours.size < enParallele() && o.attente.length && !o.arret) regarderLeSuivant(o);
  });
}
/** Où en est le dérushage en fond d'un projet (ou null s'il n'y en a jamais eu). */
export function etatOeil(P) {
  const o = P ? OEIL.get(P.racine) : null;
  if (!o) return null;
  const noms = [...o.en_cours].map((id) => o.P.d.medias.find((x) => x.id === id)?.nom).filter(Boolean);
  return {en_cours: [...o.en_cours], noms, attente: o.attente.length, faits: o.faits, total: o.total, erreurs: o.erreurs.length,
    derniere_erreur: o.erreurs.at(-1) ?? null, arret: o.arret, fini: !o.en_cours.size && (!o.attente.length || !!o.arret)};
}
/** Arrête le dérushage en fond (les rushes en route finissent ; ceux en attente ne partent pas). */
export function arreterOeil(P) { const o = P ? OEIL.get(P.racine) : null; if (o) { o.attente = []; o.arret = 'Arrêté.'; } return etatOeil(P); }

/** La consigne du Mode Hollywood, redite à chaque demande quand l'index est posé. */
export const consigneHollywood = (r) => (r?.rushes
  ? `- Mode Hollywood : tu travailles avec Gemini, le réalisateur de l'équipe. Lui seul a regardé ET écouté tes rushes (${r.rushes}) ; toi, tu es le monteur.
  1. Son dérushage : contexte/gemini/INDEX.md (rush par rush : ce qu'on voit et entend, les répliques mot pour mot avec qui parle, les meilleurs moments, les défauts, sa note et son conseil ; contexte/gemini/<id>.json : les mêmes, en JSON). Lis-le avant de choisir tes passages.${r.decoupage ? `
  2. Son découpage pour cette demande : contexte/gemini/DECOUPAGE.md (${r.decoupage.plans.length} plans, ${r.decoupage.total} s). Pars de lui : vérifie chaque coupe sur les images et le texte des rushes (au mot près) ; si tu t'en écartes, dis pourquoi dans ton compte rendu.` : ''}
  ${r.decoupage ? 3 : 2}. Une question précise sur un passage (« à quel moment il rit ? », « la voix est-elle propre entre 12 et 18 s ? ») : « derush-gemini <id du rush> <de> <à> "ta question" » (aide : derush-gemini --help).
  ${r.decoupage ? 4 : 3}. Avant de livrer : « derush-gemini --controle <ta vidéo finale> ». Il la regarde et l'écoute en entier, comme un réalisateur, et rend sa note et ses remarques avec les temps. Corrige ce qu'il marque « à corriger » (une passe, puis un nouveau contrôle si tu as beaucoup changé), puis livre ; dis dans ton compte rendu ce qu'il a vu et ce que tu as corrigé.
  Ses temps sont à une image par seconde : vérifie-les avec les images avant de couper.`
  : '');

// ——— l'avis de Gemini sur une vidéo livrée ———
const fichierAvis = (P, video) => path.join(P.cache, 'gemini', `${path.basename(String(video)).replace(/\.mp4$/i, '')}.json`);
const AVIS_EN_COURS = new Map();
export const avisGemini = (P, video) => (AVIS_EN_COURS.has(`${P.racine}|${video}`) ? {etat: 'en_cours'} : lireJson(fichierAvis(P, video)));

/**
 * Gemini regarde et écoute une vidéo livrée, comme un contrôleur : ce qui est à corriger (texte coupé ou faux,
 * sous-titres décalés, voix couverte, son qui sature, coupe brutale, image noire…), avec les temps. En tâche de fond :
 * la livraison n'attend pas. Rangé dans .derush/gemini/<vidéo>.json.
 */
/** La consigne du contrôle d'une vidéo finie : le réalisateur la regarde et l'écoute en entier. */
export const consigneAvis = (titre, duree, contexte = '') => `Tu es le réalisateur de l'équipe (ton rôle et ta grille : AGENTS.md), et tu contrôles le montage avant qu'il parte. Regarde ET écoute cette vidéo finie${titre ? ` (« ${titre} »)` : ''}${duree ? `, qui dure ${Number(duree).toFixed(1)} s` : ''}, faite pour les réseaux.
${blocContexte(contexte)}Réponds en JSON, en français : {"note": 7, "resume": "ce qui marche et ce qui coince, en deux phrases", "remarques": [{"a": 12.3, "gravite": "a_corriger", "quoi": "", "conseil": ""}]}
Cherche : une accroche qui n'arrête pas le pouce ; un texte coupé, illisible ou avec une faute ; des sous-titres décalés de la voix ou qui sautent des mots ; une voix couverte par la musique, un son qui sature ou qui s'arrête net ; une coupe brutale, au milieu d'un mot ou d'un geste ; une image noire, figée ou floue ; des données personnelles lisibles ; une fin abrupte. « note » : sur 10. « gravite » : a_corriger ou a_regarder. Les temps en secondes depuis le début. Dix remarques au plus, les plus importantes d'abord ; aucune si tout va bien.`;
/** L'avis rendu par Gemini, nettoyé : un temps au-delà de la fin est faux (la remarque reste, sans lui). */
export function lireAvis(texte, duree = null) {
  const x = lireReponseJson(texte) ?? {};
  const dansLaVideo = (a) => a != null && a >= 0 && (!duree || a <= Number(duree) + 0.5);
  const remarques = (Array.isArray(x.remarques) ? x.remarques : []).map((r) => { const a = num(r?.a); return {a: dansLaVideo(a) ? Math.round(a * 10) / 10 : null, gravite: r?.gravite === 'a_corriger' ? 'a_corriger' : 'a_regarder', quoi: court(r?.quoi, 240), conseil: court(r?.conseil, 240)}; }).filter((r) => r.quoi).slice(0, 10);
  return {note: num(x.note) != null ? Math.min(10, Math.max(0, num(x.note))) : null, resume: court(x.resume, 500), remarques};
}

/**
 * Gemini regarde et écoute une vidéo livrée, comme un contrôleur : ce qui est à corriger (texte coupé ou faux,
 * sous-titres décalés, voix couverte, son qui sature, coupe brutale, image noire…), avec les temps. En tâche de fond :
 * la livraison n'attend pas. Rangé dans .derush/gemini/<vidéo>.json.
 */
export function lancerAvisGemini(P, video, {titre = null, duree = null} = {}) {
  const cle = `${P.racine}|${video}`;
  if (AVIS_EN_COURS.has(cle)) return;
  const f = path.join(P.racine, 'vidéos', path.basename(String(video)));
  if (!fs.existsSync(f)) return;
  AVIS_EN_COURS.set(cle, true);
  (async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-gemini-'));
    try {
      const leger = await versionLegere(f, path.join(tmp, 'video.mp4'));
      const {texte, modele, voie} = await regarderAvecGemini(leger, 'video/mp4', consigneAvis(titre, duree, contexteProjet(P)), {nom: path.basename(f)});
      fs.mkdirSync(path.dirname(fichierAvis(P, video)), {recursive: true});
      ecrireJson(fichierAvis(P, video), {etat: 'fini', modele, voie, ...lireAvis(texte, duree), cree_le: new Date().toISOString()}, 1);
    } catch (e) {
      try { fs.mkdirSync(path.dirname(fichierAvis(P, video)), {recursive: true}); ecrireJson(fichierAvis(P, video), {etat: 'erreur', erreur: e.message, cree_le: new Date().toISOString()}, 1); } catch { /* rien à ranger */ }
    } finally {
      fs.rmSync(tmp, {recursive: true, force: true});
      AVIS_EN_COURS.delete(cle);
    }
  })();
}
