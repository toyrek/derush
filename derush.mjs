#!/usr/bin/env node
// Dérush par IABAI — le montage vidéo avec ton IA (Claude ou Codex), sur macOS, Windows et Linux.
//
//   node derush.mjs                         ouvre la bibliothèque de projets (Vidéos/Dérush, Movies/Dérush sur Mac)
//   node derush.mjs <dossier du projet>     ouvre directement ce projet
//     options : --port 4321, --sans-navigateur, --app (fenêtre d'application, arrêt tout seul quand on la ferme),
//               --coque (lancé par l'app Mac native, outils/coque-mac.swift : elle affiche l'interface elle-même)
//
//   node derush.mjs ajouter <projet> <rush> [<rush>…]     ajoute des rushes et attend leur préparation
//   node derush.mjs transcrire <projet> <M1>               transcrit un rush avec Whisper (sur le Mac)
//   node derush.mjs transcription <projet> <M1> <fichier>  importe une transcription (.json, .srt, .vtt)
//   node derush.mjs voix <projet> <M1>                     sépare la voix du reste (Demucs)
//   node derush.mjs exporter <projet>                      crée le pack pour l'IA
//   node derush.mjs demander <projet> "ce que je veux" [--ia claude|codex] [--qualite rapide|soigne|max]
//                                    [--modele opus|fable|sonnet] [--nouveau]
//                                                          fait monter la vidéo par l'IA, dans le dossier du pack
//   node derush.mjs rendre <projet> [--reseau tiktok]      crée la vidéo sans IA (montage + habillage) et la contrôle
//   node derush.mjs installer [--leger] [--blender] [--earshot]   installe tout ce qui manque sur cet ordinateur, et le raccourci
//   node derush.mjs installer --bilan                      dit ce qui est là et ce qui manque, sans rien installer
//   node derush.mjs installer whisper|voix|detourage|rendu|outils|blender|remotion|real-sfx|earshot   installe une seule chose
//   node derush.mjs mettre-a-jour                          récupère la dernière version de la bêta (GitHub)
//   node derush.mjs competences                            les compétences ajoutées (provenance, licence, état)
//   node derush.mjs competences chercher <mots>            cherche dans l'annuaire skills.sh
//   node derush.mjs competences voir <lien>                lit un dépôt GitHub et dit ce qu'il contient, sans rien ajouter
//   node derush.mjs competences ajouter <lien> [--toutes | --chemin <dossier>] [--oui]   ajoute une compétence
//   node derush.mjs competences retirer|pause|reprendre <nom>   retire, met en pause, reprend une compétence ajoutée
//   node derush.mjs competences verifier                   regarde si les compétences ajoutées ont une nouvelle version
//   node derush.mjs construire-app [<dossier>] [--sur-place] fabrique Dérush.app (Mac) et l'alias sur le Bureau
//   node derush.mjs construire-app --zip [<dossier>]       fabrique le zip de Dérush.app à partager
//   node derush.mjs construire-app --dmg [<dossier>]       fabrique l'image disque (on glisse Dérush dans Applications)
import path from 'node:path';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
// clé ElevenLabs éventuelle : dans ce dossier (développement), ou dans le dossier de Dérush, où l'outil officiel
// d'ElevenLabs la range au branchement (voir lib/elevenlabs.mjs)
for (const f of ['.env', '.env.local']) {
  try { process.loadEnvFile(path.join(ICI, f)); } catch { /* pas de fichier : rien à charger */ }
}

