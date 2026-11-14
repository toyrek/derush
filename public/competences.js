// Dérush — « Ajouter une compétence » : la feuille où la personne voit les compétences qu'elle a ajoutées, en trouve
// d'autres (un lien GitHub collé, ou l'annuaire skills.sh), lit ce que Dérush en dit (licence, programmes, adresses,
// clés, alertes) et choisit. Le serveur fait le travail (lib/competences-ajoutees.mjs, routes /api/competences/…).
//
//   const CP = creerCompetences({api, note, esc, ic, ill, logo, feuille, fermerFeuille, feuilleOuverte, apres});
//   CP.ouvrir()            la feuille, sur « Mes compétences ajoutées » (ou sur « Ajouter » s'il n'y en a aucune)
//   CP.ouvrir({lien})      la feuille, directement sur la lecture de ce lien
//   CP.ouvrir({retour})    `retour()` est appelé quand la personne ferme la feuille (pour revenir aux Connexions)
// `o.apres()` est appelé après un ajout, un retrait ou une pause (pour rafraîchir la carte des Connexions).

const NIVEAUX = {
  ok: {nom: 'Rien à signaler', classe: 'ok'},
  attention: {nom: 'À regarder', classe: 'attention'},
  danger: {nom: 'À lire avant', classe: 'danger'},
  refus: {nom: 'Refusée', classe: 'refus'},
};
// une bibliothèque de livres, et un livre qui arrive : l'image de la feuille
const ILL_COMPETENCES = `<svg viewBox="0 0 160 120" aria-hidden="true">
  <rect x="14" y="96" width="132" height="8" rx="4" fill="#2c2c33"/>
  <rect x="22" y="40" width="16" height="56" rx="3" fill="#0a84ff"/><rect x="40" y="30" width="14" height="66" rx="3" fill="#30d158"/>
  <rect x="56" y="46" width="18" height="50" rx="3" fill="#bf5af2"/><rect x="76" y="36" width="13" height="60" rx="3" fill="#64d2ff"/>
  <g class="cp-arrive"><rect x="104" y="22" width="22" height="58" rx="3.5" fill="#ff9f0a" transform="rotate(14 115 51)"/>
  <path d="M110 40l10 2.5M108.5 47l10 2.5" stroke="#1c1c1e" stroke-width="2.4" stroke-linecap="round" transform="rotate(14 115 51)"/></g>
  <path d="M138 14c.7 5.5 3 7.8 8.5 8.5-5.5.7-7.8 3-8.5 8.5-.7-5.5-3-7.8-8.5-8.5 5.5-.7 7.8-3 8.5-8.5z" fill="#fff" class="cp-scintille"/>
</svg>`;

