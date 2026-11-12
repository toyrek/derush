// Dérush — les essais du moteur Gemini (pour qui modifie Dérush) : aucun appel à Google, aucun compte.
//   node outils/essai-gemini.mjs [dossier d'essai]
// Ce qui est vérifié : le choix du modèle selon le compte, les arguments donnés à « agy » (jamais sans bac à sable), la
// lecture de ses événements (des lignes relevées sur la vraie commande, agy 1.5.6), ce que le bac à sable a le droit de
// lire et d'écrire (jamais le dossier personnel), et la boîte du relais (jamais à travers un lien posé par l'IA).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const essais = path.resolve(process.argv[2] ?? path.join(os.tmpdir(), 'derush-essai-gemini'));
fs.rmSync(essais, {recursive: true, force: true});
fs.mkdirSync(essais, {recursive: true});
// un dossier de réglages à part : rien n'est lu ni écrit dans celui de la personne
process.env.DERUSH_SUPPORT = path.join(essais, 'support');
fs.mkdirSync(process.env.DERUSH_SUPPORT, {recursive: true});
const {modeleGemini, reglageIA, argsGemini, lecteurGemini, refusGemini} = await import(`${D}/lib/ia.mjs`);
const {racineOutil, outilsLisibles, reglagesGemini, envGemini} = await import(`${D}/lib/gemini.mjs`);
const {ouvrirRelais, dossierBoite} = await import(`${D}/lib/relais.mjs`);
const {demanderParBoite} = await import(`${D}/lib/boite.mjs`);

const resultats = [];
const essai = async (nom, verifier) => {
  let bon = false;
  let dit = '';
  try { const r = await verifier(); bon = r === true; if (!bon) dit = JSON.stringify(r)?.slice(0, 400) ?? ''; } catch (e) { dit = `a levé : ${e.message}`; }
  console.log(`${bon ? '✓' : '✗'} ${nom}${bon ? '' : `\n   ${dit}`}`);
  resultats.push(bon);
};
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
const reel = (f) => fs.realpathSync(f);

console.log('— Le modèle, selon ce que le compte propose —');
const PERSO = ['gemini-4-argon-medium', 'gemini-4-argon-high', 'gemini-4-argon-low', 'gemini-3.8-flash-high', 'gemini-3.8-flash-medium', 'gemini-3.8-flash-low'];
const CARBON = ['gemini-4-carbon-high', 'gemini-4-carbon-medium', 'gemini-4-carbon-low', ...PERSO, 'gemini-3.1-pro-high'];
await essai('compte personnel (sans Carbon) : Flash, Argon moyen, Argon haut', () => ['rapide', 'soigne', 'max'].map((q) => modeleGemini(q, PERSO)).join() === 'gemini-3.8-flash-medium,gemini-4-argon-medium,gemini-4-argon-high' || ['rapide', 'soigne', 'max'].map((q) => modeleGemini(q, PERSO)));
await essai('avec Carbon : Flash, Argon haut, Carbon haut', () => ['rapide', 'soigne', 'max'].map((q) => modeleGemini(q, CARBON)).join() === 'gemini-3.8-flash-medium,gemini-4-argon-high,gemini-4-carbon-high' || ['rapide', 'soigne', 'max'].map((q) => modeleGemini(q, CARBON)));
await essai('Flash seul : trois niveaux quand même', () => ['rapide', 'soigne', 'max'].map((q) => modeleGemini(q, PERSO.slice(3))).join() === 'gemini-3.8-flash-medium,gemini-3.8-flash-medium,gemini-3.8-flash-high' || ['rapide', 'soigne', 'max'].map((q) => modeleGemini(q, PERSO.slice(3))));
await essai('les modèles d’autres marques de la liste ne sont jamais choisis', () => modeleGemini('max', ['claude-opus-5-5-high', 'gpt-oss-120b-medium']) === null && reglageIA('gemini', 'max', 'claude-opus-5-5-high', null, PERSO).modele === 'gemini-4-argon-high');
await essai('aucune liste : pas de modèle imposé', () => modeleGemini('soigne', []) === null);

