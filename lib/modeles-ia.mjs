// Dérush — le catalogue des modèles de chaque IA, tenu à jour tout seul : le sélecteur d'IA « en direct ».
//   - Codex : « codex debug models », le catalogue que Codex reçoit pour le compte ChatGPT (les modèles visibles, dans
//     l'ordre de Codex). Un nouveau modèle d'OpenAI n'y apparaît qu'avec une version récente de Codex (GPT-6.1 Terra,
//     novembre 2026, absent de Codex 0.156) : Dérush tient donc à jour, dans son propre dossier, le Codex qu'il lance
//     (une vérification toutes les 6 heures au plus ; jamais celui que la personne a installé ailleurs).
//   - Gemini : « agy models », les modèles du compte Google, par famille (Carbon, Hydrogen, Argon, Flash…) ; la réflexion
//     suit le niveau de soin. agy se met à jour tout seul.
//   - Claude : Claude Code ne donne pas sa liste (et ses alias suivent mal : « fable » menait encore à Fable 5.1 le
//     17 nov. 2026) ; la liste est celle de Dérush (MODELES, lib/ia.mjs), mise à jour avec Dérush.
// Revérifié en fond dès qu'on ouvre le choix de l'IA ou Connexions, si la dernière vérification a plus d'une heure. Un
// modèle apparu depuis moins de 7 jours porte « Nouveau ».
import path from 'node:path';
import {DOSSIER_SUPPORT} from './moteurs.mjs';
import {lireJson, ecrireJson, lancer} from './outils.mjs';
import {commandeNode} from './plateforme.mjs';
import {MODELES, etatCodex, etatGeminiRecent, installerCodex, envIA, envOutils, questionner, nomModele} from './ia.mjs';

