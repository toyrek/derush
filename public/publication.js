// Dérush — après le montage, avant la publication : le tableau d'analyse de viralité, le plan de partage, et le guide
// pour relier ses réseaux (Treg). Ce fichier ne fait qu'afficher : les mesures, l'IA et la publication sont côté serveur
// (lib/publication.mjs, lib/conseil.mjs, lib/treg.mjs).
//
//   const pub = creerPublication({api, note, esc, ic, ill, logo, …});   // les outils de l'interface (voir app.js)
//   pub.ouvrir(nom, 'analyse' | 'partage')    l'écran « Avant de publier » pour une vidéo finie
//   pub.guideTreg()                            le guide « Relier mes réseaux », en trois gestes
const RESEAUX = {tiktok: 'TikTok', instagram: 'Instagram Reels', youtube: 'YouTube Shorts', linkedin: 'LinkedIn'};
const NOMS_COURTS = {tiktok: 'TikTok', instagram: 'Reels', youtube: 'Shorts', linkedin: 'LinkedIn'};
const GAINS = {fort: 'Gros effet', moyen: 'Effet moyen', 'léger': 'Petit plus'};

export function creerPublication(o) {
  const {api, note, esc, ic, ill, logo, JETON} = o;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const virgule = (n) => String(n).replace('.', ',');
  const temps = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const couleurNote = (n) => (n == null ? 'gris' : n >= 8 ? 'vert' : n >= 6 ? 'braise' : 'rouge');
  const motScore = (s) => (s >= 80 ? 'Prête à partir' : s >= 65 ? 'Bien partie' : s >= 50 ? 'À resserrer' : 'À retravailler');
  const ouvrirLien = (url) => { if (!/^https?:\/\//.test(url)) return; if (o.NATIF) o.natif('ouvrir', {url}); else window.open(url, '_blank', 'noopener'); };
  const hote = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

  let el = null; // l'écran, quand il est ouvert
  const S = {video: null, videos: [], onglet: 'analyse', analyse: null, plan: null, treg: null, reseau: 'tiktok', minuterie: 0, cle: '', enregistrement: 0, choix: null, visibilite: 'unlisted', consigne: ''};
  const lire = (k, d) => o.prefs?.lire(k, d) ?? d;
  const ecrire = (k, v) => o.prefs?.ecrire(k, v);

  // ——— ouverture, fermeture ———
  async function ouvrir(nom = null, onglet = 'analyse') {
    let videos;
    try { ({videos} = await api('GET', '/api/publication/videos')); } catch (e) { return note(e.message, true); }
    if (!videos.length) return note('Crée d’abord une vidéo : demande-la à ton IA, ou clique sur « Créer la vidéo ».', true);
    S.videos = videos;
    S.video = videos.find((v) => v.nom === nom)?.nom ?? videos[0].nom;
    S.onglet = onglet === 'partage' ? 'partage' : 'analyse';
    S.analyse = S.plan = null;
    S.cle = '';
    S.choix = new Set(lire('partage.reseaux', ['tiktok', 'instagram', 'youtube']).filter((k) => RESEAUX[k]));
    S.visibilite = lire('publier.visibilite', 'unlisted');
    fermer(true);
    el = document.createElement('div');
    el.className = 'pub-atelier';
    el.innerHTML = `<header class="pa-barre">
        <button class="icone-btn" data-pa="fermer" title="Revenir au montage (Échap)">${ic('retour')}</button>
        <div class="pa-titre"><b>Avant de publier</b><span id="pa-video"></span></div>
        <span class="espace"></span>
        <div class="segmente pa-onglets"><button data-onglet="analyse">${ic('eclair')}Analyse</button><button data-onglet="partage">${ic('publier')}Partage</button></div>
        <span class="espace"></span>
        <button class="icone-btn" data-pa="fermer" title="Fermer (Échap)">${ic('fermer')}</button>
      </header>
      <div class="pa-corps">
        <aside class="pa-gauche"><div class="pa-ecran"><video id="pa-lecteur" controls playsinline preload="auto"></video></div><div id="pa-choix"></div><div id="pa-reperes"></div></aside>
        <main class="pa-droite" id="pa-contenu"></main>
      </div>`;
    document.body.append(el);
    el.addEventListener('click', clic);
    el.addEventListener('input', saisie);
    el.addEventListener('change', saisie);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.pp-ajout')) { e.preventDefault(); ajouterHashtag(e.target); } });
    document.addEventListener('keydown', echap, true);
    await changerVideo(S.video);
  }
  function fermer(silence = false) {
    clearTimeout(S.minuterie);
    document.removeEventListener('keydown', echap, true);
    if (!el) return;
    $('#pa-lecteur', el)?.pause();
    el.remove();
    el = null;
    if (!silence) o.surFermeture?.();
  }
  function echap(e) {
    if (!el || e.key !== 'Escape' || o.feuilleOuverte?.()) return;
    if (e.target.matches?.('input, textarea')) return e.target.blur();
    e.stopPropagation();
    fermer();
  }
  async function changerVideo(nom) {
    S.video = nom;
    S.analyse = S.plan = null;
    S.cle = '';
    const v = S.videos.find((x) => x.nom === nom) ?? {};
    $('#pa-video', el).textContent = `${v.titre ?? 'Ta vidéo'}${v.duree ? ` · ${temps(v.duree)}` : ''}${v.largeur ? ` · ${v.largeur} × ${v.hauteur}` : ''}`;
    const lecteur = $('#pa-lecteur', el);
    lecteur.src = `/video?nom=${encodeURIComponent(nom)}&j=${JETON}`;
    // une image de la vidéo plutôt qu'un écran noir
    lecteur.addEventListener('loadedmetadata', () => { lecteur.currentTime = Math.min(1, (lecteur.duration || 3) / 3); }, {once: true});
    lecteur.parentElement.classList.toggle('large', (v.largeur ?? 9) > (v.hauteur ?? 16));
    $('#pa-choix', el).innerHTML = S.videos.length > 1 ? `<label class="pa-autre"><span>Vidéo</span><select data-pa="video">${S.videos.map((x) => `<option value="${esc(x.nom)}"${x.nom === nom ? ' selected' : ''}>${esc(x.titre ?? x.nom)}${x.analyse ? ` · ${x.analyse.score}/100` : ''}</option>`).join('')}</select></label>` : '';
    await relire();
  }
  /** Relit l'état de l'analyse et du plan ; pendant qu'un des deux travaille, on revient toutes les 1,2 s. */
  async function relire() {
    clearTimeout(S.minuterie);
    if (!el) return;
    const v = encodeURIComponent(S.video);
    try {
      const [a, p] = await Promise.all([api('GET', `/api/publication/analyse?video=${v}`), api('GET', `/api/publication/plan?video=${v}`)]);
      if (!el) return;
      S.analyse = a;
      // pendant qu'on retouche un plan fini, on ne le remplace pas par ce qui revient du serveur
      if (!(S.plan?.etat === 'fini' && p.etat === 'fini')) S.plan = p;
    } catch (e) { note(e.message, true); }
    if (!S.treg) api('GET', '/api/treg').then((t) => { S.treg = t; if (el && S.onglet === 'partage') rendre(true); }).catch(() => {});
    rendre();
    const travaille = (x) => ['mesures', 'ia'].includes(x?.etat);
    if (travaille(S.analyse) || travaille(S.plan)) S.minuterie = setTimeout(relire, 1200);
  }

  // ——— affichage ———
  function rendre(force = false) {
    if (!el) return;
    $$('.pa-onglets button', el).forEach((b) => b.classList.toggle('actif', b.dataset.onglet === S.onglet));
    rendreReperes();
    const x = S.onglet === 'analyse' ? S.analyse : S.plan;
    const cle = JSON.stringify([S.onglet, S.video, x?.etat, x?.etapes?.length, x?.erreur, S.onglet === 'partage' ? [S.reseau, [...S.choix], S.treg?.pret, S.treg?.jeton, S.treg?.verification?.le] : x?.resultat?.cree_le, o.iaPrete?.(), !!o.claude?.()?.en_cours]);
    const actif = document.activeElement;
    // un champ en cours de saisie n'est jamais redessiné sous les doigts
    if (!force && (cle === S.cle || (actif && el.contains(actif) && actif.matches('textarea, input')))) return majTemps();
    S.cle = cle;
    const haut = $('#pa-contenu', el).scrollTop;
    $('#pa-contenu', el).innerHTML = S.onglet === 'analyse' ? htmlAnalyse() : htmlPartage();
    $('#pa-contenu', el).scrollTop = haut;
    majTemps();
  }
  function majTemps() {
    const x = S.onglet === 'analyse' ? S.analyse : S.plan;
    const t = $('#pa-temps', el);
    if (t && x) t.textContent = x.depuis_s >= 60 ? `${Math.floor(x.depuis_s / 60)} min ${String(x.depuis_s % 60).padStart(2, '0')}` : `${x.depuis_s} s`;
  }
  function rendreReperes() {
    const m = S.analyse?.mesures;
    const zone = $('#pa-reperes', el);
    const cle = JSON.stringify(m?.reperes ?? null);
    if (zone.dataset.cle === cle) return;
    zone.dataset.cle = cle;
    zone.innerHTML = m ? `<h4>Mesuré sur ta vidéo</h4><ul class="pa-liste-reperes">${m.reperes.map((r) => `<li class="${r.etat}" title="${esc(r.detail)}"><i></i><span>${esc(r.nom)}</span><b>${esc(r.valeur)}</b></li>`).join('')}</ul>
      ${m.premiere_phrase ? `<p class="pa-phrase"><small>Ta première phrase</small>« ${esc(m.premiere_phrase)} »</p>` : ''}` : '';
  }
  const etapesHtml = (x) => `<ul class="pa-etapes">${(x.etapes ?? []).slice(-7).map((e, i, l) => `<li class="${i === l.length - 1 ? 'en-cours' : 'fait'}">${ic(i === l.length - 1 ? (e.icone ?? 'etincelle') : 'coche')}<span>${esc(e.texte)}</span></li>`).join('')}</ul>`;
  const boutonIA = (libelle, action) => (o.iaPrete?.()
    ? `<button class="btn claude grand" data-pa="${action}">${ic('etincelle', 'plein')}<span>${libelle}</span></button><small class="pa-avec">Avec ${esc(o.nomIA())} · qualité ${esc(o.nomQualite?.() ?? 'Soigné')} · une à trois minutes</small>`
    : `<button class="btn claude grand" data-pa="connexions">${ic('prise')}<span>Brancher mon IA</span></button><small class="pa-avec">L’analyse et le plan sont faits par Claude ou Codex : branche l’un des deux, en un clic.</small>`);

  function htmlAnalyse() {
    const a = S.analyse;
    if (!a) return '';
    if (a.etat === 'erreur') return `<div class="pa-vide">${ic('attention')}<h2>L’analyse n’a pas abouti</h2><p>${esc(a.erreur ?? '')}</p>${boutonIA('Réessayer', 'analyser')}</div>`;
    if (a.etat === 'mesures' || a.etat === 'ia') {
      return `<div class="pa-travail"><div class="pa-bobine">${ill('bobine')}</div>
        <h2>${a.etat === 'mesures' ? 'Dérush mesure ta vidéo' : `${esc(a.nom_ia ?? o.nomIA())} regarde ta vidéo`}</h2>
        <p>Les mesures d’abord (elles s’affichent à gauche), puis ton IA lit ce qui est dit, regarde les images, relit ses repères sur les réseaux et cherche ce qui marche en ce moment.</p>
        ${a.mesures ? `<figure class="pa-planche"><img src="/planche?video=${encodeURIComponent(S.video)}&nom=accroche&j=${JETON}&t=${Date.now() >> 14}" alt=""><figcaption>Tes trois premières secondes, telles que l’IA les voit</figcaption></figure>` : ''}
        ${etapesHtml(a)}
        <div class="pa-pied-travail"><span id="pa-temps"></span><button class="btn petit" data-pa="arreter-analyse">Arrêter</button></div></div>`;
    }
    const r = a.resultat;
    if (!r) {
      return `<div class="pa-vide"><div class="pa-jauge demo" style="--p:72"><svg viewBox="0 0 120 120"><circle class="fond" cx="60" cy="60" r="52"/><circle class="arc" cx="60" cy="60" r="52"/></svg><div><b>?</b></div></div>
        <h2>Fais-la analyser avant de la publier</h2>
        <p>Ton IA regarde ta vidéo comme le ferait un monteur qui connaît les réseaux : l’accroche, le rythme, le son, les textes, la fin. Elle te dit quoi changer, dans l’ordre, et tu peux lui demander de le faire d’un clic.</p>
        <ul class="pa-promesses"><li>${ic('coche')}Des constats appuyés sur ta vidéo : des mesures, tes phrases, tes images</li><li>${ic('coche')}Des repères datés sur TikTok, Instagram et YouTube, et les tendances du moment</li><li>${ic('coche')}Une estimation honnête : personne ne peut promettre des vues</li></ul>
        ${boutonIA('Analyser ma vidéo', 'analyser')}</div>`;
    }
    const axes = a.axes.map((d) => ({...d, ...(r.axes.find((x) => x.id === d.id) ?? {})}));
    const demandes = r.priorites.filter((p) => p.demande);
    return `<section class="pa-resume">
        <div class="pa-jauge ${couleurNote(r.score / 10)}" style="--p:${r.score ?? 0}"><svg viewBox="0 0 120 120"><circle class="fond" cx="60" cy="60" r="52"/><circle class="arc" cx="60" cy="60" r="52"/></svg><div><b>${r.score ?? '–'}</b><small>sur 100</small></div></div>
        <div class="pa-verdict"><h2>${esc(motScore(r.score ?? 0))}</h2><p>${esc(r.verdict)}</p>
          <div class="pa-reseaux">${['tiktok', 'instagram', 'youtube'].map((k) => `<span class="pa-reseau" title="${esc(r.reseaux[k]?.pourquoi ?? '')}">${logo(k, 22)}<b class="${couleurNote(r.reseaux[k]?.note)}">${r.reseaux[k]?.note != null ? virgule(r.reseaux[k].note) : '–'}</b><small>${NOMS_COURTS[k]}</small></span>`).join('')}</div></div>
      </section>
      ${r.priorites.length ? `<section class="pa-bloc"><div class="pa-bloc-tete"><h3>À faire en premier</h3>${demandes.length > 1 ? `<button class="btn petit" data-pa="tout-demander" title="Met les ${demandes.length} demandes dans le message à ton IA">${ic('etincelle', 'plein')}Tout demander à ${esc(o.nomIA())}</button>` : ''}</div>
        <ol class="pa-priorites">${r.priorites.map((p, i) => `<li><span class="num">${i + 1}</span><div><b>${esc(p.titre)}</b><small class="gain ${p.gain === 'fort' ? 'fort' : ''}">${GAINS[p.gain] ?? ''}</small></div>${p.demande ? `<button class="btn petit claude-doux" data-pa="demander" data-priorite="${i}">${ic('etincelle', 'plein')}Demander</button>` : ''}</li>`).join('')}</ol></section>` : ''}
      <section class="pa-bloc"><div class="pa-bloc-tete"><h3>Les huit points regardés</h3></div>
        <div class="pa-axes">${axes.map((x) => `<article class="pa-axe ${couleurNote(x.note)}">
          <header><div><b>${esc(x.nom)}</b><small>${esc(x.sous)}</small></div><span class="pa-note">${x.note != null ? virgule(x.note) : '–'}<small>/10</small></span></header>
          <div class="pa-regle"><i style="width:${(x.note ?? 0) * 10}%"></i></div>
          ${x.constat ? `<p class="constat">${esc(x.constat)}</p>` : ''}
          ${x.conseil ? `<p class="conseil">${ic('baguette')}<span>${esc(x.conseil)}</span></p>` : x.note != null && x.note >= 7.5 ? `<p class="conseil bon">${ic('coche')}<span>Rien à changer ici.</span></p>` : ''}
          ${x.demande ? `<button class="btn petit claude-doux" data-pa="demander" data-axe="${x.id}">${ic('etincelle', 'plein')}Demander à ${esc(o.nomIA())}</button>` : ''}
        </article>`).join('')}</div></section>
      ${r.tendances.length ? `<section class="pa-bloc"><div class="pa-bloc-tete"><h3>Ce qui marche en ce moment</h3></div><ul class="pa-tendances">${r.tendances.map((t) => `<li><b>${esc(t.titre)}</b>${t.detail ? `<p>${esc(t.detail)}</p>` : ''}<button class="pa-source" data-lien="${esc(t.source)}">${ic('lien')}${esc(hote(t.source))}${t.date ? ` · ${esc(t.date)}` : ''}</button></li>`).join('')}</ul></section>` : ''}
      ${r.limites ? `<p class="pa-limites">${ic('aide')}<span><b>Ce que cette analyse ne sait pas.</b> ${esc(r.limites)}</span></p>` : ''}
      <footer class="pa-pied"><small>Analyse de ${esc(r.moteur === 'codex' ? 'Codex' : 'Claude')}, ${new Date(r.cree_le).toLocaleString('fr-FR', {day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'})}. Une estimation pour améliorer ta vidéo, pas une promesse de vues.</small><span class="espace"></span>
        <button class="btn" data-pa="analyser" title="Après une retouche, ou pour un autre avis">Refaire l’analyse</button><button class="btn principal" data-onglet="partage">Passer au partage${ic('img-plus')}</button></footer>`;
  }

  function htmlPartage() {
    const p = S.plan;
    if (!p) return '';
    const choixReseaux = `<div class="pp-choix">${Object.entries(RESEAUX).map(([k, n]) => `<button class="pp-reseau${S.choix.has(k) ? ' actif' : ''}" data-choix="${k}">${logo(k, 30)}<b>${n}</b><i class="coche">${ic('coche')}</i></button>`).join('')}</div>`;
    if (p.etat === 'erreur') return `<div class="pa-vide">${ic('attention')}<h2>Le plan n’a pas abouti</h2><p>${esc(p.erreur ?? '')}</p>${choixReseaux}${boutonIA('Réessayer', 'planifier')}</div>`;
    if (p.etat === 'mesures' || p.etat === 'ia') {
      return `<div class="pa-travail"><div class="pa-bobine">${ill('bobine')}</div><h2>${esc(p.nom_ia ?? o.nomIA())} prépare ta publication</h2>
        <p>Une légende qui parle comme toi, les bons hashtags, le bon moment et l’image de couverture, réseau par réseau. Tu relis tout avant que quoi que ce soit parte.</p>
        ${etapesHtml(p)}<div class="pa-pied-travail"><span id="pa-temps"></span><button class="btn petit" data-pa="arreter-plan">Arrêter</button></div></div>`;
    }
    const plan = p.plan;
    if (!plan) {
      return `<div class="pa-vide"><div class="pp-eventail">${['tiktok', 'instagram', 'youtube', 'linkedin'].map((k, i) => `<span style="--i:${i}">${logo(k, 46)}</span>`).join('')}</div>
        <h2>Prépare ta publication</h2>
        <p>Choisis tes réseaux. Ton IA écrit pour chacun la légende, les hashtags, le bon moment et l’image de couverture, avec une stratégie pour faire circuler la vidéo. Tu relis, tu corriges, puis tu publies d’un clic.</p>
        ${choixReseaux}
        <label class="champ pp-consigne"><span>Un mot pour ${esc(o.nomIA())} (facultatif)</span><textarea data-pa-consigne rows="2" placeholder="Le ton, un appel à l’action, une mention, des mots à mettre…">${esc(S.consigne)}</textarea></label>
        ${boutonIA('Préparer ma publication', 'planifier')}</div>`;
    }
    const cles = Object.keys(plan.reseaux);
    if (!cles.includes(S.reseau)) S.reseau = plan.strategie.premier_reseau && cles.includes(plan.strategie.premier_reseau) ? plan.strategie.premier_reseau : cles[0];
    const x = plan.reseaux[S.reseau];
    const R = p.reseaux_possibles[S.reseau];
    const s = plan.strategie;
    const v = S.treg?.verification;
    const pretTreg = !!S.treg?.pret;
    // YouTube a besoin de la clé Treg (le connecteur du compte Claude ne lui suffit pas : voir lib/youtube.mjs)
    const cleTreg = !!S.treg?.jeton;
    const relie = (k) => (k === 'youtube' && !cleTreg ? false : v?.ok ? !!v.reseaux?.[k] : pretTreg);
    const aPublier = cles.filter((k) => S.choix.has(k));
    const youtubeSansCle = aPublier.includes('youtube') && !cleTreg && !!S.treg;
    const rienAPublier = youtubeSansCle && aPublier.length === 1; // YouTube seul, sans la clé : inutile de déranger l'IA
    const occupe = !!o.claude?.()?.en_cours;
    return `<section class="pp-strategie"><h3>${ic('eclair')}La stratégie</h3><p>${esc(s.resume)}</p>
        ${s.ordre.length > 1 ? `<div class="pp-ordre"><small>Dans cet ordre</small>${s.ordre.map((k, i) => `<span>${i ? ic('img-plus') : ''}${logo(k, 20)}${NOMS_COURTS[k]}</span>`).join('')}</div>` : ''}
        ${s.rythme ? `<p class="pp-rythme">${esc(s.rythme)}</p>` : ''}
        ${s.apres.length ? `<details class="pp-apres"><summary>Dans l’heure qui suit la publication</summary><ul>${s.apres.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></details>` : ''}
        ${plan.a_eviter.length ? `<details class="pp-apres"><summary>À éviter avec cette vidéo</summary><ul>${plan.a_eviter.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></details>` : ''}</section>
      <nav class="pp-onglets">${cles.map((k) => `<button data-reseau="${k}"${k === S.reseau ? ' class="actif"' : ''}>${logo(k, 22)}<span>${NOMS_COURTS[k]}</span>${k === s.premier_reseau ? '<i title="À publier en premier">1er</i>' : ''}</button>`).join('')}</nav>
      <section class="pp-fiche" data-fiche="${S.reseau}">
        ${R.titre ? `<label class="champ"><span>Titre <em data-compte="titre">${x.titre.length}/${R.titre}</em></span><input data-champ="titre" maxlength="${R.titre}" value="${esc(x.titre)}"></label>` : ''}
        <label class="champ"><span>Légende <em data-compte="legende">${x.legende.length}/${R.legende_max}</em><button class="pp-copier" data-pa="copier-legende" title="Copier la légende et les hashtags">${ic('copier')}Copier</button></span><textarea data-champ="legende" rows="6" maxlength="${R.legende_max}">${esc(x.legende)}</textarea></label>
        <div class="champ"><span>Hashtags <em>${x.hashtags.length} · ils disent le sujet, ils ne font pas gagner de vues</em></span>
          <div class="pp-hashtags">${x.hashtags.map((h, i) => `<span class="pp-tag">${esc(h)}<button data-pa="retirer-tag" data-i="${i}" title="Retirer">${ic('fermer')}</button></span>`).join('')}<input class="pp-ajout" placeholder="+ ajouter" spellcheck="false" maxlength="40"></div></div>
        <div class="pp-deux">
          <div class="pp-carte">${ic('drapeau')}<div><small>Le bon moment</small><b>${esc([x.moment.jour, x.moment.heure].filter(Boolean).join(' · ') || 'À ton rythme')}</b>${x.moment.pourquoi ? `<p>${esc(x.moment.pourquoi)}</p>` : ''}<p class="dim">Un point de départ : vérifie dans les statistiques de ton compte.</p></div></div>
          <div class="pp-carte">${ic('image')}<div><small>L’image de couverture</small><b>${x.couverture.instant_s != null ? `À ${temps(x.couverture.instant_s)}` : 'Au choix'}${x.couverture.texte ? ` · « ${esc(x.couverture.texte)} »` : ''}</b>${x.couverture.instant_s != null ? `<p><button class="btn petit" data-pa="voir-couverture" data-t="${x.couverture.instant_s}">${ic('oeil')}Voir cette image</button></p>` : ''}</div></div>
        </div>
        ${x.premier_commentaire ? `<div class="champ"><span>Premier commentaire, à épingler toi-même <button class="pp-copier" data-pa="copier-commentaire">${ic('copier')}Copier</button></span><p class="pp-commentaire selectionnable">${esc(x.premier_commentaire)}</p></div>` : ''}
        ${x.conseils.length ? `<ul class="pp-conseils">${x.conseils.map((t) => `<li>${ic('baguette')}<span>${esc(t)}</span></li>`).join('')}</ul>` : ''}
      </section>
      <footer class="pp-publier">
        ${youtubeSansCle ? `<p class="pp-note alerte">${ic('attention')}<span><b>YouTube a besoin de ta clé Treg.</b> Le connecteur Treg de ton compte Claude suffit pour TikTok, Instagram et LinkedIn, pas pour YouTube.${rienAPublier ? ' Ajoute ta clé, ou copie le titre et la description et publie toi-même.' : ` Sans la clé, ${esc(o.nomIA())} publiera sur les autres réseaux et te dira que YouTube attend.`}</span></p>` : ''}
        <div class="pp-a-publier"><small>Publier sur</small>${cles.map((k) => `<button class="pp-puce${S.choix.has(k) ? ' actif' : ''}${relie(k) ? '' : ' a-relier'}" data-choix="${k}" title="${relie(k) ? 'Relié à Treg' : k === 'youtube' && !cleTreg ? 'YouTube a besoin de ta clé Treg' : 'Pas encore relié dans Treg'}">${logo(k, 18)}${NOMS_COURTS[k]}${relie(k) ? '' : ic('attention')}</button>`).join('')}</div>
        ${aPublier.includes('youtube') ? `<div class="segmente pp-visi">${[['unlisted', 'Non répertoriée'], ['public', 'Publique'], ['private', 'Privée']].map(([k, n]) => `<button data-visi="${k}"${k === S.visibilite ? ' class="actif"' : ''}>${n}</button>`).join('')}</div>` : ''}
        <div class="pp-actions">
          <button class="btn" data-pa="planifier" title="Refaire tous les textes">Refaire</button>
          ${pretTreg && !youtubeSansCle ? '' : `<button class="btn${youtubeSansCle ? ' bleu' : ''}" data-pa="relier">${ic('relais')}${pretTreg ? 'Ajouter ma clé Treg' : 'Relier mes réseaux'}</button>`}
          ${rienAPublier ? '' : `<button class="btn claude" data-pa="publier"${!aPublier.length || !o.iaPrete?.() || occupe ? ' disabled' : ''} title="${pretTreg ? 'Rien ne part sans ce clic' : 'Treg n’est pas relié : ton IA te redonnera les textes prêts à coller'}">${ic('publier')}<span>${occupe ? `${esc(o.nomIA())} travaille…` : `Publier avec ${esc(o.nomIA())}`}</span></button>`}
        </div>
      </footer>
      <p class="pp-note">${pretTreg ? `${ic('coche')}Treg est relié${v?.ok && v.compte ? ` (compte ${esc(v.compte)})` : ''}. TikTok part en brouillon dans ta boîte TikTok ; YouTube, Instagram et LinkedIn publient pour de vrai.` : `${ic('attention')}Tes réseaux ne sont pas encore reliés : tu peux copier chaque texte et publier toi-même, ou relier Treg en trois gestes.`}</p>`;
  }

  // ——— gestes ———
  const ficheActive = () => S.plan?.plan?.reseaux?.[S.reseau];
  function enregistrer() {
    clearTimeout(S.enregistrement);
    S.enregistrement = setTimeout(() => {
      const x = ficheActive();
      if (!x || !el) return;
      api('PUT', '/api/publication/plan', {video: S.video, reseaux: {[S.reseau]: {titre: x.titre, legende: x.legende, hashtags: x.hashtags}}}).catch((e) => note(e.message, true));
    }, 500);
  }
  function saisie(e) {
    const t = e.target;
    if (t.dataset.pa === 'video') return changerVideo(t.value);
    if (t.dataset.paConsigne !== undefined) { S.consigne = t.value; return; }
    const champ = t.dataset.champ;
    const x = ficheActive();
    if (!champ || !x) return;
    x[champ] = t.value;
    const c = $(`[data-compte="${champ}"]`, el);
    if (c) c.textContent = `${t.value.length}/${t.maxLength}`;
    enregistrer();
  }
  function ajouterHashtag(champ) {
    const x = ficheActive();
    const mots = champ.value.split(/[\s,]+/).map((h) => h.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean).map((h) => `#${h}`);
    if (!x || !mots.length) return;
    x.hashtags = [...new Set([...x.hashtags, ...mots])].slice(0, 30);
    enregistrer();
    rendre(true);
    $('.pp-ajout', el)?.focus();
  }
  async function lancer(quoi) {
    if (!o.iaPrete?.()) return o.connexions?.();
    try {
      if (quoi === 'analyse') S.analyse = await api('POST', '/api/publication/analyse', {video: S.video, qualite: o.qualiteIA?.()});
      else {
        if (!S.choix.size) return note('Choisis au moins un réseau.', true);
        S.plan = await api('POST', '/api/publication/plan', {video: S.video, reseaux: [...S.choix], consigne: S.consigne, qualite: o.qualiteIA?.()});
      }
    } catch (e) { note(e.message, true); }
    S.cle = '';
    relire();
  }
  async function clic(e) {
    const lien = e.target.closest('[data-lien]')?.dataset.lien;
    if (lien) return ouvrirLien(lien);
    const onglet = e.target.closest('[data-onglet]')?.dataset.onglet;
    if (onglet) { S.onglet = onglet; S.cle = ''; rendre(true); $('#pa-contenu', el).scrollTop = 0; return; }
    const reseau = e.target.closest('[data-reseau]')?.dataset.reseau;
    if (reseau) { S.reseau = reseau; return rendre(true); }
    const choix = e.target.closest('[data-choix]')?.dataset.choix;
    if (choix) { if (S.choix.has(choix)) S.choix.delete(choix); else S.choix.add(choix); ecrire('partage.reseaux', [...S.choix]); return rendre(true); }
    const visi = e.target.closest('[data-visi]')?.dataset.visi;
    if (visi) { S.visibilite = visi; ecrire('publier.visibilite', visi); return rendre(true); }
    const b = e.target.closest('[data-pa]');
    if (!b) return;
    const a = b.dataset.pa;
    const r = S.analyse?.resultat;
    const x = ficheActive();
    if (a === 'fermer') return fermer();
    if (a === 'connexions') return o.connexions?.();
    if (a === 'relier') return guideTreg(() => { S.treg = null; relire(); });
    if (a === 'analyser') return lancer('analyse');
    if (a === 'planifier') return lancer('plan');
    if (a === 'arreter-analyse') { await api('POST', '/api/publication/analyse', {video: S.video, arreter: true}).catch(() => {}); S.cle = ''; return relire(); }
    if (a === 'arreter-plan') { await api('POST', '/api/publication/plan', {video: S.video, arreter: true}).catch(() => {}); S.cle = ''; return relire(); }
    if (a === 'demander' && r) {
      const texte = b.dataset.axe ? r.axes.find((y) => y.id === b.dataset.axe)?.demande : r.priorites[Number(b.dataset.priorite)]?.demande;
      if (texte) { fermer(true); o.demanderIA(texte); }
      return;
    }
    if (a === 'tout-demander' && r) {
      const demandes = r.priorites.map((p) => p.demande).filter(Boolean);
      fermer(true);
      return o.demanderIA(demandes.length > 1 ? `Améliore la vidéo sur ces ${demandes.length} points, dans cet ordre :\n${demandes.map((d, i) => `${i + 1}. ${d}`).join('\n')}` : demandes[0]);
    }
    if (a === 'retirer-tag' && x) { x.hashtags.splice(Number(b.dataset.i), 1); enregistrer(); return rendre(true); }
    if (a === 'copier-legende' && x) { await o.copierTexte(`${x.titre ? `${x.titre}\n\n` : ''}${x.legende}${x.hashtags.length ? `\n\n${x.hashtags.join(' ')}` : ''}`); return note('Copié : colle-le dans l’app du réseau.'); }
    if (a === 'copier-commentaire' && x) { await o.copierTexte(x.premier_commentaire); return note('Commentaire copié.'); }
    if (a === 'voir-couverture') { const l = $('#pa-lecteur', el); l.pause(); l.currentTime = Number(b.dataset.t) || 0; return; }
    if (a === 'publier') {
      const reseaux = Object.keys(S.plan?.plan?.reseaux ?? {}).filter((k) => S.choix.has(k));
      if (!reseaux.length) return;
      // les dernières retouches partent d'abord
      clearTimeout(S.enregistrement);
      try {
        if (x) await api('PUT', '/api/publication/plan', {video: S.video, reseaux: {[S.reseau]: {titre: x.titre, legende: x.legende, hashtags: x.hashtags}}});
        const video = S.video;
        const visibilite = S.visibilite;
        fermer(true);
        await o.publier({video, reseaux, visibilite});
      } catch (err) { note(err.message, true); }
    }
  }

  // ——— Relier ses réseaux (Treg), en trois gestes ———
  async function guideTreg(apres = null) {
    let t;
    try { t = await api('GET', '/api/treg?force=1'); } catch (e) { return note(e.message, true); }
    const f = o.feuille('', true);
    f.classList.add('tg');
    let cle = '';
    let message = null;
    const rendreGuide = () => {
      const v = t.verification ?? {};
      const fait = !!t.jeton && v.ok;
      const pastilles = `<div class="tg-reseaux">${Object.entries(RESEAUX).map(([k, n]) => `<span class="${v.ok ? (v.reseaux?.[k] ? 'ok' : 'non') : ''}">${logo(k, 30)}<b>${n}</b>${v.ok ? `<i>${ic(v.reseaux?.[k] ? 'coche' : 'fermer')}</i>` : ''}</span>`).join('')}</div>`;
      f.innerHTML = `<div class="tg-tete"><div class="tg-dessin"><span class="tg-film">${ic('film')}</span><i></i>${['tiktok', 'instagram', 'youtube', 'linkedin'].map((k, i) => `<span class="tg-logo" style="--i:${i}">${logo(k, 30)}</span>`).join('')}</div>
          <div><h3>Relier tes réseaux</h3><p class="sous-titre">Une seule fois, en trois gestes. Ensuite, ta vidéo part sur TikTok, Instagram, YouTube et LinkedIn depuis Dérush.</p></div></div>
        <p class="tg-quoi">${ic('aide')}<span><b>Treg</b> est le service qui publie à ta place. C’est lui qui garde le lien avec tes comptes : Dérush ne voit jamais tes mots de passe, et rien ne part sans ton clic.</span></p>
        <ol class="tg-etapes">
          <li class="${t.jeton ? 'fait' : ''}"><span class="num">${t.jeton ? ic('coche') : '1'}</span><div><b>Crée ton compte Treg</b><small>Sur treg.to, avec ton adresse e-mail. La page s’ouvre dans ton navigateur.</small></div><button class="btn ${t.jeton ? '' : 'bleu'}" data-tg="ouvrir">Ouvrir Treg</button></li>
          <li class="${fait && Object.values(v.reseaux ?? {}).some(Boolean) ? 'fait' : ''}"><span class="num">${fait && Object.values(v.reseaux ?? {}).some(Boolean) ? ic('coche') : '2'}</span><div><b>Dans Treg, relie tes réseaux</b><small>Un clic par réseau : tu te connectes à ton compte TikTok, Instagram, YouTube ou LinkedIn, comme d’habitude.</small></div></li>
          <li class="${t.jeton ? 'fait' : ''}"><span class="num">${t.jeton ? ic('coche') : '3'}</span><div><b>Copie ta clé dans Treg, puis reviens ici</b><small>${t.jeton ? 'Ta clé est rangée sur cet ordinateur. Elle n’est jamais affichée ni envoyée ailleurs que chez Treg.' : 'Dans ton compte Treg, copie la clé (elle commence par « trg_ »). Un clic ici, et c’est fini.'}</small>
            ${t.jeton ? '' : `<div class="tg-cle"><input type="password" id="tg-cle" placeholder="ou colle ta clé ici (trg_…)" autocomplete="off" spellcheck="false" value="${esc(cle)}"><button class="btn petit" data-tg="enregistrer">Enregistrer</button></div>`}</div>
            ${t.jeton ? '<button class="btn petit" data-tg="retirer" title="Retirer la clé de cet ordinateur">Retirer</button>' : `<button class="btn claude" data-tg="coller">${ic('copier')}<span>Coller ma clé</span></button>`}</li>
        </ol>
        ${t.jeton ? `<div class="tg-bilan ${v.ok ? 'ok' : 'attention'}"><div class="tg-bilan-tete">${ic(v.ok ? 'coche' : 'attention')}<b>${v.ok ? (Object.values(v.reseaux ?? {}).some(Boolean) ? `C’est relié${v.compte ? ` (compte ${esc(v.compte)})` : ''}` : 'Ta clé marche') : 'Treg ne répond pas comme prévu'}</b><button class="btn petit" data-tg="verifier">Vérifier</button></div>${v.pourquoi ? `<p>${esc(v.pourquoi)}</p>` : ''}${v.ok ? pastilles : ''}${v.ok && Object.values(v.reseaux ?? {}).some((x) => !x) ? '<p class="dim">Un réseau manque ? Relie-le dans Treg, puis clique sur « Vérifier ».</p>' : ''}</div>` : pastilles}
        ${message ? `<p class="tg-message">${ic('attention')}${esc(message)}</p>` : ''}
        ${t.connecteur?.etat === 'connecte' && !t.jeton ? `<p class="tg-claude">${logo('claude', 18)}<span>Avec Claude, le connecteur Treg de ton compte Claude répond déjà : tu peux publier sur TikTok, Instagram et LinkedIn sans clé. <b>YouTube, lui, a besoin de la clé.</b> Elle sert aussi à Codex, et à voir ici quels réseaux sont reliés.</span></p>` : ''}
        <div class="pied"><span class="tg-donner" title="Tu peux le couper à tout moment"><label class="interrupteur"><input type="checkbox" data-tg-actif${t.actif ? ' checked' : ''}><i></i></label><span>Donner Treg à mon IA</span></span><span class="espace"></span><button class="btn principal" data-tg="fermer">${fait ? 'C’est bon' : 'Fermer'}</button></div>`;
    };
    const recharger = async (force = true) => { try { t = await api('GET', `/api/treg${force ? '?force=1' : ''}`); } catch (e) { message = e.message; } if (f.isConnected) rendreGuide(); };
    const enregistrerCle = async (valeur) => {
      const v = String(valeur ?? '').trim();
      if (!v) { message = 'Le presse-papiers est vide : copie d’abord ta clé dans Treg.'; return rendreGuide(); }
      if (!/^trg_/.test(v)) { message = 'Ce qui est copié n’est pas une clé Treg (elle commence par « trg_ »). Copie-la depuis ton compte Treg, puis réessaie.'; return rendreGuide(); }
      try {
        await api('POST', '/api/connexions/treg/jeton', {cle: v});
        cle = '';
        message = null;
        note('Clé Treg rangée sur cet ordinateur.', false, true);
        await recharger();
      } catch (e) { message = e.message; rendreGuide(); }
    };
    rendreGuide();
    f.addEventListener('input', (e) => { if (e.target.id === 'tg-cle') cle = e.target.value; });
    f.addEventListener('change', async (e) => {
      if (e.target.dataset.tgActif === undefined) return;
      try { await api('POST', '/api/connexions/treg/activer', {actif: e.target.checked}); } catch (err) { note(err.message, true); }
      recharger(false);
    });
    f.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-tg]')?.dataset.tg;
      if (!a) return;
      if (a === 'fermer') { o.fermerFeuille(); return apres?.(t); }
      if (a === 'ouvrir') return api('POST', '/api/lien', {url: 'https://treg.to'}).catch((err) => note(err.message, true));
      if (a === 'coller') return enregistrerCle(await o.lirePressePapiers().catch(() => ''));
      if (a === 'enregistrer') return enregistrerCle(cle);
      if (a === 'verifier') { message = null; return recharger(); }
      if (a === 'retirer') { await api('POST', '/api/connexions/treg/retirer', {}).catch((err) => note(err.message, true)); return recharger(); }
    });
  }

  return {ouvrir, fermer, guideTreg, ouvert: () => !!el, rafraichir: () => { if (el) { S.cle = ''; rendre(true); } }};
}
