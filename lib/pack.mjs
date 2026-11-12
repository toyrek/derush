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
import {filtreSdr, fichierSon, fichierLecture} from './medias.mjs';
import {CATALOGUE, PLATEFORMES, reglagesDe, resumeEffet, styleComplet} from '../public/moteur.js';
import {decoupesFichier} from './detourage.mjs';
import {recette, recetteEnTexte, boiteAOutils, guideMotion} from './recettes.mjs';
import {etatBlender} from './moteurs.mjs';
import {chargerCle, bruitageElevenLabs} from './elevenlabs.mjs';
import {lier} from './plateforme.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(ICI, '..', 'modeles', 'kit-remotion');
const PUBLIC = path.join(ICI, '..', 'public');
const p2 = (n) => String(n).padStart(2, '0');
const cellule = (t) => String(t ?? '').replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ').trim() || '—';

/** Cadence au format attendu par FFmpeg (les cadences NTSC restent exactes). */
function fpsFfmpeg(f) {
  for (const [v, txt] of [[24000 / 1001, '24000/1001'], [30000 / 1001, '30000/1001'], [60000 / 1001, '60000/1001'], [120000 / 1001, '120000/1001']]) if (Math.abs(f - v) < 0.01) return txt;
  return String(arrondi(f, 4));
}

/**
 * Options : `leger` — seulement ce qu'il faut au rendu intégré (« Créer la vidéo ») : ni vignettes, ni storyboard, ni zip ;
 * `dossier` — où écrire le pack (par défaut exports/<titre>-pack-<date> dans le projet).
 */
