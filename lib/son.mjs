// Dérush — le son d'un montage : la voix claire, l'écho réduit, les mesures, le mixage.
//
// « Voix claire » (sur l'ordinateur, sans IA) : un nettoyage du souffle et du bruit de fond (FFmpeg afftdn, ou
// DeepFilterNet s'il est installé), une réduction de l'écho de la pièce en option (WPE, dans le Python de Dérush), puis
// une chaîne de studio : coupe des graves inutiles, voix désembouée et rendue plus présente, sifflantes adoucies,
// compression douce, volume au niveau d'une voix (−16 LUFS). Le son reste exactement synchrone : le décalage que
// prennent certains filtres (25 ms par passe de afftdn) est mesuré puis retiré, et la durée est gardée à l'échantillon.
//
// Mesuré sur une voix abîmée exprès (souffle de pièce, écho de 0,9 s, aigus coupés) : le souffle entre les phrases
// baisse de 13 dB (normal) à 23 dB (fort), la voix retrouve les aigus de la voix d'origine, la traîne d'écho après les
// mots baisse de 7 dB de plus avec l'option écho.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg, lancer, FFMPEG, FFPROBE} from './outils.mjs';
import {PYTHON, RACINE_APP, DOSSIER_SUPPORT} from './moteurs.mjs';
import {arrondi} from './commun.mjs';

/** Les trois forces de nettoyage. `passes` : combien de fois afftdn passe (chaque passe retire du souffle). */
export const FORCES = {
  doux: {nom: 'Doux', aide: 'Retire le souffle léger, garde l’ambiance.', chaine: (dfn) => [
    'highpass=f=70:poles=2', dfn ? null : 'afftdn=nr=10:nf=-46:tn=1',
    'equalizer=f=250:t=q:w=1.0:g=-1.5', 'equalizer=f=3400:t=q:w=0.9:g=2', 'highshelf=f=9000:g=1',
    'deesser=i=0.25:m=0.5:f=0.5', 'acompressor=threshold=-22dB:ratio=2:attack=15:release=180:makeup=1.5:knee=4']},
  normal: {nom: 'Normal', aide: 'Le bon réglage pour une voix filmée : souffle retiré, voix claire et posée.', chaine: (dfn) => [
    'highpass=f=80:poles=2', dfn ? null : 'afftdn=nr=18:nf=-40:tn=1',
    'agate=threshold=0.012:ratio=2:attack=4:release=150:range=0.25:knee=2',
    'equalizer=f=250:t=q:w=1.0:g=-3', 'equalizer=f=3400:t=q:w=0.9:g=3.5', 'highshelf=f=9000:g=2',
    'deesser=i=0.35:m=0.5:f=0.5', 'acompressor=threshold=-20dB:ratio=3:attack=12:release=160:makeup=2:knee=4']},
  fort: {nom: 'Fort', aide: 'Pour un son très sale (rue, salle, ventilation) : silence net entre les phrases.', chaine: (dfn) => [
    'highpass=f=90:poles=2', dfn ? null : 'afftdn=nr=26:nf=-38:tn=1', dfn ? null : 'afftdn=nr=10:nf=-50:tn=1',
    'agate=threshold=0.015:ratio=3:attack=3:release=120:range=0.12:knee=2',
    'equalizer=f=250:t=q:w=1.0:g=-3.5', 'equalizer=f=3400:t=q:w=0.9:g=4', 'highshelf=f=9000:g=2.5',
    'deesser=i=0.4:m=0.5:f=0.5', 'acompressor=threshold=-20dB:ratio=3.5:attack=10:release=150:makeup=2.5:knee=4']},
};
export const VOIX_LUFS = -16; // une voix seule, prête à être mixée (la vidéo finale vise −14)

/** DeepFilterNet (débruitage par réseau de neurones), s'il est installé dans le dossier des moteurs. */
export function deepFilter() {
  const d = path.join(DOSSIER_SUPPORT, 'moteurs', 'deepfilter');
  for (const n of ['deep-filter', 'deep-filter.exe']) { const f = path.join(d, n); if (fs.existsSync(f)) return f; }
  return null;
}
/** La réduction d'écho (WPE) a-t-elle son Python (numpy, scipy) ? */
export async function echoPossible() {
  if (!fs.existsSync(PYTHON)) return false;
  try { await lancer(PYTHON, ['-c', 'import numpy, scipy.signal']); return true; } catch { return false; }
}

