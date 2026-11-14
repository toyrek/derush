// Dérush — enregistrer sans quitter le logiciel : sa voix (micro), ou soi-même (webcam + micro). Et la voix off
// proposée : le bouton du micro s'allume, Dérush pose des questions, la personne répond et choisit qui fait la voix off.
// La voix off se pose pendant que le montage défile : on parle sur ses images. La webcam sert à un podcast ou à un face
// caméra. L'enregistrement part chez Dérush morceau par morceau (voir lib/enregistrement.mjs), puis apparaît dans les
// médias. Rien ne sort de l'ordinateur.
//
// creerEnregistreur(o) → {ouvrir(), voix(), camera(), reponse(), actif()}
//   o.api(methode, url, corps)      les appels à Dérush
//   o.poster(url, blob)             l'envoi d'un morceau (corps brut)
//   o.feuille(html, large) / o.fermerFeuille() / o.note(texte, erreur) / o.ic(nom) / o.esc(texte)
//   o.lecture = {t(), lire(), pause(), sourdine(oui), aDuMontage()}   la tête de lecture du montage
//   o.surFini({genre, media, debut, poser})   l'enregistrement est dans les médias : à l'app de le poser
//   o.voixOff = {texte(), ecrire(t), conseil(), questions()}   la voix off proposée (creerVoixOff, plus bas) : le texte à
//                                    lire pendant l'enregistrement, et le conseil qui allume « Ma voix »
//
// creerVoixOff(o) → {charger(), carte(), clic(act, el), ouvrir(), signature(), …}   la voix off proposée (lib/voix-off.mjs,
//   routes /api/voix-off…) : le bouton du micro qui s'allume avec sa bulle, la carte « Une voix off ? » de la colonne de
//   l'IA, la feuille des questions (réponses écrites, ou dites au micro sans rien poser dans le montage), le choix.
//   Rien ne part chez une IA sans un clic : « Préparer mes questions » montre d'abord ce qu'elle lira.
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
const chrono = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** Le format que cette fenêtre sait enregistrer (l'app Mac et Safari : mp4 ; Chrome : webm). */
const formatDe = (video) => {
  const liste = video
    ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return liste.find((t) => { try { return window.MediaRecorder?.isTypeSupported?.(t); } catch { return false; } }) ?? '';
};
/** Pourquoi le micro ou la caméra ne s'ouvre pas, en mots simples. */
function raison(e, video) {
  const quoi = video ? 'à la caméra et au micro' : 'au micro';
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return 'Cette fenêtre ne sait pas enregistrer. Mets ton système à jour, ou ouvre Dérush dans Chrome.';
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return `Dérush n’a pas accès ${quoi}. Sur Mac : Réglages Système › Confidentialité et sécurité › ${video ? 'Caméra, puis Micro' : 'Micro'}, coche Dérush, puis réessaie.`;
  if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return video ? 'Aucune caméra trouvée sur cet ordinateur.' : 'Aucun micro trouvé sur cet ordinateur.';
  if (e?.name === 'NotReadableError') return `${video ? 'La caméra' : 'Le micro'} est déjà pris par une autre app : ferme-la, puis réessaie.`;
  return `Impossible d’ouvrir ${video ? 'la caméra' : 'le micro'} : ${e?.message ?? e}`;
}

// ——— la voix off proposée : petites aides sans page (essayées par outils/essai-voix-off-interface.mjs) ———
/** « 0:06 », « 1:12 » : un temps dans la vidéo, ou une durée courte. */
export function minSec(s) {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
/** « 45 s », « 1 min 12 » : une durée de lecture. */
export function dureeParlee(s) {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return t < 60 ? `${t} s` : `${Math.floor(t / 60)} min${t % 60 ? ` ${String(t % 60).padStart(2, '0')}` : ''}`;
}
const pluriel = (n, mot, mots = `${mot}s`) => `${n} ${n > 1 ? mots : mot}`;
/** Une ligne numérotée : « 1. … », « 2) … », « **3.** … », « - 4. … ». */
const LIGNE_NUMEROTEE = /^\s*(?:[-*•]\s+)?(?:\*\*)?(\d{1,2})\s*[.)](?:\*\*)?\s+(.+?)\s*$/;
/**
 * Les questions qu'une IA pose à la fin de sa réponse : la dernière liste numérotée (1, 2, 3… dans l'ordre), suivie
 * d'au plus deux lignes (« Réponds-moi et je l'écris. »). Il en faut au moins deux, et au moins la moitié finissent par
 * un point d'interrogation (sinon c'est une liste de ce qu'elle a fait). Renvoie leurs textes, ou [].
 */
export function questionsALaFin(texte) {
  const lignes = String(texte ?? '').replace(/\r/g, '').split('\n');
  let i = lignes.length - 1;
  let apres = 0;
  while (i >= 0 && !LIGNE_NUMEROTEE.test(lignes[i])) {
    if (lignes[i].trim() && ++apres > 2) return [];
    i--;
  }
  const items = [];
  // en remontant : les lignes numérotées, les lignes vides entre elles, et les lignes en retrait qui les prolongent
  for (; i >= 0; i--) {
    const l = lignes[i];
    const x = LIGNE_NUMEROTEE.exec(l);
    if (x) { items.unshift({n: Number(x[1]), texte: x[2]}); continue; }
    if (!l.trim() || /^\s{2,}\S/.test(l)) continue;
    break;
  }
  if (items.length < 2 || items.some((x, k) => x.n !== k + 1)) return [];
  const textes = items.map((x) => x.texte.replace(/\*\*/g, '').replace(/^["«“]\s*|\s*["»”]$/g, '').trim()).filter(Boolean);
  const questions = textes.filter((t) => t.includes('?')).length;
  return textes.length === items.length && questions * 2 >= textes.length ? textes : [];
}
/**
 * Ce que « Répondre » écrit dans la zone d'écriture : une ligne par question (« 1. », « 2. »…), après ce qui y était
 * déjà ; `curseur` : juste après « 1. ».
 */
export function reponsePreparee(n, avant = '') {
  const tete = String(avant ?? '').trim() ? `${String(avant).trim()}\n\n` : '';
  const lignes = Array.from({length: Math.max(1, Math.min(20, Number(n) || 1))}, (_, k) => `${k + 1}. `);
  return {texte: `${tete}${lignes.join('\n')}`, curseur: tete.length + 3};
}
/** Le moment du texte à lire où l'on en est au temps t (secondes de la vidéo) : le dernier commencé, -1 avant le premier. */
export function momentCourant(moments, t) {
  let k = -1;
  for (let i = 0; i < (moments?.length ?? 0); i++) if (Number(moments[i].debut) <= t + 0.05) k = i;
  return k;
}
/**
 * Ce que montre la carte de la colonne de l'IA, d'après GET /api/voix-off : 'cachee' (rien à proposer, ou « Pas de
 * voix off »), 'preparation' (l'IA prépare les questions), 'posee' (la voix off est dans le montage), 'choisi' (moi,
 * reponses, ia), 'questions' (à répondre), 'proposer' (le micro s'allume : une voix off aiderait).
 */
export function etapeCarte(E) {
  if (!E || typeof E !== 'object' || E.choix === 'aucune') return 'cachee';
  if (E.suivi?.etat === 'en_cours') return 'preparation';
  const questions = Array.isArray(E.questions) ? E.questions.length : 0;
  if (E.avis?.deja) return E.choix === 'moi' || questions ? 'posee' : 'cachee';
  if (['moi', 'reponses', 'ia'].includes(E.choix)) return 'choisi';
  if (questions) return 'questions';
  return E.micro?.allume ? 'proposer' : 'cachee';
}
/** Les choix de la carte, en court (le nom complet et la description du serveur sont dans la bulle d'aide). */
export const CHOIX_COURTS = {moi: 'Je l’enregistre', reponses: 'Mes réponses', ia: 'Voix ElevenLabs', aucune: 'Pas de voix off'};
const ICONES_CHOIX = {moi: 'micro', reponses: 'dialogue', ia: 'etincelle', aucune: 'fermer'};
/** Ce que la carte repliée dit en un mot. */
export function resumeCarte(E) {
  const et = etapeCarte(E);
  if (et === 'proposer') return 'conseillée';
  if (et === 'preparation') return 'questions en préparation';
  if (et === 'questions') return `${E.repondues ?? 0}/${E.questions.length} ${E.questions.length > 1 ? 'réponses' : 'réponse'}`;
  if (et === 'posee') return 'dans ton montage';
  if (et === 'choisi') return {moi: E.texte ? 'ton texte est prêt' : 'tu l’enregistres', reponses: 'tes réponses', ia: 'voix ElevenLabs'}[E.choix] ?? '';
  return '';
}
/** Les demandes toutes faites que la carte prépare dans la zone d'écriture (jamais envoyées sans un clic). */
export const DEMANDES_VOIX_OFF = {
  texte: 'Écris le texte de ma voix off, moment par moment, avec mes réponses à tes questions : je l’enregistrerai moi-même en le lisant.',
  reponses: 'Monte mes réponses enregistrées comme voix off : pose chacune sur les images dont elle parle, garde mes mots, baisse le son d’origine sous ma voix et ajoute des sous-titres.',
  ia: 'Écris ma voix off avec mes réponses à tes questions, et fais-la dire par une voix ElevenLabs naturelle, en français.',
  posee: 'Ma voix off est le fil du film : remonte mes images sur ce que je dis (le bon plan au bon mot), nettoie ma voix, mets des sous-titres et une musique discrète qui baisse quand je parle.',
};

export function creerEnregistreur(o) {
  const {api, poster, feuille, fermerFeuille, note, ic, esc, lecture, surFini} = o;
  let actif = null; // {genre, flux, rec, id, …} pendant qu'on enregistre ou qu'on prépare

  const arreterFlux = (flux) => { for (const p of flux?.getTracks?.() ?? []) { try { p.stop(); } catch { /* déjà arrêtée */ } } };
  /** Une erreur à montrer, sauf si elle vient d'être dite (le refus d'un morceau est dit tout de suite, une seule fois). */
  const signaler = (err) => { if (!err?.dit) note(err?.message ?? String(err), true); };
  /** Les micros et les caméras de l'ordinateur (leurs noms ne sont connus qu'une fois l'accès donné). */
  async function appareils() {
    try {
      const l = await navigator.mediaDevices.enumerateDevices();
      return {micros: l.filter((d) => d.kind === 'audioinput'), cameras: l.filter((d) => d.kind === 'videoinput')};
    } catch { return {micros: [], cameras: []}; }
  }
  const options = (liste, choisi, defaut) => liste.map((d, k) => `<option value="${esc(d.deviceId)}"${d.deviceId === choisi ? ' selected' : ''}>${esc(d.label || `${defaut} ${k + 1}`)}</option>`).join('');
  const ouvrirFlux = (video, micro, camera) => navigator.mediaDevices.getUserMedia({
    audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(micro ? {deviceId: {exact: micro}} : {})},
    ...(video ? {video: {width: {ideal: 1920}, height: {ideal: 1080}, frameRate: {ideal: 30}, ...(camera ? {deviceId: {exact: camera}} : {})}} : {}),
  });
  /** Le niveau du micro, en direct (une barre qui bouge quand on parle). Renvoie une fonction pour l'arrêter. */
  function suivreNiveau(flux, barre) {
    let ctx;
    let tourne = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const a = ctx.createAnalyser();
      a.fftSize = 512;
      ctx.createMediaStreamSource(flux).connect(a);
      const t = new Uint8Array(a.fftSize);
      const pas = () => {
        if (!tourne) return;
        a.getByteTimeDomainData(t);
        let s = 0;
        for (const v of t) s += ((v - 128) / 128) ** 2;
        const niveau = Math.min(1, Math.sqrt(s / t.length) * 4.5);
        barre.style.setProperty('--n', niveau.toFixed(3));
        barre.classList.toggle('fort', niveau > 0.92);
        requestAnimationFrame(pas);
      };
      pas();
    } catch { /* pas de mesure : l'enregistrement marche quand même */ }
    return () => { if (!tourne) return; tourne = false; try { ctx?.close()?.catch?.(() => {}); } catch { /* déjà fermé */ } };
  }
  /**
   * Lance l'enregistreur : chaque morceau part chez Dérush dans l'ordre. Renvoie {arreter() → {media…}, annuler()}.
   * Au premier morceau refusé (disque plein, prise trop longue…), la prise s'arrête tout de suite, le message de Dérush
   * s'affiche, et surErreur() demande à la fenêtre de la terminer : ce qui est déjà sur le disque devient un média.
   */
  async function demarrer(genre, flux, surErreur = () => {}) {
    const mime = formatDe(genre === 'camera');
    const rec = new MediaRecorder(flux, {...(mime ? {mimeType: mime} : {}), audioBitsPerSecond: 192000, ...(genre === 'camera' ? {videoBitsPerSecond: 8000000} : {})});
    const {id} = await api('POST', '/api/enregistrements', {genre, mime: rec.mimeType || mime});
    let n = 0;
    let chaine = Promise.resolve();
    let erreur = null;
    let abandon = false; // « Fermer » pendant la prise : elle est jetée, les morceaux qui restent ne partent plus
    const arreterSurErreur = (e) => {
      if (erreur || abandon) return;
      erreur = e instanceof Error ? e : new Error(String(e?.message ?? e ?? 'L’enregistrement s’est arrêté.'));
      // on ne filme pas pour rien : plus rien ne serait gardé
      if (rec.state !== 'inactive') { try { rec.stop(); } catch { /* déjà arrêté */ } }
      note(erreur.message, true);
      surErreur();
    };
    rec.ondataavailable = (ev) => {
      if (!ev.data?.size) return;
      const k = n++;
      chaine = chaine.then(() => (erreur || abandon ? null : poster(`/api/enregistrements/${id}/morceau?n=${k}`, ev.data))).catch(arreterSurErreur);
    };
    const fini = new Promise((ok) => { rec.onstop = ok; rec.onerror = (ev) => { arreterSurErreur(ev.error ?? new Error('L’enregistrement s’est arrêté.')); ok(); }; });
    rec.start(2000);
    return {
      async arreter() {
        if (rec.state !== 'inactive') rec.stop();
        await fini;
        await chaine;
        // même après une erreur, ce qui est déjà sur le disque devient un média du projet (l'erreur a déjà été dite)
        try { return await api('POST', `/api/enregistrements/${id}/fin`); } catch (e) {
          if (erreur && e.message === erreur.message) e.dit = true;
          throw e;
        }
      },
      async annuler() {
        abandon = true;
        if (rec.state !== 'inactive') rec.stop();
        await fini;
        api('DELETE', `/api/enregistrements/${id}`).catch(() => {});
      },
    };
  }

  /**
   * Une réponse dite au micro (la voix off proposée) : la prise part chez Dérush comme une voix (« voix-off-… » dans les
   * enregistrements du projet), devient un média, et rien n'est posé dans le montage (c'est une réponse, pas encore la
   * voix off). Renvoie {depuis(), niveau(barre), surErreur(f), arreter() → {media}, annuler()} ; lève une erreur en mots
   * simples si le micro ne s'ouvre pas ou si un autre enregistrement est ouvert.
   */
  async function reponse() {
    if (actif) throw new Error(actif.genre === 'reponse' ? 'Une réponse s’enregistre déjà.' : 'Un enregistrement est déjà ouvert : arrête-le d’abord.');
    actif = {genre: 'reponse'};
    let flux = null;
    let stopNiveau = () => {};
    const liberer = () => { stopNiveau(); arreterFlux(flux); actif = null; };
    try { flux = await ouvrirFlux(false); } catch (e) { actif = null; throw new Error(raison(e, false)); }
    let surErreur = () => {};
    let prise;
    try { prise = await demarrer('voix', flux, () => surErreur()); } catch (e) { liberer(); throw e; }
    const depart = Date.now();
    let finie = false;
    return {
      depuis: () => (Date.now() - depart) / 1000,
      niveau(barre) { stopNiveau(); stopNiveau = barre && !finie ? suivreNiveau(flux, barre) : () => {}; },
      surErreur(f) { surErreur = typeof f === 'function' ? f : () => {}; },
      async arreter() {
        if (finie) return null;
        finie = true;
        try { return await prise.arreter(); } finally { liberer(); }
      },
      async annuler() {
        if (finie) return;
        finie = true;
        try { await prise.annuler(); } finally { liberer(); }
      },
    };
  }

  // ——— la voix off : un petit panneau posé sous l'écran, pendant que le montage défile ———
  async function voix() {
    if (actif) return;
    actif = {genre: 'voix'};
    fermerFeuille();
    document.querySelector('#enr')?.remove();
    const montage = lecture.aDuMontage();
    // le texte à lire (la voix off proposée, « Je l'enregistre moi-même ») : il défile avec la lecture, et se retouche
    let texte = null;
    try { texte = (await o.voixOff?.texte?.()) ?? null; } catch { texte = null; }
    if (!texte?.moments?.length) texte = null;
    const p = document.createElement('div');
    p.id = 'enr';
    p.className = `enr${texte ? ' avec-texte' : ''}`;
    const aide = texte
      ? (montage ? 'Place la tête de lecture là où ta voix doit commencer, puis enregistre en lisant ton texte : il défile avec ton montage.' : 'Enregistre ta voix en lisant ton texte : il avance pendant que tu parles.')
      : (montage ? 'Place la tête de lecture là où ta voix doit commencer, puis enregistre.' : 'Enregistre ta voix : elle ira dans tes médias.');
    p.innerHTML = `<div class="enr-tete"><span class="enr-voyant"></span><b>Voix off</b><span class="enr-temps" id="enr-temps">00:00</span><span class="espace"></span><button class="icone-btn" data-enr="fermer" title="Fermer">${ic('fermer')}</button></div>
      ${texte ? '<div class="enr-texte" id="enr-texte"></div>' : ''}
      <div class="enr-corps"><div class="enr-niveau" id="enr-niveau" title="Le niveau de ta voix"><i></i></div>
        <select id="enr-micro" title="Choisir le micro"></select>
        ${montage ? `<label class="enr-option"><input type="checkbox" id="enr-lire" checked><span>Lire mon montage pendant que je parle</span></label>
        <label class="enr-option"><input type="checkbox" id="enr-couper" checked><span>Couper son son (sans casque, le micro l’entendrait)</span></label>` : ''}
        <p class="enr-aide" id="enr-aide">${aide}</p></div>
      <div class="enr-pied"><button class="btn rouge" data-enr="go" disabled>${ic('micro')}<span>Enregistrer</span></button></div>`;
    document.body.append(p);
    const $ = (s) => p.querySelector(s);
    let flux = null;
    let stopNiveau = () => {};
    let prise = null;
    let debut = 0;
    let depart = 0;
    let horloge = null;
    let arret = false; // « Arrêter » est en cours (clic, ou morceau refusé)
    let edition = false; // le texte à lire est en train d'être retouché
    let kVu = -2;
    const lireCoche = () => !!(montage && $('#enr-lire')?.checked);
    /** Où l'on en est dans la vidéo : la tête de lecture du montage, ou le temps de la prise quand rien ne défile. */
    const tempsTexte = () => (prise && !lireCoche() ? debut + (Date.now() - depart) / 1000 : montage ? lecture.t() : 0);
    /** Le texte à lire, moment par moment : les temps, ce qu'on voit, les mots ; un moment trop long pour ses images est signalé. */
    function rendreTexte() {
      const box = $('#enr-texte');
      if (!box || !texte) return;
      const longs = texte.moments.filter((m) => m.trop_long).length;
      box.innerHTML = `<div class="enr-texte-tete">${ic('texte')}<b>${esc(texte.titre || 'Ton texte')}</b><small>${pluriel(texte.moments.length, 'moment')} · ${dureeParlee(texte.lecture_s)} à lire${longs ? ` · <em>${pluriel(longs, 'moment un peu long', 'moments un peu longs')}</em>` : ''}</small><span class="espace"></span>
        ${edition ? `<button class="btn petit" data-enr="texte-annuler">Annuler</button><button class="btn petit bleu" data-enr="texte-garder">${ic('coche')}Garder</button>`
    : `<button class="btn petit" data-enr="retoucher" title="Changer des mots avant d’enregistrer"${prise ? ' disabled' : ''}>${ic('crayon')}Retoucher</button>`}</div>
        <div class="enr-defile" id="enr-defile">${texte.moments.map((m, k) => `<div class="enr-moment${m.trop_long ? ' long' : ''}" data-k="${k}"><span class="enr-quand">${minSec(m.debut)} – ${minSec(m.fin)}${m.plans ? ` · ${esc(m.plans)}` : ''}</span>${edition
    ? `<textarea data-texte-k="${k}" rows="2" spellcheck="true">${esc(m.texte)}</textarea>`
    : `<p>${esc(m.texte)}</p>${m.trop_long ? `<small class="enr-long">${ic('attention')}Un peu long : ${m.mots} mots, ${String(m.lecture_s).replace('.', ',')} s à lire pour ${dureeParlee(m.fin - m.debut)} d’images</small>` : ''}`}<i class="enr-avance"></i></div>`).join('')}</div>`;
      kVu = -2;
      for (const ta of box.querySelectorAll('textarea')) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; }
      suivreTexte();
    }
    /** Le moment qu'on lit s'éclaire et monte en haut ; une fine barre avance dedans. */
    function suivreTexte() {
      const box = $('#enr-defile');
      if (!box || !texte) return;
      const t = tempsTexte();
      const k = momentCourant(texte.moments, t);
      if (k !== kVu) {
        kVu = k;
        box.querySelectorAll('.enr-moment').forEach((el, i) => { el.classList.toggle('ici', i === k); el.classList.toggle('lu', i < k); });
        const el = box.querySelector(`.enr-moment[data-k="${Math.max(0, k)}"]`);
        if (el && !edition) box.scrollTo({top: Math.max(0, el.offsetTop - box.clientHeight * 0.18), behavior: 'smooth'});
      }
      const m = texte.moments[k];
      const el = k >= 0 ? box.querySelector(`.enr-moment[data-k="${k}"]`) : null;
      if (m && el) el.style.setProperty('--p', Math.min(1, Math.max(0, (t - m.debut) / Math.max(0.1, m.fin - m.debut))).toFixed(3));
    }
    const suiviTexte = texte ? setInterval(suivreTexte, 120) : null;
    let ferme = false;
    const fermer = () => { ferme = true; clearInterval(horloge); clearInterval(suiviTexte); stopNiveau(); arreterFlux(flux); lecture.sourdine(false); p.remove(); actif = null; };
    /** « Enregistrer » attend que le micro soit ouvert, et que le texte ne soit pas en train d'être retouché. */
    const majGo = () => { const g = $('[data-enr="go"]'); if (g) g.disabled = !flux || edition; };
    rendreTexte();
    p.addEventListener('input', (e) => { if (e.target.matches?.('[data-texte-k]')) { e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight + 2}px`; } });
    /** Arrête la prise et la garde : la voix est mise au propre et rejoint les médias. */
    async function arreterVoix() {
      if (!prise || arret) return;
      arret = true;
      const bouton = $('[data-enr="stop"]');
      if (bouton) bouton.disabled = true;
      clearInterval(horloge);
      lecture.pause();
      lecture.sourdine(false);
      p.classList.remove('en-cours');
      p.classList.add('prepare');
      $('#enr-aide').textContent = 'Dérush met ta voix au propre…';
      try {
        const r = await prise.arreter();
        prise = null;
        fermer();
        await surFini({genre: 'voix', media: r.media, debut, poser: montage});
      } catch (err) { prise = null; fermer(); signaler(err); }
    }
    const brancher = async (micro = null) => {
      stopNiveau();
      arreterFlux(flux);
      flux = null;
      majGo();
      const f = await ouvrirFlux(false, micro);
      if (ferme) return arreterFlux(f); // le panneau s'est fermé pendant la demande d'accès au micro
      flux = f;
      stopNiveau = suivreNiveau(flux, $('#enr-niveau'));
      const {micros} = await appareils();
      if (ferme) return;
      $('#enr-micro').innerHTML = options(micros, flux.getAudioTracks()[0]?.getSettings?.().deviceId, 'Micro');
      majGo();
    };
    // les clics sont branchés tout de suite : « Retoucher » ou « Fermer » marchent pendant que le micro s'ouvre
    p.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-enr]');
      const a = b?.dataset.enr;
      if (!a || b.disabled) return;
      if (a === 'fermer') { if (prise) await prise.annuler().catch(() => {}); if (prise) lecture.pause(); return fermer(); }
      // le texte à lire se retouche avant d'enregistrer (il est gardé dans le projet, l'IA le relira)
      if (a === 'retoucher' && !prise) { edition = true; majGo(); return rendreTexte(); }
      if (a === 'texte-annuler') { edition = false; majGo(); return rendreTexte(); }
      if (a === 'texte-garder') {
        const valeurs = [...p.querySelectorAll('[data-texte-k]')].map((ta) => ta.value);
        b.disabled = true;
        try {
          const nouveau = await o.voixOff?.ecrire?.({titre: texte.titre, moments: texte.moments.map((m, k) => ({debut: m.debut, fin: m.fin, plans: m.plans, texte: valeurs[k] ?? m.texte}))});
          if (nouveau?.moments?.length) texte = nouveau;
        } catch (err) { b.disabled = false; return note(err.message, true); }
        edition = false;
        majGo();
        note('Ton texte est gardé : ton IA lira cette version.');
        return rendreTexte();
      }
      if (a === 'go' && !prise && flux) {
        const bouton = $('[data-enr="go"]');
        bouton.disabled = true;
        try {
          debut = montage ? lecture.t() : 0;
          prise = await demarrer('voix', flux, () => arreterVoix());
          depart = Date.now();
          p.classList.add('en-cours');
          bouton.innerHTML = `${ic('stop', 'plein')}<span>Arrêter</span>`;
          bouton.dataset.enr = 'stop';
          $('#enr-aide').textContent = texte ? (lireCoche() ? 'Lis ton texte : il défile avec ton montage.' : 'Lis ton texte à ton rythme : il avance avec le temps.') : 'Parle : ta voix s’enregistre.';
          $('[data-enr="retoucher"]')?.setAttribute('disabled', '');
          horloge = setInterval(() => { $('#enr-temps').textContent = chrono((Date.now() - depart) / 1000); }, 250);
          if (lireCoche()) { lecture.sourdine(!!$('#enr-couper')?.checked); lecture.lire(); }
        } catch (err) { prise = null; note(err.message, true); }
        bouton.disabled = false;
        return;
      }
      if (a === 'stop' && prise) return arreterVoix();
    });
    try { await brancher(); } catch (e) { if (!ferme) { fermer(); note(raison(e, false), true); } return; }
    $('#enr-micro')?.addEventListener('change', (e) => brancher(e.target.value).catch((err) => note(raison(err, false), true)));
  }

  // ——— la webcam : un podcast, un face caméra ———
  async function camera() {
    if (actif) return;
    const f = feuille(`<h3>Me filmer</h3><p class="sous-titre">Un podcast, un face caméra : ta webcam et ton micro, enregistrés directement dans ton projet. Rien ne sort de ton ordinateur.</p>
      <div class="enr-cam"><video id="enr-video" autoplay muted playsinline></video><span class="enr-cam-temps" id="enr-cam-temps">00:00</span><div class="enr-niveau" id="enr-cam-niveau"><i></i></div></div>
      <div class="deux"><label class="champ"><span>Caméra</span><select id="enr-camera"></select></label><label class="champ"><span>Micro</span><select id="enr-cam-micro"></select></label></div>
      <label class="enr-option"><input type="checkbox" id="enr-ajouter" checked><span>Ajouter l’enregistrement à la suite de mon montage</span></label>
      <div class="pied" id="enr-cam-pied"></div>`, true);
    const $ = (s) => f.querySelector(s);
    const voile = f.parentElement ?? document.getElementById('voile');
    let flux = null;
    let stopNiveau = () => {};
    let prise = null;
    let depart = 0;
    let horloge = null;
    let etat = 'pret'; // 'pret' | 'prise' | 'question' (garder ou jeter ?) | 'fin' (Dérush range la prise)
    let ajouter = true;
    let parti = false; // la feuille est fermée ou remplacée
    let libre = false;
    const liberer = () => {
      clearInterval(horloge);
      stopNiveau();
      arreterFlux(flux);
      // une seule fois : un « Me filmer » rouvert entre-temps garde sa caméra
      if (!libre) { libre = true; actif = null; }
    };
    /** Le pied de la feuille, selon le moment. */
    function pied(quoi) {
      etat = quoi;
      const p = $('#enr-cam-pied');
      if (!p) return;
      p.innerHTML = quoi === 'pret'
        ? `<button class="btn" data-enr="annuler">Fermer</button><span class="espace"></span><button class="btn rouge" data-enr="go">${ic('camera')}<span>Enregistrer</span></button>`
        : quoi === 'prise'
          ? `<button class="btn" data-enr="demander">Fermer</button><span class="espace"></span><button class="btn rouge" data-enr="stop">${ic('stop', 'plein')}<span>Arrêter</span></button>`
          : quoi === 'question'
            ? `<span class="enr-question">${ic('attention')}Tu es en train de filmer.</span><span class="espace"></span><button class="btn" data-enr="jeter">Jeter la prise</button><button class="btn" data-enr="continuer">Continuer</button><button class="btn rouge" data-enr="stop">${ic('stop', 'plein')}<span>Arrêter et garder</span></button>`
            : '<span class="espace"></span><button class="btn rouge" disabled><span>Dérush prépare ta vidéo…</span></button>';
    }
    // la feuille fermée (Échap, clic à côté, une autre feuille à la place) : fermerFeuille() la vide sans la retirer, on
    // regarde donc le voile et le contenu, pas seulement l'élément
    const fermee = () => !f.isConnected || !f.firstElementChild || voile?.classList.contains('cache');
    // pendant une prise, Échap et un clic à côté ne ferment pas : ils demandent s'il faut garder ou jeter
    const garde = () => {
      if (!prise) return true;
      if (etat === 'prise') pied('question');
      return false;
    };
    f.avantFermeture = garde; // pour app.js, s'il consulte ce crochet avant de fermer une feuille
    const clavier = (ev) => {
      if (ev.key !== 'Escape' || parti || fermee() || !prise) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (etat === 'question') pied('prise'); // Échap sur la question : on continue de filmer
      else garde();
    };
    const pointeur = (ev) => {
      if (ev.target !== voile || parti || fermee() || garde()) return;
      ev.preventDefault();
      ev.stopPropagation();
    };
    const obs = new MutationObserver(() => { if (!parti && fermee()) quitter(); });
    if (voile) obs.observe(voile, {attributes: true, attributeFilter: ['class'], childList: true});
    window.addEventListener('keydown', clavier, true);
    window.addEventListener('pointerdown', pointeur, true);
    /** La feuille est partie : la caméra s'éteint, et une prise en cours est gardée (jamais jetée sans qu'on le dise). */
    function quitter() {
      parti = true;
      obs.disconnect();
      window.removeEventListener('keydown', clavier, true);
      window.removeEventListener('pointerdown', pointeur, true);
      if (etat === 'fin') return; // « Arrêter » ou « Jeter » s'en occupe
      if (!prise) return liberer();
      const p = prise;
      etat = 'fin';
      clearInterval(horloge);
      p.arreter().then((r) => {
        prise = null;
        liberer();
        note('Ta prise est gardée dans tes médias.');
        return surFini({genre: 'camera', media: r.media, debut: 0, poser: ajouter});
      }).catch((err) => { prise = null; liberer(); signaler(err); });
    }
    /** « Arrêter et garder » (le clic, ou un morceau refusé) : la vidéo est mise au propre et rejoint les médias. */
    async function arreterEtGarder() {
      if (!prise || etat === 'fin') return;
      const p = prise;
      pied('fin');
      clearInterval(horloge);
      try {
        const r = await p.arreter();
        prise = null;
        liberer();
        fermerIci();
        await surFini({genre: 'camera', media: r.media, debut: 0, poser: ajouter});
      } catch (err) { prise = null; liberer(); fermerIci(); signaler(err); }
    }
    const fermerIci = () => { if (!parti && !fermee()) fermerFeuille(); };
    const brancher = async (micro = null, cam = null) => {
      stopNiveau();
      arreterFlux(flux);
      flux = await ouvrirFlux(true, micro, cam);
      if (parti) return arreterFlux(flux); // la feuille s'est fermée pendant la demande d'accès
      $('#enr-video').srcObject = flux;
      stopNiveau = suivreNiveau(flux, $('#enr-cam-niveau'));
      const {micros, cameras} = await appareils();
      if (parti) return;
      $('#enr-camera').innerHTML = options(cameras, flux.getVideoTracks()[0]?.getSettings?.().deviceId, 'Caméra');
      $('#enr-cam-micro').innerHTML = options(micros, flux.getAudioTracks()[0]?.getSettings?.().deviceId, 'Micro');
    };
    actif = {genre: 'camera'};
    pied('pret');
    try { await brancher(); } catch (e) { liberer(); if (parti) return; fermerIci(); return note(raison(e, true), true); }
    if (parti) return liberer();
    const rebrancher = () => brancher($('#enr-cam-micro').value, $('#enr-camera').value).catch((err) => note(raison(err, true), true));
    $('#enr-camera').addEventListener('change', rebrancher);
    $('#enr-cam-micro').addEventListener('change', rebrancher);
    f.addEventListener('change', (e) => { if (e.target.id === 'enr-ajouter') ajouter = e.target.checked; });
    f.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-enr]');
      const a = b?.dataset.enr;
      if (!a || b.disabled) return;
      if (a === 'annuler' && !prise) { liberer(); return fermerIci(); }
      if (a === 'demander') return garde();
      if (a === 'continuer' && prise) return pied('prise');
      if (a === 'jeter' && prise && etat !== 'fin') {
        const p = prise;
        prise = null;
        etat = 'fin';
        b.disabled = true;
        clearInterval(horloge);
        await p.annuler().catch(() => {});
        liberer();
        fermerIci();
        return note('La prise est jetée.');
      }
      if (a === 'go' && !prise && etat === 'pret') {
        b.disabled = true;
        let p;
        try { p = await demarrer('camera', flux, () => arreterEtGarder()); } catch (err) { b.disabled = false; if (parti) return; return note(err.message, true); }
        // la feuille s'est fermée pendant ce temps : rien n'a encore été filmé
        if (parti) return p.annuler().catch(() => {});
        prise = p;
        depart = Date.now();
        f.classList.add('enr-en-cours');
        pied('prise');
        for (const s of [$('#enr-camera'), $('#enr-cam-micro')]) if (s) s.disabled = true;
        horloge = setInterval(() => { const t = $('#enr-cam-temps'); if (t) t.textContent = chrono((Date.now() - depart) / 1000); }, 250);
        return;
      }
      if (a === 'stop') return arreterEtGarder();
    });
  }

  /** Le choix : ma voix, ou me filmer. Quand une voix off est conseillée, « Ma voix » s'allume et dit pourquoi. */
  function ouvrir() {
    if (actif) return;
    let c = null;
    try { c = o.voixOff?.conseil?.() ?? null; } catch { c = null; }
    const conseil = c?.allume ? `<div class="enr-conseil">${ic('etincelle', 'plein')}<span>${esc(c.pourquoi)}</span>${c.questions || c.sansQuestions
      ? `<button class="btn petit" data-enr="questions">${ic('dialogue')}${c.questions ? 'Réponds à mes questions' : 'Pose-moi des questions'}</button>` : ''}</div>` : '';
    const f = feuille(`<h3>Enregistrer</h3><p class="sous-titre">Sans quitter Dérush : ta voix sur tes images, ou toi devant ta webcam. Tout reste sur ton ordinateur.</p>
      <div class="enr-choix"><button class="enr-carte${c?.allume ? ' conseille' : ''}" data-enr="voix"><span class="enr-rond">${ic('micro')}</span><b>Ma voix</b><small>${c?.texte
    ? 'Ta voix off : ton texte s’affiche et défile pendant que tu parles. Tu peux le retoucher avant.'
    : 'Une voix off : tu parles pendant que ton montage défile. Ton IA pourra la nettoyer, la sous-titrer, remonter les images dessus.'}</small></button>
        <button class="enr-carte" data-enr="camera"><span class="enr-rond">${ic('camera')}</span><b>Me filmer</b><small>Un podcast ou un face caméra, avec ta webcam et ton micro. La vidéo arrive tout de suite dans ton projet.</small></button></div>
      ${conseil}
      <div class="pied"><span class="espace"></span><button class="btn" data-fermer>Fermer</button></div>`);
    f.addEventListener('click', (e) => {
      if (e.target.closest('[data-fermer]')) return fermerFeuille();
      const a = e.target.closest('[data-enr]')?.dataset.enr;
      if (a === 'voix') voix();
      if (a === 'camera') { fermerFeuille(); pause(60).then(camera); }
      if (a === 'questions') o.voixOff?.questions?.();
    });
  }

  return {ouvrir, voix, camera, reponse, actif: () => !!actif};
}

// ——— la voix off proposée : le micro qui s'allume, la carte, la feuille des questions ———
/**
 * La voix off proposée (lib/voix-off.mjs, routes /api/voix-off…), telle que la personne la voit :
 *   - le bouton du micro du panneau des médias s'allume (un halo) quand GET /api/voix-off le dit, avec une bulle qui dit
 *     pourquoi (majMicro) ;
 *   - une carte « Une voix off ? » dans la colonne de l'IA (carte(), posée par l'app ; ses boutons portent data-cl
 *     « vo-… », que l'app renvoie à clic(act, el)) ;
 *   - la feuille « Ta voix off » (ouvrir()) : d'abord ce que l'IA lira (« Préparer mes questions » est le seul clic qui
 *     lance une IA ici), puis chaque question avec son moment, une réponse écrite ou dite au micro (un enregistrement
 *     de Dérush, jamais posé dans le montage), et le choix : moi, mes réponses, une voix ElevenLabs, pas de voix off.
 * o = {api, note, esc, ic, ill, feuille, fermerFeuille, feuilleOuverte, prefs, enr (creerEnregistreur),
 *      vignette(id, t, hauteur) → HTML, urlMedia(id, quoi), cleProjet(), actif(), demande(), nomIA(), moteurIA(), iaPrete(),
 *      demanderIA(texte), connexions(), relireMedias(), surChangement()}
 */
export function creerVoixOff(o) {
  const {api, note, esc, ic, ill, feuille, fermerFeuille} = o;
  let E = null; // le dernier état lu (GET /api/voix-off) du projet ouvert
  let projet = null; // la clé du projet de cet état
  let minuterie = null;
  let charge = null; // une lecture en cours
  let relire = false; // une lecture demandée pendant une autre
  let ouverte = null; // la feuille « Ta voix off », quand c'est elle qui est ouverte
  let vue = 'auto'; // 'envoi' : la feuille montre ce que l'IA lira, avant « Préparer mes questions »
  let prise = null; // {q, ctl} : une réponse dite au micro, en cours
  let range = null; // la question dont la réponse dite est en train d'être rangée
  let horloge = null;
  let masquee = null; // la bulle du micro fermée, pour cette raison-là
  let signeFeuille = '';
  let signeMedias = null;
  let signeDessus = null;
  let attente = null;
  let demandeEnvoyee = '';
  let vueVue = ''; // la vue que la feuille montre (ce que l'IA lira, la préparation, les questions)
  let finEntree = null;
  const ecrits = new Map(); // question → texte tapé dans la feuille
  const envois = new Map(); // question → minuterie d'envoi de ce texte
  const lecteur = new Audio(); // « Écouter » une réponse dite
  const ORDRE = ['moi', 'reponses', 'ia', 'aucune'];
  const ici = () => !!E && projet === o.cleProjet() && o.actif();
  const feuilleIci = () => !!ouverte && ouverte.isConnected && !!ouverte.firstElementChild && o.feuilleOuverte();
  const surChangement = () => { try { o.surChangement?.(); } catch { /* l'app redessine plus tard */ } };

  // ——— l'état ———
  /** Relit l'état de la voix off du projet ouvert. Rien ne part chez une IA : l'avis se calcule sur l'ordinateur. */
  async function charger() {
    if (!o.actif()) return null;
    if (charge) { relire = true; return charge; }
    const cle = o.cleProjet();
    const d = String(o.demande?.() ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
    charge = (async () => {
      try {
        const r = await api('GET', `/api/voix-off${d ? `?demande=${encodeURIComponent(d)}` : ''}`);
        if (o.cleProjet() === cle && o.actif()) poser(r, cle);
      } catch { /* pas de réponse : on réessaiera */ }
    })();
    try { await charge; } finally { charge = null; }
    if (relire) { relire = false; return charger(); }
    return E;
  }
  /** Un état reçu du serveur (une lecture, ou la réponse d'une route) : le micro, la carte et la feuille suivent. */
  function poser(r, cle = o.cleProjet()) {
    if (!r || typeof r !== 'object' || !Array.isArray(r.questions)) return;
    const avant = projet === cle ? E : null;
    E = r;
    projet = cle;
    clearTimeout(minuterie);
    // l'IA prépare les questions, ou Whisper écrit une réponse dite : on suit
    if (E.suivi?.etat === 'en_cours') minuterie = setTimeout(charger, 1200);
    else if (E.questions.some((q) => q.reponse?.media?.en_cours)) minuterie = setTimeout(charger, 2500);
    if (avant) annoncer(avant);
    majMicro();
    rendreFeuille();
    surChangement();
  }
  /** Ce qui vient d'arriver, dit en une note : les questions prêtes, celles de l'IA de montage, le texte à lire. */
  function annoncer(avant) {
    const qui = o.nomIA();
    if (avant.suivi?.etat === 'en_cours' && E.suivi?.etat !== 'en_cours') {
      if (E.suivi?.etat === 'fini' && !feuilleIci()) note('Tes questions de voix off sont prêtes : réponds-y par écrit ou au micro.', false, true);
      else if (E.suivi?.etat === 'erreur' && !/^Arrêté/.test(E.suivi.erreur ?? '')) note(E.suivi.erreur || 'Les questions n’ont pas pu être préparées.', true);
    }
    const nouvelles = E.questions.filter((q) => q.source === 'montage' && !avant.questions.some((x) => x.id === q.id)).length;
    const texte = !avant.texte && !!E.texte && (E.choix === 'moi' || !E.choix);
    if (nouvelles && texte) note(`${qui} a écrit le texte de ta voix off et te pose ${pluriel(nouvelles, 'question')} : le micro s’est allumé.`, false, true);
    else if (nouvelles) note(`${qui} te pose ${pluriel(nouvelles, 'question')} pour ta voix off : le micro s’est allumé. Réponds par écrit ou au micro.`, false, true);
    else if (texte) note('Le texte de ta voix off est prêt : enregistre-toi en le lisant (le bouton du micro).', false, true);
  }
  /**
   * Après un envoi (réponse, choix) : l'état rendu par la route, ou relu avec la demande en cours quand il y en a une
   * (l'avis en dépend : sans elle, le micro pourrait s'éteindre puis se rallumer).
   */
  async function suivre(r) {
    if (String(o.demande?.() ?? '').trim()) return charger();
    return poser(r?.voix_off);
  }
  const signatureMedias = (medias) => JSON.stringify((medias ?? []).map((m) => [m.id, m.etat, m.transcription?.cree_le ?? null, m.etapes?.texte ?? null, m.etapes?.analyse ?? null]));
  const signatureDessus = (s) => JSON.stringify((s ?? []).filter((x) => x?.voix_off).map((x) => x.media));
  /** Un autre projet s'ouvre (ou aucun) : on repart de rien. */
  function oublier(P = null) {
    clearTimeout(minuterie);
    clearTimeout(attente);
    clearInterval(horloge);
    for (const t of envois.values()) clearTimeout(t);
    envois.clear();
    ecrits.clear();
    if (prise) { const p = prise; prise = null; p.ctl.annuler().catch(() => {}); }
    try { lecteur.pause(); } catch { /* rien à arrêter */ }
    Object.assign(lecteur.dataset, {media: ''});
    E = null;
    projet = null;
    vue = 'auto';
    masquee = null;
    range = null;
    signeFeuille = '';
    demandeEnvoyee = '';
    signeMedias = P ? signatureMedias(P.medias) : null;
    signeDessus = P ? signatureDessus(P.superpositions) : null;
    majMicro();
  }
  /** Les médias ont changé (un import, un texte écrit par Whisper, une analyse) : l'avis aussi, peut-être. */
  function surMedias(medias) {
    const s = signatureMedias(medias);
    if (s === signeMedias) return;
    signeMedias = s;
    if (!E) return; // pas encore lu : la première lecture viendra
    clearTimeout(attente);
    attente = setTimeout(charger, 900);
  }
  /** Le montage est enregistré : une voix off posée (ou retirée) change l'avis. */
  function surSauvegarde(P) {
    const s = signatureDessus(P?.superpositions);
    if (s === signeDessus) return;
    signeDessus = s;
    if (E) charger();
  }

  // ——— le bouton du micro et sa bulle ———
  function majMicro() {
    const b = document.querySelector('#p-medias .enregistrer-grand');
    if (!b) return;
    const ok = ici() && !!E.micro?.allume;
    const pourquoi = ok ? String(E.micro.pourquoi ?? '') : '';
    b.classList.toggle('vo-allume', ok);
    if (b.dataset.titre == null) b.dataset.titre = b.title;
    // « je l'enregistre moi-même » choisi : le micro ne conseille plus, il attend la prise (et dit si le texte est prêt)
    const moi = ok && E.choix === 'moi';
    b.title = ok ? (moi ? pourquoi : `Une voix off est conseillée : ${pourquoi}`) : b.dataset.titre;
    const petit = b.querySelector('small');
    if (petit) {
      if (petit.dataset.texte == null) petit.dataset.texte = petit.textContent;
      petit.textContent = ok ? (moi ? (E.texte ? 'ton texte est prêt' : 'ta voix off t’attend') : 'une voix off est conseillée') : petit.dataset.texte;
    }
    // l'onglet « Médias » le dit aussi, quand on est sur un autre panneau
    document.querySelector('#onglets-gauche [data-panneau="medias"]')?.classList.toggle('vo-point', ok);
    let bulle = b.parentElement?.querySelector(':scope > .vo-bulle');
    if (!ok || masquee === pourquoi) { bulle?.remove(); return; }
    const sans = E.questions.filter((q) => !q.reponse).length;
    const action = E.choix === 'moi' && E.texte ? ['enregistrer', 'micro', 'Enregistrer en lisant mon texte']
      : E.suivi?.etat === 'en_cours' ? ['ouvrir', 'horloge', 'Questions en préparation…']
        : sans ? ['ouvrir', 'dialogue', `Réponds à mes questions (${sans})`]
          : !E.questions.length && !E.choix ? ['ouvrir', 'dialogue', 'Pose-moi des questions'] : null;
    const html = `<div class="vo-bulle-txt">${ic('etincelle', 'plein')}<span>${esc(pourquoi)}</span></div>${action ? `<button class="btn petit" data-vo-bulle="${action[0]}">${ic(action[1])}${esc(action[2])}</button>` : ''}<button class="vo-bulle-x" data-vo-bulle="masquer" title="Masquer cette bulle (le micro reste allumé)">${ic('fermer')}</button>`;
    if (!bulle) {
      bulle = document.createElement('div');
      bulle.className = 'vo-bulle';
      b.after(bulle);
      bulle.addEventListener('click', (e) => {
        const a = e.target.closest('[data-vo-bulle]')?.dataset.voBulle;
        if (a === 'masquer') { masquee = String(E?.micro?.pourquoi ?? ''); return majMicro(); }
        if (a === 'enregistrer') return o.enr.voix();
        if (a === 'ouvrir') return ouvrir();
      });
    }
    if (bulle.dataset.html !== html) { bulle.innerHTML = html; bulle.dataset.html = html; }
  }

  // ——— la carte de la colonne de l'IA ———
  const replies = () => { const l = o.prefs?.lire('voixoff.replies', []); return Array.isArray(l) ? l : []; };
  const estReplie = () => replies().includes(o.cleProjet());
  function replier(oui) {
    const cle = o.cleProjet();
    const l = replies().filter((x) => x !== cle);
    if (oui) l.push(cle);
    o.prefs?.ecrire('voixoff.replies', l.slice(-60));
  }
  /** Les choix : en grand dans la feuille (nom, description, et pourquoi c'est impossible), en puces dans la carte. */
  function choixHtml(complet) {
    const C = E?.choix_possibles ?? {};
    return ORDRE.filter((k) => C[k] && (complet ? k !== 'ia' || C.ia.ok || E.choix === 'ia' : C[k].ok || E.choix === k)).map((k) => {
      const c = C[k];
      const actif = E.choix === k;
      const possible = !!c.ok || actif;
      if (complet) {
        return `<button class="vo-choix${actif ? ' actif' : ''}" data-vo="choix" data-choix="${k}"${possible ? '' : ' disabled'}>${ic(ICONES_CHOIX[k])}<span><b>${esc(c.nom)}</b><small>${esc(possible ? c.description : c.pourquoi ?? c.description)}</small></span>${actif ? `<i class="vo-coche">${ic('coche')}</i>` : ''}</button>`;
      }
      return `<button class="vo-puce${actif ? ' actif' : ''}" data-cl="vo-choix" data-choix="${k}" title="${esc(`${c.nom} : ${c.description}`)}">${ic(ICONES_CHOIX[k])}${esc(CHOIX_COURTS[k])}</button>`;
    }).join('');
  }
  /** La carte « Une voix off ? » (vide quand il n'y a rien à proposer, ou que la personne n'en veut pas). */
  function carte() {
    if (!ici()) return '';
    const et = etapeCarte(E);
    if (et === 'cachee' && !prise) return '';
    const qui = esc(o.nomIA());
    const replie = estReplie() && !prise;
    const titre = ['proposer', 'preparation', 'cachee'].includes(et) ? 'Une voix off ?' : 'Ta voix off';
    const tete = `<div class="vo-carte-tete"><span class="vo-rond${E.micro?.allume ? ' allume' : ''}">${ic('micro')}</span><b>${titre}</b>${replie ? `<small>${esc(resumeCarte(E))}</small>` : ''}<span class="espace"></span><button class="icone-btn" data-cl="vo-replier" title="${replie ? 'Déplier' : 'Replier (la carte reste là)'}">${ic('img-plus', replie ? 'vo-haut' : 'vo-bas')}</button></div>`;
    if (replie) return `<div class="vo-carte replie" data-etape="${et}">${tete}</div>`;
    let corps = prise && !feuilleIci() ? `<div class="vo-prise-ligne"><span class="vo-voyant"></span><span>Ta réponse s’enregistre…</span><span class="espace"></span><button class="btn rouge petit" data-cl="vo-stop">${ic('stop', 'plein')}Arrêter</button></div>` : '';
    const puces = () => { const h = choixHtml(false); return h ? `<small class="vo-qui">Qui fait la voix off ?</small><div class="vo-puces">${h}</div>` : ''; };
    const n = E.questions.length;
    const r = E.repondues ?? 0;
    const changer = '<button class="btn petit lien" data-cl="vo-changer" title="Revenir au choix">Changer</button>';
    if (et === 'proposer') {
      corps += `<p>${esc(E.micro?.pourquoi ?? E.avis?.pourquoi ?? '')}</p>
        <div class="vo-act"><button class="btn principal petit" data-cl="vo-ouvrir">${ic('dialogue')}Pose-moi des questions</button></div>${puces()}`;
    } else if (et === 'preparation') {
      corps += `<p class="vo-ligne"><span class="vo-tourne"></span><span>${esc(E.suivi?.etapes?.at(-1)?.texte ?? `${o.nomIA()} prépare tes questions…`)}</span></p>
        <div class="vo-act"><button class="btn petit" data-cl="vo-ouvrir">Suivre</button><button class="btn petit" data-cl="vo-arreter">Arrêter</button></div>`;
    } else if (et === 'questions') {
      const fini = r >= n;
      corps += `<p>${fini ? 'Tu as répondu à tout : choisis qui fait la voix off.' : `${qui} te pose ${pluriel(n, 'question')} sur des moments de tes rushes. Réponds par écrit ou au micro.`}</p>
        <div class="vo-act"><button class="btn ${fini ? '' : 'principal '}petit" data-cl="vo-ouvrir">${ic('dialogue')}${fini ? 'Revoir mes réponses' : 'Réponds à mes questions'}<span class="vo-compte">${r}/${n}</span></button></div>${puces()}`;
    } else if (et === 'choisi') {
      if (E.choix === 'moi' && E.texte) {
        corps += `<p>Ton texte est prêt : ${pluriel(E.texte.moments, 'moment')}, ${dureeParlee(E.texte.lecture_s)} à lire. Il défile pendant que tu parles.</p>
          <div class="vo-act"><button class="btn rouge petit" data-cl="vo-enregistrer">${ic('micro')}Enregistrer en le lisant</button>${changer}</div>`;
      } else if (E.choix === 'moi') {
        corps += `<p>Tu l’enregistres toi-même. ${qui} peut écrire le texte à lire, moment par moment, avec tes réponses : il s’affichera pendant que tu parles.</p>
          <div class="vo-act"><button class="btn principal petit" data-cl="vo-demander" data-quoi="texte">${ic('etincelle', 'plein')}Demander le texte</button><button class="btn petit" data-cl="vo-enregistrer">${ic('micro')}Sans texte</button>${changer}</div>`;
      } else if (E.choix === 'reponses') {
        corps += `<p>Tes réponses dites au micro feront la voix off : ${qui} les posera sur les images dont elles parlent, avec tes mots.</p>
          <div class="vo-act"><button class="btn principal petit" data-cl="vo-demander" data-quoi="reponses">${ic('etincelle', 'plein')}Demander le montage</button><button class="btn petit" data-cl="vo-ouvrir">Mes réponses</button>${changer}</div>`;
      } else if (E.elevenlabs) {
        corps += `<p>${qui} écrira ta voix off avec tes réponses et la fera dire par une voix ElevenLabs.</p>
          <div class="vo-act"><button class="btn principal petit" data-cl="vo-demander" data-quoi="ia">${ic('etincelle', 'plein')}Demander la voix off</button>${changer}</div>`;
      } else {
        corps += `<p class="vo-attention">${ic('attention')}<span>ElevenLabs n’est plus branché : branche-le dans Connexions, ou choisis une autre façon de faire ta voix off.</span></p>
          <div class="vo-act"><button class="btn petit" data-cl="vo-connexions">Connexions</button>${changer}</div>`;
      }
      corps += `<small class="vo-saura">${qui} reçoit ton choix avec ta prochaine demande.</small>`;
    } else if (et === 'posee') {
      corps += `<p>Ta voix off est dans ton montage. ${qui} peut remonter tes images sur ce que tu dis.</p>
        <div class="vo-act"><button class="btn principal petit" data-cl="vo-demander" data-quoi="posee">${ic('etincelle', 'plein')}Monte sur ma voix</button></div>`;
    }
    return `<div class="vo-carte" data-etape="${et}">${tete}${corps}</div>`;
  }
  /** Ce qui change l'affichage de la carte (pour la clé de la colonne de l'IA). */
  function signature() {
    if (!ici()) return null;
    return [etapeCarte(E), estReplie(), !!E.micro?.allume, E.micro?.pourquoi ?? '', E.questions.length, E.repondues ?? 0, E.choix ?? '', !!E.elevenlabs,
      E.texte?.moments ?? 0, E.texte?.lecture_s ?? 0, E.suivi?.etat ?? '', E.suivi?.etapes?.at(-1)?.texte ?? '', Object.values(E.choix_possibles ?? {}).map((c) => !!c.ok),
      !!prise, E.questions.filter((q) => !q.reponse).length];
  }
  /** Les clics de la carte (data-cl « vo-… », renvoyés par la colonne de l'IA). */
  async function clic(act, el) {
    try {
      if (act === 'vo-replier') { replier(!estReplie()); return surChangement(); }
      if (act === 'vo-ouvrir') return ouvrir();
      if (act === 'vo-choix') return await choisir(el?.dataset.choix);
      if (act === 'vo-changer') return await suivre(await api('POST', '/api/voix-off/choix', {choix: null}));
      if (act === 'vo-arreter') return await arreterQuestions();
      if (act === 'vo-demander') { const t = DEMANDES_VOIX_OFF[el?.dataset.quoi]; if (t) o.demanderIA(t); return; }
      if (act === 'vo-enregistrer') return o.enr.voix();
      if (act === 'vo-stop') return await finirPrise(true);
      if (act === 'vo-connexions') return o.connexions?.();
    } catch (err) { note(err.message, true); }
  }
  async function choisir(k) {
    if (!E || !ORDRE.includes(k) || E.choix === k) return;
    const dansLaFeuille = feuilleIci(); // la feuille montre déjà le choix coché : pas de note en plus
    await suivre(await api('POST', '/api/voix-off/choix', {choix: k}));
    if (k === 'aucune') note('C’est noté : pas de voix off pour ce projet. Tu peux changer d’avis dans le menu « … » de la colonne de l’IA (Voix off).');
    else if (!dansLaFeuille) note(`C’est noté : ${o.nomIA()} le saura à ta prochaine demande.`);
  }
  async function arreterQuestions() {
    try { await api('POST', '/api/voix-off/questions/arreter'); } catch (err) { note(err.message, true); }
    await charger();
  }

  // ——— la feuille « Ta voix off » ———
  /** Ouvre la feuille : ce que l'IA lira (s'il n'y a pas encore de questions), sinon les questions et le choix. */
  function ouvrir({envoi = false} = {}) {
    if (!o.actif()) return;
    vue = envoi ? 'envoi' : 'auto';
    const f = feuille('<h3>Ta voix off</h3><p class="sous-titre">Un instant…</p>', true);
    f.classList.add('vo-feuille');
    ouverte = f;
    signeFeuille = '';
    vueVue = '';
    // une réponse en cours d'enregistrement ne se perd pas en fermant ; les réponses tapées partent avant
    f.avantFermeture = () => {
      if (prise) { note('Ta réponse s’enregistre : arrête-la (ou annule-la) d’abord.', true); return false; }
      for (const id of [...envois.keys()]) envoyerTexte(id);
      try { lecteur.pause(); } catch { /* rien à arrêter */ }
      return true;
    };
    f.addEventListener('click', clicFeuille);
    f.addEventListener('input', saisie);
    f.addEventListener('change', (e) => { const id = e.target.dataset?.voTexte; if (id) envoyerTexte(id); });
    rendreFeuille(true);
    charger();
  }
  function signatureFeuille() {
    if (!E) return 'rien';
    return JSON.stringify([vue, !!o.iaPrete?.(), E.envoi, E.suivi?.etat ?? null, (E.suivi?.etapes ?? []).length, E.suivi?.erreur ?? null, E.fil, E.choix, !!E.elevenlabs,
      Object.entries(E.choix_possibles ?? {}).map(([k, c]) => [k, !!c.ok]), E.avis?.pourquoi,
      E.questions.map((q) => [q.id, q.texte, q.pourquoi, q.source, q.moment, q.reponse?.media ?? null]), prise?.q ?? null, range]);
  }
  const ajuster = (ta) => { ta.style.height = 'auto'; ta.style.height = `${Math.min(220, ta.scrollHeight + 2)}px`; };
  /** Redessine la feuille si ce qu'elle montre a changé ; jamais pendant qu'on écrit (le texte tapé reste, le curseur aussi). */
  function rendreFeuille(force = false) {
    if (!feuilleIci()) return;
    const s = signatureFeuille();
    if (!force && s === signeFeuille) return majPetits();
    signeFeuille = s;
    const actifEl = document.activeElement;
    const focus = ouverte.contains(actifEl) ? actifEl?.dataset?.voTexte ?? (actifEl?.hasAttribute?.('data-vo-demande') ? '§demande' : null) : null;
    const sel = focus ? [actifEl.selectionStart, actifEl.selectionEnd] : null;
    const demande = ouverte.querySelector('[data-vo-demande]')?.value;
    const haut = ouverte.scrollTop;
    ouverte.innerHTML = htmlFeuille(demande);
    // une vue nouvelle entre en glissant ; un simple redessin (une réponse arrivée, un choix) ne rejoue rien
    const vueIci = !E ? 'rien' : E.suivi?.etat === 'en_cours' ? 'preparation' : vue === 'envoi' || !E.questions.length ? 'envoi' : 'questions';
    if (vueIci !== vueVue) {
      vueVue = vueIci;
      const f = ouverte;
      f.classList.add('vo-entree');
      clearTimeout(finEntree);
      finEntree = setTimeout(() => f.classList.remove('vo-entree'), 900);
    }
    ouverte.scrollTop = haut;
    for (const ta of ouverte.querySelectorAll('[data-vo-texte]')) ajuster(ta);
    if (focus) {
      const z = focus === '§demande' ? ouverte.querySelector('[data-vo-demande]') : ouverte.querySelector(`[data-vo-texte="${CSS.escape(focus)}"]`);
      if (z) { z.focus(); try { z.setSelectionRange(...sel); } catch { /* champ sans curseur */ } }
    }
    if (prise) { prise.ctl.niveau(ouverte.querySelector('[data-vo-niveau]')); majChrono(); }
    majLecteur();
    majPetits();
  }
  /** Les petites choses qui bougent sans tout redessiner : le compte des réponses, les questions répondues. */
  function majPetits() {
    if (!feuilleIci() || !E) return;
    let r = 0;
    for (const q of E.questions) {
      const li = ouverte.querySelector(`[data-q="${CSS.escape(q.id)}"]`);
      const txt = ecrits.has(q.id) ? ecrits.get(q.id).trim() : q.reponse?.texte ?? '';
      const ok = !!(txt || (q.reponse?.media && !q.reponse.media.retire));
      if (ok) r++;
      li?.classList.toggle('repondue', ok);
    }
    const c = ouverte.querySelector('[data-vo-compte]');
    if (c) c.textContent = `${r}/${E.questions.length}`;
  }
  function htmlFeuille(demandeTapee) {
    const qui = esc(o.nomIA());
    if (!E) return `<h3>Ta voix off</h3><p class="sous-titre">Un instant…</p><div class="pied"><span class="espace"></span><button class="btn" data-fermer>Fermer</button></div>`;
    if (E.suivi?.etat === 'en_cours') return htmlPreparation(qui);
    if (vue === 'envoi' || !E.questions.length) return htmlEnvoi(qui, demandeTapee);
    return htmlQuestions(qui);
  }
  /** Avant les questions : ce que fait l'IA, et ce qu'elle lira (rien d'autre ne part). */
  function htmlEnvoi(qui, demandeTapee) {
    const v = E.envoi ?? {rushes: 0, planches: 0, textes: 0};
    const demande = demandeTapee ?? (E.demande || String(o.demande?.() ?? '').trim());
    const erreur = E.suivi?.etat === 'erreur' && !/^Arrêté/.test(E.suivi.erreur ?? '') ? `<p class="vo-erreur">${ic('attention')}<span>${esc(E.suivi.erreur)}</span></p>` : '';
    const puces = [
      `<span>${ic('film')}<b>${pluriel(v.rushes, 'rush', 'rushes')}</b><small>dates, heures, lieux, ce qu’on y voit</small></span>`,
      v.planches ? `<span>${ic('image')}<b>${pluriel(v.planches, 'planche')} d’images</b><small>12 images d’un rush</small></span>` : '',
      v.textes ? `<span>${ic('texte')}<b>${pluriel(v.textes, 'texte')}</b><small>ce qui est dit dans tes rushes</small></span>` : '',
    ].join('');
    const refus = E.choix === 'aucune';
    const pret = !!o.iaPrete?.();
    return `<div class="vo-envoi"><div class="vo-ill">${ill('voix')}</div><div>
        <h3>Des questions pour ta voix off</h3>
        <p class="sous-titre">${qui} regarde ce que Dérush sait de tes rushes et te pose 3 à 6 questions sur des moments précis : où tu étais, ce que tu as ressenti, ce qui s’est passé juste avant ou après. Tu réponds par écrit ou au micro, et tes réponses deviennent ta voix off.</p></div></div>
      ${E.avis?.conseillee ? `<p class="vo-avis">${ic('etincelle', 'plein')}<span>${esc(E.avis.pourquoi)}</span></p>` : ''}
      ${refus ? `<div class="vo-choix-bloc"><h4>Tu as choisi de te passer de voix off</h4><div class="vo-choix-liste">${choixHtml(true)}</div></div>` : ''}
      <label class="champ"><span>Ce que tu veux faire (facultatif)</span><input data-vo-demande maxlength="500" value="${esc(demande)}" placeholder="Exemple : un vlog de ma journée du vendredi à Kyoto"></label>
      <div class="vo-lira"><b>Ce que ${qui} lira, et rien d’autre</b><div class="vo-lira-puces">${puces}</div>
        <small>${ic('cadenas')}Ni tes vidéos, ni internet, ni tes comptes. Rien n’est modifié ni publié.</small></div>
      ${erreur}
      <div class="pied">${E.questions.length ? '<button class="btn" data-vo="retour">Revenir à mes questions</button>' : '<button class="btn" data-fermer>Plus tard</button>'}<span class="espace"></span>
        ${pret ? `<button class="btn principal" data-vo="preparer"${v.rushes && !refus ? '' : ' disabled'}>${ic('etincelle', 'plein')}Préparer mes questions</button>` : `<button class="btn bleu" data-vo="connexions">${ic('prise')}Brancher mon IA</button>`}</div>`;
  }
  /** Pendant que l'IA prépare : ce qu'elle fait, étape par étape. */
  function htmlPreparation(qui) {
    const etapes = (E.suivi?.etapes ?? []).slice(-6);
    const pour = demandeEnvoyee || E.demande;
    return `<div class="vo-envoi"><div class="vo-ill vo-anime">${ill('voix')}</div><div>
        <h3>${qui} prépare tes questions</h3>
        <p class="sous-titre">Il lit ce que Dérush sait de tes rushes${pour ? ` pour « ${esc(pour)} »` : ''}. Tu peux fermer cette fenêtre : la carte de la colonne de l’IA te dira quand elles sont prêtes.</p></div></div>
      <ul class="vo-etapes">${etapes.length ? etapes.map((x, k) => `<li class="${k === etapes.length - 1 ? 'ici' : ''}">${ic(/^[a-z-]{2,20}$/.test(x.icone ?? '') ? x.icone : 'etincelle')}<span>${esc(x.texte)}</span><small>${Number(x.t) || 0} s</small></li>`).join('') : `<li class="ici">${ic('etincelle')}<span>${qui} se prépare…</span></li>`}</ul>
      <div class="pied"><button class="btn" data-vo="arreter">Arrêter</button><span class="espace"></span><button class="btn principal" data-fermer>Fermer</button></div>`;
  }
  /** Les questions, chacune avec son moment, une réponse écrite ou dite ; puis le choix. */
  function htmlQuestions(qui) {
    return `<h3>Ta voix off</h3>
      <p class="sous-titre">Réponds par écrit ou au micro, dans l’ordre que tu veux (<b data-vo-compte>${E.repondues ?? 0}/${E.questions.length}</b>). Tes réponses sont la matière de ta voix off : ce que tu as vécu, avec tes mots.</p>
      ${E.fil ? `<div class="vo-fil"><b>${ic('etincelle', 'plein')}Le fil proposé</b><p class="selectionnable">${esc(E.fil)}</p></div>` : ''}
      <ol class="vo-questions">${E.questions.map((q, k) => htmlQuestion(q, k, qui)).join('')}</ol>
      <div class="vo-choix-bloc"><h4>Qui fait la voix off ?</h4><div class="vo-choix-liste">${choixHtml(true)}</div><small>${qui} reçoit ton choix avec ta prochaine demande : rien ne part tout de suite.</small></div>
      <div class="pied"><button class="btn lien" data-vo="oublier" title="Oublier les questions, tes réponses écrites et ton choix (tes enregistrements restent dans tes médias)">Tout oublier</button><button class="btn" data-vo="nouvelles">${ic('etincelle')}D’autres questions</button><span class="espace"></span><button class="btn principal" data-fermer>C’est bon</button></div>`;
  }
  function htmlQuestion(q, k, qui) {
    const valeur = ecrits.has(q.id) ? ecrits.get(q.id) : q.reponse?.texte ?? '';
    return `<li class="vo-q" data-q="${esc(q.id)}">
      <div class="vo-q-tete"><span class="vo-num">${k + 1}</span><b class="selectionnable">${esc(q.texte)}</b>${q.source === 'montage' ? `<span class="vo-source" title="Posée par ${qui} à la fin de son montage">${ic('etincelle', 'plein')}montage</span>` : ''}</div>
      ${momentHtml(q)}
      ${q.pourquoi ? `<small class="vo-pourquoi">${esc(q.pourquoi)}</small>` : ''}
      <textarea data-vo-texte="${esc(q.id)}" rows="2" spellcheck="true" maxlength="4000" placeholder="Ta réponse, avec tes mots…">${esc(valeur)}</textarea>
      <div class="vo-dit">${ditHtml(q)}</div></li>`;
  }
  /** Le moment que la question éclaire : une vignette du rush à cet instant (un clic le rejoue ici), la date de prise. */
  function momentHtml(q) {
    const m0 = q.moment?.medias?.[0];
    if (!m0) return '';
    const debut = Number.isFinite(q.moment.debut) ? q.moment.debut : null;
    const fin = Number.isFinite(q.moment.fin) ? q.moment.fin : null;
    const autres = q.moment.medias.length - 1;
    return `<div class="vo-moment"><button class="vo-vig" data-vo="voir" data-media="${esc(m0.id)}" data-debut="${debut ?? ''}" data-fin="${fin ?? ''}" title="Revoir ce moment">${o.vignette?.(m0.id, debut ?? 0, 54) ?? ic('film')}<span class="vo-vig-lire">${ic('lire', 'plein')}</span></button>
      <span class="vo-moment-txt">${q.moment.quand ? `<b>${esc(q.moment.quand)}</b>` : ''}<small>${esc(m0.nom ?? m0.id)}${debut != null ? ` · ${minSec(debut)} – ${minSec(fin ?? debut)}` : ''}${autres > 0 ? ` · et ${pluriel(autres, 'autre')}` : ''}</small></span></div>`;
  }
  /** La réponse dite : le bouton du micro, la prise en cours, ou l'enregistrement (à écouter) et ce que Whisper y a lu. */
  function ditHtml(q) {
    if (prise?.q === q.id) {
      return `<div class="vo-prise"><span class="vo-voyant"></span><span class="vo-temps" data-vo-temps>0:00</span><div class="enr-niveau" data-vo-niveau title="Le niveau de ta voix"><i></i></div><button class="btn petit" data-vo="annuler-prise">Annuler</button><button class="btn rouge petit" data-vo="stop">${ic('stop', 'plein')}Arrêter</button></div>`;
    }
    if (range === q.id) return '<div class="vo-prise range"><span class="vo-tourne"></span><span>Dérush range ta réponse…</span></div>';
    const m = q.reponse?.media;
    const occupe = prise || range ? ' disabled' : '';
    if (m && !m.retire) {
      const dit = m.texte ? `« ${esc(m.texte)} »` : m.en_cours ? '<span class="vo-tourne"></span>Dérush écrit ce que tu as dit…' : 'Dérush n’a pas pu écrire ce que tu as dit (installe Whisper dans les Réglages) : ta réponse compte quand même.';
      return `<div class="vo-ecoute"><button class="btn petit" data-vo="ecouter" data-media="${esc(m.id)}" title="Écouter ta réponse">${ic('lire', 'plein')}Écouter · ${minSec(m.duree_s)}</button><span class="vo-transcrit${m.texte ? ' selectionnable' : ''}">${dit}</span>
        <button class="icone-btn" data-vo="micro" data-q="${esc(q.id)}" title="Refaire au micro"${occupe}>${ic('micro')}</button><button class="icone-btn" data-vo="retirer" data-q="${esc(q.id)}" title="Retirer cet enregistrement de la réponse (il reste dans tes médias)"${occupe}>${ic('fermer')}</button></div>`;
    }
    return `${m?.retire ? '<small class="vo-retire">L’enregistrement de cette réponse n’est plus dans le projet.</small>' : ''}<button class="btn petit vo-dire" data-vo="micro" data-q="${esc(q.id)}"${occupe}>${ic('micro')}Répondre au micro</button>`;
  }
  async function clicFeuille(e) {
    if (e.target.closest('[data-fermer]')) return fermerFeuille();
    const b = e.target.closest('[data-vo]');
    const a = b?.dataset.vo;
    if (!a || b.disabled) return;
    try {
      if (a === 'preparer') return await preparer(b);
      if (a === 'arreter') return await arreterQuestions();
      if (a === 'retour') { vue = 'auto'; return rendreFeuille(true); }
      if (a === 'nouvelles') { vue = 'envoi'; return rendreFeuille(true); }
      if (a === 'connexions') { fermerFeuille(); return o.connexions?.(); }
      if (a === 'choix') return await choisir(b.dataset.choix);
      if (a === 'micro') return await direAuMicro(b.dataset.q);
      if (a === 'stop') return await finirPrise(true);
      if (a === 'annuler-prise') return await finirPrise(false);
      if (a === 'retirer') return await suivre(await api('POST', '/api/voix-off/reponses', {question: b.dataset.q, media: null}));
      if (a === 'ecouter') return ecouter(b);
      if (a === 'voir') return voir(b);
      if (a === 'oublier') return await toutOublier();
    } catch (err) { note(err.message, true); }
  }
  /** « Préparer mes questions » : le seul clic qui lance une IA ici (légère, sans web ni terminal, dans un dossier à part). */
  async function preparer(b) {
    const demande = String(ouverte?.querySelector('[data-vo-demande]')?.value ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
    b.disabled = true;
    try {
      // les réponses tapées partent d'abord : l'IA ne repose pas une question déjà répondue
      await Promise.all([...envois.keys()].map(envoyerTexte));
      const r = await api('POST', '/api/voix-off/questions', {demande, moteur: o.moteurIA?.() ?? null});
      demandeEnvoyee = demande;
      vue = 'auto';
      if (E) E = {...E, suivi: r.suivi};
      rendreFeuille(true);
      surChangement();
      clearTimeout(minuterie);
      minuterie = setTimeout(charger, 900);
    } catch (err) { b.disabled = false; note(err.message, true); }
  }
  function saisie(e) {
    const id = e.target.dataset?.voTexte;
    if (!id) return;
    ecrits.set(id, e.target.value);
    ajuster(e.target);
    majPetits();
    clearTimeout(envois.get(id));
    envois.set(id, setTimeout(() => envoyerTexte(id), 900));
  }
  /** Une réponse écrite part chez Dérush (un peu après la frappe, ou en quittant le champ). */
  async function envoyerTexte(id) {
    clearTimeout(envois.get(id));
    envois.delete(id);
    if (!ecrits.has(id) || !E) return;
    const texte = ecrits.get(id);
    const q = E.questions.find((x) => x.id === id);
    if (!q || (q.reponse?.texte ?? '') === texte.trim()) return;
    try { await suivre(await api('POST', '/api/voix-off/reponses', {question: id, texte})); } catch (err) { note(err.message, true); }
  }
  /** Répondre au micro : le micro s'ouvre ici même, la prise suit le chemin des enregistrements, rien n'est posé au montage. */
  async function direAuMicro(id) {
    if (prise || range) return note('Une réponse s’enregistre déjà.', true);
    try { lecteur.pause(); } catch { /* rien à arrêter */ }
    const ctl = await o.enr.reponse();
    prise = {q: id, ctl};
    ctl.surErreur(() => finirPrise(true)); // un morceau refusé : ce qui est déjà là est gardé
    clearInterval(horloge);
    horloge = setInterval(majChrono, 250);
    rendreFeuille();
    surChangement();
  }
  function majChrono() {
    const t = prise && ouverte?.querySelector('[data-vo-temps]');
    if (t) t.textContent = minSec(prise.ctl.depuis());
  }
  async function finirPrise(garder) {
    const p = prise;
    if (!p) return;
    prise = null;
    clearInterval(horloge);
    if (!garder) {
      await p.ctl.annuler().catch(() => {});
      rendreFeuille();
      surChangement();
      return note('La réponse est jetée.');
    }
    range = p.q;
    rendreFeuille();
    surChangement();
    try {
      const r = await p.ctl.arreter();
      if (!r?.media) throw new Error('L’enregistrement est vide : réessaie.');
      const x = await api('POST', '/api/voix-off/reponses', {question: p.q, media: r.media});
      range = null;
      o.relireMedias?.();
      await suivre(x);
      // la feuille montre la réponse (et « Dérush écrit ce que tu as dit… ») ; une note seulement si elle est fermée
      if (!feuilleIci()) note('Ta réponse est gardée : elle est dans la feuille de ta voix off, et dans tes médias.');
    } catch (err) {
      range = null;
      rendreFeuille();
      surChangement();
      if (!err?.dit) note(err.message, true);
    }
  }
  const majLecteur = () => { for (const x of ouverte?.querySelectorAll('[data-vo="ecouter"]') ?? []) x.classList.toggle('lit', x.dataset.media === lecteur.dataset.media && !lecteur.paused); };
  for (const ev of ['play', 'pause', 'ended']) lecteur.addEventListener(ev, majLecteur);
  function ecouter(b) {
    const id = b.dataset.media;
    if (lecteur.dataset.media === id && !lecteur.paused) return lecteur.pause();
    lecteur.src = o.urlMedia(id, 'lecture');
    lecteur.dataset.media = id;
    lecteur.play().catch(() => note('Cet enregistrement ne se lit pas.', true));
  }
  /** Rejoue le moment dans la feuille : la vignette devient une petite vidéo, du début à la fin du passage. */
  function voir(b) {
    if (b.querySelector('img')) return; // une photo : rien à lire
    const debut = Number(b.dataset.debut) || 0;
    const fin = b.dataset.fin === '' ? null : Number(b.dataset.fin);
    const v = document.createElement('video');
    v.className = 'vo-apercu';
    v.playsInline = true;
    v.preload = 'auto';
    v.title = 'Un clic : lire ou mettre en pause';
    v.src = o.urlMedia(b.dataset.media, 'lecture');
    v.addEventListener('loadedmetadata', () => { v.currentTime = debut; v.play().catch(() => {}); }, {once: true});
    v.addEventListener('timeupdate', () => { if (fin != null && v.currentTime >= fin) v.pause(); });
    v.addEventListener('click', () => {
      if (!v.paused) return v.pause();
      if (fin != null && v.currentTime >= fin - 0.1) v.currentTime = debut;
      v.play().catch(() => {});
    });
    b.replaceWith(v);
  }
  async function toutOublier() {
    if (prise) return note('Arrête d’abord ta réponse.', true);
    if (!window.confirm('Oublier les questions, tes réponses écrites et ton choix de voix off ? Tes enregistrements restent dans tes médias.')) return;
    await api('DELETE', '/api/voix-off');
    for (const t of envois.values()) clearTimeout(t);
    envois.clear();
    ecrits.clear();
    vue = 'auto';
    await charger();
    note('La voix off de ce projet est oubliée.');
  }

  // ——— pour l'enregistreur : le conseil qui allume « Ma voix », le texte à lire ———
  function conseil() {
    if (!ici()) return null;
    return {allume: !!E.micro?.allume, pourquoi: String(E.micro?.pourquoi ?? ''), questions: E.questions.filter((q) => !q.reponse).length,
      sansQuestions: !E.questions.length && !E.choix && E.suivi?.etat !== 'en_cours', texte: !!E.texte && (E.choix === 'moi' || !E.choix)};
  }
  /** Le texte à lire pendant l'enregistrement : seulement si la personne l'enregistre elle-même (ou n'a pas encore choisi). */
  async function texteALire() {
    if (!ici() || !E.texte || !(E.choix === 'moi' || !E.choix)) return null;
    try { return (await api('GET', '/api/voix-off/texte')).texte ?? null; } catch { return null; }
  }
  async function ecrireTexte(t) {
    const r = await api('POST', '/api/voix-off/texte', t);
    charger();
    return r.texte;
  }
  const questionsOuvertes = () => (ici() ? E.questions.filter((q) => !q.reponse).length : 0);

  return {charger, oublier, poser, carte, clic, ouvrir, signature, majMicro, conseil, texteALire, ecrireTexte, surMedias, surSauvegarde, questionsOuvertes,
    etat: () => E, enPrise: () => !!prise};
}
