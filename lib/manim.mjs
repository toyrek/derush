// Dérush — Manim (https://github.com/ManimCommunity/manim, MIT), installé à la demande : des animations de maths et
// de schémas écrites en Python (courbes, graphiques, formes qui se transforment, textes), rendues en vidéo.
//   - Rien n'est livré avec Dérush : « derush-manim installer » crée un Python à part (moteurs/manim, pour ne rien
//     déranger dans celui de Dérush) et y installe la version examinée, depuis PyPI.
//   - Sur Mac et sous Linux, la documentation de Manim demande d'abord des bibliothèques du système (Cairo et
//     pkg-config ; Pango aussi sous Linux) : Dérush ne touche pas au système, il dit la commande de la documentation
//     et laisse la personne la lancer (prerequisManim). Sous Windows, rien n'est demandé.
//   - Les formules écrites en LaTeX (MathTex, Tex) demandent une distribution LaTeX sur l'ordinateur : Dérush ne
//     l'installe pas. Sans elle, Text, les formes, les axes, les courbes et les graphiques marchent ; etatManim() le dit.
//   - Une scène Manim est un programme Python écrit par l'IA : il tourne comme tout ce qu'elle lance, sans clé dans
//     son environnement.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {DOSSIER_SUPPORT, uv, envUv} from './moteurs.mjs';
import {lancer} from './outils.mjs';
import {MAC, WINDOWS, trouver} from './plateforme.mjs';

export const VERSION_MANIM = '0.22.1';
export const dossierManim = () => path.join(DOSSIER_SUPPORT, 'moteurs', 'manim');
export const pythonManim = () => (WINDOWS ? path.join(dossierManim(), 'Scripts', 'python.exe') : path.join(dossierManim(), 'bin', 'python'));
const temoin = () => path.join(dossierManim(), '.manim-pret');
/** LaTeX est-il sur l'ordinateur ? (Manim s'en sert pour MathTex et Tex, avec dvisvgm.) */
export const latexPresent = () => !!(trouver('latex') && trouver('dvisvgm'));

export const DOC_MANIM = 'https://docs.manim.community/en/stable/installation/uv.html';
/**
 * Ce que la documentation de Manim demande sur l'ordinateur avant de l'installer : sur Mac, Cairo et pkg-config
 * (« brew install cairo pkg-config ») ; sous Linux, un compilateur, Cairo et Pango ; sous Windows, rien.
 * Renvoie {ok} ou {ok: false, manque, commande, doc} : la commande est celle de la documentation, à lancer par la
 * personne (Dérush n'installe rien sur le système).
 */
export function prerequisManim() {
  if (WINDOWS) return {ok: true};
  const pk = trouver('pkg-config');
  const a = (nom) => { if (!pk) return false; try { execFileSync(pk, ['--exists', nom], {stdio: 'ignore'}); return true; } catch { return false; } };
  const manque = [pk ? null : 'pkg-config', a('cairo') ? null : 'Cairo', MAC || a('pango') ? null : 'Pango'].filter(Boolean);
  if (!manque.length) return {ok: true};
  return {ok: false, manque, commande: MAC ? 'brew install cairo pkg-config' : 'sudo apt install build-essential python3-dev libcairo2-dev libpango1.0-dev', doc: DOC_MANIM};
}
const direPrerequis = (p) => `Manim a besoin de ${p.manque.join(' et de ')} sur cet ordinateur, et Dérush n’installe rien sur le système. La documentation de Manim (${p.doc}) donne la commande : « ${p.commande} ». Dis-le à la personne : c’est à elle de la lancer, puis « derush-manim installer » marchera.`;

/** Manim est-il installé ? {ok, version, latex, prerequis, installable, taille, pourquoi}. */
export function etatManim() {
  let version = null;
  try { version = fs.readFileSync(temoin(), 'utf8').trim() || null; } catch { /* pas installé */ }
  const pret = !!version && fs.existsSync(pythonManim());
  const latex = latexPresent();
  if (pret) return {ok: true, version, latex, nom: `Manim ${version}`, detail: latex ? 'Animations de maths, formules comprises.' : 'Animations de maths (courbes, graphiques, formes, textes). Les formules en LaTeX demandent une distribution LaTeX sur l’ordinateur.'};
  const prerequis = prerequisManim();
  return {ok: false, installable: prerequis.ok, latex, prerequis, taille: '350 Mo', nom: 'Manim',
    pourquoi: prerequis.ok ? 'Manim n’est pas installé (derush-manim installer : environ 350 Mo, une seule fois).' : `Manim n’est pas installé. ${direPrerequis(prerequis)}`};
}

let installation = null;
/** Installe Manim dans son propre Python (moteurs/manim), à la version examinée. */
export function installerManim(prog = () => {}) {
  installation ??= (async () => {
    const p = prerequisManim();
    if (!p.ok) throw new Error(direPrerequis(p));
    const u = uv();
    if (!u) throw new Error('L’outil « uv » est introuvable : installe d’abord les moteurs de Dérush (Connexions).');
    fs.rmSync(temoin(), {force: true});
    prog(0.02);
    try {
      if (!fs.existsSync(pythonManim())) await lancer(u, ['venv', '--python', '3.12', dossierManim()], {env: envUv(), dureeMax: 10 * 60e3});
      prog(0.15);
      await lancer(u, ['pip', 'install', '--python', pythonManim(), `manim==${VERSION_MANIM}`], {env: envUv(), dureeMax: 30 * 60e3});
    } catch (e) {
      throw new Error(`Manim n’a pas pu s’installer (il faut Internet) : ${String(e.message).slice(-400)}`);
    }
    prog(0.9);
    // la preuve : il se charge, et dit sa version
    const {out} = await lancer(pythonManim(), ['-c', 'import manim; print(manim.__version__)'], {env: envManim(), dureeMax: 5 * 60e3});
    const v = String(out).trim().split(/\s+/).pop();
    if (!/^\d+\.\d+/.test(v)) throw new Error('Manim est installé mais ne se charge pas.');
    fs.writeFileSync(temoin(), `${v}\n`);
    prog(1);
    return etatManim();
  })().finally(() => { installation = null; });
  return installation;
}

