// Dérush — la bibliothèque : tous les projets, rangés par défaut dans Vidéos/Dérush (Movies/Dérush sur Mac).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {dossierVideos, mettreDossierALaCorbeille} from './plateforme.mjs';
import {lireJson, ecrireJson} from './outils.mjs';
import {sequence} from './commun.mjs';
import {DOSSIER_SUPPORT} from './moteurs.mjs';

export const RACINE_BIBLIO = process.env.DERUSH_BIBLIOTHEQUE || path.join(dossierVideos(), 'Dérush');
const RECENTS = path.join(DOSSIER_SUPPORT, 'recents.json');

function resume(d) {
  const j = lireJson(path.join(d, 'derush.json'));
  if (!j || typeof j !== 'object') return null;
  // derush.json lu brut : un projet d'avant les espaces est à « Moi »
  const espace = typeof j.espace === 'string' ? j.espace : 'moi';
  // un projet abîmé (montage ou médias qui ne sont pas des listes) ne doit pas faire tomber toute la bibliothèque
  const montage = Array.isArray(j.montage) ? j.montage : [];
  const medias = Array.isArray(j.medias) ? j.medias : [];
  let duree = 0;
  try { duree = sequence({...j, montage: montage.filter((it) => it?.type === 'bloc' || medias.some((m) => m?.id === it?.media))}).duree; } catch { /* projet incomplet */ }
  return {
    dossier: d, titre: j.titre || path.basename(d), modifie_le: j.modifie_le, cree_le: j.cree_le,
    plans: montage.filter((it) => it?.type === 'plan').length, rushes: medias.length, duree,
    // plusieurs vidéos dans la timeline (les 10 TikToks) : la carte dit « 3 vidéos » ; plans et durée sont ceux de la vidéo ouverte
    videos: Array.isArray(j.sequences) && j.sequences.length ? j.sequences.length : 1,
    format: j.sortie?.preset ?? 'vertical', affiche: fs.existsSync(path.join(d, '.derush', 'affiche.jpg')),
    dans_bibliotheque: path.dirname(d) === RACINE_BIBLIO,
    // une série appartient à un espace : un projet passé à un autre espace n'en est plus un épisode
    espace, serie: typeof j.serie?.nom === 'string' && j.serie.espace === espace ? j.serie.nom : null,
  };
}

export function listerProjets() {
  fs.mkdirSync(RACINE_BIBLIO, {recursive: true});
  const dossiers = new Set();
  for (const e of fs.readdirSync(RACINE_BIBLIO, {withFileTypes: true})) {
    if (e.isDirectory() && fs.existsSync(path.join(RACINE_BIBLIO, e.name, 'derush.json'))) dossiers.add(path.join(RACINE_BIBLIO, e.name));
  }
  for (const r of lireJson(RECENTS, [])) if (fs.existsSync(path.join(r, 'derush.json'))) dossiers.add(r);
  return [...dossiers].map(resume).filter(Boolean).sort((a, b) => String(b.modifie_le ?? '').localeCompare(String(a.modifie_le ?? '')));
}

/** Nouveau dossier de projet dans la bibliothèque, nommé comme le projet (sans caractères interdits). */
export function creerDossierProjet(titre) {
  fs.mkdirSync(RACINE_BIBLIO, {recursive: true});
  const nom = String(titre || 'Nouveau montage').replace(/[/\\:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').trim().slice(0, 80) || 'Nouveau montage';
  let d = path.join(RACINE_BIBLIO, nom);
  for (let k = 2; fs.existsSync(d); k++) d = path.join(RACINE_BIBLIO, `${nom} ${k}`);
  fs.mkdirSync(d, {recursive: true});
  return d;
}

export function noterRecent(d) {
  const r = lireJson(RECENTS, []).filter((x) => x !== d);
  r.unshift(d);
  ecrireJson(RECENTS, r.slice(0, 30));
}

/** Met un projet à la corbeille du système (récupérable). Les rushes d'origine ne sont pas touchés. */
export function mettreALaCorbeille(d) {
  if (!fs.existsSync(path.join(d, 'derush.json'))) throw new Error('Ce dossier n’est pas un projet Dérush.');
  mettreDossierALaCorbeille(d);
  ecrireJson(RECENTS, lireJson(RECENTS, []).filter((x) => x !== d));
}
