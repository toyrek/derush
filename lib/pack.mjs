// Dérush — export du « pack IA » : tout ce qu'une IA de montage doit lire pour finir la vidéo, sans rien deviner.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  VERSION, FORMATS, GENRES_BLOC, GENRES_INDICATION, MODES, sequence, temps, arrondi, slug, couperLignes,
  motsEntre, texteDesMots, dureeLisible, fpsSource, versImage, surGrille, debordements, fenetreCadrage, pointCadrage,
} from './commun.mjs';
import {ffmpeg, lancer, FFMPEG, FFPROBE, POLICE, POLICE_GRAS, ecrireJson, lireJson, tailleLisible, tailleDossier} from './outils.mjs';
import {lireMots} from './transcription.mjs';
import {couleurPropre, couleurVersRemotion} from './commun.mjs';
import {filtreSdr, fichierSon, fichierLecture, fichierPourIA, poserFichier} from './medias.mjs';
import {CATALOGUE, PLATEFORMES, reglagesDe, resumeEffet, styleComplet} from '../public/moteur.js';
import {decoupesFichier} from './detourage.mjs';
import {recette, recetteEnTexte, boiteAOutils, guideMotion} from './recettes.mjs';
import {etatBlender} from './moteurs.mjs';
import {chargerCle, bruitageElevenLabs} from './elevenlabs.mjs';
import {lier} from './plateforme.mjs';
import * as plateforme from './plateforme.mjs';
import {espaceDuProjet} from './espaces.mjs';
import {cheminFiltre} from './couleurs.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(ICI, '..', 'modeles', 'kit-remotion');
const PUBLIC = path.join(ICI, '..', 'public');
const p2 = (n) => String(n).padStart(2, '0');
const cellule = (t) => String(t ?? '').replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ').trim() || '—';
/**
 * Un id du projet (P12, B3, S4…) dans un nom de fichier ou de dossier du pack. Dérush ne donne que des lettres et des
 * chiffres, mais un projet reçu ou abîmé peut porter n'importe quel id (« ../../x ») : rien ne doit sortir du pack.
 */
const nomSur = (id) => String(id ?? '').replace(/[^\w-]/g, '_').slice(0, 40) || '_';

/** Cadence au format attendu par FFmpeg (les cadences NTSC restent exactes). */
function fpsFfmpeg(f) {
  for (const [v, txt] of [[24000 / 1001, '24000/1001'], [30000 / 1001, '30000/1001'], [60000 / 1001, '60000/1001'], [120000 / 1001, '120000/1001']]) if (Math.abs(f - v) < 0.01) return txt;
  return String(arrondi(f, 4));
}

/** Le nom d'un rush dans le pack (plans/, transcriptions/, analyse/). */
const nomDuRush = (m) => `${m.id}-${slug(path.parse(m.nom).name, 30) || 'rush'}`;
/** Les autres versions du son d'un rush, comme on les nomme à l'humain et à l'IA. */
const NOMS_VERSIONS = {voix: 'voix seule', fond: 'sans la voix', clair: 'voix claire'};
/**
 * Un son seul que le kit et le navigateur lisent tel quel : il est posé entier dans plans/, comme une vidéo (un clone),
 * au lieu d'être réécrit en WAV à chaque pack (un podcast de 30 min en AAC : 29 Mo devenaient 692 Mo avec sa voix isolée).
 */
const sonLisible = (m) => m.type === 'audio' && /\.(m4a|mp3|wav|flac)$/i.test(m.chemin) && /^(aac|mp3|flac|pcm_(s16|s24|f32)le)$/.test(m.audio?.codec ?? m.codec ?? '');

/**
 * La durée visée écrite dans le brief, en secondes : « 1:30 », « 1 min 30 », « 2 minutes », « 45 s », « 1 h », « une
 * minute ». null si rien ne se lit. (Avant, « 1:30 » donnait 3 s et « 1 min 30 » 60 s.)
 */
export function dureeVisee(texte) {
  const t = String(texte ?? '').toLowerCase().replace(/\bune?\b/g, '1').replace(/,/g, '.');
  const n = (x) => parseFloat(x) || 0;
  let m;
  if ((m = /(\d+)\s*:\s*(\d{1,2})\b/.exec(t))) return n(m[1]) * 60 + n(m[2]);
  if ((m = /(\d+(?:\.\d+)?)\s*h(?:eures?)?(?![a-z])\s*(\d+)?/.exec(t))) return n(m[1]) * 3600 + n(m[2]) * 60;
  if ((m = /(\d+(?:\.\d+)?)\s*(?:min(?:utes?)?|mn|m)(?![a-z])\.?\s*(\d+)?/.exec(t))) return n(m[1]) * 60 + n(m[2]);
  if ((m = /(\d+(?:\.\d+)?)/.exec(t))) return n(m[1]);
  return null;
}

/**
 * Une seule voix à la fois dans les sous-titres. Quand deux voix parlent en même temps (la voix off posée par-dessus un
 * plan qui parle), leurs mots se mêlaient, triés par temps, et les sous-titres changeaient de voix à chaque mot, avec des
 * lignes de 0,1 à 0,3 s. Ici : la voix off (`voixOff`, les ids de ses plans par-dessus) passe devant ; pour le reste, la
 * voix qui parlait la première finit sa phrase. Les mots écartés restent dans transcriptions/ et dans le texte du plan.
 */
export function uneVoixALaFois(mots, voixOff = new Set()) {
  // les phrases de chaque voix : ses mots qui se suivent à moins de 0,6 s
  const phrases = [];
  const enCours = new Map();
  for (const w of mots) {
    if (w.evenement) continue;
    let q = enCours.get(w.plan);
    if (!q || w.debut - q.fin >= 0.6) {
      q = {plan: w.plan, debut: w.debut, fin: w.fin, mots: []};
      phrases.push(q);
      enCours.set(w.plan, q);
    }
    q.mots.push(w);
    q.fin = Math.max(q.fin, w.fin);
  }
  if (new Set(phrases.map((q) => q.plan)).size < 2) return mots;
  phrases.sort((a, b) => Number(voixOff.has(b.plan)) - Number(voixOff.has(a.plan)) || a.debut - b.debut);
  const prises = []; // les moments déjà pris par une voix
  const retires = new Set();
  for (const q of phrases) {
    const gardes = q.mots.filter((w) => {
      const c = (w.debut + w.fin) / 2;
      return !prises.some((x) => x.plan !== q.plan && c >= x.debut && c < x.fin);
    });
    for (const w of q.mots) if (!gardes.includes(w)) retires.add(w);
    if (gardes.length) prises.push({plan: q.plan, debut: gardes[0].debut, fin: gardes.at(-1).fin});
  }
  return retires.size ? mots.filter((w) => !retires.has(w)) : mots;
}

/**
 * Options : `leger` — seulement ce qu'il faut au rendu intégré (« Créer la vidéo ») : ni vignettes, ni storyboard, ni
 * références, ni zip ; `dossier` — où écrire le pack (par défaut exports/<titre>-pack-<date> dans le projet) ;
 * `pourIA` — le dossier de travail de l'IA de Dérush : toujours avec le kit, jamais de zip ni de copie des rushes complets
 * (les cases du panneau « Exporter le pack » ne valent que pour l'export à la main) ; `donnees` — le projet tel qu'il
 * était au moment du clic (une copie), quand le pack attend son tour dans la file.
 */
