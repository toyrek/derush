#!/usr/bin/env node
// Dérush — les essais des styles vidéo (competences/styles-video, lib/styles.mjs) et de « Comme cette vidéo » d'après
// un Motion.md : chaque style du catalogue a sa recette (et l'inverse), aucune recette ne parle encore des outils
// d'OpenMotion ni ne renvoie à la vidéo d'un autre créateur, chacune dit sa provenance et sa licence ; l'index liste
// tous les styles ; « Style : … » retrouve la bonne recette (accents, majuscules, nom d'origine) ; la consigne donne son
// chemin selon l'IA ; un Motion.md est reconnu par son nom ou son contenu.
//   node outils/essai-styles.mjs [dossier où créer le dossier d'essai]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('node outils/essai-styles.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
fs.mkdirSync(base, {recursive: true});
const tmp = fs.mkdtempSync(path.join(base, 'derush-essai-styles-'));
process.env.DERUSH_SUPPORT = path.join(tmp, 'support');
const S = await import(pathToFileURL(path.join(D, 'lib', 'styles.mjs')).href);
const DOSSIER = path.join(D, 'competences', 'styles-video');

let ok = 0;
let ko = 0;
const essai = (nom, cond, detail = '') => { if (cond === true) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail || cond ? ` — ${JSON.stringify(detail || cond).slice(0, 600)}` : ''}`); } };

console.log('La compétence styles-video');
// les styles vidéo sont une des deux collections (l'autre : les tableaux en mouvement, outils/essai-tableaux.mjs)
const cat = S.catalogueStyles('styles-video');
const fichiers = fs.readdirSync(path.join(DOSSIER, 'recettes')).filter((n) => n.endsWith('.md')).sort();
essai('99 styles en 7 familles, chacun avec un nom et une description en français', cat.styles.length === 99 && cat.categories.length === 7 && cat.styles.every((s) => s.nom && s.description && cat.categories.some((c) => c.id === s.categorie)), {styles: cat.styles.length, familles: cat.categories.length});
essai('chaque style a sa recette, et chaque recette son style', fichiers.length === 99 && cat.styles.every((s) => fichiers.includes(path.basename(s.fichier))) && fichiers.every((f) => cat.styles.some((s) => path.basename(s.fichier) === f)));
essai('des noms français tous différents', new Set(cat.styles.map((s) => s.nom.toLowerCase())).size === 99);
const textes = fichiers.map((f) => [f, fs.readFileSync(path.join(DOSSIER, 'recettes', f), 'utf8')]);
const outils = textes.filter(([, t]) => /openmotion_\w+|registers no MCP|revision protection|production Skill|hf-reference-|instagram\.com\/reel|tiktok\.com\/@|assets\/[\w-]+-reference\.mp4/i.test(t)).map(([f]) => f);
essai('aucune recette ne parle des outils d’OpenMotion ni ne renvoie à la vidéo d’un autre créateur', outils.length === 0, outils);
const sansEntete = textes.filter(([, t]) => !t.includes('**Dans Dérush.**') || !/derush-image/.test(t) || !/HyperFrames/.test(t)).map(([f]) => f);
essai('chacune commence par l’en-tête de Dérush (HyperFrames ou le kit, derush-image, le kit média)', sansEntete.length === 0, sansEntete);
const sansProvenance = textes.filter(([, t]) => !/_Adapté pour Dérush le 18 novembre 2026 depuis OpenMotion \(https:\/\/github\.com\/nexu-io\/openmotion, commit [0-9a-f]{7}, `library\/skills\/openmotion-[\w/.-]+`\)/.test(t) || !/Licence Apache-2\.0/.test(t)).map(([f]) => f);
essai('chacune dit d’où elle vient (fichier et commit d’OpenMotion), qu’elle a été changée, et sa licence', sansProvenance.length === 0, sansProvenance);
const index = fs.readFileSync(path.join(DOSSIER, 'SKILL.md'), 'utf8');
essai('l’index (SKILL.md) : nom de la compétence, et chaque style avec son nom français et sa recette', /^---\nname: styles-video\ndescription: /.test(index) && cat.styles.every((s) => index.includes(`| ${s.nom} | \`${s.fichier}\` |`)), index.slice(0, 200));
essai('la licence Apache-2.0 et la provenance sont livrées avec (LICENSE, SOURCE.md, licences/openmotion.txt)', /Apache License\s+Version 2\.0/.test(fs.readFileSync(path.join(DOSSIER, 'LICENSE'), 'utf8')) && /2b57cf6908af2a31380955380f5a30eb1857a9c1/.test(fs.readFileSync(path.join(DOSSIER, 'SOURCE.md'), 'utf8'))
  && /Apache License/.test(fs.readFileSync(path.join(D, 'competences', 'licences', 'openmotion.txt'), 'utf8')) && /styles-video/.test(fs.readFileSync(path.join(D, 'competences', 'LICENCES.md'), 'utf8')));
