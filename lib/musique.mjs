// Dérush — la musique écrite pour le film, jouée sur l'ordinateur : sans Internet, sans compte, sans crédit.
//
// Quatre services :
//   - jouer une partition : l'IA écrit la musique du film en notation ABC (mélodie, accords, nuances, pédale,
//     batterie) ; le compositeur la joue sur ses instruments et la cale sur les moments du film (les repères) ;
//   - jouer un style : une musique de fond en une ligne (13 styles), qui change à chaque scène ;
//   - les temps d'un morceau déjà fait : le tempo, chaque temps, chaque mesure, les sections et les sommets, pour
//     couper le film sur la musique ;
//   - ajuster un morceau déjà fait à la durée du film, comme un monteur son : son début tel quel, un milieu raccourci
//     ou allongé par mesures entières, sa vraie fin sur la dernière image. Chaque raccord est mesuré.
//
// Le moteur est celui de huashu-motion (licence MIT), repris tel quel dans lib/musique/ (voir son LISEZ-MOI.md) : du
// JavaScript pur. FFmpeg ne sert qu'à lire un fichier de son. Rien n'est téléchargé, rien n'est envoyé.
//
// À dire franchement : les instruments sont calculés (de la synthèse), pas enregistrés. Mesuré avec Earshot le
// 24 nov. 2026 : c'est bien de la musique (AudioSet « Music » 0,88), mais elle se lit comme « faite en code »
// (réalité 0,06 à 0,30 selon le style). Pour un piano ou des cordes enregistrés, il faut un morceau de la
// bibliothèque de sons ou une musique d'ElevenLabs.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {FFMPEG} from './outils.mjs';
import {dossierSupport} from './plateforme.mjs';

/** Au-delà, la mémoire grimpe trop (mesuré : 60 s = 0,4 Go, 180 s = 1,1 Go). */
export const DUREE_MAX = 180;
/** L'analyse des temps : 10 minutes de son au plus à la fois (le son est lu en entier en mémoire : 5 min = 0,6 Go). */
export const DUREE_TEMPS_MAX = 600;
/** Un morceau ajusté peut couvrir un film de 10 minutes (pas de synthèse : la mémoire suit la durée). */
export const DUREE_FILM_MAX = 600;
/** Sous cette confiance, le morceau n'a pas de pulsation nette : les temps sont une supposition (seuil du moteur). */
export const CONFIANCE_MIN = 0.3;
/** Au-delà de cet écart de tempo entre deux repères, ce n'est plus un tempo qui respire : c'est une phrase de la mauvaise longueur. */
export const ETIREMENT_MAX = 0.08;
/** Les trois fins d'une musique de style, et leur nom dans le moteur. */
export const FINS = {resonne: 'ring', nette: 'button', coupee: 'stop'};
const FREQ = 48000;
const NOTES = ['do', 'do♯', 'ré', 'mi♭', 'mi', 'fa', 'fa♯', 'sol', 'la♭', 'la', 'si♭', 'si'];
const GAMMES = {major: 'majeur', minor: 'mineur', dorian: 'dorien'};
const arrondi = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;

/** Ce que chaque style donne à entendre, en français (les noms sont ceux du moteur). */
const STYLES_FR = {
  mallet: 'marimba, kalimba et piano électrique, qui changent à chaque scène : une explication, un ton amical',
  pulse: 'synth-pop nette : nappe qui respire, basse à contretemps, grosse caisse sur chaque temps ; la tech, une appli',
  lofi: 'Rhodes feutré, batterie boom-bap qui balance, craquement de vinyle : chaleureux, humain, à la maison',
  funk: 'basse qui claque, clavinet, cuivres par à-coups : sûr de soi, joyeux',
  trap: 'trap à mi-tempo : 808 qui glisse, charleys en rafale, cloches sombres ; fort, pour un moment qui frappe',
  chiptune: '8 bits : arpèges et mélodie carrés, basse triangle ; les jeux, le rétro, l’espiègle',
  ambient: 'sans batterie : nappes lentes, bourdon grave, éclats de verre dans une grande salle ; le calme, la science',
  piano: 'piano feutré, accords brisés et un air simple, cordes au sommet : l’émotion, l’histoire d’une personne',
  cinematic: 'bande-annonce : cordes qui martèlent, taïkos, cors, un grand coup au sommet ; un lancement, de l’épique',
  pizzicato: 'pizzicatos qui sautillent, glockenspiel, claquements de doigts : mignon, drôle',
  acoustic: 'guitare grattée, claquements de mains, pieds et shaker : chaleureux, la vie de tous les jours',
  guofeng: 'airs pentatoniques au guzheng et à la flûte dizi, cordes douces, tambour sur cadre : la culture chinoise',
  synthwave: 'années 80 : basse en croches, nappes larges, caisse claire coupée net, arpèges ; la nuit, la nostalgie, le jeu',
};
/** Les instruments d'une partition (inst=…), rangés par famille. Un essai vérifie qu'aucun du moteur ne manque. */
export const FAMILLES_INSTRUMENTS = [
  ['claviers', ['piano', 'epiano', 'rhodes', 'clav']],
  ['lames et cloches', ['marimba', 'vibes', 'kalimba', 'glock', 'bell', 'glass']],
  ['cordes pincées', ['guitar', 'uke', 'harp', 'pizz', 'pluck', 'guzheng']],
  ['cordes frottées', ['strings', 'lowstr', 'stacc', 'erhu']],
  ['vents', ['flute', 'dizi', 'horn', 'brass']],
  ['nappes', ['pad', 'warmpad', 'supersaw']],
  ['synthés', ['saw', 'sqlead', 'synpluck', 'chip', 'tri']],
  ['basses', ['bass', 'synbass', 'sub808', 'sinebass']],
  ['divers', ['cowbell']],
];
/** Les pupitres de cordes qu'une partition peut nommer : « strings » ou « lowstr » jouent à leur place. */
const PUPITRES = ['violins', 'violas', 'celli', 'basses', 'violin', 'trem'];

