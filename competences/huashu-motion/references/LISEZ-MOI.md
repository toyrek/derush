# Les documents de huashu-motion, dans Dérush

Ces documents sont ceux de huashu-motion, repris tels quels (une ligne de provenance ajoutée à la fin de chacun). Ils sont écrits pour son outil, `om`, que Dérush ne livre pas. Ce tableau dit ce que chaque commande devient ici. Le reste de leur texte (la méthode, les mesures, les exemples) se lit tel quel.

## Ce qui prime sur ces documents

- Rien n'est pris sur Internet de ta propre initiative : ni un site, ni une vidéo, ni une image, ni une musique. La matière est celle que la personne a donnée (kit média, pièces jointes, rushes) ; ce qui manque se demande.
- Une musique libre se cherche avec `sons-openverse`, qui ne garde que ce qu'on a le droit de poser sur une vidéo commerciale, et écrit le crédit.
- Rien n'est publié ni posté par toi, sauf si la personne le demande.
- Une vraie personne, une marque, une œuvre : les règles de Dérush s'appliquent (voir AGENTS.md et la boîte à outils).

## Leurs commandes, et les tiennes

| Dans leurs documents | Dans Dérush |
|---|---|
| `om new`, `index.html`, `vendor/om.js`, une ligne de temps GSAP | `derush-toile gabarit vide <dossier>` (une page qui dessine l'instant t : `window.renderAt(t)`), ou HyperFrames (GSAP), ou le kit `remotion/` |
| `om grab <dossier ou adresse>`, `materials/`, `materials.md` | le kit média, les pièces jointes, les rushes ; rien n'est aspiré d'un site |
| `om still`, `om look` | `derush-toile images <page> --instants 1.2,3.4` (`--planche` pour une planche) |
| `om check` | `derush-toile verifier <page>` ; le texte coupé ou caché : `derush-controle` |
| `om qa`, `om qa --sheet`, `om qa --loop` | `derush-toile mouvement <vidéo>` ; `derush-toile images … --planche` ; `derush-toile verifier --boucle` |
| `om render`, `--blur`, `--transparent` | `derush-toile rendre <page> -o … [--flou n] [--transparent]` |
| `om sound` sur une partition (`om-score`), `OM.music({ marks })`, les lignes `warning score:` | `derush-musique jouer partition.abc -o musique.wav --reperes "nom=s,…"` ; `derush-musique lire` : ses lignes `attention` |
| `OM.music({ style, drop, ending })`, `om sound --list` | `derush-musique style <nom> … --sommet … --fin resonne\|nette\|coupee` ; `derush-musique styles` (leurs « products » ne sont pas repris) |
| `om beats <fichier> --plot`, `OM.beat(n)`, `OM.downbeat(n)`, `OM.drop(i)`, `OM.section(i)` | `derush-musique temps <fichier>` : `temps`, `mesures`, `sommets`, `sections`, en nombres (pas d'image) ; `--caler` pour des coupes |
| `om sound --music <fichier>`, `OM.music({ src, burst, peak, landing, arrange })` | `derush-musique ajuster <morceau> -o … --duree … --montee … --sommet … --arrivee … [--droit]` |
| `OM.sfx(nom, t)`, leurs effets (pop, thud, whoosh, impact…) | pas repris : note le temps de chaque geste, puis pose de vrais sons (`real-sfx`), ceux d'Earshot, ou d'ElevenLabs s'il est branché. `!hit!` et `!rise!` d'une partition, eux, sont joués par `derush-musique` |
| `om music` (leur bibliothèque de 11 morceaux), `om samples` (des instruments enregistrés) | pas repris : la bibliothèque de sons de la personne (`sons/`), `sons-openverse` ; les instruments de `derush-musique` sont calculés |
| `om voice`, `OM.cue('mot')`, `voice.words.json` | la voix de la personne, ou ElevenLabs s'il est branché ; les mots et leurs temps : `transcriptions/` |
| `om studio`, `om inbox`, `om look <id>`, `om done`, `om set`, `data-om-id`, les variables de composition | pas repris : la personne te répond dans Dérush |
| `om learn`, `om share`, `om fork`, `om swatch`, `om fonts`, `om templates`, `--template …` | pas repris |
| `OM.spring`, `OM.random`, `OM.clock`, `OM.camera`, `OM.space`, `OM3.*` | pas repris : dans une toile, `ressort()` et `hasard()` de `toile.js` ; three.js est dans le moteur de rendu |
| la signature « Made with huashu-motion » | pas posée |
| −14 LUFS, crête −1,5 dB | pareil ici : `derush-son mesurer` |

## Les documents

En anglais, sauf mention.

- `director.md` : le réalisateur. Lire le sujet, la forme du message, la personnalité, trois directions, le traitement, les règles valables pour tout film.
- `rhythm.md` : le rythme. La route (un plan continu, un montage, les deux), la courbe d'énergie, les événements par mesure, le contraste entre passages, la feuille de rythme.
- `punch-up.md` : un film juste mais plat. Le diagnostic en nombres, ce qu'on garde, cinq façons de sortir d'une diapositive, la partition réécrite.
- `colour.md` : la couleur. La trouver avant de la choisir, un système de rôles, le « style maison » des IA à éviter.
- `depth.md` : la profondeur. L'interface dans l'espace, les objets en studio, les mouvements de caméra.
- `sound.md` : le son. Un vrai morceau d'abord, l'ajuster au film, puis le mode compositeur : repérer le film, écrire la partition (la notation de `derush-musique`), la caler.
- `music.md` : 16 mondes musicaux, chacun avec deux mesures qui se jouent telles quelles (`derush-musique jouer`), et pour quel sujet.
- `music-sources.md` : d'où vient un vrai morceau, et les licences. Leur point ③ (leur bibliothèque) n'existe pas ici ; leur point ④ : `sons-openverse`.
- `scores/first-light.abc`, `scores/four-rooms.abc`, `scores/signal.abc` : trois partitions complètes et commentées, à lire pour leur construction (une accroche, un arrêt, une arrivée), pas pour leur son.
- `talking-head.md` : l'habillage d'une personne qui parle. Choisir 3 à 6 moments, ne jamais couvrir le visage, un élément toutes les 4 secondes au plus. Ses commandes sont celles de leur gabarit : ici, le visage se lit avec `derush-detourer` et l'analyse des rushes, la couche transparente se rend avec `derush-toile rendre --transparent`.
- `product-demo-continuity.md` (en chinois) : une démonstration de produit en un seul cadrage qui se déplace, d'après une vidéo officielle analysée image par image.
- `craft.md`, `visual-direction.md`, `verification.md` (en chinois) : le métier de l'image, la direction des plans, la vérification et les reprises.
- `provenance.md` (en chinois) : d'où viennent leurs règles, et ce qu'ils n'en font pas des lois.
- `library/README.md` : les quatre couches (format, langage, techniques, allure) et le tableau qui croise la forme du message avec la personnalité.
- `library/formats.md` : les formats, avec leur squelette (lancement court ou long, démonstration, explication, données, manifeste, logo, boucle, tutoriel, avant et après…).
- `library/product-fit.md` : ce que de vrais lancements d'octobre 2026 ont employé, par catégorie de produit.
- `library/techniques.md` : le vocabulaire. Chaque mouvement, ce qu'il dit, sa recette (en GSAP), ce qui le casse.
- `library/languages/` : 20 langages de mouvement, un fichier chacun : `cursor-demo`, `continuous-morph`, `card-montage`, `kinetic-type`, `modular-grid`, `data-story`, `mechanism`, `system-diagram`, `flat-world`, `editorial-collage`, `hand-drawn`, `character`, `3d-object`, `generative-field`, `liquid-glass`, `photo-led`, `showreel`, `retro-digital`, `art-styles`, `talking-head`. Pour `art-styles`, la compétence `tableaux-en-mouvement` de Dérush a le moteur et les fiches.

## Ce qui n'est pas repris

`contract.md` (le contrat de leur page), `grammars.md` (leurs gabarits), `experience.md` (leur carnet de bord, écrit pour leur outil) et `about-author.md` ne sont pas ici. Un lien vers l'un d'eux, ou vers `music/LICENSE.md`, ne mène nulle part : voir `../SOURCE.md`.
