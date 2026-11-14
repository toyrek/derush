// Dérush — un projet = un dossier : derush.json (le montage), .derush/ (caches et sauvegardes), exports/ (les packs).
import fs from 'node:fs';
import path from 'node:path';
import {projetVide, formatProche, FORMATS, CADENCES, GENRES_BLOC, GENRES_INDICATION, LANGUES, TYPES_VIDEO, MODES, borner, couleurPropre, nouvelId} from './commun.mjs';
import {CATALOGUE, LOOKS, POLICES, PLATEFORMES, STYLES_SOUS_TITRES} from '../public/moteur.js';
import {ecrireJson, lireJson} from './outils.mjs';
import {trouverEspace} from './espaces.mjs';

/** L'id d'un média, tel que Dérush le donne (nouvelId) : il sert de nom de dossier, rien d'autre n'est permis. */
const ID_MEDIA = /^M\d{1,9}$/;
/**
 * Les autres ids, tels que nouvelId les donne : une case du montage (plan P, case à créer B), un effet ou une indication
 * (I), un plan posé par-dessus (S), un fichier pour l'IA (R). Ils entrent dans l'interface (attributs, textes), le pack
 * et les consignes de l'IA, et une case sert de nom de dossier (references/<case>/ du pack) : rien d'autre n'est permis.
 */
const ID_CASE = /^[PB]\d{1,9}$/;
const ID_INDICATION = /^I\d{1,9}$/;
const ID_SUPERPOSITION = /^S\d{1,9}$/;
const ID_REFERENCE = /^R\d{1,9}$/;
/** Une vidéo du projet (lib/sequences.mjs) : « V » suivi d'un nombre, donné par nouvelId comme les autres. */
const ID_SEQUENCE = /^V\d{1,9}$/;
/** Le plus grand compteur permis : au-delà, nouvelId donnerait un id de 10 chiffres, refusé par les motifs ci-dessus. */
const COMPTEUR_MAX = 999_999_999;

/** Une clé d'une table de Dérush (pas « constructor » ni « __proto__ », qu'un objet a toujours). */
const connu = (table, k) => typeof k === 'string' && Object.hasOwn(table, k);
/** Un nombre fini (donné en nombre ou en texte), sinon null. */
const nombre = (v) => ((typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) ? Number(v) : null);
const liste = (x) => (Array.isArray(x) ? x : []);

/**
 * Les compteurs des ids (nouvelId) d'un projet relu : des entiers, jamais en dessous d'un id déjà pris. Un compteur
 * abîmé (texte, négatif, en retard sur les ids) ferait redonner un id déjà pris : deux médias partageraient le même
 * dossier de cache, deux cases la même référence.
 */
function compteursPropres(d) {
  const c = {};
  for (const [k, v] of Object.entries(d.compteurs && typeof d.compteurs === 'object' ? d.compteurs : {})) {
    if (/^[A-Z]$/.test(k)) c[k] = Number.isInteger(v) && v >= 0 && v <= COMPTEUR_MAX ? v : 0;
  }
  // les vidéos rangées (pas celle qui est ouverte) gardent leurs plans, effets et plans par-dessus : leurs ids comptent
  const rangees = liste(d.sequences).filter((s) => s && typeof s === 'object');
  const contenu = rangees.flatMap((s) => [s.montage, s.superpositions, s.indications].flatMap(liste));
  for (const x of [d.medias, d.montage, d.superpositions, d.indications, d.references, rangees, contenu].flatMap(liste)) {
    const r = typeof x?.id === 'string' && /^([MPBISRV])(\d{1,9})$/.exec(x.id);
    if (r) c[r[1]] = Math.max(c[r[1]] ?? 0, Number(r[2]));
  }
  return c;
}