export async function exporterPack(P, prog = () => {}, {leger = false, dossier = null, pourIA = false, donnees = null} = {}) {
  // Le projet est figé ici : la personne peut continuer à travailler pendant que le pack se fait (plusieurs minutes pour
  // « Créer la vidéo »), sans que l'ancien montage se mêle aux nouveaux effets et au nouveau style.
  let d = donnees ?? structuredClone(P.d);
  // les vrais médias du projet : ce que Dérush apprend d'un rush en le préparant (son format exact) y reste noté
  const mediasDuProjet = new Map(P.d.medias.map((m) => [m.id, m]));
  // Rien n'a été découpé : l'IA reçoit les rushes entiers, dans l'ordre où ils ont été importés, et choisit elle-même
  // les passages. (Le projet n'est pas modifié : ce montage ne sert qu'au pack.) Chaque plan porte le nom de son rush
  // (M1, M2…) : un nom qui n'existe pas dans la timeline du projet. Avec P1, P2…, un retour de l'IA (« Retirer P3 »)
  // visait plus tard un tout autre plan, celui que la personne avait posé entre-temps sous ce nom.
  const decoupeLibre = !d.montage.length && d.medias.length > 0;
  if (decoupeLibre) {
    // les réponses dites au micro pour la voix off ne sont pas des rushes : elles restent dans les sources, jamais en plans
    // (import dynamique : un import statique ferait la boucle pack → voix-off → conseil → gemini → rendu → pack)
    const {mediasReponses} = await import('./voix-off.mjs');
    const reponses = mediasReponses(P);
    const rushes = d.medias.filter((m) => !reponses.has(m.id));
    d = {...d, montage: (rushes.length ? rushes : d.medias).map((m) => ({
      id: m.id, type: 'plan', media: m.id, entree: 0, sortie: m.type === 'image' ? 3 : m.duree, titre: '', notes: '', tags: [],
      son: {actif: true, gain_db: 0, version: 'original', avant_s: 0, apres_s: 0},
    }))};
  }
  // Rien du tout (mode motion design, ou seulement des pièces jointes) : une seule case « à créer », de la durée visée.
  // Elle dit à l'IA que tout est à inventer ; sa durée n'est qu'indicative. (Le projet n'est pas modifié.)
  const toutACreer = !leger && !d.montage.length && !d.medias.length;
  if (toutACreer) {
    const vise = dureeVisee(d.brief?.duree_visee);
    const duree = vise ? Math.min(600, Math.max(3, vise)) : 20;
    d = {...d, montage: [{id: 'B1', type: 'bloc', genre: 'animation', duree, titre: 'Tout est à créer', consigne: 'Aucun rush : crée toute la vidéo, d’après la demande et le mode du projet. La durée de cette case est indicative.', references: ''}]};
  }
  const fps = d.sortie.fps;
  const seq = sequence(d);
  if (!seq.segs.length) throw new Error('Il n’y a encore rien à envoyer : importe au moins une vidéo, un son ou une photo.');
  // Un média du montage dont le fichier a disparu (disque débranché, fichier déplacé) : on le dit tout de suite, en
  // clair, au lieu d'échouer au milieu du pack sur un message de FFmpeg.
  const aPoser = new Set([...d.montage, ...(d.superpositions ?? [])].filter((it) => it.type !== 'bloc').map((it) => it.media));
  const absents = d.medias.filter((m) => aPoser.has(m.id) && !fs.existsSync(m.chemin));
  if (absents.length) {
    const un = absents.length === 1;
    const noms = `${absents.slice(0, 3).map((m) => `« ${m.nom} »`).join(', ')}${absents.length > 3 ? ` et ${absents.length - 3} autre(s)` : ''}`;
    throw new Error(`${noms} ${un ? 'est introuvable' : 'sont introuvables'} (dossier ${path.dirname(absents[0].chemin)}). Rebranche le disque où ${un ? 'il se trouve' : 'ils se trouvent'}, ou retire ${un ? 'ce média' : 'ces médias'} du projet, puis recommence.`);
  }
  const maintenant = new Date();
  const horodatage = `${maintenant.getFullYear()}${p2(maintenant.getMonth() + 1)}${p2(maintenant.getDate())}-${p2(maintenant.getHours())}${p2(maintenant.getMinutes())}${p2(maintenant.getSeconds())}`;
  // les vidéos du projet (lib/sequences.mjs) : le pack porte celle qui est ouverte, et dit s'il y en a d'autres
  const laVideo = videosDuPack(d);
  const nom = `${slug(d.titre) || 'montage'}${laVideo ? `-${slug(laVideo.nom, 30) || `video-${laVideo.numero}`}` : ''}-pack-${horodatage}`;
  const D = dossier ?? path.join(P.racine, 'exports', nom);
  if (dossier) fs.rmSync(D, {recursive: true, force: true});
  for (const s of ['plans', 'vignettes', 'storyboard', 'sous-titres', 'transcriptions', 'analyse']) fs.mkdirSync(path.join(D, s), {recursive: true});
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-'));
  const avertissements = [];
  try {
    const medias = new Map(d.medias.map((m) => [m.id, m]));
    const cacheMots = new Map();
    const motsDe = (m) => {
      if (!cacheMots.has(m.id)) cacheMots.set(m.id, lireMots(P, m));
      return cacheMots.get(m.id);
    };
    const lireCache = (m, f) => lireJson(path.join(P.cache, 'medias', m.id, f));
    const supers = [...(d.superpositions ?? [])].sort((a, b) => a.debut - b.debut);
    const total = (seq.segs.length + supers.length) * 2 + 5;
    let fait = 0;
    const avance = () => prog(Math.min(0.99, ++fait / total));
    const ro = d.sortie.largeur / d.sortie.hauteur;
    const sansTexte = new Set();
    const hdr = new Set();
    let motsMontage = [];
    // Avec un .zip demandé (un pack à confier à quelqu'un), jamais de lien vers un gros fichier resté sur un autre
    // disque : le zip n'emporterait que le lien, pas le rush.
    const lienSiGros = d.export.zip && !leger && !pourIA ? Infinity : 3e9;

    // Les rushes posés dans plans/ (un fichier par rush, partagé par ses plans) et comment ils l'ont été
    const rushes = new Map();
    const poses = {clone: 0, copie: 0, lien: 0, version: 0};
    /** Le rush tel que l'IA le reçoit : {rel, dims}. null si on n'a pas pu le poser (on retombe alors sur un plan découpé). */
    function fichierDuRush(m) {
      if (!rushes.has(m.id)) {
        rushes.set(m.id, (async () => {
          try {
            // le vrai média du projet (pas sa copie figée) : son format exact, s'il manquait, y est complété
            const vrai = mediasDuProjet.get(m.id) ?? m;
            const connu = vrai.pix_fmt !== undefined;
            const src = await fichierPourIA(P, vrai);
            const rel = `plans/${nomDuRush(m)}${path.extname(src).toLowerCase() || '.mp4'}`;
            // un rush sur un autre disque, très gros : un lien plutôt qu'une copie de plusieurs gigaoctets (l'IA est
            // prévenue de ne jamais écrire dans plans/)
            poses[await poserFichier(src, path.join(D, rel), {lienSiGros})]++;
            let dims = null;
            if (src !== m.chemin) {
              poses.version++;
              const v = await dimensionsVideo(src);
              if (v) dims = v;
            }
            if (!connu && vrai.pix_fmt !== undefined) P.sauver(); // les informations techniques complétées restent dans le projet
            return {rel, dims};
          } catch (e) {
            avertissements.push(`« ${m.nom} » n’a pas pu être donné tel quel (${String(e.message).slice(0, 120)}) : ses plans sont découpés à part.`);
            return null;
          }
        })());
      }
      return rushes.get(m.id);
    }

    const versionsPosees = new Map();
    /** Une version du son d'un rush (voix seule, fond, voix claire), posée une seule fois dans plans/. */
    function versionDuRush(m, v, f) {
      const cle = `${m.id}:${v}`;
      if (!versionsPosees.has(cle)) {
        versionsPosees.set(cle, (async () => {
          const rel = `plans/${nomDuRush(m)}-${v}${path.extname(f).toLowerCase()}`;
          await poserFichier(f, path.join(D, rel));
          return rel;
        })());
      }
      return versionsPosees.get(cle);
    }

    /** Exporte un plan (du montage ou posé par-dessus) : fichier exact, versions du son, vignettes, mots, recadrage. */
    async function exporterPlan(it, deb, fin, prefixe) {
      const m = medias.get(it.media);
      const fixe = m.type === 'image';
      const sf = fixe ? fps : fpsSource(m, d);
      const {avant: jAvant, apres: lApres} = debordements(it);
      const H = fixe ? 0 : Math.max(d.export.poignees_s ?? 0.5, jAvant, lApres);
      const dureeUtile = fin - deb;
      const base = `plans/${prefixe}-${nomSur(it.id)}-${slug(it.titre || path.parse(m.nom).name, 30) || 'plan'}`;
      // Une vidéo : le rush entier (ou sa version de montage, faite une seule fois), posé dans plans/ par un clone et
      // partagé par tous ses plans. La partie utile du plan est donnée par ses temps (debut_utile_s, fin_utile_s) :
      // plus aucun réencodage à chaque demande (c'était un quart d'heure pour dix minutes de rushes en 3K).
      // Un son seul d'un format courant (m4a, mp3, wav, flac) est posé de la même façon, entier et sans réécriture.
      const rush = m.type === 'video' || sonLisible(m) ? await fichierDuRush(m) : null;
      const avant = rush ? it.entree : Math.min(H, it.entree);
      const apres = rush ? Math.max(0, m.duree - it.sortie) : Math.min(H, Math.max(0, m.duree - it.sortie));
      const rel = rush ? rush.rel : `${base}.${m.type === 'audio' ? 'wav' : 'mp4'}`;
      let image = null;
      let dimsImage = rush?.dims ?? null;
      if (rush) { /* déjà posé */ } else if (fixe) {
        // une image fixe : l'original (pleine qualité) et un plan vidéo de la bonne durée, prêt à monter
        image = `${base}${path.extname(m.chemin).toLowerCase() || '.jpg'}`;
        await poserFichier(m.chemin, path.join(D, image));
        dimsImage = await extraireImage(P, m, dureeUtile, path.join(D, rel), fps);
      } else await extrairePlan(m, it.entree - avant, avant + dureeUtile + apres, path.join(D, rel), sf, decoupeLibre ? 'veryfast' : 'medium');
      if (m.hdr) hdr.add(m.nom);
      // les autres versions du son : voix seule et fond (Demucs), voix claire (nettoyée par Dérush). Pour un rush
      // posé entier (vidéo ou son), la version entière est posée une fois pour tout le rush ; pour un son d'un format
      // rare, découpé en WAV, elle est découpée comme son plan.
      const versions = {};
      for (const v of ['voix', 'fond', 'clair']) {
        const f = fichierSon(P, m, v);
        if (!f) continue;
        if (rush) versions[v] = await versionDuRush(m, v, f);
        else {
          versions[v] = `${base}-${v}.wav`;
          await ffmpeg(['-y', '-ss', (it.entree - avant).toFixed(6), '-i', f, '-t', (avant + dureeUtile + apres).toFixed(6), '-c:a', 'pcm_s16le', '-ar', '48000', path.join(D, versions[v])]);
        }
      }
      if (it.son?.version && it.son.version !== 'original' && !versions[it.son.version]) avertissements.push(`${it.id} demande « ${NOMS_VERSIONS[it.son.version] ?? it.son.version} », qui n’a pas encore été faite pour « ${m.nom} » : le son d’origine est fourni.`);
      avance();
      const mesure = m.audio ? await mesurerSon(m, it.entree, dureeUtile) : null;
      let vignette = null;
      if (POLICE && !leger) {
        vignette = `vignettes/${prefixe}-${nomSur(it.id)}.jpg`;
        // une vignette ratée ne doit jamais bloquer le pack
        try {
          await triptyque(fixe ? {...m, type: 'video'} : m, path.join(D, rel), avant, dureeUtile, sf, it.entree, path.join(D, vignette), tmp);
        } catch (e) {
          vignette = null;
          avertissements.push(`${it.id} : images d'entrée et de sortie impossibles à extraire (${String(e.message).slice(0, 120)}).`);
        }
      }
      avance();
      const vers = (t) => arrondi(deb + t - it.entree, 3);
      const mots = motsEntre(motsDe(m), it.entree, it.sortie).map((w) => ({
        t: w.t, debut: arrondi(Math.max(deb, vers(w.d)), 3), fin: arrondi(Math.min(fin, vers(w.f)), 3),
        ...(w.loc ? {locuteur: w.loc} : {}), ...(w.ev ? {evenement: true} : {}),
      }));
      if (!motsDe(m) && m.audio) sansTexte.add(m.nom);
      const an = lireCache(m, 'analyse.json');
      const cad = m.type === 'video' ? lireCache(m, 'cadrage.json') : null;
      let cadrage = null;
      if (cad?.points?.length) {
        const rs = m.largeur / m.hauteur;
        const pts = [pointCadrage(cad.points, it.entree), ...cad.points.filter((p) => p.t > it.entree && p.t < it.sortie), pointCadrage(cad.points, it.sortie)];
        cadrage = {
          explication: `Centre d'intérêt (x, y en fractions de l'image) au fil du temps du montage. « fenetre » = [gauche, haut, largeur, hauteur] à découper dans l'image pour la sortie ${d.sortie.largeur}×${d.sortie.hauteur}. Interpole entre les points ; ne glisse pas à travers un point marqué « coupe ».`,
          points: pts.map((p) => ({t: vers(p.t), x: arrondi(p.x, 3), y: arrondi(p.y, 3), type: p.type, fenetre: fenetreCadrage(p.x, p.y, rs, ro), ...(p.coupe ? {coupe: true} : {})})),
        };
      }
      const av = Math.min(jAvant, avant);
      const ap = Math.min(lApres, apres);
      // de quoi guider l'IA : le rythme de la parole, la présence d'un visage, les couleurs du plan
      const ditsSeuls = mots.filter((w) => !w.evenement);
      const debit = dureeUtile > 0 && ditsSeuls.length ? arrondi(ditsSeuls.length / dureeUtile, 2) : null;
      const ptsPlan = cad?.points?.filter((p) => p.t >= it.entree && p.t <= it.sortie) ?? [];
      const visage = ptsPlan.length ? arrondi(ptsPlan.filter((p) => p.type === 'visage').length / ptsPlan.length, 2) : null;
      const couleurs = leger || m.type === 'audio' ? null : await couleursPlan(path.join(D, rel), avant + dureeUtile / 2);
      // Ce qui est dit dans le plan. Les mots un à un ne sont plus répétés ici (ils sont dans sous-titres/mots.json et
      // dans transcriptions/) : pour 20 min de parole, montage.json faisait 15 000 lignes de mots avant d'arriver au
      // reste. Un très long texte (un rush entier, sans découpe) est coupé, avec l'endroit où lire la suite.
      const dit = texteDesMots(ditsSeuls);
      const texte = dit.length > 600 ? `${dit.slice(0, 600).replace(/\s+\S*$/, '')}… (la suite : transcriptions/${nomDuRush(m)}.json)` : dit;
      return {
        mots,
        donnees: {
          source: {id: m.id, nom: m.nom, type: m.type, entree: temps(it.entree, sf), sortie: temps(it.sortie, sf), fps: sf},
          fichier: {
            chemin: rel, debut_utile_s: arrondi(avant), fin_utile_s: arrondi(avant + dureeUtile),
            poignee_avant_s: arrondi(avant), poignee_apres_s: arrondi(apres),
            ...(m.type === 'audio' ? {frequence_hz: rush ? m.audio?.frequence ?? null : 48000} : {largeur: dimsImage?.largeur ?? m.largeur, hauteur: dimsImage?.hauteur ?? m.hauteur, fps: sf, son: !!m.audio}),
            ...(image ? {image_originale: image, image_largeur: m.largeur, image_hauteur: m.hauteur} : {}),
            ...versions,
          },
          essentiel: it.essentiel === true,
          // l'étalonnage posé par l'humain : déjà appliqué par le kit (colorCorrection) ; reglages = ses curseurs (−100 à 100)
          ...(couleurPropre(it.couleur) ? {couleur: couleurVersRemotion(it.couleur), couleur_reglages: couleurPropre(it.couleur)} : {}),
          ...(it.sans_sous_titres === true ? {sans_sous_titres: true} : {}),
          guide: {
            ...(debit != null ? {debit_parole_mots_par_s: debit} : {}),
            ...(visage != null ? {part_avec_visage: visage} : {}),
            ...(couleurs ? {couleurs_dominantes: couleurs} : {}),
            ...(fixe ? {image_fixe: true} : {}),
          },
          vignette,
          son: {
            garder: it.son?.actif !== false, gain_db: it.son?.gain_db ?? 0,
            version: versions[it.son?.version] ? it.son.version : 'original',
            avant_s: arrondi(av), apres_s: arrondi(ap),
            debut: temps(Math.max(0, deb - av), fps), fin: temps(fin + ap, fps),
            ...(mesure ? {lufs: mesure.lufs, crete_dbfs: mesure.crete} : {}),
            silences: (an?.silences ?? []).filter(([a, b]) => b > it.entree && a < it.sortie).map(([a, b]) => [vers(Math.max(a, it.entree)), vers(Math.min(b, it.sortie))]),
          },
          coupes_camera: (an?.coupes_camera ?? []).filter((c) => c > it.entree && c < it.sortie).map(vers),
          ...(cadrage ? {cadrage} : {}),
          texte,
          notes: it.notes || '',
          tags: it.tags ?? [],
        },
      };
    }

    /**
     * Pose dans references/ les fichiers donnés pour une case (ou pour tout le projet si cible = null) : par un clone,
     * comme les rushes (une vraie copie d'une référence de 2 Go, à chaque pack, figeait le serveur et remplissait le
     * disque). Rien dans le pack léger de « Créer la vidéo » : le rendu ne lit pas les références.
     */
    async function copierReferences(cible) {
      const liste = [];
      if (leger) return liste;
      for (const r of (d.references ?? []).filter((x) => (x.cible ?? null) === cible)) {
        // le nom seul : le chemin complet (nom du compte, dossiers d'autres clients) n'a pas à partir chez l'IA
        if (!fs.existsSync(r.chemin)) { avertissements.push(`Référence introuvable : « ${r.nom} ».`); continue; }
        // l'id de la case et le nom du fichier deviennent des noms du pack : rien qui en sorte (« ../ »)
        const sous = cible == null ? 'projet' : nomSur(cible);
        const dossier = path.join(D, 'references', sous);
        fs.mkdirSync(dossier, {recursive: true});
        const nomPropre = path.basename(String(r.nom ?? '')).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+$/, '') || 'reference';
        let nomRef = nomPropre;
        for (let k = 2; fs.existsSync(path.join(dossier, nomRef)); k++) nomRef = `${path.parse(nomPropre).name}-${k}${path.extname(nomPropre)}`;
        await poserFichier(r.chemin, path.join(dossier, nomRef), {lienSiGros});
        liste.push({nom: r.nom, chemin: `references/${sous}/${nomRef}`, taille_octets: r.taille ?? null, genre: genreReference(nomPropre)});
      }
      return liste;
    }

    // 1. Le montage, élément par élément (les plans se préparent quatre à la fois : vignettes, mesures, son)
    const items = [];
    const plansPrets = new Map(await enParallele(seq.segs.filter((s) => s.it.type === 'plan'), 4, async (s) => [s.it.id, await exporterPlan(s.it, s.debut, s.fin, p2(s.k + 1))]));
    for (const s of seq.segs) {
      const it = s.it;
      const n = s.k + 1;
      const base = {n, id: it.id, type: it.type, titre: it.titre || '', debut: temps(s.debut, fps), fin: temps(s.fin, fps), duree: {s: arrondi(s.fin - s.debut), images: s.i1 - s.i0}};
      if (it.type === 'plan') {
        const r = plansPrets.get(it.id);
        for (const w of r.mots) motsMontage.push({...w, plan: it.id});
        items.push({...base, ...r.donnees});
      } else {
        if (!it.consigne?.trim()) avertissements.push(`La case ${it.id} (${GENRES_BLOC[it.genre]}) n'a pas de consigne : l'IA devra deviner son contenu.`);
        items.push({...base, genre: it.genre, genre_lisible: GENRES_BLOC[it.genre], consigne: it.consigne || '', references: it.references || '',
          fichiers_reference: await copierReferences(it.id), a_creer: true});
        avance();
        avance();
      }
    }

    // 2. Plans posés par-dessus (ils ne changent pas la durée du montage)
    const superpositions = [];
    const bornes = supers.map((sp) => { const deb = surGrille(sp.debut, fps); return [deb, deb + Math.max(1, versImage(sp.sortie - sp.entree, fps)) / fps]; });
    const dessusPrets = await enParallele(supers.map((sp, i) => [sp, i]), 4, ([sp, i]) => exporterPlan(sp, bornes[i][0], bornes[i][1], `S${p2(i + 1)}`));
    let k = 0;
    for (const sp of supers) {
      k++;
      const [deb, fin] = bornes[k - 1];
      const r = dessusPrets[k - 1];
      for (const w of r.mots) if (sp.son?.actif) motsMontage.push({...w, plan: sp.id});
      if (deb >= seq.duree) avertissements.push(`Le plan par-dessus ${sp.id} commence après la fin du montage.`);
      superpositions.push({
        n: k, id: sp.id, type: 'plan', piste: 'par-dessus', titre: sp.titre || '', cadre: sp.cadre, ...(sp.voix_off ? {voix_off: true} : {}),
        debut: temps(deb, fps), fin: temps(fin, fps), duree: {s: arrondi(fin - deb), images: versImage(fin - deb, fps)},
        sur: seq.segs.filter((s) => s.fin > deb && s.debut < fin).map((s) => s.it.id),
        ...r.donnees,
      });
    }
    motsMontage.sort((a, b) => a.debut - b.debut);
    // la voix off qui passe sur un plan qui parle : une seule voix à la fois dans les sous-titres
    motsMontage = uneVoixALaFois(motsMontage, new Set(supers.filter((sp) => sp.voix_off).map((sp) => sp.id)));

    for (const nomRush of sansTexte) avertissements.push(`« ${nomRush} » n'a pas de transcription : ses plans n'auront ni texte ni sous-titres.`);
    for (const nomRush of hdr) avertissements.push(`« ${nomRush} » est en HDR : les plans ont été convertis en SDR (BT.709)${(await filtreSdr({hdr: true})) ? '' : ' sans correction des couleurs : vérifier les couleurs'}.`);
    for (const m of d.medias) if (m.transcription?.approx && [...d.montage, ...supers].some((it) => it.media === m.id)) avertissements.push(`La transcription de « ${m.nom} » vient de sous-titres : le temps de chaque mot est approximatif.`);

    // 3. Indications (posées par-dessus le montage)
    const indications = [...d.indications].filter((i) => !CATALOGUE[i.modele]).sort((a, b) => a.debut - b.debut).map((i) => {
      const deb = surGrille(i.debut, fps);
      const fin = Math.min(surGrille(i.fin, fps), Math.max(deb, seq.duree));
      if (deb >= seq.duree) avertissements.push(`L'indication ${i.id} commence après la fin du montage.`);
      return {
        id: i.id, genre: i.genre, genre_lisible: GENRES_INDICATION[i.genre], consigne: i.consigne || '',
        debut: temps(deb, fps), fin: temps(fin, fps), duree: {s: arrondi(fin - deb), images: versImage(fin - deb, fps)},
        elements_concernes: seq.segs.filter((s) => s.fin > deb && s.debut < fin).map((s) => s.it.id),
      };
    });

    // 3 bis. Habillage : le style du film et les effets posés (le kit les dessine déjà)
    const style = styleComplet(d.style, d.sortie);
    const effets = [...d.indications].filter((i) => CATALOGUE[i.modele]).sort((a, b) => a.debut - b.debut).map((i) => {
      const deb = surGrille(i.debut, fps);
      const fin = Math.max(deb + 1 / fps, surGrille(i.fin, fps));
      if (deb >= seq.duree) avertissements.push(`L'effet ${i.id} (${CATALOGUE[i.modele].nom}) commence après la fin du montage.`);
      return {
        id: i.id, modele: i.modele, nom: CATALOGUE[i.modele].nom, categorie: CATALOGUE[i.modele].categorie, resume: resumeEffet(i),
        debut: temps(deb, fps), fin: temps(fin, fps), reglages: reglagesDe(i.modele, i.reglages),
        elements_concernes: seq.segs.filter((s) => s.fin > deb && s.debut < fin).map((s) => s.it.id),
      };
    });
    // un « Titre derrière la personne » demande la personne détourée, image par image, sur les plans qu'il couvre
    for (const e of effets.filter((x) => x.modele === 'titre-derriere')) {
      for (const it of items) {
        if (it.type !== 'plan' || it.source.type === 'audio' || it.fin.s <= e.debut.s || it.debut.s >= e.fin.s) continue;
        const sf = it.fichier.fps || fps;
        const a = it.fichier.debut_utile_s + Math.max(0, e.debut.s - it.debut.s);
        const b = it.fichier.debut_utile_s + Math.min(it.duree.s, e.fin.s - it.debut.s);
        const i0 = Math.max(0, Math.floor(a * sf) - 1);
        const i1 = Math.ceil(b * sf) + 1;
        const deja = it.fichier.masques;
        try {
          // sf : la cadence qui a servi à compter i0 et i1 (celle du fichier du plan), sans quoi les images détourées
          // seraient décalées quand le fichier a une autre cadence que le projet
          await decoupesFichier(path.join(D, it.fichier.chemin), path.join(D, 'decoupes', nomSur(it.id)), i0, i1, undefined, sf);
          it.fichier.masques = {dossier: `decoupes/${nomSur(it.id)}`, premiere: Math.min(i0, deja?.premiere ?? i0), derniere: Math.max(i1, deja?.derniere ?? i1)};
        } catch (err) {
          avertissements.push(`${e.id} : la personne du plan ${it.id} n'a pas pu être détourée, le titre passera devant elle (${String(err.message).slice(0, 140)}).`);
        }
      }
    }
    const habillage = {
      explication: 'Les effets posés dans Dérush. Le kit remotion/ les dessine déjà (src/moteur.js). Pour les changer : modifie « reglages », « debut » et « fin » ici, ou ajoute un effet du catalogue. Les temps sont ceux du montage.',
      effets,
      sans_sous_titres: items.filter((it) => it.sans_sous_titres).map((it) => it.id),
      catalogue: Object.fromEntries(Object.entries(CATALOGUE).map(([k, c]) => [k, {nom: c.nom, categorie: c.categorie, description: c.description,
        ...(c.categorie === 'transition' ? {avant_s: c.avant, apres_s: c.apres} : {duree_s: c.duree}),
        reglages: Object.fromEntries(Object.entries(c.reglages).map(([r, p]) => [r, {nom: p.nom, type: p.type, defaut: p.defaut, ...(p.options ? {valeurs: Object.keys(p.options)} : {}), ...(p.type === 'nombre' ? {min: p.min, max: p.max} : {})}]))}])),
    };

    const mesuresDe = (m) => { const x = lireCache(m, 'mesures.json'); return x ? {image: x.image ?? null, son: x.son ?? null, defauts: (x.defauts ?? []).map((dd) => dd.texte)} : null; };
    const analyseIA = (m) => { const x = lireCache(m, 'ia.json'); return x ? {resume: x.resume, contenu: x.contenu, moments: x.moments, defauts: x.defauts, usage: x.usage, note: x.note} : null; };
    // 4. Sources : transcriptions, analyses et recadrages complets (temps source), copie éventuelle des rushes
    const utilises = new Set([...d.montage, ...supers].filter((it) => it.type !== 'bloc').map((it) => it.media));
    const sources = [];
    for (const m of d.medias) {
      const base = nomDuRush(m);
      const mots = motsDe(m);
      const an = lireCache(m, 'analyse.json');
      const cad = lireCache(m, 'cadrage.json');
      let transcription = null;
      let analyse = null;
      let complet = null;
      if (mots) {
        transcription = `transcriptions/${base}.json`;
        ecrireJson(path.join(D, transcription), {
          source: m.id, nom: m.nom, moteur: m.transcription?.moteur ?? null, approximatif: !!m.transcription?.approx,
          explication: 'Temps en secondes dans le fichier source (pas dans le montage). « locuteur » distingue les voix quand le moteur le permet.',
          mots: mots.map((w) => ({t: w.t, debut: w.d, fin: w.f, ...(w.loc ? {locuteur: w.loc} : {}), ...(w.ev ? {evenement: true} : {})})),
        });
      }
      if (an || cad) {
        analyse = `analyse/${base}.json`;
        ecrireJson(path.join(D, analyse), {source: m.id, nom: m.nom, explication: 'Temps en secondes dans le fichier source. silences = [début, fin]. cadrage = centre d’intérêt de l’image (Apple Vision). incrustes = ce qui est déjà dans le rush : images noires, transitions rapides d’une appli (flashs, flous), son coupé net, logo d’une appli, texte lu à l’image (filmé ou incrusté).', ...(an ?? {}), ...(cad ? {cadrage: cad.points} : {})});
      }
      // les rushes complets : seulement pour l'export à la main (l'IA de Dérush a déjà les rushes entiers dans plans/)
      if (d.export.rushes_complets && !leger && !pourIA) {
        if (fs.existsSync(m.chemin)) {
          fs.mkdirSync(path.join(D, 'rushes'), {recursive: true});
          complet = `rushes/${m.id}-${m.nom}`;
          await poserFichier(m.chemin, path.join(D, complet));
        } else avertissements.push(`« ${m.nom} » est introuvable : il n’est pas dans rushes/.`);
      }
      sources.push({
        id: m.id, nom: m.nom, utilise: utilises.has(m.id), type: m.type, ...(m.type === 'image' ? {} : {duree: temps(m.duree, fpsSource(m, d))}),
        fps: m.fps, largeur: m.largeur, hauteur: m.hauteur, hdr: !!m.hdr, audio: m.audio, voix_isolee: !!fichierSon(P, m, 'voix'),
        codec: m.codec ?? null, conteneur: m.conteneur ?? null, debit_kbps: m.debit_kbps ?? null, taille_octets: m.taille ?? null,
        tournage: m.tournage && Object.keys(m.tournage).length ? m.tournage : null,
        coupes_camera: an?.coupes_camera?.length ?? null, visages_reperes: m.cadrage?.visages ?? null,
        lufs: an?.lufs ?? null, fichier_complet: complet, transcription, analyse,
        // 11.0 : ce que Dérush a mesuré (image, son, défauts), ce que l'IA y a vu (si l'humain l'a fait analyser), les
        // couleurs de la caméra déjà converties, la voix claire déjà faite
        ...(mesuresDe(m) ? {mesures: mesuresDe(m)} : {}),
        ...(analyseIA(m) ? {analyse_ia: analyseIA(m)} : {}),
        ...(m.couleur?.profil && m.couleur.profil !== 'normal' ? {couleur_camera: {profil: m.couleur.camera === 'dlogm' ? 'dlogm' : m.couleur.profil, converti: true}} : {}),
        ...(m.clair ? {voix_claire: {force: m.clair.force, echo: !!m.clair.echo}} : {}),
      });
    }
    avance();

    // 5. Sous-titres (temps du montage)
    const cues = sousTitres(motsMontage);
    fs.writeFileSync(path.join(D, 'sous-titres', 'montage.srt'), cues.map((q, n) => `${n + 1}\n${horo(q.debut, ',')} --> ${horo(q.fin, ',')}\n${q.lignes.join('\n')}\n`).join('\n'));
    fs.writeFileSync(path.join(D, 'sous-titres', 'montage.vtt'), `WEBVTT\n\n${cues.map((q) => `${horo(q.debut, '.')} --> ${horo(q.fin, '.')}\n${q.lignes.join('\n')}\n`).join('\n')}`);
    ecrireJson(path.join(D, 'sous-titres', 'mots.json'), {
      explication: `Chaque mot dit dans le montage, en temps du montage (secondes) ; image_debut / image_fin à ${fps} i/s. « plan » = l'id du plan (ou du plan par-dessus) qui le dit. Idéal pour des sous-titres mot à mot. Quand deux voix parlent en même temps (la voix off sur un plan qui parle), une seule est gardée ici : la voix off d'abord.`,
      fps, mots: motsMontage.map((w) => ({...w, image_debut: versImage(w.debut, fps), image_fin: versImage(w.fin, fps)})),
    });
    avance();

    // 6. Storyboard (planches de 16 cases)
    let pages = [];
    if (POLICE && !leger) {
      // un storyboard raté ne doit jamais faire tomber le pack (ni, avec lui, la demande à l'IA)
      try {
        pages = await storyboard([...items, ...superpositions.map((x) => ({...x, n: `S${x.n}`, par_dessus: true}))], D, tmp);
      } catch (e) {
        pages = [];
        for (const f of fs.readdirSync(path.join(D, 'storyboard'))) fs.rmSync(path.join(D, 'storyboard', f), {force: true});
        avertissements.push(`Le storyboard n’a pas pu être dessiné (${String(e.message).slice(0, 120)}) : sers-toi des vignettes et du tableau du montage.`);
      }
    }
    avance();

    // 7. Données, OpenTimelineIO, kit Remotion, modes d'emploi
    const fmt = FORMATS[d.sortie.preset] ?? {ratio: `${d.sortie.largeur}:${d.sortie.hauteur}`};
    const plans = items.filter((i) => i.type === 'plan');
    const referencesProjet = await copierReferences(null);
    const stats = {
      plans: plans.length, essentiels: plans.filter((x) => x.essentiel).length, cases_a_creer: items.length - plans.length, par_dessus: superpositions.length, indications: indications.length, effets: effets.length, plans_sans_sous_titres: habillage.sans_sous_titres.length,
      references: referencesProjet.length + items.reduce((a, x) => a + (x.fichiers_reference?.length ?? 0), 0),
      sources_utilisees: utilises.size, mots_dits: motsMontage.filter((w) => !w.evenement).length,
      duree_plans_s: arrondi(plans.reduce((a, i) => a + i.duree.s, 0)), duree_cases_s: arrondi(items.filter((i) => i.type === 'bloc').reduce((a, i) => a + i.duree.s, 0)),
    };
    // le rendu intégré et l'IA de Dérush ont toujours besoin du kit ; la case « Kit de départ Remotion » ne vaut que
    // pour l'export à la main
    const kit = leger || pourIA || (d.export.kit_remotion !== false && fs.existsSync(KIT));
    const montage = {
      _format: 'derush-pack', _version: 4,
      decoupe: toutACreer ? 'a_creer' : decoupeLibre ? 'libre' : 'faite',
      _a_lire: `Lis LISEZMOI-IA.md d'abord. Temps du montage en secondes depuis 0 ; « image » = numéro d'image à ${fps} i/s ; « tc » = timecode HH:MM:SS:II. Les temps « source » sont dans le rush d'origine. Les mots de chaque plan, un à un, sont dans sous-titres/mots.json (champ « plan ») et dans transcriptions/.`,
      _esprit: toutACreer ? 'Il n’y a aucun rush : tout est à créer, d’après la demande de l’humain et le mode du projet. La case « Tout est à créer » ne donne qu’une durée indicative.' : decoupeLibre
        ? 'L’humain n’a rien découpé : les plans sont ses rushes entiers, dans l’ordre où il les a importés. À toi de choisir les meilleurs passages, de les ordonner et de les raccourcir, puis de monter la vidéo.'
        : 'Ce montage est un squelette fait par un humain : il donne l’intention (passages choisis, ordre, durées, consignes). Garde les plans « essentiel » et l’esprit du brief ; tout le reste, tu peux l’améliorer librement (resserrer, réordonner, ajouter de la 3D, des images générées, du motion design…).',
      projet: {titre: d.titre, exporte_le: maintenant.toISOString(), outil: `Dérush ${VERSION}`, langue: d.langue ?? 'fr',
        // pour qui (voir contexte/espace/ESPACE.md) et, pour un épisode, sa série (contexte/serie/SERIE.md)
        espace: (() => { const e = espaceDuProjet(P); return e ? {id: e.id, nom: e.nom, type: e.type, metier: e.metier?.type ?? null} : null; })(), serie: d.serie?.nom ?? null,
        // le projet a plusieurs vidéos dans Dérush : ce pack porte celle qui est ouverte (la demande vaut pour elle)
        video: laVideo},
      // le mode de création choisi dans Dérush, et ce qu'il demande à l'IA
      mode: MODES[d.mode] ? d.mode : 'montage',
      mode_consigne: MODES[d.mode]?.consigne || null,
      brief: d.brief,
      recette: recette(d.brief.type),
      references: referencesProjet,
      sortie: {largeur: d.sortie.largeur, hauteur: d.sortie.hauteur, ratio: fmt.ratio, fps, duree: temps(seq.duree, fps), images: seq.images},
      statistiques: stats,
      montage: items,
      superpositions,
      indications,
      style,
      habillage,
      sources,
      storyboard: pages,
      kit_remotion: kit ? 'remotion/' : null,
      retours: 'Pour proposer des changements à l’humain, écris retours-ia.json dans ce dossier (format décrit dans LISEZMOI-IA.md) : Dérush les affiche.',
      livraison: {
        plateformes: plateformesVisees(d.brief, d.sortie, d.style?.plateforme),
        son: {lufs: -14, crete_max_dbtp: -1},
        a_verifier: 'Avant de livrer : pas de sous-titres en double sur un plan qui a déjà du texte incrusté ; son à -14 LUFS ; check.py et look.py --safe pour chaque plateforme (compétence ffmpeg-skill si elle est installée). Détails dans LISEZMOI-IA.md.',
      },
      avertissements,
    };
    ecrireJson(path.join(D, 'montage.json'), montage, 2);
    ecrireJson(path.join(D, 'montage.otio'), versOtio(d, seq, items, superpositions, indications), 2);
    if (kit) copierKit(D);
    fs.writeFileSync(path.join(D, 'OUTILS.md'), boiteAOutils({blender: await etatBlender(), elevenlabs: chargerCle()}));
    fs.writeFileSync(path.join(D, 'MOTION.md'), guideMotion());
    fs.writeFileSync(path.join(D, 'LISEZMOI-IA.md'), lisezMoi(montage));
    fs.writeFileSync(path.join(D, 'CLAUDE.md'), claudeMd());
    avance();

    // Le .zip, en plus du dossier (export à la main seulement). S'il échoue (pas de commande zip, disque plein), le
    // dossier du pack, complet, reste là : on prévient, on n'efface rien.
    let zip = null;
    if (d.export.zip && !leger && !pourIA) {
      zip = `${D}.zip`;
      try {
        // lib/plateforme.mjs sait compresser sur chaque système quand il a « compresser » ; sinon, la commande zip
        if (typeof plateforme.compresser === 'function') await plateforme.compresser(D, zip, {sauf: ['remotion/node_modules']});
        else await lancer('zip', ['-r', '-y', '-q', path.basename(zip), path.basename(D), '-x', `${path.basename(D)}/remotion/node_modules/*`], {cwd: path.dirname(D)});
      } catch (e) {
        fs.rmSync(zip, {force: true});
        zip = null;
        avertissements.push(`Le .zip n’a pas pu être fait (${String(e.message).slice(0, 120)}) : le dossier du pack, lui, est complet.`);
      }
    }
    const taille = tailleDossier(D);
    return {dossier: D, nom, zip, taille, taille_lisible: tailleLisible(taille), duree: seq.duree, ...stats, kit, avertissements};
  } catch (e) {
    fs.rmSync(D, {recursive: true, force: true});
    throw e;
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}

