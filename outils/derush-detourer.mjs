#!/usr/bin/env node
// Dérush — la commande « derush-detourer », donnée à l'IA (et utilisable à la main) : la personne filmée, détourée image
// par image avec Apple Vision (sur le Mac, rien n'est envoyé en ligne), pour passer un titre DERRIÈRE elle.
//   derush-detourer <vidéo> [--de s] [--a s] [--sortie dossier] [--cote 1920]
// Écrit d_<n>.webp (l'image et sa transparence, n = numéro de l'image dans la vidéo) et detourage.json. Dans un pack, le
// dossier va dans remotion/public/detourage/ : la pièce <PersonneDevant> du kit (remotion/src/pieces) le pose au-dessus
// du titre, au même cadrage que la vidéo. La réponse (JSON) donne la ligne à coller.
import fs from 'node:fs';
import path from 'node:path';
import {aide, options} from './commande.mjs';

const AIDE = `derush-detourer — la personne filmée, détourée image par image (Apple Vision, sur le Mac).
Pour passer un titre DERRIÈRE la personne : la vidéo, puis le titre, puis la personne détourée par-dessus.

Usage :
  derush-detourer <vidéo> [--de s] [--a s] [--sortie dossier] [--cote 1920]

  --de, --a   le passage, en secondes DANS LA VIDÉO donnée (par défaut : toute la vidéo, 40 s au plus)
  --sortie    le dossier des images (par défaut, dans un pack : remotion/public/detourage/<vidéo>-<de>-<a>)
  --cote      le plus grand côté des images (1920 par défaut ; 1080 va deux fois plus vite)

Exemple, dans le pack :
  derush-detourer plans/M1-chronique.mp4 --de 0.2 --a 2.8
puis dans le kit (la réponse donne la ligne exacte) :
  <Video src={staticFile('plans/M1-chronique.mp4')} trimBefore={6} />
  <TitreGeant texte="RÉCEPTION PRESSE" />
  <PersonneDevant dossier="detourage/m1-chronique-0.2-2.8" fps={30} premiere={6} derniere={84} debutSource={0.2} />

Compte environ 0,3 s par image (2,6 s de vidéo à 30 images/s : 25 s), deux fois moins avec --cote 1080.
Réponse en JSON ; code 1 en cas d'erreur.`;

const args = process.argv.slice(2);
aide(args, AIDE);
const {opt} = options(args);
const sortir = (o, code = 0) => { console.log(JSON.stringify(o, null, 2)); process.exit(code); };
try {
  const de = opt('--de');
  const a = opt('--a');
  const cote = Math.max(256, Math.min(4096, Math.round(Number(opt('--cote') ?? 1920)) || 1920));
  let sortie = opt('--sortie');
  const video = args.find((x) => !x.startsWith('--'));
  if (!video) throw new Error('Usage : derush-detourer <vidéo> [--de s] [--a s] [--sortie dossier] (derush-detourer --help)');
  if (!fs.existsSync(video)) throw new Error(`Vidéo introuvable : ${video}`);
  const {sonder} = await import('../lib/medias.mjs');
  const {decoupesFichier} = await import('../lib/detourage.mjs');
  const {slug} = await import('../lib/commun.mjs');
  const info = await sonder(path.resolve(video));
  if (info.type !== 'video') throw new Error('Ce fichier n’est pas une vidéo : il n’y a personne à détourer.');
  const fps = info.fps || 30;
  const derniereImage = Math.max(0, Math.floor(info.duree * fps) - 1);
  const t0 = Math.max(0, Number(de ?? 0) || 0);
  const t1 = Math.min(info.duree, a != null ? Number(a) : info.duree);
  if (!(t1 > t0)) throw new Error(`Passage vide : --de ${t0} --a ${t1} (la vidéo dure ${info.duree} s).`);
  const i0 = Math.max(0, Math.floor(t0 * fps));
  const i1 = Math.min(derniereImage, Math.ceil(t1 * fps));
  const n = i1 - i0 + 1;
  if (n > 1200) throw new Error(`${n} images : c'est trop d'un coup (40 s au plus à 30 images/s). Détoure seulement le passage du titre (--de, --a).`);
  // dans un pack, les images vont où le kit les lit (remotion/public)
  const pack = fs.existsSync('montage.json') && fs.existsSync(path.join('remotion', 'public')) ? path.resolve('.') : null;
  const nom = `${slug(path.basename(video).replace(/\.[^.]+$/, ''), 30) || 'video'}-${+t0.toFixed(2)}-${+t1.toFixed(2)}`;
  if (!sortie) sortie = pack ? path.join(pack, 'remotion', 'public', 'detourage', nom) : path.join('detourage', nom);
  sortie = path.resolve(sortie);
  const debut = Date.now();
  let dernier = -1;
  // la cadence qui a servi à compter i0 et i1 : detourer.py se place juste avant l'image i0 au lieu de décoder la vidéo
  // depuis le début (sans elle, il relit la cadence dans le fichier lui-même)
  await decoupesFichier(path.resolve(video), sortie, i0, i1, (p) => {
    const pct = Math.floor((Number(p) || 0) * 100);
    if (pct >= dernier + 20) { dernier = pct; process.stderr.write(`détourage : ${pct} %\n`); }
  }, fps);
  const faites = fs.readdirSync(sortie).filter((f) => /^d_\d+\.webp$/.test(f)).map((f) => Number(f.slice(2, -5))).sort((x, y) => x - y);
  if (!faites.length) throw new Error('Aucune image détourée : Apple Vision n’a rien rendu.');
  const pub = path.join(pack ?? '', 'remotion', 'public');
  const publicRel = pack && sortie.startsWith(pub + path.sep) ? path.relative(pub, sortie).split(path.sep).join('/') : null;
  const infos = {video: path.resolve(video), fps, premiere: faites[0], derniere: faites[faites.length - 1], images: faites.length, de_s: t0, a_s: t1,
    largeur: info.largeur, hauteur: info.hauteur, motif: 'd_%05d.webp', cree_le: new Date().toISOString()};
  fs.writeFileSync(path.join(sortie, 'detourage.json'), JSON.stringify(infos, null, 2));
  sortir({
    ok: true, dossier: path.relative(process.cwd(), sortie) || '.', public: publicRel, ...infos, video: path.relative(process.cwd(), infos.video),
    duree_s: Math.round((Date.now() - debut) / 100) / 10,
    piece: publicRel
      ? `<PersonneDevant dossier="${publicRel}" fps={${+fps.toFixed(3)}} premiere={${infos.premiere}} derniere={${infos.derniere}} debutSource={/* temps de la vidéo au début de la Sequence, en s */ ${+t0.toFixed(3)}} />`
      : null,
    conseil: 'Ordre des calques : la vidéo, puis le titre, puis <PersonneDevant> avec le même cadrage (style) que la vidéo. Regarde une image en pleine taille (node remotion/images.mjs --images …) : les bords des cheveux et des mains.',
  });
} catch (e) {
  sortir({erreur: e.message}, 1);
}
