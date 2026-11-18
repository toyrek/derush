// Dérush — l'effaceur de texte incrusté : un rush exporté d'une appli (CapCut, TikTok) avec ses sous-titres ou un titre
// dans l'image, remis propre pour être remonté. Apple Vision lit où est le texte (sur Mac ; sinon une bande donnée),
// LaMa (big-lama, Apache-2.0, en ONNX) refait ce qu'il cachait ; Telea (OpenCV) en secours (outils/effacer.py).
//   - Installé chez l'utilisateur, à des versions relues : onnxruntime et opencv-python-headless dans le Python de
//     Dérush, le modèle (208 Mo, vérifié par son empreinte) dans moteurs/effaceur. Environ 260 Mo en tout.
//   - Installé tout seul avant un montage seulement si un rush du projet a du texte incrusté (repéré à l'import :
//     « incrustes » de analyse.json), sinon d'un clic dans Connexions. L'IA s'en sert par la commande derush-effacer.
//   - Lent : environ 10 minutes pour 30 secondes de vidéo avec LaMa ; seuls les passages montés valent d'être traités.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {DOSSIER_SUPPORT, PYTHON, uv, envUv, lancerPython} from './moteurs.mjs';
import {lireJson, lancer} from './outils.mjs';
import {MAC} from './plateforme.mjs';

export const PAQUETS_EFFACEUR = ['onnxruntime==1.31.1', 'opencv-python-headless==4.14.0.94'];
export const MODELE_EFFACEUR = {
  url: 'https://huggingface.co/Carve/LaMa-ONNX/resolve/c3c0c9e468934d62e79c329e35d82dd09ff8c444/lama_fp32.onnx',
  taille: 208044816,
  sha256: '1faef5301d78db7dda502fe59966957ec4b79dd64e16f03ed96913c7a4eb68d6',
};
export const dossierEffaceur = () => path.join(DOSSIER_SUPPORT, 'moteurs', 'effaceur');
export const cheminModele = () => path.join(dossierEffaceur(), 'lama_fp32.onnx');

let memo = {t: 0, v: null};
/** Les paquets Python de l'effaceur sont-ils là ? (gardé 30 s) */
async function paquetsPresents() {
  if (memo.v != null && Date.now() - memo.t < 30000) return memo.v;
  let v = false;
  if (fs.existsSync(PYTHON)) {
    try {
      const {out} = await lancer(PYTHON, ['-c', 'import importlib.util as u; print(all(u.find_spec(n) for n in ["onnxruntime", "cv2", "numpy"]))']);
      v = String(out).trim() === 'True';
    } catch { /* environnement abîmé */ }
  }
  memo = {t: Date.now(), v};
  return v;
}
const modelePresent = () => { try { return fs.statSync(cheminModele()).size === MODELE_EFFACEUR.taille; } catch { return false; } };

/** L'état pour Connexions et avant un montage : {ok, installable, lama, vision, pourquoi}. */
export async function etatEffaceur() {
  const paquets = await paquetsPresents();
  const lama = modelePresent();
  if (paquets && lama) return {ok: true, installable: true, lama: true, vision: MAC, nom: 'Effaceur de texte (LaMa)', detail: MAC ? 'Apple Vision trouve le texte, LaMa refait l’image dessous.' : 'Donne la bande à vider ; LaMa refait l’image dessous.'};
  return {ok: false, installable: !!uv(), lama, vision: MAC, taille: '260 Mo', pourquoi: paquets ? 'Le modèle de l’effaceur n’est pas encore téléchargé.' : 'L’effaceur de texte n’est pas encore installé.'};
}

/** Un rush du projet a-t-il du texte incrusté (titre, sous-titres d'une appli) repéré à l'import ? */
export function projetATexteIncruste(P) {
  return (P.d.medias ?? []).some((m) => (lireJson(path.join(P.cache, 'medias', m.id, 'analyse.json'))?.incrustes?.texte ?? []).length > 0);
}

