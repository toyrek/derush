// Dérush — un projet = un dossier : derush.json (le montage), .derush/ (caches et sauvegardes), exports/ (les packs).
import fs from 'node:fs';
import path from 'node:path';
import {projetVide, formatProche, FORMATS, CADENCES, GENRES_BLOC, GENRES_INDICATION, LANGUES, TYPES_VIDEO, borner} from './commun.mjs';
import {CATALOGUE, LOOKS, POLICES, PLATEFORMES, STYLES_SOUS_TITRES} from '../public/moteur.js';
import {ecrireJson, lireJson} from './outils.mjs';

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
    // une analyse interrompue (logiciel fermé pendant le traitement) sera relancée
    for (const m of this.data.medias) if (m.etat === 'analyse' || m.etat === 'attente') m.etat = 'a reprendre';
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
    const d = path.join(this.cache, 'medias', id);
    fs.mkdirSync(d, {recursive: true});
    return d;
  }

  sauver() {
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
    if (typeof m.titre === 'string') d.titre = m.titre.slice(0, 200);
    if (LANGUES[m.langue]) d.langue = m.langue;
    if (m.brief && typeof m.brief === 'object') for (const k of Object.keys(d.brief)) if (typeof m.brief[k] === 'string') d.brief[k] = m.brief[k];
    if (!TYPES_VIDEO[d.brief.type]) d.brief.type = '';
    if (m.style && typeof m.style === 'object') d.style = this.nettoyerStyle(m.style);
    if (m.sortie) {
      const f = FORMATS[m.sortie.preset];
      if (f) Object.assign(d.sortie, {preset: m.sortie.preset, largeur: f.largeur, hauteur: f.hauteur});
      if (CADENCES.includes(Number(m.sortie.fps))) d.sortie.fps = Number(m.sortie.fps);
      if (typeof m.sortie.auto === 'boolean') d.sortie.auto = m.sortie.auto;
    }
    if (m.export) {
      if (Number.isFinite(Number(m.export.poignees_s))) d.export.poignees_s = borner(Number(m.export.poignees_s), 0, 5);
      for (const k of ['rushes_complets', 'zip', 'kit_remotion']) if (typeof m.export[k] === 'boolean') d.export[k] = m.export[k];
    }
    if (Array.isArray(m.montage)) d.montage = m.montage.map((it) => this.nettoyerItem(it)).filter(Boolean);
    if (Array.isArray(m.indications)) d.indications = m.indications.map((i) => this.nettoyerIndication(i)).filter(Boolean);
    if (Array.isArray(m.superpositions)) d.superpositions = m.superpositions.map((s) => this.nettoyerSuperposition(s)).filter(Boolean);
    if (m.compteurs) for (const k of ['P', 'B', 'I', 'S']) d.compteurs[k] = Math.max(d.compteurs[k] ?? 0, Number(m.compteurs[k]) || 0);
    if (Array.isArray(m.medias)) for (const x of m.medias) { const me = this.media(x.id); if (me && typeof x.nom === 'string' && x.nom.trim()) me.nom = x.nom.trim().slice(0, 200); }
    this.sauver();
  }

  nettoyerItem(it) {
    const txt = (v, n = 4000) => (typeof v === 'string' ? v.slice(0, n) : '');
    if (it?.type === 'plan') {
      const m = this.media(it.media);
      if (!m) return null;
      const entree = borner(Number(it.entree) || 0, 0, m.duree);
      const sortie = borner(Number(it.sortie) || 0, 0, m.duree);
      if (!(sortie > entree)) return null;
      return {
        id: txt(it.id, 20), type: 'plan', media: m.id, entree, sortie,
        titre: txt(it.titre, 200), notes: txt(it.notes), tags: Array.isArray(it.tags) ? it.tags.map((t) => txt(t, 40)).filter(Boolean).slice(0, 20) : [],
        son: this.nettoyerSon(it.son, true),
        // « essentiel » : l'IA doit absolument garder ce passage (les autres, elle peut les resserrer)
        ...(it.essentiel === true ? {essentiel: true} : {}),
        // ce plan a déjà du texte incrusté : on ne lui ajoute pas de sous-titres
        ...(it.sans_sous_titres === true ? {sans_sous_titres: true} : {}),
      };
    }
    if (it?.type === 'bloc') {
      return {
        id: txt(it.id, 20), type: 'bloc', genre: GENRES_BLOC[it.genre] ? it.genre : 'autre',
        duree: borner(Number(it.duree) || 1, 1 / 120, 3600), titre: txt(it.titre, 200), consigne: txt(it.consigne), references: txt(it.references, 2000),
      };
    }
    return null;
  }

  nettoyerSon(s, actifParDefaut) {
    return {
      actif: actifParDefaut ? s?.actif !== false : s?.actif === true,
      gain_db: borner(Number(s?.gain_db) || 0, -60, 24),
      version: ['original', 'voix', 'fond'].includes(s?.version) ? s.version : 'original',
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
      id: txt(s.id, 20), media: m.id, entree, sortie, debut: Math.max(0, Number(s.debut) || 0),
      titre: txt(s.titre, 200), notes: txt(s.notes), cadre: s.cadre === 'incrustation' ? 'incrustation' : 'plein',
      son: this.nettoyerSon(s.son, false),
    };
  }

  nettoyerIndication(i) {
    const debut = Math.max(0, Number(i?.debut) || 0);
    const fin = Math.max(debut + 1 / 120, Number(i?.fin) || 0);
    // un effet du catalogue (transition, titre, bruitage…) : Dérush le dessine, et il suit le plan auquel il est accroché
    const d = CATALOGUE[i?.modele];
    const effet = d ? {
      modele: i.modele, reglages: this.nettoyerReglages(d, i.reglages),
      ...(i.ancre && typeof i.ancre.id === 'string' ? {ancre: {id: i.ancre.id.slice(0, 20), d: Number(i.ancre.d) || 0}} : {}),
    } : {};
    const genre = d ? {transition: 'transition', titre: 'texte', ambiance: 'effet', son: 'son'}[d.categorie] : GENRES_INDICATION[i?.genre] ? i.genre : 'note';
    return {
      id: String(i?.id ?? '').slice(0, 20), genre,
      debut, fin, consigne: typeof i?.consigne === 'string' ? i.consigne.slice(0, 4000) : '', ...effet,
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
