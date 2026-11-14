// Dérush — essais du projet (pour qui modifie Dérush) : ce que le serveur garde à l'enregistrement, ce qu'il refuse
// d'un projet reçu (ids, nombres, noms de fichiers), un projet mis à la corbeille pendant une tâche, la série d'un projet
// passé à un autre espace, les temps tapés à la main et les propositions écrites par l'IA (retours-ia.json).
//   node outils/essai-projet.mjs [dossier où créer le dossier d'essai]
// Aucun réseau, aucune IA. L'essai crée son propre dossier (« derush-essai-projet-… », projets et dossier de Dérush
// d'essai) dans le dossier donné, ou dans le dossier temporaire du système, et n'efface que celui-là à la fin (il le
// garde si un essai échoue). Le dossier donné n'est jamais vidé.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

if (/^-/.test(process.argv[2] ?? '')) { console.log(`Usage : node ${path.relative(process.cwd(), process.argv[1])} [dossier temporaire]`); process.exit(0); }
const parent = path.resolve(process.argv[2] ?? os.tmpdir());
fs.mkdirSync(parent, {recursive: true});
const racine = fs.mkdtempSync(path.join(parent, 'derush-essai-projet-'));
process.env.DERUSH_SUPPORT = path.join(racine, 'support');
process.env.DERUSH_BIBLIOTHEQUE = path.join(racine, 'bibliotheque');

const {tc, lireTemps, versImage} = await import('../lib/commun.mjs');
const {Projet} = await import('../lib/projet.mjs');
const {lireRetours} = await import('../lib/retours.mjs');
const {listerProjets} = await import('../lib/bibliotheque.mjs');
const {CATALOGUE} = await import('../public/moteur.js');

let ok = 0;
let ko = 0;
const essai = (nom, bon, detail = '') => {
  if (bon) ok++; else ko++;
  console.log(`${bon ? '✓' : '✗'} ${nom}${bon || !detail ? '' : `\n   ${String(detail).slice(0, 600)}`}`);
};

console.log('— Les temps tapés à la main (champs de l’inspecteur) —');
for (const fps of [23.976, 25, 29.97, 30, 59.94]) {
  // aller-retour : ce que le champ affiche, relu tel quel, retombe sur la même image (jusqu'à 2 h de rush)
  let pire = 0;
  for (const s of [0, 1 / fps, 59.9, 60, 600, 3599.5, 3600, 7200]) {
    const image = versImage(s, fps);
    const relu = lireTemps(tc(s, fps), fps);
    pire = Math.max(pire, Math.abs(versImage(relu, fps) - image));
  }
  essai(`${fps} i/s : le timecode affiché, relu, donne la même image`, pire === 0, `écart de ${pire} image(s)`);
}
{
  // le cas du relecteur : un plan à 10:00 d'un rush à 29,97, avancé d'une image dans le champ
  const champ = tc(600, 29.97);
  const plusUne = `${champ.slice(0, -2)}${String(Number(champ.slice(-2)) + 1).padStart(2, '0')}`;
  const t = lireTemps(plusUne, 29.97);
  essai('29,97 i/s : une image de plus dans le champ = une image plus tard, pas 0,6 s plus tôt', champ === '00:09:59:12' && Math.abs(t - 600 - 1 / 29.97) < 1e-6, `${champ} → ${plusUne} → ${t}`);
}
essai('« 12,5 » et « 12.5 s » restent des secondes réelles', lireTemps('12,5', 29.97) === 12.5 && lireTemps('12.5 s', 29.97) === 12.5);
essai('« 372i » : des images', Math.abs(lireTemps('372i', 29.97) - 372 / 29.97) < 1e-9);
essai('« 1:30 » et « 00:01:30 » à 25 i/s : 90 s', lireTemps('1:30', 25) === 90 && lireTemps('00:01:30', 25) === 90);
essai('un numéro d’image impossible (30 à 29,97 i/s) est refusé', lireTemps('00:00:01:30', 29.97) === null && lireTemps('00:00:01:29', 29.97) !== null);
essai('un texte illisible est refusé', lireTemps('abc', 25) === null && lireTemps('', 25) === null && lireTemps('1::2', 25) === null);

