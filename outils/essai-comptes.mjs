#!/usr/bin/env node
// Dérush — les essais de plusieurs comptes par IA (lib/comptes.mjs), au clic : ChatGPT (Codex) et Claude (Claude Code).
// Un compte ajouté a son dossier (CODEX_HOME, CLAUDE_CONFIG_DIR) ; la page de connexion s'ouvre avec lui, et son lien
// est gardé pour une fenêtre privée ; deux comptes qui mènent au même compte se voient ; chacun a ses quotas ; seul un
// compte connecté peut être choisi, et rien ne change sans ce choix ; le retirer le déconnecte et efface son dossier.
// Puis le crédit API : le crédit de départ noté, et ce qui reste après ce que Dérush dépense.
//   node outils/essai-comptes.mjs [dossier où créer le dossier d'essai]
// De fausses commandes claude et codex (connexion, état, déconnexion, app-server, petite demande) : jamais les vraies,
// jamais le vrai dossier personnel (HOME d'essai), jamais un vrai navigateur.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (/^-/.test(process.argv[2] ?? '')) { console.log('node outils/essai-comptes.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const parent = path.resolve(process.argv[2] ?? os.tmpdir());
fs.mkdirSync(parent, {recursive: true});
const T = fs.mkdtempSync(path.join(fs.realpathSync(parent), 'derush-essai-comptes-'));
const SUPPORT = path.join(T, 'support');
const MAISON = path.join(T, 'maison');
const BIN = path.join(T, 'bin');
for (const d of [SUPPORT, MAISON, BIN, path.join(T, 'bibliotheque'), path.join(T, 'tmp')]) fs.mkdirSync(d, {recursive: true});
const JOURNAL = path.join(T, 'journal.txt');
fs.writeFileSync(JOURNAL, '');

