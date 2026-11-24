#!/usr/bin/env node
// Dérush — la commande « derush-toile », donnée à l'IA : une page web qui se dessine elle-même à l'instant t, rendue
// image par image en vidéo. C'est la façon de faire un tableau en mouvement, un dessin qui se trace, de l'encre, des
// particules, tout en code (voir lib/toile.mjs et la compétence tableaux-en-mouvement). Tout le mode d'emploi est dans
// AIDE : l'IA le lit avant de s'en servir.
import fs from 'node:fs';
import path from 'node:path';
import {aide, options} from './commande.mjs';

const AIDE = `derush-toile — une page web qui se dessine, rendue image par image en vidéo : tableaux en mouvement, dessins qui se
tracent, encre, fumée, particules, motion design. Tout se fait sur cet ordinateur, sans Internet.

Usage (depuis le dossier de travail) :
  derush-toile gabarits                              les pages de départ (vide, croquis, particules, encre, tableau…)
  derush-toile gabarit <nom> <dossier>               en copier une dans un dossier neuf (ex. : derush-toile gabarit croquis toile)
  derush-toile bibliotheques                         ce qu'une page peut importer, et la carte d'import à poser dedans
  derush-toile images <page.html> --instants 0.5,2,4.5 [-o dossier] [--planche planche.jpg]
        des images fixes à des instants choisis, et une planche pour tout voir d'un coup d'œil : regarde-la avant de rendre
  derush-toile verifier <page.html> [--boucle] [--json]
        le contrat : la même image deux fois de suite, la même image seule ou après les autres, la couture d'une boucle
  derush-toile rendre <page.html> -o rendu/toile.mp4 [--fps 30] [--duree 8] [--debut 2 --fin 5]
        [--largeur 1080 --hauteur 1920] [--echelle 2] [--flou 8] [--transparent] [--son musique.mp3] [--horloge] [--json]
        la vidéo (MP4 H.264 ; .mov ProRes 4444 ou .webm pour un fond transparent), puis la mesure de son mouvement
  derush-toile mouvement <vidéo.mp4> [--json]         les passages figés et le mouvement seconde par seconde, d'une vidéo finie

Le contrat d'une toile (une page .html) :
  window.toile = {duree: 8, fps: 30, largeur: 1080, hauteur: 1920, boucle: false};
  window.renderAt = (t) => { /* dessine EXACTEMENT l'image de l'instant t, en secondes */ };
  window.__ready = true;                 // quand les polices et les images sont chargées (sinon Dérush attend)
  - renderAt(t) est une fonction pure de t : pas de Date.now, pas de performance.now, pas de requestAnimationFrame qui
    compte, pas de minuterie, pas de hasard sans graine (toile.js : graine(42) remplace Math.random), aucun état gardé
    d'une image à l'autre. Le même t donne toujours la même image, dans n'importe quel ordre.
  - Une simulation (fluide, particules qui s'additionnent) ne peut pas tenir ce contrat : écris window.toile.suite = true.
    Dérush la rend alors dans l'ordre, sans jamais la couper en morceaux, et ton renderAt(t) repart de zéro si t recule.
  - Une boucle : rends les images 0 à N-1, jamais l'image N (ce serait la première une seconde fois). Dérush le fait.
  - Rien ne vient d'Internet : la page est servie depuis son dossier ; les bibliothèques du moteur de rendu sont sous
    /lib/<nom>/ (three, three.quarks, roughjs, simplex-noise, gsap, animejs, regl, zdog, konva, planck, lottie-web) et
    le moteur de dessin de la compétence tableaux-en-mouvement sous /tableaux/. Polices, images : dans le dossier.
  - Une page qui n'a pas ce contrat (animations CSS, GSAP qui joue, requestAnimationFrame) : « --horloge ». Dérush
    avance alors le temps du navigateur à la main, image par image. C'est juste, mais plus lent et sans --debut.

Les options de rendre :
  --fps, --duree, --largeur, --hauteur   par défaut : ce que dit window.toile (sinon 30 images/s, 1920 × 1080)
  --echelle 2          deux fois plus de points (1080p écrit pour 540 de large, ou de la 4K depuis du 1080p)
  --flou 8             flou de mouvement : 8 images mélangées par image (obturateur à 180°) ; 8 fois plus long à rendre
  --transparent        fond transparent (sortie .mov ou .webm) : pour poser la toile par-dessus un plan filmé
  --son fichier        un son posé sous la vidéo (coupé à la durée de la vidéo)
  --parametres "a=1&b=2"   ajoutés à l'adresse de la page (elle les lit avec URLSearchParams)
  --racine dossier     le dossier servi, quand la page lit des fichiers au-dessus d'elle
  --gl logiciel        le dessin 3D calculé sans carte graphique (plus lent ; à essayer si l'image WebGL sort noire)

La méthode (le détail est dans la compétence tableaux-en-mouvement) :
  1. écris la page ; 2. derush-toile images … --planche (regarde la planche, corrige) ; 3. derush-toile verifier ;
  4. derush-toile rendre ; 5. lis la mesure du mouvement : un passage figé qui n'est pas voulu se corrige.
Pour un tableau qui sert de plan dans un montage : rends-le en .mp4 (ou en .mov transparent), puis pose-le dans le
montage comme n'importe quel plan (remotion/public/, ou un <Video> du kit).

Exemple, depuis le dossier de travail :
  derush-toile gabarit croquis toile
  derush-toile images toile/index.html --instants 0.5,1.5,3,5 --planche rendu/controle/toile-planche.jpg
  derush-toile verifier toile/index.html
  derush-toile rendre toile/index.html -o rendu/toile.mp4`;

