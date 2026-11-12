// Dérush — les essais de l'enregistrement (voix au micro, webcam) et de la voix off (pour qui modifie Dérush).
//   node outils/essai-enregistrement.mjs
// Aucun micro, aucune caméra : FFmpeg fabrique ce qu'une fenêtre enverrait (du webm comme Chrome, du mp4 en fragments
// comme Safari et l'app Mac), et l'essai le donne à Dérush morceau par morceau, dans un projet jetable.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'derush-essai-enregistrement-'));
process.env.DERUSH_SUPPORT ??= path.join(T, 'support');
const {Projet} = await import(`${D}/lib/projet.mjs`);
const {lancer, arreterEnfants, FFMPEG, FFPROBE} = await import(`${D}/lib/outils.mjs`);
const E = await import(`${D}/lib/enregistrement.mjs`);
const {MODES} = await import(`${D}/lib/commun.mjs`);

let bons = 0;
let total = 0;
const essai = (quoi, vrai, detail = '') => { total++; if (vrai) bons++; console.log(`${vrai ? '✓' : '✗'} ${quoi}${vrai || !detail ? '' : ` — ${detail}`}`); };
const file = {ajouter() { return {}; }}; // pas de préparation lourde ici (vignettes, transcription…)
const sonde = async (f) => JSON.parse((await lancer(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', f])).out.toString());
/** Donne un fichier à Dérush comme le fait la fenêtre : par morceaux, dans l'ordre. */
async function envoyer(P, id, fichier, taille = 20000) {
  const tout = fs.readFileSync(fichier);
  let n = 0;
  for (let k = 0; k < tout.length; k += taille) await E.ajouterMorceau(P, id, n++, Readable.from([tout.subarray(k, k + taille)]));
  return n;
}
const refuse = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };

// ce qu'une fenêtre enverrait
const src = {
  voixWebm: path.join(T, 'voix.webm'), voixMp4: path.join(T, 'voix.mp4'), camWebm: path.join(T, 'cam.webm'), camMp4: path.join(T, 'cam.mp4'),
};
const son = ['-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000'];
const image = ['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=24'];
await lancer(FFMPEG, ['-v', 'error', '-y', ...son, '-t', '3', '-c:a', 'libopus', '-b:a', '96k', src.voixWebm]);
await lancer(FFMPEG, ['-v', 'error', '-y', ...son, '-t', '3', '-c:a', 'aac', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', src.voixMp4]);
await lancer(FFMPEG, ['-v', 'error', '-y', ...image, ...son, '-t', '3', '-c:v', 'libvpx', '-b:v', '800k', '-c:a', 'libopus', src.camWebm]);
await lancer(FFMPEG, ['-v', 'error', '-y', ...image, ...son, '-t', '3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', src.camMp4]);

const P = new Projet(path.join(T, 'Voyage'));
const dossier = path.join(P.racine, 'enregistrements');

// 1. une voix, envoyée par Chrome (webm)
{
  const {id} = E.commencerEnregistrement(P, {genre: 'voix', mime: 'audio/webm;codecs=opus'});
  essai('une prise commence : un identifiant de 16 caractères', /^[a-f0-9]{16}$/.test(id));
  essai('pendant la prise, Dérush sait qu’un enregistrement est en cours', E.enregistrementEnCours());
  const n = await envoyer(P, id, src.voixWebm);
  essai('le son arrive en plusieurs morceaux', n > 1, `${n} morceau(x)`);
  const r = await E.terminerEnregistrement(P, id, file);
  const m = P.media(r.media);
  essai('la voix est rangée dans le projet, en .m4a', r.genre === 'voix' && /^voix-off-\d{8}-\d{6}\.m4a$/.test(r.fichier) && fs.existsSync(path.join(dossier, r.fichier)), r.fichier);
  essai('elle est dans les médias, comme un son', m?.type === 'audio' && Math.abs(m.duree - 3) < 0.3, `${m?.type} ${m?.duree}`);
  const j = await sonde(path.join(dossier, r.fichier));
  essai('du son seul, en AAC à 48 kHz', j.streams.length === 1 && j.streams[0].codec_name === 'aac' && j.streams[0].sample_rate === '48000', JSON.stringify(j.streams.map((s) => [s.codec_name, s.sample_rate])));
  essai('le fichier brut est effacé', !fs.readdirSync(dossier).some((f) => /brut/.test(f)), fs.readdirSync(dossier).join(', '));
  essai('la prise finie, plus rien en cours', !E.enregistrementEnCours());
}

// 2. une voix, envoyée par Safari ou l'app Mac (mp4 en fragments)
{
  await new Promise((ok) => setTimeout(ok, 1100)); // les noms portent la seconde : deux prises ne se marchent pas dessus
  const {id} = E.commencerEnregistrement(P, {genre: 'voix', mime: 'audio/mp4;codecs=mp4a.40.2'});
  await envoyer(P, id, src.voixMp4);
  const r = await E.terminerEnregistrement(P, id, file);
  essai('une voix en mp4 (Safari, app Mac) est rangée de la même façon', P.media(r.media)?.type === 'audio' && Math.abs(P.media(r.media).duree - 3) < 0.3, `${P.media(r.media)?.duree}`);
}

// 3. la webcam, envoyée par Chrome (webm) puis par l'app Mac (mp4)
for (const [nom, fichier, mime] of [['webm (Chrome)', src.camWebm, 'video/webm;codecs=vp8,opus'], ['mp4 (app Mac)', src.camMp4, 'video/mp4']]) {
  await new Promise((ok) => setTimeout(ok, 1100));
  const {id} = E.commencerEnregistrement(P, {genre: 'camera', mime});
  await envoyer(P, id, fichier, 60000);
  const r = await E.terminerEnregistrement(P, id, file);
  const j = await sonde(path.join(dossier, r.fichier));
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  essai(`la webcam en ${nom} devient un .mp4 H.264 à 30 images par seconde, avec son`, /^camera-.*\.mp4$/.test(r.fichier) && v?.codec_name === 'h264' && v.r_frame_rate === '30/1' && v.pix_fmt === 'yuv420p' && a?.codec_name === 'aac',
    JSON.stringify([r.fichier, v?.codec_name, v?.r_frame_rate, v?.pix_fmt, a?.codec_name]));
  essai(`… et elle est dans les médias, comme une vidéo (${nom})`, P.media(r.media)?.type === 'video' && Math.abs(P.media(r.media).duree - 3) < 0.4, `${P.media(r.media)?.type} ${P.media(r.media)?.duree}`);
}

// 4. les refus
{
  essai('un genre inconnu est refusé', /inconnu/.test(await refuse(() => E.commencerEnregistrement(P, {genre: 'ecran'})) ?? ''));
  await new Promise((ok) => setTimeout(ok, 1100));
  const {id} = E.commencerEnregistrement(P, {genre: 'voix', mime: 'audio/webm'});
  essai('un morceau hors de l’ordre est refusé', /attendu/.test(await refuse(() => E.ajouterMorceau(P, id, 3, Readable.from([Buffer.alloc(10)]))) ?? ''));
  const autre = new Projet(path.join(T, 'Autre'));
  essai('un autre projet ne peut pas écrire dans cette prise', /n’existe plus/.test(await refuse(() => E.ajouterMorceau(autre, id, 0, Readable.from([Buffer.alloc(10)]))) ?? ''));
  essai('… ni la terminer', /n’existe plus/.test(await refuse(() => E.terminerEnregistrement(autre, id, file)) ?? ''));
  await E.ajouterMorceau(P, id, 0, Readable.from([Buffer.alloc(500)]));
  const m = await refuse(() => E.terminerEnregistrement(P, id, file));
  essai('une prise vide (le micro n’a rien envoyé) est dite clairement', /Rien n’a été enregistré/.test(m ?? ''), m ?? 'aucune erreur');
  essai('… et ne laisse rien dans le projet', !fs.readdirSync(dossier).some((f) => /brut/.test(f)));
}

// 5. une prise abandonnée : rien n'est gardé
{
  await new Promise((ok) => setTimeout(ok, 1100));
  const avant = fs.readdirSync(dossier).length;
  const {id} = E.commencerEnregistrement(P, {genre: 'voix', mime: 'audio/webm'});
  await E.ajouterMorceau(P, id, 0, Readable.from([fs.readFileSync(src.voixWebm).subarray(0, 9000)]));
  essai('abandonner une prise', E.annulerEnregistrement(P, id) === true);
  await new Promise((ok) => setTimeout(ok, 150));
  essai('… n’en garde rien', fs.readdirSync(dossier).length === avant, fs.readdirSync(dossier).join(', '));
  essai('… et la prise n’existe plus', /n’existe plus/.test(await refuse(() => E.terminerEnregistrement(P, id, file)) ?? ''));
}

// 6. un fichier que FFmpeg ne sait pas lire : on le garde tel quel, visible
{
  await new Promise((ok) => setTimeout(ok, 1100));
  const {id} = E.commencerEnregistrement(P, {genre: 'voix', mime: 'audio/webm'});
  await E.ajouterMorceau(P, id, 0, Readable.from([Buffer.alloc(6000, 7)]));
  const m = await refuse(() => E.terminerEnregistrement(P, id, file));
  const garde = fs.readdirSync(dossier).filter((f) => /\.brut\./.test(f));
  essai('un enregistrement illisible est gardé tel quel, sous un nom visible', /gardé tel quel/.test(m ?? '') && garde.length === 1 && !garde[0].startsWith('.'), `${m} | ${garde.join(', ')}`);
  for (const f of garde) fs.rmSync(path.join(dossier, f));
}

// 7. Dérush s'arrête en pleine prise : ce qui a été dit reste dans le projet
{
  await new Promise((ok) => setTimeout(ok, 1100));
  const {id} = E.commencerEnregistrement(P, {genre: 'voix', mime: 'audio/webm;codecs=opus'});
  const tout = fs.readFileSync(src.voixWebm);
  await E.ajouterMorceau(P, id, 0, Readable.from([tout.subarray(0, Math.floor(tout.length * 0.7))]));
  E.fermerEnregistrements();
  const garde = fs.readdirSync(dossier).filter((f) => /\.brut\./.test(f));
  essai('à l’arrêt de Dérush, la prise en cours est laissée dans le projet, visible', garde.length === 1 && /^voix-off-.*\.brut\.webm$/.test(garde[0]), garde.join(', '));
  const taille = garde.length ? fs.statSync(path.join(dossier, garde[0])).size : 0;
  essai('… avec tout ce qui avait été reçu (écrit au fur et à mesure)', taille === Math.floor(tout.length * 0.7), `${taille} octets`);
  let lisible = false;
  try { lisible = Number((await sonde(path.join(dossier, garde[0]))).streams?.length) > 0; } catch { /* illisible */ }
  essai('… et ce fichier coupé net se lit encore', lisible);
  essai('plus rien en cours après l’arrêt', !E.enregistrementEnCours());
}

// 8. la voix off dans le projet : la marque tient à l'enregistrement du projet, et le mode existe
{
  const audio = P.d.medias.find((m) => m.type === 'audio');
  const sp = P.nettoyerSuperposition({id: 'S1', media: audio.id, entree: 0, sortie: 2.5, debut: 4, titre: 'Voix off', cadre: 'plein', son: {actif: true}, voix_off: true});
  essai('une voix off posée par-dessus garde sa marque', sp?.voix_off === true && sp.son.actif === true && sp.debut === 4, JSON.stringify(sp));
  const sp2 = P.nettoyerSuperposition({id: 'S2', media: audio.id, entree: 0, sortie: 2, debut: 0, son: {actif: true}});
  essai('un autre son par-dessus (une musique) ne la porte pas', sp2 && !('voix_off' in sp2), JSON.stringify(sp2));
  const sp3 = P.nettoyerSuperposition({id: 'S3', media: audio.id, entree: 0, sortie: 2, debut: 0, voix_off: 'oui'});
  essai('la marque n’accepte que « vrai »', sp3 && !('voix_off' in sp3));
  essai('le mode « Voix off » existe, avec sa consigne pour l’IA', MODES.voix?.nom === 'Voix off' && /voix_off/.test(MODES.voix.consigne ?? '') && MODES.voix.matiere === true, JSON.stringify(Object.keys(MODES)));
}

arreterEnfants();
fs.rmSync(T, {recursive: true, force: true});
console.log(`\n${bons} essais réussis sur ${total}`);
process.exit(bons === total ? 0 : 1);
