// Dérush — « Créer la vidéo » : le montage et son habillage rendus en MP4 sur le Mac, puis contrôlés.
// Le rendu passe par le kit Remotion du pack : la vidéo créée ici est exactement celle que l'IA reçoit comme base.
import fs from 'node:fs';
import path from 'node:path';
import {arrondi, slug, sequence, dureeLisible} from './commun.mjs';
import {lancer, ffmpeg, FFMPEG, FFPROBE, ecrireJson, lireJson, tailleLisible} from './outils.mjs';
import {DOSSIER_SUPPORT, RACINE_APP} from './moteurs.mjs';
import {commandeNode, pathAvec, lier} from './plateforme.mjs';
import {exporterPack} from './pack.mjs';
import {PLATEFORMES, styleComplet} from '../public/moteur.js';
import {verifierPlace} from './disque.mjs';

const MOTEUR = path.join(DOSSIER_SUPPORT, 'moteurs', 'rendu');
const KIT = path.join(RACINE_APP, 'modeles', 'kit-remotion');
const cli = () => path.join(MOTEUR, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const versionVoulue = () => lireJson(path.join(KIT, 'package.json'))?.dependencies?.remotion ?? null;
const p2 = (n) => String(n).padStart(2, '0');
// Node doit se trouver dans le PATH des outils lancés (npm, Remotion), même quand l'app est ouverte depuis le Finder
const envNode = () => pathAvec([path.dirname(process.execPath)]);

/** Le moteur de rendu est-il installé, à la version du kit ? */
export function etatRendu() {
  const installee = lireJson(path.join(MOTEUR, 'node_modules', 'remotion', 'package.json'))?.version ?? null;
  // le moteur doit avoir toutes les bibliothèques du kit (Remotion, 3D, animation) : sinon il est à mettre à jour
  const voulues = lireJson(path.join(KIT, 'package.json'))?.dependencies ?? {};
  const presentes = lireJson(path.join(MOTEUR, 'package.json'))?.dependencies ?? {};
  const aJour = Object.entries(voulues).every(([nom, v]) => presentes[nom] === v && fs.existsSync(path.join(MOTEUR, 'node_modules', ...nom.split('/'), 'package.json')));
  const complet = installee && installee === versionVoulue() && aJour && fs.existsSync(cli()) && fs.existsSync(path.join(MOTEUR, '.navigateur-pret'));
  return complet
    ? {ok: true, nom: `Rendu vidéo (Remotion ${installee})`, detail: 'Fabrique la vidéo finale sur ton ordinateur, avec tous les effets.'}
    : {ok: false, installable: true, taille: '600 Mo', nom: 'Rendu vidéo', pourquoi: installee ? 'Le moteur de rendu doit être mis à jour.' : 'Le moteur de rendu n’est pas encore installé.'};
}

/** Installe le moteur de rendu (Remotion et son navigateur sans fenêtre) dans le dossier des moteurs. */
export async function installerRendu(prog = () => {}) {
  fs.mkdirSync(MOTEUR, {recursive: true});
  const pkg = lireJson(path.join(KIT, 'package.json'));
  ecrireJson(path.join(MOTEUR, 'package.json'), {name: 'derush-moteur-rendu', private: true, dependencies: pkg.dependencies}, 2);
  fs.rmSync(path.join(MOTEUR, '.navigateur-pret'), {force: true});
  prog(0.05);
  try {
    await lancer(commandeNode('npm'), ['install', '--no-audit', '--no-fund', '--loglevel=error'], {cwd: MOTEUR, env: envNode()});
  } catch (e) {
    throw new Error(`Le moteur de rendu n’a pas pu être installé (il faut Internet et Node.js) : ${String(e.message).slice(0, 300)}`);
  }
  prog(0.7);
  // le navigateur sans fenêtre de Remotion (téléchargé une seule fois)
  await lancer(process.execPath, [cli(), 'browser', 'ensure'], {cwd: MOTEUR, env: envNode()});
  fs.writeFileSync(path.join(MOTEUR, '.navigateur-pret'), new Date().toISOString());
  prog(1);
  return etatRendu();
}

/** Mesure le niveau du son d'un fichier (LUFS intégrés, crête vraie, etc.) avec le filtre loudnorm. */
async function mesurerSon(fichier) {
  const {err} = await lancer(FFMPEG, ['-hide_banner', '-nostdin', '-i', fichier, '-map', '0:a:0?', '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-']);
  const m = /\{\s*"input_i"[\s\S]*?\}/.exec(err);
  if (!m) return null;
  const j = JSON.parse(m[0]);
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  return {i: n(j.input_i), tp: n(j.input_tp), lra: n(j.input_lra), seuil: n(j.input_thresh), decalage: n(j.target_offset)};
}

/** Met le son au niveau des réseaux (−14 LUFS, crête à −1 dBTP au plus) sans réencoder l'image. */
async function reglerSon(entree, sortie) {
  const avant = await mesurerSon(entree);
  // pas de son, ou un silence : on ne touche à rien
  if (!avant || avant.i == null || avant.i < -60) {
    await ffmpeg(['-y', '-i', entree, '-c', 'copy', '-movflags', '+faststart', sortie]);
    return {avant, apres: avant, regle: false};
  }
  const passe = async (tp) => {
    await ffmpeg(['-y', '-i', entree, '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy',
      '-af', `loudnorm=I=-14:TP=${tp}:LRA=11:measured_I=${avant.i}:measured_TP=${avant.tp}:measured_LRA=${avant.lra}:measured_thresh=${avant.seuil}:offset=${avant.decalage ?? 0}:linear=true,aresample=48000`,
      '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', sortie]);
    return mesurerSon(sortie);
  };
  let apres = await passe(-1.2);
  // l'encodeur peut faire remonter la crête : on recommence un peu plus bas
  if (apres?.tp != null && apres.tp > -0.9) apres = await passe(-2);
  return {avant, apres, regle: true};
}

async function sonder(fichier) {
  const {out} = await lancer(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', fichier]);
  const j = JSON.parse(out.toString());
  const v = j.streams.find((s) => s.codec_type === 'video') ?? {};
  const a = j.streams.find((s) => s.codec_type === 'audio') ?? null;
  const [n, d] = String(v.avg_frame_rate ?? '0/1').split('/').map(Number);
  return {
    duree: Number(j.format.duration) || 0, taille: Number(j.format.size) || 0, largeur: v.width, hauteur: v.height, fps: d ? arrondi(n / d, 3) : 0, codec: v.codec_name,
    pixels: v.pix_fmt, couleur: [v.color_primaries, v.color_transfer, v.color_space].map((x) => x ?? 'inconnu'), son: a ? `${a.codec_name} ${a.channels} canaux ${a.sample_rate} Hz` : null,
  };
}

/** Une planche de huit images de la vidéo, avec en rouge les zones que l'interface du réseau recouvre. */
async function planche(video, sortie, duree, zones) {
  const z = zones;
  const boite = (x, y, w, h) => `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=red@0.3:t=fill`;
  const filtres = [`fps=${arrondi(8 / Math.max(0.5, duree), 5)}`, 'scale=270:-2',
    boite(0, 0, 'iw', `ih*${z.haut}`), boite(0, `ih*${1 - z.bas}`, 'iw', `ih*${z.bas}`), boite(0, 0, `iw*${z.gauche}`, 'ih'), boite(`iw*${1 - z.droite}`, 0, `iw*${z.droite}`, 'ih'), 'tile=8x1'];
  await ffmpeg(['-y', '-i', video, '-vf', filtres.join(','), '-frames:v', '1', '-q:v', '3', sortie]);
}

/**
 * Contrôle une vidéo avant publication : format, durée, niveau du son, couleurs, et planche des zones cachées.
 * `son` : {avant, apres, regle} si Dérush vient de régler le son ; sinon il est mesuré ici. `donnees` : le projet tel
 * qu'il a été rendu (une autre vidéo du projet que celle qui est ouverte : son format à elle) ; sinon le projet ouvert.
 */
export async function controlerVideo(P, video, reseau, son = null, sansST = null, donnees = null) {
  const d = donnees ?? P.d;
  const style = styleComplet(d.style, d.sortie);
  if (!PLATEFORMES[reseau]) reseau = style.plateforme;
  const info = await sonder(video);
  if (!son) { const m = await mesurerSon(video).catch(() => null); son = {avant: m, apres: m, regle: false}; }
  const zones = PLATEFORMES[reseau].zones;
  let fichierPlanche = video.replace(/\.mp4$/, '-planche.jpg');
  try { await planche(video, fichierPlanche, info.duree, zones); } catch { fichierPlanche = null; }
  const nomReseau = PLATEFORMES[reseau].nom;
  const controles = [];
  const bonFormat = info.largeur === d.sortie.largeur && info.hauteur === d.sortie.hauteur && Math.abs(info.fps - d.sortie.fps) < 0.01;
  controles.push({ok: bonFormat, t: `Format : ${info.largeur} × ${info.hauteur}, ${info.fps} images/s, ${info.codec}`, d: bonFormat ? null : `Attendu : ${d.sortie.largeur} × ${d.sortie.hauteur}, ${d.sortie.fps} images/s.`});
  const max = PLATEFORMES[reseau].duree_max_s;
  controles.push({ok: !max || info.duree <= max, t: `Durée : ${dureeLisible(info.duree)}`, d: max && info.duree > max ? `${nomReseau} accepte en général ${dureeLisible(max)} au plus.` : null});
  if (son.apres?.i != null && son.apres.i > -60) {
    const bon = Math.abs(son.apres.i + 14) <= 1 && son.apres.tp <= -0.9;
    controles.push({ok: bon, t: `Son : ${arrondi(son.apres.i, 1)} LUFS, crête ${arrondi(son.apres.tp, 1)} dBTP`, d: bon ? `Au niveau des réseaux (−14 LUFS)${son.regle && son.avant ? `, il était à ${arrondi(son.avant.i, 1)}` : ''}.` : 'Le niveau visé est −14 LUFS, avec une crête à −1 dBTP au plus.'});
  } else controles.push({ok: true, t: 'Son : la vidéo est muette', d: null});
  const bt709 = info.couleur.every((x) => x === 'bt709');
  controles.push({ok: bt709, t: `Couleurs : ${bt709 ? 'BT.709' : info.couleur.join(' / ')}`, d: bt709 ? null : 'Certaines applis peuvent afficher des couleurs un peu différentes.'});
  if (sansST != null) {
    controles.push({ok: true, t: `Textes hors des zones cachées par ${nomReseau}`, d: 'Les titres et les sous-titres de Dérush se placent tout seuls dans la zone visible. Regarde la planche pour les visages.'});
    if (style.sous_titres.style !== 'aucun') controles.push({ok: true, info: !sansST, t: sansST ? `${sansST} plan(s) sans sous-titres ajoutés` : 'Sous-titres ajoutés sur tous les plans', d: sansST ? null : 'Si un plan a déjà des sous-titres incrustés, coche « Ce plan a déjà des sous-titres » dans ses infos.'});
  }
  return {info, controles, fichierPlanche, nomReseau, son, reseau};
}

/** Range un fichier fini à sa place : un simple renommage, ou d'un disque à l'autre une copie sous un nom provisoire. */
export function deplacer(src, dst) {
  try {
    fs.renameSync(src, dst);
  } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    const tmp = `${dst}.part`;
    try {
      fs.copyFileSync(src, tmp);
      fs.renameSync(tmp, dst);
    } catch (x) {
      fs.rmSync(tmp, {force: true});
      throw x;
    }
    fs.rmSync(src, {force: true});
  }
}

/** Le dossier où le moteur de rendu est installé (son node_modules sert aussi au kit des packs). */
export const dossierMoteurRendu = () => MOTEUR;

/** La vidéo du projet que porte `d` (lib/sequences.mjs), quand le projet en a plusieurs : {id, nom}, sinon null. */
function videoRendue(d) {
  const liste = Array.isArray(d.sequences) ? d.sequences : [];
  if (liste.length < 2) return null;
  const k = liste.findIndex((s) => s?.id === d.sequence);
  return k < 0 ? null : {id: liste[k].id, nom: String(liste[k].nom || `Vidéo ${k + 1}`)};
}

/**
 * Crée la vidéo finale du projet : export léger du pack, rendu par le kit, son réglé, contrôles, planche.
 * Renvoie {video, planche, controles, …}. La vidéo est rangée dans « vidéos » à côté du projet.
 * `donnees` : le projet figé au moment du clic, avec la vidéo à rendre posée à la place de la vidéo ouverte
 * (donneesSequence, lib/sequences.mjs : « Créer toutes les vidéos ») ; sans lui, la vidéo ouverte telle qu'elle est.
 */
export async function creerVideo(P, {plateforme = null, donnees = null} = {}, prog = () => {}) {
  const d = donnees ?? P.d;
  const laVideo = videoRendue(d);
  if (!sequence(d).segs.length) throw new Error('Le montage est vide : ajoute au moins un plan.');
  const place = verifierPlace(P.racine);
  if (!place.ok) throw new Error(place.texte);
  let part = 0;
  if (!etatRendu().ok) {
    await installerRendu((p) => prog(p * 0.2));
    part = 0.2;
  }
  const style = styleComplet(d.style, d.sortie);
  const reseau = PLATEFORMES[plateforme] ? plateforme : style.plateforme;
  const travail = path.join(P.cache, 'rendu');
  const pack = await exporterPack(P, (p) => prog(part + p * (0.3 - part * 0.5)), {leger: true, dossier: travail, ...(donnees ? {donnees: structuredClone(donnees)} : {})});
  const kit = path.join(travail, 'remotion');
  if (!lier(path.join(MOTEUR, 'node_modules'), path.join(kit, 'node_modules'))) throw new Error('Impossible de relier le moteur de rendu au montage (droits du dossier ?).');
  const brut = path.join(travail, 'rendu', 'brut.mp4');
  const base = 0.3 + part * 0.5;
  let rendues = 0;
  let encodees = 0;
  const suivre = (txt) => {
    for (const m of String(txt).matchAll(/Rendered (\d+)\/(\d+)/g)) rendues = Number(m[1]) / Math.max(1, Number(m[2]));
    for (const m of String(txt).matchAll(/Encoded (\d+)\/(\d+)/g)) encodees = Number(m[1]) / Math.max(1, Number(m[2]));
    prog(base + (0.9 - base) * (rendues * 0.85 + encodees * 0.15));
  };
  try {
    await lancer(process.execPath, [cli(), 'render', 'src/index.ts', 'Montage', brut, '--props', JSON.stringify({afficherConsignes: false}), '--color-space=bt709', '--crf=16', '--audio-bitrate=256k', '--log=info'],
      {cwd: kit, env: envNode(), surStdout: (b) => suivre(b.toString()), surStderr: suivre});
  } catch (e) {
    throw new Error(`Le rendu a échoué : ${String(e.message).replace(/\s+/g, ' ').slice(-600)}`);
  }
  prog(0.9);

  // la vidéo finale, rangée à côté du projet
  const m = new Date();
  const horodatage = `${m.getFullYear()}${p2(m.getMonth() + 1)}${p2(m.getDate())}-${p2(m.getHours())}${p2(m.getMinutes())}${p2(m.getSeconds())}`;
  const dossier = path.join(P.racine, 'vidéos');
  fs.mkdirSync(dossier, {recursive: true});
  // plusieurs vidéos dans le projet : le nom de celle-ci, pour s'y retrouver dans « vidéos »
  const nom = `${slug(d.titre) || 'montage'}${laVideo ? `-${slug(laVideo.nom, 30) || laVideo.id.toLowerCase()}` : ''}-${horodatage}`;
  const video = path.join(dossier, `${nom}.mp4`);
  // le son se règle dans le dossier de travail (une ou deux passes) : la vidéo n'arrive dans « vidéos » qu'entière.
  // Écrite sur place, une vidéo coupée (Dérush quitté, une passe qui échoue) y restait, montrée comme une vraie.
  const reglee = path.join(travail, 'rendu', 'final.mp4');
  const son = await reglerSon(brut, reglee);
  deplacer(reglee, video);
  prog(0.95);
  const {info, controles, fichierPlanche, nomReseau} = await controlerVideo(P, video, reseau, son, pack.plans_sans_sous_titres ?? 0, d);
  const planchePrete = !!fichierPlanche;

  const resultat = {
    video, nom: `${nom}.mp4`, dossier, planche: planchePrete ? fichierPlanche : null, reseau, reseau_nom: nomReseau,
    duree: arrondi(info.duree, 2), largeur: info.largeur, hauteur: info.hauteur, fps: info.fps, taille: info.taille, taille_lisible: tailleLisible(info.taille),
    lufs: son.apres?.i ?? null, crete_dbtp: son.apres?.tp ?? null, controles, avertissements: pack.avertissements, effets: pack.effets, cree_le: m.toISOString(),
    ...(laVideo ? {sequence: laVideo} : {}),
  };
  ecrireJson(path.join(dossier, `${nom}.json`), resultat, 2);
  if (process.env.DERUSH_GARDER_RENDU !== '1') fs.rmSync(travail, {recursive: true, force: true});
  prog(1);
  return resultat;
}
