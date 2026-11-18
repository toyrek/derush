#!/usr/bin/env node
// derush-gemini — demander à Gemini, le réalisateur de l'équipe, ce qu'il voit ET entend (Mode Hollywood de Dérush).
//
//   derush-gemini <rush | fichier> <de> <à> "ta question"
//   derush-gemini --controle <ta vidéo finale> ["son titre"]
//
//   <rush>     l'id d'un rush du pack (M12 : le fichier plans/M12-….mp4), ou le chemin d'une vidéo ou d'un son
//              (rendu/final.mp4, une voix .m4a…)
//   <de> <à>   le passage, en secondes depuis le début du fichier (90 secondes au plus par question)
//
// Exemples :
//   derush-gemini M12 4 18 "À quel moment il éclate de rire ? Donne le temps."
//   derush-gemini M3 0 30 "La voix est-elle propre, ou couverte par le vent ou la foule ?"
//   derush-gemini rendu/final.mp4 0 3 "Le titre se lit-il en entier, sans rien qui le cache ?"
//   derush-gemini --controle rendu/final.mp4 "Vlog Osaka"
//
// --controle : avant de livrer, le réalisateur regarde et écoute ta vidéo en entier (15 minutes au plus) et rend sa
// note sur 10, ce qui marche et ce qui coince, et ses remarques avec les temps (« à corriger » ou « à regarder »).
// Jusqu'à 8 sur 10 : sous 8, corrige ce qu'il marque « à corriger », rends de nouveau et relance le contrôle ; deux
// passes de correction au plus. La dernière ligne (« Verdict ») dit où tu en es.
//
// Le passage part chez Gemini (une version légère : 720 px, image et son), avec ta question : par la commande Gemini
// (le compte Google de la personne), sinon par sa clé. La réponse arrive en français ; ses temps sont comptés depuis le
// début du fichier (pas du passage). Ce sont des repères, à une image par seconde : vérifie-les avec les images avant
// de couper. Seulement quand le Mode Hollywood est allumé dans Dérush (Connexions › Mode Hollywood) ; la clé reste dans
// Dérush, cette commande ne l'affiche jamais.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {aide} from './commande.mjs';

const args = process.argv.slice(2);
const AIDE = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.replace(/^\/\/ ?/, '')).join('\n');
aide(args, AIDE, {siVide: true});
const G = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'gemini-api.mjs')).href);
const sortir = (t, code = 1) => { process.stderr.write(`derush-gemini : ${t}\n`); process.exit(code); };

// Une IA dans un bac à sable (Gemini, Codex) ne peut ni lancer la commande de Google ni joindre son API : la demande
// passe alors par le relais de Dérush (la boîte de fichiers, ou l'adresse locale), qui la fait hors du bac à sable.
const jeton = process.env.DERUSH_RELAIS_JETON;
const relais = jeton && (process.env.DERUSH_RELAIS_BOITE || process.env.DERUSH_RELAIS) ? {boite: process.env.DERUSH_RELAIS_BOITE || null, url: process.env.DERUSH_RELAIS || null} : null;
// Le contrôle « jusqu'à 8 sur 10 » : chaque note du réalisateur est gardée pour ce travail (rendu/controle/
// notes-gemini.jsonl, effacé par Dérush à chaque nouvelle demande). Le verdict dit s'il faut corriger encore.
const RENDU = fs.existsSync('rendu') ? 'rendu' : fs.existsSync(path.join('..', 'rendu')) ? path.join('..', 'rendu') : 'rendu';
const NOTES = path.join(RENDU, 'controle', 'notes-gemini.jsonl');
function verdict(texte, video) {
  const note = Number(/\/10/.test(String(texte)) ? /:\s*(\d+(?:[.,]\d+)?)\/10/.exec(String(texte))?.[1]?.replace(',', '.') : NaN);
  let avant = 0;
  try { avant = fs.readFileSync(NOTES, 'utf8').split('\n').filter(Boolean).length; } catch { /* premier contrôle */ }
  try { fs.mkdirSync(path.dirname(NOTES), {recursive: true}); fs.appendFileSync(NOTES, `${JSON.stringify({video: path.basename(video), note: Number.isFinite(note) ? note : null, le: new Date().toISOString()})}\n`); } catch { /* dossier en lecture seule */ }
  if (!Number.isFinite(note)) return '';
  if (note >= 8) return `\nVerdict : ${note}/10, au moins 8 sur 10 : tu peux livrer. Dis sa note dans ton compte rendu.\n`;
  if (avant >= 2) return `\nVerdict : ${note}/10 après deux passes de correction : livre maintenant, et dis dans ton compte rendu sa note et ce qui reste à améliorer.\n`;
  return `\nVerdict : ${note}/10, sous 8 : corrige ce qu'il marque « à corriger » (les pires d'abord), rends de nouveau et relance ce contrôle (passe de correction ${avant + 1} sur 2).\n`;
}

