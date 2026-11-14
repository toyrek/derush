// Dérush — demander un avis à l'IA (Claude ou Codex), en dehors de la conversation de montage : l'analyse de viralité
// et le plan de publication. Dérush prépare un petit dossier (les mesures, le texte dit, des planches d'images), y relie
// les seules compétences utiles, puis lance l'IA dedans. Elle lit, regarde, cherche au besoin les tendances sur le web,
// et écrit sa réponse dans un fichier JSON que Dérush relit.
//
// Ce que l'IA ne peut PAS faire ici : elle n'a aucun connecteur (ni Treg, ni Drive), aucune clé, pas de terminal avec
// Claude (seulement lire, écrire sa réponse, lire une compétence, chercher sur le web), et elle ne touche pas au projet.
// Rien n'est publié depuis ce module.
//
// Deux exceptions, demandées par l'appelant, toutes deux à la demande de la personne (un clic) : le profil du créateur
// (lib/createur.mjs) et la relecture des vues par l'IA (lib/apprentissage-ia.mjs) passent « treg » et « terminal ».
// L'IA reçoit alors Treg seul (aucun autre connecteur), pour LIRE les comptes de l'humain, et un terminal pour
// télécharger des miniatures et calculer (les médianes se calculent avec python3, jamais de tête : compétence
// derush-createur). Ses consignes lui interdisent toute fiche d'action ; avec Claude, une garde les refuse aussi, avant
// chaque outil Treg (reglagesClaudeTreg, outils/garde-treg.mjs). Codex n'a pas de crochets : chez lui, c'est encore
// une consigne. Aucun autre appelant ne donne de terminal :
// avec le web ouvert, une page piégée pourrait faire lancer des commandes hors de tout bac à sable.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {WINDOWS, arreterArbre, lier, delier, garderEveille, preparerLancement} from './plateforme.mjs';
import {lireJson} from './outils.mjs';
import {IA, reglageIA, envIA, etatIA, argsCodex, lireEvenementCodex, argsGemini, lecteurGemini, refusGemini, commandeLancement} from './ia.mjs';
import {listerCompetences, DOSSIER_COMMANDES} from './competences.mjs';
import {outilsLisibles, reglagesGemini, envGemini} from './gemini.mjs';
import {NOMS_TREG, configTregClaude, argsCodexTreg, noterConnecteurTreg} from './treg.mjs';
import {refuses, refuser, NOM_CONNECTEUR} from './drive.mjs';
import {RACINE_APP} from './moteurs.mjs';

/** Un chemin pour la ligne de commande d'un crochet (lancée par un terminal, « bash » sous Windows aussi). */
const cheminCommande = (f) => `"${f.replace(/\\/g, '/').replace(/["$`]/g, '\\$&')}"`;
/**
 * Les réglages donnés à Claude quand il reçoit Treg pour LIRE les comptes (« treg » : profil du créateur, relecture des
 * vues) : les autres connecteurs refusés par leur nom, et une garde avant chaque outil Treg (outils/garde-treg.mjs) qui
 * refuse tout sauf la lecture (outilTregLecture, lib/treg.mjs). La lecture seule n'est plus seulement une consigne.
 * La garde est rangée avec les outils de Dérush, hors du dossier de travail (l'IA peut y écrire) ; Claude lit ses
 * crochets une fois, au démarrage.
 */
export function reglagesClaudeTreg(noms) {
  return {
    deniedMcpServers: noms.map((n) => ({serverName: n})),
    permissions: {deny: noms.map((n) => `mcp__${n.replace(/[^a-zA-Z0-9_-]/g, '_')}`)},
    hooks: {PreToolUse: [{matcher: 'mcp__treg__.*|mcp__claude_ai_Treg__.*', hooks: [{type: 'command', command: `${cheminCommande(process.execPath)} ${cheminCommande(path.join(RACINE_APP, 'outils', 'garde-treg.mjs'))}`}]}]},
  };
}

