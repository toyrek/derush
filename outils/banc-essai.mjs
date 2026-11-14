#!/usr/bin/env node
// Dérush — le banc d'essai : la même demande, sur les mêmes vidéos, montée par une IA, puis notée toute seule. Pour
// savoir si un changement de Dérush rend les montages meilleurs (ou pires) sans les regarder un par un.
//
// Usage : node outils/banc-essai.mjs <cas.json> --support <dossier> [--sortie <dossier>] [--qualite rapide] [--modele <id>]
//        [--moteur claude] [--port 4344] [--seulement "<nom>"] [--max-minutes 60]
//
// cas.json : [{"nom": "Chronique manga", "medias": ["/chemin/rush.mp4"], "consigne": "Voici mes rushs…"}]
//   (voir outils/banc-essai.exemple.json). Les chemins de tes vidéos restent chez toi : ce fichier ne va pas dans le dépôt.
// --support : un dossier de Dérush d'essai (moteurs, compétences, node_modules reliés par des liens, voir AGENTS.md),
//   jamais celui de la vraie installation : le banc refuse.
//
// Chaque cas : un projet neuf dans une bibliothèque à part (<sortie>/biblio), les médias importés (hors timeline), la
// préparation attendue, la consigne envoyée à l'IA demandée, puis la vidéo livrée contrôlée (derush-controle et
// derush-son mesurer). Le bilan : <sortie>/bilan-<date>.json et .md, et une ligne par cas dans <sortie>/historique.jsonl
// pour comparer d'un jour à l'autre.
//
// ATTENTION : chaque cas lance la vraie IA, sur le compte de la personne. Par défaut « rapide » (Sonnet) : quelques
// minutes par cas. Opus ou Fable au niveau Maximum : plus d'une heure par cas, seulement si la personne le demande.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {aide, options} from './commande.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const AIDE = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.replace(/^\/\/ ?/, '')).join('\n');

/** La note d'un montage, sur 100 : un repère pour comparer, pas un jugement de goût. */
export function noter(m) {
  let n = 100;
  const pourquoi = [];
  const retirer = (pts, raison) => { if (pts > 0) { n -= pts; pourquoi.push(`−${pts} ${raison}`); } };
  if (!m.video) return {note: 0, pourquoi: ['aucune vidéo livrée']};
  retirer(Math.min(40, 10 * (m.textes_a_corriger ?? 0)), `${m.textes_a_corriger} texte(s) à corriger (mots collés, coupés)`);
  if (m.accroche_pct != null && m.accroche_pct < 7) retirer(10, `accroche discrète (${m.accroche_pct} %)`);
  if (m.brillance_db != null && (m.brillance_db < -16 || m.brillance_db > -8)) retirer(10, `voix ${m.brillance_db < -16 ? 'sourde' : 'qui siffle'} (${m.brillance_db} dB)`);
  const rythme = (m.pauses ?? 0) + (m.hesitations ?? 0) + (m.redites ?? 0) + (m.reprises ?? 0);
  retirer(Math.min(15, 3 * rythme), `${rythme} accroc(s) de rythme (pauses, « euh », redites)`);
  if (m.lufs != null && Math.abs(m.lufs + 14) > 1) retirer(5, `volume ${m.lufs} LUFS (cible −14)`);
  if (m.crete_dbtp != null && m.crete_dbtp > -0.9) retirer(5, `crête ${m.crete_dbtp} dBTP`);
  return {note: Math.max(0, n), pourquoi};
}

/** L'adresse de la page d'un Dérush d'essai lancé sur le dossier `support` : avec la clé de la fenêtre (« /?c=… ») quand
 *  ce dossier en porte une. Le serveur ne donne sa page, et le jeton qu'elle porte, qu'à l'adresse qui a la clé
 *  (cleFenetre, lib/serveur.mjs) ; sans clé dans le dossier, la page sans clé. */
export function adressePage(base, support) {
  try {
    const c = fs.readFileSync(path.join(path.resolve(support), 'cle-fenetre'), 'utf8').trim();
    if (/^[a-f0-9]{48}$/.test(c)) return `${base}/?c=${c}`;
  } catch { /* pas (encore) de clé */ }
  return `${base}/`;
}

