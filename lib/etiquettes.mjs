// Dérush — ce qu'on voit dans un rush (Dérush 12) : Apple Vision regarde une image toutes les deux secondes et dit ce
// qu'elle montre (« beach », « dog », « night_sky »… : 1 303 étiquettes, en anglais), sur le Mac, sans rien envoyer.
// Gardé dans le cache du rush (etiquettes.json) : « Trouver un moment » (la recherche des médias) et la porte des IA
// (chercher_medias) y cherchent en français. Idée reprise d'Editroom (Robbie Tilton, licence MIT) : la recherche par
// ce qu'on voit, et les mots de tous les jours pour les étiquettes de Vision.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg, lancer, lireJson, ecrireJson} from './outils.mjs';
import {binVision} from './moteurs.mjs';
import {fichierLecture} from './medias.mjs';
import {arrondi} from './commun.mjs';

export const VERSION_ETIQUETTES = 1;
/** Une image regardée toutes les PAS secondes (au plus MAX_IMAGES par rush). */
const PAS = 2;
const MAX_IMAGES = 90;
/** Une étiquette est gardée pour un rush si Vision en est assez sûr quelque part (0,3), et à un temps si elle y vaut 0,25. */
const SEUIL_RUSH = 0.3;
const SEUIL_TEMPS = 0.25;

/**
 * Les mots de tous les jours, en français, et les étiquettes de Vision qu'ils désignent. Un mot cherché trouve aussi ses
 * formes voisines (pluriel, début du mot) ; une étiquette anglaise se cherche aussi telle quelle.
 */
