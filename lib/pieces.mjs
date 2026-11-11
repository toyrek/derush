// Dérush — les pièces jointes de la conversation avec Claude : références, vidéos, charte graphique, logo, polices,
// archives zip, documents… Tout ce que l'humain donne à Claude pour l'aider à monter.
//
// - La liste est dans <projet>/claude/pieces.json ; ce que Dérush en tire (aperçu, planche, texte, contenu d'un zip)
//   est rangé dans <projet>/claude/pieces/<id>/.
// - Un fichier trouvé sur le disque reste à sa place (même une vidéo de plusieurs Go) ; un fichier envoyé par la
//   fenêtre (copié-collé, ou introuvable sur le disque) est copié dans le projet.
// - À chaque demande, Dérush installe tout dans le dossier de travail de Claude, sous contexte/, avec un INDEX.md.
import fs from 'node:fs';
import path from 'node:path';
import {EXT_VIDEOS, EXT_SONS, EXT_IMAGES, nouvelId, slug, texteDesMots, dureeLisible} from './commun.mjs';
import {lancer, ffmpeg, FFPROBE, ecrireJson, lireJson, tailleLisible} from './outils.mjs';
import {etatMoteurs, lancerPython, MODELE_WHISPER} from './moteurs.mjs';
import {depuisJson} from './transcription.mjs';
import {lier as lierFichier, delier} from './plateforme.mjs';

export const ROLES = {
  reference: 'Référence', charte: 'Charte graphique', logo: 'Logo', police: 'Police', musique: 'Musique ou son',
  rush: 'Rush à monter', script: 'Texte ou script', autre: 'Autre',
};
const TYPES = [
  ['image', EXT_IMAGES], ['video', EXT_VIDEOS], ['son', EXT_SONS], ['pdf', /\.pdf$/i], ['police', /\.(ttf|otf|woff2?|ttc)$/i],
  ['archive', /\.zip$/i], ['3d', /\.(blend|glb|gltf|fbx|obj|usdz?|stl|abc|dae|ply)$/i], ['design', /\.(psd|ai|sketch|fig|xd|svg|eps|indd)$/i],
  ['document', /\.(txt|md|rtf|docx?|pages|key|pptx?|xlsx?|numbers|csv|json|srt|vtt|html?)$/i],
];
export const typeDe = (nom) => TYPES.find(([, re]) => re.test(nom))?.[0] ?? 'autre';
/** Le rôle le plus probable, d'après le nom et le type (l'humain peut le changer). */
function roleProbable(nom, type) {
  const n = nom.toLowerCase();
  if (/charte|brand|guideline|identit|design.?system|kit.?(de.?)?marque/.test(n)) return 'charte';
  if (/logo/.test(n)) return 'logo';
  if (type === 'police') return 'police';
  if (type === 'son') return 'musique';
  if (type === 'document' && /script|texte|sc[ée]nario|voix.?off|brief/.test(n)) return 'script';
  return 'reference';
}

const fichierListe = (P) => path.join(P.racine, 'claude', 'pieces.json');
const dossierPiece = (P, id) => path.join(P.racine, 'claude', 'pieces', id);
const lire = (P) => lireJson(fichierListe(P)) ?? {compteur: 0, pieces: []};
function ecrire(P, d) {
  fs.mkdirSync(path.dirname(fichierListe(P)), {recursive: true});
  ecrireJson(fichierListe(P), d, 2);
}
const EN_PREPARATION = new Map(); // id de pièce → promesse

/** Les pièces du projet (celles dont le fichier a disparu sont signalées, pas effacées). */
export function listerPieces(P) {
  return lire(P).pieces.map((x) => ({...x, introuvable: !fs.existsSync(x.chemin), en_preparation: EN_PREPARATION.has(`${P.racine}|${x.id}`)}));
}
export const piece = (P, id) => lire(P).pieces.find((x) => x.id === id) ?? null;

