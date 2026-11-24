#!/usr/bin/env node
// Dérush — les essais de la toile (lib/toile.mjs, lib/mouvement.mjs, outils/derush-toile.mjs, la route /toile du
// relais) : une page web qui dessine l'instant t, rendue image par image en vidéo.
// Sans navigateur : le serveur de la page (ce qu'il sert et ce qu'il refuse), les réglages de l'encodage, les pages de
// départ, la mesure du mouvement, la commande et le relais. Avec un navigateur (ESSAI_TOILE_CHROME ou DERUSH_CHROME,
// sinon Chrome, Edge ou Brave de l'ordinateur) : de vrais rendus, le contrat, l'horloge, la transparence, la boucle,
// le fluide et le moteur de dessin. Les pages « croquis » et « particules » demandent leurs bibliothèques :
// ESSAI_TOILE_LIBS=<un node_modules avec three, three.quarks, quarks.core et roughjs>.
//   node outils/essai-toile.mjs [dossier où créer le dossier d'essai]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('node outils/essai-toile.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
fs.mkdirSync(base, {recursive: true});
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(base, 'derush-essai-toile-')));
const chrome = process.env.ESSAI_TOILE_CHROME || process.env.DERUSH_CHROME || null;
const libs = process.env.ESSAI_TOILE_LIBS || process.env.DERUSH_TOILE_LIBS || null;
Object.assign(process.env, {DERUSH_SUPPORT: path.join(tmp, 'support'), ...(chrome ? {DERUSH_CHROME: chrome} : {}), ...(libs ? {DERUSH_TOILE_LIBS: libs} : {})});
for (const k of ['DERUSH_RELAIS', 'DERUSH_RELAIS_BOITE', 'DERUSH_RELAIS_JETON', 'CODEX_SANDBOX']) delete process.env[k];
fs.mkdirSync(process.env.DERUSH_SUPPORT, {recursive: true});
const imp = (f) => import(pathToFileURL(path.join(D, 'lib', f)).href);
const T = await imp('toile.mjs');
const M = await imp('mouvement.mjs');
const {FFMPEG, FFPROBE} = await imp('outils.mjs');
const CMD = path.join(D, 'outils', 'derush-toile.mjs');

