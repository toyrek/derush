#!/usr/bin/env node
// Dérush — recouper : l'IA choisit ses passages, cet outil refait le montage du pack en conséquence.
//
//   node remotion/recouper.mjs coupes.json          (depuis le dossier du pack)
//   node remotion/recouper.mjs --origine            remet le montage d'origine
//
// coupes.json est la liste des passages à garder, dans l'ordre de la vidéo. Les temps sont ceux du RUSH
// (les mêmes que `source.entree` / `source.sortie` dans montage.json, et que dans transcriptions/ et analyse/) :
//
//   [
//     {"plan": "P1", "de": 12.4, "a": 18.9, "titre": "L'accroche"},
//     {"plan": "P2", "de": 3.0, "a": 7.5},
//     {"case": "B1"},
//     {"plan": "P1", "de": 40.2, "a": 44.0}
//   ]
//
// - "plan" : un plan du montage d'origine (P1, P2… ; dans un pack sans découpe, le nom du rush : M1, M2…). On peut
//   reprendre plusieurs fois le même, dans n'importe quel ordre.
// - "de" / "a" : le début et la fin du passage, en secondes du rush. Sans eux, le plan est gardé en entier.
//   Pour une photo, seule la durée (a − de) compte. Un passage peut dépasser le plan d'origine, dans ses poignées.
// - "case" : une case à créer du montage d'origine, gardée à cet endroit avec sa durée.
// - "titre", "notes" : facultatifs.
//
// L'outil refait, dans `montage.json`, les plans (`montage`) et la durée (`sortie`), et dans `sous-titres/` les mots
// recalés sur le nouveau montage (lus dans `transcriptions/` : un passage allongé garde tous ses mots). Tout le reste
// de `montage.json` est gardé tel que tu l'as laissé : le style, les effets (`habillage`), les notes, les plans
// par-dessus (les mots de la voix off suivent la place que tu leur as donnée). Les plans d'origine sont dans
// `montage.origine.json` : on peut relancer l'outil autant de fois qu'on veut, il repart toujours d'eux. Le kit
// (`node remotion/rendre.mjs Montage rendu/final.mp4`) monte ensuite exactement ces passages.
// `--origine` remet tout `montage.json` et `sous-titres/` comme au départ, tes changements compris.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const PACK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const f = (...p) => path.join(PACK, ...p);
const lire = (chemin) => JSON.parse(fs.readFileSync(chemin, 'utf8'));
const ecrire = (chemin, objet) => fs.writeFileSync(chemin, `${JSON.stringify(objet, null, 1)}\n`);
const arrondi = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;
const p2 = (n) => String(n).padStart(2, '0');
const tc = (image, fps) => {
  const base = Math.round(fps);
  const i = Math.max(0, Math.round(image));
  const s = Math.floor(i / base);
  return `${p2(Math.floor(s / 3600))}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}:${p2(i % base)}`;
};
const temps = (image, fps) => ({s: arrondi(image / fps), image, tc: tc(image, fps)});
const tempsSource = (s, fps) => ({s: arrondi(s), image: Math.round(s * fps), tc: tc(Math.round(s * fps), fps)});
const horo = (s, sep) => {
  const ms = Math.max(0, Math.round(s * 1000));
  return `${p2(Math.floor(ms / 3600000))}:${p2(Math.floor(ms / 60000) % 60)}:${p2(Math.floor(ms / 1000) % 60)}${sep}${String(ms % 1000).padStart(3, '0')}`;
};
const erreur = (texte) => { console.error(`✗ ${texte}`); process.exit(1); };
/** Recolle les mots comme une phrase (pas d'espace avant une apostrophe ni avant la ponctuation). */
const phrase = (mots) => mots.map((w) => w.t).join(' ').replace(/\s+(['’])/g, '$1').replace(/(['’])\s+/g, '$1').replace(/\s+([,.…])/g, '$1').replace(/\s+(-\p{L})/gu, '$1').trim();
function couperLignes(texte, max) {
  const lignes = [];
  let l = '';
  for (const m of texte.split(' ')) {
    if (l && `${l} ${m}`.length > max) { lignes.push(l); l = m; } else l = l ? `${l} ${m}` : m;
  }
  if (l) lignes.push(l);
  return lignes;
}
function sousTitres(mots) {
  const cues = [];
  let c = null;
  for (const w of mots) {
    if (w.evenement) continue;
    const coupe = !c || w.plan !== c.plan || w.debut - c.fin > 0.55 || `${c.texte} ${w.t}`.length > 84 || w.fin - c.debut > 5.5 || /[.!?…][»”"]?$/.test(c.dernier);
    if (coupe) {
      if (c) cues.push(c);
      c = {debut: w.debut, fin: w.fin, mots: [w], texte: w.t, dernier: w.t, plan: w.plan};
    } else {
      c.mots.push(w);
      c.texte += ` ${w.t}`;
      c.fin = w.fin;
      c.dernier = w.t;
    }
  }
  if (c) cues.push(c);
  cues.forEach((q, k) => {
    const suiv = cues[k + 1];
    if (q.fin - q.debut < 0.8) q.fin = suiv ? Math.min(q.debut + 0.8, suiv.debut) : q.debut + 0.8;
    if (suiv && q.fin > suiv.debut) q.fin = suiv.debut;
    q.lignes = couperLignes(phrase(q.mots), 42);
  });
  return cues;
}
/**
 * Une seule voix à la fois dans les sous-titres (la même règle que Dérush quand il prépare le pack) : la voix off
 * (`voixOff`, les ids de ses plans par-dessus) passe devant les plans qu'elle recouvre ; sinon, la voix qui parlait la
 * première finit sa phrase. Sans cela, les sous-titres changent de voix à chaque mot.
 */
function uneVoixALaFois(mots, voixOff) {
  const phrases = [];
  const enCours = new Map();
  for (const w of mots) {
    if (w.evenement) continue;
    let q = enCours.get(w.plan);
    if (!q || w.debut - q.fin >= 0.6) {
      q = {plan: w.plan, debut: w.debut, fin: w.fin, mots: []};
      phrases.push(q);
      enCours.set(w.plan, q);
    }
    q.mots.push(w);
    q.fin = Math.max(q.fin, w.fin);
  }
  if (new Set(phrases.map((q) => q.plan)).size < 2) return mots;
  phrases.sort((a, b) => Number(voixOff.has(b.plan)) - Number(voixOff.has(a.plan)) || a.debut - b.debut);
  const prises = [];
  const retires = new Set();
  for (const q of phrases) {
    const gardes = q.mots.filter((w) => {
      const c = (w.debut + w.fin) / 2;
      return !prises.some((x) => x.plan !== q.plan && c >= x.debut && c < x.fin);
    });
    for (const w of q.mots) if (!gardes.includes(w)) retires.add(w);
    if (gardes.length) prises.push({plan: q.plan, debut: gardes[0].debut, fin: gardes.at(-1).fin});
  }
  return retires.size ? mots.filter((w) => !retires.has(w)) : mots;
}
/** Écrit montage.srt et montage.vtt d'après les mots (temps du montage). */
function ecrireSousTitres(mots) {
  const cues = sousTitres(mots);
  fs.writeFileSync(fSrt, cues.map((q, n) => `${n + 1}\n${horo(q.debut, ',')} --> ${horo(q.fin, ',')}\n${q.lignes.join('\n')}\n`).join('\n'));
  fs.writeFileSync(fVtt, `WEBVTT\n\n${cues.map((q) => `${horo(q.debut, '.')} --> ${horo(q.fin, '.')}\n${q.lignes.join('\n')}\n`).join('\n')}`);
}

const arg = process.argv[2];
if (!arg) erreur('Usage : node remotion/recouper.mjs coupes.json   (ou --origine pour revenir au montage d’origine)');
const fMontage = f('montage.json');
const fOrigine = f('montage.origine.json');
const fMots = f('sous-titres', 'mots.json');
const fMotsOrigine = f('sous-titres', 'mots.origine.json');
const fSrt = f('sous-titres', 'montage.srt');
const fVtt = f('sous-titres', 'montage.vtt');
const double = (chemin) => chemin.replace(/(\.\w+)$/, '.origine$1');
if (!fs.existsSync(fMontage)) erreur(`montage.json introuvable dans ${PACK}`);
// la première fois, on met l'original de côté (montage.json, et les sous-titres .srt et .vtt tant qu'ils sont ceux du départ)
if (!fs.existsSync(fOrigine)) {
  fs.copyFileSync(fMontage, fOrigine);
  for (const x of [fSrt, fVtt]) if (fs.existsSync(x)) fs.copyFileSync(x, double(x));
}
if (!fs.existsSync(fMotsOrigine) && fs.existsSync(fMots)) fs.copyFileSync(fMots, fMotsOrigine);

if (arg === '--origine') {
  fs.copyFileSync(fOrigine, fMontage);
  if (fs.existsSync(fMotsOrigine)) fs.copyFileSync(fMotsOrigine, fMots);
  // les .srt et .vtt du départ : leur double, ou, pour un pack recoupé avant qu'on les garde, refaits d'après les mots
  if (fs.existsSync(double(fSrt)) && fs.existsSync(double(fVtt))) { fs.copyFileSync(double(fSrt), fSrt); fs.copyFileSync(double(fVtt), fVtt); }
  else if (fs.existsSync(fMotsOrigine)) ecrireSousTitres(lire(fMotsOrigine).mots ?? []);
  console.log('Montage d’origine remis en place : montage.json et sous-titres/ (mots.json, .srt, .vtt) sont comme au départ. Ce que tu avais changé dans montage.json (style, effets, plans par-dessus, notes) est revenu à l’original lui aussi.');
  process.exit(0);
}

// Les plans viennent de l'original ; tout le reste (style, effets, notes, plans par-dessus) vient du montage.json
// d'aujourd'hui : ce que l'IA y a changé entre deux recoupes n'est jamais effacé.
const O = lire(fOrigine);
let A;
try { A = lire(fMontage); } catch (e) { erreur(`montage.json est illisible (${e.message}) : corrige-le, ou reviens à l’original avec --origine.`); }
const motsOrigine = fs.existsSync(fMotsOrigine) ? lire(fMotsOrigine) : {mots: []};
let motsActuels = [];
try { motsActuels = lire(fMots).mots ?? []; } catch { /* pas de mots.json lisible : ceux d'origine serviront */ }
/** Les mots d'un rush, en temps du rush : sa transcription complète (elle couvre aussi ce qui dépasse du plan d'origine). */
const transcriptions = new Map();
function motsDuRush(idSource) {
  if (!transcriptions.has(idSource)) {
    const src = (O.sources ?? []).find((x) => x.id === idSource);
    let liste = null;
    try { if (src?.transcription) liste = lire(f(src.transcription)).mots; } catch { /* pas de transcription lisible */ }
    transcriptions.set(idSource, Array.isArray(liste) ? {chemin: src.transcription, mots: liste} : null);
  }
  return transcriptions.get(idSource);
}
const fps = O.sortie.fps;
let coupes;
try { coupes = lire(path.resolve(arg)); } catch (e) { erreur(`Liste de coupes illisible (${arg}) : ${e.message}`); }
if (!Array.isArray(coupes) || !coupes.length) erreur('La liste de coupes doit être un tableau non vide : [{"plan": "P1", "de": 1.2, "a": 4.5}, …]');
const parId = new Map(O.montage.map((it) => [it.id, it]));
const lettres = 'abcdefghijklmnopqrstuvwxyz';
const usages = new Map();
const montage = [];
const mots = [];
const lignes = [];
let image = 0;

coupes.forEach((c, k) => {
  const ou = `passage ${k + 1}`;
  const id = c.plan ?? c.case;
  const orig = parId.get(id);
  if (!orig) erreur(`${ou} : « ${id} » n’existe pas dans le montage d’origine (${[...parId.keys()].join(', ')}).`);
  const n = usages.get(id) ?? 0;
  usages.set(id, n + 1);
  const nouvelId = n ? `${id}${lettres[n] ?? `-${n + 1}`}` : id;
  const it = structuredClone(orig);
  delete it.mots; // un ancien pack les répétait ici : ils sont dans sous-titres/mots.json
  it.n = k + 1;
  it.id = nouvelId;
  if (nouvelId !== id) it.repris_de = id;
  if (c.titre !== undefined) it.titre = String(c.titre);
  if (c.notes !== undefined) it.notes = String(c.notes);
  let images;
  if (orig.type !== 'plan') {
    if (c.plan) erreur(`${ou} : « ${id} » est une case à créer : écris {"case": "${id}"}.`);
    images = orig.duree.images;
  } else {
    const fixe = orig.source.type === 'image';
    const e0 = orig.source.entree.s;
    const s0 = orig.source.sortie.s;
    const avant = orig.fichier.poignee_avant_s ?? 0;
    const apres = orig.fichier.poignee_apres_s ?? 0;
    let de = c.de ?? e0;
    let a = c.a ?? s0;
    if (![de, a].every(Number.isFinite) || a <= de) erreur(`${ou} (${id}) : « de » et « a » doivent être des secondes, avec a > de (reçu ${c.de} → ${c.a}).`);
    if (!fixe) {
      // un petit dépassement est ramené dans le fichier ; un grand est une erreur de temps
      if (de < e0 - avant - 0.25 || a > s0 + apres + 0.25) erreur(`${ou} (${id}) : ${de} → ${a} s sort du plan, qui couvre ${arrondi(e0 - avant, 2)} → ${arrondi(s0 + apres, 2)} s du rush « ${orig.source.nom} ».`);
      de = Math.max(de, e0 - avant);
      a = Math.min(a, s0 + apres);
    }
    images = Math.max(1, Math.round((a - de) * fps));
    const dureeS = images / fps;
    if (!fixe) {
      const fs2 = orig.source.fps || fps;
      it.source.entree = tempsSource(de, fs2);
      it.source.sortie = tempsSource(de + dureeS, fs2);
      it.fichier.debut_utile_s = arrondi(orig.fichier.debut_utile_s + (de - e0), 4);
      it.fichier.fin_utile_s = arrondi(it.fichier.debut_utile_s + dureeS, 4);
    } else {
      it.fichier.fin_utile_s = arrondi((orig.fichier.debut_utile_s ?? 0) + dureeS, 4);
    }
    // du temps de l'ancien montage vers le temps du rush, puis vers le nouveau montage
    const versRush = (t) => e0 + (t - orig.debut.s);
    const versNouveau = (tRush) => image / fps + (tRush - de);
    if (orig.cadrage?.points?.length) {
      const pts = orig.cadrage.points.map((p) => ({...p, t: arrondi(versNouveau(versRush(p.t)))}));
      const d0 = image / fps;
      const dans = pts.filter((p) => p.t >= d0 - 2 && p.t <= d0 + dureeS + 2);
      it.cadrage.points = dans.length ? dans : [pts.reduce((m, p) => (Math.abs(p.t - d0) < Math.abs(m.t - d0) ? p : m))];
    }
    // les mots du passage : dans la transcription du rush (un passage allongé dans ses poignées garde tous ses mots) ;
    // à défaut, ceux du plan d'origine
    const duRush = fixe ? null : motsDuRush(orig.source.id);
    const duPlan = (duRush ? duRush.mots.map((w) => ({...w, d: w.debut, f: w.fin})) : motsOrigine.mots.filter((w) => w.plan === id).map((w) => ({...w, d: versRush(w.debut), f: versRush(w.fin)})))
      .filter((w) => (w.d + w.f) / 2 >= de && (w.d + w.f) / 2 < de + dureeS);
    const recales = duPlan.map(({d, f: fin, plan, image_debut, image_fin, ...w}) => ({...w, debut: arrondi(Math.max(image / fps, versNouveau(d))), fin: arrondi(Math.min(image / fps + dureeS, versNouveau(fin)))}));
    const dit = phrase(recales.filter((w) => !w.evenement));
    it.texte = dit.length > 600 ? `${dit.slice(0, 600).replace(/\s+\S*$/, '')}… (la suite : ${duRush?.chemin ?? 'sous-titres/mots.json'})` : dit;
    for (const w of recales) mots.push({...w, plan: nouvelId, image_debut: Math.round(w.debut * fps), image_fin: Math.round(w.fin * fps)});
    // ces repères décrivaient l'ancien passage : ils ne sont plus justes
    delete it.coupes_camera;
    if (it.son) {
      Object.assign(it.son, {avant_s: 0, apres_s: 0});
      delete it.son.silences;
    }
    lignes.push(`  ${String(k + 1).padStart(2)}. ${nouvelId.padEnd(5)} ${fixe ? 'photo'.padEnd(17) : `${arrondi(de, 2)} → ${arrondi(de + dureeS, 2)} s`.padEnd(17)} ${arrondi(dureeS, 2)} s  ${it.texte ? `« ${it.texte.slice(0, 60)}${it.texte.length > 60 ? '…' : ''} »` : it.titre || orig.source.nom}`);
  }
  it.debut = temps(image, fps);
  it.fin = temps(image + images, fps);
  it.duree = {s: arrondi(images / fps), images};
  if (it.son) { it.son.debut = it.debut; it.son.fin = it.fin; }
  if (orig.type !== 'plan') lignes.push(`  ${String(k + 1).padStart(2)}. ${nouvelId.padEnd(5)} ${'case à créer'.padEnd(17)} ${it.duree.s} s  ${it.titre || it.consigne || ''}`);
  image += images;
  montage.push(it);
});

// Les mots des plans par-dessus (la voix off, une musique chantée…) : recouper ne touche pas à ces plans, mais l'IA a pu
// les déplacer dans montage.json (ce que ce même outil lui conseille). Leurs mots suivent donc la place qu'ils ont
// aujourd'hui (début et durée en images, ceux que le kit joue), d'après la transcription de leur rush ; sans
// transcription, ceux de mots.json (à défaut, ceux d'origine) restent tels quels. Avant, ils étaient effacés, et la voix
// off n'avait plus un seul sous-titre.
const dessus = A.superpositions ?? [];
for (const sp of dessus) {
  if (sp.son?.garder === false) continue; // son coupé : rien n'est dit
  const duRush = sp.source?.type === 'image' ? null : motsDuRush(sp.source?.id);
  const e0 = sp.source?.entree?.s;
  const d0 = Number.isFinite(sp.debut?.image) ? sp.debut.image / fps : sp.debut?.s;
  const duree = Number.isFinite(sp.duree?.images) ? sp.duree.images / fps : sp.fin?.s - d0;
  if (duRush && [e0, d0, duree].every(Number.isFinite) && duree > 0) {
    for (const {debut: dw, fin: fw, plan, image_debut, image_fin, ...w} of duRush.mots) {
      if ((dw + fw) / 2 < e0 || (dw + fw) / 2 >= e0 + duree) continue;
      const debut = arrondi(Math.max(d0, d0 + dw - e0));
      const fin = arrondi(Math.min(d0 + duree, d0 + fw - e0));
      mots.push({...w, debut, fin, plan: sp.id, image_debut: Math.round(debut * fps), image_fin: Math.round(fin * fps)});
    }
    continue;
  }
  const siens = motsActuels.filter((w) => w.plan === sp.id);
  mots.push(...(siens.length ? siens : motsOrigine.mots.filter((w) => w.plan === sp.id)));
}
mots.sort((x, y) => x.debut - y.debut);
const motsGardes = uneVoixALaFois(mots, new Set(dessus.filter((sp) => sp.voix_off).map((sp) => sp.id)));
const sansST = A.habillage?.sans_sous_titres ?? [];
const M = {
  ...A,
  decoupe: 'ia',
  _recoupe: {outil: 'remotion/recouper.mjs', passages: montage.length, original: 'montage.origine.json', note: 'Les temps de montage.otio, des vignettes et du storyboard sont ceux du montage d’origine.'},
  sortie: {...(A.sortie ?? O.sortie), duree: temps(image, fps), images: image},
  montage,
  ...(A.habillage ? {habillage: {...A.habillage, sans_sous_titres: [...new Set([...sansST, ...montage.filter((it) => sansST.includes(it.repris_de)).map((it) => it.id)])]}} : {}),
};
ecrire(fMontage, M);
if (fs.existsSync(f('sous-titres'))) {
  ecrire(fMots, {...motsOrigine, fps, mots: motsGardes});
  ecrireSousTitres(motsGardes);
}
console.log(`Nouveau montage : ${montage.length} passage(s), ${arrondi(image / fps, 2)} s (${image} images à ${fps} i/s), ${motsGardes.filter((w) => !w.evenement).length} mots.`);
console.log(lignes.join('\n'));
const restes = [[A.habillage?.effets?.length, 'effet(s)'], [dessus.length, 'plan(s) par-dessus'], [A.indications?.length, 'note(s) de l’humain']].filter(([n]) => n);
if (restes.length) console.log(`Attention : ${restes.map(([n, t]) => `${n} ${t}`).join(', ')} gardent leurs temps. S’ils ne tombent plus au bon endroit, déplace-les dans montage.json, puis relance cette commande : elle les laissera où tu les as mis et recalera les sous-titres des plans par-dessus.`);
console.log('Ensuite : « node remotion/images.mjs --de 0 --a 10 --pas 10 » pour contrôler des images, puis « node remotion/rendre.mjs Montage rendu/final.mp4 ».');
