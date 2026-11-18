#!/usr/bin/env node
// Dérush — les essais du Mode Hollywood à trois IA : le graphiste (lib/graphiste.mjs, outils/derush-image.mjs,
// outils/graphiste.py) et l'équipe (lib/equipe.mjs).
//   - la commande : ses arguments (tout reste dans le dossier de travail, même à travers un lien), la consigne et les
//     arguments donnés à Codex (lecture seule, outil d'images ouvert, aucun connecteur) ;
//   - les images reprises dans le journal de la session de Codex (base64) ou sur le disque (savedPath) ;
//   - le fond transparent nettoyé et recadré, une image opaque gardée telle quelle, des variantes ;
//   - une planche de sprites découpée en images de même taille, et son GIF en boucle ;
//   - les erreurs dites simplement (quota noté, refus) ; derush-image directe et par le relais (adresse et boîte) ;
//   - l'équipe selon les quotas : qui réalise, monte, dessine ; qui prend la place d'une IA à bout ; le choix des modèles.
// Un faux Codex écrit une session comme le vrai : jamais le vrai Codex, aucune image réelle demandée.
//   node outils/essai-graphiste.mjs [dossier où créer le dossier d'essai]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync, spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('node outils/essai-graphiste.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
fs.mkdirSync(base, {recursive: true});
const tmp = fs.mkdtempSync(path.join(base, 'derush-essai-graphiste-'));
const support = path.join(tmp, 'support');
fs.mkdirSync(path.join(support, 'moteurs'), {recursive: true});
// le Python de Dérush (Pillow, numpy), s'il est sur cet ordinateur : relié pour essayer le nettoyage et la découpe
const vraiPython = process.env.ESSAI_PYTHON_DERUSH || path.join(os.homedir(), 'Library', 'Application Support', 'Dérush', 'moteurs', 'python');
if (fs.existsSync(path.join(vraiPython, 'bin', 'python'))) fs.symlinkSync(vraiPython, path.join(support, 'moteurs', 'python'));
const HOME_CODEX = path.join(tmp, 'codex-home');
Object.assign(process.env, {DERUSH_SUPPORT: support, CODEX_HOME: HOME_CODEX});
const G = await import(pathToFileURL(path.join(D, 'lib', 'graphiste.mjs')).href);
const E = await import(pathToFileURL(path.join(D, 'lib', 'equipe.mjs')).href);
const {PYTHON} = await import(pathToFileURL(path.join(D, 'lib', 'moteurs.mjs')).href);
const {ouvrirRelais} = await import(pathToFileURL(path.join(D, 'lib', 'relais.mjs')).href);
const {lireReglages} = await import(pathToFileURL(path.join(D, 'lib', 'reglages.mjs')).href);
const {modeleCommande} = await import(pathToFileURL(path.join(D, 'lib', 'gemini-api.mjs')).href);
const avecPython = fs.existsSync(PYTHON) && spawnSync(PYTHON, ['-c', 'import PIL, numpy']).status === 0;

