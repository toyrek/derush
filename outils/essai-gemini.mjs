// Dérush — les essais du moteur Gemini et de l'état des trois assistants (pour qui modifie Dérush) : aucun appel à
// Google, aucun compte, aucune vraie IA lancée.
//   node outils/essai-gemini.mjs [dossier où créer le dossier d'essai]
// L'essai crée son propre dossier (« derush-essai-gemini-… ») dans le dossier donné, ou dans le dossier temporaire du
// système, et n'efface que celui-là à la fin (il le garde si un essai échoue). Le dossier donné n'est jamais vidé.
// Ce qui est vérifié : le choix du modèle selon le compte, les arguments donnés à « agy » (jamais sans bac à sable), la
// lecture de ses événements (des lignes relevées sur la vraie commande, agy 1.5.6), ce que le bac à sable a le droit de
// lire et d'écrire (jamais le dossier personnel, le Bureau ni les Téléchargements), les clés et les connecteurs donnés à
// l'IA (Treg coupé, connecteurs du Codex de la personne), l'état des assistants (une vérification à la fois, avec de
// fausses commandes dans un faux dossier personnel), un Codex rangé sous Windows dans un dossier au nom avec une espace,
// et la boîte du relais (jamais à travers un lien posé par l'IA).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
if (/^-/.test(process.argv[2] ?? '')) { console.log(`Usage : node ${path.relative(process.cwd(), process.argv[1])} [dossier temporaire]`); process.exit(0); }
const parent = path.resolve(process.argv[2] ?? os.tmpdir());
fs.mkdirSync(parent, {recursive: true});
const dejaLa = fs.readdirSync(parent); // ce que le dossier donné contenait : rien de tout cela ne doit bouger
const essais = fs.mkdtempSync(path.join(parent, 'derush-essai-gemini-'));
// un dossier de réglages à part : rien n'est lu ni écrit dans celui de la personne
process.env.DERUSH_SUPPORT = path.join(essais, 'support');
fs.mkdirSync(process.env.DERUSH_SUPPORT, {recursive: true});
// le dossier de Codex aussi : son vrai config.toml n'est jamais lu ici
process.env.CODEX_HOME = path.join(essais, 'codex');
fs.mkdirSync(process.env.CODEX_HOME, {recursive: true});
const {modeleGemini, reglageIA, argsGemini, lecteurGemini, refusGemini, envIA, argsCodex, connecteursCodex, lireEvenementCodex, ligneTropLongue} = await import(`${D}/lib/ia.mjs`);
const {changerReglages} = await import(`${D}/lib/reglages.mjs`);
const {WINDOWS} = await import(`${D}/lib/plateforme.mjs`);
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
// une demande de n caractères sur un projet aux rushes rangés sur un autre disque (chacun est nommé dans les réglages)
const longue = (n, rushes) => ['-p', 'x'.repeat(n), '--output-format', 'stream-json', '--sandbox', '--settings', JSON.stringify(reglagesGemini({ecrits: [essais], lus: Array.from({length: rushes}, (_, i) => `/Volumes/Tournage du 12 novembre/prise-de-vue-numero-${i}-au-nom-assez-long.mov`)}))];
await essai('une ligne de commande trop longue pour Windows (un long brief, deux cents rushes) est reconnue, pas une courte', () => ligneTropLongue(longue(24000, 200), 'windows') === true && ligneTropLongue(longue(20000, 0), 'windows') === false && ligneTropLongue(A, 'windows') === false);
await essai('sous Linux : un seul argument de plus de 128 Ko ; sur Mac : rien à dire', () => ligneTropLongue(longue(200, 3000), 'linux') === true && ligneTropLongue(longue(24000, 200), 'linux') === false && ligneTropLongue(longue(24000, 3000), 'mac') === false);
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
await essai('un refus se lit sans faute après « n’a pas eu le droit de » : jamais « de écrire », « de ouvrir », « de utiliser »', () => { const l = ['write_file', 'read_file', 'view_file', 'run_command', 'unsandboxed', 'execute_url', 'browser', 'read_url', 'mcp', 'autre_chose', ''].map(refusGemini); return l.every((x) => x && !/^[aeiouyàâéèêëîïôûùh]/i.test(x)) || l; });
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
await essai('les outils relevés pendant un vrai travail (Gemini 4 Argon) sont reconnus', () => g('read_file', {Path: '/t/storyboard/page-01.jpg', StartLine: 1, EndLine: 120}).entree.file_path === '/t/storyboard/page-01.jpg' && g('read_file', {Path: '/t/a.md'}).outil === 'Read' && g('edit_file', {Path: '/t/remotion/src/Montage.tsx'}).outil === 'Edit' && g('write_file', {Path: '/t/rendu/timeline.json'}).outil === 'Write' && g('run_command', {CommandLine: 'python3 check.py rendu/final.mp4'}).entree.command === 'python3 check.py rendu/final.mp4');
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
const bureau = poser(path.join(maison, 'Desktop', 'ffmpeg'));
const telecharge = poser(path.join(maison, 'Downloads', 'ffmpeg'));
const documents = poser(path.join(maison, 'Documents', 'doc'));
fs.writeFileSync(path.join(maison, 'Downloads', 'releve-de-compte.pdf'), 'privé');
const blenderLinux = poser(path.join(maison, 'blender-4.5-linux-x64', 'blender'));
const ffmpegRange = poser(path.join(maison, 'ffmpeg', 'ffmpeg.exe'));
const sousDossier = poser(path.join(maison, 'Downloads', 'ffmpeg-9.0-static', 'ffmpeg'));
await essai('un programme posé tel quel sur le Bureau ou dans les Téléchargements : lui seul, jamais le dossier', () => { const l = [bureau, telecharge, documents].map((f) => r(f).join()); return l.join() === [bureau, telecharge, documents].map(reel).join() || l; });
await essai('une installation rangée dans le dossier personnel sous le nom du programme : son dossier', () => (r(blenderLinux).join() === path.join(M, 'blender-4.5-linux-x64') && r(ffmpegRange).join() === path.join(M, 'ffmpeg') && r(sousDossier).join() === path.join(M, 'Downloads', 'ffmpeg-9.0-static')) || [r(blenderLinux), r(ffmpegRange), r(sousDossier)]);
await essai('un programme dans une application Mac : l’application', () => r(blender).join() === reel(path.join(essais, 'Applications', 'Blender.app')) || r(blender));
await essai('hors du dossier personnel : l’installation', () => r(ailleurs).join() === reel(path.join(essais, 'outils', 'truc')) || r(ailleurs));
await essai('le système est déjà lisible : rien à ajouter', () => racineOutil('/usr/bin/env').length === 0 && racineOutil('/bin/sh').length === 0);
await essai('un programme introuvable : rien', () => racineOutil(path.join(essais, 'absent')).length === 0 && racineOutil('').length === 0);
await essai('jamais le dossier personnel, ni un de ses parents, ni le Bureau, les Téléchargements ou les Documents', () => [node, lienNode, script, ffmpeg, conda, cargo, nu, bureau, telecharge, documents, blenderLinux, sousDossier].flatMap(r).every((d) => d !== M && !M.startsWith(`${d}${path.sep}`) && !['Desktop', 'Downloads', 'Documents'].some((x) => d === path.join(M, x))));
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