const CONSEILS = new Map(); // clé → {etat, moteur, debut, fin, etapes[], reponse, erreur, proc, annule}
export const etatConseil = (cle) => {
  const c = CONSEILS.get(cle);
  if (!c) return null;
  return {etat: c.etat, moteur: c.moteur, nom_ia: IA[c.moteur]?.nom ?? 'L’IA', debut: c.debut, fin: c.fin ?? null, duree_s: Math.round(((c.fin ?? Date.now()) - c.debut) / 1000),
    etapes: c.etapes.slice(-40), erreur: c.erreur ?? null, reponse: c.etat === 'fini' ? c.reponse : null};
};
export const conseilEnCours = () => [...CONSEILS.values()].some((c) => c.etat === 'en_cours');
export function arreterConseil(cle) {
  const c = CONSEILS.get(cle);
  if (!c || c.etat !== 'en_cours') return false;
  c.annule = true;
  try { arreterArbre(c.proc); } catch { /* déjà fini */ }
  return true;
}
export function arreterConseils() { for (const cle of CONSEILS.keys()) arreterConseil(cle); }
export const oublierConseil = (cle) => { if (CONSEILS.get(cle)?.etat !== 'en_cours') CONSEILS.delete(cle); };

/** Relie dans le dossier les seules compétences nommées (pour Claude et pour Codex). Renvoie celles qui existent. */
function relierCompetences(dossier, noms) {
  const toutes = new Map(listerCompetences().map((s) => [s.nom, s]));
  const presentes = noms.filter((n) => toutes.has(n));
  for (const base of [path.join(dossier, '.claude', 'skills'), path.join(dossier, '.agents', 'skills')]) {
    fs.mkdirSync(base, {recursive: true});
    for (const n of fs.readdirSync(base)) { const c = path.join(base, n); try { if (fs.lstatSync(c).isSymbolicLink()) delier(c); } catch { /* déjà parti */ } }
    for (const n of presentes) {
      const lien = path.join(base, n);
      if (fs.existsSync(lien)) continue;
      if (!lier(toutes.get(n).dossier, lien)) { try { fs.cpSync(toutes.get(n).dossier, lien, {recursive: true}); } catch { /* tant pis pour celle-ci */ } }
    }
  }
  return presentes;
}

/** Le premier objet JSON complet d'un texte (l'IA a pu l'entourer de phrases ou de ```). */
export function extraireJson(texte) {
  const t = String(texte ?? '');
  for (let a = t.indexOf('{'); a >= 0; a = t.indexOf('{', a + 1)) {
    let prof = 0;
    let chaine = false;
    for (let i = a; i < t.length; i++) {
      const ch = t[i];
      if (chaine) { if (ch === '\\') i++; else if (ch === '"') chaine = false; continue; }
      if (ch === '"') chaine = true;
      else if (ch === '{') prof++;
      else if (ch === '}' && --prof === 0) {
        try { return JSON.parse(t.slice(a, i + 1)); } catch { break; }
      }
    }
  }
  return null;
}

