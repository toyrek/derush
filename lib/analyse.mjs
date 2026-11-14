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
import {profilSuggere, cheminFiltre} from './couleurs.mjs';
import {brillance as brillanceSon} from './son.mjs';

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

/** La brillance de la voix (aigus par rapport au bas médium) : la même mesure que lib/son.mjs, sur le rush. */
const brillance = (m) => brillanceSon(m.chemin, {duree: m.duree});

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

/**
 * Le nom d'une dominante de couleur, d'après sa direction sur le cercle des couleurs (bleu = écart du bleu, rouge =
 * écart du rouge, comme les mesure FFmpeg) : le rouge est vers 100°, le jaune vers 175°, le vert vers 230°, le cyan
 * vers 280°, le bleu vers 355°, le magenta vers 50°. Renvoie [la pastille, le mot de la phrase].
 */
export function nomDominante(bleu, rouge) {
  const angle = ((Math.atan2(rouge, bleu) * 180) / Math.PI + 360) % 360;
  if (angle >= 85 && angle < 200) return ['Trop chaud', angle < 150 ? 'orangée' : 'jaune'];
  if (angle >= 200 && angle < 270) return ['Vert', 'verte'];
  if (angle >= 270 || angle < 20) return ['Trop froid', 'bleutée'];
  return ['Magenta', 'magenta'];
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
      const [court, nom] = nomDominante(bleu, rouge);
      d.push({id: 'dominante', court, texte: `Dominante ${nom} : la balance des blancs est à corriger.`});
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
  // le chemin de la police est échappé (sous Windows, « C:/Windows/Fonts/… » coupait le filtre en deux)
  const temps = (k) => `,drawtext=fontfile=${cheminFiltre(POLICE_GRAS)}:text='${tc((k + 0.5) * pas)}':fontsize=18:fontcolor=white:box=1:boxcolor=0x000000@0.6:boxborderw=5:x=8:y=h-th-8`;
  const graphe = (avecTemps) => `${Array.from({length: n}, (_, k) => `[${k}:v]scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2:color=black${avecTemps ? temps(k) : ''}[c${k}]`).join(';')};${Array.from({length: n}, (_, k) => `[c${k}]`).join('')}xstack=inputs=${n}:layout=${Array.from({length: n}, (_, k) => `${(k % 4) * 320}_${Math.floor(k / 4) * 180}`).join('|')}`;
  const faire = (avecTemps) => ffmpeg([...args, '-filter_complex', graphe(avecTemps), '-frames:v', '1', '-q:v', '4', sortie]);
  try {
    if (!POLICE_GRAS) throw new Error('Aucune police pour écrire les temps.');
    await faire(true);
  } catch {
    // sans police (ou un FFmpeg qui ne sait pas écrire) : la planche sans les temps vaut mieux que pas de planche,
    // les 12 images restent réparties régulièrement dans le rush
    await faire(false);
  }
  return sortie;
}

const cleIA = (P) => `analyse-medias:${P.racine}`;
const SUIVI = new Map(); // projet → {ids, etat, debut, erreur}
const REGLES = `Tu es l'assistant de dérushage de Dérush, un logiciel de montage vidéo. Un humain t'a confié ses rushes (ses
vidéos, ses sons, ses photos) AVANT de monter : tu les regardes et tu les décris pour lui, et pour l'IA qui montera ensuite.
Tu ne modifies rien, tu ne publies rien. Tu réponds en français simple, au tutoiement.`;

