// Dérush — moteur d'habillage : effets, titres, sous-titres et styles.
// Le MÊME fichier dessine l'aperçu dans l'app et la vidéo finale (kit Remotion) : ce qu'on voit est ce qu'on obtient.
// Aucune dépendance. Tout se calcule à partir du temps t (en secondes) : rien ne dépend d'une horloge.

const borner = (x, a, b) => Math.min(b, Math.max(a, x));
export const EASE = {
  lin: (x) => x,
  in3: (x) => x * x * x,
  out3: (x) => 1 - (1 - x) ** 3,
  outExp: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
  outBack: (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2,
};
/** Interpolation bornée : x parcourt xs (croissants), la valeur parcourt ys. */
export function entre(x, xs, ys, ease = EASE.lin) {
  const n = xs.length - 1;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n]) return ys[n];
  let i = 0;
  while (x > xs[i + 1]) i++;
  return ys[i] + (ys[i + 1] - ys[i]) * ease((x - xs[i]) / (xs[i + 1] - xs[i]));
}
/** Hasard reproductible (le même nombre pour la même image, à chaque rendu). */
const alea = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

// ——— Polices fournies avec Dérush (libres : OFL / Apache) ———
export const POLICES = {
  Anton: [[400, 'anton-400.woff2']],
  'Bebas Neue': [[400, 'bebas-neue-400.woff2']],
  'Archivo Black': [[400, 'archivo-black-400.woff2']],
  Montserrat: [[600, 'montserrat-600.woff2'], [800, 'montserrat-800.woff2']],
  Poppins: [[600, 'poppins-600.woff2'], [800, 'poppins-800.woff2']],
  'Playfair Display': [[800, 'playfair-display-800.woff2']],
  'Permanent Marker': [[400, 'permanent-marker-400.woff2']],
};
export const POLICES_TITRES = ['Anton', 'Bebas Neue', 'Archivo Black', 'Montserrat', 'Poppins', 'Playfair Display', 'Permanent Marker'];
const poidsFort = (famille) => Math.max(...(POLICES[famille] ?? [[800]]).map((p) => p[0]));
const JAPONAIS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';

// ——— Réseaux : zones recouvertes par leur interface (fractions de l'image) et repères de livraison ———
export const PLATEFORMES = {
  tiktok: {nom: 'TikTok', zones: {haut: 0.10, bas: 0.22, gauche: 0.05, droite: 0.14}, duree_max_s: 600},
  reels: {nom: 'Instagram Reels', zones: {haut: 0.08, bas: 0.20, gauche: 0.05, droite: 0.12}, duree_max_s: 180},
  shorts: {nom: 'YouTube Shorts', zones: {haut: 0.06, bas: 0.18, gauche: 0.05, droite: 0.12}, duree_max_s: 180},
  youtube: {nom: 'YouTube', zones: {haut: 0.05, bas: 0.05, gauche: 0.05, droite: 0.05}, duree_max_s: null},
  libre: {nom: 'Aucun réseau en particulier', zones: {haut: 0.05, bas: 0.05, gauche: 0.05, droite: 0.05}, duree_max_s: null},
};
/** Le réseau visé par défaut, d'après le format de la vidéo. */
export const plateformeParDefaut = (sortie) => (sortie.hauteur > sortie.largeur ? 'tiktok' : sortie.largeur > sortie.hauteur ? 'youtube' : 'libre');

// ——— Catalogue des effets ———
const texte = (nom, defaut = '', aide = '') => ({type: 'texte', nom, defaut, aide});
const choix = (nom, options, defaut) => ({type: 'choix', nom, options, defaut});
const nombre = (nom, defaut, min, max, unite = '') => ({type: 'nombre', nom, defaut, min, max, unite});
const bascule = (nom, defaut) => ({type: 'bascule', nom, defaut});
const FORCE = choix('Force', {doux: 'Doux', normal: 'Normal', fort: 'Fort'}, 'normal');
const BRUIT = bascule('Avec son', true);
const COULEUR = choix('Couleur', {blanc: 'Blanc', accent: 'Couleur du style', noir: 'Noir'}, 'blanc');
const K = {doux: 0.55, normal: 1, fort: 1.6};

export const CATEGORIES = {
  transition: {nom: 'Transitions', aide: 'À glisser sur une coupe entre deux plans.'},
  titre: {nom: 'Titres', aide: 'À glisser où tu veux : le texte se règle à droite.'},
  ambiance: {nom: 'Mouvements', aide: 'Sur un passage du montage.'},
  son: {nom: 'Bruitages', aide: 'Un son bref, à l’endroit où tu le poses.'},
};

/**
 * Chaque effet : nom, catégorie, durée par défaut (s) et réglages.
 * Une transition se cale sur une coupe : elle commence `avant` secondes avant et finit `apres` secondes après.
 */
