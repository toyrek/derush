// Dérush — l'analyse des médias : ce que la section « Médias » sait de chaque rush, sans qu'il soit dans la timeline.
//
// 1. Les mesures, faites toutes seules à l'import (sur l'ordinateur, sans IA) : l'image (exposition, contraste,
//    saturation, dominante de couleur, tournage probable en Log) et le son (souffle, voix étouffée, écho). Elles
//    donnent les pastilles des vignettes et guident l'IA (elle n'a plus à tout remesurer).
// 2. L'analyse par l'IA, à la demande (« Analyser ») : l'IA regarde une planche d'images et lit le texte de chaque
//    rush, puis décrit ce qu'il contient, ses meilleurs moments et ses défauts. Le résultat reste dans le projet et part
//    dans le dossier de l'IA à chaque demande : elle ne revoit plus tout depuis le début.
import fs from 'node:fs';
import path from 'node:path';
import {ffmpeg, lancer, FFMPEG, ecrireJson, lireJson, POLICE_GRAS} from './outils.mjs';
import {arrondi} from './commun.mjs';
import {fichierLecture} from './medias.mjs';
import {lireMots} from './transcription.mjs';
import {lancerConseil, etatConseil, arreterConseil} from './conseil.mjs';
import {profilSuggere} from './couleurs.mjs';

const mediane = (l) => { const t = l.filter(Number.isFinite).sort((a, b) => a - b); return t.length ? t[Math.floor(t.length / 2)] : null; };

// ——— 1. Les mesures ———

/** Huit images réparties dans le rush : niveaux de gris (ombres, moyenne, hautes lumières), saturation, dominante. */
async function mesuresImage(P, m) {
  const f = fichierLecture(P, m);
  const n = m.type === 'image' ? 1 : 8;
  const vues = [];
  for (let k = 0; k < n; k++) {
    const t = m.type === 'image' ? 0 : (m.duree * (k + 0.5)) / n;
    try {
      const {out} = await lancer(FFMPEG, ['-v', 'error', ...(m.type === 'image' ? [] : ['-ss', t.toFixed(3)]), '-i', f, '-frames:v', '1',
        '-vf', 'scale=320:-2,format=yuv420p,signalstats,metadata=print:file=-', '-f', 'null', '-']);
      const v = {};
      for (const [, cle, val] of String(out).matchAll(/lavfi\.signalstats\.(YMIN|YLOW|YAVG|YHIGH|YMAX|SATAVG|UAVG|VAVG)=([0-9.]+)/g)) v[cle] = Number(val);
      if (v.YAVG != null) vues.push(v);
    } catch { /* image illisible à cet endroit : on passe */ }
  }
  if (!vues.length) return null;
  // l'aperçu est en 8 bits, plage « TV » (16 à 235) : on ramène tout entre 0 et 1
  const y = (x) => Math.max(0, Math.min(1, (x - 16) / 219));
  const exposition = mediane(vues.map((v) => y(v.YAVG)));
  const ombres = mediane(vues.map((v) => y(v.YLOW)));
  const lumieres = mediane(vues.map((v) => y(v.YHIGH)));
  const saturation = mediane(vues.map((v) => v.SATAVG / 90));
  const bleu = mediane(vues.map((v) => v.UAVG - 128));
  const rouge = mediane(vues.map((v) => v.VAVG - 128));
  const brule = vues.filter((v) => y(v.YMAX) > 0.995 && y(v.YHIGH) > 0.93).length / vues.length;
  const contraste = lumieres - ombres;
  return {exposition: arrondi(exposition, 3), ombres: arrondi(ombres, 3), hautes_lumieres: arrondi(lumieres, 3), contraste: arrondi(contraste, 3),
    saturation: arrondi(saturation, 3), dominante: {bleu: arrondi(bleu, 1), rouge: arrondi(rouge, 1)}, part_brulee: arrondi(brule, 2), images: vues.length};
}

