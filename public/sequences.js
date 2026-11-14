// Dérush — plusieurs vidéos dans une timeline (les dix TikToks d'un même projet). Ce module dessine les onglets au-dessus
// de la timeline et fait les gestes simples, à la CapCut : un clic pour ouvrir une vidéo, « + » pour en ajouter une (vide,
// ou la copie de celle-ci), un double-clic pour la renommer, glisser pour changer l'ordre, un menu pour la supprimer (la
// confirmation est dans la page). Il fait aussi « Créer toutes les vidéos » (ce qui va être fait, puis le suivi de chaque
// vidéo) et, sous les vidéos livrées par l'IA, « Mettre dans ma timeline ».
// Le serveur fait le travail (lib/sequences.mjs, routes /api/sequences…). Ce module ne touche jamais au montage lui-même :
// quand une autre vidéo arrive dans la timeline, il donne le projet relu à app.js (`o.poser`), qui remet la lecture, la
// sélection et l'historique (⌘Z) à zéro. Avant tout changement de vidéo, la vidéo ouverte est enregistrée (`o.sauver`) ;
// si elle ne peut pas l'être, rien ne change.
//
//   const SQ = creerSequences(o);
//   SQ.rendre()                      redessine les onglets (après une retouche : la durée de la vidéo ouverte change)
//   SQ.activer(id)                   ouvre une autre vidéo du projet
//   SQ.ajouter({copier})             une vidéo vide, ou la copie de la vidéo ouverte (copier: true) ou d'une autre (son id)
//   SQ.renommer(id), SQ.ordonner(ids), SQ.supprimer(id)   (supprimer demande d'abord, dans la page)
//   SQ.feuilleCreer({choix})         « Créer la vidéo » quand le projet en a plusieurs : celle-ci, ou toutes
//   SQ.suivreRendus(), SQ.suit(), SQ.enAttente(), SQ.montrerRendus()   le suivi de « Créer toutes les vidéos »
//   SQ.boutonVideoIA(v, x, k), SQ.boutonLotIA(v), SQ.clic(act, el), SQ.depuisIA({version, video}), SQ.signature(),
//   SQ.ligneIA(), SQ.dansOuverte()   l'écran de l'IA : « Mettre dans ma timeline », et pour quelle vidéo vaut la demande
//   SQ.videos(), SQ.occupe(), SQ.oublier(), SQ.fermerMenu()   la liste montrée ; un changement en route ; un autre projet
// Pendant une prise (micro, webcam : `o.bloque()`), la vidéo ouverte ne change pas : la prise y sera posée.
// `o` = {api, note, esc, ic, feuille, fermerFeuille, projet(), cleProjet(), dureeOuverte(), dureeDe({montage, sortie}),
//   formats(), sauver() → vrai si la vidéo ouverte est enregistrée, poser(projet), recharger(), bloque() → raison ou null,
//   avantRendu(), rendreIA(), reseaux(), resumeOuverte(), moteurRendu(), creerOuverte(plateforme), file(), suivreFile(),
//   voirRendu(t, retour), ouvrirChemin(chemin), libre(), nomIA(moteur)}.

const pluriel = (n, un, plusieurs = `${un}s`) => `${n} ${n > 1 ? plusieurs : un}`;

