// Dérush — le kit média d'un espace : ses logos, sa charte (couleurs, polices), ses fonds, ses pictos, ses logos animés,
// les logos de ses partenaires… et, pour chaque fichier, ce qu'il est et quand s'en servir.
//
// Rangement, dans le dossier de l'espace (espaces/<id>/kit/) : les fichiers, en sous-dossiers comme on veut ; kit.json,
// qui les décrit (des groupes ; pour chaque fichier un titre, un texte, un usage et ses autres formats ; les règles du
// kit) ; KIT.md, le même texte à lire, réécrit par Dérush à chaque changement. Un fichier posé là à la main, sans
// description, est listé quand même. Rien n'est jamais effacé : un fichier retiré part dans kit/.retires/.
// L'IA d'un projet de l'espace reçoit le kit dans contexte/espace/kit/ : des clones (sur un Mac, rien n'est recopié pour
// de vrai), reposés seulement quand le kit a changé. « Personne » n'a pas de kit.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {dossierEspace} from './espaces.mjs';
import {cloner} from './plateforme.mjs';
import {ffmpeg} from './outils.mjs';

const GENRES = {
  image: /\.(png|jpe?g|webp|gif|svg|heic|avif|tiff?|psd)$/i,
  police: /\.(ttf|otf|woff2?)$/i,
  video: /\.(mp4|mov|webm|m4v)$/i,
  son: /\.(wav|mp3|m4a|aac|aiff?|flac|ogg)$/i,
  document: /\.(pdf|md|txt|csv|ai|eps)$/i,
};
/** Le genre d'un fichier du kit, d'après son extension : image, police, video, son, document ou autre. */
export const genreFichier = (f) => Object.keys(GENRES).find((k) => GENRES[k].test(f)) ?? 'autre';
const cache = (nom) => nom.startsWith('.') || nom === '__MACOSX' || nom === 'Thumbs.db' || nom === 'desktop.ini';
const PROPRES = new Set(['kit.json', 'KIT.md']);
const texte = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const long = (v, n) => String(v ?? '').replace(/\r/g, '').trim().slice(0, n);
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Le dossier du kit d'un espace (le dossier de l'espace est créé au besoin, pas celui du kit). */
export const dossierKit = (id) => path.join(dossierEspace(id), 'kit');

/** Les fichiers du kit (chemins relatifs, avec « / »), sans les fichiers de Dérush ni les fichiers cachés. */
function fichiersDu(D) {
  const r = [];
  const marcher = (d, rel, profondeur) => {
    if (profondeur > 8) return;
    let liste;
    try { liste = fs.readdirSync(d, {withFileTypes: true}); } catch { return; }
    for (const x of liste) {
      if (cache(x.name) || (!rel && PROPRES.has(x.name))) continue;
      const q = rel ? `${rel}/${x.name}` : x.name;
      if (x.isDirectory()) marcher(path.join(d, x.name), q, profondeur + 1);
      else if (x.isFile()) r.push(q);
    }
  };
  marcher(D, '', 0);
  return r.sort((a, b) => a.localeCompare(b, 'fr'));
}

function lireDescription(D) {
  try {
    const k = JSON.parse(fs.readFileSync(path.join(D, 'kit.json'), 'utf8'));
    return k && typeof k === 'object' && !Array.isArray(k) ? k : null;
  } catch { return null; }
}
function ecrireDescription(D, k) {
  fs.mkdirSync(D, {recursive: true});
  const tmp = path.join(D, '.kit.json.part');
  fs.writeFileSync(tmp, JSON.stringify(k, null, 1));
  fs.renameSync(tmp, path.join(D, 'kit.json'));
}

/**
 * Le kit d'un espace, tel qu'il est sur le disque : les groupes décrits (sans les fichiers qui n'y sont plus), puis les
 * fichiers sans description. {titre, texte, regles, groupes: [{id, titre, texte, elements: [{fichier, titre, texte,
 * usage, variantes, genre}]}], nb, taille, maj}.
 */
