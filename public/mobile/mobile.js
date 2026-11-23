// Dérush — la page du téléphone : suivre un montage depuis son téléphone (servie par lib/telephone.mjs, sur le réseau
// local). Trois écrans : relier ce téléphone (le code scanné sur l'ordinateur, ou six chiffres à taper), suivre (le
// moniteur du direct, l'avancée, les vidéos, la conversation, écrire à l'IA), et « Dérush ne répond plus ».
// Le jeton du téléphone reste dans son navigateur ; il ne voyage qu'en en-tête, jamais dans une adresse.

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const ic = (nom, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${document.getElementById(`i-${nom}`) ? nom : 'etincelle'}"/></svg>`;
const APP = $('#app');
/** Le dernier d'une liste (écrit ainsi pour les téléphones d'il y a quelques années). */
const dernierDe = (l) => (l && l.length ? l[l.length - 1] : undefined);

// ——— ce que le téléphone garde (une navigation privée n'a pas de stockage : gardé le temps de la page) ———
const memoire = new Map();
const garde = {
  lire(k) { try { return localStorage.getItem(k) ?? memoire.get(k) ?? null; } catch { return memoire.get(k) ?? null; } },
  ecrire(k, v) { memoire.set(k, v); try { localStorage.setItem(k, v); } catch { /* pas de stockage */ } },
  retirer(k) { memoire.delete(k); try { localStorage.removeItem(k); } catch { /* pas de stockage */ } },
};
const CLE_JETON = 'derush.telephone';
const CLE_MOI = 'derush.telephone.moi';
let jeton = garde.lire(CLE_JETON);
/** Un identifiant tiré au hasard pour cette demande de jumelage : seul ce téléphone le connaît. */
function moi() {
  let m = garde.lire(CLE_MOI);
  if (!m || !/^[A-Za-z0-9_-]{16,64}$/.test(m)) {
    const o = new Uint8Array(18);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(o); else for (let i = 0; i < o.length; i++) o[i] = Math.floor(Math.random() * 256);
    m = btoa(String.fromCharCode(...o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    garde.ecrire(CLE_MOI, m);
  }
  return m;
}

// ——— parler à Dérush ———
async function appel(methode, chemin, corps = null, {delai = 9000} = {}) {
  const ctl = new AbortController();
  const m = setTimeout(() => ctl.abort(), delai);
  try {
    const r = await fetch(chemin, {
      method: methode, cache: 'no-store', signal: ctl.signal,
      headers: {...(jeton ? {'X-Derush-Telephone': jeton} : {}), ...(methode === 'POST' ? {'Content-Type': 'application/json'} : {})},
      body: methode === 'POST' ? JSON.stringify(corps ?? {}) : undefined,
    });
    let d = null;
    try { d = await r.json(); } catch { /* pas de JSON : dit plus bas */ }
    if (!r.ok) { const e = new Error(d?.erreur ?? 'Dérush n’a pas répondu.'); e.code = r.status; throw e; }
    return d ?? {};
  } finally { clearTimeout(m); }
}
/**
 * L'adresse d'une image ou d'une vidéo. Une balise ne peut pas envoyer d'en-tête : l'adresse porte un billet, donné par
 * Dérush avec l'état, qui ne sert qu'à lire ces fichiers. Le jeton, lui, n'est jamais dans une adresse.
 */
const avecBillet = (src, plus = '') => `${src}?k=${encodeURIComponent(E?.billet ?? '')}${plus}`;

// ——— dire les durées et les dates ———
const deux = (n) => String(n).padStart(2, '0');
const chrono = (s) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600); return h ? `${h}:${deux(Math.floor((s % 3600) / 60))}:${deux(s % 60)}` : `${Math.floor(s / 60)}:${deux(s % 60)}`; };
const dureeDite = (s) => { s = Math.round(s); if (s < 60) return `${s} s`; const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${deux(m % 60)}`; };
const dureeVideo = (s) => { s = Math.round(Number(s) || 0); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${deux(s % 60)}`; };
function ilYA(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 50) return 'à l’instant';
  if (s < 3300) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 79200) return `il y a ${Math.round(s / 3600)} h`;
  if (s < 165600) return 'hier';
  return new Date(t).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'});
}
/** Les espaces du français : un guillemet ou un deux-points ne passe jamais seul à la ligne sur un petit écran. */
const fr = (t) => String(t ?? '').replace(/ ([»:;?!%])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
/** Le texte de l'IA, mis en forme simplement : gras, code, puces. Tout le reste est du texte, jamais du HTML. */
function mdLeger(t) {
  return esc(fr(String(t ?? '').replace(/\n{3,}/g, '\n\n').trim()))
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/^#{1,4} +(.+)$/gm, '<b>$1</b>')
    .replace(/^[-*] +/gm, '• ');
}

// ——— la petite note qui passe en haut ———
let minuterieNote = null;
function note(texte, erreur = false) {
  let n = $('#m-note');
  if (!n) { n = document.createElement('div'); n.id = 'm-note'; n.className = 'm-note'; n.setAttribute('role', 'status'); document.body.append(n); }
  n.textContent = texte;
  n.classList.toggle('erreur', erreur);
  n.classList.add('vue');
  clearTimeout(minuterieNote);
  minuterieNote = setTimeout(() => n.classList.remove('vue'), erreur ? 5200 : 3200);
}

// ═══════════════ relier ce téléphone ═══════════════
const MARQUE = '<span class="m-marque"><img src="/icone.svg" alt="" width="26" height="26"><b>Dérush</b></span>';
let jumelageEnCours = 0; // change à chaque nouvelle tentative : l'ancienne boucle s'arrête

function ecranRelier({etat = 'saisie', nom = null, nombre = null, message = null} = {}) {
  arreterSuivi();
  const attente = etat === 'attente';
  APP.className = 'm-app m-relier';
  APP.innerHTML = `
    <header class="m-haut">${MARQUE}</header>
    <main class="m-relier-corps">
      <div class="m-ondes${attente ? ' actives' : ''}" aria-hidden="true"><i></i><i></i><i></i><span>${ic('telephone')}</span></div>
      ${attente ? `
        <h1 class="m-titre">Presque relié</h1>
        ${nombre ? `<p class="m-texte">Ton ordinateur doit afficher le même nombre :</p><p class="m-nombre" aria-label="Le nombre à comparer">${esc(nombre)}</p><p class="m-texte">Si c’est bien lui, clique là-bas sur <b>Relier ce téléphone</b>.</p>` : '<p class="m-texte">Dérush prévient ton ordinateur…</p>'}
        ${nom ? `<p class="m-appareil">${ic('telephone')}<span>Ce téléphone s’appelle <b>${esc(nom)}</b> dans Dérush.</span></p>` : ''}
      ` : `
        <h1 class="m-titre">${etat === 'refuse' ? 'Demande refusée' : 'Relie ton téléphone'}</h1>
        <p class="m-texte">${esc(message ?? 'Sur ton ordinateur, ouvre Dérush et clique sur le téléphone, en haut. Scanne le code avec ton appareil photo, ou tape ici les six chiffres affichés.')}</p>
        <form class="m-chiffres" id="m-chiffres" autocomplete="off">
          <input id="m-code" inputmode="numeric" pattern="[0-9 ]*" maxlength="7" placeholder="000 000" aria-label="Le code à six chiffres" autocomplete="one-time-code">
          <button class="m-bouton" id="m-relier">Relier</button>
        </form>
      `}
      <p class="m-pied">Ton téléphone et ton ordinateur doivent être sur le même Wi-Fi.</p>
    </main>`;
  const f = $('#m-chiffres');
  if (f) {
    const champ = $('#m-code');
    champ.addEventListener('input', () => { const c = champ.value.replace(/\D/g, '').slice(0, 6); champ.value = c.length > 3 ? `${c.slice(0, 3)} ${c.slice(3)}` : c; });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const c = champ.value.replace(/\D/g, '');
      if (c.length !== 6) { note('Le code a six chiffres.', true); champ.focus(); return; }
      relier({chiffres: c});
    });
  }
}

