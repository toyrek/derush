// Dérush — la fiche de chaque montage livré : son « ADN » (pour qui, genre, sujet, durée, format, accroche, rythme,
// voix, son, musique, habillage, IA) et ce qu'en pense la personne (👍 ou 👎, et un mot). C'est la matière de
// l'apprentissage : croisée avec les vues (lib/suivi.mjs), elle dit quel montage marche (lib/recette.mjs).
//
// Rangement : dans le projet (.derush/fiches/<clé>.json, toujours), et dans l'espace du projet
// (espaces/<id>/fiches.jsonl, une ligne par événement : la fiche, puis chaque note) — sauf pour « Personne », qui
// n'apprend rien. Tout reste sur l'ordinateur.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DOSSIER_ESPACES, apprend} from './espaces.mjs';
import {ecrireJson} from './outils.mjs';
import {lienPropre} from './suivi.mjs';

const texte = (v, n) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n));
// une mesure qui manque reste « on ne sait pas » : Number(null) vaut 0, et une vidéo de 0 s serait rangée « moins de 30 s »
const nombre = (v, d = 1) => { if (v == null || v === '') return null; const x = Number(v); return Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null; };

/** La clé d'une vidéo livrée : stable même si le projet change de dossier (date de création du projet + nom du fichier). */
export const cleVideo = (P, nomVideo) => crypto.createHash('sha1').update(`${P.d.cree_le ?? P.racine}|${nomVideo}`).digest('hex').slice(0, 14);

// les mots d'un bloc de son qui disent « musique » (le reste : bruitages, voix)
const MUSIQUE = /musique|music|boucle|loop|rock|beat|piano|guitare|ambiance musicale|morceau|bande[- ]son|instrumental|lo-?fi|jazz|électro|electro|hip[- ]hop/i;
// un titre posé derrière la personne : dit par le nom du bloc ou par son détail (« « SHIBUYA » derrière la personne »)
const DERRIERE = /derri[eè]re|PersonneDevant|TitreGeant|titre g[ée]ant/i;

/**
 * Construit la fiche d'une vidéo livrée. `table` : la table de montage de l'IA (rendu/timeline.json vérifiée) ;
 * `mesures` : ce que Dérush a contrôlé à la livraison ({accroche, brillance_db, lufs, rythme}).
 */
export function creerFiche({P, espace, version, video, table = null, mesures = {}, reponse = ''}) {
  const blocs = Array.isArray(table?.blocs) ? table.blocs : [];
  const parPiste = (p) => blocs.filter((b) => b.piste === p);
  const sons = parPiste('son');
  const musiques = sons.filter((b) => MUSIQUE.test(`${b.nom} ${b.detail ?? ''}`));
  const r = mesures.rythme ?? null;
  const a = mesures.accroche ?? null;
  const largeur = Number(video.largeur) || null;
  const hauteur = Number(video.hauteur) || null;
  return {
    v: 1,
    cle: cleVideo(P, video.nom),
    quand: new Date().toISOString(),
    espace: espace?.id ?? null,
    metier: espace?.metier?.type ?? null,
    projet: texte(P.d.titre, 120),
    projet_cree_le: P.d.cree_le ?? null,
    projet_dossier: P.racine,
    vignettes: typeof video.vignettes === 'string' ? video.vignettes : null,
    // la série de l'espace du projet seulement : un épisode de « Moi » passé chez un client n'en est plus un
    serie: P.d.serie?.nom && P.d.serie.espace === espace?.id ? P.d.serie.nom : null,
    mode: P.d.mode ?? 'montage',
    genre: P.d.brief?.type || null,
    sujet: texte(P.d.brief?.objectif || video.titre || P.d.titre, 200),
    video: video.nom,
    titre: texte(video.titre, 120) || null,
    version: version?.n ?? null,
    ia: {moteur: version?.moteur ?? null, qualite: version?.qualite ?? null, modele: version?.modele ?? null},
    duree_s: nombre(video.duree),
    format: {largeur, hauteur, orientation: largeur && hauteur ? (hauteur > largeur ? 'vertical' : largeur > hauteur ? 'horizontal' : 'carre') : null},
    accroche: a ? {grande: !!a.ok, hauteur_pct: nombre(a.hauteur_pct), texte: texte(a.texte, 80) || null} : null,
    rythme: r?.ok ? {debit_mots_min: r.debit_mots_min ?? null, debut_parole_s: r.debut_parole_s ?? null, pauses: r.pauses?.length ?? 0, hesitations: r.hesitations?.length ?? 0, redites: r.redites?.length ?? 0} : null,
    voix: mesures.brillance_db != null ? {brillance_db: nombre(mesures.brillance_db)} : null,
    son: mesures.lufs != null ? {lufs: nombre(mesures.lufs)} : null,
    plans: parPiste('plan').length || null,
    textes: parPiste('texte').map((b) => texte(b.nom, 60)).filter(Boolean).slice(0, 12),
    effets: parPiste('effet').map((b) => texte(b.nom, 60)).filter(Boolean).slice(0, 12),
    musique: musiques.map((b) => texte(b.nom, 80)).slice(0, 3),
    bruitages: Math.max(0, sons.length - musiques.length),
    sous_titres: parPiste('sous-titres').length > 0,
    titre_derriere: table ? parPiste('texte').some((b) => DERRIERE.test(`${b.nom ?? ''} ${b.detail ?? ''}`)) : null,
    // sans table de montage, on ne sait ni s'il y avait de la musique ni ce qui était posé : la recette n'en dit rien
    table: !!table,
    resume_ia: texte(reponse, 600) || null,
    note: null,
    mot: null,
  };
}

