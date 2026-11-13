// Dérush — les couleurs.
//
// 1. Les caméras qui filment en Log (une image grise et plate, qui garde le plus d'informations) : Dérush reconnaît
//    un rush probablement filmé en Log, propose le profil de la caméra, et fabrique la conversion en couleurs normales
//    (Rec.709) sous forme d'un LUT 3D, calculé ici à partir des formules publiées par les fabricants (aucun fichier
//    d'un fabricant n'est livré). On peut aussi donner le LUT officiel de sa caméra (.cube). La conversion s'applique à
//    l'aperçu, à la version de montage que reçoit l'IA, et au rendu.
// 2. L'étalonnage d'un plan (exposition, contraste, saturation, température, teinte) : mêmes réglages dans l'aperçu
//    (filtres de la page) et dans le rendu (effet colorCorrection de Remotion), mesurés pour donner la même image.
import fs from 'node:fs';
import path from 'node:path';
import {DOSSIER_SUPPORT} from './moteurs.mjs';

// ——— Les gammes de couleurs (primaires xy, blanc D65) ———
const D65 = [0.3127, 0.3290];
const GAMMES = {
  rec709: [[0.640, 0.330], [0.300, 0.600], [0.150, 0.060]],
  rec2020: [[0.708, 0.292], [0.170, 0.797], [0.131, 0.046]],
  sgamut3cine: [[0.766, 0.275], [0.225, 0.800], [0.089, -0.087]],
  vgamut: [[0.730, 0.280], [0.165, 0.840], [0.100, -0.030]],
  cinemagamut: [[0.740, 0.270], [0.170, 1.140], [0.080, -0.100]],
  awg3: [[0.6840, 0.3130], [0.2210, 0.8480], [0.0861, -0.1020]],
  awg4: [[0.7347, 0.2653], [0.1424, 0.8576], [0.0991, -0.0308]],
  dgamut: [[0.71, 0.31], [0.21, 0.88], [0.09, -0.08]],
};
const inverse3 = (m) => {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
};
const fois3 = (m, v) => m.map((l) => l[0] * v[0] + l[1] * v[1] + l[2] * v[2]);
const produit3 = (a, b) => a.map((l) => [0, 1, 2].map((j) => l[0] * b[0][j] + l[1] * b[1][j] + l[2] * b[2][j]));
/** La matrice RVB → XYZ d'une gamme (méthode classique : primaires et blanc). */
export function versXYZ(gamme) {
  const xyz = ([x, y]) => [x / y, 1, (1 - x - y) / y];
  const P = [0, 1, 2].map((r) => [0, 1, 2].map((c) => xyz(gamme[c])[r]));
  const S = fois3(inverse3(P), xyz(D65));
  return P.map((l) => l.map((v, c) => v * S[c]));
}
/** La matrice qui passe d'une gamme de caméra au Rec.709 (lumière linéaire). */
export const versRec709 = (gamme) => produit3(inverse3(versXYZ(GAMMES.rec709)), versXYZ(GAMMES[gamme]));

