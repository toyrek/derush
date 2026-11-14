// Dérush — les essais de ce qui casse sous Windows (pour qui modifie Dérush), rejoués sur n'importe quel système :
// - les chemins donnés aux filtres de FFmpeg (police et texte des planches, LUT) : « C:\…\Temp\t7.txt » cassait le
//   filtre drawtext, et avec lui la préparation de chaque demande à l'IA (« No option name near '/Windows/Fonts/… » chez
//   un testeur) ; ici, un vrai FFmpeg lit des fichiers rangés dans des dossiers aux noms piégés (« C: », espace,
//   apostrophe, virgule, crochets, point-virgule, « \ », « = », « % ») ;
// - le lancement des IA par un « .cmd » : l'interpréteur de commandes coupait « …\Nouveau projet\… » à l'espace
//   (« Settings file not found: …\Nouveau. ») ; ici, ce que Dérush tire des scripts de npm (le JavaScript, ou le
//   claude.exe des versions récentes), et la ligne écrite pour cmd.exe, rejouée par un modèle de cmd.exe (les « ^ », les
//   guillemets, la seconde lecture d'un script qui renvoie « %* ») puis par la découpe des arguments d'un programme
//   Windows : chaque argument doit arriver intact.
//   node outils/essai-windows.mjs [dossier où créer le dossier d'essai]
// Aucune IA, aucun réseau. Le dossier d'essai est effacé à la fin, sauf en cas d'échec.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
if (/^-/.test(process.argv[2] ?? '')) { console.log(`Usage : node ${path.relative(process.cwd(), process.argv[1])} [dossier temporaire]`); process.exit(0); }
const parent = path.resolve(process.argv[2] ?? os.tmpdir());
fs.mkdirSync(parent, {recursive: true});
const T = fs.mkdtempSync(path.join(parent, 'derush-essai-windows-'));
process.env.DERUSH_SUPPORT = path.join(T, 'support'); // « = », jamais « ??= » : AVANT tout import de lib/
process.env.DERUSH_BIBLIOTHEQUE = path.join(T, 'bibliotheque');
process.env.DERUSH_SANS_MAJ = '1';
process.env.DERUSH_SANS_NAVIGATEUR = '1';
const lib = (m) => import(pathToFileURL(path.join(D, 'lib', m)).href);
const {cheminFiltre, filtreCube} = await lib('couleurs.mjs');
const {FFMPEG} = await lib('outils.mjs');
const {argumentPourCmd, ligneCmd, preparerLancement, WINDOWS} = await lib('plateforme.mjs');
const {cibleDuScript} = await lib('ia.mjs');

let bons = 0;
let total = 0;
function essai(nom, ok, detail) {
  total++;
  if (ok) { bons++; console.log(`✓ ${nom}`); }
  else console.log(`✗ ${nom}${detail !== undefined ? `\n    ${typeof detail === 'string' ? detail : JSON.stringify(detail)?.slice(0, 700)}` : ''}`);
}

