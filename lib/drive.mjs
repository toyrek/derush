// Dérush — Google Drive, et les connecteurs que l'IA a le droit de voir.
// Le Drive passe par deux chemins qui se complètent :
// - le connecteur « claude.ai Google Drive » de ton compte Claude (chercher, lire les Google Docs, Sheets et Slides,
//   créer un document) : pour Claude seulement ;
// - le dossier Google Drive synchronisé sur l'ordinateur (Google Drive pour ordinateur) : les gros fichiers s'y lisent
//   directement, et Dérush y dépose les vidéos que tu envoies sur ton Drive. Pour Claude comme pour Codex.
// Claude Code charge tous les connecteurs de ton compte (messagerie, agenda, Notion…) : Dérush ne lui laisse que ceux que
// tu lui donnes (Drive, Treg). Les autres sont refusés, et une garde arrête Claude dès son démarrage s'il en voit un
// autre (il est relancé aussitôt, sans lui).
import fs from 'node:fs';
import path from 'node:path';
import {DOSSIER_SUPPORT} from './moteurs.mjs';
import {dossiersGoogleDrive, lier, delier} from './plateforme.mjs';
import {lireReglages, changerReglages} from './reglages.mjs';
import {etatTreg, NOMS_TREG, configTregClaude} from './treg.mjs';

export const NOM_CONNECTEUR = 'claude.ai Google Drive';
export const PREFIXE_OUTILS = 'mcp__claude_ai_Google_Drive__';
/** Les outils du Drive qui modifient, partagent ou suppriment l'existant : jamais donnés à l'IA. */
const OUTILS_INTERDITS = ['share_file', 'trash_file', 'update_file', 'delete_file', 'move_file', 'rename_file'];

export const dossiersDrive = () => dossiersGoogleDrive();

/** Où en est le Drive pour Dérush : réglage, dossier synchronisé, dernier état connu du connecteur. */
export function etatDrive() {
  const r = lireReglages();
  const d = dossiersDrive();
  return {
    actif: r.drive_claude !== false,
    synchronise: !!d, dossier: d ? path.basename(d.monDrive) : null, partages: !!d?.partages,
    connecteur: r.drive_connecteur ?? null, // {etat: 'connecte' | 'a_autoriser' | 'echec', le}
  };
}
export const changerDrive = (actif) => { changerReglages({drive_claude: !!actif}); return etatDrive(); };
export function noterConnecteur(etat) {
  const r = lireReglages();
  if (r.drive_connecteur?.etat !== etat) changerReglages({drive_connecteur: {etat, le: new Date().toISOString()}});
}

// ——— les connecteurs autorisés et refusés (Claude) ———
const fichierRefuses = () => path.join(DOSSIER_SUPPORT, 'connecteurs-refuses.json');
export const refuses = () => { try { return JSON.parse(fs.readFileSync(fichierRefuses(), 'utf8')).noms ?? []; } catch { return []; } };
/** Les connecteurs que l'IA a le droit de voir, selon ce que tu lui as donné. */
export function autorises() {
  return [...(etatDrive().actif ? [NOM_CONNECTEUR] : []), ...(etatTreg().actif ? NOMS_TREG : [])];
}
export function refuser(noms) {
  const ok = new Set(autorises());
  const tous = [...new Set([...refuses(), ...noms.filter((n) => n && !ok.has(n))])].sort();
  fs.mkdirSync(DOSSIER_SUPPORT, {recursive: true});
  fs.writeFileSync(fichierRefuses(), JSON.stringify({noms: tous}, null, 1));
  return tous.length;
}
/** Les connecteurs vus au démarrage de Claude qui ne devraient pas être là (ceux qui n'ont pas d'outils ne comptent pas). */
export function intrus(serveurs) {
  const ok = new Set(autorises());
  return (serveurs ?? []).filter((s) => !ok.has(s.name) && !['needs-auth', 'failed', 'disabled'].includes(s.status)).map((s) => s.name);
}
/**
 * Les options de Claude Code pour les connecteurs : aucun si rien n'est donné ; sinon les connecteurs refusés (par nom, et
 * leurs outils), écrits dans un fichier de réglages du dossier de travail, plus Treg par la clé s'il y en a une.
 */
