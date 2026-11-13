// Dérush — fabrique l'application Mac « Dérush.app » et son raccourci sur le Bureau.
//   node derush.mjs construire-app [dossier]         installe l'app (par défaut dans ~/Applications) + alias sur le Bureau
//   node derush.mjs construire-app --zip [dossier]   fabrique « Dérush.app pour Mac (à décompresser).zip » à partager
//   node derush.mjs construire-app --dmg [dossier]   fabrique « Dérush <version>.dmg » : on l'ouvre, on glisse Dérush
//                                                    dans Applications, comme n'importe quel logiciel Mac
//   node derush.mjs construire-app --sur-place       l'app lance le programme de ce dossier (copie GitHub de la bêta) :
//                                                    une mise à jour (git pull) change aussitôt l'app, sans la refaire
//   option --sans-raccourci                          ne touche ni au Bureau ni au registre des apps (essais)
// L'app contient tout le programme ; les moteurs (Whisper, Demucs) restent dans ~/Library/Application Support/Dérush
// et les projets dans ~/Movies/Dérush.
//
// Structure :
//   Contents/MacOS/Derush           la fenêtre native de Dérush (arm64 + x86_64, voir outils/coque-mac.swift) : une vraie
//                                   app Mac, avec son icône dans le Dock, ses menus et sa fenêtre (plus de Chrome)
//   Contents/Resources/lanceur.sh   trouve Node et lance le moteur de Dérush, que la fenêtre native affiche
//   Contents/Resources/app/         le programme
// Si la coque native ne peut pas être fabriquée (ni outils/coque-mac, ni Swift sur ce Mac), l'app garde l'ancien
// lanceur (outils/lanceur.c) : Dérush s'ouvre alors dans une fenêtre de Chrome, Edge ou Brave.
//
// Deux pièges de macOS 26, rencontrés et évités ici :
//   - une app dont l'exécutable est un script passe par Rosetta : d'où un exécutable natif ;
//   - un lien symbolique « Dérush.app » vers l'app (sur le Bureau par exemple) empêche macOS de l'ouvrir
//     (erreur -10810) : le raccourci du Bureau est donc un vrai alias du Finder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {VERSION} from '../lib/commun.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LSREGISTER = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
const NOM_ZIP = 'Dérush.app pour Mac (à décompresser).zip';

/** L'icône : celle déjà prête (outils/icone-mac.icns), sinon dessinée avec Chrome, sinon à partir du PNG de la marque. */
function icone(resources, tmp) {
  const prete = path.join(ICI, 'icone-mac.icns');
  if (fs.existsSync(prete)) return fs.copyFileSync(prete, path.join(resources, 'AppIcon.icns'));
  if (!fs.existsSync(CHROME)) {
    const png = path.join(RACINE, 'public', 'marque', 'derush-512.png');
    if (fs.existsSync(png)) iconeDepuisPng(png, resources, tmp);
    return;
  }
  const html = path.join(tmp, 'icone.html');
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent"><img src="file://${path.join(RACINE, 'public', 'icone.svg')}" width="1024" height="1024"></body></html>`);
  const png = path.join(tmp, 'icone-1024.png');
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000', '--window-size=1024,1024', `--screenshot=${png}`, `file://${html}`], {stdio: 'ignore'});
  iconeDepuisPng(png, resources, tmp);
}
function iconeDepuisPng(png, resources, tmp) {
  const set = path.join(tmp, 'AppIcon.iconset');
  fs.mkdirSync(set, {recursive: true});
  for (const t of [16, 32, 128, 256, 512]) {
    execFileSync('sips', ['-z', String(t), String(t), png, '--out', path.join(set, `icon_${t}x${t}.png`)], {stdio: 'ignore'});
    execFileSync('sips', ['-z', String(t * 2), String(t * 2), png, '--out', path.join(set, `icon_${t}x${t}@2x.png`)], {stdio: 'ignore'});
  }
  execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(resources, 'AppIcon.icns')]);
}

const OUTILS_APPLE = '/Library/Developer/CommandLineTools';
const swiftc = () => [path.join(OUTILS_APPLE, 'usr/bin/swiftc'), '/usr/bin/swiftc'].find((c) => fs.existsSync(c)) ?? null;
/** La coque native peut-elle être posée dans l'app ? (déjà compilée dans outils/coque-mac, ou Swift présent) */
export const coqueDisponible = () => fs.existsSync(path.join(ICI, 'coque-mac')) || (!!swiftc() && fs.existsSync(path.join(OUTILS_APPLE, 'SDKs/MacOSX.sdk')));
/**
 * La fenêtre native (outils/coque-mac.swift) : déjà compilée dans outils/coque-mac, sinon compilée ici pour les deux
 * familles de Mac (Apple Silicon et Intel). Renvoie false si ce n'est pas possible sur cette machine.
 */
