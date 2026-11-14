// Dérush — essais des couleurs (lib/couleurs.mjs) : les courbes Log des caméras, les gammes, les LUT calculés, leur
// application par FFmpeg, le profil proposé selon les mesures et la caméra, et l'étalonnage d'un plan.
//   node outils/essai-couleurs.mjs
// Aucun réseau, aucune IA. Les LUT d'essai sont écrits dans un dossier temporaire.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-essai-couleurs-'));
process.env.DERUSH_SUPPORT = tmp;
const C = await import('../lib/couleurs.mjs');
const {FFMPEG} = await import('../lib/outils.mjs');

let ok = 0;
let ko = 0;
const essai = (nom, vrai, detail = '') => {
  if (vrai) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`); }
};
const proche = (a, b, tol) => Math.abs(a - b) <= tol;

console.log('Les gammes');
const M709 = C.versXYZ([[0.640, 0.330], [0.300, 0.600], [0.150, 0.060]]);
essai('Rec.709 → XYZ : la matrice connue (0,4124 0,3576 0,1805…)', [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]].every((l, i) => l.every((v, j) => proche(M709[i][j], v, 0.0006))), JSON.stringify(M709));
const id = C.versRec709('rec709');
essai('Rec.709 → Rec.709 : l’identité', id.every((l, i) => l.every((v, j) => proche(v, i === j ? 1 : 0, 1e-9))));
for (const g of ['sgamut3cine', 'vgamut', 'awg3', 'rec2020']) {
  const m = C.versRec709(g);
  const blanc = m.map((l) => l[0] + l[1] + l[2]);
  essai(`${g} → Rec.709 : le blanc reste blanc`, blanc.every((v) => proche(v, 1, 1e-6)), blanc.join(' '));
}

console.log('Les courbes Log (gris moyen 18 %)');
for (const [k, p] of Object.entries(C.PROFILS)) {
  const vers = p.entree === 'cv' ? (x) => (x * 876 + 64) / 1023 : (x) => x;
  // le gris du fabricant, donné dans sa convention : on le ramène à ce que donne FFmpeg, puis on décode
  const entreeFfmpeg = p.entree === 'cv' ? (p.gris * 1023 - 64) / 876 : p.gris;
  const g = p.decoder(vers(entreeFfmpeg));
  essai(`${p.nom} : son gris donne 0,18`, proche(g, 0.18, 0.004), g.toFixed(4));
  let monte = true;
  let avant = -Infinity;
  for (let i = 0; i <= 200; i++) { const v = p.decoder(i / 200); if (!(v >= avant - 1e-12)) monte = false; avant = v; }
  essai(`${p.nom} : la courbe ne redescend jamais`, monte);
}

console.log('Les LUT calculés');
for (const k of ['slog3', 'vlog', 'applelog']) {
  const p = C.PROFILS[k];
  const txt = C.lutProfil(k, 17);
  const lignes = txt.split('\n').filter((l) => /^[0-9.-]+ [0-9.-]+ [0-9.-]+$/.test(l)).map((l) => l.split(' ').map(Number));
  essai(`${k} : 17³ valeurs`, lignes.length === 17 ** 3, String(lignes.length));
  const diag = Array.from({length: 17}, (_, i) => lignes[i + i * 17 + i * 289]);
  essai(`${k} : le gris reste neutre`, diag.every(([r, g, b]) => proche(r, g, 0.002) && proche(g, b, 0.002)));
  essai(`${k} : du noir au blanc sans redescendre`, diag.every((v, i) => i === 0 || v[1] >= diag[i - 1][1] - 1e-9));
  essai(`${k} : le noir de la caméra devient noir`, diag[0][1] < 0.06, diag[0][1].toFixed(3));
}

console.log('Appliqué par FFmpeg à une mire S-Log3');
{
  // une mire de 5 gris (2, 9, 18, 45, 90 % de réflexion) encodée en S-Log3, enregistrée comme une caméra (plage vidéo)
  const enc = (x) => (x >= 0.01125 ? (420 + Math.log10((x + 0.01) / 0.19) * 261.5) : x * (171.2102946929 - 95) / 0.01125 + 95);
  const cv = [0.02, 0.09, 0.18, 0.45, 0.9].map(enc); // codes 10 bits
  const y8 = cv.map((c) => Math.round(c / 4)); // en 8 bits pour la mire
  const expr = `if(lt(X,W/5),${y8[0]},if(lt(X,2*W/5),${y8[1]},if(lt(X,3*W/5),${y8[2]},if(lt(X,4*W/5),${y8[3]},${y8[4]}))))`;
  const mire = path.join(tmp, 'mire.mp4');
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=500x100:d=0.2:r=5', '-vf', `geq=lum='${expr}':cb=128:cr=128,format=yuv420p`, '-color_range', 'tv', '-c:v', 'libx264', '-qp', '0', mire]);
  const lut = path.join(tmp, 'slog3.cube');
  fs.writeFileSync(lut, C.lutProfil('slog3'));
  const brut = execFileSync(FFMPEG, ['-v', 'error', '-i', mire, '-frames:v', '1', '-vf', `${C.filtreCube(lut)},scale=5:1:flags=area,format=rgb24`, '-f', 'rawvideo', 'pipe:1']);
  const g = [0, 1, 2, 3, 4].map((k) => brut[k * 3 + 1] / 255);
  essai('le gris 18 % sort vers 41 % (norme BT.709)', proche(g[2], 0.41, 0.035), g.map((x) => x.toFixed(2)).join(' '));
  essai('les cinq gris restent dans l’ordre', g.every((v, i) => i === 0 || v > g[i - 1]));
  essai('le blanc 90 % sort blanc (vers 91 %), sans brûler', g[4] > 0.85 && g[4] < 0.98, g[4].toFixed(2));
  essai('le noir profond (2 %) reste sombre', g[0] < 0.14, g[0].toFixed(2));
}

console.log('Le profil proposé');
const plat = {exposition: 0.42, ombres: 0.14, hautes_lumieres: 0.5, contraste: 0.36, saturation: 0.18, dominante: {bleu: 0, rouge: 0}};
const normal = {exposition: 0.45, ombres: 0.05, hautes_lumieres: 0.88, contraste: 0.83, saturation: 0.45, dominante: {bleu: 0, rouge: 0}};
const video = (camera, extra = {}) => ({type: 'video', nom: 'rush.mp4', bits: 10, tournage: {logiciel: camera}, ...extra});
essai('Sony plat en 10 bits → S-Log3', C.profilSuggere(video('Sony ILCE-7SM3'), plat)?.id === 'slog3');
essai('DJI plat → D-Log M (LUT officiel ou automatique)', C.profilSuggere(video('DJI OsmoPocket3'), plat)?.id === 'dlogm');
essai('caméra inconnue, plat en 10 bits → conversion automatique', C.profilSuggere(video(''), plat)?.id === 'auto');
essai('image normale → rien à convertir', C.profilSuggere(video('Sony ILCE-7SM3'), normal) === null);
// l'iPhone se reconnaît à l'appareil écrit dans le fichier (« Apple iPhone 16 Pro »), son logiciel n'est que la version d'iOS
const iphone = {...video(''), tournage: {appareil: 'Apple iPhone 16 Pro', logiciel: '18.1'}, primaires: 'bt2020', hdr: false};
essai('iPhone en Apple Log (BT.2020, 10 bits, pas HDR) → Apple Log', C.profilSuggere(iphone, normal)?.id === 'applelog');
essai('iPhone en couleurs normales, même terne → rien à convertir', C.profilSuggere({...iphone, primaires: 'bt709'}, plat) === null);
// un ProRes porte « Apple ProRes » comme encodeur : ce n'est pas un iPhone, et son Log n'est pas de l'Apple Log
essai('ProRes d’une autre caméra (encodeur « Apple ProRes »), plat en 10 bits → pas Apple Log', C.profilSuggere(video('Apple ProRes 422 HQ', {primaires: 'bt2020'}), plat)?.id === 'auto');

console.log('Le LUT d’un rush');
essai('pas de profil → pas de LUT', C.lutDe({id: 'M1'}) === null);
essai('« normal » → pas de LUT', C.lutDe({id: 'M1', couleur: {profil: 'normal'}}) === null);
const f = C.lutDe({id: 'M1', couleur: {profil: 'vlog'}});
essai('V-Log → un fichier .cube calculé une fois', !!f && fs.existsSync(f) && /LUT_3D_SIZE 33/.test(fs.readFileSync(f, 'utf8')));
const fa = C.lutDe({id: 'M2', couleur: {profil: 'auto', ombres: 0.14, lumieres: 0.5}});
essai('automatique → un .cube propre à ce rush', !!fa && fs.existsSync(fa));
essai('le filtre FFmpeg désigne le LUT calculé', C.filtreLut({id: 'M1', couleur: {profil: 'vlog'}}) === C.filtreCube(f) && /^lut3d=file=.*vlog-v\d+\.cube:interp=tetrahedral$/.test(C.filtreCube(f)));
{
  // un LUT rangé dans un dossier au nom difficile : une apostrophe (« LUT d'usine »), le « : » d'un disque Windows
  // (« C:/… »), une virgule, des crochets, un point-virgule. FFmpeg doit lire le bon fichier, dans -vf comme dans
  // -filter_complex (entre guillemets, l'apostrophe fermait le texte et le « : » coupait l'option en deux)
  const dur = path.join(tmp, 'LUT d’usine', "LUT d'usine, C: [Sony];1");
  fs.mkdirSync(dur, {recursive: true});
  const lutDur = path.join(dur, 'slog3.cube');
  fs.copyFileSync(f, lutDur);
  const lit = (args) => { try { execFileSync(FFMPEG, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=gray:s=16x16:d=0.04', ...args, '-frames:v', '1', '-f', 'null', '-'], {stdio: 'pipe'}); return ''; } catch (e) { return String(e.stderr ?? e.message).slice(-200); } };
  const r1 = lit(['-vf', C.filtreCube(lutDur)]);
  essai('un chemin avec apostrophe, « : », « , », crochets et « ; » : lu par FFmpeg (-vf)', r1 === '', r1);
  const r2 = lit(['-filter_complex', `[0:v]${C.filtreCube(lutDur)},split[a][b];[a][b]hstack[s]`, '-map', '[s]']);
  essai('… et dans un graphe de filtres (-filter_complex)', r2 === '', r2);
  const police = ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf'].find((x) => fs.existsSync(x));
  if (police) {
    // la police de Windows est « C:/Windows/Fonts/arialbd.ttf » : le même « : » dans un drawtext
    const policeDure = path.join(dur, 'arialbd.ttf');
    fs.copyFileSync(police, policeDure);
    const r3 = lit(['-vf', `drawtext=fontfile=${C.cheminFiltre(policeDure)}:text='01\\:02':fontsize=8`]);
    essai('… et une police au même endroit (drawtext)', r3 === '', r3);
  }
}

console.log('L’étalonnage d’un plan');
essai('rien de réglé → null', C.couleurPropre({exposition: 0, contraste: 0}) === null);
essai('les valeurs sont bornées et entières', JSON.stringify(C.couleurPropre({exposition: 250.4, teinte: -12.6, inconnu: 3})) === '{"exposition":100,"teinte":-13}');
const r = C.versRemotion({exposition: 50, contraste: 50, saturation: -50, temperature: 30, teinte: -20});
essai('vers Remotion : +1 diaphragme, contraste 1,3, saturation 0,5, température 0,3, teinte −0,2', proche(r.exposure, 1, 1e-9) && proche(r.contrast, 1.3, 1e-9) && proche(r.saturation, 0.5, 1e-9) && proche(r.temperature, 0.3, 1e-9) && proche(r.tint, -0.2, 1e-9), JSON.stringify(r));

fs.rmSync(tmp, {recursive: true, force: true});
console.log(`\n${ok} essais réussis, ${ko} ratés.`);
process.exit(ko ? 1 : 0);
