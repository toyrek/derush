#!/usr/bin/env node
// Dérush — la commande « derush-effacer », donnée à l'IA : effacer le texte incrusté d'un rush (sous-titres d'une appli,
// titre, filigrane) pour le remonter propre (lib/effaceur.mjs, outils/effacer.py). Tout le mode d'emploi est dans AIDE.
import path from 'node:path';
import {aide, options} from './commande.mjs';

const AIDE = `derush-effacer — effacer le texte incrusté d'une vidéo (sous-titres d'une appli, titre, filigrane).

Usage :
  derush-effacer <vidéo> -o <sortie.mp4> [--de S] [--a S] [--zone x,y,l,h] [--methode auto|lama|telea]

  --de, --a     le passage à traiter, en secondes (le reste est recopié tel quel). Traite seulement ce que tu montes :
                LaMa prend environ 0,8 s par image (10 minutes pour 30 s de vidéo) ; Telea est quinze fois plus rapide.
  --zone        la bande à vider, en fractions de l'image (x,y,largeur,hauteur : « 0.05,0.70,0.90,0.18 » pour le bas) ;
                sans elle, Apple Vision (sur Mac) trouve chaque ligne de texte d'au moins 2,2 % de la hauteur. Donne une
                zone pour ne pas effacer le texte filmé (une enseigne, un livre), ou quand Vision n'est pas là.
  --methode     auto (LaMa si installé, sinon Telea), lama, telea (bien sur un fond uni ou flou).

Le son est recopié tel quel ; la sortie est un MP4 H.264 de la même taille et à la même cadence. Regarde des images
avant et après (la planche de derush-controle, ou ffmpeg) : un visage caché par le texte ne se reconstitue pas, et un
fond très détaillé peut garder une trace ; dans ce cas, recadre ou couvre la zone d'un vrai titre.
L'analyse de Dérush dit déjà où est le texte incrusté de chaque rush (« incrustes » dans analyse/<rush>.json).

Exemple :
  derush-effacer plans/M3-capcut.mp4 -o plans/M3-propre.mp4 --de 2 --a 9.5
Réponse en JSON : ok, images, effacees (les images touchées), methode, lecture (vision ou zone), duree_s.`;

const args = process.argv.slice(2);
aide(args, AIDE, {siVide: true});
const {opt} = options(args);
const sortir = (o, code = 0) => { console.log(JSON.stringify(o, null, 2)); process.exit(code); };
const entree = args.find((x, i) => !x.startsWith('-') && !['-o', '--de', '--a', '--zone', '--methode', '--sortie'].includes(args[i - 1]));
const sortie = opt('-o') ?? opt('--sortie');
if (!entree || !sortie) sortir({erreur: 'Usage : derush-effacer <vidéo> -o <sortie.mp4> [--de S] [--a S] (derush-effacer --help)'}, 1);
const methode = opt('--methode') ?? 'auto';
// chaque option lue une seule fois (options() la retire de la liste)
const de = Number(opt('--de') ?? 0);
const aBrut = opt('--a');
const a = aBrut != null ? Number(aBrut) : null;
const zone = opt('--zone');
if (!Number.isFinite(de) || (a != null && !(Number.isFinite(a) && a > de))) sortir({erreur: '--de et --a : des secondes, avec --a plus grand que --de.'}, 1);
if (!['auto', 'lama', 'telea'].includes(methode)) sortir({erreur: '--methode : auto, lama ou telea.'}, 1);
try {
  const {effacer} = await import('../lib/effaceur.mjs');
  const r = await effacer(path.resolve(entree), path.resolve(sortie), {de, a, zone, methode}, (p) => process.stderr.write(`progress=${Math.round(p * 100)}%\n`));
  sortir(r);
} catch (e) {
  sortir({erreur: e.message}, 1);
}
