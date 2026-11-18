#!/usr/bin/env node
// Dérush — les essais de « Comme cette vidéo » depuis un lien (lib/lien-video.mjs) : les liens reconnus (TikTok,
// Instagram, YouTube, en https seulement), les arguments de yt-dlp (une seule vidéo, 720 p, sans cookie ni
// configuration), ses erreurs dites simplement, son installation vérifiée par l'empreinte (contre un faux serveur), et une
// vidéo jointe comme référence (par un faux yt-dlp). Jamais une vraie vidéo de quelqu'un.
//   node outils/essai-lien.mjs [dossier où créer le dossier d'essai]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('node outils/essai-lien.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
fs.mkdirSync(base, {recursive: true});
const tmp = fs.mkdtempSync(path.join(base, 'derush-essai-lien-'));
// un faux serveur de versions : le binaire et la liste des empreintes (juste, ou fausse sur demande)
const binaire = Buffer.from('#!/bin/sh\necho 2026.10.26\n');
let empreinte = crypto.createHash('sha256').update(binaire).digest('hex');
const serveur = http.createServer((req, res) => {
  if (req.url.endsWith('/SHA2-256SUMS')) { res.writeHead(200); return res.end(['yt-dlp_macos', 'yt-dlp.exe', 'yt-dlp_linux', 'yt-dlp_linux_aarch64'].map((n) => `${empreinte}  ${n}`).join('\n')); }
  if (/yt-dlp/.test(req.url)) { res.writeHead(200); return res.end(binaire); }
  res.writeHead(404); res.end();
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
Object.assign(process.env, {DERUSH_SUPPORT: path.join(tmp, 'support'), DERUSH_YTDLP_BASE: `http://127.0.0.1:${serveur.address().port}/releases`});
fs.mkdirSync(process.env.DERUSH_SUPPORT, {recursive: true});
const L = await import(pathToFileURL(path.join(D, 'lib', 'lien-video.mjs')).href);
const {listerPieces} = await import(pathToFileURL(path.join(D, 'lib', 'pieces.mjs')).href);

let ok = 0;
let ko = 0;
const essai = (nom, cond, detail = '') => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`); } };

console.log('Les liens reconnus');
essai('TikTok, Instagram, YouTube (et youtu.be) : le lien trouvé dans le texte, sans la ponctuation qui le suit',
  L.lienVideo('fais comme ça : https://www.tiktok.com/@yabai/video/123.') === 'https://www.tiktok.com/@yabai/video/123'
  && /instagram\.com\/reel/.test(L.lienVideo('https://www.instagram.com/reel/abc/') ?? '') && /youtu\.be/.test(L.lienVideo('(https://youtu.be/xyz)') ?? '') && /shorts/.test(L.lienVideo('https://youtube.com/shorts/q1') ?? ''));
essai('ni un autre site, ni un lien sans https, ni un faux domaine', L.lienVideo('https://exemple.fr/video') === null && L.lienVideo('http://www.tiktok.com/@a/video/1') === null && L.lienVideo('https://tiktok.com.pirate.net/v') === null);

console.log('yt-dlp');
const a = L.argumentsYtdlp('https://www.tiktok.com/@a/video/1', '/tmp/reference.%(ext)s');
essai('une seule vidéo, 720 p au plus, en MP4 avec son son, sans configuration, cache ni cookie', ['--ignore-config', '--no-playlist', '--no-cache-dir', '--no-cookies'].every((x) => a.includes(x)) && a.includes('res:720,ext:mp4:m4a') && a.includes('after_move:filepath') && a.at(-1) === 'https://www.tiktok.com/@a/video/1' && !a.some((x) => /cookies-from-browser/.test(x)), JSON.stringify(a));
essai('ses erreurs, dites simplement (connexion demandée, mauvais lien, trop lourd)', /demande d’être connecté/.test(L.erreurLien('ERROR: [Instagram] You have exceeded the rate-limit')) && /ne mène pas à une vidéo/.test(L.erreurLien('ERROR: Unsupported URL: https://x')) && /trop lourde/.test(L.erreurLien('File is larger than max-filesize')));
empreinte = 'f'.repeat(64);
let refus = null;
try { await L.installerYtdlp(); } catch (e) { refus = e.message; }
essai('un téléchargeur qui ne correspond pas à son empreinte publiée : refusé, rien n’est gardé', /ne correspond pas/.test(refus ?? '') && !fs.existsSync(L.cheminYtdlp()) && !L.etatYtdlp().ok);
empreinte = crypto.createHash('sha256').update(binaire).digest('hex');
const e = await L.installerYtdlp();
essai('la bonne empreinte : installé, exécutable, sa version notée', e.ok && (fs.statSync(L.cheminYtdlp()).mode & 0o111) !== 0 && e.version === L.VERSION_YTDLP);

console.log('Une vidéo jointe comme référence');
const P = {racine: path.join(tmp, 'projet'), cache: path.join(tmp, 'projet', '.derush'), d: {medias: []}};
fs.mkdirSync(P.racine, {recursive: true});
const video = path.join(tmp, 'source.mp4');
spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=180x320:rate=25:duration=1', '-f', 'lavfi', '-i', 'sine=duration=1', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', video]);
// un faux yt-dlp : il écrit la vidéo à l'adresse demandée (-o) et dit où, comme le vrai avec --print after_move:filepath
const fauxYtdlp = path.join(tmp, 'faux-ytdlp');
fs.writeFileSync(fauxYtdlp, `#!${process.execPath}
const a = process.argv.slice(2); const fs = require('fs');
if (a.at(-1).includes('prive')) { console.error('ERROR: [Instagram] Restricted Video: login required'); process.exit(1); }
const sortie = a[a.indexOf('-o') + 1].replace('%(ext)s', 'mp4');
fs.copyFileSync(${JSON.stringify(video)}, sortie); console.log(sortie);`);
fs.chmodSync(fauxYtdlp, 0o755);
const y = await L.joindreReference(P, 'https://www.tiktok.com/@yabai/video/7', {lanceur: fauxYtdlp});
const pj = listerPieces(P).find((x) => x.id === y.id);
essai('téléchargée dans le projet, jointe à la conversation comme référence vidéo (« Comme cette vidéo »)', pj?.type === 'video' && pj.role === 'reference' && pj.message == null && pj.chemin.startsWith(path.join(P.racine, 'claude', 'references-liens')) && /reference-tiktok-/.test(pj.nom), JSON.stringify(pj));
let r1 = null;
try { await L.joindreReference(P, 'https://www.instagram.com/reel/prive', {lanceur: fauxYtdlp}); } catch (err) { r1 = err.message; }
essai('une vidéo qui demande d’être connecté : la marche à suivre, pas l’erreur brute', /enregistre-la depuis l’appli/.test(r1 ?? ''), r1);
let r2 = null;
try { await L.joindreReference(P, 'https://exemple.fr/video.mp4', {lanceur: fauxYtdlp}); } catch (err) { r2 = err.message; }
essai('un lien d’un autre site : refusé avant tout téléchargement', /TikTok, Instagram et YouTube/.test(r2 ?? ''));

serveur.close();
console.log(`\n${ok} essais réussis sur ${ok + ko}`);
if (!ko) fs.rmSync(tmp, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${tmp}`);
process.exit(ko ? 1 : 0);
