#!/usr/bin/env node
// Dérush — la commande « derush-ralenti », donnée à l'IA : un ralenti fluide (lib/ralenti.mjs). RIFE invente les images
// qui manquent quand il est installé (Connexions › Ralenti fluide), FFmpeg sinon. Tout le mode d'emploi est dans AIDE.
import path from 'node:path';
import {aide, options, relaisPresent, demanderAuRelais} from './commande.mjs';

const AIDE = `derush-ralenti — un ralenti fluide : un passage 2 à 8 fois plus lent, les images qui manquent inventées.

Usage (depuis le dossier de travail) :
  derush-ralenti etat                   le ralenti fluide (RIFE) est-il installé ? Sans lui, FFmpeg fait le travail.
  derush-ralenti <vidéo> -o <sortie.mp4> [--fois 2] [--de S] [--a S] [--cadence 30] [--moteur auto|rife|ffmpeg] [--json]

  --fois      combien de fois plus lent : 2 (par défaut) à 8, décimales permises (1.5). Avec 1 : la même durée et plus
              d'images par seconde (--fois 1 --cadence 60 : une vidéo plus fluide, son gardé).
  --de, --a   le passage à ralentir, en secondes dans la vidéo de départ ; la sortie ne contient que lui. Ralentis
              seulement ce que tu montes : quelques secondes.
  --cadence   les images par seconde de la sortie : celle de ton montage (30 le plus souvent). Par défaut, celle de
              la vidéo de départ, 60 au plus. Donne-la toujours.
  --moteur    auto (RIFE s'il est installé, sinon FFmpeg), rife, ffmpeg.

Ce qu'il faut savoir :
  - Une vidéo filmée à 120 ou 240 images/s a déjà ses images : avec --cadence 30, rien n'est inventé, les vraies
    images sont étalées (le moteur dit « images »). C'est le meilleur ralenti possible.
  - RIFE invente bien un mouvement régulier (un geste, un pas de danse, une voiture, une vague). Il peut se tromper
    sur un mouvement très rapide ou caché (des mains qui se croisent, une hélice, ce qui entre dans le cadre) :
    regarde des images du passage ralenti avant de livrer (derush-controle, ou ffmpeg).
  - Le son n'est pas gardé quand la vidéo est ralentie : pose une musique, un souffle, des bruitages. Avec --fois 1,
    il est gardé.
  - La sortie : une vidéo .mp4 (H.264, couleurs BT.709), à poser dans le montage comme un plan (remotion/public/).
  - Le temps, sur un Mac M4 avec RIFE : environ 0,1 s par image de sortie en 1080 × 1920 (2 s ralenties ×4 à 30 i/s :
    240 images, une demi-minute). FFmpeg seul est plus lent et un peu moins fin.

Exemples :
  derush-ralenti plans/M2-danse.mp4 -o remotion/public/M2-ralenti.mp4 --de 3.2 --a 4.8 --fois 4 --cadence 30
  derush-ralenti plans/M5-iphone-240.mov -o remotion/public/M5-ralenti.mp4 --de 1 --a 2 --fois 8 --cadence 30
  derush-ralenti plans/M1-saut.mp4 -o remotion/public/M1-60.mp4 --fois 1 --cadence 60
Réponse : la sortie, le moteur (rife, ffmpeg, ou images : rien à inventer), le nombre d'images, les durées ; --json : tout.`;

const args = process.argv.slice(2);
aide(args, AIDE, {siVide: true});
const sortir = (t, code = 1) => { process.stderr.write(`derush-ralenti : ${t}\n`); process.exit(code); };

// dans le bac à sable d'une IA (Codex, Gemini), la carte graphique n'est pas là : la demande passe par le relais de
// Dérush, qui la lance hors du bac à sable, dans le même dossier
if (relaisPresent()) {
  const r = await demanderAuRelais('pixels', {commande: 'ralenti', args, cwd: process.cwd()}, 'DERUSH-PIXELS');
  if (!r.ok) sortir(r.message);
  process.stdout.write(r.sortie ?? '');
  process.stderr.write(r.erreurs ?? '');
  process.exit(r.code ?? 0);
}

// interrompue (Ctrl-C, l'IA qui abandonne, le relais qui l'arrête) : une sortie propre, pour que les images de travail
// soient effacées et que FFmpeg et le moteur s'arrêtent avec elle
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => process.exit(130));
const {opt, drapeau} = options(args);
const json = drapeau('--json');
const ecrire = (t) => process.stdout.write(`${t}\n`);
try {
  if (args[0] === 'etat') {
    const {etatMoteurPixels} = await import('../lib/moteurs-pixels.mjs');
    const e = etatMoteurPixels('rife');
    if (json) ecrire(JSON.stringify(e, null, 2));
    else ecrire(e.ok ? `Le ralenti fluide (RIFE, ${e.version}) est installé : il invente les images qui manquent.` : `Le ralenti fluide (RIFE) n’est pas prêt : ${e.pourquoi} ${e.installable ? `La personne l’installe dans Connexions › Ralenti fluide (${e.a_telecharger}). ` : ''}En attendant, derush-ralenti ralentit avec FFmpeg.`);
  } else {
    const sortie = opt('-o') ?? opt('--sortie');
    const o = {fois: opt('--fois') ?? 2, cadence: opt('--cadence'), de: opt('--de') ?? 0, a: opt('--a'), moteur: opt('--moteur') ?? 'auto'};
    const inconnue = args.find((x) => /^--?[a-z]/i.test(x));
    if (inconnue) sortir(`option inconnue : ${inconnue} (derush-ralenti --help).`);
    const [entree, ...reste] = args;
    if (!entree || !sortie) sortir('Usage : derush-ralenti <vidéo> -o <sortie.mp4> --fois 4 --cadence 30 (derush-ralenti --help).');
    if (reste.length) sortir(`en trop : ${reste.join(' ')} (une seule vidéo à la fois).`);
    const {ralentir} = await import('../lib/ralenti.mjs');
    let dernier = 0;
    const r = await ralentir(path.resolve(entree), path.resolve(sortie), o, ({fait, total}) => {
      if (json || (Date.now() - dernier < 5000 && fait < total)) return;
      dernier = Date.now();
      process.stderr.write(`image ${fait} / ${total}\n`);
    });
    if (json) ecrire(JSON.stringify(r, null, 2));
    else {
      const comment = r.moteur === 'images' ? 'rien à inventer : les vraies images sont étalées' : r.moteur === 'rife' ? 'images inventées par RIFE' : 'images inventées par FFmpeg';
      ecrire(`Ralenti : ${path.relative(process.cwd(), r.sortie)} — ${r.duree_s} s (${r.duree_source_s ?? '?'} s de départ × ${r.fois}), ${r.largeur} × ${r.hauteur}, ${r.cadence} images/s, ${r.images} images ; ${comment}, en ${r.secondes} s.${r.son ? '' : ' Sans son.'}`);
      for (const a of r.attention) ecrire(`Attention : ${a}`);
    }
  }
} catch (err) { sortir(err.message); }
