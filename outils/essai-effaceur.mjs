#!/usr/bin/env node
// Dérush — les essais de l'effaceur de texte incrusté (lib/effaceur.mjs, outils/effacer.py, outils/derush-effacer.mjs) :
// la commande et ses refus, l'installation seulement pour un projet qui a du texte incrusté, le modèle refusé s'il ne
// correspond pas à celui qui a été vérifié. Puis, si l'effaceur est installé dans le dossier de Dérush donné par
// ESSAI_EFFACEUR_SUPPORT, une vraie vidéo : un sous-titre façon appli, effacé (Telea, LaMa ; Apple Vision ou une bande),
// comparé au fond d'origine.
//   node outils/essai-effaceur.mjs [dossier où créer le dossier d'essai]
//   ESSAI_EFFACEUR_SUPPORT=<dossier de Dérush d'essai avec l'effaceur> node outils/essai-effaceur.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('node outils/essai-effaceur.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
fs.mkdirSync(base, {recursive: true});
const tmp = fs.mkdtempSync(path.join(base, 'derush-essai-effaceur-'));
const reel = process.env.ESSAI_EFFACEUR_SUPPORT ? path.resolve(process.env.ESSAI_EFFACEUR_SUPPORT) : null;
process.env.DERUSH_SUPPORT = path.join(tmp, 'support');
fs.mkdirSync(process.env.DERUSH_SUPPORT, {recursive: true});
const E = await import(pathToFileURL(path.join(D, 'lib', 'effaceur.mjs')).href);
const CMD = path.join(D, 'outils', 'derush-effacer.mjs');

let ok = 0;
let ko = 0;
const essai = (nom, cond, detail = '') => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`); } };
const cmd = (args, env = {}) => spawnSync(process.execPath, [CMD, ...args], {encoding: 'utf8', env: {...process.env, ...env}, timeout: 600000});
const json = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };

console.log('La commande derush-effacer');
const aide = cmd(['--help']);
essai('--help : le mode d’emploi (passage, zone, méthode, lenteur de LaMa), code 0', aide.status === 0 && /--zone/.test(aide.stdout) && /--methode/.test(aide.stdout) && /0,8 s par image/.test(aide.stdout));
essai('sans sortie : l’usage, code 1', cmd(['video.mp4']).status === 1);
essai('un passage à l’envers : refusé, code 1', /plus grand que --de/.test(json(cmd(['v.mp4', '-o', 's.mp4', '--de', '5', '--a', '2']))?.erreur ?? ''));
const pasInstalle = json(cmd(['v.mp4', '-o', 's.mp4']));
essai('pas installé : il dit où l’installer', /Connexions › Effaceur de texte/.test(pasInstalle?.erreur ?? ''), JSON.stringify(pasInstalle));

console.log('L’installation');
const etat = await E.etatEffaceur();
essai('pas installé : dit, avec sa taille', etat.ok === false && etat.taille === '260 Mo' && /pas encore installé/.test(etat.pourquoi), JSON.stringify(etat));
const P = {d: {medias: [{id: 'M1'}, {id: 'M2'}]}, cache: path.join(tmp, 'cache')};
fs.mkdirSync(path.join(P.cache, 'medias', 'M1'), {recursive: true});
fs.writeFileSync(path.join(P.cache, 'medias', 'M1', 'analyse.json'), JSON.stringify({incrustes: {texte: []}}));
essai('un projet sans texte incrusté : rien à installer tout seul', E.projetATexteIncruste(P) === false);
fs.mkdirSync(path.join(P.cache, 'medias', 'M2'), {recursive: true});
fs.writeFileSync(path.join(P.cache, 'medias', 'M2', 'analyse.json'), JSON.stringify({incrustes: {texte: [{de: 0, a: 4, texte: 'ON EST A OSAKA', hauteur_pct: 4.1}]}}));
essai('un rush avec des sous-titres d’appli : l’effaceur sera installé avant le montage', E.projetATexteIncruste(P) === true);
const faux = path.join(tmp, 'faux.onnx');
fs.writeFileSync(faux, 'pas un modèle');
process.env.DERUSH_EFFACEUR_MODELE = faux;
let refus = null;
try { await E.telechargerModele(); } catch (e) { refus = e.message; }
essai('un modèle qui ne correspond pas à celui vérifié (taille, empreinte) : refusé, rien n’est gardé', /ne correspond pas/.test(refus ?? '') && !fs.existsSync(E.cheminModele()) && !fs.existsSync(`${E.cheminModele()}.part`));
delete process.env.DERUSH_EFFACEUR_MODELE;

console.log('Une vraie vidéo (effaceur installé)');
const pret = reel && fs.existsSync(path.join(reel, 'moteurs', 'effaceur', 'lama_fp32.onnx'));
if (!pret) console.log('  · (non essayé ici : ESSAI_EFFACEUR_SUPPORT ne mène pas à un effaceur installé)');
else {
  const PY = path.join(reel, 'moteurs', 'python', 'bin', 'python');
  const W = path.join(tmp, 'videos');
  fs.mkdirSync(W);
  spawnSync(PY, ['-I', path.join(D, 'outils', 'essai-effaceur-video.py'), W], {encoding: 'utf8'});
  // la part refaite : la ressemblance au fond d'origine (PSNR) dans la bande du texte, et ailleurs
  const mesurer = (f) => {
    const r = spawnSync(PY, ['-I', '-c', `import subprocess, numpy as np, sys