let ok = 0;
let ko = 0;
const essai = (nom, cond, detail = '') => { if (cond === true) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail || cond ? ` — ${typeof (detail || cond) === 'string' ? detail || cond : JSON.stringify(detail || cond).slice(0, 600)}` : ''}`); } };
const refuse = (f) => { try { f(); return null; } catch (e) { return e.message; } };

// ——— les images d'essai (FFmpeg) : un disque jaune avec un voile de taches, une planche 4 × 2, une image opaque ———
const ffmpeg = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args]); if (r.status) throw new Error(String(r.stderr)); };
const IMG = path.join(tmp, 'images');
fs.mkdirSync(IMG, {recursive: true});
// le disque (opaque), un point opaque isolé loin de lui, et un voile de taches presque invisibles partout
ffmpeg(['-f', 'lavfi', '-i', 'color=c=black:s=400x300', '-vf', "format=rgba,geq=r='255':g='210':b='0':a='if(lt(hypot(X-200,Y-150),80),255,if(lt(hypot(X-375,Y-20),2),230,if(eq(mod(X,23),0)*eq(mod(Y,17),0),30,0)))'", '-frames:v', '1', path.join(IMG, 'disque.png')]);
// une planche : 4 colonnes × 2 lignes de cases de 100 px ; dans la case k, un disque qui avance de 5 px
ffmpeg(['-f', 'lavfi', '-i', 'color=c=black:s=400x200', '-vf', "format=rgba,geq=r='255':g='120':b='40':a='if(lt(hypot(mod(X,100)-(30+5*(floor(X/100)+4*floor(Y/100))),mod(Y,100)-50),22),255,if(eq(mod(X,19),0)*eq(mod(Y,13),0),20,0))'", '-frames:v', '1', path.join(IMG, 'planche.png')]);
ffmpeg(['-f', 'lavfi', '-i', 'testsrc=size=300x200', '-frames:v', '1', path.join(IMG, 'opaque.png')]);
const alphaEn = (f, pts) => (avecPython ? JSON.parse(spawnSync(PYTHON, ['-c', `import json,sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert('RGBA')\nprint(json.dumps([im.getpixel((x,y))[3] for x,y in json.loads(sys.argv[2])]))`, f, JSON.stringify(pts)]).stdout.toString()) : null);
const taille = (f) => { const b = fs.readFileSync(f); return {l: b.readUInt32BE(16), h: b.readUInt32BE(20)}; };

// ——— le faux Codex : il écrit sa session (comme le vrai, $CODEX_HOME/sessions/AAAA/MM/JJ) avec les images demandées ———
const JOURNAL = path.join(tmp, 'codex.jsonl');
const FAUX = path.join(tmp, 'faux-codex.mjs');
fs.writeFileSync(FAUX, `#!${process.execPath}
import fs from 'node:fs';
import path from 'node:path';
const a = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(JOURNAL)}, JSON.stringify({args: a}) + '\\n');
const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
const fil = '01aa' + Date.now().toString(16) + '-faux-' + process.pid;
out({type: 'thread.started', thread_id: fil});
const mode = process.env.FAUX_MODE ?? '';
if (mode === 'quota') { out({type: 'turn.failed', error: {message: "You've hit your usage limit. Upgrade to Pro or try again later."}}); process.exit(1); }
const d = new Date();
const dossier = path.join(process.env.CODEX_HOME, 'sessions', String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0'));
fs.mkdirSync(dossier, {recursive: true});
const lignes = [{type: 'session_meta', payload: {id: fil}}];
for (const [k, f] of (process.env.FAUX_IMAGES ?? '').split(',').filter(Boolean).entries()) {
  const item = {type: 'Extension', kind: 'image_gen.generation', id: 'exec-' + k, status: mode === 'refus' ? 'failed' : 'completed', revisedPrompt: 'image ' + k, transparentBackground: a.join(' ').includes('transparent_background: true'),
    failure: mode === 'refus' ? {type: 'content_policy_violation'} : null, generationId: 'g' + k};
  if (mode === 'chemin') item.savedPath = f; else if (mode !== 'refus') item.result = fs.readFileSync(f).toString('base64');
  lignes.push({type: 'event_msg', payload: {type: 'item_completed', thread_id: fil, item}});
}
fs.writeFileSync(path.join(dossier, 'rollout-essai-' + fil + '.jsonl'), lignes.map((x) => JSON.stringify(x)).join('\\n') + '\\n');
out({type: 'item.completed', item: {type: 'agent_message', text: 'fait.'}});
out({type: 'turn.completed', usage: {}});
`);
fs.chmodSync(FAUX, 0o755);
const derniersArgs = () => { const l = fs.readFileSync(JOURNAL, 'utf8').trim().split('\n'); return JSON.parse(l.at(-1)).args; };

// ——— un dossier de travail ———
const A = path.join(tmp, 'atelier');
fs.mkdirSync(path.join(A, 'remotion', 'public'), {recursive: true});
fs.mkdirSync(path.join(A, 'contexte'), {recursive: true});
fs.writeFileSync(path.join(A, 'montage.json'), '{}');
fs.copyFileSync(path.join(IMG, 'disque.png'), path.join(A, 'contexte', 'mascotte.png'));
const DEHORS = path.join(tmp, 'dehors');
fs.mkdirSync(DEHORS, {recursive: true});
fs.copyFileSync(path.join(IMG, 'disque.png'), path.join(DEHORS, 'secret.png'));

console.log('Les arguments de derush-image');
let d = G.lireArguments(['un autocollant', 'pouce', 'levé'], {atelier: A});
essai('une image : remotion/public/ia/<nom tiré de la description>.png, fond plein par défaut', d.sortie === path.join(A, 'remotion', 'public', 'ia', 'un-autocollant-pouce-leve.png') && d.transparent === false && d.variantes === 1 && !d.anime, d);
d = G.lireArguments(['un renard qui court', '--anime', '--images', '7', '--fps', '12'], {atelier: A});
essai('--anime : un dossier, fond transparent, 7 images arrondies à la grille 4 × 2 (8), 12 i/s', d.sortie === path.join(A, 'remotion', 'public', 'ia', 'un-renard-qui-court') && d.transparent && d.anime.images === 8 && d.anime.colonnes === 4 && d.anime.lignes === 2 && d.anime.fps === 12, d);
essai('les grilles : 5 → 3 × 2, 9 → 3 × 3, 20 → 4 × 4', JSON.stringify([5, 9, 20].map((n) => G.grilleAnimation(n))) === JSON.stringify([{images: 6, colonnes: 3, lignes: 2}, {images: 9, colonnes: 3, lignes: 3}, {images: 16, colonnes: 4, lignes: 4}]));
d = G.lireArguments(['le même personnage', '--transparent', '--ref', 'contexte/mascotte.png', '-o', 'remotion/public/ia/clin', '--format', 'vertical'], {atelier: A});
essai('--ref d’une image du dossier, -o sans extension (devient .png), --format', d.refs[0] === fs.realpathSync(path.join(A, 'contexte', 'mascotte.png')) && d.sortie === path.join(A, 'remotion', 'public', 'ia', 'clin.png') && d.format === 'vertical' && d.transparent, d);
fs.symlinkSync(DEHORS, path.join(A, 'remotion', 'public', 'lien-dehors'));
const refus = [
  refuse(() => G.lireArguments(['x', 'un chat', '-o', '../dehors/chat.png'], {atelier: A})),
  refuse(() => G.lireArguments(['un chat', '-o', 'remotion/public/lien-dehors/chat.png'], {atelier: A})),
  refuse(() => G.lireArguments(['un chat', '--ref', path.join(DEHORS, 'secret.png')], {atelier: A})),
  refuse(() => G.lireArguments(['un chat', '--variantes', '9'], {atelier: A})),
  refuse(() => G.lireArguments(['un chat', '--images', '8'], {atelier: A})),
  refuse(() => G.lireArguments(['un chat', '--anime', '--variantes', '2'], {atelier: A})),
  refuse(() => G.lireArguments(['un chat', '--couleur', 'rouge'], {atelier: A})),
  refuse(() => G.lireArguments(['--transparent'], {atelier: A})),
  refuse(() => G.lireArguments(['un chat', '--format', 'cinemascope'], {atelier: A})),
];
essai('refusés : hors du dossier (même par un lien), une référence d’ailleurs, 9 variantes, --images sans --anime, une option inconnue, sans description, un format inconnu', refus.every(Boolean), refus);

console.log('Ce que Codex reçoit');
d = G.lireArguments(['une étoile jaune souriante', '--transparent', '--ref', 'contexte/mascotte.png'], {atelier: A});
const args = G.argsGraphiste(d, {modele: 'gpt-6.1-terra', aCouper: ['mon_serveur']});
const consigne = args.at(-1);
essai('lecture seule, outil d’images ouvert, réflexion courte, le modèle choisi, la référence jointe, les connecteurs coupés', ['-s', 'read-only', '--enable', 'image_generation', '-m', 'gpt-6.1-terra', '-i', 'mcp_servers.mon_serveur.enabled=false'].every((x) => args.includes(x)) && args.includes('model_reasoning_effort="low"') && args[args.indexOf('-i') + 1] === d.refs[0], args.slice(0, -1));
essai('la consigne : un seul appel à image_gen, fond transparent, la référence, ni texte ni marque, et rien d’autre à faire', /UN seul appel : une étoile jaune souriante/.test(consigne) && /transparent_background: true/.test(consigne) && /num_last_images_to_include: 1/.test(consigne) && /ni logo, ni personnage/.test(consigne) && /N'exécute aucune commande et n'écris aucun fichier/.test(consigne), consigne);
const cAnime = G.consigneCodex(G.lireArguments(['un cœur qui bat', '--anime', '--images', '6'], {atelier: A}));
essai('une animation : une planche de 3 colonnes sur 2 lignes, le même sujet à la même place dans chaque case', /3 colonnes sur 2 lignes/.test(cAnime) && /6 images successives/.test(cAnime) && /à la même place/.test(cAnime), cAnime);

console.log('Les images, reprises dans la session de Codex');
process.env.FAUX_IMAGES = path.join(IMG, 'disque.png');
let r = await G.dessiner(G.lireArguments(['un disque jaune', '--transparent'], {atelier: A}), {codex: FAUX});
const f1 = r.images[0]?.chemin;
essai('une image : rangée à sa place (remotion/public/ia/un-disque-jaune.png)', f1 === path.join(A, 'remotion', 'public', 'ia', 'un-disque-jaune.png') && fs.existsSync(f1), r);
if (avecPython) {
  const t = taille(f1);
  // recadrée au disque (rayon 80, plus 3 % de marge) : le point isolé et le voile ne comptent plus dans le cadre
  essai('fond transparent : recadrée au sujet (le point isolé et le voile de taches effacés)', t.l < 200 && t.h < 200 && t.l > 160 && r.images[0].transparent === true, t);
  const bord = alphaEn(f1, [[1, 1], [t.l - 2, 1], [Math.round(t.l / 2), Math.round(t.h / 2)]]);
  essai('… le voile est effacé (alpha 0 aux coins), le sujet reste opaque (alpha 255 au centre)', bord[0] === 0 && bord[1] === 0 && bord[2] === 255, bord);
} else console.log('  (sans le Python de Dérush sur cet ordinateur : le nettoyage n’est pas essayé, l’image est rangée telle quelle)');
process.env.FAUX_IMAGES = path.join(IMG, 'opaque.png');
r = await G.dessiner(G.lireArguments(['un fond de mire', '-o', 'remotion/public/ia/mire.png'], {atelier: A}), {codex: FAUX});
essai('une image à fond plein : gardée telle quelle (300 × 200)', JSON.stringify(taille(r.images[0].chemin)) === JSON.stringify({l: 300, h: 200}) && r.images[0].transparent === false, r.images[0]);
process.env.FAUX_IMAGES = [path.join(IMG, 'opaque.png'), path.join(IMG, 'disque.png')].join(',');
r = await G.dessiner(G.lireArguments(['deux idées de fond', '--variantes', '2'], {atelier: A}), {codex: FAUX});
essai('des variantes : variante-1.png et variante-2.png, dans un dossier', r.images.length === 2 && r.images.every((x, k) => x.chemin === path.join(A, 'remotion', 'public', 'ia', 'deux-idees-de-fond', `variante-${k + 1}.png`) && fs.existsSync(x.chemin)), r.images);
process.env.FAUX_MODE = 'chemin';
process.env.FAUX_IMAGES = path.join(IMG, 'opaque.png');
r = await G.dessiner(G.lireArguments(['une image écrite sur le disque', '-o', 'remotion/public/ia/disque-dur.png'], {atelier: A}), {codex: FAUX});
essai('une version de Codex qui écrit l’image sur le disque (savedPath) : reprise aussi', fs.existsSync(r.images[0]?.chemin ?? '') && taille(r.images[0].chemin).l === 300, r);
delete process.env.FAUX_MODE;

console.log('Une animation : la planche découpée, et son GIF');
process.env.FAUX_IMAGES = path.join(IMG, 'planche.png');
r = await G.dessiner(G.lireArguments(['un disque qui avance', '--anime', '--images', '8', '--fps', '8'], {atelier: A}), {codex: FAUX});
const dossierA = path.join(A, 'remotion', 'public', 'ia', 'un-disque-qui-avance');
const images = fs.readdirSync(dossierA).filter((n) => /^f-\d+\.png$/.test(n)).sort();
const tailles = images.map((n) => JSON.stringify(taille(path.join(dossierA, n))));
essai('8 images f-01.png … f-08.png, toutes de la même taille', images.length === 8 && images[0] === 'f-01.png' && new Set(tailles).size === 1 && r.animation?.images === 8, {images, tailles: [...new Set(tailles)]});
const nb = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', path.join(dossierA, 'animation.gif')]).stdout.toString().trim();
essai('animation.gif : un GIF de 8 images, en boucle, et la planche gardée', fs.readFileSync(path.join(dossierA, 'animation.gif')).subarray(0, 3).toString() === 'GIF' && nb === '8' && fs.existsSync(path.join(dossierA, 'planche.png')), nb);
if (avecPython) essai('les cases sont recadrées au même cadre (le mouvement dessiné reste, le vide autour part)', taille(path.join(dossierA, 'f-01.png')).l < 100 && taille(path.join(dossierA, 'f-01.png')).h < 70, taille(path.join(dossierA, 'f-01.png')));
const cr = G.compteRendu(r, A);
essai('le compte rendu pour le monteur : les images, le GIF, et la ligne Remotion (staticFile)', /f-01\.png … f-08\.png/.test(cr) && /animation\.gif — en boucle, 8 images par seconde/.test(cr) && /staticFile\(`ia\/un-disque-qui-avance\/f-/.test(cr), cr);

