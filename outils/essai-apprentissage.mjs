// Dérush — les essais de « Dérush apprend de toi » (pour qui modifie Dérush) : les espaces (Moi, chaque client,
// Personne), l'isolement d'un client (son montage ne reçoit jamais l'univers de la personne qui monte : ni son
// identité, ni son carnet, ni son profil, ni sa recette, ni ses séries), les fiches et les notes, le suivi des vues, la
// recette qui marche, les séries, le tableau de bord, le carnet par espace, et leurs routes dans le vrai serveur.
//   node outils/essai-apprentissage.mjs [dossier où créer le dossier d'essai]
// Aucune IA, aucun appel réel, aucune clé : le vrai code de lib/ sur un dossier de Dérush et une bibliothèque jetables
// (DERUSH_SUPPORT et DERUSH_BIBLIOTHEQUE), et un faux Treg local (127.0.0.1, par DERUSH_TREG_BASE), en lecture seule.
// Rien n'est lu ni écrit dans la vraie installation. Jamais /api/recette/analyser ni /api/suivi/relire-ia (ils lancent
// une vraie IA), ni /api/tableau/rapport (il ouvre le Finder) : le rapport est essayé par rapport() directement.
// Le dossier d'essai est effacé à la fin, sauf en cas d'échec (son chemin est alors affiché).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
if (/^-/.test(process.argv[2] ?? '')) { console.log(`Usage : node ${path.relative(process.cwd(), process.argv[1])} [dossier temporaire]`); process.exit(0); }
const parent = path.resolve(process.argv[2] ?? os.tmpdir());
fs.mkdirSync(parent, {recursive: true});
const T = fs.mkdtempSync(path.join(parent, 'derush-essai-apprentissage-'));
// AVANT tout import de lib/ : DOSSIER_SUPPORT, RACINE_BIBLIO et BASE_TREG sont lus une seule fois, au chargement
const SUPPORT = path.join(T, 'support');
const BIBLIO = path.join(T, 'bibliotheque');
process.env.DERUSH_SUPPORT = SUPPORT; // « = », jamais « ??= »
process.env.DERUSH_BIBLIOTHEQUE = BIBLIO;
process.env.DERUSH_SANS_MAJ = '1';
process.env.DERUSH_SANS_NAVIGATEUR = '1';
delete process.env.TREG_TOKEN; // jamais la vraie clé
fs.mkdirSync(SUPPORT, {recursive: true});
fs.mkdirSync(BIBLIO, {recursive: true});
// le vrai serveur fait le ménage du dossier temporaire au démarrage (les « derush-… » de plus de 6 h) : il le fait dans
// celui de l'essai, jamais dans celui de la personne (l'historique du banc, les dossiers gardés par d'autres essais)
const TEMPORAIRE = path.join(T, 'tmp');
process.env.TMPDIR = TEMPORAIRE;
process.env.TEMP = TEMPORAIRE;
process.env.TMP = TEMPORAIRE;
fs.mkdirSync(TEMPORAIRE, {recursive: true});

const JOUR = 86400e3;
const ilYA = (jours) => new Date(Date.now() - jours * JOUR).toISOString();

// ——— un faux Treg (comme essai-youtube) : la porte directe en lecture, ses propres refus portent X-Treg-Error ———
const CLE = 'trg_essai_0000';
let scenario = 'normal';
const journal = [];
const chaineYouTube = {}; // id → {vues, publie} : les vidéos de la chaîne
const compteTikTok = []; // les vidéos du compte TikTok, comme l'API les rend
const fauxTreg = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let corps = '';
  req.on('data', (x) => { corps += x; });
  req.on('end', () => {
    journal.push({methode: req.method, chemin: u.pathname, question: Object.fromEntries(u.searchParams), cle: req.headers['x-treg-token'], corps});
    // « lent » : Treg met un tiers de seconde à répondre (le temps de lier une publication pendant une relecture)
    const json = (code, o, h = {}) => setTimeout(() => { res.writeHead(code, {'content-type': 'application/json', ...h}); res.end(JSON.stringify(o)); }, scenario === 'lent' ? 300 : 0);
    if (req.headers['x-treg-token'] !== CLE || scenario === 'cle') return json(401, {detail: 'invalid token'}, {'x-treg-error': '1'});
    if (scenario === 'panne') return json(500, {detail: 'erreur interne'}, {'x-treg-error': '1'});
    if (req.method === 'GET' && u.pathname === '/call/youtube.youtube.video.detail') {
      const ids = (u.searchParams.get('id') ?? '').split(',').filter((id) => chaineYouTube[id]);
      return json(200, {kind: 'youtube#videoListResponse', items: ids.map((id) => ({id, snippet: {publishedAt: chaineYouTube[id].publie, title: id}, statistics: {viewCount: String(chaineYouTube[id].vues), likeCount: '40', commentCount: '6'}}))});
    }
    if (req.method === 'GET' && u.pathname === '/call/youtube.youtube.channel.profile') return json(200, {items: [{id: 'UCessai', contentDetails: {relatedPlaylists: {uploads: 'UUessai'}}}]});
    if (req.method === 'GET' && u.pathname === '/call/youtube.youtube.channel.videos.uploads') return json(200, {items: Object.keys(chaineYouTube).map((videoId) => ({contentDetails: {videoId}}))});
    if (req.method === 'POST' && u.pathname === '/call/tiktok.tiktok.user.videos') return json(200, {data: {videos: compteTikTok, has_more: false, cursor: 0}, error: {code: 'ok', message: ''}});
    return json(404, {detail: 'unknown endpoint'}, {'x-treg-error': '1'});
  });
});
await new Promise((ok) => fauxTreg.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${fauxTreg.address().port}`;
process.env.DERUSH_TREG_BASE = BASE;
const LECTURES_PERMISES = new Set(['/call/youtube.youtube.video.detail', '/call/youtube.youtube.channel.profile', '/call/youtube.youtube.channel.videos.uploads', '/call/tiktok.tiktok.user.videos']);

const lib = (m) => import(pathToFileURL(path.join(D, 'lib', m)).href);
const E = await lib('espaces.mjs');
const F = await lib('fiches.mjs');
const Su = await lib('suivi.mjs');
const R = await lib('recette.mjs');
const Se = await lib('series.mjs');
const Ta = await lib('tableau.mjs');
const K = await lib('carnet.mjs');
const Cr = await lib('createur.mjs');
const {Projet} = await lib('projet.mjs');
const {FileDAttente} = await lib('outils.mjs');
const {demarrerServeur} = await lib('serveur.mjs');

let bons = 0;
let total = 0;
function essai(quoi, vrai, detail = '') {
  total++; if (vrai) bons++;
  console.log(`${vrai ? '  ✓' : '  ✗'} ${quoi}${vrai || !detail ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)?.slice(0, 400)}`}`);
}
const titre = (t) => console.log(`\n${t}`);
const leve = (fn, motif = null) => { try { fn(); return false; } catch (e) { return !motif || motif.test(e.message); } };
const lire = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const esp = (id) => E.trouverEspace(id);
/** Tout le texte d'un dossier de travail (ce que l'IA peut lire), fichier par fichier. */
function textesDe(dossier) {
  const r = [];
  const tour = (d) => {
    let es = [];
    try { es = fs.readdirSync(d, {withFileTypes: true}); } catch { return; }
    for (const e of es) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) tour(f);
      else if (/\.(md|txt|json|tsx?|js)$/i.test(e.name)) r.push(`${path.relative(dossier, f)}\n${fs.readFileSync(f, 'utf8')}`);
    }
  };
  tour(dossier);
  return r.join('\n');
}
// l'univers de la personne qui monte (ses chroniques manga) : il ne doit jamais apparaître chez un client
const UNIVERS_MOI = /manga|japon|tokyo|n[ée]ons|FFD60A|E63946|enthousiaste|\bAnton\b|Fire !/i;

/**
 * Ce que lib/claude.mjs (demander, l.496-555) pose dans le dossier de travail avant de lancer l'IA, brique par brique :
 * l'espace du projet, sa recette, sa série, le profil du créateur (seulement pour « Moi »), le carnet de l'espace, et la
 * consigne. demander() elle-même lance une vraie IA : elle n'est pas appelée ici (voir les gardes sur sa source plus bas).
 */
function preparer(P, atelier) {
  fs.mkdirSync(atelier, {recursive: true});
  const espace = E.espaceDuProjet(P);
  E.installerEspace(atelier, espace);
  R.installerRecette(atelier, espace);
  const serie = Se.installerSerie(atelier, P);
  const profil = espace?.type === 'moi' ? Cr.installerProfil(atelier) : (fs.rmSync(path.join(atelier, 'contexte', 'createur'), {recursive: true, force: true}), false);
  const carnet = E.apprend(espace) ? K.texteCarnet(espace.id) : null;
  if (carnet) fs.writeFileSync(path.join(atelier, 'CARNET.md'), carnet); else fs.rmSync(path.join(atelier, 'CARNET.md'), {force: true});
  fs.rmSync(path.join(atelier, K.FICHIER_IA), {force: true});
  fs.writeFileSync(path.join(atelier, 'consignes.txt'), `${E.consigneEspace(espace)}${serie ? `\n${Se.consigneSerie(serie)}` : ''}`);
  return {espace, profil, serie};
}

