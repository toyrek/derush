// Dérush — la bibliothèque de compétences (« skills ») que l'IA lit directement.
// - competences/ (livrée avec l'app) : réseaux sociaux, ElevenLabs, FFmpeg, étalonnage, sous-titres, contrôle qualité,
//   miniatures, mixage, motion design, Blender, ImageMagick, passage vers Premiere / Resolve, publication avec Treg,
//   sons libres (sons-openverse) ;
// - les compétences Remotion, téléchargées chez l'utilisateur à l'installation (leur dépôt n'a pas de licence de
//   redistribution), dans le dossier de Dérush ; Real SFX et le guide d'Earshot aussi (voir sons.mjs).
// À chaque demande, elles sont reliées dans le dossier de travail : .claude/skills/ (Claude) et .agents/skills/ (Codex).
// Les compétences qui sont des programmes Python reçoivent une commande toute prête (color-grading, qc…), sans pip install.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RACINE_APP, DOSSIER_SUPPORT, PYTHON} from './moteurs.mjs';
import {WINDOWS, lier, delier, trouver} from './plateforme.mjs';
import {lancer} from './outils.mjs';

export const DOSSIER_LIVRE = path.join(RACINE_APP, 'competences');
export const DOSSIER_TELECHARGE = path.join(DOSSIER_SUPPORT, 'competences');
export const DOSSIER_COMMANDES = path.join(DOSSIER_SUPPORT, 'bin');
const DEPOT_REMOTION = 'https://codeload.github.com/remotion-dev/skills/tar.gz/HEAD';

