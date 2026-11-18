// Dérush — le graphiste du Mode Hollywood : ChatGPT dessine ce qui manque au montage (un autocollant, une
// illustration, un fond, un objet, un personnage, une planche de sprites pour une petite animation), avec l'outil
// d'images intégré à Codex (gpt-image-2) et le forfait ChatGPT de la personne : aucune clé.
//   - Le monteur le demande par la commande derush-image (outils/derush-image.mjs) : directement pour Claude, par le
//     relais de Dérush pour Codex et Gemini (leur bac à sable ne peut pas lancer Codex).
//   - Codex lance son outil d'images (image_gen) dans un dossier vide, en lecture seule. L'image est rangée dans le
//     journal de sa session ($CODEX_HOME/sessions/…, en base64), ou dans $CODEX_HOME/generated_images/ : Dérush la
//     reprend là, sans demander au modèle d'écrire quoi que ce soit.
//   - Fond transparent : les pixels presque invisibles et les taches loin du sujet sont effacés, les marges retirées
//     (outils/graphiste.py). Une animation : une planche de sprites (une grille régulière), découpée en images de même
//     taille au même cadre, puis un GIF en boucle (FFmpeg). Le GIF fait par ChatGPT lui-même n'est pas ouvert à tous
//     les comptes (« GIF output is not enabled », 18 nov. 2026) : Dérush ne s'en sert pas.
//   - Chaque dessin est noté dans .derush/graphiste.jsonl du dossier de travail : Dérush les montre en direct et les
//     compte à la fin (« ChatGPT a dessiné 3 images »).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {lancer, ffmpeg} from './outils.mjs';
import {PYTHON, RACINE_APP} from './moteurs.mjs';
import {slug} from './commun.mjs';
import {commandeLancement, envIA, connecteursCodex} from './ia.mjs';
import {QUOTA_ATTEINT, noterQuotaAtteint} from './quotas.mjs';
import {compteDeDossier} from './comptes.mjs';

/** Les formats proposés (dits au modèle dans la description : son outil choisit lui-même la taille). */
export const FORMATS_IMAGE = {carre: 'carré (1:1)', vertical: 'vertical (2:3), pour une vidéo 9:16', horizontal: 'horizontal (3:2)', large: 'très large (16:9)'};
export const MAX_VARIANTES = 4;
export const MAX_REFS = 3;
/** Les planches de sprites possibles : le nombre d'images, et sa grille (colonnes × lignes, des cases carrées). */
export const GRILLES = {2: [2, 1], 3: [3, 1], 4: [2, 2], 6: [3, 2], 8: [4, 2], 9: [3, 3], 12: [4, 3], 16: [4, 4]};
/** Où vont les dessins, par défaut : dans le kit, là où staticFile() les trouve (« ia/… »). */
export const DOSSIER_DESSINS = path.join('remotion', 'public', 'ia');
const DELAI = 8 * 60e3;
const JOURNAL = (atelier) => path.join(atelier, '.derush', 'graphiste.jsonl');

export class ErreurGraphiste extends Error {
  constructor(genre, message) { super(message); this.genre = genre; }
}
const court = (t, n = 300) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const dedans = (dossier, f) => { const rel = path.relative(dossier, f); return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel); };
const vrai = (f) => { try { return fs.realpathSync(f); } catch { return path.resolve(f); } };

/** Le nombre d'images d'une animation, arrondi à la grille la plus proche au-dessus (5 → 6, 7 → 8, 10 → 12…). */
export function grilleAnimation(n) {
  const voulu = Math.max(2, Math.min(16, Math.round(Number(n) || 8)));
  const k = Object.keys(GRILLES).map(Number).find((x) => x >= voulu) ?? 16;
  return {images: k, colonnes: GRILLES[k][0], lignes: GRILLES[k][1]};
}

/** Le dossier de travail qui contient ce dossier (celui qui a montage.json), sinon le dossier lui-même. */
export function racineAtelier(depart) {
  let d = path.resolve(depart);
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(d, 'montage.json')) && fs.existsSync(path.join(d, 'remotion'))) return d;
    const p = path.dirname(d);
    if (p === d) break;
    d = p;
  }
  return path.resolve(depart);
}