function consigneIA(liste) {
  return `Dans ce dossier, pour chaque média, il y a :
- planches/<ID>.jpg : 12 images réparties régulièrement dans la vidéo (de gauche à droite, puis de haut en bas), avec leur temps (minutes:secondes) ;
- textes/<ID>.txt : ce qui est dit, avec le temps de chaque phrase (s'il y a de la parole) ;
- mesures.json : les mesures de Dérush (exposition, contraste, dominante de couleur, Log probable, souffle, voix étouffée, écho).

Les médias à analyser : ${liste.map((m) => `${m.id} (« ${m.nom} », ${m.type === 'image' ? 'photo' : `${Math.round(m.duree)} s`})`).join(', ')}.

Regarde chaque planche, lis chaque texte, puis écris le fichier reponse.json, un objet JSON :
{"medias": {"<ID>": {
  "resume": "ce qu'on voit et ce qui se passe, en une ou deux phrases concrètes",
  "contenu": ["lieux, personnes (sans les nommer), objets, actions : 3 à 8 mots-clés"],
  "moments": [{"debut": secondes, "fin": secondes, "quoi": "ce qui s'y passe", "force": 1 à 5}],
  "defauts": ["ce qui gêne au montage : flou, tremblé, sombre, son sale, coupé… (vide si rien)"],
  "usage": "à quoi ce rush servira le mieux dans une vidéo (accroche, plan de coupe, témoignage, ambiance…), en une phrase",
  "note": 1 à 5
}}}
Les moments (3 au plus par média) sont les meilleurs passages à garder, avec des temps tirés des planches et des textes.
Chaque texte reste court : le résumé en moins de 400 signes, l'usage en moins de 200, chaque défaut en moins de 140.
Signale dans les défauts ce qui ne doit pas finir dans un montage : logo ou carton de fin d'une appli (CapCut, TikTok…),
écran noir, image figée, texte déjà incrusté, avec ses temps.
Ne recopie pas les mesures : sers-t'en pour juger. N'invente rien que tu ne vois pas ou n'entends pas.`;
}
/**
 * Un texte de l'IA ramené à n signes sans le couper au milieu d'un mot : à la fin de la dernière phrase entière si elle
 * garde l'essentiel, sinon au dernier mot entier, avec « … ».
 */
