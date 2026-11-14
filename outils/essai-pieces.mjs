// Dérush — les essais du rôle deviné d'une pièce jointe, puis ceux du dossier de travail de l'IA et des outils du kit
// (pour qui modifie Dérush).
//   node outils/essai-pieces.mjs
// 1. Le rôle deviné : les cas viennent d'un vrai dossier de travail (un teaser : logos retenus, explorations, textes,
//    références). Aucun fichier n'est lu.
// 2. Le pack : un projet d'essai (un rush, une voix off par-dessus, une note) fabriqué par FFmpeg dans un dossier
//    temporaire. Le dossier de l'IA ignore les cases du panneau « Exporter le pack » ; un chemin avec « : », « ' », « , »
//    ou des crochets (Windows : « C:/… ») ne fait plus tomber le storyboard ; recouper.mjs garde la voix off, les mots
//    d'un passage allongé et ce que l'IA a changé dans montage.json ; rendre.mjs ne dessine pas les repères de travail.
//    Aucun réseau, aucune IA.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.DERUSH_SUPPORT ??= path.join(os.tmpdir(), 'derush-essai-pieces');
const {roleProbable, typeDe} = await import(`${D}/lib/pieces.mjs`);
const CAS = [
  ['02_Logos_retenus/MJC_Persan_retenu.png', 'logo', 'une image rangée dans un dossier de logos'],
  ['03_Explorations/E01_Logo_MJC_retro_de_YABAI.png', 'logo', 'une image dont le nom dit « logo »'],
  ['03_Explorations/E11_Embleme_MJC_retro_franco_japonais.png', 'logo', 'un emblème'],
  ['05_References/REF_Ancien_logo_MJC_Persan.jpg', 'reference', 'une référence qui montre un logo'],
  ['05_References/REF_Logo_YABAI_original.png', 'reference', 'une référence, par son nom et son dossier'],
  ['Bureau/REF_Sentai.jpg', 'reference', 'une référence, par son nom seul'],
  ['moodboard/planche-logos.png', 'reference', 'une image d’un dossier de moodboard'],
  ['Projet/INVENTAIRE_LOGOS.md', 'script', 'un texte qui parle de logos n’est pas un logo'],
  ['04_Teaser/BRIEF_TEASER_MJC.md', 'script', 'un brief'],
  ['01_Concept/CONCEPT_POLE_MJC.md', 'script', 'un concept'],
  ['Projet/00_LIRE_D_ABORD.md', 'script', 'une note « à lire d’abord »'],
  ['Projet/MANIFEST_ASSETS.json', 'reference', 'un fichier de données sans indice'],
  ['Marque/Charte graphique YABAI.pdf', 'charte', 'une charte'],
  ['Marque/Anton-Regular.ttf', 'police', 'une police'],
  ['Sons/impact.wav', 'musique', 'un son'],
  ['Rushes/plan-large.mp4', 'reference', 'une vidéo sans indice'],
  ['Logos/logo-yabai.svg', 'logo', 'un logo vectoriel'],
];
let bons = 0;
let total = 0;
const essai = (quoi, vrai, detail = '') => {
  total++;
  if (vrai) bons++;
  console.log(`${vrai ? '✓' : '✗'} ${quoi}${vrai || !detail ? '' : ` — ${detail}`}`);
};
console.log('Le rôle deviné d’une pièce jointe');
for (const [chemin, voulu, quoi] of CAS) {
  const nom = path.basename(chemin);
  const r = roleProbable(nom, typeDe(nom), path.basename(path.dirname(chemin)));
  essai(`${quoi} : ${chemin} → ${r}`, r === voulu, `attendu : ${voulu}`);
}

