#!/usr/bin/env node
// Dérush — la commande « derush-image », donnée au monteur en Mode Hollywood : ChatGPT, le graphiste de l'équipe,
// dessine ce qui manque au montage (lib/graphiste.mjs). Tout le mode d'emploi est dans AIDE.
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {aide} from './commande.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const AIDE = `derush-image — ChatGPT, le graphiste de ton équipe (Mode Hollywood), dessine ce qui manque à ton montage.

Usage :
  derush-image "ce qu'il faut dessiner" [--transparent] [--format carre|vertical|horizontal|large] [-o chemin.png]
  derush-image "ce qu'il faut dessiner" --variantes 3 [-o dossier]          plusieurs propositions, pour choisir
  derush-image --anime "ce qui bouge" [--images 8] [--fps 10] [-o dossier] une petite animation en boucle
  derush-image … --ref <image> [--ref <image>]                              garder un style, un personnage, des couleurs

Ce que tu peux demander : un autocollant ou un émoji maison, une illustration, un objet, un fond, un personnage, une
icône dessinée, une flèche ou une bulle dessinées à la main, un décor ; --anime fait une planche de sprites (une grille
de 2 à 16 images : un personnage qui court, un cœur qui bat, une étoile qui scintille), que Dérush découpe.

  --transparent   fond transparent, pour poser l'image sur la vidéo : Dérush efface le voile autour du dessin et le
                  recadre au plus près (--anime est transparent de lui-même ; --opaque pour un fond plein)
  --format        carre (défaut du modèle), vertical (2:3, pour une vidéo 9:16), horizontal (3:2), large (16:9)
  --variantes N   de 1 à 4 propositions (dans un dossier : variante-1.png…)
  --anime         une animation : --images 2 à 16 (arrondi à une grille : 2, 3, 4, 6, 8, 9, 12, 16 ; 8 par défaut),
                  --fps 1 à 30 (10 par défaut). Dérush rend f-01.png… (même taille, même cadre), animation.gif (en
                  boucle) et planche.png
  --ref <image>   jusqu'à 3 images du dossier de travail que ChatGPT regarde avant de dessiner (PNG, JPEG, WebP)
  -o <chemin>     où ranger, dans le dossier de travail (défaut : remotion/public/ia/<nom tiré de la description>)

Les images arrivent dans remotion/public/ia/ : dans Remotion, staticFile("ia/<nom>.png") ; pour HyperFrames, copie-les
dans le dossier de ta composition. Une image prend 30 s à 1 min (une animation, un peu plus) : demande seulement ce qui
sert la vidéo, avec une description précise (sujet, style, couleurs de la marque, cadrage). Regarde chaque image avant
de t'en servir ; si elle cloche, redemande avec une description plus précise.

Règles : jamais de logo, de personnage ou d'œuvre d'une vraie marque, ni le visage d'une personne réelle ; pas de texte
dans l'image (écris tes textes dans le montage), sauf un mot dessiné à la main s'il est demandé. ChatGPT dessine avec
le forfait ChatGPT de la personne : si son quota est atteint, la commande le dit, dessine alors autrement (SVG, formes
du kit, HyperFrames).

Exemples, depuis le dossier de travail :
  derush-image "autocollant d'un pouce levé, style dessin plat, jaune et noir, contour blanc épais" --transparent
  derush-image "fond dégradé violet et orange avec des confettis, sans texte" --format vertical
  derush-image --anime "un petit renard orange qui court de profil, style dessin plat" --images 8 --fps 12
  derush-image "le même personnage qui fait un clin d'œil" --transparent --ref remotion/public/ia/mascotte.png`;

const args = process.argv.slice(2);
aide(args, AIDE, {siVide: true});
const sortir = (t, code = 1) => { process.stderr.write(`derush-image : ${t}\n`); process.exit(code); };
const G = await import(pathToFileURL(path.join(ICI, '..', 'lib', 'graphiste.mjs')).href);

// Dans un bac à sable (Codex, Gemini), Codex ne peut pas être relancé : la demande passe par le relais de Dérush, qui
// fait dessiner ChatGPT hors du bac à sable et range les images dans le même dossier de travail.
if ((process.env.DERUSH_RELAIS_BOITE || process.env.DERUSH_RELAIS) && process.env.DERUSH_RELAIS_JETON) {
  const corps = {args, cwd: process.cwd()};
  let ligne = null;
  try {
    if (process.env.DERUSH_RELAIS_BOITE) {
      const {demanderParBoite} = await import(pathToFileURL(path.join(ICI, '..', 'lib', 'boite.mjs')).href);
      ligne = await demanderParBoite({boite: process.env.DERUSH_RELAIS_BOITE, jeton: process.env.DERUSH_RELAIS_JETON, route: 'image', corps, surTexte: (t) => process.stderr.write(t)});
    } else {
      const r = await fetch(`${process.env.DERUSH_RELAIS}/image`, {method: 'POST', headers: {'x-derush-relais': process.env.DERUSH_RELAIS_JETON, 'content-type': 'application/json'}, body: JSON.stringify(corps)});
      const texte = await r.text();
      ligne = texte.split('\n').reverse().find((l) => l.startsWith('##DERUSH-IMAGE')) ?? null;
      if (!ligne && texte.trim()) sortir(texte.trim().split('\n').at(-1));
    }
  } catch (err) { sortir(`le relais de Dérush n’a pas répondu (${err.message}).`); }
  const r = JSON.parse(/^##DERUSH-IMAGE (.*)##\s*$/.exec(String(ligne ?? '').trim())?.[1] ?? '{"ok":false,"message":"le relais de Dérush n’a pas répondu."}');
  if (!r.ok) sortir(r.message);
  process.stdout.write(`${r.texte}\n`);
  process.exit(0);
}

// Directement (Claude) : Dérush a donné le chemin de Codex au monteur seulement si ChatGPT est dans l'équipe
const codex = process.env.DERUSH_GRAPHISTE;
if (!codex) sortir('ChatGPT n’est pas dans ton équipe en ce moment (Mode Hollywood coupé, Codex pas connecté, ou son quota atteint) : dessine autrement (SVG, formes du kit, HyperFrames).');
const atelier = G.racineAtelier(process.cwd());
let d;
try { d = G.lireArguments(args, {atelier, cwd: process.cwd()}); } catch (err) { sortir(err.message); }
process.stderr.write(d.anime ? `ChatGPT dessine une planche de ${d.anime.images} images…\n` : `ChatGPT dessine${d.variantes > 1 ? ` ${d.variantes} variantes` : ''}…\n`);
const signe = setInterval(() => process.stderr.write('.'), 10000);
try {
  const r = await G.dessiner(d, {codex, modele: process.env.DERUSH_GRAPHISTE_MODELE || null});
  clearInterval(signe);
  G.noterDessin(atelier, d, r);
  process.stdout.write(`${G.compteRendu(r, atelier)}\n`);
} catch (err) {
  clearInterval(signe);
  sortir(err.message);
}