export async function exporterPack(P, prog = () => {}, {leger = false, dossier = null} = {}) {
  let d = P.d;
  // Rien n'a été découpé : l'IA reçoit les rushes entiers, dans l'ordre où ils ont été importés, et choisit elle-même
  // les passages. (Le projet n'est pas modifié : ce montage ne sert qu'au pack.)
  const decoupeLibre = !d.montage.length && d.medias.length > 0;
  if (decoupeLibre) {
    d = {...d, montage: d.medias.map((m, k) => ({
      id: `P${k + 1}`, type: 'plan', media: m.id, entree: 0, sortie: m.type === 'image' ? 3 : m.duree, titre: '', notes: '', tags: [],
      son: {actif: true, gain_db: 0, version: 'original', avant_s: 0, apres_s: 0},
    }))};
  }
  // Rien du tout (mode motion design, ou seulement des pièces jointes) : une seule case « à créer », de la durée visée.
  // Elle dit à l'IA que tout est à inventer ; sa durée n'est qu'indicative. (Le projet n'est pas modifié.)
  const toutACreer = !leger && !d.montage.length && !d.medias.length;
  if (toutACreer) {
    const vise = /(\d+(?:[.,]\d+)?)\s*(min|s)?/i.exec(d.brief?.duree_visee ?? '');
    const duree = vise ? Math.min(600, Math.max(3, parseFloat(vise[1].replace(',', '.')) * (/^min/i.test(vise[2] ?? '') ? 60 : 1))) : 20;
    d = {...d, montage: [{id: 'B1', type: 'bloc', genre: 'animation', duree, titre: 'Tout est à créer', consigne: 'Aucun rush : crée toute la vidéo, d’après la demande et le mode du projet. La durée de cette case est indicative.', references: ''}]};
  }
  const fps = d.sortie.fps;
  const seq = sequence(d);
  if (!seq.segs.length) throw new Error('Il n’y a encore rien à envoyer : importe au moins une vidéo, un son ou une photo.');
  const maintenant = new Date();
  const horodatage = `${maintenant.getFullYear()}${p2(maintenant.getMonth() + 1)}${p2(maintenant.getDate())}-${p2(maintenant.getHours())}${p2(maintenant.getMinutes())}${p2(maintenant.getSeconds())}`;
  const nom = `${slug(d.titre) || 'montage'}-pack-${horodatage}`;
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
    const motsMontage = [];

    /** Exporte un plan (du montage ou posé par-dessus) : fichier exact, versions du son, vignettes, mots, recadrage. */
    async function exporterPlan(it, deb, fin, prefixe) {
      const m = medias.get(it.media);
      const fixe = m.type === 'image';
      const sf = fixe ? fps : fpsSource(m, d);
      const {avant: jAvant, apres: lApres} = debordements(it);
      const H = fixe ? 0 : Math.max(d.export.poignees_s ?? 0.5, jAvant, lApres);
      const avant = Math.min(H, it.entree);
      const apres = Math.min(H, Math.max(0, m.duree - it.sortie));
      const dureeUtile = fin - deb;
      const base = `plans/${prefixe}-${it.id}-${slug(it.titre || path.parse(m.nom).name, 30) || 'plan'}`;
      const rel = `${base}.${m.type === 'audio' ? 'wav' : 'mp4'}`;
      let image = null;
      let dimsImage = null;
      if (fixe) {
        // une image fixe : l'original (pleine qualité) et un plan vidéo de la bonne durée, prêt à monter
        image = `${base}${path.extname(m.chemin).toLowerCase() || '.jpg'}`;
        fs.copyFileSync(m.chemin, path.join(D, image));
        dimsImage = await extraireImage(P, m, dureeUtile, path.join(D, rel), fps);
      } else await extrairePlan(m, it.entree - avant, avant + dureeUtile + apres, path.join(D, rel), sf, decoupeLibre ? 'veryfast' : 'medium');
      if (m.hdr) hdr.add(m.nom);
      // versions du son séparées par Demucs (si le rush a été traité)
      const versions = {};
      for (const v of ['voix', 'fond']) {
        const f = fichierSon(P, m, v);
        if (f) {
          versions[v] = `${base}-${v}.wav`;
          await ffmpeg(['-y', '-ss', (it.entree - avant).toFixed(6), '-i', f, '-t', (avant + dureeUtile + apres).toFixed(6), '-c:a', 'pcm_s16le', '-ar', '48000', path.join(D, versions[v])]);
        }
      }
      if (it.son?.version && it.son.version !== 'original' && !versions[it.son.version]) avertissements.push(`${it.id} demande « ${it.son.version === 'voix' ? 'voix seule' : 'sans la voix'} » mais la voix de « ${m.nom} » n'a pas été isolée : le son d'origine est fourni.`);
      avance();
      const mesure = m.audio ? await mesurerSon(m, it.entree, dureeUtile) : null;
      let vignette = null;
      if (POLICE && !leger) {
        vignette = `vignettes/${prefixe}-${it.id}.jpg`;
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
      return {
        mots,
        donnees: {
          source: {id: m.id, nom: m.nom, type: m.type, entree: temps(it.entree, sf), sortie: temps(it.sortie, sf), fps: sf},
          fichier: {
            chemin: rel, debut_utile_s: arrondi(avant), fin_utile_s: arrondi(avant + dureeUtile),
            poignee_avant_s: arrondi(avant), poignee_apres_s: arrondi(apres),
            ...(m.type === 'audio' ? {frequence_hz: 48000} : {largeur: dimsImage?.largeur ?? m.largeur, hauteur: dimsImage?.hauteur ?? m.hauteur, fps: sf, son: !!m.audio}),
            ...(image ? {image_originale: image, image_largeur: m.largeur, image_hauteur: m.hauteur} : {}),
            ...versions,
          },
          essentiel: it.essentiel === true,
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
          texte: texteDesMots(mots.filter((w) => !w.evenement)),
          mots,
          notes: it.notes || '',
          tags: it.tags ?? [],
        },
      };
    }

    /** Copie dans references/ les fichiers donnés pour une case (ou pour tout le projet si cible = null). */
    function copierReferences(cible) {
      const liste = [];
      for (const r of (d.references ?? []).filter((x) => (x.cible ?? null) === cible)) {
        if (!fs.existsSync(r.chemin)) { avertissements.push(`Référence introuvable : « ${r.nom} » (${r.chemin}).`); continue; }
        const dossier = path.join(D, 'references', cible ?? 'projet');
        fs.mkdirSync(dossier, {recursive: true});
        let nomRef = r.nom;
        for (let k = 2; fs.existsSync(path.join(dossier, nomRef)); k++) nomRef = `${path.parse(r.nom).name}-${k}${path.extname(r.nom)}`;
        fs.copyFileSync(r.chemin, path.join(dossier, nomRef));
        liste.push({nom: r.nom, chemin: `references/${cible ?? 'projet'}/${nomRef}`, taille_octets: r.taille ?? null, genre: genreReference(r.nom)});
      }
      return liste;
    }

    // 1. Le montage, élément par élément
    const items = [];
    for (const s of seq.segs) {
      const it = s.it;
      const n = s.k + 1;
      const base = {n, id: it.id, type: it.type, titre: it.titre || '', debut: temps(s.debut, fps), fin: temps(s.fin, fps), duree: {s: arrondi(s.fin - s.debut), images: s.i1 - s.i0}};
      if (it.type === 'plan') {
        const r = await exporterPlan(it, s.debut, s.fin, p2(n));
        for (const w of r.mots) motsMontage.push({...w, plan: it.id});
        items.push({...base, ...r.donnees});
      } else {
        if (!it.consigne?.trim()) avertissements.push(`La case ${it.id} (${GENRES_BLOC[it.genre]}) n'a pas de consigne : l'IA devra deviner son contenu.`);
        items.push({...base, genre: it.genre, genre_lisible: GENRES_BLOC[it.genre], consigne: it.consigne || '', references: it.references || '',
          fichiers_reference: copierReferences(it.id), a_creer: true});
        avance();
        avance();
      }
    }

    // 2. Plans posés par-dessus (ils ne changent pas la durée du montage)
    const superpositions = [];
    let k = 0;
    for (const sp of supers) {
      k++;
      const deb = surGrille(sp.debut, fps);
      const fin = deb + Math.max(1, versImage(sp.sortie - sp.entree, fps)) / fps;
      const r = await exporterPlan(sp, deb, fin, `S${p2(k)}`);
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
          await decoupesFichier(path.join(D, it.fichier.chemin), path.join(D, 'decoupes', it.id), i0, i1);
          it.fichier.masques = {dossier: `decoupes/${it.id}`, premiere: Math.min(i0, deja?.premiere ?? i0), derniere: Math.max(i1, deja?.derniere ?? i1)};
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

    // 4. Sources : transcriptions, analyses et recadrages complets (temps source), copie éventuelle des rushes
    const utilises = new Set([...d.montage, ...supers].filter((it) => it.type !== 'bloc').map((it) => it.media));
    const sources = [];
    for (const m of d.medias) {
      const base = `${m.id}-${slug(path.parse(m.nom).name, 30) || 'rush'}`;
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
        ecrireJson(path.join(D, analyse), {source: m.id, nom: m.nom, explication: 'Temps en secondes dans le fichier source. silences = [début, fin]. cadrage = centre d’intérêt de l’image (Apple Vision).', ...(an ?? {}), ...(cad ? {cadrage: cad.points} : {})});
      }
      if (d.export.rushes_complets && !leger) {
        fs.mkdirSync(path.join(D, 'rushes'), {recursive: true});
        complet = `rushes/${m.id}-${m.nom}`;
        fs.copyFileSync(m.chemin, path.join(D, complet));
      }
      sources.push({
        id: m.id, nom: m.nom, utilise: utilises.has(m.id), type: m.type, ...(m.type === 'image' ? {} : {duree: temps(m.duree, fpsSource(m, d))}),
        fps: m.fps, largeur: m.largeur, hauteur: m.hauteur, hdr: !!m.hdr, audio: m.audio, voix_isolee: !!fichierSon(P, m, 'voix'),
        codec: m.codec ?? null, conteneur: m.conteneur ?? null, debit_kbps: m.debit_kbps ?? null, taille_octets: m.taille ?? null,
        tournage: m.tournage && Object.keys(m.tournage).length ? m.tournage : null,
        coupes_camera: an?.coupes_camera?.length ?? null, visages_reperes: m.cadrage?.visages ?? null,
        lufs: an?.lufs ?? null, chemin_origine: m.chemin, fichier_complet: complet, transcription, analyse,
      });
    }
    avance();

    // 5. Sous-titres (temps du montage)
    const cues = sousTitres(motsMontage);
    fs.writeFileSync(path.join(D, 'sous-titres', 'montage.srt'), cues.map((q, n) => `${n + 1}\n${horo(q.debut, ',')} --> ${horo(q.fin, ',')}\n${q.lignes.join('\n')}\n`).join('\n'));
    fs.writeFileSync(path.join(D, 'sous-titres', 'montage.vtt'), `WEBVTT\n\n${cues.map((q) => `${horo(q.debut, '.')} --> ${horo(q.fin, '.')}\n${q.lignes.join('\n')}\n`).join('\n')}`);
    ecrireJson(path.join(D, 'sous-titres', 'mots.json'), {
      explication: `Chaque mot dit dans le montage, en temps du montage (secondes) ; image_debut / image_fin à ${fps} i/s. Idéal pour des sous-titres mot à mot.`,
      fps, mots: motsMontage.map((w) => ({...w, image_debut: versImage(w.debut, fps), image_fin: versImage(w.fin, fps)})),
    });
    avance();

    // 6. Storyboard (planches de 16 cases)
    const pages = POLICE && !leger ? await storyboard([...items, ...superpositions.map((x) => ({...x, n: `S${x.n}`, par_dessus: true}))], D, tmp) : [];
    avance();

    // 7. Données, OpenTimelineIO, kit Remotion, modes d'emploi
    const fmt = FORMATS[d.sortie.preset] ?? {ratio: `${d.sortie.largeur}:${d.sortie.hauteur}`};
    const plans = items.filter((i) => i.type === 'plan');
    const referencesProjet = copierReferences(null);
    const stats = {
      plans: plans.length, essentiels: plans.filter((x) => x.essentiel).length, cases_a_creer: items.length - plans.length, par_dessus: superpositions.length, indications: indications.length, effets: effets.length, plans_sans_sous_titres: habillage.sans_sous_titres.length,
      references: referencesProjet.length + items.reduce((a, x) => a + (x.fichiers_reference?.length ?? 0), 0),
      sources_utilisees: utilises.size, mots_dits: motsMontage.filter((w) => !w.evenement).length,
      duree_plans_s: arrondi(plans.reduce((a, i) => a + i.duree.s, 0)), duree_cases_s: arrondi(items.filter((i) => i.type === 'bloc').reduce((a, i) => a + i.duree.s, 0)),
    };
    const kit = leger || (d.export.kit_remotion !== false && fs.existsSync(KIT));
    const montage = {
      _format: 'derush-pack', _version: 4,
      decoupe: toutACreer ? 'a_creer' : decoupeLibre ? 'libre' : 'faite',
      _a_lire: `Lis LISEZMOI-IA.md d'abord. Temps du montage en secondes depuis 0 ; « image » = numéro d'image à ${fps} i/s ; « tc » = timecode HH:MM:SS:II. Les temps « source » sont dans le rush d'origine.`,
      _esprit: toutACreer ? 'Il n’y a aucun rush : tout est à créer, d’après la demande de l’humain et le mode du projet. La case « Tout est à créer » ne donne qu’une durée indicative.' : decoupeLibre
        ? 'L’humain n’a rien découpé : les plans sont ses rushes entiers, dans l’ordre où il les a importés. À toi de choisir les meilleurs passages, de les ordonner et de les raccourcir, puis de monter la vidéo.'
        : 'Ce montage est un squelette fait par un humain : il donne l’intention (passages choisis, ordre, durées, consignes). Garde les plans « essentiel » et l’esprit du brief ; tout le reste, tu peux l’améliorer librement (resserrer, réordonner, ajouter de la 3D, des images générées, du motion design…).',
      projet: {titre: d.titre, exporte_le: maintenant.toISOString(), outil: `Dérush ${VERSION}`, langue: d.langue ?? 'fr'},
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

    let zip = null;
    if (d.export.zip && !leger) {
      zip = `${D}.zip`;
      await lancer('zip', ['-r', '-y', '-q', path.basename(zip), nom, '-x', `${nom}/remotion/node_modules/*`], {cwd: path.dirname(D)});
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
/** drawtext avec le texte dans un fichier (aucun souci d'échappement des accents, guillemets, deux-points). */
const ecrire = (fichier, {gras = false, taille = 20, couleur = '0xEDEDED', x = '12', y = '10', boite = ''} = {}) =>
  `drawtext=fontfile='${gras ? POLICE_GRAS : POLICE}':textfile='${fichier}':expansion=none:fontsize=${taille}:fontcolor=${couleur}:x=${x}:y=${y}:line_spacing=6${boite ? `:box=1:boxcolor=${boite}:boxborderw=7` : ''}`;

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
    await ffmpeg(['-y', '-i', fichierPlan, '-filter_complex',
      `[0:a]showwavespic=s=1080x220:colors=0x7dd3fc,format=rgb24,${ecrire(fichierTexte(tmp, `ENTRÉE  ${temps(tcs[0], sf).tc}`), {gras: true, taille: 18, x: '10', y: '10', boite: '0x000000@0.65'})},${ecrire(fichierTexte(tmp, `SORTIE  ${temps(tcs[2], sf).tc}`), {gras: true, taille: 18, x: 'w-tw-10', y: '10', boite: '0x000000@0.65'})}`,
      '-frames:v', '1', '-q:v', '3', sortie]);
  }
}

/** Planches du montage : 16 cases par page (4 × 4), lisibles d'un coup d'œil par une IA. */
async function storyboard(items, D, tmp) {
  const W = 400;
  const HI = 300;
  const HT = 130;
  let k = 0;
  for (const it of items) {
    k++;
    const out = path.join(tmp, `carte-${String(k).padStart(4, '0')}.png`);
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
      entree = ['-i', path.join(D, it.fichier.chemin)];
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
  }
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
  // piste du dessus : trous entre les plans posés par-dessus
  const v2 = [];
  let curseur = 0;
  for (const sp of superpositions) {
    if (sp.debut.image > curseur) v2.push(vide(sp.debut.image - curseur));
    if (sp.debut.image < curseur) continue; // chevauchement : OTIO n'accepte qu'un plan à la fois par piste
    v2.push(clip(sp));
    curseur = sp.debut.image + sp.duree.images;
  }
  const pistes = [piste('Images', 'Video', v1)];
  if (v2.length) pistes.push(piste('Par-dessus', 'Video', v2));
  pistes.push(piste('Son', 'Audio', a1));
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

function lisezMoi(M) {
  const b = M.brief;
  const s = M.sortie;
  const L = [];
  L.push(`# Pack de montage — ${M.projet.titre}`, '');
  L.push(`> Exporté par ${M.projet.outil} le ${new Date(M.projet.exporte_le).toLocaleString('fr-FR', {dateStyle: 'long', timeStyle: 'short'})}.`);
  if (M.decoupe === 'a_creer') {
    L.push('> **Il n’y a aucun rush.** Tout est à créer : suis la demande de l’humain et le mode du projet (plus bas). La case « Tout est à créer » du tableau ne donne qu’une durée indicative : prends la durée que la demande appelle.');
  } else if (M.decoupe === 'libre') {
    L.push('> **L’humain n’a rien découpé.** Les plans ci-dessous sont ses rushes entiers, dans l’ordre où il les a importés. **Ton travail commence par le dérushage** : regarde et lis tout (`transcriptions/`, `analyse/` pour les silences et les coupes de caméra, `storyboard/`), choisis les meilleurs passages, ordonne-les, raccourcis-les. Puis réalise la vidéo finale : transitions, motion design, effets, titres, sous-titres, musique, mixage. Rien ne t’interdit la 3D (Blender…), les images ou vidéos générées, ou n’importe quel autre outil.', '',
      '> **Pour couper sans te tromper** : écris la liste de tes passages dans un fichier, par exemple `coupes.json` (`[{"plan": "P1", "de": 12.4, "a": 18.9}, …]`, temps du rush en secondes, dans l’ordre de la vidéo), puis lance `node remotion/recouper.mjs coupes.json`. L’outil refait `montage.json`, recale les sous-titres mot à mot, et le kit monte exactement ces passages. Tu peux le relancer autant de fois que tu veux : il repart toujours de l’original (`montage.origine.json`). Son mode d’emploi est en tête du fichier.', '');
  } else {
    L.push('> Ce montage est un **squelette** fait par un humain avec Dérush : il donne l’intention (les passages choisis, leur ordre, les durées, les consignes). **Ton travail : réaliser la vidéo finale et l’améliorer** — transitions, motion design, effets, titres, sous-titres, musique, mixage, et tout ce qui la rendra meilleure. Rien ne t’interdit la 3D (Blender…), les images ou vidéos générées, ou n’importe quel autre outil : choisis le meilleur pour chaque moment.', '');
  }
  if (M.mode_consigne) L.push('## Le mode de ce projet', '', M.mode_consigne, '');
  L.push('## Le brief', '');
  const champs = [['Objectif / histoire', b.objectif], ['Public', b.public], ['Ton / style', b.ton], ['Plateformes', b.plateformes], ['Durée visée', b.duree_visee], ['À éviter', b.a_eviter], ['Références', b.references]];
  const remplis = champs.filter(([, v]) => v?.trim());
  if (remplis.length) for (const [k, v] of remplis) L.push(`- **${k}** : ${v.trim().replace(/\n+/g, ' ')}`);
  else L.push('- *(brief vide : demande à l’humain ce qu’il veut avant de commencer)*');
  if (M.recette) L.push('', recetteEnTexte(M.recette).trimEnd());
  L.push('', '## Format de sortie', '');
  L.push(`- **${s.largeur} × ${s.hauteur}** (${s.ratio}), **${s.fps} images/s**. Langue : ${M.projet.langue}.`);
  L.push(`- Durée du montage : **${s.duree.tc}** (${s.duree.s} s, ${s.images} images).`);
  const st = M.statistiques;
  L.push(`- ${st.plans} plan(s), ${st.cases_a_creer} case(s) à créer, ${st.par_dessus} plan(s) par-dessus, ${st.effets} effet(s) posé(s), ${st.indications} indication(s), ${st.mots_dits} mots dits.`, '');
  L.push('## Comment lire ce squelette', '');
  L.push('1. **Garde l’intention.** Les plans marqués `essentiel: true` doivent rester (tu peux affiner leurs bords d’une image ou deux). Les autres sont des propositions : tu peux les resserrer, les réordonner, en retirer ou en ajouter si ça sert le brief. Les points de coupe sont précis à l’image près : pars d’eux.');
  L.push('   Pour un changement important de découpe, explique-le dans `retours-ia.json` (voir plus bas) : l’humain le verra dans Dérush et pourra l’appliquer d’un clic.');
  L.push('2. **Plans** (`type: "plan"`) : utilise le fichier de `plans/`. Il garde des **poignées** avant et après la coupe : la partie utile va de `fichier.debut_utile_s` à `fichier.fin_utile_s`. Les poignées servent aux transitions et aux débordements du son. Une **image fixe** (`guide.image_fixe`) est fournie en plan vidéo de la bonne durée et en original pleine qualité (`fichier.image_originale`) : anime-la librement (zoom lent, parallaxe, 3D…).');
  L.push('3. **Cases à créer** (`type: "bloc"`) : des emplacements réservés dans le temps. Crée leur contenu (scène, titre, animation, **3D**, carte, image générée…) d’après la `consigne` et les `fichiers_reference`, sur la durée indiquée (elle peut bouger si le rythme le demande).');
  L.push('4. **Plans par-dessus** (`superpositions`) : posés au-dessus du montage, de `debut` à `fin`, sans changer sa durée. `cadre: "plein"` = plein écran, `"incrustation"` = petite fenêtre. Un son posé par-dessus (une musique, une voix) s’entend sans rien cacher. **`voix_off: true` = la voix off de l’humain** : c’est le fil du film, garde-la entière et dans l’ordre ; tu peux la nettoyer, la sous-titrer et remonter les images sur ce qu’elle dit.');
  L.push('5. **Indications** : des consignes posées par-dessus le montage, de `debut` à `fin` (texte à l’écran, zoom, musique, effet…). Elles ne changent pas la durée. Les effets déjà posés et dessinés par le kit sont à part, dans « Habillage déjà posé ».');
  L.push('6. **Son** : `son.garder: false` = couper le son d’origine ; `son.gain_db` = volume demandé ; `son.version` = `original`, `voix` (voix seule, fichier `fichier.voix`) ou `fond` (tout sauf la voix, `fichier.fond`). `son.avant_s` / `son.apres_s` : le son commence avant l’image (J-cut) ou continue après (L-cut) ; `son.debut` / `son.fin` donnent son étendue exacte.');
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
    L.push('`remotion/` contient un projet Remotion qui monte déjà ce pack fidèlement : plans, son (avec J-cut et L-cut), recadrage, plans par-dessus, cases à créer en violet, **et tout l’habillage posé dans Dérush** (transitions, titres, sous-titres, grain, bruitages). Lance `npm install` puis `npm run studio` dans `remotion/`. Remplace les cases par les vraies scènes et ajoute ce qui manque dans `remotion/src/Montage.tsx`, sans toucher aux temps. `npm run rendu` (c’est `node rendre.mjs`) écrit `rendu/montage.mp4`, et Dérush montre ce rendu en direct à l’humain, image par image : rends toujours avec `node remotion/rendre.mjs <Composition> <sortie.mp4>`.', '');
  }
  // l'habillage posé dans Dérush : ce que le kit dessine déjà
  const h = M.habillage;
  const sty = M.style;
  L.push('## Habillage déjà posé', '');
  L.push('Le kit dessine déjà tout ceci, avec le même moteur que l’aperçu de Dérush (`remotion/src/moteur.js`). C’est une base : garde ce qui sert la vidéo, règle le reste, ajoute mieux.', '');
  L.push(`- **Style « ${sty.look} »** : sous-titres ${sty.sous_titres.style === 'aucun' ? 'désactivés' : `« ${sty.sous_titres.style} »`}, couleur ${sty.accent}, titres en ${sty.police_titres}, textes en ${sty.police_textes}${sty.transition_auto !== 'aucune' ? `, transition « ${sty.transition_auto} » sur chaque coupe sans effet` : ''}${sty.grain > 0 ? `, grain ${sty.grain}` : ''}${sty.vignette > 0 ? `, bords sombres ${sty.vignette}` : ''}${sty.bandes ? ', bandes noires' : ''}${sty.barre ? ', barre de progression' : ''}. Réseau visé : ${sty.plateforme} (les textes restent hors des zones que son interface recouvre).`);
  if (h.sans_sous_titres.length) L.push(`- Plans sans sous-titres ajoutés (ils ont déjà du texte incrusté) : ${h.sans_sous_titres.join(', ')}.`);
  if (h.effets.length) {
    L.push('', '| ID | Effet | Début → fin | Sur | Réglages |', '|---|---|---|---|---|');
    for (const e of h.effets) L.push(`| ${e.id} | ${cellule(e.nom)} | ${e.debut.tc} → ${e.fin.tc} | ${e.elements_concernes.join(', ') || '—'} | ${cellule(Object.entries(e.reglages).filter(([, v]) => v !== '' && v !== true).map(([k, v]) => `${k} : ${v}`).join(' · '))} |`);
  } else L.push('- Aucun effet posé à la main.');
  L.push('', 'Pour changer l’habillage : modifie `style` et `habillage.effets` dans `montage.json` (le catalogue des effets et de leurs réglages est dans `habillage.catalogue`), puis relance le rendu. Pour proposer un effet à l’humain sans l’imposer, écris-le dans `retours-ia.json` (type `effet`).', '');
  const pv = M.livraison.plateformes;
  const plusieurs = pv.liste.length > 1;
  const video = M.kit_remotion ? 'rendu/montage.mp4' : 'rendu/<vidéo>.mp4';
  L.push('## Vérifier avant de livrer', '');
  L.push(`Plateforme${plusieurs ? 's' : ''} visée${plusieurs ? 's' : ''} : ${pv.liste.map((x) => `\`${x}\``).join(', ')} (d’après ${pv.d_apres}). Si la compétence **ffmpeg-skill** est installée, fais ces contrôles avec ses outils ; sinon, fais les mêmes mesures avec FFmpeg.`, '');
  L.push(`1. **Pas de sous-titres en double.** Avant d’en incruster, regarde \`vignettes/\` et \`storyboard/\` : un plan qui a déjà du texte incrusté (sous-titres, titres, par exemple un épisode déjà monté) n’en reçoit pas d’autres. ${M.kit_remotion ? 'Dans le kit, ajoute son ID à `PLANS_SANS_SOUS_TITRES`, dans `remotion/src/reglages.ts` (les plans cochés dans Dérush y sont déjà). ' : ''}Si tu te sers de \`sous-titres/montage.srt\`, retires-en les lignes qui tombent sur ce plan.`);
  L.push(`2. **Son** : ${M.livraison.son.lufs} LUFS intégrés, crête vraie à ${M.livraison.son.crete_max_dbtp} dBTP au plus (\`loudness.py\`).`);
  L.push(`3. **Conformité** : \`check.py ${video} --platform <plateforme>\` pour chaque plateforme ; corrige chaque FAIL et signale les WARN.`);
  L.push(`4. **Zones cachées par l’interface** : \`look.py ${video} --tiles 3x2 --safe <plateforme>\`, puis regarde la planche : ni texte important ni visage sous les boutons de la plateforme, aucun sous-titre en double.`);
  L.push('5. Dis à l’humain ce que tu as vérifié, avec les chiffres mesurés, et ce qui reste à voir.', '');
  L.push('## Livrer plusieurs vidéos', '');
  L.push('Une seule vidéo : rends-la dans `rendu/final.mp4`.', '');
  L.push('Plusieurs vidéos (plusieurs clips tirés des rushes, plusieurs formats, plusieurs langues, plusieurs variantes) :', '');
  L.push('1. Une composition par vidéo dans `remotion/src/Root.tsx` (ou la même composition avec d’autres `inputProps`), aux bonnes dimensions et à la bonne durée.');
  L.push('2. Rends chacune dans `rendu/livraison/` : `node remotion/rendre.mjs Clip1 rendu/livraison/clip-1.mp4 --titre "Le titre court"`. L’humain les voit se rendre en direct, l’une après l’autre.');
  L.push('3. Écris `rendu/livraison/livraison.json`, dans l’ordre voulu : `[{"fichier": "clip-1.mp4", "titre": "Le titre court", "description": "Une phrase sur ce clip"}]`.');
  L.push('4. Vérifie chaque vidéo comme ci-dessus. Dérush les récupère toutes ; à chaque nouvelle demande, remplace ce que tu avais livré.', '');
  L.push('## Le montage, élément par élément', '');
  L.push('| # | ID | Type | Début → fin | Durée | Source (entrée → sortie) | Titre, consigne, notes | Ce qui est dit |');
  L.push('|---|---|---|---|---|---|---|---|');
  const descSon = (it) => [it.son.garder ? '' : 'son coupé', it.son.gain_db ? `son ${it.son.gain_db > 0 ? '+' : ''}${it.son.gain_db} dB` : '', it.son.version !== 'original' ? (it.son.version === 'voix' ? 'voix seule' : 'sans la voix') : '', it.son.avant_s ? `son ${it.son.avant_s} s avant (J-cut)` : '', it.son.apres_s ? `son ${it.son.apres_s} s après (L-cut)` : ''];
  for (const it of M.montage) {
    if (it.type === 'plan') {
      const quoi = [it.titre, it.notes, it.tags?.length ? `#${it.tags.join(' #')}` : '', ...descSon(it), it.cadrage ? 'recadrage auto' : ''].filter(Boolean).join(' · ');
      const genre = it.source.type === 'audio' ? ' (son seul)' : it.source.type === 'image' ? ' (image fixe)' : '';
      L.push(`| ${it.n} | ${it.id} | plan${genre}${it.essentiel ? ' **★ essentiel**' : ''} | ${it.debut.tc} → ${it.fin.tc} | ${arrondi(it.duree.s, 3)} s · ${it.duree.images} im. | ${cellule(it.source.nom)}${it.source.type === 'image' ? '' : ` ${it.source.entree.tc} → ${it.source.sortie.tc}`} | ${cellule(quoi)} | ${cellule(it.texte ? `« ${it.texte} »` : '')} |`);
    } else {
      const refs = (it.fichiers_reference ?? []).map((r) => `\`${r.chemin}\``).join(', ');
      L.push(`| ${it.n} | ${it.id} | **case à créer** (${it.genre_lisible}) | ${it.debut.tc} → ${it.fin.tc} | ${arrondi(it.duree.s, 3)} s · ${it.duree.images} im. | — | ${cellule([it.titre, it.consigne, it.references, refs ? `réf. : ${refs}` : ''].filter(Boolean).join(' · '))} | — |`);
    }
  }
  if (M.superpositions.length) {
    L.push('', '## Plans par-dessus', '');
    L.push('| ID | Début → fin | Durée | Cadre | Source (entrée → sortie) | Sur | Titre, notes, son |', '|---|---|---|---|---|---|---|');
    for (const x of M.superpositions) L.push(`| ${x.id} | ${x.debut.tc} → ${x.fin.tc} | ${arrondi(x.duree.s, 3)} s | ${x.cadre} | ${cellule(x.source.nom)} ${x.source.entree.tc} → ${x.source.sortie.tc} | ${x.sur.join(', ') || '—'} | ${cellule([x.titre, x.notes, x.son.garder ? 'avec son' : 'sans son'].filter(Boolean).join(' · '))} |`);
  }
  if (M.indications.length) {
    L.push('', '## Indications (par-dessus le montage)', '');
    L.push('| ID | Genre | Début → fin | Durée | Sur | Consigne |', '|---|---|---|---|---|---|');
    for (const i of M.indications) L.push(`| ${i.id} | ${i.genre_lisible} | ${i.debut.tc} → ${i.fin.tc} | ${arrondi(i.duree.s, 3)} s · ${i.duree.images} im. | ${i.elements_concernes.join(', ') || '—'} | ${cellule(i.consigne)} |`);
  }
  L.push('', '## Sources (rushes)', '');
  L.push('| ID | Fichier | Type | Durée | Image | Utilisé | Transcription | Voix isolée | Volume |', '|---|---|---|---|---|---|---|---|---|');
  for (const x of M.sources) L.push(`| ${x.id} | ${cellule(x.nom)}${x.tournage?.appareil ? ` (${cellule(x.tournage.appareil)})` : ''} | ${x.type === 'video' ? 'vidéo' : x.type === 'image' ? 'image' : 'son'} | ${x.duree?.tc ?? '—'} | ${x.largeur ? `${x.largeur}×${x.hauteur}${x.fps ? ` ${x.fps} i/s` : ''}${x.hdr ? ' HDR' : ''}` : '—'} | ${x.utilise ? 'oui' : 'non (disponible)'} | ${x.transcription ? `\`${x.transcription}\`` : 'aucune'} | ${x.voix_isolee ? 'oui' : 'non'} | ${x.lufs != null ? `${x.lufs} LUFS` : '—'} |`);
  if (M.references?.length) {
    L.push('', '## Références pour tout le film', '');
    for (const r of M.references) L.push(`- \`${r.chemin}\` (${r.genre})`);
  }
  L.push('', '## Contenu du pack', '');
  L.push('- `montage.json` — tout le montage en données exactes (à lire en priorité).');
  L.push('- `montage.otio` — le même montage au format OpenTimelineIO (DaVinci Resolve et outils OTIO).');
  L.push('- `plans/` — un fichier par plan, coupé à l’image près, avec ses poignées (vidéo H.264 + son AAC 48 kHz, ou WAV 48 kHz pour un son seul) ; `-voix.wav` et `-fond.wav` quand la voix a été isolée.');
  L.push('- `vignettes/` — images d’entrée, de milieu et de sortie de chaque plan (ou forme d’onde pour un son seul).');
  L.push(`- \`storyboard/\` — ${M.storyboard.length} planche(s) de tout le montage, 16 cases par page.`);
  L.push('- `sous-titres/` — `montage.srt`, `montage.vtt` et `mots.json` (mot à mot), en temps du montage.');
  L.push('- `transcriptions/` — transcription mot à mot de chaque rush, en temps source.');
  L.push('- `analyse/` — coupes de caméra, silences, volume et recadrage de chaque rush, en temps source.');
  if (M.kit_remotion) L.push('- `remotion/` — kit de rendu Remotion, avec le moteur d’habillage, les polices et les bruitages ; `rendu/` reçoit les vidéos rendues.');
  if (M.montage.some((x) => x.fichier?.masques)) L.push('- `decoupes/` — la personne détourée image par image (WebP avec transparence), pour les titres qui passent derrière elle.');
  L.push('- `OUTILS.md` — la boîte à outils : quel outil prendre pour la 3D, la physique, les shaders, la voix… et comment le brancher sur le kit.');
  L.push('- `MOTION.md` — bien animer : le rythme, le texte, les transitions, la fin, le son, et ce qui trahit une vidéo faite par une machine. À lire avant d’ajouter du motion design.');
  if (M.sources.some((x) => x.fichier_complet)) L.push('- `rushes/` — les rushes complets.');
  L.push('', '## Proposer des changements à l’humain : `retours-ia.json`', '');
  L.push('Écris ce fichier à la racine du pack. Dérush l’affiche dans la chronologie ; l’humain applique ou ignore chaque proposition d’un clic.', '');
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
    '5. Avant de produire la vidéo, présente ton plan (structure, transitions, motion design, musique) si le brief ne tranche pas tout.',
    '6. Pour un changement important de découpe, explique-le dans `retours-ia.json` (format dans `LISEZMOI-IA.md`) : l’humain l’appliquera d’un clic dans Dérush.',
    '7. Avant de livrer, vérifie la vidéo (« Vérifier avant de livrer » dans `LISEZMOI-IA.md`) : pas de sous-titres en double sur un plan qui a déjà du texte incrusté, son à -14 LUFS, contrôle et planche de chaque plateforme, avec la compétence ffmpeg-skill si elle est installée.',
    '8. Si `contexte/` existe, c’est ce que l’humain t’a donné (références, charte graphique, logo, polices, vidéos, archives, créations ElevenLabs) : lis `contexte/INDEX.md` avant de commencer.',
    '9. Rends avec `node remotion/rendre.mjs <Composition> <sortie.mp4>` : Dérush montre le rendu en direct. Une vidéo : `rendu/final.mp4` ; plusieurs : `rendu/livraison/` et `livraison.json` (« Livrer plusieurs vidéos » dans `LISEZMOI-IA.md`).',
    '',
  ].join('\n');
}
