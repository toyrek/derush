// Dérush — la porte des IA, côté fenêtre : les gestes d'une IA branchée sur Dérush (lib/porte-ia.mjs) sont joués ici,
// sur le montage tel qu'il est à l'écran. Chacun passe par modifier() : un seul ⌘Z l'annule, comme un geste fait à la
// main. Pendant qu'elle travaille, un curseur à son nom glisse sur la timeline et dit ce qu'elle fait.
import {FORMATS, CADENCES, GENRES_BLOC, sequence, segmentA, surGrille, borner, arrondi, nouvelId, couleurPropre, couleurAuto, dureeLisible, REGLAGES_COULEUR, vitesseDe, sourceDe, fonduPropre, VITESSE_MIN, VITESSE_MAX, nomVitesse, transitionPropre, transitionsDuMontage, AMBIANCES} from '/commun.js';
import {CATALOGUE, LOOKS, POLICES, STYLES_SOUS_TITRES, styleComplet, reglagesDe, resumeEffet} from '/moteur.js';

const t3 = (x) => arrondi(Number(x) || 0, 3);
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const COULEURS_IA = {Claude: '#D97757', 'Claude Code': '#D97757', ChatGPT: '#10A37F', Gemini: '#4285F4', Cursor: '#E8E8E8', Copilot: '#8957E5', Windsurf: '#09B6A2'};
/** Une erreur dite à l'IA (rien n'a changé). */
const refus = (texte) => { throw new Error(texte); };
const nombre = (v) => (v === undefined || v === null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : refus(`« ${v} » n’est pas un nombre.`));

/**
 * `c` : ce que la fenêtre donne à la porte (le projet ouvert, modifier(), la tête de lecture…). Rend {demarrer, etat}.
 */
