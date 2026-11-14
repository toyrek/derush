// Dérush — le tableau de bord du créateur, espace par espace (Moi, chaque client, Personne) :
//   - ses montages livrés et publiés, leurs vues, leur écart à la médiane du compte (le « multiple ») ;
//   - la meilleure vidéo et la moins bonne, puis chaque vidéo avec sa courbe de vues (J+1, J+7, J+30) et l'avis donné ;
//   - « Ce qui marche » : la recette en chiffres, et l'analyse de l'IA quand on la demande ;
//   - les idées de sujets, les séries (« comme d'habitude »), le carnet.
// Le serveur fait les comptes (lib/tableau.mjs) ; ici, on montre. Rien n'est envoyé à une IA sans un clic, et une
// confirmation qui la nomme. Chaque espace reste à part : un client ne voit jamais les chiffres ni le style de Moi.
const RESEAUX = {tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram', linkedin: 'LinkedIn'};
const PERIODES = [['30', '30 j'], ['90', '90 j'], ['tout', 'Tout']];
const GENRES = {moi: 'Ton espace', client: 'Client', neutre: 'Neutre'};
const PHRASES = {moi: 'ton style, ton carnet et tes chiffres', client: 'sa marque et son carnet à lui, jamais tes habitudes', neutre: 'rien de toi : un montage neutre, rien n’est appris'};
const PALETTE = ['#ff9f0a', '#bf5af2', '#64d2ff', '#30d158', '#ff375f', '#5e5ce6', '#ffd60a'];
const JOURS = [1, 7, 30];
// « Personne » : une silhouette en pointillés, la même que dans espaces.js (personne n'est derrière, rien n'est gardé)
const SVG_NEUTRE = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8" stroke-dasharray="2.2 2.4"/><path d="M4.5 20c.8-3.8 3.7-5.8 7.5-5.8s6.7 2 7.5 5.8" stroke-dasharray="2.2 2.4"/></svg>';
// l'état vide : un petit tableau de bord qui s'anime (même dessin que les illustrations de index.html)
const ILL_TABLEAU = `<svg viewBox="0 0 160 120" aria-hidden="true">
  <rect x="14" y="24" width="132" height="84" rx="12" fill="#23232a" stroke="#4a4a55" stroke-width="2"/>
  <g fill="#3a3a44"><rect x="28" y="80" width="12" height="16" rx="3"/><rect x="46" y="70" width="12" height="26" rx="3"/><rect x="82" y="74" width="12" height="22" rx="3"/></g>
  <rect x="64" y="56" width="12" height="40" rx="3" fill="#ff453a"/><rect x="100" y="48" width="12" height="48" rx="3" fill="#ffb340"/><rect x="118" y="62" width="12" height="34" rx="3" fill="#ff6961" opacity=".6"/>
  <path class="tb-ill-trace" d="M26 64C42 62 50 50 64 48S90 40 100 34S124 30 134 26" fill="none" stroke="#64d2ff" stroke-width="3" stroke-linecap="round"/>
  <circle cx="134" cy="26" r="4.5" fill="#64d2ff" class="ill-scintille"/>
  <g class="ill-flotte"><rect x="96" y="2" width="50" height="22" rx="11" fill="#30d158"/><text x="121" y="18" text-anchor="middle" font-family="Anton, 'Bebas Neue', sans-serif" font-size="14" fill="#04210c">×3,4</text></g>
  <path d="M30 14c.6 4.6 2.5 6.5 7 7-4.5.6-6.4 2.5-7 7-.6-4.5-2.5-6.4-7-7 4.5-.5 6.4-2.4 7-7z" fill="#ffb340" class="ill-scintille d2"/>
</svg>`;

export function creerTableau(o) {
  const {api, esc, ic, ill, note} = o;
  // une clé lue dans un fichier écrit par l'IA (recette.json, chiffres.json : un réseau, un moteur) n'entre dans le HTML
  // que si c'est un simple mot : logo() la recopie telle quelle dans l'attribut class
  const logo = (cle, ...reste) => o.logo(typeof cle === 'string' && /^[a-z0-9-]{1,30}$/.test(cle) && !(cle in Object.prototype) ? cle : 'inconnu', ...reste);
  const nomReseau = (r) => (Object.hasOwn(RESEAUX, r) ? RESEAUX[r] : String(r ?? ''));
  let el = null; // l'écran
  let L = null; // GET /api/espaces : {dernier, espaces[], metiers{}}
  let S = null; // GET /api/tableau : le tableau de l'espace choisi
  let actif = 'moi';
  let periode = '90';
  let tri = 'recentes';
  let minuterie = null; // la relecture pendant une analyse
  let guet = null; // attend la fermeture d'une feuille ouverte ailleurs (réglages, carnet)
  let guetteur = null; // les vignettes du contenu ne se demandent qu'en approchant de l'écran
  let demande = 0; // numéro de la dernière lecture : une réponse en retard est ignorée
  let cleRendu = ''; // les données du dernier rendu complet
  let vueRendue = ''; // espace et période du dernier rendu complet
  let sansCle = false; // « Relire les vues » a répondu : pas de clé Treg
  let travaillait = false;
  let deja = new Map(); // les chiffres déjà montrés (les compteurs partent de là)
  const IMAGES = new Map(); // adresse → Promise<adresse locale de l'image | null>

  const $ = (s) => el?.querySelector(s);
  const lirePref = (k, d) => { try { return o.prefs?.lire(k, d) ?? d; } catch { return d; } };
  const ecrirePref = (k, v) => { try { o.prefs?.ecrire(k, v); } catch { /* rien à garder */ } };
  const nomIA = () => o.nomIA?.(o.moteurIA?.()) ?? 'ton IA';

  // ——— nombres, dates, couleurs ———
  const entier = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR');
  const compact = (n) => {
    if (n == null) return '—';
    const x = Number(n);
    if (x >= 1e6) return `${(x / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '')} M`;
    if (x >= 1e5) return `${Math.round(x / 1e3)} k`;
    return entier(x);
  };
  const fois = (x) => {
    const v = Number(x);
    if (x == null || !Number.isFinite(v)) return '—';
    if (v >= 10) return String(Math.round(v));
    return (v >= 1 ? v.toFixed(1) : v.toFixed(2).replace(/0$/, '')).replace('.', ',').replace(/,0$/, '');
  };
  const pl = (n, un, plusieurs = `${un}s`) => (n > 1 ? plusieurs : un);
  const duree = (s) => (s == null ? '' : s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')}`);
  const minutes = (s) => `${Math.floor((s ?? 0) / 60)} min ${String(Math.round((s ?? 0) % 60)).padStart(2, '0')} s`;
  const jour = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR', {day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? {year: 'numeric'} : {})});
  };
  const hote = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'la source'; } };
  const classeMultiple = (m) => (m == null ? '' : m >= 1.5 ? 'haut' : m <= 0.7 ? 'bas' : 'moyen');
  const periodeTexte = () => (S?.periode === 'tout' ? 'depuis le début' : `sur les ${S?.periode ?? periode} derniers jours`);
  const laMediane = () => (S?.espace?.type === 'client' ? 'la médiane du compte' : 'ta médiane');

  /** La couleur d'un espace : celle que donne espaces.js (sa marque, sinon une couleur à lui). */
  function couleur(e) {
    if (!e) return 'var(--bleu)';
    try { const c = o.couleurEspace?.(e); if (c) return String(c); } catch { /* couleur par défaut */ }
    if (e.type === 'moi') return 'var(--bleu)';
    if (e.type === 'neutre') return '#6e6e76';
    const h = [...String(e.id)].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
    return PALETTE[h % PALETTE.length];
  }
  /** L'encre lisible sur une couleur (noire sur une couleur claire). */
  function encre(c) {
    let m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c ?? '').trim());
    if (!m) return '#fff';
    let h = m[1];
    if (h.length === 3) h = [...h].map((x) => x + x).join('');
    const n = parseInt(h, 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    m = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return m > 0.36 ? '#141416' : '#fff';
  }
  const initiales = (nom) => String(nom ?? '?').split(/[\s'’-]+/).filter((w) => w && !/^(de|du|des|la|le|les|l|d|et|the)$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || String(nom ?? '?').slice(0, 1).toUpperCase();
  const espaceDe = (id) => L?.espaces?.find((e) => e.id === id) ?? null;
  const metierDe = (e) => {
    if (!e?.metier?.type) return null;
    const nom = e.metier.nom ?? L?.metiers?.[e.metier.type]?.nom ?? e.metier.type;
    return e.metier.precision ? `${nom} — ${e.metier.precision}` : nom;
  };
  function avatar(e, grand = false) {
    const c = couleur(e);
    const contenu = e.type === 'moi' ? ic('profil') : e.type === 'neutre' ? SVG_NEUTRE : esc(initiales(e.nom));
    const image = e.logo ? ` data-tb-img="/api/espaces/${encodeURIComponent(e.id)}/logo" data-mode="logo"` : '';
    return `<span class="tb-avatar t-${esc(e.type)}${grand ? ' grand' : ''}" style="--c:${esc(c)};--encre:${encre(c)}"${image}>${contenu}</span>`;
  }

  // ——— les images (vignettes, aperçus, logos) : elles passent par l'API, avec le jeton de la session ———
  const jeton = () => document.querySelector('meta[name="derush-jeton"]')?.content ?? '';
  function image(adresse) {
    if (!IMAGES.has(adresse)) {
      IMAGES.set(adresse, fetch(adresse, {headers: {'x-derush-jeton': jeton()}})
        .then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? URL.createObjectURL(b) : null)).catch(() => null));
    }
    return IMAGES.get(adresse);
  }
  function oublierImages() {
    for (const p of IMAGES.values()) p.then((u) => { if (u) URL.revokeObjectURL(u); });
    IMAGES.clear();
  }
  /** Une planche de vignettes (une rangée d'images, lib/claude.mjs vignettesVideo) : on en montre une, on les parcourt au survol. */
  async function poserPlanche(x, u) {
    const im = new Image();
    im.src = u;
    try { await im.decode(); } catch { return; }
    if (!x.isConnected) return;
    const largeur = im.naturalWidth;
    const hauteur = im.naturalHeight || 96;
    const d = Number(x.dataset.duree);
    // autant d'images que lib/claude.mjs en a tirées (une toutes les 1,5 s, de 6 à 120), sinon on devine leur largeur
    let n = d > 0 ? Math.max(6, Math.min(120, Math.round(d / 1.5))) : 0;
    if (!n || largeur % n) {
      const l = [54, 170, 96, 128, 72].find((x) => largeur % x === 0) ?? 54;
      n = Math.max(1, Math.round(largeur / l));
    }
    const ratio = largeur / n / hauteur;
    const i = x.firstElementChild;
    if (!i) return;
    const k = Math.floor(n / 3);
    Object.assign(i.style, {backgroundImage: `url("${u}")`, backgroundSize: `${n * 100}% 100%`, backgroundPositionX: `${n > 1 ? (k / (n - 1)) * 100 : 0}%`});
    // l'image remplit son cadre (un peu rognée au besoin), sans bandes noires
    const W = x.clientWidth || 52;
    const H = x.clientHeight || 74;
    if (ratio >= W / H) Object.assign(i.style, {height: `${H}px`, width: `${Math.round(H * ratio)}px`});
    else Object.assign(i.style, {width: `${W}px`, height: `${Math.round(W / ratio)}px`});
    x.dataset.n = n;
    x.dataset.k = k;
    x.classList.add('pret');
  }
  function demanderImage(x) {
    x.classList.add('attend');
    image(x.dataset.tbImg).then((u) => {
      x.classList.remove('attend');
      if (!u || !x.isConnected) return;
      if (x.dataset.mode === 'planche') return poserPlanche(x, u);
      x.style.backgroundImage = `url("${u}")`;
      x.classList.add('pret');
    });
  }
  /**
   * Pose les images du tableau. Celles du contenu (une vignette par vidéo, parfois des centaines) ne partent qu'à
   * 400 px de l'écran : à l'ouverture, seules celles qu'on voit sont demandées.
   */
  function poserImages() {
    if (!el) return;
    const c = $('#tb-contenu');
    // on repart de zéro à chaque dessin : les lignes remplacées ne sont plus guettées
    guetteur?.disconnect();
    if (!guetteur && c && 'IntersectionObserver' in window) {
      guetteur = new IntersectionObserver((vues) => {
        for (const v of vues) if (v.isIntersecting) { guetteur.unobserve(v.target); if (v.target.isConnected && !v.target.matches('.pret, .attend')) demanderImage(v.target); }
      }, {root: c, rootMargin: '400px'});
    }
    for (const x of el.querySelectorAll('[data-tb-img]:not(.pret):not(.attend)')) {
      if (guetteur && c?.contains(x)) guetteur.observe(x);
      else demanderImage(x);
    }
  }
  /** Au survol d'une vignette, on parcourt la vidéo comme dans la conversation. */
  function survol(e) {
    const v = e.target.closest?.('.tb-vig[data-n]');
    if (!v || !el?.contains(v)) return;
    const r = v.getBoundingClientRect();
    const n = Number(v.dataset.n);
    const k = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / Math.max(1, r.width)) * n)));
    if (v.firstElementChild) v.firstElementChild.style.backgroundPositionX = `${n > 1 ? (k / (n - 1)) * 100 : 0}%`;
  }
  function sortie(e) {
    const v = e.target.closest?.('.tb-vig[data-n]');
    if (!v || v.contains(e.relatedTarget)) return;
    const n = Number(v.dataset.n);
    const k = Number(v.dataset.k);
    if (v.firstElementChild) v.firstElementChild.style.backgroundPositionX = `${n > 1 ? (k / (n - 1)) * 100 : 0}%`;
  }

  // ——— les compteurs qui montent ———
  const FORMATS = {entier, compact, fois};
  function compter() {
    if (!el) return;
    const doux = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    for (const x of el.querySelectorAll('[data-tb-compte]')) {
      const fin = Number(x.dataset.tbCompte);
      const f = FORMATS[x.dataset.f] ?? entier;
      const k = x.dataset.k ?? '';
      const debut = deja.has(k) ? deja.get(k) : 0;
      deja.set(k, fin);
      if (doux || debut === fin || !Number.isFinite(fin)) { x.textContent = f(fin); continue; }
      x.textContent = f(debut);
      const t0 = performance.now();
      const long = 950;
      const pas = (t) => {
        if (!x.isConnected) return;
        const p = Math.min(1, (t - t0) / long);
        x.textContent = f(debut + (fin - debut) * (1 - (1 - p) ** 3));
        if (p < 1) requestAnimationFrame(pas);
      };
      requestAnimationFrame(pas);
      // une fenêtre cachée ne dessine pas : le bon chiffre arrive quand même
      setTimeout(() => { if (x.isConnected) x.textContent = f(fin); }, long + 120);
    }
  }
  const compte = (nom, valeur, format = 'entier', cls = 'tb-chiffre') => `<b class="${cls}" data-tb-compte="${Number(valeur) || 0}" data-k="${esc(`${actif}|${nom}`)}" data-f="${format}">${FORMATS[format](valeur)}</b>`;

  // ——— lecture ———
  async function chargerEspaces() {
    try { L = await api('GET', '/api/espaces'); } catch (err) { note(err.message, true); L ??= {espaces: [], metiers: {}}; }
    // Moi d'abord, puis les clients, et Personne à la fin
    const rang = {moi: 0, client: 1, neutre: 2};
    L.espaces = [...(L.espaces ?? [])].sort((a, b) => (rang[a.type] ?? 1) - (rang[b.type] ?? 1));
  }
  async function charger() {
    const n = ++demande;
    try {
      const r = await api('GET', `/api/tableau?espace=${encodeURIComponent(actif)}&periode=${encodeURIComponent(periode)}`);
      if (n !== demande || !el) return false;
      S = r;
      return true;
    } catch (err) {
      if (n === demande && el) note(err.message, true);
      return false;
    }
  }
  const enCours = () => [S?.analyses?.recette, S?.analyses?.lecture].some((a) => a?.etat === 'en_cours');
  function suivre() {
    clearTimeout(minuterie);
    const travaille = enCours();
    if (travaillait && !travaille && el) {
      const a = S?.analyses ?? {};
      if (![a.recette, a.lecture].some((x) => x?.etat === 'erreur')) note('L’analyse est finie : tout est à jour.', false, true);
    }
    travaillait = travaille;
    if (!el || !travaille) return;
    minuterie = setTimeout(async () => { if (await charger()) rendre(); suivre(); }, 2000);
  }
  /** Quand une feuille ouverte ailleurs (réglages de l'espace, carnet) se ferme, on relit tout. */
  function apresFeuille() {
    clearInterval(guet);
    let vue = false;
    const debut = Date.now();
    guet = setInterval(async () => {
      if (!el) return clearInterval(guet);
      const ouverte = !!o.feuilleOuverte?.();
      if (ouverte) vue = true;
      if (!vue && Date.now() - debut > 4000) return clearInterval(guet);
      if (vue && !ouverte) {
        clearInterval(guet);
        await chargerEspaces();
        if (!espaceDe(actif)) actif = 'moi';
        if (await charger()) rendre();
        suivre();
      }
    }, 400);
  }

  // ——— la colonne de gauche : pour qui ———
  function rendreGauche() {
    const g = $('#tb-gauche');
    if (!g || !L) return;
    const ligne = (e, i) => {
      const sous = e.type === 'neutre' ? 'n’apprend rien' : !e.apprend ? 'n’apprend pas' : e.metier?.type ? (L.metiers?.[e.metier.type]?.nom ?? e.metier.type) : 'métier à choisir';
      return `${e.type === 'neutre' ? '<i class="tb-esp-sep"></i>' : ''}<button class="tb-esp${e.id === actif ? ' actif' : ''}${e.type === 'neutre' ? ' neutre' : ''}${e.type !== 'neutre' && !e.apprend ? ' muet' : ''}" data-tb="espace" data-id="${esc(e.id)}" style="--c:${esc(couleur(e))};--i:${i}" title="${esc(metierDe(e) ?? e.nom)}">
        ${avatar(e)}<span class="tb-esp-txt"><b>${esc(e.nom)}</b><small>${esc(sous)}</small></span>${e.id === actif ? `<i class="tb-esp-fleche">${ic('suiv')}</i>` : ''}</button>`;
    };
    const html = `<h4>Pour qui</h4><nav class="tb-espaces">${L.espaces.map(ligne).join('')}</nav>
      <p class="cr-rassure tb-rassure">${ic('cadenas')}<span>Chaque espace garde ses chiffres, son carnet et sa recette. Un client ne reçoit jamais ton style, et « Personne » ne garde rien.</span></p>
      ${espaceDe('moi') ? `<button class="btn tb-profil" data-tb="profil">${ic('profil')}<span>Mon profil de créateur</span></button>` : ''}`;
    if (html === g.dataset.cle) return;
    // la liste n'entre en glissant qu'une fois : ensuite, seul l'espace choisi change
    g.classList.toggle('tb-calme', !!g.dataset.cle);
    g.dataset.cle = html;
    g.innerHTML = html;
    poserImages();
  }

  // ——— le contenu ———
  const section = (id, titre, sous, actions, corps, cls = '') => `<section class="tb-section tb-entre ${cls}" id="${id}">
    <div class="tb-section-tete"><div><h3>${titre}</h3>${sous ? `<small>${sous}</small>` : ''}</div><span class="espace"></span>${actions}</div>${corps}</section>`;

  function tete() {
    const e = S.espace;
    const le = espaceDe(e.id) ?? e;
    const c = couleur(le);
    const metier = metierDe(e);
    const apprend = e.apprend && e.type !== 'neutre';
    return `<header class="tb-tete tb-entre" style="--c:${esc(c)}">
      ${avatar(le, true)}
      <div class="tb-tete-txt"><small class="tb-genre">${GENRES[e.type] ?? ''}<i>${esc(PHRASES[e.type] ?? '')}</i></small><h2>${esc(e.nom)}</h2>
        ${e.type === 'neutre' ? '<p>Un espace sans mémoire : pour un essai, un dépannage, un projet à part.</p>' : `<p>${metier ? esc(metier) : `Métier pas encore choisi <button class="btn lien petit" data-tb="reglages">Le choisir</button>`}</p>`}</div>
      <div class="tb-tete-act">
        ${apprend ? `<div class="segmente tb-periode">${PERIODES.map(([k, t]) => `<button data-tb="periode" data-p="${k}"${k === S.periode ? ' class="actif"' : ''}>${t}</button>`).join('')}</div>` : ''}
        <button class="btn" data-tb="reglages">${ic('reglages')}<span>Réglages de l’espace</span></button>
        ${apprend ? `<button class="btn" data-tb="exporter"${S.chiffres.montages ? '' : ' disabled'} title="Un bilan en texte, rangé dans le dossier de Dérush et montré dans le Finder">${ic('importer')}<span>Exporter le bilan</span></button>` : ''}
      </div>
    </header>`;
  }

  function tuiles() {
    const c = S.chiffres;
    const m = c.multiple_median;
    const meds = Object.entries(S.medianes ?? {}).filter(([, x]) => x?.valeur > 0);
    const chrono = [...S.videos].filter((v) => v.vues != null).sort((a, b) => String(a.quand).localeCompare(String(b.quand))).slice(-14);
    const maxi = Math.max(1, ...chrono.map((v) => v.vues));
    const tuile = (i, icone, teinte, chiffre, nom, sous, cls = '') => `<article class="tb-tuile ${cls}" style="--i:${i};--t:${teinte}">
      <span class="tb-tuile-ic">${icone}</span>${chiffre}<span class="tb-tuile-nom">${nom}</span>${sous ? `<small>${sous}</small>` : ''}</article>`;
    return `<section class="tb-tuiles tb-entre">
      ${tuile(0, ic('film'), 'var(--braise-1)', compte('montages', c.montages), pl(c.montages, 'montage livré', 'montages livrés'), periodeTexte())}
      ${tuile(1, ic('publier'), 'var(--bleu)', compte('publies', c.publies), pl(c.publies, 'publié', 'publiés'), c.montages ? `${Math.round((c.publies / c.montages) * 100)} % des montages` : '')}
      ${tuile(2, ic('oeil'), 'var(--cyan)', compte('vues', c.vues, 'compact'), 'vues', chrono.length > 1
        ? `<span class="tb-mini-barres" title="Les vues de chaque vidéo, de la plus ancienne à la plus récente">${chrono.map((v, i) => `<i class="${classeMultiple(v.multiple)}" style="--h:${Math.max(6, Math.round((v.vues / maxi) * 100))}%;--j:${i}"></i>`).join('')}</span>`
        : 'toutes publications confondues')}
      ${tuile(3, ic('eclair'), m == null ? 'var(--dim)' : m >= 1.5 ? 'var(--vert)' : m <= 0.7 ? 'var(--orange)' : 'var(--braise-1)',
        m == null ? '<b class="tb-chiffre tb-rien">—</b>' : `<span class="tb-chiffre tb-fois"><i>×</i>${compte('multiple', m, 'fois', 'tb-fois-n')}</span>`,
        laMediane(),
        m == null ? 'Il faut des vues pour comparer.' : `Vues ÷ la médiane du compte${meds.length ? ` <span class="tb-medianes">${meds.map(([r, x]) => `<span title="Médiane de ${esc(nomReseau(r))}${x.n ? `, sur ${esc(x.n)} vidéos` : ''}">${logo(r, 13)}${compact(x.valeur)}</span>`).join('')}</span>` : ''}`,
        `tb-multiple ${classeMultiple(m)}`)}
      ${tuile(4, ic('pouce'), 'var(--vert)', `<span class="tb-pouces"><span class="haut">${ic('pouce')}${compte('aimes', c.aimes)}</span><span class="bas">${ic('pouce', 'bas')}${compte('pas_aimes', c.pas_aimes)}</span></span>`,
        'avis', c.aimes + c.pas_aimes ? 'tes pouces sur les vidéos livrées' : 'note tes vidéos dans la conversation')}
    </section>`;
  }

  /** La vignette d'une vidéo : sa planche d'images si Dérush l'a faite, sinon une bobine. */
  function vignette(v, cls = '') {
    if (v?.vignettes) {
      return `<span class="tb-vig ${cls}" data-tb-img="/api/tableau/vignettes?espace=${encodeURIComponent(S.espace.id)}&cle=${encodeURIComponent(v.cle)}" data-mode="planche" data-duree="${esc(v.duree_s ?? '')}"><i></i></span>`;
    }
    return `<span class="tb-vig tb-sans-image ${cls}">${ill('bobine')}</span>`;
  }
  const badge = (m) => (m == null ? '' : `<span class="tb-mult ${classeMultiple(m)}" title="Ses vues ÷ ${laMediane()}">×${fois(m)}</span>`);
  function avis(v) {
    if (v.note === 1) return `<span class="tb-avis haut">${ic('pouce')}<span>${v.mot ? `« ${esc(v.mot)} »` : 'Tu l’as aimée'}</span></span>`;
    if (v.note === -1) return `<span class="tb-avis bas">${ic('pouce', 'bas')}<span>${v.mot ? `« ${esc(v.mot)} »` : 'Pas comme ça'}</span></span>`;
    if (v.mot) return `<span class="tb-avis">${ic('crayon')}<span>« ${esc(v.mot)} »</span></span>`;
    return '<span class="tb-avis tb-rien">Pas encore d’avis</span>';
  }
  /** La petite courbe des vues : 0 à la publication, puis J+1, J+7, J+30 (toutes ses publications additionnées). */
  function courbe(v) {
    const pubs = v.publications ?? [];
    if (!pubs.length) return '<span class="tb-courbe-vide">—</span>';
    const parJour = new Map();
    for (const p of pubs) for (const l of p.lectures ?? []) if (l.vues != null) parJour.set(l.jours, (parJour.get(l.jours) ?? 0) + l.vues);
    const W = 128;
    const H = 42;
    const g = 7;
    const base = H - 12;
    const xs = (j) => g + Math.sqrt(Math.max(0, Math.min(30, j)) / 30) * (W - 2 * g);
    const points = [[0, 0], ...[...parJour].filter(([j]) => j > 0).sort((a, b) => a[0] - b[0])];
    const maxi = Math.max(1, ...points.map(([, n]) => n));
    const ys = (n) => 4 + (1 - n / maxi) * (base - 4);
    const xy = points.map(([j, n]) => [xs(j), ys(n)]);
    const trace = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const aire = `${trace} L${xy.at(-1)[0].toFixed(1)} ${base} L${xy[0][0].toFixed(1)} ${base} Z`;
    const repere = JOURS.map((j) => {
      const lu = parJour.has(j);
      return `<text x="${xs(j).toFixed(1)}" y="${H - 1}" text-anchor="middle">J+${j}</text>${lu ? '' : `<circle class="tb-a-venir" cx="${xs(j).toFixed(1)}" cy="${base}" r="2.6"/>`}`;
    }).join('');
    const titre = JOURS.map((j) => `J+${j} : ${parJour.has(j) ? `${entier(parJour.get(j))} vues` : 'à venir'}`).join(' · ');
    return `<svg class="tb-courbe ${classeMultiple(v.multiple)}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(titre)}"><title>${esc(titre)}</title>
      <line x1="${g}" y1="${base}" x2="${W - g}" y2="${base}" class="tb-sol"/><path d="${aire}" class="tb-aire"/><path d="${trace}" class="tb-ligne" pathLength="1"/>
      ${xy.slice(1).map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.8" class="tb-point"/>`).join('')}${repere}</svg>`;
  }
  function ligneVideo(v, i) {
    const pubs = v.publications ?? [];
    const meta = [jour(v.quand), duree(v.duree_s)].filter(Boolean).join(' · ');
    return `<article class="tb-video" style="--i:${Math.min(i, 14)}">
      ${vignette(v)}
      <div class="tb-video-txt"><b title="${esc(v.titre)}">${esc(v.titre)}</b>
        <small>${esc(meta)}${v.serie ? `<span class="tb-serie-pastille" title="Un épisode de la série « ${esc(v.serie)} »">${ic('dupliquer')}${esc(v.serie)}</span>` : ''}</small>
        ${avis(v)}</div>
      <div class="tb-video-courbe">${courbe(v)}</div>
      <div class="tb-video-vues">${pubs.length ? `<b>${v.vues != null ? compact(v.vues) : '—'}</b>${badge(v.multiple)}` : '<small class="tb-pas-publiee">Pas encore publiée</small>'}</div>
      <div class="tb-video-act">
        ${pubs.length ? `<span class="tb-pubs">${pubs.map((p) => (p.lien
          ? `<button class="tb-pub" data-tb="lien" data-url="${esc(p.lien)}" title="Voir sur ${esc(nomReseau(p.reseau))}${p.vues != null ? ` · ${entier(p.vues)} vues` : ''}">${logo(p.reseau, 22)}</button>`
          : `<span class="tb-pub" title="${esc(nomReseau(p.reseau))} : brouillon, pas encore de lien">${logo(p.reseau, 22)}</span>`)).join('')}</span>` : ''}
        ${v.dossier ? `<button class="btn petit" data-tb="ouvrir" data-cle="${esc(v.cle)}" title="Fermer le tableau et ouvrir ce projet">${ic('dossier')}<span>Ouvrir le projet</span></button>` : ''}
      </div>
    </article>`;
  }
  function listeVideos() {
    const vs = [...S.videos];
    if (tri === 'meilleures') vs.sort((a, b) => (b.multiple ?? -1) - (a.multiple ?? -1) || (b.vues ?? 0) - (a.vues ?? 0));
    return `<div class="tb-liste-tete"><span></span><span>Vidéo</span><span>Vues, J+1 → J+30</span><span>Vues</span><span>Publiée sur</span></div>${vs.map(ligneVideo).join('')}`;
  }

  function podium(x, sens) {
    if (!x) return '';
    const v = S.videos.find((y) => y.titre === x.titre && y.multiple === x.multiple) ?? S.videos.find((y) => y.titre === x.titre);
    const reseaux = [...new Set((v?.publications ?? []).map((p) => p.reseau))];
    return `<article class="tb-podium ${sens}">
      ${vignette(v, 'grande')}
      <div class="tb-podium-txt">
        <small class="tb-podium-quoi">${sens === 'haut' ? `${ic('etoile', 'plein')}Ta meilleure` : `${ic('attention')}La moins bonne`}</small>
        <div class="tb-podium-chiffre"><b>×${fois(x.multiple)}</b><span>${laMediane()}${x.vues != null ? `<br>${entier(x.vues)} vues` : ''}</span></div>
        <h4 title="${esc(x.titre)}">${esc(x.titre)}</h4>
        <div class="tb-podium-pied">${reseaux.map((r) => logo(r, 18)).join('')}${v?.mot ? `<span class="tb-podium-mot">« ${esc(v.mot)} »</span>` : ''}
          ${v?.dossier ? `<span class="espace"></span><button class="btn petit" data-tb="ouvrir" data-cle="${esc(v.cle)}">${ic('dossier')}<span>Ouvrir</span></button>` : ''}</div>
      </div>
    </article>`;
  }

  function banniereTreg() {
    const suivies = S.videos.some((v) => (v.publications ?? []).some((p) => p.suivi === 'treg'));
    if (S.cle_treg || (!suivies && !sansCle)) return '';
    return `<div class="tb-treg${sansCle ? ' insiste' : ''}" id="tb-treg">${logo('treg', 30)}<div><b>Branche Treg pour relire tes vues YouTube et TikTok</b>
      <small>Dérush les relit tout seul à J+1, J+7 et J+30, en lecture seule. Sans Treg, les chiffres restent ceux de la dernière lecture.</small></div>
      <button class="btn bleu" data-tb="treg">${ic('relais')}<span>Relier mes réseaux</span></button></div>`;
  }

  function sectionVideos() {
    const aDesPubs = S.videos.some((v) => (v.publications ?? []).length);
    const actions = `<div class="segmente tb-tri">${[['recentes', 'Les plus récentes'], ['meilleures', 'Les meilleures']].map(([k, t]) => `<button data-tb="tri" data-t="${k}"${k === tri ? ' class="actif"' : ''}>${t}</button>`).join('')}</div>
      <button class="btn petit" data-tb="relire" title="Relire les vues des vidéos publiées (YouTube et TikTok, avec Treg)">${ic('maj')}<span>Relire les vues</span></button>
      ${S.espace.type === 'moi' && aDesPubs ? `<button class="btn petit claude-doux" data-tb="relire-ia" title="Instagram, ou tout réseau sans clé Treg : ton IA relit les chiffres avec Treg, en lecture seule">${ic('etincelle', 'plein')}<span>Faire relire par mon IA</span></button>` : ''}`;
    return section('tb-videos', 'Tes vidéos', `${S.videos.length} ${pl(S.videos.length, 'montage livré', 'montages livrés')} ${periodeTexte()}`, actions,
      `${banniereTreg()}<div id="tb-suivi-lecture"></div><div class="tb-liste" id="tb-liste">${listeVideos()}</div>`);
  }

  /**
   * Une carte de la recette : un trait (ou plusieurs qui vont ensemble : les mêmes vidéos, les mêmes chiffres), son
   * multiple contre celui des autres vidéos de l'espace, en barres et en mots.
   */
  function trait(p, i) {
    const g = p.membres[0];
    const m = g.multiple_median;
    const maxi = Math.max(1.2, m ?? 0, g.autres ?? 0);
    const pct = (x) => `${Math.max(2, Math.round(((x ?? 0) / maxi) * 100))}%`;
    const valeur = (x) => (x.trait === 'reseau' ? `${logo(x.valeur, 16)}${esc(nomReseau(x.valeur))}` : esc(String(x.valeur).replace(/^./, (c) => c.toUpperCase())));
    const quoi = g.trait === 'reseau' ? pl(g.n, 'publication') : pl(g.n, 'vidéo');
    const contre = g.autres != null ? `, contre ${fois(g.autres)}× pour les autres` : '';
    const phrase = g.verdict === 'a_essayer' ? `${fois(m)}× ${laMediane()} sur ${g.n} ${quoi} seulement : à confirmer${contre}.` : `${fois(m)}× ${laMediane()} sur ${g.n} ${quoi}${contre}.`;
    const aimees = Math.max(...p.membres.map((x) => x.aimees ?? 0));
    return `<div class="tb-trait" style="--i:${i}">
      <div class="tb-trait-tete"><b class="tb-trait-fois">×${fois(m)}</b>${aimees ? `<span class="tb-trait-aime" title="Tu en as aimé ${aimees}">${ic('pouce')}${aimees}</span>` : ''}</div>
      <ul class="tb-trait-noms">${p.membres.map((x) => `<li>${String(x.valeur).toLowerCase() === String(x.nom_trait).toLowerCase() ? '' : `<small>${esc(x.nom_trait)}</small>`}<b>${valeur(x)}</b></li>`).join('')}</ul>
      <div class="tb-barres" style="--un:${pct(1)}" title="Le trait blanc : ${laMediane()} (×1)">
        <span class="lui"><i style="--l:${pct(m)}"></i><em>×${fois(m)}</em></span>
        ${g.autres != null ? `<span class="autres"><i style="--l:${pct(g.autres)}"></i><em>×${fois(g.autres)}</em></span>` : ''}
      </div>
      <p>${phrase}${p.membres.length > 1 ? ' Ces traits vont ensemble : ce sont les mêmes vidéos.' : ''}</p></div>`;
  }
  /** Les traits d'un même verdict, ceux qui ont exactement les mêmes chiffres rangés dans une seule carte. */
  function paquets(gs) {
    const m = new Map();
    for (const g of gs) {
      const k = [g.trait === 'reseau' ? 'r' : 'v', g.n, g.multiple_median, g.autres].join('|');
      if (!m.has(k)) m.set(k, {membres: []});
      m.get(k).membres.push(g);
    }
    return [...m.values()];
  }
  function avisIA(ia) {
    const liste = (titre, icone, l, f, cls = '') => (l?.length ? `<div class="tb-ia-liste ${cls}"><h5>${titre}</h5><ul class="cr-liste">${l.map((x) => { const [a, b] = f(x); return `<li>${ic(icone)}<span>${esc(a)}${b ? `<small>${esc(b)}</small>` : ''}</span></li>`; }).join('')}</ul></div>` : '');
    const moteur = ia.moteur ?? 'claude';
    return `<article class="tb-ia">
      <header>${logo(moteur, 28)}<div><b>Ce qu’en dit ${esc(o.nomIA?.(moteur) ?? 'ton IA')}</b><small>Analyse du ${jour(ia.ecrite_le)}${ia.duree_s ? `, en ${Math.max(1, Math.round(ia.duree_s / 60))} min` : ''}</small></div></header>
      ${ia.resume ? `<p class="tb-ia-resume selectionnable">${esc(ia.resume)}</p>` : ''}
      <div class="tb-ia-cols">
        ${liste('Ça marche', 'coche', ia.ca_marche, (x) => [x.quoi, x.preuve], 'marche')}
        ${liste('À éviter', 'attention', ia.a_eviter, (x) => [x.quoi, x.preuve], 'eviter')}
        ${liste('À essayer', 'etincelle', ia.a_essayer, (x) => [x.quoi, x.pourquoi], 'essayer')}
      </div>
      ${ia.quand_publier?.length ? `<div class="tb-quand"><h5>Quand publier</h5><div>${ia.quand_publier.map((q) => `<span>${logo(q.reseau, 20)}<span><b>${esc(q.quand)}</b>${q.pourquoi ? `<small>${esc(q.pourquoi)}</small>` : ''}</span></span>`).join('')}</div></div>` : ''}
      ${ia.limites ? `<p class="tb-limites">${ic('attention')}<span>${esc(ia.limites)}</span></p>` : ''}
    </article>`;
  }
  function sectionRecette() {
    const r = S.recette;
    if (!r) return '';
    const n = r.n_mesures ?? 0;
    const groupes = r.groupes ?? [];
    let corps;
    if (n < 3) {
      corps = `<div class="tb-pas-assez"><div class="tb-points">${[0, 1, 2].map((i) => `<i class="${i < n ? 'plein' : ''}" style="--i:${i}">${ic(i < n ? 'coche' : 'film')}</i>`).join('')}</div>
        <div><b>Encore ${3 - n} ${pl(3 - n, 'vidéo publiée avec ses vues', 'vidéos publiées avec leurs vues')}</b><p>Il faut au moins 3 vidéos publiées pour comparer ce qui marche. ${n ? `Pour l’instant : ${n} sur 3.` : 'Publie depuis Dérush, ou colle le lien de ta vidéo publiée sur sa carte, dans le projet : Dérush suit ses vues.'}</p></div></div>`;
    } else if (!groupes.length) {
      corps = '<div class="tb-pas-assez"><div class="tb-points">' + [0, 1, 2].map((i) => `<i class="plein" style="--i:${i}">${ic('coche')}</i>`).join('') + '</div><div><b>Rien ne se détache encore</b><p>Tes vidéos marchent à peu près pareil, quels que soient leur durée, leur accroche ou leur réseau. Essaie quelque chose de nouveau : ça se verra ici.</p></div></div>';
    } else {
      const col = (verdict, titre, icone) => {
        const gs = groupes.filter((g) => g.verdict === verdict);
        return gs.length ? `<div class="tb-colonne ${verdict}"><h4>${ic(icone)}${titre}<span>${gs.length}</span></h4><div class="tb-traits">${paquets(gs).map(trait).join('')}</div></div>` : '';
      };
      corps = `<div class="tb-recette">${col('marche', 'Ça marche', 'coche')}${col('marche_moins', 'Ça marche moins', 'attention')}${col('a_essayer', 'À essayer', 'etincelle')}</div>`;
    }
    const sous = `D’après ${r.n_montages} ${pl(r.n_montages, 'montage')}${n ? `, dont ${n} avec ${pl(n, 'ses vues', 'leurs vues')}` : ''}, depuis le début. Des repères, pas des règles : un trait qui marche n’en est pas forcément la cause.`;
    return section('tb-ce-qui-marche', 'Ce qui marche', sous, '', `${corps}${r.ia ? avisIA(r.ia) : ''}<div id="tb-suivi-recette"></div>`);
  }
  function boutonAnalyser() {
    const n = S.recette?.n_montages ?? 0;
    const ia = S.recette?.ia;
    return `<div class="tb-lancer"><button class="btn claude" data-tb="analyser"${n ? '' : ' disabled'}>${ic('etincelle', 'plein')}<span>Analyser avec mon IA</span></button>
      <small>${n ? `${esc(nomIA())} lit les fiches de ${S.espace.type === 'client' ? `ses montages pour ${esc(S.espace.nom)}` : 'tes montages'} et leurs vues, puis écrit ce qui marche et des idées de sujets.${ia?.ecrite_le ? ` Dernière analyse : ${jour(ia.ecrite_le).replace(/\.$/, '')}.` : ''}` : 'Il faut au moins un montage livré dans cet espace.'}</small></div>`;
  }
  function suiviIA(a, quoi) {
    if (!a) return '';
    if (a.etat === 'en_cours') {
      return `<div class="tb-travail"><div class="tb-travail-ill">${ill('bobine')}</div>
        <div class="tb-travail-txt"><b>${esc(a.nom_ia ?? nomIA())} ${quoi === 'recette' ? 'écrit ta recette et cherche des idées' : 'relit tes vues avec Treg'}</b><small>${esc(a.etape ?? 'Elle démarre…')}</small><span class="tb-barre-ia"><i></i></span></div>
        <span class="tb-duree">${minutes(a.depuis_s)}</span><button class="btn petit" data-tb="arreter">${ic('stop')}<span>Arrêter</span></button></div>`;
    }
    if (a.etat === 'erreur') {
      const arretee = /arr[eê]t/i.test(a.erreur ?? '');
      return `<div class="tb-travail ${arretee ? 'arretee' : 'erreur'}">${ic(arretee ? 'stop' : 'attention')}<div class="tb-travail-txt"><b>${arretee ? 'Analyse arrêtée' : quoi === 'recette' ? 'L’analyse n’a pas abouti' : 'La relecture n’a pas abouti'}</b>${arretee ? '' : `<small>${esc(a.erreur ?? '')}</small>`}</div></div>`;
    }
    return '';
  }
  /** Pose le suivi d'une analyse ; pendant qu'elle tourne, seuls l'étape et le temps changent (rien ne clignote). */
  function poserSuivi(boite, a, html) {
    if (!boite) return;
    if (a?.etat === 'en_cours' && boite.dataset.etat === 'en_cours') {
      const etape = boite.querySelector('.tb-travail-txt small');
      if (etape) etape.textContent = a.etape ?? 'Elle démarre…';
      const d = boite.querySelector('.tb-duree');
      if (d) d.textContent = minutes(a.depuis_s);
      return;
    }
    const cle = html;
    if (boite.dataset.cle === cle) return;
    boite.dataset.cle = cle;
    boite.dataset.etat = a?.etat ?? '';
    boite.innerHTML = html;
  }
  function majSuivis() {
    if (!el || !S) return;
    const a = S.analyses ?? {};
    poserSuivi($('#tb-suivi-recette'), a.recette, a.recette?.etat === 'en_cours' ? suiviIA(a.recette, 'recette') : `${suiviIA(a.recette, 'recette')}${boutonAnalyser()}`);
    poserSuivi($('#tb-suivi-lecture'), a.lecture, suiviIA(a.lecture, 'lecture'));
    for (const b of el.querySelectorAll('[data-tb="analyser"]')) b.disabled = a.recette?.etat === 'en_cours' || !(S.recette?.n_montages);
    for (const b of el.querySelectorAll('[data-tb="relire-ia"]')) b.disabled = a.lecture?.etat === 'en_cours';
  }

  function sectionIdees() {
    const ia = S.recette?.ia;
    if (!S.recette) return '';
    const p = ia?.prochaine_video;
    // l'idée déjà mise en avant comme « prochaine vidéo » ne se répète pas dans la liste (le numéro reste le sien)
    const pareil = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
    const idees = (ia?.idees ?? []).map((x, i) => ({...x, i})).filter((x) => !p || !pareil(x.sujet, p.sujet));
    if (!p && !idees.length) {
      return section('tb-idees', 'Idées de sujets', '', '', `<div class="tb-idees-vide"><div class="tb-ill-petite">${ill('claude')}</div><div><b>Des idées faites pour ${S.espace.type === 'client' ? esc(S.espace.nom) : 'toi'}</b>
        <p>Ton IA en propose quand elle analyse cet espace : ce qui a déjà plu, ${S.espace.type === 'client' ? 'son métier' : 'ton métier'}, l’actualité de la niche.</p>
        <button class="btn claude-doux petit" data-tb="analyser"${S.recette.n_montages ? '' : ' disabled'}>${ic('etincelle', 'plein')}<span>Analyser avec mon IA</span></button></div></div>`);
    }
    const prochaine = p ? `<article class="tb-prochaine"><div class="tb-prochaine-txt"><small>${ic('etincelle', 'plein')}Ta prochaine vidéo</small><h3>${esc(p.sujet)}</h3>
        ${p.pourquoi ? `<p class="selectionnable">${esc(p.pourquoi)}</p>` : ''}
        <div class="tb-prochaine-infos">${p.accroche ? `<span>${ic('titre')}<span>Accroche : ${esc(p.accroche)}</span></span>` : ''}${p.duree ? `<span>${ic('horloge')}<span>${esc(p.duree)}</span></span>` : ''}</div></div>
        <button class="btn claude grand" data-tb="prochaine">${ic('plus')}<span>Monter cette vidéo</span></button></article>` : '';
    const liste = idees.length ? `<div class="tb-idees">${idees.map((x, i) => `<div class="tb-idee" style="--i:${i}">
        <button class="tb-puce" data-tb="idee" data-i="${x.i}" title="Nouveau projet sur ce sujet">${ic('etincelle', 'plein')}<span>${esc(x.sujet)}</span>${ic('plus', 'tb-puce-plus')}</button>
        ${x.pourquoi ? `<p class="selectionnable">${esc(x.pourquoi)}</p>` : ''}
        ${x.format || x.accroche ? `<small>${esc([x.format, x.accroche ? `accroche : ${x.accroche}` : ''].filter(Boolean).join(' · '))}</small>` : ''}
        ${x.source ? `<button class="btn lien petit tb-source" data-tb="lien" data-url="${esc(x.source)}" title="${esc(x.source)}">${ic('lien')}<span>${esc(hote(x.source))}</span></button>` : ''}</div>`).join('')}</div>` : '';
    const plaisent = ia?.sujets_qui_plaisent?.length ? `<div class="cr-puces mots tb-plaisent"><small>Les sujets qui plaisent</small>${ia.sujets_qui_plaisent.map((s) => `<span>${esc(s)}</span>`).join('')}</div>` : '';
    return section('tb-idees', 'Idées de sujets', 'Un clic sur une idée ouvre un nouveau projet, déjà nommé.', '', `${prochaine}${liste}${plaisent}`);
  }

  function sectionSeries() {
    const ss = S.series ?? [];
    const corps = ss.length ? `<div class="tb-series">${ss.map((s, i) => `<article class="tb-serie" style="--i:${i}">
        <div class="tb-apercu"${s.apercu ? ` data-tb-img="/api/espaces/${encodeURIComponent(S.espace.id)}/series/${encodeURIComponent(s.id)}" data-mode="apercu"` : ''}>${s.apercu ? '' : ill('extraits')}<span class="tb-episodes">${s.episodes ?? 0} ${pl(s.episodes ?? 0, 'épisode')}</span></div>
        <div class="tb-serie-txt"><b>${esc(s.nom)}</b><small>${s.depuis?.titre ? `Modèle : « ${esc(s.depuis.titre)} »` : `Créée le ${jour(s.cree_le)}`}</small></div>
        <div class="tb-serie-act"><button class="btn bleu petit" data-tb="episode" data-sid="${esc(s.id)}">${ic('plus')}<span>Nouvel épisode</span></button><span class="espace"></span>
          <button class="icone-btn" data-tb="retirer-serie" data-sid="${esc(s.id)}" title="Retirer la série">${ic('poubelle')}</button></div></article>`).join('')}</div>`
      : `<div class="tb-series-vide"><div class="tb-ill-petite">${ill('extraits')}</div><p>Quand un montage te plaît, fais-en une série depuis sa carte, dans la conversation : les épisodes suivants reprennent son accroche, son habillage, sa musique et son rythme. Seul le contenu change.</p></div>`;
    return section('tb-series', 'Séries', 'Comme d’habitude : un montage réussi devient un modèle.', '', corps, 'tb-moitie');
  }
  function sectionCarnet() {
    const n = S.carnet ?? 0;
    const pour = S.espace.type === 'client' ? `pour ${esc(S.espace.nom)}, et seulement pour ses montages` : 'de tes demandes, et le relit avant chaque montage';
    return section('tb-carnet', 'Carnet', '', '', `<div class="tb-carnet-carte"><span class="tb-carnet-ic">${ic('texte')}</span>
      <div><div class="tb-carnet-n">${compte('carnet', n)}<span>${pl(n, 'leçon')}</span></div><p>Ce que l’IA a retenu ${pour}.</p></div>
      <button class="btn" data-tb="carnet">${ic('oeil')}<span>Ouvrir le carnet</span></button></div>`, 'tb-moitie');
  }
  const rangee = () => (S.espace.type === 'neutre' ? '' : `<div class="tb-rangee">${sectionSeries()}${sectionCarnet()}</div>`);

  // ——— les états vides ———
  function vueNeutre() {
    return `<div class="pa-vide tb-vide tb-neutre tb-entre"><div class="tb-ill gris">${ill('rushes')}</div>
      <h2>Personne : rien n’est appris</h2>
      <p>Un montage neutre : ni ton style, ni ton carnet, ni tes chiffres, ni la marque d’un client. Rien n’est gardé, rien de toi n’est donné à l’IA. Pratique pour un essai, un dépannage, ou un projet à garder à part.</p>
      <ul class="tb-promesses">
        <li>${ic('cadenas')}<span><b>Aucune trace</b>Pas de fiche, pas de suivi des vues, pas de recette.</span></li>
        <li>${ic('profil')}<span><b>Rien de toi</b>Ni ton profil ni ton carnet ne partent à l’IA.</span></li>
        <li>${ic('mallette')}<span><b>Rien d’un client</b>Aucune marque, aucun kit, aucune habitude.</span></li>
      </ul>
      <button class="btn principal grand" data-tb="nouveau">${ic('plus')}<span>Nouveau projet neutre</span></button></div>`;
  }
  function vueMuette() {
    return `<div class="pa-vide tb-vide tb-entre"><div class="tb-ill gris">${ILL_TABLEAU}</div>
      <h2>Cet espace n’apprend pas</h2>
      <p>Ses montages ne sont ni mesurés ni suivis, et l’IA ne reçoit pas son carnet. Réactive l’apprentissage pour voir ici ses vidéos, leurs vues et ce qui marche.</p>
      <button class="btn bleu grand" data-tb="reglages">${ic('reglages')}<span>Réactiver l’apprentissage</span></button></div>`;
  }
  function vueSansMontage() {
    const avant = S.recette?.n_montages ?? 0;
    if (avant && S.periode !== 'tout') {
      return `<div class="pa-vide tb-vide petit tb-entre"><div class="tb-ill">${ILL_TABLEAU}</div><h2>Rien ${periodeTexte()}</h2>
        <p>${avant} ${pl(avant, 'montage livré')} plus ${pl(avant, 'ancien')} dans cet espace.</p>
        <button class="btn bleu" data-tb="periode" data-p="tout">${ic('horloge')}<span>Voir depuis le début</span></button></div>`;
    }
    const pour = S.espace.type === 'client' ? ` pour ${esc(S.espace.nom)}` : '';
    return `<div class="pa-vide tb-vide tb-entre"><div class="tb-ill">${ILL_TABLEAU}</div>
      <h2>Rien de monté${pour} pour l’instant</h2>
      <p>Tes vidéos montées avec Dérush apparaîtront ici, avec leurs vues et ce qui marche.</p>
      <ul class="tb-promesses">
        <li>${ic('oeil')}<span><b>Leurs vues</b>Relues à J+1, J+7 et J+30, comparées à ${laMediane()}.</span></li>
        <li>${ic('eclair')}<span><b>Ce qui marche</b>L’accroche, la durée, le rythme : en chiffres, vidéo après vidéo.</span></li>
        <li>${ic('etincelle')}<span><b>Des idées de sujets</b>Faites pour ${S.espace.type === 'client' ? 'ce client' : 'toi'}, à monter en un clic.</span></li>
      </ul>
      <button class="btn principal grand" data-tb="nouveau">${ic('plus')}<span>Nouveau projet${pour}</span></button></div>`;
  }

  function contenu() {
    const e = S.espace;
    if (e.type === 'neutre') return tete() + vueNeutre();
    if (!e.apprend) return tete() + vueMuette() + rangee();
    // rien sur la période : la recette et les idées (faites sur tous les montages) restent utiles s'il y en a eu avant
    if (!S.videos.length) return tete() + vueSansMontage() + (S.recette?.n_montages ? sectionRecette() + sectionIdees() : '') + rangee();
    const duo = S.meilleure || S.moins_bonne ? `<section class="tb-duo tb-entre">${podium(S.meilleure, 'haut')}${podium(S.moins_bonne, 'bas')}</section>` : '';
    return tete() + tuiles() + duo + sectionVideos() + sectionRecette() + sectionIdees() + rangee();
  }

  function rendre() {
    if (!el) return;
    rendreGauche();
    const c = $('#tb-contenu');
    if (!c) return;
    c.classList.remove('tb-attente');
    if (!S) {
      c.innerHTML = `<div class="pa-vide tb-vide">${ic('attention')}<h2>Le tableau ne s’ouvre pas</h2><p>Dérush n’a pas pu lire cet espace. Réessaie dans un instant.</p><button class="btn" data-tb="relire-tout">${ic('maj')}<span>Réessayer</span></button></div>`;
      cleRendu = '';
      return;
    }
    const cle = JSON.stringify({...S, analyses: null, sansCle, tri});
    const vue = `${S.espace.id}|${S.periode}`;
    if (cle !== cleRendu) {
      const memeVue = vue === vueRendue;
      const haut = c.scrollTop;
      c.classList.toggle('tb-calme', memeVue);
      c.style.setProperty('--c', couleur(espaceDe(S.espace.id) ?? S.espace));
      c.innerHTML = contenu();
      c.scrollTo({top: memeVue ? haut : 0, behavior: 'instant'});
      cleRendu = cle;
      vueRendue = vue;
      compter();
      poserImages();
    }
    majSuivis();
  }

  // ——— les confirmations : rien ne part vers une IA sans un « oui » qui la nomme ———
  function confirmer({titre, texte, bouton, icone = 'etincelle', classe = 'claude', rassure = ''}) {
    return new Promise((ok) => {
      const f = o.feuille(`<h3>${titre}</h3><p class="sous-titre">${texte}</p>${rassure ? `<p class="cr-rassure">${ic('cadenas')}<span>${rassure}</span></p>` : ''}
        <div class="pied"><button class="btn" data-fermer>Annuler</button><span class="espace"></span><button class="btn ${classe}" data-tb-oui>${ic(icone, icone === 'etincelle' ? 'plein' : '')}<span>${bouton}</span></button></div>`);
      f.classList.add('tb-confirmer');
      f.addEventListener('click', (e) => {
        if (e.target.closest('[data-fermer]')) { o.fermerFeuille(); ok(false); }
        else if (e.target.closest('[data-tb-oui]')) { o.fermerFeuille(); ok(true); }
      });
      setTimeout(() => f.querySelector('[data-tb-oui]')?.focus(), 30);
    });
  }
  async function copier(texte) {
    if (o.copierTexte) return o.copierTexte(texte);
    if (window.__derushNatif && window.webkit?.messageHandlers?.derush) { try { window.webkit.messageHandlers.derush.postMessage({a: 'copier', texte}); return; } catch { /* plus bas */ } }
    try { await navigator.clipboard.writeText(texte); } catch {
      const z = Object.assign(document.createElement('textarea'), {value: texte});
      document.body.append(z);
      z.select();
      document.execCommand('copy');
      z.remove();
    }
  }

  // ——— les clics ———
  async function changerEspace(id) {
    if (!id || id === actif) return;
    actif = id;
    ecrirePref('tableau.espace', id);
    rendreGauche();
    $('#tb-contenu')?.classList.add('tb-attente');
    clearTimeout(minuterie);
    travaillait = false;
    if (await charger()) rendre();
    else if (el) {
      // l'espace ne s'est pas lu : on reste sur celui qui est affiché
      actif = S?.espace?.id ?? actif;
      rendreGauche();
      $('#tb-contenu')?.classList.remove('tb-attente');
    }
    suivre();
  }
  async function clic(e) {
    const b = e.target.closest('[data-tb]');
    if (!b || !el?.contains(b)) return;
    const a = b.dataset.tb;
    const video = () => S?.videos?.find((v) => v.cle === b.dataset.cle);
    try {
      if (a === 'fermer') return fermer();
      if (a === 'espace') return changerEspace(b.dataset.id);
      if (a === 'periode') {
        if (b.dataset.p === periode && S?.periode === periode) return;
        periode = b.dataset.p;
        ecrirePref('tableau.periode', periode);
        $('#tb-contenu')?.classList.add('tb-attente');
        if (await charger()) rendre();
        else if (el) { periode = S?.periode ?? periode; $('#tb-contenu')?.classList.remove('tb-attente'); }
        return;
      }
      if (a === 'tri') {
        tri = b.dataset.t === 'meilleures' ? 'meilleures' : 'recentes';
        ecrirePref('tableau.tri', tri);
        for (const x of el.querySelectorAll('[data-tb="tri"]')) x.classList.toggle('actif', x.dataset.t === tri);
        const l = $('#tb-liste');
        if (l) { l.innerHTML = listeVideos(); l.classList.add('tb-retrie'); poserImages(); }
        cleRendu = JSON.stringify({...S, analyses: null, sansCle, tri});
        return;
      }
      if (a === 'relire-tout') { await chargerEspaces(); if (await charger()) rendre(); return; }
      // les feuilles et les écrans des autres modules : attendus ici, pour qu'une erreur devienne une note
      if (a === 'reglages') { apresFeuille(); return await o.reglerEspace?.(S?.espace?.id ?? actif); }
      if (a === 'carnet') { apresFeuille(); return await o.carnet?.(S?.espace?.id ?? actif); }
      if (a === 'profil') { fermer(); return await o.profil?.(); }
      if (a === 'treg') return await o.guideTreg?.(async () => { sansCle = false; if (await charger()) rendre(); });
      if (a === 'ouvrir') {
        const v = video();
        if (v?.dossier) await o.ouvrirProjet?.(v.dossier);
        return;
      }
      if (a === 'lien') {
        const url = b.dataset.url;
        try { await api('POST', '/api/lien', {url}); } catch (err) {
          // le serveur n'ouvre que les grands sites (réseaux, IA…) : une autre source se copie
          if (/autoris/i.test(err.message)) { await copier(url); note('Lien copié : colle-le dans ton navigateur.'); } else throw err;
        }
        return;
      }
      if (a === 'nouveau') return await o.nouveauProjet?.({espace: S?.espace?.id ?? actif, serie: null, titre: ''});
      if (a === 'prochaine') { const p = S?.recette?.ia?.prochaine_video; return p && await o.nouveauProjet?.({espace: S.espace.id, serie: null, titre: p.sujet}); }
      if (a === 'idee') { const x = S?.recette?.ia?.idees?.[Number(b.dataset.i)]; return x && await o.nouveauProjet?.({espace: S.espace.id, serie: null, titre: x.sujet}); }
      if (a === 'episode') { const s = S?.series?.find((x) => x.id === b.dataset.sid); return s && await o.nouveauProjet?.({espace: S.espace.id, serie: {id: s.id, nom: s.nom}, titre: ''}); }
      if (a === 'retirer-serie') {
        const s = S?.series?.find((x) => x.id === b.dataset.sid);
        if (!s) return;
        const oui = await confirmer({titre: `Retirer la série « ${esc(s.nom)} » ?`, texte: 'Son modèle est effacé : « Nouvel épisode » ne le proposera plus. Les vidéos déjà montées ne bougent pas.', bouton: 'Retirer la série', icone: 'poubelle', classe: 'principal'});
        if (!oui) return;
        await api('DELETE', `/api/espaces/${encodeURIComponent(S.espace.id)}/series/${encodeURIComponent(s.id)}`);
        note(`La série « ${s.nom} » est retirée.`);
        if (await charger()) rendre();
        return;
      }
      if (a === 'exporter') {
        b.disabled = true;
        try {
          const r = await api('POST', '/api/tableau/rapport', {espace: S.espace.id, periode: S.periode});
          note(`Bilan enregistré : ${String(r.fichier ?? '').split(/[\\/]/).pop()}. Il s’ouvre dans le Finder.`);
        } finally { b.disabled = false; }
        return;
      }
      if (a === 'relire') {
        b.disabled = true;
        b.classList.add('tourne');
        let r = null;
        try { r = await api('POST', '/api/suivi/relire', {espace: S.espace.id}); } finally { b.disabled = false; b.classList.remove('tourne'); }
        if (r.sans_cle) { sansCle = true; note('Branche Treg pour relire tes vues YouTube et TikTok.', true); }
        else if (r.erreurs?.length) note(r.erreurs.join(' · '), true);
        else note(r.lues ? `${r.lues} ${pl(r.lues, 'lecture')} de vues ${pl(r.lues, 'ajoutée')}.` : 'Rien de neuf : tes vues sont à jour.');
        if (await charger()) rendre();
        if (sansCle) $('#tb-treg')?.scrollIntoView({behavior: 'smooth', block: 'center'});
        return;
      }
      if (a === 'relire-ia') {
        const nom = nomIA();
        const oui = await confirmer({titre: `Faire relire tes vues par ${esc(nom)} ?`,
          texte: `${esc(nom)} ouvre Treg et relève les vues que Dérush ne lit pas tout seul (Instagram, ou tout réseau sans clé Treg). Compte quelques minutes.`,
          bouton: `Lancer avec ${esc(nom)}`, rassure: 'Lecture seule : rien n’est publié, commenté ni modifié sur tes comptes.'});
        if (!oui || !el) return;
        const r = await api('POST', '/api/suivi/relire-ia', {espace: S.espace.id, moteur: o.moteurIA?.() ?? null});
        S.analyses = {recette: r.recette ?? S.analyses?.recette ?? null, lecture: r.lecture ?? null};
        majSuivis();
        $('#tb-suivi-lecture')?.scrollIntoView({behavior: 'smooth', block: 'center'});
        return suivre();
      }
      if (a === 'analyser') {
        const nom = nomIA();
        const client = S.espace.type === 'client';
        const oui = await confirmer({titre: `Analyser ${client ? `« ${esc(S.espace.nom)} »` : 'tes vidéos'} avec ${esc(nom)} ?`,
          texte: `${esc(nom)} lit les fiches de ${client ? 'ses' : 'tes'} montages, leurs vues et ${client ? 'sa marque' : 'ton profil'}, cherche l’actualité de la niche sur le web, puis écrit ce qui marche, ce qu’il faut éviter et des idées de sujets. Compte 5 à 15 minutes.`,
          bouton: `Lancer l’analyse avec ${esc(nom)}`, rassure: `Seulement les données de cet espace${client ? ', jamais tes habitudes ni celles d’un autre client' : ''}. Rien n’est publié.`});
        if (!oui || !el) return;
        try {
          const r = await api('POST', '/api/recette/analyser', {espace: S.espace.id, moteur: o.moteurIA?.() ?? null});
          S.analyses = {recette: r.recette ?? null, lecture: r.lecture ?? S.analyses?.lecture ?? null};
        } catch (err) {
          note(err.message, true);
          if (/connexions|branche/i.test(err.message)) o.connexions?.();
          return;
        }
        majSuivis();
        $('#tb-suivi-recette')?.scrollIntoView({behavior: 'smooth', block: 'center'});
        return suivre();
      }
      if (a === 'arreter') {
        b.disabled = true;
        await api('POST', '/api/recette/arreter', {espace: S.espace.id});
        if (await charger()) rendre();
        return suivre();
      }
    } catch (err) {
      note(err.message, true);
    }
  }
  function echap(e) { if (el && e.key === 'Escape' && !o.feuilleOuverte?.()) { e.stopPropagation(); e.preventDefault(); fermer(); } }

  function fermer() {
    clearTimeout(minuterie);
    clearInterval(guet);
    document.removeEventListener('keydown', echap, true);
    el?.remove();
    el = null;
    S = null;
    travaillait = false;
    guetteur?.disconnect();
    guetteur = null;
    oublierImages();
  }
  async function ouvrir({espace = null} = {}) {
    fermer();
    el = document.createElement('div');
    el.className = 'pub-atelier tb-atelier';
    el.innerHTML = `<header class="pa-barre"><button class="icone-btn" data-tb="fermer" title="Revenir (Échap)">${ic('retour')}</button>
        <div class="pa-titre"><b>Tableau de bord</b><span id="tb-sous">Tes vidéos, leurs vues, ce qui marche</span></div><span class="espace"></span>
        <button class="icone-btn" data-tb="fermer" title="Fermer (Échap)">${ic('fermer')}</button></header>
      <div class="pa-corps"><aside class="pa-gauche tb-gauche" id="tb-gauche"></aside><main class="pa-droite tb-droite" id="tb-contenu"><div class="tb-charge">${ill('bobine')}</div></main></div>`;
    document.body.append(el);
    el.addEventListener('click', clic);
    el.addEventListener('pointermove', survol);
    el.addEventListener('pointerout', sortie);
    document.addEventListener('keydown', echap, true);
    deja = new Map();
    cleRendu = '';
    vueRendue = '';
    sansCle = false;
    periode = PERIODES.some(([k]) => k === lirePref('tableau.periode', '90')) ? lirePref('tableau.periode', '90') : '90';
    tri = lirePref('tableau.tri', 'recentes') === 'meilleures' ? 'meilleures' : 'recentes';
    const ecran = el;
    await chargerEspaces();
    if (el !== ecran) return;
    const ids = L.espaces.map((e) => e.id);
    actif = [espace, lirePref('tableau.espace', null), L.dernier, 'moi'].find((x) => x && ids.includes(x)) ?? ids[0] ?? 'moi';
    rendreGauche();
    let ok = await charger();
    if (el !== ecran) return;
    if (!ok && actif !== 'moi') { actif = 'moi'; ok = await charger(); }
    rendre();
    suivre();
  }

  return {ouvrir, fermer, ouvert: () => !!el};
}
