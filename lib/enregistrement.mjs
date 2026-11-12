// Dérush — enregistrer depuis l'ordinateur, sans quitter le logiciel : sa voix (micro) ou soi-même (webcam + micro).
// La fenêtre enregistre et envoie le son ou l'image ici, morceau par morceau (un long podcast ne tient pas en mémoire,
// et rien n'est perdu si la fenêtre se ferme). À la fin, Dérush range le fichier dans le projet (enregistrements/), le
// met au propre avec FFmpeg (un .m4a pour une voix, un .mp4 à cadence fixe pour une vidéo) et l'ajoute aux médias.
// Rien ne sort de l'ordinateur.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {lancer, FFMPEG} from './outils.mjs';
import {ajouterMedias} from './medias.mjs';

/** Ce qu'on peut enregistrer : « voix » (un son, pour une voix off) et « camera » (une vidéo, pour un podcast ou un face caméra). */
export const GENRES_ENREGISTREMENT = {voix: {nom: 'Voix off', prefixe: 'voix-off', ext: 'm4a'}, camera: {nom: 'Caméra', prefixe: 'camera', ext: 'mp4'}};
const TAILLE_MAX = 40e9; // 40 Go : plusieurs heures de vidéo
const EN_COURS = new Map(); // id → {racine, genre, brut, n, octets, fd, debut}

const horodatage = (d = new Date()) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
/** L'extension du fichier brut, d'après ce que la fenêtre dit enregistrer (Safari et l'app Mac : mp4 ; Chrome : webm). */
const extBrute = (mime) => (/mp4|m4a|aac|quicktime/i.test(mime) ? 'mp4' : /ogg/i.test(mime) ? 'ogg' : /wav/i.test(mime) ? 'wav' : 'webm');

/** Commence un enregistrement dans ce projet. Renvoie son identifiant (à redonner avec chaque morceau). */
export function commencerEnregistrement(P, {genre, mime = ''} = {}) {
  if (!GENRES_ENREGISTREMENT[genre]) throw new Error('Genre d’enregistrement inconnu.');
  const dossier = path.join(P.racine, 'enregistrements');
  fs.mkdirSync(dossier, {recursive: true});
  const id = crypto.randomBytes(8).toString('hex');
  const base = `${GENRES_ENREGISTREMENT[genre].prefixe}-${horodatage()}`;
  const brut = path.join(dossier, `.${base}.brut.${extBrute(String(mime))}`);
  // écrit tout de suite sur le disque, morceau après morceau : si Dérush s'arrête en pleine prise, ce qui a été dit est là
  EN_COURS.set(id, {racine: P.racine, genre, base, dossier, brut, n: 0, octets: 0, fd: fs.openSync(brut, 'w'), debut: Date.now()});
  return {id};
}

/** Ajoute un morceau (dans l'ordre : n = 0, 1, 2…). */
export function ajouterMorceau(P, id, n, entree) {
  const e = EN_COURS.get(id);
  if (!e || e.racine !== P.racine) throw new Error('Cet enregistrement n’existe plus.');
  if (Number(n) !== e.n) throw new Error(`Morceau ${n} reçu, ${e.n} attendu.`);
  e.n += 1;
  return new Promise((ok, ko) => {
    entree.on('data', (d) => {
      e.octets += d.length;
      if (e.octets > TAILLE_MAX) { entree.destroy(); ko(new Error('Enregistrement trop long pour Dérush (40 Go).')); return; }
      if (e.fd === null) return; // abandonné ou terminé entre-temps
      try { fs.writeSync(e.fd, d); } catch (err) { entree.destroy(); ko(err); }
    });
    entree.on('end', () => ok({recu: e.octets}));
    entree.on('error', ko);
  });
}

const refermer = (e) => { if (e.fd !== null) { try { fs.closeSync(e.fd); } catch { /* déjà fermé */ } e.fd = null; } };
/** Le fichier brut, sous un nom visible (sans le point du début) : ce qu'on laisse quand on n'a pas pu finir. */
const laisserVisible = (e) => { const garde = path.join(e.dossier, path.basename(e.brut).replace(/^\./, '')); try { fs.renameSync(e.brut, garde); } catch { /* il reste sous son nom caché */ } return garde; };

/** Abandonne un enregistrement : rien n'est gardé. */
export function annulerEnregistrement(P, id) {
  const e = EN_COURS.get(id);
  if (!e || e.racine !== P.racine) return false;
  EN_COURS.delete(id);
  refermer(e);
  fs.rm(e.brut, {force: true}, () => {});
  return true;
}

/**
 * Termine un enregistrement : le fichier est mis au propre et ajouté aux médias du projet.
 * Renvoie {media, fichier, genre} ; l'interface le pose ensuite dans la timeline.
 */
export async function terminerEnregistrement(P, id, file) {
  const e = EN_COURS.get(id);
  if (!e || e.racine !== P.racine) throw new Error('Cet enregistrement n’existe plus.');
  EN_COURS.delete(id);
  refermer(e);
  if (e.octets < 2000) { fs.rmSync(e.brut, {force: true}); throw new Error(e.genre === 'voix' ? 'Rien n’a été enregistré : le micro n’a rien envoyé.' : 'Rien n’a été enregistré : la caméra n’a rien envoyé.'); }
  const sortie = path.join(e.dossier, `${e.base}.${GENRES_ENREGISTREMENT[e.genre].ext}`);
  // une voix : du son seul, en AAC ; une vidéo : H.264 à 30 images par seconde (la fenêtre enregistre à cadence variable)
  const args = e.genre === 'voix'
    ? ['-v', 'error', '-y', '-i', e.brut, '-vn', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', sortie]
    : ['-v', 'error', '-y', '-i', e.brut, '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-fps_mode', 'cfr', '-r', '30',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', sortie];
  try {
    await lancer(FFMPEG, args);
  } catch (err) {
    // le fichier brut reste dans le projet : rien n'est perdu
    laisserVisible(e);
    throw new Error(`L’enregistrement n’a pas pu être mis au propre (${String(err.message).split('\n').slice(-1)[0].slice(0, 160)}). Il est gardé tel quel dans le dossier « enregistrements » du projet.`);
  }
  fs.rmSync(e.brut, {force: true});
  const r = await ajouterMedias(P, [sortie], file);
  if (!r.ajoutes.length) throw new Error(r.erreurs[0] ?? 'L’enregistrement n’a pas pu être ajouté aux médias.');
  return {media: r.ajoutes[0], fichier: path.basename(sortie), genre: e.genre, duree_s: Math.round((Date.now() - e.debut) / 1000)};
}

/** Un enregistrement est-il en cours ? (Dérush ne s'arrête pas tout seul pendant une prise.) */
export const enregistrementEnCours = () => EN_COURS.size > 0;

/**
 * À l'arrêt de Dérush : une prise pas terminée est refermée et laissée, telle quelle et visible, dans le dossier
 * « enregistrements » du projet (« voix-off-….brut.webm ») : on peut l'importer comme n'importe quel fichier.
 */
export function fermerEnregistrements() {
  for (const [id, e] of EN_COURS) { EN_COURS.delete(id); refermer(e); if (e.octets >= 2000) laisserVisible(e); else fs.rmSync(e.brut, {force: true}); }
}
