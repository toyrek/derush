// Dérush — détourage de la personne filmée (Apple Vision, sur le Mac) : pour passer un titre derrière elle.
import fs from 'node:fs';
import path from 'node:path';
import {fpsSource} from './commun.mjs';
import {etatMoteurs, installer, lancerPython} from './moteurs.mjs';
import {fichierLecture} from './medias.mjs';

/** Installe le détourage s'il manque (quelques secondes, une seule fois). */
export async function assurerDetourage(prog) {
  const e = await etatMoteurs();
  if (e.detourage.ok) return;
  if (!e.detourage.installable) throw new Error('Le détourage a besoin d’un Mac à puce Apple et de l’outil « uv ».');
  await installer('detourage', prog);
}

export const dossierMasques = (P, me) => path.join(P.cache, 'medias', me.id, 'masques');

/**
 * Masques légers d'un rush entre deux temps (secondes dans le rush), pour l'aperçu : un fichier par image,
 * m_<n>.png avec n = temps × cadence. Les images déjà détourées ne sont pas refaites.
 */
export async function masquesMedia(P, me, debut, fin, prog = () => {}) {
  if (me.type !== 'video') throw new Error('Seule une vidéo peut être détourée.');
  await assurerDetourage();
  const d = dossierMasques(P, me);
  const a = Math.max(0, Number(debut) || 0);
  const b = Math.min(me.duree, Math.max(a, Number(fin) || 0));
  await lancerPython('detourer.py', ['masques', fichierLecture(P, me), d, a.toFixed(4), b.toFixed(4), String(fpsSource(me, P.d))], prog);
  return {media: me.id, debut: a, fin: b};
}

/**
 * Personne détourée en pleine qualité pour le rendu : d_<i>.webp pour les images i0 à i1 d'un fichier de plan.
 * fps : la cadence qui a servi à compter i0 et i1. detourer.py s'en sert pour sauter à l'image i0 ; sans elle, il relit
 * celle du fichier, et les images détourées seraient décalées si on a compté avec une autre (celle du projet).
 */
export async function decoupesFichier(fichier, dossier, i0, i1, prog = () => {}, fps = null) {
  await assurerDetourage();
  fs.mkdirSync(dossier, {recursive: true});
  await lancerPython('detourer.py', ['decoupes', fichier, dossier, String(i0), String(i1), ...(fps > 0 ? ['1920', String(fps)] : [])], prog);
}
