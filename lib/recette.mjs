// Dérush — la recette qui marche, par espace : ce qui a marché, ce qui a moins marché, ce qui reste à essayer.
//
// 1. Les chiffres, sans IA : chaque fiche de montage (lib/fiches.mjs) croisée avec ses vues (lib/suivi.mjs : le
//    multiple de la médiane du compte), puis regroupée par trait — accroche grande ou discrète, durée, genre, musique,
//    réseau, rythme… Un trait ne « marche » qu'avec au moins 3 exemples : en dessous, il est « à essayer ». Corrélation
//    n'est pas cause : la recette le dit, et l'IA s'en sert comme repère, jamais comme règle.
// 2. Les notes de la personne (👍 / 👎) comptent à part : ce qu'elle aime n'est pas toujours ce qui fait des vues.
// 3. L'IA, à la demande (lib/apprentissage-ia.mjs), lit ces chiffres, les fiches, le profil ou la marque, et écrit la recette en
//    mots, avec des idées de sujets. Le résultat est rangé dans espaces/<id>/recette.json.
import fs from 'node:fs';
import path from 'node:path';
import {DOSSIER_ESPACES, trouverEspace, apprend} from './espaces.mjs';
import {lireFiches} from './fiches.mjs';
import {publicationsAvecChiffres} from './suivi.mjs';
import {lireProfil} from './createur.mjs';
import {TYPES_VIDEO} from './commun.mjs';
import {ecrireJson} from './outils.mjs';

/** Pour « Moi », les médianes que le profil du créateur a déjà mesurées sur ses comptes (en attendant celles du suivi). */
export function medianesDuProfil(espaceId) {
  if (espaceId !== 'moi') return {};
  try { return Object.fromEntries((lireProfil()?.comptes ?? []).filter((c) => c.mediane_vues > 0).map((c) => [c.reseau, c.mediane_vues])); } catch { return {}; }
}

export const MIN_EXEMPLES = 3;
const fichierRecette = (id) => path.join(DOSSIER_ESPACES, id, 'recette.json');
const mediane = (xs) => { const t = xs.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b); if (!t.length) return null; const m = Math.floor(t.length / 2); return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2; };
const rond = (x) => (x == null ? null : Math.round(x * 100) / 100);
// les mots de l'interface, pas les clés du code (« Face caméra », « Claude Soigné », « 2,4 fois »)
const NIVEAUX_IA = {rapide: 'Rapide', soigne: 'Soigné', max: 'Maximum'};
const fois = (x) => String(x).replace('.', ',');

/** Les traits d'une fiche, en mots simples (ce qu'on compare d'une vidéo à l'autre). */
export function traits(f) {
  const t = {};
  if (f.accroche) t.accroche = f.accroche.grande ? 'grand titre dans les 2 premières secondes' : 'accroche discrète';
  if (f.duree_s != null) t.duree = f.duree_s < 30 ? 'moins de 30 s' : f.duree_s < 60 ? '30 à 60 s' : f.duree_s < 90 ? '60 à 90 s' : 'plus de 90 s';
  if (f.genre) t.genre = TYPES_VIDEO[f.genre]?.nom ?? f.genre;
  if (f.format?.orientation) t.format = f.format.orientation;
  // sans table de montage (l'IA ne l'a pas écrite), on ne sait pas s'il y avait de la musique : rien n'est affirmé.
  // Une fiche d'avant ce champ : la table existait si quelque chose en a été retenu.
  const tableConnue = f.table ?? !!(f.plans != null || f.musique?.length || f.textes?.length || f.effets?.length || f.bruitages || f.sous_titres);
  if (tableConnue) t.musique = f.musique?.length ? 'avec musique' : 'sans musique';
  if (f.rythme) t.rythme = (f.rythme.pauses ?? 0) + (f.rythme.hesitations ?? 0) + (f.rythme.redites ?? 0) === 0 ? 'parole resserrée' : 'avec pauses ou redites';
  if (f.voix?.brillance_db != null) t.voix = f.voix.brillance_db >= -16 ? 'voix nette' : 'voix sourde';
  // lu à la livraison sur le nom ET le détail des blocs (lib/fiches.mjs) ; une fiche plus ancienne n'a que les noms
  // (un simple bloc « Accroche » n'est pas un titre derrière la personne)
  if (f.titre_derriere ?? f.textes?.some((x) => /derri[eè]re|titre g[ée]ant/i.test(x))) t.titre_derriere = 'titre derrière la personne';
  if (f.sous_titres) t.sous_titres = 'sous-titres';
  if (f.ia?.moteur) t.ia = [f.ia.moteur === 'claude' ? 'Claude' : f.ia.moteur === 'codex' ? 'Codex' : f.ia.moteur === 'gemini' ? 'Gemini' : f.ia.moteur, NIVEAUX_IA[f.ia.qualite] ?? f.ia.qualite].filter(Boolean).join(' ');
  return t;
}
const NOMS_TRAITS = {accroche: 'Accroche', duree: 'Durée', genre: 'Genre', format: 'Format', musique: 'Musique', rythme: 'Rythme', voix: 'Voix', titre_derriere: 'Titre derrière la personne', sous_titres: 'Sous-titres', ia: 'IA', reseau: 'Réseau'};

