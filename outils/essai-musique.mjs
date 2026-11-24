#!/usr/bin/env node
// Dérush — les essais de la musique faite sur l'ordinateur (lib/musique.mjs, la commande derush-musique) : le moteur
// repris de huashu-motion est bien celui que le LISEZ-MOI décrit, une partition se lit et se joue (durée, volume,
// nuances, repères, mêmes octets pour la même graine), un style donne une musique à la bonne durée qui suit les
// scènes, les temps d'un métronome sont retrouvés au centième, un morceau s'ajuste à la durée du film sans casser son
// rythme, et tout ce qui est faux est refusé en clair.
//   node outils/essai-musique.mjs [dossier où créer le dossier d'essai]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('node outils/essai-musique.mjs [dossier où créer le dossier d’essai]'); process.exit(0); }
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ? path.resolve(process.argv[2]) : os.tmpdir();
fs.mkdirSync(base, {recursive: true});
const tmp = fs.mkdtempSync(path.join(base, 'derush-essai-musique-'));
Object.assign(process.env, {DERUSH_SUPPORT: path.join(tmp, 'support'), ELEVENLABS_API_KEY: 'sk_eleven', DERUSH_GEMINI_CLE: 'cle-gemini'});
fs.mkdirSync(process.env.DERUSH_SUPPORT, {recursive: true});
const imp = (f) => import(pathToFileURL(path.join(D, 'lib', f)).href);
const lire = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const f = (nom) => path.join(tmp, nom);

