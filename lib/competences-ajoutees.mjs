// Dérush — « Ajouter une compétence » : une compétence d'ailleurs (un dossier avec un SKILL.md, sur GitHub), trouvée
// par un lien collé ou dans l'annuaire skills.sh, téléchargée à une version précise dans le dossier de Dérush.
//
// L'idée vient de « npx skills » (Vercel), refaite ici sans dépendance et sans télémétrie :
// - rien n'est envoyé à Vercel : seule une recherche dans l'annuaire, sur un clic, passe par skills.sh ;
// - Dérush lit tout avant de proposer : la licence, les fichiers, les programmes, les adresses web, les clés demandées,
//   les consignes risquées ; il refuse une compétence qui contient un programme compilé ou une archive (chaque fichier
//   est reconnu à ses premiers octets, quelle que soit sa taille), et signale un fichier qu'il ne sait pas relire ;
// - il ne lance jamais le code d'une compétence ajoutée et ne lui fabrique aucune commande (lib/competences.mjs) ;
//   ce que Claude Code lancerait de lui-même à sa lecture (« hooks », « !`commande` », droits que la compétence se
//   donne) est retiré de son SKILL.md à l'ajout, et noté dans SOURCE.md ;
//   l'IA la lit comme les autres, avec la consigne de ne pas lancer ce qui installe ou envoie quelque chose ;
// - chaque compétence garde sa provenance (dépôt, commit, licence, date) dans SOURCE.md et dans le registre, pour
//   vérifier plus tard s'il y a du nouveau, et mettre à jour d'un clic.
// Les adresses se changent pour les essais : DERUSH_GITHUB_API, DERUSH_GITHUB_ARCHIVES, DERUSH_ANNUAIRE_COMPETENCES.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {DOSSIER_AJOUTEES, REGISTRE_AJOUTEES, registreAjoutees, listerCompetences, oublierCompetences, enteteSkill, risquesSkill, desarmerSkill, lireCorpsBorne, ouvrirArchive, BORNES_ARCHIVE} from './competences.mjs';

const API_GITHUB = () => process.env.DERUSH_GITHUB_API || 'https://api.github.com';
const ARCHIVES = () => process.env.DERUSH_GITHUB_ARCHIVES || 'https://codeload.github.com';
const ANNUAIRE = () => process.env.DERUSH_ANNUAIRE_COMPETENCES || 'https://skills.sh';
const ENTETES = {'user-agent': 'Derush', accept: 'application/vnd.github+json'};

