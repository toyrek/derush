// Dérush — ce que l'IA fait pour l'apprentissage, hors de la conversation de montage (lib/conseil.mjs), toujours à la
// demande de la personne (un clic dans le tableau de bord), jamais tout seul :
//   1. la recette qui marche d'un espace, en mots, avec des idées de sujets : l'IA lit les fiches des montages, leurs
//      vues, les chiffres de la recette (lib/recette.mjs), le profil ou la marque, et cherche les tendances du moment ;
//   2. les chiffres que la porte directe de Treg ne donne pas (Instagram, ou tout réseau sans la clé Treg) : l'IA les
//      lit avec Treg, en lecture seule, et Dérush les range dans le suivi (lib/suivi.mjs).
// Chaque fois dans un dossier à part (espaces/<id>/analyse-…) : lancerConseil y écrase ses consignes et ses liens.
import fs from 'node:fs';
import path from 'node:path';
import {ecrireJson} from './outils.mjs';
import {lancerConseil, etatConseil, oublierConseil, arreterConseil} from './conseil.mjs';
import {trouverEspace, apprend, dossierEspace, espaceEnTexte, METIERS} from './espaces.mjs';
import {lireFiches} from './fiches.mjs';
import {lireSuivi, rangerChiffresIA, publicationsAvecChiffres} from './suivi.mjs';
import {statistiques, lireRecette, ecrireRecette, medianesDuProfil} from './recette.mjs';
import {peutAnalyser, lireProfil, profilEnTexte} from './createur.mjs';
import {etatIA} from './ia.mjs';

const texte = (v, n) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n));
const long = (v, n) => (v == null ? '' : String(v).replace(/\r/g, '').trim().slice(0, n));
const liste = (v, max, f) => (Array.isArray(v) ? v : []).map(f).filter(Boolean).slice(0, max);

// les réseaux qu'une recette peut nommer dans « quand publier » (ceux dont l'interface a le logo) : le reste, texte
// libre écrit par l'IA, n'entre pas dans recette.json
const RESEAUX_RECETTE = ['tiktok', 'youtube', 'instagram', 'linkedin', 'facebook', 'x'];

const COMPETENCES_RECETTE =['analytics-and-reporting', 'content-pillars', 'viral-reverse-engineering', 'idea-generation-and-ideation', 'trend-jacking', 'viral-short-form-ideas', 'derush-viralite', 'yt-audit', 'ig-audit', 'brand-profile'];

