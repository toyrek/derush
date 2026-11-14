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
const EN_COURS = new Map(); // id → {racine, genre, base, dossier, brut, n, octets, fd, debut, muet, erreur}
let finitions = 0; // les prises que FFmpeg est en train de mettre au propre

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
  // le début de l'identifiant est dans le nom du fichier brut, ouvert seulement s'il n'existe pas : deux prises
  // commencées dans la même seconde n'écrivent jamais dans le même fichier (et l'abandon de l'une n'efface pas l'autre)
  const brut = path.join(dossier, `.${base}-${id.slice(0, 6)}.brut.${extBrute(String(mime))}`);
  // écrit tout de suite sur le disque, morceau après morceau : si Dérush s'arrête en pleine prise, ce qui a été dit est là
  EN_COURS.set(id, {racine: P.racine, genre, base, dossier, brut, n: 0, octets: 0, fd: fs.openSync(brut, 'wx'), debut: Date.now(), muet: 0, erreur: null});
  veiller();
  return {id};
}

/** Ce qu'on dit quand un morceau n'a pas pu être écrit (en français, et sans faire croire que tout est perdu). */
function messageEcriture(err) {
  const garde = 'Ce qui est déjà enregistré est gardé dans le dossier « enregistrements » du projet.';
  if (['ENOSPC', 'EDQUOT'].includes(err?.code)) return `Le disque est plein : la prise s’arrête ici. ${garde} Libère de la place sur le disque.`;
  // un fichier trop gros pour le disque, pas un disque plein : une clé en FAT32 s'arrête à 4 Go par fichier
  if (err?.code === 'EFBIG') return `La prise est devenue trop grosse pour ce disque (4 Go au plus par fichier sur une clé en FAT32) : elle s’arrête ici. ${garde} Pour une longue prise, range le projet sur un autre disque.`;
  return `Dérush n’a pas pu écrire la prise sur le disque (${err?.code ?? 'erreur inconnue'}) : elle s’arrête ici. ${garde}`;
}

/** Ajoute un morceau (dans l'ordre : n = 0, 1, 2…). */
export function ajouterMorceau(P, id, n, entree) {
  const e = EN_COURS.get(id);
  if (!e || e.racine !== P.racine) throw new Error('Cet enregistrement n’existe plus.');
  // un morceau n'a pas pu être écrit : la suite, posée après le trou, abîmerait ce qui est déjà sur le disque
  if (e.erreur) throw new Error(e.erreur);
  if (Number(n) !== e.n) throw new Error(`Morceau ${n} reçu, ${e.n} attendu.`);
  e.n += 1;
  e.muet = 0;
  return new Promise((ok, ko) => {
    const refuser = (message) => { e.erreur = message; entree.destroy(); ko(new Error(message)); };
    entree.on('data', (d) => {
      e.muet = 0;
      if (e.fd === null || e.erreur) return; // abandonné, terminé ou arrêté par une erreur entre-temps
      if (e.octets + d.length > TAILLE_MAX) return refuser('Enregistrement trop long pour Dérush (40 Go) : la prise s’arrête ici. Arrête l’enregistrement, ce qui est déjà enregistré est gardé.');
      try {
        // le système peut n'écrire qu'une partie du morceau (disque presque plein) : on écrit jusqu'au bout
        for (let o = 0; o < d.length;) {
          const ecrit = fs.writeSync(e.fd, d, o, d.length - o);
          if (!ecrit) throw Object.assign(new Error('Rien n’a pu être écrit.'), {code: 'ENOSPC'});
          o += ecrit;
          e.octets += ecrit;
        }
      } catch (err) { refuser(messageEcriture(err)); }
    });
    entree.on('end', () => ok({recu: e.octets}));
    entree.on('error', ko);
  });
}

const refermer = (e) => { if (e.fd !== null) { try { fs.closeSync(e.fd); } catch { /* déjà fermé */ } e.fd = null; } };
/** Le fichier brut, sous un nom visible (sans le point du début) : ce qu'on laisse quand on n'a pas pu finir. */
const laisserVisible = (e) => { const garde = path.join(e.dossier, path.basename(e.brut).replace(/^\./, '')); try { fs.renameSync(e.brut, garde); } catch { /* il reste sous son nom caché */ } return garde; };
/** Referme une prise qui ne finira pas : gardée visible s'il y a quelque chose dedans, effacée sinon. */
const lacher = (id, e) => { EN_COURS.delete(id); refermer(e); if (e.octets >= 2000) laisserVisible(e); else fs.rmSync(e.brut, {force: true}); };

