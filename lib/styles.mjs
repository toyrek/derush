// Dérush — les styles, et « Comme cette vidéo » d'après un Motion.md.
//   - Les styles : trois collections, chacune une compétence avec son catalogue.json. Deux sont livrées : « Styles
//     vidéo » (competences/styles-video : 99 recettes de direction artistique adaptées d'OpenMotion, Apache-2.0) et
//     « Tableaux en mouvement » (competences/tableaux-en-mouvement : 100 fiches d'art, de dessin et de mouvement, à
//     fabriquer en code avec derush-toile ; voir leur SOURCE.md). La troisième, « Films en 99 styles », se télécharge
//     chez la personne sur un clic (les fiches de Lemo-Opuscar, sous licence CC BY-NC : voir lib/opuscar.mjs). Le bouton
//     « Styles » de la zone d'écriture pose « Style : <nom> » dans la demande ; Dérush retrouve la fiche et dit au
//     monteur où la lire.
//   - Un Motion.md (le format d'OpenMotion : une vidéo décomposée plan par plan — ses plans, leurs temps, ses
//     transitions, son son, ce qui doit rester ou changer) joint comme référence : le monteur reprend ce style sans la
//     vidéo d'origine ; en Mode Hollywood, le réalisateur s'en sert pour son découpage.
import fs from 'node:fs';
import path from 'node:path';
import {RACINE_APP} from './moteurs.mjs';
import {DOSSIER_OPUSCAR, NOM_OPUSCAR, etatOpuscar} from './opuscar.mjs';

export const DOSSIER_STYLES = path.join(RACINE_APP, 'competences', 'styles-video');
export const DOSSIER_STYLES_TABLEAUX = path.join(RACINE_APP, 'competences', 'tableaux-en-mouvement');
/** Les collections de styles : chacune est une compétence livrée (son dossier porte catalogue.json et les fiches). */
export const COLLECTIONS = [
  {id: 'styles-video', nom: 'Styles vidéo', aide: 'Habiller et monter tes rushes : face caméra, explications, promos, effets.', credit: 'Recettes adaptées d’OpenMotion (licence Apache-2.0).', dossier: DOSSIER_STYLES},
  {id: 'tableaux-en-mouvement', nom: 'Tableaux en mouvement', aide: 'Une image peinte, dessinée ou animée, tout en code, sans rush : un tableau qui bouge, un dessin qui se trace.',
    credit: 'Fiches de huashu-art-motion (MIT), d’anidoodle (Apache-2.0) et de mg-styles-15 (MIT).', dossier: DOSSIER_STYLES_TABLEAUX},
  // celle-ci n'est pas livrée : la personne la télécharge d'un clic (lib/opuscar.mjs), et elle arrive dans le dossier de Dérush
  {id: NOM_OPUSCAR, nom: 'Films en 99 styles', aide: 'Un film entier fait en code, dans une manière précise : infos sous-titrées, aquarelle, plan d’ingénieur, ombres chinoises, plan de métro.',
    credit: 'Fiches de Lemo-Opuscar, par Lemomo (LemoLab), licence CC BY-NC 4.0 : pour tes propres films. Elles sont en anglais ; ton IA les lit.', dossier: DOSSIER_OPUSCAR, telechargeable: true},
];
let memo = null;
/** À appeler quand une collection vient d'être téléchargée ou retirée. */
export const oublierStyles = () => { memo = null; };
/**
 * Le catalogue des styles, toutes collections réunies (ou une seule : `collection`) :
 * {collections: [{id, nom, aide, credit, styles, a_telecharger?}], categories: [{id, nom, aide, collection}],
 *  styles: [{id, nom, categorie, description, nom_origine, fichier, competence}]}.
 * Une collection à télécharger qui n'est pas encore là est listée avec 0 style et « a_telecharger » (sa taille, sa source).
 */