// — les fausses commandes : elles notent ce qu'on leur demande, avec le dossier de compte qu'elles ont reçu —
const faux = (nom, corps) => { const f = path.join(BIN, nom); fs.writeFileSync(f, `#!${process.execPath}\n${corps}`); fs.chmodSync(f, 0o755); return f; };
const dans = (h) => Math.round(Date.now() / 1000 + h * 3600);
const CLAUDE = faux('claude', `const fs = require('fs'); const path = require('path'); const os = require('os');
const dossier = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const noter = (t) => fs.appendFileSync(${JSON.stringify(JOURNAL)}, 'claude ' + t + ' dossier=' + (process.env.CLAUDE_CONFIG_DIR || 'principal') + '\\n');
const a = process.argv.slice(2);
const fiche = path.join(dossier, 'connecte.json');
if (a[0] === '--version') { console.log('9.9.9 (Claude Code)'); process.exit(0); }
if (a[0] === 'auth' && a[1] === 'status') { noter('status'); const c = fs.existsSync(fiche) ? JSON.parse(fs.readFileSync(fiche, 'utf8')) : null;
  console.log(JSON.stringify(c ? {loggedIn: true, authMethod: 'claude.ai', email: c.email, orgId: 'org-essai', orgName: 'Essai', subscriptionType: c.forfait} : {loggedIn: false, authMethod: 'none'})); process.exit(c ? 0 : 1); }
if (a[0] === 'auth' && a[1] === 'login') { noter('login'); console.log('Opening browser to sign in…'); console.log("If your browser didn't open automatically, copy this URL manually"); console.log('https://claude.ai/oauth/authorize?code=true&client_id=essai&state=etat-essai');
  setTimeout(() => { fs.mkdirSync(dossier, {recursive: true}); fs.writeFileSync(fiche, JSON.stringify({email: process.env.FAUX_EMAIL || 'deux@example.com', forfait: 'max'})); }, 250); setTimeout(() => process.exit(0), 900); return; }
if (a[0] === 'auth' && a[1] === 'logout') { noter('logout'); fs.rmSync(fiche, {force: true}); process.exit(0); }
if (a[0] === '-p') { noter('demande');
  if (!fs.existsSync(fiche)) { console.log(JSON.stringify({type: 'result', is_error: true, result: 'Not logged in · Please run /login'})); process.exit(1); }
  console.log(JSON.stringify({type: 'rate_limit_event', rate_limit_info: {status: 'allowed', rateLimitType: 'five_hour', utilization: 0.27, resetsAt: ${dans(3)}}}));
  console.log(JSON.stringify({type: 'result', is_error: false, result: 'OK'})); process.exit(0); }
process.exit(2);`);
// un jeton d'identité comme celui de Codex (auth.json), dont seul « sub » sert : FAUX_SUB
const CODEX = faux('codex', `const fs = require('fs'); const path = require('path'); const os = require('os');
const maison = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const noter = (t) => fs.appendFileSync(${JSON.stringify(JOURNAL)}, 'codex ' + t + ' dossier=' + (process.env.CODEX_HOME || 'principal') + '\\n');
const a = process.argv.slice(2);
const auth = path.join(maison, 'auth.json');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\\+/g, '-').replace(/\\//g, '_');
if (a[0] === '--version') { console.log('codex-cli 99.0.0'); process.exit(0); }
if (a[0] === 'login' && a[1] === 'status') { noter('status'); if (fs.existsSync(auth)) { console.log('Logged in using ChatGPT'); process.exit(0); } console.log('Not logged in'); process.exit(1); }
if (a[0] === 'login') { noter('login'); console.log('Starting local login server on http://localhost:1455.'); console.log('If your browser did not open, navigate to this URL to authenticate:'); console.log(''); console.log('https://auth.openai.com/oauth/authorize?response_type=code&client_id=essai&state=etat-essai');
  setTimeout(() => { fs.mkdirSync(maison, {recursive: true}); fs.writeFileSync(auth, JSON.stringify({auth_mode: 'chatgpt', tokens: {id_token: b64({alg: 'none'}) + '.' + b64({sub: process.env.FAUX_SUB || 'sub-deux', email: 'deux@example.com'}) + '.x', account_id: 'acc'}})); }, 250); setTimeout(() => process.exit(0), 900); return; }
if (a[0] === 'logout') { noter('logout'); fs.rmSync(auth, {force: true}); process.exit(0); }
if (a[0] === 'app-server') { noter('app-server'); const part = Number((() => { try { return fs.readFileSync(path.join(maison, 'part.txt'), 'utf8'); } catch { return '9'; } })());
  let t = ''; process.stdin.on('data', (d) => { t += d; let i; while ((i = t.indexOf('\\n')) >= 0) { const l = t.slice(0, i); t = t.slice(i + 1); const m = JSON.parse(l);
    if (m.id === 1) console.log(JSON.stringify({id: 1, result: {userAgent: 'faux'}}));
    if (m.id === 2) console.log(JSON.stringify({id: 2, result: {accountId: 'compte-secret-123', ordinaryUsageAllowed: part < 100, rateLimits: {primary: {usedPercent: part, windowDurationMins: 300, resetsAt: ${dans(2)}}, planType: 'plus', rateLimitReachedType: part >= 100 ? 'rate_limit_reached' : null}}})); } }); return; }
process.exit(2);`);

// AVANT tout import de lib/ : le dossier de Dérush, le dossier personnel et les commandes sont lus au chargement
Object.assign(process.env, {DERUSH_SUPPORT: SUPPORT, DERUSH_BIBLIOTHEQUE: path.join(T, 'bibliotheque'), DERUSH_SANS_MAJ: '1', DERUSH_SANS_NAVIGATEUR: '1', DERUSH_DRIVE: path.join(T, 'pas-de-drive'),
  HOME: MAISON, USERPROFILE: MAISON, TMPDIR: path.join(T, 'tmp'), DERUSH_CLAUDE: CLAUDE, DERUSH_CODEX: CODEX,
  // seulement ces fausses commandes : jamais un vrai claude ou codex trouvé dans le PATH
  PATH: [BIN, path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter)});
