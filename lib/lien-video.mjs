// Dérush — « Comme cette vidéo », depuis un lien : une vidéo TikTok, Instagram ou YouTube que la personne veut imiter,
// téléchargée dans le projet et jointe à la conversation comme référence (son style, jamais son contenu).
//   - Par yt-dlp, à une version relue (VERSION_YTDLP), téléchargé chez l'utilisateur au premier lien (37 Mo), vérifié par
//     son empreinte SHA-256 (écrite ici pour le Mac ; ailleurs, lue dans le fichier SHA2-256SUMS de la même version) ;
//     jamais livré dans ce dépôt (l'exécutable contient du code sous GPLv3).
//   - Seulement sur un clic de la personne, pour un lien de TikTok, Instagram ou YouTube ; sans cookies ni compte : une
//     vidéo qui demande d'être connecté ne se télécharge pas, Dérush dit comment faire autrement.
//   - La vidéo reste à son auteur : elle sert à étudier un style, pas à être republiée ni découpée.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {DOSSIER_SUPPORT} from './moteurs.mjs';
import {lancer, FFMPEG} from './outils.mjs';
import {MAC, WINDOWS} from './plateforme.mjs';
import {ajouterPieces} from './pieces.mjs';

export const VERSION_YTDLP = '2026.10.26';
const BINAIRE = MAC ? 'yt-dlp_macos' : WINDOWS ? 'yt-dlp.exe' : process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
/** Les empreintes déjà relues (celle du Mac, vérifiée contre SHA2-256SUMS de la version, lui-même signé). */
const EMPREINTES = {'yt-dlp_macos': '0f922c15ccc0b83eefa1c8bc9104e434318c4bf16e408e1ee93b7745a6efe0aa'};
const BASE = () => (process.env.DERUSH_YTDLP_BASE || `https://github.com/yt-dlp/yt-dlp/releases/download/${VERSION_YTDLP}`).replace(/\/+$/, '');
export const dossierYtdlp = () => path.join(DOSSIER_SUPPORT, 'moteurs', 'yt-dlp');
export const cheminYtdlp = () => path.join(dossierYtdlp(), WINDOWS ? 'yt-dlp.exe' : 'yt-dlp');
const marque = () => path.join(dossierYtdlp(), 'version.txt');
/** Les sites dont un lien peut servir de référence. */
export const SITES = /^(?:[\w-]+\.)*(tiktok\.com|instagram\.com|youtube\.com|youtu\.be)$/i;
export const PHRASE_DROITS = 'Elle reste à son auteur : Dérush la garde pour étudier son style, ne la republie pas et n’en reprends pas d’images. Télécharger une vidéo de TikTok, Instagram ou YouTube va en général contre leurs conditions : garde-la pour toi.';

/** Le premier lien de TikTok, Instagram ou YouTube d'un texte (ou null). */
export function lienVideo(texte) {
  for (const m of String(texte ?? '').matchAll(/https?:\/\/[^\s<>"'«»]+/gi)) {
    try {
      const u = new URL(m[0].replace(/[.,;:!?)]+$/, ''));
      if (u.protocol === 'https:' && SITES.test(u.hostname)) return u.toString();
    } catch { /* pas une adresse */ }
  }
  return null;
}

export const etatYtdlp = () => {
  let v = null;
  try { v = fs.readFileSync(marque(), 'utf8').trim(); } catch { /* pas installé */ }
  return {ok: v === VERSION_YTDLP && fs.existsSync(cheminYtdlp()), version: v};
};

async function empreinteAttendue() {
  if (EMPREINTES[BINAIRE] && !process.env.DERUSH_YTDLP_BASE) return EMPREINTES[BINAIRE];
  const r = await fetch(`${BASE()}/SHA2-256SUMS`, {signal: AbortSignal.timeout(60000)});
  if (!r.ok) throw new Error(`la liste des empreintes de yt-dlp ne répond pas (${r.status}).`);
  const l = (await r.text()).split('\n').map((x) => x.trim().split(/\s+/)).find(([, nom]) => nom === BINAIRE);
  if (!l || !/^[0-9a-f]{64}$/.test(l[0])) throw new Error(`pas d’empreinte publiée pour ${BINAIRE}.`);
  return l[0];
}

let installation = null;
/** Télécharge yt-dlp (la version relue), vérifie son empreinte, et le range dans le dossier de Dérush. */
export function installerYtdlp() {
  installation ??= (async () => {
    fs.mkdirSync(dossierYtdlp(), {recursive: true});
    const attendue = await empreinteAttendue();
    const part = `${cheminYtdlp()}.part`;
    const r = await fetch(`${BASE()}/${BINAIRE}`, {signal: AbortSignal.timeout(10 * 60e3)});
    if (!r.ok || !r.body) throw new Error(`yt-dlp n’a pas pu être téléchargé (${r.status}).`);
    await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(part));
    const empreinte = crypto.createHash('sha256').update(fs.readFileSync(part)).digest('hex');
    if (empreinte !== attendue) { fs.rmSync(part, {force: true}); throw new Error('le téléchargeur reçu ne correspond pas à celui qui a été vérifié : rien n’est gardé.'); }
    fs.chmodSync(part, 0o755);
    fs.renameSync(part, cheminYtdlp());
    fs.writeFileSync(marque(), VERSION_YTDLP);
    return etatYtdlp();
  })().finally(() => { installation = null; });
  return installation;
}