/** L'énergie de la voix dans les aigus (2,5 à 8 kHz) par rapport au bas médium (150 Hz à 1 kHz) : basse = voix étouffée. */
async function brillance(m) {
  try {
    const {err} = await ffmpeg(['-hide_banner', '-nostats', '-i', m.chemin, '-filter_complex',
      '[0:a:0]aformat=channel_layouts=mono,asplit[h][b];[h]highpass=f=2500:poles=2,lowpass=f=8000:poles=2,astats=measure_overall=RMS_level:measure_perchannel=none[hs];[b]highpass=f=150:poles=2,lowpass=f=1000:poles=2,astats=measure_overall=RMS_level:measure_perchannel=none[bs]',
      '-map', '[hs]', '-f', 'null', '-', '-map', '[bs]', '-f', 'null', '-'], {duree: m.duree});
    const niveaux = [...String(err).matchAll(/Parsed_astats_(\d+).*?RMS level dB:\s*(-?[0-9.]+|-inf)/gs)].map((x) => [Number(x[1]), x[2] === '-inf' ? -120 : Number(x[2])]);
    if (niveaux.length < 2) return null;
    niveaux.sort((a, b) => a[0] - b[0]);
    return arrondi(niveaux[0][1] - niveaux[1][1], 1);
  } catch { return null; }
}

/**
 * Le souffle (le bruit de fond entre les phrases) et l'écho (ce qui traîne après la fin des mots), lus sur la courbe du
 * son (ondes.json : un niveau de crête toutes les 10 ms) et sur le texte mot à mot.
 */
function souffleEtEcho(P, m) {
  const o = lireJson(path.join(P.cache, 'medias', m.id, 'ondes.json'));
  if (!o?.niveaux?.length) return {};
  const db = (n) => n * 0.6 - 60; // 0..100 → −60..0 dBFS
  const tri = [...o.niveaux].sort((a, b) => a - b);
  const fond = db(tri[Math.floor(tri.length * 0.1)]);
  const voix = db(tri[Math.floor(tri.length * 0.9)]);
  const res = {fond_dbfs: arrondi(fond, 1), voix_dbfs: arrondi(voix, 1)};
  const mots = (lireMots(P, m) ?? []).filter((w) => !w.ev && Number.isFinite(w.f));
  if (mots.length > 8) {
    const niveau = (t) => o.niveaux[Math.min(o.niveaux.length - 1, Math.max(0, Math.round(t * o.pps)))];
    const traines = [];
    for (let i = 0; i < mots.length - 1; i++) {
      const w = mots[i];
      if (mots[i + 1].d - w.f < 0.45) continue; // pas de pause après ce mot
      const pic = Math.max(...Array.from({length: 12}, (_, k) => niveau(w.f - 0.12 + k * 0.01)));
      const apres = Array.from({length: 18}, (_, k) => niveau(w.f + 0.1 + k * 0.01));
      traines.push(db(mediane(apres)) - db(pic));
    }
    if (traines.length >= 3) res.traine_db = arrondi(mediane(traines), 1);
  }
  return res;
}