export const CATALOGUE = {
  zoom: {nom: 'Coup de zoom', categorie: 'transition', avant: 0.1, apres: 0.35, description: 'Le plan suivant arrive en zoom, d’un coup.', reglages: {force: FORCE, son: BRUIT}},
  plongee: {nom: 'Plongée', categorie: 'transition', avant: 0.3, apres: 0.4, description: 'On fonce dans l’image, et on ressort dans le plan suivant.', reglages: {force: FORCE, son: BRUIT}},
  fouet: {nom: 'Fouet', categorie: 'transition', avant: 0.2, apres: 0.25, description: 'Un filé rapide, comme un coup de caméra.', reglages: {direction: choix('Direction', {haut: 'Vers le haut', bas: 'Vers le bas', gauche: 'Vers la gauche', droite: 'Vers la droite'}, 'haut'), son: BRUIT}},
  glitch: {nom: 'Glitch', categorie: 'transition', avant: 0.1, apres: 0.2, description: 'Les couleurs se décalent, l’image saute.', reglages: {force: FORCE, son: BRUIT}},
  flash: {nom: 'Flash', categorie: 'transition', avant: 0.07, apres: 0.3, description: 'Un éclair sur la coupe.', reglages: {couleur: choix('Couleur', {blanc: 'Blanc', accent: 'Couleur du style'}, 'blanc'), son: BRUIT}},
  fondu: {nom: 'Fondu au noir', categorie: 'transition', avant: 0.3, apres: 0.3, description: 'L’image s’éteint, puis se rallume.', reglages: {}},

  titre: {nom: 'Titre', categorie: 'titre', duree: 2.5, description: 'Un grand titre animé.', reglages: {
    texte: texte('Texte', 'TON TITRE'), sous_titre: texte('Petite ligne', '', 'Facultatif'),
    position: choix('Position', {haut: 'En haut', centre: 'Au centre', bas: 'En bas'}, 'centre'),
    animation: choix('Animation', {lettres: 'Lettre par lettre', pop: 'Pop', glisse: 'Glisse'}, 'lettres'),
    couleur: COULEUR, fond: choix('Fond', {aucun: 'Aucun', bandeau: 'Bandeau'}, 'aucun')}},
  'titre-derriere': {nom: 'Titre derrière la personne', categorie: 'titre', duree: 3, description: 'Le texte passe derrière la personne filmée (détourage automatique).', reglages: {
    texte: texte('Texte', 'SHIBUYA'), etiquette: texte('Étiquette', '', 'Petit mot sur fond de couleur, ex. 渋谷'), sous_titre: texte('Petite ligne', '', 'ex. TOKYO · JAPON'),
    hauteur: nombre('Hauteur dans l’image', 47, 12, 80, '%'), couleur: COULEUR, son: BRUIT}},
  lieu: {nom: 'Lieu', categorie: 'titre', duree: 2, description: 'Une pastille avec une épingle et un nom de lieu.', reglages: {
    texte: texte('Texte', 'NOM DU LIEU'), position: choix('Position', {'bas-gauche': 'En bas à gauche', 'haut-gauche': 'En haut à gauche'}, 'bas-gauche'), son: BRUIT}},
  fin: {nom: 'Carton de fin', categorie: 'titre', duree: 2.5, description: 'Le mot de la fin, sur un fond qui reste vivant.', reglages: {
    texte: texte('Texte', 'TON TITRE'), etiquette: texte('Étiquette', ''), sous_titre: texte('Petite ligne', ''), ligne: texte('Dernière ligne', '', 'ex. @compte, date, lieu'),
    fond: choix('Fond', {flou: 'L’image floutée', anime: 'Couleurs animées', noir: 'Noir'}, 'flou'), son: BRUIT}},

  'zoom-lent': {nom: 'Zoom lent', categorie: 'ambiance', duree: 3, description: 'L’image avance (ou recule) tout doucement.', reglages: {sens: choix('Sens', {avant: 'Vers l’avant', arriere: 'Vers l’arrière'}, 'avant'), force: FORCE}},
  secousse: {nom: 'Secousse', categorie: 'ambiance', duree: 0.6, description: 'L’image tremble.', reglages: {force: FORCE}},

  'son-souffle': {nom: 'Souffle qui monte', categorie: 'son', duree: 0.55, fichier: 'souffle.wav', description: 'Juste avant un moment fort.', reglages: {volume: nombre('Volume', 70, 0, 100, '%')}},
  'son-passage': {nom: 'Passage d’air', categorie: 'son', duree: 0.36, fichier: 'passage.wav', description: 'Un « whoosh » court.', reglages: {volume: nombre('Volume', 60, 0, 100, '%')}},
  'son-fouet': {nom: 'Fouet', categorie: 'son', duree: 0.2, fichier: 'fouet.wav', description: 'Un sifflement très bref.', reglages: {volume: nombre('Volume', 70, 0, 100, '%')}},
  'son-impact': {nom: 'Coup sourd', categorie: 'son', duree: 0.45, fichier: 'impact.wav', description: 'Une basse qui tombe.', reglages: {volume: nombre('Volume', 60, 0, 100, '%')}},
  'son-declic': {nom: 'Déclic', categorie: 'son', duree: 0.14, fichier: 'declic.wav', description: 'Un appareil photo.', reglages: {volume: nombre('Volume', 45, 0, 100, '%')}},
  'son-pop': {nom: 'Pop', categorie: 'son', duree: 0.09, fichier: 'pop.wav', description: 'Une petite bulle.', reglages: {volume: nombre('Volume', 50, 0, 100, '%')}},
  'son-glitch': {nom: 'Parasites', categorie: 'son', duree: 0.26, fichier: 'glitch.wav', description: 'Des parasites numériques.', reglages: {volume: nombre('Volume', 50, 0, 100, '%')}},
};
/** Durée d'un effet posé (s). */
export const dureeEffet = (modele) => { const d = CATALOGUE[modele]; return d ? d.duree ?? d.avant + d.apres : 1; };
/** Réglages complets d'un effet (valeurs par défaut + ce que la personne a changé). */
export function reglagesDe(modele, donnes = {}) {
  const r = {};
  for (const [k, p] of Object.entries(CATALOGUE[modele]?.reglages ?? {})) r[k] = donnes?.[k] ?? p.defaut;
  return r;
}
/** Ce que l'effet affiche dans la timeline ou dans une liste. */
export function resumeEffet(e) {
  const d = CATALOGUE[e.modele];
  if (!d) return e.modele ?? '';
  const t = e.reglages?.texte ?? d.reglages.texte?.defaut;
  return t ? `${d.nom} · ${t}` : d.nom;
}

// ——— Styles : l'habillage de tout le film, en un clic ———
export const STYLE_DEFAUT = {
  look: 'simple', accent: '#FFD400', police_titres: 'Anton', police_textes: 'Montserrat',
  sous_titres: {style: 'aucun', position: 'bas', majuscules: false},
  transition_auto: 'aucune', grain: 0, vignette: 0, bandes: false, barre: false, bruitages: true, plateforme: null,
};
export const LOOKS = {
  simple: {nom: 'Simple', description: 'Le montage tel quel. Les sous-titres s’ajoutent d’un clic (bouton Sous-titres).', style: {accent: '#FFD400', police_titres: 'Anton', sous_titres: {style: 'aucun', position: 'bas', majuscules: false}, transition_auto: 'aucune', grain: 0, vignette: 0, bandes: false, barre: false}},
  trend: {nom: 'Trend', description: 'Coup de zoom à chaque coupe, sous-titres mot à mot, un peu de grain.', style: {accent: '#FFD400', police_titres: 'Anton', sous_titres: {style: 'mot', position: 'bas', majuscules: true}, transition_auto: 'zoom', grain: 0.35, vignette: 0.3, bandes: false, barre: false}},
  voyage: {nom: 'Voyage', description: 'Filés entre les plans, grain et bords sombres, pas de sous-titres.', style: {accent: '#FFFFFF', police_titres: 'Anton', sous_titres: {style: 'aucun', position: 'bas', majuscules: false}, transition_auto: 'fouet', grain: 0.4, vignette: 0.45, bandes: false, barre: false}},
  podcast: {nom: 'Podcast', description: 'Sous-titres karaoké bien lisibles et barre de progression.', style: {accent: '#FFD400', police_titres: 'Archivo Black', sous_titres: {style: 'karaoke', position: 'bas', majuscules: false}, transition_auto: 'aucune', grain: 0, vignette: 0.2, bandes: false, barre: true}},
  cinema: {nom: 'Cinéma', description: 'Bandes noires, fondus, bords sombres, sous-titres classiques.', style: {accent: '#F2E6C8', police_titres: 'Playfair Display', sous_titres: {style: 'phrase', position: 'bas', majuscules: false}, transition_auto: 'fondu', grain: 0.3, vignette: 0.55, bandes: true, barre: false}},
  yabai: {nom: 'YABAÏ', description: 'La charte de l’association : rouge, Anton, karaoké.', style: {accent: '#E10600', police_titres: 'Anton', police_textes: 'Montserrat', sous_titres: {style: 'karaoke', position: 'bas', majuscules: false}, transition_auto: 'zoom', grain: 0.2, vignette: 0.25, bandes: false, barre: false}},
};
export const STYLES_SOUS_TITRES = {karaoke: 'Karaoké', mot: 'Mot à mot', phrase: 'Classique', aucun: 'Aucun'};
/** Le style complet d'un projet (ce qui manque prend la valeur par défaut). */
export function styleComplet(style = {}, sortie = null) {
  const s = {...STYLE_DEFAUT, ...style, sous_titres: {...STYLE_DEFAUT.sous_titres, ...(style?.sous_titres ?? {})}};
  if (!PLATEFORMES[s.plateforme]) s.plateforme = sortie ? plateformeParDefaut(sortie) : 'libre';
  if (!POLICES[s.police_titres]) s.police_titres = 'Anton';
  if (!POLICES[s.police_textes]) s.police_textes = 'Montserrat';
  return s;
}

