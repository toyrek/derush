// Dérush — envoyer une vidéo sur YouTube avec Treg.
//
// Pourquoi ce module : YouTube ouvre l'envoi d'une vidéo en deux temps. On lui donne d'abord le titre, la description et
// la visibilité ; il répond par une adresse d'envoi, rangée dans un EN-TÊTE de sa réponse (Location). On y dépose ensuite
// le fichier. Les outils que Treg donne à une IA (son connecteur) ne montrent pas les en-têtes : l'IA ouvrait donc
// l'envoi, ne recevait jamais l'adresse, et rien n'était publié (essai réel du 12 novembre 2026). La porte directe de
// Treg (https://treg.to/call/…, avec la clé Treg de la personne), elle, relaie la réponse de YouTube telle quelle.
//
// Ce module fait donc l'envoi lui-même, sans IA : ouverture par la porte directe de Treg (la clé reste dans Dérush, Treg
// ajoute l'autorisation YouTube de son côté), puis dépôt du fichier directement chez YouTube, repris là où il s'est
// arrêté si la connexion tombe. Il sert à la commande « derush-youtube » (outils/publier-youtube.mjs) et au relais de
// Codex (lib/relais.mjs).
//
// Trois garde-fous, parce qu'un envoi coûte cher (environ six par jour, pour tous les comptes reliés à Treg) :
// - une vidéo déjà envoyée n'est pas envoyée une seconde fois (journal du projet : .derush/youtube-envois.json) ;
// - chaque refus dit qui refuse (Treg ou YouTube) et quoi faire, en mots simples ;
// - après l'envoi, Dérush redemande à YouTube où en est la vidéo : YouTube garde en « privé » les vidéos envoyées par
//   une application qu'il n'a pas encore auditée, quoi qu'on lui demande. Si c'est le cas, on le dit.
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

export const BASE_TREG = (process.env.DERUSH_TREG_BASE || 'https://treg.to').replace(/\/+$/, '');
const VISIBILITES = ['unlisted', 'public', 'private'];
const NOM_VISIBILITE = {unlisted: 'non répertoriée', public: 'publique', private: 'privée'};

/** Une erreur dite simplement, avec une raison que l'appelant peut reconnaître. */
class ErreurYouTube extends Error {
  constructor(raison, message) { super(message); this.raison = raison; }
}

