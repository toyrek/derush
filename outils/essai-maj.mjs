// Dérush — les essais des mises à jour (pour qui modifie Dérush) : Dérush voit-il qu'une version est sortie, le dit-il
// une fois à l'IA, se tait-il après « Plus tard », s'installe-t-il, dit-il ce qui vient d'arriver ? Relancé, ouvre-t-il
// sa fenêtre avec sa clé, et refuse-t-il de démarrer en double ?
//   node outils/essai-maj.mjs
// Rien ne touche GitHub ni la vraie installation : l'essai fabrique, dans un dossier temporaire, un faux dépôt
// (« origine »), une copie installée (« poste ») et un auteur qui publie une version 99.0.
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {execFile, spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-essai-maj-'));
const SUPPORT = path.join(T, 'support');
process.env.DERUSH_SUPPORT = SUPPORT;
const {trouverGit} = await import(`${D}/lib/plateforme.mjs`);
const {comparerVersions, lireNouveautes} = await import(`${D}/lib/maj.mjs`);
const {VERSION} = await import(`${D}/lib/commun.mjs`);
const GIT = process.env.DERUSH_GIT || trouverGit();
if (!GIT) { console.error('Git est introuvable : ces essais en ont besoin.'); process.exit(1); }

const lancer = (cmd, args, opts = {}) => new Promise((ok, ko) => execFile(cmd, args, {encoding: 'utf8', maxBuffer: 1 << 26, ...opts}, (e, out, err) => (e ? ko(new Error(`${path.basename(cmd)} ${args.slice(0, 4).join(' ')} : ${String(err || e.message).slice(-400)}`)) : ok(out))));
const git = (dossier, ...args) => lancer(GIT, ['-C', dossier, '-c', 'user.name=Essai', '-c', 'user.email=essai@derush.invalid', '-c', 'commit.gpgsign=false', ...args], {env: {...process.env, GIT_TERMINAL_PROMPT: '0'}});
/** Exécute un bout de code dans une copie de Dérush (son propre lib/maj.mjs), dans un processus à part. */
async function dans(dossier, code, env = {}) {
  const script = `const m = await import(${JSON.stringify(pathToFileURL(path.join(dossier, 'lib', 'maj.mjs')).href)});\nconst r = await (async () => { ${code} })();\nconsole.log('\\u0001' + JSON.stringify(r ?? null));`;
  const out = await lancer(process.execPath, ['--input-type=module', '-e', script], {cwd: dossier, env: {...process.env, DERUSH_SUPPORT: SUPPORT, DERUSH_SANS_MAJ: '1', ...env}});
  const ligne = out.split('\n').find((l) => l.startsWith('\u0001'));
  if (!ligne) throw new Error(`aucune réponse : ${out.slice(-300)}`);
  return JSON.parse(ligne.slice(1));
}
const etatRange = () => { try { return JSON.parse(fs.readFileSync(path.join(SUPPORT, 'maj.json'), 'utf8')); } catch { return {}; } };

let bons = 0;
let total = 0;
function essai(quoi, vrai, detail = '') {
  total++;
  if (vrai) bons++;
  console.log(`${vrai ? '✓' : '✗'} ${quoi}${vrai || !detail ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300)}`}`);
}

try {
  // ——— sans rien installer : les numéros de version et la lecture des nouveautés
  essai('10.10 est plus récent que 10.9', comparerVersions('10.10', '10.9') > 0);
  essai('10.4 et 10.4.0 sont la même version', comparerVersions('10.4', '10.4.0') === 0);
  essai('9.4 est plus ancien que 10', comparerVersions('9.4', '10') < 0);
  const exemple = '# Titre\n\n**10.5 — Des titres plus nets.** Les titres se lisent mieux sur un téléphone. La suite ne compte pas.\n\n**10.4 — Dérush te prévient.** Une phrase.\n\n**Nouveau dans la version 10.**\n- **Le mode Voix off.** Tu racontes.\n- **Enregistrer.** Sans quitter Dérush.\n\n**9.4 — Avant.** Vieux.\n';
  const lu = lireNouveautes(exemple, '10.3');
  essai('les nouveautés plus récentes que la version installée sont lues, la plus récente d’abord', lu.length === 2 && lu[0].version === '10.5' && lu[1].version === '10.4', lu);
  essai('le titre et la première phrase sont gardés, sans les signes de mise en forme', lu[0]?.titre === 'Des titres plus nets' && lu[0]?.resume === 'Les titres se lisent mieux sur un téléphone.', lu[0]);
  essai('une version « Nouveau dans la version 10 » est lue par ses puces', lireNouveautes(exemple, '9.4', '10.0')[0]?.resume === 'Le mode Voix off. Enregistrer.', lireNouveautes(exemple, '9.4', '10.0'));
  essai('rien de plus récent : rien à dire', lireNouveautes(exemple, '10.5').length === 0);

  // ——— un faux dépôt : l'auteur, l'origine, le poste installé
  const sauter = /(^|[\\/])(\.git|\.github|node_modules|__pycache__)([\\/]|$)/;
  const auteur = path.join(T, 'auteur');
  fs.cpSync(D, auteur, {recursive: true, filter: (src) => !sauter.test(path.relative(D, src))});
  await git(auteur, 'init', '-q', '-b', 'main');
  await git(auteur, 'add', '-A');
  await git(auteur, 'commit', '-q', '-m', 'La version installée');
  const origine = path.join(T, 'origine.git');
  await lancer(GIT, ['clone', '-q', '--bare', auteur, origine]);
  await git(auteur, 'remote', 'add', 'origin', origine);
  const poste = path.join(T, 'poste');
  await lancer(GIT, ['clone', '-q', origine, poste]);

  let r = await dans(poste, 'm.programmerMaj(); await m.verifierMaj(); return {e: m.etatMaj(), r: m.resumeMaj()};');
  essai('à jour : rien à annoncer', r.e.possible === true && r.e.en_retard === 0 && r.r.disponible === false && r.r.a_montrer === false && r.r.arrivee === null, r);
  essai('la version ouverte est retenue', etatRange().lancee === VERSION, etatRange());

  // l'auteur publie une version 99.0
  const commun = path.join(auteur, 'lib', 'commun.mjs');
  fs.writeFileSync(commun, fs.readFileSync(commun, 'utf8').replace(/VERSION = '[^']+'/, "VERSION = '99.0'"));
  const notes = path.join(auteur, 'docs', 'NOUVEAUTES.md');
  fs.writeFileSync(notes, fs.readFileSync(notes, 'utf8').replace(/\n\n/, '\n\n**99.0 — Une version d’essai.** Elle sert à vérifier que Dérush prévient. Rien d’autre.\n\n'));
  await git(auteur, 'commit', '-q', '-am', 'Dérush 99.0 : une version d’essai');
  await git(auteur, 'push', '-q', 'origin', 'main');

  r = await dans(poste, 'await m.verifierMaj({auto: true}); return {e: m.etatMaj(), r: m.resumeMaj()};');
  essai('une version est sortie : Dérush la voit tout seul', r.e.en_retard === 1 && r.e.version_distante === '99.0' && r.r.disponible && r.r.a_montrer && r.r.peut_installer, r);
  essai('il sait ce qu’elle apporte', r.r.nouveautes?.[0]?.version === '99.0' && r.r.nouveautes[0].titre === 'Une version d’essai' && /prévient\.$/.test(r.r.nouveautes[0].resume), r.r.nouveautes);

  // l'IA le dit une fois par version
  r = await dans(poste, 'await m.verifierMaj(); return [m.rappelMaj(), m.rappelMaj()];');
  essai('l’IA reçoit la nouvelle, avec la façon de l’installer', /la 99\.0 \(Une version d’essai\)/.test(r[0]) && /« Mettre à jour »/.test(r[0]) && /Ne l’installe pas toi-même/.test(r[0]), r[0]);
  essai('elle ne la reçoit qu’une fois pour cette version', r[1] === '' && etatRange().ia?.version === '99.0', r[1]);
  r = await dans(poste, 'await m.verifierMaj(); return m.rappelMaj();');
  essai('même après un nouveau lancement de Dérush', r === '', r);

  // « Plus tard »
  r = await dans(poste, 'await m.verifierMaj(); m.plusTard(); return m.resumeMaj();');
  essai('« Plus tard » : la fenêtre ne revient pas tout de suite', r.disponible && r.a_montrer === false, r);
  r = await dans(poste, 'await m.verifierMaj(); return m.resumeMaj();');
  essai('ni au lancement suivant', r.disponible && r.a_montrer === false, r);
  fs.writeFileSync(path.join(SUPPORT, 'maj.json'), JSON.stringify({...etatRange(), plus_tard: {version: '99.0', jusqu_a: new Date(Date.now() - 1000).toISOString()}}));
  r = await dans(poste, 'await m.verifierMaj(); return m.resumeMaj();');
  essai('le lendemain, elle revient', r.a_montrer === true, r);

  // « Me prévenir » éteint
  fs.writeFileSync(path.join(SUPPORT, 'reglages.json'), JSON.stringify({maj_prevenir: false}));
  fs.writeFileSync(path.join(SUPPORT, 'maj.json'), JSON.stringify({...etatRange(), ia: null}));
  r = await dans(poste, 'await m.verifierMaj(); return {r: m.resumeMaj(), ia: m.rappelMaj(), e: m.etatMaj()};');
  essai('« Me prévenir » éteint : ni fenêtre ni phrase de l’IA, mais Connexions le sait', r.r.disponible && r.r.a_montrer === false && r.ia === '' && r.e.prevenir === false && r.e.en_retard === 1, r);
  fs.rmSync(path.join(SUPPORT, 'reglages.json'));

  // l'installation
  fs.appendFileSync(path.join(poste, 'README.md'), '\nune ligne ajoutée à la main\n');
  r = await dans(poste, 'try { await m.mettreAJour(); return "installée"; } catch (e) { return e.message; }');
  essai('un fichier modifié à la main n’est jamais écrasé', /modifiés à la main/.test(r), r);
  await git(poste, 'checkout', '--', 'README.md');
  r = await dans(poste, 'return m.mettreAJour();');
  essai('la mise à jour s’installe', r.ok && r.change === true && r.version === '99.0', r);
  r = await dans(poste, 'm.programmerMaj(); await m.verifierMaj(); return {e: m.etatMaj(), r: m.resumeMaj()};');
  essai('après l’installation : à jour, plus rien à annoncer', r.e.version === '99.0' && r.e.en_retard === 0 && !r.r.disponible, r);
  essai('à la première ouverture, Dérush dit ce qui vient d’arriver', r.r.arrivee?.version === '99.0' && r.r.arrivee.depuis === VERSION && r.r.arrivee.nouveautes?.[0]?.titre === 'Une version d’essai', r.r.arrivee);
  r = await dans(poste, 'm.marquerVue(); return m.resumeMaj();');
  essai('une fois vu, il ne le redit plus', r.arrivee === null && etatRange().lancee === '99.0', r);

  // un changement sans nouvelle version (la page du dépôt, une faute corrigée) ne dérange personne
  fs.appendFileSync(path.join(auteur, 'README.md'), '\nUne ligne de plus.\n');
  await git(auteur, 'commit', '-q', '-am', 'Page d’accueil : une ligne de plus');
  await git(auteur, 'push', '-q', 'origin', 'main');
  r = await dans(poste, 'await m.verifierMaj(); return {e: m.etatMaj(), r: m.resumeMaj()};');
  essai('un changement sans nouveau numéro : Connexions le propose, la fenêtre se tait', r.e.en_retard === 1 && r.r.disponible === false && r.r.a_montrer === false, r);

  // pas d'internet, ou un dépôt qu'on ne joint plus
  await git(poste, 'remote', 'set-url', 'origin', path.join(T, 'nulle-part.git'));
  r = await dans(poste, 'return {auto: await m.verifierMaj({auto: true}), main: await m.verifierMaj()};');
  essai('GitHub injoignable : la vérification automatique ne dit rien', r.auto.possible === undefined && r.auto.message === undefined, r.auto);
  essai('la vérification demandée explique', r.main.possible === false && /Impossible de joindre GitHub/.test(r.main.message), r.main);

  // une copie qui ne vient pas de GitHub (zip, image disque) : prévenue par internet, sans pouvoir s'installer seule
  const copie = path.join(T, 'copie');
  fs.cpSync(D, copie, {recursive: true, filter: (src) => !sauter.test(path.relative(D, src))});
  const serveur = http.createServer((req, res) => {
    const f = path.join(auteur, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(auteur) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type': 'text/plain; charset=utf-8'});
    res.end(fs.readFileSync(f));
  });
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  const source = `http://127.0.0.1:${serveur.address().port}`;
  fs.rmSync(path.join(SUPPORT, 'maj.json'));
  r = await dans(copie, 'await m.verifierMaj({auto: true}); return {e: m.etatMaj(), r: m.resumeMaj(), ia: m.rappelMaj()};', {DERUSH_MAJ_SOURCE: source});
  essai('une copie donnée telle quelle apprend qu’une version est sortie', r.e.clone === false && r.e.possible === false && r.e.version_distante === '99.0' && r.r.disponible && r.r.a_montrer, r);
  essai('elle ne propose pas de s’installer seule, et l’IA dit comment faire', r.r.peut_installer === false && /message d’installation/.test(r.e.message) && /recollant le message d’installation/.test(r.ia), r);
  r = await dans(copie, 'try { await m.mettreAJour(); return "installée"; } catch (e) { return e.message; }', {DERUSH_MAJ_SOURCE: source});
  essai('et « Mettre à jour » le refuse proprement', /ne peut pas se mettre à jour toute seule/.test(r), r);
  r = await dans(copie, 'await m.verifierMaj({auto: true}); return {e: m.etatMaj(), r: m.resumeMaj()};', {DERUSH_MAJ_SOURCE: 'http://127.0.0.1:9'});
  essai('sans internet, elle ne dit rien', r.r.disponible === false && r.r.a_montrer === false, r);
  serveur.close();

  // ——— le lancement qui suit une mise à jour : la clé de la fenêtre, une seule instance
  const libre = await new Promise((ok) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
  const envLancement = {...process.env, DERUSH_SUPPORT: SUPPORT, DERUSH_BIBLIOTHEQUE: path.join(T, 'bibliotheque'), DERUSH_SANS_NAVIGATEUR: '1', DERUSH_SANS_MAJ: '1'};
  delete envLancement.TREG_TOKEN;
  const lancerDerush = () => spawn(process.execPath, [path.join(D, 'derush.mjs'), '--port', String(libre)], {cwd: T, env: envLancement, stdio: ['ignore', 'pipe', 'pipe']});
  const fini = (p) => new Promise((ok) => { if (p.exitCode !== null) ok(p.exitCode); else p.on('exit', (code) => ok(code)); });
  const premier = lancerDerush();
  try {
    let sortie = '';
    premier.stdout.on('data', (b) => { sortie += b; });
    premier.stderr.on('data', (b) => { sortie += b; });
    for (let k = 0; k < 150 && !/Adresse de la fenêtre/.test(sortie) && premier.exitCode === null; k++) await new Promise((ok) => setTimeout(ok, 200));
    const adresse = /Adresse de la fenêtre : (\S+)/.exec(sortie)?.[1] ?? '';
    let cle = '';
    try { cle = fs.readFileSync(path.join(SUPPORT, 'cle-fenetre'), 'utf8').trim(); } catch { /* pas de clé : l'essai le dit */ }
    essai('lancé sans fenêtre, Dérush donne l’adresse de sa fenêtre, avec la clé rangée dans son dossier', /^[a-f0-9]{48}$/.test(cle) && adresse === `http://127.0.0.1:${libre}/?c=${cle}`, sortie.slice(-400));
    essai('la ligne qui peut aller au journal (« … sur http://… ») ne porte pas la clé', /sur http:\/\/127\.0\.0\.1:\d+\/ /.test(sortie) && !/sur \S+\?c=/.test(sortie), sortie.slice(-400));
    const sans = await fetch(`http://127.0.0.1:${libre}/`);
    const corpsSans = await sans.text();
    const avec = adresse ? await fetch(adresse) : null;
    const corpsAvec = avec ? await avec.text() : '';
    essai('sans la clé, la page d’accueil ne donne pas le jeton ; avec, si', sans.status === 403 && !/derush-jeton/.test(corpsSans) && avec?.status === 200 && /name="derush-jeton" content="[a-f0-9]+"/.test(corpsAvec), [sans.status, avec?.status]);
    // un second lancement sur le même port, sans fenêtre à ouvrir : il le dit et s'arrête en erreur
    const second = lancerDerush();
    let erreur = '';
    second.stderr.on('data', (b) => { erreur += b; });
    second.stdout.resume();
    const code = await Promise.race([fini(second), new Promise((ok) => setTimeout(ok, 30000, 'trop long'))]);
    if (code === 'trop long') second.kill('SIGKILL');
    essai('un second Dérush sans fenêtre, sur un port déjà pris, dit que rien n’est lancé (et ne sort pas en silence)', code === 1 && new RegExp(`tourne déjà sur le port ${libre}`).test(erreur), [code, erreur.slice(-300)]);
  } finally {
    premier.kill('SIGTERM');
    await Promise.race([fini(premier), new Promise((ok) => setTimeout(ok, 10000))]);
    if (premier.exitCode === null && premier.signalCode === null) premier.kill('SIGKILL');
  }
} catch (e) {
  essai('les essais sont allés au bout', false, e.message);
} finally {
  fs.rmSync(T, {recursive: true, force: true});
}
console.log(`\n${bons} essais réussis sur ${total}`);
process.exit(bons === total ? 0 : 1);
