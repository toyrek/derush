// Dérush — plusieurs vidéos dans un même projet (les « vidéos de la timeline », ou séquences).
//
// La vidéo ouverte vit là où elle a toujours vécu : P.d.montage, P.d.superpositions, P.d.indications et P.d.sortie.
// Tout le reste de Dérush (l'interface, le pack, « Créer la vidéo », l'IA) la lit là, sans rien savoir des autres.
// Les autres vidéos sont rangées dans P.d.sequences, avec leur contenu ; P.d.sequence est l'id de la vidéo ouverte, dont
// l'entrée de la liste ne porte que le nom. Changer de vidéo = ranger la vidéo ouverte dans son entrée, poser l'autre à
// sa place, enregistrer. Les médias, le brief, le style et la conversation avec l'IA restent communs au projet.
//
// Une vidéo livrée par l'IA (10 TikToks d'un coup, par exemple) peut devenir une vidéo du projet : plan par plan quand
// l'IA a dit ses passages (« coupes » de livraison.json, découpe de recouper.mjs, ou blocs « plan » de sa table de
// montage avec leur passage du rush), sinon comme un seul plan : le fichier livré lui-même.
import fs from 'node:fs';
import path from 'node:path';
import {CHAMPS_SEQUENCE, CADENCES, FORMATS, formatProche, nouvelId, sequence as placer, surGrille, fpsSource, arrondi} from './commun.mjs';
import {ecrireJson, lireJson, tailleLisible} from './outils.mjs';
import {creerVideo} from './rendu.mjs';
import {verifierPlace} from './disque.mjs';

/** Une erreur à dire à la personne, avec le statut HTTP que les routes rendront. */
const refus = (statut, texte) => Object.assign(new Error(texte), {statut});
const liste = (x) => (Array.isArray(x) ? x : []);
const num = (v) => (v == null || v === '' ? NaN : Number(v));
const texteCourt = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

// ——— Les vidéos du projet ———

/** L'entrée d'une vidéo du projet, ou une erreur 404. */
function trouver(P, id) {
  const s = P.d.sequences.find((x) => x.id === id);
  if (!s) throw refus(404, 'Cette vidéo n’existe plus dans le projet.');
  return s;
}

/** Le contenu d'une vidéo : celui de la timeline pour la vidéo ouverte, celui de son entrée pour les autres. */
function contenu(P, s) {
  const d = P.d;
  const src = s.id === d.sequence ? d : s;
  return {montage: liste(src.montage), superpositions: liste(src.superpositions), indications: liste(src.indications), sortie: src.sortie ?? d.sortie};
}

/** Range la vidéo ouverte dans son entrée de la liste (avant d'en poser une autre). */
function rangerOuverte(P) {
  const d = P.d;
  const s = d.sequences.find((x) => x.id === d.sequence);
  if (!s) return;
  for (const k of CHAMPS_SEQUENCE) s[k] = d[k];
}

/** Pose une vidéo rangée dans la timeline : son contenu quitte son entrée, qui ne garde que son nom. */
function poser(P, s) {
  const d = P.d;
  for (const k of CHAMPS_SEQUENCE) {
    d[k] = s[k] ?? (k === 'sortie' ? {...d.sortie} : []);
    delete s[k];
  }
  d.sequence = s.id;
}

/** Un nom libre pour une nouvelle vidéo : « Vidéo 3 », ou le premier numéro qui n'est pas déjà pris. */
function nomLibre(P) {
  const pris = new Set(P.d.sequences.map((s) => s.nom));
  let n = P.d.sequences.length + 1;
  while (pris.has(`Vidéo ${n}`)) n++;
  return `Vidéo ${n}`;
}

/** Les médias utilisés par une vidéo du projet ou une autre (un rush n'est retiré que s'il ne sert plus nulle part). */
export function mediasUtilises(P) {
  const ids = new Set();
  for (const s of P.d.sequences) {
    const c = contenu(P, s);
    for (const it of [...c.montage, ...c.superpositions]) if (it?.media) ids.add(it.media);
  }
  return ids;
}

/** Ce que l'interface montre de chaque vidéo : nom, rang, nombre de plans, durée, format, origine. */
export function listerSequences(P) {
  const d = P.d;
  return d.sequences.map((s, k) => {
    const c = contenu(P, s);
    let duree = 0;
    try { duree = placer({...d, montage: c.montage, sortie: c.sortie}).duree; } catch { /* vidéo vide */ }
    return {
      id: s.id, nom: s.nom, numero: k + 1, ouverte: s.id === d.sequence,
      plans: c.montage.filter((it) => it.type === 'plan').length, cases: c.montage.filter((it) => it.type === 'bloc').length,
      par_dessus: c.superpositions.length, effets: c.indications.length, duree_s: arrondi(duree, 3), vide: !c.montage.length,
      format: {preset: c.sortie.preset, largeur: c.sortie.largeur, hauteur: c.sortie.hauteur, fps: c.sortie.fps},
      ...(s.origine ? {origine: s.origine} : {}), ...(s.cree_le ? {cree_le: s.cree_le} : {}),
    };
  });
}

