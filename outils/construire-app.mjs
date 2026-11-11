// Dérush — fabrique l'application Mac « Dérush.app » et son raccourci sur le Bureau.
//   node derush.mjs construire-app [dossier]         installe l'app (par défaut dans ~/Applications) + alias sur le Bureau
//   node derush.mjs construire-app --zip [dossier]   fabrique « Dérush.app pour Mac (à décompresser).zip » à partager
//   node derush.mjs construire-app --sur-place       l'app lance le programme de ce dossier (copie GitHub de la bêta) :
//                                                    une mise à jour (git pull) change aussitôt l'app, sans la refaire
// L'app contient tout le programme ; les moteurs (Whisper, Demucs) restent dans ~/Library/Application Support/Dérush
// et les projets dans ~/Movies/Dérush.
//
// Structure :
//   Contents/MacOS/Derush           petit programme natif (arm64 + x86_64, voir outils/lanceur.c)
//   Contents/Resources/lanceur.sh   le vrai lanceur : démarre Dérush en arrière-plan puis rend la main
//   Contents/Resources/app/         le programme
//
// Deux pièges de macOS 26, rencontrés et évités ici :
//   - une app dont l'exécutable est un script passe par Rosetta : d'où le lanceur natif ;
//   - un lien symbolique « Dérush.app » vers l'app (sur le Bureau par exemple) empêche macOS de l'ouvrir
//     (erreur -10810) : le raccourci du Bureau est donc un vrai alias du Finder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {VERSION} from '../lib/commun.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LSREGISTER = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
const NOM_ZIP = 'Dérush.app pour Mac (à décompresser).zip';

function icone(resources, tmp) {
  const html = path.join(tmp, 'icone.html');
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent"><img src="file://${path.join(RACINE, 'public', 'icone.svg')}" width="1024" height="1024"></body></html>`);
  const png = path.join(tmp, 'icone-1024.png');
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000', '--window-size=1024,1024', `--screenshot=${png}`, `file://${html}`], {stdio: 'ignore'});
  const set = path.join(tmp, 'AppIcon.iconset');
  fs.mkdirSync(set, {recursive: true});
  for (const t of [16, 32, 128, 256, 512]) {
    execFileSync('sips', ['-z', String(t), String(t), png, '--out', path.join(set, `icon_${t}x${t}.png`)], {stdio: 'ignore'});
    execFileSync('sips', ['-z', String(t * 2), String(t * 2), png, '--out', path.join(set, `icon_${t}x${t}@2x.png`)], {stdio: 'ignore'});
  }
  execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(resources, 'AppIcon.icns')]);
}

/** Le lanceur natif : déjà compilé dans outils/lanceur-mac, sinon on le compile avec les outils de développement Apple. */
function lanceurNatif(cible, tmp) {
  const pret = path.join(ICI, 'lanceur-mac');
  if (fs.existsSync(pret)) return fs.copyFileSync(pret, cible);
  const outils = '/Library/Developer/CommandLineTools';
  const clang = fs.existsSync(path.join(outils, 'usr/bin/clang')) ? path.join(outils, 'usr/bin/clang') : 'clang';
  const sdk = path.join(outils, 'SDKs/MacOSX.sdk');
  const sortie = path.join(tmp, 'Derush');
  execFileSync(clang, [...(fs.existsSync(sdk) ? ['-isysroot', sdk] : []), '-O2', '-arch', 'arm64', '-arch', 'x86_64', '-mmacosx-version-min=13.0', '-o', sortie, path.join(ICI, 'lanceur.c')],
    {stdio: 'inherit', env: {...process.env, ...(fs.existsSync(outils) ? {DEVELOPER_DIR: outils} : {})}});
  fs.copyFileSync(sortie, cible);
}

// Un vrai alias du Finder (fichier « bookmark »), écrit par Foundation : ni Finder ni autorisation à demander.
const JXA_ALIAS = `function run(argv) {
  ObjC.import('Foundation');
  const options = 1 << 10; // NSURLBookmarkCreationSuitableForBookmarkFile
  const err = Ref();
  const data = $.NSURL.fileURLWithPath(argv[0]).bookmarkDataWithOptionsIncludingResourceValuesForKeysRelativeToURLError(options, $(), $(), err);
  if (!data || data.isNil()) throw new Error('alias impossible');
  if (!$.NSURL.writeBookmarkDataToURLOptionsError(data, $.NSURL.fileURLWithPath(argv[1]), options, err)) throw new Error('écriture impossible');
  return 'ok';
}`;

const estUnAlias = (f) => {
  const st = fs.lstatSync(f);
  if (!st.isFile() || st.size > 65536) return false;
  return fs.readFileSync(f).subarray(0, 4).toString('latin1') === 'book';
};

/** Raccourci « Dérush » sur le Bureau : un alias du Finder vers l'app. */
export function raccourciBureau(app, bureau = path.join(os.homedir(), 'Desktop')) {
  // les premières versions posaient un lien symbolique « Dérush.app », qui empêchait macOS d'ouvrir l'app
  const ancien = path.join(bureau, 'Dérush.app');
  try { if (fs.lstatSync(ancien).isSymbolicLink()) fs.unlinkSync(ancien); } catch { /* rien à retirer */ }
  const alias = path.join(bureau, 'Dérush');
  if (fs.existsSync(alias)) {
    if (!estUnAlias(alias)) {
      console.warn(`« ${alias} » existe déjà et n'est pas un alias : raccourci non créé.`);
      return null;
    }
    fs.unlinkSync(alias);
  }
  execFileSync('osascript', ['-l', 'JavaScript', '-e', JXA_ALIAS, app, alias], {stdio: 'ignore'});
  return alias;
}