console.log('— Un projet reçu : l’id d’un média sert de nom de dossier —');
{
  const dossier = path.join(racine, 'Projet reçu');
  const voisin = path.join(racine, 'Mes vidéos');
  fs.mkdirSync(voisin, {recursive: true});
  fs.writeFileSync(path.join(voisin, 'montage-final.mp4'), 'le film de la personne');
  fs.mkdirSync(dossier, {recursive: true});
  const base = {type: 'video', nom: 'a.mp4', chemin: path.join(racine, 'a.mp4'), duree: 10, etat: 'analyse', etapes: {}};
  fs.writeFileSync(path.join(dossier, 'derush.json'), JSON.stringify({titre: 'Reçu', medias: [
    {...base, id: '../../Mes vidéos'}, {...base, id: 'M1'}, {...base, id: 'M2/../../x'}, {...base, id: 3}, null, 'M4',
  ]}));
  const P = new Projet(dossier);
  essai('seuls les médias « M » + un nombre sont gardés', P.d.medias.map((m) => m.id).join() === 'M1', JSON.stringify(P.d.medias.map((m) => m.id)));
  essai('le média gardé reprend sa préparation', P.d.medias[0].etat === 'a reprendre');
  let refuse = false;
  try { P.dossierMedia('../../Mes vidéos'); } catch { refuse = true; }
  essai('dossierMedia refuse un id qui sort du projet', refuse && fs.readdirSync(voisin).join() === 'montage-final.mp4', fs.readdirSync(voisin).join());
  essai('dossierMedia donne bien le dossier d’un vrai média', P.dossierMedia('M1') === path.join(dossier, '.derush', 'medias', 'M1') && fs.existsSync(P.dossierMedia('M1')));
  fs.writeFileSync(path.join(dossier, 'derush.json'), JSON.stringify({titre: 'Abîmé', medias: 'pas un tableau'}));
  let ouvert = null;
  try { ouvert = new Projet(dossier); } catch (e) { ouvert = e; }
  essai('un projet dont les médias ne sont pas une liste s’ouvre quand même, vide', ouvert instanceof Projet && Array.isArray(ouvert.d.medias) && !ouvert.d.medias.length, String(ouvert));
}

