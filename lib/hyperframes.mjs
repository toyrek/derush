// Dérush — HyperFrames (HeyGen, Apache-2.0), le second moteur de rendu : des pages HTML animées (GSAP surtout),
// rendues image par image en MP4, et un catalogue d'environ 450 blocs prêts (transitions, titres animés, sous-titres,
// graphiques, cartes, 3D). Remotion reste le moteur du montage de rushes (le kit, les effets posés dans Dérush).
//   - Installé chez l'utilisateur, dans moteurs/hyperframes du dossier de Dérush, à une version relue
//     (VERSION_HYPERFRAMES), jamais dans ce dépôt ; il lui faut Node 22 ou plus. Installé avec le moteur de rendu,
//     avant le premier montage qui suit (lib/claude.mjs), ou d'un clic dans Connexions.
//   - Lancé seulement par la commande derush-hyperframes (outils/derush-hyperframes.mjs) : télémétrie, vérification des
//     mises à jour, installation de compétences ou de modules à la volée coupées ; ses dossiers dans celui de Dérush
//     (rien dans le dossier personnel) ; le navigateur sans fenêtre de Remotion (pas de second téléchargement) ; aucune
//     clé dans son environnement ; les commandes qui parlent à HeyGen (compte, nuage, usage, avis, télémétrie) refusées.
//   - Le catalogue des blocs est lu au commit de cette version (pas « main »), et les blocs qui téléchargent à l'ajout
//     des images sans licence (BLOCS_REFUSES) ne s'ajoutent pas.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {DOSSIER_SUPPORT} from './moteurs.mjs';
import {lireJson, ecrireJson, lancer, FFMPEG, FFPROBE} from './outils.mjs';
import {commandeNode} from './plateforme.mjs';
import {dossierMoteurRendu, envNode} from './rendu.mjs';

export const VERSION_HYPERFRAMES = '0.9.64';
export const COMMIT_HYPERFRAMES = 'f291b125983a180ef9dd8744536c90023e5a1998';
export const REGISTRE_HYPERFRAMES = `https://raw.githubusercontent.com/heygen-com/hyperframes/${COMMIT_HYPERFRAMES}/registry`;
export const dossierHyperframes = () => path.join(DOSSIER_SUPPORT, 'moteurs', 'hyperframes');
const programme = () => path.join(dossierHyperframes(), 'node_modules', 'hyperframes', 'bin', 'hyperframes.mjs');
export const nodeAssezRecent = (v = process.versions.node) => Number(String(v).split('.')[0]) >= 22;

/** Ce que l'IA peut lancer : de quoi créer, chercher et ajouter des blocs, vérifier, regarder et rendre. */
export const COMMANDES_PERMISES = new Set(['init', 'lint', 'check', 'snapshot', 'catalog', 'add', 'render', 'compositions', 'timeline', 'doctor', 'info']);
/**
 * Les blocs du catalogue (version 0.9.64) qui téléchargent à l'ajout des fichiers de static.heygen.ai sans licence
 * (photos d'artistes, visages…), et la carte promotionnelle de HeyGen : jamais ajoutés.
 */
export const BLOCS_REFUSES = new Set([
  ...[1, 2, 3, 4, 5].flatMap((n) => ['circle', 'orbit', 'path', 'text-circle', 'vision'].map((t) => `carousel-${t}-${n}`)),
  'frost-sequence-camera-orbit', 'glass-shard-title', 'heygen-avatar-promo-card',
]);
/** Les blocs qui imitent l'interface d'une marque : à n'utiliser que si la vidéo parle vraiment de ce service. */
export const BLOCS_DE_MARQUE = ['tiktok-follow', 'instagram-follow', 'x-post', 'x-follow-card', 'reddit-post', 'spotify-card', 'slack-notification-ad', 'chatgpt-exchange', 'claude-exchange', 'yt-lower-third', 'vpn-youtube-spot', 'apple-money-count'];

/** Le navigateur sans fenêtre de Remotion (déjà là pour le rendu) : HyperFrames s'en sert, sans second téléchargement. */
export function navigateurRemotion() {
  const base = path.join(dossierMoteurRendu(), 'node_modules', '.remotion', 'chrome-headless-shell');
  try {
    for (const plateforme of fs.readdirSync(base)) {
      const d = path.join(base, plateforme);
      if (!fs.statSync(d).isDirectory()) continue;
      for (const sous of fs.readdirSync(d)) {
        for (const nom of ['chrome-headless-shell', 'chrome-headless-shell.exe']) {
          const f = path.join(d, sous, nom);
          if (fs.existsSync(f)) return f;
        }
      }
    }
  } catch { /* pas de moteur de rendu : HyperFrames téléchargera le sien, dans le dossier de Dérush */ }
  return null;
}

