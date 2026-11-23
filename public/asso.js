// Dérush — l'association derrière Dérush : la bannière de l'accueil, la fenêtre « Soutenir » (à gauche le récit : les
// photos en paysage, comment chaque groupe a financé son voyage ; à droite le don : le projet en cours, illustré par
// son affiche, ses photos, son logo et ses dates, puis l'association et Revolut), « Nous écrire » et « Signaler un bug ».
// Le serveur dit quoi montrer (lib/asso.mjs) : les cagnottes viennent de HelloAsso, par le site de l'association. Le
// paiement se fait sur la page de HelloAsso, dans le navigateur : aucune carte ne passe par Dérush.
// Rien ne part sans un clic : le diagnostic d'un bug est montré en entier avant « Envoyer ».

const COEUR = '<svg class="ic plein" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.4s-7.6-4.5-7.6-10.1A4.3 4.3 0 0 1 8.7 6c1.4 0 2.6.7 3.3 1.8C12.700 6.700 13.900 6 15.300 6a4.300 4.300 0 0 1 4.300 4.300c0 5.600-7.600 10.100-7.600 10.100z"/></svg>';
const FLECHE = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16 16 8M9.5 8H16v6.5"/></svg>';
const INSECTE = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="8" height="11" rx="4"/><path d="M9.500 7.500a2.500 2.500 0 0 1 5 0M4.500 13H8M16 13h3.500M5.500 8.500 8.300 10.500M18.500 8.500l-2.800 2M5.500 18.500l2.800-2M18.500 18.500l-2.800-2M12 12v7"/></svg>';
const ENVELOPPE = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.500" y="6" width="17" height="12" rx="2.500"/><path d="m4.500 8 7.500 5.500L19.500 8"/></svg>';

const FAITS = {
  calendrier: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>',
  lieu: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  avion: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c.9 0 1.5.8 1.5 2v4.2l7 4.3v2l-7-2.2v4.200l2 1.500V20.500L12 19.500l-3.500 1V19l2-1.500V13.300l-7 2.200v-2l7-4.300V5c0-1.200.600-2 1.500-2z"/></svg>',
  groupe: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.5-3.200 2.700-5 5.500-5s5 1.800 5.500 5"/><circle cx="17" cy="9.500" r="2.300"/><path d="M16.500 14.200c2.200.200 3.700 1.700 4.100 4.300"/></svg>',
};

