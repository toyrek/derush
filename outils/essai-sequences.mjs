// Dérush — essais des vidéos d'un projet (lib/sequences.mjs), pour qui modifie Dérush : un projet d'avant (une seule
// vidéo, ouverte telle quelle), ajouter une vidéo (vide ou copiée), passer de l'une à l'autre sans rien perdre ni
// mélanger, renommer, changer l'ordre, supprimer (jamais la dernière), un enregistrement arrivé après un changement de
// vidéo, le pack de la vidéo ouverte, « Créer toutes les vidéos » (rendu par un faux Remotion qui fabrique la vidéo
// avec FFmpeg), et les vidéos livrées par l'IA devenues des vidéos du projet (avec un faux dossier de travail).
//   node outils/essai-sequences.mjs [dossier où créer le dossier d'essai]
// Aucun réseau, aucune IA. L'essai crée son propre dossier (« derush-essai-sequences-… » : dossier de Dérush,
// bibliothèque, dossier temporaire) dans le dossier donné, ou dans le dossier temporaire du système, et n'efface que
// celui-là à la fin (il le garde si un essai échoue).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {execFileSync} from 'node:child_process';
import {register} from 'node:module';

if (/^-/.test(process.argv[2] ?? '')) { console.log(`Usage : node ${path.relative(process.cwd(), process.argv[1])} [dossier temporaire]`); process.exit(0); }
const parent = path.resolve(process.argv[2] ?? os.tmpdir());
fs.mkdirSync(parent, {recursive: true});
const T = fs.mkdtempSync(path.join(parent, 'derush-essai-sequences-'));
// AVANT tout import de lib/ : ces dossiers sont lus une seule fois, au chargement
const SUPPORT = path.join(T, 'support');
const BIBLIO = path.join(T, 'bibliotheque');
for (const d of [SUPPORT, BIBLIO, path.join(T, 'tmp'), path.join(T, 'sons')]) fs.mkdirSync(d, {recursive: true});
process.env.DERUSH_SUPPORT = SUPPORT;
process.env.DERUSH_BIBLIOTHEQUE = BIBLIO;
process.env.DERUSH_SONS = path.join(T, 'sons');
process.env.DERUSH_SANS_MAJ = '1';
process.env.DERUSH_SANS_NAVIGATEUR = '1';
process.env.TMPDIR = path.join(T, 'tmp');
for (const k of ['TREG_TOKEN', 'ELEVENLABS_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY']) delete process.env[k];

// La place sur le disque est lue pour de faux (FAUX_PLACE, en octets ; 50 Go par défaut) : « Créer la vidéo » refuse sous
// 1,5 Go, et l'essai ne doit dépendre ni du disque de l'ordinateur ni de ce qui s'y trouve (il n'y écrit que quelques Mo).
const disqueVrai = new URL('../lib/disque.mjs', import.meta.url).href;
const disqueFaux = `data:text/javascript,${encodeURIComponent(`export * from ${JSON.stringify(`${disqueVrai}?vrai`)};
import {verifierPlace as vraie} from ${JSON.stringify(`${disqueVrai}?vrai`)};
export function verifierPlace(dossier, o = {}) { return vraie(dossier, {...o, lire: () => Number(process.env.FAUX_PLACE ?? 50 * 1024 ** 3)}); }`)}`;
register(`data:text/javascript,${encodeURIComponent(`export async function resolve(s, c, suite) {
  const r = await suite(s, c);
  return r.url === ${JSON.stringify(disqueVrai)} ? {url: ${JSON.stringify(disqueFaux)}, shortCircuit: true} : r;
}`)}`);

const {Projet} = await import('../lib/projet.mjs');
const S = await import('../lib/sequences.mjs');
const {exporterPack} = await import('../lib/pack.mjs');
const {dossierMoteurRendu} = await import('../lib/rendu.mjs');
const M = await import('../lib/medias.mjs');
const {FFMPEG, FileDAttente} = await import('../lib/outils.mjs');
const {tableIA, etatDemande} = await import('../lib/claude.mjs');
const KIT = JSON.parse(fs.readFileSync(new URL('../modeles/kit-remotion/package.json', import.meta.url), 'utf8'));

let ok = 0;
let ko = 0;
const essai = (nom, bon, detail = '') => {
  if (bon) ok++; else ko++;
  console.log(`${bon ? '✓' : '✗'} ${nom}${bon || !detail ? '' : `\n   ${String(detail).slice(0, 600)}`}`);
};
const leve = (fn) => { try { fn(); return null; } catch (e) { return e; } };
const ids = (l) => (l ?? []).map((x) => x.id).join(',');
const json = (x) => JSON.stringify(x);

