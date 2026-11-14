#!/usr/bin/env node
// Dérush — la commande « derush-controle », donnée à l'IA (et utilisable à la main) : le contrôle d'une vidéo finie,
// sur le Mac, avant de la livrer. Tout le mode d'emploi est dans AIDE (derush-controle --help).
import fs from 'node:fs';
import path from 'node:path';
import {aide, options} from './commande.mjs';

const AIDE = `derush-controle — le contrôle d'une vidéo finie, avant de la livrer (sur le Mac, rien n'est envoyé en ligne).

Usage :
  derush-controle <vidéo.mp4> [--pack dossier] [--textes fichier]… [--plateforme tiktok|reels|shorts|youtube|libre]
                  [--ips 3] [--langue fr] [--sans-rythme] [--sans-voix] [--sortie dossier]

Ce qu'il regarde :
  1. Les textes à l'écran (Apple Vision lit 3 images par seconde) — À CORRIGER :
     - les mots collés (« cettecollection » : un contour épais mange l'espace entre les mots) ;
     - un texte coupé au bord de l'image (« DEKO » pour « HIDEKO ») ;
     et à regarder : un texte du montage sous l'interface du réseau, ou qui touche le bord.
     Seuls les mots du montage sont jugés (ce qui est dit, sous-titres, titres, table de montage, textes du kit) :
     le texte filmé dans les rushes (une page, un livre, une enseigne) ne l'est jamais.
  2. L'accroche : le plus grand texte des 2 premières secondes. Sous 7 % de la hauteur de l'image, elle est discrète.
  3. La voix : ses aigus (brillance, entre −15 et −11 dB pour une voix nette ; sous −16 : sourde).
  4. Le rythme (Whisper réécoute la vidéo) : un début qui tarde, les pauses de plus de 0,7 s, les « euh », les redites
     (les mêmes 4 mots deux fois), les mots repris, et le temps qu'on pourrait gagner.
  Les points 2 à 4 sont « à regarder » : décide en les voyant (une pause sur une image forte peut rester).

Par défaut, le pack est le dossier courant s'il contient montage.json (réseau et langue lus dedans). Une planche des
images en cause est écrite dans --sortie (par défaut rendu/controle/ du pack) : regarde-la.

Exemple, depuis le pack :
  derush-controle rendu/final.mp4

Réponse en JSON : a_corriger (à corriger avant de livrer), a_regarder (à juger), et le détail par partie (textes,
accroche, voix, rythme). Code 2 s'il reste quelque chose à corriger, 0 sinon, 1 en cas d'erreur.
Compte 20 à 40 s pour une vidéo d'une minute (le rythme en prend la moitié ; --sans-rythme pour aller plus vite).`;

const args = process.argv.slice(2);
aide(args, AIDE, {siVide: true});
const {opt, drapeau} = options(args);
const sortir = (o, code = 0) => { console.log(JSON.stringify(o, null, 2)); process.exit(code); };
try {
  const textes = [];
  for (let t = opt('--textes'); t; t = opt('--textes')) textes.push(path.resolve(t));
  let pack = opt('--pack');
  if (!pack && fs.existsSync('montage.json')) pack = '.';
  pack = pack ? path.resolve(pack) : null;
  let plateforme = opt('--plateforme');
  let langue = opt('--langue');
  if (pack) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(pack, 'montage.json'), 'utf8'));
      plateforme ??= m.style?.plateforme ?? m.habillage?.style?.plateforme ?? (m.sortie?.hauteur > m.sortie?.largeur ? 'tiktok' : null);
      langue ??= m.projet?.langue ?? m.langue ?? null;
    } catch { /* pas de montage.json lisible */ }
  }
  const ips = Number(opt('--ips') ?? 3);
  const sansRythme = drapeau('--sans-rythme');
  const sansVoix = drapeau('--sans-voix');
  const sortie = path.resolve(opt('--sortie') ?? (pack ? path.join(pack, 'rendu', 'controle') : 'controle'));
  const video = args.find((x) => !x.startsWith('--'));
  if (!video) throw new Error('Usage : derush-controle <vidéo.mp4> [--pack dossier] [--plateforme tiktok] (derush-controle --help)');
  if (!fs.existsSync(video)) throw new Error(`Vidéo introuvable : ${video}`);
  const {controlerTextes} = await import('../lib/controle.mjs');
  const {brillance, avisBrillance} = await import('../lib/son.mjs');
  const {controlerRythme} = await import('../lib/rythme.mjs');
  const v = path.resolve(video);
  // les trois contrôles en même temps : Apple Vision, FFmpeg et Whisper ne se gênent pas
  const [r, b, ry] = await Promise.all([
    controlerTextes(v, {pack, textes, plateforme, ips: Math.min(10, Math.max(0.5, ips || 3)), sortie}),
    sansVoix ? null : brillance(v),
    sansRythme ? null : controlerRythme(v, {langue: langue || 'fr'}).catch((e) => ({ok: false, pourquoi: e.message, attention: []})),
  ]);
  const voix = sansVoix ? null : {brillance_db: b, avis: avisBrillance(b)};
  const aCorriger = r.ok ? r.phrases.slice(0, r.problemes.length) : [];
  const aRegarder = [
    ...(r.ok ? r.phrases.slice(r.problemes.length) : []),
    ...(voix?.avis ? [voix.avis] : []),
    ...(ry?.ok ? ry.attention : []),
  ];
  const nonFait = [r.ok ? null : `Textes : ${r.pourquoi}`, ry && !ry.ok ? `Rythme : ${ry.pourquoi}` : null].filter(Boolean);
  const bilan = aCorriger.length ? `${aCorriger.length} problème(s) à corriger avant de livrer.`
    : aRegarder.length ? `Rien de sûr à corriger ; ${aRegarder.length} point(s) à regarder.`
      : 'Aucun mot collé, aucun texte coupé ni caché ; accroche, voix et rythme sans remarque.';
  const {phrases: _p, ...textesDetail} = r;
  sortir({ok: r.ok, bilan, a_corriger: aCorriger, a_regarder: aRegarder, ...(nonFait.length ? {non_controle: nonFait} : {}),
    ...textesDetail, voix, rythme: ry, phrases: r.phrases ?? []}, aCorriger.length ? 2 : 0);
} catch (e) {
  sortir({erreur: e.message}, 1);
}
