// Dérush — les deux moteurs qui inventent des pixels : RIFE (les images d'un ralenti fluide) et Real-ESRGAN (les détails
// d'un agrandissement). Deux programmes tout faits, qui calculent sur la carte graphique ; jamais livrés avec Dérush :
// chacun se télécharge chez la personne, sur son clic dans Connexions, depuis la page officielle de son auteur.
//   - Une version précise, essayée : lib/moteurs-pixels.json donne l'archive (son adresse, sa taille, son empreinte,
//     relevées le 24 novembre 2026 : GitHub n'en publie pas pour ces versions) et, pour chaque fichier gardé, sa taille
//     et son empreinte. Un seul fichier qui ne correspond pas, et rien n'est gardé.
//   - Seulement ce qui sert : le programme, son modèle, sa licence. L'archive n'est pas téléchargée en entier quand le
//     serveur sait la servir par morceaux (lib/zip-distant.mjs) : 18 Mo au lieu de 416 pour RIFE.
//   - Sur Mac seulement pour l'instant : ce sont les seules versions essayées. Ailleurs, le ralenti passe par FFmpeg.
//   - Après l'installation, un essai sur deux petites images dit si le moteur démarre sur cet ordinateur (il lui faut
//     la carte graphique). Sinon Dérush le dit et s'en passe.
//   - Jamais lancés depuis le bac à sable d'une IA : la carte graphique n'y est pas (essayé dans celui de Codex). Les
//     commandes derush-ralenti et derush-agrandir passent alors par le relais de Dérush (lib/relais.mjs).
//   - Le programme se lance toujours depuis son dossier, avec un chemin de modèle relatif : avec un chemin absolu, les
//     deux échouent sans le dire. Et leur code de retour ne dit rien : on compte toujours les fichiers écrits.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {DOSSIER_SUPPORT} from './moteurs.mjs';
import {FFMPEG, lancer} from './outils.mjs';
import {MAC, NOM_SYSTEME} from './plateforme.mjs';
import {sourceHttp, sourceFichier, tableZip, lireEntree} from './zip-distant.mjs';

/**
 * La table des moteurs. Pour les essais seulement : DERUSH_MOTEURS_PIXELS_MANIFESTE (une autre table),
 * DERUSH_MOTEURS_PIXELS_SYSTEME (« mac », pour essayer ailleurs que sur un Mac) et DERUSH_MOTEURS_PIXELS_ARCHIVES (un
 * dossier où <moteur>.zip remplace le téléchargement).
 */
export const MOTEURS_PIXELS = JSON.parse(fs.readFileSync(process.env.DERUSH_MOTEURS_PIXELS_MANIFESTE || new URL('./moteurs-pixels.json', import.meta.url), 'utf8'));
const SYSTEME = process.env.DERUSH_MOTEURS_PIXELS_SYSTEME || (MAC ? 'mac' : null);
const MARQUE = '.derush-moteur.json';
/** Ce que chaque moteur fait, dit simplement (pour Connexions et pour les messages). */
export const ROLES_PIXELS = {
  rife: {titre: 'Ralenti fluide', verbe: 'invente les images qui manquent à un ralenti'},
  realesrgan: {titre: 'Agrandisseur', verbe: 'agrandit une image ou une vidéo trop petite, jusqu’à la 4K'},
};

const paquet = (id) => (SYSTEME ? MOTEURS_PIXELS[id]?.[SYSTEME] ?? null : null);
export const dossierMoteurPixels = (id) => path.join(DOSSIER_SUPPORT, 'moteurs', id);
const fichiersDe = (p) => Object.entries(p.fichiers).map(([chemin, [octets, sha256]]) => ({chemin, octets, sha256}));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const mo = (o) => `${Math.max(1, Math.round(o / 1e6))} Mo`;

/**
 * L'état d'un moteur : {ok, installe, installable, nom, titre, version, pourquoi, a_telecharger, sur_le_disque…}.
 * `ok` : installé, à la version de cette version de Dérush, et il a démarré sur cet ordinateur.
 */