/** Demande à être relié, puis attend le clic fait sur l'ordinateur. */
async function relier({code = null, chiffres = null} = {}) {
  const tour = ++jumelageEnCours;
  const depart = {code, chiffres};
  const bouton = $('#m-relier');
  if (bouton) bouton.disabled = true;
  let affiche = false;
  let echecs = 0;
  for (;;) {
    if (tour !== jumelageEnCours) return;
    let r;
    try { r = await appel('POST', '/api/jumeler', {code, chiffres, moi: moi()}); echecs = 0; } catch (e) {
      if (tour !== jumelageEnCours) return;
      if (e.code === 429) return ecranRelier({message: 'Trop d’essais depuis ce téléphone. Attends quelques minutes, puis recommence.'});
      if (++echecs >= 4) return ecranRelier({message: 'Dérush ne répond pas. Vérifie que ton téléphone est sur le même Wi-Fi que ton ordinateur, puis recommence.'});
      await new Promise((ok) => setTimeout(ok, 1500));
      continue;
    }
    if (tour !== jumelageEnCours) return;
    if (r.etat === 'relie') {
      jeton = r.jeton;
      garde.ecrire(CLE_JETON, jeton);
      garde.retirer(CLE_MOI);
      try { navigator.vibrate?.(60); } catch { /* pas de vibreur */ }
      return demarrerSuivi();
    }
    if (r.etat === 'attente') {
      // une fois la demande acceptée par le code, ce téléphone est reconnu sans lui
      code = null;
      chiffres = null;
      if (!affiche) { affiche = true; ecranRelier({etat: 'attente', nom: r.nom, nombre: r.nombre}); }
      await new Promise((ok) => setTimeout(ok, 1400));
      continue;
    }
    garde.retirer(CLE_MOI);
    if (r.etat === 'refuse') return ecranRelier({etat: 'refuse', message: 'Sur l’ordinateur, la demande a été refusée. Si c’était une erreur, rouvre « Suivre sur mon téléphone » et scanne le nouveau code.'});
    if (r.etat === 'occupe') return ecranRelier({message: 'D’autres téléphones attendent déjà une réponse. Réponds-leur sur l’ordinateur, puis recommence.'});
    // sans code du tout (une page rechargée dont la demande n'est plus là) : l'écran de départ
    if (!depart.code && !depart.chiffres) return ecranRelier();
    return ecranRelier({message: r.etat === 'perime' || depart.code ? 'Ce code ne vaut plus : il dure dix minutes et ne sert qu’une fois. Rouvre « Suivre sur mon téléphone » sur ton ordinateur, puis scanne le nouveau code ou tape ses six chiffres.' : 'Ce n’est pas le bon code. Regarde les six chiffres affichés sur ton ordinateur.'});
  }
}

