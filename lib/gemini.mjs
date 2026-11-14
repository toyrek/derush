// Dérush — Gemini (la commande « agy » d'Antigravity) : ce que son bac à sable a le droit de voir et de faire.
// Écrit d'après de vrais essais (agy 1.5.6, novembre 2026) et la documentation officielle (antigravity.google/docs,
// pages « permissions » et « sandbox ») :
//   - sans écran (« agy -p »), une permission qu'il faudrait demander est refusée, même pour écrire dans le dossier de
//     travail. Dérush donne donc ses permissions à chaque demande, par « --settings » : des réglages pour cette session
//     seulement, jamais enregistrés dans ceux d'agy ;
//   - « proceed-in-sandbox » : les commandes tournent dans le bac à sable sans question, et une commande qui voudrait en
//     sortir est refusée (personne n'est là pour dire oui). Sans bac à sable sur la machine, aucune commande ne tourne ;
//   - le bac à sable ne lit que le dossier de travail, le système, et ce qu'une règle read_file(...) lui ouvre : sans
//     elle, même « node » ou « ffmpeg » ne se lancent pas. Dérush ouvre donc ses outils, et rien d'autre du dossier
//     personnel ;
//   - le réseau des commandes passe par un relais du bac à sable (HTTPS_PROXY…), qui ne laisse sortir que vers les
//     sites permis par read_url(...) et jamais vers une adresse de l'ordinateur lui-même : le rendu passe donc par la
//     « boîte » du relais de Dérush (des fichiers, voir lib/relais.mjs), pas par son adresse locale.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RACINE_APP, DOSSIER_SUPPORT, PYTHON} from './moteurs.mjs';
import {DOSSIER_COMMANDES, DOSSIER_TELECHARGE} from './competences.mjs';
import {dossierMoteurRendu} from './rendu.mjs';
import {FFMPEG, FFPROBE} from './outils.mjs';
import {trouver} from './plateforme.mjs';

const reel = (f) => { try { return fs.realpathSync(f); } catch { return null; } };
/** f est-il le dossier d, ou dedans ? */
const dedans = (d, f) => f === d || f.startsWith(d.endsWith(path.sep) ? d : d + path.sep);
const estDossier = (f) => { try { return fs.statSync(f).isDirectory(); } catch { return false; } };

/**
 * Ce qu'il faut rendre lisible pour qu'un programme se lance dans le bac à sable : son installation, et jamais plus
 * large (ni le dossier personnel, ni un dossier « bin » personnel où traînent d'autres commandes, ni le Bureau ou les
 * Téléchargements où un programme a été posé tel quel). Un nom nu (« ffmpeg ») est cherché dans le PATH ; un lien est
 * suivi jusqu'au vrai fichier.
 */