const FICHIER = () => path.join(DOSSIER_SUPPORT, 'modeles-ia.json');
const UNE_HEURE = 3600e3;
const SEMAINE = 7 * 24 * UNE_HEURE;
const comparer = (a, b) => { const x = String(a).split('.').map(Number); const y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
const lire = () => lireJson(FICHIER()) ?? {};

/** Le catalogue de Codex (« codex debug models ») : les modèles visibles, dans l'ordre de Codex (le premier : son défaut). */
export function lireCatalogueCodex(texte) {
  let j;
  try { j = JSON.parse(texte); } catch { return []; }
  const liste = Array.isArray(j) ? j : j?.models ?? [];
  return liste.filter((m) => m?.slug && m.visibility === 'list').sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .map((m) => ({id: String(m.slug), nom: String(m.display_name ?? m.slug), aide: String(m.description ?? '').slice(0, 160),
      // les vitesses que ce modèle propose (« priority » : Fast, « ultrafast »…), en plus de la vitesse normale
      vitesses: (Array.isArray(m.service_tiers) ? m.service_tiers : []).filter((t) => /^[\w-]{2,30}$/.test(String(t?.id ?? '')))
        .map((t) => ({id: String(t.id), nom: String(t.name ?? t.id).slice(0, 30), aide: String(t.description ?? '').slice(0, 120)}))}));
}
/** Les familles de Gemini de la commande (sans la réflexion : -low, -medium, -high, -xhigh), de la plus forte à la plus légère. */
const RANG_GEMINI = ['carbon', 'hydrogen', 'argon', 'ultra', 'pro', 'flash'];
export function famillesGemini(modeles = []) {
  const vues = new Map();
  for (const s of modeles.filter((x) => /^gemini-\d/.test(x) && !/orchestrator|embed|tts|image|live/.test(x))) {
    const f = s.replace(/-(low|medium|high|xhigh|max)$/, '');
    if (!vues.has(f)) vues.set(f, {id: f, nom: nomModele('gemini', f), aide: ''});
  }
  const rang = (id) => { const k = RANG_GEMINI.findIndex((r) => id.includes(`-${r}`)); return k < 0 ? 99 : k; };
  return [...vues.values()].sort((a, b) => rang(a.id) - rang(b.id) || b.id.localeCompare(a.id));
}

/** Tient à jour le Codex de Dérush (dans son dossier) quand npm en a un plus récent : toutes les 6 heures au plus. */
async function majCodex(avant) {
  if (avant.codex_verifie && Date.now() - Date.parse(avant.codex_verifie) < 6 * UNE_HEURE) return {verifie: avant.codex_verifie};
  const e = await etatCodex();
  if (!e?.chemin) return {verifie: new Date().toISOString()}; // pas installé : rien n'est installé tout seul
  let derniere = null;
  // DERUSH_NPM : un autre npm (les essais)
  try { const {out} = await lancer(process.env.DERUSH_NPM || commandeNode('npm'), ['view', '@openai/codex', 'version'], {env: envOutils(), silenceMax: 30000, dureeMax: 60000}); derniere = String(out).trim(); } catch { /* hors ligne */ }
  if (/^\d+\.\d+\.\d+$/.test(derniere ?? '') && e.version && comparer(derniere, e.version) > 0) await installerCodex();
  return {verifie: new Date().toISOString(), derniere};
}

/** Le catalogue du Codex que Dérush lance (le plus récent trouvé) : {liste, version}, ou null s'il n'y a pas de Codex. */
async function catalogueCodex() {
  const e = await etatCodex(true);
  if (!e?.chemin) return null;
  const {out} = await questionner(e.chemin, ['debug', 'models'], {env: envIA([], false), silenceMax: 30000, dureeMax: 60000});
  return {liste: lireCatalogueCodex(String(out)), version: e.version};
}

let enCours = null;
/** Revérifie les modèles de Codex et de Gemini (et met Codex à jour s'il le faut). Une seule vérification à la fois. */
export function rafraichirCatalogue() {
  enCours ??= (async () => {
    const avant = lire();
    const r = {...avant, le: new Date().toISOString(), vus: {...(avant.vus ?? {})}};
    const premiere = !avant.le;
    const ANCIEN = '2000-01-01T00:00:00.000Z';
    // la toute première vérification : le catalogue du Codex déjà là, avant sa mise à jour, est « ce qu'on connaissait » ;
    // ce que la mise à jour apporte (un nouveau modèle de ChatGPT) est donc « Nouveau » dès ce jour-là
    const connus = premiere ? (await catalogueCodex().catch(() => null))?.liste ?? [] : [];
    for (const m of connus) r.vus[m.id] ??= ANCIEN;
    try { const m = await majCodex(avant); r.codex_verifie = m.verifie; if (m.derniere) r.codex_derniere = m.derniere; } catch { /* la suite quand même */ }
    try {
      const c = await catalogueCodex();
      if (c?.liste.length) { r.codex = c.liste; r.codex_version = c.version; }
    } catch { /* Codex absent, ou sa commande a changé : la liste d'avant reste */ }
    try {
      const g = await etatGeminiRecent(UNE_HEURE);
      const l = famillesGemini(g?.ok ? g.modeles ?? [] : []);
      if (l.length) r.gemini = l;
    } catch { /* la liste d'avant reste */ }
    // la première fois qu'un modèle est vu. À la toute première vérification, rien n'est « Nouveau » chez Gemini, ni chez
    // Codex s'il n'y avait rien à comparer
    const maintenant = new Date().toISOString();
    for (const m of r.codex ?? []) r.vus[m.id] ??= premiere && !connus.length ? ANCIEN : maintenant;
    for (const m of r.gemini ?? []) r.vus[m.id] ??= premiere ? ANCIEN : maintenant;
    ecrireJson(FICHIER(), r, 1);
    return r;
  })().finally(() => { enCours = null; });
  return enCours;
}

/**
 * Le catalogue pour le sélecteur, tout de suite (celui qu'on connaît) : {claude, codex, gemini}, chaque modèle {id,
 * nom, aide, nouveau}. Une vérification part en fond si la dernière a plus d'une heure (ou si `forcer`).
 */
export function catalogueIA({rafraichir = true, forcer = false} = {}) {
  const c = lire();
  // un catalogue d'avant les vitesses de Codex (Dérush 11.2) est relu tout de suite
  const ancien = (c.codex ?? []).some((m) => !Array.isArray(m.vitesses));
  if (rafraichir && (forcer || ancien || !c.le || Date.now() - Date.parse(c.le) > UNE_HEURE)) rafraichirCatalogue().catch(() => {});
  const nouveau = (id) => !!c.vus?.[id] && Date.now() - Date.parse(c.vus[id]) < SEMAINE;
  return {
    claude: Object.entries(MODELES).map(([id, m]) => ({id, nom: m.nom, aide: m.aide ?? '', nouveau: false})),
    codex: (c.codex ?? []).map((m) => ({...m, nouveau: nouveau(m.id)})),
    gemini: (c.gemini ?? []).map((m) => ({...m, nouveau: nouveau(m.id)})),
    verifie_le: c.le ?? null, codex_version: c.codex_version ?? null, codex_derniere: c.codex_derniere ?? null,
  };
}
/** Le modèle choisi à la main pour une IA (null : selon le niveau), s'il est encore au catalogue. */
export function modeleChoisi(moteur, reglages) {
  const id = moteur === 'claude' ? reglages.ia_modele : reglages.ia_modeles?.[moteur];
  if (!id) return null;
  const liste = catalogueIA({rafraichir: false})[moteur] ?? [];
  return liste.some((m) => m.id === id) ? id : null;
}

/**
 * La vitesse choisie pour Codex (null : normale), si le modèle qui va monter la propose. `modele` : celui de la
 * demande (null : Auto, le modèle par défaut de Codex, le premier de son catalogue).
 */
export function vitesseChoisie(moteur, reglages, modele = null) {
  const id = reglages.ia_vitesses?.[moteur];
  if (!id || moteur !== 'codex') return null;
  const liste = catalogueIA({rafraichir: false}).codex ?? [];
  const m = liste.find((x) => x.id === modele) ?? (modele ? null : liste[0]);
  return m?.vitesses?.some((v) => v.id === id) ? id : null;
}