let ok = 0;
let ko = 0;
const essai = (nom, cond, detail = '') => { if (cond === true) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail || cond ? ` — ${JSON.stringify(detail || cond).slice(0, 700)}` : ''}`); } };
const cmd = (args, cwd = tmp, env = {}) => { const r = spawnSync(process.execPath, [CMD, ...args], {cwd, env: {...process.env, ...env}, encoding: 'utf8', timeout: 10 * 60e3}); return {code: r.status, out: r.stdout ?? '', err: r.stderr ?? ''}; };
// la même, sans bloquer ce programme (il porte le relais que la commande appelle)
const cmdSuivie = (args, cwd = tmp, env = {}) => new Promise((fin) => {
  const p = spawn(process.execPath, [CMD, ...args], {cwd, env: {...process.env, ...env}});
  let out = '';
  let err = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => fin({code, out, err}));
});
const refus = (f) => { try { f(); return null; } catch (e) { return e.message; } };
const ecrire = (f, t) => { fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, t); return f; };
const taillePng = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const sonde = (f) => { const r = spawnSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=codec_name,pix_fmt,width,height,color_space,color_range,nb_read_frames,r_frame_rate:stream_tags=alpha_mode', '-of', 'json', f], {encoding: 'utf8'}); try { return JSON.parse(r.stdout).streams[0]; } catch { return {}; } };
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const demander = (url, {methode = 'GET', entetes = {}, corps = null} = {}) => new Promise((fin) => {
  const u = new URL(url);
  const r = http.request({host: u.hostname, port: u.port, path: u.pathname + u.search, method: methode, headers: entetes}, (res) => { const m = []; res.on('data', (d) => m.push(d)); res.on('end', () => fin({code: res.statusCode, entetes: res.headers, corps: Buffer.concat(m)})); });
  r.on('error', (e) => fin({code: 0, erreur: e.message}));
  if (corps) r.write(corps);
  r.end();
});
// une page d'essai : un rond qui traverse, dessiné comme une fonction de t
const PAGE = (corps, toile = '{duree: 2, fps: 30, largeur: 640, hauteur: 360}') => `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#101418"><canvas id="c" width="640" height="360"></canvas><script>
const c = document.getElementById('c').getContext('2d');
window.toile = ${toile};
const fond = () => { c.fillStyle = '#101418'; c.fillRect(0, 0, 640, 360); };
const rond = (x, y = 180) => { c.fillStyle = '#ff7a3c'; c.beginPath(); c.arc(x, y, 40, 0, 7); c.fill(); };
${corps}
window.__ready = true;
</script>`;

console.log('Les chemins et les réglages');
essai('un chemin reste dans son dossier ; « .. », un chemin codé, une barre oblique inverse ou un octet nul sont refusés',
  T.cheminDans(tmp, '/a/b.js') === path.join(tmp, 'a', 'b.js') && T.cheminDans(tmp, '/../x') === null && T.cheminDans(tmp, '/%2e%2e/x') === null && T.cheminDans(tmp, '/a\\..\\x') === null && T.cheminDans(tmp, '/a%00b') === null && T.cheminDans(tmp, '/%zz') === null);
essai('les paramètres de la page : « film=gallery&w=1080 » passe ; une espace, un chevron ou un dièse sont refusés',
  T.requeteSure('film=gallery&w=1080') === '&film=gallery&w=1080' && T.requeteSure('') === '' && T.requeteSure('?a=1') === '&a=1' && ['a=1 b', 'a=<x>', 'a=1#x', 'x'.repeat(700)].every((q) => /illisibles/.test(refus(() => T.requeteSure(q)) ?? '')));
const mp4 = T.argsEncodage('f.mp4', {fps: 30}).join(' ');
essai('un MP4 : H.264, les couleurs de la vidéo HD étiquetées (BT.709, plage « tv »), prêt à être lu partout',
  /libx264/.test(mp4) && /out_color_matrix=bt709:out_range=tv/.test(mp4) && /setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709/.test(mp4) && /yuv420p/.test(mp4) && /\+faststart/.test(mp4) && /-an/.test(mp4), mp4);
essai('un fond transparent : refusé en MP4, ProRes 4444 en .mov, VP9 en .webm',
  /transparence/.test(refus(() => T.argsEncodage('f.mp4', {fps: 30, transparent: true})) ?? '') && /prores_ks.*yuva444p10le/.test(T.argsEncodage('f.mov', {fps: 30, transparent: true}).join(' ')) && /libvpx-vp9.*yuva420p/.test(T.argsEncodage('f.webm', {fps: 30, transparent: true}).join(' ')));
const flou = T.argsEncodage('f.mp4', {fps: 30, flou: 8, son: 'm.mp3'}).join(' ');
essai('le flou de mouvement mélange 8 images par image ; un son est posé et coupé à la durée de la vidéo', /-framerate 240/.test(flou) && /tmix=frames=8/.test(flou) && /-i m\.mp3/.test(flou) && /-shortest/.test(flou) && /-r 30/.test(flou), flou);
essai('une sortie qui n’est ni .mp4, ni .mov, ni .webm est refusée', /\.mp4, un \.mov/.test(refus(() => T.argsEncodage('f.gif', {fps: 30})) ?? ''));

console.log('Le serveur de la page');
const site = path.join(tmp, 'site');
ecrire(path.join(site, 'index.html'), PAGE('window.renderAt = (t) => { fond(); rond(80 + 240 * t); };'));
ecrire(path.join(site, 'lib', 'util.js'), '// le dossier lib de la page');
ecrire(path.join(tmp, 'secret.txt'), 'secret');
const fausses = path.join(tmp, 'libs');
ecrire(path.join(fausses, 'three', 'package.json'), '{"name": "three", "version": "0.0.1"}');
ecrire(path.join(fausses, 'three', 'build', 'three.module.js'), 'export const REVISION = "essai";');
{
  const s = await T.serveurToile({racine: site, libs: fausses});
  const page = await demander(`${s.origine}/index.html`);
  essai('il sert la page, sur cet ordinateur seulement (127.0.0.1), sans mise en cache', /^http:\/\/127\.0\.0\.1:\d+$/.test(s.origine) && page.code === 200 && /text\/html/.test(page.entetes['content-type']) && page.entetes['cache-control'] === 'no-store');
  const dehors = await Promise.all(['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '//secret.txt'].map((u) => demander(`${s.origine}${u}`)));
  essai('rien ne sort du dossier de la page', dehors.every((r) => r.code === 404 || r.code === 400), dehors.map((r) => r.code));
  const ecrit = await demander(`${s.origine}/index.html`, {methode: 'POST', corps: 'x'});
  const autre = await demander(`${s.origine}/index.html`, {entetes: {host: 'exemple.com'}});
  essai('lecture seule (POST refusé) ; une demande qui ne vient pas par l’adresse de cet ordinateur est refusée', ecrit.code === 405 && autre.code === 403, [ecrit.code, autre.code]);
  const sien = await demander(`${s.origine}/lib/util.js`);
  const lib = await demander(`${s.origine}/lib/three/build/three.module.js`);
  const inconnue = await demander(`${s.origine}/lib/lodash/lodash.js`);
  const horsLib = await demander(`${s.origine}/lib/three/../../secret.txt`);
  essai('le dossier « lib » de la page passe d’abord ; ensuite les bibliothèques du moteur de rendu, celles de la liste seulement',
    sien.code === 200 && /dossier lib de la page/.test(String(sien.corps)) && lib.code === 200 && /REVISION/.test(String(lib.corps)) && /javascript/.test(lib.entetes['content-type']) && inconnue.code === 404 && horsLib.code === 404, [sien.code, lib.code, inconnue.code, horsLib.code]);
  const moteur = await demander(`${s.origine}/tableaux/engine.js`);
  const police = await demander(`${s.origine}/polices/anton-400.woff2`);
  essai('le moteur de dessin (« /tableaux/ ») et les polices de Dérush (« /polices/ ») sont servis', moteur.code === 200 && moteur.corps.length > 5000 && police.code === 200 && police.entetes['content-type'] === 'font/woff2', [moteur.code, police.code]);
  const morceau = await demander(`${s.origine}/index.html`, {entetes: {range: 'bytes=0-9'}});
  essai('un morceau de fichier (une vidéo lue dans la page)', morceau.code === 206 && morceau.corps.length === 10 && /^bytes 0-9\//.test(morceau.entetes['content-range']));
  essai('ce qui manque est noté, et dit en clair (une bibliothèque hors liste, un fichier oublié)', s.manquants.includes('/lib/lodash/lodash.js') && /n’est pas dans la liste/.test(T.direManquants(['/lib/lodash/lodash.js'], fausses)[0]) && /pas encore dans le moteur de rendu/.test(T.direManquants(['/lib/roughjs/bundled/rough.esm.js'], fausses)[0]) && /introuvable/.test(T.direManquants(['/fond.jpg'], fausses)[0]), s.manquants);
  await s.fermer();
}

console.log('Les pages de départ');
const gab = T.gabarits();
essai('cinq pages de départ, dans l’ordre : vide, croquis, particules, encre, tableau', gab.map((g) => g.nom).join(',') === 'vide,croquis,particules,encre,tableau' && gab.every((g) => g.titre && g.pour), gab.map((g) => g.nom));
essai('les simulations le disent (particules, encre) ; chaque page nomme ses bibliothèques', gab.filter((g) => g.suite).map((g) => g.nom).join(',') === 'particules,encre' && gab.find((g) => g.nom === 'croquis').bibliotheques.includes('roughjs') && gab.find((g) => g.nom === 'particules').bibliotheques.includes('three.quarks'));
const copie = T.copierGabarit('tableau', path.join(tmp, 'g-tableau'));
essai('une page de départ se copie avec l’aide commune (toile.js), sans son fichier de description', copie.fichiers.join(',') === ['film.js', 'index.html', path.join('scenes', 'champ.js'), 'toile.js'].sort().join(',') && !fs.existsSync(path.join(tmp, 'g-tableau', 'gabarit.json')), copie.fichiers);
essai('jamais par-dessus des fichiers ; un nom inconnu donne la liste', /déjà des fichiers/.test(refus(() => T.copierGabarit('vide', path.join(tmp, 'g-tableau'))) ?? '') && /vide, croquis, particules, encre, tableau/.test(refus(() => T.copierGabarit('aquarelle', path.join(tmp, 'x'))) ?? ''));
{
  const aide = await import(pathToFileURL(path.join(D, 'modeles', 'toiles', '_commun', 'toile.js')).href);
  const e = aide.bezier(0.16, 1, 0.3, 1);
  const r = (z) => Array.from({length: 300}, (_, i) => aide.ressort(i / 100, {amorti: z}));
  essai('l’aide commune : une courbe d’entrée part vite et se pose ; un ressort amorti à 1 ne dépasse pas, à 0,5 il rebondit',
    e(0) === 0 && e(1) === 1 && e(0.25) > 0.75 && Math.max(...r(1)) <= 1.0001 && Math.max(...r(0.5)) > 1.1 && Math.abs(r(0.5).at(-1) - 1) < 0.01 && Math.abs(r(1).at(-1) - 1) < 0.01);
  const a = aide.alea(42), b = aide.alea(42);
  essai('le hasard a une graine : la même suite à chaque fois', [a(), a(), a()].join() === [b(), b(), b()].join() && aide.hasard(3, 7) === aide.hasard(3, 7) && aide.hasard(3, 7) !== aide.hasard(3, 8) && aide.tenu(0.37, 30, 3) === 0.3 && aide.battements({bpm: 120, fps: 30}).images === 15);
}

console.log('La commande');
const aideCmd = cmd(['--help']);
essai('l’aide dit le contrat, les simulations, l’horloge et la méthode', aideCmd.code === 0 && /window\.renderAt = \(t\)/.test(aideCmd.out) && /window\.toile\.suite = true/.test(aideCmd.out) && /--horloge/.test(aideCmd.out) && /derush-toile verifier/.test(aideCmd.out) && /Rien ne vient d'Internet/.test(aideCmd.out));
essai('une commande ou une option inconnue arrête tout, avec son nom', cmd(['peindre']).code === 1 && /commande inconnue : peindre/.test(cmd(['peindre']).err) && /option inconnue : --vite/.test(cmd(['rendre', 'site/index.html', '-o', 'x.mp4', '--vite']).err));
const listeCmd = cmd(['gabarits']);
essai('« gabarits » liste les pages de départ, « gabarit » en copie une', listeCmd.code === 0 && /croquis/.test(listeCmd.out) && /simulation/.test(listeCmd.out) && cmd(['gabarit', 'vide', 'g-vide']).code === 0 && fs.existsSync(path.join(tmp, 'g-vide', 'index.html')) && fs.existsSync(path.join(tmp, 'g-vide', 'toile.js')));
const bib = cmd(['bibliotheques'], tmp, {DERUSH_TOILE_LIBS: fausses});
essai('« bibliotheques » dit ce qui est installé et donne la carte d’import', bib.code === 0 && /three\s+0\.0\.1/.test(bib.out) && /roughjs\s+pas encore installée/.test(bib.out) && /<script type="importmap">/.test(bib.out) && /"three":"\/lib\/three\/build\/three\.module\.js"/.test(bib.out), bib.out.slice(0, 300));

console.log('La mesure du mouvement');
const ff = (args) => spawnSync(FFMPEG, ['-v', 'error', '-y', ...args], {encoding: 'utf8'});
const v1 = path.join(tmp, 'v1.mp4');
ff(['-f', 'lavfi', '-i', 'color=c=0x202020:s=640x360:r=30:d=1', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=30:d=2', '-f', 'lavfi', '-i', 'color=c=white:s=640x360:r=30:d=0.5', '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0,format=yuv420p', '-c:v', 'libx264', '-crf', '18', v1]);
const m1 = await M.mesurerMouvement(v1);
essai('un passage figé d’une seconde est trouvé, avec ses temps', m1.ok && m1.figes.length === 1 && m1.figes[0].de === 0 && Math.abs(m1.figes[0].a - 1) < 0.05 && /figée à un endroit/.test(m1.attention.join(' ')), m1.figes);
essai('les images vides (un aplat uni) de plus de 3 images sont trouvées', m1.vides.length === 2 && m1.vides[0].images >= 28 && /images vides/.test(m1.attention.join(' ')), m1.vides);
essai('le mouvement seconde par seconde : un point quand rien ne bouge, une barre sinon', m1.graphe.length === 4 && m1.graphe.at(-1) === '·' && m1.graphe[1] !== '·', m1.graphe);
const v2 = path.join(tmp, 'v2.mp4');
ff(['-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=30:d=2', '-vf', 'tpad=stop_mode=clone:stop_duration=2,format=yuv420p', '-c:v', 'libx264', '-crf', '18', v2]);
const m2 = await M.mesurerMouvement(v2);
essai('une fin tenue plus de 1,4 s est dite (2,0 s ici), sans compter comme un passage figé de plus', m2.ok && Math.abs(m2.fin_tenue_s - 2) < 0.1 && /fin est tenue 2\.0 s/.test(m2.attention.join(' ')) && !/figée à/.test(m2.attention.join(' ')) && !m2.vides.length, [m2.fin_tenue_s, m2.attention]);
const v3 = path.join(tmp, 'v3.mp4');
ff(['-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=30:d=0.1', '-vf', 'trim=end_frame=1,tpad=stop_mode=clone:stop_duration=3,format=yuv420p', '-c:v', 'libx264', '-crf', '18', v3]);
const m3 = await M.mesurerMouvement(v3);
essai('une vidéo qui ne bouge pas du tout est dite « image fixe »', m3.ok && m3.part_figee > 0.98 && /ne bouge pas du tout/.test(m3.attention.join(' ')) && m3.attention.length === 1, m3.attention);
const v4 = path.join(tmp, 'v4.mp4');
ff(['-f', 'lavfi', '-i', 'color=c=0x606060:s=640x360:r=30:d=3', '-f', 'lavfi', '-i', 'color=c=white:s=6x6:r=30:d=3', '-filter_complex', "[0:v][1:v]overlay=x='20+t*40':y=180,format=yuv420p", '-c:v', 'libx264', '-crf', '18', v4]);
const m4 = await M.mesurerMouvement(v4);
essai('un détail seul qui bouge (un point de 6 pixels) : pas « figé », mais « presque rien ne bouge », dit à part', m4.ok && m4.figes.length === 0 && m4.calmes.length === 1 && m4.calmes[0].duree > 2.5 && /Presque rien ne bouge/.test(m4.attention.join(' ')) && !/est figée/.test(m4.attention.join(' ')) && !m4.graphe.includes('·'), [m4.figes, m4.calmes, m4.graphe]);
const cm = cmd(['mouvement', 'v1.mp4']);
essai('« derush-toile mouvement » l’écrit en clair, et en JSON sur demande', cm.code === 0 && /Passages figés \(1\)/.test(cm.out) && /Images vides : 0:00\.0/.test(cm.out) && /Fin tenue : 0\.5 s/.test(cm.out) && JSON.parse(cmd(['mouvement', 'v2.mp4', '--json']).out).fin_tenue_s > 1.9, cm.out.slice(0, 300));
essai('une vidéo absente ou illisible : une phrase, pas une trace', cmd(['mouvement', 'absente.mp4']).code === 1 && /introuvable/.test(cmd(['mouvement', 'absente.mp4']).err) && (await M.mesurerMouvement(path.join(tmp, 'secret.txt'))).ok === false);

console.log('Le relais, pour une IA dans un bac à sable');
const {ouvrirRelais} = await imp('relais.mjs');
const atelier = path.join(tmp, 'atelier');
ecrire(path.join(atelier, 'toile', 'index.html'), PAGE('window.renderAt = (t) => { fond(); rond(80 + 240 * t); };'));
ecrire(path.join(tmp, 'dehors', 'index.html'), PAGE('window.renderAt = (t) => { fond(); };'));
const relais = await ouvrirRelais(atelier, {lisibles: [atelier]});
const viaRelais = async (corps, jeton = relais.jeton) => {
  const r = await demander(`${relais.url}/toile`, {methode: 'POST', entetes: {'x-derush-relais': jeton, 'content-type': 'application/json'}, corps: JSON.stringify(corps)});
  const ligne = String(r.corps ?? '').split('\n').reverse().find((l) => l.startsWith('##DERUSH-TOILE'));
  return {code: r.code, ...(ligne ? JSON.parse(/^##DERUSH-TOILE (.*)##\s*$/.exec(ligne.trim())[1]) : {})};
};
essai('sans le jeton de ce travail : refusé', (await viaRelais({args: ['gabarits'], cwd: '.'}, 'faux')).code === 403);
const r1 = await viaRelais({args: ['images', path.join(tmp, 'dehors', 'index.html')], cwd: '.'});
const r2 = await viaRelais({args: ['rendre', 'toile/index.html', '-o', path.join(tmp, 'dehors', 'film.mp4')], cwd: '.'});
const r3 = await viaRelais({args: ['images', 'toile/index.html', '--racine', tmp], cwd: '.'});
const r4 = await viaRelais({args: ['images', 'toile/index.html'], cwd: '..'});
const r5 = await viaRelais({args: ['mouvement', 'x.mp4'], cwd: '.'});
essai('une page, une sortie, un dossier servi ou un dossier de départ hors du dossier de travail : refusés', [r1, r2, r3, r4].every((r) => r.ok === false) && /dossier de travail/.test(r1.message) && /-o doit rester/.test(r2.message) && /--racine doit rester/.test(r3.message), [r1.message, r2.message, r3.message, r4.message]);
essai('seules les commandes qui ont besoin du navigateur passent par le relais', r5.ok === false && /ne passe pas par le relais/.test(r5.message));
fs.symlinkSync(path.join(tmp, 'secret.txt'), path.join(atelier, 'toile', 'lien.txt'));
const r6 = await viaRelais({args: ['images', 'toile/index.html'], cwd: '.'});
essai('un lien du dossier de la page vers un fichier que l’IA n’a pas le droit de lire : refusé (il passerait dans la vidéo)', r6.ok === false && /toile\/lien\.txt/.test(r6.message) && /pas le droit de lire/.test(r6.message), r6.message);
fs.rmSync(path.join(atelier, 'toile', 'lien.txt'));
const r7 = await viaRelais({args: ['rendre', 'toile/index.html', '-o', 'rendu/x.mp4', '--son', path.join(tmp, 'secret.txt')], cwd: '.'});
essai('un son hors de ce que l’IA a le droit de lire : refusé', r7.ok === false && /le son doit être/.test(r7.message), r7.message);
const r8 = await viaRelais({args: ['gabarit', 'vide', 'nouvelle'], cwd: '.'});
essai('« gabarit » par le relais : la page de départ arrive dans le dossier de travail', r8.ok === true && r8.code === 0 && fs.existsSync(path.join(atelier, 'nouvelle', 'index.html')) && /Toile créée/.test(r8.sortie), r8);

const navigateur = T.navigateurToile();
if (!navigateur) console.log('\nAucun navigateur sans fenêtre sur cet ordinateur : les rendus ne sont pas essayés (ESSAI_TOILE_CHROME=<chemin>).');
else {
  console.log(`Le rendu, avec ${path.basename(navigateur)}`);
  const P = path.join(tmp, 'pages');
  ecrire(path.join(P, 'juste', 'index.html'), PAGE('window.renderAt = (t) => { fond(); rond(80 + 240 * t); };'));
  const im = cmd(['images', 'pages/juste/index.html', '--instants', '0.5,1.5', '-o', 'pages/juste/images', '--planche', 'pages/juste/planche.jpg']);
  essai('des images fixes à des instants choisis, à la taille que dit la page, et une planche', im.code === 0 && taillePng(path.join(P, 'juste', 'images', 't-0000.50.png')).join('x') === '640x360' && fs.existsSync(path.join(P, 'juste', 'images', 't-0001.50.png')) && fs.statSync(path.join(P, 'juste', 'planche.jpg')).size > 2000 && md5(path.join(P, 'juste', 'images', 't-0000.50.png')) !== md5(path.join(P, 'juste', 'images', 't-0001.50.png')), im.err || im.out);
  const ve = cmd(['verifier', 'pages/juste/index.html']);
  essai('une page qui tient son contrat : deux fois la même image, la même seule ou après les autres', ve.code === 0 && /✓ le contrat/.test(ve.out) && /✓ deux fois le même instant/.test(ve.out) && /✓ à froid/.test(ve.out) && /tu peux la rendre/.test(ve.out), ve.out || ve.err);
  const re = cmd(['rendre', 'pages/juste/index.html', '-o', 'rendu/juste.mp4', '--json']);
  const jr = (() => { try { return JSON.parse(re.out); } catch { return {}; } })();
  const sj = sonde(path.join(tmp, 'rendu', 'juste.mp4'));
  essai('le rendu : les images 0 à N-1 (60 pour 2 s à 30 images/s), en H.264 aux couleurs étiquetées', re.code === 0 && jr.images === 60 && jr.contrat === 'renderAt' && sj.codec_name === 'h264' && sj.pix_fmt === 'yuv420p' && sj.color_space === 'bt709' && sj.color_range === 'tv' && Number(sj.nb_read_frames) === 60 && sj.width === 640 && sj.height === 360, [re.err, sj]);
  essai('la mesure du mouvement vient avec le rendu : ici, aucun passage figé', jr.mouvement?.ok === true && jr.mouvement.figes.length === 0 && jr.mouvement.fin_tenue_s === 0 && !jr.mouvement.graphe.includes('·'), jr.mouvement);
  const bis = cmd(['rendre', 'pages/juste/index.html', '-o', 'rendu/juste-bis.mp4', '--debut', '0.5', '--fin', '1.5', '--echelle', '2']);
  const sb = sonde(path.join(tmp, 'rendu', 'juste-bis.mp4'));
  essai('un passage seulement (--debut, --fin), et deux fois plus de points (--echelle 2)', bis.code === 0 && Number(sb.nb_read_frames) === 30 && sb.width === 1280 && sb.height === 720 && /30 images/.test(bis.out), [bis.err, sb]);
  const deux = cmd(['rendre', 'pages/juste/index.html', '-o', 'rendu/juste-2.mp4']);
  essai('deux rendus de la même page donnent le même fichier, à l’octet près', deux.code === 0 && md5(path.join(tmp, 'rendu', 'juste.mp4')) === md5(path.join(tmp, 'rendu', 'juste-2.mp4')));

  ecrire(path.join(P, 'horloge', 'index.html'), PAGE('window.renderAt = (t) => { fond(); rond(80 + (Date.now() % 400)); };'));
  const vh = cmd(['verifier', 'pages/horloge/index.html']);
  essai('une page qui lit l’horloge : « deux fois le même instant » échoue, code 2', vh.code === 2 && /✗ deux fois le même instant/.test(vh.out) && /une horloge/.test(vh.out) && /À corriger avant de rendre/.test(vh.out), vh.out || vh.err);
  ecrire(path.join(P, 'etat', 'index.html'), PAGE('let x = 80; window.renderAt = (t) => { x += 3; fond(); rond(x % 640); };'));
  const vetat = cmd(['verifier', 'pages/etat/index.html']);
  essai('une page qui additionne d’image en image est prise (deux fois le même instant, ou à froid)', vetat.code === 2 && /✗ (deux fois le même instant|à froid)/.test(vetat.out), vetat.out || vetat.err);
  ecrire(path.join(P, 'suite', 'index.html'), PAGE('let n = -1; let x = 80; window.renderAt = (t) => { const c2 = Math.round(t * 60); if (c2 < n || n < 0) { n = 0; x = 80; } while (n < c2) { x += 1.5; n++; } fond(); rond(x); };', '{duree: 2, fps: 30, largeur: 640, hauteur: 360, suite: true}'));
  const vs = cmd(['verifier', 'pages/suite/index.html']);
  essai('une simulation qui le dit (suite: true) et rejoue depuis zéro quand le temps recule : acceptée, sans contrôle à froid', vs.code === 0 && /pas de contrôle à froid/.test(vs.out), vs.out || vs.err);
  ecrire(path.join(P, 'sans', 'index.html'), '<!doctype html><body style="margin:0;background:#123"><div style="width:80px;height:80px;background:#ff7a3c;animation:a 1s linear infinite alternate"></div><style>@keyframes a{from{transform:translateX(0)}to{transform:translateX(500px)}}</style>');
  const sc = cmd(['rendre', 'pages/sans/index.html', '-o', 'rendu/sans.mp4', '--duree', '1']);
  essai('une page sans contrat : refusée, avec la marche à suivre', sc.code === 1 && /n’a pas window\.renderAt\(t\)/.test(sc.err) && /--horloge/.test(sc.err), sc.err);
  const sd = cmd(['rendre', 'pages/sans/index.html', '-o', 'rendu/sans.mp4', '--horloge']);
  essai('sans durée (ni --duree, ni window.toile) : une phrase qui dit quoi écrire, pas une vidéo d’une image', sd.code === 1 && /Il manque la durée/.test(sd.err) && !fs.existsSync(path.join(tmp, 'rendu', 'sans.mp4')), sd.err);
  const ho = cmd(['rendre', 'pages/sans/index.html', '-o', 'rendu/horloge.webm', '--duree', '1', '--largeur', '640', '--hauteur', '360', '--horloge', '--transparent', '--json']);
  const jh = (() => { try { return JSON.parse(ho.out); } catch { return {}; } })();
  const sh = sonde(path.join(tmp, 'rendu', 'horloge.webm'));
  essai('avec --horloge, le temps du navigateur avance à la main : l’animation CSS est rendue, sur fond transparent (.webm)', ho.code === 0 && jh.contrat === 'horloge' && jh.images === 30 && sh.codec_name === 'vp9' && sh.tags?.alpha_mode === '1' && Number(sh.nb_read_frames) === 30, [ho.err, sh]);
  const mh = await M.mesurerMouvement(path.join(tmp, 'rendu', 'horloge.webm'));
  essai('et elle bouge vraiment (aucun passage figé)', mh.ok && mh.figes.length === 0 && mh.part_figee < 0.1, mh);

  ecrire(path.join(P, 'internet', 'index.html'), PAGE('const s = document.createElement("script"); s.src = "https://exemple.invalid/x.js"; document.head.appendChild(s); new Image().src = "https://exemple.invalid/suivi.gif"; window.renderAt = (t) => { fond(); rond(80 + 240 * t); };'));
  const net = cmd(['images', 'pages/internet/index.html', '--instants', '1', '--json']);
  const jn = (() => { try { return JSON.parse(net.out); } catch { return {}; } })();
  essai('rien ne vient d’Internet : ce que la page a tenté de charger est refusé, et dit', net.code === 0 && jn.refus?.some((u) => /exemple\.invalid\/x\.js/.test(u)) && jn.refus?.some((u) => /suivi\.gif/.test(u)), jn.refus ?? net.err);

  ecrire(path.join(P, 'boucle', 'index.html'), PAGE('window.renderAt = (t) => { fond(); rond(320 + 200 * Math.cos(t * Math.PI), 180 + 100 * Math.sin(t * Math.PI)); };', '{duree: 2, fps: 30, largeur: 640, hauteur: 360, boucle: true}'));
  ecrire(path.join(P, 'saut', 'index.html'), PAGE('window.renderAt = (t) => { fond(); rond(80 + 240 * t); };', '{duree: 2, fps: 30, largeur: 640, hauteur: 360, boucle: true}'));
  const vb = cmd(['verifier', 'pages/boucle/index.html']);
  const vsaut = cmd(['verifier', 'pages/saut/index.html']);
  essai('une boucle : la dernière image s’enchaîne avec la première ; un saut à la couture est pris', vb.code === 0 && /✓ la boucle/.test(vb.out) && vsaut.code === 2 && /✗ la boucle/.test(vsaut.out) && /un saut à la couture/.test(vsaut.out), [vb.out, vsaut.out]);

  ecrire(path.join(P, 'lente', 'index.html'), '<!doctype html><body><script>window.__ready = false; window.renderAt = () => {}; window.__bootFailed = "la police Titre est introuvable";</script>');
  const le = cmd(['images', 'pages/lente/index.html']);
  essai('une page qui dit qu’elle n’a pas pu démarrer : son message revient tel quel', le.code === 1 && /la police Titre est introuvable/.test(le.err), le.err);

  console.log('Les pages de départ, rendues');
  cmd(['gabarit', 'vide', 'pages/vide']);
  const gv = cmd(['verifier', 'pages/vide/index.html']);
  const giv = cmd(['images', 'pages/vide/index.html', '--instants', '2.4', '-o', 'pages/vide/images']);
  essai('« vide » : le contrat tient, l’image est en 1920 × 1080 et ses polices viennent de Dérush', gv.code === 0 && giv.code === 0 && taillePng(path.join(P, 'vide', 'images', 't-0002.40.png')).join('x') === '1920x1080' && !/Introuvable|Refusé|Erreurs/.test(giv.out), [gv.out, giv.out, giv.err]);
  cmd(['gabarit', 'encre', 'pages/encre']);
  const ge = cmd(['images', 'pages/encre/index.html', '--instants', '1.5', '-o', 'pages/encre/a']);
  const ge2 = cmd(['images', 'pages/encre/index.html', '--instants', '1.5', '-o', 'pages/encre/b']);
  const fe = path.join(P, 'encre', 'a', 't-0001.50.png');
  const couleurs = ge.code === 0 ? spawnSync(FFMPEG, ['-v', 'error', '-i', fe, '-vf', 'scale=64:36,format=gray,entropy,metadata=print:key=lavfi.entropy.normalized_entropy.normal.Y:file=-', '-f', 'null', '-'], {encoding: 'utf8'}).stdout : '';
  essai('« encre » : le fluide est calculé (l’image n’est pas un aplat), et deux fois de suite il donne la même image', ge.code === 0 && ge2.code === 0 && Number(/=([0-9.]+)/.exec(couleurs)?.[1] ?? 0) > 0.1 && md5(fe) === md5(path.join(P, 'encre', 'b', 't-0001.50.png')), [ge.err, couleurs]);
  cmd(['gabarit', 'tableau', 'pages/tableau']);
  const gt = cmd(['verifier', 'pages/tableau/index.html']);
  const git = cmd(['images', 'pages/tableau/index.html', '--instants', '1,5.5', '-o', 'pages/tableau/images', '--json']);
  const jt = (() => { try { return JSON.parse(git.out); } catch { return {}; } })();
  essai('« tableau » : le moteur de dessin démarre depuis /tableaux/, la scène d’exemple et une scène du moteur se peignent', gt.code === 0 && /window\.renderFrame\(t\) est là/.test(gt.out) && git.code === 0 && jt.infos?.contrat === 'renderFrame' && Math.abs(jt.infos.duree - 10) < 0.01 && jt.infos.suite === true && !(jt.manquants ?? []).length && md5(jt.fichiers[0]) !== md5(jt.fichiers[1]), [gt.out, git.err, jt.manquants, jt.erreurs]);
  const galerie = cmd(['images', path.join(D, 'competences', 'tableaux-en-mouvement', 'moteur', 'index.html'), '--parametres', 'film=gallery', '--instants', '1,21', '-o', 'pages/galerie', '--json']);
  const jg = (() => { try { return JSON.parse(galerie.out); } catch { return {}; } })();
  essai('la galerie du moteur (35 styles) se peint telle quelle, avec ses paramètres de page', galerie.code === 0 && jg.infos?.titre?.length > 0 && Math.abs(jg.infos.duree - 41.25) < 0.6 && !(jg.manquants ?? []).length && !(jg.erreurs ?? []).length, [galerie.err, jg.infos, jg.erreurs]);
  if (libs && fs.existsSync(path.join(libs, 'roughjs')) && fs.existsSync(path.join(libs, 'three.quarks'))) {
    cmd(['gabarit', 'croquis', 'pages/croquis']);
    const gc = cmd(['verifier', 'pages/croquis/index.html']);
    essai('« croquis » : le trait à la main (Rough.js) tient son contrat', gc.code === 0 && /✓ à froid/.test(gc.out), gc.out || gc.err);
    cmd(['gabarit', 'particules', 'pages/particules']);
    const gp = cmd(['images', 'pages/particules/index.html', '--instants', '3.2', '-o', 'pages/particules/a']);
    const gp2 = cmd(['images', 'pages/particules/index.html', '--instants', '3.2', '-o', 'pages/particules/b']);
    essai('« particules » : three.js et three.quarks dessinent, et deux fois de suite donnent la même image (hasard à graine)', gp.code === 0 && gp2.code === 0 && !/Introuvable|Erreurs/.test(gp.out) && md5(path.join(P, 'particules', 'a', 't-0003.20.png')) === md5(path.join(P, 'particules', 'b', 't-0003.20.png')), [gp.out, gp.err]);
  } else console.log('  (les pages « croquis » et « particules » ne sont pas essayées : ESSAI_TOILE_LIBS=<node_modules avec three, three.quarks, quarks.core, roughjs>)');

  console.log('Par le relais, un vrai rendu');
  const rr = await viaRelais({args: ['images', 'toile/index.html', '--instants', '1', '-o', 'rendu/controle/images', '--planche', 'rendu/controle/planche.jpg'], cwd: '.'});
  essai('les images demandées par le relais arrivent dans le dossier de travail', rr.ok === true && rr.code === 0 && fs.existsSync(path.join(atelier, 'rendu', 'controle', 'images', 't-0001.00.png')) && fs.existsSync(path.join(atelier, 'rendu', 'controle', 'planche.jpg')) && /La planche, à regarder/.test(rr.sortie), rr);
  // la commande, lancée comme une IA dans un bac à sable : elle passe par l'adresse du relais
  const parRelais = await cmdSuivie(['images', 'toile/index.html', '--instants', '0.5', '-o', 'rendu/controle/par-relais'], atelier, {DERUSH_RELAIS: relais.url, DERUSH_RELAIS_JETON: relais.jeton});
  essai('la commande, lancée dans un bac à sable, passe par le relais et rend la même chose', parRelais.code === 0 && fs.existsSync(path.join(atelier, 'rendu', 'controle', 'par-relais', 't-0000.50.png')) && /hors du bac à sable/.test(parRelais.err), [parRelais.out, parRelais.err]);
}
await relais.fermer();

console.log(`\n${ok} essais réussis sur ${ok + ko}`);
if (!ko) fs.rmSync(tmp, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${tmp}`);
process.exit(ko ? 1 : 0);
