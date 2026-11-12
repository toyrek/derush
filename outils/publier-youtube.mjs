#!/usr/bin/env node
// Dérush — la commande « derush-youtube » : envoie une vidéo sur YouTube avec Treg. Elle est donnée à l'IA qui publie
// (voir la compétence derush-publier), parce que les outils Treg d'une IA ne montrent pas l'adresse d'envoi que YouTube
// rend dans un en-tête (voir lib/youtube.mjs).
//
//   derush-youtube VIDEO.mp4 --titre "…" [--description "…" | --description-fichier FICHIER] [--tags "mot1,mot2"]
//                  [--visibilite unlisted|public|private] [--ia] [--pour-enfants] [--sans-notifier] [--encore]
//
// Elle répond par UNE ligne JSON sur sa sortie :
//   {"ok": true, "id": "…", "lien": "https://youtu.be/…", "lien_short": "https://youtube.com/shorts/…", "visibilite": "unlisted", "titre": "…"}
//     avec "deja": true si ce fichier avait déjà été envoyé (pas de second envoi sans --encore), et "note" quand il y a
//     quelque chose à redire à l'humain (YouTube l'a gardée en privé, par exemple) ;
//   {"ok": false, "raison": "cle_manquante" | "cle_refusee" | "youtube_non_relie" | "quota" | "treg" | "envoi" | "non_demande" | "visibilite" | "fichier" | "titre"…, "message": "…"}
// et se termine avec le code 0 (publiée) ou 1 (pas publiée). L'avancement va sur la sortie d'erreur.
//
// Deux garde-fous viennent de Dérush, par l'environnement : DERUSH_YOUTUBE_PERMIS=0 quand l'humain n'a pas demandé
// YouTube dans son message (rien ne part), et DERUSH_YOUTUBE_VISIBILITE, la visibilité qu'il a choisie (pas de
// « publique » s'il a choisi autre chose). Hors de Dérush, la commande n'a pas ces limites.
//
// Avec Claude, la clé Treg est dans l'environnement que Dérush lui donne. Avec Codex (bac à sable, sans la clé), la
// commande passe par le relais de Dérush (DERUSH_RELAIS, ou DERUSH_RELAIS_BOITE pour un bac à sable sans réseau local),
// qui fait l'envoi hors du bac à sable.
import fs from 'node:fs';
import path from 'node:path';
import {preparerEnvoi, envoyerSurYouTube} from '../lib/youtube.mjs';

const args = process.argv.slice(2);
const option = (nom) => { const i = args.indexOf(nom); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v ?? null; };
const drapeau = (nom) => { const i = args.indexOf(nom); if (i < 0) return false; args.splice(i, 1); return true; };
const finir = (r) => { process.stdout.write(`${JSON.stringify(r)}\n`); process.exit(r.ok ? 0 : 1); };

if (drapeau('--help') || drapeau('-h') || !args.length) {
  console.error('Usage : derush-youtube VIDEO.mp4 --titre "…" [--description "…" | --description-fichier FICHIER] [--tags "a,b"] [--visibilite unlisted|public|private] [--ia] [--pour-enfants] [--sans-notifier] [--encore]');
  process.exit(args.length ? 0 : 1);
}
const titre = option('--titre');
let description = option('--description') ?? '';
const fichierDescription = option('--description-fichier');
const tags = option('--tags') ?? '';
const visibilite = option('--visibilite') ?? 'unlisted';
const synthetique = drapeau('--ia');
const pourEnfants = drapeau('--pour-enfants');
const notifier = !drapeau('--sans-notifier');
const encore = drapeau('--encore');
const inconnue = args.find((a) => a.startsWith('--'));
if (inconnue) finir({ok: false, raison: 'option', message: `Option inconnue : ${inconnue}.`});
// ce que l'humain a demandé dans ce message, tel que Dérush le sait
if (process.env.DERUSH_YOUTUBE_PERMIS === '0') finir({ok: false, raison: 'non_demande', message: 'L’humain n’a pas demandé de publier sur YouTube dans ce message : rien n’est envoyé. S’il le veut, il doit le redire en nommant YouTube.'});
const choisie = process.env.DERUSH_YOUTUBE_VISIBILITE;
if (visibilite === 'public' && choisie && choisie !== 'public') finir({ok: false, raison: 'visibilite', message: `L’humain a choisi « ${choisie === 'private' ? 'privée' : 'non répertoriée'} » pour YouTube, pas « publique » : envoi refusé. Reprends avec --visibilite ${choisie}.`});
if (fichierDescription) {
  try { description = fs.readFileSync(fichierDescription, 'utf8'); } catch { finir({ok: false, raison: 'description', message: `Fichier de description illisible : ${fichierDescription}.`}); }
}
// la vidéo : le vrai fichier (dans a-publier/, c'est un lien vers le dossier « vidéos » du projet)
let fichier = path.resolve(args[0]);
try { fichier = fs.realpathSync(fichier); } catch { /* preparerEnvoi dira qu'elle est introuvable */ }