export function catalogueStyles(collection = null) {
  if (!memo) {
    memo = {collections: [], categories: [], styles: []};
    for (const c of COLLECTIONS) {
      let j = null;
      const etat = c.telechargeable ? etatOpuscar() : null;
      try { j = etat && !etat.present ? null : JSON.parse(fs.readFileSync(path.join(c.dossier, 'catalogue.json'), 'utf8')); } catch { /* pas là */ }
      if (!j && !etat) continue;
      const styles = (j?.styles ?? []).map((s) => ({...s, competence: c.id}));
      memo.collections.push({id: c.id, nom: c.nom, aide: c.aide, credit: c.credit, styles: styles.length, ...(etat ? {a_telecharger: {...etat.a_telecharger, present: etat.present, a_jour: etat.a_jour}} : {})});
      if (!j) continue;
      memo.categories.push(...(j.categories ?? []).map((x) => ({...x, collection: c.id})));
      memo.styles.push(...styles);
    }
  }
  if (!collection) return memo;
  return {collections: memo.collections.filter((c) => c.id === collection), categories: memo.categories.filter((c) => c.collection === collection), styles: memo.styles.filter((s) => s.competence === collection)};
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
    // le nom entier, l'id ou le nom d'origine ; sinon le nom sans sa parenthèse (« Estampe japonaise » pour « Estampe
    // japonaise (ukiyo-e) »), quand un seul style s'appelle ainsi
    const court = (x) => simple(x.nom.replace(/\s*\([^)]*\)\s*$/, ''));
    const proches = styles.filter((x) => court(x) === v.replace(/\s*\([^)]*\)\s*$/, ''));
    const s = styles.find((x) => simple(x.nom) === v || x.id === v || simple(x.nom_origine) === v) ?? (proches.length === 1 ? proches[0] : undefined);
    if (s && !r.includes(s)) r.push(s);
  }
  return r.slice(0, 2);
}
/** La consigne des styles choisis, avec le chemin de chaque fiche dans les compétences de cette IA. */
export function consigneStyles(styles, moteur) {
  if (!styles?.length) return '';
  const base = moteur === 'claude' ? '.claude/skills' : '.agents/skills';
  const chemin = (s) => `${base}/${s.competence ?? 'styles-video'}/${s.fichier}`;
  const video = styles.filter((s) => s.competence !== 'tableaux-en-mouvement' && s.competence !== NOM_OPUSCAR);
  const tableaux = styles.filter((s) => s.competence === 'tableaux-en-mouvement');
  const films = styles.filter((s) => s.competence === NOM_OPUSCAR);
  const lignes = [];
  if (video.length) lignes.push(`- Style choisi par la personne : ${video.map((s) => `« ${s.nom} » (sa recette : ${chemin(s)})`).join(' et ')}. Lis la recette en entier avant de monter et suis-la : son allure, ses mouvements et leurs temps, ce qu'elle dit d'éviter, et sa vérification (« Review »). Ses couleurs et polices sont des points de départ : le kit média et la marque de la personne passent avant. Dis dans ton compte rendu comment tu l'as appliquée.`);
  if (tableaux.length) lignes.push(`- Style choisi par la personne : ${tableaux.map((s) => `« ${s.nom} » (sa fiche : ${chemin(s)})`).join(' et ')}. C'est un tableau en mouvement : il se dessine en code, dans une page rendue image par image par la commande derush-toile (aide : derush-toile --help). Lis d'abord ${base}/tableaux-en-mouvement/SKILL.md (la méthode, le contrat d'une toile, les pages de départ), puis la fiche en entier. Garde la manière (le trait, les couleurs, la lumière, la façon de bouger) et fais le sujet de la personne, avec ses mots et sa marque : ne reproduis aucun personnage, aucun logo ni aucune œuvre, et écris « à la manière de » dans ton compte rendu quand le style porte le nom d'un artiste ou d'un studio. Regarde des images fixes avant de rendre (derush-toile images … --planche), lis la mesure du mouvement après le rendu, puis pose la toile dans le montage ou livre-la (rendu/final.mp4). Dis dans ton compte rendu comment tu as appliqué le style.`);
  if (films.length) lignes.push(`- Style choisi par la personne : ${films.map((s) => `« ${s.nom} » (sa fiche, en anglais : ${chemin(s)})`).join(' et ')}. C'est un film entier fait en code, dans cette manière. Lis d'abord ${base}/${NOM_OPUSCAR}/SKILL.md (ce que deviennent leurs outils dans Dérush, et ce qu'on ne télécharge pas), puis la fiche en entier, et suis-la : sa matière, ses couleurs, son mouvement, sa caméra, son son, ses pièges. L'histoire, les mots et la marque sont ceux de la personne ; les œuvres que la fiche cite sont une grammaire, jamais un modèle à recopier. Fabrique-le avec derush-toile (aide : derush-toile --help), regarde des images avant de rendre, et lis la mesure du mouvement après.`);
  return lignes.join('\n');
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
