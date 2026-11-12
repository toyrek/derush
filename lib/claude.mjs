// Dérush — la conversation avec l'IA qui monte : Claude (Claude Code, compte Claude), Codex (compte ChatGPT) ou Gemini
// (la commande agy d'Antigravity, compte Google).
// Dérush prépare le dossier de montage, y installe ce que l'humain a joint (références, charte, vidéos, archives…), les
// compétences et les connexions, puis lance l'IA dedans. Elle répond, monte une ou plusieurs vidéos, ou les publie ;
// Dérush suit son travail en direct (les images qu'elle regarde, son rendu image par image) et récupère tout.
// Le nom du fichier est resté « claude.mjs » : c'était le seul assistant avant Dérush 7.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {slug, MODES} from './commun.mjs';
import {WINDOWS, arreterArbre, lier, garderEveille} from './plateforme.mjs';
import {ffmpeg, ecrireJson, lireJson, tailleLisible} from './outils.mjs';
import {exporterPack} from './pack.mjs';
import {etatRendu, installerRendu, dossierMoteurRendu, controlerVideo} from './rendu.mjs';
import {moteurs, transcrire} from './transcription.mjs';
import {etatBlender, PYTHON, RACINE_APP} from './moteurs.mjs';
import {consigneElevenLabs, chargerCle, listerCreations, occupe} from './elevenlabs.mjs';
import {boiteAOutils, guideMotion, consigneCompetences} from './recettes.mjs';
import {attacherPieces, attendrePieces, installerContexte, listerPieces} from './pieces.mjs';
import {argsConnecteursClaude, intrus, refuser, refuses, NOM_CONNECTEUR, PREFIXE_OUTILS, installerDrive, consigneDrive, noterConnecteur, dossiersDrive, etatDrive} from './drive.mjs';
import {consigneTreg, rappelTreg, argsCodexTreg, NOMS_TREG, noterConnecteurTreg, jetonTreg} from './treg.mjs';
import {installerCompetences, DOSSIER_COMMANDES} from './competences.mjs';
import {IA, MODELES, EFFORTS, QUALITES, reglageIA, envIA, etatClaude, etatCodex, etatIA, moteurChoisi, argsCodex, lireEvenementCodex, argsGemini, lecteurGemini, refusGemini, commandeLancement} from './ia.mjs';
import {outilsLisibles, reglagesGemini, envGemini} from './gemini.mjs';
import {lireReglages} from './reglages.mjs';
import {rappelMaj} from './maj.mjs';
import {ouvrirRelais} from './relais.mjs';
import {installerSons, envSons, ecritsSons, lusSons, consigneSons, rappelSons, partieSons} from './sons.mjs';
import {installerProfil, consigneCreateur} from './createur.mjs';

export {MODELES, EFFORTS, QUALITES, etatClaude, etatCodex, etatIA};
/** La longueur maximale d'un message (un brief entier tient largement ; au-delà, mieux vaut un fichier joint). */
export const LONGUEUR_MESSAGE = 24000;
export const RESEAUX = {
  tiktok: {nom: 'TikTok', aide: 'Part en brouillon dans ta boîte TikTok : tu publies depuis l’app.'},
  youtube: {nom: 'YouTube Shorts', aide: 'Non répertoriée, sauf si tu choisis Publique.'},
  instagram: {nom: 'Instagram Reels', aide: 'Publiée directement sur ton compte professionnel.'},
  linkedin: {nom: 'LinkedIn', aide: 'Publiée directement sur ton profil.'},
};

// ——— État d'une conversation : ce qui est écrit dans le projet (claude/etat.json) et ce qui tourne en ce moment ———
const EN_COURS = new Map(); // racine du projet → {proc, etape, debut, activite[], vues[], atelier, …}
const fichierEtat = (P) => path.join(P.racine, 'claude', 'etat.json');
function lireEtat(P) {
  const e = lireJson(fichierEtat(P)) ?? {atelier: null, echanges: [], versions: []};
  // avant Dérush 7, une seule conversation (Claude) : on la range avec les autres
  e.sessions ??= e.session ? {claude: e.session} : {};
  return e;
}
function ecrireEtat(P, e) {
  fs.mkdirSync(path.dirname(fichierEtat(P)), {recursive: true});
  ecrireJson(fichierEtat(P), e, 2);
}
export const claudeTravaille = () => EN_COURS.size > 0;
/** Une empreinte du montage : dit si l'humain a changé quelque chose depuis que l'IA a reçu son dossier. */
const empreinte = (P) => crypto.createHash('sha1').update(JSON.stringify([P.d.montage, P.d.superpositions ?? [], P.d.indications ?? [], P.d.style ?? {}, P.d.brief ?? {}, P.d.sortie, P.d.medias.map((m) => m.id)])).digest('hex').slice(0, 16);

/** La découpe choisie par l'IA (quand elle est passée par recouper.mjs), pour la remettre dans la timeline de Dérush. */
export function decoupeDeClaude(P) {
  const e = lireEtat(P);
  const M = e.atelier ? lireJson(path.join(P.racine, e.atelier, 'montage.json')) : null;
  if (!M || M.decoupe !== 'ia') return null;
  const connus = new Set(P.d.medias.map((m) => m.id));
  const plans = (M.montage ?? []).filter((it) => it.type === 'plan' && connus.has(it.source?.id)).map((it) => ({
    media: it.source.id, titre: it.titre ?? '',
    entree: it.source.type === 'image' ? 0 : it.source.entree.s,
    sortie: it.source.type === 'image' ? it.duree.s : it.source.sortie.s,
  })).filter((p) => p.sortie > p.entree);
  return plans.length ? plans : null;
}
/** La timeline de Dérush vient de reprendre la découpe de l'IA : les deux sont de nouveau d'accord. */
export function synchroniserDemande(P) {
  const e = lireEtat(P);
  if (e.atelier) ecrireEtat(P, {...e, empreinte: empreinte(P), decoupe_reprise: true});
}

/** Le rendu en direct : ce que rendre.mjs écrit pendant qu'il rend (progression et petites images). */
function directDe(atelier, depuis) {
  const D = path.join(atelier, 'rendu', '.direct');
  const rendus = [];
  let dossiers = [];
  try { dossiers = fs.readdirSync(D); } catch { return rendus; }
  for (const id of dossiers) {
    const x = lireJson(path.join(D, id, 'etat.json'));
    if (!x || Date.parse(x.debut) < depuis - 5000) continue;
    let images = [];
    try { images = fs.readdirSync(path.join(D, id)).map((f) => /^f-(\d{5})\.jpg$/.exec(f)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b); } catch { /* dossier en cours d'écriture */ }
    rendus.push({id, titre: x.titre, composition: x.composition, etape: x.etape, total: x.total, rendues: x.rendues, fps: x.fps, largeur: x.largeur, hauteur: x.hauteur, pas_s: x.pas_s ?? 0.5, debut: x.debut, fin: x.fin, erreur: x.erreur, images});
  }
  return rendus.sort((a, b) => a.debut.localeCompare(b.debut));
}
/** Le fichier d'une image du direct (ou null), pour la route qui la sert. */
export function fichierDirect(P, id, nom) {
  const e = lireEtat(P);
  if (!e.atelier || !/^[\w-]+$/.test(id) || !/^f-\d{5}\.jpg$/.test(nom)) return null;
  const f = path.join(P.racine, e.atelier, 'rendu', '.direct', id, nom);
  return fs.existsSync(f) ? f : null;
}
/** Une image que l'IA a regardée pendant son travail (son n° dans la liste du direct). */
export function fichierVue(P, n) {
  const c = EN_COURS.get(P.racine) ?? DERNIERES_VUES.get(P.racine);
  const v = c?.vues?.[Number(n)];
  return v && fs.existsSync(v.chemin) ? v.chemin : null;
}
const DERNIERES_VUES = new Map();

/** Les vidéos d'une version (les anciennes versions n'en avaient qu'une). */
const videosDe = (v) => (v.videos?.length ? v.videos : [{nom: v.nom, titre: null, duree: v.duree, largeur: v.largeur, hauteur: v.hauteur, taille_lisible: v.taille_lisible, controles: v.controles, vignettes: v.vignettes ?? null}]);