/** Chaque fiche de l'espace avec ses publications chiffrées et son meilleur multiple. */
export function joindre(espaceId, {medianesParDefaut = medianesDuProfil(espaceId)} = {}) {
  const fiches = lireFiches(espaceId);
  const pubs = publicationsAvecChiffres(espaceId, {medianesParDefaut});
  // les publications rangées une fois par fiche (pas un tri de toutes les publications pour chaque fiche) ; la même
  // vidéo d'un réseau n'y compte qu'une fois, même suivie sous deux clés
  const parFiche = new Map();
  for (const p of pubs) {
    if (!p.cle_fiche) continue;
    const liste = parFiche.get(p.cle_fiche) ?? [];
    if (p.id == null || !liste.some((q) => q.reseau === p.reseau && q.id === p.id)) liste.push(p);
    parFiche.set(p.cle_fiche, liste);
  }
  return fiches.map((f) => {
    const siennes = parFiche.get(f.cle) ?? [];
    const multiples = siennes.map((p) => p.multiple).filter((x) => x != null);
    return {fiche: f, publications: siennes, multiple: multiples.length ? Math.max(...multiples) : null, vues: siennes.reduce((s, p) => s + (p.derniere?.vues ?? 0), 0) || null};
  });
}

/**
 * Les chiffres de la recette : par trait, combien de vidéos, leur multiple médian, et un verdict (marche, marche
 * moins, à essayer, neutre). Plus les meilleures et les moins bonnes vidéos, et les notes de la personne.
 */
export function statistiques(espaceId, {lignes = joindre(espaceId)} = {}) {
  const mesurees = lignes.filter((l) => l.multiple != null);
  const groupes = new Map();
  const ajouter = (trait, valeur, l, id) => {
    const k = `${trait}|${valeur}`;
    const g = groupes.get(k) ?? {trait, nom_trait: NOMS_TRAITS[trait] ?? trait, valeur, multiples: [], ids: new Set(), aimees: 0, pas_aimees: 0};
    if (l.multiple != null) { g.multiples.push(l.multiple); g.ids.add(id); }
    if (l.fiche.note === 1) g.aimees++;
    if (l.fiche.note === -1) g.pas_aimees++;
    groupes.set(k, g);
  };
  // chaque multiple mesuré, avec son identifiant : une vidéo (ses traits) ou une publication (son réseau)
  const univers = {video: new Map(), publication: new Map()};
  lignes.forEach((l, i) => {
    if (l.multiple != null) univers.video.set(`v${i}`, l.multiple);
    for (const [trait, valeur] of Object.entries(traits(l.fiche))) ajouter(trait, valeur, l, `v${i}`);
    l.publications.forEach((p, j) => {
      if (p.multiple != null) univers.publication.set(`p${i}.${j}`, p.multiple);
      ajouter('reseau', p.reseau, {...l, multiple: p.multiple}, `p${i}.${j}`);
    });
  });
  // Un trait se juge contre les vidéos de l'espace qui ne l'ont pas, pas seulement contre la médiane du compte : si
  // toutes les vidéos l'ont (toutes en vertical, toutes avec musique), il ne distingue rien et reste « neutre ».
  // Dans les deux sens : quand toutes les vidéos font moins que la médiane du compte, un trait ne « marche moins »
  // que s'il fait nettement moins que les autres (sinon un trait ET son contraire marcheraient moins).
  const verdict = (g, m, mAutres) => {
    if (mAutres == null) return 'neutre';
    const audessus = m >= 1.5 && m >= mAutres * 1.3;
    const endessous = m < 1.2 && m <= mAutres * 0.7;
    if (g.multiples.length >= MIN_EXEMPLES) return audessus ? 'marche' : endessous ? 'marche_moins' : 'neutre';
    return audessus ? 'a_essayer' : 'neutre';
  };
  const liste = [...groupes.values()].map((g) => {
    const m = mediane(g.multiples);
    const tous = univers[g.trait === 'reseau' ? 'publication' : 'video'];
    const mAutres = mediane([...tous].filter(([id]) => !g.ids.has(id)).map(([, x]) => x));
    return {trait: g.trait, nom_trait: g.nom_trait, valeur: g.valeur, n: g.multiples.length, multiple_median: rond(m), autres: rond(mAutres),
      verdict: m == null ? 'neutre' : verdict(g, m, mAutres), aimees: g.aimees, pas_aimees: g.pas_aimees};
  }).sort((a, b) => (b.multiple_median ?? -1) - (a.multiple_median ?? -1));
  const resume = (l) => ({titre: l.fiche.titre || l.fiche.projet, projet: l.fiche.projet, multiple: l.multiple, vues: l.vues, quand: l.fiche.quand, cle: l.fiche.cle});
  const tri = [...mesurees].sort((a, b) => b.multiple - a.multiple);
  return {
    n_montages: lignes.length, n_mesures: mesurees.length,
    groupes: liste,
    meilleures: tri.slice(0, 5).map(resume),
    moins_bonnes: tri.slice(-3).reverse().filter((l) => !tri.slice(0, 5).includes(l)).map(resume),
    notes: {aimees: lignes.filter((l) => l.fiche.note === 1).length, pas_aimees: lignes.filter((l) => l.fiche.note === -1).length,
      mots: lignes.filter((l) => l.fiche.mot).slice(0, 10).map((l) => ({titre: l.fiche.titre || l.fiche.projet, note: l.fiche.note, mot: l.fiche.mot}))},
  };
}

