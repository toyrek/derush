#!/usr/bin/env node
// Dérush — les essais du sélecteur d'IA en direct (lib/modeles-ia.mjs) : le catalogue de Codex (« codex debug models »),
// les familles de Gemini (« agy models »), Codex tenu à jour dans le dossier de Dérush, « Nouveau », le modèle choisi.
//   node outils/essai-modeles.mjs [dossier où créer le dossier d'essai]
// Une fausse commande codex, un faux npm et la fausse commande agy : jamais les vraies (dossier personnel et PATH d'essai).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('node outils/essai-modeles.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
fs.mkdirSync(base, {recursive: true});
const tmp = fs.mkdtempSync(path.join(base, 'derush-essai-modeles-'));
const bin = path.join(tmp, 'bin');
fs.mkdirSync(bin, {recursive: true});
// une fausse commande codex : sa version, sa connexion, son catalogue (ECRIT dans codex-catalogue.json)
const catalogue = path.join(tmp, 'codex-catalogue.json');
const faux = (nom, corps) => { const f = path.join(bin, nom); fs.writeFileSync(f, `#!${process.execPath}\n${corps}`); fs.chmodSync(f, 0o755); return f; };
const codex = faux('codex', `const a = process.argv.slice(2).join(' ');
const fs = require('fs');
if (a === '--version') console.log('codex-cli ' + (process.env.FAUX_CODEX_VERSION || '9.9.0'));
else if (a === 'login status') console.log('Logged in using ChatGPT');
else if (a === 'debug models') process.stdout.write(fs.readFileSync(${JSON.stringify(catalogue)}, 'utf8'));
else { console.error('inconnu : ' + a); process.exit(2); }`);
const journalNpm = path.join(tmp, 'npm.log');
const npmFaux = faux('npm', `const fs = require('fs'); fs.appendFileSync(${JSON.stringify(journalNpm)}, process.argv.slice(2).join(' ') + '\\n');
if (process.argv[2] === 'view') console.log(process.env.FAUX_NPM_VERSION || '9.9.0');
// FAUX_NPM_AJOUTE : le Codex installé connaît un modèle de plus (son catalogue le montre ensuite)
if (process.argv[2] === 'install' && process.env.FAUX_NPM_AJOUTE) { const c = JSON.parse(fs.readFileSync(${JSON.stringify(catalogue)}, 'utf8')); c.models.unshift(JSON.parse(process.env.FAUX_NPM_AJOUTE)); fs.writeFileSync(${JSON.stringify(catalogue)}, JSON.stringify(c)); }`);
const ecrireCatalogue = (modeles) => fs.writeFileSync(catalogue, JSON.stringify({models: modeles}));
ecrireCatalogue([
  {slug: 'gpt-6-astra', display_name: 'GPT-6-Astra', description: 'Previous generation model.', visibility: 'list', priority: 3, service_tiers: [{id: 'priority', name: 'Fast', description: '2x speed, increased usage'}]},
  {slug: 'codex-auto-review', display_name: 'Codex Auto Review', visibility: 'hide', priority: 9},
  {slug: 'gpt-6-luna', display_name: 'GPT-6-Luna', description: 'Fast and affordable.', visibility: 'list', priority: 5},
]);
fs.writeFileSync(journalNpm, '');
Object.assign(process.env, {DERUSH_SUPPORT: path.join(tmp, 'support'), HOME: path.join(tmp, 'maison'), PATH: `${bin}:/usr/bin:/bin`, DERUSH_CODEX: codex, DERUSH_NPM: npmFaux,
  DERUSH_AGY: path.join(D, 'outils', 'faux-agy.mjs'), AGY_FAUX_MODELES: 'perso2026'});
fs.mkdirSync(process.env.DERUSH_SUPPORT, {recursive: true});
const imp = (f) => import(pathToFileURL(path.join(D, 'lib', f)).href);
const MI = await imp('modeles-ia.mjs');
const IA = await imp('ia.mjs');
const {changerReglages, lireReglages} = await imp('reglages.mjs');