/** Les arguments de yt-dlp : une seule vidéo, 720 p au plus, en MP4 avec son son, sans configuration ni cache ni cookie. */
export function argumentsYtdlp(lien, sortie) {
  const nodeRecent = Number(process.versions.node.split('.')[0]) >= 22;
  return ['--ignore-config', '--no-playlist', '--no-progress', '--no-cache-dir', '--no-cookies', '-S', 'res:720,ext:mp4:m4a',
    '--merge-output-format', 'mp4', '--remux-video', 'mp4', '--max-filesize', '500M',
    ...(path.isAbsolute(FFMPEG) ? ['--ffmpeg-location', FFMPEG] : []),
    // YouTube demande un moteur JavaScript : celui de Dérush, s'il est assez récent
    ...(nodeRecent ? ['--js-runtimes', `node:${process.execPath}`] : []),
    '-o', sortie, '--print', 'after_move:filepath', lien];
}

/** Une erreur de yt-dlp, dite simplement. */
export function erreurLien(texte) {
  const t = String(texte ?? '');
  if (/log ?in|sign in|rate-limit|restricted|private|not available|confirm you.re not a bot|age/i.test(t)) return 'Cette vidéo demande d’être connecté pour la voir (souvent sur Instagram ou TikTok) : enregistre-la depuis l’appli, ou filme l’écran, puis glisse le fichier ici.';
  if (/unsupported url|is not a valid url/i.test(t)) return 'Ce lien ne mène pas à une vidéo : copie le lien de la vidéo elle-même (« Partager › Copier le lien »).';
  if (/max-filesize|larger than max/i.test(t)) return 'Cette vidéo est trop lourde pour une référence (500 Mo au plus) : prends un extrait.';
  return `Le lien n’a pas pu être téléchargé : ${t.trim().split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 200) ?? 'raison inconnue'}.`;
}

/**
 * Télécharge la vidéo d'un lien dans le projet (claude/references-liens/) et la joint à la conversation comme référence.
 * Renvoie la pièce jointe. Sur un clic de la personne seulement.
 */
export async function joindreReference(P, lien, {lanceur = null} = {}) {
  let u;
  try { u = new URL(String(lien ?? '').trim()); } catch { throw new Error('Ce n’est pas un lien.'); }
  if (u.protocol !== 'https:' || !SITES.test(u.hostname)) throw new Error('Seuls les liens de TikTok, Instagram et YouTube servent de référence.');
  if (!lanceur && !etatYtdlp().ok) await installerYtdlp();
  const dossier = path.join(P.racine, 'claude', 'references-liens');
  fs.mkdirSync(dossier, {recursive: true});
  const site = /tiktok/i.test(u.hostname) ? 'tiktok' : /instagram/i.test(u.hostname) ? 'instagram' : 'youtube';
  const modele = path.join(dossier, `reference-${site}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.%(ext)s`);
  const env = {PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', LANG: 'fr_FR.UTF-8'};
  let out = '';
  try {
    ({out} = await lancer(lanceur ?? cheminYtdlp(), argumentsYtdlp(u.toString(), modele), {env, dureeMax: 10 * 60e3, silenceMax: 3 * 60e3}));
  } catch (e) { throw new Error(erreurLien(e.message)); }
  const fichier = String(out).trim().split('\n').map((l) => l.trim()).filter(Boolean).reverse().find((l) => fs.existsSync(l) && l.startsWith(dossier));
  if (!fichier) throw new Error(erreurLien(out));
  const r = ajouterPieces(P, [fichier]);
  if (!r.ajoutees.length) throw new Error(r.erreurs[0] ?? 'La vidéo n’a pas pu être jointe.');
  return r.ajoutees[0];
}