export function racineOutil(chemin, maison = os.homedir()) {
  if (!chemin) return [];
  const f = reel(path.isAbsolute(chemin) ? chemin : (trouver(chemin) ?? ''));
  if (!f) return [];
  const M = reel(maison) ?? maison;
  // un programme rangé dans une application Mac : l'application entière
  const app = /^(.+?\.app)(?=[\\/])/.exec(f)?.[1];
  if (app) return [app];
  const dossier = path.dirname(f);
  const bin = /^(bin|Scripts)$/.test(path.basename(dossier));
  if (!dedans(M, f)) {
    // hors du dossier personnel : le système est déjà lisible ; un préfixe d'outils (Homebrew, /usr/local) l'est en entier
    for (const p of ['/opt/homebrew', '/usr/local', '/opt/local']) if (dedans(p, f)) return [p];
    if (/^\/(usr|bin|sbin|System)\//.test(f)) return [];
    const racine = bin ? path.dirname(dossier) : dossier;
    return racine === path.parse(racine).root || dedans(racine, M) ? [f] : [racine];
  }
  // dans le dossier personnel
  if (!bin) {
    if (dossier === M) return [f];
    // un dossier posé directement dans le dossier personnel : le Bureau ou les Téléchargements ne s'ouvrent jamais en
    // entier pour un programme qui y traîne (ce programme seul) ; seule une installation rangée là sous le nom du
    // programme (~/blender-4.5-linux-x64/blender, ~/ffmpeg/ffmpeg) est ouverte avec ce qui l'accompagne
    if (path.dirname(dossier) === M) {
      const nom = path.basename(f).replace(/\.[a-z0-9]+$/i, '').toLowerCase();
      const range = path.basename(dossier).toLowerCase();
      return nom.length > 1 && range.startsWith(nom) && !/^\p{L}/u.test(range.slice(nom.length)) ? [dossier] : [f];
    }
    return [dossier];
  }
  const racine = path.dirname(dossier); // …/bin/programme : l'installation est au-dessus de bin
  if (racine === M || racine === path.join(M, '.local')) return [f]; // ~/bin, ~/.local/bin : fourre-tout, ce programme seul
  // un dossier posé directement dans le dossier personnel (~/.cargo, ~/miniconda3…) peut garder autre chose que
  // l'outil : seulement ses programmes et ses bibliothèques
  if (path.dirname(racine) === M) return [dossier, path.join(racine, 'lib')].filter((d) => fs.existsSync(d));
  return [racine];
}

/**
 * Tout ce que le bac à sable de Gemini doit pouvoir lire pour que les outils de Dérush s'y lancent : l'app (ses
 * commandes, ses compétences), les lanceurs, Python et le moteur de rendu, Node et FFmpeg. `extra` : d'autres dossiers
 * (donnés tels quels) ou programmes (leur installation), par exemple Blender ou Earshot.
 */
export function outilsLisibles(extra = []) {
  const l = [
    RACINE_APP, DOSSIER_COMMANDES, DOSSIER_TELECHARGE,
    path.join(DOSSIER_SUPPORT, 'moteurs'), dossierMoteurRendu(), path.join(DOSSIER_SUPPORT, 'node_modules'),
    ...racineOutil(process.execPath), ...racineOutil(FFMPEG), ...racineOutil(FFPROBE), ...racineOutil(PYTHON),
    ...extra.filter(Boolean).flatMap((x) => (estDossier(x) ? [x] : racineOutil(x))),
  ];
  return [...new Set(l.filter((d) => d && fs.existsSync(d)))];
}

/**
 * Les réglages donnés à agy pour UNE demande (« --settings ») : où il peut écrire (le dossier de travail et ce que
 * Dérush y ajoute), ce qu'il peut lire en plus (les outils, ce que l'humain a donné), ce qu'il ne lit jamais (les
 * fichiers de clés), et le web (`web` : les commandes et l'IA peuvent lire n'importe quel site, comme avec Codex).
 * Chaque dossier est donné sous son nom et sous son vrai chemin (un lien, /tmp → /private/tmp…).
 */
export function reglagesGemini({ecrits = [], lus = [], interdits = [], web = true} = {}) {
  const tous = (l) => {
    const v = [];
    for (const d of l) {
      if (!d) continue;
      for (const x of [path.resolve(d), reel(d)]) if (x && !v.includes(x)) v.push(x);
    }
    return v;
  };
  const sansDoublon = (l) => l.filter((d) => !l.some((o) => o !== d && dedans(o, d)));
  const E = sansDoublon(tous(ecrits));
  const L = sansDoublon(tous(lus)).filter((d) => !E.some((e) => dedans(e, d))); // écrire dans un dossier, c'est aussi le lire
  const I = tous([path.join(DOSSIER_SUPPORT, '.env.local'), path.join(DOSSIER_SUPPORT, '.env'), path.join(RACINE_APP, '.env.local'), path.join(RACINE_APP, '.env'), ...interdits]);
  return {
    toolPermission: 'proceed-in-sandbox',
    enableTerminalSandbox: true,
    permissions: {
      allow: [...E.map((d) => `write_file(${d})`), ...L.map((d) => `read_file(${d})`), ...(web ? ['read_url(*)'] : [])],
      deny: I.flatMap((d) => [`read_file(${d})`, `write_file(${d})`]),
    },
  };
}

/**
 * L'environnement en plus pour les commandes lancées dans le bac à sable de Gemini : Node (≥ 22.21) passe alors par le
 * relais réseau du bac à sable, comme curl et Python le font tout seuls ; sans cela, « fetch » n'y trouve aucun site.
 */
export function envGemini(env = {}) {
  const options = String(env.NODE_OPTIONS ?? '');
  return {NODE_USE_ENV_PROXY: '1', NODE_OPTIONS: /UNDICI-EHPA/.test(options) ? options : `${options} --disable-warning=UNDICI-EHPA`.trim()};
}
