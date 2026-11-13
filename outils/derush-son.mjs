#!/usr/bin/env node
// Dérush — la commande « derush-son », donnée à l'IA (et utilisable à la main) :
//   derush-son clair <entrée> <sortie.wav|.flac> [--force doux|normal|fort] [--echo] [--debut s] [--duree s]
//       la voix claire : souffle retiré, écho réduit (option), voix désembouée, compressée, à −16 LUFS, parfaitement synchrone
//   derush-son mixer <plan.json> <sortie.wav|.m4a>
//       le mixage : pistes posées dans le temps, musique baissée sous la voix, −14 LUFS, crête −1 dBTP
//       plan.json = {"duree": 46, "pistes": [{"fichier": "voix.wav", "role": "voix"}, {"fichier": "musique.mp3", "role": "musique", "gain_db": -6, "fondu_sortie": 2, "longueur": 46}, {"fichier": "clic.wav", "role": "effet", "debut": 3.2, "gain_db": -8}]}
//   derush-son mesurer <fichier>
//       le volume (LUFS), les crêtes (dBTP), la plage, et ce qu'il faut corriger
// Tout se passe sur l'ordinateur (FFmpeg ; Python de Dérush pour l'écho). Réponse en JSON sur la sortie.
import {voixClaire, mixer, bilanSon} from '../lib/son.mjs';
import fs from 'node:fs';

const args = process.argv.slice(2);
const cmd = args.shift();
const opt = (nom) => { const i = args.indexOf(nom); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const drapeau = (nom) => { const i = args.indexOf(nom); if (i < 0) return false; args.splice(i, 1); return true; };
const sortir = (o, code = 0) => { console.log(JSON.stringify(o, null, 2)); process.exit(code); };
try {
  if (cmd === 'clair') {
    const force = opt('--force') ?? 'normal';
    const debut = opt('--debut');
    const duree = opt('--duree');
    const echo = drapeau('--echo');
    const [entree, sortie] = args;
    if (!entree || !sortie) throw new Error('Usage : derush-son clair <entrée> <sortie.wav> [--force doux|normal|fort] [--echo] [--debut s] [--duree s]');
    sortir(await voixClaire(entree, sortie, {force, echo, debut: debut != null ? Number(debut) : null, duree: duree != null ? Number(duree) : null}));
  } else if (cmd === 'mixer') {
    const [plan, sortie] = args;
    if (!plan || !sortie) throw new Error('Usage : derush-son mixer <plan.json> <sortie.wav|.m4a>');
    sortir(await mixer(JSON.parse(fs.readFileSync(plan, 'utf8')), sortie));
  } else if (cmd === 'mesurer') {
    if (!args[0]) throw new Error('Usage : derush-son mesurer <fichier>');
    sortir(await bilanSon(args[0]));
  } else {
    throw new Error('Commandes : clair, mixer, mesurer (voir l’en-tête de outils/derush-son.mjs).');
  }
} catch (e) {
  sortir({erreur: e.message}, 1);
}