// ——— des médias d'essai, fabriqués par FFmpeg ———
const MEDIAS = path.join(T, 'rushes');
fs.mkdirSync(MEDIAS, {recursive: true});
const fabriquer = (nom, l, h, duree) => {
  const f = path.join(MEDIAS, nom);
  execFileSync(FFMPEG, ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${l}x${h}:rate=30:duration=${duree}`, '-f', 'lavfi', '-i', `sine=frequency=330:duration=${duree}`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', f]);
  return f;
};
const paysage = fabriquer('paysage.mp4', 640, 360, 6);
const portrait = fabriquer('portrait.mp4', 360, 640, 4);
const media = async (id, chemin) => ({...(await M.sonder(chemin)), id, nom: path.basename(chemin), chemin, etapes: {}, etat: 'pret', ajoute_le: new Date().toISOString()});
const M1 = await media('M1', paysage);
const M2 = await media('M2', portrait);
const plan = (id, med, entree, sortie, extra = {}) => ({id, type: 'plan', media: med, entree, sortie, titre: '', notes: '', tags: [], son: {actif: true, gain_db: 0, version: 'original', avant_s: 0, apres_s: 0}, ...extra});

console.log('— Un projet d’avant : une seule vidéo, ouverte telle quelle —');
const dossierAncien = path.join(BIBLIO, 'Ancien');
{
  fs.mkdirSync(dossierAncien, {recursive: true});
  const montage = [plan('P1', 'M1', 0, 2), plan('P2', 'M1', 3, 5.5)];
  const indications = [{id: 'I1', genre: 'texte', debut: 0, fin: 1, consigne: '', modele: 'titre', reglages: {texte: 'BONJOUR'}, ancre: {id: 'P1', d: 0}}];
  fs.writeFileSync(path.join(dossierAncien, 'derush.json'), json({format: 'derush', version: 1, titre: 'Ancien', medias: [M1, M2], montage, indications, superpositions: [],
    sortie: {preset: 'horizontal', largeur: 1920, hauteur: 1080, fps: 30}, compteurs: {M: 2, P: 2, I: 1}}));
  const avant = fs.readFileSync(path.join(dossierAncien, 'derush.json'), 'utf8');
  const P = new Projet(dossierAncien);
  essai('il a une seule vidéo, « Vidéo 1 », ouverte', P.d.sequences.length === 1 && P.d.sequences[0].nom === 'Vidéo 1' && P.d.sequence === P.d.sequences[0].id, json(P.d.sequences));
  essai('son montage et ses effets sont ceux d’avant', ids(P.d.montage) === 'P1,P2' && P.d.montage[1].sortie === 5.5 && P.d.indications[0].ancre?.id === 'P1' && P.d.sortie.preset === 'horizontal', json(P.d.montage));
  essai('l’entrée de la vidéo ouverte ne porte que son nom', !('montage' in P.d.sequences[0]) && !('sortie' in P.d.sequences[0]));
  essai('l’ouvrir ne réécrit pas le fichier', fs.readFileSync(path.join(dossierAncien, 'derush.json'), 'utf8') === avant);
  const L = S.listerSequences(P);
  essai('la liste dit 2 plans, 4,5 s, au format horizontal', L.length === 1 && L[0].plans === 2 && Math.abs(L[0].duree_s - 4.5) < 0.05 && L[0].format.preset === 'horizontal' && L[0].ouverte, json(L));
}

console.log('— Ajouter, passer de l’une à l’autre : rien de perdu, rien de mélangé —');
{
  const P = new Projet(dossierAncien);
  const V1 = P.d.sequence;
  const avantV1 = json({m: P.d.montage, i: P.d.indications, s: P.d.sortie});
  const V2 = S.ajouterSequence(P, {}).id;
  essai('une vidéo vide s’ajoute, « Vidéo 2 », et s’ouvre', P.d.sequence === V2 && P.d.sequences[1].nom === 'Vidéo 2' && !P.d.montage.length && !P.d.indications.length, json(P.d.sequences.map((s) => s.nom)));
  essai('elle prend le format de la vidéo d’avant', P.d.sortie.preset === 'horizontal' && P.d.sortie.largeur === 1920);
  essai('la vidéo 1 est rangée avec son montage', json({m: P.d.sequences[0].montage, i: P.d.sequences[0].indications, s: P.d.sequences[0].sortie}) === avantV1);
  // ce que l'interface enregistre pour la vidéo 2
  P.appliquer({sequence: V2, montage: [plan('P3', 'M2', 0, 1.5)], superpositions: [{id: 'S1', media: 'M1', entree: 0, sortie: 1, debut: 0.2}], sortie: {preset: 'vertical'}, compteurs: {P: 3, S: 1}});
  const avantV2 = json({m: P.d.montage, sup: P.d.superpositions, s: P.d.sortie});
  S.activerSequence(P, V1);
  essai('revenir à la vidéo 1 la remet telle qu’elle était', json({m: P.d.montage, i: P.d.indications, s: P.d.sortie}) === avantV1, json(P.d.montage));
  essai('la vidéo 2 est rangée avec son montage, ses plans par-dessus et son format', json({m: P.d.sequences[1].montage, sup: P.d.sequences[1].superpositions, s: P.d.sequences[1].sortie}) === avantV2);
  const R = new Projet(dossierAncien);
  essai('relu sur le disque : la vidéo 1 ouverte, la 2 rangée', R.d.sequence === V1 && ids(R.d.montage) === 'P1,P2' && ids(R.d.sequences[1].montage) === 'P3' && R.d.sequences[1].sortie.preset === 'vertical', json(R.d.sequences));
  for (let k = 0; k < 3; k++) { S.activerSequence(R, V2); S.activerSequence(R, V1); }
  essai('six allers-retours : chaque vidéo garde exactement son contenu', json({m: R.d.montage, i: R.d.indications, s: R.d.sortie}) === avantV1 && json({m: R.d.sequences[1].montage, sup: R.d.sequences[1].superpositions, s: R.d.sequences[1].sortie}) === avantV2);
  S.activerSequence(R, V2);
  const tous = [...R.d.montage, ...R.d.sequences[0].montage].map((x) => x.id);
  essai('aucun id n’est partagé entre deux vidéos', new Set(tous).size === tous.length, tous.join());
  essai('les médias restent communs, et ceux de la vidéo rangée comptent comme utilisés', R.d.medias.length === 2 && S.mediasUtilises(R).has('M1') && S.mediasUtilises(R).has('M2'));

  console.log('— Un enregistrement de l’interface arrivé après le changement de vidéo —');
  const r1 = R.appliquer({sequence: V1, titre: 'Ancien (renommé)', montage: [], indications: [], sortie: {preset: 'carre'}});
  essai('il ne touche pas au montage ni au format de la vidéo ouverte', r1.sequence_ignoree === true && ids(R.d.montage) === 'P3' && R.d.sortie.preset === 'vertical', json(r1));
  essai('ce qui vaut pour tout le projet (le titre) passe quand même', R.d.titre === 'Ancien (renommé)');
  const r2 = R.appliquer({sequence: V2, montage: [plan('P3', 'M2', 0, 1.2)]});
  essai('celui de la vidéo ouverte passe', r2.sequence_ignoree === false && R.d.montage[0].sortie === 1.2);
  const r3 = R.appliquer({montage: [plan('P3', 'M2', 0, 1.4)]});
  essai('une interface d’avant (sans « sequence ») enregistre la vidéo ouverte, comme avant', r3.sequence_ignoree === false && R.d.montage[0].sortie === 1.4);
}

console.log('— Copier, renommer, changer l’ordre, supprimer —');
{
  const P = new Projet(dossierAncien);
  const [V1, V2] = P.d.sequences.map((s) => s.id);
  // une case à créer avec un fichier pour l'IA, dans la vidéo 1
  S.activerSequence(P, V1);
  P.appliquer({sequence: V1, montage: [...P.d.montage, {id: 'B1', type: 'bloc', genre: 'animation', duree: 2, titre: 'Carte', consigne: 'Une carte du Japon'}], compteurs: {B: 1}});
  P.d.references.push({id: 'R1', nom: 'carte.png', chemin: path.join(T, 'carte.png'), cible: 'B1'});
  P.sauver();
  const copie = S.ajouterSequence(P, {copier: true});
  essai('la copie se range juste après l’original et s’ouvre', P.d.sequences[1].id === copie.id && P.d.sequence === copie.id && copie.nom === 'Vidéo 1 (copie)', json(P.d.sequences.map((s) => s.nom)));
  essai('elle a les mêmes plans, avec des ids neufs', P.d.montage.length === 3 && P.d.montage.every((x) => !['P1', 'P2', 'B1'].includes(x.id)) && P.d.montage[1].entree === 3, json(P.d.montage));
  essai('son effet suit le plan copié', P.d.indications.length === 1 && P.d.indications[0].ancre?.id === P.d.montage[0].id && P.d.indications[0].id !== 'I1', json(P.d.indications));
  const caseCopiee = P.d.montage.find((x) => x.type === 'bloc').id;
  essai('le fichier donné pour la case suit la case copiée', P.d.references.some((r) => r.cible === caseCopiee) && P.d.references.some((r) => r.cible === 'B1'), json(P.d.references));
  essai('l’original n’a pas bougé', ids(P.d.sequences[0].montage) === 'P1,P2,B1');
  S.renommerSequence(P, V2, '  TikTok\n  1 ');
  essai('renommer : un nom d’une ligne', P.d.sequences.find((s) => s.id === V2).nom === 'TikTok 1');
  essai('un nom vide est refusé', leve(() => S.renommerSequence(P, V2, '   '))?.statut === 400);
  S.ordonnerSequences(P, [V2, 'V999', copie.id]);
  essai('l’ordre : les ids donnés d’abord, les autres à la suite', ids(P.d.sequences) === `${V2},${copie.id},${V1}`, ids(P.d.sequences));
  essai('un ordre qui n’est pas une liste est refusé', leve(() => S.ordonnerSequences(P, 'V1'))?.statut === 400);
  // supprimer la vidéo ouverte (la copie, 2e de la liste) : sa voisine suivante s'ouvre
  S.supprimerSequence(P, copie.id);
  essai('supprimer la vidéo ouverte ouvre sa voisine, avec son contenu', P.d.sequence === V1 && ids(P.d.montage) === 'P1,P2,B1' && P.d.sequences.length === 2, `${P.d.sequence} ${ids(P.d.montage)}`);
  essai('le contenu supprimé est gardé à part, au cas où', fs.readdirSync(path.join(P.cache, 'videos-supprimees')).some((f) => f.startsWith(copie.id)));
  S.supprimerSequence(P, V2);
  essai('la dernière vidéo ne se supprime jamais', leve(() => S.supprimerSequence(P, V1))?.statut === 400 && P.d.sequences.length === 1);
  essai('une vidéo inconnue : 404', leve(() => S.activerSequence(P, 'V404'))?.statut === 404);
  const R = new Projet(dossierAncien);
  essai('relu : une seule vidéo, la 1, intacte', R.d.sequences.length === 1 && R.d.sequence === V1 && ids(R.d.montage) === 'P1,P2,B1');
}

console.log('— Un projet reçu ou abîmé —');
{
  const dossier = path.join(BIBLIO, 'Abîmé');
  fs.mkdirSync(dossier, {recursive: true});
  fs.writeFileSync(path.join(dossier, 'derush.json'), json({titre: 'Abîmé', medias: [M1, M2], compteurs: {P: 0, V: 0}, sequence: 'V7',
    montage: [plan('P1', 'M1', 0, 1)],
    sequences: [{id: 'V2', nom: 'Rangée', montage: [plan('P9', 'M1', 0, 1), plan('P10', 'M404', 0, 1), plan('"><img>', 'M2', 0, 1)], sortie: {preset: 'inconnu', fps: 1000}},
      {id: 'V2', nom: 'Doublon'}, null, 'V3']}));
  let P = null;
  const avertir = console.warn;
  console.warn = () => {};
  try { P = new Projet(dossier); } finally { console.warn = avertir; }
  essai('la timeline d’une vidéo ouverte disparue devient une vidéo de plus : rien n’est perdu', ids(P.d.montage) === 'P1' && P.d.sequences.length === 3 && P.d.sequence === P.d.sequences[0].id, json(P.d.sequences.map((s) => [s.id, s.nom])));
  const rangee = P.d.sequences.find((s) => s.nom === 'Rangée');
  essai('une vidéo rangée passe par les mêmes nettoyeurs (rush inconnu retiré, id illisible renuméroté)', rangee.montage.length === 2 && rangee.montage[0].id === 'P9' && /^P\d+$/.test(rangee.montage[1].id) && rangee.montage[1].id !== 'P9', json(rangee.montage));
  essai('son format illisible prend celui de la vidéo ouverte', rangee.sortie.preset === P.d.sortie.preset && rangee.sortie.fps === P.d.sortie.fps);
  essai('deux vidéos du même id : la seconde est renumérotée', new Set(P.d.sequences.map((s) => s.id)).size === 3);
  essai('les compteurs ne redonnent jamais un id déjà pris dans une vidéo rangée', P.d.compteurs.P >= 10 && P.d.compteurs.V >= 3, json(P.d.compteurs));
}

console.log('— Le pack donné à l’IA porte la vidéo ouverte —');
const dossierPack = path.join(BIBLIO, 'Japon');
let PJ = null;
{
  PJ = new Projet(dossierPack);
  PJ.d.medias.push(structuredClone(M1), structuredClone(M2));
  PJ.d.compteurs.M = 2;
  PJ.sauver();
  PJ.appliquer({sequence: PJ.d.sequence, montage: [plan('P1', 'M1', 0, 2), plan('P2', 'M1', 2, 3)], sortie: {preset: 'vertical'}, compteurs: {P: 2}});
  S.renommerSequence(PJ, PJ.d.sequence, 'Vendredi à Tokyo');
  S.ajouterSequence(PJ, {nom: 'Teaser'});
  PJ.appliquer({sequence: PJ.d.sequence, montage: [plan('P3', 'M2', 0, 1)], sortie: {preset: 'horizontal'}, compteurs: {P: 3}});
  const pack = await exporterPack(PJ, () => {}, {leger: true, dossier: path.join(T, 'pack-teaser')});
  const MJ = JSON.parse(fs.readFileSync(path.join(pack.dossier, 'montage.json'), 'utf8'));
  essai('montage.json : les plans de la vidéo ouverte, et seulement eux', MJ.montage.map((x) => x.source?.id).join() === 'M2' && MJ.sortie.largeur === 1920, json(MJ.montage.map((x) => x.id)));
  essai('montage.json dit qu’il y a d’autres vidéos', MJ.projet.video?.nom === 'Teaser' && MJ.projet.video.numero === 2 && MJ.projet.video.sur === 2 && MJ.projet.video.autres.join() === 'Vendredi à Tokyo', json(MJ.projet.video));
  const lisez = fs.readFileSync(path.join(pack.dossier, 'LISEZMOI-IA.md'), 'utf8');
  essai('LISEZMOI-IA.md le dit aussi, et explique les « coupes » de livraison.json', /Ce projet contient 2 vidéos/.test(lisez) && /« Teaser »/.test(lisez) && /"coupes"/.test(lisez));
  const pack1 = await exporterPack(PJ, () => {}, {leger: true, dossier: path.join(T, 'pack-vendredi'), donnees: S.donneesSequence(PJ, PJ.d.sequences[0].id)});
  const M1J = JSON.parse(fs.readFileSync(path.join(pack1.dossier, 'montage.json'), 'utf8'));
  essai('le pack d’une vidéo rangée (donneesSequence) porte la sienne, sans toucher au projet', M1J.montage.length === 2 && M1J.sortie.hauteur === 1920 && M1J.projet.video.nom === 'Vendredi à Tokyo' && PJ.d.montage[0].id === 'P3', json(M1J.projet.video));
  const exporte = await exporterPack(PJ, () => {}, {leger: true});
  essai('le dossier exporté porte le nom de la vidéo', /^japon-teaser-pack-/.test(path.basename(exporte.dossier)), path.basename(exporte.dossier));
  // la bibliothèque : la carte du projet dit « 2 vidéos » (plans et durée : ceux de la vidéo ouverte) ; un projet d'avant, 1
  const {listerProjets} = await import('../lib/bibliotheque.mjs');
  const cartes = listerProjets();
  const carte = cartes.find((p) => p.dossier === PJ.racine);
  const ancienne = cartes.find((p) => p.dossier === path.resolve(dossierAncien));
  essai('la bibliothèque compte les vidéos d’un projet (« 2 vidéos ») ; un projet d’une seule vidéo, 1', carte?.videos === 2 && carte.plans === 1 && ancienne?.videos === 1, json({carte, ancienne: ancienne?.videos}));
  // une réponse dite au micro pour la voix off (un média du projet) n'est jamais donnée à l'IA comme un rush à monter
  const PR = new Projet(path.join(BIBLIO, 'Réponses'));
  PR.d.medias.push(structuredClone(M1), structuredClone(M2));
  PR.d.compteurs.M = 2;
  PR.sauver();
  fs.mkdirSync(path.join(PR.cache, 'voix-off'), {recursive: true});
  fs.writeFileSync(path.join(PR.cache, 'voix-off', 'etat.json'), json({v: 1, compteur: 1, questions: [{id: 'Q1', texte: 'Où étais-tu ?', medias: ['M1']}], reponses: {Q1: {media: 'M2', le: '2026-11-14T16:00:00.000Z'}}}));
  const packR = await exporterPack(PR, () => {}, {leger: true, dossier: path.join(T, 'pack-reponses')});
  const MR = JSON.parse(fs.readFileSync(path.join(packR.dossier, 'montage.json'), 'utf8'));
  essai('rien de découpé : les rushes entiers vont à l’IA, sans la réponse dite au micro pour la voix off', MR.decoupe === 'libre' && MR.montage.map((x) => x.source?.id).join() === 'M1', json(MR.montage.map((x) => x.source?.id)));
  const P1 = new Projet(path.join(BIBLIO, 'Une seule'));
  P1.d.medias.push(structuredClone(M1));
  P1.appliquer({montage: [plan('P1', 'M1', 0, 1)], compteurs: {P: 1}});
  const seul = await exporterPack(P1, () => {}, {leger: true, dossier: path.join(T, 'pack-seul')});
  const MS = JSON.parse(fs.readFileSync(path.join(seul.dossier, 'montage.json'), 'utf8'));
  essai('une seule vidéo : le pack n’en parle pas', MS.projet.video === null && !/Ce projet contient/.test(fs.readFileSync(path.join(seul.dossier, 'LISEZMOI-IA.md'), 'utf8')));
}

console.log('— « Créer toutes les vidéos » (un faux Remotion fabrique chaque vidéo avec FFmpeg) —');
{
  // le moteur de rendu du dossier de Dérush d'essai : les paquets du kit (vides), et un faux remotion-cli
  const MOTEUR = dossierMoteurRendu();
  const JOURNAL = path.join(T, 'rendus.jsonl');
  fs.mkdirSync(MOTEUR, {recursive: true});
  fs.writeFileSync(path.join(MOTEUR, 'package.json'), json({name: 'derush-moteur-rendu', private: true, dependencies: KIT.dependencies}));
  for (const [nom, version] of Object.entries(KIT.dependencies)) {
    const d = path.join(MOTEUR, 'node_modules', ...nom.split('/'));
    fs.mkdirSync(d, {recursive: true});
    fs.writeFileSync(path.join(d, 'package.json'), json({name: nom, version}));
  }
  fs.writeFileSync(path.join(MOTEUR, 'node_modules', '@remotion', 'cli', 'remotion-cli.js'), `import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const a = process.argv.slice(2);
if (a[0] !== 'render') process.exit(0);
const sortie = a[3];
const M = JSON.parse(fs.readFileSync(path.join(process.cwd(), '..', 'montage.json'), 'utf8'));
const {largeur, hauteur, fps} = M.sortie;
const duree = Math.max(0.5, M.sortie.duree.s);
fs.appendFileSync(${json(JOURNAL)}, JSON.stringify({largeur, hauteur, duree, plans: M.montage.map((x) => x.id), video: M.projet.video?.nom ?? null}) + '\\n');
execFileSync(${json(FFMPEG)}, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=' + largeur + 'x' + hauteur + ':rate=' + fps + ':duration=' + duree, '-f', 'lavfi', '-i', 'sine=frequency=440:duration=' + duree,
  '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-c:a', 'aac', '-shortest', sortie]);
console.log('Rendered 1/1');
console.log('Encoded 1/1');
`);
  fs.writeFileSync(path.join(MOTEUR, '.navigateur-pret'), 'essai');
  // une troisième vidéo, vide : rien à créer pour elle
  S.ajouterSequence(PJ, {nom: 'Brouillon', ouvrir: false});
  const plan1 = S.planDuRendu(PJ);
  essai('le plan dit avant : 2 vidéos à créer, 1 vide, la durée, la place estimée et la place libre',
    plan1.a_rendre === 2 && plan1.vides.join() === 'Brouillon' && Math.abs(plan1.duree_s - 4) < 0.1 && plan1.taille_estimee > 0 && /^environ /.test(plan1.taille_lisible) && plan1.place.ok === true, json(plan1));
  essai('rien à créer : refusé, en clair', leve(() => S.rendreSequences(PJ, new FileDAttente(), {ids: [PJ.d.sequences[2].id]}))?.statut === 400);
  process.env.FAUX_PLACE = String(0.7 * 1024 ** 3);
  const fileVide = new FileDAttente();
  const plein = leve(() => S.rendreSequences(PJ, fileVide, {}));
  essai('un disque presque plein : le plan le dit, et rien ne part dans la file', S.planDuRendu(PJ).place.ok === false && plein?.statut === 507 && /0,7 Go/.test(plein.message) && !fileVide.attente.length && !fileVide.enCours, plein?.message);
  delete process.env.FAUX_PLACE;
  const file = new FileDAttente();
  const ouverteAvant = json({s: PJ.d.sequence, m: PJ.d.montage});
  const {taches} = S.rendreSequences(PJ, file, {});
  // la vidéo 1 change juste après le clic : sa vidéo est celle du moment du clic
  S.activerSequence(PJ, PJ.d.sequences[0].id);
  PJ.appliquer({sequence: PJ.d.sequence, montage: [plan('P1', 'M1', 0, 2)]});
  S.activerSequence(PJ, PJ.d.sequences[1].id);
  await file.vide();
  const finies = file.recents.filter((t) => taches.some((x) => x.tache === t.id));
  const erreurs = finies.filter((t) => t.etat !== 'fini').map((t) => t.erreur);
  essai('deux tâches, une par vidéo qui a des plans, toutes finies', taches.length === 2 && finies.length === 2 && !erreurs.length, json(erreurs));
  const res = taches.map((x) => finies.find((t) => t.id === x.tache)?.resultat);
  const journal = fs.readFileSync(JOURNAL, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  essai('chaque vidéo est rendue à son format : 1080 × 1920 puis 1920 × 1080', res[0]?.largeur === 1080 && res[0]?.hauteur === 1920 && res[1]?.largeur === 1920 && res[1]?.hauteur === 1080, json(res.map((r) => [r?.largeur, r?.hauteur])));
  essai('la vidéo 1 est celle du moment du clic (deux plans, 3 s)', journal[0]?.plans.join() === 'P1,P2' && Math.abs(journal[0].duree - 3) < 0.05 && journal[0].video === 'Vendredi à Tokyo', json(journal[0]));
  essai('les vidéos portent le nom de leur vidéo, dans « vidéos »', /^japon-vendredi-a-tokyo-\d{8}-\d{6}\.mp4$/.test(res[0]?.nom ?? '') && /^japon-teaser-/.test(res[1]?.nom ?? '') && res.every((r) => r && fs.existsSync(r.video)), json(res.map((r) => r?.nom)));
  essai('le résultat dit quelle vidéo du projet a été créée', res[0]?.sequence?.nom === 'Vendredi à Tokyo' && res[1]?.sequence?.nom === 'Teaser');
  essai('le contrôle du format juge chaque vidéo d’après son propre format', res.every((r) => r?.controles?.[0]?.ok === true), json(res.map((r) => r?.controles?.[0])));
  essai('la vidéo ouverte n’a pas bougé pendant les rendus', json({s: PJ.d.sequence, m: PJ.d.montage}) === ouverteAvant);
}

console.log('— Les vidéos livrées par l’IA deviennent des vidéos du projet (faux dossier de travail) —');
{
  const dossier = path.join(BIBLIO, 'TikToks');
  const P = new Projet(dossier);
  P.d.medias.push(structuredClone(M1), structuredClone(M2));
  P.d.compteurs.M = 2;
  P.appliquer({montage: [], compteurs: {}});
  // le dossier de travail de l'IA : un pack « sans découpe » (les plans portent le nom de leur rush), deux cases
  const atelier = path.join(dossier, 'exports', 'pack-ia');
  fs.mkdirSync(path.join(atelier, 'rendu', 'livraison'), {recursive: true});
  const origine = {decoupe: 'libre', montage: [
    {id: 'M1', type: 'plan', source: {id: 'M1', type: 'video', entree: {s: 0}, sortie: {s: 6}}, duree: {s: 6}},
    {id: 'M2', type: 'plan', source: {id: 'M2', type: 'video', entree: {s: 0}, sortie: {s: 4}}, duree: {s: 4}},
    {id: 'P5', type: 'plan', source: {id: 'M2', type: 'video', entree: {s: 1}, sortie: {s: 3}}, duree: {s: 2}},
    {id: 'B1', type: 'bloc', genre: 'animation', titre: 'Carte', consigne: 'Une carte', duree: {s: 1.5}},
  ]};
  fs.writeFileSync(path.join(atelier, 'montage.origine.json'), json(origine));
  fs.writeFileSync(path.join(atelier, 'montage.json'), json({...origine, decoupe: 'ia', montage: [{id: 'M1b', type: 'plan', source: {id: 'M1', type: 'video', entree: {s: 2}, sortie: {s: 4.5}}, duree: {s: 2.5}, titre: 'Le temple'}]}));
  // les coupes écrites par l'IA dans livraison.json, et ce que Dérush en garde à la livraison
  const brutes = [{plan: 'M1', de: 1, a: 2.5, titre: 'Shibuya'}, {plan: 'P5'}, {case: 'B1'}, {plan: 'M2', de: 3, a: 2}, {plan: 'P99', de: 0, a: 1}, {plan: '../x'}, 'n’importe quoi'];
  const coupes = S.coupesLivrees(atelier, brutes, P);
  essai('les coupes de l’IA : un rush (M1), un plan du pack (P5 → M2, 1 → 3 s), une case ; le reste est laissé de côté',
    json(coupes.map((c) => (c.type === 'plan' ? [c.media, c.entree, c.sortie] : [c.type, c.duree]))) === json([['M1', 1, 2.5], ['M2', 1, 3], ['bloc', 1.5]]), json(coupes));
  const decoupe = S.decoupeDuDossier(atelier, P);
  essai('la découpe de recouper.mjs (une seule vidéo) se lit aussi', decoupe.length === 1 && decoupe[0].media === 'M1' && decoupe[0].entree === 2 && decoupe[0].sortie === 4.5 && decoupe[0].titre === 'Le temple', json(decoupe));
  // la table de montage de l'IA, telle que Dérush la relit (de / a gardés)
  const table = {duree_s: 4, blocs: [
    {id: 'a', piste: 'plan', nom: 'Rue', debut_s: 0, duree_s: 2, source: 'M1', de: 0.5, a: 2.5, video: 'clip-2.mp4'},
    {id: 'b', piste: 'plan', nom: 'Gare', debut_s: 2, duree_s: 2, source: 'M2', de: 1, video: 'clip-2.mp4'},
    {id: 'c', piste: 'plan', nom: 'Détail', debut_s: 0.5, duree_s: 1, source: 'M2', de: 0, a: 1, video: 'clip-2.mp4'},
    {id: 'd', piste: 'texte', nom: 'Titre', debut_s: 0, duree_s: 1.5, texte: 'VENDREDI', video: 'clip-2.mp4'},
    {id: 'e', piste: 'son', nom: 'Ambiance', debut_s: 0, duree_s: 4, source: 'M1', de: 0, a: 4, video: 'clip-2.mp4'},
    {id: 'f', piste: 'sous-titres', nom: 'Sous-titres', debut_s: 0, duree_s: 4, video: 'clip-2.mp4'},
    {id: 'g', piste: 'plan', nom: 'Autre clip (sans passage)', debut_s: 0, duree_s: 3, source: 'M2', video: 'clip-3.mp4'},
  ]};
  fs.writeFileSync(path.join(atelier, 'rendu', 'timeline.json'), json(table));
  const relue = tableIA(atelier, 0);
  essai('la table de montage relue garde le passage du rush (« de », « a »)', relue?.blocs.find((b) => b.id === 'a')?.de === 0.5 && relue.blocs.find((b) => b.id === 'a').a === 2.5 && relue.blocs.find((b) => b.id === 'b').a === undefined, json(relue?.blocs.slice(0, 2)));
  const blocs = relue.blocs.map((b) => ({...b, video: b.video === 'clip-2.mp4' ? 1 : b.video === 'clip-3.mp4' ? 2 : null}));
  // trois vidéos livrées : la 1re avec ses coupes, la 2e avec sa table, la 3e sans rien (le fichier)
  const VIDEOS = path.join(dossier, 'vidéos');
  fs.mkdirSync(VIDEOS, {recursive: true});
  const livree = (n) => { const f = path.join(VIDEOS, n); fs.copyFileSync(portrait, f); return n; };
  const v1 = {nom: livree('tiktoks-claude-v1-1-shibuya.mp4'), titre: 'Shibuya', largeur: 1080, hauteur: 1920, fps: 30, coupes};
  const v2 = {nom: livree('tiktoks-claude-v1-2-gare.mp4'), titre: 'La gare', largeur: 1080, hauteur: 1350, fps: 25};
  const v3 = {nom: livree('tiktoks-claude-v1-3.mp4'), titre: null, largeur: 1080, hauteur: 1920, fps: 30};
  fs.mkdirSync(path.join(dossier, 'claude'), {recursive: true});
  const etat = {atelier: 'exports/pack-ia', echanges: [], sessions: {}, versions: [
    {n: 1, moteur: 'claude', ...v1, titre: undefined, videos: [v1, v2, v3], table: {...relue, blocs}, atelier: 'exports/pack-ia'},
  ]};
  fs.writeFileSync(path.join(dossier, 'claude', 'etat.json'), json(etat));
  const importes = [];
  const importer = async (chemin) => {
    const m = {...(await M.sonder(chemin)), id: `M${++P.d.compteurs.M}`, nom: path.basename(chemin), chemin, etapes: {}, etat: 'pret'};
    P.d.medias.push(m);
    importes.push(chemin);
    return m;
  };
  essai('ce que l’écran de l’IA en dit : plans, plans, fichier',
    [0, 1, 2].map((k) => S.etatLivree(P, etat.versions[0], k).timeline).join() === 'plans,plans,fichier');
  const r1 = await S.videoLivreeVersSequence(P, {version: 1, video: 0}, {importer});
  essai('la 1re (ses coupes) : une vidéo du projet, plan par plan, ouverte', r1.mode === 'plans' && P.d.sequence === r1.sequence.id && P.d.montage.map((x) => (x.type === 'plan' ? `${x.media}:${x.entree}-${x.sortie}` : x.type)).join() === 'M1:1-2.5,M2:1-3,bloc', json(P.d.montage));
  essai('son nom est le titre de l’IA, son format celui de la vidéo livrée, et elle sait d’où elle vient', r1.sequence.nom === 'Shibuya' && P.d.sortie.preset === 'vertical' && P.d.sortie.fps === 30 && r1.sequence.origine?.version === 1 && r1.sequence.origine.video === 0 && r1.sequence.origine.mode === 'plans', json(r1.sequence.origine));
  essai('la case à créer est gardée, avec sa consigne', P.d.montage[2].type === 'bloc' && P.d.montage[2].duree === 1.5 && P.d.montage[2].consigne === 'Une carte');
  essai('un projet neuf : la « Vidéo 1 » encore vide devient cette vidéo (aucun onglet vide ne reste à côté)', P.d.sequences.length === 1 && P.d.sequences[0].id === r1.sequence.id && P.d.sequences[0].nom === 'Shibuya', json(P.d.sequences.map((s) => [s.id, s.nom])));
  const r2 = await S.videoLivreeVersSequence(P, {version: 1, video: 1}, {importer});
  essai('… la suivante arrive à côté (la vidéo ouverte n’est plus vide)', P.d.sequences.length === 2 && r2.sequence.id !== r1.sequence.id && P.d.sequence === r2.sequence.id, json(P.d.sequences.map((s) => [s.id, s.nom])));
  const plansV2 = P.d.montage.map((x) => `${x.media}:${x.entree}-${x.sortie}`).join();
  essai('la 2e (sa table) : ses plans dans l’ordre, le passage pris dans le rush', r2.mode === 'plans' && plansV2 === 'M1:0.5-2.5,M2:1-3', plansV2);
  const dessus = P.d.superpositions.map((x) => `${x.media}:${x.debut}:${x.son.actif}`).join();
  essai('le plan qui en recouvre un autre et le son d’un rush passent par-dessus (le plan muet, le son actif)', dessus === 'M1:0:true,M2:0.5:false', dessus);
  essai('le texte de l’IA devient un titre de Dérush, à sa place', P.d.indications.length === 1 && P.d.indications[0].modele === 'titre' && P.d.indications[0].reglages.texte === 'VENDREDI' && P.d.indications[0].fin === 1.5, json(P.d.indications));
  essai('son format : 4:5, 25 images/s', P.d.sortie.preset === 'portrait' && P.d.sortie.fps === 25, json(P.d.sortie));
  essai('aucun fichier importé pour elles', !importes.length);
  const r3 = await S.videoLivreeVersSequence(P, {version: 1, video: 2}, {importer});
  essai('la 3e (rien de plus que le fichier) : le fichier livré devient un média, posé comme un seul plan', r3.mode === 'fichier' && importes.length === 1 && P.d.montage.length === 1 && P.d.montage[0].media === P.d.medias.at(-1).id && Math.abs(P.d.montage[0].sortie - 4) < 0.1, json(P.d.montage));
  essai('sans titre, elle prend un nom clair', r3.sequence.nom === 'Version 1 de l’IA · 3', r3.sequence.nom);
  const avant = P.d.sequences.length;
  const r4 = await S.videoLivreeVersSequence(P, {version: 1, video: 0}, {importer});
  essai('une vidéo déjà faite n’est pas refaite : on la rouvre', r4.deja === true && P.d.sequences.length === avant && P.d.sequence === r1.sequence.id);
  essai('l’écran de l’IA dit dans quelle vidéo du projet elle est', S.etatLivree(P, etat.versions[0], 0).dans_timeline?.id === r1.sequence.id);
  const tout = await S.videosLivreesVersSequences(P, {version: 1, encore: false}, {importer});
  essai('« toutes les vidéos » : rien de refait, la première rouverte', tout.faites.length === 3 && tout.faites.every((f) => f.deja) && P.d.sequences.length === avant && !tout.erreurs.length, json(tout.erreurs));
  essai('une version inconnue : 404', (await S.videoLivreeVersSequence(P, {version: 9}, {importer}).catch((e) => e))?.statut === 404);
  // une seule vidéo livrée, sans coupes : la découpe de recouper.mjs dans le dossier de travail (dernière version)
  etat.versions.push({n: 2, moteur: 'codex', nom: livree('tiktoks-codex-v2.mp4'), largeur: 1920, hauteur: 1080, videos: [{nom: 'tiktoks-codex-v2.mp4', titre: null, largeur: 1920, hauteur: 1080}], atelier: 'exports/pack-ia'});
  fs.writeFileSync(path.join(dossier, 'claude', 'etat.json'), json(etat));
  const r5 = await S.videoLivreeVersSequence(P, {version: 2, video: 0}, {importer});
  essai('une vidéo seule, sans coupes : la découpe de recouper.mjs, plan par plan', r5.mode === 'plans' && P.d.montage.length === 1 && P.d.montage[0].entree === 2 && P.d.montage[0].sortie === 4.5 && P.d.sortie.preset === 'horizontal', json(P.d.montage));
  // ce que l'écran de l'IA reçoit (GET /api/claude) : le rang de chaque vidéo, ce qu'elle deviendrait, où elle est déjà
  const ed = etatDemande(P);
  const vues = ed.versions.find((v) => v.n === 1)?.videos ?? [];
  essai('l’écran de l’IA : le rang, « plans » ou « fichier », la vidéo du projet déjà faite, sans les passages eux-mêmes',
    vues.map((x) => `${x.rang}:${x.timeline}:${x.dans_timeline?.nom ?? '-'}`).join() === '0:plans:Shibuya,1:plans:La gare,2:fichier:Version 1 de l’IA · 3' && vues.every((x) => !('coupes' in x)), json(vues.map((x) => [x.rang, x.timeline, x.dans_timeline])));
  essai('le dossier de travail d’avant les vidéos (sans « sequence ») : rien n’a changé pour l’IA', ed.sequence_change === false && ed.montage_change === false && ed.sequence_atelier === null, json([ed.sequence_change, ed.montage_change]));
  fs.writeFileSync(path.join(dossier, 'claude', 'etat.json'), json({...etat, sequence: P.d.sequences[0].id, sequence_nom: P.d.sequences[0].nom}));
  const ed2 = etatDemande(P);
  essai('une autre vidéo ouverte que celle du dossier de travail : l’écran de l’IA le sait (« Repartir de lui » par défaut)', ed2.sequence_change === true && ed2.montage_change === true && ed2.sequence_atelier?.nom === 'Shibuya', json([ed2.sequence_change, ed2.montage_change, ed2.sequence_atelier]));
  const R = new Projet(dossier);
  essai('relu sur le disque : toutes ces vidéos sont là, avec leur origine (aucune « Vidéo 1 » vide)', R.d.sequences.length === 4 && R.d.sequences.every((s) => s.origine) && R.d.sequences.find((s) => s.nom === 'La gare')?.superpositions?.length === 2, json(R.d.sequences.map((s) => [s.nom, s.origine?.mode])));
}

console.log('— « Mettre les N vidéos dans ma timeline » dans un projet neuf —');
{
  // le cas de « fais-moi un vlog du vendredi » : la « Vidéo 1 » vide reçoit la première vidéo de l'IA, les autres
  // arrivent à côté ; un projet dont la vidéo ouverte a déjà des plans garde la sienne
  const source = path.join(BIBLIO, 'TikToks');
  const copie = (dossier) => {
    for (const d of ['claude', 'vidéos', 'exports']) fs.cpSync(path.join(source, d), path.join(dossier, d), {recursive: true});
    const P = new Projet(dossier);
    P.d.medias.push(structuredClone(M1), structuredClone(M2));
    P.d.compteurs.M = 2;
    P.sauver();
    return P;
  };
  const importerDans = (P) => async (chemin) => {
    const m = {...(await M.sonder(chemin)), id: `M${++P.d.compteurs.M}`, nom: path.basename(chemin), chemin, etapes: {}, etat: 'pret'};
    P.d.medias.push(m);
    return m;
  };
  const N = copie(path.join(BIBLIO, 'Vlog neuf'));
  const v1 = N.d.sequence;
  const tout = await S.videosLivreesVersSequences(N, {version: 1, videos: [0, 1]}, {importer: importerDans(N)});
  essai('projet neuf : 2 vidéos de l’IA, 2 onglets (la « Vidéo 1 » vide est devenue la première), la première ouverte',
    tout.faites.length === 2 && !tout.erreurs.length && N.d.sequences.length === 2 && tout.faites[0].sequence.id === v1 && N.d.sequence === v1 && N.d.sequences[0].nom === 'Shibuya' && N.d.sequences[1].nom === 'La gare',
    json({seqs: N.d.sequences.map((s) => [s.id, s.nom]), erreurs: tout.erreurs}));
  const A = copie(path.join(BIBLIO, 'Déjà monté'));
  A.appliquer({sequence: A.d.sequence, montage: [plan('P1', 'M1', 0, 2)], compteurs: {P: 1}});
  const avantA = A.d.sequence;
  const tout2 = await S.videosLivreesVersSequences(A, {version: 1, videos: [0]}, {importer: importerDans(A)});
  essai('une vidéo ouverte qui a déjà des plans n’est jamais remplie : la vidéo de l’IA arrive à côté',
    tout2.faites.length === 1 && A.d.sequences.length === 2 && A.d.sequences[0].id === avantA && A.d.sequences[0].nom === 'Vidéo 1' && !A.d.sequences[0].origine && A.d.sequences[1].nom === 'Shibuya',
    json(A.d.sequences.map((s) => [s.id, s.nom])));
}

console.log('— Les routes —');
{
  const dossier = path.join(BIBLIO, 'Routes');
  const P = new Projet(dossier);
  P.d.medias.push(structuredClone(M1));
  P.appliquer({montage: [plan('P1', 'M1', 0, 2)], compteurs: {P: 1}});
  class ErreurHttp extends Error { constructor(code, message) { super(message); this.code = code; } }
  const appeler = async (methode, chemin, corps = null) => {
    const url = new URL(chemin, 'http://127.0.0.1');
    const req = Readable.from(corps ? [Buffer.from(json(corps))] : []);
    req.method = methode;
    let reponse = null;
    const outils = {
      envoyerJson: (res, code, data) => { reponse = {code, data: JSON.parse(json(data))}; },
      lireCorps: async (r) => { let t = ''; for await (const x of r) t += x; return t ? JSON.parse(t) : {}; },
      ErreurHttp, projet: () => P,
    };
    try {
      const pris = await S.routesSequences(req, {}, url.pathname, url, {file: new FileDAttente()}, outils);
      return pris ? reponse : 'pas prise';
    } catch (e) { return {code: e.code ?? 500, erreur: e.message}; }
  };
  essai('une autre route n’est pas prise', (await appeler('GET', '/api/sequencesX')) === 'pas prise' && (await appeler('GET', '/api/projet')) === 'pas prise');
  const g = await appeler('GET', '/api/sequences');
  essai('GET : la liste et la vidéo ouverte', g.code === 200 && g.data.sequences.length === 1 && g.data.sequence === P.d.sequence && !g.data.projet);
  const a = await appeler('POST', '/api/sequences', {nom: 'Clip 2', copier: true});
  essai('POST : une copie, ouverte, et le projet entier en réponse', a.code === 200 && a.data.sequences.length === 2 && a.data.projet.sequence === a.data.ajoutee && a.data.projet.montage.length === 1 && a.data.projet.montage[0].id !== 'P1', json(a.data.projet?.montage));
  const v1 = a.data.sequences[0].id;
  const b = await appeler('POST', '/api/sequences/activer', {id: v1});
  essai('POST activer : le projet tel que /api/etat le donne', b.code === 200 && b.data.projet.sequence === v1 && b.data.projet.montage[0].id === 'P1' && Array.isArray(b.data.projet.medias));
  const c = await appeler('PUT', `/api/sequences/${a.data.ajoutee}`, {nom: 'Teaser'});
  essai('PUT : renommée', c.code === 200 && c.data.sequences[1].nom === 'Teaser');
  const o = await appeler('POST', '/api/sequences/ordre', {ids: [a.data.ajoutee, v1]});
  essai('POST ordre', o.code === 200 && o.data.sequences.map((x) => x.id).join() === `${a.data.ajoutee},${v1}`);
  const pl = await appeler('GET', `/api/sequences/rendre?ids=${v1}`);
  essai('GET rendre : le plan, pour la vidéo demandée', pl.code === 200 && pl.data.videos.length === 1 && pl.data.a_rendre === 1 && pl.data.taille_estimee > 0);
  const d1 = await appeler('DELETE', `/api/sequences/${a.data.ajoutee}`);
  essai('DELETE : supprimée, le projet en réponse', d1.code === 200 && d1.data.sequences.length === 1 && d1.data.projet.sequence === v1);
  const d2 = await appeler('DELETE', `/api/sequences/${v1}`);
  essai('DELETE de la dernière : 400, en clair', d2.code === 400 && /seule vidéo/.test(d2.erreur), json(d2));
  const i = await appeler('POST', '/api/sequences/depuis-ia', {version: 1, video: 0});
  essai('POST depuis-ia sans IA : 404, en clair', i.code === 404 && /n’existe plus/.test(i.erreur), json(i));
  const x = await appeler('PATCH', '/api/sequences/V1');
  essai('une méthode inconnue : 404', x.code === 404);
}

console.log(`\n${ok} réussi(s), ${ko} échec(s).`);
if (!ko) fs.rmSync(T, {recursive: true, force: true});
else console.log(`Dossier d’essai gardé : ${T}`);
process.exit(ko ? 1 : 0);