/** Ce qui joue, dit tel quel dans chaque réponse : Dérush n'a pas d'instruments enregistrés. */
export const INSTRUMENTS_CALCULES = 'synthèse (calculés, pas enregistrés)';
const AVEU = 'Les instruments sont calculés (de la synthèse), pas enregistrés : une oreille attentive l’entend.';

/**
 * L'environnement du moteur. Il sait jouer des instruments enregistrés s'il en trouve un paquet : Dérush n'en
 * télécharge pas, donc tout est calculé. Et son carnet de bord ne va jamais dans le dossier personnel (seules des
 * fonctions que Dérush n'appelle pas y écrivent).
 */
function preparer() {
  process.env.OM_SAMPLES = 'off';
  process.env.OM_HOME = path.join(dossierSupport(), 'musique');
}

/**
 * Ce que l'IA doit savoir de la musique faite ici, en une ligne de ses consignes. `elevenlabs` : ElevenLabs est
 * branché (il reste le studio de la musique ; derush-musique est la façon de ne dépenser aucun crédit).
 */
export function consigneMusique(elevenlabs = false) {
  const outils = 'La commande derush-musique (aide : derush-musique --help ; compétence huashu-motion pour la direction) travaille sur l’ordinateur, sans Internet : « temps » donne le tempo, chaque temps, chaque mesure et les sommets d’un morceau, pour couper dessus ; « ajuster » met un morceau à la durée du film, avec sa vraie fin sur la dernière image';
  const ecrire = '« jouer » joue une partition que tu écris pour le film (calée sur ses moments) et « style » pose une musique de fond. Leurs instruments sont calculés, pas enregistrés : dis-le en une ligne à l’humain quand tu t’en sers';
  return elevenlabs
    ? `- La musique et ses temps : ${outils}. Sans dépenser de crédit, ${ecrire}, et garde ElevenLabs quand il veut une musique qui sonne comme un vrai morceau.`
    : `- La musique, sans ElevenLabs : ${outils}. Quand aucun morceau ne convient, ${ecrire}.`;
}

let moteur = null;
async function charger() {
  preparer();
  if (!moteur) {
    const [S, C, B, P] = await Promise.all([import('./musique/sound.js'), import('./musique/composer.js'), import('./musique/beats.js'), import('./musique/score.js')]);
    moteur = {S, C, B, P};
  }
  return moteur;
}

const tonalite = (p) => `${NOTES[((p.root % 12) + 12) % 12]} ${GAMMES[p.scale] ?? p.scale}`;

/** Les styles, les instruments et les batteries : tout ce que « derush-musique styles » montre. */
export async function catalogue() {
  const {S, C, P} = await charger();
  return {
    styles: Object.entries(S.STYLES).map(([nom, s]) => ({nom, pour: STYLES_FR[nom] ?? s.about, tempo: s.bpm, variantes: Object.keys(s.variants ?? {})})),
    fins: Object.keys(FINS),
    instruments: FAMILLES_INSTRUMENTS.map(([famille, noms]) => ({famille, noms: noms.filter((n) => P.INSTRUMENTS[n])})),
    pupitres: PUPITRES,
    batteries: Object.keys(C.DRUM_KITS),
    duree_max_s: DUREE_MAX,
    instruments_calcules: AVEU,
  };
}

/** « intro=0, sommet=12.5 » ou un objet → {intro: 0, sommet: 12.5}. Refuse un nom vide, un temps qui n'est pas un nombre. */
export function lireTemps(v, quoi = 'repères') {
  if (v == null || v === '') return {};
  const paires = typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const i = x.lastIndexOf('='); return i < 0 ? [x, ''] : [x.slice(0, i).trim(), x.slice(i + 1).trim()]; }) : Object.entries(v);
  const o = {};
  for (const [nom, t] of paires) {
    const s = Number(t);
    if (!nom || t === '' || t == null || !Number.isFinite(s) || s < 0) throw new Error(`${quoi} : « ${nom}=${t ?? ''} » ne se lit pas. Écris « nom=secondes », séparés par des virgules (exemple : intro=0,sommet=12.5).`);
    if (nom in o) throw new Error(`${quoi} : « ${nom} » est donné deux fois.`);
    o[nom] = s;
  }
  return o;
}

function dureeDemandee(duree, quoi) {
  if (duree == null || duree === '') return null;
  const d = Number(duree);
  if (!Number.isFinite(d) || d <= 0) throw new Error(`${quoi} : la durée « ${duree} » n’est pas un nombre de secondes.`);
  if (d > DUREE_MAX) throw new Error(`${quoi} : ${DUREE_MAX} s au plus (demandé : ${arrondi(d, 1)} s). Pour un film plus long, fais la musique en plusieurs morceaux, ou prends un morceau de la bibliothèque de sons.`);
  return d;
}

function graineDemandee(g) {
  if (g == null || g === '') return 1;
  const n = Number(g);
  if (!Number.isInteger(n) || n < 0 || n > 999999) throw new Error(`La graine « ${g} » doit être un nombre entier (de 0 à 999999) : chaque nombre donne une autre interprétation.`);
  return n;
}

