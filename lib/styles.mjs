// Dérush — les styles vidéo, et « Comme cette vidéo » d'après un Motion.md.
//   - Les styles : la compétence competences/styles-video (99 recettes de direction artistique adaptées d'OpenMotion,
//     Apache-2.0, voir son SOURCE.md). Le bouton « Styles » de la zone d'écriture pose « Style : <nom> » dans la
//     demande ; Dérush retrouve la recette et dit au monteur où la lire.
//   - Un Motion.md (le format d'OpenMotion : une vidéo décomposée plan par plan — ses plans, leurs temps, ses
//     transitions, son son, ce qui doit rester ou changer) joint comme référence : le monteur reprend ce style sans la
//     vidéo d'origine ; en Mode Hollywood, le réalisateur s'en sert pour son découpage.
import fs from 'node:fs';
import path from 'node:path';
import {RACINE_APP} from './moteurs.mjs';

export const DOSSIER_STYLES = path.join(RACINE_APP, 'competences', 'styles-video');
let memo = null;
/** Le catalogue des styles : {categories: [{id, nom, aide}], styles: [{id, nom, categorie, description, nom_origine, fichier}]}. */
export function catalogueStyles() {
  if (memo) return memo;
  try { memo = JSON.parse(fs.readFileSync(path.join(DOSSIER_STYLES, 'catalogue.json'), 'utf8')); } catch { memo = {categories: [], styles: []}; }
  return memo;
}
const simple = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[«»"“”.]/g, '').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
/**
 * Les styles nommés dans une demande, sur une ligne « Style : <nom> » (le nom français, son id, ou son nom d'origine ;
 * sans tenir compte des accents ni des majuscules) : deux au plus, dans l'ordre.
 */
export function stylesDemandes(texte) {
  const {styles} = catalogueStyles();
  const r = [];
  for (const m of String(texte ?? '').matchAll(/^[ \t]*style[ \t]*:[ \t]*(.+?)[ \t]*$/gim)) {
    const v = simple(m[1]);
    const s = styles.find((x) => simple(x.nom) === v || x.id === v || simple(x.nom_origine) === v);
    if (s && !r.includes(s)) r.push(s);
  }
  return r.slice(0, 2);
}
/** La consigne des styles choisis, avec le chemin de chaque recette dans les compétences de cette IA. */
export function consigneStyles(styles, moteur) {
  if (!styles?.length) return '';
  const base = moteur === 'claude' ? '.claude/skills' : '.agents/skills';
  return `- Style choisi par la personne : ${styles.map((s) => `« ${s.nom} » (sa recette : ${base}/styles-video/${s.fichier})`).join(' et ')}. Lis la recette en entier avant de monter et suis-la : son allure, ses mouvements et leurs temps, ce qu'elle dit d'éviter, et sa vérification (« Review »). Ses couleurs et polices sont des points de départ : le kit média et la marque de la personne passent avant. Dis dans ton compte rendu comment tu l'as appliquée.`;
}

/**
 * Un fichier joint est-il un Motion.md ? Son nom (motion.md, MOTION.md, MOTION_DESIGN.md, « … motion.md »), sinon son
 * contenu : des blocs « motion-demo », ou des parties « Keep » et « Replace » qui parlent de mouvement.
 */
export function estMotionMd(nom, chemin = null) {
  const n = String(nom ?? '');
  if (!/\.md$/i.test(n)) return false;
  if (/(?:^|[\s._-])motion(?:[_-]design)?\.md$/i.test(n)) return true;
  if (!chemin) return false;
  try {
    const t = fs.readFileSync(chemin, 'utf8').slice(0, 40000);
    return /```motion-demo/.test(t) || (/^#{1,3}\s*(?:Keep|Replace)\b/m.test(t) && /motion/i.test(t));
  } catch { return false; }
}
export const MAX_MOTION_MD = 30000;
/** Le texte d'un Motion.md (30 000 caractères au plus), ou null. */
export function lireMotionMd(chemin) {
  try { return fs.readFileSync(chemin, 'utf8').slice(0, MAX_MOTION_MD); } catch { return null; }
}
/** Le Motion.md joint, posé pour le réalisateur (il le lit avec la décomposition des vidéos de référence). */
export const motionEnTexte = (texte, nom) => `# Le Motion.md joint par la personne : « ${nom} »\n\n_Une vidéo déjà décomposée plan par plan, au format d'OpenMotion. C'est un style à reproduire avec les rushes, la marque et les mots de la personne, jamais un contenu à copier._\n\n${texte}`;
/** La consigne d'un Motion.md joint, pour un monteur qui le lit lui-même (sans réalisateur, ou sans rushes regardés). */
export const consigneMotionMd = (motions) => (motions?.length ? `- « Comme cette vidéo » d'après un Motion.md : la personne a joint ${motions.map((x) => `« ${x.nom} »`).join(' et ')} (contexte/INDEX.md dit où). C'est une vidéo déjà décomposée plan par plan, au format d'OpenMotion : ses plans et leurs durées, ses mouvements, ses transitions, ses textes et leur style, son son, et ce qui doit rester ou changer. Lis-le en entier, puis refais ce style avec les rushes, la marque et les mots de la personne. Ses blocs « motion-demo » décrivent des démonstrations HTML qui ne sont pas dans le dossier : prends-en l'idée, pas les fichiers ; ses images et ses textes de marque ne sont pas à la personne, n'en reprends aucun.` : '');
