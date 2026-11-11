// Dérush — les réglages de l'app (pas ceux d'un projet) : assistant choisi, connexions données à l'IA, etc.
// Rangés dans le dossier de Dérush (reglages.json) ; les clés secrètes, elles, sont dans .env.local, jamais ici.
import fs from 'node:fs';
import path from 'node:path';
import {DOSSIER_SUPPORT} from './moteurs.mjs';

const fichier = () => path.join(DOSSIER_SUPPORT, 'reglages.json');
export function lireReglages() {
  try { return JSON.parse(fs.readFileSync(fichier(), 'utf8')); } catch { return {}; }
}
export function changerReglages(champs) {
  const r = {...lireReglages(), ...champs};
  fs.mkdirSync(DOSSIER_SUPPORT, {recursive: true});
  fs.writeFileSync(fichier(), JSON.stringify(r, null, 2));
  return r;
}

/**
 * Range une clé secrète dans .env.local (le fichier du dossier de Dérush, lisible par toi seul) et la charge.
 * La clé n'est jamais renvoyée à l'interface ni écrite ailleurs.
 */
export function rangerCle(nom, valeur) {
  const f = path.join(DOSSIER_SUPPORT, '.env.local');
  fs.mkdirSync(DOSSIER_SUPPORT, {recursive: true});
  let lignes = [];
  try { lignes = fs.readFileSync(f, 'utf8').split(/\r?\n/); } catch { /* pas encore de fichier */ }
  lignes = lignes.filter((l) => l.trim() && !l.startsWith(`${nom}=`));
  if (valeur) lignes.push(`${nom}=${valeur}`);
  fs.writeFileSync(f, `${lignes.join('\n')}\n`, {mode: 0o600});
  try { fs.chmodSync(f, 0o600); } catch { /* Windows */ }
  if (valeur) process.env[nom] = valeur;
  else delete process.env[nom];
}
