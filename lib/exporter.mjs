// Dérush — « Exporter », comme dans CapCut : un bouton toujours là, en haut. On choisit la vidéo (sa timeline, ou une
// vidéo livrée par l'IA), la qualité (1080p, 2K, 4K quand les rushes le permettent : jamais un agrandissement qui
// n'apporterait rien), et, si on veut, une copie par réseau. Rien n'est remonté : la vidéo de l'IA est rendue de nouveau
// depuis sa composition Remotion à une plus grande échelle (outils/exporter-ia.mjs : les mêmes images, plus fines, le
// même son), celle de la timeline par « Créer la vidéo » (lib/rendu.mjs), à la même échelle.
import fs from 'node:fs';
import path from 'node:path';
import {lancer, tailleLisible, ffmpeg, ecrireJson, FFPROBE} from './outils.mjs';
import {RACINE_APP} from './moteurs.mjs';
import {etatRendu, installerRendu, dossierMoteurRendu, creerVideo, envNode, NIVEAUX_SON} from './rendu.mjs';
import {FORMATS} from './commun.mjs';
import {lier, cloner} from './plateforme.mjs';
import {etatDemande} from './claude.mjs';
import {verifierPlace} from './disque.mjs';

export const QUALITES = {
  1080: {nom: '1080p', petit_cote: 1080, mot: 'HD'},
  1440: {nom: '2K', petit_cote: 1440, mot: '2K'},
  2160: {nom: '4K', petit_cote: 2160, mot: '4K'},
};
const RESEAUX_COPIE = {tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube'};

/** Le plus grand petit côté des rushes (vidéos et photos) : ce que la vidéo finale peut montrer de détails. */
function finesseRushes(P) {
  const m = P.d.medias.filter((x) => (x.type === 'video' || x.type === 'image') && x.largeur && x.hauteur && !x.de_la_conversation);
  return m.length ? Math.max(...m.map((x) => Math.min(x.largeur, x.hauteur))) : null;
}

/**
 * L'échelle exacte qui amène le petit côté vers `cible` en tombant sur une largeur et une hauteur entières et paires :
 * Remotion refuse une taille à virgule (1 080 × 1,3333 = 1 439,96), et le H.264 veut des tailles paires.
 */
export function echelleExacte(largeur, hauteur, cible) {
  const pgcd = (a, b) => (b ? pgcd(b, a % b) : a);
  const d = pgcd(largeur, hauteur);
  const [uw, uh] = [largeur / d, hauteur / d];
  let n = Math.max(1, Math.round(cible / (largeur <= hauteur ? uw : uh)));
  for (let k = 0; k < 12 && ((n * uw) % 2 || (n * uh) % 2); k++) n++;
  return {echelle: (n * uw) / largeur, largeur: n * uw, hauteur: n * uh};
}

/** Les qualités possibles pour une vidéo de cette taille : la sienne, et plus grand seulement si les rushes le permettent. */
function qualitesPour(largeur, hauteur, finesse) {
  const [w, h] = [Math.round(largeur || 1080), Math.round(hauteur || 1920)];
  const petit = Math.min(w, h);
  return Object.entries(QUALITES).map(([id, q]) => {
    const x = q.petit_cote <= petit ? {echelle: 1, largeur: w, hauteur: h} : echelleExacte(w, h, q.petit_cote);
    const agrandit = x.echelle > 1.01;
    // sans rush (motion design : des dessins, des textes) tout est net à toute taille ; avec, il faut des rushes assez fins
    const exacte = Math.abs(Math.min(x.largeur, x.hauteur) - Math.max(q.petit_cote, petit)) <= Math.max(q.petit_cote, petit) * 0.1;
    const possible = exacte && (!agrandit || finesse == null || finesse >= q.petit_cote * 0.95);
    return {id, nom: q.nom, echelle: x.echelle, largeur: x.largeur, hauteur: x.hauteur, possible,
      pourquoi: !exacte ? `La taille de ta vidéo (${w} × ${h}) ne tombe pas juste en ${q.nom}.` : possible ? (agrandit ? (finesse == null ? 'Tes images sont dessinées : nettes à toutes les tailles.' : `Tes rushes le permettent (${finesse} px).`) : 'La taille de ta vidéo.') : `Tes rushes font ${finesse} px de petit côté : la ${q.nom} ne montrerait pas plus de détails.`};
  });
}

/** Le dossier de travail de l'IA et la composition d'une vidéo livrée (pour la rendre plus grande), ou pourquoi c'est impossible. */
function compositionDe(P, version, video) {
  const atelier = version?.atelier ? path.join(P.racine, version.atelier) : null;
  if (!atelier || !fs.existsSync(path.join(atelier, 'remotion', 'src', 'index.ts'))) return {pourquoi: 'Le dossier de travail de l’IA n’est plus là.'};
  const derniere = etatDemande(P).versions.at(-1);
  if (derniere?.n !== version.n) return {pourquoi: 'Seule la dernière version de l’IA se refait en plus grand (son dossier de travail a changé depuis).'};
  // ce qui a été noté à la livraison (lib/claude.mjs), sinon le journal des rendus du kit, sinon « Montage » (vérifié par sa durée)
  if (video.composition?.id) return {atelier, id: video.composition.id, props: video.composition.props ?? {}, verifier: false};
  const journal = (() => { try { return fs.readFileSync(path.join(atelier, 'rendu', 'rendus.jsonl'), 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } })();
  const source = video.source ?? (version.videos.length === 1 ? 'rendu/final.mp4' : null);
  const r = source ? journal.filter((x) => String(x.sortie ?? '').replaceAll('\\', '/') === source).at(-1) : null;
  if (r?.composition) return {atelier, id: r.composition, props: r.props ?? {}, verifier: false};
  return {atelier, id: 'Montage', props: {}, verifier: true};
}

/** Ce que la feuille « Exporter » propose : la timeline, les vidéos de l'IA, et pour chacune les qualités possibles. */
export function optionsExport(P) {
  const finesse = finesseRushes(P);
  const e = etatDemande(P);
  const derniere = e.versions.at(-1) ?? null;
  const ia = [];
  for (const v of [...e.versions].reverse()) {
    for (const x of v.videos ?? []) {
      if (!x?.nom || !fs.existsSync(path.join(P.racine, 'vidéos', x.nom))) continue;
      const c = compositionDe(P, v, x);
      ia.push({nom: x.nom, titre: x.titre ?? `Version ${v.n}`, version: v.n, derniere: v.n === derniere?.n, largeur: x.largeur, hauteur: x.hauteur, duree: x.duree, moteur: v.moteur ?? 'claude',
        plus_grand: !c.pourquoi, pourquoi: c.pourquoi ?? null, qualites: qualitesPour(x.largeur, x.hauteur, finesse)});
    }
  }
  return {finesse, timeline: {largeur: P.d.sortie.largeur, hauteur: P.d.sortie.hauteur, plans: P.d.montage.length, qualites: qualitesPour(P.d.sortie.largeur, P.d.sortie.hauteur, finesse)}, ia, reseaux: RESEAUX_COPIE};
}

/** Une copie par réseau, à côté de la vidéo : la même (un clone) pour TikTok et YouTube, en 1080p pour Instagram (il n'en garde pas plus). */
async function copiesParReseau(video, info, reseaux, prog = () => {}) {
  // dans « vidéos/par réseau/ » : elles ne se mêlent pas aux vidéos du projet (« Avant de publier » ne liste que celles-ci)
  const D = path.join(path.dirname(video), 'par réseau');
  fs.mkdirSync(D, {recursive: true});
  const base = path.join(D, path.basename(video).replace(/\.mp4$/i, ''));
  const faites = [];
  for (const [k, n] of Object.entries(RESEAUX_COPIE).filter(([k]) => reseaux.includes(k))) {
    const dst = `${base} - ${n}.mp4`;
    fs.rmSync(dst, {force: true});
    const petit = Math.min(info.largeur, info.hauteur);
    if (k === 'instagram' && petit > 1080) {
      const vf = info.largeur < info.hauteur ? 'scale=1080:-2:flags=lanczos' : 'scale=-2:1080:flags=lanczos';
      await ffmpeg(['-y', '-i', video, '-map', '0:v:0', '-map', '0:a:0?', '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-c:a', 'copy', '-movflags', '+faststart', `${dst}.part.mp4`], {duree: info.duree, prog});
      fs.renameSync(`${dst}.part.mp4`, dst);
    } else if (!(await cloner(video, dst))) fs.copyFileSync(video, dst);
    faites.push({reseau: k, nom: path.basename(dst), chemin: dst});
  }
  return faites;
}

/**
 * Exporte. `source` : « timeline » (la vidéo ouverte, rendue par « Créer la vidéo ») ou « ia » (une vidéo livrée par
 * l'IA : `video`, son nom). `qualite` : 1080, 1440 ou 2160. `reseaux` : les copies à faire (tiktok, instagram, youtube).
 * Renvoie le résultat que montre l'interface (comme « Créer la vidéo »), avec `copies`.
 */
/** Le son seul d'une vidéo, en WAV 48 kHz à côté d'elle (Dérush 12 : pour un podcast, un mixage ailleurs). */
async function sonSeul(video) {
  const wav = video.replace(/\.mp4$/i, '.wav');
  await ffmpeg(['-y', '-v', 'error', '-i', video, '-vn', '-c:a', 'pcm_s16le', '-ar', '48000', wav]);
  return fs.existsSync(wav) ? wav : null;
}
export {NIVEAUX_SON};
export async function exporter(P, {source = 'timeline', video = null, qualite = 1080, reseaux = [], plateforme = null, donnees = null, enCours = () => false, lufs = -14, formes = [], passage = null, wav = false} = {}, prog = () => {}) {
  const q = QUALITES[qualite] ? Number(qualite) : 1080;
  const voulus = (Array.isArray(reseaux) ? reseaux : []).filter((k) => RESEAUX_COPIE[k]);
  const place = verifierPlace(P.racine);
  if (!place.ok) throw new Error(place.texte);
  const finesse = finesseRushes(P);
  if (source !== 'ia') {
    const d = donnees ?? P.d;
    const choix = qualitesPour(d.sortie.largeur, d.sortie.hauteur, finesse).find((x) => Number(x.id) === q);
    if (!choix?.possible) throw new Error(choix?.pourquoi ?? 'Cette qualité n’est pas possible pour cette vidéo.');
    // 12.0 : la même timeline dans d'autres formats (le cadrage suit le sujet), un passage seulement, le niveau du son, le WAV
    const autres = (Array.isArray(formes) ? formes : []).filter((k) => FORMATS[k] && k !== d.sortie.preset).slice(0, 3);
    const n = 1 + autres.length;
    const part = (k) => (p) => prog(((k + p) / n) * (voulus.length ? 0.9 : 1));
    const opts = {plateforme, lufs: lufs === 'tel' || lufs === null ? null : Number(lufs) || -14, passage};
    const r = await creerVideo(P, {...opts, donnees, echelle: choix.echelle, suffixe: [choix.echelle > 1.01 ? QUALITES[q].mot : '', passage ? 'passage' : ''].filter(Boolean).join('-')}, part(0));
    r.formes = [];
    for (const [k, forme] of autres.entries()) {
      const dd = structuredClone(donnees ?? P.d);
      Object.assign(dd.sortie, {preset: forme, largeur: FORMATS[forme].largeur, hauteur: FORMATS[forme].hauteur});
      const ch = qualitesPour(dd.sortie.largeur, dd.sortie.hauteur, finesse).find((x) => Number(x.id) === q);
      const e = ch?.possible ? ch.echelle : 1;
      const x = await creerVideo(P, {...opts, donnees: dd, echelle: e, suffixe: [forme, e > 1.01 ? QUALITES[q].mot : '', passage ? 'passage' : ''].filter(Boolean).join('-')}, part(k + 1));
      r.formes.push({forme, nom: FORMATS[forme].nom, video: x.video, largeur: x.largeur, hauteur: x.hauteur});
    }
    if (wav) r.wav = await sonSeul(r.video);
    r.copies = voulus.length ? await copiesParReseau(r.video, r, voulus, (p) => prog(0.9 + p * 0.1)) : [];
    r.qualite = QUALITES[q].nom;
    r.niveau = NIVEAUX_SON[String(lufs)] ?? NIVEAUX_SON['-14'];
    return r;
  }
  // une vidéo de l'IA
  if (enCours()) throw new Error('Ton IA travaille sur ce projet : exporte quand elle a fini (son dossier de travail bouge encore).');
  const e = etatDemande(P);
  const version = e.versions.find((v) => (v.videos ?? []).some((x) => x.nom === video));
  const x = version?.videos.find((y) => y.nom === video);
  if (!x) throw new Error('Cette vidéo n’est plus là.');
  const choix = qualitesPour(x.largeur, x.hauteur, finesse).find((y) => Number(y.id) === q);
  if (!choix?.possible) throw new Error(choix?.pourquoi ?? 'Cette qualité n’est pas possible pour cette vidéo.');
  const dossier = path.join(P.racine, 'vidéos');
  const base = x.nom.replace(/\.mp4$/i, '');
  let sortie = path.join(dossier, `${base}-${QUALITES[q].mot}.mp4`);
  if (choix.echelle <= 1.01) {
    // sa propre taille : la vidéo livrée elle-même (déjà rendue à cette taille, rien à refaire)
    sortie = path.join(dossier, x.nom);
  } else {
    const c = compositionDe(P, version, x);
    if (c.pourquoi) throw new Error(c.pourquoi);
    if (!etatRendu().ok) await installerRendu((p) => prog(p * 0.1));
    const REM = path.join(c.atelier, 'remotion');
    const lien = path.join(REM, 'node_modules');
    if (!fs.existsSync(lien) && !lier(path.join(dossierMoteurRendu(), 'node_modules'), lien)) throw new Error('Impossible de relier le moteur de rendu au dossier de travail de l’IA.');
    let total = 0;
    const suivre = (t) => { for (const m of String(t).matchAll(/Rendered (\d+)\/(\d+)/g)) { total = Number(m[2]); prog(0.1 + 0.8 * (Number(m[1]) / Math.max(1, total))); } };
    try {
      await lancer(process.execPath, [path.join(RACINE_APP, 'outils', 'exporter-ia.mjs'), REM, c.id, sortie, '--echelle', String(choix.echelle), '--props', JSON.stringify(c.props ?? {}), ...(c.verifier && x.duree ? ['--duree', String(x.duree)] : [])],
        {cwd: REM, env: envNode(), surStdout: (b) => suivre(b.toString()), surStderr: (b) => suivre(b.toString())});
    } catch (err) {
      fs.rmSync(`${sortie}.part.mp4`, {force: true});
      if (/COMPOSITION/.test(err.message)) throw new Error('Dérush ne retrouve pas la composition de cette vidéo dans le dossier de travail de l’IA : demande-lui de la rendre en 4K.');
      throw new Error(`L’export a échoué : ${String(err.message).replace(/\s+/g, ' ').slice(-500)}`);
    }
  }
  prog(0.92);
  const {out} = await lancer(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration,size', '-of', 'json', sortie]).catch(() => ({out: Buffer.from('{}')}));
  const j = (() => { try { return JSON.parse(out.toString()); } catch { return {}; } })();
  const info = {largeur: j.streams?.[0]?.width ?? choix.largeur, hauteur: j.streams?.[0]?.height ?? choix.hauteur, duree: Number(j.format?.duration) || x.duree || 0, taille: Number(j.format?.size) || fs.statSync(sortie).size};
  const copies = voulus.length ? await copiesParReseau(sortie, info, voulus, (p) => prog(0.92 + p * 0.08)) : [];
  const resultat = {video: sortie, nom: path.basename(sortie), dossier, planche: null, reseau: null, reseau_nom: `${QUALITES[q].nom} · vidéo de l’IA`, qualite: QUALITES[q].nom,
    duree: info.duree, largeur: info.largeur, hauteur: info.hauteur, taille: info.taille, taille_lisible: tailleLisible(info.taille), controles: [], avertissements: [], copies, cree_le: new Date().toISOString(), source: 'ia', depuis: x.nom};
  if (sortie !== path.join(dossier, x.nom)) ecrireJson(sortie.replace(/\.mp4$/i, '.json'), resultat, 2);
  prog(1);
  return resultat;
}
