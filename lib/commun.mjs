// Dérush — fonctions partagées par le serveur (Node) et l'interface (navigateur).
// Convention : toutes les durées sont en secondes ; une « image » est un numéro de frame compté depuis 0.
// Le montage est toujours calé sur la grille d'images de la sortie (projet.sortie.fps).

export const VERSION = '9.3';

export const FORMATS = {
  vertical: {nom: 'Vertical 9:16 (Reels, TikTok, Shorts)', ratio: '9:16', largeur: 1080, hauteur: 1920},
  horizontal: {nom: 'Horizontal 16:9 (YouTube)', ratio: '16:9', largeur: 1920, hauteur: 1080},
  carre: {nom: 'Carré 1:1', ratio: '1:1', largeur: 1080, hauteur: 1080},
  portrait: {nom: 'Portrait 4:5 (fil Instagram)', ratio: '4:5', largeur: 1080, hauteur: 1350},
};
export const CADENCES = [24, 25, 30, 50, 60];

// Blocs vides : des cases dans le montage, que l'IA remplira (elles prennent du temps dans la vidéo).
export const GENRES_BLOC = {
  scene: 'Scène à créer',
  titre: 'Titre / carton',
  animation: 'Animation / motion design',
  '3d': 'Scène 3D (Blender…)',
  generee: 'Image ou vidéo générée par IA',
  carte: 'Carte',
  image: 'Image / photo',
  broll: 'Plan de coupe',
  transition: 'Transition',
  autre: 'Autre',
};
// Indications : des consignes posées par-dessus le montage, sur une plage de temps (elles ne changent pas la durée).
export const GENRES_INDICATION = {
  texte: 'Texte à l’écran',
  animation: 'Animation',
  effet: 'Effet',
  zoom: 'Zoom / recadrage',
  musique: 'Musique',
  son: 'Son / bruitage',
  'sous-titres': 'Sous-titres',
  transition: 'Transition',
  note: 'Note',
};

// Le genre de vidéo : il règle le style de départ, et dit à l'IA quelle recette suivre (voir lib/recettes.mjs).
export const TYPES_VIDEO = {
  libre: {nom: 'Libre', description: 'Je fais à ma façon.', look: 'simple'},
  trend: {nom: 'Trend, voyage', description: 'Des plans courts, de la musique, des effets sur les coupes.', look: 'trend'},
  podcast: {nom: 'Extrait de podcast', description: 'Une voix, des sous-titres, des images à créer.', look: 'podcast'},
  face: {nom: 'Face caméra', description: 'Quelqu’un parle à la caméra : sous-titres et mots forts.', look: 'trend'},
  explication: {nom: 'Explication', description: 'Un sujet expliqué, avec des cartes, des chiffres, des schémas.', look: 'simple'},
  evenement: {nom: 'Événement, teaser', description: 'Une annonce ou un retour en images, avec un carton de fin.', look: 'cinema'},
};

/**
 * Les modes de création : ce que la personne donne, et ce que l'IA doit en faire. « matiere » dit s'il faut déposer
 * quelque chose avant de demander ; « consigne » est redite à l'IA à chaque message.
 */