const args = process.argv.slice(2);
aide(args, AIDE, {siVide: true});
const sortir = (t, code = 1) => { process.stderr.write(`derush-toile : ${t}\n`); process.exit(code); };
const COMMANDES = ['gabarits', 'gabarit', 'bibliotheques', 'images', 'verifier', 'rendre', 'mouvement'];
const commande = args.shift();
if (!COMMANDES.includes(commande)) sortir(`commande inconnue : ${commande}. Celles qui existent : ${COMMANDES.join(', ')} (derush-toile --help).`);

// dans le bac à sable d'une IA (Codex, Gemini), le navigateur sans fenêtre ne démarre pas : la demande passe par le
// relais de Dérush, qui la lance hors du bac à sable, dans le même dossier (comme derush-hyperframes)
if (['gabarit', 'images', 'verifier', 'rendre'].includes(commande) && (process.env.DERUSH_RELAIS_BOITE || process.env.DERUSH_RELAIS) && process.env.DERUSH_RELAIS_JETON) {
  const {fileURLToPath, pathToFileURL} = await import('node:url');
  const corps = {args: [commande, ...args], cwd: process.cwd()};
  let ligne = null;
  try {
    if (process.env.DERUSH_RELAIS_BOITE) {
      const {demanderParBoite} = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'boite.mjs')).href);
      ligne = await demanderParBoite({boite: process.env.DERUSH_RELAIS_BOITE, jeton: process.env.DERUSH_RELAIS_JETON, route: 'toile', corps, surTexte: (t) => process.stderr.write(t)});
    } else {
      const r = await fetch(`${process.env.DERUSH_RELAIS}/toile`, {method: 'POST', headers: {'x-derush-relais': process.env.DERUSH_RELAIS_JETON, 'content-type': 'application/json'}, body: JSON.stringify(corps)});
      const texte = await r.text();
      ligne = texte.split('\n').reverse().find((l) => l.startsWith('##DERUSH-TOILE')) ?? null;
      for (const l of texte.split('\n')) if (l && !l.startsWith('##DERUSH-')) process.stderr.write(`${l}\n`);
    }
  } catch (err) { sortir(`le relais de Dérush n’a pas répondu (${err.message}).`); }
  const r = JSON.parse(/^##DERUSH-TOILE (.*)##\s*$/.exec(String(ligne ?? '').trim())?.[1] ?? '{"ok":false,"message":"le relais de Dérush n’a pas répondu."}');
  if (!r.ok) sortir(r.message);
  process.stdout.write(r.sortie ?? '');
  process.stderr.write(r.erreurs ?? '');
  process.exit(r.code ?? 0);
}

const T = await import('../lib/toile.mjs');
const {opt, drapeau} = options(args);
const json = drapeau('--json');
const nombre = (nom, {min = -Infinity, max = Infinity} = {}) => {
  const v = opt(nom);
  if (v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) sortir(`${nom} attend un nombre${Number.isFinite(min) ? ` de ${min}` : ''}${Number.isFinite(max) ? ` à ${max}` : ''} (reçu : ${v}).`);
  return n;
};
const ecrire = (t) => process.stdout.write(`${t}\n`);
// dans le bac à sable de Codex (sans relais), le bac à sable de Chrome ne démarre pas
const bacASable = !!(process.env.CODEX_SANDBOX || process.env.DERUSH_RELAIS_JETON);
const temps = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
/** Le fichier donné (le premier mot qui n'est pas une option) ; une option inconnue arrête tout, avec son nom. */
const fichierDonne = (quoi, exemple) => {
  const inconnue = args.find((x) => /^--?[a-z]/i.test(x));
  if (inconnue) sortir(`option inconnue : ${inconnue} (derush-toile --help).`);
  if (!args[0]) sortir(`il manque ${quoi} (${exemple}).`);
  return args[0];
};
/** Ce que la page a tenté de charger d'Internet, ce qui manquait, ses erreurs : dit à l'IA, en clair. */
const direPage = (r) => {
  const l = [];
  if (r.manquants?.length) l.push(`Introuvable : ${r.manquants.slice(0, 6).join(' ; ')}.`);
  if (r.refus?.length) l.push(`Refusé (rien ne vient d’Internet : copie ces fichiers dans le dossier de la page) : ${r.refus.slice(0, 6).join(', ')}.`);
  if (r.erreurs?.length) l.push(`Erreurs de la page : ${r.erreurs.slice(0, 5).join(' | ')}`);
  return l;
};