console.log('— Ce que garde l’enregistrement (PUT /api/projet → appliquer) —');
{
  const dossier = path.join(racine, 'Projet étalonné');
  const P = new Projet(dossier);
  P.d.medias.push({id: 'M1', type: 'video', nom: 'a.mp4', chemin: path.join(racine, 'a.mp4'), duree: 10, audio: true, etat: 'pret', etapes: {}, clair: {cree_le: '2026-11-14T10:00:00Z', force: 'normal'}});
  P.d.medias.push({id: 'M2', type: 'audio', nom: 'voix.m4a', chemin: path.join(racine, 'voix.m4a'), duree: 10, audio: true, etat: 'pret', etapes: {}});
  P.sauver();
  // ce qu'envoie sauver() dans l'interface
  P.appliquer({
    montage: [
      {id: 'P1', type: 'plan', media: 'M1', entree: 0, sortie: 4, son: {actif: true, version: 'clair'}, couleur: {exposition: 30, saturation: -20, contraste: 0}},
      {id: 'P2', type: 'plan', media: 'M1', entree: 4, sortie: 6, son: {version: 'voix'}, couleur: {exposition: 0}},
      {id: 'P3', type: 'plan', media: 'M2', entree: 0, sortie: 2, couleur: {exposition: 40}},
      {id: 'P4', type: 'plan', media: 'M1', entree: 6, sortie: 8, son: {version: 'autre chose'}, couleur: {exposition: '<b>', temperature: 250}},
    ],
    superpositions: [{id: 'S1', media: 'M2', entree: 0, sortie: 3, debut: 1, voix_off: true, son: {actif: true, version: 'clair'}}],
  });
  const R = new Projet(dossier); // rouvert : ce qui est sur le disque
  const plan = (id) => R.d.montage.find((x) => x.id === id);
  essai('l’étalonnage d’un plan est gardé et relu à la réouverture', JSON.stringify(plan('P1')?.couleur) === JSON.stringify({exposition: 30, saturation: -20}), JSON.stringify(plan('P1')));
  essai('« Voix claire » sur un plan est gardée', plan('P1')?.son.version === 'clair', JSON.stringify(plan('P1')?.son));
  essai('« Voix claire » sur une voix off (par-dessus) est gardée', R.d.superpositions[0]?.son.version === 'clair' && R.d.superpositions[0]?.voix_off === true, JSON.stringify(R.d.superpositions[0]));
  essai('« Voix seule » reste gardée, un étalonnage nul n’est pas écrit', plan('P2')?.son.version === 'voix' && !('couleur' in plan('P2')), JSON.stringify(plan('P2')));
  essai('un plan de son n’a pas d’étalonnage', plan('P3') && !('couleur' in plan('P3')), JSON.stringify(plan('P3')));
  essai('une version inconnue revient à « original », un réglage hors bornes est ramené à 100', plan('P4')?.son.version === 'original' && JSON.stringify(plan('P4')?.couleur) === JSON.stringify({temperature: 100}), JSON.stringify(plan('P4')));
  const disque = JSON.parse(fs.readFileSync(path.join(dossier, 'derush.json'), 'utf8'));
  essai('un projet propre est relu tel quel (rien de renuméroté, rien de retiré)', ['montage', 'superpositions', 'indications', 'references', 'style'].every((k) => JSON.stringify(R.d[k]) === JSON.stringify(disque[k])), JSON.stringify({relu: R.d.montage.map((x) => x.id), disque: disque.montage.map((x) => x.id)}));
  // (ici les médias ont été ajoutés à la main, sans nouvelId : les compteurs relus rattrapent les ids déjà pris)
  essai('des compteurs en retard sur les ids sont rattrapés', R.d.compteurs.M === 2 && R.d.compteurs.P === 4 && R.d.compteurs.S === 1, JSON.stringify(R.d.compteurs));
  // l'interface a donné P5 et P6 (compteur à 6) ; un id illisible devient un id neuf, jamais P5 ni P6
  R.appliquer({compteurs: {P: 6}, montage: [
    {id: 'P5', type: 'plan', media: 'M1', entree: 0, sortie: 1},
    {id: '"><img src=x onerror=alert(1)>', type: 'plan', media: 'M1', entree: 1, sortie: 2},
    {id: 'P6', type: 'plan', media: 'M1', entree: 2, sortie: 3},
  ], indications: [{id: 'I1', modele: 'constructor', debut: 0, fin: 1}]});
  const ids = R.d.montage.map((x) => x.id);
  essai('à l’enregistrement, un id illisible devient un id neuf (pas un id déjà donné par l’interface)', ids.join() === 'P5,P7,P6' && R.d.compteurs.P === 7, JSON.stringify({ids, c: R.d.compteurs}));
  essai('à l’enregistrement, un effet « constructor » ne fait pas tomber le serveur : c’est une note', R.d.indications[0]?.genre === 'note' && !('modele' in R.d.indications[0]), JSON.stringify(R.d.indications));
  R.appliquer({compteurs: {P: 1e12, B: 'beaucoup'}});
  essai('un compteur démesuré ou illisible envoyé par l’interface est ignoré', R.d.compteurs.P === 7 && R.d.compteurs.B === 0, JSON.stringify(R.d.compteurs));
}

