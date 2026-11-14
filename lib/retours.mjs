// Dérush — retours de l'IA : propositions écrites par l'IA dans retours-ia.json (dans un pack ou à la racine du projet).
// L'humain les voit dans la chronologie et les applique ou les ignore d'un clic.
import fs from 'node:fs';
import path from 'node:path';
import {lireJson, ecrireJson} from './outils.mjs';
import {GENRES_INDICATION} from './commun.mjs';
import {Projet} from './projet.mjs';
import {CATALOGUE} from '../public/moteur.js';

const TYPES = new Set(['rogner', 'deplacer', 'supprimer', 'consigne', 'indication', 'effet', 'style', 'question', 'note']);
// les types qui visent un élément du montage : sans cible lisible, la proposition ne mène nulle part
const AVEC_CIBLE = new Set(['rogner', 'deplacer', 'supprimer', 'consigne']);
// un plan, une case, une indication ou un plan par-dessus (P1, B2, I3, S4), comme Dérush les nomme
const CIBLE = /^[PBIS]\d{1,9}$/;

/**
 * Une proposition de l'IA, réduite à ce que Dérush sait en faire. Le fichier vient de l'IA (parfois dans un bac à
 * sable) : il est lu comme une donnée, jamais tel quel. Chaque type garde ses seuls champs, les nombres doivent en être,
 * un effet doit être au catalogue et ses réglages passent par le même nettoyage que le projet. Renvoie null sinon.
 */
export function nettoyerProposition(p) {
  if (!p || typeof p !== 'object' || !TYPES.has(p.type)) return null;
  const txt = (v, n = 4000) => (typeof v === 'string' ? v.slice(0, n) : undefined);
  // un nombre facultatif : absent, il reste absent ; présent, il doit en être un
  const nombres = (...cles) => {
    const r = {};
    for (const k of cles) {
      if (p[k] === undefined || p[k] === null) continue;
      const v = Number(p[k]);
      if (typeof p[k] === 'boolean' || p[k] === '' || !Number.isFinite(v)) return null;
      r[k] = v;
    }
    return r;
  };
  const cible = p.cible === undefined || p.cible === null || p.cible === '' ? undefined : String(p.cible);
  if (cible !== undefined && !CIBLE.test(cible)) return null;
  if (AVEC_CIBLE.has(p.type) && !cible) return null;
  const r = {type: p.type, ...(typeof p.id === 'string' || typeof p.id === 'number' ? {id: String(p.id).slice(0, 40)} : {}), ...(cible ? {cible} : {})};
  if (txt(p.pourquoi)) r.pourquoi = txt(p.pourquoi, 2000);
  let n = {};
  switch (p.type) {
    case 'rogner': n = nombres('entree_s', 'sortie_s'); break;
    case 'deplacer': n = nombres('position'); break;
    case 'consigne': r.consigne = txt(p.consigne) ?? ''; break;
    case 'indication':
      n = nombres('debut_s', 'fin_s');
      r.genre = GENRES_INDICATION[p.genre] ? p.genre : 'note';
      r.consigne = txt(p.consigne) ?? '';
      break;
    case 'effet': {
      if (typeof p.modele !== 'string' || !Object.hasOwn(CATALOGUE, p.modele)) return null;
      n = nombres('debut_s', 'fin_s');
      r.modele = p.modele;
      r.reglages = Projet.prototype.nettoyerReglages(CATALOGUE[p.modele], p.reglages && typeof p.reglages === 'object' ? p.reglages : {});
      break;
    }
    case 'style': {
      if (!p.style || typeof p.style !== 'object') return null;
      const st = Projet.prototype.nettoyerStyle(p.style);
      // les sous-titres : seulement les réglages donnés par l'IA et permis (le reste garde le style du projet)
      if (st.sous_titres) {
        const donnes = p.style.sous_titres;
        st.sous_titres = Object.fromEntries(Object.entries(st.sous_titres).filter(([k, v]) => donnes[k] === v));
        if (!Object.keys(st.sous_titres).length) delete st.sous_titres;
      }
      if (!Object.keys(st).length) return null;
      r.style = st;
      break;
    }
    case 'question': case 'note': r.texte = txt(p.texte) ?? ''; break;
    default:
  }
  if (!n) return null;
  return {...r, ...n};
}

export function lireRetours(P) {
  const fichiers = [];
  const racine = path.join(P.racine, 'retours-ia.json');
  if (fs.existsSync(racine)) fichiers.push(racine);
  const ex = path.join(P.racine, 'exports');
  if (fs.existsSync(ex)) {
    for (const d of fs.readdirSync(ex)) {
      const f = path.join(ex, d, 'retours-ia.json');
      if (fs.existsSync(f)) fichiers.push(f);
    }
  }
  const etats = lireJson(path.join(P.cache, 'retours-traites.json'), {});
  const res = [];
  for (const f of fichiers) {
    const j = lireJson(f);
    if (!j || !Array.isArray(j.propositions)) continue;
    const rel = path.relative(P.racine, f);
    const date = typeof j.date === 'string' && j.date ? j.date.slice(0, 40) : fs.statSync(f).mtime.toISOString();
    const auteur = typeof j.auteur === 'string' && j.auteur.trim() ? j.auteur.slice(0, 60) : 'IA';
    const message = typeof j.message === 'string' ? j.message.slice(0, 2000) : '';
    j.propositions.slice(0, 200).forEach((brute, k) => {
      const p = nettoyerProposition(brute);
      if (!p) return;
      const cle = `${rel}#${p.id ?? k}`;
      res.push({...p, cle, fichier: rel, date, auteur, message, etat: etats[cle] ?? 'nouveau'});
    });
  }
  return res.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function marquerRetour(P, cle, etat) {
  const f = path.join(P.cache, 'retours-traites.json');
  const e = lireJson(f, {});
  e[String(cle)] = ['applique', 'ignore', 'nouveau'].includes(etat) ? etat : 'ignore';
  ecrireJson(f, e);
}