function enregistrerPiece(P, chemin, {copie = false, id = null} = {}) {
  const st = fs.statSync(chemin);
  if (!st.isFile()) throw new Error(`${path.basename(chemin)} n’est pas un fichier.`);
  const d = lire(P);
  const deja = d.pieces.find((x) => x.chemin === chemin && x.message == null);
  if (deja) return deja;
  if (!id) d.compteur = (d.compteur ?? 0) + 1;
  const nom = path.basename(chemin);
  const type = typeDe(nom);
  const x = {id: id ?? `J${d.compteur}`, nom, chemin, copie, taille: st.size, taille_lisible: tailleLisible(st.size), type, role: roleProbable(nom, type), ajoute_le: new Date().toISOString(), message: null, infos: null, apercu: null, planche: null, texte: null, extrait: null, erreur: null};
  d.pieces.push(x);
  ecrire(P, d);
  return x;
}
function majPiece(P, id, champs) {
  const d = lire(P);
  const x = d.pieces.find((p) => p.id === id);
  if (!x) return null;
  Object.assign(x, champs);
  ecrire(P, d);
  return x;
}

/** Des fichiers du Mac (fenêtre « Ouvrir », ou glissés et retrouvés sur le disque) : ils restent à leur place. */
export function ajouterPieces(P, chemins) {
  const ajoutees = [];
  const erreurs = [];
  for (const c of chemins) {
    try { ajoutees.push(enregistrerPiece(P, path.resolve(String(c)))); } catch (e) { erreurs.push(`${path.basename(String(c))} : ${e.message}`); }
  }
  for (const x of ajoutees) lancerPreparation(P, x.id);
  return {ajoutees, erreurs};
}

/** Un fichier envoyé par la fenêtre (copier-coller, ou introuvable sur le disque) : il est copié dans le projet. */
export async function televerserPiece(P, nom, flux) {
  const propre = path.basename(String(nom || 'piece')).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(-120) || 'piece';
  // le numéro est réservé tout de suite : deux envois en même temps n'auront jamais le même dossier
  const d = lire(P);
  d.compteur = (d.compteur ?? 0) + 1;
  const id = `J${d.compteur}`;
  ecrire(P, d);
  const dossier = dossierPiece(P, id);
  fs.mkdirSync(dossier, {recursive: true});
  const cible = path.join(dossier, propre);
  try {
    await new Promise((ok, ko) => {
      const out = fs.createWriteStream(cible);
      flux.pipe(out);
      out.on('finish', ok);
      out.on('error', ko);
      flux.on('error', ko);
    });
  } catch (e) {
    fs.rmSync(dossier, {recursive: true, force: true});
    throw e;
  }
  const x = enregistrerPiece(P, cible, {copie: true, id});
  lancerPreparation(P, x.id);
  return x;
}

/** Retire une pièce : elle ne sera plus donnée à Claude. Les copies faites par Dérush sont effacées, jamais les originaux. */
export function retirerPiece(P, id) {
  const d = lire(P);
  const x = d.pieces.find((p) => p.id === id);
  if (!x) return false;
  d.pieces = d.pieces.filter((p) => p.id !== id);
  ecrire(P, d);
  fs.rmSync(dossierPiece(P, id), {recursive: true, force: true});
  return true;
}
export function changerRole(P, id, role) {
  if (!ROLES[role]) throw new Error('Rôle inconnu.');
  return majPiece(P, id, {role});
}
/** Les pièces encore en attente (pas encore envoyées) partent avec ce message. */
export function attacherPieces(P, ids, n) {
  const d = lire(P);
  const ok = [];
  for (const x of d.pieces) if (ids.includes(x.id) && x.message == null) { x.message = n; ok.push(x.id); }
  ecrire(P, d);
  return ok;
}
export const piecesEnAttente = (P) => lire(P).pieces.filter((x) => x.message == null).map((x) => x.id);

// ——— Préparation : ce qui aide Claude à « voir » chaque pièce d'un coup d'œil ———
function lancerPreparation(P, id) {
  const cle = `${P.racine}|${id}`;
  if (EN_PREPARATION.has(cle)) return EN_PREPARATION.get(cle);
  const t = preparer(P, id).catch((e) => majPiece(P, id, {erreur: String(e.message).slice(0, 300)})).finally(() => EN_PREPARATION.delete(cle));
  EN_PREPARATION.set(cle, t);
  return t;
}
/** Attend que les pièces en cours de préparation soient prêtes (2 min au plus). */
export async function attendrePieces(P, delaiMs = 120000) {
  const enCours = [...EN_PREPARATION.entries()].filter(([k]) => k.startsWith(`${P.racine}|`)).map(([, t]) => t);
  if (!enCours.length) return;
  await Promise.race([Promise.allSettled(enCours), new Promise((ok) => setTimeout(ok, delaiMs))]);
}

