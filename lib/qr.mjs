// Dérush — un code QR, sans dépendance : pour passer de l'écran de l'ordinateur au téléphone (le don par l'app
// Revolut se fait sur le téléphone). Norme ISO/IEC 18004 : mode octets, correction d'erreur de niveau M, versions 1
// à 6, soit jusqu'à 106 octets — assez pour une adresse. Aucune image : `cheminQr` rend un tracé SVG.
//
//   qr('https://…')        → {taille, lignes}   une chaîne de 0 et de 1 par ligne (1 : module sombre), ou null si trop long
//   cheminQr('https://…')  → {taille, d}        le tracé des modules sombres, marge blanche comprise

// version → [mots de données par bloc, nombre de blocs, mots de correction par bloc], au niveau M
const VERSIONS = [null, [16, 1, 10], [28, 1, 16], [44, 1, 26], [32, 2, 18], [43, 2, 24], [27, 4, 16]];

// ——— le corps de Galois GF(256), polynôme 0x11D : la correction d'erreur de Reed-Solomon ———
const EXP = new Uint8Array(510);
const LOG = new Uint8Array(256);
for (let i = 0, v = 1; i < 255; i++) { EXP[i] = EXP[i + 255] = v; LOG[v] = i; v <<= 1; if (v & 0x100) v ^= 0x11d; }
const fois = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** Les `n` mots de correction d'un bloc : le reste de la division par le polynôme générateur de degré n. */
function correction(bloc, n) {
  const gen = new Uint8Array(n);
  gen[n - 1] = 1;
  for (let i = 0, racine = 1; i < n; i++, racine = fois(racine, 2)) {
    for (let j = 0; j < n; j++) { gen[j] = fois(gen[j], racine); if (j + 1 < n) gen[j] ^= gen[j + 1]; }
  }
  const reste = new Uint8Array(n);
  for (const octet of bloc) {
    const f = octet ^ reste[0];
    reste.copyWithin(0, 1);
    reste[n - 1] = 0;
    for (let j = 0; j < n; j++) reste[j] ^= fois(gen[j], f);
  }
  return reste;
}

/** Les mots du code, dans l'ordre où ils sont posés : les données entrelacées bloc par bloc, puis la correction. */
function mots(octets, version) {
  const [parBloc, blocs, corr] = VERSIONS[version];
  const total = parBloc * blocs;
  const bits = [];
  const pousser = (valeur, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valeur >>> i) & 1); };
  pousser(0b0100, 4); // mode octets
  pousser(octets.length, 8);
  for (const o of octets) pousser(o, 8);
  for (let i = 0; i < 4 && bits.length < total * 8; i++) bits.push(0); // la fin
  while (bits.length % 8) bits.push(0);
  for (let bourre = 0xec; bits.length < total * 8; bourre ^= 0xec ^ 0x11) pousser(bourre, 8);
  const donnees = [];
  for (let i = 0; i < bits.length; i += 8) donnees.push(bits.slice(i, i + 8).reduce((v, b) => (v << 1) | b, 0));
  const tranches = [];
  for (let b = 0; b < blocs; b++) { const d = donnees.slice(b * parBloc, (b + 1) * parBloc); tranches.push({d, c: correction(d, corr)}); }
  const suite = [];
  for (let i = 0; i < parBloc; i++) for (const t of tranches) suite.push(t.d[i]);
  for (let i = 0; i < corr; i++) for (const t of tranches) suite.push(t.c[i]);
  return suite;
}

const MASQUES = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Ce qu'un lecteur aurait du mal à lire (longues plages, pavés, faux repères, déséquilibre) : plus c'est bas, mieux c'est. */
function penalite(m) {
  const n = m.length;
  let p = 0;
  let sombres = 0;
  const ligne = (lire) => {
    for (let a = 0; a < n; a++) {
      let suite = 1;
      for (let b = 1; b <= n; b++) {
        if (b < n && lire(a, b) === lire(a, b - 1)) { suite++; continue; }
        if (suite >= 5) p += suite - 2;
        suite = 1;
      }
      // le dessin d'un repère (1 1 3 1 1) bordé de quatre modules clairs
      for (let b = 0; b + 10 < n; b++) {
        const v = (k) => lire(a, b + k);
        const repere = (d) => v(d) && !v(d + 1) && v(d + 2) && v(d + 3) && v(d + 4) && !v(d + 5) && v(d + 6);
        if ((repere(0) && !v(7) && !v(8) && !v(9) && !v(10)) || (!v(0) && !v(1) && !v(2) && !v(3) && repere(4))) p += 40;
      }
    }
  };
  ligne((a, b) => m[a][b]);
  ligne((a, b) => m[b][a]);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (m[y][x]) sombres++;
      if (x + 1 < n && y + 1 < n && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    }
  }
  return p + Math.floor(Math.abs((sombres * 100) / (n * n) - 50) / 5) * 10;
}