// ═══════════════ suivre ═══════════════
const ETAPES = [['preparation', 'Préparation'], ['ia', 'Montage'], ['rendu', 'Rendu'], ['livraison', 'Contrôle']];
let E = null; // le dernier état reçu
let debutLocal = 0; // le début du travail, à l'horloge de ce téléphone
let minuterie = null;
let enRoute = false; // une relecture est partie
let echecs = 0;
let suivi = false;
let videoChoisie = null; // la vidéo montrée dans le moniteur (null : le direct, ou la dernière vidéo)
let fetePour = null; // la vidéo qui vient d'arriver
let feteLe = 0; // … et quand : « C'est prêt » reste dix minutes, puis la vidéo reprend son nom
const deplies = new Set(); // les réponses de l'IA dépliées (« Tout lire »)
const vu = {}; // ce qui est déjà dessiné, section par section

function arreterSuivi() { suivi = false; clearTimeout(minuterie); minuterie = null; }

function construireSuivi() {
  APP.className = 'm-app m-suivi';
  APP.innerHTML = `
    <header class="m-haut">
      ${MARQUE}
      <span class="m-projet" id="m-projet"></span>
      <button class="m-rond" id="m-menu" aria-label="Menu">${ic('points')}</button>
    </header>
    <div class="m-hors" id="m-hors" hidden><i class="m-bobine petite"></i><span><b>Dérush ne répond plus.</b> <span id="m-hors-detail">Nouvel essai…</span></span></div>
    <main class="m-corps" id="m-corps">
      <section class="m-scene">
        <div class="m-ecran" id="m-ecran">
          <img id="m-image" alt="" hidden>
          <video id="m-video" playsinline controls preload="none" hidden></video>
          <div class="m-vide" id="m-vide"><i class="m-bobine"></i><span id="m-vide-texte"></span></div>
          <span class="m-tally" id="m-tally" hidden><i></i><b>En direct</b></span>
          <span class="m-legende" id="m-legende" hidden></span>
          <div class="m-tampon" id="m-tampon" hidden><b>C’est prêt</b></div>
        </div>
        <button class="m-retour-direct" id="m-retour-direct" hidden>${ic('retour')}<span>Revenir au direct</span></button>
      </section>
      <section class="m-etat" id="m-etat">
        <p class="m-sur" id="m-sur"></p>
        <h1 class="m-titre" id="m-titre"></h1>
        <p class="m-meta" id="m-meta"></p>
        <div class="m-avancee" id="m-avancee" hidden>
          <div class="m-barre"><i id="m-jauge"></i></div>
          <ol class="m-etapes" id="m-etapes">${ETAPES.map(([k, n]) => `<li data-etape="${k}"><i></i><span>${n}</span></li>`).join('')}</ol>
        </div>
        <p class="m-alerte" id="m-alerte" hidden></p>
        <div class="m-actions" id="m-actions" hidden></div>
      </section>
      <section class="m-bloc" id="m-file-bloc" hidden><div class="m-file" id="m-file"></div></section>
      <section class="m-bloc" id="m-gestes-bloc" hidden><h2>En ce moment</h2><ul class="m-gestes" id="m-gestes"></ul></section>
      <section class="m-bloc" id="m-reponse-bloc" hidden><h2>Sa réponse</h2><div class="m-reponse" id="m-reponse"></div></section>
      <section class="m-bloc" id="m-videos-bloc" hidden><h2 id="m-videos-titre">Tes vidéos</h2><div class="m-videos" id="m-videos"></div></section>
      <section class="m-bloc" id="m-fil-bloc" hidden><h2>La conversation</h2><div class="m-fil" id="m-fil"></div></section>
      <p class="m-regarde" id="m-regarde" hidden>${ic('oeil')}<span>Ce téléphone regarde seulement. Pour écrire à ton IA d’ici, allume « Écrire à l’IA depuis le téléphone » sur ton ordinateur.</span></p>
      <p class="m-pied" id="m-pied"></p>
    </main>
    <div class="m-bas" id="m-bas">
      <div class="m-confirme" id="m-confirme" hidden><span>Arrêter le travail en cours ?</span><button class="m-bouton sombre" data-stop="non">Non</button><button class="m-bouton" data-stop="oui">Oui, arrêter</button></div>
      <form class="m-ecrire" id="m-ecrire">
        <button type="button" class="m-stop" id="m-stop" aria-label="Arrêter le travail" hidden>${ic('stop', 'plein')}</button>
        <textarea id="m-message" rows="1" maxlength="4000" placeholder="Écrire à ton IA…" aria-label="Ton message"></textarea>
        <button class="m-envoi" id="m-envoi" aria-label="Envoyer">${ic('envoi')}</button>
      </form>
    </div>`;
  for (const k of Object.keys(vu)) delete vu[k];

  // — écrire à l'IA —
  const champ = $('#m-message');
  const ajuster = () => { champ.style.height = 'auto'; champ.style.height = `${Math.min(132, champ.scrollHeight)}px`; };
  champ.addEventListener('input', ajuster);
  let envoi = false;
  $('#m-ecrire').addEventListener('submit', async (e) => {
    e.preventDefault();
    const texte = champ.value.trim();
    if (!texte || envoi) return;
    envoi = true;
    $('#m-envoi').disabled = true;
    try {
      const r = await appel('POST', '/api/ecrire', {message: texte}, {delai: 20000});
      champ.value = '';
      ajuster();
      champ.blur();
      const qui = E?.travail?.nom_ia ?? E?.ia?.nom ?? 'Ton IA';
      note(r.lance ? `C’est parti : ${qui} s’y met.` : r.lu_en_route ? `Envoyé : ${qui} le lira à son prochain geste.` : 'Envoyé : ton message partira à la fin du travail.');
      relire(true);
    } catch (err) {
      if (err.code === 401) return perdu();
      note(err.name === 'AbortError' ? 'Dérush met du temps à répondre : regarde si ton message est parti avant de le renvoyer.' : err.message, true);
    } finally { envoi = false; $('#m-envoi').disabled = false; }
  });

  // — arrêter (avec une confirmation : un pouce glisse vite) —
  $('#m-stop').addEventListener('click', () => { $('#m-confirme').hidden = !$('#m-confirme').hidden; });
  $('#m-confirme').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-stop]');
    if (!b) return;
    $('#m-confirme').hidden = true;
    if (b.dataset.stop !== 'oui') return;
    try { await appel('POST', '/api/arreter'); note('Arrêt demandé : l’IA termine son geste en cours.'); relire(true); } catch (err) { if (err.code === 401) return perdu(); note(err.message, true); }
  });

  // — le moniteur, les vidéos, la conversation —
  $('#m-retour-direct').addEventListener('click', () => { videoChoisie = null; afficher(E, E, true); });
  $('#m-videos').addEventListener('click', (e) => {
    const c = e.target.closest('[data-video]');
    if (!c || e.target.closest('a')) return;
    videoChoisie = c.dataset.video;
    afficher(E, E, true);
    $('#m-corps').scrollIntoView({block: 'start', behavior: 'smooth'});
    // la lecture part si le téléphone le permet ; sinon il attend un toucher sur la vidéo
    try { const p = $('#m-video').play?.(); if (p && p.catch) p.catch(() => {}); } catch { /* lecture refusée */ }
  });
  $('#m-videos').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-video]')) { e.preventDefault(); e.target.click(); } });
  $('#m-fil').addEventListener('click', (e) => {
    const b = e.target.closest('[data-deplier]');
    if (!b) return;
    deplies.add(b.dataset.deplier);
    vu.fil = null;
    afficher(E, E, true);
  });
  $('#m-image').addEventListener('load', (e) => { const i = e.target; if (i.naturalWidth && i.naturalHeight && !i.hidden) format(i.naturalWidth, i.naturalHeight); });
  $('#m-menu').addEventListener('click', menu);
}

