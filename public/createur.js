// Dérush — deux écrans autour du créateur :
//   cr.accueil()   la mise en route, en trois gestes : ton IA, tes réseaux (Treg, conseillé), ton profil de créateur
//   cr.ouvrir()    « Mon profil de créateur » : ce que l'IA a appris de tes comptes, et ce qu'elle en fait
// Le serveur fait le travail (lib/createur.mjs) ; ici, on montre, on lance, on suit.
const RESEAUX = {youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn'};

export function creerCreateur(o) {
  const {api, esc, ic, ill, logo, note} = o;
  let el = null; // l'écran « Mon profil de créateur »
  let S = null; // l'état rendu par le serveur
  let minuterie = null;
  let mot = '';

  const nombre = (n) => (n == null ? '' : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',').replace(',0', '')} M` : n >= 10000 ? `${Math.round(n / 1000)} k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',').replace(',0', '')} k` : String(Math.round(n)));
  const jour = (iso) => new Date(iso).toLocaleDateString('fr-FR', {day: 'numeric', month: 'long'});
  const hote = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

  // ——— Mon profil de créateur ———
  async function charger() {
    try { S = await api('GET', '/api/createur'); } catch (e) { note(e.message, true); }
  }
  function suivre() {
    clearTimeout(minuterie);
    if (!el || S?.analyse?.etat !== 'en_cours') return;
    minuterie = setTimeout(async () => { await charger(); rendre(); suivre(); }, 2000);
  }
  function fermer() {
    clearTimeout(minuterie);
    document.removeEventListener('keydown', echap, true);
    el?.remove();
    el = null;
  }
  function echap(e) { if (el && e.key === 'Escape' && !o.feuilleOuverte?.()) { e.stopPropagation(); fermer(); } }

  const vide = () => {
    const p = S.possible ?? {};
    const bouton = p.ok
      ? `<button class="btn claude grand" data-cr="analyser">${ic('etincelle', 'plein')}<span>Analyser mon profil</span></button><small class="pa-avec">${esc(p.note ?? `Avec ${o.nomIA()}. Compte 5 à 10 minutes.`)}</small>`
      : `<button class="btn bleu grand" data-cr="${p.raison === 'ia' ? 'connexions' : 'relier'}">${ic(p.raison === 'ia' ? 'prise' : 'relais')}<span>${p.raison === 'ia' ? 'Brancher mon IA' : 'Relier mes réseaux'}</span></button><small class="pa-avec">${esc(p.pourquoi ?? '')}</small>`;
    return `<div class="pa-vide cr-vide">
      <div class="cr-eventail">${['youtube', 'instagram', 'tiktok'].map((k, i) => `<span style="--i:${i}">${logo(k, 46)}</span>`).join('')}</div>
      <h2>Ton IA apprend à te connaître</h2>
      <p>Elle lit tes vidéos déjà publiées et leurs chiffres, repère celles qui ont vraiment marché, regarde tes miniatures, lit tes commentaires. Ensuite, chaque montage, chaque titre et chaque conseil est fait pour toi.</p>
      <ul class="cr-promesses">
        <li>${ic('eclair')}<span><b>Ce qui marche chez toi</b>Tes vidéos classées par écart à ta moyenne, pas par vues brutes.</span></li>
        <li>${ic('image')}<span><b>Ton style</b>Ton ton, ton rythme, ta direction artistique, tes accroches.</span></li>
        <li>${ic('baguette')}<span><b>Des montages sur mesure</b>Ton IA relit ce profil avant chaque vidéo.</span></li>
      </ul>
      <label class="champ cr-mot"><span>Un mot sur toi (facultatif)</span><textarea data-cr-mot rows="2" placeholder="Exemple : je fais des reviews de mangas, je veux plus d’abonnés sur YouTube Shorts.">${esc(mot)}</textarea></label>
      ${bouton}
      <p class="cr-rassure">${ic('cadenas')}<span>Lecture seule : rien n’est publié, commenté ni modifié sur tes comptes. Le profil reste sur ton ordinateur.</span></p>
    </div>`;
  };
  const travail = (a) => {
    const etapes = (a.etapes ?? []).slice(-9);
    return `<div class="pa-travail"><div class="pa-bobine">${ill('bobine')}</div>
      <h2>${esc(a.nom_ia ?? o.nomIA())} regarde tes comptes</h2>
      <p>Tes vidéos, leurs chiffres, tes miniatures, tes commentaires. En lecture seule : rien n’est publié ni modifié.</p>
      <ul class="pa-etapes">${etapes.map((x, i) => `<li class="${i === etapes.length - 1 ? 'en-cours' : 'fait'}">${ic(i === etapes.length - 1 ? x.icone ?? 'etincelle' : 'coche')}<span>${esc(x.texte)}</span></li>`).join('')}</ul>
      <div class="pa-pied-travail"><span>${Math.floor((a.depuis_s ?? 0) / 60)} min ${String((a.depuis_s ?? 0) % 60).padStart(2, '0')} s</span><button class="btn petit" data-cr="arreter">Arrêter</button></div></div>`;
  };
  const bloc = (titre, corps, cls = '') => (corps ? `<section class="pa-bloc ${cls}"><div class="pa-bloc-tete"><h3>${titre}</h3></div>${corps}</section>` : '');
  const lignes = (l) => (l?.length ? `<ul class="cr-liste">${l.map((x) => `<li>${ic('coche')}<span>${esc(x)}</span></li>`).join('')}</ul>` : '');
  const profil = (p) => {
    const s = p.style ?? {};
    const style = [['Ton', s.ton], ['Rythme', s.rythme], ['Direction artistique', s.direction_artistique], ['Formats', s.formats], ['Durée idéale', s.duree_ideale]].filter(([, v]) => v);
    return `<header class="cr-tete"><div><small>${esc(p.niche || 'Ton profil')}</small><h2>${esc(p.resume)}</h2></div></header>
      ${bloc('Ce qui a vraiment marché', p.ce_qui_marche?.length ? `<div class="cr-succes">${p.ce_qui_marche.map((v) => `<article class="cr-video">
          <div class="cr-video-tete">${logo(v.reseau, 26)}${v.multiple != null ? `<b class="cr-multiple" title="Ses vues, comparées à ta vidéo médiane sur ce réseau"><i>×</i>${String(v.multiple).replace('.', ',')}</b>` : ''}<span>${[v.vues != null ? `${nombre(v.vues)} vues` : '', v.duree_s ? `${Math.round(v.duree_s)} s` : ''].filter(Boolean).join(' · ')}</span></div>
          <h4>${esc(v.titre)}</h4>
          ${v.accroche ? `<p class="cr-accroche">« ${esc(v.accroche)} »</p>` : ''}
          ${v.pourquoi ? `<p>${esc(v.pourquoi)}</p>` : ''}
          ${v.lien ? `<button class="btn petit" data-lien="${esc(v.lien)}">${ic('lire', 'plein')}Voir</button>` : ''}</article>`).join('')}</div>` : '')}
      ${bloc('Ce qui marche moins', lignes(p.ce_qui_marche_moins), 'cr-moins')}
      ${bloc('Ton style', style.length || s.accroches?.length ? `<dl class="cr-style">${style.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${s.accroches?.length ? `<div class="cr-puces"><small>Tes accroches qui marchent</small>${s.accroches.map((a) => `<span>« ${esc(a)} »</span>`).join('')}</div>` : ''}
        ${s.ses_mots?.length ? `<div class="cr-puces mots"><small>Tes mots</small>${s.ses_mots.map((a) => `<span>${esc(a)}</span>`).join('')}</div>` : ''}` : '')}
      ${bloc('Ton public', p.public || p.commentaires?.length ? `${p.public ? `<p class="cr-texte">${esc(p.public)}</p>` : ''}${lignes(p.commentaires)}` : '')}
      ${bloc('Les conseils de ton IA', p.conseils?.length ? `<div class="cr-conseils">${p.conseils.map((c, i) => `<article><i>${i + 1}</i><div><b>${esc(c.titre)}</b><p>${esc(c.quoi)}</p>${c.pourquoi ? `<small>${esc(c.pourquoi)}</small>` : ''}</div></article>`).join('')}</div>` : '')}
      <div class="cr-deux">${bloc('Ce que ton IA retient pour monter', lignes(p.pour_le_montage))}${bloc('Pour tes titres et tes légendes', lignes(p.pour_les_titres))}</div>
      ${bloc('Tendances du moment, dans ta niche', p.tendances?.length ? `<ul class="cr-liste">${p.tendances.map((t) => `<li>${ic('eclair')}<span>${esc(t.quoi)}${t.source || t.vu_le ? `<small>${esc([hote(t.source), t.vu_le ? `vu le ${t.vu_le}` : ''].filter(Boolean).join(' · '))}</small>` : ''}</span></li>`).join('')}</ul>` : '')}
      ${p.limites ? `<p class="pp-note">${ic('attention')}<span>${esc(p.limites)}</span></p>` : ''}`;
  };
  function rendre() {
    if (!el || !S) return;
    const p = S.profil;
    const a = S.analyse;
    $('#cr-sous').textContent = p ? `Dressé le ${jour(p.cree_le)} par ${{codex: 'Codex', gemini: 'Gemini'}[p.moteur] ?? 'Claude'}` : 'Pas encore dressé';
    $('#cr-gauche').innerHTML = `${p?.comptes?.length ? `<h4>Tes comptes</h4><div class="cr-comptes">${p.comptes.map((c) => `<div class="cr-compte">${logo(c.reseau, 34)}<div><b>${esc(c.nom || RESEAUX[c.reseau])}</b><small>${[c.abonnes != null ? `${nombre(c.abonnes)} abonnés` : '', c.mediane_vues != null ? `${nombre(c.mediane_vues)} vues en médiane` : ''].filter(Boolean).join(' · ') || RESEAUX[c.reseau]}</small></div></div>`).join('')}</div>` : `<div class="cr-comptes vide">${['youtube', 'instagram', 'tiktok', 'linkedin'].map((k) => logo(k, 34)).join('')}</div>`}
      <h4>Ce que ton IA en fait</h4>
      <label class="cr-donner"><span><b>Donner mon profil à mon IA</b><small>Elle le relit avant chaque montage, chaque analyse et chaque plan de partage.</small></span><span class="interrupteur"><input type="checkbox" data-cr-donner${S.actif ? ' checked' : ''}${p ? '' : ' disabled'}><i></i></span></label>
      ${p && !a ? `<div class="cr-actions"><button class="btn" data-cr="refaire"${S.possible?.ok ? '' : ' disabled'} title="${esc(S.possible?.ok ? 'Relire tes comptes : utile une fois par mois' : S.possible?.pourquoi ?? '')}">${ic('etincelle', 'plein')}Refaire l’analyse</button><button class="btn" data-cr="effacer">${ic('poubelle')}Effacer mon profil</button></div>` : ''}
      <p class="cr-rassure">${ic('cadenas')}<span>Lecture seule : rien n’est publié ni modifié sur tes comptes. Le profil reste sur ton ordinateur, dans le dossier de Dérush.</span></p>`;
    $('#cr-contenu').innerHTML = a?.etat === 'en_cours' ? travail(a)
      : a?.etat === 'erreur' ? `<div class="pa-vide">${ic('attention')}<h2>L’analyse n’a pas abouti</h2><p>${esc(a.erreur ?? '')}</p>${S.possible?.ok ? `<button class="btn claude grand" data-cr="analyser">${ic('etincelle', 'plein')}<span>Réessayer</span></button>` : `<button class="btn bleu grand" data-cr="${S.possible?.raison === 'ia' ? 'connexions' : 'relier'}">${S.possible?.raison === 'ia' ? 'Brancher mon IA' : 'Relier mes réseaux'}</button>`}</div>${p ? profil(p) : ''}`
        : p ? profil(p) : vide();
  }
  const $ = (s) => el?.querySelector(s);
  async function clic(e) {
    const lien = e.target.closest('[data-lien]')?.dataset.lien;
    if (lien) return api('POST', '/api/lien', {url: lien}).catch((err) => note(err.message, true));
    const a = e.target.closest('[data-cr]')?.dataset.cr;
    if (!a) return;
    if (a === 'fermer') return fermer();
    if (a === 'connexions') { fermer(); return o.connexions?.(); }
    if (a === 'relier') return o.guideTreg?.(async () => { await charger(); rendre(); });
    try {
      if (a === 'analyser' || a === 'refaire') {
        if (a === 'refaire' && !confirm('Refaire l’analyse de tes comptes ? Ton IA les relit (5 à 10 minutes) et remplace ton profil.')) return;
        S = await api('POST', '/api/createur/analyser', {moteur: o.moteurIA?.(), qualite: 'soigne', mot});
      }
      if (a === 'arreter') S = await api('POST', '/api/createur/arreter');
      if (a === 'effacer') { if (!confirm('Effacer ton profil de créateur ? Ton IA ne s’en servira plus.')) return; S = await api('DELETE', '/api/createur'); }
    } catch (err) { note(err.message, true); await charger(); }
    rendre();
    suivre();
  }
  async function ouvrir() {
    fermer();
    el = document.createElement('div');
    el.className = 'pub-atelier cr-atelier';
    el.innerHTML = `<header class="pa-barre"><button class="icone-btn" data-cr="fermer" title="Revenir (Échap)">${ic('retour')}</button>
        <div class="pa-titre"><b>Mon profil de créateur</b><span id="cr-sous"></span></div><span class="espace"></span>
        <button class="icone-btn" data-cr="fermer" title="Fermer (Échap)">${ic('fermer')}</button></header>
      <div class="pa-corps"><aside class="pa-gauche" id="cr-gauche"></aside><main class="pa-droite" id="cr-contenu"></main></div>`;
    document.body.append(el);
    el.addEventListener('click', clic);
    el.addEventListener('input', (e) => { if (e.target.matches('[data-cr-mot]')) mot = e.target.value; });
    el.addEventListener('change', async (e) => {
      if (!e.target.matches('[data-cr-donner]')) return;
      try { S = await api('POST', '/api/createur/donner', {actif: e.target.checked}); } catch (err) { note(err.message, true); }
      rendre();
    });
    document.addEventListener('keydown', echap, true);
    await charger();
    rendre();
    suivre();
  }

  // ——— La mise en route : ton IA, tes réseaux (conseillé), ton profil ———
  async function accueil({premiere = false} = {}) {
    let cx;
    let cr;
    try { [cx, cr] = await Promise.all([api('GET', '/api/connexions'), api('GET', '/api/createur')]); } catch (e) { return note(e.message, true); }
    const f = o.feuille('', true);
    f.classList.add('accueil');
    const vu = () => api('POST', '/api/reglages/interface', {accueil_vu: true}).catch(() => {});
    const rendreAccueil = () => {
      const ias = ['claude', 'codex', 'gemini'];
      const prete = ias.find((m) => cx[m]?.ok && cx.choisi === m) ?? ias.find((m) => cx[m]?.ok);
      const treg = cx.treg ?? {};
      const p = cr.profil;
      const etape = (n, fait, corps) => `<section class="ac-etape${fait ? ' faite' : ''}"><i class="ac-num">${fait ? ic('coche') : n}</i><div class="ac-corps">${corps}</div></section>`;
      f.innerHTML = `<div class="ac-tete"><h3>${premiere ? 'Bienvenue dans Dérush' : 'Mise en route'}</h3><p class="sous-titre">Trois branchements, une seule fois. Seul le premier est nécessaire : les deux autres rendent ton IA bien plus utile.</p></div>
        ${etape(1, !!prete, `<div class="ac-ligne"><div class="ac-logos">${ias.map((m) => logo(m, 34)).join('')}</div><div><b>Ton IA, celle qui monte</b><p>${prete ? `${esc(o.nomIA(prete))} est branchée. Tu peux en changer à tout moment.` : 'Claude (compte Claude), Codex (compte ChatGPT) ou Gemini (compte Google) : un clic pour l’installer, un pour te connecter.'}</p></div>
          <button class="btn ${prete ? '' : 'bleu'}" data-ac="connexions">${prete ? 'Changer' : 'Brancher mon IA'}</button></div>`)}
        ${etape(2, !!treg.pret, `<div class="ac-ligne"><div class="ac-logos">${['tiktok', 'instagram', 'youtube', 'linkedin'].map((k) => logo(k, 34)).join('')}</div><div><b>Tes réseaux, avec Treg <em>Conseillé</em></b><p>${treg.pret ? `Reliés${treg.jeton ? ' avec ta clé' : ' par le connecteur de ton compte Claude'}. Rien ne part sans ton clic.` : 'Treg relie tes comptes à ton IA, une fois pour toutes. Tu choisis lesquels : TikTok, Instagram Reels, YouTube Shorts, LinkedIn.'}</p></div>
          <button class="btn ${treg.pret ? '' : 'bleu'}" data-ac="relier">${logo('treg', 18)}${treg.pret ? 'Voir mes réseaux' : 'Relier mes réseaux'}</button></div>
          <div class="ac-pouvoirs">
            <span>${ic('publier')}<b>Publier à ta place</b>Le bon titre, la bonne légende, les bons hashtags, sur chaque réseau.</span>
            <span>${ic('oeil')}<b>Lire tes chiffres et tes commentaires</b>Les vues, les partages, ce que ton public demande.</span>
            <span>${ic('baguette')}<b>Monter pour toi</b>Ton IA apprend ce qui marche chez toi et s’en sert à chaque vidéo.</span>
          </div>
          <p class="ac-rassure">${ic('cadenas')}<span><b>Tu gardes la main.</b> Tu relies seulement les comptes que tu veux. Rien n’est publié sans ton clic. Tu retires l’accès quand tu veux, depuis Treg. Ta clé reste sur ton ordinateur. Et c’est facultatif : Dérush monte très bien sans.</span></p>`)}
        ${etape(3, !!p, `<div class="ac-ligne"><div class="ac-logos seul">${ill('claude')}</div><div><b>Ton profil de créateur</b><p>${p ? `Dressé le ${jour(p.cree_le)} : ${esc(p.niche || p.resume.slice(0, 90))}. Ton IA le relit avant chaque vidéo.` : 'Ton IA regarde tes vidéos qui ont marché, ton style, ta direction artistique, ce que dit ton public. Ensuite, tout est fait sur mesure : montage, titres, conseils.'}</p></div>
          <button class="btn ${p || !cr.possible?.ok ? '' : 'claude'}" data-ac="profil"${p || cr.possible?.ok || cr.analyse ? '' : ' disabled title="Relie d’abord tes réseaux (étape 2)"'}>${p ? 'Voir mon profil' : cr.analyse?.etat === 'en_cours' ? 'Analyse en cours…' : 'Analyser mon profil'}</button></div>`)}
        <div class="pied"><span class="dim ac-plus">Tu retrouves tout ici : bouton « Mise en route », sur l’écran des projets.</span><span class="espace"></span><button class="btn principal" data-ac="fini">${prete ? 'C’est parti' : 'Plus tard'}</button></div>`;
    };
    const relire = async () => { try { [cx, cr] = await Promise.all([api('GET', '/api/connexions?force=1'), api('GET', '/api/createur')]); } catch { return; } if (f.isConnected && f.classList.contains('accueil')) rendreAccueil(); };
    rendreAccueil();
    f.addEventListener('click', (e) => {
      const a = e.target.closest('[data-ac]')?.dataset.ac;
      if (!a) return;
      if (a === 'fini') { vu(); return o.fermerFeuille(); }
      if (a === 'connexions') { vu(); return o.connexions?.(); }
      if (a === 'relier') { vu(); return o.guideTreg?.(() => accueil()); }
      if (a === 'profil') { vu(); o.fermerFeuille(); return ouvrir(); }
    });
    // un branchement fait ailleurs (page du navigateur) se voit en revenant sur Dérush
    const retour = () => { if (!f.isConnected || !f.classList.contains('accueil')) return window.removeEventListener('focus', retour); relire(); };
    window.addEventListener('focus', retour);
  }

  return {ouvrir, fermer, accueil, ouvert: () => !!el};
}
