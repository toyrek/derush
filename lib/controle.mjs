// Dérush — le contrôle des textes à l'écran. Dérush lit chaque image de la vidéo (Apple Vision, sur le Mac) et cherche
// ce qu'un bon monteur ne laisse jamais passer : des mots collés (« cettecollection »), un texte coupé au bord de
// l'image (« DEKO » pour « HIDEKO »), un texte caché par les boutons du réseau. Seuls les mots du montage comptent
// (ce qui est dit, les titres, les sous-titres) : le texte filmé (une page de manga, un livre) n'est pas jugé.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg} from './outils.mjs';
import {MAC} from './plateforme.mjs';
import {etatMoteurs, lancerPython} from './moteurs.mjs';
import {PLATEFORMES} from '../public/moteur.js';

/** Un mot réduit à ses lettres et chiffres, en minuscules et sans accents (« J’ai » → « jai »). */
export const normaliser = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// les petits mots d'une lettre qui peuvent se coller au suivant (« l’ », « d’ », « à », « y »…)
const UNE_LETTRE = new Set(['a', 'y', 'l', 'd', 'j', 'm', 'n', 's', 't', 'c', 'o', 'i']);

/** Les mots d'un texte, normalisés : le mot entier, et ses morceaux autour d'une apostrophe ou d'un trait d'union. */
export function motsDe(texte) {
  const r = [];
  for (const brut of String(texte ?? '').split(/\s+/)) {
    const n = normaliser(brut);
    if (!n) continue;
    r.push(n);
    const parts = brut.split(/['’\-‑–]/).map(normaliser).filter(Boolean);
    if (parts.length > 1) r.push(...parts);
  }
  return r;
}

// les clés d'un texte montré ou dit (pas « nom » ni « detail » : ce sont des descriptions, pas ce qu'on voit à l'écran)
const CLES_TEXTE = /^(t|texte|text|word|mot|mots|titre|title|sous_titre|soustitre|sous_titres|legende|ligne|lignes|phrase|dit|texte_ecran|surtitre|etiquette)$/i;

/** Les textes d'un JSON : les chaînes rangées sous une clé de texte (« t », « texte », « titre »…), à toute profondeur. */
export function textesJson(j, cle = '', out = []) {
  if (typeof j === 'string') { if (CLES_TEXTE.test(cle)) out.push(j); return out; }
  if (Array.isArray(j)) { for (const x of j) textesJson(x, cle, out); return out; }
  if (j && typeof j === 'object') for (const [k, v] of Object.entries(j)) textesJson(v, k, out);
  return out;
}

/** Les textes d'un fichier : JSON (clés de texte), sous-titres SRT ou VTT, code du kit (chaînes et texte JSX), texte brut. */
export function textesFichier(f) {
  let s;
  try { s = fs.readFileSync(f, 'utf8'); } catch { return []; }
  if (s.length > 8e6) return [];
  if (/\.json$/i.test(f)) { try { return textesJson(JSON.parse(s)); } catch { return []; } }
  if (/\.(srt|vtt)$/i.test(f)) return s.split(/\r?\n/).filter((l) => l.trim() && !/-->/.test(l) && !/^\d+$/.test(l.trim()) && !/^WEBVTT/.test(l));
  if (/\.(tsx?|jsx?|mjs)$/i.test(f)) {
    const out = [];
    // une chaîne qui s'affiche (« COLLECTION HÉRITAGES », « Service presse ») a une majuscule, une espace ou un accent ;
    // un mot de code (« background », « absolute ») n'en a pas
    for (const m of s.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.){2,120})\1/g)) if (/\p{L}{2}/u.test(m[2]) && !/[{}$<>=;]|\/\//.test(m[2]) && /[\p{Lu}\s]|[^\x00-\x7f]/u.test(m[2])) out.push(m[2]);
    for (const m of s.matchAll(/>([^<>{}\n]{2,120})</g)) if (/\p{L}{2}/u.test(m[1])) out.push(m[1]);
    return out;
  }
  return s.split(/\r?\n/);
}