console.log('— Ce que Dérush confie à l’IA : les clés, les connecteurs —');
// une fausse clé Treg, le temps de deux essais (rien n'est envoyé à Treg)
Object.assign(process.env, {TREG_TOKEN: 'trg_essai_factice', ELEVENLABS_API_KEY: 'cle-factice', UN_AUTRE_SECRET: 'x'});
changerReglages({treg_ia: false});
const envCoupe = envIA();
changerReglages({treg_ia: true});
const envDonne = envIA();
for (const k of ['TREG_TOKEN', 'ELEVENLABS_API_KEY', 'UN_AUTRE_SECRET']) delete process.env[k];
await essai('Treg coupé pour l’IA dans Connexions : sa clé ne part pas dans l’environnement de l’IA', () => (!('TREG_TOKEN' in envCoupe) && envCoupe.ELEVENLABS_API_KEY === 'cle-factice') || Object.keys(envCoupe).filter((k) => /TREG|ELEVEN/.test(k)));
await essai('Treg laissé à l’IA : sa clé part ; les autres secrets de l’ordinateur, jamais', () => envDonne.TREG_TOKEN === 'trg_essai_factice' && !('UN_AUTRE_SECRET' in envDonne) && !('UN_AUTRE_SECRET' in envCoupe));
// les connecteurs que la personne a branchés dans son propre Codex (un faux config.toml)
fs.writeFileSync(path.join(process.env.CODEX_HOME, 'config.toml'), ['model = "gpt-5"', '', '[mcp_servers.gmail]', 'command = "npx"', 'args = ["-y", "serveur"]', '', '[mcp_servers.gmail.env]', 'CLE = "x"', '',
  '[mcp_servers."notion"]', 'url = "https://exemple.invalid/mcp"', '', '# [mcp_servers.commente]', '', '[mcp_servers]', 'drive = { command = "x" }', 'figma.url = "https://exemple.invalid"', '', '[autre]', 'nom = "x"', 'mcp_servers = "non"', ''].join('\n'));
