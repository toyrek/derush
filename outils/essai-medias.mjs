// Dérush — essais des médias de la version 11 : ce que l'IA reçoit (le rush tel quel ou sa version de montage), les
// clones sans copie, le dossier de l'IA (plans = rushes entiers, temps utiles), les mesures à l'import (Log, sombre,
// bruit de fond) et l'étalonnage automatique.
//   node outils/essai-medias.mjs
// Aucun réseau, aucune IA. Un projet d'essai est fabriqué dans un dossier temporaire.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-essai-medias-'));
process.env.DERUSH_SUPPORT = path.join(tmp, 'support');
const M = await import('../lib/medias.mjs');
const {Projet} = await import('../lib/projet.mjs');
const {exporterPack} = await import('../lib/pack.mjs');
const {mesurerMedia} = await import('../lib/analyse.mjs');
const {couleurAuto, couleurPropre} = await import('../lib/commun.mjs');
const {FFMPEG, FFPROBE} = await import('../lib/outils.mjs');
const {cloner} = await import('../lib/plateforme.mjs');

let ok = 0;
let ko = 0;
const essai = (nom, vrai, detail = '') => { if (vrai) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`); } };
const ff = (args) => execFileSync(FFMPEG, ['-v', 'error', '-y', ...args]);
const sonde = (f, e) => String(execFileSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', `stream=${e}`, '-of', 'csv=p=0', f])).trim();
const empreinte = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

console.log('Des rushes d’essai');
const R = path.join(tmp, 'rushs');
fs.mkdirSync(R);
const fic = (n) => path.join(R, n);
ff(['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=4', '-f', 'lavfi', '-i', 'sine=f=300:d=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', fic('telephone.mp4')]);
ff(['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=3', '-c:v', 'libx265', '-x265-params', 'log-level=error', '-pix_fmt', 'yuv420p10le', '-tag:v', 'hvc1', fic('dji.mp4')]);
ff(['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25:duration=3', '-c:v', 'prores_ks', '-profile:v', '2', fic('camera.mov')]);
ff(['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mpegts', fic('avchd.mts')]);
ff(['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=3', '-c:v', 'libx265', '-x265-params', 'log-level=error:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc', '-pix_fmt', 'yuv420p10le', '-color_trc', 'arib-std-b67', '-color_primaries', 'bt2020', '-colorspace', 'bt2020nc', '-tag:v', 'hvc1', fic('iphone-hdr.mp4')]);
// une image « Log » : plate, grise, peu saturée ; une image sombre
ff(['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=3', '-vf', 'eq=contrast=0.35:saturation=0.25:brightness=0.08', '-c:v', 'libx265', '-x265-params', 'log-level=error', '-pix_fmt', 'yuv420p10le', '-tag:v', 'hvc1', '-movflags', 'use_metadata_tags', '-metadata', 'make=Sony', '-metadata', 'model=ILCE-7SM3', fic('sony-log.mp4')]);
ff(['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=3', '-vf', 'eq=brightness=-0.32:contrast=0.9', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', fic('sombre.mp4')]);
essai('sept rushes fabriqués', fs.readdirSync(R).length === 7);

console.log('Ce que l’IA reçoit : tel quel, ou une version de montage');
const sonder = async (n) => ({id: n, nom: n, chemin: fic(n), ...(await M.sonder(fic(n)))});
const tel = await sonder('telephone.mp4');
const dji = await sonder('dji.mp4');
const cam = await sonder('camera.mov');
const ts = await sonder('avchd.mts');
const hdr = await sonder('iphone-hdr.mp4');
essai('H.264 4:2:0 en MP4 : donné tel quel', M.besoinVersion(tel) === null);
essai('HEVC 10 bits 4:2:0 (DJI) : donné tel quel', M.besoinVersion(dji) === null, JSON.stringify(M.besoinVersion(dji)));
essai('ProRes : réencodé une fois', M.besoinVersion(cam)?.genre === 'reencoder');
essai('AVCHD (.mts) : seulement réemballé, sans réencoder', M.besoinVersion(ts)?.genre === 'emballer');
essai('HDR (HLG) : ramené en couleurs normales', M.besoinVersion(hdr)?.genre === 'reencoder' && /HDR/.test(M.besoinVersion(hdr).raison));
essai('vidéo tournée (rotation 90°) : réencodée', M.besoinVersion({...tel, rotation: 90})?.genre === 'reencoder');
essai('Log converti (profil choisi) : réencodé avec le LUT', M.besoinVersion({...dji, couleur: {profil: 'slog3'}})?.genre === 'reencoder');
essai('un rush ancien (format inconnu) : à vérifier d’abord', M.besoinVersion({type: 'video', codec: 'h264'})?.genre === 'inconnu');

const projetD = path.join(tmp, 'Projet essai');
fs.mkdirSync(projetD);
const P = new Projet(projetD);
const vCam = await M.fichierPourIA(P, cam);
essai('ProRes → une version H.264 4:2:0 dans le dossier du rush', /montage-.*\.mp4$/.test(vCam) && sonde(vCam, 'codec_name,pix_fmt') === 'h264,yuv420p', sonde(vCam, 'codec_name,pix_fmt'));
const t0 = Date.now();
essai('demandée de nouveau : la même, aussitôt', (await M.fichierPourIA(P, cam)) === vCam && Date.now() - t0 < 500);
const [a, b] = await Promise.all([M.fichierPourIA(P, ts), M.fichierPourIA(P, ts)]);
essai('deux demandes en même temps : une seule version', a === b && fs.readdirSync(path.dirname(a)).filter((f) => /^montage-/.test(f)).length === 1);
essai('AVCHD réemballé : la vidéo d’origine, sans perte', sonde(a, 'codec_name') === 'h264');
const vHdr = await M.fichierPourIA(P, hdr);
essai('HDR → BT.709 en 8 bits', sonde(vHdr, 'color_transfer,pix_fmt').includes('bt709') && sonde(vHdr, 'pix_fmt') === 'yuv420p', sonde(vHdr, 'color_transfer,pix_fmt'));
essai('un rush lisible tel quel : son propre chemin', (await M.fichierPourIA(P, tel)) === tel.chemin);

console.log('Poser un fichier sans risque pour l’original');
const dst = path.join(projetD, 'clone.mp4');
const genre = await M.poserFichier(tel.chemin, dst);
essai('même disque : un clone (ou une copie là où le système ne clone pas)', ['clone', 'copie'].includes(genre), genre);
essai('le contenu est identique', empreinte(dst) === empreinte(tel.chemin));
const avant = empreinte(tel.chemin);
fs.appendFileSync(dst, 'abîmé');
essai('écrire dans le clone ne touche jamais l’original', empreinte(tel.chemin) === avant && empreinte(dst) !== avant);
essai('cloner vers un autre disque : refusé sans rien écrire', (await cloner(tel.chemin, '/dev/null/x')) === false);

console.log('Le dossier de l’IA');
for (const n of ['telephone.mp4', 'dji.mp4', 'camera.mov']) P.d.medias.push({...(await sonder(n)), id: `M${P.d.medias.length + 1}`, etapes: {}, etat: 'pret'});
P.d.montage = [
  {id: 'P1', type: 'plan', media: 'M1', entree: 1, sortie: 3, titre: '', notes: '', tags: [], son: {actif: true, gain_db: 0, version: 'original', avant_s: 0, apres_s: 0}, couleur: {exposition: 20, temperature: -30}},
  {id: 'P2', type: 'plan', media: 'M2', entree: 0.5, sortie: 2, titre: '', notes: '', tags: [], son: {actif: true, gain_db: 0, version: 'original', avant_s: 0, apres_s: 0}},
  {id: 'P3', type: 'plan', media: 'M1', entree: 3, sortie: 4, titre: '', notes: '', tags: [], son: {actif: true, gain_db: 0, version: 'original', avant_s: 0, apres_s: 0}},
  {id: 'P4', type: 'plan', media: 'M3', entree: 0, sortie: 2, titre: '', notes: '', tags: [], son: {actif: true, gain_db: 0, version: 'original', avant_s: 0, apres_s: 0}},
];
P.sauver();
const t1 = Date.now();
const pack = await exporterPack(P, () => {}, {leger: true});
const montage = JSON.parse(fs.readFileSync(path.join(pack.dossier, 'montage.json'), 'utf8'));
const plans = montage.montage.filter((x) => x.type === 'plan');
essai('le pack se prépare en quelques secondes', Date.now() - t1 < 30000, `${Date.now() - t1} ms`);
essai('un fichier par rush dans plans/ (P1 et P3 partagent le même)', plans[0].fichier.chemin === plans[2].fichier.chemin && new Set(plans.map((x) => x.fichier.chemin)).size === 3);
essai('le rush H.264 est le fichier d’origine, intact', empreinte(path.join(pack.dossier, plans[0].fichier.chemin)) === empreinte(fic('telephone.mp4')));
essai('la partie utile est donnée par ses temps (1 → 3 s)', plans[0].fichier.debut_utile_s === 1 && Math.abs(plans[0].fichier.fin_utile_s - 3) < 0.05);
essai('le ProRes arrive en version de montage H.264', sonde(path.join(pack.dossier, plans[3].fichier.chemin), 'codec_name') === 'h264');
essai('l’étalonnage posé par l’humain part au rendu (colorCorrection)', plans[0].couleur?.exposure === 0.4 && plans[0].couleur_reglages?.temperature === -30);
essai('les autres plans n’en ont pas', !plans[1].couleur);
essai('tous les médias sont listés, même hors timeline', montage.sources.length === 3);

console.log('Les mesures à l’import');
const prep = async (n) => {
  const m = {...(await sonder(n)), id: `X${n.length}${n[0]}`, etapes: {}};
  const D = P.dossierMedia(m.id);
  await mesurerMedia(P, m, D);
  return m;
};
const log = await prep('sony-log.mp4');
essai('une image plate et grise d’une Sony : « Log », S-Log3 proposé', log.mesures.defauts.some((d) => d.id === 'log') && log.mesures.profil_suggere === 'slog3', JSON.stringify(log.mesures));
const sombre = await prep('sombre.mp4');
essai('une image sombre est signalée', sombre.mesures.defauts.some((d) => d.id === 'sombre'), JSON.stringify(sombre.mesures));
const normal = await prep('telephone.mp4');
essai('une mire normale : pas de Log', !normal.mesures.defauts.some((d) => d.id === 'log'));

console.log('L’étalonnage automatique');
const autoSombre = couleurAuto({exposition: 0.2, contraste: 0.7, saturation: 0.4, dominante: {bleu: 0, rouge: 0}});
essai('une image sombre : l’exposition monte', autoSombre?.exposition > 0, JSON.stringify(autoSombre));
const autoChaud = couleurAuto({exposition: 0.45, contraste: 0.7, saturation: 0.45, dominante: {bleu: -8, rouge: 8}});
essai('une dominante orangée : la température baisse', autoChaud?.temperature < 0, JSON.stringify(autoChaud));
essai('une image déjà juste : rien à corriger', couleurAuto({exposition: 0.45, contraste: 0.75, saturation: 0.45, dominante: {bleu: 0, rouge: 0}}) === null);
essai('les réglages restent entre −100 et 100', couleurPropre({exposition: 500}).exposition === 100);

fs.rmSync(tmp, {recursive: true, force: true});
console.log(`\n${ok} essais réussis sur ${ok + ko}.`);
process.exit(ko ? 1 : 0);