const poids = fichiers.reduce((s, f) => s + fs.statSync(path.join(DOSSIER, 'recettes', f)).size, 0);
essai('une seule compétence légère (moins de 600 Ko de texte, aucun binaire)', poids < 600000 && fs.readdirSync(DOSSIER, {recursive: true}).every((f) => !/\.(mp4|mov|webp|png|jpe?g|gif|woff2?|js)$/i.test(f)), poids);

console.log('« Style : … » dans une demande');
const ids = (t) => S.stylesDemandes(t).map((s) => s.id).join(',');
essai('le nom français, en tête du message', ids('Style : Autocollants qui rebondissent\nFais une pub de 10 secondes') === 'sticker-bounce');
essai('sans tenir compte des accents, des majuscules ni d’un point final', ids('style :  DESSINS AU TABLEAU BLANC.') === 'whiteboard-doodle' && ids('Style : Éclaboussure en suspens') === 'splash-float-product' && ids('STYLE: eclaboussure en suspens') === 'splash-float-product');
essai('le nom d’origine ou l’id marchent aussi', ids('Style : Sticker Bounce') === 'sticker-bounce' && ids('Style : before-after') === 'before-after');
essai('deux styles au plus, sans doublon ; un style inconnu ou une phrase qui parle de style ne comptent pas', ids('Style : Néon\nStyle : Néon\nStyle : Logo glitch\nStyle : Pop art') === 'neon-outline-type,glitch-logo-sting' && ids('Style : rien de spécial') === '' && ids('Je veux un style comme celui de la dernière fois') === '');
const cc = S.consigneStyles(S.stylesDemandes('Style : Avant / après'), 'claude');
const cx = S.consigneStyles(S.stylesDemandes('Style : Avant / après'), 'codex');
essai('la consigne donne le chemin de la recette dans les compétences de l’IA (Claude, Codex et Gemini)', /\.claude\/skills\/styles-video\/recettes\/before-after\.md/.test(cc) && /\.agents\/skills\/styles-video\/recettes\/before-after\.md/.test(cx) && /Lis la recette en entier/.test(cc) && S.consigneStyles([], 'claude') === '', cc);
essai('chaque recette nommée par la consigne existe bien dans la compétence', cat.styles.every((s) => fs.existsSync(path.join(DOSSIER, s.fichier))));

