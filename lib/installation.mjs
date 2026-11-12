// Dérush — l'installation sur cet ordinateur (macOS, Windows, Linux) : faire le bilan, installer ce qui manque avec
// l'outil du système (Homebrew, winget, flatpak…), et poser un raccourci « Dérush » sur le Bureau et dans les apps.
//   node derush.mjs installer            le bilan, puis tout ce qui manque (sans Blender)
//   node derush.mjs installer --leger    sans Whisper (le texte des rushes) : plus rapide, 2 Go de moins
//   node derush.mjs installer --blender  avec Blender (3D réaliste)
//   node derush.mjs installer --earshot  avec Earshot (l'oreille de l'IA : 2,5 Go avec ses deux modèles)
//   node derush.mjs installer --bilan    le bilan seulement, sans rien installer
// Les commandes qui demandent le mot de passe administrateur (apt, dnf…) ne sont jamais lancées : elles sont écrites,
// pour que l'humain (ou son IA, avec son accord) les lance.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {MAC, WINDOWS, NOM_SYSTEME, trouver, trouverGit, navigateurApp, ouvrir} from './plateforme.mjs';
import {lancer, FFMPEG, FFPROBE} from './outils.mjs';
import {RACINE_APP, DOSSIER_SUPPORT, PYTHON, installer as installerMoteur, etatBlender, oublierBlender, uv} from './moteurs.mjs';
import {moteurs} from './transcription.mjs';
import {etatRendu, installerRendu} from './rendu.mjs';
import {etatClaude, etatCodex, etatGemini} from './ia.mjs';
import {telechargerRemotion, remotionPresent, preparerCommandes, listerCompetences} from './competences.mjs';
import {VERSION} from './commun.mjs';
import {etatSons, telechargerRealSfx, installerEarshot} from './sons.mjs';

const versionDe = async (cmd, args = ['-version']) => {
  if (!cmd) return null;
  try {
    const {out, err} = await lancer(cmd, args, {silenceMax: 30000});
    return /(\d+\.\d+(?:\.\d+)?)/.exec(`${out.toString()} ${err}`)?.[1] ?? 'ok';
  } catch { return null; }
};
const brew = () => trouver('brew') ?? ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'].find((b) => fs.existsSync(b)) ?? null;
const winget = () => (WINDOWS ? trouver('winget') : null);
const gestionnaireLinux = () => ['apt-get', 'dnf', 'pacman', 'zypper'].find((g) => trouver(g)) ?? null;
const commandeLinux = (paquet) => ({'apt-get': `sudo apt-get install -y ${paquet}`, dnf: `sudo dnf install -y ${paquet}`, pacman: `sudo pacman -S --noconfirm ${paquet}`, zypper: `sudo zypper install -y ${paquet}`}[gestionnaireLinux()] ?? `installe « ${paquet} » avec le gestionnaire de paquets de ta distribution`);

/** Le nom lisible du système (« macOS 26.1 », « Windows 11 », « Ubuntu 24.04 LTS »). */
function nomDuSysteme() {
  try {
    if (MAC) return `macOS ${execFileSync('sw_vers', ['-productVersion'], {encoding: 'utf8'}).trim()}`;
    if (WINDOWS) return `Windows ${Number(os.release().split('.')[2]) >= 22000 ? '11' : '10'}`;
    const joli = /^PRETTY_NAME="?([^"\n]+)"?/m.exec(fs.readFileSync('/etc/os-release', 'utf8'))?.[1];
    if (joli) return joli;
  } catch { /* on garde le nom court */ }
  return NOM_SYSTEME;
}

/**
 * Cette machine, et la formule d'installation qui lui va. Les seuils sont ceux d'INSTALLER.md : moins de 6 Go de place
 * ou 8 Go de mémoire → formule légère (sans Whisper) ; 16 Go de mémoire et 20 Go de place → machine confortable.
 */