export const MOTS = {
  personne: ['people', 'adult', 'child', 'baby', 'teen', 'crowd'], gens: ['people', 'crowd'], foule: ['crowd', 'concert', 'stadium'], enfant: ['child', 'baby', 'teen'],
  bebe: ['baby'], ado: ['teen'], adulte: ['adult'],
  chien: ['dog'], chat: ['cat', 'adult_cat'], oiseau: ['bird'], cheval: ['horse'], poisson: ['fish'], animal: ['animal', 'dog', 'cat', 'bird', 'horse', 'fish'],
  plage: ['beach', 'shore', 'sand'], mer: ['ocean', 'shore', 'water_body'], ocean: ['ocean'], sable: ['sand', 'sand_dune'], vague: ['ocean', 'shore'],
  montagne: ['mountain', 'hill'], colline: ['hill'], foret: ['forest', 'tree'], arbre: ['tree', 'palm_tree'], palmier: ['palm_tree'], fleur: ['flower', 'flower_arrangement'],
  jardin: ['garden'], parc: ['park', 'amusement_park'], lac: ['lake'], riviere: ['river'], fleuve: ['river'], cascade: ['waterfall'], eau: ['water', 'water_body', 'pool'],
  desert: ['desert', 'sand_dune'], neige: ['snow', 'winter_sport'], ciel: ['sky', 'blue_sky'], nuage: ['sky'], soleil: ['sun', 'sunset_sunrise'],
  coucher: ['sunset_sunrise'], lever: ['sunset_sunrise'], nuit: ['night_sky', 'moon'], lune: ['moon'], feu: ['fire', 'candle'], bougie: ['candle'],
  ville: ['building', 'skyscraper', 'street'], rue: ['street', 'road', 'alley'], route: ['road', 'dirt_road'], immeuble: ['building', 'skyscraper'], batiment: ['building'],
  gratte: ['skyscraper'], maison: ['house_single'], pont: ['bridge'], tour: ['tower', 'clock_tower'], chateau: ['castle'], statue: ['statue'], graffiti: ['graffiti'],
  restaurant: ['restaurant'], cuisine: ['kitchen', 'kitchen_room'], salon: ['living_room'], chambre: ['bedroom'], bureau: ['office_supplies', 'computer'], classe: ['classroom'],
  ecole: ['classroom'], stade: ['stadium'], concert: ['concert', 'stage'], scene: ['stage'], musee: ['museum'], magasin: ['interior_shop'], boutique: ['interior_shop'],
  piscine: ['pool', 'swimming'], gare: ['train_station'], aeroport: ['airport'],
  voiture: ['car'], auto: ['car'], bus: ['bus'], train: ['train', 'train_real'], velo: ['bicycle'], moto: ['motorcycle'], avion: ['airplane', 'aircraft'], bateau: ['boat', 'cruise_ship'],
  manger: ['food'], nourriture: ['food'], plat: ['food'], pizza: ['pizza'], gateau: ['cake', 'birthday_cake', 'wedding_cake'], pain: ['bread'], sushi: ['sushi'], ramen: ['ramen'],
  nouilles: ['ramen', 'pasta'], pates: ['pasta'], soupe: ['soup'], riz: ['rice'], viande: ['meat'], poulet: ['fried_chicken', 'grilled_chicken'], salade: ['salad'], dessert: ['dessert'],
  glace: ['ice_cream', 'frozen_dessert'], chocolat: ['chocolate'], fruit: ['fruit'], cafe: ['coffee'], the: ['tea_drink'], boisson: ['drink'], vin: ['wine', 'red_wine', 'white_wine'], biere: ['beer'],
  ordinateur: ['computer', 'laptop'], telephone: ['phone'], livre: ['book'], camera: ['camera'], appareil: ['camera'], guitare: ['guitar'], piano: ['piano'], micro: ['microphone'],
  batterie: ['drum'], tambour: ['drum', 'bongo_drum'], musique: ['music', 'concert', 'guitar', 'piano', 'microphone'], ballon: ['ball', 'soccer', 'basketball', 'football'],
  foot: ['soccer'], football: ['soccer', 'football'], basket: ['basketball'], tennis: ['tennis'], golf: ['golf'], boxe: ['boxing'], natation: ['swimming'], nager: ['swimming'],
  ski: ['ski_equipment', 'winter_sport'], sport: ['sport'], danse: ['dance'], danser: ['dance'],
  mariage: ['wedding', 'wedding_cake', 'wedding_dress'], anniversaire: ['birthday_cake'], feux: ['fireworks'], artifice: ['fireworks'], fete: ['fireworks', 'birthday_cake', 'concert'],
  noel: ['christmas_tree', 'christmas_decoration'], table: ['table'], chaise: ['chair'], fenetre: ['window'], porte: ['door'], lampe: ['lamp', 'light'], lumiere: ['light'],
  ecran: ['computer_monitor', 'screenshot'], texte: ['document', 'screenshot'], document: ['document'], affiche: ['art', 'illustrations'], dessin: ['illustrations', 'art', 'drawing'],
  tableau: ['painting', 'art'], peinture: ['painting'], art: ['art'],
};
/** Le mot français d'une étiquette de Vision (le premier mot du dictionnaire qui la désigne), sinon l'étiquette lisible. */
const NOMS = new Map();
for (const [mot, ids] of Object.entries(MOTS)) for (const id of ids) if (!NOMS.has(id)) NOMS.set(id, mot);
export const nomEtiquette = (id) => NOMS.get(id) ?? String(id).replace(/_/g, ' ');
/** Un mot sans majuscule, sans accent ni ponctuation. */
const simple = (w) => String(w ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Les étiquettes de Vision que désigne un mot cherché (français, ou étiquette anglaise), formes voisines comprises. */
export function etiquettesDuMot(mot) {
  const m = simple(mot);
  if (!m) return [];
  const res = new Set();
  for (const [fr, ids] of Object.entries(MOTS)) {
    // « chiens » trouve « chien », « gât » trouve « gâteau » (en tapant), « voiture » trouve « voiture »
    if (fr === m || (m.length >= 3 && fr.startsWith(m)) || (m.endsWith('s') && fr === m.slice(0, -1)) || (m.endsWith('x') && fr === m.slice(0, -1))) for (const id of ids) res.add(id);
  }
  // une étiquette anglaise telle quelle (« beach », « night sky »)
  res.add(m.replace(/ /g, '_'));
  return [...res];
}

/** Les étiquettes d'un rush (etiquettes.json), ou null si Vision ne l'a pas encore regardé. */
export const lireEtiquettes = (P, m) => {
  const j = lireJson(path.join(P.cache, 'medias', m.id, 'etiquettes.json'));
  return j?.version === VERSION_ETIQUETTES ? j : null;
};

/**
 * Regarde un rush (une vidéo : une image toutes les deux secondes ; une photo : elle) et range ce qu'il montre :
 * {version, etiquettes: [{id, nom, conf, temps: [secondes du fichier]}]}. Rend false sans Apple Vision (hors Mac).
 */
export async function etiqueterMedia(P, m, prog = () => {}) {
  if (m.type !== 'video' && m.type !== 'image') return false;
  const vision = await binVision({etiquettes: true});
  if (!vision) return false;
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-etiquettes-'));
  try {
    const f = fichierLecture(P, m);
    const temps = [];
    if (m.type === 'image') {
      await ffmpeg(['-y', '-v', 'error', '-i', f, '-frames:v', '1', '-vf', 'scale=512:512:force_original_aspect_ratio=decrease', path.join(dossier, 'i00000.jpg')]);
      temps.push(0);
    } else {
      const n = Math.max(1, Math.min(MAX_IMAGES, Math.ceil((m.duree ?? 0) / PAS)));
      const pas = (m.duree ?? 0) / n;
      await ffmpeg(['-y', '-v', 'error', '-i', f, '-vf', `fps=1/${Math.max(0.2, pas).toFixed(4)},scale=512:512:force_original_aspect_ratio=decrease`, '-frames:v', String(n), '-q:v', '4', path.join(dossier, 'i%05d.jpg')]);
      for (let k = 0; k < n; k++) temps.push(arrondi(Math.min(m.duree, (k + 0.5) * pas), 2));
    }
    prog(0.4);
    const {out} = await lancer(vision, ['etiquettes', dossier]);
    const images = JSON.parse(out.toString()).images ?? [];
    const parId = new Map();
    images.forEach((im, k) => {
      for (const [id, conf] of im.etiquettes ?? []) {
        const e = parId.get(id) ?? {id, conf: 0, temps: []};
        e.conf = Math.max(e.conf, conf);
        if (conf >= SEUIL_TEMPS && temps[k] != null) e.temps.push(temps[k]);
        parId.set(id, e);
      }
    });
    const etiquettes = [...parId.values()].filter((e) => e.conf >= SEUIL_RUSH).sort((a, b) => b.conf - a.conf).slice(0, 40)
      .map((e) => ({id: e.id, nom: nomEtiquette(e.id), conf: arrondi(e.conf, 3), temps: e.temps.slice(0, 60)}));
    ecrireJson(path.join(P.cache, 'medias', m.id, 'etiquettes.json'), {version: VERSION_ETIQUETTES, le: new Date().toISOString(), etiquettes}, 2);
    prog(1);
    return true;
  } finally {
    fs.rmSync(dossier, {recursive: true, force: true});
  }
}

/**
 * Cherche dans les rushes ce qu'on voit : tous les mots doivent y être (« voiture nuit »). Rend
 * [{media, nom, etiquettes: [noms], temps: [secondes du fichier où tout se voit, sinon où le premier se voit]}].
 */
export function chercherMontre(P, texte) {
  const mots = String(texte ?? '').split(/[\s,]+/).map(simple).filter((w) => w.length >= 2 && !['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'avec', 'sur', 'dans'].includes(w));
  if (!mots.length) return [];
  const res = [];
  for (const m of P.d.medias) {
    const e = lireEtiquettes(P, m);
    if (!e) continue;
    const parMot = mots.map((w) => { const ids = new Set(etiquettesDuMot(w)); return e.etiquettes.filter((x) => ids.has(x.id)); });
    if (parMot.some((l) => !l.length)) continue;
    const ensembles = parMot.map((l) => new Set(l.flatMap((x) => x.temps)));
    let temps = [...ensembles[0]].filter((t) => ensembles.every((s) => s.has(t)));
    if (!temps.length) temps = [...ensembles[0]];
    const conf = Math.min(...parMot.map((l) => Math.max(...l.map((x) => x.conf))));
    res.push({media: m.id, nom: m.nom, etiquettes: [...new Set(parMot.flat().map((x) => x.nom))], temps: temps.sort((a, b) => a - b).slice(0, 20), conf: arrondi(conf, 3)});
  }
  return res.sort((a, b) => b.conf - a.conf);
}
