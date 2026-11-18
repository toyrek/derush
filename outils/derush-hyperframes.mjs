#!/usr/bin/env node
// Dérush — la commande « derush-hyperframes », donnée à l'IA : HyperFrames, le second moteur de rendu de Dérush (des
// pages HTML animées, rendues en MP4, et environ 450 blocs prêts). C'est la version installée et relue par Dérush,
// sans télémétrie ni compte HeyGen : jamais « npx hyperframes ». Tout le mode d'emploi est dans AIDE.
import path from 'node:path';
import {spawn} from 'node:child_process';
import {aide} from './commande.mjs';

const H = await import('../lib/hyperframes.mjs');

const AIDE = `derush-hyperframes — HyperFrames dans Dérush : des vidéos écrites en HTML (GSAP), rendues image par image.

Usage (depuis le dossier du projet HyperFrames, sauf init) :
  derush-hyperframes init <dossier> [--resolution portrait|landscape|square]
        un projet vide (index.html, hyperframes.json) ; jamais dans un dossier qui a déjà des fichiers
  derush-hyperframes catalog [--query "lower third"] [--json]      chercher un bloc prêt (transitions, titres, graphiques…)
  derush-hyperframes add <bloc>                                     l'ajouter au projet (dans compositions/)
  derush-hyperframes lint [--json] | check [--json]                 vérifier le projet (erreurs, éléments hors cadre)
  derush-hyperframes snapshot --at 0.5,1.5 [--json]                 des images fixes, pour regarder avant de rendre
  derush-hyperframes render -o ../rendu/final.mp4 [--fps 30] [--quality high]
        rendre la vidéo (MP4 H.264, son AAC) ; les dimensions viennent de data-width / data-height de la composition
  derush-hyperframes compositions | timeline | doctor | info

Les règles d'une vidéo HyperFrames (le détail est dans les compétences hyperframes, hyperframes-cli,
hyperframes-registry) :
  - index.html porte #root avec data-composition-id, data-start, data-duration, data-width, data-height ;
  - chaque élément minuté : class="clip" avec data-start et data-duration ;
  - une timeline GSAP en pause par composition : window.__timelines["id"] = gsap.timeline({paused: true}) ;
  - rien qui dépende de l'horloge : ni Date.now, ni requestAnimationFrame, ni minuterie, ni hasard sans graine, ni
    fetch, ni repeat: -1 ; on ne lance ni n'arrête jamais un média ;
  - une police autre que celles d'HyperFrames : un @font-face vers assets/fonts (les polices de Dérush sont dans
    remotion/public/polices du dossier de travail, avec leurs licences).

Ce que Dérush impose :
  - init se fait sans question et sans installer de compétences ; add sans toucher au presse-papiers ;
  - le catalogue est celui de la version installée (${H.VERSION_HYPERFRAMES}), pas la dernière ;
  - les blocs qui téléchargent des images sans licence (photos de personnes, de marques) sont refusés ;
  - les commandes qui parlent à HeyGen (auth, cloud, usage, feedback, events, telemetry, upgrade…) sont refusées ;
  - aucune clé ne passe à HyperFrames : ne crée jamais de fichier .env dans le projet.

Un bloc qui imite l'interface d'une marque (TikTok, Instagram, X, Spotify, Slack, ChatGPT, Claude, YouTube…) : seulement
si la vidéo parle vraiment de ce service, jamais pour faire croire à un vrai message ou à un vrai compte.
La vidéo finale va dans rendu/final.mp4 du dossier de travail (plusieurs : rendu/livraison/), comme avec le kit.

Exemple, depuis le dossier de travail :
  derush-hyperframes init hf --resolution portrait && cd hf
  derush-hyperframes catalog --query "data chart" --json
  derush-hyperframes add data-chart
  derush-hyperframes check --json && derush-hyperframes snapshot --at 1,3,5
  derush-hyperframes render -o ../rendu/final.mp4 --quality high`;