export function machine({memoire = os.totalmem(), libre, arch = os.arch(), mac = MAC} = {}) {
  const go = (o) => Math.round(o / 1e9);
  if (libre === undefined) { try { const s = fs.statfsSync(os.homedir()); libre = s.bavail * s.bsize; } catch { libre = null; } }
  const memoireGo = Math.round(memoire / 2 ** 30); // comme les fabricants l'annoncent (16 Go = 16 × 2^30 octets)
  const libreGo = libre === null ? null : go(libre);
  const tropPeu = libreGo !== null && libreGo < 2;
  const leger = memoireGo <= 8 || (libreGo !== null && libreGo < 6);
  const confortable = !leger && memoireGo >= 16 && (libreGo === null || libreGo >= 20);
  const conseils = [];
  if (tropPeu) conseils.push('Moins de 2 Go de place libre : il faut en libérer avant d’installer.');
  else if (leger) conseils.push(`${memoireGo <= 8 ? `${memoireGo} Go de mémoire` : `${libreGo} Go de place libre`} : formule légère, sans Whisper (le texte des vidéos pourra passer par ElevenLabs, en ligne).`);
  if (confortable) conseils.push('Machine confortable : propose à la personne d’ajouter --blender (la 3D réaliste) et --earshot (l’oreille de l’IA, 2,5 Go).');
  if (mac && arch !== 'arm64') conseils.push('Mac à puce Intel : Whisper tourne avec faster-whisper, plus lentement.');
  if (!mac) conseils.push('Hors Mac : pas de recadrage qui suit les visages ni de titre « derrière la personne » (Apple Vision) ; le reste marche pareil.');
  return {
    systeme: nomDuSysteme(), puce: mac ? (arch === 'arm64' ? 'puce Apple' : 'puce Intel') : arch, memoire_go: memoireGo, libre_go: libreGo,
    formule: `node derush.mjs installer${leger ? ' --leger' : ''}`, leger, confortable, bloque: tropPeu, conseils,
  };
}
/** Les lignes qui décrivent la machine, pour le bilan et le début de l'installation. */
export function lignesMachine(m = machine()) {
  return [
    `Cette machine : ${m.systeme} · ${m.puce} · ${m.memoire_go} Go de mémoire${m.libre_go === null ? '' : ` · ${m.libre_go} Go libres`}`,
    `Formule conseillée : ${m.formule}`,
    ...m.conseils.map((c) => `  → ${c}`),
  ];
}