const {Projet} = await import('./lib/projet.mjs');
const {FileDAttente, lancer, arreterEnfants, FFMPEG, FFPROBE, tailleLisible, lireJson} = await import('./lib/outils.mjs');
const {ajouterMedia, preparer, etapesManquantes, isolerVoix, creerAffiche} = await import('./lib/medias.mjs');
const {lireFichierTranscription, enregistrer, transcrire} = await import('./lib/transcription.mjs');
const {installer} = await import('./lib/moteurs.mjs');
const {exporterPack} = await import('./lib/pack.mjs');
const {creerVideo, installerRendu, etatRendu} = await import('./lib/rendu.mjs');
const {demander, etatDemande, etatIA, claudeTravaille, arreterToutesLesDemandes, MODELES} = await import('./lib/claude.mjs');
const {arreterConseils, conseilEnCours} = await import('./lib/conseil.mjs');
const {arreterDrive} = await import('./lib/drive-medias.mjs');
const {fermerEnregistrements, enregistrementEnCours} = await import('./lib/enregistrement.mjs');
const {chargerCle} = await import('./lib/elevenlabs.mjs');
chargerCle();
const {demarrerServeur, cleFenetre} = await import('./lib/serveur.mjs');
const {noterRecent} = await import('./lib/bibliotheque.mjs');
const {VERSION} = await import('./lib/commun.mjs');

