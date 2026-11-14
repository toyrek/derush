// Dérush — les modèles de série : « comme d'habitude ». Un montage réussi devient le modèle des épisodes suivants :
// la même accroche, le même habillage, le même carton de fin, la même musique, le même rythme ; seul le contenu change.
//
// Une série appartient à un espace (espaces/<id>/series/<série>/) : serie.json (d'où elle vient, le brief, le style, le
// format, sa fiche), code/ (les scènes Remotion écrites par l'IA), public/ (ses petites ressources : fond de fin,
// pages…), timeline.json (sa table de montage) et apercu.jpg. Un nouveau projet « épisode de la série » reprend le
// brief, le style et le format ; à chaque demande, l'IA reçoit contexte/serie/ et la consigne de garder l'identité.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DOSSIER_ESPACES, dossierEspace, trouverEspace, espaceDuProjet} from './espaces.mjs';
import {fichierDeLIA} from './carnet.mjs';
import {ecrireJson} from './outils.mjs';

const texte = (v, n) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n));
const ID = /^[a-z0-9-]{2,60}$/;
const PUBLIC_IGNORE = new Set(['plans', 'polices', 'sons', 'detourage', 'node_modules']);
const MAX_FICHIER = 8 * 1024 * 1024;
const MAX_TOTAL = 80 * 1024 * 1024;

const dossierSeries = (espaceId) => path.join(DOSSIER_ESPACES, espaceId, 'series');

/** Les séries d'un espace, les plus récentes d'abord : [{id, nom, cree_le, depuis, apercu}]. */
export function listerSeries(espaceId) {
  const d = dossierSeries(espaceId);
  let noms = [];
  try { noms = fs.readdirSync(d); } catch { return []; }
  const r = [];
  for (const n of noms) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(d, n, 'serie.json'), 'utf8'));
      r.push({id: s.id, nom: s.nom, cree_le: s.cree_le, depuis: s.depuis, episodes: s.episodes ?? 0, apercu: fs.existsSync(path.join(d, n, 'apercu.jpg'))});
    } catch { /* dossier incomplet : ignoré */ }
  }
  return r.sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le)));
}

export function lireSerie(espaceId, id) {
  if (!ID.test(String(id))) return null;
  try { return JSON.parse(fs.readFileSync(path.join(dossierSeries(espaceId), id, 'serie.json'), 'utf8')); } catch { return null; }
}
export const dossierSerie = (espaceId, id) => (ID.test(String(id)) ? path.join(dossierSeries(espaceId), id) : null);

/** Copie un dossier en ne gardant que des fichiers raisonnables (8 Mo au plus chacun, 80 Mo en tout). */
function copierLeger(src, dst, ignorer = new Set(), compte = {octets: 0, sautes: 0}) {
  let entrees = [];
  try { entrees = fs.readdirSync(src, {withFileTypes: true}); } catch { return compte; }
  for (const e of entrees) {
    if (ignorer.has(e.name) || e.name.startsWith('.')) continue;
    const a = path.join(src, e.name);
    const b = path.join(dst, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) { copierLeger(a, b, new Set(), compte); continue; }
    if (!e.isFile()) continue;
    const t = fs.statSync(a).size;
    if (t > MAX_FICHIER || compte.octets + t > MAX_TOTAL) { compte.sautes++; continue; }
    fs.mkdirSync(path.dirname(b), {recursive: true});
    fs.copyFileSync(a, b);
    compte.octets += t;
  }
  return compte;
}

/**
 * Fait d'une vidéo livrée le modèle d'une série. `atelier` : le dossier de travail de l'IA ; `version` et `video` :
 * la version livrée et sa vidéo (champs de lib/claude.mjs) ; `fiche` : sa fiche (lib/fiches.mjs), si elle existe.
 */