let demande;
try { demande = preparerEnvoi({fichier, titre, description, tags, visibilite, pourEnfants, synthetique, notifier}); } catch (e) { finir({ok: false, raison: e.raison ?? 'demande', message: e.message}); }

let dit = -1;
const avance = (p) => { const pc = Math.floor(p * 10) * 10; if (pc !== dit) { dit = pc; process.stderr.write(`envoi : ${pc} %\n`); } };

if (!process.env.TREG_TOKEN && process.env.DERUSH_RELAIS_BOITE && process.env.DERUSH_RELAIS_JETON) {
  // bac à sable sans réseau local (Gemini) : la demande passe par la boîte du relais (des fichiers), Dérush fait l'envoi
  try {
    const {demanderParBoite} = await import('../lib/boite.mjs');
    const ligne = await demanderParBoite({
      boite: process.env.DERUSH_RELAIS_BOITE, jeton: process.env.DERUSH_RELAIS_JETON, route: 'youtube',
      corps: {fichier: demande.fichier, titre: demande.titre, description: demande.description, tags: demande.tags, visibilite: demande.visibilite, pourEnfants, synthetique, notifier, encore},
      surTexte: (t) => process.stderr.write(t),
    });
    const fin = /^##DERUSH-YOUTUBE (\{.*\})##$/.exec(ligne);
    finir(fin ? JSON.parse(fin[1]) : {ok: false, raison: 'relais', message: 'Le relais de Dérush a refusé la demande.'});
  } catch (e) {
    finir({ok: false, raison: 'relais', message: `Le relais de Dérush ne répond pas : ${e.message}`});
  }
}
if (!process.env.TREG_TOKEN && process.env.DERUSH_RELAIS && process.env.DERUSH_RELAIS_JETON) {
  // bac à sable (Codex) : Dérush fait l'envoi de son côté, avec la clé qu'il garde
  try {
    const r = await fetch(`${process.env.DERUSH_RELAIS}/youtube`, {
      method: 'POST', headers: {'content-type': 'application/json', 'x-derush-relais': process.env.DERUSH_RELAIS_JETON},
      body: JSON.stringify({fichier: demande.fichier, titre: demande.titre, description: demande.description, tags: demande.tags, visibilite: demande.visibilite, pourEnfants, synthetique, notifier, encore}),
    });
    const texte = await r.text();
    const fin = /##DERUSH-YOUTUBE (\{.*\})##/s.exec(texte);
    if (fin) finir(JSON.parse(fin[1]));
    finir({ok: false, raison: 'relais', message: texte.replace(/\s+/g, ' ').trim().slice(0, 300) || `Le relais de Dérush a répondu ${r.status}.`});
  } catch (e) {
    finir({ok: false, raison: 'relais', message: `Le relais de Dérush ne répond pas : ${e.message}`});
  }
}
try {
  finir({ok: true, ...(await envoyerSurYouTube(demande, {surAvance: avance, encore}))});
} catch (e) {
  finir({ok: false, raison: e.raison ?? 'envoi', message: e.message});
}
