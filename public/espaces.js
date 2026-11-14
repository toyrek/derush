// Dérush — les espaces de travail : pour qui est un projet.
//   « Moi »      : toi. Ton style, ton carnet et tes chiffres.
//   un client    : une entreprise, une association, une mairie… Sa marque et son carnet à lui, jamais tes habitudes.
//   « Personne » : un montage neutre. L'IA ne reçoit ni profil, ni carnet, ni marque, et rien n'est appris.
// Ce module dessine la feuille « Mes espaces », la feuille de réglage d'un espace (métier, kit de marque, logo,
// apprendre, carnet, séries, retirer), un petit choix « Pour qui ? » et le même choix posé dans la feuille
// Nouveau projet. Le serveur fait le travail (lib/espaces.mjs, routes /api/espaces…).
//
//   const ESP = creerEspaces({api, note, esc, ic, ill, logo, feuille, fermerFeuille, feuilleOuverte, carnet});
//   ESP.liste()                       la réponse de GET /api/espaces (gardée en mémoire), Moi d'abord, Personne en dernier
//   ESP.recharger()                   la relit
//   ESP.couleurDe(espace)             sa couleur (la première de sa marque, sinon une couleur à lui)
//   ESP.feuilleEspaces()              la feuille « Mes espaces »
//   ESP.feuilleEspace(id)             la feuille d'un espace
//   ESP.choisirEspace({actuel, titre})  une feuille de choix : Promise<id | null>
//   ESP.champPourQui(conteneur, {valeur, surChange})  le choix « Pour qui ? » dessiné dans un élément d'une feuille
// Après un changement (création, réglage, retrait), `o.surChangement(donnees)` est appelé s'il est fourni, et un
// évènement « derush:espaces » part sur document.

const BLEU = '#0A84FF';
const GRIS = '#8E8E93';
// les couleurs d'un client sans marque : vives, distinctes du bleu de « Moi » et du gris de « Personne »
const PALETTE = ['#FF9F0A', '#30D158', '#BF5AF2', '#64D2FF', '#FF375F', '#5E5CE6', '#FFD60A', '#AC8E68'];
const MAX_COULEURS = 5;
const MAX_POLICES = 4; // le serveur n'en garde pas plus (lib/espaces.mjs, nettoyerMarque)
const HEX = /^#?([0-9a-f]{6})$/i;
const EXT_LOGO = /\.(png|jpe?g|webp|svg)$/i;

/** Ce que chaque espace change, en une phrase (sous le choix « Pour qui ? »). */
const PHRASES = {
  moi: 'Ton style, ton carnet et tes chiffres.',
  client: 'Sa marque et son carnet à lui, jamais tes habitudes.',
  neutre: 'Rien de toi : un montage neutre, rien n’est appris.',
};

// « Personne » : une silhouette en pointillés (dans le style des icônes du sprite)
const IC_PERSONNE = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8" stroke-dasharray="2.2 2.4"/><path d="M4.5 20c.8-3.8 3.7-5.8 7.5-5.8s6.7 2 7.5 5.8" stroke-dasharray="2.2 2.4"/></svg>';
// « Mes espaces » : toi et un client, séparés par un cadenas
const ILL_ESPACES = `<svg viewBox="0 0 160 120" aria-hidden="true">
  <path d="M80 8v104" stroke="#4a4a55" stroke-width="2.5" stroke-dasharray="3 7" stroke-linecap="round"/>
  <g class="ill-flotte"><rect x="12" y="28" width="56" height="70" rx="11" fill="#0a84ff"/><circle cx="40" cy="53" r="9.5" fill="none" stroke="#fff" stroke-width="3.5"/><path d="M25 85c2-9 7.5-13 15-13s13 4 15 13" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></g>
  <g class="ill-flotte" style="animation-delay:.7s"><rect x="92" y="28" width="56" height="70" rx="11" fill="#ff9f0a"/><rect x="105" y="50" width="30" height="22" rx="4.5" fill="none" stroke="#1c1c1e" stroke-width="3.5"/><path d="M114 50v-4.5h12V50" fill="none" stroke="#1c1c1e" stroke-width="3.5" stroke-linejoin="round"/><path d="M106 86h28" stroke="#1c1c1e" stroke-width="3.5" stroke-linecap="round" opacity=".45"/></g>
  <g class="ill-etoile"><rect x="69" y="52" width="22" height="19" rx="5" fill="#2a2a30" stroke="#ffb340" stroke-width="2.5"/><path d="M74 52v-4.5a6 6 0 0 1 12 0V52" fill="none" stroke="#ffb340" stroke-width="2.5"/><circle cx="80" cy="61.5" r="2.2" fill="#ffb340"/></g>
  <path d="M138 12c.7 5.5 3 7.8 8.5 8.5-5.5.7-7.8 3-8.5 8.5-.7-5.5-3-7.8-8.5-8.5 5.5-.7 7.8-3 8.5-8.5z" fill="#fff" class="ill-scintille"/>
</svg>`;
// « Personne » : une place vide, et un carnet barré
const ILL_PERSONNE = `<svg viewBox="0 0 160 120" aria-hidden="true">
  <rect x="38" y="12" width="78" height="94" rx="13" fill="#23232a" stroke="#6e6e76" stroke-width="2.5" stroke-dasharray="5 6"/>
  <g class="ill-flotte"><circle cx="77" cy="47" r="13" fill="none" stroke="#8e8e93" stroke-width="3.5" stroke-dasharray="4 4.5"/><path d="M55 88c3-12 11-18 22-18s19 6 22 18" fill="none" stroke="#8e8e93" stroke-width="3.5" stroke-dasharray="4 4.5" stroke-linecap="round"/></g>
  <g><rect x="110" y="66" width="32" height="40" rx="6" fill="#2c2c33" stroke="#4a4a55" stroke-width="2"/><path d="M118 77h16M118 85h16M118 93h10" stroke="#6e6e76" stroke-width="2.5" stroke-linecap="round"/><path d="M105 62l42 48" stroke="#ff453a" stroke-width="4" stroke-linecap="round"/></g>
  <path d="M28 20c.5 4 2.2 5.7 6.2 6.2-4 .5-5.7 2.2-6.2 6.2-.5-4-2.2-5.7-6.2-6.2 4-.5 5.7-2.2 6.2-6.2z" fill="#6e6e76" class="ill-scintille d2"/>
</svg>`;