console.log('— Les arguments de la commande —');
const R = reglagesGemini({ecrits: [essais], lus: [], web: true});
const A = argsGemini({demande: 'Bonjour', session: 'abc', modele: 'gemini-3.8-flash-medium', reglages: R});
await essai('sans fenêtre, en direct, dans le bac à sable, avec les réglages de la session', () => A[0] === '-p' && A[1] === 'Bonjour' && A.includes('--sandbox') && A[A.indexOf('--output-format') + 1] === 'stream-json' && JSON.parse(A[A.indexOf('--settings') + 1]).toolPermission === 'proceed-in-sandbox' && A[A.indexOf('--model') + 1] === 'gemini-3.8-flash-medium' && A[A.indexOf('--conversation') + 1] === 'abc');
await essai('ni « --mode auto » (absent de certains comptes), ni rien qui saute les permissions', () => !A.includes('--mode') && !A.some((x) => /dangerously|skip-permissions/.test(x)));
await essai('jamais sans bac à sable : des réglages sans lui sont refusés', () => { for (const r of [undefined, {}, {...R, enableTerminalSandbox: false}, {...R, toolPermission: 'always-proceed'}]) { try { argsGemini({demande: 'x', reglages: r}); return `accepté : ${JSON.stringify(r)}`; } catch { /* refusé : bien */ } } return true; });
await essai('Node passe par le relais réseau du bac à sable', () => envGemini({}).NODE_USE_ENV_PROXY === '1' && /UNDICI-EHPA/.test(envGemini({NODE_OPTIONS: '--max-old-space-size=4096'}).NODE_OPTIONS) && /max-old-space-size/.test(envGemini({NODE_OPTIONS: '--max-old-space-size=4096'}).NODE_OPTIONS));

