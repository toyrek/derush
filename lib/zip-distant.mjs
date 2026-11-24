// Dérush — lire quelques fichiers d'une archive zip sans la télécharger en entier.
// Une archive zip finit par sa table (le « répertoire central ») : elle dit où commence chaque fichier. On ne demande
// alors au serveur que les morceaux utiles (requêtes « Range »). Sert aux moteurs livrés dans de grosses archives
// (lib/moteurs-pixels.mjs : 18 Mo pris sur les 416 de celle de RIFE). La même lecture marche sur une archive déjà sur
// le disque, quand un serveur ne sait pas servir par morceaux.
//   - Rien n'est cru sur parole : la taille de l'archive est celle qu'on attend, sinon tout s'arrête ; ce qui sort d'un
//     fichier décompressé ne dépasse jamais la taille annoncée ; l'appelant vérifie ensuite l'empreinte de chaque fichier.
//   - Pas de zip64, pas de fichier chiffré, pas d'archive en plusieurs volumes : ces archives-là sont refusées.
import fs from 'node:fs';
import zlib from 'node:zlib';

const FIN = 0x06054b50; // la fin de la table
const ENTREE = 0x02014b50; // une ligne de la table
const LOCAL = 0x04034b50; // l'en-tête qui précède chaque fichier
const MORCEAU_MAX = 256 * 1024 ** 2; // un fichier compressé de plus de 256 Mo n'est pas lu en mémoire

/** Une archive sur le disque : {taille, lire(debut, fin)} (fin exclue). */
export function sourceFichier(chemin) {
  const taille = fs.statSync(chemin).size;
  return {
    taille,
    async lire(debut, fin) {
      const b = Buffer.alloc(fin - debut);
      const fd = fs.openSync(chemin, 'r');
      try {
        let lu = 0;
        while (lu < b.length) { const n = fs.readSync(fd, b, lu, b.length - lu, debut + lu); if (!n) break; lu += n; }
        if (lu !== b.length) throw new Error('archive tronquée.');
      } finally { fs.closeSync(fd); }
      return b;
    },
  };
}

/**
 * Une archive sur un serveur, lue par morceaux. `taille` : celle qu'on attend (le serveur doit annoncer la même).
 * `surOctets(n)` reçoit ce qui arrive, au fil de l'eau. Un serveur qui ne sert pas par morceaux lève une erreur marquée
 * `sansMorceaux` : l'appelant télécharge alors l'archive entière.
 */
export function sourceHttp(url, {taille, delai = 10 * 60e3, surOctets = () => {}} = {}) {
  if (!(taille > 0)) throw new Error('la taille de l’archive doit être connue d’avance.');
  return {
    taille,
    async lire(debut, fin) {
      if (!(debut >= 0 && fin > debut && fin <= taille)) throw new Error('morceau hors de l’archive.');
      const r = await fetch(url, {headers: {Range: `bytes=${debut}-${fin - 1}`}, signal: AbortSignal.timeout(delai)});
      if (r.status === 200) { await r.body?.cancel().catch(() => {}); throw Object.assign(new Error('ce serveur ne sert pas l’archive par morceaux.'), {sansMorceaux: true}); }
      if (r.status !== 206 || !r.body) throw new Error(`le serveur a répondu ${r.status}.`);
      const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(r.headers.get('content-range') ?? '');
      // d'abord la taille de toute l'archive : une autre archive que celle qui a été vérifiée s'arrête là
      if (m && Number(m[3]) !== taille) { await r.body.cancel().catch(() => {}); throw new Error('l’archive du serveur n’a pas la taille de celle qui a été vérifiée : rien n’est pris.'); }
      if (!m || Number(m[1]) !== debut || Number(m[2]) !== fin - 1) { await r.body.cancel().catch(() => {}); throw new Error('le serveur n’a pas rendu le morceau demandé.'); }
      const morceaux = [];
      let recu = 0;
      for await (const c of r.body) {
        recu += c.byteLength;
        if (recu > fin - debut) throw new Error('le serveur envoie plus que le morceau demandé.');
        morceaux.push(Buffer.from(c));
        surOctets(c.byteLength);
      }
      if (recu !== fin - debut) throw new Error('le morceau reçu est incomplet.');
      return Buffer.concat(morceaux);
    },
  };
}

/**
 * La table de l'archive : [{nom, methode, compresse, taille, decalage, fin}], dans l'ordre où les fichiers sont rangés
 * (`decalage` : où commence l'en-tête du fichier ; `fin` : où commence ce qui le suit).
 */