/** Les fichiers de texte d'un pack de montage : ce qui est dit, les sous-titres, les titres, la table de montage, le code du kit. */
export function fichiersTextePack(pack) {
  const r = [];
  const ajouter = (f) => { try { if (fs.statSync(f).isFile()) r.push(f); } catch { /* absent */ } };
  const parcourir = (d, filtre, profondeur = 4) => {
    if (profondeur < 0) return;
    let l = [];
    try { l = fs.readdirSync(d, {withFileTypes: true}); } catch { return; }
    for (const e of l) {
      // le moteur d'habillage du kit est du code de Dérush, pas un texte du montage (ses textes sont dans montage.json)
      if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'moteur.js') continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) parcourir(f, filtre, profondeur - 1);
      else if (filtre.test(e.name)) r.push(f);
    }
  };
  ajouter(path.join(pack, 'montage.json'));
  ajouter(path.join(pack, 'rendu', 'timeline.json'));
  parcourir(path.join(pack, 'sous-titres'), /\.(json|srt|vtt)$/i, 1);
  parcourir(path.join(pack, 'transcriptions'), /\.json$/i, 1);
  parcourir(path.join(pack, 'remotion', 'src'), /\.(json|tsx?|jsx?)$/i);
  parcourir(path.join(pack, 'rendu', 'livraison'), /\.(srt|vtt|json)$/i, 2);
  return r;
}

/** Le vocabulaire du montage : l'ensemble des mots normalisés de ces textes. */
export function vocabulaire(textes) {
  const v = new Set();
  for (const t of textes) for (const m of motsDe(t)) v.add(m);
  return v;
}

/**
 * « cettecollection » → ["cette", "collection"] : un mot lu fait de deux mots du montage, sans rien entre eux (une
 * apostrophe, un trait d'union ou un signe entre les deux, comme « qu'une », séparent déjà les mots). Sinon null.
 */
