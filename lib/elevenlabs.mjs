// Dérush — ElevenLabs : musiques, bruitages, voix off, nettoyage et changement de voix, doublage, texte avec locuteurs.
// La clé du compte n'est jamais écrite dans le code ni affichée : l'outil officiel d'ElevenLabs la range dans un fichier
// du dossier de Dérush (~/Library/Application Support/Dérush/.env.local), et Node la charge dans l'environnement.
// Claude, lancé par Dérush, la reçoit par la variable ELEVENLABS_API_KEY.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {DOSSIER_SUPPORT, RACINE_APP} from './moteurs.mjs';
import {commandeNode, avecShell, pathAvec} from './plateforme.mjs';

const FICHIERS = [path.join(DOSSIER_SUPPORT, '.env.local'), path.join(DOSSIER_SUPPORT, '.env'), path.join(RACINE_APP, '.env.local'), path.join(RACINE_APP, '.env')];
const OUTIL = ['-y', '@elevenlabs/cli@latest'];
const envNode = () => pathAvec([path.dirname(process.execPath)]);

/** Charge la clé dans l'environnement, si elle a été rangée. Le code ne voit que la variable, jamais le fichier. */
export function chargerCle() {
  if (process.env.ELEVENLABS_API_KEY) return true;
  for (const f of FICHIERS) {
    if (!fs.existsSync(f)) continue;
    try { process.loadEnvFile(f); } catch { /* fichier illisible : on passe au suivant */ }
    if (process.env.ELEVENLABS_API_KEY) return true;
  }
  return false;
}

let branchement = null; // {debut, etat: 'attente' | 'fini' | 'erreur', message}

/** Où en est ElevenLabs : branché, en attente de l'accord dans le navigateur, ou à brancher. */
export function etatElevenLabs() {
  if (chargerCle()) return {ok: true, nom: 'ElevenLabs', detail: 'Branché : tout le son des vidéos de Claude (musique, bruitages, voix), des images et des plans vidéo. Onglet « Créer » pour le faire toi-même.'};
  if (branchement?.etat === 'attente') return {ok: false, attente: true, pourquoi: 'En attente : autorise Dérush dans la page ElevenLabs ouverte dans ton navigateur.'};
  return {ok: false, branchable: true, pourquoi: branchement?.etat === 'erreur' ? branchement.message : 'Pas encore branché : Claude se passe de musique et de voix générées.'};
}

/** Une étape de l'outil officiel (« onboard … »), dans le dossier de Dérush. Renvoie sa réponse, ou null. */
function onboard(args) {
  return new Promise((ok) => {
    fs.mkdirSync(DOSSIER_SUPPORT, {recursive: true});
    const p = spawn(commandeNode('npx'), [...OUTIL, 'onboard', ...args, '--env-path', '.env.local'], {cwd: DOSSIER_SUPPORT, env: envNode(), stdio: ['ignore', 'pipe', 'ignore'], shell: avecShell(commandeNode('npx')), windowsHide: true});
    let sortie = '';
    p.stdout.on('data', (d) => { sortie += d; });
    const garde = setTimeout(() => p.kill(), 200000);
    p.on('error', () => { clearTimeout(garde); ok(null); });
    p.on('close', () => {
      clearTimeout(garde);
      try { ok(JSON.parse(sortie.trim().split('\n').filter(Boolean).at(-1))); } catch { ok(null); }
    });
  });
}

/**
 * Branche ElevenLabs par la voie officielle : l'outil ouvre la page d'autorisation dans le navigateur, la personne
 * se connecte et clique « Autoriser », puis l'outil range la clé. Rend la main tout de suite ; l'état se suit avec etatElevenLabs().
 */
export function brancherElevenLabs() {
  if (chargerCle() || branchement?.etat === 'attente') return etatElevenLabs();
  branchement = {debut: Date.now(), etat: 'attente'};
  (async () => {
    let r = await onboard(['connect']);
    while (r?.next === 'wait' && Date.now() - branchement.debut < 15 * 60000 && !chargerCle()) r = await onboard(['connect', '--wait', '--no-browser']);
    if (chargerCle()) { branchement = {etat: 'fini'}; installerModule(); }
    else branchement = {etat: 'erreur', message: r?.next === 'wait' ? 'L’autorisation n’est pas arrivée à temps. Clique de nouveau sur « Brancher ».' : 'Le branchement n’a pas abouti (Internet ?). Clique de nouveau sur « Brancher ».'};
  })();
  return etatElevenLabs();
}

