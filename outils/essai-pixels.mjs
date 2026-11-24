#!/usr/bin/env node
// Dérush — les essais du ralenti fluide et de l'agrandisseur (lib/zip-distant.mjs, lib/moteurs-pixels.mjs,
// lib/images-video.mjs, lib/ralenti.mjs, lib/agrandir.mjs, la route /pixels du relais) :
//   - une archive zip lue par morceaux, sur le disque et par un petit serveur local (avec et sans « Range »), et ses
//     pièges (taille annoncée fausse, archive coupée, fichier qui se décompresse en plus gros qu'annoncé) ;
//   - l'installation d'un moteur depuis une source jouée ici (de faux RIFE et Real-ESRGAN, écrits par cet essai, qui
//     se comportent comme les vrais : chemin de modèle relatif, rien d'écrit et code 0 quand ça rate), une archive
//     trafiquée refusée sans rien garder, un moteur qui ne démarre pas, le retrait ;
//   - le ralenti image par image : chaque image de sortie est la bonne (le faux RIFE prend l'image la plus proche,
//     on sait donc laquelle attendre), en un lot ou en petits lots, pour ×2 et pour 24 → 30 images/s ; FFmpeg ; les
//     vraies images d'un rush à 120 images/s ; le son ; les refus ;
//   - l'agrandisseur : tailles, modèles, transparence, vidéo par lots avec son, estimation, garde-fou du temps ;
//   - le relais d'une IA en bac à sable : ce qui est refusé, ce qui passe, par l'adresse locale et par la boîte ;
//   - et, si DERUSH_ESSAI_ARCHIVES_PIXELS donne un dossier avec les vraies archives (rife.zip, realesrgan.zip), les
//     vrais moteurs, installés depuis elles et essayés sur la carte graphique (sinon sauté, et dit).
//   node outils/essai-pixels.mjs [dossier où créer le dossier d'essai]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {spawnSync, spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('node outils/essai-pixels.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
fs.mkdirSync(base, {recursive: true});
const T = fs.mkdtempSync(path.join(fs.realpathSync(base), 'derush-essai-pixels-'));
const ARCHIVES_VRAIES = process.env.DERUSH_ESSAI_ARCHIVES_PIXELS ? path.resolve(process.env.DERUSH_ESSAI_ARCHIVES_PIXELS) : null;
for (const k of ['DERUSH_RELAIS', 'DERUSH_RELAIS_BOITE', 'DERUSH_RELAIS_JETON', 'DERUSH_ESSAI_LOT', 'DERUSH_MOTEURS_PIXELS_ARCHIVES', 'FAUX_PAR_PIXEL']) delete process.env[k];

let ok = 0;
let ko = 0;
// un garde-fou : une suite qui reste coincée (un sous-processus qui attend) s'arrête en le disant
setTimeout(() => { console.log(`\n✗ la suite est restée coincée plus de 15 minutes : arrêtée (${ok} essais réussis avant)`); process.exit(2); }, 15 * 60e3).unref();
const essai = (nom, cond, detail = '') => { if (cond === true) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail !== '' ? ` — ${JSON.stringify(detail).slice(0, 600)}` : ''}`); } };
const titre = (t) => console.log(`\n${t}`);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const ffmpeg = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-y', ...args], {encoding: 'utf8'}); if (r.status !== 0) throw new Error(`ffmpeg : ${r.stderr}`); };
const sonde = (f) => JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-print_format', 'json', '-show_streams', '-show_format', f], {encoding: 'utf8'}).stdout || '{}');
const video = (f) => { const j = sonde(f); const v = (j.streams ?? []).find((s) => s.codec_type === 'video') ?? {}; return {largeur: v.width, hauteur: v.height, images: Number(v.nb_read_frames), fps: v.r_frame_rate, duree: Number(j.format?.duration), son: (j.streams ?? []).some((s) => s.codec_type === 'audio'), pix: v.pix_fmt}; };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ——— une petite archive zip, écrite ici (méthodes « stockée » et « deflate », un commentaire en fin) ———
const TABLE_CRC = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = TABLE_CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zipper(entrees, commentaire = '') {
  const locaux = [];
  const centraux = [];
  let pos = 0;
  for (const e of entrees) {
    const nom = Buffer.from(e.nom);
    const brut = e.donnees ?? Buffer.alloc(0);
    const comp = e.deflate ? zlib.deflateRawSync(brut) : brut;
    const methode = e.deflate ? 8 : 0;
    const taille = e.tailleAnnoncee ?? brut.length;
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt16LE(methode, 8); l.writeUInt32LE(crc32(brut), 14); l.writeUInt32LE(comp.length, 18); l.writeUInt32LE(taille, 22); l.writeUInt16LE(nom.length, 26);
    locaux.push(l, nom, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(0x031e, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(methode, 10); c.writeUInt32LE(crc32(brut), 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(taille, 24); c.writeUInt16LE(nom.length, 28); c.writeUInt32LE(((e.mode ?? 0o100644) * 65536) >>> 0, 38); c.writeUInt32LE(pos, 42);
    centraux.push(c, nom);
    pos += 30 + nom.length + comp.length;
  }
  const table = Buffer.concat(centraux);
  const com = Buffer.from(commentaire);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(entrees.length, 8); fin.writeUInt16LE(entrees.length, 10); fin.writeUInt32LE(table.length, 12); fin.writeUInt32LE(pos, 16); fin.writeUInt16LE(com.length, 20);
  return Buffer.concat([...locaux, table, fin, com]);
}
// un serveur qui sert des fichiers, par morceaux (« Range ») ou en entier, et compte ce qu'il envoie
const servis = {octets: 0, morceaux: true, fichiers: new Map()};
const serveur = http.createServer((req, res) => {
  const contenu = servis.fichiers.get(req.url);
  if (!contenu) { res.writeHead(404); return res.end(); }
  const m = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range ?? '');
  if (servis.morceaux && m) {
    const [a, b] = [Number(m[1]), Math.min(Number(m[2]), contenu.length - 1)];
    res.writeHead(206, {'content-range': `bytes ${a}-${b}/${contenu.length}`, 'content-length': b - a + 1});
    servis.octets += b - a + 1;
    return res.end(contenu.subarray(a, b + 1));
  }
  res.writeHead(200, {'content-length': contenu.length});
  servis.octets += contenu.length;
  res.end(contenu);
});
await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
const ADRESSE = `http://127.0.0.1:${serveur.address().port}`;