console.log('— La lecture des événements (lignes relevées sur la vraie commande) —');
const C = '00000000-0000-4000-8000-000000000001'; // un identifiant de conversation, au format de ceux d'agy
const LIGNES = [
  {event: 'init', conversation_id: C, init: {model: 'gemini-3.8-flash-medium', cwd: '/t', tools: ['run_command'], permission_mode: 'proceed-in-sandbox'}},
  {event: 'step_update', step_update: {conversation_id: C, step_index: 0, state: 'DONE', step_type: 'user_input'}},
  {event: 'step_update', step_update: {conversation_id: C, step_index: 2, state: 'ACTIVE', step_type: 'tool', tool_name: 'write_file', tool_info: {name: 'write_file', parameters: {Path: '/t/essai.txt'}}}},
  {event: 'step_update', step_update: {conversation_id: C, step_index: 2, state: 'DONE', step_type: 'tool', tool_name: 'write_file', tool_info: {name: 'write_file', parameters: {Path: '/t/essai.txt'}}}},
  {event: 'step_update', step_update: {conversation_id: C, step_index: 3, state: 'ACTIVE', step_type: 'tool', tool_name: 'run_command', tool_info: {name: 'run_command', parameters: {CommandLine: 'node remotion/rendre.mjs Annonce rendu/final.mp4'}}}},
  {event: 'step_update', step_update: {conversation_id: C, step_index: 3, state: 'DONE', step_type: 'tool', tool_name: 'run_command', duration_seconds: 2, tool_info: {name: 'run_command', parameters: {CommandLine: 'node remotion/rendre.mjs Annonce rendu/final.mp4'}, output: 'Command exited with code 0.'}}},
  {event: 'step_update', step_update: {conversation_id: C, step_index: 4, state: 'ACTIVE', step_type: 'tool', tool_name: 'command_status', tool_info: {name: 'command_status', parameters: {CommandId: 'x'}}}},
  {event: 'step_update', step_update: {conversation_id: C, step_index: 5, state: 'ACTIVE', step_type: 'agent_response', text_delta: 'bon'}},
  {event: 'step_update', step_update: {conversation_id: C, step_index: 5, state: 'ACTIVE', step_type: 'agent_response', text_delta: 'jour'}},
  {event: 'step_update', step_update: {conversation_id: C, step_index: 5, state: 'DONE', step_type: 'agent_response', text_delta: '\n', duration_seconds: 1}},
  {event: 'result', result: {conversation_id: C, status: 'SUCCESS', response: 'bonjour\n', duration_seconds: 2.66, num_turns: 1, usage: {total_tokens: 10}}},
];
const lire = lecteurGemini();
const lus = LIGNES.map((j) => lire(j));
await essai('la conversation est connue dès la première ligne (reprise possible même arrêtée en route)', () => lus[0].session === C);
await essai('écrire un fichier, lancer une commande : deux gestes, dits une seule fois chacun', () => { const g = lus.filter((x) => x.geste).map((x) => `${x.geste.outil}:${x.geste.entree.file_path ?? x.geste.entree.command}`); return g.join('|') === 'Write:/t/essai.txt|Bash:node remotion/rendre.mjs Annonce rendu/final.mp4' || g; });
await essai('le suivi d’une commande déjà annoncée ne fait pas un geste de plus', () => !lus[6].geste);
await essai('le texte arrive entier quand l’étape se termine', () => lus[9].texte === 'bonjour' && !lus[7].texte && !lus[8].texte);
await essai('la fin : la réponse, sans erreur', () => lus[10].fin.reponse === 'bonjour' && lus[10].fin.erreur === null && lus[10].fin.refus.length === 0);
const lire2 = lecteurGemini();
const refuse = [
  {event: 'step_update', step_update: {conversation_id: C, step_index: 2, state: 'ACTIVE', step_type: 'tool', tool_name: 'write_file', tool_info: {name: 'write_file', parameters: {Path: '/ailleurs/x.txt'}}}},
  {event: 'step_update', step_update: {conversation_id: C, step_index: 2, state: 'ERROR', step_type: 'tool', tool_name: 'write_file', duration_seconds: 0.03, tool_info: {name: 'write_file', parameters: {Path: '/ailleurs/x.txt'}, error: {type: 'TOOL_ERROR', message: 'permission check failed for write_file "/ailleurs/x.txt": user denied permission for write_file(/ailleurs/x.txt)'}}}},
  {event: 'result', result: {conversation_id: C, status: 'SUCCESS', response: '', duration_seconds: 5, num_turns: 1, denied_actions: [{action: 'write_file', display_name: 'WriteFile'}]}},
].map((j) => lire2(j));
await essai('une action refusée faute de permission est dite, avec des mots simples', () => refuse[1].refus === 'write_file' && refuse[2].fin.refus.join() === 'write_file' && refuse[2].fin.reponse === '' && /hors de son dossier/.test(refusGemini('write_file')) && /bac à sable/.test(refusGemini('run_command')));
await essai('une erreur de Gemini est rendue', () => lecteurGemini()({event: 'result', result: {conversation_id: C, status: 'ERROR', error: 'model overloaded', response: ''}}).fin.erreur === 'model overloaded');
await essai('le compte rendu : ce qui est dit après la dernière commande, pas les phrases d’étape', () => {
  const l = lecteurGemini();
  const dire = (k, t) => { l({event: 'step_update', step_update: {conversation_id: C, step_index: k, state: 'ACTIVE', step_type: 'agent_response', text_delta: t}}); return l({event: 'step_update', step_update: {conversation_id: C, step_index: k, state: 'DONE', step_type: 'agent_response', text_delta: '\n'}}); };
  const outil = (k) => l({event: 'step_update', step_update: {conversation_id: C, step_index: k, state: 'ACTIVE', step_type: 'tool', tool_name: 'command_status', tool_info: {name: 'command_status', parameters: {}}}});
  dire(1, 'Je commence.'); outil(2); dire(3, 'Au milieu.'); outil(4); dire(5, 'C’est fini.'); dire(6, 'Une idée pour la suite.');
  const fin = l({event: 'result', result: {conversation_id: C, status: 'SUCCESS', response: 'Je commence.\nAu milieu.\nC’est fini.\nUne idée pour la suite.\n'}}).fin;
  return fin.reponse === 'C’est fini.\n\nUne idée pour la suite.' || fin.reponse;
});
await essai('sans rien dit à la fin : la réponse d’agy telle quelle', () => { const l = lecteurGemini(); l({event: 'step_update', step_update: {conversation_id: C, step_index: 1, state: 'ACTIVE', step_type: 'tool', tool_name: 'run_command', tool_info: {name: 'run_command', parameters: {CommandLine: 'ls'}}}}); return l({event: 'result', result: {conversation_id: C, status: 'SUCCESS', response: 'Voilà.\n'}}).fin.reponse === 'Voilà.'; });
const g = (nom, p) => lecteurGemini()({event: 'step_update', step_update: {conversation_id: C, step_index: 1, state: 'ACTIVE', step_type: 'tool', tool_name: nom, tool_info: {name: nom, parameters: p}}}).geste;
await essai('les autres outils d’agy sont reconnus', () => g('view_file', {AbsolutePath: '/t/a.png'}).outil === 'Read' && g('replace_file_content', {TargetFile: '/t/a.tsx'}).outil === 'Edit' && g('search_web', {query: 'tendances'}).entree.query === 'tendances'
  && g('read_url_content', {Url: 'https://exemple.fr'}).outil === 'WebFetch' && g('execute_browser_javascript', {}).outil === 'WebFetch' && g('generate_image', {Prompt: 'x'}).entree.description === 'Crée une image' && g('wait_5_seconds', {}) === undefined);

