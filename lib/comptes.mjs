// Dérush — plusieurs comptes par IA, au clic : ChatGPT (par Codex) et Claude (par Claude Code).
//   - Le compte principal est celui de l'ordinateur (~/.codex, ~/.claude) : pour qui n'en a qu'un, rien ne change.
//   - Un autre compte a son propre dossier dans celui de Dérush (comptes/<ia>/<id>/), donné à l'IA par CODEX_HOME
//     (Codex) ou CLAUDE_CONFIG_DIR (Claude Code ; sur le Mac, le trousseau garde sa connexion à part, sous un nom tiré
//     de ce dossier). La personne s'y connecte elle-même, dans son navigateur : Dérush ne voit jamais son mot de passe.
//   - Dérush ne change jamais de compte tout seul : quand celui qui travaille est à bout, il propose « Continuer avec ton
//     autre compte », et la personne choisit, à chaque fois. Les conditions d'OpenAI et d'Anthropic interdisent de
//     contourner leurs limites d'usage : des comptes qui sont vraiment les siens (perso, asso), choisis par elle.
//   - Rien de personnel n'est gardé : le nom que la personne donne au compte (« Compte 2 », « L'asso »), jamais son
//     adresse ni ses jetons (ils restent dans le dossier du compte, là où l'IA les range elle-même).
//   - Gemini n'en a pas : la commande agy garde un seul compte Google (~/.gemini), sans réglage pour en changer.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {DOSSIER_SUPPORT} from './moteurs.mjs';
import {lireJson, ecrireJson} from './outils.mjs';

export const IA_COMPTES = ['claude', 'codex'];
export const PRINCIPAL = 'principal';
/** Les autres comptes d'une IA, en plus du principal. */
export const MAX_COMPTES = 5;
/** La variable qui donne son dossier à l'IA. */
export const VARIABLE_COMPTE = {claude: 'CLAUDE_CONFIG_DIR', codex: 'CODEX_HOME'};
const FICHIER = () => path.join(DOSSIER_SUPPORT, 'comptes.json');
const DOSSIER = (ia) => path.join(DOSSIER_SUPPORT, 'comptes', ia);
const ID = /^c-[a-f0-9]{6}$/;

export class ErreurCompte extends Error {}