/**
 * Lit les arguments de derush-image : la description, puis ce qui est voulu (fond transparent, format, variantes, une
 * animation, des images de référence) et où ranger. Tout chemin reste dans le dossier de travail (`atelier`) ; un
 * chemin relatif part de `cwd`. Renvoie {description, transparent, format, variantes, anime: {images, colonnes,
 * lignes, fps} | null, refs, sortie} : `sortie` est un fichier .png (une image) ou un dossier (variantes, animation).
 */
export function lireArguments(args, {atelier, cwd = atelier} = {}) {
  if (!Array.isArray(args) || args.length > 40 || args.some((a) => typeof a !== 'string' || a.length > 4000)) throw new ErreurGraphiste('arguments', 'Demande illisible.');
  const reste = [...args];
  const prendre = (...noms) => {
    for (const n of noms) {
      const i = reste.indexOf(n);
      if (i < 0) continue;
      const v = reste[i + 1];
      if (v == null || /^--?[a-z]/i.test(v)) throw new ErreurGraphiste('arguments', `${n} : il manque la valeur.`);
      reste.splice(i, 2);
      return v;
    }
    return null;
  };
  const drapeau = (...noms) => { let oui = false; for (const n of noms) { const i = reste.indexOf(n); if (i >= 0) { reste.splice(i, 1); oui = true; } } return oui; };
  const refs = [];
  for (let r = prendre('--ref'); r != null; r = prendre('--ref')) refs.push(r);
  const sortie = prendre('-o', '--sortie');
  const format = prendre('--format');
  const variantes = prendre('--variantes');
  const images = prendre('--images');
  const fps = prendre('--fps');
  const anime = drapeau('--anime', '--animation', '--sprites');
  const transparentDit = drapeau('--transparent');
  const opaque = drapeau('--opaque');
  const inconnue = reste.find((a) => /^-{1,2}[a-z]/i.test(a));
  if (inconnue) throw new ErreurGraphiste('arguments', `Option inconnue : ${inconnue} (derush-image --help).`);
  const description = reste.join(' ').replace(/\s+/g, ' ').trim();
  if (description.length < 3) throw new ErreurGraphiste('arguments', 'Décris ce que ChatGPT doit dessiner : derush-image "un autocollant étoile jaune" --transparent');
  if (description.length > 2000) throw new ErreurGraphiste('arguments', 'Description trop longue (2 000 caractères au plus).');
  if (format != null && !FORMATS_IMAGE[format]) throw new ErreurGraphiste('arguments', `--format : ${Object.keys(FORMATS_IMAGE).join(', ')}.`);
  const nVariantes = variantes == null ? 1 : Number(variantes);
  if (!Number.isInteger(nVariantes) || nVariantes < 1 || nVariantes > MAX_VARIANTES) throw new ErreurGraphiste('arguments', `--variantes : de 1 à ${MAX_VARIANTES}.`);
  if (anime && nVariantes > 1) throw new ErreurGraphiste('arguments', 'Une animation se fait une à la fois (sans --variantes).');
  if (!anime && (images != null || fps != null)) throw new ErreurGraphiste('arguments', '--images et --fps vont avec --anime.');
  const nFps = fps == null ? 10 : Number(fps);
  if (!(nFps >= 1 && nFps <= 30)) throw new ErreurGraphiste('arguments', '--fps : de 1 à 30 images par seconde.');
  if (transparentDit && opaque) throw new ErreurGraphiste('arguments', '--transparent ou --opaque, pas les deux.');
  // les références : des images du dossier de travail (un rush, un personnage déjà dessiné, le logo de la personne)
  if (refs.length > MAX_REFS) throw new ErreurGraphiste('arguments', `${MAX_REFS} images de référence au plus.`);
  const racine = vrai(atelier);
  const refsAbs = refs.map((r) => {
    const f = vrai(path.resolve(cwd, r));
    if (f !== racine && !dedans(racine, f)) throw new ErreurGraphiste('arguments', `--ref ${r} : seulement une image du dossier de travail.`);
    let st;
    try { st = fs.statSync(f); } catch { throw new ErreurGraphiste('arguments', `--ref ${r} : introuvable.`); }
    if (!st.isFile() || !/\.(png|jpe?g|webp)$/i.test(f)) throw new ErreurGraphiste('arguments', `--ref ${r} : une image PNG, JPEG ou WebP.`);
    if (st.size > 20 * 1024 * 1024) throw new ErreurGraphiste('arguments', `--ref ${r} : trop lourde (20 Mo au plus).`);
    return f;
  });
  const plusieurs = anime || nVariantes > 1;
  // où ranger : un fichier .png pour une image, un dossier pour plusieurs ; par défaut remotion/public/ia/<nom>
  let cible;
  if (sortie) {
    cible = path.resolve(cwd, sortie);
    if (!plusieurs && !/\.png$/i.test(cible)) cible = /\.\w{2,4}$/.test(cible) ? cible.replace(/\.\w{2,4}$/, '.png') : `${cible}.png`;
    if (plusieurs && /\.\w{2,4}$/.test(path.basename(cible))) cible = cible.replace(/\.\w{2,4}$/, '');
  } else {
    const base = path.join(atelier, DOSSIER_DESSINS, slug(description, 32) || 'dessin');
    cible = plusieurs ? base : `${base}.png`;
    for (let k = 2; fs.existsSync(cible) && k < 200; k++) cible = plusieurs ? `${base}-${k}` : `${base}-${k}.png`;
  }
  // réellement dans le dossier de travail (pas par un lien qui mène ailleurs)
  let parent = path.dirname(cible);
  while (!fs.existsSync(parent) && path.dirname(parent) !== parent) parent = path.dirname(parent);
  const reelParent = vrai(parent);
  const reelCible = path.join(reelParent, path.relative(parent, cible));
  if (!dedans(racine, reelCible)) throw new ErreurGraphiste('arguments', 'Les dessins restent dans le dossier de travail (par défaut remotion/public/ia/).');
  let lien = false;
  try { lien = fs.lstatSync(cible).isSymbolicLink(); } catch { /* n'existe pas encore */ }
  if (lien) throw new ErreurGraphiste('arguments', 'La sortie est un lien : choisis un autre nom.');
  if (plusieurs && fs.existsSync(cible) && fs.readdirSync(cible).length) throw new ErreurGraphiste('arguments', `${path.relative(atelier, cible)} existe déjà et n’est pas vide : choisis un autre nom (-o).`);
  const transparent = opaque ? false : transparentDit || anime;
  return {description, transparent, format: format ?? null, variantes: nVariantes, anime: anime ? {...grilleAnimation(images ?? 8), fps: nFps} : null, refs: refsAbs, sortie: cible};
}

