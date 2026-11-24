#!/usr/bin/env node
// Dérush — les essais des styles vidéo (competences/styles-video, lib/styles.mjs) et de « Comme cette vidéo » d'après
// un Motion.md : chaque style du catalogue a sa recette (et l'inverse), aucune recette ne parle encore des outils
// d'OpenMotion ni ne renvoie à la vidéo d'un autre créateur, chacune dit sa provenance et sa licence ; l'index liste
// tous les styles ; « Style : … » retrouve la bonne recette (accents, majuscules, nom d'origine) ; la consigne donne son
// chemin selon l'IA ; un Motion.md est reconnu par son nom ou son contenu ; « Films en 99 styles » (les fiches de
// Lemo-Opuscar) se télécharge fichier par fichier, chacun vérifié par son empreinte, depuis une source jouée ici par un
// petit serveur local.
//   node outils/essai-styles.mjs [dossier où créer le dossier d'essai]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
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
// les styles vidéo sont une des collections (les tableaux en mouvement : outils/essai-tableaux.mjs ; les films en 99
// styles, à télécharger : plus bas)
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

console.log('Les collections réunies');
const tout = S.catalogueStyles();
essai('trois collections dans le choix des styles : les styles vidéo (99), les tableaux en mouvement (100), et les films en 99 styles, pas encore téléchargés (0), chacune avec son crédit', tout.collections.map((c) => `${c.id}:${c.styles}`).join(',') === 'styles-video:99,tableaux-en-mouvement:100,lemo-opuscar:0' && tout.collections.every((c) => c.nom && c.aide && c.credit) && tout.styles.length === 199, tout.collections);
essai('199 styles en 13 familles ; chaque famille dit sa collection, chaque style sa compétence', tout.styles.length === 199 && tout.categories.length === 13 && tout.categories.every((c) => tout.collections.some((x) => x.id === c.collection)) && tout.styles.every((x) => x.competence === tout.categories.find((c) => c.id === x.categorie)?.collection));
essai('d’une collection à l’autre : aucun nom, aucun id en double', new Set(tout.styles.map((x) => x.nom.toLowerCase())).size === 199 && new Set(tout.styles.map((x) => x.id)).size === 199 && new Set(tout.categories.map((c) => c.id)).size === 13);
essai('un style de l’autre collection se trouve aussi par « Style : … », même sans sa parenthèse', ids('Style : Estampe japonaise (ukiyo-e)') === 'dessin-estampe-japonaise' && ids('style : estampe japonaise') === 'dessin-estampe-japonaise' && ids('Style : Van Gogh\nStyle : Avant / après') === 'art-van-gogh,before-after');
const ct = S.consigneStyles(S.stylesDemandes('Style : Van Gogh\nStyle : Avant / après'), 'claude');
essai('la consigne d’un tableau en mouvement : sa fiche dans sa compétence, derush-toile, la manière sans rien recopier ; celle d’un style vidéo reste à part',
  ct.split('\n').length === 2 && /\.claude\/skills\/tableaux-en-mouvement\/recettes\/art\/09_postimp\.md/.test(ct) && /derush-toile/.test(ct) && /tableaux-en-mouvement\/SKILL\.md/.test(ct) && /aucun personnage, aucun logo ni aucune œuvre/.test(ct) && /à la manière de/.test(ct) && /styles-video\/recettes\/before-after\.md/.test(ct), ct);