/** Nettoie la recette rendue par l'IA ; lève une erreur si elle est vide. */
export function validerRecette(r) {
  if (!r || typeof r !== 'object') throw new Error('La recette rendue est illisible.');
  const quoi = (x) => (x && texte(x.quoi, 10) ? {quoi: texte(x.quoi, 240), preuve: texte(x.preuve, 200) || null} : null);
  const out = {
    resume: long(r.resume, 800),
    ca_marche: liste(r.ca_marche, 6, quoi),
    a_eviter: liste(r.a_eviter, 5, quoi),
    a_essayer: liste(r.a_essayer, 5, (x) => (x && texte(x.quoi, 10) ? {quoi: texte(x.quoi, 240), pourquoi: texte(x.pourquoi, 200) || null} : null)),
    sujets_qui_plaisent: liste(r.sujets_qui_plaisent, 6, (x) => texte(x, 160) || null),
    idees: liste(r.idees, 8, (x) => (x && texte(x.sujet, 6) ? {sujet: texte(x.sujet, 160), pourquoi: texte(x.pourquoi, 300) || null, format: texte(x.format, 120) || null, accroche: texte(x.accroche, 160) || null, source: /^https:\/\/[^\s"<>]+$/.test(String(x.source ?? '')) ? String(x.source).slice(0, 400) : null} : null)),
    prochaine_video: r.prochaine_video && texte(r.prochaine_video.sujet, 6) ? {sujet: texte(r.prochaine_video.sujet, 160), pourquoi: texte(r.prochaine_video.pourquoi, 300) || null, accroche: texte(r.prochaine_video.accroche, 160) || null, duree: texte(r.prochaine_video.duree, 40) || null} : null,
    quand_publier: liste(r.quand_publier, 5, (x) => {
      const reseau = x ? texte(x.reseau, 20).toLowerCase() : '';
      return RESEAUX_RECETTE.includes(reseau) ? {reseau, quand: texte(x.quand, 80), pourquoi: texte(x.pourquoi, 200) || null} : null;
    }),
    limites: texte(r.limites, 500) || null,
  };
  if (!out.resume && !out.ca_marche.length && !out.idees.length) throw new Error('La recette rendue est vide.');
  return out;
}

const REGLES_RECETTE = `Tu es lancé par Dérush, un logiciel de montage vidéo, pour dire à une personne ce qui marche dans ses vidéos, et quoi faire ensuite.
- Tout ce que tu sais est dans ce dossier : donnees/statistiques.json (chaque trait de montage, combien de vidéos l'ont, leur « multiple » médian = vues ÷ médiane du compte ; 3 = un vrai succès), donnees/fiches.json (chaque montage livré : durée, accroche, musique, habillage, rythme, voix, note 👍/👎 et mot de la personne), donnees/publications.json (les vues), et ESPACE.md / profil.md (pour qui, son métier, sa marque ou son profil).
- N'invente aucun chiffre. Une affirmation sur ce qui marche cite sa preuve (« 3 vidéos, 2,4 fois la médiane »). Avec moins de 3 exemples, c'est « à essayer », jamais « ça marche ». Corrélation n'est pas cause : dis-le quand c'est douteux.
- Les idées de sujets viennent du métier, de ce qui a déjà plu, et de l'actualité de la niche : cherche sur le web les sorties et les tendances de la semaine (source et date pour chaque idée tirée de l'actualité).
- Ouvre d'abord les compétences reliées utiles (analytics-and-reporting, content-pillars, idea-generation-and-ideation, trend-jacking…).
- Écris en français simple, en tutoyant. L'humain ne peut pas te répondre : va jusqu'au bout, et dis dans « limites » ce qui manque (peu de vidéos publiées, réseau non lu…).
- Réponds dans recette.json, exactement :
{"resume": "3 phrases : où en est cet espace, ce qui marche, ce qu'il faut faire ensuite",
 "ca_marche": [{"quoi": "…", "preuve": "…"}], "a_eviter": [{"quoi": "…", "preuve": "…"}], "a_essayer": [{"quoi": "…", "pourquoi": "…"}],
 "sujets_qui_plaisent": ["…"], "idees": [{"sujet": "…", "pourquoi": "…", "format": "durée, réseau, genre", "accroche": "les 2 premières secondes", "source": "https://… (si actualité)"}],
 "prochaine_video": {"sujet": "…", "pourquoi": "…", "accroche": "…", "duree": "…"},
 "quand_publier": [{"reseau": "tiktok", "quand": "jour et heure", "pourquoi": "d'après les dates de ses vidéos qui ont le mieux marché"}],
 "limites": "…"}`;

const cleRecette = (id) => `recette:${id}`;
const cleLecture = (id) => `suivi:${id}`;

/** Lance l'analyse de la recette d'un espace (une à la fois par espace). */
export async function lancerAnalyseRecette(espaceId, {moteur = null} = {}) {
  const e = trouverEspace(espaceId);
  if (!apprend(e)) throw new Error('Cet espace n’apprend pas : rien à analyser.');
  const cle = cleRecette(e.id);
  if (etatConseil(cle)?.etat === 'en_cours') return;
  const fiches = lireFiches(e.id);
  if (!fiches.length) throw new Error('Aucun montage livré dans cet espace pour l’instant : la recette se fait à partir de tes montages.');
  const etats = await etatIA();
  const m = etats[moteur]?.ok ? moteur : etats.choisi;
  if (!etats[m]?.ok) throw new Error('Branche d’abord ton IA (Connexions).');
  // un second clic pendant cette vérification : l'analyse est déjà partie, on ne vide pas son dossier sous elle
  if (etatConseil(cle)?.etat === 'en_cours') return;
  oublierConseil(cle);
  const D = path.join(dossierEspace(e.id), 'analyse-recette');
  fs.rmSync(D, {recursive: true, force: true});
  fs.mkdirSync(path.join(D, 'donnees'), {recursive: true});
  const medianes = medianesDuProfil(e.id);
  ecrireJson(path.join(D, 'donnees', 'statistiques.json'), statistiques(e.id), 1);
  ecrireJson(path.join(D, 'donnees', 'fiches.json'), fiches.map(({projet_dossier, vignettes, ...f}) => f), 1);
  ecrireJson(path.join(D, 'donnees', 'publications.json'), publicationsAvecChiffres(e.id, {medianesParDefaut: medianes}).map(({lectures, ...p}) => ({...p, lectures})), 1);
  const esp = espaceEnTexte(e);
  if (esp) fs.writeFileSync(path.join(D, 'ESPACE.md'), esp);
  if (e.type === 'moi') { const p = lireProfil(); if (p) fs.writeFileSync(path.join(D, 'profil.md'), profilEnTexte(p)); }
  const avant = lireRecette(e.id);
  if (avant) ecrireJson(path.join(D, 'recette-precedente.json'), avant, 1);
  const metier = e.metier ? METIERS[e.metier.type]?.nom : null;
  const consigne = `Dis-moi ce qui marche dans mes vidéos ${e.type === 'client' ? `pour ${e.nom}` : ''}${metier ? ` (métier : ${metier})` : ''}, ce qu'il faut éviter, ce qu'il faut essayer, et donne-moi des idées de sujets pour les prochaines.${avant ? ' Ta recette précédente est dans recette-precedente.json : dis ce qui a changé.' : ''}`;
  // sans terminal : tous les chiffres sont déjà calculés (donnees/), la réponse s'écrit dans un fichier, et l'IA lit ici
  // des pages du web. Avec un terminal, une page piégée pourrait lui faire lancer des commandes (voir lib/conseil.mjs).
  lancerConseil({cle, dossier: D, consigne, systeme: REGLES_RECETTE, competences: COMPETENCES_RECETTE, web: true, treg: false, terminal: false, moteur: m, qualite: 'soigne', attendu: 'recette.json', delaiMs: 20 * 60000,
    valider: validerRecette, surFin: (err, r, c) => {
      if (err || !r) return;
      ecrireRecette(e.id, {v: 1, moteur: c.moteur, duree_s: Math.round((c.fin - c.debut) / 1000), ...r});
      oublierConseil(cle);
    }});
}

/** Les chiffres que seule l'IA peut lire (Instagram, ou sans clé Treg) : elle les relit avec Treg, en lecture seule. */
export async function lancerLectureIA(espaceId, {moteur = null} = {}) {
  const e = trouverEspace(espaceId);
  if (!apprend(e)) throw new Error('Cet espace n’apprend pas : rien à relire.');
  if (e.type === 'client') throw new Error('Treg lit tes comptes à toi : les comptes d’un client ne sont pas reliés.');
  const cle = cleLecture(e.id);
  if (etatConseil(cle)?.etat === 'en_cours') return;
  const d = lireSuivi(e.id);
  const pubs = Object.values(d.publications).filter((p) => p.reseau !== 'linkedin' && (p.suivi === 'ia' || !process.env.TREG_TOKEN));
  if (!pubs.length) throw new Error('Rien à relire par l’IA : les vidéos suivies sont déjà relues par Dérush, ou il n’y en a pas.');
  const p = await peutAnalyser(moteur);
  if (!p.ok) throw new Error(p.pourquoi);
  if (etatConseil(cle)?.etat === 'en_cours') return; // un second clic pendant cette vérification
  oublierConseil(cle);
  const D = path.join(dossierEspace(e.id), 'analyse-chiffres');
  fs.rmSync(D, {recursive: true, force: true});
  fs.mkdirSync(path.join(D, 'donnees'), {recursive: true});
  ecrireJson(path.join(D, 'a-lire.json'), pubs.map((x) => ({cle: x.cle, reseau: x.reseau, lien: x.lien, id: x.id, titre: x.titre, publie_le: x.publie_le})), 1);
  const systeme = `Tu es lancé par Dérush pour relire les chiffres de quelques vidéos publiées par la personne, avec Treg.
- Suis la compétence derush-createur pour savoir quelles fiches de Treg lire et comment (catalog_get d'abord, puis call). LECTURE SEULE : tu ne publies, ne commentes, ne modifies rien, et tu n'appelles aucune fiche payante ni aucune recherche YouTube (100 unités).
- La liste est dans a-lire.json. Pour chaque vidéo, trouve-la sur son compte (par son lien ou son identifiant ; Instagram : user.posts, le permalink, puis media.insights) et relève ses chiffres. Calcule aussi la médiane des vues de chaque compte sur ses vidéos récentes (comme la compétence).
- N'invente rien : une vidéo introuvable n'apparaît pas. Range les réponses brutes dans donnees/.
- Réponds dans chiffres.json : {"lectures": [{"cle": "…(celle de a-lire.json)", "vues": 0, "jaime": 0, "commentaires": 0, "partages": 0, "enregistrements": 0, "portee": 0}], "medianes": {"instagram": {"valeur": 0, "n": 0}}, "limites": "…"}`;
  // Treg et un terminal, sans le web : la seconde exception de lib/conseil.mjs (les médianes se calculent avec python3).
  // Avec Claude, lancerConseil pose la garde de Treg : toute fiche autre qu'une lecture est refusée (reglagesClaudeTreg)
  lancerConseil({cle, dossier: D, consigne: 'Relis les chiffres des vidéos de a-lire.json, avec Treg, en lecture seule.', systeme, competences: ['derush-createur'], web: false, treg: true, terminal: true, moteur: p.moteur, qualite: 'rapide', attendu: 'chiffres.json', delaiMs: 12 * 60000,
    valider: (r) => { if (!r || !Array.isArray(r.lectures)) throw new Error('Réponse illisible.'); return r; },
    // un échec (ou un arrêt) reste affiché dans le tableau de bord jusqu'à la relance, comme pour la recette : l'effacer
    // faisait annoncer « tout est à jour » alors que rien n'avait été relu
    surFin: (err, r) => { if (err || !r) return; rangerChiffresIA(e.id, r.lectures, {medianes: r.medianes}); oublierConseil(cle); }});
}

/** Où en sont les analyses de fond d'un espace (pour le tableau de bord). */
export function etatApprentissage(espaceId) {
  const f = (c) => (c && c.etat !== 'fini' ? {etat: c.etat, nom_ia: c.nom_ia, depuis_s: c.duree_s, etape: c.etapes?.at(-1)?.texte ?? null, erreur: c.erreur} : null);
  return {recette: f(etatConseil(cleRecette(espaceId))), lecture: f(etatConseil(cleLecture(espaceId)))};
}
export const arreterApprentissage = (espaceId) => { arreterConseil(cleRecette(espaceId)); arreterConseil(cleLecture(espaceId)); };