export function argsConnecteursClaude(atelier) {
  const ok = autorises();
  if (!ok.length) return ['--strict-mcp-config', '--mcp-config', JSON.stringify({mcpServers: {}})];
  const noms = refuses().filter((n) => !ok.includes(n));
  const reglages = {
    deniedMcpServers: noms.map((n) => ({serverName: n})),
    permissions: {deny: [...OUTILS_INTERDITS.map((o) => `${PREFIXE_OUTILS}${o}`), ...noms.map((n) => `mcp__${n.replace(/[^a-zA-Z0-9_-]/g, '_')}`)]},
  };
  const f = path.join(atelier, '.derush', 'reglages-claude.json');
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(f, JSON.stringify(reglages, null, 1));
  const treg = configTregClaude(atelier);
  return ['--settings', f, ...(treg ? ['--mcp-config', treg] : [])];
}

/** Installe le Drive dans le dossier de travail de l'IA : des liens vers le dossier synchronisé (rien n'est copié). */
export function installerDrive(atelier) {
  for (const n of ['drive', 'drive-partages']) {
    const c = path.join(atelier, n);
    try { if (fs.lstatSync(c).isSymbolicLink()) delier(c); } catch { /* absent */ }
  }
  const e = etatDrive();
  const d = e.actif ? dossiersDrive() : null;
  if (!d) return e;
  lier(d.monDrive, path.join(atelier, 'drive'));
  if (d.partages) lier(d.partages, path.join(atelier, 'drive-partages'));
  return e;
}

/** La consigne Drive donnée à l'IA, selon l'assistant et ce qui est disponible. */
export function consigneDrive(moteur = 'claude') {
  const e = etatDrive();
  if (!e.actif) return '- Google Drive : l’humain ne te l’a pas donné. N’y cherche rien.';
  if (moteur !== 'claude' && !e.synchronise) return '- Google Drive : le dossier Drive n’est pas synchronisé sur cet ordinateur. N’y cherche rien.';
  const L = ['- Google Drive de l’humain (il te l’a donné) :'];
  if (moteur === 'claude') L.push(`  • le connecteur \`${PREFIXE_OUTILS}*\` : \`search_files\` pour trouver un fichier (par nom ou par contenu), \`read_file_content\` pour lire un Google Doc, Sheet ou Slides (un brief, un script, un planning), \`get_file_metadata\` pour savoir où il est. \`create_file\` crée un nouveau document (par exemple un script ou une légende en Google Doc) seulement s’il le demande ;`);
  if (e.synchronise) L.push(`  • son dossier synchronisé est lié ici : \`drive/\` (« ${e.dossier} »)${e.partages ? ' et `drive-partages/` (les Drive partagés)' : ''}. Pour une vidéo, un son ou une image du Drive, copie-le depuis \`drive/\`. Ne parcours pas tout le Drive : ${moteur === 'claude' ? 'cherche d’abord avec le connecteur ou avec' : 'cherche avec'} \`find drive/<dossier> -maxdepth 2\`.`);
  L.push('  • Tu peux tout lire, mais ne modifie, ne déplace, ne renomme et ne supprime jamais un fichier existant du Drive, et ne partage rien. Si l’humain veut ses vidéos sur le Drive, dépose-les dans `drive/Dérush/<titre du projet>/` (crée ce dossier), puis dis-le.');
  return L.join('\n');
}

/** « Envoyer sur mon Drive » : copie une vidéo dans Mon Drive › Dérush › <titre du projet>. */
export function envoyerSurDrive(P, fichier) {
  const d = dossiersDrive();
  if (!d) throw new Error('Google Drive n’est pas synchronisé sur cet ordinateur (application « Google Drive » pour ordinateur).');
  const titre = String(P.d.titre || 'Projet').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim().slice(0, 80) || 'Projet';
  const dossier = path.join(d.monDrive, 'Dérush', titre);
  fs.mkdirSync(dossier, {recursive: true});
  const {name, ext} = path.parse(path.basename(fichier));
  let cible = path.join(dossier, `${name}${ext}`);
  for (let k = 2; fs.existsSync(cible); k++) cible = path.join(dossier, `${name}-${k}${ext}`);
  fs.copyFileSync(fichier, cible);
  return {fichier: path.basename(cible), dossier: `${path.basename(d.monDrive)} › Dérush › ${titre}`};
}