/** Les proportions du moniteur : celles de l'image ou de la vidéo montrée. */
function format(l, h) {
  const e = $('#m-ecran');
  if (!e || !(l > 0) || !(h > 0)) return;
  e.style.setProperty('--l', l);
  e.style.setProperty('--h', h);
}

function menu() {
  let f = $('#m-feuille');
  if (f) return f.remove();
  f = document.createElement('div');
  f.id = 'm-feuille';
  f.className = 'm-feuille';
  f.innerHTML = `<div class="m-feuille-carte" role="dialog" aria-label="Menu">
      <p class="m-feuille-titre">${ic('telephone')}<span><b>${esc(E?.appareil ?? 'Ce téléphone')}</b><small>relié à ${esc(E?.ordinateur ?? 'ton ordinateur')} · Dérush ${esc(E?.version ?? '')}</small></span></p>
      <p class="m-feuille-texte">Cette page passe par ton Wi-Fi, sans Internet. Elle marche tant que Dérush est ouvert sur ton ordinateur.</p>
      <button class="m-ligne" data-menu="recharger">${ic('maj')}<span>Actualiser</span></button>
      <button class="m-ligne rouge" data-menu="oublier">${ic('fermer')}<span>Ne plus suivre sur ce téléphone</span></button>
      <button class="m-bouton sombre large" data-menu="fermer">Fermer</button>
    </div>`;
  document.body.append(f);
  f.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-menu]');
    if (!b && e.target !== f) return;
    const a = b?.dataset.menu;
    if (a === 'recharger') return location.reload();
    if (a === 'oublier') {
      if (b.dataset.sur !== '1') { b.dataset.sur = '1'; $('span', b).textContent = 'Touche encore pour confirmer'; return; }
      try { await appel('POST', '/api/oublier'); } catch { /* déjà retiré, ou Dérush fermé : le jeton part d'ici quand même */ }
      f.remove();
      return perdu('Ce téléphone ne suit plus Dérush. Pour le relier de nouveau, scanne le code sur ton ordinateur.');
    }
    f.remove();
  });
}