/** Copie le kit Remotion ; ses plans sont visibles par un lien relatif (public/plans → ../../plans). */
function copierKit(D) {
  const cible = path.join(D, 'remotion');
  fs.cpSync(KIT, cible, {recursive: true, filter: (src) => path.basename(src) !== 'node_modules'});
  fs.mkdirSync(path.join(cible, 'public'), {recursive: true});
  // le moteur d'habillage est le même fichier que dans l'app : l'aperçu et le rendu dessinent la même chose
  fs.copyFileSync(path.join(PUBLIC, 'moteur.js'), path.join(cible, 'src', 'moteur.js'));
  for (const dossier of ['polices', 'sons']) fs.cpSync(path.join(PUBLIC, dossier), path.join(cible, 'public', dossier), {recursive: true});
  // les bruitages refaits avec ElevenLabs (Réglages) remplacent ceux d'origine : l'aperçu et le rendu sonnent pareil
  for (const f of fs.readdirSync(path.join(cible, 'public', 'sons'))) {
    const e = /\.wav$/.test(f) ? bruitageElevenLabs(path.parse(f).name) : null;
    if (e) fs.copyFileSync(e, path.join(cible, 'public', 'sons', f));
  }
  for (const dossier of ['plans', 'rushes', 'decoupes']) {
    if (fs.existsSync(path.join(D, dossier)) && !lier(path.join('..', '..', dossier), path.join(cible, 'public', dossier))) fs.cpSync(path.join(D, dossier), path.join(cible, 'public', dossier), {recursive: true});
  }
  fs.mkdirSync(path.join(D, 'rendu'), {recursive: true});
}

