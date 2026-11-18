// Dérush — les quotas d'utilisation des IA, rendus visibles (Connexions, « Qui monte ? »).
//   - Claude : Claude Code les annonce lui-même pendant qu'il travaille (l'événement « rate_limit_event » de son flux
//     stream-json : la fenêtre de 5 heures, la semaine, la part utilisée et l'heure où elles se rechargent). Dérush garde
//     la dernière annonce. « Revérifier » (sur un clic seulement) lance une toute petite demande pour les relire.
//   - Codex : lus à la demande par son app-server (« account/rateLimits/read »), sans rien consommer ; gardés 10 minutes.
//   - Gemini : la commande de Google ne les donne pas ; Dérush note seulement un quota atteint (« RESOURCE_EXHAUSTED »).
// Rien de personnel n'est gardé (ni identifiant de compte, ni clé) : seulement des parts utilisées et des heures.
// Plusieurs comptes (lib/comptes.mjs) : chacun a ses quotas, rangés sous « claude » (le principal) ou « claude@c-1a2b3c ».
// Sans compte précisé, c'est celui que Dérush utilise en ce moment pour cette IA.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {DOSSIER_SUPPORT} from './moteurs.mjs';
import {lireJson, ecrireJson} from './outils.mjs';
import {preparerLancement} from './plateforme.mjs';
import {commandeLancement, envIA, etatClaude} from './ia.mjs';
import {cleQuota, compteActif, envCompte, IA_COMPTES, PRINCIPAL} from './comptes.mjs';

const FICHIER = () => path.join(DOSSIER_SUPPORT, 'quotas.json');
const lire = () => lireJson(FICHIER()) ?? {};
const DIX_MINUTES = 10 * 60e3;
/** Range l'état d'une IA (avec l'heure où il a été vu). */
function ranger(moteur, x) {
  const q = lire();
  q[moteur] = {...x, le: new Date().toISOString()};
  try { fs.mkdirSync(DOSSIER_SUPPORT, {recursive: true}); ecrireJson(FICHIER(), q, 1); } catch { /* dossier en lecture seule : rien de grave */ }
  return q[moteur];
}
/** Le compte visé : celui donné, sinon celui que Dérush utilise pour cette IA (le principal pour Gemini). */
const idCompte = (moteur, compte) => (IA_COMPTES.includes(moteur) ? (compte || compteActif(moteur).id) : PRINCIPAL);
const cleDe = (moteur, compte) => cleQuota(moteur, idCompte(moteur, compte));
const enDate = (s) => (Number.isFinite(Number(s)) && Number(s) > 0 ? new Date(Number(s) * 1000).toISOString() : null);
const borne = (n) => Math.max(0, Math.min(100, Math.round(n)));

// ——— Claude ———
const NOMS_CLAUDE = {five_hour: '5 heures', seven_day: 'Semaine', seven_day_opus: 'Semaine, Opus', seven_day_sonnet: 'Semaine, Sonnet', seven_day_overage_included: 'Semaine', overage: 'Usage en plus'};
/**
 * Note ce que Claude Code annonce (le « rate_limit_info » d'un « rate_limit_event ») : chaque fenêtre (part utilisée,
 * de 0 à 1 dans l'annonce ; heure de recharge en secondes), l'état (« allowed », « allowed_warning », « rejected ») et
 * l'usage en plus. Une annonce qui ne dit qu'une fenêtre garde les autres, tant qu'elles ne sont pas rechargées.
 */