/** Vérifie et range ce qu'on veut publier. Lève une erreur claire si quelque chose manque. */
export function preparerEnvoi({fichier, titre, description = '', tags = [], visibilite = 'unlisted', pourEnfants = false, synthetique = false, notifier = true} = {}) {
  const f = path.resolve(String(fichier ?? ''));
  let taille = 0;
  try { const st = fs.statSync(f); if (!st.isFile()) throw new Error('pas un fichier'); taille = st.size; } catch { throw new ErreurYouTube('fichier', `Vidéo introuvable : ${path.basename(f)}.`); }
  if (!/\.(mp4|mov|m4v|webm)$/i.test(f)) throw new ErreurYouTube('fichier', 'YouTube attend une vidéo (.mp4 de préférence).');
  if (!taille) throw new ErreurYouTube('fichier', 'Cette vidéo est vide.');
  const t = String(titre ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  if (!t) throw new ErreurYouTube('titre', 'Il faut un titre (100 caractères au plus).');
  if (t.length > 100) throw new ErreurYouTube('titre', `Le titre fait ${t.length} caractères : YouTube en accepte 100 au plus.`);
  const d = String(description ?? '').replace(/[<>]/g, '').replace(/\r/g, '').trim();
  if (d.length > 5000) throw new ErreurYouTube('description', `La description fait ${d.length} caractères : YouTube en accepte 5 000 au plus.`);
  if (!VISIBILITES.includes(visibilite)) throw new ErreurYouTube('visibilite', 'La visibilité doit être unlisted (non répertoriée), public ou private.');
  const liste = (Array.isArray(tags) ? tags : String(tags ?? '').split(',')).map((x) => String(x).replace(/^#+/, '').replace(/[<>,]/g, '').trim()).filter(Boolean);
  // YouTube compte 500 caractères de mots-clés en tout
  const gardes = [];
  let total = 0;
  for (const x of liste) { if (total + x.length + 1 > 480) break; gardes.push(x); total += x.length + 1; }
  return {fichier: f, taille, titre: t, description: d, tags: gardes, visibilite, pourEnfants: !!pourEnfants, synthetique: !!synthetique, notifier: notifier !== false};
}

// ——— Le journal des envois : une vidéo ne part pas deux fois ———
/** Le journal du projet qui contient cette vidéo (<projet>/.derush/youtube-envois.json), ou null hors d'un projet. */
function fichierJournal(fichier) {
  let dossier = path.dirname(fichier);
  for (let i = 0; i < 5; i++) {
    try { if (fs.statSync(path.join(dossier, '.derush')).isDirectory() && fs.existsSync(path.join(dossier, 'derush.json'))) return path.join(dossier, '.derush', 'youtube-envois.json'); } catch { /* pas ici */ }
    const parent = path.dirname(dossier);
    if (parent === dossier) break;
    dossier = parent;
  }
  return null;
}
const cleEnvoi = (d) => { let m = 0; try { m = Math.round(fs.statSync(d.fichier).mtimeMs); } catch { /* fichier parti */ } return `${path.basename(d.fichier)}|${d.taille}|${m}`; };
const lireJournal = (f) => { try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; } };
/** Ce fichier précis a-t-il déjà été envoyé sur YouTube ? Renvoie {id, lien, lien_short, visibilite, titre, le} ou null. */
export function dejaEnvoyee(demande) {
  const f = fichierJournal(demande.fichier);
  const e = f ? lireJournal(f)[cleEnvoi(demande)] : null;
  return e?.id ? e : null;
}
function noterEnvoi(demande, resultat) {
  const f = fichierJournal(demande.fichier);
  if (!f) return;
  try {
    const j = lireJournal(f);
    j[cleEnvoi(demande)] = {id: resultat.id, lien: resultat.lien, lien_short: resultat.lien_short, visibilite: resultat.visibilite, titre: resultat.titre, le: new Date().toISOString()};
    fs.writeFileSync(f, `${JSON.stringify(j, null, 2)}\n`);
  } catch { /* dossier en lecture seule : l'envoi est fait, seul le journal manque */ }
}

// ——— Les requêtes ———
/** Une requête HTTP simple (http ou https), dont le corps peut être un morceau de fichier. Renvoie {statut, entetes, corps}. */
function requete(adresse, {methode = 'GET', entetes = {}, corps = null, flux = null, delaiMs = 120000, surEnvoi = null} = {}) {
  return new Promise((ok, ko) => {
    const u = new URL(adresse);
    const r = (u.protocol === 'http:' ? http : https).request(u, {method: methode, headers: entetes}, (res) => {
      const morceaux = [];
      res.on('data', (d) => morceaux.push(d));
      res.on('end', () => {
        // une réponse arrivée avant la fin du dépôt (un refus) : on arrête d'envoyer le fichier
        if (flux && !flux.readableEnded) { flux.destroy(); r.destroy(); }
        ok({statut: res.statusCode ?? 0, entetes: res.headers, corps: Buffer.concat(morceaux).toString('utf8')});
      });
      res.on('error', (e) => { flux?.destroy(); ko(e); });
    });
    r.setTimeout(delaiMs, () => r.destroy(new Error('pas de réponse')));
    r.on('error', (e) => { flux?.destroy(); ko(e); });
    if (flux) {
      flux.on('data', (d) => surEnvoi?.(d.length));
      flux.on('error', (e) => r.destroy(e));
      flux.pipe(r);
    } else r.end(corps ?? undefined);
  });
}
const extrait = (texte) => String(texte ?? '').replace(/\s+/g, ' ').trim().slice(0, 260);
/** Le message d'erreur de YouTube ou de Treg, quand la réponse en porte un. */
function messageDe(corps) {
  try {
    const j = JSON.parse(corps);
    const m = j?.error?.message ?? j?.detail ?? j?.message ?? j?.hint ?? corps;
    return extrait(typeof m === 'string' ? m : JSON.stringify(m));
  } catch { return extrait(corps); }
}
/** Treg marque ses propres refus d'un en-tête ; sans lui, c'est YouTube qui a répondu et Treg a relayé. */
const deTreg = (r) => !!r.entetes['x-treg-error'];

/** Pourquoi l'envoi n'a pas pu s'ouvrir, dit simplement, avec ce qu'il faut faire. */
function refusOuverture(r) {
  const detail = messageDe(r.corps).replace(/[.\s]+$/, '');
  if (deTreg(r)) {
    if (r.statut === 401) return new ErreurYouTube('cle_refusee', 'Treg ne reconnaît pas ta clé. Copie-la de nouveau depuis ton compte Treg (Connexions › Treg › « Relier mes réseaux »).');
    if (r.statut === 404 && /credential|connect/i.test(r.corps)) return new ErreurYouTube('youtube_non_relie', 'YouTube n’est pas relié à ton compte Treg. Ouvre treg.to, relie YouTube avec le droit de publier, puis réessaie.');
    if (r.statut === 429) return new ErreurYouTube('treg', `Treg demande de ralentir : ${detail || 'trop d’appels'}. Réessaie dans quelques minutes.`);
    return new ErreurYouTube('treg', `Treg a refusé d’ouvrir l’envoi (réponse ${r.statut}) : ${detail || 'pas de détail'}.`);
  }
  if (r.statut === 429 || /quotaExceeded|dailyLimitExceeded|rateLimitExceeded/i.test(r.corps)) return new ErreurYouTube('quota', 'Le quota d’envois de YouTube est atteint pour aujourd’hui (environ six vidéos par jour, pour tous les comptes reliés à Treg). Réessaie demain.');
  if (/uploadLimitExceeded/i.test(r.corps)) return new ErreurYouTube('quota', 'Ta chaîne YouTube a atteint sa limite d’envois pour aujourd’hui. Réessaie demain.');
  if (/youtubeSignupRequired/i.test(r.corps)) return new ErreurYouTube('youtube_non_relie', 'Ce compte Google n’a pas encore de chaîne YouTube. Crée la chaîne sur youtube.com, puis réessaie.');
  if (r.statut === 401) return new ErreurYouTube('youtube_non_relie', 'La liaison entre Treg et YouTube a expiré. Relie YouTube de nouveau sur treg.to, puis réessaie.');
  if (r.statut === 403) return new ErreurYouTube('youtube_non_relie', `YouTube refuse l’envoi : ${detail || 'ta chaîne n’est pas reliée à Treg avec le droit de publier'}. Relie YouTube dans Treg (avec le droit de publier), puis réessaie.`);
  return new ErreurYouTube('envoi', `YouTube n’a pas ouvert l’envoi (réponse ${r.statut}) : ${detail || 'pas de détail'}.`);
}

/**
 * Où en est la vidéo chez YouTube, une fois envoyée (un appel de lecture, presque gratuit). Renvoie
 * {visibilite, etat, refus} ou null si YouTube ne le dit pas : l'envoi reste bon, on ne sait juste pas mieux.
 */
async function etatChezYouTube(id, {cle, base}) {
  for (let essai = 1; essai <= 2; essai++) {
    try {
      const r = await requete(`${base}/call/youtube.youtube.video.detail?${new URLSearchParams({part: 'status', id})}`, {entetes: {'X-Treg-Token': cle, Accept: 'application/json'}, delaiMs: 20000});
      if (r.statut === 200) {
        const s = JSON.parse(r.corps)?.items?.[0]?.status;
        if (s) return {visibilite: s.privacyStatus ?? null, etat: s.uploadStatus ?? null, refus: s.rejectionReason ?? s.failureReason ?? null};
      } else if (r.statut < 500) return null; // un refus net : inutile d'insister
    } catch { /* on réessaie une fois */ }
    await new Promise((ok) => setTimeout(ok, 2500));
  }
  return null;
}
const REFUS_YOUTUBE = {duplicate: 'YouTube dit qu’elle existe déjà sur ta chaîne (doublon)', length: 'YouTube la trouve trop longue', copyright: 'YouTube y voit un contenu protégé par le droit d’auteur',
  inappropriate: 'YouTube la juge inappropriée', termsOfUse: 'YouTube y voit une infraction à ses règles', uploaderAccountSuspended: 'la chaîne est suspendue', claim: 'un ayant droit la revendique'};

/**
 * Envoie la vidéo. `demande` vient de preparerEnvoi(). Options : `cle` (la clé Treg), `base` (l'adresse de Treg),
 * `surAvance(0..1)`, `encore` (renvoyer une vidéo déjà envoyée). Renvoie {id, lien, lien_short, visibilite, titre}, avec
 * `deja: true` si ce fichier avait déjà été envoyé, et `note` quand il y a quelque chose à dire à l'humain (YouTube l'a
 * gardée en privé, par exemple). Lève une ErreurYouTube (avec .raison) sinon : cle_manquante, cle_refusee,
 * youtube_non_relie, quota, treg, envoi.
 */
export async function envoyerSurYouTube(demande, {cle = process.env.TREG_TOKEN, base = BASE_TREG, surAvance = null, encore = false} = {}) {
  const d = demande;
  if (!encore) {
    const avant = dejaEnvoyee(d);
    if (avant) {
      const quand = new Date(avant.le).toLocaleString('fr-FR', {day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'});
      return {id: avant.id, lien: avant.lien, lien_short: avant.lien_short, visibilite: avant.visibilite, titre: avant.titre, deja: true,
        note: `Cette vidéo est déjà sur YouTube (envoyée le ${quand}) : Dérush ne l’a pas envoyée une seconde fois.`};
    }
  }
  if (!cle) throw new ErreurYouTube('cle_manquante', 'Il n’y a pas de clé Treg dans Dérush. Pour YouTube, le connecteur Treg du compte Claude ne suffit pas : ouvre Connexions › Treg › « Relier mes réseaux » et colle ta clé.');
  // 1. ouvrir l'envoi : le titre, la description, la visibilité. Treg ajoute l'autorisation YouTube de son côté.
  const question = new URLSearchParams({part: 'id,snippet,status', uploadType: 'resumable', ...(d.notifier ? {} : {notifySubscribers: 'false'})});
  const corps = JSON.stringify({
    snippet: {title: d.titre, description: d.description, tags: d.tags, categoryId: '22'},
    status: {privacyStatus: d.visibilite, selfDeclaredMadeForKids: d.pourEnfants, ...(d.synthetique ? {containsSyntheticMedia: true} : {})},
  });
  let ouverture;
  try {
    ouverture = await requete(`${base}/call/youtube.youtube.video.upload?${question}`, {methode: 'POST', corps,
      entetes: {'X-Treg-Token': cle, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corps), 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(d.taille)}});
  } catch (e) {
    throw new ErreurYouTube('treg', `Treg ne répond pas (${extrait(e.message)}). Vérifie ta connexion à Internet, puis réessaie.`);
  }
  if (ouverture.statut < 200 || ouverture.statut >= 300) throw refusOuverture(ouverture);
  const adresse = ouverture.entetes.location;
  if (!adresse || !/^https?:\/\//.test(adresse)) throw new ErreurYouTube('treg', 'YouTube a ouvert l’envoi, mais l’adresse d’envoi n’est pas revenue par Treg. Rien n’est publié.');

  // 2. déposer le fichier chez YouTube, directement ; en cas de coupure, on reprend où il s'est arrêté. Si YouTube
  //    réclame l'autorisation pour le dépôt (401 ou 403), on le fait passer par Treg, qui l'ajoute.
  let parTreg = false;
  const cible = () => (parTreg ? `${base}/call/${adresse}` : adresse);
  const plus = () => (parTreg ? {'X-Treg-Token': cle} : {});
  let depart = 0;
  let envoyes = 0;
  let dernier = null;
  let refusDepot = null;
  for (let essai = 1; essai <= 5; essai++) {
    if (essai > 1) {
      // où en est YouTube ? (308 + Range : il a reçu les octets 0 à N)
      try {
        const etat = await requete(cible(), {methode: 'PUT', entetes: {...plus(), 'Content-Length': '0', 'Content-Range': `bytes */${d.taille}`}, delaiMs: 30000});
        if (etat.statut === 200 || etat.statut === 201) { dernier = etat; break; }
        if (etat.statut !== 308) {
          if ((etat.statut === 401 || etat.statut === 403) && !parTreg) { parTreg = true; continue; }
          throw new ErreurYouTube('envoi', `L’envoi a été interrompu et YouTube ne veut pas le reprendre (réponse ${etat.statut}). ${messageDe(etat.corps)}`.trim());
        }
        const recu = /bytes=0-(\d+)/.exec(String(etat.entetes.range ?? ''));
        depart = recu ? Number(recu[1]) + 1 : 0;
      } catch (e) {
        if (e instanceof ErreurYouTube) throw e;
        await new Promise((ok) => setTimeout(ok, 1500 * essai));
        continue;
      }
    }
    envoyes = depart;
    try {
      dernier = await requete(cible(), {
        methode: 'PUT', delaiMs: 600000,
        entetes: {...plus(), 'Content-Type': 'video/mp4', 'Content-Length': String(d.taille - depart), ...(depart ? {'Content-Range': `bytes ${depart}-${d.taille - 1}/${d.taille}`} : {})},
        flux: fs.createReadStream(d.fichier, {start: depart}),
        surEnvoi: (n) => { envoyes += n; surAvance?.(Math.min(0.99, envoyes / d.taille)); },
      });
    } catch { dernier = null; await new Promise((ok) => setTimeout(ok, 1000 * essai)); continue; }
    if (dernier.statut === 200 || dernier.statut === 201) break;
    if (dernier.statut >= 500 || dernier.statut === 308) continue; // YouTube demande de reprendre
    if ((dernier.statut === 401 || dernier.statut === 403) && !parTreg) { refusDepot = dernier; parTreg = true; continue; }
    throw new ErreurYouTube('envoi', `YouTube a refusé la vidéo (réponse ${dernier.statut}${parTreg ? ', en passant par Treg' : ''}) : ${messageDe(dernier.corps) || messageDe(refusDepot?.corps) || 'pas de détail'}.`);
  }
  if (!dernier || (dernier.statut !== 200 && dernier.statut !== 201)) throw new ErreurYouTube('envoi', 'La vidéo n’est pas arrivée entière chez YouTube malgré plusieurs reprises. Rien n’est publié : réessaie quand la connexion est meilleure.');
  let reponse = {};
  try { reponse = JSON.parse(dernier.corps); } catch { /* réponse sans JSON */ }
  if (!reponse.id) throw new ErreurYouTube('envoi', `YouTube a reçu la vidéo mais n’a pas rendu son identifiant : ${extrait(dernier.corps) || 'réponse vide'}. Regarde dans YouTube Studio si elle y est.`);
  surAvance?.(1);

  // 3. ce que YouTube en a fait : la visibilité réelle, et un refus éventuel
  const resultat = {id: reponse.id, lien: `https://youtu.be/${reponse.id}`, lien_short: `https://youtube.com/shorts/${reponse.id}`,
    visibilite: reponse.status?.privacyStatus ?? d.visibilite, titre: reponse.snippet?.title ?? d.titre};
  const vu = await etatChezYouTube(reponse.id, {cle, base});
  if (vu?.visibilite) resultat.visibilite = vu.visibilite;
  const notes = [];
  if (resultat.visibilite !== d.visibilite) {
    notes.push(resultat.visibilite === 'private'
      ? `YouTube a gardé la vidéo en privé au lieu de « ${NOM_VISIBILITE[d.visibilite]} ». C’est ce qu’il fait pour les applications qu’il n’a pas encore auditées (ici Treg). Elle est bien sur ta chaîne : ouvre YouTube Studio pour changer sa visibilité ; si elle y est « privée (verrouillée) », mets plutôt le fichier en ligne toi-même depuis YouTube.`
      : `YouTube a mis la vidéo en « ${NOM_VISIBILITE[resultat.visibilite] ?? resultat.visibilite} » au lieu de « ${NOM_VISIBILITE[d.visibilite]} ».`);
  }
  if (vu?.etat === 'rejected' || vu?.etat === 'failed') notes.push(`YouTube a reçu la vidéo mais ne l’a pas acceptée : ${REFUS_YOUTUBE[vu.refus] ?? vu.refus ?? 'il ne dit pas pourquoi'}. Regarde dans YouTube Studio.`);
  if (notes.length) resultat.note = notes.join(' ');
  noterEnvoi(d, resultat);
  return resultat;
}