/** Mesure intégrée (LUFS), crête vraie (dBTP) et plage de volume (LU) d'un son. */
export async function sonie(f) {
  const {err} = await ffmpeg(['-hide_banner', '-nostats', '-i', f, '-map', '0:a:0', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']);
  const n = (re) => { const x = [...String(err).matchAll(re)].pop(); return x ? Number(x[1]) : null; };
  return {lufs: n(/I:\s*(-?[0-9.]+) LUFS/g), crete_dbtp: n(/Peak:\s*(-?[0-9.]+) dBFS/g), plage_lu: n(/LRA:\s*([0-9.]+) LU/g)};
}
/** L'enveloppe d'un son (valeur absolue moyenne par milliseconde, sur les 90 premières secondes), pour le recaler. */
async function enveloppe(f) {
  const {out} = await lancer(FFMPEG, ['-v', 'error', '-t', '90', '-i', f, '-map', '0:a:0', '-ac', '1', '-ar', '8000', '-f', 's16le', 'pipe:1']);
  const b = Buffer.from(out);
  const n = Math.floor(b.length / 16);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < 8; k++) s += Math.abs(b.readInt16LE((i * 8 + k) * 2)); e[i] = s / 8; }
  return e;
}
/** Le retard (en ms) du son `b` sur le son `a` : là où leurs enveloppes se ressemblent le plus (0 à 200 ms). */
async function retard(a, b) {
  const [ea, eb] = await Promise.all([enveloppe(a), enveloppe(b)]);
  const n = Math.min(ea.length, eb.length) - 200;
  if (n < 500) return 0;
  const moy = (e) => { let s = 0; for (let i = 0; i < n; i++) s += e[i]; return s / n; };
  const ma = moy(ea);
  const mb = moy(eb);
  let mieux = 0;
  let val = -Infinity;
  for (let d = 0; d <= 200; d++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += (ea[i] - ma) * (eb[i + d] - mb);
    if (s > val) { val = s; mieux = d; }
  }
  return mieux;
}

/**
 * La voix claire : `entree` (une vidéo ou un son) → `sortie` (.wav ou .flac), même durée, parfaitement synchrone.
 * Options : force (doux, normal, fort), echo (réduire l'écho), debut/duree (un passage seulement).
 * Renvoie les mesures avant/après et ce qui a été fait.
 */
