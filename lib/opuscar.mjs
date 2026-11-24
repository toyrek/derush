// Dérush — « Films en 99 styles » : les fiches de style de Lemo-Opuscar, téléchargées chez la personne, à sa demande.
//
// Lemo-Opuscar (Lemomo / LemoLab, https://github.com/lemomo-ai/lemo-opuscar) décrit 99 styles de film à faire en code :
// une fiche STYLE.md par style (la matière, la couleur, le mouvement, la caméra, le son, les pièges). Son code est sous
// licence MIT, mais ses fiches sont sous CC BY-NC 4.0, avec une permission en plus : chacun peut s'en servir pour faire
// ses propres films, même commerciaux, mais pas les redonner ni les mettre dans un produit. Dérush ne les livre donc
// pas : sur un clic, il les prend à la source, sur l'ordinateur de la personne, comme il le fait pour le guide Remotion.
//
// Ce que Dérush garantit :
// - une version précise, relue : lib/opuscar.json donne, pour chaque fiche, sa taille et son empreinte au commit relu le
//   24 novembre 2026 (les 99 fiches ont passé l'examen des compétences ajoutées : rien qui se lance, pas de texte caché).
//   Un fichier qui ne correspond pas est refusé, et rien n'est gardé ;
// - rien d'autre n'est pris : ni leur code, ni leurs films de démonstration, ni leurs images, ni leur outil ;
// - les noms et les phrases en français, l'index (SKILL.md) et le catalogue sont écrits par Dérush (lib/opuscar.json).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DOSSIER_TELECHARGE, oublierCompetences, lireCorpsBorne} from './competences.mjs';

/** La table : le dépôt, le commit relu, les fichiers de licence, les 15 familles et les 99 styles (taille, empreinte, nom, phrase). */
export const OPUSCAR = JSON.parse(fs.readFileSync(new URL('./opuscar.json', import.meta.url), 'utf8'));
export const NOM_OPUSCAR = 'lemo-opuscar';
export const DOSSIER_OPUSCAR = path.join(DOSSIER_TELECHARGE, NOM_OPUSCAR);
const MARQUE = '.derush-opuscar.json';
const fichiersDe = (m) => [...Object.entries(m.fichiers).map(([chemin, [octets, sha256]]) => ({chemin, octets, sha256})), ...m.styles.map((s) => ({chemin: `styles/${s.slug}/STYLE.md`, octets: s.octets, sha256: s.sha256}))];
/** Ce qu'il y a à télécharger, en octets. */
export const tailleOpuscar = (m = OPUSCAR) => fichiersDe(m).reduce((n, f) => n + f.octets, 0);
const adresseDe = (m) => `https://raw.githubusercontent.com/${m.depot}/${m.commit}`;

/** Les fiches sont-elles là, et à la version que cette version de Dérush a relue ? */
export function etatOpuscar(dossier = DOSSIER_OPUSCAR, manifeste = OPUSCAR) {
  let marque = null;
  try { marque = JSON.parse(fs.readFileSync(path.join(dossier, MARQUE), 'utf8')); } catch { /* pas téléchargées */ }
  const present = !!marque && fs.existsSync(path.join(dossier, 'SKILL.md')) && fs.existsSync(path.join(dossier, 'catalogue.json'));
  return {present, styles: present ? marque.styles : 0, a_jour: present && marque.commit === manifeste.commit, date: present ? marque.date : null, commit: present ? marque.commit : null, dossier,
    a_telecharger: {octets: tailleOpuscar(manifeste), fichiers: fichiersDe(manifeste).length, styles: manifeste.styles.length, source: `https://github.com/${manifeste.depot}`, familles: manifeste.categories.map((c) => c.nom)}};
}

/** Le catalogue au format des collections de styles de Dérush (lib/styles.mjs). */
export function catalogueOpuscar(m = OPUSCAR) {
  return {
    categories: m.categories.map(({id, nom, aide}) => ({id, nom, aide})),
    styles: m.styles.map((s) => ({id: `opuscar-${s.slug}`, nom: s.nom, categorie: s.categorie, description: s.description, nom_origine: s.nom_origine, fichier: `styles/${s.slug}/STYLE.md`})),
  };
}

