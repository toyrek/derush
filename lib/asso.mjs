// Dérush — l'association derrière Dérush (YABAÏ) : ce que l'app en dit, les dons, le contact, « Signaler un bug ».
//
// - Ce qui est dit de l'association (son histoire, ses photos, ses réseaux, ses pages de don) est dans asso.json, à la
//   racine du dépôt : un seul fichier à tenir à jour.
// - Les dons passent par HelloAsso. La clé de l'API HelloAsso ne peut pas vivre dans une app que tout le monde peut
//   lire : c'est le site de l'association (www.yabai.fr) qui la garde et qui publie la liste de ses cagnottes
//   (helloassoSync.getDonationCampaigns). Dérush lit cette liste, au plus une fois par heure et seulement quand la
//   fenêtre « Soutenir » s'ouvre : une cagnotte ouverte sur HelloAsso apparaît toute seule, une cagnotte finie s'en va.
//   Le paiement se fait sur la page de HelloAsso, dans le navigateur : aucune carte ne passe par Dérush.
// - Le don libre (sans cagnotte) se fait comme sur la page « Faire un don » du site : la personne choisit son montant
//   dans Dérush, le site crée le paiement chez HelloAsso (HelloAsso Checkout, `donations.create`) et rend l'adresse
//   de la page de paiement, que Dérush ouvre dans le navigateur. Le prénom, le nom et l'adresse e-mail donnés pour ce
//   don vont au site puis à HelloAsso (qui envoie le reçu) : Dérush ne les garde pas.
// - Seules les pages HelloAsso de l'association sont acceptées comme page de don (DEBUT_DON), d'où qu'elles viennent,
//   et seule une adresse helloasso.com est acceptée comme page de paiement.
// - Le contact et « Signaler un bug » passent par le formulaire de contact du site (contact.sendMessage), qui écrit à
//   l'équipe : rien ne part sans le clic « Envoyer » de la personne, qui voit avant ce qui est envoyé.
import fs from 'node:fs';
import path from 'node:path';
import {RACINE_APP, DOSSIER_SUPPORT} from './moteurs.mjs';
import {VERSION} from './commun.mjs';
import {lireJson, ecrireJson} from './outils.mjs';
import {lireReglages, changerReglages} from './reglages.mjs';
import {nettoyer} from './journal.mjs';

const FICHIER = path.join(RACINE_APP, 'asso.json');
const cache = () => path.join(DOSSIER_SUPPORT, 'asso-campagnes.json');
const API = () => (process.env.DERUSH_ASSO_API || 'https://www.yabai.fr/api/trpc').replace(/\/+$/, '');
const UNE_HEURE = 3600e3;
const UN_JOUR = 24 * UNE_HEURE;
/** Le seul début d'adresse accepté pour un don : les pages HelloAsso de l'association. */
export const DEBUT_DON = 'https://www.helloasso.com/associations/yabai/';
const HOTES_PHOTOS = ['www.yabai.fr', 'yabai.fr', 'cdn.helloasso.com'];
const HOTES_RESEAUX = {instagram: 'instagram.com', tiktok: 'tiktok.com', youtube: 'youtube.com', linkedin: 'linkedin.com', facebook: 'facebook.com', x: 'x.com', threads: 'threads.net', twitch: 'twitch.tv'};

const texte = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const https = (v, hotes = null) => {
  try {
    const u = new URL(String(v));
    if (u.protocol !== 'https:') return null;
    if (hotes && !hotes.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) return null;
    return u.href;
  } catch { return null; }
};
const pageDon = (v) => { const u = https(v); return u && u.startsWith(DEBUT_DON) ? u : null; };
// la fin d'une collecte : l'instant exact quand il est donné (« 2027-01-31T00:00:00+01:00 »), sinon le jour (« 2027-01-30 »)
const jour = (v) => { const s = String(v ?? '').trim(); return Number.isFinite(Date.parse(s)) && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 40) : null; };