console.log('— Ce que le bac à sable a le droit de lire —');
const maison = path.join(essais, 'maison');
const poser = (f, lien = null) => { fs.mkdirSync(path.dirname(f), {recursive: true}); if (lien) fs.symlinkSync(lien, f); else fs.writeFileSync(f, '#!/bin/sh\n'); return f; };
const node = poser(path.join(maison, '.hermes', 'node', 'bin', 'node'));
const lienNode = poser(path.join(maison, '.local', 'bin', 'node'), node);
const script = poser(path.join(maison, '.local', 'bin', 'mon-script-avec-une-cle'));
const ffmpeg = poser(path.join(maison, '.local', 'share', 'ffmpeg', '9.0.1', 'ffmpeg'));
const conda = poser(path.join(maison, 'miniconda3', 'bin', 'python'));
fs.mkdirSync(path.join(maison, 'miniconda3', 'lib'), {recursive: true});
const cargo = poser(path.join(maison, '.cargo', 'bin', 'outil'));
fs.writeFileSync(path.join(maison, '.cargo', 'credentials.toml'), 'secret');
const nu = poser(path.join(maison, 'programme'));
const blender = poser(path.join(essais, 'Applications', 'Blender.app', 'Contents', 'MacOS', 'Blender'));
const ailleurs = poser(path.join(essais, 'outils', 'truc', 'bin', 'truc'));
const M = reel(maison);
const r = (f) => racineOutil(f, maison);
await essai('un outil installé à part : son installation', () => r(node).join() === path.join(M, '.hermes', 'node') || r(node));
await essai('un lien dans ~/.local/bin : l’installation du vrai programme, pas ~/.local/bin', () => r(lienNode).join() === path.join(M, '.hermes', 'node') || r(lienNode));
await essai('un script posé dans ~/.local/bin : lui seul (les autres commandes de la personne restent fermées)', () => r(script).join() === reel(script) || r(script));
await essai('un programme sans dossier bin : son dossier', () => r(ffmpeg).join() === path.dirname(reel(ffmpeg)) || r(ffmpeg));
await essai('un dossier posé dans le dossier personnel (miniconda3) : seulement bin et lib', () => r(conda).join() === [path.join(M, 'miniconda3', 'bin'), path.join(M, 'miniconda3', 'lib')].join() || r(conda));
await essai('~/.cargo/bin : les programmes, pas le fichier de clés à côté', () => r(cargo).join() === path.join(M, '.cargo', 'bin') || r(cargo));
await essai('un programme posé directement dans le dossier personnel : lui seul', () => r(nu).join() === reel(nu) || r(nu));
await essai('un programme dans une application Mac : l’application', () => r(blender).join() === reel(path.join(essais, 'Applications', 'Blender.app')) || r(blender));
await essai('hors du dossier personnel : l’installation', () => r(ailleurs).join() === reel(path.join(essais, 'outils', 'truc')) || r(ailleurs));
await essai('le système est déjà lisible : rien à ajouter', () => racineOutil('/usr/bin/env').length === 0 && racineOutil('/bin/sh').length === 0);
await essai('un programme introuvable : rien', () => racineOutil(path.join(essais, 'absent')).length === 0 && racineOutil('').length === 0);
await essai('jamais le dossier personnel, ni un de ses parents', () => [node, lienNode, script, ffmpeg, conda, cargo, nu].flatMap(r).every((d) => d !== M && !M.startsWith(`${d}${path.sep}`)));
const vraie = os.homedir();
await essai('sur cet ordinateur : les outils de Dérush sont trouvés, sans ouvrir le dossier personnel', () => { const l = outilsLisibles().map((d) => { try { return reel(d); } catch { return d; } }); const m = reel(vraie); return (l.length >= 2 && l.every((d) => d !== m && !m.startsWith(`${d}${path.sep}`) && d !== path.join(m, '.local') && d !== path.join(m, '.local', 'bin'))) || l; });

