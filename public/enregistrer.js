// Dérush — enregistrer sans quitter le logiciel : sa voix (micro), ou soi-même (webcam + micro).
// La voix off se pose pendant que le montage défile : on parle sur ses images. La webcam sert à un podcast ou à un face
// caméra. L'enregistrement part chez Dérush morceau par morceau (voir lib/enregistrement.mjs), puis apparaît dans les
// médias. Rien ne sort de l'ordinateur.
//
// creerEnregistreur(o) → {ouvrir(), voix(), camera(), actif()}
//   o.api(methode, url, corps)      les appels à Dérush
//   o.poster(url, blob)             l'envoi d'un morceau (corps brut)
//   o.feuille(html, large) / o.fermerFeuille() / o.note(texte, erreur) / o.ic(nom) / o.esc(texte)
//   o.lecture = {t(), lire(), pause(), sourdine(oui), aDuMontage()}   la tête de lecture du montage
//   o.surFini({genre, media, debut, poser})   l'enregistrement est dans les médias : à l'app de le poser
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

export function creerEnregistreur(o) {
  const {api, poster, feuille, fermerFeuille, note, ic, esc, lecture, surFini} = o;
  let actif = null; // {genre, flux, rec, id, …} pendant qu'on enregistre ou qu'on prépare

  const arreterFlux = (flux) => { for (const p of flux?.getTracks?.() ?? []) { try { p.stop(); } catch { /* déjà arrêtée */ } } };
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
    return () => { tourne = false; try { ctx?.close(); } catch { /* déjà fermé */ } };
  }
  /** Lance l'enregistreur : chaque morceau part chez Dérush dans l'ordre. Renvoie {arreter() → {media…}, annuler()}. */
  async function demarrer(genre, flux) {
    const mime = formatDe(genre === 'camera');
    const rec = new MediaRecorder(flux, {...(mime ? {mimeType: mime} : {}), audioBitsPerSecond: 192000, ...(genre === 'camera' ? {videoBitsPerSecond: 8000000} : {})});
    const {id} = await api('POST', '/api/enregistrements', {genre, mime: rec.mimeType || mime});
    let n = 0;
    let chaine = Promise.resolve();
    let erreur = null;
    rec.ondataavailable = (ev) => {
      if (!ev.data?.size) return;
      const k = n++;
      chaine = chaine.then(() => (erreur ? null : poster(`/api/enregistrements/${id}/morceau?n=${k}`, ev.data))).catch((e) => { erreur = erreur ?? e; });
    };
    const fini = new Promise((ok) => { rec.onstop = ok; rec.onerror = (ev) => { erreur = erreur ?? ev.error ?? new Error('L’enregistrement s’est arrêté.'); ok(); }; });
    rec.start(2000);
    return {
      async arreter() {
        if (rec.state !== 'inactive') rec.stop();
        await fini;
        await chaine;
        if (erreur) { api('DELETE', `/api/enregistrements/${id}`).catch(() => {}); throw erreur; }
        return api('POST', `/api/enregistrements/${id}/fin`);
      },
      async annuler() {
        if (rec.state !== 'inactive') rec.stop();
        await fini;
        api('DELETE', `/api/enregistrements/${id}`).catch(() => {});
      },
    };
  }

  // ——— la voix off : un petit panneau posé sous l'écran, pendant que le montage défile ———
  async function voix() {
    if (actif) return;
    fermerFeuille();
    document.querySelector('#enr')?.remove();
    const montage = lecture.aDuMontage();
    const p = document.createElement('div');
    p.id = 'enr';
    p.className = 'enr';
    p.innerHTML = `<div class="enr-tete"><span class="enr-voyant"></span><b>Voix off</b><span class="enr-temps" id="enr-temps">00:00</span><span class="espace"></span><button class="icone-btn" data-enr="fermer" title="Fermer">${ic('fermer')}</button></div>
      <div class="enr-corps"><div class="enr-niveau" id="enr-niveau" title="Le niveau de ta voix"><i></i></div>
        <select id="enr-micro" title="Choisir le micro"></select>
        ${montage ? `<label class="enr-option"><input type="checkbox" id="enr-lire" checked><span>Lire mon montage pendant que je parle</span></label>
        <label class="enr-option"><input type="checkbox" id="enr-couper" checked><span>Couper son son (sans casque, le micro l’entendrait)</span></label>` : ''}
        <p class="enr-aide" id="enr-aide">${montage ? 'Place la tête de lecture là où ta voix doit commencer, puis enregistre.' : 'Enregistre ta voix : elle ira dans tes médias.'}</p></div>
      <div class="enr-pied"><button class="btn rouge" data-enr="go">${ic('micro')}<span>Enregistrer</span></button></div>`;
    document.body.append(p);
    const $ = (s) => p.querySelector(s);
    let flux = null;
    let stopNiveau = () => {};
    let prise = null;
    let debut = 0;
    let depart = 0;
    let horloge = null;
    const fermer = () => { clearInterval(horloge); stopNiveau(); arreterFlux(flux); lecture.sourdine(false); p.remove(); actif = null; };
    const brancher = async (micro = null) => {
      stopNiveau();
      arreterFlux(flux);
      flux = await ouvrirFlux(false, micro);
      stopNiveau = suivreNiveau(flux, $('#enr-niveau'));
      const {micros} = await appareils();
      $('#enr-micro').innerHTML = options(micros, flux.getAudioTracks()[0]?.getSettings?.().deviceId, 'Micro');
    };
    actif = {genre: 'voix'};
    try { await brancher(); } catch (e) { fermer(); return note(raison(e, false), true); }
    $('#enr-micro').addEventListener('change', (e) => brancher(e.target.value).catch((err) => note(raison(err, false), true)));
    p.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-enr]')?.dataset.enr;
      if (a === 'fermer') { if (prise) await prise.annuler().catch(() => {}); if (prise) lecture.pause(); return fermer(); }
      if (a === 'go' && !prise) {
        const bouton = $('[data-enr="go"]');
        bouton.disabled = true;
        try {
          debut = montage ? lecture.t() : 0;
          prise = await demarrer('voix', flux);
          depart = Date.now();
          p.classList.add('en-cours');
          bouton.innerHTML = `${ic('stop', 'plein')}<span>Arrêter</span>`;
          bouton.dataset.enr = 'stop';
          $('#enr-aide').textContent = 'Parle : ta voix s’enregistre.';
          horloge = setInterval(() => { $('#enr-temps').textContent = chrono((Date.now() - depart) / 1000); }, 250);
          if (montage && $('#enr-lire')?.checked) { lecture.sourdine(!!$('#enr-couper')?.checked); lecture.lire(); }
        } catch (err) { prise = null; note(err.message, true); }
        bouton.disabled = false;
        return;
      }
      if (a === 'stop' && prise) {
        const bouton = $('[data-enr="stop"]');
        bouton.disabled = true;
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
        } catch (err) { prise = null; fermer(); note(err.message, true); }
      }
    });
  }

  // ——— la webcam : un podcast, un face caméra ———
  async function camera() {
    if (actif) return;
    const f = feuille(`<h3>Me filmer</h3><p class="sous-titre">Un podcast, un face caméra : ta webcam et ton micro, enregistrés directement dans ton projet. Rien ne sort de ton ordinateur.</p>
      <div class="enr-cam"><video id="enr-video" autoplay muted playsinline></video><span class="enr-cam-temps" id="enr-cam-temps">00:00</span><div class="enr-niveau" id="enr-cam-niveau"><i></i></div></div>
      <div class="deux"><label class="champ"><span>Caméra</span><select id="enr-camera"></select></label><label class="champ"><span>Micro</span><select id="enr-cam-micro"></select></label></div>
      <label class="enr-option"><input type="checkbox" id="enr-ajouter" checked><span>Ajouter l’enregistrement à la suite de mon montage</span></label>
      <div class="pied"><button class="btn" data-enr="annuler">Fermer</button><span class="espace"></span><button class="btn rouge" data-enr="go">${ic('camera')}<span>Enregistrer</span></button></div>`, true);
    const $ = (s) => f.querySelector(s);
    let flux = null;
    let stopNiveau = () => {};
    let prise = null;
    let depart = 0;
    let horloge = null;
    const liberer = () => { clearInterval(horloge); stopNiveau(); arreterFlux(flux); actif = null; };
    const brancher = async (micro = null, cam = null) => {
      stopNiveau();
      arreterFlux(flux);
      flux = await ouvrirFlux(true, micro, cam);
      $('#enr-video').srcObject = flux;
      stopNiveau = suivreNiveau(flux, $('#enr-cam-niveau'));
      const {micros, cameras} = await appareils();
      $('#enr-camera').innerHTML = options(cameras, flux.getVideoTracks()[0]?.getSettings?.().deviceId, 'Caméra');
      $('#enr-cam-micro').innerHTML = options(micros, flux.getAudioTracks()[0]?.getSettings?.().deviceId, 'Micro');
    };
    actif = {genre: 'camera'};
    try { await brancher(); } catch (e) { liberer(); fermerFeuille(); return note(raison(e, true), true); }
    const rebrancher = () => brancher($('#enr-cam-micro').value, $('#enr-camera').value).catch((err) => note(raison(err, true), true));
    $('#enr-camera').addEventListener('change', rebrancher);
    $('#enr-cam-micro').addEventListener('change', rebrancher);
    f.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-enr]')?.dataset.enr;
      if (a === 'annuler') { if (prise) await prise.annuler().catch(() => {}); liberer(); return fermerFeuille(); }
      if (a === 'go' && !prise) {
        const bouton = $('[data-enr="go"]');
        bouton.disabled = true;
        try {
          prise = await demarrer('camera', flux);
          depart = Date.now();
          f.classList.add('enr-en-cours');
          bouton.innerHTML = `${ic('stop', 'plein')}<span>Arrêter</span>`;
          bouton.dataset.enr = 'stop';
          for (const s of [$('#enr-camera'), $('#enr-cam-micro')]) s.disabled = true;
          horloge = setInterval(() => { $('#enr-cam-temps').textContent = chrono((Date.now() - depart) / 1000); }, 250);
        } catch (err) { prise = null; note(err.message, true); }
        bouton.disabled = false;
        return;
      }
      if (a === 'stop' && prise) {
        const bouton = $('[data-enr="stop"]');
        bouton.disabled = true;
        bouton.innerHTML = '<span>Dérush prépare ta vidéo…</span>';
        clearInterval(horloge);
        const ajouter = !!$('#enr-ajouter')?.checked;
        try {
          const r = await prise.arreter();
          prise = null;
          liberer();
          fermerFeuille();
          await surFini({genre: 'camera', media: r.media, debut: 0, poser: ajouter});
        } catch (err) { prise = null; liberer(); fermerFeuille(); note(err.message, true); }
      }
    });
    // la feuille fermée autrement (Échap, clic dehors) : on libère la caméra
    const veille = setInterval(() => { if (!document.body.contains(f)) { clearInterval(veille); if (prise) prise.annuler().catch(() => {}); if (actif?.genre === 'camera') liberer(); } }, 500);
  }

  /** Le choix : ma voix, ou me filmer. */
  function ouvrir() {
    if (actif) return;
    const f = feuille(`<h3>Enregistrer</h3><p class="sous-titre">Sans quitter Dérush : ta voix sur tes images, ou toi devant ta webcam. Tout reste sur ton ordinateur.</p>
      <div class="enr-choix"><button class="enr-carte" data-enr="voix"><span class="enr-rond">${ic('micro')}</span><b>Ma voix</b><small>Une voix off : tu parles pendant que ton montage défile. Ton IA pourra la nettoyer, la sous-titrer, remonter les images dessus.</small></button>
        <button class="enr-carte" data-enr="camera"><span class="enr-rond">${ic('camera')}</span><b>Me filmer</b><small>Un podcast ou un face caméra, avec ta webcam et ton micro. La vidéo arrive tout de suite dans ton projet.</small></button></div>
      <div class="pied"><span class="espace"></span><button class="btn" data-fermer>Fermer</button></div>`);
    f.addEventListener('click', (e) => {
      if (e.target.closest('[data-fermer]')) return fermerFeuille();
      const a = e.target.closest('[data-enr]')?.dataset.enr;
      if (a === 'voix') voix();
      if (a === 'camera') { fermerFeuille(); pause(60).then(camera); }
    });
  }

  return {ouvrir, voix, camera, actif: () => !!actif};
}
