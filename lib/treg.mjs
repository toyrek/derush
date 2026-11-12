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
/** Les réseaux que Dérush sait publier, sous le nom que Treg leur donne. */
export const RESEAUX_TREG = ['tiktok', 'instagram', 'youtube', 'linkedin'];

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
    // YouTube a besoin de la clé : son adresse d'envoi n'est visible que par la porte directe de Treg (voir youtube.mjs)
    youtube: jetonTreg(),
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
  verification = null;
  return etatTreg();
}
export function retirerJetonTreg() { rangerCle('TREG_TOKEN', null); verification = null; return etatTreg(); }

// ——— Vérifier la clé auprès de Treg, et savoir quels réseaux sont reliés ———
// Treg parle le protocole MCP (des messages JSON envoyés à https://treg.to/mcp/). Dérush lui pose deux questions, avec
// la clé de la personne : « bonjour » (la clé est-elle acceptée ?) et « my_tools » (quels comptes a-t-elle reliés ?).
// Rien d'autre n'est envoyé : ni vidéo, ni texte du projet.
let verification = null; // {le, ok, reseaux, compte, pourquoi}
/** Un message MCP ; la réponse arrive en JSON, ou en flux d'événements (on garde le dernier message). */
async function mcp(methode, params, id, session) {
  const r = await fetch(URL_TREG, {
    method: 'POST',
    headers: {Authorization: `Bearer ${process.env.TREG_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(session ? {'Mcp-Session-Id': session} : {})},
    body: JSON.stringify({jsonrpc: '2.0', ...(id != null ? {id} : {}), method: methode, ...(params ? {params} : {})}),
    signal: AbortSignal.timeout(15000),
  });
  if (r.status === 401 || r.status === 403) throw Object.assign(new Error('refus'), {refus: true});
  if (!r.ok && r.status !== 202) throw new Error(`Treg a répondu ${r.status}.`);
  const texte = await r.text();
  let j = null;
  if (/text\/event-stream/.test(r.headers.get('content-type') ?? '')) {
    for (const l of texte.split(/\r?\n/)) if (l.startsWith('data:')) { try { const x = JSON.parse(l.slice(5).trim()); if (x.id === id || x.result || x.error) j = x; } catch { /* ligne partielle */ } }
  } else { try { j = JSON.parse(texte); } catch { /* réponse vide (notification) */ } }
  return {j, session: r.headers.get('mcp-session-id') ?? session ?? null};
}
/**
 * Demande à Treg si la clé est bonne et quels réseaux sont reliés. Le résultat est gardé dix minutes.
 * Renvoie {ok, reseaux: {tiktok, instagram, youtube, linkedin}, compte, pourquoi, le}.
 */
export async function verifierTreg(force = false) {
  if (!jetonTreg()) return {ok: false, sans_cle: true, reseaux: {}, pourquoi: 'Aucune clé Treg sur cet ordinateur.'};
  if (!force && verification && Date.now() - verification.t < 600000) return verification.v;
  let v;
  try {
    const a = await mcp('initialize', {protocolVersion: '2025-03-26', capabilities: {}, clientInfo: {name: 'derush', version: '8'}}, 1, null);
    if (a.j?.error) throw new Error(a.j.error.message ?? 'Treg a refusé la connexion.');
    await mcp('notifications/initialized', null, null, a.session).catch(() => {});
    const b = await mcp('tools/call', {name: 'my_tools', arguments: {}}, 2, a.session);
    if (b.j?.error) throw new Error(b.j.error.message ?? 'Treg n’a pas donné la liste des réseaux.');
    const contenu = b.j?.result?.structuredContent ?? (() => { try { return JSON.parse(b.j?.result?.content?.find((c) => c.type === 'text')?.text ?? '{}'); } catch { return {}; } })();
    const noms = new Set((contenu.tools ?? []).map((t) => String(t.name ?? '').toLowerCase()));
    const reseaux = Object.fromEntries(RESEAUX_TREG.map((k) => [k, noms.has(k)]));
    v = {ok: true, reseaux, compte: contenu.team_name ?? null, le: new Date().toISOString(), pourquoi: Object.values(reseaux).some(Boolean) ? null : 'Ta clé marche, mais aucun réseau n’est encore relié dans Treg.'};
  } catch (e) {
    v = {ok: false, reseaux: {}, le: new Date().toISOString(),
      pourquoi: e.refus ? 'Treg ne reconnaît pas cette clé. Copie-la de nouveau depuis ton compte Treg.' : /timeout|aborted|fetch failed|ENOTFOUND|ECONN/i.test(String(e.message)) ? 'Treg ne répond pas pour le moment (pas d’Internet ?). Ta clé est gardée : réessaie plus tard.' : `Treg : ${String(e.message).slice(0, 200)}`};
  }
  verification = {t: Date.now(), v};
  return v;
}

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
/** YouTube ne se publie pas par les outils Treg de l'IA, mais par la commande de Dérush (elle a besoin de la clé). */
const youtubeDit = () => ` Pour YouTube, n’ouvre pas l’envoi avec les outils Treg : utilise la commande \`derush-youtube\` (voir la compétence). ${jetonTreg() ? 'La clé Treg est rangée dans Dérush : la commande marchera.' : 'Il n’y a PAS de clé Treg dans Dérush : YouTube est impossible pour l’instant ; écris les textes, et dis à l’humain d’ajouter sa clé dans Connexions › Treg › « Relier mes réseaux ».'}`;
const PAS_RELIE = 'Si l’humain te demande de publier, écris-lui ses titres, ses légendes et ses hashtags, et dis-lui de relier Treg dans Dérush (Connexions), sans rien essayer d’autre pour publier.';
/** La consigne de publication donnée à l'IA. */
export function consigneTreg(moteur = 'claude') {
  const e = etatTreg(moteur);
  if (!e.actif) return `- Publication : l’humain n’a pas donné Treg à l’IA. ${PAS_RELIE}`;
  if (e.pret) return `- Publication avec Treg (outils \`treg\` ou \`claude_ai_Treg\`) : ${REGLES}${youtubeDit()}`;
  // avec Claude, Treg peut aussi venir du connecteur de son compte : on ne le sait qu'une fois Claude lancé
  if (moteur === 'claude') return `- Publication : si tu as des outils \`mcp__claude_ai_Treg__…\` (le connecteur Treg de son compte Claude), Treg est relié : ${REGLES}${youtubeDit()} Si tu n’as pas ces outils, Treg n’est pas relié. ${PAS_RELIE}`;
  return `- Publication : Treg n’est pas relié. ${PAS_RELIE}`;
}
/** L'état de Treg en une ligne, redit à chaque message (les consignes de départ ne sont pas relues en cours de conversation). */
export function rappelTreg(moteur = 'claude') {
  const e = etatTreg(moteur);
  return e.actif && e.pret ? `relié (publie seulement si je le demande dans ce message, avec la compétence derush-publier ; YouTube : commande derush-youtube, clé Treg ${jetonTreg() ? 'présente' : 'absente, donc YouTube impossible'})` : 'pas relié (ne publie rien)';
}