export function lireKit(id) {
  const D = dossierKit(id);
  const fichiers = fs.existsSync(D) ? fichiersDu(D) : [];
  const presents = new Set(fichiers);
  const k = lireDescription(D) ?? {};
  const vus = new Set();
  const groupes = [];
  for (const g of Array.isArray(k.groupes) ? k.groupes : []) {
    const elements = [];
    for (const e of Array.isArray(g?.elements) ? g.elements : []) {
      const f = String(e?.fichier ?? '');
      if (!presents.has(f) || vus.has(f)) continue;
      const variantes = (Array.isArray(e.variantes) ? e.variantes : []).map(String).filter((v) => v !== f && presents.has(v) && !vus.has(v));
      vus.add(f);
      for (const v of variantes) vus.add(v);
      elements.push({fichier: f, titre: texte(e.titre, 120) || path.basename(f), texte: long(e.texte, 700), usage: long(e.usage, 400), variantes, genre: genreFichier(f)});
    }
    if (elements.length) groupes.push({id: texte(g.id, 40) || `groupe-${groupes.length + 1}`, titre: texte(g.titre, 120) || 'Sans titre', texte: long(g.texte, 1500), elements});
  }
  const seuls = fichiers.filter((f) => !vus.has(f));
  if (seuls.length) {
    groupes.push({id: 'sans-description', titre: 'Ajoutés sans description', texte: 'Posés dans le kit sans qu’on dise ce qu’ils sont : à regarder avant de s’en servir.',
      elements: seuls.map((f) => ({fichier: f, titre: path.basename(f), texte: '', usage: '', variantes: [], genre: genreFichier(f)}))});
  }
  let taille = 0;
  for (const f of fichiers) { try { taille += fs.statSync(path.join(D, f)).size; } catch { /* parti entre-temps */ } }
  return {titre: texte(k.titre, 120) || 'Kit média', texte: long(k.texte, 3000), regles: (Array.isArray(k.regles) ? k.regles : []).map((r) => long(r, 700)).filter(Boolean),
    groupes, nb: fichiers.length, taille, maj: typeof k.maj === 'string' ? k.maj : null};
}

const tailleLisible = (o) => (o >= 1e9 ? `${(o / 1e9).toFixed(1).replace('.', ',')} Go` : o >= 1e6 ? `${Math.round(o / 1e6)} Mo` : `${Math.max(1, Math.round(o / 1e3))} Ko`);

/** KIT.md : le kit à lire, pour la personne (dans le dossier du kit) et pour l'IA (dans contexte/espace/kit/). */
export function kitEnTexte(kit) {
  const L = [`# ${kit.titre}`, ''];
  if (kit.texte) L.push(kit.texte, '');
  L.push(`${kit.nb} fichier${kit.nb > 1 ? 's' : ''} (${tailleLisible(kit.taille)}). Les chemins partent de ce dossier.`, '');
  if (kit.regles.length) L.push('## Les règles', '', ...kit.regles.map((r) => `- ${r}`), '');
  for (const g of kit.groupes) {
    L.push(`## ${g.titre}`, '');
    if (g.texte) L.push(g.texte, '');
    for (const e of g.elements) {
      const autres = e.variantes.length ? ` (aussi : ${e.variantes.map((v) => `\`${v}\``).join(', ')})` : '';
      const dit = [e.texte, e.usage ? `Pour : ${e.usage}` : ''].filter(Boolean).join(' ');
      L.push(`- **${e.titre}** — \`${e.fichier}\`${autres}${dit ? ` — ${dit}` : ''}`);
    }
    L.push('');
  }
  return `${L.join('\n').trimEnd()}\n`;
}

/** Réécrit KIT.md dans le dossier du kit (à lire par la personne, à côté de ses fichiers). */
export function ecrireKitMd(id) {
  const D = dossierKit(id);
  const kit = lireKit(id);
  if (!kit.nb) { fs.rmSync(path.join(D, 'KIT.md'), {force: true}); return kit; }
  fs.writeFileSync(path.join(D, 'KIT.md'), kitEnTexte(kit));
  return kit;
}

