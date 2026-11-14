// Dérush — le rythme de la parole dans une vidéo finie : un début qui tarde, les pauses qui traînent, les « euh », les
// redites et les mots repris. Whisper (sur l'ordinateur, rien n'est envoyé en ligne) réécoute la vidéo mot à mot.
//
// Sur la chronique du 13 nov. 2026 : Fable a retiré deux redites et trois hésitations (41,6 s), Opus une pause et une
// redite (47,6 s). Ce contrôle montre ce qui reste, pour que l'IA décide en le voyant : tout n'est pas à couper (une
// pause sur une image forte, une répétition voulue).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {etatMoteurs, lancerPython, MODELE_WHISPER} from './moteurs.mjs';
import {depuisJson} from './transcription.mjs';
import {arrondi} from './commun.mjs';

/** Les hésitations (les mêmes que « Enlever les euh » de l'interface). */
export const HESITATIONS = new Set(['euh', 'heu', 'euhh', 'euhhh', 'heuu', 'hum', 'humm', 'hmm', 'hmmm', 'mmh', 'mmm', 'uh', 'uhm', 'um', 'umm', 'erm', 'bah']);
// des mots qu'on double sans faute (« nous nous », « vous vous », « si si », « salut salut », « ciao ciao ») : jamais une reprise
const DOUBLES_NORMAUX = new Set(['nous', 'vous', 'si', 'non', 'oui', 'tres', 'bon', 'allez', 'vite', 'tout', 'fort', 'loin', 'plus', 'salut', 'ciao', 'bye', 'coucou', 'merci', 'bravo', 'hop', 'ok', 'oh', 'ah', 'eh', 'voila', 'chut', 'bien', 'beaucoup', 'encore']);