/** Ce qui est là et ce qui manque, dans l'ordre où il faut l'installer. */
export async function bilan() {
  const majeur = Number(process.versions.node.split('.')[0]);
  const mineur = Number(process.versions.node.split('.')[1]);
  const [ffmpeg, ffprobe, git, claude, codex, blender, t, gemini] = await Promise.all([
    versionDe(FFMPEG), versionDe(FFPROBE), versionDe(trouverGit(), ['--version']), etatClaude(true), etatCodex(true), etatBlender(), moteurs(), etatGemini(true),
  ]);
  const so = etatSons();
  return [
    {id: 'node', nom: 'Node.js', requis: true, ok: majeur > 20 || (majeur === 20 && mineur >= 12), detail: process.version},
    {id: 'ffmpeg', nom: 'FFmpeg', requis: true, ok: !!ffmpeg && !!ffprobe, detail: ffmpeg ? `FFmpeg ${ffmpeg}` : 'absent'},
    MAC
      ? {id: 'fenetre', nom: 'Fenêtre de Dérush', requis: false, ok: true, detail: 'une vraie app Mac (aucun navigateur à installer)'}
      : {id: 'navigateur', nom: 'Chrome, Edge ou Brave (la fenêtre de Dérush)', requis: false, ok: !!navigateurApp(), detail: navigateurApp() ? 'trouvé' : 'absent : Dérush s’ouvrira dans ton navigateur'},
    {id: 'uv', nom: 'uv (les moteurs Python)', requis: true, ok: !!uv(), detail: uv() ? 'trouvé' : 'absent'},
    {id: 'outils', nom: 'Python de Dérush (compétences)', requis: true, ok: fs.existsSync(PYTHON), detail: fs.existsSync(PYTHON) ? 'prêt' : 'à créer'},
    {id: 'rendu', nom: 'Moteur de rendu (Remotion)', requis: true, ok: etatRendu().ok, detail: etatRendu().ok ? 'prêt' : 'à installer'},
    {id: 'remotion', nom: 'Compétences Remotion', requis: true, ok: remotionPresent(), detail: remotionPresent() ? 'téléchargées' : 'à télécharger'},
    {id: 'realsfx', nom: 'Real SFX (poser de vrais sons)', requis: false, ok: so.realsfx.ok, detail: so.realsfx.ok ? 'téléchargé' : 'à télécharger (9 Mo)'},
    {id: 'sons', nom: 'Bibliothèque de sons', requis: false, ok: so.nombre > 0, detail: so.nombre ? `${so.nombre} sons dans « ${so.nom} »` : `vide (« ${so.nom} ») : l’IA la remplit avec Openverse quand tu l’allumes dans Connexions`},
    {id: 'earshot', nom: 'Earshot (l’oreille de l’IA)', requis: false, ok: so.earshot.ok, detail: so.earshot.ok ? 'prêt' : 'absent (facultatif, 2,5 Go)'},
    {id: 'whisper', nom: 'Whisper (le texte des rushes)', requis: false, ok: !!t.whisper?.ok, detail: t.whisper?.ok ? 'prêt' : 'à installer (environ 2 Go)'},
    {id: 'claude', nom: 'Claude Code', requis: false, ok: !!claude.ok, detail: claude.ok ? claude.nom : claude.pourquoi},
    {id: 'codex', nom: 'Codex', requis: false, ok: !!codex.ok, detail: codex.ok ? codex.nom : codex.pourquoi},
    {id: 'gemini', nom: 'Gemini (commande agy)', requis: false, ok: !!gemini.ok, detail: gemini.ok ? gemini.nom : gemini.pourquoi},
    {id: 'blender', nom: 'Blender (3D réaliste)', requis: false, ok: !!blender.ok, detail: blender.ok ? blender.nom : 'absent (facultatif)'},
    {id: 'git', nom: 'Git (les mises à jour)', requis: false, ok: !!git, detail: git ? `Git ${git}` : 'absent'},
  ];
}

/** FFmpeg avec l'outil du système. */
export async function installerFFmpeg(journal = () => {}) {
  if (MAC && brew()) { journal('FFmpeg : installation avec Homebrew…'); await lancer(brew(), ['install', 'ffmpeg']); return; }
  if (WINDOWS && winget()) {
    journal('FFmpeg : installation avec winget…');
    await lancer(winget(), ['install', '--id', 'Gyan.FFmpeg', '-e', '--silent', '--accept-source-agreements', '--accept-package-agreements']);
    return;
  }
  if (MAC) throw new Error('FFmpeg manque. Installe Homebrew (https://brew.sh), puis lance : brew install ffmpeg');
  if (WINDOWS) throw new Error('FFmpeg manque, et winget n’est pas disponible. Installe « App Installer » depuis le Microsoft Store, puis relance l’installation.');
  throw new Error(`FFmpeg manque. Lance : ${commandeLinux('ffmpeg')}`);
}
/** uv (l'outil qui installe les moteurs Python), avec son installateur officiel. */
export async function installerUv(journal = () => {}) {
  journal('uv : installation (installateur officiel d’Astral)…');
  if (WINDOWS) await lancer('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://astral.sh/uv/install.ps1 | iex']);
  else await lancer('sh', ['-c', 'curl -LsSf https://astral.sh/uv/install.sh | sh']);
  if (!uv()) throw new Error('uv ne s’est pas installé : relance l’installation, ou installe-le depuis https://docs.astral.sh/uv/');
}
/** Blender avec l'outil du système ; sinon la page de téléchargement s'ouvre. */
export async function installerBlender(journal = () => {}) {
  if (MAC && brew()) { journal('Blender : installation avec Homebrew…'); await lancer(brew(), ['install', '--cask', 'blender']); }
  else if (WINDOWS && winget()) { journal('Blender : installation avec winget…'); await lancer(winget(), ['install', '--id', 'BlenderFoundation.Blender', '-e', '--silent', '--accept-source-agreements', '--accept-package-agreements']); }
  else if (!MAC && !WINDOWS && trouver('flatpak')) {
    journal('Blender : installation avec Flatpak (pour toi seul)…');
    await lancer('flatpak', ['remote-add', '--user', '--if-not-exists', 'flathub', 'https://dl.flathub.org/repo/flathub.flatpakrepo']);
    await lancer('flatpak', ['install', '-y', '--user', 'flathub', 'org.blender.Blender']);
  } else {
    ouvrir('https://www.blender.org/download/');
    throw new Error('Télécharge Blender sur la page qui vient de s’ouvrir (blender.org), installe-le, puis reviens.');
  }
  oublierBlender();
  const b = await etatBlender();
  if (!b.ok) throw new Error('Blender est installé mais Dérush ne le trouve pas encore : redémarre Dérush.');
  return b;
}