let ok = 0;
let ko = 0;
const essai = (nom, cond, detail = '') => { if (cond === true) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail || cond ? ` — ${JSON.stringify(detail || cond).slice(0, 700)}` : ''}`); } };
const refus = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };
/** La commande, comme l'IA la lance : {code, json (ou null), texte}. */
const CMD = path.join(D, 'outils', 'derush-musique.mjs');
const commande = (args, cwd = tmp) => new Promise((resolve) => {
  execFile(process.execPath, [CMD, ...args], {cwd, env: process.env, maxBuffer: 64 << 20}, (err, stdout) => {
    let json = null;
    try { json = JSON.parse(stdout); } catch { /* du texte */ }
    resolve({code: err ? err.code ?? 1 : 0, json, texte: String(stdout)});
  });
});
/** Un WAV 16 bits stéréo → {freq, canaux, bits, n, L, R} (échantillons de −1 à 1). */
function wav(fichier) {
  const b = fs.readFileSync(fichier);
  const o = {riff: b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WAVE', canaux: b.readUInt16LE(22), freq: b.readUInt32LE(24), bits: b.readUInt16LE(34), octets: b.length};
  o.n = (b.length - 44) / 4;
  o.L = new Float32Array(o.n); o.R = new Float32Array(o.n);
  for (let i = 0; i < o.n; i++) { o.L[i] = b.readInt16LE(44 + 4 * i) / 32768; o.R[i] = b.readInt16LE(46 + 4 * i) / 32768; }
  return o;
}
/** Le niveau moyen (dB) d'un passage. */
const niveau = (w, de, a) => { let s = 0, k = 0; for (let i = Math.round(de * w.freq); i < Math.min(w.n, Math.round(a * w.freq)); i++) { s += w.L[i] ** 2 + w.R[i] ** 2; k += 2; } return k ? 10 * Math.log10(Math.max(s / k, 1e-12)) : -120; };
const empreinte = (fichier) => crypto.createHash('sha256').update(fs.readFileSync(fichier)).digest('hex');

const M = await imp('musique.mjs');
const {FFMPEG} = await imp('outils.mjs');
const ffmpeg = (args) => new Promise((resolve, reject) => execFile(FFMPEG, ['-v', 'error', '-y', ...args], (err, _o, e) => (err ? reject(new Error(`FFmpeg : ${String(e).trim().split('\n').pop()}`)) : resolve())));

console.log('Le moteur repris de huashu-motion');
const DM = path.join(D, 'lib', 'musique');
const lisezMoi = lire(DM, 'LISEZ-MOI.md');
const table = [...lisezMoi.matchAll(/^\| `([\w.-]+\.js)` \| (\d+) \| `([0-9a-f]{64})` \|$/gm)].map((m) => ({nom: m[1], octets: Number(m[2]), sha: m[3]}));
const differents = table.filter((t) => { const b = fs.readFileSync(path.join(DM, t.nom)); return b.length !== t.octets || crypto.createHash('sha256').update(b).digest('hex') !== t.sha; }).map((t) => t.nom);
essai('les 12 fichiers repris sont, à l’octet près, ceux que le LISEZ-MOI décrit (taille et empreinte)', table.length === 12 && differents.length === 0, {lus: table.length, differents});
const presents = fs.readdirSync(DM).sort();
essai('le dossier ne contient que ces 12 fichiers, les deux remplaçants écrits pour Dérush, la licence et le LISEZ-MOI', JSON.stringify(presents) === JSON.stringify([...table.map((t) => t.nom), 'browser.js', 'capture.js', 'LICENSE', 'LISEZ-MOI.md'].sort()), presents);
essai('le LISEZ-MOI dit d’où ils viennent (dépôt, commit, licence MIT) et la licence est là avec son auteur', /github\.com\/alchaincyf\/huashu-motion/.test(lisezMoi) && /`[0-9a-f]{40}`/.test(lisezMoi) && /MIT/.test(lisezMoi) && /^MIT License/.test(lire(DM, 'LICENSE')) && /Copyright \(c\) \d{4}/.test(lire(DM, 'LICENSE')));
const codes = presents.filter((n) => n.endsWith('.js')).map((n) => [n, lire(DM, n)]);
const reseau = codes.filter(([, t]) => /\bfetch\s*\(|node:https?['"]|node:net['"]|node:dgram['"]|XMLHttpRequest|WebSocket\(/.test(t)).map(([n]) => n);
essai('aucun de ces fichiers ne va sur Internet (ni fetch, ni http, ni prise réseau)', reseau.length === 0, reseau);
const lances = codes.flatMap(([n, t]) => [...t.matchAll(/spawn(?:Sync)?\(\s*['"]([^'"]+)['"]/g)].map((m) => `${n}:${m[1]}`));
essai('le seul programme qu’ils peuvent lancer est FFmpeg', lances.length > 0 && lances.every((x) => x.endsWith(':ffmpeg')), lances);
const remplacants = (lire(DM, 'browser.js') + lire(DM, 'capture.js')).replace(/\/\/.*$/gm, '');
const {findChrome} = await import(pathToFileURL(path.join(DM, 'browser.js')).href);
const {openFilm} = await import(pathToFileURL(path.join(DM, 'capture.js')).href);
essai('les deux remplaçants n’importent rien, ne lancent rien : aucun navigateur n’est cherché ni piloté', !/\bimport\b|\brequire\b|spawn|child_process/.test(remplacants) && findChrome() === null && /Dérush/.test(await refus(() => openFilm()) ?? ''), {chrome: findChrome(), film: await refus(() => openFilm())});

console.log('La partition : lue sans rien jouer');
const aideTexte = (await commande(['--help'])).texte;
const exemple = /^Exemple de partition[^\n]*\n([\s\S]*?)\n\nEnsuite/m.exec(aideTexte)?.[1].split('\n').map((l) => l.replace(/^ {2}/, '')).join('\n') ?? '';
fs.writeFileSync(f('exemple.abc'), `${exemple}\n`);
const lu = await M.lirePartition(exemple);
essai('l’exemple de l’aide se lit sans une remarque : 3 voix, 54 notes, 8 mesures en 21 s, deux repères', lu.titre === 'Ouverture' && lu.mesure === '4/4' && lu.tempo === 92 && lu.voix.length === 3 && lu.notes === 54 && Math.abs(lu.fin_musique_s - 20.96) < 0.05 && lu.reperes.map((r) => r.nom).join() === 'debut,sommet' && !lu.attention, lu);
essai('la voix qui chante est reconnue (role=melody), les instruments sont dits', lu.voix[0].melodie === true && lu.voix.map((v) => v.instrument).join() === 'piano,strings,bass', lu.voix);
const fausse = exemple.replace('inst=strings', 'inst=accordeon').replace('d4 c2 B2 |', 'd4 c2 |').replace('!mf! A,,4 A,,4 | F,,4 F,,4 | G,,4 G,,4 | !fermata!A,,8 |', '!mf! A,,4 A,,4 |');
const luFausse = await M.lirePartition(fausse);
essai('un instrument qui n’existe pas, une mesure trop courte et les voix qui s’arrêtent tôt sont signalés, en français', luFausse.attention?.length === 4 && /La voix P s’arrête au temps 31, la partition au temps 32/.test(luFausse.attention.join(' ')) && /« accordeon », qui n’existe pas/.test(luFausse.attention.join(' ')) && /Voix P, mesure 2 : 3 temps écrits, la mesure en veut 4/.test(luFausse.attention.join(' ')) && /La voix B s’arrête au temps/.test(luFausse.attention.join(' ')), luFausse.attention);
const batterie = `${exemple}\nV:DR inst=drums kit=samba\nC,,2 ^F,,2 D,,2 ^F,,2 | C,,2 ^F,,2 D,,2 ^F,,2 | C,,2 ^F,,2 D,,2 ^F,,2 | C,,2 ^F,,2 D,,2 ^F,,2 |\nC,,2 ^F,,2 D,,2 ^F,,2 | C,,2 ^F,,2 D,,2 ^F,,2 | C,,2 ^F,,2 D,,2 ^F,,2 | !fermata!C,,8 |\n`;
const luBatterie = await M.lirePartition(batterie);
essai('une batterie inconnue est signalée, et celle qui jouera à sa place est dite', luBatterie.voix.at(-1).batterie === 'pop' && /batterie « samba », qui n’existe pas/.test(luBatterie.attention?.join(' ') ?? ''), luBatterie);
// une levée (première mesure incomplète) et une dernière mesure à deux temps : le moteur garde la mesure d'une voix à
// l'autre, donc chaque voix la redit ; sinon la voix suivante est comptée à deux temps, et c'est signalé
const levee = 'X:1\nT:Levée\nM:4/4\nL:1/8\nQ:1/4=120\nK:C\nV:A inst=piano role=melody\n[M:4/4] c2 d2 e2 | c8 | [M:2/4] c4 |\nV:B inst=bass\n[M:4/4] z6 | C,8 | [M:2/4] C,4 |\n';
const luLevee = await M.lirePartition(levee);
const luFuite = await M.lirePartition(levee.replace('V:B inst=bass\n[M:4/4] ', 'V:B inst=bass\n'));
essai('une levée et un changement de mesure : rien à redire quand chaque voix redit sa mesure, et la mesure annoncée est celle de l’en-tête', !luLevee.attention && luLevee.mesure === '4/4' && Math.abs(luLevee.fin_musique_s - (0.05 + 9 * 0.5)) < 0.06, luLevee); // 9 temps à 120 : 4,5 s, et la respiration de fin de phrase
essai('une voix qui ne la redit pas hérite de la mesure où la précédente a fini : c’est signalé, mesure par mesure', /Voix B, mesure 1 : 3 temps écrits, la mesure en veut 2/.test(luFuite.attention?.join(' ') ?? '') && /\[M:4\/4\]/.test(aideTexte) && /commence la suivante par \[M:4\/4\]/.test(aideTexte), luFuite.attention);
essai('un texte sans note est refusé avec les en-têtes à écrire', /aucune note/.test(await refus(() => M.lirePartition('X:1\nT:Vide\nK:C\n')) ?? '') && /aucune note/.test(await refus(() => M.lirePartition('')) ?? ''));
essai('lireTemps : « a=1, b=2.5 » → {a: 1, b: 2.5} ; un temps manquant, négatif ou donné deux fois est refusé', JSON.stringify(M.lireTemps('a=1, b=2.5')) === '{"a":1,"b":2.5}' && JSON.stringify(M.lireTemps(null)) === '{}' && /ne se lit pas/.test(await refus(() => M.lireTemps('a')) ?? '') && /ne se lit pas/.test(await refus(() => M.lireTemps('a=-2')) ?? '') && /deux fois/.test(await refus(() => M.lireTemps('a=1,a=2')) ?? ''));

console.log('Les repères : la musique calée sur le film');
const cale = await M.lirePartition(exemple, {reperes: {debut: 0, sommet: 10.8}});
essai('chaque repère tombe au temps demandé, et la réponse dit de combien le tempo a bougé', cale.reperes[0].a_s === 0 && cale.reperes[1].a_s === 10.8 && cale.reperes.every((r) => r.cale) && cale.etirements.length === 1 && Math.abs(cale.etirements[0].ecart_pct + 3.2) < 0.3 && !cale.attention, cale);
const loin = await M.lirePartition(exemple, {reperes: {debut: 0, sommet: 14}});
essai('au-delà de 8 %, il est dit de réécrire le passage', /au-delà de 8 %/.test(loin.attention?.join(' ') ?? '') && Math.abs(loin.etirements[0].ecart_pct) > 8, loin.attention);
const seul = await M.lirePartition(exemple, {reperes: {sommet: 15}});
essai('un seul repère déplace le début sans toucher au tempo', Math.abs(seul.debut_s - (15 - (lu.reperes[1].a_s - lu.debut_s))) < 0.02 && !seul.etirements && Math.abs((seul.fin_musique_s - seul.debut_s) - (lu.fin_musique_s - lu.debut_s)) < 0.02, seul);
const avant = await M.lirePartition(exemple, {reperes: {sommet: 4}});
essai('une musique qui commencerait avant le film est signalée', /avant le début du film/.test(avant.attention?.join(' ') ?? ''), avant);
essai('un repère que la partition n’a pas est refusé, avec ceux qu’elle a', /pas de repère « refrain » \(elle a : debut, sommet\)/.test(await refus(() => M.lirePartition(exemple, {reperes: {refrain: 3}})) ?? ''));
essai('des repères donnés dans le désordre sont refusés en clair', /vient après « debut » dans la partition, mais pas dans les temps donnés/.test(await refus(() => M.lirePartition(exemple, {reperes: {debut: 12, sommet: 3}})) ?? ''));

console.log('La partition jouée');
const j1 = await M.jouerPartition(exemple, {sortie: f('a.wav')});
const wa = wav(f('a.wav'));
essai('un WAV 48 kHz, stéréo, 16 bits, de la durée de la musique plus 2 s', wa.riff && wa.freq === 48000 && wa.canaux === 2 && wa.bits === 16 && j1.duree_s === 23 && Math.abs(wa.n / 48000 - 23) < 0.001, {duree: j1.duree_s, n: wa.n});
essai('au niveau des réseaux : −14 LUFS (à 0,7 près), crête sous −1,4 dB', Math.abs(j1.volume_lufs + 14) <= 0.7 && j1.crete_db <= -1.4 && j1.crete_db > -6, {lufs: j1.volume_lufs, crete: j1.crete_db});
let crete = 0; for (let i = 0; i < wa.n; i++) crete = Math.max(crete, Math.abs(wa.L[i]), Math.abs(wa.R[i]));
essai('la crête lue dans le fichier est celle annoncée', Math.abs(20 * Math.log10(crete) - j1.crete_db) < 0.2, {lue: 20 * Math.log10(crete), dite: j1.crete_db});
const doux = niveau(wa, 1, 9), fort = niveau(wa, lu.reperes[1].a_s + 0.3, lu.reperes[1].a_s + 8.3);
essai('les nuances s’entendent : le passage écrit « f » sonne plus fort que celui écrit « mp »', fort - doux > 3, {doux, fort});
essai('la dernière note s’éteint avant la fin du fichier', niveau(wa, 22.8, 23) < fort - 25, {fin: niveau(wa, 22.8, 23), fort});
essai('la réponse dit franchement ce qui joue : de la synthèse', j1.instruments === M.INSTRUMENTS_CALCULES && /pas enregistrés/.test(j1.instruments) && j1.ok === true && j1.graine === 1);
await M.jouerPartition(exemple, {sortie: f('b.wav')});
const j3 = await M.jouerPartition(exemple, {sortie: f('c.wav'), graine: 7});
essai('même partition, même graine : les mêmes octets ; une autre graine : une autre interprétation, de même durée', empreinte(f('a.wav')) === empreinte(f('b.wav')) && empreinte(f('a.wav')) !== empreinte(f('c.wav')) && j3.duree_s === j1.duree_s && j3.graine === 7);
const j4 = await M.jouerPartition(exemple, {sortie: f('d.wav'), reperes: 'debut=0,sommet=10.8'});
const wd = wav(f('d.wav'));
essai('calée sur le film : l’entrée « f » se fait bien entendre au repère demandé (10,8 s), plus à 10,5 s', j4.reperes[1].a_s === 10.8 && niveau(wd, 10.8, 11.3) - niveau(wd, 10.2, 10.7) > 2, {avant: niveau(wd, 10.2, 10.7), apres: niveau(wd, 10.8, 11.3)});
const j5 = await M.jouerPartition(exemple, {sortie: f('e.wav'), duree: 12});
const we = wav(f('e.wav'));
essai('une durée plus courte que la musique : le fichier a cette durée, la fin est fondue, et c’est dit', j5.duree_s === 12 && Math.abs(we.n / 48000 - 12) < 0.001 && /la fin est fondue/.test(j5.attention?.join(' ') ?? '') && niveau(we, 11.95, 12) < niveau(we, 10, 11) - 15, {att: j5.attention, fin: niveau(we, 11.95, 12), corps: niveau(we, 10, 11)});
essai('refus : plus de 180 s, une durée qui n’est pas un nombre, une graine qui n’est pas entière', /180 s au plus/.test(await refus(() => M.jouerPartition(exemple, {sortie: f('x.wav'), duree: 200})) ?? '') && /n’est pas un nombre/.test(await refus(() => M.jouerPartition(exemple, {sortie: f('x.wav'), duree: 'long'})) ?? '') && /nombre entier/.test(await refus(() => M.jouerPartition(exemple, {sortie: f('x.wav'), graine: 1.5})) ?? ''));
essai('refus : pas de fichier de sortie, ou un nom qui n’est pas en .wav ; rien n’est écrit', /Il manque le fichier de sortie/.test(await refus(() => M.jouerPartition(exemple, {})) ?? '') && /donne un nom en \.wav/.test(await refus(() => M.jouerPartition(exemple, {sortie: f('x.mp3')})) ?? '') && !fs.existsSync(f('x.wav')) && !fs.existsSync(f('x.mp3')) && !fs.readdirSync(tmp).some((n) => n.endsWith('.tmp')));

console.log('Les styles');
const cat = await M.catalogue();
const {STYLES} = await import(pathToFileURL(path.join(DM, 'sound.js')).href);
const {INSTRUMENTS} = await import(pathToFileURL(path.join(DM, 'score.js')).href);
const {DRUM_KITS} = await import(pathToFileURL(path.join(DM, 'composer.js')).href);
essai('les 13 styles du moteur, chacun décrit en français (pas la phrase anglaise du moteur), avec son tempo', cat.styles.length === 13 && cat.styles.length === Object.keys(STYLES).length && cat.styles.every((s) => s.pour.length > 30 && s.pour !== STYLES[s.nom].about && s.tempo.length === 2 && s.tempo[0] < s.tempo[1]), cat.styles.filter((s) => s.pour === STYLES[s.nom].about).map((s) => s.nom));
const ranges = cat.instruments.flatMap((x) => x.noms);
essai('chaque instrument du moteur est rangé dans une famille, une seule fois ; les batteries sont celles du moteur', ranges.length === new Set(ranges).size && Object.keys(INSTRUMENTS).every((n) => ranges.includes(n)) && ranges.every((n) => INSTRUMENTS[n]) && JSON.stringify(cat.batteries) === JSON.stringify(Object.keys(DRUM_KITS)), Object.keys(INSTRUMENTS).filter((n) => !ranges.includes(n)));
const scenes = 'intro=0,essor=4,sommet=8,fin=12';
const s1 = await M.jouerStyle({style: 'pulse', sortie: f('s1.wav'), duree: 16, scenes, sommet: 'sommet'});
const ws1 = wav(f('s1.wav'));
essai('un style : un WAV de la durée demandée, à −14 LUFS, au tempo du style', Math.abs(ws1.n / 48000 - 16) < 0.001 && Math.abs(s1.volume_lufs + 14) <= 0.7 && s1.crete_db <= -1.4 && s1.tempo >= 116 && s1.tempo <= 124 && s1.style === 'pulse' && /^(do|ré|mi|fa|sol|la|si)[♯♭]? (majeur|mineur|dorien)$/.test(s1.tonalite), s1);
essai('la musique suit les scènes : l’énergie monte jusqu’au sommet, qui est marqué ; les coupes tombent sur le tempo', s1.scenes.map((x) => x.nom).join() === 'intro,essor,sommet,fin' && s1.scenes[0].energie < s1.scenes[1].energie && s1.scenes[2].energie === 1 && s1.scenes[2].sommet === true && s1.sommet_s === 8 && s1.ecart_coupes_ms <= 5, s1.scenes);
essai('et ça s’entend : après le sommet, la musique est plus forte qu’au début', niveau(ws1, 8.2, 11.8) - niveau(ws1, 0.5, 3.8) > 1.5, {debut: niveau(ws1, 0.5, 3.8), sommet: niveau(ws1, 8.2, 11.8)});
await M.jouerStyle({style: 'pulse', sortie: f('s2.wav'), duree: 16, scenes, sommet: 'sommet'});
const s3 = await M.jouerStyle({style: 'pulse', sortie: f('s3.wav'), duree: 16, scenes, sommet: 'sommet', graine: 2});
essai('même demande, même graine : les mêmes octets ; une autre graine : un autre tirage', empreinte(f('s1.wav')) === empreinte(f('s2.wav')) && empreinte(f('s1.wav')) !== empreinte(f('s3.wav')) && s3.graine === 2);
const s4 = await M.jouerStyle({style: 'pulse', sortie: f('s4.wav'), duree: 16, scenes, sommet: 'sommet', sousVoix: true});
essai('sous une voix : l’arrangement reste léger (énergie plafonnée à 0,7), au même niveau de sortie', s4.sous_voix === true && Math.max(...s4.scenes.map((x) => x.energie)) === 0.7 && Math.abs(s4.volume_lufs + 14) <= 0.7 && s4.crete_db <= -1.4 && empreinte(f('s4.wav')) !== empreinte(f('s1.wav')), s4);
const s5 = await M.jouerStyle({style: 'pulse', sortie: f('s5.wav'), duree: 16, scenes, fin: 'coupee', finA: 14});
const ws5 = wav(f('s5.wav'));
essai('fin « coupee » : la musique s’arrête net au moment dit, puis c’est le silence', s5.fin === 'coupee' && s5.fin_a_s === 14 && niveau(ws5, 14.3, 16) < -70 && niveau(ws5, 12, 13.9) > -30, {apres: niveau(ws5, 14.3, 16), avant: niveau(ws5, 12, 13.9)});
const s6 = await M.jouerStyle({style: 'pulse', sortie: f('s6.wav'), duree: 16, scenes, fin: 'nette'});
essai('fin « nette » : l’accent final tombe sur la dernière scène ; fin « resonne » : pas de moment d’arrêt', s6.fin === 'nette' && s6.fin_a_s === 12 && s1.fin === 'resonne' && !('fin_a_s' in s1), s6);
const s7 = await M.jouerStyle({style: 'pulse:dark', sortie: f('s7.wav'), duree: 8, bpm: 118});
essai('une variante (pulse:dark) et un tempo imposé', s7.style === 'pulse:dark' && s7.tempo === 118 && /mineur/.test(s7.tonalite), s7);
const R = {
  style: await refus(() => M.jouerStyle({style: 'bossa', sortie: f('x.wav'), duree: 8})),
  variante: await refus(() => M.jouerStyle({style: 'lofi:jazz', sortie: f('x.wav'), duree: 8})),
  duree: await refus(() => M.jouerStyle({style: 'lofi', sortie: f('x.wav')})),
  fin: await refus(() => M.jouerStyle({style: 'lofi', sortie: f('x.wav'), duree: 8, fin: 'douce'})),
  sommet: await refus(() => M.jouerStyle({style: 'lofi', sortie: f('x.wav'), duree: 8, scenes: 'a=0,b=4', sommet: 'c'})),
  scene: await refus(() => M.jouerStyle({style: 'lofi', sortie: f('x.wav'), duree: 8, scenes: 'a=0,b=9'})),
  bpm: await refus(() => M.jouerStyle({style: 'lofi', sortie: f('x.wav'), duree: 8, bpm: 900})),
  finA: await refus(() => M.jouerStyle({style: 'lofi', sortie: f('x.wav'), duree: 8, finA: 6})),
};
essai('refus en clair : style, variante, durée, fin, sommet, scène après la fin, tempo, --fin-a sans fin nette ni coupée', /« bossa » n’existe pas\. Les styles : mallet, pulse/.test(R.style ?? '') && /pas de variante « jazz »/.test(R.variante ?? '') && /Il manque la durée/.test(R.duree ?? '') && /La fin « douce » n’existe pas/.test(R.fin ?? '') && /« c » n’est pas une scène \(a, b\)/.test(R.sommet ?? '') && /« b » commence à 9 s, après la fin/.test(R.scene ?? '') && /entre 40 et 220/.test(R.bpm ?? '') && /--fin-a ne sert qu’avec/.test(R.finA ?? '') && !fs.existsSync(f('x.wav')), R);

console.log('Les temps d’un morceau');
const clic = (nom, pas, duree) => ffmpeg(['-f', 'lavfi', '-i', `aevalsrc='0.5*exp(-30*mod(t,${pas}))*sin(2*PI*880*t)*(1+0.8*lt(mod(t,4*${pas}),${pas}))+0.6*sin(2*PI*60*t)*exp(-12*mod(t,4*${pas}))':s=48000:d=${duree}`, '-ac', '2', f(nom)]);
await clic('c120.wav', 0.5, 20);
await clic('c97.wav', 60 / 97, 24);
const t120 = await M.tempsMusique(f('c120.wav'), {caler: '3.2,8.05'});
const ecarts = t120.temps.map((t) => Math.abs(t - Math.round(t / 0.5) * 0.5));
essai('un métronome à 120 : tempo 120 au centième, pulsation nette, tempo régulier', Math.abs(t120.tempo - 120) < 0.02 && t120.confiance > 0.9 && t120.pulsation === 'nette' && t120.tempo_regulier === true && !t120.attention, {tempo: t120.tempo, confiance: t120.confiance, attention: t120.attention});
essai('chaque temps trouvé tombe sur un clic (à moins de 15 ms), aucun ne manque au milieu', t120.temps.length >= 38 && Math.max(...ecarts) < 0.015 && t120.temps.every((t, i) => i === 0 || Math.abs(t - t120.temps[i - 1] - 0.5) < 0.01), {n: t120.temps.length, pire: Math.max(...ecarts)});
essai('les mesures reviennent tous les 4 temps, sur le clic accentué', t120.mesures.length >= 9 && t120.mesures.every((t, i) => i === 0 || Math.abs(t - t120.mesures[i - 1] - 2) < 0.01) && t120.mesures.every((t) => Math.abs(t - Math.round(t / 2) * 2) < 0.015), t120.mesures);
essai('--caler : pour chaque coupe, le temps et la mesure les plus proches, avec l’écart signé en millisecondes', t120.cales.length === 2 && Math.abs(t120.cales[0].temps.a_s - 3) < 0.015 && Math.abs(t120.cales[0].temps.ecart_ms + 200) < 15 && Math.abs(t120.cales[0].mesure.a_s - 4) < 0.015 && t120.cales[0].mesure.ecart_ms > 780 && Math.abs(t120.cales[1].temps.ecart_ms + 50) < 15, t120.cales);
const t97 = await M.tempsMusique(f('c97.wav'));
essai('un métronome à 97 : tempo 97 au centième près', Math.abs(t97.tempo - 97) < 0.03 && t97.pulsation === 'nette', {tempo: t97.tempo});
const tp = await M.tempsMusique(f('c120.wav'), {debut: 4, duree: 10});
essai('un passage seulement : les temps restent ceux du fichier entier', tp.debut_s === 4 && tp.duree_s === 10 && Math.abs(tp.tempo - 120) < 0.05 && tp.temps[0] >= 4 && tp.temps.at(-1) < 14.05 && tp.temps.every((t) => Math.abs(t - Math.round(t / 0.5) * 0.5) < 0.015), {premier: tp.temps[0], dernier: tp.temps.at(-1)});
const tb = await M.tempsMusique(f('c120.wav'), {bpm: 60});
essai('--bpm : le tempo donné est tenu (60 : un temps sur deux)', Math.abs(tb.tempo - 60) < 0.7 && tb.temps.every((t, i) => i === 0 || Math.abs(t - tb.temps[i - 1] - 1) < 0.03), {tempo: tb.tempo});
const ts = await M.tempsMusique(f('s1.wav'));
essai('la musique d’un style : on retrouve son tempo, et son sommet parmi les sommets', Math.abs(ts.tempo - s1.tempo) < 0.5 && ts.sommets.some((x) => Math.abs(x.a_s - 8) < 0.3) && ts.sections.length >= 1 && ts.sections.every((x) => x.energie >= 0 && x.energie <= 1), {tempo: ts.tempo, sommets: ts.sommets});
const tc = await M.tempsMusique(f('s5.wav'));
essai('la fin de la musique est trouvée (un style coupé à 14 s dans un fichier de 16 s)', Math.abs(tc.fin_musique_s - 14) < 0.2 && tc.duree_s === 16, {fin: tc.fin_musique_s});
await ffmpeg(['-f', 'lavfi', '-i', 'anoisesrc=d=12:c=pink:a=0.2:seed=3', f('bruit.wav')]);
const tbr = await M.tempsMusique(f('bruit.wav'));
essai('du bruit sans rythme : « pulsation incertaine », et il est dit de ne pas se fier aux temps', tbr.pulsation === 'incertaine' && tbr.confiance < M.CONFIANCE_MIN && /Pas de pulsation nette/.test(tbr.attention?.join(' ') ?? ''), tbr.attention);
await ffmpeg(['-f', 'lavfi', '-i', 'color=c=black:s=160x90:d=3', '-an', f('muet.mp4')]);
await ffmpeg(['-f', 'lavfi', '-i', 'sine=f=440:d=1', f('court.wav')]);
await ffmpeg(['-f', 'lavfi', '-i', 'color=c=black:s=160x90:d=20', '-i', f('c120.wav'), '-shortest', '-c:a', 'aac', f('film.mp4')]);
const tv = await M.tempsMusique(f('film.mp4'));
essai('la musique d’une vidéo se lit aussi', Math.abs(tv.tempo - 120) < 0.1 && tv.pulsation === 'nette', {tempo: tv.tempo});
const RT = {
  absent: await refus(() => M.tempsMusique(f('rien.wav'))),
  rien: await refus(() => M.tempsMusique()),
  muet: await refus(() => M.tempsMusique(f('muet.mp4'))),
  court: await refus(() => M.tempsMusique(f('court.wav'))),
  bpm: await refus(() => M.tempsMusique(f('c120.wav'), {bpm: 'vite'})),
  caler: await refus(() => M.tempsMusique(f('c120.wav'), {caler: '3,x'})),
  texte: await refus(() => M.tempsMusique(f('exemple.abc'))),
};
essai('refus en clair : fichier absent, vidéo sans son, son de moins de 2 s, tempo ou coupe qui n’est pas un nombre, fichier qui n’est pas du son', /Fichier introuvable/.test(RT.absent ?? '') && /Il manque le fichier/.test(RT.rien ?? '') && /n’a pas de piste de son/.test(RT.muet ?? '') && /moins de 2 secondes/.test(RT.court ?? '') && /Le tempo : « vite »/.test(RT.bpm ?? '') && /Un temps à caler : « x »/.test(RT.caler ?? '') && /FFmpeg n’a pas pu lire exemple\.abc/.test(RT.texte ?? ''), RT);

console.log('Un morceau ajusté à la durée du film');
// le « morceau » : 100 s d'un style, avec une intro, des couplets, un sommet et une fin (aucune musique n'est livrée avec Dérush)
await M.jouerStyle({style: 'acoustic', sortie: f('morceau.wav'), duree: 100, scenes: 'intro=0,couplet=14,pont=36,refrain=50,final=72,sortie=90', sommet: 'refrain'});
const aj = await M.ajusterMorceau(f('morceau.wav'), {sortie: f('ajuste.wav'), duree: 40, sommet: 24, arrivee: 37});
const waj = wav(f('ajuste.wav'));
essai('recoupé : un WAV de la durée du film, sans écrêter, avec le rapport du moteur', aj.facon === 'recoupé' && aj.duree_s === 40 && Math.abs(waj.n / 48000 - 40) < 0.001 && aj.crete_db <= -1 && aj.rapport_du_moteur?.length > 3 && aj.morceau.duree_s === 100 && Math.abs(aj.morceau.tempo - 105) < 0.5, {facon: aj.facon, attention: aj.attention});
const pas = aj.passages;
essai('les passages gardés se suivent sans trou du début à la fin du film : l’ouverture du morceau d’abord, sa fin en dernier', pas.length >= 2 && pas[0].film_de_s === 0 && pas.at(-1).film_a_s === 40 && pas.every((x, i) => i === 0 || Math.abs(x.film_de_s - pas[i - 1].film_a_s) < 0.011) && pas[0].role === 'ouverture' && pas[0].morceau_de_s < 60 / 105 * 4 && ['fin', 'accent final'].includes(pas.at(-1).role), pas);
// un accent final est un coup fort, voulu : le volume y monte d'un cran ; ailleurs, un raccord ne doit pas s'entendre
essai('chaque raccord est mesuré : sa douceur, son jugement, le volume avant et après (moins de 6 dB d’écart, sauf sur l’accent final)', aj.raccords.length === pas.length - 1 && aj.raccords.every((x, i) => x.douceur >= 0 && x.douceur <= 1 && ['bon', 'correct', 'rude'].includes(x.jugement) && Number.isFinite(x.volume_avant_db) && (Math.abs(x.volume_apres_db - x.volume_avant_db) < 6 || pas[i + 1].role === 'accent final') && /^\d+→\d+$/.test(x.mesures)) && !/Le volume saute/.test(aj.attention?.join(' ') ?? ''), aj.raccords);
const pasT = 60 / aj.morceau.tempo;
const inter = aj.temps.slice(1).map((t, i) => t - aj.temps[i]);
essai('les temps annoncés restent réguliers à travers les raccords, sans battement en double', aj.temps.length > 60 && inter.every((x) => Math.abs(x - pasT) < 0.03), {pire: Math.max(...inter.map((x) => Math.abs(x - pasT)))});
const relu = await M.tempsMusique(f('ajuste.wav'));
// après un accent final, plus rien du morceau ne joue (une résonance) : on compare jusqu'au dernier temps annoncé
const horsGrille = relu.temps.filter((x) => x <= aj.temps.at(-1) + 0.1).map((x) => Math.min(...aj.temps.map((y) => Math.abs(x - y))));
essai('relu de zéro, le fichier ajusté a bien ce rythme : même tempo, chaque temps retrouvé à moins de 30 ms d’un temps annoncé', Math.abs(relu.tempo - aj.morceau.tempo) < 0.3 && relu.pulsation === 'nette' && horsGrille.length > 55 && Math.max(...horsGrille) < 0.03, {tempo: relu.tempo, compares: horsGrille.length, pire: Math.max(...horsGrille)});
essai('la fin est décrite (la vraie fin du morceau, un accent final fabriqué ou un fondu), et la musique finit avant la dernière image', ['la vraie fin du morceau', 'un accent final qui résonne', 'un fondu'].includes(aj.fin.sorte) && (aj.fin.sorte !== 'un accent final qui résonne' || (aj.fin.fabrique === true && /fabriquée/.test(aj.attention?.join(' ') ?? ''))) && niveau(waj, 39.95, 40) < niveau(waj, 20, 30) - 12, aj.fin);
essai('le niveau du morceau n’est pas refait : pas de mise à −14 LUFS, seulement un gain d’un bloc s’il écrêtait', Math.abs(aj.volume_lufs + 14) > 0.5 || !/baissé/.test(aj.attention?.join(' ') ?? ''), {lufs: aj.volume_lufs});
const dr = await M.ajusterMorceau(f('morceau.wav'), {sortie: f('droit.wav'), duree: 40, droit: true});
const dd = await M.ajusterMorceau(f('morceau.wav'), {sortie: f('depuis.wav'), duree: 20, debut: 30});
essai('--droit : le morceau depuis son début, un fondu à la fin, aucun raccord ; --debut : depuis ce point', dr.facon === 'coupe droite' && dr.passages.length === 1 && dr.passages[0].morceau_de_s === 0 && dr.passages[0].film_a_s === 40 && dr.raccords.length === 0 && dr.fin.sorte === 'un fondu' && !dr.rapport_du_moteur && dd.passages[0].morceau_de_s === 30 && dd.passages[0].morceau_a_s === 50 && dd.duree_s === 20, {dr: dr.passages, dd: dd.passages});
const wdr = wav(f('droit.wav'));
const wmo = wav(f('morceau.wav'));
let ecartMax = 0; for (let i = 48000; i < 48000 * 30; i += 97) ecartMax = Math.max(ecartMax, Math.abs(wdr.L[i] - wmo.L[i]));
essai('en coupe droite, le son est celui du morceau, à l’échantillon près (hors fondu)', ecartMax < 0.001, {ecartMax});
const bo = await M.ajusterMorceau(f('s7.wav'), {sortie: f('boucle.wav'), duree: 30, droit: true});
essai('un morceau plus court que le film est rejoué en boucle, et c’est dit', bo.facon === 'bouclé' && bo.passages.length >= 3 && /plus court que le film/.test(bo.attention?.join(' ') ?? '') && Math.abs(wav(f('boucle.wav')).n / 48000 - 30) < 0.001, bo);
const br = await M.ajusterMorceau(f('bruit.wav'), {sortie: f('bruit-ajuste.wav'), duree: 8});
essai('sans rythme net, pas de recoupe : coupe droite, et la raison est dite', br.facon === 'coupe droite' && /n’a pas été recoupé/.test(br.attention?.join(' ') ?? '') && /Pas de pulsation nette/.test(br.attention.join(' ')), br.attention);
const RA = {
  absent: await refus(() => M.ajusterMorceau(f('rien.mp3'), {sortie: f('x.wav'), duree: 10})),
  duree: await refus(() => M.ajusterMorceau(f('morceau.wav'), {sortie: f('x.wav')})),
  long: await refus(() => M.ajusterMorceau(f('morceau.wav'), {sortie: f('x.wav'), duree: 700})),
  scene: await refus(() => M.ajusterMorceau(f('morceau.wav'), {sortie: f('x.wav'), duree: 30, scenes: 'a=0,b=31'})),
  moment: await refus(() => M.ajusterMorceau(f('morceau.wav'), {sortie: f('x.wav'), duree: 30, scenes: 'a=0,b=12', sommet: 'c'})),
  hors: await refus(() => M.ajusterMorceau(f('morceau.wav'), {sortie: f('x.wav'), duree: 30, arrivee: 45})),
  sortie: await refus(() => M.ajusterMorceau(f('morceau.wav'), {sortie: f('x.mp3'), duree: 30})),
};
essai('refus en clair : morceau absent, durée manquante ou de plus de 10 minutes, scène après la fin, moment inconnu ou hors du film, sortie qui n’est pas en .wav', /Fichier introuvable/.test(RA.absent ?? '') && /Il manque la durée du film/.test(RA.duree ?? '') && /10 minutes au plus/.test(RA.long ?? '') && /« b » commence à 31 s, après la fin du film/.test(RA.scene ?? '') && /Le sommet : « c » n’est ni un temps en secondes ni une scène \(a, b\)/.test(RA.moment ?? '') && /L’arrivée : 45 s tombe hors du film/.test(RA.hors ?? '') && /donne un nom en \.wav/.test(RA.sortie ?? '') && !fs.existsSync(f('x.wav')), RA);

console.log('La commande derush-musique');
essai('l’aide dit tout : les six commandes, la notation, un exemple, et que les instruments sont calculés', ['derush-musique jouer', 'derush-musique lire', 'derush-musique style ', 'derush-musique styles', 'derush-musique temps', 'derush-musique ajuster', '--arrivee', '!mark:nom!', 'inst=drums', 'Exemple de partition', '--reperes', '--sous-voix', '--caler'].every((x) => aideTexte.includes(x)) && /calculés \(de la synthèse\), pas enregistrés/.test(aideTexte) && (await commande([])).texte === aideTexte);
const c1 = await commande(['jouer', 'exemple.abc', '-o', 'son/cmd.wav', '--reperes', 'debut=0,sommet=10.8']);
essai('jouer : la réponse en JSON, le fichier écrit (son dossier créé), les mêmes octets que par le pilote', c1.code === 0 && c1.json?.ok === true && c1.json.fichier === 'son/cmd.wav' && c1.json.reperes[1].a_s === 10.8 && empreinte(f('son/cmd.wav')) === empreinte(f('d.wav')), c1.json ?? c1.texte);
const c2 = await commande(['lire', 'exemple.abc']);
essai('lire : la partition décrite, rien d’écrit', c2.code === 0 && c2.json?.ok === true && c2.json.notes === 54 && !('fichier' in c2.json));
const c3 = await commande(['style', 'lofi', '-o', 'son/fond.wav', '--duree', '8', '--scenes', 'a=0,b=4', '--sous-voix']);
essai('style : la réponse en JSON et le fichier', c3.code === 0 && c3.json?.style === 'lofi' && c3.json.sous_voix === true && fs.existsSync(f('son/fond.wav')), c3.json ?? c3.texte);
const c4 = await commande(['styles']);
const c4j = await commande(['styles', '--json']);
essai('styles : un tableau lisible avec les 13 styles, les instruments, les batteries ; --json pour un programme', c4.code === 0 && cat.styles.every((s) => c4.texte.includes(`  ${s.nom.padEnd(10)} `)) && /inst=drums kit=…/.test(c4.texte) && /pas enregistrés/.test(c4.texte) && c4j.json?.styles?.length === 13);
const c5 = await commande(['temps', 'c120.wav', '--caler', '3.2', '-o', 'son/temps.json']);
const ecrit = JSON.parse(lire(tmp, 'son', 'temps.json'));
essai('temps -o : tout est écrit dans le fichier, et l’écran ne garde que le résumé', c5.code === 0 && Math.abs(c5.json.tempo - 120) < 0.02 && !('temps' in c5.json) && /temps et \d+ mesures dans son\/temps\.json/.test(c5.json.listes) && ecrit.temps.length >= 38 && ecrit.mesures.length >= 9 && ecrit.cales.length === 1, c5.json);
const c6 = await commande(['temps', 'c120.wav']);
essai('temps sans -o : les listes de temps et de mesures sont dans la réponse', c6.code === 0 && c6.json.temps.length >= 38 && c6.json.mesures.length >= 9);
const c7 = await commande(['ajuster', 'morceau.wav', '-o', 'son/ajuste.wav', '--duree', '40', '--sommet', '24', '--arrivee', '37']);
essai('ajuster : la réponse en JSON, le fichier écrit, les mêmes octets que par le pilote', c7.code === 0 && c7.json?.facon === 'recoupé' && c7.json.fichier === 'son/ajuste.wav' && empreinte(f('son/ajuste.wav')) === empreinte(f('ajuste.wav')), c7.json ?? c7.texte);
const e1 = await commande(['chanter']);
const e2 = await commande(['jouer', 'absente.abc', '-o', 'x.wav']);
const e3 = await commande(['jouer']);
const e4 = await commande(['style', 'bossa', '-o', 'x.wav', '--duree', '8']);
essai('une erreur : {"erreur": …} en français et le code 1 (commande inconnue, fichier absent, usage, style inconnu)', [e1, e2, e3, e4].every((r) => r.code === 1 && typeof r.json?.erreur === 'string') && /Commande inconnue : chanter/.test(e1.json.erreur) && /Fichier introuvable : absente\.abc/.test(e2.json.erreur) && /^Usage : derush-musique jouer/.test(e3.json.erreur) && /« bossa » n’existe pas/.test(e4.json.erreur), [e1.json, e2.json, e3.json, e4.json]);

console.log('Ce que Dérush branche autour');
const K = await imp('competences.mjs');
K.preparerCommandes();
const bin = fs.readdirSync(K.DOSSIER_COMMANDES);
essai('la commande derush-musique est donnée à l’IA', bin.includes(process.platform === 'win32' ? 'derush-musique.cmd' : 'derush-musique'), bin);
const {boiteAOutils} = await imp('recettes.mjs');
const outils = boiteAOutils({});
essai('la boîte à outils de l’IA la présente : un vrai morceau d’abord (ses temps, sa durée ajustée), une musique écrite pour le film sinon, et l’aveu sur les instruments', /`derush-musique`/.test(outils) && /`derush-musique temps`/.test(outils) && /`derush-musique ajuster`/.test(outils) && /Un vrai morceau sonne toujours mieux/.test(outils) && /## La musique faite sur l'ordinateur/.test(outils) && /calculés, pas enregistrés/.test(outils) && /derush-musique lire/.test(outils));
const sansEL = M.consigneMusique(false), avecEL = M.consigneMusique(true);
essai('les consignes de l’IA nomment la commande, ses quatre usages et l’aveu sur les instruments ; avec ElevenLabs, il reste le studio', [sansEL, avecEL].every((c) => c.startsWith('- ') && !c.includes('\n') && ['derush-musique', '« temps »', '« ajuster »', '« jouer »', '« style »', 'calculés, pas enregistrés', 'huashu-motion'].every((x) => c.includes(x))) && /sans ElevenLabs/.test(sansEL) && /garde ElevenLabs/.test(avecEL) && /Sans dépenser de crédit/.test(avecEL));
essai('et elles sont bien branchées dans ce que Dérush dit à l’IA', /consigneMusique\(!!chargerCle\(\)\)/.test(lire(D, 'lib', 'claude.mjs')));
essai('rien n’a été écrit hors du dossier d’essai : ni carnet du moteur, ni instruments', process.env.OM_SAMPLES === 'off' && process.env.OM_HOME === path.join(process.env.DERUSH_SUPPORT, 'musique') && !fs.existsSync(process.env.OM_HOME));

console.log('La direction de huashu-motion');
const HM = path.join(D, 'competences', 'huashu-motion');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const arbre = (d) => fs.readdirSync(d, {recursive: true, withFileTypes: true}).filter((e) => e.isFile()).map((e) => path.relative(d, path.join(e.parentPath ?? e.path, e.name)).split(path.sep).join('/')).sort();
const sk = lire(HM, 'SKILL.md');
essai('SKILL.md : le nom, une description en français, le paragraphe « Dans Dérush » et les commandes de Dérush', /^---\nname: huashu-motion\ndescription: >-\n/.test(sk) && sk.includes('**Dans Dérush.**') && ['derush-toile verifier', 'derush-toile mouvement', 'derush-controle', 'derush-musique temps', 'derush-musique ajuster', 'derush-musique jouer', 'derush-musique lire', 'derush-son mixer', 'sons-openverse'].every((x) => sk.includes(x)));
const restes = sk.split('\n').filter((l) => /(^|[^a-zA-Z`-])om (grab|new|studio|inbox|look|done|set|sound|music|beats|samples|voice|render|share|fonts|check|qa|still|swatch|learn|undo|scan|doctor)\b|\$OM\b|\bOM\.(sfx|music|beat|downbeat|drop|cue|spring|camera|space|vars)\b/.test(l));
essai('aucune commande de leur outil ne reste dans ses étapes', restes.length === 0, restes.map((l) => l.slice(0, 120)));
essai('il ne fait rien prendre sur Internet, rien publier, et dit que la musique écrite ici est de la synthèse', /Jamais un site aspiré/.test(sk) && /asked for, not fetched/.test(sk) && /Never post anything yourself/.test(sk) && /its instruments are synthesized/.test(sk) && /ni signature/.test(sk) && /_Adapté pour Dérush le 24 novembre 2026 depuis huashu-motion/.test(sk));
const src = lire(HM, 'SOURCE.md');
const originaux = [...src.matchAll(/^\| `([\w./-]+)` \| (\d+) \| `([0-9a-f]{64})` \|$/gm)].map((m) => ({nom: m[1], octets: Number(m[2]), sha: m[3]}));
const PIED = /\n_Repris pour Dérush le 24 novembre 2026 depuis huashu-motion \(https:\/\/github\.com\/alchaincyf\/huashu-motion, commit f4f38bf, `skills\/huashu-motion\/references\/([\w./-]+)`\), licence MIT, sans autre changement que cette ligne\. [^\n]*_\n$/;
const changes = originaux.filter((o) => {
  let b = fs.readFileSync(path.join(HM, 'references', o.nom));
  if (o.nom.endsWith('.md')) { const t = b.toString('utf8'), m = PIED.exec(t); if (!m || m[1] !== o.nom) return true; b = Buffer.from(t.slice(0, m.index), 'utf8'); }
  return b.length !== o.octets || sha(b) !== o.sha;
}).map((o) => o.nom);
essai('les 41 documents repris sont ceux du dépôt à l’octet près, à leur ligne de provenance près (les partitions : sans rien de plus)', originaux.length === 41 && changes.length === 0, {lus: originaux.length, changes});
essai('le dossier ne contient que ces documents, leur mode d’emploi, la licence et la provenance', JSON.stringify(arbre(HM)) === JSON.stringify(['LICENSE', 'SKILL.md', 'SOURCE.md', 'references/LISEZ-MOI.md', ...originaux.map((o) => `references/${o.nom}`)].sort()), arbre(HM).filter((n) => !originaux.some((o) => `references/${o.nom}` === n)));
const toutHM = arbre(HM).map((n) => lire(HM, n)).join('\n');
essai('les documents écartés ne sont pas là, SOURCE.md dit pourquoi, et rien ici n’apprend à passer outre la protection d’un site', ['about-author.md', 'contract.md', 'experience.md', 'grammars.md'].every((n) => !fs.existsSync(path.join(HM, 'references', n)) && src.includes(`\`references/${n}\``)) && /passer outre les protections/.test(src) && !/yt-dlp|cookies-from-browser|syndication\.twimg/.test(toutHM));
const lm = lire(HM, 'references', 'LISEZ-MOI.md');
essai('le mode d’emploi dit ce que devient chaque commande de leur outil', ['om new', 'om grab', 'om still', 'om check', 'om qa', 'om render', 'om sound', 'om beats', 'om music', 'om voice', 'om studio', 'om learn'].every((x) => lm.includes(`\`${x}`)) && ['derush-toile gabarit', 'derush-toile images', 'derush-toile verifier', 'derush-toile mouvement', 'derush-toile rendre', 'derush-musique jouer', 'derush-musique lire', 'derush-musique style', 'derush-musique temps', 'derush-musique ajuster', 'real-sfx', 'sons-openverse'].every((x) => lm.includes(x)) && /Rien n'est pris sur Internet/.test(lm));
const pasNommes = originaux.filter((o) => !lm.includes(`\`${o.nom.startsWith('library/languages/') ? path.basename(o.nom, '.md') : o.nom}\``)).map((o) => o.nom);
essai('et il nomme chacun des 41 documents (les 20 langages par leur nom)', pasNommes.length === 0, pasNommes);
const ECARTES = ['contract.md', 'LICENSE.md'];
const morts = [];
for (const n of arbre(HM).filter((x) => x.endsWith('.md'))) {
  for (const m of lire(HM, n).matchAll(/\]\(([^)#\s]+\.(?:md|abc))(?:#[^)]*)?\)/g)) {
    if (/^https?:/.test(m[1])) continue;
    const cible = path.resolve(path.dirname(path.join(HM, n)), m[1]);
    if (!fs.existsSync(cible) && !ECARTES.includes(path.basename(m[1]))) morts.push(`${n} → ${m[1]}`);
  }
}
essai('chaque lien d’un document mène à un fichier présent (deux mènent à des documents écartés, que le mode d’emploi nomme)', morts.length === 0 && /`contract\.md`/.test(lm) && /`music\/LICENSE\.md`/.test(lm), morts);
const mondes = [...lire(HM, 'references', 'music.md').matchAll(/```abc\n([\s\S]*?)```/g)].map((m) => m[1]);
const lusMondes = [];
for (const b of mondes) lusMondes.push(await M.lirePartition(b));
essai('les 16 mondes musicaux de music.md se lisent tels quels avec le compositeur de Dérush, sans une remarque', mondes.length === 16 && lusMondes.every((r) => r.notes >= 20 && !r.attention), lusMondes.filter((r) => r.attention).map((r) => [r.titre, r.attention]));
const exemples = [];
for (const n of ['first-light', 'four-rooms', 'signal']) exemples.push(await M.lirePartition(lire(HM, 'references', 'scores', `${n}.abc`)));
essai('les trois partitions d’exemple aussi, avec leurs repères et leurs effets', exemples.every((r) => !r.attention && r.reperes.length >= 4 && r.notes > 300 && r.effets.montees >= 1), exemples.map((r) => [r.titre, r.attention]));
const valse = await M.jouerPartition(mondes[9], {sortie: f('valse.wav')});
essai('et l’un de ces mondes se joue : une valse à trois temps, au bon niveau', valse.ok === true && valse.mesure === '3/4' && valse.titre === 'Lyrical waltz' && Math.abs(valse.volume_lufs + 14) <= 1 && valse.crete_db <= -1.4, valse);
const pagesLicences = lire(D, 'competences', 'LICENCES.md');
essai('la licence MIT de huashu-motion est dans la compétence, à côté du moteur et dans licences/ ; la page des licences cite les deux', lire(HM, 'LICENSE') === lire(DM, 'LICENSE') && lire(D, 'competences', 'licences', 'alchaincyf-huashu-motion.txt') === lire(HM, 'LICENSE') && /\| `huashu-motion` \| Montage \| https:\/\/github\.com\/alchaincyf\/huashu-motion \(commit f4f38bf/.test(pagesLicences) && /`lib\/musique\/`/.test(pagesLicences) && /Aucune musique et aucun instrument enregistré/.test(pagesLicences));
const bibliotheque = K.listerCompetences();
essai('la compétence est dans la bibliothèque de l’IA, avec sa description', bibliotheque.some((x) => x.nom === 'huashu-motion' && x.description?.length > 80 && /derush-musique/.test(x.description)), bibliotheque.filter((x) => /huashu/.test(x.nom)));

console.log(`\n${ok} essais réussis sur ${ok + ko}`);
if (!ko) fs.rmSync(tmp, {recursive: true, force: true}); else console.log(`Dossier d’essai gardé : ${tmp}`);
process.exit(ko ? 1 : 0);