const args = process.argv.slice(2);
aide(args, AIDE, {siVide: true});
const sortir = (t, code = 1) => { process.stderr.write(`derush-hyperframes : ${t}\n`); process.exit(code); };

let a;
try { a = H.preparerCommande(args, process.cwd()); } catch (err) { sortir(err.message); }
// dans le bac à sable d'une IA, Chrome démarre mal et celui de Gemini coupe le réseau local, dont HyperFrames a besoin :
// la demande passe par le relais de Dérush, qui la lance hors du bac à sable, dans le même dossier. Pour Gemini, par la
// boîte de fichiers ; pour Codex, par l'adresse locale du relais, comme son rendu Remotion.
if ((process.env.DERUSH_RELAIS_BOITE || process.env.DERUSH_RELAIS) && process.env.DERUSH_RELAIS_JETON) {
  const {fileURLToPath, pathToFileURL} = await import('node:url');
  const corps = {args, cwd: process.cwd()};
  let ligne = null;
  try {
    if (process.env.DERUSH_RELAIS_BOITE) {
      const {demanderParBoite} = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'boite.mjs')).href);
      ligne = await demanderParBoite({boite: process.env.DERUSH_RELAIS_BOITE, jeton: process.env.DERUSH_RELAIS_JETON, route: 'hyperframes', corps, surTexte: (t) => process.stderr.write(t)});
    } else {
      const r = await fetch(`${process.env.DERUSH_RELAIS}/hyperframes`, {method: 'POST', headers: {'x-derush-relais': process.env.DERUSH_RELAIS_JETON, 'content-type': 'application/json'}, body: JSON.stringify(corps)});
      const texte = await r.text();
      ligne = texte.split('\n').reverse().find((l) => l.startsWith('##DERUSH-HYPERFRAMES')) ?? null;
      for (const l of texte.split('\n')) if (l && !l.startsWith('##DERUSH-')) process.stderr.write(`${l}\n`);
    }
  } catch (err) { sortir(`le relais de Dérush n’a pas répondu (${err.message}).`); }
  const r = JSON.parse(/^##DERUSH-HYPERFRAMES (.*)##\s*$/.exec(String(ligne ?? '').trim())?.[1] ?? '{"ok":false,"message":"le relais de Dérush n’a pas répondu."}');
  if (!r.ok) sortir(r.message);
  process.stdout.write(r.sortie ?? '');
  process.stderr.write(r.erreurs ?? '');
  process.exit(r.code ?? 0);
}
const e = H.etatHyperframes();
if (!e.ok) sortir(`${e.pourquoi} ${e.installable ? 'Dérush l’installe avant le prochain montage (ou Connexions › HyperFrames › Installer). En attendant, rends avec le kit remotion/.' : 'Rends avec le kit remotion/.'}`);
// dans le bac à sable de Codex (ou d'une IA lancée avec le relais), le bac à sable de Chrome ne démarre pas
const bacASable = !!(process.env.CODEX_SANDBOX || process.env.DERUSH_RELAIS_JETON);
const p = spawn(process.execPath, [H.cheminProgrammeHyperframes(), ...a], {stdio: 'inherit', env: H.envHyperframes(process.env, {bacASable})});
p.on('error', (err) => sortir(err.message));
p.on('close', (code, signal) => {
  // un projet tout juste créé : catalogue fixé, raccourcis par derush-hyperframes, consignes de Dérush
  if (code === 0 && a[0] === 'init') {
    const dossier = path.resolve(a.slice(1).find((x) => !x.startsWith('-')) ?? '.');
    if (H.apresInit(dossier)) process.stdout.write(`\nDérush : projet prêt dans ${dossier} (catalogue ${H.VERSION_HYPERFRAMES}, CLAUDE.md de Dérush). Commandes : derush-hyperframes --help\n`);
  }
  process.exit(code ?? (signal ? 1 : 0));
});