/** La partition lue, sans rien jouer : ses voix, ses repères, sa durée, et ce qu'il y a à corriger. */
export async function lirePartition(texte, {reperes = {}} = {}) {
  const {C, P} = await charger();
  let sc;
  try { sc = C.parseAbc(String(texte ?? '')); } catch (e) { throw new Error(`La partition ne se lit pas : ${e.message}`); }
  if (!sc.events?.length) throw new Error('La partition n’a aucune note. Il faut les en-têtes X: T: M: L: Q: K:, puis les notes (derush-musique --help donne un exemple).');
  const marques = sc.cues.filter((c) => c.type === 'mark');
  const noms = [...new Set(marques.map((c) => c.name))];
  const inconnus = Object.keys(reperes).filter((n) => !noms.includes(n));
  if (inconnus.length) throw new Error(`La partition n’a pas de repère « ${inconnus.join(' », « ')} » (elle a : ${noms.length ? noms.join(', ') : 'aucun repère'}). Un repère s’écrit !mark:nom! devant la note où le moment tombe.`);
  let perf;
  try { perf = C.perform(sc, {start: 0.05, seed: 1, align: Object.keys(reperes).length ? reperes : null}); } catch (e) {
    const m = /^mark "(.*)" comes after "(.*)" in the score/.exec(e.message);
    throw new Error(m ? `Le repère « ${m[1]} » vient après « ${m[2]} » dans la partition, mais pas dans les temps donnés : remets-les dans l’ordre.` : `La partition ne se joue pas : ${e.message}`);
  }
  const connus = new Set([...Object.keys(P.INSTRUMENTS), ...PUPITRES, 'drums']);
  const attention = [];
  const voix = sc.order.map((id) => {
    const v = sc.voices[id];
    const batterie = v.inst === 'drums';
    if (!connus.has(v.inst)) attention.push(`La voix ${id} demande l’instrument « ${v.inst} », qui n’existe pas : un piano électrique joue à sa place. Les instruments : derush-musique styles.`);
    if (batterie && !C.DRUM_KITS[v.kit]) attention.push(`La voix ${id} demande la batterie « ${v.kit} », qui n’existe pas : la batterie « pop » joue à sa place (${Object.keys(C.DRUM_KITS).join(', ')}).`);
    return {nom: id, instrument: v.inst, ...(batterie ? {batterie: C.DRUM_KITS[v.kit] ? v.kit : 'pop'} : {}), ...(v.role === 'melody' ? {melodie: true} : {})};
  });
  for (const w of sc.warnings ?? []) {
    const bar = /^voice (\S+) bar (\d+) has ([\d.]+) beats, the meter wants ([\d.]+)/.exec(w);
    const fin = /^voice (\S+) ends at beat ([\d.]+), the score at ([\d.]+)/.exec(w);
    attention.push(bar ? `Voix ${bar[1]}, mesure ${bar[2]} : ${bar[3]} temps écrits, la mesure en veut ${bar[4]}.`
      : fin ? `La voix ${fin[1]} s’arrête au temps ${fin[2]}, la partition au temps ${fin[3]} : écris toutes les mesures dans toutes les voix (un silence d’une mesure : Z).`
        : w);
  }
  if (perf.start < -0.02) attention.push(`La musique commencerait ${arrondi(-perf.start, 1)} s avant le début du film : ses premières notes sont coupées. Recule le premier repère ou raccourcis l’introduction.`);
  const etirements = (perf.fit?.stretches ?? []).map((s) => ({de: s.from, a: s.to, tempo: arrondi(s.qpm, 1), ecart_pct: arrondi(s.bend * 100, 1)}));
  for (const s of etirements) {
    if (Math.abs(s.ecart_pct) > ETIREMENT_MAX * 100) attention.push(`Entre « ${s.de} » et « ${s.a} », le tempo doit passer à ${s.tempo} (${s.ecart_pct > 0 ? '+' : ''}${s.ecart_pct} %) pour tenir les repères : au-delà de ${ETIREMENT_MAX * 100} %, ça s’entend. Ajoute ou retire des mesures dans ce passage.`);
  }
  return {
    titre: sc.title || null,
    mesure: /^M:\s*(\d+\/\d+)/m.exec(String(texte))?.[1] ?? `${sc.meter[0]}/${sc.meter[1]}`, // celle de l'en-tête (le moteur ne garde que la dernière écrite)
    tempo: arrondi(sc.tempo[0].qpm, 1),
    voix,
    notes: sc.events.length,
    debut_s: arrondi(perf.start, 2),
    fin_musique_s: arrondi(perf.end, 2),
    reperes: marques.map((c) => ({nom: c.name, a_s: arrondi(perf.cues.find((x) => x.type === 'mark' && x.name === c.name && x.beat === c.beat).at, 2), ...(c.name in reperes ? {cale: true} : {})})),
    effets: {impacts: sc.cues.filter((c) => c.type === 'hit').length, montees: sc.cues.filter((c) => c.type === 'rise').length},
    ...(etirements.length ? {etirements} : {}),
    ...(attention.length ? {attention} : {}),
  };
}