/** L'environnement d'un rendu Manim : celui de Dérush, sans aucune clé. */
export function envManim(base = process.env) {
  const env = {...base};
  for (const k of Object.keys(env)) if (/(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|_CLE$)/i.test(k)) delete env[k];
  return {...env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8'};
}

export const QUALITES = {brouillon: 'l', moyenne: 'm', haute: 'h', '4k': 'k'};
/**
 * Rend une scène : `fichier` (scene.py), `scene` (le nom de la classe), `sortie` (.mp4, .mov avec --transparent, ou
 * .png pour la dernière image). Renvoie {sortie, secondes, journal}. `surTexte` reçoit ce que Manim écrit.
 */
export async function rendreManim({fichier, scene, sortie, qualite = 'haute', fps = null, transparent = false, cwd = process.cwd(), surTexte = () => {}} = {}) {
  const e = etatManim();
  if (!e.ok) throw new Error(e.pourquoi);
  const src = path.resolve(cwd, String(fichier ?? ''));
  if (!fs.existsSync(src) || !/\.py$/i.test(src)) throw new Error(`La scène est introuvable, ou n’est pas un fichier .py : ${fichier}`);
  if (!/^[A-Za-z_]\w*$/.test(String(scene ?? ''))) throw new Error('Il manque le nom de la scène (la classe Python) : derush-manim rendre scene.py MaScene -o rendu/maths.mp4');
  if (!sortie) throw new Error('Il manque la sortie (-o rendu/maths.mp4).');
  const q = QUALITES[qualite];
  if (!q) throw new Error(`Qualité inconnue : ${qualite}. Celles qui existent : ${Object.keys(QUALITES).join(', ')}.`);
  const cible = path.resolve(cwd, sortie);
  const ext = path.extname(cible).toLowerCase();
  if (!['.mp4', '.mov', '.png'].includes(ext)) throw new Error('La sortie est un .mp4, un .mov (fond transparent) ou un .png (la dernière image, pour regarder).');
  if (transparent && ext === '.mp4') throw new Error('Un fond transparent demande une sortie .mov.');
  const media = fs.mkdtempSync(path.join(path.dirname(src), '.manim-'));
  const t0 = Date.now();
  try {
    const args = ['-m', 'manim', 'render', `-q${q}`, '--media_dir', media, '--disable_caching', '--progress_bar', 'none', '-v', 'WARNING',
      ...(fps ? ['--fps', String(Math.round(fps))] : []), ...(ext === '.png' ? ['-s'] : ['--format', ext === '.mov' ? 'mov' : 'mp4']), ...(transparent ? ['-t'] : []), '-o', 'sortie', src, scene];
    let journal = '';
    const code = await new Promise((ok, ko) => {
      const p = spawn(pythonManim(), args, {cwd: path.dirname(src), env: envManim(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true});
      const garde = setTimeout(() => p.kill(), 60 * 60e3);
      const lire = (d) => { journal = (journal + d).slice(-20000); surTexte(String(d)); };
      p.stdout.on('data', lire);
      p.stderr.on('data', lire);
      p.on('error', (err) => { clearTimeout(garde); ko(err); });
      p.on('close', (c) => { clearTimeout(garde); ok(c ?? 1); });
    });
    if (code !== 0) {
      const latex = /latex|dvisvgm|MathTex|Tex\b/i.test(journal) && !latexPresent();
      throw new Error(`Manim a échoué${latex ? ' : la scène écrit une formule en LaTeX (MathTex, Tex), et LaTeX n’est pas sur cet ordinateur. Écris-la avec Text, ou dessine-la dans une toile (derush-toile)' : ''}.\n${journal.trim().split('\n').slice(-12).join('\n')}`);
    }
    // le fichier rendu : cherché dans le dossier de Manim (son chemin dépend de la qualité)
    const trouves = [];
    const chercher = (d) => { for (const n of fs.readdirSync(d, {withFileTypes: true})) { const f = path.join(d, n.name); if (n.isDirectory()) { if (n.name !== 'partial_movie_files') chercher(f); } else if (/^sortie.*\.(mp4|mov|png)$/i.test(n.name)) trouves.push(f); } };
    chercher(media);
    const rendu = trouves.find((f) => f.toLowerCase().endsWith(ext)) ?? trouves[0];
    if (!rendu) throw new Error(`Manim a fini sans écrire de fichier.\n${journal.trim().split('\n').slice(-6).join('\n')}`);
    fs.mkdirSync(path.dirname(cible), {recursive: true});
    fs.copyFileSync(rendu, cible);
    return {sortie: cible, secondes: Math.round((Date.now() - t0) / 100) / 10, journal: journal.trim().split('\n').slice(-6).join('\n')};
  } finally { fs.rmSync(media, {recursive: true, force: true}); }
}