/** Un chemin du kit donné par l'interface : un fichier qui y est vraiment, jamais un chemin qui en sort. */
function cheminDansKit(id, fichier) {
  const D = dossierKit(id);
  const rel = String(fichier ?? '').replaceAll('\\', '/');
  if (!rel || rel.startsWith('/') || rel.split('/').some((x) => x === '..' || x === '' || cache(x))) throw new Error('Fichier du kit inconnu.');
  const p = path.join(D, rel);
  if (!p.startsWith(D + path.sep)) throw new Error('Fichier du kit inconnu.');
  let st;
  try { st = fs.statSync(p); } catch { throw new Error('Ce fichier n’est plus dans le kit.'); }
  if (!st.isFile()) throw new Error('Fichier du kit inconnu.');
  return {D, rel, p, st};
}

const DOSSIERS_AJOUT = {image: 'ajouts/images', police: 'ajouts/polices', video: 'ajouts/animations', son: 'ajouts/sons', document: 'ajouts/documents', autre: 'ajouts/autres'};
const nomSur = (n) => n.normalize('NFC').replace(/[/\\:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').slice(0, 120) || 'fichier';

/**
 * Ajoute des fichiers (ou le contenu de dossiers) au kit : une copie (un clone sur un Mac), rangée par genre dans
 * ajouts/, décrite dans le groupe « Ajoutés depuis Dérush » (titre = le nom du fichier). Les originaux ne bougent pas.
 */
export async function ajouterAuKit(id, chemins = []) {
  const D = dossierKit(id);
  const aCopier = [];
  const voir = (src, sousDossier = '') => {
    let st;
    try { st = fs.statSync(src); } catch { throw new Error(`Introuvable : ${path.basename(src)}`); }
    if (st.isDirectory()) {
      if (sousDossier.split('/').length > 4) return;
      for (const n of fs.readdirSync(src)) if (!cache(n)) voir(path.join(src, n), sousDossier ? `${sousDossier}/${nomSur(path.basename(src))}` : nomSur(path.basename(src)));
      return;
    }
    if (!st.isFile()) return;
    if (st.size > 2 * 1024 ** 3) throw new Error(`« ${path.basename(src)} » est trop lourd pour le kit (2 Go au plus).`);
    aCopier.push({src, sousDossier});
  };
  for (const c of (Array.isArray(chemins) ? chemins : []).slice(0, 100)) voir(path.resolve(String(c)));
  if (aCopier.length > 500) throw new Error('Trop de fichiers d’un coup (500 au plus).');
  const ajoutes = [];
  for (const {src, sousDossier} of aCopier) {
    const base = [DOSSIERS_AJOUT[genreFichier(src)], sousDossier].filter(Boolean).join('/');
    fs.mkdirSync(path.join(D, base), {recursive: true});
    const nom = nomSur(path.basename(src));
    let rel = `${base}/${nom}`;
    for (let n = 2; fs.existsSync(path.join(D, rel)); n++) rel = `${base}/${path.parse(nom).name}-${n}${path.extname(nom)}`;
    const dst = path.join(D, rel);
    if (!(await cloner(src, dst))) fs.copyFileSync(src, dst);
    ajoutes.push(rel);
  }
  if (ajoutes.length) {
    const k = lireDescription(D) ?? {v: 1, titre: 'Kit média', texte: '', regles: [], groupes: []};
    if (!Array.isArray(k.groupes)) k.groupes = [];
    let g = k.groupes.find((x) => x?.id === 'ajouts');
    if (!g) { g = {id: 'ajouts', titre: 'Ajoutés depuis Dérush', texte: '', elements: []}; k.groupes.push(g); }
    if (!Array.isArray(g.elements)) g.elements = [];
    for (const f of ajoutes) g.elements.push({fichier: f, titre: path.parse(f).name.replace(/[-_]+/g, ' ').trim(), texte: '', usage: ''});
    k.maj = aujourdhui();
    ecrireDescription(D, k);
  }
  return {ajoutes, kit: ecrireKitMd(id)};
}

/** Dit ce qu'est un fichier du kit (titre, texte, usage). Un fichier sans description rejoint « Ajoutés depuis Dérush ». */
export function decrireDansKit(id, fichier, {titre, texte: t, usage} = {}) {
  const {D, rel} = cheminDansKit(id, fichier);
  const k = lireDescription(D) ?? {v: 1, titre: 'Kit média', texte: '', regles: [], groupes: []};
  if (!Array.isArray(k.groupes)) k.groupes = [];
  let e = null;
  for (const g of k.groupes) for (const x of Array.isArray(g?.elements) ? g.elements : []) if (x?.fichier === rel) e = x;
  if (!e) {
    let g = k.groupes.find((x) => x?.id === 'ajouts');
    if (!g) { g = {id: 'ajouts', titre: 'Ajoutés depuis Dérush', texte: '', elements: []}; k.groupes.push(g); }
    if (!Array.isArray(g.elements)) g.elements = [];
    e = {fichier: rel};
    g.elements.push(e);
  }
  if (titre !== undefined) e.titre = texte(titre, 120);
  if (t !== undefined) e.texte = long(t, 700);
  if (usage !== undefined) e.usage = long(usage, 400);
  k.maj = aujourdhui();
  ecrireDescription(D, k);
  return ecrireKitMd(id);
}

/** Retire un fichier du kit : il part dans kit/.retires/<date>/ (rien n'est effacé), et sa description s'en va. */
export function retirerDuKit(id, fichier) {
  const {D, rel, p} = cheminDansKit(id, fichier);
  const dst = path.join(D, '.retires', aujourdhui(), rel);
  fs.mkdirSync(path.dirname(dst), {recursive: true});
  let cible = dst;
  for (let n = 2; fs.existsSync(cible); n++) cible = `${dst.slice(0, -path.extname(dst).length || undefined)}-${n}${path.extname(dst)}`;
  fs.renameSync(p, cible);
  const k = lireDescription(D);
  if (k && Array.isArray(k.groupes)) {
    for (const g of k.groupes) {
      if (!Array.isArray(g?.elements)) continue;
      g.elements = g.elements.filter((x) => x?.fichier !== rel);
      for (const x of g.elements) if (Array.isArray(x.variantes)) x.variantes = x.variantes.filter((v) => v !== rel);
    }
    k.maj = aujourdhui();
    ecrireDescription(D, k);
  }
  return ecrireKitMd(id);
}

// ——— les aperçus (pour l'interface) : une petite image par fichier, faite une fois ———
let enCours = 0;
const file = [];
const tour = () => new Promise((ok) => { if (enCours < 2) { enCours++; ok(); } else file.push(ok); });
const fini = () => { const s = file.shift(); if (s) s(); else enCours--; };

/**
 * L'aperçu d'un fichier du kit : {chemin, type}. Un SVG se montre tel quel ; une image (PNG, JPEG, PSD…) ou une vidéo
 * donne une petite image PNG faite par FFmpeg et gardée dans kit/.apercus/. null quand il n'y a rien à montrer.
 */
export async function apercuKit(id, fichier) {
  const {D, rel, p, st} = cheminDansKit(id, fichier);
  const genre = genreFichier(rel);
  if (/\.svg$/i.test(rel)) return {chemin: p, type: 'image/svg+xml'};
  if (genre !== 'image' && genre !== 'video') return null;
  const cle = crypto.createHash('sha1').update(`${rel}:${st.size}:${Math.round(st.mtimeMs)}`).digest('hex').slice(0, 20);
  const sortie = path.join(D, '.apercus', `${cle}.png`);
  if (fs.existsSync(sortie)) return {chemin: sortie, type: 'image/png'};
  fs.mkdirSync(path.dirname(sortie), {recursive: true});
  await tour();
  try {
    const tmp = `${sortie}.part.png`;
    await ffmpeg([...(genre === 'video' ? ['-ss', '0.8'] : []), '-i', p, '-frames:v', '1', '-vf', 'scale=480:480:force_original_aspect_ratio=decrease', '-y', tmp]);
    fs.renameSync(tmp, sortie);
    return {chemin: sortie, type: 'image/png'};
  } catch { return null; } finally { fini(); }
}

/**
 * Pose le kit de l'espace dans le dossier de travail de l'IA (contexte/espace/kit/, avec KIT.md) et le dit dans
 * ESPACE.md. Les fichiers ne sont reposés que si le kit a changé depuis la dernière fois. Pour « Personne », un espace
 * sans kit, ou rien : le dossier est retiré. Renvoie le kit posé (ou null).
 */
export async function installerKit(atelier, e) {
  const dst = path.join(atelier, 'contexte', 'espace', 'kit');
  const kit = e && e.type !== 'neutre' ? lireKit(e.id) : null;
  if (!kit?.nb) { fs.rmSync(dst, {recursive: true, force: true}); return null; }
  const src = dossierKit(e.id);
  const fichiers = kit.groupes.flatMap((g) => g.elements.flatMap((x) => [x.fichier, ...x.variantes]));
  const empreinte = crypto.createHash('sha1').update(JSON.stringify([e.id, ...fichiers.map((f) => {
    try { const s = fs.statSync(path.join(src, f)); return [f, s.size, Math.round(s.mtimeMs)]; } catch { return [f]; }
  })])).digest('hex');
  const marque = path.join(dst, '.empreinte');
  let deja = null;
  try { deja = fs.readFileSync(marque, 'utf8'); } catch { /* pas encore posé */ }
  if (deja !== empreinte) {
    fs.rmSync(dst, {recursive: true, force: true});
    // par paquets de 8 : un kit de 150 fichiers se pose en une seconde
    for (let i = 0; i < fichiers.length; i += 8) {
      await Promise.all(fichiers.slice(i, i + 8).map(async (f) => {
        const a = path.join(src, f);
        const b = path.join(dst, f);
        fs.mkdirSync(path.dirname(b), {recursive: true});
        if (!(await cloner(a, b))) { try { fs.copyFileSync(a, b); } catch { /* un fichier illisible ne bloque pas le kit */ } }
      }));
    }
    fs.writeFileSync(marque, empreinte);
  }
  fs.writeFileSync(path.join(dst, 'KIT.md'), kitEnTexte(kit));
  const esp = path.join(atelier, 'contexte', 'espace', 'ESPACE.md');
  if (fs.existsSync(esp)) {
    fs.appendFileSync(esp, `\n## Le kit média\n\n${kit.nb} fichiers dans contexte/espace/kit/ (logos, charte, polices, fonds… selon l’espace). **Lis contexte/espace/kit/KIT.md avant de poser un logo, une police, un fond ou le logo d’un partenaire** : il dit ce qu’est chaque fichier, quand s’en servir et les règles à respecter. Pour t’en servir dans Remotion, copie le fichier voulu dans remotion/public/ (staticFile). N’agrandis jamais un logo au-delà de sa taille (prends le SVG quand il y en a un), et ne pose le logo d’un partenaire que si la vidéo le concerne.\n`);
  }
  return kit;
}

/** La consigne qui va avec, redite à chaque demande quand le projet a un kit. */
export const consigneKit = (kit) => `- Le kit média de l’espace est posé dans contexte/espace/kit/ (${kit.nb} fichiers) : lis contexte/espace/kit/KIT.md avant de poser un logo, une police, un fond ou le logo d’un partenaire, et respecte ses règles. Ne mets dans la vidéo que ce que la demande justifie : un kit n’est pas une liste de choses à tout montrer.`;
