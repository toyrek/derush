// Dérush — le tableau de bord du créateur, par espace (Moi, chaque client) : ses montages livrés et publiés, leurs
// vues et leur écart à la médiane du compte, ce qui marche (la recette), les idées de sujets, ses séries, son carnet.
// Tout est lu sur l'ordinateur (fiches, suivi, recette) : rien n'est demandé en ligne pour l'afficher.
import fs from 'node:fs';
import path from 'node:path';
import {trouverEspace, apprend, dossierEspace, METIERS} from './espaces.mjs';
import {joindre, statistiques, lireRecette} from './recette.mjs';
import {ficheParCle} from './fiches.mjs';
import {lireSuivi} from './suivi.mjs';
import {listerSeries} from './series.mjs';
import {lireCarnet} from './carnet.mjs';

const JOUR = 86400e3;
const NOMS_RESEAUX = {youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', linkedin: 'LinkedIn'};

/** Les chiffres du tableau de bord d'un espace, sur une période (« 30 », « 90 » jours, ou « tout »). */
export function tableauDeBord(espaceId, {periode = '90', maintenant = Date.now()} = {}) {
  const e = trouverEspace(espaceId);
  if (!e) throw new Error('Espace inconnu.');
  const jours = periode === 'tout' ? Infinity : Math.max(1, Number(periode) || 90);
  const depuis = maintenant - jours * JOUR;
  const lignes = apprend(e) ? joindre(e.id) : [];
  const dansPeriode = lignes.filter((l) => Date.parse(l.fiche.quand) >= depuis);
  const pubs = dansPeriode.flatMap((l) => l.publications);
  const multiples = dansPeriode.map((l) => l.multiple).filter((x) => x != null);
  const suivi = apprend(e) ? lireSuivi(e.id) : {medianes: {}};
  const videos = dansPeriode.map((l) => ({
    cle: l.fiche.cle, titre: l.fiche.titre || l.fiche.projet, projet: l.fiche.projet, dossier: l.fiche.projet_dossier ?? null, video: l.fiche.video ?? null, quand: l.fiche.quand, duree_s: l.fiche.duree_s,
    genre: l.fiche.genre, serie: l.fiche.serie ?? null, accroche: l.fiche.accroche, note: l.fiche.note, mot: l.fiche.mot, ia: l.fiche.ia,
    vignettes: !!(l.fiche.vignettes && fs.existsSync(l.fiche.vignettes)),
    publications: l.publications.map((p) => ({reseau: p.reseau, lien: p.lien, publie_le: p.publie_le, vues: p.derniere?.vues ?? null, jaime: p.derniere?.jaime ?? null,
      commentaires: p.derniere?.commentaires ?? null, partages: p.derniere?.partages ?? null, multiple: p.multiple, source_mediane: p.source_mediane ?? null, lectures: (p.lectures ?? []).map((x) => ({jours: x.jours, vues: x.vues ?? null})), suivi: p.suivi,
      // Treg ne la retrouve pas (brouillon jamais publié, vidéo retirée ou privée) : Dérush a cessé de la chercher
      introuvable: !!p.introuvable})),
    multiple: l.multiple, vues: l.vues,
  }));
  const meilleure = [...videos].filter((v) => v.multiple != null).sort((a, b) => b.multiple - a.multiple)[0] ?? null;
  const moinsBonne = [...videos].filter((v) => v.multiple != null).sort((a, b) => a.multiple - b.multiple)[0] ?? null;
  const stats = apprend(e) ? statistiques(e.id, {lignes}) : null; // les mêmes lignes : l'espace n'est croisé qu'une fois
  return {
    espace: {id: e.id, nom: e.nom, type: e.type, metier: e.metier ? {...e.metier, nom: METIERS[e.metier.type]?.nom ?? e.metier.type} : null, apprend: apprend(e)},
    periode: periode === 'tout' ? 'tout' : String(jours),
    chiffres: {
      montages: dansPeriode.length,
      publies: dansPeriode.filter((l) => l.publications.length).length,
      vues: pubs.reduce((s, p) => s + (p.derniere?.vues ?? 0), 0),
      multiple_median: (() => { const t = [...multiples].sort((a, b) => a - b); if (!t.length) return null; const m = Math.floor(t.length / 2); return Math.round((t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2) * 100) / 100; })(),
      aimes: dansPeriode.filter((l) => l.fiche.note === 1).length,
      pas_aimes: dansPeriode.filter((l) => l.fiche.note === -1).length,
    },
    medianes: suivi.medianes ?? {},
    meilleure: meilleure ? {titre: meilleure.titre, multiple: meilleure.multiple, vues: meilleure.vues} : null,
    moins_bonne: moinsBonne && moinsBonne !== meilleure ? {titre: moinsBonne.titre, multiple: moinsBonne.multiple, vues: moinsBonne.vues} : null,
    videos,
    recette: stats ? {groupes: stats.groupes.filter((g) => g.verdict !== 'neutre').slice(0, 12), n_mesures: stats.n_mesures, n_montages: stats.n_montages, ia: lireRecette(e.id)} : null,
    series: e.type === 'neutre' ? [] : listerSeries(e.id),
    carnet: e.type === 'neutre' ? 0 : lireCarnet(e.id).length,
    cle_treg: !!process.env.TREG_TOKEN,
  };
}

/**
 * Le chemin des vignettes d'une vidéo d'un espace (pour l'image du tableau de bord), ou null. Demandé une fois par
 * vidéo affichée : seule sa fiche est lue (gardée en mémoire), jamais le suivi ni le croisement de tout l'espace.
 */
export function vignettesDe(espaceId, cle) {
  const f = ficheParCle(espaceId, cle)?.vignettes;
  return typeof f === 'string' && /\.vignettes\.jpg$/.test(f) && fs.existsSync(f) ? f : null;
}

/** Une case d'un tableau Markdown : sur une ligne, et sans « | » qui couperait la colonne. */
const cellule = (x) => String(x ?? '—').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim() || '—';

/** Le rapport du mois d'un client (ou de soi), en Markdown, prêt à envoyer : rangé dans espaces/<id>/rapports/. */
export function rapport(espaceId, {periode = '30'} = {}) {
  const t = tableauDeBord(espaceId, {periode});
  const L = [`# ${t.espace.type === 'client' ? `Rapport pour ${t.espace.nom}` : 'Mon bilan'} — ${t.periode === 'tout' ? 'depuis le début' : `${t.periode} derniers jours`}`, '',
    `- Vidéos montées : ${t.chiffres.montages}`, `- Vidéos publiées : ${t.chiffres.publies}`, `- Vues : ${t.chiffres.vues.toLocaleString('fr-FR')}`,
    ...(t.chiffres.multiple_median != null ? [`- La vidéo du milieu fait ${String(t.chiffres.multiple_median).replace('.', ',')} fois la médiane de référence (la moitié des vidéos font plus, l’autre moitié moins)`] : []), ''];
  if (t.meilleure) L.push(`**La plus forte** : « ${t.meilleure.titre} » (${String(t.meilleure.multiple).replace('.', ',')} fois la médiane${t.meilleure.vues ? `, ${t.meilleure.vues.toLocaleString('fr-FR')} vues` : ''}).`, '');
  if (t.videos.length) {
    L.push('| Vidéo | Publiée | Vues | Écart à la médiane |', '|---|---|---|---|');
    for (const v of t.videos) L.push(`| ${cellule(v.titre)} | ${v.publications.map((p) => NOMS_RESEAUX[p.reseau] ?? p.reseau).join(', ') || '—'} | ${v.vues?.toLocaleString('fr-FR') ?? '—'} | ${v.multiple != null ? `× ${String(v.multiple).replace('.', ',')}` : '—'} |`);
    L.push('');
  }
  const ia = t.recette?.ia;
  if (ia?.resume) L.push('## Ce qu’on en retient', '', ia.resume, '');
  if (ia?.idees?.length) L.push('## Prochaines idées', '', ...ia.idees.slice(0, 5).map((x) => `- **${x.sujet}** : ${x.pourquoi ?? ''}`), '');
  const texte = `${L.join('\n').trimEnd()}\n`;
  const dossier = path.join(dossierEspace(t.espace.id), 'rapports');
  fs.mkdirSync(dossier, {recursive: true});
  // le jour d'ici (pas l'heure universelle) et la période dans le nom ; un bilan déjà rangé n'est jamais écrasé
  const j = new Date();
  const nom = `rapport-${j.getFullYear()}-${String(j.getMonth() + 1).padStart(2, '0')}-${String(j.getDate()).padStart(2, '0')}-${t.periode === 'tout' ? 'depuis-le-debut' : `${t.periode}-jours`}`;
  let fichier = path.join(dossier, `${nom}.md`);
  for (let n = 2; fs.existsSync(fichier); n++) fichier = path.join(dossier, `${nom}-${n}.md`);
  fs.writeFileSync(fichier, texte);
  return {texte, fichier};
}