/** Télécharge le modèle à son adresse figée, en vérifiant sa taille et son empreinte (rien n'est gardé sinon). */
export async function telechargerModele(prog = () => {}) {
  if (modelePresent()) return;
  fs.mkdirSync(dossierEffaceur(), {recursive: true});
  const part = `${cheminModele()}.part`;
  const local = process.env.DERUSH_EFFACEUR_MODELE; // les essais : une copie déjà vérifiée, sans réseau
  if (local) fs.copyFileSync(local, part);
  else {
    const r = await fetch(MODELE_EFFACEUR.url, {signal: AbortSignal.timeout(30 * 60e3)});
    if (!r.ok || !r.body) throw new Error(`le modèle n’a pas pu être téléchargé (${r.status}).`);
    let recu = 0;
    const suivi = new TransformStream({transform(morceau, c) { recu += morceau.byteLength; prog(recu / MODELE_EFFACEUR.taille); c.enqueue(morceau); }});
    await pipeline(Readable.fromWeb(r.body.pipeThrough(suivi)), fs.createWriteStream(part));
  }
  const empreinte = crypto.createHash('sha256').update(fs.readFileSync(part)).digest('hex');
  if (fs.statSync(part).size !== MODELE_EFFACEUR.taille || empreinte !== MODELE_EFFACEUR.sha256) {
    fs.rmSync(part, {force: true});
    throw new Error('le modèle téléchargé ne correspond pas à celui qui a été vérifié : rien n’est gardé.');
  }
  fs.renameSync(part, cheminModele());
}

let installation = null;
/** Installe l'effaceur : ses paquets dans le Python de Dérush, puis le modèle. */
export function installerEffaceur(prog = () => {}) {
  installation ??= (async () => {
    const u = uv();
    if (!u) throw new Error('L’outil « uv » est introuvable : installe d’abord les moteurs de Dérush (Connexions).');
    if (!fs.existsSync(PYTHON)) await lancer(u, ['venv', '--python', '3.12', path.dirname(path.dirname(PYTHON))], {env: envUv()});
    prog(0.02);
    const paquets = [...PAQUETS_EFFACEUR, 'numpy', ...(MAC ? ['pyobjc-framework-Vision', 'pyobjc-framework-Quartz'] : [])];
    try {
      await lancer(u, ['pip', 'install', '--python', PYTHON, ...paquets], {env: envUv(), dureeMax: 20 * 60e3});
    } catch (e) {
      throw new Error(`L’effaceur n’a pas pu s’installer (il faut Internet) : ${String(e.message).slice(0, 300)}`);
    }
    memo.t = 0;
    prog(0.15);
    try { await telechargerModele((p) => prog(0.15 + p * 0.85)); } catch (e) { throw new Error(`L’effaceur : ${e.message}`); }
    prog(1);
    return etatEffaceur();
  })().finally(() => { installation = null; });
  return installation;
}

/**
 * Efface le texte incrusté d'une vidéo (outils/effacer.py) : {de, a} le passage (le reste est recopié), `zone` une bande
 * à vider (fractions « x,y,l,h »), `methode` auto | lama | telea. Renvoie le compte rendu du script.
 */
export async function effacer(entree, sortie, {de = 0, a = null, zone = null, methode = 'auto', cache = null} = {}, prog = () => {}) {
  const e = await etatEffaceur();
  const telea = methode === 'telea';
  if (!e.ok && !(telea && await paquetsPresents())) throw new Error(`${e.pourquoi} Connexions › Effaceur de texte › Installer (${e.taille ?? '260 Mo'}).`);
  const args = [entree, sortie, '--de', String(de), ...(a != null ? ['--a', String(a)] : []), ...(zone ? ['--zone', String(zone)] : []), '--methode', methode,
    ...(modelePresent() ? ['--modele', cheminModele()] : []), ...(cache ? ['--cache', cache] : [])];
  const {out} = await lancerPython('effacer.py', args, prog);
  const ligne = String(out).trim().split('\n').reverse().find((l) => l.startsWith('{'));
  const r = ligne ? JSON.parse(ligne) : null;
  if (!r?.ok) throw new Error(r?.erreur ?? 'L’effaceur n’a pas fini.');
  return r;
}
