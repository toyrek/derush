// Dérush — essais du contrôle des textes à l'écran (lib/controle.mjs, outils/derush-controle.mjs) : le vocabulaire du
// montage, les mots collés (« cettecollection »), le texte coupé au bord (« DEKO » pour « HIDEKO »), le texte caché
// par le réseau, et ce qui ne doit PAS être signalé (« qu'une », un vrai mot, un texte filmé qui bouge, une lecture
// sans le point d'un « MIZUNO · AKATA »). Puis, sur Mac, une vraie vidéo fabriquée exprès, lue par Apple Vision.
//   node outils/essai-controle.mjs
// Aucun réseau, aucune IA. Tout est écrit dans un dossier temporaire.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-essai-controle-'));
const ICI = path.dirname(fileURLToPath(import.meta.url));
const C = await import('../lib/controle.mjs');
const {FFMPEG} = await import('../lib/outils.mjs');
const {PYTHON} = await import('../lib/moteurs.mjs');

let ok = 0;
let ko = 0;
const essai = (nom, vrai, detail = '') => { if (vrai) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`); } };

console.log('Les mots du montage');
essai('« J’ai » → « jai », accents retirés', C.normaliser('J’ai') === 'jai' && C.normaliser('Héritages') === 'heritages');
const vocab = C.vocabulaire(['J’ai reçu la nouveauté de Hideko Mizuno', 'dans la collection Héritages', 'si tu ne connais pas cette collection', 'qu’une', 'il y a du Moto Hagio', 'mon de']);
essai('le vocabulaire garde le mot entier et ses morceaux (« j’ai » → jai, j, ai)', vocab.has('jai') && vocab.has('ai') && vocab.has('heritages'));
fs.writeFileSync(path.join(tmp, 'st.srt'), '1\n00:00:00,000 --> 00:00:01,000\nJ’ai reçu\n\n2\n00:00:01,000 --> 00:00:02,000\nla nouveauté\n');
essai('un SRT donne ses lignes, sans les temps', JSON.stringify(C.textesFichier(path.join(tmp, 'st.srt'))) === JSON.stringify(['J’ai reçu', 'la nouveauté']));
fs.writeFileSync(path.join(tmp, 'Titre.tsx'), "const s = {background: 'black', position: 'absolute'};\nexport const T = () => <div style={s}>COLLECTION HÉRITAGES</div>;\nconst x = 'Service presse';\n");
const tsx = C.textesFichier(path.join(tmp, 'Titre.tsx'));
essai('le code du kit donne ses textes affichés, pas ses mots de code', tsx.includes('COLLECTION HÉRITAGES') && tsx.includes('Service presse') && !tsx.includes('black') && !tsx.includes('absolute'), JSON.stringify(tsx));
fs.writeFileSync(path.join(tmp, 'l.json'), JSON.stringify({chunks: [{mots: [{t: 'cette', d: 1}, {t: 'collection'}]}], nom: 'description', detail: 'pas affiché'}));
const tj = C.textesJson(JSON.parse(fs.readFileSync(path.join(tmp, 'l.json'), 'utf8')));
essai('un JSON donne ses textes (« t »), pas ses descriptions (« nom », « detail »)', tj.includes('cette') && tj.includes('collection') && !tj.includes('pas affiché'), JSON.stringify(tj));

console.log('Les mots collés');
essai('« cettecollection » = « cette » + « collection »', JSON.stringify(C.decoupeCollee('cettecollection,', vocab)) === '["cette","collection"]');
essai('« J’aireçu » = « jai » + « recu »', JSON.stringify(C.decoupeCollee('J’aireçu', vocab)) === '["jai","recu"]');
essai('« qu’une » n’est pas collé (l’apostrophe sépare)', C.decoupeCollee('QU’UNE', vocab) === null);
essai('« les:amis » n’est pas collé (un signe sépare)', C.decoupeCollee('les:amis', C.vocabulaire(['les amis'])) === null);
essai('un mot du montage n’est jamais collé (« collection »)', C.decoupeCollee('collection', vocab) === null);
essai('« MIZUNO•AKATA » est lu en deux mots', JSON.stringify(C.separer([{t: 'MIZUNO•AKATA', x: 0.2, y: 0.3, l: 0.4, h: 0.02}]).map((m) => m.t)) === '["MIZUNO","AKATA"]');

console.log('Le texte coupé');
essai('« DEKO » au bord gauche → « hideko »', C.motTronque('deko', vocab, 'gauche') === 'hideko');
essai('« nouv » au bord droit → « nouveaute »', C.motTronque('nouv', vocab, 'droite') === 'nouveaute');
essai('un mot entier n’est pas tronqué', C.motTronque('hideko', vocab, 'gauche') === null);

console.log('Juger une lecture');
const mot = (t, x, y, l, h, extra = {}) => ({t, x, y, l, h, ...extra});
const image = (t, lignes) => ({t, lignes: lignes.map((mots) => ({t: mots.map((m) => m.t).join(' '), mots}))});
const lecture = {images: [0, 1 / 3, 2 / 3, 1].map((t, k) => image(t, [
  // un sous-titre aux mots collés, immobile
  [mot('cettecollection', 0.25, 0.64, 0.5, 0.05)],
  // une petite ligne coupée au bord gauche, immobile
  [mot('DEKO', 0, 0.31, 0.17, 0.021), mot('MIZUNO', 0.18, 0.31, 0.29, 0.02)],
  // une page de manga qui défile : « MONDE » est un vrai mot, « rdre » bouge
  [mot('MONDE', 0.5, 0.4 + k * 0.05, 0.1, 0.02, {connu: true}), mot('rdre', 0, 0.7 + k * 0.05, 0.06, 0.03), mot('de', 0.07, 0.7 + k * 0.05, 0.03, 0.03), mot('conscription', 0.11, 0.7 + k * 0.05, 0.2, 0.03)],
  // une ligne bien écrite, sous les boutons de TikTok à droite
  [mot('dans', 0.62, 0.5, 0.1, 0.03), mot('la', 0.73, 0.5, 0.04, 0.03), mot('collection', 0.78, 0.5, 0.2, 0.03)],
]))};
const zones = {haut: 0.10, bas: 0.22, gauche: 0.05, droite: 0.14};
const j = C.juger(lecture, vocab, {zones, ips: 3});
const types = (l) => l.map((p) => `${p.type}:${p.texte}`);
essai('les mots collés sont un problème', types(j.problemes).includes('mots_colles:cettecollection'), JSON.stringify(types(j.problemes)));
essai('le texte coupé et immobile est un problème', types(j.problemes).includes('texte_coupe:DEKO'), JSON.stringify(types(j.problemes)));
essai('un vrai mot et un texte filmé qui bouge ne sont pas signalés', !types([...j.problemes, ...j.attention]).some((x) => /MONDE|rdre/.test(x)), JSON.stringify(types([...j.problemes, ...j.attention])));
essai('un texte du montage sous les boutons du réseau est « à regarder »', types(j.attention).includes('zone:collection'), JSON.stringify(types(j.attention)));
// « MIZUNOAKATA » lu une fois, mais « MIZUNO • AKATA » au même endroit sur l'image d'à côté : une erreur de lecture
const v2 = C.vocabulaire(['Hideko Mizuno', 'Akata']);
const l2 = {images: [image(0, [[mot('MIZUNOAKATA', 0.18, 0.31, 0.5, 0.03)]]), {t: 1 / 3, lignes: [{t: 'MIZUNO•AKATA', mots: [mot('MIZUNO•AKATA', 0.18, 0.31, 0.5, 0.03)]}]}]};
essai('« MIZUNOAKATA » n’est pas signalé quand l’image voisine montre le point', C.juger(l2, v2, {ips: 3}).problemes.length === 0);
// le texte déjà filmé dans les rushes (une bulle de manga « C'EST LE SEUL ENDROIT ») n'est jamais jugé
const v3 = C.vocabulaire(['c’est le livre', 'Hideko Mizuno', 'Akata', 'Héritage']);
const l3 = {images: [0, 1 / 3].map((t) => image(t, [[mot('CESTLE', 0.3, 0.5, 0.2, 0.03), mot('SEUL', 0.52, 0.5, 0.1, 0.03)], [mot('DEKO', 0, 0.31, 0.17, 0.021), mot('MIZUNO', 0.18, 0.31, 0.29, 0.02), mot('AKATA', 0.5, 0.31, 0.2, 0.02)]]))};
const filme = ['cestlaprisoncestleseulendroit', 'hidekomizuno', 'akata'];
const sans = types(C.juger(l3, v3, {ips: 3}).problemes);
const avec = types(C.juger(l3, v3, {ips: 3, filme}).problemes);
essai('sans les rushes, « CESTLE » d’une bulle de manga passerait pour des mots collés', sans.includes('mots_colles:CESTLE'), JSON.stringify(sans));
essai('avec le texte filmé des rushes, la bulle n’est plus jugée', !avec.includes('mots_colles:CESTLE'), JSON.stringify(avec));
essai('… mais un titre du montage coupé au bord le reste (« DEKO »)', avec.includes('texte_coupe:DEKO'), JSON.stringify(avec));
const ph = C.phrases(j);
essai('les phrases disent quoi, où et quand', ph.some((x) => /^Mots collés : « cettecollection » à 0 s/.test(x)) && ph.some((x) => /« hideko » coupé au bord gauche/.test(x)), JSON.stringify(ph));

console.log('Une vraie vidéo, lue par Apple Vision');
const possible = await C.controlePossible();
if (!possible.ok) console.log(`  · (non essayé ici : ${possible.pourquoi})`);
else {
  // trois passages d'une seconde et demie : une ligne propre, des mots collés, une ligne coupée au bord gauche
  const images = path.join(tmp, 'images');
  fs.mkdirSync(images);
  const dessin = path.join(tmp, 'dessiner.py');
  fs.writeFileSync(dessin, `import sys
from PIL import Image, ImageDraw, ImageFont
def police(t):
    for f in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        try: return ImageFont.truetype(f, t)
        except Exception: pass
    return ImageFont.load_default()
d = sys.argv[1]
for n, (txt, x) in enumerate([("J'ai reçu la", 200), ("cettecollection", 220), ("HIDEKO MIZUNO", -150)]):
    im = Image.new("RGB", (1080, 1920), (20, 30, 70))
    ImageDraw.Draw(im).text((x, 1200), txt, font=police(96), fill=(255, 255, 255))
    im.save(f"{d}/p{n}.png")
`);
  execFileSync(PYTHON, [dessin, images]);
  const video = path.join(tmp, 'textes.mp4');
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-framerate', '2/3', '-i', path.join(images, 'p%d.png'), '-vf', 'fps=30,format=yuv420p', '-t', '4.5', '-c:v', 'libx264', video]);
  fs.writeFileSync(path.join(tmp, 'dit.txt'), "J'ai reçu la nouveauté de Hideko Mizuno dans cette collection");
  const r = await C.controlerTextes(video, {textes: [path.join(tmp, 'dit.txt')], plateforme: 'tiktok', sortie: path.join(tmp, 'controle')});
  const tt = types(r.problemes ?? []);
  essai('la vidéo est lue (3 images par seconde)', r.ok && r.images_lues >= 12, JSON.stringify({ok: r.ok, n: r.images_lues, pourquoi: r.pourquoi}));
  essai('« cettecollection » est trouvé', tt.some((x) => /^mots_colles:cettecollection/i.test(x)), JSON.stringify(tt));
  essai('« HIDEKO » coupé au bord est trouvé', tt.some((x) => /^texte_coupe:/.test(x)), JSON.stringify(tt));
  essai('la ligne propre n’est pas signalée', !tt.some((x) => /j.?ai|recu|reçu|:la$/i.test(x)), JSON.stringify(tt));
  essai('une planche des images en cause est écrite', !!r.planche && fs.existsSync(r.planche));
  const c = spawnSync(process.execPath, [path.join(ICI, 'derush-controle.mjs'), video, '--textes', path.join(tmp, 'dit.txt'), '--sortie', path.join(tmp, 'c2')], {encoding: 'utf8', env: process.env});
  let jc = null;
  try { jc = JSON.parse(c.stdout); } catch { /* pas du JSON */ }
  essai('derush-controle répond en JSON, code 2 tant qu’il reste un problème', c.status === 2 && jc?.problemes?.length >= 2, `${c.status} ${c.stdout.slice(0, 200)}`);
}
const c0 = spawnSync(process.execPath, [path.join(ICI, 'derush-controle.mjs')], {encoding: 'utf8'});
essai('derush-controle sans rien : son mode d’emploi (accroche, voix, rythme compris), code 0', c0.status === 0 && /Usage/.test(c0.stdout) && /accroche/i.test(c0.stdout) && /rythme/i.test(c0.stdout));
const c1 = spawnSync(process.execPath, [path.join(ICI, 'derush-controle.mjs'), path.join(tmp, 'nulle-part.mp4')], {encoding: 'utf8'});
essai('derush-controle avec une vidéo absente : une erreur claire, code 1', c1.status === 1 && /introuvable/i.test(c1.stdout));

fs.rmSync(tmp, {recursive: true, force: true});
console.log(`\n${ok} essais réussis sur ${ok + ko}.`);
process.exit(ko ? 1 : 0);
