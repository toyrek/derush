// Dérush — le relais de rendu, pour une IA qui travaille dans un bac à sable (Codex).
// Dans le bac à sable, le navigateur qui dessine les images (Chrome sans fenêtre) ne peut pas démarrer. Le script
// remotion/rendre.mjs demande alors le rendu à ce relais, qui le fait hors du bac à sable et lui renvoie sa sortie.
// Ce que le relais accepte, et rien d'autre :
//   - une demande qui porte le jeton donné à cette IA pour ce travail (inconnu de toute autre page ou programme) ;
//   - le rendu d'une composition du kit de CE dossier de travail, vers un fichier .mp4 de CE dossier ;
//   - avec le script de rendu de Dérush lui-même (recopié depuis l'app à chaque rendu), pas celui du dossier de travail :
//     ce que l'IA a écrit ne tourne que dans le navigateur de rendu, jamais comme programme sur l'ordinateur.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {RACINE_APP} from './moteurs.mjs';
import {dossierMoteurRendu} from './rendu.mjs';
import {arreterArbre, pathAvec, WINDOWS} from './plateforme.mjs';

const dedans = (dossier, f) => { const rel = path.relative(dossier, f); return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel); };
const memeJeton = (a, b) => { const x = Buffer.from(String(a ?? '')); const y = Buffer.from(String(b ?? '')); return x.length === y.length && crypto.timingSafeEqual(x, y); };

/** Vérifie une demande de rendu et renvoie les arguments sûrs pour le script de rendu. */
export function argumentsRendu(atelier, {args = [], cwd = null} = {}) {
  if (!Array.isArray(args) || args.length > 12 || args.some((a) => typeof a !== 'string' || a.length > 20000)) throw new Error('Demande de rendu illisible.');
  const reste = [...args];
  const option = (nom) => { const i = reste.indexOf(nom); if (i < 0) return null; const v = reste[i + 1]; reste.splice(i, 2); return v ?? null; };
  const props = option('--props') ?? '{}';
  const titre = option('--titre');
  const crf = Number(option('--crf') ?? 16);
  try { if (typeof JSON.parse(props) !== 'object') throw new Error('objet attendu'); } catch { throw new Error('--props doit être un objet JSON.'); }
  if (!(crf >= 0 && crf <= 51)) throw new Error('--crf doit être entre 0 et 51.');
  if (reste.some((a) => a.startsWith('--'))) throw new Error(`Option inconnue : ${reste.find((a) => a.startsWith('--'))}.`);
  const composition = reste[0] ?? 'Montage';
  if (!/^[\w-]{1,80}$/.test(composition)) throw new Error('Nom de composition invalide.');
  // le fichier de sortie : dans le dossier de travail, en .mp4 ; un chemin relatif part du dossier où l'IA a lancé la commande
  const depart = cwd && path.isAbsolute(cwd) && (path.resolve(cwd) === path.resolve(atelier) || dedans(atelier, path.resolve(cwd))) ? path.resolve(cwd) : path.join(atelier, 'remotion');
  const sortie = path.resolve(depart, reste[1] ?? path.join(atelier, 'rendu', 'montage.mp4'));
  if (!dedans(atelier, sortie) || !/\.mp4$/i.test(sortie)) throw new Error('La vidéo doit être rendue en .mp4, dans le dossier de travail (rendu/…).');
  // pas de lien qui mène ailleurs : le dossier d'arrivée doit être réellement dans le dossier de travail
  if (fs.existsSync(atelier)) {
    let parent = path.dirname(sortie);
    while (!fs.existsSync(parent)) parent = path.dirname(parent);
    const racine = fs.realpathSync(atelier);
    const reel = fs.realpathSync(parent);
    if (reel !== racine && !dedans(racine, reel)) throw new Error('Le dossier de la vidéo mène hors du dossier de travail.');
    let lien = false;
    try { lien = fs.lstatSync(sortie).isSymbolicLink(); } catch { /* le fichier n'existe pas encore */ }
    if (lien) throw new Error('Le fichier de sortie est un lien : choisis un autre nom.');
  }
  return [composition, sortie, '--props', props, '--crf', String(crf), ...(titre ? ['--titre', titre.slice(0, 120)] : [])];
}

