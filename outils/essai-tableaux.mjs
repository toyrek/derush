#!/usr/bin/env node
// Dérush — les essais des compétences « tableaux-en-mouvement » et « motionmaxxing » : le catalogue des 100 styles et
// leurs fiches (titre français, en-tête de Dérush, provenance, licence), le moteur de dessin embarqué, les documents de
// méthode, les licences ; l'adaptation de motionmaxxing (aucun de ses scripts ne reste) ; ce que Dérush branche autour
// (les bibliothèques du moteur de rendu, la boîte à outils de l'IA, les commandes, Manim à la demande).
//   node outils/essai-tableaux.mjs [dossier où créer le dossier d'essai]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('node outils/essai-tableaux.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
fs.mkdirSync(base, {recursive: true});
const tmp = fs.mkdtempSync(path.join(base, 'derush-essai-tableaux-'));
Object.assign(process.env, {DERUSH_SUPPORT: path.join(tmp, 'support'), ELEVENLABS_API_KEY: 'sk_eleven', DERUSH_GEMINI_CLE: 'cle-gemini'});
fs.mkdirSync(process.env.DERUSH_SUPPORT, {recursive: true});
const imp = (f) => import(pathToFileURL(path.join(D, 'lib', f)).href);
const C = path.join(D, 'competences', 'tableaux-en-mouvement');
const MM = path.join(D, 'competences', 'motionmaxxing');
const lire = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const fichiers = (d) => fs.readdirSync(d, {recursive: true, withFileTypes: true}).filter((e) => e.isFile()).map((e) => path.relative(d, path.join(e.parentPath ?? e.path, e.name)));