export function creerSerie({P, espaceId, atelier, version, video, fiche = null, nom, vignettes = null}) {
  const e = trouverEspace(espaceId);
  if (!e || e.type === 'neutre') throw new Error('Une série se range dans « Moi » ou chez un client, pas dans « Personne ».');
  const n = texte(nom, 60);
  if (!n) throw new Error('Donne un nom à la série.');
  if (!atelier || !fs.existsSync(path.join(atelier, 'remotion', 'src'))) throw new Error('Le dossier de travail de ce montage n’existe plus : impossible d’en garder le modèle.');
  if (listerSeries(espaceId).some((s) => s.nom.toLowerCase() === n.toLowerCase())) throw new Error(`La série « ${n} » existe déjà.`);
  const racine = n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'serie';
  const id = `${racine}-${crypto.randomBytes(2).toString('hex')}`;
  dossierEspace(espaceId);
  const D = path.join(dossierSeries(espaceId), id);
  fs.mkdirSync(D, {recursive: true});
  const code = copierLeger(path.join(atelier, 'remotion', 'src'), path.join(D, 'code'), new Set(['moteur.js']));
  // la bible et les passeports des personnages (public/serie/, compétence derush-serie-animee) passent en premier :
  // des vidéos lourdes ne doivent jamais leur prendre la place
  const pub = copierLeger(path.join(atelier, 'remotion', 'public', 'serie'), path.join(D, 'public', 'serie'));
  copierLeger(path.join(atelier, 'remotion', 'public'), path.join(D, 'public'), new Set([...PUBLIC_IGNORE, 'serie']), pub);
  // la table de montage : un vrai fichier du dossier de travail seulement (comme copierLeger, jamais un lien posé par
  // l'IA vers un fichier d'ailleurs : il reviendrait dans chaque épisode)
  const table = fichierDeLIA(atelier, path.join('rendu', 'timeline.json'), MAX_FICHIER);
  if (table) { try { fs.copyFileSync(table, path.join(D, 'timeline.json')); } catch { /* pas de table */ } }
  if (vignettes && fs.existsSync(vignettes)) { try { fs.copyFileSync(vignettes, path.join(D, 'apercu.jpg')); } catch { /* sans aperçu */ } }
  const s = {
    v: 1, id, nom: n, espace: espaceId, cree_le: new Date().toISOString(),
    depuis: {projet: texte(P.d.titre, 120), video: video?.nom ?? null, titre: texte(video?.titre, 120) || null, version: version?.n ?? null, ia: version?.modele ?? version?.moteur ?? null},
    mode: P.d.mode ?? 'montage', brief: P.d.brief ?? {}, style: P.d.style ?? {}, sortie: P.d.sortie ?? null, langue: P.d.langue ?? 'fr',
    fiche: fiche ? {duree_s: fiche.duree_s, accroche: fiche.accroche, musique: fiche.musique, textes: fiche.textes, effets: fiche.effets, rythme: fiche.rythme} : null,
    reponse_ia: texte(version?.reponse ?? '', 1500) || null,
    episodes: 0,
    copie: {code_octets: code.octets, ressources_octets: pub.octets, sautes: code.sautes + pub.sautes},
  };
  ecrireJson(path.join(D, 'serie.json'), s, 1);
  return s;
}

/** Retire une série (son dossier part dans espaces/<id>/series/.retirees/ : rien n'est effacé). */
export function retirerSerie(espaceId, id) {
  const D = dossierSerie(espaceId, id);
  if (!D || !fs.existsSync(D)) throw new Error('Série inconnue.');
  const dst = path.join(dossierSeries(espaceId), '.retirees', `${id}-${new Date().toISOString().slice(0, 10)}`);
  fs.mkdirSync(path.dirname(dst), {recursive: true});
  fs.renameSync(D, dst);
  return true;
}

/** Ce qu'un nouveau projet « épisode » reprend de sa série : brief, style, format, mode, langue. */
export function reglagesEpisode(s) {
  return {serie: {id: s.id, nom: s.nom, espace: s.espace}, brief: s.brief ?? {}, style: s.style ?? {}, ...(s.sortie ? {sortie: {...s.sortie, auto: false}} : {}), mode: s.mode ?? 'montage', langue: s.langue ?? 'fr'};
}
/** Compte un épisode de plus (à la création d'un projet de la série). */
export function compterEpisode(espaceId, id) {
  const D = dossierSerie(espaceId, id);
  if (!D) return;
  try { const f = path.join(D, 'serie.json'); const s = JSON.parse(fs.readFileSync(f, 'utf8')); s.episodes = (s.episodes ?? 0) + 1; ecrireJson(f, s, 1); } catch { /* série partie */ }
}