/**
 * Le module d'ElevenLabs, dont Dérush se sert pour le texte avec les locuteurs (Scribe). Il s'installe dans le
 * dossier de Dérush, à côté de la clé : il survit ainsi aux mises à jour de l'app.
 */
export function installerModule() {
  return new Promise((ok) => {
    if (fs.existsSync(path.join(DOSSIER_SUPPORT, 'node_modules', '@elevenlabs', 'elevenlabs-js', 'package.json'))) return ok(true);
    const p = spawn(commandeNode('npm'), ['install', '--no-audit', '--no-fund', '--loglevel=error', '@elevenlabs/elevenlabs-js'], {cwd: DOSSIER_SUPPORT, env: envNode(), stdio: 'ignore', shell: avecShell(commandeNode('npm')), windowsHide: true});
    p.on('error', () => ok(false));
    p.on('close', (code) => ok(code === 0));
  });
}

/** Ce que Dérush dit à Claude au départ, selon qu'ElevenLabs est branché ou non. */
export function consigneElevenLabs() {
  return chargerCle()
    ? '- ElevenLabs est branché : la clé est déjà dans ton environnement (ELEVENLABS_API_KEY). Ne l’affiche jamais (ni env, ni printenv, ni echo de cette variable) et ne lance ni « onboard » ni « auth ». ElevenLabs est ton studio : tout le son de la vidéo en vient (musique, chaque bruitage, ambiances, voix), sauf si l’humain dit autre chose ; il génère aussi des images et des plans vidéo. Tout est dans OUTILS.md, partie « ElevenLabs ». Chaque création coûte des crédits à l’humain : une seule génération par élément, et réutilise ce qui existe (contexte/creations/, remotion/public/son/).'
    : '- ElevenLabs n’est pas branché sur cet ordinateur : pas de musique, de voix ni d’image générées en ligne. Sers-toi des sons du kit ou fabrique-les en local, et ne lance ni « onboard » ni « auth » (cela ouvrirait une page chez l’humain).';
}

// =====================================================================
// ElevenLabs dans Dérush : créer musiques, voix, dialogues, bruitages, images et vidéos ; nettoyer une voix ; doubler.
// Les créations sont rangées dans <projet>/creations/ (creations.json) et Claude les reçoit dans son dossier de travail.
// =====================================================================
const BASE = 'https://api.elevenlabs.io';

