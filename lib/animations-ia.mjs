// Dérush — les animations de l'IA (12.1). L'IA écrit une animation en code (un composant React de Remotion : titre
// animé, graphisme, carte, compteur, stickers…) ; Dérush la fabrique image par image, sur un fond transparent, et la
// pose dans la piste des effets comme un bloc « Animation » : on la déplace, on la raccourcit, on la supprime comme
// un autre effet, et la vidéo finale la reprend telle quelle (l'aperçu et le kit lisent les mêmes images).
// Rangement : <projet>/animations/A1/ = animation.json (nom, images, cadence, format), source.tsx (le code de l'IA),
// a_00000.webp… (les images, WebP avec transparence).
import fs from 'node:fs';
import path from 'node:path';
import {lancer, FFMPEG, ecrireJson, lireJson} from './outils.mjs';
import {RACINE_APP} from './moteurs.mjs';
import {lier} from './plateforme.mjs';
import {etatRendu, installerRendu, envNode, dossierMoteurRendu} from './rendu.mjs';
import {verifierPlace} from './disque.mjs';

const KIT = path.join(RACINE_APP, 'modeles', 'kit-remotion');
const PUBLIC = path.join(RACINE_APP, 'public');
/** La plus longue animation (en secondes) : au-delà, c'est un plan du montage, pas un habillage. */
export const DUREE_MAX_ANIMATION = 30;
const CODE_MAX = 200000;

// Le dossier de travail de l'IA qui monte en ce moment dans ce projet (lib/claude.mjs le retient pendant sa demande) :
// une animation s'y fabrique, dans SON kit, avec tout son matériel (logos, images, polices, dessins, rushes de public/,
// ses propres composants) ; sans lui (une app branchée de l'extérieur), dans une copie neuve du kit de Dérush.
const ATELIERS = new Map();
export function retenirAtelier(P, atelier) { if (P?.racine && atelier) ATELIERS.set(P.racine, atelier); }
export function oublierAtelier(P, atelier) { if (P?.racine && ATELIERS.get(P.racine) === atelier) ATELIERS.delete(P.racine); }
export function atelierDe(P) {
  const a = P?.racine ? ATELIERS.get(P.racine) : null;
  return a && fs.existsSync(path.join(a, 'remotion', 'node_modules')) ? a : null;
}

export const dossierAnimations = (P) => path.join(P.racine, 'animations');
export const dossierAnimation = (P, id) => path.join(dossierAnimations(P), id);
export const nomImageAnimation = (n) => `a_${String(n).padStart(5, '0')}.webp`;
const idValide = (id) => /^A\d{1,5}$/.test(String(id ?? ''));

/** Ce que Dérush sait d'une animation (animation.json), ou null. */
export function lireAnimation(P, id) {
  if (!idValide(id)) return null;
  return lireJson(path.join(dossierAnimation(P, id), 'animation.json')) ?? null;
}
/** Les animations du projet, de la plus ancienne à la plus récente. */
export function listerAnimations(P) {
  const d = dossierAnimations(P);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(idValide).map((id) => lireAnimation(P, id)).filter(Boolean).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}
/** Le fichier de l'image n d'une animation (bornée à ses images), ou null. */
export function fichierImageAnimation(P, id, n) {
  const a = lireAnimation(P, id);
  if (!a) return null;
  const k = Math.min(a.images - 1, Math.max(0, Math.round(Number(n) || 0)));
  const f = path.join(dossierAnimation(P, id), nomImageAnimation(k));
  return fs.existsSync(f) ? f : null;
}
function idLibre(P) {
  const d = dossierAnimations(P);
  let n = 1;
  while (fs.existsSync(path.join(d, `A${n}`))) n++;
  return `A${n}`;
}
/** Le code d'une animation : un fichier .tsx complet, qui exporte par défaut un composant React. */
function verifierCode(code) {
  const c = String(code ?? '');
  if (!c.trim()) throw new Error('Il manque le code de l’animation (un composant React de Remotion, en TypeScript), ou « fichier » : un composant de ton dossier de travail.');
  if (c.length > CODE_MAX) throw new Error(`Le code de l’animation est trop long (${CODE_MAX} caractères au plus).`);
  if (!/export\s+default\b/.test(c)) throw new Error('Le code doit exporter son composant par défaut : « export default function MonAnimation() { … } ».');
  return c;
}