export function etatMoteurPixels(id) {
  const m = MOTEURS_PIXELS[id];
  if (!m) throw new Error(`moteur inconnu : ${id}.`);
  const p = paquet(id);
  const commun = {id, nom: m.nom, titre: ROLES_PIXELS[id]?.titre ?? m.nom, version: m.version, source: m.source, licence: m.licence};
  if (!p) return {...commun, ok: false, installe: false, installable: false, pourquoi: `Pas encore sur ${NOM_SYSTEME} : seule la version pour Mac a été essayée.`};
  const dossier = dossierMoteurPixels(id);
  const poids = {a_telecharger: mo(p.a_telecharger ?? p.octets), sur_le_disque: mo(fichiersDe(p).reduce((n, f) => n + f.octets, 0))};
  let marque = null;
  try { marque = JSON.parse(fs.readFileSync(path.join(dossier, MARQUE), 'utf8')); } catch { /* pas installé */ }
  const complet = !!marque && marque.version === m.version && fichiersDe(p).every((f) => { try { return fs.statSync(path.join(dossier, f.chemin)).size === f.octets; } catch { return false; } });
  if (!complet) return {...commun, ...poids, ok: false, installe: false, installable: true, pourquoi: marque ? 'À réinstaller : cette version de Dérush attend une autre version du moteur.' : 'Pas encore installé.'};
  const base = {...commun, ...poids, installe: true, installable: true, dossier, programme: path.join(dossier, p.programme), date: marque.date ?? null, essai: marque.essai ?? null};
  if (marque.essai?.ok === false) return {...base, ok: false, pourquoi: `Installé, mais il ne démarre pas sur cet ordinateur (${marque.essai.message}).`};
  return {...base, ok: true};
}

/** Lance le programme d'un moteur depuis son dossier ; renvoie {code, erreurs}, même s'il échoue. `signal` l'arrête. */
export function lancerMoteurPixels(id, args, {dureeMax = 0, signal = null} = {}) {
  const p = paquet(id);
  if (!p) return Promise.reject(new Error(`${MOTEURS_PIXELS[id]?.nom ?? id} n’existe pas encore pour ${NOM_SYSTEME}.`));
  const dossier = dossierMoteurPixels(id);
  return new Promise((ok, ko) => {
    const enfant = spawn(path.join(dossier, p.programme), args.map(String), {cwd: dossier, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true, ...(signal ? {signal} : {})});
    let erreurs = '';
    let tropLong = false;
    const garde = dureeMax ? setTimeout(() => { tropLong = true; enfant.kill('SIGKILL'); }, dureeMax) : null;
    const arreter = () => { try { enfant.kill('SIGKILL'); } catch { /* déjà fini */ } };
    process.once('exit', arreter); // Dérush qui se ferme n'en laisse pas tourner derrière lui
    const fin = () => { clearTimeout(garde); process.removeListener('exit', arreter); };
    enfant.stderr.on('data', (d) => { erreurs = (erreurs + d).slice(-20000); });
    enfant.on('error', (e) => { fin(); ko(e.name === 'AbortError' ? Object.assign(new Error('arrêté.'), {arrete: true}) : new Error(`${MOTEURS_PIXELS[id].nom} n’a pas pu démarrer (${e.message}).`)); });
    enfant.on('close', (code) => { fin(); if (tropLong) ko(new Error(`${MOTEURS_PIXELS[id].nom} a mis trop longtemps : arrêté.`)); else ok({code: code ?? 1, erreurs}); });
  });
}

/** La largeur et la hauteur d'une image PNG, lues dans son en-tête (ou null). */
export function taillePng(fichier) {
  try {
    const fd = fs.openSync(fichier, 'r');
    try {
      const b = Buffer.alloc(24);
      if (fs.readSync(fd, b, 0, 24, 0) < 24 || b.readUInt32BE(0) !== 0x89504e47 || b.toString('latin1', 12, 16) !== 'IHDR') return null;
      return {largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20)};
    } finally { fs.closeSync(fd); }
  } catch { return null; }
}

