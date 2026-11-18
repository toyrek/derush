#!/usr/bin/env node
// Dérush — les essais des quotas des IA (lib/quotas.mjs) et du crédit API de Claude (lib/claude-api.mjs) : ce que
// Claude Code annonce pendant son travail, les quotas de Codex lus par son app-server, un quota atteint puis rechargé,
// la clé de l'API rangée sans jamais être renvoyée, sa vérification, ce qu'une demande a coûté.
//   node outils/essai-quotas.mjs [dossier où créer le dossier d'essai]
// Une fausse commande codex (son app-server), une fausse commande claude et un faux Anthropic : jamais les vrais.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('node outils/essai-quotas.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
fs.mkdirSync(base, {recursive: true});
const tmp = fs.mkdtempSync(path.join(base, 'derush-essai-quotas-'));
const bin = path.join(tmp, 'bin');
fs.mkdirSync(bin, {recursive: true});
const faux = (nom, corps) => { const f = path.join(bin, nom); fs.writeFileSync(f, `#!${process.execPath}\n${corps}`); fs.chmodSync(f, 0o755); return f; };
const dans = (h) => Math.round(Date.now() / 1000 + h * 3600);
// un faux codex : son app-server répond à « initialize » puis à « account/rateLimits/read » (FAUX_QUOTA : la part utilisée)
const journal = path.join(tmp, 'codex.log');
const codex = faux('codex', `const fs = require('fs');
if (process.argv[2] !== 'app-server') { console.log('codex-cli 9.9.0'); process.exit(0); }
fs.appendFileSync(${JSON.stringify(journal)}, 'app-server\\n');
let t = '';
process.stdin.on('data', (d) => { t += d; let i; while ((i = t.indexOf('\\n')) >= 0) { const l = t.slice(0, i); t = t.slice(i + 1); const m = JSON.parse(l);
  if (m.id === 1) console.log(JSON.stringify({id: 1, result: {userAgent: 'faux'}}));
  if (m.id === 2) console.log(JSON.stringify({id: 2, result: {accountId: 'compte-secret-123', ordinaryUsageAllowed: Number(process.env.FAUX_QUOTA) < 100,
    rateLimits: {limitId: 'codex', primary: {usedPercent: Number(process.env.FAUX_QUOTA || 7), windowDurationMins: 10080, resetsAt: ${dans(72)}}, secondary: {usedPercent: 12, windowDurationMins: 300, resetsAt: ${dans(2)}}, planType: 'pro', credits: {hasCredits: false, balance: '0'}, rateLimitReachedType: Number(process.env.FAUX_QUOTA) >= 100 ? 'rate_limit_reached' : null}}})); } });`);