/** Ce que Codex reçoit : faire ses appels à l'outil d'images, rien d'autre. */
export function consigneCodex(d) {
  const fond = d.transparent ? 'sur un fond entièrement transparent (transparent_background: true)' : 'sur un fond plein, sans transparence';
  const format = d.format ? `, au format ${FORMATS_IMAGE[d.format]}` : '';
  const quoi = d.anime
    ? `UN seul appel : une planche de sprites. Une seule image, une grille régulière et invisible de ${d.anime.colonnes} colonnes sur ${d.anime.lignes} ligne${d.anime.lignes > 1 ? 's' : ''}, des cases carrées de même taille : ${d.anime.images} images successives d'une animation qui boucle (de gauche à droite, puis ligne par ligne). Le même sujet dans chaque case, à la même taille et à la même place : seul le mouvement change, et rien ne dépasse de sa case. ${fond.charAt(0).toUpperCase()}${fond.slice(1)}. L'animation : ${d.description}`
    : d.variantes > 1
      ? `${d.variantes} appels, un par variante (lance-les en même temps) : ${d.variantes} propositions différentes de ${d.description}${format}, ${fond}.`
      : `UN seul appel : ${d.description}${format}, ${fond}.`;
  return `Tu es le graphiste d'une équipe de montage vidéo (Dérush). Avec ton outil de génération d'images (image_gen), fais ${quoi}
${d.refs.length ? `${d.refs.length > 1 ? `${d.refs.length} images de référence sont jointes` : 'Une image de référence est jointe'} à ce message : passe-${d.refs.length > 1 ? 'les' : 'la'} à ton outil (num_last_images_to_include: ${d.refs.length}) pour garder le même style, le même personnage ou les mêmes couleurs.\n` : ''}Règles : aucun texte dans l'image sauf s'il est demandé (alors en français, sans faute) ; ni logo, ni personnage, ni œuvre d'une vraie marque ou d'une personne réelle ; une image nette, lisible en petit sur un téléphone.
N'exécute aucune commande et n'écris aucun fichier : Dérush récupère tes images lui-même. Réponds seulement : fait.`;
}