export function decoupeCollee(brut, vocab) {
  const s = String(brut ?? '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  const n = normaliser(s);
  if (n.length < 4 || vocab.has(n)) return null;
  const c = [...s];
  const lettre = (x) => /[\p{L}\p{N}]/u.test(x ?? '');
  for (let i = 1; i < c.length; i++) {
    if (!lettre(c[i - 1]) || !lettre(c[i])) continue;
    const a = normaliser(c.slice(0, i).join(''));
    const b = normaliser(c.slice(i).join(''));
    if (b.length < 2 || (a.length < 2 && !UNE_LETTRE.has(a))) continue;
    if (vocab.has(a) && vocab.has(b)) return [a, b];
  }
  return null;
}

/** Le mot du vocabulaire dont ce mot lu n'est qu'un morceau coupé (« deko » → « hideko »), sinon null. */
export function motTronque(n, vocab, cote) {
  if (n.length < 3 || vocab.has(n)) return null;
  let meilleur = null;
  for (const v of vocab) {
    if (v.length < n.length + 1 || v.length < 4) continue;
    const ok = cote === 'gauche' ? v.endsWith(n) : cote === 'droite' ? v.startsWith(n) : v.includes(n);
    if (ok && (!meilleur || v.length < meilleur.length)) meilleur = v;
  }
  return meilleur;
}

const BORD = 0.004;
const SEPARATEURS = /[•·|/\\]+/;

/** Les mots lus, coupés autour d'un séparateur (« MIZUNO•AKATA » → « MIZUNO », « AKATA »), boîtes au prorata des lettres. */
export function separer(mots) {
  const r = [];
  for (const m of mots) {
    const morceaux = String(m.t).split(SEPARATEURS);
    if (morceaux.length < 2) { r.push(m); continue; }
    const total = [...String(m.t)].length || 1;
    let pos = 0;
    for (const x of String(m.t).split(/([•·|/\\]+)/)) {
      const n = [...x].length;
      if (x && !SEPARATEURS.test(x)) r.push({...m, t: x, x: m.x + (m.l * pos) / total, l: (m.l * n) / total});
      pos += n;
    }
  }
  return r;
}
const arrondi = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
const tempsLisible = (t) => `${String(arrondi(t, 1)).replace('.', ',')} s`;

/**
 * Juge ce que la lecture a trouvé. `lecture` = {images: [{t, lignes: [{t, mots: [{t, x, y, l, h}]}]}]} (boîtes en
 * fractions de l'image, origine en haut à gauche) ; `vocab` = vocabulaire du montage ; `zones` = marges cachées par
 * le réseau ({haut, bas, gauche, droite}) ou null. Renvoie {problemes, attention, images_a_voir}.
 */
export function juger(lecture, vocab, {zones = null, ips = 3, filme = []} = {}) {
  // le texte déjà filmé dans les rushes (une page de manga, la couverture d'un livre, une enseigne), lignes réduites à
  // leurs lettres : ce texte-là n'est pas celui du montage, on ne le juge pas
  // (6 lettres au moins : un mot court comme « etil » se retrouve partout dans un texte)
  const dejaFilme = (x) => x.length >= 6 && filme.some((l) => l.includes(x));
  const trouves = new Map(); // clé → {type, texte, detail, vus: [{t, image, boite}]}
  const noter = (type, texte, detail, t, image, boite) => {
    const cle = `${type}|${normaliser(texte)}`;
    const x = trouves.get(cle) ?? {type, texte, n: normaliser(texte), detail, vus: []};
    x.vus.push({t, image, boite});
    trouves.set(cle, x);
  };
  // les paires de mots lus avec un séparateur entre eux (« MIZUNO • AKATA ») : si une image voisine montre ce
  // séparateur au même endroit, « MIZUNOAKATA » lu sur une autre est une erreur de lecture (le point a échappé)
  const echap = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const paires = new Map();
  for (const im of lecture.images) for (const ligne of im.lignes ?? []) {
    const ms = separer(ligne.mots ?? []).map((m) => ({...m, n: normaliser(m.t)})).filter((m) => m.n);
    for (let i = 1; i < ms.length; i++) {
      const a = ms[i - 1];
      const b = ms[i];
      if (!new RegExp(`${echap(a.t)}\\s*[•·|/\\\\]+\\s*${echap(b.t)}`).test(ligne.t ?? '')) continue;
      const cle = `${a.n}|${b.n}`;
      const x0 = Math.min(a.x, b.x);
      const y0 = Math.min(a.y, b.y);
      const l = paires.get(cle) ?? [];
      l.push({x: x0, y: y0, l: Math.max(a.x + a.l, b.x + b.l) - x0, h: Math.max(a.y + a.h, b.y + b.h) - y0});
      paires.set(cle, l);
    }
  }
  const luSepare = (colle, m) => (paires.get(colle.join('|')) ?? []).some((p) => Math.abs(p.x + p.l / 2 - (m.x + m.l / 2)) < 0.04 && Math.abs(p.y + p.h / 2 - (m.y + m.h / 2)) < 0.03);
  lecture.images.forEach((im, k) => {
    for (const ligne of im.lignes ?? []) {
      const mots = separer(ligne.mots ?? []).map((m) => ({...m, n: normaliser(m.t)})).filter((m) => m.n);
      // un vrai mot (connu du correcteur du Mac) n'est jamais deux mots collés
      const colleDe = (m) => (m.connu === true ? null : decoupeCollee(m.t, vocab));
      const duMontage = (m) => vocab.has(m.n) || !!colleDe(m);
      const nDuMontage = mots.filter(duMontage).length;
      // la part des autres mots de la ligne (4 lettres ou plus) qui sont du montage : une ligne de sous-titre ou un
      // titre en a presque tous ; une bulle de manga ou la couverture d'un livre, peu (null : le mot est seul)
      const longs = mots.filter((x) => x.n.length >= 4);
      const couverture = (m) => { const autres = longs.filter((x) => x !== m); return autres.length ? autres.filter(duMontage).length / autres.length : null; };
      const texteDuMontage = (m, hSeul) => { const c = couverture(m); return c != null ? c >= 0.6 : m.h >= hSeul; };
      const ligneN = mots.map((x) => x.n).join('');
      const ligneFilmee = ligneN.length >= 6 ? dejaFilme(ligneN) : false;
      for (const m of mots) {
        const boite = {x: m.x, y: m.y, l: m.l, h: m.h};
        // 1. des mots collés : un mot lu fait de deux mots du montage, dans un texte du montage (ou en grand)
        const colle = colleDe(m);
        if (colle && (nDuMontage >= 2 || m.h >= 0.025) && !luSepare(colle, m) && !dejaFilme(m.n) && !ligneFilmee) noter('mots_colles', m.t.replace(/[,.;:!?…]+$/, ''), `« ${colle.join(' ')} » : il manque l'espace entre les mots`, im.t, k, boite);
        // 2. un texte coupé au bord de l'image : un morceau de mot du montage collé au bord
        const gauche = m.x <= BORD;
        const droite = m.x + m.l >= 1 - BORD;
        const hautBas = m.y <= BORD * 0.75 || m.y + m.h >= 1 - BORD * 0.75;
        const visible = m.n.length >= 3 && m.h >= 0.015;
        if ((gauche || droite || hautBas) && !ligneFilmee && !(mots.length === 1 && m.n.length >= 5 && dejaFilme(m.n))) {
          const tronque = motTronque(m.n, vocab, gauche ? 'gauche' : droite ? 'droite' : null);
          if (tronque && texteDuMontage(m, 0.02)) noter('texte_coupe', m.t, `« ${tronque} » coupé au bord ${gauche ? 'gauche' : droite ? 'droit' : m.y <= BORD ? 'du haut' : 'du bas'} de l'image`, im.t, k, boite);
          else if (!tronque && visible && duMontage(m) && texteDuMontage(m, 0.025)) noter('bord', m.t, 'touche le bord de l’image', im.t, k, boite);
        }
        // 3. un texte du montage sous l'interface du réseau (boutons, légende, onglets)
        if (zones && visible && duMontage(m) && texteDuMontage(m, 0.025) && !ligneFilmee && !(mots.length === 1 && m.n.length >= 5 && dejaFilme(m.n))) {
          const tol = 0.01;
          const cache = m.y < zones.haut - tol ? 'en haut' : m.y + m.h > 1 - zones.bas + tol ? 'en bas' : m.x < zones.gauche - tol ? 'à gauche' : m.x + m.l > 1 - zones.droite + tol ? 'à droite' : null;
          if (cache) noter('zone', m.t, `sous l'interface du réseau (${cache})`, im.t, k, boite);
        }
      }
    }
  });
  const problemes = [];
  const attention = [];
  const unPas = 1 / ips + 1e-6;
  for (const x of trouves.values()) {
    x.vus.sort((a, b) => a.t - b.t);
    const temps = [...new Set(x.vus.map((v) => v.t))];
    // immobile : vu au même endroit sur deux images qui se suivent. Un texte filmé (une page qui défile, un livre qu'on
    // tourne) bouge, une entrée animée aussi ; un titre ou un sous-titre posé sur l'image, non.
    let immobile = false;
    for (let i = 1; i < x.vus.length && !immobile; i++) {
      const a = x.vus[i - 1];
      const b = x.vus[i];
      if (b.t > a.t && b.t - a.t <= unPas * 1.01 && Math.abs(a.boite.x - b.boite.x) < 0.012 && Math.abs(a.boite.y - b.boite.y) < 0.012 && Math.abs(a.boite.l - b.boite.l) < 0.02) immobile = true;
    }
    const r = {type: x.type, texte: x.texte, n: x.n, vu: temps.length, immobile, detail: x.detail, temps,
      a: temps.map(tempsLisible).slice(0, 6).join(', ') + (temps.length > 6 ? '…' : ''), boites: x.vus.map((v) => ({image: v.image, boite: v.boite}))};
    if (x.type === 'mots_colles') problemes.push(r);
    else if (x.type === 'texte_coupe') { if (immobile) problemes.push(r); else if (temps.length >= 2) attention.push(r); }
    else if (immobile) attention.push(r); // au bord, ou sous l'interface : à regarder
  }
  const ordre = (a, b) => a.temps[0] - b.temps[0];
  return {problemes: problemes.sort(ordre), attention: attention.sort(ordre)};
}

/**
 * L'accroche écrite : le plus grand texte du montage dans les `duree` premières secondes (hauteur d'une ligne lue, en
 * part de la hauteur de l'image). Sous `seuil` (7 %), elle est discrète : sur un téléphone, ça ne se lit pas en passant.
 * Mesuré sur la chronique du 13 nov. 2026 : Fable « RÉCEPTION PRESSE » 13 à 19 %, Sonnet « FIRE » 12 à 14 %,
 * Opus « SERVICE PRESSE » 6 à 9 % puis « FIRE » 11 %, Opus corrigé 1,5 % (étiquette) et 5,5 % (sous-titres).
 */
export function accrocheEcrite(lecture, vocab, {filme = [], duree = 2, seuil = 0.07} = {}) {
  let mieux = null;
  // un titre très stylisé se lit mal (« FIRE! » lu « FIRET ») : un mot à une lettre près d'un mot du montage compte
  const vocabLong = [...vocab].filter((v) => v.length >= 3);
  const proche = (n) => vocab.has(n) || (n.length >= 4 && vocabLong.some((v) => Math.abs(v.length - n.length) <= 1 && uneLettrePres(v, n)));
  lecture.images.forEach((im, k) => {
    if (im.t > duree + 1e-6) return;
    for (const l of im.lignes ?? []) {
      const mots = separer(l.mots ?? []).map((m) => ({...m, n: normaliser(m.t)})).filter((m) => m.n);
      const ln = mots.map((m) => m.n).join('');
      if (ln.length < 2) continue;
      if (ln.length >= 4 && filme.some((f) => f.includes(ln))) continue; // filmé (un livre, une enseigne)
      const h = Math.max(l.h ?? 0, ...mots.map((m) => m.h ?? 0));
      // un texte du montage ; ou un grand texte qui n'est pas dans les rushes : il a forcément été ajouté au montage
      if (!mots.some((m) => proche(m.n)) && !(h >= seuil && ln.length >= 3 && filme.length)) continue;
      if (!mieux || h > mieux.h) mieux = {h, texte: l.t, t: im.t, image: k, boite: {x: l.x, y: l.y, l: l.l, h: l.h}};
    }
  });
  const pct = (x) => `${String(Math.round(x * 1000) / 10).replace('.', ',')} %`;
  if (mieux && mieux.h >= seuil) return {ok: true, hauteur_pct: Math.round(mieux.h * 1000) / 10, texte: mieux.texte, t: mieux.t, image: mieux.image, boite: mieux.boite};
  return {ok: false, hauteur_pct: mieux ? Math.round(mieux.h * 1000) / 10 : 0, texte: mieux?.texte ?? null, t: mieux?.t ?? null, image: mieux?.image ?? null, boite: mieux?.boite ?? null,
    detail: mieux
      ? `le plus grand texte des ${duree} premières secondes (« ${mieux.texte} ») fait ${pct(mieux.h)} de la hauteur : un titre de 2 ou 3 mots en grand (${pct(seuil)} ou plus, par exemple derrière la personne) dit le sujet d'un coup d'œil. Si l'accroche est ailleurs (un geste, une image forte), garde-la.`
      : `aucun texte dans les ${duree} premières secondes : un titre de 2 ou 3 mots en grand dit le sujet d'un coup d'œil (si l'accroche est une image forte ou un geste, garde-la).`};
}

/** Deux mots à une lettre près (une lettre changée, ajoutée ou retirée). */
function uneLettrePres(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let ecarts = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++ecarts > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return ecarts + (a.length - i) + (b.length - j) <= 1;
}

/** Les phrases à dire : une par défaut trouvé. */
export function phrases(j) {
  const nom = {mots_colles: 'Mots collés', texte_coupe: 'Texte coupé', zone: 'Caché par le réseau', bord: 'Au bord', accroche: 'Accroche discrète'};
  return [...j.problemes.map((p) => `${nom[p.type]} : « ${p.texte} » à ${p.a} — ${p.detail}`),
    ...j.attention.map((p) => (p.type === 'accroche' ? `Accroche discrète : ${p.detail}` : `À regarder (${nom[p.type].toLowerCase()}) : « ${p.texte} » à ${p.a} — ${p.detail}`))];
}

const VIDEO = /\.(mp4|mov|m4v|mkv|webm|mxf|avi|mts)$/i;

/**
 * Le texte filmé dans les rushes d'un pack (`plans/`) : une image par seconde (240 au plus par rush), lue par Apple
 * Vision ; chaque ligne réduite à ses lettres. Gardé dans `rendu/controle/.texte-filme.json` (par fichier, taille et date).
 */
export async function texteFilme(pack, prog = () => {}) {
  const d = path.join(pack, 'plans');
  let noms = [];
  try { noms = fs.readdirSync(d).filter((n) => VIDEO.test(n)).sort(); } catch { return []; }
  if (!noms.length) return [];
  const fCache = path.join(pack, 'rendu', 'controle', '.texte-filme.json');
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(fCache, 'utf8')); } catch { /* pas encore lu */ }
  const lignes = new Set();
  let change = false;
  for (const [k, n] of noms.entries()) {
    const f = path.join(d, n);
    let st;
    try { st = fs.statSync(f); } catch { continue; }
    const cle = `${n}|${st.size}|${Math.round(st.mtimeMs)}`;
    if (!cache[cle]) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-filme-'));
      try {
        await ffmpeg(['-y', '-i', f, '-vf', "fps=1,scale='min(1920,iw)':-2", '-frames:v', '240', '-q:v', '3', path.join(tmp, 'i%05d.jpg')]);
        await lancerPython('controle.py', ['lire', tmp, path.join(tmp, 'l.json')]);
        const lu = JSON.parse(fs.readFileSync(path.join(tmp, 'l.json'), 'utf8'));
        cache[cle] = [...new Set(lu.images.flatMap((im) => (im.lignes ?? []).map((l) => separer(l.mots ?? []).map((m) => normaliser(m.t)).join('')).filter((x) => x.length >= 4)))];
        change = true;
      } catch { cache[cle] = []; } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
    }
    for (const l of cache[cle]) lignes.add(l);
    prog((k + 1) / noms.length);
  }
  if (change) { try { fs.mkdirSync(path.dirname(fCache), {recursive: true}); fs.writeFileSync(fCache, JSON.stringify(cache)); } catch { /* sans cache */ } }
  return [...lignes];
}