console.log('« Films en 99 styles » : les fiches de Lemo-Opuscar, à télécharger');
const O = await import(pathToFileURL(path.join(D, 'lib', 'opuscar.mjs')).href);
const K = await import(pathToFileURL(path.join(D, 'lib', 'competences.mjs')).href);
const T = O.OPUSCAR;
const col3 = tout.collections[2];
essai('avant le téléchargement : la collection dit sa taille (1,4 Mo), sa source et ses 15 familles, et n’apporte aucun style', col3.a_telecharger?.present === false && col3.a_telecharger.styles === 99 && col3.a_telecharger.fichiers === 101 && col3.a_telecharger.octets > 1.3e6 && col3.a_telecharger.octets < 1.6e6 && col3.a_telecharger.source === 'https://github.com/lemomo-ai/lemo-opuscar' && col3.a_telecharger.familles.length === 15 && /CC BY-NC/.test(col3.credit) && !tout.styles.some((x) => x.competence === 'lemo-opuscar'), col3);
essai('la table : un dépôt, un commit entier, 99 styles en 15 familles, chacun avec sa taille et son empreinte', T.depot === 'lemomo-ai/lemo-opuscar' && /^[0-9a-f]{40}$/.test(T.commit) && T.styles.length === 99 && T.categories.length === 15 && T.styles.every((x) => /^[a-z0-9-]{2,40}$/.test(x.slug) && x.octets > 5000 && x.octets < 60000 && /^[0-9a-f]{64}$/.test(x.sha256) && T.categories.some((c) => c.id === x.categorie)) && new Set(T.styles.map((x) => x.sha256)).size === 99 && Object.keys(T.fichiers).join() === 'LICENSE,LICENSES/CC-BY-NC-4.0.txt');
essai('chaque style a un nom et une phrase en français écrits pour Dérush, et son nom d’origine', T.styles.every((x) => x.nom.length > 3 && x.description.length > 25 && x.description.length < 150 && /[.!?»]$/.test(x.description) && x.nom_origine && x.nom !== x.nom_origine) && new Set(T.styles.map((x) => x.nom.toLowerCase())).size === 99);
const simple = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[«»"“”.]/g, '').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
const court = (n) => simple(n.replace(/\s*\([^)]*\)\s*$/, ''));
const pris = new Set(tout.styles.flatMap((x) => [simple(x.nom), court(x.nom), x.id]));
const heurts = T.styles.filter((x) => pris.has(simple(x.nom)) || pris.has(court(x.nom)) || pris.has(`opuscar-${x.slug}`)).map((x) => x.nom);
essai('aucun de ces 99 noms n’est déjà celui d’un des 199 autres styles', heurts.length === 0, heurts);
essai('rien de Lemo-Opuscar n’est livré dans Dérush : ni fiche, ni phrase de leur catalogue', !fs.existsSync(path.join(D, 'competences', 'lemo-opuscar')) && !/Style Prompt|References \(grammar only\)/.test(fs.readFileSync(path.join(D, 'lib', 'opuscar.json'), 'utf8')));