/** Ce que l'app dit de l'association (asso.json), relu et borné : un fichier abîmé ne casse jamais l'interface. */
export function lireAsso() {
  const j = lireJson(FICHIER) ?? {};
  const don = (d) => {
    const lien = pageDon(d?.lien);
    return lien ? {titre: texte(d.titre, 120), texte: texte(d.texte, 400), bouton: texte(d.bouton, 40) || 'Faire un don', lien} : null;
  };
  return {
    nom: texte(j.nom, 40) || 'YABAÏ', devise: texte(j.devise, 80), accroche: texte(j.accroche, 80), lieu: texte(j.lieu, 80), rna: texte(j.rna, 20),
    site: https(j.site, ['yabai.fr']) ?? 'https://www.yabai.fr', contact: /^[\w.+-]+@yabai\.fr$/.test(j.contact ?? '') ? j.contact : 'contact@yabai.fr',
    depot: https(j.depot, ['github.com']) ?? 'https://github.com/toyrek/derush',
    histoire: (Array.isArray(j.histoire) ? j.histoire : []).map((p) => texte(p, 500)).filter(Boolean).slice(0, 4),
    mission: texte(j.mission, 500),
    reperes: (Array.isArray(j.reperes) ? j.reperes : []).map((r) => ({chiffre: texte(r?.chiffre, 12), texte: texte(r?.texte, 90)})).filter((r) => r.chiffre && r.texte).slice(0, 3),
    fiscal: texte(j.fiscal, 300), paiement: texte(j.paiement, 400),
    dons: {
      asso: don(j.dons?.asso),
      projets: (Array.isArray(j.dons?.projets) ? j.dons.projets : []).map((p) => {
        const d = don(p);
        return d ? {...d, slug: texte(p.slug, 120), objectif: Number.isFinite(p.objectif) && p.objectif > 0 ? Math.round(p.objectif) : null, fin: jour(p.fin)} : null;
      }).filter(Boolean).slice(0, 4),
    },
    reseaux: (Array.isArray(j.reseaux) ? j.reseaux : []).map((r) => {
      const hote = HOTES_RESEAUX[r?.id];
      const lien = hote ? https(r.lien, [hote]) : null;
      return lien ? {id: r.id, nom: texte(r.nom, 30), compte: texte(r.compte, 40), lien} : null;
    }).filter(Boolean).slice(0, 6),
    photos: (Array.isArray(j.photos) ? j.photos : []).map((p) => {
      const src = https(p?.src, HOTES_PHOTOS);
      return src ? {src, legende: texte(p.legende, 120)} : null;
    }).filter(Boolean).slice(0, 12),
  };
}

/** Les cagnottes et formulaires de don publiés par le site : relus et bornés, les pages hors HelloAsso écartées. */
export function lireCampagnes(liste) {
  if (!Array.isArray(liste)) return [];
  return liste.slice(0, 12).map((c) => {
    const lien = pageDon(c?.url);
    if (!lien) return null;
    return {
      slug: texte(String(c.slug ?? ''), 120), titre: texte(c.title, 160), texte: texte(c.description, 400), lien,
      image: https(c.image, ['cdn.helloasso.com']), fin: jour(c.endDate),
      genre: lien.includes('/collectes/') ? 'collecte' : 'don',
      // Les montants (goal, currentAmount) ne sont pas repris : le site rend aujourd'hui « goal: null » et 0 pour une
      // cagnotte qui a un objectif, et leur unité (euros ou centimes) n'est pas établie. Un compteur faux sur une
      // collecte serait pire que pas de compteur : l'objectif affiché vient de asso.json.
    };
  }).filter((c) => c && c.titre);
}

let enCours = null;
/**
 * La liste des cagnottes en direct, gardée une heure : {le, liste, source}. `source` : 'direct', 'memoire' (moins d'une
 * heure), 'ancien' (le site ne répond pas : la dernière liste connue), 'aucune' (jamais lue). Ne lève jamais d'erreur.
 */