const REGLAGE = reglageIA('codex', 'soigne');
const TREG = ['-c', 'mcp_servers.treg.url="https://exemple.invalid/mcp/"', '-c', 'mcp_servers.treg.bearer_token_env_var="TREG_TOKEN"'];
const coupes = (args) => args.filter((x) => /^mcp_servers\.[\w-]+\.enabled=false$/.test(x)).map((x) => x.split('.')[1]).sort().join();
await essai('les connecteurs du Codex de la personne sont trouvés par leur nom (pas les lignes en commentaire, ni les autres tables)', () => connecteursCodex().sort().join() === 'drive,figma,gmail,notion' || connecteursCodex());
await essai('ils sont éteints pour la demande, montage neuf ou conversation reprise ; Treg, donné par Dérush, reste', () => { const neuf = argsCodex({reglage: REGLAGE, mcp: TREG}); const repris = argsCodex({session: 'abc', reglage: REGLAGE, mcp: TREG}); return (coupes(neuf) === 'drive,figma,gmail,notion' && coupes(repris) === 'drive,figma,gmail,notion' && TREG.every((x) => neuf.includes(x)) && neuf.at(-1) === '-' && repris.at(-1) === '-') || [coupes(neuf), coupes(repris)]; });
await essai('un « treg » branché par la personne est éteint aussi quand Treg est coupé ; un nom douteux n’arrive jamais sur la ligne', () => coupes(argsCodex({reglage: REGLAGE, aCouper: ['treg', 'gmail', 'a b', 'x.y', 'z"']})) === 'gmail,treg' && coupes(argsCodex({reglage: REGLAGE, mcp: TREG, aCouper: ['treg', 'gmail']})) === 'gmail');
await essai('sans connecteur dans son Codex (ou sans fichier) : rien n’est ajouté', () => connecteursCodex(path.join(essais, 'absent.toml')).length === 0 && !argsCodex({reglage: REGLAGE, mcp: TREG, aCouper: []}).some((x) => /enabled/.test(x)));
await essai('un connecteur dont Codex se sert est nommé dès le début de l’appel (pour pouvoir l’arrêter)', () => { const debut = lireEvenementCodex({type: 'item.started', item: {type: 'mcp_tool_call', server: 'gmail', tool: 'send'}}); const fin = lireEvenementCodex({type: 'item.completed', item: {type: 'mcp_tool_call', server: 'gmail', tool: 'send', arguments: {}}}); return (debut.connecteur === 'gmail' && !debut.geste && fin.connecteur === 'gmail' && fin.geste.outil === 'mcp__gmail__send' && !('connecteur' in lireEvenementCodex({type: 'item.started', item: {type: 'command_execution', command: 'ls'}}))) || [debut, fin]; });

