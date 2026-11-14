#!/usr/bin/env node
// Dérush — la commande « derush-son », donnée à l'IA (et utilisable à la main) : la voix claire, le mixage et les mesures
// du son, sur l'ordinateur (FFmpeg ; Python de Dérush pour l'écho). Tout le mode d'emploi est dans AIDE (derush-son --help).
import fs from 'node:fs';
import {aide, options} from './commande.mjs';

const AIDE = `derush-son — la voix claire, le mixage et les mesures du son (sur l'ordinateur, FFmpeg).

Usage :
  derush-son clair <entrée> <sortie.wav|.flac> [--force auto|leger|doux|normal|fort] [--echo] [--debut s] [--duree s]
      La voix claire : même durée que l'entrée, parfaitement synchrone, à −16 LUFS (prête à mixer).
      --force auto (par défaut) : Dérush mesure le fond sonore et choisit
          « leger » : la voix a déjà été nettoyée (téléphone, CapCut…) : aucun débruitage, seulement plus nette
          « normal » : une voix filmée, souffle à retirer
      « doux » garde l'ambiance, « fort » pour un son très sale (rue, salle, ventilation).
      --echo réduit l'écho d'une pièce qui résonne (plus long). --debut/--duree : un passage seulement.
      La réponse donne force, pourquoi, avant/après (LUFS, crête, brillance_db = les aigus de la voix) et un avis.
      Exemple : derush-son clair plans/M1-chronique.mp4 rendu/son/voix.wav

  derush-son mixer <plan.json> <sortie.wav|.m4a>
      Le mixage : voix devant, musique posée 15 dB sous la voix mesurée, qui remonte dans les silences, −14 LUFS, crête −1 dBTP.
      plan.json :
      {"duree": 46, "musique_sous_voix_db": 15, "remontee_db": 6, "pistes": [
        {"fichier": "rendu/son/voix.wav", "role": "voix"},
        {"fichier": "sons/musique.mp3", "role": "musique", "longueur": 46, "fondu_sortie": 2,
         "effets": [{"type": "etouffer", "de": 15.8, "a": 23.2}, {"type": "volume", "de": 30, "a": 34, "db": 3}]},
        {"fichier": "rendu/son/clic.wav", "role": "effet", "debut": 3.2, "gain_db": -8}]}
      effets d'une piste (temps de la vidéo) : etouffer (derrière un mur), couper (un silence), volume (db).
      "ducking": false : chaque piste garde son gain_db, rien d'automatique.
      Puis : ffmpeg -i video.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k final.mp4

  derush-son mesurer <fichier>
      Volume (LUFS), crêtes (dBTP), plage, brillance de la voix, et ce qu'il faut corriger (conseils).
      Cible d'une vidéo pour les réseaux : −14 LUFS (±1), crête sous −1 dBTP, brillance entre −15 et −11 dB.

Pièges : extrais le son en virgule flottante (-c:a pcm_f32le), sinon les crêtes au-dessus de 0 dB sont écrêtées.
Avec la version de FFmpeg de Dérush, -vsync n'existe plus : écris -fps_mode passthrough (ou cfr).
Réponse en JSON ; code 1 en cas d'erreur.`;

const args = process.argv.slice(2);
aide(args, AIDE, {siVide: true});
const cmd = args.shift();
const {opt, drapeau} = options(args);
const sortir = (o, code = 0) => { console.log(JSON.stringify(o, null, 2)); process.exit(code); };
try {
  const {voixClaire, mixer, bilanSon} = await import('../lib/son.mjs');
  if (cmd === 'clair') {
    const force = opt('--force') ?? 'auto';
    const debut = opt('--debut');
    const duree = opt('--duree');
    const echo = drapeau('--echo');
    const [entree, sortie] = args;
    if (!entree || !sortie) throw new Error('Usage : derush-son clair <entrée> <sortie.wav> [--force auto|leger|doux|normal|fort] [--echo] [--debut s] [--duree s] (derush-son --help)');
    if (!['auto', 'leger', 'doux', 'normal', 'fort'].includes(force)) throw new Error(`Force inconnue : ${force} (auto, leger, doux, normal ou fort).`);
    sortir(await voixClaire(entree, sortie, {force, echo, debut: debut != null ? Number(debut) : null, duree: duree != null ? Number(duree) : null}));
  } else if (cmd === 'mixer') {
    const [plan, sortie] = args;
    if (!plan || !sortie) throw new Error('Usage : derush-son mixer <plan.json> <sortie.wav|.m4a> (derush-son --help)');
    sortir(await mixer(JSON.parse(fs.readFileSync(plan, 'utf8')), sortie));
  } else if (cmd === 'mesurer') {
    if (!args[0]) throw new Error('Usage : derush-son mesurer <fichier> (derush-son --help)');
    sortir(await bilanSon(args[0]));
  } else {
    throw new Error(`Commande inconnue : ${cmd}. Commandes : clair, mixer, mesurer (derush-son --help).`);
  }
} catch (e) {
  sortir({erreur: e.message}, 1);
}