export async function campagnes({force = false} = {}) {
  const garde = lireJson(cache());
  const valable = garde && Array.isArray(garde.liste) && Number.isFinite(garde.le);
  if (!force && valable && Date.now() - garde.le < UNE_HEURE) return {...garde, source: 'memoire'};
  if (enCours) return enCours;
  enCours = (async () => {
    try {
      const r = await fetch(`${API()}/helloassoSync.getDonationCampaigns`, {headers: {accept: 'application/json'}, signal: AbortSignal.timeout(8000)});
      if (!r.ok) throw new Error(`réponse ${r.status}`);
      const j = await r.json();
      const neuf = {le: Date.now(), liste: lireCampagnes(j?.result?.data?.json)};
      try { fs.mkdirSync(DOSSIER_SUPPORT, {recursive: true}); ecrireJson(cache(), neuf); } catch { /* dossier en lecture seule */ }
      return {...neuf, source: 'direct'};
    } catch {
      return valable ? {...garde, source: 'ancien'} : {le: 0, liste: [], source: 'aucune'};
    } finally { enCours = null; }
  })();
  return enCours;
}

/** Les jours pleins qui restent avant la fin (un jour seul compte jusqu'à son dernier instant) ; négatif : c'est fini. */
const joursRestants = (fin) => { if (!fin) return null; const t = Date.parse(/T/.test(fin) ? fin : `${fin}T23:59:59`); return Number.isFinite(t) ? Math.floor((t - Date.now()) / UN_JOUR) : null; };

/**
 * Ce que la fenêtre « Soutenir » montre : l'association, le don libre, et les projets en cours (les cagnottes
 * ouvertes sur HelloAsso, avec ce que asso.json en dit ; sans réponse du site, celles de asso.json qui ne sont pas
 * finies). `direct` : la liste vient de HelloAsso (par le site) à l'instant ou depuis moins d'une heure.
 */
export async function soutien({force = false} = {}) {
  const a = lireAsso();
  const c = await campagnes({force});
  const connus = new Map(a.dons.projets.map((p) => [p.slug, p]));
  const vivant = (p) => { const j = joursRestants(p.fin); return j == null || j >= 0; };
  let projets;
  if (c.source === 'aucune') projets = a.dons.projets.filter(vivant);
  else {
    projets = c.liste.filter((x) => x.genre === 'collecte' && vivant(x)).map((x) => {
      const k = connus.get(x.slug);
      return {slug: x.slug, titre: x.titre, texte: k?.texte || x.texte, bouton: k?.bouton || 'Participer à la cagnotte', lien: x.lien, image: x.image, objectif: k?.objectif ?? null, fin: x.fin ?? k?.fin ?? null};
    });
  }
  // le don libre : celui de asso.json ; s'il a été fermé sur HelloAsso et qu'un autre est ouvert, c'est l'autre
  let asso = a.dons.asso;
  if (c.source !== 'aucune') {
    const ouverts = c.liste.filter((x) => x.genre === 'don' && vivant(x));
    if (ouverts.length && !ouverts.some((x) => x.lien === asso?.lien)) asso = {...(asso ?? {titre: `L’association ${a.nom}`, texte: '', bouton: 'Faire un don'}), lien: ouverts[0].lien};
  }
  return {
    asso: {nom: a.nom, devise: a.devise, accroche: a.accroche, lieu: a.lieu, site: a.site, contact: a.contact, histoire: a.histoire, mission: a.mission, reperes: a.reperes, fiscal: a.fiscal, paiement: a.paiement},
    dons: {asso, projets: projets.map((p) => ({...p, jours: joursRestants(p.fin)}))},
    reseaux: a.reseaux, photos: a.photos, depot: a.depot,
    // le don libre : les montants proposés (ceux de la page de don du site), le plus petit et le plus grand acceptés
    libre: {montants: MONTANTS_DON, min: DON_MIN, max: DON_MAX, deduction: 0.66},
    direct: c.source === 'direct' || c.source === 'memoire', lu_le: c.le || null,
  };
}

/** La bannière de l'accueil : montrée, sauf si la personne l'a fermée (elle revient au bout de 30 jours). */
export function etatBanniere() {
  const jusqua = Date.parse(lireReglages().dons_masque_jusqua ?? '');
  const a = lireAsso();
  const projet = a.dons.projets.find((p) => { const j = joursRestants(p.fin); return j == null || j >= 0; }) ?? null;
  return {montrer: !(Number.isFinite(jusqua) && jusqua > Date.now()), nom: a.nom, depot: a.depot, projet: projet ? {titre: projet.titre, jours: joursRestants(projet.fin)} : null};
}
export function masquerBanniere(jours = 30) {
  changerReglages({dons_masque_jusqua: new Date(Date.now() + Math.min(365, Math.max(1, jours)) * UN_JOUR).toISOString()});
  return etatBanniere();
}

