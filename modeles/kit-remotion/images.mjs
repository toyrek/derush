#!/usr/bin/env node
// Dérush — des images fixes de la vidéo, pour la regarder AVANT de la rendre en entier : un seul assemblage, puis une
// image par numéro demandé, et une planche de contrôle (de gauche à droite, puis de haut en bas).
//
//   node remotion/images.mjs [Composition] --de 0 --a 12 [--pas 6]   une image toutes les 6 images, de 0 à 12 s
//   node remotion/images.mjs [Composition] --images 30,97,250          ces images-là (numéros d'image)
//   Options : --sortie <dossier> (par défaut atelier/images du pack), --planche <fichier.jpg> (par défaut
//             <sortie>/planche.jpg), --colonnes 8, --largeur 270 (largeur d'une case de la planche).
//
// Chaque image est gardée en pleine taille (i00030.jpg…) : ouvre-les pour juger la typographie à 100 %. La commande dit
// quelle case de la planche montre quelle image. Par défaut, la composition « Montage ». Les cases « À créer » et les
// notes de l'humain y sont dessinées (des repères de travail : rendre.mjs ne les met pas dans la vidéo).
// Avec Codex ou Gemini (bac à sable : le navigateur de rendu n'y démarre pas), rends la vidéo, puis tire les images
// avec FFmpeg (ffmpeg -ss <temps> -i rendu/final.mp4 -frames:v 1 image.jpg).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PACK = path.join(ICI, '..');
const args = process.argv.slice(2);
if (args.some((x) => ['--help', '-h', '--aide'].includes(x))) {
  console.log(`node remotion/images.mjs — des images fixes de la vidéo et une planche, sans la rendre en entier.

  node remotion/images.mjs [Composition] --de 0 --a 12 [--pas 6]    une image toutes les 6 images, de 0 à 12 s
  node remotion/images.mjs [Composition] --images 30,97,250           ces images-là (numéros d'image)
  --sortie <dossier> (atelier/images du pack), --planche <fichier.jpg>, --colonnes 8, --largeur 270

Composition : « Montage » par défaut ; « Pieces » montre les pièces du kit (src/pieces/LISEZMOI.md).
Chaque image est gardée en pleine taille (i00030.jpg…) : ouvre-les pour juger la typographie à 100 %.
La réponse dit quelle case de la planche montre quelle image. 120 images au plus par appel.`);
  process.exit(0);
}
const opt = (nom, def = null) => { const i = args.indexOf(nom); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const de = opt('--de');
const a = opt('--a');
const pas = Math.max(1, Math.round(Number(opt('--pas', 6)) || 6));
const liste = opt('--images');
const sortie = path.resolve(opt('--sortie', path.join(PACK, 'atelier', 'images')));
const planche = path.resolve(opt('--planche', path.join(sortie, 'planche.jpg')));
const colonnes = Math.max(1, Math.round(Number(opt('--colonnes', 8)) || 8));
const largeur = Math.max(80, Math.round(Number(opt('--largeur', 270)) || 270));
const composition = args.find((x) => !x.startsWith('--')) ?? 'Montage';

// depuis le dossier du kit : Remotion y trouve le navigateur de rendu de Dérush (sinon il en télécharge une copie de
// 570 Mo dans le pack) ; les chemins demandés sont déjà absolus
process.chdir(ICI);
const {bundle} = await import('@remotion/bundler');
const {openBrowser, renderStill, selectComposition} = await import('@remotion/renderer');
const serveUrl = await bundle({entryPoint: path.join(ICI, 'src', 'index.ts'), rootDir: ICI, publicDir: path.join(ICI, 'public'), enableCaching: true, symlinkPublicDir: true,
  outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'derush-assemblage-'))});