// un faux claude : une petite demande, pendant laquelle il annonce ses quotas
const claude = faux('claude', `console.log(JSON.stringify({type: 'system', subtype: 'init', session_id: 's'}));
console.log(JSON.stringify({type: 'rate_limit_event', rate_limit_info: {status: 'allowed', resetsAt: ${dans(3)}, rateLimitType: 'five_hour', utilization: 0.42, unifiedWindows: {five_hour: {utilization: 0.42, resetsAt: ${dans(3)}}, seven_day: {utilization: 0.61, resetsAt: ${dans(100)}}}}, session_id: 's'}));
console.log(JSON.stringify({type: 'result', subtype: 'success', is_error: false, result: 'OK', total_cost_usd: 0}));`);
// un faux Anthropic : la liste des modèles, pour une seule bonne clé
const BONNE = 'sk-ant-essai-bonne-cle-0123456789abcdef';
const vus = [];
const serveur = http.createServer((req, res) => {
  vus.push({url: req.url, cle: req.headers['x-api-key'] ?? null});
  if (req.url.startsWith('/v1/models') && req.headers['x-api-key'] === BONNE) { res.writeHead(200, {'content-type': 'application/json'}); return res.end('{"data": [{"id": "claude-opus-5-5"}]}'); }
  res.writeHead(401, {'content-type': 'application/json'}); res.end('{"type": "error", "error": {"type": "authentication_error", "message": "invalid x-api-key"}}');
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
Object.assign(process.env, {DERUSH_SUPPORT: path.join(tmp, 'support'), HOME: path.join(tmp, 'maison'), DERUSH_ANTHROPIC_BASE: `http://127.0.0.1:${serveur.address().port}`});
fs.mkdirSync(process.env.DERUSH_SUPPORT, {recursive: true});
const imp = (f) => import(pathToFileURL(path.join(D, 'lib', f)).href);
const Q = await imp('quotas.mjs');
const CA = await imp('claude-api.mjs');
const IA = await imp('ia.mjs');

let ok = 0;
let ko = 0;
const essai = (nom, cond, detail = '') => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`); } };

console.log('Claude : ce qu’il annonce pendant son travail');
essai('rien d’annoncé : quota inconnu', Q.etatQuotas().claude.connu === false);
Q.noterQuotaClaude({status: 'allowed', rateLimitType: 'five_hour', utilization: 0.42, resetsAt: dans(3), unifiedWindows: {five_hour: {utilization: 0.42, resetsAt: dans(3)}, seven_day: {utilization: 0.61, resetsAt: dans(100)}}});
let e = Q.etatQuotas().claude;
essai('les fenêtres (5 heures d’abord, puis la semaine), leur part utilisée et leur recharge', e.connu && e.statut === 'ok' && e.fenetres[0].nom === '5 heures' && e.fenetres[0].pourcent === 42 && e.fenetres[1].nom === 'Semaine' && e.fenetres[1].pourcent === 61 && !!e.fenetres[0].recharge, JSON.stringify(e));
Q.noterQuotaClaude({status: 'allowed_warning', rateLimitType: 'five_hour', utilization: 0.86, resetsAt: dans(3)});
e = Q.etatQuotas().claude;
essai('une annonce d’une seule fenêtre garde les autres ; à 80 % et plus : « presque »', e.statut === 'presque' && e.fenetres.find((f) => f.nom === '5 heures').pourcent === 86 && e.fenetres.find((f) => f.nom === 'Semaine').pourcent === 61, JSON.stringify(e));
Q.noterQuotaClaude({status: 'rejected', rateLimitType: 'five_hour', utilization: 1, resetsAt: dans(1)});
e = Q.etatQuotas().claude;
essai('« rejected » : quota atteint, avec son heure de recharge', e.statut === 'atteint' && Date.parse(e.recharge) > Date.now() && Q.quotaAtteint('claude').atteint, JSON.stringify(e));
Q.noterQuotaClaude({status: 'rejected', rateLimitType: 'five_hour', utilization: 1, resetsAt: Math.round(Date.now() / 1000 - 60)});
e = Q.etatQuotas().claude;
essai('l’heure de recharge passée : il n’est plus atteint (la fenêtre rechargée repart à zéro)', e.statut !== 'atteint' && !Q.quotaAtteint('claude').atteint, JSON.stringify(e));
essai('les messages d’un quota épuisé sont reconnus, pas une simple limite de débit', ['Claude AI usage limit reached|1795547435', 'You\'ve hit your session limit · resets 3pm', 'You\'ve hit your usage limit. Try again in 2 days.', 'RESOURCE_EXHAUSTED: quota exceeded'].every((t) => Q.QUOTA_ATTEINT.test(t)) && !Q.QUOTA_ATTEINT.test('Rate limit reached for requests per minute, retrying') && !Q.QUOTA_ATTEINT.test('stream disconnected before completion'));
const v = await Q.verifierQuotaClaude({chemin: claude});
e = Q.etatQuotas().claude;
essai('« Revérifier » : une petite demande, ses quotas relus (et rien d’autre)', v.ok && e.source === 'verification' && e.fenetres.find((f) => f.nom === '5 heures').pourcent === 42, JSON.stringify({v, e}));

console.log('Codex : ses quotas lus par son app-server');
const lu = Q.lireReponseCodex({accountId: 'compte-secret', ordinaryUsageAllowed: true, rateLimits: {primary: {usedPercent: 7, windowDurationMins: 10080, resetsAt: dans(72)}, secondary: null, planType: 'pro'}});
essai('la réponse lue : la semaine, sa part, le forfait ; jamais l’identifiant du compte', lu.fenetres.primary.nom === 'Semaine' && lu.fenetres.primary.pourcent === 7 && lu.forfait === 'pro' && !JSON.stringify(lu).includes('compte-secret'), JSON.stringify(lu));
let qc = await Q.lireQuotaCodex(codex, {env: {...process.env, FAUX_QUOTA: '7'}});
e = Q.etatQuotas().codex;
essai('par la commande : les deux fenêtres (5 heures, semaine), rangées sans l’identifiant', e.connu && e.fenetres.length === 2 && e.fenetres[0].nom === '5 heures' && e.fenetres.find((f) => f.nom === 'Semaine').pourcent === 7 && e.forfait === 'pro' && !fs.readFileSync(path.join(process.env.DERUSH_SUPPORT, 'quotas.json'), 'utf8').includes('compte-secret'), JSON.stringify(qc));
await Q.lireQuotaCodex(codex, {env: {...process.env, FAUX_QUOTA: '50'}});
essai('relus dans les 10 minutes : la commande n’est pas relancée', fs.readFileSync(journal, 'utf8').split('\n').filter(Boolean).length === 1 && Q.etatQuotas().codex.fenetres.find((f) => f.nom === 'Semaine').pourcent === 7);
await Q.lireQuotaCodex(codex, {forcer: true, env: {...process.env, FAUX_QUOTA: '100'}});
essai('« Revérifier » (forcé) : relus ; à 100 %, le quota est atteint', Q.etatQuotas().codex.statut === 'atteint' && fs.readFileSync(journal, 'utf8').split('\n').filter(Boolean).length === 2);
essai('une commande qui ne répond pas : l’état d’avant reste', (await Q.lireQuotaCodex(path.join(bin, 'absente'), {forcer: true}))?.statut === 'rejected');
essai('Gemini : rien d’annoncé, puis un quota atteint noté depuis son message', Q.etatQuotas().gemini.connu === false && Q.noterQuotaAtteint('gemini', {recharge: new Date(Date.now() + 3600e3).toISOString()}) && Q.etatQuotas().gemini.statut === 'atteint');

console.log('Le crédit API de Claude (dernier recours)');
essai('sans clé : pas prêt, rien à dépenser', CA.etatClaudeApi().cle === false && CA.etatClaudeApi().ok === false && CA.cleClaudeApi() === null);
let refus = null;
try { CA.enregistrerCleClaudeApi('pas-une-cle'); } catch (err) { refus = err.message; }
essai('une clé qui n’en est pas une est refusée, avec ce qu’il faut faire', /sk-ant-/.test(refus ?? ''));
CA.enregistrerCleClaudeApi(` ${BONNE} `);
const verif = await CA.verifierCleClaudeApi();
const etat = CA.etatClaudeApi();
essai('la clé rangée dans .env.local (lisible par toi seul), vérifiée sans rien consommer', verif.ok && etat.ok && fs.readFileSync(path.join(process.env.DERUSH_SUPPORT, '.env.local'), 'utf8').includes(`DERUSH_CLAUDE_API_CLE=${BONNE}`) && (fs.statSync(path.join(process.env.DERUSH_SUPPORT, '.env.local')).mode & 0o077) === 0 && vus.at(-1).url.startsWith('/v1/models'), JSON.stringify(etat));
essai('l’état pour l’interface ne contient jamais la clé', !JSON.stringify(etat).includes(BONNE) && !JSON.stringify(Q.etatQuotas()).includes(BONNE));
essai('l’IA ne la reçoit pas en temps normal (envIA retire toute clé)', !Object.values(IA.envIA()).includes(BONNE) && !('ANTHROPIC_API_KEY' in IA.envIA()));
essai('… seulement pour une demande payée par le crédit (ANTHROPIC_API_KEY, pour cette demande)', CA.envCreditApi({PATH: '/bin'}).ANTHROPIC_API_KEY === BONNE);
CA.noterDepense(1.234, {projet: 'Vlog Osaka'});
CA.noterDepense(0.5);
essai('ce que chaque demande a coûté est noté, et le total montré', CA.etatClaudeApi().depense_usd === 1.73 && CA.etatClaudeApi().utilisations === 2 && CA.etatClaudeApi().derniere.usd === 0.5);
CA.enregistrerCleClaudeApi('sk-ant-essai-mauvaise-cle-0123456789abcdef');
const mauvaise = await CA.verifierCleClaudeApi();
essai('une clé refusée par Anthropic : dit, et le crédit n’est pas prêt', mauvaise.ok === false && /refuse/.test(mauvaise.erreur) && CA.etatClaudeApi().ok === false);
CA.retirerCleClaudeApi();
let sansCle = null;
try { CA.envCreditApi({}); } catch (err) { sansCle = err.message; }
essai('la clé retirée : plus rien dans .env.local, et une demande payée par le crédit est refusée', !fs.readFileSync(path.join(process.env.DERUSH_SUPPORT, '.env.local'), 'utf8').includes('DERUSH_CLAUDE_API_CLE') && /Connexions/.test(sansCle ?? ''));

serveur.close();
console.log(`\n${ok} essais réussis sur ${ok + ko}`);
if (!ko) fs.rmSync(tmp, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${tmp}`);
process.exit(ko ? 1 : 0);
