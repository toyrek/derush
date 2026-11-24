// Dérush — les gestes de montage qui fabriquent un fichier (Dérush 12) : l'arrêt sur image (une image du rush, figée) et
// le passage à l'envers (lu de la fin vers le début, son compris). Le fichier rejoint les médias du projet, dans un
// dossier à lui (« images figées », « à l’envers ») ; le rush d'origine n'est jamais touché.
// Idées reprises d'Editroom (Robbie Tilton, licence MIT) : figer une image, retourner un plan.
import fs from 'node:fs';
import path from 'node:path';
import {ffmpeg} from './outils.mjs';
import {fichierPourIA} from './medias.mjs';
import {infosVideo, filtresEntree, filtresSortie, ENCODAGE} from './images-video.mjs';
import {slug} from './commun.mjs';

/** Un passage à l'envers dure au plus deux minutes (au-delà, le fichier serait énorme et l'attente longue). */
export const ENVERS_MAX_S = 120;
const dossier = (P, nom) => { const d = path.join(P.racine, nom); fs.mkdirSync(d, {recursive: true}); return d; };
/** Un nom de fichier libre (« -2 », « -3 »… si le nom est pris). */
function libre(f) {
  if (!fs.existsSync(f)) return f;
  const {dir, name, ext} = path.parse(f);
  for (let i = 2; ; i++) { const g = path.join(dir, `${name}-${i}${ext}`); if (!fs.existsSync(g)) return g; }
}
const nomCourt = (m) => slug(path.parse(m.nom).name, 40) || 'plan';
const virgule = (t) => Number(t).toFixed(2).replace('.', ',');

/**
 * Fige l'image d'une vidéo au temps `t` de son fichier : une image PNG en pleine taille, aux couleurs justes (la version
 * de montage pour un rush HDR ou Log). Rend son chemin.
 */
export async function imageFigee(P, m, t) {
  if (m?.type !== 'video') throw new Error('Un arrêt sur image se fait sur une vidéo.');
  const src = await fichierPourIA(P, m);
  const info = await infosVideo(src);
  const fin = Math.max(0, (m.duree ?? info.duree ?? 0) - 1 / (m.fps || info.fps?.valeur || 30));
  const tt = Math.max(0, Math.min(Number(t) || 0, fin));
  const {filtres} = await filtresEntree(info);
  const sortie = libre(path.join(dossier(P, 'images figées'), `${nomCourt(m)}-${virgule(tt)}s.png`));
  await ffmpeg(['-y', '-v', 'error', '-ss', tt.toFixed(3), '-i', src, '-frames:v', '1', '-vf', [...filtres, 'format=rgb24'].join(','), sortie]);
  if (!fs.existsSync(sortie)) throw new Error('L’image n’a pas pu être figée.');
  return sortie;
}

/**
 * Retourne un passage (de `entree` à `sortie`, en secondes du fichier) : l'image lue de la fin vers le début, et le son
 * aussi. La vidéo est retournée par morceaux (une seconde de 4K tient en mémoire, une minute non), puis recollée ; le
 * son est retourné d'un seul coup. Rend le chemin du fichier.
 */
export async function passageALEnvers(P, m, entree, sortie, prog = () => {}) {
  if (m?.type !== 'video' && m?.type !== 'audio') throw new Error('Seule une vidéo ou un son se lit à l’envers.');
  const a = Math.max(0, Number(entree) || 0);
  const b = Math.min(Number(sortie) || 0, m.duree ?? Infinity);
  const duree = b - a;
  if (!(duree > 0.04)) throw new Error('Le passage est vide.');
  if (duree > ENVERS_MAX_S) throw new Error(`À l’envers, un passage dure au plus ${ENVERS_MAX_S / 60} minutes (celui-ci : ${Math.round(duree)} s). Coupe-le d’abord.`);
  const ext = m.type === 'video' ? 'mp4' : 'm4a';
  const fin = libre(path.join(dossier(P, 'à l’envers'), `${nomCourt(m)}-${virgule(a)}-${virgule(b)}-envers.${ext}`));
  const travail = fs.mkdtempSync(path.join(path.dirname(fin), '.envers-'));
  try {
    if (m.type === 'audio') {
      await ffmpeg(['-y', '-v', 'error', '-ss', a.toFixed(3), '-t', duree.toFixed(3), '-i', m.chemin, '-af', 'areverse', '-c:a', 'aac', '-b:a', '256k', fin]);
      return fin;
    }
    const src = await fichierPourIA(P, m);
    const info = await infosVideo(src);
    const {filtres} = await filtresEntree(info);
    const fps = info.fps?.valeur || m.fps || 30;
    const cadence = info.fps?.texte || String(fps);
    // des morceaux qui tiennent en mémoire : environ 400 Mo d'images chacun (une seconde de 4K, quatre de 1080p)
    const pixels = (info.largeur || 1920) * (info.hauteur || 1080) * 1.5;
    const morceau = Math.max(0.5, Math.min(4, 4e8 / (pixels * fps)));
    const n = Math.ceil(duree / morceau - 1e-6);
    const parts = [];
    for (let k = 0; k < n; k++) {
      // le morceau k de la vidéo retournée : la fin du passage d'abord
      const fb = b - k * morceau;
      const fa = Math.max(a, fb - morceau);
      const f = path.join(travail, `p${String(k).padStart(4, '0')}.mp4`);
      await ffmpeg(['-y', '-v', 'error', '-ss', fa.toFixed(3), '-t', (fb - fa).toFixed(3), '-i', src, '-map', '0:v:0', '-an',
        '-vf', [...filtres, 'reverse', ...filtresSortie()].join(','), '-r', cadence, ...ENCODAGE, f]);
      parts.push(f);
      prog((k + 1) / (n + 1));
    }
    const liste = path.join(travail, 'liste.txt');
    fs.writeFileSync(liste, parts.map((f) => `file '${f.replace(/'/g, `'\\''`)}'`).join('\n'));
    const muet = path.join(travail, 'image.mp4');
    await ffmpeg(['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', muet]);
    if (info.son) {
      await ffmpeg(['-y', '-v', 'error', '-i', muet, '-ss', a.toFixed(3), '-t', duree.toFixed(3), '-i', src, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
        '-af', 'areverse', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', fin]);
    } else fs.renameSync(muet, fin);
    prog(1);
    return fin;
  } finally {
    fs.rmSync(travail, {recursive: true, force: true});
  }
}