// ——— Préparation : tout ce qui ne dépend pas du temps ———
function pivotDe(e, coupes) {
  const voulu = e.debut + (CATALOGUE[e.modele].avant ?? 0);
  let mieux = null;
  for (const c of coupes) if (c >= e.debut - 1e-6 && c <= e.fin + 1e-6 && (mieux == null || Math.abs(c - voulu) < Math.abs(mieux - voulu))) mieux = c;
  return mieux ?? voulu;
}

/**
 * Prépare l'état que le moteur dessine.
 * sortie {largeur, hauteur, fps} · duree (s) · coupes [temps des coupes] · effets [{id, modele, debut, fin, reglages}]
 * style · mots [{t, debut, fin, plan, evenement?}] (temps du montage) · sansSousTitres [id des plans déjà sous-titrés]
 */
export function preparerEtat({sortie, duree, coupes = [], effets = [], style = {}, mots = [], sansSousTitres = []}) {
  const st = styleComplet(style, sortie);
  const fps = sortie.fps;
  const liste = [];
  for (const e of effets) {
    const d = CATALOGUE[e.modele];
    if (!d) continue;
    const x = {id: e.id, modele: e.modele, categorie: d.categorie, debut: e.debut, fin: Math.max(e.fin, e.debut + 1 / fps), r: reglagesDe(e.modele, e.reglages)};
    if (d.categorie === 'transition') x.pivot = pivotDe(x, coupes);
    liste.push(x);
  }
  // la transition du style : sur chaque coupe qui n'a pas déjà la sienne
  const auto = CATALOGUE[st.transition_auto]?.categorie === 'transition' ? CATALOGUE[st.transition_auto] : null;
  if (auto) {
    const prises = liste.filter((x) => x.categorie === 'transition').map((x) => x.pivot);
    coupes.forEach((c, i) => {
      if (c <= 1e-6 || c >= duree - 1e-6 || prises.some((p) => Math.abs(p - c) < 0.5 / fps)) return;
      liste.push({id: `auto-${i}`, auto: true, modele: st.transition_auto, categorie: 'transition', debut: c - auto.avant, fin: c + auto.apres, pivot: c, r: reglagesDe(st.transition_auto)});
    });
  }
  liste.sort((a, b) => a.debut - b.debut);
  const etat = {sortie, fps, duree, coupes, style: st, effets: liste, mots, sansSousTitres: new Set(sansSousTitres)};
  etat.sons = sonsDe(etat);
  etat.lignes = lignesSousTitres(etat);
  return etat;
}

/** Les bruitages à jouer : [{t, fichier, volume}] (ceux que l'on a posés, et ceux des transitions et des titres). */
function sonsDe(etat) {
  const sons = [];
  const ok = etat.style.bruitages !== false;
  const ajouter = (t, fichier, volume) => { if (t < etat.duree && volume > 0) sons.push({t: Math.max(0, t), fichier, volume: borner(volume, 0, 1)}); };
  for (const e of etat.effets) {
    const d = CATALOGUE[e.modele];
    const k = e.auto ? 0.7 : 1;
    if (d.categorie === 'son') { ajouter(e.debut, d.fichier, e.r.volume / 100); continue; }
    if (!ok || e.r.son === false) continue;
    if (e.modele === 'zoom') ajouter(e.pivot - 0.14, 'passage.wav', 0.5 * k);
    if (e.modele === 'plongee') { ajouter(e.pivot - 0.55, 'souffle.wav', 0.75 * k); ajouter(e.pivot, 'impact.wav', 0.5 * k); }
    if (e.modele === 'fouet') ajouter(e.pivot - 0.07, 'fouet.wav', 0.75 * k);
    if (e.modele === 'glitch') ajouter(e.pivot - 0.06, 'glitch.wav', 0.45 * k);
    if (e.modele === 'flash') ajouter(e.pivot - 0.02, 'declic.wav', 0.4 * k);
    if (e.modele === 'titre-derriere') ajouter(e.debut + 7 / etat.fps, 'impact.wav', 0.55);
    if (e.modele === 'lieu') ajouter(e.debut, 'pop.wav', 0.4);
    if (e.modele === 'fin') ajouter(e.debut, 'impact.wav', 0.5);
  }
  return sons.sort((a, b) => a.t - b.t);
}

/** Les sous-titres découpés en lignes courtes, selon le style choisi. */
function lignesSousTitres(etat) {
  const mode = etat.style.sous_titres.style;
  if (mode === 'aucun') return [];
  const lignes = [];
  let l = null;
  const maxMots = mode === 'mot' ? 1 : mode === 'karaoke' ? 3 : 9;
  const maxLettres = mode === 'phrase' ? 46 : 99;
  for (const w of etat.mots) {
    if (w.evenement || etat.sansSousTitres.has(w.plan)) continue;
    const t = String(w.t ?? '').trim();
    if (!t) continue;
    const dernier = l?.mots.at(-1);
    const colle = dernier && (/['’]$/.test(dernier.t) || /^['’]/.test(t) || /^-\p{L}/u.test(t)); // « l’ » reste avec le mot suivant, « ’un » et « -ce » avec le précédent
    const nouvelle = !l || (!colle && (l.mots.length >= maxMots || l.lettres + t.length > maxLettres || w.debut - l.fin > 0.4 || w.plan !== l.plan || /[.!?…]$/.test(dernier.t) || (mode !== 'phrase' && /,$/.test(dernier.t))));
    if (nouvelle) {
      if (l) lignes.push(l);
      l = {debut: w.debut, fin: w.fin, plan: w.plan, lettres: t.length, mots: [{t, debut: w.debut, fin: w.fin}]};
    } else {
      l.mots.push({t, debut: w.debut, fin: w.fin});
      l.fin = w.fin;
      l.lettres += t.length + 1;
    }
  }
  if (l) lignes.push(l);
  // une ligne reste à l'écran un court instant après son dernier mot, sans déborder sur la suivante
  lignes.forEach((x, i) => {
    const coupe = etat.coupes.find((c) => c >= x.fin - 1e-6) ?? Infinity; // jamais sur le plan suivant
    x.jusque = Math.max(x.fin, Math.min(x.fin + 0.25, lignes[i + 1]?.debut ?? Infinity, coupe));
  });
  return lignes;
}