/** Une durée d'onglet : « 0:32 », « 12:05 », « 1:02:03 » ; rien pour une vidéo vide. */
export function dureeOnglet(s) {
  if (!(Number(s) > 0)) return '';
  const t = Math.max(1, Math.round(Number(s)));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const r = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Une durée en clair, comme lib/commun.mjs (dureeLisible) : « 32 s », « 1 min 05 », « 1 h 02 ». */
export function dureeTexte(s) {
  if (!Number.isFinite(Number(s))) return '—';
  s = Number(s);
  if (s < 60) return `${(Math.round(s * 10) / 10).toLocaleString('fr-FR')} s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  if (m < 60) return `${m} min ${String(r).padStart(2, '0')}`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

/** Une taille en clair, comme le serveur (lib/outils.mjs) : « 1,5 Ko », « 420 Mo », « 3,4 Go ». */
export function tailleLisible(o) {
  if (!Number.isFinite(Number(o))) return '—';
  let v = Number(o);
  const u = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let i = 0;
  while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
  return `${(Math.round(v * 10) / 10).toLocaleString('fr-FR')} ${u[i]}`;
}

/** La petite forme du format d'une vidéo (9:16 debout, 16:9 couché), dans un carré de `max` pixels. */
export function formeOnglet(largeur, hauteur, max = 13) {
  const l = Number(largeur) > 0 ? Number(largeur) : 9;
  const h = Number(hauteur) > 0 ? Number(hauteur) : 16;
  return l >= h ? {l: max, h: Math.max(5, Math.round((max * h) / l))} : {l: Math.max(5, Math.round((max * l) / h)), h: max};
}

/** La liste `ids` où `id` passe à la place `k` (comptée dans la liste d'arrivée). */
export function ordreApres(ids, id, k) {
  const reste = ids.filter((x) => x !== id);
  if (reste.length === ids.length) return [...ids];
  const kk = Math.max(0, Math.min(reste.length, Math.round(Number(k) || 0)));
  return [...reste.slice(0, kk), id, ...reste.slice(kk)];
}

/** Où lâcher un onglet qu'on glisse : le nombre d'autres onglets dont le milieu est à gauche de `x`. */
export const placeDepot = (milieux, x) => milieux.filter((m) => m < x).length;

/** Des noms entre guillemets : « A », « A » et « B », « A », « B » et « C » ; au-delà de `max`, « et 4 autres ». */
export function listeNoms(noms, max = 3) {
  const l = (Array.isArray(noms) ? noms : []).map((n) => `« ${n} »`);
  if (l.length <= 1) return l.join('');
  if (l.length > max) return `${l.slice(0, max).join(', ')} et ${pluriel(l.length - max, 'autre')}`;
  return `${l.slice(0, -1).join(', ')} et ${l.at(-1)}`;
}

/** Ce qu'une vidéo supprimée emporte, en une phrase (d'après ses comptes : plans, cases, effets, médias par-dessus). */
export function phraseSuppression({plans = 0, cases = 0, effets = 0, dessus = 0} = {}) {
  const parts = [plans && pluriel(plans, 'plan'), cases && pluriel(cases, 'case à créer', 'cases à créer'), effets && pluriel(effets, 'effet ou titre', 'effets ou titres'),
    dessus && pluriel(dessus, 'média par-dessus', 'médias par-dessus')].filter(Boolean);
  const garde = 'Tes médias restent dans le projet, et Dérush garde une copie de secours de cette vidéo.';
  if (!parts.length) return `Elle est vide. ${garde}`;
  return `Ce qu’elle contient quitte le projet : ${parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} et ${parts.at(-1)}`}. ${garde}`;
}

/**
 * Ce que « Créer toutes les vidéos » va faire, en mots, d'après le plan du serveur (GET /api/sequences/rendre) : le total,
 * les vidéos vides laissées de côté, la place sur le disque, le bouton (et s'il peut être cliqué).
 */
export function resumePlan(plan) {
  const n = Number(plan?.a_rendre) || 0;
  const vides = Array.isArray(plan?.vides) ? plan.vides : [];
  const place = plan?.place ?? {};
  const total = n ? [`${pluriel(n, 'vidéo')} à créer`, `${dureeTexte(plan.duree_s)} en tout`, plan.taille_lisible].filter(Boolean).join(' · ') : 'Aucune vidéo à créer : elles sont toutes vides.';
  const lesVides = !vides.length ? '' : vides.length === 1 ? `La vidéo vide ${listeNoms(vides)} est laissée de côté.` : `Les vidéos vides ${listeNoms(vides)} sont laissées de côté.`;
  const texte = place.texte || (place.libre_lisible ? `Il reste ${place.libre_lisible} sur le disque du projet.` : '');
  return {
    total, vides: lesVides,
    place: {texte, classe: place.ok === false ? 'refus' : place.texte ? 'attention' : 'ok'},
    ok: n > 0 && place.ok !== false,
    bouton: n > 1 ? `Créer les ${n} vidéos` : n === 1 ? 'Créer la vidéo' : 'Rien à créer',
  };
}

/** Une vidéo du projet faite d'une vidéo de l'IA existe encore (`noms` : les noms des vidéos du projet, par id). */
const encoreLa = (d, noms) => !!d?.id && (!Object.keys(noms).length || noms[d.id] != null);

/**
 * Sous une vidéo livrée par l'IA (GET /api/claude : versions[].videos[], avec rang, timeline et dans_timeline) : ce que le
 * bouton propose. {quoi: 'mettre' | 'ouvrir' | 'ici', bouton, court, sous, id?} (`court` : dans les petites cartes d'un
 * lot, deux par ligne). `noms` : les noms actuels des vidéos du projet (une vidéo renommée depuis garde son nouveau nom),
 * `ouverte` : l'id de la vidéo ouverte.
 */
export function libelleVideoIA(x, {noms = {}, ouverte = null} = {}) {
  const d = x?.dans_timeline;
  if (encoreLa(d, noms)) {
    const nom = noms[d.id] ?? d.nom ?? '';
    if (d.id === ouverte) return {quoi: 'ici', id: d.id, bouton: 'Dans ta timeline', court: 'Dans ta timeline', sous: 'ouverte en ce moment'};
    return {quoi: 'ouvrir', id: d.id, bouton: `Ouvrir « ${nom} »`, court: `Ouvrir « ${nom} »`, sous: 'déjà dans ta timeline'};
  }
  return {quoi: 'mettre', bouton: 'Mettre dans ma timeline', court: 'Vers ma timeline', sous: x?.timeline === 'plans' ? 'plan par plan, à retoucher' : 'comme un seul plan (le fichier)'};
}

/** Au-dessus des vidéos d'une version qui en a plusieurs : toutes dans la timeline d'un coup. {quoi, bouton, sous, n} */
export function libelleLotIA(v, {noms = {}} = {}) {
  const vids = Array.isArray(v?.videos) ? v.videos : [];
  const n = vids.length;
  const dedans = vids.filter((x) => encoreLa(x?.dans_timeline, noms)).length;
  if (n && dedans === n) return {quoi: 'ici', n: 0, bouton: n === 2 ? 'Les deux sont dans ta timeline' : `Les ${n} sont dans ta timeline`, sous: 'Chacune est une vidéo de ton projet : un onglet au-dessus de la timeline.'};
  const reste = n - dedans;
  return {quoi: 'mettre', n: reste,
    bouton: dedans ? (reste > 1 ? `Mettre les ${reste} autres dans ma timeline` : 'Mettre l’autre dans ma timeline') : `Mettre les ${n} vidéos dans ma timeline`,
    sous: 'Chacune devient une vidéo de ta timeline, à retoucher.'};
}

/** La note après « Mettre dans ma timeline » (réponse de POST /api/sequences/depuis-ia). */
export function phraseApresIA(r) {
  const f = Array.isArray(r?.faites) ? r.faites : [];
  if (!f.length) return '';
  if (f.length === 1) {
    const x = f[0];
    if (x.deja) return `« ${x.nom} » était déjà dans ta timeline : la voilà.`;
    return x.mode === 'plans' ? `« ${x.nom} » est dans ta timeline, plan par plan : retouche-la comme tu veux.` : `« ${x.nom} » est dans ta timeline, comme un seul plan (la vidéo de l’IA).`;
  }
  const neuves = f.filter((x) => !x.deja).length;
  const detail = neuves === f.length ? '' : ` (${neuves ? `${pluriel(neuves, 'nouvelle')}, ` : ''}${pluriel(f.length - neuves, 'déjà là', 'déjà là')})`;
  return `${pluriel(f.length, 'vidéo')} dans ta timeline${detail} : ${listeNoms(f.map((x) => x.nom))}. « ${f[0].nom} » est ouverte.`;
}

/** Où en est « Créer toutes les vidéos » : lignes = [{tache, nom, t}] (t : la tâche de la file, ou null). */
export function etatRendus(lignes) {
  const l = Array.isArray(lignes) ? lignes : [];
  const fin = (t) => ['fini', 'erreur', 'inconnu'].includes(t?.etat);
  const finies = l.filter((x) => x.t?.etat === 'fini' || x.t?.etat === 'inconnu').length;
  const erreurs = l.filter((x) => x.t?.etat === 'erreur').length;
  const progression = l.length ? l.reduce((s, x) => s + (fin(x.t) ? 1 : Math.max(0, Math.min(1, Number(x.t?.progression) || 0))), 0) / l.length : 0;
  return {total: l.length, finies, erreurs, fini: l.length > 0 && finies + erreurs === l.length, progression};
}

/** Le titre de la feuille quand toutes les vidéos sont faites. */
export function titreRendus({total, finies}) {
  if (finies === total) return total === 2 ? 'Tes deux vidéos sont prêtes' : total === 1 ? 'Ta vidéo est prête' : `Tes ${total} vidéos sont prêtes`;
  if (!finies) return total > 1 ? 'Aucune vidéo n’a pu être créée' : 'La vidéo n’a pas pu être créée';
  return `${finies} vidéo${finies > 1 ? 's' : ''} sur ${total} ${finies > 1 ? 'sont prêtes' : 'est prête'}`;
}

export function creerSequences(o) {
  const {api, note, esc, ic} = o;
  const $ = (s) => document.querySelector(s);
  const barre = $('#sequences');
  const seul = $('#b-seq-plus');

  let occupe = null; // un changement en route : {quoi: 'activer' | 'ajouter' | 'supprimer' | 'ia', id?}
  let apresOccupe = null; // un geste demandé pendant ce temps (un double-clic sur un onglet qui s'ouvre)
  let renommage = null; // {id, valeur}
  let glisse = null; // un onglet qu'on glisse
  let aRedessiner = false;
  let redessin = false; // les onglets sont en train d'être refaits (un champ retiré ne finit pas le renommage)
  let neuve = null; // l'id d'une vidéo qui vient d'arriver : son onglet arrive en douceur (le temps de l'animation)
  const arrivee = (id) => { neuve = id ?? null; setTimeout(() => { if (neuve === id) neuve = null; }, 450); };
  let menu = null; // le petit menu ouvert
  let iaAttente = null; // {version, video} : une vidéo de l'IA qui entre dans la timeline
  // « Créer toutes les vidéos » : une ligne par tâche de la file, gardée jusqu'au prochain lancement
  let rendus = {lignes: [], projet: null, attente: false, vu: false};

  // ——— les vidéos du projet, telles que l'interface les montre ———
  function videos() {
    const P = o.projet();
    if (!P) return [];
    const liste = Array.isArray(P.sequences) && P.sequences.length ? P.sequences : [{id: P.sequence ?? '', nom: 'Vidéo 1'}];
    return liste.map((s, k) => {
      const ouverte = s.id === P.sequence || liste.length === 1;
      const src = ouverte ? P : s;
      const sortie = src.sortie ?? P.sortie ?? {};
      const montage = Array.isArray(src.montage) ? src.montage : [];
      let duree = 0;
      try { duree = ouverte ? o.dureeOuverte() : (montage.length ? o.dureeDe({montage, sortie}) : 0); } catch { duree = 0; }
      return {id: s.id, nom: s.nom || `Vidéo ${k + 1}`, ouverte, duree: Math.round(duree * 100) / 100, preset: sortie.preset ?? '', largeur: sortie.largeur ?? 0, hauteur: sortie.hauteur ?? 0, fps: sortie.fps ?? 0,
        plans: montage.filter((it) => it?.type === 'plan').length, cases: montage.filter((it) => it?.type === 'bloc').length,
        effets: (Array.isArray(src.indications) ? src.indications : []).length, dessus: (Array.isArray(src.superpositions) ? src.superpositions : []).length,
        vide: !montage.length, origine: s.origine ?? null};
    });
  }
  const ratioDe = (v) => o.formats()[v?.preset]?.ratio ?? '';
  const forme = (v, max = 13) => { const f = formeOnglet(v?.largeur, v?.hauteur, max); return `<i class="seq-forme" style="width:${f.l}px;height:${f.h}px"></i>`; };
  const noms = () => Object.fromEntries((o.projet()?.sequences ?? []).map((s) => [s.id, s.nom]));
  const bloque = () => { const r = o.bloque(); if (r) note(r, true); return !!r; };

  // ——— les onglets ———
  function infos(v) {
    const fmt = [ratioDe(v), v.largeur ? `${v.largeur} × ${v.hauteur}` : '', v.fps ? `${v.fps} i/s` : ''].filter(Boolean).join(' · ');
    const contenu = v.vide ? 'vide' : [dureeTexte(v.duree), pluriel(v.plans, 'plan'), v.cases ? pluriel(v.cases, 'case à créer', 'cases à créer') : ''].filter(Boolean).join(' · ');
    const ia = v.origine ? `Livrée par ${o.nomIA(v.origine.moteur)} (version ${v.origine.version}), ${v.origine.mode === 'plans' ? 'plan par plan' : 'comme un seul plan'}` : '';
    const geste = v.ouverte ? 'Double-clic pour la renommer, glisse pour changer l’ordre' : 'Un clic pour l’ouvrir, glisse pour changer l’ordre';
    return [v.nom, fmt, contenu, ia, geste].filter(Boolean).join('\n');
  }
  function onglet(v) {
    const nom = renommage?.id === v.id
      ? `<input class="seq-renommer" value="${esc(renommage.valeur)}" maxlength="80" spellcheck="false" aria-label="Nom de la vidéo">`
      : `<span class="seq-nom">${esc(v.nom)}</span>`;
    const petit = v.vide ? 'vide' : `<span class="seq-ratio">${esc(ratioDe(v))} · </span>${dureeOnglet(v.duree)}`;
    return `<div class="seq-onglet${v.ouverte ? ' ouverte' : ''}${v.vide ? ' vide' : ''}${neuve === v.id ? ' neuve' : ''}${occupe?.id === v.id ? ' attend' : ''}" role="tab" aria-selected="${v.ouverte}" data-seq="${esc(v.id)}" title="${esc(infos(v))}">
      ${forme(v)}${v.origine ? ic('etincelle', 'plein seq-ia') : ''}${nom}<small>${petit}</small>
      <button class="seq-points" data-seq-menu="${esc(v.id)}" title="Renommer, dupliquer, supprimer" aria-label="Menu de la vidéo">${ic('points')}</button></div>`;
  }
  /** Redessine les onglets si quelque chose a changé (jamais pendant un glissé ou un renommage : après). */
  function rendre() {
    if (!barre) return;
    const P = o.projet();
    if (!P) {
      barre.classList.add('cache');
      barre.innerHTML = '';
      barre.dataset.cle = '';
      seul?.classList.add('cache');
      return;
    }
    const liste = videos();
    const plusieurs = liste.length > 1;
    barre.classList.toggle('cache', !plusieurs);
    if (seul) {
      seul.classList.toggle('cache', plusieurs);
      seul.classList.toggle('actif', !!menu && menu.dataset.pour === 'plus');
    }
    if (!plusieurs) {
      if (barre.innerHTML) { barre.innerHTML = ''; barre.dataset.cle = ''; }
      return;
    }
    if (glisse || renommage) { aRedessiner = true; return; }
    const cle = JSON.stringify([liste, occupe?.id ?? null]);
    if (barre.dataset.cle === cle) return;
    dessiner(liste, cle);
  }
  function dessiner(liste = videos(), cle = null) {
    aRedessiner = false;
    const avant = barre.querySelector('.seq-onglets')?.scrollLeft ?? 0;
    // un nom en train d'être tapé garde son curseur (seul un nouveau champ est tout sélectionné)
    const ancien = barre.querySelector('.seq-renommer');
    const curseur = ancien && document.activeElement === ancien ? [ancien.selectionStart, ancien.selectionEnd] : null;
    const pleines = liste.filter((v) => !v.vide).length;
    barre.dataset.cle = cle ?? '';
    barre.classList.toggle('serre', liste.length > 6);
    redessin = true;
    barre.innerHTML = `<div class="seq-onglets" role="tablist" aria-label="Les vidéos de ce projet">${liste.map(onglet).join('')}
      <button class="seq-ajout${menu?.dataset.pour === 'plus' ? ' actif' : ''}" data-seq-plus title="Une autre vidéo dans ce projet : vide, ou la copie de celle-ci">${ic('plus')}</button></div>
      <span class="espace"></span>
      ${pleines > 1 ? `<button class="seq-creer" data-seq-creer title="Dérush crée chaque vidéo qui a des plans, une à la fois. Il te dit avant combien de vidéos et combien de place.">${ic('rendu')}<span>Créer les ${pleines} vidéos</span></button>` : ''}`;
    redessin = false;
    // l'onglet ouvert reste visible (à la main : scrollIntoView ferait aussi défiler la fenêtre)
    const box = barre.querySelector('.seq-onglets');
    box.scrollLeft = avant;
    const el = barre.querySelector('.seq-onglet.ouverte');
    if (el && !renommage) {
      if (el.offsetLeft < box.scrollLeft) box.scrollLeft = Math.max(0, el.offsetLeft - 8);
      else if (el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = el.offsetLeft + el.offsetWidth - box.clientWidth + 8;
    }
    const z = barre.querySelector('.seq-renommer');
    if (z) {
      const vu = barre.querySelector(`.seq-onglet[data-seq="${CSS.escape(renommage.id)}"]`);
      if (vu && vu.offsetLeft + vu.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = vu.offsetLeft + vu.offsetWidth - box.clientWidth + 8;
      z.focus();
      if (curseur) z.setSelectionRange(...curseur);
      else z.select();
    }
  }
  /** Les onglets glissent de leur ancienne place à la nouvelle (après un changement d'ordre). */
  function positions() {
    return new Map([...barre.querySelectorAll('.seq-onglet')].map((el) => [el.dataset.seq, el.getBoundingClientRect().left]));
  }
  function animerDepuis(avant) {
    if (!avant || typeof Element.prototype.animate !== 'function') return;
    for (const el of barre.querySelectorAll('.seq-onglet')) {
      const x0 = avant.get(el.dataset.seq);
      if (x0 == null) continue;
      const dx = x0 - el.getBoundingClientRect().left;
      if (Math.abs(dx) >= 1) el.animate([{transform: `translateX(${dx}px)`}, {transform: 'none'}], {duration: 190, easing: 'cubic-bezier(.22,.8,.24,1)'});
    }
  }
  /** La liste rendue par le serveur ({sequence, sequences}) : l'ordre et les noms, sans toucher au contenu. */
  function appliquerListe(r) {
    const P = o.projet();
    if (!P || !Array.isArray(r?.sequences)) return;
    const parId = new Map((P.sequences ?? []).map((s) => [s.id, s]));
    const neuf = [];
    for (const x of r.sequences) {
      const s = parId.get(x.id);
      if (s) { s.nom = x.nom; neuf.push(s); }
    }
    // une vidéo que cette fenêtre ne connaît pas, ou qu'elle croit encore là (ne devrait pas arriver) : le projet est relu.
    // (La vidéo ouverte n'est pas comparée : une réponse partie juste avant un changement de vidéo arrive après lui.)
    if (neuf.length !== r.sequences.length || neuf.length !== (P.sequences ?? []).length) return o.recharger();
    P.sequences = neuf;
    rendre();
    o.rendreIA();
  }

  // ——— les gestes ———
  /** Ouvre une autre vidéo : la vidéo ouverte est d'abord enregistrée, puis le serveur range l'une et pose l'autre. */
  async function activer(id) {
    const P = o.projet();
    if (!P || !id || id === P.sequence || occupe) return;
    if (bloque()) return;
    fermerMenu();
    occupe = {quoi: 'activer', id};
    rendre();
    try {
      if (!(await o.sauver())) throw new Error('La vidéo ouverte n’a pas pu être enregistrée : Dérush la garde ouverte.');
      const r = await api('POST', '/api/sequences/activer', {id});
      occupe = null;
      o.poser(r.projet);
    } catch (e) { note(e.message, true); } finally { finir(); }
  }
  /** Une nouvelle vidéo, vide (au format de la vidéo ouverte), ou la copie d'une vidéo (true : la vidéo ouverte). */
  async function ajouter({copier = false} = {}) {
    const P = o.projet();
    if (!P || occupe) return;
    if (bloque()) return;
    fermerMenu();
    occupe = {quoi: 'ajouter'};
    rendre();
    try {
      if (!(await o.sauver())) throw new Error('La vidéo ouverte n’a pas pu être enregistrée : rien n’a changé.');
      const r = await api('POST', '/api/sequences', copier ? {copier} : {});
      arrivee(r.ajoutee);
      occupe = null;
      o.poser(r.projet);
      const v = videos().find((x) => x.id === r.ajoutee);
      if (v) {
        note(copier ? `« ${v.nom} » : la même vidéo, à changer sans toucher l’autre. Double-clic sur son onglet pour la renommer.`
          : `« ${v.nom} » est ouverte : une vidéo vide, au format ${ratioDe(v)}. Glisse tes rushes dedans, ou demande à ton IA.`);
      }
    } catch (e) { note(e.message, true); } finally { finir(); }
  }
  function finir() {
    occupe = null;
    rendre();
    o.rendreIA();
    const suite = apresOccupe;
    apresOccupe = null;
    if (suite) suite();
  }
  function commencerRenommage(id) {
    if (occupe) { apresOccupe = () => commencerRenommage(id); return; }
    const v = videos().find((x) => x.id === id);
    if (!v || videos().length < 2 || renommage?.id === id) return;
    fermerMenu();
    if (renommage) finirRenommage(true); // un autre nom était en cours : il est gardé
    renommage = {id, valeur: v.nom};
    dessiner();
  }
  async function finirRenommage(garder) {
    const r = renommage;
    if (!r) return;
    renommage = null;
    const P = o.projet();
    const s = P?.sequences?.find((x) => x.id === r.id);
    const nom = String(r.valeur ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (garder && s && nom && nom !== s.nom) {
      const avant = s.nom;
      s.nom = nom; // tout de suite à l'écran ; le serveur suit
      dessiner();
      o.rendreIA();
      try {
        appliquerListe(await api('PUT', `/api/sequences/${encodeURIComponent(r.id)}`, {nom}));
      } catch (e) {
        s.nom = avant;
        note(e.message, true);
      }
    }
    dessiner();
    o.rendreIA();
  }
  /** Le nouvel ordre des vidéos (ids) : tout de suite à l'écran, puis enregistré ; remis comme avant si le serveur refuse. */
  async function ordonner(ids, avant = null) {
    const P = o.projet();
    if (!P || !Array.isArray(P.sequences)) return;
    const ancien = P.sequences;
    const parId = new Map(ancien.map((s) => [s.id, s]));
    P.sequences = [...ids.map((id) => parId.get(id)).filter(Boolean), ...ancien.filter((s) => !ids.includes(s.id))];
    dessiner();
    animerDepuis(avant);
    o.rendreIA();
    try {
      appliquerListe(await api('POST', '/api/sequences/ordre', {ids: P.sequences.map((s) => s.id)}));
    } catch (e) {
      P.sequences = ancien;
      dessiner();
      note(e.message, true);
    }
  }
  /** Supprimer une vidéo : la page demande d'abord, avec ce qu'elle emporte. */
  function supprimer(id) {
    const liste = videos();
    const v = liste.find((x) => x.id === id);
    fermerMenu();
    if (!v) return;
    if (liste.length <= 1) return note('C’est la seule vidéo du projet : elle ne peut pas être supprimée.', true);
    if (v.ouverte && bloque()) return;
    const f = o.feuille(`<div class="seq-confirmer">
      <div class="seq-confirmer-tete">${forme(v, 22)}<div><h3>Supprimer « ${esc(v.nom)} » ?</h3><small>${esc([ratioDe(v), v.vide ? 'vide' : dureeTexte(v.duree)].filter(Boolean).join(' · '))}</small></div></div>
      <p class="sous-titre">${esc(phraseSuppression(v))}</p>
      ${v.ouverte ? `<p class="seq-fige">${ic('film')}<span>C’est la vidéo ouverte : sa voisine prendra sa place dans la timeline.</span></p>` : ''}
      <div class="pied"><button class="btn" data-non>Annuler</button><button class="btn principal" data-oui>${ic('poubelle')}Supprimer la vidéo</button></div></div>`);
    f.addEventListener('click', async (e) => {
      if (e.target.closest('[data-non]')) return o.fermerFeuille();
      const oui = e.target.closest('[data-oui]');
      if (!oui || oui.disabled || occupe) return;
      oui.disabled = true;
      occupe = {quoi: 'supprimer', id};
      try {
        if (!(await o.sauver())) throw new Error('La vidéo ouverte n’a pas pu être enregistrée : rien n’a changé.');
        const r = await api('DELETE', `/api/sequences/${encodeURIComponent(id)}`);
        o.fermerFeuille();
        occupe = null;
        const P = o.projet();
        if (v.ouverte || r.projet?.sequence !== P?.sequence) o.poser(r.projet);
        else if (P) P.sequences = r.projet.sequences;
        const ouverte = videos().find((x) => x.ouverte);
        note(v.ouverte && ouverte ? `« ${v.nom} » est supprimée. « ${ouverte.nom} » est ouverte.` : `« ${v.nom} » est supprimée.`);
      } catch (err) {
        note(err.message, true);
        oui.disabled = false;
      } finally { finir(); }
    });
  }

  // ——— le petit menu (d'un onglet, ou du « + ») ———
  function ouvrirMenu(html, ancre, pour, faire) {
    if (menu?.dataset.pour === pour) return fermerMenu(); // le même bouton referme son menu
    fermerMenu();
    const m = document.createElement('div');
    m.className = 'seq-menu';
    m.setAttribute('role', 'menu');
    m.dataset.pour = pour;
    m.innerHTML = html;
    document.body.append(m);
    // sous l'élément (ou au point du clic droit), sans sortir de la fenêtre
    const r = ancre && typeof ancre.left === 'number' ? ancre : {left: ancre?.x ?? 0, top: ancre?.y ?? 0, bottom: ancre?.y ?? 0};
    const b = m.getBoundingClientRect();
    const x = Math.max(8, Math.min(r.left, innerWidth - b.width - 8));
    let y = r.bottom + 4;
    if (y + b.height > innerHeight - 8) y = Math.max(8, r.top - b.height - 4);
    m.style.left = `${x}px`;
    m.style.top = `${y}px`;
    m.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-seq-act]');
      if (!btn || btn.disabled) return;
      fermerMenu();
      faire(btn.dataset.seqAct);
    });
    menu = m;
    rendre();
    seul?.classList.toggle('actif', pour === 'plus');
    barre?.querySelector('[data-seq-plus]')?.classList.toggle('actif', pour === 'plus');
  }
  function fermerMenu() {
    if (!menu) return;
    menu.remove();
    menu = null;
    seul?.classList.remove('actif');
    barre?.querySelector('[data-seq-plus]')?.classList.remove('actif');
  }
  function menuVideo(id, ancre) {
    const liste = videos();
    const v = liste.find((x) => x.id === id);
    if (!v) return;
    ouvrirMenu(`<button data-seq-act="renommer" role="menuitem">${ic('crayon')}<span>Renommer</span></button>
      <button data-seq-act="dupliquer" role="menuitem">${ic('dupliquer')}<span>Dupliquer</span></button>
      ${!v.ouverte ? `<button data-seq-act="ouvrir" role="menuitem">${ic('film')}<span>Ouvrir dans la timeline</span></button>` : ''}
      <i class="seq-sep"></i>
      <button data-seq-act="supprimer" class="danger" role="menuitem"${liste.length <= 1 ? ' disabled title="C’est la seule vidéo du projet"' : ''}>${ic('poubelle')}<span>Supprimer…</span></button>`, ancre, `video:${id}`, (act) => {
      if (act === 'renommer') return commencerRenommage(id);
      if (act === 'dupliquer') return ajouter({copier: v.ouverte ? true : id});
      if (act === 'ouvrir') return activer(id);
      if (act === 'supprimer') return supprimer(id);
    });
  }
  function menuPlus(ancre) {
    const P = o.projet();
    if (!P) return;
    const ouverte = videos().find((v) => v.ouverte);
    ouvrirMenu(`<button data-seq-act="vide" role="menuitem">${ic('plus')}<span><b>Nouvelle vidéo</b><small>vide, au format ${esc(ratioDe(ouverte))}</small></span></button>
      <button data-seq-act="copie" role="menuitem"${ouverte?.vide ? ' disabled' : ''}>${ic('dupliquer')}<span><b>Dupliquer « ${esc(ouverte?.nom ?? '')} »</b><small>${ouverte?.vide ? 'elle est vide pour l’instant' : 'les mêmes plans, pour une variante'}</small></span></button>`,
    ancre, 'plus', (act) => (act === 'copie' ? ajouter({copier: true}) : ajouter()));
  }
  document.addEventListener('pointerdown', (e) => {
    if (menu && !menu.contains(e.target) && !e.target.closest?.('[data-seq-menu], [data-seq-plus], #b-seq-plus')) fermerMenu();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (menu && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermerMenu(); }
  }, true);
  window.addEventListener('resize', fermerMenu);
  window.addEventListener('blur', fermerMenu);
  seul?.addEventListener('click', () => menuPlus(seul.getBoundingClientRect()));

  // ——— la souris sur les onglets : un clic ouvre, on glisse pour l'ordre, double-clic pour renommer ———
  function annulerGlisse() {
    const g = glisse;
    glisse = null;
    if (!g) return;
    barre.classList.remove('en-glisse');
    for (const el of barre.querySelectorAll('.seq-onglet')) { el.style.transform = ''; el.classList.remove('glisse'); }
    if (aRedessiner) rendre();
  }
  barre?.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || renommage) return;
    const el = e.target.closest('.seq-onglet');
    if (!el || e.target.closest('.seq-points, input')) return;
    fermerMenu();
    glisse = {id: el.dataset.seq, el, x0: e.clientX, pointerId: e.pointerId, actif: false};
    try { el.setPointerCapture(e.pointerId); } catch { /* pas de capture : le glissé reste dans la barre */ }
  });
  barre?.addEventListener('pointermove', (e) => {
    const g = glisse;
    if (!g || e.pointerId !== g.pointerId) return;
    const dx = e.clientX - g.x0;
    if (!g.actif) {
      if (Math.abs(dx) < 5) return;
      const tous = [...barre.querySelectorAll('.seq-onglet')];
      const r = g.el.getBoundingClientRect();
      Object.assign(g, {actif: true, ids: tous.map((x) => x.dataset.seq), largeur: r.width + 2, centre: r.left + r.width / 2, autres: tous.filter((x) => x !== g.el)});
      g.milieux = g.autres.map((x) => { const b = x.getBoundingClientRect(); return b.left + b.width / 2; });
      g.k = g.ids.indexOf(g.id);
      barre.classList.add('en-glisse');
      g.el.classList.add('glisse');
    }
    g.el.style.transform = `translateX(${dx}px)`;
    const k = placeDepot(g.milieux, g.centre + dx);
    if (k === g.k) return;
    g.k = k;
    // les autres onglets s'écartent pour lui faire la place, comme les onglets d'un navigateur
    const ordre = ordreApres(g.ids, g.id, k);
    for (const x of g.autres) {
      const d = ordre.indexOf(x.dataset.seq) - g.ids.indexOf(x.dataset.seq);
      x.style.transform = d ? `translateX(${d * g.largeur}px)` : '';
    }
  });
  barre?.addEventListener('pointerup', (e) => {
    const g = glisse;
    if (!g || e.pointerId !== g.pointerId) return;
    try { g.el.releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
    if (!g.actif) {
      glisse = null;
      const b = g.el.getBoundingClientRect();
      if (e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom) activer(g.id);
      if (aRedessiner) rendre();
      return;
    }
    const ordre = ordreApres(g.ids, g.id, g.k);
    const avant = positions();
    glisse = null;
    barre.classList.remove('en-glisse');
    if (ordre.join() !== g.ids.join()) return ordonner(ordre, avant);
    dessiner();
    animerDepuis(avant);
  });
  barre?.addEventListener('pointercancel', annulerGlisse);
  // beaucoup d'onglets : la molette les fait défiler de côté
  barre?.addEventListener('wheel', (e) => {
    const box = barre.querySelector('.seq-onglets');
    if (!box || box.scrollWidth <= box.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    box.scrollLeft += e.deltaY;
    e.preventDefault();
  }, {passive: false});
  barre?.addEventListener('lostpointercapture', (e) => { if (glisse && e.pointerId === glisse.pointerId && glisse.actif) annulerGlisse(); });
  barre?.addEventListener('dblclick', (e) => {
    const el = e.target.closest('.seq-onglet');
    if (el && !e.target.closest('.seq-points, input')) commencerRenommage(el.dataset.seq);
  });
  barre?.addEventListener('contextmenu', (e) => {
    const el = e.target.closest('.seq-onglet');
    if (!el || e.target.closest('input')) return;
    e.preventDefault();
    menuVideo(el.dataset.seq, {x: e.clientX, y: e.clientY});
  });
  barre?.addEventListener('click', (e) => {
    const m = e.target.closest('[data-seq-menu]');
    if (m) return menuVideo(m.dataset.seqMenu, m.getBoundingClientRect());
    const plus = e.target.closest('[data-seq-plus]');
    if (plus) return menuPlus(plus.getBoundingClientRect());
    if (e.target.closest('[data-seq-creer]')) return feuilleCreer({choix: 'toutes'});
  });
  // le nom tapé : Entrée garde, Échap annule, un clic ailleurs garde
  barre?.addEventListener('input', (e) => { if (renommage && e.target.classList?.contains('seq-renommer')) renommage.valeur = e.target.value; });
  barre?.addEventListener('keydown', (e) => {
    if (!e.target.classList?.contains('seq-renommer')) return;
    if (e.key === 'Enter') { e.preventDefault(); finirRenommage(true); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finirRenommage(false); }
  });
  // (seulement le champ de la vidéo qu'on renomme : un champ retiré de la page en redessinant ne compte pas)
  barre?.addEventListener('focusout', (e) => {
    if (!redessin && e.target.classList?.contains('seq-renommer') && e.target.closest('.seq-onglet')?.dataset.seq === renommage?.id && e.target.isConnected) finirRenommage(true);
  });

  // ——— « Créer la vidéo » quand le projet en a plusieurs : celle-ci, ou toutes ———
  const FIGEE = 'Elle est figée au clic : tes retouches suivantes n’y entreront pas, et tu peux continuer à monter pendant qu’elle se crée.';
  const FIGEES = 'Chaque vidéo est figée au clic, et Dérush les crée une à la fois, dans l’ordre des onglets : tu peux continuer à monter pendant ce temps.';
  function lignePlan(x) {
    const f = formeOnglet(x.format?.largeur, x.format?.hauteur);
    const ratio = o.formats()[x.format?.preset]?.ratio ?? '';
    return `<div class="seq-plan-ligne${x.vide ? ' vide' : ''}"><i class="seq-forme" style="width:${f.l}px;height:${f.h}px"></i><b>${esc(x.nom)}</b>
      <small>${esc([ratio, x.vide ? 'vide, rien à créer' : dureeOnglet(x.duree_s)].filter(Boolean).join(' · '))}</small><span>${x.vide ? '' : esc(`environ ${tailleLisible(x.taille_estimee)}`)}</span></div>`;
  }
  async function feuilleCreer({choix = null} = {}) {
    if (!o.projet()) return;
    fermerMenu();
    const liste = videos();
    const ouverte = liste.find((v) => v.ouverte) ?? liste[0];
    let mode = choix === 'toutes' || ouverte.vide ? 'toutes' : 'une';
    let plan = null;
    let erreur = null;
    let compte = false;
    const mo = o.moteurRendu();
    const f = o.feuille(`<div class="seq-creer-feuille">
      <h3>Créer la vidéo</h3>
      <p class="sous-titre">Dérush fabrique la vidéo finale sur ton ordinateur : le montage, les effets, les titres et les sous-titres, avec le son au niveau des réseaux.</p>
      <div class="segmente seq-choix" role="tablist">
        <button data-choix="une"${ouverte.vide ? ' disabled title="Elle est vide : pose d’abord au moins un plan"' : ''}>${forme(ouverte)}<span>Celle-ci · « ${esc(ouverte.nom)} »</span></button>
        <button data-choix="toutes">${ic('calques')}<span>Toutes les vidéos (${liste.length})</span></button>
      </div>
      <label class="champ"><span>Pour quel réseau ?</span><select id="cr-reseau">${o.reseaux().map((r) => `<option value="${esc(r.k)}"${r.choisi ? ' selected' : ''}>${esc(r.nom)}</option>`).join('')}</select></label>
      <div class="seq-creer-corps"></div>
      ${mo?.ok ? '' : `<div class="verif attention petit">${ic('attention')}<div class="espace">La première fois, le moteur de rendu s’installe tout seul (${esc(mo?.taille ?? '500 Mo')}, il faut Internet). Compte quelques minutes de plus.</div></div>`}
      <div class="pied"><button class="btn" data-fermer>Annuler</button><button class="btn principal" data-go>${ic('rendu')}<span>Créer la vidéo</span></button></div></div>`);
    const corps = f.querySelector('.seq-creer-corps');
    const go = f.querySelector('[data-go]');
    const dessinerCorps = () => {
      for (const b of f.querySelectorAll('[data-choix]')) b.classList.toggle('actif', b.dataset.choix === mode);
      f.querySelector('h3').textContent = mode === 'une' ? 'Créer la vidéo' : 'Créer toutes les vidéos';
      if (mode === 'une') {
        corps.innerHTML = `<p class="dim seq-resume">${esc(o.resumeOuverte())}</p><p class="seq-fige">${ic('cadenas')}<span>${esc(FIGEE)}</span></p>`;
        go.disabled = ouverte.vide;
        go.querySelector('span').textContent = 'Créer la vidéo';
        return;
      }
      if (erreur) {
        corps.innerHTML = `<div class="verif attention petit">${ic('attention')}<div class="espace">${esc(erreur)}</div></div>`;
        go.disabled = true;
        return;
      }
      if (!plan) {
        corps.innerHTML = `<p class="dim seq-compte"><i class="seq-tourne"></i>Dérush compte les vidéos et la place qu’elles prendront…</p>`;
        go.disabled = true;
        return;
      }
      const R = resumePlan(plan);
      corps.innerHTML = `<div class="seq-plan">${plan.videos.map(lignePlan).join('')}</div>
        <p class="seq-total"><b>${esc(R.total)}</b></p>
        ${R.vides ? `<p class="dim seq-vides">${esc(R.vides)}</p>` : ''}
        ${R.place.texte ? `<div class="verif petit ${R.place.classe === 'ok' ? 'ok' : 'attention'}${R.place.classe === 'refus' ? ' seq-refus' : ''}">${ic(R.place.classe === 'ok' ? 'ok' : 'attention')}<div class="espace">${esc(R.place.texte)}</div></div>` : ''}
        <p class="seq-fige">${ic('cadenas')}<span>${esc(FIGEES)}</span></p>`;
      go.disabled = !R.ok;
      go.querySelector('span').textContent = R.bouton;
    };
    const chargerPlan = async () => {
      if (compte) return;
      compte = true;
      erreur = null;
      try {
        // le plan parle de la vidéo ouverte telle qu'elle est à l'écran
        await o.sauver();
        plan = await api('GET', '/api/sequences/rendre');
      } catch (e) { erreur = e.message; }
      compte = false;
      if (f.isConnected) dessinerCorps();
    };
    f.addEventListener('click', async (e) => {
      if (e.target.closest('[data-fermer]')) return o.fermerFeuille();
      const c = e.target.closest('[data-choix]');
      if (c) {
        if (c.disabled) return;
        mode = c.dataset.choix;
        dessinerCorps();
        if (mode === 'toutes' && !plan) chargerPlan();
        return;
      }
      if (!e.target.closest('[data-go]') || go.disabled) return;
      const plateforme = f.querySelector('#cr-reseau').value;
      if (mode === 'une') return o.creerOuverte(plateforme);
      go.disabled = true;
      await lancerToutes(plateforme);
      if (f.isConnected && !document.querySelector('#seq-rendus')) go.disabled = false;
    });
    dessinerCorps();
    if (mode === 'toutes') chargerPlan();
  }
  async function lancerToutes(plateforme) {
    o.avantRendu();
    if (!(await o.sauver())) return note('La vidéo ouverte n’a pas pu être enregistrée : rien n’est lancé.', true);
    try {
      const r = await api('POST', '/api/sequences/rendre', {plateforme});
      rendus = {lignes: (r.taches ?? []).map((x) => ({tache: x.tache, sequence: x.sequence, nom: x.nom, t: null, absente: 0})), projet: o.cleProjet(), attente: false, vu: false};
      montrerSuivi();
      o.suivreFile();
    } catch (e) { note(e.message, true); }
  }
  function etatLigne(l) {
    const t = l.t;
    if (!t) return 'attente';
    return {fini: 'fini', erreur: 'erreur', inconnu: 'fini', attente: 'attente'}[t.etat] ?? 'cours';
  }
  function ligneRendu(l) {
    const etat = etatLigne(l);
    const t = l.t;
    const r = t?.resultat;
    const soucis = (r?.controles ?? []).filter((c) => !c.ok).length;
    const p = Math.round((Number(t?.progression) || 0) * 100);
    const detail = t?.etat === 'inconnu' ? 'Finie : elle est dans le dossier « vidéos » du projet.'
      : etat === 'fini' ? [r?.largeur ? `${r.largeur} × ${r.hauteur}` : '', r?.duree ? dureeTexte(r.duree) : '', r?.taille_lisible ?? '', r ? (soucis ? `${pluriel(soucis, 'point')} à voir` : 'contrôles OK') : ''].filter(Boolean).join(' · ')
        : etat === 'erreur' ? (t.erreur || 'Elle n’a pas pu être créée.')
          : etat === 'cours' ? `${p} %` : 'en attente';
    const icone = etat === 'fini' ? ic('ok') : etat === 'erreur' ? ic('attention') : etat === 'cours' ? '<i class="seq-tourne"></i>' : ic('horloge');
    return `<div class="seq-rendu e-${etat}${soucis ? ' soucis' : ''}" data-tache="${esc(l.tache)}">
      <span class="seq-rendu-icone">${icone}</span><span class="seq-rendu-txt"><b>${esc(l.nom)}</b><small>${esc(detail)}</small>${etat === 'cours' ? `<span class="seq-rendu-barre"><i style="width:${Math.max(3, p)}%"></i></span>` : ''}</span>
      ${etat === 'fini' && r ? `<button class="btn petit" data-voir="${esc(l.tache)}">${ic('lire', 'plein')}Voir</button>` : ''}</div>`;
  }
  const signeLigne = (l) => `${etatLigne(l)}:${Math.round((Number(l.t?.progression) || 0) * 50)}:${l.t?.etat ?? ''}`;
  function montrerSuivi() {
    const n = rendus.lignes.length;
    const f = o.feuille(`<div id="seq-rendus" class="seq-rendus-feuille">
      <h3>Création de ${pluriel(n, 'vidéo')}…</h3>
      <p class="sous-titre">${esc(FIGEES)}</p>
      <div class="seq-rendus">${rendus.lignes.map(ligneRendu).join('')}</div>
      <div class="jauge"><i data-seq-jauge style="width:2%"></i></div>
      <div class="pied"><button class="btn" data-fermer>Masquer</button></div></div>`);
    f.addEventListener('click', (e) => {
      if (e.target.closest('[data-fermer]')) return o.fermerFeuille();
      const v = e.target.closest('[data-voir]');
      if (v) voir(v.dataset.voir);
    });
    for (const el of f.querySelectorAll('.seq-rendu')) el.dataset.signe = signeLigne(rendus.lignes.find((l) => String(l.tache) === el.dataset.tache));
    majSuivi();
  }
  /** La feuille du suivi, si elle est ouverte : seules les lignes qui ont changé sont refaites (un clic sur « Voir » n'est jamais perdu). */
  function majSuivi() {
    const box = document.querySelector('#seq-rendus');
    if (!box) return;
    for (const l of rendus.lignes) {
      const el = box.querySelector(`.seq-rendu[data-tache="${CSS.escape(String(l.tache))}"]`);
      const s = signeLigne(l);
      if (!el || el.dataset.signe === s) continue;
      el.outerHTML = ligneRendu(l);
      const neuf = box.querySelector(`.seq-rendu[data-tache="${CSS.escape(String(l.tache))}"]`);
      if (neuf) neuf.dataset.signe = s;
    }
    const e = etatRendus(rendus.lignes);
    const j = box.querySelector('[data-seq-jauge]');
    if (j) j.style.width = `${Math.max(2, Math.round(e.progression * 100))}%`;
  }
  function voir(tache) {
    const l = rendus.lignes.find((x) => String(x.tache) === String(tache));
    if (l?.t?.resultat) o.voirRendu(l.t, () => montrerRendus());
  }
  /** Relu à chaque tour de la file (app.js, suivreFile) : chaque tâche avance, et la fin s'affiche quand la fenêtre est libre. */
  function suivreRendus() {
    if (!rendus.lignes.length || rendus.vu) return;
    if (rendus.projet !== o.cleProjet()) { rendus = {lignes: [], projet: null, attente: false, vu: false}; return; }
    const f = o.file();
    if (!f) return;
    const toutes = [f.en_cours, ...(f.attente ?? []), ...(f.recents ?? [])].filter(Boolean);
    for (const l of rendus.lignes) {
      if (['fini', 'erreur', 'inconnu'].includes(l.t?.etat)) continue;
      const t = toutes.find((x) => String(x.id) === String(l.tache));
      if (t) { l.t = t; l.absente = 0; continue; }
      // sortie de la file sans qu'on la voie finir (la fenêtre dormait) : elle est finie, son détail est perdu
      l.absente = (l.absente ?? 0) + 1;
      if (l.t || l.absente > 20) l.t = {etat: 'inconnu'};
    }
    majSuivi();
    const e = etatRendus(rendus.lignes);
    if (!e.fini) return;
    if (o.libre()) return montrerRendus();
    if (!rendus.attente) {
      rendus.attente = true;
      note(e.finies ? `${e.finies > 1 ? `Tes ${e.finies} vidéos sont prêtes` : 'Ta vidéo est prête'} : elles s’afficheront quand tu auras fini.` : 'Les vidéos n’ont pas pu être créées : le détail s’affichera quand tu auras fini.', !e.finies, !!e.finies);
    }
  }
  /** La fin de « Créer toutes les vidéos » : chaque vidéo, son état, et « Voir » pour la regarder, l'analyser, la partager. */
  function montrerRendus() {
    if (!rendus.lignes.length) return;
    rendus.attente = false;
    rendus.vu = true;
    const e = etatRendus(rendus.lignes);
    const premiere = rendus.lignes.find((l) => l.t?.resultat?.video)?.t.resultat.video;
    const f = o.feuille(`<div class="seq-rendus-feuille fini">
      <h3>${e.finies ? ic('ok') : ic('attention')} ${esc(titreRendus(e))}</h3>
      <p class="sous-titre">${e.finies ? 'Dans le dossier « vidéos » du projet, chacune à son nom. « Voir » la montre, avec Analyser et Partager.' : 'Le détail de chaque vidéo est ci-dessous.'}</p>
      <div class="seq-rendus">${rendus.lignes.map(ligneRendu).join('')}</div>
      <div class="pied">${premiere ? `<button class="btn" data-dossier>${ic('finder')}Afficher dans le dossier</button>` : ''}<span class="espace"></span><button class="btn principal" data-fermer>OK</button></div></div>`, true);
    f.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-fermer]')) return o.fermerFeuille();
      if (ev.target.closest('[data-dossier]') && premiere) return o.ouvrirChemin(premiere);
      const v = ev.target.closest('[data-voir]');
      if (v) voir(v.dataset.voir);
    });
  }
  const suit = () => rendus.lignes.length > 0 && !rendus.vu && rendus.projet === o.cleProjet() && !etatRendus(rendus.lignes).fini;
  const enAttente = () => rendus.attente && rendus.projet === o.cleProjet();

  // ——— l'écran de l'IA : « Mettre dans ma timeline » sous ses vidéos ———
  function boutonVideoIA(v, x, k) {
    const P = o.projet();
    if (!P || !x) return '';
    const rang = Number.isInteger(x.rang) ? x.rang : k;
    const L = libelleVideoIA(x, {noms: noms(), ouverte: P.sequence});
    if (iaAttente && iaAttente.version === v.n && (iaAttente.video === rang || iaAttente.video == null) && L.quoi === 'mettre') {
      return `<div class="cl-seq"><button class="btn petit seq-livree" disabled><i class="seq-tourne"></i><span>Dans ta timeline…</span></button></div>`;
    }
    if (L.quoi === 'ici') return `<div class="cl-seq ici">${ic('coche')}<span>${esc(L.bouton)}</span><small>${esc(L.sous)}</small></div>`;
    const attr = L.quoi === 'ouvrir' ? `data-cl="seq-ouvrir" data-seq="${esc(L.id)}" title="${esc(`${L.bouton} : la vidéo de ta timeline faite de celle-ci`)}"`
      : `data-cl="seq-mettre" data-v="${v.n}" data-rang="${rang}" title="${esc(x.timeline === 'plans' ? 'Une nouvelle vidéo dans ta timeline, avec les plans de l’IA : coupe, déplace, remplace comme tu veux.' : 'Une nouvelle vidéo dans ta timeline, avec la vidéo de l’IA comme un seul plan.')}"`;
    const lot = (v.videos?.length ?? 1) > 1;
    return `<div class="cl-seq"><button class="btn petit seq-livree" ${attr}${iaAttente || occupe ? ' disabled' : ''}>${ic('film')}<span>${esc(lot ? L.court : L.bouton)}</span></button><small>${esc(L.sous)}</small></div>`;
  }
  function boutonLotIA(v) {
    if ((v?.videos?.length ?? 0) < 2 || !o.projet()) return '';
    const L = libelleLotIA(v, {noms: noms()});
    if (L.quoi === 'ici') return `<div class="seq-lot ici">${ic('coche')}<span><b>${esc(L.bouton)}</b><small>${esc(L.sous)}</small></span></div>`;
    const enCours = iaAttente && iaAttente.version === v.n && iaAttente.video == null;
    return `<button class="seq-lot" data-cl="seq-mettre-tout" data-v="${v.n}"${iaAttente || occupe ? ' disabled' : ''}>${enCours ? '<i class="seq-tourne"></i>' : ic('film')}<span><b>${esc(enCours ? 'Dérush les pose dans ta timeline…' : L.bouton)}</b><small>${esc(L.sous)}</small></span></button>`;
  }
  /** Une vidéo de l'IA (ou toutes celles d'une version) devient une vidéo de la timeline, et s'ouvre. */
  async function depuisIA({version, video = null}) {
    if (!o.projet() || iaAttente || occupe) return;
    if (bloque()) return;
    iaAttente = {version, video};
    occupe = {quoi: 'ia'};
    o.rendreIA();
    try {
      if (!(await o.sauver())) throw new Error('La vidéo ouverte n’a pas pu être enregistrée : rien n’a changé.');
      const r = await api('POST', '/api/sequences/depuis-ia', video == null ? {version} : {version, video});
      arrivee((r.faites ?? []).find((x) => !x.deja)?.id);
      iaAttente = null;
      occupe = null;
      o.poser(r.projet);
      const phrase = phraseApresIA(r);
      if (phrase) note(phrase, false, (r.faites ?? []).some((x) => !x.deja));
      for (const err of r.erreurs ?? []) note(err, true);
    } catch (e) { note(e.message, true); } finally {
      iaAttente = null;
      finir();
    }
  }
  async function clic(act, el) {
    if (act === 'seq-ouvrir') return activer(el?.dataset.seq);
    if (act === 'seq-mettre') return depuisIA({version: Number(el?.dataset.v), video: Number(el?.dataset.rang)});
    if (act === 'seq-mettre-tout') return depuisIA({version: Number(el?.dataset.v)});
  }
  /** Ce qui change l'écran de l'IA (pour la clé de rendreClaude) : la vidéo ouverte, les noms, ce qui est en route. */
  const signature = () => JSON.stringify([o.projet()?.sequence ?? null, (o.projet()?.sequences ?? []).map((s) => [s.id, s.nom]), iaAttente, occupe?.quoi ?? null]);
  /** Au-dessus de la zone d'écriture, quand le projet a plusieurs vidéos : pour laquelle vaut la demande. */
  function ligneIA() {
    const liste = videos();
    if (liste.length < 2) return '';
    const k = liste.findIndex((v) => v.ouverte);
    const v = liste[k];
    if (!v) return '';
    return `<div class="cl-video-ouverte" title="Ton IA reçoit la vidéo ouverte dans la timeline (ses plans, son format) et sait qu’il y en a d’autres. Ouvre un autre onglet pour lui parler d’une autre vidéo.">${forme(v, 11)}<span>Ta demande vaut pour <b>« ${esc(v.nom)} »</b></span><small>${k + 1} sur ${liste.length}</small></div>`;
  }
  /** « … dans « nom » » quand le projet a plusieurs vidéos (la découpe de l'IA va dans la vidéo ouverte), sinon rien. */
  function dansOuverte() {
    const liste = videos();
    const v = liste.find((x) => x.ouverte);
    return liste.length > 1 && v ? v.nom : '';
  }
  function oublier() {
    fermerMenu();
    annulerGlisse();
    renommage = null;
    occupe = null;
    apresOccupe = null;
    iaAttente = null;
    neuve = null;
    rendus = {lignes: [], projet: null, attente: false, vu: false};
    if (barre) barre.dataset.cle = '';
    rendre();
  }

  return {
    rendre, activer, ajouter, renommer: commencerRenommage, ordonner, supprimer, videos,
    feuilleCreer, suivreRendus, suit, enAttente, montrerRendus,
    boutonVideoIA, boutonLotIA, clic, depuisIA, signature, ligneIA, dansOuverte,
    occupe: () => !!occupe, oublier, fermerMenu,
  };
}