console.log('— Un projet reçu : les ids et les nombres lus dans derush.json —');
{
  const dossier = path.join(racine, 'Projet piégé');
  fs.mkdirSync(dossier, {recursive: true});
  const piege = '"><img src=x onerror=alert(1)>';
  const titre = Object.keys(CATALOGUE).find((k) => CATALOGUE[k].categorie === 'titre');
  const media = (id, autres) => ({id, type: 'video', nom: `${id}.mp4`, chemin: path.join(racine, `${id}.mp4`), duree: 10, largeur: 1920, hauteur: 1080, fps: 25, etat: 'pret', etapes: {}, ...autres});
  fs.writeFileSync(path.join(dossier, 'derush.json'), JSON.stringify({
    titre: 'Piégé', espace: 'moi',
    compteurs: {M: 'abc', P: -3, B: 1e12, I: 2, S: 0},
    medias: [
      media('M1', {duree: '12', largeur: piege, fps: 'trente', transcription: {mots: piege}, vignettes: {n: 10, l: 71, h: 40, pas: 1.2, v: piege, provisoire: 'oui', html: piege}}),
      media('M5', {transcription: {mots: 42}, vignettes: {n: 5, l: piege, h: 40, pas: 2}}),
      media('M6', {duree: 'longue'}),
    ],
    montage: [
      {id: 'P2', type: 'plan', media: 'M1', entree: 0, sortie: 4},
      {id: piege, type: 'plan', media: 'M5', entree: 0, sortie: 3},
      {id: 'B3', type: 'bloc', genre: 'constructor', duree: 2},
      {id: 'P9', type: 'plan', media: 'M77', entree: 0, sortie: 2},
      {id: 'P10', type: 'plan', media: 'M6', entree: 0, sortie: 2},
      'pas une case',
    ],
    indications: [
      {id: 'I1', genre: 'note', debut: 1, fin: 2, consigne: 'Garder.'},
      {id: `I2${piege}`, modele: titre, debut: 0, fin: 1, ancre: {id: piege, d: 0.5}},
      {id: 'I3', modele: 'constructor', debut: 0, fin: 1},
      {id: 'I4', modele: titre, debut: 0, fin: 1, ancre: {id: '../../x', d: 'Infinity'}},
      null,
    ],
    superpositions: [{id: piege, media: 'M5', entree: 0, sortie: 2, debut: 1}],
    references: [
      {id: 'R1', nom: 'logo.png', chemin: path.join(racine, 'logo.png'), cible: null, taille: 10},
      {id: piege, nom: '../../../.zshrc', chemin: path.join(racine, 'ambiance.jpg'), cible: piege, taille: piege},
      {id: 'R4', nom: 'a.png', chemin: path.join(racine, 'a.png'), cible: '../../dehors'},
      {id: 'R5', nom: 'b.png', chemin: 'relatif/b.png', cible: null},
      {id: 'R6', nom: 'c.png', chemin: path.join(racine, 'c.png'), cible: 'B99'},
    ],
    style: {accent: piege, grain: 0.5},
    serie: {id: 's1', nom: 'Chroniques', espace: 'client-parti'},
  }));
  const avertir = console.warn;
  const avis = [];
  console.warn = (...a) => avis.push(a.join(' '));
  let P;
  try { P = new Projet(dossier); } finally { console.warn = avertir; }
  const d = P.d;
  const m = (id) => d.medias.find((x) => x.id === id);
  essai('les nombres d’un média sont des nombres, ou rien', m('M1').duree === 12 && m('M1').largeur === null && m('M1').hauteur === 1080 && m('M1').fps === null && m('M1').transcription.mots === 0 && m('M5').transcription.mots === 42, JSON.stringify(m('M1')));
  essai('les vignettes : seulement n, l, h, pas (des nombres), « v » court et sans signe', JSON.stringify(m('M1').vignettes) === JSON.stringify({n: 10, pas: 1.2, l: 71, h: 40}) && m('M5').vignettes === null, JSON.stringify([m('M1').vignettes, m('M5').vignettes]));
  essai('un média sans durée lisible perd sa durée, et ses plans', !('duree' in m('M6')) && !d.montage.some((x) => x.media === 'M6'), JSON.stringify(m('M6')));
  essai('les compteurs sont des entiers, jamais sous un id déjà pris', d.compteurs.M === 6 && d.compteurs.B === 3 && d.compteurs.I >= 4 && d.compteurs.R >= 6 && d.compteurs.P >= 10, JSON.stringify(d.compteurs));
  const ids = d.montage.map((x) => x.id);
  essai('le montage : des ids « P »/« B » + un nombre, tous différents ; une case dont le rush est parti s’en va', ids.length === 3 && ids.every((x) => /^[PB]\d{1,9}$/.test(x)) && new Set(ids).size === 3 && ids[0] === 'P2' && ids[2] === 'B3' && !['P2', 'P9', 'P10'].includes(ids[1]), JSON.stringify(ids));
  const nouveau = ids[1];
  essai('une case à créer d’un genre « constructor » devient « autre »', d.montage[2].genre === 'autre', JSON.stringify(d.montage[2]));
  const ind = d.indications;
  essai('les indications : des ids « I » + un nombre', ind.length === 4 && ind.every((x) => /^I\d{1,9}$/.test(x.id)) && new Set(ind.map((x) => x.id)).size === 4 && ind[0].id === 'I1' && ind[0].consigne === 'Garder.', JSON.stringify(ind.map((x) => x.id)));
  essai('un effet accroché à une case renumérotée la suit', ind[1].modele === titre && ind[1].ancre?.id === nouveau && ind[1].ancre.d === 0.5, JSON.stringify(ind[1]));
  essai('un effet « constructor » devient une note ; une ancre illisible est retirée', ind[2].genre === 'note' && !('modele' in ind[2]) && ind[3].modele === titre && !('ancre' in ind[3]), JSON.stringify([ind[2], ind[3]]));
  essai('les plans par-dessus : des ids « S » + un nombre', d.superpositions.length === 1 && /^S\d{1,9}$/.test(d.superpositions[0].id), JSON.stringify(d.superpositions));
  const refs = d.references;
  const ref = (nom) => refs.find((r) => r.chemin === path.join(racine, nom));
  essai('les fichiers pour l’IA : des ids « R » + un nombre, un nom seul (jamais un chemin), une case qui existe ou aucune', refs.length === 3 && refs.every((r) => /^R\d{1,9}$/.test(r.id)) && ref('logo.png')?.cible === null && ref('ambiance.jpg')?.nom === 'ambiance.jpg' && ref('ambiance.jpg')?.cible === nouveau && ref('ambiance.jpg')?.taille === null, JSON.stringify(refs));
  essai('une cible illisible ou un chemin relatif sont écartés ; les fichiers d’une case retirée restent à part', !ref('a.png') && !refs.some((r) => r.nom === 'b.png') && ref('c.png')?.cible === 'B99', JSON.stringify(refs.map((r) => [r.nom, r.cible])));
  essai('le style ne garde que des valeurs connues', !('accent' in d.style) && d.style.grain === 0.5, JSON.stringify(d.style));
  essai('la série d’un autre espace est oubliée', d.serie === null, JSON.stringify(d.serie));
  const tout = JSON.stringify({medias: d.medias, montage: d.montage, indications: d.indications, superpositions: d.superpositions, references: d.references, style: d.style, compteurs: d.compteurs});
  essai('plus aucune balise ne reste dans ce que l’interface et le pack reçoivent', !tout.includes('<img') && !tout.includes('"><'), tout.slice(0, 300));
  essai('chaque id remplacé est noté dans le journal', avis.length === 4 && avis.every((a) => a.includes('identifiant illisible')), JSON.stringify(avis));
  P.sauver();
  const avant = JSON.stringify([d.montage, d.indications, d.superpositions, d.references, d.compteurs]);
  const R = new Projet(dossier);
  essai('rouvert, le projet nettoyé reste le même (rien n’est renuméroté deux fois)', JSON.stringify([R.d.montage, R.d.indications, R.d.superpositions, R.d.references, R.d.compteurs]) === avant);
  let refuse = '';
  fs.writeFileSync(path.join(dossier, 'derush.json'), JSON.stringify({titre: 'Pire', medias: [media('M1')], montage: 'texte', indications: {a: 1}, superpositions: 7, references: 'non', compteurs: 'n', style: 'x', serie: 'y'}));
  try { new Projet(dossier); } catch (e) { refuse = e.message; }
  essai('un projet dont les listes ne sont pas des listes s’ouvre quand même', !refuse, refuse);
}