try {
  // ——— 1. Les chemins dans les filtres de FFmpeg ———
  const police = ['/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'C:\\Windows\\Fonts\\arial.ttf'].find((f) => fs.existsSync(f));
  const ffmpeg = spawnSync(FFMPEG, ['-version']).status === 0;
  if (!police || !ffmpeg) console.log(`· FFmpeg ou une police manquent ici : les essais des filtres sont sautés`);
  else {
    // sous Windows, « : », « " » et quelques autres ne peuvent pas être dans un nom de fichier : ces noms-là sont sautés
    const noms = ['C:', 'Nouveau projet', "l'été, [Japon]; 50%", 'a\\b', 'x=y:z'].filter((n) => !WINDOWS || !/[:\\]/.test(n));
    for (const n of noms) {
      const d = path.join(T, 'piege', n, 'Temp', 'derush-5k9G8q');
      fs.mkdirSync(d, {recursive: true});
      const texte = path.join(d, 't7.txt');
      fs.writeFileSync(texte, "Ça marche : l'été, 50 % !");
      const fonte = path.join(d, `arialbd${path.extname(police)}`);
      fs.copyFileSync(police, fonte);
      const cube = path.join(d, 'look.cube');
      fs.writeFileSync(cube, 'LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n');
      // comme la planche du pack (lib/pack.mjs) : drawtext avec la police et le texte dans des fichiers, puis le LUT
      const graphe = `drawtext=fontfile=${cheminFiltre(fonte)}:textfile=${cheminFiltre(texte)}:expansion=none:fontsize=20:fontcolor=white,${filtreCube(cube)}`;
      const vf = spawnSync(FFMPEG, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=320x80:d=0.2', '-vf', graphe, '-frames:v', '1', '-f', 'null', '-'], {encoding: 'utf8'});
      essai(`FFmpeg lit la police, le texte et le LUT dans « ${n} » (-vf)`, vf.status === 0, vf.stderr?.slice(0, 400));
      const fc = spawnSync(FFMPEG, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=320x80:d=0.2', '-filter_complex',
        `[0:v]${graphe},drawtext=fontfile=${cheminFiltre(fonte)}:textfile=${cheminFiltre(texte)}:expansion=none:fontsize=12[a];[a]null[b]`,
        '-map', '[b]', '-frames:v', '1', '-f', 'null', '-'], {encoding: 'utf8'});
      essai(`… et dans un graphe à plusieurs chaînes (-filter_complex, « , » et « ; »)`, fc.status === 0, fc.stderr?.slice(0, 400));
    }
  }
  // ce que FFmpeg reçoit pour les chemins du testeur : « : » et « \ » échappés pour les deux lectures du filtre
  essai('le chemin Windows du texte : « C\\\\: » et chaque « \\ » échappé deux fois',
    cheminFiltre('C:\\Users\\Camille\\AppData\\Local\\Temp\\derush-5k9G8q\\t7.txt') === 'C\\\\:\\\\\\\\Users\\\\\\\\Camille\\\\\\\\AppData\\\\\\\\Local\\\\\\\\Temp\\\\\\\\derush-5k9G8q\\\\\\\\t7.txt',
    cheminFiltre('C:\\Users\\Camille\\AppData\\Local\\Temp\\derush-5k9G8q\\t7.txt'));
  essai('la police de Windows : « C\\\\:/Windows/Fonts/arialbd.ttf »', cheminFiltre('C:/Windows/Fonts/arialbd.ttf') === 'C\\\\:/Windows/Fonts/arialbd.ttf');
  // aucun appel de FFmpeg ne pose un chemin dans un filtre sans cheminFiltre
  const sources = ['lib', 'outils'].flatMap((d) => fs.readdirSync(path.join(D, d)).filter((f) => /\.mjs$/.test(f)).map((f) => path.join(d, f)));
  const nus = [];
  for (const f of sources) {
    const t = fs.readFileSync(path.join(D, f), 'utf8');
    for (const m of t.matchAll(/(fontfile|textfile|lut3d=file|subtitles=filename|movie)=(?!\$\{cheminFiltre|\$\{C\.cheminFiltre|\$\{filtreCube)([^:,'"\s]{0,40})/g)) {
      if (/^\$\{/.test(m[2])) nus.push(`${f} : ${m[0]}`);
    }
  }
  essai('aucun chemin posé dans un filtre sans cheminFiltre (lib/, outils/)', nus.length === 0, nus);

  // ——— 2. Ce que Dérush tire des scripts « .cmd » de npm ———
  const dossier = 'C:\\Users\\Camille\\AppData\\Roaming\\npm';
  const shimJs = `@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n  SET PATHEXT=%PATHEXT:;.JS;=;%\r\n)\r\n\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*\r\n`;
  const shimExe = `@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*\r\n`;
  const shimAncien = `@IF EXIST "%~dp0\\node.exe" (\r\n  "%~dp0\\node.exe"  "%~dp0\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n) ELSE (\r\n  @SETLOCAL\r\n  @SET PATHEXT=%PATHEXT:;.JS;=;%\r\n  node  "%~dp0\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n)\r\n`;
  const vrai = () => true;
  const joindre = path.win32.join; // les chemins de Windows, quel que soit le système de l'essai
  let c = cibleDuScript(shimJs, dossier, {existe: vrai, node: 'NODE', joindre});
  essai('script npm vers un JavaScript : Node lance le script (pas cmd.exe, pas node.exe pris pour la cible)',
    c?.cmd === 'NODE' && c.prefixe[0] === 'C:\\Users\\Camille\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js', c);
  c = cibleDuScript(shimExe, dossier, {existe: vrai, node: 'NODE', joindre});
  essai('script npm vers un .exe (Claude Code récent) : le claude.exe est lancé tel quel, sans cmd.exe',
    c?.cmd === 'C:\\Users\\Camille\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe' && c.prefixe.length === 0, c);
  essai('… un .exe qui n’existe pas n’est pas lancé (on retombe sur le script)', cibleDuScript(shimExe, dossier, {existe: () => false, joindre}) === null);
  c = cibleDuScript(shimAncien, dossier, {existe: vrai, node: 'NODE', joindre});
  essai('ancien script npm (« %~dp0 ») : son JavaScript', c?.cmd === 'NODE' && /@openai\\codex\\bin\\codex\.js$/.test(c.prefixe[0]), c);
  essai('un script quelconque : rien à en tirer (null)', cibleDuScript('@echo off\r\necho bonjour %1\r\n', dossier, {joindre}) === null);

  // ——— 3. La ligne écrite pour cmd.exe, rejouée ———
  // Le modèle de cmd.exe : une lecture enlève les « ^ » hors guillemets (le caractère suivant est pris tel quel, et un
  // « ^" » ne commence ni ne finit un passage entre guillemets) et garde les guillemets. « cmd /d /s /c "…" » enlève les
  // guillemets du bout. Un script qui renvoie « %* » fait relire ses arguments une seconde fois.
  const lire = (s) => {
    let dedans = false;
    let r = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') { dedans = !dedans; r += ch; continue; }
      if (!dedans && ch === '^') { i++; if (i < s.length) r += s[i]; continue; }
      r += ch;
    }
    return r;
  };
  // La découpe des arguments d'un programme Windows (les règles de CommandLineToArgvW et de la bibliothèque C)
  const decouper = (s) => {
    const r = [];
    let i = 0;
    while (i < s.length) {
      while (s[i] === ' ' || s[i] === '\t') i++;
      if (i >= s.length) break;
      let a = '';
      let dedans = false;
      while (i < s.length && (dedans || (s[i] !== ' ' && s[i] !== '\t'))) {
        if (s[i] === '\\') {
          let n = 0;
          while (s[i] === '\\') { n++; i++; }
          if (s[i] === '"') { a += '\\'.repeat(Math.floor(n / 2)); if (n % 2) { a += '"'; i++; } else { dedans = !dedans; i++; } }
          else a += '\\'.repeat(n);
        } else if (s[i] === '"') {
          if (dedans && s[i + 1] === '"') { a += '"'; i += 2; } else { dedans = !dedans; i++; }
        } else { a += s[i]; i++; }
      }
      r.push(a);
    }
    return r;
  };
  const arguments_ = [
    '--settings', 'C:\\Users\\Camille\\Videos\\Dérush\\Nouveau projet\\exports\\Nouveau projet-pack-2026-11-14\\.derush\\reglages-claude.json',
    '--mcp-config', JSON.stringify({mcpServers: {treg: {type: 'http', url: 'https://treg.to/mcp?a=1&b=2', headers: {'X-Treg-Token': 'x y'}}}}),
    '--strict-mcp-config', '', 'C:\\dossier avec espace\\', 'fin \\" milieu', 'a & b | c < d > e ^ f % g ! h ( i ) j , k ; l',
    "l'été au Japon — 東京", '%PATH%', '"guillemets"', '\\\\serveur\\partage\\x',
  ];
  for (const deuxFois of [true, false]) {
    const ligne = ligneCmd('C:\\Users\\Jean Dupont\\AppData\\Roaming\\npm\\claude.cmd', arguments_, deuxFois);
    // la commande s'arrête à la première espace nue (ni protégée par « ^ », ni entre guillemets) : on rejoue la suite
    let dedans = false;
    let fin = -1;
    for (let i = 0; i < ligne.length; i++) {
      if (ligne[i] === '"') dedans = !dedans;
      else if (!dedans && ligne[i] === '^') i++;
      else if (!dedans && ligne[i] === ' ') { fin = i; break; }
    }
    const cmd = ligne.slice(0, fin);
    const premiere = lire(ligne.slice(fin + 1));
    const recus = decouper(deuxFois ? lire(premiere) : premiere);
    const egaux = recus.length === arguments_.length && recus.every((a, k) => a === arguments_[k]);
    essai(`cmd.exe ${deuxFois ? '(script qui renvoie %*, deux lectures)' : '(une lecture)'} : les ${arguments_.length} arguments arrivent intacts`, egaux,
      {recus, attendus: arguments_});
    essai(`… et la commande « C:\\Users\\Jean Dupont\\…\\claude.cmd » reste d'un seul tenant`, lire(cmd) === 'C:\\Users\\Jean Dupont\\AppData\\Roaming\\npm\\claude.cmd', lire(cmd));
  }
  essai('un argument simple : entre guillemets, échappés pour cmd.exe', argumentPourCmd('--version') === '^"--version^"' && argumentPourCmd('--version', true) === '^^^"--version^^^"');
  // hors Windows (ou pour un .exe), rien ne change : ni cmd.exe, ni interpréteur de commandes
  const l = preparerLancement('/usr/bin/env', ['a b'], {cwd: T, shell: true});
  essai(WINDOWS ? 'un .exe est lancé tel quel' : 'hors Windows : lancé tel quel, sans interpréteur de commandes', l.cmd === '/usr/bin/env' && l.args[0] === 'a b' && l.options.shell === false && l.options.cwd === T, l);
  // aucun lancement ne passe plus par « shell: true » ni par avecShell
  const restes = [];
  for (const f of [...sources, 'derush.mjs']) {
    // le code seulement (les commentaires racontent justement pourquoi « shell: true » abîmait les arguments)
    const t = fs.readFileSync(path.join(D, f), 'utf8').split('\n').filter((x) => !/^\s*(\/\/|\*|\/\*\*)/.test(x)).join('\n');
    if (/shell:\s*(true|!!shell|avecShell)/.test(t) || /avecShell\(/.test(t)) restes.push(f);
  }
  essai('plus aucun « shell: true » ni avecShell : tout passe par preparerLancement', restes.length === 0 || restes.every((f) => f === 'outils/essai-windows.mjs'), restes);
} catch (e) {
  essai('les essais sont allés au bout', false, e.stack);
} finally {
  if (bons === total) fs.rmSync(T, {recursive: true, force: true});
  else console.log(`\nLe dossier d’essai est gardé pour comprendre : ${T}`);
}
console.log(`\n${bons} essais réussis sur ${total}`);
process.exit(bons === total ? 0 : 1);
