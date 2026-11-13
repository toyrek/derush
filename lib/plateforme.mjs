// Dérush — ce qui change d'un système à l'autre (macOS, Windows, Linux), rangé au même endroit.
// Tout le reste du code appelle ces fonctions : il ne teste jamais lui-même process.platform.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';

export const SYSTEME = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux';
export const MAC = SYSTEME === 'mac';
export const WINDOWS = SYSTEME === 'windows';
export const NOM_SYSTEME = {mac: 'macOS', windows: 'Windows', linux: 'Linux'}[SYSTEME];
const MAISON = os.homedir();

/** Le dossier où Dérush range ses moteurs, ses clés et ses réglages (jamais dans les projets). */
export function dossierSupport() {
  if (process.env.DERUSH_SUPPORT) return process.env.DERUSH_SUPPORT;
  if (MAC) return path.join(MAISON, 'Library', 'Application Support', 'Dérush');
  if (WINDOWS) return path.join(process.env.APPDATA || path.join(MAISON, 'AppData', 'Roaming'), 'Dérush');
  return path.join(process.env.XDG_DATA_HOME || path.join(MAISON, '.local', 'share'), 'derush');
}
/** Le dossier des projets : Vidéos/Dérush (Movies sur Mac). */
export function dossierVideos() {
  if (MAC) return path.join(MAISON, 'Movies');
  for (const d of ['Videos', 'Vidéos']) if (fs.existsSync(path.join(MAISON, d))) return path.join(MAISON, d);
  return path.join(MAISON, 'Videos');
}
/** Le dossier de musique de la personne : Music (Mac, Windows), ou celui que le bureau déclare sous Linux. */
export function dossierMusique() {
  if (MAC || WINDOWS) return path.join(MAISON, 'Music');
  try {
    const d = spawnSync('xdg-user-dir', ['MUSIC'], {encoding: 'utf8'}).stdout?.trim();
    if (d && d !== MAISON && fs.existsSync(d)) return d;
  } catch { /* pas de xdg-user-dir */ }
  for (const d of ['Music', 'Musique']) if (fs.existsSync(path.join(MAISON, d))) return path.join(MAISON, d);
  return path.join(MAISON, 'Music');
}
/** Le journal de l'app. */
export function fichierJournal() {
  if (MAC) return path.join(MAISON, 'Library', 'Logs', 'Dérush.log');
  return path.join(dossierSupport(), 'derush.log');
}

/** Le nom d'une commande npm/npx : sous Windows ce sont des scripts .cmd, lancés par l'interpréteur de commandes. */
export const commandeNode = (nom) => (WINDOWS ? `${nom}.cmd` : nom);
export const avecShell = (cmd) => WINDOWS && /\.(cmd|bat)$/i.test(cmd);

/** Cherche une commande dans le PATH (comme `which` ou `where`). */
export function trouver(nom) {
  const r = spawnSync(WINDOWS ? 'where' : 'which', [nom], {encoding: 'utf8'});
  if (r.status !== 0) return null;
  return r.stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean) ?? null;
}

/**
 * Git, même quand celui du PATH refuse de marcher : sur Mac, /usr/bin/git s'arrête si la licence de Xcode n'a pas été
 * acceptée, alors que celui des outils Apple, appelé directement, marche.
 */
let gitTrouve = null; // on ne retient qu'un Git qui marche (un Git installé pendant que Dérush tourne sera vu)
export function trouverGit() {
  if (gitTrouve) return gitTrouve;
  const candidats = [trouver('git'), ...(MAC ? ['/Library/Developer/CommandLineTools/usr/bin/git', '/Applications/Xcode.app/Contents/Developer/usr/bin/git'] : [])];
  for (const g of new Set(candidats.filter(Boolean))) {
    try { if (spawnSync(g, ['--version'], {encoding: 'utf8', timeout: 10000}).status === 0) return (gitTrouve = g); } catch { /* celui-là ne marche pas */ }
  }
  return null;
}

/** Ajoute des dossiers en tête du PATH (séparateur propre au système). */
export function pathAvec(dossiers, env = process.env) {
  const cle = WINDOWS ? Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'Path' : 'PATH';
  const actuel = (env[cle] ?? '').split(path.delimiter);
  return {...env, [cle]: [...new Set([...dossiers, ...actuel])].filter(Boolean).join(path.delimiter)};
}

/** Ouvre un fichier, un dossier ou une adresse avec l'app par défaut. Une adresse ouverte est notée dans le journal. */
export function ouvrir(cible) {
  if (/^https?:/i.test(String(cible))) {
    let hote = '';
    try { hote = new URL(cible).host; } catch { /* adresse illisible */ }
    console.log(`${new Date().toISOString()} Dérush ouvre ${hote || 'une page'} dans le navigateur.`);
  }
  const [cmd, args] = MAC ? ['open', [cible]] : WINDOWS ? ['cmd', ['/c', 'start', '""', cible]] : ['xdg-open', [cible]];
  spawn(cmd, args, {detached: true, stdio: 'ignore', windowsHide: true}).unref();
}