// ——— Mouvement de l'image au temps t (transitions, zooms, secousses) ———
/**
 * Ce que l'image fait au temps t.
 * echelle, tx, ty (pixels de la sortie), rot (degrés) : à appliquer au conteneur des plans et des titres ;
 * flouZoom, flouFile {px, angle}, rvb (pixels) : effets d'optique sur la vidéo ;
 * flou (pixels), sombre (0–1) : pour le fond d'un carton de fin ; flash {a, couleur}, noir (0–1) : voiles par-dessus.
 */
export function mouvementA(etat, t) {
  const {fps, sortie} = etat;
  const m = {echelle: 1, tx: 0, ty: 0, rot: 0, flouZoom: 0, flouFile: {px: 0, angle: 0}, rvb: 0, flou: 0, sombre: 0, flash: {a: 0, couleur: '#fff'}, noir: 0};
  for (const e of etat.effets) {
    if (t < e.debut - 0.6 || t > e.fin + 0.6) continue;
    const k = K[e.r.force] ?? 1;
    if (e.categorie === 'transition') {
      const f = (t - e.pivot) * fps; // images depuis la coupe (négatif avant)
      if (e.modele === 'zoom' && f >= 0 && f < 8) {
        m.echelle *= entre(f, [0, 7], [1 + 0.13 * k, 1], EASE.out3);
        m.flouZoom += entre(f, [0, 4], [32 * k, 0]);
      } else if (e.modele === 'plongee') {
        if (f >= -8 && f < 0) {
          m.echelle *= entre(f, [-8, -1], [1, 1 + 0.32 * k], EASE.in3);
          m.flouZoom += entre(f, [-7, -1], [0, 80 * k]);
          const a = entre(f, [-8, -1], [0, 9 * k]);
          m.tx += Math.sin(t * fps * 1.9) * a;
          m.ty += Math.cos(t * fps * 2.7) * a;
        } else if (f >= 0 && f < 10) {
          m.echelle *= entre(f, [0, 9], [1 + 0.28 * k, 1], EASE.outExp);
          m.flouZoom += entre(f, [0, 6], [60 * k, 0]);
          m.rvb += entre(f, [0, 7], [16 * k, 0]);
        }
      } else if (e.modele === 'fouet' && f >= -6 && f < 7) {
        const [dx, dy] = {haut: [0, -1], bas: [0, 1], gauche: [-1, 0], droite: [1, 0]}[e.r.direction] ?? [0, -1];
        const taille = dx ? sortie.largeur : sortie.hauteur;
        const glisse = f < 0 ? entre(f, [-6, -1], [0, 0.06], EASE.in3) : entre(f, [0, 6], [-0.06, 0], EASE.out3);
        m.tx += dx * glisse * taille;
        m.ty += dy * glisse * taille;
        m.echelle *= 1 + 0.14 * entre(f, [-6, -1, 0, 6], [0, 1, 1, 0]);
        m.flouFile = {px: Math.max(m.flouFile.px, entre(f, [-6, -1, 0, 6], [0, 36, 32, 0])), angle: dx ? 0 : 90};
        m.rvb += entre(f, [-1, 2, 6], [0, 7, 0]);
      } else if (e.modele === 'glitch' && f >= -3 && f < 6) {
        const n = Math.round(t * fps);
        m.rvb += entre(f, [-3, 0, 5], [4, 16, 0]) * k;
        m.tx += (alea(n) - 0.5) * 36 * k * entre(f, [-3, 0, 5], [0.4, 1, 0]);
        m.echelle *= 1.03;
      } else if (e.modele === 'flash' && f >= -2 && f < 8) {
        m.flash = {a: Math.max(m.flash.a, f < 0 ? entre(f, [-2, 0], [0, 0.35]) : entre(f, [0, 7], [0.6, 0], EASE.out3)), couleur: e.r.couleur === 'accent' ? etat.style.accent : '#fff'};
      } else if (e.modele === 'fondu' && f >= -9 && f < 9) {
        m.noir = Math.max(m.noir, f < 0 ? entre(f, [-9, -1], [0, 1]) : entre(f, [0, 8], [1, 0]));
      }
      continue;
    }
    if (t < e.debut || t >= e.fin) continue;
    if (e.modele === 'zoom-lent') {
      const a = 1 + 0.08 * k;
      m.echelle *= e.r.sens === 'arriere' ? entre(t, [e.debut, e.fin], [a, 1]) : entre(t, [e.debut, e.fin], [1, a]);
    } else if (e.modele === 'secousse') {
      const a = 12 * k * Math.sin(Math.PI * entre(t, [e.debut, e.fin], [0, 1]));
      m.tx += Math.sin(t * fps * 1.9) * a;
      m.ty += Math.cos(t * fps * 2.7) * a;
      m.echelle *= 1 + 0.02 * k;
    } else if (e.modele === 'titre-derriere') {
      // le titre « tape » l'image quand il se pose
      const f = (t - e.debut) * fps;
      const choc = entre(f, [7, 13], [7, 0]) * (f >= 7 ? 1 : 0);
      m.tx += Math.sin(t * fps * 3.1) * choc;
      m.ty += Math.cos(t * fps * 2.3) * choc;
    } else if (e.modele === 'fin' && e.r.fond === 'flou') {
      const f = (t - e.debut) * fps;
      m.flou = Math.max(m.flou, entre(f, [0, 12], [26, 14], EASE.out3));
      m.sombre = Math.max(m.sombre, entre(f, [0, 8], [0, 0.5]));
      m.echelle *= entre(t, [e.debut, e.fin], [1.06, 1.16]);
    }
  }
  return m;
}
/** Le titre « derrière la personne » actif au temps t (l'hôte dessine alors la personne détourée par-dessus). */
export const decoupeA = (etat, t) => etat.effets.find((e) => e.modele === 'titre-derriere' && t >= e.debut && t < e.fin) ?? null;

