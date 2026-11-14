// Dérush — les espaces de travail : pour qui est un projet.
//   « Moi » : la personne. Son profil (lu sur ses comptes par Treg), son métier, son carnet du monteur, ses chiffres.
//   Un client : une entreprise, une association, une mairie… Sa marque (ton, public, interdits, couleurs, polices,
//     logo, mentions), son métier, son carnet, ses chiffres.
//   « Personne » (neutre) : l'IA ne reçoit ni profil ni carnet, et rien n'est appris.
// Chaque projet appartient à un espace (P.d.espace). L'IA ne reçoit que celui du projet : un montage pour une
// entreprise ne reprend jamais l'univers de la personne (le Japon de ses chroniques manga), ni l'inverse.
//
// Rangement, dans le dossier de Dérush : espaces/espaces.json (la liste), puis un dossier par espace :
// espaces/<id>/carnet.json, fiches.jsonl, suivi.json, recette.json, marque/logo.*, series/<id>/.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DOSSIER_SUPPORT} from './moteurs.mjs';

export const DOSSIER_ESPACES = path.join(DOSSIER_SUPPORT, 'espaces');
const FICHIER = path.join(DOSSIER_ESPACES, 'espaces.json');

/**
 * Les mots qui font penser à un métier : des mots ENTIERS (« son » dans « maison », « rap » dans « rapide », « live »
 * dans « livres » ne disent rien). « ~ » à la fin d'un mot : n'importe quelle suite (chroniq~ : chronique, chroniqueur).
 */
