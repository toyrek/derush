// Dérush — la bibliothèque de compétences (« skills ») que l'IA lit directement.
// - competences/ (livrée avec l'app) : réseaux sociaux, ElevenLabs, FFmpeg, étalonnage, sous-titres, contrôle qualité,
//   miniatures, mixage, motion design, Blender, ImageMagick, passage vers Premiere / Resolve, publication avec Treg,
//   sons libres (sons-openverse) ;
// - les compétences Remotion, téléchargées chez l'utilisateur à l'installation (leur dépôt n'a pas de licence de
//   redistribution), dans le dossier de Dérush ; Real SFX et le guide d'Earshot aussi (voir sons.mjs) ;
// - celles que la personne ajoute elle-même (bouton « Ajouter une compétence », lib/competences-ajoutees.mjs), dans
//   competences/ajoutees/ du dossier de Dérush : jamais lancées par Dérush, et sans commande toute prête.
// À chaque demande, elles sont reliées dans le dossier de travail : .claude/skills/ (Claude) et .agents/skills/ (Codex,
// Gemini).
// Les compétences qui sont des programmes Python reçoivent une commande toute prête (color-grading, qc…), sans pip install.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {Readable, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {RACINE_APP, DOSSIER_SUPPORT, PYTHON} from './moteurs.mjs';
import {WINDOWS, lier, delier, trouver, cheminCmd, texteCmd} from './plateforme.mjs';
import {lancer} from './outils.mjs';
import {VERSION} from './commun.mjs';

export const DOSSIER_LIVRE = path.join(RACINE_APP, 'competences');
export const DOSSIER_TELECHARGE = path.join(DOSSIER_SUPPORT, 'competences');
export const DOSSIER_COMMANDES = path.join(DOSSIER_SUPPORT, 'bin');
export const DOSSIER_AJOUTEES = path.join(DOSSIER_TELECHARGE, 'ajoutees');
export const REGISTRE_AJOUTEES = path.join(DOSSIER_AJOUTEES, 'registre.json');
const DEPOT_REMOTION = 'https://codeload.github.com/remotion-dev/skills/tar.gz/HEAD';

/**
 * L'en-tête d'un SKILL.md (entre deux lignes « --- ») : les clés du premier niveau, valeurs simples, entre guillemets
 * ou en bloc YAML (« > », « | », sur plusieurs lignes en retrait). Sans dépendance : juste ce qu'il faut pour lire
 * name, description et license.
 */