/** Les arguments de `codex exec` pour le graphiste : lecture seule, réflexion courte, aucun connecteur, l'outil d'images ouvert. */
export function argsGraphiste(d, {modele = null, aCouper = null} = {}) {
  const coupes = (aCouper ?? connecteursCodex()).filter((n) => /^[A-Za-z0-9_-]+$/.test(n)).flatMap((n) => ['-c', `mcp_servers.${n}.enabled=false`]);
  // les références d'abord : « -i » prend plusieurs fichiers à la suite, il avalerait la consigne placée juste après lui
  return ['exec', ...d.refs.flatMap((f) => ['-i', f]), '--json', '--skip-git-repo-check', '-s', 'read-only', '--enable', 'image_generation', '-c', 'model_reasoning_effort="low"',
    ...(modele && /^[\w.:-]{2,60}$/.test(modele) ? ['-m', modele] : []), ...coupes, consigneCodex(d)];
}

const codexHome = () => process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
/** Le journal de la session `fil` de Codex ($CODEX_HOME/sessions/AAAA/MM/JJ/rollout-…-<fil>.jsonl), ou null. */
export function sessionDe(fil, {home = codexHome(), depuis = Date.now()} = {}) {
  if (!/^[\w-]{8,80}$/.test(String(fil ?? ''))) return null;
  for (const decalage of [0, -1, 1]) {
    const d = new Date(depuis + decalage * 86400e3);
    const dossier = path.join(home, 'sessions', String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0'));
    try {
      const n = fs.readdirSync(dossier).find((x) => x.includes(fil) && x.endsWith('.jsonl'));
      if (n) return path.join(dossier, n);
    } catch { /* pas de dossier ce jour-là */ }
  }
  return null;
}

const decoder = (r) => {
  if (typeof r !== 'string' || r.length < 100) return null;
  try {
    const b = Buffer.from(r.startsWith('data:') ? r.slice(r.indexOf(',') + 1) : r, 'base64');
    return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) || b.subarray(0, 3).toString() === 'GIF' || (b[0] === 0xff && b[1] === 0xd8) ? b : null;
  } catch { return null; }
};
/**
 * Les images d'une session de Codex, dans l'ordre : {data (Buffer) | chemin, prompt, transparent, echec}. L'outil
 * d'images range chaque résultat dans un « item » Extension (kind « image_gen.generation », result en base64) ; une
 * version qui l'écrit sur le disque donne son chemin (savedPath).
 */
export function imagesDeLaSession(fichier) {
  const r = [];
  let texte = '';
  try { texte = fs.readFileSync(fichier, 'utf8'); } catch { return r; }
  for (const l of texte.split('\n')) {
    if (!/image_gen|saved_?[pP]ath/.test(l)) continue;
    let j;
    try { j = JSON.parse(l); } catch { continue; }
    const p = j.payload ?? {};
    const it = p.item ?? {};
    if (p.type === 'item_completed' && it.type === 'Extension' && /^image_gen/.test(String(it.kind ?? ''))) {
      const chemin = it.savedPath ?? it.saved_path ?? null;
      r.push({id: it.id ?? null, statut: it.status ?? null, data: decoder(it.result), chemin: chemin && fs.existsSync(chemin) ? chemin : null,
        prompt: it.revisedPrompt ?? null, transparent: it.transparentBackground === true, echec: it.failure ? court(typeof it.failure === 'string' ? it.failure : JSON.stringify(it.failure)) : it.status === 'failed' ? 'échec' : null});
    }
  }
  return r;
}