const dossierProjet = (P) => path.join(P.racine, '.derush', 'fiches');
const fichierEspace = (id) => path.join(DOSSIER_ESPACES, id, 'fiches.jsonl');
/** La fiche dans le projet, écrite d'un coup (fichier temporaire puis renommage) : un arrêt en pleine écriture ne la coupe pas. */
const ecrireFicheProjet = (P, fiche) => ecrireJson(path.join(dossierProjet(P), `${fiche.cle}.json`), fiche, 1);
/** Une ligne de plus dans le journal de l'espace ; son dossier est créé au besoin (il n'existe pas tant que rien n'y est rangé). */
function ajouterALEspace(id, evenement) {
  try {
    fs.mkdirSync(path.dirname(fichierEspace(id)), {recursive: true});
    fs.appendFileSync(fichierEspace(id), `${JSON.stringify(evenement)}\n`);
  } catch { throw new Error('Dérush n’a pas pu écrire dans le dossier de cet espace (disque plein, ou dossier protégé).'); }
}

/** Range la fiche : dans le projet, et dans son espace s'il apprend. */
export function enregistrerFiche(P, fiche, espace) {
  ecrireFicheProjet(P, fiche);
  if (apprend(espace)) ajouterALEspace(espace.id, {type: 'fiche', ...fiche});
  return fiche;
}

/** La fiche d'une vidéo de ce projet (ou null). */
export function ficheDe(P, nomVideo) {
  try { return JSON.parse(fs.readFileSync(path.join(dossierProjet(P), `${cleVideo(P, nomVideo)}.json`), 'utf8')); } catch { return null; }
}

const clePost = (p) => `${p.reseau}:${p.id ?? p.lien}`;
/**
 * Les publications d'une fiche, avec celle-ci : sans doublon, et à la place du brouillon du même réseau (ni lien ni
 * identifiant) dont elle est la suite — un brouillon TikTok publié depuis l'app, puis lié par son lien, reste UNE publication.
 */
function avecPublication(liste, publication) {
  const cle = clePost(publication);
  const vraie = publication.id != null || publication.lien != null;
  return [...(liste ?? []).filter((p) => p && clePost(p) !== cle && !(vraie && p.reseau === publication.reseau && p.id == null && p.lien == null)), publication];
}