export function creerAsso(o) {
  const {api, note, esc, ic, logo, feuille, fermerFeuille, copierTexte} = o;
  const lien = (url) => api('POST', '/api/lien', {url}).catch((e) => note(e.message, true));
  const garde = {
    lire() { try { return JSON.parse(localStorage.getItem('derush.contact') || '{}'); } catch { return {}; } },
    ecrire(v) { try { localStorage.setItem('derush.contact', JSON.stringify(v)); } catch { /* stockage indisponible */ } },
  };
  let banniere = null; // l'état de la bannière, lu une fois par ouverture de l'accueil

  // ——— la bannière de l'accueil ———
  /** Le HTML de la bannière (vide si la personne l'a fermée). `b` : la réponse de /api/asso/banniere. */
  function htmlBanniere(b) {
    banniere = b;
    if (!b?.montrer) return '';
    const projet = b.projet ? `<span class="don-b-projet">Leur prochain défi : <b>${esc(b.projet.titre.split(' : ')[0])}</b>${b.projet.jours != null && b.projet.jours >= 0 ? `, encore ${b.projet.jours} jour${b.projet.jours > 1 ? 's' : ''} pour les aider.` : '.'}</span>` : '';
    return `<div class="don-banniere" data-don="ouvrir" role="button" tabindex="0" title="Découvrir l’association et faire un don">
      <span class="don-b-logo"><img src="/marque/yabai.webp" alt="${esc(b.nom)}" draggable="false"></span>
      <span class="don-b-txt"><b>Dérush est gratuit et open source.</b> Il a été imaginé par les jeunes de l’association ${esc(b.nom)}, qui financent eux-mêmes leurs voyages au Japon. ${projet}</span>
      ${b.projet?.logo ? `<img class="don-b-defi" src="${esc(b.projet.logo)}" alt="" draggable="false">` : ''}
      <button class="btn claude petit" data-don="ouvrir">${COEUR}<span>Soutenir</span></button>
      <button class="icone-btn don-fermer" data-don="masquer" title="Masquer pendant 30 jours (le cœur reste en haut)">${ic('fermer')}</button>
    </div>`;
  }
  /** Les liens du bas de l'accueil : soutenir, écrire, signaler un bug, les réseaux. */
  const htmlPied = () => `<div class="asso-pied"><span>Dérush est gratuit et open source (GPL-3.0), fait avec l’association YABAÏ.</span>
    <button class="btn lien" data-don="ouvrir">${COEUR}Soutenir</button><button class="btn lien" data-don="contact">${ENVELOPPE}Nous écrire</button><button class="btn lien" data-don="bug">${INSECTE}Signaler un bug</button></div>`;

  /** Les clics de la bannière et du pied (posé une fois sur l'écran d'accueil). */
  function ecouter(racine) {
    racine.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-don]');
      if (!b || !racine.contains(b)) return;
      const a = b.dataset.don;
      if (a === 'masquer') {
        e.stopPropagation();
        const carte = b.closest('.don-banniere');
        carte?.classList.add('part');
        setTimeout(() => carte?.remove(), 260);
        try { await api('POST', '/api/asso/banniere/masquer'); note('Bannière masquée pour 30 jours. Le cœur, en haut, ouvre toujours la page de l’association.'); } catch (err) { note(err.message, true); }
      } else if (a === 'ouvrir') { e.stopPropagation(); soutenir(); }
      else if (a === 'contact') contact();
      else if (a === 'bug') bug();
    });
    racine.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('don-banniere')) { e.preventDefault(); soutenir(); } });
  }

  // ——— le carrousel de photos (en paysage) ———
  const DUREE_PHOTO = 5200;
  /** `scene` : l'élément du carrousel ; `duree` : le temps de chaque photo (deux carrousels ne tournent pas ensemble). */
  function carrousel(scene, photos, {duree = DUREE_PHOTO} = {}) {
    if (!scene) return {arreter() {}, aller() {}};
    scene.style.setProperty('--duree', `${duree}ms`);
    const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let vues = []; // les photos qui se sont chargées, dans l'ordre de asso.json
    let i = 0;
    let minuteur = null;
    let ferme = false; // la fenêtre est fermée : une photo qui arrive encore ne relance rien
    const points = scene.querySelector('.don-points');
    const legende = scene.querySelector('.don-legende');
    const dire = (v) => { legende.innerHTML = `${esc(v.legende)}${v.credit ? ` <i>Photo : ${esc(v.credit)}</i>` : ''}`; };
    const montrer = (n) => {
      if (!vues.length) return;
      const avant = vues[i]?.el;
      i = (n + vues.length) % vues.length;
      // la photo qui s'en va garde son mouvement pendant le fondu (sinon elle sauterait)
      vues.forEach((v, k) => { v.el.classList.toggle('sort', v.el === avant && k !== i); v.el.classList.toggle('vue', k === i); });
      scene.classList.toggle('nue', !!vues[i].affiche); // une affiche porte son propre texte : rien n'est posé dessus
      dire(vues[i]);
      [...points.children].forEach((p, k) => p.classList.toggle('actif', k === i));
    };
    // le point de la photo montrée se remplit pendant qu'elle reste à l'écran
    const cadence = (oui) => { points.classList.remove('court'); if (oui) { void points.offsetWidth; points.classList.add('court'); } };
    const relancer = () => {
      clearInterval(minuteur);
      const tourne = !ferme && !calme && vues.length > 1;
      cadence(tourne);
      if (tourne) minuteur = setInterval(() => { montrer(i + 1); cadence(true); }, duree);
    };
    const pause = () => { clearInterval(minuteur); cadence(false); };
    photos.forEach((p, rang) => {
      const img = new Image();
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.alt = p.legende;
      img.draggable = false;
      if (rang === 0) img.fetchPriority = 'high';
      if (p.cadre) img.style.objectPosition = p.cadre; // où regarder dans la photo recadrée (validé par le serveur)
      img.addEventListener('load', () => {
        if (ferme) return;
        const el = document.createElement('div');
        el.className = `don-photo ${p.affiche ? 'affiche' : rang % 2 ? 'b' : 'a'}`;
        el.append(img);
        scene.querySelector('.don-piste').append(el);
        const pt = document.createElement('button');
        pt.title = p.legende;
        pt.setAttribute('aria-label', p.legende);
        pt.addEventListener('click', () => { montrer(vues.findIndex((v) => v.el === el)); relancer(); });
        // les photos gardent l'ordre de asso.json, quel que soit l'ordre où elles arrivent
        const courante = vues[i]?.el ?? null;
        const place = vues.findIndex((v) => v.rang > rang);
        const k = place < 0 ? vues.length : place;
        vues.splice(k, 0, {el, legende: p.legende, credit: p.credit, affiche: p.affiche, rang});
        points.insertBefore(pt, points.children[k] ?? null);
        scene.classList.add('a-photos');
        scene.classList.toggle('une-seule', vues.length < 2);
        // la première de la liste prend la main tant que personne n'a rien choisi ; sinon la photo montrée reste
        montrer(courante && rang !== 0 ? vues.findIndex((v) => v.el === courante) : (rang === 0 ? 0 : i));
        relancer();
      });
      // une photo qui ne vient pas (hors ligne, retirée du site) est simplement passée
      img.src = p.src;
    });
    const aller = (pas) => { if (vues.length > 1) { montrer(i + pas); relancer(); } };
    scene.querySelector('[data-photo="avant"]')?.addEventListener('click', () => aller(-1));
    scene.querySelector('[data-photo="apres"]')?.addEventListener('click', () => aller(1));
    scene.addEventListener('pointerenter', pause);
    scene.addEventListener('pointerleave', relancer);
    return {arreter() { ferme = true; clearInterval(minuteur); vues = []; }, aller};
  }

  // ——— le récit : les sommes réunies, qui se comptent quand elles arrivent à l'écran ———
  // l'espace des milliers : une espace insécable ordinaire, que toutes les polices ont (l'espace fine manque à certaines)
  const somme = (n) => `${n.toLocaleString('fr-FR').replace(/[\u202f\u2009 ]/g, '\u00a0')}\u00a0€`;
  function compter(racine) {
    const cibles = [...racine.querySelectorAll('[data-compte]')];
    if (!cibles.length || matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver !== 'function') return () => {};
    let ferme = false;
    const jouer = (el) => {
      const total = Number(el.dataset.compte);
      const debut = performance.now();
      const pas = (t) => {
        if (ferme || !el.isConnected) return;
        const p = Math.min(1, (t - debut) / 1100);
        el.textContent = somme(Math.round(total * (1 - (1 - p) ** 3) / 100) * 100);
        if (p < 1) requestAnimationFrame(pas); else el.textContent = somme(total);
      };
      requestAnimationFrame(pas);
    };
    const oeil = new IntersectionObserver((vus) => {
      for (const v of vus) if (v.isIntersecting) { oeil.unobserve(v.target); jouer(v.target); }
    }, {threshold: 0.6});
    cibles.forEach((el) => oeil.observe(el));
    return () => { ferme = true; oeil.disconnect(); };
  }

  // ——— « Soutenir » ———
  const reseaux = (liste) => liste.map((r) => `<button class="don-reseau mini" data-lien="${esc(r.lien)}" title="${esc(`${r.nom} : ${r.compte}`)}" aria-label="${esc(`${r.nom} : ${r.compte}`)}">${logo(r.id, 26)}</button>`).join('');
  const carteDon = (d, {projet = false} = {}) => {
    const jours = projet && d.jours != null && d.jours >= 0 ? (d.jours === 0 ? 'dernier jour' : `encore ${d.jours} jour${d.jours > 1 ? 's' : ''}`) : null;
    const objectif = projet && d.objectif ? `Objectif : ${d.objectif.toLocaleString('fr-FR')} €` : null;
    return `<div class="don-choix${projet ? ' projet' : ''}">
      <small class="don-sur">${projet ? `${ic('etincelle', 'plein')}Un projet en cours${jours ? ` · ${jours}` : ''}` : `${COEUR}L’association`}</small>
      <b>${esc(d.titre)}</b>
      <p>${esc(d.texte)}</p>
      <div class="don-choix-bas">${objectif ? `<span class="don-objectif">${esc(objectif)}</span>` : '<span></span>'}${projet
        ? `<button class="btn claude" data-lien="${esc(d.lien)}">${esc(d.bouton)}${FLECHE}</button>`
        : `<button class="btn don-second" data-libre>${esc(d.bouton)}</button>`}</div>
    </div>`;
  };

  // ——— le don libre : un montant choisi ici, payé sur HelloAsso (sans cagnotte) ———
  const euros = (n) => n.toLocaleString('fr-FR', {minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2});
  /** Le formulaire du don libre (la seconde page de la fenêtre « Soutenir »). */
  const pageLibre = (d) => {
    const l = d.libre ?? {montants: [5, 10, 20, 50, 100], min: 1, max: 20000, deduction: 0.66};
    const g = garde.lire();
    return `<button class="btn lien don-retour" data-retour>${ic('prec')}Retour</button>
      <h3 class="don-titre">Un don libre<br><em>à l’association ${esc(d.asso.nom)}</em></h3>
      <p class="don-histoire">Du montant que tu veux, sans cagnotte : il va à l’association, pour faire vivre les projets des jeunes.</p>
      <div class="don-montants" role="group" aria-label="Le montant de ton don">${l.montants.map((m) => `<button data-montant="${m}"${m === 20 ? ' class="actif"' : ''}>${m} €</button>`).join('')}
        <label class="don-autre" title="Un autre montant, à partir de ${l.min} €"><input id="don-autre" inputmode="decimal" autocomplete="off" maxlength="9" placeholder="Autre"><span>€</span></label></div>
      <p class="don-cout"></p>
      <div class="asso-deux"><label class="champ"><span>Ton prénom</span><input id="don-prenom" autocomplete="given-name" maxlength="60"></label>
        <label class="champ"><span>Ton nom</span><input id="don-nom" autocomplete="family-name" maxlength="60"></label></div>
      <label class="champ"><span>Ton e-mail (HelloAsso t’y envoie ton reçu fiscal)</span><input id="don-email" type="email" autocomplete="email" maxlength="200" placeholder="toi@exemple.fr" value="${esc(g.email ?? '')}"></label>
      <label class="champ"><span>Un mot pour les jeunes (facultatif ; il peut être affiché sur le site de l’association)</span><input id="don-mot" maxlength="300" placeholder="Bravo, continuez !"></label>
      <label class="bug-joindre"><input type="checkbox" id="don-anonyme"><span>Don anonyme</span><small class="dim">ton nom n’est pas transmis</small></label>
      <button class="btn claude don-payer" data-donner>${COEUR}<span></span>${FLECHE}</button>
      <p class="asso-repli dim"></p>
      <p class="don-note">${ic('cadenas')}<span>Tu paies sur la page sécurisée de HelloAsso, qui s’ouvre dans ton navigateur : ta carte ne passe jamais par Dérush. Ton prénom, ton nom et ton e-mail vont au site de l’association puis à HelloAsso, pour ton reçu ; Dérush ne les garde pas.${d.dons.asso?.lien ? ` <button class="btn lien" data-lien="${esc(d.dons.asso.lien)}">Ou passer par la page HelloAsso de l’association</button>` : ''}</span></p>`;
  };
  /** Fait vivre le formulaire : le montant choisi, ce qu'il coûte après impôt, l'envoi. */
  function brancherLibre(f, d) {
    const l = d.libre ?? {min: 1, max: 20000, deduction: 0.66};
    const page = f.querySelector('.don-page.libre');
    const autre = page.querySelector('#don-autre');
    let montant = 20;
    const lire = () => { const v = Number(String(autre.value).trim().replace(/\s/g, '').replace(',', '.')); return autre.value.trim() ? (Number.isFinite(v) ? v : NaN) : montant; };
    const dire = () => {
      const m = lire();
      const bon = Number.isFinite(m) && m >= l.min && m <= l.max;
      page.querySelector('.don-cout').innerHTML = bon
        ? `<b>${euros(m)} €</b> donnés, soit <b>${euros(Math.round(m * (1 - l.deduction) * 100) / 100)} €</b> après la réduction d’impôt (${Math.round(l.deduction * 100)} % déductibles).`
        : `Un don va de ${l.min} € à ${l.max.toLocaleString('fr-FR')} €.`;
      const b = page.querySelector('[data-donner]');
      b.disabled = !bon;
      b.querySelector('span').textContent = bon ? `Donner ${euros(m)} € avec HelloAsso` : 'Choisis un montant';
    };
    autre.addEventListener('input', () => { page.querySelectorAll('[data-montant]').forEach((x) => x.classList.toggle('actif', !autre.value.trim() && Number(x.dataset.montant) === montant)); dire(); });
    page.querySelector('#don-anonyme').addEventListener('change', (e) => { for (const id of ['#don-prenom', '#don-nom']) page.querySelector(id).disabled = e.target.checked; });
    page.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-montant]');
      if (m) { montant = Number(m.dataset.montant); autre.value = ''; page.querySelectorAll('[data-montant]').forEach((x) => x.classList.toggle('actif', x === m)); return dire(); }
      const b = e.target.closest('[data-donner]');
      if (!b) return;
      const corps = {montant: lire(), prenom: page.querySelector('#don-prenom').value, nom: page.querySelector('#don-nom').value, email: page.querySelector('#don-email').value, message: page.querySelector('#don-mot').value, anonyme: page.querySelector('#don-anonyme').checked};
      b.disabled = true;
      b.classList.add('attente');
      try {
        const r = await api('POST', '/api/asso/don', corps);
        await lien(r.lien);
        page.innerHTML = `<div class="don-merci"><span class="don-b-logo grand"><img src="/marque/yabai.webp" alt="" draggable="false"></span>
          <h3 class="don-titre">Merci !<br><em>Plus qu’un geste.</em></h3>
          <p class="don-histoire">La page de paiement de HelloAsso est ouverte dans ton navigateur : il te reste à y valider ton don de <b>${euros(r.montant)} €</b>. Ton reçu fiscal arrive ensuite par e-mail.</p>
          <div class="pied"><button class="btn" data-lien="${esc(r.lien)}" title="La page reste ouverte un quart d’heure">Rouvrir la page de paiement</button><button class="btn principal" data-fermer>Fermer</button></div></div>`;
      } catch (err) {
        note(err.message, true);
        const z = page.querySelector('.asso-repli');
        if (z && err.repli?.lien) z.innerHTML = `Autrement : <button class="btn petit" data-lien="${esc(err.repli.lien)}">Ouvrir la page HelloAsso de l’association</button>`;
        b.disabled = false;
        b.classList.remove('attente');
      }
    });
    dire();
  }

  /** Une étape du récit : la somme (comptée à l'écran), quand, et comment ils ont fait. */
  const etape = (e, k) => `<li class="don-etape${e.suite ? ' suite' : ''}" style="--i:${k}">
      <span class="don-etape-chiffre">${e.montant ? `<b data-compte="${e.montant}">${somme(e.montant)}</b>` : ''}${e.mention ? `<small>${esc(e.mention)}</small>` : ''}</span>
      <span class="don-etape-texte"><small>${esc(e.quand)}</small><span>${esc(e.texte)}</span>${e.suite ? `<button class="btn lien don-vers-projet" data-vers-projet>${COEUR}Les aider à partir</button>` : ''}</span>
    </li>`;
  /**
   * Le projet en cours, illustré : ses images (l'affiche de la cagnotte, ses photos) dans un petit carrousel, son logo,
   * ce qu'il faut savoir en quelques mots, ses vidéos, et le bouton de la cagnotte. Sans images connues, la bande de
   * la cagnotte (venue de HelloAsso en direct) sert d'illustration.
   */
  const vitrine = (p, d) => {
    const jours = p.jours != null && p.jours >= 0 ? (p.jours === 0 ? 'dernier jour' : `encore ${p.jours} jour${p.jours > 1 ? 's' : ''}`) : null;
    const vues = p.images?.length ? p.images : (p.image ? [{src: p.image, legende: p.titre, affiche: true}] : []);
    const bande = !p.images?.length && !!p.image;
    return `<section class="don-projet">
      ${vues.length ? `<div class="don-photos don-projet-vues${bande ? ' en-bandeau' : ''}" aria-label="Images du projet" aria-roledescription="carrousel">
        <div class="don-piste"></div>
        <div class="don-vide">${p.logo ? `<img class="don-projet-attente" src="${esc(p.logo)}" alt="" draggable="false">` : `<b>${esc(p.titre.split(' : ')[0])}</b>`}</div>
        ${vues.length > 1 ? `<button class="don-fleche g" data-photo="avant" title="Image d’avant">${ic('prec')}</button><button class="don-fleche d" data-photo="apres" title="Image suivante">${ic('suiv')}</button>` : ''}
        <div class="don-bas-photo"><span class="don-legende"></span><span class="don-points"></span></div>
      </div>` : ''}
      <div class="don-projet-corps">
        <small class="don-sur">${ic('etincelle', 'plein')}Un projet en cours${jours ? ` · ${jours}` : ''}<span class="don-direct${d.direct ? ' oui' : ''}" title="${d.direct ? 'Ce projet vient de HelloAsso, à l’instant.' : 'Le site de l’association ne répond pas : voici le projet connu de Dérush.'}"><i></i>${d.direct ? 'En direct' : 'Hors ligne'}</span></small>
        <h4 class="don-projet-titre" data-titre="${esc(p.titre)}">${p.logo ? `<img src="${esc(p.logo)}" alt="${esc(p.titre.split(' : ')[0])}" draggable="false">${p.devise ? `<span>${esc(p.devise)}</span>` : ''}` : esc(p.titre)}</h4>
        <p>${esc(p.texte)}</p>
        ${p.faits?.length ? `<ul class="don-faits">${p.faits.map((x) => `<li>${x.icone === 'coeur' ? COEUR : x.icone === 'outil' ? ic('outil') : (FAITS[x.icone] ?? COEUR)}<span>${esc(x.texte)}</span></li>`).join('')}</ul>` : ''}
        ${p.videos?.length ? `<div class="don-videos">${p.videos.map((v) => `<button class="btn lien don-video" data-lien="${esc(v.lien)}" title="S’ouvre dans ton navigateur">${ic('lire', 'plein')}${esc(v.titre)}</button>`).join('')}</div>` : ''}
        <div class="don-choix-bas">
          ${p.objectif ? `<span class="don-objectif">Objectif : ${p.objectif.toLocaleString('fr-FR')} €</span>` : '<span></span>'}
          <button class="btn claude" data-lien="${esc(p.lien)}">${esc(p.bouton)}${FLECHE}</button>
        </div>
      </div>
    </section>`;
  };
  /** Revolut : une ligne discrète ; au clic, le code QR à scanner avec le téléphone (le don se fait dans l'app). */
  const ligneRevolut = (r) => (r ? `<div class="don-revolut">
      <button class="don-revolut-tete" data-revolut aria-expanded="false">${logo('revolut', 30)}<span><b>${esc(r.titre)}</b><small>${esc(r.accroche || 'Tu as l’app ? Donne depuis ton téléphone.')}</small></span>${ic('suiv')}</button>
      <div class="don-revolut-detail cache">
        ${r.qr ? `<svg class="don-qr" viewBox="0 0 ${r.qr.taille} ${r.qr.taille}" role="img" aria-label="Code QR de la page de don de l’association sur Revolut" shape-rendering="crispEdges"><rect width="${r.qr.taille}" height="${r.qr.taille}" fill="#fff"/><path d="${esc(r.qr.d)}" fill="#111"/></svg>` : ''}
        <span>${r.qr ? '<b>Scanne ce code avec ton téléphone.</b>' : ''}<small>${esc(r.texte)}</small><button class="btn lien" data-lien="${esc(r.lien)}">${esc(r.bouton)}${FLECHE}</button></span>
      </div>
    </div>` : '');

  async function soutenir() {
    const f = feuille(`<div class="don-attente"><span class="don-b-logo grand"><img src="/marque/yabai.webp" alt="YABAÏ" draggable="false"></span><p class="sous-titre">On va chercher les projets en cours…</p></div>`, true);
    f.classList.add('soutien');
    let d;
    try { d = await api('GET', '/api/asso'); } catch (e) { fermerFeuille(); return note(e.message, true); }
    if (!f.isConnected) return;
    const a = d.asso;
    const r = a.recit ?? {};
    const projets = d.dons.projets ?? [];
    const [vedette, ...autres] = projets; // le premier projet ouvert est mis en avant, illustré
    f.innerHTML = `
      <button class="icone-btn don-clore" data-fermer title="Fermer">${ic('fermer')}</button>
      <div class="don-deux">
      <div class="don-recit">
        <div class="don-photos" aria-label="Photos de l’association" aria-roledescription="carrousel">
          <div class="don-piste"></div>
          <div class="don-vide"><span class="don-b-logo grand"><img src="/marque/yabai.webp" alt="" draggable="false"></span><b>${esc(a.accroche || a.devise)}</b></div>
          <button class="don-fleche g" data-photo="avant" title="Photo d’avant">${ic('prec')}</button><button class="don-fleche d" data-photo="apres" title="Photo suivante">${ic('suiv')}</button>
          <div class="don-bas-photo"><span class="don-legende"></span><span class="don-points"></span></div>
        </div>
        <div class="don-texte">
          <span class="don-b-logo don-signe" title="${esc(`Association ${a.nom} — ${[a.devise, a.lieu].filter(Boolean).join(' · ')}`)}"><img src="/marque/yabai.webp" alt="${esc(`Association ${a.nom}`)}" draggable="false"></span>
          ${r.titre || r.titre_fort ? `<h3 class="don-titre">${esc(r.titre)}${r.titre && r.titre_fort ? '<br>' : ''}${r.titre_fort ? `<em>${esc(r.titre_fort)}</em>` : ''}</h3>` : ''}
          ${r.intro ? `<p class="don-intro">${esc(r.intro)}</p>` : ''}
          ${r.etapes?.length ? `<ol class="don-etapes">${r.etapes.map(etape).join('')}</ol>` : ''}
        </div>
      </div>
      <div class="don-corps">
        <div class="don-page accueil">
        ${vedette ? vitrine(vedette, d) : `<h4 class="don-question">Où va ton don ?<span class="don-direct${d.direct ? ' oui' : ''}"><i></i>${d.direct ? 'En direct de HelloAsso' : 'Hors ligne'}</span></h4>`}
        <div class="don-liste">${autres.map((p) => carteDon(p, {projet: true})).join('')}${d.dons.asso ? carteDon(d.dons.asso) : ''}</div>
        ${ligneRevolut(d.dons.revolut)}
        <p class="don-note">${ic('cadenas')}<span>${esc(a.fiscal)} ${esc(a.paiement)}</span></p>
        <div class="don-suite">
          <div class="don-suite-haut"><span class="don-suite-t">Pas de budget ? Les suivre aide aussi.</span><div class="don-reseaux">${reseaux(d.reseaux)}</div></div>
          <div class="don-liens"><button class="btn lien" data-lien="${esc(a.site)}">${ic('globe')}yabai.fr</button><button class="btn lien" data-asso="contact">${ENVELOPPE}Nous écrire</button>${d.depot ? `<button class="btn lien" data-lien="${esc(d.depot)}" title="Dérush est un logiciel libre (licence GPL-3.0) : son code est ouvert à tous">${logo('github', 14)}Code source</button>` : ''}</div>
        </div>
        </div>
        <div class="don-page libre cache">${pageLibre(d)}</div>
      </div>
      </div>`;
    // un logo de projet qui ne vient pas (une image du site, hors ligne) : le titre en toutes lettres
    f.querySelector('.don-projet-titre img')?.addEventListener('error', (e) => { const h = e.target.closest('.don-projet-titre'); if (h) h.textContent = h.dataset.titre; });
    f.querySelector('.don-projet-attente')?.addEventListener('error', (e) => e.target.remove());
    brancherLibre(f, d);
    const photos = carrousel(f.querySelector('.don-recit .don-photos'), d.photos ?? []);
    const scene = f.querySelector('.don-projet-vues');
    const vuesProjet = carrousel(scene, vedette?.images?.length ? vedette.images : (vedette?.image ? [{src: vedette.image, legende: vedette.titre, affiche: true}] : []), {duree: 6400});
    const finCompte = compter(f);
    const fleches = (e) => {
      if (!f.isConnected) return arreter(); // la fenêtre a été remplacée par une autre
      if (e.target.closest?.('input, textarea, select') || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      if (!f.querySelector('.don-page.accueil')?.classList.contains('cache')) photos.aller(e.key === 'ArrowLeft' ? -1 : 1);
    };
    document.addEventListener('keydown', fleches);
    const arreter = () => { photos.arreter(); vuesProjet.arreter(); finCompte(); document.removeEventListener('keydown', fleches); };
    f.avantFermeture = () => { arreter(); };
    const deux = f.querySelector('.don-deux');
    const corps = f.querySelector('.don-corps');
    // quand la fenêtre est étroite, tout défile d'un bloc : on amène le don à l'écran
    const versDon = () => { corps.scrollTop = 0; if (deux.scrollHeight > deux.clientHeight + 4) deux.scrollTo({top: corps.offsetTop, behavior: 'smooth'}); };
    f.addEventListener('click', (e) => {
      if (e.target.closest('[data-fermer]')) return fermerFeuille();
      // le don libre : la seconde page de la colonne du don, et son retour
      const pages = (libre) => { f.querySelector('.don-page.accueil').classList.toggle('cache', libre); f.querySelector('.don-page.libre').classList.toggle('cache', !libre); versDon(); };
      if (e.target.closest('[data-libre]')) { pages(true); setTimeout(() => f.querySelector('#don-prenom')?.focus({preventScroll: true}), 60); return; }
      if (e.target.closest('[data-retour]')) return pages(false);
      // « Les aider à partir » : montre la carte du projet en cours
      if (e.target.closest('[data-vers-projet]')) {
        if (f.querySelector('.don-page.accueil').classList.contains('cache')) pages(false); else versDon();
        const carte = f.querySelector('.don-projet, .don-choix.projet');
        if (carte) { carte.classList.remove('appel'); void carte.offsetWidth; carte.classList.add('appel'); }
        return;
      }
      const rv = e.target.closest('[data-revolut]');
      if (rv) {
        const detail = rv.parentElement.querySelector('.don-revolut-detail');
        const ouvert = detail.classList.toggle('cache') === false;
        rv.setAttribute('aria-expanded', String(ouvert));
        rv.parentElement.classList.toggle('ouvert', ouvert);
        if (ouvert) detail.scrollIntoView({block: 'nearest', behavior: 'smooth'});
        return;
      }
      const l = e.target.closest('[data-lien]');
      if (l) {
        lien(l.dataset.lien);
        if (l.classList.contains('don-video')) note('La vidéo s’ouvre dans ton navigateur.');
        else if (l.closest('.don-choix, .don-projet')) note('La page de HelloAsso s’ouvre dans ton navigateur. Merci pour eux !', false, true);
        else if (l.closest('.don-revolut')) note('La page de Revolut s’ouvre dans ton navigateur. Merci pour eux !', false, true);
        return;
      }
      const autre = e.target.closest('[data-asso]')?.dataset.asso;
      if (autre === 'contact') { arreter(); contact(); }
    });
  }

  // ——— « Nous écrire » ———
  const champsQui = (g) => `<div class="asso-deux"><label class="champ"><span>Ton nom ou ton pseudo</span><input id="as-nom" autocomplete="name" maxlength="80" value="${esc(g.nom ?? '')}"></label>
    <label class="champ"><span>Ton e-mail (pour te répondre)</span><input id="as-email" type="email" autocomplete="email" maxlength="200" placeholder="toi@exemple.fr" value="${esc(g.email ?? '')}"></label></div>`;
  const repli = (e, f) => { const z = f.querySelector('.asso-repli'); if (z && e.repli?.email) z.innerHTML = `Autrement : écris à <b class="selectionnable">${esc(e.repli.email)}</b> <button class="btn petit" data-copier="${esc(e.repli.email)}">${ic('copier')}Copier l’adresse</button>`; };

  async function contact() {
    let d = null;
    try { d = await api('GET', '/api/asso'); } catch { /* hors ligne : le formulaire reste, avec l'adresse */ }
    const a = d?.asso ?? {nom: 'YABAÏ', contact: 'contact@yabai.fr', site: 'https://www.yabai.fr', lieu: ''};
    const g = garde.lire();
    const f = feuille(`<h3 class="asso-h">Nous écrire</h3>
      <p class="sous-titre">Une question, une idée, un partenariat, l’envie de tester Dérush avec tes jeunes ? L’équipe de ${esc(a.nom)} te répond par e-mail.</p>
      ${champsQui(g)}
      <label class="champ"><span>Sujet</span><select id="as-sujet"><option>Une question sur Dérush</option><option>Une idée pour Dérush</option><option>Un partenariat, du mécénat</option><option>L’association et ses projets</option><option>Autre chose</option></select></label>
      <label class="champ"><span>Ton message</span><textarea id="as-message" rows="6" maxlength="6000" placeholder="Écris-nous comme tu parles."></textarea></label>
      <p class="asso-repli dim"></p>
      <div class="asso-infos"><span>${ENVELOPPE}<b class="selectionnable">${esc(a.contact)}</b></span><button class="btn lien" data-lien="${esc(a.site)}">${ic('globe')}yabai.fr</button>${a.lieu ? `<span>${ic('drapeau')}${esc(a.lieu)}</span>` : ''}<span class="espace"></span><span class="asso-reseaux">${(d?.reseaux ?? []).map((r) => `<button class="don-reseau mini" data-lien="${esc(r.lien)}" title="${esc(`${r.nom} : ${r.compte}`)}">${logo(r.id, 24)}</button>`).join('')}</span></div>
      <div class="pied"><small class="dim asso-part">Ton message part par le formulaire de contact de yabai.fr.</small><span class="espace"></span><button class="btn" data-fermer>Annuler</button><button class="btn principal" data-envoyer>${ic('envoi')}Envoyer</button></div>`);
    f.classList.add('asso');
    f.addEventListener('click', async (e) => {
      if (e.target.closest('[data-fermer]')) return fermerFeuille();
      const l = e.target.closest('[data-lien]');
      if (l) return lien(l.dataset.lien);
      const c = e.target.closest('[data-copier]');
      if (c) { await copierTexte(c.dataset.copier); return note('Adresse copiée.'); }
      const b = e.target.closest('[data-envoyer]');
      if (!b) return;
      const corps = {nom: f.querySelector('#as-nom').value, email: f.querySelector('#as-email').value, sujet: `[Dérush] ${f.querySelector('#as-sujet').value}`, message: f.querySelector('#as-message').value};
      b.disabled = true;
      try {
        await api('POST', '/api/asso/contact', corps);
        garde.ecrire({nom: corps.nom.trim(), email: corps.email.trim()});
        fermerFeuille();
        note('Message envoyé. L’équipe te répond par e-mail.', false, true);
      } catch (err) { note(err.message, true); repli(err, f); b.disabled = false; }
    });
    setTimeout(() => f.querySelector(g.nom ? '#as-message' : '#as-nom')?.focus(), 60);
  }

  // ——— « Signaler un bug » ———
  /** `contexte` : une phrase déjà connue (l'erreur affichée dans la conversation), posée dans la description. */
  async function bug(contexte = '') {
    const g = garde.lire();
    const f = feuille(`<h3 class="asso-h">Signaler un bug</h3>
      <p class="sous-titre">Dis-nous ce qui s’est passé. Dérush joint son diagnostic (ce qu’il a noté, ce qui est installé) : tu le vois en entier avant d’envoyer.</p>
      <label class="champ"><span>Qu’est-ce qui s’est passé ? Que faisais-tu ?</span><textarea id="as-quoi" rows="4" maxlength="4000" placeholder="Exemple : j’ai demandé une vidéo de 30 s, l’IA s’est arrêtée au bout de 2 minutes avec un message d’erreur.">${esc(contexte)}</textarea></label>
      <div class="bug-analyse"><div class="bug-attente">${ic('loupe')}<span>Dérush cherche ce qui a pu se passer…</span></div></div>
      ${champsQui(g)}
      <label class="bug-joindre"><input type="checkbox" id="as-joindre" checked><span>Joindre le diagnostic</span><button class="btn lien" data-voir>Voir ce qui part</button></label>
      <pre class="bug-rapport selectionnable cache" tabindex="0"></pre>
      <p class="asso-repli dim"></p>
      <div class="pied"><button class="btn petit" data-copier-rapport title="Copier le diagnostic, pour le coller où tu veux">${ic('copier')}Copier</button><button class="btn petit" data-ticket title="Ouvrir un ticket sur GitHub (public) : le diagnostic y est déjà, sans ton nom ni ton adresse">${logo('github', 16)}Ticket GitHub</button><span class="espace"></span><button class="btn" data-fermer>Annuler</button><button class="btn principal" data-envoyer>${ic('envoi')}Envoyer à l’équipe</button></div>`, true);
    f.classList.add('asso', 'bug');
    let diag = null;
    api('GET', '/api/asso/diagnostic').then((d) => {
      if (!f.isConnected) return;
      diag = d;
      f.querySelector('.bug-rapport').textContent = d.texte;
      const z = f.querySelector('.bug-analyse');
      z.innerHTML = d.pistes.length
        ? `<b class="bug-t">${ic('loupe')}Ce que Dérush a trouvé</b>${d.pistes.map((p) => `<div class="bug-piste"><b>${esc(p.cause)}${p.fois > 1 ? ` <i>${p.fois} fois</i>` : ''}</b><span>${ic('eclair', 'plein')}À essayer : ${esc(p.geste)}</span></div>`).join('')}<small class="dim">Si ça ne règle rien, envoie quand même : le rapport nous dira le reste.</small>`
        : `<b class="bug-t">${ic('loupe')}${d.erreurs ? `Dérush a noté ${d.erreurs} erreur${d.erreurs > 1 ? 's' : ''}, sans en reconnaître la cause.` : 'Dérush n’a noté aucune erreur de son côté.'}</b><small class="dim">${d.erreurs ? 'Elles sont dans le diagnostic : l’équipe les lira.' : 'Ta description compte d’autant plus : dis-nous l’écran, le bouton, ce que tu attendais.'}</small>`;
    }).catch((e) => { if (f.isConnected) f.querySelector('.bug-analyse').innerHTML = `<small class="dim">Le diagnostic n’a pas pu être fait (${esc(e.message)}). Tu peux quand même envoyer ta description.</small>`; });
    f.addEventListener('click', async (e) => {
      if (e.target.closest('[data-fermer]')) return fermerFeuille();
      if (e.target.closest('[data-voir]')) { e.preventDefault(); const p = f.querySelector('.bug-rapport'); p.classList.toggle('cache'); if (!p.classList.contains('cache')) p.scrollIntoView({block: 'nearest', behavior: 'smooth'}); return; }
      const c = e.target.closest('[data-copier]');
      if (c) { await copierTexte(c.dataset.copier); return note('Adresse copiée.'); }
      if (e.target.closest('[data-copier-rapport]')) { await copierTexte(`${f.querySelector('#as-quoi').value.trim()}\n\n${diag?.texte ?? ''}`.trim()); return note('Description et diagnostic copiés.'); }
      if (e.target.closest('[data-ticket]')) { if (!diag?.ticket) return note('Le diagnostic n’est pas encore prêt.', true); note('La page de GitHub s’ouvre : c’est public, écris-y ce qui s’est passé.'); return lien(diag.ticket); }
      const b = e.target.closest('[data-envoyer]');
      if (!b) return;
      const corps = {nom: f.querySelector('#as-nom').value, email: f.querySelector('#as-email').value, description: f.querySelector('#as-quoi').value, joindre: f.querySelector('#as-joindre').checked, rapport: diag?.texte ?? null};
      b.disabled = true;
      try {
        await api('POST', '/api/asso/bug', corps);
        garde.ecrire({nom: corps.nom.trim(), email: corps.email.trim()});
        fermerFeuille();
        note('Bug signalé. Merci : l’équipe te répond par e-mail.', false, true);
      } catch (err) { note(err.message, true); repli(err, f); b.disabled = false; }
    });
    setTimeout(() => f.querySelector('#as-quoi')?.focus(), 60);
  }

  // ——— les erreurs de l'interface vont au journal de Dérush (jamais ailleurs) ———
  function ecouterErreurs() {
    let dernier = 0;
    let total = 0;
    const noter = (message, detail, ou) => {
      const t = Date.now();
      if (!message || t - dernier < 3000 || total >= 20) return; // pas d'avalanche
      if (/en pause|Failed to fetch|Load failed|NetworkError|ResizeObserver/i.test(message)) return; // Dérush arrêté, ou sans gravité
      dernier = t; total++;
      fetch('/api/journal', {method: 'POST', headers: {'content-type': 'application/json', 'x-derush-jeton': document.querySelector('meta[name="derush-jeton"]')?.content ?? ''}, body: JSON.stringify({message, detail, ou})}).catch(() => {});
    };
    window.addEventListener('error', (e) => noter(String(e.message ?? ''), String(e.error?.stack ?? '').split('\n').slice(1, 5).join('\n'), e.filename ? `${String(e.filename).replace(/^https?:\/\/[^/]+/, '')}:${e.lineno}` : null));
    window.addEventListener('unhandledrejection', (e) => noter(`Promesse rejetée : ${String(e.reason?.message ?? e.reason ?? '')}`, String(e.reason?.stack ?? '').split('\n').slice(1, 5).join('\n'), null));
  }

  return {htmlBanniere, htmlPied, ecouter, soutenir, contact, bug, ecouterErreurs, COEUR, etat: () => banniere};
}
