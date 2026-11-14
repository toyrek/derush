// Dérush — le relais de rendu, pour une IA qui travaille dans un bac à sable (Codex, Gemini).
// Dans le bac à sable, le navigateur qui dessine les images (Chrome sans fenêtre) ne peut pas démarrer. Le script
// remotion/rendre.mjs demande alors le rendu à ce relais, qui le fait hors du bac à sable et lui renvoie sa sortie.
// Deux chemins pour la même demande :
//   - une adresse locale (http://127.0.0.1:…), pour un bac à sable qui garde le réseau local (Codex) ;
//   - « la boîte » : un dossier du dossier de travail (rendu/.relais/) où l'IA dépose sa demande dans un fichier et lit
//     la réponse dans un autre. C'est le seul chemin dans le bac à sable de Gemini (agy), qui coupe le réseau local.
// Ce que le relais accepte, et rien d'autre :
//   - une demande qui porte le jeton donné à cette IA pour ce travail (inconnu de toute autre page ou programme) ;
//   - le rendu d'une composition du kit de CE dossier de travail, vers un fichier .mp4 de CE dossier ;
//   - avec le script de rendu de Dérush lui-même (recopié depuis l'app à chaque rendu), pas celui du dossier de travail :
//     ce que l'IA a écrit ne tourne que dans le navigateur de rendu, jamais comme programme sur l'ordinateur ;
//   - l'envoi d'une vidéo du projet sur YouTube (route /youtube), seulement quand l'humain a demandé YouTube dans ce
//     message, et jamais en public s'il a choisi une autre visibilité : la clé Treg reste hors du bac à sable ;
//   - pour un bac à sable qui ne lit pas tout l'ordinateur (Gemini) : aucun lien de remotion/public ou de remotion/src
//     vers un fichier que l'IA n'a pas le droit de lire. Le rendu se fait hors du bac à sable et sert ces dossiers au
//     navigateur de rendu, liens suivis : un tel lien ferait passer le fichier dans la vidéo rendue.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {RACINE_APP} from './moteurs.mjs';
import {dossierMoteurRendu} from './rendu.mjs';
import {arreterArbre, pathAvec, WINDOWS} from './plateforme.mjs';
import {preparerEnvoi, envoyerSurYouTube, dejaEnvoyee} from './youtube.mjs';

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
  // le fichier de sortie : dans le dossier de travail, en .mp4 ; un chemin relatif part du dossier où l'IA a lancé la commande.
  // Ce dossier arrive sous son vrai chemin (getcwd), le dossier de travail peut être atteint par un lien (un Dropbox, une
  // bibliothèque posée par un lien) : on compare les vrais chemins, puis on repart du dossier de travail tel qu'on le nomme.
  const vrai = (d) => { try { return fs.realpathSync(d); } catch { return path.resolve(d); } };
  const [A, C] = [vrai(atelier), cwd && typeof cwd === 'string' && path.isAbsolute(cwd) ? vrai(cwd) : null];
  const depart = C && (C === A || dedans(A, C)) ? path.join(atelier, path.relative(A, C)) : path.join(atelier, 'remotion');
  let sortie = path.resolve(depart, reste[1] ?? path.join(atelier, 'rendu', 'montage.mp4'));
  if (!dedans(atelier, sortie) && dedans(A, sortie)) sortie = path.join(atelier, path.relative(A, sortie)); // donné sous son vrai chemin
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
 * Cherche, dans remotion/public et remotion/src du dossier de travail, un lien qui mène à un fichier que l'IA n'a pas le
 * droit de lire. `lisibles` : les dossiers et fichiers que son bac à sable lui laisse lire (le dossier de travail en
 * fait toujours partie). Les liens posés par Dérush y mènent tous : public/plans → ../../plans, un très gros rush lié
 * depuis son disque, une pièce jointe, la bibliothèque de sons. Un dossier lié est visité à son tour (un lien peut en
 * cacher un autre). Renvoie le premier lien refusé (son chemin dans le dossier de travail), ou null. Un fichier de clés
 * (.env…) est toujours refusé.
 */