export function couperProprement(x, n) {
  const t = String(x ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const debut = t.slice(0, n);
  const phrase = Math.max(...['. ', '! ', '? ', '… '].map((s) => debut.lastIndexOf(s)));
  if (phrase >= n * 0.4) return debut.slice(0, phrase + 1).trim();
  const mot = debut.slice(0, n - 1).lastIndexOf(' ');
  return `${(mot > n * 0.4 ? debut.slice(0, mot) : debut.slice(0, n - 1)).replace(/[\s,;:.–—-]+$/, '')}…`;
}
function validerIA(r, ids) {
  const sortie = {};
  const court = (x, n) => couperProprement(x, n);
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

const TACHES = new Map(); // projet → l'analyse en route (les planches, puis l'IA), jusqu'à ce qu'elle soit vraiment sortie
const ARRETEE = 'Analyse arrêtée.';
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Lance l'analyse par l'IA de quelques médias (ou de tous). Rend la main tout de suite ; suivre avec etatAnalyseIA(). */
export async function lancerAnalyseIA(P, ids, {moteur = null, qualite = 'rapide'} = {}) {
  const k = cleIA(P);
  if (SUIVI.get(k)?.etat === 'en_cours') throw new Error('Une analyse est déjà en cours.');
  const liste = (ids?.length ? ids : P.d.medias.map((m) => m.id)).map((id) => P.d.medias.find((m) => m.id === id)).filter((m) => m && m.etat !== 'erreur');
  if (!liste.length) throw new Error('Choisis au moins un média prêt.');
  if (liste.length > 40) throw new Error('Quarante médias au plus par analyse : choisis-en une partie.');
  const suivi = {ids: liste.map((m) => m.id), etat: 'en_cours', debut: Date.now(), erreur: null, etape: 'Dérush prépare les planches', annule: false, sortie: false};
  SUIVI.set(k, suivi);
  const avant = TACHES.get(k);
  // « Arrêter » peut tomber à tout moment : on regarde après chaque attente, et l'IA n'est jamais lancée après un arrêt
  const verifier = () => { if (suivi.annule) throw new Error(ARRETEE); };
  const tache = (async () => {
    // une analyse arrêtée à l'instant finit peut-être encore (sa planche en cours, son IA qui s'arrête) : elle travaille
    // dans le même dossier, on la laisse sortir avant d'y toucher
    if (avant) await avant;
    verifier();
    const D = path.join(P.cache, 'analyse-ia');
    fs.rmSync(D, {recursive: true, force: true});
    for (const s of ['planches', 'textes']) fs.mkdirSync(path.join(D, s), {recursive: true});
    const mesures = {};
    for (const m of liste) {
      const pl = await planche(P, m).catch(() => null);
      verifier();
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
    // une IA de cette analyse encore en route (elle met un instant à s'arrêter) : on attend qu'elle soit sortie, sinon
    // la nouvelle demande serait rattachée à l'ancienne et ne finirait jamais
    for (let i = 0; etatConseil(k)?.etat === 'en_cours' && i < 100; i++) { arreterConseil(k); await attendre(200); verifier(); }
    if (etatConseil(k)?.etat === 'en_cours') throw new Error('L’analyse précédente ne s’est pas encore arrêtée : réessaie dans un instant.');
    suivi.etape = null;
    await new Promise((ok, ko) => lancerConseil({cle: k, dossier: D, consigne: consigneIA(liste), systeme: REGLES, moteur, qualite, attendu: 'reponse.json', delaiMs: 20 * 60000,
      valider: (r) => validerIA(r, suivi.ids), surFin: (err, reponse, c) => {
        // arrêtée pendant que l'IA finissait : rien n'est écrit dans le projet
        if (suivi.annule) return ko(new Error(ARRETEE));
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
  })().catch((e) => { suivi.etat = 'erreur'; suivi.erreur = e.message; }).finally(() => {
    suivi.sortie = true;
    if (TACHES.get(k) === tache) TACHES.delete(k);
  });
  TACHES.set(k, tache);
}
export function etatAnalyseIA(P) {
  const k = cleIA(P);
  const s = SUIVI.get(k);
  if (!s) return null;
  // tant que Dérush prépare les planches, l'IA de cette analyse n'existe pas encore (celle d'avant ne compte pas)
  const c = s.etape ? null : etatConseil(k);
  return {etat: s.etat, ids: s.ids, depuis_s: Math.round((Date.now() - s.debut) / 1000), erreur: s.erreur ?? c?.erreur ?? null,
    etape: s.etape ?? c?.etapes?.at(-1)?.texte ?? null, nom_ia: c?.nom_ia ?? null};
}
/**
 * Arrête l'analyse, où qu'elle en soit : pendant les planches (l'IA ne sera pas lancée), ou pendant que l'IA travaille.
 */
export function arreterAnalyseIA(P) {
  const k = cleIA(P);
  const s = SUIVI.get(k);
  SUIVI.delete(k);
  if (!s || s.sortie) return;
  s.annule = true;
  arreterConseil(k);
  // l'IA vient peut-être d'être demandée sans être encore lancée (rien à arrêter pour l'instant) : on redemande
  // l'arrêt jusqu'à ce que cette analyse soit sortie, pour qu'elle ne parte jamais seule, sans rien à l'écran
  const t = setInterval(() => { if (s.sortie) clearInterval(t); else arreterConseil(k); }, 500);
  t.unref?.();
}
export function oublierAnalyseIA(P) { if (SUIVI.get(cleIA(P))?.etat !== 'en_cours') SUIVI.delete(cleIA(P)); }
/** L'analyse par l'IA d'un rush (ia.json), ou null. */
export const lireAnalyseIA = (P, m) => lireJson(path.join(P.cache, 'medias', m.id, 'ia.json'));

// ——— ce qui est déjà incrusté dans un rush ———
// Un rush n'est pas toujours brut : un export CapCut a ses transitions (flashs, flous, images noires), son logo à la fin,
// parfois des sous-titres ; un téléphone coupe parfois le son net. Le 13 nov. 2026, Opus a mis plusieurs minutes à le
// découvrir seul sur une chronique : Dérush le repère à l'import et le donne à l'IA (analyse/<rush>.json, « incrustes »).

const LOGOS_APPLIS = /\b(capcut|ca\w?c[uo]t|tiktok|inshot|kinemaster|vn video|splice|canva|filmora|imovie|vllo|youcut|powerdirector|videoleap|picsart|instagram|snapchat)\b/i;
const tempsCourt = (s) => `${(Math.round(s * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '')} s`;

/** Des coupes de caméra serrées (moins de 0,4 s entre elles) : une transition d'appli (flash, flou, image noire). */
export function transitionsRapides(coupes = [], ecart = 0.4) {
  const c = [...coupes].sort((a, b) => a - b);
  const r = [];
  let g = null;
  for (const t of c) {
    if (g && t - g.at(-1) <= ecart) g.push(t);
    else { if (g && g.length >= 2) r.push(g); g = [t]; }
  }
  if (g && g.length >= 2) r.push(g);
  return r.map((x) => ({de: arrondi(x[0], 2), a: arrondi(x.at(-1), 2), coupes: x.length}));
}

/**
 * Le texte lu à l'image (Apple Vision) : une ligne par texte assez grand pour compter (2,2 % de la hauteur : un titre, un
 * sous-titre incrusté, une couverture ; pas les bulles d'une page filmée), avec quand on le voit ; les logos d'applis à part.
 */
export function texteLu(images, {hMin = 0.022} = {}) {
  const parTexte = new Map();
  const logos = [];
  for (const im of images) {
    for (const l of im.lignes ?? []) {
      const t = String(l.t ?? '').trim();
      const n = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
      if (n.length < 3 || (l.confiance ?? 1) < 0.4) continue;
      if (LOGOS_APPLIS.test(t) && (l.h ?? 0) >= 0.008) { if (!logos.some((x) => Math.abs(x.t - im.t) < 3)) logos.push({t: arrondi(im.t, 2), texte: t}); continue; }
      if ((l.h ?? 0) < hMin) continue;
      const x = parTexte.get(n) ?? {de: im.t, a: im.t, texte: t, hauteur_pct: 0, vu: 0};
      x.a = im.t;
      x.vu++;
      x.hauteur_pct = Math.max(x.hauteur_pct, Math.round((l.h ?? 0) * 1000) / 10);
      parTexte.set(n, x);
    }
  }
  const texte = [...parTexte.values()].sort((a, b) => b.vu - a.vu || a.de - b.de).slice(0, 25).sort((a, b) => a.de - b.de)
    .map(({vu, ...x}) => ({...x, de: arrondi(x.de, 2), a: arrondi(x.a, 2)}));
  return {logos, texte};
}

/** La phrase qui résume ce qui est incrusté (vide si rien). */
export function resumeIncrustes(x) {
  const p = [];
  if (x.transitions_rapides?.length) p.push(`${x.transitions_rapides.length} transition${x.transitions_rapides.length > 1 ? 's' : ''} rapide${x.transitions_rapides.length > 1 ? 's' : ''} (flash, flou ou image noire d’une appli) vers ${x.transitions_rapides.slice(0, 6).map((t) => tempsCourt(t.de)).join(', ')}`);
  const noires = (x.images_noires ?? []).filter(([a, b]) => b - a >= 0.04);
  if (noires.length) p.push(`${noires.length} passage${noires.length > 1 ? 's' : ''} noir${noires.length > 1 ? 's' : ''} (${noires.slice(0, 4).map(([a, b]) => `${tempsCourt(a)}${b - a >= 0.5 ? ` → ${tempsCourt(b)}` : ''}`).join(', ')})`);
  if (x.logos?.length) p.push(`logo ${[...new Set(x.logos.map((l) => l.texte))].slice(0, 2).join(', ')} à ${tempsCourt(x.logos[0].t)}`);
  if (x.son_coupe?.length) p.push(`son coupé net à ${x.son_coupe.slice(0, 4).map(([a]) => tempsCourt(a)).join(', ')}`);
  if (x.texte?.length) p.push(`texte à l’image : ${x.texte.slice(0, 3).map((t) => `« ${t.texte} »`).join(', ')}${x.texte.length > 3 ? '…' : ''}`);
  return p.length ? `Déjà dans le rush : ${p.join(' ; ')}.` : '';
}

/**
 * L'étape « incrustes » de la préparation : images noires et son coupé (mesurés par l'analyse, ou ici pour un rush
 * préparé avant la 11.1), transitions rapides (coupes serrées), et sur Mac le texte lu à l'image (Apple Vision : une
 * image toutes les 2 s, 90 au plus, et les 3 dernières secondes de près, où les applis posent leur logo).
 */
export async function reperesIncrustes(P, m, D, prog = () => {}) {
  if (m.type !== 'video') return false;
  const fA = path.join(D, 'analyse.json');
  const an = lireJson(fA) ?? {};
  const video = fichierLecture(P, m);
  if (!Array.isArray(an.images_noires)) {
    an.images_noires = [];
    try {
      const {err} = await ffmpeg(['-i', video, '-map', '0:v:0', '-an', '-vf', 'scale=320:-2,blackdetect=d=0.04:pix_th=0.10', '-f', 'null', '-'], {duree: m.duree, prog: (p) => prog(p * 0.3)});
      for (const x of String(err).matchAll(/black_start:\s*([0-9.]+)\s+black_end:\s*([0-9.]+)/g)) an.images_noires.push([arrondi(Number(x[1]), 3), arrondi(Number(x[2]), 3)]);
    } catch { /* sans images noires */ }
  }
  if (!Array.isArray(an.son_coupe) && m.audio) {
    an.son_coupe = [];
    try {
      const {err} = await ffmpeg(['-i', m.chemin, '-map', '0:a:0', '-vn', '-af', 'silencedetect=noise=-90dB:d=0.03', '-f', 'null', '-'], {duree: m.duree});
      let debut = null;
      for (const l of String(err).split('\n')) {
        const a = /silence_start:\s*(-?[0-9.]+)/.exec(l);
        const b = /silence_end:\s*([0-9.]+)/.exec(l);
        if (a) debut = Math.max(0, Number(a[1]));
        if (b && debut != null) { an.son_coupe.push([arrondi(debut, 3), arrondi(Number(b[1]), 3)]); debut = null; }
      }
      if (debut != null) an.son_coupe.push([arrondi(debut, 3), arrondi(m.duree, 3)]);
    } catch { /* sans son coupé */ }
  }
  prog(0.35);
  const x = {images_noires: an.images_noires ?? [], son_coupe: an.son_coupe ?? [], transitions_rapides: transitionsRapides(an.coupes_camera ?? []), logos: [], texte: []};
  // le texte à l'image (sur Mac, avec Apple Vision)
  const {controlePossible} = await import('./controle.mjs');
  if ((await controlePossible().catch(() => ({ok: false}))).ok) {
    const {lancerPython} = await import('./moteurs.mjs');
    const os = await import('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-incrustes-'));
    try {
      const pas = Math.max(2, m.duree / 90);
      await ffmpeg(['-y', '-i', video, '-map', '0:v:0', '-vf', `fps=1/${pas.toFixed(3)},scale='min(1280,iw)':-2`, '-frames:v', '90', '-q:v', '3', path.join(tmp, 'a%04d.jpg')]);
      const fin = Math.max(0, m.duree - 3);
      await ffmpeg(['-y', '-ss', fin.toFixed(3), '-i', video, '-map', '0:v:0', '-vf', "fps=2,scale='min(1280,iw)':-2", '-frames:v', '6', '-q:v', '3', path.join(tmp, 'b%04d.jpg')]);
      prog(0.5);
      await lancerPython('controle.py', ['lire', tmp, path.join(tmp, 'lu.json')], (p) => prog(0.5 + p * 0.45));
      const lu = JSON.parse(fs.readFileSync(path.join(tmp, 'lu.json'), 'utf8'));
      const images = lu.images.map((im) => {
        const k = Number(/(\d+)\.jpg$/.exec(im.fichier)?.[1] ?? 1) - 1;
        return {...im, t: im.fichier.startsWith('a') ? k * pas : fin + k * 0.5};
      }).sort((a, b) => a.t - b.t);
      Object.assign(x, texteLu(images));
    } catch { /* sans le texte à l'image */ } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
  }
  x.resume = resumeIncrustes(x);
  an.incrustes = x;
  ecrireJson(fA, an);
  prog(1);
  return true;
}