// ——— Les courbes Log : du signal enregistré à la lumière de la scène (0,18 = gris moyen) ———
// `entree` : la convention du fabricant. « cv » : la formule part du code 10 bits divisé par 1023 (le noir vidéo est à
// 64) ; « plein » : elle part du signal déjà ramené entre 0 et 1 (noir vidéo = 0, blanc vidéo = 1), comme le donne FFmpeg.
const log10 = Math.log10;
export const PROFILS = {
  slog3: {nom: 'Sony S-Log3 (S-Gamut3.Cine)', marques: /sony|ilce|fx3|fx6|fx30|zv-e|a7s|xavc/i, gamme: 'sgamut3cine', entree: 'cv', gris: 420 / 1023,
    decoder: (v) => (v >= 171.2102946929 / 1023 ? 10 ** ((v * 1023 - 420) / 261.5) * 0.19 - 0.01 : ((v * 1023 - 95) * 0.01125) / (171.2102946929 - 95))},
  vlog: {nom: 'Panasonic V-Log (V-Gamut)', marques: /panasonic|lumix|dc-s|dc-gh|bgh|eva1/i, gamme: 'vgamut', entree: 'cv', gris: 433 / 1023,
    decoder: (v) => (v < 0.181 ? (v - 0.125) / 5.6 : 10 ** ((v - 0.598206) / 0.241514) - 0.00873)},
  clog3: {nom: 'Canon C-Log3 (Cinema Gamut)', marques: /canon|eos|c70|c300|c500|r5c/i, gamme: 'cinemagamut', entree: 'plein', gris: 0.3280,
    decoder: (v) => 0.9 * (v < 0.04076162 ? -(10 ** ((0.07623209 - v) / 0.42889912) - 1) / 14.98325 : v <= 0.105357102 ? (v - 0.073059361) / 2.3069815 : (10 ** ((v - 0.069886632) / 0.42889912) - 1) / 14.98325)},
  flog: {nom: 'Fujifilm F-Log (F-Gamut)', marques: /fujifilm|x-t\d|x-h\d|x-s\d|gfx/i, gamme: 'rec2020', entree: 'cv', gris: 470 / 1023,
    decoder: (v) => (v >= 0.1005377752 ? (10 ** ((v - 0.790453) / 0.344676)) / 0.555556 - 0.009468 / 0.555556 : (v - 0.092864) / 8.735631)},
  flog2: {nom: 'Fujifilm F-Log2 (F-Gamut)', marques: /fujifilm|x-t\d|x-h\d|x-s\d|gfx/i, gamme: 'rec2020', entree: 'cv', gris: 0.391,
    decoder: (v) => (v >= 0.100686685370811 ? (10 ** ((v - 0.384316) / 0.245281)) / 5.555556 - 0.064829 / 5.555556 : (v - 0.092864) / 8.799461)},
  nlog: {nom: 'Nikon N-Log', marques: /nikon|z\s?[5-9]|zf|z30|z50/i, gamme: 'rec2020', entree: 'cv', gris: 0.3638,
    decoder: (v) => { const c = v * 1023; return c < 452 ? (c / 650) ** 3 - 0.0075 : Math.exp((c - 619) / 150); }},
  logc3: {nom: 'ARRI LogC3 (EI 800, AWG3)', marques: /arri|alexa|amira/i, gamme: 'awg3', entree: 'cv', gris: 0.391,
    decoder: (v) => (v > 5.367655 * 0.010591 + 0.092809 ? (10 ** ((v - 0.385537) / 0.247190) - 0.052272) / 5.555556 : (v - 0.092809) / 5.367655)},
  logc4: {nom: 'ARRI LogC4 (AWG4)', marques: /alexa\s?35|alexa\s?265/i, gamme: 'awg4', entree: 'cv', gris: 0.2784,
    decoder: (v) => {
      const a = (2 ** 18 - 16) / 117.45, b = (1023 - 95) / 1023, c = 95 / 1023;
      const s = (7 * Math.LN2 * 2 ** (7 - (14 * c) / b)) / (a * b), t = (2 ** (14 * (-c / b) + 6) - 64) / a;
      return v >= 0 ? (2 ** ((14 * (v - c)) / b + 6) - 64) / a : v * s + t;
    }},
  applelog: {nom: 'Apple Log (iPhone)', marques: /apple|iphone/i, gamme: 'rec2020', entree: 'plein', gris: 0.4883,
    decoder: (v) => {
      const R0 = -0.05641088, Rt = 0.01, c = 47.28711236, beta = 0.00964052, gamma = 0.08550479, delta = 0.69336945;
      const Pt = c * (Rt - R0) ** 2;
      return v >= Pt ? 2 ** ((v - delta) / gamma) - beta : v >= 0 ? Math.sqrt(v / c) + R0 : R0;
    }},
  dlog: {nom: 'DJI D-Log (D-Gamut)', marques: /dji|osmo|mavic|inspire|ronin|avata/i, gamme: 'dgamut', entree: 'cv', gris: 0.3988,
    decoder: (v) => (v <= 0.14 ? (v - 0.0929) / 6.025 : (10 ** ((v - 0.584555) / 0.256663) - 0.0108) / 0.9892)},
};
// Les profils dont le fabricant ne publie pas la formule (D-Log M de DJI, notamment) : le LUT officiel de la caméra,
// ou la conversion automatique, qui part des mesures du rush.
export const SANS_FORMULE = {
  dlogm: {nom: 'DJI D-Log M', marques: /dji|osmo|pocket|mini|air\s?3|action/i, conseil: 'DJI ne publie pas la formule du D-Log M : donne le LUT officiel de DJI (fichier .cube, sur le site de DJI, page de ta caméra), ou garde la conversion automatique.'},
  hlg_cam: {nom: 'Autre Log (conversion automatique)', marques: null, conseil: 'Dérush ramène les ombres, les lumières et la couleur à partir des mesures du rush.'},
};