// ——— Dessin : titres, sous-titres, voiles ———
let policesDemandees = null;
let policesPretes = false;
/** Déclare les polices fournies (une seule fois). `urlBase` : dossier qui contient polices/. */
export function chargerPolices(urlBase = '') {
  if (policesDemandees || typeof document === 'undefined') return policesDemandees ?? Promise.resolve();
  const css = Object.entries(POLICES).flatMap(([famille, variantes]) => variantes.map(([poids, fichier]) =>
    `@font-face{font-family:"${famille}";font-weight:${poids};font-style:normal;font-display:block;src:url("${urlBase}/polices/${fichier}") format("woff2")}`)).join('\n');
  const s = document.createElement('style');
  s.dataset.derush = 'polices';
  s.textContent = css;
  document.head.append(s);
  policesDemandees = Promise.all(Object.entries(POLICES).flatMap(([famille, variantes]) => variantes.map(([poids]) => document.fonts.load(`${poids} 40px "${famille}"`))))
    .catch(() => {}).then(() => { policesPretes = true; });
  return policesDemandees;
}

let toile = null;
/** Largeur d'un texte à 100 px de corps (pour ajuster la taille à la place disponible). */
function largeur100(txt, famille, poids, espacementEm = 0) {
  toile ??= document.createElement('canvas').getContext('2d');
  toile.font = `${poids} 100px "${famille}"`;
  return toile.measureText(txt).width + espacementEm * 100 * Math.max(0, [...txt].length - 1);
}
const el = (style = {}, html = null, tag = 'div') => {
  const x = document.createElement(tag);
  Object.assign(x.style, style);
  if (html != null) x.innerHTML = html;
  return x;
};
const px = (v) => `${Math.round(v * 100) / 100}px`;
const echapper = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const couleurDe = (nom, style) => (nom === 'accent' ? style.accent : nom === 'noir' ? '#0b0b0f' : '#ffffff');
/** Noir ou blanc, selon ce qui se lit le mieux sur cette couleur. */
function contraste(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '');
  if (!m) return '#fff';
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#0b0b0f' : '#fff';
}
/** Coupe un titre trop long en deux lignes équilibrées (un retour à la ligne tapé est respecté). */
function lignesTitre(txt) {
  const t = String(txt ?? '').trim();
  if (t.includes('\n')) return t.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 3);
  if (t.length <= 16 || !t.includes(' ')) return [t];
  const mots = t.split(/\s+/);
  let mieux = [t];
  let ecart = Infinity;
  for (let i = 1; i < mots.length; i++) {
    const a = mots.slice(0, i).join(' ');
    const b = mots.slice(i).join(' ');
    if (Math.abs(a.length - b.length) < ecart) { ecart = Math.abs(a.length - b.length); mieux = [a, b]; }
  }
  return mieux;
}
/** La zone où le texte reste lisible sur le réseau visé (en pixels de la sortie). */
function zoneSure(env) {
  const z = PLATEFORMES[env.style.plateforme]?.zones ?? PLATEFORMES.libre.zones;
  return {x0: env.L * (z.gauche + 0.01), x1: env.L * (1 - z.droite), y0: env.H * z.haut, y1: env.H * (1 - z.bas)};
}
/** Un bloc de lettres animables : renvoie l'élément et la liste de ses lettres. */
function blocLettres(lignes, style) {
  const bloc = el({whiteSpace: 'nowrap', textAlign: 'center', ...style});
  const lettres = [];
  for (const ligne of lignes) {
    const l = el({display: 'block'});
    for (const c of [...ligne]) {
      const s = el({display: 'inline-block', whiteSpace: 'pre', willChange: 'transform, opacity'}, echapper(c), 'span');
      l.append(s);
      if (c.trim()) lettres.push(s);
    }
    bloc.append(l);
  }
  return {bloc, lettres};
}
/** Entrée lettre par lettre : chaque lettre monte, se précise et apparaît, l'une après l'autre. */
function entreeLettres(lettres, f, taille, pas = 1) {
  lettres.forEach((s, i) => {
    const d = i * pas;
    s.style.opacity = entre(f, [d, d + 4], [0, 1]);
    s.style.transform = `translateY(${px(entre(f, [d, d + 7], [taille * 0.5, 0], EASE.out3))})`;
    const b = entre(f, [d, d + 6], [taille * 0.05, 0]);
    s.style.filter = b > 0.3 ? `blur(${px(b)})` : 'none';
  });
}