export function lienInterdit(atelier, lisibles = []) {
  const vrai = (d) => { try { return fs.realpathSync(d); } catch { return null; } };
  const racine = vrai(atelier);
  if (!racine) return null;
  const permis = [racine, ...lisibles.map(vrai).filter(Boolean)];
  const lisible = (r) => !/^\.env(\.|$)/i.test(path.basename(r)) && permis.some((d) => r === d || dedans(d, r));
  const vus = new Set();
  let reste = 300000; // au-delà (un dossier lié sans fin), on ne peut plus tout vérifier : le rendu est refusé
  const visiter = (dossier, nom) => {
    const r = vrai(dossier);
    if (!r || vus.has(r)) return null;
    vus.add(r);
    let noms = [];
    try { noms = fs.readdirSync(dossier); } catch { return null; }
    for (const n of noms) {
      if (--reste < 0) return `${nom} (trop de fichiers à vérifier)`;
      const f = path.join(dossier, n);
      let st;
      try { st = fs.lstatSync(f); } catch { continue; }
      if (st.isSymbolicLink()) {
        const cible = vrai(f);
        if (!cible) continue; // un lien cassé ne se lit pas
        if (!lisible(cible)) return `${nom}/${n}`;
        let dossierLie = false;
        try { dossierLie = fs.statSync(cible).isDirectory(); } catch { /* disparu entre-temps */ }
        if (dossierLie) { const x = visiter(f, `${nom}/${n}`); if (x) return x; }
      } else if (st.isDirectory()) { const x = visiter(f, `${nom}/${n}`); if (x) return x; }
    }
    return null;
  };
  return visiter(path.join(atelier, 'remotion', 'public'), 'remotion/public') ?? visiter(path.join(atelier, 'remotion', 'src'), 'remotion/src');
}

/** La boîte du relais : le dossier, dans le dossier de travail, où une IA sans réseau local dépose ses demandes. */
export const dossierBoite = (atelier) => path.join(atelier, 'rendu', '.relais');

/** Une réponse écrite au fil de l'eau, vers une liaison HTTP. */
const versHttp = (res) => ({
  get parti() { return res.destroyed; },
  debuter() { if (!res.headersSent) res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}); },
  ecrire(t) { if (!res.destroyed) res.write(t); },
  finir(t) { if (!res.destroyed) res.end(t); },
  refuser(code, message) { res.writeHead(code, {'Content-Type': 'text/plain; charset=utf-8'}); res.end(`${message}\n`); },
  surAbandon(f) { res.on('close', f); },
});
/**
 * La même réponse, vers un fichier de la boîte (déjà ouvert : `fd`). La commande de l'IA donne un signe de vie toutes
 * les 3 secondes dans le fichier `battement` : si elle se tait 30 secondes, c'est qu'elle a été arrêtée.
 */
function versFichier(fd, battement, surCloture = () => {}) {
  let ferme = false;
  let parti = false;
  const abandons = [];
  const debut = Date.now();
  const veille = setInterval(() => {
    let age;
    try { age = Date.now() - fs.statSync(battement).mtimeMs; } catch { age = Date.now() - debut; }
    if (age > 30000 && !ferme && !parti) { parti = true; for (const f of abandons) f(); }
  }, 5000);
  veille.unref?.();
  const clore = () => { if (ferme) return; ferme = true; clearInterval(veille); try { fs.closeSync(fd); } catch { /* déjà fermé */ } surCloture(); };
  return {
    get parti() { return parti; },
    debuter() { /* rien à annoncer : le fichier existe déjà */ },
    ecrire(t) { if (!ferme) { try { fs.writeSync(fd, t); } catch { /* la boîte a été retirée */ } } },
    finir(t) { this.ecrire(t); clore(); },
    refuser(code, message) { this.finir(`${message}\n##DERUSH-RELAIS code=1##\n`); },
    surAbandon(f) { abandons.push(f); },
  };
}

