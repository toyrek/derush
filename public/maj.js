// Dérush — la petite fenêtre des mises à jour. Elle se pose dans un coin, sans rien bloquer :
//  - « Dérush 10.5 est disponible » : ce qui change, « Mettre à jour » (un clic), « Plus tard » (on en reparle demain) ;
//  - à la première ouverture après une mise à jour : « Dérush 10.5 est installé », et ce qui vient d'arriver.
// Le serveur décide de ce qu'il y a à dire (lib/maj.mjs) ; ici, on le montre au bon moment.

const FLECHE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6"/><path d="M6 11.5 12 5.5l6 6"/></svg>';

export function creerMaj(o) {
  const {api, note, esc, ic} = o;
  let carte = null; // la fenêtre affichée
  let genre = null; // 'disponible' | 'arrivee'
  let etat = null; // la dernière réponse du serveur
  let passee = false; // « Plus tard » : plus rien dans cette fenêtre jusqu'à la prochaine ouverture
  let attente = null;
  let vu = 0;
  let depliee = false; // dans l'éditeur, la pastille a été ouverte d'un clic

  const points = (liste) => (liste ?? []).slice(0, 3).map((n) => `<li><b>${esc(n.titre ?? `Version ${n.version}`)}.</b> ${esc(n.resume ?? '')}</li>`).join('');

  function fermer() {
    if (!carte) return;
    const c = carte;
    carte = null;
    genre = null;
    c.classList.remove('compacte');
    c.classList.add('part');
    setTimeout(() => c.remove(), 240);
  }
  function poser(html, quoi) {
    fermer();
    carte = document.createElement('aside');
    carte.className = `maj ${quoi}`;
    carte.setAttribute('role', 'status');
    carte.innerHTML = html;
    carte.addEventListener('click', clic);
    document.body.append(carte);
    genre = quoi;
    depliee = false;
    ajuster();
  }
  /** Pendant qu'on monte, l'annonce se replie en une pastille en haut de la fenêtre : elle ne cache rien. */
  function ajuster() {
    if (!carte) return;
    const petit = genre === 'disponible' && o.discrete();
    carte.classList.toggle('haut', petit);
    carte.classList.toggle('compacte', petit && !depliee && !carte.querySelector('button:disabled'));
  }

  function montrer() {
    clearTimeout(attente);
    if (!etat) return;
    const quoi = etat.arrivee ? 'arrivee' : etat.a_montrer && !passee ? 'disponible' : null;
    if (!quoi) {
      if (genre === 'disponible' && !carte?.querySelector('button:disabled')) fermer();
      return;
    }
    if (genre === quoi) return; // déjà là
    // un tutoriel, une feuille ouverte, une prise en cours : on attend que la place soit libre
    if (!o.peutMontrer()) { attente = setTimeout(montrer, 4000); return; }
    if (quoi === 'arrivee') {
      const a = etat.arrivee;
      const liste = points(a.nouveautes);
      return poser(`<div class="maj-tete"><span class="maj-rond ok">${ic('coche')}</span><div><small>À jour</small><b>Dérush ${esc(a.version)} est installé</b></div></div>
        ${liste ? `<ul class="maj-liste">${liste}</ul>` : '<p class="maj-dit">Tes projets et tes réglages sont là, comme avant.</p>'}
        <div class="maj-actions"><button class="btn principal petit" data-maj="vu">OK</button><button class="btn petit" data-maj="tout">Tout ce qui change</button></div>`, 'arrivee');
    }
    const liste = points(etat.nouveautes);
    poser(`<button class="maj-x" data-maj="plus-tard" aria-label="Plus tard" title="Plus tard">${ic('fermer')}</button>
      <div class="maj-tete" data-maj="deplier"><span class="maj-rond">${FLECHE}</span><div><small>Mise à jour</small><b>Dérush ${esc(etat.version_distante)} est disponible</b></div></div>
      <div class="maj-corps">${liste ? `<ul class="maj-liste">${liste}</ul>` : ''}
      <p class="maj-dit">${etat.peut_installer ? 'Tes projets, tes réglages et tes clés ne bougent pas.' : 'Cette copie de Dérush ne se met pas à jour toute seule : recolle le message d’installation à ton IA.'}</p></div>
      <div class="maj-actions">${etat.peut_installer ? '<button class="btn principal petit" data-maj="installer">Mettre à jour</button>' : '<button class="btn principal petit" data-maj="comment">Voir comment faire</button>'}<button class="btn petit" data-maj="plus-tard">Plus tard</button></div>
      <p class="maj-erreur" hidden></p>`, 'disponible');
  }

  async function installer(b) {
    if (o.occupe()) return note('Un travail est en cours : mets à jour quand il sera fini.');
    const erreur = carte.querySelector('.maj-erreur');
    erreur.hidden = true;
    for (const x of carte.querySelectorAll('button')) x.disabled = true;
    b.innerHTML = '<i class="maj-tourne"></i>Mise à jour…';
    ajuster();
    try {
      const r = await api('POST', '/api/connexions/maj/installer');
      if (!r.change) { fermer(); return note('Dérush est déjà à jour.'); }
      b.innerHTML = `${ic('coche')}Installée`;
      carte.querySelector('.maj-dit').textContent = 'Dérush redémarre…';
      o.surRedemarrage();
    } catch (x) {
      if (!carte) return;
      for (const y of carte.querySelectorAll('button')) y.disabled = false;
      b.textContent = 'Réessayer';
      erreur.textContent = x.message;
      erreur.hidden = false;
    }
  }

  function clic(e) {
    const b = e.target.closest('[data-maj]');
    if (!b || b.disabled) return;
    const quoi = b.dataset.maj;
    if (quoi === 'deplier') { depliee = !depliee; ajuster(); }
    else if (quoi === 'plus-tard') { passee = true; fermer(); api('POST', '/api/maj/plus-tard').catch(() => {}); }
    else if (quoi === 'vu') { etat = {...etat, arrivee: null}; fermer(); api('POST', '/api/maj/vu').then((r) => { etat = r; montrer(); }).catch(() => {}); }
    else if (quoi === 'tout') o.lien(`${etat.depot}/blob/main/docs/NOUVEAUTES.md`);
    else if (quoi === 'comment') o.lien(`${etat.depot}#mettre-à-jour`);
    else if (quoi === 'installer') installer(b);
  }

  /** Demande au serveur s'il y a du nouveau, et le montre s'il y a lieu. */
  async function regarder() {
    vu = Date.now();
    try { etat = await api('GET', '/api/maj'); } catch { return null; }
    montrer();
    return etat;
  }

  function demarrer(premier) {
    etat = premier ?? null;
    setTimeout(montrer, 1800); // ce qui vient d'arriver se dit tout de suite
    setTimeout(regarder, 12000); // la première vérification du serveur est faite
    setInterval(regarder, 10 * 60000);
    setInterval(ajuster, 500);
    window.addEventListener('focus', () => { if (Date.now() - vu > 120000) regarder(); });
  }

  return {demarrer, regarder, etat: () => etat, visible: () => genre};
}