/** Les bornes : une archive, ce qu'elle contient, une compétence. */
export const LIMITES = {...BORNES_ARCHIVE, competence: 25 * 1024 * 1024, fichiersCompetence: 800};
const DUREE_EXPLORATION = 30 * 60e3;
// ce qui ne sert pas à l'IA (gestion du dépôt, essais, caches) : ni lu, ni copié
const IGNORES = new Set(['.git', 'node_modules', '__pycache__', '__pypackages__', '.DS_Store', '.venv', 'venv', '.github', '.gitlab', '.circleci', '.vscode', '.idea',
  'tests', 'test', '__tests__', 'evals', 'coverage', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.tox']);
const NOM_SUR = /^[A-Za-z0-9_.-]{1,100}$/;

// les noms qu'un dossier de compétence ne peut pas porter : le registre et ses fichiers de passage (rangés au même
// endroit), les noms que Windows se réserve, et ceux qui désignent autre chose qu'une entrée dans un objet JavaScript
const DOSSIER_INTERDIT = /\.(json|tmp)$|^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$|^(__proto__|constructor|prototype|hasownproperty|tostring|valueof)$/;
// les noms des compétences que Dérush livre ou télécharge lui-même, même quand elles ne sont pas encore là : une
// compétence venue d'ailleurs ne doit pas pouvoir passer pour le guide Remotion ou pour un outil de Dérush
const NOM_RESERVE = /^(derush-[\w.-]*|remotion-best-practices|real-sfx|earshot|sons-openverse)$/i;
/** Un texte sans caractère de commande (ni séquence d'échappement d'un terminal, ni texte caché ou retourné). */
export const sansControle = (t) => String(t ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]+/g, ' ');

/** Un nom de dossier sûr : minuscules, chiffres, « . », « _ », « - », sans point ni tiret au début ; null s'il est réservé. */
export function nomDeDossier(nom) {
  const n = String(nom ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9._-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '').slice(0, 80);
  return n && !DOSSIER_INTERDIT.test(n) ? n : null;
}

/**
 * Lit ce que la personne a collé : un lien GitHub (dépôt, dossier, fichier SKILL.md), une page de skills.sh, ou
 * « propriétaire/dépôt », « propriétaire/dépôt@compétence ». Renvoie {proprietaire, depot, ref, chemin, competence} ou null.
 */
export function lireLien(texte) {
  let t = String(texte ?? '').trim().replace(/^<|>$/g, '');
  if (!t || t.length > 500) return null;
  // un « . » ou « .. » comme morceau de chemin : refusé tel quel (une adresse les résoudrait en silence)
  if (/(^|\/)\.{1,2}(\/|$)/.test(t.replace(/^https?:\/\//i, ''))) return null;
  let competence = null;
  const arobase = /^([^\s@/]+\/[^\s@/]+)@([\w.-]+)$/.exec(t);
  if (arobase) { t = arobase[1]; competence = arobase[2]; }
  let u = null;
  if (/^https?:\/\//i.test(t)) { try { u = new URL(t); } catch { return null; } }
  else if (/^(www\.)?(github\.com|skills\.sh)\//i.test(t)) { try { u = new URL(`https://${t}`); } catch { return null; } }
  const morceaux = (u ? u.pathname : t).split('/').filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  const hote = u ? u.hostname.toLowerCase().replace(/^www\./, '') : 'github.com';
  if (hote !== 'github.com' && hote !== 'skills.sh') return null;
  if (morceaux.length < 2) return null;
  const [proprietaire, depotBrut, ...reste] = morceaux;
  const depot = depotBrut.replace(/\.git$/i, '');
  if (!NOM_SUR.test(proprietaire) || !NOM_SUR.test(depot) || proprietaire.startsWith('.') || depot.startsWith('.')) return null;
  let ref = null;
  let chemin = '';
  if (hote === 'skills.sh') competence = competence ?? reste[0] ?? null;
  else if ((reste[0] === 'tree' || reste[0] === 'blob') && reste[1]) {
    ref = reste[1];
    const suite = reste.slice(2);
    if (suite.length && /^SKILL\.md$/i.test(suite.at(-1))) suite.pop();
    chemin = suite.join('/');
  } else if (!u && reste.length) chemin = reste.join('/');
  if (chemin.split('/').some((x) => x === '..' || x === '.')) return null;
  if (ref && !/^[\w.\-/]{1,120}$/.test(ref)) return null;
  if (competence && !/^[\w.-]{1,100}$/.test(competence)) competence = null;
  return {proprietaire, depot, ref, chemin, competence};
}

// ——— le réseau ———
async function demander(url, {delai = 20000, entetes = ENTETES} = {}) {
  try { return await fetch(url, {headers: entetes, redirect: 'follow', signal: AbortSignal.timeout(delai)}); }
  catch (e) { throw new Error(e?.name === 'TimeoutError' ? 'GitHub ne répond pas (délai dépassé). Réessaie dans un moment.' : 'Pas de connexion à internet, ou GitHub est injoignable.'); }
}

/** Le commit (SHA complet) d'une référence (branche, tag, commit), ou null si GitHub ne le dit pas (limite de débit…). */
export async function commitDe({proprietaire, depot, ref = null}) {
  try {
    const r = await demander(`${API_GITHUB()}/repos/${proprietaire}/${depot}/commits/${encodeURIComponent(ref || 'HEAD')}`, {entetes: {...ENTETES, accept: 'application/vnd.github.sha'}, delai: 15000});
    if (r.status === 404 || r.status === 422) throw Object.assign(new Error(ref ? `La version « ${ref} » de ${proprietaire}/${depot} n’existe pas.` : `Le dépôt ${proprietaire}/${depot} est introuvable (ou privé).`), {introuvable: true});
    if (!r.ok) return null;
    const t = (await r.text()).trim();
    return /^[0-9a-f]{40}$/.test(t) ? t : null;
  } catch (e) { if (e.introuvable) throw e; return null; }
}
/** Le dernier commit qui a touché un dossier du dépôt (pour savoir si une compétence a changé), ou null. */
export async function dernierCommitDe({proprietaire, depot, ref = null, chemin = ''}) {
  try {
    const q = new URLSearchParams({per_page: '1'});
    if (ref) q.set('sha', ref);
    if (chemin) q.set('path', chemin);
    const r = await demander(`${API_GITHUB()}/repos/${proprietaire}/${depot}/commits?${q}`, {delai: 15000});
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) && /^[0-9a-f]{40}$/.test(j[0]?.sha ?? '') ? {sha: j[0].sha, date: j[0].commit?.committer?.date ?? null} : null;
  } catch { return null; }
}
/** Le commit écrit par GitHub en tête de l'archive (en-tête pax « comment= »), quand l'API n'a pas répondu. */
export function commitDeLArchive(gz) {
  try {
    const tar = zlib.gunzipSync(gz.subarray(0, 16384), {finishFlush: zlib.constants.Z_SYNC_FLUSH});
    if (String.fromCharCode(tar[156]) !== 'g') return null;
    const taille = parseInt(tar.subarray(124, 136).toString().replace(/\0/g, '').trim(), 8);
    const pax = tar.subarray(512, 512 + (Number.isFinite(taille) ? taille : 0)).toString();
    return /comment=([0-9a-f]{40})/.exec(pax)?.[1] ?? null;
  } catch { return null; }
}

// ——— la lecture d'un dépôt ———
const LICENCES = [
  ['MIT', /Permission is hereby granted, free of charge/i, true],
  ['Apache-2.0', /Apache License[\s\S]{0,40}Version 2\.0/i, true],
  ['BSD', /Redistribution and use in source and binary forms/i, true],
  ['ISC', /Permission to use, copy, modify, and\/or distribute this software/i, true],
  ['CC0-1.0', /CC0|Creative Commons Zero|No Copyright/i, true],
  ['Unlicense', /This is free and unencumbered software released into the public domain/i, true],
  ['MPL-2.0', /Mozilla Public License[\s\S]{0,20}2\.0/i, true],
  ['AGPL-3.0', /GNU AFFERO GENERAL PUBLIC LICENSE/i, true],
  ['LGPL', /GNU LESSER GENERAL PUBLIC LICENSE/i, true],
  ['GPL', /GNU GENERAL PUBLIC LICENSE/i, true],
  ['CC-BY-NC', /NonCommercial|BY-NC/i, false],
  ['CC-BY-SA', /ShareAlike|BY-SA/i, true],
  ['CC-BY', /Creative Commons Attribution|CC BY|CC-BY/i, true],
];
// ce qui interdit de vendre ou de s'en servir pour son travail, cherché AVANT le reste : une clause ajoutée à un
// texte MIT ou Apache le change (« Commons Clause »), et ces licences ressemblent à des licences libres sans l'être
const CLAUSES = [
  ['Commons Clause', /Commons Clause/i],
  ['Business Source License', /Business Source License/i],
  ['Elastic License', /Elastic License/i],
  ['SSPL', /Server Side Public License/i],
  ['PolyForm (usage limité)', /PolyForm (Noncommercial|Small Business|Internal Use|Strict|Free Trial|Shield|Perimeter)/i],
  ['CC-BY-NC', /Attribution[- ]NonCommercial|\bCC[ -]?BY[ -]NC|\bBY-NC\b/i],
];
// un identifiant court (« license: MIT » dans un en-tête) n'est cru que s'il est connu
const IDENTIFIANTS = /^(MIT(-0)?|Apache-2\.0|BSD-[0-4]-Clause|0BSD|ISC|Zlib|MPL-2\.0|[LA]?GPL-[23]\.[01](-only|-or-later|\+)?|CC0-1\.0|CC-BY(-SA)?-[1-4]\.0|Unlicense|WTFPL|BSL-1\.0|Artistic-2\.0|Python-2\.0|OFL-1\.1)$/i;
/** Une licence que Dérush ne reconnaît pas : ni verte ni rouge, à lire (« commercial » : null). */
const NON_RECONNUE = {nom: 'non reconnue', commercial: null};
/**
 * Le nom d'une licence d'après son texte ou son identifiant, et si elle permet un usage commercial : true, false, ou
 * null quand Dérush ne la reconnaît pas (« non reconnue » : la personne doit la lire). null tout court sans texte.
 */
export function reconnaitreLicence(texte) {
  const t = String(texte ?? '');
  if (!t.trim()) return null;
  const connue = LICENCES.find(([, motif]) => motif.test(t));
  const clause = CLAUSES.find(([, motif]) => motif.test(t));
  if (clause) return {nom: connue && connue[0] !== clause[0] ? `${connue[0]} + ${clause[0]}` : clause[0], commercial: false};
  if (connue) return {nom: connue[0], commercial: connue[2]};
  // aucun droit donné par un texte connu : « tous droits réservés », « propriétaire », « usage personnel » ferment la porte
  if (/all rights reserved|tous droits réservés|proprietary|propriétaire|confidential/i.test(t)) return {nom: 'propriétaire', commercial: false};
  if (/non[- ]?commercial|personal use only|usage personnel/i.test(t)) return {nom: 'non commerciale', commercial: false};
  const id = t.trim();
  if (IDENTIFIANTS.test(id)) return {nom: id, commercial: true};
  // les deux façons courantes de l'écrire en toutes lettres dans un en-tête
  if (/^MIT( licen[sc]e)?$/i.test(id)) return {nom: 'MIT', commercial: true};
  if (/^apache([ -]licen[sc]e)?[ ,-]*(version )?2(\.0)?$/i.test(id)) return {nom: 'Apache-2.0', commercial: true};
  return {...NON_RECONNUE};
}
function licenceDuDossier(dossier) {
  let noms = [];
  try { noms = fs.readdirSync(dossier); } catch { return null; }
  const f = noms.find((n) => /^(LICEN[SC]E|COPYING|UNLICENSE)(\.(md|txt|rst))?$/i.test(n));
  if (!f) return null;
  try { return {fichier: f, ...(reconnaitreLicence(fs.readFileSync(path.join(dossier, f), 'utf8').slice(0, 20000)) ?? NON_RECONNUE)}; } catch { return null; }
}
/**
 * La licence d'une compétence : son fichier de licence ; s'il n'est pas reconnu (ou absent), ce que dit son en-tête ;
 * sinon celle du dépôt (`depot`). Un en-tête qui ne nomme rien de connu (« See LICENSE ») laisse la place au dépôt.
 */
function licenceDeLaCompetence(dossier, entete, depot = null) {
  const fichier = licenceDuDossier(dossier);
  const dite = entete.license ? reconnaitreLicence(sansControle(entete.license)) : null;
  if (fichier && (fichier.commercial !== null || !dite || dite.commercial === null)) return fichier;
  if (dite && (dite.commercial !== null || !depot)) return {fichier: fichier?.fichier ?? null, ...dite};
  return depot;
}

const EXT_PROGRAMMES = /\.(py|js|mjs|cjs|ts|tsx|jsx|sh|bash|zsh|fish|ps1|bat|cmd|rb|pl|php|go|rs|swift|lua|r|jl|applescript|scpt)$/i;
// [motif, ce que ça veut dire, gravité] : « danger » se lit avant d'ajouter ; « attention » se signale seulement
const ALERTES = [
  [/curl[^\n|]{0,200}\|\s*(sudo\s+)?(ba|z)?sh\b/i, 'télécharge un script et le lance (curl … | sh)', 'danger'],
  [/wget[^\n|]{0,200}\|\s*(sudo\s+)?(ba|z)?sh\b/i, 'télécharge un script et le lance (wget … | sh)', 'danger'],
  [/\brm\s+-[a-z]*r[a-z]*f?\s+(~|\/(?!tmp\b)|\$HOME)/i, 'efface des dossiers de l’ordinateur (rm -rf)', 'danger'],
  [/npx\s+(-y\s+)?skills\s+add[^\n]*(-y\b|--yes)/i, 'installe d’autres compétences sans demander', 'danger'],
  [/--dangerously|--no-sandbox|bypassPermissions|--yolo/i, 'demande de couper les protections de l’IA', 'danger'],
  [/base64\s+(-d|--decode)[^\n]{0,80}\|\s*(ba|z)?sh/i, 'lance un code caché (base64 | sh)', 'danger'],
  [/ignore (all |the )?(previous|prior|above) (instructions|rules)|ignore tes consignes|oublie tes consignes/i, 'demande à l’IA d’oublier ses consignes', 'danger'],
  [/(do not|don't|never) (tell|inform|mention)[^\n]{0,30}(user|human)|sans le dire à l’utilisateur/i, 'demande à l’IA de cacher quelque chose', 'danger'],
  [/~\/\.ssh|id_rsa|\.aws\/credentials|security find-generic-password|keychain/i, 'touche aux clés ou aux mots de passe de l’ordinateur', 'danger'],
  [/\.env\b[^\n]{0,60}(curl|fetch|post|send|upload)|(curl|fetch|post|send|upload)[^\n]{0,60}\.env\b/i, 'envoie un fichier de clés (.env)', 'danger'],
  [/crontab|launchctl\s+load|LaunchAgents/i, 'installe une tâche qui se lance toute seule', 'danger'],
  [/\bsudo\s+\w/i, 'demande les droits d’administrateur (sudo)', 'attention'],
  [/chmod\s+(-R\s+)?777/i, 'ouvre tous les droits sur des fichiers (chmod 777)', 'attention'],
];
const MOTIF_CLE = /\b([A-Z][A-Z0-9]*_)+(API_KEY|APIKEY|KEY|TOKEN|SECRET|ACCESS_KEY)\b/g;
const MOTIF_ADRESSE = /\bhttps?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?=[\/:\s"'`)\]>]|$)/gi;

// ——— reconnaître un fichier à ses premiers octets (toujours lus, quelle que soit la taille du fichier) ———
const debute = (b, ...octets) => b.length >= octets.length && octets.every((o, i) => b[i] === o);
const mot = (b, texte, a = 0) => b.length >= a + texte.length && b.subarray(a, a + texte.length).toString('latin1') === texte;
/** Un programme compilé, ou du code que personne ne peut relire (Mach-O, ELF, exe, WebAssembly, bytecode). */
const estBinaire = (b) => {
  if (b.length < 4) return false;
  const m = b.readUInt32BE(0);
  if ([0xcafebabe, 0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0x7f454c46].includes(m)) return true; // Mach-O, classes Java, ELF
  if (b[0] === 0x4d && b[1] === 0x5a) return true; // exe Windows
  if (m === 0x0061736d) return true; // WebAssembly
  if (b[2] === 0x0d && b[3] === 0x0a && b.length >= 8 && b.subarray(4, 8).includes(0)) return true; // Python compilé (.pyc)
  return debute(b, 0x1b, 0x4c, 0x75, 0x61) || mot(b, 'dex\n'); // Lua compilé, Android
};
const EXT_COMPILES = /\.(exe|dll|so|dylib|node|wasm|pyc|pyo|pyd|class|jar|war|msi|scr|apk|dmg|pkg|deb|rpm)$/i;
/** Une archive (zip, gzip, tar, 7z, xz, bzip2, rar, zstd, ar) : ce qu'elle contient ne peut pas être relu. */
const estArchive = (b) => debute(b, 0x50, 0x4b, 0x03, 0x04) || debute(b, 0x50, 0x4b, 0x05, 0x06) || debute(b, 0x1f, 0x8b) || debute(b, 0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00)
  || debute(b, 0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c) || mot(b, 'BZh') || mot(b, 'Rar!') || debute(b, 0x28, 0xb5, 0x2f, 0xfd) || mot(b, '!<arch>\n') || mot(b, 'ustar', 257);
// des documents qui sont des archives par construction (Word, PowerPoint, un projet Premiere…) : signalés, pas refusés
const EXT_DOCUMENTS = /\.(docx|xlsx|pptx|odt|ods|odp|epub|prproj|mogrt|drp|svgz|blend|usdz|sketch|key|numbers|pages|xmind|kmz)$/i;
/**
 * Une image, un son, une vidéo, une police, un PDF : pas de texte à lire. La signature ne suffit pas (un texte peut
 * commencer par « RIFF » ou « GIF8 ») : il faut aussi un octet nul dans les 64 premiers, comme en ont tous ces formats.
 */
const estMedia = (b) => {
  if (mot(b, '%PDF-')) return true;
  if (!b.subarray(0, 64).includes(0)) return false;
  return debute(b, 0x89, 0x50, 0x4e, 0x47) || debute(b, 0xff, 0xd8, 0xff) || mot(b, 'GIF87a') || mot(b, 'GIF89a') || mot(b, 'RIFF') || mot(b, 'FORM') || mot(b, 'ID3')
    || (b[0] === 0xff && [0xfb, 0xfa, 0xf3, 0xf2, 0xe3, 0xe2, 0xf1, 0xf9].includes(b[1])) || ['ftyp', 'moov', 'mdat', 'wide', 'free'].some((m) => mot(b, m, 4))
    || mot(b, 'wOFF') || mot(b, 'wOF2') || mot(b, 'OTTO') || mot(b, 'ttcf') || debute(b, 0x00, 0x01, 0x00, 0x00) || debute(b, 0x00, 0x00, 0x01, 0x00) || debute(b, 0x00, 0x00, 0x02, 0x00)
    || mot(b, 'OggS') || mot(b, 'fLaC') || mot(b, '8BPS') || mot(b, 'II*\0') || mot(b, 'MM\0*') || debute(b, 0x1a, 0x45, 0xdf, 0xa3) || mot(b, 'MThd') || mot(b, 'icns') || mot(b, 'glTF')
    || debute(b, 0x76, 0x2f, 0x31, 0x01) || mot(b, 'BM');
};
/** Ni texte ni fichier reconnu : trop de caractères de commande parmi ses premiers octets (les zéros d'un texte en UTF-16 ne comptent pas). */
function illisible(b) {
  let autres = 0;
  let commandes = 0;
  for (const o of b) {
    if (o === 0) continue;
    autres++;
    if ((o < 0x20 && ![0x09, 0x0a, 0x0c, 0x0d, 0x1b].includes(o)) || o === 0x7f) commandes++;
  }
  return autres > 0 ? commandes / autres > 0.05 : b.length > 0;
}
/** Les premiers octets d'un fichier (4 ko au plus), sans le lire en entier. */
function teteDe(abs) {
  const b = Buffer.alloc(4096);
  let fd = null;
  try { fd = fs.openSync(abs, 'r'); return b.subarray(0, fs.readSync(fd, b, 0, b.length, 0)); }
  catch { return b.subarray(0, 0); }
  finally { if (fd !== null) fs.closeSync(fd); }
}
/** Le texte d'un fichier, morceau par morceau (des lignes entières, 1 Mo à la fois) : un gros fichier n'est jamais chargé d'un bloc. */
function* morceauxDeTexte(abs, taille) {
  if (taille <= 2 * 1024 * 1024) { yield fs.readFileSync(abs).toString('utf8').replace(/\0/g, ''); return; }
  const fd = fs.openSync(abs, 'r');
  try {
    const b = Buffer.alloc(1024 * 1024);
    const lire = new TextDecoder('utf-8');
    let reste = '';
    for (let n; (n = fs.readSync(fd, b, 0, b.length, null)) > 0;) {
      const t = reste + lire.decode(b.subarray(0, n), {stream: true}).replace(/\0/g, '');
      const coupe = t.lastIndexOf('\n');
      // une « ligne » de plus de 64 ko n'est pas du texte écrit à la main : elle est lue par tranches
      if (coupe < 0 && t.length < 65536) { reste = t; continue; }
      yield coupe < 0 ? t : t.slice(0, coupe + 1);
      reste = coupe < 0 ? '' : t.slice(coupe + 1);
    }
    if (reste) yield reste;
  } finally { fs.closeSync(fd); }
}

/** Parcourt un dossier sans suivre les liens : [{rel, abs, taille, mode}] (bornes comprises). */
function fichiersDe(racine, {max = LIMITES.fichiers, sauf = new Set()} = {}) {
  const r = [];
  const pile = [''];
  while (pile.length) {
    const rel = pile.pop();
    let noms = [];
    try { noms = fs.readdirSync(path.join(racine, rel)); } catch { continue; }
    for (const n of noms) {
      if (IGNORES.has(n)) continue;
      const relN = rel ? `${rel}/${n}` : n;
      if (sauf.has(relN)) continue;
      const abs = path.join(racine, relN);
      let st;
      try { st = fs.lstatSync(abs); } catch { continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) pile.push(relN);
      else if (st.isFile()) { r.push({rel: relN, abs, taille: st.size, mode: st.mode}); if (r.length > max) throw new Error(`Trop de fichiers (plus de ${max}).`); }
    }
  }
  return r.sort((a, b) => a.rel.localeCompare(b.rel));
}

const RANG = {refus: 0, danger: 1, attention: 2};
/**
 * Ce que Dérush voit dans une compétence : ses fichiers, ses programmes, ses adresses, ses clés, ses alertes.
 * Le niveau se calcule sur TOUT ce qui a été vu ; seule la liste montrée est bornée (30 alertes, les plus graves
 * d'abord ; `n_alertes` donne le total).
 */
export function inspecter(dossier, {sauf = new Set()} = {}) {
  const fichiers = fichiersDe(dossier, {max: LIMITES.fichiersCompetence * 4, sauf});
  const taille = fichiers.reduce((s, f) => s + f.taille, 0);
  // une compétence trop grosse sera refusée de toute façon : on ne lit pas son texte (ses fichiers restent reconnus)
  const lireLeTexte = taille <= LIMITES.competence && fichiers.length <= LIMITES.fichiersCompetence;
  const programmes = [];
  const domaines = new Set();
  const cles = new Set();
  const alertes = [];
  const binaires = [];
  const documents = [];
  const alerter = (quoi, gravite, fichier = '', ligne = 0, extrait = '') => alertes.push({quoi, gravite, fichier, ligne, extrait: sansControle(extrait).trim().slice(0, 160)});
  for (const f of fichiers) {
    const tete = teteDe(f.abs);
    if (estBinaire(tete) || EXT_COMPILES.test(f.rel)) { binaires.push(f.rel); continue; }
    if (estArchive(tete)) {
      if (EXT_DOCUMENTS.test(f.rel)) documents.push(f.rel);
      else alerter('contient une archive, que personne ne peut relire', 'refus', f.rel);
      continue;
    }
    if (EXT_PROGRAMMES.test(f.rel) || (f.mode & 0o111 && mot(tete, '#!'))) programmes.push(f.rel);
    if (estMedia(tete)) continue; // image, police, son, vidéo : pas de texte à lire
    const skill = f.rel === 'SKILL.md';
    if (skill && f.taille > 2 * 1024 * 1024) { alerter('son SKILL.md est trop gros pour être relu', 'refus', f.rel); continue; }
    if (illisible(tete)) alerter('contient un fichier que Dérush ne sait pas relire (ni texte, ni image, ni son, ni police)', 'danger', f.rel);
    if (!lireLeTexte) continue;
    const vues = new Set(); // dans un fichier, chaque sorte d'alerte une fois : à son premier endroit
    let ligne = 0;
    let entier = '';
    try {
      for (const t of morceauxDeTexte(f.abs, f.taille)) {
        if (skill) entier += t;
        for (const m of t.matchAll(MOTIF_ADRESSE)) domaines.add(m[1].toLowerCase());
        for (const m of t.matchAll(MOTIF_CLE)) cles.add(m[0]);
        const lignes = t.split('\n');
        for (const [motif, quoi, gravite] of ALERTES) {
          if (vues.has(quoi)) continue;
          const i = lignes.findIndex((l) => motif.test(l));
          if (i >= 0) { vues.add(quoi); alerter(quoi, gravite, f.rel, ligne + i + 1, lignes[i]); }
        }
        ligne += lignes.length - 1;
      }
    } catch { alerter('contient un fichier que Dérush n’a pas pu lire', 'danger', f.rel); continue; }
    if (skill) {
      // ce que Claude Code lancerait ou permettrait de lui-même à la lecture de ce SKILL.md (voir risquesSkill)
      const r = risquesSkill(entier);
      const lignes = entier.split('\n');
      const ou = (motif) => { const i = lignes.findIndex((l) => motif.test(l)); return [i + 1, i >= 0 ? lignes[i] : '']; };
      const lancent = r.cles.filter((k) => k === 'hooks' || k === 'mcpServers');
      const droits = r.cles.filter((k) => !lancent.includes(k));
      if (lancent.length) alerter(`déclare des commandes que Claude Code lancerait tout seul (« ${lancent.join(' », « ')} ») : Dérush les retire à l’ajout`, 'danger', f.rel, ...ou(new RegExp(`["']?(${lancent.join('|')})["']?\\s*:`)));
      if (r.commandes) alerter('lance une commande dès que l’IA l’ouvre (« !`commande` ») : Dérush la désarme à l’ajout', 'danger', f.rel, ...ou(/!`[^`\n]+`|^[ \t]*```!/));
      if (droits.length) alerter(`se donne des droits ou une façon de se lancer (« ${droits.join(' », « ')} ») : Dérush les retire à l’ajout`, 'attention', f.rel, ...ou(new RegExp(`["']?(${droits.join('|')})["']?\\s*:`)));
    }
  }
  if (documents.length) alerter(`contient ${documents.length > 1 ? 'des documents' : 'un document'} que Dérush ne peut pas relire (${documents.slice(0, 3).join(', ')}${documents.length > 3 ? '…' : ''})`, 'attention', documents[0]);
  const pire = Math.min(binaires.length ? RANG.refus : 3, ...alertes.map((a) => RANG[a.gravite] ?? 3));
  const niveau = pire === RANG.refus ? 'refus' : pire === RANG.danger ? 'danger' : alertes.length || programmes.length || cles.size ? 'attention' : 'ok';
  // les plus graves d'abord (dans leur ordre de lecture), puis on coupe
  const montrees = alertes.map((a, i) => [a, i]).sort(([a, i], [b, j]) => (RANG[a.gravite] ?? 3) - (RANG[b.gravite] ?? 3) || i - j).slice(0, 30).map(([a]) => a);
  return {fichiers: fichiers.length, taille, programmes: programmes.slice(0, 40), n_programmes: programmes.length, binaires: binaires.slice(0, 40), domaines: [...domaines].sort().slice(0, 40), cles: [...cles].sort().slice(0, 20), alertes: montrees, n_alertes: alertes.length, niveau};
}

/** Où sont les compétences d'un dépôt extrait : tout dossier qui a un SKILL.md (5 niveaux au plus). */
function trouverSkills(racine) {
  const r = [];
  const pile = [['', 0]];
  while (pile.length) {
    const [rel, prof] = pile.pop();
    const abs = path.join(racine, rel);
    if (fs.existsSync(path.join(abs, 'SKILL.md'))) r.push(rel);
    if (prof >= 5) continue;
    let noms = [];
    try { noms = fs.readdirSync(abs); } catch { continue; }
    for (const n of noms) {
      if (IGNORES.has(n)) continue;
      const relN = rel ? `${rel}/${n}` : n;
      try { const st = fs.lstatSync(path.join(racine, relN)); if (st.isDirectory() && !st.isSymbolicLink()) pile.push([relN, prof + 1]); } catch { /* parti */ }
    }
  }
  return r.sort();
}

const explorations = new Map();
function oublierVieilles() {
  for (const [id, e] of explorations) if (Date.now() - e.cree > DUREE_EXPLORATION) { fs.rmSync(e.tmp, {recursive: true, force: true}); explorations.delete(id); }
}
/** Ce qu'une exploration montre à l'interface (sans chemin de l'ordinateur). */
const publique = (e) => ({id: e.id, depot: e.depot, ref: e.ref, commit: e.commit, url: e.url, licence: e.licence, competences: e.competences.map(({abs, sauf, ...x}) => x)});

/**
 * Télécharge un dépôt à une version précise (dans un dossier temporaire), et dit ce qu'il contient : ses compétences,
 * leur description, leur licence, ce que Dérush y voit. Rien n'est encore ajouté.
 */
export async function explorer(lien) {
  oublierVieilles();
  const L = typeof lien === 'string' ? lireLien(lien) : lien;
  if (!L) throw new Error('Ce lien n’est pas celui d’une compétence : colle un lien GitHub (github.com/propriétaire/dépôt), une page de skills.sh, ou « propriétaire/dépôt ».');
  let commit = /^[0-9a-f]{40}$/.test(L.ref ?? '') ? L.ref : await commitDe(L);
  const r = await demander(`${ARCHIVES()}/${L.proprietaire}/${L.depot}/tar.gz/${encodeURIComponent(commit || L.ref || 'HEAD')}`, {delai: 90000, entetes: {'user-agent': 'Derush'}});
  if (r.status === 404) throw new Error(`Le dépôt ${L.proprietaire}/${L.depot} est introuvable (ou privé).`);
  if (!r.ok) throw new Error(`GitHub n’a pas donné le dépôt (${r.status}). Réessaie dans un moment.`);
  const gz = await lireCorpsBorne(r, LIMITES.archive);
  commit = commit || commitDeLArchive(gz);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-competence-'));
  try {
    // ouverte dans ses bornes (voir ouvrirArchive) ; les liens extraits ne sont jamais suivis ni copiés ensuite
    const sortie = await ouvrirArchive(gz, tmp, {extrait: LIMITES.extrait, fichiers: LIMITES.fichiers});
    const haut = fs.readdirSync(sortie).filter((n) => !n.startsWith('.') && !n.startsWith('pax_global_header'));
    const racine = haut.length === 1 && fs.statSync(path.join(sortie, haut[0])).isDirectory() ? path.join(sortie, haut[0]) : sortie;
    const tous = fichiersDe(racine, {max: LIMITES.fichiers});
    if (tous.reduce((s, f) => s + f.taille, 0) > LIMITES.extrait) throw new Error('Le dépôt est trop gros une fois ouvert.');
    let chemins = trouverSkills(racine);
    if (L.chemin) chemins = chemins.filter((c) => c === L.chemin || c.startsWith(`${L.chemin}/`));
    if (!chemins.length) throw new Error(L.chemin ? `Pas de compétence (SKILL.md) dans le dossier « ${L.chemin} » de ce dépôt.` : 'Ce dépôt ne contient aucune compétence (aucun fichier SKILL.md).');
    const licenceDepot = licenceDuDossier(racine);
    const deja = new Map(listerCompetences().map((s) => [s.nom, s]));
    const reg = registreAjoutees().competences;
    const competences = chemins.slice(0, 200).map((c) => {
      const abs = path.join(racine, c);
      const e = (() => { try { return enteteSkill(fs.readFileSync(path.join(abs, 'SKILL.md'), 'utf8')); } catch { return {}; } })();
      const nom = /^[\w.-]{1,100}$/.test(e.name ?? '') ? e.name : (path.basename(c || L.depot));
      // une compétence qui en contient d'autres (le dépôt entier, par exemple) ne les emporte pas avec elle
      const sauf = new Set(chemins.filter((x) => x !== c && (c === '' || x.startsWith(`${c}/`))).map((x) => (c ? x.slice(c.length + 1) : x)));
      let vu;
      try { vu = inspecter(abs, {sauf}); }
      catch (err) { vu = {fichiers: 0, taille: 0, programmes: [], n_programmes: 0, binaires: [], domaines: [], cles: [], alertes: [{quoi: err.message, gravite: 'refus', fichier: '', ligne: 0, extrait: ''}], niveau: 'refus'}; }
      if (vu.fichiers > LIMITES.fichiersCompetence) { vu.niveau = 'refus'; vu.alertes.push({quoi: `trop de fichiers (${vu.fichiers} ; ${LIMITES.fichiersCompetence} au plus)`, gravite: 'refus', fichier: '', ligne: 0, extrait: ''}); }
      if (vu.taille > LIMITES.competence) { vu.niveau = 'refus'; vu.alertes.push({quoi: `trop grosse (${Math.round(vu.taille / 1e6)} Mo ; ${Math.round(LIMITES.competence / 1e6)} Mo au plus)`, gravite: 'refus', fichier: '', ligne: 0, extrait: ''}); }
      const licence = licenceDeLaCompetence(abs, e, licenceDepot);
      const existante = deja.get(nom);
      const dossier = nomDeDossier(nom);
      const memeSource = reg[dossier] && reg[dossier].depot === `${L.proprietaire}/${L.depot}`;
      return {
        nom, dossier, chemin: c, description: String(e.description ?? '').slice(0, 1200), licence: licence ?? null,
        voulue: !!L.competence && (nom === L.competence || path.basename(c) === L.competence),
        conflit: existante && existante.source !== 'ajoutee' ? `Dérush a déjà une compétence « ${nom} »` : null,
        deja_ajoutee: !!memeSource, ...vu, abs, sauf,
      };
    });
    const id = crypto.randomBytes(8).toString('hex');
    const e = {id, tmp, cree: Date.now(), depot: `${L.proprietaire}/${L.depot}`, ref: L.ref, commit, url: `https://github.com/${L.proprietaire}/${L.depot}`, licence: licenceDepot, competences, lien: L};
    explorations.set(id, e);
    return publique(e);
  } catch (err) { fs.rmSync(tmp, {recursive: true, force: true}); throw err; }
}

/** L'empreinte d'un dossier : ses chemins et leur contenu (pour savoir si on l'a modifié à la main). */
export function empreinte(dossier) {
  const h = crypto.createHash('sha256');
  for (const f of fichiersDe(dossier, {max: LIMITES.fichiersCompetence * 4})) { h.update(f.rel); h.update('\0'); h.update(fs.readFileSync(f.abs)); h.update('\0'); }
  return h.digest('hex');
}

function ecrireRegistre(r) {
  fs.mkdirSync(DOSSIER_AJOUTEES, {recursive: true});
  const tmp = `${REGISTRE_AJOUTEES}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(r, null, 1));
  fs.renameSync(tmp, REGISTRE_AJOUTEES);
}

/**
 * Ajoute les compétences choisies d'une exploration, désignées par leur chemin dans le dépôt (unique ; « » = la racine)
 * ou, à défaut, par leur nom. Renvoie {ajoutees: [noms], refusees: [{nom, raison}]}.
 */
export async function ajouter(id, choix = []) {
  oublierVieilles();
  const e = explorations.get(String(id ?? ''));
  if (!e) throw new Error('Cette lecture du dépôt a expiré : recommence.');
  const voulues = new Set((Array.isArray(choix) ? choix : [choix]).map(String));
  const parChemin = e.competences.filter((c) => voulues.has(c.chemin));
  const choisies = parChemin.length ? parChemin : e.competences.filter((c) => voulues.has(c.nom));
  if (!choisies.length) throw new Error('Choisis au moins une compétence.');
  const reg = registreAjoutees();
  const ajoutees = [];
  const refusees = [];
  const prises = new Set();
  for (const c of choisies) {
    if (prises.has(c.dossier)) { refusees.push({nom: c.nom, raison: `une autre compétence « ${c.nom} » de ce dépôt est déjà choisie`}); continue; }
    prises.add(c.dossier);
    if (c.niveau === 'refus') { refusees.push({nom: c.nom, raison: c.binaires?.length ? 'elle contient un programme compilé, que personne ne peut relire' : c.alertes.find((a) => a.gravite === 'refus')?.quoi ?? 'refusée'}); continue; }
    if (c.conflit) { refusees.push({nom: c.nom, raison: c.conflit}); continue; }
    if (!c.dossier) { refusees.push({nom: c.nom, raison: 'nom illisible'}); continue; }
    const avant = reg.competences[c.dossier];
    if (avant && avant.depot !== e.depot) { refusees.push({nom: c.nom, raison: `une compétence « ${c.nom} » venue de ${avant.depot} est déjà ajoutée`}); continue; }
    fs.mkdirSync(DOSSIER_AJOUTEES, {recursive: true});
    const cible = path.join(DOSSIER_AJOUTEES, c.dossier);
    const tmp = path.join(DOSSIER_AJOUTEES, `.tmp-${c.dossier}-${crypto.randomBytes(3).toString('hex')}`);
    try {
      for (const f of fichiersDe(c.abs, {max: LIMITES.fichiersCompetence * 4, sauf: c.sauf})) {
        const dest = path.join(tmp, f.rel);
        fs.mkdirSync(path.dirname(dest), {recursive: true});
        fs.copyFileSync(f.abs, dest);
        fs.chmodSync(dest, (f.mode & 0o755) | 0o644);
      }
      // ce que Claude Code lancerait ou permettrait tout seul à sa lecture (voir desarmerSkill) : retiré avant de la ranger
      const fSkill = path.join(tmp, 'SKILL.md');
      const desarme = desarmerSkill(fs.readFileSync(fSkill, 'utf8'));
      if (desarme.retirees.length || desarme.commandes) fs.writeFileSync(fSkill, desarme.texte);
      // une forme que Dérush ne sait pas retirer (en-tête écrit autrement) : refusée plutôt que donnée à l'IA
      if (risquesSkill(desarme.texte).lance) throw new Error('son SKILL.md lancerait encore une commande tout seul, sous une forme que Dérush ne sait pas retirer');
      const retire = [
        desarme.retirees.length ? `l’en-tête « ${desarme.retirees.join(' », « ')} »` : null,
        desarme.commandes ? `${desarme.commandes} « !\`commande\` » (${desarme.commandes > 1 ? 'devenues de simples citations' : 'devenue une simple citation'})` : null,
      ].filter(Boolean);
      const commitChemin = await dernierCommitDe({...e.lien, ref: e.commit ?? e.lien.ref, chemin: c.chemin});
      const quand = new Date().toISOString();
      fs.writeFileSync(path.join(tmp, 'SOURCE.md'), [
        '# Provenance', '',
        `- Ajoutée par la personne dans Dérush le ${quand.slice(0, 10)}, depuis ${e.url}${c.chemin ? ` (dossier \`${c.chemin}\`)` : ''}.`,
        `- Version : commit ${e.commit ?? 'inconnu'}.`,
        `- Licence : ${c.licence?.nom ?? 'aucune trouvée'}${c.licence?.fichier ? ` (fichier ${c.licence.fichier})` : ''}.`,
        '- Dérush ne lance jamais son code et ne lui fabrique aucune commande ; l’IA la lit comme une consigne.',
        ...(retire.length ? [`- Retiré de son SKILL.md à l’ajout, parce que Claude Code le lancerait ou l’accorderait tout seul : ${retire.join(' ; ')}.`] : []),
        '',
      ].join('\n'));
      fs.rmSync(cible, {recursive: true, force: true});
      fs.renameSync(tmp, cible);
      reg.competences[c.dossier] = {
        nom: c.nom, dossier: c.dossier, description: c.description.length > 1200 ? `${c.description.slice(0, 1200).replace(/\s+\S*$/, '')}…` : c.description, depot: e.depot, url: e.url, ref: e.lien.ref ?? null, chemin: c.chemin,
        commit: e.commit ?? null, commit_chemin: commitChemin?.sha ?? null, date_version: commitChemin?.date ?? null,
        licence: c.licence ? {nom: c.licence.nom, commercial: c.licence.commercial ?? null} : null,
        niveau: c.niveau, programmes: c.n_programmes, domaines: c.domaines, cles: c.cles, alertes: c.alertes.map((a) => a.quoi),
        empreinte: empreinte(cible), ajoutee_le: avant?.ajoutee_le ?? quand, mise_a_jour_le: avant ? quand : null,
        actif: avant?.actif ?? true, maj_disponible: false, verifiee_le: quand,
      };
      ajoutees.push(c.nom);
    } catch (err) {
      fs.rmSync(tmp, {recursive: true, force: true});
      refusees.push({nom: c.nom, raison: err.message});
    }
  }
  ecrireRegistre(reg);
  oublierCompetences();
  return {ajoutees, refusees};
}

/** Oublie une exploration (la personne a fermé la fenêtre) et son dossier temporaire. */
export function abandonner(id) {
  const e = explorations.get(String(id ?? ''));
  if (e) { fs.rmSync(e.tmp, {recursive: true, force: true}); explorations.delete(e.id); }
}

/** Les compétences ajoutées, pour l'interface : provenance, licence, état (active, modifiée à la main, mise à jour…). */
export function listerAjoutees() {
  const reg = registreAjoutees().competences;
  const actives = new Map(listerCompetences().filter((s) => s.source === 'ajoutee').map((s) => [path.basename(s.dossier), s]));
  return Object.values(reg).map((x) => {
    const dossier = path.join(DOSSIER_AJOUTEES, x.dossier);
    const present = fs.existsSync(path.join(dossier, 'SKILL.md'));
    let modifiee = false;
    if (present && x.empreinte) { try { modifiee = empreinte(dossier) !== x.empreinte; } catch { /* illisible */ } }
    return {...x, present, modifiee, utilisee: actives.has(x.dossier), masquee: present && x.actif !== false && !actives.has(x.dossier)};
  }).sort((a, b) => a.nom.localeCompare(b.nom));
}

function entree(nom) {
  const reg = registreAjoutees();
  const x = reg.competences[nomDeDossier(nom)] ?? Object.values(reg.competences).find((y) => y.nom === nom);
  if (!x) throw new Error(`Aucune compétence ajoutée ne s’appelle « ${nom} ».`);
  return {reg, x};
}
/** Met une compétence ajoutée en pause (l'IA ne la voit plus) ou la remet. */
export function activer(nom, actif = true) {
  const {reg, x} = entree(nom);
  x.actif = !!actif;
  ecrireRegistre(reg);
  oublierCompetences();
  return x;
}
/** Retire une compétence ajoutée (son dossier et sa ligne du registre). */
export function retirer(nom) {
  const {reg, x} = entree(nom);
  const d = path.join(DOSSIER_AJOUTEES, x.dossier);
  if (path.dirname(d) === DOSSIER_AJOUTEES) fs.rmSync(d, {recursive: true, force: true});
  delete reg.competences[x.dossier];
  ecrireRegistre(reg);
  oublierCompetences();
  return true;
}

/** Regarde, pour chaque compétence ajoutée, si son dossier a changé dans son dépôt depuis la version prise. */
export async function verifierMisesAJour() {
  const reg = registreAjoutees();
  const r = [];
  for (const x of Object.values(reg.competences)) {
    const [proprietaire, depot] = String(x.depot).split('/');
    // le dernier commit qui a touché son dossier ; à défaut (pris sans cette information), celui du dépôt entier
    const d = x.commit_chemin ? await dernierCommitDe({proprietaire, depot, ref: x.ref, chemin: x.chemin}) : await commitDe({proprietaire, depot, ref: x.ref}).then((sha) => (sha ? {sha, date: null} : null), () => null);
    if (!d) { r.push({nom: x.nom, ok: false}); continue; }
    x.maj_disponible = d.sha !== (x.commit_chemin ?? x.commit);
    x.verifiee_le = new Date().toISOString();
    if (x.maj_disponible) x.version_disponible = {sha: d.sha, date: d.date};
    r.push({nom: x.nom, ok: true, maj: x.maj_disponible});
  }
  ecrireRegistre(reg);
  return {verifiees: r.filter((x) => x.ok).length, echecs: r.filter((x) => !x.ok).length, maj: r.filter((x) => x.maj).map((x) => x.nom)};
}
/**
 * Lit la nouvelle version d'une compétence ajoutée (sans l'installer) : la personne voit ce qui a changé (licence,
 * programmes, alertes) avant d'accepter, par ajouter(id, [chemin]).
 */
export async function preparerMiseAJour(nom) {
  const {x} = entree(nom);
  const [proprietaire, depot] = String(x.depot).split('/');
  const e = await explorer({proprietaire, depot, ref: x.ref, chemin: x.chemin, competence: x.nom});
  return {...e, competences: e.competences.filter((c) => c.chemin === x.chemin).map((c) => ({...c, voulue: true}))};
}

/** Cherche dans l'annuaire skills.sh (une seule demande, sur un clic ; rien d'autre n'est envoyé). */
export async function chercherAnnuaire(q) {
  const texte = String(q ?? '').trim().slice(0, 100);
  if (texte.length < 2) throw new Error('Écris au moins deux lettres.');
  let r;
  try { r = await fetch(`${ANNUAIRE()}/api/search?${new URLSearchParams({q: texte})}`, {headers: {'user-agent': 'Derush'}, signal: AbortSignal.timeout(12000)}); }
  catch { throw new Error('L’annuaire skills.sh ne répond pas. Réessaie dans un moment, ou colle directement un lien GitHub.'); }
  if (r.status === 429) throw new Error('L’annuaire skills.sh reçoit trop de demandes : réessaie dans une minute.');
  if (!r.ok) throw new Error(`L’annuaire skills.sh ne répond pas (${r.status}).`);
  const j = await r.json().catch(() => null);
  const liste = Array.isArray(j?.skills) ? j.skills : [];
  const deja = new Set(listerCompetences().map((s) => s.nom));
  return liste.slice(0, 50).map((s) => {
    const source = String(s.source ?? '').trim();
    const nom = String(s.name ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 100);
    return {nom, depot: /^[\w.-]+\/[\w.-]+$/.test(source) ? source : null, installs: Number.isFinite(Number(s.installs)) ? Number(s.installs) : null, deja: deja.has(nom)};
  }).filter((x) => x.nom && x.depot);
}