/** Le chemin d'un dossier tel que le disque le voit, même s'il n'existe pas encore : liens suivis, casse et accents
 *  ramenés à une seule forme (« Dérush » et « dérush » sont le même dossier sur Mac et Windows). */
function cheminReel(p) {
  let haut = path.resolve(p);
  const reste = [];
  for (;;) {
    try { return path.join(fs.realpathSync.native(haut), ...reste).normalize('NFC').toLowerCase(); } catch { /* pas encore là */ }
    const parent = path.dirname(haut);
    if (parent === haut) return path.resolve(p).normalize('NFC').toLowerCase();
    reste.unshift(path.basename(haut));
    haut = parent;
  }
}

/** Vrai si `support` est le dossier de la vraie installation (`vrai`), par un autre nom ou un lien, ou un dossier rangé dedans. */
export function dossierInterdit(support, vrai) {
  if (!vrai) return false;
  try {
    const x = fs.statSync(support, {bigint: true}), y = fs.statSync(vrai, {bigint: true});
    if (x.ino && x.dev === y.dev && x.ino === y.ino) return true;
  } catch { /* l'un des deux n'existe pas encore */ }
  const s = cheminReel(support), v = cheminReel(vrai);
  return s === v || s.startsWith(v.endsWith(path.sep) ? v : v + path.sep);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  aide(args, AIDE, {siVide: true});
  const {opt} = options(args);
  const support = opt('--support') ?? process.env.DERUSH_SUPPORT;
  const sortie = path.resolve(opt('--sortie') ?? path.join(os.tmpdir(), 'derush-banc'));
  const qualite = opt('--qualite') ?? 'rapide';
  const modele = opt('--modele') ?? null;
  const moteur = opt('--moteur') ?? 'claude';
  const port = Number(opt('--port') ?? 4344);
  const seulement = opt('--seulement');
  const maxMin = Number(opt('--max-minutes') ?? 60);
  const fichierCas = args.find((x) => !x.startsWith('--'));
  const stop = (m) => { console.error(m); process.exit(1); };
  if (!fichierCas) stop('Usage : node outils/banc-essai.mjs <cas.json> --support <dossier d’essai> (--help)');
  if (!support) stop('Donne --support <dossier> : un dossier de Dérush d’essai, jamais celui de la vraie installation.');
  const vrai = (() => { const env = {...process.env}; delete env.DERUSH_SUPPORT; const r = spawnSync(process.execPath, ['-e', "import('./lib/plateforme.mjs').then((m) => console.log(m.dossierSupport()))"], {cwd: RACINE, env, encoding: 'utf8'}); return r.stdout.trim(); })();
  if (dossierInterdit(support, vrai)) stop('Ce dossier est celui de la vraie installation de Dérush (ou un dossier rangé dedans) : le banc ne s’en sert jamais. Prends un dossier d’essai.');
  let cas = JSON.parse(fs.readFileSync(fichierCas, 'utf8'));
  if (seulement) cas = cas.filter((c) => c.nom === seulement);
  if (!cas.length) stop('Aucun cas à jouer.');
  for (const c of cas) for (const m of c.medias ?? []) if (!fs.existsSync(m)) stop(`Média introuvable (${c.nom}) : ${m}`);

  const biblio = path.join(sortie, 'biblio');
  fs.mkdirSync(biblio, {recursive: true});
  const journal = fs.openSync(path.join(sortie, 'serveur.log'), 'a');
  const env = {...process.env, DERUSH_SUPPORT: path.resolve(support), DERUSH_BIBLIOTHEQUE: biblio, DERUSH_SANS_NAVIGATEUR: '1', DERUSH_SANS_MAJ: '1'};
  const base = `http://127.0.0.1:${port}`;
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  // Le port doit être libre : un Dérush qui y tourne déjà (l'app ouverte de la personne, un autre essai) ne doit jamais
  // être piloté par le banc. Celui du banc s'arrêterait sans rien dire et le banc travaillerait dans la vraie bibliothèque.
  const pris = await fetch(`${base}/api/ping`, {signal: AbortSignal.timeout(1500)}).then(() => true, () => false);
  if (pris) stop(`Le port ${port} est déjà pris (un Dérush ouvert ?) : choisis un autre --port.`);
  const serveur = spawn(process.execPath, [path.join(RACINE, 'derush.mjs'), '--port', String(port)], {cwd: RACINE, env, stdio: ['ignore', journal, journal]});
  const vivant = () => serveur.exitCode === null && serveur.signalCode === null;
  let jeton = null;
  // la clé est relue à chaque tour : le Dérush d'essai l'écrit (ou la refait) dans son dossier en démarrant
  for (let i = 0; i < 60 && !jeton && vivant(); i++) {
    try { jeton = (await (await fetch(adressePage(base, support))).text()).match(/name="derush-jeton" content="([^"]+)"/)?.[1] ?? null; } catch { /* pas encore prêt */ }
    if (!jeton) await dormir(1000);
  }
  if (!jeton) { serveur.kill(); stop('Le Dérush d’essai ne répond pas (voir serveur.log).'); }
  const h = {'content-type': 'application/json', 'x-derush-jeton': jeton, 'x-derush-fenetre': 'banc-essai'};
  // celui qui répond doit être le Dérush du banc : toujours en marche, et sur la bibliothèque du banc
  const sienne = await fetch(`${base}/api/etat`, {headers: h}).then((r) => r.json()).then((e) => e.bibliotheque, () => null);
  if (!vivant() || sienne !== biblio) { serveur.kill(); stop(`Le Dérush qui répond sur le port ${port} n’est pas celui du banc : choisis un autre --port.`); }
  const api = async (m, chemin, corps) => {
    if (m !== 'GET') await fetch(`${base}/api/etat`, {headers: h});
    const r = await fetch(base + chemin, {method: m, headers: h, body: m === 'GET' ? undefined : JSON.stringify(corps ?? {})});
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch { j = {texte: t}; }
    if (!r.ok) throw new Error(`${chemin} : ${r.status} ${j.erreur ?? t.slice(0, 200)}`);
    return j;
  };
  const lancerOutil = (outil, a, cwd) => {
    const r = spawnSync(process.execPath, [path.join(RACINE, 'outils', outil), ...a], {cwd, env, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 20 * 60e3});
    try { return JSON.parse(r.stdout); } catch { return {erreur: (r.stderr || r.stdout || '').slice(0, 300)}; }
  };

  const quand = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const resultats = [];
  try {
    for (const c of cas) {
      const t0 = Date.now();
      console.log(`\n▶ ${c.nom} (${moteur} ${qualite}${modele ? ` ${modele}` : ''})`);
      const projet = await api('POST', '/api/projets', {titre: `${c.nom} — banc ${quand}`});
      await api('POST', '/api/medias', {chemins: c.medias});
      // la préparation (aperçu, texte, mesures, incrustes…)
      for (let i = 0; i < 600; i++) {
        const e = await api('GET', '/api/etat');
        const ms = e.projet?.medias ?? [];
        if (ms.length && ms.every((m) => m.etat === 'pret' || m.etat === 'erreur')) break;
        await dormir(2000);
      }
      console.log(`  préparé en ${Math.round((Date.now() - t0) / 1000)} s`);
      const tIA = Date.now();
      await api('POST', '/api/claude/demander', {message: c.consigne ?? 'Voici mes rushs. Regarde-les bien, fais le montage et améliore la vidéo au maximum.', moteur, qualite, modele, nouveau: true});
      let etat = null;
      for (let i = 0; i < maxMin * 6; i++) {
        await dormir(10000);
        etat = await api('GET', '/api/claude');
        if (!etat.en_cours) break;
        if (i % 6 === 5) console.log(`  … ${Math.round((Date.now() - tIA) / 60000)} min : ${etat.en_cours.activite?.at(-1)?.texte ?? etat.en_cours.etape}`);
      }
      if (etat?.en_cours) { await api('POST', '/api/claude/arreter'); console.log('  arrêté : trop long'); }
      const v = etat?.versions?.at(-1) ?? null;
      const rep = (etat?.echanges ?? []).filter((x) => x.role !== 'humain').at(-1) ?? null;
      const m = {cas: c.nom, quand, moteur, qualite, modele: v?.modele ?? modele, duree_ia_min: Math.round((Date.now() - tIA) / 6000) / 10, video: v?.chemin ?? null,
        duree_video_s: v?.duree ?? null, erreur: rep?.erreur ? String(rep.texte ?? '').slice(0, 300) : null};
      if (v?.chemin) {
        const pack = etat.atelier_chemin;
        const ctl = lancerOutil('derush-controle.mjs', [v.chemin, ...(pack ? ['--pack', pack] : []), '--sortie', path.join(sortie, 'controles', `${c.nom.replace(/[^\p{L}\p{N}]+/gu, '-')}-${quand}`)], pack ?? sortie);
        const son = lancerOutil('derush-son.mjs', ['mesurer', v.chemin], sortie);
        Object.assign(m, {
          textes_a_corriger: ctl.a_corriger?.length ?? null, accroche_pct: ctl.accroche?.hauteur_pct ?? null, accroche: ctl.accroche?.texte ?? null,
          brillance_db: ctl.voix?.brillance_db ?? son.brillance_db ?? null, pauses: ctl.rythme?.pauses?.length ?? null, hesitations: ctl.rythme?.hesitations?.length ?? null,
          redites: ctl.rythme?.redites?.length ?? null, reprises: ctl.rythme?.reprises?.length ?? null, gain_possible_s: ctl.rythme?.gain_possible_s ?? null,
          lufs: son.lufs ?? null, crete_dbtp: son.crete_dbtp ?? null, a_regarder: ctl.a_regarder ?? [], a_corriger: ctl.a_corriger ?? [],
          controles_derush: (v.controles ?? []).map((x) => `${x.ok ? '✓' : '⚠'} ${x.t}`), reponse_ia: String(rep?.texte ?? '').slice(0, 1500),
        });
      }
      Object.assign(m, noter(m));
      resultats.push(m);
      fs.appendFileSync(path.join(sortie, 'historique.jsonl'), `${JSON.stringify(m)}\n`);
      console.log(`  note ${m.note}/100 ${m.pourquoi.length ? `(${m.pourquoi.join(' ; ')})` : ''}`);
    }
  } finally {
    // seulement le serveur lancé par le banc, s'il tourne encore : jamais un autre Dérush venu sur ce port
    if (vivant()) try { await api('POST', '/api/quitter'); } catch { serveur.kill(); }
  }
  // le bilan, lisible
  const l = ['# Banc d’essai Dérush', '', `${quand} — ${moteur} ${qualite}${modele ? ` (${modele})` : ''}`, '',
    '| Cas | Note | Durée IA | Vidéo | Textes à corriger | Accroche | Voix (aigus) | Rythme (pauses, euh, redites) | Son |', '|---|---|---|---|---|---|---|---|---|'];
  for (const r of resultats) {
    l.push(`| ${r.cas} | ${r.note}/100 | ${r.duree_ia_min} min | ${r.duree_video_s ? `${Math.round(r.duree_video_s * 10) / 10} s` : '—'} | ${r.textes_a_corriger ?? '—'} | ${r.accroche_pct != null ? `${r.accroche_pct} %` : '—'} | ${r.brillance_db ?? '—'} dB | ${[r.pauses, r.hesitations, r.redites].map((x) => x ?? '—').join(', ')} | ${r.lufs ?? '—'} LUFS |`);
  }
  for (const r of resultats) if (r.pourquoi.length || r.a_regarder?.length) l.push('', `## ${r.cas}`, '', ...r.pourquoi.map((x) => `- ${x}`), ...(r.a_regarder ?? []).map((x) => `- À regarder : ${x}`));
  fs.writeFileSync(path.join(sortie, `bilan-${quand}.json`), JSON.stringify(resultats, null, 2));
  fs.writeFileSync(path.join(sortie, `bilan-${quand}.md`), `${l.join('\n')}\n`);
  console.log(`\nBilan : ${path.join(sortie, `bilan-${quand}.md`)}`);
}