/** Le jeton ne vaut plus (téléphone retiré sur l'ordinateur) : retour à « Relie ton téléphone ». */
function perdu(message = 'Ce téléphone n’est plus relié à Dérush. Rouvre « Suivre sur mon téléphone » sur ton ordinateur, puis scanne le code ou tape ses six chiffres.') {
  jeton = null;
  garde.retirer(CLE_JETON);
  E = null;
  $('#m-feuille')?.remove();
  ecranRelier({message});
}

/** Dessine une section seulement si son contenu a changé (le téléphone relit l'état chaque seconde). */
function poser(cle, element, html) {
  if (vu[cle] === html) return false;
  vu[cle] = html;
  element.innerHTML = html;
  return true;
}

function afficher(e, avant = null, force = false) {
  if (!e || !$('#m-ecran')) return;
  if (force) for (const k of ['etat', 'videos', 'fil', 'gestes', 'file']) vu[k] = null;
  const t = e.travail;
  const videos = e.videos ?? [];
  // le travail vient de finir : le moniteur passe à la vidéo qui vient d'arriver
  if (avant?.travail && !t) {
    videoChoisie = null;
    const neuve = videos[0] && !(avant.videos ?? []).some((x) => x.nom === videos[0].nom && x.le === videos[0].le) ? videos[0] : null;
    if (neuve) { fetePour = neuve.nom; feteLe = Date.now(); try { navigator.vibrate?.([90, 60, 160]); } catch { /* pas de vibreur */ } const tp = $('#m-tampon'); tp.hidden = false; tp.classList.remove('joue'); void tp.offsetWidth; tp.classList.add('joue'); setTimeout(() => { tp.hidden = true; }, 2600); }
  }
  if (t && !avant?.travail) { fetePour = null; videoChoisie = null; }
  if (videoChoisie && !videos.some((x) => x.nom === videoChoisie)) videoChoisie = null;
  const montree = videoChoisie ? videos.find((x) => x.nom === videoChoisie) : !t ? videos[0] ?? null : null;

  // — le haut —
  $('#m-projet').textContent = e.projet?.titre ?? '';
  document.title = t ? `${t.pct != null ? `${t.pct} % · ` : ''}${t.titre}` : fetePour ? 'C’est prêt · Dérush' : 'Dérush';

  // — le moniteur —
  const ecran = $('#m-ecran');
  const image = $('#m-image');
  const video = $('#m-video');
  const vide = $('#m-vide');
  const tally = $('#m-tally');
  const legende = $('#m-legende');
  ecran.classList.toggle('direct', !!t && !montree);
  if (montree) {
    const src = avecBillet(montree.src);
    // une autre vidéo : on la charge. Seul le billet a changé (toutes les six heures) : on attend une pause.
    if (video.dataset.video !== montree.src || (video.dataset.src !== src && video.paused)) {
      video.dataset.video = montree.src;
      video.dataset.src = src;
      video.poster = avecBillet(montree.affiche);
      video.src = src;
      video.load?.();
    }
    if (montree.largeur && montree.hauteur) format(montree.largeur, montree.hauteur);
    video.hidden = false;
    image.hidden = true;
    vide.hidden = true;
    tally.hidden = true;
    legende.hidden = true;
  } else {
    if (!video.hidden) { video.pause?.(); video.hidden = true; }
    const im = t?.image ?? null;
    if (im) {
      const src = avecBillet(im.src);
      if (image.dataset.src !== src) {
        image.dataset.src = src;
        // l'image suivante remplace l'ancienne une fois chargée : jamais de trou noir entre deux images
        const pre = new Image();
        pre.onload = () => { if (image.dataset.src === src) { image.src = src; image.hidden = false; vide.hidden = true; } };
        pre.src = src;
      } else if (image.src) { image.hidden = false; vide.hidden = true; }
      if (im.largeur && im.hauteur) format(im.largeur, im.hauteur);
      tally.hidden = !im.direct;
      legende.hidden = false;
      legende.textContent = im.legende ?? '';
    } else {
      image.hidden = true;
      image.removeAttribute('src');
      delete image.dataset.src;
      tally.hidden = true;
      legende.hidden = true;
      vide.hidden = false;
      vide.classList.toggle('calme', !t);
      // l'affiche du projet (une image de ses rushes) derrière la bobine : le moniteur n'est jamais un trou noir
      const fond = e.projet?.affiche ? avecBillet(e.projet.affiche) : null;
      if (vide.dataset.fond !== (fond ?? '')) {
        vide.dataset.fond = fond ?? '';
        vide.classList.toggle('affiche', !!fond);
        vide.style.backgroundImage = fond ? `linear-gradient(rgba(8, 8, 10, .62), rgba(8, 8, 10, .84)), url("${fond}")` : '';
      }
      if (e.projet?.largeur && e.projet?.hauteur) format(e.projet.largeur, e.projet.hauteur);
      $('#m-vide-texte').textContent = t ? (t.etape === 'preparation' ? 'Dérush prépare ta matière' : 'Les premières images arrivent bientôt')
        : !e.projet ? 'Aucun projet ouvert' : 'Pas encore de vidéo';
    }
  }
  $('#m-retour-direct').hidden = !(t && montree);

  // — où on en est —
  const etatHtml = JSON.stringify([t ? [t.titre, t.etape, t.nom_ia, t.niveau, t.arret, t.habituel_s, t.publication] : null, montree?.nom, montree?.le, fetePour, !!e.projet, videos.length, dernierDe(e.fil)?.erreur]);
  if (vu.etat !== etatHtml) {
    vu.etat = etatHtml;
    const sur = $('#m-sur');
    const titre = $('#m-titre');
    const meta = $('#m-meta');
    const actions = $('#m-actions');
    $('#m-etat').classList.toggle('travail', !!t);
    $('#m-avancee').hidden = !t;
    if (t) {
      sur.innerHTML = `<i class="m-point"></i>${esc([t.nom_ia, t.niveau, t.publication ? 'publication' : null].filter(Boolean).join(' · '))}`;
      titre.textContent = t.titre;
      actions.hidden = true;
      for (const [k, li] of [...$('#m-etapes').children].entries()) { const rang = ETAPES.findIndex(([x]) => x === t.etape); li.classList.toggle('faite', k < rang); li.classList.toggle('ici', k === rang); }
    } else if (montree) {
      sur.textContent = fetePour === montree.nom ? 'Ta vidéo vient d’arriver' : montree === videos[0] ? 'Ta dernière vidéo' : 'Une autre version';
      titre.textContent = fetePour === montree.nom ? 'C’est prêt' : montree.titre;
      meta.textContent = [fetePour === montree.nom ? montree.titre : null, montree.duree ? dureeVideo(montree.duree) : null, montree.largeur && montree.hauteur ? `${montree.largeur} × ${montree.hauteur}` : null, montree.taille_lisible, ilYA(montree.le)].filter(Boolean).join(' · ');
      actions.hidden = false;
      actions.innerHTML = `<a class="m-bouton" href="${esc(avecBillet(montree.src, '&dl=1'))}" download="${esc(montree.nom)}">${ic('importer')}<span>Enregistrer sur mon téléphone</span></a>${montree.description ? `<p class="m-description">${esc(montree.description)}</p>` : ''}`;
    } else {
      sur.textContent = e.projet ? 'Au repos' : 'Sur ton ordinateur';
      titre.textContent = e.projet ? 'Rien en cours' : 'Aucun projet ouvert';
      meta.textContent = e.projet ? (e.peut?.ecrire ? 'Écris ta demande ci-dessous : ton IA monte la vidéo sur ton ordinateur, et tu suis l’avancée ici.' : 'Lance un montage depuis ton ordinateur : tu suivras l’avancée ici.') : 'Ouvre un projet dans Dérush, sur ton ordinateur.';
      actions.hidden = true;
    }
    if (!t && !montree) meta.classList.add('texte'); else meta.classList.remove('texte');
  }
  // le dernier travail s'est arrêté sur un souci (forfait épuisé, IA débranchée…) : dit ici, sans aller le chercher plus bas
  const dernier = dernierDe(e.fil);
  const souci = !t && dernier?.de === 'ia' && dernier.erreur && !dernier.arret ? dernier : null;
  $('#m-alerte').hidden = !souci;
  if (souci) poser('alerte', $('#m-alerte'), `${ic('attention')}<span><b>${esc(souci.nom_ia)} s’est arrêté</b>${esc(fr(souci.texte.length > 260 ? `${souci.texte.slice(0, 259)}…` : souci.texte))}</span>`);
  if (souci && avant?.travail) { try { navigator.vibrate?.(200); } catch { /* pas de vibreur */ } }
  if (t) {
    debutLocal = Date.now() - t.depuis_s * 1000;
    majChrono();
    const jauge = $('#m-jauge');
    jauge.style.width = t.pct != null ? `${t.pct}%` : '100%';
    jauge.classList.toggle('libre', t.pct == null);
  }

  // — la file de Dérush (préparation des rushes, création d'une vidéo, export) —
  const file = e.file;
  $('#m-file-bloc').hidden = !file;
  if (file) poser('file', $('#m-file'), `<span class="m-file-nom">${ic('outil')}<span>${esc(file.nom)}</span></span><b>${file.pct} %</b><div class="m-barre fine"><i style="width:${Math.max(2, file.pct)}%"></i></div>${file.attente ? `<small>${file.attente} autre${file.attente > 1 ? 's' : ''} en attente</small>` : ''}`);

  // — les gestes de l'IA —
  $('#m-gestes-bloc').hidden = !(t && t.gestes.length);
  if (t?.gestes.length) {
    const neufs = Math.max(0, Math.min(t.gestes.length, t.n_gestes - (vu.nGestes ?? t.n_gestes - t.gestes.length)));
    vu.nGestes = t.n_gestes;
    poser('gestes', $('#m-gestes'), t.gestes.map((g, k) => `<li class="${g.parole ? 'parole' : ''}${k >= t.gestes.length - neufs ? ' neuf' : ''}${k === t.gestes.length - 1 ? ' dernier' : ''}">${ic(g.icone)}<span>${esc(fr(g.texte))}</span></li>`).join(''));
  } else vu.nGestes = null;

  // — sa réponse, lisible pendant que Dérush contrôle encore la vidéo —
  $('#m-reponse-bloc').hidden = !t?.reponse;
  if (t?.reponse) poser('reponse', $('#m-reponse'), mdLeger(t.reponse));

  // — les vidéos —
  const autres = videos.filter((x) => x !== montree);
  $('#m-videos-bloc').hidden = !autres.length;
  $('#m-videos-titre').textContent = montree ? (autres.length > 1 ? 'Les autres versions' : 'L’autre version') : videos.length > 1 ? 'Tes vidéos' : 'Ta dernière vidéo';
  if (autres.length) poser('videos', $('#m-videos'), autres.map((x) => `
    <div class="m-video-carte" data-video="${esc(x.nom)}" role="button" tabindex="0">
      <span class="m-vignette${x.hauteur > x.largeur ? ' haute' : ''}"><img src="${esc(avecBillet(x.affiche))}" alt="" loading="lazy">${ic('lire', 'plein')}</span>
      <span class="m-video-texte"><b>${esc(x.titre)}</b><small>${esc([x.duree ? dureeVideo(x.duree) : null, x.taille_lisible, ilYA(x.le)].filter(Boolean).join(' · '))}</small></span>
      <a class="m-rond" href="${esc(avecBillet(x.src, '&dl=1'))}" download="${esc(x.nom)}" aria-label="Enregistrer cette vidéo">${ic('importer')}</a>
    </div>`).join(''));

  // — la conversation —
  const fil = e.fil ?? [];
  $('#m-fil-bloc').hidden = !fil.length;
  if (fil.length) {
    const html = fil.map((x) => {
      const cle = `${x.quand}`;
      const long = x.de === 'ia' && x.texte.length > 420 && !deplies.has(cle);
      const etat = x.pendant === 'lu' ? `${ic('coche')}Lu pendant le travail` : x.pendant === 'bientot' ? `${ic('horloge')}Lu au prochain geste` : x.pendant === 'apres' ? `${ic('horloge')}Partira à la fin du travail` : '';
      return x.de === 'moi'
        ? `<div class="m-b moi"><div class="m-b-texte">${esc(fr(x.texte))}</div>${x.pieces ? `<small>${ic('trombone')}${x.pieces} pièce${x.pieces > 1 ? 's' : ''} jointe${x.pieces > 1 ? 's' : ''}</small>` : ''}${etat ? `<small>${etat}</small>` : ''}</div>`
        : `<div class="m-b ia${x.erreur ? ' erreur' : ''}${x.arret ? ' arret' : ''}"><p class="m-b-qui"><b>${esc(x.nom_ia)}</b>${x.version ? `<span>version ${x.version}</span>` : ''}${x.duree_s ? `<span>${esc(dureeDite(x.duree_s))}</span>` : ''}</p><div class="m-b-texte${long ? ' coupe' : ''}">${mdLeger(x.texte)}</div>${long ? `<button class="m-lien" data-deplier="${esc(cle)}">Tout lire</button>` : ''}</div>`;
    }).join('');
    poser('fil', $('#m-fil'), html);
  }

  // — le bas : écrire, arrêter —
  const peut = !!e.peut?.ecrire;
  $('#m-bas').hidden = !peut || !e.projet;
  $('#m-regarde').hidden = peut || !e.projet;
  $('#m-stop').hidden = !t || t.arret;
  if (!t) $('#m-confirme').hidden = true;
  const qui = t?.nom_ia ?? e.ia?.nom ?? 'ton IA';
  $('#m-message').placeholder = t ? `Écrire à ${qui}…` : videos.length || fil.length ? 'Demander une retouche…' : 'Demander un montage…';
  $('#m-pied').innerHTML = `Relié à <b>${esc(e.ordinateur ?? 'ton ordinateur')}</b> · Dérush ${esc(e.version ?? '')}`;
}