let ok = 0;
let ko = 0;
const essai = (nom, cond, detail = '') => { if (cond === true) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail || cond ? ` — ${JSON.stringify(detail || cond).slice(0, 700)}` : ''}`); } };

console.log('Le catalogue des tableaux en mouvement');
const cat = JSON.parse(lire(C, 'catalogue.json'));
const par = (src) => cat.styles.filter((s) => s.source === src);
essai('100 styles en 6 familles : 53 styles d’art, 32 matières de dessin, 15 styles de mouvement', cat.styles.length === 100 && cat.categories.length === 6 && par('huashu-art-motion').length === 53 && par('anidoodle').length === 32 && par('mg-styles-15').length === 15, {styles: cat.styles.length});
essai('chacun a un nom et une phrase en français, une famille et un nom d’origine ; aucun nom ni id en double', cat.styles.every((s) => s.nom && s.description?.length > 25 && s.nom_origine && cat.categories.some((c) => c.id === s.categorie)) && new Set(cat.styles.map((s) => s.nom.toLowerCase())).size === 100 && new Set(cat.styles.map((s) => s.id)).size === 100);
essai('chaque source dit son dépôt, sa version et sa licence', cat.sources.length === 3 && cat.sources.every((s) => /^https:\/\/github\.com\//.test(s.depot) && /^[0-9a-f]{40}$/.test(s.commit) && ['MIT', 'Apache-2.0'].includes(s.licence)) && cat.sources.reduce((n, s) => n + s.styles, 0) === 100, cat.sources);
const recettes = fichiers(path.join(C, 'recettes')).map((f) => `recettes/${f.split(path.sep).join('/')}`).sort();
essai('chaque style a sa fiche, et chaque fiche son style', recettes.length === 100 && cat.styles.every((s) => recettes.includes(s.fichier)) && recettes.every((f) => cat.styles.some((s) => s.fichier === f)), recettes.filter((f) => !cat.styles.some((s) => s.fichier === f)));
const textes = cat.styles.map((s) => [s, lire(C, s.fichier)]);
const sansEntete = textes.filter(([s, t]) => !t.startsWith(`# ${s.nom} (`) || !t.includes(`> ${s.description}`) || !t.includes('**Dans Dérush.**') || !/derush-toile/.test(t)).map(([s]) => s.fichier);
essai('chaque fiche commence par son nom français, sa phrase et l’en-tête de Dérush (derush-toile)', sansEntete.length === 0, sansEntete);
const maniere = textes.filter(([, t]) => !/jamais un personnage, un logo ou une œuvre à recopier|dessine celui de la personne/.test(t)).map(([s]) => s.fichier);
essai('chaque fiche rappelle qu’un style est une manière : ni personnage, ni logo, ni œuvre à recopier', maniere.length === 0, maniere);
const DEPOTS = {'huashu-art-motion': ['alchaincyf/huashu-art-motion', 'a97c450', /Licence MIT/], anidoodle: ['alexgreensh/anidoodle', '4ae27d2', /Licence Apache-2\.0/], 'mg-styles-15': ['Vincentwei1021/mg-styles-15', '46fd009', /Licence MIT/]};
const sansProvenance = textes.filter(([s, t]) => { const [depot, commit, licence] = DEPOTS[s.source]; const pied = t.trimEnd().split('\n').at(-1); return !(pied.startsWith('_') && pied.includes(`https://github.com/${depot}, commit ${commit}`) && licence.test(pied) && /pour Dérush le 24 novembre 2026/.test(pied)); }).map(([s]) => s.fichier);
essai('chaque fiche dit d’où elle vient (dépôt, version, fichier), ce qui a été ajouté, et sa licence', sansProvenance.length === 0, sansProvenance);
const scenes = fs.readdirSync(path.join(C, 'moteur', 'scenes'));
essai('un style d’art nomme sa scène d’exemple quand le moteur en a une : elle existe', par('huashu-art-motion').filter((s) => s.scene).length === 52 && par('huashu-art-motion').every((s) => !s.scene || fs.existsSync(path.join(C, s.scene))) && scenes.filter((n) => /^\d\d_/.test(n)).length === 53, par('huashu-art-motion').filter((s) => !s.scene).map((s) => s.id));
const index = lire(C, 'SKILL.md');
essai('SKILL.md : le nom de la compétence, une description en français, et chaque style avec sa fiche', /^---\nname: tableaux-en-mouvement\ndescription: >-\n/.test(index) && cat.styles.every((s) => index.includes(`| ${s.nom} | \`${s.fichier}\` |`)) && cat.categories.every((c) => index.includes(`### ${c.nom}`)), index.slice(0, 120));
const T = await imp('toile.mjs');
essai('les pages de départ que SKILL.md nomme existent toutes, et il renvoie à la méthode, au jury et à motionmaxxing', T.gabarits().every((g) => index.includes(`\`${g.nom}\``)) && /methode\.md/.test(index) && /references\/jury\.md/.test(index) && /`motionmaxxing`/.test(index) && /derush-manim/.test(index) && fs.existsSync(path.join(C, 'methode.md')));