/**
 * Fabrique une animation : le composant de l'IA, rendu image par image par le moteur de rendu de Dérush (Remotion),
 * au format et à la cadence du projet, sur un fond transparent ; les images passent en WebP (avec leur transparence).
 * Rend {id, nom, images, fps, largeur, hauteur, duree}. Une erreur de code est rendue telle quelle (les dernières
 * lignes du compilateur ou du rendu) : l'IA la corrige et recommence.
 */
export async function fabriquerAnimation(P, {code = null, fichier = null, nom = '', duree}, prog = () => {}) {
  const d = Number(duree);
  if (!(d >= 0.2 && d <= DUREE_MAX_ANIMATION)) throw new Error(`La durée d’une animation va de 0,2 à ${DUREE_MAX_ANIMATION} secondes.`);
  const place = verifierPlace(P.racine);
  if (!place.ok) throw new Error(place.texte);
  if (!etatRendu().ok) await installerRendu((p) => prog(p * 0.2));
  const {largeur, hauteur, fps} = P.d.sortie;
  const images = Math.max(1, Math.round(d * fps));
  const id = idLibre(P);
  const travail = path.join(P.cache, 'animations', id);
  fs.rmSync(travail, {recursive: true, force: true});
  fs.mkdirSync(travail, {recursive: true});
  const atelier = atelierDe(P);
  let kit;
  let source;
  let importe;
  let entree;
  if (atelier) {
    // dans le kit de l'IA : son composant (un fichier de remotion/src, qui peut importer ses autres fichiers) ou son code
    kit = path.join(atelier, 'remotion');
    if (fichier) {
      const f = path.resolve(kit, String(fichier).replace(/^remotion[\\/]/, ''));
      const rel = path.relative(path.join(kit, 'src'), f);
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || !/\.(tsx|jsx|ts|js)$/.test(f)) throw new Error('« fichier » : un composant de ton dossier de travail, dans remotion/src/ (.tsx).');
      if (!fs.existsSync(f)) throw new Error(`Fichier introuvable : remotion/src/${rel}.`);
      source = verifierCode(fs.readFileSync(f, 'utf8'));
      importe = `./${rel.split(path.sep).join('/').replace(/\.(tsx|jsx|ts|js)$/, '')}`;
    } else {
      source = verifierCode(code);
      fs.mkdirSync(path.join(kit, 'src', 'animations-ia'), {recursive: true});
      fs.writeFileSync(path.join(kit, 'src', 'animations-ia', `${id}.tsx`), source);
      importe = `./animations-ia/${id}`;
    }
    entree = `entree-animation-${id}.tsx`;
  } else {
    if (fichier && !code) throw new Error('« fichier » se donne pendant une demande dans Dérush (ton dossier de travail) ; ici, donne le code du composant.');
    source = verifierCode(code);
    kit = path.join(travail, 'remotion');
    // le kit de Dérush (ses pièces, son moteur d'habillage, ses polices) : le composant peut s'en servir
    fs.cpSync(KIT, kit, {recursive: true, filter: (src) => path.basename(src) !== 'node_modules'});
    fs.copyFileSync(path.join(PUBLIC, 'moteur.js'), path.join(kit, 'src', 'moteur.js'));
    fs.mkdirSync(path.join(kit, 'public'), {recursive: true});
    fs.cpSync(path.join(PUBLIC, 'polices'), path.join(kit, 'public', 'polices'), {recursive: true});
    // ce que src/donnees.ts lit (si une pièce s'en sert) : le format du projet et son style, sans plans
    ecrireJson(path.join(travail, 'montage.json'), {sortie: {largeur, hauteur, fps, images, duree: {s: images / fps, image: images, tc: ''}}, montage: [], superpositions: [], indications: [], style: P.d.style ?? {}, habillage: {effets: [], sans_sous_titres: []}});
    ecrireJson(path.join(travail, 'sous-titres', 'mots.json'), {mots: []});
    fs.writeFileSync(path.join(kit, 'src', 'AnimationIA.tsx'), source);
    importe = './AnimationIA';
    entree = 'entree-animation.tsx';
    if (!lier(path.join(dossierMoteurRendu(), 'node_modules'), path.join(kit, 'node_modules'))) throw new Error('Impossible de relier le moteur de rendu (droits du dossier ?).');
  }
  fs.writeFileSync(path.join(kit, 'src', entree), `import React from 'react';
import {Composition, registerRoot} from 'remotion';
import AnimationIA from '${importe}';

// L'animation de l'IA, seule, au format du projet (${largeur} × ${hauteur}, ${fps} i/s), ${images} images.
registerRoot(() => <Composition id="AnimationIA" component={AnimationIA as React.FC} durationInFrames={${images}} fps={${fps}} width={${largeur}} height={${hauteur}} />);
`);
  const pngs = path.join(travail, 'images');
  fs.mkdirSync(pngs, {recursive: true});
  prog(0.25);
  let rendues = 0;
  const suivre = (txt) => { for (const m of String(txt).matchAll(/Rendered (\d+)\/(\d+)/g)) rendues = Number(m[1]) / Math.max(1, Number(m[2])); prog(0.25 + rendues * 0.6); };
  try {
    await lancer(process.execPath, [path.join(dossierMoteurRendu(), 'node_modules', '@remotion', 'cli', 'remotion-cli.js'), 'render', `src/${entree}`, 'AnimationIA', pngs,
      '--sequence', '--image-format=png', '--props', '{}'], {cwd: kit, env: envNode(), surStdout: (b) => suivre(b.toString()), surStderr: suivre});
  } catch (e) {
    throw new Error(`L’animation n’a pas pu être fabriquée. Corrige le code et recommence. ${String(e.message).replace(/\s+/g, ' ').slice(-900)}`);
  } finally {
    // l'entrée écrite dans le kit de l'IA ne reste pas : son composant, lui, reste (elle peut le reprendre)
    if (atelier) fs.rmSync(path.join(kit, 'src', entree), {force: true});
  }
  const liste = fs.readdirSync(pngs).filter((f) => /\.png$/i.test(f)).sort();
  if (!liste.length) throw new Error('Le rendu de l’animation n’a donné aucune image.');
  const dossier = dossierAnimation(P, id);
  fs.mkdirSync(dossier, {recursive: true});
  // les images en WebP, avec leur transparence (comme les découpes du titre « derrière la personne »)
  await lancer(FFMPEG, ['-hide_banner', '-nostdin', '-y', '-v', 'error', '-pattern_type', 'glob', '-i', path.join(pngs, '*.png'), '-c:v', 'libwebp', '-quality', '82', '-pix_fmt', 'yuva420p', '-start_number', '0', path.join(dossier, 'a_%05d.webp')]);
  const n = fs.readdirSync(dossier).filter((f) => /^a_\d{5}\.webp$/.test(f)).length;
  if (!n) throw new Error('Les images de l’animation n’ont pas pu être enregistrées.');
  const info = {id, nom: String(nom || '').trim().slice(0, 80) || `Animation ${id.slice(1)}`, images: n, fps, largeur, hauteur, duree: Math.round((n / fps) * 1000) / 1000, cree_le: new Date().toISOString()};
  fs.writeFileSync(path.join(dossier, 'source.tsx'), source);
  ecrireJson(path.join(dossier, 'animation.json'), info, 2);
  if (process.env.DERUSH_GARDER_RENDU !== '1') fs.rmSync(travail, {recursive: true, force: true});
  prog(1);
  return info;
}
