#!/usr/bin/env node
// Dérush — « Exporter » une vidéo livrée par l'IA dans une plus grande taille (2K, 4K) : la même composition Remotion du
// dossier de travail, rendue à une plus grande échelle (les mêmes images, plus fines), sans rien remonter. Lancé par
// lib/exporter.mjs, jamais par l'IA.
//
//   node outils/exporter-ia.mjs <dossier remotion du pack> <Composition> <sortie.mp4> --echelle 2
//        [--props '{"afficherConsignes": false}'] [--duree 74.4]   (--duree : la durée de la vidéo livrée, vérifiée avant)
//
// Il écrit « Rendered N/M » au fil du rendu (Dérush en tire la progression), puis « FINI <largeur> <hauteur> ».
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
const option = (nom, defaut = null) => { const i = args.indexOf(nom); if (i < 0) return defaut; const v = args[i + 1]; args.splice(i, 2); return v; };
const echelle = Math.min(4, Math.max(0.25, Number(option('--echelle', '1')) || 1));
const props = {afficherConsignes: false, ...JSON.parse(option('--props', '{}'))};
const dureeAttendue = Number(option('--duree', '0')) || 0;
const [REM, composition, SORTIE] = args;
if (!REM || !composition || !SORTIE) { console.error('usage : node exporter-ia.mjs <remotion> <Composition> <sortie.mp4> --echelle 2'); process.exit(2); }
const dossier = path.resolve(REM);
const req = createRequire(path.join(dossier, 'package.json'));
const {bundle} = await import(pathToFileURL(req.resolve('@remotion/bundler')).href);
const {renderMedia, selectComposition} = await import(pathToFileURL(req.resolve('@remotion/renderer')).href);
process.chdir(dossier); // Remotion trouve son navigateur de rendu depuis le dossier du kit (celui du moteur de Dérush)
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-assemblage-'));
try {
  const serveUrl = await bundle({entryPoint: path.join(dossier, 'src', 'index.ts'), rootDir: dossier, publicDir: path.join(dossier, 'public'), enableCaching: true, symlinkPublicDir: true, outDir});
  const comp = await selectComposition({serveUrl, id: composition, inputProps: props});
  const duree = comp.durationInFrames / comp.fps;
  // la composition doit être celle de la vidéo livrée : une autre durée, et l'export serait une autre vidéo
  if (dureeAttendue && Math.abs(duree - dureeAttendue) > 0.25) {
    console.error(`COMPOSITION : « ${composition} » dure ${duree.toFixed(2)} s, la vidéo livrée ${dureeAttendue.toFixed(2)} s.`);
    process.exit(3);
  }
  console.log(`Composition « ${composition} » : ${comp.width} × ${comp.height}, ${comp.durationInFrames} images, rendue à l'échelle ${echelle}`);
  const tmp = `${SORTIE}.part.mp4`;
  let dernier = -1;
  await renderMedia({
    composition: comp, serveUrl, codec: 'h264', outputLocation: tmp, inputProps: props, scale: echelle, crf: 15, colorSpace: 'bt709',
    imageFormat: 'jpeg', jpegQuality: 98, chromiumOptions: {gl: 'angle'}, overwrite: true,
    onProgress: ({renderedFrames}) => {
      if (renderedFrames !== dernier && (renderedFrames - dernier >= 10 || renderedFrames === comp.durationInFrames)) { dernier = renderedFrames; console.log(`Rendered ${renderedFrames}/${comp.durationInFrames}`); }
    },
  });
  fs.renameSync(tmp, SORTIE);
  console.log(`FINI ${Math.round(comp.width * echelle)} ${Math.round(comp.height * echelle)}`);
} finally {
  fs.rmSync(outDir, {recursive: true, force: true});
}
