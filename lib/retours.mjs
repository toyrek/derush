// Dérush — retours de l'IA : propositions écrites par l'IA dans retours-ia.json (dans un pack ou à la racine du projet).
// L'humain les voit dans la chronologie et les applique ou les ignore d'un clic.
import fs from 'node:fs';
import path from 'node:path';
import {lireJson, ecrireJson} from './outils.mjs';

const TYPES = new Set(['rogner', 'deplacer', 'supprimer', 'consigne', 'indication', 'effet', 'style', 'question', 'note']);

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
    const date = j.date ?? fs.statSync(f).mtime.toISOString();
    j.propositions.forEach((p, k) => {
      if (!p || !TYPES.has(p.type)) return;
      const cle = `${rel}#${p.id ?? k}`;
      res.push({...p, cle, fichier: rel, date, auteur: j.auteur ?? 'IA', message: j.message ?? '', etat: etats[cle] ?? 'nouveau'});
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
