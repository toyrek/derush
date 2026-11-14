// Dérush — « Depuis mon Drive » : la feuille où la personne retrouve des rushes dans son Google Drive et les importe dans
// le projet. Deux façons de faire :
//   - « Demander à l'IA » : elle écrit ce qu'elle cherche (« le vendredi au Japon »). Dérush fait le plan du Drive sans
//     rien télécharger, son IA choisit les dossiers, Dérush lit le vrai jour et la vraie heure de chaque prise, puis l'IA
//     choisit les fichiers. La personne suit chaque étape, décoche ce qu'elle ne veut pas, et importe ;
//   - « Choisir moi-même » : parcourir le Drive dossier par dossier et jour par jour, cocher, importer.
// Rien ne part à l'IA sans le clic « Chercher » (la phrase « à savoir » dit ce qui part) ; rien n'est téléchargé sans
// « Importer », qui montre d'abord combien de fichiers et de Go, et la place qui restera. Le serveur fait le travail
// (lib/drive-medias.mjs, routes /api/drive/…) ; tous les textes de la recherche et de l'import viennent de lui.
//
//   const DR = creerDrive({api, note, esc, ic, ill, logo, feuille, fermerFeuille, moteurIA, nomIA, iaPrete, connexions,
//     systeme, surImportLance, surImportFini, envoyerDemande});
//   DR.ouvrir()                               la feuille, sur « Demander à l'IA »
//   DR.ouvrir({onglet: 'main'})               sur « Choisir moi-même »
//   DR.ouvrir({demande, origine})             le champ déjà rempli ; `origine` : la demande de montage qui attend ces rushes
//                                             (écrite à l'IA de montage) : elle lui sera proposée après l'import
//   o.surImportLance()                        un import commence (la carte de la colonne de l'IA le dit)
//   o.surImportFini(etat, {resume})           un import vient de finir, feuille ouverte ou non : relire les médias
//   o.envoyerDemande(message)                 envoyer la demande à l'IA de montage, les rushes étant dans le projet

/** Ce qui part à l'IA quand on clique « Chercher » (le serveur le redit dans chaque état de la recherche). */
export const A_SAVOIR = 'Dérush envoie à ton IA le plan de ton Drive (les noms des dossiers et des fichiers, leur nombre, leurs dates), jamais les fichiers eux-mêmes.';
const TOURNE = ['plan', 'ia_dossiers', 'dates', 'ia_fichiers'];
const GENRES = {video: {icone: 'film', nom: 'vidéo'}, photo: {icone: 'image', nom: 'photo'}, son: {icone: 'onde', nom: 'son'}};
const SONDAGE = 700; // la recherche et l'import, feuille ouverte
const SONDAGE_FOND = 1500; // un import qui continue, feuille fermée