def im(f):
    b = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', '1', '-i', f, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    return np.frombuffer(b, np.uint8).reshape(960, 540, 3).astype(np.float32)
ref, x = im(sys.argv[1]), im(sys.argv[2])
p = lambda a, b: 10 * np.log10(255 ** 2 / max(1e-9, ((a - b) ** 2).mean()))
print(round(p(x[715:840, 40:520], ref[715:840, 40:520]), 1), round(p(x[:680], ref[:680]), 1))`, path.join(W, 'fond.mp4'), f], {encoding: 'utf8'});
    return r.stdout.trim().split(' ').map(Number);
  };
  const [avant] = mesurer(path.join(W, 'incruste.mp4'));
  const env = {DERUSH_SUPPORT: reel};
  const t = json(cmd([path.join(W, 'incruste.mp4'), '-o', path.join(W, 'telea.mp4'), '--methode', 'telea'], env));
  const [tZone, tAilleurs] = t?.ok ? mesurer(path.join(W, 'telea.mp4')) : [0, 0];
  essai('Apple Vision trouve le sous-titre ; Telea l’efface (la bande ressemble au fond d’origine, le reste ne bouge pas)', t?.ok && t.lecture === 'vision' && t.effacees === 60 && tZone > avant + 12 && tAilleurs > 38, JSON.stringify({avant, tZone, tAilleurs, t}));
  const z = json(cmd([path.join(W, 'incruste.mp4'), '-o', path.join(W, 'zone.mp4'), '--zone', '0,0.75,1,0.12', '--methode', 'telea', '--de', '0.5', '--a', '1.5'], env));
  essai('une bande donnée, sur un passage : seules ses images sont touchées', z?.ok && z.lecture === 'zone' && z.effacees >= 29 && z.effacees <= 31 && z.images === 60, JSON.stringify(z));
  const l = json(cmd([path.join(W, 'incruste.mp4'), '-o', path.join(W, 'lama.mp4'), '--methode', 'lama', '--de', '0.9', '--a', '1.1'], env));
  const [lZone] = l?.ok ? mesurer(path.join(W, 'lama.mp4')) : [0];
  essai('LaMa refait le fond mieux que Telea', l?.ok && l.methode === 'lama' && lZone > tZone, JSON.stringify({lZone, tZone, l}));
  const sonde = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', path.join(W, 'telea.mp4')], {encoding: 'utf8'}).stdout;
  essai('le son est gardé', /audio/.test(sonde) && /video/.test(sonde), sonde);
}

console.log(`\n${ok} essais réussis sur ${ok + ko}`);
if (!ko) fs.rmSync(tmp, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${tmp}`);
process.exit(ko ? 1 : 0);