export function coqueNative(cible, tmp) {
  const prete = path.join(ICI, 'coque-mac');
  if (fs.existsSync(prete)) { fs.copyFileSync(prete, cible); return true; }
  const sw = swiftc();
  const sdk = path.join(OUTILS_APPLE, 'SDKs/MacOSX.sdk');
  if (!sw || !fs.existsSync(sdk)) return false;
  try {
    const env = {...process.env, DEVELOPER_DIR: OUTILS_APPLE};
    const morceaux = [];
    for (const arch of ['arm64', 'x86_64']) {
      const sortie = path.join(tmp, `coque-${arch}`);
      execFileSync(sw, ['-O', '-swift-version', '5', '-sdk', sdk, '-target', `${arch}-apple-macos13.0`, '-o', sortie, path.join(ICI, 'coque-mac.swift')], {stdio: ['ignore', 'ignore', 'inherit'], env});
      morceaux.push(sortie);
    }
    // lipo des outils Apple en chemin direct : celui de /usr/bin s'arrête si la licence de Xcode n'a pas été acceptée
    const lipo = [path.join(OUTILS_APPLE, 'usr/bin/lipo')].find((c) => fs.existsSync(c)) ?? 'lipo';
    execFileSync(lipo, ['-create', ...morceaux, '-output', cible], {env});
    return true;
  } catch (e) {
    console.warn(`Fenêtre native non compilée (${String(e.message).split('\n')[0]}) : Dérush s'ouvrira dans une fenêtre de navigateur.`);
    return false;
  }
}