console.log('Les deux collections réunies');
const tout = S.catalogueStyles();
essai('deux collections dans le choix des styles : les styles vidéo (99) et les tableaux en mouvement (100), chacune avec son crédit', tout.collections.map((c) => `${c.id}:${c.styles}`).join(',') === 'styles-video:99,tableaux-en-mouvement:100' && tout.collections.every((c) => c.nom && c.aide && c.credit), tout.collections);
essai('199 styles en 13 familles ; chaque famille dit sa collection, chaque style sa compétence', tout.styles.length === 199 && tout.categories.length === 13 && tout.categories.every((c) => tout.collections.some((x) => x.id === c.collection)) && tout.styles.every((x) => x.competence === tout.categories.find((c) => c.id === x.categorie)?.collection));
essai('d’une collection à l’autre : aucun nom, aucun id en double', new Set(tout.styles.map((x) => x.nom.toLowerCase())).size === 199 && new Set(tout.styles.map((x) => x.id)).size === 199 && new Set(tout.categories.map((c) => c.id)).size === 13);
essai('un style de l’autre collection se trouve aussi par « Style : … », même sans sa parenthèse', ids('Style : Estampe japonaise (ukiyo-e)') === 'dessin-estampe-japonaise' && ids('style : estampe japonaise') === 'dessin-estampe-japonaise' && ids('Style : Van Gogh\nStyle : Avant / après') === 'art-van-gogh,before-after');
const ct = S.consigneStyles(S.stylesDemandes('Style : Van Gogh\nStyle : Avant / après'), 'claude');
essai('la consigne d’un tableau en mouvement : sa fiche dans sa compétence, derush-toile, la manière sans rien recopier ; celle d’un style vidéo reste à part',
  ct.split('\n').length === 2 && /\.claude\/skills\/tableaux-en-mouvement\/recettes\/art\/09_postimp\.md/.test(ct) && /derush-toile/.test(ct) && /tableaux-en-mouvement\/SKILL\.md/.test(ct) && /aucun personnage, aucun logo ni aucune œuvre/.test(ct) && /à la manière de/.test(ct) && /styles-video\/recettes\/before-after\.md/.test(ct), ct);

console.log('« Comme cette vidéo » d’après un Motion.md');
const f1 = path.join(tmp, 'notes.md');
fs.writeFileSync(f1, '# Lancement\n\n```motion-demo\n{"id": "sequence"}\n```\n');
const f2 = path.join(tmp, 'plan.md');
fs.writeFileSync(f2, '# Portal launch\n\n## Keep\nThe portal motion.\n\n## Replace\nThe story.\n');
const f3 = path.join(tmp, 'courses.md');
fs.writeFileSync(f3, '# Liste de courses\n\n- pain\n- lait\n');
essai('reconnu par son nom (motion.md, MOTION_DESIGN.md, « … motion.md »), jamais « promotion.md » ni un autre .md', S.estMotionMd('motion.md') && S.estMotionMd('MOTION_DESIGN.md') && S.estMotionMd('Dia launch motion.md') && S.estMotionMd('pub_motion.md') && !S.estMotionMd('promotion.md') && !S.estMotionMd('notes.md') && !S.estMotionMd('motion.txt'));
essai('… ou par son contenu (des blocs « motion-demo », ou « Keep » et « Replace » sur le mouvement)', S.estMotionMd('notes.md', f1) && S.estMotionMd('plan.md', f2) && !S.estMotionMd('courses.md', f3));
const long = path.join(tmp, 'long-motion.md');
fs.writeFileSync(long, `# Long\n${'x'.repeat(50000)}`);
essai('un Motion.md très long est coupé (30 000 caractères) avant d’aller au réalisateur', S.lireMotionMd(long).length === S.MAX_MOTION_MD && S.lireMotionMd(path.join(tmp, 'absent.md')) === null);
const cm = S.consigneMotionMd([{nom: 'motion.md'}]);
essai('la consigne du monteur : le lire en entier, reprendre le style, jamais ses images ni ses textes de marque', /d'après un Motion\.md/.test(cm) && /Lis-le en entier/.test(cm) && /n'en reprends aucun/.test(cm) && S.consigneMotionMd([]) === '');
essai('pour le réalisateur, le Motion.md arrive tel quel, présenté comme un style à reproduire', /^# Le Motion\.md joint par la personne : « motion\.md »/.test(S.motionEnTexte('PLAN', 'motion.md')) && /jamais un contenu à copier/.test(S.motionEnTexte('PLAN', 'motion.md')));

console.log(`\n${ok} essais réussis sur ${ok + ko}`);
if (!ko) fs.rmSync(tmp, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${tmp}`);
process.exit(ko ? 1 : 0);
