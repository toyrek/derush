// Dérush — l'équipe du Mode Hollywood : trois IA, chacune son métier, chacune son modèle.
//   - le réalisateur : Gemini, la seule IA qui voit ET entend une vidéo (lib/gemini-api.mjs) : il dérushe les rushes,
//     propose le découpage, décompose une vidéo de référence et note le montage avant qu'il parte ;
//   - le monteur : l'IA choisie dans « Qui monte ? » (Claude, Codex ou Gemini), avec son modèle ;
//   - le graphiste : ChatGPT, par l'outil d'images de Codex (lib/graphiste.mjs) : il dessine ce qui manque.
// Quand une IA n'a plus de quota, l'équipe continue avec les deux autres :
//   - un monteur à bout passe la main à la suivante (Claude, Codex, Gemini), au départ ou en plein travail : elle reprend
//     le dossier de travail là où il en était ;
//   - sans réalisateur, le monteur regarde lui-même ses rushes, et son second regard (la planche) remplace la note ;
//   - sans graphiste, le monteur dessine en code (SVG, formes du kit, HyperFrames).
// Le crédit API de Claude n'est jamais pris par ce relais : il reste le choix de la personne, en dernier recours.
import {lireReglages, changerReglages} from './reglages.mjs';
import {etatQuotas} from './quotas.mjs';

export const ORDRE_MONTEURS = ['claude', 'codex', 'gemini'];
export const NOMS_EQUIPE = {claude: 'Claude', codex: 'Codex', gemini: 'Gemini', chatgpt: 'ChatGPT'};
const UNE_HEURE = 3600e3;

/**
 * Le quota de cette IA est-il à bout en ce moment ? {recharge, estime} ou null. Un quota noté « atteint » sans heure de
 * recharge (Gemini ne la donne pas) compte pour une heure : l'IA est retentée ensuite.
 */
export function aBout(moteur, q = etatQuotas(), maintenant = Date.now()) {
  const x = q?.[moteur];
  if (!x?.connu || x.statut !== 'atteint') return null;
  if (x.recharge) return Date.parse(x.recharge) > maintenant ? {recharge: x.recharge, estime: false} : null;
  const vu = Date.parse(x.vu_le ?? '');
  if (!Number.isFinite(vu) || maintenant - vu >= UNE_HEURE) return null;
  return {recharge: new Date(vu + UNE_HEURE).toISOString(), estime: true};
}

/** L'IA qui monte à la place de `moteur` : prête, avec du quota, dans l'ordre Claude, Codex, Gemini ; sinon null. */
export function remplacant(moteur, etats, q = etatQuotas(), {exclure = [], maintenant = Date.now()} = {}) {
  return ORDRE_MONTEURS.find((m) => m !== moteur && !exclure.includes(m) && etats?.[m]?.ok && !aBout(m, q, maintenant)) ?? null;
}

const heure = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? '' : `${d.getHours()} h${d.getMinutes() ? ` ${String(d.getMinutes()).padStart(2, '0')}` : ''}`; };
const jusqua = (b) => (b?.recharge && !b.estime ? ` jusqu’à ${heure(b.recharge)}` : '');
const liste = (x) => (x.length > 1 ? `${x.slice(0, -1).join(', ')} et ${x.at(-1)}` : x[0] ?? '');
/** « Gemini 4 Hydrogen » → « Gemini » : le prénom de l'IA suffit dans une phrase. */
const prenom = (nom) => String(nom ?? 'Gemini').split(' ')[0];