const mots = (liste) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${liste.replaceAll('~', '\\p{L}*')})(?![\\p{L}\\p{N}])`, 'iu');

/**
 * Les métiers : ce que fait la personne (ou le client). Ils règlent le genre de vidéo proposé au départ et disent à
 * l'IA sur quoi insister au montage. `mots` sert à deviner le métier d'après le profil et les titres des projets.
 */
export const METIERS = {
  chronique: {nom: 'Chroniques, revues de presse', exemples: 'mangas, livres, films, jeux, sorties', type_video: 'face', mots: mots('mangas?|livres?|romans?|bd|comics?|chroniq~|revues?|critiques?|avis|lectures?|sorties?|éditions?|[ée]diteurs?|films?|cinéma|jeux? vidéo|animes?'),
    pour_le_montage: ['Montre l’objet (une couverture, une page, une affiche) au moment exact où il est nommé, net et en grand.', 'Une carte quand on parle d’une collection, d’une série ou d’un éditeur, avec ses éléments.', 'Une fiche à la fin : titre, auteur, éditeur, date.', 'Les noms propres vérifiés sur le web, écrits juste dans les sous-titres.']},
  vlog: {nom: 'Vlog, voyage, lifestyle', exemples: 'journées, voyages, coulisses', type_video: 'trend', mots: mots('vlogs?|voyages?|travel|journées?|day in|lifestyle|routines?|coulisses?'),
    pour_le_montage: ['Le rythme d’abord : des plans courts, coupés sur le geste ou sur le temps de la musique.', 'L’ambiance du lieu : garde un peu de son réel sous la musique.', 'Un lieu nommé à l’écran quand on y arrive.', 'Une fin qui donne envie de la suite.']},
  documentaire: {nom: 'Documentaire, reportage', exemples: 'enquêtes, portraits, sujets de société', type_video: 'explication', mots: mots('documentaires?|reportages?|enquêtes?|portraits?|témoign~|histoires?|archives?'),
    pour_le_montage: ['Laisse respirer les interviews : des plans plus longs, pas d’effets sur la parole.', 'Des plans de coupe sur ce qui est dit, des archives datées et sourcées.', 'Le nom et la fonction de chaque personne à sa première apparition.', 'De la sobriété : peu de titres, une musique discrète.']},
  interview: {nom: 'Interviews, podcasts', exemples: 'entretiens, émissions, lives', type_video: 'podcast', mots: mots('podcasts?|interviews?|entretiens?|émissions?|invitée?s?|lives?|talks?'),
    pour_le_montage: ['Deux voix propres et au même niveau.', 'Les phrases fortes en exergue, en grand.', 'Des extraits courts qui tiennent seuls, avec leur contexte en une ligne.', 'Le nom de l’invité à l’écran.']},
  tuto: {nom: 'Tutoriels, pédagogie', exemples: 'cours, astuces, explications', type_video: 'explication', mots: mots('tutos?|tutoriels?|cours|astuces?|apprendre|comment|expli[cq]~|leçons?|formations?|pédago~'),
    pour_le_montage: ['Des étapes numérotées, dites et écrites.', 'Un zoom sur le geste ou l’écran au bon moment.', 'Le résultat montré dès le début, puis comment y arriver.', 'Rien de superflu : chaque plan sert à comprendre.']},
  humour: {nom: 'Humour, sketchs', exemples: 'sketchs, réactions, parodies', type_video: 'face', mots: mots('humour|sketchs?|sketches|drôles?|parodies?|blagues?|réactions?|m[eè]mes?'),
    pour_le_montage: ['Le rythme de la chute : coupe juste après la réplique, laisse un temps sur la réaction.', 'Des bruitages et des zooms au service du gag, jamais à la place.', 'Les sous-titres au mot près (le timing fait rire).']},
  musique: {nom: 'Musique, clips', exemples: 'clips, lives, covers', type_video: 'trend', mots: mots('musiques?|clips?|chansons?|rap|rappeu~|covers?|concerts?|beats?'),
    pour_le_montage: ['Toutes les coupes sur le temps de la musique.', 'Le son d’origine intact : pas de musique ajoutée par-dessus.', 'Les paroles à l’écran seulement si elles portent la vidéo.']},
  sport: {nom: 'Sport', exemples: 'matchs, entraînements, performances', type_video: 'trend', mots: mots('sports?|sporti~|matchs?|foot|football|basket|boxe|entraîn~|muscu~|courses?|athl~'),
    pour_le_montage: ['Les temps forts d’abord, en ralenti s’il le faut.', 'Le score, le nom, le chiffre à l’écran.', 'Une musique qui pousse, des coupes sèches.']},
  marque: {nom: 'Entreprise, marque', exemples: 'produits, communication, recrutement', type_video: 'evenement', mots: mots('entreprises?|marques?|produits?|clients?|sociétés?|recrut~|b2b|corporate|commerci~'),
    pour_le_montage: ['La charte avant tout : couleurs, polices, logo, ton.', 'Les mentions obligatoires et les noms exacts des produits.', 'Des sous-titres complets (beaucoup regardent sans le son).', 'Jamais l’univers personnel du monteur.']},
  association: {nom: 'Association, événement, collectivité', exemples: 'événements, actions, jeunesse, quartiers', type_video: 'evenement', mots: mots('associations?|assos?|[ée]v[ée]nements?|mairies?|quartiers?|jeunes|jeunesse|mjc|collectivités?|festivals?|ateliers?'),
    pour_le_montage: ['Les visages et l’énergie du moment, avec le consentement de chacun.', 'Le nom du lieu, la date, les partenaires (logos) à la fin.', 'Un message clair : à quoi ça sert, comment venir.']},
  autre: {nom: 'Autre', exemples: '', type_video: 'libre', mots: /$^/, pour_le_montage: []},
};

const maintenant = () => new Date().toISOString();
/** Une marque vide : ce qu'on sait d'un client (ou de soi) pour l'habiller juste. */
export const marqueVide = () => ({ton: '', public: '', interdits: '', mentions: '', couleurs: [], polices: [], logo: null, site: '', notes: ''});
const base = () => ({v: 1, dernier: 'moi', espaces: [
  {id: 'moi', nom: 'Moi', type: 'moi', cree_le: maintenant(), metier: null, marque: marqueVide(), apprendre: true},
  {id: 'neutre', nom: 'Personne', type: 'neutre', cree_le: maintenant(), metier: null, marque: marqueVide(), apprendre: false},
]});

const texte = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const long = (v, n) => String(v ?? '').replace(/\r/g, '').trim().slice(0, n);
const couleur = (c) => (/^#[0-9a-f]{6}$/i.test(String(c ?? '').trim()) ? String(c).trim().toUpperCase() : null);

/** Nettoie une marque reçue (de l'interface ou de l'IA) : rien d'autre que ces champs, bornés. */
export function nettoyerMarque(m = {}, avant = marqueVide()) {
  const r = {...marqueVide(), ...avant};
  for (const k of ['ton', 'public', 'site']) if (k in m) r[k] = texte(m[k], 300);
  for (const k of ['interdits', 'mentions', 'notes']) if (k in m) r[k] = long(m[k], 1200);
  if ('couleurs' in m) r.couleurs = (Array.isArray(m.couleurs) ? m.couleurs : String(m.couleurs ?? '').split(/[\s,;]+/)).map(couleur).filter(Boolean).slice(0, 6);
  if ('polices' in m) r.polices = (Array.isArray(m.polices) ? m.polices : String(m.polices ?? '').split(/[,;]+/)).map((p) => texte(p, 60)).filter(Boolean).slice(0, 4);
  return r;
}
/** Nettoie un métier : {type, precision, confirme}. */
function nettoyerMetier(m) {
  if (!m || typeof m !== 'object' || !METIERS[m.type]) return null;
  return {type: m.type, precision: texte(m.precision, 120), confirme: m.confirme !== false};
}

/** La liste des espaces, toujours avec « Moi » et « Personne ». */
export function lireEspaces() {
  let d = null;
  try { d = JSON.parse(fs.readFileSync(FICHIER, 'utf8')); } catch { /* pas encore créée */ }
  if (!d || !Array.isArray(d.espaces)) d = base();
  for (const e of base().espaces) if (!d.espaces.some((x) => x.id === e.id)) d.espaces.push(e);
  for (const e of d.espaces) {
    const logo = e.marque?.logo;
    e.marque = {...nettoyerMarque(e.marque ?? {}), logo: typeof logo === 'string' && /^logo\.(png|jpe?g|webp|svg)$/i.test(logo) ? logo : null};
    e.metier = nettoyerMetier(e.metier);
  }
  if (!d.espaces.some((e) => e.id === d.dernier)) d.dernier = 'moi';
  return d;
}
function ecrire(d) {
  fs.mkdirSync(DOSSIER_ESPACES, {recursive: true});
  const tmp = `${FICHIER}.part`;
  fs.writeFileSync(tmp, JSON.stringify(d, null, 1));
  fs.renameSync(tmp, FICHIER);
}

export const trouverEspace = (id) => lireEspaces().espaces.find((e) => e.id === id) ?? null;
/** L'espace d'un projet : celui qu'il porte, « Moi » pour un projet d'avant les espaces, « Personne » si le sien a été supprimé. */
export function espaceDuProjet(P) {
  const id = P?.d?.espace;
  if (!id) return trouverEspace('moi');
  return trouverEspace(id) ?? trouverEspace('neutre');
}
/** Cet espace apprend-il (carnet, fiches, chiffres) ? « Personne » jamais ; un autre, sauf si on l'a coupé. */
export const apprend = (e) => !!e && e.type !== 'neutre' && e.apprendre !== false;

/** Le dossier d'un espace (créé au besoin). */
export function dossierEspace(id) {
  if (!/^[a-z0-9-]{2,40}$/.test(String(id))) throw new Error('Espace inconnu.');
  const d = path.join(DOSSIER_ESPACES, id);
  fs.mkdirSync(d, {recursive: true});
  return d;
}

/** Un nouveau client. */
export function creerClient({nom, metier = null, marque = {}} = {}) {
  const n = texte(nom, 60);
  if (!n) throw new Error('Donne un nom au client.');
  const d = lireEspaces();
  if (d.espaces.some((e) => e.nom.toLowerCase() === n.toLowerCase())) throw new Error(`« ${n} » existe déjà.`);
  const racine = n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'client';
  const id = `${racine}-${crypto.randomBytes(2).toString('hex')}`;
  const e = {id, nom: n, type: 'client', cree_le: maintenant(), metier: nettoyerMetier(metier), marque: nettoyerMarque(marque), apprendre: true};
  d.espaces.push(e);
  ecrire(d);
  return e;
}

/** Change le nom, le métier, la marque ou l'apprentissage d'un espace. « Personne » ne se change pas. */
export function changerEspace(id, champs = {}) {
  const d = lireEspaces();
  const e = d.espaces.find((x) => x.id === id);
  if (!e) throw new Error('Espace inconnu.');
  if (e.type === 'neutre') throw new Error('« Personne » ne se règle pas : il ne reçoit et n’apprend rien.');
  if ('nom' in champs && e.type === 'client') {
    const n = texte(champs.nom, 60);
    // comme à la création : jamais deux espaces du même nom dans « Pour qui ? » (ni un client « Moi » ou « Personne »)
    if (n && d.espaces.some((x) => x.id !== id && x.nom.toLowerCase() === n.toLowerCase())) throw new Error(`« ${n} » existe déjà.`);
    if (n) e.nom = n;
  }
  if ('metier' in champs) e.metier = nettoyerMetier(champs.metier);
  if ('marque' in champs) e.marque = {...nettoyerMarque(champs.marque, e.marque), logo: e.marque.logo};
  if ('apprendre' in champs) e.apprendre = !!champs.apprendre;
  ecrire(d);
  return e;
}

/** Retire un client de la liste ; son dossier part dans espaces/.retires/ (rien n'est effacé). Ses projets passent à « Personne ». */
export function retirerEspace(id) {
  const d = lireEspaces();
  const e = d.espaces.find((x) => x.id === id);
  if (!e) throw new Error('Espace inconnu.');
  if (e.type !== 'client') throw new Error('Seul un client peut être retiré.');
  d.espaces = d.espaces.filter((x) => x.id !== id);
  if (d.dernier === id) d.dernier = 'moi';
  ecrire(d);
  const src = path.join(DOSSIER_ESPACES, id);
  if (fs.existsSync(src)) {
    const dst = path.join(DOSSIER_ESPACES, '.retires', `${id}-${maintenant().slice(0, 10)}`);
    fs.mkdirSync(path.dirname(dst), {recursive: true});
    try { fs.renameSync(src, dst); } catch { /* dossier occupé : il reste là */ }
  }
  return true;
}

/** Retient le dernier espace choisi (proposé au projet suivant). */
export function noterDernier(id) {
  const d = lireEspaces();
  if (d.espaces.some((e) => e.id === id) && d.dernier !== id) { d.dernier = id; ecrire(d); }
}

const EXT_LOGO = /\.(png|jpe?g|webp|svg)$/i;
/** Range le logo d'un espace (une copie : l'original ne bouge pas). */
export function poserLogo(id, source) {
  if (!EXT_LOGO.test(String(source))) throw new Error('Le logo doit être une image (PNG, JPEG, WebP ou SVG).');
  let st;
  try { st = fs.statSync(source); } catch { throw new Error('Ce logo est introuvable.'); }
  if (!st.isFile()) throw new Error('Choisis un fichier image, pas un dossier.');
  if (st.size > 20 * 1024 * 1024) throw new Error('Ce logo est trop lourd (20 Mo au plus).');
  const d = lireEspaces();
  const e = d.espaces.find((x) => x.id === id);
  if (!e || e.type === 'neutre') throw new Error('Espace inconnu.');
  const dossier = path.join(dossierEspace(id), 'marque');
  fs.mkdirSync(dossier, {recursive: true});
  const nom = `logo${path.extname(source).toLowerCase()}`;
  // le nouveau d'abord, à côté ; l'ancien n'est retiré qu'une fois la copie réussie (une copie ratée ne laisse pas l'espace sans logo)
  const neuf = path.join(dossier, '.nouveau-logo');
  try { fs.copyFileSync(source, neuf); } catch { fs.rmSync(neuf, {force: true}); throw new Error('Ce logo n’a pas pu être copié (fichier illisible, ou pas encore téléchargé sur cet ordinateur).'); }
  for (const f of fs.readdirSync(dossier)) if (/^logo\./.test(f)) fs.rmSync(path.join(dossier, f), {force: true});
  fs.renameSync(neuf, path.join(dossier, nom));
  e.marque.logo = nom;
  ecrire(d);
  return e;
}
export const cheminLogo = (e) => (e?.marque?.logo ? path.join(DOSSIER_ESPACES, e.id, 'marque', e.marque.logo) : null);

/**
 * Le métier que Dérush devine : d'après la niche du profil (lu sur les comptes) et les titres des projets de l'espace.
 * Renvoie {type, nom, pourquoi} ou null. La personne le confirme toujours.
 */
export function devinerMetier({niche = '', titres = []} = {}) {
  const sources = [String(niche), ...titres.map(String)].filter(Boolean);
  if (!sources.length) return null;
  let mieux = null;
  for (const [type, m] of Object.entries(METIERS)) {
    if (type === 'autre') continue;
    const n = sources.filter((s) => m.mots.test(s)).length + (m.mots.test(niche) ? 2 : 0);
    // la niche suffit ; sinon il faut deux titres qui le disent (un seul mot dans un seul titre ne fait pas un métier)
    if (n >= 2 && (!mieux || n > mieux.n)) mieux = {type, n};
  }
  return mieux ? {type: mieux.type, nom: METIERS[mieux.type].nom, pourquoi: niche && METIERS[mieux.type].mots.test(niche) ? `d’après ta niche : ${texte(niche, 80)}` : 'd’après les titres de tes projets'} : null;
}

/** ESPACE.md : ce que l'IA doit savoir de l'espace du projet (pour qui, métier, marque). */
export function espaceEnTexte(e) {
  if (!e || e.type === 'neutre') return null;
  const L = [];
  const m = e.metier ? METIERS[e.metier.type] : null;
  if (e.type === 'moi') L.push('# Pour qui : la personne elle-même', '', 'Ce projet est pour la personne qui utilise Dérush : son profil (contexte/createur/), son carnet (CARNET.md) et ce qui marche sur ses comptes (contexte/espace/recette.md, s’il est là) s’appliquent.', '');
  else L.push(`# Pour qui : ${e.nom} (un client)`, '', `Ce projet est fait POUR ${e.nom}, pas pour la personne qui monte. Son univers à elle (ses thèmes, son style, ses accroches) ne s’applique pas ici : tu suis la marque de ${e.nom}, ci-dessous, et son carnet.`, '');
  if (m) {
    L.push(`## Métier : ${m.nom}${e.metier.precision ? ` — ${e.metier.precision}` : ''}`, '');
    if (m.pour_le_montage.length) L.push('Ce qui compte au montage pour ce métier :', ...m.pour_le_montage.map((x) => `- ${x}`), '');
  }
  const k = e.marque ?? marqueVide();
  const lignes = [['Ton', k.ton], ['Public', k.public], ['Site', k.site]].filter(([, v]) => v);
  if (lignes.length || k.couleurs.length || k.polices.length || k.logo || k.interdits || k.mentions || k.notes) {
    L.push(e.type === 'moi' ? '## Son identité' : '## La marque', '');
    for (const [a, b] of lignes) L.push(`- **${a}** : ${b}`);
    if (k.couleurs.length) L.push(`- **Couleurs** : ${k.couleurs.join(', ')} (la première est la couleur principale)`);
    if (k.polices.length) L.push(`- **Polices** : ${k.polices.join(', ')}`);
    if (k.logo) L.push(`- **Logo** : contexte/espace/${k.logo} (à poser là où la charte le demande, sinon sur le carton de fin)`);
    if (k.interdits) L.push('', '**À ne jamais faire** :', k.interdits);
    if (k.mentions) L.push('', '**Mentions obligatoires** :', k.mentions);
    if (k.notes) L.push('', k.notes);
    L.push('');
  }
  return `${L.join('\n').trimEnd()}\n`;
}