const FABRIQUES = {
  titre(e, env) {
    const {L, H, style, fps} = env;
    const r = e.r;
    const z = zoneSure(env);
    const famille = style.police_titres;
    const poids = poidsFort(famille);
    const lignes = lignesTitre(r.texte);
    const dispo = (z.x1 - z.x0) * 0.98;
    const taille = Math.min(L * 0.26, H * 0.15, dispo / (Math.max(1, ...lignes.map((x) => largeur100(x, famille, poids, 0.01))) / 100));
    const bandeau = r.fond === 'bandeau';
    const couleur = bandeau ? contraste(style.accent) : couleurDe(r.couleur, style);
    const racine = el({position: 'absolute', left: px(z.x0), width: px(z.x1 - z.x0), display: 'flex', flexDirection: 'column', alignItems: 'center'});
    const {bloc, lettres} = blocLettres(lignes, {fontFamily: `"${famille}"`, fontWeight: poids, fontSize: px(taille), lineHeight: 1.02, letterSpacing: '0.01em', color: couleur,
      textShadow: bandeau ? 'none' : `0 ${px(taille * 0.045)} ${px(taille * 0.16)} rgba(0,0,0,.5)`, padding: bandeau ? `${px(taille * 0.1)} ${px(taille * 0.22)}` : '0', background: bandeau ? style.accent : 'none', borderRadius: bandeau ? px(taille * 0.08) : '0'});
    racine.append(bloc);
    let petit = null;
    if (r.sous_titre?.trim()) {
      petit = el({marginTop: px(taille * 0.16), fontFamily: `"${style.police_textes}"`, fontWeight: 800, fontSize: px(Math.max(L * 0.026, taille * 0.14)), letterSpacing: '0.3em', color: '#fff', textShadow: '0 3px 14px rgba(0,0,0,.65)', textAlign: 'center', whiteSpace: 'nowrap'}, echapper(r.sous_titre.trim()));
      racine.append(petit);
    }
    const hauteurBloc = taille * 1.02 * lignes.length + (bandeau ? taille * 0.2 : 0) + (petit ? taille * 0.4 : 0);
    const y = r.position === 'haut' ? z.y0 + H * 0.035 : r.position === 'bas' ? z.y1 - H * 0.1 - hauteurBloc : (z.y0 + z.y1) / 2 - hauteurBloc / 2;
    racine.style.top = px(y);
    return {couche: 'milieu', el: racine, maj(tl, duree) {
      const f = tl * fps;
      const reste = (duree - tl) * fps;
      racine.style.opacity = entre(reste, [0, 5], [0, 1]);
      if (r.animation === 'pop') {
        bloc.style.opacity = entre(f, [0, 3], [0, 1]);
        bloc.style.transform = `scale(${entre(f, [0, 9], [0.55, 1], EASE.outBack)})`;
      } else if (r.animation === 'glisse') {
        bloc.style.clipPath = `inset(0 ${entre(f, [0, 10], [100, 0], EASE.out3)}% 0 0)`;
        bloc.style.transform = `translateX(${px(entre(f, [0, 10], [-L * 0.06, 0], EASE.out3))})`;
      } else entreeLettres(lettres, f, taille, lettres.length > 16 ? 0.5 : 1);
      if (petit) {
        petit.style.opacity = entre(f, [6, 12], [0, 1]);
        petit.style.transform = `translateY(${px(entre(f, [6, 13], [taille * 0.12, 0], EASE.out3))})`;
      }
    }};
  },

  'titre-derriere'(e, env) {
    const {L, H, style, fps} = env;
    const r = e.r;
    const z = zoneSure(env);
    const famille = style.police_titres;
    const poids = poidsFort(famille);
    const lignes = lignesTitre(r.texte).slice(0, 2);
    const dispo = z.x1 - z.x0;
    const taille = Math.min(L * 0.3, H * 0.17, dispo / (Math.max(1, ...lignes.map((x) => largeur100(x, famille, poids, 0.01))) / 100));
    const couleur = couleurDe(r.couleur, style);
    const racine = el({position: 'absolute', left: 0, top: 0, width: px(L), height: px(H)});
    const hautTitre = H * (r.hauteur / 100) - (taille * 1.0 * lignes.length) / 2;
    const {bloc, lettres} = blocLettres(lignes, {position: 'absolute', left: px(z.x0), width: px(dispo), top: px(hautTitre), fontFamily: `"${famille}"`, fontWeight: poids, fontSize: px(taille), lineHeight: 1, letterSpacing: '0.01em', color: couleur, transformOrigin: '50% 50%'});
    racine.append(bloc);
    const corps = Math.max(L * 0.028, taille * 0.11);
    let etiquette = null;
    let petit = null;
    if (r.etiquette?.trim()) {
      etiquette = el({position: 'absolute', left: px(z.x0 + L * 0.02), top: px(hautTitre - corps * 2.3), background: style.accent, color: contraste(style.accent), fontFamily: `"${style.police_textes}", ${JAPONAIS}`, fontWeight: 800, fontSize: px(corps * 1.5), padding: `${px(corps * 0.14)} ${px(corps * 0.46)} ${px(corps * 0.2)}`, borderRadius: px(corps * 0.2), whiteSpace: 'nowrap'}, echapper(r.etiquette.trim()));
      racine.append(etiquette);
    }
    if (r.sous_titre?.trim()) {
      petit = el({position: 'absolute', right: px(L - z.x1 + L * 0.01), top: px(hautTitre - corps * 1.75), color: '#fff', fontFamily: `"${style.police_textes}"`, fontWeight: 800, fontSize: px(corps), letterSpacing: '0.32em', textShadow: '0 3px 14px rgba(0,0,0,.6)', whiteSpace: 'nowrap'}, echapper(r.sous_titre.trim()));
      racine.append(petit);
    }
    const ombre = `0 ${px(taille * 0.045)} ${px(taille * 0.16)} rgba(0,0,0,.45), 0 0 ${px(taille * 0.1)} rgba(255,255,255,.22)`;
    return {couche: 'derriere', el: racine, maj(tl, duree) {
      const f = tl * fps;
      const reste = (duree - tl) * fps;
      entreeLettres(lettres, f, taille * 1.03);
      const sortie = reste < 8; // le titre repart en « glitch »
      const d = sortie ? entre(reste, [0, 8], [taille * 0.06, taille * 0.012]) : 0;
      const n = Math.round(tl * fps);
      const clignote = sortie && (Math.round(reste) === 4 || Math.round(reste) === 2) ? 0.35 : 1;
      bloc.style.opacity = clignote;
      bloc.style.transform = `translateX(${px(sortie ? Math.sin(n * 7) * d : 0)}) scale(${entre(f, [0, 8], [1.18, 1], EASE.out3) * entre(tl, [0, duree], [1, 1.02])})`;
      bloc.style.textShadow = sortie ? `${px(d)} 0 0 rgba(255,0,80,.85), ${px(-d)} 0 0 rgba(0,230,255,.85), ${ombre}` : ombre;
      if (etiquette) {
        etiquette.style.opacity = entre(f, [9, 14], [0, clignote]);
        etiquette.style.transform = `translateX(${px(entre(f, [9, 16], [-L * 0.04, 0], EASE.out3))})`;
      }
      if (petit) {
        petit.style.opacity = entre(f, [11, 16], [0, clignote]);
        petit.style.transform = `translateX(${px(entre(f, [11, 18], [L * 0.04, 0], EASE.out3))})`;
      }
    }};
  },

  lieu(e, env) {
    const {L, H, style, fps} = env;
    const z = zoneSure(env);
    const corps = L * 0.028;
    // en bas, la pastille se place au-dessus des sous-titres quand il y en a
    const bas = style.sous_titres.style !== 'aucun' && style.sous_titres.position !== 'centre' ? z.y1 - H * 0.165 : z.y1 - H * 0.09;
    const racine = el({position: 'absolute', left: px(z.x0 + L * 0.01), top: px(e.r.position === 'haut-gauche' ? z.y0 + H * 0.025 : bas), display: 'flex', alignItems: 'center', gap: px(corps * 0.45),
      padding: `${px(corps * 0.4)} ${px(corps * 0.75)} ${px(corps * 0.4)} ${px(corps * 0.55)}`, borderRadius: '999px', background: 'rgba(0,0,0,.5)', color: '#fff', fontFamily: `"${style.police_textes}"`, fontWeight: 800, fontSize: px(corps), letterSpacing: '0.08em', whiteSpace: 'nowrap'},
    `<svg width="${corps * 0.86}" height="${corps * 1.13}" viewBox="0 0 26 34"><path d="M13 1C6.4 1 1 6.3 1 12.9 1 22 13 33 13 33s12-11 12-20.1C25 6.3 19.6 1 13 1z" fill="${style.accent}"/><circle cx="13" cy="12.6" r="4.6" fill="${contraste(style.accent)}"/></svg><span>${echapper(e.r.texte)}</span>`);
    return {couche: 'milieu', el: racine, maj(tl, duree) {
      const f = tl * fps;
      racine.style.opacity = Math.min(entre(f, [0, 3], [0, 1]), entre((duree - tl) * fps, [0, 4], [0, 1]));
      racine.style.transform = `translateX(${px(entre(f, [0, 6], [-L * 0.03, 0], EASE.out3))})`;
    }};
  },

  fin(e, env) {
    const {L, H, style, fps, etat} = env;
    const r = e.r;
    const famille = style.police_titres;
    const poids = poidsFort(famille);
    const lignes = lignesTitre(r.texte);
    const taille = Math.min(L * 0.24, H * 0.14, (L * 0.8) / (Math.max(1, ...lignes.map((x) => largeur100(x, famille, poids, 0.02))) / 100));
    const corps = Math.max(L * 0.03, taille * 0.14);
    const racine = el({position: 'absolute', left: 0, top: 0, width: px(L), height: px(H), overflow: 'hidden'});
    const fond = el({position: 'absolute', inset: 0});
    const voile = el({position: 'absolute', inset: 0, background: r.fond === 'flou' ? 'linear-gradient(180deg, rgba(0,0,0,.25) 0%, rgba(0,0,0,.05) 45%, rgba(0,0,0,.4) 100%)' : 'none'});
    const centre = el({position: 'absolute', left: 0, top: px(-H * 0.03), width: px(L), height: px(H), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'});
    let etiquette = null;
    if (r.etiquette?.trim()) {
      etiquette = el({background: style.accent, color: contraste(style.accent), fontFamily: `"${style.police_textes}", ${JAPONAIS}`, fontWeight: 800, fontSize: px(corps * 1.35), padding: `${px(corps * 0.12)} ${px(corps * 0.45)} ${px(corps * 0.18)}`, borderRadius: px(corps * 0.18), marginBottom: px(corps * 0.5), whiteSpace: 'nowrap'}, echapper(r.etiquette.trim()));
      centre.append(etiquette);
    }
    const {bloc, lettres} = blocLettres(lignes, {fontFamily: `"${famille}"`, fontWeight: poids, fontSize: px(taille), lineHeight: 1.02, letterSpacing: '0.02em', color: '#fff', textShadow: `0 ${px(taille * 0.05)} ${px(taille * 0.2)} rgba(0,0,0,.5)`});
    centre.append(bloc);
    const petit = r.sous_titre?.trim() ? el({marginTop: px(corps * 0.75), fontFamily: `"${style.police_textes}"`, fontWeight: 800, fontSize: px(corps), letterSpacing: '0.42em', color: '#fff', whiteSpace: 'nowrap'}, echapper(r.sous_titre.trim())) : null;
    const ligne = r.ligne?.trim() ? el({marginTop: px(corps * 0.5), fontFamily: `"${style.police_textes}"`, fontWeight: 600, fontSize: px(corps * 0.74), letterSpacing: '0.24em', color: 'rgba(255,255,255,.75)', whiteSpace: 'nowrap'}, echapper(r.ligne.trim())) : null;
    if (petit) centre.append(petit);
    if (ligne) centre.append(ligne);
    const noir = el({position: 'absolute', inset: 0, background: '#000', opacity: 0});
    racine.append(fond, voile, centre, noir);
    const jusquAuBout = e.fin >= etat.duree - 1.5 / fps;
    return {couche: 'devant', el: racine, maj(tl, duree) {
      const f = tl * fps;
      if (r.fond === 'noir') fond.style.background = '#000';
      else if (r.fond === 'anime') {
        // des nappes de couleur qui dérivent lentement : jamais une image fixe
        const a = tl * 0.9;
        const p = (cx, cy, ray, c) => `radial-gradient(circle at ${cx}% ${cy}%, ${c} 0%, transparent ${ray}%)`;
        fond.style.background = [p(30 + 22 * Math.sin(a), 32 + 18 * Math.cos(a * 0.8), 55, style.accent), p(72 + 18 * Math.cos(a * 0.7), 70 + 16 * Math.sin(a * 1.1), 60, '#2b3cff'), p(50 + 30 * Math.sin(a * 0.5 + 2), 50 + 24 * Math.cos(a * 0.6 + 1), 45, '#ff3d81')].join(',') + ', #07070c';
        fond.style.filter = `saturate(.9) brightness(${0.5 + 0.06 * Math.sin(a * 2)})`;
      }
      fond.style.opacity = r.fond === 'flou' ? 0 : entre(f, [0, 6], [0, 1]);
      if (etiquette) {
        etiquette.style.opacity = entre(f, [2, 7], [0, 1]);
        etiquette.style.transform = `scale(${entre(f, [2, 9], [0.7, 1], EASE.out3)})`;
      }
      lettres.forEach((s, i) => {
        const d = 3 + i * 1.5;
        s.style.opacity = entre(f, [d, d + 4], [0, 1]);
        s.style.transform = `translateY(${px(entre(f, [d, d + 8], [taille * 0.36, 0], EASE.out3))})`;
      });
      if (petit) petit.style.opacity = entre(f, [16, 22], [0, 1]);
      if (ligne) ligne.style.opacity = entre(f, [20, 27], [0, 1]);
      noir.style.opacity = jusquAuBout ? entre((duree - tl) * fps, [1, 9], [1, 0]) : 0;
      if (!jusquAuBout) racine.style.opacity = entre((duree - tl) * fps, [0, 6], [0, 1]);
    }};
  },
};

/**
 * Crée l'habillage dans trois calques posés par l'hôte :
 *   derriere — sous la personne détourée (titre « derrière ») ; milieu — avec l'image (titres, lieux) ;
 *   devant — par-dessus tout, sans bouger avec l'image (sous-titres, grain, carton de fin, voiles).
 * `maj(etat, t)` dessine le temps t. Les calques ont la taille de la sortie, en pixels.
 */
export function creerHabillage({derriere, milieu, devant, urlBase = ''}) {
  chargerPolices(urlBase).then(() => { cleGlobale = ''; });
  const couches = {derriere, milieu, devant};
  const objets = new Map();
  let cleGlobale = '';
  let fixes = null;
  let ligneVue = null;
  let dernier = null;

  function construireFixes(env) {
    const {L, H} = env;
    for (const c of Object.values(couches)) { c.innerHTML = ''; Object.assign(c.style, {position: 'absolute', left: '0', top: '0', width: px(L), height: px(H), pointerEvents: 'none', overflow: 'hidden'}); }
    objets.clear();
    ligneVue = null;
    const plein = {position: 'absolute', left: 0, top: 0, width: px(L), height: px(H)};
    fixes = {
      vignette: el({...plein, background: 'radial-gradient(ellipse 78% 62% at 50% 48%, rgba(0,0,0,0) 52%, rgba(0,0,0,1) 100%)'}),
      grain: el({...plein, mixBlendMode: 'overlay'}, `<svg width="${L}" height="${H}" viewBox="0 0 ${L / 2} ${H / 2}" preserveAspectRatio="none"><filter id="dg" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="1"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#dg)"/></svg>`),
      bandeHaut: el({position: 'absolute', left: 0, top: 0, width: px(L), background: '#000'}),
      bandeBas: el({position: 'absolute', left: 0, bottom: 0, width: px(L), background: '#000'}),
      sousTitres: el({position: 'absolute', left: 0, width: px(L), display: 'flex', justifyContent: 'center'}),
      effets: el(plein),
      barre: el({position: 'absolute', left: 0, top: 0, height: px(Math.max(6, H * 0.006)), background: env.style.accent}),
      flash: el({...plein, opacity: 0}),
      noir: el({...plein, background: '#000', opacity: 0}),
    };
    fixes.turbulence = fixes.grain.querySelector('feTurbulence');
    devant.append(fixes.vignette, fixes.grain, fixes.bandeHaut, fixes.bandeBas, fixes.sousTitres, fixes.effets, fixes.barre, fixes.flash, fixes.noir);
  }

  function majSousTitres(etat, env, t) {
    const {L, H, style} = env;
    const box = fixes.sousTitres;
    const st = style.sous_titres;
    // recherche de la ligne active (les lignes sont triées)
    let l = null;
    for (const x of etat.lignes) { if (x.debut > t) break; if (t < x.jusque) l = x; }
    if (!l) { if (ligneVue) { box.innerHTML = ''; ligneVue = null; } return; }
    const vertical = H > L;
    const z = zoneSure(env);
    if (l !== ligneVue) {
      ligneVue = l;
      const maj = (s) => (st.majuscules ? s.toLocaleUpperCase('fr-FR') : s).replace(/'/g, '’');
      const famille = st.style === 'phrase' ? style.police_textes : style.police_titres === 'Playfair Display' || style.police_titres === 'Permanent Marker' ? style.police_textes : style.police_titres;
      const poids = st.style === 'phrase' ? 600 : poidsFort(famille);
      const corps = st.style === 'mot' ? L * 0.105 : st.style === 'phrase' ? L * (vertical ? 0.046 : 0.032) : L * (vertical ? 0.07 : 0.045);
      const largeurMax = z.x1 - z.x0;
      // pas d'espace autour d'une apostrophe ni avant une virgule ou un point (« j’ai », « tous, »)
      const sep = (i) => (i === 0 || /^['’,.…)\]%]/.test(l.mots[i].t) || /^-\p{L}/u.test(l.mots[i].t) || /['’(\[]$/.test(l.mots[i - 1].t) ? '' : ' ');
      const txt = l.mots.map((w, i) => sep(i) + maj(w.t)).join('');
      const ajuste = Math.min(corps, (st.style === 'phrase' ? Infinity : largeurMax / (largeur100(txt, famille, poids) / 100)));
      const trait = Math.max(2, ajuste * 0.085);
      const style0 = st.style === 'phrase'
        ? {fontFamily: `"${famille}"`, fontWeight: poids, fontSize: px(ajuste), lineHeight: 1.25, color: '#fff', background: 'rgba(0,0,0,.62)', padding: `${px(ajuste * 0.28)} ${px(ajuste * 0.6)}`, borderRadius: px(ajuste * 0.3), maxWidth: px(largeurMax), textAlign: 'center', textWrap: 'balance'}
        : {fontFamily: `"${famille}"`, fontWeight: poids, fontSize: px(ajuste), lineHeight: 1.08, color: '#fff', textAlign: 'center', whiteSpace: 'nowrap', WebkitTextStroke: `${px(trait)} #000`, paintOrder: 'stroke fill', textShadow: `0 ${px(ajuste * 0.07)} ${px(ajuste * 0.28)} rgba(0,0,0,.55)`, letterSpacing: st.style === 'mot' ? '0.01em' : '0'};
      const ligne = el(style0, l.mots.map((w, i) => `${sep(i)}<span>${echapper(maj(w.t))}</span>`).join(''));
      box.innerHTML = '';
      box.append(ligne);
      box.style.left = px(z.x0);
      box.style.width = px(largeurMax);
      // au-dessus des boutons du réseau (en vertical), ou au centre si demandé
      if (st.position === 'centre') { box.style.top = px(H * 0.5 - ajuste * 0.6); box.style.bottom = ''; } else { box.style.bottom = px(vertical ? Math.max(H * 0.25, H - z.y1 + H * 0.02) : H * 0.08); box.style.top = ''; }
    }
    const ligne = box.firstChild;
    const spans = ligne.children;
    if (st.style === 'karaoke') l.mots.forEach((w, i) => { spans[i].style.color = t >= w.debut ? style.accent : '#fff'; });
    if (st.style === 'mot') {
      const f = (t - l.debut) * etat.fps;
      ligne.style.transform = `scale(${entre(f, [0, 3], [0.82, 1], EASE.out3)})`;
      ligne.style.color = '#fff';
    }
  }

  function maj(etat, t) {
    const L = etat.sortie.largeur;
    const H = etat.sortie.hauteur;
    const style = etat.style;
    const env = {L, H, fps: etat.fps, style, etat};
    const cle = `${L}x${H}|${policesPretes}|${style.accent}|${style.police_titres}|${style.police_textes}|${style.plateforme}|${JSON.stringify(style.sous_titres)}`;
    if (cle !== cleGlobale || !fixes) { cleGlobale = cle; construireFixes(env); }
    if (etat !== dernier) { ligneVue = null; fixes.sousTitres.innerHTML = ''; dernier = etat; }

    // effets visibles
    const vus = new Set();
    for (const e of etat.effets) {
      const fab = FABRIQUES[e.modele];
      if (!fab || t < e.debut - 1e-9 || t >= e.fin) continue;
      const cleObjet = `${e.modele}|${e.debut}|${e.fin}|${JSON.stringify(e.r)}`;
      let o = objets.get(e.id);
      if (!o || o.cle !== cleObjet) {
        o?.el.remove();
        o = fab(e, env);
        o.cle = cleObjet;
        (o.couche === 'devant' ? fixes.effets : couches[o.couche]).append(o.el);
        objets.set(e.id, o);
      }
      o.maj(t - e.debut, e.fin - e.debut);
      vus.add(e.id);
    }
    for (const [id, o] of objets) if (!vus.has(id)) { o.el.remove(); objets.delete(id); }

    // tout le film : sous-titres, grain, bords sombres, bandes, barre
    majSousTitres(etat, env, t);
    fixes.vignette.style.opacity = borner(style.vignette, 0, 1) * 0.55;
    const g = borner(style.grain, 0, 1);
    fixes.grain.style.display = g > 0.01 ? '' : 'none';
    if (g > 0.01) { fixes.grain.style.opacity = g * 0.28; fixes.turbulence.setAttribute('seed', String(1 + (Math.round(t * etat.fps) % 17))); }
    const bande = style.bandes ? Math.max(0, (H - L / (H > L ? 0.78 : 2.39)) / 2) : 0;
    fixes.bandeHaut.style.height = fixes.bandeBas.style.height = px(bande);
    fixes.barre.style.display = style.barre ? '' : 'none';
    fixes.barre.style.width = px(L * borner(t / Math.max(1e-6, etat.duree), 0, 1));
    fixes.barre.style.background = style.accent;

    // voiles des transitions
    const m = mouvementA(etat, t);
    fixes.flash.style.opacity = m.flash.a;
    fixes.flash.style.background = m.flash.couleur;
    fixes.noir.style.opacity = m.noir;
    return m;
  }

  return {maj, invalider() { cleGlobale = ''; }};
}