// ——— les raccourcis « Dérush » ———
/** Windows : un petit lanceur sans fenêtre noire (VBScript), puis des raccourcis sur le Bureau et dans le menu Démarrer. */
function raccourcisWindows() {
  const vbs = path.join(DOSSIER_SUPPORT, 'Dérush.vbs');
  fs.mkdirSync(DOSSIER_SUPPORT, {recursive: true});
  const ligne = `"""${process.execPath}"" ""${path.join(RACINE_APP, 'derush.mjs')}"" --app"`;
  // en UTF-16 avec BOM : sinon les accents des chemins (Dérush) sont mal lus par Windows Script Host
  fs.writeFileSync(vbs, Buffer.from(`﻿Set s = CreateObject("WScript.Shell")\r\ns.CurrentDirectory = "${RACINE_APP}"\r\ns.Run ${ligne}, 0, False\r\n`, 'utf16le'));
  const ico = path.join(RACINE_APP, 'public', 'marque', 'derush.ico');
  const ps = `$w = New-Object -ComObject WScript.Shell
foreach ($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
  $s = $w.CreateShortcut((Join-Path $d 'Dérush.lnk'))
  $s.TargetPath = Join-Path $env:WINDIR 'System32\\wscript.exe'
  $s.Arguments = '"${vbs.replace(/'/g, "''")}"'
  $s.WorkingDirectory = '${RACINE_APP.replace(/'/g, "''")}'
  $s.IconLocation = '${ico.replace(/'/g, "''")}'
  $s.Description = 'Dérush par IABAI — le montage vidéo avec ton IA'
  $s.Save()
}`;
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {stdio: 'ignore', windowsHide: true});
  return ['Bureau', 'menu Démarrer'];
}
/** Linux : une entrée dans le menu des applications, et la même sur le Bureau. */
function raccourcisLinux() {
  const icone = path.join(RACINE_APP, 'public', 'marque', 'derush-512.png');
  const entree = `[Desktop Entry]
Type=Application
Name=Dérush
GenericName=Montage vidéo avec l’IA
Comment=Dérush par IABAI — le montage vidéo avec ton IA
Exec="${process.execPath}" "${path.join(RACINE_APP, 'derush.mjs')}" --app
Path=${RACINE_APP}
Icon=${icone}
Terminal=false
Categories=AudioVideo;Video;AudioVideoEditing;
StartupWMClass=derush
`;
  const apps = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'applications');
  fs.mkdirSync(apps, {recursive: true});
  fs.writeFileSync(path.join(apps, 'derush.desktop'), entree, {mode: 0o755});
  const lieux = ['menu des applications'];
  let bureau = path.join(os.homedir(), 'Desktop');
  try { bureau = execFileSync('xdg-user-dir', ['DESKTOP'], {encoding: 'utf8'}).trim() || bureau; } catch { /* pas de xdg-user-dir */ }
  if (fs.existsSync(bureau)) {
    const f = path.join(bureau, 'derush.desktop');
    fs.writeFileSync(f, entree, {mode: 0o755});
    try { execFileSync('gio', ['set', f, 'metadata::trusted', 'true'], {stdio: 'ignore'}); } catch { /* pas GNOME */ }
    lieux.push('Bureau');
  }
  return lieux;
}
/** Le raccourci « Dérush » de ce système. */
export async function creerRaccourcis() {
  if (MAC) {
    const {construireApp} = await import('../outils/construire-app.mjs');
    const r = await construireApp({surPlace: true});
    return [`Applications (${path.basename(r.app)})`, ...(r.raccourci ? ['Bureau'] : [])];
  }
  return WINDOWS ? raccourcisWindows() : raccourcisLinux();
}