// Les deux parties qui suivent tournent dans un Node à part, avec un faux dossier personnel et de fausses commandes
// (claude, codex, agy) : rien de vrai n'est lancé, et rien n'est lu dans le dossier de la personne.
const foyer = path.join(essais, 'foyer');
fs.mkdirSync(foyer, {recursive: true});
const aPart = (nom, code, env) => {
  const f = path.join(essais, `${nom}.mjs`);
  fs.writeFileSync(f, code);
  const p = spawnSync(process.execPath, [f], {encoding: 'utf8', timeout: 120000, env: {PATH: '/usr/bin:/bin', HOME: foyer, USERPROFILE: foyer, TMPDIR: os.tmpdir(), DERUSH_SANS_NAVIGATEUR: '1', DERUSH_SANS_MAJ: '1', CODEX_HOME: process.env.CODEX_HOME, ...env}});
  try { return JSON.parse(String(p.stdout).trim().split('\n').at(-1)); } catch { return {erreur: (String(p.stderr) || String(p.stdout) || String(p.error?.message ?? 'rien')).slice(-600)}; }
};
const chemins = `const LIB = ${JSON.stringify(path.join(D, 'lib'))};\nconst pause = (ms) => new Promise((ok) => setTimeout(ok, ms));\n`;

console.log('— L’état des assistants : une vérification à la fois (fausses commandes) —');
if (WINDOWS) console.log('  (partie sautée sous Windows : les fausses commandes sont des scripts sh)');
else {
  const journal = path.join(essais, 'lancements.txt');
  // chaque fausse commande note son lancement, et une ligne « cle … » de plus si elle a reçu une clé confiée par Dérush
  const fausse = (nom, version, compte) => { const f = path.join(essais, 'fausses', nom); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, `#!/bin/sh\necho "${nom} $*" >> "$DERUSH_ESSAI_JOURNAL"\nif [ -n "$TREG_TOKEN$ELEVENLABS_API_KEY" ]; then echo "cle ${nom} $*" >> "$DERUSH_ESSAI_JOURNAL"; fi\nsleep 0.2\ncase "$1" in\n  --version) echo '${version}' ;;\n  *) echo '${compte}' ;;\nesac\n`, {mode: 0o755}); return f; };
  const e = aPart('etats', `${chemins}import fs from 'node:fs';
const {etatIA, etatIAConnu = () => null, etatCodex, etatGemini, oublierEtats} = await import(LIB + '/ia.mjs');
const {changerReglages} = await import(LIB + '/reglages.mjs');
const compte = () => { const l = fs.existsSync(process.env.DERUSH_ESSAI_JOURNAL) ? fs.readFileSync(process.env.DERUSH_ESSAI_JOURNAL, 'utf8').split('\\n') : []; return ['claude --version', 'claude auth status', 'codex --version', 'codex login status', '--version', 'models'].map((x) => l.filter((y) => y === x).length).join(' '); };
const o = {};
const [a, b] = await Promise.all([etatIA(), etatIA(), etatIA()]);
o.ensemble = compte();
o.prets = [a.claude.ok, a.codex.ok, a.gemini.ok, a.choisi, a.gemini.modeles?.includes('gemini-4-argon-high'), a.claude === b.claude].join(' ');
await etatIA(true); o.aussitot = compte();
await pause(2200);
await etatGemini(true); o.parNom = compte();
await Promise.all([etatIA(true), etatIA(true)]); o.tout = compte();
await pause(2200);
await etatIA('codex'); o.codexSeul = compte();
changerReglages({ia_moteur: 'gemini'});
await etatIA(true); o.geminiChoisi = compte();
changerReglages({ia_moteur: 'claude'});
oublierEtats('codex');
const p = etatCodex(); await pause(60); oublierEtats('codex'); await p; o.oubliAvant = compte();
await etatCodex(); o.oubliApres = compte();
const c = etatIAConnu(); o.connu = [c?.claude?.ok, c?.codex?.ok, c?.gemini?.ok, c?.choisi].join(' ');
o.cles = fs.readFileSync(process.env.DERUSH_ESSAI_JOURNAL, 'utf8').split('\\n').filter((x) => x.startsWith('cle '));
console.log(JSON.stringify(o));
process.exit(0);
`, {DERUSH_SUPPORT: path.join(essais, 'support-etats'), DERUSH_BIBLIOTHEQUE: path.join(essais, 'bibliotheque-etats'), DERUSH_ESSAI_JOURNAL: journal, AGY_FAUX_JOURNAL: journal, AGY_FAUX_LENTEUR: '200', AGY_FAUX_MODELES: 'perso',
    TREG_TOKEN: 'trg_essai_factice', ELEVENLABS_API_KEY: 'cle-factice', // de fausses clés, Treg laissé à l'IA : aucune vérification ne doit les recevoir
    DERUSH_CLAUDE: fausse('claude', '9.9.9 (Claude Code)', '{"loggedIn": true}'), DERUSH_CODEX: fausse('codex', 'codex-cli 9.9.9', 'Logged in using ChatGPT'), DERUSH_AGY: path.join(D, 'outils', 'faux-agy.mjs')});
  // dans l'ordre : claude --version, claude auth status, codex --version, codex login status, agy --version, agy models
  await essai('les trois assistants sont trouvés et connectés (fausses commandes)', () => e.prets === 'true true true claude true true' || e);
  await essai('trois demandes en même temps (l’ouverture d’un projet) : chaque programme est lancé une seule fois', () => e.ensemble === '1 1 1 1 1 1' || e.ensemble || e);
  await essai('« revérifier » tout de suite après : la vérification qui vient de finir sert encore', () => e.aussitot === '1 1 1 1 1 1' || e.aussitot);
  await essai('Gemini demandé par son nom : agy est relancé', () => e.parNom === '1 1 1 1 2 2' || e.parNom);
  await essai('« tout revérifier » deux fois en même temps : Claude et Codex une fois ; agy épargné (Gemini ni choisi ni attendu)', () => e.tout === '2 2 2 2 2 2' || e.tout);
  await essai('ne revérifier que Codex : Claude et agy ne sont pas relancés', () => e.codexSeul === '2 2 3 3 2 2' || e.codexSeul);
  await essai('Gemini choisi : « tout revérifier » relance agy', () => e.geminiChoisi === '3 3 3 3 3 3' || e.geminiChoisi);
  await essai('un état oublié pendant une vérification : son résultat n’est pas gardé, la demande suivante revérifie', () => (e.oubliAvant === '3 3 4 4 3 3' && e.oubliApres === '3 3 5 5 3 3') || [e.oubliAvant, e.oubliApres]);
  await essai('le dernier état connu se lit sans rien attendre ni relancer', () => e.connu === 'true true true claude' || e.connu);
  await essai('vérifier la version ou le compte ne donne aucune clé (agy n’a jamais la clé Treg, même pour « agy models »)', () => (Array.isArray(e.cles) && e.cles.length === 0) || e.cles || e);
}

