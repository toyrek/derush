// Dérush — publier sur les réseaux avec Treg (treg.to) : TikTok, YouTube (Shorts), Instagram (Reels), LinkedIn.
// Treg relie tes comptes une fois (sur treg.to) ; ensuite l'IA envoie la vidéo, le titre, la légende et les hashtags.
// Deux façons de le donner à l'IA :
// - le connecteur « Treg » de ton compte Claude (claude.ai → Réglages → Connecteurs), pour Claude ;
// - ta clé Treg (trg_live_…), rangée dans le dossier de Dérush : elle sert à Claude comme à Codex.
import fs from 'node:fs';
import path from 'node:path';
import {lireReglages, changerReglages, rangerCle} from './reglages.mjs';

export const URL_TREG = 'https://treg.to/mcp/';
export const NOMS_TREG = ['claude.ai Treg', 'treg'];

export const jetonTreg = () => !!process.env.TREG_TOKEN;
/** Où en est Treg, pour l'assistant donné : la clé sert aux deux ; le connecteur du compte Claude ne sert qu'à Claude. */
export function etatTreg(moteur = 'claude') {
  const r = lireReglages();
  const parConnecteur = moteur !== 'codex' && r.treg_connecteur?.etat === 'connecte';
  return {
    actif: r.treg_ia !== false, // donné à l'IA dès qu'il est relié
    jeton: jetonTreg(),
    connecteur: r.treg_connecteur ?? null, // le connecteur Treg vu au démarrage de Claude
    pret: jetonTreg() || parConnecteur,
  };
}
export const changerTreg = (actif) => { changerReglages({treg_ia: !!actif}); return etatTreg(); };
export function noterConnecteurTreg(etat) {
  const r = lireReglages();
  if (r.treg_connecteur?.etat !== etat) changerReglages({treg_connecteur: {etat, le: new Date().toISOString()}});
}
/** Range la clé Treg collée par l'humain dans les Réglages (jamais affichée ensuite). */
export function enregistrerJetonTreg(cle) {
  const c = String(cle ?? '').trim();
  if (!/^trg_[A-Za-z0-9_-]{8,}$/.test(c)) throw new Error('Ce n’est pas une clé Treg : elle commence par « trg_ ». Tu la trouves sur treg.to, dans ton compte.');
  rangerCle('TREG_TOKEN', c);
  return etatTreg();
}
export function retirerJetonTreg() { rangerCle('TREG_TOKEN', null); return etatTreg(); }

/** Pour Claude : Treg par la clé, déclaré dans un petit fichier du dossier de travail (la clé reste dans l'environnement). */
export function configTregClaude(atelier) {
  if (!jetonTreg() || !etatTreg().actif) return null;
  const f = path.join(atelier, '.derush', 'treg-mcp.json');
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(f, JSON.stringify({mcpServers: {treg: {type: 'http', url: URL_TREG, headers: {Authorization: 'Bearer ${TREG_TOKEN}'}}}}, null, 2));
  return f;
}
/** Pour Codex : le serveur Treg, avec la clé lue dans l'environnement. */
export function argsCodexTreg() {
  if (!jetonTreg() || !etatTreg().actif) return [];
  return ['-c', `mcp_servers.treg.url="${URL_TREG}"`, '-c', 'mcp_servers.treg.bearer_token_env_var="TREG_TOKEN"'];
}

const REGLES = 'ne publie QUE si l’humain te le demande dans CE message, sur les réseaux qu’il nomme. Suis la compétence `derush-publier` à la lettre (TikTok part en brouillon dans sa boîte TikTok, YouTube en non répertorié sauf s’il dit « public », Instagram Reels, LinkedIn). Écris pour chaque réseau son titre, sa légende et ses hashtags avec les compétences (caption-writer, hashtag-strategy, viral-captions-and-ctas). Ne publie jamais deux fois la même vidéo au même endroit, et donne à la fin le lien ou l’état de chaque publication.';
const PAS_RELIE = 'Si l’humain te demande de publier, écris-lui ses titres, ses légendes et ses hashtags, et dis-lui de relier Treg dans Dérush (Connexions), sans rien essayer d’autre pour publier.';
/** La consigne de publication donnée à l'IA. */
export function consigneTreg(moteur = 'claude') {
  const e = etatTreg(moteur);
  if (!e.actif) return `- Publication : l’humain n’a pas donné Treg à l’IA. ${PAS_RELIE}`;
  if (e.pret) return `- Publication avec Treg (outils \`treg\` ou \`claude_ai_Treg\`) : ${REGLES}`;
  // avec Claude, Treg peut aussi venir du connecteur de son compte : on ne le sait qu'une fois Claude lancé
  if (moteur === 'claude') return `- Publication : si tu as des outils \`mcp__claude_ai_Treg__…\` (le connecteur Treg de son compte Claude), Treg est relié : ${REGLES} Si tu n’as pas ces outils, Treg n’est pas relié. ${PAS_RELIE}`;
  return `- Publication : Treg n’est pas relié. ${PAS_RELIE}`;
}
/** L'état de Treg en une ligne, redit à chaque message (les consignes de départ ne sont pas relues en cours de conversation). */
export function rappelTreg(moteur = 'claude') {
  const e = etatTreg(moteur);
  return e.actif && e.pret ? 'relié (publie seulement si je le demande dans ce message, avec la compétence derush-publier)' : 'pas relié (ne publie rien)';
}