export function creerEspaces(o) {
  const {api, note, esc, ic, ill, feuille, fermerFeuille} = o;
  const JETON = o.JETON ?? document.querySelector('meta[name="derush-jeton"]')?.content ?? '';
  // un petit réglage gardé par la fenêtre (comme `prefs` d'app.js) : jamais indispensable
  const memoire = o.prefs ?? {
    lire(k, d) { try { return localStorage.getItem(`derush.${k}`) ?? d; } catch { return d; } },
    ecrire(k, v) { try { localStorage.setItem(`derush.${k}`, v); } catch { /* stockage indisponible */ } },
  };
  let promesse = null; // GET /api/espaces en cours ou fini
  let donnees = null; // sa dernière réponse, triée
  const images = new Map(); // adresse → Promise<adresse blob | null>
  const enc = encodeURIComponent;

  // ——— les données ———
  /** Moi d'abord, puis les clients par nom, Personne en dernier. */
  function trier(d) {
    const rang = (e) => (e.type === 'moi' ? 0 : e.type === 'neutre' ? 2 : 1);
    const espaces = [...(d.espaces ?? [])].sort((a, b) => rang(a) - rang(b) || String(a.nom).localeCompare(String(b.nom), 'fr', {sensitivity: 'base'}));
    return {...d, espaces, metiers: d.metiers ?? {}};
  }
  function liste() {
    promesse ??= api('GET', '/api/espaces').then((d) => { donnees = trier(d); return donnees; }).catch((err) => { promesse = null; throw err; });
    return promesse;
  }
  function recharger() { promesse = null; return liste(); }
  function signaler() {
    try { o.surChangement?.(donnees); } catch { /* le reste de l'interface se débrouille */ }
    document.dispatchEvent(new CustomEvent('derush:espaces', {detail: donnees}));
  }
  const trouver = (id) => donnees?.espaces?.find((e) => e.id === id) ?? null;
  /** Le type d'un espace, même donné en partie ({id} seul, ou {id, nom, type} de la bibliothèque). */
  const typeDe = (e) => e?.type ?? trouver(e?.id)?.type ?? (e?.id === 'moi' ? 'moi' : e?.id === 'neutre' ? 'neutre' : 'client');

  // ——— la couleur et la pastille d'un espace ———
  function couleurDe(espace) {
    const e = typeof espace === 'string' ? {id: espace} : espace;
    if (!e) return GRIS;
    const type = typeDe(e);
    if (type === 'neutre') return GRIS;
    // la première couleur de la marque qui se voit sur le fond sombre de Dérush (un noir de marque ne ferait
    // qu'un point invisible) ; sinon la couleur par défaut de l'espace
    const lisible = ((e.marque ?? trouver(e.id)?.marque)?.couleurs ?? []).find((x) => HEX.test(x ?? '') && luminance(x) >= 0.05);
    if (lisible) return `#${HEX.exec(lisible)[1].toUpperCase()}`;
    if (type === 'moi') return BLEU;
    let h = 0;
    for (const ch of String(e.id ?? e.nom ?? '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  /** La luminance relative d'une couleur (0 : noir, 1 : blanc). */
  function luminance(c) {
    const n = parseInt(HEX.exec(c)[1], 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  /** Une couleur claire veut une encre sombre. */
  function encre(c) {
    const m = HEX.exec(c ?? '');
    if (!m) return '#fff';
    const n = parseInt(m[1], 16);
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 165 ? '#1c1c1e' : '#fff';
  }
  function initiales(nom) {
    const mots = String(nom ?? '').replace(/[«»"'’.,()]/g, ' ').split(/[\s\-–—_/]+/).filter((m) => m && !/^(de|du|des|la|le|les|l|d|et|the|of|and)$/i.test(m));
    const lettres = mots.length >= 2 ? [...mots[0]][0] + [...mots[1]][0] : [...(mots[0] ?? '?')].slice(0, 2).join('');
    return lettres.toUpperCase();
  }
  const varsCouleur = (c) => `--c:${c};--encre:${encre(c)}`;
  /** La pastille d'un espace : sa couleur, et son logo (chargé ensuite), ses initiales ou une icône. */
  function avatar(e, taille = 34) {
    const type = typeDe(e);
    const avecLogo = type !== 'neutre' && (e.logo ?? trouver(e.id)?.logo);
    const dedans = type === 'moi' ? ic('profil') : type === 'neutre' ? IC_PERSONNE : `<span>${esc(initiales(e.nom ?? trouver(e.id)?.nom))}</span>`;
    return `<span class="esp-avatar ${type}" style="${varsCouleur(couleurDe(e))};--t:${taille}px"${avecLogo ? ` data-esp-logo="${esc(e.id)}"` : ''}>${dedans}</span>`;
  }

  // les images de /api/ demandent le jeton dans l'en-tête : une balise <img> ne sait pas l'envoyer
  function image(url) {
    if (!images.has(url)) {
      images.set(url, fetch(url, {headers: {'x-derush-jeton': JETON}})
        .then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null)).catch(() => null));
    }
    return images.get(url);
  }
  function oublierImage(url) {
    const p = images.get(url);
    images.delete(url);
    p?.then((u) => { if (u) setTimeout(() => URL.revokeObjectURL(u), 4000); });
  }
  const urlLogo = (id) => `/api/espaces/${enc(id)}/logo`;
  /** Pose les logos et les aperçus de séries dans ce qui vient d'être dessiné. */
  function poserImages(racine) {
    for (const el of racine.querySelectorAll('[data-esp-logo], [data-esp-apercu]')) {
      if (el.dataset.espPose) continue;
      el.dataset.espPose = '1';
      const url = el.dataset.espLogo ? urlLogo(el.dataset.espLogo) : el.dataset.espApercu;
      if (!url) continue;
      image(url).then((u) => {
        if (!u || !el.isConnected) return;
        el.classList.add('avec-image');
        el.insertAdjacentHTML('beforeend', `<img src="${u}" alt="" draggable="false">`);
      });
    }
  }

  // ——— des mots ———
  const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
  const date = (q) => { try { return new Date(q).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short', year: 'numeric'}); } catch { return ''; } };
  function metierTexte(e, metiers = donnees?.metiers ?? {}) {
    if (e.type === 'neutre') return 'Montage ponctuel, sans profil';
    const m = e.metier && metiers[e.metier.type];
    if (!m) return e.type === 'moi' ? 'Ton métier : à choisir' : 'Métier à choisir';
    return e.metier.precision ? `${m.nom} — ${e.metier.precision}` : m.nom;
  }
  function resumeEspace(e) {
    if (e.type === 'neutre') return 'Rien n’est gardé';
    return `${pluriel(e.lecons ?? 0, 'leçon', 'leçons')} · ${pluriel(e.series ?? 0, 'série', 'séries')}`;
  }
  const etiqApprend = (e) => (e.type === 'neutre'
    ? '<span class="etiq">n’apprend rien</span>'
    : e.apprend ? `<span class="etiq ok">${ic('coche')}apprend</span>` : '<span class="etiq">n’apprend pas</span>');
  const titrePour = (e) => (e.type === 'moi' ? 'Pour toi' : e.type === 'neutre' ? 'Pour personne' : `Pour ${e.nom}`);
  const phraseDe = (e) => (e.type === 'client' && e.apprend === false ? `${PHRASES.client} Rien n’est appris.` : PHRASES[e.type] ?? PHRASES.client);
  const icType = (e) => (e.type === 'moi' ? ic('profil') : e.type === 'neutre' ? IC_PERSONNE : ic('mallette'));
  /** Les métiers en puces (`data-esp="metier"`), celui choisi en bleu. */
  const pucesMetiers = (metiers, choisi) => Object.entries(metiers).map(([k, m]) => `<button type="button" class="${k === choisi ? 'actif' : ''}" data-esp="metier" data-type="${esc(k)}" title="${esc(m.exemples || m.nom)}">${esc(m.nom)}</button>`).join('');
  const vide = (dessin, titre, texte) => `<div class="esp-vide">${dessin}<b>${esc(titre)}</b><p>${esc(texte)}</p></div>`;

  /** Crée un client et relit la liste. Renvoie l'espace créé, ou null (le message d'erreur est déjà affiché). */
  async function nouveauClient(nom, type = null) {
    const n = String(nom ?? '').replace(/\s+/g, ' ').trim();
    if (!n) { note('Donne un nom au client.', true); return null; }
    try {
      const {espace} = await api('POST', '/api/espaces', {nom: n, metier: type ? {type, precision: '', confirme: true} : null});
      await recharger().catch(() => {});
      signaler();
      return espace;
    } catch (err) { note(err.message, true); return null; }
  }

  /** Suit la fermeture d'une feuille (clic sur le voile, Échap, une autre feuille à la place) : appelle `quand` une fois. */
  function surFermeture(f, quand) {
    const voile = f.parentElement ?? document.getElementById('voile');
    let fait = false;
    const obs = new MutationObserver(() => {
      if (fait) return;
      if (!f.isConnected || !f.firstElementChild || voile?.classList.contains('cache')) { fait = true; obs.disconnect(); quand(); }
    });
    if (voile) obs.observe(voile, {attributes: true, attributeFilter: ['class'], childList: true, subtree: true});
    return () => { fait = true; obs.disconnect(); };
  }

  // ===================================================================
  // « Mes espaces »
  function carteEspace(e, d, i) {
    return `<button type="button" class="esp-carte ${e.type}" data-esp="ouvrir" data-id="${esc(e.id)}" style="${varsCouleur(couleurDe(e))};--i:${i}">
      <span class="esp-carte-haut">${avatar(e, 40)}<span class="esp-carte-nom"><b>${esc(e.nom)}</b><small>${esc(metierTexte(e, d.metiers))}</small></span>${ic('retour', 'esp-chevron')}</span>
      <span class="esp-carte-bas"><span>${esc(resumeEspace(e))}</span>${etiqApprend(e)}</span>
    </button>`;
  }
  async function feuilleEspaces() {
    let d;
    try { d = await recharger(); } catch (err) { return note(err.message, true); }
    const clients = d.espaces.filter((e) => e.type !== 'neutre');
    const neutre = d.espaces.filter((e) => e.type === 'neutre');
    let metierNouveau = null;
    const f = feuille(`<div class="esp-tete esp-tete-liste"><div class="esp-tete-ill">${ILL_ESPACES}</div><div class="esp-tete-txt"><h3>Mes espaces</h3>
        <p class="sous-titre">Un espace pour chaque personne pour qui tu montes : toi, et chacun de tes clients. Chacun a son métier, sa marque et son carnet.</p>
        <p class="esp-promesse">${ic('cadenas')}<span>Ce que Dérush apprend pour toi ne part jamais chez un client. Un montage pour un client ne prend jamais ton style.</span></p></div></div>
      <div class="esp-grille">
        ${clients.map((e, i) => carteEspace(e, d, i)).join('')}
        <button type="button" class="esp-carte esp-ajout" data-esp="nouveau" style="--i:${clients.length}"><span class="esp-plus">${ic('plus')}</span><b>Nouveau client</b><small>Une entreprise, une association, une mairie…</small></button>
        ${neutre.map((e, i) => carteEspace(e, d, clients.length + 1 + i)).join('')}
      </div>
      <div class="esp-form cache" data-esp-form>
        <label class="champ"><span>Nom du client</span><input data-esp-champ="nouveau-nom" maxlength="60" placeholder="Par exemple : la mairie, le club de foot, un café…" autocomplete="off" spellcheck="false"></label>
        <div class="champ"><span>Ce qu’il fait (facultatif)</span><div class="esp-puces" data-esp-metiers>${pucesMetiers(d.metiers, null)}</div></div>
        <div class="esp-form-pied"><small>Ensuite, tu règles sa marque : couleurs, polices, logo, ton, mentions.</small><span class="espace"></span><button type="button" class="btn" data-esp="nouveau-annuler">Annuler</button><button type="button" class="btn bleu" data-esp="creer">Créer le client</button></div>
      </div>
      <div class="pied"><span class="espace"></span><button class="btn principal" data-fermer>OK</button></div>`, true);
    f.classList.add('esp-feuille');
    poserImages(f);
    const form = f.querySelector('[data-esp-form]');
    const champNom = f.querySelector('[data-esp-champ="nouveau-nom"]');
    const creer = async () => {
      const bouton = f.querySelector('[data-esp="creer"]');
      bouton.disabled = true;
      const e = await nouveauClient(champNom.value, metierNouveau);
      bouton.disabled = false;
      if (!e) return champNom.focus();
      note(`« ${e.nom} » est créé. Règle maintenant sa marque.`);
      feuilleEspace(e.id, {depuisListe: true, onglet: 'marque'});
    };
    f.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-fermer]')) return fermerFeuille();
      const b = ev.target.closest('[data-esp]');
      if (!b) return;
      const a = b.dataset.esp;
      if (a === 'ouvrir') return feuilleEspace(b.dataset.id, {depuisListe: true});
      if (a === 'nouveau') {
        form.classList.remove('cache');
        b.classList.add('ouvert');
        champNom.focus();
        return form.scrollIntoView({block: 'nearest', behavior: 'smooth'});
      }
      if (a === 'nouveau-annuler') { form.classList.add('cache'); f.querySelector('[data-esp="nouveau"]')?.classList.remove('ouvert'); return; }
      if (a === 'metier') {
        metierNouveau = metierNouveau === b.dataset.type ? null : b.dataset.type;
        f.querySelectorAll('[data-esp-metiers] [data-esp="metier"]').forEach((x) => x.classList.toggle('actif', x.dataset.type === metierNouveau));
        return;
      }
      if (a === 'creer') return creer();
    });
    champNom.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); creer(); } });
  }

  // ===================================================================
  // La feuille d'un espace
  /** « Personne » : rien à régler, une explication. */
  function feuillePersonne(depuisListe) {
    const f = feuille(`<div class="esp-personne"><div class="esp-personne-ill">${ILL_PERSONNE}</div>
        <h3>Personne</h3>
        <p class="sous-titre">Pour un montage ponctuel : une vidéo qui n’est ni pour toi ni pour un client suivi.</p>
        <ul class="esp-rien">
          <li style="--i:0">${ic('profil')}<span><b>Pas de profil</b>Ton IA ne lit ni ton style, ni celui d’un client.</span></li>
          <li style="--i:1">${ic('texte')}<span><b>Pas de carnet</b>Rien des montages d’avant, et elle n’écrit aucune leçon.</span></li>
          <li style="--i:2">${ic('palette')}<span><b>Pas de marque</b>Ni couleurs, ni polices, ni logo imposés.</span></li>
          <li style="--i:3">${ic('cadenas')}<span><b>Rien n’est appris</b>Ni fiche, ni chiffres suivis, rien dans le tableau de bord.</span></li>
        </ul>
        <p class="esp-aide">Ton IA monte d’après ta demande et tes rushes, rien d’autre. Il n’y a rien à régler ici.</p></div>
      <div class="pied">${depuisListe ? `<button class="btn" data-esp="retour">${ic('retour')}Mes espaces</button>` : ''}<span class="espace"></span><button class="btn principal" data-fermer>OK</button></div>`);
    f.classList.add('esp-feuille');
    f.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-fermer]')) return fermerFeuille();
      if (ev.target.closest('[data-esp="retour"]')) return feuilleEspaces();
    });
  }

  async function feuilleEspace(id, {depuisListe = false, onglet = 'essentiel'} = {}) {
    let d;
    try { d = await recharger(); } catch (err) { return note(err.message, true); }
    const e = d.espaces.find((x) => x.id === id);
    if (!e) return note('Cet espace n’existe plus.', true);
    if (e.type === 'neutre') return feuillePersonne(depuisListe);
    const client = e.type === 'client';
    let lecons = [];
    let series = [];
    await Promise.all([
      api('GET', `/api/espaces/${enc(id)}/carnet`).then((r) => { lecons = r.lecons ?? []; }).catch(() => {}),
      api('GET', `/api/espaces/${enc(id)}/series`).then((r) => { series = r.series ?? []; }).catch(() => {}),
    ]);
    // ce qu'on règle ici, avant de l'enregistrer
    const F = {
      metier: e.metier?.type ?? null,
      couleurs: [...(e.marque?.couleurs ?? [])].slice(0, MAX_COULEURS),
      polices: [...(e.marque?.polices ?? [])].slice(0, MAX_POLICES),
      logo: !!e.logo,
    };
    let modifie = false;
    const refus = memoire.lire('espaces.metier-refuse', '');
    const propose = !client && d.metier_propose && !e.metier?.confirme && refus !== d.metier_propose.type ? d.metier_propose : null;
    const k = e.marque ?? {};
    const nb = (n) => (n ? ` <i class="esp-nb">${n}</i>` : '');
    const champ = (cle, titre, valeur, {long = false, max = 300, aide = '', exemple = ''} = {}) => `<label class="champ"><span>${esc(titre)}${aide ? ` <small>${esc(aide)}</small>` : ''}</span>${long
      ? `<textarea data-esp-champ="${cle}" maxlength="${max}" rows="3" placeholder="${esc(exemple)}">${esc(valeur ?? '')}</textarea>`
      : `<input data-esp-champ="${cle}" maxlength="${max}" value="${esc(valeur ?? '')}" placeholder="${esc(exemple)}" autocomplete="off">`}</label>`;

    const f = feuille(`<div class="esp-tete">
        ${depuisListe ? `<button class="icone-btn esp-retour" data-esp="retour" title="Mes espaces">${ic('retour')}</button>` : ''}
        <span data-esp-tete-avatar>${avatar(e, 50)}</span>
        <div class="esp-tete-txt"><h3 data-esp-titre>${esc(client ? e.nom : 'Moi')}</h3><p class="sous-titre">${client ? 'Un client. Sa marque et son carnet à lui : ton style à toi n’y entre jamais.' : 'Toi. Ton style, ton carnet et tes chiffres : ils ne partent jamais chez un client.'}</p></div>
        <span class="esp-type ${e.type}">${client ? `${ic('mallette')}Client` : `${ic('profil')}Toi`}</span>
      </div>
      ${propose ? `<div class="esp-propose" data-esp-propose>${ic('etincelle', 'plein')}<span><b>On dirait que tu fais des ${esc(propose.nom)} — c’est ça ?</b><small>${esc(propose.pourquoi ?? '')}</small></span><button class="btn petit" data-esp="propose-non">Non</button><button class="btn petit bleu" data-esp="propose-oui">Oui</button></div>` : ''}
      <div class="segmente esp-onglets">
        <button data-esp="onglet" data-onglet="essentiel">${ic(client ? 'mallette' : 'profil')}<span>L’essentiel</span></button>
        <button data-esp="onglet" data-onglet="marque">${ic('palette')}<span>Kit de marque</span></button>
        <button data-esp="onglet" data-onglet="carnet">${ic('texte')}<span>Carnet<span data-esp-nb="carnet">${nb(lecons.length)}</span></span></button>
        <button data-esp="onglet" data-onglet="series">${ic('dupliquer')}<span>Séries<span data-esp-nb="series">${nb(series.length)}</span></span></button>
      </div>

      <section class="esp-panneau" data-esp-panneau="essentiel">
        ${client ? champ('nom', 'Nom du client', e.nom, {max: 60, exemple: 'Par exemple : la mairie, le club de foot, un café…'}) : ''}
        <div class="champ"><span>${client ? 'Ce qu’il fait' : 'Ce que tu fais'} <small>ton IA sait sur quoi insister au montage</small></span><div class="esp-puces" data-esp-metiers>${pucesMetiers(d.metiers, F.metier)}</div></div>
        ${champ('precision', 'En quelques mots (facultatif)', e.metier?.precision ?? '', {max: 120, exemple: `Par exemple : ${d.metiers[F.metier]?.exemples || (client ? 'ce qui le distingue, son quartier, son public' : 'ce qui te distingue')}`})}
        <div class="esp-apprendre">
          <span class="esp-apprendre-ic">${ic('etincelle')}</span>
          <span class="espace"><b>${client ? `Apprendre des montages pour ${esc(e.nom)}` : 'Apprendre de mes montages'}</b>
          <small data-esp-apprendre-texte></small></span>
          <label class="interrupteur" title="Apprendre"><input type="checkbox" data-esp-champ="apprendre"${e.apprendre !== false ? ' checked' : ''}><i></i></label>
        </div>
        ${client ? `<div class="esp-danger" data-esp-danger>${retirerHtml(false)}</div>` : ''}
      </section>

      <section class="esp-panneau cache" data-esp-panneau="marque">
        <p class="esp-aide">${client ? `Ce que ton IA suit à chaque montage pour ${esc(e.nom)}. Rien n’est obligatoire : remplis ce que tu sais.` : 'Ton identité : ton IA la suit pour tes vidéos à toi, jamais pour un client.'}</p>
        <div class="esp-marque-haut">
          <div class="esp-logo-boite"><span class="esp-logo-apercu" data-esp-logo-apercu>${logoApercu()}</span>
            <div><b>Logo</b><small>PNG, JPEG, WebP ou SVG. Ton IA le pose là où la charte le demande, sinon sur le carton de fin.</small>
            <button type="button" class="btn petit" data-esp="logo">${ic('image')}<span data-esp-logo-mot>${F.logo ? 'Changer le logo' : 'Choisir un logo'}</span></button>
            <div class="esp-chemin cache" data-esp-chemin><input class="entree" data-esp-champ="chemin-logo" placeholder="Colle ici le chemin de l’image (ex. /Users/moi/logo.png)" spellcheck="false" autocomplete="off"><button type="button" class="btn petit bleu" data-esp="logo-chemin">Utiliser</button></div></div></div>
          <div class="champ esp-couleurs-champ"><span>Couleurs <small>la première est la principale ; elle colore aussi l’espace, sauf si elle est trop sombre</small></span><div class="esp-couleurs" data-esp-couleurs></div></div>
        </div>
        <div class="champ"><span>Polices <small>${MAX_POLICES} au plus, par leur nom</small></span><div class="esp-polices" data-esp-polices></div></div>
        <div class="deux">${champ('ton', 'Ton', k.ton, {exemple: client ? 'Par exemple : institutionnel, chaleureux' : 'Par exemple : enthousiaste, tutoiement'})}${champ('public', 'Public', k.public, {exemple: 'Par exemple : familles, 18-35 ans'})}</div>
        <div class="deux">${champ('interdits', 'À ne jamais faire', k.interdits, {long: true, max: 1200, exemple: client ? 'Par exemple : aucun logo de marque commerciale, pas d’humour' : 'Par exemple : pas de musique triste, jamais de gros mots'})}${champ('mentions', 'Mentions obligatoires', k.mentions, {long: true, max: 1200, exemple: client ? 'Par exemple : Ville de Persan — persan.fr' : 'Par exemple : ton pseudo sur le carton de fin'})}</div>
        ${champ('site', 'Site', k.site, {exemple: client ? 'Par exemple : persan.fr' : 'Ton site ou ta page, s’il y en a un'})}
        ${champ('notes', 'Autres consignes', k.notes, {long: true, max: 1200, exemple: 'Tout ce que ton IA doit savoir de plus'})}
      </section>

      <section class="esp-panneau cache" data-esp-panneau="carnet"><div data-esp-carnet></div></section>
      <section class="esp-panneau cache" data-esp-panneau="series"><div data-esp-series></div></section>

      <div class="pied" data-esp-pied></div>`, true);
    f.classList.add('esp-feuille', 'esp-reglage');
    const $ = (s) => f.querySelector(s);
    const valeur = (cle) => $(`[data-esp-champ="${cle}"]`)?.value ?? '';

    // — le pied : Enregistrer, ou la question « tes changements ? » —
    function pied(question = false) {
      $('[data-esp-pied]').innerHTML = question
        ? `<span class="esp-question">${ic('attention')}Tu as fait des changements.</span><span class="espace"></span><button class="btn" data-esp="jeter">Ne pas enregistrer</button><button class="btn principal" data-esp="enregistrer">Enregistrer</button>`
        : `${depuisListe ? `<button class="btn" data-esp="retour">${ic('retour')}Mes espaces</button>` : ''}<span class="espace"></span><button class="btn" data-esp="fermer">${modifie ? 'Annuler' : 'Fermer'}</button><button class="btn principal" data-esp="enregistrer"${modifie ? '' : ' disabled'}>Enregistrer</button>`;
    }
    function marquer() {
      if (modifie) return;
      modifie = true;
      pied();
    }
    // où aller en partant : la liste « Mes espaces » (on en vient, ou « Mes espaces » a été cliqué), sinon on ferme
    let voulu = depuisListe ? 'retour' : 'fermer';
    function sortir() { if (voulu === 'retour') feuilleEspaces(); else fermerFeuille(); }

    // — Échap et un clic à côté : avec des changements pas enregistrés, la même question que « Fermer » —
    // (fermerFeuille() d'app.js ferme sans rien demander : on passe avant lui)
    const voile = f.parentElement ?? document.getElementById('voile');
    const ici = () => f.isConnected && !!f.firstElementChild && !voile?.classList.contains('cache');
    const garde = () => {
      if (!modifie) return true;
      voulu = 'fermer';
      pied(true);
      return false;
    };
    f.avantFermeture = garde; // pour app.js, s'il consulte ce crochet avant de fermer une feuille
    const clavier = (ev) => {
      if (ev.key !== 'Escape' || !modifie || !ici()) return;
      ev.preventDefault();
      ev.stopPropagation();
      // Échap quitte d'abord le champ ; sur la question déjà posée, il la retire : on continue de régler
      if (f.contains(ev.target) && ev.target.closest?.('input, textarea, select')) ev.target.blur();
      if ($('.esp-question')) pied();
      else garde();
    };
    const pointeur = (ev) => {
      if (ev.target !== voile || !ici() || garde()) return;
      ev.preventDefault();
      ev.stopPropagation();
    };
    window.addEventListener('keydown', clavier, true);
    window.addEventListener('pointerdown', pointeur, true);
    surFermeture(f, () => { window.removeEventListener('keydown', clavier, true); window.removeEventListener('pointerdown', pointeur, true); });

    // — les onglets —
    function choisirOnglet(nom) {
      f.querySelectorAll('[data-esp="onglet"]').forEach((b) => b.classList.toggle('actif', b.dataset.onglet === nom));
      f.querySelectorAll('[data-esp-panneau]').forEach((p) => p.classList.toggle('cache', p.dataset.espPanneau !== nom));
    }

    // — apprendre : ce que l'interrupteur veut dire —
    function texteApprendre() {
      const oui = $('[data-esp-champ="apprendre"]').checked;
      $('[data-esp-apprendre-texte]').textContent = oui
        ? (client
          ? `À chaque montage pour ${e.nom}, ton IA note ce qu’elle apprend dans le carnet de ce client, et Dérush garde ce qui marche (fiches, notes, vues). Ça ne sert qu’à ${e.nom}.`
          : 'À chaque montage, ton IA note ce qu’elle apprend dans ton carnet, et Dérush garde ce qui marche (fiches, notes, vues). Ça ne sert qu’à toi.')
        : `Coupé : ton IA garde ${client ? 'sa marque' : 'ton métier et ton identité'}, mais ne reçoit plus le carnet et rien de nouveau n’est retenu. Ce qui est déjà appris reste ici ; tu peux l’effacer.`;
      $('.esp-apprendre').classList.toggle('coupe', !oui);
    }

    // — le logo —
    function logoApercu() {
      return F.logo ? `<span class="esp-logo-img" data-esp-apercu="${esc(urlLogo(id))}"></span>` : `<span class="esp-logo-rien">${ic('image')}</span>`;
    }
    async function poserLogo(chemin) {
      if (!EXT_LOGO.test(chemin)) return note('Le logo doit être une image PNG, JPEG, WebP ou SVG.', true);
      try {
        await api('POST', `/api/espaces/${enc(id)}/logo`, {chemin});
        oublierImage(urlLogo(id));
        F.logo = true;
        $('[data-esp-logo-apercu]').innerHTML = logoApercu();
        $('[data-esp-logo-mot]').textContent = 'Changer le logo';
        $('[data-esp-chemin]').classList.add('cache');
        await recharger().catch(() => {});
        $('[data-esp-tete-avatar]').innerHTML = avatar(trouver(id) ?? {...e, logo: true}, 50);
        majCouleurTete();
        poserImages(f);
        signaler();
        note('Logo ajouté.');
      } catch (err) { note(err.message, true); }
    }
    async function choisirLogo() {
      let r;
      try { r = o.choisirSurOrdinateur ? await o.choisirSurOrdinateur('logo') : await api('POST', '/api/choisir', {usage: 'logo'}); } catch (err) { return note(err.message, true); }
      if (r?.indisponible) {
        // pas de fenêtre « Ouvrir » sur ce système : le chemin à la main
        $('[data-esp-chemin]').classList.remove('cache');
        return $('[data-esp-champ="chemin-logo"]').focus();
      }
      const c = (r?.chemins ?? []).find((x) => EXT_LOGO.test(x)) ?? r?.chemins?.[0];
      if (c) poserLogo(c);
    }

    // — les couleurs (jusqu'à 5) et les polices (jusqu'à 4) —
    function dessinerCouleurs() {
      $('[data-esp-couleurs]').innerHTML = F.couleurs.map((c, i) => `<span class="esp-couleur${i === 0 ? ' principale' : ''}" style="--i:${i}">
          <label class="esp-pastille" style="--c:${c}" title="Changer cette couleur"><input type="color" value="${c.toLowerCase()}" data-esp-coul="${i}"></label>
          <input class="esp-hex" value="${c}" data-esp-hex="${i}" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Couleur ${i + 1}">
          <button type="button" class="icone-btn" data-esp="coul-retirer" data-i="${i}" title="Retirer cette couleur">${ic('fermer')}</button></span>`).join('')
        + (F.couleurs.length < MAX_COULEURS ? `<button type="button" class="esp-coul-plus" data-esp="coul-plus" title="Ajouter une couleur">${ic('plus')}<span>${F.couleurs.length ? 'Une couleur' : 'Ajouter une couleur'}</span></button>` : '');
    }
    function majCouleurTete() {
      const tmp = {...e, marque: {...e.marque, couleurs: [...F.couleurs]}};
      const av = $('[data-esp-tete-avatar] .esp-avatar');
      if (av) { av.style.setProperty('--c', couleurDe(tmp)); av.style.setProperty('--encre', encre(couleurDe(tmp))); }
    }
    function dessinerPolices() {
      const el = $('[data-esp-polices]');
      el.innerHTML = F.polices.map((p, i) => `<span class="esp-police" style="--i:${i}"><span data-esp-police-nom="${i}">${esc(p)}</span><button type="button" data-esp="police-retirer" data-i="${i}" title="Retirer">${ic('fermer')}</button></span>`).join('')
        + (F.polices.length < MAX_POLICES ? `<span class="esp-police-ajout"><input class="entree" data-esp-champ="police-nouvelle" maxlength="60" placeholder="${F.polices.length ? 'Une autre police' : 'Par exemple : Montserrat'}" spellcheck="false" autocomplete="off"><button type="button" class="btn petit" data-esp="police-plus">${ic('plus')}Ajouter</button></span>` : '');
      // chaque nom s'écrit dans sa police, si elle est sur l'ordinateur
      F.polices.forEach((p, i) => { const s = el.querySelector(`[data-esp-police-nom="${i}"]`); if (s) s.style.fontFamily = `${JSON.stringify(p)}, -apple-system, system-ui, sans-serif`; });
    }
    function ajouterPolice() {
      const champP = $('[data-esp-champ="police-nouvelle"]');
      const p = (champP?.value ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
      if (!p) return champP?.focus();
      if (F.polices.some((x) => x.toLowerCase() === p.toLowerCase())) { note(`« ${p} » est déjà là.`, true); return champP.select(); }
      F.polices.push(p);
      dessinerPolices();
      marquer();
      $('[data-esp-champ="police-nouvelle"]')?.focus();
    }

    // — le carnet de l'espace —
    const SOURCES = {ia: 'écrit par ton IA', note: 'd’après ta note', correction: 'après une correction'};
    function dessinerCarnet(confirmer = false) {
      $('[data-esp-carnet]').innerHTML = lecons.length
        ? `<p class="esp-aide">${client ? `Ce que ton IA a appris en montant pour ${esc(e.nom)}. Elle le relit au début de chaque projet pour ce client, et seulement pour lui.` : 'Ce que ton IA a appris de tes montages. Elle le relit au début de chacun de tes projets ; jamais pour un client.'} Efface ce qui ne te va pas.</p>
          <div class="carnet-liste esp-carnet">${lecons.map((l, i) => `<div class="carnet-lecon" style="--i:${Math.min(i, 12)}"><div class="espace"><span>${esc(l.texte)}</span><small>${esc([date(l.quand), l.projet, SOURCES[l.source]].filter(Boolean).join(' · '))}</small></div><button type="button" class="icone-btn" data-esp="oublier" data-id="${esc(l.id)}" title="Oublier cette leçon">${ic('poubelle')}</button></div>`).join('')}</div>
          <div class="esp-bas">${confirmer
            ? `<div class="esp-confirme"><p><b>Effacer ${pluriel(lecons.length, 'leçon', 'leçons')} ?</b> Ton IA repartira de zéro pour ${client ? esc(e.nom) : 'toi'}. Ça ne se défait pas.</p><div><button type="button" class="btn" data-esp="vider-non">Annuler</button><button type="button" class="btn principal" data-esp="vider-oui">Tout effacer</button></div></div>`
            : `<span class="espace"></span><button type="button" class="btn petit" data-esp="vider">${ic('poubelle')}Tout effacer</button>`}</div>`
        : vide(ill('claude'), 'Le carnet est vide', client
          ? `À la fin d’un montage pour ${e.nom}, ton IA y note ce qu’elle a appris de ce client (ses goûts, ses rushes, ses habitudes). Ce carnet ne sert qu’à ${e.nom}.`
          : 'À la fin d’un montage, ton IA y note ce qu’elle a appris (tes rushes, tes goûts, les pièges des outils) ; elle le relit au projet suivant.');
      $('[data-esp-nb="carnet"]').innerHTML = nb(lecons.length);
    }

    // — les séries de l'espace —
    let serieAConfirmer = null;
    function dessinerSeries() {
      $('[data-esp-series]').innerHTML = series.length
        ? `<p class="esp-aide">Des montages réussis gardés comme modèles : un nouvel épisode reprend leur accroche, leur habillage, leur carton de fin et leur rythme ; seul le contenu change.</p>
          <div class="esp-series">${series.map((s, i) => `<div class="esp-serie" style="--i:${i}">
            <span class="esp-serie-img"${s.apercu ? ` data-esp-apercu="/api/espaces/${enc(id)}/series/${enc(s.id)}"` : ''}>${ic('dupliquer')}</span>
            <span class="espace"><b>${esc(s.nom)}</b><small>${esc([pluriel(s.episodes ?? 0, 'épisode', 'épisodes'), s.depuis?.titre || s.depuis?.projet ? `modèle : ${s.depuis.titre || s.depuis.projet}` : null, date(s.cree_le)].filter(Boolean).join(' · '))}</small></span>
            ${serieAConfirmer === s.id
              ? `<span class="esp-serie-confirme"><small>La retirer ? Son modèle est gardé à part.</small><button type="button" class="btn petit" data-esp="serie-non">Non</button><button type="button" class="btn petit principal" data-esp="serie-oui" data-id="${esc(s.id)}">Retirer</button></span>`
              : `<button type="button" class="icone-btn" data-esp="serie-retirer" data-id="${esc(s.id)}" title="Retirer cette série">${ic('poubelle')}</button>`}
          </div>`).join('')}</div>`
        : vide(ill('extraits'), 'Pas encore de série', 'Quand une vidéo livrée te plaît, fais-en le modèle d’une série (« comme d’habitude ») : les épisodes suivants reprendront son accroche, son habillage et son rythme.');
      $('[data-esp-nb="series"]').innerHTML = nb(series.length);
      poserImages($('[data-esp-series]'));
    }

    // — retirer ce client —
    function retirerHtml(confirmer) {
      return confirmer
        ? `<div class="esp-confirme"><p><b>Retirer « ${esc(e.nom)} » ?</b> Ses projets passent à « Personne » et restent dans ta bibliothèque. Son carnet, sa marque et ses séries sont gardés à part, dans le dossier de Dérush.</p><div><button type="button" class="btn" data-esp="retirer-non">Annuler</button><button type="button" class="btn principal" data-esp="retirer-oui">Retirer ce client</button></div></div>`
        : `<button type="button" class="btn esp-retirer" data-esp="retirer">${ic('poubelle')}Retirer ce client</button><small>Ses projets passent à « Personne ». Rien n’est effacé.</small>`;
    }

    // — enregistrer —
    async function enregistrer() {
      // une police tapée sans « Ajouter » compte aussi
      const enAttente = valeur('police-nouvelle').replace(/\s+/g, ' ').trim().slice(0, 60);
      if (enAttente && F.polices.length < MAX_POLICES && !F.polices.some((x) => x.toLowerCase() === enAttente.toLowerCase())) F.polices.push(enAttente);
      const precision = valeur('precision').replace(/\s+/g, ' ').trim();
      const type = F.metier ?? (precision ? 'autre' : null);
      const corps = {
        metier: type ? {type, precision, confirme: true} : null,
        marque: {ton: valeur('ton'), public: valeur('public'), interdits: valeur('interdits'), mentions: valeur('mentions'), site: valeur('site'), notes: valeur('notes'), couleurs: F.couleurs, polices: F.polices},
        apprendre: $('[data-esp-champ="apprendre"]').checked,
      };
      if (client) {
        const n = valeur('nom').replace(/\s+/g, ' ').trim();
        if (!n) { choisirOnglet('essentiel'); $('[data-esp-champ="nom"]').focus(); return note('Donne un nom au client.', true); }
        corps.nom = n;
      }
      const b = $('[data-esp="enregistrer"]');
      if (b) b.disabled = true;
      try {
        const r = await api('PUT', `/api/espaces/${enc(id)}`, corps);
        modifie = false;
        await recharger().catch(() => {});
        signaler();
        note(`${r.espace?.type === 'moi' ? 'Ton espace' : `« ${r.espace?.nom ?? e.nom} »`} est enregistré.`);
        sortir();
      } catch (err) { if (b) b.disabled = false; note(err.message, true); }
    }

    // — les clics —
    f.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-esp]');
      if (!b) return;
      const a = b.dataset.esp;
      try {
        if (a === 'onglet') return choisirOnglet(b.dataset.onglet);
        if (a === 'fermer' || a === 'retour') { voulu = a; if (modifie) return pied(true); return sortir(); }
        if (a === 'jeter') { modifie = false; return sortir(); }
        if (a === 'enregistrer') return enregistrer();
        if (a === 'metier') {
          F.metier = F.metier === b.dataset.type ? null : b.dataset.type;
          f.querySelectorAll('[data-esp-metiers] [data-esp="metier"]').forEach((x) => x.classList.toggle('actif', x.dataset.type === F.metier));
          const ex = d.metiers[F.metier]?.exemples;
          $('[data-esp-champ="precision"]').placeholder = `Par exemple : ${ex || (client ? 'ce qui le distingue, son quartier, son public' : 'ce qui te distingue')}`;
          return marquer();
        }
        if (a === 'propose-oui' || a === 'propose-non') {
          const zone = $('[data-esp-propose]');
          if (a === 'propose-non') { memoire.ecrire('espaces.metier-refuse', propose.type); zone?.remove(); return; }
          await api('PUT', `/api/espaces/${enc(id)}`, {metier: {type: propose.type, precision: valeur('precision').trim(), confirme: true}});
          F.metier = propose.type;
          f.querySelectorAll('[data-esp-metiers] [data-esp="metier"]').forEach((x) => x.classList.toggle('actif', x.dataset.type === F.metier));
          zone?.remove();
          await recharger().catch(() => {});
          signaler();
          return note(`C’est noté : ${propose.nom}.`);
        }
        if (a === 'logo') return choisirLogo();
        if (a === 'logo-chemin') return poserLogo(valeur('chemin-logo').trim());
        if (a === 'coul-plus') {
          const libre = PALETTE.find((c) => !F.couleurs.includes(c)) ?? '#FFFFFF';
          F.couleurs.push(libre);
          dessinerCouleurs();
          majCouleurTete();
          marquer();
          // une couleur de la palette, à changer d'un clic sur sa pastille ou en tapant son code
          return f.querySelector(`[data-esp-hex="${F.couleurs.length - 1}"]`)?.select();
        }
        if (a === 'coul-retirer') { F.couleurs.splice(Number(b.dataset.i), 1); dessinerCouleurs(); majCouleurTete(); return marquer(); }
        if (a === 'police-plus') return ajouterPolice();
        if (a === 'police-retirer') { F.polices.splice(Number(b.dataset.i), 1); dessinerPolices(); return marquer(); }
        if (a === 'oublier') {
          await api('DELETE', `/api/espaces/${enc(id)}/carnet/${enc(b.dataset.id)}`);
          lecons = lecons.filter((l) => l.id !== b.dataset.id);
          dessinerCarnet();
          return signalerApres();
        }
        if (a === 'vider') return dessinerCarnet(true);
        if (a === 'vider-non') return dessinerCarnet();
        if (a === 'vider-oui') {
          await api('DELETE', `/api/espaces/${enc(id)}/carnet`);
          lecons = [];
          dessinerCarnet();
          note('Le carnet est effacé.');
          return signalerApres();
        }
        if (a === 'serie-retirer') { serieAConfirmer = b.dataset.id; return dessinerSeries(); }
        if (a === 'serie-non') { serieAConfirmer = null; return dessinerSeries(); }
        if (a === 'serie-oui') {
          await api('DELETE', `/api/espaces/${enc(id)}/series/${enc(b.dataset.id)}`);
          series = series.filter((s) => s.id !== b.dataset.id);
          serieAConfirmer = null;
          dessinerSeries();
          note('Série retirée. Son modèle est gardé à part.');
          return signalerApres();
        }
        if (a === 'retirer') { $('[data-esp-danger]').innerHTML = retirerHtml(true); return; }
        if (a === 'retirer-non') { $('[data-esp-danger]').innerHTML = retirerHtml(false); return; }
        if (a === 'retirer-oui') {
          b.disabled = true;
          await api('DELETE', `/api/espaces/${enc(id)}`);
          modifie = false;
          await recharger().catch(() => {});
          signaler();
          note(`« ${e.nom} » est retiré. Ses projets passent à « Personne ».`);
          return sortir();
        }
      } catch (err) { b.disabled = false; note(err.message, true); }
    });
    async function signalerApres() { await recharger().catch(() => {}); signaler(); }

    // — la saisie —
    f.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.dataset.espCoul != null) {
        const i = Number(t.dataset.espCoul);
        F.couleurs[i] = t.value.toUpperCase();
        const hex = f.querySelector(`[data-esp-hex="${i}"]`);
        if (hex) hex.value = F.couleurs[i];
        t.closest('.esp-pastille')?.style.setProperty('--c', F.couleurs[i]);
        if (i === 0) majCouleurTete();
        return marquer();
      }
      if (t.dataset.espHex != null) {
        const m = HEX.exec(t.value.trim());
        t.classList.toggle('invalide', !m);
        if (!m) return;
        const i = Number(t.dataset.espHex);
        F.couleurs[i] = `#${m[1].toUpperCase()}`;
        const c = f.querySelector(`[data-esp-coul="${i}"]`);
        if (c) { c.value = F.couleurs[i].toLowerCase(); c.closest('.esp-pastille')?.style.setProperty('--c', F.couleurs[i]); }
        if (i === 0) majCouleurTete();
        return marquer();
      }
      const cle = t.dataset.espChamp;
      if (!cle || cle === 'chemin-logo' || (cle === 'police-nouvelle' && !t.value.trim())) return;
      if (cle === 'apprendre') texteApprendre();
      if (cle === 'nom') $('[data-esp-titre]').textContent = t.value.trim() || e.nom;
      marquer();
    });
    f.addEventListener('change', (ev) => {
      // un code couleur incomplet reprend la valeur gardée
      const t = ev.target;
      if (t.dataset.espHex != null) { t.value = F.couleurs[Number(t.dataset.espHex)] ?? ''; t.classList.remove('invalide'); }
      // une case à cocher n'envoie pas toujours « input » (vieux WebKit)
      if (t.dataset.espChamp === 'apprendre') { texteApprendre(); marquer(); }
    });
    f.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const cle = ev.target.dataset?.espChamp;
      if (cle === 'police-nouvelle') { ev.preventDefault(); ajouterPolice(); }
      else if (cle === 'chemin-logo') { ev.preventDefault(); poserLogo(valeur('chemin-logo').trim()); }
      else if (ev.target.tagName === 'INPUT' && ev.target.type !== 'checkbox' && (ev.metaKey || ev.ctrlKey || cle === 'nom' || cle === 'precision') && modifie) { ev.preventDefault(); enregistrer(); }
    });

    dessinerCouleurs();
    dessinerPolices();
    dessinerCarnet();
    dessinerSeries();
    texteApprendre();
    pied();
    choisirOnglet(['essentiel', 'marque', 'carnet', 'series'].includes(onglet) ? onglet : 'essentiel');
    poserImages(f);
  }

  // ===================================================================
  // Le choix « Pour qui ? » : des cartes (Moi, chaque client, Personne, « + Un client »)
  const sousTitreChoix = (e, d) => {
    if (e.type === 'neutre') return 'Un montage neutre';
    const m = e.metier && d?.metiers?.[e.metier.type];
    return m ? m.nom : e.type === 'moi' ? 'Ton style, ton carnet' : 'Sa marque, son carnet';
  };
  function carteChoix(e, d, actif, i) {
    const c = couleurDe(e);
    return `<button type="button" class="esp-choix ${e.type}${actif ? ' actif' : ''}" data-esp="choisir" data-id="${esc(e.id)}" style="${varsCouleur(c)};--i:${i}" title="${esc(phraseDe(e))}">
      ${avatar(e, 30)}<span class="esp-choix-txt"><b>${esc(e.nom)}</b><small>${esc(sousTitreChoix(e, d))}</small></span><span class="esp-coche">${ic('coche')}</span></button>`;
  }
  const phraseHtml = (e) => (e ? `<span class="esp-phrase-ic">${icType(e)}</span><span><b>${esc(titrePour(e))}</b>${esc(phraseDe(e))}</span>` : '');
  /** Pour un choix fait avant d'avoir la liste : Moi et Personne existent toujours. */
  const parDefaut = () => ({dernier: 'moi', metiers: {}, metier_propose: null, espaces: [{id: 'moi', nom: 'Moi', type: 'moi', apprend: true}, {id: 'neutre', nom: 'Personne', type: 'neutre', apprend: false}]});

  /**
   * Dessine le choix dans `conteneur` (rien n'ouvre de feuille). `surChoix(id, cree)` est appelé à chaque choix ;
   * `garder` : la carte choisie reste marquée (champ) ou non (choix rapide qui se ferme).
   */
  function dessinerChoix(conteneur, {valeur = null, surChoix = () => {}, garder = true, survol = false} = {}) {
    let d = donnees;
    let choisi = valeur;
    let mini = false;
    const existe = (id) => !!d?.espaces?.some((e) => e.id === id);
    // la liste est déjà là : la bonne carte est cochée dès le premier dessin (pas de second dessin à l'arrivée)
    if (d && !existe(choisi)) choisi = existe(d.dernier) ? d.dernier : 'moi';
    const enCours = () => d?.espaces?.find((e) => e.id === choisi) ?? null;
    function dessiner() {
      if (!d) {
        conteneur.innerHTML = `<div class="esp-choix-grille">${'<span class="esp-attente"></span>'.repeat(3)}</div>`;
        return;
      }
      const cartes = d.espaces.filter((e) => e.type !== 'neutre');
      const neutres = d.espaces.filter((e) => e.type === 'neutre');
      conteneur.innerHTML = `<div class="esp-choix-grille">
          ${cartes.map((e, i) => carteChoix(e, d, garder && e.id === choisi, i)).join('')}
          ${neutres.map((e, i) => carteChoix(e, d, garder && e.id === choisi, cartes.length + i)).join('')}
          <button type="button" class="esp-choix esp-ajout${mini ? ' ouvert' : ''}" data-esp="plus" style="--i:${cartes.length + neutres.length}"><span class="esp-avatar ajout" style="--t:30px">${ic('plus')}</span><span class="esp-choix-txt"><b>Un client</b><small>Sa marque, son carnet</small></span></button>
        </div>
        <div class="esp-mini${mini ? '' : ' cache'}" data-esp-mini><span class="esp-mini-ic">${ic('mallette')}</span><input class="entree" data-esp-mini-nom maxlength="60" placeholder="Nom du client (par exemple : la mairie, un café, une association)" autocomplete="off" spellcheck="false"><button type="button" class="btn petit" data-esp="mini-annuler">Annuler</button><button type="button" class="btn petit bleu" data-esp="creer">Créer</button></div>
        <p class="esp-phrase${mini ? ' cache' : ''}" data-esp-phrase style="${varsCouleur(couleurDe(enCours() ?? {id: 'moi'}))}">${phraseHtml(enCours())}</p>`;
      poserImages(conteneur);
    }
    function montrerPhrase(e) {
      const p = conteneur.querySelector('[data-esp-phrase]');
      if (!p || !e) return;
      p.style.setProperty('--c', couleurDe(e));
      p.style.setProperty('--encre', encre(couleurDe(e)));
      p.innerHTML = phraseHtml(e);
      p.classList.remove('rejoue');
      void p.offsetWidth; // relance l'animation d'entrée
      p.classList.add('rejoue');
    }
    function choisir(id, cree = false) {
      choisi = id;
      if (garder) {
        conteneur.querySelectorAll('[data-esp="choisir"]').forEach((x) => x.classList.toggle('actif', x.dataset.id === id));
        montrerPhrase(enCours());
      }
      surChoix(id, cree);
    }
    function ouvrirMini(oui) {
      mini = oui;
      conteneur.querySelector('[data-esp-mini]')?.classList.toggle('cache', !oui);
      conteneur.querySelector('[data-esp-phrase]')?.classList.toggle('cache', oui);
      conteneur.querySelector('[data-esp="plus"]')?.classList.toggle('ouvert', oui);
      if (oui) conteneur.querySelector('[data-esp-mini-nom]')?.focus();
    }
    async function creer() {
      const champ = conteneur.querySelector('[data-esp-mini-nom]');
      const bouton = conteneur.querySelector('[data-esp="creer"]');
      if (bouton) bouton.disabled = true;
      const e = await nouveauClient(champ?.value);
      if (bouton) bouton.disabled = false;
      if (!e) return champ?.focus();
      d = donnees ?? d;
      mini = false;
      choisi = e.id;
      dessiner();
      note(`« ${e.nom} » est créé. Tu régleras sa marque dans Mes espaces.`);
      choisir(e.id, true);
    }
    // un seul jeu d'écouteurs par conteneur, même s'il est redessiné
    const ancien = conteneur.__espArret;
    if (ancien) ancien.abort();
    const arret = new AbortController();
    conteneur.__espArret = arret;
    conteneur.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-esp]');
      if (!b || !conteneur.contains(b)) return;
      const a = b.dataset.esp;
      if (a === 'choisir') return choisir(b.dataset.id);
      if (a === 'plus') return ouvrirMini(!mini);
      if (a === 'mini-annuler') return ouvrirMini(false);
      if (a === 'creer') return creer();
    }, {signal: arret.signal});
    conteneur.addEventListener('keydown', (ev) => {
      if (!ev.target.matches?.('[data-esp-mini-nom]')) return;
      // ces touches restent dans le petit formulaire : ni « Créer le projet », ni la fermeture de la feuille
      if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); creer(); }
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); ouvrirMini(false); }
    }, {signal: arret.signal});
    if (survol) {
      // choix rapide : la phrase suit la carte survolée
      conteneur.addEventListener('pointerover', (ev) => {
        const b = ev.target.closest('[data-esp="choisir"]');
        if (b && !mini) montrerPhrase(d?.espaces?.find((e) => e.id === b.dataset.id));
      }, {signal: arret.signal});
    }
    conteneur.classList.add('esp-pourqui');
    dessiner();
    /** Lit (ou relit) la liste et redessine si elle a changé. Renvoie l'espace choisi. */
    const charger = (force) => {
      const dAvant = d;
      const avant = choisi;
      return (force ? recharger() : liste()).then((x) => { d = x; }).catch(() => { d ??= parDefaut(); }).then(() => {
        if (!existe(choisi)) choisi = existe(d.dernier) ? d.dernier : 'moi';
        if (d !== dAvant || choisi !== avant || force) dessiner();
        return choisi;
      });
    };
    return {valeur: () => choisi ?? d?.dernier ?? 'moi', charger, choisir};
  }

  /**
   * Le choix « Pour qui ? » dans la feuille Nouveau projet (dans `conteneur`, sans ouvrir d'autre feuille).
   * `surChange(id)` suit chaque choix ; il est aussi appelé une fois à l'arrivée de la liste si l'espace retenu n'est
   * pas `valeur` (rien de donné : le dernier espace choisi ; un client retiré : idem).
   */
  function champPourQui(conteneur, {valeur = null, surChange = null} = {}) {
    const dire = (id) => { try { surChange?.(id); } catch (err) { console.error(err); } };
    const c = dessinerChoix(conteneur, {valeur, garder: true, surChoix: (id) => dire(id)});
    c.charger(false).then((id) => { if (id !== valeur) dire(id); });
    return {
      valeur: () => c.valeur(),
      recharger: () => { const avant = c.valeur(); return c.charger(true).then((id) => { if (id !== avant) dire(id); return id; }); },
    };
  }

  /** Une petite feuille : « Pour qui ? ». Renvoie l'espace choisi (son id), ou null si on ferme sans choisir. */
  function choisirEspace({actuel = null, titre = 'Pour qui ?'} = {}) {
    return new Promise((resoudre) => {
      let fini = false;
      const finir = (v) => { if (fini) return; fini = true; arreter(); resoudre(v); };
      const f = feuille(`<h3>${esc(titre)}</h3><p class="sous-titre">Ton IA suivra le style, la marque et le carnet de l’espace choisi. Ce que tu apprends pour toi ne part jamais chez un client.</p>
        <div data-esp-zone></div>
        <div class="pied"><span class="espace"></span><button class="btn" data-esp="annuler">Annuler</button></div>`, true);
      f.classList.add('esp-feuille', 'esp-choisir');
      const arreter = surFermeture(f, () => finir(null));
      const zone = f.querySelector('[data-esp-zone]');
      const c = dessinerChoix(zone, {valeur: actuel, garder: true, survol: true, surChoix: (id) => {
        // une petite pause pour voir la carte se cocher, puis la feuille se ferme ; la réponse part ensuite, pour que
        // l'appelant puisse ouvrir sa propre feuille sans qu'on la referme derrière lui
        setTimeout(() => { if (fini) return; finir(id); fermerFeuille(); }, 160);
      }});
      c.charger(false);
      f.addEventListener('click', (ev) => { if (ev.target.closest('[data-esp="annuler"]')) { finir(null); fermerFeuille(); } });
    });
  }

  return {liste, recharger, couleurDe, feuilleEspaces, feuilleEspace, choisirEspace, champPourQui};
}
