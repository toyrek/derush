// Dérush — interface. Aucune dépendance : tout tient dans ce fichier (le moteur d'habillage, partagé avec le rendu, est dans moteur.js).
import {
  FORMATS, CADENCES, GENRES_BLOC, GENRES_INDICATION, EXT_MEDIAS, LANGUES, tc, lireTemps, versImage, surGrille, sequence, segmentA,
  motsEntre, texteDesMots, dureeLisible, nouvelId, borner, arrondi, fpsSource, fenetreCadrage, pointCadrage, debordements,
  TYPES_VIDEO, MODES, formatProche,
} from '/commun.js';
import {
  CATALOGUE, CATEGORIES, LOOKS, PLATEFORMES, POLICES_TITRES, STYLES_SOUS_TITRES, creerHabillage, decoupeA, preparerEtat, reglagesDe, resumeEffet, styleComplet,
} from '/moteur.js';
import {creerPublication} from '/publication.js';
import {creerTutoriel} from '/tuto.js';
import {creerCreateur} from '/createur.js';

const JETON = document.querySelector('meta[name="derush-jeton"]').content;
// Chaque fenêtre a son identifiant : le serveur sait laquelle est la principale, et quand la dernière se ferme.
const FENETRE = crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const ic = (nom, cls = '') => `<svg class="ic ${cls}"><use href="#i-${nom}"/></svg>`;
const DPR = () => window.devicePixelRatio || 1;
// Dans l'app Mac native (outils/coque-mac.swift), la page parle à sa fenêtre : la boîte « Ouvrir » du Mac, le Dock,
// la couleur de la barre de titre. Ailleurs (fenêtre de Chrome, Windows, Linux), ces appels ne font rien.
const NATIF = !!(window.__derushNatif && window.webkit?.messageHandlers?.derush);
const natif = (a, d = {}) => { if (NATIF) { try { window.webkit.messageHandlers.derush.postMessage({a, ...d}); } catch { /* fenêtre fermée */ } } };
const demanderNatif = (a, d = {}) => window.webkit.messageHandlers.derushDemande.postMessage({a, ...d});
document.documentElement.classList.toggle('natif', NATIF);
/** Copie un texte dans le presse-papiers (par la fenêtre native quand elle est là). */
async function copierTexte(texte) {
  if (NATIF) return natif('copier', {texte});
  try { await navigator.clipboard.writeText(texte); } catch {
    const z = Object.assign(document.createElement('textarea'), {value: texte});
    document.body.append(z);
    z.select();
    document.execCommand('copy');
    z.remove();
  }
}
/**
 * La fenêtre « Ouvrir » de l'ordinateur. Dans l'app native elle est attachée à la fenêtre de Dérush ; sinon le serveur
 * ouvre celle du système. Renvoie {chemins} ou {indisponible}.
 */
async function choisirSurOrdinateur(usage = null) {
  if (!NATIF) return api('POST', '/api/choisir', usage ? {usage} : undefined);
  const r = await api('POST', '/api/choisir', {usage, natif: true});
  if (!r.natif) return r;
  return {chemins: await demanderNatif('choisir', {invite: r.natif.invite, depart: r.natif.depart, plusieurs: true})};
}
// l'adresse d'un média porte la clé du projet : le « M1 » d'un projet n'est jamais confondu avec celui d'un autre
const urlMedia = (id, quoi) => `/media/${id}/${quoi}?j=${JETON}&p=${ui.cleProjet ?? ''}`;

async function api(methode, url, corps) {
  if (ui.remplacee) throw new Error('Cette fenêtre est en pause.');
  let r;
  try {
    r = await fetch(url, {
      method: methode,
      headers: {'x-derush-jeton': JETON, 'x-derush-fenetre': FENETRE, ...(corps !== undefined ? {'content-type': 'application/json'} : {})},
      body: corps !== undefined ? JSON.stringify(corps) : undefined,
    });
  } catch (e) {
    voileArret('arret'); // plus de réponse : Dérush s'est arrêté
    throw e;
  }
  const j = await r.json().catch(() => ({}));
  if (r.status === 409 && j.remplacee) mettreEnPause();
  else if (r.status === 403 && /jeton/i.test(j.erreur ?? '')) voileArret('relance'); // Dérush a redémarré entre-temps
  if (!r.ok) throw new Error(j.erreur || `Erreur ${r.status}`);
  return j;
}

/** Un voile sur toute la fenêtre quand elle ne peut plus travailler : Dérush arrêté, redémarré, ou ouvert ailleurs. */
function voileArret(type) {
  if ($('#voile-arret') || (fenetreSignalee && type !== 'ailleurs')) return;
  const [titre, texte, bouton, action] = {
    arret: ['Dérush s’est arrêté', 'Ton travail est enregistré. Double-clique sur « Dérush » sur le Bureau pour le rouvrir.', 'Fermer cette fenêtre', () => window.close()],
    relance: ['Dérush a redémarré', 'Ton travail est enregistré. Recharge la fenêtre pour reprendre là où tu en étais.', 'Recharger', () => location.reload()],
    ailleurs: ['Dérush est ouvert dans une autre fenêtre', 'Ton travail est enregistré. Cette fenêtre se met en pause pour ne rien écraser.', 'Fermer cette fenêtre', () => window.close()],
  }[type];
  const v = document.createElement('div');
  v.id = 'voile-arret';
  v.innerHTML = `<div class="carte-arret" role="alertdialog" aria-labelledby="voile-titre" aria-describedby="voile-texte">
    <h2 id="voile-titre">${esc(titre)}</h2><p id="voile-texte">${esc(texte)}</p><button class="btn principal grand">${esc(bouton)}</button></div>`;
  v.querySelector('button').onclick = action;
  document.body.append(v);
  v.querySelector('button').focus();
  for (const el of $$('video, audio')) el.pause();
}

/** Une autre fenêtre a pris la main : celle-ci n'écrit plus rien, se met en pause et se ferme. */
function mettreEnPause() {
  if (ui.enPause) return;
  ui.enPause = ui.remplacee = true;
  clearTimeout(minuterie);
  signalerFermeture();
  voileArret('ailleurs');
  setTimeout(() => window.close(), 300);
}

// ——— État ———
let SRV = {moteurs: {}, file: null};
let P = null;
let seq = {segs: [], duree: 0, images: 0, fps: 30};
const ui = {
  mode: 'montage', sel: null, blocIA: null, reglagesIA: [], multi: new Set(), outil: 'selection', pressePapiers: null, texteVue: 'montage', panneau: 'medias', pps: 60, cadre: true, glisseMedia: null,
  annuler: [], refaire: [], src: {id: null, entree: null, sortie: null, vue0: 0, vue1: 1},
  texteSpans: null, texteDedans: [], motCourant: null, trouve: null, exportTache: null, retours: [], editeurPret: false,
  habiller: 'style', vue: 'montage', versionVue: null, claude: null, brouillon: '', depart: null, clipsVus: null,
};
const C = {ondes: new Map(), mots: new Map(), analyse: new Map(), cadrage: new Map(), sprites: new Map(), attente: new Map()};
const media = (id) => P?.medias.find((m) => m.id === id);
const item = (id) => P.montage.find((it) => it.id === id);
const indication = (id) => P.indications.find((i) => i.id === id);
const dessus = (id) => P.superpositions.find((s) => s.id === id);
const fpsSrc = (m) => fpsSource(m, P);
const F = () => P.sortie.fps;
const ratioSortie = () => P.sortie.largeur / P.sortie.hauteur;

// ——— Petites aides ———
function note(texte, erreur = false, fete = false) {
  const n = document.createElement('div');
  n.className = `note${erreur ? ' erreur' : ''}${fete ? ' fete' : ''}`;
  n.innerHTML = `${ic(erreur ? 'attention' : fete ? 'etincelle' : 'ok', fete ? 'plein' : '')}<span>${esc(texte)}</span>`;
  $('#notes').append(n);
  setTimeout(() => n.remove(), erreur || fete ? 7000 : 3500);
}
function bulle(ev, texte) {
  const b = $('#bulle');
  b.textContent = texte;
  b.classList.remove('cache');
  b.style.left = `${ev.clientX + 14}px`;
  b.style.top = `${ev.clientY - 40}px`;
}
const bulleCacher = () => $('#bulle').classList.add('cache');
const ilYa = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('fr-FR', {day: 'numeric', month: 'long'});
};
/** La version de la planche de vignettes d'un rush : provisoire (une image, puis les images clés), puis exacte. */
const cleVignettes = (v) => `${v.n}${v.provisoire ? 'p' : ''}${v.v ?? ''}`;
function styleVignette(m, t, H) {
  const v = m.vignettes;
  if (!v) return '';
  const k = borner(Math.round(t / v.pas), 0, v.n - 1);
  const L = (v.l * H) / v.h;
  return `background-image:url('${urlMedia(m.id, 'vignettes')}&n=${cleVignettes(v)}');background-size:${v.n * L}px ${H}px;background-position:${-k * L}px 0;width:${L}px;height:${H}px`;
}
function anneau(p) {
  const r = 6;
  const c = 2 * Math.PI * r;
  return `<svg class="anneau" viewBox="0 0 16 16"><circle class="fond-a" cx="8" cy="8" r="${r}"/><circle class="avance" cx="8" cy="8" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - borner(p, 0, 1))}"/></svg>`;
}

/** Charge (une fois) les ondes, le texte, l'analyse ou le recadrage d'un rush. */
function charger(type, m) {
  const map = C[type];
  if (map.has(m.id)) return Promise.resolve(map.get(m.id));
  const dispo = type === 'mots' ? !!m.transcription : m.etapes?.[type] === true;
  if (!dispo) {
    map.set(m.id, null);
    return Promise.resolve(null);
  }
  const cle = type + m.id;
  if (!C.attente.has(cle)) {
    C.attente.set(cle, fetch(urlMedia(m.id, type)).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
      C.attente.delete(cle);
      const v = type === 'mots' ? (j?.mots ?? null) : type === 'cadrage' ? (j?.points ?? null) : j;
      map.set(m.id, v);
      return v;
    }));
  }
  return C.attente.get(cle);
}
function oublier(id) {
  for (const k of ['ondes', 'mots', 'analyse', 'cadrage', 'sprites']) C[k].delete(id);
}
function sprite(m) {
  if (!m.vignettes) return null;
  let img = C.sprites.get(m.id);
  if (!img) {
    img = new Image();
    img.onload = () => dessinerBande();
    img.src = `${urlMedia(m.id, 'vignettes')}&n=${cleVignettes(m.vignettes)}`;
    C.sprites.set(m.id, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

// ——— Feuilles (fenêtres) ———
function feuille(html, large = false) {
  // nouvel élément à chaque fois : les écouteurs d'une fenêtre précédente ne doivent pas s'accumuler
  const ancien = $('#feuille');
  const f = ancien.cloneNode(false);
  ancien.replaceWith(f);
  f.className = `feuille${large ? ' large' : ''}`;
  f.innerHTML = html;
  $('#voile').classList.remove('cache');
  return f;
}
function fermerFeuille() {
  $('#voile').classList.add('cache');
  $('#feuille').innerHTML = '';
}
$('#voile').addEventListener('pointerdown', (e) => { if (e.target.id === 'voile') fermerFeuille(); });
const feuilleOuverte = () => !$('#voile').classList.contains('cache');
/** Une fenêtre ou un écran posé par-dessus l'éditeur (« Avant de publier », le tutoriel) : les raccourcis du montage attendent. */
const ecranOuvert = () => feuilleOuverte() || !!document.querySelector('.pub-atelier, .tuto');

// =====================================================================
// Bibliothèque
// =====================================================================
async function afficherBibliotheque() {
  ui.ecran = 'biblio';
  arreterLecture();
  $('#ecran-montage').classList.add('cache');
  const B = $('#ecran-biblio');
  B.classList.remove('cache');
  document.title = 'Dérush';
  natif('teinte', {couleur: '#121214'});
  natif('progression', {p: null});
  let d;
  try { d = await api('GET', '/api/bibliotheque'); } catch (e) { return note(e.message, true); }
  const format = (k) => FORMATS[k]?.ratio ?? '';
  B.innerHTML = `<div class="biblio-interieur">
    <div class="biblio-tete"><img src="/icone.svg" alt=""><div><h1 class="marque">Dérush <small>par</small> <img class="iabai" src="/marque/iabai.png" alt="IABAI"></h1><p>Tu donnes la matière. Ton IA fait le montage. <span class="beta">Bêta privée</span></p></div><span class="espace"></span>
      <button class="btn bouton-cx" data-b="connexions" title="Ton IA, ElevenLabs, Google Drive, Treg, Blender">${logo('claude', 18)}${logo('codex', 18)}${logo('gemini', 18)}${logo('treg', 18)}<span>Connexions</span></button>
      <button class="btn bouton-cx" data-b="profil" title="Mon profil de créateur : ce que ton IA a appris de tes comptes">${ic('profil')}<span>Mon profil</span></button>
      <button class="btn bouton-cx" data-b="accueil" title="Mise en route : ton IA, tes réseaux, ton profil">${ic('drapeau')}<span>Mise en route</span></button>
      <button class="icone-btn" data-b="tutoriel" title="Revoir le tutoriel">${ic('aide')}</button>
      <button class="icone-btn" data-b="reglages" title="Réglages et moteurs">${ic('reglages')}</button>
      <button class="icone-btn" data-b="quitter" title="Quitter Dérush">${ic('quitter')}</button></div>
    ${d.projets.length < 3 ? `<div class="biblio-guide">${guideGestes()}</div>` : ''}
    <div class="grille-projets">
      <div class="nouveau-projet" data-b="nouveau"><div><div class="plus">${ic('plus')}</div><b>Nouveau projet</b></div></div>
      ${d.projets.map((p) => `<div class="projet" data-dossier="${esc(p.dossier)}">
        <div class="affiche"${p.affiche ? ` style="background-image:url('/affiche?dossier=${encodeURIComponent(p.dossier)}&j=${JETON}')"` : ''}>${p.affiche ? '' : ic('film')}</div>
        <div class="infos"><b>${esc(p.titre)}</b><span>${p.plans} plan${p.plans > 1 ? 's' : ''} · ${tc(p.duree, 30).slice(3, 8)} · ${format(p.format)} · ${ilYa(p.modifie_le)}</span></div>
        <div class="menu-projet"><button data-b="finder" title="Afficher le dossier du projet">Dossier</button><button data-b="corbeille" title="Mettre à la corbeille">Corbeille</button></div>
      </div>`).join('')}
    </div>
    <div class="biblio-pied">${ic('dossier')}<span>Projets rangés dans ${esc(d.racine)}</span><span class="espace"></span><button class="btn petit" data-b="autre">Ouvrir un autre dossier…</button></div>
  </div>`;
  // première ouverture : le tutoriel animé, puis la mise en route (ton IA, tes réseaux, ton profil), une fois
  if (!SRV.reglages?.tuto_vu && !ui.tutoMontre) return tutoriel(true);
  proposerConnexions();
}
/** La mise en route s'ouvre une fois, depuis la bibliothèque : à la première ouverture, ou tant qu'aucune IA n'est branchée. */
function proposerConnexions() {
  if (ui.cxMontree) return;
  ui.cxMontree = true;
  if (!SRV.reglages?.accueil_vu) { if (ui.ecran === 'biblio' && !ecranOuvert()) CR.accueil({premiere: true}); return; }
  api('GET', '/api/connexions').then((x) => { if (!x.claude?.ok && !x.codex?.ok && !x.gemini?.ok && ui.ecran === 'biblio' && !ecranOuvert()) CR.accueil(); }).catch(() => {});
}
$('#ecran-biblio').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-b]')?.dataset.b;
  const carte = e.target.closest('.projet');
  if (b === 'nouveau') return feuilleNouveauProjet();
  if (b === 'connexions') return feuilleConnexions();
  if (b === 'profil') return CR.ouvrir();
  if (b === 'accueil') return CR.accueil();
  if (b === 'reglages') return feuilleReglages();
  if (b === 'tutoriel') return tutoriel();
  if (b === 'quitter') return quitter();
  if (b === 'autre') {
    if (!NATIF) return feuilleParcourir({dossiers: true});
    const [dossier] = await demanderNatif('choisir', {dossiers: true, invite: 'Choisis le dossier d’un projet Dérush (ou un dossier vide pour en créer un).'}).catch(() => []);
    return dossier ? ouvrirProjet(dossier) : null;
  }
  if (carte && b === 'corbeille') {
    if (!confirm('Mettre ce projet à la corbeille ? Tes rushes d’origine ne sont pas touchés.')) return;
    try { await api('POST', '/api/projets/corbeille', {dossier: carte.dataset.dossier}); note('Projet mis à la corbeille.'); afficherBibliotheque(); } catch (err) { note(err.message, true); }
    return;
  }
  if (carte && b === 'finder') return api('POST', '/api/ouvrir', {chemin: carte.dataset.dossier}).catch((err) => note(err.message, true));
  if (carte) ouvrirProjet(carte.dataset.dossier);
});
async function ouvrirProjet(dossier) {
  try {
    await api('POST', '/api/projets/ouvrir', {dossier});
    await demarrerEditeur();
  } catch (e) { note(e.message, true); }
}
function tuilesFormat(actif, avecAuto = false) {
  return `<div class="formats">${avecAuto ? `<div class="format${actif === 'auto' ? ' actif' : ''}" data-format="auto"><div class="forme auto"></div><b>Auto</b><span>Comme ta vidéo</span></div>` : ''}${Object.entries(FORMATS).map(([k, f]) => {
    const h = 54;
    const w = Math.round((h * f.largeur) / f.hauteur);
    return `<div class="format${k === actif ? ' actif' : ''}" data-format="${k}"><div class="forme" style="width:${Math.min(w, 96)}px;height:${w > 96 ? Math.round(96 * f.hauteur / f.largeur) : h}px"></div><b>${f.ratio}</b><span>${esc(f.nom.replace(/^.*?\(|\)$/g, '').replace(/^(Vertical|Horizontal|Carré|Portrait) /, ''))}</span></div>`;
  }).join('')}</div>`;
}
/** Le dessin de chaque mode de création (voir MODES dans commun.mjs). */
const DESSINS_MODE = {montage: 'claude', motion: 'motion', extraits: 'extraits', son: 'son'};
const TITRES_MODE = {montage: 'Nouveau montage', motion: 'Nouvelle animation', extraits: 'Mes extraits', son: 'Nouveau clip'};
const modeProjet = () => (MODES[P?.mode] ? P.mode : 'montage');
function feuilleNouveauProjet() {
  let format = 'auto';
  let genre = 'trend';
  let mode = 'montage';
  const f = feuille(`<h3>Nouveau projet</h3><p class="sous-titre">Choisis comment tu veux créer. Tu pourras changer de mode ensuite, dans le brief.</p>
    <div class="modes">${Object.entries(MODES).map(([k, v]) => `<button class="mode-carte${k === mode ? ' actif' : ''}" data-mode="${k}">${ill(DESSINS_MODE[k])}<b>${esc(v.nom)}</b><small>${esc(v.description)}</small></button>`).join('')}</div>
    <label class="champ"><span>Nom</span><input id="np-titre" value="${TITRES_MODE[mode]}"></label>
    <div class="champ" id="np-genre"><span>Genre de vidéo</span><div class="types-video">${Object.entries(TYPES_VIDEO).map(([k, v]) => `<button class="type-video${k === genre ? ' actif' : ''}" data-genre="${k}"><b>${esc(v.nom)}</b><small>${esc(v.description)}</small></button>`).join('')}</div></div>
    <div class="champ"><span>Format</span>${tuilesFormat(format, true)}</div>
    <div class="pied"><button class="btn" data-f="annuler">Annuler</button><button class="btn principal" data-f="creer">Créer</button></div>`, true);
  const champ = $('#np-titre', f);
  champ.select();
  f.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-format]');
    if (t) { format = t.dataset.format; $$('.format', f).forEach((x) => x.classList.toggle('actif', x === t)); }
    const g = e.target.closest('[data-genre]');
    if (g) { genre = g.dataset.genre; $$('.type-video', f).forEach((x) => x.classList.toggle('actif', x === g)); }
    const m = e.target.closest('[data-mode]');
    if (m) {
      // le nom proposé suit le mode, tant qu'on ne l'a pas écrit soi-même
      if (Object.values(TITRES_MODE).includes(champ.value.trim())) champ.value = TITRES_MODE[m.dataset.mode];
      mode = m.dataset.mode;
      $$('.mode-carte', f).forEach((x) => x.classList.toggle('actif', x === m));
      // le genre de vidéo ne sert qu'avec de la vidéo à monter
      $('#np-genre', f).classList.toggle('cache', mode === 'motion' || mode === 'son');
    }
    const a = e.target.closest('[data-f]')?.dataset.f;
    if (a === 'annuler') fermerFeuille();
    if (a === 'creer') {
      try {
        await api('POST', '/api/projets', {titre: champ.value.trim() || TITRES_MODE[mode]});
        const g2 = mode === 'motion' ? 'explication' : mode === 'son' ? 'libre' : genre;
        const look = TYPES_VIDEO[g2]?.look ?? 'simple';
        // « Auto » suit la première vidéo : sans vidéo (motion design), on part en vertical
        const sortie = format !== 'auto' ? {preset: format, fps: 30, auto: false} : mode === 'motion' ? {preset: 'vertical', fps: 30, auto: false} : {auto: true, fps: 30};
        await api('PUT', '/api/projet', {mode, sortie, brief: {type: g2},
          // le style du genre, mais sans sous-titres : ils ne se mettent que si on les demande (bouton Sous-titres)
          style: {...LOOKS[look].style, look, sous_titres: {...LOOKS[look].style.sous_titres, style: 'aucun'}}});
        fermerFeuille();
        await demarrerEditeur();
        if (mode === 'motion') montrerClaude(true); else feuilleImporter();
      } catch (err) { note(err.message, true); }
    }
  });
  champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') f.querySelector('[data-f="creer"]').click(); });
}
async function quitter() {
  if (NATIF) return natif('quitter');
  if (SRV.file?.en_cours && !confirm('Un traitement est en cours. Quitter quand même ?')) return;
  try { await sauver(true); } catch { /* rien */ }
  await api('POST', '/api/quitter').catch(() => {});
  document.body.innerHTML = '<div style="height:100%;display:grid;place-items:center;color:#a1a1a8;font:15px -apple-system,system-ui">Dérush est fermé. Tu peux fermer cette fenêtre.</div>';
  setTimeout(() => window.close(), 400);
}

// =====================================================================
// Éditeur
// =====================================================================
async function demarrerEditeur() {
  const e = await api('GET', '/api/etat');
  SRV = e;
  completerMoteurs();
  if (e.mode !== 'projet') return afficherBibliotheque();
  P = e.projet;
  P.superpositions ??= [];
  P.references ??= [];
  P.style ??= {};
  seq = sequence(P);
  invaliderEtat();
  ui.ecran = 'montage';
  natif('teinte', {couleur: '#1c1c1f'});
  ui.sel = null;
  ui.annuler = [];
  ui.refaire = [];
  ui.src = {id: null, entree: null, sortie: null, vue0: 0, vue1: 1};
  Object.assign(ui, {blocIA: null, reglagesIA: [], claude: null, vue: 'montage', versionVue: null, videoVue: 0, depart: null, brouillon: '', clipsVus: null, clEchanges: null, directAuto: null, studio: null, studioForm: {}, studioType: prefs.lire('studio.type', 'musique'), voix: null, ecoute: null});
  ECOUTE.pause();
  DIRECT.file = [];
  DIRECT.rendu = null;
  for (const id of ['#piste-claude', '#p-creer']) { $(id).dataset.cle = ''; $(id).innerHTML = ''; }
  $('#direct').classList.add('cache');
  $('#direct-img').removeAttribute('src');
  delete $('#direct-img').dataset.src;
  $('#direct-attente').innerHTML = `${ill('bobine')}<b>L’IA prépare</b>Son rendu apparaîtra ici, image par image, dès qu’elle le lancera.`;
  // on change de projet : le lecteur oublie les vidéos, les images et les détourages du précédent
  ui.cleProjet = [...String(e.racine ?? '')].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7).toString(36);
  for (const v of [...PV, vDessus, vRush, aSon]) { v.pause(); v.removeAttribute('src'); delete v.dataset.media; v.load(); }
  for (const s of ['#i-fixe', '#i-fixe-m']) { $(s).removeAttribute('src'); delete $(s).dataset.src; }
  MASQUES.clear();
  for (const k of ['ondes', 'mots', 'analyse', 'cadrage', 'sprites']) C[k].clear();
  $('#ecran-biblio').classList.add('cache');
  const ed = $('#ecran-montage');
  ed.classList.remove('cache', 'arrive', 'claude-travaille', 'avec-claude');
  void ed.offsetWidth; // l'éditeur arrive en quatre morceaux, à chaque ouverture
  ed.classList.add('arrive');
  clearTimeout(ui.finArrivee);
  ui.finArrivee = setTimeout(() => ed.classList.remove('arrive'), 1100);
  for (const id of ['#claude', '#vide']) { $(id).dataset.cle = ''; $(id).innerHTML = ''; }
  const vc = $('#v-claude');
  vc.pause();
  vc.removeAttribute('src');
  vc.dataset.nom = '';
  vc.classList.add('cache');
  $('#visionneuse').classList.remove('vue-claude');
  $('#vue-switch').classList.add('cache');
  $('#titre-projet').value = P.titre;
  document.title = `${P.titre} — Dérush`;
  ui.pps = ppsDepuisZoom(Number($('#zoom').value));
  ui.mode = 'montage';
  ui.modeFixe = false;
  rendreBarre();
  rendreRushes();
  rendrePanneauIA();
  rendreTimeline();
  rendreInspecteur();
  rendreTexte();
  majTaches();
  choisirPanneau('medias');
  // le premier média est chargé en coulisse (pour l'onglet Texte), sans quitter le montage
  if (P.medias.length) chargerRush((P.medias.find((m) => m.transcription) ?? P.medias[0]).id, null, null, false);
  if (seq.duree > 0) toutVoir();
  majScene();
  progAfficher();
  definirMode('montage');
  verifierDetourages();
  chargerRetours();
  chargerClaude();
  etatSauvegarde('');
  appliquerFormatAuto();
}
function afficherVide() {
  const v = $('#vide');
  if (ui.mode === 'montage' && !seq.segs.length && ui.vue === 'montage') {
    const mode = modeProjet();
    const cle = `${P.medias.length ? 'medias' : 'rien'}-${mode}`;
    if (v.dataset.cle !== cle) {
      v.dataset.cle = cle;
      const sansMatiere = {
        motion: `<div><p class="guide-titre">Tu décris, <em>ton IA anime</em></p><p class="guide-sous">Pas besoin de vidéo. Dis le sujet, les mots à afficher, la durée et le style.</p>
          <div class="guide">${geste('motion', '01', 'Décris', 'Le sujet, le texte, la durée. Joins ton logo ou ta charte.')}${FLECHE}${geste('claude', '02', 'Elle crée', 'Recherches, plan, animation, son : tu suis en direct.')}${FLECHE}${geste('coupe', '03', 'Tu règles', 'Chaque titre, effet et son apparaît dans la timeline.')}</div>
          <div class="guide-actions"><button class="btn claude" data-a="claude">${ic('etincelle', 'plein')}<span>Décrire mon animation</span></button></div></div>`,
        extraits: `<div><p class="guide-titre">Une longue vidéo, <em>plusieurs clips</em></p><p class="guide-sous">Dépose ta vidéo ou ton podcast en entier : ton IA trouve les meilleurs moments et fait un clip de chacun.</p>
          <div class="guide">${geste('rushes', '01', 'Dépose', 'La vidéo entière, sans rien couper.')}${FLECHE}${geste('extraits', '02', 'Elle choisit', 'Les passages forts, un clip par idée.')}${FLECHE}${geste('claude', '03', 'Tu publies', 'Chaque clip a son titre et ses sous-titres.')}</div>
          <div class="guide-actions"><button class="btn principal" data-a="importer">${ic('plus')}Importer</button></div></div>`,
        son: `<div><p class="guide-titre">Un son, <em>une vidéo</em></p><p class="guide-sous">Dépose ta musique, ta voix ou ton podcast : ton IA crée les images qui vont avec.</p>
          <div class="guide">${geste('son', '01', 'Dépose', 'Le son, tel quel.')}${FLECHE}${geste('motion', '02', 'Elle anime', 'Des images calées sur le rythme ou sur les mots.')}${FLECHE}${geste('claude', '03', 'Tu règles', 'Demande une retouche, un autre style.')}</div>
          <div class="guide-actions"><button class="btn principal" data-a="importer">${ic('plus')}Importer</button></div></div>`,
      }[mode];
      v.innerHTML = !P.medias.length && sansMatiere ? sansMatiere : P.medias.length
        ? `<div><p class="guide-titre">Deux façons <em>d’avancer</em></p><p class="guide-sous">Tes médias sont là. À toi de voir jusqu’où tu veux aller.</p>
          <div class="guide">${geste('coupe', '', 'Je choisis', 'Glisse un média dans la timeline en bas, ou clique sur son <b>+</b>. Puis coupe et supprime ce qui est en trop.')}
          ${geste('claude', '', 'Ton IA choisit', 'Ne coupe rien. Écris ce que tu veux : elle garde les meilleurs passages et monte la vidéo.', `<button class="btn claude" data-a="claude">${ic('etincelle', 'plein')}<span>Demander à l’IA</span></button>`)}</div>
          <p class="guide-sous" style="margin:16px 0 0;font-size:12px">Pour un podcast : onglet <b>Texte</b>, glisse sur des phrases, puis « Ajouter au montage ».</p></div>`
        : `<div><p class="guide-titre">Trois gestes, <em>une vidéo</em></p><p class="guide-sous">Tu donnes la matière. Ton IA fait le montage.</p>${guideGestes()}
          <div class="guide-actions"><button class="btn principal" data-a="importer">${ic('plus')}Importer</button></div></div>`;
    }
    v.classList.remove('cache');
  } else v.classList.add('cache');
}

// ——— Sauvegarde et annulation ———
let minuterie = null;
function etatSauvegarde(t, erreur = false) {
  const s = $('#sauvegarde');
  s.textContent = t;
  s.classList.toggle('erreur', erreur);
}
function sauver(immediat = false) {
  if (!P) return Promise.resolve();
  clearTimeout(minuterie);
  const go = async () => {
    try {
      await api('PUT', '/api/projet', {titre: P.titre, langue: P.langue, brief: P.brief, sortie: P.sortie, export: P.export, montage: P.montage, superpositions: P.superpositions, indications: P.indications, compteurs: P.compteurs, style: P.style});
      etatSauvegarde('Enregistré');
      if (ui.claude?.atelier && !ui.claude.en_cours) chargerClaude();
    } catch (e) {
      etatSauvegarde(`Non enregistré : ${e.message}`, true);
    }
  };
  if (immediat) return go();
  etatSauvegarde('Enregistrement…');
  minuterie = setTimeout(go, 450);
  return Promise.resolve();
}
const instantane = () => JSON.stringify({montage: P.montage, superpositions: P.superpositions, indications: P.indications, compteurs: P.compteurs, style: P.style ?? {}});
let derniereModif = {cle: null, t: 0};
function memoriser(cle = null) {
  const t = Date.now();
  if (!(cle && cle === derniereModif.cle && t - derniereModif.t < 1500)) {
    ui.annuler.push(instantane());
    if (ui.annuler.length > 300) ui.annuler.shift();
    ui.refaire = [];
  }
  derniereModif = {cle, t};
}
/** Toute modification du montage passe par ici : annulable, enregistrée, réaffichée. */
function modifier(fn, {cle = null, inspecteur = true} = {}) {
  memoriser(cle);
  fn();
  apresModif(inspecteur);
}
function apresModif(inspecteur = true) {
  seq = sequence(P);
  reancrer();
  invaliderEtat();
  verifierSelection();
  rendreTimeline();
  if (inspecteur) rendreInspecteur();
  rendreBarre();
  rendreRushes();
  if (!prog.lecture) progAfficher();
  dessinerBande();
  afficherVide();
  if (ui.panneau === 'texte' && ui.texteVue === 'montage') rendreTexte();
  if (ui.panneau === 'habiller' && ui.habiller === 'style') rendrePanneauStyle();
  if (ui.vue !== 'montage') montrerVue('montage'); // on retouche le montage : le lecteur le montre à nouveau
  verifierDetourages();
  sauver();
}
function annuler(sens = 1) {
  const de = sens > 0 ? ui.annuler : ui.refaire;
  const vers = sens > 0 ? ui.refaire : ui.annuler;
  const s = de.pop();
  if (!s) return note(sens > 0 ? 'Rien à annuler.' : 'Rien à rétablir.');
  vers.push(instantane());
  Object.assign(P, JSON.parse(s));
  derniereModif = {cle: null, t: 0};
  apresModif();
}
function verifierSelection() {
  const s = ui.sel;
  if (!s) return;
  if ((s.type === 'item' && !item(s.id)) || (s.type === 'indic' && !indication(s.id)) || (s.type === 'dessus' && !dessus(s.id))) ui.sel = null;
}
function selectionner(sel) {
  if (ui.blocIA) { ui.blocIA = null; rendreBlocsIA(); }
  ui.sel = sel;
  ui.multi.clear();
  $$('.clip.sel, .indic.sel, .dessus.sel').forEach((e) => e.classList.remove('sel'));
  if (sel) $(`.${sel.type === 'item' ? 'clip' : sel.type === 'indic' ? 'indic' : 'dessus'}[data-id="${sel.id}"]`)?.classList.add('sel');
  rendreInspecteur();
}

// ——— Barre du haut ———
function rendreBarre() {
  const f = FORMATS[P.sortie.preset];
  $('#b-format').textContent = `${f?.ratio ?? ''} · ${F()} i/s · ${tc(seq.duree, F())}`;
  rendreFormatTl();
}
$('#titre-projet').addEventListener('input', (e) => { P.titre = e.target.value; document.title = `${P.titre} — Dérush`; sauver(); });
$('#titre-projet').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
function majTaches() {
  const f = SRV.file;
  if (!f) return;
  const box = $('#taches');
  const parts = [];
  if (f.en_cours) parts.push(`${anneau(f.en_cours.progression)}<span>${esc(f.en_cours.nom)} · ${Math.round(f.en_cours.progression * 100)} %</span>`);
  if (f.attente.length) parts.push(`<span class="dim">+${f.attente.length}</span>`);
  box.innerHTML = parts.join('');
  natif('progression', {p: f.en_cours && ['rendu', 'export'].includes(f.en_cours.meta?.type) ? f.en_cours.progression : null});
}

// ——— Médias (panneau de gauche, comme CapCut) ———
const H_VIGNETTE = 86;
const dureeCourte = (m) => tc(m.duree, fpsSrc(m)).slice(m.duree >= 3600 ? 0 : 3, 8);
function rendreRushes() {
  const L = $('#grille-medias');
  if (ui.glisseMedia) return; // pas de réaffichage pendant qu'on glisse une vignette
  const enCours = SRV.file?.en_cours;
  const usage = (id) => [...P.montage, ...P.superpositions].filter((it) => it.media === id).length;
  // on ne refait la grille que si quelque chose a changé (sinon le survol clignoterait)
  const cle = JSON.stringify([ui.mode, ui.src.id, enCours?.meta?.media, Math.round((enCours?.progression ?? 0) * 20),
    P.medias.map((m) => [m.id, m.etat, m.transcription?.mots, m.voix?.cree_le, m.vignettes && cleVignettes(m.vignettes), usage(m.id)])]);
  if (L.dataset.cle === cle) return;
  L.dataset.cle = cle;
  if (!P.medias.length) {
    L.innerHTML = '<div class="aide-vide">Tes vidéos et tes sons apparaîtront ici.</div>';
    return;
  }
  L.innerHTML = P.medias.map((m) => {
    const tache = enCours?.meta?.media === m.id ? enCours : null;
    const etat = [];
    if (tache) etat.push(`<span>${anneau(tache.progression)}${tache.meta.type === 'transcription' ? 'texte' : tache.meta.type === 'voix' ? 'voix' : 'préparation'}</span>`);
    else if (m.etat === 'erreur') etat.push(`<span title="${esc(m.erreur)}">${ic('attention')}erreur</span>`);
    // un rush qui a déjà son image se regarde et se monte : sa préparation continue derrière, sans le bloquer
    else if (m.etat !== 'pret') etat.push(m.vignettes || m.type !== 'video' ? `<span class="en-prep" title="Tu peux déjà le regarder et le monter : sa préparation continue.">${anneau(0.28)}</span>` : '<span>en attente</span>');
    else if (m.transcription) etat.push(`<span title="${m.transcription.mots} mots">${ic('texte')}texte</span>`);
    const n = usage(m.id);
    const video = m.type !== 'audio'; // vidéo ou photo : on montre l'image
    const image = video && m.vignettes ? `<div style="${styleVignette(m, m.duree / 2, H_VIGNETTE)}"></div>` : ic(video ? 'film' : 'onde');
    const prepare = m.etat !== 'pret' && m.etat !== 'erreur' && m.type === 'video' && !m.vignettes;
    return `<div class="carte-media${video ? '' : ' son'}${ui.mode === 'rush' && ui.src.id === m.id ? ' actif' : ''}${prepare ? ' prepare' : ''}" data-id="${m.id}" draggable="true" title="${esc(`${m.nom}\nClique pour le regarder, glisse-le dans la timeline.`)}">
      <div class="vignette"${m.type === 'video' && m.vignettes ? ` data-skim="${m.id}"` : ''}>${image}<span class="duree-mini">${m.type === 'image' ? 'photo' : dureeCourte(m)}</span>${n ? `<span class="utilise" title="Utilisé ${n} fois dans le montage">${n}×</span>` : ''}<div class="etat">${etat.join('')}</div>
        <button class="plus-menu" data-act="menu" title="Texte, voix, retirer…">${ic('points', 'plein')}</button><button class="ajouter" data-act="ajouter" title="Ajouter au montage">${ic('plus')}</button></div>
      <div class="nom">${esc(m.nom)}</div></div>`;
  }).join('');
}
$('#grille-medias').addEventListener('click', (e) => {
  const el = e.target.closest('.carte-media');
  if (!el) return;
  const m = media(el.dataset.id);
  if (e.target.closest('[data-act="menu"]')) return feuilleRush(m);
  if (e.target.closest('[data-act="ajouter"]')) return poserMedia(m.id);
  ouvrirApercu(m.id);
});
// survol : on fait défiler les images du média sous la souris
$('#grille-medias').addEventListener('mousemove', (e) => {
  const v = e.target.closest('[data-skim]');
  if (!v) return;
  const m = media(v.dataset.skim);
  const r = v.getBoundingClientRect();
  const d = v.firstElementChild;
  if (m && d) d.setAttribute('style', styleVignette(m, borner((e.clientX - r.left) / r.width, 0, 1) * m.duree, H_VIGNETTE));
});
$('#grille-medias').addEventListener('mouseout', (e) => {
  const v = e.target.closest('[data-skim]');
  if (!v || v.contains(e.relatedTarget)) return;
  const m = media(v.dataset.skim);
  if (m) v.firstElementChild.setAttribute('style', styleVignette(m, m.duree / 2, H_VIGNETTE));
});
// glisser une vignette dans la timeline : au montage (piste du bas) ou par-dessus
$('#grille-medias').addEventListener('dragstart', (e) => {
  const c = e.target.closest('.carte-media');
  if (!c) return;
  e.dataTransfer.setData('application/x-derush-media', c.dataset.id);
  e.dataTransfer.effectAllowed = 'copy';
  ui.glisseMedia = c.dataset.id;
});
$('#grille-medias').addEventListener('dragend', () => {
  ui.glisseMedia = null;
  finDepotTimeline();
  rendreRushes();
});

// ——— Panneau de gauche : Médias, Texte, Pour l'IA ———
function choisirPanneau(p) {
  if (p === 'effets' || p === 'style') { ui.habiller = p; p = 'habiller'; }
  ui.panneau = p;
  $$('#onglets-gauche button').forEach((b) => b.classList.toggle('actif', b.dataset.panneau === p));
  for (const k of ['medias', 'texte', 'habiller', 'creer', 'ia']) $(`#p-${k}`).classList.toggle('cache', k !== p);
  if (p === 'creer') { rendreStudio(); chargerStudio(); chargerCredits(); }
  if (p === 'habiller') choisirHabiller(ui.habiller);
  if (p === 'texte') {
    if (!ui.src.id && P?.medias.length) chargerRush((P.medias.find((m) => m.transcription) ?? P.medias[0]).id, null, null, false);
    if (!P?.montage.some((it) => it.type === 'plan')) ui.texteVue = 'media';
    rendreTexte();
  }
}
$('#onglets-gauche').addEventListener('click', (e) => {
  const b = e.target.closest('[data-panneau]');
  if (b) choisirPanneau(b.dataset.panneau);
});
/** Dans l'onglet Habiller : le style de tout le film, ou les effets à poser un par un. */
function choisirHabiller(h) {
  ui.habiller = h === 'effets' ? 'effets' : 'style';
  $$('#bascule-habiller button').forEach((b) => b.classList.toggle('actif', b.dataset.hab === ui.habiller));
  $('#p-style').classList.toggle('cache', ui.habiller !== 'style');
  $('#p-effets').classList.toggle('cache', ui.habiller !== 'effets');
  if (ui.habiller === 'effets') rendrePanneauEffets(); else rendrePanneauStyle();
}
$('#bascule-habiller').addEventListener('click', (e) => {
  const b = e.target.closest('[data-hab]');
  if (b) choisirHabiller(b.dataset.hab);
});
/** Le brief, en tête de l'onglet Consignes : c'est ce que Claude lit en premier. */
function blocBrief() {
  const b = P.brief;
  const rempli = ['objectif', 'public', 'ton', 'duree_visee', 'a_eviter', 'references'].some((k) => b[k]?.trim());
  const resume = [TYPES_VIDEO[b.type]?.nom, FORMATS[P.sortie.preset]?.ratio, b.duree_visee].filter(Boolean).map(esc).join(' · ');
  return `<h3>Le brief</h3><p>Ce que l’IA lit en premier : l’histoire, le public, le ton, la durée visée.</p>
    <button class="brief-carte${rempli ? ' rempli' : ''}" data-act="brief">${ic('texte')}<span><b>${rempli ? esc((b.objectif || b.ton || 'Brief rédigé').slice(0, 80)) : 'Écrire le brief'}</b><small>${resume || 'Genre de vidéo, format, durée…'}</small></span></button>`;
}
function rendrePanneauIA() {
  $('#p-ia').innerHTML = `${blocBrief()}<h3>Fichiers pour l’IA</h3><p>Ce qui doit guider la vidéo : images d’ambiance, logo, modèle 3D (Blender), police, PDF… L’IA les reçoit tous dans le pack.</p>
    ${zoneRefs(null, 'Images, logo, 3D, documents…')}${listeRefs(null)}
    <h3 style="margin-top:14px">Cases à créer</h3><p>Une case vide dans le montage, que l’IA remplira sur exactement cette durée. Clique : elle se place à la tête de lecture.</p>
    <div class="tuiles">${Object.entries(GENRES_BLOC).map(([k, v]) => `<button class="tuile t-case" data-case="${k}">${ic('case')}<span>${esc(v)}</span></button>`).join('')}</div>
    <h3>Notes pour l’IA</h3><p>Une consigne sur un moment du montage : texte à l’écran, zoom, musique… Elle ne change pas la durée.</p>
    <div class="tuiles">${Object.entries(GENRES_INDICATION).map(([k, v]) => `<button class="tuile t-note" data-note="${k}">${ic('drapeau')}<span>${esc(v)}</span></button>`).join('')}</div>`;
}
$('#p-ia').addEventListener('click', async (e) => {
  if (await actionRefs(e)) return;
  if (e.target.closest('[data-act="brief"]')) return feuilleBrief();
  const c = e.target.closest('[data-case]')?.dataset.case;
  const n = e.target.closest('[data-note]')?.dataset.note;
  if (c) ajouterCase(c);
  if (n) ajouterIndication(n);
});

function feuilleRush(m) {
  const mo = SRV.moteurs ?? {};
  const utilise = [...P.montage, ...P.superpositions].some((it) => it.media === m.id);
  const f = feuille(`<h3>${esc(m.nom)}</h3><p class="sous-titre">${m.type === 'video' ? `${m.largeur}×${m.hauteur} · ${arrondi(m.fps, 2)} i/s · ` : 'Son · '}${tc(m.duree, fpsSrc(m))}</p>
    ${m.audio ? `<div class="moteur"><div class="rond" style="background:rgba(10,132,255,.15);color:var(--bleu)">${ic('texte')}</div><div class="desc"><b>Texte mot à mot</b><small>${m.transcription ? `${m.transcription.mots} mots (${esc(m.transcription.moteur)})` : 'Pour couper au mot près et donner les sous-titres à l’IA.'}</small></div><button class="btn${m.transcription ? '' : ' bleu'}" data-r="texte">${m.transcription ? 'Refaire' : 'Transcrire'}</button></div>
    <div class="moteur"><div class="rond" style="background:rgba(48,209,88,.14);color:var(--vert)">${ic('voix')}</div><div class="desc"><b>Isoler la voix</b><small>${m.voix ? 'Fait : la voix et le fond sont séparés.' : mo.voix?.ok ? 'Sépare la voix de la musique et du bruit (Demucs, sur ton Mac).' : esc(mo.voix?.pourquoi ?? '')}</small></div><button class="btn" data-r="voix"${mo.voix?.ok ? '' : ' disabled'}>${m.voix ? 'Refaire' : 'Isoler'}</button></div>` : ''}
    ${m.etat === 'erreur' ? `<div class="moteur"><div class="rond" style="background:rgba(255,69,58,.15);color:var(--accent)">${ic('attention')}</div><div class="desc"><b>Préparation incomplète</b><small>${esc(m.erreur)}</small></div><button class="btn" data-r="reessayer">Réessayer</button></div>` : ''}
    <div class="pied"><button class="btn" data-r="retirer"${utilise ? ' disabled title="Utilisé dans le montage"' : ''}>${ic('poubelle')}Retirer du projet</button><span class="espace"></span><button class="btn principal" data-r="fermer">OK</button></div>`);
  f.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-r]')?.dataset.r;
    if (!a) return;
    if (a === 'fermer') return fermerFeuille();
    if (a === 'texte') return feuilleTexte(m);
    try {
      if (a === 'voix') { await api('POST', `/api/medias/${m.id}/voix`); note('Séparation de la voix lancée.'); }
      if (a === 'reessayer') await api('POST', `/api/medias/${m.id}/preparer`);
      if (a === 'retirer') {
        if (!confirm(`Retirer « ${m.nom} » du projet ? Le fichier n’est pas supprimé.`)) return;
        await api('DELETE', `/api/medias/${m.id}`);
        P.medias = P.medias.filter((x) => x.id !== m.id);
        if (ui.src.id === m.id) { ui.src = {id: null, entree: null, sortie: null, vue0: 0, vue1: 1}; vRush.removeAttribute('src'); }
        rendreRushes();
        majVue();
      }
      fermerFeuille();
      suivreFile();
    } catch (err) { note(err.message, true); }
  });
}

// =====================================================================
// Lecteur : il montre le montage ; cliquer un média l'ouvre en aperçu (comme dans CapCut)
// =====================================================================
const vRush = $('#v-rush');
const PV = [$('#v-a'), $('#v-b')];
const vDessus = $('#v-dessus');
const aSon = $('#a-son');
function definirMode(mode) {
  if (ui.vue !== 'montage' && mode === 'rush') montrerVue('montage');
  if (mode === ui.mode && ui.modeFixe) return majVue();
  ui.mode = mode;
  ui.modeFixe = true;
  if (mode === 'rush') {
    progPause();
  } else {
    vRush.pause();
  }
  majVue();
  rendreRushes();
}
const ouvrirApercu = (id, entree = null, sortie = null) => chargerRush(id, entree, sortie, true);
const fermerApercu = () => definirMode('montage');
function majVue() {
  const rush = ui.mode === 'rush';
  const m = rush ? media(ui.src.id) : null;
  vRush.classList.toggle('cache', !rush || !m || m.type !== 'video');
  SCENE.el.classList.toggle('cache', rush);
  if (!rush) majScene();
  $('#onde-grande').classList.toggle('cache', !rush || !m || m.type !== 'audio');
  const img = $('#i-fixe');
  if (rush && m?.type === 'image') {
    const url = urlMedia(m.id, 'lecture');
    if (img.dataset.src !== url) { img.src = url; img.dataset.src = url; }
    img.classList.remove('cache');
  } else img.classList.add('cache');
  $('#bande').classList.toggle('cache', !rush);
  if (rush) {
    PV.forEach((v) => v.classList.add('cache'));
    vDessus.classList.add('cache');
    $('#carte').classList.add('cache');
    $('#indic-ecran').innerHTML = '';
    majZones();
    $('#vis-titre').innerHTML = m ? `<span class="puce-apercu">Aperçu · ${esc(m.nom)}<button data-a="fermer-apercu" title="Revenir au montage (Échap)">Retour au montage</button></span>` : '';
    majSourceUI();
  } else {
    progAfficher();
  }
  rendreActionsLecteur();
  afficherVide();
  majCadre();
  majBoutonLire();
}
/** Boutons à droite sous le lecteur : « Ajouter au montage » en aperçu, « Couper ici » sur le montage. */
function rendreActionsLecteur() {
  const box = $('#actions-lecteur');
  let cle = 'vide';
  let html = '';
  if (ui.mode === 'rush') {
    const m = media(ui.src.id);
    if (m) {
      const {entree: a, sortie: b} = ui.src;
      const choix = a != null || b != null;
      cle = `rush:${m.id}:${a}:${b}`;
      html = `${choix ? `<span class="duree">${dureeLisible((b ?? m.duree) - (a ?? 0))}</span><button class="btn petit" data-a="effacer-choix" title="Reprendre tout le média (X)">Tout le média</button>` : ''}
        <button class="btn petit" data-a="dessus" title="Poser par-dessus le montage, à la tête de lecture (⇧E)">${ic('calques')}Par-dessus</button>
        <button class="btn petit principal" data-a="ajouter" title="Ajouter au montage (E)">${ic('plus')}${choix ? 'Ajouter ce passage' : 'Ajouter au montage'}</button>`;
    }
  } else if (seq.segs.length) {
    cle = 'montage';
    html = `<button class="btn petit" data-a="couper" title="Couper le plan à la tête de lecture (S ou ⌘B)">${ic('ciseaux')}Couper ici</button>`;
  }
  if (box.dataset.cle === cle) return;
  box.dataset.cle = cle;
  box.innerHTML = html;
}
function majBoutonLire() {
  const lecture = ui.mode === 'rush' ? !vRush.paused : prog.lecture;
  $('#b-lire').innerHTML = ic(lecture ? 'pause' : 'lire', 'plein');
}

// ——— Rush ———
function chargerRush(id, entree = null, sortie = null, basculer = true) {
  const m = media(id);
  if (!m) return;
  const meme = ui.src.id === id;
  ui.src = {id, entree, sortie, vue0: 0, vue1: m.duree};
  if (!meme) {
    vRush.src = urlMedia(id, 'lecture');
    ui.texteSpans = null;
  }
  if (entree != null && sortie != null) {
    const vis = Math.min(m.duree, Math.max(8, (sortie - entree) * 3));
    ui.src.vue0 = borner(entree - (vis - (sortie - entree)) / 2, 0, Math.max(0, m.duree - vis));
    ui.src.vue1 = ui.src.vue0 + vis;
    vRush.currentTime = entree;
  }
  Promise.all(['ondes', 'analyse', 'mots', 'cadrage'].map((k) => charger(k, m))).then(() => {
    if (ui.src.id !== id) return;
    if (!meme || !ui.texteSpans) rendreTexte();
    majSourceUI();
    majCadre();
  });
  rendreRushes();
  if (basculer) definirMode('rush');
  else majVue();
}
function seekRush(t) {
  const m = media(ui.src.id);
  if (!m) return;
  vRush.currentTime = borner(t, 0, Math.max(0, m.duree - 0.001));
  majSourceUI();
}
function majSourceUI() {
  const m = media(ui.src.id);
  if (ui.mode === 'rush') { majBoutonLire(); rendreActionsLecteur(); }
  majTexteAction();
  if (!m) {
    if (ui.mode === 'rush') $('#tc').innerHTML = '';
    dessinerBande();
    return;
  }
  const f = fpsSrc(m);
  const t = vRush.currentTime || 0;
  if (ui.mode === 'rush') $('#tc').innerHTML = `${tc(t, f)}<small>image ${versImage(t, f)} · aperçu du média</small>`;
  dessinerBande();
  dessinerOndeGrande();
  surlignerMotCourant();
  majCadre();
}
/** Sous le texte : le passage choisi, avec « Ajouter au montage ». */
function majTexteAction() {
  if (ui.texteVue === 'montage') return;
  const box = $('#texte-action');
  const m = media(ui.src.id);
  const {entree: a, sortie: b} = ui.src;
  if (!m || (a == null && b == null)) {
    if (box.dataset.cle) { box.dataset.cle = ''; box.classList.add('cache'); }
    return;
  }
  const cle = `${m.id}:${a}:${b}:${C.mots.has(m.id)}`;
  if (box.dataset.cle === cle) return;
  box.dataset.cle = cle;
  const mots = C.mots.get(m.id);
  const t = mots ? texteDesMots(motsEntre(mots, a ?? 0, b ?? m.duree).filter((w) => !w.ev)) : '';
  box.innerHTML = `${t ? `<div class="extrait">« ${esc(t.length > 170 ? `${t.slice(0, 169)}…` : t)} »</div>` : ''}
    <button class="btn principal" style="width:100%" data-a="ajouter" title="Ajouter au montage (E)">${ic('plus')}Ajouter au montage · ${dureeLisible((b ?? m.duree) - (a ?? 0))}</button>
    <div class="rangee" style="justify-content:space-between;margin-top:4px"><button class="btn lien" data-a="effacer-choix" title="Ne rien choisir (X)">Annuler le choix</button><button class="btn lien" data-a="dessus" title="Poser par-dessus le montage (⇧E)">Poser par-dessus</button></div>`;
  box.classList.remove('cache');
}
function marquerEntree() {
  const m = media(ui.src.id);
  if (!m) return;
  ui.src.entree = surGrille(vRush.currentTime, fpsSrc(m));
  if (ui.src.sortie != null && ui.src.sortie <= ui.src.entree) ui.src.sortie = null;
  majSourceUI();
  marquerSelectionTexte();
}
function marquerSortie() {
  const m = media(ui.src.id);
  if (!m) return;
  const f = fpsSrc(m);
  // la fin inclut l'image affichée (comme dans les logiciels de montage)
  ui.src.sortie = Math.min(m.duree, surGrille(vRush.currentTime, f) + 1 / f);
  if (ui.src.entree != null && ui.src.entree >= ui.src.sortie) ui.src.entree = null;
  majSourceUI();
  marquerSelectionTexte();
}
function effacerChoix() {
  ui.src.entree = null;
  ui.src.sortie = null;
  majSourceUI();
  marquerSelectionTexte();
}
function indexInsertion() {
  if (ui.sel?.type === 'item') {
    const k = P.montage.findIndex((it) => it.id === ui.sel.id);
    if (k >= 0) return k + 1;
  }
  const s = segmentA(seq, prog.t);
  return s ? s.k + 1 : P.montage.length;
}
/** Le passage à poser : celui choisi dans l'aperçu de ce média, sinon le média entier. */
function passageDe(m) {
  const f = fpsSrc(m);
  if (m.type === 'image') return {a: 0, b: 3, choisi: false};
  // la fin du média, sur la grille des images (sinon le dernier plan dépasserait la vidéo d'une fraction d'image)
  const finMedia = Math.max(1 / f, Math.floor(m.duree * f + 1e-6) / f);
  const choisi = ui.src.id === m.id && (ui.src.entree != null || ui.src.sortie != null);
  const a = choisi ? ui.src.entree ?? 0 : 0;
  const b = Math.min(finMedia, choisi ? ui.src.sortie ?? finMedia : finMedia);
  if (b - a < 1 / f - 1e-6) { note('Le passage choisi est vide.', true); return null; }
  return {a, b, choisi};
}
/** Pose un média dans le montage (à la tête de lecture, ou là où on l'a lâché), ou par-dessus. */
function poserMedia(id, cible = null) {
  const m = media(id);
  if (!m) return note('Choisis d’abord un média.', true);
  if (m.etat === 'erreur') return note(`« ${m.nom} » n’a pas pu être préparé : ouvre son menu « … » pour réessayer.`, true);
  const p = passageDe(m);
  if (!p) return;
  let nouveau;
  if (cible?.type === 'dessus') {
    modifier(() => {
      nouveau = {id: nouvelId(P, 'S'), media: m.id, entree: p.a, sortie: p.b, debut: surGrille(cible.t ?? prog.t, F()), titre: '', notes: '', cadre: 'plein', son: {actif: false, gain_db: 0, version: 'original', avant_s: 0, apres_s: 0}};
      P.superpositions.push(nouveau);
      ui.sel = {type: 'dessus', id: nouveau.id};
    });
    note(`Posé par-dessus le montage à ${tc(nouveau.debut, F()).slice(3, 8)}.`);
  } else {
    modifier(() => {
      nouveau = {id: nouvelId(P, 'P'), type: 'plan', media: m.id, entree: p.a, sortie: p.b, titre: '', notes: '', tags: [], son: {actif: true, gain_db: 0, version: 'original', avant_s: 0, apres_s: 0}};
      P.montage.splice(cible?.k ?? indexInsertion(), 0, nouveau);
      ui.sel = {type: 'item', id: nouveau.id};
    });
    const s = seq.segs.find((x) => x.it.id === nouveau.id);
    if (s) { prog.t = s.fin; majTete(); montrerDansTimeline(s.fin); if (ui.mode === 'montage') progAfficher(); }
    note(`${p.choisi ? 'Passage' : `« ${m.nom} »`} ajouté au montage (${dureeLisible(p.b - p.a)}).`);
  }
  if (p.choisi) effacerChoix();
}
// E et ⇧E ne valent que pour le média ouvert en aperçu (ou un passage choisi dans le texte)
const mediaEnCours = () => ui.mode === 'rush' || ui.src.entree != null || ui.src.sortie != null;
const ajouterSelection = () => (mediaEnCours() ? poserMedia(ui.src.id) : note('Clique d’abord la vignette d’un média, ou son + pour l’ajouter tout de suite.'));
const ajouterDessus = () => (mediaEnCours() ? poserMedia(ui.src.id, {type: 'dessus', t: prog.t}) : note('Clique d’abord la vignette d’un média.'));

// bande sous l'écran : vignettes, son, silences, coupes de caméra, passage choisi. Glisser = choisir un passage.
function dessinerBande() {
  const cv = $('#bande');
  const W = Math.round(cv.clientWidth * DPR());
  const H = Math.round(cv.clientHeight * DPR());
  if (!W || !H) return;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);
  const m = ui.src.id ? media(ui.src.id) : null;
  if (!m) return;
  const {vue0, vue1} = ui.src;
  const X = (t) => ((t - vue0) / (vue1 - vue0)) * W;
  const hImg = m.type === 'video' ? Math.round(H * 0.46) : 0;
  const sp = m.type === 'video' ? sprite(m) : null;
  if (sp) {
    const v = m.vignettes;
    const lw = Math.max(4, (v.l * hImg) / v.h);
    for (let x = 0; x < W; x += lw) {
      const t = vue0 + ((x + lw / 2) / W) * (vue1 - vue0);
      g.drawImage(sp, borner(Math.round(t / v.pas), 0, v.n - 1) * v.l, 0, v.l, v.h, x, 0, lw, hImg);
    }
  }
  const an = C.analyse.get(m.id);
  const hO = H - hImg;
  g.fillStyle = 'rgba(255,255,255,0.045)';
  for (const [a, b] of an?.silences ?? []) if (b >= vue0 && a <= vue1) g.fillRect(X(a), hImg, X(b) - X(a), hO);
  const o = C.ondes.get(m.id);
  if (o) {
    g.fillStyle = '#5ac8fa';
    const mid = hImg + hO / 2;
    for (let x = 0; x < W; x++) {
      const i0 = Math.floor((vue0 + (x / W) * (vue1 - vue0)) * o.pps);
      const i1 = Math.max(i0 + 1, Math.ceil((vue0 + ((x + 1) / W) * (vue1 - vue0)) * o.pps));
      let mx = 0;
      for (let i = Math.max(0, i0); i < i1 && i < o.niveaux.length; i++) if (o.niveaux[i] > mx) mx = o.niveaux[i];
      const hh = Math.max(0.5, (mx / 100) * (hO / 2 - 2));
      g.fillRect(x, mid - hh, 1, hh * 2);
    }
  }
  g.fillStyle = 'rgba(255,159,10,0.9)';
  for (const c of an?.coupes_camera ?? []) if (c >= vue0 && c <= vue1) g.fillRect(X(c) - DPR() / 2, 0, DPR(), H);
  g.fillStyle = 'rgba(255,69,58,0.8)';
  for (const it of [...P.montage, ...P.superpositions]) if (it.media === m.id && it.sortie > vue0 && it.entree < vue1) g.fillRect(X(it.entree), H - 3 * DPR(), Math.max(1, X(it.sortie) - X(it.entree)), 3 * DPR());
  const {entree: a, sortie: b} = ui.src;
  if (a != null || b != null) {
    const xa = X(a ?? 0);
    const xb = X(b ?? m.duree);
    g.fillStyle = 'rgba(10,132,255,0.28)';
    g.fillRect(xa, 0, xb - xa, H);
    g.fillStyle = '#0a84ff';
    if (a != null) g.fillRect(xa - DPR(), 0, 2 * DPR(), H);
    if (b != null) g.fillRect(xb - DPR(), 0, 2 * DPR(), H);
  } else if (ui.mode === 'rush') {
    // l'astuce, tant qu'aucun passage n'est choisi
    const txt = 'Glisse ici pour ne garder qu’un passage';
    g.font = `500 ${11 * DPR()}px -apple-system, system-ui, sans-serif`;
    const w = g.measureText(txt).width + 18 * DPR();
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.beginPath();
    g.roundRect?.(W / 2 - w / 2, 4 * DPR(), w, 18 * DPR(), 9 * DPR()) ?? g.rect(W / 2 - w / 2, 4 * DPR(), w, 18 * DPR());
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(txt, W / 2, 13 * DPR());
    g.textAlign = 'start';
    g.textBaseline = 'alphabetic';
  }
  g.fillStyle = '#fff';
  g.fillRect(X(vRush.currentTime || 0) - DPR(), 0, 2 * DPR(), H);
}
const bande = $('#bande');
bande.addEventListener('pointerdown', (e) => {
  const m = media(ui.src.id);
  if (!m) return;
  bande.setPointerCapture(e.pointerId);
  const f = fpsSrc(m);
  const tDe = (ev) => {
    const r = bande.getBoundingClientRect();
    return surGrille(borner(ui.src.vue0 + ((ev.clientX - r.left) / r.width) * (ui.src.vue1 - ui.src.vue0), 0, m.duree), f);
  };
  const x0 = e.clientX;
  const t0 = tDe(e);
  let choix = false;
  vRush.pause();
  seekRush(t0);
  bande.onpointermove = (ev) => {
    if (!ev.buttons) return;
    if (!choix && Math.abs(ev.clientX - x0) < 4) return;
    choix = true;
    const t = tDe(ev);
    ui.src.entree = Math.min(t0, t);
    ui.src.sortie = Math.max(Math.max(t0, t), Math.min(t0, t) + 1 / f);
    seekRush(t);
    marquerSelectionTexte();
  };
  bande.onpointerup = () => { bande.onpointermove = null; };
});
bande.addEventListener('wheel', (e) => {
  const m = media(ui.src.id);
  if (!m) return;
  e.preventDefault();
  const r = bande.getBoundingClientRect();
  const fx = (e.clientX - r.left) / r.width;
  let {vue0, vue1} = ui.src;
  let span = vue1 - vue0;
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
    vue0 += ((e.deltaX || e.deltaY) / r.width) * span;
  } else {
    const t = vue0 + fx * span;
    span = borner(span * Math.exp(e.deltaY * 0.0025), Math.min(0.5, m.duree), m.duree);
    vue0 = t - fx * span;
  }
  ui.src.vue0 = borner(vue0, 0, Math.max(0, m.duree - span));
  ui.src.vue1 = ui.src.vue0 + span;
  dessinerBande();
}, {passive: false});
bande.addEventListener('dblclick', () => {
  const m = media(ui.src.id);
  if (!m) return;
  ui.src.vue0 = 0;
  ui.src.vue1 = m.duree;
  dessinerBande();
});

// grande forme d'onde (rush son seul) : 8 secondes autour de la tête de lecture, avec les mots posés dessus
function dessinerOndeGrande() {
  const m = ui.src.id ? media(ui.src.id) : null;
  if (!m || m.type === 'video' || ui.mode !== 'rush') return;
  const cv = $('#onde-grande');
  const W = Math.round(cv.clientWidth * DPR());
  const H = Math.round(cv.clientHeight * DPR());
  if (!W || !H) return;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d');
  const t = vRush.currentTime || 0;
  const span = 8;
  const a0 = t - span / 2;
  const X = (s) => ((s - a0) / span) * W;
  const fond = g.createLinearGradient(0, 0, 0, H);
  fond.addColorStop(0, '#0b141c');
  fond.addColorStop(1, '#050608');
  g.fillStyle = fond;
  g.fillRect(0, 0, W, H);
  const mid = H * 0.6;
  const an = C.analyse.get(m.id);
  g.fillStyle = 'rgba(255,255,255,0.035)';
  for (const [a, b] of an?.silences ?? []) if (b >= a0 && a <= a0 + span) g.fillRect(X(a), 0, X(b) - X(a), H);
  const {entree: sa, sortie: sb} = ui.src;
  if (sa != null || sb != null) {
    g.fillStyle = 'rgba(10,132,255,0.18)';
    g.fillRect(X(sa ?? 0), 0, X(sb ?? m.duree) - X(sa ?? 0), H);
  }
  const o = C.ondes.get(m.id);
  if (o) {
    const pas = 3 * DPR();
    for (let x = 0; x < W; x += pas) {
      const s = a0 + (x / W) * span;
      if (s < 0 || s > m.duree) continue;
      let mx = 0;
      const i0 = Math.floor(s * o.pps);
      const i1 = Math.max(i0 + 1, Math.floor((a0 + ((x + pas) / W) * span) * o.pps));
      for (let i = i0; i < i1 && i < o.niveaux.length; i++) if (o.niveaux[i] > mx) mx = o.niveaux[i];
      const hh = Math.max(1, (mx / 100) * H * 0.28);
      g.fillStyle = s < t ? '#64d2ff' : '#2f7fa8';
      g.beginPath();
      g.roundRect?.(x, mid - hh, pas - DPR(), hh * 2, DPR()) ?? g.rect(x, mid - hh, pas - DPR(), hh * 2);
      g.fill();
    }
  }
  g.fillStyle = '#5a5a66';
  g.font = `${11 * DPR()}px ui-monospace, Menlo, monospace`;
  for (let s = Math.ceil(a0); s < a0 + span; s++) {
    if (s < 0) continue;
    g.fillRect(X(s), H - 18 * DPR(), DPR(), 6 * DPR());
    g.fillText(tc(s, fpsSrc(m)).slice(3, 8), X(s) + 3 * DPR(), H - 6 * DPR());
  }
  const mots = C.mots.get(m.id);
  if (mots) {
    g.font = `500 ${15 * DPR()}px -apple-system, system-ui, sans-serif`;
    g.textBaseline = 'top';
    const finLigne = [-Infinity, -Infinity, -Infinity];
    for (const w of motsEntre(mots, a0 - 1, a0 + span + 1)) {
      const x = X(w.d);
      const l = finLigne.findIndex((f) => x > f + 8 * DPR());
      if (l < 0) continue;
      finLigne[l] = x + g.measureText(w.t).width;
      const y = (14 + l * 27) * DPR();
      const courant = t >= w.d && t < w.f;
      g.fillStyle = courant ? '#ffffff' : w.ev ? '#a796d6' : '#a7a7b3';
      g.fillText(w.t, x, y);
      g.fillStyle = courant ? 'rgba(255,69,58,0.95)' : 'rgba(255,255,255,0.12)';
      g.fillRect(x, y + 20 * DPR(), Math.max(2, X(w.f) - x), 2 * DPR());
    }
  }
  g.fillStyle = '#ff453a';
  g.fillRect(W / 2 - DPR(), 0, 2 * DPR(), H);
}

// ——— Aperçu du recadrage automatique ———
$('#b-cadre').addEventListener('click', () => {
  ui.cadre = !ui.cadre;
  majCadre();
  note(ui.cadre ? 'Aperçu du recadrage affiché.' : 'Aperçu du recadrage masqué.');
});
function majCadre() {
  const box = $('#cadre');
  const bouton = $('#b-cadre');
  let m = null;
  let t = 0;
  let v = null;
  if (ui.mode !== 'rush') {
    box.classList.add('cache');
    bouton.disabled = true;
    bouton.classList.remove('actif');
    bouton.title = 'Dans le montage, l’image est déjà au format de la vidéo finale';
    return;
  }
  if (ui.mode === 'rush') {
    m = media(ui.src.id);
    t = vRush.currentTime || 0;
    v = vRush;
  } else if (P && seq.segs.length) {
    const s = segmentA(seq, Math.min(prog.t, seq.duree - 1e-6));
    if (s?.it.type === 'plan') {
      m = media(s.it.media);
      t = s.it.entree + (prog.t - s.debut);
      v = PV[prog.actif];
    }
  }
  const pertinent = m?.type === 'video' && Math.abs(m.largeur / m.hauteur - ratioSortie()) > 0.01;
  bouton.disabled = !pertinent;
  bouton.classList.toggle('actif', pertinent && ui.cadre);
  bouton.title = pertinent ? 'Aperçu du recadrage automatique (suit les visages)' : 'Le rush a déjà le format de la sortie : pas de recadrage';
  const pts = m ? C.cadrage.get(m.id) : null;
  if (!pertinent || !ui.cadre || !v || v.classList.contains('cache')) return box.classList.add('cache');
  if (pts === undefined) charger('cadrage', m).then(() => majCadre());
  const p = pts ? pointCadrage(pts, t) : {x: 0.5, y: 0.5};
  const fen = fenetreCadrage(p.x, p.y, m.largeur / m.hauteur, ratioSortie());
  const ecran = $('#ecran').getBoundingClientRect();
  const ech = Math.min(ecran.width / m.largeur, ecran.height / m.hauteur);
  const w = m.largeur * ech;
  const h = m.hauteur * ech;
  const ox = (ecran.width - w) / 2;
  const oy = (ecran.height - h) / 2;
  box.style.left = `${ox + fen[0] * w}px`;
  box.style.top = `${oy + fen[1] * h}px`;
  box.style.width = `${fen[2] * w}px`;
  box.style.height = `${fen[3] * h}px`;
  box.dataset.format = `${FORMATS[P.sortie.preset]?.ratio ?? ''}${pts ? (p.type === 'visage' ? ' · visage' : '') : ' · centre'}`;
  box.classList.remove('cache');
}

// ——— Texte du rush : cliquer un mot pour s'y placer, glisser sur des mots pour choisir un passage ———
// ——— Le texte (idée de Rescript et de Descript) : le montage se lit et se coupe comme un texte ———
function rendreTexte() {
  ui.motsChoisis = null;
  $('#texte-tete').innerHTML = `<div class="vue-texte"><button data-vue="montage"${ui.texteVue === 'montage' ? ' class="actif"' : ''}>Texte du montage</button><button data-vue="media"${ui.texteVue === 'media' ? ' class="actif"' : ''}>Texte d’un média</button></div>
    ${ui.texteVue === 'montage' ? `<div class="outils-texte"><button class="btn petit" data-act="blancs" title="Enlève les pauses de plus de 0,45 s dans tout le montage, en gardant un peu d’air (⌘Z pour annuler)">${ic('onde')}Enlever les blancs</button><button class="btn petit" data-act="euh" title="Enlève les « euh », « hum »… dans tout le montage (⌘Z pour annuler)">${ic('texte')}Enlever les « euh »</button></div>` : ''}`;
  return ui.texteVue === 'montage' ? rendreTexteMontage() : rendreTexteMedia();
}
/** Le texte de tout le montage, plan après plan : glisser sur des mots puis ⌫ les coupe du montage. */
function rendreTexteMontage() {
  const box = $('#texte-mots');
  ui.texteSpans = null;
  ui.texteDedans = [];
  ui.motCourant = null;
  ui.motsMontage = [];
  $('#texte-action').classList.add('cache');
  $('#texte-action').dataset.cle = '';
  const plans = seq.segs.filter((s) => s.it.type === 'plan');
  if (!plans.length) {
    box.innerHTML = '<div class="aide-vide">Le texte du montage apparaîtra ici.<br>Ajoute d’abord des plans, puis coupe en effaçant des mots, comme dans un traitement de texte.</div>';
    $('#texte-info').textContent = '';
    return;
  }
  const manquants = [...new Set(plans.map((s) => s.it.media))].map(media).filter((m) => m?.transcription && !C.mots.has(m.id));
  if (manquants.length) Promise.all(manquants.map((m) => charger('mots', m))).then(() => { if (ui.texteVue === 'montage') rendreTexte(); });
  let html = '';
  for (const s of plans) {
    const m = media(s.it.media);
    const mots = m ? C.mots.get(m.id) : null;
    html += `<div class="plan-texte"><b>${esc(s.it.id)}</b>${esc(m?.nom ?? '')} · ${tc(s.debut, F()).slice(3, 8)}${s.it.essentiel ? ` ${ic('etoile', 'plein')}` : ''}</div><p>`;
    if (!mots) {
      html += `<span class="dim">${m?.audio ? (m.transcription ? 'chargement…' : 'pas encore de texte') : 'pas de son'}</span></p>`;
      continue;
    }
    let prec = null;
    for (let i = premierMot(mots, s.it.entree); i < mots.length; i++) {
      const w = mots[i];
      if ((w.d + w.f) / 2 >= s.it.sortie) break;
      const k = ui.motsMontage.length;
      ui.motsMontage.push({plan: s.it.id, i, w, t: s.debut + Math.max(0, w.d - s.it.entree)});
      const colle = !prec || /^[,.…)\]%'’]/.test(w.t) || /['’([]$/.test(prec.t);
      html += `${colle ? '' : ' '}<span class="m${w.ev ? ' ev' : ''}" data-k="${k}">${esc(w.t)}</span>`;
      prec = w;
    }
    html += '</p>';
  }
  box.innerHTML = `${html}<p class="dim" style="font-size:11.5px;margin-top:18px">Clique un mot pour y aller. Glisse sur des mots puis appuie sur ⌫ : ils sortent du montage. ⌘Z annule.</p>`;
  ui.texteSpans = $$('.m', box);
  $('#texte-info').textContent = `${ui.motsMontage.length} mots`;
  surlignerMotMontage(true);
}
/** Le mot dit à la tête de lecture, dans le texte du montage. */
function surlignerMotMontage(defiler = false) {
  if (ui.texteVue !== 'montage' || !ui.texteSpans || !ui.motsMontage?.length) return;
  const L = ui.motsMontage;
  let a = 0;
  let b = L.length - 1;
  let r = -1;
  while (a <= b) {
    const k = (a + b) >> 1;
    if (L[k].t <= prog.t) { r = k; a = k + 1; } else b = k - 1;
  }
  const k = r >= 0 && prog.t < L[r].t + (L[r].w.f - L[r].w.d) + 0.25 ? r : null;
  if (k === ui.motCourant) return;
  if (ui.motCourant != null) ui.texteSpans[ui.motCourant]?.classList.remove('courant');
  ui.motCourant = k;
  if (k != null) {
    ui.texteSpans[k]?.classList.add('courant');
    if ((prog.lecture || defiler) && ui.panneau === 'texte') ui.texteSpans[k]?.scrollIntoView({block: 'nearest'});
  }
}
function marquerMotsChoisis() {
  $$('#texte-mots .m.choisi').forEach((x) => x.classList.remove('choisi'));
  const c = ui.motsChoisis;
  const box = $('#texte-action');
  if (!c) { box.classList.add('cache'); box.dataset.cle = ''; return; }
  for (let k = c.a; k <= c.b; k++) ui.texteSpans?.[k]?.classList.add('choisi');
  const sel = ui.motsMontage.slice(c.a, c.b + 1);
  const txt = texteDesMots(sel.map((x) => x.w).filter((w) => !w.ev));
  const duree = sel.length ? sel.at(-1).t + (sel.at(-1).w.f - sel.at(-1).w.d) - sel[0].t : 0;
  box.dataset.cle = `mots:${c.a}:${c.b}`;
  box.innerHTML = `<div class="extrait">« ${esc(txt.length > 170 ? `${txt.slice(0, 169)}…` : txt)} »</div>
    <button class="btn principal" style="width:100%" data-act="couper-mots" title="Couper ces mots du montage (⌫)">${ic('ciseaux')}Couper ces mots · ${dureeLisible(Math.max(0, duree))}</button>
    <div class="rangee" style="justify-content:flex-end;margin-top:4px"><button class="btn lien" data-act="annuler-mots">Annuler le choix</button></div>`;
  box.classList.remove('cache');
}
function effacerMotsChoisis() {
  ui.motsChoisis = null;
  marquerMotsChoisis();
}
/** Enlève des passages (temps source) de plans du montage. Un seul ⌘Z annule tout. */
function couperPlages(plages) {
  let nb = 0;
  let total = 0;
  const parPlan = new Map();
  for (const p of plages) {
    if (!parPlan.has(p.plan)) parPlan.set(p.plan, []);
    parPlan.get(p.plan).push(p);
  }
  modifier(() => {
    for (const [planId, ps] of parPlan) {
      // de la fin vers le début : le plan d'origine garde toujours la partie de gauche
      for (const {a, b} of ps.sort((x, y) => y.a - x.a)) {
        const k = P.montage.findIndex((x) => x.id === planId);
        if (k < 0) break;
        const it = P.montage[k];
        const f = fpsSrc(media(it.media));
        const A = Math.max(it.entree, Math.floor(a * f + 1e-6) / f);
        const B = Math.min(it.sortie, Math.ceil(b * f - 1e-6) / f);
        if (B - A < 1 / f) continue;
        nb++;
        total += B - A;
        const auDebut = A <= it.entree + 1 / f;
        const aLaFin = B >= it.sortie - 1 / f;
        if (auDebut && aLaFin) { P.montage.splice(k, 1); break; }
        if (auDebut) it.entree = B;
        else if (aLaFin) it.sortie = A;
        else {
          P.montage.splice(k + 1, 0, {...structuredClone(it), id: nouvelId(P, 'P'), entree: B});
          it.sortie = A;
        }
      }
    }
    ui.sel = null;
    ui.multi.clear();
  });
  return {nb, total};
}
function couperMotsChoisis() {
  const c = ui.motsChoisis;
  if (!c) return;
  const parPlan = new Map();
  for (const x of ui.motsMontage.slice(c.a, c.b + 1)) {
    if (!parPlan.has(x.plan)) parPlan.set(x.plan, []);
    parPlan.get(x.plan).push(x);
  }
  const plages = [];
  for (const [plan, xs] of parPlan) {
    const it = item(plan);
    const m = it && media(it.media);
    const mots = m && C.mots.get(m.id);
    if (!mots) continue;
    const i0 = xs[0].i;
    const i1 = xs.at(-1).i;
    // une petite marge autour des mots, sans mordre sur les mots voisins
    const finAvant = i0 > 0 ? mots[i0 - 1].f : -Infinity;
    const debutApres = i1 < mots.length - 1 ? mots[i1 + 1].d : Infinity;
    plages.push({plan, a: Math.max((finAvant + mots[i0].d) / 2, mots[i0].d - 0.08), b: Math.min((mots[i1].f + debutApres) / 2, mots[i1].f + 0.08)});
  }
  const r = couperPlages(plages);
  ui.motsChoisis = null;
  note(`${xsMots(c)} coupé${c.b > c.a ? 's' : ''} du montage (${dureeLisible(r.total)}). ⌘Z pour annuler.`);
}
const xsMots = (c) => `${c.b - c.a + 1} mot${c.b > c.a ? 's' : ''}`;
/** Enlève les pauses (blancs) de plus de `seuil` secondes dans tout le montage, en gardant un peu d'air. */
async function enleverBlancs(seuil = 0.45, air = 0.12) {
  const plans = P.montage.filter((it) => it.type === 'plan');
  await Promise.all([...new Set(plans.map((it) => it.media))].map((id) => charger('analyse', media(id))));
  const plages = [];
  for (const it of plans) {
    for (const [a, b] of C.analyse.get(it.media)?.silences ?? []) {
      const A = Math.max(a, it.entree) + air;
      const B = Math.min(b, it.sortie) - air;
      if (B - A >= seuil - 2 * air && B > A) plages.push({plan: it.id, a: A, b: B});
    }
  }
  if (!plages.length) return note('Aucun blanc assez long à enlever.');
  const r = couperPlages(plages);
  note(`${r.nb} blanc${r.nb > 1 ? 's' : ''} enlevé${r.nb > 1 ? 's' : ''} : ${dureeLisible(r.total)} de moins. ⌘Z pour annuler.`);
}
const HESITATIONS = new Set(['euh', 'heu', 'euhh', 'euhhh', 'heuu', 'hum', 'humm', 'hmm', 'hmmm', 'mmh', 'mmm', 'uh', 'uhm', 'um', 'umm', 'erm']);
/** Enlève les hésitations (« euh », « hum »…) dans tout le montage. */
async function enleverEuh() {
  const plans = P.montage.filter((it) => it.type === 'plan');
  await Promise.all([...new Set(plans.map((it) => it.media))].map(media).filter((m) => m?.transcription).map((m) => charger('mots', m)));
  const plages = [];
  for (const it of plans) {
    const mots = C.mots.get(it.media);
    if (!mots) continue;
    for (let i = premierMot(mots, it.entree); i < mots.length; i++) {
      const w = mots[i];
      if ((w.d + w.f) / 2 >= it.sortie) break;
      if (!HESITATIONS.has(normal(w.t))) continue;
      const finAvant = i > 0 ? mots[i - 1].f : -Infinity;
      const debutApres = i < mots.length - 1 ? mots[i + 1].d : Infinity;
      plages.push({plan: it.id, a: Math.max((finAvant + w.d) / 2, w.d - 0.05), b: Math.min((w.f + debutApres) / 2, w.f + 0.05)});
    }
  }
  if (!plages.length) return note('Aucun « euh » dans le texte du montage. Les textes faits avant Dérush 3 les effacent souvent : refais le texte du média (menu « … » de sa vignette) pour les repérer.');
  const r = couperPlages(plages);
  note(`${r.nb} hésitation${r.nb > 1 ? 's' : ''} enlevée${r.nb > 1 ? 's' : ''} (${dureeLisible(r.total)}). ⌘Z pour annuler.`);
}
function rendreTexteMedia() {
  const box = $('#texte-mots');
  const m = ui.src.id ? media(ui.src.id) : null;
  ui.texteSpans = null;
  ui.texteDedans = [];
  ui.motCourant = null;
  if (!m) {
    box.innerHTML = '<p class="aide-vide">Importe une vidéo ou un son pour lire son texte ici.</p>';
    $('#texte-info').textContent = '';
    return;
  }
  const mots = C.mots.get(m.id);
  $('#texte-info').textContent = mots ? `${mots.length} mots` : '';
  // quel média lire : un menu si le projet en a plusieurs
  const titre = `<div class="texte-titre">${ic(m.type === 'video' ? 'film' : 'onde')}${P.medias.length > 1
    ? `<select data-act="choisir-texte" class="entree" style="padding:3px 6px;font-size:12px">${P.medias.map((x) => option(x.id, `${x.nom}${x.transcription ? '' : ' (sans texte)'}`, x.id === m.id)).join('')}</select>`
    : `<b>${esc(m.nom)}</b>`}</div>`;
  if (!mots) {
    box.innerHTML = `${titre}<div class="aide-vide">${ic('texte')}<br>${m.audio ? 'Pas encore de texte pour ce média.<br>Avec le texte, tu choisis tes phrases au mot près et l’IA reçoit les sous-titres prêts.' : 'Ce média n’a pas de son.'}${m.audio ? '<br><button class="btn bleu" data-act="transcrire" style="margin-top:12px">Transcrire</button>' : ''}</div>`;
    return;
  }
  const f = fpsSrc(m);
  let html = titre;
  let prec = null;
  mots.forEach((w, i) => {
    const nouveau = !prec || w.d - prec.f > 1.2 || (w.loc && w.loc !== prec.loc);
    if (nouveau) {
      if (prec) html += '</p>';
      html += `<p><span class="t-heure">${tc(w.d, f).slice(0, 8)}</span>${w.loc && (!prec || w.loc !== prec.loc) ? `<span class="loc">${esc(w.loc)}</span>` : ''}`;
    }
    const colle = nouveau || /^[,.…)\]%'’]/.test(w.t) || /['’([]$/.test(prec?.t ?? '');
    html += `${colle ? '' : ' '}<span class="m${w.ev ? ' ev' : ''}" data-i="${i}">${esc(w.t)}</span>`;
    prec = w;
  });
  box.innerHTML = `${html}</p><p class="dim" style="font-size:11.5px;margin-top:18px">Clique un mot pour l’écouter. Glisse sur des mots pour choisir un passage, puis « Ajouter au montage ».</p>`;
  ui.texteSpans = $$('.m', box);
  marquerSelectionTexte();
  surlignerMotCourant(true);
}
function premierMot(mots, t) {
  let a = 0;
  let b = mots.length;
  while (a < b) {
    const k = (a + b) >> 1;
    if ((mots[k].d + mots[k].f) / 2 < t) a = k + 1; else b = k;
  }
  return a;
}
function marquerSelectionTexte() {
  const spans = ui.texteSpans;
  if (!spans || ui.texteVue !== 'media') return;
  for (const k of ui.texteDedans) spans[k]?.classList.remove('dedans');
  ui.texteDedans = [];
  const m = media(ui.src.id);
  const mots = C.mots.get(m?.id);
  const {entree: a, sortie: b} = ui.src;
  if (!mots || (a == null && b == null)) return;
  const A = a ?? 0;
  const B = b ?? m.duree;
  for (let i = premierMot(mots, A); i < mots.length; i++) {
    if ((mots[i].d + mots[i].f) / 2 >= B) break;
    spans[i].classList.add('dedans');
    ui.texteDedans.push(i);
  }
}
function surlignerMotCourant(defiler = false) {
  if (ui.texteVue === 'montage') return surlignerMotMontage(defiler);
  const spans = ui.texteSpans;
  const m = ui.src.id ? media(ui.src.id) : null;
  const mots = m ? C.mots.get(m.id) : null;
  if (!spans || !mots) return;
  const t = vRush.currentTime || 0;
  let a = 0;
  let b = mots.length - 1;
  let r = -1;
  while (a <= b) {
    const k = (a + b) >> 1;
    if (mots[k].d <= t) { r = k; a = k + 1; } else b = k - 1;
  }
  const i = r >= 0 && t < mots[r].f + 0.25 ? r : null;
  if (i === ui.motCourant) return;
  if (ui.motCourant != null) spans[ui.motCourant]?.classList.remove('courant');
  ui.motCourant = i;
  if (i != null) {
    spans[i].classList.add('courant');
    if ((!vRush.paused || defiler) && ui.panneau === 'texte') spans[i].scrollIntoView({block: 'nearest'});
  }
}
function selectionDepuisMots(a, b) {
  const m = media(ui.src.id);
  const mots = C.mots.get(m.id);
  const f = fpsSrc(m);
  const finAvant = a > 0 ? mots[a - 1].f : 0;
  const debutApres = b < mots.length - 1 ? mots[b + 1].d : m.duree;
  // une petite marge autour des mots, sans mordre sur les mots voisins
  const ent = Math.max(0, mots[a].d - 0.06, (finAvant + mots[a].d) / 2);
  const sor = Math.min(m.duree, mots[b].f + 0.1, (mots[b].f + debutApres) / 2);
  ui.src.entree = Math.floor(ent * f + 1e-6) / f;
  ui.src.sortie = Math.max(ui.src.entree + 1 / f, Math.ceil(sor * f - 1e-6) / f);
  vRush.pause();
  if (ui.mode !== 'rush') definirMode('rush');
  seekRush(ui.src.entree);
  marquerSelectionTexte();
}
let selMots = null;
/** Dans le texte du montage : clic = aller à ce mot ; glisser = choisir des mots (puis ⌫ pour les couper). */
function pointerTexteMontage(e, sp) {
  const k0 = Number(sp.dataset.k);
  if (e.shiftKey && ui.motsChoisis) {
    ui.motsChoisis = {a: Math.min(ui.motsChoisis.a, k0), b: Math.max(ui.motsChoisis.b, k0)};
    return marquerMotsChoisis();
  }
  let glisse = false;
  const bouger = (ev) => {
    const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('#texte-mots .m');
    if (!el) return;
    const k = Number(el.dataset.k);
    if (k !== k0 || glisse) {
      glisse = true;
      ui.motsChoisis = {a: Math.min(k0, k), b: Math.max(k0, k)};
      marquerMotsChoisis();
    }
  };
  const lacher = () => {
    window.removeEventListener('pointermove', bouger);
    if (glisse) return;
    effacerMotsChoisis();
    progPause();
    if (ui.mode !== 'montage') definirMode('montage');
    progPositionner(ui.motsMontage[k0].t);
    surlignerMotMontage();
  };
  window.addEventListener('pointermove', bouger);
  window.addEventListener('pointerup', lacher, {once: true});
}
$('#texte-mots').addEventListener('pointerdown', (e) => {
  const sp = e.target.closest('.m');
  if (!sp) return;
  e.preventDefault();
  if (ui.texteVue === 'montage') return pointerTexteMontage(e, sp);
  const mots = C.mots.get(ui.src.id);
  const i = Number(sp.dataset.i);
  if (e.shiftKey && selMots) {
    selMots = {a: Math.min(selMots.a, i), b: Math.max(selMots.b, i)};
    return selectionDepuisMots(selMots.a, selMots.b);
  }
  let glisse = false;
  const bouger = (ev) => {
    const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.m');
    if (!el) return;
    const j = Number(el.dataset.i);
    if (j !== i || glisse) {
      glisse = true;
      selMots = {a: Math.min(i, j), b: Math.max(i, j)};
      selectionDepuisMots(selMots.a, selMots.b);
    }
  };
  const lacher = () => {
    window.removeEventListener('pointermove', bouger);
    if (!glisse) {
      selMots = {a: i, b: i};
      vRush.pause();
      if (ui.mode !== 'rush') definirMode('rush');
      seekRush(mots[i].d);
    }
  };
  window.addEventListener('pointermove', bouger);
  window.addEventListener('pointerup', lacher, {once: true});
});
$('#p-texte').addEventListener('click', (e) => {
  const vue = e.target.closest('[data-vue]')?.dataset.vue;
  if (vue) { ui.texteVue = vue; return rendreTexte(); }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'transcrire' && ui.src.id) feuilleTexte(media(ui.src.id));
  if (act === 'couper-mots') couperMotsChoisis();
  if (act === 'annuler-mots') effacerMotsChoisis();
  if (act === 'blancs') enleverBlancs();
  if (act === 'euh') enleverEuh();
});
$('#p-texte').addEventListener('change', (e) => {
  if (e.target.dataset.act === 'choisir-texte') chargerRush(e.target.value, null, null, ui.mode === 'rush');
});
const normal = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim();
$('#texte-cherche').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  if (ui.texteVue === 'montage') {
    // chercher dans le texte du montage, puis y placer la tête de lecture
    const L = ui.motsMontage ?? [];
    const q = normal(e.target.value).split(' ').filter(Boolean);
    if (!L.length || !q.length) return;
    const n = L.length;
    const depart = ui.trouveMontage ?? -1;
    for (let k = 1; k <= n; k++) {
      const i = (depart + k) % n;
      if (q.every((w, j) => i + j < n && (j === q.length - 1 ? normal(L[i + j].w.t).startsWith(w) : normal(L[i + j].w.t) === w))) {
        $$('.m.trouve').forEach((x) => x.classList.remove('trouve'));
        for (let j = 0; j < q.length; j++) ui.texteSpans?.[i + j]?.classList.add('trouve');
        ui.trouveMontage = i;
        ui.texteSpans?.[i]?.scrollIntoView({block: 'center'});
        progPause();
        if (ui.mode !== 'montage') definirMode('montage');
        progPositionner(L[i].t);
        $('#texte-info').textContent = `à ${tc(L[i].t, F()).slice(3, 8)} · Entrée : suivant`;
        return;
      }
    }
    $('#texte-info').textContent = 'introuvable';
    return;
  }
  const m = media(ui.src.id);
  const mots = m && C.mots.get(m.id);
  const q = normal(e.target.value).split(' ').filter(Boolean);
  if (!mots || !q.length) return;
  const sens = e.shiftKey ? -1 : 1;
  const n = mots.length;
  const depart = ui.trouve ?? (sens > 0 ? -1 : n);
  for (let k = 1; k <= n; k++) {
    const i = (((depart + sens * k) % n) + n) % n;
    if (q.every((w, j) => i + j < n && (j === q.length - 1 ? normal(mots[i + j].t).startsWith(w) : normal(mots[i + j].t) === w))) {
      $$('.m.trouve').forEach((x) => x.classList.remove('trouve'));
      for (let j = 0; j < q.length; j++) ui.texteSpans?.[i + j]?.classList.add('trouve');
      ui.trouve = i;
      ui.texteSpans?.[i]?.scrollIntoView({block: 'center'});
      vRush.pause();
      if (ui.mode !== 'rush') definirMode('rush');
      seekRush(mots[i].d);
      $('#texte-info').textContent = `à ${tc(mots[i].d, fpsSrc(m)).slice(0, 8)} · Entrée : suivant`;
      return;
    }
  }
  $('#texte-info').textContent = 'introuvable';
});

// ——— Lecteur du montage ———
const prog = {t: 0, lecture: false, actif: 0, seg: null, prepare: null, t0perf: 0, raf: 0};
function mettreMedia(v, m, quoi = 'lecture') {
  const cle = `${m.id}:${quoi}`;
  if (v.dataset.media !== cle) {
    v.src = urlMedia(m.id, quoi);
    v.dataset.media = cle;
  }
}
function extraitPlan(it, n = 180) {
  const mots = C.mots.get(it.media);
  if (!mots) return '';
  const t = texteDesMots(motsEntre(mots, it.entree, it.sortie).filter((w) => !w.ev));
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}
function carte(type, html) {
  const c = $('#carte');
  c.className = `carte-ecran ${type}`;
  c.innerHTML = html;
}
/** Son à jouer pour un plan : version voix seule ou sans la voix (fichier séparé), sinon le son du plan. */
function versionSon(it) {
  const m = media(it.media);
  return it.son?.version && it.son.version !== 'original' && m?.voix ? it.son.version : null;
}
/** Un plan qui montre une photo (image fixe) ? */
const estFixe = (it) => it?.type === 'plan' && media(it.media)?.type === 'image';
function afficherSegment(s, decalage, jouer) {
  const v = PV[prog.actif];
  const autre = PV[1 - prog.actif];
  $('#vis-titre').innerHTML = `<b>${esc(s.it.id)}</b>${s.it.titre ? ` · ${esc(s.it.titre)}` : ''} <span class="dim">· ${s.k + 1}/${seq.segs.length}</span>`;
  const img = $('#i-fixe-m');
  if (estFixe(s.it)) {
    PV.forEach((x) => { x.pause(); x.classList.add('cache'); });
    aSon.pause();
    $('#carte').classList.add('cache');
    const url = urlMedia(s.it.media, 'lecture');
    if (img.dataset.src !== url) { img.src = url; img.dataset.src = url; }
    placer(img, media(s.it.media), 0);
    img.classList.remove('cache');
    return;
  }
  img.classList.add('cache');
  if (s.it.type === 'plan') {
    const m = media(s.it.media);
    mettreMedia(v, m);
    const cible = s.it.entree + decalage;
    if (Math.abs((v.currentTime || 0) - cible) > 0.5 / F() || v.readyState === 0) v.currentTime = cible;
    const version = versionSon(s.it);
    v.muted = s.it.son?.actif === false || !!version;
    v.volume = borner(10 ** ((s.it.son?.gain_db ?? 0) / 20), 0, 1);
    if (version && s.it.son?.actif !== false) {
      mettreMedia(aSon, m, version);
      if (Math.abs((aSon.currentTime || 0) - cible) > 0.08) aSon.currentTime = cible;
      aSon.volume = v.volume;
      if (jouer) aSon.play().catch(() => {}); else aSon.pause();
    } else aSon.pause();
    if (m.type === 'video') placer(v, m, cible);
    v.classList.toggle('cache', m.type !== 'video');
    autre.classList.add('cache');
    autre.pause();
    if (m.type === 'video') $('#carte').classList.add('cache');
    else carte('son', `<div><div class="genre">Son seul · ${esc(m.nom)}</div><div class="grand">${esc(s.it.titre || s.it.id)}</div><div class="consigne">${esc(extraitPlan(s.it) || 'L’IA créera les images de ce passage.')}</div></div>`);
    if (jouer) v.play().catch(() => {});
  } else {
    PV.forEach((x) => { x.pause(); x.classList.add('cache'); });
    aSon.pause();
    carte('case', `<div><div class="genre">À créer · ${esc(GENRES_BLOC[s.it.genre])}</div><div class="grand">${esc(s.it.titre || s.it.id)}</div><div class="consigne">${esc(s.it.consigne || 'Pas encore de consigne : précise dans les infos ce que l’IA doit créer ici.')}</div></div>`);
  }
}
/** Plan posé par-dessus le montage au temps t (le premier s'il y en a plusieurs). */
function majDessus(jouer) {
  const t = prog.t;
  const sp = P.superpositions.find((s) => t >= s.debut && t < s.debut + (s.sortie - s.entree));
  if (!sp || ui.mode !== 'montage') {
    vDessus.pause();
    vDessus.classList.add('cache');
    return;
  }
  const m = media(sp.media);
  if (!m || m.type !== 'video') return vDessus.classList.add('cache');
  mettreMedia(vDessus, m);
  const cible = sp.entree + (t - sp.debut);
  if (!jouer || Math.abs((vDessus.currentTime || 0) - cible) > 0.25) vDessus.currentTime = cible;
  vDessus.muted = !sp.son?.actif;
  vDessus.classList.toggle('incrustation', sp.cadre === 'incrustation');
  if (sp.cadre !== 'incrustation') placer(vDessus, m, cible);
  vDessus.classList.remove('cache');
  if (jouer && vDessus.paused) vDessus.play().catch(() => {});
  if (!jouer) vDessus.pause();
}
function majIndicEcran() {
  const actives = P.indications.filter((i) => !estEffet(i) && prog.t >= i.debut && prog.t < i.fin);
  $('#indic-ecran').innerHTML = actives.map((i) => `<div><b>${esc(GENRES_INDICATION[i.genre])}</b> — ${esc(i.consigne || '(sans consigne)')}</div>`).join('');
}
function majTete() {
  if (ui.vue === 'claude') {
    const t = $('#v-claude').currentTime || 0;
    $('#tete').style.left = `${t * ui.pps}px`;
    $('#tc').innerHTML = `${tc(t, F())}<small>vidéo de l’IA</small>`;
    return;
  }
  $('#tete').style.left = `${prog.t * ui.pps}px`;
  if (ui.panneau === 'texte' && ui.texteVue === 'montage') surlignerMotMontage();
  if (ui.mode === 'montage') $('#tc').innerHTML = `${tc(prog.t, F())}<small>image ${versImage(prog.t, F())} · montage</small>`;
}
function progAfficher() {
  majTete();
  if (ui.mode !== 'montage' || ui.vue !== 'montage') return;
  majIndicEcran();
  vRush.classList.add('cache');
  if (!seq.segs.length) {
    $('#i-fixe-m').classList.add('cache');
    majHabillage();
    PV.forEach((v) => { v.pause(); v.classList.add('cache'); });
    $('#carte').classList.add('cache');
    vDessus.classList.add('cache');
    $('#vis-titre').innerHTML = '';
    afficherVide();
    return;
  }
  const s = segmentA(seq, Math.min(prog.t, seq.duree - 1e-6)) ?? seq.segs.at(-1);
  afficherSegment(s, Math.min(prog.t, s.fin) - s.debut, false);
  majDessus(false);
  majCadre();
  majHabillage();
}
function progPositionner(t) {
  if (ui.vue !== 'montage') montrerVue('montage');
  prog.t = borner(t, 0, seq.duree);
  if (prog.lecture) {
    const s = segmentA(seq, prog.t);
    if (!s) return progPause();
    demarrerSegment(s, prog.t - s.debut);
  } else progAfficher();
  suivreTete();
}
function progLire() {
  if (!seq.segs.length) return;
  if (ui.vue !== 'montage') montrerVue('montage');
  if (prog.t >= seq.duree - 1e-3) prog.t = 0;
  vRush.pause();
  prog.lecture = true;
  const s = segmentA(seq, prog.t) ?? seq.segs[0];
  demarrerSegment(s, prog.t - s.debut);
  cancelAnimationFrame(prog.raf);
  prog.raf = requestAnimationFrame(boucleProg);
  majBoutonLire();
}
function progPause() {
  prog.lecture = false;
  cancelAnimationFrame(prog.raf);
  PV.forEach((v) => v.pause());
  vDessus.pause();
  aSon.pause();
  majBoutonLire();
}
function arreterLecture() {
  progPause();
  vRush.pause();
}
function demarrerSegment(s, decalage) {
  prog.seg = s;
  prog.prepare = null;
  afficherSegment(s, decalage, s.it.type === 'plan' && !estFixe(s.it));
  if (s.it.type !== 'plan' || estFixe(s.it)) prog.t0perf = performance.now() - decalage * 1000;
}
function boucleProg() {
  if (!prog.lecture) return;
  const s = prog.seg;
  if (s.it.type === 'plan' && !estFixe(s.it)) {
    const v = PV[prog.actif];
    prog.t = Math.max(s.debut, s.debut + (v.currentTime - s.it.entree));
    if (versionSon(s.it) && !aSon.paused && Math.abs(aSon.currentTime - v.currentTime) > 0.12) aSon.currentTime = v.currentTime;
    if (v.ended || v.currentTime >= s.it.sortie - 0.5 / F() || prog.t >= s.fin) return segmentSuivant();
  } else {
    prog.t = s.debut + (performance.now() - prog.t0perf) / 1000;
    if (prog.t >= s.fin) return segmentSuivant();
  }
  if (!prog.prepare && s.fin - prog.t < 1.2) {
    const n = seq.segs[s.k + 1];
    prog.prepare = n ?? true;
    if (n?.it.type === 'plan' && !estFixe(n.it)) {
      const v = PV[1 - prog.actif];
      mettreMedia(v, media(n.it.media));
      v.currentTime = n.it.entree;
    }
  }
  majTete();
  majIndicEcran();
  majDessus(true);
  majCadre();
  if (s.it.type === 'plan' && !estFixe(s.it)) { const mv = media(s.it.media); if (mv?.type === 'video') placer(PV[prog.actif], mv, PV[prog.actif].currentTime); }
  majHabillage();
  suivreTete();
  prog.raf = requestAnimationFrame(boucleProg);
}
function segmentSuivant() {
  const s = seq.segs[prog.seg.k + 1];
  if (!s) {
    progPause();
    prog.t = seq.duree;
    progAfficher();
    return;
  }
  if (s.it.type === 'plan' && !estFixe(s.it) && prog.prepare === s) prog.actif = 1 - prog.actif;
  prog.t = s.debut;
  demarrerSegment(s, 0);
  prog.raf = requestAnimationFrame(boucleProg);
}
function sautElement(sens) {
  const bornes = [0, ...seq.segs.map((s) => s.fin)];
  const t = prog.t;
  const cible = sens > 0 ? bornes.find((b) => b > t + 1e-6) : [...bornes].reverse().find((b) => b < t - 1e-6);
  if (cible != null) { progPause(); definirMode('montage'); progPositionner(cible); }
}

// =====================================================================
// Chronologie
// =====================================================================
const ZMIN = 2;
const ZMAX = 1500;
const ppsDepuisZoom = (v) => ZMIN * (ZMAX / ZMIN) ** (v / 100);
const zoomDepuisPps = (p) => (100 * Math.log(p / ZMIN)) / Math.log(ZMAX / ZMIN);
const TL = $('#tl');
const tempsDepuisX = (clientX) => (clientX - $('#tl-interieur').getBoundingClientRect().left) / ui.pps;
/**
 * La partie de la timeline qu'on dessine : ce qui est à l'écran, plus un écran de marge de chaque côté. Zoomée à fond,
 * la timeline mesure plus d'un million de pixels : tout dessiner (graduations, vignettes, ondes) bloquait l'app.
 */
let vueDessinee = {x0: 0, x1: 0};
function vueTl() {
  const w = TL.clientWidth || 1200;
  return {x0: Math.max(0, TL.scrollLeft - w), x1: TL.scrollLeft + 2 * w};
}
const largeurTl = () => {
  const finDessus = Math.max(0, ...P.superpositions.map((s) => s.debut + s.sortie - s.entree), ...P.indications.map((i) => i.fin));
  return Math.max(seq.duree + 20, finDessus + 10, dureeClaudeTl() + 10, 30) * ui.pps + 200;
};
function rendreTimeline() {
  const largeur = largeurTl();
  $('#tl-interieur').style.width = `${largeur}px`;
  vueDessinee = vueTl();
  rendreRegle(largeur);
  rendreIndications();
  rendreDessus();
  rendreMontage();
  rendreClaudePiste();
  majTete();
}
function rendreRegle(largeur) {
  const pas = [1 / F(), 2 / F(), 5 / F(), 10 / F(), 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800].find((p) => p * ui.pps >= 84) ?? 3600;
  const petit = pas / 5;
  let html = '';
  // seulement les graduations de la partie visible
  const k0 = Math.floor(vueDessinee.x0 / ui.pps / pas);
  const k1 = Math.ceil(Math.min(largeur, vueDessinee.x1) / ui.pps / pas);
  for (let k = k0; k <= k1; k++) {
    const t = k * pas;
    const label = pas < 1 ? tc(t, F()) : t >= 3600 ? tc(t, F()).slice(0, 8) : tc(t, F()).slice(3, 8);
    html += `<div class="trait" style="left:${t * ui.pps}px">${label}</div>`;
    if (petit * ui.pps >= 12) for (let j = 1; j < 5; j++) html += `<div class="trait petit" style="left:${(t + j * petit) * ui.pps}px"></div>`;
  }
  const repere = $('#fin-montage');
  repere.style.left = `${seq.duree * ui.pps}px`;
  repere.classList.toggle('cache', !seq.duree);
  $('#regle').innerHTML = html;
}
function couloirs(liste, debut, fin) {
  const tri = [...liste].sort((a, b) => debut(a) - debut(b));
  const fins = [];
  const res = new Map();
  for (const x of tri) {
    let k = fins.findIndex((f) => f <= debut(x) + 1e-9);
    if (k < 0) { k = fins.length; fins.push(0); }
    fins[k] = fin(x);
    res.set(x.id, k);
  }
  return {res, n: Math.max(1, fins.length)};
}
function rendreIndications() {
  const piste = $('#piste-indic');
  const {res, n} = couloirs(P.indications, (i) => i.debut, (i) => i.fin);
  piste.style.height = `${28 + n * 26}px`;
  piste.innerHTML = `<span class="piste-nom">${ic('baguette')}Effets et notes</span>${P.indications.map((i) => {
    const sel = ui.sel?.type === 'indic' && ui.sel.id === i.id;
    const pos = `left:${i.debut * ui.pps}px;width:${Math.max(6, (i.fin - i.debut) * ui.pps)}px;top:${22 + res.get(i.id) * 26}px`;
    if (estEffet(i)) {
      const d = CATALOGUE[i.modele];
      const court = (i.fin - i.debut) * ui.pps < 64;
      return `<div class="indic effet cat-${d.categorie}${court ? ' court' : ''}${sel ? ' sel' : ''}" data-id="${i.id}" style="${pos};min-width:${court ? 20 : 6}px" title="${esc(resumeEffet(i))}">${court || d.categorie === 'transition' || d.categorie === 'son' ? '' : '<span class="poignee g"></span>'}${ic(ICONE_CAT[d.categorie])}<span class="nom">${esc(resumeEffet(i))}</span>${court || d.categorie === 'transition' || d.categorie === 'son' ? '' : '<span class="poignee d"></span>'}</div>`;
    }
    return `<div class="indic${sel ? ' sel' : ''}" data-id="${i.id}" style="${pos}" title="${esc(`${GENRES_INDICATION[i.genre]} — ${i.consigne}`)}"><span class="poignee g"></span>${esc(GENRES_INDICATION[i.genre])} — ${esc(i.consigne || '…')}<span class="poignee d"></span></div>`;
  }).join('')}`;
}
function rendreDessus() {
  const piste = $('#piste-dessus');
  const {res, n} = couloirs(P.superpositions, (s) => s.debut, (s) => s.debut + s.sortie - s.entree);
  piste.style.height = `${12 + n * 28}px`;
  piste.innerHTML = `<span class="piste-nom">${ic('calques')}Par-dessus</span>${P.superpositions.map((s) => {
    const m = media(s.media);
    const sel = ui.sel?.type === 'dessus' && ui.sel.id === s.id;
    return `<div class="dessus${sel ? ' sel' : ''}" data-id="${s.id}" style="left:${s.debut * ui.pps}px;width:${Math.max(6, (s.sortie - s.entree) * ui.pps)}px;top:${6 + res.get(s.id) * 28}px" title="${esc(`${s.id} · ${m?.nom ?? ''}`)}"><span class="poignee g"></span><b>${esc(s.id)}</b> ${esc(s.titre || m?.nom || '')}${s.cadre === 'incrustation' ? ' · incrustation' : ''}<span class="poignee d"></span></div>`;
  }).join('')}`;
}
function rendreMontage() {
  const piste = $('#piste-montage');
  const parts = [`<span class="piste-nom">${ic('film')}Montage</span>`];
  if (!seq.segs.length) parts.push(`<div class="depose-ici"><span>${P.medias.length ? '<b>Glisse un média ici</b> ou clique sur le + de sa vignette' : modeProjet() === 'motion' ? '<b>Rien à importer</b> : décris ton animation à droite, la vidéo de ton IA et ses blocs apparaîtront en dessous' : '<b>Importe tes vidéos</b>, puis glisse-les ici'}</span></div>`);
  const aDessiner = [];
  const aCharger = new Set();
  for (const s of seq.segs) {
    const it = s.it;
    const L = Math.max(3, (s.fin - s.debut) * ui.pps);
    const sel = (ui.sel?.type === 'item' && ui.sel.id === it.id) || ui.multi.has(it.id);
    const pos = `left:${s.debut * ui.pps}px;width:${L}px`;
    if (it.type === 'plan') {
      const m = media(it.media);
      if (!m) continue;
      const sonSeul = m.type === 'audio';
      const fixe = m.type === 'image';
      const images = sonSeul ? '' : vignettesVisibles(it, m, s.debut * ui.pps, L);
      const ext = extraitPlan(it, sonSeul ? 220 : 120);
      const version = versionSon(it);
      const badges = `${it.essentiel ? `<span class="etoile" title="Essentiel : l’IA doit le garder">${ic('etoile', 'plein')}</span>` : ''}${fixe ? '<span>photo</span>' : ''}`;
      parts.push(`<div class="clip plan${sonSeul ? ' son-seul' : ''}${fixe ? ' fixe' : ''}${it.son?.actif === false ? ' muet' : ''}${sel ? ' sel' : ''}" data-id="${it.id}" style="${pos}" title="${esc(`${it.id} · ${m.nom} ${tc(it.entree, fpsSrc(m))} → ${tc(it.sortie, fpsSrc(m))}`)}"><div class="images">${images}</div>${badges ? `<div class="badges">${badges}</div>` : ''}<div class="titre-clip"><b>${it.id}</b>${esc(it.titre || m.nom)}${version ? ` · ${version === 'voix' ? 'voix seule' : 'sans la voix'}` : ''}${ext ? ` <span style="opacity:.7">« ${esc(ext)} »</span>` : ''}</div><canvas data-onde="${it.id}"></canvas><span class="poignee g"></span><span class="poignee d"></span></div>`);
      // débordement du son (J-cut avant, L-cut après)
      const {avant, apres} = debordements(it);
      if (avant || apres) parts.push(`<div class="son-deborde" style="left:${(s.debut - avant) * ui.pps}px;width:${(s.fin - s.debut + avant + apres) * ui.pps}px" title="Le son déborde : ${avant ? `${avant} s avant` : ''}${avant && apres ? ', ' : ''}${apres ? `${apres} s après` : ''}"></div>`);
      aDessiner.push(it);
      if (!C.mots.has(m.id)) aCharger.add(m);
    } else {
      const nRefs = (P.references ?? []).filter((r) => r.cible === it.id).length;
      parts.push(`<div class="clip case${sel ? ' sel' : ''}" data-id="${it.id}" style="${pos}" title="Glisse ici des images, des modèles 3D ou des documents pour l’IA"><div class="titre-clip">${nRefs ? `<span class="nb-refs" title="${nRefs} fichier(s) pour l’IA">${ic('trombone')}${nRefs}</span>` : ''}<b>${it.id}</b> À créer · ${esc(GENRES_BLOC[it.genre])}${it.titre ? ` — ${esc(it.titre)}` : ''}<br><span style="opacity:.75">${esc(it.consigne || '')}</span></div><span class="poignee g"></span><span class="poignee d"></span></div>`);
    }
  }
  piste.innerHTML = parts.join('');
  if (ui.clipsVus) for (const c of $$('.clip', piste)) if (!ui.clipsVus.has(c.dataset.id)) c.classList.add('neuf');
  ui.clipsVus = new Set(P.montage.map((it) => it.id));
  for (const it of aDessiner) {
    const m = media(it.media);
    if (C.ondes.has(m.id)) dessinerOndeClip(it);
    else charger('ondes', m).then(() => dessinerOndeClip(it));
  }

  // le texte des plans arrive après coup : on réaffiche une fois chargé
  if (aCharger.size) Promise.all([...aCharger].map((m) => charger('mots', m))).then(() => { rendreMontage(); if (!prog.lecture) progAfficher(); });
}
/** Les vignettes d'un plan, seulement là où la timeline est visible (gauche : le bord du plan, L : sa largeur, en px). */
function vignettesVisibles(it, m, gauche, L) {
  if (!m.vignettes) return '';
  const lw = (m.vignettes.l * 40) / m.vignettes.h;
  const n = Math.max(1, Math.ceil(L / lw));
  const j0 = Math.max(0, Math.floor((vueDessinee.x0 - gauche) / lw));
  const j1 = Math.min(n - 1, Math.floor((vueDessinee.x1 - gauche) / lw));
  let html = '';
  for (let j = j0; j <= j1; j++) html += `<div style="left:${j * lw}px;${styleVignette(m, it.entree + ((j + 0.5) / n) * (it.sortie - it.entree), 40)}"></div>`;
  return html;
}
/** L'onde d'un plan : dessinée seulement sur sa partie visible (la toile ne couvre que cette partie). */
function dessinerOndeClip(it) {
  const cv = $(`canvas[data-onde="${it.id}"]`);
  const m = media(it.media);
  const o = m && C.ondes.get(m.id);
  const s = seq.segs.find((x) => x.it.id === it.id);
  if (!cv || !o || !s) return;
  const gauche = s.debut * ui.pps;
  const L = Math.max(3, (s.fin - s.debut) * ui.pps);
  const a = Math.max(0, vueDessinee.x0 - gauche);
  const b = Math.min(L, vueDessinee.x1 - gauche);
  if (b <= a) { cv.style.width = '0px'; return; }
  cv.style.left = `${a}px`;
  cv.style.width = `${b - a}px`;
  const W = Math.max(1, Math.round((b - a) * DPR()));
  const H = Math.round((cv.clientHeight || 16) * DPR());
  if (!H) return;
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = m.type === 'video' ? 'rgba(255,170,160,0.85)' : '#64d2ff';
  const duree = it.sortie - it.entree;
  g.beginPath();
  for (let x = 0; x < W; x++) {
    const t0 = it.entree + ((a + (x / W) * (b - a)) / L) * duree;
    const t1 = it.entree + ((a + ((x + 1) / W) * (b - a)) / L) * duree;
    let mx = 0;
    const i0 = Math.floor(t0 * o.pps);
    const i1 = Math.max(i0 + 1, Math.ceil(t1 * o.pps));
    for (let i = i0; i < i1 && i < o.niveaux.length; i++) if (o.niveaux[i] > mx) mx = o.niveaux[i];
    const hh = Math.max(0.5, (mx / 100) * (H - 2));
    g.rect(x, H - hh, 1, hh);
  }
  g.fill();
}
/** On a fait défiler la timeline hors de la partie dessinée : on dessine la nouvelle (graduations, vignettes, ondes). */
function dessinerPartieVisible() {
  if (!P || ui.ecran !== 'montage') return;
  vueDessinee = vueTl();
  rendreRegle(parseFloat($('#tl-interieur').style.width) || largeurTl());
  for (const s of seq.segs) {
    const it = s.it;
    if (it.type !== 'plan') continue;
    const m = media(it.media);
    const el = m && $(`#piste-montage .clip[data-id="${it.id}"]`);
    if (!el) continue;
    if (m.type !== 'audio') el.querySelector('.images').innerHTML = vignettesVisibles(it, m, s.debut * ui.pps, Math.max(3, (s.fin - s.debut) * ui.pps));
    dessinerOndeClip(it);
  }
}
/** Une seule fois par image affichée (et quand même si la fenêtre est cachée, où les images ne passent plus). */
function prochaineImage(fn) {
  let fait = false;
  const go = () => { if (!fait) { fait = true; fn(); } };
  requestAnimationFrame(go);
  setTimeout(go, 48);
}
let defilementPrevu = false;
TL.addEventListener('scroll', () => {
  if (defilementPrevu) return;
  defilementPrevu = true;
  prochaineImage(() => {
    defilementPrevu = false;
    const w = TL.clientWidth || 1200;
    // encore un demi-écran d'avance de chaque côté : rien à faire
    if ((TL.scrollLeft - vueDessinee.x0 >= w * 0.5 || vueDessinee.x0 <= 0) && vueDessinee.x1 - (TL.scrollLeft + w) >= w * 0.5) return;
    dessinerPartieVisible();
  });
}, {passive: true});
function suivreTete() {
  const x = prog.t * ui.pps;
  if (x < TL.scrollLeft + 20 || x > TL.scrollLeft + TL.clientWidth - 60) TL.scrollLeft = Math.max(0, x - TL.clientWidth * 0.15);
}
function montrerDansTimeline(t) {
  const x = t * ui.pps;
  if (x < TL.scrollLeft || x > TL.scrollLeft + TL.clientWidth - 40) TL.scrollLeft = Math.max(0, x - TL.clientWidth / 2);
}
// ——— Aimant (idée de FreeCut, licence MIT) : les bords collent aux bords des plans et à la tête de lecture. ⌘ pour s'en passer. ———
const AIMANT_PX = 8;
function ciblesAimant({tete = true, exclure = null} = {}) {
  const c = [0, seq.duree];
  for (const s of seq.segs) c.push(s.debut, s.fin);
  if (tete) c.push(prog.t);
  for (const i of P.indications) if (i.id !== exclure) c.push(i.debut, i.fin);
  for (const s of P.superpositions) if (s.id !== exclure) c.push(s.debut, s.debut + s.sortie - s.entree);
  return c;
}
function aimanter(t, cibles, ev, px = AIMANT_PX) {
  if (ev?.metaKey || ev?.ctrlKey) { cacherGuide(); return t; }
  let best = null;
  let ecart = px / ui.pps;
  for (const c of cibles) {
    const d = Math.abs(c - t);
    if (d <= ecart) { ecart = d; best = c; }
  }
  if (best == null) { cacherGuide(); return t; }
  const g = $('#guide-aimant');
  g.style.left = `${best * ui.pps}px`;
  g.classList.remove('cache');
  return best;
}
const cacherGuide = () => $('#guide-aimant').classList.add('cache');

// ——— Mode ciseaux (idée de FreeCut) : un clic sur un plan le coupe là ; colle à la tête de lecture à 10 px près ———
function definirOutil(o) {
  ui.outil = o;
  TL.classList.toggle('outil-lame', o === 'lame');
  $('#b-lame').classList.toggle('actif', o === 'lame');
  $('#guide-lame').classList.add('cache');
  if (o === 'lame') note('Mode ciseaux : clique sur un plan pour le couper. V ou Échap pour revenir.');
}
function positionLame(ev) {
  const t = Math.max(0, tempsDepuisX(ev.clientX));
  const colle = !prog.lecture && Math.abs(t - prog.t) * ui.pps <= 10;
  return {t: colle ? prog.t : surGrille(t, F()), colle};
}
$('#tl-interieur').addEventListener('pointermove', (e) => {
  const g = $('#guide-lame');
  if (ui.outil !== 'lame' || !e.target.closest('.clip')) return g.classList.add('cache');
  const {t, colle} = positionLame(e);
  g.style.left = `${t * ui.pps}px`;
  g.classList.toggle('colle', colle);
  g.classList.remove('cache');
});
$('#tl-interieur').addEventListener('pointerleave', () => $('#guide-lame').classList.add('cache'));

function regler(ev) {
  progPause();
  if (ui.mode !== 'montage') definirMode('montage');
  const t = Math.max(0, tempsDepuisX(ev.clientX));
  progPositionner(surGrille(aimanter(t, ciblesAimant({tete: false}), ev, 6), F()));
}
$('#tl-interieur').addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const poignee = e.target.closest('.poignee');
  const clip = e.target.closest('.clip');
  const ind = e.target.closest('.indic');
  const des = e.target.closest('.dessus');
  if (ui.outil === 'lame' && clip && !poignee) {
    e.preventDefault();
    return couper(positionLame(e).t);
  }
  if (!clip && !ind && !des) {
    if (!e.target.closest('#regle')) selectionner(null);
    regler(e);
    const bouger = (ev) => regler(ev);
    window.addEventListener('pointermove', bouger);
    window.addEventListener('pointerup', () => { window.removeEventListener('pointermove', bouger); cacherGuide(); }, {once: true});
    return;
  }
  e.preventDefault();
  const cote = poignee ? (poignee.classList.contains('g') ? 'g' : 'd') : 'tout';
  if (clip && poignee) return rogner(e, clip.dataset.id, cote);
  if (ind) return bougerLibre(e, 'indic', ind.dataset.id, cote);
  if (des) return bougerLibre(e, 'dessus', des.dataset.id, cote);
  return glisser(e, clip.dataset.id);
});
// — déposer une vignette de média dans la timeline —
function cibleDepot(e) {
  const t = Math.max(0, tempsDepuisX(e.clientX));
  const r = $('#piste-dessus').getBoundingClientRect();
  if (e.clientY >= r.top && e.clientY < r.bottom) return {type: 'dessus', t: surGrille(t, F())};
  let k = seq.segs.findIndex((s) => (s.debut + s.fin) / 2 > t);
  if (k < 0) k = seq.segs.length;
  return {type: 'montage', k};
}
function finDepotTimeline() {
  TL.classList.remove('depot-actif');
  $('#insertion').classList.add('cache');
  $('#fantome-depot')?.remove();
}
const glisseUnMedia = (e) => !!ui.glisseMedia || [...(e.dataTransfer?.types ?? [])].includes('application/x-derush-media');
TL.addEventListener('dragover', (e) => {
  if (!glisseUnMedia(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  TL.classList.add('depot-actif');
  const c = cibleDepot(e);
  const ins = $('#insertion');
  let fantome = $('#fantome-depot');
  if (c.type === 'dessus') {
    ins.classList.add('cache');
    const m = media(ui.glisseMedia);
    if (!fantome) {
      fantome = document.createElement('div');
      fantome.id = 'fantome-depot';
      fantome.className = 'fantome';
      $('#piste-dessus').append(fantome);
    }
    const p = m ? passageDe(m) : null;
    fantome.style.left = `${c.t * ui.pps}px`;
    fantome.style.width = `${Math.max(8, ((p ? p.b - p.a : 3)) * ui.pps)}px`;
  } else {
    fantome?.remove();
    ins.classList.remove('cache');
    ins.style.left = `${(c.k < seq.segs.length ? seq.segs[c.k].debut : seq.duree) * ui.pps}px`;
  }
});
TL.addEventListener('dragleave', (e) => { if (!TL.contains(e.relatedTarget)) finDepotTimeline(); });
TL.addEventListener('drop', (e) => {
  const id = e.dataTransfer?.getData('application/x-derush-media') || ui.glisseMedia;
  if (!id) return; // des fichiers venant du Finder : la fenêtre s'en occupe
  e.preventDefault();
  e.stopPropagation();
  const c = cibleDepot(e);
  finDepotTimeline();
  ui.glisseMedia = null;
  poserMedia(id, c);
  if (ui.mode !== 'montage') definirMode('montage'); // lâcher dans la timeline : on regarde le montage
});
$('#tl-interieur').addEventListener('dblclick', (e) => {
  const clip = e.target.closest('.clip');
  const des = e.target.closest('.dessus');
  const it = clip ? item(clip.dataset.id) : des ? dessus(des.dataset.id) : null;
  if (it?.media) chargerRush(it.media, it.entree, it.sortie);
});
/** Rogner un plan (ou changer la durée d'une case) : les éléments suivants se décalent. */
function rogner(e, id, cote) {
  const it = item(id);
  if (!it) return;
  if (ui.sel?.id !== id) selectionner({type: 'item', id});
  const avant = instantane();
  const orig = {...it};
  const x0 = e.clientX;
  const m = it.type === 'plan' ? media(it.media) : null;
  const f = m ? fpsSrc(m) : F();
  // l'aimant pour le bord droit : la tête de lecture, les notes et les plans par-dessus
  const debutSeg = seq.segs.find((s) => s.it.id === id)?.debut ?? 0;
  const cibles = [prog.t, ...P.indications.flatMap((i) => [i.debut, i.fin]), ...P.superpositions.flatMap((s) => [s.debut, s.debut + s.sortie - s.entree])];
  let change = false;
  const bouger = (ev) => {
    let dt = (ev.clientX - x0) / ui.pps;
    if (cote === 'd') {
      const finVoulue = debutSeg + (it.type === 'plan' ? orig.sortie - orig.entree : orig.duree) + dt;
      dt += aimanter(finVoulue, cibles, ev) - finVoulue;
    }
    if (it.type === 'plan') {
      if (cote === 'g') it.entree = borner(surGrille(orig.entree + dt, f), 0, it.sortie - 1 / f);
      else it.sortie = borner(surGrille(orig.sortie + dt, f), it.entree + 1 / f, m.duree);
      bulle(ev, `${cote === 'g' ? 'début' : 'fin'} ${tc(cote === 'g' ? it.entree : it.sortie, f)}\ndurée ${tc(it.sortie - it.entree, f)}`);
    } else {
      it.duree = Math.max(1 / F(), surGrille(orig.duree + (cote === 'd' ? dt : -dt), F()));
      bulle(ev, `durée ${tc(it.duree, F())}`);
    }
    change = true;
    seq = sequence(P);
    rendreTimeline();
  };
  const fin = () => {
    window.removeEventListener('pointermove', bouger);
    bulleCacher();
    cacherGuide();
    if (!change) return;
    ui.annuler.push(avant);
    ui.refaire = [];
    derniereModif = {cle: null, t: 0};
    apresModif();
  };
  window.addEventListener('pointermove', bouger);
  window.addEventListener('pointerup', fin, {once: true});
}
/** Glisser un élément pour changer l'ordre du montage. */
function glisser(e, id) {
  const x0 = e.clientX;
  const el = $(`.clip[data-id="${id}"]`);
  const ins = $('#insertion');
  let actif = false;
  let cible = null;
  const bouger = (ev) => {
    if (!actif && Math.abs(ev.clientX - x0) < 5) return;
    actif = true;
    el.classList.add('glisse');
    el.style.transform = `translateX(${ev.clientX - x0}px)`;
    const t = tempsDepuisX(ev.clientX);
    let k = seq.segs.findIndex((s) => (s.debut + s.fin) / 2 > t);
    if (k < 0) k = seq.segs.length;
    cible = k;
    ins.classList.remove('cache');
    ins.style.left = `${(k < seq.segs.length ? seq.segs[k].debut : seq.duree) * ui.pps}px`;
  };
  const fin = () => {
    window.removeEventListener('pointermove', bouger);
    ins.classList.add('cache');
    if (!actif) {
      if (e.shiftKey || e.metaKey) return basculerMulti(id); // ⇧ ou ⌘ : sélection de plusieurs plans
      selectionner({type: 'item', id});
      const s = seq.segs.find((x) => x.it.id === id);
      if (s && (prog.t < s.debut || prog.t >= s.fin)) { if (ui.mode !== 'montage') definirMode('montage'); progPositionner(s.debut); }
      return;
    }
    const k0 = P.montage.findIndex((it) => it.id === id);
    let k = cible;
    if (k > k0) k--;
    if (k === k0 || k == null) return rendreTimeline();
    modifier(() => {
      const [it] = P.montage.splice(k0, 1);
      P.montage.splice(k, 0, it);
      ui.sel = {type: 'item', id};
    });
  };
  window.addEventListener('pointermove', bouger);
  window.addEventListener('pointerup', fin, {once: true});
}
/** Déplacer ou redimensionner une indication ou un plan par-dessus (libres sur la chronologie). */
function bougerLibre(e, type, id, mode) {
  const x = type === 'indic' ? indication(id) : dessus(id);
  if (!x) return;
  if (ui.sel?.id !== id) selectionner({type, id});
  const avant = instantane();
  const orig = {...x};
  const x0 = e.clientX;
  const m = type === 'dessus' ? media(x.media) : null;
  const f = m ? fpsSrc(m) : F();
  const cibles = ciblesAimant({exclure: id});
  const longueur = type === 'indic' ? orig.fin - orig.debut : orig.sortie - orig.entree;
  let change = false;
  const bouger = (ev) => {
    if (Math.abs(ev.clientX - x0) < 3 && !change) return;
    let dt = (ev.clientX - x0) / ui.pps;
    // l'aimant : le début (ou la fin) colle aux bords des plans et à la tête de lecture
    if (mode === 'tout') {
      const d0 = orig.debut + dt;
      const a = aimanter(d0, cibles, ev);
      if (a !== d0) dt += a - d0;
      else { const f0 = d0 + longueur; dt += aimanter(f0, cibles, ev) - f0; }
    } else if (mode === 'd') {
      const f0 = (type === 'indic' ? orig.fin : orig.debut + longueur) + dt;
      dt += aimanter(f0, cibles, ev) - f0;
    } else {
      const d0 = orig.debut + dt;
      dt += aimanter(d0, cibles, ev) - d0;
    }
    if (type === 'indic') {
      const d = orig.fin - orig.debut;
      if (mode === 'tout') { x.debut = Math.max(0, surGrille(orig.debut + dt, F())); x.fin = x.debut + d; }
      if (mode === 'g') x.debut = borner(surGrille(orig.debut + dt, F()), 0, x.fin - 1 / F());
      if (mode === 'd') x.fin = Math.max(x.debut + 1 / F(), surGrille(orig.fin + dt, F()));
      bulle(ev, `${tc(x.debut, F())} → ${tc(x.fin, F())}`);
      rendreIndications();
    } else {
      if (mode === 'tout') x.debut = Math.max(0, surGrille(orig.debut + dt, F()));
      if (mode === 'g') {
        const ent = borner(surGrille(orig.entree + dt, f), Math.max(0, orig.entree - orig.debut), x.sortie - 1 / f);
        x.entree = ent;
        x.debut = Math.max(0, orig.debut + (ent - orig.entree));
      }
      if (mode === 'd') x.sortie = borner(surGrille(orig.sortie + dt, f), x.entree + 1 / f, m.duree);
      bulle(ev, `${tc(x.debut, F())} → ${tc(x.debut + x.sortie - x.entree, F())}`);
      rendreDessus();
    }
    change = true;
  };
  const fin = () => {
    window.removeEventListener('pointermove', bouger);
    bulleCacher();
    cacherGuide();
    if (!change) {
      if (ui.mode !== 'montage') definirMode('montage');
      progPositionner(x.debut);
      return;
    }
    ui.annuler.push(avant);
    ui.refaire = [];
    if (type === 'indic' && estEffet(x)) { recaler(x); ancrer(x); }
    apresModif();
  };
  window.addEventListener('pointermove', bouger);
  window.addEventListener('pointerup', fin, {once: true});
}
function ajouterCase(genre = 'scene') {
  let b;
  modifier(() => {
    b = {id: nouvelId(P, 'B'), type: 'bloc', genre: GENRES_BLOC[genre] ? genre : 'scene', duree: 3, titre: '', consigne: '', references: ''};
    P.montage.splice(indexInsertion(), 0, b);
    ui.sel = {type: 'item', id: b.id};
  });
  const s = seq.segs.find((x) => x.it.id === b.id);
  if (s) { definirMode('montage'); progPositionner(s.debut); montrerDansTimeline(s.debut); }
  note(`Case « ${GENRES_BLOC[b.genre]} » ajoutée : écris à droite ce que l’IA doit créer.`);
  setTimeout(() => $('#inspecteur [data-champ="consigne"]')?.focus(), 30);
}
function ajouterIndication(genre = 'texte') {
  const debut = surGrille(prog.t, F());
  let i;
  modifier(() => {
    i = {id: nouvelId(P, 'I'), genre: GENRES_INDICATION[genre] ? genre : 'note', debut, fin: debut + 2, consigne: ''};
    P.indications.push(i);
    ui.sel = {type: 'indic', id: i.id};
  });
  if (ui.mode !== 'montage') definirMode('montage');
  note(`Note « ${GENRES_INDICATION[i.genre]} » posée à ${tc(debut, F()).slice(3, 8)} : écris la consigne à droite.`);
  setTimeout(() => $('#inspecteur [data-champ="consigne"]')?.focus(), 30);
}
/** Couper le plan à un instant du montage (la tête de lecture, ou là où l'on clique en mode ciseaux). */
function couper(instant = prog.t) {
  if (ui.mode !== 'montage') definirMode('montage'); // on coupe toujours dans le montage
  const s = segmentA(seq, instant);
  if (!s) return note('Place la tête de lecture sur un plan pour le couper.', true);
  if (s.it.type === 'bloc') {
    // une case à créer se coupe aussi : deux cases, la durée partagée
    const d1 = surGrille(instant - s.debut, F());
    if (d1 < 1 / F() || s.it.duree - d1 < 1 / F()) return;
    return modifier(() => {
      const deux = {...structuredClone(s.it), id: nouvelId(P, 'B'), duree: s.it.duree - d1};
      s.it.duree = d1;
      P.montage.splice(s.k + 1, 0, deux);
      ui.sel = {type: 'item', id: deux.id};
    });
  }
  const m = media(s.it.media);
  const f = fpsSrc(m);
  const t = surGrille(s.it.entree + (instant - s.debut), f);
  if (t <= s.it.entree + 0.5 / f || t >= s.it.sortie - 0.5 / f) return note('C’est le bord du plan : rien à couper.', true);
  modifier(() => {
    const deux = {...structuredClone(s.it), id: nouvelId(P, 'P'), entree: t};
    s.it.sortie = t;
    P.montage.splice(s.k + 1, 0, deux);
    ui.sel = {type: 'item', id: deux.id};
  });
}
/** Q et W (comme dans OpenReel) : enlever le début ou la fin du plan, jusqu'à la tête de lecture. Le reste se recolle. */
function rognerATete(cote) {
  if (ui.mode !== 'montage') definirMode('montage');
  const s = segmentA(seq, prog.t);
  if (!s) return note('Place la tête de lecture sur un plan.', true);
  const it = s.it;
  const dt = prog.t - s.debut;
  if (it.type === 'bloc') {
    const d = surGrille(cote === 'debut' ? it.duree - dt : dt, F());
    if (d < 1 / F() || Math.abs(d - it.duree) < 0.5 / F()) return;
    modifier(() => { it.duree = d; });
  } else {
    const m = media(it.media);
    const f = fpsSrc(m);
    const t = surGrille(it.entree + dt, f);
    if (cote === 'debut') {
      if (t <= it.entree + 0.5 / f) return note('La tête de lecture est déjà au début du plan.');
      modifier(() => { it.entree = t; });
    } else {
      if (t >= it.sortie - 0.5 / f) return note('La tête de lecture est déjà à la fin du plan.');
      modifier(() => { it.sortie = t; });
    }
  }
  if (cote === 'debut') progPositionner(s.debut);
}
// ——— Sélection de plusieurs plans (⇧ ou ⌘ + clic, ⌘A) ———
const idsSelectionnes = () => (ui.multi.size ? [...ui.multi].filter((id) => item(id)) : ui.sel?.type === 'item' && item(ui.sel.id) ? [ui.sel.id] : []);
function majSelectionClips() {
  $$('#piste-montage .clip').forEach((c) => c.classList.toggle('sel', ui.multi.has(c.dataset.id) || (ui.sel?.type === 'item' && ui.sel.id === c.dataset.id)));
}
function basculerMulti(id) {
  if (!ui.multi.size && ui.sel?.type === 'item') ui.multi.add(ui.sel.id);
  if (ui.multi.has(id)) ui.multi.delete(id); else ui.multi.add(id);
  ui.sel = ui.multi.size ? {type: 'item', id: [...ui.multi].at(-1)} : null;
  if (ui.multi.size === 1) ui.multi.clear();
  majSelectionClips();
  rendreInspecteur();
}
function toutSelectionner() {
  if (!P.montage.length) return;
  ui.multi = new Set(P.montage.map((it) => it.id));
  ui.sel = {type: 'item', id: P.montage.at(-1).id};
  majSelectionClips();
  rendreInspecteur();
}
function supprimer() {
  const ids = idsSelectionnes();
  if (ids.length > 1) {
    modifier(() => {
      P.montage = P.montage.filter((it) => !ids.includes(it.id));
      ui.sel = null;
      ui.multi.clear();
    });
    return note(`${ids.length} éléments supprimés (⌘Z pour annuler).`);
  }
  if (!ui.sel) return note('Sélectionne d’abord un élément.', true);
  const sel = ui.sel;
  modifier(() => {
    if (sel.type === 'item') P.montage = P.montage.filter((it) => it.id !== sel.id);
    if (sel.type === 'indic') P.indications = P.indications.filter((i) => i.id !== sel.id);
    if (sel.type === 'dessus') P.superpositions = P.superpositions.filter((s) => s.id !== sel.id);
    ui.sel = null;
  });
}
function dupliquer() {
  const ids = idsSelectionnes();
  if (!ids.length) return note('Sélectionne d’abord un plan.', true);
  const k = Math.max(...ids.map((id) => P.montage.findIndex((it) => it.id === id))) + 1;
  inserer(P.montage.filter((it) => ids.includes(it.id)), k);
}
/** Insère des copies d'éléments (copier-coller, dupliquer) à la position k. */
function inserer(elements, k) {
  let dernier = null;
  modifier(() => {
    for (const it of elements) {
      const c = {...structuredClone(it), id: nouvelId(P, it.type === 'plan' ? 'P' : 'B')};
      P.montage.splice(k++, 0, c);
      dernier = c.id;
    }
    ui.multi.clear();
    ui.sel = dernier ? {type: 'item', id: dernier} : null;
  });
}
function copier(enleverAussi = false) {
  const ids = idsSelectionnes();
  if (!ids.length) return note('Sélectionne d’abord un ou plusieurs plans.', true);
  ui.pressePapiers = P.montage.filter((it) => ids.includes(it.id)).map((it) => structuredClone(it));
  if (enleverAussi) supprimer();
  else note(`${ids.length} élément${ids.length > 1 ? 's' : ''} copié${ids.length > 1 ? 's' : ''} : ⌘V pour coller à la tête de lecture.`);
}
function coller() {
  if (!ui.pressePapiers?.length) return note('Rien à coller.', true);
  if (ui.mode !== 'montage') definirMode('montage');
  const s = segmentA(seq, prog.t);
  inserer(ui.pressePapiers, s ? s.k + 1 : P.montage.length);
}
let zoomVoulu = null; // {v, centre, x} : le zoom demandé, appliqué à la prochaine image
function zoomer(v, centre = prog.t) {
  v = borner(v, 0, 100);
  $('#zoom').value = v;
  // plusieurs crans dans la même image (molette, pincement) : on garde le point d'ancrage du premier, le zoom du dernier
  if (zoomVoulu) { zoomVoulu.v = v; return; }
  zoomVoulu = {v, centre, x: centre * ui.pps - TL.scrollLeft};
  prochaineImage(appliquerZoom);
}
function appliquerZoom() {
  const z = zoomVoulu;
  zoomVoulu = null;
  if (!z || !P) return;
  ui.pps = ppsDepuisZoom(z.v);
  // la largeur d'abord, puis la position, puis le dessin de ce qui est visible à cette position
  $('#tl-interieur').style.width = `${largeurTl()}px`;
  TL.scrollLeft = Math.max(0, z.centre * ui.pps - z.x);
  rendreTimeline();
}
function toutVoir() {
  zoomVoulu = null;
  ui.pps = borner((TL.clientWidth - 80) / Math.max(seq.duree, 5), ZMIN, ZMAX);
  $('#zoom').value = zoomDepuisPps(ui.pps);
  TL.scrollLeft = 0;
  rendreTimeline();
}
$('#zoom').addEventListener('input', (e) => zoomer(Number(e.target.value)));
let pince = null;
TL.addEventListener('gesturestart', (e) => { pince = {zoom: Number($('#zoom').value), t: tempsDepuisX(e.clientX)}; });
TL.addEventListener('gesturechange', (e) => { if (pince && e.scale > 0) zoomer(pince.zoom + Math.log2(e.scale) * 24, pince.t); });
TL.addEventListener('gestureend', () => { pince = null; });
TL.addEventListener('wheel', (e) => {
  if (!(e.ctrlKey || e.metaKey || e.altKey)) return;
  e.preventDefault();
  zoomer(Number($('#zoom').value) - e.deltaY * 0.08, tempsDepuisX(e.clientX));
}, {passive: false});

// =====================================================================
// Inspecteur
// =====================================================================
const option = (v, txt, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(txt)}</option>`;
const tete = (type, icone, titre, sous) => `<div class="insp-tete"><div class="pastille-type ${type}">${ic(icone)}</div><div><b>${esc(titre)}</b><span>${esc(sous)}</span></div><button class="icone-btn fermer-insp" data-act="fermer-insp" title="Fermer (Échap) et revenir à Claude">${ic('fermer')}</button></div>`;
function blocSon(it, m, parDessus = false) {
  const v = it.son?.version ?? 'original';
  const {avant, apres} = debordements(it);
  if (!m.audio) return '';
  return `<div class="groupe-insp"><h3>Son</h3>
    <div class="rangee" style="margin-bottom:10px"><label class="rangee" style="gap:6px"><input type="checkbox" data-champ="son.actif"${it.son?.actif !== false && !(parDessus && !it.son?.actif) ? ' checked' : ''}> Garder le son</label><span class="espace"></span><label class="rangee" style="gap:6px">Volume <input class="tc-champ" style="width:56px" type="number" step="1" min="-60" max="24" data-champ="son.gain_db" value="${it.son?.gain_db ?? 0}"> dB</label></div>
    <div class="segmente" style="width:100%;margin-bottom:${m.voix ? 10 : 6}px">${[['original', 'Original'], ['voix', 'Voix seule'], ['fond', 'Sans la voix']].map(([k, t]) => `<button style="flex:1" data-version="${k}"${v === k ? ' class="actif"' : ''}${k !== 'original' && !m.voix ? ' disabled' : ''}>${t}</button>`).join('')}</div>
    ${m.voix ? '' : `<div class="rangee" style="margin-bottom:10px"><span class="dim" style="font-size:12px">Pour séparer la voix de la musique :</span><button class="btn petit" data-act="isoler">${ic('voix')}Isoler la voix</button></div>`}
    ${parDessus ? '' : `<div class="deux"><label class="champ" style="margin:0"><span>Le son commence avant (s)</span><input type="number" step="0.1" min="0" max="10" data-champ="son.avant_s" value="${avant}"></label><label class="champ" style="margin:0"><span>Le son continue après (s)</span><input type="number" step="0.1" min="0" max="10" data-champ="son.apres_s" value="${apres}"></label></div>`}
  </div>`;
}
/** La liste des fichiers donnés à l'IA (pour le film, ou pour une case). */
function listeRefs(cible) {
  const refs = (P.references ?? []).filter((r) => (r.cible ?? null) === (cible ?? null));
  if (!refs.length) return '';
  return `<div class="liste-refs">${refs.map((r) => `<div class="ref">${ic(/\.(blend|glb|gltf|fbx|obj|usdz?|stl|abc|dae|ply)$/i.test(r.nom) ? 'cube' : 'trombone')}<span class="nom" title="${esc(r.chemin)}">${esc(r.nom)}</span><button data-act="retirer-ref" data-ref="${r.id}" title="Retirer ce fichier">${ic('fermer')}</button></div>`).join('')}</div>`;
}
const zoneRefs = (cible, texte) => `<div class="zone-refs" data-zone="references" data-act="choisir-refs"${cible ? ` data-cible="${cible}"` : ''}>${ic('trombone')}${texte}<br><span style="font-size:11px">Glisse-les ici, ou clique pour les choisir.</span></div>`;
function rendreInspecteur() {
  const box = $('#inspecteur');
  if (!P) return;
  const sel = ui.sel;
  // un bloc de l'IA cliqué dans la timeline : la colonne montre ses réglages
  const bloc = !sel && ui.multi.size <= 1 && ui.blocIA ? blocIA(ui.blocIA) : null;
  if (ui.blocIA && !bloc) ui.blocIA = null;
  // rien de sélectionné : la colonne est à Claude
  const rien = !sel && ui.multi.size <= 1 && !bloc;
  box.classList.toggle('cache', rien);
  $('#claude').classList.toggle('cache', !rien);
  if (rien) { box.innerHTML = ''; return rendreClaude(); }
  if (bloc) return rendreBlocIA(box, bloc);
  if (ui.multi.size > 1) {
    const ids = idsSelectionnes();
    const segs = seq.segs.filter((x) => ids.includes(x.it.id));
    const duree = segs.reduce((a, x) => a + x.fin - x.debut, 0);
    box.innerHTML = `${tete('plan', 'film', `${ids.length} éléments sélectionnés`, `${tc(duree, F())} · ${dureeLisible(duree)}`)}
      <div class="groupe-insp"><p class="dim" style="margin:0 0 10px">⇧ ou ⌘ + clic pour en ajouter ou en retirer. ⌘C copie, ⌘X coupe, ⌘V colle à la tête de lecture.</p>
      <div class="rangee"><button class="btn petit" data-act="essentiels">${ic('etoile')}Tous essentiels</button><button class="btn petit" data-act="dupliquer">Dupliquer</button><button class="btn petit" data-act="supprimer">${ic('poubelle')}Supprimer</button></div></div>`;
    return;
  }
  if (sel?.type === 'item') {
    const it = item(sel.id);
    const s = seq.segs.find((x) => x.it.id === sel.id);
    if (!it || !s) return;
    const pos = `${s.k + 1}/${seq.segs.length} · ${tc(s.debut, F())} → ${tc(s.fin, F())}`;
    if (it.type === 'plan') {
      const m = media(it.media);
      const f = fpsSrc(m);
      const dit = extraitPlan(it, 2000);
      box.innerHTML = `${tete('plan', 'film', `Plan ${it.id}`, pos)}
        <button class="essentiel-bascule${it.essentiel ? ' oui' : ''}" data-act="essentiel">${ic('etoile', it.essentiel ? 'plein' : '')}<span><b>${it.essentiel ? 'Essentiel' : 'Marquer comme essentiel'}</b><small>${it.essentiel ? 'L’IA doit garder ce passage.' : 'Sans étoile, l’IA peut le resserrer si le rythme le demande.'}</small></span></button>
        <div class="groupe-insp"><h3>Passage</h3>
          <label class="champ"><span>Titre</span><input data-champ="titre" value="${esc(it.titre)}" placeholder="L’accroche, la punchline…"></label>
          ${m.type === 'image' ? `<dl class="lignes-info"><dt>Photo</dt><dd title="${esc(m.chemin)}">${esc(m.nom)}</dd>
            <dt>Durée</dt><dd><input class="tc-champ" data-tc="sortie" value="${tc(it.sortie - it.entree, f)}" title="Combien de temps la photo reste à l’écran"></dd></dl></div>`
          : `<dl class="lignes-info"><dt>Média</dt><dd title="${esc(m.chemin)}">${esc(m.nom)}</dd>
            <dt>Début</dt><dd><input class="tc-champ" data-tc="entree" value="${tc(it.entree, f)}"></dd>
            <dt>Fin</dt><dd><input class="tc-champ" data-tc="sortie" value="${tc(it.sortie, f)}"></dd>
            <dt>Durée</dt><dd>${tc(it.sortie - it.entree, f)} · ${dureeLisible(it.sortie - it.entree)}</dd></dl></div>`}
        <div class="groupe-insp"><h3>Ce qui est dit</h3><div class="dit">${dit ? esc(dit) : `<span class="dim">${m.audio ? 'Pas encore de texte pour ce rush.' : 'Pas de son.'}</span>`}</div>${!dit && m.audio ? `<button class="btn petit bleu" data-act="transcrire" style="margin-top:8px">${ic('texte')}Transcrire le rush</button>` : ''}
          ${dit ? `<label class="rangee" style="gap:7px;margin-top:10px;font-size:12px" title="Coche si l’image contient déjà des sous-titres ou du texte : Dérush n’en ajoutera pas sur ce plan."><input type="checkbox" data-champ="sans_sous_titres"${it.sans_sous_titres ? ' checked' : ''}> Ce plan a déjà des sous-titres</label>` : ''}</div>
        ${blocSon(it, m)}
        <div class="groupe-insp"><h3>Pour l’IA</h3>
          <label class="champ"><span>Notes</span><textarea data-champ="notes" placeholder="Zoom lent sur le visage, mot fort « JAMAIS » en gros, garder le silence avant la réponse…">${esc(it.notes)}</textarea></label>
          <label class="champ" style="margin:0"><span>Étiquettes</span><input data-champ="tags" value="${esc((it.tags ?? []).join(', '))}" placeholder="accroche, émotion… (séparées par des virgules)"></label></div>
        <div class="rangee"><button class="btn petit" data-act="voir-rush">${ic('film')}Voir dans le média</button><button class="btn petit" data-act="dupliquer">Dupliquer</button><button class="btn petit" data-act="supprimer">${ic('poubelle')}Supprimer</button></div>`;
    } else {
      box.innerHTML = `${tete('case', 'case', `Case à créer ${it.id}`, pos)}
        <p class="dim" style="margin:-4px 0 12px">Une case vide dans le montage : l’IA créera ce contenu, sur exactement cette durée.</p>
        <div class="groupe-insp"><div class="deux"><label class="champ"><span>Genre</span><select data-champ="genre">${Object.entries(GENRES_BLOC).map(([k, v]) => option(k, v, it.genre === k)).join('')}</select></label>
          <label class="champ"><span>Durée</span><input class="tc-champ" style="width:100%" data-tc="duree" value="${tc(it.duree, F())}"></label></div>
          <label class="champ"><span>Titre</span><input data-champ="titre" value="${esc(it.titre)}" placeholder="Carte Persan – Beaumont"></label>
          <label class="champ"><span>Consigne pour l’IA</span><textarea data-champ="consigne" style="min-height:120px" placeholder="Maquette 3D du Val-d’Oise, l’Oise au milieu, les deux villes se rapprochent, « 4 km » en gros.">${esc(it.consigne)}</textarea></label>
          <label class="champ" style="margin:0"><span>Références</span><textarea data-champ="references" placeholder="Liens, ambiance, style…">${esc(it.references)}</textarea></label></div>
        <div class="groupe-insp" data-zone="references" data-cible="${it.id}"><h3>Fichiers pour l’IA</h3>${listeRefs(it.id)}${zoneRefs(it.id, 'Images, modèle 3D (.blend, .glb), logo, vidéo de référence…')}</div>
        <div class="rangee"><button class="btn petit" data-act="dupliquer">Dupliquer</button><button class="btn petit" data-act="supprimer">${ic('poubelle')}Supprimer</button></div>`;
    }
    return;
  }
  if (sel?.type === 'indic') {
    const i = indication(sel.id);
    if (!i) return;
    if (estEffet(i)) { box.innerHTML = inspecteurEffet(i); return; }
    const sous = seq.segs.filter((s) => s.fin > i.debut && s.debut < i.fin).map((s) => s.it.id);
    box.innerHTML = `${tete('indic', 'drapeau', `Indication ${i.id}`, `sur ${sous.join(', ') || 'rien'}`)}
      <p class="dim" style="margin:-4px 0 12px">Une consigne posée par-dessus le montage. Elle ne change pas sa durée.</p>
      <div class="groupe-insp"><label class="champ"><span>Genre</span><select data-champ="genre">${Object.entries(GENRES_INDICATION).map(([k, v]) => option(k, v, i.genre === k)).join('')}</select></label>
        <div class="deux"><label class="champ"><span>Début</span><input class="tc-champ" style="width:100%" data-tc="debut" value="${tc(i.debut, F())}"></label>
        <label class="champ"><span>Fin</span><input class="tc-champ" style="width:100%" data-tc="fin" value="${tc(i.fin, F())}"></label></div>
        <label class="champ" style="margin:0"><span>Consigne pour l’IA</span><textarea data-champ="consigne" style="min-height:120px" placeholder="Nom à l’écran « Inès Martin, fondatrice de l’asso » ; zoom avant lent ; la musique monte ici…">${esc(i.consigne)}</textarea></label></div>
      <div class="rangee"><button class="btn petit" data-act="supprimer">${ic('poubelle')}Supprimer</button></div>`;
    return;
  }
  if (sel?.type === 'dessus') {
    const s = dessus(sel.id);
    if (!s) return;
    const m = media(s.media);
    const f = fpsSrc(m);
    box.innerHTML = `${tete('dessus', 'calques', `Par-dessus ${s.id}`, `${tc(s.debut, F())} → ${tc(s.debut + s.sortie - s.entree, F())}`)}
      <p class="dim" style="margin:-4px 0 12px">Un plan posé au-dessus du montage (plan de coupe, réaction, illustration). Il ne change pas la durée.</p>
      <div class="groupe-insp"><label class="champ"><span>Titre</span><input data-champ="titre" value="${esc(s.titre)}" placeholder="Réaction, plan de coupe…"></label>
        <div class="segmente" style="width:100%;margin-bottom:12px">${[['plein', 'Plein écran'], ['incrustation', 'Incrustation']].map(([k, t]) => `<button style="flex:1" data-cadre="${k}"${s.cadre === k ? ' class="actif"' : ''}>${t}</button>`).join('')}</div>
        <dl class="lignes-info"><dt>Rush</dt><dd>${esc(m.nom)}</dd>
          <dt>Pose</dt><dd><input class="tc-champ" data-tc="debut" value="${tc(s.debut, F())}"></dd>
          <dt>Début rush</dt><dd><input class="tc-champ" data-tc="entree" value="${tc(s.entree, f)}"></dd>
          <dt>Fin rush</dt><dd><input class="tc-champ" data-tc="sortie" value="${tc(s.sortie, f)}"></dd></dl></div>
      ${blocSon(s, m, true)}
      <div class="groupe-insp"><label class="champ" style="margin:0"><span>Notes pour l’IA</span><textarea data-champ="notes" placeholder="Pourquoi ce plan, comment l’intégrer…">${esc(s.notes)}</textarea></label></div>
      <div class="rangee"><button class="btn petit" data-act="voir-rush">${ic('film')}Voir dans le média</button><button class="btn petit" data-act="supprimer">${ic('poubelle')}Supprimer</button></div>`;
    return;
  }
}
const cibleSel = () => (ui.sel?.type === 'item' ? item(ui.sel.id) : ui.sel?.type === 'indic' ? indication(ui.sel.id) : ui.sel?.type === 'dessus' ? dessus(ui.sel.id) : null);
$('#inspecteur').addEventListener('input', (e) => {
  const c = e.target.dataset.champ;
  const obj = cibleSel();
  const rg = e.target.dataset.reglage;
  if (rg && obj && estEffet(obj)) {
    const el = e.target;
    const val = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
    if (el.type === 'range') { const s = el.parentElement.querySelector('output'); if (s) s.textContent = `${val} ${CATALOGUE[obj.modele].reglages[rg].unite ?? ''}`; }
    return modifier(() => { obj.reglages = {...obj.reglages, [rg]: val}; }, {cle: `${obj.id}.${rg}`, inspecteur: el.type === 'checkbox' || el.tagName === 'SELECT'});
  }
  if (!c || !obj) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  modifier(() => {
    if (c === 'tags') obj.tags = String(v).split(',').map((t) => t.trim()).filter(Boolean);
    else if (c === 'son.actif') obj.son = {...obj.son, actif: !!v};
    else if (c === 'son.gain_db') obj.son = {...obj.son, gain_db: borner(Number(v) || 0, -60, 24)};
    else if (c === 'son.avant_s' || c === 'son.apres_s') obj.son = {...obj.son, [c.slice(4)]: borner(Number(v) || 0, 0, 10)};
    else obj[c] = v;
  }, {cle: `${ui.sel.id}.${c}`, inspecteur: e.target.type === 'checkbox' || e.target.tagName === 'SELECT'});
});
$('#inspecteur').addEventListener('change', (e) => {
  const champ = e.target.dataset.tc;
  const obj = cibleSel();
  if (!champ || !obj) return;
  const m = obj.media ? media(obj.media) : null;
  const f = m && champ !== 'debut' ? fpsSrc(m) : F();
  const t = lireTemps(e.target.value, f);
  const refuser = () => { e.target.classList.add('invalide'); setTimeout(() => rendreInspecteur(), 900); };
  if (t == null || t < 0) return refuser();
  const v = surGrille(t, f);
  if (champ === 'entree' && !(v < obj.sortie)) return refuser();
  if (champ === 'sortie' && !(v > obj.entree && v <= m.duree + 1e-6)) return refuser();
  if (champ === 'duree' && !(v > 0)) return refuser();
  if (champ === 'debut' && obj.fin != null && !(v < obj.fin)) return refuser();
  if (champ === 'fin' && !(v > obj.debut)) return refuser();
  modifier(() => { obj[champ] = v; if (estEffet(obj)) ancrer(obj); });
});
$('#inspecteur').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('tc-champ')) e.target.blur(); });
/** Les boutons des fichiers pour l'IA (panneau « Pour l'IA » et case à créer). */
async function actionRefs(e) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'retirer-ref') {
    try { P.references = (await api('DELETE', `/api/references/${e.target.closest('[data-ref]').dataset.ref}`)).references; } catch (err) { return note(err.message, true); }
    rendrePanneauIA(); rendreTimeline(); rendreInspecteur();
    return true;
  }
  if (act === 'choisir-refs') {
    const cible = e.target.closest('[data-cible]')?.dataset.cible || null;
    let r;
    try { r = await choisirSurOrdinateur('reference'); } catch (err) { return note(err.message, true); }
    if (!r.chemins?.length) return true;
    try { P.references = (await api('POST', '/api/references', {chemins: r.chemins, cible})).references; } catch (err) { return note(err.message, true); }
    note(`${r.chemins.length} fichier${r.chemins.length > 1 ? 's' : ''} donné${r.chemins.length > 1 ? 's' : ''} à l’IA.`);
    rendrePanneauIA(); rendreTimeline(); rendreInspecteur();
    return true;
  }
  return false;
}
$('#inspecteur').addEventListener('click', async (e) => {
  if (await actionRefs(e)) return;
  const act0 = e.target.closest('[data-act]')?.dataset.act;
  if (act0 === 'fermer-insp') return selectionner(null);
  if (act0 === 'essentiel' && ui.sel?.type === 'item') {
    const it = item(ui.sel.id);
    return modifier(() => { if (it.essentiel) delete it.essentiel; else it.essentiel = true; });
  }
  if (act0 === 'essentiels') {
    const ids = idsSelectionnes();
    modifier(() => { for (const id of ids) { const x = item(id); if (x?.type === 'plan') x.essentiel = true; } });
    majSelectionClips();
    return note(`${ids.length} éléments marqués essentiels.`);
  }
  const obj = cibleSel();
  const version = e.target.closest('[data-version]')?.dataset.version;
  if (version && obj) return modifier(() => { obj.son = {...obj.son, version}; });
  const cadre = e.target.closest('[data-cadre]')?.dataset.cadre;
  if (cadre && obj) return modifier(() => { obj.cadre = cadre; });
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'supprimer') supprimer();
  if (act === 'revoir' && obj) revoirEffet(obj);
  if (act === 'installer-detourage') { try { await api('POST', '/api/moteurs/installer', {nom: 'detourage'}); note('Installation du détourage lancée.'); suivreFile(); } catch (err) { note(err.message, true); } }
  if (act === 'dupliquer') dupliquer();
  if (act === 'brief') feuilleBrief();
  if (act === 'voir-rush' && obj?.media) chargerRush(obj.media, obj.entree, obj.sortie);
  if (act === 'transcrire' && obj?.media) feuilleTexte(media(obj.media));
  if (act === 'isoler' && obj?.media) {
    try { await api('POST', `/api/medias/${obj.media}/voix`); note('Séparation de la voix lancée : quelques secondes à quelques minutes.'); suivreFile(); } catch (err) { note(err.message, true); }
  }
});

// =====================================================================
// Feuilles
// =====================================================================
function feuilleBrief() {
  const b = P.brief;
  const champ = (k, label, aide, grand = false) => `<label class="champ"><span>${label}</span>${grand ? `<textarea data-brief="${k}" placeholder="${esc(aide)}">${esc(b[k])}</textarea>` : `<input data-brief="${k}" value="${esc(b[k])}" placeholder="${esc(aide)}">`}</label>`;
  const f = feuille(`<h3>Brief et format</h3><p class="sous-titre">C’est la première chose que l’IA lira : explique le projet comme à un monteur.</p>
    <div class="champ"><span>Mode de création</span><div class="segmente" id="brief-mode">${Object.entries(MODES).map(([k, v]) => `<button data-mode-projet="${k}"${k === modeProjet() ? ' class="actif"' : ''} title="${esc(v.description)}">${esc(v.nom)}</button>`).join('')}</div></div>
    <label class="champ"><span>Genre de vidéo (l’IA suit la recette de ce genre)</span><select data-brief="type">${option('', 'Non précisé', !b.type)}${Object.entries(TYPES_VIDEO).map(([k, v]) => option(k, `${v.nom} — ${v.description}`, b.type === k)).join('')}</select></label>
    ${champ('objectif', 'Objectif, histoire', 'Teaser de 30 s qui donne envie d’écouter le podcast…', true)}
    <div class="deux">${champ('public', 'Public', '13-18 ans du Val-d’Oise')}${champ('plateformes', 'Plateformes', 'TikTok, Reels, YouTube…')}</div>
    ${champ('ton', 'Ton, style', 'Énergique, sous-titres karaoké, charte rouge #E10600…', true)}
    <div class="deux">${champ('duree_visee', 'Durée visée', '30 à 45 s')}${champ('a_eviter', 'À éviter', 'Glorifier la violence')}</div>
    ${champ('references', 'Références', 'Liens, vidéos qui inspirent, éléments graphiques…', true)}
    <div class="champ"><span>Format de la vidéo finale</span>${tuilesFormat(P.sortie.preset)}</div>
    <div class="deux"><label class="champ"><span>Images par seconde</span><select data-sortie="fps">${CADENCES.map((c) => option(c, `${c} i/s`, P.sortie.fps === c)).join('')}</select></label>
    <label class="champ"><span>Langue parlée</span><select data-langue>${Object.entries(LANGUES).map(([k, v]) => option(k, v, (P.langue ?? 'fr') === k)).join('')}</select></label></div>
    <div class="pied"><button class="btn principal" data-fermer>OK</button></div>`, true);
  f.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.brief) P.brief[t.dataset.brief] = t.value;
    if (t.dataset.sortie) { P.sortie.fps = Number(t.value); apresFormat(); }
    if (t.dataset.langue !== undefined) P.langue = t.value;
    sauver();
  });
  f.addEventListener('click', (e) => {
    const bm = e.target.closest('[data-mode-projet]');
    if (bm) {
      P.mode = bm.dataset.modeProjet;
      $$('#brief-mode button', f).forEach((x) => x.classList.toggle('actif', x === bm));
      api('PUT', '/api/projet', {mode: P.mode}).catch((err) => note(err.message, true));
      $('#vide').dataset.cle = '';
      afficherVide();
      rendreClaude();
    }
    const tuile = e.target.closest('[data-format]');
    if (tuile) {
      const k = tuile.dataset.format;
      Object.assign(P.sortie, {preset: k, largeur: FORMATS[k].largeur, hauteur: FORMATS[k].hauteur, auto: false});
      $$('.format', f).forEach((x) => x.classList.toggle('actif', x === tuile));
      apresFormat();
      sauver();
    }
    if (e.target.closest('[data-fermer]')) { fermerFeuille(); rendreInspecteur(); rendrePanneauIA(); }
  });
}
function apresFormat() {
  seq = sequence(P);
  rendreBarre();
  rendreTimeline();
  rendreInspecteur();
  progAfficher();
  majCadre();
}

async function feuilleParcourir({dossier, dossiers = false} = {}) {
  let d;
  try { d = await api('GET', `/api/parcourir${dossier ? `?dossier=${encodeURIComponent(dossier)}` : ''}`); } catch (e) { return note(e.message, true); }
  const deja = (c) => P?.medias.some((m) => m.chemin === c);
  const medias = dossiers ? [] : d.entrees.filter((x) => x.type === 'media' && !deja(x.chemin));
  const f = feuille(`<h3>${dossiers ? 'Ouvrir un projet' : 'Importer des rushes'}</h3>
    <p class="sous-titre">${dossiers ? 'Choisis le dossier d’un projet Dérush (ou un dossier vide pour en créer un).' : 'Les fichiers restent à leur place : Dérush les lit sans les copier.'}</p>
    <div class="raccourcis-dossiers">${d.raccourcis.map((r) => `<button class="btn petit" data-aller="${esc(r.chemin)}">${esc(r.nom)}</button>`).join('')}</div>
    <div class="chemin-actuel">${esc(d.dossier)}</div>
    <div class="fichiers">${d.parent ? `<div class="fichier" data-aller="${esc(d.parent)}">${ic('retour')}Dossier parent</div>` : ''}
      ${d.entrees.filter((x) => !dossiers || x.type === 'dossier').map((x) => (x.type === 'dossier'
        ? `<div class="fichier" data-aller="${esc(x.chemin)}">${ic(x.projet ? 'film' : 'dossier')}${esc(x.nom)}${x.projet ? ' <span class="dim">· projet Dérush</span>' : ''}</div>`
        : `<label class="fichier"><input type="checkbox" value="${esc(x.chemin)}"${deja(x.chemin) ? ' disabled' : ''}>${ic(/\.(mp3|wav|m4a|aac|aif|aiff|flac|ogg|oga|opus|wma)$/i.test(x.nom) ? 'onde' : 'film')}${esc(x.nom)}${deja(x.chemin) ? ' <span class="dim">· déjà importé</span>' : ''}<span class="taille">${x.taille ? `${(x.taille / 1e6).toLocaleString('fr-FR', {maximumFractionDigits: 1})} Mo` : ''}</span></label>`)).join('') || '<div class="fichier dim">Rien ici.</div>'}</div>
    <div class="pied">${medias.length ? '<button class="btn" data-tout>Tout cocher</button>' : ''}<span class="espace"></span><button class="btn" data-fermer>Annuler</button><button class="btn principal" data-ok>${dossiers ? 'Ouvrir ce dossier' : 'Importer'}</button></div>`);
  f.addEventListener('click', async (e) => {
    const aller = e.target.closest('[data-aller]')?.dataset.aller;
    if (aller) return feuilleParcourir({dossier: aller, dossiers});
    if (e.target.closest('[data-fermer]')) return fermerFeuille();
    if (e.target.closest('[data-tout]')) return $$('input[type=checkbox]:not(:disabled)', f).forEach((c) => { c.checked = true; });
    if (!e.target.closest('[data-ok]')) return;
    if (dossiers) { fermerFeuille(); return ouvrirProjet(d.dossier); }
    const chemins = $$('input[type=checkbox]:checked', f).map((c) => c.value);
    if (!chemins.length) return note('Coche au moins un fichier.', true);
    fermerFeuille();
    importerChemins(chemins);
  });
}
async function importerChemins(chemins) {
  try {
    const r = await api('POST', '/api/medias', {chemins});
    if (r.ajoutes.length) note(`${r.ajoutes.length} média${r.ajoutes.length > 1 ? 's' : ''} importé${r.ajoutes.length > 1 ? 's' : ''} : préparation en cours. Glisse-le${r.ajoutes.length > 1 ? 's' : ''} dans la timeline.`);
    for (const err of r.erreurs) note(err, true);
    await rafraichirMedias();
    choisirPanneau('medias');
    if (!ui.src.id && r.ajoutes[0]) chargerRush(r.ajoutes[0], null, null, false);
  } catch (err) { note(err.message, true); }
}
/** « Importer » : la vraie fenêtre du Finder (les fichiers restent à leur place). Sinon, le navigateur de Dérush. */
async function feuilleImporter() {
  let r;
  const indice = NATIF ? 0 : setTimeout(() => note('Choisis tes vidéos dans la fenêtre « Ouvrir » de ton ordinateur.'), 1500);
  try {
    r = await choisirSurOrdinateur();
  } catch (e) {
    note(e.message, true);
    return feuilleParcourir();
  } finally {
    clearTimeout(indice);
  }
  if (r.indisponible) return feuilleParcourir();
  if (r.chemins?.length) importerChemins(r.chemins);
}

function feuilleTexte(m) {
  const mo = SRV.moteurs ?? {};
  const w = mo.whisper ?? {};
  const f = feuille(`<h3>Texte de « ${esc(m.nom)} »</h3><p class="sous-titre">Le texte mot à mot sert à couper au mot près et donne les sous-titres prêts à l’IA.${m.transcription ? ` Ce rush a déjà ${m.transcription.mots} mots : ils seront remplacés.` : ''}</p>
    <div class="moteur"><div class="rond" style="background:rgba(10,132,255,.15);color:var(--bleu)">${ic('texte')}</div><div class="desc"><b>Sur cet ordinateur, avec Whisper</b><small>${w.ok ? 'Gratuit, rien ne sort de l’ordinateur. Environ 1 minute pour 10 minutes de son.' : esc(w.pourquoi ?? 'Indisponible.')}</small></div>${w.ok ? '<button class="btn bleu" data-moteur="whisper">Transcrire</button>' : w.installable ? `<button class="btn" data-installer="whisper">Installer (${esc(w.taille)})</button>` : ''}</div>
    <div class="moteur"><div class="rond" style="background:rgba(255,255,255,.08)">${ic('importer')}</div><div class="desc"><b>Importer un fichier</b><small>JSON d’ElevenLabs, Whisper ou WhisperX, ou sous-titres SRT / VTT.</small></div><label class="btn">Choisir…<input type="file" accept=".json,.jsonl,.srt,.vtt,.txt" hidden data-import></label></div>
    ${mo.elevenlabs?.ok ? `<div class="moteur"><div class="rond" style="background:rgba(255,255,255,.08)">${ic('ia')}</div><div class="desc"><b>ElevenLabs Scribe</b><small>${esc(mo.elevenlabs.detail)}</small></div><button class="btn" data-moteur="elevenlabs">Transcrire</button></div>` : ''}
    <div class="pied">${m.transcription ? `<button class="btn" data-effacer>${ic('poubelle')}Effacer le texte</button>` : ''}<span class="espace"></span><button class="btn" data-fermer>Fermer</button></div>`);
  f.addEventListener('click', async (e) => {
    if (e.target.closest('[data-fermer]')) return fermerFeuille();
    const moteur = e.target.closest('[data-moteur]')?.dataset.moteur;
    const inst = e.target.closest('[data-installer]')?.dataset.installer;
    try {
      if (moteur) {
        fermerFeuille();
        await api('POST', `/api/medias/${m.id}/transcrire`, {moteur});
        note('Transcription lancée.');
        suivreFile();
      }
      if (inst) {
        fermerFeuille();
        await api('POST', '/api/moteurs/installer', {nom: inst});
        note('Installation lancée : suis-la en haut de la fenêtre.');
        suivreFile();
      }
      if (e.target.closest('[data-effacer]')) {
        if (!confirm('Effacer le texte de ce rush ?')) return;
        await api('DELETE', `/api/medias/${m.id}/transcription`);
        m.transcription = null;
        oublier(m.id);
        fermerFeuille();
        rendreRushes();
        if (ui.src.id === m.id) { await charger('mots', m); rendreTexte(); }
      }
    } catch (err) { note(err.message, true); }
  });
  f.querySelector('[data-import]').addEventListener('change', async (e) => {
    const fichier = e.target.files[0];
    if (!fichier) return;
    try {
      const r = await api('POST', `/api/medias/${m.id}/transcription`, {nom: fichier.name, contenu: await fichier.text()});
      m.transcription = r;
      oublier(m.id);
      fermerFeuille();
      note(`${r.mots} mots importés${r.approx ? ' (temps approximatifs)' : ''}.`);
      rendreRushes();
      await charger('mots', m);
      if (ui.src.id === m.id) { rendreTexte(); choisirPanneau('texte'); }
      rendreTimeline();
    } catch (err) { note(err.message, true); }
  });
}

async function feuilleReglages() {
  let mo = SRV.moteurs ?? {};
  try { mo = await api('GET', '/api/moteurs'); SRV.moteurs = mo; } catch { /* état connu */ }
  const ligne = (cle, icone, couleur, titre) => {
    const x = mo[cle] ?? {ok: false, pourquoi: 'Indisponible.'};
    return `<div class="moteur"><div class="rond" style="background:${couleur}22;color:${couleur}">${ic(icone)}</div><div class="desc"><b>${titre}</b><small>${esc(x.ok ? (x.detail ?? x.nom) : x.pourquoi)}</small></div>${x.ok ? `<span class="etiq ok">${ic('coche')}prêt</span>` : x.installable ? `<button class="btn bleu petit" data-installer="${cle}">Installer · ${esc(x.taille)}</button>` : '<span class="etiq">indisponible</span>'}</div>`;
  };
  const f = feuille(`<h3>Réglages</h3><p class="sous-titre">Les moteurs tournent sur ton ordinateur. Seule ton IA travaille en ligne, avec ton compte.</p>
    <div class="moteur">${logo('claude', 30)}<div class="desc"><b>Connexions</b><small>Ton IA (Claude, Codex ou Gemini), ElevenLabs, Google Drive, Treg pour publier, Blender, les mises à jour.</small></div><button class="btn bleu petit" data-connexions>Ouvrir</button></div>
    ${ligne('whisper', 'texte', '#0a84ff', 'Texte mot à mot — Whisper')}
    ${ligne('voix', 'voix', '#30d158', 'Séparer la voix — Demucs')}
    ${SRV.systeme === 'mac' || mo.vision?.ok || mo.vision?.installable ? ligne('vision', 'cadre', '#ff9f0a', 'Recadrage qui suit les visages — Apple Vision') : ''}
    ${SRV.systeme === 'mac' || mo.detourage?.ok || mo.detourage?.installable ? ligne('detourage', 'titre', '#64d2ff', 'Titre derrière la personne — Apple Vision') : ''}
    ${ligne('rendu', 'rendu', '#ff453a', 'Fabriquer la vidéo — Remotion, animation et 3D')}
    ${ligne('blender', 'cube', '#ff9f0a', '3D réaliste — Blender')}
    ${P ? `<h3 style="font-size:15px;margin:18px 0 10px">Dossier de montage</h3>
    <div class="deux"><label class="champ"><span>Marge autour des plans (s)</span><input type="number" min="0" max="5" step="0.1" data-export="poignees_s" value="${P.export.poignees_s}"></label>
    <div class="champ"><span>Contenu</span><label class="rangee" style="gap:7px"><input type="checkbox" data-export="kit_remotion"${P.export.kit_remotion !== false ? ' checked' : ''}> Kit de départ Remotion</label><label class="rangee" style="gap:7px"><input type="checkbox" data-export="rushes_complets"${P.export.rushes_complets ? ' checked' : ''}> Rushes complets</label><label class="rangee" style="gap:7px"><input type="checkbox" data-export="zip"${P.export.zip ? ' checked' : ''}> Créer aussi un .zip</label></div></div>` : ''}
    <div class="pied"><span class="dim" style="font-size:12px">Dérush ${esc(SRV.version ?? '')}</span><span class="espace"></span><button class="btn principal" data-fermer>OK</button></div>`);
  f.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.export && P) { P.export[t.dataset.export] = t.type === 'checkbox' ? t.checked : Number(t.value); sauver(); }
  });
  f.addEventListener('click', async (e) => {
    if (e.target.closest('[data-fermer]')) return fermerFeuille();
    if (e.target.closest('[data-connexions]')) return feuilleConnexions();
    const inst = e.target.closest('[data-installer]')?.dataset.installer;
    if (inst) {
      try { await api('POST', '/api/moteurs/installer', {nom: inst}); note('Installation lancée : suis-la en haut de la fenêtre.'); fermerFeuille(); suivreFile(); } catch (err) { note(err.message, true); }
    }
  });
}
/** Après « Brancher » : on attend que la personne ait autorisé Dérush dans son navigateur. */
function suivreBranchement(essais = 0) {
  setTimeout(async () => {
    if (ui.remplacee) return;
    try {
      const mo = await api('GET', '/api/moteurs');
      SRV.moteurs = mo;
      if (mo.sons?.ok) { note('ElevenLabs est branché : ton IA peut créer musiques, bruitages et voix.', false, true); return chargerClaude(); }
      if (!mo.sons?.attente) return note(mo.sons?.pourquoi ?? 'Le branchement n’a pas abouti.', true);
    } catch { /* on réessaie */ }
    if (essais < 300) suivreBranchement(essais + 1);
  }, 3000);
}

function verificationsEnvoi() {
  const v = [];
  if (!P.montage.length) v.push({ok: true, t: 'Aucune découpe : l’IA reçoit tes rushes entiers', d: 'Elle choisira elle-même les passages à garder.'});
  const briefRempli = Object.values(P.brief).some((x) => x?.trim());
  v.push(briefRempli ? {ok: true, t: 'Brief rédigé'} : {ok: false, t: 'Le brief est vide', d: 'L’IA ne saura pas ce que tu veux : histoire, public, ton…', action: 'brief', bouton: 'Écrire le brief'});
  const sansTexte = [...new Set([...P.montage, ...P.superpositions].filter((it) => it.media).map((it) => it.media))].map(media).filter((m) => m?.audio && !m.transcription);
  v.push(sansTexte.length ? {ok: false, t: `${sansTexte.length} rush${sansTexte.length > 1 ? 'es' : ''} sans texte`, d: `${sansTexte.map((m) => m.nom).join(', ')} : pas de sous-titres pour ces plans.`, action: 'transcrire', bouton: SRV.moteurs?.whisper?.ok ? 'Transcrire' : null} : {ok: true, t: 'Tous les plans ont leur texte'});
  const sansConsigne = P.montage.filter((it) => it.type === 'bloc' && !it.consigne?.trim());
  v.push(sansConsigne.length ? {ok: false, t: `${sansConsigne.length} case${sansConsigne.length > 1 ? 's' : ''} sans consigne`, d: `${sansConsigne.map((b) => b.id).join(', ')} : l’IA devra deviner leur contenu.`} : {ok: true, t: 'Chaque case à créer a sa consigne'});
  return v;
}
function feuilleEnvoyer() {
  if (!P.medias.length) return note('Importe d’abord au moins une vidéo, un son ou une photo.', true);
  const v = verificationsEnvoi();
  const f = feuille(`<h3>Pack pour une autre IA</h3><p class="sous-titre">Un dossier complet, précis à l’image près, à donner à l’IA de ton choix : plans, texte, timecodes, consignes, storyboard et kit Remotion. Pour Claude, « Demander à Claude » s’en charge tout seul.</p>
    <div class="verifs">${v.map((x) => `<div class="verif ${x.ok ? 'ok' : 'attention'}">${ic(x.ok ? 'ok' : 'attention')}<div class="espace">${esc(x.t)}${x.d ? `<small>${esc(x.d)}</small>` : ''}</div>${x.bouton ? `<button class="btn petit" data-verif="${x.action}">${esc(x.bouton)}</button>` : ''}</div>`).join('')}</div>
    <p class="dim" style="font-size:12px">${FORMATS[P.sortie.preset]?.ratio} · ${F()} i/s · ${tc(seq.duree, F())} · ${P.montage.filter((i) => i.type === 'plan').length} plans · ${P.montage.filter((i) => i.type === 'bloc').length} cases · ${P.superpositions.length} par-dessus · ${P.indications.length} indications</p>
    <div class="pied"><button class="btn" data-fermer>Annuler</button><button class="btn principal" data-go>${ic('ia')}Préparer le pack</button></div>`);
  f.addEventListener('click', async (e) => {
    if (e.target.closest('[data-fermer]')) return fermerFeuille();
    const a = e.target.closest('[data-verif]')?.dataset.verif;
    if (a === 'brief') return feuilleBrief();
    if (a === 'transcrire') {
      const ids = [...new Set([...P.montage, ...P.superpositions].filter((it) => it.media).map((it) => it.media))].filter((id) => media(id)?.audio && !media(id).transcription);
      for (const id of ids) await api('POST', `/api/medias/${id}/transcrire`, {moteur: 'whisper'}).catch((err) => note(err.message, true));
      note('Transcriptions lancées. Envoie le pack quand elles sont finies.');
      fermerFeuille();
      return suivreFile();
    }
    if (e.target.closest('[data-go]')) {
      await sauver(true);
      try {
        const {tache} = await api('POST', '/api/exporter');
        ui.exportTache = tache;
        feuille(`<h3>Préparation du pack…</h3><p class="sous-titre">Découpe des plans à l’image près, vignettes, storyboard, sous-titres, kit Remotion.</p><div class="jauge"><i id="jauge-export" style="width:2%"></i></div><p class="dim" id="etat-export" style="margin-top:10px">En attente…</p>`);
        suivreFile();
      } catch (err) { note(err.message, true); }
    }
  });
}
function afficherExport(t) {
  ui.exportTache = null;
  if (t.etat === 'erreur') {
    feuille(`<h3>Le pack n’a pas pu être préparé</h3><p class="resultat">${esc(t.erreur)}</p><div class="pied"><button class="btn principal" data-fermer>OK</button></div>`).querySelector('[data-fermer]').onclick = fermerFeuille;
    return;
  }
  const r = t.resultat;
  const message = `Voici un pack de montage Dérush : « ${r.dossier} ». Lis LISEZMOI-IA.md puis montage.json et regarde le storyboard. Pars du kit remotion/ s’il est là. Propose-moi ton plan pour la vidéo finale (structure, transitions, motion design, sous-titres, musique) avant de la produire.`;
  const f = feuille(`<h3>${ic('ok')} Pack prêt</h3><p class="sous-titre">${r.plans} plans · ${r.cases_a_creer} cases à créer · ${r.par_dessus} par-dessus · ${r.indications} indications · ${r.mots_dits} mots · ${esc(r.taille_lisible)}${r.kit ? ' · kit Remotion' : ''}</p>
    <div class="resultat">${esc(r.dossier)}</div>
    ${r.avertissements?.length ? `<div class="verifs" style="margin-top:12px">${r.avertissements.map((a) => `<div class="verif attention">${ic('attention')}<div class="espace" style="font-size:12px">${esc(a)}</div></div>`).join('')}</div>` : ''}
    <p style="margin:16px 0 8px">Pour finir la vidéo avec une IA : ouvre ce dossier dans Claude Code, Codex ou Gemini (ou donne-lui son chemin) et envoie ce message.</p>
    <textarea class="message-ia" readonly>${esc(message)}</textarea>
    <div class="pied"><button class="btn" data-finder>${ic('finder')}Afficher dans le dossier</button><span class="espace"></span><button class="btn" data-copier>Copier le message</button><button class="btn principal" data-fermer>OK</button></div>`);
  f.querySelector('[data-fermer]').onclick = fermerFeuille;
  f.querySelector('[data-copier]').onclick = async () => { await copierTexte(message); note('Message copié : colle-le dans ton IA.'); };
  f.querySelector('[data-finder]').onclick = () => api('POST', '/api/ouvrir', {chemin: r.dossier}).catch((e) => note(e.message, true));
}

// ——— Retours de l'IA ———
async function chargerRetours() {
  if (!P) return;
  try {
    ui.retours = (await api('GET', '/api/retours')).retours;
  } catch { ui.retours = []; }
  const n = ui.retours.filter((r) => r.etat === 'nouveau').length;
  const b = $('#nb-retours');
  b.textContent = n;
  b.classList.toggle('cache', !n);
}
function decrireRetour(r) {
  const cible = r.cible ? ` ${r.cible}` : '';
  const it = r.cible ? (item(r.cible) ?? dessus(r.cible)) : null;
  const m = it?.media ? media(it.media) : null;
  switch (r.type) {
    case 'rogner': return `Recouper${cible} : ${m ? `${tc(r.entree_s ?? it.entree, fpsSrc(m))} → ${tc(r.sortie_s ?? it.sortie, fpsSrc(m))}` : `${r.entree_s} → ${r.sortie_s} s`}`;
    case 'deplacer': return `Déplacer${cible} en position ${Number(r.position) + 1}`;
    case 'supprimer': return `Retirer${cible} du montage`;
    case 'consigne': return `Nouvelle consigne pour${cible} : « ${r.consigne} »`;
    case 'indication': return `Ajouter une indication (${GENRES_INDICATION[r.genre] ?? 'note'}) de ${tc(r.debut_s, F())} à ${tc(r.fin_s, F())} : « ${r.consigne} »`;
    case 'effet': return `Ajouter l’effet « ${CATALOGUE[r.modele]?.nom ?? r.modele} »${r.reglages?.texte ? ` (${r.reglages.texte})` : ''} de ${tc(Number(r.debut_s) || 0, F())} à ${tc(Number(r.fin_s) || 0, F())}`;
    case 'style': return `Changer le style : ${Object.entries(r.style ?? {}).flatMap(([k, v]) => (v && typeof v === 'object' ? Object.entries(v).map(([k2, v2]) => `${k} ${k2} = ${v2}`) : [`${k} = ${v}`])).join(', ').replace(/_/g, ' ')}`;
    case 'question': return `Question${cible ? ` sur${cible}` : ''} : ${r.texte}`;
    default: return r.texte ?? '';
  }
}
function appliquerRetour(r, reponse) {
  const it = r.cible ? item(r.cible) : null;
  const sp = r.cible ? dessus(r.cible) : null;
  switch (r.type) {
    case 'rogner': {
      const x = it ?? sp;
      if (!x?.media) throw new Error(`${r.cible} introuvable.`);
      const m = media(x.media);
      const f = fpsSrc(m);
      const a = surGrille(borner(Number(r.entree_s ?? x.entree), 0, m.duree), f);
      const b = surGrille(borner(Number(r.sortie_s ?? x.sortie), 0, m.duree), f);
      if (!(b > a)) throw new Error('Temps proposés invalides.');
      modifier(() => { x.entree = a; x.sortie = b; });
      break;
    }
    case 'deplacer': {
      const k0 = P.montage.findIndex((x) => x.id === r.cible);
      if (k0 < 0) throw new Error(`${r.cible} introuvable.`);
      modifier(() => { const [x] = P.montage.splice(k0, 1); P.montage.splice(borner(Number(r.position) || 0, 0, P.montage.length), 0, x); });
      break;
    }
    case 'supprimer':
      if (!it && !sp) throw new Error(`${r.cible} introuvable.`);
      modifier(() => { P.montage = P.montage.filter((x) => x.id !== r.cible); P.superpositions = P.superpositions.filter((x) => x.id !== r.cible); });
      break;
    case 'consigne':
      if (!it) throw new Error(`${r.cible} introuvable.`);
      modifier(() => { if (it.type === 'bloc') it.consigne = String(r.consigne ?? ''); else it.notes = [it.notes, String(r.consigne ?? '')].filter(Boolean).join('\n'); });
      break;
    case 'indication':
      modifier(() => {
        const debut = surGrille(Math.max(0, Number(r.debut_s) || 0), F());
        P.indications.push({id: nouvelId(P, 'I'), genre: GENRES_INDICATION[r.genre] ? r.genre : 'note', debut, fin: Math.max(debut + 1 / F(), surGrille(Number(r.fin_s) || debut + 2, F())), consigne: String(r.consigne ?? '')});
      });
      break;
    case 'effet': {
      if (!CATALOGUE[r.modele]) throw new Error(`Effet inconnu : ${r.modele}.`);
      modifier(() => {
        const debut = surGrille(Math.max(0, Number(r.debut_s) || 0), F());
        const e = {id: nouvelId(P, 'I'), genre: 'note', debut, fin: Math.max(debut + 1 / F(), surGrille(Number(r.fin_s) || debut + 2, F())), consigne: '', modele: r.modele, reglages: {...(r.reglages ?? {})}};
        ancrer(e);
        P.indications.push(e);
      });
      break;
    }
    case 'style':
      modifier(() => { P.style = {...styleDuProjet(), ...(r.style ?? {}), sous_titres: {...styleDuProjet().sous_titres, ...(r.style?.sous_titres ?? {})}}; });
      break;
    case 'question':
      if (reponse?.trim()) {
        modifier(() => {
          const ligne = `Réponse à l’IA (« ${r.texte} ») : ${reponse.trim()}`;
          if (it) it[it.type === 'bloc' ? 'consigne' : 'notes'] = [it.type === 'bloc' ? it.consigne : it.notes, ligne].filter(Boolean).join('\n');
          else P.brief.references = [P.brief.references, ligne].filter(Boolean).join('\n');
        });
      }
      break;
    default:
  }
}
async function feuilleRetours() {
  await chargerRetours();
  const R = ui.retours;
  const f = feuille(`<h3>Retours de l’IA</h3><p class="sous-titre">Quand l’IA veut changer ta découpe, elle l’écrit dans <code>retours-ia.json</code>, dans le pack. Tu décides d’un clic.</p>
    ${R.length ? R.map((r) => `<div class="retour${r.type === 'question' ? ' question' : ''}${r.etat !== 'nouveau' ? ' fait' : ''}" data-cle="${esc(r.cle)}">
      <b>${esc(decrireRetour(r))}</b>${r.pourquoi ? `<div class="pourquoi">${esc(r.pourquoi)}</div>` : ''}
      <div class="rangee" style="margin-top:8px">${r.etat === 'nouveau'
        ? (r.type === 'question' ? `<input class="entree" placeholder="Ta réponse (ajoutée aux notes)" style="flex:1" data-reponse><button class="btn petit bleu" data-ap>Répondre</button>` : r.type === 'note' ? '<button class="btn petit" data-ap>Lu</button>' : '<button class="btn petit bleu" data-ap>Appliquer</button>') + '<button class="btn petit" data-ig>Ignorer</button>'
        : `<span class="dim" style="font-size:12px">${r.etat === 'applique' ? 'Appliqué' : 'Ignoré'} · ${esc(r.auteur)}, ${esc(ilYa(r.date))}</span>`}</div></div>`).join('') : `<div class="aide-vide">${ic('bulle')}<br>Aucun retour pour l’instant.<br><span style="font-size:12px">Ils apparaîtront ici dès que l’IA aura écrit dans un pack.</span></div>`}
    <div class="pied"><button class="btn principal" data-fermer>OK</button></div>`, true);
  f.addEventListener('click', async (e) => {
    if (e.target.closest('[data-fermer]')) return fermerFeuille();
    const bloc = e.target.closest('.retour');
    if (!bloc) return;
    const r = R.find((x) => x.cle === bloc.dataset.cle);
    try {
      if (e.target.closest('[data-ap]')) {
        appliquerRetour(r, bloc.querySelector('[data-reponse]')?.value);
        await api('POST', '/api/retours/marquer', {cle: r.cle, etat: 'applique'});
        note('Appliqué (annulable avec ⌘Z).');
      } else if (e.target.closest('[data-ig]')) {
        await api('POST', '/api/retours/marquer', {cle: r.cle, etat: 'ignore'});
      } else return;
      feuilleRetours();
    } catch (err) { note(err.message, true); }
  });
}

function feuilleAide() {
  const l = [
    ['Glisser des fichiers sur la fenêtre', 'Importer (les fichiers restent à leur place, même très lourds) ; sur la timeline, ils se posent là'],
    ['Glisser une vignette', 'La poser dans la timeline (en bas : le montage ; plus haut : par-dessus)'],
    ['+ sur une vignette', 'L’ajouter au montage, à la tête de lecture'],
    ['Espace', 'Lecture / pause'],
    ['S · ⌘B', 'Couper le plan à la tête de lecture'],
    ['C · V', 'Mode ciseaux (un clic coupe le plan à cet endroit) · retour à la sélection'],
    ['Q · W', 'Enlever le début · la fin du plan jusqu’à la tête de lecture'],
    ['⌫', 'Supprimer la sélection (ou, dans le texte du montage, les mots choisis)'],
    ['⇧ ou ⌘ + clic · ⌘A', 'Sélectionner plusieurs plans · tous'],
    ['⌘C · ⌘X · ⌘V · ⌘D', 'Copier · couper · coller à la tête de lecture · dupliquer'],
    ['⌘Z · ⇧⌘Z', 'Annuler / rétablir'],
    ['Bords d’un plan', 'Raccourcir ou rallonger (l’aimant colle à la tête de lecture ; ⌘ pour s’en passer)'],
    ['Glisser un plan', 'Changer l’ordre'],
    ['B · N', 'Case à créer · note pour l’IA, à la tête de lecture'],
    ['⌘K', 'Écrire à l’IA'],
    ['⌘↵', 'Dans la conversation avec l’IA : envoyer la demande'],
    ['Texte du montage', 'Glisser sur des mots puis ⌫ : ils sortent du montage'],
    ['Texte d’un média', 'Glisser sur des phrases puis « Ajouter au montage »'],
    ['Glisser sous l’aperçu', 'Ne garder qu’un passage d’un média ; E · ⇧E l’ajoute au montage · par-dessus'],
    ['← · →', 'Image précédente / suivante (⇧ : une seconde)'],
    ['↑ · ↓ · [ · ]', 'Plan précédent / suivant'],
    ['Début · Fin', 'Aller au début · à la fin du montage'],
    ['+ · − · 0', 'Zoom de la timeline, tout voir (⌘ + molette aussi)'],
    ['Échap', 'Quitter les ciseaux, revenir au montage, désélectionner'],
  ];
  feuille(`<h3>Raccourcis</h3><table class="aide-tableau">${l.map(([k, v]) => `<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(v)}</td></tr>`).join('')}</table><div class="pied"><button class="btn" data-tuto>${ic('lire', 'plein')}Revoir le tutoriel</button><span class="espace"></span><button class="btn principal" data-fermer>OK</button></div>`).addEventListener('click', (e) => {
    if (e.target.closest('[data-fermer]')) fermerFeuille();
    if (e.target.closest('[data-tuto]')) { fermerFeuille(); tutoriel(); }
  });
}

// =====================================================================
// Commandes et clavier
// =====================================================================
function pas(n) {
  if (ui.mode === 'rush') {
    const m = media(ui.src.id);
    if (!m) return;
    vRush.pause();
    seekRush(surGrille(vRush.currentTime, fpsSrc(m)) + (n ?? 1 / fpsSrc(m)));
  } else {
    progPause();
    progPositionner(surGrille(prog.t, F()) + (n ?? 1 / F()));
  }
}
function lire() {
  if (ui.vue === 'direct') { montrerVue('montage'); return progLire(); }
  if (ui.vue === 'claude') {
    const v = $('#v-claude');
    if (v.paused) v.play().catch(() => {}); else v.pause();
    return;
  }
  if (ui.mode === 'rush') {
    if (!ui.src.id) return;
    if (vRush.paused) vRush.play().catch(() => {}); else vRush.pause();
  } else if (prog.lecture) progPause(); else progLire();
}
const ACTIONS = {
  lire,
  debut: () => (ui.mode === 'rush' ? (vRush.pause(), seekRush(0)) : (progPause(), progPositionner(0))),
  prec: () => sautElement(-1),
  suiv: () => sautElement(1),
  'img-': () => pas(ui.mode === 'rush' ? -1 / fpsSrc(media(ui.src.id) ?? {}) : -1 / F()),
  'img+': () => pas(null),
  in: marquerEntree,
  out: marquerSortie,
  ajouter: ajouterSelection,
  dessus: ajouterDessus,
  case: () => ajouterCase(),
  indication: () => ajouterIndication(),
  effets: () => choisirPanneau('effets'),
  'sous-titres': basculerSousTitres,
  claude: () => montrerClaude(true),
  couper: () => couper(),
  lame: () => definirOutil(ui.outil === 'lame' ? 'selection' : 'lame'),
  supprimer,
  dupliquer,
  'rogner-debut': () => rognerATete('debut'),
  'rogner-fin': () => rognerATete('fin'),
  annuler: () => annuler(1),
  refaire: () => annuler(-1),
  tout: toutVoir,
  'zoom-': () => zoomer(Number($('#zoom').value) - 10),
  'zoom+': () => zoomer(Number($('#zoom').value) + 10),
  importer: feuilleImporter,
  'fermer-apercu': fermerApercu,
  'effacer-choix': effacerChoix,
};
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (a && ACTIONS[a]) ACTIONS[a]();
});
$('#b-biblio').addEventListener('click', async () => { await sauver(true); await api('POST', '/api/projets/fermer').catch(() => {}); P = null; afficherBibliotheque(); });
$('#b-format').addEventListener('click', feuilleBrief);
$('#b-claude').addEventListener('click', () => montrerClaude(true));
$('#b-zones').addEventListener('click', () => { ui.zones = !ui.zones; majZones(); });
$('#b-reglages').addEventListener('click', feuilleReglages);
$('#b-connexions').addEventListener('click', () => feuilleConnexions());
$('#b-retours').addEventListener('click', feuilleRetours);
$('#b-aide').addEventListener('click', feuilleAide);
for (const ev of ['play', 'pause', 'seeked', 'loadedmetadata']) vRush.addEventListener(ev, () => { if (ui.mode === 'rush') majSourceUI(); });

document.addEventListener('keydown', (e) => {
  if (ui.ecran !== 'montage') {
    if (e.key === 'Escape' && feuilleOuverte()) fermerFeuille();
    return;
  }
  const champ = e.target.closest?.('input, textarea, select, [contenteditable]');
  if (e.key === 'Escape') {
    if (feuilleOuverte()) return fermerFeuille();
    if (champ) return e.target.blur();
    if (ui.outil === 'lame') return definirOutil('selection');
    if (ui.mode === 'rush') return fermerApercu();
    if (ui.motsChoisis) return effacerMotsChoisis();
    return selectionner(null);
  }
  const cmd = e.metaKey || e.ctrlKey;
  if (cmd && e.key.toLowerCase() === 's') { e.preventDefault(); sauver(true); return note('Enregistré.'); }
  if (champ || ecranOuvert()) return;
  // les raccourcis habituels (CapCut, OpenReel)
  if (cmd) {
    const k = e.key.toLowerCase();
    if (k === 'z') { e.preventDefault(); return annuler(e.shiftKey ? -1 : 1); }
    if (k === 'b') { e.preventDefault(); return couper(); }
    if (k === 'c') { e.preventDefault(); return copier(); }
    if (k === 'x') { e.preventDefault(); return copier(true); }
    if (k === 'v') { e.preventDefault(); return coller(); }
    if (k === 'd') { e.preventDefault(); return dupliquer(); }
    if (k === 'a') { e.preventDefault(); return toutSelectionner(); }
    if (k === 'k') { e.preventDefault(); return montrerClaude(true); }
    return;
  }
  switch (e.key) {
    case ' ': e.preventDefault(); return lire();
    case 'ArrowLeft': e.preventDefault(); return pas(e.shiftKey ? -1 : (ui.mode === 'rush' ? -1 / fpsSrc(media(ui.src.id) ?? {}) : -1 / F()));
    case 'ArrowRight': e.preventDefault(); return pas(e.shiftKey ? 1 : null);
    case 'ArrowUp': case '[': e.preventDefault(); return sautElement(-1);
    case 'ArrowDown': case ']': e.preventDefault(); return sautElement(1);
    case 'Home': return ACTIONS.debut();
    case 'End': progPause(); if (ui.mode !== 'montage') definirMode('montage'); return progPositionner(seq.duree);
    case 'Backspace': case 'Delete': e.preventDefault(); return ui.motsChoisis ? couperMotsChoisis() : supprimer();
    case '+': case '=': return zoomer(Number($('#zoom').value) + 8);
    case '-': return zoomer(Number($('#zoom').value) - 8);
    case '0': return toutVoir();
    case '?': return feuilleAide();
    default:
  }
  switch (e.key.toLowerCase()) {
    case 'i': return marquerEntree();
    case 'o': return marquerSortie();
    case 'e': return e.shiftKey ? ajouterDessus() : ajouterSelection();
    case 'b': return ajouterCase();
    case 'n': return ajouterIndication();
    case 's': return couper();
    case 'q': return rognerATete('debut');
    case 'w': return rognerATete('fin');
    case 'c': return definirOutil('lame');
    case 'v': return definirOutil('selection');
    case 'd': return dupliquer();
    case 'x': return effacerChoix();
    default:
  }
});

// ——— Un logiciel, pas une page web ———
// Pas de menu de navigateur, pas d'image ni de lien qu'on emporte en glissant, pas de zoom de la page : seuls les
// champs de texte et les réponses de l'IA se sélectionnent et se copient (le reste est réglé dans style.css).
const zoneDeTexte = (el) => !!el?.closest?.('input, textarea, select, [contenteditable], .selectionnable, .cl-texte-b');
document.addEventListener('contextmenu', (e) => { if (!zoneDeTexte(e.target)) e.preventDefault(); });
document.addEventListener('dragstart', (e) => { if (!e.target.closest?.('[draggable="true"]')) e.preventDefault(); });
window.addEventListener('wheel', (e) => { if (e.ctrlKey && !e.target.closest?.('#tl')) e.preventDefault(); }, {passive: false});
for (const geste of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(geste, (e) => e.preventDefault());
document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); }, true);

// ——— Glisser-déposer depuis le Finder ———
// Les fichiers restent à leur place : Dérush les retrouve sur le disque (Spotlight), même s'ils pèsent des dizaines de Go.
// S'il ne les trouve pas (disque non indexé…), il les copie dans le projet.
const EXT_RAW_CLIENT = /\.(r3d|braw|ari|arx|crm|cine)$/i;
/** Copie un fichier dans le projet (média, ou référence pour l'IA). */
function televerser(f, {usage = null, cible = null} = {}) {
  return new Promise((ok) => {
    const x = new XMLHttpRequest();
    x.open('POST', `/api/televerser?nom=${encodeURIComponent(f.name)}${usage ? `&usage=${usage}` : ''}${cible ? `&cible=${encodeURIComponent(cible)}` : ''}`);
    x.setRequestHeader('x-derush-jeton', JETON);
    x.setRequestHeader('x-derush-fenetre', FENETRE);
    x.upload.onprogress = (ev) => etatSauvegarde(`Copie de ${f.name} : ${Math.round((ev.loaded / ev.total) * 100)} %`);
    x.onload = () => {
      etatSauvegarde('');
      const j = JSON.parse(x.responseText || '{}');
      if (x.status >= 400) { note(`${f.name} : ${j.erreur}`, true); return ok(null); }
      ok(j);
    };
    x.onerror = () => { etatSauvegarde(''); note(`${f.name} : copie impossible.`, true); ok(null); };
    x.send(f);
  });
}
/** Où sont ces fichiers sur le disque ? (null pour ceux que Spotlight ne connaît pas) */
async function localiser(fichiers) {
  // dans l'app native, la fenêtre a noté le vrai chemin de ce qu'on vient de glisser : rien à chercher sur le disque
  const depot = window.__derushDepot;
  const res = fichiers.map(() => null);
  if (depot?.chemins?.length && Date.now() - depot.t < 120000) {
    const libres = depot.chemins.map((c) => ({c, nom: c.split('/').pop().normalize('NFC')}));
    fichiers.forEach((f, i) => {
      const k = libres.findIndex((x) => x.nom === f.name.normalize('NFC'));
      if (k >= 0) res[i] = libres.splice(k, 1)[0].c;
    });
    if (res.every(Boolean)) return res;
  }
  try {
    const manquants = fichiers.map((f, i) => ({f, i})).filter((x) => !res[x.i]);
    const trouves = (await api('POST', '/api/localiser', {fichiers: manquants.map(({f}) => ({nom: f.name, taille: f.size, modifie: f.lastModified}))})).chemins;
    manquants.forEach(({i}, k) => { res[i] = trouves[k] ?? null; });
  } catch { /* introuvables : ils seront copiés */ }
  return res;
}
/** Des vidéos, sons ou images glissés depuis le Finder : importés sur place, sinon copiés. Renvoie les ids des médias. */
async function deposerMedias(fichiers) {
  const ok = [];
  for (const f of fichiers) {
    if (EXT_RAW_CLIENT.test(f.name)) note(`${f.name} : format RAW de caméra illisible. Exporte d’abord une version ProRes ou H.264.`, true);
    else if (!EXT_MEDIAS.test(f.name)) note(`${f.name} : ce n’est ni une vidéo, ni un son, ni une image. Pour donner un fichier à l’IA, glisse-le dans l’onglet « Consignes ».`, true);
    else ok.push(f);
  }
  if (!ok.length) return [];
  etatSauvegarde('Import…');
  const chemins = await localiser(ok);
  const ajoutes = [];
  const aCopier = [];
  const surPlace = ok.map((f, i) => ({f, chemin: chemins[i]})).filter((x) => x.chemin);
  ok.forEach((f, i) => { if (!chemins[i]) aCopier.push(f); });
  if (surPlace.length) {
    try {
      const r = await api('POST', '/api/medias', {chemins: surPlace.map((x) => x.chemin)});
      ajoutes.push(...r.ajoutes);
      for (const err of r.erreurs) {
        // macOS refuse l'accès sur place (dossier protégé) : on copie ce fichier dans le projet
        const x = surPlace.find((s) => err.startsWith(`${s.f.name} :`) || err.startsWith(`${s.chemin.split('/').pop()} :`));
        if (x && /accès refusé/i.test(err)) aCopier.push(x.f); else note(err, true);
      }
    } catch (e) { note(e.message, true); }
  }
  for (const f of aCopier) {
    const r = await televerser(f);
    if (r?.ajoutes) ajoutes.push(...r.ajoutes);
  }
  etatSauvegarde('');
  if (ajoutes.length) {
    await rafraichirMedias();
    note(`${ajoutes.length} média${ajoutes.length > 1 ? 's' : ''} importé${ajoutes.length > 1 ? 's' : ''}${aCopier.length ? '' : ', sans copie'} : préparation en cours.`);
    if (!ui.src.id) chargerRush(ajoutes[0], null, null, false);
  }
  return ajoutes;
}
/** Des fichiers donnés à l'IA (images, modèles 3D, PDF…) : pour tout le film (cible null) ou pour une case. */
async function deposerReferences(fichiers, cible = null) {
  if (!fichiers.length) return;
  const chemins = await localiser(fichiers);
  const trouves = chemins.filter(Boolean);
  try {
    if (trouves.length) P.references = (await api('POST', '/api/references', {chemins: trouves, cible})).references;
  } catch (e) { note(e.message, true); }
  for (const [i, f] of fichiers.entries()) {
    if (chemins[i]) continue;
    const r = await televerser(f, {usage: 'reference', cible});
    if (r?.references) P.references = r.references;
  }
  note(`${fichiers.length} fichier${fichiers.length > 1 ? 's' : ''} donné${fichiers.length > 1 ? 's' : ''} à l’IA${cible ? ` pour la case ${cible}` : ''}.`);
  rendrePanneauIA();
  rendreTimeline();
  rendreInspecteur();
}
let compteurDepot = 0;
const glisseDesFichiers = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');
window.addEventListener('dragenter', (e) => { if (P && glisseDesFichiers(e)) { compteurDepot++; $('#depot').classList.remove('cache'); } });
window.addEventListener('dragleave', () => { if (--compteurDepot <= 0) { compteurDepot = 0; $('#depot').classList.add('cache'); $('#claude').classList.remove('depot-claude'); } });
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (!P || !glisseDesFichiers(e)) return;
  // au-dessus de la colonne de Claude ou de la timeline, on voit où les fichiers vont
  const versClaude = !!e.target.closest?.('#cote') && !$('#claude').classList.contains('cache');
  $('#claude').classList.toggle('depot-claude', versClaude);
  $('#depot').classList.toggle('cache', versClaude || !!e.target.closest?.('#tl') || compteurDepot <= 0);
  // au-dessus de la timeline, on montre où les fichiers iront
  if (e.target.closest?.('#tl') && !e.target.closest('.clip.case')) {
    const c = cibleDepot(e);
    const ins = $('#insertion');
    if (c.type === 'montage') { ins.classList.remove('cache'); ins.style.left = `${(c.k < seq.segs.length ? seq.segs[c.k].debut : seq.duree) * ui.pps}px`; } else ins.classList.add('cache');
  } else $('#insertion').classList.add('cache');
});
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  compteurDepot = 0;
  $('#depot').classList.add('cache');
  $('#insertion').classList.add('cache');
  $('#claude').classList.remove('depot-claude');
  if (!P) return;
  const fichiers = [...(e.dataTransfer?.files ?? [])];
  if (!fichiers.length) return;
  // sur la colonne de Claude : des pièces jointes pour la conversation (références, charte, vidéos, zip…)
  if (e.target.closest?.('#cote') && !$('#claude').classList.contains('cache')) return deposerPieces(fichiers);
  // sur une case à créer, ou dans l'onglet « Pour l'IA » : des références pour l'IA
  const caseVisee = e.target.closest?.('.clip.case')?.dataset.id;
  if (caseVisee) return deposerReferences(fichiers, caseVisee);
  if (e.target.closest?.('#p-ia, [data-zone="references"]')) return deposerReferences(fichiers, e.target.closest('[data-cible]')?.dataset.cible || null);
  // dans la timeline : importés puis posés là où on les a lâchés
  const cible = e.target.closest?.('#tl') ? cibleDepot(e) : null;
  const ids = await deposerMedias(fichiers);
  if (cible && ids.length) {
    if (ui.mode !== 'montage') definirMode('montage');
    ids.forEach((id, n) => poserMedia(id, cible.type === 'montage' ? {type: 'montage', k: cible.k + n} : {type: 'dessus', t: cible.t}));
  } else choisirPanneau('medias');
});

// =====================================================================
// Habillage : effets, style, aperçu fidèle et « Créer la vidéo »
// =====================================================================
// Le moteur (moteur.js) dessine ici exactement ce que le rendu final dessinera : mêmes titres, mêmes sous-titres,
// mêmes mouvements. Seuls les effets d'optique (flou de zoom, filé) sont approchés par un flou simple dans l'aperçu.
const SCENE = {el: $('#scene'), zoom: $('#scene-zoom'), contenu: $('#scene-contenu'), toile: $('#hab-decoupe'), k: 1};
const hab = creerHabillage({derriere: $('#hab-derriere'), milieu: $('#hab-milieu'), devant: $('#hab-devant')});
const ICONE_CAT = {transition: 'eclair', titre: 'titre', ambiance: 'vague', son: 'onde'};
const COULEURS_STYLE = ['#FFD400', '#FFFFFF', '#E10600', '#FF5FA2', '#30D158', '#0A84FF', '#FF9F0A', '#BF5AF2'];
let ETAT = null;
let dernierT = 0;
const invaliderEtat = () => { ETAT = null; };
const estEffet = (i) => !!CATALOGUE[i?.modele];
const styleDuProjet = () => styleComplet(P.style, P.sortie);

/** Les mots dits dans le montage, en temps du montage (pour les sous-titres de l'aperçu). */
function motsDuMontage() {
  const res = [];
  for (const s of seq.segs) {
    const it = s.it;
    if (it.type !== 'plan') continue;
    const m = media(it.media);
    if (!m?.transcription) continue;
    const mots = C.mots.get(m.id);
    if (mots === undefined) { charger('mots', m).then(() => { invaliderEtat(); if (!prog.lecture) majHabillage(); }); continue; }
    if (!mots) continue;
    for (const w of motsEntre(mots, it.entree, it.sortie)) res.push({t: w.t, debut: Math.max(s.debut, s.debut + w.d - it.entree), fin: Math.min(s.fin, s.debut + w.f - it.entree), plan: it.id, ...(w.ev ? {evenement: true} : {})});
  }
  return res;
}
function etatHabillage() {
  ETAT ??= preparerEtat({
    sortie: P.sortie, duree: seq.duree, coupes: seq.segs.map((s) => s.debut).filter((t) => t > 0),
    effets: P.indications.filter(estEffet), style: P.style, mots: motsDuMontage(),
    sansSousTitres: P.montage.filter((it) => it.sans_sous_titres).map((it) => it.id),
  });
  return ETAT;
}

/** La scène prend toute la place possible dans le lecteur, au format exact de la vidéo finale. */
function majScene() {
  if (!P) return;
  const e = $('#ecran').getBoundingClientRect();
  const L = P.sortie.largeur;
  const H = P.sortie.hauteur;
  const k = Math.min(e.width / L, e.height / H);
  if (!(k > 0)) return;
  Object.assign(SCENE.el.style, {width: `${L * k}px`, height: `${H * k}px`, left: `${(e.width - L * k) / 2}px`, top: `${(e.height - H * k) / 2}px`});
  Object.assign(SCENE.zoom.style, {width: `${L}px`, height: `${H}px`, transform: `scale(${k})`, fontSize: `${L / 36}px`});
  SCENE.k = k;
  majZones();
}
/** Place une image (vidéo ou photo) pour qu'elle remplisse la scène, centrée sur le sujet : comme dans le rendu. */
function placer(el, m, t) {
  const L = P.sortie.largeur;
  const H = P.sortie.hauteur;
  const w = m.largeur || L;
  const h = m.hauteur || H;
  const s = Math.max(L / w, H / h);
  let fx = 0.5;
  let fy = 0.5;
  if (m.type === 'video' && Math.abs(w / h - L / H) > 0.01) {
    const pts = C.cadrage.get(m.id);
    if (pts === undefined) charger('cadrage', m).then(() => { if (!prog.lecture && ui.mode === 'montage') progAfficher(); });
    const p = pts ? pointCadrage(pts, t) : {x: 0.5, y: 0.5};
    const fen = fenetreCadrage(p.x, p.y, w / h, L / H);
    fx = fen[2] < 0.999 ? fen[0] / (1 - fen[2]) : 0.5;
    fy = fen[3] < 0.999 ? fen[1] / (1 - fen[3]) : 0.5;
  }
  const g = {x: -(w * s - L) * fx, y: -(h * s - H) * fy, w: w * s, h: h * s};
  Object.assign(el.style, {left: `${g.x}px`, top: `${g.y}px`, width: `${g.w}px`, height: `${g.h}px`});
  el._geo = g;
  return g;
}

/** Dessine l'habillage au temps de la tête de lecture : titres, sous-titres, mouvement de l'image, personne détourée. */
function majHabillage() {
  if (!P || ui.mode !== 'montage') return;
  const etat = etatHabillage();
  const t = borner(prog.t, 0, Math.max(0, seq.duree - 1e-4));
  const m = hab.maj(etat, t);
  SCENE.contenu.style.transform = m.echelle !== 1 || m.tx || m.ty || m.rot ? `translate(${m.tx.toFixed(1)}px, ${m.ty.toFixed(1)}px) scale(${m.echelle.toFixed(4)}) rotate(${m.rot}deg)` : '';
  const filtres = [];
  const flou = m.flou + m.flouZoom * 0.22 + m.flouFile.px * 0.5;
  if (flou > 0.4) filtres.push(`blur(${flou.toFixed(1)}px)`);
  if (m.sombre > 0.01) filtres.push(`brightness(${(1 - m.sombre).toFixed(3)})`);
  if (m.rvb > 0.5) {
    $('#f-rvb-r').setAttribute('dx', m.rvb.toFixed(1));
    $('#f-rvb-b').setAttribute('dx', (-m.rvb).toFixed(1));
    filtres.push('url(#f-rvb)');
  }
  SCENE.contenu.style.filter = filtres.join(' ');
  majDecoupe(etat, t);
  if (prog.lecture) jouerBruitages(etat, t);
  dernierT = t;
}
/** Pendant la lecture : joue les bruitages dont le moment vient de passer. */
function jouerBruitages(etat, t) {
  if (!(t > dernierT) || t - dernierT > 0.4) return;
  for (const s of etat.sons) {
    if (s.t > t) break;
    if (s.t > dernierT) jouerSon(s.fichier, s.volume);
  }
}
function jouerSon(fichier, volume = 0.6) {
  const a = new Audio(`/sons/${fichier}`);
  a.volume = borner(volume, 0, 1);
  a.play().catch(() => {});
}

// ——— Titre derrière la personne : masques de détourage (Apple Vision, calculés par le serveur) ———
const MASQUES = new Map(); // « M1:123 » → Image chargée, 'attente', ou null (pas encore détourée)
const demandes = new Set();
function masque(m, n) {
  const lire = (k) => {
    const cle = `${m.id}:${k}`;
    if (!MASQUES.has(cle)) {
      MASQUES.set(cle, 'attente');
      const img = new Image();
      img.onload = () => { MASQUES.set(cle, img); if (!prog.lecture && ui.mode === 'montage') majHabillage(); };
      // pas encore détourée : on redessine, ce qui demande le détourage au serveur
      img.onerror = () => { MASQUES.set(cle, null); if (k === n && !prog.lecture && ui.mode === 'montage') majHabillage(); };
      img.src = `/media/${m.id}/masque/${k}?j=${JETON}&p=${ui.cleProjet ?? ''}`;
    }
    const v = MASQUES.get(cle);
    return v instanceof Image ? v : v === null ? null : undefined;
  };
  const v = lire(n);
  for (let k = 1; k <= 10; k++) lire(n + k); // les suivants se chargent d'avance
  if (v) return v;
  const voisin = [n - 1, n + 1, n - 2].map((k) => MASQUES.get(`${m.id}:${k}`)).find((x) => x instanceof Image);
  return voisin ?? (v === null ? null : undefined);
}
function oublierMasquesAbsents() {
  for (const [k, v] of MASQUES) if (!(v instanceof Image)) MASQUES.delete(k);
}
/** Pose la personne détourée au-dessus du titre : l'image du plan, découpée par son masque. */
function majDecoupe(etat, t) {
  const toile = SCENE.toile;
  const e = decoupeA(etat, t);
  const s = e ? segmentA(seq, t) : null;
  const m = s?.it.type === 'plan' ? media(s.it.media) : null;
  if (!e || !m || m.type !== 'video') return toile.classList.add('cache');
  const v = PV[prog.actif];
  const n = Math.round((prog.lecture ? v.currentTime : s.it.entree + (t - s.debut)) * fpsSrc(m));
  const img = masque(m, n);
  if (!img || v.readyState < 2) {
    toile.classList.add('cache');
    if (img === null) demanderDetourage(e);
    return;
  }
  const L = P.sortie.largeur;
  const H = P.sortie.hauteur;
  const W = Math.min(L, 1080);
  const Ht = Math.round((W * H) / L);
  if (toile.width !== W || toile.height !== Ht) { toile.width = W; toile.height = Ht; }
  const g = v._geo ?? {x: 0, y: 0, w: L, h: H};
  const k = W / L;
  const c = toile.getContext('2d');
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, W, Ht);
  c.drawImage(img, g.x * k, g.y * k, g.w * k, g.h * k);
  c.globalCompositeOperation = 'source-in';
  c.drawImage(v, g.x * k, g.y * k, g.w * k, g.h * k);
  toile.classList.remove('cache');
}
/** Demande au serveur de détourer la personne sur les plans que couvre un titre « derrière la personne ». */
function demanderDetourage(e) {
  for (const s of seq.segs) {
    if (s.it.type !== 'plan' || s.fin <= e.debut || s.debut >= e.fin) continue;
    const m = media(s.it.media);
    if (m?.type !== 'video') continue;
    const a = s.it.entree + Math.max(0, e.debut - s.debut);
    const b = s.it.entree + Math.min(s.fin, e.fin) - s.debut;
    const cle = `${m.id}:${a.toFixed(2)}:${b.toFixed(2)}`;
    if (demandes.has(cle)) continue;
    demandes.add(cle);
    api('POST', `/api/medias/${m.id}/detourer`, {debut: Math.max(0, a - 0.1), fin: b + 0.1}).then(() => suivreFile()).catch((err) => { demandes.delete(cle); note(err.message, true); });
  }
}
let minuterieDetourage = null;
function verifierDetourages() {
  clearTimeout(minuterieDetourage);
  if (!P?.indications.some((i) => i.modele === 'titre-derriere')) return;
  minuterieDetourage = setTimeout(() => { for (const i of P.indications) if (i.modele === 'titre-derriere') demanderDetourage(i); }, 700);
}

// ——— Poser, accrocher et régler un effet ———
/** La coupe la plus proche d'un temps (null s'il n'y en a pas). */
function coupeProche(t) {
  const coupes = seq.segs.slice(1).map((s) => s.debut);
  return coupes.length ? coupes.reduce((a, c) => (Math.abs(c - t) < Math.abs(a - t) ? c : a)) : null;
}
/** Une transition se cale sur la coupe la plus proche ; un bruitage garde sa durée. */
function recaler(e) {
  const d = CATALOGUE[e.modele];
  if (d.categorie === 'transition') {
    const c = coupeProche(e.debut + d.avant);
    if (c != null) { e.debut = c - d.avant; e.fin = c + d.apres; }
  } else if (d.categorie === 'son') e.fin = e.debut + d.duree;
}
/** Accroche l'effet au plan qu'il survole : si le montage bouge avant lui, il suit son plan. */
function ancrer(e) {
  const d = CATALOGUE[e.modele];
  if (!d) return;
  const s = d.categorie === 'transition'
    ? seq.segs.find((x) => Math.abs(x.debut - (e.debut + d.avant)) < 0.6 / F())
    : segmentA(seq, borner(e.debut, 0, Math.max(0, seq.duree - 1e-6)));
  if (s) e.ancre = {id: s.it.id, d: arrondi(e.debut - s.debut, 4)};
  else delete e.ancre;
}
function reancrer() {
  // une transition dont le plan a disparu n'a plus de coupe : elle part avec lui
  P.indications = P.indications.filter((e) => !(e.ancre && CATALOGUE[e.modele]?.categorie === 'transition' && !seq.segs.some((x) => x.it.id === e.ancre.id)));
  for (const e of P.indications) {
    if (!e.ancre) continue;
    const s = seq.segs.find((x) => x.it.id === e.ancre.id);
    if (!s) { delete e.ancre; continue; }
    const d = e.fin - e.debut;
    const debut = Math.max(0, s.debut + e.ancre.d);
    if (Math.abs(debut - e.debut) > 1e-6) { e.debut = debut; e.fin = debut + d; }
  }
}
function ajouterEffet(modele, tVoulu = null) {
  const d = CATALOGUE[modele];
  if (!d) return;
  if (!seq.segs.length) return note('Ajoute d’abord un plan au montage.', true);
  const t = borner(tVoulu ?? prog.t, 0, seq.duree);
  let debut;
  let fin;
  let existant = null;
  if (d.categorie === 'transition') {
    const c = coupeProche(t);
    if (c == null) return note('Une transition se pose sur une coupe : il faut au moins deux plans.', true);
    debut = c - d.avant;
    fin = c + d.apres;
    // une seule transition par coupe : la nouvelle remplace l'ancienne
    existant = P.indications.find((i) => CATALOGUE[i.modele]?.categorie === 'transition' && Math.abs(i.debut + CATALOGUE[i.modele].avant - c) < 0.6 / F());
  } else if (modele === 'fin') {
    // le carton de fin va jusqu'au bout du film
    fin = seq.duree;
    debut = tVoulu != null && fin - t <= 8 && fin - t >= 0.8 ? surGrille(t, F()) : Math.max(0, surGrille(fin - d.duree, F()));
  } else {
    debut = surGrille(Math.min(t, Math.max(0, seq.duree - 2 / F())), F());
    fin = d.categorie === 'son' ? debut + d.duree : Math.min(debut + d.duree, seq.duree);
  }
  let e;
  modifier(() => {
    if (existant) { e = existant; e.modele = modele; e.reglages = {}; e.debut = debut; e.fin = fin; } else {
      e = {id: nouvelId(P, 'I'), genre: 'note', debut, fin, consigne: '', modele, reglages: {}};
      P.indications.push(e);
    }
    ancrer(e);
    ui.sel = {type: 'indic', id: e.id};
  });
  if (ui.mode !== 'montage') definirMode('montage');
  revoirEffet(e, false);
  montrerDansTimeline(e.debut);
  note(d.categorie === 'transition' ? `« ${d.nom} » posé sur la coupe. Appuie sur espace pour le voir.` : d.categorie === 'son' ? `Bruitage « ${d.nom} » posé.` : `« ${d.nom} » posé : écris ton texte à droite.`);
  if (d.reglages.texte) setTimeout(() => { const c = $('#inspecteur [data-reglage="texte"]'); c?.focus(); c?.select(); }, 40);
}
/** Montre un effet : place la tête de lecture à l'endroit où il est le plus visible (ou joue le bruitage). */
function revoirEffet(e, lecture = true) {
  const d = CATALOGUE[e.modele];
  progPause();
  if (d.categorie === 'son') { jouerSon(d.fichier, reglagesDe(e.modele, e.reglages).volume / 100); return progPositionner(e.debut); }
  if (lecture) {
    progPositionner(Math.max(0, e.debut - 0.6));
    return progLire();
  }
  progPositionner(d.categorie === 'transition' ? e.debut + d.avant + 2 / F() : Math.min(e.fin - 2 / F(), e.debut + Math.min(1, (e.fin - e.debut) * 0.6)));
}

// ——— Onglet Effets : cliquer pose l'effet à la tête de lecture, glisser le pose où l'on veut ———
function rendrePanneauEffets() {
  $('#p-effets').innerHTML = `<div class="nav-effets">${Object.entries(CATEGORIES).map(([k, c]) => `<button class="cat-${k}" data-vers="${k}">${ic(ICONE_CAT[k])}${esc(c.nom)}</button>`).join('')}</div>
    <p>Clique sur un effet : il se pose à la tête de lecture. Ou glisse-le dans la timeline. Il se règle ensuite à droite.</p>${Object.entries(CATEGORIES).map(([k, c]) => `
    <h3 class="cat-${k}" id="effets-${k}">${ic(ICONE_CAT[k])}${esc(c.nom)}</h3><p>${esc(c.aide)}</p>
    <div class="tuiles-effets cat-${k}">${Object.entries(CATALOGUE).filter(([, d]) => d.categorie === k).map(([id, d]) => `<button class="tuile-effet" data-effet="${id}"><b>${esc(d.nom)}</b><small>${esc(d.description)}</small></button>`).join('')}</div>`).join('')}`;
}
$('#p-effets').addEventListener('click', (e) => {
  const vers = e.target.closest('[data-vers]')?.dataset.vers;
  if (vers) $(`#effets-${vers}`)?.scrollIntoView({block: 'start', behavior: 'smooth'});
});
$('#p-effets').addEventListener('pointerdown', (e) => {
  const tuile = e.target.closest('[data-effet]');
  if (!tuile || e.button !== 0) return;
  const modele = tuile.dataset.effet;
  const x0 = e.clientX;
  const y0 = e.clientY;
  let fantome = null;
  const surTimeline = (ev) => !!document.elementFromPoint(ev.clientX, ev.clientY)?.closest('#tl');
  const bouger = (ev) => {
    if (!fantome && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
    if (!fantome) {
      fantome = document.createElement('div');
      fantome.className = 'fantome-effet';
      fantome.textContent = CATALOGUE[modele].nom;
      document.body.append(fantome);
    }
    fantome.style.left = `${ev.clientX}px`;
    fantome.style.top = `${ev.clientY}px`;
    const g = $('#guide-aimant');
    if (surTimeline(ev) && seq.segs.length) {
      let t = Math.max(0, tempsDepuisX(ev.clientX));
      if (CATALOGUE[modele].categorie === 'transition') t = coupeProche(t) ?? t;
      g.style.left = `${t * ui.pps}px`;
      g.classList.remove('cache');
    } else g.classList.add('cache');
  };
  const fin = (ev) => {
    window.removeEventListener('pointermove', bouger);
    cacherGuide();
    if (!fantome) return ajouterEffet(modele);
    fantome.remove();
    if (surTimeline(ev)) ajouterEffet(modele, Math.max(0, tempsDepuisX(ev.clientX)));
  };
  window.addEventListener('pointermove', bouger);
  window.addEventListener('pointerup', fin, {once: true});
});

// ——— Onglet Style : l'habillage de tout le film ———
function rendrePanneauStyle() {
  const s = styleDuProjet();
  const coche = (cle, nom, v) => `<label class="reglage"><span>${nom}</span><input type="checkbox" data-style="${cle}"${v ? ' checked' : ''}></label>`;
  const glissiere = (cle, nom, v) => `<label class="reglage"><span>${nom}</span><input type="range" min="0" max="1" step="0.05" data-style="${cle}" value="${v}"></label>`;
  $('#p-style').innerHTML = `<h3>Un style en un clic</h3><p>Il habille tout le film : sous-titres, effet sur chaque coupe, grain. Tout se règle ensuite ici.</p>
    <div class="looks">${Object.entries(LOOKS).map(([k, l]) => `<button class="look${s.look === k ? ' actif' : ''}" data-look="${k}"><b><i style="background:${l.style.accent}"></i>${esc(l.nom)}</b><small>${esc(l.description)}</small></button>`).join('')}</div>
    <h3>Sous-titres</h3><p>Ils viennent du texte de tes rushes (onglet Texte).</p>
    <div class="segmente" style="width:100%;margin:0 0 10px">${Object.entries(STYLES_SOUS_TITRES).map(([k, n]) => `<button style="flex:1;padding:4px 2px" data-st="${k}"${s.sous_titres.style === k ? ' class="actif"' : ''}>${n}</button>`).join('')}</div>
    ${coche('majuscules', 'En majuscules', s.sous_titres.majuscules)}
    <label class="reglage"><span>Position</span><select data-style="position">${option('bas', 'En bas', s.sous_titres.position !== 'centre')}${option('centre', 'Au centre', s.sous_titres.position === 'centre')}</select></label>
    <h3>Couleur et police</h3>
    <div class="reglage"><span>Couleur</span><div class="couleurs">${COULEURS_STYLE.map((c) => `<button data-couleur="${c}" style="background:${c}"${s.accent.toUpperCase() === c ? ' class="actif"' : ''} title="${c}"></button>`).join('')}<input type="color" data-style="accent" value="${s.accent}" title="Une autre couleur"></div></div>
    <label class="reglage"><span>Police des titres</span><select data-style="police_titres">${POLICES_TITRES.map((p) => option(p, p, s.police_titres === p)).join('')}</select></label>
    <h3>Image</h3>
    <label class="reglage"><span>Sur chaque coupe</span><select data-style="transition_auto">${option('aucune', 'Rien', s.transition_auto === 'aucune')}${Object.entries(CATALOGUE).filter(([, d]) => d.categorie === 'transition').map(([k, d]) => option(k, d.nom, s.transition_auto === k)).join('')}</select></label>
    ${glissiere('grain', 'Grain', s.grain)}${glissiere('vignette', 'Bords sombres', s.vignette)}
    ${coche('bandes', 'Bandes noires', s.bandes)}${coche('barre', 'Barre de progression', s.barre)}${coche('bruitages', 'Bruitages des effets', s.bruitages !== false)}
    <h3>Réseau visé</h3><p>Dérush garde les titres et les sous-titres hors des zones que son interface recouvre.</p>
    <label class="reglage"><span>Réseau</span><select data-style="plateforme">${Object.entries(PLATEFORMES).map(([k, p]) => option(k, p.nom, s.plateforme === k)).join('')}</select></label>
    <button class="btn petit" data-zones style="width:100%">${ic('telephone')}${ui.zones ? 'Masquer' : 'Montrer'} les zones cachées</button>`;
}
function modifierStyle(fn, cle) {
  modifier(() => {
    P.style = {...styleDuProjet()};
    P.style.sous_titres = {...P.style.sous_titres};
    fn(P.style);
  }, {cle: `style.${cle}`, inspecteur: false});
  if (ui.zones) majZones();
  rendreFormatTl();
}
$('#p-style').addEventListener('click', (e) => {
  const look = e.target.closest('[data-look]')?.dataset.look;
  if (look) return modifierStyle((s) => { Object.assign(s, LOOKS[look].style, {look, sous_titres: {...LOOKS[look].style.sous_titres}}); }, `look.${look}`);
  const st = e.target.closest('[data-st]')?.dataset.st;
  if (st) return modifierStyle((s) => { s.sous_titres.style = st; }, 'st');
  const couleur = e.target.closest('[data-couleur]')?.dataset.couleur;
  if (couleur) return modifierStyle((s) => { s.accent = couleur; }, 'accent');
  if (e.target.closest('[data-zones]')) { ui.zones = !ui.zones; majZones(); rendrePanneauStyle(); }
});
$('#p-style').addEventListener('input', (e) => {
  const cle = e.target.dataset.style;
  if (!cle) return;
  const el = e.target;
  const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
  // pendant qu'on fait glisser un curseur, le panneau ne se redessine pas (le curseur resterait coincé)
  const panneau = ui.panneau;
  if (el.type === 'range' || el.type === 'color') ui.panneau = '';
  modifierStyle((s) => { if (cle === 'majuscules' || cle === 'position') s.sous_titres[cle] = v; else s[cle] = v; }, cle);
  ui.panneau = panneau;
});

// ——— Infos d'un effet (colonne de droite) ———
function inspecteurEffet(i) {
  const d = CATALOGUE[i.modele];
  const r = reglagesDe(i.modele, i.reglages);
  const champ = ([k, p]) => {
    if (p.type === 'texte') return `<label class="champ"><span>${esc(p.nom)}</span><input data-reglage="${k}" value="${esc(r[k])}" placeholder="${esc(p.aide || '')}"></label>`;
    if (p.type === 'choix') return `<label class="champ"><span>${esc(p.nom)}</span><select data-reglage="${k}">${Object.entries(p.options).map(([v, n]) => option(v, n, r[k] === v)).join('')}</select></label>`;
    if (p.type === 'nombre') return `<label class="champ"><span>${esc(p.nom)} · <output>${r[k]} ${esc(p.unite)}</output></span><input type="range" min="${p.min}" max="${p.max}" step="1" data-reglage="${k}" value="${r[k]}" style="padding:0;border:0;background:none;accent-color:var(--accent-2)"></label>`;
    return `<label class="rangee" style="gap:7px;margin-bottom:10px"><input type="checkbox" data-reglage="${k}"${r[k] ? ' checked' : ''}> ${esc(p.nom)}</label>`;
  };
  const sous = seq.segs.filter((s) => s.fin > i.debut && s.debut < i.fin).map((s) => s.it.id);
  const reglable = d.categorie === 'titre' || d.categorie === 'ambiance';
  let detourage = '';
  if (i.modele === 'titre-derriere') {
    const pret = SRV.moteurs?.detourage?.ok;
    const enCours = SRV.file?.en_cours?.meta?.type === 'detourage' || SRV.file?.attente?.some((t) => t.meta?.type === 'detourage');
    const video = sous.some((id) => media(item(id)?.media)?.type === 'video');
    detourage = `<div class="info-detourage">${!video ? 'Pose ce titre sur un plan vidéo où l’on voit une personne.' : enCours ? 'Détourage de la personne en cours… Le titre passera derrière elle dans quelques secondes.' : pret ? 'La personne est détourée automatiquement, sur ton Mac. Règle la hauteur pour que le titre passe derrière sa tête.' : 'Le détourage s’installe tout seul la première fois (40 Mo), puis le titre passe derrière la personne.'}</div>`;
  }
  return `${tete(`effet cat-${d.categorie}`, ICONE_CAT[d.categorie], d.nom, `${tc(i.debut, F())} → ${tc(i.fin, F())}${sous.length ? ` · sur ${sous.join(', ')}` : ''}`)}
    <p class="dim" style="margin:-4px 0 12px">${esc(d.description)}</p>${detourage}
    ${Object.keys(d.reglages).length ? `<div class="groupe-insp">${Object.entries(d.reglages).map(champ).join('')}</div>` : ''}
    ${reglable ? `<div class="groupe-insp"><div class="deux"><label class="champ" style="margin:0"><span>Début</span><input class="tc-champ" style="width:100%" data-tc="debut" value="${tc(i.debut, F())}"></label>
      <label class="champ" style="margin:0"><span>Fin</span><input class="tc-champ" style="width:100%" data-tc="fin" value="${tc(i.fin, F())}"></label></div>
      <p class="dim" style="margin:8px 0 0;font-size:11.5px">Dans la timeline : glisse l’effet pour le déplacer, tire ses bords pour l’allonger.</p></div>` : `<p class="dim" style="font-size:11.5px">${d.categorie === 'transition' ? 'La transition reste accrochée à sa coupe. Glisse-la sur une autre coupe pour la déplacer.' : 'Glisse le bruitage dans la timeline pour le déplacer.'}</p>`}
    <div class="rangee"><button class="btn petit" data-act="revoir">${ic('lire')}Revoir</button><button class="btn petit" data-act="supprimer">${ic('poubelle')}Supprimer</button></div>`;
}

/** Les zones que l'interface du réseau recouvre, dessinées par-dessus la scène. */
function majZones() {
  const z = $('#zones');
  $('#b-zones').classList.toggle('actif', !!ui.zones);
  const actif = !!ui.zones && ui.mode === 'montage' && !!P;
  z.classList.toggle('cache', !actif);
  if (!actif) return;
  const p = PLATEFORMES[styleDuProjet().plateforme];
  const q = p.zones;
  const pc = (v) => `${(v * 100).toFixed(2)}%`;
  z.innerHTML = `<i style="left:0;top:0;width:100%;height:${pc(q.haut)}"></i><i style="left:0;bottom:0;width:100%;height:${pc(q.bas)}"></i>
    <i style="left:0;top:${pc(q.haut)};width:${pc(q.gauche)};height:${pc(1 - q.haut - q.bas)}"></i><i style="right:0;top:${pc(q.haut)};width:${pc(q.droite)};height:${pc(1 - q.haut - q.bas)}"></i>
    <span>Caché par ${esc(p.nom)}</span>`;
}

// ——— Créer la vidéo ———
function feuilleCreer() {
  if (!seq.segs.length) return note('Sans IA, Dérush a besoin d’au moins un plan dans le montage. Sinon, demande à ton IA : elle choisira les passages.', true);
  const s = styleDuProjet();
  const mo = SRV.moteurs?.rendu;
  const f = feuille(`<h3>Créer la vidéo</h3><p class="sous-titre">Dérush fabrique la vidéo finale sur ton ordinateur : le montage, les effets, les titres et les sous-titres, avec le son au niveau des réseaux.</p>
    <label class="champ"><span>Pour quel réseau ?</span><select id="cr-reseau">${Object.entries(PLATEFORMES).map(([k, p]) => option(k, p.nom, s.plateforme === k)).join('')}</select></label>
    <p class="dim" style="font-size:12px">${FORMATS[P.sortie.preset]?.ratio} · ${P.sortie.largeur} × ${P.sortie.hauteur} · ${F()} i/s · ${dureeLisible(seq.duree)} · ${P.indications.filter(estEffet).length} effet(s) · style « ${esc(LOOKS[s.look]?.nom ?? s.look)} »</p>
    ${mo?.ok ? '' : `<div class="verif attention petit">${ic('attention')}<div class="espace">La première fois, le moteur de rendu s’installe tout seul (${esc(mo?.taille ?? '500 Mo')}, il faut Internet). Compte quelques minutes de plus.</div></div>`}
    <div class="pied"><button class="btn" data-fermer>Annuler</button><button class="btn principal" data-go>${ic('rendu')}Créer la vidéo</button></div>`);
  f.addEventListener('click', async (e) => {
    if (e.target.closest('[data-fermer]')) return fermerFeuille();
    if (!e.target.closest('[data-go]')) return;
    const plateforme = $('#cr-reseau', f).value;
    arreterLecture();
    await sauver(true);
    try {
      const {tache} = await api('POST', '/api/rendre', {plateforme});
      ui.renduTache = tache;
      feuille(`<h3>Création de la vidéo…</h3><p class="sous-titre">Découpe des plans, rendu image par image, réglage du son, contrôles. Tu peux masquer cette fenêtre et continuer à travailler : elle reviendra quand la vidéo sera prête.</p>
        <div class="jauge"><i id="jauge-rendu" style="width:2%"></i></div><p class="dim" id="etat-rendu" style="margin-top:10px">En attente…</p>
        <div class="pied"><button class="btn" data-fermer>Masquer</button></div>`).querySelector('[data-fermer]').onclick = fermerFeuille;
      suivreFile();
    } catch (err) { note(err.message, true); }
  });
}
function afficherRendu(t) {
  ui.renduTache = null;
  SRV.moteurs = {...SRV.moteurs, rendu: {...(SRV.moteurs?.rendu ?? {}), ok: true}};
  if (t.etat === 'erreur') {
    feuille(`<h3>La vidéo n’a pas pu être créée</h3><p class="resultat">${esc(t.erreur)}</p><div class="pied"><button class="btn principal" data-fermer>OK</button></div>`).querySelector('[data-fermer]').onclick = fermerFeuille;
    return;
  }
  const r = t.resultat;
  const f = feuille(`<h3>${ic('ok')} Ta vidéo est prête</h3><p class="sous-titre">${esc(r.reseau_nom)} · ${r.largeur} × ${r.hauteur} · ${dureeLisible(r.duree)} · ${esc(r.taille_lisible)}</p>
    <div class="resultat-video${r.largeur > r.hauteur ? ' large' : ''}"><video src="/video?nom=${encodeURIComponent(r.nom)}&j=${JETON}" controls playsinline></video>
      <div class="verifs" style="margin:0">${r.controles.map((c) => `<div class="verif petit ${c.ok ? (c.info ? 'info' : 'ok') : 'attention'}">${ic(c.ok ? 'ok' : 'attention')}<div class="espace">${esc(c.t)}${c.d ? `<small>${esc(c.d)}</small>` : ''}</div></div>`).join('')}
      ${(r.avertissements ?? []).map((a) => `<div class="verif petit attention">${ic('attention')}<div class="espace">${esc(a)}</div></div>`).join('')}</div></div>
    <div class="apres-rendu"><div><b>Et maintenant ?</b><small>Avant de la publier, fais-la analyser : ton IA te dit ce qui retient les gens et ce qui les fait partir. Puis partage-la avec les bonnes légendes et les bons hashtags.</small></div>
      <button class="btn" data-analyser>${ic('eclair')}Analyser</button><button class="btn claude" data-partager>${ic('publier')}<span>Partager</span></button></div>
    <div class="pied"><button class="btn" data-finder>${ic('finder')}Afficher dans le dossier</button><span class="espace"></span><button class="btn" data-ia>${ic('etincelle', 'plein')}Aller plus loin avec l’IA</button><button class="btn principal" data-fermer>OK</button></div>`, true);
  const vid = f.querySelector('video');
  vid.addEventListener('loadedmetadata', () => { vid.currentTime = Math.min(1.5, vid.duration / 3); }, {once: true});
  f.querySelector('[data-fermer]').onclick = fermerFeuille;
  f.querySelector('[data-finder]').onclick = () => api('POST', '/api/ouvrir', {chemin: r.video}).catch((e) => note(e.message, true));
  f.querySelector('[data-ia]').onclick = () => { fermerFeuille(); montrerClaude(true); };
  f.querySelector('[data-analyser]').onclick = () => { vid.pause(); fermerFeuille(); PUB.ouvrir(r.nom, 'analyse'); };
  f.querySelector('[data-partager]').onclick = () => { vid.pause(); fermerFeuille(); PUB.ouvrir(r.nom, 'partage'); };
}

// =====================================================================
// Demander à Claude : on écrit ce qu'on veut, Claude Code monte la vidéo dans le dossier du projet
// =====================================================================
const prefs = {
  /** Un réglage gardé par la fenêtre. Une liste revient en liste (même gardée en texte par une version d'avant). */
  lire(k, d) {
    let brut = null;
    try { brut = localStorage.getItem(`derush.${k}`); } catch { return d; }
    if (brut == null) return d;
    if (!Array.isArray(d)) return brut;
    try { const v = JSON.parse(brut); if (Array.isArray(v)) return v; } catch { /* l'ancienne forme : « tiktok,youtube » */ }
    return brut.split(',').map((x) => x.trim()).filter(Boolean);
  },
  ecrire(k, v) { try { localStorage.setItem(`derush.${k}`, Array.isArray(v) ? JSON.stringify(v) : v); } catch { /* stockage indisponible */ } },
};
/** Une illustration animée (dessinée dans index.html), recopiée dans la page pour que ses animations tournent. */
function ill(nom) {
  const s = document.getElementById(`ill-${nom}`);
  return s ? `<svg viewBox="${s.getAttribute('viewBox')}" aria-hidden="true">${s.innerHTML}</svg>` : '';
}
const FLECHE = '<div class="fleche"><svg viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg></div>';
const geste = (dessin, num, titre, texte, plus = '') => `<div class="geste">${ill(dessin)}${num ? `<span class="num">${num}</span>` : ''}<b>${titre}</b><small>${texte}</small>${plus}</div>`;
/** Les trois gestes de Dérush, en images : déposer, couper (ou pas), demander. */
const guideGestes = () => `<div class="guide">${geste('rushes', '01', 'Dépose', 'Tes vidéos, tes sons, tes photos. Même sans rien trier.')}${FLECHE}${geste('coupe', '02', 'Coupe, ou pas', 'Garde les bons passages. Ou ne touche à rien : ton IA choisira.')}${FLECHE}${geste('claude', '03', 'Demande', 'Écris ce que tu veux, joins tes références. Ton IA monte, et publie si tu veux.')}</div>`;

// ——— l'IA qui monte : Claude (compte Claude) ou Codex (compte ChatGPT) ———
// Les logos viennent de Simple Icons (CC0, public/logos : voir LISEZMOI.md pour la version de chacun) ; seuls les outils
// qui n'ont pas de logo à eux (Real SFX, Earshot…) gardent un picto.
const LOGOS = {openverse: 'openverse', claude: 'claude', anthropic: 'anthropic', codex: 'openai', openai: 'openai', chatgpt: 'openai', whisper: 'openai', gemini: 'googlegemini', google: 'google',
  elevenlabs: 'elevenlabs', drive: 'googledrive', treg: 'treg', tiktok: 'tiktok', youtube: 'youtubeshorts', instagram: 'instagram', linkedin: 'linkedin', facebook: 'facebook', x: 'x',
  blender: 'blender', github: 'github', ffmpeg: 'ffmpeg', python: 'python', node: 'nodedotjs', git: 'git', chrome: 'googlechrome', apple: 'apple', macos: 'macos', linux: 'linux', windows: 'windows',
  premiere: 'adobepremierepro', resolve: 'davinciresolve'};
const PICTOS = {realsfx: 'vague', earshot: 'oreille', sons: 'onde', remotion: 'film', maj: 'maj', competences: 'outil'};
/** Un logo sur sa pastille claire : les logos noirs (TikTok, GitHub…) restent lisibles sur le fond sombre. */
const logo = (cle, taille = 22, cls = '') => (LOGOS[cle]
  ? `<span class="logo l-${cle} ${cls}" style="--t:${taille}px"><img src="/logos/${LOGOS[cle]}.svg" alt="" draggable="false"></span>`
  : `<span class="logo picto p-${cle} ${cls}" style="--t:${taille}px">${ic(PICTOS[cle] ?? 'etincelle')}</span>`);
const moteurIA = () => ui.claude?.ia?.choisi ?? SRV.moteurs?.ia_choisie ?? 'claude';
const NOMS_IA = {claude: 'Claude', codex: 'Codex', gemini: 'Gemini'};
const COMPTES_IA = {claude: {compte: 'Avec ton compte Claude (Pro ou Max).', relie: 'connecté à Claude'}, codex: {compte: 'Avec ton compte ChatGPT (Plus, Pro ou Business).', relie: 'connecté à ChatGPT'},
  gemini: {compte: 'Avec ton compte Google (Gemini 4 Argon, Gemini 3.8 Flash, et Carbon si ton compte le propose), par la commande agy d’Antigravity.', relie: 'connecté à Google'}};
const nomIA = (m = moteurIA()) => NOMS_IA[m] ?? 'Claude';
const iaPrete = (m = moteurIA()) => !!ui.claude?.[m]?.ok;
const qualiteIA = () => ui.claude?.ia?.qualite ?? 'max';
const RESEAUX_UI = {tiktok: 'TikTok', youtube: 'YouTube Shorts', instagram: 'Instagram Reels', linkedin: 'LinkedIn'};
const ETATS_PUB = {publie: 'Publiée', brouillon: 'Brouillon dans ta boîte', en_cours: 'En cours', echec: 'Pas publiée'};
/** Le format d'une vidéo, dit simplement (9:16, 16:9…). */
const ratioDe = (l, h) => Object.values(FORMATS).find((f) => Math.abs(f.largeur / f.hauteur - l / h) < 0.02)?.ratio ?? `${l}×${h}`;
const minSec = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let minuterieClaude = null;
let chargementClaude = false;

// ——— adresses des fichiers de la conversation (le jeton est dans l'adresse : les balises <img> n'ont pas d'en-tête) ———
const urlPiece = (id, quoi = 'apercu') => `/claude/piece/${id}/${quoi}?j=${JETON}&p=${ui.cleProjet ?? ''}`;
const urlDirect = (r, n) => `/claude/direct/${encodeURIComponent(r.id)}/f-${String(n).padStart(5, '0')}.jpg?j=${JETON}&p=${ui.cleProjet ?? ''}`;
const urlVue = (n) => `/claude/vue/${n}?j=${JETON}&p=${ui.cleProjet ?? ''}`;
const urlVideo = (nom) => `/video?nom=${encodeURIComponent(nom)}&j=${JETON}&p=${ui.cleProjet ?? ''}`;
const urlCreation = (id) => `/creation/${id}?j=${JETON}&p=${ui.cleProjet ?? ''}`;
const ICONES_PIECE = {image: 'image', video: 'film', son: 'onde', pdf: 'texte', police: 'titre', archive: 'dossier', '3d': 'cube', design: 'palette', document: 'texte', autre: 'trombone'};
const piecesEnAttente = () => (ui.claude?.pieces ?? []).filter((x) => x.message == null);
const piecesEnvoyees = () => (ui.claude?.pieces ?? []).filter((x) => x.message != null);
/** Le rendu en cours (ou le dernier) de Claude : ses petites images arrivent au fur et à mesure. */
const dernierRendu = (c = ui.claude) => c?.en_cours?.direct?.rendus?.at(-1) ?? null;
const renduActif = (r) => !!r && !['fini', 'erreur'].includes(r.etape);

/** Relit où en est Claude : la conversation, les pièces jointes, les vidéos livrées, le travail en cours. */
async function chargerClaude(force = false) {
  if (!P || ui.ecran !== 'montage' || ui.remplacee || chargementClaude) return;
  chargementClaude = true;
  const avant = ui.claude;
  try {
    ui.claude = await api('GET', `/api/claude${force ? '?force=1' : ''}`);
  } catch { /* pas de réponse : on réessaie au prochain tour */ } finally { chargementClaude = false; }
  apresClaude(avant);
}
function apresClaude(avant) {
  const c = ui.claude;
  if (!c) return;
  clearTimeout(minuterieClaude);
  // pendant le travail on suit de près (encore plus pendant un rendu), et tant que des pièces jointes se préparent
  if (c.en_cours) minuterieClaude = setTimeout(chargerClaude, renduActif(dernierRendu(c)) ? 800 : 1400);
  else if (c.pieces.some((x) => x.en_preparation)) minuterieClaude = setTimeout(chargerClaude, 1500);
  $('#ecran-montage').classList.toggle('claude-travaille', !!c.en_cours);
  $('#b-claude span').textContent = c.en_cours ? `${nomIA(c.en_cours.moteur)} travaille…` : 'Demander à l’IA';
  if (avant?.en_cours && !c.en_cours) {
    const dernier = c.echanges.at(-1);
    const qui = nomIA(dernier?.moteur);
    natif('attention');
    if (dernier?.role === 'claude' && dernier.version) {
      const n = c.versions.find((x) => x.n === dernier.version)?.videos.length ?? 1;
      note(n > 1 ? `Tes ${n} vidéos sont prêtes. Regarde-les, puis dis à ${qui} ce qu’il faut changer.` : `Ta vidéo est prête. Regarde-la, puis dis à ${qui} ce qu’il faut changer.`, false, true);
      montrerVue('claude', dernier.version, 0);
    } else if (dernier?.publications?.length) note(`Publication : ${dernier.publications.map((p) => `${RESEAUX_UI[p.reseau] ?? p.reseau} ${(ETATS_PUB[p.etat] ?? p.etat).toLowerCase()}`).join(', ')}.`, false, dernier.publications.some((p) => p.etat === 'publie' || p.etat === 'brouillon'));
    else if (dernier?.arret) note(`${qui} s’est arrêté.`);
    else if (dernier?.erreur) note(`${qui} n’a pas pu finir. Le détail est dans la conversation.`, true);
    else note(`${qui} a répondu.`, false, true);
    ui.depart = null;
    chargerRetours();
  }
  // un rendu commence : le lecteur le montre en direct (sauf si on regarde déjà autre chose)
  const r = dernierRendu(c);
  if (r && renduActif(r) && r.images.length && ui.directAuto !== r.id) {
    ui.directAuto = r.id;
    if (!prog.lecture && ui.mode === 'montage' && !(ui.vue === 'claude' && !$('#v-claude').paused)) montrerVue('direct');
  }
  if (ui.vue === 'direct' && !c.en_cours) montrerVue(c.versions.length ? 'claude' : 'montage');
  if (ui.vue === 'claude' && !c.versions.some((v) => v.n === ui.versionVue)) montrerVue(c.versions.length ? 'claude' : 'montage');
  majVueSwitch();
  rendreClaude();
  majDirect();
  rendreClaudePiste();
}

/** Des demandes toutes faites, selon ce qu'il y a dans le projet : [titre court, demande complète]. Un clic recopie la demande. */
function ideesIA(suite) {
  const reseau = P.sortie.hauteur > P.sortie.largeur ? 'TikTok et Reels' : 'YouTube';
  const son = ui.claude?.elevenlabs ? [[suite ? 'Refaire le son' : 'Musique et voix off', suite ? 'Refais toute la bande son avec ElevenLabs : une musique dans le ton, un bruitage sur chaque coupe, plus basse quand quelqu’un parle.' : 'Mets une musique ElevenLabs dans le ton de la vidéo, un bruitage sur chaque coupe, et une voix off qui la présente en une phrase.']] : [];
  const charte = (ui.claude?.pieces ?? []).some((x) => ['charte', 'logo', 'police'].includes(x.role)) ? [['Suivre ma charte', 'Respecte la charte graphique que je t’ai donnée : couleurs, polices et logo, partout dans la vidéo.']] : [];
  if (suite) return [
    ['Plus court', 'Raccourcis la vidéo : garde seulement les moments les plus forts.'],
    ['Autres formats', 'Fais-en aussi une version 16:9 pour YouTube et une version carrée pour Instagram.'],
    ['Sous-titres', 'Ajoute des sous-titres mot à mot, bien lisibles, avec les mots importants en couleur.'],
    ...son, ...charte,
  ];
  if (modeProjet() === 'motion') return [
    ['Une annonce', 'Fais une animation de 15 secondes qui annonce … (le quoi, la date, le lieu) : un titre qui claque, trois infos clés, puis un carton de fin.'],
    ['Un sujet expliqué', 'Explique en 30 secondes, en motion design : … Cherche des chiffres récents, anime-les (compteurs, barres, schéma), et cite tes sources à la fin.'],
    ['Un logo animé', 'Anime mon logo (je te le joins) en 5 secondes : une belle entrée, un son court, sur un fond à ma couleur.'],
    ...charte,
  ];
  if (modeProjet() === 'extraits' && P.medias.length) return [
    ['3 extraits forts', 'Trouve les 3 meilleurs moments et fais-en 3 clips verticaux de 30 à 45 secondes, chacun avec une première phrase qui accroche, des sous-titres et un titre.'],
    ['Tous les bons moments', 'Découpe tout ce qui mérite un clip : un clip par idée, de 20 à 60 secondes, sous-titré, avec son titre.'],
    ['Un teaser', 'Fais un teaser de 30 secondes qui donne envie de voir la vidéo entière, avec les phrases les plus fortes.'],
    ...son, ...charte,
  ];
  if (P.medias.length && P.medias.every((m) => m.type === 'audio')) return [
    ['Un clip animé', 'Fais un clip animé sur ce son : des formes et des couleurs qui bougent avec le rythme, et les paroles qui s’affichent mot à mot.'],
    ['Un extrait de 30 s', 'Garde les 30 meilleures secondes et fais-en un extrait à partager, avec les paroles en gros.'],
    ...son, ...charte,
  ];
  const drive = ui.claude?.drive?.actif ? [['Suivre mon brief du Drive', 'Va chercher mon brief dans mon Google Drive, et monte la vidéo en suivant ce qui y est écrit.']] : [];
  if (!P.montage.length) return [
    ...drive,
    ['Une vidéo de 30 s', `Regarde tous mes rushes, garde les meilleurs moments et fais une vidéo de 30 secondes pour ${reseau}, qui accroche dès la première seconde.`],
    ['3 clips courts', 'Fais 3 clips différents de 20 secondes, chacun sur un moment fort, avec son propre titre.'],
    ['Une présentation', 'Fais une vidéo de présentation : les plus beaux plans, un titre animé au début, les mots clés à l’écran et un carton de fin.'],
    ...son, ...charte,
  ];
  return [
    ['Plus dynamique', `Rends mon montage plus dynamique pour ${reseau} : sous-titres mot à mot, zooms sur les moments forts, transitions sur les coupes, carton de fin.`],
    ['Motion design', 'Ajoute du motion design : un titre animé au début, les mots clés à l’écran, des flèches et des encadrés sur ce que je montre.'],
    ['3 clips courts', 'Tire 3 clips courts de mon montage, chacun sur un moment fort, avec son propre titre.'],
    ...son, ...charte,
  ];
}
const blocIdees = (suite) => `<div class="ia-idees">${ideesIA(suite).slice(0, 3).map(([titre, texte]) => `<button data-idee="${esc(texte)}" title="${esc(texte)}">${ic('etincelle', 'plein')}<span>${esc(titre)}</span></button>`).join('')}</div>`;
/** Le texte de Claude, avec juste ce qu'il faut de mise en forme (gras, listes). */
function mdLeger(t) {
  return esc(String(t ?? '').replace(/\n{3,}/g, '\n\n').trim())
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/^#{1,4} +(.+)$/gm, '<b>$1</b>')
    .replace(/^[-*] +/gm, '• ');
}

// ——— les pièces jointes : vignettes, puces, envoi ———
/** La vignette d'une pièce jointe : son aperçu s'il existe, sinon l'icône de son type. */
function vignettePiece(x, voir = false) {
  const titre = `${x.nom}${ui.claude?.roles?.[x.role] ? ` · ${ui.claude.roles[x.role]}` : ''}${x.taille_lisible ? ` · ${x.taille_lisible}` : ''}${x.introuvable ? ' · fichier introuvable' : ''}`;
  const fond = x.apercu && !x.introuvable ? ` style="background-image:url('${urlPiece(x.id)}')"` : '';
  return `<span class="pj-vig t-${x.type}${fond ? ' image' : ''}${x.introuvable ? ' perdue' : ''}"${voir ? ` data-cl="voir-piece" data-id="${x.id}"` : ''} title="${esc(titre)}"${fond}>${fond ? '' : ic(ICONES_PIECE[x.type] ?? 'trombone')}${x.type === 'video' && fond ? `<i>${ic('lire', 'plein')}</i>` : ''}</span>`;
}
const selectRole = (x) => `<select class="pj-role" data-role="${x.id}" title="Ce que c’est, pour l’IA">${Object.entries(ui.claude?.roles ?? {}).map(([k, n]) => option(k, n, k === x.role)).join('')}</select>`;
/** Une puce de pièce jointe, dans la zone d'écriture (elle partira avec le prochain message). */
function pucePiece(x) {
  const etat = x.erreur ? ` — ${x.erreur}` : x.en_preparation ? ' — Dérush la prépare pour ton IA…' : '';
  return `<div class="cl-pj${x.en_preparation ? ' prepare' : ''}${x.erreur || x.introuvable ? ' erreur' : ''}" title="${esc(x.nom + etat)}">${vignettePiece(x, true)}<span class="nom"><b>${esc(x.nom)}</b>${selectRole(x)}</span><button class="cl-pj-x" data-cl="retirer-piece" data-id="${x.id}" title="Retirer">${ic('fermer')}</button></div>`;
}
/** Une ligne de « Ce que l’IA a reçu ». */
function lignePiece(x) {
  const infos = [x.taille_lisible, x.infos?.duree ? dureeLisible(x.infos.duree) : null, x.extrait ? `${x.extrait.fichiers} fichiers` : null, x.introuvable ? 'fichier introuvable' : null].filter(Boolean).join(' · ');
  return `<div class="cl-recu">${vignettePiece(x, true)}<span class="nom"><b>${esc(x.nom)}</b><small>${esc(infos)}</small></span>${selectRole(x)}<button class="icone-btn" data-cl="retirer-piece" data-id="${x.id}" title="Ne plus donner ce fichier à l’IA">${ic('poubelle')}</button></div>`;
}
/** Un fichier envoyé par la fenêtre (copié-collé, ou introuvable sur le disque) : copié dans le projet. */
function televerserPiece(f) {
  return new Promise((ok) => {
    const x = new XMLHttpRequest();
    x.open('POST', `/api/claude/pieces/televerser?nom=${encodeURIComponent(f.name || 'piece')}`);
    x.setRequestHeader('x-derush-jeton', JETON);
    x.setRequestHeader('x-derush-fenetre', FENETRE);
    x.upload.onprogress = (ev) => etatSauvegarde(`Copie de ${f.name} : ${Math.round((ev.loaded / Math.max(1, ev.total)) * 100)} %`);
    x.onload = () => {
      etatSauvegarde('');
      const j = JSON.parse(x.responseText || '{}');
      if (x.status >= 400) { note(`${f.name} : ${j.erreur}`, true); return ok(null); }
      ok(j);
    };
    x.onerror = () => { etatSauvegarde(''); note(`${f.name} : copie impossible.`, true); ok(null); };
    x.send(f);
  });
}
const direPieces = (n) => note(`${n} fichier${n > 1 ? 's' : ''} joint${n > 1 ? 's' : ''} : ${n > 1 ? 'ils partiront' : 'il partira'} avec ton prochain message à Claude.`);
/** Des fichiers du Mac (fenêtre « Ouvrir ») : ils restent à leur place. */
async function joindreChemins(chemins) {
  if (!chemins.length) return;
  try {
    const r = await api('POST', '/api/claude/pieces', {chemins});
    for (const err of r.erreurs) note(err, true);
    if (r.ajoutees.length) direPieces(r.ajoutees.length);
  } catch (e) { note(e.message, true); }
  montrerClaude();
  await chargerClaude();
  $('#cl-texte')?.focus();
}
/** Des fichiers glissés ou collés : retrouvés sur le disque (ils restent à leur place), sinon copiés dans le projet. */
async function deposerPieces(fichiers) {
  if (!fichiers.length) return;
  const chemins = await localiser(fichiers);
  const trouves = chemins.filter(Boolean);
  let n = 0;
  if (trouves.length) {
    try {
      const r = await api('POST', '/api/claude/pieces', {chemins: trouves});
      n += r.ajoutees.length;
      for (const err of r.erreurs) note(err, true);
    } catch (e) { note(e.message, true); }
  }
  for (const [i, f] of fichiers.entries()) {
    if (chemins[i]) continue;
    const r = await televerserPiece(f);
    n += r?.ajoutees?.length ?? 0;
  }
  if (n) direPieces(n);
  montrerClaude();
  await chargerClaude();
  $('#cl-texte')?.focus();
}
/** Le trombone : la fenêtre « Ouvrir » du Mac (n'importe quel fichier), sinon celle du navigateur. */
async function joindreFichiers() {
  let r = null;
  try { r = await choisirSurOrdinateur('piece'); } catch { /* pas de fenêtre du Mac */ }
  if (r && !r.indisponible) return joindreChemins(r.chemins);
  const champ = $('#f-pieces');
  champ.value = '';
  champ.click();
}
$('#f-pieces').addEventListener('change', (e) => deposerPieces([...e.target.files]));
/** Regarder une pièce jointe : image, vidéo ou son en grand ; le reste, ses détails. */
function voirPiece(id) {
  const x = (ui.claude?.pieces ?? []).find((p) => p.id === id);
  if (!x) return;
  const url = urlPiece(x.id, 'fichier');
  const corps = x.introuvable ? `<p class="dim">Le fichier n’est plus à sa place sur ton ordinateur : l’IA ne le recevra pas.</p>`
    : x.type === 'image' ? `<img class="apercu-grand" src="${url}" alt="">`
      : x.type === 'video' ? `<video class="apercu-grand" src="${url}" controls autoplay playsinline></video>`
        : x.type === 'son' ? `<audio src="${url}" controls autoplay style="width:100%"></audio>`
          : x.apercu ? `<img class="apercu-grand" src="${urlPiece(x.id)}" alt="">` : '';
  const plus = x.extrait ? `<p class="dim" style="font-size:12px">${x.extrait.fichiers} fichiers dans l’archive : ${esc(x.extrait.apercu_liste.slice(0, 12).join(', '))}${x.extrait.fichiers > 12 ? '…' : ''}</p>` : '';
  const f = feuille(`<h3>${esc(x.nom)}</h3><p class="sous-titre">${esc([ui.claude?.roles?.[x.role], x.taille_lisible, x.infos?.duree ? dureeLisible(x.infos.duree) : null, x.message != null ? 'Déjà donné à Claude' : 'Partira avec ton prochain message'].filter(Boolean).join(' · '))}</p>${corps}${plus}${x.erreur ? `<p class="cl-erreur-pj">${ic('attention')}${esc(x.erreur)}</p>` : ''}<div class="pied"><button class="btn" data-retirer>${ic('poubelle')}Retirer</button><span class="espace"></span><button class="btn principal" data-fermer>OK</button></div>`, true);
  f.addEventListener('click', async (e) => {
    if (e.target.closest('[data-fermer]')) return fermerFeuille();
    if (e.target.closest('[data-retirer]')) {
      try { await api('DELETE', `/api/claude/pieces/${x.id}`); } catch (err) { note(err.message, true); }
      fermerFeuille();
      chargerClaude();
    }
  });
}

// ——— la conversation ———
/** La petite bande d'images d'une vidéo livrée (survolée, elle défile). */
function vignetteVideo(x, H) {
  const s = x.vignettes;
  if (!s) return `<span class="vig vide" style="height:${H}px;width:${Math.round((H * 9) / 16)}px">${ic('film')}</span>`;
  const w = Math.round((H * s.l) / s.h);
  const k = Math.floor(s.n / 3);
  return `<span class="vig" data-n="${s.n}" data-w="${w}" style="width:${w}px;height:${H}px;background-image:url('${urlVideo(x.nom.replace(/\.mp4$/, '.vignettes.jpg'))}');background-size:${s.n * w}px ${H}px;background-position:-${k * w}px 0"><i>${ic('lire', 'plein')}</i></span>`;
}
/** Ce que l'IA a publié : un réseau par ligne, son état, son lien, et la légende à copier. */
/** Les crédits des sons d'une vidéo (licence CC BY) : une ligne, et un bouton pour les copier dans la description. */
function creditsHtml(c) {
  return `<div class="ia-pubs"><div class="ia-pub">${logo('sons', 20)}<span><b>Crédits des sons</b><small>${c.nombre} son${c.nombre > 1 ? 's' : ''} à citer dans ta description</small></span><button class="icone-btn" data-cl="copier" data-texte="${esc(c.texte)}" title="Copier les crédits">${ic('copier')}</button></div></div>`;
}
function publicationsHtml(pubs) {
  return `<div class="ia-pubs">${pubs.map((p) => {
    const texte = [p.titre, p.legende, (p.hashtags ?? []).join(' ')].filter(Boolean).join('\n\n');
    return `<div class="ia-pub e-${esc(p.etat)}">${logo(p.reseau, 20)}<span><b>${esc(RESEAUX_UI[p.reseau] ?? p.reseau)}</b><small>${esc(ETATS_PUB[p.etat] ?? p.etat)}${p.message ? ` · ${esc(p.message)}` : ''}</small></span>${p.lien ? `<button class="icone-btn" data-cl="lien-pub" data-lien="${esc(p.lien)}" title="Ouvrir la publication">${ic('lien')}</button>` : ''}${texte ? `<button class="icone-btn" data-cl="copier" data-texte="${esc(texte)}" title="Copier le titre, la légende et les hashtags">${ic('copier')}</button>` : ''}</div>`;
  }).join('')}</div>`;
}
function carteVideo(v, k) {
  const x = v.videos[k];
  const seule = v.videos.length === 1;
  const soucis = (x.controles ?? []).filter((y) => !y.ok).length;
  const active = ui.vue === 'claude' && ui.versionVue === v.n && (ui.videoVue ?? 0) === k;
  const detail = (x.controles ?? []).map((y) => `${y.ok ? '✓' : '⚠'} ${y.t}`).join('\n');
  const titre = x.titre ?? (seule ? `Version ${v.n}` : `Vidéo ${k + 1}`);
  const infos = [x.duree ? dureeLisible(x.duree) : null, x.largeur ? ratioDe(x.largeur, x.hauteur) : null].filter(Boolean).join(' · ');
  const menu = ui.clMenuVideo === x.nom ? `<div class="ia-menu bas" role="menu">
    <button data-cl="publier" data-nom="${esc(x.nom)}" role="menuitem">${ic('publier')}<span>Publier tout de suite, sans plan</span></button>
    <button data-cl="aux-medias" data-nom="${esc(x.nom)}" role="menuitem">${ic('importer')}<span>Mettre dans mes médias</span></button>
    ${ui.claude?.drive?.synchronise ? `<button data-cl="vers-drive" data-nom="${esc(x.nom)}" role="menuitem">${ic('nuage')}<span>Envoyer sur mon Google Drive</span></button>` : ''}
    <button data-cl="finder" data-nom="${esc(x.nom)}" role="menuitem">${ic('dossier')}<span>Afficher dans le dossier</span></button></div>` : '';
  return `<div class="cl-video-bloc"><div class="cl-video${active ? ' active' : ''}${seule ? ' seule' : ''}" data-version="${v.n}" data-video="${k}" title="${esc(detail)}">${vignetteVideo(x, seule ? 64 : 76)}<div class="txt"><b>${esc(titre)}</b><small>${esc(infos)}</small><small class="${soucis ? 'attention' : 'ok'}">${soucis ? `${soucis} point${soucis > 1 ? 's' : ''} à voir` : 'Contrôles OK'}</small></div>
    <div class="act"><button class="icone-btn" data-cl="menu-video" data-nom="${esc(x.nom)}" title="Plus">${ic('points')}</button>${menu}</div></div>
    <div class="cl-avant-pub"><button class="btn petit" data-cl="analyser" data-nom="${esc(x.nom)}" title="Avant de publier : ton IA note l’accroche, le rythme, le son… et te dit quoi améliorer">${ic('eclair')}<span>Analyser</span></button><button class="btn petit publier" data-cl="partager" data-nom="${esc(x.nom)}" title="Légendes, hashtags, bon moment et publication sur TikTok, Instagram, YouTube, LinkedIn">${ic('publier')}<span>Partager</span></button></div>
    ${(x.publications ?? []).length ? publicationsHtml(x.publications) : ''}</div>`;
}
const cartesVideos = (v) => (v.videos.length > 1
  ? `<div class="cl-lot"><span>${v.videos.length} vidéos · version ${v.n}</span><div class="cl-videos">${v.videos.map((_, k) => carteVideo(v, k)).join('')}</div></div>`
  : carteVideo(v, 0));
function bulleHumain(x, c) {
  const pj = (x.pieces ?? []).map((id) => c.pieces.find((p) => p.id === id)).filter(Boolean);
  return `<div class="cl-b humain">${pj.length ? `<div class="cl-b-pj">${pj.map((p) => vignettePiece(p, true)).join('')}</div>` : ''}${x.texte ? `<div>${esc(x.texte)}</div>` : ''}</div>`;
}
function bulleClaude(x, c) {
  if (x.role === 'humain') return bulleHumain(x, c);
  const v = x.version ? c.versions.find((y) => y.n === x.version) : null;
  const long = x.texte.length > 520;
  const m = x.moteur ?? 'claude';
  return `<div class="cl-b claude${x.erreur ? ' erreur' : ''}${x.arret ? ' arret' : ''}"><div class="qui">${logo(m, 16)}<span>${nomIA(m)}</span>${x.duree_s ? `<small>${esc(dureeLisible(x.duree_s))}</small>` : ''}</div><div class="cl-texte-b${long ? ' coupe' : ''}">${mdLeger(x.texte)}</div>${long ? '<button class="cl-lien" data-cl="deplier">Tout lire</button>' : ''}${v ? cartesVideos(v) : ''}${x.publications?.length && !v ? publicationsHtml(x.publications) : ''}${x.credits_sons?.texte ? creditsHtml(x.credits_sons) : ''}</div>`;
}
/** La bulle de l'IA au travail : la bobine tourne, une ligne dit ce qu'elle fait, son rendu passe en petit ; le détail se déplie. */
function bulleTravail(c) {
  const e = c.en_cours;
  return `<div class="cl-b claude travail" id="cl-travail"><div class="cl-travail-tete">${ill('bobine')}<div><b id="cl-etape"></b><small><span id="cl-temps"></span> · ${esc(nomIA(e.moteur))}${e.publier ? ' · publication' : ''}</small></div></div>
    <div class="cl-barre"><i id="cl-jauge"></i></div>
    <button class="cl-mini cache" id="cl-mini" data-cl="voir-direct" title="Voir en grand dans le lecteur"><img alt=""><span></span></button>
    <details class="ia-detail"${ui.clDetail ? ' open' : ''}><summary>Voir le détail</summary><ul class="cl-activite" id="cl-activite"></ul></details></div>`;
}
/** Ce que l'IA est en train de faire, dit simplement. */
function etapeClaude(a, qui = 'L’IA') {
  if (!a) return `${qui} ouvre ton dossier`;
  const t = a.texte.toLowerCase();
  if (a.icone === 'globe') return `${qui} publie ta vidéo`;
  if (a.icone === 'cube') return `${qui} travaille en 3D`;
  if (a.icone === 'onde') return `${qui} crée le son avec ElevenLabs`;
  if (a.icone === 'film' && /rend/.test(t)) return `${qui} fabrique la vidéo`;
  if (a.icone === 'crayon') return `${qui} écrit le montage`;
  if (a.icone === 'loupe') return `${qui} se renseigne`;
  if (a.icone === 'nuage') return `${qui} regarde ton Drive`;
  if (a.icone === 'oeil' || /vérif|contrôl|mesur|regard|compar/.test(t)) return `${qui} regarde et vérifie`;
  if (/compétence/.test(t)) return `${qui} relit ses fiches de montage`;
  if (a.icone === 'bulle') return `${qui} réfléchit`;
  return `${qui} monte ta vidéo`;
}
/** Met à jour la bulle de travail sans tout redessiner (l'humain peut lire ou écrire pendant ce temps). */
function majTravail(c) {
  const e = c?.en_cours;
  if (!e || !$('#cl-travail')) return;
  ui.clDebut = Date.now() - e.depuis_s * 1000;
  $('#cl-temps').textContent = minSec(e.depuis_s);
  const r = dernierRendu(c);
  const enRendu = renduActif(r);
  const pct = r?.total ? Math.min(100, Math.round((100 * (r.rendues ?? 0)) / r.total)) : 0;
  const qui = nomIA(e.moteur);
  $('#cl-etape').textContent = e.arret ? 'Arrêt en cours…'
    : e.etape === 'preparation' ? (P.montage.length ? 'Dérush prépare tes plans' : 'Dérush prépare tes rushes')
      : e.etape === 'livraison' ? 'Dérush récupère tes vidéos'
        : enRendu ? (r.etape === 'assemblage' ? `${qui} prépare le rendu de « ${r.titre} »` : r.etape === 'son' ? `${qui} mixe le son de « ${r.titre} »` : `${qui} rend « ${r.titre} » · ${pct} %`)
          : etapeClaude(e.activite.at(-1), qui);
  const jauge = $('#cl-jauge');
  const mesure = e.etape === 'preparation' || (enRendu && r.etape === 'rendu');
  jauge.style.width = e.etape === 'preparation' ? `${Math.max(4, Math.round(e.progression * 100))}%` : enRendu && r.etape === 'rendu' ? `${Math.max(3, pct)}%` : '100%';
  jauge.classList.toggle('libre', !mesure);
  // le direct en petit : la dernière image rendue, ou l'image que Claude regarde
  const mini = $('#cl-mini');
  const vue = e.direct?.vues?.at(-1);
  const recentVue = vue && (!r || !enRendu) && (!r?.fin || vue.t * 1000 + ui.clDebut > Date.parse(r.fin));
  const src = r?.images.length && !recentVue ? urlDirect(r, r.images.at(-1)) : vue ? urlVue(vue.n) : null;
  mini.classList.toggle('cache', !src);
  if (src) {
    const img = $('img', mini);
    if (img.dataset.src !== src) { const pre = new Image(); pre.onload = () => { img.src = src; }; pre.src = src; img.dataset.src = src; }
    $('span', mini).innerHTML = r?.images.length && !recentVue ? `<i class="point-direct"></i>${enRendu ? 'En direct' : 'Dernier rendu'} · ${esc(r.titre ?? '')}` : `${ic('oeil')}${qui} regarde « ${esc(vue.nom)} »`;
  }
  const total = e.n_activite ?? e.activite.length;
  const nouveaux = Math.min(e.activite.length, Math.max(0, total - (ui.clTotal ?? 0)));
  ui.clTotal = total;
  const ul = $('#cl-activite');
  for (const a of nouveaux ? e.activite.slice(-nouveaux) : []) {
    const li = document.createElement('li');
    if (a.icone === 'bulle') li.className = 'parole';
    li.innerHTML = `${ic(a.icone)}<span>${esc(a.texte)}</span>`;
    ul.append(li);
  }
  while (ul.children.length > 30) ul.firstElementChild.remove();
  const haut = $('#cl-haut');
  if (nouveaux && haut && haut.scrollHeight - haut.scrollTop - haut.clientHeight < 140) haut.scrollTop = haut.scrollHeight;
}
setInterval(() => { const el = $('#cl-temps'); if (el && ui.claude?.en_cours && ui.clDebut) el.textContent = minSec((Date.now() - ui.clDebut) / 1000); }, 1000);

const hauteurTexte = (ta) => { ta.style.height = 'auto'; ta.style.height = `${Math.min(220, Math.max(64, ta.scrollHeight))}px`; };
const majEnvoi = () => { const b = $('#cl-envoyer'); if (b) b.disabled = !(ui.brouillon.trim() || piecesEnAttente().length || ui.reglagesIA.length) || !iaPrete() || !!ui.claude?.en_cours; };
$('#claude').addEventListener('click', (e) => {
  const i = e.target.closest('[data-reglage-i]')?.dataset.reglageI;
  if (i == null) return;
  ui.reglagesIA.splice(Number(i), 1);
  rendreBlocsIA();
  rendreClaude();
});

const elementMenu = (act, icone, txt) => `<button data-cl="${act}" role="menuitem">${ic(icone)}<span>${txt}</span></button>`;
/** Le menu « … » de la colonne : tout ce qui n'est pas la conversation. */
const menuIA = (c, suite) => `<div class="ia-menu" role="menu">
  ${elementMenu('connexions', 'prise', 'Connexions')}
  ${elementMenu('profil', 'profil', 'Mon profil de créateur')}
  ${elementMenu('brief', 'texte', 'Brief et format')}
  ${elementMenu('studio', 'onde', 'Créer avec ElevenLabs')}
  ${elementMenu('creer', 'rendu', 'Créer la vidéo sans IA')}
  ${elementMenu('pack', 'dossier', 'Pack pour une autre IA')}
  ${c.atelier_chemin ? elementMenu('atelier', 'finder', 'Dossier de travail de l’IA') : ''}
  ${suite ? elementMenu('oublier', 'poubelle', 'Effacer la conversation') : ''}
</div>`;

/** La colonne de l'IA : une conversation simple. En haut l'IA choisie, au milieu les messages et les vidéos, en bas la zone d'écriture. */
function rendreClaude() {
  const box = $('#claude');
  if (!P || box.classList.contains('cache')) return;
  const c = ui.claude;
  if (!c) {
    if (box.dataset.cle !== 'attente') { box.dataset.cle = 'attente'; box.innerHTML = `<div class="cl-haut" id="cl-haut"><div class="ia-accueil">${ill('claude')}<h2>Un instant…</h2></div></div>`; }
    return;
  }
  const m = moteurIA();
  const pret = iaPrete(m);
  const suite = c.echanges.length > 0;
  const peutSuivre = suite && !!c.session;
  const depart = !peutSuivre ? 'nouveau' : (ui.depart ?? (c.montage_change ? 'nouveau' : 'suite'));
  const attente = piecesEnAttente();
  const envoyees = piecesEnvoyees();
  const cle = JSON.stringify([modeProjet(), ui.reglagesIA.map((r) => r.texte), m, pret, qualiteIA(), c.echanges.length, c.echanges.at(-1)?.quand ?? '', c.versions.map((v) => [v.n, v.videos.map((x) => (x.publications ?? []).length)]), depart, c.montage_change, c.decoupe_ia, ui.vue, ui.versionVue, ui.videoVue, c.atelier ?? '', !!c.en_cours, c.pieces.map((x) => [x.id, x.role, x.message, x.en_preparation, !!x.erreur, x.apercu, x.introuvable]), P.medias.length, ui.clRecus, ui.clMenu, ui.clMenuVideo, c.drive?.synchronise, c.elevenlabs]);
  if (box.dataset.cle === cle) return majTravail(c);
  const ancien = $('#cl-texte', box);
  const focus = !!ancien && document.activeElement === ancien;
  const curseur = ancien ? [ancien.selectionStart, ancien.selectionEnd] : [0, 0];
  const ancienHaut = $('#cl-haut', box);
  const defile = ancienHaut?.scrollTop ?? 0;
  const enBas = !ancienHaut || ancienHaut.scrollHeight - ancienHaut.scrollTop - ancienHaut.clientHeight < 60;
  const etapeFil = `${c.atelier}/${c.echanges.length}/${!!c.en_cours}`;
  const nouvelEchange = ui.clEchanges !== etapeFil;
  ui.clEchanges = etapeFil;
  box.dataset.cle = cle;
  ui.clTotal = 0;

  // en haut : l'IA choisie (un clic pour changer), ce qu'elle a reçu, et le menu
  const tete = `<div class="ia-tete">
    <button class="ia-choix" data-cl="choisir-ia" title="Choisir l’IA et la qualité">${logo(m, 26)}<span><b>${nomIA(m)}</b><small>${pret ? esc(c.qualites?.[qualiteIA()]?.nom ?? '') : 'à brancher'}</small></span>${ic('img-plus', 'chevron')}</button>
    <span class="espace"></span>
    ${envoyees.length ? `<button class="ia-recus${ui.clRecus ? ' actif' : ''}" data-cl="recus" title="Les fichiers que l’IA a reçus">${ic('trombone')}<span>${envoyees.length}</span></button>` : ''}
    <button class="icone-btn${ui.clMenu ? ' actif' : ''}" data-cl="menu" title="Plus : connexions, brief, créer sans IA…">${ic('points')}</button>
    ${ui.clMenu ? menuIA(c, suite) : ''}</div>`;
  const recus = ui.clRecus && envoyees.length ? `<div class="ia-recus-liste">${envoyees.map(lignePiece).join('')}<small>L’IA les retrouve à chaque message, avec tes créations ElevenLabs.</small></div>` : '';
  const brancher = pret ? '' : `<div class="ia-brancher"><div class="logos">${logo('claude', 38)}${logo('codex', 38)}${logo('gemini', 38)}</div><b>Branche ton IA</b><p>Claude (avec ton compte Claude), Codex (avec ton compte ChatGPT) ou Gemini (avec ton compte Google). Un clic pour l’installer, un pour te connecter.</p><button class="btn principal" data-cl="connexions">${ic('prise')}Connexions</button></div>`;
  const modeP = modeProjet();
  const matiere = {extraits: 'Dépose ta longue vidéo ou ton podcast, en entier : ton IA en tirera les meilleurs moments.', son: 'Dépose ta musique, ta voix ou ton podcast : ton IA crée les images qui vont avec.'}[modeP]
    ?? 'Dépose tes vidéos, tes sons ou tes photos sur la fenêtre, ou joins-les à ton message avec le trombone.';
  const accueil = suite || c.en_cours ? '' : modeP === 'motion' && !P.medias.length
    ? `<div class="ia-accueil">${ill('motion')}<h2>Décris ton animation</h2><p>Pas besoin de vidéo : le sujet, les mots à afficher, la durée, le style. Joins ton logo ou ta charte si tu en as.</p>${pret ? blocIdees(false) : ''}</div>`
    : !P.medias.length && !c.pieces.length
    ? `<div class="ia-accueil">${ill(DESSINS_MODE[modeP] === 'claude' ? 'rushes' : DESSINS_MODE[modeP])}<h2>D’abord, ta matière</h2><p>${matiere}</p><button class="btn principal" data-a="importer">${ic('plus')}Importer</button></div>`
    : `<div class="ia-accueil">${ill('claude')}<h2>Qu’est-ce qu’on monte&nbsp;?</h2><p>Écris ce que tu veux. Joins tes références, ta charte ou ton logo si tu en as.</p>${pret ? blocIdees(false) : ''}</div>`;
  const fil = suite || c.en_cours ? `<div class="cl-fil">${c.echanges.map((x) => bulleClaude(x, c)).join('')}${c.en_cours ? bulleTravail(c) : ''}</div>` : '';
  const reprendre = suite && c.decoupe_ia && !c.en_cours
    ? `<button class="ia-reprendre" data-cl="decoupe">${ic('ciseaux')}<span><b>Mettre sa découpe dans ma timeline</b><small>${c.decoupe_ia} passages choisis par l’IA, à retoucher si tu veux.</small></span></button>` : '';
  const dansLeFil = new Set(c.echanges.map((x) => x.version).filter(Boolean));
  const anciennes = c.versions.filter((v) => !dansLeFil.has(v.n));
  const bande = anciennes.length ? `<div class="cl-anciennes"><span>${suite ? 'Versions d’avant' : 'Vidéos déjà faites'}</span>${anciennes.map((v) => `<button data-version="${v.n}"${ui.vue === 'claude' && ui.versionVue === v.n ? ' class="actif"' : ''} title="Regarder la version ${v.n}">${ic('lire', 'plein')}v${v.n}${v.videos.length > 1 ? ` · ${v.videos.length}` : ''}</button>`).join('')}</div>` : '';
  const relances = suite && pret && !c.en_cours && c.echanges.at(-1)?.role === 'claude' && !c.echanges.at(-1)?.erreur ? blocIdees(true) : '';
  // en bas : le montage a changé depuis ? (sinon, rien à choisir) puis la zone d'écriture
  const changement = peutSuivre && !c.en_cours && c.montage_change ? `<div class="ia-change">${ic('attention')}<span>Tu as modifié ton montage.</span><div class="segmente"><button data-depart="nouveau"${depart === 'nouveau' ? ' class="actif"' : ''} title="L’IA repart de ton montage tel qu’il est maintenant, en gardant tes demandes">Repartir de lui</button><button data-depart="suite"${depart === 'suite' ? ' class="actif"' : ''} title="L’IA continue son propre travail">Continuer</button></div></div>` : '';
  const qui = nomIA(m);
  const texteVide = !pret ? 'Branche d’abord ton IA (Connexions)…' : c.en_cours ? `${nomIA(c.en_cours.moteur ?? m)} travaille. Tu peux préparer ton prochain message…`
    : attente.length ? `Dis à ${qui} quoi en faire, ou envoie tel quel…`
      : suite ? 'Une retouche, une question, une autre vidéo, « publie-la »…'
        : modeP === 'motion' ? 'Exemple : une animation de 20 secondes qui présente notre atelier du samedi, avec nos couleurs…' : 'Exemple : fais 3 clips de 20 secondes pour TikTok, dans le style de ma référence…';
  const compose = `<div class="cl-compose${attente.length ? ' avec-pj' : ''}" id="cl-compose">
    ${ui.reglagesIA.length ? `<div class="cl-reglages"><small>${ic('reglages')}${ui.reglagesIA.length} réglage${ui.reglagesIA.length > 1 ? 's' : ''} sur la table de montage, envoyé${ui.reglagesIA.length > 1 ? 's' : ''} avec ton message</small>${ui.reglagesIA.map((r, i) => `<span class="bloc-regle" title="${esc(r.texte)}"><b>${esc(r.nom)}</b> ${esc(r.texte)}<button data-reglage-i="${i}" title="Retirer ce réglage">${ic('fermer')}</button></span>`).join('')}</div>` : ''}
    ${attente.length ? `<div class="cl-pjs">${attente.map(pucePiece).join('')}</div>` : ''}
    <textarea id="cl-texte" rows="2" spellcheck="true" placeholder="${esc(texteVide)}"${pret ? '' : ' disabled'}></textarea>
    <div class="cl-envoi"><button class="cl-joindre" data-cl="joindre" title="Joindre des fichiers : références, vidéos, charte graphique, logo, polices, zip… Tu peux aussi les glisser ou les coller ici.">${ic('trombone')}</button>${c.drive?.synchronise ? `<button class="cl-joindre" data-cl="joindre-drive" title="Joindre depuis ton Google Drive">${logo('drive', 16)}</button>` : ''}
    <span class="espace"></span>${c.en_cours ? `<button data-cl="arreter" class="stop" title="Arrêter ${qui}">${ic('stop', 'plein')}</button>` : `<button data-cl="envoyer" id="cl-envoyer" title="Envoyer à ${qui} (⌘↵)">${ic('envoi')}</button>`}</div>
    <div class="cl-depot-ici">${ic('trombone')}<span>Lâche ici : ${qui} le recevra avec ton message</span></div></div>`;
  box.innerHTML = `${tete}<div class="cl-haut" id="cl-haut">${recus}${brancher}${accueil}${fil}${reprendre}${bande}${relances}</div>
    <div class="cl-pied">${changement}${compose}</div>`;
  const haut = $('#cl-haut', box);
  const ta = $('#cl-texte', box);
  ta.value = ui.brouillon;
  hauteurTexte(ta);
  if (focus) { ta.focus(); ta.setSelectionRange(...curseur); }
  majEnvoi();
  if (c.en_cours) majTravail(c);
  // une réponse arrive : on montre ton message puis la réponse ; l'IA au travail : on suit le bas ; l'accueil se lit par le haut
  const derniere = $$('.cl-b.humain', box).at(-1);
  if (nouvelEchange && suite && !c.en_cours && derniere) haut.scrollTop = derniere.offsetTop - 8;
  else if ((suite || c.en_cours) && (nouvelEchange || enBas)) haut.scrollTop = haut.scrollHeight;
  else haut.scrollTop = defile;
}

async function envoyerDemande() {
  const c = ui.claude;
  const texte = ui.brouillon.trim();
  const pj = piecesEnAttente();
  if (!c || c.en_cours) return;
  if (!iaPrete()) return feuilleConnexions();
  const reglages = texteReglages();
  if (!texte && !pj.length && !reglages) return $('#cl-texte')?.focus();
  const peutSuivre = c.echanges.length > 0 && !!c.session;
  const depart = !peutSuivre ? 'nouveau' : (ui.depart ?? (c.montage_change ? 'nouveau' : 'suite'));
  const b = $('#cl-envoyer');
  if (b) b.disabled = true;
  try {
    await sauver(true);
    const message = [texte || (reglages ? 'Applique ces réglages sur ta vidéo, sans rien changer d’autre.' : ''), reglages].filter(Boolean).join('\n\n');
    await api('POST', '/api/claude/demander', {message, pieces: pj.map((x) => x.id), moteur: moteurIA(), qualite: qualiteIA(), nouveau: depart === 'nouveau'});
    ui.brouillon = '';
    ui.reglagesIA = [];
    ui.depart = null;
    await chargerClaude();
  } catch (err) { note(err.message, true); majEnvoi(); }
}
/** Ouvre la colonne de Claude (en retirant la sélection), prête à écrire. */
function montrerClaude(ecrire = false) {
  if (ui.sel || ui.multi.size) selectionner(null); else rendreInspecteur();
  if (ecrire) setTimeout(() => $('#cl-texte')?.focus(), 40);
}
$('#claude').addEventListener('input', (e) => {
  if (e.target.id !== 'cl-texte') return;
  ui.brouillon = e.target.value;
  hauteurTexte(e.target);
  majEnvoi();
});
$('#claude').addEventListener('keydown', (e) => {
  if (e.target.id === 'cl-texte' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); envoyerDemande(); }
});
// un fichier collé dans la conversation (capture d'écran, image copiée…) devient une pièce jointe
$('#claude').addEventListener('paste', (e) => {
  const fichiers = [...(e.clipboardData?.files ?? [])];
  if (!fichiers.length) return;
  e.preventDefault();
  deposerPieces(fichiers);
});
$('#claude').addEventListener('change', async (e) => {
  const id = e.target.dataset?.role;
  if (id) {
    try { await api('PUT', `/api/claude/pieces/${id}`, {role: e.target.value}); } catch (err) { note(err.message, true); }
    chargerClaude();
  }
});
$('#claude').addEventListener('toggle', (e) => {
  if (e.target.classList?.contains('ia-detail')) {
    ui.clDetail = e.target.open;
    // à l'ouverture, on montre tout ce qui s'est passé depuis le début
    if (e.target.open) { ui.clTotal = 0; $('#cl-activite').innerHTML = ''; majTravail(ui.claude); }
  }
}, true);
// un clic ailleurs ferme les petits menus
document.addEventListener('pointerdown', (e) => {
  if ((ui.clMenu || ui.clMenuVideo) && !e.target.closest('.ia-menu, [data-cl="menu"], [data-cl="menu-video"]')) { ui.clMenu = false; ui.clMenuVideo = null; rendreClaude(); }
});
// survoler la bande d'une vidéo la fait défiler
$('#claude').addEventListener('mousemove', (e) => {
  const v = e.target.closest('.vig[data-n]');
  if (!v) return;
  const r = v.getBoundingClientRect();
  const n = Number(v.dataset.n);
  const k = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n)));
  v.style.backgroundPosition = `-${k * Number(v.dataset.w)}px 0`;
});
$('#claude').addEventListener('click', async (e) => {
  const c = ui.claude;
  if (!c) return;
  if (e.target.closest('select')) return;
  const idee = e.target.closest('[data-idee]');
  if (idee) {
    const ta = $('#cl-texte');
    ui.brouillon = idee.dataset.idee;
    ta.value = ui.brouillon;
    hauteurTexte(ta);
    majEnvoi();
    return ta.focus();
  }
  const depart = e.target.closest('[data-depart]')?.dataset.depart;
  if (depart) { ui.depart = depart; return rendreClaude(); }
  const act = e.target.closest('[data-cl]')?.dataset.cl;
  const carte = e.target.closest('[data-version]');
  // les menus se referment dès qu'on choisit quelque chose
  if (act !== 'menu' && act !== 'menu-video' && (ui.clMenu || ui.clMenuVideo)) { ui.clMenu = false; ui.clMenuVideo = null; rendreClaude(); }
  try {
    if (act === 'menu') { ui.clMenu = !ui.clMenu; ui.clMenuVideo = null; return rendreClaude(); }
    if (act === 'menu-video') { const nom = e.target.closest('[data-nom]').dataset.nom; ui.clMenuVideo = ui.clMenuVideo === nom ? null : nom; ui.clMenu = false; return rendreClaude(); }
    if (act === 'recus') { ui.clRecus = !ui.clRecus; return rendreClaude(); }
    if (act === 'choisir-ia') return feuilleChoixIA();
    if (act === 'connexions') return feuilleConnexions();
    if (act === 'profil') return CR.ouvrir();
    if (act === 'publier') return feuillePublier(e.target.closest('[data-nom]').dataset.nom);
    if (act === 'analyser') return PUB.ouvrir(e.target.closest('[data-nom]').dataset.nom, 'analyse');
    if (act === 'partager') return PUB.ouvrir(e.target.closest('[data-nom]').dataset.nom, 'partage');
    if (act === 'lien-pub') { const l = e.target.closest('[data-lien]').dataset.lien; if (/^https:\/\//.test(l)) window.open(l, '_blank', 'noopener'); return; }
    if (act === 'copier') { await copierTexte(e.target.closest('[data-texte]').dataset.texte); return note('Copié : colle-le dans l’app du réseau.'); }
    if (act === 'finder') return await api('POST', '/api/ouvrir', {chemin: c.versions.flatMap((v) => v.videos).find((x) => x.nom === e.target.closest('[data-nom]').dataset.nom)?.chemin});
    if (act === 'aux-medias') {
      await api('POST', '/api/claude/videos/medias', {nom: e.target.closest('[data-nom]').dataset.nom});
      await rafraichirMedias();
      choisirPanneau('medias');
      return note('La vidéo de l’IA est dans tes médias : glisse-la sur la timeline pour la retoucher.');
    }
    if (carte && !act) return montrerVue('claude', Number(carte.dataset.version), carte.dataset.video != null ? Number(carte.dataset.video) : 0, true);
    if (act === 'envoyer') return envoyerDemande();
    if (act === 'joindre') return joindreFichiers();
    if (act === 'joindre-drive') {
      const r = await choisirSurOrdinateur('drive');
      return r.indisponible ? note('La fenêtre « Ouvrir » de l’ordinateur n’a pas pu s’ouvrir.', true) : joindreChemins(r.chemins);
    }
    if (act === 'vers-drive') {
      const r = await api('POST', '/api/drive/envoyer', {video: e.target.closest('[data-nom]').dataset.nom});
      return note(`Copiée dans ton Google Drive : ${r.dossier}. Elle y sera en ligne dans un instant.`, false, true);
    }
    if (act === 'voir-piece') return voirPiece(e.target.closest('[data-id]').dataset.id);
    if (act === 'retirer-piece') { await api('DELETE', `/api/claude/pieces/${e.target.closest('[data-id]').dataset.id}`); return chargerClaude(); }
    if (act === 'voir-direct') return montrerVue('direct');
    if (act === 'arreter') { await api('POST', '/api/claude/arreter'); note(`Arrêt demandé : ${nomIA(c.en_cours?.moteur)} termine son geste en cours.`); return chargerClaude(); }
    if (act === 'deplier') { const t = e.target.previousElementSibling; e.target.textContent = t.classList.toggle('coupe') ? 'Tout lire' : 'Réduire'; return; }
    if (act === 'studio') return choisirPanneau('creer');
    if (act === 'creer') return feuilleCreer();
    if (act === 'pack') return feuilleEnvoyer();
    if (act === 'brief') return feuilleBrief();
    if (act === 'atelier') return await api('POST', '/api/ouvrir', {chemin: c.atelier_chemin});
    if (act === 'reessayer') return chargerClaude(true);
    if (act === 'decoupe') {
      const {plans} = await api('GET', '/api/claude/decoupe');
      const bons = plans.filter((p) => media(p.media));
      if (!bons.length) return note('L’IA n’a pas laissé de découpe à reprendre.', true);
      if (P.montage.length && !confirm('Remplacer ton montage par la découpe de l’IA ? Tu pourras revenir en arrière avec ⌘Z.')) return;
      modifier(() => {
        P.montage = bons.map((p) => {
          const f = fpsSrc(media(p.media));
          return {id: nouvelId(P, 'P'), type: 'plan', media: p.media, entree: surGrille(p.entree, f), sortie: surGrille(p.sortie, f), titre: p.titre, notes: '', tags: [], son: {actif: true, gain_db: 0, version: 'original', avant_s: 0, apres_s: 0}};
        });
        ui.sel = null;
      });
      toutVoir();
      await sauver(true);
      await api('POST', '/api/claude/synchroniser');
      await chargerClaude();
      return note(`La découpe de l’IA est dans ta timeline : ${bons.length} passages. ⌘Z pour revenir en arrière.`);
    }
    if (act === 'oublier') {
      if (!confirm('Effacer la conversation avec l’IA ? Les vidéos et les fichiers joints restent dans le projet.')) return;
      await api('POST', '/api/claude/oublier');
      ui.depart = null;
      return chargerClaude();
    }
  } catch (err) { note(err.message, true); }
});

// =====================================================================
// Connexions : l'IA (Claude ou Codex), ElevenLabs, Google Drive, Treg, Blender, les compétences, les mises à jour
// =====================================================================
let minuterieConnexions = null;
const etatCarte = (ok, attente = false) => (ok ? 'ok' : attente ? 'attente' : 'manque');
const carteCx = ({etat, lg, titre, sous, actions = '', plus = ''}) => `<div class="cx-carte ${etat}">${lg}<div class="cx-txt"><b>${titre}<i class="cx-point"></i></b><small>${sous}</small>${plus}</div><div class="cx-act">${actions}</div></div>`;
const enCours = (a) => a?.etat === 'en_cours';
const erreurAction = (a) => (a?.etat === 'erreur' ? `<small class="attention">${esc(a.message)}</small>` : '');
/** Une IA : installée et connectée ? Sinon, un bouton pour l'une ou l'autre étape. */
function carteIA(d, m) {
  const x = d[m] ?? {};
  const choisi = d.choisi === m;
  const occupe = enCours(x.action);
  const actions = x.ok
    ? (choisi ? `<span class="etiq ok">${ic('coche')}Choisie</span>` : `<button class="btn petit" data-cx="ia/choisir" data-moteur="${m}">Choisir</button>`)
    : occupe ? `<span class="etiq">${anneau(0.5)}Installation…</span>`
      : x.installable ? `<button class="btn bleu petit" data-cx="${m}/installer">Installer</button>`
        : x.connectable ? `<button class="btn bleu petit" data-cx="${m}/connecter">Me connecter</button>` : '';
  // Gemini : les modèles que ce compte Google propose (ils changent d'un compte à l'autre)
  const familles = m === 'gemini' && x.ok ? [...new Set((x.modeles ?? []).map((s) => String(s).replace(/-(low|medium|high|max)$/, '').split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')))].join(', ') : '';
  const sous = x.ok ? `${esc(x.nom ?? '')} · ${COMPTES_IA[m].relie}${familles ? ` · ${esc(familles)}` : ''}` : `${esc(x.pourquoi ?? '')} ${COMPTES_IA[m].compte}`;
  const aide = m === 'gemini' ? 'Une fenêtre de terminal s’ouvre : connecte-toi avec ton compte Google dans la page qui suit, ferme le terminal, puis reviens ici.' : 'Une page s’ouvre dans ton navigateur : connecte-toi, puis reviens ici.';
  return carteCx({etat: etatCarte(x.ok, occupe), lg: logo(m, 42), titre: nomIA(m), sous, actions, plus: erreurAction(x.action) + (x.connectable && !x.ok ? `<small class="dim">${aide}</small>` : '')});
}
/** Les vrais sons : la bibliothèque (remplie avec Openverse), Real SFX pour les poser, Earshot pour écouter. */
function sectionSons(d) {
  const s = d.sons ?? {};
  const rs = s.realsfx ?? {};
  const ea = s.earshot ?? {};
  const pret = `<span class="etiq ok">${ic('coche')}Prêt</span>`;
  const ajouter = (action, a, titre) => (enCours(a) ? `<span class="etiq">${anneau(0.5)}Installation…</span>` : `<button class="btn petit" data-cx="${action}" title="${titre}">Ajouter</button>`);
  const combien = s.nombre ? `${s.nombre} son${s.nombre > 1 ? 's' : ''} libre${s.nombre > 1 ? 's' : ''}` : 'Encore vide';
  return `<section class="cx-section"><h4>${ic('vague')}De vrais sons dans tes vidéos</h4><div class="cx-grille">
      ${carteCx({etat: etatCarte(s.actif && s.nombre > 0, s.actif), lg: logo('openverse', 42), titre: 'Bibliothèque de sons', sous: esc(s.actif ? `${combien} dans « ${s.nom} ». L’IA y prend ses bruitages, en cherche d’autres sur Openverse s’il en manque, et note les crédits.` : 'L’IA fabrique ses bruitages elle-même. Allume pour qu’elle prenne de vrais sons libres de droits, rangés dans ta bibliothèque avec leurs crédits.'),
        actions: `${s.actif ? '<button class="btn petit" data-cx="sons/ouvrir" title="Ouvrir le dossier de tes sons">Ouvrir</button>' : ''}<label class="interrupteur" title="Donner de vrais sons à l’IA"><input type="checkbox" data-cx-bascule="sons/activer"${s.actif ? ' checked' : ''}><i></i></label>`})}
      ${carteCx({etat: etatCarte(rs.ok, enCours(rs.action)), lg: logo('realsfx', 42), titre: 'Real SFX', sous: esc(rs.ok ? 'Pose les sons à l’image près, sous ta voix et ta musique, puis note son propre travail.' : 'Pose les sons à l’image près, sous ta voix et ta musique. À ajouter une fois (9 Mo).'), actions: rs.ok ? pret : ajouter('realsfx/installer', rs.action, 'Real SFX se télécharge depuis son dépôt officiel'), plus: erreurAction(rs.action)})}
      ${carteCx({etat: etatCarte(ea.ok, enCours(ea.action)), lg: logo('earshot', 42), titre: 'Earshot', sous: esc(ea.ok ? `L’oreille de l’IA : elle écoute, choisit et fabrique des sons, sur ton ordinateur.${ea.deja ? ' Déjà installé chez toi.' : ''}` : 'Facultatif. L’oreille de l’IA : elle écoute, choisit et fabrique des sons, sur ton ordinateur (2,5 Go).'), actions: ea.ok ? pret : ea.installable ? ajouter('earshot/installer', ea.action, 'Earshot et ses deux modèles : 2,5 Go, une dizaine de minutes') : '', plus: erreurAction(ea.action)})}</div></section>`;
}
async function feuilleConnexions() {
  let d;
  try { d = await api('GET', '/api/connexions'); } catch (e) { return note(e.message, true); }
  ui.cxMontree = true;
  const f = feuille('', true);
  f.classList.add('connexions');
  const rendre = () => {
    const treg = d.treg ?? {};
    const el = d.elevenlabs ?? {};
    const dr = d.drive ?? {};
    const bl = d.blender ?? {};
    const maj = d.maj ?? {};
    const reseaux = `<div class="cx-reseaux">${['tiktok', 'youtube', 'instagram', 'linkedin'].map((k) => logo(k, 22)).join('')}</div>`;
    f.innerHTML = `<div class="cx-tete"><div><h3>Connexions</h3><p class="sous-titre">Tout ce dont Dérush a besoin, branché ici en un clic. Rien n’est partagé sans toi.</p></div><span class="marque-iabai"><span>Dérush</span><small>par</small><img src="/marque/iabai.png" alt="IABAI"></span></div>
    <section class="cx-section"><h4>${ic('etincelle', 'plein')}Ton IA, celle qui monte</h4><div class="cx-grille trois">${carteIA(d, 'claude')}${carteIA(d, 'codex')}${carteIA(d, 'gemini')}</div>
      <div class="cx-qualite"><span>Qualité</span><div class="segmente">${Object.entries(d.qualites ?? {}).map(([k, q]) => `<button data-cx="ia/choisir" data-qualite="${k}"${k === d.qualite ? ' class="actif"' : ''} title="${esc(q.aide)}">${esc(q.nom)}</button>`).join('')}</div><small>${esc(d.qualites?.[d.qualite]?.aide ?? '')}</small></div></section>
    <section class="cx-section"><h4>${ic('onde')}Créer le son, les images, les plans</h4><div class="cx-grille">
      ${carteCx({etat: etatCarte(el.ok, el.attente), lg: logo('elevenlabs', 42), titre: 'ElevenLabs', sous: esc(el.ok ? 'Branché : musiques, voix, bruitages, images et plans vidéo.' : el.attente ? 'Autorise Dérush dans la page ElevenLabs ouverte dans ton navigateur.' : 'Musiques, voix off, bruitages, doublage, images et plans vidéo (crédits ElevenLabs).'), actions: el.ok ? `<span class="etiq ok">${ic('coche')}Branché</span>` : el.attente ? `<span class="etiq">${anneau(0.5)}En attente…</span>` : '<button class="btn bleu petit" data-cx="elevenlabs/brancher">Brancher</button>'})}</div></section>
    ${sectionSons(d)}
    <section class="cx-section"><h4>${ic('nuage')}Tes fichiers</h4><div class="cx-grille">
      ${carteCx({etat: etatCarte(dr.actif && (dr.synchronise || dr.connecteur?.etat === 'connecte')), lg: logo('drive', 42), titre: 'Google Drive', sous: esc(!dr.actif ? 'L’IA ne voit pas ton Drive.' : `${dr.synchronise ? `Dossier « ${dr.dossier} » synchronisé sur cet ordinateur.` : 'Le dossier Drive n’est pas synchronisé sur cet ordinateur (app Google Drive pour ordinateur).'} ${dr.connecteur?.etat === 'connecte' ? 'Le connecteur de ton compte Claude répond.' : 'Avec Claude, ajoute aussi le connecteur Google Drive dans claude.ai (Réglages › Connecteurs).'}`),
        actions: `<label class="interrupteur" title="Donner ton Drive à l’IA"><input type="checkbox" data-cx-bascule="drive/activer"${dr.actif ? ' checked' : ''}><i></i></label>`})}</div></section>
    <section class="cx-section"><h4>${ic('publier')}Tes réseaux : publier, lire, apprendre</h4><div class="cx-grille">
      ${carteCx({etat: etatCarte(treg.actif && treg.pret), lg: logo('treg', 42), titre: 'Treg', sous: esc(treg.pret ? `Relié${treg.jeton ? ' avec ta clé' : ' par le connecteur de ton compte Claude'}. Rien ne part sans ton clic.` : 'Conseillé. Treg relie tes comptes à ton IA : elle publie à ta place, lit tes chiffres et tes commentaires, et apprend ce qui marche chez toi. Tu choisis les comptes, rien ne part sans ton clic. Trois gestes, une seule fois : Dérush te guide.'),
        plus: reseaux,
        actions: `<button class="btn ${treg.pret ? '' : 'bleu '}petit" data-guide-treg title="Trois gestes, une seule fois">${treg.pret ? 'Voir mes réseaux' : 'Relier mes réseaux'}</button><label class="interrupteur" title="Donner Treg à l’IA"><input type="checkbox" data-cx-bascule="treg/activer"${treg.actif ? ' checked' : ''}><i></i></label>`})}</div></section>
    <section class="cx-section"><h4>${ic('cube')}La 3D</h4><div class="cx-grille">
      ${carteCx({etat: etatCarte(bl.ok, enCours(d.blender_action)), lg: logo('blender', 42), titre: 'Blender', sous: esc(bl.ok ? `${bl.nom} : l’IA s’en sert pour la 3D réaliste.` : 'Facultatif : sans lui, l’IA fait la 3D dans la page (Three.js).'), actions: bl.ok ? `<span class="etiq ok">${ic('coche')}Prêt</span>` : enCours(d.blender_action) ? `<span class="etiq">${anneau(0.5)}Installation…</span>` : '<button class="btn petit" data-cx="blender/installer">Installer</button>', plus: erreurAction(d.blender_action)})}</div></section>
    <section class="cx-section"><h4>${ic('outil')}Dérush</h4><div class="cx-grille deux">
      ${carteCx({etat: etatCarte(d.competences?.remotion, enCours(d.competences?.action)), lg: logo('competences', 42), titre: `${d.competences?.nombre ?? 0} compétences`, sous: esc(`Montage, FFmpeg, étalonnage, sous-titres, son, motion design, TikTok, Reels, Shorts, publication${d.competences?.remotion ? ', Remotion' : ''} : l’IA les lit avant de travailler.`), actions: d.competences?.remotion ? `<span class="etiq ok">${ic('coche')}Prêtes</span>` : enCours(d.competences?.action) ? `<span class="etiq">${anneau(0.5)}Téléchargement…</span>` : '<button class="btn petit" data-cx="competences/remotion" title="Les compétences Remotion se téléchargent depuis leur dépôt officiel">Ajouter Remotion</button>', plus: erreurAction(d.competences?.action)})}
      ${carteCx({etat: etatCarte(maj.possible !== false && !maj.en_retard, enCours(maj.action)), lg: logo('maj', 42), titre: `Version ${esc(d.version)}`, sous: esc(maj.possible === false ? maj.message : maj.en_retard ? `Nouvelle version${maj.version_distante ? ` ${maj.version_distante}` : ''} : ${maj.notes?.slice(0, 2).join(' · ') || `${maj.en_retard} changement(s)`}.` : maj.le ? 'Dérush est à jour.' : 'Bêta privée : les mises à jour arrivent par GitHub.'), actions: maj.en_retard ? '<button class="btn principal petit" data-cx="maj/installer">Mettre à jour</button>' : '<button class="btn petit" data-cx="maj/verifier">Vérifier</button>'})}</div></section>
    <div class="pied"><span class="dim" style="font-size:12px">${esc(d.systeme ?? '')} · Dérush ${esc(d.version ?? '')} · bêta privée</span><span class="espace"></span><button class="btn principal" data-fermer>OK</button></div>`;
  };
  const relire = async (force = true) => {
    try { d = await api('GET', `/api/connexions${force ? '?force=1' : ''}`); } catch { return; }
    if (!feuilleOuverte() || !f.isConnected) return;
    rendre();
    if (ui.claude) chargerClaude(true);
  };
  const suivre = () => {
    clearTimeout(minuterieConnexions);
    const attente = [d.claude?.action, d.codex?.action, d.gemini?.action, d.blender_action, d.competences?.action, d.sons?.realsfx?.action, d.sons?.earshot?.action].some(enCours) || d.elevenlabs?.attente || ui.cxSuivre > Date.now();
    if (attente) minuterieConnexions = setTimeout(async () => { if (!f.isConnected) return; await relire(); suivre(); }, 3500);
  };
  rendre();
  suivre();
  f.addEventListener('change', async (e) => {
    const b = e.target.dataset?.cxBascule;
    if (!b) return;
    try { await api('POST', `/api/connexions/${b}`, {actif: e.target.checked}); } catch (err) { note(err.message, true); }
    await relire(false);
  });
  f.addEventListener('click', async (e) => {
    if (e.target.closest('[data-fermer]')) { clearTimeout(minuterieConnexions); fermerFeuille(); if (ui.claude) chargerClaude(true); return; }
    if (e.target.closest('[data-guide-treg]')) { clearTimeout(minuterieConnexions); return PUB.guideTreg(() => feuilleConnexions()); }
    const lien = e.target.closest('[data-lien]')?.dataset.lien;
    if (lien) return api('POST', '/api/lien', {url: lien}).catch((err) => note(err.message, true));
    const b = e.target.closest('[data-cx]');
    if (!b) return;
    const action = b.dataset.cx;
    const corps = {};
    if (action === 'ia/choisir') { if (b.dataset.moteur) corps.moteur = b.dataset.moteur; if (b.dataset.qualite) corps.qualite = b.dataset.qualite; }
    b.disabled = true;
    try {
      await api('POST', `/api/connexions/${action}`, corps);
      if (/\/(installer|connecter|brancher)$/.test(action)) { ui.cxSuivre = Date.now() + 15 * 60000; note(action === 'gemini/connecter' ? 'Une fenêtre de terminal s’ouvre : connecte-toi avec ton compte Google, puis reviens ici.' : /connecter|brancher/.test(action) ? 'Une page s’ouvre dans ton navigateur : connecte-toi, puis reviens ici.' : 'Installation lancée : ça prend une à deux minutes.'); }
      if (action === 'maj/installer') { note('Mise à jour installée : Dérush redémarre…', false, true); return; }
      if (action === 'earshot/installer') note('Earshot s’installe : 2,5 Go, compte une dizaine de minutes. Tu peux continuer à travailler.');
    } catch (err) { note(err.message, true); }
    await relire(!action.startsWith('ia/'));
    suivre();
  });
}

/** « Qui monte ? » : Claude, Codex ou Gemini, et le niveau de soin. */
function feuilleChoixIA() {
  const c = ui.claude;
  if (!c) return feuilleConnexions();
  const carte = (m) => {
    const x = c[m] ?? {};
    const choisi = moteurIA() === m;
    return `<button class="ia-carte${choisi ? ' choisie' : ''}${x.ok ? '' : ' pas-prete'}" data-moteur="${m}">${logo(m, 44)}<span><b>${nomIA(m)}</b><small>${esc(c.ia?.noms?.[m]?.compte ?? '')}</small><small class="${x.ok ? 'ok' : 'attention'}">${esc(x.ok ? 'Prête' : x.pourquoi ?? '')}</small></span>${choisi ? `<i class="coche">${ic('coche')}</i>` : ''}</button>`;
  };
  const f = feuille(`<h3>Qui monte ta vidéo ?</h3><p class="sous-titre">Choisis ton IA et le niveau de soin. Tu peux changer à tout moment : la conversation continue avec la nouvelle.</p>
    <div class="ia-cartes trois">${carte('claude')}${carte('codex')}${carte('gemini')}</div>
    <div class="cx-qualite"><span>Qualité</span><div class="segmente">${Object.entries(c.qualites ?? {}).map(([k, q]) => `<button data-qualite="${k}"${k === qualiteIA() ? ' class="actif"' : ''}>${esc(q.nom)}</button>`).join('')}</div><small id="aide-qualite">${esc(c.qualites?.[qualiteIA()]?.aide ?? '')}</small></div>
    <div class="pied"><button class="btn" data-connexions>${ic('prise')}Connexions</button><span class="espace"></span><button class="btn principal" data-fermer>OK</button></div>`);
  f.addEventListener('click', async (e) => {
    if (e.target.closest('[data-fermer]')) return fermerFeuille();
    if (e.target.closest('[data-connexions]')) return feuilleConnexions();
    const m = e.target.closest('[data-moteur]')?.dataset.moteur;
    const q = e.target.closest('[data-qualite]')?.dataset.qualite;
    if (m && !c[m]?.ok) return feuilleConnexions();
    if (!m && !q) return;
    try {
      await api('POST', '/api/connexions/ia/choisir', m ? {moteur: m} : {qualite: q});
      await chargerClaude();
      if (m) note(`${nomIA(m)} monte tes prochaines vidéos.`);
      feuilleChoixIA();
    } catch (err) { note(err.message, true); }
  });
}

/** Publier une vidéo livrée : les réseaux, la visibilité, un mot pour l'IA. L'IA écrit les textes et publie avec Treg. */
function feuillePublier(nom) {
  const c = ui.claude;
  const x = c?.versions.flatMap((v) => v.videos).find((y) => y.nom === nom);
  if (!x) return;
  const choix = new Set(prefs.lire('publier.reseaux', ['tiktok', 'youtube']).filter((k) => RESEAUX_UI[k]));
  let visibilite = prefs.lire('publier.visibilite', 'unlisted');
  const treg = c.treg ?? {};
  const qui = nomIA();
  const infos = [x.duree ? dureeLisible(x.duree) : null, x.largeur ? ratioDe(x.largeur, x.hauteur) : null].filter(Boolean).join(' · ');
  const f = feuille(`<h3>Publier</h3><p class="sous-titre">${qui} vérifie la vidéo, écrit le titre, la légende et les hashtags de chaque réseau, puis la publie avec Treg.</p>
    <div class="pub-video">${vignetteVideo(x, 56)}<div><b>${esc(x.titre ?? 'Ta vidéo')}</b><small>${esc(infos)}</small></div></div>
    <div class="pub-reseaux">${Object.entries(RESEAUX_UI).map(([k, n]) => `<button class="pub-reseau${choix.has(k) ? ' actif' : ''}" data-reseau="${k}">${logo(k, 32)}<span><b>${n}</b><small>${esc(c.reseaux?.[k]?.aide ?? '')}</small></span><i class="coche">${ic('coche')}</i></button>`).join('')}</div>
    <div class="cx-qualite${choix.has('youtube') ? '' : ' cache'}" id="pub-visi"><span>Sur YouTube</span><div class="segmente">${[['unlisted', 'Non répertoriée'], ['public', 'Publique'], ['private', 'Privée']].map(([k, n]) => `<button data-visi="${k}"${k === visibilite ? ' class="actif"' : ''}>${n}</button>`).join('')}</div></div>
    <label class="champ"><span>Un mot pour ${qui} (facultatif)</span><textarea id="pub-consigne" rows="2" placeholder="Le ton, un appel à l’action, des hashtags à mettre, une mention…"></textarea></label>
    ${treg.pret && !treg.youtube ? `<p class="pub-treg attention" id="pub-yt-cle">${ic('attention')}<span>YouTube a besoin de ta clé Treg : le connecteur de ton compte Claude ne lui suffit pas.</span><button class="btn petit" data-guide-treg>Ajouter ma clé</button></p>` : ''}
    ${treg.pret ? `<p class="pub-treg ok">${ic('coche')}<span>Treg est relié. Rien ne part sans ce clic.</span></p>` : `<p class="pub-treg attention">${ic('attention')}<span>Treg n’est pas encore relié : ${qui} écrira tes textes, mais ne pourra pas publier.</span><button class="btn petit" data-connexions>Relier Treg</button></p>`}
    <div class="pied"><button class="btn" data-fermer>Annuler</button><button class="btn principal" data-go${!iaPrete() || c.en_cours ? ' disabled' : ''}>${ic('publier')}Publier avec ${qui}</button></div>`);
  const maj = () => {
    $$('.pub-reseau', f).forEach((b) => b.classList.toggle('actif', choix.has(b.dataset.reseau)));
    $('#pub-visi', f).classList.toggle('cache', !choix.has('youtube'));
    $('#pub-yt-cle', f)?.classList.toggle('cache', !choix.has('youtube'));
    $('[data-go]', f).disabled = !choix.size || !iaPrete() || !!c.en_cours;
  };
  f.addEventListener('click', async (e) => {
    if (e.target.closest('[data-fermer]')) return fermerFeuille();
    if (e.target.closest('[data-connexions]')) return feuilleConnexions();
    if (e.target.closest('[data-guide-treg]')) return PUB.guideTreg(() => chargerClaude(true));
    const r = e.target.closest('[data-reseau]')?.dataset.reseau;
    if (r) { if (choix.has(r)) choix.delete(r); else choix.add(r); prefs.ecrire('publier.reseaux', [...choix]); return maj(); }
    const v = e.target.closest('[data-visi]')?.dataset.visi;
    if (v) { visibilite = v; prefs.ecrire('publier.visibilite', v); $$('[data-visi]', f).forEach((b) => b.classList.toggle('actif', b.dataset.visi === v)); return; }
    if (e.target.closest('[data-go]')) {
      try {
        await api('POST', '/api/claude/demander', {moteur: moteurIA(), qualite: qualiteIA(), publier: {video: nom, reseaux: [...choix], visibilite, consigne: $('#pub-consigne', f).value.trim()}});
        fermerFeuille();
        montrerClaude();
        note(`${qui} prépare la publication : suis-la dans la colonne de droite.`);
        await chargerClaude();
      } catch (err) { note(err.message, true); }
    }
  });
}

// ——— le format de la vidéo, dans la timeline (et « Auto » : comme la première vidéo) ———
function rendreFormatTl() {
  const box = $('#format-tl');
  if (!box || !P) return;
  const auto = !!P.sortie.auto;
  box.innerHTML = Object.entries(FORMATS).map(([k, f]) => {
    const h = 12;
    const w = Math.round((h * f.largeur) / f.hauteur);
    return `<button class="fmt${P.sortie.preset === k && !auto ? ' actif' : P.sortie.preset === k ? ' actif auto' : ''}" data-format-tl="${k}" title="${esc(f.nom)}"><i style="width:${Math.min(w, 20)}px;height:${w > 20 ? Math.round((20 * f.hauteur) / f.largeur) : h}px"></i><span>${f.ratio}</span></button>`;
  }).join('') + `<button class="fmt auto${auto ? ' actif' : ''}" data-format-tl="auto" title="Le format de ta première vidéo">Auto</button>`;
  $('#b-st')?.classList.toggle('actif', styleDuProjet().sous_titres.style !== 'aucun');
}
/** « Auto » : le format le plus proche de la première vidéo du projet. */
function appliquerFormatAuto(dire = false) {
  if (!P?.sortie?.auto) return;
  const v = P.medias.find((m) => m.type === 'video' && m.largeur && m.hauteur) ?? P.medias.find((m) => m.type === 'image' && m.largeur && m.hauteur);
  if (!v) return rendreFormatTl();
  const k = formatProche(v.largeur, v.hauteur); // largeur et hauteur tiennent déjà compte d'une vidéo tournée (téléphone)
  if (k !== P.sortie.preset) {
    Object.assign(P.sortie, {preset: k, largeur: FORMATS[k].largeur, hauteur: FORMATS[k].hauteur});
    apresFormat();
    sauver();
    dire = true;
  }
  if (dire) note(`Format ${FORMATS[k].ratio}, comme ta vidéo. Il se change d’un clic, dans la barre de la timeline.`);
  rendreFormatTl();
}
$('#format-tl').addEventListener('click', (e) => {
  const k = e.target.closest('[data-format-tl]')?.dataset.formatTl;
  if (!k || !P) return;
  if (k === 'auto') {
    P.sortie.auto = true;
    sauver();
    appliquerFormatAuto(true);
  } else {
    Object.assign(P.sortie, {preset: k, largeur: FORMATS[k].largeur, hauteur: FORMATS[k].hauteur, auto: false});
    apresFormat();
    sauver();
    note(`Format ${FORMATS[k].ratio}. Tes plans s’adaptent : le recadrage suit les visages.`);
  }
  rendreFormatTl();
});
/** Les sous-titres sur tout le film, d'un clic (leur style se règle dans Habiller). */
function basculerSousTitres() {
  if (!P) return;
  const actuel = styleDuProjet().sous_titres.style;
  if (actuel !== 'aucun') {
    prefs.ecrire('soustitres.precedent', actuel);
    modifierStyle((s) => { s.sous_titres.style = 'aucun'; }, 'st');
    note('Sous-titres retirés.');
  } else {
    const duLook = LOOKS[styleDuProjet().look]?.style.sous_titres.style;
    const st = prefs.lire('soustitres.precedent', duLook && duLook !== 'aucun' ? duLook : 'karaoke');
    modifierStyle((s) => { s.sous_titres.style = STYLES_SOUS_TITRES[st] && st !== 'aucun' ? st : 'karaoke'; }, 'st');
    const sansTexte = P.medias.filter((m) => m.audio && !m.transcription).length;
    note(sansTexte ? 'Sous-titres mis. Ils s’affichent dès que le texte des rushes est écrit (panneau Texte).' : 'Sous-titres mis. Leur style se règle dans Habiller.');
  }
  rendreFormatTl();
}

// =====================================================================
// Le lecteur : « Mon montage », « En direct » (le rendu de l'IA, image par image) ou « Vidéo de l'IA »
// =====================================================================
function majVueSwitch() {
  const c = ui.claude;
  const direct = !!c?.en_cours;
  const videos = !!c?.versions.length;
  $('#vue-switch').classList.toggle('cache', !direct && !videos);
  $('#vue-switch [data-vue="direct"]').classList.toggle('cache', !direct);
  $('#vue-switch [data-vue="claude"]').classList.toggle('cache', !videos);
  $$('#vue-switch button').forEach((b) => b.classList.toggle('actif', b.dataset.vue === ui.vue));
}
function montrerVue(vue, n = null, k = null, lecture = false) {
  const c = ui.claude;
  const versions = c?.versions ?? [];
  if (vue === 'claude' && !versions.length) vue = 'montage';
  if (vue === 'direct' && !c?.en_cours) vue = versions.length ? 'claude' : 'montage';
  const vc = $('#v-claude');
  ui.vue = vue;
  $('#visionneuse').classList.toggle('vue-claude', vue !== 'montage');
  $('#direct').classList.toggle('cache', vue !== 'direct');
  if (vue !== 'montage') {
    arreterLecture();
    if (ui.mode !== 'montage') definirMode('montage');
    $('#vide').classList.add('cache');
  }
  if (vue === 'claude') {
    const v = versions.find((x) => x.n === n) ?? versions.find((x) => x.n === ui.versionVue) ?? versions.at(-1);
    const kk = Math.min(v.videos.length - 1, Math.max(0, k ?? (v.n === ui.versionVue ? ui.videoVue ?? 0 : 0)));
    const x = v.videos[kk];
    ui.versionVue = v.n;
    ui.videoVue = kk;
    if (vc.dataset.nom !== x.nom) { vc.dataset.nom = x.nom; vc.src = urlVideo(x.nom); }
    vc.classList.remove('cache');
    $('#vis-titre').innerHTML = `<b>Vidéo de ${nomIA(v.moteur ?? 'claude')}</b> <span class="dim">· version ${v.n}${v.videos.length > 1 ? ` · ${esc(x.titre ?? `vidéo ${kk + 1}`)}` : ''}${x.duree ? ` · ${dureeLisible(x.duree)}` : ''}</span>${v.videos.length > 1 ? `<span class="vis-videos">${v.videos.map((y, i) => `<button data-video="${i}"${i === kk ? ' class="actif"' : ''} title="${esc(y.titre ?? `Vidéo ${i + 1}`)}">${i + 1}</button>`).join('')}</span>` : ''}`;
    if (lecture) vc.play().catch(() => {});
  } else {
    vc.pause();
    vc.classList.add('cache');
    if (vue === 'direct') { $('#vis-titre').innerHTML = '<b class="titre-direct"><i class="point-direct"></i>En direct</b> <span class="dim">· le travail de ton IA, au moment où elle le fait</span>'; majDirect(); } else majVue();
  }
  majVueSwitch();
  majTete();
  rendreClaude();
  rendreClaudePiste();
}
$('#vue-switch').addEventListener('click', (e) => { const b = e.target.closest('[data-vue]'); if (b) montrerVue(b.dataset.vue); });
$('#vis-titre').addEventListener('click', (e) => { const b = e.target.closest('[data-video]'); if (b && ui.vue === 'claude') montrerVue('claude', ui.versionVue, Number(b.dataset.video), true); });
// la première image d'une vidéo est souvent noire : on montre un instant un peu plus loin
$('#v-claude').addEventListener('loadedmetadata', (e) => { const v = e.target; if (v.paused && v.currentTime === 0) v.currentTime = Math.min(0.6, v.duration / 4); rendreClaudePiste(); });
$('#v-claude').addEventListener('error', () => { if (ui.vue === 'claude') note('Cette vidéo est introuvable : elle a peut-être été déplacée.', true); });
$('#v-claude').addEventListener('timeupdate', () => { if (ui.vue === 'claude') majTete(); });
// une vidéo de Claude se termine : on passe à la suivante s'il en a livré plusieurs
$('#v-claude').addEventListener('ended', () => {
  const v = ui.claude?.versions.find((x) => x.n === ui.versionVue);
  if (ui.vue === 'claude' && v && (ui.videoVue ?? 0) < v.videos.length - 1) montrerVue('claude', v.n, ui.videoVue + 1, true);
});

/** « En direct » : la dernière image du rendu de Claude, ou l'image qu'il regarde. Les images arrivées entre deux nouvelles s'enchaînent. */
const DIRECT = {file: [], rendu: null, derniere: -1, minuterie: null};
function montrerImageDirect(src) {
  const img = $('#direct-img');
  if (img.dataset.src === src) return;
  img.dataset.src = src;
  const pre = new Image();
  pre.onload = () => { if (img.dataset.src === src) { img.src = src; img.classList.remove('cache'); $('#direct-attente').classList.add('cache'); } };
  pre.src = src;
}
function tourDirect() {
  DIRECT.minuterie = null;
  if (!DIRECT.file.length || ui.vue !== 'direct') return;
  // on garde le rythme du rendu : s'il prend de l'avance, on saute des images
  if (DIRECT.file.length > 10) DIRECT.file.splice(0, DIRECT.file.length - 6);
  montrerImageDirect(DIRECT.file.shift());
  DIRECT.minuterie = setTimeout(tourDirect, 180);
}
function majDirect() {
  const c = ui.claude;
  if (ui.vue !== 'direct' || !c?.en_cours) return;
  const e = c.en_cours;
  const r = dernierRendu(c);
  const vue = e.direct?.vues?.at(-1);
  const debut = Date.now() - e.depuis_s * 1000;
  // ce que Claude regarde passe devant un rendu déjà fini
  const regarde = vue && (!r || (!renduActif(r) && (!r.fin || debut + vue.t * 1000 > Date.parse(r.fin))));
  const info = $('#direct-info');
  const jauge = $('#direct-jauge');
  if (r && !regarde) {
    if (DIRECT.rendu !== r.id) { DIRECT.rendu = r.id; DIRECT.derniere = -1; DIRECT.file = []; }
    const nouvelles = r.images.filter((n) => n > DIRECT.derniere);
    if (nouvelles.length) {
      DIRECT.derniere = nouvelles.at(-1);
      DIRECT.file.push(...nouvelles.slice(-12).map((n) => urlDirect(r, n)));
      if (!DIRECT.minuterie) tourDirect();
    }
    const fps = r.fps || 30;
    const pct = r.total ? Math.min(100, Math.round((100 * (r.rendues ?? 0)) / r.total)) : 0;
    const quoi = r.etape === 'assemblage' || r.etape === 'preparation' ? 'Claude prépare le rendu' : r.etape === 'son' ? 'Mixage du son' : r.etape === 'fini' ? 'Rendu terminé' : r.etape === 'erreur' ? 'Le rendu a échoué : Claude corrige' : 'Rendu';
    info.innerHTML = `${esc(quoi)} · <b>${esc(r.titre ?? r.composition ?? '')}</b>${r.total ? ` · ${minSec((r.rendues ?? 0) / fps)} / ${minSec(r.total / fps)}` : ''}${renduActif(r) && r.etape === 'rendu' ? ` · ${pct} %` : ''}`;
    jauge.style.width = `${r.etape === 'fini' ? 100 : pct}%`;
    jauge.parentElement.classList.remove('cache');
    if (!r.images.length) { $('#direct-attente').classList.remove('cache'); $('#direct-img').classList.add('cache'); }
  } else if (vue) {
    montrerImageDirect(urlVue(vue.n));
    info.innerHTML = `${ic('oeil')} ${nomIA(ui.claude?.en_cours?.moteur)} regarde <b>${esc(vue.nom)}</b>`;
    jauge.parentElement.classList.add('cache');
  } else {
    info.textContent = etapeClaude(e.activite.at(-1));
    jauge.parentElement.classList.add('cache');
    $('#direct-attente').classList.remove('cache');
    $('#direct-img').classList.add('cache');
  }
}

/** La durée à laisser dans la timeline pour la piste de Claude. */
function dureeClaudeTl() {
  const c = ui.claude;
  if (!c) return 0;
  const r = c.en_cours ? dernierRendu(c) : null;
  if (r?.total) return r.total / (r.fps || 30);
  const v = c.versions.find((x) => x.n === ui.versionVue) ?? c.versions.at(-1);
  return v ? Math.max(0, ...v.videos.map((x) => x.duree || 0)) : 0;
}
/**
 * La piste de Claude, sous le montage : pendant un rendu, ses images s'y posent au fur et à mesure (en direct) ;
 * ensuite, la vidéo qu'il a livrée s'y affiche en bande d'images. Un clic la lit à cet endroit.
 */
function rendreClaudePiste() {
  rendreBlocsIA();
  const piste = $('#piste-claude');
  const c = ui.claude;
  const visible = !!P && !!c && (c.versions.length > 0 || !!c.en_cours);
  piste.classList.toggle('cache', !visible);
  const avant = $('#ecran-montage').classList.contains('avec-claude');
  $('#ecran-montage').classList.toggle('avec-claude', visible);
  if (avant !== visible) setTimeout(() => { majScene(); dessinerBande(); }, 30);
  if (!visible) { piste.dataset.cle = ''; return; }
  const r = c.en_cours ? dernierRendu(c) : null;
  const v = c.versions.find((x) => x.n === ui.versionVue) ?? c.versions.at(-1);
  const x = v?.videos[Math.min(ui.versionVue === v.n ? ui.videoVue ?? 0 : 0, v.videos.length - 1)];
  const cle = JSON.stringify([ui.pps, r?.id, r?.images.length, r?.etape, v?.n, x?.nom, ui.vue, !!c.en_cours]);
  if (piste.dataset.cle === cle) return;
  piste.dataset.cle = cle;
  // la timeline doit être assez longue pour la vidéo de Claude
  const besoin = (dureeClaudeTl() + 10) * ui.pps + 200;
  if (parseFloat($('#tl-interieur').style.width) < besoin) { $('#tl-interieur').style.width = `${besoin}px`; rendreRegle(besoin); }
  const H = 44; // la hauteur de la bande, comme dans style.css
  const nom = (t) => `<span class="piste-nom">${ic('etincelle', 'plein')}${t}</span>`;
  const tuiles = (duree, w, url) => {
    const largeur = duree * ui.pps;
    const pas = Math.max(w, largeur / 400);
    let html = '';
    for (let xx = 0; xx < largeur; xx += pas) {
      const u = url((xx + Math.min(pas, largeur - xx) / 2) / ui.pps);
      if (u) html += `<div style="left:${xx}px;width:${Math.min(pas, largeur - xx) + 0.5}px;${u}"></div>`;
    }
    return html;
  };
  if (r && (r.images.length || renduActif(r))) {
    const ratio = r.largeur && r.hauteur ? r.largeur / r.hauteur : P.sortie.largeur / P.sortie.hauteur;
    const w = Math.max(16, Math.round(H * ratio));
    const pasImg = r.pas_s || 0.5;
    const fps = r.fps || 30;
    const total = r.total ? r.total / fps : Math.max(seq.duree, 10);
    const dispo = new Set(r.images);
    const derniere = r.images.at(-1) ?? -1;
    const arrive = Math.min(total, (derniere + 1) * pasImg);
    const html = tuiles(arrive, w, (t) => {
      let n = Math.min(derniere, Math.floor(t / pasImg));
      while (n >= 0 && !dispo.has(n)) n--;
      return n >= 0 ? `background-image:url('${urlDirect(r, n)}')` : '';
    });
    const pct = r.total ? Math.min(100, Math.round((100 * (r.rendues ?? 0)) / r.total)) : 0;
    piste.innerHTML = `${nom(`${nomIA(ui.claude?.en_cours?.moteur)} · en direct`)}<div class="cl-bande direct${ui.vue === 'direct' ? ' vue' : ''}" style="width:${total * ui.pps}px" title="Le rendu de l’IA, au fur et à mesure : clique pour le voir en grand">${html}${renduActif(r) ? `<div class="cl-front" style="left:${arrive * ui.pps}px"></div>` : ''}<span class="cl-bande-titre"><i class="point-direct"></i>${esc(r.titre ?? '')}${renduActif(r) && r.etape === 'rendu' ? ` · ${pct} %` : r.etape === 'fini' ? ' · rendu' : ''}</span></div>`;
  } else if (x) {
    const s = x.vignettes;
    const duree = x.duree || s?.n * s?.pas || 10;
    const w = s ? Math.max(16, Math.round((H * s.l) / s.h)) : 28;
    const sprite = urlVideo(x.nom.replace(/\.mp4$/, '.vignettes.jpg'));
    const html = s ? tuiles(duree, w, (t) => {
      const k = Math.min(s.n - 1, Math.floor(t / s.pas));
      return `background-image:url('${sprite}');background-size:${s.n * w}px ${H}px;background-position:-${k * w}px 0`;
    }) : '';
    const plusieurs = v.videos.length > 1 ? ` · ${(ui.videoVue ?? 0) + 1}/${v.videos.length}` : '';
    piste.innerHTML = `${nom(`${nomIA(v.moteur ?? 'claude')} · v${v.n}${plusieurs}`)}<div class="cl-bande${ui.vue === 'claude' ? ' vue' : ''}" style="width:${duree * ui.pps}px" title="La vidéo de l’IA : clique pour la lire à cet endroit">${html}<span class="cl-bande-titre">${ic('lire', 'plein')}${esc(x.titre ?? `Version ${v.n}`)} · ${dureeLisible(duree)}</span></div>`;
  } else {
    piste.innerHTML = `${nom(nomIA(ui.claude?.en_cours?.moteur))}<div class="cl-bande attente" style="width:${Math.max(seq.duree, 12) * ui.pps}px"><span class="cl-bande-titre">${ill('bobine')}${nomIA(ui.claude?.en_cours?.moteur)} prépare le montage : son rendu s’affichera ici, en direct</span></div>`;
  }
}
// ——— La table de montage de l'IA : ce qu'elle pose sur la vidéo (plans, titres, effets, sons), en direct pendant son
// travail, puis à régler bloc par bloc. Elle l'écrit dans rendu/timeline.json (voir tableIA dans lib/claude.mjs). ———
const PISTES_IA = [['plan', 'Plans', 'film'], ['texte', 'Titres et textes', 'texte'], ['effet', 'Effets', 'etincelle'], ['son', 'Sons', 'onde']];
const pisteDe = (b) => (b.piste === 'sous-titres' ? 'texte' : b.piste);
const tempsFin = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0').replace('.', ',')}`;
/** La table à montrer : celle du travail en cours (en direct), sinon celle de la version regardée. */
function tableIA() {
  const c = ui.claude;
  if (!c) return null;
  const direct = c.en_cours?.direct?.table;
  if (direct?.blocs?.length) return {...direct, direct: true};
  const v = c.versions.find((x) => x.n === ui.versionVue) ?? c.versions.at(-1);
  if (c.en_cours || !v?.table?.blocs?.length) return null;
  const k = ui.versionVue === v.n ? ui.videoVue ?? 0 : 0;
  const blocs = v.table.blocs.filter((b) => b.video == null || b.video === k);
  return blocs.length ? {...v.table, blocs, version: v.n, moteur: v.moteur} : null;
}
const blocIA = (id) => tableIA()?.blocs.find((b) => b.id === id) ?? null;
function rendreBlocsIA() {
  const piste = $('#piste-blocs');
  const t = P && ui.claude ? tableIA() : null;
  piste.classList.toggle('cache', !t);
  $('#ecran-montage').classList.toggle('avec-blocs', !!t);
  if (!t) { piste.dataset.cle = ''; piste.innerHTML = ''; return; }
  const rangees = PISTES_IA.map(([k, nom, icone]) => [k, nom, icone, t.blocs.filter((b) => pisteDe(b) === k)]).filter((r) => r[3].length);
  const cle = JSON.stringify([ui.pps, ui.blocIA, !!t.direct, t.version, t.blocs.map((b) => [b.id, b.debut_s, b.duree_s, b.nom]), ui.reglagesIA.map((r) => r.bloc)]);
  if (piste.dataset.cle === cle) return;
  piste.dataset.cle = cle;
  const regles = new Set(ui.reglagesIA.map((r) => r.bloc));
  piste.style.height = `${20 + rangees.length * 24}px`;
  $('#ecran-montage').style.setProperty('--h-blocs', `${20 + rangees.length * 24}px`);
  piste.innerHTML = `<span class="piste-nom">${ic('etincelle', 'plein')}${t.direct ? 'Ce que pose l’IA · en direct' : 'Ce qu’a posé l’IA · clique un bloc pour le régler'}</span>${rangees.map(([k, nom, icone, blocs], i) => `<div class="rangee-ia" style="top:${20 + i * 24}px" title="${nom}">${blocs.map((b) =>
    `<button class="bloc-ia b-${k}${b.id === ui.blocIA ? ' actif' : ''}${regles.has(b.id) ? ' regle' : ''}" data-bloc="${esc(b.id)}" style="left:${b.debut_s * ui.pps}px;width:${Math.max(8, b.duree_s * ui.pps - 1)}px" title="${esc(`${b.nom} · ${tempsFin(b.debut_s)} → ${tempsFin(b.debut_s + b.duree_s)}${b.detail ? `\n${b.detail}` : ''}`)}">${ic(icone)}<span>${esc(b.nom)}</span></button>`).join('')}</div>`).join('')}`;
}
$('#piste-blocs').addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-bloc]');
  if (e.button !== 0 || !el) return;
  e.stopPropagation();
  const b = blocIA(el.dataset.bloc);
  if (!b) return;
  if (ui.sel || ui.multi.size) selectionner(null);
  ui.blocIA = b.id;
  // la vidéo de l'IA se place au début du bloc
  const c = ui.claude;
  if (!c?.en_cours && c?.versions.length) {
    if (ui.vue !== 'claude') montrerVue('claude');
    const vc = $('#v-claude');
    vc.currentTime = Math.min(b.debut_s + 0.02, Number.isFinite(vc.duration) ? Math.max(0, vc.duration - 0.05) : b.debut_s);
    majTete();
  }
  rendreBlocsIA();
  rendreInspecteur();
});
/** Les réglages d'un bloc de l'IA, dans la colonne de droite : des gestes tout prêts, ou ses propres mots. */
function rendreBlocIA(box, b) {
  const k = pisteDe(b);
  const [, nomPiste, icone] = PISTES_IA.find((p) => p[0] === k) ?? PISTES_IA[2];
  const qui = nomIA(tableIA()?.moteur ?? ui.claude?.en_cours?.moteur ?? moteurIA());
  const gestes = [['plus-tot', 'Plus tôt'], ['plus-tard', 'Plus tard'], ['plus-court', 'Plus court'], ['plus-long', 'Plus long'],
    ...(k === 'son' ? [['moins-fort', 'Moins fort'], ['plus-fort', 'Plus fort']] : []), ...(k === 'texte' ? [['plus-gros', 'Plus gros'], ['plus-discret', 'Plus discret']] : []), ['retirer', 'Retirer']];
  const deja = ui.reglagesIA.map((r, i) => [r, i]).filter(([r]) => r.bloc === b.id);
  const n = ui.reglagesIA.length;
  box.innerHTML = `${tete(`bloc-ia b-${k}`, icone, b.nom, `${nomPiste} · ${tempsFin(b.debut_s)} → ${tempsFin(b.debut_s + b.duree_s)} · ${dureeLisible(b.duree_s)}`)}
    <div class="groupe-insp bloc-ia-fiche">
      ${b.detail ? `<p class="bloc-detail selectionnable">${esc(b.detail)}</p>` : ''}
      ${k === 'texte' && b.texte != null ? `<label class="champ"><span>Le texte à l’écran</span><textarea id="bloc-texte" rows="2">${esc(b.texte)}</textarea></label>` : ''}
      <div class="champ"><span>Régler d’un geste</span><div class="bloc-gestes">${gestes.map(([g, nom]) => `<button class="btn petit" data-geste="${g}">${nom}</button>`).join('')}</div></div>
      <label class="champ"><span>Ou dis-le avec tes mots</span><textarea id="bloc-demande" rows="2" placeholder="Exemple : en jaune, et qu’il arrive en glissant depuis la gauche"></textarea></label>
      <div class="rangee"><button class="btn claude" data-bloc-act="ajouter">${ic('plus')}<span>Ajouter ce réglage</span></button></div>
      ${deja.length ? `<div class="bloc-regles"><small>Réglages prêts pour ce bloc</small>${deja.map(([r, i]) => `<span class="bloc-regle">${esc(r.texte)}<button data-bloc-act="oter" data-i="${i}" title="Retirer ce réglage">${ic('fermer')}</button></span>`).join('')}</div>` : ''}
      <p class="dim bloc-note">Tes réglages partent avec ton prochain message : ${esc(qui)} ne touche qu’aux blocs que tu as réglés.</p>
      <div class="rangee"><button class="btn" data-bloc-act="fermer">Revenir à la conversation</button>${n ? `<button class="btn principal" data-bloc-act="envoyer">Envoyer ${n > 1 ? `les ${n} réglages` : 'le réglage'}</button>` : ''}</div>
    </div>`;
}
const TEXTES_GESTE = {'plus-tot': 'fais-le commencer une demi-seconde plus tôt', 'plus-tard': 'fais-le commencer une demi-seconde plus tard', 'plus-court': 'raccourcis-le d’un tiers', 'plus-long': 'rallonge-le d’un tiers',
  'moins-fort': 'baisse son volume d’environ 4 dB', 'plus-fort': 'monte son volume d’environ 3 dB', 'plus-gros': 'rends-le plus gros et plus visible', 'plus-discret': 'rends-le plus discret', retirer: 'retire-le'};
function ajouterReglage(b, texte) {
  ui.reglagesIA.push({bloc: b.id, nom: b.nom, de: b.debut_s, a: b.debut_s + b.duree_s, texte: String(texte).slice(0, 300)});
  if (ui.reglagesIA.length > 20) ui.reglagesIA.shift();
  rendreBlocsIA();
  rendreInspecteur();
}
$('#inspecteur').addEventListener('click', (e) => {
  const b = ui.blocIA ? blocIA(ui.blocIA) : null;
  if (!b) return;
  const g = e.target.closest('[data-geste]')?.dataset.geste;
  if (g) return ajouterReglage(b, TEXTES_GESTE[g]);
  const a = e.target.closest('[data-bloc-act]')?.dataset.blocAct;
  if (!a) return;
  if (a === 'ajouter') {
    const demande = $('#bloc-demande').value.trim();
    const texte = $('#bloc-texte')?.value.trim();
    const lignes = [...(texte != null && texte !== (b.texte ?? '').trim() ? [`remplace le texte par « ${texte} »`] : []), ...(demande ? [demande] : [])];
    if (!lignes.length) return $('#bloc-demande').focus();
    return ajouterReglage(b, lignes.join(' ; '));
  }
  if (a === 'oter') { ui.reglagesIA.splice(Number(e.target.closest('[data-i]').dataset.i), 1); rendreBlocsIA(); return rendreInspecteur(); }
  ui.blocIA = null;
  rendreBlocsIA();
  rendreInspecteur();
  if (a === 'envoyer') envoyerDemande();
});
/** Les réglages demandés sur des blocs, écrits pour l'IA (ils s'ajoutent au message). */
const texteReglages = () => (ui.reglagesIA.length
  ? `Réglages demandés sur la table de montage (applique exactement ceux-ci, garde tout le reste à l’identique, puis remets rendu/timeline.json à jour) :\n${ui.reglagesIA.map((r) => `- bloc « ${r.nom} » [${r.bloc}] (${tempsFin(r.de)} → ${tempsFin(r.a)}) : ${r.texte}`).join('\n')}` : '');

$('#piste-claude').addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  e.stopPropagation();
  const c = ui.claude;
  if (c?.en_cours && dernierRendu(c)) return montrerVue('direct');
  if (!c?.versions.length) return;
  if (ui.vue !== 'claude') montrerVue('claude');
  const vc = $('#v-claude');
  const aller = (ev) => {
    const t = Math.max(0, tempsDepuisX(ev.clientX));
    vc.currentTime = Math.min(t, Number.isFinite(vc.duration) ? Math.max(0, vc.duration - 0.05) : t);
    majTete();
  };
  aller(e);
  window.addEventListener('pointermove', aller);
  window.addEventListener('pointerup', () => window.removeEventListener('pointermove', aller), {once: true});
});

// =====================================================================
// Créer avec ElevenLabs : musiques, voix off, dialogues, bruitages, voix nettoyées, doublages, images et vidéos.
// Tout se range dans le projet ; un clic le met dans les médias, et Claude reçoit les créations prêtes.
// =====================================================================
const ICONES_STUDIO = {musique: 'note', musique_video: 'film', voix: 'voix', dialogue: 'dialogue', bruitage: 'eclair', nettoyer: 'filtre', doublage: 'globe', image: 'image', video: 'rendu'};
const COULEURS_STUDIO = {musique: '#ff9f0a', musique_video: '#ff7a3c', voix: '#30d158', dialogue: '#64d2ff', bruitage: '#ffd60a', nettoyer: '#5ac8fa', doublage: '#0a84ff', image: '#bf5af2', video: '#ff453a'};
const ECOUTE = new Audio();
ECOUTE.addEventListener('ended', () => { ui.ecoute = null; majListeStudio(); });
const creditsLisibles = (n) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('fr-FR', {maximumFractionDigits: 1})} M` : n >= 1e4 ? `${Math.round(n / 1e3)} k` : n.toLocaleString('fr-FR'));
const formatProjet = () => (P.sortie.hauteur > P.sortie.largeur ? '9:16' : P.sortie.hauteur === P.sortie.largeur ? '1:1' : '16:9');

async function chargerStudio() {
  if (!P || ui.ecran !== 'montage' || ui.remplacee || ui.chargementStudio) return;
  ui.chargementStudio = true;
  const avant = ui.studio;
  try { ui.studio = await api('GET', '/api/studio'); } catch { /* on réessaiera */ } finally { ui.chargementStudio = false; }
  const s = ui.studio;
  if (!s) return;
  clearTimeout(ui.minuterieStudio);
  const enCours = s.creations.some((x) => x.etat === 'en_cours') || s.bruitages.en_cours;
  if (enCours) ui.minuterieStudio = setTimeout(chargerStudio, 2000);
  // une création vient de finir
  for (const x of s.creations) {
    const y = avant?.creations.find((z) => z.id === x.id);
    if (y?.etat === 'en_cours' && x.etat === 'pret') { note(`« ${x.titre.slice(0, 60)} » est prête${x.cout ? ` (${x.cout.toLocaleString('fr-FR')} crédits)` : ''}.`, false, true); chargerCredits(); }
    if (y?.etat === 'en_cours' && x.etat === 'erreur') note(x.erreur ?? 'La création a échoué.', true);
  }
  if (avant?.bruitages.en_cours && !s.bruitages.en_cours) {
    if (s.bruitages.faits === s.bruitages.total) note('Les bruitages de Dérush sont en qualité ElevenLabs : aperçu et vidéos en profitent.', false, true);
    else if (s.bruitages.erreur) note(s.bruitages.erreur, true);
    chargerCredits();
  }
  rendreStudio();
}
async function chargerCredits() {
  try { ui.credits = (await api('GET', '/api/studio/credits')).credits; } catch { /* pas de réponse */ }
  const el = $('#st-credits');
  if (el) el.innerHTML = ui.credits ? `${ic('onde')}${creditsLisibles(ui.credits.restants)} crédits` : '';
}
async function chargerVoix() {
  if (ui.voix || ui.chargementVoix) return;
  ui.chargementVoix = true;
  try { ui.voix = (await api('GET', '/api/studio/voix')).voix; } catch (e) { ui.voix = []; note(e.message, true); } finally { ui.chargementVoix = false; }
  rendreStudio(true);
}
function defautsStudio(type) {
  const duree = Math.round(Math.min(300, Math.max(5, seq.duree ? seq.duree + 1 : 30)));
  return {
    musique: {prompt: '', duree_s: duree, instrumental: true},
    musique_video: {source: '', prompt: '', bruitages: false},
    voix: {texte: '', voix: '', emotions: false},
    dialogue: {repliques: [{voix: '', texte: ''}, {voix: '', texte: ''}]},
    bruitage: {prompt: '', duree_s: '', boucle: false},
    nettoyer: {source: ''},
    doublage: {source: '', langue: 'en'},
    image: {prompt: '', format: formatProjet(), modele: 'gemini-3.1-flash-image', image: ''},
    video: {prompt: '', format: formatProjet(), duree_s: 6, modele: 'bytedance-seedance-v2-fast', image: '', son: false},
  }[type];
}
/** Les champs du formulaire d'une création. */
function champsStudio(type, s) {
  const v = (ui.studioForm[type] ??= defautsStudio(type));
  const zone = (nom, titre, aide, rows = 3) => `<label class="champ"><span>${titre}</span><textarea name="${nom}" rows="${rows}" placeholder="${esc(aide)}">${esc(v[nom] ?? '')}</textarea></label>`;
  const coche = (nom, titre) => `<label class="st-coche"><input type="checkbox" name="${nom}"${v[nom] ? ' checked' : ''}><span>${titre}</span></label>`;
  const choix = (nom, titre, entrees) => `<label class="champ"><span>${titre}</span><select name="${nom}">${entrees.map(([k, t]) => option(k, t, String(k) === String(v[nom]))).join('')}</select></label>`;
  const sources = (genres, titre, vide = null) => {
    const l = s.sources.filter((x) => genres.includes(x.genre));
    if (!l.length && !vide) return `<p class="st-vide">${ic('attention')}Il faut d’abord ${genres.includes('son') ? 'une vidéo ou un son' : 'une vidéo'} dans le projet : importe-la, joins-la à la conversation, ou prends une vidéo de l’IA.</p>`;
    if (!vide && !l.some((x) => x.cle === v.source)) v.source = l[0].cle;
    return choix(vide ? 'image' : 'source', titre, [...(vide ? [['', vide]] : []), ...l.map((x) => [x.cle, `${x.origine} · ${x.nom}`])]);
  };
  const voix = ui.voix;
  if (['voix', 'dialogue'].includes(type) && !voix) chargerVoix();
  const listeVoix = (voix ?? []).map((x) => [x.id, `${x.nom}${x.description ? ` — ${x.description}` : ''}${x.fr ? '' : ' (anglais)'}`]);
  if (type === 'voix' && voix?.length && !voix.some((x) => x.id === v.voix)) v.voix = voix[0].id;
  if (type === 'dialogue' && voix?.length) v.repliques.forEach((r, i) => { if (!voix.some((x) => x.id === r.voix)) r.voix = voix[i % voix.length].id; });
  if (type === 'musique') return `${zone('prompt', 'Décris la musique', 'Hip-hop énergique, basse ronde, 95 BPM, pour une vidéo de quartier qui donne la pêche…', 4)}
    <label class="champ"><span>Durée : <b data-val="duree_s">${v.duree_s} s</b></span><input type="range" name="duree_s" min="5" max="300" step="1" value="${v.duree_s}"></label>${coche('instrumental', 'Sans paroles')}`;
  if (type === 'musique_video') return `${sources(['video'], 'La vidéo')}${zone('prompt', 'Ambiance voulue (facultatif)', 'Électro sombre qui monte jusqu’à la fin…', 3)}${coche('bruitages', 'Ajouter aussi les bruitages de la vidéo')}
    <p class="st-aide">ElevenLabs regarde la vidéo et compose une musique qui suit ses coupes (10 min au plus).</p>`;
  if (type === 'voix') return `${zone('texte', 'Le texte à dire', 'Bienvenue à Persan ! Aujourd’hui, on vous emmène…', 5)}
    ${voix ? (voix.length ? choix('voix', 'La voix', listeVoix) : '<p class="st-vide">Aucune voix disponible.</p>') : '<p class="st-aide">Chargement des voix…</p>'}${coche('emotions', 'Avec émotions : balises [excited], [whispers], [laughs] dans le texte')}`;
  if (type === 'dialogue') return `<div class="st-repliques">${v.repliques.map((r, i) => `<div class="st-replique" data-i="${i}"><select data-replique="voix" data-i="${i}">${listeVoix.map(([k, t]) => option(k, t, k === r.voix)).join('')}</select><textarea data-replique="texte" data-i="${i}" rows="2" placeholder="Réplique ${i + 1}…">${esc(r.texte)}</textarea>${v.repliques.length > 1 ? `<button type="button" class="icone-btn" data-st="moins-replique" data-i="${i}" title="Retirer">${ic('fermer')}</button>` : ''}</div>`).join('')}</div>
    <button type="button" class="btn petit" data-st="plus-replique">${ic('plus')}Réplique</button>${voix ? '' : '<p class="st-aide">Chargement des voix…</p>'}`;
  if (type === 'bruitage') return `${zone('prompt', 'Décris le son', 'Impact sourd et puissant avec une basse profonde, très court…', 3)}
    ${choix('duree_s', 'Durée', [['', 'Automatique'], ...[0.5, 1, 2, 3, 5, 8, 10, 15, 20, 30].map((d) => [d, `${String(d).replace('.', ',')} s`])])}${coche('boucle', 'Qui boucle (une ambiance)')}`;
  if (type === 'nettoyer') return `${sources(['video', 'son'], 'La voix à nettoyer')}<p class="st-aide">Enlève le bruit, la musique et l’écho autour de la voix. Le résultat est un son, à poser sous la vidéo.</p>`;
  if (type === 'doublage') return `${sources(['video', 'son'], 'À doubler')}${choix('langue', 'En', Object.entries(s.langues))}<p class="st-aide">La vidéo traduite, avec les mêmes voix. Cela peut prendre plusieurs minutes.</p>`;
  if (type === 'image') {
    const M = s.modeles_image[v.modele] ?? Object.values(s.modeles_image)[0];
    return `${zone('prompt', 'Décris l’image', 'Une rue de Persan au coucher du soleil, style affiche, couleurs chaudes, sans personne…', 4)}
    <div class="deux">${choix('format', 'Format', M.formats.map((f) => [f, f]))}${choix('modele', 'Modèle', Object.entries(s.modeles_image).map(([k, x]) => [k, x.nom]))}</div>${sources(['image'], 'Image de référence', 'Aucune')}`;
  }
  if (type === 'video') {
    const M = s.modeles_video[v.modele] ?? Object.values(s.modeles_video)[0];
    return `${zone('prompt', 'Décris le plan', 'Travelling lent au ras du sol dans une rue mouillée la nuit, néons qui se reflètent…', 4)}
    <div class="deux">${choix('format', 'Format', M.formats.map((f) => [f, f]))}${choix('duree_s', 'Durée', M.durees.map((d) => [d, `${d} s`]))}</div>${choix('modele', 'Modèle', Object.entries(s.modeles_video).map(([k, x]) => [k, x.nom]))}
    ${sources(['image'], 'Image de départ', 'Aucune')}${coche('son', 'Avec le son du plan')}<p class="st-aide attention">${ic('attention')}Un plan vidéo coûte beaucoup plus de crédits qu’un son : quelques secondes suffisent.</p>`;
  }
  return '';
}
function itemCreation(x) {
  const couleur = COULEURS_STUDIO[x.type] ?? '#888';
  const vig = x.etat === 'pret' && x.type === 'image'
    ? `<span class="st-vig image" style="background-image:url('${urlCreation(x.id)}')" data-st="voir" data-id="${x.id}"></span>`
    : `<span class="st-vig" style="--c:${couleur}" ${x.etat === 'pret' ? `data-st="${['video', 'doublage'].includes(x.type) ? 'voir' : 'ecouter'}" data-id="${x.id}"` : ''}>${x.etat === 'pret' && !['video', 'doublage'].includes(x.type) ? ic(ui.ecoute === x.id ? 'pause' : 'lire', 'plein') : x.etat === 'pret' ? ic('lire', 'plein') : ic(ICONES_STUDIO[x.type] ?? 'onde')}</span>`;
  const infos = [x.type_lisible, x.duree ? dureeLisible(x.duree) : null, x.largeur ? `${x.largeur}×${x.hauteur}` : null, x.cout > 0 ? `${x.cout.toLocaleString('fr-FR')} crédits` : null].filter(Boolean).join(' · ');
  const bas = x.etat === 'en_cours' ? `<div class="st-jauge"><i style="width:${Math.max(4, Math.round((x.progression ?? 0) * 100))}%"></i></div>`
    : x.etat === 'erreur' ? `<small class="st-erreur">${esc(x.erreur ?? 'Échec.')}</small>` : `<small>${esc(infos)}</small>`;
  const actions = x.etat === 'pret' ? `<button class="icone-btn" data-st="aux-medias" data-id="${x.id}" title="Mettre dans mes médias (puis la glisser sur la timeline)">${ic('importer')}</button>${ui.claude?.drive?.synchronise ? `<button class="icone-btn" data-st="drive" data-id="${x.id}" title="Envoyer sur mon Google Drive">${ic('nuage')}</button>` : ''}` : '';
  return `<div class="st-item ${x.etat}" style="--c:${couleur}">${vig}<div class="txt"><b title="${esc(x.titre)}">${esc(x.titre)}</b>${bas}</div>${actions}${x.etat !== 'en_cours' ? `<button class="icone-btn" data-st="supprimer" data-id="${x.id}" title="Supprimer">${ic('poubelle')}</button>` : ''}</div>`;
}
function majListeStudio() {
  const s = ui.studio;
  const box = $('#st-liste');
  if (!s || !box) return;
  box.innerHTML = s.creations.length ? s.creations.map(itemCreation).join('') : `<p class="st-vide doux">${ic('etincelle', 'plein')}Rien pour l’instant. Ce que tu crées ici apparaît dans cette liste, et ton IA le reçoit avec ton prochain message.</p>`;
  const b = s.bruitages;
  $('#st-bruitages').innerHTML = `<div class="st-carte"><span class="st-vig" style="--c:#ffd60a">${ic('eclair')}</span><div class="txt"><b>Les bruitages de Dérush</b><small>${b.faits === b.total ? `En qualité ElevenLabs${b.cout ? ` (${b.cout.toLocaleString('fr-FR')} crédits)` : ''} : transitions et titres sonnent mieux, dans l’aperçu comme dans les vidéos.` : 'Les 7 sons des transitions et des titres, refaits en qualité ElevenLabs. Une seule fois, pour tous tes projets.'}</small>
    ${b.en_cours ? `<div class="st-jauge"><i style="width:${Math.max(5, Math.round((b.progression ?? 0) * 100))}%"></i></div>` : b.faits === b.total ? '<button class="btn petit" data-st="bruitages-origine">Revenir aux sons d’origine</button>' : `<button class="btn petit claude" data-st="bruitages">${ic('etincelle', 'plein')}<span>Refaire avec ElevenLabs</span></button>`}${b.erreur ? `<small class="st-erreur">${esc(b.erreur)}</small>` : ''}</div></div>`;
}
/** L'onglet « Créer ». force : redessiner le formulaire même si le type n'a pas changé. */
function rendreStudio(force = false) {
  const box = $('#p-creer');
  if (!P || box.classList.contains('cache')) return;
  const s = ui.studio;
  if (!s) { if (!box.innerHTML) box.innerHTML = `<div class="st-tete"><h2>Créer <em>avec ElevenLabs</em></h2></div><p class="st-aide">Chargement…</p>`; return; }
  const type = s.studio[ui.studioType] ? ui.studioType : 'musique';
  const cle = JSON.stringify([s.elevenlabs.ok, s.elevenlabs.attente, type, s.sources.map((x) => x.cle), !!ui.voix]);
  if (box.dataset.cle !== cle || force) {
    box.dataset.cle = cle;
    const tete = `<div class="st-tete"><h2>Créer <em>avec ElevenLabs</em></h2><span class="st-credits" id="st-credits">${ui.credits ? `${ic('onde')}${creditsLisibles(ui.credits.restants)} crédits` : ''}</span></div>`;
    if (!s.elevenlabs.ok) {
      box.innerHTML = `${tete}<div class="st-brancher">${ic('onde')}<b>Branche ElevenLabs</b><p>Musiques, voix off, dialogues, bruitages, voix nettoyées, doublages, images et vidéos : tout se crée ici, et ton IA s’en sert pour monter.</p><p class="dim">${esc(s.elevenlabs.pourquoi ?? '')}</p>${s.elevenlabs.attente ? '<span class="etiq">En attente de ton accord dans le navigateur…</span>' : '<button class="btn principal" data-st="brancher">Brancher</button>'}</div>`;
      return;
    }
    const types = Object.entries(s.studio).map(([k, x]) => `<button type="button" data-type="${k}"${k === type ? ' class="actif"' : ''} style="--c:${COULEURS_STUDIO[k]}" title="${esc(x.aide)}"><span>${ic(ICONES_STUDIO[k] ?? 'onde')}</span><b>${esc(x.nom)}</b></button>`).join('');
    box.innerHTML = `${tete}<div class="st-types">${types}</div>
      <form class="st-form" id="st-form" data-type="${type}" style="--c:${COULEURS_STUDIO[type]}"><p class="st-aide">${esc(s.studio[type].aide)}</p>${champsStudio(type, s)}
      <button class="btn claude grand" type="submit">${ic('etincelle', 'plein')}<span>Créer</span></button></form>
      <div class="st-section"><h3>${ic('calques')}Tes créations</h3></div><div class="st-liste" id="st-liste"></div><div id="st-bruitages"></div>`;
    if (!ui.credits) chargerCredits();
  }
  majListeStudio();
}
$('#p-creer').addEventListener('click', async (e) => {
  const t = e.target.closest('[data-type]');
  if (t) { ui.studioType = t.dataset.type; prefs.ecrire('studio.type', ui.studioType); return rendreStudio(true); }
  const act = e.target.closest('[data-st]')?.dataset.st;
  const id = e.target.closest('[data-id]')?.dataset.id;
  const x = ui.studio?.creations.find((y) => y.id === id);
  const f = ui.studioForm.dialogue;
  try {
    if (act === 'plus-replique') { f.repliques.push({voix: ui.voix?.[f.repliques.length % Math.max(1, ui.voix?.length ?? 1)]?.id ?? '', texte: ''}); return rendreStudio(true); }
    if (act === 'moins-replique') { f.repliques.splice(Number(e.target.closest('[data-i]').dataset.i), 1); return rendreStudio(true); }
    if (act === 'brancher') {
      await api('POST', '/api/elevenlabs/brancher');
      note('Une page ElevenLabs s’ouvre dans ton navigateur : connecte-toi et clique « Autoriser ».');
      suivreBranchement();
      return chargerStudio();
    }
    if (act === 'ecouter' && x) {
      if (ui.ecoute === x.id && !ECOUTE.paused) { ECOUTE.pause(); ui.ecoute = null; } else { ECOUTE.src = urlCreation(x.id); ECOUTE.play().catch(() => {}); ui.ecoute = x.id; }
      return majListeStudio();
    }
    if (act === 'voir' && x) {
      ECOUTE.pause();
      ui.ecoute = null;
      const g = feuille(`<h3>${esc(x.titre)}</h3><p class="sous-titre">${esc([x.type_lisible, x.duree ? dureeLisible(x.duree) : null, x.largeur ? `${x.largeur}×${x.hauteur}` : null].filter(Boolean).join(' · '))}</p>
        ${x.type === 'image' ? `<img class="apercu-grand" src="${urlCreation(x.id)}" alt="">` : `<video class="apercu-grand" src="${urlCreation(x.id)}" controls autoplay playsinline></video>`}
        <div class="pied"><button class="btn" data-medias>${ic('importer')}Mettre dans mes médias</button><span class="espace"></span><button class="btn principal" data-fermer>OK</button></div>`, true);
      g.addEventListener('click', async (ev) => {
        if (ev.target.closest('[data-fermer]')) return fermerFeuille();
        if (ev.target.closest('[data-medias]')) { fermerFeuille(); await creationAuxMedias(x); }
      });
      return;
    }
    if (act === 'aux-medias' && x) return await creationAuxMedias(x);
    if (act === 'drive' && x) { const r = await api('POST', '/api/drive/envoyer', {creation: x.id}); return note(`Copiée dans ton Google Drive : ${r.dossier}.`, false, true); }
    if (act === 'supprimer' && x) {
      if (!confirm(`Supprimer « ${x.titre.slice(0, 60)} » ? Le fichier est effacé du projet.`)) return;
      if (ui.ecoute === x.id) { ECOUTE.pause(); ui.ecoute = null; }
      await api('DELETE', `/api/studio/creations/${x.id}`);
      return chargerStudio();
    }
    if (act === 'bruitages') {
      if (!confirm('Refaire les 7 bruitages de Dérush avec ElevenLabs ? Cela prend une minute et quelques crédits ; ils serviront à tous tes projets.')) return;
      await api('POST', '/api/studio/bruitages');
      return chargerStudio();
    }
    if (act === 'bruitages-origine') { await api('DELETE', '/api/studio/bruitages'); note('Dérush reprend ses bruitages d’origine.'); return chargerStudio(); }
  } catch (err) { note(err.message, true); }
});
async function creationAuxMedias(x) {
  try {
    await api('POST', `/api/studio/creations/${x.id}/medias`);
    await rafraichirMedias();
    note(`« ${x.titre.slice(0, 50)} » est dans tes médias : glisse-la sur la timeline.`);
  } catch (err) { note(err.message, true); }
}
$('#p-creer').addEventListener('input', (e) => {
  const form = e.target.closest('#st-form');
  if (!form) return;
  const v = (ui.studioForm[form.dataset.type] ??= defautsStudio(form.dataset.type));
  const t = e.target;
  if (t.dataset.replique) { v.repliques[Number(t.dataset.i)][t.dataset.replique] = t.value; return; }
  if (!t.name) return;
  v[t.name] = t.type === 'checkbox' ? t.checked : t.type === 'range' ? Number(t.value) : t.value;
  if (t.type === 'range') { const b = $(`[data-val="${t.name}"]`, form); if (b) b.textContent = `${t.value} s`; }
  // un autre modèle n'a pas les mêmes formats ni les mêmes durées
  if (t.name === 'modele') rendreStudio(true);
});
$('#p-creer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const type = form.dataset.type;
  const v = {...(ui.studioForm[type] ??= defautsStudio(type))};
  const corps = {type, ...v};
  if (type === 'voix') corps.modele = v.emotions ? 'eleven_v3' : 'eleven_v4';
  if (type === 'bruitage') corps.duree_s = v.duree_s === '' ? null : Number(v.duree_s);
  if (['image', 'video'].includes(type) && !v.image) delete corps.image;
  const b = $('button[type="submit"]', form);
  b.disabled = true;
  try {
    await api('POST', '/api/studio/creer', corps);
    note('C’est parti : ta création apparaît dans la liste dès qu’elle est prête.');
    await chargerStudio();
  } catch (err) { note(err.message, true); } finally { b.disabled = false; }
});

// ——— Suivi des traitements ———
async function rafraichirMedias() {
  const r = await api('GET', '/api/file');
  const avantFile = SRV.file;
  SRV.file = r.file;
  // une installation vient de finir : on relit l'état des moteurs
  if (avantFile?.en_cours?.meta?.type === 'installation' && !r.file.en_cours) SRV.moteurs = await api('GET', '/api/moteurs').catch(() => SRV.moteurs);
  // un détourage vient de finir : les masques qui manquaient sont peut-être là
  if (avantFile?.en_cours?.meta?.type === 'detourage' && r.file.en_cours?.id !== avantFile.en_cours.id) { SRV.moteurs = await api('GET', '/api/moteurs').catch(() => SRV.moteurs); oublierMasquesAbsents(); if (ui.sel) rendreInspecteur(); if (!prog.lecture) majHabillage(); }
  if (!P) return;
  const avant = new Map(P.medias.map((m) => [m.id, m]));
  P.medias = r.medias;
  if (P.sortie.auto && r.medias.some((m) => !avant.has(m.id) || (!avant.get(m.id).largeur && m.largeur))) appliquerFormatAuto();
  for (const m of P.medias) {
    const a = avant.get(m.id);
    const change = !a || a.etat !== m.etat || JSON.stringify(a.etapes) !== JSON.stringify(m.etapes) || a.voix?.cree_le !== m.voix?.cree_le
      || (a.vignettes && cleVignettes(a.vignettes)) !== (m.vignettes && cleVignettes(m.vignettes));
    const texte = a?.transcription?.cree_le !== m.transcription?.cree_le;
    if (change || texte) {
      oublier(m.id);
      if (ui.src.id === m.id) {
        if (m.type === 'video' && m.etapes?.proxy === true && a?.etapes?.proxy !== true) {
          const t = vRush.currentTime;
          vRush.src = urlMedia(m.id, 'lecture');
          vRush.currentTime = t;
        }
        Promise.all(['ondes', 'analyse', 'mots', 'cadrage'].map((k) => charger(k, m))).then(() => { if (texte) rendreTexte(); majSourceUI(); });
      }
      // le proxy vient d'arriver : un lecteur qui n'avait pas pu lire l'original (format rare) le recharge
      if (m.type === 'video' && m.etapes?.proxy === true && a?.etapes?.proxy !== true) {
        for (const v of [...PV, vDessus]) if (v.error && v.dataset.media?.startsWith(`${m.id}:`)) delete v.dataset.media;
        if (!prog.lecture && ui.mode === 'montage') progAfficher();
      }
      if ([...P.montage, ...P.superpositions].some((it) => it.media === m.id)) rendreTimeline();
      if (ui.sel) rendreInspecteur();
    }
  }
  rendreRushes();
  majTaches();
}
let suiviEnCours = false;
async function suivreFile() {
  if (suiviEnCours || ui.ecran !== 'montage') return;
  suiviEnCours = true;
  try {
    await rafraichirMedias();
    if (ui.renduTache) {
      const f = SRV.file;
      const t = [f.en_cours, ...f.attente, ...f.recents].find((x) => x && x.id === ui.renduTache);
      if (t && (t.etat === 'fini' || t.etat === 'erreur')) afficherRendu(t);
      else if (t) {
        const j = $('#jauge-rendu');
        if (j) j.style.width = `${Math.max(2, Math.round(t.progression * 100))}%`;
        const s = $('#etat-rendu');
        if (s) s.textContent = t.etat === 'attente' ? 'En attente de la fin des autres traitements…' : `${Math.round(t.progression * 100)} %`;
      }
    }
    if (ui.exportTache) {
      const f = SRV.file;
      const t = [f.en_cours, ...f.attente, ...f.recents].find((x) => x && x.id === ui.exportTache);
      if (t && (t.etat === 'fini' || t.etat === 'erreur')) afficherExport(t);
      else if (t) {
        const j = $('#jauge-export');
        if (j) j.style.width = `${Math.max(2, Math.round(t.progression * 100))}%`;
        const s = $('#etat-export');
        if (s) s.textContent = t.etat === 'attente' ? 'En attente de la fin des autres traitements…' : `${Math.round(t.progression * 100)} %`;
      }
    }
  } catch { /* serveur arrêté : on réessaiera */ } finally {
    suiviEnCours = false;
  }
}

// ——— Boucle d'affichage ———
function boucle() {
  if (ui.ecran === 'montage' && ui.vue === 'claude' && !$('#v-claude').paused) {
    majTete();
    const x = ($('#v-claude').currentTime || 0) * ui.pps;
    if (x < TL.scrollLeft + 20 || x > TL.scrollLeft + TL.clientWidth - 60) TL.scrollLeft = Math.max(0, x - TL.clientWidth * 0.15);
  }
  if (ui.ecran === 'montage' && ui.mode === 'rush' && !vRush.paused && ui.src.id) {
    const m = media(ui.src.id);
    const t = vRush.currentTime;
    if (m && (t > ui.src.vue1 || t < ui.src.vue0)) {
      const span = ui.src.vue1 - ui.src.vue0;
      ui.src.vue0 = borner(t - span * 0.1, 0, Math.max(0, m.duree - span));
      ui.src.vue1 = ui.src.vue0 + span;
    }
    majSourceUI();
  }
  requestAnimationFrame(boucle);
}
window.addEventListener('resize', () => { if (ui.ecran === 'montage') { dessinerBande(); dessinerOndeGrande(); rendreTimeline(); majCadre(); majScene(); } });
window.addEventListener('focus', () => { if (ui.ecran === 'montage') { chargerRetours(); if (!ui.claude?.en_cours) chargerClaude(); } });

// ——— Une seule fenêtre à la fois ———
// La fenêtre la plus récente prend la main : les autres enregistrent, se mettent en pause et se ferment.
// Le serveur refuse de toute façon les modifications d'une ancienne fenêtre (par exemple endormie par Chrome).
const canal = 'BroadcastChannel' in window ? new BroadcastChannel('derush') : null;
let fenetreSignalee = false;
/** Prévient Dérush que cette fenêtre se ferme : il s'arrête quand la dernière est fermée. */
function signalerFermeture() {
  if (fenetreSignalee) return;
  fenetreSignalee = true;
  navigator.sendBeacon?.(`/api/fenetre-fermee?j=${encodeURIComponent(JETON)}&f=${encodeURIComponent(FENETRE)}`);
}
window.addEventListener('pagehide', signalerFermeture);
canal?.addEventListener('message', (e) => {
  if (e.data?.type !== 'bonjour' || e.data.f === FENETRE || ui.remplacee) return;
  // message reçu à temps : on enregistre d'abord ce qui attend ; reçu en retard (fenêtre endormie) : on n'écrit plus rien
  const aTemps = Date.now() - (e.data.t ?? 0) < 1500;
  const envoi = aTemps && P ? sauver(true) : Promise.resolve();
  ui.remplacee = true;
  Promise.resolve(envoi).catch(() => {}).finally(() => {
    canal.postMessage({type: 'cede', f: FENETRE});
    mettreEnPause();
  });
});
/** Prévient les autres fenêtres Dérush ouvertes et leur laisse le temps d'enregistrer (0,6 s au plus). */
async function prendreLaMain() {
  if (!canal) return;
  const autres = await fetch('/api/ping').then((r) => r.json()).then((j) => j.fenetres > 0).catch(() => false);
  await new Promise((ok) => {
    const fin = setTimeout(ok, autres ? 600 : 0);
    canal.addEventListener('message', (e) => { if (e.data?.type === 'cede') { clearTimeout(fin); ok(); } });
    canal.postMessage({type: 'bonjour', f: FENETRE, t: Date.now()});
  });
}

/** L'état des moteurs (IA, Whisper…) n'était pas encore connu à l'ouverture : il arrive ici, sans rien bloquer. */
function completerMoteurs() {
  if (!SRV.moteurs_en_attente) return;
  api('GET', '/api/moteurs').then((mo) => {
    SRV.moteurs = mo;
    SRV.moteurs_en_attente = false;
    if (ui.ecran === 'montage' && P) { $('#grille-medias').dataset.cle = ''; rendreRushes(); }
  }).catch(() => {});
}
async function demarrer() {
  await prendreLaMain();
  const e = await api('GET', '/api/etat');
  SRV = e;
  completerMoteurs();
  if (e.mode === 'projet') await demarrerEditeur();
  else await afficherBibliotheque();
  setInterval(() => { if (!ui.remplacee && (SRV.file?.en_cours || SRV.file?.attente?.length || ui.exportTache || ui.renduTache)) suivreFile(); }, 900);
  setInterval(() => { if (ui.remplacee) return; if (ui.ecran === 'montage') suivreFile(); else api('POST', '/api/signe').catch(() => {}); }, 6000);
  setInterval(() => { if (!ui.remplacee && ui.ecran === 'montage') chargerRetours(); }, 20000);
  requestAnimationFrame(boucle);
}
// ——— Avant de publier (analyse de viralité, partage, Treg) et le tutoriel : deux écrans à part (publication.js, tuto.js) ———
/** Met une demande dans le message à l'IA (la personne la relit, puis l'envoie). */
function demanderIA(texte) {
  montrerClaude(true);
  ui.brouillon = texte;
  const zone = $('#cl-texte');
  if (zone) { zone.value = texte; zone.dispatchEvent(new Event('input', {bubbles: true})); majEnvoi(); zone.focus(); zone.scrollTop = zone.scrollHeight; }
  note(`Relis la demande, puis envoie-la à ${nomIA()}.`);
}
/** La mise en route et « Mon profil de créateur » (public/createur.js). */
const CR = creerCreateur({
  api, note, esc, ic, ill, logo,
  feuille: (html, large) => feuille(html, large), fermerFeuille: () => fermerFeuille(), feuilleOuverte: () => feuilleOuverte(),
  nomIA: (m) => nomIA(m), moteurIA: () => moteurIA(),
  connexions: () => feuilleConnexions(), guideTreg: (apres) => PUB.guideTreg(apres),
});
const PUB = creerPublication({
  api, note, esc, ic, ill, logo, JETON, NATIF, natif, copierTexte,
  feuille: (html, large) => feuille(html, large), fermerFeuille: () => fermerFeuille(), feuilleOuverte: () => feuilleOuverte(),
  prefs: {lire: (k, d) => prefs.lire(k, d), ecrire: (k, v) => prefs.ecrire(k, v)},
  nomIA: () => nomIA(), iaPrete: () => iaPrete(), qualiteIA: () => qualiteIA(), nomQualite: () => (qualiteIA() === 'rapide' ? 'Rapide' : 'Soigné'), claude: () => ui.claude,
  connexions: () => feuilleConnexions(),
  demanderIA,
  lirePressePapiers: () => (NATIF ? demanderNatif('coller') : navigator.clipboard.readText()),
  /** Publie avec les textes relus dans « Partager » (le serveur reprend ceux du plan enregistré). */
  publier: async ({video, reseaux, visibilite}) => {
    await api('POST', '/api/claude/demander', {moteur: moteurIA(), qualite: qualiteIA(), publier: {video, reseaux, visibilite, avec_plan: true}});
    montrerClaude();
    note(`${nomIA()} publie ta vidéo : suis-le dans la colonne de droite.`);
    await chargerClaude();
  },
  surFermeture: () => { if (ui.ecran === 'montage' && !ui.claude?.en_cours) chargerClaude(); },
});
const feuilleViralite = () => PUB.ouvrir(null, 'analyse');
const feuillePartager = () => PUB.ouvrir(null, 'partage');
const TUTO = creerTutoriel({api, esc, ic, ill, logo, nomIA: () => nomIA()});
/** Le tutoriel animé : à la première ouverture, puis quand on le redemande (menu Aide, bouton « ? »). */
function tutoriel(auto = false) {
  if (auto && (SRV.reglages?.tuto_vu || ui.tutoMontre || feuilleOuverte())) return;
  ui.tutoMontre = true;
  TUTO.ouvrir({surFin: () => {
    api('POST', '/api/reglages/interface', {tuto_vu: true}).catch(() => {});
    SRV.reglages = {...(SRV.reglages ?? {}), tuto_vu: true};
    if (ui.ecran === 'biblio') proposerConnexions();
  }});
}

// Une petite porte d'entrée pour piloter l'interface depuis la console du navigateur (essais, automatisation).
window.derush = {
  aller: (t) => { progPause(); if (ui.mode !== 'montage') definirMode('montage'); progPositionner(t); },
  lire: () => progLire(), pause: () => progPause(), temps: () => prog.t, duree: () => seq.duree,
  ajouterEffet: (modele, t = null) => ajouterEffet(modele, t), selectionner: (id) => selectionner({type: indication(id) ? 'indic' : 'item', id}),
  projet: () => P, style: () => styleDuProjet(),
  importer: async (chemins) => { const r = await api('POST', '/api/medias', {chemins}); await rafraichirMedias(); return r; },
  claude: () => ui.claude, ecrire: (texte) => { montrerClaude(); ui.brouillon = texte; const ta = $('#cl-texte'); if (ta) { ta.value = texte; majEnvoi(); } }, envoyer: () => envoyerDemande(),
  vue: (v, n, k) => montrerVue(v, n, k), ui: () => ui,
  publication: (nom, onglet) => PUB.ouvrir(nom, onglet), guideTreg: () => PUB.guideTreg(), tutoriel: () => tutoriel(),
  api: (methode, url, corps) => api(methode, url, corps), // les appels au serveur, comme l'interface les fait (essais)
  // le zoom appliqué tout de suite (pour mesurer son coût dans les essais)
  zoomer: (v, centre) => { zoomer(v, centre); appliquerZoom(); },
  joindre: (chemins) => joindreChemins(chemins), studio: () => ui.studio, creerOnglet: () => choisirPanneau('creer'),
  // — pour la fenêtre native (outils/coque-mac.swift) —
  /** Avant de quitter : on enregistre, et on dit si un travail est en cours (rendu, IA). */
  avantDeQuitter: async () => {
    try { if (P) await sauver(true); } catch { /* rien à enregistrer */ }
    let occupe = !!(SRV.file?.en_cours || SRV.file?.attente?.length || ui.claude?.en_cours);
    try { occupe = !!(await fetch('/api/ping').then((r) => r.json())).occupe; } catch { /* serveur arrêté */ }
    return {occupe};
  },
  eteindre: () => api('POST', '/api/quitter').catch(() => {}),
  /** Des fichiers posés sur l'icône de Dérush : importés dans le projet ouvert. */
  ouvrirFichiers: (chemins) => (P && ui.ecran === 'montage' ? importerChemins(chemins) : note('Ouvre d’abord un projet : tes fichiers iront dedans.')),
  /** Les menus de l'app (Fichier, Présentation, Aide…). */
  menu: (action) => {
    const projet = () => (P && ui.ecran === 'montage' ? true : (note('Ouvre d’abord un projet.'), false));
    const M = {
      reglages: () => feuilleReglages(), connexions: () => feuilleConnexions(), aide: () => feuilleAide(), tutoriel: () => tutoriel(),
      profil: () => CR.ouvrir(), accueil: () => CR.accueil(),
      nouveau: async () => { if (P) { await sauver(true).catch(() => {}); } feuilleNouveauProjet(); },
      bibliotheque: () => { if (ui.ecran === 'montage') $('#b-biblio').click(); },
      importer: () => projet() && feuilleImporter(),
      'creer-video': () => projet() && feuilleCreer(),
      viralite: () => projet() && feuilleViralite(),
      partager: () => projet() && feuillePartager(),
      dossier: () => projet() && api('POST', '/api/ouvrir', {chemin: SRV.racine}).catch((e) => note(e.message, true)),
      ia: () => projet() && montrerClaude(true),
      'tout-voir': () => projet() && toutVoir(),
    };
    if (feuilleOuverte() && !['aide', 'tutoriel', 'reglages', 'connexions', 'accueil'].includes(action)) fermerFeuille();
    return M[action]?.();
  },
};
demarrer().catch((err) => {
  document.body.innerHTML = `<div style="padding:40px;color:#fff;font:15px -apple-system,system-ui">Dérush n’a pas pu démarrer : ${esc(err.message)}</div>`;
});