/** Un script Python de Dérush pour les images (outils/graphiste.py), s'il peut tourner : son résultat JSON, sinon null. */
async function python(args) {
  if (!fs.existsSync(PYTHON)) return null;
  try {
    const {out} = await lancer(PYTHON, [path.join(RACINE_APP, 'outils', 'graphiste.py'), ...args], {dureeMax: 120000});
    return JSON.parse(out.toString().trim().split('\n').pop());
  } catch { return null; }
}
/** Largeur et hauteur d'un PNG (son en-tête). */
function tailleImage(f) {
  try {
    const b = Buffer.alloc(24);
    const fd = fs.openSync(f, 'r');
    fs.readSync(fd, b, 0, 24, 0);
    fs.closeSync(fd);
    return {largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20)};
  } catch { return {largeur: null, hauteur: null}; }
}

/** Range une image (une seule) : nettoyée si son fond est transparent, sinon telle quelle. */
async function rangerImage(brut, cible, transparent) {
  fs.mkdirSync(path.dirname(cible), {recursive: true});
  const r = transparent ? await python(['nettoyer', brut, cible]) : null;
  if (!r?.ok) fs.copyFileSync(brut, cible);
  return {chemin: cible, ...(r?.ok ? {largeur: r.largeur, hauteur: r.hauteur} : tailleImage(cible)), transparent: r?.ok ? r.transparent : transparent};
}

/**
 * Une planche de sprites découpée : les images f-01.png… (même taille, même cadre), la planche nettoyée et un GIF en
 * boucle. Sans Python, FFmpeg coupe les cases telles quelles.
 */
async function rangerAnimation(brut, dossier, d) {
  fs.mkdirSync(dossier, {recursive: true});
  const {images, colonnes, lignes, fps} = d.anime;
  let r = await python(['planche', brut, dossier, '--colonnes', String(colonnes), '--lignes', String(lignes), '--images', String(images), ...(d.transparent ? [] : ['--opaque'])]);
  if (!r?.ok) {
    const {largeur, hauteur} = tailleImage(brut);
    if (!largeur) throw new ErreurGraphiste('autre', 'La planche de ChatGPT est illisible.');
    const w = Math.floor(largeur / colonnes);
    const h = Math.floor(hauteur / lignes);
    for (let k = 0; k < images; k++) {
      const x = (k % colonnes) * w;
      const y = Math.floor(k / colonnes) * h;
      await ffmpeg(['-y', '-i', brut, '-vf', `crop=${w}:${h}:${x}:${y}`, '-frames:v', '1', path.join(dossier, `f-${String(k + 1).padStart(2, '0')}.png`)]);
    }
    fs.copyFileSync(brut, path.join(dossier, 'planche.png'));
    r = {ok: true, images, largeur: w, hauteur: h};
  }
  // le GIF en boucle : sa palette calculée sur toutes les images, la transparence gardée
  const gif = path.join(dossier, 'animation.gif');
  try {
    await ffmpeg(['-y', '-framerate', String(fps), '-i', path.join(dossier, 'f-%02d.png'), '-filter_complex',
      '[0:v]split[a][b];[a]palettegen=reserve_transparent=1:stats_mode=full[p];[b][p]paletteuse=alpha_threshold=128', '-loop', '0', gif]);
  } catch { /* les images suffisent */ }
  const fichiers = fs.readdirSync(dossier).filter((n) => /^f-\d+\.png$/.test(n)).sort();
  return {dossier, images: fichiers.length, largeur: r.largeur, hauteur: r.hauteur, fps, gif: fs.existsSync(gif) ? gif : null, planche: path.join(dossier, 'planche.png'), fichiers: fichiers.map((n) => path.join(dossier, n))};
}

/**
 * ChatGPT dessine (`d` : ce que lireArguments a rendu), par le Codex de la personne (`codex` : son chemin). Les images
 * sont rangées à leur place (d.sortie), nettoyées ou découpées. Renvoie {images: [{chemin, largeur, hauteur,
 * transparent}], animation | null, duree_s, modele}. Une erreur dit pourquoi en français (quota, refus, connexion).
 * `env` et `home` : l'environnement et le dossier du compte ChatGPT choisi (lib/comptes.mjs) ; sans eux, ceux du
 * processus (CODEX_HOME, sinon ~/.codex).
 */