function lire() {
  const d = lireJson(FICHIER());
  return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
}
function ecrire(d) {
  fs.mkdirSync(DOSSIER_SUPPORT, {recursive: true});
  ecrireJson(FICHIER(), d, 1);
}
function verifierIA(ia) {
  if (!IA_COMPTES.includes(ia)) throw new ErreurCompte('Plusieurs comptes : seulement pour ChatGPT (Codex) et Claude.');
}
/** Un nom lisible, court, sans balise. */
export const nomPropre = (n, defaut) => String(n ?? '').replace(/[\u0000-\u001f<>"`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) || defaut;
const autresDe = (x) => (Array.isArray(x?.comptes) ? x.comptes.filter((c) => ID.test(String(c?.id ?? ''))) : []);

/** Les comptes d'une IA : le principal d'abord, puis les autres ({id, nom, principal, actif, cree_le}). */
export function listerComptes(ia) {
  if (!IA_COMPTES.includes(ia)) return [];
  const x = lire()[ia] ?? {};
  const autres = autresDe(x);
  const actif = autres.some((c) => c.id === x.actif) ? x.actif : PRINCIPAL;
  return [{id: PRINCIPAL, nom: nomPropre(x.nom_principal, 'Compte principal'), principal: true, actif: actif === PRINCIPAL, cree_le: null},
    ...autres.map((c) => ({id: c.id, nom: nomPropre(c.nom, 'Autre compte'), principal: false, actif: actif === c.id, cree_le: c.cree_le ?? null}))];
}
/** Le compte avec lequel Dérush lance cette IA en ce moment (le principal pour Gemini, ou s'il n'y en a pas d'autre). */
export function compteActif(ia) {
  return listerComptes(ia).find((c) => c.actif) ?? {id: PRINCIPAL, nom: 'Compte principal', principal: true, actif: true, cree_le: null};
}
export const trouverCompte = (ia, id) => listerComptes(ia).find((c) => c.id === (id || PRINCIPAL)) ?? null;
/** Cette IA a-t-elle plus d'un compte ? (Sinon, l'interface ne montre qu'un lien pour en ajouter un.) */
export const plusieursComptes = (ia) => listerComptes(ia).length > 1;

/** Le dossier d'un autre compte (null pour le principal, qui est celui de l'ordinateur). */
export function dossierCompte(ia, id) {
  if (!IA_COMPTES.includes(ia) || !id || id === PRINCIPAL || !ID.test(id)) return null;
  return path.join(DOSSIER(ia), id);
}
/** Ce qu'il faut ajouter à l'environnement de l'IA pour ce compte (rien pour le principal). */
export function envCompte(ia, id = compteActif(ia).id) {
  const d = dossierCompte(ia, id);
  return d ? {[VARIABLE_COMPTE[ia]]: d} : {};
}
/** Le dossier de Codex pour ce compte : celui de l'ordinateur (CODEX_HOME, sinon ~/.codex) pour le principal. */
export function maisonCodex(id = compteActif('codex').id, env = process.env) {
  return dossierCompte('codex', id) ?? (env.CODEX_HOME || path.join(os.homedir(), '.codex'));
}
/** Le compte dont c'est le dossier (le principal pour tout autre dossier : celui de l'ordinateur). */
export function compteDeDossier(ia, dossier) {
  if (!IA_COMPTES.includes(ia) || !dossier) return PRINCIPAL;
  const r = path.resolve(String(dossier));
  return path.dirname(r) === DOSSIER(ia) && ID.test(path.basename(r)) ? path.basename(r) : PRINCIPAL;
}
/** La clé de ce compte dans quotas.json : « claude » pour le principal, « claude@c-1a2b3c » pour un autre. */
export const cleQuota = (ia, id) => (!id || id === PRINCIPAL || !IA_COMPTES.includes(ia) ? ia : `${ia}@${id}`);

/** Ajoute un compte (son dossier est créé, vide : la personne s'y connecte ensuite dans son navigateur). */
export function ajouterCompte(ia, nom = null) {
  verifierIA(ia);
  const d = lire();
  const x = d[ia] ?? {};
  const autres = autresDe(x);
  if (autres.length >= MAX_COMPTES) throw new ErreurCompte(`${MAX_COMPTES} autres comptes au plus : retire d’abord celui qui ne sert plus.`);
  let id;
  do id = `c-${crypto.randomBytes(3).toString('hex')}`; while (autres.some((c) => c.id === id));
  fs.mkdirSync(path.join(DOSSIER(ia), id), {recursive: true, mode: 0o700});
  d[ia] = {...x, comptes: [...autres, {id, nom: nomPropre(nom, `Compte ${autres.length + 2}`), cree_le: new Date().toISOString()}]};
  ecrire(d);
  return trouverCompte(ia, id);
}
/** Renomme un compte (le principal aussi : « Perso », « L'asso »…). */
export function nommerCompte(ia, id, nom) {
  verifierIA(ia);
  if (!trouverCompte(ia, id)) throw new ErreurCompte('Ce compte n’existe plus.');
  const d = lire();
  const x = d[ia] ?? {};
  if (!id || id === PRINCIPAL) d[ia] = {...x, nom_principal: nomPropre(nom, 'Compte principal')};
  else d[ia] = {...x, comptes: autresDe(x).map((c) => (c.id === id ? {...c, nom: nomPropre(nom, c.nom)} : c))};
  ecrire(d);
  return trouverCompte(ia, id);
}
/** Le compte avec lequel Dérush lancera cette IA, choisi par la personne (jamais par Dérush tout seul). */
export function choisirCompte(ia, id) {
  verifierIA(ia);
  const c = trouverCompte(ia, id);
  if (!c) throw new ErreurCompte('Ce compte n’existe plus.');
  const d = lire();
  d[ia] = {...(d[ia] ?? {}), actif: c.id};
  ecrire(d);
  return c;
}
/**
 * Retire un autre compte de Dérush : son dossier est effacé (seulement sous comptes/<ia>/). Avant cela, la personne a
 * été déconnectée par l'IA elle-même (lib/ia.mjs, deconnecterCompte), qui retire aussi sa connexion du trousseau.
 */
export function retirerCompte(ia, id) {
  verifierIA(ia);
  if (!id || id === PRINCIPAL) throw new ErreurCompte('Le compte principal reste : c’est celui de ton ordinateur.');
  const dossier = dossierCompte(ia, id);
  if (!dossier || !trouverCompte(ia, id)) throw new ErreurCompte('Ce compte n’existe plus.');
  const d = lire();
  const x = d[ia] ?? {};
  d[ia] = {...x, comptes: autresDe(x).filter((c) => c.id !== id), actif: x.actif === id ? PRINCIPAL : (x.actif ?? PRINCIPAL)};
  ecrire(d);
  if (path.dirname(dossier) === DOSSIER(ia)) fs.rmSync(dossier, {recursive: true, force: true});
  return true;
}