/** Tout ce qui manque, dans l'ordre. Renvoie la liste de ce qui a été fait et de ce qui reste à faire. */
export async function installerTout({leger = false, blender = false, earshot = false, journal = console.log} = {}) {
  const fait = [];
  const reste = [];
  const etape = async (nom, f) => {
    try { await f(); fait.push(nom); } catch (e) { reste.push(`${nom} : ${e.message}`); journal(`  ✗ ${nom} : ${e.message}`); }
  };
  journal(`Dérush ${VERSION} — installation sur ${NOM_SYSTEME} (${os.arch()})`);
  const m = machine();
  for (const l of lignesMachine(m)) journal(l);
  if (m.leger && !leger) journal('  (tu as demandé la formule complète : elle sera installée, Whisper compris)');
  journal('');
  let b = await bilan();
  const manque = (id) => !b.find((x) => x.id === id)?.ok;
  if (manque('node')) reste.push(`Node.js ${process.version} est trop ancien : installe Node.js 22 (https://nodejs.org), puis relance.`);
  if (manque('ffmpeg')) await etape('FFmpeg', () => installerFFmpeg(journal));
  if (manque('uv')) await etape('uv', () => installerUv(journal));
  if (manque('outils')) await etape('Python de Dérush', () => { journal('Python de Dérush : préparation…'); return installerMoteur('outils'); });
  if (manque('rendu')) await etape('Moteur de rendu', () => { journal('Moteur de rendu (Remotion) : installation…'); return installerRendu(() => {}); });
  if (manque('remotion')) await etape('Compétences Remotion', async () => { journal('Compétences Remotion : téléchargement depuis leur dépôt officiel…'); await telechargerRemotion(); });
  if (manque('realsfx')) await etape('Real SFX', async () => { journal('Real SFX : téléchargement depuis son dépôt officiel…'); await telechargerRealSfx(); });
  if (earshot && manque('earshot')) await etape('Earshot', () => installerEarshot(journal));
  if (!leger && manque('whisper')) await etape('Whisper', () => { journal('Whisper : installation (environ 2 Go, quelques minutes)…'); return installerMoteur('whisper'); });
  if (blender && manque('blender')) await etape('Blender', () => installerBlender(journal));
  preparerCommandes();
  await etape('Raccourci Dérush', async () => { const lieux = await creerRaccourcis(); journal(`Raccourci « Dérush » : ${lieux.join(', ')}.`); });
  b = await bilan();
  journal('');
  for (const x of b) journal(`${x.ok ? '✓' : x.requis ? '✗' : '·'} ${x.nom} — ${x.detail}`);
  journal(`\n${listerCompetences().length} compétences prêtes pour l’IA.`);
  if (!['claude', 'codex', 'gemini'].some((id) => b.find((x) => x.id === id)?.ok)) reste.push('Aucune IA n’est connectée : ouvre Dérush › Connexions, puis Claude, Codex ou Gemini (un clic pour installer, un pour te connecter).');
  return {fait, reste, bilan: b};
}