export function creerCompetences(o) {
  const {api, note, esc, ic} = o;
  let el = null; // la feuille ouverte
  let vue = 'liste'; // liste | ajouter | lecture
  let liste = []; // GET /api/competences/ajoutees
  let lecture = null; // l'exploration en cours (POST /api/competences/explorer)
  let choix = new Set(); // les chemins cochés
  let accordDanger = false;
  let resultats = null; // l'annuaire
  let occupe = null; // ce qui tourne (texte)
  let derniereRecherche = '';
  let lienSaisi = '';
  let retour = null; // ce qui rouvre l'écran d'où l'on vient

  const licence = (l) => {
    if (!l) return '<span class="cp-lic aucune" title="Sans licence, l’auteur garde tous ses droits : ajoute-la seulement si tu lui fais confiance pour ton usage.">Sans licence</span>';
    if (l.commercial === false) return `<span class="cp-lic nc" title="Pas d’usage commercial : tes vidéos le sont peut-être.">${esc(l.nom)} · pas commercial</span>`;
    // une licence que Dérush ne reconnaît pas (« non reconnue ») : ni verte ni rouge, la personne la lit
    if (l.commercial == null) return '<span class="cp-lic inconnue" title="Dérush ne reconnaît pas cette licence : lis-la avant un usage commercial.">Licence à lire</span>';
    return `<span class="cp-lic ok">${esc(l.nom)}</span>`;
  };
  /**
   * Pourquoi une compétence ajoutée est cachée à l'IA. `lance` (du serveur) : son SKILL.md lancerait une commande tout
   * seul (retouché à la main, ou ajouté avant que Dérush le désarme) ; sinon, une compétence de Dérush porte son nom.
   * Sans `lance`, une compétence modifiée à la main est la cause probable.
   */
  const relancerait = (x) => !!x.masquee && (x.lance ?? x.modifiee) === true;
  const court = (sha) => (sha ? String(sha).slice(0, 7) : '?');
  /** Les alertes regroupées par sorte : la même (un « sudo » dans six fichiers) ne s'affiche qu'une fois, avec ses endroits. */
  const grouper = (alertes = []) => {
    const m = new Map();
    for (const a of alertes) { const g = m.get(a.quoi) ?? {quoi: a.quoi, gravite: a.gravite, lieux: []}; if (a.fichier) g.lieux.push(a); m.set(a.quoi, g); }
    const rang = {refus: 0, danger: 1, attention: 2};
    return [...m.values()].sort((a, b) => (rang[a.gravite] ?? 3) - (rang[b.gravite] ?? 3));
  };
  const description = (t) => `<p class="cp-desc" title="${esc(t || '')}">${esc(t || 'Sans description.')}</p>`;
  const date = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short', year: 'numeric'}); } catch { return ''; } };

  async function charger() {
    try { liste = (await api('GET', '/api/competences/ajoutees')).competences ?? []; }
    catch (err) { liste = []; note(err.message, true); }
  }
  function abandonnerLecture() {
    if (lecture?.id) api('POST', '/api/competences/abandonner', {id: lecture.id}).catch(() => {});
    lecture = null;
    choix = new Set();
    accordDanger = false;
  }

  // ——— le dessin ———
  function tete() {
    return `<header class="cp-tete"><div class="cp-ill">${ILL_COMPETENCES}</div><div><h3>Compétences</h3>
      <p class="sous-titre">Ce que ton IA sait faire en plus : des guides écrits par d’autres, trouvés sur GitHub ou dans l’annuaire skills.sh. Dérush les lit avant, garde leur provenance et ne lance jamais leur code.</p></div>
      <button class="icone-btn" data-cp="fermer" title="Fermer (Échap)">${ic('fermer')}</button></header>
      <nav class="segmente cp-onglets"><button data-cp="vue-liste"${vue === 'liste' ? ' class="actif"' : ''}>Mes ajouts${liste.length ? ` · ${liste.length}` : ''}</button><button data-cp="vue-ajouter"${vue !== 'liste' ? ' class="actif"' : ''}>Ajouter</button></nav>`;
  }
  function vueListe() {
    if (!liste.length) {
      return `<div class="cp-vide">${o.ill?.('bobine') ?? ''}<b>Aucune compétence ajoutée pour l’instant</b><p>Dérush en livre déjà plus d’une centaine. Si tu en trouves une autre, colle son lien ou cherche-la dans l’annuaire.</p><button class="btn bleu" data-cp="vue-ajouter">${ic('plus')}Ajouter une compétence</button></div>`;
    }
    const majs = liste.filter((x) => x.maj_disponible).length;
    return `<div class="cp-barre"><small class="dim">${liste.length} ajoutée${liste.length > 1 ? 's' : ''}${majs ? ` · ${majs} nouvelle${majs > 1 ? 's' : ''} version${majs > 1 ? 's' : ''}` : ''}</small><span class="espace"></span><button class="btn petit" data-cp="verifier"${occupe ? ' disabled' : ''}>${occupe === 'verifier' ? '<i class="cp-tourne"></i>' : ic('maj')}Chercher des mises à jour</button></div>
      <div class="cp-liste">${liste.map((x, i) => `<article class="cp-carte${x.actif === false ? ' pause' : ''}" style="animation-delay:${Math.min(i, 8) * 0.04}s">
        <div class="cp-carte-tete"><b>${esc(x.nom)}</b>${licence(x.licence)}${x.maj_disponible ? '<span class="etiq encours">Nouvelle version</span>' : ''}${x.modifiee ? '<span class="etiq" title="Un fichier a été changé à la main depuis l’ajout">Modifiée</span>' : ''}${x.masquee ? `<span class="etiq erreur" title="${relancerait(x) ? 'Ton IA ne la voit plus : elle lancerait une commande toute seule' : 'Une compétence de Dérush porte déjà ce nom : la sienne passe avant'}">Masquée</span>` : ''}${!x.present ? '<span class="etiq erreur">Dossier absent</span>' : ''}
          <span class="espace"></span><label class="interrupteur" title="${x.actif === false ? 'En pause : ton IA ne la voit pas' : 'Active : ton IA s’en sert'}"><input type="checkbox" data-cp-actif="${esc(x.nom)}"${x.actif === false ? '' : ' checked'}><i></i></label></div>
        ${description(x.description)}
        <small class="dim">${esc(x.depot)}${x.chemin ? ` · ${esc(x.chemin)}` : ''} · version ${court(x.commit)}${x.date_version ? ` du ${date(x.date_version)}` : ''} · ajoutée le ${date(x.ajoutee_le)}${x.programmes ? ` · ${x.programmes} programme${x.programmes > 1 ? 's' : ''}` : ''}</small>
        ${relancerait(x) ? `<small class="cp-rappel">${ic('attention')}${x.modifiee ? 'Retouchée à la main : elle' : 'Elle'} lancerait une commande toute seule, ton IA ne la voit plus. Reprends-la dans Dérush pour la désarmer.</small>` : ''}
        ${x.alertes?.length ? `<small class="cp-rappel">${ic('attention')}${esc([...new Set(x.alertes)].slice(0, 3).join(' ; '))}</small>` : ''}
        <div class="cp-actions">${x.maj_disponible ? `<button class="btn bleu petit" data-cp="maj" data-nom="${esc(x.nom)}"${occupe ? ' disabled' : ''}>Voir la nouvelle version</button>` : relancerait(x) ? `<button class="btn bleu petit" data-cp="maj" data-nom="${esc(x.nom)}"${occupe ? ' disabled' : ''} title="La reprendre depuis GitHub : Dérush la relit et la désarme">Reprendre</button>` : ''}<button class="btn petit" data-cp="ouvrir-depot" data-url="${esc(x.url)}${x.chemin ? `/tree/${esc(x.commit ?? 'HEAD')}/${esc(x.chemin)}` : ''}">${ic('lien')}GitHub</button>
          <button class="btn petit rouge-texte" data-cp="retirer" data-nom="${esc(x.nom)}">Retirer</button></div>
      </article>`).join('')}</div>`;
  }
  function vueAjouter() {
    return `<section class="cp-bloc"><h4>${ic('lien')}Coller un lien</h4>
        <form class="cp-ligne" data-cp-form="lien"><input class="entree" name="lien" placeholder="github.com/propriétaire/dépôt, une page skills.sh, ou propriétaire/dépôt" value="${esc(lienSaisi)}" autocomplete="off" spellcheck="false"><button class="btn bleu" type="submit"${occupe ? ' disabled' : ''}>${occupe === 'lire' ? '<i class="cp-tourne"></i>Lecture…' : 'Lire'}</button></form>
        <small class="dim">Dérush télécharge le dépôt à une version précise et te montre ce qu’il contient. Rien n’est ajouté avant ton choix.</small></section>
      <section class="cp-bloc"><h4>${ic('loupe')}Chercher dans l’annuaire skills.sh</h4>
        <form class="cp-ligne" data-cp-form="chercher"><input class="entree" name="q" placeholder="montage, sous-titres, motion design, son…" value="${esc(derniereRecherche)}" autocomplete="off"><button class="btn" type="submit"${occupe ? ' disabled' : ''}>${occupe === 'chercher' ? '<i class="cp-tourne"></i>' : ''}Chercher</button></form>
        <small class="dim">Seuls les mots cherchés partent vers skills.sh (l’annuaire de Vercel). Le classement suit le nombre d’installations : ce n’est pas une garantie.</small>
        ${resultats === null ? '' : resultats.length ? `<div class="cp-resultats">${resultats.map((r) => `<div class="cp-resultat"><div><b>${esc(r.nom)}</b><small class="dim">${esc(r.depot)}${r.installs != null ? ` · ${r.installs.toLocaleString('fr-FR')} installation${r.installs > 1 ? 's' : ''}` : ''}</small></div>${r.deja ? '<span class="etiq ok">Déjà là</span>' : `<button class="btn petit" data-cp="lire" data-lien="${esc(`${r.depot}@${r.nom}`)}"${occupe ? ' disabled' : ''}>Voir</button>`}</div>`).join('')}</div>` : '<p class="dim cp-rien">Rien trouvé. Essaie un autre mot, en anglais souvent.</p>'}</section>`;
  }
  function vueLecture() {
    const e = lecture;
    const cochees = e.competences.filter((c) => choix.has(c.chemin));
    const danger = cochees.some((c) => c.niveau === 'danger');
    const ligne = (c) => {
      const n = NIVEAUX[c.niveau] ?? NIVEAUX.attention;
      const bloquee = c.niveau === 'refus' || !!c.conflit;
      const details = [
        c.n_programmes ? `${c.n_programmes} programme${c.n_programmes > 1 ? 's' : ''} (${esc(c.programmes.slice(0, 4).join(', '))}${c.n_programmes > 4 ? '…' : ''}) : Dérush ne les lance jamais, mais ton IA pourrait les lancer.` : '',
        c.cles?.length ? `Clés demandées : ${esc(c.cles.join(', '))}. Dérush ne les donne pas.` : '',
        c.domaines?.length ? `Adresses citées : ${esc(c.domaines.slice(0, 6).join(', '))}${c.domaines.length > 6 ? '…' : ''}` : '',
        c.binaires?.length ? `Programme compilé (${esc(c.binaires.join(', '))}) : impossible à relire, refusée.` : '',
        c.conflit ? esc(c.conflit) : '',
      ].filter(Boolean);
      return `<label class="cp-choix${bloquee ? ' bloquee' : ''}${choix.has(c.chemin) ? ' coche' : ''}">
        <input type="checkbox" data-cp-choix="${esc(c.chemin)}"${choix.has(c.chemin) ? ' checked' : ''}${bloquee ? ' disabled' : ''}>
        <div class="cp-choix-corps"><div class="cp-carte-tete"><b>${esc(c.nom)}</b>${licence(c.licence)}<span class="cp-niveau ${n.classe}">${esc(n.nom)}</span>${c.deja_ajoutee ? '<span class="etiq">Déjà ajoutée : sera remplacée</span>' : ''}</div>
          ${description(c.description)}
          <small class="dim">${c.chemin ? esc(c.chemin) : 'le dépôt entier'} · ${c.fichiers} fichier${c.fichiers > 1 ? 's' : ''} · ${Math.max(1, Math.round(c.taille / 1024))} ko</small>
          ${details.length ? `<ul class="cp-details">${details.map((d) => `<li>${d}</li>`).join('')}</ul>` : ''}
          ${c.alertes?.length ? `<ul class="cp-alertes">${grouper(c.alertes).map((g) => `<li class="${esc(g.gravite)}">${ic('attention')}<span><b>${esc(g.quoi)}${g.lieux.length > 1 ? ` · ${g.lieux.length} endroits` : ''}</b>${g.lieux.length ? `<code class="selectionnable">${esc(g.lieux[0].fichier)}:${g.lieux[0].ligne}${g.lieux[0].extrait ? ` — ${esc(g.lieux[0].extrait)}` : ''}</code>` : ''}${g.lieux.length > 1 ? `<small class="dim selectionnable">aussi : ${esc(g.lieux.slice(1, 6).map((l) => `${l.fichier}:${l.ligne}`).join(', '))}${g.lieux.length > 6 ? '…' : ''}</small>` : ''}</span></li>`).join('')}</ul>` : ''}
        </div></label>`;
    };
    return `<div class="cp-lecture">
      <div class="cp-depot"><button class="icone-btn" data-cp="retour-ajouter" title="Revenir">${ic('retour')}</button><div><b>${esc(e.depot)}</b><small class="dim">version ${court(e.commit)} · licence du dépôt : ${e.licence ? esc(e.licence.nom) : 'aucune trouvée'} · ${e.competences.length} compétence${e.competences.length > 1 ? 's' : ''}</small></div><span class="espace"></span><button class="btn petit" data-cp="ouvrir-depot" data-url="${esc(e.url)}">${ic('lien')}GitHub</button></div>
      ${e.competences.length > 1 ? `<div class="cp-barre"><small class="dim">Coche celles que tu veux.</small><span class="espace"></span><button class="btn petit" data-cp="tout-cocher">Tout cocher</button><button class="btn petit" data-cp="rien-cocher">Rien</button></div>` : ''}
      <div class="cp-choix-liste">${e.competences.map(ligne).join('')}</div>
      <div class="cp-pied">
        <p class="cp-avertir">${ic('cadenas')}Une compétence guide ton IA : elle agit avec les mêmes droits qu’elle. Dérush ne lance jamais son code, et retire ce que Claude Code lancerait tout seul en l’ouvrant (crochets, « !\`commande\` », droits qu’elle se donne). Ton IA, elle, pourrait lancer ses programmes : Dérush lui dit de ne rien installer ni envoyer qu’elle demande, sans ton accord.</p>
        ${danger ? `<label class="cp-accord"><input type="checkbox" data-cp-accord${accordDanger ? ' checked' : ''}><span>J’ai lu les alertes : je l’ajoute quand même.</span></label>` : ''}
        <div class="cp-boutons"><button class="btn" data-cp="retour-ajouter">Annuler</button><button class="btn bleu" data-cp="ajouter"${!cochees.length || (danger && !accordDanger) || occupe ? ' disabled' : ''}>${occupe === 'ajouter' ? '<i class="cp-tourne"></i>Ajout…' : `Ajouter${cochees.length > 1 ? ` (${cochees.length})` : ''}`}</button></div>
      </div></div>`;
  }
  function rendre() {
    if (!el || !el.isConnected) return;
    const garde = document.activeElement?.closest?.('.feuille') === el && document.activeElement.name ? document.activeElement.name : null;
    el.innerHTML = `<div class="cp">${tete()}<div class="cp-corps">${vue === 'liste' ? vueListe() : vue === 'lecture' && lecture ? vueLecture() : vueAjouter()}</div></div>`;
    if (garde) { const c = el.querySelector(`[name="${garde}"]`); if (c) { c.focus(); c.setSelectionRange?.(c.value.length, c.value.length); } }
  }

  // ——— les gestes ———
  async function lire(lien) {
    lienSaisi = lien;
    occupe = 'lire';
    rendre();
    try {
      abandonnerLecture();
      lecture = await api('POST', '/api/competences/explorer', {lien});
      // cochées d'avance : celle que le lien désigne, ou la seule du dépôt (jamais une refusée)
      const voulues = lecture.competences.filter((c) => c.voulue && c.niveau !== 'refus' && !c.conflit);
      const seules = lecture.competences.length === 1 && lecture.competences[0].niveau !== 'refus' && !lecture.competences[0].conflit ? lecture.competences : [];
      choix = new Set((voulues.length ? voulues : seules).map((c) => c.chemin));
      vue = 'lecture';
    } catch (err) { note(err.message, true); }
    occupe = null;
    rendre();
  }
  async function ajouter() {
    if (!lecture) return;
    occupe = 'ajouter';
    rendre();
    try {
      const r = await api('POST', '/api/competences/ajouter', {id: lecture.id, chemins: [...choix]});
      if (r.ajoutees.length) note(r.ajoutees.length > 1 ? `${r.ajoutees.length} compétences ajoutées : ton IA s’en servira dès le prochain montage.` : `« ${r.ajoutees[0]} » ajoutée : ton IA s’en servira dès le prochain montage.`, false, true);
      for (const x of r.refusees) note(`« ${x.nom} » n’a pas été ajoutée : ${x.raison}.`, true);
      if (r.ajoutees.length) { abandonnerLecture(); vue = 'liste'; await charger(); o.apres?.(); }
    } catch (err) { note(err.message, true); }
    occupe = null;
    rendre();
  }
  async function clic(e) {
    const b = e.target.closest('[data-cp]');
    if (!b || b.disabled) return;
    const a = b.dataset.cp;
    if (a === 'fermer') return fermer();
    if (a === 'vue-liste') { abandonnerLecture(); vue = 'liste'; return rendre(); }
    if (a === 'vue-ajouter' || a === 'retour-ajouter') { abandonnerLecture(); vue = 'ajouter'; return rendre(); }
    if (a === 'lire') return lire(b.dataset.lien);
    if (a === 'ajouter') return ajouter();
    if (a === 'tout-cocher') { choix = new Set(lecture.competences.filter((c) => c.niveau !== 'refus' && !c.conflit).map((c) => c.chemin)); return rendre(); }
    if (a === 'rien-cocher') { choix = new Set(); return rendre(); }
    if (a === 'ouvrir-depot') { try { await api('POST', '/api/lien', {url: b.dataset.url}); } catch (err) { note(err.message, true); } return; }
    if (a === 'verifier') {
      occupe = 'verifier';
      rendre();
      try {
        const r = await api('POST', '/api/competences/verifier', {});
        note(r.maj.length ? `Nouvelle version : ${r.maj.join(', ')}.` : r.echecs ? 'GitHub n’a pas répondu pour toutes : réessaie dans un moment.' : 'Tout est à jour.', !r.maj.length && r.echecs > 0);
        await charger();
      } catch (err) { note(err.message, true); }
      occupe = null;
      return rendre();
    }
    if (a === 'maj') {
      occupe = 'lire';
      rendre();
      try {
        abandonnerLecture();
        lecture = await api('POST', '/api/competences/mise-a-jour', {nom: b.dataset.nom});
        choix = new Set(lecture.competences.filter((c) => c.niveau !== 'refus').map((c) => c.chemin));
        vue = 'lecture';
      } catch (err) { note(err.message, true); }
      occupe = null;
      return rendre();
    }
    if (a === 'retirer') {
      // une confirmation dans la carte même (pas de confirm() du navigateur)
      if (b.dataset.sur !== '1') { b.dataset.sur = '1'; b.textContent = 'Retirer vraiment ?'; b.classList.add('rouge'); setTimeout(() => { if (b.isConnected && b.dataset.sur === '1') { b.dataset.sur = ''; b.textContent = 'Retirer'; b.classList.remove('rouge'); } }, 4000); return; }
      try { await api('POST', '/api/competences/retirer', {nom: b.dataset.nom}); note(`« ${b.dataset.nom} » retirée.`); await charger(); o.apres?.(); } catch (err) { note(err.message, true); }
      return rendre();
    }
  }
  async function changement(e) {
    const t = e.target;
    if (t.matches('[data-cp-choix]')) { if (t.checked) choix.add(t.dataset.cpChoix); else choix.delete(t.dataset.cpChoix); return rendre(); }
    if (t.matches('[data-cp-accord]')) { accordDanger = t.checked; return rendre(); }
    if (t.matches('[data-cp-actif]')) {
      try { await api('POST', '/api/competences/activer', {nom: t.dataset.cpActif, actif: t.checked}); note(t.checked ? `« ${t.dataset.cpActif} » : active.` : `« ${t.dataset.cpActif} » en pause : ton IA ne la voit plus.`); await charger(); o.apres?.(); }
      catch (err) { note(err.message, true); t.checked = !t.checked; }
      return rendre();
    }
  }
  async function envoi(e) {
    const f = e.target.closest('[data-cp-form]');
    if (!f) return;
    e.preventDefault();
    if (occupe) return;
    if (f.dataset.cpForm === 'lien') {
      const lien = f.elements.lien.value.trim();
      if (!lien) return note('Colle d’abord un lien.', true);
      return lire(lien);
    }
    const q = f.elements.q.value.trim();
    derniereRecherche = q;
    if (q.length < 2) return note('Écris au moins deux lettres.', true);
    occupe = 'chercher';
    rendre();
    try { resultats = (await api('GET', `/api/competences/annuaire?q=${encodeURIComponent(q)}`)).resultats ?? []; }
    catch (err) { note(err.message, true); }
    occupe = null;
    rendre();
  }
  function saisie(e) { if (e.target.name === 'lien') lienSaisi = e.target.value; if (e.target.name === 'q') derniereRecherche = e.target.value; }
  function echap(e) { if (el && e.key === 'Escape' && el.isConnected) { e.stopPropagation(); e.preventDefault(); fermer(); } }

  function fermer() {
    abandonnerLecture();
    document.removeEventListener('keydown', echap, true);
    const etaitOuverte = !!el?.isConnected;
    el = null;
    if (etaitOuverte) o.fermerFeuille();
    const r = retour;
    retour = null;
    if (etaitOuverte && r) { try { r(); } catch { /* l'écran d'avant se débrouille */ } }
  }
  async function ouvrir({lien = null, retour: revenir = null} = {}) {
    retour = revenir;
    await charger();
    vue = lien ? 'ajouter' : liste.length ? 'liste' : 'ajouter';
    resultats = null;
    el = o.feuille('', true);
    el.classList.add('cp-feuille');
    el.addEventListener('click', clic);
    el.addEventListener('change', changement);
    el.addEventListener('submit', envoi);
    el.addEventListener('input', saisie);
    document.addEventListener('keydown', echap, true);
    // la feuille a pu être fermée autrement (clic sur le voile) : on oublie alors la lecture en cours
    const voile = document.getElementById('voile');
    const garde = new MutationObserver(() => {
      if (el?.isConnected && !voile?.classList.contains('cache')) return;
      garde.disconnect();
      if (el) { abandonnerLecture(); document.removeEventListener('keydown', echap, true); el = null; }
    });
    if (voile) garde.observe(voile, {childList: true, attributes: true, attributeFilter: ['class']});
    rendre();
    if (lien) lire(lien);
  }
  return {ouvrir, fermer, ouvert: () => !!el?.isConnected};
}
