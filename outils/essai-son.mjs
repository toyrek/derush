// Dérush — essais du son (lib/son.mjs, outils/derush-son.mjs) : la voix claire (durée gardée, son synchrone, souffle
// retiré, volume d'une voix), l'écho réduit, un passage seul, le mixage (la musique baissée sous la voix, −14 LUFS) et
// les mesures. Une voix fabriquée (la voix du Mac, sinon des syllabes de synthèse), abîmée exprès par FFmpeg.
//   node outils/essai-son.mjs
// Aucun réseau, aucune IA. Tout est écrit dans un dossier temporaire.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-essai-son-'));
const ICI = path.dirname(fileURLToPath(import.meta.url));
const S = await import('../lib/son.mjs');
const {FFMPEG, FFPROBE} = await import('../lib/outils.mjs');

let ok = 0;
let ko = 0;
const essai = (nom, vrai, detail = '') => { if (vrai) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`); } };
const ff = (args) => execFileSync(FFMPEG, ['-v', 'error', '-y', ...args]);
const duree = (f) => Number(String(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f])).trim());
/** Le signal en 8 kHz, mono (pour mesurer). */
const pcm = (f, debut = 0, d = null) => {
  const b = execFileSync(FFMPEG, ['-v', 'error', '-ss', String(debut), '-i', f, ...(d ? ['-t', String(d)] : []), '-ac', '1', '-ar', '8000', '-f', 's16le', 'pipe:1'], {maxBuffer: 1 << 28});
  const x = new Float32Array(b.length / 2);
  for (let i = 0; i < x.length; i++) x[i] = b.readInt16LE(i * 2) / 32768;
  return x;
};
const rmsDb = (x) => { let s = 0; for (const v of x) s += v * v; return 10 * Math.log10(s / Math.max(1, x.length) + 1e-12); };
/** Le retard (ms) de b sur a, d'après leurs enveloppes à la milliseconde (−50 à +200 ms). */
function retardMs(a, b) {
  const env = (x) => { const n = Math.floor(x.length / 8); const e = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < 8; k++) s += Math.abs(x[i * 8 + k]); e[i] = s; } return e; };
  const ea = env(a);
  const eb = env(b);
  let mieux = 0;
  let val = -Infinity;
  for (let d = -50; d <= 200; d++) {
    let s = 0;
    for (let i = 60; i < Math.min(ea.length, eb.length) - 260; i++) s += ea[i] * eb[i + d];
    if (s > val) { val = s; mieux = d; }
  }
  return mieux;
}

console.log('Une voix d’essai, abîmée exprès');
const propre = path.join(tmp, 'propre.wav');
const say = spawnSync('say', ['-o', path.join(tmp, 'voix.aiff'), 'Bonjour à tous. On visite aujourd’hui l’atelier, où chaque pièce est faite à la main, puis contrôlée avant de partir chez les clients.']);
if (say.status === 0) ff(['-i', path.join(tmp, 'voix.aiff'), '-af', 'apad=pad_dur=1', '-ar', '48000', '-ac', '1', propre]);
else ff(['-f', 'lavfi', '-i', 'sine=f=180:d=5', '-af', "volume='if(lt(mod(t,0.5),0.3),1,0)':eval=frame,apad=pad_dur=1", '-ar', '48000', '-ac', '1', propre]);
const abime = path.join(tmp, 'abime.wav');
// écho de la pièce, aigus coupés, souffle de ventilation
ff(['-i', propre, '-f', 'lavfi', '-i', `anoisesrc=color=pink:amplitude=0.012:d=${duree(propre)}`, '-filter_complex',
  '[0:a]aecho=0.8:0.6:60|130|210:0.45|0.3|0.2,lowpass=f=3500[v];[v][1:a]amix=inputs=2:normalize=0:duration=first', '-ar', '48000', '-ac', '1', abime]);
essai('la voix abîmée existe', fs.existsSync(abime) && duree(abime) > 3);

console.log('La voix claire (normal)');
const clair = path.join(tmp, 'clair.wav');
const r = await S.voixClaire(abime, clair, {force: 'normal'});
essai('le fichier est écrit', fs.existsSync(clair));
essai('même durée, à la milliseconde', Math.abs(duree(clair) - duree(abime)) < 0.002, `${duree(clair)} contre ${duree(abime)}`);
// avec DeepFilterNet (s'il est installé), le souffle part par lui, sans afftdn : il compense lui-même son retard
const avecDfn = /DeepFilterNet/.test(r.moteur);
essai(avecDfn ? 'DeepFilterNet : aucun retard à retirer (il compense le sien)' : 'le décalage des filtres a été mesuré (25 ms par passe de afftdn)', avecDfn ? r.decalage_ms <= 5 : r.decalage_ms >= 15 && r.decalage_ms <= 40, `${r.decalage_ms} ms`);
if (avecDfn) essai('DeepFilterNet en « normal » : 30 dB d’atténuation au plus (la voix garde son caractère)', r.fait.some((x) => /DeepFilterNet, 30 dB au plus/.test(x)), r.fait.join(', '));
const ret = retardMs(pcm(abime), pcm(clair));
essai('le son reste synchrone avec l’image (moins de 5 ms)', Math.abs(ret) <= 5, `${ret} ms`);
essai('volume d’une voix : −16 LUFS (±1)', Math.abs(r.apres.lufs + 16) <= 1, `${r.apres.lufs}`);
essai('crêtes sous −0,9 dBTP', r.apres.crete_dbtp <= -0.9, `${r.apres.crete_dbtp}`);
const fin = duree(abime);
const souffleAvant = rmsDb(pcm(abime, fin - 0.7, 0.6)) - rmsDb(pcm(abime, 0.5, fin - 2));
const souffleApres = rmsDb(pcm(clair, fin - 0.7, 0.6)) - rmsDb(pcm(clair, 0.5, fin - 2));
essai('le souffle baisse d’au moins 8 dB par rapport à la voix', souffleAvant - souffleApres >= 8, `${souffleAvant.toFixed(1)} → ${souffleApres.toFixed(1)} dB`);
essai('ce qui a été fait est dit', r.fait.length >= 3 && r.fait.some((x) => /souffle/.test(x)));

console.log('La voix claire (fort)');
const fort = path.join(tmp, 'fort.flac');
const rf = await S.voixClaire(abime, fort, {force: 'fort'});
const souffleFort = rmsDb(pcm(fort, fin - 0.7, 0.6)) - rmsDb(pcm(fort, 0.5, fin - 2));
essai('« fort » retire plus de souffle que « normal »', souffleFort < souffleApres - 3, `${souffleApres.toFixed(1)} → ${souffleFort.toFixed(1)} dB`);
essai(avecDfn ? '« fort » reste synchrone (DeepFilterNet sans limite)' : '« fort » reste synchrone (deux passes de afftdn, décalage retiré)', Math.abs(retardMs(pcm(abime), pcm(fort))) <= 5 && (avecDfn ? rf.fait.some((x) => /DeepFilterNet\)/.test(x)) : rf.decalage_ms >= 40), rf.fait.join(', '));
essai('« fort » en FLAC, même durée', /flac/.test(String(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', fort]))) && Math.abs(duree(fort) - fin) < 0.002);

console.log('Un passage seul, l’écho');
const passage = path.join(tmp, 'passage.wav');
await S.voixClaire(abime, passage, {force: 'doux', debut: 1, duree: 2.5});
essai('un passage de 2,5 s sort à 2,5 s', Math.abs(duree(passage) - 2.5) < 0.002, `${duree(passage)}`);
if (await S.echoPossible()) {
  const echo = path.join(tmp, 'echo.wav');
  const re = await S.voixClaire(abime, echo, {force: 'normal', echo: true});
  essai('l’écho est réduit (WPE)', re.fait.includes('écho réduit'));
  essai('avec l’écho réduit, même durée et synchrone', Math.abs(duree(echo) - fin) < 0.002 && Math.abs(retardMs(pcm(abime), pcm(echo))) <= 5);
  // la vitesse : 20 s de stéréo (deux canaux différents). Les sommes écrites terme à terme (einsum) en prenaient une
  // vingtaine de secondes ; en produits de matrices, une à deux.
  const {PYTHON} = await import('../lib/moteurs.mjs');
  const stereo = path.join(tmp, 'stereo-20s.wav');
  ff(['-stream_loop', '4', '-i', abime, '-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.02:d=20', '-filter_complex',
    '[0:a]atrim=0:20,asetpts=N/SR/TB[g];[0:a]atrim=0:20,asetpts=N/SR/TB,adelay=7[d0];[d0][1:a]amix=inputs=2:normalize=0:duration=first[d];[g][d]amerge=inputs=2', '-ar', '48000', '-c:a', 'pcm_f32le', stereo]);
  const sansEcho = path.join(tmp, 'stereo-sans-echo.wav');
  const t0 = Date.now();
  const pe = spawnSync(PYTHON, [path.join(ICI, 'echo.py'), stereo, sansEcho], {encoding: 'utf8'});
  const secondes = (Date.now() - t0) / 1000;
  const canaux = (f) => Number(String(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'stream=channels', '-of', 'csv=p=0', f])).trim());
  essai('l’écho de 20 s de stéréo est réduit en moins de 10 s', pe.status === 0 && secondes < 10, `${secondes.toFixed(1)} s ${pe.stderr.slice(-200)}`);
  essai('… deux canaux, la même durée, et la progression dite', pe.status === 0 && canaux(sansEcho) === 2 && Math.abs(duree(sansEcho) - duree(stereo)) < 0.002 && /progress=100%/.test(pe.stderr), `${duree(sansEcho)} contre ${duree(stereo)}`);
} else console.log('  · (réduction d’écho non essayée : pas de Python avec numpy ici)');

console.log('Le mixage');
const musique = path.join(tmp, 'musique.wav');
// une « musique » à 55 Hz : sous la voix claire (coupée sous 80 Hz), elle se mesure sans que la voix s'y mêle
ff(['-f', 'lavfi', '-i', 'sine=f=55:d=8', '-ar', '48000', '-ac', '2', musique]);
const voixCourte = path.join(tmp, 'voix-courte.wav');
ff(['-i', clair, '-t', '3', voixCourte]);
const plan = {duree: 8, pistes: [{fichier: voixCourte, role: 'voix', debut: 1}, {fichier: musique, role: 'musique', longueur: 8, fondu_sortie: 1}]};
const mix = path.join(tmp, 'mix.wav');
const rm = await S.mixer(plan, mix);
essai('le mixage sort à −14 LUFS (±1)', Math.abs(rm.lufs + 14) <= 1, `${rm.lufs}`);
essai('crêtes sous −0,9 dBTP', rm.crete_dbtp <= -0.9, `${rm.crete_dbtp}`);
essai('la durée demandée (8 s)', Math.abs(duree(mix) - 8) < 0.01, `${duree(mix)}`);
essai('la musique est réglée d’après la voix', rm.ducking === true && Number.isFinite(rm.voix_lufs) && rm.musique?.[0]?.sous_la_voix_db === 15, JSON.stringify(rm.musique));
// la musique seule (le son à 55 Hz) : là où la voix parle (1,5 à 3,5 s), puis dans le silence d'après (5 à 6,5 s)
const bande = (f, a, d) => { const o = path.join(tmp, `b${a}-${path.basename(f)}`); ff(['-ss', String(a), '-i', f, '-t', String(d), '-af', 'lowpass=f=70:poles=2,lowpass=f=70:poles=2', '-ar', '48000', o]); return rmsDb(pcm(o)); };
const pendant = bande(mix, 1.5, 2);
const apres = bande(mix, 5, 1.5);
essai('dans les silences, la musique remonte (+6 dB)', apres - pendant >= 4.5 && apres - pendant <= 8, `${(apres - pendant).toFixed(1)} dB`);
// le gain calculé est bien celui qui est appliqué : la musique d'origine + son gain + la mise à −14 LUFS
const attendu = bande(musique, 1.5, 2) + rm.musique[0].gain_db + rm.normalisation_db;
essai('pendant qu’on parle, la musique est au gain calculé (±1,5 dB)', Math.abs(pendant - attendu) <= 1.5, `${pendant.toFixed(1)} contre ${attendu.toFixed(1)} dB`);
const mixFixe = path.join(tmp, 'mix-fixe.wav');
const rf2 = await S.mixer({...plan, ducking: false, pistes: [plan.pistes[0], {...plan.pistes[1], gain_db: -6}]}, mixFixe);
const pf = bande(mixFixe, 1.5, 2);
const af = bande(mixFixe, 5, 1.5);
essai('« ducking »: false garde la musique telle quelle (gain_db, sans remontée)', rf2.ducking === false && Math.abs(af - pf) < 1.5, `${(af - pf).toFixed(1)} dB`);

console.log('Les effets d’une piste (étouffer, couper)');
const bruit = path.join(tmp, 'bruit.wav');
ff(['-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.2:d=8', '-ar', '48000', '-ac', '2', bruit]);
const aigus = (f, a, d) => { const o = path.join(tmp, `h${a}-${path.basename(f)}`); ff(['-ss', String(a), '-i', f, '-t', String(d), '-af', 'highpass=f=3000:poles=2,highpass=f=3000:poles=2', '-ar', '48000', o]); return rmsDb(pcm(o)); };
const graves = (f, a, d) => { const o = path.join(tmp, `g${a}-${path.basename(f)}`); ff(['-ss', String(a), '-i', f, '-t', String(d), '-af', 'lowpass=f=200:poles=2,lowpass=f=200:poles=2', '-ar', '48000', o]); return rmsDb(pcm(o)); };
const etouffe = path.join(tmp, 'etouffe.wav');
await S.mixer({duree: 8, pistes: [{fichier: bruit, role: 'musique', effets: [{type: 'etouffer', de: 2, a: 4.5}]}]}, etouffe);
essai('« etouffer » retire les aigus sur le passage (au moins 15 dB)', aigus(etouffe, 5.5, 1.5) - aigus(etouffe, 2.8, 1) >= 15, `${(aigus(etouffe, 5.5, 1.5) - aigus(etouffe, 2.8, 1)).toFixed(1)} dB`);
essai('… et garde les graves (moins de 4 dB d’écart)', Math.abs(graves(etouffe, 5.5, 1.5) - graves(etouffe, 2.8, 1)) < 4, `${(graves(etouffe, 5.5, 1.5) - graves(etouffe, 2.8, 1)).toFixed(1)} dB`);
const coupe = path.join(tmp, 'coupe.wav');
await S.mixer({duree: 8, pistes: [{fichier: bruit, role: 'musique', effets: [{type: 'couper', de: 2, a: 4.5}]}]}, coupe);
essai('« couper » fait le silence sur le passage (au moins 40 dB plus bas)', rmsDb(pcm(coupe, 5.5, 1.5)) - rmsDb(pcm(coupe, 2.8, 1)) >= 40, `${(rmsDb(pcm(coupe, 5.5, 1.5)) - rmsDb(pcm(coupe, 2.8, 1))).toFixed(1)} dB`);
let refus = null;
try { await S.mixer({duree: 5, pistes: []}, path.join(tmp, 'x.wav')); } catch (e) { refus = e.message; }
essai('un plan sans piste est refusé clairement', /aucune piste/.test(refus ?? ''));

console.log('Les mesures');
const b1 = await S.bilanSon(mix);
essai('un mixage à −14 LUFS est bon', b1.ok === true, JSON.stringify(b1.conseils));
const bas = path.join(tmp, 'bas.wav');
ff(['-i', clair, '-af', 'volume=-12dB', bas]);
const b2 = await S.bilanSon(bas);
essai('un son trop bas est signalé', !b2.ok && b2.conseils.some((x) => /bas/.test(x)));

console.log('La commande derush-son');
const cmd = (args) => spawnSync(process.execPath, [path.join(ICI, 'derush-son.mjs'), ...args], {encoding: 'utf8'});
const c1 = cmd(['mesurer', mix]);
let j1 = null;
try { j1 = JSON.parse(c1.stdout); } catch { /* pas du JSON */ }
essai('derush-son mesurer répond en JSON', c1.status === 0 && j1?.lufs != null);
const c2 = cmd(['clair']);
essai('derush-son clair sans fichier : une erreur claire, code 1', c2.status === 1 && /Usage/.test(c2.stdout));
const c3 = cmd(['inconnue']);
essai('une commande inconnue est refusée', c3.status === 1 && /clair, mixer, mesurer/.test(c3.stdout));

// Ce qu'une IA en bac à sable (ou un projet reçu) peut écrire ne doit jamais faire écrire, servir ni effacer Dérush
// ailleurs. Dans un autre processus : un dossier de Dérush, un dossier personnel et une bibliothèque de sons d'essai.
console.log('Les vrais sons et les créations : ce qu’une IA ou un projet reçu peut écrire');
{
  const x = path.join(tmp, 'garde');
  const maison = path.join(x, 'maison');
  const outil = path.join(x, 'outil-earshot');
  const faux = path.join(outil, '.venv', 'bin', 'earshot');
  for (const d of [path.join(maison, 'Library', 'LaunchAgents'), path.join(maison, '.cache', 'earshot'), path.dirname(faux), path.join(x, 'sons'), path.join(x, 'projet', 'creations')]) fs.mkdirSync(d, {recursive: true});
  fs.writeFileSync(faux, '#!/bin/sh\nexit 0\n', {mode: 0o755});
  fs.writeFileSync(path.join(x, 'sons', 'a.wav'), 'x');
  // un faux Real SFX, dont l'index s'écrit là où Dérush le lui dit
  const rs = path.join(x, 'support', 'competences', 'real-sfx');
  fs.mkdirSync(path.join(rs, 'scripts'), {recursive: true});
  fs.writeFileSync(path.join(rs, 'SKILL.md'), '# Real SFX');
  fs.writeFileSync(path.join(rs, 'scripts', 'mix.py'), '');
  fs.writeFileSync(path.join(rs, 'scripts', 'build_index.py'), "import os\nopen(os.environ['REAL_SFX_INDEX'], 'w').write('{\"sounds\": []}')\n");
  const enfant = path.join(x, 'enfant.mjs');
  fs.writeFileSync(enfant, `
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [racine, x] = process.argv.slice(2);
const imp = (f) => import(pathToFileURL(path.join(racine, f)).href);
const S = await imp('lib/sons.mjs');
const E = await imp('lib/elevenlabs.mjs');
const maison = process.env.HOME;
const r = {};
S.changerSons(true);
const ecritsAvec = (fichier, maisonDite) => {
  fs.writeFileSync(path.join(S.DOSSIER_ETAT_SONS, fichier), JSON.stringify({chemin: process.env.DERUSH_EARSHOT, maison: maisonDite, modeles: true, quand: new Date().toISOString()}));
  S.oublierEarshot();
  return S.ecritsSons();
};
r.etatHorsIA = !S.ecritsSons().includes(S.DOSSIER_ETAT_SONS);
const lanceurs = path.join(maison, 'Library', 'LaunchAgents');
const ouvre = (e, d) => e.some((y) => y === d || d.startsWith(y + path.sep));
r.ancienFichier = !ouvre(ecritsAvec('earshot.json', maison), maison);
r.maison = !ouvre(ecritsAvec('etat-earshot.json', maison), maison);
r.lanceurs = !ouvre(ecritsAvec('etat-earshot.json', lanceurs), lanceurs);
r.programme = !ouvre(ecritsAvec('etat-earshot.json', path.join(x, 'outil-earshot')), process.env.DERUSH_EARSHOT);
r.cacheGarde = ecritsAvec('etat-earshot.json', path.join(maison, '.cache', 'earshot')).includes(path.join(maison, '.cache', 'earshot'));
// des liens posés par l'IA dans le dossier de Real SFX, vers des fichiers que Dérush réécrirait hors du bac à sable
const etat = S.ecritsSons().find((d) => d.endsWith(path.join('sons', 'real-sfx')));
for (const [f, cible] of [['real-sfx-config.json', '.zshrc'], ['real-sfx-index.json', '.profile']]) {
  fs.writeFileSync(path.join(maison, cible), 'garde');
  fs.rmSync(path.join(etat, f), {force: true});
  fs.symlinkSync(path.join(maison, cible), path.join(etat, f));
}
r.indexRefait = await S.indexerSons();
r.victimes = ['.zshrc', '.profile'].every((f) => fs.readFileSync(path.join(maison, f), 'utf8') === 'garde');
r.vraisFichiers = ['real-sfx-config.json', 'real-sfx-index.json'].every((f) => fs.lstatSync(path.join(etat, f)).isFile());
// un creations.json venu d'ailleurs
const P = {racine: path.join(x, 'projet')};
const C = path.join(P.racine, 'creations');
fs.writeFileSync(path.join(x, 'dehors.txt'), 'garde');
fs.writeFileSync(path.join(x, 'dehors2.txt'), 'garde');
fs.symlinkSync(path.join(x, 'dehors2.txt'), path.join(C, 'C2-lien.mp3'));
fs.writeFileSync(path.join(C, 'C3-son.mp3'), 'son');
fs.writeFileSync(path.join(C, 'creations.json'), JSON.stringify({compteur: 3, creations: [
  {id: 'C1', type: 'musique', titre: 'Musique cool', etat: 'pret', fichier: '../../dehors.txt'},
  {id: 'C2', type: 'musique', titre: 'Lien', etat: 'pret', fichier: 'C2-lien.mp3'},
  {id: 'C3', type: 'musique', titre: 'Vrai', etat: 'pret', fichier: 'C3-son.mp3'}]}));
const L = E.listerCreations(P);
const de = (id) => L.find((c) => c.id === id);
r.horsProjet = de('C1')?.chemin === null && de('C1')?.etat === 'erreur' && de('C2')?.chemin === null;
r.vraieCreation = de('C3')?.chemin === path.join(C, 'C3-son.mp3');
E.retirerCreation(P, 'C1');
E.retirerCreation(P, 'C2');
E.retirerCreation(P, 'C3');
r.rienEffaceDehors = fs.existsSync(path.join(x, 'dehors.txt')) && fs.existsSync(path.join(x, 'dehors2.txt'));
r.creationEffacee = !fs.existsSync(path.join(C, 'C3-son.mp3'));
// des lignes que Dérush n'a pas écrites : un numéro qui n'est pas « C » suivi d'un nombre, un état inconnu, un titre qui n'est pas du texte
const P2 = {racine: path.join(x, 'projet2')};
fs.mkdirSync(path.join(P2.racine, 'creations'), {recursive: true});
fs.writeFileSync(path.join(P2.racine, 'creations', 'creations.json'), JSON.stringify({compteur: 9, creations: [
  {id: '../../x', type: 'musique', titre: 'Piège', etat: 'erreur'},
  {id: 'C1/medias', type: 'musique', titre: 'Piège', etat: 'erreur'},
  {id: 7, type: 'musique', titre: 'Piège', etat: 'erreur'},
  {id: 'C4', type: 'musique', titre: 'Piège', etat: 'bizarre'},
  {id: 'C5', type: 'musique', titre: {html: '<img src=x>'}, etat: 'erreur'},
  {id: 'C6', type: 'musique', titre: 'Vraie', etat: 'erreur', erreur: 'Échec.'}]}));
r.creationsPiegees = E.listerCreations(P2).map((c) => c.id);
console.log(JSON.stringify(r));
`);
  const env = {...process.env, HOME: maison, DERUSH_SUPPORT: path.join(x, 'support'), DERUSH_BIBLIOTHEQUE: path.join(x, 'bib'), DERUSH_SONS: path.join(x, 'sons'), DERUSH_EARSHOT: faux, DERUSH_SANS_NAVIGATEUR: '1', DERUSH_SANS_MAJ: '1'};
  for (const k of ['TREG_TOKEN', 'ELEVENLABS_API_KEY', 'XDG_DATA_HOME', 'XDG_STATE_HOME']) delete env[k];
  const e = spawnSync(process.execPath, [enfant, path.join(ICI, '..'), x], {encoding: 'utf8', env});
  let j = {};
  try { j = JSON.parse(e.stdout.trim().split('\n').pop()); } catch { /* pas du JSON */ }
  const pb = `${e.status} ${e.stdout.slice(-300)} ${e.stderr.slice(-300)}`;
  essai('le dossier où Dérush note Earshot n’est pas donné en écriture à l’IA', j.etatHorsIA === true, pb);
  essai('un earshot.json réécrit par une IA n’ouvre pas le dossier personnel', j.ancienFichier === true, pb);
  essai('Earshot dit « le dossier personnel » : refusé', j.maison === true, pb);
  essai('Earshot dit « ~/Library/LaunchAgents » : refusé (pas un dossier d’Earshot)', j.lanceurs === true, pb);
  essai('Earshot dit « le dossier de son propre programme » : refusé', j.programme === true, pb);
  essai('~/.cache/earshot reste donné (Earshot garde ses calculs)', j.cacheGarde === true, pb);
  essai('des liens posés dans le dossier de Real SFX : Dérush ne réécrit pas ~/.zshrc ni ~/.profile', j.indexRefait === true && j.victimes === true && j.vraisFichiers === true, pb);
  essai('une création dont le fichier sort du projet (« ../ », lien) : ni servie ni reliée', j.horsProjet === true && j.vraieCreation === true, pb);
  essai('« Supprimer » n’efface rien hors du projet, et efface bien une vraie création', j.rienEffaceDehors === true && j.creationEffacee === true, pb);
  essai('creations.json réécrit : seules les lignes de Dérush sont listées (numéro « C… », état connu, titre en texte)', JSON.stringify(j.creationsPiegees) === '["C6"]', `${JSON.stringify(j.creationsPiegees)} ${pb}`);
}

// Sous Windows, cmd.exe lit un .cmd dans la page de code de la console : « Dérush » ou « Hélène » écrits en UTF-8 n'y sont
// plus le même chemin. Les commandes de son partent donc du dossier des commandes (« %~dp0 »).
console.log('Les commandes de son sous Windows : des chemins sans accent');
{
  const x = path.join(tmp, 'windows');
  const sup = path.join(x, 'Hélène', 'Dérush');
  const enfant = path.join(x, 'enfant.mjs');
  fs.mkdirSync(x, {recursive: true});
  fs.writeFileSync(enfant, `
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [racine, sup] = process.argv.slice(2);
const S = await import(pathToFileURL(path.join(racine, 'lib', 'sons.mjs')).href);
const py = path.join(sup, 'moteurs', 'python', 'python.exe');
const e = {actif: true, realsfx: {ok: true}, earshot: {ok: true, derush: true, chemin: path.join(sup, 'moteurs', 'earshot', '.venv', 'Scripts', 'earshot.exe')}};
console.log(JSON.stringify({py, t: S.textesCommandesSons(e, py)}));
`);
  const env = {...process.env, HOME: path.join(x, 'maison'), DERUSH_SUPPORT: sup, DERUSH_BIBLIOTHEQUE: path.join(x, 'bib'), DERUSH_SONS: path.join(x, 'sons'), DERUSH_SANS_NAVIGATEUR: '1', DERUSH_SANS_MAJ: '1'};
  for (const k of ['TREG_TOKEN', 'ELEVENLABS_API_KEY', 'XDG_DATA_HOME', 'XDG_STATE_HOME']) delete env[k];
  const e = spawnSync(process.execPath, [enfant, path.join(ICI, '..'), sup], {encoding: 'utf8', env});
  let j = {};
  try { j = JSON.parse(e.stdout.trim().split('\n').pop()); } catch { /* pas du JSON */ }
  const t = j.t ?? {};
  const cmds = ['sons-openverse', 'real-sfx', 'earshot'].map((n) => t[n]?.cmd ?? '');
  essai('les trois commandes .cmd sont en ASCII, même dans « Hélène\\Dérush »', cmds.every((c) => c && /^[\x00-\x7f]*$/.test(c)), `${e.status} ${cmds.join(' | ')} ${e.stderr.slice(-300)}`);
  essai('real-sfx : le Python et Real SFX partent du dossier des commandes', /set "DERUSH_REALSFX=%~dp0\.\.\\competences\\real-sfx"/.test(cmds[1]) && cmds[1].includes('"%~dp0..\\moteurs\\python\\python.exe" -c'), cmds[1]);
  essai('earshot : le programme et son dossier aussi', cmds[2].includes('set "EARSHOT_HOME=%~dp0..\\moteurs\\earshot\\cache"') && cmds[2].includes('"%~dp0..\\moteurs\\earshot\\.venv\\Scripts\\earshot.exe" %*'), cmds[2]);
  essai('sons-openverse : le Python aussi', cmds[0].startsWith('@echo off') && cmds[0].includes('"%~dp0..\\moteurs\\python\\python.exe" "'), cmds[0]);
  essai('sur Mac et Linux, rien ne change (chemins entiers)', !!j.py && t['real-sfx']?.sh?.includes(`exec "${j.py}" -c`), t['real-sfx']?.sh);
}

fs.rmSync(tmp, {recursive: true, force: true});
console.log(`\n${ok} essais réussis sur ${ok + ko}.`);
process.exit(ko ? 1 : 0);