/** Abandonne un enregistrement : rien n'est gardé (sauf si la prise a été arrêtée par une erreur d'écriture). */
export function annulerEnregistrement(P, id) {
  const e = EN_COURS.get(id);
  if (!e || e.racine !== P.racine) return false;
  // une prise arrêtée par une écriture ratée (disque plein) n'est pas un abandon voulu : la fenêtre la « jette » toute
  // seule quand on clique sur Arrêter. Ce qui est sur le disque reste donc là, sous un nom visible.
  if (e.erreur) { lacher(id, e); return true; }
  EN_COURS.delete(id);
  refermer(e);
  fs.rmSync(e.brut, {force: true});
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
  const ext = GENRES_ENREGISTREMENT[e.genre].ext;
  let sortie = null;
  finitions++;
  try {
    // un nom libre, réservé tout de suite : une autre prise finie dans la même seconde n'est jamais écrasée
    for (let k = 1; !sortie; k++) {
      const f = path.join(e.dossier, `${e.base}${k > 1 ? `-${k}` : ''}.${ext}`);
      try { fs.closeSync(fs.openSync(f, 'wx')); sortie = f; } catch (err) { if (err.code !== 'EEXIST') throw err; }
    }
    // une voix : du son seul, en AAC ; une vidéo : H.264 à 30 images par seconde (la fenêtre enregistre à cadence
    // variable), sans jamais peser beaucoup plus que la prise (la fenêtre enregistre à 8 Mbit/s)
    await lancer(FFMPEG, e.genre === 'voix'
      ? ['-v', 'error', '-y', '-i', e.brut, '-vn', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', sortie]
      : ['-v', 'error', '-y', '-i', e.brut, '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-maxrate', '12M', '-bufsize', '24M', '-pix_fmt', 'yuv420p', '-fps_mode', 'cfr', '-r', '30',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', sortie]);
  } catch (err) {
    // le fichier brut reste dans le projet : rien n'est perdu
    if (sortie) fs.rmSync(sortie, {force: true});
    laisserVisible(e);
    const raison = ['ENOSPC', 'EDQUOT'].includes(err.code) || /No space left/i.test(err.message) ? 'le disque est plein' : String(err.message).split('\n').slice(-1)[0].slice(0, 160);
    throw new Error(`L’enregistrement n’a pas pu être mis au propre (${raison}). Il est gardé tel quel dans le dossier « enregistrements » du projet.`);
  } finally {
    finitions--;
  }
  fs.rmSync(e.brut, {force: true});
  const r = await ajouterMedias(P, [sortie], file);
  if (!r.ajoutes.length) throw new Error(r.erreurs[0] ?? 'L’enregistrement n’a pas pu être ajouté aux médias.');
  return {media: r.ajoutes[0], fichier: path.basename(sortie), genre: e.genre, duree_s: Math.round((Date.now() - e.debut) / 1000)};
}

/** Un enregistrement est-il en cours, ou en train d'être mis au propre ? (Dérush ne s'arrête pas tout seul pendant une prise.) */
export const enregistrementEnCours = () => EN_COURS.size > 0 || finitions > 0;

// ——— Une prise dont la fenêtre a disparu ———
// La fenêtre envoie un morceau toutes les deux secondes. Fermée, rechargée ou plantée en pleine prise, elle n'envoie plus
// rien et ne prévient personne : sans cette veille, la prise restait « en cours » pour toujours, son fichier ouvert et
// caché, et Dérush ne s'arrêtait plus tout seul (ni ne se mettait à jour).
const PAS_VEILLE = 20000;
let veille = null;
/**
 * Un passage de la veille (toutes les 20 s) : une prise qui n'a rien reçu pendant trois passages de suite, une minute,
 * est refermée et laissée visible dans « enregistrements ». On compte des passages, pas l'heure : un ordinateur qui sort
 * de veille ne fait pas perdre la prise en cours.
 */
export function lacherPrisesMuettes() {
  for (const [id, e] of EN_COURS) if (++e.muet >= 3) lacher(id, e);
  if (!EN_COURS.size && veille) { clearInterval(veille); veille = null; }
}
function veiller() {
  if (veille) return;
  veille = setInterval(lacherPrisesMuettes, PAS_VEILLE);
  veille.unref?.();
}

/**
 * À l'arrêt de Dérush : une prise pas terminée est refermée et laissée, telle quelle et visible, dans le dossier
 * « enregistrements » du projet (« voix-off-….brut.webm ») : on peut l'importer comme n'importe quel fichier.
 */
export function fermerEnregistrements() {
  for (const [id, e] of EN_COURS) lacher(id, e);
}