export class Projet {
  constructor(racine) {
    this.racine = path.resolve(racine);
    fs.mkdirSync(this.racine, {recursive: true});
    this.fichier = path.join(this.racine, 'derush.json');
    this.cache = path.join(this.racine, '.derush');
    const existant = lireJson(this.fichier);
    this.data = existant ?? projetVide(path.basename(this.racine));
    // un nouveau projet prend le format de sa première vidéo (« comme la vidéo ») ; il se change d'un clic dans la timeline
    if (!existant) this.data.sortie.auto = true;
    // un projet ouvert avec une ancienne version garde ses données ; on complète ce qui manque
    const base = projetVide(this.data.titre);
    for (const k of Object.keys(base)) this.data[k] ??= base[k];
    for (const k of ['brief', 'sortie', 'export', 'compteurs']) this.data[k] = {...base[k], ...this.data[k]};
    this.data.superpositions ??= [];
    this.data.references ??= [];
    this.data.style ??= {};
    // un projet reçu ou abîmé : l'id d'un média sert de nom de dossier (.derush/medias/<id>). Dérush ne donne jamais
    // que « M » suivi d'un nombre (nouvelId) : un autre id (« ../../Movies ») ferait écrire et effacer hors du projet.
    this.data.medias = liste(this.data.medias).filter((m) => m && typeof m === 'object' && ID_MEDIA.test(m.id));
    // une analyse interrompue (logiciel fermé pendant le traitement) sera relancée
    for (const m of this.data.medias) if (m.etat === 'analyse' || m.etat === 'attente') m.etat = 'a reprendre';
    // Le reste de ce qui est lu passe par les mêmes nettoyeurs que ce que l'interface envoie (appliquer) : un projet
    // reçu ou abîmé ne fait entrer dans l'interface, le pack ou les consignes de l'IA ni un id inventé
    // (« "><img onerror=…> »), ni un nombre qui n'en est pas un. Une case dont le rush n'est plus là part, comme au
    // premier enregistrement.
    for (const m of this.data.medias) this.nettoyerInfos(m);
    this.data.compteurs = compteursPropres(this.data);
    const renumerotes = new Map(); // id de case refusé → son nouvel id : les effets accrochés et les fichiers de la case le suivent
    this.data.montage = liste(this.data.montage).map((it) => this.nettoyerItem(it, renumerotes)).filter(Boolean);
    this.data.indications = liste(this.data.indications).map((i) => this.nettoyerIndication(i, renumerotes)).filter(Boolean);
    this.data.superpositions = liste(this.data.superpositions).map((s) => this.nettoyerSuperposition(s)).filter(Boolean);
    this.data.references = liste(this.data.references).map((r) => this.nettoyerReference(r, renumerotes)).filter(Boolean);
    this.data.style = this.nettoyerStyle(this.data.style && typeof this.data.style === 'object' ? this.data.style : {});
    // les vidéos du projet : un projet d'avant (sans elles) en a une seule, celle qu'il montre déjà
    this.nettoyerSequences();
    // une série appartient à un espace : un projet passé à un autre espace (depuis la bibliothèque, projet fermé)
    // n'en est plus un épisode (la pastille « Épisode de … » et l'en-tête ne l'affichent plus)
    if (this.data.serie && (typeof this.data.serie !== 'object' || this.data.serie.espace !== this.data.espace)) this.data.serie = null;
    this.derniereSauvegarde = 0;
    if (!fs.existsSync(this.fichier)) this.sauver();
  }

  get d() { return this.data; }

  /** Format « Auto » : le projet prend le format de sa première vidéo (ou image). Renvoie true s'il a changé. */
  formatAuto() {
    const d = this.data;
    if (!d.sortie.auto) return false;
    const v = d.medias.find((m) => m.type === 'video' && m.largeur && m.hauteur) ?? d.medias.find((m) => m.type === 'image' && m.largeur && m.hauteur);
    if (!v) return false;
    const k = formatProche(v.largeur, v.hauteur);
    if (k === d.sortie.preset) return false;
    Object.assign(d.sortie, {preset: k, largeur: FORMATS[k].largeur, hauteur: FORMATS[k].hauteur});
    this.sauver();
    return true;
  }

  media(id) { return this.data.medias.find((m) => m.id === id); }

