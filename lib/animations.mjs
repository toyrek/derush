// Dérush — la bibliothèque d'animations d'un espace : les pièces Remotion que l'IA a faites pour un montage et qui
// resservent (un carton de fin aux couleurs de l'espace, une transition, un titre animé…), gardées pour les montages
// suivants du même espace. L'IA les importe au lieu de les réécrire : le travail va plus vite et coûte moins.
//
// Rangement : espaces/<id>/animations/<Nom>.tsx et animations.json (ce que fait chaque pièce, d'où elle vient, quand).
// Dans le dossier de travail : remotion/src/bibliotheque/ (avec BIBLIOTHEQUE.md). Une pièce y est reconnue à sa première
// ligne : « // Bibliothèque : <ce qu'elle fait, en une phrase> ». Elle prend ses images, ses textes et ses couleurs en
// paramètres (props) : elle ne dépend d'aucun fichier d'un montage précis. « Personne » n'a pas de bibliothèque, et un
// espace qui n'apprend pas n'y ajoute rien (il garde celle qu'il a).
import fs from 'node:fs';
import path from 'node:path';
import {dossierEspace, apprend} from './espaces.mjs';

const ENTETE = /^\s*\/\/\s*Biblioth[eè]que\s*:\s*(.{3,300})$/m;
const NOM = /^[A-Za-z][A-Za-z0-9_-]{1,60}\.tsx?$/;
const TAILLE_MAX = 80 * 1024;
const NOMBRE_MAX = 60;
const SOUS = path.join('remotion', 'src', 'bibliotheque');

export const dossierAnimations = (id) => path.join(dossierEspace(id), 'animations');
const lireIndex = (D) => { try { const x = JSON.parse(fs.readFileSync(path.join(D, 'animations.json'), 'utf8')); return x && typeof x === 'object' ? x : {}; } catch { return {}; } };
function ecrireIndex(D, x) {
  fs.mkdirSync(D, {recursive: true});
  fs.writeFileSync(path.join(D, '.animations.json.part'), JSON.stringify(x, null, 1));
  fs.renameSync(path.join(D, '.animations.json.part'), path.join(D, 'animations.json'));
}
/** Ce que dit la première ligne d'une pièce (« // Bibliothèque : … »), ou null : ce n'est pas une pièce de bibliothèque. */
export function descriptionPiece(code) {
  const debut = String(code ?? '').split('\n').filter((l) => l.trim()).slice(0, 3).join('\n');
  const m = ENTETE.exec(debut);
  return m ? m[1].trim() : null;
}

/** Les pièces de la bibliothèque d'un espace : [{nom, description, projet, ajoutee_le, maj_le, taille}]. */
export function listerAnimations(id) {
  const D = dossierAnimations(id);
  let noms = [];
  try { noms = fs.readdirSync(D).filter((n) => NOM.test(n)); } catch { return []; }
  const index = lireIndex(D);
  return noms.map((nom) => {
    let code = '';
    let taille = 0;
    try { code = fs.readFileSync(path.join(D, nom), 'utf8'); taille = Buffer.byteLength(code); } catch { /* illisible */ }
    const i = index[nom] ?? {};
    return {nom, description: descriptionPiece(code) ?? i.description ?? '', projet: i.projet ?? null, ajoutee_le: i.ajoutee_le ?? null, maj_le: i.maj_le ?? null, taille};
  }).sort((a, b) => String(b.maj_le ?? '').localeCompare(String(a.maj_le ?? '')) || a.nom.localeCompare(b.nom));
}

/**
 * Pose la bibliothèque de l'espace dans le dossier de travail (remotion/src/bibliotheque/), sans jamais écraser une pièce
 * que l'IA a changée dans ce dossier (la sienne est la plus récente), avec BIBLIOTHEQUE.md. Renvoie les pièces posées.
 */
export function installerAnimations(atelier, e) {
  const B = path.join(atelier, SOUS);
  if (!e || e.type === 'neutre') return [];
  const liste = listerAnimations(e.id);
  const D = dossierAnimations(e.id);
  if (liste.length) fs.mkdirSync(B, {recursive: true});
  for (const a of liste) {
    const dst = path.join(B, a.nom);
    if (!fs.existsSync(dst)) { try { fs.copyFileSync(path.join(D, a.nom), dst); } catch { /* une pièce de moins */ } }
  }
  if (liste.length) {
    fs.writeFileSync(path.join(B, 'BIBLIOTHEQUE.md'), ['# Ta bibliothèque d’animations', '',
      'Des pièces que tu as faites pour des montages précédents de cet espace. Importe-les (`import {…} from \'./bibliotheque/Nom\'`) au lieu de les réécrire, adapte leurs paramètres (textes, couleurs, images) à ce montage.', '',
      ...liste.map((a) => `- \`${a.nom}\` — ${a.description || 'sans description'}${a.projet ? ` (faite pour « ${a.projet} »)` : ''}`), ''].join('\n'));
  }
  return liste;
}