console.log('— Les réglages de la session —');
const atelier = path.join(essais, 'atelier');
fs.mkdirSync(path.join(atelier, 'rendu'), {recursive: true});
const outilsDir = path.join(essais, 'outils');
const RG = reglagesGemini({ecrits: [atelier, path.join(atelier, 'rendu')], lus: [outilsDir, path.join(outilsDir, 'truc'), path.join(atelier, 'contexte'), node], interdits: [path.join(essais, 'cle.txt')]});
const regles = RG.permissions.allow;
await essai('commandes dans le bac à sable sans question, rien en dehors', () => RG.toolPermission === 'proceed-in-sandbox' && RG.enableTerminalSandbox === true);
await essai('écrire : le dossier de travail (sous son nom et son vrai chemin), sans doublon', () => regles.includes(`write_file(${atelier})`) && regles.includes(`write_file(${reel(atelier)})`) && !regles.some((x) => /rendu\)$/.test(x)));
await essai('lire : les outils, sans redire ce qui est déjà dans un dossier donné', () => regles.includes(`read_file(${reel(outilsDir)})`) && !regles.some((x) => x.endsWith('truc)')) && !regles.some((x) => x.startsWith('read_file(') && x.includes(`${path.sep}atelier${path.sep}`)) && regles.includes(`read_file(${reel(node)})`));
await essai('le web : ouvert quand il est donné, fermé sinon', () => regles.includes('read_url(*)') && !reglagesGemini({ecrits: [atelier], web: false}).permissions.allow.some((x) => /url/.test(x)));
await essai('jamais de navigateur piloté, de connecteur, ni de sortie du bac à sable', () => !regles.some((x) => /^(execute_url|mcp|unsandboxed|command)\(/.test(x)));
await essai('les fichiers de clés sont interdits, en lecture comme en écriture', () => { const d = RG.permissions.deny; return d.includes(`read_file(${path.join(process.env.DERUSH_SUPPORT, '.env.local')})`) && d.includes(`write_file(${path.join(process.env.DERUSH_SUPPORT, '.env.local')})`) && d.includes(`read_file(${path.join(essais, 'cle.txt')})`); });

console.log('— La boîte du relais (des fichiers, pour un bac à sable sans réseau local) —');
let relais = await ouvrirRelais(atelier, {boite: true, youtube: {permis: false}});
const boite = relais.boite;
const demander = (route, corps, jeton = relais.jeton) => demanderParBoite({boite, jeton, route, corps, attenteMs: 5000}).catch((e) => `erreur : ${e.message}`);
await essai('elle est dans le dossier de travail, et l’adresse locale reste là pour Codex', () => boite === dossierBoite(atelier) && fs.statSync(boite).isDirectory() && /^http:\/\/127\.0\.0\.1:\d+$/.test(relais.url));
await essai('un mauvais jeton est refusé', async () => (await demander('rendre', {args: []}, 'faux')) === '##DERUSH-RELAIS code=1##');
await essai('la commande retire sa réponse et son signe de vie : la boîte reste vide', () => fs.readdirSync(boite).length === 0 || fs.readdirSync(boite));
await essai('un rendu hors du dossier de travail est refusé', async () => { let dit = ''; const l = await demanderParBoite({boite, jeton: relais.jeton, route: 'rendre', corps: {args: ['Montage', path.join(essais, 'dehors.mp4')]}, surTexte: (t) => { dit += t; }, attenteMs: 5000}); return (l === '##DERUSH-RELAIS code=1##' && /Rendu refusé/.test(dit)) || {l, dit}; });
await essai('une route inconnue est refusée', async () => (await demander('effacer', {})) === '##DERUSH-RELAIS code=1##');
await essai('YouTube non demandé par l’humain : rien ne part', async () => /"raison":"non_demande"/.test(await demander('youtube', {fichier: path.join(atelier, 'x.mp4'), titre: 'x'})));
// l'IA pose d'avance un lien à la place de la réponse : Dérush ne doit pas écrire à travers
const cible = path.join(essais, 'fichier-de-la-personne.txt');
fs.writeFileSync(cible, 'intact');
const id = 'a'.repeat(24);
fs.symlinkSync(cible, path.join(boite, `reponse-${id}.txt`));
fs.writeFileSync(path.join(boite, `demande-${id}.json`), JSON.stringify({jeton: relais.jeton, route: 'rendre', corps: {args: ['Montage', path.join(essais, 'dehors.mp4')]}}));
await pause(900);
await essai('une réponse remplacée d’avance par un lien : rien n’est écrit à travers', () => fs.readFileSync(cible, 'utf8') === 'intact' && !fs.existsSync(path.join(boite, `demande-${id}.json`)));
// une demande qui est elle-même un lien vers un autre fichier : jamais lue comme une demande
const id2 = 'b'.repeat(24);
fs.symlinkSync(cible, path.join(boite, `demande-${id2}.json`));
await pause(700);
await essai('une demande qui est un lien est refusée', () => /Jeton refusé/.test(fs.readFileSync(path.join(boite, `reponse-${id2}.txt`), 'utf8')) && fs.readFileSync(cible, 'utf8') === 'intact');
await relais.fermer();
await essai('la boîte est retirée à la fin', () => !fs.existsSync(boite));
// l'IA remplace la boîte par un lien vers un autre dossier : Dérush ne s'en sert plus
relais = await ouvrirRelais(atelier, {boite: true});
const dehors = path.join(essais, 'dossier-de-la-personne');
fs.mkdirSync(dehors);
fs.rmSync(relais.boite, {recursive: true, force: true});
fs.symlinkSync(dehors, relais.boite);
fs.writeFileSync(path.join(dehors, `demande-${'c'.repeat(24)}.json`), JSON.stringify({jeton: relais.jeton, route: 'rendre', corps: {}}));
await pause(900);
await essai('une boîte remplacée par un lien vers ailleurs : rien n’y est lu ni écrit', () => fs.readdirSync(dehors).join() === `demande-${'c'.repeat(24)}.json`);
await relais.fermer();
await essai('et rien n’est effacé derrière ce lien', () => fs.existsSync(path.join(dehors, `demande-${'c'.repeat(24)}.json`)));

console.log(`\n${resultats.filter(Boolean).length} essais réussis sur ${resultats.length}`);
fs.rmSync(essais, {recursive: true, force: true});
process.exit(resultats.every(Boolean) ? 0 : 1);