/** L'ancien lanceur (fenêtre de Chrome) : déjà compilé dans outils/lanceur-mac, sinon compilé avec les outils Apple. */
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
  fs.mkdirSync(resources, {recursive: true}); // même quand le programme reste à sa place (--sur-place) : l'icône et le lanceur y vont
  // le programme : copié dans l'app (app à partager), ou laissé à sa place (copie GitHub, mise à jour par git pull)
  if (!surPlace) {
    fs.mkdirSync(prog, {recursive: true});
    for (const f of ['derush.mjs', 'package.json', 'README.md', 'INSTALLER.md', 'LICENCE.md', 'NOTICES.md', 'AGENTS.md', 'CLAUDE.md']) if (fs.existsSync(path.join(RACINE, f))) fs.copyFileSync(path.join(RACINE, f), path.join(prog, f));
    for (const d of ['lib', 'public', 'outils', 'modeles', 'bin', 'competences', 'docs']) if (fs.existsSync(path.join(RACINE, d))) fs.cpSync(path.join(RACINE, d), path.join(prog, d), {recursive: true, filter: (src) => path.basename(src) !== '__pycache__'});
  }
  // l'icône
  icone(resources, tmp);
  const node = process.execPath;
  // le dossier du Node qui fabrique l'app passe en premier ; écrit avec $HOME quand il est dans le dossier personnel :
  // l'app partagée ne porte pas le nom de la personne qui l'a fabriquée, et le chemin reste bon chez une autre
  const dossierNode = path.dirname(node);
  const cheminNode = dossierNode.startsWith(os.homedir() + path.sep) ? `$HOME${dossierNode.slice(os.homedir().length)}` : dossierNode;
  const chemins = `export PATH="${cheminNode}:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
APP="${surPlace ? path.resolve(RACINE).replace(/"/g, '\\"') : '\${0:A:h}/app'}"
NODE="$(command -v node)"
if [[ -z "$NODE" ]]; then
  # Node rangé ailleurs : celui de Dérush, ou celui d'un gestionnaire de versions (volta, nvm, fnm)
  for n in "$HOME/Library/Application Support/Dérush/node/bin/node" "$HOME/.volta/bin/node" $HOME/.nvm/versions/node/*/bin/node(NOn) $HOME/.local/share/fnm/node-versions/*/installation/bin/node(NOn); do
    if [[ -x "$n" ]]; then NODE="$n"; export PATH="\${n:h}:$PATH"; break; fi
  done
fi`;
  // l'exécutable de l'app : la fenêtre native, sinon l'ancien lanceur (fenêtre de navigateur)
  const executable = path.join(contents, 'MacOS', 'Derush');
  const native = coqueNative(executable, tmp);
  // l'empreinte de la fenêtre posée (avant la signature, qui modifie le binaire) : rafraichirApp() s'en sert
  if (native && fs.existsSync(path.join(ICI, 'coque-mac'))) fs.writeFileSync(path.join(resources, 'coque.sha256'), empreinteCoque(path.join(ICI, 'coque-mac')));
  const lanceur = native ? `#!/bin/zsh
# Dérush — lanceur du moteur. La fenêtre native (Contents/MacOS/Derush) l'appelle et lit sa sortie : l'adresse du moteur
# (DERUSH_URL=…), ou ce qui manque (DERUSH_ERREUR=node), qu'elle explique alors dans une fenêtre du Mac.
${chemins}
if [[ -z "$NODE" ]]; then
  print "DERUSH_ERREUR=node"
  exit 3
fi
exec "$NODE" "$APP/derush.mjs" --coque "$@"
` : `#!/bin/zsh
# Dérush — lanceur (appelé par Contents/MacOS/Derush). Si Dérush tourne déjà, il rouvre simplement sa fenêtre.
${chemins}
JOURNAL="$HOME/Library/Logs/Dérush.log"
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
  if (!native) lanceurNatif(executable, tmp);
  fs.chmodSync(executable, 0o755);
  const lecture = 'Dérush lit tes vidéos, tes sons et tes photos là où ils sont, sans les copier.';
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
  <key>CFBundleDevelopmentRegion</key><string>fr</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHumanReadableCopyright</key><string>Dérush par IABAI (YABAÏ) — le montage vidéo avec ton IA</string>
${native ? `  <key>NSPrincipalClass</key><string>NSApplication</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSApplicationCategoryType</key><string>public.app-category.video</string>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key><true/>
  </dict>
  <key>NSMicrophoneUsageDescription</key><string>Dérush enregistre ta voix quand tu le demandes (voix off, podcast). Elle reste sur ton ordinateur.</string>
  <key>NSCameraUsageDescription</key><string>Dérush te filme quand tu le demandes (podcast, face caméra). La vidéo reste sur ton ordinateur.</string>
  <key>NSDesktopFolderUsageDescription</key><string>${lecture}</string>
  <key>NSDocumentsFolderUsageDescription</key><string>${lecture}</string>
  <key>NSDownloadsFolderUsageDescription</key><string>${lecture}</string>
  <key>NSRemovableVolumesUsageDescription</key><string>${lecture}</string>
  <key>NSNetworkVolumesUsageDescription</key><string>${lecture}</string>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeName</key><string>Vidéos, sons et photos</string>
      <key>CFBundleTypeRole</key><string>Viewer</string>
      <key>LSHandlerRank</key><string>None</string>
      <key>LSItemContentTypes</key>
      <array><string>public.movie</string><string>public.audio</string><string>public.image</string></array>
    </dict>
  </array>` : '  <key>LSUIElement</key><true/>'}
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

/**
 * Une ancienne installation de la bêta (l'app « sur place » qui ouvrait une fenêtre de Chrome) devient l'app native :
 * elle est refaite, puis rouverte. Renvoie true quand c'est fait (l'appelant s'arrête alors : la nouvelle app prend la suite).
 */
export async function migrerVersAppNative() {
  if (process.platform !== 'darwin') return false;
  const app = path.join(os.homedir(), 'Applications', 'Dérush.app');
  const plist = path.join(app, 'Contents', 'Info.plist');
  const lanceur = path.join(app, 'Contents', 'Resources', 'lanceur.sh');
  if (!fs.existsSync(plist) || !fs.existsSync(lanceur)) return false;
  if (!fs.readFileSync(plist, 'utf8').includes('<key>LSUIElement</key>')) return false; // déjà native
  // seulement l'app qui lance CE dossier (celle qui se met à jour par GitHub) : une app qui contient son propre
  // programme se refait avec « construire-app »
  if (!fs.readFileSync(lanceur, 'utf8').includes(`APP="${path.resolve(RACINE).replace(/"/g, '\\"')}"`)) return false;
  if (!coqueDisponible()) return false;
  const r = await construireApp({surPlace: true});
  if (fs.readFileSync(plist, 'utf8').includes('<key>LSUIElement</key>')) return false; // la coque n'a pas pu être posée
  console.log('Dérush devient une vraie app Mac : elle se rouvre dans sa propre fenêtre.');
  spawn('open', ['-n', r.app], {detached: true, stdio: 'ignore'}).unref();
  return true;
}

/**
 * L'app « sur place » (celle qui lance la copie GitHub de ce dossier) garde sa propre copie de la fenêtre native
 * (Contents/MacOS/Derush) : une mise à jour par GitHub change le programme, pas cette copie. Au lancement, Dérush la
 * remplace si celle du dépôt a changé, remet le numéro de version de l'app à jour et la signe de nouveau. Le
 * remplacement passe par un renommage : la fenêtre ouverte garde l'ancienne copie jusqu'à ce qu'on quitte, la
 * prochaine ouverture prend la nouvelle. Renvoie ce qui a été fait ({coque, version}), ou null.
 */