const lireSkill = (dossier) => {
  try {
    const t = fs.readFileSync(path.join(dossier, 'SKILL.md'), 'utf8');
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(t)?.[1] ?? '';
    const nom = /^name:\s*["']?([\w.-]+)/m.exec(fm)?.[1] ?? path.basename(dossier);
    const description = (/^description:\s*(.+)$/m.exec(fm)?.[1] ?? '').replace(/^['"]|['"]$/g, '').trim();
    return {nom, description, dossier};
  } catch { return null; }
};
/** Les compétences d'un dossier : chaque sous-dossier qui a un SKILL.md (et ceux d'un niveau plus bas, pour Remotion). */
function dansDossier(racine, source) {
  const r = [];
  let noms = [];
  try { noms = fs.readdirSync(racine); } catch { return r; }
  for (const n of noms) {
    const d = path.join(racine, n);
    const s = lireSkill(d);
    if (s) r.push({...s, source});
    else { try { for (const m of fs.readdirSync(d)) { const t = lireSkill(path.join(d, m)); if (t) r.push({...t, source}); } } catch { /* pas un dossier */ } }
  }
  return r;
}
let memo = {t: 0, v: null};
/** Toutes les compétences disponibles (livrées + téléchargées), sans doublon de nom. */
export function listerCompetences() {
  if (memo.v && Date.now() - memo.t < 30000) return memo.v;
  const vus = new Map();
  for (const s of [...dansDossier(DOSSIER_LIVRE, 'derush'), ...dansDossier(DOSSIER_TELECHARGE, 'telechargee')]) if (!vus.has(s.nom)) vus.set(s.nom, s);
  memo = {t: Date.now(), v: [...vus.values()].sort((a, b) => a.nom.localeCompare(b.nom))};
  return memo.v;
}
export const competencesPresentes = () => new Set(listerCompetences().map((s) => s.nom));
export const remotionPresent = () => competencesPresentes().has('remotion-best-practices');
/** À appeler quand une compétence vient d'être téléchargée ou retirée. */
export const oublierCompetences = () => { memo.t = 0; };

/** Relie toutes les compétences dans le dossier de travail de l'IA (rien n'est copié). */
export function installerCompetences(atelier) {
  const liste = listerCompetences();
  for (const base of [path.join(atelier, '.claude', 'skills'), path.join(atelier, '.agents', 'skills')]) {
    fs.mkdirSync(base, {recursive: true});
    // on refait les liens à chaque fois (l'app a pu être mise à jour) ; un vrai dossier posé là par l'IA reste
    for (const n of fs.readdirSync(base)) { const c = path.join(base, n); try { if (fs.lstatSync(c).isSymbolicLink()) delier(c); } catch { /* déjà parti */ } }
    for (const s of liste) {
      const lien = path.join(base, s.nom);
      if (fs.existsSync(lien)) continue;
      if (!lier(s.dossier, lien)) { try { fs.cpSync(s.dossier, lien, {recursive: true}); } catch { /* tant pis pour celle-ci */ } }
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
  if (!py) return DOSSIER_COMMANDES;
  const ecrire = (nom, contenuSh, contenuCmd) => {
    try {
      if (WINDOWS) fs.writeFileSync(path.join(DOSSIER_COMMANDES, `${nom}.cmd`), contenuCmd.replace(/\n/g, '\r\n'));
      else { const f = path.join(DOSSIER_COMMANDES, nom); fs.writeFileSync(f, contenuSh); fs.chmodSync(f, 0o755); }
    } catch { /* dossier en lecture seule */ }
  };
  // python3 mène au Python de Dérush (sous Windows, « python3 » n'existe pas ; sur un Mac neuf, c'est un leurre qui
  // demande d'installer les outils de développement)
  if (fs.existsSync(PYTHON)) {
    // « python » aussi, partout : des compétences (Real SFX…) l'appellent ainsi
    for (const nom of ['python3', 'python']) ecrire(nom, `#!/bin/sh\nexec "${PYTHON}" "$@"\n`, `@echo off\n"${PYTHON}" %*\n`);
  }
  for (const s of listerCompetences()) {
    const src = path.join(s.dossier, 'src');
    if (!fs.existsSync(src)) continue;
    for (const x of scriptsPython(s.dossier)) {
      // le chemin passe par une variable d'environnement : aucun guillemet à échapper dans le code Python
      const code = `import os, sys; sys.path.insert(0, os.environ['DERUSH_SRC']); from ${x.module} import ${x.fonction} as m; sys.argv[0] = '${x.nom}'; sys.exit(m())`;
      ecrire(x.nom, `#!/bin/sh\nDERUSH_SRC='${src.replace(/'/g, `'\\''`)}'\nexport DERUSH_SRC\nexec "${py}" -c "${code}" "$@"\n`, `@echo off\nset "DERUSH_SRC=${src}"\n"${py}" -c "${code}" %*\n`);
    }
  }
  return DOSSIER_COMMANDES;
}

/** Télécharge les compétences Remotion depuis leur dépôt officiel (à l'installation, ou plus tard depuis les Réglages). */
export async function telechargerRemotion() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-remotion-'));
  const archive = path.join(tmp, 'skills.tar.gz');
  const r = await fetch(DEPOT_REMOTION, {redirect: 'follow'});
  if (!r.ok) throw new Error(`Le dépôt des compétences Remotion ne répond pas (${r.status}).`);
  fs.writeFileSync(archive, Buffer.from(await r.arrayBuffer()));
  const sortie = path.join(tmp, 'x');
  fs.mkdirSync(sortie);
  await lancer('tar', ['-xzf', archive, '-C', sortie]);
  const racine = path.join(sortie, fs.readdirSync(sortie)[0]);
  // le dépôt range ses compétences dans skills/ (ou à la racine)
  const dossier = fs.existsSync(path.join(racine, 'skills')) ? path.join(racine, 'skills') : racine;
  const trouvees = dansDossier(dossier, 'telechargee');
  if (!trouvees.length) throw new Error('Aucune compétence trouvée dans le dépôt Remotion.');
  const cible = path.join(DOSSIER_TELECHARGE, 'remotion');
  fs.rmSync(cible, {recursive: true, force: true});
  fs.mkdirSync(DOSSIER_TELECHARGE, {recursive: true});
  fs.cpSync(dossier, cible, {recursive: true});
  fs.writeFileSync(path.join(cible, 'SOURCE.md'), `# Provenance\n\n- Source : https://github.com/remotion-dev/skills, téléchargée le ${new Date().toISOString().slice(0, 10)} sur cet ordinateur.\n- Pas de licence de redistribution : Dérush ne la livre pas, il la télécharge chez toi depuis le dépôt officiel.\n`);
  fs.rmSync(tmp, {recursive: true, force: true});
  memo.t = 0;
  return trouvees.length;
}
