// Dérush — la porte des IA : un serveur MCP (Model Context Protocol, transport « Streamable HTTP ») sur cet ordinateur.
// Une IA branchée (l'app Claude, Claude Code, ChatGPT par Codex, Gemini, Cursor…) monte directement dans Dérush : elle
// lit le projet, regarde les rushes, pose, coupe, règle, crée la vidéo. Rien ne sort de l'ordinateur : le serveur
// n'écoute que 127.0.0.1, et chaque demande porte la clé de la porte, rangée dans le dossier de Dérush (porte-ia.json,
// lisible par la seule personne). Les apps passent par le pont outils/derush-mcp.mjs, qui lit cette clé.
// Les gestes qui changent le montage sont joués par la fenêtre (public/porte.js) : un geste de l'IA s'annule d'un ⌘Z,
// comme un geste fait à la main, et la personne voit l'IA travailler. Ce qui lit les fichiers est fait ici.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {dossierSupport} from './plateforme.mjs';
import {RACINE_APP} from './moteurs.mjs';
import {VERSION, sequence, segmentA, texteDesMots, arrondi, borner, couleurVersApercu, dureeLisible} from './commun.mjs';
import {DEFINITIONS, CONSIGNES_PORTE, NOM_SERVEUR, ouJouer, nomClient} from './porte-ia-outils.mjs';
import {ffmpeg, POLICE_GRAS, lireJson, ecrireJson} from './outils.mjs';
import {cheminFiltre} from './couleurs.mjs';
import {lireMots} from './transcription.mjs';
import {fichierLecture} from './medias.mjs';
import {lireAnalyseIA} from './analyse.mjs';
import {lireEtiquettes, chercherMontre} from './etiquettes.mjs';
import {CATALOGUE, CATEGORIES, reglagesDe} from '../public/moteur.js';

/** Les versions du protocole que Dérush parle, la plus récente d'abord. */
export const PROTOCOLES = ['2025-06-18', '2025-03-26', '2024-11-05'];
const TAILLE_MAX = 4 * 1024 * 1024;
/** Les outils du serveur qui lisent le montage enregistré : la fenêtre enregistre d'abord ce qu'elle montre. */
const LISENT_LE_MONTAGE = new Set(['creer_video', 'exporter', 'voir_image']);
const DELAI_GESTE_MS = 90000;

/** Le fichier de la porte : la clé, le port du serveur ouvert, et de quoi relancer Dérush. */
export const fichierPorte = () => path.join(dossierSupport(), 'porte-ia.json');
const cleValide = (c) => typeof c === 'string' && /^[0-9a-f]{64}$/.test(c);