// ——— les faux moteurs : des programmes qui se comportent comme les vrais (chemins de modèle relatifs au dossier du
// programme, code 0 et rien d'écrit quand ça rate) ———
const FAUX_RIFE = `#!/usr/bin/env node
// faux RIFE (essais de Dérush) : chaque image de sortie est la plus proche de son instant, comme le ferait RIFE pour fx
const fs = require('fs'); const path = require('path');
const a = process.argv.slice(2); const opt = (k, d) => { const i = a.indexOf(k); return i < 0 ? d : a[i + 1]; };
const [e, s, m] = [opt('-i'), opt('-o'), opt('-m', 'rife-v2.3')];
if (path.isAbsolute(m) || !fs.existsSync(path.join(m, 'flownet.param'))) { console.error('fopen ' + m + '/flownet.bin failed'); process.exit(0); }
const entrees = fs.readdirSync(e).filter((f) => f.endsWith('.png')).sort();
const c = entrees.length; const n = Number(opt('-n', 2 * c));
fs.mkdirSync(s, {recursive: true});
for (let k = 0; k < n; k++) { const fx = (k * c) / n; const x0 = Math.floor(fx); const x = Math.min(c - 1, fx - x0 < 0.5 ? x0 : x0 + 1); fs.copyFileSync(path.join(e, entrees[x]), path.join(s, String(k + 1).padStart(8, '0') + '.png')); }
`;
const FAUX_ESRGAN = `#!/usr/bin/env node
// faux Real-ESRGAN (essais de Dérush) : agrandit au plus proche voisin, par FFmpeg ; FAUX_PAR_PIXEL le rend lent
const fs = require('fs'); const path = require('path'); const {execFileSync} = require('child_process');
const a = process.argv.slice(2); const opt = (k, d) => { const i = a.indexOf(k); return i < 0 ? d : a[i + 1]; };
const [e, s, n, x, m] = [opt('-i'), opt('-o'), opt('-n', 'realesr-animevideov3'), Number(opt('-s', 4)), opt('-m', 'models')];
const modele = path.join(m, n === 'realesrgan-x4plus' ? n + '.param' : n + '-x' + x + '.param');
if (path.isAbsolute(m) || !fs.existsSync(modele)) { console.error('find_blob_index_by_name failed'); process.exit(0); }
const lent = Number(process.env.FAUX_PAR_PIXEL || 0);
const un = (de, vers) => {
  if (lent) { const [l, h] = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', de]).toString().trim().split(',').map(Number); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.round(lent * l * h * 1000)); }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', de, '-vf', 'scale=iw*' + x + ':ih*' + x + ':flags=neighbor', vers]);
};
if (fs.statSync(e).isDirectory()) { fs.mkdirSync(s, {recursive: true}); for (const f of fs.readdirSync(e).filter((y) => /\\.(png|jpe?g|webp)$/.test(y)).sort()) un(path.join(e, f), path.join(s, f.replace(/\\.\\w+$/, '.png'))); }
else un(e, s);
`;
const MUET = '#!/bin/sh\n# un moteur qui ne fait rien (comme dans un bac à sable sans carte graphique)\nexit 0\n';
const fichiersRife = (programme = FAUX_RIFE) => ({'rife-ncnn-vulkan': Buffer.from(programme), 'rife-v4.6/flownet.bin': Buffer.from('poids'), 'rife-v4.6/flownet.param': Buffer.from('7767517\n'), LICENSE: Buffer.from('MIT (faux)\n')});
const fichiersEsrgan = (programme = FAUX_ESRGAN) => ({'realesrgan-ncnn-vulkan': Buffer.from(programme),
  ...Object.fromEntries([2, 3, 4].flatMap((k) => [[`models/realesr-animevideov3-x${k}.bin`, Buffer.from('p')], [`models/realesr-animevideov3-x${k}.param`, Buffer.from(`x${k}`)]])),
  'models/realesrgan-x4plus.bin': Buffer.from('p'), 'models/realesrgan-x4plus.param': Buffer.from('x4plus')});
const archive = (racine, fichiers, programme) => zipper([{nom: 'LISEZMOI-archive.txt', donnees: Buffer.from('autre chose'), deflate: true},
  // la licence est rangée telle quelle (sans compression) : l'essai peut la trafiquer sans changer la taille de l'archive
  ...Object.entries(fichiers).map(([nom, donnees]) => ({nom: `${racine}${nom}`, donnees, deflate: nom !== 'LICENSE', mode: nom === programme ? 0o100755 : 0o100644})),
  {nom: `${racine}gros-inutile.bin`, donnees: crypto.randomBytes(300000)}], 'un commentaire en fin d’archive');
const manifeste = {releve: 'essai'};
for (const [id, racine, fichiers, programme] of [['rife', 'faux-rife/', fichiersRife(), 'rife-ncnn-vulkan'], ['realesrgan', '', fichiersEsrgan(), 'realesrgan-ncnn-vulkan']]) {
  const z = archive(racine, fichiers, programme);
  servis.fichiers.set(`/${id}.zip`, z);
  manifeste[id] = {nom: id === 'rife' ? 'RIFE' : 'Real-ESRGAN', version: 'essai 1', source: `${ADRESSE}/`, licence: 'essai',
    mac: {archive: `${ADRESSE}/${id}.zip`, octets: z.length, sha256: sha(z), a_telecharger: 20000, racine, programme, fichiers: Object.fromEntries(Object.entries(fichiers).map(([k, v]) => [k, [v.length, sha(v)]]))}};
}
fs.writeFileSync(path.join(T, 'manifeste.json'), JSON.stringify(manifeste));
process.env.DERUSH_SUPPORT = path.join(T, 'support');
process.env.DERUSH_MOTEURS_PIXELS_MANIFESTE = path.join(T, 'manifeste.json');
process.env.DERUSH_MOTEURS_PIXELS_SYSTEME = 'mac';
const lib = (m) => import(pathToFileURL(path.join(D, 'lib', m)).href);
const Z = await lib('zip-distant.mjs');
const M = await lib('moteurs-pixels.mjs');
const IV = await lib('images-video.mjs');
const R = await lib('ralenti.mjs');
const A = await lib('agrandir.mjs');