/**
 * Un environnement où un programme ne peut pas ouvrir le navigateur : les commandes qui l'ouvrent (open, xdg-open,
 * rundll32…) sont remplacées, en tête du PATH, par des commandes qui ne font rien sauf noter la demande. Pour les
 * vérifications faites sans que la personne le demande (l'état de Gemini, par exemple) : une commande qui voudrait
 * qu'on se connecte ne doit jamais ouvrir une page toute seule. Renvoie {env, demande()} : demande() dit si le
 * programme a voulu ouvrir une page.
 */
export function envSansNavigateur(env = process.env) {
  const dossier = path.join(dossierSupport(), 'bin-sans-navigateur');
  const marque = path.join(dossier, 'demande.txt');
  try {
    fs.mkdirSync(dossier, {recursive: true});
    if (WINDOWS) {
      for (const n of ['rundll32', 'explorer']) fs.writeFileSync(path.join(dossier, `${n}.cmd`), `@echo %* >> "${marque}"\r\n@exit /b 0\r\n`);
    } else {
      const script = `#!/bin/sh\necho "$*" >> "${marque.replace(/"/g, '\\"')}"\nexit 0\n`;
      for (const n of ['open', 'xdg-open', 'x-www-browser', 'www-browser', 'sensible-browser', 'gio']) fs.writeFileSync(path.join(dossier, n), script, {mode: 0o755});
    }
    fs.rmSync(marque, {force: true});
  } catch { /* dossier en lecture seule : on garde l'environnement tel quel */ }
  const e = pathAvec([dossier], env);
  e.BROWSER = WINDOWS ? 'rem' : 'true';
  return {env: e, demande: () => fs.existsSync(marque)};
}
/**
 * Clone un fichier sans le copier (APFS sur Mac, reflink sur Linux) : instantané, sans place prise, et le clone peut
 * être modifié sans toucher à l'original. Seulement sur le même disque. Renvoie true si c'est fait (sinon rien n'est écrit).
 */
export function cloner(src, dst) {
  try {
    if (fs.statSync(src).dev !== fs.statSync(path.dirname(dst)).dev) return Promise.resolve(false);
  } catch { return Promise.resolve(false); }
  if (MAC) {
    // Node copie vraiment sur Mac (son option de clone n'y est pas faite) : « cp -c » passe par clonefile(2)
    return new Promise((ok) => {
      const p = spawn('/bin/cp', ['-c', src, dst], {stdio: 'ignore'});
      p.on('error', () => ok(false));
      p.on('close', (code) => { if (code !== 0) { try { fs.rmSync(dst, {force: true}); } catch { /* rien d'écrit */ } } ok(code === 0); });
    });
  }
  if (WINDOWS) return Promise.resolve(false);
  return fs.promises.copyFile(src, dst, fs.constants.COPYFILE_FICLONE_FORCE).then(() => true, () => false);
}

/** Montre un fichier dans le Finder / l'Explorateur (sélectionné), ou ouvre un dossier. */
export function montrer(chemin) {
  let estFichier = false;
  try { estFichier = fs.statSync(chemin).isFile(); } catch { /* absent */ }
  if (!estFichier) return ouvrir(chemin);
  if (MAC) return spawn('open', ['-R', chemin], {detached: true, stdio: 'ignore'}).unref();
  if (WINDOWS) return spawn('explorer', [`/select,${chemin}`], {detached: true, stdio: 'ignore'}).unref();
  return ouvrir(path.dirname(chemin));
}

/**
 * Met un dossier à la corbeille du système (récupérable) : la Corbeille du Mac, la Corbeille de Windows, ou celle du
 * bureau Linux (spécification freedesktop).
 */
export function mettreDossierALaCorbeille(d) {
  const nom = path.basename(d);
  if (WINDOWS) {
    const ps = `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${d.replace(/'/g, "''")}', 'OnlyErrorDialogs', 'SendToRecycleBin')`;
    const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], {windowsHide: true});
    if (r.status !== 0 || fs.existsSync(d)) throw new Error('La corbeille de Windows a refusé ce dossier.');
    return;
  }
  if (!MAC && trouver('gio') && spawnSync('gio', ['trash', d]).status === 0) return;
  const corbeille = MAC ? path.join(MAISON, '.Trash') : path.join(process.env.XDG_DATA_HOME || path.join(MAISON, '.local', 'share'), 'Trash');
  const fichiers = MAC ? corbeille : path.join(corbeille, 'files');
  fs.mkdirSync(fichiers, {recursive: true});
  let cible = path.join(fichiers, nom);
  for (let k = 2; fs.existsSync(cible); k++) cible = path.join(fichiers, `${nom} ${k}`);
  fs.renameSync(d, cible);
  if (!MAC) {
    fs.mkdirSync(path.join(corbeille, 'info'), {recursive: true});
    fs.writeFileSync(path.join(corbeille, 'info', `${path.basename(cible)}.trashinfo`), `[Trash Info]\nPath=${encodeURI(d)}\nDeletionDate=${new Date().toISOString().slice(0, 19)}\n`);
  }
}

