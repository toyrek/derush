#!/usr/bin/env node
// Dérush — rendre une vidéo du kit, en direct : pendant le rendu, Dérush montre les images au fur et à mesure,
// sur la table de montage et dans le lecteur.
//
//   node remotion/rendre.mjs [Composition] [sortie.mp4] [--props '{"cle": "valeur"}'] [--titre "Clip 1"] [--crf 16]
//
// Par défaut : la composition « Montage », rendue dans ../rendu/montage.mp4.
// Pour plusieurs vidéos (plusieurs clips, plusieurs formats) : une composition par vidéo, rendue chacune dans
// ../rendu/livraison/<nom>.mp4 (voir « Livrer plusieurs vidéos » dans LISEZMOI-IA.md).
//
// Ce que Dérush lit pendant le rendu : ../rendu/.direct/<rendu>/etat.json (progression) et f-00001.jpg… (une petite
// image par demi-seconde de vidéo). Si l'affichage en direct pose le moindre problème, le rendu continue sans lui.
//
// Quand l'IA travaille dans un bac à sable (Codex, Gemini), le navigateur de rendu ne peut pas y démarrer : Dérush donne
// alors un relais et fait le rendu à notre place, avec ces mêmes arguments. Le relais est une adresse locale
// (DERUSH_RELAIS), ou, quand le bac à sable coupe aussi le réseau local, un dossier où déposer la demande
// (DERUSH_RELAIS_BOITE). Rien à changer ici.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** Demande le rendu à Dérush. Renvoie le code de fin, ou null s'il n'y a pas de relais (on rend alors ici). */
async function parRelais() {
  const url = process.env.DERUSH_RELAIS;
  const jeton = process.env.DERUSH_RELAIS_JETON;
  if (!url || !jeton || process.env.DERUSH_PROJET_REMOTION) return null;
  let r;
  try {
    r = await fetch(`${url}/rendre`, {method: 'POST', headers: {'content-type': 'application/json', 'x-derush-relais': jeton}, body: JSON.stringify({args: process.argv.slice(2), cwd: process.cwd()})});
  } catch { return null; } // relais injoignable : on essaie ici
  if (r.status === 403 || r.status === 404) return null;
  const dec = new TextDecoder();
  let attente = ''; // on garde la fin de côté : la dernière ligne porte le code de fin
  for await (const morceau of r.body) {
    attente += dec.decode(morceau, {stream: true});
    if (attente.length > 60) { process.stdout.write(attente.slice(0, -60)); attente = attente.slice(-60); }
  }
  const code = /##DERUSH-RELAIS code=(\d+)##/.exec(attente)?.[1];
  process.stdout.write(attente.replace(/\n?##DERUSH-RELAIS code=\d+##\n?/, '\n'));
  return r.ok && code != null ? Number(code) : 1;
}
/**
 * Le même relais, par fichiers : on dépose la demande dans le dossier donné par Dérush (DERUSH_RELAIS_BOITE, dans le
 * dossier de travail), et Dérush répond dans un fichier, lu ici au fur et à mesure. Renvoie le code de fin, ou null
 * s'il n'y a pas de boîte.
 */
async function parBoite() {
  const boite = process.env.DERUSH_RELAIS_BOITE;
  const jeton = process.env.DERUSH_RELAIS_JETON;
  if (!boite || !jeton || process.env.DERUSH_PROJET_REMOTION) return null;
  const {randomBytes} = await import('node:crypto');
  const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const id = randomBytes(12).toString('hex');
  // un signe de vie toutes les 3 secondes : si cette commande est arrêtée, Dérush arrête le rendu
  const battement = path.join(boite, `battement-${id}`);
  const vivre = () => { try { fs.writeFileSync(battement, String(Date.now())); } catch { /* sans importance */ } };
  try {
    vivre();
    const demande = path.join(boite, `demande-${id}.json`);
    fs.writeFileSync(`${demande}.tmp`, JSON.stringify({jeton, route: 'rendre', corps: {args: process.argv.slice(2), cwd: process.cwd()}}));
    fs.renameSync(`${demande}.tmp`, demande);
  } catch (e) {
    console.error(`Le rendu n’a pas pu être demandé à Dérush (${e.message}).`);
    return 1;
  }
  const signe = setInterval(vivre, 3000);
  const reponse = path.join(boite, `reponse-${id}.txt`);
  const debut = Date.now();
  while (!fs.existsSync(reponse)) {
    if (Date.now() - debut > 30000) { clearInterval(signe); console.error('Dérush ne répond pas : le rendu n’a pas pu être demandé.'); return 1; }
    await pause(150);
  }
  const fd = fs.openSync(reponse, 'r');
  const dec = new TextDecoder();
  const bloc = Buffer.alloc(65536);
  let pos = 0;
  let reste = '';
  let code = null;
  while (code === null) {
    const n = fs.readSync(fd, bloc, 0, bloc.length, pos);
    if (!n) { await pause(200); continue; }
    pos += n;
    reste += dec.decode(bloc.subarray(0, n), {stream: true});
    let i;
    while (code === null && (i = reste.indexOf('\n')) >= 0) {
      const ligne = reste.slice(0, i);
      reste = reste.slice(i + 1);
      const fin = /^##DERUSH-RELAIS code=(\d+)##\s*$/.exec(ligne);
      if (fin) code = Number(fin[1]); else process.stdout.write(`${ligne}\n`);
    }
    // un morceau sans fin de ligne (l'avancement) part tout de suite, sauf s'il peut être le début de la dernière ligne
    if (code === null && reste && !reste.startsWith('#')) { process.stdout.write(reste); reste = ''; }
  }
  clearInterval(signe);
  fs.closeSync(fd);
  for (const f of [reponse, battement]) { try { fs.unlinkSync(f); } catch { /* déjà retiré */ } }
  return code;
}
const codeRelais = (await parBoite()) ?? (await parRelais());
if (codeRelais !== null) process.exit(codeRelais);

const {bundle} = await import('@remotion/bundler');
const {renderMedia, selectComposition} = await import('@remotion/renderer');

// le dossier du kit : celui de ce script, ou celui que Dérush désigne quand il rend lui-même (relais)
const ICI = process.env.DERUSH_PROJET_REMOTION ? path.resolve(process.env.DERUSH_PROJET_REMOTION) : path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (nom, defaut = null) => {
  const i = args.indexOf(nom);
  if (i < 0) return defaut;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const props = JSON.parse(option('--props', '{}'));
const titreDonne = option('--titre');
const crf = Number(option('--crf', '16'));
const composition = args[0] ?? 'Montage';
const sortie = path.resolve(args[1] ?? path.join(ICI, '..', 'rendu', 'montage.mp4'));
fs.mkdirSync(path.dirname(sortie), {recursive: true});

// le dossier que Dérush surveille
const id = `${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${composition.replace(/[^\w-]/g, '').slice(0, 30)}`;
const direct = path.join(ICI, '..', 'rendu', '.direct', id);
fs.mkdirSync(direct, {recursive: true});
const etat = {
  composition, titre: titreDonne ?? path.parse(sortie).name, sortie: path.relative(path.join(ICI, '..'), sortie),
  debut: new Date().toISOString(), etape: 'preparation', total: 0, rendues: 0, encodees: 0, fps: 30, largeur: 0, hauteur: 0, pas_s: 0.5, fin: null, erreur: null,
};
let derniereEcriture = 0;
const noter = (force = false) => {
  if (!force && Date.now() - derniereEcriture < 400) return;
  derniereEcriture = Date.now();
  try { fs.writeFileSync(path.join(direct, 'etat.json.tmp'), JSON.stringify(etat)); fs.renameSync(path.join(direct, 'etat.json.tmp'), path.join(direct, 'etat.json')); } catch { /* sans importance */ }
};
noter(true);

/**
 * Une seconde sortie pour le ffmpeg qui reçoit les images : une petite image par demi-seconde, pour le direct.
 * Le ffmpeg de Remotion n'a pas le filtre « fps » : la cadence de sortie (-r 2) fait le tri, et -frame_pts met
 * le temps dans le nom (f-00007.jpg = 3,5 s).
 */
const ajouterApercu = (avec) => (avec ? ({type, args: a}) => {
  if (type !== 'pre-stitcher') return a;
  return [...a, '-map', '0:v:0', '-vf', 'scale=270:-2', '-r', '2', '-frame_pts', '1', '-q:v', '6', '-y', path.join(direct, 'f-%05d.jpg')];
} : undefined);

async function rendre(avecApercu) {
  etat.etape = 'assemblage';
  noter(true);
  const serveUrl = await bundle({
    entryPoint: path.join(ICI, 'src', 'index.ts'), rootDir: ICI, publicDir: path.join(ICI, 'public'), enableCaching: true, symlinkPublicDir: true,
    onProgress: () => noter(),
  });
  const comp = await selectComposition({serveUrl, id: composition, inputProps: props});
  Object.assign(etat, {total: comp.durationInFrames, fps: comp.fps, largeur: comp.width, hauteur: comp.height, etape: 'rendu'});
  noter(true);
  let derniere = -1;
  await renderMedia({
    composition: comp, serveUrl, codec: 'h264', outputLocation: sortie, inputProps: props, crf, colorSpace: 'bt709',
    imageFormat: 'jpeg', jpegQuality: 92, chromiumOptions: {gl: 'angle'}, overwrite: true, ffmpegOverride: ajouterApercu(avecApercu),
    // les images passent par un tuyau ordinaire vers ffmpeg : on peut alors en tirer une deuxième sortie (l'aperçu)
    disableSharedMemoryCapture: avecApercu,
    onProgress: ({renderedFrames, encodedFrames, stitchStage}) => {
      etat.rendues = renderedFrames;
      etat.encodees = encodedFrames;
      etat.etape = stitchStage === 'muxing' ? 'son' : 'rendu';
      const pct = Math.floor((100 * renderedFrames) / Math.max(1, comp.durationInFrames));
      if (pct !== derniere && pct % 5 === 0) { derniere = pct; console.log(`Rendu de « ${composition} » : ${pct} % (${renderedFrames}/${comp.durationInFrames} images)`); }
      noter();
    },
  });
}

const debut = Date.now();
let secours = null; // le rendu sans aperçu, lancé une seule fois si l'aperçu pose problème
const sansApercu = (raison) => {
  if (!secours) {
    console.log(`Le rendu en direct ne marche pas ici (${String(raison).split('\n')[0].slice(0, 200)}) : je rends sans lui.`);
    try { for (const f of fs.readdirSync(direct)) if (f.startsWith('f-')) fs.rmSync(path.join(direct, f)); } catch { /* rien à effacer */ }
    secours = rendre(false);
  }
  return secours;
};
const fini = () => {
  Object.assign(etat, {etape: 'fini', rendues: etat.total, fin: new Date().toISOString()});
  noter(true);
  console.log(`Vidéo rendue : ${sortie} (${etat.largeur}×${etat.hauteur}, ${etat.total} images, en ${Math.round((Date.now() - debut) / 1000)} s)`);
  process.exit(0);
};
const echec = (e) => {
  Object.assign(etat, {etape: 'erreur', erreur: String(e?.message ?? e).slice(0, 600), fin: new Date().toISOString()});
  noter(true);
  console.error(`Le rendu a échoué : ${e?.stack ?? e}`);
  process.exit(1);
};
// si le ffmpeg de l'aperçu s'arrête, Node le signale hors de la promesse (EPIPE) : on bascule sur le rendu sans aperçu
process.on('uncaughtException', (e) => {
  if (!secours && /EPIPE|ECONNRESET/.test(String(e?.code ?? e?.message ?? e))) sansApercu(e?.message ?? e).then(fini, echec);
  else if (!secours) echec(e);
});
// l'aperçu en direct ne doit jamais faire échouer un rendu : en cas d'erreur, on recommence sans lui
rendre(true).then(() => (secours ? secours : null)).then(fini, (e) => sansApercu(e?.message ?? e).then(fini, echec));