/** La clé de la porte (créée une fois, gardée d'un lancement à l'autre : une app branchée continue de marcher). */
export function clePorte() {
  const f = fichierPorte();
  const lu = lireJson(f);
  if (cleValide(lu?.cle)) return lu.cle;
  const cle = crypto.randomBytes(32).toString('hex');
  ecrireFichierPorte({...(lu ?? {}), cle});
  return cle;
}
function ecrireFichierPorte(o) {
  const f = fichierPorte();
  fs.mkdirSync(path.dirname(f), {recursive: true});
  // lisible par la seule personne (0600) : c'est la clé de son montage
  fs.writeFileSync(f, JSON.stringify(o, null, 2), {mode: 0o600});
  try { fs.chmodSync(f, 0o600); } catch { /* Windows : les droits du dossier de Dérush suffisent */ }
}
/** Le serveur est ouvert sur ce port : le pont des apps le lira. */
export function annoncerPorte(port) {
  const cle = clePorte();
  ecrireFichierPorte({cle, port, pid: process.pid, version: VERSION, app: RACINE_APP, node: process.execPath, le: new Date().toISOString()});
  return cle;
}
/** Deux clés égales, en temps constant. */
function memeCle(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

class ErreurRpc extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/** Ce que rend un outil ({texte, donnees, image}) dans la forme du protocole. */
export function contenuOutil(r, erreur = false) {
  const content = [];
  if (r?.image?.data) content.push({type: 'image', data: r.image.data, mimeType: r.image.type || 'image/jpeg'});
  const t = [r?.texte, r?.donnees !== undefined ? JSON.stringify(r.donnees) : null].filter((x) => x != null && x !== '').join('\n');
  content.push({type: 'text', text: t || 'Fait.'});
  return {content, ...(erreur ? {isError: true} : {})};
}

// ——— Ce que joue le serveur : lire les médias ———

const DOSSIER_NOTES = (P) => path.join(P.cache, 'porte');
const lireNotes = (P) => lireJson(path.join(DOSSIER_NOTES(P), 'notes.json')) ?? {};
const nom = (m) => m?.nom ?? m?.id;
const minutes = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
/** Un mot sans majuscule, sans accent ni ponctuation (pour chercher ce qui est dit). */
export const motSimple = (w) => String(w ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');

/** Les phrases d'un média (ou des morceaux de parole quand il n'y a pas de ponctuation), avec leurs temps. */
export function phrases(mots) {
  const res = [];
  let cur = null;
  for (const w of (mots ?? []).filter((x) => !x.ev)) {
    if (cur && (w.debut - cur.fin > 1.2)) { res.push(cur); cur = null; }
    if (!cur) cur = {debut: w.debut, fin: w.fin, texte: ''};
    cur.texte = cur.texte ? `${cur.texte} ${String(w.t).trim()}` : String(w.t).trim();
    cur.fin = w.fin;
    if (/[.!?…]$/.test(String(w.t).trim()) && cur.texte.length > 12) { res.push(cur); cur = null; }
  }
  if (cur) res.push(cur);
  return res.map((p) => ({debut: arrondi(p.debut, 2), fin: arrondi(p.fin, 2), texte: p.texte}));
}

/** Tous les endroits où ces mots sont dits, dans l'ordre, avec quelques mots autour. */
export function chercherDit(mots, cherche) {
  const voulu = String(cherche ?? '').split(/\s+/).map(motSimple).filter(Boolean);
  if (!voulu.length || !mots?.length) return [];
  const liste = mots.filter((w) => !w.ev);
  const simples = liste.map((w) => motSimple(w.t));
  const res = [];
  for (let i = 0; i + voulu.length <= liste.length; i++) {
    let ok = true;
    for (let k = 0; k < voulu.length && ok; k++) ok = simples[i + k] === voulu[k] || (k === voulu.length - 1 && voulu[k].length >= 3 && simples[i + k].startsWith(voulu[k]));
    if (!ok) continue;
    const a = Math.max(0, i - 6);
    const b = Math.min(liste.length, i + voulu.length + 6);
    res.push({debut: arrondi(liste[i].debut, 2), fin: arrondi(liste[i + voulu.length - 1].fin, 2), autour: `${a > 0 ? '…' : ''}${texteDesMots(liste.slice(a, b))}${b < liste.length ? '…' : ''}`});
  }
  return res;
}

/** Une planche d'images d'un fichier : chaque image marquée de son temps (sans police : sans les temps). */
async function plancheFichier(fichier, temps, sortie, {largeur = 320, hauteur = 180} = {}) {
  const n = temps.length;
  const cols = n <= 4 ? n : n <= 6 ? 3 : 4;
  const lignes = Math.ceil(n / cols);
  const args = ['-y', '-v', 'error'];
  for (const t of temps) args.push('-ss', Math.max(0, t).toFixed(3), '-i', fichier);
  const marque = (t) => `,drawtext=fontfile=${cheminFiltre(POLICE_GRAS)}:text='${Number(t).toFixed(1).replace('.', ',')} s':fontsize=18:fontcolor=white:box=1:boxcolor=0x000000@0.65:boxborderw=5:x=8:y=h-th-8`;
  const graphe = (avec) => `${temps.map((t, k) => `[${k}:v]scale=${largeur}:${hauteur}:force_original_aspect_ratio=decrease,pad=${largeur}:${hauteur}:(ow-iw)/2:(oh-ih)/2:color=black${avec ? marque(t) : ''}[c${k}]`).join(';')};${temps.map((_, k) => `[c${k}]`).join('')}xstack=inputs=${n}:layout=${temps.map((_, k) => `${(k % cols) * largeur}_${Math.floor(k / cols) * hauteur}`).join('|')}:fill=black[v]`;
  const faire = (avec) => ffmpeg([...args, '-filter_complex', n === 1 ? `[0:v]scale=${largeur * 2}:${hauteur * 2}:force_original_aspect_ratio=decrease${avec ? marque(temps[0]) : ''}[v]` : graphe(avec), '-map', '[v]', '-frames:v', '1', '-q:v', '4', sortie]);
  try {
    if (!POLICE_GRAS) throw new Error('sans police');
    await faire(true);
  } catch {
    await faire(false);
  }
  return {cols, lignes};
}

/** Le filtre FFmpeg qui donne la couleur d'un plan comme l'aperçu de Dérush (contraste, température, exposition, saturation). */
export function filtreCouleur(couleur) {
  const {avant, matrice, apres} = couleurVersApercu(couleur);
  const f = [];
  const c = /contrast\(([\d.]+)\)/.exec(avant)?.[1];
  if (c) f.push(`eq=contrast=${c}`);
  if (matrice) f.push(`colorchannelmixer=rr=${matrice[0].toFixed(4)}:gg=${matrice[1].toFixed(4)}:bb=${matrice[2].toFixed(4)}`);
  const b = /brightness\(([\d.]+)\)/.exec(apres)?.[1];
  if (b) f.push(`colorchannelmixer=rr=${b}:gg=${b}:bb=${b}`);
  const s = /saturate\(([\d.]+)\)/.exec(apres)?.[1];
  if (s) f.push(`eq=saturation=${s}`);
  return f;
}

/** Ce qui se voit au temps t du montage (d'après le projet enregistré) : le plan, et ce qui est posé par-dessus. */
export function imageAuTemps(d, t) {
  const seq = sequence(d);
  if (!seq.segs.length) return null;
  const tt = borner(Number.isFinite(t) ? t : 0, 0, Math.max(0, seq.duree - 1e-6));
  const s = segmentA(seq, tt) ?? seq.segs.at(-1);
  const plan = s.it.type === 'plan' ? {id: s.it.id, media: s.it.media, temps: s.it.entree + (tt - s.debut) * (Number(s.it.vitesse) || 1), couleur: s.it.couleur ?? null} : {id: s.it.id, case: true, titre: s.it.titre, consigne: s.it.consigne};
  const dessus = (d.superpositions ?? []).find((x) => !x.son_seul && tt >= x.debut && tt < x.debut + (x.sortie - x.entree) && d.medias.find((m) => m.id === x.media)?.type !== 'audio');
  return {t: tt, plan, dessus: dessus ? {id: dessus.id, media: dessus.media, temps: dessus.entree + (tt - dessus.debut), cadre: dessus.cadre} : null, sortie: d.sortie};
}

/**
 * Les outils joués par le serveur. `ctx.P` : le projet ouvert (enregistré par la fenêtre, à une demi-seconde près).
 * `o.creerVideo()` lance « Créer la vidéo » (la même tâche que le bouton) ; `o.file` : la file des traitements.
 */
export function outilsServeur(ctx, o = {}) {
  const projet = () => {
    if (!ctx.P) throw new Error('Aucun projet n’est ouvert dans Dérush : ouvre-en un (ou crées-en un), puis recommence.');
    return ctx.P;
  };
  const media = (P, id) => {
    const m = P.media(String(id ?? ''));
    if (!m) throw new Error(`Média inconnu : ${id}. lister_medias donne les identifiants (M1, M2…).`);
    return m;
  };
  const tmp = (P, nomFichier) => {
    const d = path.join(DOSSIER_NOTES(P), 'images');
    fs.mkdirSync(d, {recursive: true});
    return path.join(d, nomFichier);
  };
  const enImage = (f) => ({data: fs.readFileSync(f).toString('base64'), type: 'image/jpeg'});
  return {
    lister_medias() {
      const P = projet();
      const notes = lireNotes(P);
      const liste = P.d.medias.map((m) => {
        const mots = lireMots(P, m);
        const dit = mots?.filter((w) => !w.ev) ?? [];
        const ia = lireAnalyseIA(P, m);
        return {
          id: m.id, nom: m.nom, genre: m.type, duree_s: arrondi(m.duree ?? 0, 2),
          ...(m.largeur ? {largeur: m.largeur, hauteur: m.hauteur} : {}), ...(m.fps ? {fps: arrondi(m.fps, 3)} : {}),
          ...(lireEtiquettes(P, m)?.etiquettes?.length ? {montre: lireEtiquettes(P, m).etiquettes.slice(0, 10).map((e) => e.nom)} : {}),
          parle: dit.length > 0, ...(dit.length ? {debut_de_ce_qui_est_dit: texteDesMots(dit.slice(0, 30))} : {}),
          ...(ia?.resume ? {resume: ia.resume} : {}), ...(notes[m.id]?.notes ? {notes: notes[m.id].notes} : {}),
          ...(m.type === 'video' && m.preparation && m.preparation !== 'pret' ? {preparation: m.preparation} : {}),
        };
      });
      return {texte: liste.length ? `${liste.length} média${liste.length > 1 ? 's' : ''}.` : 'Aucun média dans le projet : importer_medias pour en ajouter.', donnees: liste};
    },
    lire_transcription({media: id, mots = false}) {
      const P = projet();
      const m = media(P, id);
      if (m.type === 'image') return {texte: `${m.id} est une photo : rien n’y est dit.`};
      const liste = lireMots(P, m);
      if (!liste) return {texte: `La transcription de ${m.id} n’est pas encore prête (Dérush la fait après l’import). Réessaie dans un moment.`};
      const dit = liste.filter((w) => !w.ev);
      if (!dit.length) return {texte: `Personne ne parle dans ${m.id} (${nom(m)}).`};
      return {texte: `${m.id} (${nom(m)}) : ${dit.length} mots.`, donnees: {phrases: phrases(liste), ...(mots ? {mots: dit.map((w) => ({t: w.t, debut: arrondi(w.debut, 2), fin: arrondi(w.fin, 2)}))} : {})}};
    },
    async regarder_media({media: id, images = 6, temps = null}) {
      const P = projet();
      const m = media(P, id);
      const f = fichierLecture(P, m);
      const sortie = tmp(P, `regard-${m.id}-${Date.now()}.jpg`);
      if (m.type === 'audio') return {texte: `${m.id} est un son : rien à regarder. lire_transcription donne ce qui est dit.`};
      if (m.type === 'image') {
        await ffmpeg(['-y', '-v', 'error', '-i', f, '-frames:v', '1', '-vf', 'scale=960:960:force_original_aspect_ratio=decrease', '-q:v', '4', sortie]);
        return {texte: `${m.id} (${nom(m)}) : une photo.`, image: enImage(sortie)};
      }
      const duree = Math.max(0.05, m.duree ?? 0);
      let t = Array.isArray(temps) && temps.length ? temps.map(Number).filter(Number.isFinite).map((x) => borner(x, 0, Math.max(0, duree - 0.05))).slice(0, 12) : null;
      if (!t?.length) {
        const n = borner(Math.round(Number(images) || 6), 1, 12);
        t = Array.from({length: n}, (_, k) => arrondi(((k + 0.5) * duree) / n, 2));
      }
      const {cols} = await plancheFichier(f, t, sortie);
      return {texte: `${m.id} (${nom(m)}, ${dureeLisible(duree)}) : ${t.length} image${t.length > 1 ? 's' : ''}, de gauche à droite${t.length > cols ? ' puis de haut en bas' : ''}, aux temps ${t.map((x) => `${String(x).replace('.', ',')} s`).join(', ')}.`, image: enImage(sortie)};
    },
    noter_media({media: id, notes}) {
      const P = projet();
      const m = media(P, id);
      const texte = String(notes ?? '').trim().slice(0, 1200);
      const toutes = lireNotes(P);
      if (texte) toutes[m.id] = {notes: texte, le: new Date().toISOString()}; else delete toutes[m.id];
      fs.mkdirSync(DOSSIER_NOTES(P), {recursive: true});
      ecrireJson(path.join(DOSSIER_NOTES(P), 'notes.json'), toutes, 2);
      return {texte: texte ? `Noté pour ${m.id} : lister_medias te le rendra.` : `Note de ${m.id} effacée.`};
    },
    async voir_image({temps = null}) {
      const P = projet();
      const d = P.d;
      const ici = imageAuTemps(d, temps == null ? (ctx.porteTete ?? 0) : Number(temps));
      if (!ici) return {texte: 'Le montage est vide.'};
      if (ici.plan.case) return {texte: `À ${minutes(ici.t)} : la case à créer ${ici.plan.id} (« ${ici.plan.titre || 'sans titre'} ») : ${ici.plan.consigne || 'sans consigne'}. Aucune image encore.`};
      const L = d.sortie.largeur;
      const H = d.sortie.hauteur;
      const k = 640 / Math.max(L, H);
      const l = Math.round((L * k) / 2) * 2;
      const h = Math.round((H * k) / 2) * 2;
      const source = (x) => {
        const m = P.media(x.media);
        return {m, f: fichierLecture(P, m), t: m.type === 'image' ? 0 : borner(x.temps, 0, Math.max(0, (m.duree ?? 0) - 0.04))};
      };
      const a = source(ici.plan);
      const sortie = tmp(P, `image-${Date.now()}.jpg`);
      const remplir = `scale=${l}:${h}:force_original_aspect_ratio=increase,crop=${l}:${h}`;
      const plan = [remplir, ...filtreCouleur(ici.plan.couleur)].join(',');
      const args = ['-y', '-v', 'error', '-ss', a.t.toFixed(3), '-i', a.f];
      let graphe = `[0:v]${plan}[v]`;
      if (ici.dessus) {
        const b = source(ici.dessus);
        args.push('-ss', b.t.toFixed(3), '-i', b.f);
        graphe = ici.dessus.cadre === 'incrustation'
          ? `[0:v]${plan}[f];[1:v]scale=${Math.round(l * 0.42 / 2) * 2}:${Math.round(h * 0.42 / 2) * 2}:force_original_aspect_ratio=increase,crop=${Math.round(l * 0.42 / 2) * 2}:${Math.round(h * 0.42 / 2) * 2}[p];[f][p]overlay=x=W-w-W*0.05:y=H*0.06[v]`
          : `[1:v]${remplir}[v]`;
      }
      await ffmpeg([...args, '-filter_complex', graphe, '-map', '[v]', '-frames:v', '1', '-q:v', '4', sortie]);
      const quoi = ici.dessus && ici.dessus.cadre !== 'incrustation' ? `${ici.dessus.id} (par-dessus)` : `${ici.plan.id}${ici.dessus ? ` et ${ici.dessus.id} en incrustation` : ''}`;
      return {texte: `Le montage à ${minutes(ici.t)} (${arrondi(ici.t, 2)} s) : ${quoi}.`, image: enImage(sortie)};
    },
    chercher_medias({dit = '', montre = ''}) {
      const P = projet();
      if (!String(dit).trim() && !String(montre).trim()) throw new Error('« montre » (ce qu’on voit) ou « dit » (ce qui est dit).');
      const vus = String(montre).trim() ? new Map(chercherMontre(P, montre).map((x) => [x.media, x])) : null;
      const res = [];
      for (const m of P.d.medias) {
        const v = vus ? vus.get(m.id) : null;
        if (vus && !v) continue;
        const r = String(dit).trim() ? chercherDit(lireMots(P, m), dit) : null;
        if (r && !r.length) continue;
        res.push({media: m.id, nom: m.nom, ...(v ? {on_voit: v.etiquettes, temps_ou_on_le_voit: v.temps} : {}), ...(r ? {moments_ou_c_est_dit: r.slice(0, 20)} : {})});
      }
      const quoi = [String(montre).trim() ? `on voit « ${montre} »` : '', String(dit).trim() ? `on dit « ${dit} »` : ''].filter(Boolean).join(' et ');
      const pasPrets = P.d.medias.filter((m) => (m.type === 'video' || m.type === 'image') && !lireEtiquettes(P, m)).length;
      return {texte: res.length ? `${quoi} : ${res.length} média${res.length > 1 ? 's' : ''} (temps dans chaque fichier).` : `Aucun média où ${quoi}.${String(montre).trim() && pasPrets ? ` (${pasPrets} média${pasPrets > 1 ? 's' : ''} pas encore regardé${pasPrets > 1 ? 's' : ''} par Apple Vision.)` : ''}`, donnees: res};
    },
    lister_effets() {
      const liste = Object.entries(CATALOGUE).map(([id, d]) => ({
        modele: id, nom: d.nom, genre: CATEGORIES[d.categorie]?.nom ?? d.categorie, description: d.description,
        ...(d.categorie === 'transition' ? {sur_une_coupe: true, avant_s: d.avant, apres_s: d.apres} : {duree_s: d.duree}),
        reglages: Object.fromEntries(Object.entries(d.reglages).map(([k, p]) => [k, {nom: p.nom, type: p.type, defaut: p.defaut, ...(p.options ? {options: Object.keys(p.options)} : {}), ...(p.type === 'nombre' ? {min: p.min, max: p.max} : {})}])),
      }));
      return {texte: `${liste.length} effets.`, donnees: liste};
    },
    async creer_video({attendre = false}, {ia} = {}) {
      projet();
      if (!o.creerVideo) throw new Error('Créer la vidéo n’est pas possible ici.');
      const t = o.creerVideo(ia);
      if (!attendre) return {texte: `La vidéo se fabrique en arrière-plan (tâche ${t.id}). etat_video dit où elle en est.`, donnees: {tache: t.id}};
      const fin = Date.now() + 240000;
      while (Date.now() < fin && !['fini', 'erreur'].includes(t.etat)) await new Promise((ok) => setTimeout(ok, 500));
      return this.etat_video();
    },
    async exporter(a = {}, {ia} = {}) {
      projet();
      if (!o.exporter) throw new Error('Exporter n’est pas possible ici.');
      const lufs = a.son === 'tel' ? null : a.son === 'podcast' ? -16 : a.son === 'television' ? -23 : -14;
      const de = Number(a.de);
      const fin = Number(a.a);
      const t = await o.exporter({qualite: [1080, 1440, 2160].includes(Number(a.qualite)) ? Number(a.qualite) : 1080, lufs, formes: Array.isArray(a.formats) ? a.formats : [],
        passage: Number.isFinite(de) && Number.isFinite(fin) && fin > de ? {de: Math.max(0, de), a: fin} : null, wav: !!a.wav}, ia);
      if (!a.attendre) return {texte: `L’export se fait en arrière-plan (tâche ${t.id}). etat_video dit où il en est.`, donnees: {tache: t.id}};
      const limite = Date.now() + 240000;
      while (Date.now() < limite && !['fini', 'erreur'].includes(t.etat)) await new Promise((ok) => setTimeout(ok, 500));
      if (t.etat === 'erreur') throw new Error(t.erreur ?? 'L’export a échoué.');
      const r = t.resultat ?? {};
      return {texte: t.etat === 'fini' ? `Exporté : ${r.video}${r.formes?.length ? ` (+ ${r.formes.map((x) => x.nom).join(', ')})` : ''}${r.wav ? ` et ${r.wav}` : ''}.` : 'L’export continue en arrière-plan.', donnees: {video: r.video ?? null, formes: r.formes ?? [], wav: r.wav ?? null, lufs: r.lufs ?? null, duree_s: r.duree ?? null}};
    },
    etat_video() {
      const P = projet();
      const f = o.file;
      const taches = f ? [f.enCours, ...(f.attente ?? []), ...(f.recents ?? [])].filter((t) => t && t.meta?.type === 'rendu') : [];
      const dossier = path.join(P.racine, 'vidéos');
      let finies = [];
      try {
        finies = fs.readdirSync(dossier).filter((x) => x.endsWith('.json')).map((x) => lireJson(path.join(dossier, x))).filter((x) => x?.video)
          .sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le))).slice(0, 5)
          .map((x) => ({fichier: x.video, duree_s: x.duree, largeur: x.largeur, hauteur: x.hauteur, lufs: x.lufs, cree_le: x.cree_le, controles: (x.controles ?? []).map((c) => `${c.nom ?? c.quoi ?? ''} : ${c.etat ?? ''} ${c.detail ?? ''}`.trim()).slice(0, 12)}));
      } catch { /* pas encore de vidéo */ }
      const enCours = taches.filter((t) => !['fini', 'erreur'].includes(t.etat)).map((t) => ({tache: t.id, nom: t.nom, etat: t.etat, progression: Math.round((t.progression ?? 0) * 100)}));
      const erreurs = taches.filter((t) => t.etat === 'erreur').slice(0, 3).map((t) => ({tache: t.id, erreur: t.erreur ?? t.message ?? 'échec'}));
      return {texte: enCours.length ? `${enCours.length} vidéo${enCours.length > 1 ? 's' : ''} en fabrication.` : finies.length ? `Dernière vidéo : ${finies[0].fichier}` : 'Aucune vidéo fabriquée pour l’instant.', donnees: {en_cours: enCours, finies, erreurs}};
    },
  };
}