export async function dessiner(d, {codex, modele = null, delai = DELAI, env = null, home = null} = {}) {
  const maison = home ?? env?.CODEX_HOME ?? codexHome();
  if (!codex) throw new ErreurGraphiste('codex', 'ChatGPT n’est pas branché : connecte Codex à ton compte ChatGPT dans Connexions.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-graphiste-'));
  const debut = Date.now();
  try {
    const {cmd, prefixe} = commandeLancement(codex);
    let fil = null;
    const erreurs = [];
    let tampon = '';
    const ligne = (l) => {
      let j;
      try { j = JSON.parse(l); } catch { return; }
      if (j.type === 'thread.started') fil = j.thread_id;
      if (j.type === 'turn.failed') erreurs.push(j.error?.message ?? 'Codex a échoué.');
      if (j.type === 'error' && !/reconnect|retry|stream/i.test(String(j.message ?? ''))) erreurs.push(String(j.message ?? ''));
    };
    try {
      // les connecteurs à couper : ceux du dossier de ce compte (un connecteur qu'il n'a pas : Codex refuserait de démarrer)
      await lancer(cmd, [...prefixe, ...argsGraphiste(d, {modele, aCouper: connecteursCodex(path.join(maison, 'config.toml'))})], {cwd: tmp, env: env ?? envIA([], false), dureeMax: delai,
        surStdout: (x) => { tampon += x.toString(); const L = tampon.split('\n'); tampon = L.pop(); for (const l of L) ligne(l); }});
      if (tampon.trim()) ligne(tampon);
    } catch (e) { erreurs.push(e.message); }
    const trouvees = fil ? imagesDeLaSession(sessionDe(fil, {home: maison, depuis: debut}) ?? '') : [];
    const bonnes = trouvees.filter((x) => x.data || x.chemin);
    if (!bonnes.length) {
      const dit = [...erreurs, ...trouvees.map((x) => x.echec).filter(Boolean)].join(' · ');
      if (QUOTA_ATTEINT.test(dit) || /usage.?limit|UsageLimitExceeded|rate.?limit/i.test(dit)) {
        noterQuotaAtteint('codex', {compte: compteDeDossier('codex', maison)});
        throw new ErreurGraphiste('quota', 'Le quota de ChatGPT est atteint : il ne peut plus dessiner pour le moment. Dessine autrement (SVG, formes du kit, HyperFrames).');
      }
      if (/content.?policy|safety|moderat|policy_violation/i.test(dit)) throw new ErreurGraphiste('refus', 'ChatGPT a refusé de dessiner ça (ses règles) : change la description.');
      if (/not logged in|login|unauthori[sz]ed|401/i.test(dit)) throw new ErreurGraphiste('codex', 'Codex n’est plus connecté à ton compte ChatGPT : Connexions › Codex › Me connecter.');
      throw new ErreurGraphiste('autre', `ChatGPT n’a rendu aucune image${dit ? ` : ${court(dit)}` : '.'}`);
    }
    // les images brutes, puis rangées à leur place
    const bruts = bonnes.map((x, k) => {
      const f = path.join(tmp, `brut-${k + 1}.png`);
      if (x.data) fs.writeFileSync(f, x.data); else fs.copyFileSync(x.chemin, f);
      return f;
    });
    let images = [];
    let animation = null;
    if (d.anime) {
      animation = await rangerAnimation(bruts[0], d.sortie, d);
      images = animation.fichiers.map((chemin) => ({chemin, largeur: animation.largeur, hauteur: animation.hauteur, transparent: d.transparent}));
    } else if (bruts.length === 1 && d.variantes === 1) {
      images = [await rangerImage(bruts[0], d.sortie, d.transparent)];
    } else {
      fs.mkdirSync(d.sortie, {recursive: true});
      for (const [k, b] of bruts.entries()) images.push(await rangerImage(b, path.join(d.sortie, `variante-${k + 1}.png`), d.transparent));
    }
    return {images, animation, duree_s: Math.round((Date.now() - debut) / 1000), modele: modele ?? null, prompts: bonnes.map((x) => x.prompt).filter(Boolean)};
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}

