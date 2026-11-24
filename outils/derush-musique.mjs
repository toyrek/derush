#!/usr/bin/env node
// Dérush — la commande « derush-musique », donnée à l'IA : la musique du film faite sur l'ordinateur (une partition
// que l'IA écrit et que le compositeur joue, ou une musique de fond d'après un style), les temps d'un morceau déjà
// fait, pour couper dessus, et ce morceau ajusté à la durée du film. Voir lib/musique.mjs. Tout le mode d'emploi est
// dans AIDE : l'IA le lit avant de s'en servir.
import fs from 'node:fs';
import path from 'node:path';
import {aide, options} from './commande.mjs';

const AIDE = `derush-musique — la musique du film, faite sur cet ordinateur : sans Internet, sans compte, sans crédit.
Avec un morceau déjà fait (celui de la personne, de la bibliothèque de sons, d'ElevenLabs) : trouver ses temps pour
couper dessus, et l'ajuster à la durée du film. Sans morceau : jouer une partition que tu écris pour le film, ou poser
une musique de fond d'après un style. Là, les instruments sont calculés (de la synthèse), pas enregistrés : dis-le à
la personne ; un vrai morceau, quand il y en a un qui convient, sonne toujours mieux.

Usage :
  derush-musique jouer <partition.abc> -o <musique.wav> [--reperes "nom=s,…"] [--duree s] [--graine n]
      Joue la partition (notation ABC, plus bas) et écrit le WAV : 48 kHz, stéréo, −14 LUFS, crête −1,5 dB.
      --reperes : chaque !mark:nom! de la partition tombe au temps donné du film. Entre deux repères le tempo s'ajuste
          tout seul ; la réponse donne l'écart (au-delà de 8 %, réécris le passage). Un seul repère déplace le début.
      --duree : la durée du fichier (par défaut : la musique et 2 s pour que la dernière note s'éteigne ; 180 s au plus).
      --graine : une autre interprétation (des musiciens ne jouent jamais deux fois pareil). Même graine, même fichier.
      La réponse : durée, volume, voix, repères avec leur temps, et « attention » s'il y a quelque chose à corriger.
      Exemple : derush-musique jouer rendu/son/musique.abc -o rendu/son/musique.wav --reperes "debut=0,sommet=10.8"

  derush-musique lire <partition.abc> [--reperes "nom=s,…"]
      Vérifie la partition sans rien jouer : voix, instruments, durée, temps des repères, mesures fausses.

  derush-musique style <nom> -o <musique.wav> --duree s [--scenes "intro=0,essor=6,sommet=12,fin=17"]
        [--sommet nom|s] [--fin resonne|nette|coupee] [--fin-a s] [--bpm n] [--sous-voix] [--graine n]
      Une musique de fond sans écrire de partition. Les styles : derush-musique styles (« pulse:dark » = une variante).
      --scenes : les changements de plan. La musique change à chacun, et son tempo est choisi pour tomber dessus.
      --sommet : le moment fort (une scène ou un temps) : une respiration, puis tout l'orchestre.
      --fin : resonne (le dernier accord s'éteint, par défaut), nette (un accent final sur la dernière scène),
          coupee (la musique s'arrête net). --fin-a : le moment de cet arrêt, en secondes.
      --sous-voix : une voix parlera par-dessus ; l'arrangement reste léger.
      --graine : un autre tirage (autre tonalité, autres accords, autre motif).
      Exemple : derush-musique style lofi -o rendu/son/fond.wav --duree 42 --scenes "intro=0,ville=9,fin=36" --sous-voix

  derush-musique styles [--json]
      Les styles et ce qu'ils donnent, les instruments d'une partition, les batteries.

  derush-musique temps <musique ou vidéo> [--caler "t1,t2,…"] [--bpm n] [--debut s] [--duree s] [-o temps.json]
      Les temps d'un morceau : tempo, « temps » (chaque battement), « mesures » (le premier temps de chaque mesure),
      « sections » (énergie de 0 à 1) et « sommets » (les plus fortes montées d'énergie, la meilleure d'abord ;
      « force » de 0 à 1 : sous 0,2, à peine une montée).
      Coupe sur une mesure ; pose l'image la plus forte sur un sommet.
      --caler : pour chaque coupe prévue, le battement et la mesure les plus proches, avec l'écart en millisecondes.
      --bpm : le tempo, si tu le connais. --debut/--duree : n'analyser qu'un passage (10 minutes au plus à la fois) ;
          les temps rendus restent ceux du fichier entier.
      -o : écrit toute la réponse dans un fichier (les listes de temps n'encombrent plus l'écran).
      « pulsation : incertaine » : pas de rythme net. Fie-toi aux sections et aux sommets, pas aux temps.
      Un morceau joué librement (un piano seul, un début sans batterie) : les temps peuvent tomber à quelques
      dizaines de millisecondes du battement entendu ; analyse alors le passage seul (--debut, --duree).

  derush-musique ajuster <morceau> -o <musique.wav> --duree s [--montee s] [--sommet s] [--arrivee s]
        [--scenes "intro=0,…"] [--droit] [--debut s] [--bpm n]
      Un morceau déjà fait, ajusté à la durée du film comme le fait un monteur son : son début tel quel, un milieu
      raccourci ou allongé par mesures entières, puis sa vraie fin sur la dernière image. Chaque raccord tombe sur
      une barre de mesure et il est mesuré (douceur de 0 à 1, volume avant et après) ; une recoupe qui ferait
      sauter le volume est refusée.
      --montee : le moment où la musique doit s'élargir ; --sommet : le moment le plus fort ; --arrivee : le moment
          du carton de fin (l'accent final du morceau y est posé quand c'est possible). En secondes, ou le nom
          d'une scène de --scenes.
      --droit : pas de recoupe, le morceau depuis son début (ou depuis --debut), fondu à la fin. Un morceau plus
          court que le film est rejoué en boucle sur ses mesures.
      La réponse : les passages gardés, les raccords, la fin (« accent_s » : son accent le plus fort ;
      « accord_final_s » : son dernier accord, pour y poser le carton de fin ; « fabrique » : la résonance finale
      est une réverbération ajoutée, pas celle du morceau), les temps et les mesures dans le temps du film,
      « durees_sans_recoupe_s » (des durées de film où le morceau tombe juste : change la durée du film si c'est
      facile) et le rapport du moteur, en anglais. Le niveau du morceau n'est pas changé : derush-son mixer le
      règle. Tu n'entends pas les raccords : fais-les écouter par Earshot, ou dis que personne ne les a écoutés.
      Exemple : derush-musique ajuster sons/musique.mp3 -o rendu/son/musique.wav --duree 42 --sommet 25 --arrivee 38

La partition (notation ABC, un fichier texte) :
  En-têtes : X:1 · T:titre · M:4/4 (la mesure) · L:1/8 (la durée d'une note sans chiffre) · Q:1/4=92 (le tempo)
      · K:Am (la tonalité : C, F, Am, Ddor…).
  Une voix : « V:nom inst=piano role=melody gain=0.8 transpose=-12 », puis ses notes. role=melody : la voix qui
      chante, jouée un peu devant. Instruments et batteries : derush-musique styles.
  Notes : C D E F G A B (C = le do du milieu), c d e (l'octave au-dessus), C, (en dessous), c' (encore au-dessus) ;
      ^ dièse, _ bémol, = bécarre ; c2 deux fois plus long, c/2 moitié, c3/2 ; z silence, Z une mesure de silence,
      Z4 quatre ; [CEG] accord ; c- liaison ; (3cde triolet ; | barre de mesure ; |: :| reprise ;
      [K:G] [Q:1/4=120] [M:3/4] pour changer en cours de route.
  Nuances : !pp! !p! !mp! !mf! !f! !ff! · !crescendo(! … !crescendo)! · !diminuendo(! … !diminuendo)! · !accent!
      · !fermata! (un point d'orgue) · !ped! !ped-up! (la pédale) · !rit(! … !rit)! (ralentir) · !breath! (respirer).
  Batterie : « V:DR inst=drums kit=pop ». Les notes : C,, grosse caisse · D,, caisse claire · ^D,, clap · ^C,, rim
      · ^F,, charley · ^A,, charley ouvert · A,, tom · ^C, crash · ^F, tambourin · ^A shaker.
  Pour le film : !mark:nom! (un moment à caler avec --reperes) · !hit! (un impact sur ce temps)
      · !rise(! … !rise)! (une montée qui aboutit là où elle se ferme) · !filter(! … !filter)! (étouffé, puis ça s'ouvre)
      · !stop(! … !stop)! (la bande qui s'arrête) · !stutter(! … !stutter)! (le début du passage bégaie).
      !hit! et !rise! sont des effets calculés : pour de vrais sons, ne les écris pas et pose-les avec real-sfx.
  Écris toutes les mesures dans toutes les voix (Z pour une mesure de silence). La première mesure peut être
      incomplète (une levée). Un changement de mesure [M:3/4] vaut pour toute la suite, voix suivantes comprises :
      écris-le dans chaque voix, et si une voix finit dans une autre mesure, commence la suivante par [M:4/4].

Exemple de partition (8 mesures, 21 s) :
  X:1
  T:Ouverture
  M:4/4
  L:1/8
  Q:1/4=92
  K:Am
  V:P inst=piano role=melody
  !mark:debut! !mp! z2 A2 c2 e2 | d4 c2 B2 | z2 A2 c2 e2 | g4 e4 |
  !mark:sommet! !f! a2 g2 e2 c2 | d4 e2 g2 | a2 g2 e2 d2 | !fermata!c8 |
  V:C inst=strings
  !p! [A,CE]8 | [G,B,D]8 | [F,A,C]8 | [E,G,B,]8 |
  !mf! [A,CE]8 | [F,A,C]8 | [G,B,D]8 | !fermata![A,CE]8 |
  V:B inst=bass
  Z4 |
  !mf! A,,4 A,,4 | F,,4 F,,4 | G,,4 G,,4 | !fermata!A,,8 |

Ensuite : derush-son mixer pose la musique sous la voix (15 dB dessous, elle remonte dans les silences).
Réponse en JSON ; code 1 en cas d'erreur ({"erreur": "…"}).`;