console.log('Les erreurs');
process.env.FAUX_MODE = 'quota';
let err = null;
try { await G.dessiner(G.lireArguments(['un chat', '-o', 'remotion/public/ia/chat-quota.png'], {atelier: A}), {codex: FAUX}); } catch (e) { err = e; }
const quotas = JSON.parse(fs.readFileSync(path.join(support, 'quotas.json'), 'utf8'));
essai('un quota atteint : dit simplement, et noté pour l’équipe (ChatGPT à bout)', err?.genre === 'quota' && /quota de ChatGPT est atteint/.test(err.message) && quotas.codex?.statut === 'rejected', err?.message);
fs.rmSync(path.join(support, 'quotas.json'), {force: true});
process.env.FAUX_MODE = 'refus';
err = null;
try { await G.dessiner(G.lireArguments(['quelque chose de refusé', '-o', 'remotion/public/ia/refus.png'], {atelier: A}), {codex: FAUX}); } catch (e) { err = e; }
essai('un dessin refusé par ses règles : la marche à suivre, aucun fichier', err?.genre === 'refus' && /change la description/.test(err.message) && !fs.existsSync(path.join(A, 'remotion', 'public', 'ia', 'refus.png')), err?.message);
delete process.env.FAUX_MODE;
let sansCodex = null;
try { await G.dessiner(G.lireArguments(['un chat'], {atelier: A}), {codex: null}); } catch (e) { sansCodex = e.message; }
essai('sans Codex branché : dit où le brancher', /Connexions/.test(sansCodex ?? ''), sansCodex);