/** Écrit le WAV à côté de sa place puis le glisse dessus : jamais de fichier à moitié écrit. */
function ecrireWav(sortie, tampon) {
  if (!sortie) throw new Error('Il manque le fichier de sortie (-o musique.wav).');
  if (path.extname(sortie).toLowerCase() !== '.wav') throw new Error(`La musique sort en WAV (48 kHz, stéréo) : donne un nom en .wav (reçu : ${path.basename(sortie)}).`);
  fs.mkdirSync(path.dirname(path.resolve(sortie)), {recursive: true});
  const tmp = `${sortie}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, tampon);
  fs.renameSync(tmp, sortie);
}

const mesureSon = (r) => ({volume_lufs: arrondi(r.finalLufs, 1), crete_db: arrondi(r.peak, 1)});

/**
 * Joue une partition ABC et écrit le WAV. `reperes` ({nom: secondes}) pose chaque !mark:nom! sur son moment du film ;
 * `duree` est celle du fichier (par défaut : la musique et 2 s pour laisser sonner la dernière note).
 */
export async function jouerPartition(texte, {sortie, duree = null, reperes = {}, graine = 1} = {}) {
  reperes = lireTemps(reperes);
  graine = graineDemandee(graine);
  const voulue = dureeDemandee(duree, 'La musique');
  const lecture = await lirePartition(texte, {reperes});
  if (!voulue && lecture.fin_musique_s + 2 > DUREE_MAX) throw new Error(`La partition dure ${lecture.fin_musique_s} s : ${DUREE_MAX - 2} s au plus. Raccourcis-la, ou fais la musique en plusieurs morceaux.`);
  const d = voulue ?? Math.ceil((lecture.fin_musique_s + 2) * 10) / 10;
  if (!sortie) throw new Error('Il manque le fichier de sortie (-o musique.wav).');
  const {S} = await charger();
  const t0 = Date.now();
  let r;
  try { r = S.mixdown({id: 'derush', duration: d, labels: {}, hits: [], music: {seed: graine, marks: reperes}}, {score: String(texte)}); } catch (e) { throw new Error(`La partition ne se joue pas : ${e.message.replace(/^om-score: /, '')}`); }
  ecrireWav(sortie, S.toWav(r.out2));
  const {attention: vues = [], ...partition} = lecture;
  const attention = [...vues];
  if (lecture.fin_musique_s > d - 0.3) attention.push(`La musique dure ${lecture.fin_musique_s} s et le fichier ${arrondi(d, 1)} s : la fin est fondue. Pour l’entendre en entier, donne --duree ${Math.ceil(lecture.fin_musique_s + 2)} ou raccourcis la partition.`);
  return {
    ok: true, fichier: sortie, duree_s: arrondi(d, 2), ...mesureSon(r),
    ...partition,
    instruments: INSTRUMENTS_CALCULES,
    graine, calcul_s: arrondi((Date.now() - t0) / 1000, 1),
    ...(attention.length ? {attention} : {}),
  };
}

/**
 * Une musique de fond d'après un style. `scenes` ({nom: secondes}) : la musique change à chaque scène et son tempo
 * est choisi pour tomber au plus près de ces coupes. `sommet` : le nom d'une scène ou un temps, où tout l'orchestre
 * entre après une respiration. `fin` : resonne (le dernier accord s'éteint), nette (un accent final), coupee.
 */
export async function jouerStyle({style, sortie, duree, scenes = {}, sommet = null, fin = 'resonne', finA = null, bpm = null, graine = 1, sousVoix = false} = {}) {
  const {S} = await charger();
  const [base, variante] = String(style ?? '').split(':');
  const S0 = S.STYLES[base];
  if (!style || !S0) throw new Error(`${style ? `Le style « ${style} » n’existe pas` : 'Il manque le style'}. Les styles : ${Object.keys(S.STYLES).join(', ')} (derush-musique styles les décrit).`);
  if (variante && !S0.variants?.[variante]) throw new Error(`Le style « ${base} » n’a pas de variante « ${variante} »${Object.keys(S0.variants ?? {}).length ? ` (il a : ${Object.keys(S0.variants).join(', ')})` : ' (il n’en a aucune)'}.`);
  const d = dureeDemandee(duree, 'La musique');
  if (!d) throw new Error('Il manque la durée de la musique (--duree secondes) : celle du film.');
  if (!(fin in FINS)) throw new Error(`La fin « ${fin} » n’existe pas. Les fins : resonne (le dernier accord s’éteint), nette (un accent final), coupee (la musique s’arrête net).`);
  scenes = lireTemps(scenes, 'scènes');
  for (const [nom, t] of Object.entries(scenes)) if (t >= d) throw new Error(`La scène « ${nom} » commence à ${t} s, après la fin de la musique (${d} s).`);
  graine = graineDemandee(graine);
  const music = {style, seed: graine, ending: FINS[fin]};
  if (bpm != null && bpm !== '') {
    const b = Number(bpm);
    if (!Number.isFinite(b) || b < 40 || b > 220) throw new Error(`Le tempo « ${bpm} » doit être entre 40 et 220 (le style ${base} va de ${S0.bpm[0]} à ${S0.bpm[1]}).`);
    music.bpm = b;
  }
  if (sommet != null && sommet !== '') {
    const t = Number(sommet);
    if (Number.isFinite(t)) { if (t <= 0 || t >= d) throw new Error(`Le sommet à ${t} s tombe hors de la musique (${d} s).`); music.drop = t; }
    else if (!(sommet in scenes)) throw new Error(`Le sommet « ${sommet} » n’est pas une scène (${Object.keys(scenes).join(', ') || 'aucune scène donnée'}) : donne le nom d’une scène ou un temps en secondes.`);
    else music.drop = sommet;
  }
  if (finA != null && finA !== '') {
    const t = Number(finA);
    if (fin === 'resonne') throw new Error('--fin-a ne sert qu’avec --fin nette ou --fin coupee (le moment où la musique s’arrête).');
    if (!Number.isFinite(t) || t <= 0 || t > d) throw new Error(`La fin à « ${finA} » s tombe hors de la musique (${d} s).`);
    music.end = t;
  }
  if (!sortie) throw new Error('Il manque le fichier de sortie (-o musique.wav).');
  const t0 = Date.now();
  let r;
  try { r = S.mixdown({id: 'derush', duration: d, labels: Object.fromEntries(Object.entries(scenes).map(([nom, t]) => [`scene:${nom}`, t])), hits: [], music}, {voiced: !!sousVoix}); } catch (e) { throw new Error(`La musique ne se fait pas : ${e.message}`); }
  if (sousVoix) { // sous une voix, le moteur laisse la musique très bas : on la remet au niveau des autres (le mixage la placera)
    const l = S.loudness(r.out2.L, r.out2.R);
    if (Number.isFinite(l)) { r.out2.scale(10 ** ((-14 - l) / 20)); S.limit(r.out2, 10 ** (-1.5 / 20)); }
    r.finalLufs = S.loudness(r.out2.L, r.out2.R);
    let c = 0; for (let i = 0; i < r.out2.n; i++) c = Math.max(c, Math.abs(r.out2.L[i]), Math.abs(r.out2.R[i]));
    r.peak = 20 * Math.log10(Math.max(c, 1e-9));
  }
  ecrireWav(sortie, S.toWav(r.out2));
  const p = r.p;
  const attention = [];
  if (p.gridError > 0.06) attention.push(`Une coupe tombe à ${Math.round(p.gridError * 1000)} ms de la croche la plus proche : la musique et l’image ne tombent pas ensemble à cet endroit. Essaie un autre tempo (--bpm) ou décale la coupe.`);
  return {
    ok: true, fichier: sortie, duree_s: arrondi(d, 2), ...mesureSon(r),
    style: p.style, tempo: arrondi(p.bpm, 2), tonalite: tonalite(p),
    scenes: p.sections.map((s) => ({nom: s.id, a_s: arrondi(s.t, 2), energie: arrondi(s.energy, 2), ...(s.drop ? {sommet: true} : {})})),
    ...(p.drop != null ? {sommet_s: arrondi(p.drop, 2)} : {}),
    fin, ...(p.end != null ? {fin_a_s: arrondi(p.end, 2)} : {}),
    ecart_coupes_ms: Math.round(p.gridError * 1000),
    ...(sousVoix ? {sous_voix: true} : {}),
    instruments: INSTRUMENTS_CALCULES,
    graine, calcul_s: arrondi((Date.now() - t0) / 1000, 1),
    ...(attention.length ? {attention} : {}),
  };
}

/** Le son d'un fichier (audio ou vidéo), en mémoire : {L, R, rate}. Avec le FFmpeg de Dérush, sans bloquer. */
function decoder(fichier, {debut = 0, duree = null} = {}) {
  return new Promise((resolve, reject) => {
    const args = ['-v', 'error', '-nostdin', ...(debut > 0 ? ['-ss', String(debut)] : []), '-i', fichier, ...(duree ? ['-t', String(duree)] : []), '-vn', '-f', 'f32le', '-ac', '2', '-ar', String(FREQ), '-'];
    let p;
    try { p = spawn(FFMPEG, args, {stdio: ['ignore', 'pipe', 'pipe']}); } catch (e) { reject(new Error(`FFmpeg ne démarre pas : ${e.message}`)); return; }
    const morceaux = []; let octets = 0, err = '', trop = false;
    const plafond = (DUREE_TEMPS_MAX + 1) * FREQ * 8;
    p.stdout.on('data', (b) => { octets += b.length; if (octets > plafond) { trop = true; p.kill('SIGKILL'); return; } morceaux.push(b); });
    p.stderr.on('data', (b) => { err = (err + b).slice(-2000); });
    p.on('error', (e) => reject(new Error(e.code === 'ENOENT' ? 'FFmpeg est introuvable : il sert à lire le fichier de musique.' : `FFmpeg ne démarre pas : ${e.message}`)));
    p.on('close', (code) => {
      if (trop) { reject(new Error(`Ce son dure plus de ${DUREE_TEMPS_MAX / 60} minutes : analyse un passage (--debut secondes --duree secondes).`)); return; }
      if (code !== 0) {
        const sansSon = /does not contain any stream|matches no streams/i.test(err);
        reject(new Error(sansSon ? `${path.basename(fichier)} n’a pas de piste de son.` : `FFmpeg n’a pas pu lire ${path.basename(fichier)} : ${err.trim().split('\n').pop() || `code ${code}`}`));
        return;
      }
      const n = Math.floor(octets / 8);
      if (!n) { reject(new Error(`${path.basename(fichier)} n’a pas de son${debut > 0 ? ` après ${debut} s` : ''}.`)); return; }
      // morceau par morceau (un échantillon peut être à cheval sur deux) : jamais deux copies du son entier en mémoire
      const L = new Float32Array(n), R = new Float32Array(n);
      let i = 0, reste = null;
      for (let m = 0; m < morceaux.length; m++) {
        const b = reste?.length ? Buffer.concat([reste, morceaux[m]]) : morceaux[m];
        morceaux[m] = null;
        const k = Math.floor(b.length / 8);
        for (let j = 0; j < k && i < n; j++, i++) { L[i] = b.readFloatLE(8 * j); R[i] = b.readFloatLE(8 * j + 4); }
        reste = b.subarray(k * 8);
      }
      resolve({L, R, rate: FREQ});
    });
  });
}

/** Le temps le plus proche de t dans une liste croissante : {a_s, ecart_ms} (écart positif : le temps vient après t). */
function plusProche(liste, t) {
  if (!liste.length) return null;
  let m = liste[0];
  for (const x of liste) if (Math.abs(x - t) < Math.abs(m - t)) m = x;
  return {a_s: arrondi(m, 3), ecart_ms: Math.round((m - t) * 1000)};
}

/**
 * Les temps d'un morceau (un fichier audio ou la musique d'une vidéo) : tempo, temps, mesures, sections, sommets.
 * `debut`/`duree` : n'analyser qu'un passage (les temps rendus restent ceux du fichier entier). `bpm` : le tempo, si
 * on le connaît. `caler` : des temps de coupe, pour lesquels on rend le temps et le début de mesure les plus proches.
 */
export async function tempsMusique(fichier, {debut = null, duree = null, bpm = null, caler = []} = {}) {
  if (!fichier) throw new Error('Il manque le fichier de musique (ou la vidéo).');
  if (!fs.existsSync(fichier)) throw new Error(`Fichier introuvable : ${fichier}`);
  const nb = (v, quoi, {min = 0, max = Infinity} = {}) => { if (v == null || v === '') return null; const n = Number(v); if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${quoi} : « ${v} » n’est pas un nombre valable.`); return n; };
  const d0 = nb(debut, 'Le début') ?? 0;
  const du = nb(duree, 'La durée', {min: 2});
  if (du && du > DUREE_TEMPS_MAX) throw new Error(`L’analyse prend ${DUREE_TEMPS_MAX / 60} minutes de son au plus à la fois.`);
  const tempo = nb(bpm, 'Le tempo', {min: 30, max: 300});
  const coupes = (Array.isArray(caler) ? caler : String(caler ?? '').split(',')).map((x) => String(x).trim()).filter(Boolean).map((x) => nb(x, 'Un temps à caler'));
  const {B} = await charger();
  const t0 = Date.now();
  const pcm = await decoder(fichier, {debut: d0, duree: du});
  if (pcm.L.length < FREQ * 2) throw new Error('Ce son dure moins de 2 secondes : il n’y a pas de quoi trouver un tempo.');
  const an = B.analyze(pcm, tempo ? {bpm: tempo} : {});
  const t = (x) => arrondi(x + d0, 3);
  const net = an.confidence >= CONFIANCE_MIN;
  const temps = an.beats.map(t), mesures = an.downbeats.map(t);
  const attention = [];
  if (!net) attention.push(`Pas de pulsation nette (confiance ${arrondi(an.confidence, 2)}) : le tempo et les temps sont une supposition. Fie-toi aux sections et aux sommets, pas aux temps.`);
  // une autre façon de compter (trois temps contre deux, 3:4…) qui tient presque aussi bien : le moteur en doute lui-même
  // au-delà de 0,7. Le double et la moitié ne comptent pas : leurs temps tombent sur les mêmes battements.
  const voisin = (an.alternatives ?? []).filter((a) => /^[234]:[234]$/.test(a.ratio) && a.steady && a.score >= 0.7).sort((a, b) => b.score - a.score)[0];
  if (voisin && !tempo) attention.push(`Ce morceau se compte aussi à ${arrondi(voisin.bpm, 1)} BPM, presque aussi bien qu’à ${arrondi(an.bpm, 1)}. Si tu connais son tempo, donne-le : --bpm.`);
  if (an.tail) attention.push(`Après la musique (fin à ${t(an.end)} s), il reste un son plus faible de ${t(an.tail.from)} à ${t(an.tail.to)} s (une mention parlée, souvent) : ne le garde pas.`);
  return {
    ok: true, fichier,
    ...(d0 ? {debut_s: d0} : {}), duree_s: arrondi(an.duration, 2),
    tempo: arrondi(an.bpm, 2), confiance: arrondi(an.confidence, 2), pulsation: net ? 'nette' : 'incertaine',
    tempo_regulier: an.fit?.method === 'steady',
    temps, mesures,
    sections: an.sections.map((s) => ({de_s: t(s.start), a_s: t(s.end), energie: arrondi(s.energy, 2)})),
    sommets: an.drops.map((s) => ({a_s: t(s.t), force: arrondi(s.score, 2)})),
    fin_musique_s: t(an.end),
    ...(coupes.length ? {cales: coupes.map((c) => ({coupe_s: c, temps: plusProche(temps, c), mesure: plusProche(mesures, c)}))} : {}),
    calcul_s: arrondi((Date.now() - t0) / 1000, 1),
    ...(attention.length ? {attention} : {}),
  };
}