export function noterQuotaClaude(info, {source = 'travail', compte = null} = {}) {
  if (!info || typeof info !== 'object') return null;
  const cle = cleDe('claude', compte);
  const avant = lire()[cle] ?? {};
  const maintenant = Date.now();
  const fenetres = Object.fromEntries(Object.entries(avant.fenetres ?? {}).filter(([, f]) => f.recharge && Date.parse(f.recharge) > maintenant));
  for (const [id, w] of Object.entries(info.unifiedWindows ?? {})) {
    if (w && Number.isFinite(Number(w.utilization))) fenetres[id] = {pourcent: borne(Number(w.utilization) * 100), recharge: enDate(w.resetsAt)};
  }
  if (info.rateLimitType && Number.isFinite(Number(info.utilization))) fenetres[info.rateLimitType] = {pourcent: borne(Number(info.utilization) * 100), recharge: enDate(info.resetsAt) ?? fenetres[info.rateLimitType]?.recharge ?? null};
  const statut = ['allowed', 'allowed_warning', 'rejected'].includes(info.status) ? info.status : avant.statut ?? 'allowed';
  return ranger(cle, {statut, fenetres, recharge: statut === 'rejected' ? enDate(info.resetsAt) : null,
    usage_en_plus: info.isUsingOverage === true, source});
}

/**
 * Une IA a dit que son quota est atteint (« usage limit », « RESOURCE_EXHAUSTED »…) : noté, avec l'heure de recharge si
 * elle l'a donnée (texte ou secondes).
 */
export function noterQuotaAtteint(moteur, {recharge = null, compte = null} = {}) {
  const cle = cleDe(moteur, compte);
  const avant = lire()[cle] ?? {};
  const r = typeof recharge === 'number' ? enDate(recharge) : recharge && !Number.isNaN(Date.parse(recharge)) ? new Date(recharge).toISOString() : null;
  return ranger(cle, {...avant, statut: 'rejected', recharge: r ?? avant.recharge ?? null, source: 'erreur'});
}

/** Un message d'IA qui dit que le quota est atteint (Claude, Codex ou Gemini), en anglais ou en français. */
export const QUOTA_ATTEINT = /usage limit|hit your (session |weekly |daily |)limit|out of (credits|usage)|quota (exceeded|atteint|épuisé)|RESOURCE_EXHAUSTED|limite d.utilisation|plus de quota/i;

// ——— Codex ———
const nomFenetre = (mins) => (mins === 300 ? '5 heures' : mins === 10080 ? 'Semaine' : mins >= 1440 ? `${Math.round(mins / 1440)} jours` : mins ? `${Math.round(mins / 60)} heures` : 'Quota');
/** Ce que l'app-server de Codex répond (« account/rateLimits/read »), sans l'identifiant du compte. */
export function lireReponseCodex(r) {
  const rl = r?.rateLimits ?? null;
  if (!rl) return null;
  const fenetres = {};
  for (const [cle, w] of [['primary', rl.primary], ['secondary', rl.secondary]]) {
    if (w && Number.isFinite(Number(w.usedPercent))) fenetres[cle] = {nom: nomFenetre(Number(w.windowDurationMins) || 0), pourcent: borne(Number(w.usedPercent)), recharge: enDate(w.resetsAt)};
  }
  const atteint = r.ordinaryUsageAllowed === false || !!rl.rateLimitReachedType || Object.values(fenetres).some((f) => f.pourcent >= 100);
  return {statut: atteint ? 'rejected' : Object.values(fenetres).some((f) => f.pourcent >= 80) ? 'allowed_warning' : 'allowed', fenetres,
    recharge: atteint ? Object.values(fenetres).filter((f) => f.pourcent >= 100).map((f) => f.recharge).sort()[0] ?? null : null,
    forfait: typeof rl.planType === 'string' ? rl.planType : null, credits: rl.credits?.hasCredits ? String(rl.credits.balance ?? '') : null};
}

const LECTURES_CODEX = new Map(); // une lecture à la fois par compte
/**
 * Lit les quotas de Codex par son app-server (`codex app-server`, en JSON-RPC sur son entrée) : rien n'est consommé.
 * Gardés 10 minutes ; une seule lecture à la fois par compte. `chemin` : la commande codex (celle que Dérush lance) ;
 * `compte` : celui dont on lit les quotas (par défaut, celui que Dérush utilise).
 */