export const MODES = {
  montage: {nom: 'Montage', description: 'Tu déposes tes vidéos, ton IA les monte.', matiere: true, consigne: ''},
  motion: {nom: 'Motion design', description: 'Rien à déposer : tu décris, ton IA cherche, écrit et anime tout.', matiere: false,
    consigne: 'Mode « motion design » : il n’y a pas de rush à monter (seulement les pièces jointes, s’il y en a). Tout est à créer dans Remotion : textes animés, formes, schémas, chiffres, icônes, transitions, et le son (ElevenLabs s’il est branché, sinon la bibliothèque de sons, sinon rien). Avant d’animer : cherche sur le web ce qu’il te faut (faits, chiffres, exemples) et garde tes sources ; écris un plan court (une accroche, 3 à 6 scènes, une fin) ; respecte la charte et le logo joints. Lis MOTION.md et la compétence motion-graphics. Dans ton compte rendu, cite tes sources en une ligne.'},
  extraits: {nom: 'Extraits courts', description: 'Une longue vidéo ou un podcast : ton IA en tire les meilleurs moments.', matiere: true,
    consigne: 'Mode « extraits courts » : la matière est longue (une vidéo, un podcast, un direct). Lis le texte mot à mot, trouve les meilleurs passages (compétences yt-shorts, podcast-and-audiograms, captions-and-clipping), et fais un clip par passage : 20 à 60 secondes, vertical sauf demande contraire, une première phrase qui accroche, des sous-titres, un titre. Livre-les tous dans rendu/livraison/, avec leur titre.'},
  son: {nom: 'Sur un son', description: 'Une musique, une voix ou un podcast : ton IA crée les images qui vont avec.', matiere: true,
    consigne: 'Mode « sur un son » : la matière est un son (musique, voix, podcast). Crée l’image qui va avec : du motion design calé sur le rythme ou sur les mots (paroles ou sous-titres mot à mot), et des visuels générés si ElevenLabs est branché. Le son d’origine reste la bande son, sans le recouvrir.'},
};

// Tout ce que FFmpeg sait lire : vidéos (caméras, téléphones, drones, GoPro, Insta360…), sons et images fixes.
export const EXT_VIDEOS = /\.(mp4|mov|m4v|mkv|webm|avi|mts|m2ts|ts|mxf|mpg|mpeg|m2v|vob|3gp|3g2|wmv|asf|flv|f4v|ogv|dv|mod|tod|insv|lrv|hevc|h264|h265|264|265|y4m|gif)$/i;
export const EXT_SONS = /\.(mp3|wav|m4a|aac|aif|aiff|aifc|flac|ogg|oga|opus|wma|caf|alac|ac3|eac3|mka|amr|m4b)$/i;
export const EXT_IMAGES = /\.(jpe?g|png|webp|heic|heif|tiff?|bmp|avif)$/i;
// Formats RAW de caméra de cinéma : FFmpeg ne sait pas les décoder
export const EXT_RAW = /\.(r3d|braw|ari|arx|crm|cine)$/i;
export const EXT_MEDIAS = new RegExp(`(${[EXT_VIDEOS, EXT_SONS, EXT_IMAGES].map((r) => r.source).join('|')})`, 'i');

const pad = (n, w = 2) => String(Math.floor(Math.abs(n))).padStart(w, '0');
export const arrondi = (x, n = 4) => Math.round(x * 10 ** n) / 10 ** n;
export const borner = (x, a, b) => Math.min(b, Math.max(a, x));

/** Numéro d'image (frame) le plus proche d'un temps donné. */
export const versImage = (s, fps) => Math.round(s * fps + 1e-7);
/** Ramène un temps sur la grille d'images. */
export const surGrille = (s, fps) => versImage(s, fps) / fps;

/** Timecode HH:MM:SS:II (non drop-frame, comme la plupart des logiciels de montage). */
export function tc(s, fps) {
  const nominal = Math.round(fps) || 30;
  const total = Math.max(0, versImage(s, fps));
  const sec = Math.floor(total / nominal);
  return `${pad(sec / 3600)}:${pad((sec / 60) % 60)}:${pad(sec % 60)}:${pad(total % nominal)}`;
}

