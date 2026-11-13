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
essai('le décalage des filtres a été mesuré (25 ms par passe de afftdn)', r.decalage_ms >= 15 && r.decalage_ms <= 40, `${r.decalage_ms} ms`);
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
essai('« fort » reste synchrone (deux passes de afftdn, décalage retiré)', Math.abs(retardMs(pcm(abime), pcm(fort))) <= 5 && rf.decalage_ms >= 40);
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
} else console.log('  · (réduction d’écho non essayée : pas de Python avec numpy ici)');

console.log('Le mixage');
const musique = path.join(tmp, 'musique.wav');
// une « musique » à 55 Hz : sous la voix claire (coupée sous 80 Hz), elle se mesure sans que la voix s'y mêle
ff(['-f', 'lavfi', '-i', 'sine=f=55:d=8', '-ar', '48000', '-ac', '2', musique]);
const voixCourte = path.join(tmp, 'voix-courte.wav');
ff(['-i', clair, '-t', '3', voixCourte]);
const plan = {duree: 8, pistes: [{fichier: voixCourte, role: 'voix', debut: 1}, {fichier: musique, role: 'musique', gain_db: -6, longueur: 8, fondu_sortie: 1}]};
const mix = path.join(tmp, 'mix.wav');
const rm = await S.mixer(plan, mix);
essai('le mixage sort à −14 LUFS (±1)', Math.abs(rm.lufs + 14) <= 1, `${rm.lufs}`);
essai('crêtes sous −0,9 dBTP', rm.crete_dbtp <= -0.9, `${rm.crete_dbtp}`);
essai('la durée demandée (8 s)', Math.abs(duree(mix) - 8) < 0.01, `${duree(mix)}`);
essai('la musique est baissée sous la voix', rm.ducking === true);
// la musique seule (le son à 55 Hz) : plus bas pendant la voix (1,5 à 3,5 s) qu'après (5 à 6,5 s)
const bande = (f, a, d) => { const o = path.join(tmp, `b${a}.wav`); ff(['-ss', String(a), '-i', f, '-t', String(d), '-af', 'lowpass=f=70:poles=2,lowpass=f=70:poles=2', '-ar', '48000', o]); return rmsDb(pcm(o)); };
const pendant = bande(mix, 1.5, 2);
const apres = bande(mix, 5, 1.5);
essai('la musique baisse d’au moins 6 dB quand on parle', apres - pendant >= 6, `${(apres - pendant).toFixed(1)} dB`);
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

fs.rmSync(tmp, {recursive: true, force: true});
console.log(`\n${ok} essais réussis sur ${ok + ko}.`);
process.exit(ko ? 1 : 0);