/** L'état pour Connexions et avant un montage : {ok, installable, version, pourquoi}. */
export function etatHyperframes() {
  const v = lireJson(path.join(dossierHyperframes(), 'node_modules', 'hyperframes', 'package.json'))?.version ?? null;
  if (!nodeAssezRecent()) return {ok: false, installable: false, version: v, pourquoi: `HyperFrames demande Node 22 ou plus (cet ordinateur a Node ${process.versions.node}).`};
  if (v === VERSION_HYPERFRAMES && fs.existsSync(programme())) return {ok: true, installable: true, version: v, navigateur: !!navigateurRemotion()};
  return {ok: false, installable: true, version: v, pourquoi: v ? 'HyperFrames doit être mis à jour.' : 'HyperFrames n’est pas encore installé.'};
}

let installation = null;
/** Installe HyperFrames dans le dossier de Dérush, à la version relue (npm, sans lancer aucun script d'installation). */
export function installerHyperframes(prog = () => {}) {
  installation ??= (async () => {
    if (!nodeAssezRecent()) throw new Error(etatHyperframes().pourquoi);
    const D = dossierHyperframes();
    fs.mkdirSync(D, {recursive: true});
    ecrireJson(path.join(D, 'package.json'), {name: 'derush-moteur-hyperframes', private: true, dependencies: {hyperframes: VERSION_HYPERFRAMES}}, 2);
    prog(0.1);
    try {
      await lancer(process.env.DERUSH_NPM || commandeNode('npm'), ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error'], {cwd: D, env: envNode(), dureeMax: 15 * 60e3});
    } catch (e) {
      throw new Error(`HyperFrames n’a pas pu s’installer (il faut Internet) : ${String(e.message).slice(0, 300)}`);
    }
    prog(1);
    const e = etatHyperframes();
    if (!e.ok) throw new Error(`HyperFrames ne s’est pas installé correctement : ${e.pourquoi}`);
    return e;
  })().finally(() => { installation = null; });
  return installation;
}

/**
 * L'environnement de la commande : rien qui parle à HeyGen, rien dans le dossier personnel, aucune clé, le navigateur
 * de Remotion. `bacASable` : lancée dans le bac à sable d'une IA (Codex), où le bac à sable de Chrome ne démarre pas.
 */
export function envHyperframes(base = process.env, {bacASable = false} = {}) {
  const env = {...base};
  for (const k of Object.keys(env)) if (/(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|_CLE$)/i.test(k)) delete env[k];
  const D = dossierHyperframes();
  Object.assign(env, {
    HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1', HYPERFRAMES_SKIP_SKILLS: '1',
    HYPERFRAMES_NO_OPTIONAL_INSTALL: '1', HYPERFRAMES_NO_AUTO_INSTALL: '1', HYPERFRAMES_NO_CAPTURE_DOTENV: '1', HYPERFRAMES_NO_PREVIEW_DISCOVERY: '1',
    HYPERFRAMES_CONFIG_DIR: path.join(D, 'reglages'), HYPERFRAMES_CACHE_DIR: path.join(D, 'cache'), HYPERFRAMES_FONT_CACHE_DIR: path.join(D, 'cache', 'polices'),
  });
  if (path.isAbsolute(FFMPEG)) env.HYPERFRAMES_FFMPEG_PATH = FFMPEG;
  if (path.isAbsolute(FFPROBE)) env.HYPERFRAMES_FFPROBE_PATH = FFPROBE;
  const nav = navigateurRemotion();
  if (nav) env.HYPERFRAMES_BROWSER_PATH = nav;
  if (bacASable) env.HYPERFRAMES_CHROME_SANDBOX = '0';
  return env;
}

/**
 * Prépare une commande de l'IA : refuse ce qui n'est pas permis, ajoute ce que Dérush impose (projet créé sans
 * question ni compétence, bloc ajouté sans le presse-papiers), et fixe le catalogue au commit de la version installée
 * (hyperframes.json du projet). Renvoie les arguments à donner au programme, ou lève une erreur en français.
 */
export function preparerCommande(args, dossier = process.cwd()) {
  const [cmd, ...reste] = args;
  if (!cmd || !COMMANDES_PERMISES.has(cmd)) {
    throw new Error(`« ${cmd ?? ''} » n’est pas permis dans Dérush. Commandes : ${[...COMMANDES_PERMISES].join(', ')} (derush-hyperframes --help).`);
  }
  if (cmd === 'init') {
    const plus = ['--non-interactive', '--skip-skills', '--skip-transcribe'].filter((x) => !reste.includes(x));
    return ['init', ...reste.filter((x) => !/^--(video|capture)\b/.test(x)), ...plus];
  }
  if (cmd === 'add') {
    const bloc = reste.find((x) => !x.startsWith('-'));
    if (!bloc) throw new Error('Quel bloc ? derush-hyperframes add <bloc> (cherche-le avec derush-hyperframes catalog --query "…").');
    if (BLOCS_REFUSES.has(bloc)) throw new Error(`Le bloc « ${bloc} » télécharge des images sans licence (photos de personnes ou de marques) : Dérush ne l’ajoute pas. Prends un autre bloc, ou fais l’effet avec les images du projet.`);
    fixerRegistre(dossier);
    return ['add', ...reste, ...(reste.includes('--no-clipboard') ? [] : ['--no-clipboard'])];
  }
  if (cmd === 'catalog') fixerRegistre(dossier, false);
  return [cmd, ...reste];
}

/** Le catalogue au commit de la version installée, dans hyperframes.json du projet (créé seulement si `creer`). */
export function fixerRegistre(dossier, creer = true) {
  const f = path.join(dossier, 'hyperframes.json');
  const j = lireJson(f);
  if (!j && !creer) return false;
  if (j?.registry === REGISTRE_HYPERFRAMES) return true;
  ecrireJson(f, {...(j ?? {}), registry: REGISTRE_HYPERFRAMES}, 2);
  return true;
}

/** Ce que Dérush écrit à la place des consignes d'HyperFrames, dans un projet tout juste créé (CLAUDE.md, AGENTS.md). */
export const CONSIGNES_PROJET = `# Projet HyperFrames, dans Dérush

Cette vidéo est écrite en HTML (index.html, compositions/) et rendue image par image en MP4.

- Les compétences à lire : \`hyperframes\` (le contrat de rendu et la méthode), \`hyperframes-cli\` (les commandes),
  \`hyperframes-registry\` (les blocs prêts). Les autres compétences citées par HyperFrames (media-use, figma,
  slideshow, reverse-any-video, style-sampling) ne sont pas dans Dérush.
- La commande : \`derush-hyperframes <commande>\` (la version ${VERSION_HYPERFRAMES} installée par Dérush, sans télémétrie ni
  compte). Jamais \`npx hyperframes\` ni \`npm run …\` : ils téléchargeraient une autre version. Aide : \`derush-hyperframes --help\`.
- Vérifier : \`derush-hyperframes check --json\`, puis \`derush-hyperframes snapshot --at 0.5,1.5,3\` (regarde les images).
- Rendre : \`derush-hyperframes render -o ../rendu/final.mp4 --quality high\` (plusieurs vidéos : dans ../rendu/livraison/).
- Les sons, les voix, les images générées : avec les outils de Dérush (ElevenLabs, la bibliothèque de sons), posés
  dans assets/ et joués par <audio data-start data-duration>.
- Jamais de fichier .env ici ; jamais de bloc qui imite une marque pour faire croire à un vrai message ou un vrai compte.
`;

/**
 * Après « init » : le catalogue fixé au commit de la version installée, les raccourcis npm qui passent par la commande
 * de Dérush (pas par npx, qui téléchargerait une autre version), et les consignes du projet remplacées par celles de
 * Dérush (celles d'HyperFrames parlent de compétences payantes, de télémétrie et de commandes refusées ici).
 */
export function apresInit(dossier) {
  if (!fs.existsSync(path.join(dossier, 'index.html'))) return false;
  fixerRegistre(dossier);
  const pkg = lireJson(path.join(dossier, 'package.json'));
  if (pkg) ecrireJson(path.join(dossier, 'package.json'), {...pkg, scripts: {check: 'derush-hyperframes check', render: 'derush-hyperframes render'}}, 2);
  for (const n of ['CLAUDE.md', 'AGENTS.md']) fs.writeFileSync(path.join(dossier, n), CONSIGNES_PROJET);
  return true;
}

/** Lance une commande permise (pour le relais et les essais) ; renvoie {code, sortie, erreurs}, même en échec. */
export function lancerHyperframes(args, {cwd = process.cwd(), bacASable = false, dureeMax = 30 * 60e3} = {}) {
  const e = etatHyperframes();
  if (!e.ok) return Promise.reject(new Error(e.pourquoi));
  const a = preparerCommande(args, cwd);
  return new Promise((ok, ko) => {
    const p = spawn(process.execPath, [programme(), ...a], {cwd, env: envHyperframes(envNode(), {bacASable}), stdio: ['ignore', 'pipe', 'pipe']});
    let sortie = '';
    let erreurs = '';
    const garde = setTimeout(() => p.kill(), dureeMax);
    p.stdout.on('data', (d) => { sortie += d; });
    p.stderr.on('data', (d) => { erreurs += d; });
    p.on('error', (err) => { clearTimeout(garde); ko(err); });
    p.on('close', (code) => {
      clearTimeout(garde);
      if (code === 0 && a[0] === 'init') apresInit(path.resolve(cwd, a.slice(1).find((x) => !x.startsWith('-')) ?? '.'));
      ok({code: code ?? 1, sortie, erreurs});
    });
  });
}
export const cheminProgrammeHyperframes = programme;