/** Ce qu'est un fichier de référence, d'après son extension (pour que l'IA choisisse le bon outil). */
function genreReference(nom) {
  const e = path.extname(nom).toLowerCase();
  if (['.blend', '.glb', '.gltf', '.fbx', '.obj', '.usd', '.usdz', '.stl', '.abc', '.dae', '.3ds', '.ply'].includes(e)) return '3d';
  if (/^\.(jpe?g|png|webp|heic|heif|tiff?|bmp|avif|gif|svg|psd|ai|eps)$/.test(e)) return 'image';
  if (/^\.(mp4|mov|m4v|mkv|webm|avi|mxf)$/.test(e)) return 'video';
  if (/^\.(mp3|wav|m4a|aac|aiff?|flac|ogg|opus)$/.test(e)) return 'son';
  if (/^\.(ttf|otf|woff2?)$/.test(e)) return 'police';
  if (/^\.(json|lottie)$/.test(e)) return 'animation';
  if (/^\.(pdf|txt|md|docx?|pages|key|pptx?|csv|xlsx?)$/.test(e)) return 'document';
  return 'autre';
}

/** Une image fixe devenue un plan vidéo de la durée voulue (H.264, côté long ≤ 1920, dimensions paires). */
async function extraireImage(P, m, duree, sortie, fps) {
  const ech = Math.min(1, 1920 / Math.max(m.largeur, m.hauteur));
  const largeur = Math.max(2, Math.round((m.largeur * ech) / 2) * 2);
  const hauteur = Math.max(2, Math.round((m.hauteur * ech) / 2) * 2);
  await ffmpeg(['-y', '-loop', '1', '-framerate', fpsFfmpeg(fps), '-i', fichierLecture(P, m), '-t', duree.toFixed(6),
    '-vf', `scale=${largeur}:${hauteur}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-tune', 'stillimage',
    '-r', fpsFfmpeg(fps), '-movflags', '+faststart', sortie], {duree});
  return {largeur, hauteur};
}

/** Quatre couleurs dominantes d'un plan (les quatre quarts d'une image du milieu), en hexadécimal. */
async function couleursPlan(fichier, t) {
  try {
    const {out} = await lancer(FFMPEG, ['-v', 'error', '-ss', Math.max(0, t).toFixed(3), '-i', fichier, '-frames:v', '1', '-vf', 'scale=2:2:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
    const b = Buffer.from(out);
    if (b.length < 12) return null;
    const hex = [];
    for (let i = 0; i + 2 < 12; i += 3) hex.push(`#${[b[i], b[i + 1], b[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    return [...new Set(hex)];
  } catch {
    return null;
  }
}

/** Applique fn à chaque élément, n à la fois ; les résultats gardent l'ordre de la liste. */
async function enParallele(liste, n, fn) {
  const res = new Array(liste.length);
  let i = 0;
  await Promise.all(Array.from({length: Math.min(n, liste.length)}, async () => {
    while (i < liste.length) { const k = i++; res[k] = await fn(liste[k], k); }
  }));
  return res;
}
/** Largeur et hauteur affichées d'une vidéo (après rotation). */
async function dimensionsVideo(f) {
  try {
    const {out} = await lancer(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]);
    const [largeur, hauteur] = String(out).trim().split(',').map(Number);
    return largeur > 0 && hauteur > 0 ? {largeur, hauteur} : null;
  } catch { return null; }
}