/** L'équipe dite en une ou deux phrases : « Gemini réalise, Claude monte et ChatGPT dessine. » et ce qui manque. */
export function phraseEquipe(e) {
  const roles = [e.realisateur.pret ? `${prenom(e.realisateur.nom)} réalise` : null, `${NOMS_EQUIPE[e.monteur_effectif]} monte`, e.graphiste.pret ? 'ChatGPT dessine' : null].filter(Boolean);
  const notes = [];
  if (e.monteur.a_bout) notes.push(e.monteur.remplace_par ? `${NOMS_EQUIPE[e.monteur.ia]} n’a plus de quota${jusqua(e.monteur.a_bout)} : ${NOMS_EQUIPE[e.monteur.remplace_par]} monte à sa place.` : `${NOMS_EQUIPE[e.monteur.ia]} n’a plus de quota${jusqua(e.monteur.a_bout)}, et aucune autre IA ne peut monter.`);
  if (!e.realisateur.pret && e.realisateur.a_bout) notes.push(`Gemini n’a plus de quota${jusqua(e.realisateur.a_bout)} : le monteur regarde lui-même ses rushes.`);
  if (e.graphiste.voulu && e.graphiste.connecte && e.graphiste.a_bout) notes.push(`ChatGPT n’a plus de quota${jusqua(e.graphiste.a_bout)} : le monteur dessine en code.`);
  return [`${liste(roles)}.`.replace(/^./, (c) => c.toUpperCase()), ...notes].join(' ');
}

/**
 * L'équipe de ce travail. `etats` : l'état des trois IA (etatIA) ; `moteur` : celle qui doit monter ; `gemini` : ce que
 * dit etatGeminiCle (ses voies, le nom du réalisateur). Renvoie {realisateur, monteur, graphiste, monteur_effectif,
 * membres, phrase} — `monteur.remplace_par` : l'IA qui monte à sa place quand son quota est à bout.
 */
export function composerEquipe({etats, moteur = etats?.choisi ?? 'claude', gemini = null, reglages = lireReglages(), q = etatQuotas(), maintenant = Date.now()} = {}) {
  const boutMonteur = etats?.[moteur]?.ok ? aBout(moteur, q, maintenant) : null;
  const monteur = {ia: moteur, pret: !!etats?.[moteur]?.ok, a_bout: boutMonteur, remplace_par: boutMonteur ? remplacant(moteur, etats, q, {maintenant}) : null};
  // le réalisateur : une voie qui marche encore (la commande du compte Google à bout ne compte plus ; la clé a son quota à elle)
  const toutes = gemini?.voies ?? [];
  const boutGemini = aBout('gemini', q, maintenant);
  const voies = toutes.filter((v) => !(v === 'commande' && boutGemini));
  const realisateur = {ia: 'gemini', pret: voies.length > 0, a_bout: toutes.length && !voies.length ? boutGemini : null, voies, nom: gemini?.nom_oeil ?? 'Gemini', modele: reglages.hollywood_realisateur ?? null};
  const voulu = reglages.hollywood_graphiste !== false;
  const boutCodex = etats?.codex?.ok ? aBout('codex', q, maintenant) : null;
  const graphiste = {ia: 'chatgpt', voulu, connecte: !!etats?.codex?.ok, pret: voulu && !!etats?.codex?.ok && !boutCodex, a_bout: boutCodex, modele: reglages.hollywood_graphiste_modele ?? null};
  const effectif = monteur.remplace_par ?? moteur;
  const e = {realisateur, monteur, graphiste, monteur_effectif: effectif, membres: [realisateur.pret ? 'gemini' : null, effectif, graphiste.pret ? 'chatgpt' : null].filter(Boolean)};
  return {...e, phrase: phraseEquipe(e)};
}

/** Les choix de l'équipe : le modèle du réalisateur, et le graphiste (allumé ou non, son modèle). null : « Auto ». */
export function changerEquipe({role, modele, actif} = {}) {
  const propre = (m, motif) => (m == null || m === '' ? null : motif.test(String(m)) ? String(m) : (() => { throw new Error('Modèle inconnu.'); })());
  if (role === 'realisateur') return changerReglages({hollywood_realisateur: propre(modele, /^gemini-[\w.-]{2,60}$/)});
  if (role === 'graphiste') {
    return changerReglages({...(modele !== undefined ? {hollywood_graphiste_modele: propre(modele, /^[\w.:-]{2,60}$/)} : {}), ...(actif !== undefined ? {hollywood_graphiste: actif !== false} : {})});
  }
  throw new Error('Rôle inconnu : réalisateur ou graphiste (le monteur se choisit dans « Qui monte ? »).');
}