/** Ce que l'IA est en train de faire, en mots simples (pour le suivi dans l'interface). */
function decrire(outil, entree, dossier) {
  const fichier = String(entree?.file_path ?? entree?.path ?? '');
  const court = fichier ? path.relative(dossier, path.resolve(dossier, fichier)) : '';
  if (outil === 'Read') {
    if (/\.(png|jpe?g|webp)$/i.test(fichier)) return {icone: 'film', texte: `regarde ${/accroche/.test(court) ? 'les trois premières secondes' : /fin/.test(court) ? 'la fin de la vidéo' : 'les images de la vidéo'}`};
    if (/SKILL\.md|skills\//.test(fichier)) return {icone: 'outil', texte: `relit la compétence ${path.basename(path.dirname(fichier))}`};
    if (/reperes/.test(court)) return {icone: 'texte', texte: 'relit les repères des réseaux'};
    return {icone: 'texte', texte: `lit ${court || 'le dossier'}`};
  }
  if (outil === 'Skill') return {icone: 'outil', texte: `ouvre la compétence ${entree?.skill ?? entree?.name ?? ''}`.trim()};
  if (outil === 'WebSearch') return {icone: 'globe', texte: `cherche : ${String(entree?.query ?? '').slice(0, 90)}`};
  if (outil === 'WebFetch') { let hote = ''; try { hote = new URL(String(entree?.url)).hostname.replace(/^www\./, ''); } catch { /* adresse illisible */ } return {icone: 'globe', texte: `lit ${hote || 'une page'}`}; }
  if (outil === 'Write' || outil === 'Edit') return {icone: 'coche', texte: /donnees[\\/]/.test(court) ? 'range ce qu’elle a lu' : 'écrit sa réponse'};
  // Treg, en lecture : le profil du créateur
  const treg = /^mcp__(?:treg|claude_ai_Treg)__(\w+)$/.exec(outil);
  if (treg) {
    const id = String(entree?.endpoint_id ?? '');
    const reseau = {youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn'}[id.split('.')[0]];
    if (treg[1] === 'my_tools') return {icone: 'globe', texte: 'regarde quels réseaux sont reliés'};
    if (treg[1] !== 'call') return {icone: 'globe', texte: `prépare la lecture${reseau ? ` de ${reseau}` : ''}`};
    return {icone: 'globe', texte: /comments/.test(id) ? `lit des commentaires${reseau ? ` sur ${reseau}` : ''}` : /insights/.test(id) ? `lit les statistiques${reseau ? ` de ${reseau}` : ''}` : /profile/.test(id) ? `regarde ton compte${reseau ? ` ${reseau}` : ''}` : `lit tes vidéos${reseau ? ` sur ${reseau}` : ''}`};
  }
  if (outil === 'Bash') {
    const c = String(entree?.command ?? '');
    return {icone: /curl|ffmpeg/.test(c) ? 'film' : 'texte', texte: /curl/.test(c) ? 'télécharge des miniatures' : /ffmpeg/.test(c) ? 'tire des images d’une vidéo' : /python/.test(c) ? 'calcule ce qui a marché' : 'consulte le dossier'};
  }
  return {icone: 'etincelle', texte: 'réfléchit'};
}

/**
 * Lance une consultation. Renvoie tout de suite ; l'avancement se lit avec etatConseil(cle).
 *  cle         identifiant de la consultation (une seule à la fois par clé)
 *  dossier     le dossier préparé par Dérush (l'IA y travaille)
 *  consigne    la demande (envoyée comme message)
 *  systeme     les règles permanentes (ajoutées aux consignes de l'IA)
 *  competences les noms des compétences à relier
 *  web         true : l'IA peut chercher sur le web (les tendances)
 *  treg        true : l'IA reçoit Treg, et lui seul, pour lire les comptes de l'humain (profil du créateur)
 *  terminal    true : l'IA a un terminal (télécharger des miniatures, calculer)
 *  attendu     le fichier JSON que l'IA doit écrire dans le dossier
 *  valider     (objet) → objet nettoyé, ou lève une erreur si la réponse est inutilisable
 */
export function lancerConseil({cle, dossier, consigne, systeme, competences = [], web = false, treg = false, terminal = false, moteur = null, qualite = 'soigne', attendu = 'reponse.json', delaiMs = 12 * 60000, valider = (x) => x, surFin = null}) {
  const deja = CONSEILS.get(cle);
  if (deja?.etat === 'en_cours') return deja;
  const c = {etat: 'en_cours', moteur: moteur ?? 'claude', debut: Date.now(), etapes: [], proc: null, annule: false};
  CONSEILS.set(cle, c);
  const noter = (icone, texte) => {
    const dernier = c.etapes.at(-1);
    if (dernier?.texte === texte) return;
    c.etapes.push({t: Math.round((Date.now() - c.debut) / 1000), icone, texte});
  };
  (async () => {
    const etats = await etatIA();
    if (c.annule) throw new Error('Arrêté.'); // arrêté pendant cette vérification : l'IA ne part pas
    const m = IA[moteur] && etats[moteur]?.ok ? moteur : etats.choisi;
    const ia = etats[m];
    if (!ia?.ok) throw new Error(ia?.pourquoi ? `${ia.pourquoi} Ouvre Connexions pour brancher ton IA.` : 'Aucune IA n’est branchée. Ouvre Connexions pour brancher Claude, Codex ou Gemini.');
    c.moteur = m;
    const nom = IA[m].nom;
    if (treg && m === 'gemini') throw new Error('Avec Gemini, Dérush ne peut pas lire tes comptes (il n’a pas les outils Treg). Choisis Claude ou Codex pour cette analyse.');
    const reglage = reglageIA(m, qualite, null, null, ia.modeles ?? []);
    fs.mkdirSync(dossier, {recursive: true});
    const liees = relierCompetences(dossier, competences);
    const sortie = path.join(dossier, attendu);
    fs.rmSync(sortie, {force: true});
    const regles = `${systeme}\n\nCompétences reliées dans ce dossier : ${liees.join(', ') || 'aucune'}.\n`;
    fs.writeFileSync(path.join(dossier, 'CONSIGNES.md'), regles);
    fs.writeFileSync(path.join(dossier, 'AGENTS.md'), regles); // Codex et Gemini lisent ce fichier tout seuls
    // aucune clé : ici l'IA ne publie rien et ne fabrique rien (la clé Treg reste seulement quand l'appelant donne Treg)
    const env = envIA([DOSSIER_COMMANDES]);
    for (const k of ['ELEVENLABS_API_KEY', ...(treg ? [] : ['TREG_TOKEN'])]) delete env[k];
    noter('etincelle', `${nom} ouvre le dossier`);

    const textes = [];
    const lancer = (args, entree = consigne) => new Promise((ok, ko) => {
      if (c.annule) return ko(new Error('Arrêté.')); // arrêté avant le lancement, ou entre deux lancements
      const lireGemini = lecteurGemini();
      const {cmd, prefixe} = commandeLancement(ia.chemin);
      const l = preparerLancement(cmd, [...prefixe, ...args], {cwd: dossier, env, stdio: ['pipe', 'pipe', 'pipe'], detached: !WINDOWS, windowsHide: true});
      const proc = spawn(l.cmd, l.args, l.options);
      c.proc = proc;
      garderEveille(proc.pid);
      let tampon = '';
      let err = '';
      let fin = null;
      let intrus = null;
      const garde = setTimeout(() => { c.tropLong = true; arreterArbre(proc); }, delaiMs);
      // Node décode lui-même : un caractère accentué coupé entre deux morceaux attend sa fin au lieu de devenir « �� »
      proc.stdout.setEncoding('utf8');
      proc.stderr.setEncoding('utf8');
      proc.stdout.on('data', (d) => {
        tampon += d;
        let i;
        while ((i = tampon.indexOf('\n')) >= 0) {
          const ligne = tampon.slice(0, i);
          tampon = tampon.slice(i + 1);
          let j;
          try { j = JSON.parse(ligne); } catch { continue; }
          if (m === 'claude') {
            // garde : un connecteur du compte Claude ne doit jamais être là (aucun n'est donné ici)
            if (j.type === 'system' && j.subtype === 'init') {
              const vus = (j.mcp_servers ?? []).filter((s) => !['needs-auth', 'failed', 'disabled'].includes(s.status)).map((s) => s.name).filter((n) => !(treg && NOMS_TREG.includes(n)));
              if (vus.length) { intrus = vus; arreterArbre(proc); }
              const t = treg ? (j.mcp_servers ?? []).find((s) => NOMS_TREG.includes(s.name)) : null;
              if (t) noterConnecteurTreg(['connected', 'pending'].includes(t.status) ? 'connecte' : /auth/i.test(t.status) ? 'a_autoriser' : 'echec');
            }
            if (j.type === 'assistant') {
              for (const b of j.message?.content ?? []) {
                if (b.type === 'tool_use') { const x = decrire(b.name, b.input ?? {}, dossier); noter(x.icone, `${nom} ${x.texte}`); }
                if (b.type === 'text' && b.text?.trim()) textes.push(b.text.trim());
              }
            }
            if (j.type === 'result') fin = j;
          } else if (m === 'gemini') {
            const e = lireGemini(j);
            if (e.geste) { const x = decrire(e.geste.outil, e.geste.entree, dossier); noter(x.icone, `${nom} ${x.texte}`); }
            if (e.texte) textes.push(e.texte);
            if (e.fin) {
              if (e.fin.reponse) textes.push(e.fin.reponse);
              // rien n'a été dit et une action a été refusée (sans écran, agy ne peut pas demander) : c'est un échec
              const refus = !textes.length && e.fin.refus?.length ? `${nom} n’a pas eu le droit de ${e.fin.refus.map(refusGemini).join(', ')}.` : null;
              fin = e.fin.erreur || refus ? {erreur: e.fin.erreur ?? refus} : {ok: true};
            }
          } else {
            const e = lireEvenementCodex(j);
            if (e.geste) { const x = decrire(e.geste.outil, e.geste.entree, dossier); noter(x.icone, `${nom} ${x.texte}`); }
            if (e.texte) textes.push(e.texte);
            if (e.erreur) fin = {erreur: e.erreur};
            if (e.fin) fin = fin ?? {ok: true};
          }
        }
      });
      proc.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
      proc.on('error', (x) => { clearTimeout(garde); ko(new Error(`${nom} n’a pas pu se lancer : ${x.message}`)); });
      proc.on('close', (code) => {
        clearTimeout(garde);
        if (c.annule) return ko(new Error('Arrêté.'));
        if (c.tropLong) return ko(new Error(`${nom} a mis trop de temps. Réessaie, ou choisis la qualité « Rapide » dans Connexions.`));
        if (intrus) return ok({intrus});
        if (fin?.erreur) return ko(new Error(String(fin.erreur).slice(0, 400)));
        if (m === 'claude' && fin?.is_error) return ko(new Error(String(fin.result ?? 'Claude n’a pas pu répondre.').slice(0, 400)));
        if (!fin && code !== 0) return ko(new Error(`${nom} s’est arrêté sans répondre${err.trim() ? ` : ${err.trim().split('\n').slice(-2).join(' ').slice(0, 300)}` : ` (code ${code})`}.`));
        ok({fin});
      });
      proc.stdin.on('error', () => { /* l'IA s'est arrêtée avant de lire */ });
      proc.stdin.end(entree);
    });

    if (m === 'claude') {
      const base = ['-p', '--model', reglage.modele, '--effort', reglage.effort, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'auto', '--permission-prompts', 'none'];
      const outils = ['--append-system-prompt-file', path.join(dossier, 'CONSIGNES.md'), '--tools', 'Read', 'Write', 'Skill', ...(terminal ? ['Bash'] : []), ...(web ? ['WebSearch', 'WebFetch'] : [])];
      if (treg) {
        // Treg seul : par la clé s'il y en a une, sinon par le connecteur du compte Claude. Tout autre connecteur est
        // refusé par son nom ; s'il en apparaît un nouveau, on l'ajoute aux refusés et on relance (comme pour un montage).
        const f = path.join(dossier, '.derush-reglages.json');
        const cfg = configTregClaude(dossier);
        let noms = [...new Set([...refuses(), NOM_CONNECTEUR])].filter((n) => !NOMS_TREG.includes(n));
        for (let essai = 1; ; essai++) {
          fs.writeFileSync(f, JSON.stringify(reglagesClaudeTreg(noms)));
          const r = await lancer([...base, '--settings', f, ...(cfg ? ['--mcp-config', cfg] : []), ...outils]);
          if (!r.intrus) break;
          if (essai >= 4) throw new Error('Claude a démarré avec des connecteurs de ton compte que Dérush ne lui donne pas ici. Réessaie dans un instant.');
          refuser(r.intrus);
          noms = [...new Set([...noms, ...r.intrus])];
        }
      } else {
      let r = await lancer([...base, '--strict-mcp-config', '--mcp-config', JSON.stringify({mcpServers: {}}), ...outils]);
      if (r.intrus) {
        // des connecteurs du compte sont apparus malgré tout : on les refuse par leur nom, et on relance une fois
        const f = path.join(dossier, '.derush-reglages.json');
        fs.writeFileSync(f, JSON.stringify({deniedMcpServers: r.intrus.map((n) => ({serverName: n})), permissions: {deny: r.intrus.map((n) => `mcp__${n.replace(/[^a-zA-Z0-9_-]/g, '_')}`)}}));
        r = await lancer([...base, '--strict-mcp-config', '--mcp-config', JSON.stringify({mcpServers: {}}), '--settings', f, ...outils]);
        if (r.intrus) throw new Error('Claude a démarré avec des connecteurs de ton compte que Dérush ne lui donne pas ici. Réessaie dans un instant.');
      }
      }
    } else if (m === 'codex') {
      await lancer(argsCodex({session: null, reglage, ecrits: [], mcp: treg ? argsCodexTreg() : []}));
    } else {
      // Gemini : la consigne passe en argument (agy ne lit pas l'entrée standard), dans son bac à sable, avec des
      // permissions pour cette seule demande : écrire dans ce dossier, lire les outils de Dérush, et le web s'il est donné
      Object.assign(env, envGemini(env));
      await lancer(argsGemini({demande: consigne, modele: reglage.modele, reglages: reglagesGemini({ecrits: [dossier, os.tmpdir()], lus: outilsLisibles(), web})}), '');
    }

    // la réponse : le fichier demandé, sinon le JSON de son dernier message
    let reponse = lireJson(sortie);
    if (!reponse || typeof reponse !== 'object') reponse = extraireJson(textes.slice().reverse().join('\n\n'));
    if (!reponse || typeof reponse !== 'object') throw new Error(`${nom} n’a pas rendu de réponse lisible. Réessaie.`);
    return valider(reponse);
  })().then((reponse) => {
    c.reponse = reponse;
    c.etat = 'fini';
  }, (e) => {
    c.erreur = e?.message ?? String(e);
    c.etat = 'erreur';
  }).finally(() => {
    c.fin = Date.now();
    c.proc = null;
    try { surFin?.(c.etat === 'fini' ? null : new Error(c.erreur), c.reponse ?? null, c); } catch { /* l'appelant gère */ }
  });
  return c;
}