// l'assemblage (dans le dossier temporaire du système) est effacé à la fin : sinon ils s'empilent jusqu'à remplir le disque
const nettoyer = () => { try { fs.rmSync(serveUrl, {recursive: true, force: true}); } catch { /* déjà parti */ } };
process.on('exit', nettoyer);
// Un seul navigateur de rendu pour toute la commande : sans cela, Remotion en ouvrait et en fermait un pour chaque image
// (et un de plus pour lire la composition), une à deux secondes perdues par image. S'il ne s'ouvre pas ainsi, on fait
// comme avant.
let navigateur = null;
try { navigateur = await openBrowser('chrome', {chromiumOptions: {gl: 'angle'}}); } catch { /* chaque image ouvrira le sien */ }
const fermer = async () => { try { await navigateur?.close({silent: true}); } catch { /* déjà fermé */ } };
const avec = navigateur ? {puppeteerInstance: navigateur} : {};
let comp;
try { comp = await selectComposition({serveUrl, id: composition, inputProps: {}, ...avec}); } catch (e) { await fermer(); throw e; }
const derniere = comp.durationInFrames - 1;
let images;
if (liste) images = liste.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n));
else {
  const i0 = Math.max(0, Math.round(Number(de ?? 0) * comp.fps));
  const i1 = Math.min(derniere, a != null ? Math.round(Number(a) * comp.fps) : derniere);
  images = [];
  for (let n = i0; n <= i1; n += pas) images.push(n);
}
images = [...new Set(images.map((n) => Math.min(derniere, Math.max(0, Math.round(n)))))].sort((x, y) => x - y);
if (!images.length) { console.error('Aucune image demandée (--de/--a, ou --images 30,97,250).'); await fermer(); process.exit(1); }
if (images.length > 120) { console.error(`${images.length} images : c'est beaucoup. Prends un pas plus grand (--pas) ou un passage plus court.`); await fermer(); process.exit(1); }
fs.mkdirSync(sortie, {recursive: true});
const fichiers = [];
try {
  for (const n of images) {
    const f = path.join(sortie, `i${String(n).padStart(5, '0')}.jpg`);
    await renderStill({composition: comp, serveUrl, frame: n, output: f, imageFormat: 'jpeg', jpegQuality: 90, chromiumOptions: {gl: 'angle'}, inputProps: {}, overwrite: true, ...avec});
    fichiers.push(f);
    process.stdout.write(`${n} `);
  }
} finally {
  await fermer(); // même si une image échoue : aucun navigateur ne reste ouvert derrière la commande
}
console.log('');
// la planche : toutes les images réduites, côte à côte (FFmpeg)
const ffmpeg = process.env.DERUSH_FFMPEG || 'ffmpeg';
const hauteur = Math.round((largeur * comp.height) / comp.width / 2) * 2;
const n = fichiers.length;
let ok = false;
if (n === 1) ok = spawnSync(ffmpeg, ['-v', 'error', '-y', '-i', fichiers[0], '-vf', `scale=${largeur}:${hauteur}`, '-q:v', '3', planche]).status === 0;
else {
  const cols = Math.min(colonnes, n);
  const filtre = [...fichiers.map((_, k) => `[${k}:v]scale=${largeur}:${hauteur}[c${k}]`),
    `${fichiers.map((_, k) => `[c${k}]`).join('')}xstack=inputs=${n}:layout=${fichiers.map((_, k) => `${(k % cols) * largeur}_${Math.floor(k / cols) * hauteur}`).join('|')}:fill=black[p]`].join(';');
  ok = spawnSync(ffmpeg, ['-v', 'error', '-y', ...fichiers.flatMap((f) => ['-i', f]), '-filter_complex', filtre, '-map', '[p]', '-frames:v', '1', '-q:v', '3', planche]).status === 0;
}
const temps = (k) => `${(k / comp.fps).toFixed(2).replace('.', ',')} s`;
console.log(`${n} image(s) dans ${path.relative(PACK, sortie) || '.'} (pleine taille).`);
if (ok) console.log(`Planche : ${path.relative(PACK, planche)} — ${Math.min(colonnes, n)} par ligne : ${images.map((k, i) => `case ${i + 1} = image ${k} (${temps(k)})`).join(', ')}.`);
else console.log('La planche n’a pas pu être assemblée (FFmpeg) : regarde les images une à une.');
process.exit(0);
