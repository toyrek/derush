// Dérush — le crédit API de Claude, en dernier recours seulement. Anthropic offre parfois du crédit sur son API
// (console.anthropic.com) : il peut prendre le relais quand le forfait Claude est épuisé, mais seulement au choix de la
// personne, jamais tout seul.
//   - La clé est rangée dans .env.local du dossier de Dérush (DERUSH_CLAUDE_API_CLE), jamais affichée ni renvoyée à
//     l'interface. En temps normal, l'IA ne la reçoit pas (envIA retire toute clé de son environnement).
//   - Elle ne sert que pour une demande où la personne l'a choisie (« Continuer avec mon crédit API » quand son forfait
//     est épuisé, ou « Cette fois, avec mon crédit API ») : Claude Code est alors lancé avec ANTHROPIC_API_KEY pour
//     cette seule demande, et ce qu'elle a coûté (total_cost_usd de son résultat) est noté et montré.
//   - « Vérifier » lit la liste des modèles de l'API : rien n'est consommé.
import fs from 'node:fs';
import path from 'node:path';
import {DOSSIER_SUPPORT} from './moteurs.mjs';
import {rangerCle, lireReglages, changerReglages} from './reglages.mjs';
import {lireJson, ecrireJson} from './outils.mjs';

export const NOM_CLE_CLAUDE_API = 'DERUSH_CLAUDE_API_CLE';
const BASE = () => (process.env.DERUSH_ANTHROPIC_BASE || 'https://api.anthropic.com').replace(/\/+$/, '');
const DEPENSES = () => path.join(DOSSIER_SUPPORT, 'credit-api.json');

/** La clé rangée (relue dans .env.local à chaque fois : une clé rangée depuis le Terminal compte tout de suite). */
export function cleClaudeApi() {
  let cle = null;
  try {
    for (const l of fs.readFileSync(path.join(DOSSIER_SUPPORT, '.env.local'), 'utf8').split(/\r?\n/)) {
      const m = new RegExp(`^${NOM_CLE_CLAUDE_API}=(.*)$`).exec(l.trim());
      if (m && m[1].trim()) cle = m[1].trim();
    }
  } catch { /* pas de fichier */ }
  return cle ?? (process.env[NOM_CLE_CLAUDE_API] || null);
}
/** Range la clé collée par la personne (jamais affichée ensuite). */
export function enregistrerCleClaudeApi(cle) {
  const c = String(cle ?? '').replace(/\s+/g, '');
  if (!/^sk-ant-[A-Za-z0-9_-]{20,300}$/.test(c)) throw new Error('Ce n’est pas une clé de l’API Claude : copie-la entière depuis console.anthropic.com (API keys), elle commence par « sk-ant- ».');
  rangerCle(NOM_CLE_CLAUDE_API, c);
  changerReglages({claude_api: null});
  return true;
}
export function retirerCleClaudeApi() { rangerCle(NOM_CLE_CLAUDE_API, null); changerReglages({claude_api: null}); return true; }

/** Vérifie la clé auprès d'Anthropic (la liste des modèles : rien n'est consommé). */
export async function verifierCleClaudeApi() {
  const cle = cleClaudeApi();
  if (!cle) return null;
  let etat;
  try {
    const r = await fetch(`${BASE()}/v1/models?limit=5`, {headers: {'x-api-key': cle, 'anthropic-version': '2023-06-01'}, signal: AbortSignal.timeout(15000)});
    etat = {ok: r.ok, verifie_le: new Date().toISOString(), erreur: r.ok ? null : r.status === 401 || r.status === 403 ? 'Anthropic refuse cette clé : recopie-la depuis console.anthropic.com.' : `Anthropic répond « ${r.status} » : réessaie plus tard.`};
  } catch {
    etat = {ok: false, verifie_le: new Date().toISOString(), erreur: 'Anthropic ne répond pas : vérifie ta connexion à Internet.'};
  }
  changerReglages({claude_api: etat});
  return etat;
}

/** Note ce qu'une demande a coûté sur le crédit API (en dollars), avec le titre du projet. */
export function noterDepense(usd, {projet = null} = {}) {
  const n = Number(usd);
  if (!Number.isFinite(n) || n < 0) return null;
  const d = lireJson(DEPENSES()) ?? {total_usd: 0, utilisations: []};
  d.total_usd = Math.round(((d.total_usd ?? 0) + n) * 10000) / 10000;
  d.utilisations = [...(d.utilisations ?? []), {le: new Date().toISOString(), usd: Math.round(n * 10000) / 10000, projet: projet ? String(projet).slice(0, 80) : null}].slice(-200);
  try { ecrireJson(DEPENSES(), d, 1); } catch { /* dossier en lecture seule */ }
  return d;
}

/** L'état pour l'interface : clé posée, vérifiée, et ce qui a été dépensé avec Dérush. La clé n'y est jamais. */
export function etatClaudeApi() {
  const cle = !!cleClaudeApi();
  const v = lireReglages().claude_api ?? null;
  const d = lireJson(DEPENSES()) ?? {};
  return {cle, ok: cle && v?.ok === true, verifie_le: cle ? v?.verifie_le ?? null : null, erreur: cle ? v?.erreur ?? null : null,
    depense_usd: Math.round((d.total_usd ?? 0) * 100) / 100, utilisations: d.utilisations?.length ?? 0, derniere: d.utilisations?.at(-1) ?? null};
}

/** L'environnement de Claude pour une demande payée par le crédit API (la clé y est ajoutée, pour cette demande). */
export function envCreditApi(env) {
  const cle = cleClaudeApi();
  if (!cle) throw new Error('Ton crédit API de Claude n’est pas branché : Connexions › Claude › « Crédit API ».');
  return {...env, ANTHROPIC_API_KEY: cle};
}
