// Dérush — « Suivre sur mon téléphone » : la fenêtre de l'ordinateur. Elle allume ou coupe la porte du réseau local
// (lib/telephone.mjs), montre le code à scanner, demande le clic « Relier ce téléphone » et liste les téléphones reliés.
// Rien ne s'ouvre sur le réseau sans le clic « Allumer » ; le code ne vaut que tant que cette fenêtre est ouverte.

const COCHE = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg>';
const WIFI = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.500 9.500a12.500 12.500 0 0 1 17 0M6.500 13a8 8 0 0 1 11 0M9.500 16.300a3.700 3.700 0 0 1 5 0"/><circle cx="12" cy="19.300" r="1" fill="currentColor" stroke="none"/></svg>';
const CODE_QR = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.500v2.500H14zM18 18h2v2h-2zM18 14h2M14 18.500V20"/></svg>';

export function creerTelephone(o) {
  const {api, note, esc, ic, feuille, fermerFeuille, copierTexte, systeme = () => 'mac', bouton = null} = o;
  let E = null; // ce que dit /api/telephone
  let ouverte = false;
  let minuterie = null;
  let occupe = false; // une action est en route (allumer, relier…)
  let relie = null; // le nom du téléphone qu'on vient de relier
  let vu = {}; // ce qui est déjà dessiné

  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  const ilYA = (iso) => {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return 'jamais vu';
    const s = (Date.now() - t) / 1000;
    return s < 90 ? 'vu à l’instant' : s < 3600 ? `vu il y a ${Math.round(s / 60)} min` : s < 86400 ? `vu il y a ${Math.round(s / 3600)} h` : `vu le ${new Date(t).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'})}`;
  };

  /** Le bouton de la barre du haut : allumé quand la porte est ouverte, un point vert quand un téléphone regarde. */
  function majBouton(r) {
    if (!bouton || !r) return;
    bouton.classList.toggle('actif', !!r.actif);
    bouton.classList.toggle('en-ligne', r.en_ligne > 0);
    bouton.title = !r.actif ? 'Suivre ton montage depuis ton téléphone' : r.en_ligne > 0 ? `${pluriel(r.en_ligne, 'téléphone')} ${r.en_ligne > 1 ? 'suivent' : 'suit'} ton montage` : 'Le suivi sur téléphone est allumé';
  }

  // ——— les morceaux de la fenêtre ———
  const maquette = () => `
    <div class="tel-maquette" aria-hidden="true">
      <span class="tel-m-encoche"></span>
      <div class="tel-m-ecran"><i class="tel-m-voyant"><b></b>EN DIRECT</i></div>
      <span class="tel-m-titre"></span><span class="tel-m-titre court"></span>
      <span class="tel-m-barre"><i></i></span>
      <span class="tel-m-pas"><i></i><i></i><i></i><i></i></span>
    </div>`;
  function gauche(e) {
    if (!e.ecoute) return `${maquette()}<p class="tel-legende">Ton montage, en direct dans ta poche.</p>`;
    const d = e.demandes[0];
    if (d) return `
      <div class="tel-demande">
        <span class="tel-ondes"><i></i><i></i>${ic('telephone')}</span>
        <b class="tel-nom">${esc(d.nom)}</b>
        <p>veut suivre tes montages.<br>Ton téléphone affiche bien ce nombre ?</p>
        <b class="tel-nombre">${esc(d.nombre)}</b>
        <button class="btn principal grand" data-tel="relier" data-id="${esc(d.id)}">Relier ce téléphone</button>
        <button class="btn lien" data-tel="refuser" data-id="${esc(d.id)}">Ce n’est pas le mien : refuser</button>
      </div>`;
    if (relie) return `
      <div class="tel-relie">
        <span class="tel-ok">${COCHE}</span>
        <b class="tel-nom">${esc(relie)}</b>
        <p>est relié. Il suit déjà ton montage :<br>tu peux fermer cette fenêtre.</p>
        <button class="btn" data-tel="autre">Relier un autre téléphone</button>
      </div>`;
    if (!e.adresse) return `<div class="tel-relie"><span class="tel-ok sans">${WIFI}</span><b class="tel-nom">Pas de réseau local</b><p>Cet ordinateur n’est sur aucun réseau privé (le Wi-Fi de la maison ou de l’association).<br>Branche le Wi-Fi, puis rouvre cette fenêtre.</p></div>`;
    const j = e.jumelage;
    if (!j) return `<div class="tel-relie"><span class="tel-ok sans">${CODE_QR}</span><p>Un nouveau code arrive…</p></div>`;
    return `
      <div class="tel-qr">${j.qr ? `<svg viewBox="0 0 ${j.qr.taille} ${j.qr.taille}" shape-rendering="crispEdges" role="img" aria-label="Le code à scanner avec ton téléphone"><path d="${j.qr.d}"/></svg>` : ''}</div>
      <p class="tel-ou">ou ouvre <b class="selectionnable">${esc(e.court)}</b><br>sur ton téléphone et tape</p>
      <b class="tel-chiffres selectionnable">${esc(j.chiffres.slice(0, 3))}<i></i>${esc(j.chiffres.slice(3))}</b>
      <button class="btn lien tel-copier" data-tel="copier" title="Pour te l’envoyer toi-même, si ton appareil photo ne lit pas le code. Il vaut dix minutes.">Copier le lien</button>`;
  }
  function droite(e) {
    if (!e.ecoute) return `
      <ul class="tel-atouts">
        <li>${ic('oeil')}<span><b>Tu vois ton IA travailler.</b> Ce qu’elle fait, les images du rendu, le temps passé : comme ici, en direct.</span></li>
        <li>${ic('film')}<span><b>Tu regardes la vidéo finie.</b> Et tu l’enregistres sur ton téléphone. Si tu l’autorises, tu écris aussi à ton IA de là-bas.</span></li>
        <li>${WIFI}<span><b>Par ton Wi-Fi, sans Internet.</b> Ton téléphone et cet ordinateur doivent être sur le même réseau.</span></li>
      </ul>
      ${e.erreur ? `<p class="tel-souci">${ic('attention')}<span>${esc(e.erreur)} Réessaie dans un instant.</span></p>` : ''}
      <div class="tel-allumer"><button class="btn principal grand" data-tel="allumer">${ic('telephone')}<span>Allumer</span></button><small>Dérush ouvre une porte sur ton réseau, seulement pour les téléphones que tu relies ici. Tu la coupes quand tu veux.</small></div>`;
    const aide = {
      mac: 'Si ton Mac demande d’autoriser les connexions entrantes de « node », réponds <b>Autoriser</b>.',
      windows: 'Si Windows demande d’autoriser « Node.js » sur le réseau, clique <b>Autoriser</b>. Si ton téléphone ne voit toujours rien, ouvre Paramètres › Réseau et Internet › Wi-Fi › ton réseau, et choisis <b>Réseau privé</b>.',
      linux: `Si un pare-feu est actif, ouvre le port <b>${esc(e.port)}</b> pour ton réseau local.`,
    }[systeme()] ?? '';
    const adresses = e.adresses.length > 1 ? `<li>Cet ordinateur a plusieurs adresses. Essaie avec une autre : <select class="tel-adresse" data-tel-adresse>${e.adresses.map((a) => `<option value="${esc(a.ip)}"${a.ip === e.adresse ? ' selected' : ''}>${esc(a.ip)}${a.conseillee ? ' (conseillée)' : ''}</option>`).join('')}</select></li>` : '';
    return `
      ${e.jumelage && !e.demandes.length && !relie ? `<ol class="tel-etapes">
        <li><i>1</i><span>Mets ton téléphone sur le <b>même Wi-Fi</b> que cet ordinateur.</span></li>
        <li><i>2</i><span><b>Scanne le code</b> avec son appareil photo.</span></li>
        <li><i>3</i><span>Compare le nombre affiché, puis clique ici sur <b>Relier ce téléphone</b>.</span></li>
      </ol>` : ''}
      ${e.appareils.length ? `<div class="tel-liste"><p class="tel-sur">${e.appareils.length > 1 ? 'Tes téléphones' : 'Ton téléphone'}</p>${e.appareils.map((a) => `
        <div class="tel-appareil${a.en_ligne ? ' en-ligne' : ''}">${ic('telephone')}<span><b>${esc(a.nom)}</b><small>${a.en_ligne ? 'regarde en ce moment' : esc(ilYA(a.vu_le ?? a.relie_le))}</small></span><button class="btn petit" data-tel="retirer" data-id="${esc(a.id)}" title="Ce téléphone ne pourra plus suivre tes montages">Retirer</button></div>`).join('')}</div>` : ''}
      <label class="tel-option"><span class="interrupteur"><input type="checkbox" data-tel-ecrire${e.ecrire ? ' checked' : ''}><i></i></span><span><b>Écrire à l’IA depuis le téléphone</b><small>${e.ecrire ? 'Allumé : tes téléphones peuvent lui écrire et l’arrêter. À garder pour un Wi-Fi à toi.' : 'Coupé : tes téléphones regardent seulement.'}</small></span></label>
      <details class="tel-aide"${vu.aideOuverte ? ' open' : ''}><summary>Ça ne marche pas ?</summary><ul>
        <li>Ton téléphone est bien en Wi-Fi, sur le même réseau que cet ordinateur (pas en 4G ou 5G, pas sur le Wi-Fi « invités »).</li>
        ${aide ? `<li>${aide}</li>` : ''}
        ${adresses}
        <li>Certains Wi-Fi publics (école, hôtel, café) empêchent les appareils de se parler : là, ça ne marchera pas.</li>
        <li>${systeme() === 'mac' ? 'Tant que ton téléphone regarde, ton Mac ne s’endort pas (et encore une demi-heure après ton dernier coup d’œil).' : 'Si ton ordinateur s’endort, ton téléphone ne le voit plus : règle sa mise en veille sur « Jamais » le temps du montage.'}</li>
      </ul></details>
      <p class="tel-note">${ic('cadenas')}<span>La liaison passe par ton réseau, sans Internet, et n’est pas chiffrée : garde-la pour un Wi-Fi que tu connais (chez toi, à l’association).</span></p>`;
  }
  const poser = (cle, el, html) => { if (!el || vu[cle] === html) return; vu[cle] = html; el.innerHTML = html; };
  function dessiner() {
    const f = document.getElementById('feuille');
    if (!ouverte || !E || !f?.classList.contains('tel')) return;
    const actif = f.querySelector('#tel-actif');
    if (actif) { actif.checked = !!E.ecoute; actif.disabled = occupe; }
    const sous = f.querySelector('#tel-sous');
    if (sous) sous.textContent = !E.ecoute ? 'Lance un montage, pars faire autre chose, et garde un œil dessus.' : E.demandes.length ? 'Un téléphone attend ta réponse.' : E.en_ligne ? `${pluriel(E.en_ligne, 'téléphone')} ${E.en_ligne > 1 ? 'regardent' : 'regarde'} en ce moment.` : E.appareils.length ? 'Allumé. Ton téléphone retrouve Dérush à la même adresse.' : 'Allumé : scanne le code pour relier ton téléphone.';
    f.classList.toggle('allume', !!E.ecoute);
    // le menu des adresses ou « Ça ne marche pas ? » ouverts : on ne redessine pas sous le doigt
    const aide = f.querySelector('.tel-aide');
    if (aide) vu.aideOuverte = aide.open;
    poser('gauche', f.querySelector('#tel-gauche'), gauche(E));
    if (!f.querySelector('.tel-adresse:focus')) poser('droite', f.querySelector('#tel-corps'), droite(E));
    majBouton({actif: E.ecoute, en_ligne: E.en_ligne});
  }

  async function agir(action, corps) {
    if (occupe) return;
    occupe = true;
    try {
      E = await api('POST', `/api/telephone/${action}`, corps ?? {});
      // la porte vient de s'ouvrir : un premier code à scanner
      if (action === 'allumer' && E.ecoute && !E.jumelage) E = await api('POST', '/api/telephone/jumelage', {});
    } catch (e) { note(e.message, true); } finally { occupe = false; dessiner(); }
  }
  /** Relit l'état pendant que la fenêtre est ouverte : une demande de jumelage arrive, un téléphone se met à regarder. */
  async function suivre() {
    clearTimeout(minuterie);
    if (!ouverte) return;
    try {
      if (!occupe) {
        let e = await api('GET', '/api/telephone');
        // le code a fini ses dix minutes : un autre le remplace (sauf juste après un jumelage)
        if (ouverte && e.ecoute && e.adresse && !e.jumelage && !e.demandes.length && !relie && !occupe) e = await api('POST', '/api/telephone/jumelage', {});
        if (!occupe) { E = e; dessiner(); }
      }
    } catch { /* serveur occupé : au prochain tour */ }
    if (ouverte) minuterie = setTimeout(suivre, 1200);
  }

  async function ouvrir() {
    const f = feuille(`
      <button class="icone-btn tel-clore" data-fermer title="Fermer">${ic('fermer')}</button>
      <div class="tel-deux">
        <div class="tel-gauche" id="tel-gauche"></div>
        <div class="tel-droite">
          <div class="tel-tete"><h3>Suivre sur mon téléphone</h3><label class="interrupteur" title="Allumer ou couper le suivi sur téléphone"><input type="checkbox" id="tel-actif"><i></i></label></div>
          <p class="sous-titre" id="tel-sous"></p>
          <div class="tel-corps" id="tel-corps"></div>
        </div>
      </div>`, true);
    f.classList.add('tel');
    ouverte = true;
    relie = null;
    vu = {};
    occupe = false;
    f.avantFermeture = () => {
      ouverte = false;
      clearTimeout(minuterie);
      // le code affiché ne vaut plus dès que la fenêtre se ferme
      if (E?.ecoute) api('POST', '/api/telephone/fermer', {}).catch(() => {});
    };
    f.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-fermer]')) return fermerFeuille();
      const b = ev.target.closest('[data-tel]');
      if (!b) return;
      const a = b.dataset.tel;
      if (a === 'allumer') return agir('allumer');
      if (a === 'relier' || a === 'refuser') {
        const nom = E?.demandes.find((d) => d.id === b.dataset.id)?.nom ?? null;
        await agir('repondre', {demande: b.dataset.id, accepter: a === 'relier'});
        if (a === 'relier' && E?.appareils.length) { relie = E.appareils.at(-1).nom ?? nom; note(`${relie} est relié.`, false, true); }
        else if (a === 'refuser') await agir('jumelage');
        return dessiner();
      }
      if (a === 'autre') { relie = null; return agir('jumelage'); }
      if (a === 'retirer') return agir('retirer', {id: b.dataset.id});
      if (a === 'copier') { copierTexte(E?.jumelage?.lien ?? ''); return note('Lien copié.'); }
    });
    f.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.id === 'tel-actif') { relie = null; return agir(t.checked ? 'allumer' : 'eteindre'); }
      if (t.matches('[data-tel-ecrire]')) return agir('regler', {ecrire: t.checked});
      if (t.matches('[data-tel-adresse]')) { t.blur(); return agir('regler', {adresse: t.value}); }
    });
    try {
      E = await api('GET', '/api/telephone');
      // un nouveau code à chaque ouverture de la fenêtre
      if (E.ecoute) E = await api('POST', '/api/telephone/jumelage', {});
    } catch (e) { fermerFeuille(); return note(e.message, true); }
    if (!ouverte) return;
    dessiner();
    minuterie = setTimeout(suivre, 1200);
  }

  return {ouvrir, majBouton};
}