export async function voixClaire(entree, sortie, {force = 'normal', echo = false, debut = null, duree = null, prog = () => {}} = {}) {
  const F = FORCES[force] ?? FORCES.normal;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-voix-'));
  const fait = [];
  try {
    // 1. le son seul, en 48 kHz et en virgule flottante (aucune perte d'une étape à l'autre)
    const brut = path.join(tmp, 'brut.wav');
    await ffmpeg(['-y', ...(debut != null ? ['-ss', String(debut)] : []), '-i', entree, ...(duree != null ? ['-t', String(duree)] : []), '-map', '0:a:0', '-vn', '-ar', '48000', '-c:a', 'pcm_f32le', brut]);
    const {out} = await lancer(FFPROBE, ['-v', 'error', '-show_entries', 'stream=duration,channels', '-of', 'json', brut]);
    const info = JSON.parse(String(out)).streams?.[0] ?? {};
    const longueur = Number(info.duration) || null;
    const avant = await sonie(brut);
    prog(0.15);
    let courant = brut;
    // 2. l'écho de la pièce (option) : WPE, dans le Python de Dérush
    if (echo) {
      if (await echoPossible()) {
        const sans = path.join(tmp, 'sans-echo.wav');
        await lancer(PYTHON, [path.join(RACINE_APP, 'outils', 'echo.py'), courant, sans], {silenceMax: 1800000});
        courant = sans;
        fait.push('écho réduit');
      } else fait.push('écho : moteur absent (installe « Voix » dans Réglages › Moteurs)');
    }
    prog(echo ? 0.45 : 0.25);
    // 3. le souffle : DeepFilterNet s'il est là, sinon afftdn dans la chaîne
    const dfn = deepFilter();
    if (dfn) {
      const d = path.join(tmp, 'dfn');
      fs.mkdirSync(d);
      await lancer(dfn, ['-D', '-o', d, courant], {silenceMax: 1800000});
      const f = fs.readdirSync(d).find((x) => x.endsWith('.wav'));
      if (f) { courant = path.join(d, f); fait.push('souffle retiré (DeepFilterNet)'); }
    } else fait.push('souffle retiré');
    prog(0.6);
    // 4. la chaîne de studio, avec une seconde de silence en plus (certains filtres gardent la fin pour eux)
    const traite = path.join(tmp, 'traite.wav');
    await ffmpeg(['-y', '-i', courant, '-af', [...F.chaine(!!dfn).filter(Boolean), 'apad=pad_dur=1'].join(','), '-c:a', 'pcm_f32le', traite]);
    fait.push('voix désembouée et plus présente', 'sifflantes adoucies', 'compression douce');
    prog(0.75);
    // 5. le décalage pris par les filtres, retiré : la voix reste sur les lèvres
    const decalage = await retard(brut, traite);
    const cale = path.join(tmp, 'cale.wav');
    await ffmpeg(['-y', '-i', traite, '-af', `atrim=start=${(decalage / 1000).toFixed(4)},asetpts=PTS-STARTPTS${longueur ? `,atrim=end=${longueur.toFixed(6)}` : ''}`, '-c:a', 'pcm_f32le', cale]);
    // 6. le volume d'une voix (gain fixe, sans pomper) et un limiteur pour les crêtes
    const m = await sonie(cale);
    const gain = m.lufs != null && m.lufs > -70 ? VOIX_LUFS - m.lufs : 0;
    fs.mkdirSync(path.dirname(sortie), {recursive: true});
    const tmpSortie = `${sortie}.part${path.extname(sortie)}`;
    await ffmpeg(['-y', '-i', cale, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:level=false:attack=3:release=60`, ...(/\.flac$/i.test(sortie) ? ['-c:a', 'flac'] : ['-c:a', 'pcm_s24le']), tmpSortie]);
    fs.renameSync(tmpSortie, sortie);
    prog(0.95);
    const apres = await sonie(sortie);
    return {sortie, force, echo, decalage_ms: decalage, avant, apres, fait, moteur: dfn ? 'DeepFilterNet + FFmpeg' : 'FFmpeg'};
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}

/**
 * Le mixage d'une vidéo : des pistes (voix, musique, effets, ambiance) posées dans le temps, la musique qui se baisse
 * toute seule sous la voix, puis le tout au volume des réseaux (−14 LUFS, crête à −1 dBTP).
 * plan = {duree, cible_lufs?, ducking?, pistes: [{fichier, role: voix|musique|effet|ambiance, debut?, gain_db?, entree?, longueur?, fondu_entree?, fondu_sortie?}]}
 */
export async function mixer(plan, sortie, {base = process.cwd()} = {}) {
  const pistes = (plan?.pistes ?? []).filter((p) => p?.fichier);
  if (!pistes.length) throw new Error('Le plan de mixage n’a aucune piste.');
  const duree = Number(plan.duree);
  if (!(duree > 0)) throw new Error('Donne la durée de la vidéo (« duree », en secondes).');
  const cible = Number.isFinite(Number(plan.cible_lufs)) ? Number(plan.cible_lufs) : -14;
  const args = ['-y'];
  const etiquettes = {voix: [], musique: [], autre: []};
  const filtres = [];
  pistes.forEach((p, i) => {
    const f = path.resolve(base, p.fichier);
    if (!fs.existsSync(f)) throw new Error(`Fichier introuvable : ${p.fichier}`);
    args.push(...(p.entree ? ['-ss', String(p.entree)] : []), ...(p.longueur ? ['-t', String(p.longueur)] : []), '-i', f);
    const ch = [`[${i}:a:0]aresample=48000`, 'aformat=channel_layouts=stereo'];
    if (p.fondu_entree) ch.push(`afade=t=in:d=${Number(p.fondu_entree)}`);
    if (p.fondu_sortie && p.longueur) ch.push(`afade=t=out:st=${Math.max(0, Number(p.longueur) - Number(p.fondu_sortie))}:d=${Number(p.fondu_sortie)}`);
    if (p.gain_db) ch.push(`volume=${Number(p.gain_db)}dB`);
    if (p.debut) ch.push(`adelay=${Math.round(Number(p.debut) * 1000)}:all=1`);
    filtres.push(`${ch.join(',')}[p${i}]`);
    (p.role === 'voix' ? etiquettes.voix : p.role === 'musique' ? etiquettes.musique : etiquettes.autre).push(`[p${i}]`);
  });
  const somme = (l, nom) => (l.length === 1 ? filtres.push(`${l[0]}anull[${nom}]`) : filtres.push(`${l.join('')}amix=inputs=${l.length}:normalize=0:duration=longest[${nom}]`));
  const sorties = [];
  if (etiquettes.voix.length) somme(etiquettes.voix, 'voix');
  if (etiquettes.musique.length) {
    somme(etiquettes.musique, 'mus');
    if (etiquettes.voix.length && plan.ducking !== false) {
      // la musique se baisse d'environ 10 dB quand quelqu'un parle, et remonte doucement après
      // la voix est prolongée de silence jusqu'à la fin : sans cela, la compression s'arrête avec elle et la musique se tait
      filtres.push(`[voix]apad=whole_dur=${duree.toFixed(4)},asplit=2[voixmix][voixcle]`);
      filtres.push('[mus][voixcle]sidechaincompress=threshold=0.012:ratio=20:attack=15:release=600:knee=2[musb]');
      sorties.push('[voixmix]', '[musb]');
    } else sorties.push(...(etiquettes.voix.length ? ['[voix]'] : []), '[mus]');
  } else if (etiquettes.voix.length) sorties.push('[voix]');
  if (etiquettes.autre.length) { somme(etiquettes.autre, 'autres'); sorties.push('[autres]'); }
  filtres.push(`${sorties.join('')}amix=inputs=${sorties.length}:normalize=0:duration=longest,apad,atrim=end=${duree.toFixed(4)}[mix]`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-mix-'));
  try {
    const brut = path.join(tmp, 'mix.wav');
    await ffmpeg([...args, '-filter_complex', filtres.join(';'), '-map', '[mix]', '-c:a', 'pcm_f32le', brut]);
    const m = await sonie(brut);
    const gain = m.lufs != null && m.lufs > -70 ? cible - m.lufs : 0;
    fs.mkdirSync(path.dirname(path.resolve(base, sortie)), {recursive: true});
    await ffmpeg(['-y', '-i', brut, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:level=false:attack=3:release=60`, '-c:a', /\.wav$/i.test(sortie) ? 'pcm_s24le' : 'aac', ...(/\.wav$/i.test(sortie) ? [] : ['-b:a', '256k']), path.resolve(base, sortie)]);
    const final = await sonie(path.resolve(base, sortie));
    return {sortie: path.resolve(base, sortie), cible_lufs: cible, ...final, pistes: pistes.length, ducking: !!(etiquettes.voix.length && etiquettes.musique.length && plan.ducking !== false)};
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}

/** Ce qu'on peut dire d'un son, en mots simples : volume, crêtes, souffle, voix étouffée. */
export async function bilanSon(f) {
  const s = await sonie(f);
  const conseils = [];
  if (s.lufs != null) {
    if (s.lufs < -17) conseils.push(`Trop bas pour les réseaux (${s.lufs} LUFS) : vise −14.`);
    else if (s.lufs > -12) conseils.push(`Trop fort (${s.lufs} LUFS) : vise −14, les réseaux le baisseraient et l’écraseraient.`);
  }
  if (s.crete_dbtp != null && s.crete_dbtp > -1) conseils.push(`Crêtes trop hautes (${s.crete_dbtp} dBTP) : risque de saturation, garde-les sous −1.`);
  return {...s, ok: !conseils.length, conseils};
}
export {arrondi};