/**
 * Empêche l'ordinateur de s'endormir tant que le processus `pid` tourne : un long travail de l'IA s'arrêterait net.
 * Sur Mac, par « caffeinate -i -w <pid> », qui s'en va tout seul avec le processus (l'écran peut s'éteindre, le travail
 * continue). Ailleurs, rien pour l'instant : régler la mise en veille de l'ordinateur.
 */
export function garderEveille(pid) {
  if (!MAC || !pid || !fs.existsSync('/usr/bin/caffeinate')) return false;
  try {
    const p = spawn('/usr/bin/caffeinate', ['-i', '-w', String(pid)], {stdio: 'ignore', detached: true});
    p.on('error', () => {});
    p.unref();
    return true;
  } catch { return false; }
}

/** Arrête un processus et tout ce qu'il a lancé (Claude, Codex, leurs rendus…). */
export function arreterArbre(proc) {
  if (!proc?.pid) return;
  if (WINDOWS) {
    spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f'], {stdio: 'ignore', windowsHide: true});
    return;
  }
  try { process.kill(-proc.pid, 'SIGTERM'); } catch { try { proc.kill('SIGTERM'); } catch { /* déjà fini */ } }
}

/**
 * Crée un lien `lien` → `cible` (relatif ou absolu), s'il n'existe pas déjà. Sous Windows, un lien vers un dossier est une
 * « jonction » (pas besoin de droits d'administrateur) ; un lien vers un fichier qui échoue devient un lien physique.
 * Renvoie false si rien n'a pu être créé (l'appelant copie alors, ou fait sans).
 */
export function lier(cible, lien) {
  try { fs.lstatSync(lien); return true; } catch { /* absent */ }
  const absolue = path.resolve(path.dirname(lien), cible);
  let dossier = false;
  try { dossier = fs.statSync(absolue).isDirectory(); } catch { /* cible absente : lien vers un fichier à venir */ }
  try {
    if (WINDOWS) fs.symlinkSync(absolue, lien, dossier ? 'junction' : 'file');
    else fs.symlinkSync(cible, lien);
    return true;
  } catch {
    if (!dossier) { try { fs.linkSync(absolue, lien); return true; } catch { /* autre disque */ } }
    return false;
  }
}
/** Retire un lien créé par lier() (jamais ce vers quoi il pointe). */
export function delier(lien) {
  try { fs.unlinkSync(lien); } catch { try { fs.rmdirSync(lien); } catch { /* absent */ } }
}