/** Le contrôle est-il possible ici ? (Apple Vision, sur un Mac, avec le Python de Dérush.) */
export async function controlePossible() {
  if (!MAC) return {ok: false, pourquoi: 'La lecture du texte à l’écran utilise Apple Vision : elle n’existe que sur Mac. Regarde toi-même les images en pleine taille.'};
  const e = await etatMoteurs().catch(() => null);
  if (!e?.detourage?.ok) return {ok: false, pourquoi: 'La lecture du texte à l’écran a besoin du moteur de détourage de Dérush (Réglages › Moteurs).'};
  return {ok: true};
}

/**
 * Contrôle les textes d'une vidéo. `pack` = dossier du pack (pour le vocabulaire), `textes` = autres fichiers de
 * texte, `plateforme` = réseau visé (zones cachées), `ips` = images lues par seconde, `sortie` = dossier des planches.
 * Renvoie {ok, problemes, attention, phrases, planche, images_lues} ; {ok: false, pourquoi} si la lecture est impossible.
 */
export async function controlerTextes(video, {pack = null, textes = [], plateforme = null, ips = 3, sortie = null, prog = () => {}} = {}) {
  const possible = await controlePossible();
  if (!possible.ok) return {ok: false, pourquoi: possible.pourquoi, problemes: [], attention: [], phrases: []};
  const fichiers = [...(pack ? fichiersTextePack(pack) : []), ...textes];
  const vocab = vocabulaire(fichiers.flatMap(textesFichier));
  if (vocab.size < 3) return {ok: false, pourquoi: 'Aucun texte du montage trouvé (sous-titres, transcription, titres) : donne le dossier du pack avec --pack.', problemes: [], attention: [], phrases: []};
  const zones = PLATEFORMES[plateforme]?.zones ?? null;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-controle-'));
  try {
    await ffmpeg(['-y', '-i', video, '-vf', `fps=${ips}`, '-q:v', '2', path.join(tmp, 'i%05d.jpg')]);
    const brut = path.join(tmp, 'lecture.json');
    await lancerPython('controle.py', ['lire', tmp, brut], (p) => prog(p * 0.85));
    const lu = JSON.parse(fs.readFileSync(brut, 'utf8'));
    const lecture = {images: lu.images.map((im, k) => ({...im, t: arrondi(k / ips, 2)}))};
    // le texte déjà filmé dans les rushes : jamais jugé (une page de manga, la couverture d'un livre)
    const filme = pack ? await texteFilme(pack).catch(() => []) : [];
    const j = juger(lecture, vocab, {zones, ips, filme});
    const accroche = accrocheEcrite(lecture, vocab, {filme});
    // des mots collés vus sur une seule image : relus sur deux images voisines, pour écarter une erreur de lecture
    const douteux = j.problemes.filter((p) => p.type === 'mots_colles' && p.vu === 1);
    if (douteux.length) {
      const dc = path.join(tmp, 'confirme');
      fs.mkdirSync(dc);
      const quand = [];
      for (const p of douteux) for (const dt of [-0.12, 0.12]) quand.push({p, t: Math.max(0, p.temps[0] + dt)});
      for (const [k, q] of quand.entries()) await ffmpeg(['-y', '-ss', q.t.toFixed(3), '-i', video, '-frames:v', '1', '-q:v', '2', path.join(dc, `c${String(k).padStart(4, '0')}.jpg`)]).catch(() => {});
      const brut2 = path.join(tmp, 'confirme.json');
      await lancerPython('controle.py', ['lire', dc, brut2]).catch(() => {});
      let relu = [];
      try { relu = JSON.parse(fs.readFileSync(brut2, 'utf8')).images; } catch { /* rien de relu */ }
      const vuSur = (im) => new Set((im?.lignes ?? []).flatMap((l) => separer(l.mots ?? []).map((m) => normaliser(m.t))));
      for (const p of douteux) {
        const revu = quand.some((q, k) => q.p === p && relu.some((im) => im.fichier === `c${String(k).padStart(4, '0')}.jpg` && vuSur(im).has(p.n)));
        if (revu) p.vu = 2;
        else {
          j.problemes.splice(j.problemes.indexOf(p), 1);
          j.attention.push({...p, detail: `${p.detail} (vu sur une seule image : peut-être une erreur de lecture)`});
        }
      }
      j.attention.sort((a, b) => a.temps[0] - b.temps[0]);
    }
    // une accroche discrète : à regarder, en tête (l'IA décide : une image forte peut suffire)
    if (!accroche.ok) j.attention.unshift({type: 'accroche', texte: accroche.texte ?? '', n: '', vu: 1, immobile: true, detail: accroche.detail, temps: [accroche.t ?? 0], a: tempsLisible(accroche.t ?? 0),
      boites: accroche.boite ? [{image: accroche.image, boite: accroche.boite}] : []});
    // la planche : les images où quelque chose ne va pas (rouge = à corriger, orange = à regarder), sinon un survol
    let planche = null;
    if (sortie) {
      fs.mkdirSync(sortie, {recursive: true});
      const parImage = new Map();
      for (const [liste, couleur] of [[j.problemes, '#ff2a2a'], [j.attention, '#ffa020']]) {
        for (const p of liste) for (const b of p.boites) { const x = parImage.get(b.image) ?? []; x.push({...b.boite, couleur}); parImage.set(b.image, x); }
      }
      const choisies = parImage.size ? [...parImage.keys()].sort((a, b) => a - b).slice(0, 30) : lecture.images.map((_, k) => k).filter((k) => k % Math.max(1, Math.round(ips)) === 0).slice(0, 48);
      const desc = {colonnes: parImage.size ? 6 : 8, largeur: parImage.size ? 300 : 200,
        images: choisies.map((k) => ({fichier: path.join(tmp, lu.images[k].fichier), legende: tempsLisible(lecture.images[k].t), boites: parImage.get(k) ?? []}))};
      fs.writeFileSync(path.join(tmp, 'planche.json'), JSON.stringify(desc));
      planche = path.join(sortie, parImage.size ? 'textes-a-corriger.jpg' : 'textes-survol.jpg');
      await lancerPython('controle.py', ['planche', path.join(tmp, 'planche.json'), planche], (p) => prog(0.85 + p * 0.15));
    }
    const sansBoites = (l) => l.map(({boites, ...r}) => r);
    const {image: _i, boite: _b, ...accrocheDite} = accroche;
    return {ok: true, images_lues: lecture.images.length, ips, plateforme: zones ? plateforme : null, vocabulaire: vocab.size, accroche: accrocheDite,
      problemes: sansBoites(j.problemes), attention: sansBoites(j.attention), phrases: phrases(j), planche};
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}
