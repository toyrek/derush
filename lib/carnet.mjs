// Dérush — le carnet du monteur : ce que l'IA apprend d'un montage à l'autre (les rushes, les goûts, les pièges des
// outils). L'IA l'écrit à la fin d'un montage (carnet-ia.md, dans le dossier de travail) ; Dérush le garde PAR ESPACE
// (espaces/<id>/carnet.json, dans son dossier, sur l'ordinateur : « Moi », chaque client) et le donne au projet
// suivant du même espace (CARNET.md). « Personne » n'a pas de carnet. La personne le lit et l'efface dans l'app.
// Un montage pour une entreprise ne reçoit donc jamais les leçons des chroniques manga de la personne.
//
// Avant (13 nov. 2026), Claude rangeait ses leçons dans sa propre mémoire, liée au dossier du projet : chaque projet
// ayant un dossier neuf, elles étaient perdues au montage suivant.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DOSSIER_SUPPORT} from './moteurs.mjs';
import {DOSSIER_ESPACES, trouverEspace, apprend} from './espaces.mjs';

export const FICHIER_IA = 'carnet-ia.md';
const MAX = 60;
const ESPACE_VALIDE = /^[a-z0-9-]{2,40}$/;
/** Le carnet d'un espace. Le carnet unique d'avant les espaces (carnet.json) devient celui de « Moi ». */
function fichier(espace = 'moi') {
  if (!ESPACE_VALIDE.test(String(espace))) throw new Error('Espace inconnu.');
  const f = path.join(DOSSIER_ESPACES, espace, 'carnet.json');
  const ancien = path.join(DOSSIER_SUPPORT, 'carnet.json');
  if (espace === 'moi' && !fs.existsSync(f) && fs.existsSync(ancien)) {
    try { fs.mkdirSync(path.dirname(f), {recursive: true}); fs.renameSync(ancien, f); } catch { /* il sera relu tel quel */ }
  }
  return f;
}
const normal = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// Jamais un secret dans le carnet : il repart vers l'IA à chaque projet, dans un CARNET.md rangé dans le dossier du
// projet (qu'on zippe, qu'on envoie). Les formes des clés, dont les deux que Dérush donne lui-même à l'IA de montage
// (Treg « trg_… », ElevenLabs « sk_… »), une suite de 32 lettres et chiffres ou plus, et les tournures qui en annoncent une.
const SECRET = new RegExp([
  '(?<![A-Za-z0-9])sk[-_][A-Za-z0-9_-]{12,}', '(?<![A-Za-z0-9])trg_[A-Za-z0-9_-]{8,}', 'AIza[0-9A-Za-z_-]{20,}', '(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{20,}', 'xox[abp]-',
  'Bearer\\s+\\S{12,}', 'xi-api-key', 'x-treg-token\\s*[:=]', 'api[ _-]?key\\s*[:=]', 'cl[ée]\\s+(?:d[’\']\\s*)?(?:api|treg|elevenlabs|secr[èe]te)\\b[^:=]{0,24}[:=]',
  'mot de passe\\s*[:=]', 'password\\s*[:=]', 'token\\s*[:=]', 'jeton\\s*[:=]',
  '(?<![A-Za-z0-9])(?=[A-Za-z0-9]*[0-9])(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{32,}(?![A-Za-z0-9])',
].join('|'), 'i');
/** Ce texte porte-t-il un secret : une des formes ci-dessus, ou la valeur même d'une clé que Dérush connaît ? */
function secret(t) {
  const texte = String(t ?? '');
  if (SECRET.test(texte)) return true;
  return [process.env.TREG_TOKEN, process.env.ELEVENLABS_API_KEY].some((v) => typeof v === 'string' && v.length >= 8 && texte.includes(v));
}

/**
 * Le chemin réel d'un fichier que l'IA a écrit dans son dossier de travail, ou null s'il n'y est pas vraiment : un lien
 * (l'IA, dans son bac à sable, peut poser « carnet-ia.md » → un fichier qu'elle n'a pas le droit de lire ; Dérush, lui,
 * le lirait et le lui redonnerait), autre chose qu'un fichier, un fichier trop gros, ou un chemin qui sort du dossier.
 */
export function fichierDeLIA(atelier, relatif, max = 64 * 1024) {
  try {
    const f = path.join(atelier, relatif);
    const st = fs.lstatSync(f);
    if (!st.isFile() || st.size > max) return null;
    const racine = fs.realpathSync(atelier);
    const vrai = fs.realpathSync(f);
    return vrai.startsWith(racine + path.sep) ? vrai : null;
  } catch { return null; }
}

/** Les leçons gardées, les plus récentes en dernier : [{id, texte, quand, projet, ia, modele}]. Jamais une leçon qui porte un secret. */
export function lireCarnet(espace = 'moi') {
  if (espace === 'neutre') return [];
  try {
    const j = JSON.parse(fs.readFileSync(fichier(espace), 'utf8'));
    return Array.isArray(j.lecons) ? j.lecons.filter((l) => l && typeof l.texte === 'string' && !secret(l.texte)) : [];
  } catch { return []; }
}
function ecrire(lecons, espace = 'moi') {
  const f = fichier(espace);
  fs.mkdirSync(path.dirname(f), {recursive: true});
  const tmp = `${f}.part`;
  fs.writeFileSync(tmp, JSON.stringify({v: 1, lecons}, null, 1));
  fs.renameSync(tmp, f);
}