/** Ce que la commande dit au monteur : où sont les images, leur taille, et comment s'en servir. */
export function compteRendu(r, atelier) {
  const rel = (f) => path.relative(atelier, f).split(path.sep).join('/');
  const statique = (f) => { const x = rel(f); return x.startsWith('remotion/public/') ? ` · staticFile("${x.slice('remotion/public/'.length)}")` : ''; };
  const t = (x) => (x.largeur ? `${x.largeur} × ${x.hauteur}` : '');
  if (r.animation) {
    const a = r.animation;
    const dossier = rel(a.dossier);
    const pub = dossier.startsWith('remotion/public/') ? dossier.slice('remotion/public/'.length) : null;
    return [`ChatGPT a dessiné une planche de ${a.images} images en ${r.duree_s} s ; Dérush l’a découpée :`,
      `  ${dossier}/f-01.png … f-${String(a.images).padStart(2, '0')}.png — ${a.largeur} × ${a.hauteur}${r.images[0]?.transparent ? ', fond transparent' : ''}, au même cadre`,
      ...(a.gif ? [`  ${rel(a.gif)} — en boucle, ${a.fps} images par seconde`] : []),
      `  ${rel(a.planche)} — la planche d’origine${r.images[0]?.transparent ? ', nettoyée' : ''}`,
      ...(pub ? [`Dans Remotion : <Img src={staticFile(\`${pub}/f-\${String((Math.floor(frame * ${a.fps} / fps) % ${a.images}) + 1).padStart(2, '0')}.png\`)} />`] : []),
      'Regarde la planche avant de t’en servir : si une image cloche, retire-la ou redemande.'].join('\n');
  }
  return [`ChatGPT a dessiné ${r.images.length > 1 ? `${r.images.length} images` : 'une image'} en ${r.duree_s} s :`,
    ...r.images.map((x) => `  ${rel(x.chemin)} — ${t(x)}${x.transparent ? ', fond transparent, recadrée au sujet' : ''}${statique(x.chemin)}`),
    `Regarde-l${r.images.length > 1 ? 'es' : 'a'} avant de t’en servir.`].join('\n');
}

/** Note un dessin dans le journal du dossier de travail (ce que Dérush montre en direct et compte à la fin). */
export function noterDessin(atelier, d, r) {
  try {
    fs.mkdirSync(path.dirname(JOURNAL(atelier)), {recursive: true});
    fs.appendFileSync(JOURNAL(atelier), `${JSON.stringify({t: new Date().toISOString(), description: court(d.description, 200), anime: !!d.anime,
      fichiers: (r.animation ? [r.animation.gif ?? r.animation.planche] : r.images.map((x) => x.chemin)).filter(Boolean).map((f) => path.relative(atelier, f)),
      images: r.images.length, duree_s: r.duree_s})}\n`);
  } catch { /* le dessin reste rangé, sans journal */ }
}
/** Les dessins notés depuis `depuis` (ms) : [{t, description, anime, fichiers (absolus), images}]. */
export function dessinsDepuis(atelier, depuis = 0) {
  let texte = '';
  try { texte = fs.readFileSync(JOURNAL(atelier), 'utf8'); } catch { return []; }
  return texte.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((x) => x && Date.parse(x.t) >= depuis - 1000).map((x) => ({...x, fichiers: (x.fichiers ?? []).map((f) => path.join(atelier, f))}));
}

/** La consigne du graphiste, pour le monteur (Mode Hollywood, ChatGPT prêt). */
export const consigneGraphiste = (moteur) => `- Le graphiste de l'équipe : ChatGPT (son outil d'images, avec le forfait de la personne). Quand le montage gagnerait à avoir une image qui n'existe pas dans les rushes (un autocollant ou un émoji maison, une illustration, un objet, un fond, un personnage, une icône dessinée, une planche de sprites pour une petite animation), demande-la : « derush-image "ce qu'il faut dessiner" --transparent » (aide : derush-image --help ; --anime --images 8 pour une animation en boucle, découpée en images et en GIF ; --ref <image> pour garder un style ou un personnage). Une image prend environ 30 s à 1 min : demande seulement ce qui sert vraiment la vidéo, d'une description précise (sujet, style, couleurs de la marque, cadrage). Les images arrivent dans remotion/public/ia/ (staticFile("ia/…")) ; regarde-les avant de t'en servir. Jamais de logo ni de personnage d'une vraie marque, d'une œuvre ou d'une personne réelle.${moteur === 'codex' ? " N'utilise pas ton propre outil d'images : passe par derush-image, qui range et nettoie les images dans le dossier." : ''}`;