/** Ouvre une autre vidéo du projet : la vidéo ouverte est rangée telle quelle, l'autre prend sa place. */
export function activerSequence(P, id) {
  const s = trouver(P, id);
  if (s.id === P.d.sequence) return s;
  rangerOuverte(P);
  poser(P, s);
  P.sauver();
  return s;
}

/**
 * Une copie du contenu d'une vidéo, avec des ids neufs (les ids sont uniques dans tout le projet : un effet, une
 * proposition de l'IA ou un fichier de référence ne vise jamais deux vidéos à la fois). Les effets suivent les plans
 * copiés, et les fichiers donnés pour une case à créer suivent la case.
 */
function copierContenu(P, c) {
  const d = P.d;
  const nouveaux = new Map();
  const montage = c.montage.map((it) => {
    const id = nouvelId(d, it.type === 'bloc' ? 'B' : 'P');
    nouveaux.set(it.id, id);
    return {...structuredClone(it), id};
  });
  const indications = c.indications.map((i) => {
    const x = structuredClone(i);
    x.id = nouvelId(d, 'I');
    if (x.ancre?.id) x.ancre.id = nouveaux.get(x.ancre.id) ?? x.ancre.id;
    return x;
  });
  const superpositions = c.superpositions.map((x) => ({...structuredClone(x), id: nouvelId(d, 'S')}));
  for (const r of [...liste(d.references)]) {
    if (r.cible && nouveaux.has(r.cible)) d.references.push({...structuredClone(r), id: nouvelId(d, 'R'), cible: nouveaux.get(r.cible)});
  }
  return {montage, indications, superpositions, sortie: {...c.sortie}};
}

/**
 * Ajoute une vidéo au projet : vide (au format de la vidéo ouverte), ou la copie d'une autre (`copier` : true pour la
 * vidéo ouverte, ou l'id d'une vidéo). Elle s'ouvre tout de suite, sauf `ouvrir: false`. Renvoie son entrée.
 */
export function ajouterSequence(P, {nom = '', copier = false, ouvrir = true} = {}) {
  const d = P.d;
  const source = copier === true ? trouver(P, d.sequence) : typeof copier === 'string' && copier ? trouver(P, copier) : null;
  const neuve = {id: nouvelId(d, 'V'), nom: P.nomPropre(nom) || (source ? `${source.nom} (copie)`.slice(0, 80) : nomLibre(P)), cree_le: new Date().toISOString()};
  Object.assign(neuve, source ? copierContenu(P, contenu(P, source)) : {montage: [], superpositions: [], indications: [], sortie: {...d.sortie}});
  // une copie se range juste après son original ; une vidéo vide, à la fin
  const k = source ? d.sequences.indexOf(source) + 1 : d.sequences.length;
  d.sequences.splice(k, 0, neuve);
  if (ouvrir) {
    rangerOuverte(P);
    poser(P, neuve);
  }
  P.sauver();
  return neuve;
}

/** Renomme une vidéo du projet. */
export function renommerSequence(P, id, nom) {
  const s = trouver(P, id);
  const propre = P.nomPropre(nom);
  if (!propre) throw refus(400, 'Donne un nom à cette vidéo.');
  s.nom = propre;
  P.sauver();
  return s;
}

/** Change l'ordre des vidéos : les ids donnés d'abord, dans cet ordre ; celles qui manquent gardent le leur, à la suite. */
export function ordonnerSequences(P, ids) {
  if (!Array.isArray(ids)) throw refus(400, 'L’ordre des vidéos doit être une liste.');
  const d = P.d;
  const parId = new Map(d.sequences.map((s) => [s.id, s]));
  const neuf = [];
  for (const id of ids) { const s = parId.get(id); if (s && !neuf.includes(s)) neuf.push(s); }
  for (const s of d.sequences) if (!neuf.includes(s)) neuf.push(s);
  d.sequences = neuf;
  P.sauver();
  return neuf;
}

/**
 * Supprime une vidéo du projet (jamais la dernière). Si c'était la vidéo ouverte, sa voisine s'ouvre (la suivante,
 * sinon la précédente). Son contenu est gardé à part dans .derush/videos-supprimees/ (les 20 dernières), au cas où :
 * les médias, eux, restent dans le projet.
 */