/**
 * Ouvre le relais pour un dossier de travail. Renvoie {url, jeton, boite, fermer()} : l'adresse (ou le dossier de la
 * boîte, si `boite` est demandé) et le jeton sont donnés à l'IA dans son environnement (DERUSH_RELAIS ou
 * DERUSH_RELAIS_BOITE, et DERUSH_RELAIS_JETON), et fermer() arrête tout à la fin du travail. `lisibles` : ce que le
 * bac à sable de l'IA a le droit de lire, quand il ne lit pas tout (Gemini) ; les liens du kit sont alors vérifiés
 * avant chaque rendu (lienInterdit).
 */
export function ouvrirRelais(atelier, {surRendu = null, youtube = null, boite = false, lisibles = null} = {}) {
  const jeton = crypto.randomBytes(24).toString('hex');
  const enCours = new Set();
  const ouvertes = new Set(); // les réponses de la boîte encore ouvertes (un fichier et une veille chacune)
  let ferme = false;
  let file = Promise.resolve(); // un rendu à la fois : ils prennent toute la machine

  /** L'envoi d'une vidéo du projet sur YouTube, pour une IA qui n'a pas la clé Treg dans son bac à sable. */
  const traiterYoutube = async (recu, s) => {
    const repondre = (r) => { s.debuter(); s.finir(`\n##DERUSH-YOUTUBE ${JSON.stringify(r)}##\n`); };
    let signe = null;
    try {
      if (youtube?.coupe) return repondre({ok: false, raison: 'treg_coupe', message: 'L’humain n’a pas donné Treg à l’IA (Connexions) : rien n’est envoyé.'});
      if (!youtube?.permis) return repondre({ok: false, raison: 'non_demande', message: 'L’humain n’a pas demandé de publier sur YouTube dans ce message : rien n’est envoyé.'});
      const j = typeof recu === 'string' ? JSON.parse(recu) : (recu ?? {});
      // seulement une vidéo du projet (son dossier « vidéos ») ou du dossier de travail
      const reel = fs.realpathSync(path.resolve(String(j.fichier ?? '')));
      const permis = [atelier, youtube.videos].filter(Boolean).map((d) => { try { return fs.realpathSync(d); } catch { return null; } }).filter(Boolean);
      if (!permis.some((d) => dedans(d, reel))) return repondre({ok: false, raison: 'fichier', message: 'Cette vidéo n’est pas dans le projet : envoi refusé.'});
      const demande = preparerEnvoi({...j, fichier: reel});
      if (demande.visibilite === 'public' && youtube.visibilite && youtube.visibilite !== 'public') return repondre({ok: false, raison: 'visibilite', message: 'L’humain n’a pas choisi « publique » pour YouTube : envoi refusé.'});
      s.debuter();
      s.ecrire('Dérush envoie la vidéo sur YouTube pour toi, hors du bac à sable…\n');
      if (j.encore === true || !dejaEnvoyee(demande)) youtube.surEnvoi?.(demande.titre);
      // des nouvelles régulières : l'avancement tous les 10 %, et un signe de vie si rien ne bouge (liaison gardée ouverte)
      let dernier = Date.now();
      let dit = -1;
      const ecrire = (t) => { s.ecrire(t); dernier = Date.now(); };
      signe = setInterval(() => { if (Date.now() - dernier > 14000) ecrire('.'); }, 5000);
      const r = await envoyerSurYouTube(demande, {encore: j.encore === true, surAvance: (p) => { const pc = Math.floor(p * 10) * 10; if (pc !== dit) { dit = pc; ecrire(`envoi : ${pc} %\n`); } }});
      clearInterval(signe);
      repondre({ok: true, ...r});
    } catch (e) {
      clearInterval(signe);
      repondre({ok: false, raison: e.raison ?? 'envoi', message: e.message});
    }
  };

  /** Le rendu d'une composition du kit de ce dossier de travail, avec le script de rendu de Dérush. */
  const traiterRendu = (recu, s) => {
    let args;
    try { args = argumentsRendu(atelier, typeof recu === 'string' ? JSON.parse(recu) : (recu ?? {})); } catch (e) { return s.refuser(400, `Rendu refusé : ${e.message}`); }
    // les liens du kit : vérifiés à la demande, puis de nouveau juste avant le rendu et à sa fin, car l'IA continue de
    // travailler pendant qu'un rendu attend son tour (un autre rendu passe avant) ou se fait
    const lienRefuse = () => { if (!lisibles) return null; try { return lienInterdit(atelier, lisibles); } catch (e) { return `remotion (${e.message})`; } };
    const refus = (lien) => `Rendu refusé : ${lien} est un lien vers un fichier hors de ce que tu as le droit de lire. Retire ce lien ; s’il te faut un fichier du dossier de travail, copie-le dans remotion/public au lieu de le lier.`;
    const lien = lienRefuse();
    if (lien) return s.refuser(400, refus(lien));
    s.debuter();
    s.ecrire('Dérush rend la vidéo pour toi, hors du bac à sable…\n');
    // tant que le rendu ne dit rien (assemblage du projet), un signe de vie garde la liaison ouverte
    let dernier = Date.now();
    const signe = setInterval(() => { if (!s.parti && Date.now() - dernier > 14000) { s.ecrire('.'); dernier = Date.now(); } }, 5000);
    file = file.then(() => new Promise((ok) => {
      // la commande a été abandonnée pendant qu'elle attendait son tour, ou le travail est fini : la réponse est close
      // (son fichier et sa veille avec), et aucun rendu ne part
      if (s.parti || ferme) { clearInterval(signe); s.finir(''); return ok(); }
      const avant = lienRefuse();
      if (avant) { clearInterval(signe); s.finir(`${refus(avant)}\n##DERUSH-RELAIS code=1##\n`); return ok(); }
      // le script de rendu est celui de l'app, recopié à côté du moteur (là où sont ses modules)
      const script = path.join(dossierMoteurRendu(), 'rendre-relais.mjs');
      const debut = Date.now();
      let proc;
      try {
        fs.copyFileSync(path.join(RACINE_APP, 'modeles', 'kit-remotion', 'rendre.mjs'), script);
        const env = pathAvec([path.dirname(process.execPath)]);
        for (const k of ['DERUSH_RELAIS', 'DERUSH_RELAIS_BOITE', 'DERUSH_RELAIS_JETON']) delete env[k];
        env.DERUSH_PROJET_REMOTION = path.join(atelier, 'remotion');
        proc = spawn(process.execPath, [script, ...args], {cwd: path.join(atelier, 'remotion'), env, stdio: ['ignore', 'pipe', 'pipe'], detached: !WINDOWS, windowsHide: true});
      } catch (e) {
        clearInterval(signe);
        s.finir(`Le rendu n’a pas pu démarrer : ${e.message}\n##DERUSH-RELAIS code=1##\n`);
        return ok();
      }
      enCours.add(proc);
      surRendu?.(args[0]);
      const ecrire = (d) => { s.ecrire(d); dernier = Date.now(); };
      proc.stdout.on('data', ecrire);
      proc.stderr.on('data', ecrire);
      const finir = (code) => {
        clearInterval(signe);
        enCours.delete(proc);
        // un lien interdit posé pendant le rendu : la vidéo (et les petites images du direct) ont pu lire son fichier, elles
        // sont retirées
        const apres = lienRefuse();
        if (apres) {
          // seulement ce qui est réellement dans le dossier de travail (l'IA a pu changer un dossier en lien entre-temps)
          const reelDedans = (f) => { try { const r = fs.realpathSync(atelier); const d = fs.realpathSync(f); return d === r || dedans(r, d); } catch { return false; } };
          try { if (reelDedans(path.dirname(args[1])) && !fs.lstatSync(args[1]).isSymbolicLink()) fs.rmSync(args[1], {force: true}); } catch { /* déjà retirée */ }
          const direct = path.join(atelier, 'rendu', '.direct');
          try { if (reelDedans(direct)) for (const n of fs.readdirSync(direct)) { const d = path.join(direct, n); if (fs.lstatSync(d).mtimeMs >= debut - 1000) fs.rmSync(d, {recursive: true, force: true}); } } catch { /* pas de direct */ }
          s.finir(`\n${refus(apres)} La vidéo de ce rendu est retirée.\n##DERUSH-RELAIS code=1##\n`);
          return ok();
        }
        s.finir(`\n##DERUSH-RELAIS code=${code ?? 1}##\n`);
        ok();
      };
      proc.on('error', () => finir(1));
      proc.on('close', finir);
      // l'IA a abandonné sa commande : le rendu s'arrête aussi
      s.surAbandon(() => { if (enCours.has(proc)) arreterArbre(proc); });
    }));
  };

  // la boîte : on regarde quatre fois par seconde si une demande a été déposée
  let dossier = null;
  let minuteur = null;
  const saine = () => { try { return fs.lstatSync(dossier).isDirectory() && dedans(fs.realpathSync(atelier), fs.realpathSync(dossier)); } catch { return false; } };
  if (boite) {
    dossier = dossierBoite(atelier);
    try {
      // jamais à travers un lien que l'IA aurait posé : la boîte est un vrai dossier, réellement dans le dossier de travail
      if (fs.existsSync(dossier) && saine()) fs.rmSync(dossier, {recursive: true, force: true});
      fs.mkdirSync(dossier, {recursive: true});
    } catch { /* dossier en lecture seule */ }
    if (!saine()) dossier = null;
  }
  if (dossier) {
    const vues = new Set();
    minuteur = setInterval(() => {
      if (!saine()) return;
      let noms = [];
      try { noms = fs.readdirSync(dossier); } catch { return; }
      for (const n of noms) {
        const id = /^demande-([a-f0-9]{16,64})\.json$/.exec(n)?.[1];
        if (!id || vues.has(id)) continue;
        vues.add(id);
        const f = path.join(dossier, n);
        let j = null;
        try { const st = fs.lstatSync(f); if (st.isFile() && st.size <= 200000) j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* demande illisible */ }
        try { fs.unlinkSync(f); } catch { /* déjà partie */ }
        // la réponse : un fichier neuf, créé ici (jamais un lien posé d'avance vers un autre fichier)
        let fd;
        try { fd = fs.openSync(path.join(dossier, `reponse-${id}.txt`), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o644); } catch { continue; }
        const s = versFichier(fd, path.join(dossier, `battement-${id}`), () => ouvertes.delete(s));
        ouvertes.add(s);
        if (!j || !memeJeton(j.jeton, jeton)) s.refuser(403, 'Jeton refusé.');
        else if (j.route === 'rendre') traiterRendu(j.corps, s);
        else if (j.route === 'youtube') traiterYoutube(j.corps, s);
        else s.refuser(404, 'Route inconnue.');
      }
    }, 250);
  }
  const fermerBoite = () => {
    if (minuteur) clearInterval(minuteur);
    try { if (dossier && saine()) fs.rmSync(dossier, {recursive: true, force: true}); } catch { /* sans importance */ }
  };

  const serveur = http.createServer((req, res) => {
    const s = versHttp(res);
    if (req.method !== 'POST' || !['/rendre', '/youtube'].includes(req.url)) return s.refuser(404, 'Route inconnue.');
    if (!memeJeton(req.headers['x-derush-relais'], jeton)) return s.refuser(403, 'Jeton refusé.');
    let corps = '';
    req.on('data', (d) => { corps += d; if (corps.length > 200000) req.destroy(); });
    req.on('end', () => (req.url === '/youtube' ? traiterYoutube(corps, s) : traiterRendu(corps, s)));
  });
  return new Promise((ok, ko) => {
    serveur.once('error', ko);
    serveur.listen(0, '127.0.0.1', () => ok({
      url: `http://127.0.0.1:${serveur.address().port}`, jeton, boite: dossier,
      fermer() {
        ferme = true;
        for (const p of enCours) arreterArbre(p);
        // les réponses de la boîte encore ouvertes (un rendu qui attendait son tour, un envoi en cours) : closes ici
        for (const s of [...ouvertes]) s.finir('');
        fermerBoite(); serveur.close(); serveur.closeAllConnections?.();
      },
    }));
  });
}