console.log('— Sous Windows (simulé) : Codex rangé dans un dossier au nom avec une espace —');
if (WINDOWS) console.log('  (partie sautée sous Windows : elle le simule sur Mac et Linux)');
else {
  // le lanceur « codex.cmd » que npm écrit, et le script qu'il désigne, sous « Jean Dupont »
  const outilsJean = path.join(essais, 'Jean Dupont', 'outils', 'node_modules');
  const cmdCodex = path.join(outilsJean, '.bin', 'codex.cmd');
  const marque = path.join(essais, 'connexion-codex.txt');
  fs.mkdirSync(path.dirname(cmdCodex), {recursive: true});
  fs.mkdirSync(path.join(outilsJean, '@openai', 'codex', 'bin'), {recursive: true});
  fs.writeFileSync(cmdCodex, ['@ECHO off', 'GOTO start', ':find_dp0', 'SET dp0=%~dp0', 'EXIT /b', ':start', 'SETLOCAL', 'CALL :find_dp0', '', 'IF EXIST "%dp0%\\node.exe" (', '  SET "_prog=%dp0%\\node.exe"', ') ELSE (', '  SET "_prog=node"', '  SET PATHEXT=%PATHEXT:;.JS;=;%', ')', '',
    'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\../@openai/codex/bin/codex.js" %*', ''].join('\r\n'));
  fs.writeFileSync(path.join(outilsJean, '@openai', 'codex', 'bin', 'codex.js'), `(async () => {\n  const fs = await import('node:fs');\n  const a = process.argv.slice(2);\n  if (a[0] === '--version') console.log('codex-cli 9.9.9');\n  else if (a[0] === 'login' && a[1] === 'status') console.log('Logged in using ChatGPT');\n  else if (a[0] === 'login') fs.writeFileSync(process.env.DERUSH_ESSAI_MARQUE, 'login');\n})();\n`);
  const w = aPart('windows', `Object.defineProperty(process, 'platform', {value: 'win32'});
${chemins}import fs from 'node:fs';
const {etatCodex, connecterCodex, commandeLancement, argsGemini} = await import(LIB + '/ia.mjs');
const {reglagesGemini} = await import(LIB + '/gemini.mjs');
const cmd = process.env.DERUSH_CODEX;
const dossier = process.env.DERUSH_SUPPORT;
const o = {};
const l = commandeLancement(cmd);
o.lancement = l.cmd === process.execPath && /codex\\.js$/.test(l.prefixe[0] ?? '') && !l.shell;
const e = await etatCodex(true);
o.etat = [e.ok, e.version, e.pourquoi ?? ''].join(' ').trim();
connecterCodex(cmd);
for (let i = 0; i < 50 && !fs.existsSync(process.env.DERUSH_ESSAI_MARQUE); i++) await pause(100);
o.connexion = fs.existsSync(process.env.DERUSH_ESSAI_MARQUE);
try { argsGemini({demande: 'x'.repeat(24000), reglages: reglagesGemini({ecrits: [dossier], lus: Array.from({length: 200}, (_, i) => '/Volumes/Tournage du 12 novembre/prise-de-vue-numero-' + i + '-au-nom-assez-long.mov')})}); o.longue = 'acceptée'; } catch (err) { o.longue = err.message; }
o.courte = argsGemini({demande: 'Bonjour', reglages: reglagesGemini({ecrits: [dossier]})}).length;
console.log(JSON.stringify(o));
process.exit(0);
`, {DERUSH_SUPPORT: path.join(essais, 'support-windows'), DERUSH_BIBLIOTHEQUE: path.join(essais, 'bibliotheque-windows'), APPDATA: path.join(foyer, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(foyer, 'AppData', 'Local'), DERUSH_CODEX: cmdCodex, DERUSH_ESSAI_MARQUE: marque});
  await essai('le « codex.cmd » de npm est lancé par Node sur son script, sans l’interpréteur de commandes', () => w.lancement === true || w);
  await essai('Codex installé sous « Jean Dupont » est vu installé et connecté', () => w.etat === 'true 9.9.9' || w.etat || w);
  await essai('« Me connecter » lance bien sa commande de connexion', () => w.connexion === true || w);
  await essai('une demande trop longue pour la ligne de commande de Windows est refusée en français, avec quoi faire ; une courte passe', () => (/trop longue/.test(w.longue) && /Raccourcis/.test(w.longue) && !/ENAMETOOLONG|spawn/.test(w.longue) && w.courte >= 7) || w);
}

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

// la fin : seul le dossier que cet essai a créé est effacé (gardé si un essai a échoué, pour regarder)
const tousBons = resultats.every(Boolean);
if (tousBons) fs.rmSync(essais, {recursive: true, force: true});
await essai('le dossier donné n’a rien perdu : seul le dossier d’essai créé dedans est effacé', () => path.dirname(essais) === parent && essais !== parent && dejaLa.every((n) => fs.existsSync(path.join(parent, n))) && (!tousBons || !fs.existsSync(essais)));
console.log(`\n${resultats.filter(Boolean).length} essais réussis sur ${resultats.length}`);
if (!tousBons) console.log(`Dossier d’essai gardé : ${essais}`);
process.exit(resultats.every(Boolean) ? 0 : 1);