  dossierMedia(id) {
    // seconde serrure : un seul nom de dossier, jamais un chemin qui sortirait de .derush/medias/
    if (typeof id !== 'string' || !id || id !== path.basename(id) || id === '.' || id === '..' || id.includes('\0')) throw new Error('Média inconnu.');
    // le projet a disparu (corbeille, déplacé) pendant qu'une tâche tournait : on ne recrée pas un projet fantôme
    if (!fs.existsSync(this.racine)) throw new Error('Le projet a été déplacé ou mis à la corbeille.');
    const d = path.join(this.cache, 'medias', id);
    fs.mkdirSync(d, {recursive: true});
    return d;
  }

  sauver() {
    // le projet a disparu (corbeille, déplacé) : rien n'est réécrit, sinon un projet fantôme réduit à derush.json renaîtrait
    if (!fs.existsSync(this.racine)) return;
    this.data.modifie_le = new Date().toISOString();
    // copie de sécurité toutes les 5 minutes au plus (on garde les 30 dernières)
    if (fs.existsSync(this.fichier) && Date.now() - this.derniereSauvegarde > 5 * 60 * 1000) {
      const dir = path.join(this.cache, 'sauvegardes');
      fs.mkdirSync(dir, {recursive: true});
      fs.copyFileSync(this.fichier, path.join(dir, `derush-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
      const vieilles = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
      for (const f of vieilles.slice(0, Math.max(0, vieilles.length - 30))) fs.rmSync(path.join(dir, f));
      this.derniereSauvegarde = Date.now();
    }
    ecrireJson(this.fichier, this.data);
  }

  /**
   * Applique les modifications envoyées par l'interface. L'interface décide du montage et du brief ;
   * le serveur garde la main sur les informations techniques des médias (analyse, caches).
   */
  appliquer(m) {
    const d = this.data;
    // L'interface dit pour quelle vidéo elle enregistre (« sequence ») : un enregistrement parti juste avant un changement
    // de vidéo arrive après lui. Son montage, ses effets et son format ne sont alors pas posés sur la vidéo ouverte
    // (ils écraseraient l'autre) ; le reste (titre, brief, style…) vaut pour tout le projet.
    const autreVideo = typeof m.sequence === 'string' && m.sequence !== d.sequence;
    if (typeof m.titre === 'string') d.titre = m.titre.slice(0, 200);
    if (LANGUES[m.langue]) d.langue = m.langue;
    if (MODES[m.mode]) d.mode = m.mode;
    if (m.brief && typeof m.brief === 'object') for (const k of Object.keys(d.brief)) if (typeof m.brief[k] === 'string') d.brief[k] = m.brief[k];
    if (!TYPES_VIDEO[d.brief.type]) d.brief.type = '';
    if (m.style && typeof m.style === 'object') d.style = this.nettoyerStyle(m.style);
    if (m.sortie && !autreVideo) {
      const f = FORMATS[m.sortie.preset];
      if (f) Object.assign(d.sortie, {preset: m.sortie.preset, largeur: f.largeur, hauteur: f.hauteur});
      if (CADENCES.includes(Number(m.sortie.fps))) d.sortie.fps = Number(m.sortie.fps);
      if (typeof m.sortie.auto === 'boolean') d.sortie.auto = m.sortie.auto;
    }
    if (m.export) {
      if (Number.isFinite(Number(m.export.poignees_s))) d.export.poignees_s = borner(Number(m.export.poignees_s), 0, 5);
      for (const k of ['rushes_complets', 'zip', 'kit_remotion']) if (typeof m.export[k] === 'boolean') d.export[k] = m.export[k];
    }
    // les compteurs d'abord : un id refusé plus bas est remplacé par un id neuf, jamais par un que l'interface a déjà donné
    if (m.compteurs && typeof m.compteurs === 'object') {
      for (const k of ['P', 'B', 'I', 'S']) {
        const n = Number(m.compteurs[k]);
        if (Number.isInteger(n) && n > 0 && n <= COMPTEUR_MAX) d.compteurs[k] = Math.max(d.compteurs[k] ?? 0, n);
      }
    }
    if (Array.isArray(m.montage) && !autreVideo) d.montage = m.montage.map((it) => this.nettoyerItem(it)).filter(Boolean);
    if (Array.isArray(m.indications) && !autreVideo) d.indications = m.indications.map((i) => this.nettoyerIndication(i)).filter(Boolean);
    if (Array.isArray(m.superpositions) && !autreVideo) d.superpositions = m.superpositions.map((s) => this.nettoyerSuperposition(s)).filter(Boolean);
    if (Array.isArray(m.medias)) for (const x of m.medias) { const me = this.media(x.id); if (me && typeof x.nom === 'string' && x.nom.trim()) me.nom = x.nom.trim().slice(0, 200); }
    // pour qui est le projet : un espace qui existe (Moi, un client, Personne)
    // (une série appartient à un espace : le projet passé ailleurs n'en est plus un épisode)
    if (typeof m.espace === 'string' && trouverEspace(m.espace)) { d.espace = m.espace; if (d.serie && d.serie.espace !== m.espace) d.serie = null; }
    this.sauver();
    return {sequence: d.sequence, sequence_ignoree: autreVideo};
  }

  /** Le nom d'une vidéo du projet : un texte d'une ligne, 80 caractères au plus (vide s'il n'y en a pas). */
  nomPropre(nom) {
    return typeof nom === 'string' ? nom.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  }

  /** Le format d'une vidéo rangée : un format connu (sinon celui de la vidéo ouverte), une cadence permise. */
  nettoyerSortie(s) {
    const r = {...this.data.sortie};
    if (s && typeof s === 'object') {
      if (connu(FORMATS, s.preset)) Object.assign(r, {preset: s.preset, largeur: FORMATS[s.preset].largeur, hauteur: FORMATS[s.preset].hauteur});
      if (CADENCES.includes(Number(s.fps))) r.fps = Number(s.fps);
    }
    // « Auto » (le format de la première vidéo importée) : seulement si cette vidéo-là l'a
    if (typeof s?.auto === 'boolean') r.auto = s.auto;
    else delete r.auto;
    return r;
  }

  /** D'où vient une vidéo du projet : une vidéo livrée par l'IA (sa version, son rang), ou rien. */
  nettoyerOrigine(o) {
    if (!o || typeof o !== 'object' || !Number.isInteger(o.version) || !Number.isInteger(o.video) || o.version < 0 || o.video < 0) return null;
    const txt = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);
    return {version: o.version, video: o.video, fichier: txt(o.fichier, 200), moteur: txt(o.moteur, 20), mode: o.mode === 'plans' ? 'plans' : 'fichier'};
  }

  /**
   * Les vidéos du projet (lib/sequences.mjs), relues sur le disque. La vidéo ouverte vit dans montage, superpositions,
   * indications et sortie, comme avant : son entrée de la liste ne porte que son nom. Les autres gardent leur contenu,
   * qui passe par les mêmes nettoyeurs que la vidéo ouverte. Un projet d'avant (sans liste) en a une seule ; une liste
   * qui ne dit plus laquelle est ouverte en reçoit une de plus, pour ce qui est dans la timeline : rien n'est perdu.
   */
  nettoyerSequences() {
    const d = this.data;
    const vus = new Set();
    const lues = [];
    for (const s of liste(d.sequences)) {
      if (!s || typeof s !== 'object') continue;
      const id = typeof s.id === 'string' && ID_SEQUENCE.test(s.id) && !vus.has(s.id) ? s.id : nouvelId(d, 'V');
      vus.add(id);
      lues.push({...s, id});
    }
    let ouverte = lues.find((s) => s.id === d.sequence);
    if (!ouverte) {
      ouverte = {id: nouvelId(d, 'V'), nom: ''};
      lues.unshift(ouverte);
    }
    d.sequences = lues.map((s, k) => {
      const origine = this.nettoyerOrigine(s.origine);
      const base = {id: s.id, nom: this.nomPropre(s.nom) || `Vidéo ${k + 1}`,
        ...(typeof s.cree_le === 'string' ? {cree_le: s.cree_le.slice(0, 40)} : {}), ...(origine ? {origine} : {})};
      if (s === ouverte) return base;
      // les effets d'une vidéo rangée suivent les plans de cette vidéo-là (un id refusé y est renuméroté à part)
      const renumerotes = new Map();
      return {...base,
        montage: liste(s.montage).map((it) => this.nettoyerItem(it, renumerotes)).filter(Boolean),
        indications: liste(s.indications).map((i) => this.nettoyerIndication(i, renumerotes)).filter(Boolean),
        superpositions: liste(s.superpositions).map((x) => this.nettoyerSuperposition(x)).filter(Boolean),
        sortie: this.nettoyerSortie(s.sortie),
      };
    });
    d.sequence = ouverte.id;
  }

  /**
   * Un id tel que nouvelId le donne. Sinon (projet reçu ou abîmé), un id neuf, et un mot dans le journal ; `renumerotes`
   * note le changement, pour que ce qui visait l'ancien id (effet accroché, fichiers d'une case) le suive.
   */
  idPropre(id, motif, prefixe, renumerotes) {
    if (typeof id === 'string' && motif.test(id)) return id;
    const neuf = nouvelId(this.data, prefixe);
    if (typeof id === 'string') renumerotes?.set(id, neuf);
    console.warn(`Projet « ${this.data.titre} » : un identifiant illisible (${JSON.stringify(String(id ?? '')).slice(0, 40)}) devient ${neuf}.`);
    return neuf;
  }

  /** Les informations techniques d'un média relu sur le disque : des nombres, ou rien (elles entrent dans l'interface). */
  nettoyerInfos(m) {
    const duree = nombre(m.duree);
    if (duree !== null && duree >= 0) m.duree = duree;
    else delete m.duree; // sans durée lisible, ses plans partent (nettoyerItem) : Dérush n'importe jamais un tel média
    for (const k of ['largeur', 'hauteur', 'fps']) if (k in m) m[k] = nombre(m[k]) > 0 ? nombre(m[k]) : null;
    if (m.transcription != null) {
      if (typeof m.transcription !== 'object' || Array.isArray(m.transcription)) m.transcription = null;
      else if ('mots' in m.transcription) m.transcription.mots = Math.max(0, Math.round(nombre(m.transcription.mots) ?? 0));
    }
    if (m.vignettes != null) {
      const v = m.vignettes;
      const [n, l, h, pas] = ['n', 'l', 'h', 'pas'].map((k) => (typeof v === 'object' ? nombre(v[k]) : null));
      m.vignettes = n > 0 && l > 0 && h > 0 && pas > 0 ? {
        n: borner(Math.round(n), 1, 1000), pas, l: borner(Math.round(l), 1, 10000), h: borner(Math.round(h), 1, 10000),
        // « v » change à chaque nouvelle planche (l'interface la recharge) : un nombre, ou un court texte sans signe
        ...(Number.isFinite(v.v) || (typeof v.v === 'string' && /^[0-9a-z]{1,16}$/.test(v.v)) ? {v: v.v} : {}),
        ...(v.provisoire === true ? {provisoire: true} : {}),
      } : null;
    }
  }

  /**
   * Un fichier pour l'IA relu sur le disque (posé par les routes du serveur, jamais par l'interface). Son nom sert de
   * nom de fichier dans le pack (references/<case>/<nom>) : un nom seul, jamais un chemin.
   */
  nettoyerReference(r, renumerotes) {
    if (!r || typeof r !== 'object' || typeof r.chemin !== 'string' || !path.isAbsolute(r.chemin) || r.chemin.includes('\0') || !path.basename(r.chemin)) return null;
    // la case visée : aucune (tout le projet) ou un id de case. Une case retirée garde ses fichiers à part, comme avant :
    // le pack ne les donne qu'à une case de ce nom, et un id n'est jamais redonné.
    let cible = r.cible ?? null;
    if (typeof cible === 'string') cible = renumerotes?.get(cible) ?? cible;
    if (cible !== null && !(typeof cible === 'string' && ID_CASE.test(cible))) return null;
    const nomSeul = typeof r.nom === 'string' && r.nom === path.basename(r.nom) && !['', '.', '..'].includes(r.nom) && !r.nom.includes('\0');
    return {
      id: this.idPropre(r.id, ID_REFERENCE, 'R'), nom: nomSeul ? r.nom : path.basename(r.chemin), chemin: r.chemin, cible,
      taille: typeof r.taille === 'number' && Number.isFinite(r.taille) && r.taille >= 0 ? r.taille : null,
      ajoute_le: typeof r.ajoute_le === 'string' ? r.ajoute_le.slice(0, 40) : null,
    };
  }

  nettoyerItem(it, renumerotes) {
    const txt = (v, n = 4000) => (typeof v === 'string' ? v.slice(0, n) : '');
    if (it?.type === 'plan') {
      const m = this.media(it.media);
      if (!m) return null;
      const entree = borner(Number(it.entree) || 0, 0, m.duree);
      const sortie = borner(Number(it.sortie) || 0, 0, m.duree);
      if (!(sortie > entree)) return null;
      return {
        id: this.idPropre(it.id, ID_CASE, 'P', renumerotes), type: 'plan', media: m.id, entree, sortie,
        titre: txt(it.titre, 200), notes: txt(it.notes), tags: Array.isArray(it.tags) ? it.tags.map((t) => txt(t, 40)).filter(Boolean).slice(0, 20) : [],
        son: this.nettoyerSon(it.son, true),
        // l'étalonnage du plan (panneau Couleurs de l'inspecteur) : le pack et « Créer la vidéo » le lisent ici
        ...(m.type !== 'audio' && couleurPropre(it.couleur) ? {couleur: couleurPropre(it.couleur)} : {}),
        // « essentiel » : l'IA doit absolument garder ce passage (les autres, elle peut les resserrer)
        ...(it.essentiel === true ? {essentiel: true} : {}),
        // ce plan a déjà du texte incrusté : on ne lui ajoute pas de sous-titres
        ...(it.sans_sous_titres === true ? {sans_sous_titres: true} : {}),
      };
    }
    if (it?.type === 'bloc') {
      return {
        id: this.idPropre(it.id, ID_CASE, 'B', renumerotes), type: 'bloc', genre: connu(GENRES_BLOC, it.genre) ? it.genre : 'autre',
        duree: borner(Number(it.duree) || 1, 1 / 120, 3600), titre: txt(it.titre, 200), consigne: txt(it.consigne), references: txt(it.references, 2000),
      };
    }
    return null;
  }

  nettoyerSon(s, actifParDefaut) {
    return {
      actif: actifParDefaut ? s?.actif !== false : s?.actif === true,
      gain_db: borner(Number(s?.gain_db) || 0, -60, 24),
      // « clair » : la voix nettoyée par Dérush (lib/son.mjs) ; « voix » et « fond » : la voix seule, ou tout sauf elle
      version: ['original', 'clair', 'voix', 'fond'].includes(s?.version) ? s.version : 'original',
      avant_s: borner(Number(s?.avant_s) || 0, 0, 10),
      apres_s: borner(Number(s?.apres_s) || 0, 0, 10),
    };
  }

  /** Plan posé par-dessus le montage (piste du dessus) : il ne change pas la durée. */
  nettoyerSuperposition(s) {
    const m = this.media(s?.media);
    if (!m) return null;
    const entree = borner(Number(s.entree) || 0, 0, m.duree);
    const sortie = borner(Number(s.sortie) || 0, 0, m.duree);
    if (!(sortie > entree)) return null;
    const txt = (v, n = 4000) => (typeof v === 'string' ? v.slice(0, n) : '');
    return {
      id: this.idPropre(s.id, ID_SUPERPOSITION, 'S'), media: m.id, entree, sortie, debut: Math.max(0, Number(s.debut) || 0),
      titre: txt(s.titre, 200), notes: txt(s.notes), cadre: s.cadre === 'incrustation' ? 'incrustation' : 'plein',
      son: this.nettoyerSon(s.son, false),
      // la voix off de l'humain : le fil du film (posée par « Enregistrer », ou cochée dans sa fiche)
      ...(s.voix_off === true ? {voix_off: true} : {}),
    };
  }

  nettoyerIndication(i, renumerotes) {
    if (!i || typeof i !== 'object') return null;
    const debut = Math.max(0, Number(i.debut) || 0);
    const fin = Math.max(debut + 1 / 120, Number(i.fin) || 0);
    // un effet du catalogue (transition, titre, bruitage…) : Dérush le dessine, et il suit le plan auquel il est accroché
    const d = connu(CATALOGUE, i.modele) ? CATALOGUE[i.modele] : null;
    const ancre = typeof i.ancre?.id === 'string' ? renumerotes?.get(i.ancre.id) ?? i.ancre.id : null;
    const effet = d ? {
      modele: i.modele, reglages: this.nettoyerReglages(d, i.reglages),
      ...(ancre && ID_CASE.test(ancre) ? {ancre: {id: ancre, d: Number.isFinite(Number(i.ancre.d)) ? Number(i.ancre.d) : 0}} : {}),
    } : {};
    const genre = d ? {transition: 'transition', titre: 'texte', ambiance: 'effet', son: 'son'}[d.categorie] : connu(GENRES_INDICATION, i.genre) ? i.genre : 'note';
    return {
      id: this.idPropre(i.id, ID_INDICATION, 'I'), genre,
      debut, fin, consigne: typeof i.consigne === 'string' ? i.consigne.slice(0, 4000) : '', ...effet,
    };
  }

  /** Ne garde que les réglages prévus par le catalogue, avec des valeurs permises. */
  nettoyerReglages(d, r) {
    const res = {};
    for (const [k, p] of Object.entries(d.reglages)) {
      const v = r?.[k];
      if (v === undefined || v === null) continue;
      if (p.type === 'texte' && typeof v === 'string') res[k] = v.slice(0, 200);
      else if (p.type === 'choix' && Object.hasOwn(p.options, v)) res[k] = v;
      else if (p.type === 'nombre' && Number.isFinite(Number(v))) res[k] = borner(Number(v), p.min, p.max);
      else if (p.type === 'bascule' && typeof v === 'boolean') res[k] = v;
    }
    return res;
  }

  /** Le style du film : seulement des valeurs connues du moteur d'habillage. */
  nettoyerStyle(s) {
    const r = {};
    if (LOOKS[s.look]) r.look = s.look;
    if (/^#[0-9a-f]{6}$/i.test(s.accent ?? '')) r.accent = s.accent;
    for (const k of ['police_titres', 'police_textes']) if (POLICES[s[k]]) r[k] = s[k];
    if (s.sous_titres && typeof s.sous_titres === 'object') {
      r.sous_titres = {style: STYLES_SOUS_TITRES[s.sous_titres.style] ? s.sous_titres.style : 'karaoke', position: s.sous_titres.position === 'centre' ? 'centre' : 'bas', majuscules: s.sous_titres.majuscules === true};
    }
    if (s.transition_auto === 'aucune' || CATALOGUE[s.transition_auto]?.categorie === 'transition') r.transition_auto = s.transition_auto;
    for (const k of ['grain', 'vignette']) if (Number.isFinite(Number(s[k]))) r[k] = borner(Number(s[k]), 0, 1);
    for (const k of ['bandes', 'barre', 'bruitages']) if (typeof s[k] === 'boolean') r[k] = s[k];
    if (PLATEFORMES[s.plateforme]) r.plateforme = s.plateforme;
    return r;
  }
}