/** Les défauts qu'on peut nommer simplement (les pastilles des vignettes, et ce que l'IA lit en premier). */
function defauts(im, son, m) {
  const d = [];
  if (im) {
    if (im.log_probable) d.push({id: 'log', court: 'Log', texte: 'Image grise et plate : sans doute filmé en Log. À convertir (Couleurs de la caméra).'});
    else if (im.contraste < 0.42 && im.saturation < 0.3) d.push({id: 'terne', court: 'Terne', texte: 'Image plate et peu saturée : un peu de contraste et de couleur lui ferait du bien.'});
    if (im.exposition < 0.24) d.push({id: 'sombre', court: 'Sombre', texte: 'Image sombre : à éclaircir.'});
    if (im.part_brulee >= 0.5) d.push({id: 'brule', court: 'Brûlé', texte: 'Les hautes lumières sont brûlées (blanc pur) sur une bonne partie du rush.'});
    const {bleu, rouge} = im.dominante;
    if (Math.max(Math.abs(bleu), Math.abs(rouge)) > 10 && !im.log_probable) {
      const chaud = rouge > 3 && bleu < -3;
      const froid = bleu > 3 && rouge < -3;
      d.push({id: 'dominante', court: chaud ? 'Trop chaud' : froid ? 'Trop froid' : rouge < 0 && bleu < 0 ? 'Vert' : 'Magenta', texte: `Dominante ${chaud ? 'orangée' : froid ? 'bleutée' : rouge < 0 && bleu < 0 ? 'verte' : 'magenta'} : la balance des blancs est à corriger.`});
    }
  }
  if (son && m.audio) {
    // de la parole : le texte le dit ; sans texte, un son qui s'arrête et repart (des silences entre les phrases)
    const parle = (m.transcription?.mots ?? 0) > 5 || (!m.transcription && (m.analyse?.silences ?? 0) >= 2 && son.voix_dbfs != null && son.voix_dbfs > -40);
    if (son.voix_dbfs != null && son.voix_dbfs < -30) d.push({id: 'faible', court: 'Son faible', texte: 'Le son est très bas : à remonter.'});
    // seuils calés sur de vrais rushes (voix filmée en intérieur : écart voix/fond de 11 à 29 dB, aigus de −11 à −16 dB)
    if (parle && son.fond_dbfs != null && son.voix_dbfs != null && son.voix_dbfs - son.fond_dbfs < 25) d.push({id: 'souffle', court: 'Bruit de fond', texte: 'Bruit de fond audible derrière la voix : à nettoyer (Voix claire).'});
    if (parle && son.brillance_db != null && son.brillance_db < -17) d.push({id: 'etouffe', court: 'Étouffé', texte: 'Voix étouffée (peu d’aigus) : la voix claire la rendra plus nette.'});
    if (parle && son.traine_db != null && son.traine_db > -17) d.push({id: 'echo', court: 'Écho', texte: 'La voix résonne (écho de la pièce) : à réduire (Voix claire, option écho).'});
  }
  return d;
}

/** L'étape « mesures » de la préparation d'un rush. Écrit mesures.json et un résumé dans le projet. */
export async function mesurerMedia(P, m, D, prog = () => {}) {
  const im = m.type === 'audio' ? null : await mesuresImage(P, m);
  prog(0.5);
  if (im && m.type === 'video') {
    const s = profilSuggere(m, im);
    im.log_probable = !!s?.log;
    if (s) im.profil_suggere = s;
  }
  let son = null;
  if (m.audio) {
    son = {...souffleEtEcho(P, m), brillance_db: await brillance(m)};
  }
  prog(0.95);
  const liste = defauts(im, son, m);
  ecrireJson(path.join(D, 'mesures.json'), {v: 1, image: im, son, defauts: liste, cree_le: new Date().toISOString()});
  m.mesures = {defauts: liste.map((x) => ({id: x.id, court: x.court})), ...(im?.profil_suggere ? {profil_suggere: im.profil_suggere.id} : {})};
  return true;
}
/** Les mesures complètes d'un rush (mesures.json), ou null. */
export const lireMesures = (P, m) => lireJson(path.join(P.cache, 'medias', m.id, 'mesures.json'));

// ——— 2. L'analyse par l'IA ———