// une fausse source : trois fiches, les deux licences, servies par un petit serveur local ; la table d'essai porte leurs empreintes
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const contenus = {'LICENSE': Buffer.from('Licence d’essai\n'), 'LICENSES/CC-BY-NC-4.0.txt': Buffer.from('CC BY-NC 4.0 (essai)\n')};
const faux = {...T, commit: 'a'.repeat(40), fichiers: {}, categories: T.categories.slice(0, 2), styles: []};
for (const [i, x] of T.styles.filter((y) => faux.categories.some((c) => c.id === y.categorie)).slice(0, 3).entries()) {
  const b = Buffer.from(`# ${x.nom_origine} — Style Prompt\n\n> Fiche d’essai numéro ${i}.\n`);
  contenus[`styles/${x.slug}/STYLE.md`] = b;
  faux.styles.push({...x, octets: b.length, sha256: sha(b)});
}
for (const c of ['LICENSE', 'LICENSES/CC-BY-NC-4.0.txt']) faux.fichiers[c] = [contenus[c].length, sha(contenus[c])];
const demandes = [];
let abime = null; // un chemin à servir abîmé (un octet changé, ou un fichier plus long), pour l'essai du refus
const srv = http.createServer((req, res) => {
  const chemin = decodeURIComponent(req.url.replace(/^\/depot\//, ''));
  demandes.push(chemin);
  let b = contenus[chemin];
  if (!b) { res.writeHead(404); return res.end('absent'); }
  if (abime?.chemin === chemin) b = abime.comment === 'long' ? Buffer.concat([b, Buffer.from('en plus')]) : Buffer.from(b.toString().replace('essai', 'ESSAI'));
  res.writeHead(200, {'content-type': 'text/plain', 'content-length': b.length});
  res.end(b);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const source = `http://127.0.0.1:${srv.address().port}/depot`;
const dossier = O.DOSSIER_OPUSCAR;
const suivi = [];
const etat = await O.telechargerOpuscar({source, manifeste: faux, prog: (p) => suivi.push(p)});
const arbre = (d) => fs.readdirSync(d, {recursive: true, withFileTypes: true}).filter((e) => e.isFile()).map((e) => path.relative(d, path.join(e.parentPath ?? e.path, e.name)).split(path.sep).join('/')).sort();
essai('téléchargé : chaque fichier de la table, demandé une fois, écrit tel quel dans le dossier de Dérush', etat.present === true && etat.styles === 3 && etat.a_jour === true && demandes.length === 5 && new Set(demandes).size === 5 && Object.entries(contenus).every(([c, b]) => fs.readFileSync(path.join(dossier, c)).equals(b)) && dossier.startsWith(process.env.DERUSH_SUPPORT), {etat, demandes});
essai('avec ce que Dérush écrit lui-même : l’index, la provenance, le catalogue, et rien d’autre', JSON.stringify(arbre(dossier)) === JSON.stringify(['.derush-opuscar.json', 'LICENSE', 'LICENSES/CC-BY-NC-4.0.txt', 'SKILL.md', 'SOURCE.md', 'catalogue.json', ...faux.styles.map((x) => `styles/${x.slug}/STYLE.md`)].sort()), arbre(dossier));
essai('l’avancement est donné de 0 à 1', suivi.length === 5 && suivi.at(-1) === 1 && suivi.every((p, i) => i === 0 || p > suivi[i - 1]));
const skill = fs.readFileSync(path.join(dossier, 'SKILL.md'), 'utf8');
essai('l’index dit à l’IA comment s’en servir dans Dérush : derush-toile, rien à installer ni à télécharger, les œuvres citées ne se recopient pas, le crédit', /^---\nname: lemo-opuscar\ndescription: >-\n/.test(skill) && skill.includes('**Dans Dérush.**') && /derush-toile/.test(skill) && /window\.renderAt\(t\)/.test(skill) && /n'installe et ne télécharge rien de toi-même/.test(skill) && /jamais une œuvre à recopier/.test(skill) && /Lemo-Opuscar by Lemomo \(LemoLab\)/.test(skill) && /CC BY-NC 4\.0/.test(skill) && /EianLu/.test(skill) && /2nd1st/.test(skill) && faux.styles.every((x) => skill.includes(`**${x.nom}** (${x.nom_origine}) : \`styles/${x.slug}/STYLE.md\``)));
const prov = fs.readFileSync(path.join(dossier, 'SOURCE.md'), 'utf8');
essai('la provenance dit le dépôt, le commit, ce qui est pris et ce qui ne l’est pas', prov.includes(`commit \`${faux.commit}\``) && /github\.com\/lemomo-ai\/lemo-opuscar/.test(prov) && /Pas pris : leur code/.test(prov) && /Dérush ne les redistribue pas/.test(prov));
K.oublierCompetences();
essai('c’est une compétence donnée à l’IA, téléchargée (pas livrée)', K.listerCompetences().some((x) => x.nom === 'lemo-opuscar' && x.source === 'telechargee' && x.description?.length > 80));
S.oublierStyles();
const apres = S.catalogueStyles();
const c3 = apres.collections[2];
// (le commit de la table d'essai n'est pas celui de la vraie table : le catalogue le voit, et propose la mise à jour)
essai('la collection apporte maintenant ses styles et leurs familles', c3.id === 'lemo-opuscar' && c3.styles === 3 && c3.a_telecharger.present === true && c3.a_telecharger.a_jour === false && apres.styles.length === 202 && apres.categories.filter((x) => x.collection === 'lemo-opuscar').length === 2 && apres.styles.filter((x) => x.competence === 'lemo-opuscar').every((x) => x.id.startsWith('opuscar-') && /^styles\/[a-z0-9-]+\/STYLE\.md$/.test(x.fichier) && fs.existsSync(path.join(dossier, x.fichier))), c3);
const un = faux.styles[0];
const dem = S.stylesDemandes(`Un film sur notre asso.\nStyle : ${un.nom}`);
essai('« Style : … » retrouve la fiche par son nom français, par son nom d’origine, sans les accents', dem.length === 1 && dem[0].id === `opuscar-${un.slug}` && S.stylesDemandes(`style : ${un.nom_origine.toLowerCase()}`)[0]?.id === dem[0].id && S.stylesDemandes(`Style : ${un.nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()}`)[0]?.id === dem[0].id, dem);
const cons = S.consigneStyles(dem, 'claude');
essai('la consigne donne le chemin de la fiche et de l’index selon l’IA, et dit de faire le film avec derush-toile', cons.includes(`.claude/skills/lemo-opuscar/styles/${un.slug}/STYLE.md`) && cons.includes('.claude/skills/lemo-opuscar/SKILL.md') && /film entier fait en code/.test(cons) && /derush-toile/.test(cons) && /jamais un modèle à recopier/.test(cons) && S.consigneStyles(dem, 'codex').includes(`.agents/skills/lemo-opuscar/styles/${un.slug}/STYLE.md`) && !/recette/.test(cons), cons);
essai('avec un autre commit dans la table, les fiches présentes sont dites « à mettre à jour »', O.etatOpuscar(dossier, {...faux, commit: 'b'.repeat(40)}).a_jour === false && O.etatOpuscar(dossier, faux).a_jour === true);

// un fichier qui n'est pas celui de la table : refusé, et ce qui était là reste
const avant = arbre(dossier).map((n) => [n, sha(fs.readFileSync(path.join(dossier, n)))]);
const cible = `styles/${faux.styles[1].slug}/STYLE.md`;
abime = {chemin: cible, comment: 'octet'};
const refus1 = await O.telechargerOpuscar({source, manifeste: faux}).then(() => null, (e) => e.message);
abime = {chemin: cible, comment: 'long'};
const refus2 = await O.telechargerOpuscar({source, manifeste: faux}).then(() => null, (e) => e.message);
abime = null;
const refus3 = await O.telechargerOpuscar({source, manifeste: {...faux, styles: [...faux.styles, {...faux.styles[0], slug: 'absente'}]}}).then(() => null, (e) => e.message);
essai('un fichier changé d’un seul caractère, trop long, ou absent de la source : tout est refusé, en clair', /n’est pas le fichier que Dérush a relu/.test(refus1 ?? '') && refus1.includes(cible) && /n’est pas le fichier que Dérush a relu/.test(refus2 ?? '') && /ne donne pas styles\/absente\/STYLE\.md \(404\)/.test(refus3 ?? ''), [refus1, refus2, refus3]);
essai('et rien n’a bougé : les fiches déjà là sont intactes, aucun dossier de passage ne reste', JSON.stringify(arbre(dossier).map((n) => [n, sha(fs.readFileSync(path.join(dossier, n)))])) === JSON.stringify(avant) && !fs.readdirSync(path.dirname(dossier)).some((n) => n.startsWith('.lemo-opuscar')), fs.readdirSync(path.dirname(dossier)));
const refus4 = await O.telechargerOpuscar({source: 'http://127.0.0.1:9/depot', manifeste: faux}).then(() => null, (e) => e.message);
essai('source injoignable : le message dit de vérifier la connexion', /injoignable : vérifie ta connexion/.test(refus4 ?? ''), refus4);
const refus5 = await O.telechargerOpuscar({source, manifeste: {...faux, styles: [{...faux.styles[0], slug: '../../dehors'}]}}).then(() => null, (e) => e.message);
essai('une table qui voudrait écrire hors du dossier est refusée avant tout téléchargement', /Chemin refusé/.test(refus5 ?? ''), refus5);
await new Promise((r) => srv.close(r));
const ote = O.retirerOpuscar();
S.oublierStyles();
essai('retirées : plus de dossier, plus de compétence, et la collection redevient « à télécharger »', ote.present === false && !fs.existsSync(dossier) && !K.listerCompetences().some((x) => x.nom === 'lemo-opuscar') && S.catalogueStyles().collections[2].styles === 0 && S.catalogueStyles().styles.length === 199);
const srvJs = fs.readFileSync(path.join(D, 'lib', 'serveur.mjs'), 'utf8');
const appJs = fs.readFileSync(path.join(D, 'public', 'app.js'), 'utf8');
essai('le serveur ne télécharge que sur demande (POST /api/styles/telecharger), un seul à la fois ; l’écran dit la licence avant le bouton', /p === '\/api\/styles\/telecharger'/.test(srvJs) && /Le téléchargement est déjà en cours/.test(srvJs) && !/telechargerOpuscar\(\)/.test(srvJs.replace(/telechargementStyles = O\.telechargerOpuscar\(\)/, '')) && /data-st-telecharger/.test(appJs) && /CC BY-NC 4\.0/.test(appJs) && /Dérush ne les livre donc pas/.test(appJs) && /Retirer de cet ordinateur/.test(appJs));

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