try {
  // ———————————————————————————————————————————————————————————————————————————
  titre('Une archive zip lue par morceaux');
  const contenus = {'a.txt': Buffer.from('bonjour'), 'dossier/b.bin': crypto.randomBytes(70000), 'c.txt': Buffer.from('x'.repeat(5000))};
  const z = zipper([{nom: 'a.txt', donnees: contenus['a.txt']}, {nom: 'dossier/b.bin', donnees: contenus['dossier/b.bin'], deflate: true}, {nom: 'c.txt', donnees: contenus['c.txt'], deflate: true}], 'fin');
  const zf = path.join(T, 'petite.zip');
  fs.writeFileSync(zf, z);
  const u = spawnSync('unzip', ['-tq', zf], {encoding: 'utf8'});
  essai('l’archive écrite par l’essai est une vraie archive (unzip la relit)', u.error ? true : u.status === 0, u.stdout + u.stderr);
  let table = await Z.tableZip(Z.sourceFichier(zf));
  essai('sur le disque : la table donne les trois fichiers, leurs tailles et leur ordre', table.length === 3 && table.map((e) => e.nom).join() === 'a.txt,dossier/b.bin,c.txt' && table[1].taille === 70000 && table.every((e) => e.fin > e.decalage), table);
  let pareils = true;
  for (const e of table) pareils &&= (await Z.lireEntree(Z.sourceFichier(zf), e)).equals(contenus[e.nom]);
  essai('… et chaque fichier ressort tel quel (stocké ou compressé)', pareils);
  servis.fichiers.set('/petite.zip', z);
  servis.octets = 0;
  let recus = 0;
  const sh = Z.sourceHttp(`${ADRESSE}/petite.zip`, {taille: z.length, surOctets: (n) => { recus += n; }});
  table = await Z.tableZip(sh);
  const a = await Z.lireEntree(sh, table.find((e) => e.nom === 'a.txt'));
  essai('par un serveur : la table et un petit fichier, sans prendre le gros (seulement les morceaux utiles)', a.equals(contenus['a.txt']) && servis.octets < 8000 && recus === servis.octets, {servis: servis.octets, recus, total: z.length});
  const longCom = zipper([{nom: 'a.txt', donnees: contenus['a.txt']}], 'c'.repeat(20000));
  const zl = path.join(T, 'long-commentaire.zip');
  fs.writeFileSync(zl, longCom);
  essai('une archive avec un long commentaire en fin (20 000 caractères) : sa table est trouvée quand même', (await Z.tableZip(Z.sourceFichier(zl))).length === 1);
  let err = null;
  try { await Z.tableZip(Z.sourceHttp(`${ADRESSE}/petite.zip`, {taille: z.length + 1})); } catch (e) { err = e; }
  essai('une archive qui n’a pas la taille attendue : refusée', /n’a pas la taille/.test(err?.message ?? ''), err?.message);
  servis.morceaux = false;
  err = null;
  try { await Z.tableZip(Z.sourceHttp(`${ADRESSE}/petite.zip`, {taille: z.length})); } catch (e) { err = e; }
  essai('un serveur qui ne sert pas par morceaux : dit, pour que l’archive soit prise en entière', err?.sansMorceaux === true, err?.message);
  servis.morceaux = true;
  const coupee = path.join(T, 'coupee.zip');
  fs.writeFileSync(coupee, z.subarray(0, z.length - 30));
  err = null;
  try { await Z.tableZip(Z.sourceFichier(coupee)); } catch (e) { err = e; }
  essai('une archive coupée : « pas une archive zip », rien n’est lu', /archive zip/.test(err?.message ?? ''), err?.message);
  const bombe = path.join(T, 'bombe.zip');
  fs.writeFileSync(bombe, zipper([{nom: 'zeros.bin', donnees: Buffer.alloc(2e6), deflate: true, tailleAnnoncee: 100}]));
  err = null;
  try { const s = Z.sourceFichier(bombe); await Z.lireEntree(s, (await Z.tableZip(s))[0]); } catch (e) { err = e; }
  essai('un fichier qui se décompresse en plus gros qu’annoncé : arrêté à la taille annoncée, et refusé', /ne se décompresse pas|taille annoncée/.test(err?.message ?? ''), err?.message);

  // ———————————————————————————————————————————————————————————————————————————
  titre('Les moteurs : la vraie table, l’installation, l’essai de démarrage, le retrait');
  const vraie = JSON.parse(fs.readFileSync(path.join(D, 'lib', 'moteurs-pixels.json'), 'utf8'));
  essai('la vraie table : les deux archives officielles (GitHub), leur taille et leur empreinte, les fichiers à garder',
    ['rife', 'realesrgan'].every((id) => /^https:\/\/github\.com\/(nihui|xinntao)\//.test(vraie[id].mac.archive) && vraie[id].mac.octets > 1e7 && /^[0-9a-f]{64}$/.test(vraie[id].mac.sha256) && Object.values(vraie[id].mac.fichiers).every(([o, h]) => o > 0 && /^[0-9a-f]{64}$/.test(h)) && vraie[id].mac.fichiers[vraie[id].mac.programme]),
    vraie);
  essai('… RIFE : seulement le programme, le modèle 4.6 et la licence (36 Mo gardés sur 416)', Object.keys(vraie.rife.mac.fichiers).sort().join() === 'LICENSE,rife-ncnn-vulkan,rife-v4.6/flownet.bin,rife-v4.6/flownet.param');
  essai('… Real-ESRGAN : le programme et les modèles dessin (×2, ×3, ×4) et photo, sans la vidéo de démonstration', Object.keys(vraie.realesrgan.mac.fichiers).length === 9 && !Object.keys(vraie.realesrgan.mac.fichiers).some((f) => /\.(mp4|jpg)$/.test(f)));
  let e = M.etatMoteurPixels('rife');
  essai('pas encore installé : installable, avec ce qu’il y a à télécharger', e.ok === false && e.installe === false && e.installable === true && /Mo/.test(e.a_telecharger), e);
  servis.octets = 0;
  let avancees = [];
  e = await M.installerMoteurPixels('rife', (p) => avancees.push(p));
  const dossierRife = M.dossierMoteurPixels('rife');
  essai('installé depuis le serveur, par morceaux (le gros fichier inutile n’est pas pris), puis essayé : prêt', e.ok === true && e.essai?.ok === true && servis.octets < manifeste.rife.mac.octets - 250000, {ok: e.ok, essai: e.essai, servis: servis.octets, octets: manifeste.rife.mac.octets});
  essai('… seulement les fichiers de la table, plus le LISEZ-MOI de Dérush, et le programme est exécutable',
    fs.readdirSync(dossierRife).sort().join() === '.derush-moteur.json,LICENSE,LISEZ-MOI.txt,rife-ncnn-vulkan,rife-v4.6' && (fs.statSync(path.join(dossierRife, 'rife-ncnn-vulkan')).mode & 0o111) !== 0, fs.readdirSync(dossierRife));
  essai('… l’avancement va de 0 à 1', avancees.length > 1 && avancees.at(-1) === 1 && avancees.every((p, i) => i === 0 || p >= avancees[i - 1]), avancees);
  const [i1, i2] = [M.installerMoteurPixels('realesrgan'), M.installerMoteurPixels('realesrgan')];
  essai('deux clics sur « Installer » : une seule installation', i1 === i2);
  e = await i1;
  essai('Real-ESRGAN installé et essayé (sa racine d’archive est vide : les fichiers sont à la racine)', e.ok === true && fs.existsSync(path.join(M.dossierMoteurPixels('realesrgan'), 'models', 'realesrgan-x4plus.param')), e);
  // une archive trafiquée : même taille, un fichier changé
  M.retirerMoteurPixels('rife');
  essai('retiré : le dossier n’est plus là, et l’état le dit', !fs.existsSync(dossierRife) && M.etatMoteurPixels('rife').installe === false);
  const bonne = servis.fichiers.get('/rife.zip');
  const trafique = Buffer.from(bonne);
  const ou = trafique.indexOf(Buffer.from('MIT (faux)'));
  trafique.write('MIT (FAUX)', ou);
  servis.fichiers.set('/rife.zip', trafique);
  err = null;
  try { await M.installerMoteurPixels('rife'); } catch (x) { err = x; }
  const restes = fs.readdirSync(path.dirname(dossierRife)).filter((n) => n.startsWith('rife'));
  essai('une archive trafiquée (un fichier changé, même taille) : refusée, rien n’est gardé', /ne correspond pas|taille de celle/.test(err?.message ?? '') && restes.length === 0, {err: err?.message, restes});
  // sans morceaux : l'archive entière, vérifiée
  servis.fichiers.set('/rife.zip', bonne);
  servis.morceaux = false;
  servis.octets = 0;
  e = await M.installerMoteurPixels('rife');
  // (le petit serveur compte aussi la première réponse, entière, que Dérush abandonne dès ses en-têtes)
  essai('un serveur qui ne sert pas par morceaux : l’archive entière, vérifiée par son empreinte, puis les mêmes fichiers', e.ok === true && servis.octets >= bonne.length && !fs.existsSync(path.join(dossierRife, 'archive.zip')), {servis: servis.octets, ok: e.ok, essai: e.essai});
  servis.morceaux = true;
  // un moteur qui ne démarre pas (comme dans un bac à sable sans carte graphique)
  const muetes = fichiersEsrgan(MUET);
  const zm = archive('', muetes, 'realesrgan-ncnn-vulkan');
  const manifesteMuet = JSON.parse(JSON.stringify(manifeste));
  manifesteMuet.realesrgan.mac = {...manifesteMuet.realesrgan.mac, archive: `${ADRESSE}/muet.zip`, octets: zm.length, sha256: sha(zm), fichiers: Object.fromEntries(Object.entries(muetes).map(([k, v]) => [k, [v.length, sha(v)]]))};
  servis.fichiers.set('/muet.zip', zm);
  fs.writeFileSync(path.join(T, 'manifeste-muet.json'), JSON.stringify(manifesteMuet));
  // jamais spawnSync ici : le sous-processus télécharge depuis le petit serveur de cet essai, qui doit pouvoir répondre
  const sousProcessus = (code, env = {}) => new Promise((ok2) => {
    const p = spawn(process.execPath, ['--input-type=module', '-e', code], {env: {...process.env, ...env}, cwd: D});
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => { stdout += d; });
    p.stderr.on('data', (d) => { stderr += d; });
    p.on('close', (status) => ok2({status, stdout, stderr}));
  });
  const sup2 = path.join(T, 'support-muet');
  let r = await sousProcessus(`const M = await import(${JSON.stringify(pathToFileURL(path.join(D, 'lib', 'moteurs-pixels.mjs')).href)}); console.log(JSON.stringify(await M.installerMoteurPixels('realesrgan')));`, {DERUSH_SUPPORT: sup2, DERUSH_MOTEURS_PIXELS_MANIFESTE: path.join(T, 'manifeste-muet.json')});
  const muet = JSON.parse(r.stdout.trim().split('\n').pop() || '{}');
  essai('un moteur qui ne démarre pas sur cet ordinateur : installé, mais pas prêt, et l’état dit pourquoi', muet.installe === true && muet.ok === false && /ne démarre pas/.test(muet.pourquoi ?? ''), muet);
  r = await sousProcessus(`const M = await import(${JSON.stringify(pathToFileURL(path.join(D, 'lib', 'moteurs-pixels.mjs')).href)}); console.log(JSON.stringify(M.etatMoteurPixels('rife')));`, {DERUSH_MOTEURS_PIXELS_SYSTEME: 'windows'});
  const ailleurs = JSON.parse(r.stdout.trim() || '{}');
  essai('un système sans version essayée : pas installable, et dit simplement', ailleurs.installable === false && ailleurs.ok === false && /seule la version pour Mac/.test(ailleurs.pourquoi ?? ''), ailleurs);
  const cp = M.consignePixels();
  essai('la consigne de l’IA dit que RIFE invente les images, et comment se servir des deux commandes (comparer avant d’agrandir)', /derush-ralenti/.test(cp) && /RIFE invente/.test(cp) && /derush-agrandir/.test(cp) && /--estimer/.test(cp) && /agrandissement simple/.test(cp), cp);

  // ———————————————————————————————————————————————————————————————————————————
  titre('Une vidéo, image par image');
  const images = [];
  for (let i = 0; i < 3; i++) { const f = path.join(T, `png-${i}.png`); ffmpeg(['-f', 'lavfi', '-i', `color=c=0x${(i * 60).toString(16).padStart(2, '0')}2040:s=${40 + i}x30`, '-frames:v', '1', f]); images.push(fs.readFileSync(f)); }
  const flux = Buffer.concat(images);
  const recues = [];
  const lecteur = new IV.LecteurPng();
  for (let p = 0; p < flux.length;) { const n = 1 + Math.floor(Math.random() * 700); for (const im of lecteur.ajouter(flux.subarray(p, p + n))) recues.push(im); p += n; }
  essai('des PNG collés, reçus en morceaux de toutes tailles : chacun ressort entier', recues.length === 3 && recues.every((im, i) => im.equals(images[i])));
  essai('les cadences : 29.97 → 30000/1001, « 25 », « 30000/1001 », et rien d’absurde', IV.lireCadence('29.97')?.texte === '30000/1001' && IV.lireCadence('25')?.texte === '25' && IV.lireCadence('30000/1001')?.valeur.toFixed(3) === '29.970' && IV.lireCadence('0') === null && IV.lireCadence('abc') === null && IV.lireCadence('500') === null);
  const p1 = R.planRalenti({fps: IV.lireCadence(30), cadence: IV.lireCadence(30), fois: 4});
  const p2 = R.planRalenti({fps: IV.lireCadence(24), cadence: IV.lireCadence(30), fois: 2});
  const p3 = R.planRalenti({fps: IV.lireCadence(25), cadence: IV.lireCadence(30), fois: 2});
  const p4 = R.planRalenti({fps: IV.lireCadence(120), cadence: IV.lireCadence(30), fois: 4});
  const p5 = R.planRalenti({fps: IV.lireCadence(29.97), cadence: IV.lireCadence(30), fois: 2});
  essai('le plan : ×4 (4/1), 24 → 30 ×2 (5/2), 25 → 30 ×2 (12/5), 120 → 30 ×4 (rien à inventer), 29,97 → 30 ×2 (2/1)', p1.p === 4 && p1.q === 1 && p2.p === 5 && p2.q === 2 && p3.p === 12 && p3.q === 5 && p4.inventer === false && p5.p === 2 && p5.q === 1, {p1, p2, p3, p4, p5});
  essai('les lots : un multiple de q, plus petits en 4K', R.tailleLot({largeur: 1080, hauteur: 1920, p: 5, q: 2}) % 2 === 0 && R.tailleLot({largeur: 2160, hauteur: 3840, p: 4, q: 1}) < R.tailleLot({largeur: 1080, hauteur: 1920, p: 4, q: 1}));

  // une source où chaque image porte sa couleur (le numéro se lit dans la couleur moyenne)
  const source = path.join(T, 'source-10.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=black:s=64x48:r=10:d=2', '-f', 'lavfi', '-t', '2', '-i', 'sine=f=440:r=48000', '-vf', "geq=r='mod(N*12,256)':g='mod(N*12,256)':b='mod(N*12,256)',format=yuv420p", '-c:v', 'libx264', '-qp', '0', '-c:a', 'aac', '-shortest', source]);
  const numeros = (f) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'scale=1:1:flags=area,format=gray', '-f', 'rawvideo', '-'], {maxBuffer: 1e8}); return [...r.stdout].map((v) => Math.round(v / 12)); };
  const src = numeros(source);
  essai('la source d’essai : 20 images numérotées par leur gris', src.length === 20 && src.every((n, i) => n === i), src);
  const atelier = path.join(T, 'atelier');
  fs.mkdirSync(path.join(atelier, 'rendu'), {recursive: true});
  const attendusK = (n, p, q, total) => Array.from({length: total}, (_, j) => { const fx = (j * q) / p; const x0 = Math.floor(fx); return Math.min(n - 1, fx - x0 < 0.5 ? x0 : x0 + 1); });

  titre('Le ralenti');
  let s1 = await R.ralentir(source, path.join(atelier, 'rendu', 'x2.mp4'), {fois: 2});
  let v = video(s1.sortie);
  essai('×2 par RIFE : 40 images à 10 images/s, 4 s, sans son', s1.moteur === 'rife' && v.images === 40 && v.fps === '10/1' && Math.abs(v.duree - 4) < 0.05 && !v.son && s1.son === false, {s1, v});
  const n1 = numeros(s1.sortie);
  const att1 = attendusK(20, 2, 1, 40);
  essai('… chaque image de sortie est la bonne (les vraies aux images paires, et la dernière tenue)', JSON.stringify(n1) === JSON.stringify(att1), {n1, att1});
  process.env.DERUSH_ESSAI_LOT = '3';
  const s2 = await R.ralentir(source, path.join(atelier, 'rendu', 'x2-lots.mp4'), {fois: 2});
  delete process.env.DERUSH_ESSAI_LOT;
  essai('… en lots de 3 images : exactement les mêmes images', JSON.stringify(numeros(s2.sortie)) === JSON.stringify(n1), numeros(s2.sortie));
  process.env.DERUSH_ESSAI_LOT = '4';
  const s3 = await R.ralentir(source, path.join(atelier, 'rendu', 'x25.mp4'), {fois: 1, cadence: 25});
  delete process.env.DERUSH_ESSAI_LOT;
  v = video(s3.sortie);
  const att3 = attendusK(20, 5, 2, 50);
  essai('10 → 25 images/s (×2,5) en lots de 4 : 50 images, chacune à son instant, et le son gardé (même durée)', v.images === 50 && JSON.stringify(numeros(s3.sortie)) === JSON.stringify(att3) && v.son === true && s3.son === true, {v, n: numeros(s3.sortie), att3});
  const s4 = await R.ralentir(source, path.join(atelier, 'rendu', 'passage.mp4'), {fois: 3, de: 0.5, a: 1.5});
  v = video(s4.sortie);
  const n4 = numeros(s4.sortie);
  essai('un passage (0,5 à 1,5 s) ×3 : 30 images, qui commencent à l’image 5 et finissent à l’image 14', v.images === 30 && n4[0] === 5 && n4.at(-1) === 14 && s4.duree_source_s === 1, {v, n4, s4});
  const s5 = await R.ralentir(source, path.join(atelier, 'rendu', 'ffmpeg.mp4'), {fois: 2, moteur: 'ffmpeg'});
  v = video(s5.sortie);
  essai('par FFmpeg : 40 images aussi (il allait trois images moins loin), la première est la vraie', s5.moteur === 'ffmpeg' && v.images === 40 && numeros(s5.sortie)[0] === 0, {s5, v});
  const rapide = path.join(T, 'source-40.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=black:s=64x48:r=40:d=1', '-vf', "geq=r='mod(N*6,256)':g='mod(N*6,256)':b='mod(N*6,256)',format=yuv420p", '-c:v', 'libx264', '-qp', '0', rapide]);
  const s6 = await R.ralentir(rapide, path.join(atelier, 'rendu', 'vraies.mp4'), {fois: 2, cadence: 20});
  const n6 = (() => { const r = spawnSync('ffmpeg', ['-v', 'error', '-i', s6.sortie, '-vf', 'scale=1:1:flags=area,format=gray', '-f', 'rawvideo', '-'], {maxBuffer: 1e8}); return [...r.stdout].map((x) => Math.round(x / 6)); })();
  essai('un rush à 40 images/s ralenti ×2 à 20 images/s : rien à inventer, les 40 vraies images, dans l’ordre', s6.moteur === 'images' && n6.length === 40 && n6.every((n, i) => n === i), {s6, n6});
  const refus = async (o, re, sortie = path.join(atelier, 'rendu', 'refus.mp4'), entree = source) => { try { await R.ralentir(entree, sortie, o); return 'accepté'; } catch (x) { return re.test(x.message) ? true : x.message; } };
  essai('refusés : --fois 9, --cadence absurde, --a avant --de, --de après la fin, une sortie .mov, la même vidéo en sortie',
    (await refus({fois: 9}, /--fois/)) === true && (await refus({cadence: 'vite'}, /--cadence/)) === true && (await refus({de: 2, a: 1}, /--de et --a/)) === true && (await refus({de: 5}, /ne dure que/)) === true
    && (await refus({}, /\.mp4/, path.join(atelier, 'rendu', 'x.mov'))) === true && (await refus({}, /autre fichier/, source)) === true);
  M.retirerMoteurPixels('rife');
  const s7 = await R.ralentir(source, path.join(atelier, 'rendu', 'sans-rife.mp4'), {fois: 2});
  essai('RIFE retiré : FFmpeg prend le relais, et le compte rendu le dit (Connexions)', s7.moteur === 'ffmpeg' && s7.attention.some((x) => /Connexions/.test(x)), s7);
  essai('--moteur rife sans RIFE : refusé, en disant où l’installer', (await refus({moteur: 'rife'}, /Connexions › Ralenti fluide/)) === true);
  essai('aucun fichier de travail laissé (ni dossier temporaire du ralenti, ni sortie à moitié écrite)', !fs.readdirSync(os.tmpdir()).some((n) => /^derush-ralenti-/.test(n) && fs.statSync(path.join(os.tmpdir(), n)).mtimeMs > Date.now() - 600000) && !fs.readdirSync(path.join(atelier, 'rendu')).some((n) => /\.part-/.test(n)), fs.readdirSync(path.join(atelier, 'rendu')));
  await M.installerMoteurPixels('rife');

  // ———————————————————————————————————————————————————————————————————————————
  titre('L’agrandisseur');
  const t1 = A.tailleVoulue({largeur: 540, hauteur: 960}, {cote: 1080});
  essai('la taille voulue : --cote 1080 depuis 540 × 960 → 1080 × 1920 (×2)', t1.largeur === 1080 && t1.hauteur === 1920 && t1.f === 2, t1);
  const refusTaille = (a1, a2) => { try { A.tailleVoulue(a1, a2); return 'accepté'; } catch (x) { return x.message; } };
  essai('refusés : rien à agrandir, au-delà de ×4, une vidéo plus grande que la 4K, les deux options à la fois, aucune',
    /rien à agrandir/.test(refusTaille({largeur: 1080, hauteur: 1920}, {cote: 1080})) && /trop/.test(refusTaille({largeur: 100, hauteur: 100}, {fois: 5})) && /4K/.test(refusTaille({largeur: 1080, hauteur: 1920}, {fois: 3, video: true}))
    && /pas les deux/.test(refusTaille({largeur: 10, hauteur: 10}, {fois: 2, cote: 20})) && /--cote/.test(refusTaille({largeur: 10, hauteur: 10}, {})));
  essai('l’échelle du moteur : dessin ×1,5 → 2, ×2,5 → 3, ×3,2 → 4 ; photo toujours 4', A.echelleMoteur('dessin', 1.5) === 2 && A.echelleMoteur('dessin', 2.5) === 3 && A.echelleMoteur('dessin', 3.2) === 4 && A.echelleMoteur('photo', 2) === 4);
  const petite = path.join(T, 'petite.png');
  ffmpeg(['-f', 'lavfi', '-i', "color=c=black:s=50x30,format=rgba,geq=r='200':g='60':b='20':a='if(between(X,10,40),255,0)'", '-frames:v', '1', petite]);
  let g = await A.agrandir(petite, path.join(atelier, 'rendu', 'grande.png'), {fois: 3, modele: 'dessin'});
  let gv = video(g.sortie);
  const alpha = (f, x, y) => spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', `alphaextract,crop=4:4:${x}:${y},scale=1:1:flags=area`, '-f', 'rawvideo', '-'], {maxBuffer: 1e6}).stdout[0];
  essai('une image ×3 (dessin) : 150 × 90, la transparence gardée', gv.largeur === 150 && gv.hauteur === 90 && alpha(g.sortie, 0, 40) === 0 && alpha(g.sortie, 70, 40) === 255, {g, gv});
  g = await A.agrandir(petite, path.join(atelier, 'rendu', 'grande-photo.png'), {cote: 75});
  gv = video(g.sortie);
  essai('… --cote 75 sans modèle : le modèle photo (×4), puis réduite juste à 125 × 75', g.modele === 'photo' && g.echelle_moteur === 4 && gv.largeur === 125 && gv.hauteur === 75, {g, gv});
  let erreur = null;
  try { await A.agrandir(petite, path.join(atelier, 'rendu', 'grande.jpg'), {fois: 2, modele: 'dessin'}); } catch (x) { erreur = x.message; }
  essai('une image transparente en .jpg : refusée (en .png ou .webp)', /transparence/.test(erreur ?? ''), erreur);
  const bmp = path.join(T, 'vieille.bmp');
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=48x32', '-frames:v', '1', bmp]);
  g = await A.agrandir(bmp, path.join(atelier, 'rendu', 'vieille.jpg'), {fois: 2, modele: 'dessin'});
  gv = video(g.sortie);
  essai('une image BMP (que le moteur ne lit pas) : convertie, puis agrandie en .jpg', gv.largeur === 96 && gv.hauteur === 64, gv);
  const vid = path.join(T, 'video-petite.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=96x64:r=10:d=1.5', '-f', 'lavfi', '-t', '1.5', '-i', 'sine=f=300:r=48000', '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', vid]);
  erreur = null;
  try { await A.agrandir(vid, path.join(atelier, 'rendu', 'v.mp4'), {cote: 128}); } catch (x) { erreur = x; }
  essai('une vidéo sans --modele : la commande demande de choisir, avec le temps de chacun', /choisis le modèle/.test(erreur?.message ?? '') && !!erreur?.resume?.estimation?.dessin && !!erreur?.resume?.estimation?.photo, erreur?.message);
  const est = await A.agrandir(vid, null, {cote: 128, estimer: true});
  essai('--estimer : le temps prévu des deux modèles, sans rien écrire', est.images === 15 && est.estimation.dessin.total_s >= 0 && est.estimation.photo.par_image_s >= 0 && !fs.existsSync(path.join(atelier, 'rendu', 'v.mp4')), est);
  process.env.DERUSH_ESSAI_LOT = '4';
  g = await A.agrandir(vid, path.join(atelier, 'rendu', 'v.mp4'), {cote: 128, modele: 'dessin'});
  delete process.env.DERUSH_ESSAI_LOT;
  gv = video(g.sortie);
  essai('une vidéo ×2 en lots de 4 : 192 × 128, ses 15 images, son son', gv.largeur === 192 && gv.hauteur === 128 && gv.images === 15 && gv.son === true && g.images === 15, {g, gv});
  // le garde-fou : un moteur lent (faux), une vidéo de dix minutes
  const longue = path.join(T, 'longue.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=160x90:r=30:d=600', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '45', '-pix_fmt', 'yuv420p', longue]);
  process.env.FAUX_PAR_PIXEL = String(0.3 / (160 * 90));
  // une sortie en .mov : refusée juste APRÈS le garde-fou (sinon, accepté, le travail commencerait pour de bon)
  const garde = async (o) => { try { await A.agrandir(longue, path.join(atelier, 'rendu', 'longue-x2.mov'), {cote: 180, modele: 'photo', ...o}); return 'accepté'; } catch (x) { return x.message; } };
  const g1 = await garde({});
  const g2 = await garde({long: true});
  process.env.FAUX_PAR_PIXEL = String(1.2 / (160 * 90));
  const g3 = await garde({long: true});
  delete process.env.FAUX_PAR_PIXEL;
  essai('le garde-fou : 18 000 images à 0,3 s, refusé sans --long (et le message dit quoi faire)', /trop long/.test(g1) && /--long/.test(g1) && /--de/.test(g1), g1);
  essai('… avec --long : accepté jusqu’à 4 h (ici 1 h 30 : le garde-fou laisse passer, la sortie en .mov arrête l’essai)', /\.mp4/.test(g2) && !/trop long|au-delà/.test(g2), g2);
  essai('… au-delà de 4 h, même avec --long : refusé', /au-delà de 4 h/.test(g3), g3);


  titre('Une commande interrompue');
  const lente = spawn(process.execPath, [path.join(D, 'outils', 'derush-agrandir.mjs'), vid, '-o', path.join(atelier, 'rendu', 'interrompue.mp4'), '--cote', '128', '--modele', 'dessin'], {env: {...process.env, FAUX_PAR_PIXEL: String(2 / (96 * 64))}});
  const finie = new Promise((r2) => lente.on('close', r2));
  const tmpAvant = new Set(fs.readdirSync(os.tmpdir()).filter((n) => /^derush-agrandir-/.test(n)));
  let vu = null;
  for (let k = 0; k < 100 && !vu; k++) { await attendre(100); vu = fs.readdirSync(os.tmpdir()).find((n) => /^derush-agrandir-/.test(n) && !tmpAvant.has(n)) ?? null; }
  await attendre(1500);
  lente.kill('SIGTERM');
  await finie;
  await attendre(300);
  const orphelins = spawnSync('pgrep', ['-f', 'realesrgan-ncnn-vulkan'], {encoding: 'utf8'}).stdout.trim();
  essai('arrêtée en plein travail : le moteur s’arrête avec elle, ses images de travail et la sortie à moitié écrite sont effacées',
    !!vu && !fs.existsSync(path.join(os.tmpdir(), vu)) && !orphelins && !fs.readdirSync(path.join(atelier, 'rendu')).some((n) => /interrompue/.test(n)), {vu, orphelins, rendu: fs.readdirSync(path.join(atelier, 'rendu'))});

  // ———————————————————————————————————————————————————————————————————————————
  titre('Le relais : une IA dans un bac à sable');
  const {ouvrirRelais} = await lib('relais.mjs');
  fs.copyFileSync(source, path.join(atelier, 'clip.mp4'));
  const dehors = path.join(T, 'dehors.mp4');
  fs.copyFileSync(source, dehors);
  const relais = await ouvrirRelais(atelier, {lisibles: [atelier]});
  const demande = async (corps, jeton = relais.jeton) => { const r2 = await fetch(`${relais.url}/pixels`, {method: 'POST', headers: {'x-derush-relais': jeton, 'content-type': 'application/json'}, body: JSON.stringify(corps)}); const t = await r2.text(); const l = /##DERUSH-PIXELS (.*)##/.exec(t)?.[1]; return {code: r2.status, r: l ? JSON.parse(l) : null, t}; };
  let q = await demande({commande: 'ralenti', args: ['clip.mp4', '-o', '/tmp/ailleurs.mp4'], cwd: atelier});
  essai('une sortie hors du dossier de travail : refusée', q.r?.ok === false && /dossier de travail/.test(q.r.message), q);
  q = await demande({commande: 'ralenti', args: [dehors, '-o', 'rendu/r.mp4'], cwd: atelier});
  essai('un fichier de départ que l’IA n’a pas le droit de lire : refusé', q.r?.ok === false && /droit de lire/.test(q.r.message), q);
  q = await demande({commande: 'supprimer', args: [], cwd: atelier});
  essai('une autre commande : refusée', q.r?.ok === false && /inconnue/.test(q.r.message), q);
  q = await demande({commande: 'ralenti', args: ['clip.mp4', '-o', 'rendu/r.mp4'], cwd: T});
  essai('lancée depuis un dossier hors du dossier de travail : refusée', q.r?.ok === false && /dossier de travail/.test(q.r.message), q);
  q = await demande({commande: 'ralenti', args: ['clip.mp4', '-o', 'rendu/r.mp4'], cwd: atelier}, 'mauvais');
  essai('sans le bon jeton : refusée', q.code === 403, q.code);
  const cli = (env, ...a) => new Promise((ok2) => { const p = spawn(process.execPath, [path.join(D, 'outils', 'derush-ralenti.mjs'), ...a], {cwd: atelier, env: {...process.env, ...env}}); let o = ''; let e2 = ''; p.stdout.on('data', (d) => { o += d; }); p.stderr.on('data', (d) => { e2 += d; }); p.on('close', (c) => ok2({c, o, e: e2})); });
  let x = await cli({DERUSH_RELAIS: relais.url, DERUSH_RELAIS_JETON: relais.jeton}, 'clip.mp4', '-o', 'rendu/par-relais.mp4', '--fois', '2');
  essai('derush-ralenti dans un bac à sable (adresse locale) : fait hors du bac à sable, la vidéo est là', x.c === 0 && /Ralenti : rendu\/par-relais\.mp4/.test(x.o) && video(path.join(atelier, 'rendu', 'par-relais.mp4')).images === 40, x);
  relais.fermer();
  const relaisB = await ouvrirRelais(atelier, {boite: true});
  x = await cli({DERUSH_RELAIS_BOITE: relaisB.boite, DERUSH_RELAIS_JETON: relaisB.jeton}, 'etat');
  essai('… et par la boîte (Gemini) : « derush-ralenti etat » répond depuis Dérush', x.c === 0 && /RIFE/.test(x.o), x);
  const cliA = (env, ...a) => new Promise((ok2) => { const p = spawn(process.execPath, [path.join(D, 'outils', 'derush-agrandir.mjs'), ...a], {cwd: atelier, env: {...process.env, ...env}}); let o = ''; let e2 = ''; p.stdout.on('data', (d) => { o += d; }); p.stderr.on('data', (d) => { e2 += d; }); p.on('close', (c) => ok2({c, o, e: e2})); });
  fs.copyFileSync(petite, path.join(atelier, 'logo.png'));
  x = await cliA({DERUSH_RELAIS_BOITE: relaisB.boite, DERUSH_RELAIS_JETON: relaisB.jeton}, 'logo.png', '-o', 'rendu/logo-x2.png', '--fois', '2', '--modele', 'dessin');
  essai('derush-agrandir par la boîte : l’image agrandie est là', x.c === 0 && video(path.join(atelier, 'rendu', 'logo-x2.png')).largeur === 100, x);
  relaisB.fermer();
  x = await cli({}, '--help');
  essai('l’aide dit tout : cadence, son, les vraies images d’un rush à 120 i/s, regarder avant de livrer', x.c === 0 && /--cadence/.test(x.o) && /120 ou 240/.test(x.o) && /son n'est pas gardé/.test(x.o) && /regarde des images/i.test(x.o), x.o.slice(0, 200));
  x = await cliA({}, '--help');
  essai('… et celle de l’agrandisseur : les deux modèles, --estimer, le garde-fou, ×4 au plus, et ce qu’il invente sur une vidéo sombre', x.c === 0 && /dessin/.test(x.o) && /photo/.test(x.o) && /--estimer/.test(x.o) && /20 minutes/.test(x.o) && /×4/.test(x.o) && /reste le plus fidèle/.test(x.o) && /côte à côte/.test(x.o));

  // ———————————————————————————————————————————————————————————————————————————
  titre('Les vrais moteurs (sur la carte graphique)');
  if (!ARCHIVES_VRAIES || !['rife.zip', 'realesrgan.zip'].every((n) => fs.existsSync(path.join(ARCHIVES_VRAIES, n)))) {
    console.log('  (sautés : DERUSH_ESSAI_ARCHIVES_PIXELS ne donne pas un dossier avec rife.zip et realesrgan.zip)');
  } else {
    const env = {DERUSH_SUPPORT: path.join(T, 'support-vrai'), DERUSH_MOTEURS_PIXELS_ARCHIVES: ARCHIVES_VRAIES, DERUSH_MOTEURS_PIXELS_MANIFESTE: '', DERUSH_MOTEURS_PIXELS_SYSTEME: ''};
    const vrai = async (code) => { const r2 = await sousProcessus(code, env); try { return JSON.parse(r2.stdout.trim().split('\n').pop()); } catch { return {erreur: r2.stderr.slice(-500)}; } };
    const mp = JSON.stringify(pathToFileURL(path.join(D, 'lib', 'moteurs-pixels.mjs')).href);
    const ins = await vrai(`const M = await import(${mp}); const a = await M.installerMoteurPixels('rife'); const b = await M.installerMoteurPixels('realesrgan'); console.log(JSON.stringify({a, b}));`);
    essai('installés depuis les vraies archives, chaque fichier vérifié, et les deux démarrent ici', ins.a?.ok === true && ins.b?.ok === true, ins);
    const vr = await vrai(`const R = await import(${JSON.stringify(pathToFileURL(path.join(D, 'lib', 'ralenti.mjs')).href)}); console.log(JSON.stringify(await R.ralentir(${JSON.stringify(source)}, ${JSON.stringify(path.join(atelier, 'rendu', 'vrai-x2.mp4'))}, {fois: 2})));`);
    const nv = vr.sortie ? numeros(vr.sortie) : [];
    essai('le vrai RIFE : ×2, 40 images, les vraies aux images paires', vr.moteur === 'rife' && nv.length === 40 && nv.filter((n, i) => i % 2 === 0 && i < 38).every((n, k) => n === k), {vr, nv});
    const va = await vrai(`const A = await import(${JSON.stringify(pathToFileURL(path.join(D, 'lib', 'agrandir.mjs')).href)}); console.log(JSON.stringify(await A.agrandir(${JSON.stringify(petite)}, ${JSON.stringify(path.join(atelier, 'rendu', 'vrai-x4.png'))}, {fois: 4, modele: 'dessin'})));`);
    const vv = va.sortie ? video(va.sortie) : {};
    essai('le vrai Real-ESRGAN : une image ×4, transparence gardée', vv.largeur === 200 && vv.hauteur === 120 && alpha(va.sortie, 0, 50) === 0 && alpha(va.sortie, 100, 50) === 255, {va, vv});
  }
} catch (x) {
  essai('les essais sont allés au bout', false, x.stack);
} finally {
  serveur.close();
}
console.log(`\n${ok} essais réussis sur ${ok + ko}`);
if (!ko) fs.rmSync(T, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${T}`);
process.exit(ko ? 1 : 0);
