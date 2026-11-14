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

/**
 * Les forces de nettoyage. « Léger » ne débruite pas : pour une voix déjà nettoyée par le téléphone ou une appli (un
 * débruitage de plus la rend métallique, « moins naturelle »), seulement plus nette. « auto » (voixClaire) mesure le fond
 * sonore et choisit entre « Léger » et « Normal ».
 */
export const FORCES = {
  leger: {nom: 'Léger', aide: 'Voix déjà nettoyée (téléphone, appli) : aucun débruitage, juste plus nette.', chaine: () => [
    'highpass=f=70:poles=2', 'equalizer=f=250:t=q:w=1.0:g=-3', 'equalizer=f=3400:t=q:w=0.9:g=3.5', 'highshelf=f=9000:g=2',
    'deesser=i=0.3:m=0.5:f=0.5', 'acompressor=threshold=-20dB:ratio=2.5:attack=12:release=160:makeup=1.5:knee=4']},
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

/**
 * L'atténuation la plus forte que DeepFilterNet a le droit d'appliquer, selon la force (en dB). Mesuré le 14 nov. 2026
 * sur une voix bruitée exprès (souffle et ronflement de pièce) : sans limite, il retire le plus de souffle mais change
 * un peu le caractère de la voix (ressemblance Earshot 0,56 avec la voix d'origine) ; limité à 30 dB, il en retire
 * presque autant (−40 dB au lieu de −41) et la voix ressemble autant à l'originale que la version bruitée (0,60).
 */
export const ATTENUATION_DFN = {doux: 12, normal: 30, fort: 100};
/** DeepFilterNet (débruitage par réseau de neurones), s'il est installé dans le dossier des moteurs. */
export function deepFilter() {
  const d = path.join(DOSSIER_SUPPORT, 'moteurs', 'deepfilter');
  for (const n of ['deep-filter', 'deep-filter.exe']) { const f = path.join(d, n); if (fs.existsSync(f)) return f; }
  return null;
}
let memoEcho = {t: 0, oui: false, reponse: null};
/**
 * La réduction d'écho (WPE) a-t-elle son Python (numpy, scipy, soundfile) ? La réponse est gardée : « oui » pour de bon,
 * « non » 30 secondes (le temps d'installer le moteur « Voix »). Avant, chaque ouverture de la fiche d'un rush relançait
 * Python pour ces imports, et la fiche attendait.
 */
export function echoPossible() {
  if (!fs.existsSync(PYTHON)) return Promise.resolve(false);
  if (memoEcho.reponse && (memoEcho.oui || Date.now() - memoEcho.t < 30000)) return memoEcho.reponse;
  const m = {t: Date.now(), oui: false, reponse: null};
  m.reponse = lancer(PYTHON, ['-c', 'import numpy, scipy.signal, soundfile']).then(() => { m.oui = true; return true; }, () => false);
  memoEcho = m;
  return m.reponse;
}

/** Mesure intégrée (LUFS), crête vraie (dBTP) et plage de volume (LU) d'un son. */
export async function sonie(f) {
  const {err} = await ffmpeg(['-hide_banner', '-nostats', '-i', f, '-map', '0:a:0', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']);
  const n = (re) => { const x = [...String(err).matchAll(re)].pop(); return x ? Number(x[1]) : null; };
  return {lufs: n(/I:\s*(-?[0-9.]+) LUFS/g), crete_dbtp: n(/Peak:\s*(-?[0-9.]+) dBFS/g), plage_lu: n(/LRA:\s*([0-9.]+) LU/g)};
}
/**
 * L'énergie de la voix dans les aigus (2,5 à 8 kHz) par rapport au bas médium (150 Hz à 1 kHz), en dB. Une voix filmée en
 * intérieur va de −16 à −11 ; sous −17, elle est étouffée ; au-dessus de −8, elle siffle. Mesuré sur la chronique du
 * 13 nov. 2026 : rush −19,7, montage de Fable −13,6, Opus −14,1 puis −16,8 (voix à peine touchée), Sonnet −18,3.
 */
export async function brillance(f, {duree = null} = {}) {
  try {
    const {err} = await ffmpeg(['-hide_banner', '-nostats', '-i', f, '-filter_complex',
      '[0:a:0]aformat=channel_layouts=mono,asplit[h][b];[h]highpass=f=2500:poles=2,lowpass=f=8000:poles=2,astats=measure_overall=RMS_level:measure_perchannel=none[hs];[b]highpass=f=150:poles=2,lowpass=f=1000:poles=2,astats=measure_overall=RMS_level:measure_perchannel=none[bs]',
      '-map', '[hs]', '-f', 'null', '-', '-map', '[bs]', '-f', 'null', '-'], duree ? {duree} : {});
    const niveaux = [...String(err).matchAll(/Parsed_astats_(\d+).*?RMS level dB:\s*(-?[0-9.]+|-inf)/gs)].map((x) => [Number(x[1]), x[2] === '-inf' ? -120 : Number(x[2])]);
    if (niveaux.length < 2) return null;
    niveaux.sort((a, b) => a[0] - b[0]);
    return arrondi(niveaux[0][1] - niveaux[1][1], 1);
  } catch { return null; }
}
/** Ce que la brillance dit d'une voix, en mots simples (null : rien à signaler). */
export function avisBrillance(db) {
  if (db == null) return null;
  if (db < -16) return `Voix un peu sourde (aigus ${String(db).replace('.', ',')} dB ; une voix nette est entre −15 et −11) : derush-son clair, puis compare.`;
  if (db > -8) return `Voix très brillante (aigus ${String(db).replace('.', ',')} dB) : écoute les « s » et les « ch », ils peuvent siffler.`;
  return null;
}

/**
 * Le fond sonore et la voix (dBFS), comme l'analyse à l'import : la crête de chaque tranche de 10 ms (deux premières
 * minutes), puis le 10e et le 90e centile. Un vrai rush filmé en intérieur a 11 à 29 dB entre les deux (une voix de
 * test avec un souffle de ventilation : 28,9) ; 36 dB ou plus : le son a déjà été nettoyé (le téléphone, CapCut…), un
 * débruitage de plus le rendrait métallique. Rush de la chronique du 13 nov. 2026 : 41 dB sur 30 s, 54 dB en entier.
 */
export async function fondSonore(f) {
  try {
    const {out} = await lancer(FFMPEG, ['-v', 'error', '-t', '120', '-i', f, '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1']);
    const b = Buffer.from(out);
    const n = Math.floor(b.length / 2);
    const pas = 160;
    const tous = [];
    for (let i = 0; i + pas <= n; i += pas) {
      let m = 0;
      for (let k = 0; k < pas; k++) m = Math.max(m, Math.abs(b.readInt16LE((i + k) * 2)));
      tous.push(m > 0 ? 20 * Math.log10(m / 32768) : -120);
    }
    // un long silence numérique (2 s ou plus de zéros : la caméra lancée avant le micro, un export, deux prises mises
    // bout à bout) n'est pas le fond sonore du lieu : il n'est pas compté. Les silences courts entre les mots d'une
    // voix déjà nettoyée, eux, le sont : c'est à eux qu'on la reconnaît.
    const niveaux = [];
    for (let i = 0; i < tous.length;) {
      let j = i;
      while (j < tous.length && tous[j] <= -90) j++;
      if (j - i < 200) niveaux.push(...tous.slice(i, Math.max(j, i + 1)));
      i = Math.max(j, i + 1);
    }
    if (niveaux.length < 50) return null;
    const tri = niveaux.sort((x, y) => x - y);
    const q = (p) => tri[Math.min(tri.length - 1, Math.floor(tri.length * p))];
    const fond = arrondi(Math.max(-120, q(0.1)), 1);
    const voix = arrondi(q(0.9), 1);
    return {fond_dbfs: fond, voix_dbfs: voix, ecart_db: arrondi(voix - fond, 1), deja_nettoye: voix - fond >= 36};
  } catch { return null; }
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
export async function voixClaire(entree, sortie, {force = 'auto', echo = false, debut = null, duree = null, prog = () => {}} = {}) {
  // avant tout travail (DeepFilterNet et l'écho prennent du temps) : une sortie que la dernière étape sait écrire
  if (!/\.(wav|flac)$/i.test(String(sortie))) throw new Error('La voix claire s’écrit en .wav ou en .flac.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-voix-'));
  const fait = [];
  let tmpSortie = null;
  try {
    // 1. le son seul, en 48 kHz et en virgule flottante (aucune perte d'une étape à l'autre)
    const brut = path.join(tmp, 'brut.wav');
    try {
      await ffmpeg(['-y', ...(debut != null ? ['-ss', String(debut)] : []), '-i', entree, ...(duree != null ? ['-t', String(duree)] : []), '-map', '0:a:0', '-vn', '-ar', '48000', '-c:a', 'pcm_f32le', brut]);
    } catch (e) {
      if (/matches no streams/i.test(String(e.message))) throw new Error('Ce fichier n’a pas de son.');
      throw e;
    }
    const {out} = await lancer(FFPROBE, ['-v', 'error', '-show_entries', 'stream=duration,channels', '-of', 'json', brut]);
    const info = JSON.parse(String(out)).streams?.[0] ?? {};
    const longueur = Number(info.duration) || null;
    const avant = {...await sonie(brut), brillance_db: await brillance(brut)};
    // « auto » : une voix déjà nettoyée (le téléphone, une appli) n'est plus débruitée, seulement rendue plus nette
    const fond = await fondSonore(brut);
    let pourquoi = null;
    if (!FORCES[force]) {
      force = fond?.deja_nettoye ? 'leger' : 'normal';
      const fr = (x) => String(x).replace('.', ',');
      pourquoi = fond?.deja_nettoye
        ? `fond déjà très bas (${fr(fond.fond_dbfs)} dBFS, ${fr(fond.ecart_db)} dB sous la voix) : la voix a déjà été nettoyée, Dérush la rend seulement plus nette`
        : `fond sonore à ${fr(fond?.fond_dbfs ?? '?')} dBFS : souffle à retirer`;
    }
    const F = FORCES[force];
    avant.fond_dbfs = fond?.fond_dbfs ?? null;
    prog(0.15);
    let courant = brut;
    // 2. l'écho de la pièce (option) : WPE, dans le Python de Dérush
    if (echo) {
      if (await echoPossible()) {
        const sans = path.join(tmp, 'sans-echo.wav');
        // echo.py dit où il en est (« progress=NN% », un morceau de 30 s à la fois) : la barre avance de 15 à 45 %
        await lancer(PYTHON, [path.join(RACINE_APP, 'outils', 'echo.py'), courant, sans], {silenceMax: 1800000,
          surStderr: (s) => { for (const x of s.matchAll(/progress=(\d+)%/g)) prog(0.15 + 0.3 * (Number(x[1]) / 100)); }});
        courant = sans;
        fait.push('écho réduit');
      } else fait.push('écho : moteur absent (installe « Voix » dans Réglages › Moteurs)');
    }
    prog(echo ? 0.45 : 0.25);
    // 3. le souffle : DeepFilterNet s'il est là, sinon afftdn dans la chaîne (rien en « Léger »)
    const dfn = force === 'leger' ? null : deepFilter();
    if (force === 'leger') fait.push('aucun débruitage (voix déjà propre)');
    else if (dfn) {
      const d = path.join(tmp, 'dfn');
      fs.mkdirSync(d);
      // DeepFilterNet écrit en 16 bits : un son très fort (crêtes au-dessus de −6 dBFS) est d'abord baissé, sinon ses
      // crêtes seraient écrêtées ; le volume d'une voix est remis à la fin (étape 6)
      let entreeDfn = courant;
      if (avant.crete_dbtp != null && avant.crete_dbtp > -6) {
        entreeDfn = path.join(tmp, 'pour-dfn.wav');
        await ffmpeg(['-y', '-i', courant, '-af', `volume=${(-6 - avant.crete_dbtp).toFixed(2)}dB`, '-c:a', 'pcm_f32le', entreeDfn]);
      }
      await lancer(dfn, ['-D', '-a', String(ATTENUATION_DFN[force] ?? 30), '-o', d, entreeDfn], {silenceMax: 1800000});
      const f = fs.readdirSync(d).find((x) => x.endsWith('.wav'));
      if (f) { courant = path.join(d, f); fait.push(`souffle retiré (DeepFilterNet${ATTENUATION_DFN[force] < 100 ? `, ${ATTENUATION_DFN[force]} dB au plus` : ''})`); }
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
    tmpSortie = `${sortie}.part${path.extname(sortie)}`;
    await ffmpeg(['-y', '-i', cale, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:level=false:attack=3:release=60`, ...(/\.flac$/i.test(sortie) ? ['-c:a', 'flac'] : ['-c:a', 'pcm_s24le']), tmpSortie]);
    fs.renameSync(tmpSortie, sortie);
    tmpSortie = null;
    prog(0.95);
    const apres = {...await sonie(sortie), brillance_db: await brillance(sortie)};
    return {sortie, force, ...(pourquoi ? {pourquoi} : {}), echo, decalage_ms: decalage, avant, apres, fait, moteur: dfn ? 'DeepFilterNet + FFmpeg' : 'FFmpeg',
      ...(avisBrillance(apres.brillance_db) ? {avis: avisBrillance(apres.brillance_db)} : {})};
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
    // une écriture ratée ne laisse pas de fichier « .part » à côté de la sortie
    if (tmpSortie) fs.rmSync(tmpSortie, {force: true});
  }
}

/** Une fenêtre douce en expression FFmpeg : 0 hors de [a, b], 1 dedans, rampes de r1 s à l'entrée et r2 s à la sortie. */
const fenetre = (a, b, r1 = 0.3, r2 = 0.3) => `clip(min((t-${a.toFixed(3)})/${r1},(${b.toFixed(3)}-t)/${r2}),0,1)`;

/** Les silences d'un son (silencedetect) : [[debut, fin], …], la fin du fichier comptant comme fin du dernier. */
async function silences(f, seuilDb, minS, duree) {
  const {err} = await ffmpeg(['-i', f, '-af', `silencedetect=noise=${seuilDb}dB:d=${minS}`, '-f', 'null', '-']);
  const r = [];
  let debut = null;
  for (const l of String(err).split('\n')) {
    const a = /silence_start:\s*(-?[0-9.]+)/.exec(l);
    const b = /silence_end:\s*(-?[0-9.]+)/.exec(l);
    if (a) debut = Math.max(0, Number(a[1]));
    if (b && debut != null) { r.push([debut, Number(b[1])]); debut = null; }
  }
  if (debut != null) r.push([debut, duree]);
  return r;
}

/** Les effets posés sur une piste, dans le temps de la vidéo : étouffée, coupée, plus forte ou plus faible sur un passage. */
function effetsPiste(effets, entree, sortie, n) {
  const l = (Array.isArray(effets) ? effets : []).map((e) => ({type: String(e.type ?? ''), de: Number(e.de), a: Number(e.a), db: Number(e.db ?? 0)}))
    .filter((e) => Number.isFinite(e.de) && Number.isFinite(e.a) && e.a > e.de && ['etouffer', 'couper', 'volume'].includes(e.type));
  if (!l.length) return [`${entree}anull[${sortie}]`];
  const somme = (x) => x.map((e) => fenetre(e.de, e.a, Math.min(0.3, (e.a - e.de) / 3), Math.min(0.3, (e.a - e.de) / 3))).join('+');
  const f = [];
  let cur = entree;
  const etouffe = l.filter((e) => e.type === 'etouffer');
  if (etouffe.length) {
    // le son comme derrière un mur : les aigus partent, en fondu, et reviennent à la fin du passage
    const W = `min(1,${somme(etouffe)})`;
    f.push(`${cur}asplit=2[sec${n}][mur${n}]`, `[mur${n}]lowpass=f=650,lowpass=f=650,volume='0.85*(${W})':eval=frame[murb${n}]`, `[sec${n}]volume='1-(${W})':eval=frame[secb${n}]`, `[secb${n}][murb${n}]amix=inputs=2:normalize=0[etf${n}]`);
    cur = `[etf${n}]`;
  }
  const coupe = l.filter((e) => e.type === 'couper');
  const vol = l.filter((e) => e.type === 'volume' && e.db);
  if (coupe.length || vol.length) {
    const facteurs = [...(coupe.length ? [`(1-min(1,${somme(coupe)}))`] : []), ...vol.map((e) => `pow(10,${e.db}*${fenetre(e.de, e.a, Math.min(0.3, (e.a - e.de) / 3), Math.min(0.3, (e.a - e.de) / 3))}/20)`)];
    f.push(`${cur}volume='${facteurs.join('*')}':eval=frame[eff${n}]`);
    cur = `[eff${n}]`;
  }
  f.push(`${cur}anull[${sortie}]`);
  return f;
}

/**
 * Le mixage d'une vidéo : des pistes (voix, musique, effets, ambiance) posées dans le temps, la musique réglée d'après
 * la voix, puis le tout au volume des réseaux (−14 LUFS, crête à −1 dBTP).
 * plan = {duree, cible_lufs?, ducking?, musique_sous_voix_db?, remontee_db?,
 *         pistes: [{fichier, role: voix|musique|effet|ambiance, debut?, gain_db?, entree?, longueur?, fondu_entree?, fondu_sortie?,
 *                   effets?: [{type: etouffer|couper|volume, de, a, db?}]}]}
 * Avec une voix et une musique (sauf « ducking »: false) : la musique est mesurée puis posée « musique_sous_voix_db »
 * (15 par défaut) sous la voix pendant qu'on parle, et remonte de « remontee_db » (6) dans les silences de plus d'une
 * seconde ; son « gain_db » l'ajuste encore (+3 = un peu plus présente). Avec « ducking »: false, chaque piste garde
 * exactement son « gain_db ». Les « effets » d'une piste sont en temps de la vidéo. « fondu_sortie » finit là où la
 * piste s'arrête vraiment : à sa « longueur », à la fin de son fichier, ou à la fin de la vidéo (le premier des trois).
 * Sortie : .wav, .m4a, .aac ou .mp4.
 */
export async function mixer(plan, sortie, {base = process.cwd()} = {}) {
  const pistes = (plan?.pistes ?? []).filter((p) => p?.fichier);
  if (!pistes.length) throw new Error('Le plan de mixage n’a aucune piste.');
  const duree = Number(plan.duree);
  if (!(duree > 0)) throw new Error('Donne la durée de la vidéo (« duree », en secondes).');
  const cible = Number.isFinite(Number(plan.cible_lufs)) ? Number(plan.cible_lufs) : -14;
  const sousVoix = Number.isFinite(Number(plan.musique_sous_voix_db)) ? Number(plan.musique_sous_voix_db) : 15;
  const remontee = Number.isFinite(Number(plan.remontee_db)) ? Number(plan.remontee_db) : 6;
  // une sortie que FFmpeg sait écrire ici, dit avant tout travail (un .mp3 échouait à la fin, en anglais, sur un fichier vide)
  if (!/\.(wav|m4a|aac|mp4)$/i.test(String(sortie))) throw new Error('Le mixage s’écrit en .wav, .m4a, .aac ou .mp4.');
  for (const p of pistes) if (!fs.existsSync(path.resolve(base, p.fichier))) throw new Error(`Fichier introuvable : ${p.fichier}`);
  // la durée du fichier des pistes qui ont un fondu de sortie : il doit finir là où le son s'arrête vraiment
  const dureeFichier = new Map();
  for (const p of pistes) {
    if (!(Number(p.fondu_sortie) > 0) || dureeFichier.has(p.fichier)) continue;
    try {
      const {out} = await lancer(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.resolve(base, p.fichier)]);
      if (Number(String(out).trim()) > 0) dureeFichier.set(p.fichier, Number(String(out).trim()));
    } catch { /* durée illisible : on fera avec la longueur et la fin de la vidéo */ }
  }
  /** Le temps pendant lequel on entend la piste : sa « longueur », ce qui reste de son fichier, ou jusqu'à la fin de la vidéo. */
  const finPiste = (p) => Math.min(Number(p.longueur) > 0 ? Number(p.longueur) : Infinity,
    (dureeFichier.get(p.fichier) ?? Infinity) - (Number(p.entree) || 0), duree - (Number(p.debut) || 0));
  // la chaîne d'une piste : lue, mise au format, fondus, gain, posée à son temps
  const chaine = (p, i, gain) => {
    const ch = [`[${i}:a:0]aresample=48000`, 'aformat=channel_layouts=stereo'];
    if (p.fondu_entree) ch.push(`afade=t=in:d=${Number(p.fondu_entree)}`);
    const fin = finPiste(p);
    if (Number(p.fondu_sortie) > 0 && Number.isFinite(fin) && fin > 0) ch.push(`afade=t=out:st=${Math.max(0, fin - Number(p.fondu_sortie)).toFixed(3)}:d=${Math.min(fin, Number(p.fondu_sortie)).toFixed(3)}`);
    if (gain) ch.push(`volume=${Number(gain).toFixed(2)}dB`);
    if (p.debut) ch.push(`adelay=${Math.round(Number(p.debut) * 1000)}:all=1`);
    return ch.join(',');
  };
  const entrees = (liste) => liste.flatMap((p) => [...(p.entree ? ['-ss', String(p.entree)] : []), ...(p.longueur ? ['-t', String(p.longueur)] : []), '-i', path.resolve(base, p.fichier)]);
  const voix = pistes.filter((p) => p.role === 'voix');
  const musiques = pistes.filter((p) => p.role === 'musique');
  const auto = !!(voix.length && musiques.length && plan.ducking !== false);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-mix-'));
  try {
    // 1. la voix seule (toutes les voix posées dans le temps) : son volume, et ses silences
    let voixLufs = null;
    let pauses = [];
    const infosMusique = [];
    if (auto) {
      const fv = path.join(tmp, 'voix.wav');
      const fl = voix.map((p, i) => `${chaine(p, i, p.gain_db)}[v${i}]`);
      fl.push(`${voix.map((_, i) => `[v${i}]`).join('')}amix=inputs=${voix.length}:normalize=0:duration=longest,apad=whole_dur=${duree.toFixed(4)},atrim=end=${duree.toFixed(4)}[v]`);
      await ffmpeg(['-y', ...entrees(voix), '-filter_complex', fl.join(';'), '-map', '[v]', '-t', duree.toFixed(4), '-c:a', 'pcm_f32le', fv]);
      voixLufs = (await sonie(fv)).lufs;
      if (voixLufs != null && voixLufs > -60) {
        // un silence de la voix : 26 dB sous son volume moyen, pendant plus d'une seconde
        pauses = (await silences(fv, Math.max(-60, Math.round(voixLufs - 26)), 1, duree)).filter(([a, b]) => b - a >= 1);
        // 2. chaque musique, mesurée telle qu'elle sera jouée, puis posée sous la voix
        for (const p of musiques) {
          const fm = path.join(tmp, `m${infosMusique.length}.wav`);
          await ffmpeg(['-y', ...entrees([p]), '-filter_complex', `${chaine({...p, debut: 0}, 0, 0)}[m]`, '-map', '[m]', '-t', duree.toFixed(4), '-c:a', 'pcm_f32le', fm]);
          const lm = (await sonie(fm)).lufs;
          const gain = lm != null && lm > -70 ? voixLufs - sousVoix - lm + Number(p.gain_db ?? 0) : Number(p.gain_db ?? 0);
          infosMusique.push({fichier: p.fichier, niveau_lufs: lm, gain_db: Math.round(gain * 10) / 10, sous_la_voix_db: Math.round((sousVoix - Number(p.gain_db ?? 0)) * 10) / 10});
        }
      } else infosMusique.push(...musiques.map((p) => ({fichier: p.fichier, niveau_lufs: null, gain_db: Number(p.gain_db ?? 0), sous_la_voix_db: null})));
    }
    // 3. le mixage
    const args = ['-y', ...entrees(pistes)];
    const etiquettes = {voix: [], musique: [], autre: []};
    const filtres = [];
    let km = 0;
    pistes.forEach((p, i) => {
      const estMusique = p.role === 'musique';
      const info = auto && estMusique ? infosMusique[km++] : null;
      filtres.push(`${chaine(p, i, info ? 0 : p.gain_db)}[c${i}]`);
      filtres.push(...effetsPiste(p.effets, `[c${i}]`, `e${i}`, i));
      if (info) {
        // la musique sous la voix, et qui remonte dans les silences (fondus : 0,6 s pour monter, 0,25 s pour redescendre
        // juste avant que la voix revienne)
        const montees = pauses.map(([a, b]) => fenetre(a <= 0.05 ? -10 : a + 0.15, b >= duree - 0.05 ? duree + 10 : b - 0.05, 0.6, 0.25));
        filtres.push(montees.length && remontee
          ? `[e${i}]volume='pow(10,(${info.gain_db.toFixed(2)}+${remontee}*min(1,${montees.join('+')}))/20)':eval=frame[p${i}]`
          : `[e${i}]volume=${info.gain_db.toFixed(2)}dB[p${i}]`);
      } else filtres.push(`[e${i}]anull[p${i}]`);
      (p.role === 'voix' ? etiquettes.voix : estMusique ? etiquettes.musique : etiquettes.autre).push(`[p${i}]`);
    });
    const somme = (l, nom) => (l.length === 1 ? filtres.push(`${l[0]}anull[${nom}]`) : filtres.push(`${l.join('')}amix=inputs=${l.length}:normalize=0:duration=longest[${nom}]`));
    const sorties = [];
    if (etiquettes.voix.length) { somme(etiquettes.voix, 'voix'); sorties.push('[voix]'); }
    if (etiquettes.musique.length) { somme(etiquettes.musique, 'mus'); sorties.push('[mus]'); }
    if (etiquettes.autre.length) { somme(etiquettes.autre, 'autres'); sorties.push('[autres]'); }
    // un remplissage fini et une durée imposée : avec « apad » sans fin, FFmpeg écrit parfois du silence sans s'arrêter
    filtres.push(`${sorties.join('')}amix=inputs=${sorties.length}:normalize=0:duration=longest,apad=whole_dur=${duree.toFixed(4)},atrim=end=${duree.toFixed(4)}[mix]`);
    const brut = path.join(tmp, 'mix.wav');
    await ffmpeg([...args, '-filter_complex', filtres.join(';'), '-map', '[mix]', '-t', duree.toFixed(4), '-c:a', 'pcm_f32le', brut]);
    const m = await sonie(brut);
    const gain = m.lufs != null && m.lufs > -70 ? cible - m.lufs : 0;
    const fichier = path.resolve(base, sortie);
    fs.mkdirSync(path.dirname(fichier), {recursive: true});
    // écrit à côté puis renommé : une erreur en route ne laisse pas une sortie tronquée à la place de l'ancienne
    const partiel = `${fichier}.part${path.extname(fichier)}`;
    try {
      await ffmpeg(['-y', '-i', brut, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:level=false:attack=3:release=60`, '-c:a', /\.wav$/i.test(sortie) ? 'pcm_s24le' : 'aac', ...(/\.wav$/i.test(sortie) ? [] : ['-b:a', '256k']), partiel]);
      fs.renameSync(partiel, fichier);
    } finally { fs.rmSync(partiel, {force: true}); }
    const final = await sonie(fichier);
    return {sortie: fichier, cible_lufs: cible, ...final, pistes: pistes.length, ducking: auto, normalisation_db: Math.round(gain * 100) / 100,
      ...(auto ? {voix_lufs: voixLufs, musique: infosMusique, silences_de_la_voix: pauses.length, remontee_db: remontee} : {})};
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
  // la voix : assez d'aigus pour qu'on la comprenne sans effort (mesuré sur tout le son, musique comprise)
  const b = await brillance(f);
  if (avisBrillance(b)) conseils.push(avisBrillance(b));
  return {...s, brillance_db: b, ok: !conseils.length, conseils};
}
export {arrondi};