async function sonder(fichier) {
  try {
    const {out} = await lancer(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', fichier]);
    const j = JSON.parse(out.toString());
    const v = j.streams?.find((s) => s.codec_type === 'video');
    const a = j.streams?.find((s) => s.codec_type === 'audio');
    return {duree: Number(j.format?.duration) || null, largeur: v?.width ?? null, hauteur: v?.height ?? null, son: !!a};
  } catch {
    return {duree: null, largeur: null, hauteur: null, son: false};
  }
}
/** Le texte d'un son ou d'une vidéo, avec un repère de temps par phrase (Whisper, sur le Mac). */
async function texteParle(fichier, sortieJson) {
  if (!(await etatMoteurs()).whisper?.ok) return null;
  await lancerPython('transcrire.py', [fichier, sortieJson, process.env.DERUSH_LANGUE || 'fr', MODELE_WHISPER], () => {});
  const mots = depuisJson(lireJson(sortieJson)).mots ?? [];
  if (!mots.length) return null;
  const lignes = [];
  let l = null;
  for (const w of mots) {
    if (!l || w.d - l.fin > 0.8 || /[.!?…]$/.test(l.mots.at(-1)?.t ?? '')) { if (l) lignes.push(l); l = {debut: w.d, fin: w.f, mots: []}; }
    l.mots.push(w);
    l.fin = w.f;
  }
  if (l) lignes.push(l);
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return lignes.map((x) => `[${mmss(x.debut)}] ${texteDesMots(x.mots)}`).join('\n');
}
/** Une archive zip, décompressée sans danger : pas de chemin qui sorte du dossier, pas de lien, pas de bombe. */
async function decompresser(zip, dest) {
  const {out} = await lancer('/usr/bin/unzip', ['-Z1', zip]);
  const entrees = out.toString().split('\n').map((s) => s.trim()).filter(Boolean);
  if (entrees.length > 5000) throw new Error('Cette archive contient plus de 5 000 fichiers.');
  if (entrees.some((e) => e.startsWith('/') || e.split('/').includes('..'))) throw new Error('Cette archive contient des chemins dangereux : elle n’a pas été ouverte.');
  const liste = (await lancer('/usr/bin/unzip', ['-l', zip])).out.toString().trim().split('\n');
  const total = Number(/^\s*(\d+)/.exec(liste.at(-1) ?? '')?.[1] ?? 0);
  if (total > 8 * 1024 ** 3) throw new Error('Cette archive dépasse 8 Go une fois ouverte.');
  fs.rmSync(dest, {recursive: true, force: true});
  fs.mkdirSync(dest, {recursive: true});
  await lancer('/usr/bin/unzip', ['-q', '-o', zip, '-d', dest]);
  // ménage : fichiers système, liens symboliques, et tout ce qui sortirait du dossier
  const racine = fs.realpathSync(dest);
  const fichiers = [];
  const parcourir = (d) => {
    for (const e of fs.readdirSync(d, {withFileTypes: true})) {
      const c = path.join(d, e.name);
      if (e.name === '__MACOSX' || e.name === '.DS_Store' || e.name.startsWith('._')) { fs.rmSync(c, {recursive: true, force: true}); continue; }
      if (e.isSymbolicLink()) { fs.rmSync(c, {force: true}); continue; }
      if (!fs.realpathSync(c).startsWith(racine + path.sep)) { fs.rmSync(c, {recursive: true, force: true}); continue; }
      if (e.isDirectory()) parcourir(c);
      else fichiers.push(path.relative(dest, c));
    }
  };
  parcourir(dest);
  const types = {};
  for (const f of fichiers) { const t = typeDe(f); types[t] = (types[t] ?? 0) + 1; }
  return {fichiers: fichiers.length, types, apercu_liste: fichiers.slice(0, 40)};
}
/** Une vignette pour l'interface, par Quick Look (PDF, polices, documents, Photoshop, Illustrator…). */
async function vignetteQuickLook(fichier, dossier) {
  if (process.platform !== 'darwin') return null; // Quick Look n'existe que sur macOS
  try {
    await lancer('/usr/bin/qlmanage', ['-t', '-s', '360', '-o', dossier, fichier], {silenceMax: 20000});
    const png = path.join(dossier, `${path.basename(fichier)}.png`);
    if (!fs.existsSync(png)) return null;
    await lancer('/usr/bin/sips', ['-s', 'format', 'jpeg', png, '--out', path.join(dossier, 'apercu.jpg')]);
    fs.rmSync(png, {force: true});
    return 'apercu.jpg';
  } catch {
    return null;
  }
}

async function preparer(P, id) {
  const x = piece(P, id);
  if (!x) return;
  const dossier = dossierPiece(P, id);
  fs.mkdirSync(dossier, {recursive: true});
  const champs = {erreur: null};
  if (x.type === 'image') {
    try {
      await lancer('/usr/bin/sips', ['-s', 'format', 'jpeg', '-Z', '480', x.chemin, '--out', path.join(dossier, 'apercu.jpg')]);
      champs.apercu = 'apercu.jpg';
      const {out} = await lancer('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', x.chemin]);
      champs.infos = {largeur: Number(/pixelWidth: (\d+)/.exec(out.toString())?.[1]) || null, hauteur: Number(/pixelHeight: (\d+)/.exec(out.toString())?.[1]) || null};
    } catch {
      // hors macOS : FFmpeg sait lire la plupart des images (JPEG, PNG, WebP, TIFF…)
      try {
        await ffmpeg(['-y', '-i', x.chemin, '-frames:v', '1', '-vf', "scale='min(480,iw)':-2", '-q:v', '4', path.join(dossier, 'apercu.jpg')]);
        champs.apercu = 'apercu.jpg';
        const s = await sonder(x.chemin);
        champs.infos = {largeur: s.largeur, hauteur: s.hauteur};
      } catch { champs.apercu = await vignetteQuickLook(x.chemin, dossier); }
    }
  } else if (x.type === 'video') {
    const s = await sonder(x.chemin);
    champs.infos = s;
    if (s.duree) {
      await ffmpeg(['-y', '-ss', String(Math.min(s.duree / 3, 30)), '-i', x.chemin, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', path.join(dossier, 'apercu.jpg')]);
      champs.apercu = 'apercu.jpg';
      const n = 12;
      await ffmpeg(['-y', '-i', x.chemin, '-map', '0:v:0', '-an', '-vf', `fps=${(n / s.duree).toFixed(5)},scale=320:-2,tile=4x3`, '-frames:v', '1', '-q:v', '4', path.join(dossier, 'planche.jpg')], {duree: s.duree});
      champs.planche = 'planche.jpg';
      if (s.son && s.duree <= 20 * 60) {
        const t = await texteParle(x.chemin, path.join(dossier, 'whisper.json')).catch(() => null);
        if (t) { fs.writeFileSync(path.join(dossier, 'texte.txt'), t); champs.texte = 'texte.txt'; }
      }
    }
  } else if (x.type === 'son') {
    const s = await sonder(x.chemin);
    champs.infos = s;
    if (s.duree) {
      await ffmpeg(['-y', '-i', x.chemin, '-filter_complex', 'aformat=channel_layouts=mono,showwavespic=s=480x120:colors=0xff8a3d', '-frames:v', '1', path.join(dossier, 'apercu.png')]).catch(() => null);
      if (fs.existsSync(path.join(dossier, 'apercu.png'))) champs.apercu = 'apercu.png';
      if (s.duree <= 20 * 60) {
        const t = await texteParle(x.chemin, path.join(dossier, 'whisper.json')).catch(() => null);
        if (t) { fs.writeFileSync(path.join(dossier, 'texte.txt'), t); champs.texte = 'texte.txt'; }
      }
    }
  } else if (x.type === 'archive') {
    champs.extrait = await decompresser(x.chemin, path.join(dossier, 'contenu'));
  } else {
    champs.apercu = await vignetteQuickLook(x.chemin, dossier);
  }
  majPiece(P, id, champs);
}
export function cheminApercu(P, id) {
  const x = piece(P, id);
  return x?.apercu ? path.join(dossierPiece(P, id), x.apercu) : null;
}

// ——— Le contexte dans le dossier de travail de Claude ———
const nomContexte = (x) => `${x.id}-${slug(path.parse(x.nom).name, 40) || 'piece'}${path.extname(x.nom).toLowerCase()}`;
/**
 * Installe toutes les pièces (et les créations du projet) dans <atelier>/contexte/, avec un INDEX.md.
 * Les originaux ne sont jamais copiés : des liens y mènent. Renvoie {nouvelles: [lignes pour le message]}.
 */
export function installerContexte(P, atelier, {echanges = [], creations = [], message = null} = {}) {
  const C = path.join(atelier, 'contexte');
  fs.mkdirSync(C, {recursive: true});
  // on refait les liens à chaque fois (une pièce a pu être retirée) ; on ne touche à rien d'autre
  for (const f of fs.readdirSync(C)) {
    const c = path.join(C, f);
    try { if (fs.lstatSync(c).isSymbolicLink()) delier(c); else if (/^(J\d+-|INDEX\.md$)/.test(f)) fs.rmSync(c, {recursive: true, force: true}); } catch { /* déjà parti */ }
  }
  const lier = (cible, nom) => lierFichier(cible, path.join(C, nom));
  // les pièces déjà envoyées (celles de ce message comprises : elles viennent d'y être rattachées)
  const pieces = listerPieces(P).filter((x) => !x.introuvable && x.message != null);
  const lignes = [];
  const L = ['# Ce que l’humain t’a donné', '',
    'Tout ce que l’humain a joint à la conversation : références, vidéos, charte graphique, logo, polices, archives, documents. Sers-t’en pour monter : respecte la charte (couleurs, polices, logo), inspire-toi des références, utilise les rushes donnés.',
    'Les fichiers sont des liens vers les originaux : ne les modifie pas. Pour t’en servir dans le kit, copie-les dans `remotion/public/`.', ''];
  for (const x of pieces) {
    const nom = nomContexte(x);
    lier(x.chemin, nom);
    const plus = [];
    const D = dossierPiece(P, x.id);
    if (x.planche && fs.existsSync(path.join(D, x.planche))) { const n = `${nom}.planche.jpg`; lier(path.join(D, x.planche), n); plus.push(`planche de 12 images : \`contexte/${n}\``); }
    if (x.texte && fs.existsSync(path.join(D, x.texte))) { const n = `${nom}.texte.txt`; lier(path.join(D, x.texte), n); plus.push(`ce qui est dit : \`contexte/${n}\``); }
    if (x.extrait && fs.existsSync(path.join(D, 'contenu'))) { const n = `${nom.replace(/\.zip$/i, '')}`; lier(path.join(D, 'contenu'), n); plus.push(`contenu décompressé (${x.extrait.fichiers} fichiers) : \`contexte/${n}/\``); }
    const infos = [ROLES[x.role] ?? x.role, x.type, x.taille_lisible,
      x.infos?.duree ? dureeLisible(x.infos.duree) : null, x.infos?.largeur ? `${x.infos.largeur}×${x.infos.hauteur}` : null].filter(Boolean).join(' · ');
    const quand = x.message != null ? `message ${x.message + 1}${echanges[x.message]?.texte ? ` (« ${String(echanges[x.message].texte).slice(0, 80)}${String(echanges[x.message].texte).length > 80 ? '…' : ''} »)` : ''}` : 'ce message';
    L.push(`## ${x.nom}`, '', `- Fichier : \`contexte/${nom}\``, `- ${infos}`, `- Donné avec le ${quand}`, ...plus.map((p) => `- ${p.charAt(0).toUpperCase()}${p.slice(1)}`), '');
    if (message != null && x.message === message) lignes.push(`- \`contexte/${nom}\` (${ROLES[x.role] ?? x.role}, ${x.type}${plus.length ? ` ; ${plus.join(' ; ')}` : ''})`);
  }
  if (!pieces.length) L.push('_Rien pour l’instant._', '');
  // les créations faites dans Dérush (musiques, voix, bruitages, images, vidéos)
  if (creations.length) {
    const DC = path.join(C, 'creations');
    try { for (const f of fs.readdirSync(DC)) delier(path.join(DC, f)); } catch { /* pas encore là */ }
    fs.mkdirSync(DC, {recursive: true});
    L.push('# Ce que l’humain a créé dans Dérush (ElevenLabs)', '', 'Il les a faites pour cette vidéo : utilise-les quand elles vont avec la demande.', '');
    for (const c of creations) {
      const n = path.basename(c.chemin);
      lierFichier(c.chemin, path.join(DC, n));
      L.push(`- \`contexte/creations/${n}\` — ${c.type_lisible ?? c.type} : « ${String(c.titre ?? '').slice(0, 120)} »${c.duree ? ` · ${dureeLisible(c.duree)}` : ''}`);
    }
    L.push('');
  }
  fs.writeFileSync(path.join(C, 'INDEX.md'), L.join('\n'));
  return {lignes, nombre: pieces.length};
}
