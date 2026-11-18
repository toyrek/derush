#!/usr/bin/env node
// Dérush — les essais du Mode Hollywood (lib/gemini-api.mjs, outils/derush-gemini.mjs) contre un faux Google : la clé
// (rangée, jamais renvoyée, jamais dans une adresse, jamais chez une IA), le choix du modèle, un modèle débordé ou à
// court de quota, l'index d'un rush (nettoyé, gardé), l'index posé pour l'IA, l'avis sur une vidéo livrée, la commande ;
// puis la voie de la commande Gemini (le compte Google), contre une fausse commande agy (outils/faux-agy.mjs).
//   node outils/essai-hollywood.mjs [dossier où créer le dossier d'essai]
// Aucun appel réel, aucune vraie clé : un dossier de Dérush jetable (DERUSH_SUPPORT), DERUSH_GEMINI_BASE, DERUSH_AGY ;
// la vraie commande agy de l'ordinateur n'est jamais lancée (dossier personnel et PATH d'essai).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('node outils/essai-hollywood.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const ICI = path.dirname(fileURLToPath(import.meta.url));
const D = path.join(ICI, '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
fs.mkdirSync(base, {recursive: true});
const tmp = fs.mkdtempSync(path.join(base, 'derush-essai-hollywood-'));
process.env.DERUSH_SUPPORT = path.join(tmp, 'support');
fs.mkdirSync(process.env.DERUSH_SUPPORT, {recursive: true});
delete process.env.DERUSH_GEMINI_CLE;
const CLE = 'cle-essai-0123456789-ABCDEFGHIJ';

// ——— le faux Google ———
const requetes = [];
const regle = {carbon: 'ok', reponse: null};
let envois = 0;
const indexFaux = {resume: 'Une jeune femme parle face caméra.', lieu: 'une rue', ambiance: 'animée', personnes: 'une jeune femme',
  moments: [{de: 0, a: 1.5, image: 'plan fixe', son: '« Bonjour »', interet: 4, type: 'parole'}, {de: 1.5, a: 99, image: 'elle sort', son: 'rires', interet: 9, type: 'action'}],
  meilleurs: [{de: 0.5, a: 1.4, pourquoi: 'le sourire'}], problemes: [{de: 2, a: 2.8, quoi: 'son coupé net'}], texte_a_l_ecran: [{a: 1, texte: 'SORTIE'}]};
const serveur = http.createServer((req, res) => {
  let corps = [];
  req.on('data', (d) => corps.push(d));
  req.on('end', () => {
    corps = Buffer.concat(corps);
    requetes.push({url: req.url, cle: req.headers['x-goog-api-key'] ?? null, methode: req.method, taille: corps.length, json: (() => { try { return JSON.parse(corps.toString()); } catch { return null; } })()});
    const json = (code, o, h = {}) => { res.writeHead(code, {'content-type': 'application/json', ...h}); res.end(JSON.stringify(o)); };
    const u = new URL(req.url, 'http://x');
    if (!req.url.startsWith('/envoi/') && req.headers['x-goog-api-key'] !== CLE) return json(400, {error: {code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{reason: 'API_KEY_INVALID'}]}});
    if (u.pathname === '/v1beta/models') return json(200, {models: [
      {name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', supportedGenerationMethods: ['generateContent']},
      {name: 'models/gemini-4-hydrogen', displayName: 'Gemini 4 Hydrogen', supportedGenerationMethods: ['generateContent']},
      {name: 'models/text-embedding-9', displayName: 'Embedding', supportedGenerationMethods: ['embedContent']},
      {name: 'models/gemini-4-carbon', displayName: 'Gemini 4 Carbon', supportedGenerationMethods: ['generateContent'], inputTokenLimit: 1048576},
      {name: 'models/gemini-4-carbon-tts', displayName: 'Carbon TTS', supportedGenerationMethods: ['generateContent']},
      {name: 'models/gemini-3.5-flash-lite', displayName: 'Gemini 3.5 Flash Lite', supportedGenerationMethods: ['generateContent']}]});
    if (u.pathname === '/upload/v1beta/files') { envois++; return json(200, {}, {'x-goog-upload-url': `http://127.0.0.1:${serveur.address().port}/envoi/${envois}`}); }
    if (u.pathname.startsWith('/envoi/')) return json(200, {file: {name: `files/f${u.pathname.split('/').pop()}`, uri: `https://faux/files/f${u.pathname.split('/').pop()}`, mimeType: 'video/mp4', state: 'PROCESSING'}});
    if (u.pathname.startsWith('/v1beta/files/')) return json(200, {name: u.pathname.slice(8), uri: `https://faux/${u.pathname.slice(8)}`, mimeType: 'video/mp4', state: 'ACTIVE'});
    const m = /^\/v1beta\/models\/([^:]+):generateContent$/.exec(u.pathname);
    if (m) {
      if (m[1] === 'gemini-4-carbon' && regle.carbon === 'occupe') return json(503, {error: {code: 503, message: 'This model is currently experiencing high demand.', status: 'UNAVAILABLE'}});
      if (m[1] === 'gemini-4-carbon' && regle.carbon === 'quota') return json(429, {error: {code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED'}});
      if (m[1] === 'gemini-4-carbon' && regle.carbon === 'gratuit') return json(429, {error: {code: 429, status: 'RESOURCE_EXHAUSTED', message: 'You exceeded your current quota. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-4-carbon', details: [{'@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{quotaId: 'GenerateContentRequestsPerMinutePerProjectPerModel-FreeTier'}]}]}});
      const texte = regle.reponse ?? JSON.stringify(indexFaux);
      return json(200, {candidates: [{content: {parts: [{text: texte}]}, finishReason: 'STOP'}], usageMetadata: {totalTokenCount: 1234}, modelVersion: m[1]});
    }
    json(404, {error: {code: 404, message: 'introuvable', status: 'NOT_FOUND'}});
  });
});
await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
process.env.DERUSH_GEMINI_BASE = `http://127.0.0.1:${serveur.address().port}`;

const imp = (f) => import(pathToFileURL(path.join(D, 'lib', f)).href);
const G = await imp('gemini-api.mjs');
const {envIA} = await imp('ia.mjs');
const {lireReglages, changerReglages} = await imp('reglages.mjs');
const lireJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

let ok = 0;
let ko = 0;
const essai = (nom, cond, detail = '') => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`); } };
const attrape = async (f) => { try { await f(); return null; } catch (e) { return e; } };
// une petite vidéo avec du son (3 s), et un son seul
const video = path.join(tmp, 'rush.mp4');
spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=25:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', video]);
const son = path.join(tmp, 'voix.m4a');
spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=2', '-c:a', 'aac', son]);

console.log('La clé');
essai('sans clé : rien n’est demandé à Google', (await G.verifierCleGemini({force: true})).ok === false && requetes.length === 0);
essai('une adresse ou du texte n’est pas une clé', !!(await attrape(() => G.enregistrerCleGemini('https://aistudio.google.com/apikey'))) && !!(await attrape(() => G.enregistrerCleGemini('trop court'))));
G.enregistrerCleGemini(` ${CLE}\n`);
const env = path.join(process.env.DERUSH_SUPPORT, '.env.local');
essai('rangée dans .env.local, lisible par soi seul', fs.readFileSync(env, 'utf8').includes(`DERUSH_GEMINI_CLE=${CLE}`) && (process.platform === 'win32' || (fs.statSync(env).mode & 0o777) === 0o600));
essai('l’état pour l’interface ne contient jamais la clé', !JSON.stringify(G.etatGeminiCle()).includes(CLE) && G.etatGeminiCle().cle === true);
const envIa = envIA();
essai('jamais dans l’environnement d’une IA (envIA)', !Object.values(envIa).includes(CLE) && !('DERUSH_GEMINI_CLE' in envIa));

console.log('Le modèle : le plus fort de la clé');
const v = await G.verifierCleGemini({force: true});
essai('vérifiée : Gemini 4 Carbon choisi', v.ok && v.modele === 'gemini-4-carbon' && v.nom === 'Gemini 4 Carbon', JSON.stringify(v));
essai('puis Hydrogen, puis Flash ; ni embedding, ni TTS', v.autres[0] === 'gemini-4-hydrogen' && v.autres.includes('gemini-3.8-flash') && !v.autres.some((x) => /embedding|tts/.test(x)) && v.autres.indexOf('gemini-3.5-flash-lite') > v.autres.indexOf('gemini-3.8-flash'));
essai('la clé n’est jamais dans une adresse', requetes.every((r) => !r.url.includes(CLE)) && requetes.filter((r) => !r.url.startsWith('/envoi/')).every((r) => r.cle === CLE));
essai('le Mode Hollywood s’allume avec une clé bonne', G.hollywoodActif() === true);
G.changerHollywood(false);
essai('… et se coupe d’un clic', G.hollywoodActif() === false && G.etatGeminiCle().hollywood_demande === false);
G.changerHollywood(true);

console.log('Regarder un rush');
const P = {racine: path.join(tmp, 'projet'), cache: path.join(tmp, 'projet', '.derush'), d: {titre: 'Vlog d’essai', medias: [], montage: [], superpositions: []}};
fs.mkdirSync(path.join(P.racine, 'vidéos'), {recursive: true});
const m = {id: 'M1', nom: 'rush.mp4', type: 'video', duree: 3, chemin: video};
P.d.medias.push(m, {id: 'M2', nom: 'voix.m4a', type: 'audio', duree: 2, chemin: son});
const r1 = await G.regarderRush(P, m);
essai('l’index arrive, avec le modèle le plus fort', r1.modele === 'gemini-4-carbon' && r1.index.resume.startsWith('Une jeune femme'));
essai('ses temps sont bornés à la durée du rush, l’intérêt à 5', r1.index.moments[1].a === 3 && r1.index.moments[1].interet === 5 && r1.index.problemes[0].a === 2.8);
const g = requetes.filter((r) => /generateContent/.test(r.url)).at(-1)?.json;
essai('la vidéo part par l’envoi de fichier, en basse résolution, avec la consigne du réalisateur', !!g?.contents?.[0]?.parts?.[0]?.fileData?.fileUri && g.generationConfig?.mediaResolution === 'MEDIA_RESOLUTION_LOW' && /réalisateur de l'équipe/.test(g.contents[0].parts[1].text) && /"repliques"/.test(g.contents[0].parts[1].text));
essai('il sait pour qui est la vidéo (le projet, son espace), comme le monteur', /Pour qui est cette vidéo[\s\S]*« Vlog d’essai »/.test(g.contents[0].parts[1].text));
const avant = envois;
const r2 = await G.regarderRush(P, m);
essai('un rush déjà regardé ne repart pas', r2.deja === true && envois === avant);
const r3 = await G.regarderRush(P, P.d.medias[1]);
essai('un son seul s’écoute aussi', !!r3.index.resume && /Écoute ce rush/.test(requetes.filter((r) => /generateContent/.test(r.url)).at(-1).json.contents[0].parts[1].text));

console.log('Un modèle débordé, un quota atteint');
regle.carbon = 'occupe';
fs.rmSync(path.join(P.cache, 'medias', 'M1'), {recursive: true, force: true});
const t0 = Date.now();
const r4 = await G.regarderRush(P, m);
essai('Carbon débordé : réessayé, puis Hydrogen répond', r4.modele === 'gemini-4-hydrogen' && requetes.filter((r) => /gemini-4-carbon:generateContent/.test(r.url)).length >= 4, `${r4.modele}, ${Math.round((Date.now() - t0) / 1000)} s`);
essai('… et Carbon reste le choix pour la fois suivante', lireReglages().gemini_api.modele === 'gemini-4-carbon');
regle.carbon = 'quota';
fs.rmSync(path.join(P.cache, 'medias', 'M1'), {recursive: true, force: true});
const r5 = await G.regarderRush(P, m);
essai('Carbon sans quota pour cette clé : Hydrogen devient le choix', r5.modele === 'gemini-4-hydrogen' && lireReglages().gemini_api.modele === 'gemini-4-hydrogen');
regle.carbon = 'ok';

console.log('L’index posé pour l’IA de montage');
const atelier = path.join(tmp, 'atelier');
fs.mkdirSync(atelier, {recursive: true});
const res = await G.regarderPourMontage(P, atelier, {budgetMs: 30000});
const index = fs.readFileSync(path.join(atelier, 'contexte', 'gemini', 'INDEX.md'), 'utf8');
essai('INDEX.md et un JSON par rush', res.rushes === 2 && /## M1 — rush\.mp4/.test(index) && /Les meilleurs moments/.test(index) && fs.existsSync(path.join(atelier, 'contexte', 'gemini', 'M2.json')));
essai('la consigne dit de lire l’index et donne derush-gemini', /contexte\/gemini\/INDEX\.md/.test(G.consigneHollywood(res)) && /derush-gemini/.test(G.consigneHollywood(res)) && G.consigneHollywood({rushes: 0}) === '');
P.d.montage = [{media: 'M2'}];
const res3 = await G.regarderPourMontage(P, atelier, {budgetMs: 30000});
essai('avec un montage, un rush déjà vu compte toujours (le réalisateur choisit parmi tout ce qu’il a vu)', res3.rushes === 2 && fs.existsSync(path.join(atelier, 'contexte', 'gemini', 'M1.json')));
fs.rmSync(path.join(P.cache, 'medias', 'M1', 'gemini.json'), {force: true});
const res2 = await G.regarderPourMontage(P, atelier, {budgetMs: 30000});
essai('… mais il ne regarde maintenant que les rushes du montage', res2.rushes === 1 && !fs.existsSync(path.join(atelier, 'contexte', 'gemini', 'M1.json')));
P.d.montage = [];

console.log('L’avis de Gemini sur la vidéo livrée');
fs.copyFileSync(video, path.join(P.racine, 'vidéos', 'finale.mp4'));
regle.reponse = JSON.stringify({note: 7.5, resume: 'Bien rythmée.', remarques: [{a: 1.2, gravite: 'a_corriger', quoi: 'Titre coupé', conseil: 'Le remonter'}, {a: 103, gravite: 'a_regarder', quoi: 'Fin abrupte', conseil: ''}, {a: 2, quoi: ''}]});
G.lancerAvisGemini(P, 'finale.mp4', {titre: 'Essai', duree: 3});
let a = G.avisGemini(P, 'finale.mp4');
essai('en cours, puis fini, sans faire attendre', a?.etat === 'en_cours');
for (let i = 0; i < 100 && a?.etat === 'en_cours'; i++) { await new Promise((r) => setTimeout(r, 100)); a = G.avisGemini(P, 'finale.mp4'); }
essai('la note, le résumé, les remarques', a?.etat === 'fini' && a.note === 7.5 && a.remarques.length === 2 && a.remarques[0].gravite === 'a_corriger');
essai('un temps après la fin de la vidéo est retiré (la remarque reste)', a?.remarques[1].a === null && a.remarques[1].quoi === 'Fin abrupte');
regle.reponse = null;

console.log('La commande derush-gemini');
// en arrière-plan (jamais spawnSync) : le faux Google tourne dans ce même programme et doit pouvoir répondre
const lancerCmd = (args, envPlus = {}, cwd = atelier) => new Promise((ok) => {
  const p = spawn(process.execPath, [path.join(D, 'outils', 'derush-gemini.mjs'), ...args], {cwd, env: {...process.env, ...envPlus}});
  let stdout = '';
  let stderr = '';
  p.stdout.on('data', (d) => { stdout += d; });
  p.stderr.on('data', (d) => { stderr += d; });
  const garde = setTimeout(() => p.kill(), 60000);
  p.on('close', (status) => { clearTimeout(garde); ok({status, stdout, stderr}); });
});
const aide = await lancerCmd(['--help']);
essai('--help explique tout', aide.status === 0 && /derush-gemini <rush \| fichier> <de> <à> "ta question"/.test(aide.stdout));
fs.mkdirSync(path.join(atelier, 'plans'), {recursive: true});
fs.copyFileSync(video, path.join(atelier, 'plans', 'M1-rush.mp4'));
regle.reponse = 'Il rit à 1,2 s.';
const q = await lancerCmd(['M1', '0', '2.5', 'À quel moment il rit ?']);
const dernier = requetes.filter((r) => /generateContent/.test(r.url)).at(-1)?.json;
essai('un rush du pack : le passage part avec la question, la réponse s’affiche', q.status === 0 && /Il rit à 1,2 s/.test(q.stdout) && !!dernier?.contents?.[0]?.parts?.[0]?.inlineData?.data && /Sa question : À quel moment il rit/.test(dernier.contents[0].parts[1].text), q.stderr);
essai('la commande n’affiche jamais la clé', !q.stdout.includes(CLE) && !q.stderr.includes(CLE));
essai('un passage trop long est refusé', /90 secondes au plus/.test((await lancerCmd(['M1', '0', '200', 'question'])).stderr));
G.changerHollywood(false);
essai('Mode Hollywood coupé : la commande le dit, sans rien envoyer', /Mode Hollywood est coupé/.test((await lancerCmd(['M1', '0', '2', 'question'])).stderr));
G.changerHollywood(true);

console.log('Carbon fermé à l’offre gratuite');
regle.carbon = 'gratuit';
const vg = await G.verifierCleGemini({force: true});
essai('la vérification l’essaie, le dit, et choisit Hydrogen', vg.ok && vg.modele === 'gemini-4-hydrogen' && vg.fermes?.[0]?.modele === 'gemini-4-carbon' && /offre gratuite/.test(vg.fermes[0].raison) && /facturation/.test(vg.fermes[0].raison), JSON.stringify(vg).slice(0, 300));
essai('Connexions le montre', G.etatGeminiCle().fermes?.[0]?.modele === 'gemini-4-carbon');
regle.carbon = 'ok';
const vok = await G.verifierCleGemini({force: true});
essai('facturation activée : « Vérifier » reprend Carbon', vok.modele === 'gemini-4-carbon' && !vok.fermes?.length);

console.log('Une clé refusée');
fs.writeFileSync(env, 'DERUSH_GEMINI_CLE=une-autre-cle-pas-bonne-0000\n');
const v2 = await G.verifierCleGemini({force: true});
essai('Google refuse : la raison en français, sans la clé', v2.ok === false && /refuse cette clé/.test(v2.pourquoi) && !v2.pourquoi.includes('une-autre-cle'));
G.retirerCleGemini();
essai('retirer la clé : plus de Mode Hollywood', !G.cleGemini() && G.hollywoodActif() === false && !fs.readFileSync(env, 'utf8').includes('DERUSH_GEMINI_CLE'));

console.log('Revérifier la clé sans rien demander');
regle.reponse = null;
G.enregistrerCleGemini(CLE);
const listes = () => requetes.filter((r) => r.url.startsWith('/v1beta/models?')).length;
const n0 = listes();
await Promise.all([G.verifierCleGemini({force: true}), G.verifierCleGemini({force: true}), G.verifierCleGemini({force: true})]);
essai('trois demandes en même temps : une seule vérification', listes() - n0 === 1, `${listes() - n0} listes`);
regle.carbon = 'gratuit';
await G.verifierCleGemini({force: true});
regle.carbon = 'ok';
G.etatGeminiCle();
await new Promise((r) => setTimeout(r, 300));
essai('Carbon fermé il y a moins d’une heure : pas de nouvelle vérification', lireReglages().gemini_api.modele === 'gemini-4-hydrogen');
changerReglages({gemini_api: {...lireReglages().gemini_api, le: new Date(Date.now() - 2 * 3600e3).toISOString()}});
G.etatGeminiCle();
for (let i = 0; i < 50 && lireReglages().gemini_api.modele !== 'gemini-4-carbon'; i++) await new Promise((r) => setTimeout(r, 100));
essai('une heure après, Dérush revérifie seul : Carbon repris dès la facturation active', lireReglages().gemini_api.modele === 'gemini-4-carbon');
const baseGoogle = process.env.DERUSH_GEMINI_BASE;
process.env.DERUSH_GEMINI_BASE = 'http://127.0.0.1:9';
const vr = await G.verifierCleGemini({force: true});
essai('Google injoignable : la dernière vérification réussie reste', vr.ok && vr.modele === 'gemini-4-carbon' && G.hollywoodActif());
changerReglages({gemini_api: null});
const vr2 = await G.verifierCleGemini({force: true});
essai('… et sans vérification réussie avant, le Mode Hollywood reste allumé (revérifié au prochain appel)', vr2.ok === false && vr2.genre === 'reseau' && G.hollywoodActif() === true, JSON.stringify(vr2));
process.env.DERUSH_GEMINI_BASE = baseGoogle;
G.retirerCleGemini();

console.log('La commande Gemini (ton compte Google)');
// jamais la vraie commande de cet ordinateur : un dossier personnel et un PATH d'essai (ffmpeg y reste joignable)
const banc = path.join(tmp, 'bin');
fs.mkdirSync(banc, {recursive: true});
for (const o of ['ffmpeg', 'ffprobe']) { const w = spawnSync('which', [o], {encoding: 'utf8'}).stdout.trim(); if (w) fs.symlinkSync(w, path.join(banc, o)); }
Object.assign(process.env, {HOME: path.join(tmp, 'maison'), PATH: `${banc}:/usr/bin:/bin`, DERUSH_AGY: path.join(D, 'outils', 'faux-agy.mjs'), AGY_FAUX: 'oeil', AGY_FAUX_MODELES: 'perso2026', AGY_FAUX_TRACE: path.join(tmp, 'trace-agy')});
const IA = await imp('ia.mjs');
const ec = await IA.etatGeminiRecent(0);
const e0 = G.etatGeminiCle();
essai('connectée : Gemini 4 Hydrogen choisi, en réflexion haute (ni l’orchestrateur, ni Argon)', ec.ok && e0.commande.prete && e0.commande.modele === 'gemini-4-hydrogen-high' && e0.commande.nom === 'Gemini 4 Hydrogen', JSON.stringify(e0.commande));
essai('sans clé, la commande suffit : le Mode Hollywood est allumé', !G.cleGemini() && G.hollywoodActif() && JSON.stringify(e0.voies) === '["commande"]' && e0.nom_oeil === 'Gemini 4 Hydrogen' && e0.prete);
fs.rmSync(path.join(P.cache, 'medias', 'M1'), {recursive: true, force: true});
const avantApi = requetes.length;
const rc = await G.regarderRush(P, m);
essai('le rush est regardé par la commande, rien ne passe par l’API', rc.voie === 'commande' && rc.modele === 'gemini-4-hydrogen-high' && /par la commande/.test(rc.index.resume) && requetes.length === avantApi, JSON.stringify(rc).slice(0, 240));
const trace = JSON.parse(fs.readFileSync(path.join(tmp, 'trace-agy', '.agy-faux.json'), 'utf8'));
const allow = trace.reglages?.permissions?.allow ?? [];
essai('dans son bac à sable : lire la vidéo, son plateau et ses compétences, rien d’autre (ni écrire, ni le web), jamais .env.local', trace.args.includes('--sandbox') && trace.args.includes('gemini-4-hydrogen-high') && trace.reglages.toolPermission === 'proceed-in-sandbox' && allow.length > 0 && allow.every((r) => /^read_file\(/.test(r)) && allow.some((r) => /derush-gemini-/.test(r)) && allow.some((r) => /derush-plateau-/.test(r)) && allow.some((r) => /competences/.test(r)) && trace.reglages.permissions.deny.some((r) => r.includes('.env.local')), JSON.stringify(trace.reglages));
essai('son plateau : son rôle de réalisateur (AGENTS.md) et les mêmes compétences que le monteur, effacé après', /le réalisateur de l'équipe/.test(trace.plateau?.agents ?? '') && ['editing-montage', 'viral-hooks', 'film-taste', 'cutting-rhythm'].every((n) => trace.plateau.competences.includes(n)) && /derush-plateau-/.test(trace.cwd) && !fs.existsSync(trace.cwd), `${trace.plateau?.competences?.length} compétences, plateau ${trace.cwd}`);
essai('l’index garde sa voie', JSON.parse(fs.readFileSync(path.join(P.cache, 'medias', 'M1', 'gemini.json'), 'utf8')).voie === 'commande');
const vus = JSON.parse(fs.readFileSync(path.join(tmp, 'trace-agy', '.fichiers.json'), 'utf8'));
essai('le son lui est donné à part, en MP3, sur les mêmes temps que l’image (une vidéo seule ne lui donne parfois que les images)', vus.length === 2 && /rush\.mp4$/.test(vus[0]) && /son\.mp3$/.test(vus[1]), JSON.stringify(vus));
process.env.AGY_FAUX = 'oeil-sans-lire';
fs.rmSync(path.join(P.cache, 'medias', 'M1'), {recursive: true, force: true});
const e1 = await attrape(() => G.regarderRush(P, m));
// un son seul (une voix .m4a) : la commande refuse le .m4a ; il lui arrive en MP3
process.env.AGY_FAUX = 'oeil';
fs.rmSync(path.join(P.cache, 'medias', 'M2', 'gemini.json'), {force: true});
const rs = await G.regarderRush(P, P.d.medias[1]);
const vusSon = JSON.parse(fs.readFileSync(path.join(tmp, 'trace-agy', '.fichiers.json'), 'utf8'));
essai('un son seul lui arrive en MP3 (le .m4a est refusé par la commande)', rs.voie === 'commande' && vusSon.length === 1 && /son\.mp3$/.test(vusSon[0]), JSON.stringify(vusSon));
process.env.AGY_FAUX = 'oeil-sans-lire';
essai('une réponse donnée sans ouvrir la vidéo est écartée', /sans ouvrir la vidéo/.test(e1?.message ?? ''), e1?.message);
G.enregistrerCleGemini(CLE);
await G.verifierCleGemini({force: true});
essai('avec une clé : la commande d’abord, la clé en secours', JSON.stringify(G.voiesGemini()) === '["commande","cle"]');
const r2c = await G.regarderRush(P, m);
essai('… et la clé prend le relais quand la commande répond sans regarder', r2c.voie === 'cle' && r2c.index.resume.startsWith('Une jeune femme'), JSON.stringify(r2c).slice(0, 200));
process.env.AGY_FAUX = 'oeil-quota';
fs.rmSync(path.join(P.cache, 'medias', 'M1'), {recursive: true, force: true});
const r3c = await G.regarderRush(P, m);
essai('le quota du compte Google est atteint : la clé prend le relais', r3c.voie === 'cle');
process.env.AGY_FAUX = 'oeil';
G.changerVoie('cle');
essai('la clé choisie d’abord : la commande devient le secours', JSON.stringify(G.voiesGemini()) === '["cle","commande"]' && G.etatGeminiCle().voie === 'cle');
G.changerVoie('commande');
G.lancerAvisGemini(P, 'finale.mp4', {titre: 'Essai', duree: 3});
let ac = G.avisGemini(P, 'finale.mp4');
for (let i = 0; i < 150 && ac?.etat === 'en_cours'; i++) { await new Promise((r) => setTimeout(r, 100)); ac = G.avisGemini(P, 'finale.mp4'); }
essai('l’avis sur la vidéo livrée, par la commande', ac?.etat === 'fini' && ac.voie === 'commande' && ac.note === 8 && /par la commande/.test(ac.resume), JSON.stringify(ac).slice(0, 200));
const qc = await lancerCmd(['M1', '0', '2.5', 'À quel moment elle rit ?']);
essai('derush-gemini passe par la commande', qc.status === 0 && /Elle rit à 1,4 s/.test(qc.stdout) && /Gemini 4 Hydrogen/.test(qc.stdout) && !qc.stdout.includes(CLE), qc.stderr || qc.stdout);
const ctl = await lancerCmd(['--controle', path.join(P.racine, 'vidéos', 'finale.mp4'), 'Essai']);
essai('derush-gemini --controle : la note, ce qui coince, les remarques avec leurs temps', ctl.status === 0 && /Le contrôle du réalisateur \(Gemini · Gemini 4 Hydrogen\) : 8\/10/.test(ctl.stdout) && /0:01\.0 \[à regarder\] Titre un peu court/.test(ctl.stdout) && /Rien à corriger : tu peux livrer/.test(ctl.stdout), ctl.stderr || ctl.stdout);
essai('derush-gemini --controle sans vidéo : il le dit', /donne ta vidéo finale/.test((await lancerCmd(['--controle'])).stderr));
// jusqu'à 8 sur 10 : le verdict compte les passes de correction de cette demande (rendu/controle/notes-gemini.jsonl)
essai('8 sur 10 ou plus : le verdict dit de livrer', /Verdict : 8\/10, au moins 8 sur 10 : tu peux livrer/.test(ctl.stdout), ctl.stdout.slice(-300));
fs.rmSync(path.join(atelier, 'rendu', 'controle', 'notes-gemini.jsonl'), {force: true});
const avisNote = (note) => ({AGY_FAUX_REPONSE: JSON.stringify({note, resume: 'Le titre est caché.', remarques: [{a: 1, gravite: 'a_corriger', quoi: 'Titre sous la barre', conseil: 'remonte-le'}]})});
const p1 = await lancerCmd(['--controle', path.join(P.racine, 'vidéos', 'finale.mp4')], avisNote(6));
const p2 = await lancerCmd(['--controle', path.join(P.racine, 'vidéos', 'finale.mp4')], avisNote(7));
const p3 = await lancerCmd(['--controle', path.join(P.racine, 'vidéos', 'finale.mp4')], avisNote(7));
essai('sous 8 : corriger, rendre et relancer (passe 1 sur 2, puis 2 sur 2)', /Verdict : 6\/10, sous 8 .*passe de correction 1 sur 2/.test(p1.stdout) && /Verdict : 7\/10, sous 8 .*passe de correction 2 sur 2/.test(p2.stdout), `${p1.stdout.slice(-200)} | ${p2.stdout.slice(-200)}`);
essai('après deux passes de correction : livrer, et dire la note', /Verdict : 7\/10 après deux passes de correction : livre maintenant/.test(p3.stdout), p3.stdout.slice(-200));

console.log('Le découpage du réalisateur');
P.d.medias.push({id: 'M3', nom: 'trop-court.mp4', type: 'video', duree: 1, chemin: video});
const dec = G.lireDecoupage(JSON.stringify({idee: 'x', duree: 5, plans: [{rush: 'M1', de: 0.5, a: 1.5}, {rush: 'M404', de: 0, a: 1}, {rush: 'M3', de: 0.2, a: 8}, {rush: 'M2', de: 2, a: 1}]}), P.d.medias);
essai('un découpage vérifié : un rush inconnu ou des temps à l’envers retirés, un temps borné à la durée du rush', dec.plans.length === 2 && dec.plans[1].rush === 'M3' && dec.plans[1].a === 1 && dec.total === 1.8, JSON.stringify(dec));
const atelierD = path.join(tmp, 'atelier-decoupage');
fs.mkdirSync(atelierD, {recursive: true});
await G.regarderPourMontage(P, atelierD, {budgetMs: 30000});
const pd = await G.proposerDecoupage(P, atelierD, 'Fais une vidéo verticale de 6 secondes avec le meilleur moment.');
const decMd = fs.readFileSync(path.join(atelierD, 'contexte', 'gemini', 'DECOUPAGE.md'), 'utf8');
const traceD = JSON.parse(fs.readFileSync(path.join(tmp, 'trace-agy', '.agy-faux.json'), 'utf8'));
essai('par la commande : il lit son dérushage, propose ses plans, Dérush les vérifie et les pose', pd?.plans.length === 2 && pd.plans[0].texte === 'BONJOUR' && pd.plans[1].a === 2 && /\| 1 \| M1 \| 0:00\.4 → 0:01\.6 \| accroche/.test(decMd) && /tu restes le monteur/.test(decMd) && traceD.reglages.permissions.allow.some((r) => r.includes(path.join('contexte', 'gemini'))), JSON.stringify(pd).slice(0, 200));
console.log('« Comme cette vidéo »');
fs.copyFileSync(video, path.join(tmp, 'ma-reference.mp4'));
const rf = await G.decomposerReference(P, path.join(tmp, 'ma-reference.mp4'), {nom: 'ma-reference.mp4'});
essai('le réalisateur décompose la référence plan par plan (temps bornés à sa durée, couleurs vérifiées)', rf.reference.plans.length === 2 && rf.reference.plans[1].a <= 3.1 && JSON.stringify(rf.reference.couleurs) === '["#FFD400"]' && rf.reference.accroche === 'un cri dès la première image' && !rf.deja, JSON.stringify(rf).slice(0, 300));
essai('une référence déjà décomposée ne repart pas', (await G.decomposerReference(P, path.join(tmp, 'ma-reference.mp4'), {nom: 'ma-reference.mp4'})).deja === true);
const rmd = G.referenceEnTexte(rf.reference, 'ma-reference.mp4');
essai('REFERENCE.md : au format Motion.md, un style à reproduire, jamais un contenu à copier', /format Motion\.md d’OpenMotion/.test(rmd) && /jamais un contenu à copier/.test(rmd) && /\| 1 \| 0:00\.0 → 0:01\.0 \| accroche/.test(rmd) && /\*\*À garder\*\*/.test(rmd));
await G.proposerDecoupage(P, atelierD, 'Fais la même chose avec mes rushes.', {reference: rmd});
essai('le découpage du réalisateur suit la structure de la référence', JSON.parse(fs.readFileSync(path.join(tmp, 'trace-agy', '.agy-faux.json'), 'utf8')).reference_suivie === true);
essai('la consigne du monteur montre REFERENCE.md', /REFERENCE\.md/.test(G.consigneHollywood({rushes: 2, decoupage: pd, reference: true})) && !/REFERENCE/.test(G.consigneHollywood({rushes: 2})));
const ch = G.consigneHollywood({rushes: 2, decoupage: pd});
essai('la consigne du monteur : le dérushage, le découpage, les questions, le contrôle avant de livrer', /DECOUPAGE\.md/.test(ch) && /derush-gemini --controle/.test(ch) && /tu restes le monteur|tu es le monteur/.test(ch) && !/DECOUPAGE/.test(G.consigneHollywood({rushes: 2})));
essai('sans demande, pas de découpage', (await G.proposerDecoupage(P, atelierD, '  ')) === null);
P.d.medias.pop();
essai('pendant le montage, son dérushage devient aussi l’analyse des médias (section « Médias »)', lireJson(path.join(P.cache, 'medias', 'M2', 'ia.json'))?.moteur === 'gemini');

console.log('« Analyser » en Mode Hollywood');
const {lancerAnalyseIA, etatAnalyseIA, lireAnalyseIA} = await imp('analyse.mjs');
Object.assign(P, {sauver: () => {}, dossierMedia: (id) => path.join(P.cache, 'medias', id)});
fs.writeFileSync(path.join(P.cache, 'medias', 'M2', 'ia.json'), JSON.stringify({resume: 'Vu par Claude.', moteur: 'claude', moments: [], defauts: [], contenu: [], note: 2}));
for (const id of ['M1', 'M2']) fs.rmSync(path.join(P.cache, 'medias', id, 'gemini.json'), {force: true});
await lancerAnalyseIA(P, ['M1', 'M2'], {moteur: 'gemini-oeil'});
let ea = etatAnalyseIA(P);
for (let i = 0; i < 300 && ea?.etat === 'en_cours'; i++) { await new Promise((r) => setTimeout(r, 100)); ea = etatAnalyseIA(P); }
const ia1 = lireAnalyseIA(P, P.d.medias[0]);
essai('Gemini regarde et écoute chaque média ; son dérushage devient l’analyse (résumé, moments, défauts, note)', ea?.etat === 'fini' && ea.nom_ia === 'Gemini' && ia1?.moteur === 'gemini' && /par la commande/.test(ia1.resume) && ia1.moments[0].debut === 0.4 && /Reaction|Accroche|le sourire/.test(ia1.moments[0].quoi) && P.d.medias[0].ia?.resume === ia1.resume, JSON.stringify(ea));
essai('« Analyser » refait aussi l’analyse d’une autre IA, quand on le demande', lireAnalyseIA(P, P.d.medias[1])?.moteur === 'gemini');

console.log('Dès l’import : Gemini regarde chaque rush en fond');
G.retirerCleGemini(); // la commande seule : sans clé en secours
changerReglages({hollywood: null});
essai('sans choix, la commande seule ne l’allume pas (c’est le compte Google de la personne : elle choisit)', !G.cleGemini() && !G.hollywoodActif() && G.etatGeminiCle().hollywood_demande === false && G.regarderEnFond(P, P.d.medias) === null);
G.changerHollywood(true);
for (const id of ['M1', 'M2']) { fs.rmSync(path.join(P.cache, 'medias', id, 'gemini.json'), {force: true}); fs.rmSync(path.join(P.cache, 'medias', id, 'ia.json'), {force: true}); }
const o0 = G.regarderEnFond(P, P.d.medias);
const o1 = G.regarderEnFond(P, P.d.medias);
essai('choisi : les rushes partent en fond, deux à la fois, sans doublon', o0?.total === 2 && o1?.total === 2 && o0.en_cours.length === 2, JSON.stringify(o1));
let oe = G.etatOeil(P);
for (let i = 0; i < 300 && !oe?.fini; i++) { await new Promise((r) => setTimeout(r, 100)); oe = G.etatOeil(P); }
essai('chacun reçoit son dérushage et devient l’analyse du média', oe?.fini && oe.faits === 2 && !oe.arret && lireJson(path.join(P.cache, 'medias', 'M1', 'gemini.json'))?.voie === 'commande' && lireAnalyseIA(P, P.d.medias[0])?.moteur === 'gemini' && !!P.d.medias[0].ia?.resume, JSON.stringify(oe));
essai('un rush déjà vu ne repart pas', G.regarderEnFond(P, P.d.medias)?.total === 0);
process.env.AGY_FAUX = 'oeil-quota';
for (const id of ['M1', 'M2']) fs.rmSync(path.join(P.cache, 'medias', id, 'gemini.json'), {force: true});
G.regarderEnFond(P, P.d.medias);
let oq = G.etatOeil(P);
for (let i = 0; i < 300 && !oq?.fini; i++) { await new Promise((r) => setTimeout(r, 100)); oq = G.etatOeil(P); }
essai('le quota du compte atteint : il s’arrête et dit pourquoi', oq?.fini && /quota/i.test(oq.arret ?? ''), JSON.stringify(oq));
process.env.AGY_FAUX = 'oeil';
G.regarderEnFond(P, P.d.medias);
G.arreterOeil(P);
let oa = G.etatOeil(P);
for (let i = 0; i < 300 && !oa?.fini; i++) { await new Promise((r) => setTimeout(r, 100)); oa = G.etatOeil(P); }
essai('« Arrêter » : ceux en route finissent, les autres ne partent pas', oa?.fini && oa.arret === 'Arrêté.');
process.env.AGY_FAUX = 'oeil-interrompu';
fs.rmSync(path.join(tmp, 'trace-agy', '.interrompu'), {force: true});
fs.rmSync(path.join(P.cache, 'medias', 'M1', 'gemini.json'), {force: true});
const ri = await attrape(() => G.regarderRush(P, P.d.medias[0]));
essai('un flux coupé chez Google : réessayé une fois, puis la réponse arrive', !ri && G.indexDe(P, P.d.medias[0])?.resume?.includes('par la commande') && fs.existsSync(path.join(tmp, 'trace-agy', '.interrompu')), ri?.message);
process.env.AGY_FAUX = 'oeil';

console.log('L’alliance : Whisper et Gemini pour le texte, Dérush pour les doublons');
const PA = {racine: path.join(tmp, 'alliance'), cache: path.join(tmp, 'alliance', '.derush'), d: {titre: 'Alliance', medias: [
  {id: 'M1', nom: 'a.mp4', type: 'video', duree: 4, chemin: video}, {id: 'M2', nom: 'a-copie.mp4', type: 'video', duree: 4.1, chemin: video},
  {id: 'M3', nom: 'b.mp4', type: 'video', duree: 4, chemin: video}, {id: 'M4', nom: 'musique.mp4', type: 'video', duree: 4, chemin: video}], montage: [], superpositions: []}};
const courbeA = Array.from({length: 400}, (_, i) => Math.round(50 + 30 * Math.sin(i / 7) + (i % 13)));
const courbeB = Array.from({length: 400}, (_, i) => Math.round(50 + 30 * Math.cos(i / 3) + (i % 5)));
for (const [id, c, mots] of [['M1', courbeA, ['Bonjour', 'à', 'tous', 'les', 'amis']], ['M2', courbeA.map((v) => v + 1), ['Bonjour', 'à', 'tous']], ['M3', courbeB, []], ['M4', Array(400).fill(60), ['J’abite.', 'J’abite.', 'J’abite.', 'Sous-titres', 'réalisés', 'par']]]) {
  fs.mkdirSync(path.join(PA.cache, 'medias', id), {recursive: true});
  fs.writeFileSync(path.join(PA.cache, 'medias', id, 'ondes.json'), JSON.stringify({pps: 100, niveaux: c}));
  fs.writeFileSync(path.join(PA.cache, 'medias', id, 'mots.json'), JSON.stringify({mots: mots.map((t, k) => ({t, d: k * 0.4, f: k * 0.4 + 0.3}))}));
}
essai('Dérush repère le même rush en deux fichiers (la durée, la courbe du son), sans IA', JSON.stringify(G.doublonsDe(PA, PA.d.medias[0])) === '["M2"]' && JSON.stringify(G.doublonsDe(PA, PA.d.medias[1])) === '["M1"]' && !G.doublonsDe(PA, PA.d.medias[2]).length && !G.doublonsDe(PA, PA.d.medias[3]).length);
const idx = (o) => ({resume: 'x', moments: [{de: 0, a: 4, image: '', son: o.son ?? '', interet: 3, type: ''}], repliques: o.repliques ?? [], meilleurs: [], problemes: [], texte_a_l_ecran: []});
const tMus = G.accordTexte(PA, PA.d.medias[3], idx({son: 'Musique pop japonaise chantée par une voix féminine'}));
const tOk = G.accordTexte(PA, PA.d.medias[0], idx({repliques: [{de: 0, a: 2, qui: 'lui', texte: 'Bonjour à tous les amis'}]}));
const tSeul = G.accordTexte(PA, PA.d.medias[2], idx({repliques: [{de: 0, a: 2, qui: 'elle', texte: 'On cherche un truc à faire ce soir'}]}));
const tDiff = G.accordTexte(PA, PA.d.medias[0], idx({repliques: [{de: 0, a: 2, qui: 'lui', texte: 'Regardez cette enseigne immense là-haut'}]}));
essai('Whisper et Gemini se vérifient : un texte inventé sur une musique, une parole manquée, des mots qui diffèrent', tMus?.etat === 'whisper_seul' && tMus.musique && tOk?.etat === 'ok' && tSeul?.etat === 'gemini_seul' && tDiff?.etat === 'differents', JSON.stringify([tMus, tOk, tSeul, tDiff]));
const txt = G.indexEnTexte(PA.d.medias[3], idx({son: 'Musique'}), {texte: tMus, doublons: []});
const txt2 = G.indexEnTexte(PA.d.medias[0], idx({}), {texte: null, doublons: ['M2']});
essai('le monteur le lit dans l’index : ne pas sous-titrer un texte inventé, n’en garder qu’un des deux', /ne le sous-titre pas sans vérifier/.test(txt) && /que de la musique/.test(txt) && /Le même rush que M2/.test(txt2) && /n'en garde qu'un/.test(txt2));
fs.writeFileSync(path.join(PA.cache, 'medias', 'M1', 'gemini.json'), JSON.stringify({cle: '1:2:2', modele: 'gemini-4-hydrogen-high', voie: 'commande', index: {...idx({}), resume: 'Vu une fois, pour les deux.'}}));
const appelsAvant = fs.existsSync(path.join(tmp, 'trace-agy', '.agy-faux.json')) ? fs.statSync(path.join(tmp, 'trace-agy', '.agy-faux.json')).mtimeMs : 0;
const rj = await G.regarderRush(PA, PA.d.medias[1]);
essai('un doublon reprend le dérushage de son jumeau : Gemini ne le revoit pas', rj.jumeau === 'M1' && rj.index.resume === 'Vu une fois, pour les deux.' && rj.deja && (fs.existsSync(path.join(tmp, 'trace-agy', '.agy-faux.json')) ? fs.statSync(path.join(tmp, 'trace-agy', '.agy-faux.json')).mtimeMs : 0) === appelsAvant);
console.log('Quand la commande ne donne que les images');
G.changerHollywood(true);
process.env.AGY_FAUX = 'oeil-sourd-une-fois';
fs.rmSync(path.join(tmp, 'trace-agy', '.sourd'), {force: true});
fs.rmSync(path.join(P.cache, 'medias', 'M1', 'gemini.json'), {force: true});
const rs1 = await G.regarderRush(P, P.d.medias[0]);
essai('il dit n’avoir eu que les images : un nouvel essai, et cette fois il entend', !rs1.index.sourd && !/Non audible/.test(rs1.index.moments.map((x) => x.son).join(' ')) && fs.existsSync(path.join(tmp, 'trace-agy', '.sourd')), JSON.stringify(rs1.index.moments));
process.env.AGY_FAUX = 'oeil-sourd';
fs.rmSync(path.join(P.cache, 'medias', 'M1', 'gemini.json'), {force: true});
const rs2 = await G.regarderRush(P, P.d.medias[0]);
const txtSourd = G.indexEnTexte(P.d.medias[0], rs2.index, {texte: G.accordTexte(P, P.d.medias[0], rs2.index)});
essai('toujours rien : son dérushage est gardé, marqué, et le monteur se fie à Whisper pour les paroles', rs2.index.sourd === true && /fie-toi au texte de Whisper/.test(txtSourd) && G.accordTexte(P, P.d.medias[0], rs2.index) === null && /Son non entendu/.test(G.analyseDepuisIndex(rs2.index) && JSON.stringify(G.rangerAnalyse(P, P.d.medias[0], rs2, {ecraser: true}) && lireJson(path.join(P.cache, 'medias', 'M1', 'ia.json')).defauts)));
process.env.AGY_FAUX = 'oeil';

console.log('Le monteur dans un bac à sable (Gemini, Codex) : par le relais de Dérush');
const {ouvrirRelais} = await imp('relais.mjs');
const atelierR = path.join(tmp, 'atelier-relais');
fs.mkdirSync(path.join(atelierR, 'rendu'), {recursive: true});
fs.copyFileSync(video, path.join(atelierR, 'rendu', 'final.mp4'));
const rel = await ouvrirRelais(atelierR, {boite: true});
const parBoite = (args) => lancerCmd(args, {DERUSH_RELAIS_BOITE: rel.boite, DERUSH_RELAIS_JETON: rel.jeton, DERUSH_AGY: path.join(tmp, 'pas-d-agy'), HOME: path.join(tmp, 'maison-vide')}, atelierR);
const cb = await parBoite(['--controle', 'rendu/final.mp4', 'Essai']);
essai('derush-gemini --controle passe par la boîte : Dérush le fait hors du bac à sable', cb.status === 0 && /Le contrôle du réalisateur \(Gemini · Gemini 4 Hydrogen\) : 8\/10/.test(cb.stdout) && /hors du bac à sable/.test(cb.stderr), cb.stderr || cb.stdout);
fs.writeFileSync(path.join(tmp, 'dehors.mp4'), fs.readFileSync(video));
const cd = await parBoite(['--controle', path.join(tmp, 'dehors.mp4')]);
essai('un fichier hors du dossier de travail : refusé', cd.status !== 0 && /pas dans le dossier de travail/.test(cd.stderr), cd.stderr);
G.changerHollywood(false);
const cc = await parBoite(['--controle', 'rendu/final.mp4']);
essai('Mode Hollywood coupé : le relais le dit, sans rien envoyer', cc.status !== 0 && /Mode Hollywood est coupé/.test(cc.stderr), cc.stderr);
G.changerHollywood(true);
rel.fermer();
const {modeleGemini} = IA;
const compte = ['gemini-4-argon-high', 'gemini-4-hydrogen-high', 'gemini-4-hydrogen-xhigh', 'gemini-pro-orchestrator-g1-pro', 'gemini-3.8-flash-medium'];
essai('pour monter avec Gemini : Flash en Rapide, Hydrogen en Soigné et en Maximum, jamais l’orchestrateur', modeleGemini('rapide', compte) === 'gemini-3.8-flash-medium' && modeleGemini('soigne', compte) === 'gemini-4-hydrogen-high' && modeleGemini('max', compte) === 'gemini-4-hydrogen-xhigh');
G.retirerCleGemini();
G.changerHollywood(false);
essai('coupé d’un clic, même avec la commande', G.hollywoodActif() === false);
G.changerHollywood(true);

serveur.close();
console.log(`\n${ok} essais réussis sur ${ok + ko}`);
if (!ko) fs.rmSync(tmp, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${tmp}`);
process.exit(ko ? 1 : 0);