/** La consigne : la bibliothèque à réutiliser, et comment y ranger une pièce neuve. */
export function consigneAnimations(e, liste = []) {
  if (!e || e.type === 'neutre') return '';
  const apprendre = apprend(e);
  const dispo = liste.length ? `- Ta bibliothèque d’animations : ${liste.length} pièce${liste.length > 1 ? 's' : ''} faite${liste.length > 1 ? 's' : ''} pour des montages précédents de cet espace, dans remotion/src/bibliotheque/ (BIBLIOTHEQUE.md dit ce que fait chacune). Réutilise-les quand elles vont avec la demande, en changeant leurs paramètres : c’est plus rapide que de tout réécrire.` : '';
  const ranger = apprendre ? '- Quand tu fais une pièce qui resservira à d’autres montages de cet espace (un carton de fin, une transition, un titre animé, un habillage), range-la dans remotion/src/bibliotheque/<Nom>.tsx avec, en toute première ligne, « // Bibliothèque : <ce qu’elle fait, en une phrase> ». Elle prend ses textes, ses couleurs et ses images en paramètres (props), sans aucun chemin de ce montage écrit en dur. Dérush la garde pour les prochains montages. N’y range pas ce qui ne sert qu’à cette vidéo.' : '';
  return [dispo, ranger].filter(Boolean).join('\n');
}

/**
 * Après le travail : les pièces de remotion/src/bibliotheque/ qui portent leur première ligne « // Bibliothèque : … »,
 * nouvelles ou changées, rejoignent la bibliothèque de l'espace (au plus 60 pièces, 80 Ko chacune). Renvoie leurs noms.
 */
export function recueillirAnimations(atelier, e, {projet = null} = {}) {
  if (!e || !apprend(e)) return [];
  const B = path.join(atelier, SOUS);
  let noms = [];
  try { noms = fs.readdirSync(B).filter((n) => NOM.test(n)); } catch { return []; }
  const D = dossierAnimations(e.id);
  const index = lireIndex(D);
  const gardees = [];
  const deja = new Set(listerAnimations(e.id).map((a) => a.nom));
  for (const nom of noms) {
    let code;
    try {
      const st = fs.statSync(path.join(B, nom));
      if (!st.isFile() || st.size > TAILLE_MAX) continue;
      code = fs.readFileSync(path.join(B, nom), 'utf8');
    } catch { continue; }
    const description = descriptionPiece(code);
    if (!description) continue;
    let avant = null;
    try { avant = fs.readFileSync(path.join(D, nom), 'utf8'); } catch { /* nouvelle */ }
    if (avant === code) continue;
    if (avant == null && deja.size >= NOMBRE_MAX) continue;
    fs.mkdirSync(D, {recursive: true});
    fs.writeFileSync(path.join(D, nom), code);
    const quand = new Date().toISOString();
    index[nom] = {description, projet: projet ?? index[nom]?.projet ?? null, ajoutee_le: index[nom]?.ajoutee_le ?? quand, maj_le: quand};
    deja.add(nom);
    gardees.push(nom);
  }
  if (gardees.length) ecrireIndex(D, index);
  return gardees;
}

/** Retire une pièce de la bibliothèque : elle part dans animations/.retirees/ (rien n'est effacé). */
export function retirerAnimation(id, nom) {
  if (!NOM.test(String(nom))) throw new Error('Pièce inconnue.');
  const D = dossierAnimations(id);
  const src = path.join(D, nom);
  if (!fs.existsSync(src)) throw new Error('Cette pièce n’est plus dans la bibliothèque.');
  const dst = path.join(D, '.retirees', `${new Date().toISOString().slice(0, 10)}-${nom}`);
  fs.mkdirSync(path.dirname(dst), {recursive: true});
  fs.renameSync(src, dst);
  const index = lireIndex(D);
  delete index[nom];
  ecrireIndex(D, index);
  return true;
}

/** Le code d'une pièce (pour la montrer dans l'interface). */
export function codeAnimation(id, nom) {
  if (!NOM.test(String(nom))) throw new Error('Pièce inconnue.');
  return fs.readFileSync(path.join(dossierAnimations(id), nom), 'utf8');
}