/** Plan exact à l'image près (réencodé), avec ses poignées. */
async function extrairePlan(m, debut, duree, sortie, sf, preset = 'medium') {
  if (m.type === 'video') {
    const sdr = await filtreSdr(m);
    await ffmpeg(['-y', '-ss', debut.toFixed(6), '-i', m.chemin, '-t', duree.toFixed(6), '-map', '0:v:0', '-map', '0:a:0?',
      ...(sdr ? ['-vf', sdr] : []),
      '-c:v', 'libx264', '-preset', preset, '-crf', '16', '-pix_fmt', 'yuv420p', '-r', fpsFfmpeg(sf), '-fps_mode', 'cfr',
      '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', sortie], {duree});
  } else {
    await ffmpeg(['-y', '-ss', debut.toFixed(6), '-i', m.chemin, '-t', duree.toFixed(6), '-map', '0:a:0', '-vn', '-c:a', 'pcm_s16le', '-ar', '48000', sortie], {duree});
  }
}

async function mesurerSon(m, debut, duree) {
  try {
    const {err} = await lancer(FFMPEG, ['-hide_banner', '-nostats', '-ss', debut.toFixed(6), '-i', m.chemin, '-t', duree.toFixed(6), '-map', '0:a:0', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']);
    const I = [...err.matchAll(/I:\s*(-?[0-9.]+) LUFS/g)].pop();
    const pk = [...err.matchAll(/Peak:\s*(-?[0-9.]+) dBFS/g)].pop();
    return {lufs: I ? Number(I[1]) : null, crete: pk ? Number(pk[1]) : null};
  } catch {
    return null;
  }
}

let nTexte = 0;
function fichierTexte(tmp, contenu) {
  const f = path.join(tmp, `t${++nTexte}.txt`);
  fs.writeFileSync(f, contenu);
  return f;
}
/**
 * drawtext avec le texte dans un fichier (aucun souci d'échappement des accents, guillemets, deux-points). Les deux
 * chemins passent par `cheminFiltre` (lib/couleurs.mjs, la même fonction que pour les LUT et l'analyse) : sans elle,
 * sous Windows, « C:/Windows/Fonts/arial.ttf » et le dossier temporaire « C:\Users\… » coupaient le filtre sur leur
 * « : » : plus de storyboard, donc plus de pack, donc plus aucune demande à l'IA.
 */
const ecrire = (fichier, {gras = false, taille = 20, couleur = '0xEDEDED', x = '12', y = '10', boite = ''} = {}) =>
  `drawtext=fontfile=${cheminFiltre(gras ? POLICE_GRAS : POLICE)}:textfile=${cheminFiltre(fichier)}:expansion=none:fontsize=${taille}:fontcolor=${couleur}:x=${x}:y=${y}:line_spacing=6${boite ? `:box=1:boxcolor=${boite}:boxborderw=7` : ''}`;

/** Durée de la piste vidéo d'un fichier (ffprobe), ou à défaut celle du fichier ; null si illisible. */
async function dureeVideo(f) {
  for (const args of [['-select_streams', 'v:0', '-show_entries', 'stream=duration'], ['-show_entries', 'format=duration']]) {
    try {
      const {out} = await lancer(FFPROBE, ['-v', 'error', ...args, '-of', 'csv=p=0', f]);
      const d = Number(String(out).trim().split('\n')[0]);
      if (Number.isFinite(d) && d > 0) return d;
    } catch { /* on essaie la suite */ }
  }
  return null;
}

/** Images d'entrée, de milieu et de sortie d'un plan (ou sa forme d'onde pour un son seul). */
async function triptyque(m, fichierPlan, avant, duree, sf, entree, sortie, tmp) {
  const tcs = [entree, entree + duree / 2, entree + duree - 1 / sf];
  const noms = ['ENTRÉE', 'MILIEU', 'SORTIE'];
  if (m.type === 'video') {
    // Un plan qui va jusqu'au bout du rush : la dernière image demandée peut tomber après la fin de la vidéo
    // (le son dure souvent un peu plus que l'image). On se cale sur la vraie fin de la piste vidéo.
    const fin = await dureeVideo(fichierPlan);
    const essayer = async (recul) => {
      const max = fin ? Math.max(0, fin - 1.5 / sf - recul) : Infinity;
      const pos = [Math.min(avant, max), Math.min(avant + duree / 2, max), Math.min(Math.max(avant, avant + duree - 1 / sf), max)];
      const args = ['-y'];
      for (const p of pos) args.push('-ss', p.toFixed(6), '-i', fichierPlan);
      const f = pos.map((_, k) => `[${k}:v]scale=-2:360,${ecrire(fichierTexte(tmp, `${noms[k]}  ${temps(tcs[k], sf).tc}`), {gras: true, taille: 18, x: '10', y: 'h-th-10', boite: '0x000000@0.65'})}[v${k}]`);
      args.push('-filter_complex', `${f.join(';')};[v0][v1][v2]hstack=inputs=3`, '-frames:v', '1', '-q:v', '3', sortie);
      await ffmpeg(args);
    };
    try { await essayer(0); } catch { await essayer(0.5); }
  } else {
    // la forme d'onde de la partie utile seulement (le fichier peut être le rush entier, ou avoir des poignées)
    await ffmpeg(['-y', '-ss', avant.toFixed(6), '-t', duree.toFixed(6), '-i', fichierPlan, '-filter_complex',
      `[0:a]showwavespic=s=1080x220:colors=0x7dd3fc,format=rgb24,${ecrire(fichierTexte(tmp, `ENTRÉE  ${temps(tcs[0], sf).tc}`), {gras: true, taille: 18, x: '10', y: '10', boite: '0x000000@0.65'})},${ecrire(fichierTexte(tmp, `SORTIE  ${temps(tcs[2], sf).tc}`), {gras: true, taille: 18, x: 'w-tw-10', y: '10', boite: '0x000000@0.65'})}`,
      '-frames:v', '1', '-q:v', '3', sortie]);
  }
}

/** Planches du montage : 16 cases par page (4 × 4), lisibles d'un coup d'œil par une IA. */
async function storyboard(items, D, tmp) {
  const W = 400;
  const HI = 300;
  const HT = 130;
  // quatre cases à la fois, comme les vignettes (une par une, c'était un tiers du temps du pack) ; le nom de chaque
  // carte vient de son rang, pas d'un compteur partagé
  await enParallele(items, 4, async (it, rang) => {
    const out = path.join(tmp, `carte-${String(rang + 1).padStart(4, '0')}.png`);
    const num = typeof it.n === 'number' ? p2(it.n) : it.n;
    const l1 = it.type === 'plan'
      ? `${num} · ${it.id} · ${it.par_dessus ? 'PAR-DESSUS' : 'PLAN'}${it.source.type === 'audio' ? ' (SON SEUL)' : it.source.type === 'image' ? ' (IMAGE)' : ''}`
      : `${num} · ${it.id} · À CRÉER`;
    const l2 = `${it.debut.tc} → ${it.fin.tc}   ${dureeLisible(it.duree.s)}`;
    const corps = it.type === 'plan'
      ? [it.titre, it.texte ? `« ${it.texte} »` : it.notes].filter(Boolean).join(' — ')
      : [it.titre, it.consigne].filter(Boolean).join(' — ');
    const lignes = couperLignes(corps || '—', 38);
    const l3 = lignes.slice(0, 2);
    if (lignes.length > 2) l3[1] = `${l3[1].slice(0, 36)}…`;
    let entree;
    let image;
    // image de la case, puis bandeau de texte ajouté dessous par « pad »
    if (it.type === 'plan' && (it.source.type === 'video' || it.source.type === 'image')) {
      entree = ['-ss', (it.fichier.debut_utile_s + it.duree.s / 2).toFixed(3), '-i', path.join(D, it.fichier.chemin)];
      image = `[0:v]scale=${W}:${HI}:force_original_aspect_ratio=decrease,pad=${W}:${HI}:(ow-iw)/2:(oh-ih)/2:color=black`;
    } else if (it.type === 'plan') {
      entree = ['-ss', it.fichier.debut_utile_s.toFixed(3), '-t', it.duree.s.toFixed(3), '-i', path.join(D, it.fichier.chemin)];
      image = `[0:a]showwavespic=s=${W}x${HI}:colors=0x7dd3fc`;
    } else {
      entree = ['-f', 'lavfi', '-i', `color=c=0x2a2140:s=${W}x${HI}:d=1`];
      image = `[0:v]drawbox=x=8:y=8:w=${W - 16}:h=${HI - 16}:color=0xb39ddb@0.9:t=3,${ecrire(fichierTexte(tmp, 'À CRÉER'), {gras: true, taille: 40, couleur: '0xd1c4e9', x: '(w-tw)/2', y: '(h-th)/2-24'})},${ecrire(fichierTexte(tmp, String(it.genre_lisible)), {taille: 22, couleur: '0xd1c4e9', x: '(w-tw)/2', y: '(h-th)/2+30'})}`;
    }
    const essentiel = it.essentiel ? `,${ecrire(fichierTexte(tmp, 'ESSENTIEL'), {gras: true, taille: 20, couleur: 'black', x: 'w-tw-17', y: '13', boite: '0xffd60a@0.95'})}` : '';
    const badge = ecrire(fichierTexte(tmp, num), {gras: true, taille: 30, couleur: 'white', x: '10', y: '10', boite: it.type === 'bloc' ? '0x5e35b1@0.95' : it.par_dessus ? '0x0a84ff@0.95' : '0xE10600@0.9'});
    await ffmpeg(['-y', ...entree, '-filter_complex',
      `${image},format=rgb24,pad=${W}:${HI + HT}:0:0:color=0x17171f,${badge}${essentiel},${ecrire(fichierTexte(tmp, l1), {gras: true, taille: 19, x: '12', y: `${HI + 10}`, couleur: it.type === 'bloc' ? '0xd1c4e9' : '0xffffff'})},${ecrire(fichierTexte(tmp, l2), {taille: 18, x: '12', y: `${HI + 40}`, couleur: '0x9ad1ff'})},${ecrire(fichierTexte(tmp, l3.join('\n')), {taille: 18, x: '12', y: `${HI + 68}`, couleur: '0xcfcfd6'})}`,
      '-frames:v', '1', out]);
  });
  const pages = [];
  for (let p = 0; p * 16 < items.length; p++) {
    const rel = `storyboard/page-${p2(p + 1)}.jpg`;
    const lignes = Math.ceil(Math.min(16, items.length - p * 16) / 4);
    await ffmpeg(['-y', '-framerate', '1', '-start_number', String(p * 16 + 1), '-i', path.join(tmp, 'carte-%04d.png'), '-frames:v', '1',
      '-vf', `tile=4x${lignes}:padding=14:margin=18:color=0x0c0c11`, '-q:v', '3', path.join(D, rel)]);
    pages.push({fichier: rel, elements: items.slice(p * 16, p * 16 + 16).map((i) => i.id)});
  }
  return pages;
}

const horo = (s, sep) => {
  const ms = Math.max(0, Math.round(s * 1000));
  return `${p2(Math.floor(ms / 3600000))}:${p2(Math.floor(ms / 60000) % 60)}:${p2(Math.floor(ms / 1000) % 60)}${sep}${String(ms % 1000).padStart(3, '0')}`;
};

/** Sous-titres classiques : phrases courtes, 2 lignes de 42 caractères au plus, jamais à cheval sur deux plans. */
function sousTitres(mots) {
  const cues = [];
  let c = null;
  for (const w of mots) {
    if (w.evenement) continue;
    const colle = c && w.plan === c.plan && (/['’]$/.test(c.dernier) || /^['’]/.test(w.t) || /^-\p{L}/u.test(w.t)); // jamais de coupe au milieu d'une élision
    const coupe = !c || w.plan !== c.plan || (!colle && (w.debut - c.fin > 0.55 || `${c.texte} ${w.t}`.length > 84 || w.fin - c.debut > 5.5 || /[.!?…][»”"]?$/.test(c.dernier)));
    if (coupe) {
      if (c) cues.push(c);
      c = {debut: w.debut, fin: w.fin, texte: w.t, dernier: w.t, plan: w.plan};
    } else {
      c.texte += ` ${w.t}`;
      c.fin = w.fin;
      c.dernier = w.t;
    }
  }
  if (c) cues.push(c);
  cues.forEach((q, k) => {
    const suiv = cues[k + 1];
    if (q.fin - q.debut < 0.8) q.fin = suiv ? Math.min(q.debut + 0.8, suiv.debut) : q.debut + 0.8;
    if (suiv && q.fin > suiv.debut) q.fin = suiv.debut;
    q.lignes = couperLignes(texteDesMots(q.texte.split(' ').map((t) => ({t}))), 42);
  });
  return cues;
}

/** Le même montage au format OpenTimelineIO (standard ouvert, lisible par DaVinci Resolve et les outils OTIO). */
function versOtio(d, seq, items, superpositions, indications) {
  const fps = d.sortie.fps;
  const RT = (v, r) => ({OTIO_SCHEMA: 'RationalTime.1', rate: r, value: v});
  const TR = (a, n, r) => ({OTIO_SCHEMA: 'TimeRange.1', start_time: RT(a, r), duration: RT(n, r)});
  const couleur = {texte: 'YELLOW', animation: 'PURPLE', effet: 'MAGENTA', zoom: 'CYAN', musique: 'GREEN', son: 'GREEN', 'sous-titres': 'WHITE', transition: 'ORANGE', note: 'BLUE'};
  const marqueur = (nom, debut, n, coul, commentaire, meta) => ({OTIO_SCHEMA: 'Marker.2', metadata: meta ?? {}, name: nom, color: coul, marked_range: TR(debut, n, fps), comment: commentaire ?? ''});
  const vide = (n, nom = '', meta = {}, marqueurs = []) => ({OTIO_SCHEMA: 'Gap.1', metadata: meta, name: nom, source_range: TR(0, n, fps), effects: [], markers: marqueurs, enabled: true});
  const videItem = (it) => vide(it.duree.images, `${it.id} ${it.titre || ''}`.trim(), {derush: {id: it.id, type: it.type}}, it.type === 'bloc' ? [marqueur(`À créer : ${it.genre_lisible}`, 0, it.duree.images, 'PURPLE', it.consigne)] : []);
  const clip = (it, enabled = true) => {
    const sf = it.source.fps;
    const nDispo = Math.round((it.fichier.poignee_avant_s + it.duree.s + it.fichier.poignee_apres_s) * sf);
    return {
      OTIO_SCHEMA: 'Clip.2', metadata: {derush: {id: it.id, notes: it.notes, tags: it.tags, texte: it.texte, son: it.son, source_originale: {nom: it.source.nom, entree: it.source.entree, sortie: it.source.sortie}}},
      name: `${it.id} ${it.titre || it.source.nom}`.trim(),
      source_range: TR(Math.round(it.fichier.poignee_avant_s * sf), Math.round(it.duree.s * sf), sf),
      effects: [], markers: [], enabled,
      media_references: {DEFAULT_MEDIA: {OTIO_SCHEMA: 'ExternalReference.1', metadata: {}, name: path.basename(it.fichier.chemin), available_range: TR(0, nDispo, sf), available_image_bounds: null, target_url: it.fichier.chemin}},
      active_media_reference_key: 'DEFAULT_MEDIA',
    };
  };
  const piste = (nom, kind, enfants) => ({OTIO_SCHEMA: 'Track.1', metadata: {}, name: nom, source_range: null, effects: [], markers: [], enabled: true, children: enfants, kind});
  const v1 = items.map((it) => (it.type === 'plan' && it.source.type !== 'audio' ? clip(it) : videItem(it)));
  const a1 = items.map((it) => (it.type === 'plan' && (it.source.type === 'audio' || it.fichier.son) ? clip(it, it.son.garder) : videItem(it)));
  // pistes du dessus : des trous entre les plans posés par-dessus
  const dessus = (liste, actif = () => true) => {
    const enfants = [];
    let curseur = 0;
    for (const sp of liste) {
      if (sp.debut.image < curseur) continue; // chevauchement : OTIO n'accepte qu'un plan à la fois par piste
      if (sp.debut.image > curseur) enfants.push(vide(sp.debut.image - curseur));
      enfants.push(clip(sp, actif(sp)));
      curseur = sp.debut.image + sp.duree.images;
    }
    return enfants;
  };
  // les images par-dessus sur une piste vidéo ; les sons par-dessus (la voix off, une musique, et le son d'une vidéo
  // par-dessus qui le garde) sur une piste audio : avant, la voix off arrivait dans Resolve comme un plan vidéo
  const v2 = dessus(superpositions.filter((sp) => sp.source.type !== 'audio'));
  const a2 = dessus(superpositions.filter((sp) => sp.source.type === 'audio' || (sp.fichier.son && sp.son.garder)), (sp) => sp.son.garder);
  const pistes = [piste('Images', 'Video', v1)];
  if (v2.length) pistes.push(piste('Par-dessus', 'Video', v2));
  pistes.push(piste('Son', 'Audio', a1));
  if (a2.length) pistes.push(piste('Son par-dessus', 'Audio', a2));
  return {
    OTIO_SCHEMA: 'Timeline.1', metadata: {derush: {brief: d.brief, sortie: d.sortie}}, name: d.titre, global_start_time: RT(0, fps),
    tracks: {
      OTIO_SCHEMA: 'Stack.1', metadata: {}, name: 'Pistes', source_range: null, effects: [], enabled: true,
      markers: indications.map((i) => marqueur(`${i.id} · ${i.genre_lisible}`, i.debut.image, Math.max(1, i.duree.images), couleur[i.genre] ?? 'BLUE', i.consigne, {derush: {id: i.id, genre: i.genre}})),
      children: pistes,
    },
  };
}

/**
 * Plateformes visées, pour les contrôles avant livraison.
 * Les noms sont ceux que comprennent check.py et look.py de ffmpeg-skill (--platform, --safe).
 */
function plateformesVisees(brief, sortie, choisie = null) {
  // le réseau choisi dans le style de Dérush passe en premier
  if (PLATEFORMES[choisie] && choisie !== 'libre') {
    const autres = plateformesVisees(brief, sortie).liste.filter((x) => x !== choisie);
    return {liste: [choisie, ...(sortie.hauteur > sortie.largeur ? autres.filter((x) => ['tiktok', 'reels', 'shorts'].includes(x)) : [])], d_apres: 'le réseau choisi dans Dérush'};
  }
  const t = String(brief?.plateformes ?? '').toLowerCase();
  const p = [];
  if (/tik\s*-?\s*tok/.test(t)) p.push('tiktok');
  if (/reel|insta/.test(t)) p.push('reels');
  if (/short/.test(t)) p.push('shorts');
  if (/you\s*tube|\byt\b/.test(t.replace(/you\s*tube\s*shorts?/g, ''))) p.push('youtube');
  if (/linked\s*in/.test(t)) p.push('linkedin');
  if (/facebook|\bfb\b/.test(t)) p.push('facebook');
  if (/twitter|\bx\.com\b/.test(t)) p.push('x');
  if (p.length) return {liste: p, d_apres: 'le brief'};
  const r = sortie.largeur / sortie.hauteur;
  if (r < 0.7) return {liste: ['tiktok', 'reels', 'shorts'], d_apres: 'le format vertical : garde celle de la destination'};
  if (r > 1.3) return {liste: ['youtube'], d_apres: 'le format horizontal'};
  return {liste: ['instagram'], d_apres: 'le format carré ou portrait'};
}

/**
 * Les vidéos du projet vues du pack : null s'il n'y en a qu'une, sinon celle qu'il porte (son nom, son rang) et le nom
 * des autres. Le pack ne donne que la vidéo ouverte : les autres sont rangées dans le projet (lib/sequences.mjs).
 */
function videosDuPack(d) {
  const liste = Array.isArray(d.sequences) ? d.sequences.filter((s) => s && typeof s.id === 'string') : [];
  if (liste.length < 2) return null;
  const k = Math.max(0, liste.findIndex((s) => s.id === d.sequence));
  const nom = (s, i) => String(s.nom || `Vidéo ${i + 1}`).slice(0, 80);
  return {id: liste[k].id, nom: nom(liste[k], k), numero: k + 1, sur: liste.length, autres: liste.map((s, i) => (i === k ? null : nom(s, i))).filter(Boolean).slice(0, 50)};
}

function lisezMoi(M) {
  const b = M.brief;
  const s = M.sortie;
  const L = [];
  L.push(`# Pack de montage — ${M.projet.titre}`, '');
  L.push(`> Exporté par ${M.projet.outil} le ${new Date(M.projet.exporte_le).toLocaleString('fr-FR', {dateStyle: 'long', timeStyle: 'short'})}.`);
  const V = M.projet.video;
  if (V) L.push(`> **Ce projet contient ${V.sur} vidéos dans Dérush.** Ce dossier porte « ${V.nom} » (vidéo ${V.numero} sur ${V.sur}) : c’est celle que l’humain a ouverte, et sa demande vaut pour elle, sauf s’il te demande plusieurs vidéos. Les autres : ${V.autres.map((x) => `« ${x} »`).join(', ')}.`);
  if (M.decoupe === 'a_creer') {
    L.push('> **Il n’y a aucun rush.** Tout est à créer : suis la demande de l’humain et le mode du projet (plus bas). La case « Tout est à créer » du tableau ne donne qu’une durée indicative : prends la durée que la demande appelle.');
  } else if (M.decoupe === 'libre') {
    L.push('> **L’humain n’a rien découpé.** Les plans ci-dessous sont ses rushes entiers, dans l’ordre où il les a importés. **Ton travail commence par le dérushage** : regarde et lis tout (`transcriptions/`, `analyse/` pour les silences et les coupes de caméra, `storyboard/`), choisis les meilleurs passages, ordonne-les, raccourcis-les. Puis réalise la vidéo finale : transitions, motion design, effets, titres, sous-titres, musique, mixage. Rien ne t’interdit la 3D (Blender…), les images ou vidéos générées, ou n’importe quel autre outil.', '',
      `> **Pour couper sans te tromper** : écris la liste de tes passages dans un fichier, par exemple \`coupes.json\` (\`[{"plan": "${M.montage.find((x) => x.type === 'plan')?.id ?? 'M1'}", "de": 12.4, "a": 18.9}, …]\`, temps du rush en secondes, dans l’ordre de la vidéo ; ici chaque plan porte le nom de son rush : M1, M2…), puis lance \`node remotion/recouper.mjs coupes.json\`. L’outil refait les plans de \`montage.json\`, recale les sous-titres mot à mot, et le kit monte exactement ces passages. Tu peux le relancer autant de fois que tu veux : il repart toujours des plans d’origine (\`montage.origine.json\`) et garde ce que tu as changé ailleurs dans \`montage.json\` (style, effets, plans par-dessus, notes). Son mode d’emploi est en tête du fichier.`, '');
  } else {
    L.push('> Ce montage est un **squelette** fait par un humain avec Dérush : il donne l’intention (les passages choisis, leur ordre, les durées, les consignes). **Ton travail : réaliser la vidéo finale et l’améliorer** — transitions, motion design, effets, titres, sous-titres, musique, mixage, et tout ce qui la rendra meilleure. Rien ne t’interdit la 3D (Blender…), les images ou vidéos générées, ou n’importe quel autre outil : choisis le meilleur pour chaque moment.', '');
  }
  if (M.mode_consigne) L.push('## Le mode de ce projet', '', M.mode_consigne, '');
  L.push('## Le brief', '');
  const champs = [['Objectif / histoire', b.objectif], ['Public', b.public], ['Ton / style', b.ton], ['Plateformes', b.plateformes], ['Durée visée', b.duree_visee], ['À éviter', b.a_eviter], ['Références', b.references]];
  const remplis = champs.filter(([, v]) => v?.trim());
  if (remplis.length) for (const [k, v] of remplis) L.push(`- **${k}** : ${v.trim().replace(/\n+/g, ' ')}`);
  else L.push('- *(pas de brief écrit : ce que l’humain te demande dans la conversation fait foi. S’il ne précise rien, fais le montage le plus fidèle à ses rushes et à ce qu’il y dit, et dis tes choix à la fin. Ne lui écris pas que son brief était vide.)*');
  if (M.recette) L.push('', recetteEnTexte(M.recette).trimEnd());
  L.push('', '## Format de sortie', '');
  L.push(`- **${s.largeur} × ${s.hauteur}** (${s.ratio}), **${s.fps} images/s**. Langue : ${M.projet.langue}.`);
  L.push(`- Durée du montage : **${s.duree.tc}** (${s.duree.s} s, ${s.images} images).`);
  const st = M.statistiques;
  L.push(`- ${st.plans} plan(s), ${st.cases_a_creer} case(s) à créer, ${st.par_dessus} plan(s) par-dessus, ${st.effets} effet(s) posé(s), ${st.indications} indication(s), ${st.mots_dits} mots dits.`, '');
  L.push('## Comment lire ce squelette', '');
  L.push('1. **Garde l’intention.** Les plans marqués `essentiel: true` doivent rester (tu peux affiner leurs bords d’une image ou deux). Les autres sont des propositions : tu peux les resserrer, les réordonner, en retirer ou en ajouter si ça sert le brief. Les points de coupe sont précis à l’image près : pars d’eux.');
  L.push('   Pour un changement important de découpe, explique-le dans `retours-ia.json` (voir plus bas) : l’humain le verra dans Dérush et pourra l’appliquer d’un clic.');
  L.push('2. **Plans** (`type: "plan"`) : utilise le fichier de `plans/`. Pour une vidéo ou un son, c’est le **rush entier** (pour une vidéo, parfois sa version de montage : HDR ou Log déjà convertis), partagé par tous les plans de ce rush : la partie utile du plan va de `fichier.debut_utile_s` à `fichier.fin_utile_s` (temps dans ce fichier), tout le reste sert de poignées (transitions, débordements du son). **N’écris jamais dans `plans/`** : ce sont les rushes de l’humain (certains sont des liens vers ses fichiers d’origine) ; écris tes fichiers dans `rendu/` ou `atelier/`. Une **image fixe** (`guide.image_fixe`) est fournie en plan vidéo de la bonne durée et en original pleine qualité (`fichier.image_originale`) : anime-la librement (zoom lent, parallaxe, 3D…).');
  L.push('3. **Cases à créer** (`type: "bloc"`) : des emplacements réservés dans le temps. Crée leur contenu (scène, titre, animation, **3D**, carte, image générée…) d’après la `consigne` et les `fichiers_reference`, sur la durée indiquée (elle peut bouger si le rythme le demande).');
  L.push('4. **Plans par-dessus** (`superpositions`) : posés au-dessus du montage, de `debut` à `fin`, sans changer sa durée. `cadre: "plein"` = plein écran, `"incrustation"` = petite fenêtre. Un son posé par-dessus (une musique, une voix) s’entend sans rien cacher. **`voix_off: true` = la voix off de l’humain** : c’est le fil du film, garde-la entière et dans l’ordre ; tu peux la nettoyer, la sous-titrer et remonter les images sur ce qu’elle dit.');
  L.push('5. **Indications** : des consignes posées par-dessus le montage, de `debut` à `fin` (texte à l’écran, zoom, musique, effet…). Elles ne changent pas la durée. Les effets déjà posés et dessinés par le kit sont à part, dans « Habillage déjà posé ».');
  L.push('6. **Son** : `son.garder: false` = couper le son d’origine ; `son.gain_db` = volume demandé ; `son.version` = `original`, `voix` (voix seule, fichier `fichier.voix`), `fond` (tout sauf la voix, `fichier.fond`) ou `clair` (la voix nettoyée par Dérush, `fichier.clair`). `son.avant_s` / `son.apres_s` : le son commence avant l’image (J-cut) ou continue après (L-cut) ; `son.debut` / `son.fin` donnent son étendue exacte.');
  L.push(`7. **Recadrage** : quand le rush n’a pas le format de la sortie, \`cadrage.points\` donne le sujet (visage d’abord) au fil du temps, avec la \`fenetre\` à découper dans l’image. Interpole entre les points, sauf aux points marqués \`coupe\`.`);
  L.push('8. **Sous-titres** : prêts dans `sous-titres/` (temps du montage). `mots.json` donne chaque mot avec son temps et ses numéros d’image.');
  L.push(`9. **Temps** : en secondes depuis le début du montage, avec le numéro d’**image** à ${s.fps} i/s et le **timecode** \`HH:MM:SS:II\`. Les temps \`source\` sont ceux du rush d’origine.`);
  L.push('10. Regarde `storyboard/` pour la vue d’ensemble et `vignettes/` pour les images exactes d’entrée et de sortie de chaque plan.');
  L.push('11. **Indices pour guider ton montage** (`guide` de chaque plan) : `debit_parole_mots_par_s` (rythme de la parole), `part_avec_visage` (0 à 1), `couleurs_dominantes` (pour accorder titres et motion design à l’image). Dans `sources` : appareil et date de tournage, codec, coupes de caméra, visages repérés.');
  L.push('12. **Références** : les fichiers donnés par l’humain sont dans `references/` (`projet/` pour tout le film, `<id de la case>/` pour une case) : images d’ambiance, modèles 3D (`.blend`, `.glb`…), logos, polices, documents. Sers-t’en.', '');
  L.push('## Outils', '');
  L.push('Utilise ce qui donne le meilleur résultat : le kit Remotion fourni pour assembler, Blender pour la 3D (les `.blend` et `.glb` des références s’ouvrent directement), un générateur d’images ou de vidéos pour les cases « générée par IA », FFmpeg pour les traitements et les contrôles (avec la compétence ffmpeg-skill si elle est installée). Rends les éléments créés dans `rendu/` (ou un dossier voisin) et assemble le tout à la fin.', '');
  if (M.kit_remotion) {
    L.push('## Kit de départ Remotion', '');
    L.push('`remotion/` contient un projet Remotion qui monte déjà ce pack fidèlement : plans, son (avec J-cut et L-cut), recadrage, plans par-dessus, cases à créer en violet, **et tout l’habillage posé dans Dérush** (transitions, titres, sous-titres, grain, bruitages). Si `remotion/node_modules` est déjà là (Dérush l’a relié à son moteur de rendu), le kit est prêt : n’y lance jamais `npm install`, tu écrirais dans le moteur partagé par tous les projets. Sinon (un pack ouvert hors de Dérush), lance `npm install` une fois dans `remotion/`. Remplace les cases par les vraies scènes et ajoute ce qui manque dans `remotion/src/Montage.tsx`, sans toucher aux temps. Rends toujours avec `node remotion/rendre.mjs <Composition> <sortie.mp4>` (la vidéo à livrer : `node remotion/rendre.mjs Montage rendu/final.mp4`) : Dérush montre ce rendu en direct à l’humain, image par image. Les cases violettes « À créer » et les notes jaunes de l’humain sont des repères de travail : `rendre.mjs` ne les dessine pas dans la vidéo, `images.mjs` les montre. Pour regarder avant de tout rendre : `node remotion/images.mjs --de 0 --a 10 --pas 10` (des images fixes en pleine taille et une planche, dans `atelier/images/`).', '');
  }
  // l'habillage posé dans Dérush : ce que le kit dessine déjà
  const h = M.habillage;
  const sty = M.style;
  L.push('## Habillage déjà posé', '');
  L.push('Le kit dessine déjà tout ceci, avec le même moteur que l’aperçu de Dérush (`remotion/src/moteur.js`). C’est une base : garde ce qui sert la vidéo, règle le reste, ajoute mieux.', '');
  L.push(`- **Style « ${sty.look} »** : sous-titres ${sty.sous_titres.style === 'aucun' ? 'désactivés' : `« ${sty.sous_titres.style} »`}, couleur ${sty.accent}, titres en ${sty.police_titres}, textes en ${sty.police_textes}${sty.transition_auto !== 'aucune' ? `, transition « ${sty.transition_auto} » sur chaque coupe sans effet` : ''}${sty.grain > 0 ? `, grain ${sty.grain}` : ''}${sty.vignette > 0 ? `, bords sombres ${sty.vignette}` : ''}${sty.bandes ? ', bandes noires' : ''}${sty.barre ? ', barre de progression' : ''}. Réseau visé : ${sty.plateforme} (les textes restent hors des zones que son interface recouvre).`);
  if (h.sans_sous_titres.length) L.push(`- Plans sans sous-titres ajoutés (ils ont déjà du texte incrusté) : ${cellule(h.sans_sous_titres.join(', '))}.`);
  if (h.effets.length) {
    L.push('', '| ID | Effet | Début → fin | Sur | Réglages |', '|---|---|---|---|---|');
    for (const e of h.effets) L.push(`| ${cellule(e.id)} | ${cellule(e.nom)} | ${e.debut.tc} → ${e.fin.tc} | ${cellule(e.elements_concernes.join(', '))} | ${cellule(Object.entries(e.reglages).filter(([, v]) => v !== '' && v !== true).map(([k, v]) => `${k} : ${v}`).join(' · '))} |`);
  } else L.push('- Aucun effet posé à la main.');
  L.push('', 'Pour changer l’habillage : modifie `style` et `habillage.effets` dans `montage.json` (le catalogue des effets et de leurs réglages est dans `habillage.catalogue`), puis relance le rendu. Pour proposer un effet à l’humain sans l’imposer, écris-le dans `retours-ia.json` (type `effet`).', '');
  const pv = M.livraison.plateformes;
  const plusieurs = pv.liste.length > 1;
  // les contrôles portent sur la vidéo livrée (rendu/final.mp4), pas sur un rendu brut du kit
  const video = M.kit_remotion ? 'rendu/final.mp4' : 'rendu/<vidéo>.mp4';
  L.push('## Vérifier avant de livrer', '');
  L.push(`Plateforme${plusieurs ? 's' : ''} visée${plusieurs ? 's' : ''} : ${pv.liste.map((x) => `\`${x}\``).join(', ')} (d’après ${pv.d_apres}). Si la compétence **ffmpeg-skill** est installée (scripts dans \`.claude/skills/ffmpeg-skill/scripts/\` ou \`~/.claude/skills/ffmpeg-skill/scripts/\`), fais ces contrôles avec ses outils ; sinon, fais les mêmes mesures avec \`derush-son mesurer\` et FFmpeg. Ne cherche jamais un outil sur tout le disque (\`find /\` prend des minutes).`, '');
  L.push(`0. **Le contrôle de Dérush** : \`derush-controle ${video}\` (sur Mac ; \`derush-controle --help\` dit tout). Il lit chaque image et signale les **mots collés** (un contour épais mange l’espace : « cettecollection »), le **texte coupé** au bord de l’image et le texte **caché par l’interface** du réseau (\`a_corriger\` : on ne livre pas tant qu’il en reste un). Il juge aussi l’**accroche** (le plus grand texte des 2 premières secondes), la **voix** (ses aigus) et le **rythme** (Whisper réécoute : pauses qui traînent, « euh », redites) : \`a_regarder\`, à trancher toi-même en le voyant, et à dire à l’humain. La planche des images en cause est dans \`rendu/controle/\`. Regarde aussi 4 images en pleine taille (titres, sous-titres, carton de fin) : la typographie se juge à 100 %.`);
  L.push(`1. **Pas de sous-titres en double.** Avant d’en incruster, regarde \`vignettes/\` et \`storyboard/\` : un plan qui a déjà du texte incrusté (sous-titres, titres, par exemple un épisode déjà monté) n’en reçoit pas d’autres. ${M.kit_remotion ? 'Dans le kit, ajoute son ID à `PLANS_SANS_SOUS_TITRES`, dans `remotion/src/reglages.ts` (ceux cochés dans Dérush sont déjà pris en compte, par `habillage.sans_sous_titres` de `montage.json`). ' : ''}Si tu te sers de \`sous-titres/montage.srt\`, retires-en les lignes qui tombent sur ce plan.`);
  L.push(`2. **Son** : ${M.livraison.son.lufs} LUFS intégrés, crête vraie à ${M.livraison.son.crete_max_dbtp} dBTP au plus (\`loudness.py\`).`);
  L.push(`3. **Conformité** : \`check.py ${video} --platform <plateforme>\` pour chaque plateforme (avec plusieurs vidéos : chacune de \`rendu/livraison/\`) ; corrige chaque FAIL et signale les WARN.`);
  L.push(`4. **Zones cachées par l’interface** : \`look.py ${video} --tiles 3x2 --safe <plateforme>\`, puis regarde la planche : ni texte important ni visage sous les boutons de la plateforme, aucun sous-titre en double.`);
  L.push('5. Dis à l’humain ce que tu as vérifié, avec les chiffres mesurés, et ce qui reste à voir.', '');
  L.push('## Livrer plusieurs vidéos', '');
  L.push('Une seule vidéo : rends-la dans `rendu/final.mp4`.', '');
  L.push('Plusieurs vidéos (plusieurs clips tirés des rushes, plusieurs formats, plusieurs langues, plusieurs variantes) :', '');
  L.push('1. Une composition par vidéo dans `remotion/src/Root.tsx` (ou la même composition avec d’autres `inputProps`), aux bonnes dimensions et à la bonne durée.');
  L.push('2. Rends chacune dans `rendu/livraison/` : `node remotion/rendre.mjs Clip1 rendu/livraison/clip-1.mp4 --titre "Le titre court"`. L’humain les voit se rendre en direct, l’une après l’autre.');
  L.push('3. Écris `rendu/livraison/livraison.json`, dans l’ordre voulu : `[{"fichier": "clip-1.mp4", "titre": "Le titre court", "description": "Une phrase sur ce clip", "coupes": [{"plan": "M1", "de": 12.4, "a": 18.9}]}]`.');
  L.push('   `coupes` : les passages de la vidéo, dans l’ordre (le format de `coupes.json` pour `recouper.mjs` : l’id du plan, temps du rush en secondes ; `{"case": "B1"}` pour une case à créer). Avec eux, l’humain peut mettre chaque vidéo dans sa timeline de Dérush, plan par plan, et la retoucher ; sans eux, elle n’y entre que comme un seul fichier.');
  L.push('4. Vérifie chaque vidéo comme ci-dessus. Dérush les récupère toutes ; à chaque nouvelle demande, remplace ce que tu avais livré.', '');
  L.push('## Le montage, élément par élément', '');
  L.push('| # | ID | Type | Début → fin | Durée | Source (entrée → sortie) | Titre, consigne, notes | Ce qui est dit |');
  L.push('|---|---|---|---|---|---|---|---|');
  const descSon = (it) => [it.son.garder ? '' : 'son coupé', it.son.gain_db ? `son ${it.son.gain_db > 0 ? '+' : ''}${it.son.gain_db} dB` : '', it.son.version !== 'original' ? (NOMS_VERSIONS[it.son.version] ?? it.son.version) : '', it.son.avant_s ? `son ${it.son.avant_s} s avant (J-cut)` : '', it.son.apres_s ? `son ${it.son.apres_s} s après (L-cut)` : ''];
  for (const it of M.montage) {
    if (it.type === 'plan') {
      const quoi = [it.titre, it.notes, it.tags?.length ? `#${it.tags.join(' #')}` : '', ...descSon(it), it.cadrage ? 'recadrage auto' : ''].filter(Boolean).join(' · ');
      const genre = it.source.type === 'audio' ? ' (son seul)' : it.source.type === 'image' ? ' (image fixe)' : '';
      L.push(`| ${it.n} | ${cellule(it.id)} | plan${genre}${it.essentiel ? ' **★ essentiel**' : ''} | ${it.debut.tc} → ${it.fin.tc} | ${arrondi(it.duree.s, 3)} s · ${it.duree.images} im. | ${cellule(it.source.nom)}${it.source.type === 'image' ? '' : ` ${it.source.entree.tc} → ${it.source.sortie.tc}`} | ${cellule(quoi)} | ${cellule(it.texte ? `« ${it.texte.length > 200 ? `${it.texte.slice(0, 200).replace(/\s+\S*$/, '')}…` : it.texte} »` : '')} |`);
    } else {
      const refs = (it.fichiers_reference ?? []).map((r) => `\`${r.chemin}\``).join(', ');
      L.push(`| ${it.n} | ${cellule(it.id)} | **case à créer** (${it.genre_lisible}) | ${it.debut.tc} → ${it.fin.tc} | ${arrondi(it.duree.s, 3)} s · ${it.duree.images} im. | — | ${cellule([it.titre, it.consigne, it.references, refs ? `réf. : ${refs}` : ''].filter(Boolean).join(' · '))} | — |`);
    }
  }
  if (M.superpositions.length) {
    L.push('', '## Plans par-dessus', '');
    L.push('| ID | Début → fin | Durée | Cadre | Source (entrée → sortie) | Sur | Titre, notes, son |', '|---|---|---|---|---|---|---|');
    for (const x of M.superpositions) L.push(`| ${cellule(x.id)} | ${x.debut.tc} → ${x.fin.tc} | ${arrondi(x.duree.s, 3)} s | ${x.cadre} | ${cellule(x.source.nom)} ${x.source.entree.tc} → ${x.source.sortie.tc} | ${cellule(x.sur.join(', '))} | ${cellule([x.titre, x.notes, x.son.garder ? 'avec son' : 'sans son'].filter(Boolean).join(' · '))} |`);
  }
  if (M.indications.length) {
    L.push('', '## Indications (par-dessus le montage)', '');
    L.push('| ID | Genre | Début → fin | Durée | Sur | Consigne |', '|---|---|---|---|---|---|');
    for (const i of M.indications) L.push(`| ${cellule(i.id)} | ${i.genre_lisible} | ${i.debut.tc} → ${i.fin.tc} | ${arrondi(i.duree.s, 3)} s · ${i.duree.images} im. | ${cellule(i.elements_concernes.join(', '))} | ${cellule(i.consigne)} |`);
  }
  L.push('', '## Sources (rushes)', '');
  L.push('Tous les médias de l’humain sont là, **même ceux qui ne sont pas dans sa timeline** (« disponible ») : la section Médias de Dérush, c’est sa matière ; la timeline, c’est son intention. Prends un rush disponible s’il sert mieux la vidéo.', '');
  if (M.sources.some((x) => x.analyse_ia)) L.push('**L’humain a fait analyser ses rushes** : `sources[].analyse_ia` dans `montage.json` dit ce que chacun contient, ses meilleurs moments (temps source) et ses défauts. Pars de là au lieu de tout revoir depuis le début ; ne regarde en détail que ce dont tu as besoin.', '');
  L.push('| ID | Fichier | Type | Durée | Image | Utilisé | Transcription | Son | Ce que Dérush a vu |', '|---|---|---|---|---|---|---|---|---|');
  for (const x of M.sources) L.push(`| ${x.id} | ${cellule(x.nom)}${x.tournage?.appareil ? ` (${cellule(x.tournage.appareil)})` : ''} | ${x.type === 'video' ? 'vidéo' : x.type === 'image' ? 'image' : 'son'} | ${x.duree?.tc ?? '—'} | ${x.largeur ? `${x.largeur}×${x.hauteur}${x.fps ? ` ${x.fps} i/s` : ''}${x.hdr ? ' HDR' : ''}${x.couleur_camera ? ` Log ${x.couleur_camera.profil} converti` : ''}` : '—'} | ${x.utilise ? 'oui' : 'non (disponible)'} | ${x.transcription ? `\`${x.transcription}\`` : 'aucune'} | ${[x.lufs != null ? `${x.lufs} LUFS` : null, x.voix_isolee ? 'voix isolée' : null, x.voix_claire ? 'voix claire faite' : null].filter(Boolean).join(', ') || '—'} | ${cellule([x.analyse_ia?.resume, ...(x.mesures?.defauts ?? [])].filter(Boolean).join(' ; ').slice(0, 260))} |`);
  if (M.references?.length) {
    L.push('', '## Références pour tout le film', '');
    for (const r of M.references) L.push(`- \`${r.chemin}\` (${r.genre})`);
  }
  L.push('', '## Contenu du pack', '');
  L.push('- `montage.json` — tout le montage en données exactes (à lire en priorité).');
  L.push('- `montage.otio` — le même montage au format OpenTimelineIO (DaVinci Resolve et outils OTIO).');
  L.push('- `plans/` — les rushes entiers (un fichier par rush, lu tel quel par le kit : une vidéo en H.264 ou HEVC, ou sa version de montage en H.264 ; un son en m4a, mp3, wav ou flac), les sons d’un format plus rare (WAV 48 kHz, coupés avec leurs poignées), les images ; `-voix`, `-fond` et `-clair` quand la voix a été isolée ou nettoyée (FLAC pour un rush entier, WAV pour un son coupé). Lecture seule.');
  L.push('- `vignettes/` — images d’entrée, de milieu et de sortie de chaque plan (ou forme d’onde pour un son seul).');
  L.push(`- \`storyboard/\` — ${M.storyboard.length} planche(s) de tout le montage, 16 cases par page.`);
  L.push('- `sous-titres/` — `montage.srt`, `montage.vtt` et `mots.json` (mot à mot), en temps du montage.');
  L.push('- `transcriptions/` — transcription mot à mot de chaque rush, en temps source.');
  L.push('- `analyse/` — coupes de caméra, silences, volume et recadrage de chaque rush, en temps source, et ce qui y est déjà incrusté (`incrustes` : images noires, transitions rapides d’une appli, son coupé net, logo, texte lu à l’image). Les mesures de l’image et du son (exposition, dominante, Log, bruit de fond, voix étouffée, écho) et l’analyse de l’IA, quand elle a été faite, sont dans `sources[]` de `montage.json`.');
  if (M.kit_remotion) L.push('- `remotion/` — kit de rendu Remotion, avec le moteur d’habillage, les polices et les bruitages ; `rendu/` reçoit les vidéos rendues.');
  if (M.montage.some((x) => x.fichier?.masques)) L.push('- `decoupes/` — la personne détourée image par image (WebP avec transparence), pour les titres qui passent derrière elle.');
  L.push('- `OUTILS.md` — la boîte à outils : quel outil prendre pour la 3D, la physique, les shaders, la voix… et comment le brancher sur le kit.');
  L.push('- `MOTION.md` — bien animer : le rythme, le texte, les transitions, la fin, le son, et ce qui trahit une vidéo faite par une machine. À lire avant d’ajouter du motion design.');
  if (M.sources.some((x) => x.fichier_complet)) L.push('- `rushes/` — les rushes complets.');
  L.push('', '## Proposer des changements à l’humain : `retours-ia.json`', '');
  L.push('Écris ce fichier à la racine du pack. Dérush l’affiche dans la chronologie ; l’humain applique ou ignore chaque proposition d’un clic.', '');
  if (M.decoupe === 'libre') L.push('Ici, l’humain n’a encore rien posé dans sa timeline : `rogner`, `deplacer`, `supprimer` et `consigne` n’y trouveraient pas leur plan. Ta découpe (celle de `recouper.mjs`) lui est proposée d’un clic dans Dérush ; garde ce fichier pour les notes, les questions, les effets, le style et les indications.', '');
  L.push('```json');
  L.push(JSON.stringify({
    _format: 'derush-retours', _version: 1, auteur: 'Claude', message: 'Résumé en une phrase.',
    propositions: [
      {id: 'R1', type: 'rogner', cible: 'P3', entree_s: 12.4, sortie_s: 15.0, pourquoi: 'La phrase se termine à 15 s.'},
      {id: 'R2', type: 'deplacer', cible: 'B1', position: 0, pourquoi: 'Le titre accroche mieux au début.'},
      {id: 'R3', type: 'supprimer', cible: 'P5', pourquoi: 'Redite de P2.'},
      {id: 'R4', type: 'consigne', cible: 'B2', consigne: 'Carte du Val-d’Oise animée.', pourquoi: 'La case n’avait pas de consigne.'},
      {id: 'R5', type: 'indication', debut_s: 3.0, fin_s: 5.0, genre: 'texte', consigne: 'Nom à l’écran.', pourquoi: 'Présenter la personne.'},
      {id: 'R6', type: 'effet', modele: 'titre-derriere', debut_s: 3.7, fin_s: 6.5, reglages: {texte: 'SHIBUYA', sous_titre: 'TOKYO · JAPON'}, pourquoi: 'Le lieu, derrière la personne.'},
      {id: 'R7', type: 'style', style: {transition_auto: 'zoom', grain: 0.3}, pourquoi: 'Un coup de zoom sur chaque coupe, calé sur la musique.'},
      {id: 'R8', type: 'question', cible: 'B2', texte: 'Quelle ambiance pour la carte ?'},
    ],
  }, null, 2));
  L.push('```', '');
  L.push('Types : `rogner` (entree_s / sortie_s en temps source), `deplacer` (position = rang dans le montage, à partir de 0), `supprimer`, `consigne` (pour une case ou un plan), `indication` (temps du montage), `effet` (un effet du catalogue, en temps du montage), `style` (les réglages du style à changer), `question` et `note` (texte libre).');
  if (M.avertissements.length) {
    L.push('', '## Points d’attention', '');
    for (const a of M.avertissements) L.push(`- ${a}`);
  }
  L.push('');
  return L.join('\n');
}

function claudeMd() {
  return [
    '# Pack de montage Dérush',
    '',
    'Ce dossier contient un montage préparé par un humain avec Dérush, à finir par toi.',
    '',
    '1. Lis `LISEZMOI-IA.md` : le brief, l’esprit du squelette et le tableau du montage.',
    '2. Les données exactes sont dans `montage.json` ; regarde `storyboard/` pour la vue d’ensemble et `references/` pour les fichiers donnés.',
    '3. Si `montage.json` dit `decoupe: "a_creer"`, il n’y a aucun rush : tout est à créer, d’après la demande et le mode du projet. Si c’est `decoupe: "libre"`, l’humain n’a rien découpé : choisis toi-même les meilleurs passages des rushes. Sinon c’est un squelette : garde les plans « essentiel » et l’intention du brief, puis améliore librement (rythme, transitions, 3D avec Blender, images générées, motion design).',
    '   Pour choisir, resserrer ou réordonner des passages : écris ta liste de coupes et lance `node remotion/recouper.mjs coupes.json`. Il refait `montage.json` et recale les sous-titres (mode d’emploi en tête du fichier).',
    '4. Pars du kit `remotion/` s’il est là : le montage, le son et l’habillage posé dans Dérush (transitions, titres, sous-titres) y sont déjà. `OUTILS.md` dit quel outil prendre pour aller plus loin (la 3D et l’animation sont déjà installées), et `MOTION.md` comment bien animer.',
    '5. Avant de produire la vidéo, écris ton plan (passages gardés, structure, habillage, musique) dans `coupes.json` et `rendu/timeline.json`. Si l’humain peut te répondre et que sa demande ne tranche pas tout, présente-le-lui ; si tu travailles seul (lancé par Dérush), avance, et dis tes choix à la fin. Travaille avec « La méthode » de `MOTION.md`.',
    '6. Pour un changement important de découpe, explique-le dans `retours-ia.json` (format dans `LISEZMOI-IA.md`) : l’humain l’appliquera d’un clic dans Dérush.',
    '7. Avant de livrer, vérifie la vidéo (« Vérifier avant de livrer » dans `LISEZMOI-IA.md`) : `derush-controle` sans rien à corriger (mots collés, texte coupé ou caché) et chaque point à regarder tranché (accroche, voix, rythme), pas de sous-titres en double sur un plan qui a déjà du texte incrusté, son à -14 LUFS, contrôle et planche de chaque plateforme, avec la compétence ffmpeg-skill si elle est installée.',
    '8. Si `contexte/` existe, c’est ce que l’humain t’a donné (références, charte graphique, logo, polices, vidéos, archives, créations ElevenLabs) : lis `contexte/INDEX.md` avant de commencer.',
    '9. Rends avec `node remotion/rendre.mjs <Composition> <sortie.mp4>` : Dérush montre le rendu en direct. Une vidéo : `rendu/final.mp4` ; plusieurs : `rendu/livraison/` et `livraison.json` (« Livrer plusieurs vidéos » dans `LISEZMOI-IA.md`).',
    '10. `CARNET.md`, s’il est là : ce que les montages précédents ont appris (les rushes de cette personne, ses goûts, les pièges des outils). À la fin, écris dans `carnet-ia.md` ce que celui-ci t’a appris d’utile (1 à 5 lignes « - … ») : Dérush le garde pour la prochaine fois.',
    '',
  ].join('\n');
}
