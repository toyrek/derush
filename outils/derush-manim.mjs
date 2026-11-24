#!/usr/bin/env node
// Dérush — la commande « derush-manim », donnée à l'IA : Manim (MIT), des animations de maths et de schémas écrites
// en Python. Installé à la demande, dans un Python à part (lib/manim.mjs). Tout le mode d'emploi est dans AIDE.
import path from 'node:path';
import {aide, options} from './commande.mjs';

const M = await import('../lib/manim.mjs');

const AIDE = `derush-manim — Manim : des animations de maths et de schémas écrites en Python (courbes, graphiques, axes, formes qui
se transforment, textes), rendues en vidéo. Il n'est pas livré avec Dérush : il s'installe à la demande, une seule fois.

Usage (depuis le dossier de travail) :
  derush-manim etat                       installé ou non, sa version, et si LaTeX est là pour les formules
  derush-manim installer                  l'installe (environ 350 Mo, dans le dossier de Dérush ; il faut Internet)
  derush-manim rendre <scene.py> <NomDeLaScene> -o rendu/maths.mp4
        [--qualite brouillon|moyenne|haute|4k] [--fps 30] [--transparent]
        brouillon : 854 × 480 à 15 images/s (pour regarder vite) ; haute : 1920 × 1080 à 60 ; 4k : 3840 × 2160
        une sortie .png : seulement la dernière image de la scène, pour vérifier le cadre avant de rendre
        --transparent avec une sortie .mov : pour poser l'animation par-dessus un plan

Quand s'en servir : la personne veut des maths animées, une courbe qui se trace, un graphique qui se construit, une
démonstration. N'installe Manim que pour cela (c'est gros) ; pour un simple titre ou un schéma, une toile
(derush-toile) ou HyperFrames suffit.

Une scène, dans scene.py :
  from manim import *
  class Courbe(Scene):
      def construct(self):
          axes = Axes(x_range=[-3, 3], y_range=[-1, 5])
          courbe = axes.plot(lambda x: x ** 2, color=YELLOW)
          self.play(Create(axes), run_time=1)
          self.play(Create(courbe), run_time=2)
          self.wait(0.5)

Ce qu'il faut savoir :
  - Sur Mac et sous Linux, la documentation de Manim demande d'abord des bibliothèques du système (Cairo et
    pkg-config). Dérush n'installe rien sur le système : « derush-manim etat » dit ce qui manque et la commande de la
    documentation. Ne la lance jamais toi-même : dis-la à la personne, c'est à elle de décider.
  - Les formules écrites en LaTeX (MathTex, Tex) demandent une distribution LaTeX sur l'ordinateur : « derush-manim
    etat » dit si elle est là. Dérush ne l'installe pas. Sans elle, écris avec Text("x² + 1") ou dessine la formule
    dans une toile ; tout le reste de Manim marche.
  - Un format vertical : config.pixel_width, config.pixel_height = 1080, 1920 et config.frame_width = 9, en haut de
    scene.py (avant la classe).
  - Regarde avant de livrer : rends d'abord en brouillon, sors des images (ffmpeg, ou une sortie .png), puis en haute.
  - La vidéo rendue se pose dans le montage comme un plan (remotion/public/), ou devient rendu/final.mp4.

Exemple :
  derush-manim etat
  derush-manim rendre maths/scene.py Courbe -o rendu/controle/courbe.png
  derush-manim rendre maths/scene.py Courbe -o rendu/courbe.mp4 --qualite haute`;

const args = process.argv.slice(2);
aide(args, AIDE, {siVide: true});
const sortir = (t, code = 1) => { process.stderr.write(`derush-manim : ${t}\n`); process.exit(code); };
const commande = args.shift();
const {opt, drapeau} = options(args);
const json = drapeau('--json');
const ecrire = (t) => process.stdout.write(`${t}\n`);

try {
  if (commande === 'etat') {
    const e = M.etatManim();
    if (json) ecrire(JSON.stringify(e, null, 2));
    else {
      ecrire(e.ok ? `Manim ${e.version} est installé.` : e.prerequis?.ok === false ? e.pourquoi : 'Manim n’est pas installé : « derush-manim installer » (environ 350 Mo, une seule fois, il faut Internet).');
      ecrire(e.latex ? 'LaTeX est sur cet ordinateur : les formules (MathTex, Tex) marchent.' : 'LaTeX n’est pas sur cet ordinateur : pas de MathTex ni de Tex. Text, les formes, les axes, les courbes et les graphiques marchent.');
    }
  } else if (commande === 'installer') {
    let dernier = -1;
    const e = await M.installerManim((p) => { const pc = Math.round(p * 100); if (pc !== dernier && !json) process.stderr.write(`installation : ${pc} %\n`); dernier = pc; });
    if (json) ecrire(JSON.stringify(e, null, 2));
    else ecrire(`Manim ${e.version} est installé.${e.latex ? '' : ' LaTeX n’est pas sur cet ordinateur : pas de MathTex ni de Tex (écris avec Text).'}`);
  } else if (commande === 'rendre') {
    const sortie = opt('-o') ?? opt('--sortie');
    const qualite = opt('--qualite') ?? 'haute';
    const fps = opt('--fps');
    const transparent = drapeau('--transparent');
    const inconnue = args.find((x) => /^--?[a-z]/i.test(x));
    if (inconnue) sortir(`option inconnue : ${inconnue} (derush-manim --help).`);
    const [fichier, scene] = args;
    const r = await M.rendreManim({fichier, scene, sortie, qualite, fps: fps ? Number(fps) : null, transparent, surTexte: (t) => { if (!json) process.stderr.write(t); }});
    if (json) ecrire(JSON.stringify(r, null, 2));
    else ecrire(`Rendu : ${path.relative(process.cwd(), r.sortie)}, en ${r.secondes} s.`);
  } else sortir(`commande inconnue : ${commande ?? '(aucune)'}. Celles qui existent : etat, installer, rendre (derush-manim --help).`);
} catch (err) { sortir(err.message); }
