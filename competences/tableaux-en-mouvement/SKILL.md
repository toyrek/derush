---
name: tableaux-en-mouvement
description: >-
  Faire un tableau en mouvement, un dessin qui se trace, de l'encre, de la fumée, des particules ou un motion design,
  tout en code : une page web qui dessine exactement l'instant t, rendue image par image par derush-toile. 100 styles
  à choisir par leur nom (peinture de grotte, Van Gogh, estampe japonaise, fusain, risographie, un seul trait…), un
  moteur de dessin prêt, la méthode (des nombres, une seule horloge, des ressorts) et le contrôle du mouvement. À ouvrir
  quand la demande dit « Style : … » avec un de ces styles, ou veut une image peinte, dessinée ou animée sans rush.
---

# Tableaux en mouvement

Une « toile » est une page web qui sait dessiner n'importe quel instant de son film : tu lui donnes un temps, elle dessine exactement l'image de ce temps. La commande `derush-toile` la rend image par image en vidéo, sur cet ordinateur, sans Internet. C'est la façon de faire, tout en code :
- un tableau qui bouge (une peinture, une fresque, une estampe dont l'eau, la lumière ou les personnages vivent) ;
- un dessin qui se trace sous les yeux (crayon, encre, craie, un seul trait) ;
- de l'encre, de la fumée, des particules, des formes liquides ;
- un motion design complet, ou un seul plan à poser dans un montage (en `.mp4`, ou en `.mov` au fond transparent par-dessus un plan filmé).

Les fiches viennent de trois dépôts publics (`SOURCE.md` dit lesquels, et leurs licences) ; la méthode et la commande sont celles de Dérush.

## La méthode, en sept gestes

1. **Choisis le style.** La demande dit « Style : <nom> » (un nom des tableaux ci-dessous) : lis sa fiche en entier. Sinon, choisis celui qui sert le mieux le sujet et dis lequel dans ton compte rendu.
2. **Écris la partition avant de dessiner** (`methode.md`) : la durée, les images par seconde, la taille, la palette en codes de couleur, la police, puis la liste des temps (ce qui bouge, de quelle seconde à quelle seconde), les tenues, ce qui est interdit, et les instants que tu regarderas. Des nombres, pas des adjectifs.
3. **Pars d'une page de départ** : `derush-toile gabarits` les liste, `derush-toile gabarit <nom> toile` en copie une. `vide` (Canvas 2D), `croquis` (trait à la main), `particules`, `encre` (fluide), `tableau` (le moteur de dessin de cette compétence).
4. **Regarde des images fixes avant de rendre** : `derush-toile images toile/index.html --instants 0.5,2,4 --planche rendu/controle/toile-planche.jpg`, puis ouvre la planche. Fais un seul tour de corrections sur ces images (le cadre, la taille du sujet, la lisibilité) avant le premier rendu complet : une image coûte une seconde, un rendu des minutes.
5. **Vérifie le contrat** : `derush-toile verifier toile/index.html` (la même image deux fois de suite, la même image seule ou après les autres, la couture d'une boucle).
6. **Rends** : `derush-toile rendre toile/index.html -o rendu/toile.mp4`. Lis la mesure du mouvement qu'il écrit : un passage figé que tu n'as pas voulu est un défaut, comme un passage où presque rien ne bouge (un trait fin seul, sur un téléphone, c'est une image fixe), une suite d'images vides ou une fin tenue trop longtemps. Une image fixe ne dit jamais si ça bouge.
7. **Fais juger, puis pose** : la grille du jury (`references/jury.md`), puis la toile va dans le montage comme n'importe quel plan (`remotion/public/`, ou un plan de `montage.json`), ou elle est la vidéo livrée (`rendu/final.mp4`). Dis dans ton compte rendu les nombres que tu as mesurés, pas « c'est bon ».

Tout le mode d'emploi de la commande : `derush-toile --help`.

## Le contrat d'une toile

```js
window.toile = {duree: 8, fps: 30, largeur: 1080, hauteur: 1920, boucle: false};
window.renderAt = (t) => { /* dessine EXACTEMENT l'image de l'instant t (en secondes) */ };
window.__ready = true;   // quand les polices et les images sont chargées
```

- `renderAt(t)` ne lit jamais l'horloge, ne tire jamais au hasard sans graine et ne garde rien d'une image à l'autre : le même `t` donne la même image, dans n'importe quel ordre. `toile.js` (copié avec chaque page de départ) donne le hasard à graine, les courbes, les ressorts écrits comme des fonctions du temps.
- Une simulation (un fluide, des particules qui s'additionnent) ne peut pas tenir ce contrat : `window.toile.suite = true`. Dérush la rend alors dans l'ordre.
- Une boucle : les images 0 à N-1, jamais l'image N. La dernière doit s'enchaîner avec la première : la position, mais aussi la vitesse, la caméra et la lumière.
- Rien ne vient d'Internet. Les bibliothèques du moteur de rendu sont sous `/lib/<nom>/` (`derush-toile bibliotheques` donne la liste et la carte d'import), le moteur de dessin sous `/tableaux/`, les polices de Dérush sous `/polices/`. Le reste (images, autres polices) va dans le dossier de la page.
- Une page qui joue toute seule (animations CSS, GSAP en lecture) se rend avec `--horloge` : Dérush avance le temps du navigateur à la main.

## Trois façons de dessiner

**À la main, en Canvas 2D ou en SVG** (page de départ `vide`). Le plus libre : chaque matière est une fonction que tu écris (un trait qui tremble, un lavis qui déborde, une trame de points). Les fiches de `recettes/dessin/` disent comment chaque matière se comporte vraiment.

**Avec le moteur de dessin** (`moteur/`, page de départ `tableau`). 53 scènes de styles d'art, des transitions, et des bibliothèques de peinture : `PAINT` (bruit, papier, craquelures, touches en champ de flux, points, mosaïque, trame), `RIG` (des personnages articulés), `medium.js` (la couche de matière), `brush.js`, `post.js`, `toon.js`, et celles des vidéos qui expliquent (`motion.js`, `camera.js`, `diagram.js`, `typo.js`, `chart.js`). Une scène s'écrit ainsi :

```js
SCENES['ma_scene'] = { init(IMG) { /* une fois */ }, draw(c, lt, t) { /* peint tout le cadre ; lt = le temps dans la scène */ } };
```

et le film est une liste (`eras.js`) : `{id, dur ou eighths, transition: {type, dur}, counter}`. Lis `references/huashu/08-ecrire-un-style.md` et `04-dessin-en-code.md`, la scène la plus proche de ton style, puis `moteur/scenes/09_postimp.js` (la scène de référence). Pour voir les 35 premiers styles tourner : `derush-toile images <cette compétence>/moteur/index.html --parametres "film=gallery" --instants 1,9,17,25,33 --planche rendu/controle/galerie.jpg`. Les scènes d'exemple sont peintes pour un cadre de 1920 × 1080 : pour un format vertical, compose ta propre scène avec `window.STAGE`.

**Avec une bibliothèque** : `roughjs` pour un trait à la main sur n'importe quelle forme (page `croquis`) ; `three` et `three.quarks` pour des particules (page `particules`) ; un fluide calculé par la carte graphique pour l'encre et la fumée (page `encre`) ; `simplex-noise` pour un grain ou un tremblement ; `gsap` si tu préfères une timeline (mets-la en pause et place-la sur `t` dans `renderAt`). Pour des formules de maths animées : `derush-manim` (Manim, installé à la demande).

## Les 100 styles

Dans une demande : « Style : <nom> ». Deux styles au plus.

### Des grottes aux manuscrits

_Les arts anciens et les traditions : la roche, la fresque, l'encre, l'enluminure._

| Style | Fiche | En bref |
|---|---|---|
| Peinture de grotte | `recettes/art/01_cave.md` | Des bêtes à l'ocre et au charbon sur la roche, des mains en négatif, à la lueur d'une flamme qui tremble. |
| Fresque égyptienne | `recettes/art/02_egypt.md` | Des personnages de profil, des aplats ocre et turquoise, des hiéroglyphes en bandes, sur l'enduit d'un tombeau. |
| Vase grec à figures noires | `recettes/art/03_greek.md` | Des silhouettes noires sur une terre cuite orange, des détails gravés et une frise de méandres qui tourne. |
| Mosaïque romaine | `recettes/art/04_roman.md` | Des milliers de tesselles posées une à une, façon Pompéi, avec leurs joints et leurs bordures. |
| Enluminure gothique | `recettes/art/05_gothic.md` | Une page de manuscrit : feuille d'or, lettrine, bordure de rinceaux et petits personnages aux couleurs vives. |
| Fresque de Dunhuang (Tang) | `recettes/art/20_dunhuang.md` | Des apsaras qui volent, des rubans, des couleurs minérales et un mur qui s'écaille, comme dans les grottes de Mogao. |
| Fresque de Dunhuang (dynasties du Nord) | `recettes/art/55_dunhuang.md` | Des couleurs minérales posées sur la terre sèche et des lignes qui filent à l’horizontale : le Dunhuang le plus ancien. |
| Encre de Chine (lavis libre) | `recettes/art/17_ink.md` | Quelques coups de pinceau, beaucoup de blanc, un sceau rouge : l'encre à la manière de Bada Shanren et de Qi Baishi. |
| Paysage Song (Ma Yuan) | `recettes/art/50_ma_yuan.md` | Tout dans un coin, le reste en vide et en brume, un trait d'encre net : le paysage « d'un seul angle ». |
| Théâtre d'ombres chinois | `recettes/art/34_shadowpuppet.md` | Des figurines de cuir ajouré, articulées, derrière un écran éclairé par une lampe. |
| Miniature persane | `recettes/art/51_persian_miniature.md` | Des plans empilés sans perspective, des motifs minuscules, de l'or, et une scène à lire comme une page. |
| Giotto | `recettes/art/38_giotto.md` | Des personnages massifs comme des blocs, des gestes qui racontent, un fond bleu de fresque. |
| Ambrogio Lorenzetti | `recettes/art/43_lorenzetti.md` | Une ville et sa campagne à lire d'un bout à l'autre : des maisons serrées, des métiers, des gens au travail. |

### De la Renaissance au baroque

_La peinture des maîtres anciens : la lumière, le volume, le clair-obscur._

| Style | Fiche | En bref |
|---|---|---|
| Renaissance (Léonard de Vinci) | `recettes/art/06_renaissance.md` | Un sfumato doux, une lumière dorée, un paysage bleuté au loin et les craquelures du vieux vernis. |
| Piero della Francesca | `recettes/art/39_piero.md` | Un ordre géométrique calme, des volumes clairs, une lumière pâle et égale. |
| Raphaël | `recettes/art/40_raphael.md` | Des groupes harmonieux, des gestes liés les uns aux autres, des couleurs douces et équilibrées. |
| Michel-Ange | `recettes/art/41_michelangelo.md` | Des corps sculptés, des poses en tension, des tons de fresque. |
| Rembrandt (clair-obscur) | `recettes/art/32_rembrandt.md` | Un visage sorti de l'ombre par une seule lumière chaude, des bruns profonds et une pâte épaisse. |
| Pierre de Cortone (baroque) | `recettes/art/44_cortona.md` | Des volumes amples et des groupes en mouvement qui montent en tourbillon : le grand décor baroque. |
| Guardi (Venise) | `recettes/art/42_guardi.md` | De l'air, des éclats de lumière sur l'eau et des contours qui se défont : une Venise qui vibre. |

### Impressionnistes et modernes

_De Monet à Dalí : la touche, la couleur, les avant-gardes._

| Style | Fiche | En bref |
|---|---|---|
| Impressionnisme (Monet) | `recettes/art/08_impressionism.md` | De petites touches côte à côte, des reflets, une lumière qui change : le plein air de 1874. |
| Monet, les Nymphéas | `recettes/art/28_monet.md` | Des nymphéas, un pont japonais et de l'eau faite de touches qui bougent. |
| Seurat (pointillisme) | `recettes/art/29_seurat.md` | Des milliers de points de couleur pure que l'œil mélange, comme un dimanche à la Grande Jatte. |
| Renoir | `recettes/art/45_renoir.md` | Des tons chauds et froids mêlés, une lumière tachetée, des personnages pleins de vie. |
| Pissarro | `recettes/art/46_pissarro.md` | La vie qui passe, des gens dans leur décor, une touche régulière et la lumière de tous les jours. |
| Sisley | `recettes/art/47_sisley.md` | Du ciel, le temps qu'il fait et des paysages d'un seul tenant, tout en air et en eau. |
| Van Gogh | `recettes/art/09_postimp.md` | Des coups de pinceau épais qui tournent, un ciel en tourbillon, des jaunes et des bleus intenses. |
| Gauguin | `recettes/art/48_gauguin.md` | Des aplats de couleur, des contours sombres et des tons choisis pour ce qu’ils disent, pas pour faire vrai. |
| Art nouveau (affiche de Mucha) | `recettes/art/10_nouveau.md` | Une affiche de 1900 : des courbes, des fleurs, un halo derrière la figure et un lettrage orné. |
| Klimt (période dorée) | `recettes/art/18_klimt.md` | De l'or partout, des spirales, des carrés et des yeux en motifs, sur un pré de fleurs. |
| Munch (expressionnisme) | `recettes/art/19_munch.md` | Un ciel qui ondule en rouge et en orange, des lignes qui coulent : une angoisse à la manière du Cri. |
| Picasso, période bleue | `recettes/art/36_picasso_blue.md` | Tout en bleus froids, des figures allongées et mélancoliques. |
| Cubisme | `recettes/art/11_cubism.md` | Le sujet cassé en facettes vues de plusieurs côtés, des bruns et des gris, des lettres au pochoir. |
| Matisse, papiers découpés | `recettes/art/30_matisse.md` | Des formes découpées aux ciseaux dans des papiers de couleur vive, à la manière de « Jazz ». |
| Chagall | `recettes/art/49_chagall.md` | Un espace de souvenir où les gens flottent, des couleurs qui disent l'émotion. |
| Dalí (surréalisme) | `recettes/art/23_dali.md` | Un désert net comme un rêve, des objets mous, des ombres longues. |
| Hopper | `recettes/art/24_hopper.md` | Une lumière dure qui découpe des pans de mur, des aplats, une solitude tranquille. |
| Affiche Bauhaus | `recettes/art/12_bauhaus.md` | Des cercles, des carrés, des triangles, du rouge, du jaune, du bleu et des lettres bâton, sur une grille. |
| Constructivisme russe | `recettes/art/22_constructivism.md` | Des diagonales, du rouge et du noir, des photomontages et des lettres qui crient : l'affiche de 1924. |

### Pop, dessin animé et écrans

_Du pop art aux dessins animés et aux images d'ordinateur._

| Style | Fiche | En bref |
|---|---|---|
| Pop art (Lichtenstein et Warhol) | `recettes/art/13_pop.md` | Des cases de BD à gros points de trame et des portraits répétés en quatre couleurs. |
| Keith Haring | `recettes/art/31_haring.md` | Des bonshommes au gros trait noir, des traits de mouvement autour d'eux, des couleurs franches. |
| Yayoi Kusama | `recettes/art/21_kusama.md` | Des pois à l'infini, sur tout, dans deux ou trois couleurs vives. |
| Comics façon Jack Kirby | `recettes/art/27_kirby.md` | De l'énergie cosmique, des crépitements de points noirs, une impression en quatre couleurs un peu décalée. |
| Dessin animé des années 1930 | `recettes/art/33_rubberhose.md` | Du noir et blanc, des bras en tuyau de caoutchouc, des yeux en part de tarte et une image qui sautille. |
| Studio Ghibli | `recettes/art/25_ghibli.md` | Des décors peints à la gouache, des nuages généreux, une nature qui respire. |
| Makoto Shinkai | `recettes/art/35_shinkai.md` | Des ciels immenses, des rayons, des reflets et des contre-jours très détaillés. |
| Pixar | `recettes/art/53_pixar.md` | Des formes simples et lisibles, des matières soignées, un jeu d'acteur clair. |
| South Park | `recettes/art/52_south_park.md` | Du papier découpé numérique, des formes simples et un jeu volontairement limité. |
| Rick et Morty | `recettes/art/37_rick_morty.md` | Un dessin plat au contour régulier, des couleurs acides. |
| Jeu vidéo 8 bits | `recettes/art/14_8bit.md` | De gros pixels, une palette de quelques couleurs, un décor qui défile. |
| Images de synthèse des années 1990 | `recettes/art/15_raytrace.md` | Des sphères chromées, un damier, des reflets parfaits : les premières images en lancer de rayons. |
| Vaporwave | `recettes/art/26_vaporwave.md` | Une grille néon, un soleil couchant rose et violet, des statues antiques et des bugs d'écran. |
| Illustration vectorielle à plat | `recettes/art/16_2026.md` | Des formes simples, des couleurs douces et un peu de grain : l'illustration d'aujourd'hui. |

### Dessins, gravures et papiers

_Une matière tracée à la main : crayon, encre, gravure, collage, broderie._

| Style | Fiche | En bref |
|---|---|---|
| Crayon de cire | `recettes/dessin/balloon.md` | Des gribouillis de crayon gras qui laissent voir le grain du papier, un contour épais repassé deux fois. |
| Plan bleu (cyanotype) | `recettes/dessin/blueprint.md` | Un dessin technique à l'encre blanche sur un fond bleu de Prusse, tracé à la règle et au compas. |
| Huile en touches séparées | `recettes/dessin/brokenColour.md` | Des touches d'huile épaisses posées côte à côte, sans mélange : c'est l'œil qui fait la couleur. |
| Fusain effacé et redessiné | `recettes/dessin/charcoalErasure.md` | Du fusain estompé, gommé, puis redessiné par-dessus ses propres traces. |
| Crayons de couleur | `recettes/dessin/colouredPencil.md` | Des hachures toutes dans le même sens sur un papier à grain, les couleurs posées par couches. |
| Glacis de rêve | `recettes/dessin/dreamGlaze.md` | Une peinture lisse, sans trace de pinceau, sous un soleil bas : des bords nets et une lumière irréelle. |
| Broderie à la main | `recettes/dessin/embroidery.md` | Des points de fil de coton sur une toile de lin tendue dans un tambour. |
| Vectoriel à plat (dessiné à la plume) | `recettes/dessin/flatVector.md` | Des formes à l'outil plume, des aplats, de longues ombres et un grain sur les côtés à l'ombre. |
| Livre de contes à la gouache | `recettes/dessin/folkTale.md` | De la gouache et de l'aquarelle sur un dessin au crayon : épaisse devant, pâle au loin. |
| Collage de papiers déchirés | `recettes/dessin/fox.md` | Aucun trait : des papiers déchirés au bord blanc et d’autres coupés net, chacun avec sa petite ombre. |
| Trame de journal | `recettes/dessin/halftone.md` | Une impression de journal : des points noirs, une seule couleur orange, une encre qui bave dans le papier. |
| Vue isométrique en coupe | `recettes/dessin/isometric.md` | Des plans à plat sur une grille isométrique, trois tons par matière, des bords nets. |
| BD aux feutres | `recettes/dessin/koi.md` | Des aplats au feutre à alcool, une ombre franche et un gros contour qui s'épaissit du côté de l'ombre. |
| Risographie | `recettes/dessin/lighthouse.md` | Deux ou trois encres superposées, un peu décalées, avec leurs trames : le blanc, c'est le papier. |
| Low-poly | `recettes/dessin/lowPoly.md` | Des volumes en triangles, chaque facette d'une seule couleur selon la lumière. |
| Gravure d'un seul trait | `recettes/dessin/mellan.md` | Toute l'image en une seule ligne continue, plus épaisse là où c'est sombre. |
| Gouache des années 1950 | `recettes/dessin/midCentury.md` | De la gouache mate en aplats, un pinceau sec par-dessus et un trait d'encre imprimé un peu à côté. |
| Tableau noir à la craie | `recettes/dessin/moonPhases.md` | De la craie frottée sur l'ardoise, sa poussière autour, et le fantôme des leçons effacées. |
| Huile sur toile | `recettes/dessin/paintedOil.md` | De l'huile à la brosse sur une toile teintée, du jus maigre du début aux empâtements de la fin. |
| Théâtre de papier | `recettes/dessin/paperCraft.md` | Un petit théâtre en carton : des papiers à motifs découpés, des figurines à marge blanche, chacune sur son plan. |
| Pixel art (grille de 120) | `recettes/dessin/pixelArt.md` | Une grille de 120 cases de côté et 16 couleurs, posées case par case, sans lissage. |
| Croquis au stylo bille | `recettes/dessin/pocketWatch.md` | Un seul stylo bleu : les ombres ne viennent que des hachures. |
| Crayon et aquarelle | `recettes/dessin/ranunculus.md` | Des lavis qui ne remplissent jamais tout à fait leur contour, et du crayon par-dessus. |
| Cartoon sur celluloïd | `recettes/dessin/rubberHose.md` | De l'encre sur celluloïd, du gris peint au dos, le tout filmé en noir et blanc, comme en 1930. |
| Album d'archives | `recettes/dessin/scrapbook.md` | Une page d’album jaunie : cartes déchirées, ruban adhésif, gravures coloriées, machine à écrire et tampons. |
| Carte à gratter | `recettes/dessin/scratchboard.md` | Du blanc gratté dans le noir : chaque trait est de l'encre enlevée. |
| Pointillé à la plume | `recettes/dessin/stipple.md` | Rien que des points d'encre : plus ils sont serrés, plus c'est sombre. |
| Album jeunesse | `recettes/dessin/storybook.md` | Un crayon tendre et une aquarelle douce, pensés pour un personnage qui revient d'une page à l'autre. |
| Sumi-e | `recettes/dessin/sumiE.md` | Un pinceau chargé d'encre, cinq dilutions, un papier qui boit et un sceau rouge. |
| Briques de jeu | `recettes/dessin/toyBrick.md` | Des briques en plastique vues de face, avec leurs tenons, leurs reflets et leurs joints. |
| Estampe japonaise (ukiyo-e) | `recettes/dessin/woodcut.md` | Un trait gravé dans le bois, des aplats de couleur un peu décalés et des dégradés essuyés au chiffon. |
| Plume et lavis | `recettes/dessin/wren.md` | D'abord des lavis qui débordent, puis une plume souple : épaisse quand elle appuie, très fine quand elle se lève. |

### Styles de mouvement

_Un style de motion design complet, du concept au son : une façon de bouger._

| Style | Fiche | En bref |
|---|---|---|
| Motion design à plat | `recettes/mouvement/01-flat-vector.md` | Des formes vectorielles en aplats qui rebondissent et s’enchaînent : le motion design classique. |
| Un seul trait | `recettes/mouvement/02-line-art.md` | Une ligne fine qui se dessine sans jamais se lever, d'une figure à la suivante, jusqu'au logo. |
| Isométrique 2,5D | `recettes/mouvement/03-isometric.md` | Un petit monde en vue isométrique qui se monte pièce par pièce. |
| Rendu 3D | `recettes/mouvement/04-3d-render.md` | Des objets en 3D aux matières soignées, façon Cinema 4D ou Blender. |
| Dessin image par image | `recettes/mouvement/05-cel-boil.md` | Un dessin à la main refait à chaque pose, avec son trait qui frémit. |
| Collage animé | `recettes/mouvement/06-collage.md` | Des photos et des papiers découpés qui bougent par à-coups. |
| Formes liquides | `recettes/mouvement/07-liquid.md` | Des formes qui coulent, se rejoignent et se séparent comme des gouttes. |
| Métamorphoses | `recettes/mouvement/08-morph.md` | Une forme qui devient une autre, sans coupe. |
| Géométrie Bauhaus | `recettes/mouvement/09-bauhaus.md` | Des cercles, des carrés et des lignes qui composent une affiche en mouvement. |
| Rétro années 80 | `recettes/mouvement/10-synthwave.md` | Des néons, une grille, des lignes de cassette VHS : les années 80 et l'an 2000. |
| Aurores et verre dépoli | `recettes/mouvement/12-aurora-glass.md` | Des dégradés flous qui dérivent derrière des panneaux de verre dépoli. |
| Textes d'émission de variétés | `recettes/mouvement/18-hanazi.md` | De gros textes colorés et cerclés qui sautent à l’écran, comme dans une émission de variétés asiatique. |
| Vulgarisation à gros contour | `recettes/mouvement/19-paperclip.md` | Des personnages autocollants au gros contour et des schémas, pour expliquer une idée. |
| Pixel art animé | `recettes/mouvement/20-pixel.md` | De gros pixels, des animations en quelques images, des sons de console. |
| Interface cyberpunk | `recettes/mouvement/22-hud.md` | Des écrans de science-fiction : viseurs, graphiques, lignes fines et chiffres qui défilent. |

## La qualité

- La grille du jury : `references/jury.md` (sept notes, de 1 à 10 ; une première version vaut souvent de 5 à 7).
- Ce qui fait « vidéo d'IA » et ce qu'on ne livre jamais : la compétence `motionmaxxing`.
- Les méthodes des auteurs : `references/huashu/` (peindre en code, en chinois) et `references/anidoodle/` (le dessin, la caméra, la narration, en anglais).
- Écrire la fiche d'un style qui n'est pas dans la liste : `references/ecrire-un-style-de-mouvement.md`.

## Les droits

Un style donne une manière : le trait, les couleurs, la lumière, la façon de bouger. Quand la personne demande la manière d'un artiste ou d'un studio (Yayoi Kusama, Makoto Shinkai, Ghibli, Pixar, South Park…), fais cette manière avec son sujet à elle, sans reproduire aucun personnage, logo, titre ni aucune œuvre, et écris « à la manière de » dans ton compte rendu : ce n'est pas une image de l'artiste ou du studio, et la vidéo ne doit jamais le laisser croire. Les polices du moteur sont libres (SIL OFL, `moteur/lib/fonts/LICENSES.md`).