// ——— Le pack et le kit ———
const {Projet} = await import(`${D}/lib/projet.mjs`);
const {exporterPack} = await import(`${D}/lib/pack.mjs`);
const {cheminFiltre} = await import(`${D}/lib/couleurs.mjs`);
const {FFMPEG, POLICE} = await import(`${D}/lib/outils.mjs`);
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-essai-pack-'));
const tmpdirAvant = process.env.TMPDIR;
const lire = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
try {
  const ff = (args) => execFileSync(FFMPEG, ['-v', 'error', '-y', ...args]);
  // un dossier comme ceux de Windows (« C: ») avec une apostrophe, une virgule, des crochets et un point-virgule
  const bizarre = path.join(base, 'C:', 'tmp d’été l\'an, [1]; x');
  fs.mkdirSync(bizarre, {recursive: true});

  console.log('\nUn chemin dans un filtre de FFmpeg');
  if (POLICE) {
    const police = path.join(bizarre, 'po:lice.ttf');
    fs.copyFileSync(POLICE, police);
    const texte = path.join(bizarre, 't:1.txt');
    fs.writeFileSync(texte, 'Bonjour « été » : 10 % \'ok\'');
    let ok = true;
    try { ff(['-f', 'lavfi', '-i', 'color=c=black:s=320x80:d=1', '-vf', `drawtext=fontfile=${cheminFiltre(police)}:textfile=${cheminFiltre(texte)}:expansion=none:fontsize=20:fontcolor=white`, '-frames:v', '1', path.join(base, 'texte.png')]); } catch { ok = false; }
    essai('police et texte dans un dossier « C: » avec « ' + "'" + ' , [ ] ; » : FFmpeg les trouve', ok && fs.existsSync(path.join(base, 'texte.png')));
  } else console.log('  (pas de police sur ce système : essai sauté)');

  // un projet : un rush vidéo (P1, P2), une voix off par-dessus (S1), une note de l'humain (I1)
  const R = path.join(base, 'rushes');
  fs.mkdirSync(R);
  const v = path.join(R, 'rush.mp4');
  const a = path.join(R, 'voix off.wav');
  ff(['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=8', '-f', 'lavfi', '-i', 'sine=f=300:d=8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', v]);
  ff(['-f', 'lavfi', '-i', 'sine=f=500:d=6', a]);
  const P = new Projet(path.join(base, 'Projet essai'));
  P.d.titre = 'Essai pack';
  P.d.medias.push({id: 'M1', nom: 'rush.mp4', chemin: v, type: 'video', duree: 8, fps: 30, largeur: 640, hauteur: 360, audio: true, codec: 'h264', pix_fmt: 'yuv420p'});
  P.d.medias.push({id: 'M2', nom: 'voix off.wav', chemin: a, type: 'audio', duree: 6, audio: true});
  for (const [id, l] of [['M1', [['Bonjour', 0.5, 0.9], ['à', 1.0, 1.1], ['tous', 1.2, 1.5], ['ici', 2.2, 2.5], ['on', 5.0, 5.2], ['parle', 5.3, 5.7], ['vélo', 6.6, 7.0]]],
    ['M2', [['Voici', 0.3, 0.7], ['la', 0.8, 0.9], ['voix', 1.0, 1.4], ['off', 1.5, 1.8], ['du', 2.5, 2.7], ['film', 2.8, 3.2]]]]) {
    fs.mkdirSync(path.join(P.cache, 'medias', id), {recursive: true});
    fs.writeFileSync(path.join(P.cache, 'medias', id, 'mots.json'), JSON.stringify({mots: l.map(([t, d, f]) => ({t, d, f}))}));
    P.d.medias.find((m) => m.id === id).transcription = {moteur: 'essai'};
  }
  const son = {actif: true, gain_db: 0, version: 'original', avant_s: 0, apres_s: 0};
  P.d.montage = [
    {id: 'P1', type: 'plan', media: 'M1', entree: 0.4, sortie: 2.6, titre: '', notes: '', tags: [], son: {...son}},
    {id: 'P2', type: 'plan', media: 'M1', entree: 4.8, sortie: 6.0, titre: '', notes: '', tags: [], son: {...son}},
  ];
  P.d.superpositions = [{id: 'S1', media: 'M2', entree: 0, sortie: 3.4, debut: 0, titre: 'Voix off', notes: '', cadre: 'plein', voix_off: true, son: {...son}}];
  P.d.indications = [{id: 'I1', genre: 'texte', consigne: 'Nom à l’écran', debut: 0.5, fin: 2}];
  // les cases du panneau « Exporter le pack » : sans kit, avec un .zip et les rushes complets
  P.d.export = {...P.d.export, kit_remotion: false, zip: true, rushes_complets: true};
  P.sauver();

  console.log('\nLe dossier de travail de l’IA');
  process.env.TMPDIR = bizarre; // le dossier temporaire du pack a lui aussi « : » dans son chemin, comme sous Windows
  let pack;
  try { pack = await exporterPack(P, () => {}, {pourIA: true, dossier: path.join(base, 'atelier')}); } finally {
    if (tmpdirAvant === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = tmpdirAvant;
  }
  const A = pack.dossier;
  const montage0 = lire(path.join(A, 'montage.json'));
  essai('« Kit de départ Remotion » décoché : l’IA reçoit quand même le kit', fs.existsSync(path.join(A, 'remotion', 'recouper.mjs')) && montage0.kit_remotion === 'remotion/');
  essai('« Créer aussi un .zip » : pas de zip pour l’IA', !fs.existsSync(`${A}.zip`) && pack.zip === null);
  essai('« Rushes complets » : pas de copie pour l’IA (elle a les rushes entiers dans plans/)', !fs.existsSync(path.join(A, 'rushes')));
  if (POLICE) {
    essai('dossier temporaire « C:/… l’an, [1]; » : le storyboard est dessiné', montage0.storyboard.length > 0 && fs.existsSync(path.join(A, montage0.storyboard[0].fichier)) && !pack.avertissements.some((x) => /storyboard/.test(x)), pack.avertissements.join(' | '));
    essai('… et les vignettes d’entrée et de sortie aussi', montage0.montage.every((x) => x.vignette && fs.existsSync(path.join(A, x.vignette))), pack.avertissements.join(' | '));
  }
  essai('les repères de travail : expliqués dans LISEZMOI-IA.md', /repères de travail/.test(fs.readFileSync(path.join(A, 'LISEZMOI-IA.md'), 'utf8')));

  console.log('\nL’export à la main suit les cases');
  const main = await exporterPack(P, () => {});
  essai('sans le kit, avec les rushes complets et le .zip', !fs.existsSync(path.join(main.dossier, 'remotion')) && fs.existsSync(path.join(main.dossier, 'rushes')) && !!main.zip && fs.existsSync(main.zip), JSON.stringify({kit: main.kit, zip: main.zip}));

  console.log('\nrecouper.mjs');
  const recouper = (arg) => execFileSync(process.execPath, [path.join(A, 'remotion', 'recouper.mjs'), arg], {cwd: A, encoding: 'utf8'});
  const srtDepart = fs.readFileSync(path.join(A, 'sous-titres', 'montage.srt'), 'utf8');
  fs.writeFileSync(path.join(A, 'coupes.json'), JSON.stringify([{plan: 'P2', de: 4.8, a: 7.2}, {plan: 'P1', de: 0.4, a: 1.6}]));
  recouper('coupes.json');
  let mots = lire(path.join(A, 'sous-titres', 'mots.json')).mots;
  const voix = (liste) => liste.filter((w) => w.plan === 'S1');
  essai('les sous-titres de la voix off (plan par-dessus) sont gardés', voix(mots).length === 6, mots.map((w) => `${w.plan}:${w.t}`).join(' '));
  essai('un passage allongé au-delà du plan d’origine garde ses mots (« vélo »)', mots.some((w) => w.plan === 'P2' && w.t === 'vélo'), mots.map((w) => `${w.plan}:${w.t}`).join(' '));
  essai('montage.srt dit la voix off', /Voici la voix off/.test(fs.readFileSync(path.join(A, 'sous-titres', 'montage.srt'), 'utf8')));
  // l'IA retouche montage.json : la couleur du style, sa note, et elle avance la voix off d'une seconde
  const M1 = lire(path.join(A, 'montage.json'));
  const voiciAvant = voix(mots).find((w) => w.t === 'Voici').debut;
  M1.style.accent = '#FF00AA';
  M1.indications[0].debut = {...M1.indications[0].debut, s: 3};
  const sp = M1.superpositions[0];
  sp.debut = {...sp.debut, s: sp.debut.s + 1, image: sp.debut.image + M1.sortie.fps};
  fs.writeFileSync(path.join(A, 'montage.json'), JSON.stringify(M1));
  recouper('coupes.json');
  const M2 = lire(path.join(A, 'montage.json'));
  mots = lire(path.join(A, 'sous-titres', 'mots.json')).mots;
  essai('une deuxième recoupe garde la couleur, la note et la voix off où l’IA les a mises',
    M2.style.accent === '#FF00AA' && M2.indications[0].debut.s === 3 && M2.superpositions[0].debut.image === sp.debut.image, JSON.stringify({accent: M2.style.accent, note: M2.indications[0].debut.s, voix: M2.superpositions[0].debut}));
  const voici = voix(mots).find((w) => w.t === 'Voici');
  essai('… et les sous-titres de la voix off la suivent (une seconde plus tard)', voici && Math.abs(voici.debut - voiciAvant - 1) < 0.01, `${voiciAvant} → ${voici?.debut}`);
  recouper('--origine');
  essai('--origine remet montage.json et montage.srt du départ', JSON.stringify(lire(path.join(A, 'montage.json'))) === JSON.stringify(lire(path.join(A, 'montage.origine.json'))) && fs.readFileSync(path.join(A, 'sous-titres', 'montage.srt'), 'utf8') === srtDepart);

  console.log('\nrendre.mjs');
  const rendre = fs.readFileSync(path.join(D, 'modeles', 'kit-remotion', 'rendre.mjs'), 'utf8');
  essai('un rendu ne dessine pas les cases « À créer » ni les notes de l’humain (afficherConsignes: false par défaut)', /const props = \{afficherConsignes: false, \.\.\.JSON\.parse\(option\('--props'/.test(rendre));
  const packJs = fs.readFileSync(path.join(D, 'lib', 'pack.mjs'), 'utf8');
  essai('le détourage d’un « Titre derrière la personne » reçoit la cadence qui a compté ses images', /decoupesFichier\([^;]*, i0, i1, undefined, sf\)/.test(packJs));

  // ——— Le rendu par le relais (Codex, Gemini) : l'assemblage ne prend que le dossier de travail et le moteur ———
  console.log('\nrendre.mjs par le relais : rien d’autre que le dossier de travail et le moteur');
  const HORS = 'hors du dossier de travail';
  const moteurReel = path.join(process.env.DERUSH_SUPPORT, 'moteurs', 'rendu', 'node_modules');
  if (!fs.existsSync(path.join(moteurReel, '@remotion', 'bundler'))) console.log('  (pas de moteur de rendu dans ce dossier de Dérush : essais sautés)');
  else {
    // le moteur vu par des liens, avec son propre cache : l'essai n'écrit rien dans le vrai moteur
    const nm = path.join(A, 'remotion', 'node_modules');
    fs.mkdirSync(path.join(nm, '.cache'), {recursive: true});
    for (const n of fs.readdirSync(moteurReel)) if (n !== '.cache') fs.symlinkSync(path.join(moteurReel, n), path.join(nm, n));
    const dehors = path.join(base, 'dehors');
    fs.mkdirSync(dehors);
    const secret = path.join(dehors, 'secret.json');
    fs.copyFileSync(path.join(A, 'montage.json'), secret);
    // comme le relais : DERUSH_PROJET_REMOTION posé, une composition qui n'existe pas (on s'arrête après l'assemblage)
    const parRelais = () => {
      try {
        const sortie = execFileSync(process.execPath, [path.join(A, 'remotion', 'rendre.mjs'), 'Inexistante', path.join(A, 'rendu', 'essai.mp4')], {cwd: A, env: {...process.env, DERUSH_PROJET_REMOTION: path.join(A, 'remotion')}, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000});
        return {code: 0, sortie};
      } catch (e) { return {code: e.status ?? 1, sortie: `${e.stdout ?? ''}${e.stderr ?? ''}`}; }
    };
    const assemble = (r) => !r.sortie.includes(HORS) && /Inexistante/.test(r.sortie) && /compositions? (are )?available|could not find composition/i.test(r.sortie);
    const r0 = parRelais();
    essai('un kit normal s’assemble (il ne manque que la composition demandée)', assemble(r0), r0.sortie.slice(-500));
    const assemblagesRestes = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('derush-assemblage-'));
    const mj = path.join(A, 'montage.json');
    const montageGarde = fs.readFileSync(mj);
    fs.rmSync(mj);
    fs.symlinkSync(secret, mj);
    const r1 = parRelais();
    fs.rmSync(mj);
    fs.writeFileSync(mj, montageGarde);
    essai('montage.json remplacé par un lien vers un fichier du dehors : rendu refusé', r1.code !== 0 && r1.sortie.includes(HORS), r1.sortie.slice(-500));
    const index = path.join(A, 'remotion', 'src', 'index.ts');
    const vol = path.join(A, 'remotion', 'src', 'vol.ts');
    const indexAvant = fs.readFileSync(index, 'utf8');
    try {
      fs.writeFileSync(index, `import './vol';\n${indexAvant}`);
      fs.writeFileSync(vol, `import x from ${JSON.stringify(secret)};\nexport default x;\n`);
      const r2 = parRelais();
      essai('un import par chemin absolu, hors du dossier de travail : rendu refusé', r2.code !== 0 && r2.sortie.includes(HORS), r2.sortie.slice(-500));
      fs.symlinkSync(dehors, path.join(nm, 'paquet-vol'));
      fs.writeFileSync(vol, 'import x from \'paquet-vol/secret.json\';\nexport default x;\n');
      const r3 = parRelais();
      essai('un paquet de remotion/node_modules relié ailleurs que le moteur : rendu refusé', r3.code !== 0 && r3.sortie.includes(HORS), r3.sortie.slice(-500));
      fs.writeFileSync(vol, `import x from '!!${path.join(A, 'chargeur.js')}!../../montage.json';\nexport default x;\n`);
      fs.writeFileSync(path.join(A, 'chargeur.js'), 'module.exports = function () { require("fs").writeFileSync(__dirname + "/chargeur-lance", "oui"); return "export default 1"; };\n');
      const r4 = parRelais();
      essai('un « loader » écrit dans le dossier de travail (du code lancé hors du bac à sable) : refusé, jamais lancé', r4.code !== 0 && /Rendu refusé : .* demande un loader qui ne vient pas du moteur/.test(r4.sortie) && !fs.existsSync(path.join(A, 'chargeur-lance')), r4.sortie.slice(-500));
      essai('un assemblage refusé ne laisse pas son dossier dans le dossier temporaire', fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('derush-assemblage-') && !assemblagesRestes.includes(n)).length === 0);
    } finally {
      fs.writeFileSync(index, indexAvant);
      fs.rmSync(vol, {force: true});
    }
  }

  // ——— Une pièce jointe coupée en route ———
  console.log('\nUne pièce jointe coupée en route');
  const {televerserPiece, listerPieces} = await import(`${D}/lib/pieces.mjs`);
  const {Readable} = await import('node:stream');
  let morceaux = 0;
  const coupe = new Readable({read() { if (morceaux++ < 3) this.push(Buffer.alloc(64 * 1024, 1)); else this.destroy(new Error('envoi coupé')); }});
  let erreurEnvoi = null;
  try { await televerserPiece(P, 'coupée.mov', coupe); } catch (e) { erreurEnvoi = e; }
  const dossierPieces = path.join(P.racine, 'claude', 'pieces');
  const restes = fs.existsSync(dossierPieces) ? fs.readdirSync(dossierPieces) : [];
  essai('l’erreur remonte, et la copie à moitié faite est effacée (rien dans claude/pieces/)', erreurEnvoi?.message === 'envoi coupé' && restes.length === 0 && listerPieces(P).length === 0, `${erreurEnvoi?.message} · ${restes.join(', ')}`);

  // ——— Des ids abîmés (un projet reçu) ne font rien écrire hors du pack ———
  console.log('\nUn projet aux ids abîmés');
  const Q = new Projet(path.join(base, 'Projet ids'));
  Q.d.titre = 'Ids abimes';
  Q.d.medias.push({...P.d.medias[0]});
  const refFichier = path.join(base, 'ref.txt');
  fs.writeFileSync(refFichier, 'une référence');
  Q.d.montage = [
    {id: '../../../../vol-plan', type: 'plan', media: 'M1', entree: 0.4, sortie: 2, titre: '', notes: '', tags: [], son: {...son}},
    {id: '../../vol|case', type: 'bloc', genre: 'scene', duree: 1, titre: '', consigne: 'Une scène', references: ''},
  ];
  Q.d.references = [{id: 'R1', nom: '../../vol-ref.txt', chemin: refFichier, cible: '../../vol|case', taille: 13}];
  Q.sauver();
  const dossierQ = path.join(base, 'q', 'a', 'b', 'atelier');
  const packQ = await exporterPack(Q, () => {}, {pourIA: true, dossier: dossierQ});
  const tous = [];
  const parcourir = (d) => { for (const e of fs.readdirSync(d, {withFileTypes: true})) { const f = path.join(d, e.name); tous.push(f); if (e.isDirectory() && !e.isSymbolicLink()) parcourir(f); } };
  parcourir(path.join(base, 'q'));
  const dehorsDuPack = tous.filter((f) => f !== packQ.dossier && !f.startsWith(packQ.dossier + path.sep) && !packQ.dossier.startsWith(f + path.sep));
  essai('rien n’est écrit hors du pack (vignettes, références)', dehorsDuPack.length === 0, dehorsDuPack.join(', '));
  const mq = lire(path.join(packQ.dossier, 'montage.json'));
  const caseQ = mq.montage.find((x) => x.type === 'bloc');
  essai('… et la référence de la case est bien dans le pack', caseQ?.fichiers_reference?.length === 1 && fs.existsSync(path.join(packQ.dossier, caseQ.fichiers_reference[0].chemin)), JSON.stringify(caseQ?.fichiers_reference));
  const lisezQ = fs.readFileSync(path.join(packQ.dossier, 'LISEZMOI-IA.md'), 'utf8');
  essai('un id avec « | » ne casse pas le tableau de LISEZMOI-IA.md', !lisezQ.includes('vol|case') && lisezQ.includes('vol/case'));
} catch (e) {
  essai('les essais du pack vont jusqu’au bout', false, e.stack ?? String(e));
} finally {
  if (tmpdirAvant === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = tmpdirAvant;
  fs.rmSync(base, {recursive: true, force: true});
}

console.log(`\n${bons} essais réussis sur ${total}`);
process.exit(bons === total ? 0 : 1);