/** Ce que le moteur a dit de plus utile, en une ligne (sans les lignes qui décrivent la carte graphique). */
export const direErreursMoteur = (erreurs) => String(erreurs ?? '').split('\n').map((l) => l.trim()).filter((l) => l && !/^\[\d+ /.test(l)).slice(-2).join(' | ').slice(0, 300);

/**
 * L'essai de démarrage : deux petites images fabriquées par FFmpeg, passées au moteur. Renvoie {ok, secondes, message}.
 * C'est le seul moyen de savoir si la carte graphique de cet ordinateur convient.
 */
export async function essayerMoteurPixels(id) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `derush-${id}-`));
  const [e, s] = [path.join(tmp, 'e'), path.join(tmp, 's')];
  try {
    fs.mkdirSync(e);
    fs.mkdirSync(s);
    await lancer(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=128x96:r=2', '-frames:v', '2', path.join(e, '%08d.png')]);
    const t0 = Date.now();
    const args = id === 'rife' ? ['-i', e, '-o', s, '-m', 'rife-v4.6'] : ['-i', e, '-o', s, '-n', 'realesr-animevideov3', '-s', '2', '-m', 'models', '-f', 'png'];
    const r = await lancerMoteurPixels(id, args, {dureeMax: 120000});
    const sorties = fs.readdirSync(s).filter((f) => f.endsWith('.png')).sort();
    const attendu = id === 'rife' ? {n: 4, largeur: 128, hauteur: 96} : {n: 2, largeur: 256, hauteur: 192};
    const t = sorties.length ? taillePng(path.join(s, sorties[0])) : null;
    const ok = sorties.length === attendu.n && t?.largeur === attendu.largeur && t?.hauteur === attendu.hauteur;
    return {ok, secondes: Math.round((Date.now() - t0) / 100) / 10, message: ok ? null : (direErreursMoteur(r.erreurs) || 'il n’a rien écrit')};
  } catch (err) {
    return {ok: false, secondes: null, message: String(err.message).slice(0, 300)};
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}

/** L'archive entière, quand le serveur ne sait pas la servir par morceaux : téléchargée, vérifiée (taille, empreinte). */
async function telechargerArchive(p, fichier, surOctets) {
  const r = await fetch(p.archive, {signal: AbortSignal.timeout(60 * 60e3)});
  if (!r.ok || !r.body) throw new Error(`le serveur a répondu ${r.status}.`);
  const empreinte = crypto.createHash('sha256');
  let recu = 0;
  const suivi = new TransformStream({transform(morceau, c) { recu += morceau.byteLength; if (recu > p.octets) throw new Error('l’archive reçue est plus grosse que celle qui a été vérifiée.'); empreinte.update(morceau); surOctets(morceau.byteLength); c.enqueue(morceau); }});
  await pipeline(Readable.fromWeb(r.body.pipeThrough(suivi)), fs.createWriteStream(fichier));
  if (recu !== p.octets || empreinte.digest('hex') !== p.sha256) throw new Error('l’archive reçue ne correspond pas à celle qui a été vérifiée : rien n’est gardé.');
}

const installations = new Map();
/**
 * Installe un moteur : ses fichiers pris dans l'archive officielle, chacun vérifié (taille, empreinte), puis l'essai de
 * démarrage. `prog(0 → 1)`. Renvoie son état. Deux demandes pour le même moteur attendent la même installation.
 */
export function installerMoteurPixels(id, prog = () => {}) {
  if (installations.has(id)) return installations.get(id);
  const travail = (async () => {
    const m = MOTEURS_PIXELS[id];
    const p = paquet(id);
    if (!m) throw new Error(`moteur inconnu : ${id}.`);
    if (!p) throw new Error(`${m.nom} n’existe pas encore pour ${NOM_SYSTEME} : seule la version pour Mac a été essayée.`);
    const final = dossierMoteurPixels(id);
    const tmp = `${final}.part-${process.pid}`;
    fs.rmSync(tmp, {recursive: true, force: true});
    fs.mkdirSync(tmp, {recursive: true});
    try {
      const voulus = fichiersDe(p);
      let recu = 0;
      let aRecevoir = p.a_telecharger ?? p.octets;
      const surOctets = (n) => { recu += n; prog(Math.min(0.97, recu / aRecevoir)); };
      const local = process.env.DERUSH_MOTEURS_PIXELS_ARCHIVES ? path.join(process.env.DERUSH_MOTEURS_PIXELS_ARCHIVES, `${id}.zip`) : null;
      const prendre = async (source) => {
        const table = await tableZip(source);
        for (const f of voulus) {
          const e = table.find((x) => x.nom === `${p.racine}${f.chemin}`);
          if (!e) throw new Error(`« ${f.chemin} » n’est pas dans l’archive.`);
          if (e.taille !== f.octets) throw new Error(`« ${f.chemin} » n’a pas la taille de celui qui a été vérifié : rien n’est gardé.`);
        }
        for (const f of voulus) {
          const contenu = await lireEntree(source, table.find((x) => x.nom === `${p.racine}${f.chemin}`));
          if (contenu.length !== f.octets || sha(contenu) !== f.sha256) throw new Error(`« ${f.chemin} » ne correspond pas à celui qui a été vérifié : rien n’est gardé.`);
          const cible = path.join(tmp, f.chemin);
          fs.mkdirSync(path.dirname(cible), {recursive: true});
          fs.writeFileSync(cible, contenu, {mode: f.chemin === p.programme ? 0o755 : 0o644});
        }
      };
      if (local) await prendre(sourceFichier(local));
      else {
        try {
          await prendre(sourceHttp(p.archive, {taille: p.octets, surOctets}));
        } catch (e) {
          if (!e.sansMorceaux) throw e;
          // un serveur qui ne sert pas par morceaux : l'archive entière, vérifiée, puis les mêmes fichiers pris dedans
          const zip = path.join(tmp, 'archive.zip');
          recu = 0;
          aRecevoir = p.octets;
          await telechargerArchive(p, zip, surOctets);
          await prendre(sourceFichier(zip));
          fs.rmSync(zip, {force: true});
        }
      }
      fs.writeFileSync(path.join(tmp, 'LISEZ-MOI.txt'), `${m.nom} — ${m.version}\nTéléchargé par Dérush depuis la page de son auteur : ${m.source}\nArchive : ${p.archive}\nLicence : ${m.licence}\nLe texte des licences est sur la page de chaque projet.\nPour le retirer : Dérush › Connexions › ${ROLES_PIXELS[id]?.titre ?? m.nom} › Retirer (ou supprime ce dossier).\n`);
      fs.rmSync(final, {recursive: true, force: true});
      fs.renameSync(tmp, final);
      fs.writeFileSync(path.join(final, MARQUE), JSON.stringify({version: m.version, date: new Date().toISOString(), essai: null}));
    } catch (e) {
      fs.rmSync(tmp, {recursive: true, force: true});
      throw new Error(`${m.nom} n’a pas pu s’installer (il faut Internet) : ${e.message}`);
    }
    prog(0.98);
    // l'essai de démarrage : son résultat est gardé avec le moteur
    const essai = await essayerMoteurPixels(id);
    fs.writeFileSync(path.join(final, MARQUE), JSON.stringify({version: m.version, date: new Date().toISOString(), essai}));
    prog(1);
    return etatMoteurPixels(id);
  })().finally(() => installations.delete(id));
  installations.set(id, travail);
  return travail;
}

/** Retire un moteur de cet ordinateur (son dossier dans le dossier de Dérush). */
export function retirerMoteurPixels(id) {
  if (!MOTEURS_PIXELS[id]) throw new Error(`moteur inconnu : ${id}.`);
  if (installations.has(id)) throw new Error('Une installation est en cours : attends qu’elle finisse.');
  fs.rmSync(dossierMoteurPixels(id), {recursive: true, force: true});
  return etatMoteurPixels(id);
}

/**
 * Lance derush-ralenti ou derush-agrandir hors d'un bac à sable (pour le relais) ; renvoie {code, sortie, erreurs},
 * même en échec. `signal` l'arrête (l'IA a abandonné sa demande).
 */
export function lancerCommandePixels(commande, args, {cwd = process.cwd(), dureeMax = 5 * 3600e3, signal = null} = {}) {
  if (!['ralenti', 'agrandir'].includes(commande)) return Promise.reject(new Error('commande inconnue.'));
  const env = {...process.env, PATH: [path.dirname(process.execPath), process.env.PATH ?? ''].join(path.delimiter)};
  for (const k of ['DERUSH_RELAIS', 'DERUSH_RELAIS_BOITE', 'DERUSH_RELAIS_JETON', 'CODEX_SANDBOX']) delete env[k];
  return new Promise((ok, ko) => {
    const p = spawn(process.execPath, [fileURLToPath(new URL(`../outils/derush-${commande}.mjs`, import.meta.url)), ...args.map(String)], {cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true});
    let sortie = '';
    let erreurs = '';
    const arreter = () => { try { p.kill('SIGTERM'); } catch { /* déjà fini */ } };
    const garde = setTimeout(arreter, dureeMax);
    signal?.addEventListener('abort', arreter, {once: true});
    p.stdout.on('data', (d) => { sortie = (sortie + d).slice(-200000); });
    p.stderr.on('data', (d) => { erreurs = (erreurs + d).slice(-200000); });
    p.on('error', (err) => { clearTimeout(garde); ko(err); });
    p.on('close', (code) => { clearTimeout(garde); ok({code: code ?? 1, sortie, erreurs}); });
  });
}

/** La ligne des consignes de l'IA (lib/claude.mjs) : le ralenti et l'agrandisseur, selon ce qui est installé ici. */
export function consignePixels() {
  const [r, a] = [etatMoteurPixels('rife'), etatMoteurPixels('realesrgan')];
  const ralenti = r.ok ? 'RIFE invente les images qui manquent' : 'RIFE n’est pas installé : FFmpeg invente les images, un peu moins finement';
  const agrandir = a.ok ? '« derush-agrandir » (Real-ESRGAN : modèle dessin rapide, modèle photo lent ; --estimer d’abord pour une vidéo)' : '« derush-agrandir » quand la personne a installé l’agrandisseur (Connexions › Agrandisseur), sinon rien qui ajoute des détails';
  return `- Un ralenti : « derush-ralenti <rush> -o <sortie.mp4> --de S --a S --fois 4 --cadence 30 » (${ralenti} ; sans son). Une image ou un rush trop petit pour le montage : ${agrandir}. Aide : --help. Regarde des images avant de livrer.`;
}
