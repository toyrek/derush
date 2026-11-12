// Dérush — les essais du rôle deviné d'une pièce jointe (pour qui modifie Dérush). Aucun fichier n'est lu.
//   node outils/essai-pieces.mjs
// Les cas viennent d'un vrai dossier de travail (un teaser : logos retenus, explorations, textes, références).
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.DERUSH_SUPPORT ??= path.join(os.tmpdir(), 'derush-essai-pieces');
const {roleProbable, typeDe} = await import(`${D}/lib/pieces.mjs`);
const CAS = [
  ['02_Logos_retenus/MJC_Persan_retenu.png', 'logo', 'une image rangée dans un dossier de logos'],
  ['03_Explorations/E01_Logo_MJC_retro_de_YABAI.png', 'logo', 'une image dont le nom dit « logo »'],
  ['03_Explorations/E11_Embleme_MJC_retro_franco_japonais.png', 'logo', 'un emblème'],
  ['05_References/REF_Ancien_logo_MJC_Persan.jpg', 'reference', 'une référence qui montre un logo'],
  ['05_References/REF_Logo_YABAI_original.png', 'reference', 'une référence, par son nom et son dossier'],
  ['Bureau/REF_Sentai.jpg', 'reference', 'une référence, par son nom seul'],
  ['moodboard/planche-logos.png', 'reference', 'une image d’un dossier de moodboard'],
  ['Projet/INVENTAIRE_LOGOS.md', 'script', 'un texte qui parle de logos n’est pas un logo'],
  ['04_Teaser/BRIEF_TEASER_MJC.md', 'script', 'un brief'],
  ['01_Concept/CONCEPT_POLE_MJC.md', 'script', 'un concept'],
  ['Projet/00_LIRE_D_ABORD.md', 'script', 'une note « à lire d’abord »'],
  ['Projet/MANIFEST_ASSETS.json', 'reference', 'un fichier de données sans indice'],
  ['Marque/Charte graphique YABAI.pdf', 'charte', 'une charte'],
  ['Marque/Anton-Regular.ttf', 'police', 'une police'],
  ['Sons/impact.wav', 'musique', 'un son'],
  ['Rushes/plan-large.mp4', 'reference', 'une vidéo sans indice'],
  ['Logos/logo-yabai.svg', 'logo', 'un logo vectoriel'],
];
let bons = 0;
for (const [chemin, voulu, quoi] of CAS) {
  const nom = path.basename(chemin);
  const r = roleProbable(nom, typeDe(nom), path.basename(path.dirname(chemin)));
  console.log(`${r === voulu ? '✓' : '✗'} ${quoi} : ${chemin} → ${r}${r === voulu ? '' : ` (attendu : ${voulu})`}`);
  if (r === voulu) bons++;
}
console.log(`\n${bons} essais réussis sur ${CAS.length}`);
process.exit(bons === CAS.length ? 0 : 1);