console.log('La commande derush-image');
const lancer = (argv, env = {}, cwd = A) => new Promise((ok) => {
  const p = spawn(process.execPath, [path.join(D, 'outils', 'derush-image.mjs'), ...argv], {cwd, env: {...process.env, DERUSH_RELAIS: '', DERUSH_RELAIS_BOITE: '', DERUSH_RELAIS_JETON: '', ...env}});
  let sortie = '';
  let erreurs = '';
  p.stdout.on('data', (x) => { sortie += x; });
  p.stderr.on('data', (x) => { erreurs += x; });
  p.on('close', (code) => ok({code, sortie, erreurs}));
});
let c = await lancer(['--help']);
essai('--help : le mode d’emploi complet (options, exemples, règles)', c.code === 0 && /derush-image — ChatGPT, le graphiste/.test(c.sortie) && /--anime/.test(c.sortie) && /jamais de logo/.test(c.sortie), c.sortie.slice(0, 200));
c = await lancer(['un chat']);
essai('sans ChatGPT dans l’équipe : refusée, avec quoi faire à la place', c.code === 1 && /n’est pas dans ton équipe/.test(c.erreurs) && /dessine autrement/.test(c.erreurs), c);
process.env.FAUX_IMAGES = path.join(IMG, 'opaque.png');
c = await lancer(['un fond bleu', '-o', 'fond-cli.png'], {DERUSH_GRAPHISTE: FAUX, DERUSH_GRAPHISTE_MODELE: 'gpt-6.2-astra'}, path.join(A, 'remotion', 'public'));
essai('directe (Claude) : ChatGPT dessine, l’image arrive là où on l’a demandée, depuis un sous-dossier', c.code === 0 && /ChatGPT a dessiné une image/.test(c.sortie) && fs.existsSync(path.join(A, 'remotion', 'public', 'fond-cli.png')) && derniersArgs().includes('gpt-6.2-astra'), c);
const journalDessins = G.dessinsDepuis(A, Date.now() - 60000);
essai('chaque dessin est noté dans le dossier de travail (Dérush le montre en direct et le compte)', journalDessins.length >= 1 && journalDessins.at(-1).description === 'un fond bleu' && journalDessins.at(-1).fichiers[0] === path.join(A, 'remotion', 'public', 'fond-cli.png'), journalDessins.at(-1));