let ok = 0;
let ko = 0;
const essai = (nom, cond, detail = '') => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`); } };

console.log('Lire les catalogues');
const lu = MI.lireCatalogueCodex(fs.readFileSync(catalogue, 'utf8'));
essai('Codex : seulement les modèles visibles, dans l’ordre de Codex', JSON.stringify(lu.map((m) => m.id)) === '["gpt-6-astra","gpt-6-luna"]' && lu[0].nom === 'GPT-6-Astra', JSON.stringify(lu));
essai('un catalogue illisible ne casse rien', MI.lireCatalogueCodex('pas du json').length === 0);
essai('les vitesses de chaque modèle (Fast, Ultrafast…) sont lues', lu[0].vitesses?.[0]?.id === 'priority' && lu[0].vitesses[0].nom === 'Fast' && lu[1].vitesses.length === 0, JSON.stringify(lu));
const fam = MI.famillesGemini(['gemini-3.8-flash-low', 'gemini-4-argon-high', 'gemini-4-hydrogen-high', 'gemini-4-hydrogen-xhigh', 'gemini-pro-orchestrator-g1-pro', 'claude-opus-5-5-high']);
essai('Gemini : une ligne par famille, la plus forte d’abord, sans l’orchestrateur ni les autres marques', JSON.stringify(fam.map((m) => m.id)) === '["gemini-4-hydrogen","gemini-4-argon","gemini-3.8-flash"]' && fam[0].nom === 'Gemini 4 Hydrogen', JSON.stringify(fam));
const disponibles = ['gemini-4-hydrogen-low', 'gemini-4-hydrogen-medium', 'gemini-4-hydrogen-high', 'gemini-4-hydrogen-xhigh', 'gemini-3.8-flash-medium'];
essai('une famille choisie : sa réflexion suit le niveau (Rapide, Soigné, Maximum)', IA.reglageIA('gemini', 'rapide', 'gemini-4-hydrogen', null, disponibles).modele === 'gemini-4-hydrogen-medium' && IA.reglageIA('gemini', 'soigne', 'gemini-4-hydrogen', null, disponibles).modele === 'gemini-4-hydrogen-high' && IA.reglageIA('gemini', 'max', 'gemini-4-hydrogen', null, disponibles).modele === 'gemini-4-hydrogen-xhigh');

console.log('Le catalogue en direct');
let c = await MI.rafraichirCatalogue();
const cat = MI.catalogueIA({rafraichir: false});
essai('Codex et Gemini lus par leurs commandes, Claude par la liste de Dérush', cat.codex.map((m) => m.nom).join(',') === 'GPT-6-Astra,GPT-6-Luna' && cat.gemini[0]?.id === 'gemini-4-hydrogen' && cat.claude.some((m) => m.id === 'claude-opus-5-5'), JSON.stringify(cat).slice(0, 300));
essai('la toute première fois, rien n’est « Nouveau »', [...cat.codex, ...cat.gemini].every((m) => !m.nouveau));
essai('Codex à jour : rien n’est installé', !fs.readFileSync(journalNpm, 'utf8').includes('install'));
// OpenAI sort un modèle : il apparaît, marqué « Nouveau »
ecrireCatalogue([{slug: 'gpt-6-2-sol', display_name: 'GPT-6.2-Sol', description: 'The new model.', visibility: 'list', priority: 1}, ...JSON.parse(fs.readFileSync(catalogue, 'utf8')).models]);
c = await MI.rafraichirCatalogue();
const cat2 = MI.catalogueIA({rafraichir: false});
essai('un nouveau modèle de ChatGPT apparaît en tête, marqué « Nouveau »', cat2.codex[0]?.id === 'gpt-6-2-sol' && cat2.codex[0].nouveau && !cat2.codex.find((m) => m.id === 'gpt-6-astra').nouveau, JSON.stringify(cat2.codex));
// une version plus récente de Codex sur npm : Dérush met à jour le sien (dans son dossier), une fois toutes les 6 heures au plus
process.env.FAUX_NPM_VERSION = '9.9.9';
changerReglages({}); // rien
const brut = JSON.parse(fs.readFileSync(path.join(process.env.DERUSH_SUPPORT, 'modeles-ia.json'), 'utf8'));
fs.writeFileSync(path.join(process.env.DERUSH_SUPPORT, 'modeles-ia.json'), JSON.stringify({...brut, codex_verifie: new Date(Date.now() - 7 * 3600e3).toISOString()}));
await MI.rafraichirCatalogue();
const npm = fs.readFileSync(journalNpm, 'utf8');
essai('un Codex plus récent sur npm : celui de Dérush est mis à jour, dans son dossier', /install .*@openai\/codex@latest/.test(npm), npm);
const n1 = npm.split('\n').filter((l) => l.startsWith('view')).length;
await MI.rafraichirCatalogue();
essai('… et npm n’est pas réinterrogé avant 6 heures', fs.readFileSync(journalNpm, 'utf8').split('\n').filter((l) => l.startsWith('view')).length === n1);

console.log('Le modèle choisi');
changerReglages({ia_modeles: {codex: 'gpt-6-2-sol', gemini: 'gemini-4-hydrogen'}, ia_modele: 'claude-fable-5-2'});
essai('le choix de chaque IA est gardé s’il est au catalogue', MI.modeleChoisi('codex', lireReglages()) === 'gpt-6-2-sol' && MI.modeleChoisi('gemini', lireReglages()) === 'gemini-4-hydrogen' && MI.modeleChoisi('claude', lireReglages()) === 'claude-fable-5-2');
changerReglages({ia_modeles: {codex: 'gpt-disparu'}});
essai('un modèle retiré du catalogue : retour à Auto', MI.modeleChoisi('codex', lireReglages()) === null);
essai('Codex reçoit le modèle choisi (son identifiant)', IA.reglageIA('codex', 'soigne', 'gpt-6-2-sol').modele === 'gpt-6-2-sol');

console.log('La vitesse de Codex');
changerReglages({ia_vitesses: {codex: 'priority'}});
essai('« Rapide » choisi : gardé pour un modèle qui le propose', MI.vitesseChoisie('codex', lireReglages(), 'gpt-6-astra') === 'priority');
essai('… et oublié pour un modèle qui ne le propose pas (ni pour Auto quand le modèle par défaut ne l’a pas)', MI.vitesseChoisie('codex', lireReglages(), 'gpt-6-luna') === null && MI.vitesseChoisie('codex', lireReglages(), null) === null && MI.vitesseChoisie('claude', lireReglages(), null) === null);
const args = IA.argsCodex({reglage: {effort: 'high', modele: 'gpt-6-astra', vitesse: 'priority'}, aCouper: []});
essai('Codex est lancé avec sa vitesse (service_tier)', args.includes('service_tier="priority"') && !IA.argsCodex({reglage: {effort: 'high'}, aCouper: []}).some((a) => /service_tier/.test(a)), JSON.stringify(args));

console.log('La toute première vérification, avec une mise à jour de Codex');
fs.rmSync(path.join(process.env.DERUSH_SUPPORT, 'modeles-ia.json'));
process.env.FAUX_NPM_AJOUTE = JSON.stringify({slug: 'gpt-6-3-terra', display_name: 'GPT-6.3 Terra', description: 'Plus récent.', visibility: 'list', priority: 0});
await MI.rafraichirCatalogue();
const cat3 = MI.catalogueIA({rafraichir: false});
essai('ce que la mise à jour de Codex apporte est « Nouveau » dès la première fois, le reste non', cat3.codex[0]?.id === 'gpt-6-3-terra' && cat3.codex[0].nouveau && cat3.codex.slice(1).every((m) => !m.nouveau) && cat3.gemini.every((m) => !m.nouveau), JSON.stringify(cat3.codex.map((m) => [m.id, m.nouveau])));

console.log(`\n${ok} essais réussis sur ${ok + ko}`);
if (!ko) fs.rmSync(tmp, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${tmp}`);
process.exit(ko ? 1 : 0);