/** Le dossier des annexes d'une version, à côté de ses vidéos : « <titre>-<ia>-v<n>-annexes ». */
const dossierAnnexes = (nomVideo) => { const m = /^(.*-v\d+)(?:-\d+(?:-[\w-]+)?)?\.mp4$/i.exec(String(nomVideo ?? '')); return m ? `${m[1]}-annexes` : null; };
/** Les fichiers d'un dossier (trois niveaux au plus, sans fichiers cachés ni liens), dans l'ordre. */
function fichiersDe(dossier, depuis = 0, max = 200) {
  const liste = [];
  const parcourir = (d, rel, niveau) => {
    let noms = [];
    try { noms = fs.readdirSync(d).sort((a, b) => a.localeCompare(b, 'fr', {numeric: true})); } catch { return; }
    for (const n of noms) {
      if (n.startsWith('.') || liste.length >= max) continue;
      const f = path.join(d, n);
      let st;
      try { st = fs.lstatSync(f); } catch { continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { if (niveau < 3) parcourir(f, path.join(rel, n), niveau + 1); } else if (st.isFile() && st.mtimeMs >= depuis - 2000) liste.push({nom: path.join(rel, n), fichier: f, taille: st.size});
    }
  };
  parcourir(dossier, '', 0);
  return liste;
}
/**
 * Les autres fichiers que l'IA remet avec sa vidéo (image fixe, storyboard, master, liste des polices et des sons…) :
 * elle les met dans rendu/livraison/annexes/, Dérush les recopie à côté de la vidéo (6 Go au plus). Renvoie leur nombre.
 */
function rangerAnnexes(atelier, depuis, cible) {
  let total = 0;
  let n = 0;
  for (const x of fichiersDe(path.join(atelier, 'rendu', 'livraison', 'annexes'), depuis)) {
    if (total + x.taille > 6e9) break;
    try { const vers = path.join(cible, x.nom); fs.mkdirSync(path.dirname(vers), {recursive: true}); fs.copyFileSync(x.fichier, vers); total += x.taille; n++; } catch { /* ce fichier reste dans le dossier de travail */ }
  }
  return n;
}
/** Les annexes rangées avec une version (lues sur le disque : rien à enregistrer). */
function annexesDe(dossierVideos, nomVideo) {
  const d = dossierAnnexes(nomVideo);
  if (!d) return null;
  const liste = fichiersDe(path.join(dossierVideos, d), 0, 200);
  if (!liste.length) return null;
  return {dossier: d, chemin: path.join(dossierVideos, d), nombre: liste.length, taille_lisible: tailleLisible(liste.reduce((s, x) => s + x.taille, 0)), fichiers: liste.slice(0, 40).map((x) => ({nom: x.nom, taille_lisible: tailleLisible(x.taille)}))};
}

/** Tout ce que l'interface affiche : la conversation, les pièces jointes, les vidéos, et le travail en cours (en direct). */
export function etatDemande(P) {
  const e = lireEtat(P);
  const c = EN_COURS.get(P.racine);
  const atelierPret = !!e.atelier && fs.existsSync(path.join(P.racine, e.atelier, 'montage.json'));
  const dossierVideos = path.join(P.racine, 'vidéos');
  const versions = (e.versions ?? []).map((v) => {
    const videos = videosDe(v).filter((x) => x.nom && fs.existsSync(path.join(dossierVideos, x.nom))).map((x) => ({...x, chemin: path.join(dossierVideos, x.nom)}));
    const annexes = videos.length ? annexesDe(dossierVideos, videos[0].nom) : null;
    return videos.length ? {...v, ...videos[0], videos, ...(annexes ? {annexes} : {})} : null;
  }).filter(Boolean);
  const session = atelierPret ? (e.sessions[e.moteur ?? 'claude'] ?? e.sessions.claude ?? e.sessions.codex ?? e.sessions.gemini ?? null) : null;
  return {
    ...e, versions, atelier: atelierPret ? e.atelier : null, session,
    atelier_chemin: atelierPret ? path.join(P.racine, e.atelier) : null,
    pieces: listerPieces(P),
    // l'humain a retouché son montage depuis : l'IA travaille encore sur l'ancien, sauf si on repart du montage
    montage_change: atelierPret && !!e.empreinte && e.empreinte !== empreinte(P),
    // l'IA a choisi elle-même les passages : on peut les reprendre dans la timeline
    decoupe_ia: !c && atelierPret && !e.decoupe_reprise ? (decoupeDeClaude(P)?.length ?? 0) : 0,
    en_cours: c ? {
      etape: c.etape, depuis_s: Math.round((Date.now() - c.debut) / 1000), progression: c.progression, activite: c.activite.slice(-40), n_activite: c.nActivite,
      message: c.message, moteur: c.moteur, qualite: c.qualite, modele: c.modele, effort: c.effort, reprise: c.reprise, arret: c.annule, publier: !!c.publier,
      // le direct : les images que l'IA regarde, et ses rendus image par image
      // … et sa table de montage, au fur et à mesure qu'elle la remplit
      direct: {vues: c.vues.slice(-24).map((v) => ({n: v.n, nom: v.nom, t: v.t})), rendus: c.atelier ? directDe(c.atelier, c.debutIA ?? c.debut) : [], table: c.atelier ? tableIA(c.atelier, c.debutIA ?? c.debut) : null},
    } : null,
  };
}

const RESEAU_TREG = {tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram', linkedin: 'LinkedIn'};
/** Une ligne lisible pour chaque geste de l'IA (ce qu'elle lit, écrit, lance, publie). */
function decrire(outil, entree, atelier) {
  const dehors = (f) => { const rel = path.relative(atelier, String(f ?? '')); return rel.startsWith('..') || path.isAbsolute(rel); };
  const nom = (f) => (f ? (dehors(f) ? path.basename(String(f)) : path.relative(atelier, String(f)) || path.basename(String(f))) : '');
  if (outil === 'Read') return {icone: 'oeil', texte: dehors(entree.file_path) && /[\\/]\.claude[\\/]/.test(String(entree.file_path)) ? 'Relit ses notes' : `Lit ${nom(entree.file_path)}`};
  if (outil === 'Write') return {icone: 'crayon', texte: `Écrit ${nom(entree.file_path)}`};
  if (outil === 'Edit' || outil === 'NotebookEdit') return {icone: 'crayon', texte: `Modifie ${nom(entree.file_path ?? entree.notebook_path)}${entree.autres ? ` (et ${entree.autres} autre${entree.autres > 1 ? 's' : ''})` : ''}`};
  if (outil === 'Skill') return {icone: 'outil', texte: `Ouvre la compétence « ${entree.skill ?? ''} »`};
  if (outil === 'WebSearch') return {icone: 'loupe', texte: `Cherche sur le web : ${String(entree.query ?? '').slice(0, 80)}`};
  if (outil === 'WebFetch') return {icone: 'loupe', texte: 'Lit une page web'};
  // Treg : la publication sur les réseaux
  const treg = /^mcp__(?:treg|claude_ai_Treg)__(\w+)$/.exec(outil);
  if (treg) {
    const id = String(entree.endpoint_id ?? '');
    const reseau = RESEAU_TREG[id.split('.')[0]] ?? null;
    if (treg[1] === 'call') {
      const quoi = /publish\.status|container\.status/.test(id) ? 'Vérifie la publication' : /profile/.test(id) ? 'Regarde ton compte' : /\.(init|upload|create)$/.test(id) ? 'Envoie la vidéo' : /publish|post\.create/.test(id) ? 'Publie' : /finalize/.test(id) ? 'Termine l’envoi' : 'Appelle';
      return {icone: 'globe', texte: `${quoi}${reseau ? ` sur ${reseau}` : ' avec Treg'}`};
    }
    return {icone: 'globe', texte: treg[1] === 'catalog_get' ? `Prépare la publication${reseau ? ` sur ${reseau}` : ''}` : 'Regarde Treg'};
  }
  // le connecteur Google Drive (Claude)
  if (outil.startsWith(PREFIXE_OUTILS)) {
    const quoi = outil.slice(PREFIXE_OUTILS.length);
    if (quoi === 'search_files') return {icone: 'nuage', texte: `Cherche dans ton Google Drive${entree.query ? ` : ${String(entree.query).slice(0, 70)}` : ''}`};
    if (quoi === 'create_file') return {icone: 'nuage', texte: `Crée « ${String(entree.title ?? entree.name ?? 'un document').slice(0, 60)} » sur ton Google Drive`};
    if (quoi === 'copy_file') return {icone: 'nuage', texte: 'Copie un fichier de ton Google Drive'};
    if (quoi === 'list_recent_files') return {icone: 'nuage', texte: 'Regarde tes fichiers récents du Google Drive'};
    return {icone: 'nuage', texte: quoi === 'get_file_metadata' || quoi === 'get_file_permissions' ? 'Regarde un fichier de ton Google Drive' : 'Lit un fichier de ton Google Drive'};
  }
  if (outil === 'Bash') {
    const c = String(entree.command ?? '');
    // une description vide ou de remplissage (« bash_placeholder ») ne dit rien à l'humain : on décrit la commande nous-mêmes
    const dit = String(entree.description ?? '').trim().replace(/^\w*placeholder\w*$/i, '');
    const eleven = /elevenlabs|api\.elevenlabs\.io/i.test(c);
    const envoi = /curl[^\n]*-X\s*PUT|litterbox|upload_url|uploadUrl/i.test(c);
    const icone = eleven ? 'onde' : envoi ? 'globe' : /rendre\.mjs|remotion\s+render|npm run rendu|ffmpeg/.test(c) ? 'film' : /blender/i.test(c) ? 'cube' : /remotion\s+still|look\.py|ffprobe|check\.py|loudness\.py/.test(c) ? 'oeil' : /SKILL\.md/.test(c) ? 'outil' : 'outil';
    const competence = /(?:skills)[\\/]([\w.-]+)[\\/]SKILL\.md/.exec(c)?.[1];
    const defaut = eleven ? 'Crée avec ElevenLabs' : envoi ? 'Envoie la vidéo sur le réseau' : /rendre\.mjs|remotion\s+render|npm run rendu/.test(c) ? 'Rend la vidéo' : /remotion\s+still/.test(c) ? 'Regarde une image du rendu' : /blender/i.test(c) ? 'Travaille dans Blender'
      : competence ? `Lit la compétence « ${competence} »` : /ffprobe|check\.py|loudness\.py/.test(c) ? 'Mesure la vidéo' : /ffmpeg/.test(c) ? 'Traite la vidéo avec FFmpeg' : /^(cat|sed|head|tail|less|rg|grep|ls|find)\b/.test(c.trim()) ? 'Lit le dossier' : 'Lance une commande';
    return {icone, texte: dit || defaut};
  }
  return {icone: 'outil', texte: outil.replace(/^mcp__[^_]+(?:_[^_]+)*__/, '')};
}

const CONSIGNES = (moteur) => `Tu es lancé par Dérush, un logiciel de montage vidéo. Tu es le monteur : l'humain te parle comme dans une conversation, et il ne peut pas te répondre pendant que tu travailles.
- S'il demande une ou plusieurs vidéos (ou une modification), va jusqu'au bout sans demander d'accord ni poser de question. Si une étape de CLAUDE.md ou de LISEZMOI-IA.md dit d'attendre un accord, fais le choix le plus sûr, continue, et dis-le à la fin.
- S'il pose une question, demande un avis ou t'envoie seulement de la matière (références, charte…), réponds-lui simplement, sans fabriquer de vidéo.
- Ce qu'il t'a donné (références, vidéos, charte graphique, logo, polices, archives, créations ElevenLabs) est dans contexte/ : lis contexte/INDEX.md, regarde les pièces, et respecte la charte s'il y en a une.
- Travaille uniquement dans ce dossier. Le kit remotion/ est déjà installé (node_modules présent) : pars de lui.${moteur === 'codex' ? '\n- Tu travailles dans un bac à sable : tu peux écrire dans ce dossier et dans le dossier temporaire (et, par leurs commandes, dans la bibliothèque de sons), et le réseau est ouvert (ElevenLabs, Treg, Openverse). N’installe rien ailleurs. Le navigateur de rendu ne peut pas démarrer dans ce bac à sable : pour rendre, lance toujours « node remotion/rendre.mjs <Composition> <fichier.mp4> » — Dérush fait alors le rendu pour toi et te renvoie sa sortie. « npx remotion render », « remotion still » et « remotion studio » ne marchent pas ici : pour regarder une image, tire-la de la vidéo rendue avec FFmpeg (ou look.py de ffmpeg-skill).' : moteur === 'gemini' ? '\n- Tu travailles dans un bac à sable : tu peux écrire dans ce dossier et dans le dossier temporaire (et, par leurs commandes, dans la bibliothèque de sons), et tu ne lis que ce dossier et les outils de Dérush. Le réseau est ouvert pour tes commandes (ElevenLabs, Openverse, une page à lire) : curl, Python et Node y passent tout seuls. N’installe rien ailleurs. Le navigateur de rendu ne peut pas démarrer dans ce bac à sable : pour rendre, lance toujours « node remotion/rendre.mjs <Composition> <fichier.mp4> » — Dérush fait alors le rendu pour toi et te renvoie sa sortie ; un rendu prend souvent une à trois minutes : attends la fin de la commande avant de continuer. « npx remotion render », « remotion still » et « remotion studio » ne marchent pas ici : pour regarder une image, tire-la de la vidéo rendue avec FFmpeg (ou look.py de ffmpeg-skill). Ne demande jamais à sortir du bac à sable : personne n’est là pour te répondre, ce sera refusé ; si une commande utile échoue à cause de lui, continue sans elle et dis-le à la fin. Tu n’as pas les outils Treg (voir plus bas).' : ''}
- Le format de sortie est celui du projet (montage.json, « sortie ») ; s'il te demande un autre format (paysage 16:9, carré, 4:5…) ou plusieurs, fais une composition par format. Les rushes peuvent être de formats différents : cadre chacun pour remplir l'image sans le déformer.
- Rends toujours avec « node remotion/rendre.mjs <Composition> <fichier.mp4> » (ou « npm run rendu » dans remotion/) : l'humain voit ton rendu en direct dans Dérush, image par image. N'utilise « npx remotion render » qu'en dernier recours.
- Une seule vidéo : livre-la dans rendu/final.mp4. Plusieurs vidéos (plusieurs clips, plusieurs formats, plusieurs langues) : une composition par vidéo, et livre-les toutes dans rendu/livraison/, avec rendu/livraison/livraison.json : [{"fichier": "clip-1.mp4", "titre": "Titre court"}, …]. À chaque nouvelle demande, remplace ce que tu avais livré.
- D'autres fichiers à remettre avec la vidéo (image fixe, storyboard, master de haute qualité, liste des polices et des sons, sous-titres…) : mets-les dans rendu/livraison/annexes/. Dérush les range à côté de la vidéo et les montre à l'humain ; ne les mets pas ailleurs.
- La table de montage : dès que ton plan est prêt, écris rendu/timeline.json, et tiens-le à jour jusqu'à la fin. C'est la liste de ce que tu poses sur la vidéo : {"duree_s": 27.4, "blocs": [{"id": "titre-intro", "piste": "texte", "nom": "Titre d'intro", "debut_s": 0, "duree_s": 2.4, "detail": "« SHIBUYA » derrière la personne, police Anton, jaune", "texte": "SHIBUYA"}]}. Un bloc par élément : chaque plan gardé (piste "plan", avec "source" = l'id du rush), chaque titre ou texte à l'écran ("texte", avec son "texte"), les sous-titres ("sous-titres"), chaque effet ou transition ("effet"), chaque musique, voix ou bruitage ("son"). Des noms courts et clairs, en français ; les mêmes "id" d'une version à l'autre ; avec plusieurs vidéos, ajoute "video" (le nom du fichier livré). L'humain voit ces blocs en direct dans sa timeline et te demande des réglages en citant leur "id" : applique exactement ces réglages, sans toucher au reste, puis remets le fichier à jour.
- Un « son tendance » (une musique du commerce qui marche sur TikTok ou Instagram) ne se met jamais dans le fichier : le réseau couperait le son ou retirerait la vidéo. Si l'humain en veut un, monte sur le rythme (dis le tempo que tu as pris), garde ta bande son discrète ou absente à cet endroit, et dis-lui quel son choisir dans l'app au moment de publier.
- Avant de finir, vérifie chaque vidéo (« Vérifier avant de livrer » dans LISEZMOI-IA.md) et regarde des images du rendu.
- Écris la description de chaque commande en français, en quelques mots simples : l'humain la lit pendant que tu travailles. Les phrases que tu écris entre deux étapes sont en français elles aussi.
- Termine par un message court pour l'humain (8 lignes au plus), en français simple et sans jargon : ce que tu as fait, ce que tu n'as pas pu faire, et une ou deux idées pour aller plus loin. N'y mets ni chemin de fichier ni nom de fichier ou de code : l'humain regarde les vidéos directement dans Dérush.`;

/** Les vidéos que l'IA a livrées pendant ce travail : rendu/livraison/ (plusieurs), sinon rendu/final.mp4. */
function livraisons(atelier, depuis) {
  const R = path.join(atelier, 'rendu');
  const recente = (f) => { try { const st = fs.statSync(f); return st.isFile() && st.size > 10000 && st.mtimeMs >= depuis - 2000; } catch { return false; } };
  const L = path.join(R, 'livraison');
  let liste = [];
  try {
    const manifeste = lireJson(path.join(L, 'livraison.json'));
    const decrites = Array.isArray(manifeste) ? manifeste : Array.isArray(manifeste?.videos) ? manifeste.videos : [];
    const vues = new Set();
    for (const x of decrites) {
      const f = path.join(L, path.basename(String(x?.fichier ?? '')));
      if (/\.(mp4|mov)$/i.test(f) && recente(f) && !vues.has(f)) { vues.add(f); liste.push({fichier: f, titre: String(x.titre ?? '').slice(0, 80) || null, description: String(x.description ?? '').slice(0, 300) || null}); }
    }
    for (const n of fs.readdirSync(L).sort((a, b) => a.localeCompare(b, 'fr', {numeric: true}))) {
      const f = path.join(L, n);
      if (/\.(mp4|mov)$/i.test(n) && recente(f) && !vues.has(f)) liste.push({fichier: f, titre: null, description: null});
    }
  } catch { /* pas de dossier livraison */ }
  if (!liste.length && recente(path.join(R, 'final.mp4'))) liste = [{fichier: path.join(R, 'final.mp4'), titre: null, description: null}];
  if (!liste.length) {
    try {
      const videos = fs.readdirSync(R).filter((f) => /\.(mp4|mov)$/i.test(f)).map((f) => path.join(R, f)).filter(recente).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      if (videos[0]) liste = [{fichier: videos[0], titre: null, description: null}];
    } catch { /* pas de dossier rendu */ }
  }
  return liste.slice(0, 20);
}
/** Ce que l'IA a publié (rendu/publications.json, écrit pendant ce travail), vérifié avant d'être montré. */
function publications(atelier, depuis) {
  const f = path.join(atelier, 'rendu', 'publications.json');
  try { if (fs.statSync(f).mtimeMs < depuis - 2000) return []; } catch { return []; }
  const liste = lireJson(f);
  if (!Array.isArray(liste)) return [];
  const texte = (v, n) => (v == null ? null : String(v).slice(0, n));
  return liste.filter((x) => x && RESEAUX[x.reseau]).slice(0, 20).map((x) => ({
    reseau: x.reseau,
    etat: ['publie', 'brouillon', 'en_cours', 'echec'].includes(x.etat) ? x.etat : 'en_cours',
    lien: /^https:\/\/[^\s"<>]+$/.test(String(x.lien ?? '')) ? String(x.lien) : null,
    visibilite: texte(x.visibilite, 20), titre: texte(x.titre, 200), legende: texte(x.legende, 2400),
    hashtags: Array.isArray(x.hashtags) ? x.hashtags.slice(0, 30).map((h) => String(h).slice(0, 80)) : [],
    message: texte(x.message, 400), video: texte(x.video, 200),
  }));
}
/** Les crédits des sons à citer (rendu/credits-sons.md, écrit pendant ce travail) : seulement s'il y en a vraiment. */
function creditsSons(atelier, depuis) {
  const f = path.join(atelier, 'rendu', 'credits-sons.md');
  try { if (fs.statSync(f).mtimeMs < depuis - 2000) return null; } catch { return null; }
  let t = '';
  try { t = fs.readFileSync(f, 'utf8'); } catch { return null; }
  const lignes = t.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[-•*]\s+\S/.test(l)).map((l) => l.replace(/^[-•*]\s+/, '').slice(0, 400)).slice(0, 30);
  return lignes.length ? {nombre: lignes.length, texte: `Sons :\n${lignes.map((l) => `- ${l}`).join('\n')}`} : null;
}
/**
 * La table de montage de l'IA (rendu/timeline.json, qu'elle tient à jour pendant son travail) : ce qu'elle pose sur la
 * vidéo, bloc par bloc — plans, titres et textes, sous-titres, effets, sons. Dérush la montre en direct dans la
 * timeline ; l'humain clique un bloc pour demander un réglage précis. Tout est vérifié et borné avant d'être montré.
 */
const PISTES_TABLE = ['plan', 'texte', 'sous-titres', 'effet', 'son'];
export function tableIA(atelier, depuis = 0) {
  const f = path.join(atelier, 'rendu', 'timeline.json');
  try { if (fs.statSync(f).mtimeMs < depuis - 2000) return null; } catch { return null; }
  const j = lireJson(f);
  const liste = Array.isArray(j) ? j : Array.isArray(j?.blocs) ? j.blocs : null;
  if (!liste) return null;
  const nombre = (v, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.round(Math.min(max, Math.max(min, n)) * 1000) / 1000 : null; };
  const texte = (v, n) => (v == null || v === '' ? null : String(v).replace(/\s+/g, ' ').trim().slice(0, n));
  const vus = new Set();
  const blocs = [];
  for (const b of liste.slice(0, 300)) {
    if (!b || typeof b !== 'object') continue;
    const debut = nombre(b.debut_s ?? b.debut, 0, 36000);
    const duree = nombre(b.duree_s ?? b.duree ?? (b.fin_s != null && debut != null ? Number(b.fin_s) - debut : null), 0.04, 36000);
    if (debut == null || duree == null) continue;
    let id = String(b.id ?? '').replace(/[^\w.-]/g, '').slice(0, 60) || `bloc-${blocs.length + 1}`;
    while (vus.has(id)) id = `${id}-bis`;
    vus.add(id);
    blocs.push({id, piste: PISTES_TABLE.includes(b.piste) ? b.piste : 'effet', nom: texte(b.nom, 80) ?? id, debut_s: debut, duree_s: duree, detail: texte(b.detail, 300), texte: texte(b.texte, 300),
      video: b.video ? path.basename(String(b.video)).slice(0, 120) : null, source: texte(b.source, 20)});
  }
  if (!blocs.length) return null;
  blocs.sort((a, b) => a.debut_s - b.debut_s);
  return {duree_s: nombre(j?.duree_s, 0, 36000) ?? Math.max(...blocs.map((b) => b.debut_s + b.duree_s)), blocs};
}
/** Une bande d'images de la vidéo, pour la piste de l'IA dans la timeline. */
async function vignettesVideo(fichier, info, sortie) {
  if (!info?.duree || !info.largeur) return null;
  const n = Math.max(6, Math.min(120, Math.round(info.duree / 1.5)));
  const h = 96;
  const l = Math.max(2, Math.round((h * info.largeur) / info.hauteur / 2) * 2);
  try {
    await ffmpeg(['-y', '-i', fichier, '-map', '0:v:0', '-an', '-vf', `fps=${(n / info.duree).toFixed(6)},scale=${l}:${h},tile=${n}x1`, '-frames:v', '1', '-q:v', '5', sortie], {duree: info.duree});
    return {n, pas: info.duree / n, l, h};
  } catch {
    return null;
  }
}

/** Les textes que l'humain a relus dans « Partager » : l'IA les publie tels quels, sans les réécrire. */
function textesValides(textes, reseaux) {
  if (!textes || typeof textes !== 'object') return null;
  const blocs = reseaux.filter((r) => textes[r]?.legende).map((r) => {
    const t = textes[r];
    return [`${RESEAUX[r].nom} :`, t.titre ? `- titre : ${String(t.titre).slice(0, 120)}` : null, `- légende : ${String(t.legende).slice(0, 5000)}`,
      Array.isArray(t.hashtags) && t.hashtags.length ? `- hashtags : ${t.hashtags.slice(0, 30).join(' ')}` : null,
      t.premier_commentaire ? `- premier commentaire (à me redonner à la fin, je l’épinglerai moi-même) : ${String(t.premier_commentaire).slice(0, 600)}` : null].filter(Boolean).join('\n');
  });
  if (!blocs.length) return null;
  const manquants = reseaux.filter((r) => !textes[r]?.legende).map((r) => RESEAUX[r].nom);
  return `J’ai déjà relu et validé les textes : publie-les tels quels, sans les réécrire ni les raccourcir (suis la compétence derush-publier pour le reste).\n\n${blocs.join('\n\n')}${manquants.length ? `\n\nPour ${manquants.join(' et ')}, écris toi-même le titre, la légende et les hashtags.` : ''}`;
}

/** Ce que l'humain a demandé de publier depuis une vidéo : {video, reseaux[], visibilite} vérifié, et le message qui va avec. */
export function demandePublication(P, e, publier) {
  if (!publier || typeof publier !== 'object') return null;
  const reseaux = [...new Set((Array.isArray(publier.reseaux) ? publier.reseaux : []).filter((r) => RESEAUX[r]))];
  if (!reseaux.length) throw new Error('Choisis au moins un réseau où publier.');
  const nom = path.basename(String(publier.video ?? ''));
  // une vidéo livrée par l'IA, ou fabriquée par « Créer la vidéo » (elles sont toutes dans le dossier « vidéos »)
  const video = (e.versions ?? []).flatMap(videosDe).find((x) => x.nom === nom) ?? (/\.mp4$/i.test(nom) ? {nom, titre: P.d.titre} : null);
  if (!video || !fs.existsSync(path.join(P.racine, 'vidéos', nom))) throw new Error('Cette vidéo n’existe plus.');
  const visibilite = ['public', 'unlisted', 'private'].includes(publier.visibilite) ? publier.visibilite : 'unlisted';
  const liste = reseaux.map((r) => RESEAUX[r].nom);
  const quoi = liste.length > 1 ? `${liste.slice(0, -1).join(', ')} et ${liste.at(-1)}` : liste[0];
  const texte = `Publie la vidéo « ${video.titre ?? nom} » (le fichier a-publier/${nom}) sur ${quoi}.${reseaux.includes('youtube') ? ` Sur YouTube : ${visibilite === 'public' ? 'publique' : visibilite === 'private' ? 'privée' : 'non répertoriée'}.` : ''} ${textesValides(publier.textes, reseaux) ?? 'Écris pour chaque réseau le titre, la légende et les hashtags qui lui vont, en suivant la compétence derush-publier.'}${publier.consigne ? `\n\nCe que je veux en plus : ${String(publier.consigne).slice(0, 1000)}` : ''}`;
  return {nom, reseaux, visibilite, texte};
}

/**
 * Envoie un message à l'IA : elle répond, monte une ou plusieurs vidéos, ou publie.
 * message : ce que l'humain écrit · pieces : les pièces jointes à ce message · moteur ('claude' | 'codex' | 'gemini') · qualite
 * ('rapide' | 'soigne' | 'max') · modele, effort (réglages fins, facultatifs) · publier : {video, reseaux, visibilite} ·
 * nouveau : repartir du montage actuel de Dérush (nouveau dossier de travail). Rend la main tout de suite.
 */
export async function demander(P, {message, moteur = null, qualite = null, modele = null, effort = null, nouveau = false, file = null, pieces = [], publier = null} = {}, surFin = null) {
  const ids = (Array.isArray(pieces) ? pieces : []).map(String).filter((x) => /^J\d+$/.test(x));
  if (EN_COURS.has(P.racine)) throw new Error('L’IA travaille déjà sur ce projet.');
  const e = lireEtat(P);
  e.echanges ??= [];
  e.versions ??= [];
  const pub = demandePublication(P, e, publier);
  // YouTube seul, sans la clé Treg : l'IA ne pourrait que le constater (voir lib/youtube.mjs). On le dit tout de suite.
  if (pub && pub.reseaux.every((r) => r === 'youtube') && !jetonTreg()) throw new Error('YouTube a besoin de ta clé Treg : le connecteur Treg de ton compte Claude ne lui suffit pas. Ouvre Connexions › Treg › « Relier mes réseaux », colle ta clé, puis publie de nouveau.');
  // un long brief collé tel quel passe en entier ; au-delà de la limite, on le dit au lieu de couper sans prévenir
  let texte = String(message ?? '').trim();
  if (texte.length > LONGUEUR_MESSAGE) throw new Error(`Ton message est trop long (${texte.length.toLocaleString('fr-FR')} caractères, ${LONGUEUR_MESSAGE.toLocaleString('fr-FR')} au plus). Mets ce texte dans un fichier et joins-le avec le trombone : ton IA le lira en entier.`);
  if (pub) texte = texte ? `${pub.texte}\n\n${texte}` : pub.texte;
  if (!texte && !ids.length) throw new Error('Écris d’abord ce que tu veux que l’IA fasse.');
  if (!texte) texte = 'Voici de la matière pour la suite : regarde-la et dis-moi ce que tu en tires.';
  // le mode « motion design » part d'une simple description : rien à importer
  const mode = MODES[P.d.mode] ? P.d.mode : 'montage';
  if (!P.d.medias.length && !ids.length && !pub && MODES[mode].matiere) throw new Error('Importe d’abord au moins une vidéo, un son ou une photo, ou joins un fichier à ton message.');
  // l'assistant : celui demandé, sinon celui choisi dans Dérush, sinon le premier prêt
  const etats = await etatIA();
  if (!IA[moteur]) moteur = etats.choisi;
  const ia = etats[moteur];
  if (!ia?.ok) throw new Error(`${ia?.pourquoi ?? `${IA[moteur].nom} n’est pas prêt.`} Ouvre Connexions pour le brancher.`);
  // Gemini n'a pas les outils Treg : seul YouTube passe (par la commande de Dérush). On le dit avant de le lancer.
  if (pub && moteur === 'gemini' && pub.reseaux.some((r) => r !== 'youtube')) throw new Error('Avec Gemini, Dérush ne sait publier que sur YouTube. Pour TikTok, Instagram et LinkedIn, choisis Claude ou Codex (« Qui monte ? »), puis publie de nouveau.');
  // le modèle de Claude : celui de la demande, sinon celui choisi dans Connexions, sinon celui du niveau
  const reglage = reglageIA(moteur, qualite ?? lireReglages().ia_qualite ?? 'max', modele ?? (moteur === 'claude' ? lireReglages().ia_modele ?? null : null), effort, ia.modeles ?? []);
  const nomIA = IA[moteur].nom;
  // le dossier de travail est gardé (même si l'on change d'assistant) ; la conversation, elle, est propre à chacun
  const garderAtelier = !nouveau && !!e.atelier && fs.existsSync(path.join(P.racine, e.atelier, 'montage.json'));
  const sessionAvant = garderAtelier ? (e.sessions[moteur] ?? null) : null;
  // le message de l'humain s'affiche tout de suite dans la conversation, avec ses pièces jointes
  const n = e.echanges.length;
  const jointes = attacherPieces(P, ids, n);
  e.echanges.push({role: 'humain', texte, quand: new Date().toISOString(), pieces: jointes, ...(pub ? {publier: {reseaux: pub.reseaux, video: pub.nom}} : {})});
  ecrireEtat(P, e);
  const c = {proc: null, etape: garderAtelier ? 'claude' : 'preparation', debut: Date.now(), debutIA: null, activite: [], nActivite: 0, vues: [], atelier: garderAtelier ? path.join(P.racine, e.atelier) : null,
    progression: 0, annule: false, message: texte, moteur, qualite: reglage.qualite, modele: reglage.modele, effort: reglage.effort, reprise: garderAtelier, publier: pub};
  EN_COURS.set(P.racine, c);
  occupe(true); // l'IA peut dépenser des crédits ElevenLabs : les coûts mesurés pendant ce temps ne seraient pas justes
  const noter = (icone, t) => { c.nActivite++; c.activite.push({t: Math.round((Date.now() - c.debut) / 1000), icone, texte: t}); if (c.activite.length > 300) c.activite.splice(0, 100); };
  // ce qui s'est dit avant, quand l'assistant ne peut pas reprendre sa propre conversation (nouveau dossier, ou autre assistant)
  const avant = sessionAvant ? [] : e.echanges.slice(0, n).filter((x) => x.texte && !x.erreur && !x.arret).slice(-10)
    .map((x) => (x.role === 'humain' ? `- Moi : ${String(x.texte).slice(0, 600)}` : `- ${IA[x.moteur ?? 'claude']?.nom ?? 'L’IA'} : ${String(x.texte).slice(0, 400)}`));

  const travail = (async () => {
    let atelier = c.atelier;
    let session = sessionAvant;
    if (!garderAtelier) {
      // 1. le dossier de montage : le pack complet, avec son kit prêt à rendre
      // les médias qu'on vient de déposer finissent d'abord de se préparer (texte, images, son) : l'IA en a besoin
      if (file && (file.enCours || file.attente.length)) { noter('outil', 'Attend la fin de la préparation de tes médias'); await file.vide(); }
      if (c.annule) throw new Error('Arrêté.');
      // le texte mot à mot des rushes qui parlent : sans lui, l'IA ne peut ni choisir les bonnes phrases ni sous-titrer
      const utilises = P.d.montage.length ? new Set([...P.d.montage, ...(P.d.superpositions ?? [])].map((it) => it.media).filter(Boolean)) : new Set(P.d.medias.map((m) => m.id));
      const sansTexte = P.d.medias.filter((m) => utilises.has(m.id) && m.audio && !m.transcription);
      if (sansTexte.length && (await moteurs()).whisper?.ok) {
        for (const [k, m] of sansTexte.entries()) {
          if (c.annule) throw new Error('Arrêté.');
          noter('texte', `Écrit le texte de « ${m.nom} »`);
          try { await transcrire(P, m, 'whisper', (p) => { c.progression = ((k + p) / sansTexte.length) * 0.3; }); } catch { /* pas de texte pour ce rush : l'IA fera sans */ }
        }
      }
      if (!etatRendu().ok) { noter('outil', 'Installe le moteur de rendu (une seule fois)'); await installerRendu((p) => { c.progression = p * 0.3; }); }
      noter('film', P.d.medias.length ? (P.d.montage.length ? `Prépare ton montage pour ${nomIA}` : `Prépare tes rushes pour ${nomIA} (sans découpe)`) : `Prépare le dossier de travail de ${nomIA}`);
      const pack = await exporterPack(P, (p) => { c.progression = 0.3 + p * 0.7; });
      if (c.annule) { fs.rmSync(pack.dossier, {recursive: true, force: true}); throw new Error('Arrêté.'); }
      atelier = pack.dossier;
      c.atelier = atelier;
      const lien = path.join(atelier, 'remotion', 'node_modules');
      if (!fs.existsSync(lien) && !lier(path.join(dossierMoteurRendu(), 'node_modules'), lien)) throw new Error('Impossible de relier le moteur de rendu au dossier de travail.');
      e.atelier = path.relative(P.racine, atelier);
      e.empreinte = empreinte(P);
      e.sessions = {};
      session = null;
      ecrireEtat(P, e);
    }
    if (c.annule) throw new Error('Arrêté.');
    // 2. les pièces jointes : prêtes (aperçus, planches, texte, zip ouverts), puis installées dans contexte/
    if (listerPieces(P).some((x) => x.en_preparation)) { noter('trombone', `Prépare tes pièces jointes pour ${nomIA}`); await attendrePieces(P); }
    const {lignes, cibles: piecesLiees} = installerContexte(P, atelier, {echanges: e.echanges, creations: listerCreations(P).filter((x) => x.etat === 'pret'), message: n});
    // le profil du créateur (ce que l'IA a appris de ses comptes), s'il existe et s'il veut bien le donner
    const profilDonne = installerProfil(atelier);
    // le Drive synchronisé, lié dans le dossier (rien n'est copié) ; le connecteur est passé à Claude plus bas
    installerDrive(atelier);
    // les vrais sons (bibliothèque reliée dans sons/, commandes, index de Real SFX) : avant les compétences, car le
    // guide d'Earshot peut arriver à ce moment-là
    const sons = await installerSons(atelier, noter);
    // la bibliothèque de compétences, reliée pour les deux assistants
    installerCompetences(atelier);
    // la vidéo à publier, reliée dans a-publier/
    if (pub) {
      const A = path.join(atelier, 'a-publier');
      fs.mkdirSync(A, {recursive: true});
      if (!lier(path.join(P.racine, 'vidéos', pub.nom), path.join(A, pub.nom))) fs.copyFileSync(path.join(P.racine, 'vidéos', pub.nom), path.join(A, pub.nom));
    }
    // le rendu en direct du travail précédent n'a plus lieu d'être ; les publications non plus
    fs.rmSync(path.join(atelier, 'rendu', '.direct'), {recursive: true, force: true});
    // les outils du kit sont ceux de cette version de Dérush : le rendu en direct, et le relais de rendu (Codex, Gemini)
    try {
      const kit = path.join(RACINE_APP, 'modeles', 'kit-remotion');
      fs.copyFileSync(path.join(kit, 'rendre.mjs'), path.join(atelier, 'remotion', 'rendre.mjs'));
      if (!fs.existsSync(path.join(atelier, 'remotion', 'recouper.mjs'))) fs.copyFileSync(path.join(kit, 'recouper.mjs'), path.join(atelier, 'remotion', 'recouper.mjs'));
    } catch { /* le kit d'origine reste utilisable */ }
    c.etape = 'claude';
    c.progression = 1;
    // 3. l'IA, dans ce dossier
    const pj = lignes.length ? `\n\nPièces jointes à ce message (détails dans contexte/INDEX.md) :\n${lignes.join('\n')}` : '';
    // Blender, s'il est là : son dossier passe en tête du PATH (la commande « blender » mène alors au vrai programme)
    const blender = await etatBlender();
    // une conversation reprise ne relit pas ses consignes de départ : on lui redit où en sont les connexions
    const rappel = `(Connexions en ce moment : ElevenLabs ${chargerCle() ? 'branché' : 'pas branché'} ; Treg ${rappelTreg(moteur)} ; Google Drive ${etatDrive().actif ? 'donné' : 'pas donné'} ; Blender ${blender.ok ? 'installé' : 'absent'} ; vrais sons ${rappelSons()}. ; mon profil de créateur ${profilDonne ? 'est dans contexte/createur/ (lis-le)' : 'n’est pas donné'}. Si tu me réponds en français, tutoie-moi, comme Dérush.)${MODES[mode].consigne ? `\n(${MODES[mode].consigne})` : ''}`;
    const reprise = !!session; // une conversation déjà commencée avec cette IA
    const demandeSeule = session
      ? `${texte}${pj}\n\n(Si je te demande une vidéo ou une modification : refais-la, livre-la comme d'habitude, remets rendu/timeline.json à jour, vérifie-la, puis dis-moi en quelques phrases ce que tu as changé, sans chemin ni nom de fichier. Si c'est une question, réponds simplement.)\n${rappel}`
      : `Voici un pack de montage Dérush${garderAtelier ? ' (un autre assistant y a déjà travaillé : ses compositions et ses rendus sont dans remotion/ et rendu/, pars de là)' : ''}. Lis CLAUDE.md, puis LISEZMOI-IA.md et montage.json, regarde le storyboard, et lis contexte/INDEX.md (ce que je t'ai donné).\n\nCe que je veux :\n« ${texte} »${pj}${avant.length ? `\n\nNotre conversation jusqu'ici (ce que j'ai demandé reste valable sauf si ma nouvelle demande dit le contraire) :\n${avant.join('\n')}` : ''}\n\nSi je te demande une ou plusieurs vidéos : monte-les, livre-les (rendu/final.mp4, ou rendu/livraison/ s'il y en a plusieurs), vérifie-les, puis dis-moi en quelques phrases ce que tu as fait, sans chemin ni nom de fichier (je regarde les vidéos dans Dérush). Si c'est une question, réponds simplement.`;
    const demande = demandeSeule + rappelMaj();
    const env = {...envIA([DOSSIER_COMMANDES, ...(fs.existsSync(PYTHON) ? [path.dirname(PYTHON)] : []), ...(blender.ok ? [path.dirname(blender.chemin)] : [])]), ...envSons()};
    // YouTube : ce que l'humain a demandé dans CE message (la fenêtre « Partager », ou ses propres mots), pour la
    // commande derush-youtube et pour le relais de Codex : rien ne part sans cela, et jamais en public s'il a choisi autre chose
    const youtube = {permis: !!pub?.reseaux?.includes('youtube') || /youtube|shorts/i.test(String(message ?? '')), visibilite: pub?.reseaux?.includes('youtube') ? pub.visibilite : null};
    env.DERUSH_YOUTUBE_PERMIS = youtube.permis ? '1' : '0';
    if (youtube.visibilite) env.DERUSH_YOUTUBE_VISIBILITE = youtube.visibilite; else delete env.DERUSH_YOUTUBE_VISIBILITE;
    // les guides du dossier sont remis à jour à chaque demande : Blender ou ElevenLabs ont pu être branchés entre-temps
    try {
      fs.writeFileSync(path.join(atelier, 'OUTILS.md'), boiteAOutils({blender, elevenlabs: chargerCle(), sons: partieSons()}));
      fs.writeFileSync(path.join(atelier, 'MOTION.md'), guideMotion());
    } catch { /* dossier en lecture seule : l'IA garde les guides d'origine */ }
    const consignes = `${CONSIGNES(moteur)}\n${blender.ok
      ? `- Blender ${blender.version} est installé ici : ${blender.chemin}. Pour de la 3D réaliste, lance-le sans interface : "${blender.chemin}" -b --factory-startup --python scene.py. La marche à suivre et les pièges sont dans OUTILS.md, partie « La 3D avec Blender ».`
      : '- Blender n’est pas installé sur cet ordinateur : pour la 3D, utilise three.js avec @remotion/three, déjà dans le kit.'}\n${consigneElevenLabs(sons.actif)}\n${consigneDrive(moteur)}\n${consigneTreg(moteur)}\n${consigneCompetences(moteur)}${sons.actif ? `\n${consigneSons()}` : ''}${profilDonne ? `\n${consigneCreateur()}` : ''}`;
    fs.mkdirSync(path.join(atelier, '.derush'), {recursive: true});
    const fichierConsignes = path.join(atelier, '.derush', 'consignes.md');
    fs.writeFileSync(fichierConsignes, consignes);
    if (moteur !== 'claude') {
      // Codex et Gemini lisent AGENTS.md : les consignes de Dérush, puis le guide du dossier
      let guide = '';
      try { guide = fs.readFileSync(path.join(atelier, 'CLAUDE.md'), 'utf8'); } catch { /* pas de guide */ }
      fs.writeFileSync(path.join(atelier, 'AGENTS.md'), `# Consignes de Dérush\n\n${consignes}\n\n${guide ? `# Le guide du dossier (CLAUDE.md, valable pour toi aussi)\n\n${guide}` : ''}`);
    }
    const debutIA = Date.now();
    c.debutIA = debutIA;
    const textes = []; // tout ce que l'IA écrit, pour retrouver son compte rendu
    const noterSession = (s) => { if (s && s !== e.sessions[moteur]) { session = s; e.sessions[moteur] = s; e.moteur = moteur; ecrireEtat(P, e); } };
    const brancher = (proc, ok, ko, lire, finir, entree = demande) => {
      c.proc = proc;
      garderEveille(proc.pid); // un montage peut durer une heure : l'ordinateur ne doit pas s'endormir en route
      let tampon = '';
      let err = '';
      proc.stdout.on('data', (d) => {
        tampon += d.toString();
        let i;
        while ((i = tampon.indexOf('\n')) >= 0) {
          const ligne = tampon.slice(0, i);
          tampon = tampon.slice(i + 1);
          let j;
          try { j = JSON.parse(ligne); } catch { continue; }
          lire(j);
        }
      });
      proc.stderr.on('data', (d) => { err = (err + d.toString()).slice(-4000); });
      proc.on('error', (x) => ko(new Error(`${nomIA} n’a pas pu se lancer : ${x.message}`)));
      proc.on('close', (code) => {
        if (c.annule) return ko(new Error('Arrêté.'));
        finir(code, err);
      });
      proc.stdin.on('error', () => { /* l'IA s'est arrêtée avant de lire */ });
      proc.stdin.end(entree);
    };

    let fin = null;
    if (moteur === 'claude') {
      // Claude ne doit voir que les connecteurs donnés (Drive, Treg) : s'il démarre avec un autre, on l'arrête tout de
      // suite (avant qu'il ait rien fait), on ajoute ce connecteur aux refusés, et on le relance
      const lancerClaude = () => new Promise((ok, ko) => {
        const dejaRefuses = new Set(refuses());
        const args = ['-p', '--model', reglage.modele, '--effort', reglage.effort, '--output-format', 'stream-json', '--verbose',
          '--permission-mode', 'auto', '--permission-prompts', 'none', ...argsConnecteursClaude(atelier),
          '--append-system-prompt-file', fichierConsignes, ...(session ? ['--resume', session] : []),
          '--tools', 'Bash', 'Edit', 'Read', 'Write', 'Skill', 'WebSearch', 'WebFetch'];
        const {cmd, prefixe, shell} = commandeLancement(ia.chemin);
        const proc = spawn(cmd, [...prefixe, ...args], {cwd: atelier, env, stdio: ['pipe', 'pipe', 'pipe'], detached: !WINDOWS, windowsHide: true, shell: !!shell});
        let relancer = false;
        let resultat = null;
        brancher(proc, ok, ko, (j) => {
          if (relancer) return;
          if (j.type === 'system' && j.subtype === 'init') {
            // un connecteur déjà refusé dont les outils sont de toute façon interdits ne relance pas Claude
            const autres = intrus(j.mcp_servers).filter((x) => !dejaRefuses.has(x));
            if (autres.length) { relancer = true; refuser(autres); arreterArbre(proc); return; }
            // la conversation est notée tout de suite : même arrêtée en route, elle pourra être reprise
            noterSession(j.session_id);
            const statut = (s) => (['connected', 'pending'].includes(s.status) ? 'connecte' : /auth/i.test(s.status) ? 'a_autoriser' : 'echec');
            const drive = (j.mcp_servers ?? []).find((s) => s.name === NOM_CONNECTEUR);
            if (drive) {
              noterConnecteur(statut(drive));
              noter(statut(drive) === 'connecte' ? 'nuage' : 'attention', statut(drive) === 'connecte' ? 'Ton Google Drive est branché' : 'Google Drive pas disponible cette fois (connecteur à autoriser dans l’app Claude)');
            }
            const treg = (j.mcp_servers ?? []).find((s) => NOMS_TREG.includes(s.name));
            if (treg) noterConnecteurTreg(statut(treg));
          }
          if (j.type === 'assistant') {
            for (const b of j.message?.content ?? []) {
              if (b.type === 'tool_use') {
                const x = decrire(b.name, b.input ?? {}, atelier);
                noter(x.icone, x.texte);
                // une image que Claude regarde (un rendu, une planche, une référence) : elle passe en direct dans Dérush
                const f = b.name === 'Read' ? String(b.input?.file_path ?? '') : '';
                if (/\.(png|jpe?g|webp|gif)$/i.test(f)) c.vues.push({n: c.vues.length, chemin: path.resolve(atelier, f), nom: path.basename(f), t: Math.round((Date.now() - c.debut) / 1000)});
              }
              if (b.type === 'text' && b.text?.trim()) { noter('bulle', b.text.trim().slice(0, 600)); textes.push(b.text.trim()); }
            }
          }
          if (j.type === 'result') resultat = j;
        }, (code, err) => {
          if (relancer) return ok(null);
          if (!resultat) return ko(new Error(`Claude Code s’est arrêté sans répondre${err.trim() ? ` : ${err.trim().split('\n').slice(-3).join(' ')}` : ` (code ${code})`}.`));
          ok(resultat);
        });
      });
      for (let essai = 1; !fin; essai++) {
        fin = await lancerClaude();
        if (!fin && essai >= 4) throw new Error('Claude n’a pas pu démarrer avec tes seules connexions Dérush. Coupe le Drive ou Treg dans Connexions, puis réessaie.');
      }
    } else if (moteur === 'codex') {
      // Codex : toujours dans son bac à sable (écriture dans le dossier de travail, le dossier temporaire et le dossier
      // Dérush du Drive ; réseau ouvert pour ElevenLabs et Treg). Le rendu Remotion passe par le relais de Dérush.
      const ecrits = [os.tmpdir(), ...ecritsSons()];
      c.relais = await ouvrirRelais(atelier, {surRendu: (compo) => noter('film', `Dérush rend « ${compo} » pour Codex`),
        youtube: {...youtube, videos: path.join(P.racine, 'vidéos'), surEnvoi: () => noter('globe', 'Dérush envoie la vidéo sur YouTube')}});
      env.DERUSH_RELAIS = c.relais.url;
      env.DERUSH_RELAIS_JETON = c.relais.jeton;
      const d = etatDrive().actif ? dossiersDrive() : null;
      if (d) { const dd = path.join(d.monDrive, 'Dérush'); try { fs.mkdirSync(dd, {recursive: true}); ecrits.push(dd); } catch { /* Drive en lecture seule */ } }
      fin = await new Promise((ok, ko) => {
        const args = argsCodex({session, reglage, ecrits, mcp: argsCodexTreg()});
        const {cmd, prefixe, shell} = commandeLancement(ia.chemin);
        const proc = spawn(cmd, [...prefixe, ...args], {cwd: atelier, env, stdio: ['pipe', 'pipe', 'pipe'], detached: !WINDOWS, windowsHide: true, shell: !!shell});
        let termine = false;
        let erreur = null;
        let alerte = null;
        brancher(proc, ok, ko, (j) => {
          const x = lireEvenementCodex(j);
          if (x.session) noterSession(x.session);
          if (x.geste) { const g = decrire(x.geste.outil, x.geste.entree, atelier); noter(g.icone, g.texte); }
          if (x.texte) { noter('bulle', x.texte.slice(0, 600)); textes.push(x.texte); }
          if (x.alerte) { alerte = x.alerte; if (!/reconnect|retry|stream/i.test(x.alerte)) noter('attention', x.alerte.slice(0, 200)); }
          if (x.erreur) erreur = x.erreur;
          if (x.fin) termine = true;
        }, (code, err) => {
          if (!termine) return ko(new Error(`Codex s’est arrêté avant la fin : ${erreur ?? alerte ?? (err.trim() ? err.trim().split('\n').slice(-3).join(' ') : `code ${code}`)}`));
          ok({result: textes.at(-1) ?? '', is_error: !!erreur});
        });
      }).finally(() => { c.relais?.fermer(); c.relais = null; });
    } else {
      // Gemini (la commande agy) : toujours dans le bac à sable de son terminal, avec des permissions données pour cette
      // seule demande (lib/gemini.mjs) : écrire dans le dossier de travail (et la bibliothèque de sons), lire les outils
      // de Dérush et ce que l'humain a donné, rien d'autre de l'ordinateur. Ce bac à sable coupe le réseau local : le
      // rendu et l'envoi sur YouTube passent par la boîte du relais (des fichiers du dossier de travail). La clé Treg
      // ne lui est pas donnée : c'est Dérush qui la garde.
      c.relais = await ouvrirRelais(atelier, {boite: true, surRendu: (compo) => noter('film', `Dérush rend « ${compo} » pour Gemini`),
        youtube: {...youtube, videos: path.join(P.racine, 'vidéos'), surEnvoi: () => noter('globe', 'Dérush envoie la vidéo sur YouTube')}});
      if (c.relais.boite) env.DERUSH_RELAIS_BOITE = c.relais.boite; else env.DERUSH_RELAIS = c.relais.url;
      env.DERUSH_RELAIS_JETON = c.relais.jeton;
      delete env.TREG_TOKEN;
      Object.assign(env, envGemini(env));
      const ecrits = [atelier, os.tmpdir(), ...ecritsSons()];
      const lus = [...outilsLisibles([...(blender.ok ? [blender.chemin] : []), ...lusSons()]), ...piecesLiees, ...(pub ? [path.join(P.racine, 'vidéos', pub.nom)] : [])];
      const d = etatDrive().actif ? dossiersDrive() : null;
      if (d) {
        // le Drive que l'humain a donné : à lire en entier, à écrire seulement dans son dossier « Dérush »
        lus.push(d.monDrive, ...(d.partages ? [d.partages] : []));
        const dd = path.join(d.monDrive, 'Dérush');
        try { fs.mkdirSync(dd, {recursive: true}); ecrits.push(dd); } catch { /* Drive en lecture seule */ }
      }
      const reglages = reglagesGemini({ecrits, lus});
      fin = await new Promise((ok, ko) => {
        const args = argsGemini({demande, session, modele: reglage.modele, reglages});
        const {cmd, prefixe, shell} = commandeLancement(ia.chemin);
        const proc = spawn(cmd, [...prefixe, ...args], {cwd: atelier, env, stdio: ['pipe', 'pipe', 'pipe'], detached: !WINDOWS, windowsHide: true, shell: !!shell});
        const lire = lecteurGemini();
        let resultat = null;
        brancher(proc, ok, ko, (j) => {
          const x = lire(j);
          if (x.session) noterSession(x.session);
          if (x.geste) {
            const g = decrire(x.geste.outil, x.geste.entree, atelier);
            noter(g.icone, g.texte);
            const f = x.geste.outil === 'Read' ? String(x.geste.entree?.file_path ?? '') : '';
            if (/\.(png|jpe?g|webp|gif)$/i.test(f)) c.vues.push({n: c.vues.length, chemin: path.resolve(atelier, f), nom: path.basename(f), t: Math.round((Date.now() - c.debut) / 1000)});
          }
          if (x.refus) noter('attention', `Gemini n’a pas eu le droit de ${refusGemini(x.refus)}`);
          if (x.texte) { noter('bulle', x.texte.slice(0, 600)); textes.push(x.texte); }
          if (x.fin) resultat = x.fin;
        }, (code, err) => {
          if (!resultat) return ko(new Error(/authentication required/i.test(err) ? 'Gemini n’est plus connecté à ton compte Google. Ouvre Connexions, puis « Me connecter ».' : `Gemini s’est arrêté avant la fin : ${err.trim() ? err.trim().split('\n').slice(-3).join(' ').slice(0, 400) : `code ${code}`}`));
          // rien n'a été dit et une action a été refusée : agy s'arrête là, sans réponse
          if (!resultat.reponse && !textes.length && resultat.refus?.length) return ko(new Error(`Gemini s’est arrêté : il n’a pas eu le droit de ${resultat.refus.map(refusGemini).join(', ')}.`));
          ok({result: resultat.reponse || textes.at(-1) || '', is_error: !!resultat.erreur});
        }, '');
      }).finally(() => { c.relais?.fermer(); c.relais = null; });
    }
    // 4. les vidéos livrées (une, ou plusieurs dans rendu/livraison/), et ce qui a été publié
    c.etape = 'livraison';
    const livrees = livraisons(atelier, debutIA);
    // la table de montage de l'IA, rangée avec la version (le n° de la vidéo remplace le nom de son fichier). Dans une
    // conversation reprise, une IA qui n'a pas touché à ses blocs ne réécrit pas toujours sa table : celle qu'elle
    // avait écrite vaut encore pour la nouvelle vidéo (sinon les blocs disparaîtraient de la timeline après un réglage).
    const table = tableIA(atelier, debutIA) ?? (reprise && livrees.length ? tableIA(atelier, 0) : null);
    if (table) for (const b of table.blocs) { const k = b.video ? livrees.findIndex((l) => path.basename(l.fichier) === b.video) : -1; b.video = k >= 0 ? k : null; }
    const publiees = publications(atelier, debutIA);
    const credits = creditsSons(atelier, debutIA);
    const quand = new Date().toISOString();
    e.sessions[moteur] = session;
    e.moteur = moteur;
    e.modele = reglage.modele;
    e.effort = reglage.effort;
    e.decoupe_reprise = false; // l'IA a peut-être recoupé : sa découpe peut de nouveau être reprise
    // Claude Code reprend parfois la parole après son compte rendu (une tâche de fond qui se termine) : sa dernière
    // phrase est alors un détail, et le vrai compte rendu est juste avant. On garde les deux.
    const dernier = String(fin.result ?? '').trim();
    const compteRendu = dernier.length < 400 ? textes.slice(-4).reverse().find((x) => x.length >= 400 && x !== dernier) : null;
    const reponse = {role: 'claude', moteur, texte: (compteRendu ? `${compteRendu}\n\n${dernier}` : dernier) || `(${nomIA} n’a rien écrit.)`, quand, qualite: reglage.qualite, modele: reglage.modele, effort: reglage.effort,
      duree_s: Math.round((Date.now() - c.debut) / 1000), erreur: fin.is_error === true, refus: fin.permission_denials?.length ?? 0, ...(publiees.length ? {publications: publiees} : {}), ...(credits ? {credits_sons: credits} : {})};
    if (livrees.length) {
      const nv = (e.versions.at(-1)?.n ?? 0) + 1;
      const dossier = path.join(P.racine, 'vidéos');
      fs.mkdirSync(dossier, {recursive: true});
      const videos = [];
      for (const [k, l] of livrees.entries()) {
        noter('oeil', livrees.length > 1 ? `Dérush contrôle la vidéo ${k + 1} sur ${livrees.length}` : 'Dérush contrôle la vidéo');
        const suffixe = livrees.length > 1 ? `-${k + 1}${l.titre ? `-${slug(l.titre, 24)}` : ''}` : '';
        const nom = `${slug(P.d.titre) || 'montage'}-${moteur}-v${nv}${suffixe}.mp4`;
        const video = path.join(dossier, nom);
        fs.copyFileSync(l.fichier, video);
        let controles = [];
        let info = null;
        try { ({controles, info} = await controlerVideo(P, video, null)); } catch { /* la vidéo reste livrée, sans contrôles */ }
        // un autre format que celui du projet : c'est voulu (plusieurs formats, ou un format demandé)
        if (info && (info.largeur !== P.d.sortie.largeur || info.hauteur !== P.d.sortie.hauteur) && controles[0]) controles[0] = {ok: true, info: true, t: `Format : ${info.largeur} × ${info.hauteur}, ${info.fps} images/s`, d: 'Un autre format que celui du projet.'};
        const vignettes = await vignettesVideo(video, info, path.join(dossier, `${nom.replace(/\.mp4$/, '')}.vignettes.jpg`));
        videos.push({nom, titre: l.titre ?? (livrees.length > 1 ? `Vidéo ${k + 1}` : null), description: l.description, taille_lisible: tailleLisible(fs.statSync(video).size), duree: info?.duree ?? null, largeur: info?.largeur ?? null, hauteur: info?.hauteur ?? null, controles, vignettes});
      }
      // les autres fichiers remis avec la vidéo : rangés à côté d'elle
      const nAnnexes = rangerAnnexes(atelier, debutIA, path.join(dossier, dossierAnnexes(videos[0].nom) ?? `${slug(P.d.titre) || 'montage'}-${moteur}-v${nv}-annexes`));
      if (nAnnexes) noter('trombone', `Dérush range ${nAnnexes} fichier${nAnnexes > 1 ? 's' : ''} joint${nAnnexes > 1 ? 's' : ''} à la vidéo`);
      e.versions.push({n: nv, cree_le: quand, moteur, qualite: reglage.qualite, modele: reglage.modele, effort: reglage.effort, ...videos[0], titre: undefined, videos, ...(table ? {table} : {})});
      reponse.version = nv;
    }
    // les publications sont aussi rangées avec la vidéo publiée, pour les retrouver sous sa carte
    if (publiees.length && pub) {
      for (const v of e.versions) for (const x of videosDe(v)) if (x.nom === pub.nom) x.publications = [...(x.publications ?? []), ...publiees.map((p) => ({...p, quand}))].slice(-20);
      for (const v of e.versions) if (v.nom === pub.nom) v.publications = videosDe(v)[0]?.publications;
    }
    e.echanges.push(reponse);
    ecrireEtat(P, e);
    return reponse;
  })();

  travail.then((r) => { DERNIERES_VUES.set(P.racine, c); EN_COURS.delete(P.racine); occupe(false); surFin?.(null, r); }, (err) => {
    DERNIERES_VUES.set(P.racine, c);
    EN_COURS.delete(P.racine);
    occupe(false);
    // l'échec (ou l'arrêt) reste visible dans la conversation
    const x = lireEtat(P);
    x.echanges ??= [];
    x.echanges.push(c.annule
      ? {role: 'claude', moteur, texte: 'Arrêté avant la fin. Écris un message pour reprendre, ou pour changer de direction.', quand: new Date().toISOString(), arret: true, qualite: reglage.qualite}
      : {role: 'claude', moteur, texte: err.message, quand: new Date().toISOString(), erreur: true, qualite: reglage.qualite});
    ecrireEtat(P, x);
    surFin?.(err, null);
  });
  return {ok: true, reprise: garderAtelier, moteur};
}

/** Arrête le travail en cours (l'IA et tout ce qu'elle a lancé). */
export function arreterDemande(P) {
  const c = EN_COURS.get(P.racine);
  if (!c) return false;
  c.annule = true;
  arreterArbre(c.proc);
  c.relais?.fermer();
  // encore en préparation : la suite s'arrêtera d'elle-même à la fin de l'étape en cours
  return true;
}

/** Dérush se quitte : toutes les IA au travail s'arrêtent, avec ce qu'elles ont lancé. */
export function arreterToutesLesDemandes() {
  for (const c of EN_COURS.values()) {
    c.annule = true;
    try { arreterArbre(c.proc); } catch { /* déjà finie */ }
    try { c.relais?.fermer(); } catch { /* pas de relais */ }
  }
}

/** Efface la conversation (le prochain message repartira du montage actuel). Les vidéos et les pièces jointes restent. */
export function oublierDemande(P) {
  if (EN_COURS.has(P.racine)) throw new Error('L’IA travaille encore.');
  const e = lireEtat(P);
  ecrireEtat(P, {...e, atelier: null, session: null, sessions: {}, echanges: []});
}
export {moteurChoisi};