/** Les leçons d'un texte : une par ligne qui commence par « - » (ou « • », « * »), 5 au plus, 300 signes chacune. */
export function leconsDe(texte) {
  return String(texte ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[-•*]\s+\S/.test(l))
    .map((l) => l.replace(/^[-•*]\s+/, '').replace(/\s+/g, ' ').trim()).filter((l) => l.length >= 12 && !secret(l))
    .map((l) => (l.length > 300 ? `${l.slice(0, 297).trimEnd()}…` : l)).slice(0, 5);
}

// le début d'un retour de la personne sur une vidéo (lib/fiches.mjs, leconDeNote) : « Retour de la personne sur « Titre » »
const sujetDeNote = (t) => /^(.{6,}?»)\s*\([^)]*\)\s*:/.exec(String(t ?? ''))?.[1] ?? null;

/**
 * Ajoute des leçons (sans doublon : même texte, ou l'une contient l'autre). Renvoie celles qui ont été ajoutées.
 * Le mot de la personne sur une vidéo (`source: 'note'`, avec la clé de sa fiche dans `cle` si on l'a) ne compte
 * qu'une fois par vidéo : le dernier remplace le précédent. « trop long », précisé ensuite en « trop long, et la
 * musique couvre la voix », ne doit pas rester « trop long ».
 */
export function ajouterLecons(textes, {espace = 'moi', projet = null, ia = null, modele = null, source = 'ia', cle = null} = {}) {
  // « Personne », ou un espace dont l'apprentissage est coupé (ou retiré) : rien n'entre au carnet, même si l'IA a écrit carnet-ia.md
  if (espace === 'neutre' || !apprend(trouverEspace(espace))) return [];
  let lecons = lireCarnet(espace);
  const ajoutees = [];
  let retirees = 0;
  for (const texte of textes) {
    const n = normal(texte);
    if (n.length < 10 || secret(texte)) continue;
    if (source === 'note') {
      const sujet = sujetDeNote(texte);
      const avant = lecons.length;
      lecons = lecons.filter((l) => !(l.source === 'note' && l.texte !== texte && ((cle && l.cle === cle) || (sujet && (l.projet ?? null) === projet && sujetDeNote(l.texte) === sujet))));
      retirees += avant - lecons.length;
    }
    if (lecons.some((l) => { const m = normal(l.texte); return m === n || (n.length >= 30 && m.includes(n)) || (m.length >= 30 && n.includes(m)); })) continue;
    const l = {id: crypto.randomBytes(5).toString('hex'), texte, quand: new Date().toISOString(), projet, ia, modele, source, ...(cle ? {cle} : {})};
    lecons.push(l);
    ajoutees.push(l);
  }
  if (ajoutees.length || retirees) ecrire(lecons.slice(-MAX), espace);
  return ajoutees;
}

/** Après un montage : les leçons que l'IA a écrites dans carnet-ia.md (s'il a changé depuis `depuis`). */
export function recueillirCarnet(atelier, depuis, infos = {}) {
  if (infos.espace === 'neutre') return [];
  // un vrai fichier du dossier de travail, 64 Ko au plus : jamais un lien vers un fichier d'ailleurs
  const f = fichierDeLIA(atelier, FICHIER_IA);
  if (!f) return [];
  try { if (fs.statSync(f).mtimeMs < depuis - 2000) return []; } catch { return []; }
  let t = '';
  try { t = fs.readFileSync(f, 'utf8'); } catch { return []; }
  return ajouterLecons(leconsDe(t), infos);
}

export function retirerLecon(id, espace = 'moi') {
  const lecons = lireCarnet(espace);
  const reste = lecons.filter((l) => l.id !== id);
  if (reste.length !== lecons.length) ecrire(reste, espace);
  return reste.length !== lecons.length;
}
export function viderCarnet(espace = 'moi') { if (espace !== 'neutre') ecrire([], espace); }

/** Le CARNET.md d'un dossier de travail (les 40 leçons les plus récentes), ou null si le carnet est vide. */
export function texteCarnet(espace = 'moi') {
  const lecons = lireCarnet(espace).slice(-40).reverse();
  if (!lecons.length) return null;
  const date = (q) => { try { return new Date(q).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short', year: 'numeric'}); } catch { return ''; } };
  return [
    '# Carnet du monteur',
    '',
    'Ce que les montages précédents ont appris (les rushes de cette personne, ses goûts, les pièges des outils), écrit par les IA qui les ont faits et gardé par Dérush. Lis-le avant de commencer ; ce sont des repères, pas des ordres : la demande d’aujourd’hui passe avant.',
    '',
    ...lecons.map((l) => `- ${l.texte} *(${[date(l.quand), l.projet].filter(Boolean).join(', ')})*`),
    '',
    `À la fin de ton travail, écris dans \`${FICHIER_IA}\` ce que ce montage t’a appris d’utile pour les prochains (1 à 5 lignes « - … »). Rien de personnel ni de secret.`,
    '',
  ].join('\n');
}