console.log('— Un projet mis à la corbeille pendant une tâche : rien ne renaît —');
{
  const dossier = path.join(racine, 'Projet jeté');
  const P = new Projet(dossier);
  P.d.medias.push({id: 'M1', type: 'video', nom: 'a.mp4', chemin: path.join(racine, 'a.mp4'), duree: 10, etat: 'pret', etapes: {}});
  P.sauver();
  fs.rmSync(dossier, {recursive: true, force: true});
  P.d.titre = 'Changé après coup';
  P.sauver();
  essai('enregistrer un projet disparu ne recrée rien', !fs.existsSync(dossier));
  let message = '';
  try { P.dossierMedia('M1'); } catch (e) { message = e.message; }
  essai('le cache d’un média d’un projet disparu n’est pas recréé', message === 'Le projet a été déplacé ou mis à la corbeille.' && !fs.existsSync(dossier), message);
}

console.log('— Pour qui : une série reste dans son espace —');
{
  const dossier = path.join(racine, 'Épisode');
  const P = new Projet(dossier);
  P.d.serie = {id: 's1', nom: 'Chroniques', espace: 'moi'};
  P.appliquer({espace: 'moi'});
  essai('rester dans le même espace garde la série', P.d.serie?.nom === 'Chroniques');
  P.appliquer({espace: 'neutre'});
  essai('passer à un autre espace : le projet n’est plus un épisode', P.d.espace === 'neutre' && P.d.serie === null, JSON.stringify(P.d.serie));
  // depuis la bibliothèque, projet fermé : derush.json est changé à part (espace seul)
  const biblio = path.join(racine, 'bibliotheque');
  const ferme = path.join(biblio, 'Épisode fermé');
  fs.mkdirSync(ferme, {recursive: true});
  fs.writeFileSync(path.join(ferme, 'derush.json'), JSON.stringify({titre: 'Épisode fermé', espace: 'neutre', medias: [], montage: [], serie: {id: 's1', nom: 'Chroniques', espace: 'moi'}}));
  const garde = path.join(biblio, 'Épisode gardé');
  fs.mkdirSync(garde, {recursive: true});
  fs.writeFileSync(path.join(garde, 'derush.json'), JSON.stringify({titre: 'Épisode gardé', medias: [], montage: [], serie: {id: 's1', nom: 'Chroniques', espace: 'moi'}}));
  const abime = path.join(biblio, 'Abîmé');
  fs.mkdirSync(abime, {recursive: true});
  fs.writeFileSync(path.join(abime, 'derush.json'), JSON.stringify({titre: 'Abîmé', montage: 'texte', medias: 3}));
  let liste = [];
  let erreur = '';
  try { liste = listerProjets(); } catch (e) { erreur = e.message; }
  const carte = (t) => liste.find((x) => x.titre === t);
  essai('la bibliothèque n’affiche pas « Épisode de … » sur un projet passé à un autre espace', carte('Épisode fermé')?.serie === null && carte('Épisode gardé')?.serie === 'Chroniques', JSON.stringify(liste.map((x) => [x.titre, x.espace, x.serie])));
  essai('un projet abîmé ne fait pas tomber la bibliothèque', !erreur && carte('Abîmé')?.plans === 0, erreur);
  essai('rouvert, le projet passé à un autre espace oublie sa série', new Projet(ferme).d.serie === null);
}