/** Un message clair quand ElevenLabs refuse (crédits, forme de la demande…). */
function messageRefus(code, texte) {
  let detail = texte;
  try { const j = JSON.parse(texte); detail = j.detail?.message ?? j.detail?.[0]?.msg ?? j.detail ?? j.message ?? texte; } catch { /* texte brut */ }
  detail = typeof detail === 'string' ? detail : JSON.stringify(detail);
  if (code === 401) return 'ElevenLabs refuse la clé : rebranche ElevenLabs dans les Réglages.';
  if (code === 402 || /quota|credit|insufficient/i.test(detail)) return `Plus assez de crédits ElevenLabs pour cette création (${detail.slice(0, 160)}).`;
  return `ElevenLabs a refusé (${code}) : ${detail.slice(0, 300)}`;
}
/** Un appel à l'API : la clé reste dans la variable d'environnement et n'est envoyée qu'à elevenlabs.io. */
async function appel(chemin, {methode = 'POST', json = null, form = null, query = null, reponse = 'binaire', delaiMs = 600000} = {}) {
  if (!chargerCle()) throw new Error('ElevenLabs n’est pas branché : Réglages → « Brancher ».');
  const url = `${BASE}${chemin}${query ? `?${new URLSearchParams(query)}` : ''}`;
  const r = await fetch(url, {
    method: methode, signal: AbortSignal.timeout(delaiMs),
    headers: {'xi-api-key': process.env.ELEVENLABS_API_KEY, ...(json ? {'content-type': 'application/json'} : {})},
    body: json ? JSON.stringify(json) : form ?? undefined,
  });
  if (!r.ok) throw new Error(messageRefus(r.status, await r.text().catch(() => '')));
  if (reponse === 'json') return r.json();
  return {octets: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') ?? ''};
}
/** Télécharge un résultat (image, vidéo) : la clé n'est jointe que si l'adresse est bien chez ElevenLabs. */
async function telecharger(adresse) {
  const u = new URL(adresse, BASE);
  const chezEleven = u.protocol === 'https:' && (u.hostname === 'elevenlabs.io' || u.hostname.endsWith('.elevenlabs.io'));
  const r = await fetch(u, {headers: chezEleven ? {'xi-api-key': process.env.ELEVENLABS_API_KEY} : {}, signal: AbortSignal.timeout(600000)});
  if (!r.ok) throw new Error(`Le résultat n’a pas pu être récupéré (${r.status}).`);
  return {octets: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') ?? ''};
}
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
/**
 * Le coût d'une création se mesure par les crédits du compte, avant et après. Il n'est juste que si rien d'autre
 * n'a dépensé de crédits pendant ce temps (une autre création, ou Claude au travail) : sinon on ne l'affiche pas.
 */
let actifs = 0;
let epoque = 0;
export function occupe(oui) { actifs = Math.max(0, actifs + (oui ? 1 : -1)); epoque++; }
function mesure() {
  const seule = actifs === 0;
  occupe(true);
  const e0 = epoque;
  let fini = false;
  return () => { if (fini) return false; fini = true; const juste = seule && epoque === e0; occupe(false); return juste; };
}

/** Les crédits du compte (pour dire ce que chaque création a coûté). */
export async function credits() {
  try {
    const s = await appel('/v1/user/subscription', {methode: 'GET', reponse: 'json', delaiMs: 20000});
    return {utilises: s.character_count, limite: s.character_limit, restants: s.character_limit - s.character_count, forfait: s.tier};
  } catch {
    return null;
  }
}

let memoVoix = {t: 0, v: null};
/** Les voix du compte, celles qui parlent français d'abord. */
export async function listerVoix() {
  if (memoVoix.v && Date.now() - memoVoix.t < 10 * 60000) return memoVoix.v;
  const j = await appel('/v2/voices', {methode: 'GET', query: {page_size: 100}, reponse: 'json', delaiMs: 20000});
  const v = (j.voices ?? []).map((x) => {
    const l = x.labels ?? {};
    const fr = (x.verified_languages ?? []).some((y) => y.language === 'fr') || l.language === 'fr';
    return {id: x.voice_id, nom: String(x.name ?? '').split(' - ')[0], description: String(x.name ?? '').split(' - ')[1] ?? l.descriptive ?? '', genre: l.gender ?? null, accent: l.accent ?? null, usage: l.use_case ?? null, fr, apercu: x.preview_url ?? null};
  }).sort((a, b) => Number(b.fr) - Number(a.fr) || a.nom.localeCompare(b.nom));
  memoVoix = {t: Date.now(), v};
  return v;
}

/** Ce que Dérush sait créer avec ElevenLabs, et les choix possibles (l'interface dessine ses formulaires à partir de là). */
export const STUDIO = {
  musique: {nom: 'Musique', aide: 'Une musique originale, de 5 s à 5 min.'},
  musique_video: {nom: 'Musique pour une vidéo', aide: 'ElevenLabs regarde la vidéo et compose dessus.'},
  voix: {nom: 'Voix off', aide: 'Un texte lu par la voix de ton choix.'},
  dialogue: {nom: 'Dialogue', aide: 'Plusieurs voix qui se répondent.'},
  bruitage: {nom: 'Bruitage', aide: 'Un son décrit en une phrase, de 0,5 à 30 s.'},
  nettoyer: {nom: 'Voix nettoyée', aide: 'Enlève le bruit autour de la voix.'},
  doublage: {nom: 'Doublage', aide: 'La vidéo traduite, avec les mêmes voix.'},
  image: {nom: 'Image', aide: 'Une image générée : fond, illustration, affiche.'},
  video: {nom: 'Vidéo', aide: 'Un plan vidéo généré, de 4 à 15 s.'},
};
export const MODELES_IMAGE = {
  'gemini-3.1-flash-image': {nom: 'Gemini 3.1 Flash', formats: ['9:16', '16:9', '1:1', '4:5', '3:4', '4:3'], resolutions: ['1K', '2K', '4K']},
  'gemini-3-pro-image': {nom: 'Gemini 3 Pro', formats: ['9:16', '16:9', '1:1', '4:5', '3:4', '4:3'], resolutions: ['1K', '2K', '4K']},
  'gpt-image-2': {nom: 'GPT Image 2', formats: ['9:16', '16:9', '1:1', '4:5', '3:4', '4:3'], resolutions: ['1K', '2K', '4K']},
  'bytedance-seedream-5-pro': {nom: 'Seedream 5 Pro', formats: ['9:16', '16:9', '1:1', '3:4', '4:3'], resolutions: ['1K', '2K']},
};
export const MODELES_VIDEO = {
  'bytedance-seedance-v2-fast': {nom: 'Seedance 2 Fast', formats: ['9:16', '16:9', '1:1', '4:3', '3:4'], durees: [4, 5, 6, 8, 10, 12, 15], resolutions: ['720p', '480p']},
  'bytedance-seedance-v2': {nom: 'Seedance 2', formats: ['9:16', '16:9', '1:1', '4:3', '3:4'], durees: [4, 5, 6, 8, 10, 12, 15], resolutions: ['1080p', '720p']},
  'veo-3.1-fast-generate-001': {nom: 'Veo 3.1 Fast', formats: ['9:16', '16:9'], durees: [4, 6, 8], resolutions: ['1080p', '720p']},
  'veo-3.1-generate-001': {nom: 'Veo 3.1', formats: ['9:16', '16:9'], durees: [4, 6, 8], resolutions: ['1080p', '720p', '4K']},
};
export const LANGUES_DOUBLAGE = {en: 'Anglais', es: 'Espagnol', ar: 'Arabe', pt: 'Portugais', de: 'Allemand', it: 'Italien', ja: 'Japonais', fr: 'Français', zh: 'Chinois', hi: 'Hindi', tr: 'Turc', nl: 'Néerlandais'};

const fichierCreations = (P) => path.join(P.racine, 'creations', 'creations.json');
const lireCreations = (P) => { try { return JSON.parse(fs.readFileSync(fichierCreations(P), 'utf8')); } catch { return {compteur: 0, creations: []}; } };
function ecrireCreations(P, d) {
  fs.mkdirSync(path.dirname(fichierCreations(P)), {recursive: true});
  fs.writeFileSync(fichierCreations(P), JSON.stringify(d, null, 2));
}
const EN_COURS = new Map(); // racine du projet|id de la création → {progression}
/** Les créations du projet, avec le chemin de leur fichier (et la progression de celles qui se font). */
export function listerCreations(P) {
  return lireCreations(P).creations.map((c) => {
    const suivi = EN_COURS.get(`${P.racine}|${c.id}`);
    // « en cours » sans suivi : Dérush a été fermé pendant la création
    const x = c.etat === 'en_cours' && !suivi ? {...c, etat: 'erreur', erreur: 'Interrompue : Dérush a été fermé pendant la création.'} : c;
    return {...x, progression: suivi?.progression ?? null, chemin: c.fichier ? path.join(P.racine, 'creations', c.fichier) : null, type_lisible: STUDIO[c.type]?.nom ?? c.type};
  }).filter((c) => c.etat !== 'pret' || (c.chemin && fs.existsSync(c.chemin)));
}
/** Lance une création en arrière-plan (elle ne bloque pas la préparation des rushes). */
export function lancerCreation(P, id) {
  const cle = `${P.racine}|${id}`;
  const suivi = {progression: 0};
  EN_COURS.set(cle, suivi);
  creer(P, id, (p) => { suivi.progression = Math.max(suivi.progression, p); })
    .catch((e) => majCreation(P, id, {etat: 'erreur', erreur: String(e.message).slice(0, 400)}))
    .finally(() => EN_COURS.delete(cle));
}
export const creationsEnCours = () => EN_COURS.size;
function majCreation(P, id, champs) {
  const d = lireCreations(P);
  const c = d.creations.find((x) => x.id === id);
  if (c) Object.assign(c, champs);
  ecrireCreations(P, d);
  return c;
}
export function retirerCreation(P, id) {
  const d = lireCreations(P);
  const c = d.creations.find((x) => x.id === id);
  if (!c) return false;
  d.creations = d.creations.filter((x) => x.id !== id);
  ecrireCreations(P, d);
  if (c.fichier) fs.rmSync(path.join(P.racine, 'creations', c.fichier), {force: true});
  return true;
}
/** Une création qui commence : elle apparaît tout de suite dans la bibliothèque, « en cours ». */
export function nouvelleCreation(P, demande) {
  if (!STUDIO[demande.type]) throw new Error('Création inconnue.');
  if (!chargerCle()) throw new Error('ElevenLabs n’est pas branché : Réglages → « Brancher ».');
  const d = lireCreations(P);
  d.compteur = (d.compteur ?? 0) + 1;
  const titre = String(demande.prompt ?? demande.texte ?? demande.titre ?? (demande.repliques ?? []).map((r) => r.texte).join(' / ') ?? '').trim().slice(0, 200) || STUDIO[demande.type].nom;
  const c = {id: `C${d.compteur}`, type: demande.type, titre, demande: {...demande}, etat: 'en_cours', cree_le: new Date().toISOString(), fichier: null, duree: null, largeur: null, hauteur: null, cout: null, erreur: null};
  d.creations.unshift(c);
  ecrireCreations(P, d);
  return c;
}

const sonde = async (f) => {
  const {lancer, FFPROBE} = await import('./outils.mjs');
  try {
    const {out} = await lancer(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', f]);
    const j = JSON.parse(out.toString());
    const v = j.streams?.find((s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1);
    return {duree: Number(j.format?.duration) || null, largeur: v?.width ?? null, hauteur: v?.height ?? null};
  } catch {
    return {duree: null, largeur: null, hauteur: null};
  }
};
const extension = (type, defaut) => (/png/.test(type) ? '.png' : /jpe?g/.test(type) ? '.jpg' : /webp/.test(type) ? '.webp' : /mp4/.test(type) ? '.mp4' : /quicktime/.test(type) ? '.mov' : /wav/.test(type) ? '.wav' : /mpeg|mp3/.test(type) ? '.mp3' : defaut);
const imageEnLigne = (f) => ({type: 'inline_base64', content_base64: fs.readFileSync(f).toString('base64'), mime_type: /\.png$/i.test(f) ? 'image/png' : /\.webp$/i.test(f) ? 'image/webp' : /\.hei[cf]$/i.test(f) ? 'image/heic' : 'image/jpeg'});

/** Une image ou une vidéo générée : on lance, on attend, on récupère. */
async function generation(genre, corps, prog) {
  const {id} = await appel(`/v1/flows/${genre}`, {json: corps, reponse: 'json'});
  const debut = Date.now();
  for (;;) {
    await attendre(genre === 'video' ? 5000 : 2500);
    const g = await appel(`/v1/flows/${genre}/${id}`, {methode: 'GET', reponse: 'json', delaiMs: 30000});
    if (g.status === 'completed' && g.content_url) return telecharger(g.content_url);
    if (g.status === 'failed') throw new Error(`ElevenLabs n’a pas pu la créer : ${g.error_message ?? g.failure_reason ?? 'raison inconnue'}.`);
    const attente = (Date.now() - debut) / 1000;
    prog?.(Math.min(0.95, attente / (genre === 'video' ? 240 : 60)));
    if (attente > 30 * 60) throw new Error('La création prend plus de 30 minutes : abandonnée.');
  }
}
/** Un doublage : envoi, attente, récupération (une vidéo traduite, ou un son). */
async function doubler(fichier, langue, prog) {
  const form = new FormData();
  form.append('file', await fs.openAsBlob(fichier), path.basename(fichier));
  for (const [k, v] of Object.entries({target_lang: langue, source_lang: 'auto', num_speakers: '0', watermark: 'false', highest_resolution: 'true'})) form.append(k, v);
  const {dubbing_id: id, expected_duration_sec: prevu} = await appel('/v1/dubbing', {form, reponse: 'json'});
  const debut = Date.now();
  for (;;) {
    await attendre(5000);
    const d = await appel(`/v1/dubbing/${id}`, {methode: 'GET', reponse: 'json', delaiMs: 30000});
    if (d.status === 'dubbed') return appel(`/v1/dubbing/${id}/audio/${langue}`, {methode: 'GET'});
    if (d.status === 'failed') throw new Error(`Le doublage a échoué : ${d.error ?? 'raison inconnue'}.`);
    prog?.(Math.min(0.95, (Date.now() - debut) / 1000 / Math.max(60, (prevu ?? 60) * 1.5)));
    if (Date.now() - debut > 60 * 60000) throw new Error('Le doublage prend plus d’une heure : abandonné.');
  }
}

/**
 * Une version légère d'un fichier pour l'envoyer à ElevenLabs : la musique pour une vidéo accepte 200 Mo et 10 min
 * au plus (une vidéo 720p suffit pour qu'elle suive les coupes) ; le nettoyage de la voix ne veut que le son.
 */
async function versionLegere(fichier, genre) {
  const {ffmpeg} = await import('./outils.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-eleven-'));
  const sortie = path.join(tmp, genre === 'son' ? 'son.m4a' : 'video.mp4');
  const args = genre === 'son'
    ? ['-y', '-i', fichier, '-map', '0:a:0', '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', sortie]
    : ['-y', '-i', fichier, '-t', '600', '-map', '0:v:0', '-map', '0:a:0?', '-vf', "scale='min(720,iw)':-2", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-maxrate', '2M', '-bufsize', '4M', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', sortie];
  await ffmpeg(args);
  return {fichier: sortie, ranger: () => fs.rmSync(tmp, {recursive: true, force: true})};
}

/** Fait la création demandée et range le fichier dans le projet (lancée en arrière-plan par lancerCreation). */
export async function creer(P, id, prog = () => {}) {
  const c = lireCreations(P).creations.find((x) => x.id === id);
  if (!c) throw new Error('Création introuvable.');
  const q = c.demande;
  const finMesure = mesure();
  const avant = await credits();
  prog(0.05);
  let r;
  let leger = null;
  try {
    if (['musique_video', 'nettoyer', 'doublage'].includes(c.type) && !(q.fichier && fs.existsSync(q.fichier))) throw new Error('Le fichier de départ est introuvable.');
    if (c.type === 'musique') {
      r = await appel('/v1/music', {query: {output_format: 'mp3_48000_192'}, json: {prompt: q.prompt, music_length_ms: Math.round(Math.min(300, Math.max(5, Number(q.duree_s) || 30)) * 1000), model_id: 'music_v2_5', force_instrumental: q.instrumental !== false}});
    } else if (c.type === 'musique_video') {
      leger = await versionLegere(q.fichier, 'video');
      prog(0.15);
      const form = new FormData();
      form.append('videos', await fs.openAsBlob(leger.fichier), 'video.mp4');
      if (q.prompt) form.append('description', String(q.prompt).slice(0, 4000));
      form.append('model_id', 'music_v2_5');
      if (q.bruitages) form.append('add_sfx', 'true');
      r = await appel('/v1/music/video-to-music', {query: {output_format: 'mp3_44100_192'}, form});
    } else if (c.type === 'voix') {
      r = await appel(`/v1/text-to-speech/${encodeURIComponent(q.voix)}`, {query: {output_format: 'mp3_44100_192'}, json: {text: q.texte, model_id: q.modele || 'eleven_v4', language_code: q.langue || 'fr'}});
    } else if (c.type === 'dialogue') {
      r = await appel('/v1/text-to-dialogue', {query: {output_format: 'mp3_44100_192'}, json: {inputs: (q.repliques ?? []).filter((x) => x.texte?.trim()).map((x) => ({text: x.texte, voice_id: x.voix})), model_id: 'eleven_v3', language_code: q.langue || 'fr'}});
    } else if (c.type === 'bruitage') {
      r = await appel('/v1/sound-generation', {query: {output_format: 'mp3_44100_192'}, json: {text: q.prompt, duration_seconds: q.duree_s ? Math.min(30, Math.max(0.5, Number(q.duree_s))) : null, loop: !!q.boucle, model_id: 'eleven_text_to_sound_v3'}});
    } else if (c.type === 'nettoyer') {
      leger = await versionLegere(q.fichier, 'son');
      const form = new FormData();
      form.append('audio', await fs.openAsBlob(leger.fichier), 'son.m4a');
      r = await appel('/v1/audio-isolation', {form});
    } else if (c.type === 'doublage') {
      // au-delà de 900 Mo, on envoie une version légère
      if (fs.statSync(q.fichier).size > 900e6) leger = await versionLegere(q.fichier, 'video');
      r = await doubler(leger?.fichier ?? q.fichier, q.langue || 'en', prog);
    } else if (c.type === 'image') {
      const m = MODELES_IMAGE[q.modele] ? q.modele : 'gemini-3.1-flash-image';
      r = await generation('image', {model_id: m, prompt: q.prompt, aspect_ratio: MODELES_IMAGE[m].formats.includes(q.format) ? q.format : MODELES_IMAGE[m].formats[0], resolution: MODELES_IMAGE[m].resolutions.includes(q.resolution) ? q.resolution : '2K', ...(q.image ? {images: [imageEnLigne(q.image)]} : {})}, prog);
    } else if (c.type === 'video') {
      const m = MODELES_VIDEO[q.modele] ? q.modele : 'bytedance-seedance-v2-fast';
      const M = MODELES_VIDEO[m];
      const duree = M.durees.reduce((a, b) => (Math.abs(b - (Number(q.duree_s) || 6)) < Math.abs(a - (Number(q.duree_s) || 6)) ? b : a));
      r = await generation('video', {model_id: m, prompt: q.prompt, aspect_ratio: M.formats.includes(q.format) ? q.format : M.formats[0], duration_secs: duree, resolution: M.resolutions[0], generate_audio: q.son !== false, ...(q.image ? {start_frame: imageEnLigne(q.image)} : {})}, prog);
    }
  } catch (e) {
    finMesure();
    majCreation(P, id, {etat: 'erreur', erreur: e.message});
    throw e;
  } finally {
    leger?.ranger();
  }
  const defaut =['image'].includes(c.type) ? '.png' : ['video', 'doublage'].includes(c.type) ? '.mp4' : '.mp3';
  const {slug} = await import('./commun.mjs');
  const nom = `${c.id}-${c.type}-${slug(c.titre, 32) || 'creation'}${extension(r.type, defaut)}`;
  fs.mkdirSync(path.join(P.racine, 'creations'), {recursive: true});
  fs.writeFileSync(path.join(P.racine, 'creations', nom), r.octets);
  const s = await sonde(path.join(P.racine, 'creations', nom));
  const apres = await credits();
  const juste = finMesure();
  prog(1);
  return majCreation(P, id, {etat: 'pret', fichier: nom, ...s, cout: juste && avant && apres && apres.utilises > avant.utilises ? apres.utilises - avant.utilises : null});
}

// ——— Les bruitages de Dérush (transitions, titres) en qualité ElevenLabs ———
// Chaque son est recalé pour que son moment fort tombe au même endroit que celui de la version d'origine :
// le moteur les déclenche juste avant la coupe (le « souffle » 0,55 s avant, le « fouet » 0,07 s avant…).
const BRUITAGES = {
  souffle: {texte: 'Cinematic whoosh riser building up quickly to a peak at the very end, airy, for a video transition', duree: 1.5, mode: 'sommet'},
  passage: {texte: 'Fast clean air whoosh pass-by, short, for a quick video cut', duree: 1},
  fouet: {texte: 'Sharp whip swish, very short and snappy', duree: 0.8},
  impact: {texte: 'Deep punchy cinematic impact hit with sub bass boom, short', duree: 1.5},
  declic: {texte: 'Crisp camera shutter click, single, short', duree: 0.6},
  pop: {texte: 'Bubbly cartoon pop, single, very short, for text appearing', duree: 0.5},
  glitch: {texte: 'Short digital glitch stutter, electronic distortion burst', duree: 0.8},
};
export const dossierBruitages = () => path.join(DOSSIER_SUPPORT, 'sons');
/** Le fichier d'un bruitage de Dérush : la version ElevenLabs si elle a été faite, sinon null. */
export function bruitageElevenLabs(nom) {
  const f = path.join(dossierBruitages(), `${nom}.wav`);
  return BRUITAGES[nom] && fs.existsSync(f) ? f : null;
}
let suiviBruitages = null; // {actif, progression, erreur}
export function etatBruitages() {
  const d = dossierBruitages();
  const faits = Object.keys(BRUITAGES).filter((n) => fs.existsSync(path.join(d, `${n}.wav`)));
  let cout = null;
  try { cout = JSON.parse(fs.readFileSync(path.join(d, 'elevenlabs.json'), 'utf8')).cout ?? null; } catch { /* pas encore faits */ }
  return {faits: faits.length, total: Object.keys(BRUITAGES).length, cout, en_cours: !!suiviBruitages?.actif, progression: suiviBruitages?.progression ?? null, erreur: suiviBruitages?.erreur ?? null};
}
/** Lance la création des bruitages en arrière-plan. */
export function lancerBruitages() {
  if (!chargerCle()) throw new Error('ElevenLabs n’est pas branché.');
  if (suiviBruitages?.actif) return etatBruitages();
  suiviBruitages = {actif: true, progression: 0, erreur: null};
  creerBruitages((p) => { suiviBruitages.progression = p; })
    .then(() => { suiviBruitages = null; }, (e) => { suiviBruitages = {actif: false, erreur: String(e.message).slice(0, 300)}; });
  return etatBruitages();
}
/** Revient aux bruitages d'origine de Dérush. */
export function retirerBruitages() {
  if (suiviBruitages?.actif) throw new Error('Les bruitages sont en train d’être créés.');
  const d = dossierBruitages();
  for (const n of Object.keys(BRUITAGES)) fs.rmSync(path.join(d, `${n}.wav`), {force: true});
  fs.rmSync(path.join(d, 'elevenlabs.json'), {force: true});
  return etatBruitages();
}
/** Le volume d'un son, par tranches de 5 ms (et sa crête), pour caler les bruitages refaits sur ceux d'origine. */
async function enveloppe(fichier) {
  const {FFMPEG} = await import('./outils.mjs');
  const pcm = await new Promise((ok, ko) => {
    const p = spawn(FFMPEG, ['-v', 'error', '-i', fichier, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-']);
    const morceaux = [];
    p.stdout.on('data', (b) => morceaux.push(b));
    p.on('error', ko);
    p.on('close', (code) => (code === 0 ? ok(Buffer.concat(morceaux)) : ko(new Error('Son illisible.'))));
  });
  const x = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 4));
  const pas = 240; // 5 ms
  const env = [];
  let max = 0;
  let crete = 0;
  for (let i = 0; i + pas <= x.length; i += pas) {
    let s = 0;
    for (let k = i; k < i + pas; k++) { s += x[k] * x[k]; crete = Math.max(crete, Math.abs(x[k])); }
    const v = Math.sqrt(s / pas);
    env.push(v);
    max = Math.max(max, v);
  }
  return {env, max, crete, pas_s: pas / 48000, duree: x.length / 48000};
}
/** Le moment fort d'un son : son sommet (souffle), ou son attaque, quand il atteint la moitié de son volume maximal. */
function momentFort(e, mode) {
  if (mode === 'sommet') { let k = 0; for (let i = 1; i < e.env.length; i++) if (e.env[i] > e.env[k]) k = i; return k * e.pas_s; }
  return Math.max(0, e.env.findIndex((v) => v >= e.max * 0.5)) * e.pas_s;
}
/** La fin d'un son : après elle, il reste sous 1 % de son volume maximal (−40 dB). */
function finDuSon(e) {
  let k = e.env.length - 1;
  while (k > 0 && e.env[k] < e.max * 0.01) k--;
  return (k + 1) * e.pas_s;
}
/** Refait les 7 bruitages de Dérush avec ElevenLabs (une seule fois : ils servent ensuite à tous les projets). */
export async function creerBruitages(prog = () => {}) {
  const {ffmpeg} = await import('./outils.mjs');
  const {fileURLToPath} = await import('node:url');
  const origines = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sons');
  const d = dossierBruitages();
  fs.mkdirSync(d, {recursive: true});
  const tmp = fs.mkdtempSync(path.join(d, '.tmp-'));
  const finMesure = mesure();
  const avant = await credits();
  try {
    const noms = Object.keys(BRUITAGES);
    for (const [k, nom] of noms.entries()) {
      const b = BRUITAGES[nom];
      const r = await appel('/v1/sound-generation', {query: {output_format: 'mp3_44100_192'}, json: {text: b.texte, duration_seconds: b.duree, model_id: 'eleven_text_to_sound_v3', prompt_influence: 0.5}});
      const mp3 = path.join(tmp, `${nom}.mp3`);
      fs.writeFileSync(mp3, r.octets);
      // décodé une fois en WAV : les coupes tombent ensuite à l'échantillon près (un MP3 se coupe moins précisément)
      const brut = path.join(tmp, `${nom}-brut.wav`);
      await ffmpeg(['-y', '-i', mp3, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', brut]);
      const orig = await enveloppe(path.join(origines, `${nom}.wav`));
      const neuf = await enveloppe(brut);
      if (!neuf.max) throw new Error(`Le bruitage « ${nom} » est revenu muet.`);
      // le moment fort du nouveau son tombe exactement là où tombait celui d'origine (Dérush le déclenche avant la coupe)
      const cleO = momentFort(orig, b.mode);
      const cleN = momentFort(neuf, b.mode);
      const decalage = cleN - cleO; // > 0 : on coupe le début du nouveau son ; < 0 : on le fait précéder d'un silence
      // le souffle s'arrête juste après son sommet ; les autres gardent leur traîne naturelle, sans s'éterniser
      const queue = b.mode === 'sommet' ? cleN + 0.04 : Math.min(Math.max(finDuSon(neuf), cleN + 0.12), cleN + Math.max(0.6, orig.duree - cleO + 0.35));
      const longueur = Math.max(queue - decalage, cleO + 0.1);
      // même volume que le son d'origine (réglé dans Dérush) ; un limiteur empêche toute saturation
      const gain = Math.min(16, orig.max / neuf.max);
      const filtres = [decalage < 0 ? `adelay=${Math.round(-decalage * 1000)}:all=1` : null, `volume=${gain.toFixed(4)}`, 'alimiter=limit=0.89:level=false:latency=true:attack=1:release=30', 'afade=t=in:d=0.003', `afade=t=out:st=${Math.max(0, longueur - 0.06).toFixed(3)}:d=0.06`].filter(Boolean).join(',');
      await ffmpeg(['-y', ...(decalage > 0 ? ['-ss', decalage.toFixed(3)] : []), '-i', brut, '-af', filtres, '-t', longueur.toFixed(3), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', path.join(tmp, `${nom}.wav`)]);
      prog((k + 1) / noms.length);
    }
    for (const nom of noms) fs.renameSync(path.join(tmp, `${nom}.wav`), path.join(d, `${nom}.wav`));
  } catch (e) {
    finMesure();
    throw e;
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
  const apres = await credits();
  const juste = finMesure();
  fs.writeFileSync(path.join(d, 'elevenlabs.json'), JSON.stringify({cree_le: new Date().toISOString(), cout: juste && avant && apres && apres.utilises > avant.utilises ? apres.utilises - avant.utilises : null}, null, 2));
  return etatBruitages();
}