// ——— petites aides, sans page (essayées par outils/essai-drive-interface.mjs) ———
/** « 1,2 Go », « 420 Mo » (comme le serveur : des milliers, pas des 1024). */
export function tailleLisible(o) {
  if (!Number.isFinite(o)) return '—';
  const u = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let i = 0;
  while (o >= 1000 && i < u.length - 1) { o /= 1000; i++; }
  return `${(Math.round(o * 10) / 10).toLocaleString('fr-FR')} ${u[i]}`;
}
const pluriel = (n, mot, mots = `${mot}s`) => `${n.toLocaleString('fr-FR')} ${n > 1 ? mots : mot}`;
const majuscule = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
/** « 12 s », « 2 min 05 » */
export const depuis = (s) => (!(Number(s) > 0) ? '' : s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')}`);
/** L'heure de la prise (« 09:15 »), si on la connaît. */
export const heureDe = (f) => (typeof f?.date?.quand === 'string' && f.date.quand.length >= 16 ? f.date.quand.slice(11, 16) : '');
/** « 0:42 », « 1:02:03 » ; rien pour une photo. */
export function dureeLisible(s) {
  if (!(Number(s) > 0)) return '';
  const t = Math.round(Number(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const z = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${z(m)}:${z(t % 60)}` : `${m}:${z(t % 60)}`;
}
/** « ven. 8 nov. » */
export function jourCourt(jour) {
  const d = new Date(`${jour}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('fr-FR', {weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'}) : String(jour ?? '');
}
/** Les fichiers rangés par jour de prise de vue, dans l'ordre où ils arrivent (le serveur les donne dans l'ordre de prise). */
export function grouperParJour(fichiers) {
  const m = new Map();
  for (const f of fichiers ?? []) {
    const cle = f?.date?.jour ?? 'inconnu';
    const g = m.get(cle) ?? {jour: cle, nom: f?.date?.nom_jour ? majuscule(f.date.nom_jour) : 'Date inconnue', fichiers: [], videos: 0, photos: 0, sons: 0, taille: 0};
    g.fichiers.push(f);
    g[{video: 'videos', photo: 'photos', son: 'sons'}[f?.genre] ?? 'videos']++;
    g.taille += Number(f?.taille) || 0;
    m.set(cle, g);
  }
  return [...m.values()];
}
/** Combien de fichiers, combien d'octets, et ce qui n'est que sur le Drive (Google Drive le téléchargera). */
export function compter(fichiers) {
  let taille = 0;
  let n = 0;
  const enLigne = {n: 0, taille: 0};
  for (const f of fichiers ?? []) {
    n++;
    taille += Number(f?.taille) || 0;
    if (f?.local === false) { enLigne.n++; enLigne.taille += Number(f.taille) || 0; }
  }
  return {n, taille, en_ligne: enLigne};
}
/** « 4 vidéos · 1 photo » */
export const comptesGenres = (x) => [x.videos && pluriel(x.videos, 'vidéo'), x.photos && pluriel(x.photos, 'photo'), x.sons && pluriel(x.sons, 'son')].filter(Boolean).join(' · ');
/** Le bouton : « Importer (6 fichiers, 1,2 Go) ». */
export const libelleImporter = (n, taille) => (n ? `Importer (${pluriel(n, 'fichier')}, ${tailleLisible(taille)})` : 'Importer');
/** « M4 à M9 » quand ils se suivent, sinon « M4, M6, M7 » (les douze premiers). */
export function listeMedias(ids) {
  const l = (ids ?? []).map(String).filter((x) => /^M\d+$/.test(x));
  if (!l.length) return '';
  if (l.length === 1) return l[0];
  const n = l.map((x) => Number(x.slice(1)));
  if (n.every((x, k) => !k || x === n[k - 1] + 1)) return `${l[0]} à ${l.at(-1)}`;
  return `${l.slice(0, 12).join(', ')}${l.length > 12 ? ` et ${l.length - 12} autres` : ''}`;
}
/**
 * La demande renvoyée à l'IA de montage après l'import : la demande d'origine, puis où sont les rushes. Sans cette ligne,
 * l'IA relirait « va dans mon Drive… » et irait les chercher elle-même dans drive/ (ses consignes le lui interdisent).
 */
export function messageApresImport(demande, {ajoutes = [], deja = 0} = {}, resume = null) {
  const t = String(demande ?? '').trim();
  const quoi = resume ? ` (${resume})` : '';
  const ids = listeMedias(ajoutes);
  const info = ids
    ? `Mes rushes viennent d’arriver de mon Drive${quoi} : ${ids}, dans l’ordre de prise de vue. Ils sont dans le projet : ne va pas les chercher dans drive/.`
    : deja ? `Mes rushes du Drive sont déjà dans le projet${quoi}. Ne va pas les chercher dans drive/.` : '';
  return [t, info].filter(Boolean).join('\n\n');
}
/** L'étape de la recherche par l'IA : 0 le plan, 1 les dossiers, 2 les dates, 3 les fichiers, 4 prêt. */
export const etapeRecherche = (etat) => ({plan: 0, ia_dossiers: 1, a_confirmer: 2, dates: 2, ia_fichiers: 3, pret: 4, dates_lues: 4}[etat] ?? -1);
/**
 * Le squelette d'un dessin : le même HTML sans ce qui bouge pendant un sondage (le texte des `data-v`, la largeur des
 * barres). Deux dessins au même squelette ne diffèrent que par ces valeurs : on les met à jour sur place, sans tout
 * redessiner (les animations ne repartent pas, la liste ne saute pas).
 */
export const squelette = (html) => String(html).replace(/<(span|small|b|i) data-v="([a-z-]+)"[^>]*>[^<]*<\/\1>/g, '<$1 data-v="$2">');

// une feuille de Drive d'où sort un plan, et le jour de la prise : l'image de la feuille
const ILL_DRIVE = `<svg viewBox="0 0 160 120" aria-hidden="true">
  <path d="M16 108h128" stroke="#3a3a44" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 9"/>
  <path d="M20 50h26l8 8h40a8 8 0 0 1 8 8v30a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V58a8 8 0 0 1 8-8z" fill="#2c2c33" stroke="#4a4a55" stroke-width="2"/>
  <path d="M38 92l7-12h14l-7 12z" fill="#0a84ff"/><path d="M52 68l7 12-7 12-7-12z" fill="#30d158" opacity=".9"/><path d="M45 80l7-12h14l7 12z" fill="#ffd60a" opacity=".85" transform="translate(-14 0)"/>
  <g class="dr-ill-sort"><rect x="58" y="16" width="56" height="38" rx="7" fill="#ff453a"/><path d="M81 27v16l13-8z" fill="#fff"/></g>
  <g class="dr-ill-cal"><rect x="110" y="56" width="38" height="42" rx="7" fill="#3a2326" stroke="#ff6961" stroke-width="2"/><path d="M110 64a7 7 0 0 1 7-7h24a7 7 0 0 1 7 7v4h-38z" fill="#ff6961"/>
  <text x="129" y="66" text-anchor="middle" font-size="7" font-weight="800" fill="#2a0d0b" font-family="-apple-system, system-ui, sans-serif">VEN</text>
  <text x="129" y="90" text-anchor="middle" font-size="19" font-weight="800" fill="#fff" font-family="-apple-system, system-ui, sans-serif">8</text></g>
  <path d="M136 14c.7 5.5 3 7.8 8.5 8.5-5.5.7-7.8 3-8.5 8.5-.7-5.5-3-7.8-8.5-8.5 5.5-.7 7.8-3 8.5-8.5z" fill="#ffb340" class="dr-scintille"/>
</svg>`;
// des plans qui glissent du Drive vers la timeline du projet : l'image de l'import
const ILL_IMPORT = `<svg viewBox="0 0 220 90" aria-hidden="true">
  <rect x="8" y="22" width="44" height="34" rx="8" fill="#2c2c33" stroke="#4a4a55" stroke-width="2"/><path d="M22 48l6-10h12l-6 10z" fill="#0a84ff"/><path d="M34 28l6 10-6 10-6-10z" fill="#30d158" opacity=".9"/>
  <g class="dr-ill-glisse"><rect x="58" y="30" width="26" height="18" rx="4" fill="#ff453a"/><rect x="58" y="30" width="26" height="18" rx="4" fill="#ff6961" class="dr-ill-glisse-2"/><rect x="58" y="30" width="26" height="18" rx="4" fill="#ffb340" class="dr-ill-glisse-3"/></g>
  <rect x="150" y="18" width="62" height="54" rx="9" fill="#2c2c33" stroke="#4a4a55" stroke-width="2"/><path d="M158 60h46" stroke="#3a3a44" stroke-width="5" stroke-linecap="round"/>
  <rect x="158" y="56" width="16" height="8" rx="3" fill="#ff453a"/><rect x="176" y="56" width="12" height="8" rx="3" fill="#ff6961"/><rect x="190" y="56" width="14" height="8" rx="3" fill="#ffb340" class="dr-ill-pose"/>
  <path d="M168 30v16l13-8z" fill="#fff" opacity=".8"/>
</svg>`;

export function creerDrive(o) {
  const {api, note, esc, ic} = o;
  const logo = (cle, t) => o.logo?.(cle, t) ?? '';
  let el = null; // la feuille ouverte
  let onglet = 'ia'; // ia | main
  let D = null; // GET /api/drive : {synchronise, installer…}
  let demande = ''; // le champ « Ce que tu cherches »
  let precision = '';
  let origine = null; // la demande de montage qui attend ces rushes (écrite à l'IA de montage)
  let envoi = ''; // le texte proposé à l'IA de montage après l'import
  let R = null; // la recherche par l'IA (GET /api/drive/chercher, sans_ia faux)
  let RM = null; // la lecture des dates d'un dossier, à la main (sans_ia vrai)
  let coches = new Set(); // les fichiers cochés du choix de l'IA
  let M = null; // le dossier ouvert à la main (GET /api/drive/medias)
  let choixMain = new Map(); // rel → fichier, cochés à la main (d'un dossier à l'autre)
  let chargeM = false; // le plan du Drive se fait (jusqu'à 25 s sur un très grand Drive)
  let apercu = null; // POST /api/drive/importer/apercu, avant de confirmer : {…, rels}
  let I = null; // l'import suivi (GET /api/drive/importer)
  let importSuivi = false; // un import lancé (ou trouvé en cours) depuis cette fenêtre : sa fin est signalée une fois
  let resumeImport = null; // la phrase du choix importé (« 4 vidéos du vendredi 8 novembre, Kyoto, 1,2 Go »)
  let occupe = null; // un geste en route (texte du bouton)
  let tRecherche = null;
  let tImport = null;
  let dernierSquelette = null;
  let derniereVue = null;
  let garde = null; // ce qui voit la feuille se fermer autrement (clic à côté, une autre feuille)
  // un seul sondage à la fois : un second appel pendant un tour en demande un autre juste après (jamais deux minuteries)
  const sondes = {recherche: {tourne: false, encore: false}, import: {tourne: false, encore: false}};
  let tourM = 0; // le dernier dossier demandé (deux clics rapides : seule la dernière réponse compte)

  const aSavoir = () => R?.a_savoir || A_SAVOIR;
  const ia = () => ({cle: o.moteurIA?.() ?? 'claude', nom: o.nomIA?.() ?? 'ton IA', prete: o.iaPrete?.() !== false});
  const fichiersChoix = () => R?.choix?.fichiers ?? [];
  const cochesChoix = () => fichiersChoix().filter((f) => coches.has(f.rel));
  const cochesAffiches = () => (onglet === 'ia' ? cochesChoix() : [...choixMain.values()]);
  const importVisible = () => importSuivi && I && I.etat !== 'aucun';
  const driveAbsent = () => D && D.synchronise === false;

  // ——— le dessin ———
  function tete() {
    return `<header class="dr-tete"><div class="dr-ill">${ILL_DRIVE}</div><div><h3>Depuis mon Drive</h3>
      <p class="sous-titre">Retrouve tes rushes dans ton Google Drive. Dérush lit le vrai jour et la vraie heure de chaque prise, et te montre combien de fichiers et de Go avant de les télécharger.</p></div>
      <button class="icone-btn" data-dr="fermer" title="Fermer (Échap)">${ic('fermer')}</button></header>
      ${driveAbsent() || importVisible() ? '' : `<nav class="segmente dr-onglets"><button data-dr="onglet-ia"${onglet === 'ia' ? ' class="actif"' : ''}>${ic('etincelle')}Demander à l’IA</button><button data-dr="onglet-main"${onglet === 'main' ? ' class="actif"' : ''}>${ic('dossier')}Choisir moi-même</button></nav>`}`;
  }
  /** Une vignette de genre : un film, une photo, une onde. */
  const vignette = (genre) => `<span class="dr-genre ${esc(genre)}" title="${esc(GENRES[genre]?.nom ?? '')}">${ic(GENRES[genre]?.icone ?? 'film')}</span>`;
  function ligneFichier(f, coche) {
    const h = heureDe(f);
    const sur = f.date?.source;
    const quand = f.date ? `${f.date.nom_jour ? majuscule(f.date.nom_jour) : f.date.jour}${h ? ` à ${h}` : ''}${f.date.fuseau ? ` (${f.date.fuseau})` : ''}` : '';
    const titreHeure = sur === 'nom' ? `${quand} : d’après le nom du fichier` : sur === 'fichier' ? `${quand} : date du fichier sur le Drive (souvent celle de l’envoi), pas celle de la prise` : `${quand} : heure de la prise`;
    return `<label class="dr-fichier${coche ? ' coche' : ''}" data-dr-ligne="${esc(f.rel)}" title="${esc(f.rel)}">
      <input type="checkbox" data-dr-f="${esc(f.rel)}"${coche ? ' checked' : ''}>
      ${vignette(f.genre)}
      <span class="dr-nom"><b>${esc(f.nom)}</b><small>${esc(String(f.dossier ?? '').split('/').slice(-2).join(' › '))}</small></span>
      <span class="dr-heure${sur && sur !== 'prise' ? ' incertaine' : ''}" title="${esc(titreHeure)}">${esc(h) || '—'}</span>
      <span class="dr-duree">${esc(dureeLisible(f.duree))}</span>
      <span class="dr-poids">${esc(tailleLisible(f.taille))}</span>
      ${f.local === false ? `<span class="dr-pastille" title="Ce fichier n’est que sur le Drive : Google Drive le téléchargera à l’import">${ic('nuage')}sur le Drive</span>` : '<span></span>'}
    </label>`;
  }
  /** La liste par jour : un en-tête par jour (avec sa case « tout le jour »), puis ses fichiers. */
  function listeParJour(fichiers, estCoche) {
    return `<div class="dr-liste">${grouperParJour(fichiers).map((g) => {
      const n = g.fichiers.filter((f) => estCoche(f.rel)).length;
      return `<section class="dr-jour-groupe" data-dr-groupe="${esc(g.jour)}">
        <header class="dr-jour-tete"><label><input type="checkbox" data-dr-jour-tout="${esc(g.jour)}"${n === g.fichiers.length ? ' checked' : ''}${n && n < g.fichiers.length ? ' data-partiel="1"' : ''}><b>${esc(g.nom)}</b></label>
          <small>${esc(comptesGenres(g))} · ${esc(tailleLisible(g.taille))}</small></header>
        ${g.fichiers.map((f) => ligneFichier(f, estCoche(f.rel))).join('')}</section>`;
    }).join('')}</div>`;
  }
  /** Les étapes de la recherche, faites, en cours ou à venir. */
  function etapes(etat) {
    const k = etapeRecherche(etat);
    const L = [
      ['dossier', 'Le plan du Drive', 'Dérush le parcourt sans rien télécharger'],
      ['etincelle', 'Les dossiers', `${ia().nom} les choisit d’après le plan`],
      ['horloge', 'Les dates de prise', 'Dérush lit le jour et l’heure de chaque prise'],
      ['filtre', 'Les fichiers', `${ia().nom} garde ceux de ta demande`],
    ];
    return `<ol class="dr-etapes">${L.map(([icone, titre, sous], i) => {
      const classe = k < 0 ? '' : i < k ? ' fait' : i === k ? (etat === 'a_confirmer' ? ' attend' : ' encours') : '';
      return `<li class="dr-etape${classe}"><i>${ic(i < k ? 'coche' : icone)}</i><b>${titre}</b><small>${esc(sous)}</small></li>`;
    }).join('')}</ol>`;
  }

  // — onglet « Demander à l'IA » —
  function vueDemande() {
    const x = ia();
    return `<section class="dr-entre dr-demande">
      <label class="dr-champ"><span>Ce que tu cherches</span>
        <textarea name="demande" rows="3" spellcheck="true" placeholder="va dans mon Drive, prends les vidéos de mon séjour au Japon et fais-moi un vlog du vendredi">${esc(demande)}</textarea></label>
      <div class="dr-chercher">${x.prete ? `<small class="dr-avec">${logo(x.cle, 16)}<span>${esc(x.nom)} cherche, au niveau Rapide</span></small>` : `<small class="dr-avec attention">${ic('attention')}<span>Pour chercher à ta place, Dérush a besoin de ton IA. Tu peux aussi choisir toi-même, dossier par dossier.</span></small>`}
        <span class="espace"></span>${x.prete ? `<button class="btn principal" data-dr="chercher"${occupe ? ' disabled' : ''}>${occupe === 'chercher' ? '<i class="dr-tourne"></i>' : ic('loupe')}Chercher</button>` : `<button class="btn" data-dr="onglet-main">${ic('dossier')}Choisir moi-même</button><button class="btn bleu" data-dr="connexions">${ic('prise')}Brancher mon IA</button>`}</div>
      <p class="dr-a-savoir">${ic('cadenas')}<span>${esc(aSavoir())}</span></p>
    </section>
    <section class="dr-entre dr-comment"><h4>Ce que fait Dérush</h4>${etapes('')}
      <p class="dim">Avant de télécharger quoi que ce soit, Dérush te montre les fichiers choisis, par jour, avec leur heure et leur poids. Tu décoches ce que tu ne veux pas, puis tu importes.</p></section>`;
  }
  function rappelDemande() {
    return R?.demande ? `<p class="dr-rappel">${ic('loupe')}<span>« ${esc(R.demande)} »${R.precision ? ` <small>· ${esc(R.precision)}</small>` : ''}</span></p>` : '';
  }
  function dossiersChoisis() {
    if (!R?.dossiers?.length) return '';
    return `<div class="dr-dossiers-choisis"><small>${R.dossiers.length > 1 ? 'Dossiers choisis' : 'Dossier choisi'}</small><div>${R.dossiers.map((d) => `<span class="dr-puce">${ic('dossier')}${esc(String(d).split('/').join(' › '))}</span>`).join('')}</div>${R.pourquoi ? `<p>${esc(R.pourquoi)}</p>` : ''}</div>`;
  }
  /** Où en est la recherche, pendant qu'elle tourne. */
  function vueSuivi() {
    const p = R.progression;
    const pourcent = p?.total ? Math.round((100 * p.fait) / p.total) : 0;
    const qui = ['ia_dossiers', 'ia_fichiers'].includes(R.etat) ? logo(R.nom_ia ?? ia().cle, 18) : '<i class="dr-tourne"></i>';
    return `<section class="dr-entre dr-suivi">${rappelDemande()}${etapes(R.etat)}
      <div class="dr-maintenant">${qui}<span data-v="etape">${esc(R.etape ?? 'Un instant…')}</span><small data-v="temps">${esc(depuis(R.depuis_s))}</small></div>
      ${p ? `<div class="dr-progres"><div class="jauge"><i data-v="barre" style="width:${pourcent}%"></i></div><small data-v="compte">${esc(`${p.fait.toLocaleString('fr-FR')} sur ${pluriel(p.total, 'fichier')}`)}</small></div>` : ''}
      ${dossiersChoisis()}</section>`;
  }
  /** Des fichiers ne sont que sur le Drive : lire leur date les fait télécharger. La personne choisit. */
  function blocConfirmer(x) {
    const c = x.confirmer ?? {};
    return `<div class="dr-entre dr-confirmer">${ic('nuage')}<div><p>${esc(c.texte ?? '')}</p>
      <small>${c.en_ligne ? `${esc(pluriel(Number(c.en_ligne) || 0, 'fichier'))} seulement sur le Drive (${esc(tailleLisible(c.taille_en_ligne))})` : ''}${c.sur_ordinateur ? ` · ${esc(pluriel(Number(c.sur_ordinateur) || 0, 'fichier'))} déjà sur l’ordinateur` : ''}</small>
      <div class="dr-boutons"><button class="btn" data-dr="continuer-noms"${occupe ? ' disabled' : ''}>${Number(c.en_ligne) === 1 ? 'Se fier à son nom' : 'Se fier aux noms des fichiers'}</button><button class="btn bleu" data-dr="continuer-lire"${occupe ? ' disabled' : ''}>${ic('horloge')}Lire les dates</button></div></div></div>`;
  }
  function vueConfirmer() {
    return `<section class="dr-entre dr-suivi">${rappelDemande()}${etapes('a_confirmer')}${blocConfirmer(R)}${dossiersChoisis()}</section>`;
  }
  function vueQuestion() {
    return `<section class="dr-entre dr-question">${rappelDemande()}
      <div class="dr-bulle-ia">${logo(R.nom_ia ?? ia().cle, 24)}<p>${esc(R.question ?? '')}</p></div>
      <form class="dr-repondre" data-dr-form="precision"><input class="entree" name="precision" placeholder="Ta réponse…" value="${esc(precision)}" autocomplete="off"><button class="btn principal" type="submit"${occupe ? ' disabled' : ''}>Répondre</button></form>
      <button class="btn lien" data-dr="nouvelle">Changer ma demande</button></section>`;
  }
  function vueErreur() {
    const arrete = R.etat === 'arrete';
    return `<section class="dr-entre dr-vide">${o.ill?.('bobine') ?? ''}<b>${arrete ? 'Recherche arrêtée' : 'La recherche n’a pas abouti'}</b><p>${esc(arrete ? 'Rien n’a été téléchargé.' : (R.erreur ?? ''))}</p>
      <div class="dr-boutons"><button class="btn" data-dr="nouvelle">Changer ma demande</button><button class="btn principal" data-dr="reessayer"${occupe ? ' disabled' : ''}>${ic('maj')}Réessayer</button></div></section>`;
  }
  function vueChoix() {
    const c = R.choix ?? {};
    return `<section class="dr-entre dr-choix">${rappelDemande()}
      <div class="dr-resume"><b>${esc(c.resume ?? '')}</b>${c.phrase ? `<p>${logo(R.nom_ia ?? ia().cle, 16)}<span>${esc(c.phrase)}</span></p>` : ''}</div>
      ${R.dates_partielles ? `<p class="dr-note">${ic('attention')}<span>Toutes les dates n’ont pas pu être lues à temps : certaines viennent du nom ou de la date du fichier.</span></p>` : ''}
      ${listeParJour(c.fichiers ?? [], (rel) => coches.has(rel))}
      ${dossiersChoisis()}</section>`;
  }
  function corpsIA() {
    if (!R || R.etat === 'aucune') return vueDemande();
    if (TOURNE.includes(R.etat)) return vueSuivi();
    if (R.etat === 'a_confirmer') return vueConfirmer();
    if (R.etat === 'question') return vueQuestion();
    if (R.etat === 'pret') return vueChoix();
    if (R.etat === 'erreur' || R.etat === 'arrete') return vueErreur();
    return vueDemande();
  }

  // — onglet « Choisir moi-même » —
  function ariane() {
    const morceaux = M?.chemin ?? [];
    return `<nav class="dr-ariane"><button data-dr-dossier="" class="${morceaux.length ? '' : 'actif'}">${logo('drive', 14)}Drive</button>${morceaux.map((m, k) => `${ic('img-plus', 'dr-sep')}<button data-dr-dossier="${esc(morceaux.slice(0, k + 1).join('/'))}"${k === morceaux.length - 1 ? ' class="actif"' : ''}>${esc(m)}</button>`).join('')}</nav>`;
  }
  function vueLecture() {
    if (!RM || RM.etat === 'aucune' || RM.etat === 'dates_lues') return '';
    if (RM.etat === 'a_confirmer') return blocConfirmer(RM);
    if (RM.etat === 'erreur' || RM.etat === 'arrete') return `<p class="dr-note">${ic('attention')}<span>${esc(RM.etat === 'arrete' ? 'Lecture des dates arrêtée.' : (RM.erreur ?? ''))}</span></p>`;
    const p = RM.progression;
    const pourcent = p?.total ? Math.round((100 * p.fait) / p.total) : 0;
    return `<div class="dr-entre dr-lecture"><div class="dr-maintenant"><i class="dr-tourne"></i><span data-v="etape-m">${esc(RM.etape ?? 'Un instant…')}</span><span class="espace"></span><button class="btn petit" data-dr="arreter-lecture">Arrêter</button></div>
      ${p ? `<div class="dr-progres"><div class="jauge"><i data-v="barre-m" style="width:${pourcent}%"></i></div><small data-v="compte-m">${esc(`${p.fait.toLocaleString('fr-FR')} sur ${pluriel(p.total, 'fichier')}`)}</small></div>` : ''}</div>`;
  }
  function corpsMain() {
    if (chargeM && !M) {
      return `<section class="dr-entre dr-charge"><i class="dr-tourne grand"></i><b>Dérush fait le plan de ton Drive</b><p>Les noms, les tailles et les dates des fichiers, sans rien télécharger. Sur un très grand Drive, cela peut prendre une demi-minute.</p></section>`;
    }
    if (!M) return '';
    const racine = !M.dossier;
    const dossiers = (M.sous_dossiers ?? []).map((d) => {
      const bits = [comptesGenres(d), tailleLisible(d.taille), d.en_ligne ? `${pluriel(d.en_ligne, 'fichier')} sur le Drive` : ''].filter(Boolean).join(' · ');
      return `<button class="dr-dossier${racine ? ' racine' : ''}" data-dr-dossier="${esc(d.rel)}">${racine ? logo('drive', 22) : `<span class="dr-dossier-ic">${ic('dossier')}</span>`}<span><b>${esc(d.nom)}</b><small>${esc(bits || 'vide')}</small></span>${ic('img-plus', 'dr-fleche')}</button>`;
    }).join('');
    const jours = (M.jours ?? []).length > 1 || (M.jours ?? []).length === 1 && M.jour ? `<div class="dr-jours" role="group" aria-label="Les jours de ce dossier">${M.jours.map((j) => `<button class="dr-jour${M.jour === j.jour ? ' actif' : ''}" data-dr-jour="${esc(j.jour)}" title="${esc(majuscule(j.nom))}"><b>${esc(majuscule(jourCourt(j.jour)))}</b><small>${esc([comptesGenres(j), tailleLisible(j.taille)].filter(Boolean).join(' · '))}</small></button>`).join('')}</div>` : '';
    const fichiers = M.fichiers ?? [];
    const visibles = fichiers.length ? `<div class="dr-barre-liste"><small class="dim">${M.jour ? `${esc(majuscule(M.jours?.find((j) => j.jour === M.jour)?.nom ?? M.jour))}, sous-dossiers compris` : 'Dans ce dossier'} · ${esc(pluriel(Number(M.total) || fichiers.length, 'fichier'))}${M.total > fichiers.length ? ` (les ${esc(fichiers.length.toLocaleString('fr-FR'))} premiers)` : ''}</small><span class="espace"></span><button class="btn petit" data-dr="tout-cocher">Tout cocher</button><button class="btn petit" data-dr="rien-cocher">Rien</button></div>
      ${listeParJour(fichiers, (rel) => choixMain.has(rel))}` : '';
    const vide = !dossiers && !fichiers.length ? `<div class="dr-vide petit">${o.ill?.('rushes') ?? ''}<b>${racine ? 'Aucune vidéo dans ton Drive' : 'Rien à importer ici'}</b><p>${racine ? 'Dérush ne trouve ni vidéo, ni photo, ni son dans ton Drive.' : 'Ni vidéo, ni photo, ni son dans ce dossier.'}</p></div>` : '';
    return `<section class="dr-entre dr-main">
      <div class="dr-nav">${ariane()}<span class="espace"></span>${chargeM ? '<i class="dr-tourne"></i>' : ''}<button class="icone-btn" data-dr="rafraichir" title="Relire le Drive (ce qui vient d’y arriver)">${ic('maj')}</button></div>
      ${M.partiel ? `<p class="dr-note">${ic('attention')}<span>${esc(M.texte_partiel ?? '')}</span></p>` : ''}
      ${racine ? '<p class="dim dr-intro">Ouvre un dossier, choisis un jour, coche ce que tu veux. Les dates viennent des noms et des fichiers : « Lire les dates de prise de vue » les rend exactes.</p>' : ''}
      ${jours}${vueLecture()}
      ${dossiers ? `<div class="dr-dossiers">${dossiers}</div>` : ''}
      ${visibles}${vide}</section>`;
  }

  // — l'import (pour les deux onglets) —
  function vueImport() {
    const x = I;
    if (x.etat === 'en_cours') {
      return `<section class="dr-entre dr-import"><div class="dr-ill-import">${ILL_IMPORT}</div><h4>Dérush importe tes rushes</h4>
        <div class="jauge grande"><i data-v="barre-i" style="width:${Math.round(100 * (x.progression ?? 0))}%"></i></div>
        <div class="dr-import-txt"><span data-v="texte-i">${esc(x.texte ?? '')}</span><small data-v="octets-i">${esc(x.taille ? `${tailleLisible(x.octets)} sur ${tailleLisible(x.taille)}` : '')}</small></div>
        ${x.prevenir ? `<p class="dr-note">${ic('attention')}<span>${esc(x.prevenir)}</span></p>` : ''}
        <p class="dim">Les fichiers restent intacts sur ton Drive. Tu peux fermer cette fenêtre : l’import continue.</p></section>`;
    }
    const ok = x.etat === 'fini' && !x.erreurs?.length;
    const recus = (x.ajoutes?.length ?? 0) + (x.deja ?? 0);
    const qui = ia();
    return `<section class="dr-entre dr-fin"><div class="dr-fin-tete ${ok ? 'ok' : 'attention'}">${ic(ok ? 'ok' : 'attention')}<b>${esc(x.texte ?? '')}</b></div>
      ${x.erreurs?.length ? `<ul class="dr-erreurs">${x.erreurs.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${recus ? `<p class="dim">${recus > 1 ? 'Ils sont dans tes médias, dans l’ordre où ils ont été filmés.' : 'Il est dans tes médias.'}</p>
      <label class="dr-champ dr-envoi"><span>${logo(qui.cle, 16)}Ta demande à ${esc(qui.nom)}</span>
        <textarea name="envoi" rows="3" spellcheck="true" placeholder="fais-moi un vlog de la journée, avec une musique douce…">${esc(envoi)}</textarea></label>
      <small class="dim">${esc(qui.nom)} reçoit ta demande avec ${recus > 1 ? 'la liste de ces rushes : il ne va pas les chercher' : 'ce rush : il ne va pas le chercher'} sur ton Drive.</small>` : ''}</section>`;
  }

  /** Le pied, toujours visible : ce qui est coché, et le geste suivant. */
  function pied() {
    if (driveAbsent()) return `<footer class="dr-pied"><span class="espace"></span><button class="btn" data-dr="fermer">Fermer</button></footer>`;
    if (importVisible()) {
      if (I.etat === 'en_cours') return `<footer class="dr-pied"><span class="espace"></span><button class="btn" data-dr="import-arreter">${ic('stop')}Arrêter l’import</button></footer>`;
      const recus = (I.ajoutes?.length ?? 0) + (I.deja ?? 0);
      const qui = ia();
      return `<footer class="dr-pied"><button class="btn" data-dr="import-autre">Importer d’autres rushes</button><span class="espace"></span><button class="btn" data-dr="fermer">${recus ? 'Je monte moi-même' : 'Fermer'}</button>${recus ? (qui.prete ? `<button class="btn principal" data-dr="envoyer"${envoi.trim() ? '' : ' disabled'}>${ic('envoi')}Envoyer à ${esc(qui.nom)}</button>` : `<button class="btn bleu" data-dr="connexions">${ic('prise')}Brancher mon IA</button>`) : ''}</footer>`;
    }
    if (apercu) {
      const refus = !apercu.ok;
      const rien = !apercu.nouveaux;
      return `<footer class="dr-pied dr-apercu${refus ? ' refus' : ''}"><div class="dr-apercu-txt"><b>${esc(apercu.resume ?? '')}</b>
        <small>${esc([apercu.deja ? `${pluriel(Number(apercu.deja) || 0, 'fichier déjà', 'fichiers déjà')} dans le projet` : '', Number.isFinite(apercu.libre) ? `${tailleLisible(apercu.libre)} libres sur le disque` : ''].filter(Boolean).join(' · '))}</small>
        ${apercu.texte && (refus || apercu.prevenir) ? `<p>${ic('attention')}<span>${esc(apercu.texte)}</span></p>` : ''}</div>
        <div class="dr-boutons"><button class="btn" data-dr="apercu-retour">Retour</button>${rien ? '' : `<button class="btn principal" data-dr="importer-go"${refus || occupe ? ' disabled' : ''}>${occupe === 'importer' ? '<i class="dr-tourne"></i>' : ic('importer')}Importer maintenant</button>`}</div></footer>`;
    }
    const liste = cochesAffiches();
    const c = compter(liste);
    const enLigne = c.en_ligne.n ? ` · <span data-v="en-ligne">${esc(`dont ${tailleLisible(c.en_ligne.taille)} à télécharger`)}</span>` : '';
    const resume = `<small class="dr-coches" data-dr-coches><span data-v="coches">${esc(c.n ? `${pluriel(c.n, 'fichier coché', 'fichiers cochés')} · ${tailleLisible(c.taille)}` : 'Rien de coché')}</span>${enLigne}</small>`;
    if (onglet === 'ia') {
      if (R?.etat === 'pret') return `<footer class="dr-pied">${resume}<span class="espace"></span><button class="btn" data-dr="nouvelle">Nouvelle recherche</button><button class="btn principal" data-dr="importer"${c.n && !occupe ? '' : ' disabled'}>${occupe === 'apercu' ? '<i class="dr-tourne"></i>' : ic('importer')}<span data-v="importer">${esc(libelleImporter(c.n, c.taille))}</span></button></footer>`;
      if (R && TOURNE.includes(R.etat)) return `<footer class="dr-pied"><small class="dim">Tu peux fermer cette fenêtre : la recherche continue.</small><span class="espace"></span><button class="btn" data-dr="arreter">${ic('stop')}Arrêter</button></footer>`;
      return '';
    }
    if (!M) return '';
    const lire = M.dossier && !(RM && TOURNE.includes(RM.etat)) && RM?.etat !== 'a_confirmer';
    return `<footer class="dr-pied">${resume}${choixMain.size ? '<button class="btn lien petit" data-dr="decocher-tout">Tout décocher</button>' : ''}<span class="espace"></span>${lire ? `<button class="btn" data-dr="lire-dates" title="Lire le vrai jour et la vraie heure de chaque prise de ce dossier (sans IA)">${ic('horloge')}Lire les dates de prise de vue</button>` : ''}<button class="btn principal" data-dr="importer"${c.n && !occupe ? '' : ' disabled'}>${occupe === 'apercu' ? '<i class="dr-tourne"></i>' : ic('importer')}<span data-v="importer">${esc(libelleImporter(c.n, c.taille))}</span></button></footer>`;
  }
  function vueAbsent() {
    const a = D?.installer ?? {};
    return `<section class="dr-entre dr-vide dr-absent">${logo('drive', 46)}<b>Google Drive n’est pas sur cet ordinateur</b><p>${esc(a.texte ?? '')}</p>
      ${a.lien ? `<button class="btn bleu" data-dr="installer" data-url="${esc(a.lien)}">${ic('lien')}${o.systeme?.() === 'linux' ? 'La page de Google Drive' : 'Installer Google Drive pour ordinateur'}</button>` : ''}</section>`;
  }
  function corps() {
    if (driveAbsent()) return {nom: 'absent', html: vueAbsent()};
    if (importVisible()) return {nom: `import-${I.etat === 'en_cours' ? 'cours' : 'fin'}`, html: vueImport()};
    if (onglet === 'main') return {nom: M ? `main-${M.dossier}-${M.jour ?? ''}` : 'main-charge', html: corpsMain()};
    const etat = R?.etat ?? 'aucune';
    return {nom: TOURNE.includes(etat) || etat === 'a_confirmer' ? 'ia-suivi' : `ia-${etat}`, html: corpsIA()};
  }
  function rendre() {
    if (!el?.isConnected) return;
    const c = corps();
    const html = `${tete()}<div class="dr-corps">${c.html}</div>${pied()}`;
    const sq = squelette(html);
    if (sq === dernierSquelette && c.nom === derniereVue) return majVivants(html);
    // une nouvelle vue entre en glissant ; la même, redessinée, ne bouge pas
    const calme = c.nom === derniereVue;
    dernierSquelette = sq;
    derniereVue = c.nom;
    const actif = document.activeElement;
    const nom = actif && el.contains(actif) && actif.name ? actif.name : null;
    const sel = nom && typeof actif.selectionStart === 'number' ? [actif.selectionStart, actif.selectionEnd] : null;
    const defile = el.scrollTop;
    el.innerHTML = `<div class="dr${calme ? ' calme' : ''}">${html}</div>`;
    el.scrollTop = calme ? defile : 0;
    majCasesPartielles();
    if (nom) { const z = el.querySelector(`[name="${nom}"]`); if (z) { z.focus(); if (sel) try { z.setSelectionRange(...sel); } catch { /* champ sans curseur */ } } }
  }
  /** Seules les valeurs qui bougent changent : le texte des `data-v` et la largeur des barres. */
  function majVivants(html) {
    const t = document.createElement('template');
    t.innerHTML = html;
    const neufs = t.content.querySelectorAll('[data-v]');
    const vieux = el.querySelectorAll('[data-v]');
    if (neufs.length !== vieux.length) { dernierSquelette = null; derniereVue = null; return rendre(); }
    neufs.forEach((n, k) => {
      const v = vieux[k];
      if (v.textContent !== n.textContent) v.textContent = n.textContent;
      const s = n.getAttribute('style');
      if (v.getAttribute('style') !== s) { if (s == null) v.removeAttribute('style'); else v.setAttribute('style', s); }
    });
  }
  /** Une case de jour dont une partie seulement des fichiers est cochée : ni vide, ni pleine. */
  function majCasesPartielles() {
    for (const c of el?.querySelectorAll('[data-dr-jour-tout]') ?? []) c.indeterminate = c.dataset.partiel === '1';
  }
  /** Après une case cochée : les lignes, les cases des jours et le pied suivent, sans tout redessiner. */
  function majCoches() {
    if (!el?.isConnected) return;
    const estCoche = onglet === 'ia' ? (rel) => coches.has(rel) : (rel) => choixMain.has(rel);
    for (const l of el.querySelectorAll('[data-dr-ligne]')) {
      const oui = estCoche(l.dataset.drLigne);
      l.classList.toggle('coche', oui);
      const c = l.querySelector('input');
      if (c && c.checked !== oui) c.checked = oui;
    }
    for (const g of el.querySelectorAll('[data-dr-groupe]')) {
      const rels = [...g.querySelectorAll('[data-dr-ligne]')].map((l) => l.dataset.drLigne);
      const n = rels.filter(estCoche).length;
      const c = g.querySelector('[data-dr-jour-tout]');
      if (c) { c.checked = n === rels.length && n > 0; c.indeterminate = n > 0 && n < rels.length; }
    }
    // le pied : le nombre coché, le poids, le bouton Importer (et « Tout décocher », qui apparaît ou disparaît)
    const avant = el.querySelector('.dr-pied');
    const t = document.createElement('template');
    t.innerHTML = pied();
    const neuf = t.content.firstElementChild;
    if (avant && neuf) avant.replaceWith(neuf); else if (neuf) el.querySelector('.dr')?.append(neuf);
    dernierSquelette = squelette(`${tete()}<div class="dr-corps">${corps().html}</div>${pied()}`);
  }

  // ——— la recherche par l'IA ———
  async function chercher(avecPrecision = false) {
    const texte = (avecPrecision ? R?.demande : demande)?.trim() ?? '';
    if (!texte) { note('Écris d’abord ce que tu cherches (par exemple : « le vendredi au Japon »).', true); return el?.querySelector('[name="demande"]')?.focus(); }
    occupe = 'chercher';
    rendre();
    try {
      const r = await api('POST', '/api/drive/chercher', {demande: texte, ...(avecPrecision && precision.trim() ? {precision: precision.trim()} : {}), moteur: ia().cle});
      R = r;
      coches = new Set();
      precision = '';
    } catch (err) {
      note(err.message, true);
    }
    occupe = null;
    rendre();
    sonderRecherche();
  }
  async function seul(cle, tour) {
    const x = sondes[cle];
    if (x.tourne) { x.encore = true; return; }
    x.tourne = true;
    try { await tour(); } finally { x.tourne = false; }
    if (x.encore) { x.encore = false; seul(cle, tour); }
  }
  /** Relit la recherche toutes les 700 ms tant qu'elle tourne (et tant que la feuille est ouverte). */
  const sonderRecherche = () => seul('recherche', tourRecherche);
  async function tourRecherche() {
    clearTimeout(tRecherche);
    let r = null;
    try { r = await api('GET', '/api/drive/chercher'); } catch { /* le serveur répondra au prochain tour */ }
    if (!el?.isConnected) return;
    if (r) {
      if (r.sans_ia) {
        const avant = RM?.etat;
        RM = r;
        // les dates du dossier sont lues : la liste les montre maintenant (et la recherche, finie, s'efface)
        if (r.etat === 'dates_lues' && avant !== 'dates_lues') {
          api('POST', '/api/drive/chercher/oublier').catch(() => {});
          RM = null;
          note('Les dates de prise de vue sont lues : la liste est à jour.');
          await chargerDossier(M?.dossier ?? '', M?.jour ?? null);
        }
      } else if (r.etat !== 'aucune') {
        const avant = R?.etat;
        R = r;
        // le choix de l'IA arrive : tout est coché
        if (r.etat === 'pret' && avant !== 'pret') coches = new Set((r.choix?.fichiers ?? []).map((f) => f.rel));
      } else if (R && TOURNE.includes(R.etat)) R = null; // le serveur a redémarré
    }
    rendre();
    const suivie = [R, RM].some((x) => x && (TOURNE.includes(x.etat) || x.etat === 'a_confirmer'));
    if (suivie) tRecherche = setTimeout(sonderRecherche, [R, RM].some((x) => x && TOURNE.includes(x.etat)) ? SONDAGE : SONDAGE_FOND);
  }
  async function continuer(lire) {
    occupe = 'continuer';
    rendre();
    try {
      const r = await api('POST', '/api/drive/chercher/continuer', {lire});
      if (r.sans_ia) RM = r; else R = r;
    } catch (err) { note(err.message, true); }
    occupe = null;
    rendre();
    sonderRecherche();
  }

  // ——— le choix à la main ———
  async function chargerDossier(dossier = '', jour = null, {rafraichir = false} = {}) {
    const tour = ++tourM;
    chargeM = true;
    rendre();
    let echec = false;
    try {
      const q = new URLSearchParams();
      if (dossier) q.set('dossier', dossier);
      if (dossier && jour) q.set('jour', jour);
      if (rafraichir) q.set('rafraichir', '1');
      const r = await api('GET', `/api/drive/medias${[...q].length ? `?${q}` : ''}`);
      if (tour !== tourM) return; // un autre dossier a été demandé entre-temps
      if (r.installe === false) { D = {...(D ?? {}), synchronise: false, installer: {lien: r.lien, texte: r.texte}}; M = null; }
      else M = {...r, jour: dossier && jour ? jour : null};
    } catch (err) {
      if (tour !== tourM) return;
      note(err.message, true);
      echec = true;
    }
    chargeM = false;
    // un dossier disparu du Drive (ou illisible) : on repart du haut
    if (echec && dossier && !M) return chargerDossier('');
    rendre();
  }
  async function lireDates() {
    if (!M?.dossier) return;
    occupe = 'lire';
    try {
      RM = await api('POST', '/api/drive/chercher', {dossiers: [M.dossier], sans_ia: true});
    } catch (err) { note(err.message, true); }
    occupe = null;
    rendre();
    sonderRecherche();
  }

  // ——— l'import ———
  async function preparerImport() {
    const liste = cochesAffiches();
    if (!liste.length) return note('Coche au moins un fichier.', true);
    occupe = 'apercu';
    rendre();
    try {
      const rels = liste.map((f) => f.rel);
      apercu = {...(await api('POST', '/api/drive/importer/apercu', {fichiers: rels})), rels};
    } catch (err) { note(err.message, true); apercu = null; }
    occupe = null;
    rendre();
  }
  async function lancerImport() {
    if (!apercu?.ok || !apercu.rels?.length) return;
    occupe = 'importer';
    rendre();
    try {
      I = await api('POST', '/api/drive/importer', {fichiers: apercu.rels});
      importSuivi = true;
      o.surImportLance?.();
      resumeImport = onglet === 'ia' && R?.etat === 'pret' && cochesChoix().length === fichiersChoix().length ? (R.choix?.resume ?? null) : null;
      // la demande proposée à l'IA de montage après l'import : celle qui attend ces rushes, sinon ce qu'on a cherché
      envoi = origine ?? (onglet === 'ia' ? (R?.demande ?? demande) : '') ?? '';
      apercu = null;
    } catch (err) {
      note(err.message, true);
      // un import tournait déjà (une autre fenêtre, un clic d'avant) : on le suit
      if (/déjà en cours/.test(err.message)) { importSuivi = true; apercu = null; }
    }
    occupe = null;
    rendre();
    sonderImport();
  }
  /** Relit l'import : toutes les 700 ms feuille ouverte, 1,5 s sinon. Sa fin est signalée une fois (médias relus). */
  const sonderImport = () => seul('import', tourImport);
  async function tourImport() {
    clearTimeout(tImport);
    if (!importSuivi) return;
    let r = null;
    try { r = await api('GET', '/api/drive/importer'); } catch { /* au prochain tour */ }
    if (r) {
      const avant = I?.etat;
      I = r;
      if (r.etat !== 'en_cours' && (avant === 'en_cours' || avant == null)) {
        // fini, arrêté ou en erreur : les médias arrivés sont relus, l'IA de montage peut recevoir la demande
        try { await o.surImportFini?.(r, {demande: origine, resume: resumeImport}); } catch { /* l'éditeur se débrouille */ }
        if (!el?.isConnected) { importSuivi = false; note(r.texte ?? 'Import fini.', r.etat === 'erreur'); }
      }
    }
    if (el?.isConnected) rendre();
    if (importSuivi && (!r || r.etat === 'en_cours')) tImport = setTimeout(sonderImport, el?.isConnected ? SONDAGE : SONDAGE_FOND);
  }

  // ——— les gestes ———
  async function clic(e) {
    const dossier = e.target.closest('[data-dr-dossier]');
    if (dossier) { apercu = null; return chargerDossier(dossier.dataset.drDossier, null); }
    const jour = e.target.closest('[data-dr-jour]');
    if (jour) { apercu = null; return chargerDossier(M?.dossier ?? '', M?.jour === jour.dataset.drJour ? null : jour.dataset.drJour); }
    const b = e.target.closest('[data-dr]');
    if (!b || b.disabled) return;
    const a = b.dataset.dr;
    if (a === 'fermer') return fermer();
    if (a === 'onglet-ia' || a === 'onglet-main') {
      onglet = a === 'onglet-ia' ? 'ia' : 'main';
      apercu = null;
      rendre();
      if (onglet === 'main' && !M && !chargeM) chargerDossier('');
      return;
    }
    if (a === 'connexions') { fermer(); return o.connexions?.(); }
    if (a === 'chercher') return chercher(false);
    if (a === 'reessayer') { demande = R?.demande ?? demande; precision = R?.precision ?? ''; return chercher(!!precision); }
    if (a === 'nouvelle') {
      demande = R?.demande ?? demande;
      R = null;
      coches = new Set();
      apercu = null;
      api('POST', '/api/drive/chercher/oublier').catch(() => {});
      rendre();
      return el.querySelector('[name="demande"]')?.focus();
    }
    if (a === 'arreter') { try { await api('POST', '/api/drive/chercher/arreter'); } catch (err) { note(err.message, true); } return sonderRecherche(); }
    if (a === 'arreter-lecture') { try { await api('POST', '/api/drive/chercher/arreter'); } catch (err) { note(err.message, true); } return sonderRecherche(); }
    if (a === 'continuer-lire') return continuer(true);
    if (a === 'continuer-noms') return continuer(false);
    if (a === 'tout-cocher') { for (const f of M?.fichiers ?? []) choixMain.set(f.rel, f); return majCoches(); }
    if (a === 'rien-cocher') { for (const f of M?.fichiers ?? []) choixMain.delete(f.rel); return majCoches(); }
    if (a === 'decocher-tout') { choixMain = new Map(); return majCoches(); }
    if (a === 'rafraichir') return chargerDossier(M?.dossier ?? '', M?.jour ?? null, {rafraichir: true});
    if (a === 'lire-dates') return lireDates();
    if (a === 'importer') return preparerImport();
    if (a === 'apercu-retour') { apercu = null; return rendre(); }
    if (a === 'importer-go') return lancerImport();
    if (a === 'import-arreter') { try { await api('POST', '/api/drive/importer/arreter'); } catch (err) { note(err.message, true); } return sonderImport(); }
    if (a === 'import-autre') { importSuivi = false; I = null; return rendre(); }
    if (a === 'envoyer') {
      const texte = envoi.trim();
      if (!texte) return note('Écris d’abord ce que ton IA doit faire avec ces rushes.', true);
      const message = messageApresImport(texte, I ?? {}, resumeImport);
      importSuivi = false;
      I = null;
      origine = null;
      fermer();
      return o.envoyerDemande?.(message);
    }
    if (a === 'installer') { try { await api('POST', '/api/lien', {url: b.dataset.url}); } catch (err) { note(err.message, true); } return; }
  }
  function changement(e) {
    const t = e.target;
    if (t.matches('[data-dr-f], [data-dr-jour-tout]') && apercu) { apercu = null; rendre(); }
    if (t.matches('[data-dr-f]')) {
      const rel = t.dataset.drF;
      if (onglet === 'ia') { if (t.checked) coches.add(rel); else coches.delete(rel); }
      else {
        const f = (M?.fichiers ?? []).find((x) => x.rel === rel);
        if (t.checked && f) choixMain.set(rel, f); else choixMain.delete(rel);
      }
      return majCoches();
    }
    if (t.matches('[data-dr-jour-tout]')) {
      const fichiers = (onglet === 'ia' ? fichiersChoix() : M?.fichiers ?? []).filter((f) => (f.date?.jour ?? 'inconnu') === t.dataset.drJourTout);
      for (const f of fichiers) {
        if (onglet === 'ia') { if (t.checked) coches.add(f.rel); else coches.delete(f.rel); }
        else if (t.checked) choixMain.set(f.rel, f); else choixMain.delete(f.rel);
      }
      return majCoches();
    }
  }
  function saisie(e) {
    const t = e.target;
    if (t.name === 'demande') demande = t.value;
    if (t.name === 'precision') precision = t.value;
    if (t.name === 'envoi') {
      envoi = t.value;
      const b = el.querySelector('[data-dr="envoyer"]');
      if (b) b.disabled = !envoi.trim();
    }
  }
  function envoiFormulaire(e) {
    const f = e.target.closest('[data-dr-form]');
    if (!f) return;
    e.preventDefault();
    if (occupe) return;
    if (f.dataset.drForm === 'precision') {
      if (!precision.trim()) return note('Écris ta réponse.', true);
      return chercher(true);
    }
  }
  function touche(e) {
    // ⌘↵ dans le champ de la demande : Chercher ; dans la demande à l'IA de montage : Envoyer
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.repeat) {
      if (e.target.name === 'demande') { e.preventDefault(); if (!occupe && ia().prete) chercher(false); }
      if (e.target.name === 'envoi') { e.preventDefault(); el.querySelector('[data-dr="envoyer"]:not(:disabled)')?.click(); }
    }
  }
  function echap(e) { if (el && e.key === 'Escape' && el.isConnected) { e.stopPropagation(); e.preventDefault(); fermer(); } }

  /** La feuille se ferme (bouton, Échap, clic à côté, une autre feuille) : les sondages s'arrêtent, sauf celui d'un import. */
  function oublierFeuille() {
    document.removeEventListener('keydown', echap, true);
    clearTimeout(tRecherche);
    el = null;
    dernierSquelette = null;
    derniereVue = null;
    apercu = null;
    if (importSuivi && I?.etat === 'en_cours') sonderImport();
    else if (importSuivi) { importSuivi = false; I = null; }
  }
  function fermer() {
    const ouverte = !!el?.isConnected;
    oublierFeuille();
    if (ouverte) o.fermerFeuille();
  }
  async function ouvrir({onglet: voulu = 'ia', demande: texte = null, origine: attend = undefined} = {}) {
    if (attend !== undefined) origine = attend ? String(attend) : null;
    try { D = await api('GET', '/api/drive'); } catch { D = null; }
    // ce qui tourne déjà (la feuille a été fermée pendant une recherche ou un import) : on le reprend
    let r = null;
    try { r = await api('GET', '/api/drive/chercher'); } catch { /* rien en cours */ }
    const cleChoix = (x) => (x?.choix?.fichiers ?? []).map((f) => f.rel).join('\n');
    if (r?.etat === 'pret' && !r.sans_ia && (!coches.size || cleChoix(r) !== cleChoix(R))) coches = new Set((r.choix?.fichiers ?? []).map((f) => f.rel));
    if (r && r.etat !== 'aucune') { if (r.sans_ia) RM = r; else R = r; }
    if (R && ['erreur', 'arrete'].includes(R.etat)) { demande = R.demande ?? demande; R = null; coches = new Set(); }
    if (RM && ['erreur', 'arrete', 'dates_lues'].includes(RM.etat)) RM = null;
    if (!importSuivi) {
      try { const x = await api('GET', '/api/drive/importer'); if (x.etat === 'en_cours') { I = x; importSuivi = true; } } catch { /* aucun import */ }
    }
    onglet = voulu === 'main' ? 'main' : 'ia';
    if (texte != null) {
      demande = String(texte);
      // une autre demande que celle de la recherche gardée : le champ, prêt pour « Chercher » (sauf si elle tourne encore)
      if (R && R.demande !== demande.trim() && !TOURNE.includes(R.etat)) { R = null; coches = new Set(); }
    }
    el = o.feuille('', true);
    el.classList.add('dr-feuille');
    el.addEventListener('click', clic);
    el.addEventListener('change', changement);
    el.addEventListener('input', saisie);
    el.addEventListener('submit', envoiFormulaire);
    el.addEventListener('keydown', touche);
    document.addEventListener('keydown', echap, true);
    // la feuille a pu être fermée autrement (clic sur le voile, une autre feuille) : on arrête de la suivre
    const voile = document.getElementById('voile');
    garde?.disconnect();
    garde = new MutationObserver(() => {
      if (el?.isConnected && !voile?.classList.contains('cache')) return;
      garde?.disconnect();
      garde = null;
      if (el) oublierFeuille();
    });
    if (voile) garde.observe(voile, {childList: true, attributes: true, attributeFilter: ['class']});
    rendre();
    if (onglet === 'main' && !driveAbsent()) chargerDossier(M?.dossier ?? '', M?.jour ?? null);
    if ([R, RM].some((x) => x && (TOURNE.includes(x.etat) || x.etat === 'a_confirmer'))) sonderRecherche();
    if (importSuivi) sonderImport();
    if (onglet === 'ia' && !R) setTimeout(() => { const z = el?.querySelector('[name="demande"]'); if (z) { z.focus(); z.setSelectionRange(z.value.length, z.value.length); } }, 60);
  }
  return {
    ouvrir, fermer,
    ouvert: () => !!el?.isConnected,
    /** Un import depuis le Drive tourne (ou une recherche) : pour l'éditeur. */
    occupe: () => importSuivi && I?.etat === 'en_cours',
    /** La demande à renvoyer à l'IA de montage après un import (pour la carte de la colonne de l'IA). */
    message: (texte, etat, resume) => messageApresImport(texte, etat ?? {}, resume ?? null),
  };
}