/** Les temps d'un morceau recoupé, dans l'ordre : à un raccord, le même battement arrive des deux côtés (on n'en garde qu'un). */
const sansDoublons = (liste, fin) => [...liste].filter((t) => t >= 0 && t <= fin).sort((x, y) => x - y).filter((t, i, l) => i === 0 || t - l[i - 1] > 0.03).map((t) => arrondi(t, 3));

/** Pourquoi le moteur n'a pas recoupé un morceau, en français (ses phrases, reconnues par leur début). */
const SANS_RECOUPE = [
  [/^no clear pulse/, 'pas de pulsation nette : les mesures ne se distinguent pas'],
  [/^the track has no bar map/, 'le morceau est trop court, ou sans pulsation nette, pour en lire les mesures'],
  [/^the tempo was set by hand/, 'le tempo donné à la main ne tombe pas sur les mesures que le moteur a lues'],
  [/^the film is shorter than two bars/, 'le film dure moins de deux mesures'],
  [/^every candidate arrangement has a loudness jump/, 'chaque recoupe essayée faisait sauter le volume de plus de 6 dB'],
];
const FORMES_DE_FIN = {cadence: 'une cadence', 'ring-out': 'un accord qui résonne', fade: 'un fondu', 'hard stop': 'un arrêt net'};