function majChrono() {
  const t = E?.travail;
  const m = $('#m-meta');
  if (!t || !m) return;
  const s = (Date.now() - debutLocal) / 1000;
  // ce que ce niveau dure d'habitude sur cet ordinateur : un repère, pas un compte à rebours (une retouche va plus vite)
  m.innerHTML = `<b class="m-temps">${chrono(s)}</b>${t.rendu ? `<span>rendu · ${t.rendu.pct}\u00a0%</span>` : ''}${t.etape === 'livraison' ? '<span>dernières vérifications</span>' : t.habituel_s ? `<span>d’habitude ${dureeDite(t.habituel_s)}</span>` : ''}`;
}
setInterval(() => { if (suivi && E?.travail && !document.hidden) majChrono(); }, 1000);
// au repos, « il y a 5 min » vieillit tout seul : redit une fois par minute
setInterval(() => {
  if (!suivi || !E || E.travail || document.hidden || !$('#m-ecran')) return;
  if (fetePour && Date.now() - feteLe > 600e3) fetePour = null;
  vu.etat = null;
  vu.videos = null;
  afficher(E, E);
}, 60000);

/** Relit où en est le montage, puis recommence : toutes les secondes pendant le travail, plus doucement au repos. */
async function relire(toutDeSuite = false) {
  if (!suivi || !jeton) return;
  if (enRoute) { if (toutDeSuite) setTimeout(() => relire(true), 300); return; }
  clearTimeout(minuterie);
  if (document.hidden) return; // la page cachée ne demande rien : elle reprend quand on y revient
  enRoute = true;
  let pause = 4000;
  try {
    const r = await appel('GET', `/api/etat${E?.v ? `?v=${E.v}` : ''}`);
    if (!suivi) return;
    const avant = E;
    if (r.pareil) { if (E?.travail && r.depuis_s != null) { E.travail.depuis_s = r.depuis_s; debutLocal = Date.now() - r.depuis_s * 1000; } } else { E = r; afficher(E, avant); }
    if (echecs) { echecs = 0; $('#m-hors').hidden = true; APP.classList.remove('hors'); }
    pause = E.travail ? (E.travail.rendu ? 900 : 1300) : E.file ? 1600 : 4000;
  } catch (e) {
    if (!suivi) return;
    if (e.code === 401) return perdu();
    echecs++;
    if (echecs >= 2) {
      $('#m-hors').hidden = false;
      APP.classList.add('hors');
      $('#m-hors-detail').textContent = e.code === 429 ? 'Trop de demandes : nouvel essai dans un instant.' : echecs > 5 ? 'Ton ordinateur dort, Dérush est fermé, ou ton téléphone a changé de Wi-Fi.' : 'Nouvel essai…';
    }
    pause = Math.min(8000, 1500 + echecs * 700);
  } finally {
    enRoute = false;
    if (suivi) minuterie = setTimeout(relire, pause);
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && suivi) relire(true); });
window.addEventListener('online', () => { if (suivi) relire(true); });