console.log('Les documents de méthode et les licences');
const refH = fs.readdirSync(path.join(C, 'references', 'huashu')).sort();
const refA = fs.readdirSync(path.join(C, 'references', 'anidoodle')).sort();
essai('15 documents de huashu-art-motion (et leur mode d’emploi dans Dérush), 9 d’anidoodle, le jury et le gabarit de style', refH.length === 16 && refH.includes('LISEZ-MOI.md') && refA.length === 9 && fs.existsSync(path.join(C, 'references', 'jury.md')) && fs.existsSync(path.join(C, 'references', 'ecrire-un-style-de-mouvement.md')), [refH.length, refA.length]);
const lisezMoi = lire(C, 'references', 'huashu', 'LISEZ-MOI.md');
essai('le mode d’emploi dit ce que deviennent leurs commandes (derush-toile) et liste chaque document', /derush-toile images/.test(lisezMoi) && /derush-toile verifier/.test(lisezMoi) && refH.filter((n) => n !== 'LISEZ-MOI.md').every((n) => lisezMoi.includes(`\`${n}\``)));
const refs = [...refH.filter((n) => n !== 'LISEZ-MOI.md').map((n) => ['huashu', n]), ...refA.map((n) => ['anidoodle', n])].filter(([d, n]) => !/_Repris (tel quel )?pour Dérush le 24 novembre 2026 depuis (huashu-art-motion|anidoodle) \(https:\/\/github\.com\/[\w/-]+, commit [0-9a-f]{7}, `[^`]+`\)/.test(lire(C, 'references', d, n).trimEnd().split('\n').at(-1)));
essai('chaque document repris dit sa provenance', refs.length === 0, refs);
const licence = lire(C, 'LICENSE');
const L = path.join(D, 'competences', 'licences');
essai('les licences sont livrées avec : MIT (deux fois), Apache-2.0 et la notice d’anidoodle, les polices sous OFL',
  (licence.match(/MIT License/g) ?? []).length === 2 && /Copyright \(c\) 2026 Vincentwei1021/.test(licence) && /Apache-2\.0/.test(licence) && /Copyright 2026 Alex Greenshpun/.test(lire(C, 'NOTICE-anidoodle.txt'))
  && /MIT License/.test(lire(L, 'alchaincyf.txt')) && /Apache License/.test(lire(L, 'alexgreensh.txt')) && /NOTICE \(anidoodle\)/.test(lire(L, 'alexgreensh.txt')) && /MIT License/.test(lire(L, 'vincentwei1021.txt')) && /SIL Open Font License/.test(lire(C, 'moteur', 'lib', 'fonts', 'OFL.txt')));
const source = lire(C, 'SOURCE.md');
essai('SOURCE.md donne les trois dépôts et leurs versions, ce qui est changé et ce qui n’est pas repris', cat.sources.every((s) => source.includes(s.depot) && source.includes(s.commit)) && /Ce qui n'est pas repris/.test(source) && /lib\/fonts\.js/.test(source) && /seeco/.test(source));
const pages = lire(D, 'competences', 'LICENCES.md');
essai('la page des licences des compétences cite les deux nouvelles, et le fluide de la page « encre »', /`tableaux-en-mouvement`/.test(pages) && /`motionmaxxing`/.test(pages) && /huashu-art-motion/.test(pages) && /anidoodle/.test(pages) && /mg-styles-15/.test(pages) && /WebGL-Fluid-Simulation/.test(pages)
  && /Copyright \(c\) 2017 Pavel Dobryakov/.test(lire(L, 'paveldogreat.txt')) && /Copyright \(c\) 2017 Pavel Dobryakov/.test(lire(D, 'modeles', 'toiles', 'encre', 'fluide.js')));

console.log('Le moteur de dessin embarqué');
const M = path.join(C, 'moteur');
const fm = fichiers(M);
essai('le moteur, ses transitions, ses 53 scènes, ses bibliothèques et ses clips ; aucun programme Python, aucun film de démonstration',
  ['engine.js', 'transitions.js', 'index.html', 'eras.js', 'eras_gallery.js', 'clip.html', 'clip.js'].every((f) => fm.includes(f)) && fm.filter((f) => f.startsWith(`scenes${path.sep}`)).length === 54 && fm.filter((f) => f.startsWith(`clips${path.sep}`)).length === 8
  && !fm.some((f) => /\.(py|mp4|mov|gif|jpe?g)$/i.test(f)) && !fm.some((f) => /^(demos|reference_films)\b/.test(f)), fm.length);
const polices = [...lire(M, 'lib', 'fonts.js').matchAll(/url:'(lib\/fonts\/[^']+)'/g)].map((m) => m[1]);
essai('chaque police que le moteur charge est livrée (les graisses chinoises lourdes ne le sont pas, et le fichier le dit)', polices.length >= 40 && polices.every((u) => fs.existsSync(path.join(M, u))) && /Modifié par Dérush/.test(lire(M, 'lib', 'fonts.js')) && !polices.some((u) => /NotoSansSC-\d|NotoSerifJP/.test(u)), polices.filter((u) => !fs.existsSync(path.join(M, u))));
const poids = (d) => fichiers(d).reduce((n, f) => n + fs.statSync(path.join(d, f)).size, 0);
essai('moins de 10 Mo en tout, aucun fichier de plus de 2,5 Mo', poids(C) < 10 * 2 ** 20 && fichiers(C).every((f) => fs.statSync(path.join(C, f)).size < 2.5 * 2 ** 20), Math.round(poids(C) / 2 ** 10));
// eslint-disable-next-line no-control-regex
essai('des noms de fichiers en lettres simples (ils voyagent mal d’un système à l’autre sinon)', [...fichiers(C), ...fichiers(MM)].every((f) => /^[\x20-\x7e]+$/.test(f)), [...fichiers(C), ...fichiers(MM)].filter((f) => !/^[\x20-\x7e]+$/.test(f)).slice(0, 5));
const hors = fichiers(C).filter((f) => /\.(md|json|txt)$/.test(f) && !/^(recettes[\\/]art|references[\\/]huashu|references[\\/]anidoodle)[\\/]/.test(f) && /uv run|render\.py|qa\.py|playwright install|npx /.test(lire(C, f)) && !['SOURCE.md', path.join('references', 'huashu', 'LISEZ-MOI.md')].includes(f));
essai('les commandes des dépôts d’origine (uv run, render.py, playwright) ne restent que dans les fiches dont l’en-tête dit quoi faire à la place', hors.length === 0, hors);

console.log('motionmaxxing, adapté à Dérush');
const sk = lire(MM, 'SKILL.md');
essai('SKILL.md : le nom, une description en français, le paragraphe « Dans Dérush »', /^---\nname: motionmaxxing\ndescription: >-\n/.test(sk) && sk.includes('**Dans Dérush.**') && /derush-toile/.test(sk) && /derush-controle/.test(sk) && /derush-son/.test(sk));
const restes = sk.split('\n').filter((l) => !l.startsWith('_Adapté pour Dérush') && /\$SKILL\/scripts|render\.mjs|look\.py|voice\.py|mix\.py|brand\.mjs|fetch_logo|providers\.sh|precedent\.py|blind_review|imagegen\.py|templates\/film\.html|runtime\//.test(l));
essai('aucune commande des scripts de motionmaxxing ne reste dans ses étapes', restes.length === 0, restes.map((l) => l.slice(0, 120)));
essai('ses règles sont là : ce qu’on ne livre jamais, les lois de métier, les contrôles G0 à G5', /## Never ship/.test(sk) && /## Craft laws/.test(sk) && /G0 render exists/.test(sk) && /G5 no page chrome/.test(sk) && /derush-toile mouvement/.test(sk));
const refM = fs.readdirSync(path.join(MM, 'references')).sort();
essai('13 documents de référence et les deux carnets de goûts, chacun avec sa provenance ; ni scripts, ni moteur, ni GSAP', refM.length === 13 && !refM.includes('tools.md') && fs.readdirSync(path.join(MM, 'taste')).length === 2
  && [...refM.map((n) => ['references', n]), ['taste', 'verdicts.md'], ['taste', 'edits.md']].every(([d, n]) => /_Repris pour Dérush le 24 novembre 2026 depuis motionmaxxing \(https:\/\/github\.com\/Tejashmakwana\/motionmaxxing, commit 8c8ec0f, `[^`]+`\)/.test(lire(MM, d, n).trimEnd().split('\n').at(-1)))
  && !fs.existsSync(path.join(MM, 'scripts')) && !fs.existsSync(path.join(MM, 'runtime')) && !fichiers(MM).some((f) => /gsap|\.(js|py|sh)$/i.test(f)), refM);