export function lireQuotaCodex(chemin, {forcer = false, env = process.env, delai = 20000, compte = null} = {}) {
  const id = idCompte('codex', compte);
  const cle = cleQuota('codex', id);
  const avant = lire()[cle];
  if (!forcer && avant?.le && Date.now() - Date.parse(avant.le) < DIX_MINUTES && avant.source === 'app-server') return Promise.resolve(avant);
  if (!chemin) return Promise.resolve(avant ?? null);
  if (LECTURES_CODEX.has(cle)) return LECTURES_CODEX.get(cle);
  const envCodex = {...env, ...envCompte('codex', id)};
  const lecture = new Promise((ok) => {
    let fini = false;
    const finir = (x) => { if (fini) return; fini = true; clearTimeout(garde); try { p.kill(); } catch { /* déjà arrêté */ } ok(x); };
    const {cmd, prefixe} = commandeLancement(chemin);
    const l = preparerLancement(cmd, [...prefixe, 'app-server'], {env: envCodex, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true, cwd: os.tmpdir()});
    const p = spawn(l.cmd, l.args, l.options);
    const garde = setTimeout(() => finir(avant ?? null), delai);
    const envoyer = (o) => { try { p.stdin.write(`${JSON.stringify(o)}\n`); } catch { /* fermé */ } };
    let tampon = '';
    p.on('error', () => finir(avant ?? null));
    p.on('close', () => finir(avant ?? null));
    p.stdout.on('data', (d) => {
      tampon += d;
      for (let i = tampon.indexOf('\n'); i >= 0; i = tampon.indexOf('\n')) {
        const ligne = tampon.slice(0, i);
        tampon = tampon.slice(i + 1);
        let m;
        try { m = JSON.parse(ligne); } catch { continue; }
        if (m.id === 1) { envoyer({method: 'initialized'}); envoyer({id: 2, method: 'account/rateLimits/read', params: {excludeResetCreditDetails: true}}); }
        else if (m.id === 2) {
          const x = m.result ? lireReponseCodex(m.result) : null;
          finir(x ? ranger(cle, {...x, source: 'app-server'}) : avant ?? null);
        }
      }
    });
    envoyer({id: 1, method: 'initialize', params: {clientInfo: {name: 'derush', version: '1'}}});
  }).finally(() => { LECTURES_CODEX.delete(cle); });
  LECTURES_CODEX.set(cle, lecture);
  return lecture;
}

/**
 * Relit les quotas de Claude, sur un clic seulement : une toute petite demande (Haiku, une ligne, dans un dossier vide)
 * pendant laquelle Claude Code annonce ses fenêtres. Renvoie {ok, message}. `chemin` : la commande claude (essais).
 */
export async function verifierQuotaClaude({chemin = null, delai = 90000, compte = null} = {}) {
  const id = idCompte('claude', compte);
  const actif = id === compteActif('claude').id;
  const c = chemin ? {ok: true, chemin} : await etatClaude().catch(() => null);
  // un autre compte que celui utilisé : sa connexion se voit à la réponse (« Not logged in »)
  if (!c?.chemin || (actif && !c.ok)) return {ok: false, message: 'Claude Code n’est pas connecté à ton compte : Connexions › Claude › « Me connecter ».'};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-quota-'));
  try {
    const lignes = await new Promise((ok) => {
      const {cmd, prefixe} = commandeLancement(c.chemin);
      const l = preparerLancement(cmd, [...prefixe, '-p', 'Réponds seulement : OK.', '--model', 'claude-haiku-5-5', '--effort', 'low', '--output-format', 'stream-json', '--verbose',
        '--permission-mode', 'auto', '--permission-prompts', 'none', '--tools', 'Read'], {cwd: tmp, env: {...envIA([], false), ...envCompte('claude', id)}, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true});
      const p = spawn(l.cmd, l.args, l.options);
      let sortie = '';
      const garde = setTimeout(() => { try { p.kill(); } catch { /* déjà arrêté */ } }, delai);
      p.stdout.on('data', (d) => { sortie += d; });
      p.on('error', () => { clearTimeout(garde); ok([]); });
      p.on('close', () => { clearTimeout(garde); ok(sortie.split('\n').map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean)); });
    });
    let vu = false;
    for (const j of lignes.filter((x) => x.type === 'rate_limit_event')) { noterQuotaClaude(j.rate_limit_info, {source: 'verification', compte: id}); vu = true; }
    const r = lignes.find((x) => x.type === 'result');
    if (r?.is_error && QUOTA_ATTEINT.test(String(r.result ?? ''))) { noterQuotaAtteint('claude', {compte: id}); return {ok: true, message: 'Ton forfait Claude est épuisé pour le moment.'}; }
    if (r?.is_error) return {ok: false, message: /authenticate|log ?in|OAuth/i.test(String(r.result)) ? 'Ce compte Claude n’est pas connecté : Connexions › Claude › « Me connecter ».' : `Claude n’a pas répondu : ${String(r.result ?? '').slice(0, 160)}`};
    if (!vu) return {ok: true, message: 'Claude n’a rien annoncé cette fois : ses quotas s’afficheront pendant son prochain travail.'};
    return {ok: true, message: 'Quotas de Claude relus.'};
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}