/** L'index que l'IA lit : ce que sont ces fiches, comment s'en servir avec les outils de Dérush, le crédit, la liste. */
export function skillOpuscar(m = OPUSCAR, date = new Date().toISOString().slice(0, 10)) {
  const liste = m.categories.map((c) => `### ${c.nom}\n\n${c.aide}\n\n${m.styles.filter((s) => s.categorie === c.id).map((s) => `- **${s.nom}** (${s.nom_origine}) : \`styles/${s.slug}/STYLE.md\`. ${s.description}`).join('\n')}`).join('\n\n');
  return `---
name: ${NOM_OPUSCAR}
description: >-
  ${m.styles.length} styles de film à faire en code, décrits par Lemo-Opuscar : infos sous-titrées, aquarelle, tableau blanc, ombres
  chinoises, risographie, plan d'ingénieur, jeu de rôle 16 bits, néons, image satellite annotée, plan de métro. Chaque
  fiche dit la matière, les couleurs, le mouvement, la caméra, le son et les pièges du style. À ouvrir quand la demande
  dit « Style : … » avec un de ces styles.
---

# Films en ${m.styles.length} styles (Lemo-Opuscar), dans Dérush

**Dans Dérush.** Ces fiches sont celles de Lemo-Opuscar (Lemomo / LemoLab). Elles ont été téléchargées sur cet ordinateur le ${date}, depuis son dépôt, à la version que Dérush a relue (voir SOURCE.md). Elles sont en anglais et n'ont pas été modifiées. Leur licence (CC BY-NC 4.0, avec une permission en plus) laisse s'en servir pour faire ses propres films, même commerciaux ; elle ne laisse pas les redonner à d'autres ni les vendre. C'est pour ça que Dérush ne les livre pas : chacun les prend à la source.

## Comment t'en servir

1. Lis en entier la fiche du style choisi : \`styles/<nom>/STYLE.md\`. Elle décrit une manière (la matière, la couleur, le texte, le mouvement, la caméra, le son, les gestes propres au style, ses pièges, des variantes), pas une histoire : l'histoire est celle de la personne.
2. Fabrique le film avec les outils de Dérush. Leur outil n'est pas là : leur page expose \`window.render(t)\`, \`window.DUR\` et \`window.READY\` ; la tienne, pour \`derush-toile\`, expose \`window.renderAt(t)\`, \`window.toile = {duree, fps, largeur, hauteur}\` et \`window.__ready\` (compétence \`tableaux-en-mouvement\` : la méthode, les pages de départ, la vérification). Pour un style de la famille « Montage et documentaire », la matière est celle de la personne (ses rushes, ses pièces jointes), montée avec le kit \`remotion/\`.
3. La partie « Engine » d'une fiche nomme les fichiers de leur film de démonstration (\`demo/…\`) : ils ne sont pas téléchargés. Écris ton propre moteur d'après ce que la fiche décrit.
4. Leurs commandes (\`setup.sh\`, \`tools/fetch.sh\`, \`core/…\`) n'existent pas ici. Si une fiche demande un paquet, un modèle, des données (images satellite, relevés au laser, archives) ou des instruments à télécharger : n'installe et ne télécharge rien de toi-même. Dis à la personne ce qu'il faudrait, et ce que tu fais à la place.
5. La musique et le son : \`derush-musique\`, \`derush-son\`, les vrais sons de la personne (voir la boîte à outils).
6. Les « References » d'une fiche sont une grammaire, jamais une œuvre à recopier : aucun personnage, logo, plan, musique ou police d'une œuvre citée. La fiche le dit elle-même ; tiens-toi à cette règle.
7. Vérifie comme pour toute toile : \`derush-toile verifier\`, des images avant de rendre, puis \`derush-toile mouvement\` et \`derush-controle\`.

## Crédit

Lemo-Opuscar by Lemomo (LemoLab), https://github.com/${m.depot} : fiches sous licence CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/), non modifiées. « Memphis Diorama » est de EianLu et « Crayon World 3D » de 2nd1st, dans Lemo-Opuscar. Un film fait avec ces fiches est à la personne et ne demande aucun crédit. Les textes de licence sont dans \`LICENSE\` et \`LICENSES/\`. Les noms et les phrases en français de cette page sont de Dérush.

## Les ${m.styles.length} styles

${liste}
`;
}