async function demarrerSuivi() {
  jumelageEnCours++;
  E = null;
  echecs = 0;
  suivi = true;
  construireSuivi();
  relire(true);
}

// le code scanné alors que cette page est déjà ouverte dans le même onglet : la page ne se recharge pas, seule la fin
// de son adresse change
window.addEventListener('hashchange', () => {
  const code = new URLSearchParams(location.hash.slice(1)).get('j');
  if (!code) return;
  try { history.replaceState(null, '', location.pathname); } catch { /* adresse inchangée */ }
  if (suivi && jeton) return; // ce téléphone est déjà relié
  ecranRelier({etat: 'attente'});
  relier({code});
});

// ═══════════════ au chargement ═══════════════
(async () => {
  // le code scanné est après le « # » : il ne part jamais dans une adresse, et il quitte la barre tout de suite
  const code = new URLSearchParams(location.hash.slice(1)).get('j');
  if (location.hash) { try { history.replaceState(null, '', location.pathname); } catch { /* adresse inchangée */ } }
  if (jeton) {
    // déjà relié ? on le vérifie avant d'afficher quoi que ce soit
    try { await appel('GET', '/api/etat'); return demarrerSuivi(); } catch (e) {
      if (e.code !== 401) return demarrerSuivi(); // Dérush ne répond pas : l'écran de suivi le dira et réessaiera
      jeton = null;
      garde.retirer(CLE_JETON);
    }
  }
  if (code) { ecranRelier({etat: 'attente'}); return relier({code}); }
  // une demande déjà faite avant un rechargement de la page : elle a peut-être été acceptée entre-temps
  if (garde.lire(CLE_MOI)) return relier({});
  ecranRelier();
})();