const parRelais = async (corps) => {
  let ligne = null;
  if (relais.boite) {
    const {demanderParBoite} = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'boite.mjs')).href);
    ligne = await demanderParBoite({boite: relais.boite, jeton, route: 'gemini', corps, surTexte: (t) => process.stderr.write(t)});
  } else {
    const r = await fetch(`${relais.url}/gemini`, {method: 'POST', headers: {'x-derush-relais': jeton, 'content-type': 'application/json'}, body: JSON.stringify(corps)});
    ligne = (await r.text()).split('\n').reverse().find((l) => l.startsWith('##DERUSH-GEMINI')) ?? null;
  }
  const r = JSON.parse(/^##DERUSH-GEMINI (.*)##\s*$/.exec(String(ligne ?? '').trim())?.[1] ?? '{"ok":false,"message":"le relais de Dérush n’a pas répondu."}');
  if (!r.ok) sortir(r.message);
  process.stdout.write(corps.mode === 'controle' ? `${r.texte}${verdict(r.texte, corps.fichier)}` : r.texte);
  process.exit(0);
};
if (!relais && !G.hollywoodActif()) sortir('le Mode Hollywood est coupé dans Dérush (Connexions › Mode Hollywood) : pas de question à Gemini. Fais sans, avec les images et le texte des rushes.');

// le contrôle d'une vidéo finie, en entier
if (args[0] === '--controle') {
  const video = args[1];
  if (!video || !fs.existsSync(video)) sortir(`donne ta vidéo finale : derush-gemini --controle rendu/final.mp4${video ? ` (introuvable : ${video})` : ''}`);
  const titre = args.slice(2).join(' ').trim() || null;
  if (relais) await parRelais({mode: 'controle', fichier: path.resolve(video), titre});
  // pour qui est la vidéo : l'espace du projet, posé dans le dossier de travail (contexte/espace/ESPACE.md)
  let contexte = '';
  for (const f of [path.join('contexte', 'espace', 'ESPACE.md'), path.join('..', 'contexte', 'espace', 'ESPACE.md')]) { try { contexte = fs.readFileSync(f, 'utf8').slice(0, 2500); break; } catch { /* pas ici */ } }
  try { const t = await G.controlerVideo(video, {titre, contexte}); process.stdout.write(`${t}${verdict(t, video)}`); } catch (e) { sortir(e.message); }
  process.exit(0);
}
const [cible, deBrut, aBrut, ...reste] = args;
const question = reste.join(' ').trim();
const de = Number(String(deBrut ?? '').replace(',', '.'));
const a = Number(String(aBrut ?? '').replace(',', '.'));
if (!cible || !Number.isFinite(de) || !Number.isFinite(a) || !question) sortir('il manque quelque chose. Écris : derush-gemini <rush ou fichier> <de> <à> "ta question" (aide : derush-gemini --help).');
if (!(a > de) || de < 0) sortir('le passage doit aller de <de> à <à>, avec <à> plus grand que <de>.');
if (a - de > 90) sortir('90 secondes au plus par question : découpe ton passage.');

// le fichier : un rush du pack (plans/M12-….mp4, depuis le dossier de travail), ou un chemin
let fichier = null;
if (/^M\d+$/.test(cible)) {
  for (const d of ['plans', path.join('..', 'plans')]) {
    try { const n = fs.readdirSync(d).find((x) => x.startsWith(`${cible}-`)); if (n) { fichier = path.join(d, n); break; } } catch { /* pas ici */ }
  }
  if (!fichier) sortir(`le rush ${cible} n'est pas dans plans/ : lance la commande depuis le dossier de travail, ou donne le chemin du fichier.`);
} else fichier = cible;
if (!fs.existsSync(fichier)) sortir(`introuvable : ${fichier}`);
if (relais) await parRelais({mode: 'question', fichier: path.resolve(fichier), de, a, question});
try { process.stdout.write(await G.questionPassage(fichier, {de, a, question})); } catch (e) { sortir(e.message); }