/**
 * Le code QR d'un texte : {taille, lignes, version, masque}, ou null si le texte est vide ou trop long (plus de
 * 106 octets). `lignes` : une chaîne de « 0 » et de « 1 » par ligne, « 1 » pour un module sombre.
 */
export function qr(texte) {
  const octets = [...new TextEncoder().encode(String(texte ?? ''))];
  const version = VERSIONS.findIndex((v) => v && octets.length <= v[0] * v[1] - 2);
  if (!octets.length || version < 1) return null;
  const n = 17 + 4 * version;
  const m = Array.from({length: n}, () => new Array(n).fill(false));
  const fixe = Array.from({length: n}, () => new Array(n).fill(false)); // les modules du dessin, que les données évitent
  const poser = (x, y, sombre) => { m[y][x] = sombre; fixe[y][x] = true; };
  for (let i = 0; i < n; i++) { poser(6, i, i % 2 === 0); poser(i, 6, i % 2 === 0); } // les lignes de cadence
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) { // les trois repères, et leur bord clair
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < n && y >= 0 && y < n) poser(x, y, d !== 2 && d !== 4);
      }
    }
  }
  if (version >= 2) { // le petit repère d'alignement, en bas à droite
    const c = n - 7;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) poser(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  /** Les 15 bits de format (niveau M, masque), écrits deux fois autour des repères. */
  const format = (masque) => {
    let reste = masque; // niveau M : 00, puis les trois bits du masque
    for (let i = 0; i < 10; i++) reste = (reste << 1) ^ ((reste >>> 9) * 0x537);
    const bits = ((masque << 10) | reste) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) poser(8, i, bit(i));
    poser(8, 7, bit(6)); poser(8, 8, bit(7)); poser(7, 8, bit(8));
    for (let i = 9; i < 15; i++) poser(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) poser(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) poser(8, n - 15 + i, bit(i));
    poser(8, n - 8, true); // toujours sombre
  };
  format(0); // réserve la place avant de poser les données
  const suite = mots(octets, version);
  let k = 0;
  for (let droite = n - 1; droite >= 1; droite -= 2) { // deux colonnes à la fois, en serpentin, depuis le coin bas droit
    if (droite === 6) droite = 5;
    for (let pas = 0; pas < n; pas++) {
      for (let j = 0; j < 2; j++) {
        const x = droite - j;
        const y = ((droite + 1) & 2) === 0 ? n - 1 - pas : pas;
        if (fixe[y][x]) continue;
        if (k < suite.length * 8) m[y][x] = ((suite[k >>> 3] >>> (7 - (k & 7))) & 1) === 1;
        k++;
      }
    }
  }
  // le masque qui rend le code le plus facile à lire
  let meilleur = null;
  for (let masque = 0; masque < 8; masque++) {
    const essai = m.map((ligne, y) => ligne.map((v, x) => (fixe[y][x] ? v : v !== MASQUES[masque](x, y))));
    const garde = m.map((ligne) => [...ligne]);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) m[y][x] = essai[y][x];
    format(masque);
    const p = penalite(m);
    if (!meilleur || p < meilleur.p) meilleur = {p, masque, lignes: m.map((ligne) => ligne.map((v) => (v ? '1' : '0')).join(''))};
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) m[y][x] = garde[y][x];
  }
  return {taille: n, lignes: meilleur.lignes, version, masque: meilleur.masque};
}

/** Le tracé SVG d'un code QR, marge blanche comprise : {taille, d} (à dessiner dans un viewBox « 0 0 taille taille »), ou null. */
export function cheminQr(texte, marge = 4) {
  const c = qr(texte);
  if (!c) return null;
  let d = '';
  c.lignes.forEach((ligne, y) => {
    for (const bande of ligne.matchAll(/1+/g)) d += `M${bande.index + marge} ${y + marge}h${bande[0].length}v1h-${bande[0].length}z`;
  });
  return {taille: c.taille + 2 * marge, d};
}