const args = process.argv.slice(2);
const option = (nom) => {
  const i = args.indexOf(nom);
  if (i < 0) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const drapeau = (nom) => {
  const i = args.indexOf(nom);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};

async function verifierOutils() {
  await Promise.all([[FFMPEG, 'ffmpeg'], [FFPROBE, 'ffprobe']].map(async ([cmd, nom]) => {
    try {
      await lancer(cmd, ['-version']);
    } catch {
      if (modeCoque) console.log('DERUSH_ERREUR=ffmpeg'); // la fenêtre native l'explique à la personne
      console.error(`${nom} est introuvable. Installe FFmpeg (https://ffmpeg.org) ou indique son chemin avec DERUSH_${nom.toUpperCase()}.`);
      process.exit(modeCoque ? 4 : 1);
    }
  }));
}

// l'interface s'ouvre dans une fenêtre d'application (Chrome, Edge, Chromium ou Brave), sinon dans le navigateur
const {ouvrirFenetre, MAC, fichierJournal} = await import('./lib/plateforme.mjs');

const COMMANDES = ['ajouter', 'transcrire', 'transcription', 'voix', 'exporter', 'rendre', 'demander', 'installer', 'construire-app', 'mettre-a-jour', 'competences'];
const commande = COMMANDES.includes(args[0]) ? args.shift() : 'ouvrir';
const port = Number(option('--port')) || 4321;
const sansNavigateur = drapeau('--sans-navigateur') || process.env.DERUSH_SANS_NAVIGATEUR === '1';
const modeApp = drapeau('--app');
// lancé par l'app Mac native : elle lit notre adresse sur la sortie (DERUSH_URL=…) et affiche l'interface elle-même
const modeCoque = drapeau('--coque');
const file = new FileDAttente();
// lancé par le raccourci (Windows, Linux), Dérush n'a pas de terminal : ce qu'il dit va dans son journal
// (sur Mac, le lanceur de l'app s'en charge déjà)
if (modeApp && !MAC) {
  const journal = fichierJournal();
  try { fs.mkdirSync(path.dirname(journal), {recursive: true}); } catch { /* dossier déjà là */ }
  const ecrire = (niveau) => (...a) => {
    try { fs.appendFileSync(journal, `${new Date().toISOString()} ${niveau} ${a.map((x) => (x instanceof Error ? x.stack : typeof x === 'string' ? x : JSON.stringify(x))).join(' ')}\n`); } catch { /* disque plein : on se tait */ }
  };
  console.log = ecrire('info');
  console.warn = ecrire('alerte');
  console.error = ecrire('erreur');
  process.on('uncaughtException', (e) => { console.error(e); process.exit(1); });
}
const barre = () => {
  let dernier = -1;
  return (p) => {
    const pc = Math.floor(p * 10) * 10;
    if (pc !== dernier) { dernier = pc; process.stdout.write(`${pc} % `); }
  };
};

if (commande === 'competences') {
  const A = await import('./lib/competences-ajoutees.mjs');
  const toutes = drapeau('--toutes');
  const oui = drapeau('--oui');
  const chemin = option('--chemin');
  const [action = 'lister', ...reste] = args;
  const decrire = (c) => {
    const l = [`  ${c.nom}${c.chemin ? `  (${c.chemin})` : ''} — ${c.description.slice(0, 140) || 'sans description'}`,
      `    licence : ${c.licence?.nom ?? 'aucune trouvée'}${c.licence?.commercial === false ? ' (pas d’usage commercial)' : c.licence && c.licence.commercial == null ? ' (Dérush ne la reconnaît pas : lis-la avant un usage commercial)' : ''} ·${c.fichiers} fichiers · ${c.n_programmes} programme(s) · avis : ${{ok: 'rien à signaler', attention: 'à regarder', danger: 'à lire avant', refus: 'refusée'}[c.niveau]}`];
    if (c.cles.length) l.push(`    clés demandées : ${c.cles.join(', ')}`);
    for (const a of c.alertes.slice(0, 6)) l.push(`    ${a.gravite === 'danger' ? '⚠' : '·'} ${a.quoi}${a.fichier ? ` (${a.fichier}:${a.ligne})` : ''}`);
    if (c.conflit) l.push(`    ${c.conflit}`);
    return l.join('\n');
  };
  try {
    if (action === 'lister') {
      const l = A.listerAjoutees();
      if (!l.length) console.log('Aucune compétence ajoutée. Ajoute-en une : node derush.mjs competences ajouter <lien GitHub>');
      for (const x of l) console.log(`${x.actif === false ? '⏸' : x.masquee ? '!' : '✓'} ${x.nom} — ${x.depot} @ ${String(x.commit ?? '?').slice(0, 7)} · ${x.licence?.nom ?? 'sans licence'}${x.maj_disponible ? ' · nouvelle version' : ''}${x.modifiee ? ' · modifiée à la main' : ''}`);
    } else if (action === 'chercher') {
      const r = await A.chercherAnnuaire(reste.join(' '));
      if (!r.length) console.log('Rien trouvé.');
      for (const x of r) console.log(`${x.deja ? '✓' : ' '} ${x.depot}@${x.nom}${x.installs != null ? `  (${x.installs} installations)` : ''}`);
    } else if (action === 'voir' || action === 'ajouter') {
      const e = await A.explorer(reste[0] ?? '');
      console.log(`${e.depot} @ ${String(e.commit ?? '?').slice(0, 7)} — ${e.competences.length} compétence(s), licence du dépôt : ${e.licence?.nom ?? 'aucune trouvée'}`);
      for (const c of e.competences) console.log(decrire(c));
      if (action === 'voir') { A.abandonner(e.id); process.exit(0); }
      const voulues = chemin != null ? e.competences.filter((c) => c.chemin === chemin)
        : toutes ? e.competences : e.competences.filter((c) => c.voulue).length ? e.competences.filter((c) => c.voulue) : e.competences.length === 1 ? e.competences : [];
      if (!voulues.length) { console.error('\nPlusieurs compétences : choisis avec --chemin <dossier> (ou « propriétaire/dépôt@nom »), ou prends-les toutes avec --toutes.'); A.abandonner(e.id); process.exit(1); }
      if (voulues.some((c) => c.niveau === 'danger') && !oui) { console.error('\nAu moins une compétence a une alerte à lire (⚠). Relis-la, puis relance avec --oui pour l’ajouter quand même.'); A.abandonner(e.id); process.exit(1); }
      const r = await A.ajouter(e.id, voulues.map((c) => c.chemin));
      A.abandonner(e.id);
      for (const n of r.ajoutees) console.log(`✓ ajoutée : ${n}`);
      for (const x of r.refusees) console.log(`✗ ${x.nom} : ${x.raison}`);
      process.exit(r.ajoutees.length ? 0 : 1);
    } else if (action === 'retirer') { A.retirer(reste[0] ?? ''); console.log('Retirée.'); }
    else if (action === 'pause' || action === 'reprendre') { A.activer(reste[0] ?? '', action === 'reprendre'); console.log(action === 'pause' ? 'En pause : l’IA ne la voit plus.' : 'Reprise.'); }
    else if (action === 'verifier') { const r = await A.verifierMisesAJour(); console.log(`${r.verifiees} vérifiée(s)${r.echecs ? `, ${r.echecs} sans réponse de GitHub` : ''}. ${r.maj.length ? `Nouvelle version : ${r.maj.join(', ')}.` : 'Rien de nouveau.'}`); }
    else { console.error('Usage : node derush.mjs competences [chercher <mots> | voir <lien> | ajouter <lien> [--toutes | --chemin <dossier>] [--oui] | retirer|pause|reprendre <nom> | verifier]'); process.exit(1); }
  } catch (e) { console.error(e.message); process.exit(1); }
  process.exit(0);
}

if (commande === 'installer') {
  const I = await import('./lib/installation.mjs');
  const bilanSeul = drapeau('--bilan');
  const leger = drapeau('--leger');
  const avecBlender = drapeau('--blender');
  const avecEarshot = drapeau('--earshot');
  const nom = args[0];
  if (bilanSeul) {
    for (const l of I.lignesMachine()) console.log(l);
    console.log('');
    for (const x of await I.bilan()) console.log(`${x.ok ? '✓' : x.requis ? '✗' : '·'} ${x.nom} — ${x.detail}`);
    process.exit(0);
  }
  if (!nom) {
    const r = await I.installerTout({leger, blender: avecBlender, earshot: avecEarshot});
    if (r.reste.length) { console.log('\nÀ faire :'); for (const x of r.reste) console.log(`  - ${x}`); }
    else console.log('\nTout est prêt. Ouvre « Dérush » (raccourci sur le Bureau), puis Connexions pour brancher ton IA.');
    process.exit(r.bilan.some((x) => x.requis && !x.ok) ? 1 : 0);
  }
  try {
    if (nom === 'blender') { const b = await I.installerBlender(console.log); console.log(`Blender : ${b.nom}`); }
    else if (nom === 'remotion') { const {telechargerRemotion} = await import('./lib/competences.mjs'); console.log(`${await telechargerRemotion()} compétences Remotion téléchargées.`); }
    else if (nom === 'rendu') { await installerRendu(barre()); console.log('\nrendu : prêt'); }
    else if (nom === 'real-sfx' || nom === 'realsfx') { const {telechargerRealSfx} = await import('./lib/sons.mjs'); await telechargerRealSfx(); console.log('Real SFX : téléchargé.'); }
    else if (nom === 'earshot') { const {installerEarshot} = await import('./lib/sons.mjs'); const e = await installerEarshot(console.log); console.log(`Earshot : ${e.ok ? 'prêt' : e.pourquoi}`); }
    else if (['whisper', 'voix', 'detourage', 'outils'].includes(nom)) { const etat = await installer(nom, barre()); console.log(`\n${nom} : ${etat[nom] ? (etat[nom].ok ? 'prêt' : etat[nom].pourquoi) : 'prêt'}`); }
    else { console.error('Usage : node derush.mjs installer [--leger] [--blender] [--earshot] | --bilan | whisper|voix|detourage|rendu|outils|blender|remotion|real-sfx|earshot'); process.exit(1); }
  } catch (e) { console.error(`\n${nom} : ${e.message}`); process.exit(1); }
  process.exit(0);
}
if (commande === 'mettre-a-jour') {
  const {verifierMaj, mettreAJour} = await import('./lib/maj.mjs');
  const e = await verifierMaj();
  if (!e.possible) { console.error(e.message); process.exit(1); }
  if (!e.en_retard) { console.log(`Dérush ${VERSION} est à jour.`); process.exit(0); }
  console.log(`Nouvelle version${e.version_distante ? ` ${e.version_distante}` : ''} (${e.en_retard} changement${e.en_retard > 1 ? 's' : ''}) :`);
  for (const n of e.notes) console.log(`  - ${n}`);
  try { const r = await mettreAJour(); console.log(`Dérush ${r.version} installé. Relance Dérush pour en profiter.`); } catch (x) { console.error(x.message); process.exit(1); }
  process.exit(0);
}
if (commande === 'construire-app') {
  const {construireApp} = await import('./outils/construire-app.mjs');
  const zip = drapeau('--zip');
  const dmg = drapeau('--dmg');
  const surPlace = drapeau('--sur-place');
  const sansRaccourci = drapeau('--sans-raccourci');
  await construireApp({cible: args[0], zip, dmg, surPlace, sansRaccourci});
  process.exit(0);
}

if (commande !== 'ouvrir') {
  await verifierOutils();
  const P = new Projet(path.resolve(args.shift() ?? '.'));
  const rush = () => {
    const m = P.media(args[0]);
    if (!m) { console.error(`Rush inconnu : ${args[0] ?? '(aucun)'} — rushes du projet : ${P.d.medias.map((x) => `${x.id} ${x.nom}`).join(', ') || 'aucun'}`); process.exit(1); }
    return m;
  };
  if (commande === 'ajouter') {
    for (const f of args) {
      try {
        const m = await ajouterMedia(P, f, file);
        console.log(`+ ${m.id} ${m.nom} (${m.type}, ${Math.round(m.duree * 10) / 10} s)`);
      } catch (e) {
        console.error(`✗ ${f} : ${e.message}`);
      }
    }
    if (P.formatAuto()) console.log(`Format ${P.d.sortie.largeur}×${P.d.sortie.hauteur}, comme ta première vidéo.`);
    for (const m of P.d.medias) if (etapesManquantes(m)) preparer(P, m, file);
    await file.vide();
    for (const m of P.d.medias) console.log(`${m.id} ${m.nom} → ${m.etat}${m.erreur ? ` (${m.erreur})` : ''}`);
  } else if (commande === 'transcrire') {
    const r = await transcrire(P, rush(), 'whisper', barre());
    console.log(`\n${r.mots} mots (${r.moteur}).`);
  } else if (commande === 'transcription') {
    const m = rush();
    const fichier = args[1];
    const r = enregistrer(P, m, lireFichierTranscription(fichier, fs.readFileSync(fichier, 'utf8')), `import (${path.extname(fichier).slice(1)})`);
    console.log(`${m.id} ${m.nom} : ${r.mots} mots importés${r.approx ? ' (horodatage approximatif)' : ''}.`);
  } else if (commande === 'voix') {
    await isolerVoix(P, rush(), barre());
    console.log('\nVoix isolée : voix.flac et fond.flac dans le cache du rush.');
  } else if (commande === 'exporter') {
    const r = await exporterPack(P, barre());
    console.log(`\nPack prêt : ${r.dossier} (${tailleLisible(r.taille)}, ${r.plans} plans, ${r.cases_a_creer} cases à créer, ${r.par_dessus} par-dessus, ${r.indications} indications${r.kit ? ', kit Remotion' : ''})`);
    for (const a of r.avertissements) console.log(`  ! ${a}`);
  } else if (commande === 'demander') {
    const alias = {opus: 'claude-opus-5-5', fable: 'claude-fable-5-2', sonnet: 'claude-sonnet-5-5'};
    const m = option('--modele');
    const modele = alias[m] ?? (MODELES[m] ? m : m || null);
    const effort = option('--effort');
    const qualite = option('--qualite');
    const nouveau = drapeau('--nouveau');
    const etats = await etatIA();
    const choix = option('--ia');
    const moteur = ['claude', 'codex', 'gemini'].includes(choix) ? choix : etats.choisi;
    const c = etats[moteur];
    if (!c?.ok) { console.error(c?.pourquoi ?? 'Aucune IA prête.'); process.exit(1); }
    console.log(`${c.nom}${modele ? ` · ${MODELES[modele]?.nom ?? modele}` : ''} · ${qualite ?? 'qualité par défaut'}`);
    let vu = 0;
    const suivre = setInterval(() => {
      const e = etatDemande(P).en_cours;
      if (!e) return;
      const nouveaux = Math.min(e.activite.length, e.n_activite - vu);
      for (const a of nouveaux > 0 ? e.activite.slice(-nouveaux) : []) console.log(`  [${String(a.t).padStart(4)} s] ${a.texte.replace(/\s+/g, ' ').slice(0, 200)}`);
      vu = e.n_activite;
    }, 1000);
    const r = await new Promise((ok, ko) => demander(P, {message: args.join(' '), moteur, qualite, modele, effort, nouveau, file}, (err, rep) => (err ? ko(err) : ok(rep))).catch(ko));
    clearInterval(suivre);
    const e = etatDemande(P);
    console.log(`\n${c.nom} (${r.duree_s} s) : ${r.texte}`);
    if (r.version) { const v = e.versions.at(-1); for (const x of v.videos) { console.log(`Vidéo : ${path.join(P.racine, 'vidéos', x.nom)} (${x.taille_lisible})`); for (const k of x.controles ?? []) console.log(`  ${k.ok ? '✓' : '!'} ${k.t}`); } }
    else console.log('Pas de vidéo livrée.');
    for (const p of r.publications ?? []) console.log(`Publication ${p.reseau} : ${p.etat}${p.lien ? ` — ${p.lien}` : ''}${p.message ? ` (${p.message})` : ''}`);
  } else if (commande === 'rendre') {
    const reseau = option('--reseau');
    if (!etatRendu().ok) console.log('Installation du moteur de rendu (une seule fois)…');
    const r = await creerVideo(P, {plateforme: reseau}, barre());
    console.log(`\nVidéo prête : ${r.video} (${r.taille_lisible}, ${r.duree} s, ${r.largeur}×${r.hauteur}, pour ${r.reseau_nom})`);
    for (const c of r.controles) console.log(`  ${c.ok ? '✓' : '!'} ${c.t}${c.d ? ` — ${c.d}` : ''}`);
    for (const a of r.avertissements) console.log(`  ! ${a}`);
    if (r.planche) console.log(`Planche de contrôle : ${r.planche}`);
  }
  process.exit(0);
}

// ——— Interface ———
// Dernier filet : une promesse oubliée quelque part (un travail de fond qui échoue) est notée au journal, au lieu
// d'arrêter tout Dérush, la fenêtre et le travail en cours avec lui.
process.on('unhandledRejection', (e) => console.error('Promesse rejetée sans suite :', e));
// Sur Mac, une ancienne installation (fenêtre de Chrome) devient l'app native à son premier lancement.
if (MAC && modeApp && !modeCoque) {
  try {
    const {migrerVersAppNative} = await import('./outils/construire-app.mjs');
    if (await migrerVersAppNative()) process.exit(0); // l'app native vient d'être installée et s'ouvre
  } catch (e) { console.warn(`App native non installée (${e.message}) : Dérush s'ouvre dans une fenêtre de navigateur.`); }
}
const outilsVerifies = verifierOutils(); // en même temps que la suite : rien n'attend FFmpeg
/** Un Dérush qui tourne déjà sur ce port : son jeton, et s'il travaille (rendu, IA). */
async function dejaOuvert(base) {
  const jeton = /name="derush-jeton" content="([^"]+)"/.exec(await (await fetch(`${base}?c=${cle}`, {signal: AbortSignal.timeout(1500)})).text())?.[1];
  const H = {'x-derush-jeton': jeton};
  const lire = async (p) => { try { return await (await fetch(`${base}${p}`, {headers: H, signal: AbortSignal.timeout(1500)})).json(); } catch { return {}; } };
  const [f, c] = await Promise.all([lire('api/file'), lire('api/claude')]);
  return {jeton, occupe: !!(f.file?.en_cours || f.file?.attente?.length || c.en_cours)};
}
// La clé de la fenêtre (durable, dans le dossier de Dérush) : la page d'accueil, qui porte le jeton, n'est servie qu'à
// l'adresse qui la porte (« /?c=… »). Un Dérush plus ancien ignore « ?c= » : la même adresse marche avec lui.
const cle = cleFenetre();
// Une seule instance : si Dérush tourne déjà, on rouvre simplement sa fenêtre.
try {
  const base = `http://127.0.0.1:${port}/`;
  const j = await (await fetch(`${base}api/ping`, {signal: AbortSignal.timeout(800)})).json();
  if (j.derush) {
    let garder = true;
    if (modeCoque && j.version !== VERSION) {
      // un Dérush d'une autre version (avant une mise à jour) : on le remplace, sauf s'il est en plein travail
      const ancien = await dejaOuvert(base).catch(() => ({occupe: true}));
      if (!ancien.occupe) {
        await fetch(`${base}api/quitter`, {method: 'POST', headers: {'x-derush-jeton': ancien.jeton}}).catch(() => {});
        for (let k = 0; k < 40; k++) {
          await new Promise((ok) => setTimeout(ok, 150));
          try { await fetch(`${base}api/ping`, {signal: AbortSignal.timeout(300)}); } catch { garder = false; break; }
        }
      }
    }
    if (garder) {
      const adresse = `${base}?c=${cle}`;
      if (modeCoque) { console.log('DERUSH_DEJA=1'); console.log(`DERUSH_URL=${adresse}`); }
      else if (!sansNavigateur) ouvrirFenetre(adresse);
      else {
        // sans fenêtre à ouvrir (un essai, un serveur lancé à la main) : le dire, pour ne pas piloter l'autre sans le savoir
        console.error(`Dérush tourne déjà sur le port ${port} : rien n'est lancé.`);
        process.exit(1);
      }
      process.exit(0);
    }
  }
} catch { /* rien ne tourne : on démarre */ }

