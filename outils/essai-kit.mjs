#!/usr/bin/env node
// Dérush — les essais de la 11.1 : le kit média d'un espace (lib/kit.mjs), la bibliothèque d'animations
// (lib/animations.mjs), l'échelle exacte d'« Exporter » (lib/exporter.mjs) et le rôle « voix » d'une pièce jointe.
//   node outils/essai-kit.mjs [dossier où créer le dossier d'essai]
// Aucun réseau, aucune IA : un dossier de Dérush jetable (DERUSH_SUPPORT). Rien n'est lu ni écrit dans la vraie
// installation. Le dossier d'essai est effacé à la fin, sauf en cas d'échec.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('node outils/essai-kit.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const ICI = path.dirname(fileURLToPath(import.meta.url));
const D = path.join(ICI, '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
fs.mkdirSync(base, {recursive: true});
const tmp = fs.mkdtempSync(path.join(base, 'derush-essai-kit-'));
process.env.DERUSH_SUPPORT = path.join(tmp, 'support');
fs.mkdirSync(process.env.DERUSH_SUPPORT, {recursive: true});
const imp = (f) => import(pathToFileURL(path.join(D, 'lib', f)).href);
const K = await imp('kit.mjs');
const A = await imp('animations.mjs');
const {echelleExacte} = await imp('exporter.mjs');
const {roleProbable, typeDe} = await imp('pieces.mjs');
const {trouverEspace} = await imp('espaces.mjs');

let ok = 0;
let ko = 0;
const essai = (nom, cond, detail = '') => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`); } };
const lance = async (nom, f) => { try { return await f(); } catch (e) { essai(nom, false, e.message); return null; } };

console.log('Le kit média d’un espace');
const src = path.join(tmp, 'sources');
fs.mkdirSync(path.join(src, 'dossier', 'sous'), {recursive: true});
// une vraie petite image PNG (1 × 1), une police, un document
fs.writeFileSync(path.join(src, 'logo rouge.png'), Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cf0000000301010018dd8db40000000049454e44ae426082', 'hex'));
fs.writeFileSync(path.join(src, 'Jost-Black.ttf'), 'police');
fs.writeFileSync(path.join(src, 'dossier', 'charte.pdf'), '%PDF-1.4');
fs.writeFileSync(path.join(src, 'dossier', 'sous', 'fond.jpg'), 'jpg');
essai('un espace sans kit : 0 fichier', K.lireKit('moi').nb === 0);
const aj = await lance('ajouter au kit', () => K.ajouterAuKit('moi', [path.join(src, 'logo rouge.png'), path.join(src, 'Jost-Black.ttf'), path.join(src, 'dossier')]));
essai('ajouter : des fichiers et le contenu d’un dossier', aj?.ajoutes.length === 4, JSON.stringify(aj?.ajoutes));
essai('ajouter : rangés par genre dans ajouts/', aj?.ajoutes.includes('ajouts/images/logo rouge.png') && aj.ajoutes.includes('ajouts/polices/Jost-Black.ttf') && aj.ajoutes.some((f) => f.startsWith('ajouts/documents/dossier/')));
essai('ajouter : l’original ne bouge pas', fs.existsSync(path.join(src, 'logo rouge.png')));
const aj2 = await lance('ajouter deux fois', () => K.ajouterAuKit('moi', [path.join(src, 'logo rouge.png')]));
essai('ajouter deux fois le même nom : pas d’écrasement (-2)', aj2?.ajoutes[0] === 'ajouts/images/logo rouge-2.png');
const kit = K.lireKit('moi');
essai('lire : 5 fichiers, décrits dans « Ajoutés depuis Dérush »', kit.nb === 5 && kit.groupes.length === 1 && kit.groupes[0].id === 'ajouts', `${kit.nb} ${kit.groupes.map((g) => g.id)}`);
K.decrireDansKit('moi', 'ajouts/images/logo rouge.png', {titre: 'Logo principal', texte: 'Le logo rouge.', usage: 'le carton de fin'});
const md = fs.readFileSync(path.join(K.dossierKit('moi'), 'KIT.md'), 'utf8');
essai('décrire : KIT.md dit le titre, le texte et l’usage', /\*\*Logo principal\*\* — `ajouts\/images\/logo rouge\.png` — Le logo rouge\. Pour : le carton de fin/.test(md), md.slice(0, 300));
let refuse = false;
try { K.decrireDansKit('moi', '../espaces.json', {titre: 'x'}); } catch { refuse = true; }
essai('un chemin qui sort du kit est refusé', refuse);
let cache = false;
try { K.decrireDansKit('moi', '.apercus/x.png', {titre: 'x'}); } catch { cache = true; }
essai('un fichier caché du kit est refusé', cache);
fs.writeFileSync(path.join(K.dossierKit('moi'), 'pose-a-la-main.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
const k2 = K.lireKit('moi');
essai('un fichier posé à la main est listé « sans description »', k2.groupes.some((g) => g.id === 'sans-description' && g.elements.some((e) => e.fichier === 'pose-a-la-main.svg')));
const ap = await K.apercuKit('moi', 'pose-a-la-main.svg');
essai('aperçu : un SVG se montre tel quel', ap?.type === 'image/svg+xml');

console.log('Le kit dans le dossier de travail de l’IA');
const atelier = path.join(tmp, 'atelier');
fs.mkdirSync(path.join(atelier, 'contexte', 'espace'), {recursive: true});
fs.writeFileSync(path.join(atelier, 'contexte', 'espace', 'ESPACE.md'), '# Pour qui : la personne elle-même\n');
const moi = trouverEspace('moi');
const pose = await K.installerKit(atelier, moi);
const D2 = path.join(atelier, 'contexte', 'espace', 'kit');
essai('posé : les fichiers et KIT.md', pose?.nb === 6 && fs.existsSync(path.join(D2, 'KIT.md')) && fs.existsSync(path.join(D2, 'ajouts', 'images', 'logo rouge.png')));
essai('posé : ESPACE.md parle du kit', /## Le kit média/.test(fs.readFileSync(path.join(atelier, 'contexte', 'espace', 'ESPACE.md'), 'utf8')));
essai('la consigne dit de lire KIT.md', /contexte\/espace\/kit\/KIT\.md/.test(K.consigneKit(pose)));
const avant = fs.statSync(path.join(D2, 'ajouts', 'images', 'logo rouge.png')).mtimeMs;
await new Promise((r) => setTimeout(r, 30));
await K.installerKit(atelier, moi);
essai('reposé sans changement : rien n’est recopié', fs.statSync(path.join(D2, 'ajouts', 'images', 'logo rouge.png')).mtimeMs === avant);
K.retirerDuKit('moi', 'ajouts/polices/Jost-Black.ttf');
essai('retirer : rangé à part, rien n’est effacé', !fs.existsSync(path.join(K.dossierKit('moi'), 'ajouts', 'polices', 'Jost-Black.ttf'))
  && fs.readdirSync(path.join(K.dossierKit('moi'), '.retires')).length === 1 && K.lireKit('moi').nb === 5);
await K.installerKit(atelier, moi);
essai('le kit changé est reposé (la police retirée n’y est plus)', !fs.existsSync(path.join(D2, 'ajouts', 'polices', 'Jost-Black.ttf')));
essai('« Personne » n’a pas de kit : le dossier est retiré', (await K.installerKit(atelier, trouverEspace('neutre'))) === null && !fs.existsSync(D2));

console.log('La bibliothèque d’animations');
const at2 = path.join(tmp, 'atelier2');
const B = path.join(at2, 'remotion', 'src', 'bibliotheque');
fs.mkdirSync(B, {recursive: true});
fs.writeFileSync(path.join(B, 'CartonFin.tsx'), '// Bibliothèque : le carton de fin aux couleurs de l’espace, logo et texte en paramètres\nexport const CartonFin = () => null;\n');
fs.writeFileSync(path.join(B, 'Brouillon.tsx'), 'export const Brouillon = () => null;\n');
essai('la première ligne dit ce que fait une pièce', A.descriptionPiece(fs.readFileSync(path.join(B, 'CartonFin.tsx'), 'utf8')).startsWith('le carton de fin'));
const gardees = A.recueillirAnimations(at2, moi, {projet: 'Essai'});
essai('après le travail : seule la pièce annoncée est gardée', gardees.length === 1 && gardees[0] === 'CartonFin.tsx', JSON.stringify(gardees));
essai('elle est listée, avec son projet', A.listerAnimations('moi')[0]?.projet === 'Essai');
essai('la même pièce, inchangée : rien de neuf', A.recueillirAnimations(at2, moi).length === 0);
const at3 = path.join(tmp, 'atelier3');
const poses = A.installerAnimations(at3, moi);
essai('un nouveau montage la reçoit, avec BIBLIOTHEQUE.md', poses.length === 1 && fs.existsSync(path.join(at3, 'remotion', 'src', 'bibliotheque', 'CartonFin.tsx')) && fs.existsSync(path.join(at3, 'remotion', 'src', 'bibliotheque', 'BIBLIOTHEQUE.md')));
fs.writeFileSync(path.join(at3, 'remotion', 'src', 'bibliotheque', 'CartonFin.tsx'), '// Bibliothèque : changé par l’IA\nexport const CartonFin = () => 1;\n');
A.installerAnimations(at3, moi);
essai('une pièce changée par l’IA dans son dossier n’est pas écrasée', /changé par l’IA/.test(fs.readFileSync(path.join(at3, 'remotion', 'src', 'bibliotheque', 'CartonFin.tsx'), 'utf8')));
essai('« Personne » : ni bibliothèque, ni consigne', A.installerAnimations(path.join(tmp, 'atelier4'), trouverEspace('neutre')).length === 0 && A.consigneAnimations(trouverEspace('neutre')) === '');
essai('la consigne dit comment ranger une pièce', /« \/\/ Bibliothèque : /.test(A.consigneAnimations(moi, [])));
A.retirerAnimation('moi', 'CartonFin.tsx');
essai('retirer une pièce : rangée à part', A.listerAnimations('moi').length === 0 && fs.readdirSync(path.join(A.dossierAnimations('moi'), '.retirees')).length === 1);

console.log('Exporter : une échelle qui tombe juste');
const x = echelleExacte(1080, 1920, 1440);
essai('1080 × 1920 vers la 2K : 1440 × 2560, des tailles entières', x.largeur === 1440 && x.hauteur === 2560 && Number.isInteger(1080 * x.echelle) && Number.isInteger(1920 * x.echelle), JSON.stringify(x));
const y = echelleExacte(1920, 1080, 2160);
essai('1920 × 1080 vers la 4K : 3840 × 2160', y.largeur === 3840 && y.hauteur === 2160 && y.echelle === 2);
const z = echelleExacte(1080, 1350, 1440);
essai('4:5 vers la 2K : 1440 × 1800', z.largeur === 1440 && z.hauteur === 1800);

console.log('Une voix enregistrée reste une voix');
for (const [nom, role] of [['V1.m4a', 'voix'], ['Nouvel enregistrement 3.m4a', 'voix'], ['voix off.wav', 'voix'], ['musique de fond.mp3', 'musique'], ['Sons/impact.wav', 'musique'], ['beat.m4a', 'musique']]) {
  essai(`« ${nom} » → ${role}`, roleProbable(path.basename(nom), typeDe(nom), path.dirname(nom)) === role, roleProbable(path.basename(nom), typeDe(nom)));
}

console.log(`\n${ok} essais réussis sur ${ok + ko}`);
if (!ko) fs.rmSync(tmp, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${tmp}`);
process.exit(ko ? 1 : 0);