/** L'empreinte d'un binaire de la fenêtre native. */
const empreinteCoque = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
export function rafraichirApp(app = path.join(os.homedir(), 'Applications', 'Dérush.app')) {
  if (process.platform !== 'darwin') return null;
  const contents = path.join(app, 'Contents');
  const plist = path.join(contents, 'Info.plist');
  const lanceur = path.join(contents, 'Resources', 'lanceur.sh');
  const executable = path.join(contents, 'MacOS', 'Derush');
  const neuve = path.join(ICI, 'coque-mac');
  try {
    if (!fs.existsSync(plist) || !fs.existsSync(lanceur) || !fs.existsSync(executable) || !fs.existsSync(neuve)) return null;
    // seulement l'app qui lance CE dossier, et seulement une app native (pas l'ancien lanceur de Chrome)
    if (!fs.readFileSync(lanceur, 'utf8').includes(`APP="${path.resolve(RACINE).replace(/"/g, '\\"')}"`)) return null;
    let texte = fs.readFileSync(plist, 'utf8');
    if (texte.includes('<key>LSUIElement</key>')) return null;
    // la signature de l'app modifie le binaire : on compare l'empreinte de la fenêtre du dépôt à celle notée dans
    // l'app quand elle y a été posée (absente sur une app d'avant la 11 : elle est alors posée une fois)
    const voulue = empreinteCoque(neuve);
    let posee = null;
    try { posee = fs.readFileSync(path.join(contents, 'Resources', 'coque.sha256'), 'utf8').trim(); } catch { /* app d'avant la 11 */ }
    const coque = posee !== voulue;
    const version = !texte.includes(`<key>CFBundleShortVersionString</key><string>${VERSION}</string>`);
    if (!coque && !version) return null;
    if (coque) {
      const tmp = path.join(contents, 'MacOS', '.Derush.nouveau');
      fs.copyFileSync(neuve, tmp);
      fs.chmodSync(tmp, 0o755);
      fs.renameSync(tmp, executable);
      // avant la signature : ce fichier fait partie de ce qu'elle scelle
      fs.writeFileSync(path.join(contents, 'Resources', 'coque.sha256'), voulue);
    }
    if (version) {
      texte = texte.replace(/(<key>CFBundle(?:Short)?VersionString<\/key><string>)[^<]*(<\/string>)/g, `$1${VERSION}$2`)
        .replace(/(<key>CFBundleVersion<\/key><string>)[^<]*(<\/string>)/g, `$1${VERSION}$2`);
      fs.writeFileSync(plist, texte);
    }
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], {stdio: 'ignore'});
    return {coque, version};
  } catch (e) {
    console.warn(`L’app n’a pas pu être rafraîchie : ${e.message}`);
    return null;
  }
}

export async function construireApp({cible, zip = false, dmg = false, surPlace = false, sansRaccourci = false} = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-app-'));
  try {
    if (dmg) {
      // l'image disque : l'app et un raccourci vers Applications, pour l'installer en la glissant
      const dossier = path.join(tmp, 'image');
      fs.mkdirSync(dossier);
      const app = fabriquer(dossier, tmp);
      fs.symlinkSync('/Applications', path.join(dossier, 'Applications'));
      const sortie = path.join(path.resolve(cible ?? '.'), `Dérush ${VERSION}.dmg`);
      fs.rmSync(sortie, {force: true});
      execFileSync('hdiutil', ['create', '-volname', `Dérush ${VERSION}`, '-srcfolder', dossier, '-ov', '-format', 'UDZO', sortie], {stdio: 'ignore'});
      try { execFileSync(LSREGISTER, ['-u', app], {stdio: 'ignore'}); } catch { /* jamais enregistrée */ }
      console.log(`Dérush ${VERSION} prêt à installer : ${sortie}`);
      return {dmg: sortie};
    }
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
    if (sansRaccourci) { console.log(`Dérush.app ${VERSION} : ${app}`); return {app, raccourci: null}; }
    try { execFileSync(LSREGISTER, ['-f', app], {stdio: 'ignore'}); } catch { /* le Finder le verra quand même */ }
    let raccourci = null;
    try { raccourci = raccourciBureau(app); } catch (e) { console.warn(`Raccourci du Bureau non créé : ${e.message}`); }
    console.log(`Dérush.app ${VERSION} : ${app}${raccourci ? `\nRaccourci : ${raccourci}` : ''}`);
    return {app, raccourci};
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}