export async function tableZip(source) {
  const T = source.taille;
  if (!(T >= 22)) throw new Error('ce n’est pas une archive zip.');
  // la fin de la table : sa signature, et un commentaire qui va exactement jusqu'au bout du fichier. Presque toujours
  // dans les 4 derniers Ko ; sinon (un long commentaire), dans les 64 derniers.
  let queue;
  let i = -1;
  for (const fenetre of [4096 + 22, 65535 + 22]) {
    queue = await source.lire(Math.max(0, T - fenetre), T);
    for (i = queue.length - 22; i >= 0; i--) if (queue.readUInt32LE(i) === FIN && i + 22 + queue.readUInt16LE(i + 20) === queue.length) break;
    if (i >= 0 || queue.length === T) break;
  }
  if (i < 0) throw new Error('ce n’est pas une archive zip (table introuvable).');
  const [disque, disqueTable, ici, total, tailleTable, debutTable] = [queue.readUInt16LE(i + 4), queue.readUInt16LE(i + 6), queue.readUInt16LE(i + 8), queue.readUInt16LE(i + 10), queue.readUInt32LE(i + 12), queue.readUInt32LE(i + 16)];
  if (disque || disqueTable || ici !== total) throw new Error('archive en plusieurs volumes : pas lue.');
  if (total === 0xffff || tailleTable === 0xffffffff || debutTable === 0xffffffff) throw new Error('archive au format zip64 : pas lue.');
  if (debutTable + tailleTable > T || tailleTable > 64 * 1024 ** 2) throw new Error('table de l’archive incohérente.');
  // la table est souvent déjà dans ce qu'on vient de lire
  const depuis = T - queue.length;
  const table = debutTable >= depuis ? queue.subarray(debutTable - depuis, debutTable - depuis + tailleTable) : await source.lire(debutTable, debutTable + tailleTable);
  const entrees = [];
  let p = 0;
  for (let n = 0; n < total; n++) {
    if (p + 46 > table.length || table.readUInt32LE(p) !== ENTREE) throw new Error('table de l’archive abîmée.');
    const drapeaux = table.readUInt16LE(p + 8);
    const [lNom, lPlus, lNote] = [table.readUInt16LE(p + 28), table.readUInt16LE(p + 30), table.readUInt16LE(p + 32)];
    const e = {nom: table.subarray(p + 46, p + 46 + lNom).toString('utf8'), methode: table.readUInt16LE(p + 10), compresse: table.readUInt32LE(p + 20),
      taille: table.readUInt32LE(p + 24), decalage: table.readUInt32LE(p + 42), chiffre: !!(drapeaux & 1)};
    if (e.compresse === 0xffffffff || e.taille === 0xffffffff || e.decalage === 0xffffffff) throw new Error('archive au format zip64 : pas lue.');
    entrees.push(e);
    p += 46 + lNom + lPlus + lNote;
  }
  entrees.sort((a, b) => a.decalage - b.decalage);
  entrees.forEach((e, k) => { e.fin = k + 1 < entrees.length ? entrees[k + 1].decalage : debutTable; });
  if (entrees.some((e) => e.fin <= e.decalage || e.fin > debutTable)) throw new Error('table de l’archive incohérente.');
  return entrees;
}

/** Le contenu d'un fichier de l'archive, décompressé (jamais plus que la taille que la table annonce). */
export async function lireEntree(source, e) {
  if (e.chiffre) throw new Error(`« ${e.nom} » est chiffré : pas lu.`);
  if (e.methode !== 0 && e.methode !== 8) throw new Error(`« ${e.nom} » est compressé d’une façon que Dérush ne lit pas.`);
  if (e.compresse > MORCEAU_MAX || e.taille > 4 * MORCEAU_MAX) throw new Error(`« ${e.nom} » est trop gros pour être lu ainsi.`);
  // une seule demande : l'en-tête du fichier et ses données (ce qui suit, jusqu'au fichier d'après, n'est pas demandé en entier)
  const marge = 30 + 2 * 65535;
  const brut = await source.lire(e.decalage, Math.min(e.fin, e.decalage + marge + e.compresse));
  if (brut.length < 30 || brut.readUInt32LE(0) !== LOCAL) throw new Error(`« ${e.nom} » : en-tête introuvable.`);
  const debut = 30 + brut.readUInt16LE(26) + brut.readUInt16LE(28);
  if (debut + e.compresse > brut.length) throw new Error(`« ${e.nom} » : données incomplètes.`);
  const donnees = brut.subarray(debut, debut + e.compresse);
  let clair;
  try { clair = e.methode === 0 ? Buffer.from(donnees) : zlib.inflateRawSync(donnees, {maxOutputLength: Math.max(1, e.taille)}); } catch (err) { throw new Error(`« ${e.nom} » ne se décompresse pas (${err.code ?? err.message}).`); }
  if (clair.length !== e.taille) throw new Error(`« ${e.nom} » n’a pas la taille annoncée.`);
  return clair;
}