/** Durée courte et lisible : « 4,4 s », « 1 min 05 ». */
export function dureeLisible(s) {
  if (!Number.isFinite(s)) return '—';
  if (s < 60) return `${(Math.round(s * 10) / 10).toLocaleString('fr-FR')} s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  if (m < 60) return `${m} min ${String(r).padStart(2, '0')}`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

/**
 * Lit un temps tapé à la main. Formats acceptés :
 * « HH:MM:SS:II » (timecode), « HH:MM:SS », « MM:SS », « 12,5 » ou « 12.5 s » (secondes), « 372i » (images).
 * Renvoie des secondes, ou null si le texte n'est pas compris.
 */
export function lireTemps(txt, fps) {
  const t = String(txt ?? '').trim().replace(/,/g, '.').replace(/\s*(s|sec|secondes?)$/i, '');
  if (!t) return null;
  const img = /^(\d+)\s*i(mages?)?$/i.exec(t);
  if (img) return Number(img[1]) / fps;
  const parts = t.split(':');
  if (parts.some((p) => p === '' || !Number.isFinite(Number(p)))) return null;
  const n = parts.map(Number);
  if (n.length === 1) return n[0];
  if (n.length === 2) return n[0] * 60 + n[1];
  if (n.length === 3) return n[0] * 3600 + n[1] * 60 + n[2];
  if (n.length === 4) return n[0] * 3600 + n[1] * 60 + n[2] + n[3] / (Math.round(fps) || 30);
  return null;
}

/** Un temps sous ses trois formes : secondes, numéro d'image, timecode. */
export const temps = (s, fps) => ({s: arrondi(s), image: versImage(s, fps), tc: tc(s, fps)});

/** Cadence de la source : celle du fichier vidéo, ou celle de la sortie pour un fichier son. */
export const fpsSource = (m, projet) => (m && m.fps) || projet.sortie.fps;

export const dureeItem = (it) => (it.type === 'plan' ? it.sortie - it.entree : it.duree);

/**
 * Place chaque élément du montage sur la grille d'images de la sortie.
 * Les durées sont arrondies image par image et cumulées en images entières : aucune dérive, même sur un long montage.
 */
export function sequence(projet) {
  const fps = projet.sortie.fps;
  const segs = [];
  let f = 0;
  projet.montage.forEach((it, k) => {
    const n = Math.max(1, versImage(dureeItem(it), fps));
    segs.push({it, k, i0: f, i1: f + n, debut: f / fps, fin: (f + n) / fps});
    f += n;
  });
  return {segs, images: f, duree: f / fps, fps};
}

/** Élément du montage présent au temps t (null en dehors). */
export function segmentA(seq, t) {
  let a = 0;
  let b = seq.segs.length - 1;
  while (a <= b) {
    const m = (a + b) >> 1;
    const s = seq.segs[m];
    if (t < s.debut) b = m - 1;
    else if (t >= s.fin) a = m + 1;
    else return s;
  }
  return null;
}

/** Mots d'une transcription compris dans [entree, sortie[ (critère : le milieu du mot). */
export function motsEntre(mots, entree, sortie) {
  if (!mots) return [];
  const r = [];
  for (const w of mots) {
    const c = (w.d + w.f) / 2;
    if (c >= entree && c < sortie) r.push(w);
    else if (w.d >= sortie) break;
  }
  return r;
}

/** Texte lisible d'une suite de mots (les événements sonores entre parenthèses sont gardés tels quels). */
export function texteDesMots(mots) {
  let s = '';
  for (const w of mots) {
    const t = String(w.t ?? '').trim();
    if (!t) continue;
    // ponctuation et élisions collées : « tous, », « l'association », « (rires) »
    if (!s) s = t;
    else if (/^[,.…)\]%'’]/.test(t) || /^-\p{L}/u.test(t) || /['’([]$/.test(s)) s += t;
    else s += ` ${t}`;
  }
  return s;
}

/** Identifiant suivant : P1, P2… (jamais réutilisé grâce au compteur du projet). */
export function nouvelId(projet, prefixe) {
  projet.compteurs ??= {};
  projet.compteurs[prefixe] = (projet.compteurs[prefixe] ?? 0) + 1;
  return `${prefixe}${projet.compteurs[prefixe]}`;
}

/** Nom de fichier sans accents ni caractères spéciaux. */
export function slug(txt, max = 40) {
  return String(txt ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, max).replace(/-+$/g, '');
}

/** Coupe un texte en lignes de `largeur` caractères au plus (sans couper les mots, sauf s'ils sont trop longs). */
export function couperLignes(txt, largeur) {
  const lignes = [];
  for (const para of String(txt ?? '').split('\n')) {
    let l = '';
    for (const mot of para.split(/\s+/).filter(Boolean)) {
      if (!l) l = mot;
      else if ((l + ' ' + mot).length <= largeur) l += ' ' + mot;
      else { lignes.push(l); l = mot; }
      while (l.length > largeur) { lignes.push(l.slice(0, largeur)); l = l.slice(largeur); }
    }
    lignes.push(l);
  }
  return lignes;
}

/** Le format le plus proche d'une image largeur × hauteur (pour le format « comme la vidéo »). */
export function formatProche(largeur, hauteur) {
  const r = largeur / Math.max(1, hauteur);
  if (r >= 1.25) return 'horizontal';
  if (r >= 0.9) return 'carre';
  if (r >= 0.7) return 'portrait';
  return 'vertical';
}

/** Projet vide, prêt à l'emploi. */
export function projetVide(titre) {
  const maintenant = new Date().toISOString();
  return {
    format: 'derush',
    version: 1,
    titre: titre || 'Nouveau montage',
    cree_le: maintenant,
    modifie_le: maintenant,
    // le mode de création (voir MODES) : montage par défaut
    mode: 'montage',
    brief: {type: '', objectif: '', public: '', ton: '', plateformes: '', duree_visee: '', a_eviter: '', references: ''},
    sortie: {preset: 'vertical', largeur: 1080, hauteur: 1920, fps: 30},
    langue: 'fr',
    export: {poignees_s: 0.5, rushes_complets: false, zip: false, kit_remotion: true},
    compteurs: {M: 0, P: 0, B: 0, I: 0, S: 0},
    medias: [],
    montage: [],
    superpositions: [],
    // consignes pour l'IA et effets posés (un effet = une indication avec un « modele » du catalogue : Dérush le dessine)
    indications: [],
    // l'habillage de tout le film : sous-titres, couleur, police, transition sur chaque coupe, grain… (voir public/moteur.js)
    style: {},
    // fichiers de référence pour l'IA (images, modèles 3D, PDF…) : sur le projet, ou sur une case à créer (cible)
    references: [],
  };
}

export const LANGUES = {fr: 'Français', en: 'Anglais', es: 'Espagnol', ar: 'Arabe', pt: 'Portugais', de: 'Allemand', it: 'Italien', ja: 'Japonais', auto: 'Détection automatique'};

/**
 * Fenêtre de recadrage [gauche, haut, largeur, haut.] (fractions de l'image source) pour passer
 * d'un rush de rapport rs (largeur / hauteur) à une sortie de rapport ro, centrée sur le point (x, y).
 */
export function fenetreCadrage(x, y, rs, ro) {
  if (!(rs > 0) || !(ro > 0) || Math.abs(rs - ro) < 0.01) return [0, 0, 1, 1];
  if (ro < rs) {
    const w = ro / rs;
    return [arrondi(borner(x - w / 2, 0, 1 - w), 4), 0, arrondi(w, 4), 1];
  }
  const h = rs / ro;
  return [0, arrondi(borner(y - h / 2, 0, 1 - h), 4), 1, arrondi(h, 4)];
}

/** Position du sujet au temps t (interpolée ; la caméra saute d'un coup aux changements de plan). */
export function pointCadrage(points, t) {
  if (!points?.length) return null;
  const n = points.length - 1;
  if (t <= points[0].t) return points[0];
  if (t >= points[n].t) return points[n];
  let a = 0;
  let b = n;
  while (b - a > 1) {
    const m = (a + b) >> 1;
    if (points[m].t <= t) a = m; else b = m;
  }
  const p = points[a];
  const q = points[b];
  if (q.coupe) return p;
  const f = (t - p.t) / (q.t - p.t);
  return {t, x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, type: p.type};
}

/** Débordement du son d'un plan : avant (J-cut) et après (L-cut), en secondes. */
export const debordements = (it) => ({avant: Math.max(0, Number(it.son?.avant_s) || 0), apres: Math.max(0, Number(it.son?.apres_s) || 0)});