console.log('Le relais (Codex et Gemini, dans leur bac à sable)');
const rel = await ouvrirRelais(A, {graphiste: {codex: FAUX, modele: null}});
c = await lancer(['un autocollant étoile', '--transparent', '-o', 'remotion/public/ia/par-relais.png'], {DERUSH_RELAIS: rel.url, DERUSH_RELAIS_JETON: rel.jeton});
essai('par l’adresse du relais (Codex) : dessinée hors du bac à sable, rangée dans le dossier de travail', c.code === 0 && /ChatGPT a dessiné une image/.test(c.sortie) && fs.existsSync(path.join(A, 'remotion', 'public', 'ia', 'par-relais.png')), c);
c = await lancer(['un chat', '-o', '../dehors/vol.png'], {DERUSH_RELAIS: rel.url, DERUSH_RELAIS_JETON: rel.jeton});
essai('… et toujours dans le dossier de travail (une sortie ailleurs est refusée)', c.code === 1 && /restent dans le dossier de travail/.test(c.erreurs) && !fs.existsSync(path.join(DEHORS, 'vol.png')), c);
c = await lancer(['un chat'], {DERUSH_RELAIS: rel.url, DERUSH_RELAIS_JETON: 'mauvais-jeton'});
essai('… avec le bon jeton seulement', c.code === 1 && /Jeton refusé/.test(c.erreurs), c);
rel.fermer();
const relB = await ouvrirRelais(A, {boite: true, graphiste: {codex: FAUX}});
c = await lancer(['un nuage dessiné', '-o', 'remotion/public/ia/par-boite.png'], {DERUSH_RELAIS_BOITE: relB.boite, DERUSH_RELAIS_JETON: relB.jeton});
essai('par la boîte du relais (Gemini, sans réseau local)', c.code === 0 && fs.existsSync(path.join(A, 'remotion', 'public', 'ia', 'par-boite.png')), c);
relB.fermer();
const relSans = await ouvrirRelais(A, {});
c = await lancer(['un chat'], {DERUSH_RELAIS: relSans.url, DERUSH_RELAIS_JETON: relSans.jeton});
essai('un relais sans graphiste (ChatGPT pas dans l’équipe) : refusé, avec quoi faire à la place', c.code === 1 && /n’est pas dans ton équipe/.test(c.erreurs), c);
relSans.fermer();