const args = process.argv.slice(2);
aide(args, AIDE, {siVide: true});
const cmd = args.shift();
const {opt, drapeau} = options(args);
const sortir = (o, code = 0) => { console.log(JSON.stringify(o, null, 2)); process.exit(code); };
const lire = (f, usage) => {
  if (!f) throw new Error(`Usage : ${usage} (derush-musique --help)`);
  if (!fs.existsSync(f)) throw new Error(`Fichier introuvable : ${f}`);
  return fs.readFileSync(f, 'utf8');
};
try {
  const M = await import('../lib/musique.mjs');
  if (cmd === 'jouer') {
    const sortie = opt('-o') ?? opt('--sortie'), reperes = opt('--reperes'), duree = opt('--duree'), graine = opt('--graine');
    const texte = lire(args[0], 'derush-musique jouer <partition.abc> -o <musique.wav> [--reperes "nom=s,…"] [--duree s] [--graine n]');
    sortir(await M.jouerPartition(texte, {sortie, reperes, duree, graine}));
  } else if (cmd === 'lire') {
    const reperes = opt('--reperes');
    const texte = lire(args[0], 'derush-musique lire <partition.abc> [--reperes "nom=s,…"]');
    sortir({ok: true, ...await M.lirePartition(texte, {reperes: M.lireTemps(reperes)})});
  } else if (cmd === 'style') {
    const o = {sortie: opt('-o') ?? opt('--sortie'), duree: opt('--duree'), scenes: opt('--scenes'), sommet: opt('--sommet'), fin: opt('--fin') ?? 'resonne', finA: opt('--fin-a'), bpm: opt('--bpm'), graine: opt('--graine'), sousVoix: drapeau('--sous-voix')};
    sortir(await M.jouerStyle({style: args[0], ...o}));
  } else if (cmd === 'styles') {
    const c = await M.catalogue();
    if (drapeau('--json')) sortir(c);
    const lignes = ['Les styles (derush-musique style <nom> …) :'];
    for (const s of c.styles) lignes.push(`  ${s.nom.padEnd(10)} ${s.pour} — ${s.tempo[0]} à ${s.tempo[1]} BPM${s.variantes.length ? ` — variantes : ${s.variantes.map((v) => `${s.nom}:${v}`).join(', ')}` : ''}`);
    lignes.push('', 'Les instruments d’une partition (inst=…) :');
    for (const f of c.instruments) lignes.push(`  ${f.famille.padEnd(16)} ${f.noms.join(', ')}`);
    lignes.push(`  ${'pupitres'.padEnd(16)} ${c.pupitres.join(', ')} (strings ou lowstr jouent à leur place)`);
    lignes.push('', `Les batteries (inst=drums kit=…) : ${c.batteries.join(', ')}`);
    lignes.push('', `Les fins d’un style (--fin) : ${c.fins.join(', ')}`, `Durée : ${c.duree_max_s} s au plus par musique.`, c.instruments_calcules);
    process.stdout.write(`${lignes.join('\n')}\n`);
  } else if (cmd === 'ajuster') {
    const o = {sortie: opt('-o') ?? opt('--sortie'), duree: opt('--duree'), scenes: opt('--scenes'), montee: opt('--montee'), sommet: opt('--sommet'), arrivee: opt('--arrivee'), debut: opt('--debut'), bpm: opt('--bpm'), droit: drapeau('--droit')};
    sortir(await M.ajusterMorceau(args[0], o));
  } else if (cmd === 'temps') {
    const fichier = opt('-o') ?? opt('--sortie');
    const r = await M.tempsMusique(args[0], {caler: opt('--caler') ?? [], bpm: opt('--bpm'), debut: opt('--debut'), duree: opt('--duree')});
    if (fichier) {
      fs.mkdirSync(path.dirname(path.resolve(fichier)), {recursive: true});
      fs.writeFileSync(fichier, `${JSON.stringify(r, null, 2)}\n`);
      const {temps, mesures, ...reste} = r;
      sortir({...reste, listes: `${temps.length} temps et ${mesures.length} mesures dans ${fichier}`});
    }
    sortir(r);
  } else {
    throw new Error(`Commande inconnue : ${cmd}. Commandes : jouer, lire, style, styles, temps, ajuster (derush-musique --help).`);
  }
} catch (e) {
  sortir({erreur: e.message}, 1);
}