// ——— La courbe d'affichage : de la lumière de la scène à une image Rec.709 ———
// La courbe de la norme BT.709 (le gris moyen à 41 %, le blanc à 90 % de réflexion vers 91 %), avec une épaule douce
// au-dessus de 0,6 : les hautes lumières que le Log a gardées s'arrondissent vers le blanc au lieu d'être coupées net.
const epaule = (x) => (x <= 0.6 ? x : 0.6 + 0.4 * (1 - Math.exp(-(x - 0.6) / 0.4)));
const oetf709 = (l) => (l < 0.018 ? 4.5 * l : 1.099 * l ** 0.45 - 0.099);
const afficher = (x) => oetf709(epaule(Math.max(0, x)));

/** Le LUT 3D (texte .cube) qui convertit un profil Log en Rec.709. */
export function lutProfil(id, taille = 33) {
  const p = PROFILS[id];
  if (!p) throw new Error(`Profil inconnu : ${id}.`);
  const M = versRec709(p.gamme);
  const vers = p.entree === 'cv' ? (x) => (x * 876 + 64) / 1023 : (x) => x;
  const lignes = [`TITLE "Dérush — ${p.nom} vers Rec.709"`, '# Calculé par Dérush à partir de la formule publiée par le fabricant (courbe BT.709, épaule douce).', `LUT_3D_SIZE ${taille}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  const lin = Array.from({length: taille}, (_, k) => p.decoder(vers(k / (taille - 1))));
  for (let b = 0; b < taille; b++) for (let g = 0; g < taille; g++) for (let r = 0; r < taille; r++) {
    const o = fois3(M, [lin[r], lin[g], lin[b]]).map((x) => Math.min(1, Math.max(0, afficher(x))));
    lignes.push(o.map((x) => x.toFixed(6)).join(' '));
  }
  return `${lignes.join('\n')}\n`;
}
/**
 * La conversion automatique (sans formule) : à partir des mesures d'un rush (ses ombres et ses lumières), une courbe
 * qui redonne du contraste et de la couleur. Pour un Log sans formule publiée (D-Log M) ou inconnu.
 */
export function lutAuto(mesures, taille = 33) {
  const noir = Math.min(0.3, Math.max(0, (mesures?.ombres ?? 0.12) - 0.04));
  const blanc = Math.max(noir + 0.3, Math.min(1, (mesures?.hautes_lumieres ?? 0.75) + 0.05));
  const sat = 1.45;
  const courbe = (x) => {
    const t = Math.min(1, Math.max(0, (x - noir) / (blanc - noir)));
    // une courbe en S douce, le gris moyen légèrement relevé
    const s = t * t * (3 - 2 * t);
    return 0.06 + 0.9 * (0.55 * s + 0.45 * t ** 0.92);
  };
  const lignes = ['TITLE "Dérush — conversion automatique d’un Log"', `LUT_3D_SIZE ${taille}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  for (let b = 0; b < taille; b++) for (let g = 0; g < taille; g++) for (let r = 0; r < taille; r++) {
    const c = [r, g, b].map((k) => courbe(k / (taille - 1)));
    const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    lignes.push(c.map((x) => Math.min(1, Math.max(0, y + (x - y) * sat)).toFixed(6)).join(' '));
  }
  return `${lignes.join('\n')}\n`;
}

// ——— Le LUT d'un rush ———
const DOSSIER_LUTS = path.join(DOSSIER_SUPPORT, 'luts');
const VERSION_LUTS = 2; // à monter si les formules ou la courbe d'affichage changent : les LUT sont recalculés
/**
 * Le fichier .cube à appliquer à un rush, ou null. m.couleur : {profil} (un profil à formule, « auto », ou « normal »),
 * ou {profil: 'lut', lut_fichier} (le LUT officiel donné par la personne).
 */
export function lutDe(m) {
  const c = m?.couleur;
  if (!c?.profil || c.profil === 'normal') return null;
  try {
    if (c.profil === 'lut') return c.lut_fichier && fs.existsSync(c.lut_fichier) ? c.lut_fichier : null;
    fs.mkdirSync(DOSSIER_LUTS, {recursive: true});
    if (c.profil === 'auto') {
      const f = path.join(DOSSIER_LUTS, `auto-${m.id}-${Math.round((c.ombres ?? 0) * 1000)}-${Math.round((c.lumieres ?? 0) * 1000)}-v${VERSION_LUTS}.cube`);
      if (!fs.existsSync(f)) fs.writeFileSync(f, lutAuto({ombres: c.ombres, hautes_lumieres: c.lumieres}));
      return f;
    }
    if (!PROFILS[c.profil]) return null;
    const f = path.join(DOSSIER_LUTS, `${c.profil}-v${VERSION_LUTS}.cube`);
    if (!fs.existsSync(f)) fs.writeFileSync(f, lutProfil(c.profil));
    return f;
  } catch { return null; }
}
/** Le filtre FFmpeg qui applique le LUT d'un rush (ou null). */
export function filtreLut(m) {
  const f = lutDe(m);
  return f ? `lut3d=file='${f.replace(/[\\':]/g, '\\$&')}':interp=tetrahedral` : null;
}
/** Une clé qui change quand le LUT d'un rush change (pour refaire l'aperçu et la version de montage). */
export function cleLut(m) {
  const f = lutDe(m);
  if (!f) return null;
  try { return `${path.basename(f)}:${Math.round(fs.statSync(f).mtimeMs)}`; } catch { return path.basename(f); }
}
/** Les profils proposés, pour l'interface : à formule, puis sans formule, puis « normal ». */
export function listeProfils() {
  return [
    {id: 'normal', nom: 'Couleurs normales (pas de Log)', formule: true},
    ...Object.entries(PROFILS).map(([id, p]) => ({id, nom: p.nom, formule: true})),
    {id: 'dlogm', nom: SANS_FORMULE.dlogm.nom, formule: false, conseil: SANS_FORMULE.dlogm.conseil},
    {id: 'auto', nom: 'Autre Log : conversion automatique', formule: false, conseil: SANS_FORMULE.hlg_cam.conseil},
    {id: 'lut', nom: 'Le LUT officiel de ma caméra (.cube)', formule: false},
  ];
}

/**
 * Un rush filmé en Log ? Les mesures de l'image (plate, sans noirs profonds, peu saturée) et la caméra qui l'a filmé
 * (ses métadonnées) disent quel profil proposer. Renvoie {id, nom, log, confiance, pourquoi} ou null.
 */
export function profilSuggere(m, im) {
  if (!im || m.type !== 'video') return null;
  const camera = [m.tournage?.logiciel, m.tournage?.appareil, m.tournage?.marque, m.tournage?.modele, m.nom].filter(Boolean).join(' ');
  const plat = im.contraste < 0.5 && im.ombres > 0.07 && im.saturation < 0.34;
  const tresPlat = im.contraste < 0.42 && im.ombres > 0.1 && im.saturation < 0.26;
  // l'iPhone en Apple Log : primaires BT.2020 sans courbe HDR, en 10 bits
  const appleLog = /apple|iphone/i.test(camera) && m.primaires === 'bt2020' && !m.hdr && (m.bits ?? 8) >= 10;
  if (!plat && !appleLog) return null;
  const dix = (m.bits ?? 8) >= 10;
  let id = null;
  if (appleLog) id = 'applelog';
  else if (/dji|osmo|pocket|mavic|mini|avata|action/i.test(camera)) id = 'dlogm';
  else for (const [k, p] of Object.entries(PROFILS)) if (p.marques?.test(camera)) { id = k; break; }
  const confiance = appleLog ? 'forte' : tresPlat && dix ? 'forte' : tresPlat || dix ? 'moyenne' : 'faible';
  if (confiance === 'faible' && !id) return null;
  id ??= 'auto';
  const nom = PROFILS[id]?.nom ?? (id === 'dlogm' ? SANS_FORMULE.dlogm.nom : 'Log (caméra inconnue)');
  return {id, nom, log: true, confiance, pourquoi: [appleLog ? 'couleurs Apple Log (BT.2020, 10 bits)' : 'image grise et plate, sans noirs profonds, peu saturée', dix ? 'tourné en 10 bits' : null, camera ? `caméra : ${camera.slice(0, 60)}` : null].filter(Boolean).join(' ; ')};
}

// ——— L'étalonnage d'un plan : défini dans lib/commun.mjs (partagé avec l'interface) ———
export {REGLAGES_COULEUR, couleurPropre, couleurVersRemotion as versRemotion, couleurVersApercu, couleurAuto} from './commun.mjs';