/**
 * Pose l'espace du projet dans le dossier de travail de l'IA : contexte/espace/ESPACE.md et le logo. Pour « Personne »,
 * le dossier est retiré. Renvoie l'espace posé (ou null).
 */
export function installerEspace(dossier, e) {
  const D = path.join(dossier, 'contexte', 'espace');
  fs.rmSync(D, {recursive: true, force: true});
  const t = espaceEnTexte(e);
  if (!t) return null;
  fs.mkdirSync(D, {recursive: true});
  fs.writeFileSync(path.join(D, 'ESPACE.md'), t);
  const logo = cheminLogo(e);
  if (logo && fs.existsSync(logo)) { try { fs.copyFileSync(logo, path.join(D, e.marque.logo)); } catch { /* le logo reste chez Dérush */ } }
  return e;
}

/** La consigne qui va avec, redite à l'IA à chaque demande. */
export function consigneEspace(e) {
  if (!e || e.type === 'neutre') return '- Ce projet n’est rattaché à personne : n’utilise aucun profil, aucun carnet ni aucun style habituel. Monte d’après la demande et les rushes seulement, et n’écris rien dans carnet-ia.md.';
  if (e.type === 'client') return `- Ce projet est pour ${e.nom}, un client : lis contexte/espace/ESPACE.md (sa marque, son métier). N’y mets rien de l’univers personnel de la personne qui monte (ses thèmes, son style, ses accroches habituelles) : seulement ce que demandent ${e.nom}, sa marque et les rushes.`;
  return '- Ce projet est pour la personne elle-même : contexte/espace/ESPACE.md dit son métier et son identité.';
}