/** Un navigateur capable d'ouvrir une fenêtre d'application (sans onglets) : Chrome, Edge, Chromium, Brave. */
export function navigateurApp() {
  const c = MAC
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/Applications/Chromium.app/Contents/MacOS/Chromium']
    : WINDOWS
      ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).flatMap((b) => [
        path.join(b, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(b, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(b, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')])
      : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser'].map((n) => trouver(n)).filter(Boolean);
  return c.find((x) => x && fs.existsSync(x)) ?? null;
}
/** L'app native de Dérush sur ce Mac (fenêtre WebKit, pas Chrome), si elle est installée. */
export function appNative() {
  if (!MAC) return null;
  for (const d of [path.join(os.homedir(), 'Applications'), '/Applications']) {
    const app = path.join(d, 'Dérush.app');
    try {
      if (fs.existsSync(path.join(app, 'Contents', 'MacOS', 'Derush')) && !fs.readFileSync(path.join(app, 'Contents', 'Info.plist'), 'utf8').includes('<key>LSUIElement</key>')) return app;
    } catch { /* app abîmée : on passe */ }
  }
  return null;
}
/**
 * Ouvre l'interface de Dérush. Sur un Mac où l'app native est installée, c'est elle qui s'ouvre (elle retrouve le
 * Dérush qui tourne) : jamais une fenêtre de navigateur. Ailleurs : une fenêtre d'application (Chrome, Edge…), sinon le
 * navigateur.
 */
export function ouvrirFenetre(url) {
  const app = appNative();
  if (app) {
    console.log(`${new Date().toISOString()} Dérush s’affiche dans son app (${path.basename(app)}).`);
    return spawn('open', ['-a', app], {detached: true, stdio: 'ignore'}).unref();
  }
  const nav = navigateurApp();
  if (!nav) return ouvrir(url);
  if (MAC) {
    const app = nav.split('/Contents/MacOS/')[0];
    spawn('open', ['-na', app, '--args', `--app=${url}`, '--window-size=1480,920'], {detached: true, stdio: 'ignore'}).unref();
  } else spawn(nav, [`--app=${url}`, '--window-size=1480,920'], {detached: true, stdio: 'ignore', windowsHide: false}).unref();
}

const echapperAS = (s) => String(s).replace(/[\\"]/g, '\\$&');
/**
 * La fenêtre « Ouvrir » du système, pour choisir des fichiers (ils restent à leur place).
 * Renvoie {chemins} ; {indisponible: true} si le système n'en a pas (l'interface passe alors par le navigateur).
 */
export function choisirFichiers({invite = 'Choisis des fichiers', depart = null} = {}) {
  return new Promise((ok) => {
    let cmd;
    let args;
    if (MAC) {
      const lieu = depart ? `(POSIX file "${echapperAS(depart)}")` : '(path to movies folder)';
      cmd = 'osascript';
      args = ['-e', `activate
set lesFichiers to choose file with prompt "${echapperAS(invite)}" default location ${lieu} with multiple selections allowed
set sortie to ""
repeat with f in lesFichiers
  set sortie to sortie & POSIX path of f & linefeed
end repeat
return sortie`];
    } else if (WINDOWS) {
      const ps = `Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Multiselect = $true
$d.Title = '${String(invite).replace(/'/g, "''")}'
${depart ? `$d.InitialDirectory = '${String(depart).replace(/'/g, "''")}'` : ''}
if ($d.ShowDialog() -eq 'OK') { $d.FileNames -join [Environment]::NewLine }`;
      cmd = 'powershell';
      args = ['-NoProfile', '-STA', '-Command', ps];
    } else if (trouver('zenity')) {
      cmd = 'zenity';
      args = ['--file-selection', '--multiple', '--separator=\n', `--title=${invite}`, ...(depart ? [`--filename=${depart}/`] : [])];
    } else if (trouver('kdialog')) {
      cmd = 'kdialog';
      args = ['--getopenfilename', depart ?? MAISON, '--multiple', '--separate-output'];
    } else return ok({indisponible: true, chemins: []});
    const p = spawn(cmd, args, {windowsHide: false});
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', () => ok({indisponible: true, chemins: []}));
    p.on('close', (code) => {
      const chemins = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (code === 0 || chemins.length) return ok({chemins});
      if (MAC && /-128/.test(err)) return ok({chemins: []}); // annulé
      if (!MAC) return ok({chemins: []}); // zenity, kdialog et PowerShell : annuler sort avec un code non nul
      ok({indisponible: true, chemins: [], erreur: err.trim()});
    });
  });
}

/** Les polices de secours pour les textes dessinés par FFmpeg. */
export const POLICES_SYSTEME = {
  normale: ['/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc', 'C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/TTF/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'],
  grasse: ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf', 'C:/Windows/Fonts/arialbd.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'],
};

/** Les dossiers Google Drive synchronisés (Google Drive pour ordinateur) : {compte, monDrive, partages} ou null. */
export function dossiersGoogleDrive() {
  const essayer = (racine, compte) => {
    const monDrive = ['Mon Drive', 'My Drive'].map((d) => path.join(racine, d)).find((d) => fs.existsSync(d));
    if (!monDrive) return null;
    const partages = ['Drive partagés', 'Shared drives'].map((d) => path.join(racine, d)).find((d) => fs.existsSync(d)) ?? null;
    return {compte, monDrive, partages};
  };
  if (MAC) {
    const cloud = path.join(MAISON, 'Library', 'CloudStorage');
    let comptes = [];
    try { comptes = fs.readdirSync(cloud).filter((d) => d.startsWith('GoogleDrive-')); } catch { /* pas de Drive */ }
    for (const c of comptes) { const r = essayer(path.join(cloud, c), c.replace(/^GoogleDrive-/, '')); if (r) return r; }
    return null;
  }
  if (WINDOWS) {
    // Google Drive pour ordinateur monte le Drive comme un lecteur (G:, H:…)
    for (const l of 'GHIJKLMNOPQRSTUVWXYZDEF') { const r = essayer(`${l}:\\`, `${l}:`); if (r) return r; }
    return null;
  }
  // Linux : pas d'application officielle ; un montage rclone ou insync courant
  for (const d of ['GoogleDrive', 'Google Drive', 'google-drive', 'gdrive']) {
    const r = essayer(path.join(MAISON, d), d);
    if (r) return r;
    if (fs.existsSync(path.join(MAISON, d))) return {compte: d, monDrive: path.join(MAISON, d), partages: null};
  }
  return null;
}