const normal = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’]/g, "'").replace(/[^a-z0-9']/g, '');
const temps = (s) => `${(Math.round(s * 10) / 10).toFixed(1).replace('.', ',')} s`;

/**
 * Juge une suite de mots {t, d, f} (secondes dans la vidéo). Renvoie {mots, debit_mots_min, debut_parole_s, pauses,
 * hesitations, redites, reprises, gain_possible_s, attention: [phrases]}.
 * `pauseMax` : une pause plus longue est signalée (0,7 s : au-delà, ça s'entend comme un trou dans une vidéo courte).
 */
export function jugerRythme(liste, {pauseMax = 0.7, debutMax = 0.6, fenetreRedite = 25} = {}) {
  const mots = liste.filter((w) => w && w.t && !w.ev && Number.isFinite(w.d) && Number.isFinite(w.f)).map((w) => ({...w, n: normal(w.t)})).filter((w) => w.n);
  const r = {mots: mots.length, debit_mots_min: null, debut_parole_s: null, pauses: [], hesitations: [], redites: [], reprises: [], gain_possible_s: 0, attention: []};
  if (mots.length < 3) return r;
  const parole = mots.at(-1).f - mots[0].d;
  r.debit_mots_min = parole > 0 ? Math.round((mots.length / parole) * 60) : null;
  r.debut_parole_s = arrondi(mots[0].d, 2);
  if (mots[0].d > debutMax) r.attention.push(`La parole ne commence qu'à ${temps(mots[0].d)} : les premières secondes décident de tout, commence sur le premier mot (ou sur une image forte).`);
  // les pauses entre deux mots
  for (let i = 1; i < mots.length; i++) {
    const trou = mots[i].d - mots[i - 1].f;
    if (trou > pauseMax) r.pauses.push({a: arrondi(mots[i - 1].f, 2), duree_s: arrondi(trou, 2), avant: mots[i - 1].t, apres: mots[i].t});
    if (trou > 0.4) r.gain_possible_s += trou - 0.25;
  }
  // les hésitations
  for (const w of mots) if (HESITATIONS.has(w.n.replace(/'/g, ''))) { r.hesitations.push({a: arrondi(w.d, 2), mot: w.t}); r.gain_possible_s += Math.max(0, w.f - w.d); }
  // les mots repris : le même mot deux fois de suite (« le le »), ou un mot coupé puis dit en entier (« col- collection »)
  for (let i = 1; i < mots.length; i++) {
    const a = mots[i - 1];
    const b = mots[i];
    const coupe = /[-–…]$/.test(a.t.trim()) && a.n.length >= 2 && b.n.startsWith(a.n.replace(/'/g, ''));
    // une ponctuation entre les deux (« salut. Salut, ») : une répétition voulue, pas un bégaiement
    const voulu = /[.,!?;:…]$/.test(a.t.trim());
    if ((a.n === b.n && !voulu && !DOUBLES_NORMAUX.has(a.n) && !HESITATIONS.has(a.n)) || coupe) r.reprises.push({a: arrondi(a.d, 2), texte: `${a.t} ${b.t}`});
  }
  // les redites : les mêmes 4 mots (ou plus) deux fois en moins de 25 s (« j'ai hâte de le lire »)
  const sans = mots.filter((w) => !HESITATIONS.has(w.n.replace(/'/g, '')));
  const vus = new Map();
  const deja = new Set();
  for (let i = 0; i + 4 <= sans.length; i++) {
    const cle = sans.slice(i, i + 4).map((w) => w.n).join(' ');
    if (cle.replace(/[^a-z]/g, '').length < 10) continue; // « de la de la » : trop court pour être une redite
    const avant = vus.get(cle);
    if (avant != null && sans[i].d - sans[avant].d <= fenetreRedite && i - avant >= 4 && !deja.has(avant)) {
      // la redite entière : on prolonge tant que les mots suivent
      let n = 4;
      while (i + n < sans.length && avant + n < i && sans[avant + n].n === sans[i + n].n) n++;
      // et vers l'arrière (« j' » + « ai hâte de le lire » : Whisper coupe parfois un mot en deux)
      let a0 = avant;
      let i0 = i;
      while (a0 > 0 && i0 - 1 > a0 + n - 1 && sans[a0 - 1].n === sans[i0 - 1].n && !deja.has(a0 - 1)) { a0--; i0--; n++; }
      r.redites.push({a: arrondi(sans[a0].d, 2), puis: arrondi(sans[i0].d, 2), texte: sans.slice(i0, i0 + n).map((w) => w.t).join(' ').replace(/\s+([’'])/g, '$1').replace(/([’'])\s+/g, '$1')});
      for (let k = 0; k < n; k++) deja.add(a0 + k);
    } else if (avant == null) vus.set(cle, i);
  }
  r.gain_possible_s = arrondi(r.gain_possible_s, 1);
  if (r.pauses.length) r.attention.push(`${r.pauses.length} pause${r.pauses.length > 1 ? 's' : ''} de plus de ${String(pauseMax).replace('.', ',')} s : ${r.pauses.slice(0, 4).map((p) => `${temps(p.a)} (${String(p.duree_s).replace('.', ',')} s, après « ${p.avant} »)`).join(', ')}${r.pauses.length > 4 ? '…' : ''}.`);
  if (r.hesitations.length) r.attention.push(`${r.hesitations.length} hésitation${r.hesitations.length > 1 ? 's' : ''} : ${r.hesitations.slice(0, 5).map((h) => `« ${h.mot} » à ${temps(h.a)}`).join(', ')}${r.hesitations.length > 5 ? '…' : ''}.`);
  if (r.redites.length) r.attention.push(`Redite${r.redites.length > 1 ? 's' : ''} : ${r.redites.slice(0, 3).map((x) => `« ${x.texte} » à ${temps(x.a)} puis ${temps(x.puis)}`).join(' ; ')} : garde la meilleure prise.`);
  if (r.reprises.length) r.attention.push(`Mot${r.reprises.length > 1 ? 's' : ''} repris : ${r.reprises.slice(0, 4).map((x) => `« ${x.texte} » à ${temps(x.a)}`).join(', ')}.`);
  return r;
}

/** Le contrôle du rythme est-il possible ici ? (Whisper installé dans les moteurs de Dérush.) */
export async function rythmePossible() {
  const e = await etatMoteurs().catch(() => null);
  if (!e?.whisper?.ok) return {ok: false, pourquoi: 'Whisper n’est pas installé (Réglages › Moteurs) : le rythme de la parole n’est pas contrôlé.'};
  return {ok: true};
}

/**
 * Réécoute une vidéo finie avec Whisper et juge le rythme de la parole. `langue` : celle du projet (fr par défaut).
 * Renvoie {ok, …jugerRythme} ; {ok: false, pourquoi} si Whisper manque ou si la vidéo est muette.
 */
export async function controlerRythme(video, {langue = 'fr', prog = () => {}} = {}) {
  const possible = await rythmePossible();
  if (!possible.ok) return {ok: false, pourquoi: possible.pourquoi, attention: []};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-rythme-'));
  try {
    const sortie = path.join(tmp, 'whisper.json');
    try {
      await lancerPython('transcrire.py', [video, sortie, langue || 'fr', MODELE_WHISPER], prog);
    } catch (e) {
      if (/Aucun son/i.test(String(e.message))) return {ok: false, pourquoi: 'La vidéo est muette.', attention: []};
      throw e;
    }
    const {mots} = depuisJson(JSON.parse(fs.readFileSync(sortie, 'utf8')));
    return {ok: true, ...jugerRythme(mots.map((w) => ({t: w.t, d: w.d, f: w.f, ev: w.ev})))};
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}