/**
 * Ouvre le relais pour un dossier de travail. Renvoie {url, jeton, fermer()} : l'adresse et le jeton sont donnés à l'IA
 * dans son environnement (DERUSH_RELAIS, DERUSH_RELAIS_JETON), et fermer() arrête tout à la fin du travail.
 */
export function ouvrirRelais(atelier, {surRendu = null} = {}) {
  const jeton = crypto.randomBytes(24).toString('hex');
  const enCours = new Set();
  let file = Promise.resolve(); // un rendu à la fois : ils prennent toute la machine
  const serveur = http.createServer((req, res) => {
    const refuser = (code, message) => { res.writeHead(code, {'Content-Type': 'text/plain; charset=utf-8'}); res.end(`${message}\n`); };
    if (req.method !== 'POST' || req.url !== '/rendre') return refuser(404, 'Route inconnue.');
    if (!memeJeton(req.headers['x-derush-relais'], jeton)) return refuser(403, 'Jeton refusé.');
    let corps = '';
    req.on('data', (d) => { corps += d; if (corps.length > 200000) req.destroy(); });
    req.on('end', () => {
      let args;
      try { args = argumentsRendu(atelier, JSON.parse(corps)); } catch (e) { return refuser(400, `Rendu refusé : ${e.message}`); }
      res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'});
      res.write('Dérush rend la vidéo pour toi, hors du bac à sable…\n');
      // tant que le rendu ne dit rien (assemblage du projet), un signe de vie garde la liaison ouverte
      let dernier = Date.now();
      const signe = setInterval(() => { if (!res.destroyed && Date.now() - dernier > 14000) { res.write('.'); dernier = Date.now(); } }, 5000);
      file = file.then(() => new Promise((ok) => {
        if (res.destroyed) { clearInterval(signe); return ok(); }
        // le script de rendu est celui de l'app, recopié à côté du moteur (là où sont ses modules)
        const script = path.join(dossierMoteurRendu(), 'rendre-relais.mjs');
        let proc;
        try {
          fs.copyFileSync(path.join(RACINE_APP, 'modeles', 'kit-remotion', 'rendre.mjs'), script);
          const env = pathAvec([path.dirname(process.execPath)]);
          delete env.DERUSH_RELAIS;
          delete env.DERUSH_RELAIS_JETON;
          env.DERUSH_PROJET_REMOTION = path.join(atelier, 'remotion');
          proc = spawn(process.execPath, [script, ...args], {cwd: path.join(atelier, 'remotion'), env, stdio: ['ignore', 'pipe', 'pipe'], detached: !WINDOWS, windowsHide: true});
        } catch (e) {
          clearInterval(signe);
          res.end(`Le rendu n’a pas pu démarrer : ${e.message}\n##DERUSH-RELAIS code=1##\n`);
          return ok();
        }
        enCours.add(proc);
        surRendu?.(args[0]);
        const ecrire = (d) => { if (!res.destroyed) { res.write(d); dernier = Date.now(); } };
        proc.stdout.on('data', ecrire);
        proc.stderr.on('data', ecrire);
        const finir = (code) => {
          clearInterval(signe);
          enCours.delete(proc);
          if (!res.destroyed) res.end(`\n##DERUSH-RELAIS code=${code ?? 1}##\n`);
          ok();
        };
        proc.on('error', () => finir(1));
        proc.on('close', finir);
        // l'IA a abandonné sa commande : le rendu s'arrête aussi
        res.on('close', () => { if (enCours.has(proc)) arreterArbre(proc); });
      }));
    });
  });
  return new Promise((ok, ko) => {
    serveur.once('error', ko);
    serveur.listen(0, '127.0.0.1', () => ok({
      url: `http://127.0.0.1:${serveur.address().port}`, jeton,
      fermer() { for (const p of enCours) arreterArbre(p); serveur.close(); serveur.closeAllConnections?.(); },
    }));
  });
}