/** Fabrique Dérush.app dans `dossier`. */
function fabriquer(dossier, tmp, {surPlace = false} = {}) {
  const app = path.join(dossier, 'Dérush.app');
  const contents = path.join(app, 'Contents');
  const resources = path.join(contents, 'Resources');
  const prog = path.join(resources, 'app');
  // l'ancienne version est d'abord retirée du registre des apps de macOS, pour qu'il ne garde rien en mémoire
  if (fs.existsSync(app)) try { execFileSync(LSREGISTER, ['-u', app], {stdio: 'ignore'}); } catch { /* pas enregistrée */ }
  fs.rmSync(app, {recursive: true, force: true});
  fs.mkdirSync(path.join(contents, 'MacOS'), {recursive: true});
  // le programme : copié dans l'app (app à partager), ou laissé à sa place (copie GitHub, mise à jour par git pull)
  if (!surPlace) {
    fs.mkdirSync(prog, {recursive: true});
    for (const f of ['derush.mjs', 'package.json', 'README.md', 'INSTALLER.md', 'LICENCE.md', 'NOTICES.md', 'AGENTS.md', 'CLAUDE.md']) if (fs.existsSync(path.join(RACINE, f))) fs.copyFileSync(path.join(RACINE, f), path.join(prog, f));
    for (const d of ['lib', 'public', 'outils', 'modeles', 'bin', 'competences', 'docs']) if (fs.existsSync(path.join(RACINE, d))) fs.cpSync(path.join(RACINE, d), path.join(prog, d), {recursive: true, filter: (src) => path.basename(src) !== '__pycache__'});
  }
  // l'icône
  if (fs.existsSync(CHROME)) icone(resources, tmp);
  // le lanceur : démarre Dérush en arrière-plan (fenêtre d'application) puis rend la main tout de suite
  const node = process.execPath;
  const lanceur = `#!/bin/zsh
# Dérush — lanceur (appelé par Contents/MacOS/Derush). Si Dérush tourne déjà, il rouvre simplement sa fenêtre.
export PATH="${path.dirname(node)}:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
APP="${surPlace ? path.resolve(RACINE).replace(/"/g, '\\"') : '\${0:A:h}/app'}"
JOURNAL="$HOME/Library/Logs/Dérush.log"
NODE="$(command -v node)"
if [[ -z "$NODE" ]]; then
  osascript -e 'display alert "Dérush a besoin de Node.js" message "Installe Node.js (https://nodejs.org), puis relance Dérush."'
  exit 1
fi
if ! command -v ffmpeg >/dev/null; then
  osascript -e 'display alert "Dérush a besoin de FFmpeg" message "Installe FFmpeg (https://ffmpeg.org), puis relance Dérush."'
  exit 1
fi
mkdir -p "$HOME/Library/Logs"
nohup "$NODE" "$APP/derush.mjs" --app >> "$JOURNAL" 2>&1 &
disown
exit 0
`;
  fs.writeFileSync(path.join(resources, 'lanceur.sh'), lanceur, {mode: 0o755});
  lanceurNatif(path.join(contents, 'MacOS', 'Derush'), tmp);
  fs.chmodSync(path.join(contents, 'MacOS', 'Derush'), 0o755);
  fs.writeFileSync(path.join(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Dérush</string>
  <key>CFBundleDisplayName</key><string>Dérush</string>
  <key>CFBundleIdentifier</key><string>fr.yabai.derush</string>
  <key>CFBundleVersion</key><string>${VERSION}</string>
  <key>CFBundleShortVersionString</key><string>${VERSION}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>Derush</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHumanReadableCopyright</key><string>Dérush par IABAI (YABAÏ) — le montage vidéo avec ton IA</string>
</dict>
</plist>
`);
  // signature locale (« ad hoc ») de toute l'app
  try {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], {stdio: 'ignore'});
  } catch (e) {
    console.warn(`Signature impossible (${e.message}) : macOS pourrait refuser d'ouvrir Dérush.`);
  }
  return app;
}

export async function construireApp({cible, zip = false, surPlace = false} = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-app-'));
  try {
    if (zip) {
      // version à partager : fabriquée à part, jamais enregistrée sur ce Mac
      const app = fabriquer(tmp, tmp);
      const sortie = path.join(path.resolve(cible ?? '.'), NOM_ZIP);
      fs.rmSync(sortie, {force: true});
      // sans attributs étendus : la signature est dans l'app elle-même, et le zip reste propre sur tous les systèmes
      execFileSync('ditto', ['-c', '-k', '--norsrc', '--noextattr', '--keepParent', app, sortie]);
      try { execFileSync(LSREGISTER, ['-u', app], {stdio: 'ignore'}); } catch { /* jamais enregistrée */ }
      console.log(`Dérush.app ${VERSION} prête à partager : ${sortie}`);
      return {zip: sortie};
    }
    const app = fabriquer(path.resolve(cible ?? path.join(os.homedir(), 'Applications')), tmp, {surPlace});
    try { execFileSync(LSREGISTER, ['-f', app], {stdio: 'ignore'}); } catch { /* le Finder le verra quand même */ }
    let raccourci = null;
    try { raccourci = raccourciBureau(app); } catch (e) { console.warn(`Raccourci du Bureau non créé : ${e.message}`); }
    console.log(`Dérush.app ${VERSION} : ${app}${raccourci ? `\nRaccourci : ${raccourci}` : ''}`);
    return {app, raccourci};
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}