/** SERIE.md : ce que l'IA doit garder d'un épisode à l'autre. */
export function serieEnTexte(s) {
  const f = s.fiche ?? {};
  const L = [`# Série « ${s.nom} »`, '', `Ce projet est un nouvel épisode de la série « ${s.nom} », dont le modèle est « ${s.depuis?.titre || s.depuis?.projet || 'un montage précédent'} ».`,
    'Garde son identité : la même formule d’accroche, le même habillage (titres, étiquettes, cartes, sous-titres), le même carton de fin, le même genre de musique et le même rythme. Change le contenu : les rushes, ce qui est dit, les textes, les titres.', '',
    '## Ce qu’il y a ici', '',
    '- `code/` : les scènes Remotion du modèle. Copie-les dans `remotion/src/` et adapte-les au nouveau contenu (textes, temps, images), plutôt que de tout réécrire.',
    '- `public/` : ses ressources (fond de fin, images) : copie celles qui servent encore dans `remotion/public/`. S’il y a `public/serie/` (la bible de la série et les passeports de ses personnages), relis-le avant tout et recopie-le tel quel : compétence `derush-serie-animee`.',
    '- `timeline.json` : sa table de montage (ce qui était posé, quand, avec quel détail).',
    '- `apercu.jpg` : des images du modèle.', ''];
  const lignes = [['Durée', f.duree_s ? `${f.duree_s} s (vise la même, à ±20 %)` : null], ['Accroche', f.accroche ? `${f.accroche.texte ? `« ${f.accroche.texte} »` : 'un texte'} en ${f.accroche.grande ? 'grand' : 'petit'}${f.accroche.hauteur_pct ? ` (${f.accroche.hauteur_pct} % de la hauteur)` : ''}` : null],
    ['Musique', f.musique?.length ? f.musique.join(' ; ') : null], ['Textes posés', f.textes?.length ? f.textes.join(', ') : null], ['Effets', f.effets?.length ? f.effets.join(', ') : null]].filter(([, v]) => v);
  if (lignes.length) L.push('## Le modèle en bref', '', ...lignes.map(([a, b]) => `- **${a}** : ${b}`), '');
  if (s.reponse_ia) L.push('## Ce que l’IA en avait dit', '', s.reponse_ia, '');
  return `${L.join('\n').trimEnd()}\n`;
}

/**
 * Pose la série du projet dans le dossier de travail (contexte/serie/) ; la retire si le projet n'en a pas — ou si
 * elle n'est pas de SON espace : un épisode d'une série de « Moi » passé ensuite chez un client (ou à « Personne »)
 * ne reçoit ni son code, ni son habillage, ni la consigne d'en garder l'identité.
 */
export function installerSerie(dossier, P, espace = espaceDuProjet(P)) {
  const D = path.join(dossier, 'contexte', 'serie');
  fs.rmSync(D, {recursive: true, force: true});
  const ref = P?.d?.serie;
  if (!ref?.id || !ref?.espace) return null;
  if (!espace || espace.type === 'neutre' || ref.espace !== espace.id) return null;
  const s = lireSerie(ref.espace, ref.id);
  const src = dossierSerie(ref.espace, ref.id);
  if (!s || !src) return null;
  fs.mkdirSync(D, {recursive: true});
  fs.writeFileSync(path.join(D, 'SERIE.md'), serieEnTexte(s));
  for (const x of ['code', 'public']) if (fs.existsSync(path.join(src, x))) fs.cpSync(path.join(src, x), path.join(D, x), {recursive: true});
  for (const x of ['timeline.json', 'apercu.jpg']) if (fs.existsSync(path.join(src, x))) fs.copyFileSync(path.join(src, x), path.join(D, x));
  return s;
}
export const consigneSerie = (s) => (s ? `- Ce projet est un épisode de la série « ${s.nom} » : lis contexte/serie/SERIE.md et garde l’identité du modèle (accroche, habillage, carton de fin, musique, rythme), en partant de son code. Seul le contenu change.` : '');