/**
 * Un morceau déjà fait, ajusté à la durée du film (le moteur de recoupe de huashu-motion) : le début du morceau tel
 * quel, un milieu raccourci ou allongé par mesures entières, puis sa vraie fin. `montee`, `sommet`, `arrivee` (en
 * secondes ou par le nom d'une scène) disent où la musique doit s'élargir, être au plus fort, et où tombe le carton
 * de fin. `droit` (ou `debut`) : pas de recoupe, le morceau depuis ce point, fondu à la fin ; un morceau plus court
 * que le film est bouclé sur ses mesures. Le niveau n'est pas changé, sauf s'il écrêterait.
 */
export async function ajusterMorceau(fichier, {sortie, duree, scenes = {}, montee = null, sommet = null, arrivee = null, debut = null, bpm = null, droit = false} = {}) {
  if (!fichier) throw new Error('Il manque le morceau à ajuster (un fichier de musique, ou une vidéo).');
  if (!fs.existsSync(fichier)) throw new Error(`Fichier introuvable : ${fichier}`);
  const nb = (v, quoi, {min = 0, max = Infinity} = {}) => { if (v == null || v === '') return null; const n = Number(v); if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${quoi} : « ${v} » n’est pas un nombre valable.`); return n; };
  const d = nb(duree, 'La durée du film', {min: 1});
  if (!d) throw new Error('Il manque la durée du film (--duree secondes).');
  if (d > DUREE_FILM_MAX) throw new Error(`Un morceau s’ajuste à un film de ${DUREE_FILM_MAX / 60} minutes au plus (demandé : ${arrondi(d, 1)} s).`);
  scenes = lireTemps(scenes, 'scènes');
  for (const [nom, t] of Object.entries(scenes)) if (t >= d) throw new Error(`La scène « ${nom} » commence à ${t} s, après la fin du film (${d} s).`);
  const moment = (v, quoi) => {
    if (v == null || v === '') return null;
    const t = Number.isFinite(Number(v)) ? Number(v) : scenes[v];
    if (t == null) throw new Error(`${quoi} : « ${v} » n’est ni un temps en secondes ni une scène (${Object.keys(scenes).join(', ') || 'aucune scène donnée'}).`);
    if (t <= 0 || t > d) throw new Error(`${quoi} : ${t} s tombe hors du film (${d} s).`);
    return t;
  };
  const film = {montee: moment(montee, 'La montée'), sommet: moment(sommet, 'Le sommet'), arrivee: moment(arrivee, 'L’arrivée')};
  const d0 = nb(debut, 'Le début dans le morceau');
  const tempo = nb(bpm, 'Le tempo', {min: 30, max: 300});
  const recoupe = !droit && d0 == null;
  if (!sortie) throw new Error('Il manque le fichier de sortie (-o musique.wav).');
  if (path.extname(sortie).toLowerCase() !== '.wav') throw new Error(`La musique sort en WAV (48 kHz, stéréo) : donne un nom en .wav (reçu : ${path.basename(sortie)}).`);
  const {B, S} = await charger();
  const [T, A] = await Promise.all([import('./musique/track.js'), import('./musique/arrange.js')]);
  const t0 = Date.now();
  const pcm = await decoder(fichier);
  if (pcm.L.length < FREQ * 2) throw new Error('Ce morceau dure moins de 2 secondes.');
  const an = B.analyze(pcm, tempo ? {bpm: tempo} : {});
  const labels = Object.fromEntries(Object.entries(scenes).map(([nom, t]) => [`scene:${nom}`, t]));
  const music = {...(film.montee != null ? {burst: film.montee} : {}), ...(film.sommet != null ? {peak: film.sommet} : {}), ...(film.arrivee != null ? {landing: film.arrivee} : {})};
  let plan;
  try { plan = T.planTrack(an, {duration: d, start: d0 ?? 0, bpm: tempo, film: recoupe ? {labels, music} : null, pcm: recoupe ? pcm : null, arrange: recoupe ? 'auto' : 'off'}); } catch (e) { throw new Error(`Le morceau ne s’ajuste pas : ${e.message}`); }
  const son = T.renderTrack(pcm, plan);
  const a = plan.arrange, mes = a ? A.measureArrangement(son, plan, FREQ) : null;
  // le niveau reste celui du morceau ; s'il dépasse −1 dB, il est baissé d'un bloc (pas de limiteur : le son ne change pas)
  let crete = 0;
  for (let i = 0; i < son.L.length; i++) crete = Math.max(crete, Math.abs(son.L[i]), Math.abs(son.R[i]));
  const plafond = 10 ** (-1 / 20), gain = crete > plafond ? plafond / crete : 1;
  const piste = new S.Track(d);
  for (let i = 0; i < piste.n && i < son.L.length; i++) { piste.L[i] = son.L[i] * gain; piste.R[i] = son.R[i] * gain; }
  ecrireWav(sortie, S.toWav(piste));
  const volume = S.loudness(piste.L, piste.R);
  const attention = [];
  const t3 = (x) => arrondi(x, 3), t2 = (x) => arrondi(x, 2);
  const passages = [];
  if (a) {
    const bars = an.map.bars;
    for (let k = 0; k < a.steps.length;) {
      let e = k;
      while (e + 1 < a.steps.length && a.steps[e + 1].bar === a.steps[e].bar + 1) e++;
      const fin = e + 1 < a.steps.length ? a.steps[e + 1].film : d;
      passages.push({film_de_s: t2(a.steps[k].film), film_a_s: t2(Math.min(fin, d)), morceau_de_s: t2(k === 0 ? a.pickup : bars[a.steps[k].bar].start), morceau_a_s: t2(bars[a.steps[e].bar].end),
        role: k === 0 ? 'ouverture' : e === a.steps.length - 1 && a.endingKind !== 'fade' ? (a.endingKind === 'button' ? 'accent final' : 'fin') : 'milieu'});
      k = e + 1;
    }
  } else for (const g of plan.segs) { if (g.out < d) passages.push({film_de_s: t2(g.out), film_a_s: t2(Math.min(d, g.out + g.len)), morceau_de_s: t2(g.from), morceau_a_s: t2(g.from + Math.min(g.len, d - g.out))}); }
  const raccords = (a?.joins ?? []).map((j, i) => {
    const m = mes?.joins?.[i];
    return {a_s: t2(j.at), mesures: `${j.from}→${j.to}`, accords: j.chords, douceur: t2(j.score), jugement: j.score >= A.GOOD_JOIN ? 'bon' : j.score >= A.OK_JOIN ? 'correct' : 'rude',
      ...(m ? {volume_avant_db: arrondi(m.before, 1), volume_apres_db: arrondi(m.after, 1)} : {})};
  });
  for (const r of raccords) if (r.jugement === 'rude') attention.push(`Le raccord à ${r.a_s} s est rude (douceur ${r.douceur}) : il peut s’entendre. Écoute-le, ou change la durée du film d’une mesure.`);
  for (const j of mes?.jumps ?? []) attention.push(`Le volume saute de ${j.db > 0 ? '+' : ''}${arrondi(j.db, 1)} dB vers ${t2(j.at)} s${j.atJoin ? ' (à un raccord)' : ''}, ce que le morceau ne fait pas tout seul : écoute ce passage.`);
  let fin;
  if (a?.ending?.kind === 'natural') {
    const en = a.ending;
    fin = {sorte: 'la vraie fin du morceau', forme: FORMES_DE_FIN[en.type] ?? en.type, mesures: en.bars, ...(en.landing != null ? {accent_s: t2(en.landing)} : {}), ...(en.finalChord != null ? {accord_final_s: t2(en.finalChord)} : {}), musique_finit_s: t2(en.musicEnds), ...(en.slack > 0.05 ? {silence_final_s: t2(en.slack)} : {})};
  } else if (a?.ending?.kind === 'button') {
    fin = {sorte: 'un accent final qui résonne', fabrique: true, accent_s: t2(a.ending.landing)};
    attention.push(`La fin est fabriquée : un accord du morceau (à ${t2(a.ending.landing)} s), prolongé par une réverbération qui n’est pas la sienne. Pose le carton de fin sur cet accent, et dis-le à la personne.`);
  } else fin = {sorte: 'un fondu', depuis_s: t2(a?.ending?.fadeFrom ?? plan.fade.from)};
  if (!a && recoupe) {
    const note = plan.arrangeNote ?? '';
    attention.push(`Le morceau n’a pas été recoupé (${SANS_RECOUPE.find(([re]) => re.test(note))?.[1] ?? (note || 'le moteur n’a pas trouvé de recoupe')}) : il est ${plan.looped ? 'bouclé' : 'pris depuis son début'} et fondu à la fin.`);
  }
  if (plan.looped) attention.push(`Le morceau (${t2(Math.min(an.end, an.duration))} s) est plus court que le film : il est rejoué en boucle${plan.usable ? ' sur ses barres de mesure' : ''}.`);
  if (!plan.usable) attention.push(`Pas de pulsation nette (confiance ${arrondi(an.confidence, 2)}) : les temps rendus sont une supposition.`);
  if (gain < 1) attention.push(`Le morceau dépassait −1 dB : il est baissé de ${arrondi(-20 * Math.log10(gain), 1)} dB d’un bloc, sans rien changer d’autre.`);
  const sansRecoupe = a ? (a.fitDurations ?? A.fitDurations(an, d)).filter((x) => Math.abs(x.seconds - d) > 0.05).map((x) => t2(x.seconds)) : [];
  return {
    ok: true, fichier: sortie, duree_s: t2(d), volume_lufs: arrondi(volume, 1), crete_db: arrondi(20 * Math.log10(Math.max(crete * gain, 1e-9)), 1),
    morceau: {fichier, duree_s: t2(an.duration), fin_musique_s: t2(an.end), tempo: t2(plan.bpm), confiance: t2(an.confidence)},
    facon: a ? 'recoupé' : plan.looped ? 'bouclé' : 'coupe droite',
    passages, raccords, fin,
    ...(film.montee != null ? {montee: {a_s: film.montee, sur_une_vraie_montee: a?.liftOn?.burst != null}} : {}),
    ...(film.sommet != null ? {sommet: {a_s: film.sommet, sur_une_vraie_montee: a?.liftOn?.peak != null && !a.liftOn.peakEarly}} : {}),
    temps: sansDoublons(plan.beats, d), mesures: sansDoublons(plan.downbeats, d),
    sections: plan.sections.filter((x) => x.start < d).map((x) => ({de_s: t2(x.start), a_s: t2(Math.min(d, x.end)), energie: t2(x.energy)})),
    sommets: plan.drops.filter((x) => x.t <= d).map((x) => ({a_s: t2(x.t), force: t2(x.score)})),
    ...(sansRecoupe.length ? {durees_sans_recoupe_s: [...new Set(sansRecoupe)]} : {}),
    ...(a ? {rapport_du_moteur: A.arrangeLines(an, plan, mes)} : {}),
    calcul_s: arrondi((Date.now() - t0) / 1000, 1),
    ...(attention.length ? {attention} : {}),
  };
}
