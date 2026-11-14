// Dérush — la place sur le disque : vérifiée avant un montage par l'IA et avant un rendu, et le ménage de ses propres
// fichiers temporaires au démarrage. Le 13 nov. 2026, un disque plein a bloqué un montage d'Opus en plein travail
// (un rendu, une copie de 570 Mo du navigateur de rendu par projet, des assemblages qui s'empilaient).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const GO = 1024 ** 3;
const go = (o) => `${(o / GO).toFixed(1).replace('.', ',')} Go`;

/** La place libre (octets) sur le disque d'un dossier, ou null si on ne sait pas la lire. */
export function placeLibre(dossier) {
  try {
    const s = fs.statfsSync(dossier);
    return Number(s.bavail) * Number(s.bsize);
  } catch { return null; }
}

const memeDisque = (a, b) => { try { return fs.statSync(a).dev === fs.statSync(b).dev; } catch { return true; } };

/**
 * Assez de place pour travailler ? Sous `mini`, on refuse (un rendu échouerait en route, en laissant des fichiers à
 * moitié écrits) ; sous `confort`, on prévient. Renvoie {ok, prevenir, libre, texte, dossier}.
 *
 * `dossier` : le dossier du projet (ou une liste de dossiers). Le dossier temporaire du système est toujours regardé
 * aussi (`aussi`) : les assemblages du kit et les fichiers de travail du rendu y vont, même quand le projet est sur un
 * SSD externe presque vide. C'est le disque le plus plein qui décide, et le texte dit lequel. `lire` : pour les essais.
 */
export function verifierPlace(dossier, {mini = 1.5 * GO, confort = 5 * GO, aussi = [os.tmpdir()], lire = placeLibre} = {}) {
  const dossiers = [...(Array.isArray(dossier) ? dossier : [dossier]), ...aussi].filter(Boolean);
  let pire = null;
  for (const d of dossiers) {
    const libre = lire(d);
    if (libre != null && (!pire || libre < pire.libre)) pire = {dossier: d, libre};
  }
  if (!pire) return {ok: true, prevenir: false, libre: null, texte: null, dossier: null};
  const {libre} = pire;
  // un seul disque pour tout : « ton disque » ; sinon on dit lequel est plein
  const ou = dossiers.every((d) => memeDisque(d, dossiers[0])) ? 'ton disque' : memeDisque(pire.dossier, dossiers[0]) ? 'le disque du projet' : 'le disque de ton ordinateur (Dérush y range ses fichiers de travail)';
  if (libre < mini) return {ok: false, prevenir: true, libre, dossier: pire.dossier, texte: `Il ne reste que ${go(libre)} sur ${ou} : pas assez pour monter et rendre une vidéo. Libère de la place (la corbeille, de vieux exports, des vidéos téléchargées), puis relance.`};
  if (libre < confort) return {ok: true, prevenir: true, libre, dossier: pire.dossier, texte: `Il ne reste que ${go(libre)} sur ${ou} : le travail peut s’arrêter en route s’il en manque.`};
  return {ok: true, prevenir: false, libre, dossier: pire.dossier, texte: null};
}

/**
 * Le ménage au démarrage : les dossiers temporaires de Dérush (« derush-… » dans le dossier temporaire du système,
 * assemblages du kit compris) de plus de `age` millisecondes. Rien d'autre n'est touché.
 */
export function menageTemporaire({age = 6 * 3600e3, dossier = os.tmpdir()} = {}) {
  let n = 0;
  let noms = [];
  try { noms = fs.readdirSync(dossier); } catch { return {n}; }
  for (const nom of noms) {
    if (!/^derush-[\w.-]+$/.test(nom)) continue;
    const f = path.join(dossier, nom);
    try {
      const st = fs.lstatSync(f);
      if (st.isSymbolicLink() || Date.now() - st.mtimeMs < age) continue;
      fs.rmSync(f, {recursive: true, force: true});
      n++;
    } catch { /* un dossier encore utilisé, ou déjà parti */ }
  }
  return {n};
}