console.log('— Les propositions de l’IA (retours-ia.json) : lues comme des données —');
{
  const dossier = path.join(racine, 'Projet avec retours');
  const P = new Projet(dossier);
  const pack = path.join(dossier, 'exports', 'pack-1');
  fs.mkdirSync(pack, {recursive: true});
  const piege = '50"><img src=x onerror=alert(1)>';
  fs.writeFileSync(path.join(pack, 'retours-ia.json'), JSON.stringify({auteur: 'Codex', message: 'Trois idées.', date: '2026-11-14T10:00:00Z', propositions: [
    {id: 'R1', type: 'effet', modele: 'titre-derriere', debut_s: 3.7, fin_s: 6.5, reglages: {texte: 'Abonne-toi', hauteur: piege, couleur: 'rouge"><b>', son: 'oui', inconnu: 'x'}, html: '<script>'},
    {id: 'R2', type: 'effet', modele: 'n-existe-pas', debut_s: 1},
    {id: 'R3', type: 'rogner', cible: '"><img src=x>', entree_s: 1, sortie_s: 2},
    {id: 'R4', type: 'rogner', cible: 'P3', entree_s: 'douze', sortie_s: 15},
    {id: 'R5', type: 'rogner', cible: 'P3', entree_s: 12.4, sortie_s: 15, pourquoi: 'La phrase finit à 15 s.'},
    {id: 'R6', type: 'style', style: {accent: 'red"><b>', grain: 0.3, look: 'pas-un-look', sous_titres: {majuscules: true, position: 'nulle-part'}}},
    {id: 'R7', type: 'style', style: {accent: 'pas une couleur'}},
    {id: 'R8', type: 'indication', debut_s: 3, fin_s: 5, genre: '<b>', consigne: 'Nom à l’écran.'},
    {id: 'R9', type: 'question', cible: 'B2', texte: 'Quelle ambiance ?'},
    {id: 'R10', type: 'supprimer'},
    {id: 'R11', type: 'publier', cible: 'P1'},
    {id: 'R12', type: 'deplacer', cible: 'B1', position: 0},
  ]}));
  const L = lireRetours(P);
  const r = (id) => L.find((x) => x.id === id);
  essai('un réglage d’effet piégé (texte dans un nombre, choix inconnu) est écarté', r('R1') && !('hauteur' in r('R1').reglages) && !('couleur' in r('R1').reglages) && !('son' in r('R1').reglages) && !('inconnu' in r('R1').reglages) && r('R1').reglages.texte === 'Abonne-toi', JSON.stringify(r('R1')));
  essai('un champ que Dérush ne connaît pas n’arrive pas à l’interface', r('R1') && !('html' in r('R1')), JSON.stringify(r('R1')));
  essai('un effet hors du catalogue est écarté', !r('R2'));
  essai('une cible illisible est écartée', !r('R3'));
  essai('un temps qui n’est pas un nombre est écarté', !r('R4'));
  essai('une proposition propre arrive entière', r('R5')?.entree_s === 12.4 && r('R5')?.sortie_s === 15 && r('R5')?.cible === 'P3' && r('R5')?.pourquoi === 'La phrase finit à 15 s.' && r('R5')?.auteur === 'Codex' && r('R5')?.etat === 'nouveau' && r('R5')?.cle === `${path.join('exports', 'pack-1', 'retours-ia.json')}#R5`, JSON.stringify(r('R5')));
  const st = r('R6')?.style ?? {};
  essai('le style ne garde que les réglages permis, et seulement ceux donnés', Object.keys(st).sort().join() === 'grain,sous_titres' && st.grain === 0.3 && JSON.stringify(st.sous_titres) === JSON.stringify({majuscules: true}), JSON.stringify(r('R6')));
  essai('un style sans aucun réglage permis est écarté', !r('R7'));
  essai('un genre d’indication inconnu devient une note', r('R8')?.genre === 'note' && r('R8')?.consigne === 'Nom à l’écran.' && r('R8')?.debut_s === 3, JSON.stringify(r('R8')));
  essai('une question garde sa cible et son texte', r('R9')?.cible === 'B2' && r('R9')?.texte === 'Quelle ambiance ?');
  essai('supprimer sans cible, ou un type inconnu, sont écartés', !r('R10') && !r('R11'));
  essai('déplacer à la position 0 est gardé', r('R12')?.position === 0, JSON.stringify(r('R12')));
}

// seul le dossier que cet essai a créé est effacé, et gardé si un essai a échoué (pour regarder)
if (!ko) fs.rmSync(racine, {recursive: true, force: true});
console.log(`\n${ok} essais réussis sur ${ok + ko}.`);
if (ko) console.log(`Dossier d’essai gardé : ${racine}`);
process.exit(ko ? 1 : 0);