try {
  if (commande === 'gabarits') {
    const g = T.gabarits();
    if (json) ecrire(JSON.stringify(g, null, 2));
    else {
      if (!g.length) sortir('aucune page de départ dans cette version de Dérush.');
      ecrire('Les pages de départ (derush-toile gabarit <nom> <dossier>) :');
      for (const x of g) ecrire(`  ${x.nom.padEnd(12)} ${x.titre}${x.pour ? ` — ${x.pour}` : ''}${x.bibliotheques.length ? ` [${x.bibliotheques.join(', ')}]` : ''}${x.suite ? ' (simulation : se rend dans l’ordre)' : ''}`);
    }
  } else if (commande === 'gabarit') {
    const [nom, dossier] = args;
    const r = T.copierGabarit(nom, dossier);
    if (json) ecrire(JSON.stringify(r, null, 2));
    else {
      ecrire(`Toile créée dans ${path.relative(process.cwd(), r.dossier) || '.'} (page de départ « ${r.gabarit.nom} ») : ${r.fichiers.join(', ')}.`);
      ecrire(`Ensuite : derush-toile images ${path.join(path.relative(process.cwd(), r.dossier) || '.', 'index.html')} --instants 0.5,2,4 --planche rendu/controle/toile-planche.jpg`);
    }
  } else if (commande === 'bibliotheques') {
    const e = T.etatBibliotheques();
    if (json) ecrire(JSON.stringify({bibliotheques: e, carte: T.CARTE_IMPORT}, null, 2));
    else {
      ecrire('Ce qu’une toile peut importer (servi sous /lib/<nom>/, depuis le moteur de rendu de Dérush) :');
      for (const b of e) ecrire(`  ${b.nom.padEnd(18)} ${b.presente ? b.version : 'pas encore installée (Dérush met le moteur à jour au début du prochain montage)'}`);
      ecrire('\nLa carte d’import, à poser dans <head> avant tes scripts :');
      ecrire(`  ${T.baliseCarteImport()}`);
      ecrire('Ensuite, dans <script type="module"> : import * as THREE from \'three\'; import rough from \'roughjs\'; import {createNoise2D} from \'simplex-noise\';');
      ecrire('Les autres (animejs, regl, zdog, konva, planck, lottie-web) : une balise <script src="/lib/<nom>/…"> vers leur fichier de dist.');
    }
  } else if (commande === 'mouvement') {
    const video = fichierDonne('la vidéo', 'derush-toile mouvement rendu/final.mp4');
    if (!fs.existsSync(video)) sortir(`vidéo introuvable : ${video}.`);
    const {mesurerMouvement, direMouvement} = await import('../lib/mouvement.mjs');
    const m = await mesurerMouvement(video);
    if (json) ecrire(JSON.stringify(m, null, 2));
    else {
      if (!m.ok) sortir(m.pourquoi);
      ecrire(`${path.basename(video)} : ${m.duree_s.toFixed(1)} s, ${m.images} images, ${Math.round(m.part_figee * 100)} % d’images qui ne bougent pas.`);
      for (const l of direMouvement(m)) ecrire(l);
    }
  } else {
    // images, verifier, rendre : une page .html
    const communes = {
      racine: opt('--racine'), largeur: nombre('--largeur', {min: 16, max: T.LIMITES.cote}), hauteur: nombre('--hauteur', {min: 16, max: T.LIMITES.cote}),
      gl: opt('--gl'), requete: opt('--parametres') ?? '', bacASable,
    };
    if (communes.gl && communes.gl !== 'logiciel') sortir('--gl attend « logiciel ».');
    if (commande === 'images') {
      const instants = String(opt('--instants') ?? '0').split(/[,; ]+/).filter(Boolean).map((x) => Number(x.replace(',', '.')));
      if (!instants.length || instants.some((x) => !Number.isFinite(x) || x < 0)) sortir('--instants attend des secondes séparées par des virgules (ex. : --instants 0.5,2,4.5).');
      const dossier = opt('-o') ?? opt('--sortie');
      const planche = opt('--planche');
      const echelle = nombre('--echelle', {min: 0.25, max: 4}) ?? 1;
      const transparent = drapeau('--transparent');
      const page = fichierDonne('la page', 'derush-toile images toile/index.html --instants 1,3');
      const cible = dossier ?? path.join(path.dirname(path.resolve(page)), 'images');
      const r = await T.imagesToile({page, instants, dossier: cible, echelle, transparent, ...communes});
      let fichierPlanche = null;
      if (planche) fichierPlanche = await T.plancheToile(r.fichiers, planche, {instants, ratio: r.infos.hauteur / r.infos.largeur});
      if (json) ecrire(JSON.stringify({...r, planche: fichierPlanche}, null, 2));
      else {
        ecrire(`${r.fichiers.length} image${r.fichiers.length > 1 ? 's' : ''} (${Math.round(r.infos.largeur * echelle)} × ${Math.round(r.infos.hauteur * echelle)}) dans ${path.relative(process.cwd(), cible) || '.'} : ${r.fichiers.map((f) => path.basename(f)).join(', ')}`);
        if (fichierPlanche) ecrire(`La planche, à regarder : ${path.relative(process.cwd(), fichierPlanche)}`);
        for (const l of direPage(r)) ecrire(l);
      }
    } else if (commande === 'verifier') {
      const boucle = drapeau('--boucle') ? true : null;
      const fps = nombre('--fps', {min: 1, max: T.LIMITES.fps});
      const duree = nombre('--duree', {min: 0.04, max: T.LIMITES.duree});
      const page = fichierDonne('la page', 'derush-toile verifier toile/index.html');
      const r = await T.verifierToile({page, fps, duree, boucle, ...communes});
      if (json) ecrire(JSON.stringify(r, null, 2));
      else {
        for (const p of r.points) ecrire(`${p.ok ? '✓' : '✗'} ${p.nom} : ${p.detail}`);
        for (const l of direPage(r)) ecrire(l);
        ecrire(r.ok ? 'La toile tient son contrat : tu peux la rendre.' : 'À corriger avant de rendre (ou rends-la telle qu’elle joue, avec --horloge).');
      }
      if (!r.ok) process.exit(2);
    } else {
      const sortie = opt('-o') ?? opt('--sortie');
      if (!sortie) sortir('il manque la sortie (derush-toile rendre toile/index.html -o rendu/toile.mp4).');
      const o = {
        sortie, fps: nombre('--fps', {min: 1, max: T.LIMITES.fps}), duree: nombre('--duree', {min: 0.04, max: T.LIMITES.duree}),
        de: nombre('--debut', {min: 0, max: T.LIMITES.duree}) ?? 0, a: nombre('--fin', {min: 0, max: T.LIMITES.duree}),
        echelle: nombre('--echelle', {min: 0.25, max: 4}) ?? 1, flou: nombre('--flou', {min: 1, max: T.LIMITES.flou}) ?? 1, crf: nombre('--crf', {min: 0, max: 40}) ?? 14,
        son: opt('--son'), transparent: drapeau('--transparent'), horloge: drapeau('--horloge'),
      };
      if (o.son && !fs.existsSync(o.son)) sortir(`son introuvable : ${o.son}.`);
      const page = fichierDonne('la page', 'derush-toile rendre toile/index.html -o rendu/toile.mp4');
      let dernier = 0;
      const r = await T.rendreToile({page, ...o, ...communes, prog: ({image, total}) => {
        // le suivi, sans noyer la sortie : une ligne toutes les 5 secondes au plus
        if (json || (Date.now() - dernier < 5000 && image !== total)) return;
        dernier = Date.now();
        process.stderr.write(`image ${image} / ${total}\n`);
      }});
      let mouvement = null;
      const {mesurerMouvement, direMouvement} = await import('../lib/mouvement.mjs');
      if (!o.transparent) mouvement = await mesurerMouvement(r.sortie).catch((e) => ({ok: false, pourquoi: e.message, attention: []}));
      if (json) ecrire(JSON.stringify({...r, mouvement}, null, 2));
      else {
        ecrire(`Rendu : ${path.relative(process.cwd(), r.sortie)} — ${r.duree.toFixed(2)} s, ${r.largeur} × ${r.hauteur}, ${r.fps} images/s, ${r.images} images${r.flou > 1 ? `, flou de mouvement × ${r.flou}` : ''}${r.transparent ? ', fond transparent' : ''}, en ${r.secondes} s (${r.contrat === 'horloge' ? 'au temps du navigateur' : `window.${r.contrat}(t)`}).`);
        for (const l of direPage(r)) ecrire(l);
        if (mouvement) for (const l of direMouvement(mouvement)) ecrire(l);
        if (r.boucle) ecrire('Boucle : les images 0 à N-1 sont rendues, la dernière s’enchaîne avec la première (derush-toile verifier le mesure).');
      }
    }
  }
} catch (err) { sortir(err.message); }