let serveur = null;
try {
  // ————————————————————————————————————————————————————————————————————————————————
  titre('Le carnet d’avant les espaces');
  const ancien = path.join(SUPPORT, 'carnet.json');
  fs.writeFileSync(ancien, JSON.stringify({v: 1, lecons: [{id: 'ancienne01', texte: 'Une leçon d’avant les espaces : elle revient à « Moi ».', quand: '2026-11-01T10:00:00.000Z', projet: 'Ancien projet'}]}));
  const migrees = K.lireCarnet('moi');
  essai('l’ancien carnet.json devient le carnet de « Moi », sans rien perdre', migrees.length === 1 && migrees[0].id === 'ancienne01' && !fs.existsSync(ancien) && fs.existsSync(path.join(E.DOSSIER_ESPACES, 'moi', 'carnet.json')), migrees);
  essai('sans espace précisé, le carnet est celui de « Moi »', K.lireCarnet().length === 1);

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Les espaces');
  let liste = E.lireEspaces();
  essai('« Moi » et « Personne » sont là dès le départ, « Moi » proposé d’abord', liste.espaces.some((e) => e.id === 'moi' && e.type === 'moi') && liste.espaces.some((e) => e.id === 'neutre' && e.type === 'neutre') && liste.dernier === 'moi', liste);
  fs.mkdirSync(E.DOSSIER_ESPACES, {recursive: true});
  fs.writeFileSync(path.join(E.DOSSIER_ESPACES, 'espaces.json'), JSON.stringify({v: 1, dernier: 'disparu-00', espaces: [{id: 'moi', nom: 'Moi', type: 'moi', marque: {couleurs: ['#zzz', '#abcdef'], logo: '../../secret.png'}, metier: {type: 'inexistant'}}]}));
  liste = E.lireEspaces();
  const moiRelu = liste.espaces.find((e) => e.id === 'moi');
  essai('une liste abîmée retrouve « Personne » ; un dernier espace disparu redevient « Moi »', liste.espaces.some((e) => e.id === 'neutre') && liste.dernier === 'moi', liste);
  essai('à la relecture, la marque et le métier sont nettoyés (couleurs, logo, métier inconnu)', JSON.stringify(moiRelu.marque.couleurs) === '["#ABCDEF"]' && moiRelu.marque.logo === null && moiRelu.metier === null, moiRelu);
  fs.rmSync(path.join(E.DOSSIER_ESPACES, 'espaces.json'));
  essai('apprend : « Moi » oui, « Personne » jamais, rien pour un espace absent', E.apprend(esp('moi')) && !E.apprend(esp('neutre')) && !E.apprend(null) && !E.apprend(undefined));

  essai('un client sans nom est refusé', leve(() => E.creerClient({nom: '   '}), /nom/));
  const boulangerie = E.creerClient({nom: '  Boulangerie   Lemoine ', metier: {type: 'marque', precision: 'pains et viennoiseries'}, marque: {ton: 'chaleureux, artisanal', public: 'familles du quartier', interdits: 'Jamais de musique agressive.', mentions: 'Boulangerie Lemoine — depuis 1952', couleurs: ['#8b4513', 'pas-une-couleur', '#F5DEB3', '#123'], polices: ['Playfair Display']}});
  essai('un client se crée : nom propre, identifiant lisible, type client, il apprend', boulangerie.nom === 'Boulangerie Lemoine' && /^boulangerie-lemoine-[0-9a-f]{4}$/.test(boulangerie.id) && boulangerie.type === 'client' && E.apprend(boulangerie), boulangerie);
  essai('sa marque est nettoyée dès la création (couleurs hexadécimales seulement)', JSON.stringify(boulangerie.marque.couleurs) === '["#8B4513","#F5DEB3"]' && boulangerie.marque.logo === null && boulangerie.metier?.type === 'marque' && boulangerie.metier.confirme === true, boulangerie.marque);
  essai('un doublon (même nom, autre casse) est refusé', leve(() => E.creerClient({nom: 'boulangerie LEMOINE'}), /existe déjà/));
  essai('un client ne peut pas s’appeler « Moi »', leve(() => E.creerClient({nom: 'moi'}), /existe déjà/));
  const sansLettres = E.creerClient({nom: '東京'});
  essai('un nom sans lettres latines garde un identifiant valable', /^client-[0-9a-f]{4}$/.test(sansLettres.id), sansLettres.id);

  essai('« Personne » ne se règle pas', leve(() => E.changerEspace('neutre', {nom: 'Quelqu’un'}), /Personne/));
  essai('un espace inconnu ne se règle pas', leve(() => E.changerEspace('zz-inconnu', {}), /inconnu/));
  let b = E.changerEspace(boulangerie.id, {nom: '  Boulangerie  Lemoine & fils ', metier: {type: 'inexistant'},
    marque: {ton: `  chaleureux,\n\n artisanal ${'x'.repeat(500)}`, couleurs: '#8b4513, #f5deb3 ; rouge #12345 #ABCDEF #000000 #111111 #222222 #333333', polices: 'Playfair Display, Inter, A, B, C, D', logo: 'piege.png', inconnu: 'non', notes: 'n'.repeat(2000)}});
  essai('changerEspace : nom d’un client changé, espaces repliés', b.nom === 'Boulangerie Lemoine & fils', b.nom);
  essai('changerEspace : un métier inconnu est retiré', b.metier === null, b.metier);
  essai('changerEspace : marque nettoyée (ton borné à 300 signes sur une ligne, 6 couleurs, 4 polices, notes à 1 200)', b.marque.ton.length === 300 && !/\n/.test(b.marque.ton) && JSON.stringify(b.marque.couleurs) === '["#8B4513","#F5DEB3","#ABCDEF","#000000","#111111","#222222"]' && b.marque.polices.length === 4 && b.marque.notes.length === 1200, b.marque);
  essai('changerEspace : un champ inconnu n’entre pas, ceux non envoyés sont gardés', !('inconnu' in b.marque) && b.marque.mentions === 'Boulangerie Lemoine — depuis 1952' && b.marque.interdits === 'Jamais de musique agressive.', b.marque);
  b = E.changerEspace(boulangerie.id, {nom: 'Boulangerie Lemoine', metier: {type: 'marque', precision: 'p'.repeat(300), confirme: false}, marque: {ton: 'chaleureux, artisanal', couleurs: ['#8B4513', '#F5DEB3'], polices: ['Playfair Display'], notes: ''}});
  essai('changerEspace : métier nettoyé (précision bornée à 120, « à confirmer » gardé)', b.metier?.type === 'marque' && b.metier.precision.length === 120 && b.metier.confirme === false, b.metier);
  E.changerEspace('moi', {nom: 'Quelqu’un d’autre'});
  essai('« Moi » garde son nom', esp('moi').nom === 'Moi');
  essai('renommer un client comme un autre (autre casse), « Moi » ou « Personne » : refusé, comme à la création', leve(() => E.changerEspace(sansLettres.id, {nom: 'boulangerie LEMOINE'}), /existe déjà/) && leve(() => E.changerEspace(sansLettres.id, {nom: 'moi'}), /existe déjà/) && leve(() => E.changerEspace(sansLettres.id, {nom: 'Personne'}), /existe déjà/) && esp(sansLettres.id).nom === '東京', esp(sansLettres.id).nom);
  essai('… un client garde son propre nom, même écrit autrement, sans erreur', E.changerEspace(boulangerie.id, {nom: 'BOULANGERIE Lemoine'}).nom === 'BOULANGERIE Lemoine' && E.changerEspace(boulangerie.id, {nom: 'Boulangerie Lemoine'}).nom === 'Boulangerie Lemoine');

  const logoPng = path.join(T, 'logo-essai.PNG');
  fs.writeFileSync(logoPng, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  essai('un logo qui n’est pas une image est refusé', leve(() => E.poserLogo(boulangerie.id, path.join(T, 'logo.txt')), /image/));
  essai('un logo introuvable est refusé (sans faire tomber Dérush)', leve(() => E.poserLogo(boulangerie.id, path.join(T, 'absent.png'))));
  essai('« Personne » n’a pas de logo', leve(() => E.poserLogo('neutre', logoPng)));
  E.poserLogo(boulangerie.id, logoPng);
  b = E.changerEspace(boulangerie.id, {marque: {logo: '../../ailleurs.svg', ton: 'chaleureux, artisanal'}});
  essai('le logo est copié dans l’espace, et une marque reçue ne peut pas le changer', b.marque.logo === 'logo.png' && fs.existsSync(path.join(E.DOSSIER_ESPACES, boulangerie.id, 'marque', 'logo.png')) && E.cheminLogo(b) === path.join(E.DOSSIER_ESPACES, boulangerie.id, 'marque', 'logo.png'), b.marque);
  const dossierImage = path.join(T, 'dossier.png');
  fs.mkdirSync(dossierImage, {recursive: true});
  essai('un logo introuvable, ou un dossier nommé comme une image : une phrase simple, sans chemin ni anglais', leve(() => E.poserLogo(boulangerie.id, path.join(T, 'absent.png')), /^Ce logo est introuvable\.$/) && leve(() => E.poserLogo(boulangerie.id, dossierImage), /^Choisis un fichier image, pas un dossier\.$/));
  const logoRange = E.cheminLogo(esp(boulangerie.id));
  const illisible = path.join(T, 'illisible.png');
  fs.writeFileSync(illisible, 'x');
  fs.chmodSync(illisible, 0o000);
  // sur un système ou un compte qui lit tout quand même (Windows, root), il n'y a rien à essayer
  const vraimentIllisible = (() => { try { fs.readFileSync(illisible); return false; } catch { return true; } })();
  essai('une copie de logo ratée garde l’ancien logo (et le dit simplement)', !vraimentIllisible || (leve(() => E.poserLogo(boulangerie.id, illisible), /n’a pas pu être copié/) && fs.existsSync(logoRange) && esp(boulangerie.id).marque.logo === 'logo.png' && fs.readdirSync(path.dirname(logoRange)).join() === 'logo.png'), fs.readdirSync(path.dirname(logoRange)));
  fs.chmodSync(illisible, 0o644);
  E.poserLogo(boulangerie.id, logoRange);
  essai('choisir le logo déjà rangé ne l’efface pas', fs.existsSync(logoRange) && fs.statSync(logoRange).size === 8 && esp(boulangerie.id).marque.logo === 'logo.png');

  const silencieux = E.creerClient({nom: 'Client silencieux'});
  E.changerEspace(silencieux.id, {apprendre: false});
  essai('apprentissage coupé : apprend() devient faux', E.apprend(esp(silencieux.id)) === false && esp(silencieux.id).apprendre === false);

  const ephemere = E.creerClient({nom: 'Client éphémère'});
  K.ajouterLecons(['Une leçon du client éphémère, gardée à part.'], {espace: ephemere.id});
  E.noterDernier(ephemere.id);
  const Peph = new Projet(path.join(BIBLIO, 'Projet éphémère'));
  Peph.appliquer({titre: 'Projet éphémère', espace: ephemere.id});
  essai('un projet porte l’espace choisi', Peph.d.espace === ephemere.id && E.espaceDuProjet(Peph).id === ephemere.id);
  essai('« Moi » ne peut pas être retiré', leve(() => E.retirerEspace('moi'), /client/));
  essai('« Personne » ne peut pas être retiré', leve(() => E.retirerEspace('neutre'), /client/));
  essai('un espace inconnu ne peut pas être retiré', leve(() => E.retirerEspace('zz-inconnu'), /inconnu/));
  E.retirerEspace(ephemere.id);
  const retires = fs.readdirSync(path.join(E.DOSSIER_ESPACES, '.retires'));
  essai('retirer un client : il quitte la liste, son dossier part dans .retires (rien d’effacé)', !E.lireEspaces().espaces.some((e) => e.id === ephemere.id) && !fs.existsSync(path.join(E.DOSSIER_ESPACES, ephemere.id)) && retires.some((n) => n.startsWith(`${ephemere.id}-`)) && fs.existsSync(path.join(E.DOSSIER_ESPACES, '.retires', retires.find((n) => n.startsWith(ephemere.id)), 'carnet.json')), retires);
  essai('… le dernier espace choisi revient à « Moi », et ses projets passent à « Personne »', E.lireEspaces().dernier === 'moi' && E.espaceDuProjet(Peph).id === 'neutre');
  essai('espaceDuProjet : un projet d’avant les espaces (sans champ) est à « Moi »', E.espaceDuProjet({d: {}}).id === 'moi' && E.espaceDuProjet(null).id === 'moi');

  let devine = E.devinerMetier({niche: 'Chroniques de mangas et animes'});
  essai('devinerMetier d’après la niche du profil', devine?.type === 'chronique' && /niche/.test(devine.pourquoi), devine);
  devine = E.devinerMetier({titres: ['Fête de quartier', 'Atelier jeunesse MJC']});
  essai('devinerMetier d’après les titres des projets', devine?.type === 'association' && /titres/.test(devine.pourquoi), devine);
  essai('devinerMetier : rien à lire, ou rien de reconnu → null', E.devinerMetier({}) === null && E.devinerMetier({titres: ['zzz', 'qqq']}) === null);
  essai('devinerMetier ne lit que des mots entiers (« maison », « saison », « rapide », « livraison », « parcours » ne disent rien)', E.devinerMetier({titres: ['Visite de la maison', 'Saison 2 : le teaser']}) === null && E.devinerMetier({titres: ['Rapport annuel', 'Bilan de la saison']}) === null && E.devinerMetier({niche: 'Recettes rapides de saison'}) === null && E.devinerMetier({niche: 'Livraison de repas'}) === null && E.devinerMetier({niche: 'Parcours de reconversion professionnelle'}) === null);
  essai('devinerMetier : un seul titre ne suffit pas, deux oui ; les majuscules accentuées comptent', E.devinerMetier({titres: ['Mon clip']}) === null && E.devinerMetier({titres: ['Mon clip de rap', 'Concert au Zénith']})?.type === 'musique' && E.devinerMetier({niche: 'ÉMISSIONS et PODCASTS'})?.type === 'interview');

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Les fiches et les notes');
  E.changerEspace('moi', {metier: {type: 'chronique', precision: 'mangas japonais'}, marque: {ton: 'enthousiaste, univers manga et Japon', public: 'fans de manga', couleurs: ['#FFD60A', '#E63946'], polices: ['Anton']}});
  const P1 = new Projet(path.join(BIBLIO, 'Chronique Fire'));
  P1.appliquer({titre: 'Chronique manga — Fire !', espace: 'moi', brief: {type: 'face', objectif: 'Chronique du manga Fire !'}});
  const NOM1 = 'fire-claude-v1.mp4';
  const fiche1 = F.creerFiche({P: P1, espace: esp('moi'), version: {n: 1, moteur: 'claude', qualite: 'max', modele: 'claude-opus-5-5'},
    video: {nom: NOM1, titre: 'Fire ! — ma chronique manga', duree: 46.27, largeur: 1080, hauteur: 1920},
    table: {duree_s: 46, blocs: [{piste: 'plan', nom: 'Face caméra'}, {piste: 'texte', nom: 'Titre derrière la personne'}, {piste: 'son', nom: 'Musique rock', detail: 'boucle'}, {piste: 'son', nom: 'Page qui tourne'}, {piste: 'sous-titres', nom: 'Sous-titres'}, {piste: 'effet', nom: 'Zoom'}]},
    mesures: {accroche: {ok: true, hauteur_pct: 15.24, texte: 'FIRE !'}, brillance_db: -13.84, lufs: -14.02, rythme: {ok: true, debit_mots_min: 214, debut_parole_s: 0.2, pauses: [], hesitations: [{}], redites: []}},
    reponse: 'J’ai monté ta chronique.'});
  essai('creerFiche : la clé, l’espace et le métier du projet', fiche1.cle === F.cleVideo(P1, NOM1) && /^[0-9a-f]{14}$/.test(fiche1.cle) && fiche1.espace === 'moi' && fiche1.metier === 'chronique' && fiche1.projet === 'Chronique manga — Fire !' && fiche1.genre === 'face', fiche1);
  essai('creerFiche : ce qui a été monté (durée, format, musique, bruitages, textes, sous-titres)', fiche1.duree_s === 46.3 && fiche1.format.orientation === 'vertical' && JSON.stringify(fiche1.musique) === '["Musique rock"]' && fiche1.bruitages === 1 && fiche1.plans === 1 && fiche1.textes[0] === 'Titre derrière la personne' && fiche1.effets[0] === 'Zoom' && fiche1.sous_titres === true, fiche1);
  essai('creerFiche : ce qui a été mesuré (accroche, voix, son, rythme), et pas encore de note', fiche1.accroche?.grande === true && fiche1.accroche.hauteur_pct === 15.2 && fiche1.voix?.brillance_db === -13.8 && fiche1.son?.lufs === -14 && fiche1.rythme?.hesitations === 1 && fiche1.ia.modele === 'claude-opus-5-5' && fiche1.note === null && fiche1.mot === null, fiche1);
  const ficheNue = F.creerFiche({P: P1, espace: esp('moi'), video: {nom: 'nue.mp4', largeur: 1080, hauteur: 1080}});
  essai('creerFiche sans table ni mesures : rien d’inventé', ficheNue.format.orientation === 'carre' && ficheNue.accroche === null && ficheNue.rythme === null && ficheNue.musique.length === 0 && ficheNue.plans === null && ficheNue.sous_titres === false && ficheNue.table === false && ficheNue.titre_derriere === null, ficheNue);
  const ficheSansMesure = F.creerFiche({P: P1, espace: esp('moi'), video: {nom: 'sans-mesure.mp4', duree: null, largeur: null, hauteur: null}, mesures: {accroche: {ok: false, hauteur_pct: null, texte: ''}}});
  essai('creerFiche : une mesure qui manque reste inconnue (jamais « 0 s » ni « 0 % », ni « moins de 30 s » dans la recette)', ficheSansMesure.duree_s === null && ficheSansMesure.accroche.hauteur_pct === null && !('duree' in R.traits(ficheSansMesure)), ficheSansMesure);
  const ficheDetail = F.creerFiche({P: P1, espace: esp('moi'), video: {nom: 'detail.mp4'}, table: {blocs: [{piste: 'texte', nom: 'Titre d’intro', detail: '« SHIBUYA » derrière la personne, police Anton, jaune'}]}});
  const ficheAccroche = F.creerFiche({P: P1, espace: esp('moi'), video: {nom: 'accroche.mp4'}, table: {blocs: [{piste: 'texte', nom: 'Accroche'}]}});
  essai('le titre derrière la personne se lit sur le nom ET le détail du bloc ; un simple bloc « Accroche » n’en est pas un', ficheDetail.titre_derriere === true && R.traits(ficheDetail).titre_derriere === 'titre derrière la personne' && ficheAccroche.titre_derriere === false && !('titre_derriere' in R.traits(ficheAccroche)) && fiche1.titre_derriere === true, [ficheDetail.titre_derriere, ficheAccroche.titre_derriere]);
  essai('sans table de montage, la recette n’affirme pas « sans musique »', !('musique' in R.traits(ficheNue)) && R.traits(ficheAccroche).musique === 'sans musique' && R.traits(fiche1).musique === 'avec musique', R.traits(ficheNue));

  F.enregistrerFiche(P1, fiche1, esp('moi'));
  essai('enregistrerFiche : dans le projet et dans l’espace', fs.existsSync(path.join(P1.racine, '.derush', 'fiches', `${fiche1.cle}.json`)) && F.lireFiches('moi').length === 1);
  essai('ficheDe : la fiche d’une vidéo du projet, null pour une autre', F.ficheDe(P1, NOM1)?.cle === fiche1.cle && F.ficheDe(P1, 'inconnue.mp4') === null);
  F.enregistrerFiche(P1, {...fiche1, titre: 'Fire ! — livrée de nouveau'}, esp('moi'));
  fs.appendFileSync(path.join(E.DOSSIER_ESPACES, 'moi', 'fiches.jsonl'), 'pas du json\n{"type":"note","cle":"inconnue","note":1}\n\n');
  const lues = F.lireFiches('moi');
  essai('lireFiches : une vidéo livrée deux fois ne compte qu’une fois (la dernière), une ligne abîmée est sautée', lues.length === 1 && lues[0].titre === 'Fire ! — livrée de nouveau' && !('type' in lues[0]), lues);
  F.enregistrerFiche(P1, fiche1, esp('moi'));

  let f = F.noterVideo(P1, NOM1, {note: 1, mot: `  Plus   de Japon !  ${'y'.repeat(300)}`}, esp('moi'));
  essai('noterVideo : pouce levé (1), mot replié et borné à 200 signes', f.note === 1 && f.mot.length === 200 && f.mot.startsWith('Plus de Japon !') && F.lireFiches('moi')[0].note === 1, f);
  f = F.noterVideo(P1, NOM1, {note: -1, mot: ''}, esp('moi'));
  essai('noterVideo : pouce baissé (-1), sans mot', f.note === -1 && f.mot === null && F.lireFiches('moi')[0].note === -1 && F.lireFiches('moi')[0].mot === null);
  f = F.noterVideo(P1, NOM1, {note: 0}, esp('moi'));
  const f5 = F.noterVideo(P1, NOM1, {note: 5}, esp('moi'));
  essai('noterVideo : 0 (ou n’importe quoi d’autre) retire la note', f.note === null && f5.note === null && F.lireFiches('moi')[0].note === null);
  essai('noterVideo : une vidéo sans fiche est refusée', leve(() => F.noterVideo(P1, 'inconnue.mp4', {note: 1}, esp('moi')), /fiche/));
  f = F.noterVideo(P1, NOM1, {note: 1, mot: 'Plus de Japon et de néons de Tokyo !'}, esp('moi'));
  F.noterVideo(P1, NOM1, {note: -1, mot: 'noté depuis un autre espace'}, esp(boulangerie.id));
  essai('une note donnée sous un autre espace reste sur la fiche du projet, sans entrer dans cet espace', F.ficheDe(P1, NOM1).note === -1 && !F.lireFiches(boulangerie.id).some((x) => x.cle === fiche1.cle) && F.lireFiches('moi')[0].note === 1);
  F.noterVideo(P1, NOM1, {note: 1, mot: 'Plus de Japon et de néons de Tokyo !'}, esp('moi'));
  const lecon = F.leconDeNote(F.ficheDe(P1, NOM1));
  essai('leconDeNote : la phrase du carnet (titre, aimé, mot) ; rien sans mot', /« Fire ! — ma chronique manga » \(aimé\) : Plus de Japon/.test(lecon) && F.leconDeNote({note: 1}) === null && F.leconDeNote(null) === null, lecon);
  const pubYT = {reseau: 'youtube', lien: 'https://youtube.com/shorts/essaiYT0001', id: 'essaiYT0001', quand: ilYA(2)};
  F.rattacherPublication(P1, NOM1, pubYT, esp('moi'));
  F.rattacherPublication(P1, NOM1, {...pubYT, quand: ilYA(1)}, esp('moi'));
  F.rattacherPublication(P1, NOM1, {reseau: 'tiktok', lien: 'https://www.tiktok.com/@essai/video/7300000000000000001', id: '7300000000000000001', quand: ilYA(2)}, esp('moi'));
  essai('rattacherPublication : sans doublon, dans le projet et dans l’espace', F.ficheDe(P1, NOM1).publications.length === 2 && F.lireFiches('moi')[0].publications.length === 2, F.ficheDe(P1, NOM1).publications);
  essai('rattacherPublication : une vidéo sans fiche → null', F.rattacherPublication(P1, 'inconnue.mp4', pubYT, esp('moi')) === null);
  // un brouillon (ni lien ni identifiant), puis le lien de la vidéo publiée : une seule publication sur la fiche
  const corrections = E.creerClient({nom: 'Corrections essai'});
  const Pbr = {racine: path.join(T, 'brouillon-fiche'), d: {titre: 'Brouillon puis lien', cree_le: ilYA(3), brief: {}}};
  const ficheBr = F.creerFiche({P: Pbr, espace: esp(corrections.id), video: {nom: 'b.mp4', titre: 'Brouillon puis lien'}});
  F.enregistrerFiche(Pbr, ficheBr, esp(corrections.id));
  F.rattacherPublication(Pbr, 'b.mp4', {reseau: 'tiktok', lien: null, id: null, etat: 'brouillon', quand: ilYA(2)}, esp(corrections.id));
  F.rattacherPublication(Pbr, 'b.mp4', {reseau: 'tiktok', lien: '  https://www.tiktok.com/@essai/video/7300000000000000555 ', id: '7300000000000000555', quand: ilYA(1)}, esp(corrections.id));
  const pubsBr = F.ficheDe(Pbr, 'b.mp4').publications;
  essai('un brouillon puis le lien de la vidéo publiée : une seule publication sur la fiche (projet et espace), au lien propre', pubsBr.length === 1 && pubsBr[0].id === '7300000000000000555' && pubsBr[0].lien === 'https://www.tiktok.com/@essai/video/7300000000000000555' && F.lireFiches(corrections.id)[0].publications.length === 1, pubsBr);
  essai('ficheParCle : la fiche d’un espace par sa clé, rien sinon', F.ficheParCle(corrections.id, ficheBr.cle)?.video === 'b.mp4' && F.ficheParCle(corrections.id, 'inconnue') === null && F.ficheParCle('../ailleurs', ficheBr.cle) === null);
  F.noterVideo(Pbr, 'b.mp4', {note: 1, mot: 'Gardée en mémoire, mais relue'}, esp(corrections.id));
  essai('ficheParCle et lireFiches : gardées en mémoire, mais relues dès que le journal change (une note arrive)', F.ficheParCle(corrections.id, ficheBr.cle)?.mot === 'Gardée en mémoire, mais relue' && F.lireFiches(corrections.id)[0].note === 1, F.ficheParCle(corrections.id, ficheBr.cle));
  // l'espace n'apprenait pas à la livraison (son dossier n'existe pas encore), puis l'apprentissage est rallumé
  const rallume = E.creerClient({nom: 'Client rallumé'});
  E.changerEspace(rallume.id, {apprendre: false});
  const Pr = {racine: path.join(T, 'rallume'), d: {titre: 'Rallumé', cree_le: ilYA(2), brief: {}}};
  F.enregistrerFiche(Pr, F.creerFiche({P: Pr, espace: esp(rallume.id), video: {nom: 'r.mp4', titre: 'Rallumé'}}), esp(rallume.id));
  E.changerEspace(rallume.id, {apprendre: true});
  const sansDossier = !fs.existsSync(path.join(E.DOSSIER_ESPACES, rallume.id));
  let noteRallumee = null;
  try { noteRallumee = F.noterVideo(Pr, 'r.mp4', {note: 1, mot: 'bien'}, esp(rallume.id)); } catch (e) { noteRallumee = e; }
  essai('noter une vidéo dont l’espace n’a pas encore de dossier : la note passe (aucun « ENOENT »)', sansDossier && noteRallumee?.note === 1 && fs.existsSync(path.join(E.DOSSIER_ESPACES, rallume.id, 'fiches.jsonl')), String(noteRallumee?.message ?? noteRallumee));

  const Pn = new Projet(path.join(BIBLIO, 'Pour personne'));
  Pn.appliquer({titre: 'Pour personne', espace: 'neutre'});
  const ficheN = F.creerFiche({P: Pn, espace: esp('neutre'), video: {nom: 'neutre.mp4', titre: 'Neutre'}});
  F.enregistrerFiche(Pn, ficheN, esp('neutre'));
  F.noterVideo(Pn, 'neutre.mp4', {note: 1, mot: 'bien'}, esp('neutre'));
  essai('« Personne » : la fiche reste dans le projet, rien dans un espace', ficheN.espace === 'neutre' && F.ficheDe(Pn, 'neutre.mp4')?.note === 1 && !fs.existsSync(path.join(E.DOSSIER_ESPACES, 'neutre', 'fiches.jsonl')) && F.lireFiches('neutre').length === 0);
  const Ps = {racine: path.join(T, 'silencieux'), d: {titre: 'Silencieux', cree_le: ilYA(1), brief: {}}};
  F.enregistrerFiche(Ps, F.creerFiche({P: Ps, espace: esp(silencieux.id), video: {nom: 's.mp4'}}), esp(silencieux.id));
  essai('apprentissage coupé : la fiche reste dans le projet, pas dans l’espace', F.ficheDe(Ps, 's.mp4') !== null && F.lireFiches(silencieux.id).length === 0);

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Le suivi des vues');
  const liens = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3', {reseau: 'youtube', id: 'dQw4w9WgXcQ'}],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', {reseau: 'youtube', id: 'dQw4w9WgXcQ'}],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', {reseau: 'youtube', id: 'dQw4w9WgXcQ'}],
    ['https://youtube.com/shorts/abcDEF12345', {reseau: 'youtube', id: 'abcDEF12345'}],
    ['https://www.tiktok.com/@essai/video/7312345678901234567?lang=fr', {reseau: 'tiktok', id: '7312345678901234567'}],
    // le lien court de l'app, un compte, une publication photo : ils ne disent pas quelle vidéo c'est (jamais retrouvés chez Treg)
    ['https://vm.tiktok.com/ZMabc123/', null],
    ['https://www.tiktok.com/t/ZT8abcdEf/', null],
    ['https://www.tiktok.com/@essai', null],
    ['https://www.tiktok.com/@essai/photo/7300000000000000123', null],
    ['https://www.instagram.com/reel/C1a2b3c4d5/', {reseau: 'instagram', id: 'C1a2b3c4d5'}],
    ['https://www.instagram.com/essai/reel/C9abcdEFgh/', {reseau: 'instagram', id: 'C9abcdEFgh'}],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ', {reseau: 'youtube', id: 'dQw4w9WgXcQ'}],
    // un autre site qui finit comme un réseau, un autre protocole que https
    ['https://fauxyoutube.com/watch?v=dQw4w9WgXcQ', null],
    ['https://pas-tiktok.com/@x/video/7311111111111111111', null],
    ['https://evilinstagram.com/reel/AbCdEf123/', null],
    ['https://www.youtube.com.exemple.net/watch?v=dQw4w9WgXcQ', null],
    ['http://www.youtube.com/watch?v=dQw4w9WgXcQ', null],
    ['javascript://linkedin.com/%0aalert(1)', null],
    ['ftp://evillinkedin.com/x', null],
    ['https://www.instagram.com/p/C9z8y7x6/?img_index=1', {reseau: 'instagram', id: 'C9z8y7x6'}],
    ['https://www.linkedin.com/posts/quelqu-un_activity-7123', {reseau: 'linkedin', id: null}],
    ['https://www.youtube.com/@chaine', null],
    ['https://www.instagram.com/compte/', null],
    ['https://example.com/video/123456789', null],
    ['pas un lien', null],
    ['', null],
  ];
  for (const [l, attendu] of liens) {
    const trouve = Su.idDepuisLien(l);
    essai(`idDepuisLien « ${l || '(vide)'} »`, JSON.stringify(trouve) === JSON.stringify(attendu), trouve);
  }

  const cleYT = Su.enregistrerPublication('moi', {lien: 'https://youtube.com/shorts/essaiYT0001', cle_fiche: fiche1.cle, titre: fiche1.titre, projet: P1.d.titre, publie_le: ilYA(2)});
  const cleYT2 = Su.enregistrerPublication('moi', {lien: 'https://www.youtube.com/watch?v=essaiYT0001', titre: 'Titre changé'});
  essai('enregistrerPublication : une vidéo déjà suivie est mise à jour, jamais doublée', cleYT === 'youtube:essaiYT0001' && cleYT2 === cleYT && Object.keys(Su.lireSuivi('moi').publications).length === 1 && Su.lireSuivi('moi').publications[cleYT].titre === 'Titre changé' && Su.lireSuivi('moi').publications[cleYT].cle_fiche === fiche1.cle && Su.lireSuivi('moi').publications[cleYT].suivi === 'treg', Su.lireSuivi('moi'));
  const cleTT = Su.enregistrerPublication('moi', {lien: 'https://www.tiktok.com/@essai/video/7300000000000000001', titre: 'Kaze, ma chronique', publie_le: ilYA(2)});
  const datePub = ilYA(2);
  const cleBrouillon = Su.enregistrerPublication('moi', {reseau: 'tiktok', cle_fiche: 'brouillonessai', titre: 'Les shôjo des années soixante-dix', legende: 'Ma sélection patrimoine', etat: 'brouillon', publie_le: datePub});
  const cleIG = Su.enregistrerPublication('moi', {lien: 'https://www.instagram.com/reel/Cessai12345/', publie_le: ilYA(2)});
  essai('enregistrerPublication : TikTok, brouillon sans lien (clé de sa fiche), Instagram suivi par l’IA', cleTT === 'tiktok:7300000000000000001' && cleBrouillon === 'tiktok:brouillon-brouillonessai' && cleIG === 'instagram:Cessai12345' && Su.lireSuivi('moi').publications[cleIG].suivi === 'ia', [cleTT, cleBrouillon, cleIG]);
  essai('enregistrerPublication : « Personne », un espace qui n’apprend plus, un espace inconnu ou un lien inconnu → null',
    Su.enregistrerPublication('neutre', {lien: 'https://youtu.be/dQw4w9WgXcQ'}) === null && Su.enregistrerPublication(silencieux.id, {lien: 'https://youtu.be/dQw4w9WgXcQ'}) === null
    && Su.enregistrerPublication('zz-inconnu', {lien: 'https://youtu.be/dQw4w9WgXcQ'}) === null && Su.enregistrerPublication('moi', {lien: 'https://example.com/v'}) === null
    && !fs.existsSync(path.join(E.DOSSIER_ESPACES, 'neutre', 'suivi.json')));

  const t0 = Date.parse('2026-10-01T12:00:00.000Z');
  const dd = {publications: {a: {cle: 'a', publie_le: new Date(t0).toISOString(), lectures: []}, futur: {cle: 'futur', publie_le: new Date(t0 + 5 * JOUR).toISOString(), lectures: []}}};
  essai('lecturesDues : rien avant J+1 (ni pour une date à venir)', Su.lecturesDues(dd, t0 + 0.5 * JOUR).length === 0);
  essai('lecturesDues : J+1', JSON.stringify(Su.lecturesDues(dd, t0 + 1.2 * JOUR)) === '[{"cle":"a","jours":1}]', Su.lecturesDues(dd, t0 + 1.2 * JOUR));
  dd.publications.a.lectures = [{jours: 1, quand: new Date(t0 + 1.2 * JOUR).toISOString(), vues: 10}];
  essai('lecturesDues : J+1 lu, rien de plus avant J+7 (jamais deux fois)', Su.lecturesDues(dd, t0 + 3 * JOUR).length === 0);
  essai('lecturesDues : J+7 puis J+30', Su.lecturesDues(dd, t0 + 7.5 * JOUR)[0]?.jours === 7 && Su.lecturesDues(dd, t0 + 31 * JOUR)[0]?.jours === 30);
  const tard = {publications: {b: {cle: 'b', publie_le: new Date(t0).toISOString(), lectures: []}}};
  essai('lecturesDues : vue tard, une seule lecture (la plus récente échéance)', JSON.stringify(Su.lecturesDues(tard, t0 + 40 * JOUR)) === '[{"cle":"b","jours":30}]', Su.lecturesDues(tard, t0 + 40 * JOUR));
  essai('lecturesDues forcée : pas deux fois en 6 h, puis de nouveau', Su.lecturesDues(dd, t0 + 1.3 * JOUR, {force: true}).length === 0 && Su.lecturesDues(dd, t0 + 1.6 * JOUR, {force: true})[0]?.jours === 1 && Su.lecturesDues(tard, t0 + 100 * JOUR, {force: true}).length === 1);
  essai('multiple : vues ÷ médiane, arrondi ; null sans médiane ou sans vues', Su.multiple(2200, 1000) === 2.2 && Su.multiple(1000, 3000) === 0.33 && Su.multiple(null, 1000) === null && Su.multiple(100, 0) === null && Su.multiple(100, null) === null);
  essai('raisonLienRefuse : une phrase qui dit quoi coller (lien court, compte, photo TikTok ; sinon la phrase générale)', /lien court de TikTok/.test(Su.raisonLienRefuse('https://vm.tiktok.com/ZMabc123/')) && /lien court/.test(Su.raisonLienRefuse('https://www.tiktok.com/t/ZT8abcdEf/')) && /compte TikTok/.test(Su.raisonLienRefuse('https://www.tiktok.com/@essai')) && /photo/.test(Su.raisonLienRefuse('https://www.tiktok.com/@essai/photo/7300000000000000123')) && /YouTube, TikTok, Instagram ou LinkedIn/.test(Su.raisonLienRefuse('https://example.com/x')) && /YouTube/.test(Su.raisonLienRefuse('pas un lien')));
  essai('lienPropre : une adresse https entière, sinon rien', Su.lienPropre('  https://youtu.be/dQw4w9WgXcQ ') === 'https://youtu.be/dQw4w9WgXcQ' && Su.lienPropre('http://youtu.be/x') === null && Su.lienPropre('javascript:alert(1)') === null && Su.lienPropre(null) === null && Su.lienPropre(`https://youtu.be/${'x'.repeat(500)}`) === null);
  const apresJ30 = {publications: {c: {cle: 'c', publie_le: new Date(t0).toISOString(), lectures: [{jours: 30, quand: new Date(t0 + 31 * JOUR).toISOString(), vues: 5000}]}}};
  const apresJ7 = {publications: {e: {cle: 'e', publie_le: new Date(t0).toISOString(), lectures: [{jours: 7, quand: new Date(t0 + 10 * JOUR).toISOString(), vues: 1}]}}};
  essai('lecturesDues : une étape manquée n’est pas relue après coup (ni J+7 et J+1 après J+30, ni J+1 après J+7)', Su.lecturesDues(apresJ30, t0 + 31.2 * JOUR).length === 0 && Su.lecturesDues(apresJ7, t0 + 10.2 * JOUR).length === 0, [Su.lecturesDues(apresJ30, t0 + 31.2 * JOUR), Su.lecturesDues(apresJ7, t0 + 10.2 * JOUR)]);
  essai('derniereLecture : la plus récente, pas la plus haute en jours', Su.derniereLecture({lectures: [{jours: 1, quand: '2026-11-03T00:00:00.000Z', vues: 9}, {jours: 30, quand: '2026-11-01T00:00:00.000Z', vues: 5}]})?.vues === 9 && Su.derniereLecture({lectures: []}) === null && Su.derniereLecture(null) === null);
  // retrouver un brouillon : une vraie ressemblance, jamais des mots vides, jamais une vidéo déjà prise
  const tb0 = Date.now() - 2 * JOUR;
  const brA = {titre: 'Ma chronique du tome 3', legende: 'Ce que je pense du tome 3, pour vous', publie_le: new Date(tb0).toISOString()};
  const brB = {titre: 'Les shôjo des années 70', legende: 'Ma sélection patrimoine, pour vous dans cette vidéo', publie_le: new Date(tb0 + 600e3).toISOString()};
  const vidsA = {'7300000000000000009': {vues: 12000, texte: 'Ce que je pense du tome 3, pour vous dans cette vidéo #manga', publie_le: new Date(tb0 + 3600e3).toISOString()}};
  essai('retrouverBrouillon : la vidéo du brouillon publié, rien pour celui qui ne l’est pas (« pour », « vous », « dans », « cette » ne prouvent rien)', Su.retrouverBrouillon(brA, vidsA) === '7300000000000000009' && Su.retrouverBrouillon(brB, vidsA) === null, [Su.retrouverBrouillon(brA, vidsA), Su.retrouverBrouillon(brB, vidsA)]);
  const brMairie = {titre: 'Atelier jeunes', legende: 'Découvrez notre atelier pour les jeunes du quartier, avec la mairie', publie_le: new Date(tb0).toISOString()};
  const vidsPerso = {'7311111111111111111': {vues: 9000, texte: 'pour moi c’est notre manga de l’année, avec un final dingue', publie_le: new Date(tb0 + 3600e3).toISOString()}};
  essai('retrouverBrouillon : le brouillon d’un client n’est pas « retrouvé » dans une vidéo perso qui partage « pour », « notre », « avec »', Su.retrouverBrouillon(brMairie, vidsPerso) === null);
  essai('retrouverBrouillon : jamais une vidéo déjà prise, publiée avant le brouillon ou plus de 30 jours après, ni deux vidéos à égalité', Su.retrouverBrouillon(brA, vidsA, {pris: new Set(['7300000000000000009'])}) === null
    && Su.retrouverBrouillon(brA, {x: {...vidsA['7300000000000000009'], publie_le: new Date(tb0 - 2 * JOUR).toISOString()}}) === null
    && Su.retrouverBrouillon({...brA, publie_le: new Date(tb0 - 40 * JOUR).toISOString()}, vidsA) === null
    && Su.retrouverBrouillon(brA, {...vidsA, '7300000000000000010': {...vidsA['7300000000000000009']}}) === null);

  const nIA = Su.rangerChiffresIA('moi', [{cle: cleIG, vues: 900, jaime: '45', enregistrements: 30, inconnu: 7}, {cle: 'instagram:inconnue', vues: 5}, {cle: cleIG}], {medianes: {instagram: {valeur: 600, n: 12}}});
  const ig = Su.lireSuivi('moi').publications[cleIG];
  essai('rangerChiffresIA : les chiffres lus par l’IA (J+1), une clé inconnue ou sans chiffres ignorée, la médiane gardée', nIA === 1 && ig.lectures.length === 1 && ig.lectures[0].jours === 1 && ig.lectures[0].par === 'ia' && ig.lectures[0].vues === 900 && ig.lectures[0].jaime === 45 && !('inconnu' in ig.lectures[0]) && Su.lireSuivi('moi').medianes.instagram?.valeur === 600, ig);

  // le faux compte : la vidéo publiée il y a deux jours, et des vidéos plus anciennes pour la médiane
  chaineYouTube.essaiYT0001 = {vues: 2500, publie: ilYA(2)};
  for (const [k, vues] of [800, 1000, 1000, 1200, 1500].entries()) chaineYouTube[`ancienne000${k}`] = {vues, publie: ilYA(60 + k)};
  const enSecondes = (iso) => Math.floor(Date.parse(iso) / 1000);
  compteTikTok.push(
    {id: '7300000000000000001', title: 'Kaze to Ki no Uta, ma chronique', create_time: enSecondes(ilYA(2)), view_count: 1500, like_count: 90, comment_count: 9, share_count: 4, share_url: 'https://www.tiktok.com/@essai/video/7300000000000000001'},
    {id: '7300000000000000002', title: 'Les shôjo des années soixante-dix, ma sélection', create_time: enSecondes(datePub) + 600, view_count: 250, like_count: 10, comment_count: 1, share_count: 0, share_url: 'https://www.tiktok.com/@essai/video/7300000000000000002'},
    ...[400, 500, 600].map((v, k) => ({id: `720000000000000000${k}`, title: `Ancienne ${k}`, create_time: enSecondes(ilYA(30 + k)), view_count: v, like_count: 1, comment_count: 0, share_count: 0, share_url: `https://www.tiktok.com/@essai/video/720000000000000000${k}`})));

  let rc = await Su.relireChiffres('moi', {cle: null, base: BASE});
  essai('relireChiffres sans clé Treg : rien n’est lu, rien n’est envoyé (sans_cle)', rc.sans_cle === true && rc.lues === 0 && rc.erreurs.length === 0 && journal.length === 0, rc);
  scenario = 'cle';
  rc = await Su.relireChiffres('moi', {cle: CLE, base: BASE});
  essai('Treg refuse la clé : l’erreur est dite pour chaque réseau, sans planter', rc.lues === 0 && rc.erreurs.length === 2 && rc.erreurs.some((x) => /^YouTube : Treg ne reconnaît pas ta clé/.test(x)) && rc.erreurs.some((x) => /^TikTok : Treg ne reconnaît pas ta clé/.test(x)) && rc.sans_cle === false, rc);
  scenario = 'panne';
  rc = await Su.relireChiffres('moi', {cle: CLE, base: BASE});
  essai('Treg en panne (500) : dans les erreurs, sans planter, et rien n’est marqué lu', rc.lues === 0 && rc.erreurs.length === 2 && rc.erreurs.every((x) => /Treg a répondu 500/.test(x)) && Su.lecturesDues(Su.lireSuivi('moi')).filter((x) => x.cle !== cleIG).length === 3, rc);
  scenario = 'normal';
  const avantNormal = journal.length;
  rc = await Su.relireChiffres('moi', {cle: CLE, base: BASE});
  const suivi = Su.lireSuivi('moi');
  essai('relireChiffres avec le faux Treg : YouTube, TikTok et le brouillon sont lus (J+1)', rc.lues === 3 && rc.erreurs.length === 0 && suivi.publications[cleYT].lectures.at(-1)?.vues === 2500 && suivi.publications[cleYT].lectures.at(-1)?.jours === 1 && suivi.publications[cleTT].lectures.at(-1)?.partages === 4, rc);
  essai('un brouillon TikTok (sans lien) est retrouvé par sa date et sa légende', suivi.publications[cleBrouillon].id === '7300000000000000002' && suivi.publications[cleBrouillon].lectures.at(-1)?.vues === 250, suivi.publications[cleBrouillon]);
  essai('Instagram n’est pas lu par la porte directe (il reste à l’IA)', suivi.publications[cleIG].lectures.length === 1 && suivi.publications[cleIG].lectures[0].par === 'ia');
  essai('les médianes des comptes : YouTube sur ses vidéos de plus de 3 jours, TikTok aussi', suivi.medianes.youtube?.valeur === 1000 && suivi.medianes.youtube.n === 5 && suivi.medianes.tiktok?.valeur === 500 && suivi.medianes.tiktok.n === 3, suivi.medianes);
  const avec = Object.fromEntries(Su.publicationsAvecChiffres('moi').map((p) => [p.cle, p.multiple]));
  essai('publicationsAvecChiffres : le multiple de chaque vidéo', avec[cleYT] === 2.5 && avec[cleTT] === 3 && avec[cleBrouillon] === 0.5 && avec[cleIG] === 1.5, avec);
  // un client : ses vidéos ne se comparent jamais à la chaîne de la personne, mais entre elles (3 au moins)
  const clubMed = E.creerClient({nom: 'Club essai médianes'});
  const clesClub = ['ancienne0000', 'ancienne0001', 'ancienne0002'].map((id) => Su.enregistrerPublication(clubMed.id, {lien: `https://www.youtube.com/watch?v=${id}`, titre: id, publie_le: ilYA(2)}));
  const rcClub = await Su.relireChiffres(clubMed.id, {cle: CLE, base: BASE});
  const suiviClub = Su.lireSuivi(clubMed.id);
  const pubsClub = Su.publicationsAvecChiffres(clubMed.id);
  essai('un client : ses vues lues, mais pas la médiane de la chaîne de la personne', rcClub.lues === 3 && !suiviClub.medianes.youtube, {rcClub, medianes: suiviClub.medianes});
  essai('un client : multiple contre la médiane de ses propres vidéos suivies (source « espace »)', pubsClub.length === 3 && pubsClub.every((p) => p.source_mediane === 'espace' && p.mediane === 1000) && pubsClub.find((p) => p.cle === clesClub[0])?.multiple === 0.8, pubsClub.map((p) => [p.cle, p.mediane, p.source_mediane, p.multiple]));
  essai('« Moi » : la médiane du compte (source « compte »)', Su.publicationsAvecChiffres('moi').find((p) => p.cle === cleYT)?.source_mediane === 'compte');
  E.retirerEspace(clubMed.id);
  const faits = journal.slice(avantNormal);
  essai('Treg n’est appelé qu’en lecture, avec la clé, sur les fiches attendues', faits.length >= 4 && faits.every((x) => x.cle === CLE && LECTURES_PERMISES.has(x.chemin)) && faits.find((x) => x.chemin === '/call/tiktok.tiktok.user.videos')?.methode === 'POST' && JSON.parse(faits.find((x) => x.chemin === '/call/tiktok.tiktok.user.videos').corps).max_count === 20, faits.map((x) => x.chemin));
  const avantRelecture = journal.length;
  rc = await Su.relireChiffres('moi', {cle: CLE, base: BASE});
  essai('relu une fois : rien n’est relu, et Treg n’est pas appelé', rc.lues === 0 && journal.length === avantRelecture, rc);

  // ——— dans un espace à part : la même vidéo jamais suivie deux fois, la vraie date, ce qui reste introuvable ———
  const SE = E.creerClient({nom: 'Suivi essai'}).id;
  const dateBr = ilYA(2);
  const cleBr2 = Su.enregistrerPublication(SE, {reseau: 'tiktok', cle_fiche: 'fichefusion', titre: 'Le pain au levain', legende: 'Notre recette du pain au levain, pas à pas', etat: 'brouillon', publie_le: dateBr});
  compteTikTok.push({id: '7300000000000000555', title: 'Notre recette du pain au levain, pas à pas', create_time: enSecondes(dateBr) + 900, view_count: 10000, like_count: 5, comment_count: 1, share_count: 0, share_url: 'https://www.tiktok.com/@essai/video/7300000000000000555'});
  await Su.relireChiffres(SE, {cle: CLE, base: BASE});
  const cleLien = Su.enregistrerPublication(SE, {lien: 'https://www.tiktok.com/@essai/video/7300000000000000555', cle_fiche: 'fichefusion', titre: 'Le pain au levain'});
  const fusion = Su.lireSuivi(SE).publications;
  essai('un brouillon retrouvé, puis lié par son lien : une seule publication, avec ses lectures (ses vues ne comptent pas double)', cleBr2 === 'tiktok:brouillon-fichefusion' && cleLien === 'tiktok:7300000000000000555' && Object.keys(fusion).join() === cleLien && fusion[cleLien].lectures.length === 1 && fusion[cleLien].lectures[0].vues === 10000 && fusion[cleLien].etat === 'publie' && fusion[cleLien].legende?.startsWith('Notre recette'), fusion);
  const cleBr3 = Su.enregistrerPublication(SE, {reseau: 'tiktok', cle_fiche: 'fichefusion2', titre: 'Jamais retrouvé', etat: 'brouillon', publie_le: ilYA(1)});
  const cleLien3 = Su.enregistrerPublication(SE, {lien: 'https://www.tiktok.com/@essai/video/7300000000000000556', cle_fiche: 'fichefusion2'});
  essai('le lien collé prend la place du brouillon de la même fiche, même jamais retrouvé', !Su.lireSuivi(SE).publications[cleBr3] && Su.lireSuivi(SE).publications[cleLien3]?.titre === 'Jamais retrouvé' && Object.keys(Su.lireSuivi(SE).publications).length === 2, Object.keys(Su.lireSuivi(SE).publications));
  const redit = Su.enregistrerPublication(SE, {reseau: 'tiktok', cle_fiche: 'brouillon-redit', titre: 'Redit', etat: 'brouillon', publie_le: ilYA(1)});
  const suiviRedit = lire(path.join(E.DOSSIER_ESPACES, SE, 'suivi.json'));
  suiviRedit.publications[redit].id = '7300000000000000999';
  fs.writeFileSync(path.join(E.DOSSIER_ESPACES, SE, 'suivi.json'), JSON.stringify(suiviRedit));
  Su.enregistrerPublication(SE, {reseau: 'tiktok', cle_fiche: 'brouillon-redit', titre: 'Redit', etat: 'brouillon', publie_le: ilYA(1)});
  essai('un brouillon redit garde l’identifiant qu’on lui avait retrouvé', Su.lireSuivi(SE).publications[redit].id === '7300000000000000999');
  const sansRedit = lire(path.join(E.DOSSIER_ESPACES, SE, 'suivi.json'));
  delete sansRedit.publications[redit];
  fs.writeFileSync(path.join(E.DOSSIER_ESPACES, SE, 'suivi.json'), JSON.stringify(sansRedit));
  // une vidéo publiée il y a 40 jours, liée aujourd'hui : sa vraie date, et la bonne étape
  chaineYouTube.vieilleYT001 = {vues: 9000, publie: ilYA(40)};
  const cleVieille = Su.enregistrerPublication(SE, {lien: 'https://youtu.be/vieilleYT001', titre: 'Liée 40 jours après'});
  rc = await Su.relireChiffres(SE, {cle: CLE, base: BASE, force: true});
  const vieille = Su.lireSuivi(SE).publications[cleVieille];
  essai('une vidéo liée après coup prend sa vraie date de publication (dite par le réseau), et sa lecture la bonne étape', Math.abs(Date.parse(vieille.publie_le) - Date.parse(chaineYouTube.vieilleYT001.publie)) < 1000 && vieille.lectures.length === 1 && vieille.lectures[0].jours === 30 && vieille.lectures[0].vues === 9000, vieille);
  // une vidéo que Treg ne retrouve pas (retirée, privée) : de moins en moins d'essais, puis plus du tout
  const cleAbsente = Su.enregistrerPublication(SE, {lien: 'https://youtu.be/absenteYT01', titre: 'Retirée de YouTube', publie_le: ilYA(2)});
  let avantAbs = journal.length;
  rc = await Su.relireChiffres(SE, {cle: CLE, base: BASE});
  const abs1 = Su.lireSuivi(SE).publications[cleAbsente];
  const appels1 = journal.length - avantAbs;
  avantAbs = journal.length;
  await Su.relireChiffres(SE, {cle: CLE, base: BASE});
  essai('une vidéo que Treg ne retrouve pas : l’essai vain est noté, et le tour suivant ne rappelle pas Treg', rc.lues === 0 && rc.erreurs.length === 0 && abs1.essais_vains === 1 && !abs1.introuvable && appels1 === 1 && journal.length === avantAbs, {rc, abs1, appels1, ensuite: journal.length - avantAbs});
  const suiviAbs = Su.lireSuivi(SE);
  essai('… elle est réessayée un jour plus tard, pas avant', !Su.lecturesDues(suiviAbs, Date.now() + 0.5 * JOUR).some((x) => x.cle === cleAbsente) && Su.lecturesDues(suiviAbs, Date.now() + 1.1 * JOUR).some((x) => x.cle === cleAbsente));
  await Su.relireChiffres(SE, {cle: CLE, base: BASE, maintenant: Date.now() + 50 * JOUR});
  const abs2 = Su.lireSuivi(SE).publications[cleAbsente];
  essai('… puis plus du tout passé 45 jours (« introuvable »), sauf si la personne le demande ; le tableau le sait', abs2.essais_vains === 2 && abs2.introuvable === true && !Su.lecturesDues(Su.lireSuivi(SE), Date.now() + 60 * JOUR).some((x) => x.cle === cleAbsente) && Su.lecturesDues(Su.lireSuivi(SE), Date.now() + 60 * JOUR, {force: true}).some((x) => x.cle === cleAbsente) && Su.publicationsAvecChiffres(SE).find((p) => p.cle === cleAbsente)?.introuvable === true, abs2);
  // deux brouillons qui se ressemblent, une seule vidéo publiée
  const SD = E.creerClient({nom: 'Suivi deux brouillons'}).id;
  const dateD = ilYA(2);
  const cleD1 = Su.enregistrerPublication(SD, {reseau: 'tiktok', cle_fiche: 'deuxa', titre: 'Chronique manga : Blue Lock tome 3', etat: 'brouillon', publie_le: dateD});
  const cleD2 = Su.enregistrerPublication(SD, {reseau: 'tiktok', cle_fiche: 'deuxb', titre: 'Chronique manga : Fire Force tome 3', etat: 'brouillon', publie_le: dateD});
  compteTikTok.push({id: '7300000000000000777', title: 'Chronique manga : Fire Force tome 3', create_time: enSecondes(dateD) + 1200, view_count: 12000, like_count: 8, comment_count: 1, share_count: 0, share_url: 'https://www.tiktok.com/@essai/video/7300000000000000777'});
  rc = await Su.relireChiffres(SD, {cle: CLE, base: BASE});
  const deux = Su.lireSuivi(SD).publications;
  essai('deux brouillons qui se ressemblent : la vidéo publiée va à celui qui lui ressemble le plus, jamais aux deux', rc.lues === 1 && deux[cleD2].id === '7300000000000000777' && deux[cleD2].lectures[0]?.vues === 12000 && !deux[cleD1].id && deux[cleD1].lectures.length === 0 && deux[cleD1].essais_vains === 1, deux);
  // Treg lent : deux relectures en même temps, et une publication liée pendant l'attente
  const SL = E.creerClient({nom: 'Suivi lent'}).id;
  chaineYouTube.lenteYT0001 = {vues: 1000, publie: ilYA(2)};
  chaineYouTube.lenteYT0002 = {vues: 2000, publie: ilYA(2)};
  const cleLente = Su.enregistrerPublication(SL, {lien: 'https://youtu.be/lenteYT0001', publie_le: ilYA(2)});
  scenario = 'lent';
  const avantLent = journal.length;
  const premiere = Su.relireChiffres(SL, {cle: CLE, base: BASE});
  const seconde = Su.relireChiffres(SL, {cle: CLE, base: BASE});
  await new Promise((ok) => setTimeout(ok, 80));
  const clePendant = Su.enregistrerPublication(SL, {lien: 'https://youtu.be/lenteYT0002', titre: 'Liée pendant la relecture', publie_le: ilYA(2)});
  const [rl1, rl2] = await Promise.all([premiere, seconde]);
  scenario = 'normal';
  const apresLent = Su.lireSuivi(SL).publications;
  essai('une publication liée pendant une relecture n’est pas effacée par elle', apresLent[clePendant]?.titre === 'Liée pendant la relecture' && apresLent[cleLente]?.lectures.length === 1, Object.keys(apresLent));
  essai('deux relectures du même espace en même temps : Treg n’est appelé qu’une fois, la seconde reçoit le résultat de la première', rl1.lues === 1 && rl2 === rl1 && journal.length - avantLent === 1, [rl1, rl2, journal.length - avantLent]);
  // Treg injoignable : une phrase simple
  Su.enregistrerPublication(SL, {lien: 'https://www.tiktok.com/@essai/video/7300000000000000001', publie_le: ilYA(2)});
  rc = await Su.relireChiffres(SL, {cle: CLE, base: 'http://127.0.0.1:1', force: true, maintenant: Date.now() + JOUR});
  essai('Treg injoignable : une seule phrase simple (ni « ECONNREFUSED », ni la même erreur dite pour chaque réseau), et ce n’est pas un essai vain', rc.lues === 0 && rc.erreurs.length === 1 && /Treg ne répond pas pour l’instant/.test(rc.erreurs[0]) && !/ECONN|connect|YouTube|TikTok/.test(rc.erreurs[0]) && !Su.lireSuivi(SL).publications[clePendant].essais_vains, rc);
  // ce que l'IA rend : « __proto__ », « null »
  const cleIG2 = Su.enregistrerPublication(SL, {lien: 'https://www.instagram.com/reel/Cnulle12345/', publie_le: ilYA(8)});
  const nNul = Su.rangerChiffresIA(SL, [{cle: '__proto__', vues: 999}, {cle: 'constructor', vues: 5}, {cle: cleIG2, vues: null, jaime: 12}], {medianes: {instagram: {valeur: null, n: 0}, tiktok: {valeur: 0, n: 0}}});
  const ig2 = Su.lireSuivi(SL).publications[cleIG2];
  essai('rangerChiffresIA : une clé « __proto__ » rendue par l’IA ne touche à rien', nNul === 1 && ({}).lectures === undefined && !Object.hasOwn(Su.lireSuivi(SL).publications, '__proto__'), ({}).lectures);
  essai('rangerChiffresIA : un « null » de l’IA reste inconnu (ni « 0 vue », ni médiane à 0)', ig2.lectures.length === 1 && !('vues' in ig2.lectures[0]) && ig2.lectures[0].jaime === 12 && !Su.lireSuivi(SL).medianes.instagram && !Su.lireSuivi(SL).medianes.tiktok, {ig2, medianes: Su.lireSuivi(SL).medianes});
  const MZ = E.creerClient({nom: 'Médiane zéro'}).id;
  for (const [k, v] of [600, 1000, 1400].entries()) Su.rangerChiffresIA(MZ, [{cle: Su.enregistrerPublication(MZ, {lien: `https://www.instagram.com/reel/Czero0000${k}/`, publie_le: ilYA(8)}), vues: v}]);
  const suiviZero = lire(path.join(E.DOSSIER_ESPACES, MZ, 'suivi.json'));
  suiviZero.medianes.instagram = {valeur: 0, n: 0, par: 'ia'};
  fs.writeFileSync(path.join(E.DOSSIER_ESPACES, MZ, 'suivi.json'), JSON.stringify(suiviZero));
  essai('une médiane à 0 déjà rangée ne cache pas celle des vidéos de l’espace', Su.publicationsAvecChiffres(MZ).every((p) => p.mediane === 1000 && p.source_mediane === 'espace' && p.multiple != null), Su.publicationsAvecChiffres(MZ).map((p) => [p.mediane, p.source_mediane, p.multiple]));

  // ————————————————————————————————————————————————————————————————————————————————
  titre('La recette qui marche');
  const atelierRecette = E.creerClient({nom: 'Atelier Recette', metier: {type: 'tuto'}});
  const fichesR = [];
  for (let i = 0; i < 6; i++) {
    const P = {racine: path.join(T, 'recette', `projet-${i}`), d: {titre: `Recette ${i}`, cree_le: ilYA(20 - i), mode: 'montage', brief: {type: i < 3 ? 'face' : 'trend', objectif: `Sujet ${i}`}}};
    const fr = F.creerFiche({P, espace: esp(atelierRecette.id), version: {n: 1, moteur: 'claude', qualite: 'max'}, video: {nom: `recette-${i}.mp4`, titre: `Recette ${i}`, duree: i < 4 ? 40 : 75, largeur: 1080, hauteur: 1920},
      table: {blocs: [{piste: 'son', nom: 'Musique douce'}, ...(i < 2 ? [{piste: 'texte', nom: 'Titre derrière la personne'}] : [])]},
      mesures: {accroche: {ok: i < 4, hauteur_pct: i < 4 ? 14 : 4, texte: 'ACCROCHE'}}});
    fr.quand = ilYA(15 - i);
    F.enregistrerFiche(P, fr, esp(atelierRecette.id));
    const cle = Su.enregistrerPublication(atelierRecette.id, {lien: `https://youtube.com/shorts/recette-${i}xx`, cle_fiche: fr.cle, titre: fr.titre, publie_le: ilYA(15 - i)});
    Su.rangerChiffresIA(atelierRecette.id, [{cle, vues: i < 4 ? 2200 : 750}], {medianes: {youtube: {valeur: 1000, n: 30}}});
    fichesR.push({P, fr});
  }
  F.noterVideo(fichesR[0].P, 'recette-0.mp4', {note: 1, mot: 'Exactement le ton voulu'}, esp(atelierRecette.id));
  F.noterVideo(fichesR[5].P, 'recette-5.mp4', {note: -1, mot: 'Trop long'}, esp(atelierRecette.id));
  const st = R.statistiques(atelierRecette.id);
  const groupe = (trait, valeur) => st.groupes.find((x) => x.trait === trait && x.valeur === valeur);
  essai('statistiques : 6 montages, 6 mesurés', st.n_montages === 6 && st.n_mesures === 6, st);
  essai('un trait commun à toutes les vidéos reste « neutre » (format, musique, réseau)', groupe('format', 'vertical')?.verdict === 'neutre' && groupe('format', 'vertical').autres === null && groupe('musique', 'avec musique')?.verdict === 'neutre' && groupe('reseau', 'youtube')?.verdict === 'neutre' && groupe('reseau', 'youtube').n === 6, st.groupes);
  const grande = groupe('accroche', 'grand titre dans les 2 premières secondes');
  essai('un trait qui sépare (4 vidéos à 2,2 fois contre 2 à 0,75) « marche »', grande?.verdict === 'marche' && grande.n === 4 && grande.multiple_median === 2.2 && grande.autres === 0.75, grande);
  essai('l’autre côté, avec 2 vidéos seulement, reste « neutre » (jamais « marche moins » sous 3 exemples)', groupe('accroche', 'accroche discrète')?.verdict === 'neutre' && groupe('accroche', 'accroche discrète').n === 2, groupe('accroche', 'accroche discrète'));
  // le genre se dit avec les mots de l'interface (« Face caméra »), pas la clé du code (« face »)
  essai('avec 3 exemples de chaque côté : « marche » et « marche moins »', groupe('genre', 'Face caméra')?.verdict === 'marche' && groupe('genre', 'Trend, voyage')?.verdict === 'marche_moins' && groupe('genre', 'Trend, voyage').multiple_median === 0.75 && !groupe('genre', 'face'), [groupe('genre', 'Face caméra'), groupe('genre', 'Trend, voyage')]);
  essai('moins de 3 exemples au-dessus : « à essayer »', groupe('titre_derriere', 'titre derrière la personne')?.verdict === 'a_essayer' && groupe('titre_derriere', 'titre derrière la personne').n === 2, groupe('titre_derriere', 'titre derrière la personne'));
  essai('aucun trait sous 3 exemples ne « marche » ni ne « marche moins »', st.groupes.filter((x) => x.n < R.MIN_EXEMPLES).every((x) => ['a_essayer', 'neutre'].includes(x.verdict)), st.groupes.filter((x) => x.n < 3));
  essai('les meilleures et les moins bonnes vidéos, et les notes de la personne', st.meilleures[0]?.multiple === 2.2 && st.moins_bonnes.length === 1 && st.moins_bonnes[0].multiple === 0.75 && st.notes.aimees === 1 && st.notes.pas_aimees === 1 && st.notes.mots.length === 2, {meilleures: st.meilleures, moins: st.moins_bonnes, notes: st.notes});
  const tr = R.traits({accroche: {grande: false}, duree_s: 95, musique: [], rythme: {pauses: 0, hesitations: 0, redites: 0}, voix: {brillance_db: -20}, ia: {moteur: 'codex', qualite: 'rapide'}, textes: ['Titre géant']});
  essai('traits : en mots simples', tr.accroche === 'accroche discrète' && tr.duree === 'plus de 90 s' && tr.musique === 'sans musique' && tr.rythme === 'parole resserrée' && tr.voix === 'voix sourde' && tr.ia === 'Codex Rapide' && R.traits({ia: {moteur: 'claude', qualite: 'soigne'}}).ia === 'Claude Soigné' && tr.titre_derriere === 'titre derrière la personne' && !R.traits({textes: ['Accroche', 'Accroche géante']}).titre_derriere, tr);
  const texteRecette = R.recetteEnTexte(atelierRecette.id);
  essai('recetteEnTexte : ce qui marche, ce qui marche moins, ce qui reste à essayer, et ce qu’a dit la personne',
    /## Ça marche\n/.test(texteRecette) && texteRecette.includes('- **Accroche** : grand titre dans les 2 premières secondes — 2,2 fois la médiane sur 4 vidéos (les autres : 0,75)') && /## Ça marche moins/.test(texteRecette) && /## À essayer encore/.test(texteRecette) && texteRecette.includes('« Recette 0 » : Exactement le ton voulu') && !/\*\*Format\*\*/.test(texteRecette), texteRecette);
  const dossierR = path.join(T, 'atelier-recette');
  essai('installerRecette : contexte/espace/recette.md posé', R.installerRecette(dossierR, esp(atelierRecette.id)) === true && fs.readFileSync(path.join(dossierR, 'contexte', 'espace', 'recette.md'), 'utf8') === texteRecette);
  E.changerEspace(atelierRecette.id, {apprendre: false});
  essai('installerRecette : un espace qui n’apprend plus → recette.md retiré', R.installerRecette(dossierR, esp(atelierRecette.id)) === false && !fs.existsSync(path.join(dossierR, 'contexte', 'espace', 'recette.md')));
  E.changerEspace(atelierRecette.id, {apprendre: true});
  R.installerRecette(dossierR, esp(atelierRecette.id));
  essai('installerRecette : « Personne » → recette.md retiré', R.installerRecette(dossierR, esp('neutre')) === false && !fs.existsSync(path.join(dossierR, 'contexte', 'espace', 'recette.md')));
  const cafeVide = E.creerClient({nom: 'Café Vide'});
  essai('recetteEnTexte : null quand il n’y a rien à dire ; et rien n’est posé', R.recetteEnTexte(cafeVide.id) === null && R.installerRecette(dossierR, esp(cafeVide.id)) === false && !fs.existsSync(path.join(dossierR, 'contexte', 'espace', 'recette.md')));

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Les séries');
  const modele = path.join(T, 'atelier-modele');
  const src = path.join(modele, 'remotion', 'src');
  fs.mkdirSync(path.join(src, 'pieces'), {recursive: true});
  fs.writeFileSync(path.join(src, 'Montage.tsx'), 'export const Montage = () => null; // accroche du modèle\n');
  fs.writeFileSync(path.join(src, 'pieces', 'CartonDeFin.tsx'), 'export const CartonDeFin = () => null;\n');
  fs.writeFileSync(path.join(src, 'moteur.js'), '// le moteur de Dérush, recopié à chaque pack : jamais dans une série\n');
  fs.writeFileSync(path.join(src, '.cache'), 'x');
  const pubModele = path.join(modele, 'remotion', 'public');
  for (const d of ['plans', 'polices', 'sons', 'detourage']) fs.mkdirSync(path.join(pubModele, d), {recursive: true});
  fs.writeFileSync(path.join(pubModele, 'fond-de-fin.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(path.join(pubModele, 'plans', 'rush.mp4'), 'rush');
  fs.writeFileSync(path.join(pubModele, 'polices', 'Police.ttf'), 'police');
  fs.mkdirSync(path.join(modele, 'rendu'), {recursive: true});
  fs.writeFileSync(path.join(modele, 'rendu', 'timeline.json'), JSON.stringify({duree_s: 45, blocs: [{id: 'titre', piste: 'texte', nom: 'Titre derrière la personne'}]}));
  const vignettesModele = path.join(T, 'modele.vignettes.jpg');
  fs.writeFileSync(vignettesModele, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  const Pm = new Projet(path.join(BIBLIO, 'Chronique modèle'));
  Pm.appliquer({titre: 'Chronique — le modèle', espace: 'moi', brief: {type: 'face', objectif: 'Chronique du tome 1'}, style: {accent: '#E63946'}, sortie: {preset: 'vertical'}});
  const serieArgs = {P: Pm, espaceId: 'moi', atelier: modele, version: {n: 2, moteur: 'claude', modele: 'claude-opus-5-5', reponse: 'J’ai posé le titre derrière toi.'}, video: {nom: 'modele-claude-v2.mp4', titre: 'Le modèle'}, fiche: fiche1, vignettes: vignettesModele};
  essai('une série ne se range pas dans « Personne »', leve(() => Se.creerSerie({...serieArgs, espaceId: 'neutre', nom: 'X'}), /Personne/));
  essai('une série sans nom est refusée', leve(() => Se.creerSerie({...serieArgs, nom: '  '}), /nom/));
  essai('sans dossier de travail, pas de série', leve(() => Se.creerSerie({...serieArgs, atelier: path.join(T, 'disparu'), nom: 'X'}), /n’existe plus/));
  const serie = Se.creerSerie({...serieArgs, nom: 'Chroniques Héritages'});
  const DS = Se.dossierSerie('moi', serie.id);
  essai('creerSerie : un identifiant lisible, dans l’espace', /^chroniques-heritages-[0-9a-f]{4}$/.test(serie.id) && serie.espace === 'moi' && DS.startsWith(path.join(E.DOSSIER_ESPACES, 'moi', 'series')), serie.id);
  essai('creerSerie : le code des scènes copié, sauf moteur.js et les fichiers cachés', fs.existsSync(path.join(DS, 'code', 'Montage.tsx')) && fs.existsSync(path.join(DS, 'code', 'pieces', 'CartonDeFin.tsx')) && !fs.existsSync(path.join(DS, 'code', 'moteur.js')) && !fs.existsSync(path.join(DS, 'code', '.cache')));
  essai('creerSerie : les petites ressources, sans les rushes, polices ni sons', fs.existsSync(path.join(DS, 'public', 'fond-de-fin.png')) && !fs.existsSync(path.join(DS, 'public', 'plans')) && !fs.existsSync(path.join(DS, 'public', 'polices')));
  essai('creerSerie : la table de montage et l’aperçu', fs.existsSync(path.join(DS, 'timeline.json')) && fs.existsSync(path.join(DS, 'apercu.jpg')));
  essai('creerSerie : brief, style, format, d’où elle vient, sa fiche', serie.brief.type === 'face' && serie.style.accent === '#E63946' && serie.sortie.preset === 'vertical' && serie.depuis.version === 2 && serie.depuis.ia === 'claude-opus-5-5' && serie.depuis.projet === 'Chronique — le modèle' && serie.fiche?.duree_s === 46.3 && serie.episodes === 0 && /titre derrière toi/.test(serie.reponse_ia), serie);
  essai('une deuxième série du même nom est refusée', leve(() => Se.creerSerie({...serieArgs, nom: 'chroniques héritages'}), /existe déjà/));
  let series = Se.listerSeries('moi');
  essai('listerSeries : la série, son aperçu, ses épisodes ; rien chez un client', series.length === 1 && series[0].id === serie.id && series[0].apercu === true && series[0].episodes === 0 && Se.listerSeries(boulangerie.id).length === 0, series);
  essai('lireSerie : un identifiant douteux → null', Se.lireSerie('moi', '../../espaces') === null && Se.lireSerie('moi', 'inconnue-00') === null && Se.dossierSerie('moi', '../x') === null);
  const reglages = Se.reglagesEpisode(serie);
  essai('reglagesEpisode : ce qu’un épisode reprend', reglages.serie.id === serie.id && reglages.serie.nom === 'Chroniques Héritages' && reglages.serie.espace === 'moi' && reglages.brief.type === 'face' && reglages.style.accent === '#E63946' && reglages.sortie.preset === 'vertical' && reglages.mode === 'montage' && reglages.langue === 'fr', reglages);
  Se.compterEpisode('moi', serie.id);
  Se.compterEpisode('moi', 'inconnue-00');
  essai('compterEpisode : un épisode de plus (et rien pour une série inconnue)', Se.lireSerie('moi', serie.id).episodes === 1);
  const atelierSerie = path.join(T, 'atelier-episode');
  const posee = Se.installerSerie(atelierSerie, {d: {serie: {id: serie.id, nom: serie.nom, espace: 'moi'}}});
  const serieMd = fs.readFileSync(path.join(atelierSerie, 'contexte', 'serie', 'SERIE.md'), 'utf8');
  essai('installerSerie : SERIE.md, le code et la table dans contexte/serie/', posee?.id === serie.id && /Série « Chroniques Héritages »/.test(serieMd) && /Garde son identité/.test(serieMd) && /## Le modèle en bref/.test(serieMd) && fs.existsSync(path.join(atelierSerie, 'contexte', 'serie', 'code', 'Montage.tsx')) && fs.existsSync(path.join(atelierSerie, 'contexte', 'serie', 'timeline.json')) && !fs.existsSync(path.join(atelierSerie, 'contexte', 'serie', 'code', 'moteur.js')), serieMd);
  essai('installerSerie : un projet sans série → contexte/serie/ retiré', Se.installerSerie(atelierSerie, {d: {serie: null}}) === null && !fs.existsSync(path.join(atelierSerie, 'contexte', 'serie')));
  // un épisode de « Moi » passé ensuite chez un client (ou à « Personne ») : la série de Moi ne le suit pas
  const refMoi = {id: serie.id, nom: serie.nom, espace: 'moi'};
  const dossierSerieAtelier = path.join(atelierSerie, 'contexte', 'serie');
  Se.installerSerie(atelierSerie, {d: {serie: refMoi}});
  const chezClient = Se.installerSerie(atelierSerie, {d: {serie: refMoi, espace: boulangerie.id}});
  essai('installerSerie : un épisode de « Moi » passé chez un client ne reçoit ni le code, ni l’habillage de la série (contexte/serie/ retiré)', chezClient === null && !fs.existsSync(dossierSerieAtelier), chezClient);
  Se.installerSerie(atelierSerie, {d: {serie: refMoi}});
  const chezPersonne = Se.installerSerie(atelierSerie, {d: {serie: refMoi, espace: 'neutre'}});
  essai('installerSerie : … ni passé à « Personne », ni avec l’espace donné à part', chezPersonne === null && !fs.existsSync(dossierSerieAtelier) && Se.installerSerie(atelierSerie, {d: {serie: refMoi}}, esp(boulangerie.id)) === null && !fs.existsSync(dossierSerieAtelier));
  const ficheEpisode = (espaceId) => F.creerFiche({P: {racine: path.join(T, 'episode-deplace'), d: {titre: 'Épisode déplacé', serie: refMoi, espace: espaceId, brief: {}}}, espace: esp(espaceId), video: {nom: 'episode.mp4', titre: 'Épisode'}});
  essai('la fiche d’un épisode passé chez un client ne se dit pas de la série de « Moi »', ficheEpisode(boulangerie.id).serie === null && ficheEpisode('moi').serie === serie.nom, [ficheEpisode(boulangerie.id).serie, ficheEpisode('moi').serie]);
  essai('consigneSerie : la consigne, ou rien', /Chroniques Héritages/.test(Se.consigneSerie(serie)) && Se.consigneSerie(null) === '');
  const aRetirer = Se.creerSerie({...serieArgs, nom: 'Série à retirer', vignettes: null});
  essai('retirerSerie : rangée à part, plus dans la liste', Se.retirerSerie('moi', aRetirer.id) === true && !Se.listerSeries('moi').some((s) => s.id === aRetirer.id) && fs.readdirSync(path.join(E.DOSSIER_ESPACES, 'moi', 'series', '.retirees')).some((n) => n.startsWith(aRetirer.id)));
  essai('retirerSerie : une série inconnue est refusée', leve(() => Se.retirerSerie('moi', aRetirer.id), /inconnue/) && leve(() => Se.retirerSerie('moi', '../x'), /inconnue/));

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Le tableau de bord');
  const studio = E.creerClient({nom: 'Studio Périodes', metier: {type: 'vlog'}});
  const ages = [5, 45, 200];
  const vuesStudio = [3000, 500, 1000];
  const vignetteStudio = path.join(T, 'periodes', 'projet-0', 'vidéos', 'periode-0.vignettes.jpg');
  fs.mkdirSync(path.dirname(vignetteStudio), {recursive: true});
  fs.writeFileSync(vignetteStudio, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  const clesStudio = [];
  for (let i = 0; i < 3; i++) {
    const P = {racine: path.join(T, 'periodes', `projet-${i}`), d: {titre: `Période ${i}`, cree_le: ilYA(ages[i] + 1), brief: {type: 'trend'}}};
    const ficheP = F.creerFiche({P, espace: esp(studio.id), video: {nom: `periode-${i}.mp4`, titre: `Vidéo à J-${ages[i]}`, duree: 30, largeur: 1920, hauteur: 1080, vignettes: i === 0 ? vignetteStudio : undefined}});
    ficheP.quand = ilYA(ages[i]);
    F.enregistrerFiche(P, ficheP, esp(studio.id));
    const cle = Su.enregistrerPublication(studio.id, {lien: `https://youtu.be/periode-${i}x`, cle_fiche: ficheP.cle, publie_le: ficheP.quand});
    Su.rangerChiffresIA(studio.id, [{cle, vues: vuesStudio[i]}], {medianes: {youtube: {valeur: 1000, n: 10}}});
    if (i === 0) F.noterVideo(P, 'periode-0.mp4', {note: 1, mot: 'Belle lumière'}, esp(studio.id));
    clesStudio.push(ficheP.cle);
  }
  let tb = Ta.tableauDeBord(studio.id, {periode: '30'});
  essai('30 jours : seule la vidéo récente compte', tb.periode === '30' && tb.chiffres.montages === 1 && tb.chiffres.publies === 1 && tb.chiffres.vues === 3000 && tb.chiffres.multiple_median === 3 && tb.chiffres.aimes === 1 && tb.meilleure?.titre === 'Vidéo à J-5' && tb.moins_bonne === null, tb.chiffres);
  essai('la vidéo du tableau : vignette, publication, lectures, multiple', tb.videos[0].vignettes === true && tb.videos[0].publications[0]?.reseau === 'youtube' && tb.videos[0].publications[0].vues === 3000 && tb.videos[0].publications[0].multiple === 3 && tb.videos[0].note === 1 && tb.medianes.youtube?.valeur === 1000, tb.videos[0]);
  tb = Ta.tableauDeBord(studio.id, {periode: '90'});
  essai('90 jours : deux vidéos, la moins bonne apparaît', tb.chiffres.montages === 2 && tb.chiffres.vues === 3500 && tb.moins_bonne?.titre === 'Vidéo à J-45' && tb.moins_bonne.multiple === 0.5, tb.chiffres);
  tb = Ta.tableauDeBord(studio.id, {periode: 'tout'});
  essai('« tout » : la vieille fiche revient', tb.periode === 'tout' && tb.chiffres.montages === 3 && tb.chiffres.vues === 4500 && tb.videos.length === 3, tb.chiffres);
  tb = Ta.tableauDeBord(studio.id);
  essai('sans période : 90 jours ; l’espace, son métier, et qu’il apprend', tb.periode === '90' && tb.chiffres.montages === 2 && tb.espace.nom === 'Studio Périodes' && tb.espace.metier?.nom === 'Vlog, voyage, lifestyle' && tb.espace.apprend === true && tb.cle_treg === false, tb.espace);
  tb = Ta.tableauDeBord('neutre', {periode: 'tout'});
  essai('« Personne » : un tableau vide (rien n’est appris)', tb.espace.apprend === false && tb.chiffres.montages === 0 && tb.videos.length === 0 && tb.recette === null && tb.series.length === 0 && tb.carnet === 0, tb);
  essai('un espace inconnu est refusé', leve(() => Ta.tableauDeBord('zz-inconnu'), /inconnu/));
  essai('vignettesDe : l’image d’une vidéo de l’espace, rien sinon', Ta.vignettesDe(studio.id, clesStudio[0]) === vignetteStudio && Ta.vignettesDe(studio.id, clesStudio[1]) === null && Ta.vignettesDe(studio.id, 'inconnue') === null && Ta.vignettesDe('moi', clesStudio[0]) === null);
  // un an de montages : le tableau demande une vignette par vidéo, toutes d'un coup. Chacune ne doit pas refaire le
  // croisement de tout l'espace (fiches, suivi, médianes) : le serveur n'a qu'un fil.
  const gros = E.creerClient({nom: 'Un an de montages'}).id;
  const N_GROS = 300;
  const vignetteGros = path.join(T, 'gros', 'v.vignettes.jpg');
  fs.mkdirSync(path.dirname(vignetteGros), {recursive: true});
  fs.writeFileSync(vignetteGros, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  const clesGros = Array.from({length: N_GROS}, (_, i) => `gros-${String(i).padStart(4, '0')}`);
  fs.mkdirSync(path.join(E.DOSSIER_ESPACES, gros), {recursive: true});
  fs.writeFileSync(path.join(E.DOSSIER_ESPACES, gros, 'fiches.jsonl'), clesGros.map((cle, i) => JSON.stringify({type: 'fiche', v: 1, cle, quand: ilYA(i % 300), espace: gros, projet: `Projet ${i}`, video: `v${i}.mp4`, vignettes: vignetteGros, duree_s: 30 + (i % 60), genre: 'face', accroche: {grande: i % 2 === 0}})).join('\n') + '\n');
  fs.writeFileSync(path.join(E.DOSSIER_ESPACES, gros, 'suivi.json'), JSON.stringify({publications: Object.fromEntries(clesGros.map((cle, i) => [`youtube:gros${i}`, {reseau: 'youtube', id: `gros${i}`, lien: `https://youtu.be/gros${i}`, cle_fiche: cle, publie_le: ilYA(i % 300), suivi: 'treg', lectures: [{jours: 7, quand: ilYA(0), vues: 100 + i}]}])), medianes: {}}));
  const chrono = (fn) => { const t0 = performance.now(); fn(); return performance.now() - t0; };
  Ta.vignettesDe(gros, clesGros[0]);
  let toutes = 0;
  const tVignettes = chrono(() => { for (const cle of clesGros) if (Ta.vignettesDe(gros, cle) === vignetteGros) toutes++; });
  const tCroisements = chrono(() => { for (const cle of clesGros.slice(0, 60)) R.joindre(gros).find((l) => l.fiche.cle === cle); }) * (N_GROS / 60);
  essai(`vignettesDe : ${N_GROS} vignettes d’un coup sans refaire ${N_GROS} fois le croisement de l’espace`, toutes === N_GROS && tVignettes * 5 < tCroisements, {toutes, vignettes_ms: Math.round(tVignettes), croisements_ms: Math.round(tCroisements)});
  const rp = Ta.rapport(studio.id, {periode: 'tout'});
  // le jour d'ici (pas l'heure universelle) et la période dans le nom
  const jourIci = (() => { const j = new Date(); return `${j.getFullYear()}-${String(j.getMonth() + 1).padStart(2, '0')}-${String(j.getDate()).padStart(2, '0')}`; })();
  essai('rapport : un .md rangé dans espaces/<id>/rapports, au jour d’ici et à sa période', rp.fichier === path.join(E.DOSSIER_ESPACES, studio.id, 'rapports', `rapport-${jourIci}-depuis-le-debut.md`) && fs.readFileSync(rp.fichier, 'utf8') === rp.texte, rp.fichier);
  const rp2 = Ta.rapport(studio.id, {periode: 'tout'});
  essai('rapport : un second bilan le même jour n’écrase pas le premier', rp2.fichier === path.join(E.DOSSIER_ESPACES, studio.id, 'rapports', `rapport-${jourIci}-depuis-le-debut-2.md`) && fs.readFileSync(rp.fichier, 'utf8') === rp.texte, rp2.fichier);
  essai('rapport : pour le client, ses chiffres et ses vidéos (le réseau en toutes lettres)', /^# Rapport pour Studio Périodes — depuis le début/.test(rp.texte) && /Vidéos montées : 3/.test(rp.texte) && /Vidéos publiées : 3/.test(rp.texte) && /\| Vidéo à J-5 \| YouTube \|/.test(rp.texte) && /La plus forte\*\* : « Vidéo à J-5 »/.test(rp.texte), rp.texte);
  essai('rapport de « Moi » : « Mon bilan »', /^# Mon bilan — 30 derniers jours/.test(Ta.rapport('moi').texte));
  tb = Ta.tableauDeBord(atelierRecette.id, {periode: 'tout'});
  essai('le tableau reprend la recette (sans les traits neutres)', tb.recette?.n_montages === 6 && tb.recette.groupes.length > 0 && tb.recette.groupes.every((g) => g.verdict !== 'neutre'), tb.recette);

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Le carnet, par espace');
  const carnetClient = E.creerClient({nom: 'Carnet Essai'});
  let ajoutees = K.ajouterLecons(['Une première leçon assez longue pour compter.', 'Une première leçon assez longue pour compter.', 'court'], {espace: carnetClient.id, projet: 'Essai'});
  essai('ajouterLecons : sans doublon, rien de trop court', ajoutees.length === 1 && K.lireCarnet(carnetClient.id).length === 1);
  ajoutees = K.ajouterLecons(['Une première leçon assez longue pour compter, avec un ajout.'], {espace: carnetClient.id});
  essai('ajouterLecons : une leçon qui en contient une autre est un doublon', ajoutees.length === 0);
  essai('le carnet d’un client n’est pas celui de « Moi »', !K.lireCarnet('moi').some((l) => /première leçon/.test(l.texte)));
  essai('« Personne » n’a pas de carnet', K.ajouterLecons(['Une leçon qui ne doit aller nulle part du tout.'], {espace: 'neutre'}).length === 0 && K.lireCarnet('neutre').length === 0 && !fs.existsSync(path.join(E.DOSSIER_ESPACES, 'neutre', 'carnet.json')) && K.texteCarnet('neutre') === null);
  essai('apprentissage coupé : rien n’entre au carnet', K.ajouterLecons(['Une leçon pour un client qui n’apprend plus.'], {espace: silencieux.id}).length === 0 && K.lireCarnet(silencieux.id).length === 0);
  const idLecon = K.lireCarnet(carnetClient.id)[0].id;
  essai('retirerLecon : retirée une fois, et pas dans un autre espace', K.retirerLecon(idLecon, 'moi') === false && K.retirerLecon(idLecon, carnetClient.id) === true && K.retirerLecon(idLecon, carnetClient.id) === false && K.lireCarnet(carnetClient.id).length === 0);
  K.ajouterLecons(Array.from({length: 70}, (_, i) => `Leçon de test numéro ${String(i).padStart(3, '0')} gardée`), {espace: carnetClient.id});
  const soixante = K.lireCarnet(carnetClient.id);
  essai('le carnet garde les 60 leçons les plus récentes', soixante.length === 60 && soixante[0].texte.includes('010') && soixante.at(-1).texte.includes('069'), [soixante.length, soixante[0]?.texte]);
  const moiAvant = K.lireCarnet('moi').length;
  K.viderCarnet(carnetClient.id);
  K.viderCarnet('neutre');
  essai('viderCarnet : seulement celui de l’espace', K.lireCarnet(carnetClient.id).length === 0 && K.lireCarnet('moi').length === moiAvant && !fs.existsSync(path.join(E.DOSSIER_ESPACES, 'neutre', 'carnet.json')));
  essai('un espace mal formé est refusé à l’écriture, vide à la lecture', leve(() => K.viderCarnet('../ailleurs'), /inconnu/) && K.lireCarnet('../ailleurs').length === 0 && K.retirerLecon('x', 'A B') === false);
  const lecons = K.leconsDe('- Une leçon bien assez longue\n* Une autre leçon bien assez longue\nPas une leçon du tout ici\n- court\n- mot de passe: 1234 à ne jamais garder\n- token=abcdef0123456789 non plus');
  essai('leconsDe : les lignes « - … », jamais un secret', lecons.length === 2 && lecons.every((l) => !/passe|token/.test(l)), lecons);

  // ————————————————————————————————————————————————————————————————————————————————
  titre('L’isolement : un client ne reçoit jamais l’univers de la personne');
  // l'univers de « Moi » : identité (déjà posée), carnet, profil du créateur, recette, une note (déjà posée)
  K.ajouterLecons(['Goût : il veut des titres façon manga japonais, ambiance néons de Tokyo.', 'Ses chroniques de mangas marchent avec la couverture en plein écran.'], {espace: 'moi', projet: 'Chronique manga — Fire !'});
  fs.mkdirSync(path.join(SUPPORT, 'createur'), {recursive: true});
  fs.writeFileSync(path.join(SUPPORT, 'createur', 'profil.json'), JSON.stringify({v: 1, cree_le: ilYA(3), resume: 'Chroniqueur de mangas japonais, ton enthousiaste.', niche: 'mangas japonais', comptes: [{reseau: 'tiktok', nom: 'chroniqueur', abonnes: 1000, videos_lues: 20, mediane_vues: 1368}],
    ce_qui_marche: [{reseau: 'tiktok', titre: 'Fire ! en 45 secondes', multiple: 3.4}], ce_qui_marche_moins: [], style: {ton: 'enthousiaste', rythme: 'rapide', direction_artistique: 'Néons de Tokyo, couleurs vives', formats: '', duree_ideale: '45 s', accroches: [], ses_mots: ['incroyable']},
    public: 'Fans de manga', commentaires: [], conseils: [], pour_le_montage: ['Le titre du manga en géant'], pour_les_titres: [], tendances: [], voix: 'Il parle vite, avec des références japonaises.', limites: ''}));
  essai('le profil du créateur d’essai est lu (et ses médianes servent à « Moi » seulement)', Cr.lireProfil()?.niche === 'mangas japonais' && R.medianesDuProfil('moi').tiktok === 1368 && Object.keys(R.medianesDuProfil(boulangerie.id)).length === 0);
  R.ecrireRecette('moi', {v: 1, resume: 'Tes chroniques manga marchent avec un titre japonais géant derrière toi.', ca_marche: [{quoi: 'Le titre du manga en géant', preuve: '4 vidéos, 2,4 fois ta médiane'}]});
  // le client : sa marque (logo compris), son carnet, une vidéo notée
  K.ajouterLecons(['Le logo de la boulangerie va sur le carton de fin, jamais en haut.'], {espace: boulangerie.id, projet: 'Boulangerie — Le pain du matin'});
  const Pb = new Projet(path.join(BIBLIO, 'Boulangerie pain'));
  Pb.appliquer({titre: 'Boulangerie — Le pain du matin', espace: boulangerie.id, brief: {type: 'evenement', objectif: 'Le pain du matin'}});
  F.enregistrerFiche(Pb, F.creerFiche({P: Pb, espace: esp(boulangerie.id), version: {n: 1, moteur: 'claude', qualite: 'rapide'}, video: {nom: 'pain-claude-v1.mp4', titre: 'Le pain du matin', duree: 32, largeur: 1080, hauteur: 1920}, table: {blocs: [{piste: 'son', nom: 'Musique piano douce'}]}}), esp(boulangerie.id));
  F.noterVideo(Pb, 'pain-claude-v1.mp4', {note: 1, mot: 'Parfait, chaleureux comme la boutique'}, esp(boulangerie.id));

  // un projet d'abord à « Moi » (témoin), puis passé au client dans le MÊME dossier de travail (un dossier repris), puis à « Personne »
  const Pchange = new Projet(path.join(BIBLIO, 'Projet qui change'));
  Pchange.appliquer({titre: 'Projet qui change', espace: 'moi'});
  const atelier = path.join(T, 'atelier-repris');
  let prep = preparer(Pchange, atelier);
  const lu = (f) => { try { return fs.readFileSync(path.join(atelier, f), 'utf8'); } catch { return ''; } };
  essai('témoin : un projet de « Moi » reçoit bien son univers (identité, carnet, profil, recette)', prep.espace.id === 'moi' && prep.profil === true && /la personne elle-même/.test(lu('contexte/espace/ESPACE.md')) && /Japon/.test(lu('contexte/espace/ESPACE.md')) && /manga/.test(lu('CARNET.md')) && /Tokyo/.test(lu('contexte/createur/profil.md')) && /manga/.test(lu('contexte/espace/recette.md')) && UNIVERS_MOI.test(textesDe(atelier)), prep);
  Pchange.appliquer({espace: boulangerie.id});
  prep = preparer(Pchange, atelier);
  const texteClient = textesDe(atelier);
  const fuite = UNIVERS_MOI.exec(texteClient);
  essai('client : RIEN de l’univers de la personne dans tout le dossier de travail (identité, carnet, profil, recette, consignes)', prep.espace.id === boulangerie.id && !fuite, fuite ? texteClient.slice(Math.max(0, fuite.index - 200), fuite.index + 100) : '');
  essai('client : pas de profil du créateur (contexte/createur/ retiré du dossier repris)', prep.profil === false && !fs.existsSync(path.join(atelier, 'contexte', 'createur')));
  const espaceMd = lu('contexte/espace/ESPACE.md');
  essai('client : ESPACE.md dit pour qui, et sa marque (couleurs, interdits, mentions, logo)', /# Pour qui : Boulangerie Lemoine \(un client\)/.test(espaceMd) && /pas pour la personne qui monte/.test(espaceMd) && /#8B4513/.test(espaceMd) && /À ne jamais faire/.test(espaceMd) && /Boulangerie Lemoine — depuis 1952/.test(espaceMd) && /## Métier : Entreprise, marque/.test(espaceMd) && fs.existsSync(path.join(atelier, 'contexte', 'espace', 'logo.png')), espaceMd);
  essai('client : SON carnet, et SA recette (ses vidéos, ses notes)', /logo de la boulangerie/.test(lu('CARNET.md')) && /Le pain du matin/.test(lu('contexte/espace/recette.md')) && /chaleureux comme la boutique/.test(lu('contexte/espace/recette.md')), [lu('CARNET.md'), lu('contexte/espace/recette.md')]);
  essai('client : la consigne le dit (rien de l’univers personnel de la personne)', /pour Boulangerie Lemoine, un client/.test(lu('consignes.txt')) && /univers personnel/.test(lu('consignes.txt')));
  essai('texteCarnet d’un client : ses leçons seulement ; celui de « Moi » : les siennes', !UNIVERS_MOI.test(K.texteCarnet(boulangerie.id)) && /boulangerie/.test(K.texteCarnet(boulangerie.id)) && /manga/.test(K.texteCarnet('moi')) && !/boulangerie/.test(K.texteCarnet('moi')));
  essai('les fiches, la recette et le tableau d’un client ne voient que ses vidéos', R.joindre(boulangerie.id).every((l) => l.fiche.espace === boulangerie.id) && R.statistiques(boulangerie.id).n_montages === 1 && Ta.tableauDeBord(boulangerie.id, {periode: 'tout'}).videos.map((v) => v.titre).join() === 'Le pain du matin' && !UNIVERS_MOI.test(R.recetteEnTexte(boulangerie.id)));
  // ce que l'IA écrit à la fin d'un montage client : dans SON carnet
  const debut = Date.now();
  fs.writeFileSync(path.join(atelier, K.FICHIER_IA), '- Goût : la boulangerie veut des plans serrés sur la croûte du pain.\n- token: abc123456789 ne doit jamais entrer\n');
  const moiAvantIA = K.lireCarnet('moi').length;
  const recues = K.recueillirCarnet(atelier, debut, {espace: boulangerie.id, projet: 'Projet qui change', ia: 'claude'});
  essai('les leçons d’un montage client vont dans SON carnet, jamais dans celui de « Moi »', recues.length === 1 && K.lireCarnet(boulangerie.id).some((l) => /croûte/.test(l.texte)) && K.lireCarnet('moi').length === moiAvantIA, recues);
  Pchange.appliquer({espace: 'neutre'});
  prep = preparer(Pchange, atelier);
  essai('« Personne » : ni espace, ni recette, ni profil, ni carnet dans le dossier repris', prep.espace.id === 'neutre' && !fs.existsSync(path.join(atelier, 'contexte', 'espace')) && !fs.existsSync(path.join(atelier, 'contexte', 'createur')) && !fs.existsSync(path.join(atelier, 'CARNET.md')) && !/Boulangerie|manga/i.test(textesDe(atelier)), textesDe(atelier));
  essai('« Personne » : la consigne dit de ne rien utiliser ni rien écrire au carnet', /n’est rattaché à personne/.test(lu('consignes.txt')) && /n’écris rien dans carnet-ia\.md/.test(lu('consignes.txt')));
  // l'IA écrit quand même dans carnet-ia.md (elle ne devait pas) : rien n'est rangé
  fs.writeFileSync(path.join(atelier, K.FICHIER_IA), '- Goût : une leçon qu’aucun espace ne doit garder, jamais.\n');
  const rienNeutre = K.recueillirCarnet(atelier, debut, {espace: 'neutre'});
  essai('« Personne » : les leçons écrites par l’IA ne sont rangées nulle part', rienNeutre.length === 0 && !fs.existsSync(path.join(E.DOSSIER_ESPACES, 'neutre', 'carnet.json')) && K.lireCarnet('moi').length === moiAvantIA);
  essai('installerEspace(« Personne ») → null ; consigneEspace sans espace = celle de « Personne »', E.installerEspace(atelier, esp('neutre')) === null && E.espaceEnTexte(esp('neutre')) === null && E.consigneEspace(null) === E.consigneEspace(esp('neutre')));
  essai('consigneEspace de « Moi » : la personne elle-même', /la personne elle-même/.test(E.consigneEspace(esp('moi'))) && /## Son identité/.test(E.espaceEnTexte(esp('moi'))));
  // demander() (lib/claude.mjs) lance une vraie IA : ses branchements sur l'espace sont gardés ici sur sa source
  const sourceClaude = fs.readFileSync(path.join(D, 'lib', 'claude.mjs'), 'utf8');
  essai('lib/claude.mjs ne donne le profil du créateur qu’à un projet de « Moi »', /espace\?\.type === 'moi' \? installerProfil\(atelier\) : \(fs\.rmSync\(path\.join\(atelier, 'contexte', 'createur'\)/.test(sourceClaude));
  essai('lib/claude.mjs ne donne que le carnet de l’espace du projet (aucun s’il n’apprend pas)', /apprend\(espace\) \? texteCarnet\(espace\.id\) : null/.test(sourceClaude));
  essai('lib/claude.mjs pose l’espace, la recette et la consigne du projet, et range les leçons dans son espace', /installerEspace\(atelier, espace\)/.test(sourceClaude) && /installerRecette\(atelier, espace\)/.test(sourceClaude) && /consigneEspace\(espace\)/.test(sourceClaude) && /recueillirCarnet\(atelier, debutIA, \{espace: espace\?\.id/.test(sourceClaude));

  // ————————————————————————————————————————————————————————————————————————————————
  titre('Les routes, dans le vrai serveur');
  const ctx = {P: null, file: new FileDAttente(), app: false, natif: false,
    ouvrir(d, t) { const P = new Projet(d); if (t) { P.d.titre = t; P.sauver(); } ctx.P = P; return P; },
    fermer() { ctx.P = null; }};
  ({serveur} = await demarrerServeur(ctx, {port: 0}));
  const base = `http://127.0.0.1:${serveur.address().port}`;
  const jeton = /name="derush-jeton" content="([^"]+)"/.exec(await (await fetch(`${base}/`)).text())[1];
  const FENETRE = 'essai';
  const entetes = {'x-derush-jeton': jeton, 'x-derush-fenetre': FENETRE};
  const api = async (methode, p, corps, {j = jeton} = {}) => {
    const r = await fetch(`${base}${p}`, {method: methode, headers: {'x-derush-jeton': j, 'x-derush-fenetre': FENETRE, ...(corps !== undefined ? {'content-type': 'application/json'} : {})}, body: corps !== undefined ? JSON.stringify(corps) : undefined});
    return {code: r.status, j: await r.json().catch(() => null)};
  };
  const image = async (p) => { const r = await fetch(`${base}${p}`, {headers: entetes}); await r.arrayBuffer(); return {code: r.status, type: r.headers.get('content-type') ?? ''}; };

  let r = await api('GET', '/api/etat');
  essai('le serveur d’essai répond, sur la bibliothèque d’essai', r.code === 200 && r.j.bibliotheque === BIBLIO, r);
  r = await api('GET', '/api/espaces', undefined, {j: 'faux'});
  essai('sans le bon jeton : 403', r.code === 403, r);
  r = await api('GET', '/api/espaces');
  const parId = Object.fromEntries((r.j?.espaces ?? []).map((e) => [e.id, e]));
  essai('GET /api/espaces : Moi, Personne et les clients, avec ce qu’ils ont appris', r.code === 200 && parId.moi?.type === 'moi' && parId.moi.apprend === true && parId.moi.series === 1 && parId.moi.lecons >= 3 && parId.neutre?.apprend === false && parId.neutre.lecons === 0 && parId.neutre.series === 0 && parId[boulangerie.id]?.logo === true && parId[boulangerie.id].lecons === 2 && parId[silencieux.id]?.apprend === false && parId.moi.marque.couleurs[0] === '#FFD60A', r.j);
  essai('GET /api/espaces : les métiers, et celui deviné d’après le profil', r.j?.metiers?.chronique?.nom === 'Chroniques, revues de presse' && !('mots' in r.j.metiers.chronique) && r.j?.metier_propose?.type === 'chronique', r.j?.metier_propose);
  r = await api('POST', '/api/espaces', {nom: ''});
  essai('POST /api/espaces sans nom : 400', r.code === 400 && /nom/.test(r.j?.erreur), r);
  r = await api('POST', '/api/espaces', {nom: 'BOULANGERIE LEMOINE'});
  essai('POST /api/espaces en double : 400', r.code === 400 && /existe déjà/.test(r.j?.erreur), r);
  r = await api('POST', '/api/espaces', {nom: 'Club de course', metier: {type: 'sport'}, marque: {couleurs: ['#00ff00', 'vert'], ton: 'énergique'}});
  const club = r.j?.espace;
  essai('POST /api/espaces : un client se crée, sa marque nettoyée', r.code === 200 && club?.type === 'client' && club.metier?.type === 'sport' && JSON.stringify(club.marque.couleurs) === '["#00FF00"]', r);
  r = await api('PUT', `/api/espaces/${club.id}`, {nom: 'Club de course du quartier', apprendre: false, marque: {ton: 'énergique, positif'}});
  essai('PUT /api/espaces/:id : nom, apprentissage, marque (le reste gardé)', r.code === 200 && r.j.espace.nom === 'Club de course du quartier' && r.j.espace.apprendre === false && r.j.espace.marque.ton === 'énergique, positif' && r.j.espace.marque.couleurs[0] === '#00FF00', r);
  r = await api('GET', '/api/espaces');
  essai('un espace qui n’apprend plus est vu comme tel', r.j.espaces.find((e) => e.id === club.id)?.apprend === false);
  await api('PUT', `/api/espaces/${club.id}`, {apprendre: true});
  r = await api('PUT', '/api/espaces/neutre', {nom: 'Quelqu’un'});
  essai('PUT /api/espaces/neutre : 400', r.code === 400 && /Personne/.test(r.j?.erreur), r);
  r = await api('PUT', '/api/espaces/zz-inconnu', {nom: 'X'});
  essai('PUT sur un espace inconnu : 404', r.code === 404, r);
  r = await api('POST', `/api/espaces/${club.id}/logo`, {chemin: logoPng});
  essai('POST …/logo : le logo est rangé', r.code === 200 && r.j.espace.marque.logo === 'logo.png', r);
  let im = await image(`/api/espaces/${club.id}/logo`);
  essai('GET …/logo : l’image', im.code === 200 && /image\/png/.test(im.type), im);
  r = await api('POST', `/api/espaces/${club.id}/logo`, {chemin: path.join(T, 'absent.png')});
  essai('POST …/logo introuvable : 400, et le serveur reste debout', r.code === 400 && (await fetch(`${base}/api/ping`)).ok, r);
  r = await api('POST', '/api/espaces/neutre/logo', {chemin: logoPng});
  essai('POST …/neutre/logo : 400', r.code === 400, r);
  im = await image('/api/espaces/neutre/logo');
  essai('GET …/neutre/logo : 404', im.code === 404, im);
  r = await api('GET', `/api/espaces/${boulangerie.id}/carnet`);
  const lb = r.j?.lecons ?? [];
  essai('GET …/carnet d’un client : ses leçons (les plus récentes d’abord), jamais celles de « Moi »', r.code === 200 && lb.length === 2 && /croûte/.test(lb[0].texte) && !lb.some((l) => UNIVERS_MOI.test(l.texte)), lb);
  r = await api('GET', '/api/espaces/neutre/carnet');
  essai('GET …/neutre/carnet : vide', r.code === 200 && r.j.lecons.length === 0, r);
  r = await api('DELETE', `/api/espaces/${boulangerie.id}/carnet/${lb[0]?.id}`);
  const r2 = await api('DELETE', `/api/espaces/${boulangerie.id}/carnet/${lb[0]?.id}`);
  essai('DELETE …/carnet/:leçon : retirée une seule fois', r.code === 200 && r.j.ok === true && r2.j?.ok === false && K.lireCarnet(boulangerie.id).length === 1, [r, r2]);
  K.ajouterLecons(['Une leçon du club, à vider ensuite.'], {espace: club.id});
  r = await api('DELETE', `/api/espaces/${club.id}/carnet`);
  essai('DELETE …/carnet : vidé, celui de « Moi » intact', r.code === 200 && K.lireCarnet(club.id).length === 0 && K.lireCarnet('moi').length >= 3, r);
  r = await api('GET', '/api/espaces/zz-inconnu/carnet');
  essai('le carnet d’un espace inconnu : 404', r.code === 404, r);
  r = await api('GET', '/api/espaces/moi/series');
  essai('GET …/series : les séries de l’espace', r.code === 200 && r.j.series.length === 1 && r.j.series[0].id === serie.id && r.j.series[0].apercu === true, r);
  im = await image(`/api/espaces/moi/series/${serie.id}`);
  essai('GET …/series/:id : l’aperçu', im.code === 200 && /image\/jpeg/.test(im.type), im);
  r = await api('DELETE', '/api/espaces/moi/series/inconnue-00');
  essai('DELETE d’une série inconnue : 400', r.code === 400, r);
  r = await api('POST', '/api/espaces/dernier', {id: club.id});
  const r3 = await api('GET', '/api/espaces');
  essai('POST /api/espaces/dernier : retenu', r.code === 200 && r3.j.dernier === club.id, r3.j?.dernier);

  r = await api('POST', '/api/projets', {titre: 'Sans espace choisi'});
  const dossierClub = r.j?.racine;
  essai('POST /api/projets sans espace : le dernier choisi', r.code === 200 && r.j.espace === club.id && lire(path.join(dossierClub, 'derush.json'))?.espace === club.id && r.j.serie === null, r);
  r = await api('POST', '/api/projets', {titre: 'Pour la boulangerie', espace: boulangerie.id});
  const dossierBoulangerie = r.j?.racine;
  essai('POST /api/projets {titre, espace} : le projet est à cet espace, retenu pour le suivant', r.code === 200 && r.j.espace === boulangerie.id && ctx.P?.d.espace === boulangerie.id && lire(path.join(dossierBoulangerie, 'derush.json'))?.espace === boulangerie.id && E.lireEspaces().dernier === boulangerie.id, r);
  r = await api('POST', '/api/projets', {titre: 'Espace fantaisiste', espace: 'zz-nimporte'});
  essai('POST /api/projets avec un espace inconnu : le dernier choisi, sans erreur', r.code === 200 && r.j.espace === boulangerie.id, r);
  const episodesAvant = Se.lireSerie('moi', serie.id).episodes;
  r = await api('POST', '/api/projets', {titre: 'Chronique — épisode 2', espace: 'moi', serie: {id: serie.id}});
  const episode = lire(path.join(r.j?.racine ?? T, 'derush.json'));
  essai('POST /api/projets {titre, espace, serie} : l’épisode reprend brief, style et format, la série compte un épisode de plus', r.code === 200 && r.j.serie?.id === serie.id && r.j.serie.espace === 'moi' && episode?.serie?.id === serie.id && episode.espace === 'moi' && episode.brief.type === 'face' && episode.style?.accent === '#E63946' && episode.sortie.preset === 'vertical' && Se.lireSerie('moi', serie.id).episodes === episodesAvant + 1, {r, episode});
  r = await api('POST', '/api/projets', {titre: 'Client, sans la série de Moi', espace: boulangerie.id, serie: {id: serie.id}});
  essai('la série de « Moi » ne s’applique jamais à un projet client', r.code === 200 && r.j.serie === null && r.j.espace === boulangerie.id && !ctx.P.d.serie && ctx.P.d.brief.type === '' && !ctx.P.d.style.accent && Se.lireSerie('moi', serie.id).episodes === episodesAvant + 1, r);
  r = await api('GET', '/api/bibliotheque');
  const projets = r.j?.projets ?? [];
  essai('GET /api/bibliotheque : chaque projet dit son espace et sa série ; la liste des espaces est légère', r.code === 200 && projets.find((p) => p.titre === 'Pour la boulangerie')?.espace === boulangerie.id && projets.find((p) => p.titre === 'Chronique — épisode 2')?.serie === 'Chroniques Héritages' && projets.find((p) => p.titre === 'Sans espace choisi')?.espace === club.id && r.j.espaces.every((e) => Object.keys(e).sort().join() === 'id,nom,type') && r.j.espaces.some((e) => e.id === 'neutre') && r.j.dernier === boulangerie.id, r.j);
  r = await api('POST', '/api/projets/espace', {dossier: dossierBoulangerie, espace: 'moi'});
  essai('POST /api/projets/espace : l’espace d’un projet fermé change dans son derush.json', r.code === 200 && lire(path.join(dossierBoulangerie, 'derush.json'))?.espace === 'moi', r);
  r = await api('POST', '/api/projets/espace', {dossier: dossierBoulangerie, espace: 'zz-inconnu'});
  essai('… vers un espace inconnu : 400', r.code === 400 && lire(path.join(dossierBoulangerie, 'derush.json'))?.espace === 'moi', r);
  r = await api('POST', '/api/projets/espace', {dossier: path.join(T, 'pas-un-projet'), espace: 'moi'});
  essai('… sur un dossier qui n’est pas un projet : 400', r.code === 400, r);
  r = await api('POST', '/api/projets/espace', {dossier: ctx.P.racine, espace: 'neutre'});
  essai('… sur le projet ouvert : changé dans le projet ouvert', r.code === 200 && ctx.P.d.espace === 'neutre' && lire(path.join(ctx.P.racine, 'derush.json'))?.espace === 'neutre', r);
  r = await api('PUT', '/api/projet', {espace: boulangerie.id});
  const r4 = await api('PUT', '/api/projet', {espace: 'zz-inconnu'});
  essai('PUT /api/projet {espace} : changé ; un espace inconnu ne change rien', r.code === 200 && r4.code === 200 && ctx.P.d.espace === boulangerie.id, [r, r4]);

  // une vidéo livrée, notée, liée à sa publication
  r = await api('POST', '/api/projets', {titre: 'Chronique notée', espace: 'moi'});
  const Pnote = ctx.P;
  const NOMN = 'notee-claude-v1.mp4';
  F.enregistrerFiche(Pnote, F.creerFiche({P: Pnote, espace: esp('moi'), version: {n: 1, moteur: 'claude'}, video: {nom: NOMN, titre: 'Chronique notée', duree: 41, largeur: 1080, hauteur: 1920}}), esp('moi'));
  r = await api('POST', '/api/claude/note', {video: NOMN, note: 1, mot: 'Le rythme est parfait, garde ce découpage'});
  essai('POST /api/claude/note : la note et le mot sur la fiche', r.code === 200 && r.j.fiche.note === 1 && r.j.fiche.mot === 'Le rythme est parfait, garde ce découpage', r);
  essai('… et le mot rejoint le carnet de l’espace du projet', K.lireCarnet('moi').some((l) => /« Chronique notée » \(aimé\) : Le rythme est parfait/.test(l.texte) && l.source === 'note'));
  r = await api('POST', '/api/claude/note', {video: 'inconnue.mp4', note: 1});
  essai('noter une vidéo sans fiche : 400', r.code === 400 && /fiche/.test(r.j?.erreur), r);
  r = await api('POST', '/api/suivi/lier', {video: NOMN, lien: 'https://example.com/ma-video'});
  essai('POST /api/suivi/lier avec un lien quelconque : 400', r.code === 400, r);
  r = await api('POST', '/api/suivi/lier', {video: NOMN, lien: 'https://www.youtube.com/watch?v=essaiLIEN01'});
  await api('POST', '/api/suivi/lier', {video: NOMN, lien: 'https://www.youtube.com/watch?v=essaiLIEN01'});
  essai('POST /api/suivi/lier : suivie dans l’espace du projet, rattachée à sa fiche, une seule fois', r.code === 200 && r.j.reseau === 'youtube' && r.j.cle === 'youtube:essaiLIEN01' && Su.lireSuivi('moi').publications['youtube:essaiLIEN01']?.cle_fiche === F.ficheDe(Pnote, NOMN).cle && F.ficheDe(Pnote, NOMN).publications.length === 1 && F.lireFiches('moi').find((x) => x.video === NOMN)?.publications?.length === 1, r);
  r = await api('GET', '/api/claude/notes');
  essai('GET /api/claude/notes : les notes et publications du projet, et son espace', r.code === 200 && r.j.notes[NOMN]?.note === 1 && r.j.notes[NOMN].publications[0]?.reseau === 'youtube' && r.j.espace?.id === 'moi' && r.j.espace.apprend === true && r.j.serie === null, r.j);
  // le projet passe chez un client après coup : le mot sur une vidéo livrée pour « Moi » ne nourrit pas le carnet du client
  await api('PUT', '/api/projet', {espace: boulangerie.id});
  r = await api('POST', '/api/claude/note', {video: NOMN, note: 1, mot: 'Encore plus de mangas japonais'});
  essai('un mot sur une vidéo livrée pour « Moi » n’entre jamais au carnet d’un client (projet passé chez lui après coup)', r.code === 200 && !K.lireCarnet(boulangerie.id).some((l) => UNIVERS_MOI.test(l.texte)), K.lireCarnet(boulangerie.id));
  await api('PUT', '/api/projet', {espace: 'neutre'});
  r = await api('POST', '/api/suivi/lier', {video: NOMN, lien: 'https://www.tiktok.com/@essai/video/7300000000000000009'});
  essai('POST /api/suivi/lier sur un projet de « Personne » : 400', r.code === 400 && /Personne/.test(r.j?.erreur), r);
  r = await api('POST', '/api/claude/note', {video: NOMN, note: -1, mot: 'Personne ne doit retenir ce mot'});
  essai('« Personne » : la note reste sur la fiche du projet, rien n’est appris', r.code === 200 && r.j.fiche.note === -1 && !K.lireCarnet('moi').some((l) => /Personne ne doit/.test(l.texte)) && !fs.existsSync(path.join(E.DOSSIER_ESPACES, 'neutre', 'fiches.jsonl')) && !fs.existsSync(path.join(E.DOSSIER_ESPACES, 'neutre', 'carnet.json')), r);
  r = await api('GET', '/api/claude/notes');
  essai('GET /api/claude/notes sur un projet de « Personne » : il n’apprend pas', r.code === 200 && r.j.espace?.id === 'neutre' && r.j.espace.apprend === false, r.j);

  r = await api('GET', `/api/tableau?espace=${studio.id}&periode=tout`);
  essai('GET /api/tableau : les chiffres de l’espace, et aucune analyse en cours', r.code === 200 && r.j.chiffres.montages === 3 && r.j.periode === 'tout' && r.j.espace.id === studio.id && r.j.analyses?.recette === null && r.j.analyses?.lecture === null, r.j);
  r = await api('GET', `/api/tableau?espace=${studio.id}&periode=30`);
  essai('GET /api/tableau sur 30 jours', r.code === 200 && r.j.chiffres.montages === 1, r.j?.chiffres);
  r = await api('GET', '/api/tableau');
  essai('GET /api/tableau sans espace : « Moi », sur 90 jours', r.code === 200 && r.j.espace.id === 'moi' && r.j.periode === '90', r.j?.espace);
  r = await api('GET', '/api/tableau?espace=neutre');
  essai('GET /api/tableau de « Personne » : vide', r.code === 200 && r.j.espace.apprend === false && r.j.chiffres.montages === 0, r.j);
  r = await api('GET', '/api/tableau?espace=zz-inconnu');
  essai('GET /api/tableau d’un espace inconnu : 400', r.code === 400, r);
  im = await image(`/api/tableau/vignettes?espace=${studio.id}&cle=${clesStudio[0]}`);
  const im2 = await image(`/api/tableau/vignettes?espace=${studio.id}&cle=${clesStudio[1]}`);
  essai('GET /api/tableau/vignettes : l’image, ou 404', im.code === 200 && /image\/jpeg/.test(im.type) && im2.code === 404, [im, im2]);

  r = await api('POST', '/api/suivi/relire', {espace: 'zz-inconnu'});
  essai('POST /api/suivi/relire d’un espace inconnu : 400', r.code === 400, r);
  const avantRoute = journal.length;
  r = await api('POST', '/api/suivi/relire', {espace: 'moi'});
  essai('POST /api/suivi/relire sans clé : sans_cle, et Treg n’est pas appelé', r.code === 200 && r.j.sans_cle === true && r.j.lues === 0 && journal.length === avantRoute, r);
  chaineYouTube.essaiLIEN01 = {vues: 700, publie: new Date().toISOString()};
  process.env.TREG_TOKEN = CLE; // la fausse clé, pour le faux Treg seulement
  r = await api('POST', '/api/suivi/relire', {espace: 'moi'});
  delete process.env.TREG_TOKEN;
  essai('POST /api/suivi/relire avec une clé (faux Treg) : la vidéo liée est relue, le reste attend son heure', r.code === 200 && r.j.lues === 1 && r.j.erreurs.length === 0 && r.j.sans_cle === false && Su.lireSuivi('moi').publications['youtube:essaiLIEN01'].lectures.at(-1)?.vues === 700 && journal.length > avantRoute && journal.slice(avantRoute).every((x) => x.cle === CLE && LECTURES_PERMISES.has(x.chemin)), r);

  r = await api('DELETE', '/api/espaces/moi');
  const r5 = await api('DELETE', '/api/espaces/neutre');
  essai('DELETE /api/espaces/moi et /neutre : 400', r.code === 400 && r5.code === 400, [r, r5]);
  r = await api('DELETE', `/api/espaces/${club.id}`);
  const apres = await api('GET', '/api/espaces');
  essai('DELETE /api/espaces/:client : retiré, son dossier gardé à part, ses projets passent à « Personne »', r.code === 200 && r.j.ok === true && !apres.j.espaces.some((e) => e.id === club.id) && !fs.existsSync(path.join(E.DOSSIER_ESPACES, club.id)) && fs.readdirSync(path.join(E.DOSSIER_ESPACES, '.retires')).some((n) => n.startsWith(`${club.id}-`)) && E.espaceDuProjet({d: lire(path.join(dossierClub, 'derush.json'))}).id === 'neutre', r);
  r = await api('DELETE', `/api/espaces/${club.id}`);
  essai('… une seconde fois : 404', r.code === 404, r);
  // une série animée : la bible et les passeports (public/serie/) passent avant les vidéos lourdes, et l'épisode suivant les reçoit
  const atelierAnime = path.join(T, 'atelier-anime');
  const pubAnime = path.join(atelierAnime, 'remotion', 'public');
  fs.mkdirSync(path.join(atelierAnime, 'remotion', 'src'), {recursive: true});
  fs.writeFileSync(path.join(atelierAnime, 'remotion', 'src', 'Montage.tsx'), 'export const Montage = () => null;\n');
  fs.mkdirSync(path.join(pubAnime, 'videos'), {recursive: true});
  for (let i = 0; i < 11; i++) { const f = path.join(pubAnime, 'videos', `a${String(i).padStart(2, '0')}.mp4`); fs.writeFileSync(f, ''); fs.truncateSync(f, 7_900_000); }
  fs.mkdirSync(path.join(pubAnime, 'serie', 'personnages', 'robot'), {recursive: true});
  fs.writeFileSync(path.join(pubAnime, 'serie', 'bible.md'), '# Bible\n');
  fs.writeFileSync(path.join(pubAnime, 'serie', 'personnages', 'robot', 'passeport.md'), '# @robot\n');
  fs.writeFileSync(path.join(pubAnime, 'serie', 'personnages', 'robot', 'reference.png'), Buffer.alloc(1000));
  const anime = Se.creerSerie({P: {d: {titre: 'Le robot, épisode 1', mode: 'motion'}}, espaceId: 'moi', atelier: atelierAnime, version: {n: 1}, video: {nom: 'v1.mp4', titre: 'Épisode 1'}, nom: 'Le robot boulanger'});
  const DA = Se.dossierSerie('moi', anime.id);
  const gardees = fs.readdirSync(path.join(DA, 'public', 'videos')).length;
  essai('série animée : la bible et les passeports gardés en premier, même quand les vidéos dépassent la place', ['bible.md', 'personnages/robot/passeport.md', 'personnages/robot/reference.png'].every((x) => fs.existsSync(path.join(DA, 'public', 'serie', x))) && gardees === 10 && anime.copie.sautes === 1, {gardees, copie: anime.copie});
  const episodeAnime = path.join(T, 'episode-anime');
  fs.mkdirSync(episodeAnime, {recursive: true});
  Se.installerSerie(episodeAnime, {d: {serie: {id: anime.id, espace: 'moi'}}}, E.trouverEspace('moi'));
  essai('série animée : l’épisode suivant reçoit la bible et les passeports, et SERIE.md renvoie à la compétence', fs.existsSync(path.join(episodeAnime, 'contexte', 'serie', 'public', 'serie', 'personnages', 'robot', 'passeport.md')) && fs.readFileSync(path.join(episodeAnime, 'contexte', 'serie', 'SERIE.md'), 'utf8').includes('derush-serie-animee'));
  Se.retirerSerie('moi', anime.id);

  r = await fetch(`${base}/api/ping`).then((y) => y.json());
  essai('toujours vivant après tout ça (aucune erreur n’a fait tomber le serveur)', r.derush === true, r);
} catch (e) {
  essai('les essais sont allés au bout', false, e.stack);
} finally {
  serveur?.close();
  fauxTreg.close();
  if (bons === total) fs.rmSync(T, {recursive: true, force: true});
  else console.log(`\nLe dossier d’essai est gardé pour comprendre : ${T}`);
}
console.log(`\n${bons} essais réussis sur ${total}`);
process.exit(bons === total ? 0 : 1); // obligatoire : les états des moteurs en cours de calcul retiennent le processus