essai('sa licence Apache-2.0, sa notice et sa page de provenance (ce qui n’est pas repris : GSAP, les scripts)', /Apache License/.test(lire(MM, 'LICENSE')) && /Tejas Makwana/.test(lire(MM, 'NOTICE')) && /GSAP n'est pas un logiciel libre/.test(lire(MM, 'SOURCE.md')) && /8c8ec0f2a6f6c9a0da15cd24f7b1298ab298368c/.test(lire(MM, 'SOURCE.md')) && /Apache License/.test(lire(L, 'tejashmakwana.txt')));

console.log('Ce que Dérush branche autour');
const K = await imp('competences.mjs');
const liste = K.listerCompetences();
essai('les deux compétences sont dans la bibliothèque de l’IA, avec leur description', ['tableaux-en-mouvement', 'motionmaxxing'].every((n) => liste.some((s) => s.nom === n && s.description?.length > 80)), liste.filter((s) => /tableaux|motionmaxxing/.test(s.nom)));
essai('aucune des deux ne demande à l’IA de lancer un programme téléchargé ou de donner une clé', [index, sk].every((t) => { const r = K.risquesSkill(t); return r.cles.length === 0 && !r.commandes && !r.lance; }), [K.risquesSkill(index), K.risquesSkill(sk)]);
const kit = JSON.parse(lire(D, 'modeles', 'kit-remotion', 'package.json')).dependencies;
essai('le moteur de rendu reçoit les bibliothèques du trait à la main et des particules, à une version précise', kit.roughjs === '4.6.6' && kit['three.quarks'] === '0.17.1' && kit['quarks.core'] === '0.17.1' && kit['simplex-noise'] === '4.0.3' && ['roughjs', 'three.quarks', 'quarks.core', 'simplex-noise', 'three'].every((n) => T.BIBLIOTHEQUES.includes(n) && /^\d+\.\d+\.\d+$/.test(kit[n])), kit);
essai('la carte d’import mène aux bons fichiers', T.CARTE_IMPORT.imports.roughjs === '/lib/roughjs/bundled/rough.esm.js' && T.CARTE_IMPORT.imports['three.quarks'] === '/lib/three.quarks/dist/three.quarks.esm.js' && T.CARTE_IMPORT.imports.three === '/lib/three/build/three.module.js' && /<script type="importmap">/.test(T.baliseCarteImport()));
const {boiteAOutils} = await imp('recettes.mjs');
const outils = boiteAOutils({});
essai('la boîte à outils de l’IA (OUTILS.md) présente derush-toile, la mesure du mouvement et Manim', /`derush-toile`/.test(outils) && /derush-toile gabarit croquis toile/.test(outils) && /`derush-toile mouvement`/.test(outils) && /`derush-manim`/.test(outils) && /tableaux-en-mouvement/.test(outils));
K.preparerCommandes();
const bin = fs.readdirSync(K.DOSSIER_COMMANDES);
essai('les commandes derush-toile et derush-manim sont données à l’IA', ['derush-toile', 'derush-manim'].every((n) => bin.includes(process.platform === 'win32' ? `${n}.cmd` : n)), bin);
const Ma = await imp('manim.mjs');
const em = Ma.etatManim();
const pm = Ma.prerequisManim();
essai('Manim n’est pas installé d’avance ; son état dit ce qu’il faut, et la commande de sa documentation quand le système n’a pas ses bibliothèques', em.ok === false && /n’est pas installé/.test(em.pourquoi) && (pm.ok === true || (pm.manque.length > 0 && /^(brew install cairo pkg-config|sudo apt install )/.test(pm.commande) && /docs\.manim\.community/.test(pm.doc) && /c’est à elle de la lancer/.test(em.pourquoi))), [em, pm]);
const refuse = await Ma.rendreManim({fichier: 'scene.py', scene: 'A', sortie: 'x.mp4', cwd: tmp}).then(() => null, (e) => e.message);
essai('sans Manim, un rendu est refusé avec la marche à suivre ; son environnement ne porte aucune clé', /n’est pas installé/.test(refuse ?? '') && !('ELEVENLABS_API_KEY' in Ma.envManim()) && !('DERUSH_GEMINI_CLE' in Ma.envManim()) && Object.keys(Ma.QUALITES).join(',') === 'brouillon,moyenne,haute,4k', refuse);

console.log(`\n${ok} essais réussis sur ${ok + ko}`);
if (!ko) fs.rmSync(tmp, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${tmp}`);
process.exit(ko ? 1 : 0);