/** La recette rangée (écrite par l'IA), ou null. */
export function lireRecette(id) { try { return JSON.parse(fs.readFileSync(fichierRecette(id), 'utf8')); } catch { return null; } }
export function ecrireRecette(id, r) { ecrireJson(fichierRecette(id), {...r, ecrite_le: new Date().toISOString()}, 1); }

/** recette.md : ce que l'IA de montage reçoit (contexte/espace/recette.md). null s'il n'y a encore rien à dire. */
export function recetteEnTexte(espaceId) {
  const s = statistiques(espaceId);
  const r = lireRecette(espaceId);
  const marche = s.groupes.filter((g) => g.verdict === 'marche');
  const moins = s.groupes.filter((g) => g.verdict === 'marche_moins');
  const essayer = s.groupes.filter((g) => g.verdict === 'a_essayer');
  if (!r && !marche.length && !moins.length && !essayer.length && !s.notes.mots.length) return null;
  const L = ['# Ce qui marche dans cet espace', '', `> D’après ${s.n_montages} montage${s.n_montages > 1 ? 's' : ''} livré${s.n_montages > 1 ? 's' : ''}, ${s.n_mesures ? `dont ${s.n_mesures} avec ${s.n_mesures > 1 ? 'leurs' : 'ses'} vues` : 'aucun avec ses vues pour l’instant'}. « Multiple » = les vues d’une vidéo ÷ la médiane de son compte (3 = un vrai succès). Ce sont des repères, pas des règles : la demande d’aujourd’hui passe avant, et un trait qui marche n’en est pas forcément la cause.`, ''];
  if (r?.resume) L.push(r.resume, '');
  const ligne = (g) => `- **${g.nom_trait}** : ${g.valeur} — ${fois(g.multiple_median)} fois la médiane sur ${g.n} vidéo${g.n > 1 ? "s" : ""}${g.autres != null ? ` (les autres : ${fois(g.autres)})` : ""}`;
  if (marche.length) L.push('## Ça marche', '', ...marche.map(ligne), '');
  if (moins.length) L.push('## Ça marche moins', '', ...moins.map(ligne), '');
  if (essayer.length) L.push('## À essayer encore (trop peu d’exemples)', '', ...essayer.map(ligne), '');
  if (r?.ca_marche?.length) L.push('## Ce que l’analyse en retient', '', ...r.ca_marche.map((x) => `- ${x.quoi}${x.preuve ? ` (${x.preuve})` : ''}`), '');
  if (r?.a_eviter?.length) L.push('## À éviter', '', ...r.a_eviter.map((x) => `- ${x.quoi}${x.preuve ? ` (${x.preuve})` : ''}`), '');
  if (s.notes.mots.length) L.push('## Ce qu’en a dit la personne', '', ...s.notes.mots.map((m) => `- ${m.note === 1 ? '👍' : m.note === -1 ? '👎' : '•'} « ${m.titre} » : ${m.mot}`), '');
  return `${L.join('\n').trimEnd()}\n`;
}

/** Pose recette.md dans contexte/espace/ (si l'espace apprend et qu'il y a quelque chose à dire). */
export function installerRecette(dossier, e) {
  const f = path.join(dossier, 'contexte', 'espace', 'recette.md');
  if (!apprend(e)) { fs.rmSync(f, {force: true}); return false; }
  const t = recetteEnTexte(e.id);
  if (!t) { fs.rmSync(f, {force: true}); return false; }
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(f, t);
  return true;
}
export const espaceExiste = (id) => !!trouverEspace(id);