console.log('L’équipe, selon les quotas');
const prets = {claude: {ok: true}, codex: {ok: true}, gemini: {ok: true}};
const dans = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const q = (x = {}) => ({claude: {connu: false}, codex: {connu: false}, gemini: {connu: false}, ...x});
const atteint = (recharge = dans(2), vu = new Date().toISOString()) => ({connu: true, statut: 'atteint', recharge, vu_le: vu});
const reg = {};
let e = E.composerEquipe({etats: prets, moteur: 'claude', gemini: {voies: ['commande'], nom_oeil: 'Gemini 4 Hydrogen'}, reglages: reg, q: q()});
essai('les trois prêts : Gemini réalise, Claude monte et ChatGPT dessine', e.phrase === 'Gemini réalise, Claude monte et ChatGPT dessine.' && JSON.stringify(e.membres) === '["gemini","claude","chatgpt"]', e.phrase);
e = E.composerEquipe({etats: prets, moteur: 'claude', gemini: {voies: ['commande']}, reglages: reg, q: q({claude: atteint()})});
essai('Claude à bout : Codex monte à sa place (et la phrase dit jusqu’à quand)', e.monteur.remplace_par === 'codex' && e.monteur_effectif === 'codex' && /Claude n’a plus de quota jusqu’à \d+ h/.test(e.phrase) && /Codex monte à sa place/.test(e.phrase), e);
e = E.composerEquipe({etats: prets, moteur: 'claude', gemini: {voies: ['commande']}, reglages: reg, q: q({claude: atteint(), codex: atteint()})});
essai('Claude et Codex à bout : Gemini monte ; ChatGPT ne dessine pas', e.monteur.remplace_par === 'gemini' && !e.graphiste.pret && /ChatGPT n’a plus de quota/.test(e.phrase), e.phrase);
e = E.composerEquipe({etats: prets, moteur: 'claude', gemini: {voies: ['commande']}, reglages: reg, q: q({claude: atteint(), codex: atteint(), gemini: atteint(null)})});
essai('toutes à bout : personne ne remplace (la personne choisit, le crédit API reste son choix)', e.monteur.remplace_par === null && /aucune autre IA ne peut monter/.test(e.phrase) && !e.realisateur.pret, e.phrase);
e = E.composerEquipe({etats: prets, moteur: 'claude', gemini: {voies: ['commande']}, reglages: reg, q: q({gemini: atteint(null, new Date(Date.now() - 10 * 60e3).toISOString())})});
essai('Gemini à bout (sans heure de recharge) : l’équipe continue à deux, le monteur regarde lui-même', !e.realisateur.pret && e.realisateur.a_bout?.estime === true && JSON.stringify(e.membres) === '["claude","chatgpt"]' && /Gemini n’a plus de quota : le monteur regarde lui-même/.test(e.phrase), e);
e = E.composerEquipe({etats: prets, moteur: 'claude', gemini: {voies: ['commande', 'cle']}, reglages: reg, q: q({gemini: atteint(null)})});
essai('… mais avec une clé Google, le réalisateur continue par elle', e.realisateur.pret && JSON.stringify(e.realisateur.voies) === '["cle"]', e.realisateur);
e = E.composerEquipe({etats: prets, moteur: 'claude', gemini: {voies: ['commande']}, reglages: reg, q: q({gemini: atteint(null, new Date(Date.now() - 2 * 3600e3).toISOString())})});
essai('un quota noté sans heure de recharge il y a plus d’une heure : Gemini est réessayé', e.realisateur.pret === true, e.realisateur);
e = E.composerEquipe({etats: prets, moteur: 'codex', gemini: {voies: ['commande']}, reglages: reg, q: q({claude: atteint(new Date(Date.now() - 60e3).toISOString())})});
essai('une recharge passée ne compte plus ; Codex monte et dessine', !E.aBout('claude', q({claude: atteint(new Date(Date.now() - 60e3).toISOString())})) && e.phrase === 'Gemini réalise, Codex monte et ChatGPT dessine.', e.phrase);
e = E.composerEquipe({etats: prets, moteur: 'claude', gemini: {voies: ['commande']}, reglages: {hollywood_graphiste: false}, q: q()});
essai('le graphiste coupé : Gemini réalise et Claude monte, sans rien dire de ChatGPT', !e.graphiste.pret && e.phrase === 'Gemini réalise et Claude monte.', e.phrase);
// le crédit API de Claude : proposé (jamais pris tout seul), et quand la personne le choisit, Claude reste le monteur
e = E.composerEquipe({etats: prets, moteur: 'claude', gemini: {voies: ['commande']}, reglages: reg, q: q({claude: atteint()}), api: true});
essai('Claude à bout, son crédit API prêt : Codex monte à sa place, et la phrase dit que le crédit se choisit à l’envoi', e.monteur.remplace_par === 'codex' && e.monteur.api_possible === true && /Codex monte à sa place, ou Claude avec ton crédit API si tu le choisis à l’envoi\./.test(e.phrase), e.phrase);
e = E.composerEquipe({etats: prets, moteur: 'claude', gemini: {voies: ['commande']}, reglages: reg, q: q({claude: atteint()}), api: true, creditApi: true});
essai('… le crédit API choisi pour cette demande : Claude reste le monteur, personne ne le remplace', e.monteur.remplace_par === null && e.monteur.credit_api === true && e.monteur_effectif === 'claude' && JSON.stringify(e.membres) === '["gemini","claude","chatgpt"]' && /il monte avec ton crédit API, comme tu l’as choisi/.test(e.phrase), e);
e = E.composerEquipe({etats: prets, moteur: 'codex', gemini: {voies: ['commande']}, reglages: reg, q: q({codex: atteint()}), api: true, creditApi: true});
essai('… seulement pour Claude : Codex à bout est remplacé, sans parler de crédit API', e.monteur.remplace_par === 'claude' && !e.monteur.credit_api && !e.monteur.api_possible && !/crédit API/.test(e.phrase), e.phrase);
e = E.composerEquipe({etats: prets, moteur: 'claude', gemini: {voies: ['commande']}, reglages: reg, q: q({claude: atteint()})});
essai('… sans crédit API prêt (aucune clé dans ce Dérush d’essai), la phrase n’en parle pas', !e.monteur.api_possible && !/crédit API/.test(e.phrase), e.phrase);
essai('l’ordre du relais : Claude, Codex, puis Gemini', E.remplacant('codex', prets, q()) === 'claude' && E.remplacant('claude', prets, q()) === 'codex' && E.remplacant('claude', {...prets, codex: {ok: false}}, q()) === 'gemini');