// ——— le don libre : un montant choisi dans Dérush, payé sur HelloAsso (sans cagnotte) ———
/** Les montants proposés (les mêmes que sur la page de don du site), et les bornes d'un don fait depuis Dérush. */
export const MONTANTS_DON = [5, 10, 20, 50, 100];
export const DON_MIN = 1;
export const DON_MAX = 20000;
/** Une page de paiement : seulement chez HelloAsso, en https. */
const pagePaiement = (v) => https(v, ['helloasso.com']);

/**
 * Crée un don libre et rend l'adresse de sa page de paiement : {lien, montant}. Comme la page « Faire un don » du
 * site : le site crée le paiement chez HelloAsso au montant choisi (`donations.create`), HelloAsso encaisse et envoie
 * le reçu. `anonyme` : le nom donné à HelloAsso est « Donateur Anonyme » (l'adresse e-mail reste nécessaire pour le
 * reçu). Rien n'est gardé par Dérush. Lève une erreur lisible ; `e.repli.lien` est alors la page de don de HelloAsso.
 */
export async function creerDon({montant, prenom, nom, email, message = '', anonyme = false}) {
  const a = lireAsso();
  const refus = (t) => Object.assign(new Error(t), {repli: {lien: a.dons.asso?.lien ?? null, email: a.contact}});
  const euros = typeof montant === 'number' ? montant : Number(String(montant ?? '').trim().replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(euros) || euros < DON_MIN) throw new Error(`Un don commence à ${DON_MIN} €.`);
  if (euros > DON_MAX) throw new Error(`Au-delà de ${DON_MAX.toLocaleString('fr-FR')} €, écris-nous à ${a.contact} : on le fait ensemble.`);
  const centimes = Math.round(euros * 100);
  const p = texte(prenom, 60);
  const n = texte(nom, 60);
  const e = adresse(email);
  if (!anonyme && (p.length < 2 || n.length < 2)) throw new Error('Donne ton prénom et ton nom, ou coche « Don anonyme ».');
  if (!e) throw new Error('Donne une adresse e-mail valable : HelloAsso t’y envoie ton reçu.');
  const mot = texte(message, 300);
  let r;
  try {
    r = await fetch(`${API()}/donations.create?batch=1`, {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json'},
      // comme la page de don du site : le reçu fiscal est fait par HelloAsso, pas de don mensuel
      body: JSON.stringify({0: {json: {amount: centimes, donorFirstName: anonyme ? 'Donateur' : p, donorLastName: anonyme ? 'Anonyme' : n, donorEmail: e, ...(mot ? {message: mot} : {}), isAnonymous: !!anonyme, wantsFiscalReceipt: false, isRecurring: false}}}),
      signal: AbortSignal.timeout(25000)});
  } catch {
    throw refus('Le paiement n’a pas pu être préparé : internet ne répond pas. Réessaie, ou passe par la page HelloAsso de l’association.');
  }
  let j = null;
  try { j = await r.json(); } catch { /* une réponse qui n'est pas du JSON */ }
  const un = Array.isArray(j) ? j[0] : j;
  const lien = r.ok ? pagePaiement(un?.result?.data?.json?.url) : null;
  if (lien) return {lien, montant: centimes / 100};
  if (r.status === 429) throw refus('Trop de demandes depuis cette connexion. Réessaie dans un moment, ou passe par la page HelloAsso de l’association.');
  throw refus(`Le paiement n’a pas pu être préparé (le site de l’association répond ${r.status}). Passe par la page HelloAsso de l’association.`);
}

// ——— écrire à l'équipe : le formulaire de contact du site ———
const adresse = (v) => (/^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[A-Za-z]{2,}$/.test(String(v ?? '').trim()) ? String(v).trim() : null);

