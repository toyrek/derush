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

/** Ajoute des dossiers en tête du PATH (séparateur propre au système). */
export function pathAvec(dossiers, env = process.env) {
  const cle = WINDOWS ? Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'Path' : 'PATH';
  const actuel = (env[cle] ?? '').split(path.delimiter);
  return {...env, [cle]: [...new Set([...dossiers, ...actuel])].filter(Boolean).join(path.delimiter)};
}

/** Ouvre un fichier, un dossier ou une adresse avec l'app par défaut. */
export function ouvrir(cible) {
  const [cmd, args] = MAC ? ['open', [cible]] : WINDOWS ? ['cmd', ['/c', 'start', '""', cible]] : ['xdg-open', [cible]];
  spawn(cmd, args, {detached: true, stdio: 'ignore', windowsHide: true}).unref();
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
/** Ouvre l'interface de Dérush dans une fenêtre d'application, sinon dans le navigateur. */
export function ouvrirFenetre(url) {
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