export function creerPorte(c) {
  const P = () => c.P() ?? refus('Aucun projet n’est ouvert dans Dérush : ouvre-en un (ou crées-en un), puis recommence.');
  const media = (id) => c.media(String(id ?? '')) ?? refus(`Média inconnu : ${id}. lister_medias donne les identifiants (M1, M2…).`);
  const fpsM = (m) => m?.fps || P().sortie.fps;
  const seq = () => sequence(P());
  const quoi = (id) => {
    const p = P();
    const k = p.montage.findIndex((x) => x.id === id);
    if (k >= 0) return {ou: 'montage', it: p.montage[k], k};
    const s = p.superpositions.find((x) => x.id === id);
    if (s) return {ou: 'dessus', it: s};
    const i = p.indications.find((x) => x.id === id);
    if (i) return {ou: CATALOGUE[i.modele] ? 'effet' : 'note', it: i};
    const mq = (p.marqueurs ?? []).find((x) => x.id === id);
    if (mq) return {ou: 'marqueur', it: mq};
    return null;
  };
  const trouver = (id) => quoi(String(id ?? '')) ?? refus(`Élément inconnu : ${id}. lire_projet donne les identifiants.`);
  const segDe = (id) => seq().segs.find((s) => s.it.id === id) ?? null;

  // ——— la présence de l'IA : un curseur à son nom sur la timeline ———
  let curseur = null;
  let effacer = null;
  function presence(ia, {t = null, id = null, texte = ''} = {}) {
    try {
      const tl = document.querySelector('#tl-interieur');
      if (!tl) return;
      if (!curseur || !curseur.isConnected) {
        curseur = document.createElement('div');
        curseur.className = 'porte-curseur';
        curseur.innerHTML = '<span class="porte-pointe"></span><span class="porte-nom"></span><span class="porte-bulle"></span>';
        tl.append(curseur);
      }
      const teinte = COULEURS_IA[ia] ?? '#B39DDB';
      curseur.style.setProperty('--ia', teinte);
      document.documentElement.style.setProperty('--ia-touche', teinte);
      curseur.querySelector('.porte-nom').textContent = ia;
      const b = curseur.querySelector('.porte-bulle');
      b.textContent = texte;
      b.classList.remove('neuve');
      void b.offsetWidth;
      b.classList.add('neuve');
      if (Number.isFinite(t)) {
        curseur.style.left = `${Math.max(0, t * c.pps())}px`;
        c.montrer(t);
      }
      curseur.classList.add('visible');
      if (id) {
        for (const el of document.querySelectorAll(`[data-id="${CSS.escape(String(id))}"]`)) {
          el.classList.remove('porte-touche');
          void el.offsetWidth;
          el.classList.add('porte-touche');
        }
      }
      clearTimeout(effacer);
      effacer = setTimeout(() => curseur?.classList.remove('visible'), 6000);
    } catch { /* la présence n'est qu'un dessin */ }
  }

  // ——— ce qu'on rend à l'IA ———
  const vueSon = (s = {}) => ({...(s.actif === false ? {coupe: true} : {}), ...(s.gain_db ? {gain_db: s.gain_db} : {}), ...(s.version && s.version !== 'original' ? {version: s.version} : {}),
    ...(s.avant_s ? {avant_s: s.avant_s} : {}), ...(s.apres_s ? {apres_s: s.apres_s} : {})});
  /** La transition qui amène un plan, telle qu'elle se joue : son genre, la durée voulue et celle que les fichiers permettent. */
  function vueTransition(it) {
    const pass = transitionsDuMontage(P(), sequence(P()), c.media).passages.find((x) => x.entrant === it.id);
    return {genre: it.transition.genre, duree_voulue: it.transition.duree, duree_tenue: pass && !pass.impossible ? t3(2 * pass.demi) : 0, ...(pass?.impossible ? {impossible: true} : {})};
  }
  function vueProjet() {
    const p = P();
    const s = sequence(p);
    const nomM = (id) => c.media(id)?.nom ?? id;
    const st = styleComplet(p.style, p.sortie);
    return {
      titre: p.titre,
      format: {nom: p.sortie.preset, largeur: p.sortie.largeur, hauteur: p.sortie.hauteur, fps: p.sortie.fps, duree_s: t3(s.duree)},
      tete_s: t3(c.tete()),
      montage: s.segs.map(({it, debut, fin}) => (it.type === 'plan'
        ? {id: it.id, type: 'plan', media: it.media, nom_media: nomM(it.media), debut: t3(debut), fin: t3(fin), entree: t3(it.entree), sortie: t3(it.sortie), ...(it.envers ? {a_l_envers: true} : {}),
          ...(it.titre ? {titre: it.titre} : {}), son: vueSon(it.son), ...(it.couleur ? {couleur: it.couleur} : {}), ...(it.essentiel ? {essentiel: true} : {}),
          ...(vitesseDe(it) !== 1 ? {vitesse: vitesseDe(it)} : {}), ...(it.fondu ? {fondu: it.fondu} : {}),
          ...(it.transition ? {transition: vueTransition(it)} : {})}
        : {id: it.id, type: 'case', genre: it.genre, titre: it.titre, consigne: it.consigne, debut: t3(debut), fin: t3(fin)})),
      par_dessus: p.superpositions.map((x) => ({id: x.id, media: x.media, nom_media: nomM(x.media), debut: t3(x.debut), fin: t3(x.debut + x.sortie - x.entree), entree: t3(x.entree), sortie: t3(x.sortie),
        cadre: x.cadre, son: vueSon(x.son), ...(x.titre ? {titre: x.titre} : {}), ...(x.voix_off ? {voix_off: true} : {}), ...(x.fondu ? {fondu: x.fondu} : {}), ...(x.son_seul ? {son_seul: true} : {})})),
      effets: p.indications.filter((i) => CATALOGUE[i.modele]).map((e) => ({id: e.id, modele: e.modele, nom: resumeEffet(e), debut: t3(e.debut), fin: t3(e.fin), reglages: e.reglages ?? {}, ...(e.animation ? {animation: e.animation.id} : {})})),
      notes: p.indications.filter((i) => !CATALOGUE[i.modele]).map((i) => ({id: i.id, genre: i.genre, consigne: i.consigne, debut: t3(i.debut), fin: t3(i.fin)})),
      marqueurs: (p.marqueurs ?? []).map((k) => ({id: k.id, temps: t3(k.t), nom: k.nom, couleur: k.couleur})),
      style: {look: st.look, sous_titres: st.sous_titres, accent: st.accent, police_titres: st.police_titres, police_textes: st.police_textes, transition_auto: st.transition_auto,
        grain: st.grain, vignette: st.vignette, bandes: st.bandes, barre: st.barre, bruitages: st.bruitages},
    };
  }

  // ——— les gestes ———
  /** La place dans le montage : après un élément, en tête, à la coupe la plus proche d'un temps, sinon à la fin. */
  function place(args) {
    const p = P();
    if (args.apres === 'debut') return 0;
    if (args.apres) {
      const k = p.montage.findIndex((x) => x.id === args.apres);
      if (k < 0) refus(`« apres » : ${args.apres} n’est pas dans le montage.`);
      return k + 1;
    }
    const t = nombre(args.temps);
    if (t != null) {
      const s = seq();
      let mieux = s.segs.length;
      let ecart = Math.abs(s.duree - t);
      s.segs.forEach((g, k) => { if (Math.abs(g.debut - t) < ecart) { ecart = Math.abs(g.debut - t); mieux = k; } });
      return mieux;
    }
    return p.montage.length;
  }
  function passage(m, args) {
    const f = fpsM(m);
    if (m.type === 'image') {
      const d = borner(nombre(args.duree) ?? 3, 1 / f, 3600);
      return {a: 0, b: Math.min(m.duree || 60, surGrille(d, f) || 1 / f)};
    }
    const finMedia = Math.max(1 / f, Math.floor((m.duree ?? 0) * f + 1e-6) / f);
    const a = surGrille(borner(nombre(args.entree) ?? 0, 0, finMedia), f);
    const d = nombre(args.duree);
    const b = Math.min(finMedia, d != null ? surGrille(a + Math.max(0, d), f) : finMedia);
    if (b - a < 1 / f - 1e-6) refus(`Le passage est vide (de ${t3(a)} s à ${t3(b)} s dans ${m.id}, qui dure ${t3(m.duree)} s).`);
    return {a, b};
  }
  const sonNeuf = (actif) => ({actif, gain_db: 0, version: 'original', avant_s: 0, apres_s: 0});

  const GESTES = {
    // pas un outil : le serveur le demande avant de lire le montage enregistré (jouer() enregistre après chaque geste)
    enregistrer() { P(); return {texte: 'Enregistré.'}; },
    lire_projet() {
      const v = vueProjet();
      return {texte: `« ${v.titre} » : ${v.format.nom} ${v.format.largeur}×${v.format.hauteur}, ${v.format.fps} i/s, ${dureeLisible(v.format.duree_s)} ; ${v.montage.length} élément${v.montage.length > 1 ? 's' : ''} au montage, ${v.par_dessus.length} par-dessus, ${v.effets.length} effet${v.effets.length > 1 ? 's' : ''}.`, donnees: v};
    },
    async importer_medias({chemins}, ia) {
      P();
      if (!Array.isArray(chemins) || !chemins.length) refus('« chemins » : une liste de chemins complets de fichiers.');
      const liste = chemins.map(String).filter((x) => x.trim()).slice(0, 200);
      presence(ia, {texte: `importe ${liste.length} fichier${liste.length > 1 ? 's' : ''}`});
      const r = await c.importer(liste);
      const ajoutes = (r?.ajoutes ?? []).map((id) => ({id, nom: c.media(id)?.nom ?? id, genre: c.media(id)?.type}));
      return {texte: `${ajoutes.length} média${ajoutes.length > 1 ? 's' : ''} importé${ajoutes.length > 1 ? 's' : ''}${r?.erreurs?.length ? ` ; ${r.erreurs.length} refusé${r.erreurs.length > 1 ? 's' : ''}` : ''}. Dérush les prépare (aperçu, son, transcription) en arrière-plan.`, donnees: {ajoutes, erreurs: r?.erreurs ?? []}};
    },
    ajouter_plan(args, ia) {
      const m = media(args.media);
      const {a, b} = passage(m, args);
      const k = place(args);
      let it;
      c.modifier(() => {
        it = {id: nouvelId(P(), 'P'), type: 'plan', media: m.id, entree: a, sortie: b, titre: String(args.titre ?? '').slice(0, 200), notes: '', tags: [], son: sonNeuf(true)};
        P().montage.splice(k, 0, it);
      });
      const s = segDe(it.id);
      presence(ia, {t: s?.debut, id: it.id, texte: `pose « ${m.nom} »`});
      return {texte: `${it.id} posé au montage, de ${t3(s?.debut)} s à ${t3(s?.fin)} s (${m.id}, de ${t3(a)} s à ${t3(b)} s dans le fichier).`, donnees: {id: it.id, debut: t3(s?.debut), fin: t3(s?.fin)}};
    },
    poser_par_dessus(args, ia) {
      const m = media(args.media);
      const debut = surGrille(Math.max(0, nombre(args.debut) ?? refus('« debut » manque.')), P().sortie.fps);
      const {a, b} = passage(m, args);
      const cadre = args.cadre === 'incrustation' ? 'incrustation' : 'plein';
      const son = args.son === undefined ? m.type === 'audio' : !!args.son;
      let s;
      c.modifier(() => {
        s = {id: nouvelId(P(), 'S'), media: m.id, entree: a, sortie: b, debut, titre: String(args.titre ?? '').slice(0, 200), notes: '', cadre, son: sonNeuf(son)};
        P().superpositions.push(s);
      });
      presence(ia, {t: debut, id: s.id, texte: `pose « ${m.nom} » par-dessus`});
      return {texte: `${s.id} posé par-dessus, de ${t3(debut)} s à ${t3(debut + b - a)} s${cadre === 'incrustation' ? ', en incrustation' : ''}${son ? ', avec son son' : ''}.`, donnees: {id: s.id, debut: t3(debut), fin: t3(debut + b - a)}};
    },
    deplacer(args, ia) {
      const x = trouver(args.id);
      if (x.ou === 'montage') {
        if (args.apres == null) refus('Pour un élément du montage : « apres » (un autre élément, ou « debut »).');
        if (args.apres === x.it.id) refus('Un élément ne se pose pas après lui-même.');
        if (args.apres !== 'debut' && !P().montage.some((y) => y.id === args.apres)) refus(`« apres » : ${args.apres} n’est pas dans le montage.`);
        c.modifier(() => {
          const p = P();
          p.montage.splice(p.montage.indexOf(x.it), 1);
          const k = args.apres === 'debut' ? 0 : p.montage.findIndex((y) => y.id === args.apres) + 1;
          p.montage.splice(k, 0, x.it);
        });
        const s = segDe(x.it.id);
        presence(ia, {t: s?.debut, id: x.it.id, texte: `déplace ${x.it.id}`});
        return {texte: `${x.it.id} est maintenant de ${t3(s?.debut)} s à ${t3(s?.fin)} s.`, donnees: {id: x.it.id, debut: t3(s?.debut), fin: t3(s?.fin)}};
      }
      const d = nombre(args.debut);
      if (d == null) refus('« debut » manque (le nouveau début, en secondes).');
      const debut = surGrille(Math.max(0, d), P().sortie.fps);
      c.modifier(() => {
        if (x.ou === 'dessus') x.it.debut = debut;
        else {
          const duree = x.it.fin - x.it.debut;
          x.it.debut = debut;
          x.it.fin = debut + duree;
          if (x.ou === 'effet') { c.recaler(x.it); c.ancrer(x.it); }
        }
      });
      presence(ia, {t: x.it.debut, id: x.it.id, texte: `déplace ${x.it.id}`});
      return {texte: `${x.it.id} commence maintenant à ${t3(x.it.debut)} s.`, donnees: {id: x.it.id, debut: t3(x.it.debut)}};
    },
    rogner(args, ia) {
      const x = trouver(args.id);
      const it = x.it;
      if (x.ou === 'montage' && it.type === 'bloc') {
        const d = nombre(args.duree) ?? refus('Une case à créer se rogne par sa « duree ».');
        c.modifier(() => { it.duree = surGrille(borner(d, 1 / P().sortie.fps, 3600), P().sortie.fps); });
      } else if (x.ou === 'montage' || x.ou === 'dessus') {
        const m = media(it.media);
        const f = fpsM(m);
        const e = nombre(args.entree);
        const s = nombre(args.sortie);
        if (e == null && s == null) refus('« entree » ou « sortie » (en secondes dans le fichier du média).');
        const a = e == null ? it.entree : surGrille(borner(e, 0, m.duree), f);
        const b = s == null ? it.sortie : Math.min(m.duree, surGrille(borner(s, 0, m.duree), f));
        if (b - a < 1 / f - 1e-6) refus(`De ${t3(a)} s à ${t3(b)} s, il ne reste rien : pour enlever l’élément, supprimer.`);
        c.modifier(() => {
          // par-dessus : rogner le début garde l'image à sa place dans le montage (comme à la main)
          if (x.ou === 'dessus') it.debut = Math.max(0, it.debut + (a - it.entree));
          it.entree = a;
          it.sortie = b;
        });
      } else {
        const d = nombre(args.debut);
        const f = nombre(args.fin);
        if (d == null && f == null) refus('« debut » ou « fin » (en secondes dans le montage).');
        const a = d ?? it.debut;
        const b = f ?? it.fin;
        if (b - a < 1 / P().sortie.fps) refus('La fin doit venir après le début.');
        c.modifier(() => { it.debut = Math.max(0, a); it.fin = b; if (x.ou === 'effet') c.ancrer(it); });
      }
      const s = x.ou === 'montage' ? segDe(it.id) : null;
      presence(ia, {t: s?.debut ?? it.debut, id: it.id, texte: `rogne ${it.id}`});
      return {texte: `${it.id} rogné.`, donnees: x.ou === 'montage' ? {id: it.id, debut: t3(s?.debut), fin: t3(s?.fin), ...(it.type === 'plan' ? {entree: t3(it.entree), sortie: t3(it.sortie)} : {})} : {id: it.id, debut: t3(it.debut), fin: t3(x.ou === 'dessus' ? it.debut + it.sortie - it.entree : it.fin)}};
    },
    couper(args, ia) {
      const t = nombre(args.temps) ?? refus('« temps » manque (le temps du montage où couper).');
      const F = P().sortie.fps;
      if (args.id) {
        const x = trouver(args.id);
        if (x.ou !== 'dessus') refus('« id » sert à couper un élément par-dessus ; pour le montage, donne seulement « temps ».');
        const s = x.it;
        const dans = surGrille(t - s.debut, F);
        if (dans < 1 / F || s.sortie - s.entree - dans < 1 / F) refus(`À ${t3(t)} s, c’est le bord de ${s.id} (ou en dehors) : rien à couper.`);
        let deux;
        c.modifier(() => {
          deux = {...structuredClone(s), id: nouvelId(P(), 'S'), entree: s.entree + dans, debut: s.debut + dans};
          s.sortie = s.entree + dans;
          P().superpositions.push(deux);
        });
        presence(ia, {t, id: deux.id, texte: `coupe ${s.id}`});
        return {texte: `${s.id} coupé à ${t3(t)} s : la seconde moitié est ${deux.id}.`, donnees: {avant: s.id, apres: deux.id}};
      }
      const sq = seq();
      const s = segmentA(sq, t) ?? refus(`À ${t3(t)} s, il n’y a rien dans le montage (il dure ${t3(sq.duree)} s).`);
      let deux;
      if (s.it.type === 'bloc') {
        const d1 = surGrille(t - s.debut, F);
        if (d1 < 1 / F || s.it.duree - d1 < 1 / F) refus(`À ${t3(t)} s, c’est le bord de ${s.it.id} : rien à couper.`);
        c.modifier(() => {
          deux = {...structuredClone(s.it), id: nouvelId(P(), 'B'), duree: s.it.duree - d1};
          s.it.duree = d1;
          P().montage.splice(s.k + 1, 0, deux);
        });
      } else {
        const f = fpsM(c.media(s.it.media));
        const ts = surGrille(sourceDe(s.it, t - s.debut), f);
        if (ts <= s.it.entree + 0.5 / f || ts >= s.it.sortie - 0.5 / f) refus(`À ${t3(t)} s, c’est le bord de ${s.it.id} : rien à couper.`);
        c.modifier(() => {
          deux = {...structuredClone(s.it), id: nouvelId(P(), 'P'), entree: ts};
          s.it.sortie = ts;
          P().montage.splice(s.k + 1, 0, deux);
        });
      }
      presence(ia, {t, id: deux.id, texte: `coupe ${s.it.id}`});
      return {texte: `${s.it.id} coupé à ${t3(t)} s : la seconde moitié est ${deux.id}.`, donnees: {avant: s.it.id, apres: deux.id}};
    },
    supprimer({ids}, ia) {
      if (!Array.isArray(ids) || !ids.length) refus('« ids » : la liste des éléments à supprimer.');
      const liste = [...new Set(ids.map(String))];
      const inconnus = liste.filter((id) => !quoi(id));
      if (inconnus.length) refus(`Inconnu${inconnus.length > 1 ? 's' : ''} : ${inconnus.join(', ')}. Rien n’a été supprimé.`);
      const t = segDe(liste[0])?.debut ?? quoi(liste[0])?.it.debut ?? null;
      c.modifier(() => {
        const p = P();
        p.montage = p.montage.filter((x) => !liste.includes(x.id));
        p.superpositions = p.superpositions.filter((x) => !liste.includes(x.id));
        p.indications = p.indications.filter((x) => !liste.includes(x.id));
        p.marqueurs = (p.marqueurs ?? []).filter((x) => !liste.includes(x.id));
      });
      presence(ia, {t, texte: `supprime ${liste.length > 2 ? `${liste.length} éléments` : liste.join(' et ')}`});
      return {texte: `Supprimé : ${liste.join(', ')}.`, donnees: {supprimes: liste, duree_s: t3(seq().duree)}};
    },
    dupliquer(args, ia) {
      const x = trouver(args.id);
      if (x.ou !== 'montage') refus('Seul un élément du montage se duplique ici.');
      const k = args.apres ? place({apres: args.apres}) : x.k + 1;
      let copie;
      c.modifier(() => {
        copie = {...structuredClone(x.it), id: nouvelId(P(), x.it.type === 'plan' ? 'P' : 'B')};
        P().montage.splice(k, 0, copie);
      });
      const s = segDe(copie.id);
      presence(ia, {t: s?.debut, id: copie.id, texte: `duplique ${x.it.id}`});
      return {texte: `${copie.id} : la copie de ${x.it.id}, de ${t3(s?.debut)} s à ${t3(s?.fin)} s.`, donnees: {id: copie.id, debut: t3(s?.debut), fin: t3(s?.fin)}};
    },
    ajouter_case(args, ia) {
      const genre = GENRES_BLOC[args.genre] ? args.genre : 'scene';
      const F = P().sortie.fps;
      const duree = surGrille(borner(nombre(args.duree) ?? 3, 1 / F, 3600), F);
      const k = place(args);
      let b;
      c.modifier(() => {
        b = {id: nouvelId(P(), 'B'), type: 'bloc', genre, duree, titre: String(args.titre ?? '').slice(0, 200), consigne: String(args.consigne ?? '').slice(0, 4000), references: ''};
        P().montage.splice(k, 0, b);
      });
      const s = segDe(b.id);
      presence(ia, {t: s?.debut, id: b.id, texte: `réserve une case « ${GENRES_BLOC[genre]} »`});
      return {texte: `${b.id} : case « ${GENRES_BLOC[genre]} » de ${t3(s?.debut)} s à ${t3(s?.fin)} s.`, donnees: {id: b.id, debut: t3(s?.debut), fin: t3(s?.fin)}};
    },
    regler_son(args, ia) {
      if (!Array.isArray(args.ids) || !args.ids.length) refus('« ids » : les plans ou éléments par-dessus.');
      const liste = args.ids.map((id) => trouver(id));
      for (const x of liste) if (x.ou !== 'montage' && x.ou !== 'dessus' || x.it.type === 'bloc') refus(`${x.it.id} n’a pas de son à régler.`);
      const g = nombre(args.gain_db);
      if (args.version) {
        for (const x of liste) {
          const m = c.media(x.it.media);
          const ok = args.version === 'original' || (args.version === 'clair' ? !!m?.clair : !!m?.voix);
          if (!ok) refus(`La version « ${args.version} » du son de ${x.it.id} n’est pas prête (Dérush la prépare depuis la fiche du média).`);
        }
      }
      c.modifier(() => {
        for (const {it} of liste) {
          it.son = {...sonNeuf(true), ...(it.son ?? {})};
          if (g != null) it.son.gain_db = borner(g, -60, 24);
          if (typeof args.coupe === 'boolean') it.son.actif = !args.coupe;
          if (args.version) it.son.version = args.version;
        }
      });
      presence(ia, {t: segDe(liste[0].it.id)?.debut ?? liste[0].it.debut, id: liste[0].it.id, texte: `règle le son${liste.length > 1 ? ` de ${liste.length} éléments` : ''}`});
      return {texte: `Son réglé : ${liste.map((x) => x.it.id).join(', ')}.`, donnees: liste.map(({it}) => ({id: it.id, son: vueSon(it.son)}))};
    },
    regler_vitesse(args, ia) {
      if (!Array.isArray(args.ids) || !args.ids.length) refus('« ids » : les plans du montage.');
      const v = nombre(args.vitesse) ?? refus('« vitesse » manque (1 : normale, 0,5 : ralenti, 2 : accéléré).');
      if (v < VITESSE_MIN || v > VITESSE_MAX) refus(`« vitesse » : de ${VITESSE_MIN} à ${VITESSE_MAX}.`);
      const liste = args.ids.map((id) => trouver(id));
      for (const x of liste) if (x.ou !== 'montage' || x.it.type !== 'plan' || c.media(x.it.media)?.type === 'image') refus(`${x.it.id} : seule une vidéo ou un son du montage change de vitesse (une photo reste le temps qu’on lui donne : rogner).`);
      const k = Math.round(v * 10000) / 10000;
      c.modifier(() => { for (const {it} of liste) { if (k === 1) delete it.vitesse; else it.vitesse = k; } });
      const s = segDe(liste[0].it.id);
      presence(ia, {t: s?.debut, id: liste[0].it.id, texte: k === 1 ? 'remet la vitesse normale' : `${k < 1 ? 'ralentit' : 'accélère'} ${nomVitesse(k)}`});
      return {texte: `Vitesse ${nomVitesse(k)} : ${liste.map(({it}) => { const g = segDe(it.id); return `${it.id} de ${t3(g?.debut)} s à ${t3(g?.fin)} s`; }).join(', ')}.`, donnees: liste.map(({it}) => { const g = segDe(it.id); return {id: it.id, vitesse: vitesseDe(it), debut: t3(g?.debut), fin: t3(g?.fin)}; })};
    },
    regler_fondu(args, ia) {
      if (!Array.isArray(args.ids) || !args.ids.length) refus('« ids » : les plans.');
      const liste = args.ids.map((id) => trouver(id));
      for (const x of liste) if (!(x.ou === 'dessus' || (x.ou === 'montage' && x.it.type === 'plan'))) refus(`${x.it.id} : les fondus se posent sur un plan du montage ou sur un élément par-dessus.`);
      if (args.courbe && !['lineaire', 'lente', 'rapide', 'douce'].includes(args.courbe)) refus('« courbe » : lineaire, lente, rapide ou douce.');
      if (args.quoi && !['tout', 'image', 'son'].includes(args.quoi)) refus('« quoi » : tout, image ou son.');
      const e = nombre(args.entree);
      const so = nombre(args.sortie);
      c.modifier(() => {
        for (const {it} of liste) {
          const n = fonduPropre({...(it.fondu ?? {}), ...(e != null ? {entree: e} : {}), ...(so != null ? {sortie: so} : {}), ...(args.courbe ? {courbe: args.courbe} : {}), ...(args.quoi ? {quoi: args.quoi} : {})});
          if (n) it.fondu = n; else delete it.fondu;
        }
      });
      presence(ia, {t: segDe(liste[0].it.id)?.debut ?? liste[0].it.debut, id: liste[0].it.id, texte: 'pose des fondus'});
      return {texte: `Fondus réglés : ${liste.map((x) => x.it.id).join(', ')}.`, donnees: liste.map(({it}) => ({id: it.id, fondu: it.fondu ?? null}))};
    },
    async couper_sur_le_temps(args, ia) {
      const x = trouver(args.musique);
      if (x.ou !== 'dessus') refus(`« musique » : ${args.musique} n’est pas un élément par-dessus.`);
      presence(ia, {t: x.it.debut, id: x.it.id, texte: 'cale les coupes sur le temps'});
      const r = await c.calerSurLeTemps(x.it.id);
      return {texte: `${r.calees} coupe${r.calees > 1 ? 's' : ''} sur le temps (${Math.round(r.tempo)} BPM, pulsation ${r.pulsation})${r.laissees ? `, ${r.laissees} laissée${r.laissees > 1 ? 's' : ''}` : ''}.`, donnees: r};
    },
    async egaliser_son(args, ia) {
      P();
      presence(ia, {t: c.tete(), texte: 'égalise le son'});
      const r = await c.egaliser(Array.isArray(args.ids) && args.ids.length ? args.ids.map(String) : null);
      return {texte: `Son égalisé : ${r.plans.length} plans au niveau ${r.cible} LUFS (le plan médian).`, donnees: r};
    },
    poser_transition(args, ia) {
      const p = P();
      let x;
      if (args.id) x = trouver(args.id);
      else {
        const t = nombre(args.temps) ?? refus('« id » (le plan qui entre) ou « temps » (la coupe visée).');
        const cp = c.coupeProche(t);
        if (cp == null) refus('Il faut au moins deux plans au montage.');
        const g = seq().segs.find((y) => Math.abs(y.debut - cp) < 1e-6);
        x = g ? {ou: 'montage', it: g.it, k: g.k} : refus('Aucune coupe trouvée.');
      }
      if (x.ou !== 'montage' || x.it.type !== 'plan') refus(`${x.it.id} : une transition amène un plan du montage.`);
      const k = p.montage.indexOf(x.it);
      if (k <= 0 || p.montage[k - 1].type !== 'plan') refus(`${x.it.id} : il faut un plan juste avant lui (pas une case à créer, ni le début du montage).`);
      if (!['enchaine', 'volet', 'aucune'].includes(args.genre)) refus('« genre » : enchaine, volet ou aucune.');
      const d = nombre(args.duree);
      c.modifier(() => { if (args.genre === 'aucune') delete x.it.transition; else x.it.transition = transitionPropre({genre: args.genre, duree: d ?? x.it.transition?.duree ?? 0.5}); });
      const g = segDe(x.it.id);
      presence(ia, {t: g?.debut, id: x.it.id, texte: args.genre === 'aucune' ? 'retire la transition' : `pose un ${args.genre === 'volet' ? 'volet' : 'fondu enchaîné'}`});
      if (args.genre === 'aucune') return {texte: `Coupe nette avant ${x.it.id}.`};
      const v = vueTransition(x.it);
      return {texte: v.impossible ? `Transition posée sur ${x.it.id}, mais elle ne peut pas se jouer : il n’y a rien dans les fichiers autour de la coupe (rogne un peu le début de ${x.it.id} ou la fin du plan d’avant).`
        : `${v.genre === 'volet' ? 'Volet' : 'Fondu enchaîné'} de ${String(v.duree_tenue).replace('.', ',')} s centré sur la coupe à ${t3(g?.debut)} s${v.duree_tenue < v.duree_voulue - 0.01 ? ` (raccourci : ${v.duree_voulue} s voulues)` : ''}.`, donnees: {id: x.it.id, ...v}};
    },
    async arret_sur_image(args, ia) {
      const x = trouver(args.id);
      if (x.ou !== 'montage' || x.it.type !== 'plan' || c.media(x.it.media)?.type !== 'video') refus(`${x.it.id} : un arrêt sur image se fait sur un plan vidéo du montage.`);
      presence(ia, {t: segDe(x.it.id)?.debut, id: x.it.id, texte: 'fige une image'});
      const image = await c.gestes.arret(x.it, {t: nombre(args.temps), secondes: nombre(args.secondes) ?? 2});
      const s = segDe(image.id);
      presence(ia, {t: s?.debut, id: image.id, texte: 'fige une image'});
      return {texte: `Image figée : ${image.id}, de ${t3(s?.debut)} s à ${t3(s?.fin)} s.`, donnees: {id: image.id, debut: t3(s?.debut), fin: t3(s?.fin)}};
    },
    async a_l_envers(args, ia) {
      const x = trouver(args.id);
      if (x.ou !== 'montage' || x.it.type !== 'plan' || c.media(x.it.media)?.type === 'image') refus(`${x.it.id} : seul un plan vidéo ou son du montage se lit à l’envers.`);
      const avant = !!x.it.envers;
      presence(ia, {t: segDe(x.it.id)?.debut, id: x.it.id, texte: avant ? 'remet à l’endroit' : 'retourne le plan'});
      await c.gestes.envers(x.it);
      return {texte: avant ? `${x.it.id} est de nouveau à l’endroit.` : `${x.it.id} se lit maintenant à l’envers (son compris).`, donnees: {id: x.it.id, a_l_envers: !!x.it.envers, media: x.it.media}};
    },
    detacher_son(args, ia) {
      const x = trouver(args.id);
      if (x.ou !== 'montage') refus(`${x.it.id} : le son se détache d’un plan du montage.`);
      const son = c.gestes.detacher(x.it);
      presence(ia, {t: son.debut, id: son.id, texte: 'détache le son'});
      return {texte: `Son de ${x.it.id} détaché : ${son.id}, par-dessus, de ${t3(son.debut)} s à ${t3(son.debut + son.sortie - son.entree)} s.`, donnees: {id: son.id, plan: x.it.id}};
    },
    poser_marqueur(args, ia) {
      const p = P();
      const couleur = args.couleur;
      if (couleur && !['rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet'].includes(couleur)) refus('« couleur » : rouge, orange, jaune, vert, bleu ou violet.');
      if (args.id) {
        const x = trouver(args.id);
        if (x.ou !== 'marqueur') refus(`${args.id} n’est pas un marqueur.`);
        const t = nombre(args.temps);
        c.modifier(() => { if (t != null) x.it.t = t3(Math.max(0, t)); if (typeof args.nom === 'string') x.it.nom = args.nom.slice(0, 120); if (couleur) x.it.couleur = couleur; p.marqueurs.sort((a, b) => a.t - b.t); });
        presence(ia, {t: x.it.t, texte: `marque « ${x.it.nom} »`});
        return {texte: `${x.it.id} : « ${x.it.nom} » à ${t3(x.it.t)} s.`, donnees: {id: x.it.id, temps: x.it.t, nom: x.it.nom, couleur: x.it.couleur}};
      }
      const t = nombre(args.temps) ?? refus('« temps » manque (le temps du montage du marqueur).');
      let k;
      c.modifier(() => {
        p.marqueurs ??= [];
        k = {id: nouvelId(p, 'K'), t: t3(Math.max(0, t)), nom: String(args.nom ?? '').slice(0, 120) || `Repère ${p.marqueurs.length + 1}`, couleur: couleur || 'jaune'};
        p.marqueurs.push(k);
        p.marqueurs.sort((a, b) => a.t - b.t);
      });
      presence(ia, {t: k.t, texte: `marque « ${k.nom} »`});
      return {texte: `${k.id} : « ${k.nom} » à ${t3(k.t)} s.`, donnees: {id: k.id, temps: k.t, nom: k.nom, couleur: k.couleur}};
    },
    copier_couleur(args, ia) {
      const de = trouver(args.de);
      if (de.ou !== 'montage' || de.it.type !== 'plan') refus(`« de » : ${args.de} n’est pas un plan du montage.`);
      if (!Array.isArray(args.vers) || !args.vers.length) refus('« vers » : les plans qui reçoivent les couleurs.');
      const liste = args.vers.map((id) => trouver(id));
      for (const x of liste) if (x.ou !== 'montage' || x.it.type !== 'plan' || c.media(x.it.media)?.type === 'audio') refus(`${x.it.id} n’est pas une image du montage.`);
      const cc = couleurPropre(de.it.couleur);
      c.modifier(() => { for (const {it} of liste) { if (cc) it.couleur = {...cc}; else delete it.couleur; } });
      presence(ia, {t: segDe(liste[0].it.id)?.debut, id: liste[0].it.id, texte: `copie les couleurs de ${de.it.id}`});
      return {texte: `Couleurs de ${de.it.id} copiées sur ${liste.map((x) => x.it.id).join(', ')}.`, donnees: {couleur: cc ?? null}};
    },
    async regler_couleur(args, ia) {
      if (!Array.isArray(args.ids) || !args.ids.length) refus('« ids » : les plans du montage.');
      const liste = args.ids.map((id) => trouver(id));
      for (const x of liste) if (x.ou !== 'montage' || x.it.type !== 'plan' || c.media(x.it.media)?.type === 'audio') refus(`${x.it.id} n’est pas une image du montage : la couleur se règle sur les plans du montage.`);
      if (args.ambiance && !AMBIANCES[args.ambiance]) refus(`« ambiance » : ${Object.keys(AMBIANCES).join(', ')}.`);
      const valeurs = {};
      for (const k of Object.keys(REGLAGES_COULEUR)) { const v = nombre(args[k]); if (v != null) valeurs[k] = borner(Math.round(v), -100, 100); }
      let autos = null;
      if (args.auto) {
        autos = new Map();
        for (const {it} of liste) {
          const fiche = await c.fiche(it.media).catch(() => null);
          autos.set(it.id, couleurAuto(fiche?.mesures?.image));
        }
      }
      c.modifier(() => {
        for (const {it} of liste) {
          if (args.retirer) { delete it.couleur; continue; }
          const base = args.ambiance ? AMBIANCES[args.ambiance]?.reglages ?? {} : autos ? autos.get(it.id) ?? {} : it.couleur ?? {};
          const neuve = couleurPropre({...base, ...valeurs});
          if (neuve) it.couleur = neuve; else delete it.couleur;
        }
      });
      presence(ia, {t: segDe(liste[0].it.id)?.debut, id: liste[0].it.id, texte: args.retirer ? 'remet les couleurs d’origine' : 'étalonne'});
      return {texte: `Couleur réglée : ${liste.map((x) => x.it.id).join(', ')}.`, donnees: liste.map(({it}) => ({id: it.id, couleur: it.couleur ?? null}))};
    },
    poser_effet(args, ia) {
      const d = CATALOGUE[args.modele] ?? refus(`Effet inconnu : ${args.modele}. lister_effets donne les modèles.`);
      if (d.interne) refus('Une animation se pose avec poser_animation (son code), pas avec poser_effet.');
      const sq = seq();
      if (!sq.segs.length) refus('Le montage est vide : pose d’abord un plan.');
      const F = P().sortie.fps;
      let debut;
      let fin;
      let existant = null;
      if (d.categorie === 'transition') {
        const cible = nombre(args.temps) ?? nombre(args.debut) ?? c.tete();
        const cp = c.coupeProche(cible);
        if (cp == null) refus('Une transition se pose sur une coupe : il faut au moins deux éléments au montage.');
        debut = cp - d.avant;
        fin = cp + d.apres;
        existant = P().indications.find((i) => CATALOGUE[i.modele]?.categorie === 'transition' && Math.abs(i.debut + CATALOGUE[i.modele].avant - cp) < 0.6 / F);
      } else if (d.categorie === 'son') {
        debut = surGrille(borner(nombre(args.temps) ?? nombre(args.debut) ?? c.tete(), 0, sq.duree), F);
        fin = debut + d.duree;
      } else if (args.modele === 'fin') {
        fin = sq.duree;
        const v = nombre(args.debut);
        debut = v != null ? surGrille(borner(v, 0, fin - 1 / F), F) : Math.max(0, surGrille(fin - d.duree, F));
      } else {
        debut = surGrille(borner(nombre(args.debut) ?? nombre(args.temps) ?? c.tete(), 0, Math.max(0, sq.duree - 2 / F)), F);
        const f = nombre(args.fin);
        fin = f != null ? Math.max(debut + 1 / F, surGrille(f, F)) : Math.min(debut + d.duree, sq.duree);
      }
      const donnes = args.reglages && typeof args.reglages === 'object' ? args.reglages : {};
      const complets = reglagesDe(args.modele, donnes);
      const inconnus = Object.keys(donnes).filter((k) => !(k in d.reglages));
      if (inconnus.length) refus(`Réglage${inconnus.length > 1 ? 's' : ''} inconnu${inconnus.length > 1 ? 's' : ''} pour « ${args.modele} » : ${inconnus.join(', ')}. lister_effets donne ses réglages.`);
      const reglages = Object.fromEntries(Object.keys(donnes).map((k) => [k, complets[k]]));
      let e;
      c.modifier(() => {
        if (existant) { e = existant; Object.assign(e, {modele: args.modele, reglages, debut, fin}); } else {
          e = {id: nouvelId(P(), 'I'), genre: 'note', debut, fin, consigne: '', modele: args.modele, reglages};
          P().indications.push(e);
        }
        c.ancrer(e);
      });
      presence(ia, {t: debut, id: e.id, texte: `pose « ${resumeEffet(e)} »`});
      return {texte: `${e.id} : « ${resumeEffet(e)} » de ${t3(debut)} s à ${t3(fin)} s${existant ? ' (il remplace la transition qui était sur cette coupe)' : ''}.`, donnees: {id: e.id, debut: t3(debut), fin: t3(fin), reglages: reglagesDe(args.modele, reglages)}};
    },
    // 12.1 : une animation de l'IA, déjà fabriquée par le serveur (poser_animation) : le bloc dans la piste des effets,
    // au temps voulu, ou à la place d'une autre (« remplace » : son id I…, qui garde sa place si aucun début n'est donné)
    poser_animation_bloc(args, ia) {
      const a = args.animation && /^A\d{1,5}$/.test(String(args.animation.id ?? '')) ? args.animation : refus('Animation inconnue.');
      const sq = seq();
      if (!sq.segs.length) refus('Le montage est vide : pose d’abord un plan.');
      const F = P().sortie.fps;
      const ancienne = args.remplace ? trouver(args.remplace) : null;
      if (ancienne && (ancienne.ou !== 'effet' || ancienne.it.modele !== 'animation')) refus(`${args.remplace} n’est pas une animation.`);
      const d0 = nombre(args.debut) ?? (ancienne ? ancienne.it.debut : null) ?? c.tete();
      const debut = surGrille(borner(d0, 0, Math.max(0, sq.duree - 1 / F)), F);
      const voulue = nombre(args.duree) ?? a.images / (a.fps || F);
      const fin = Math.min(sq.duree, Math.max(debut + 1 / F, surGrille(debut + voulue, F)));
      const animation = {id: a.id, nom: String(a.nom ?? '').slice(0, 80), images: Math.max(1, Math.round(Number(a.images) || 1)), fps: Number(a.fps) > 0 ? Number(a.fps) : F};
      let e;
      c.modifier(() => {
        if (ancienne) { e = ancienne.it; Object.assign(e, {debut, fin, animation}); } else {
          e = {id: nouvelId(P(), 'I'), genre: 'texte', debut, fin, consigne: '', modele: 'animation', reglages: {}, animation};
          P().indications.push(e);
        }
      });
      presence(ia, {t: debut, id: e.id, texte: `pose l’animation « ${animation.nom} »`});
      const coupee = fin - debut < voulue - 1 / F;
      return {texte: `${e.id} : l’animation « ${animation.nom} » (${a.id}) de ${t3(debut)} s à ${t3(fin)} s${ancienne ? `, à la place de l’ancienne` : ''}${coupee ? ' (coupée à la fin du montage)' : ''}.`, donnees: {id: e.id, animation: a.id, debut: t3(debut), fin: t3(fin)}};
    },
    regler_effet(args, ia) {
      const x = trouver(args.id);
      if (x.ou !== 'effet') refus(`${x.it.id} n’est pas un effet.`);
      const e = x.it;
      const d = CATALOGUE[e.modele];
      const donnes = args.reglages && typeof args.reglages === 'object' ? args.reglages : {};
      const inconnus = Object.keys(donnes).filter((k) => !(k in d.reglages));
      if (inconnus.length) refus(`Réglage${inconnus.length > 1 ? 's' : ''} inconnu${inconnus.length > 1 ? 's' : ''} pour « ${e.modele} » : ${inconnus.join(', ')}.`);
      const complets = reglagesDe(e.modele, {...(e.reglages ?? {}), ...donnes});
      const debut = nombre(args.debut);
      const fin = nombre(args.fin);
      c.modifier(() => {
        e.reglages = {...(e.reglages ?? {}), ...Object.fromEntries(Object.keys(donnes).map((k) => [k, complets[k]]))};
        if (debut != null) { const dd = e.fin - e.debut; e.debut = Math.max(0, debut); e.fin = fin ?? e.debut + dd; } else if (fin != null) e.fin = Math.max(e.debut + 1 / P().sortie.fps, fin);
        if (d.categorie === 'transition' || d.categorie === 'son') c.recaler(e);
        c.ancrer(e);
      });
      presence(ia, {t: e.debut, id: e.id, texte: `règle « ${resumeEffet(e)} »`});
      return {texte: `${e.id} réglé : « ${resumeEffet(e)} », de ${t3(e.debut)} s à ${t3(e.fin)} s.`, donnees: {id: e.id, debut: t3(e.debut), fin: t3(e.fin), reglages: reglagesDe(e.modele, e.reglages)}};
    },
    regler_style(args, ia) {
      P();
      const err = (k, v) => refus(`« ${k} » : ${v} n’est pas permis.`);
      if (args.look && !LOOKS[args.look]) err('look', args.look);
      if (args.sous_titres && !STYLES_SOUS_TITRES[args.sous_titres]) err('sous_titres', args.sous_titres);
      if (args.position_sous_titres && !['bas', 'centre'].includes(args.position_sous_titres)) err('position_sous_titres', args.position_sous_titres);
      if (args.accent && !/^#[0-9a-f]{6}$/i.test(args.accent)) err('accent', `${args.accent} (une couleur #rrggbb)`);
      for (const k of ['police_titres', 'police_textes']) if (args[k] && !POLICES[args[k]]) err(k, args[k]);
      if (args.transition_auto && args.transition_auto !== 'aucune' && CATALOGUE[args.transition_auto]?.categorie !== 'transition') err('transition_auto', args.transition_auto);
      c.modifierStyle((s) => {
        if (args.look) Object.assign(s, LOOKS[args.look].style, {look: args.look, sous_titres: {...LOOKS[args.look].style.sous_titres}});
        if (args.sous_titres) s.sous_titres.style = args.sous_titres;
        if (args.position_sous_titres) s.sous_titres.position = args.position_sous_titres;
        if (typeof args.majuscules === 'boolean') s.sous_titres.majuscules = args.majuscules;
        if (args.accent) s.accent = args.accent.toUpperCase();
        for (const k of ['police_titres', 'police_textes', 'transition_auto']) if (args[k]) s[k] = args[k];
        for (const k of ['grain', 'vignette']) { const v = nombre(args[k]); if (v != null) s[k] = borner(v, 0, 1); }
        for (const k of ['bandes', 'barre', 'bruitages']) if (typeof args[k] === 'boolean') s[k] = args[k];
      });
      presence(ia, {t: c.tete(), texte: 'règle le style du film'});
      return {texte: 'Style réglé.', donnees: vueProjet().style};
    },
    regler_format(args, ia) {
      const p = P();
      if (args.format && !FORMATS[args.format]) refus(`« format » : ${args.format} n’existe pas (vertical, horizontal, carre, portrait).`);
      const fps = nombre(args.fps);
      if (fps != null && !CADENCES.includes(fps)) refus(`« fps » : ${fps} n’est pas permis (${CADENCES.join(', ')}).`);
      if (!args.format && fps == null) refus('« format » ou « fps ».');
      if (args.format) Object.assign(p.sortie, {preset: args.format, largeur: FORMATS[args.format].largeur, hauteur: FORMATS[args.format].hauteur, auto: false});
      if (fps != null) p.sortie.fps = fps;
      c.apresFormat();
      c.sauver();
      presence(ia, {t: c.tete(), texte: `passe en ${FORMATS[p.sortie.preset].ratio}`});
      return {texte: `Format ${FORMATS[p.sortie.preset].ratio} (${p.sortie.largeur}×${p.sortie.hauteur}), ${p.sortie.fps} i/s. Le cadrage de chaque plan suit le sujet.`, donnees: {format: p.sortie.preset, largeur: p.sortie.largeur, hauteur: p.sortie.hauteur, fps: p.sortie.fps}};
    },
    lecture(args, ia) {
      P();
      if (args.action === 'lire') c.lire();
      else if (args.action === 'pause') c.pause();
      else if (args.action === 'aller') c.aller(nombre(args.temps) ?? refus('« temps » manque.'));
      else refus('« action » : lire, pause ou aller.');
      presence(ia, {t: c.tete(), texte: args.action === 'lire' ? 'lance la lecture' : args.action === 'pause' ? 'met en pause' : `va à ${mmss(c.tete())}`});
      return {texte: `Tête de lecture à ${t3(c.tete())} s${args.action === 'lire' ? ', en lecture' : ''}.`, donnees: {tete_s: t3(c.tete())}};
    },
    historique(args, ia) {
      P();
      if (!['annuler', 'retablir'].includes(args.action)) refus('« action » : annuler ou retablir.');
      const avant = c.historique();
      if ((args.action === 'annuler' ? avant.annuler : avant.refaire) === 0) refus(args.action === 'annuler' ? 'Rien à annuler.' : 'Rien à rétablir.');
      c.annuler(args.action === 'annuler' ? 1 : -1);
      presence(ia, {t: c.tete(), texte: args.action === 'annuler' ? 'annule' : 'rétablit'});
      return {texte: args.action === 'annuler' ? 'Dernier changement annulé.' : 'Changement rétabli.', donnees: c.historique()};
    },
  };

  // ——— la boucle : la fenêtre vient chercher les gestes ———
  let actif = false;
  let enMarche = false;
  async function jouer(appel) {
    const f = GESTES[appel.nom];
    try {
      if (!f) throw new Error(`« ${appel.nom} » ne se joue pas dans la fenêtre.`);
      const resultat = await f(appel.args ?? {}, appel.ia || 'Une IA');
      // enregistré avant la réponse : ce que l'IA demande ensuite au serveur (une image, la vidéo finale) est à jour
      if (c.P()) await c.sauverMaintenant?.();
      await c.api('POST', '/api/porte/reponse', {id: appel.id, resultat});
    } catch (e) {
      await c.api('POST', '/api/porte/reponse', {id: appel.id, erreur: String(e?.message ?? e)}).catch(() => {});
    }
  }
  let tours = 0;
  async function tour() {
    tours++;
    try {
      const r = await c.api('GET', `/api/porte/attente?t=${encodeURIComponent(t3(c.P() ? c.tete() : 0))}`);
      actif = !!r?.actif;
      for (const e of r?.evenements ?? []) c.evenement?.(e);
      for (const a of r?.appels ?? []) await jouer(a);
    } catch { /* serveur arrêté, fenêtre remplacée : on réessaiera */ }
    attendre(actif ? 150 : 1500).then(tour);
  }
  // 12.1 : le rythme vient d'un Worker (public/metronome.js) : une fenêtre cachée ralentit ses propres minuteurs jusqu'à
  // une fois par minute, et l'IA croyait la fenêtre fermée (constaté le 25 nov. 2026 : elle a monté sans la timeline)
  let metronome;
  function attendre(ms) {
    if (metronome === undefined) { try { metronome = new Worker('/metronome.js'); } catch { metronome = null; } }
    if (!metronome) return new Promise((ok) => setTimeout(ok, ms));
    // un métronome arrêté (Worker fermé par le navigateur) ne bloque jamais la boucle : un minuteur ordinaire la relance
    return new Promise((ok) => {
      let fait = false;
      const fin = () => { if (!fait) { fait = true; ok(); } };
      metronome.onmessage = fin;
      metronome.onerror = () => { metronome = null; fin(); };
      metronome.postMessage(ms);
      setTimeout(fin, ms * 4 + 2000);
    });
  }
  return {
    demarrer() { if (!enMarche) { enMarche = true; attendre(400).then(tour); } },
    etat: () => ({actif, en_marche: enMarche, tours}),
    /** Pour les essais : jouer un geste directement, sans passer par le serveur. */
    jouer: (nom, args, ia = 'Essai') => GESTES[nom](args ?? {}, ia),
    gestes: () => Object.keys(GESTES),
  };
}