await outilsVerifies;
// Les projets déjà ouverts depuis le lancement, par dossier. Rouvrir un projet rend le MÊME objet : les tâches encore en
// cours (préparation, voix claire, texte, détourage…) tiennent celui qu'elles ont reçu. Un second objet, relu sur le
// disque, serait réécrit par l'ancien à leur fin (sans leur résultat), et chaque rush pas prêt repartirait en préparation.
const vivants = new Map();
const ctx = {
  P: null,
  file,
  app: modeApp || modeCoque,
  natif: modeCoque,
  ouvrir(dossier, titre) {
    const racine = path.resolve(dossier);
    // sans derush.json (projet mis à la corbeille, dossier refait sous le même nom), on repart de ce qui est sur le disque
    const surDisque = vivants.has(racine) ? lireJson(path.join(racine, 'derush.json')) : null;
    const deja = surDisque ? vivants.get(racine) : null;
    const P = deja ?? new Projet(racine);
    vivants.set(P.racine, P);
    // la bibliothèque change l'espace d'un projet fermé en écrivant derush.json à part : on le reprend
    if (deja && typeof surDisque.espace === 'string' && surDisque.espace !== P.d.espace) P.appliquer({espace: surDisque.espace});
    if (titre && !fs.existsSync(path.join(P.racine, '.derush'))) { P.d.titre = titre; P.sauver(); }
    ctx.P = P;
    noterRecent(P.racine);
    creerAffiche(P);
    // reprend les préparations interrompues et ajoute les nouveautés (recadrage…) aux anciens rushes ; dans un projet
    // déjà ouvert, un rush en attente ou en cours de préparation est encore dans la file : il n'y retourne pas
    for (const m of P.d.medias) {
      if (deja && (m.etat === 'attente' || m.etat === 'analyse')) continue;
      if (m.etat !== 'pret' && m.etat !== 'erreur' ? true : etapesManquantes(m)) preparer(P, m, file);
    }
    return P;
  },
  /** Le projet déjà chargé de ce dossier (ouvert maintenant ou plus tôt), ou null : pour le changer sans en refaire un. */
  projetVivant(dossier) { return vivants.get(path.resolve(dossier)) ?? null; },
  fermer() { ctx.P = null; },
};
if (args[0]) ctx.ouvrir(path.resolve(args[0]));
const {url} = await demarrerServeur(ctx, {port, modeApp, cle});
// l'adresse de la fenêtre porte la clé : elle ne va jamais au journal, seulement à la fenêtre (ou au terminal, quand
// personne d'autre ne l'ouvre)
const adresse = `${url}?c=${cle}`;
console.log(`Dérush ${VERSION} — ${ctx.P ? `projet « ${ctx.P.d.titre} »` : 'bibliothèque'} sur ${url}  (Ctrl+C pour quitter)`);
if (modeCoque) console.log(`DERUSH_URL=${adresse}`);
else if (!sansNavigateur) ouvrirFenetre(adresse);
else if (!modeApp) console.log(`Adresse de la fenêtre : ${adresse}`);
// l'app Mac « sur place » garde sa propre copie de la fenêtre native : après une mise à jour par GitHub, elle est
// remplacée ici (la prochaine ouverture en profite), sans rien ralentir au démarrage
if (modeCoque && MAC) {
  setTimeout(async () => {
    try {
      const {rafraichirApp} = await import('./outils/construire-app.mjs');
      const r = rafraichirApp();
      if (r) console.log(`L’app Dérush est rafraîchie (${[r.coque ? 'sa fenêtre' : null, r.version ? `version ${VERSION}` : null].filter(Boolean).join(', ')}) : la prochaine ouverture en profite.`);
    } catch { /* l'app reste comme elle est */ }
  }, 5000).unref();
}
// Quand Dérush s'arrête (la fenêtre native qui quitte, Ctrl+C, le terminal fermé), tout ce qu'il a lancé s'arrête avec
// lui : FFmpeg, l'IA et ses rendus. Sans cela, une IA lancée continuerait seule, sans personne pour la suivre.
{
  const arreter = () => {
    try { arreterToutesLesDemandes(); arreterConseils(); arreterDrive(); arreterEnfants(); } catch { /* rien à arrêter */ }
    process.exit(0);
  };
  for (const s of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(s, arreter);
  // une prise de voix ou de caméra pas terminée reste dans le projet, quel que soit le chemin de sortie
  process.on('exit', () => { try { fermerEnregistrements(); } catch { /* rien à refermer */ } });
}
if (modeCoque) {
  // Elle tient aussi notre entrée ouverte : si elle disparaît sans prévenir (plantage), on finit le travail en cours,
  // puis on s'arrête, pour ne jamais rester en arrière-plan sans fenêtre.
  let orphelin = false;
  try {
    if (fs.fstatSync(0).isFIFO()) {
      process.stdin.on('end', () => { orphelin = true; });
      process.stdin.on('error', () => { orphelin = true; });
      process.stdin.resume();
    }
  } catch { /* pas d'entrée à surveiller */ }
  setInterval(() => { if (orphelin && !file.enCours && !file.attente.length && !claudeTravaille() && !conseilEnCours()) arreter(); }, 2000).unref?.();
} else if (modeApp) {
  // Dérush s'arrête tout seul quand on ferme sa fenêtre : la page le signale en se fermant, et on attend la fin
  // du travail en cours. Un simple silence ne suffit pas : Chrome endort les fenêtres cachées pendant des heures.
  // Filets de sécurité : aucune fenêtre ouverte 10 min après le lancement, ou plus aucun signe de vie depuis 12 h.
  setInterval(() => {
    if (file.enCours || file.attente.length || claudeTravaille() || enregistrementEnCours()) return;
    const maintenant = Date.now();
    for (const [id, t] of ctx.fenetres) if (maintenant - t > 12 * 3600e3) ctx.fenetres.delete(id);
    const fermee = ctx.fermeeA && !ctx.fenetres.size && maintenant - ctx.fermeeA > 8000;
    const jamaisOuverte = !ctx.fermeeA && !ctx.fenetres.size && maintenant - ctx.demarreA > 600e3;
    if (fermee || jamaisOuverte) process.exit(0);
  }, 2000).unref?.();
}