export function supprimerSequence(P, id) {
  const d = P.d;
  const s = trouver(P, id);
  if (d.sequences.length <= 1) throw refus(400, 'C’est la seule vidéo du projet : elle ne peut pas être supprimée.');
  const k = d.sequences.indexOf(s);
  try {
    const dir = path.join(P.cache, 'videos-supprimees');
    fs.mkdirSync(dir, {recursive: true});
    ecrireJson(path.join(dir, `${s.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), {id: s.id, nom: s.nom, ...structuredClone(contenu(P, s)), supprimee_le: new Date().toISOString()}, 2);
    const vieilles = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort((a, b) => fs.statSync(path.join(dir, a)).mtimeMs - fs.statSync(path.join(dir, b)).mtimeMs);
    for (const f of vieilles.slice(0, Math.max(0, vieilles.length - 20))) fs.rmSync(path.join(dir, f), {force: true});
  } catch { /* la copie de sécurité n'est qu'un plus */ }
  if (s.id === d.sequence) poser(P, d.sequences[k + 1] ?? d.sequences[k - 1]);
  d.sequences.splice(d.sequences.indexOf(s), 1);
  P.sauver();
  return d.sequences.find((x) => x.id === d.sequence);
}

/**
 * Le projet figé, avec la vidéo `id` posée à la place de la vidéo ouverte (une copie : le projet n'est pas touché).
 * C'est ce que reçoivent le pack et « Créer la vidéo » pour une vidéo qui n'est pas ouverte, au moment du clic.
 */
export function donneesSequence(P, id) {
  const s = trouver(P, id);
  const copie = structuredClone(P.d);
  if (s.id !== P.d.sequence) {
    const rangee = copie.sequences.find((x) => x.id === s.id);
    for (const k of CHAMPS_SEQUENCE) copie[k] = rangee[k] ?? (k === 'sortie' ? copie.sortie : []);
    copie.sequence = s.id;
  }
  return copie;
}

// ——— Créer toutes les vidéos d'un coup ———

/**
 * La place que prendra une vidéo rendue (H.264 à --crf=16, son à 256 kb/s) : une estimation, à l'image près du réel
 * pour des rushes de téléphone ; un plan très détaillé (feuillage, grain) pèse plus.
 */
const estimerTaille = (v) => Math.round(((v.format.largeur * v.format.hauteur * v.format.fps * 0.12 + 256e3) / 8) * v.duree_s);

/**
 * Ce que « Créer toutes les vidéos » va faire, pour le montrer avant : les vidéos à créer (celles qui ont au moins un
 * plan), celles qui sont vides (rien à créer), la durée totale, la place estimée et la place libre.
 */
export function planDuRendu(P, ids = null) {
  const toutes = listerSequences(P);
  const voulues = Array.isArray(ids) && ids.length ? ids.map((id) => toutes.find((x) => x.id === id)).filter(Boolean) : toutes;
  const aRendre = voulues.filter((x) => !x.vide);
  const octets = aRendre.reduce((t, x) => t + estimerTaille(x), 0);
  const place = verifierPlace(P.racine);
  return {
    videos: voulues.map((x) => ({id: x.id, nom: x.nom, numero: x.numero, vide: x.vide, duree_s: x.duree_s, format: x.format, taille_estimee: x.vide ? 0 : estimerTaille(x)})),
    a_rendre: aRendre.length, vides: voulues.filter((x) => x.vide).map((x) => x.nom),
    duree_s: arrondi(aRendre.reduce((t, x) => t + x.duree_s, 0), 2), taille_estimee: octets, taille_lisible: `environ ${tailleLisible(octets)}`,
    place: {ok: place.ok, texte: place.texte, libre: place.libre, libre_lisible: place.libre == null ? null : tailleLisible(place.libre)},
  };
}

/**
 * « Créer toutes les vidéos » : une tâche « Créer la vidéo » par vidéo qui a des plans, dans l'ordre du projet, chacune
 * figée au moment du clic (on peut continuer à monter pendant que la file avance). Renvoie les tâches et le plan.
 */
export function rendreSequences(P, file, {ids = null, plateforme = null, rendre = creerVideo} = {}) {
  const plan = planDuRendu(P, ids);
  if (!plan.a_rendre) throw refus(400, 'Aucune de ces vidéos n’a de plan : il n’y a rien à créer.');
  if (!plan.place.ok) throw refus(507, plan.place.texte);
  const taches = [];
  for (const v of plan.videos.filter((x) => !x.vide)) {
    const donnees = donneesSequence(P, v.id);
    const t = file.ajouter(`Création de la vidéo · ${v.nom}`, (prog) => rendre(P, {plateforme, donnees}, prog), {type: 'rendu', sequence: v.id});
    taches.push({tache: t.id, sequence: v.id, nom: v.nom});
  }
  return {taches, plan};
}

// ——— Une vidéo livrée par l'IA, devenue une vidéo du projet ———

/** L'état de la conversation avec l'IA (claude/etat.json, écrit par lib/claude.mjs) : seulement ses versions livrées. */
function versionsIA(P) {
  const e = lireJson(path.join(P.racine, 'claude', 'etat.json'));
  return {atelier: typeof e?.atelier === 'string' ? e.atelier : null, versions: liste(e?.versions).filter((v) => Number.isInteger(v?.n))};
}
/** Les vidéos d'une version (les anciennes versions n'en avaient qu'une). */
const videosDe = (v) => (v.videos?.length ? v.videos : v.nom ? [{nom: v.nom, titre: null, duree: v.duree, largeur: v.largeur, hauteur: v.hauteur}] : []);

/**
 * Les plans d'origine du pack (montage.origine.json, que recouper.mjs met de côté, sinon montage.json), par id : pour
 * savoir quel rush et quel passage désigne un « P3 » ou une case « B1 » que l'IA cite.
 */
function plansDuPack(atelier) {
  const M = lireJson(path.join(atelier, 'montage.origine.json')) ?? lireJson(path.join(atelier, 'montage.json'));
  return new Map(liste(M?.montage).filter((it) => it && typeof it === 'object' && it.id != null).map((it) => [String(it.id), it]));
}

/**
 * Les passages d'une vidéo livrée, tels que l'IA les a écrits (« coupes » de livraison.json : le format de coupes.json
 * pour recouper.mjs, [{plan, de, a, titre}, {case}]), traduits en passages de Dérush : [{type: 'plan', media, entree,
 * sortie, titre}] ou [{type: 'bloc', genre, duree, titre, consigne}]. Ce que l'IA a écrit n'est pas sûr : un passage
 * illisible, ou d'un rush inconnu du projet, est laissé de côté. Appelé à la livraison (lib/claude.mjs), quand le
 * dossier de travail est encore celui de cette vidéo.
 */
export function coupesLivrees(atelier, brutes, P) {
  if (!Array.isArray(brutes) || !brutes.length) return [];
  const parId = plansDuPack(atelier);
  const medias = new Map(P.d.medias.map((m) => [m.id, m]));
  const res = [];
  for (const c of brutes.slice(0, 300)) {
    if (!c || typeof c !== 'object') continue;
    const titre = texteCourt(c.titre, 200);
    if (c.case != null) {
      const o = parId.get(String(c.case));
      const duree = num(o?.duree?.s);
      if (o?.type === 'bloc' && duree > 0) res.push({type: 'bloc', genre: String(o.genre ?? 'autre'), duree, titre: titre || texteCourt(o.titre, 200), consigne: texteCourt(o.consigne, 4000)});
      continue;
    }
    const cle = String(c.plan ?? c.source ?? c.rush ?? '');
    const o = parId.get(cle);
    const id = medias.has(cle) ? cle : o?.type === 'plan' ? o.source?.id : null;
    const m = medias.get(id);
    if (!m) continue;
    const doPlan = o?.type === 'plan' && o.source?.id === id ? o : null;
    let de = num(c.de);
    let a = num(c.a);
    if (!Number.isFinite(de)) de = doPlan ? num(doPlan.source.entree?.s) : 0;
    if (!Number.isFinite(a)) a = doPlan ? (m.type === 'image' ? de + num(doPlan.duree?.s) : num(doPlan.source.sortie?.s)) : m.type === 'image' ? de + 3 : num(m.duree);
    // une photo : seule la durée compte
    if (m.type === 'image') { a -= de; de = 0; }
    if (Number.isFinite(de) && Number.isFinite(a) && a > de) res.push({type: 'plan', media: id, entree: arrondi(Math.max(0, de)), sortie: arrondi(a), titre});
  }
  return res;
}

/**
 * La découpe d'un dossier de travail que l'IA a recoupé (recouper.mjs : montage.json dit « decoupe: "ia" »), dans le
 * même format que coupesLivrees. Pour une vidéo seule, livrée dans rendu/final.mp4 : c'est le montage du kit.
 */
export function decoupeDuDossier(atelier, P) {
  const M = lireJson(path.join(atelier, 'montage.json'));
  if (!M || M.decoupe !== 'ia' || !Array.isArray(M.montage)) return [];
  const medias = new Map(P.d.medias.map((m) => [m.id, m]));
  const res = [];
  for (const it of M.montage.slice(0, 300)) {
    if (it?.type === 'bloc') {
      const duree = num(it.duree?.s);
      if (duree > 0) res.push({type: 'bloc', genre: String(it.genre ?? 'autre'), duree, titre: texteCourt(it.titre, 200), consigne: texteCourt(it.consigne, 4000)});
      continue;
    }
    const m = it?.type === 'plan' ? medias.get(it.source?.id) : null;
    if (!m) continue;
    const image = it.source.type === 'image' || m.type === 'image';
    const de = image ? 0 : num(it.source.entree?.s);
    const a = image ? num(it.duree?.s) : num(it.source.sortie?.s);
    if (Number.isFinite(de) && Number.isFinite(a) && a > de) res.push({type: 'plan', media: m.id, entree: arrondi(de), sortie: arrondi(a), titre: texteCourt(it.titre, 200)});
  }
  return res;
}

/** Des passages déjà traduits (rangés avec la version), revérifiés : un rush retiré du projet depuis ne compte plus. */
function passagesPropres(P, passages) {
  const medias = new Map(P.d.medias.map((m) => [m.id, m]));
  return liste(passages).filter((c) => (c?.type === 'bloc' ? num(c.duree) > 0 : c?.type === 'plan' && medias.has(c.media) && num(c.sortie) > num(c.entree)));
}

/**
 * Ce que la table de montage de l'IA (rendu/timeline.json, rangée avec la version) dit d'une vidéo : ses plans (blocs
 * « plan » avec le rush et son passage, « de » / « a » en secondes du rush), les plans qui en recouvrent un autre (posés
 * par-dessus), les sons d'un rush du projet (par-dessus aussi), et les textes à l'écran.
 */
function depuisTable(P, blocs) {
  const medias = new Map(P.d.medias.map((m) => [m.id, m]));
  const plans = [];
  const dessus = [];
  const textes = [];
  let fin = 0;
  for (const b of [...blocs].sort((x, y) => x.debut_s - y.debut_s)) {
    if (b.piste === 'plan' || b.piste === 'son') {
      const m = medias.get(b.source);
      const de = num(b.de);
      if (!m || !Number.isFinite(de) || !(b.duree_s > 0)) continue;
      const a = num(b.a) > de ? num(b.a) : de + b.duree_s;
      if (b.piste === 'plan' && m.type !== 'audio' && b.debut_s >= fin - 0.1) {
        plans.push({type: 'plan', media: m.id, entree: m.type === 'image' ? 0 : de, sortie: m.type === 'image' ? b.duree_s : a, titre: texteCourt(b.nom, 200)});
        fin = b.debut_s + b.duree_s;
      } else {
        dessus.push({media: m.id, entree: m.type === 'image' ? 0 : de, sortie: m.type === 'image' ? b.duree_s : a, debut: b.debut_s, titre: texteCourt(b.nom, 200), son: b.piste === 'son' || m.type === 'audio'});
      }
    } else if (b.piste === 'texte' && b.texte) {
      textes.push({texte: String(b.texte).slice(0, 200), debut: b.debut_s, fin: b.debut_s + b.duree_s});
    }
  }
  return {plans, dessus, textes};
}

/** Les blocs de la table de montage qui parlent de la vidéo k d'une version (tous, s'il n'y a qu'une vidéo). */
const blocsDe = (v, k) => liste(v.table?.blocs).filter((b) => b && (videosDe(v).length === 1 || b.video === k));

/**
 * Ce qu'une vidéo livrée peut donner dans la timeline : {mode: 'plans', plans, dessus, textes} quand l'IA a dit ses
 * passages, sinon {mode: 'fichier'}. `atelier` : le dossier de travail, seulement s'il est encore celui de cette
 * version (la dernière) — il est repris d'une demande à l'autre, et ne dit plus rien des versions d'avant.
 */
function contenuLivree(P, v, k, atelier = null) {
  const vid = videosDe(v)[k];
  const table = depuisTable(P, blocsDe(v, k));
  let plans = passagesPropres(P, vid?.coupes);
  // des passages donnés par l'IA : la table n'apporte plus que ce qui se pose par-dessus en son, et les textes
  let dessus = plans.length ? table.dessus.filter((x) => x.son) : table.dessus;
  if (!plans.length) plans = table.plans;
  if (!plans.length && atelier && videosDe(v).length === 1) { plans = decoupeDuDossier(atelier, P); dessus = table.dessus.filter((x) => x.son); }
  return plans.some((x) => x.type === 'plan') ? {mode: 'plans', plans, dessus, textes: table.textes} : {mode: 'fichier'};
}

/** La vidéo du projet déjà faite d'une vidéo livrée (même version, même rang), ou null. */
const dejaFaite = (P, n, k) => P.d.sequences.find((s) => s.origine?.version === n && s.origine?.video === k) ?? null;

/**
 * Pour l'écran de l'IA (etatDemande, lib/claude.mjs) : ce que deviendrait la vidéo k d'une version dans la timeline
 * (« plans » ou « fichier ») et la vidéo du projet qui en est déjà faite. Rien n'est lu sur le disque, sauf
 * `decoupeDossier` (le nombre de passages de la découpe de l'IA, déjà lu par l'appelant pour la dernière version).
 */
export function etatLivree(P, v, k, decoupeDossier = 0) {
  const vid = videosDe(v)[k];
  const medias = new Set(P.d.medias.map((m) => m.id));
  const plans = passagesPropres(P, vid?.coupes).some((c) => c.type === 'plan')
    || blocsDe(v, k).some((b) => b.piste === 'plan' && medias.has(b.source) && Number.isFinite(num(b.de)))
    || (videosDe(v).length === 1 && decoupeDossier > 0);
  const s = dejaFaite(P, v.n, k);
  return {timeline: plans ? 'plans' : 'fichier', dans_timeline: s ? {id: s.id, nom: s.nom} : null};
}

/** Le format d'une vidéo livrée, pour la vidéo du projet qui en est faite (sinon celui de la vidéo ouverte). */
function sortieDe(P, vid) {
  const r = {...P.d.sortie, auto: false};
  if (vid?.largeur > 0 && vid?.hauteur > 0) {
    const f = formatProche(vid.largeur, vid.hauteur);
    Object.assign(r, {preset: f, largeur: FORMATS[f].largeur, hauteur: FORMATS[f].hauteur});
  }
  const fps = CADENCES.find((c) => Math.abs(c - num(vid?.fps)) < 0.6);
  if (fps) r.fps = fps;
  return r;
}

const SON_PLAN = () => ({actif: true, gain_db: 0, version: 'original', avant_s: 0, apres_s: 0});

/**
 * Fait d'une vidéo livrée par l'IA (la vidéo `video` de la version `version`) une vidéo du projet, à retoucher :
 * plan par plan quand c'est possible (voir contenuLivree), sinon le fichier livré, importé comme un média (`importer`,
 * ajouterMedia de lib/medias.mjs dans les routes) et posé comme un seul plan. Une vidéo déjà faite n'est pas refaite,
 * sauf `encore`. Elle s'ouvre, sauf `ouvrir: false`. Renvoie {sequence, mode, deja}.
 */
export async function videoLivreeVersSequence(P, {version, video = 0, ouvrir = true, encore = false, remplir = ouvrir} = {}, {importer} = {}) {
  const {atelier, versions} = versionsIA(P);
  const v = versions.find((x) => x.n === Number(version));
  if (!v) throw refus(404, 'Cette version de l’IA n’existe plus.');
  const vids = videosDe(v);
  const k = Number(video ?? 0);
  const vid = Number.isInteger(k) ? vids[k] : null;
  if (!vid) throw refus(404, 'Cette vidéo de l’IA n’existe plus.');
  const deja = dejaFaite(P, v.n, k);
  if (deja && !encore) {
    if (ouvrir) activerSequence(P, deja.id);
    return {sequence: deja, mode: deja.origine?.mode ?? 'fichier', deja: true};
  }
  const derniere = Math.max(...versions.map((x) => x.n));
  const dossier = v.n === derniere ? (v.atelier ?? atelier) : null;
  const atelierV = dossier && fs.existsSync(path.join(P.racine, dossier, 'montage.json')) ? path.join(P.racine, dossier) : null;
  const c = contenuLivree(P, v, k, atelierV);
  const d = P.d;
  const sortie = sortieDe(P, vid);
  let montage = [];
  let superpositions = [];
  let indications = [];
  if (c.mode === 'plans') {
    const media = (id) => d.medias.find((m) => m.id === id);
    montage = c.plans.map((x) => (x.type === 'bloc'
      ? {id: nouvelId(d, 'B'), type: 'bloc', genre: x.genre, duree: x.duree, titre: x.titre, consigne: x.consigne, references: ''}
      : {id: nouvelId(d, 'P'), type: 'plan', media: x.media, entree: surGrille(x.entree, fpsSource(media(x.media), {sortie})), sortie: surGrille(x.sortie, fpsSource(media(x.media), {sortie})),
        titre: x.titre, notes: '', tags: [], son: SON_PLAN()})).map((it) => P.nettoyerItem(it)).filter(Boolean);
    superpositions = c.dessus.map((x) => P.nettoyerSuperposition({id: nouvelId(d, 'S'), media: x.media, entree: x.entree, sortie: x.sortie, debut: x.debut, titre: x.titre, notes: '', cadre: 'plein', son: {...SON_PLAN(), actif: x.son}})).filter(Boolean);
    // les textes de l'IA deviennent des titres de Dérush : on les voit, on les retouche (le style de l'IA, lui, est dans sa vidéo)
    indications = c.textes.map((x) => P.nettoyerIndication({id: nouvelId(d, 'I'), genre: 'texte', debut: x.debut, fin: x.fin, consigne: '', modele: 'titre', reglages: {texte: x.texte}})).filter(Boolean);
  }
  let mode = c.mode;
  if (!montage.some((it) => it.type === 'plan')) {
    // le fichier livré lui-même, comme un seul plan
    mode = 'fichier';
    superpositions = [];
    indications = [];
    const nomSur = typeof vid.nom === 'string' && path.basename(vid.nom) === vid.nom && /\.mp4$/i.test(vid.nom);
    const chemin = nomSur ? path.join(P.racine, 'vidéos', vid.nom) : null;
    if (!chemin || !fs.existsSync(chemin)) throw refus(404, 'Cette vidéo n’est plus dans le dossier « vidéos » du projet.');
    if (typeof importer !== 'function') throw refus(500, 'Dérush ne sait pas importer cette vidéo ici.');
    const m = await importer(chemin);
    if (!m || !(num(m.duree) > 0)) throw refus(400, 'Dérush n’a pas pu lire la durée de cette vidéo.');
    montage = [P.nettoyerItem({id: nouvelId(d, 'P'), type: 'plan', media: m.id, entree: 0, sortie: m.duree, titre: vid.titre ?? '', notes: '', tags: [], son: SON_PLAN()})].filter(Boolean);
  }
  const nom = P.nomPropre(vid.titre) || `Version ${v.n} de l’IA${vids.length > 1 ? ` · ${k + 1}` : ''}`;
  const origine = P.nettoyerOrigine({version: v.n, video: k, fichier: vid.nom, moteur: v.moteur, mode});
  // un projet neuf (« fais-moi un vlog du vendredi ») : la vidéo ouverte est encore vide, sans origine, avec son nom par
  // défaut (« Vidéo 1 ») ; la vidéo de l'IA la remplit au lieu d'arriver à côté d'un onglet vide (et le dossier de
  // travail de l'IA, préparé pour elle, reste le sien)
  const ouverte = d.sequences.find((s) => s.id === d.sequence);
  if (remplir && ouverte && !ouverte.origine && /^Vidéo \d+$/.test(ouverte.nom ?? '') && !liste(d.montage).length && !liste(d.superpositions).length && !liste(d.indications).length) {
    Object.assign(ouverte, {nom, origine});
    Object.assign(d, {montage, superpositions, indications, sortie});
    P.sauver();
    return {sequence: ouverte, mode, deja: false};
  }
  const neuve = {id: nouvelId(d, 'V'), nom, cree_le: new Date().toISOString(), origine, montage, superpositions, indications, sortie};
  d.sequences.push(neuve);
  if (ouvrir) {
    rangerOuverte(P);
    poser(P, neuve);
  }
  P.sauver();
  return {sequence: neuve, mode, deja: false};
}

/**
 * Toutes les vidéos d'une version (ou celles de `videos`, leurs rangs) deviennent des vidéos du projet ; la première
 * créée s'ouvre. Renvoie la liste {sequence, mode, deja} et les erreurs (une vidéo introuvable n'arrête pas les autres).
 */
export async function videosLivreesVersSequences(P, {version, videos = null, ouvrir = true, encore = false} = {}, outils = {}) {
  const v = versionsIA(P).versions.find((x) => x.n === Number(version));
  if (!v) throw refus(404, 'Cette version de l’IA n’existe plus.');
  const rangs = Array.isArray(videos) ? videos.map(Number).filter((k) => Number.isInteger(k) && k >= 0) : videosDe(v).map((_, k) => k);
  const faites = [];
  const erreurs = [];
  for (const k of rangs) {
    // la première peut remplir une vidéo ouverte encore vide (un projet neuf) ; les autres arrivent à côté
    try { faites.push({video: k, ...(await videoLivreeVersSequence(P, {version: v.n, video: k, ouvrir: false, encore, remplir: ouvrir}, outils))}); } catch (e) { erreurs.push(`Vidéo ${k + 1} : ${e.message}`); }
  }
  if (ouvrir && faites.length) activerSequence(P, faites[0].sequence.id);
  return {faites, erreurs};
}

// ——— Les routes ———

/**
 * Les routes des vidéos du projet. Rend true si elle a répondu.
 *   GET    /api/sequences                     → {sequence, sequences}
 *   POST   /api/sequences {nom, copier, ouvrir} → ajoute (vide, ou copie : copier = true ou l'id d'une vidéo)
 *   POST   /api/sequences/activer {id}         → ouvre une autre vidéo
 *   PUT    /api/sequences/:id {nom}             → renomme
 *   POST   /api/sequences/ordre {ids}           → change l'ordre
 *   DELETE /api/sequences/:id                   → supprime (jamais la dernière)
 *   POST   /api/sequences/depuis-ia {version, video | videos, ouvrir, encore} → une ou des vidéos livrées par l'IA
 *   GET    /api/sequences/rendre?ids=V1,V2     → ce que « Créer toutes les vidéos » va faire (durée, place)
 *   POST   /api/sequences/rendre {ids, plateforme} → une tâche « Créer la vidéo » par vidéo qui a des plans
 * Tout ce qui change la vidéo ouverte rend aussi le projet entier ({projet}, comme /api/etat le donne).
 */
export async function routesSequences(req, res, p, url, ctx, {envoyerJson, lireCorps, ErreurHttp, projet}) {
  if (p !== '/api/sequences' && !p.startsWith('/api/sequences/')) return false;
  const P = projet();
  const etat = (extra = {}) => ({...extra, sequence: P.d.sequence, sequences: listerSequences(P)});
  const avecProjet = (extra = {}) => envoyerJson(res, 200, {...etat(extra), projet: P.d});
  const corps = async () => { const c = await lireCorps(req); return c && typeof c === 'object' ? c : {}; };
  const x = /^\/api\/sequences\/(V\d{1,9})$/.exec(p);
  try {
    if (req.method === 'GET' && p === '/api/sequences') { envoyerJson(res, 200, etat()); return true; }
    if (req.method === 'POST' && p === '/api/sequences') {
      const {nom = '', copier = false, ouvrir = true} = await corps();
      const s = ajouterSequence(P, {nom: String(nom ?? ''), copier: copier === true || (typeof copier === 'string' && copier) ? copier : false, ouvrir: ouvrir !== false});
      avecProjet({ajoutee: s.id});
      return true;
    }
    if (req.method === 'POST' && p === '/api/sequences/activer') {
      const {id} = await corps();
      activerSequence(P, String(id ?? ''));
      avecProjet();
      return true;
    }
    if (req.method === 'POST' && p === '/api/sequences/ordre') {
      const {ids} = await corps();
      ordonnerSequences(P, ids);
      envoyerJson(res, 200, etat());
      return true;
    }
    if (req.method === 'POST' && p === '/api/sequences/depuis-ia') {
      const {version, video, videos, ouvrir = true, encore = false} = await corps();
      const {ajouterMedia} = await import('./medias.mjs');
      const outils = {importer: (chemin) => ajouterMedia(P, chemin, ctx.file)};
      if (Array.isArray(videos) || video == null) {
        const r = await videosLivreesVersSequences(P, {version, videos: Array.isArray(videos) ? videos : null, ouvrir: ouvrir !== false, encore: encore === true}, outils);
        if (!r.faites.length) throw refus(400, r.erreurs[0] ?? 'Aucune vidéo à mettre dans la timeline.');
        avecProjet({faites: r.faites.map((f) => ({video: f.video, id: f.sequence.id, nom: f.sequence.nom, mode: f.mode, deja: f.deja})), erreurs: r.erreurs});
      } else {
        const r = await videoLivreeVersSequence(P, {version, video, ouvrir: ouvrir !== false, encore: encore === true}, outils);
        avecProjet({faites: [{video: Number(video), id: r.sequence.id, nom: r.sequence.nom, mode: r.mode, deja: r.deja}], erreurs: []});
      }
      return true;
    }
    if (req.method === 'GET' && p === '/api/sequences/rendre') {
      const ids = (url.searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      envoyerJson(res, 200, planDuRendu(P, ids.length ? ids : null));
      return true;
    }
    if (req.method === 'POST' && p === '/api/sequences/rendre') {
      const {ids = null, plateforme = null} = await corps();
      envoyerJson(res, 200, rendreSequences(P, ctx.file, {ids: Array.isArray(ids) ? ids.map(String) : null, plateforme: typeof plateforme === 'string' ? plateforme : null}));
      return true;
    }
    if (x && req.method === 'PUT') {
      const {nom} = await corps();
      renommerSequence(P, x[1], nom);
      envoyerJson(res, 200, etat());
      return true;
    }
    if (x && req.method === 'DELETE') {
      supprimerSequence(P, x[1]);
      avecProjet();
      return true;
    }
  } catch (e) {
    if (e instanceof ErreurHttp) throw e;
    if (Number.isInteger(e?.statut)) throw new ErreurHttp(e.statut, e.message);
    throw e;
  }
  throw new ErreurHttp(404, 'Route inconnue.');
}