for (const k of ['CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'TREG_TOKEN', 'ANTHROPIC_API_KEY', 'FAUX_SUB', 'FAUX_EMAIL']) delete process.env[k];
if (os.homedir() !== MAISON) { console.error('Le dossier personnel d’essai n’est pas pris en compte : essais abandonnés.'); process.exit(1); }
console.error = () => {}; // le journal du serveur : pas affiché

const lib = (m) => import(pathToFileURL(path.join(D, 'lib', m)).href);
const C = await lib('comptes.mjs');
const IA = await lib('ia.mjs');
const Q = await lib('quotas.mjs');
const CA = await lib('claude-api.mjs');
const {FileDAttente} = await lib('outils.mjs');
const {Projet} = await lib('projet.mjs');
const {demarrerServeur, comptesPourInterface} = await lib('serveur.mjs');

let bons = 0;
let total = 0;
function essai(quoi, vrai, detail = '') {
  total++; if (vrai) bons++;
  console.log(`${vrai ? '  ✓' : '  ✗'} ${quoi}${vrai || !detail ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)?.slice(0, 500)}`}`);
}
const titre = (t) => console.log(`\n${t}`);
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
const leve = (fn, motif = null) => { try { fn(); return false; } catch (e) { return !motif || motif.test(e.message); } };
const journal = () => fs.readFileSync(JOURNAL, 'utf8').split('\n').filter(Boolean);
const vider = () => fs.writeFileSync(JOURNAL, '');
const jusqua = async (f, max = 4000) => { for (let t = 0; t < max; t += 50) { if (await f()) return true; await dormir(50); } return false; };

let serveur = null;
try {
  titre('Les comptes d’une IA (lib/comptes.mjs)');
  essai('au départ : le compte principal seul, celui de l’ordinateur, sans rien à changer', C.listerComptes('codex').length === 1 && C.compteActif('codex').principal && !C.plusieursComptes('codex') && JSON.stringify(C.envCompte('codex')) === '{}');
  essai('Gemini n’en a pas (la commande agy garde un seul compte Google)', C.listerComptes('gemini').length === 0 && leve(() => C.ajouterCompte('gemini'), /ChatGPT|Claude/));
  const asso = C.ajouterCompte('codex', 'L’asso <b>"x"</b>');
  const dossierAsso = C.dossierCompte('codex', asso.id);
  essai('un compte ajouté : un identifiant sans rien de personnel, un nom propre, son dossier (pour toi seul)', /^c-[a-f0-9]{6}$/.test(asso.id) && !/[<>"]/.test(asso.nom) && asso.nom.startsWith('L’asso') && fs.existsSync(dossierAsso) && (fs.statSync(dossierAsso).mode & 0o077) === 0, asso);
  essai('ajouter n’en change pas : le principal reste celui que Dérush utilise', C.compteActif('codex').principal && C.plusieursComptes('codex'));
  essai('son dossier passe à Codex par CODEX_HOME ; le principal, par rien', C.envCompte('codex', asso.id).CODEX_HOME === dossierAsso && JSON.stringify(C.envCompte('codex', 'principal')) === '{}' && C.maisonCodex(asso.id) === dossierAsso && C.maisonCodex('principal') === path.join(MAISON, '.codex'));
  essai('… et à Claude Code par CLAUDE_CONFIG_DIR', (() => { const k = C.ajouterCompte('claude', 'Pro'); const ok = C.envCompte('claude', k.id).CLAUDE_CONFIG_DIR === C.dossierCompte('claude', k.id); C.retirerCompte('claude', k.id); return ok; })());
  essai('le compte d’un dossier, et la clé de ses quotas', C.compteDeDossier('codex', dossierAsso) === asso.id && C.compteDeDossier('codex', path.join(MAISON, '.codex')) === 'principal' && C.cleQuota('codex', asso.id) === `codex@${asso.id}` && C.cleQuota('codex', 'principal') === 'codex' && C.cleQuota('gemini', asso.id) === 'gemini');
  C.nommerCompte('codex', 'principal', 'Perso');
  essai('le principal se renomme aussi (« Perso »)', C.listerComptes('codex')[0].nom === 'Perso');
  const autres = [];
  for (let k = 0; k < C.MAX_COMPTES - 1; k++) autres.push(C.ajouterCompte('codex'));
  essai(`${C.MAX_COMPTES} autres comptes au plus, avec des noms par défaut (« Compte 3 »…)`, leve(() => C.ajouterCompte('codex'), /au plus/) && autres[0].nom === 'Compte 3', autres.map((x) => x.nom));
  C.choisirCompte('codex', autres[0].id);
  C.retirerCompte('codex', autres[0].id);
  essai('retirer le compte utilisé : son dossier est effacé, Dérush reprend le principal', !fs.existsSync(C.dossierCompte('codex', autres[0].id)) && C.compteActif('codex').principal);
  for (const x of autres.slice(1)) C.retirerCompte('codex', x.id);
  essai('le principal ne se retire pas', leve(() => C.retirerCompte('codex', 'principal'), /principal/));

  titre('Se connecter, l’état de chacun, le même compte deux fois (lib/ia.mjs)');
  essai('un compte neuf : pas connecté', (await IA.etatCompte('codex', asso.id, CODEX, {force: true})).connecte === false);
  vider();
  process.env.FAUX_SUB = 'sub-asso';
  IA.connecterCompte('codex', asso.id, CODEX);
  const lienVu = await jusqua(() => IA.lienConnexion('codex', asso.id));
  essai('« Me connecter » : la page de connexion avec SON dossier, et son lien gardé (pour une fenêtre privée)', lienVu && IA.lienConnexion('codex', asso.id).startsWith('https://auth.openai.com/oauth/authorize?') && journal().some((l) => l === `codex login dossier=${dossierAsso}`), journal());
  essai('jamais l’adresse locale du serveur de connexion comme lien', !String(IA.lienConnexion('codex', asso.id)).includes('localhost'));
  await jusqua(() => fs.existsSync(path.join(dossierAsso, 'auth.json')));
  const vAsso = await IA.etatCompte('codex', asso.id, CODEX, {force: true});
  essai('connecté dans le navigateur : vu connecté, avec une empreinte (jamais l’adresse)', vAsso.connecte && /^[a-f0-9]{16}$/.test(vAsso.empreinte ?? '') && !JSON.stringify(vAsso).includes('example.com'), vAsso);
  essai('l’état est gardé deux minutes (rien n’est relancé)', (vider(), await IA.etatCompte('codex', asso.id, CODEX), journal().length === 0));
  // le principal, connecté au MÊME compte ChatGPT (le navigateur a reconnecté d'office le premier)
  fs.mkdirSync(path.join(MAISON, '.codex'), {recursive: true});
  process.env.FAUX_SUB = 'sub-asso';
  IA.connecterCompte('codex', 'principal', CODEX);
  await jusqua(() => fs.existsSync(path.join(MAISON, '.codex', 'auth.json')));
  await dormir(100);
  let liste = await comptesPourInterface('codex', {chemin: CODEX, forcer: 'principal'});
  essai('deux comptes de Dérush qui mènent au même compte : dit sur le second', liste.find((k) => k.id === asso.id)?.meme_que === 'Perso' && !liste[0].meme_que, liste);
  // le principal reconnecté avec un autre compte
  fs.rmSync(path.join(MAISON, '.codex', 'auth.json'));
  process.env.FAUX_SUB = 'sub-perso';
  IA.connecterCompte('codex', 'principal', CODEX);
  await jusqua(() => fs.existsSync(path.join(MAISON, '.codex', 'auth.json')));
  await dormir(100);
  liste = await comptesPourInterface('codex', {chemin: CODEX, forcer: 'principal'});
  essai('… deux comptes différents : rien à dire', liste.every((k) => !k.meme_que) && liste.every((k) => k.connecte), liste);
  essai('la liste pour l’interface : nom, utilisé ou non, connecté, sans jeton ni adresse', liste.length === 2 && liste[0].actif && !liste[1].actif && !JSON.stringify(liste).includes('example.com') && !JSON.stringify(liste).includes('id_token'), liste);
  essai('un seul compte (Claude) : la liste n’a que le principal, et rien n’est lancé pour elle', (vider(), (await comptesPourInterface('claude', {chemin: CLAUDE})).length === 1 && journal().length === 0));
  // Claude : CLAUDE_CONFIG_DIR, le forfait, la connexion
  const pro = C.ajouterCompte('claude', 'Pro');
  const dossierPro = C.dossierCompte('claude', pro.id);
  vider();
  IA.connecterCompte('claude', pro.id, CLAUDE);
  await jusqua(() => IA.lienConnexion('claude', pro.id) && fs.existsSync(path.join(dossierPro, 'connecte.json')));
  const vPro = await IA.etatCompte('claude', pro.id, CLAUDE, {force: true});
  essai('Claude : la connexion avec SON dossier (CLAUDE_CONFIG_DIR), son lien claude.ai, son forfait', journal().includes(`claude login dossier=${dossierPro}`) && IA.lienConnexion('claude', pro.id).startsWith('https://claude.ai/oauth/authorize?') && vPro.connecte && vPro.forfait === 'max', {j: journal(), vPro});
  // l'état de l'IA (« Ton IA ») suit le compte choisi
  C.choisirCompte('codex', asso.id);
  IA.oublierEtats('codex');
  vider();
  const etatCodex = await IA.etatCodex(true);
  essai('le compte choisi : Codex est vérifié avec son dossier, et l’état dit lequel', etatCodex.ok && etatCodex.compte?.id === asso.id && journal().includes(`codex status dossier=${dossierAsso}`), {etatCodex, j: journal()});
  // les connecteurs à couper : ceux du dossier de CE compte (un connecteur qu'il n'a pas : Codex refuserait de démarrer)
  fs.writeFileSync(path.join(MAISON, '.codex', 'config.toml'), '[mcp_servers.perso]\ncommand = "perso"\n');
  essai('les connecteurs de Codex à couper : ceux du compte choisi (le principal en a un, l’autre aucun)', IA.connecteursCodex().length === 0 && IA.connecteursCodex(path.join(C.maisonCodex('principal'), 'config.toml')).join() === 'perso');
  C.choisirCompte('codex', 'principal');
  essai('… le principal choisi : les siens', IA.connecteursCodex().join() === 'perso');

  titre('Les quotas de chaque compte (lib/quotas.mjs)');
  C.choisirCompte('codex', 'principal');
  vider();
  await Q.lireQuotaCodex(CODEX, {forcer: true, env: IA.envIA([], false), compte: asso.id});
  fs.writeFileSync(path.join(MAISON, '.codex', 'part.txt'), '100');
  await Q.lireQuotaCodex(CODEX, {forcer: true, env: IA.envIA([], false)});
  const qAsso = Q.etatQuotaCompte('codex', asso.id);
  essai('Codex : chaque compte lu par son app-server, avec son dossier', journal().includes(`codex app-server dossier=${dossierAsso}`) && journal().includes('codex app-server dossier=principal'), journal());
  essai('… rangés à part : le principal à bout, l’autre à 9 %', Q.etatQuotas().codex.statut === 'atteint' && qAsso.statut === 'ok' && qAsso.fenetres[0].pourcent === 9 && Q.quotaAtteint('codex').atteint && !Q.quotaAtteint('codex', asso.id).atteint, {qAsso, p: Q.etatQuotas().codex});
  C.choisirCompte('codex', asso.id);
  essai('le compte choisi change : « le quota de ChatGPT » est celui de ce compte', Q.etatQuotas().codex.statut === 'ok' && !Q.quotaAtteint('codex').atteint);
  vider();
  const v = await Q.verifierQuotaClaude({chemin: CLAUDE, compte: pro.id});
  essai('Claude : « Revérifier » un compte précis, avec son dossier ; ses quotas à lui', v.ok && journal().includes(`claude demande dossier=${dossierPro}`) && Q.etatQuotaCompte('claude', pro.id).fenetres?.[0]?.pourcent === 27 && !Q.etatQuotas().claude.connu, {v, j: journal()});
  Q.noterQuotaAtteint('claude', {compte: 'principal'});
  essai('un quota atteint noté pour un compte ne touche pas les autres', Q.quotaAtteint('claude', 'principal').atteint && !Q.quotaAtteint('claude', pro.id).atteint);
  const fq = fs.readFileSync(path.join(SUPPORT, 'quotas.json'), 'utf8');
  essai('quotas.json : des parts et des heures, jamais l’identifiant du compte ni une adresse', !fq.includes('compte-secret') && !fq.includes('example.com') && fq.includes(`codex@${asso.id}`), fq.slice(0, 300));

  titre('Les routes (lib/serveur.mjs) : au clic, jamais tout seul');
  const ctx = {P: null, file: new FileDAttente(), app: false, natif: false, ouvrir() { return null; }, fermer() { ctx.P = null; }};
  ({serveur} = await demarrerServeur(ctx, {port: 0}));
  const base = `http://127.0.0.1:${serveur.address().port}`;
  const jeton = /name="derush-jeton" content="([^"]+)"/.exec(await (await fetch(`${base}/`)).text())?.[1];
  const api = async (methode, p, corps) => { const r = await fetch(`${base}${p}`, {method: methode, headers: {'x-derush-jeton': jeton, 'x-derush-fenetre': 'essai', ...(corps !== undefined ? {'content-type': 'application/json'} : {})}, body: corps !== undefined ? JSON.stringify(corps) : undefined}); return {code: r.status, j: await r.json().catch(() => null)}; };
  essai('le serveur d’essai répond (jeton de la page)', !!jeton);
  C.choisirCompte('codex', 'principal');
  process.env.FAUX_SUB = 'sub-trois';
  let r = await api('POST', '/api/comptes/codex/ajouter', {nom: 'Trois'});
  const trois = r.j?.compte;
  essai('« ajouter » : le compte est créé et sa page de connexion s’ouvre ; Dérush ne le choisit pas', r.code === 200 && /^c-/.test(trois?.id ?? '') && /navigateur/.test(r.j.message) && !r.j.comptes.find((k) => k.id === trois.id)?.actif, r);
  r = await api('POST', '/api/comptes/codex/choisir', {id: trois.id});
  const refusAvant = r;
  await jusqua(() => fs.existsSync(path.join(C.dossierCompte('codex', trois.id), 'auth.json')));
  essai('un compte pas encore connecté ne peut pas être choisi (sinon l’IA s’arrêterait net)', refusAvant.code === 400 && /pas connecté/.test(refusAvant.j?.erreur ?? refusAvant.j?.message ?? ''), refusAvant);
  r = await api('GET', `/api/connexions?compte=codex:${trois.id}`);
  essai('Connexions : la liste des comptes, celui qu’on attend revérifié (connecté maintenant)', r.code === 200 && r.j.comptes?.codex?.find((k) => k.id === trois.id)?.connecte === true && r.j.comptes.codex.length === 3, r.j?.comptes);
  r = await api('POST', '/api/comptes/codex/choisir', {id: trois.id});
  essai('« Utiliser » : Dérush travaille avec lui, et le dit', r.code === 200 && /Trois/.test(r.j.message) && r.j.comptes.find((k) => k.id === trois.id)?.actif && C.compteActif('codex').id === trois.id, r);
  r = await api('GET', '/api/connexions');
  essai('« Ton IA » dit le compte choisi', r.j?.codex?.compte?.id === trois.id && r.j.codex.ok === true, r.j?.codex);
  r = await api('POST', '/api/comptes/codex/nommer', {id: trois.id, nom: 'Agence'});
  essai('renommer', r.code === 200 && r.j.comptes.find((k) => k.id === trois.id)?.nom === 'Agence');
  essai('un compte de Gemini, ou le principal à retirer : refusés', (await api('POST', '/api/comptes/gemini/ajouter', {})).code === 404 && (await api('POST', '/api/comptes/codex/retirer', {id: 'principal'})).code === 400);
  vider();
  const dossierTrois = C.dossierCompte('codex', trois.id);
  r = await api('POST', '/api/comptes/codex/retirer', {id: trois.id});
  essai('« Retirer » : déconnecté par Codex lui-même (avec son dossier), dossier effacé, le principal repris', r.code === 200 && journal().includes(`codex logout dossier=${dossierTrois}`) && !fs.existsSync(dossierTrois) && C.compteActif('codex').principal && !fs.readFileSync(path.join(SUPPORT, 'quotas.json'), 'utf8').includes(trois.id), {r, j: journal()});
  // un projet ouvert, pour la conversation
  fs.mkdirSync(path.join(T, 'projet'), {recursive: true});
  ctx.P = new Projet(path.join(T, 'projet'));
  ctx.P.d.titre = 'Essai des comptes';
  ctx.P.sauver();
  vider();
  r = await api('GET', '/api/claude');
  essai('la conversation reçoit les comptes (sans relancer leur vérification), pour proposer l’autre quand l’un est à bout', r.code === 200 && Array.isArray(r.j?.comptes?.codex) && r.j.comptes.codex.length === 2 && r.j.comptes.codex.every((k) => 'connecte' in k) && !journal().some((l) => /status/.test(l) && !/principal/.test(l)), {code: r.code, comptes: r.j?.comptes, erreur: r.j?.erreur, j: journal()});
  r = await api('POST', '/api/connexions/quotas/verifier', {moteur: 'codex', compte: asso.id});
  essai('« Revérifier » le quota d’un compte précis', r.code === 200 && /relus/.test(r.j?.message ?? ''), r);

  titre('Le crédit API : ce qui reste (lib/claude-api.mjs)');
  r = await api('POST', '/api/connexions/claude-api/depart', {usd: '1 300,50 $'});
  essai('le crédit de départ noté (« 1 300,50 $ » compris)', r.code === 200 && r.j.claude_api.depart_usd === 1300.5 && r.j.claude_api.reste_usd === 1300.5, r.j?.claude_api);
  CA.noterDepense(2.25, {projet: 'Essai'});
  CA.noterDepense(0.25);
  let a = CA.etatClaudeApi();
  essai('Dérush en retire ce qu’il dépense ensuite : il reste environ 1 298 $', a.reste_usd === 1298 && a.depense_depuis_usd === 2.5, a);
  CA.noterCreditDepart(1000);
  a = CA.etatClaudeApi();
  essai('noté de nouveau (après un coup d’œil à la console) : on repart de là', a.depart_usd === 1000 && a.reste_usd === 1000 && a.depense_usd === 2.5, a);
  CA.noterDepense(1200);
  essai('jamais en dessous de zéro', CA.etatClaudeApi().reste_usd === 0);
  r = await api('POST', '/api/connexions/claude-api/depart', {usd: 'beaucoup'});
  essai('un montant illisible est refusé, avec un exemple', r.code === 400 && /1300/.test(JSON.stringify(r.j)), r);
  r = await api('POST', '/api/connexions/claude-api/depart', {usd: ''});
  essai('vide : plus de crédit noté', r.code === 200 && r.j.claude_api.depart_usd === undefined && r.j.claude_api.reste_usd === undefined, r.j?.claude_api);
  essai('comptes.json : des noms et des identifiants de Dérush seulement', !/example\.com|sub-|id_token|sk-ant/.test(fs.readFileSync(path.join(SUPPORT, 'comptes.json'), 'utf8')));
} catch (e) {
  essai(`sans erreur (${e?.stack ?? e})`, false);
} finally {
  serveur?.close?.();
}
console.log(`\n${bons} essais réussis sur ${total}`);
if (bons === total) fs.rmSync(T, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${T}`);
process.exit(bons === total ? 0 : 1);