export function enteteSkill(texte) {
  const fm = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(String(texte ?? ''))?.[1] ?? '';
  const lignes = fm.split(/\r?\n/);
  const r = {};
  for (let i = 0; i < lignes.length; i++) {
    const m = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/.exec(lignes[i]);
    if (!m) continue;
    let v = (m[2] ?? '').trim();
    let garder = false;
    if (/^[>|][+-]?$/.test(v) || v === '') {
      // un bloc : les lignes suivantes en retrait (« > » les joint par des espaces, « | » garde les retours)
      const bloc = [];
      while (i + 1 < lignes.length && (/^\s+\S/.test(lignes[i + 1]) || lignes[i + 1].trim() === '')) bloc.push(lignes[++i].trim());
      if (v === '' && bloc.some((x) => /^[\w-]+:/.test(x))) continue; // une table imbriquée (metadata:) : ignorée
      garder = v.startsWith('|');
      v = (garder ? bloc.join('\n') : bloc.join(' ')).trim();
    } else if (/^(['"])/.test(v)) {
      const q = v[0];
      // une chaîne entre guillemets qui continue sur les lignes suivantes
      while (!(v.length > 1 && v.endsWith(q)) && i + 1 < lignes.length && /^\s/.test(lignes[i + 1])) v += ` ${lignes[++i].trim()}`;
      v = v.slice(1, v.endsWith(q) && v.length > 1 ? -1 : undefined);
      if (q === "'") v = v.replace(/''/g, "'"); else v = v.replace(/\\"/g, '"');
    } else {
      // une valeur simple qui continue sur les lignes suivantes, en retrait : YAML les joint par une espace
      while (i + 1 < lignes.length && /^\s+\S/.test(lignes[i + 1])) v += ` ${lignes[++i].trim()}`;
    }
    r[m[1]] = garder ? v : v.replace(/\s+/g, ' ').trim();
  }
  return r;
}

// ——— ce qu'un SKILL.md peut faire faire à Claude Code tout seul, sans que l'IA ni la personne le décident ———
// « hooks » et « mcpServers » : des commandes que Claude Code lance lui-même dès que la compétence est ouverte, puis à
// chaque geste de l'IA ; « !`commande` » dans le texte : lancée à l'ouverture, avant que l'IA ait rien lu ;
// « allowed-tools », « shell », « context », « agent » : des droits ou une façon de se lancer que la compétence se donne.
// Dérush promet de ne jamais lancer le code d'une compétence venue d'ailleurs : il retire tout cela avant de la ranger.
const CLES_QUI_LANCENT = ['hooks', 'mcpServers'];
const CLES_DE_DROITS = ['allowed-tools', 'shell', 'context', 'agent'];
const ENTETE_LARGE = /^\uFEFF?\s*---[ \t]*\r?\n([\s\S]*?)\r?\n---/;
const CLE_RISQUEE = new RegExp(`(?:^|[{,])[ \\t]*["']?(${[...CLES_QUI_LANCENT, ...CLES_DE_DROITS].join('|')})["']?[ \\t]*:`, 'gm');
const COMMANDE_DIRECTE = /!`[^`\n]+`|^[ \t]*```!/m;
/** Ce qu'un SKILL.md déclare de risqué : {cles: [...], commandes, lance} (lance : Claude Code exécuterait quelque chose seul). */
export function risquesSkill(texte) {
  const t = String(texte ?? '');
  const cles = [...new Set([...(ENTETE_LARGE.exec(t)?.[1] ?? '').matchAll(CLE_RISQUEE)].map((m) => m[1]))];
  const commandes = COMMANDE_DIRECTE.test(t);
  return {cles, commandes, lance: commandes || cles.some((k) => CLES_QUI_LANCENT.includes(k))};
}
/**
 * Le même SKILL.md, désarmé : sans ces clés dans son en-tête (avec tout leur bloc), et ses « !`commande` » devenues
 * de simples citations. Le reste n'est pas touché. Renvoie {texte, retirees: [clés], commandes: nombre}.
 */
export function desarmerSkill(texte) {
  let t = String(texte ?? '');
  const retirees = [];
  const m = ENTETE_LARGE.exec(t);
  if (m) {
    const fin = m[0].includes('\r\n') ? '\r\n' : '\n';
    const lignes = m[1].split(/\r?\n/);
    const gardees = [];
    for (let i = 0; i < lignes.length; i++) {
      const cle = /^["']?([A-Za-z_][\w-]*)["']?[ \t]*:/.exec(lignes[i])?.[1];
      if (cle && (CLES_QUI_LANCENT.includes(cle) || CLES_DE_DROITS.includes(cle))) {
        retirees.push(cle);
        // tout son bloc part avec elle : les lignes en retrait, les lignes vides, les éléments d'une liste (« - … »)
        while (i + 1 < lignes.length && (/^\s/.test(lignes[i + 1]) || lignes[i + 1].trim() === '' || /^-(\s|$)/.test(lignes[i + 1]))) i++;
        continue;
      }
      gardees.push(lignes[i]);
    }
    const debut = m[0].indexOf(m[1], m[0].indexOf('---') + 3);
    t = t.slice(0, m.index) + m[0].slice(0, debut) + gardees.join(fin) + m[0].slice(debut + m[1].length) + t.slice(m.index + m[0].length);
  }
  let commandes = 0;
  t = t.replace(/!(`[^`\n]+`)/g, (_, c) => { commandes++; return c; }).replace(/^([ \t]*```)!/gm, (_, c) => { commandes++; return c; });
  return {texte: t, retirees, commandes};
}

const lireSkill = (dossier) => {
  try {
    const texte = fs.readFileSync(path.join(dossier, 'SKILL.md'), 'utf8');
    const e = enteteSkill(texte);
    const nom = /^[\w.-]+$/.test(e.name ?? '') ? e.name : path.basename(dossier);
    return {nom, description: String(e.description ?? '').trim(), dossier, lance: risquesSkill(texte).lance};
  } catch { return null; }
};
export {lireSkill};
/**
 * Les compétences d'un dossier : chaque sous-dossier qui a un SKILL.md (et ceux d'un niveau plus bas, pour Remotion).
 * Les dossiers cachés (« .tmp-… ») et ceux de `sauf` sont passés.
 */
function dansDossier(racine, source, sauf = [], {unNiveau = false} = {}) {
  const r = [];
  let noms = [];
  try { noms = fs.readdirSync(racine); } catch { return r; }
  for (const n of noms) {
    if (n.startsWith('.') || sauf.includes(n)) continue;
    const d = path.join(racine, n);
    const s = lireSkill(d);
    if (s) r.push({...s, source});
    else if (unNiveau) continue;
    else { try { for (const m of fs.readdirSync(d)) { const t = lireSkill(path.join(d, m)); if (t) r.push({...t, source}); } } catch { /* pas un dossier */ } }
  }
  return r;
}
/** Le registre des compétences ajoutées par la personne : {v, competences: {<dossier>: {nom, depot, commit, actif…}}}. */
export function registreAjoutees() {
  try {
    const r = JSON.parse(fs.readFileSync(REGISTRE_AJOUTEES, 'utf8'));
    if (r && typeof r.competences === 'object' && r.competences && !Array.isArray(r.competences)) return {v: 1, ...r};
  } catch { /* pas encore de registre */ }
  return {v: 1, competences: {}};
}
let memo = {t: 0, v: null};
/**
 * Toutes les compétences disponibles (livrées, téléchargées, puis ajoutées et actives), sans doublon de nom : une
 * compétence ajoutée qui porte le nom d'une livrée est ignorée (l'interface le dit au moment de l'ajout).
 */
export function listerCompetences() {
  if (memo.v && Date.now() - memo.t < 30000) return memo.v;
  const vus = new Map();
  const reg = registreAjoutees().competences;
  const inscrite = (s) => (Object.hasOwn(reg, path.basename(s.dossier)) ? reg[path.basename(s.dossier)] : null);
  // une compétence ajoutée dont le SKILL.md lancerait quelque chose tout seul (ajoutée avant que Dérush le retire, ou
  // retouchée à la main depuis) n'est pas donnée à l'IA : la reprendre dans Dérush la désarme
  const ajoutees = dansDossier(DOSSIER_AJOUTEES, 'ajoutee', [], {unNiveau: true}).filter((s) => inscrite(s) && inscrite(s).actif !== false && !s.lance);
  for (const s of [...dansDossier(DOSSIER_LIVRE, 'derush'), ...dansDossier(DOSSIER_TELECHARGE, 'telechargee', ['ajoutees']), ...ajoutees]) if (!vus.has(s.nom)) vus.set(s.nom, s);
  memo = {t: Date.now(), v: [...vus.values()].sort((a, b) => a.nom.localeCompare(b.nom))};
  return memo.v;
}
export const competencesPresentes = () => new Set(listerCompetences().map((s) => s.nom));
// seulement celles que Dérush a téléchargées lui-même : une compétence ajoutée qui en prendrait le nom ne compte pas
export const remotionPresent = () => listerCompetences().some((s) => s.nom === 'remotion-best-practices' && s.source !== 'ajoutee');
/** À appeler quand une compétence vient d'être téléchargée ou retirée. */
export const oublierCompetences = () => { memo.t = 0; };

// Sur un disque qui n'accepte pas les liens (exFAT, FAT, certains partages), la compétence est copiée. La copie porte
// cette marque : Dérush sait qu'elle est à lui, d'où elle vient et de quand elle date.
const MARQUE_COPIE = '.derush-copie';
const signature = (s) => { try { const st = fs.statSync(path.join(s.dossier, 'SKILL.md')); return `${VERSION} ${s.dossier} ${st.size} ${Math.round(st.mtimeMs)}`; } catch { return null; } };

/** Relie toutes les compétences dans le dossier de travail de l'IA (rien n'est copié, sauf sur un disque sans liens). */
export function installerCompetences(atelier) {
  const liste = listerCompetences();
  const parNom = new Map(liste.map((s) => [s.nom, s]));
  for (const base of [path.join(atelier, '.claude', 'skills'), path.join(atelier, '.agents', 'skills')]) {
    fs.mkdirSync(base, {recursive: true});
    // on refait les liens à chaque fois (l'app a pu être mise à jour) ; un vrai dossier posé là par l'IA reste
    for (const n of fs.readdirSync(base)) {
      const c = path.join(base, n);
      try {
        if (fs.lstatSync(c).isSymbolicLink()) { delier(c); continue; }
        // une copie faite par Dérush : retirée si la compétence n'est plus donnée (pause, retrait) ou a changé depuis
        const marque = path.join(c, MARQUE_COPIE);
        if (fs.existsSync(marque) && (!parNom.has(n) || fs.readFileSync(marque, 'utf8') !== signature(parNom.get(n)))) fs.rmSync(c, {recursive: true, force: true});
      } catch { /* déjà parti */ }
    }
    for (const s of liste) {
      const lien = path.join(base, s.nom);
      if (fs.existsSync(lien)) continue;
      if (!lier(s.dossier, lien)) { try { fs.cpSync(s.dossier, lien, {recursive: true}); fs.writeFileSync(path.join(lien, MARQUE_COPIE), signature(s) ?? ''); } catch { /* tant pis pour celle-ci */ } }
    }
  }
  preparerCommandes();
  return liste.length;
}

// ——— les commandes des compétences qui sont des programmes Python (color-grading, qc, subtitle-skill…) ———
function scriptsPython(dossier) {
  try {
    const t = fs.readFileSync(path.join(dossier, 'pyproject.toml'), 'utf8');
    const bloc = /\[project\.scripts\]\s*\n([\s\S]*?)(?:\n\[|$)/.exec(t)?.[1] ?? '';
    return [...bloc.matchAll(/^\s*([\w.-]+)\s*=\s*"([\w.]+):(\w+)"/gm)].map(([, nom, module, fonction]) => ({nom, module, fonction}));
  } catch { return []; }
}
/** Le Python à utiliser : celui de Dérush (ses moteurs), sinon celui de l'ordinateur. */
export function pythonPourIA() {
  if (fs.existsSync(PYTHON)) return PYTHON;
  return trouver(WINDOWS ? 'python' : 'python3') ?? trouver('python');
}
/** Écrit les petites commandes (dans le dossier de Dérush) que l'IA trouve dans son PATH. */
export function preparerCommandes() {
  const py = pythonPourIA();
  fs.mkdirSync(DOSSIER_COMMANDES, {recursive: true});
  // sous Windows, les chemins partent du dossier des commandes (voir cheminCmd : cmd.exe lit mal « Dérush » écrit en UTF-8)
  const c = (cible) => cheminCmd(DOSSIER_COMMANDES, cible);
  const ecrire = (nom, contenuSh, contenuCmd) => {
    try {
      if (WINDOWS) fs.writeFileSync(path.join(DOSSIER_COMMANDES, `${nom}.cmd`), texteCmd(contenuCmd));
      else { const f = path.join(DOSSIER_COMMANDES, nom); fs.writeFileSync(f, contenuSh); fs.chmodSync(f, 0o755); }
    } catch { /* dossier en lecture seule */ }
  };
  // « derush-youtube » : l'envoi d'une vidéo sur YouTube avec Treg (voir lib/youtube.mjs et la compétence derush-publier)
  const youtube = path.join(RACINE_APP, 'outils', 'publier-youtube.mjs');
  ecrire('derush-youtube', `#!/bin/sh\nexec "${process.execPath}" "${youtube}" "$@"\n`, `@echo off\n"${c(process.execPath)}" "${c(youtube)}" %*\n`);
  // « derush-son » : la voix claire, l'écho réduit, le mixage et les mesures du son (voir lib/son.mjs)
  const son = path.join(RACINE_APP, 'outils', 'derush-son.mjs');
  ecrire('derush-son', `#!/bin/sh\nexec "${process.execPath}" "${son}" "$@"\n`, `@echo off\n"${c(process.execPath)}" "${c(son)}" %*\n`);
  // « derush-controle » : lit le texte à l'écran et signale les mots collés, le texte coupé ou caché (voir lib/controle.mjs)
  const controle = path.join(RACINE_APP, 'outils', 'derush-controle.mjs');
  ecrire('derush-controle', `#!/bin/sh\nexec "${process.execPath}" "${controle}" "$@"\n`, `@echo off\n"${c(process.execPath)}" "${c(controle)}" %*\n`);
  // « derush-detourer » : la personne filmée, détourée image par image, pour un titre derrière elle (voir lib/detourage.mjs)
  const detourer = path.join(RACINE_APP, 'outils', 'derush-detourer.mjs');
  ecrire('derush-detourer', `#!/bin/sh\nexec "${process.execPath}" "${detourer}" "$@"\n`, `@echo off\n"${c(process.execPath)}" "${c(detourer)}" %*\n`);
  if (!py) return DOSSIER_COMMANDES;
  // python3 mène au Python de Dérush (sous Windows, « python3 » n'existe pas ; sur un Mac neuf, c'est un leurre qui
  // demande d'installer les outils de développement)
  if (fs.existsSync(PYTHON)) {
    // « python » aussi, partout : des compétences (Real SFX…) l'appellent ainsi
    for (const nom of ['python3', 'python']) ecrire(nom, `#!/bin/sh\nexec "${PYTHON}" "$@"\n`, `@echo off\n"${c(PYTHON)}" %*\n`);
  }
  for (const s of listerCompetences()) {
    if (s.source === 'ajoutee') continue;
    const src = path.join(s.dossier, 'src');
    if (!fs.existsSync(src)) continue;
    for (const x of scriptsPython(s.dossier)) {
      // le chemin passe par une variable d'environnement : aucun guillemet à échapper dans le code Python
      const code = `import os, sys; sys.path.insert(0, os.environ['DERUSH_SRC']); from ${x.module} import ${x.fonction} as m; sys.argv[0] = '${x.nom}'; sys.exit(m())`;
      ecrire(x.nom, `#!/bin/sh\nDERUSH_SRC='${src.replace(/'/g, `'\\''`)}'\nexport DERUSH_SRC\nexec "${py}" -c "${code}" "$@"\n`, `@echo off\nset "DERUSH_SRC=${c(src)}"\n"${c(py)}" -c "${code}" %*\n`);
    }
  }
  return DOSSIER_COMMANDES;
}

// ——— télécharger et ouvrir une archive de GitHub, avec des bornes (Remotion ici, les compétences ajoutées à côté) ———
/** Les bornes : une archive, ce qu'elle contient une fois ouverte, son nombre de fichiers. */
export const BORNES_ARCHIVE = {archive: 60 * 1024 * 1024, extrait: 200 * 1024 * 1024, fichiers: 10000};
const mo = (octets) => Math.round(octets / 2 ** 20);
/** Lit le corps d'une réponse sans jamais dépasser `max` octets (arrêté en route s'il est plus gros). */
export async function lireCorpsBorne(r, max) {
  const annonce = Number(r.headers.get('content-length'));
  if (Number.isFinite(annonce) && annonce > max) throw new Error(`Le dépôt est trop gros (${mo(annonce)} Mo ; ${mo(max)} Mo au plus).`);
  const morceaux = [];
  let n = 0;
  for await (const m of r.body) {
    n += m.length;
    if (n > max) throw new Error(`Le dépôt est trop gros (plus de ${mo(max)} Mo).`);
    morceaux.push(Buffer.from(m));
  }
  return Buffer.concat(morceaux);
}
/** Compte ce qu'une archive .tar contient, sans rien en sortir : {fichiers, octets} (lu dans ses en-têtes). */
function contenuTar(fichier) {
  const fd = fs.openSync(fichier, 'r');
  const tete = Buffer.alloc(512);
  let pos = 0;
  let fichiers = 0;
  let octets = 0;
  try {
    while (fs.readSync(fd, tete, 0, 512, pos) === 512) {
      if (tete.every((o) => o === 0)) break; // la fin de l'archive
      const taille = parseInt(tete.subarray(124, 136).toString('latin1').replace(/[\0 ]+$/, '').trim() || '0', 8);
      if (!Number.isFinite(taille) || taille < 0) break; // une taille écrite autrement : on s'en tient à ce qui est compté
      const sorte = String.fromCharCode(tete[156]);
      if (sorte === '0' || sorte === '\0' || sorte === '7') { fichiers++; octets += taille; }
      pos += 512 + Math.ceil(taille / 512) * 512;
    }
  } finally { fs.closeSync(fd); }
  return {fichiers, octets};
}
/**
 * Ouvre une archive .tar.gz (déjà en mémoire) dans `tmp/x` et renvoie ce dossier. Rien n'est écrit au-delà des bornes :
 * l'archive est d'abord décompressée ici, arrêtée dès qu'elle dépasse `extrait` (une archive de 60 Mo peut cacher des
 * dizaines de Go de fichiers répétés), puis ses en-têtes sont comptés, et seulement alors tar l'ouvre.
 * tar refuse les chemins absolus et les « .. ».
 */
export async function ouvrirArchive(gz, tmp, {extrait = BORNES_ARCHIVE.extrait, fichiers = BORNES_ARCHIVE.fichiers} = {}) {
  const tar = path.join(tmp, 'depot.tar');
  const tropGros = `Le dépôt est trop gros une fois ouvert (plus de ${mo(extrait)} Mo).`;
  let n = 0;
  // un peu de marge : les en-têtes et le remplissage de tar ne sont pas des fichiers
  const compteur = new Transform({transform(m, _, suite) { n += m.length; suite(n > extrait * 1.1 + 2 ** 20 ? Object.assign(new Error(tropGros), {borne: true}) : null, m); }});
  try { await pipeline(Readable.from([gz]), zlib.createGunzip(), compteur, fs.createWriteStream(tar)); }
  catch (e) { fs.rmSync(tar, {force: true}); throw e.borne ? e : new Error('L’archive du dépôt est illisible : réessaie dans un moment.'); }
  try {
    const dedans = contenuTar(tar);
    if (dedans.octets > extrait) throw new Error(tropGros);
    if (dedans.fichiers > fichiers) throw new Error(`Trop de fichiers (plus de ${fichiers}).`);
    const sortie = path.join(tmp, 'x');
    fs.mkdirSync(sortie);
    await lancer('tar', ['-xf', tar, '-C', sortie]);
    return sortie;
  } finally { fs.rmSync(tar, {force: true}); }
}

/** Télécharge les compétences Remotion depuis leur dépôt officiel (à l'installation, ou plus tard depuis les Réglages). */
export async function telechargerRemotion() {
  let r;
  try { r = await fetch(process.env.DERUSH_DEPOT_REMOTION || DEPOT_REMOTION, {redirect: 'follow', signal: AbortSignal.timeout(120000)}); }
  catch { throw new Error('Le dépôt des compétences Remotion est injoignable : vérifie ta connexion à internet, puis réessaie.'); }
  if (!r.ok) throw new Error(`Le dépôt des compétences Remotion ne répond pas (${r.status}).`);
  const gz = await lireCorpsBorne(r, BORNES_ARCHIVE.archive);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-remotion-'));
  try {
    const sortie = await ouvrirArchive(gz, tmp);
    const haut = fs.readdirSync(sortie).filter((n) => !n.startsWith('.') && !n.startsWith('pax_global_header'));
    const racine = haut.length === 1 ? path.join(sortie, haut[0]) : sortie;
    // le dépôt range ses compétences dans skills/ (ou à la racine)
    const dossier = fs.existsSync(path.join(racine, 'skills')) ? path.join(racine, 'skills') : racine;
    const trouvees = dansDossier(dossier, 'telechargee');
    if (!trouvees.length) throw new Error('Aucune compétence trouvée dans le dépôt Remotion.');
    // comme pour une compétence ajoutée : aucun lien n'est suivi ni copié, et ce que Claude Code lancerait tout seul
    // (« hooks », « !`commande` ») est retiré de chaque SKILL.md. Ce dépôt est pris à sa version du jour, pas à une
    // version relue : c'est ce garde-fou qui tient lieu de relecture.
    const cible = path.join(DOSSIER_TELECHARGE, 'remotion');
    const neuf = path.join(DOSSIER_TELECHARGE, '.remotion-neuf'); // caché : jamais pris pour une compétence
    fs.rmSync(neuf, {recursive: true, force: true});
    fs.mkdirSync(DOSSIER_TELECHARGE, {recursive: true});
    fs.cpSync(dossier, neuf, {recursive: true, filter: (src) => !fs.lstatSync(src).isSymbolicLink()});
    for (const s of dansDossier(neuf, 'telechargee')) {
      const f = path.join(s.dossier, 'SKILL.md');
      const d = desarmerSkill(fs.readFileSync(f, 'utf8'));
      if (d.retirees.length || d.commandes) fs.writeFileSync(f, d.texte);
    }
    fs.writeFileSync(path.join(neuf, 'SOURCE.md'), `# Provenance\n\n- Source : https://github.com/remotion-dev/skills, téléchargée le ${new Date().toISOString().slice(0, 10)} sur cet ordinateur.\n- Pas de licence de redistribution : Dérush ne la livre pas, il la télécharge chez toi depuis le dépôt officiel.\n`);
    fs.rmSync(cible, {recursive: true, force: true});
    fs.renameSync(neuf, cible);
    memo.t = 0;
    return trouvees.length;
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}