/** Une planche de 12 images (4 × 3) avec le temps de chacune : ce que l'IA regarde pour décrire un rush. */
export async function planche(P, m) {
  const D = P.dossierMedia(m.id);
  const sortie = path.join(D, 'planche.jpg');
  if (fs.existsSync(sortie) && fs.statSync(sortie).mtimeMs > (m.planche_v ?? 0)) return sortie;
  const f = fichierLecture(P, m);
  if (m.type === 'image') {
    await ffmpeg(['-y', '-i', f, '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '4', sortie]);
    return sortie;
  }
  if (m.type !== 'video') return null;
  const n = 12;
  const pas = m.duree / n;
  const args = ['-y'];
  for (let k = 0; k < n; k++) args.push('-ss', ((k + 0.5) * pas).toFixed(3), '-i', f);
  const tc = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}\\:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const cases = Array.from({length: n}, (_, k) => `[${k}:v]scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2:color=black,drawtext=fontfile='${POLICE_GRAS}':text='${tc((k + 0.5) * pas)}':fontsize=18:fontcolor=white:box=1:boxcolor=0x000000@0.6:boxborderw=5:x=8:y=h-th-8[c${k}]`);
  args.push('-filter_complex', `${cases.join(';')};${Array.from({length: n}, (_, k) => `[c${k}]`).join('')}xstack=inputs=${n}:layout=${Array.from({length: n}, (_, k) => `${(k % 4) * 320}_${Math.floor(k / 4) * 180}`).join('|')}`,
    '-frames:v', '1', '-q:v', '4', sortie);
  await ffmpeg(args);
  return sortie;
}

const cleIA = (P) => `analyse-medias:${P.racine}`;
const SUIVI = new Map(); // projet → {ids, etat, debut, erreur}
const REGLES = `Tu es l'assistant de dérushage de Dérush, un logiciel de montage vidéo. Un humain t'a confié ses rushes (ses
vidéos, ses sons, ses photos) AVANT de monter : tu les regardes et tu les décris pour lui, et pour l'IA qui montera ensuite.
Tu ne modifies rien, tu ne publies rien. Tu réponds en français simple, au tutoiement.`;

function consigneIA(liste) {
  return `Dans ce dossier, pour chaque média, il y a :
- planches/<ID>.jpg : 12 images réparties dans la vidéo, avec leur temps (minutes:secondes) ;
- textes/<ID>.txt : ce qui est dit, avec le temps de chaque phrase (s'il y a de la parole) ;
- mesures.json : les mesures de Dérush (exposition, contraste, dominante de couleur, Log probable, souffle, voix étouffée, écho).

Les médias à analyser : ${liste.map((m) => `${m.id} (« ${m.nom} », ${m.type === 'image' ? 'photo' : `${Math.round(m.duree)} s`})`).join(', ')}.

Regarde chaque planche, lis chaque texte, puis écris le fichier reponse.json, un objet JSON :
{"medias": {"<ID>": {
  "resume": "ce qu'on voit et ce qui se passe, en une ou deux phrases concrètes",
  "contenu": ["lieux, personnes (sans les nommer), objets, actions : 3 à 8 mots-clés"],
  "moments": [{"debut": secondes, "fin": secondes, "quoi": "ce qui s'y passe", "force": 1 à 5}],
  "defauts": ["ce qui gêne au montage : flou, tremblé, sombre, son sale, coupé… (vide si rien)"],
  "usage": "à quoi ce rush servira le mieux dans une vidéo (accroche, plan de coupe, témoignage, ambiance…)",
  "note": 1 à 5
}}}
Les moments (3 au plus par média) sont les meilleurs passages à garder, avec des temps tirés des planches et des textes.
Ne recopie pas les mesures : sers-t'en pour juger. N'invente rien que tu ne vois pas ou n'entends pas.`;
}
function validerIA(r, ids) {
  const sortie = {};
  const court = (x, n) => String(x ?? '').trim().slice(0, n);
  for (const id of ids) {
    const x = r?.medias?.[id];
    if (!x) continue;
    sortie[id] = {
      resume: court(x.resume, 400),
      contenu: (Array.isArray(x.contenu) ? x.contenu : []).map((c) => court(c, 40)).filter(Boolean).slice(0, 10),
      moments: (Array.isArray(x.moments) ? x.moments : []).map((mo) => ({debut: arrondi(Number(mo?.debut) || 0, 2), fin: arrondi(Number(mo?.fin) || 0, 2), quoi: court(mo?.quoi, 160), force: Math.min(5, Math.max(1, Math.round(Number(mo?.force) || 3)))})).filter((mo) => mo.fin > mo.debut).slice(0, 4),
      defauts: (Array.isArray(x.defauts) ? x.defauts : []).map((c) => court(c, 140)).filter(Boolean).slice(0, 5),
      usage: court(x.usage, 200),
      note: Math.min(5, Math.max(1, Math.round(Number(x.note) || 3))),
    };
  }
  if (!Object.keys(sortie).length) throw new Error('L’analyse rendue est vide. Réessaie.');
  return sortie;
}

/** Lance l'analyse par l'IA de quelques médias (ou de tous). Rend la main tout de suite ; suivre avec etatAnalyseIA(). */
export async function lancerAnalyseIA(P, ids, {moteur = null, qualite = 'rapide'} = {}) {
  const k = cleIA(P);
  if (SUIVI.get(k)?.etat === 'en_cours') throw new Error('Une analyse est déjà en cours.');
  const liste = (ids?.length ? ids : P.d.medias.map((m) => m.id)).map((id) => P.d.medias.find((m) => m.id === id)).filter((m) => m && m.etat !== 'erreur');
  if (!liste.length) throw new Error('Choisis au moins un média prêt.');
  if (liste.length > 40) throw new Error('Quarante médias au plus par analyse : choisis-en une partie.');
  const suivi = {ids: liste.map((m) => m.id), etat: 'en_cours', debut: Date.now(), erreur: null, etape: 'Dérush prépare les planches'};
  SUIVI.set(k, suivi);
  (async () => {
    const D = path.join(P.cache, 'analyse-ia');
    fs.rmSync(D, {recursive: true, force: true});
    for (const s of ['planches', 'textes']) fs.mkdirSync(path.join(D, s), {recursive: true});
    const mesures = {};
    for (const m of liste) {
      const pl = await planche(P, m).catch(() => null);
      if (pl) fs.copyFileSync(pl, path.join(D, 'planches', `${m.id}.jpg`));
      const mots = (lireMots(P, m) ?? []).filter((w) => !w.ev);
      if (mots.length) {
        // le texte par phrases d'environ 12 mots, avec le temps de la première
        const lignes = [];
        for (let i = 0; i < mots.length; i += 12) lignes.push(`[${arrondi(mots[i].d, 1)} s] ${mots.slice(i, i + 12).map((w) => w.t).join(' ').trim()}`);
        fs.writeFileSync(path.join(D, 'textes', `${m.id}.txt`), lignes.join('\n'));
      }
      mesures[m.id] = {nom: m.nom, type: m.type, duree_s: arrondi(m.duree, 1), ...(lireMesures(P, m) ?? {})};
    }
    ecrireJson(path.join(D, 'mesures.json'), mesures);
    suivi.etape = null;
    await new Promise((ok, ko) => lancerConseil({cle: k, dossier: D, consigne: consigneIA(liste), systeme: REGLES, moteur, qualite, attendu: 'reponse.json', delaiMs: 20 * 60000,
      valider: (r) => validerIA(r, suivi.ids), surFin: (err, reponse, c) => {
        if (err) return ko(err);
        const quand = new Date().toISOString();
        for (const [id, a] of Object.entries(reponse)) {
          const m = P.d.medias.find((x) => x.id === id);
          if (!m) continue;
          ecrireJson(path.join(P.dossierMedia(id), 'ia.json'), {...a, moteur: c.moteur, cree_le: quand});
          m.ia = {resume: a.resume, note: a.note, moments: a.moments.length, cree_le: quand};
        }
        P.sauver();
        ok();
      }}));
    suivi.etat = 'fini';
  })().catch((e) => { suivi.etat = 'erreur'; suivi.erreur = e.message; });
}
export function etatAnalyseIA(P) {
  const k = cleIA(P);
  const s = SUIVI.get(k);
  if (!s) return null;
  const c = etatConseil(k);
  return {etat: s.etat, ids: s.ids, depuis_s: Math.round((Date.now() - s.debut) / 1000), erreur: s.erreur ?? c?.erreur ?? null,
    etape: s.etape ?? c?.etapes?.at(-1)?.texte ?? null, nom_ia: c?.nom_ia ?? null};
}
export function arreterAnalyseIA(P) { arreterConseil(cleIA(P)); SUIVI.delete(cleIA(P)); }
export function oublierAnalyseIA(P) { if (SUIVI.get(cleIA(P))?.etat !== 'en_cours') SUIVI.delete(cleIA(P)); }
/** L'analyse par l'IA d'un rush (ia.json), ou null. */
export const lireAnalyseIA = (P, m) => lireJson(path.join(P.cache, 'medias', m.id, 'ia.json'));