const sourceMd = (m, date) => `# Provenance

- Source : Lemo-Opuscar, de Lemomo (LemoLab), https://github.com/${m.depot}, commit \`${m.commit}\`.
- Téléchargé le ${date} sur cet ordinateur, à la demande de la personne (bouton « Styles » de Dérush).
- Pris : les ${m.styles.length} fiches \`styles/<nom>/STYLE.md\` et les textes de licence (\`LICENSE\`, \`LICENSES/CC-BY-NC-4.0.txt\`). Chaque fichier a la taille et l'empreinte SHA-256 de la version relue par Dérush le ${m.relu_le} : un fichier différent aurait été refusé.
- Pas pris : leur code (\`core/\`, \`tools/\`), leurs films de démonstration et leurs sources (\`styles/<nom>/demo/\`, \`DEMO.md\`), leurs images, leurs guides (\`DIRECTOR.md\`, \`TECHNIQUE.md\`), leur outil.
- Licence des fiches : CC BY-NC 4.0, avec la permission de s'en servir pour ses propres films (voir \`LICENSE\`, « ADDITIONAL PERMISSION FOR THE DOCS »). Dérush ne les redistribue pas.
- Écrits par Dérush : \`SKILL.md\` (l'index et le mode d'emploi) et \`catalogue.json\` (les noms et les phrases en français).
`;

/**
 * Télécharge les fiches chez la personne. Chaque fichier doit avoir la taille et l'empreinte de la table : au premier
 * qui diffère, tout s'arrête et rien n'est gardé. `source` et `manifeste` ne servent qu'aux essais.
 */
export async function telechargerOpuscar({source = null, manifeste = OPUSCAR, dossier = DOSSIER_OPUSCAR, prog = () => {}, ensemble = 6} = {}) {
  const base = (source ?? adresseDe(manifeste)).replace(/\/+$/, '');
  const fichiers = fichiersDe(manifeste);
  for (const f of fichiers) if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(f.chemin) || f.chemin.includes('..')) throw new Error(`Chemin refusé dans la table : ${f.chemin}`);
  const parent = path.dirname(dossier);
  const neuf = path.join(parent, `.${path.basename(dossier)}-neuf`); // caché : jamais pris pour une compétence
  fs.rmSync(neuf, {recursive: true, force: true});
  fs.mkdirSync(neuf, {recursive: true});
  let faits = 0;
  const prendre = async (f) => {
    let r;
    try { r = await fetch(`${base}/${f.chemin}`, {redirect: 'follow', signal: AbortSignal.timeout(45000)}); }
    catch { throw new Error('Le dépôt de Lemo-Opuscar est injoignable : vérifie ta connexion à internet, puis réessaie.'); }
    if (!r.ok) throw new Error(`Le dépôt de Lemo-Opuscar ne donne pas ${f.chemin} (${r.status}).`);
    let b;
    try { b = await lireCorpsBorne(r, f.octets + 1); } catch { b = null; }
    if (!b || b.length !== f.octets || crypto.createHash('sha256').update(b).digest('hex') !== f.sha256) throw new Error(`${f.chemin} n’est pas le fichier que Dérush a relu (il a changé à la source ou en route) : rien n’est gardé.`);
    const cible = path.join(neuf, f.chemin);
    fs.mkdirSync(path.dirname(cible), {recursive: true});
    fs.writeFileSync(cible, b);
    prog(++faits / fichiers.length);
  };
  try {
    const file = [...fichiers];
    const ouvriers = Array.from({length: Math.max(1, Math.min(ensemble, 8))}, async () => { while (file.length) await prendre(file.shift()); });
    await Promise.all(ouvriers);
    const date = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(path.join(neuf, 'SKILL.md'), skillOpuscar(manifeste, date));
    fs.writeFileSync(path.join(neuf, 'SOURCE.md'), sourceMd(manifeste, date));
    fs.writeFileSync(path.join(neuf, 'catalogue.json'), `${JSON.stringify(catalogueOpuscar(manifeste), null, 1)}\n`);
    fs.writeFileSync(path.join(neuf, MARQUE), `${JSON.stringify({commit: manifeste.commit, styles: manifeste.styles.length, date})}\n`);
    fs.rmSync(dossier, {recursive: true, force: true});
    fs.renameSync(neuf, dossier);
  } catch (e) {
    fs.rmSync(neuf, {recursive: true, force: true});
    throw e;
  }
  oublierCompetences();
  return etatOpuscar(dossier, manifeste);
}

/** Retire les fiches de l'ordinateur. */
export function retirerOpuscar(dossier = DOSSIER_OPUSCAR) {
  fs.rmSync(dossier, {recursive: true, force: true});
  oublierCompetences();
  return etatOpuscar(dossier);
}
