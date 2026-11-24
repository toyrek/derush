#!/usr/bin/env node
// Dérush — la commande « derush-agrandir », donnée à l'IA : agrandir une image ou une vidéo trop petite en inventant les
// détails (lib/agrandir.mjs, Real-ESRGAN, installé d'un clic dans Connexions › Agrandisseur). Le mode d'emploi : AIDE.
import path from 'node:path';
import {aide, options, relaisPresent, demanderAuRelais} from './commande.mjs';

const AIDE = `derush-agrandir — agrandir une image ou une vidéo trop petite, en inventant les détails (Real-ESRGAN).

Usage (depuis le dossier de travail) :
  derush-agrandir etat                 l'agrandisseur est-il installé ?
  derush-agrandir <image> -o <grande.png> (--cote 2160 | --fois 2) [--modele photo|dessin]
  derush-agrandir <vidéo> -o <grande.mp4> (--cote 2160 | --fois 2) --modele dessin|photo [--de S] [--a S] [--long]
  derush-agrandir <image ou vidéo> (--cote 2160 | --fois 2) --estimer      le temps que ça prendrait, sans rien faire
  [--json] partout : la réponse complète.

  --cote      le petit côté voulu, en pixels : 1080 (HD), 1440 (2K), 2160 (4K). Ou --fois : de 1.05 à 4.
  --modele    dessin : dessins, animation, motion design, captures d'écran, textes ; rapide.
              photo : photos et vidéos filmées ; plus net qu'un agrandissement simple, mais lent, et il lisse un peu
              les textures fines (grain, peau). Pour une image : photo par défaut. Pour une vidéo : à choisir.
  --de, --a   le passage d'une vidéo à agrandir (la sortie ne contient que lui) : agrandis seulement ce que tu montes.
  --long      accepte plus de 20 minutes de travail (jusqu'à 4 h), quand la personne est d'accord pour attendre.

Ce qu'il faut savoir :
  - N'agrandis que ce qui est vraiment trop petit pour le montage (une image de 600 px dans une vidéo 1080 × 1920, un
    vieux rush en 480p, un logo minuscule). Au-delà de ×4, rien : les détails seraient tous inventés. Une vidéo
    s'agrandit jusqu'à la 4K (2160 × 3840) ; une image jusqu'à 8192 px de côté.
  - Le modèle dessin donne un air de dessin animé à une image filmée ; le modèle photo rend un dessin un peu flou par
    endroits. Regarde le résultat (l'image, ou des images de la vidéo) avant de le monter.
  - Le temps, mesuré sur un Mac M4 : dessin, environ 1,3 s par image de 1080 × 1920 agrandie en 4K (10 s de vidéo à
    30 images/s : 6 à 7 min) ; photo, environ 11 s par image de 540 × 960 et 45 s par image de 1080 × 1920. Pour une
    vidéo, la commande mesure le temps avant de commencer et refuse au-delà de 20 minutes sans --long.
  - Le son d'une vidéo est gardé tel quel ; la sortie est une vidéo .mp4 (H.264), une image .png, .jpg ou .webp (la
    transparence d'un PNG est gardée en .png et en .webp).

Exemples :
  derush-agrandir pieces/logo.png -o remotion/public/logo-grand.png --fois 4 --modele dessin
  derush-agrandir pieces/photo-2008.jpg -o remotion/public/photo-2008.jpg --cote 1920
  derush-agrandir plans/M4-vieux.mp4 --cote 1080 --estimer
  derush-agrandir plans/M4-vieux.mp4 -o plans/M4-1080.mp4 --cote 1080 --modele photo --de 2 --a 6`;

const args = process.argv.slice(2);
aide(args, AIDE, {siVide: true});
const sortir = (t, code = 1) => { process.stderr.write(`derush-agrandir : ${t}\n`); process.exit(code); };

// dans le bac à sable d'une IA (Codex, Gemini), la carte graphique n'est pas là : la demande passe par le relais
if (relaisPresent()) {
  const r = await demanderAuRelais('pixels', {commande: 'agrandir', args, cwd: process.cwd()}, 'DERUSH-PIXELS');
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
  const A = await import('../lib/agrandir.mjs');
  if (args[0] === 'etat') {
    const {etatMoteurPixels} = await import('../lib/moteurs-pixels.mjs');
    const e = etatMoteurPixels('realesrgan');
    if (json) ecrire(JSON.stringify(e, null, 2));
    else ecrire(e.ok ? `L’agrandisseur (Real-ESRGAN, ${e.version}) est installé. Modèles : dessin (${A.MODELES.dessin.aide}) ; photo (${A.MODELES.photo.aide}).` : `L’agrandisseur (Real-ESRGAN) n’est pas prêt : ${e.pourquoi}${e.installable ? ` La personne l’installe dans Connexions › Agrandisseur (${e.a_telecharger}).` : ''}`);
  } else {
    const sortie = opt('-o') ?? opt('--sortie');
    const o = {cote: opt('--cote'), fois: opt('--fois'), modele: opt('--modele'), de: opt('--de') ?? 0, a: opt('--a'), long: drapeau('--long'), estimer: drapeau('--estimer')};
    const inconnue = args.find((x) => /^--?[a-z]/i.test(x));
    if (inconnue) sortir(`option inconnue : ${inconnue} (derush-agrandir --help).`);
    const [entree, ...reste] = args;
    if (!entree) sortir('Usage : derush-agrandir <image ou vidéo> -o <sortie> --cote 2160 (derush-agrandir --help).');
    if (reste.length) sortir(`en trop : ${reste.join(' ')} (un seul fichier à la fois).`);
    if (!o.estimer && !sortie) sortir('il manque la sortie (-o …), ou --estimer pour seulement connaître le temps.');
    let dernier = 0;
    let r;
    try {
      r = await A.agrandir(path.resolve(entree), sortie ? path.resolve(sortie) : null, o, ({fait, total}) => {
        if (json || (Date.now() - dernier < 5000 && fait < total)) return;
        dernier = Date.now();
        process.stderr.write(`image ${fait} / ${total}\n`);
      });
    } catch (err) {
      if (json && err.resume) { ecrire(JSON.stringify({erreur: err.message, ...err.resume}, null, 2)); process.exit(1); }
      throw err;
    }
    if (json) ecrire(JSON.stringify(r, null, 2));
    else if (o.estimer) {
      ecrire(`${r.depart.largeur} × ${r.depart.hauteur} → ${r.largeur} × ${r.hauteur}${r.images > 1 ? `, ${r.images} images` : ''} :`);
      for (const [k, x] of Object.entries(r.estimation)) ecrire(`  ${k} : environ ${A.direDuree(x.total_s)}${r.images > 1 ? ` (${x.par_image_s} s par image)` : ''} — ${A.MODELES[k].aide}`);
    } else {
      ecrire(`Agrandi : ${path.relative(process.cwd(), r.sortie)} — ${r.depart.largeur} × ${r.depart.hauteur} → ${r.largeur} × ${r.hauteur}, modèle ${r.modele}${r.type === 'video' ? `, ${r.images} images, ${r.duree_s} s${r.son ? ', son gardé' : ''}` : ''}, en ${A.direDuree(r.secondes)}.`);
      for (const a of r.attention ?? []) ecrire(`Attention : ${a}`);
    }
  }
} catch (err) { sortir(err.message); }