console.log('Les modèles de l’équipe');
E.changerEquipe({role: 'realisateur', modele: 'gemini-4-argon'});
E.changerEquipe({role: 'graphiste', modele: 'gpt-6.1-terra', actif: false});
const rg = lireReglages();
essai('le modèle du réalisateur et du graphiste, et le graphiste coupé, sont gardés', rg.hollywood_realisateur === 'gemini-4-argon' && rg.hollywood_graphiste_modele === 'gpt-6.1-terra' && rg.hollywood_graphiste === false, rg);
const modeles = ['gemini-4-hydrogen-high', 'gemini-4-hydrogen-medium', 'gemini-4-argon-low', 'gemini-4-argon-high', 'gemini-3.8-flash-high'];
essai('le réalisateur prend le modèle choisi (en réflexion haute) ; « Auto » prend le plus fort', modeleCommande(modeles) === 'gemini-4-argon-high' && modeleCommande(modeles, null) === 'gemini-4-hydrogen-high' && modeleCommande(modeles, 'gemini-9-inconnu') === 'gemini-4-hydrogen-high');
E.changerEquipe({role: 'realisateur', modele: null});
E.changerEquipe({role: 'graphiste', modele: '', actif: true});
essai('« Auto » efface le choix ; un modèle inventé ou un rôle inconnu sont refusés', lireReglages().hollywood_realisateur === null && lireReglages().hollywood_graphiste_modele === null && lireReglages().hollywood_graphiste === true
  && !!refuse(() => E.changerEquipe({role: 'realisateur', modele: 'gpt-6'})) && !!refuse(() => E.changerEquipe({role: 'monteur', modele: 'x'})));

console.log(`\n${ok} essais réussis sur ${ok + ko}${avecPython ? '' : ' (sans le Python de Dérush : nettoyage non essayé)'}`);
if (!ko) fs.rmSync(tmp, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${tmp}`);
process.exit(ko ? 1 : 0);