// Le journal d'un espace est relu à chaque écran (tableau de bord, recette, une vignette par vidéo) : il n'est analysé
// qu'une fois tant que le fichier n'a pas changé (sa date et sa taille ; on n'y ajoute que des lignes).
const LUES = new Map(); // espace → {marque, fiches, parCle}
const RIEN = {fiches: [], parCle: new Map()};
function fichesDe(id) {
  if (!/^[a-z0-9-]{2,40}$/.test(String(id))) return RIEN;
  let st;
  try { st = fs.statSync(fichierEspace(id)); } catch { LUES.delete(id); return RIEN; }
  const marque = `${st.mtimeMs}:${st.size}`;
  const deja = LUES.get(id);
  if (deja?.marque === marque) return deja;
  let lignes = [];
  try { lignes = fs.readFileSync(fichierEspace(id), 'utf8').split('\n'); } catch { return RIEN; }
  const parCle = new Map();
  for (const l of lignes) {
    if (!l.trim()) continue;
    let x;
    try { x = JSON.parse(l); } catch { continue; }
    if (!x || typeof x !== 'object') continue;
    if (x.type === 'fiche' && x.cle) { const {type, ...f} = x; parCle.set(x.cle, {...(parCle.get(x.cle) ?? {}), ...f}); }
    else if (x.type === 'note' && parCle.has(x.cle)) Object.assign(parCle.get(x.cle), {note: x.note, mot: x.mot, note_le: x.quand});
    else if (x.type === 'publication' && parCle.has(x.cle) && x.publication) { const f = parCle.get(x.cle); f.publications = avecPublication(f.publications, x.publication); }
  }
  const lu = {marque, fiches: [...parCle.values()].sort((a, b) => String(b.quand).localeCompare(String(a.quand))), parCle};
  LUES.set(id, lu);
  return lu;
}

/**
 * Les fiches d'un espace, la dernière version de chacune (notes appliquées), les plus récentes d'abord.
 * Une ligne abîmée est sautée, jamais bloquante. Les fiches rendues sont partagées (gardées en mémoire) : à lire, pas à modifier.
 */
export function lireFiches(id) { return [...fichesDe(id).fiches]; }
/** Une fiche d'un espace par sa clé (ou null), sans relire le journal s'il n'a pas changé. */
export function ficheParCle(id, cle) { return fichesDe(id).parCle.get(cle) ?? null; }

/** 👍 (1), 👎 (-1) ou rien (0), et un mot : sur la fiche du projet, et dans l'espace. Renvoie la fiche. */
export function noterVideo(P, nomVideo, {note = 0, mot = ''} = {}, espace = null) {
  const f = ficheDe(P, nomVideo);
  if (!f) throw new Error('Cette vidéo n’a pas de fiche (livrée avant cette version de Dérush).');
  f.note = [1, -1].includes(Number(note)) ? Number(note) : null;
  f.mot = texte(mot, 200) || null;
  f.note_le = new Date().toISOString();
  ecrireFicheProjet(P, f);
  if (apprend(espace) && espace.id === f.espace) ajouterALEspace(espace.id, {type: 'note', cle: f.cle, note: f.note, mot: f.mot, quand: f.note_le});
  return f;
}

/** Une publication rattachée à la fiche (dans le projet et l'espace) : {reseau, lien, id, quand}. */
export function rattacherPublication(P, nomVideo, publication, espace = null) {
  const f = ficheDe(P, nomVideo);
  if (!f) return null;
  // le lien gardé est une adresse https entière (jamais le texte collé tel quel)
  const pub = {...publication, lien: lienPropre(publication.lien)};
  f.publications = avecPublication(f.publications, pub);
  ecrireFicheProjet(P, f);
  if (apprend(espace) && espace.id === f.espace) ajouterALEspace(espace.id, {type: 'publication', cle: f.cle, cle_post: clePost(pub), publication: pub});
  return f;
}

/** La phrase d'une note pour le carnet de l'espace (« Retour de la personne sur … : trop long »), ou null. */
export function leconDeNote(f) {
  if (!f?.mot) return null;
  const quoi = f.titre || f.projet || 'un montage';
  return `Retour de la personne sur « ${quoi} » (${f.note === 1 ? 'aimé' : f.note === -1 ? 'pas aimé' : 'sans note'}) : ${f.mot}`;
}