// ——— pour l'interface ———
const NOMS_STATUT = {allowed: 'ok', allowed_warning: 'presque', rejected: 'atteint'};
/**
 * L'état des quotas pour l'interface : par IA, {connu, statut (« ok », « presque », « atteint »), fenetres [{nom,
 * pourcent, recharge}], recharge (quand c'est atteint), vu_le, source}. Une fenêtre rechargée depuis est remise à zéro ;
 * un quota atteint dont l'heure de recharge est passée redevient « ok ».
 */
function etatDe(x, maintenant = Date.now()) {
  if (!x) return {connu: false};
  const fenetres = Object.entries(x.fenetres ?? {}).map(([id, f]) => ({id, nom: f.nom ?? NOMS_CLAUDE[id] ?? id, pourcent: f.recharge && Date.parse(f.recharge) <= maintenant ? 0 : f.pourcent, recharge: f.recharge && Date.parse(f.recharge) > maintenant ? f.recharge : null}))
    .sort((a, b) => (a.nom === '5 heures' ? -1 : b.nom === '5 heures' ? 1 : 0));
  let statut = NOMS_STATUT[x.statut] ?? 'ok';
  const passe = statut === 'atteint' && x.recharge && Date.parse(x.recharge) <= maintenant;
  if (passe) statut = 'ok';
  if (statut !== 'atteint' && fenetres.some((f) => f.pourcent >= 100)) statut = 'atteint';
  if (statut === 'ok' && fenetres.some((f) => f.pourcent >= 80)) statut = 'presque';
  return {connu: true, statut, fenetres, recharge: statut === 'atteint' ? (x.recharge && !passe ? x.recharge : fenetres.filter((f) => f.pourcent >= 100).map((f) => f.recharge).filter(Boolean).sort()[0] ?? null) : null,
    vu_le: x.le, source: x.source ?? null, ...(x.forfait ? {forfait: x.forfait} : {}), ...(x.usage_en_plus ? {usage_en_plus: true} : {}), ...(x.credits ? {credits: x.credits} : {})};
}
/** L'état des quotas de chaque IA, pour le compte que Dérush utilise en ce moment. */
export function etatQuotas() {
  const q = lire();
  const maintenant = Date.now();
  return Object.fromEntries(['claude', 'codex', 'gemini'].map((moteur) => [moteur, etatDe(q[cleDe(moteur)], maintenant)]));
}
/** L'état des quotas d'un compte précis (lib/comptes.mjs). */
export const etatQuotaCompte = (moteur, compte) => etatDe(lire()[cleQuota(moteur, compte)]);
/** Le quota de cette IA (du compte utilisé, ou de celui donné) est-il atteint en ce moment ? {atteint, recharge}. */
export function quotaAtteint(moteur, compte = null) {
  const e = compte ? etatQuotaCompte(moteur, compte) : etatQuotas()[moteur];
  return {atteint: e?.statut === 'atteint', recharge: e?.recharge ?? null};
}
/** Oublie les quotas d'un compte retiré. */
export function oublierQuotaCompte(moteur, compte) {
  const cle = cleQuota(moteur, compte);
  const q = lire();
  if (cle === moteur || !q[cle]) return;
  delete q[cle];
  try { ecrireJson(FICHIER(), q, 1); } catch { /* dossier en lecture seule */ }
}