/**
 * Envoie un message à l'équipe par le formulaire de contact du site (elle le reçoit par e-mail, et peut répondre à
 * l'adresse donnée). Lève une erreur lisible si le message ne peut pas partir ; `e.repli` dit alors comment écrire
 * autrement. Rien de ce que la personne écrit n'est gardé par Dérush.
 */
export async function envoyerMessage({nom, email, sujet, message}) {
  const a = lireAsso();
  const n = texte(nom, 80);
  const e = adresse(email);
  const s = texte(sujet, 140).replace(/[\r\n]+/g, ' ');
  const m = texte(message, 12000);
  if (n.length < 1) throw new Error('Dis-nous ton nom ou ton pseudo.');
  if (!e) throw new Error('Donne une adresse e-mail valable : c’est là qu’on te répond.');
  if (!s) throw new Error('Il manque le sujet.');
  if (m.length < 10) throw new Error('Ton message est trop court : écris au moins une phrase.');
  const refus = (texteErreur) => Object.assign(new Error(texteErreur), {repli: {email: a.contact}});
  let r;
  try {
    r = await fetch(`${API()}/contact.sendMessage?batch=1`, {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json'},
      body: JSON.stringify({0: {json: {name: n, email: e, subject: s, message: m}}}), signal: AbortSignal.timeout(20000)});
  } catch {
    throw refus(`Le message n’est pas parti : internet ne répond pas. Réessaie, ou écris à ${a.contact}.`);
  }
  let j = null;
  try { j = await r.json(); } catch { /* une réponse qui n'est pas du JSON */ }
  const un = Array.isArray(j) ? j[0] : j;
  if (r.ok && un?.result) return {ok: true};
  if (r.status === 429) throw refus(`Trop de messages envoyés depuis cette connexion en une heure. Réessaie plus tard, ou écris à ${a.contact}.`);
  let dit = String(un?.error?.json?.message ?? un?.error?.message ?? j?.error ?? '');
  // le site détaille ce qu'il refuse dans une liste : on n'en garde que les phrases
  try { const liste = JSON.parse(dit); if (Array.isArray(liste)) dit = liste.map((x) => x?.message).filter(Boolean).join(' '); } catch { /* déjà une phrase */ }
  dit = dit.slice(0, 200);
  if (r.status === 400 && dit) throw refus(/email/i.test(dit) ? 'Le site refuse cette adresse e-mail : vérifie-la.' : `Le site refuse ce message : ${dit}`);
  throw refus(`Le message n’est pas parti (le site de l’association répond ${r.status}). Réessaie plus tard, ou écris à ${a.contact}.`);
}

/** Le texte d'un signalement : ce que la personne a écrit, puis le diagnostic si elle le joint. Montré tel quel avant l'envoi. */
export function texteSignalement({description, rapport = null}) {
  const d = texte(description, 4000);
  const r = rapport ? nettoyer(String(rapport)).slice(0, 7500) : '';
  return `${d}${r ? `\n\n———— Diagnostic de Dérush ————\n${r}` : ''}`;
}
/** Envoie un signalement de bug à l'équipe. */
export function signalerBug({nom, email, description, rapport = null}) {
  const d = texte(description, 4000);
  if (d.length < 10) throw new Error('Décris ce qui s’est passé en une phrase ou deux : c’est ce qui nous aide le plus.');
  const titre = d.split(/\s+/).slice(0, 9).join(' ').slice(0, 70);
  return envoyerMessage({nom, email, sujet: `[Dérush ${VERSION}] Bug : ${titre}`, message: texteSignalement({description: d, rapport})});
}
/**
 * L'adresse d'un ticket sur le dépôt (public) : le titre et le diagnostic technique seulement, sans le nom ni
 * l'adresse de la personne ; elle écrit sa description sur la page.
 */
export function lienTicket(rapport = '') {
  const a = lireAsso();
  const corps = `Ce qui s’est passé :\n\n\n———— Diagnostic de Dérush ————\n${nettoyer(String(rapport)).slice(0, 4500)}`;
  return `${a.depot}/issues/new?title=${encodeURIComponent(`[${VERSION}] `)}&body=${encodeURIComponent(corps)}`;
}