// ——— La porte : le protocole, et le passage des gestes à la fenêtre ———

/**
 * Crée la porte. `ctx` : le contexte du serveur (projet ouvert, fenêtres). `o.serveur` : les outils joués ici
 * (outilsServeur). Rend {traiter, attente, reponse, etat, cle}.
 */
export function creerPorte(ctx, o = {}) {
  let cle = o.cle ?? clePorte();
  const sessions = new Map(); // id → {nom, client, protocole, vu}
  const appels = new Map(); // id → {nom, args, ia, ok, ko, minuteur}
  const aEnvoyer = [];
  const evenements = []; // ce que la fenêtre doit savoir (une vidéo lancée par une IA…)
  let derniereAttente = 0; // la dernière fois que la fenêtre est venue chercher des gestes
  let derniereActivite = 0; // la dernière demande d'une IA
  const journal = []; // les derniers gestes (pour la fenêtre « Connexions »)
  const serveur = o.serveur ?? {};

  // La fenêtre vient chercher les gestes (toutes les 150 ms quand une IA travaille, toutes les 1,5 s sinon) : aucune
  // demande n'est tenue ouverte, les lecteurs vidéo de la page gardent toutes leurs connexions.
  const fenetreVivante = () => Date.now() - derniereAttente < 6000;
  const envoyer = (res, code, corps, entetes = {}) => {
    if (res.writableEnded) return;
    const b = corps === null ? '' : JSON.stringify(corps);
    res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...entetes});
    res.end(b);
  };
  const noter = (ia, nomOutil, ok) => {
    journal.unshift({ia, outil: nomOutil, ok, le: Date.now()});
    journal.length = Math.min(journal.length, 30);
  };
  /** Dit quelque chose à la fenêtre, à son prochain passage ({type: 'rendu', tache, ia}…). */
  const annoncer = (e) => { evenements.push(e); if (evenements.length > 20) evenements.shift(); };

  /** Fait jouer un geste par la fenêtre ; rend sa réponse ({texte, donnees}). */
  async function parLaFenetre(nomOutil, args, ia) {
    // une fenêtre qui vient de s'ouvrir (ou qui se réveille) a quelques secondes pour venir chercher le geste
    for (let k = 0; k < 40 && !fenetreVivante(); k++) await new Promise((ok) => setTimeout(ok, 100));
    if (!fenetreVivante()) throw new Error('La fenêtre de Dérush n’est pas ouverte : ouvre Dérush (et un projet), puis recommence.');
    const id = crypto.randomUUID();
    return new Promise((ok, ko) => {
      const minuteur = setTimeout(() => {
        appels.delete(id);
        const k = aEnvoyer.indexOf(id);
        if (k >= 0) aEnvoyer.splice(k, 1);
        ko(new Error('La fenêtre de Dérush n’a pas répondu à temps (elle est peut-être occupée, ou une feuille est ouverte). Réessaie.'));
      }, DELAI_GESTE_MS);
      appels.set(id, {nom: nomOutil, args, ia, ok, ko, minuteur});
      aEnvoyer.push(id);
    });
  }

  async function appelerOutil(nomOutil, args, session) {
    const ou = ouJouer(nomOutil);
    if (!ou) throw new ErreurRpc(-32602, `Outil inconnu : ${nomOutil}.`);
    const a = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
    const ia = session?.nom ?? 'Une IA';
    if (o.fermee?.()) {
      noter(ia, nomOutil, false);
      return contenuOutil({texte: 'La porte de Dérush est fermée : la personne l’a fermée dans Dérush › Connexions. Demande-lui de la rouvrir. Rien n’a été changé.'}, true);
    }
    try {
      let r;
      if (ou === 'serveur') {
        const f = serveur[nomOutil];
        if (!f) throw new Error(`${nomOutil} n’est pas disponible.`);
        // ce qui lit le montage enregistré (la vidéo, l'export, une image) : la fenêtre enregistre d'abord ce qu'elle montre
        if (LISENT_LE_MONTAGE.has(nomOutil) && fenetreVivante()) await parLaFenetre('enregistrer', {}, ia).catch(() => {});
        r = await f.call(serveur, a, {ia});
      } else r = await parLaFenetre(nomOutil, a, ia);
      noter(ia, nomOutil, true);
      return contenuOutil(r);
    } catch (e) {
      noter(ia, nomOutil, false);
      return contenuOutil({texte: String(e?.message ?? e)}, true);
    }
  }

  async function methode(msg, session) {
    const p = msg.params ?? {};
    switch (msg.method) {
      case 'initialize': {
        const v = PROTOCOLES.includes(p.protocolVersion) ? p.protocolVersion : PROTOCOLES[0];
        session.protocole = v;
        session.client = {name: String(p.clientInfo?.name ?? '').slice(0, 80), version: String(p.clientInfo?.version ?? '').slice(0, 40)};
        session.nom = session.nomImpose ?? nomClient(p.clientInfo);
        return {
          protocolVersion: v,
          capabilities: {tools: {listChanged: false}},
          serverInfo: {name: NOM_SERVEUR, title: 'Dérush', version: VERSION},
          instructions: CONSIGNES_PORTE,
        };
      }
      case 'ping': return {};
      case 'tools/list': return {tools: DEFINITIONS};
      case 'tools/call': return appelerOutil(String(p.name ?? ''), p.arguments, session);
      case 'logging/setLevel': return {};
      default: throw new ErreurRpc(-32601, `Méthode inconnue : ${msg.method}`);
    }
  }

  /** POST /mcp (et GET, DELETE) : le protocole. */
  async function traiter(req, res) {
    const auth = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!memeCle(auth, cle)) return envoyer(res, 401, {jsonrpc: '2.0', id: null, error: {code: -32001, message: 'Clé de la porte manquante ou fausse.'}}, {'WWW-Authenticate': 'Bearer'});
    // une page web ne peut pas parler à la porte (une demande venue d'un site porte son origine)
    const origine = req.headers.origin;
    if (origine && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origine)) return envoyer(res, 403, {jsonrpc: '2.0', id: null, error: {code: -32002, message: 'Origine refusée.'}});
    const idSession = String(req.headers['mcp-session-id'] ?? '').slice(0, 80);
    if (req.method === 'DELETE') {
      sessions.delete(idSession);
      res.writeHead(204, {'Cache-Control': 'no-store'});
      return res.end();
    }
    if (req.method !== 'POST') {
      res.writeHead(405, {Allow: 'POST, DELETE', 'Cache-Control': 'no-store'});
      return res.end();
    }
    let brut = '';
    for await (const morceau of req) {
      brut += morceau;
      if (brut.length > TAILLE_MAX) return envoyer(res, 413, {jsonrpc: '2.0', id: null, error: {code: -32600, message: 'Demande trop grande.'}});
    }
    let corps;
    try { corps = JSON.parse(brut); } catch { return envoyer(res, 400, {jsonrpc: '2.0', id: null, error: {code: -32700, message: 'JSON illisible.'}}); }
    const messages = Array.isArray(corps) ? corps : [corps];
    // une session par app branchée (son nom sur le curseur) ; une session inconnue (Dérush relancé) repart à neuf
    let nouvelle = null;
    let session = sessions.get(idSession);
    const nomImpose = String(req.headers['x-derush-ia'] ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 24) || null;
    if (!session) {
      session = {id: idSession || crypto.randomUUID(), nom: nomImpose ?? 'Une IA', nomImpose, vu: Date.now()};
      if (messages.some((x) => x?.method === 'initialize')) {
        session.id = crypto.randomUUID();
        nouvelle = session.id;
      }
      sessions.set(session.id, session);
      if (sessions.size > 50) sessions.delete(sessions.keys().next().value);
    }
    session.vu = Date.now();
    derniereActivite = Date.now();
    const reponses = [];
    for (const msg of messages) {
      if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') {
        reponses.push({jsonrpc: '2.0', id: msg?.id ?? null, error: {code: -32600, message: 'Message JSON-RPC 2.0 attendu.'}});
        continue;
      }
      if (typeof msg.method !== 'string') continue; // une réponse de l'app : Dérush ne lui demande rien
      if (msg.id === undefined || msg.id === null) continue; // une notification (initialized, cancelled…)
      try {
        reponses.push({jsonrpc: '2.0', id: msg.id, result: await methode(msg, session)});
      } catch (e) {
        reponses.push({jsonrpc: '2.0', id: msg.id, error: {code: e instanceof ErreurRpc ? e.code : -32603, message: String(e?.message ?? e)}});
      }
    }
    const entetes = nouvelle ? {'Mcp-Session-Id': nouvelle} : {};
    if (!reponses.length) {
      res.writeHead(202, {'Cache-Control': 'no-store', ...entetes});
      return res.end();
    }
    return envoyer(res, 200, Array.isArray(corps) ? reponses : reponses[0], entetes);
  }

  /**
   * GET /api/porte/attente : la fenêtre vient chercher les gestes à jouer (et dit où est sa tête de lecture). La réponse
   * part tout de suite ; « actif » lui dit de repasser vite (une IA a parlé à la porte il y a moins d'une minute).
   */
  function attente(tete = null) {
    derniereAttente = Date.now();
    if (Number.isFinite(tete)) ctx.porteTete = tete;
    const lot = aEnvoyer.splice(0).map((id) => {
      const x = appels.get(id);
      return x ? {id, nom: x.nom, args: x.args, ia: x.ia} : null;
    }).filter(Boolean);
    return {appels: lot, evenements: evenements.splice(0), actif: Date.now() - derniereActivite < 60000 || appels.size > 0};
  }
  /** POST /api/porte/reponse : la fenêtre a joué le geste. */
  function reponse({id, resultat = null, erreur = null} = {}) {
    const x = appels.get(String(id ?? ''));
    if (!x) return false;
    appels.delete(String(id));
    clearTimeout(x.minuteur);
    if (erreur) x.ko(new Error(String(erreur).slice(0, 2000)));
    else x.ok(resultat ?? {});
    return true;
  }
  function etat() {
    const maintenant = Date.now();
    const recentes = [...sessions.values()].filter((s) => maintenant - s.vu < 10 * 60 * 1000).map((s) => ({nom: s.nom, vu: s.vu}));
    return {ouverte: true, fenetre: fenetreVivante(), ia: recentes, journal: journal.slice(0, 12)};
  }
  return {traiter, attente, reponse, etat, annoncer, appelerOutil, get cle() { return cle; }, set cle(c) { cle = c; }};
}
