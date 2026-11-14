---
name: derush-serie-animee
description: Faire une série animée, une mascotte ou une histoire en images et en plans vidéo générés (ElevenLabs) sans que le personnage change d'un plan à l'autre ni d'un épisode à l'autre. La bible, le passeport de chaque personnage, les cartes de plans, l'animatique gratuite, les images de départ avant le mouvement, la relecture, les prises acceptées seulement, le journal et le contrôle final. À ouvrir dès qu'un même personnage, un même lieu ou un même objet revient dans plusieurs images ou plans générés.
---

# Une série animée avec des images générées

Un modèle d'image ou de vidéo n'a aucune mémoire : chaque génération repart de zéro. Il ne sait plus la couleur de la
veste, le côté de la porte, le visage d'il y a deux plans. Si tu passes directement de l'idée au plan vidéo, tu obtiens
un beau plan, puis un inconnu qui porte le même nom dans le suivant. Sur un plan, personne ne le voit ; sur un épisode,
le public le sent ; sur une série, c'est fini.

La mémoire, ce sont tes fichiers. Tout se décide sur papier et en images fixes, on vérifie, et seulement ensuite un
modèle vidéo y touche. Les images coûtent peu ; la vidéo coûte cher.

Les appels (images, plans vidéo, images de référence, `start_frame`) sont dans `OUTILS.md`, partie « ElevenLabs ».
Sans ElevenLabs branché, la méthode vaut quand même : la bible, les passeports et l'animatique se font dans le kit, et
les personnages se dessinent dans Remotion (SVG, formes, Lottie) au lieu d'être générés.

## Où ranger quoi

```
remotion/public/serie/
  bible.md                       la série : monde, moteur, ton, palette, interdits, épisodes
  personnages/<tag>/passeport.md le descripteur à recopier mot pour mot
  personnages/<tag>/reference.png l'image de référence : jamais régénérée, jamais renommée
  personnages/<tag>/vues.png     les vues (face, profils, dos, trois-quarts)
  plans.md                       les cartes de plans de l'épisode
  journal.md                     une ligne par génération
remotion/public/images/          les images de départ validées
remotion/public/videos/          les prises acceptées, et elles seules
atelier/generes/                 les essais bruts : jamais montés tels quels
```

Quand l'humain fait de ce montage une série (« comme d'habitude »), Dérush garde `remotion/public/` : l'épisode
suivant reçoit la bible et les passeports dans `contexte/serie/public/serie/`. Relis-les avant tout, recopie-les tels
quels dans `remotion/public/serie/`, et continue le journal.

Deux règles de dossier :
- **Le montage ne voit que les prises acceptées** (`remotion/public/videos/`). Un essai brut reste dans `atelier/generes/`.
- **Une image de référence ne se régénère jamais et ne se renomme jamais.** Une nouvelle tenue, c'est un nouveau fichier et un nouveau passeport.

## 1. La bible : un monde avec un moteur

Une page, écrite à partir du brief et des pièces jointes (sans poser de question : note tes hypothèses à la fin) :

- **L'idée** en une phrase.
- **Le monde** : un seul lieu si possible, sa lumière, ses couleurs.
- **Le moteur** : ce qui tourne mal à chaque épisode, et pourquoi ça ne peut jamais se régler. C'est la ligne qui compte le plus : c'est elle qui fait revenir le public.
- **Le ton** : le style d'image, le rythme, avec ou sans paroles.
- **La palette** : une couleur dominante, une secondaire, un accent (environ 60, 30 et 10 %), en hexadécimal.
- **Jamais** : ce qui ne doit pas apparaître (le visage d'une personne réelle, du texte dans l'image, ce que le brief exclut).
- **Cinq idées d'épisodes**, une ligne chacune. Si tu n'en trouves pas cinq, le moteur est trop faible : renforce-le avant d'aller plus loin.

Prends le format d'une série qui marche si tu veux, jamais son personnage, son allure ni ses histoires.

## 2. Le passeport : le même personnage dans chaque plan

Une description en mots n'est pas une mémoire : décris deux fois le même personnage, tu en obtiens deux. Chaque
personnage a donc un passeport, avec une étiquette (`@boulanger`) :

- **Le descripteur**, exhaustif : silhouette, proportions, matières, couleurs en hexadécimal, un objet qu'il a toujours, un geste qui revient, et un petit défaut fixe (une antenne tordue, une tache, un bouton manquant). Ce défaut montre la dérive au premier coup d'œil : s'il manque, le plan est raté.
- **Ce descripteur se recopie mot pour mot** dans chaque prompt où le personnage apparaît. Jamais résumé, jamais reformulé.
- **L'image de référence** : générée une fois, en pied, pose calme, fond gris neutre. Puis **les vues**, générées à partir d'elle (face, profil gauche, dos, profil droit, trois-quarts, sans légende).
- **Une variante est un autre passeport** (`@boulanger_farine`, couvert de farine) : une variante décrite en passant, le modèle l'oublie.
- **Envoie la référence** (et les vues utiles) dans `images` à chaque image générée où il apparaît (jusqu'à 10 images de référence).

Si un mouvement sort mal plus tard, corrige le prompt du mouvement, jamais la référence.

## 3. Les cartes de plans : une action par plan

Dans `plans.md`, pour chaque plan :

- un numéro et une durée en secondes entières (4 à 8 s, comme le demande `OUTILS.md`) ;
- les personnages présents, par leur étiquette ;
- ce que voit la caméra, en mots de cinéma : valeur de plan, angle, mouvement ;
- **une seule action** ;
- le son : ambiance, bruitages, musique ou non ;
- le moment : mise en place, accident, réaction ou retournement.

Règles : une accroche lisible sans le son dans les trois premières secondes ; aucun texte dans une image générée (le
texte se pose dans le kit, il reste exact) ; évite ce que les modèles ratent souvent (des mains qui saisissent de petits
objets, une foule, un miroir) ; le dernier plan tient sa pose jusqu'à la dernière image.

## 4. L'animatique : voir l'épisode avant de payer

Avant toute génération payante, monte l'épisode en cases dans le kit : une composition `Animatique` (déclarée dans
`remotion/src/Racine.tsx`), une case par plan aux couleurs de la bible, son action en quelques mots et un dessin simple qui bouge,
chaque case à sa durée. Rends-la (`node remotion/rendre.mjs Animatique rendu/animatique.mp4`) et regarde le rythme de
tout l'épisode. Elle ne coûte aucun crédit ; un plan inutile coupé ici, c'est une vidéo générée de moins.

## 5. Les images de départ, puis une relecture neutre

Chaque plan a d'abord son image fixe de départ. Son prompt ne décrit que l'image de départ : le descripteur de chaque
personnage présent (mot pour mot), le lieu de la bible avec sa lumière et sa palette, une pose de départ calme (l'émotion
monte pendant le mouvement), et à la fin « no text, no extra characters », avec le format de la vidéo. Joins la
référence. Plusieurs essais d'image coûtent moins qu'un essai de vidéo raté : c'est ici qu'on cherche.

Puis relis chaque image comme quelqu'un qui ne connaît pas tes intentions. Si tu peux confier une tâche à un sous-agent
(Claude Code), confie-lui cette relecture, en lecture seule, avec seulement l'image, la carte du plan et les
passeports : un regard neuf juge l'image, pas ce que tu voulais. Sinon, fais-la toi-même, image par image, en pleine
taille. Les questions :

1. L'image suit-elle la carte ? Placement, gauche et droite, couleurs, nombres, vêtements, décor.
2. Le personnage suit-il son passeport, défaut fixe compris ?
3. L'action prévue est-elle possible depuis cette pose ?
4. Où le modèle vidéo risque-t-il de casser ?
5. Ce qu'une image fixe ne permet pas de juger : écris « non vérifié ».

Verdict par image : bon, ou à refaire avec exactement ce qu'il faut changer. Les décors doivent aussi se ressembler d'un
plan à l'autre (le même four, la même lampe, la même fenêtre).

## 6. Le mouvement, au plus juste

Image vers vidéo : `start_frame` = l'image validée. L'image porte déjà la scène ; le prompt du mouvement ne parle que
du mouvement : une action, un seul mouvement de caméra, découpés en temps (« 0–2 s : il lève les yeux, la caméra ne
bouge pas ; 2–5 s : lent travelling avant… »), sans musique, et sans paroles sauf demande.

- Fais d'abord le compte : nombre de plans × essais. S'il dépasse ce que la demande justifie, garde la vidéo générée pour les plans qui en ont vraiment besoin ; ailleurs, une image fixe animée dans le kit (zoom lent, parallaxe, éléments qui bougent) coûte bien moins.
- Commence par le modèle le moins cher (`bytedance-seedance-v2-fast`) ; un modèle plus cher seulement pour un plan qui le demande.
- Un nouvel essai change **une seule ligne** du prompt. Au troisième échec, simplifie le plan (une action plus simple, un cadre plus large) au lieu d'insister.
- Le tout début et la toute fin d'un plan généré peuvent dériver : laisse 0,3 s de côté à chaque bout (`trimBefore` et `trimAfter` de `<Video>`, en images).

## 7. Le journal

Une ligne par génération dans `remotion/public/serie/journal.md`, gardée ou jetée : la date, le plan, ce qui a été
généré (image ou vidéo), le modèle, la version du prompt, le coût s'il est connu, et le verdict. Un bon plan qui n'est
pas noté est un plan qu'on ne sait plus refaire.

## 8. Le contrôle final

Sur la vidéo rendue, tire 16 images réparties sur toute la durée et compare-les aux passeports : doigts, objets qui
fondent ou se dédoublent, un personnage qui change de couleur ou de forme, un fond qui saute à l'intérieur d'un plan
(pas aux coupes). Pour chaque défaut : le moment, ce qui casse, le plan à refaire. Puis le contrôle habituel
(« Vérifier avant de livrer », `derush-controle`).

À la fin, dis à l'humain ce que tu as généré (combien d'images, combien de plans vidéo, combien d'essais jetés) et ce que
tu as supposé dans la bible.

## Une idée à proposer : la vidéo des coulisses

Une fois l'épisode fini, une courte vidéo de coulisses se partage bien : le plan fini joue, puis se décompose en ses
couches nommées (le passeport, l'image de départ, l'essai, le plan final), et se remet en place. Les arrivées tombent
sur les temps de la musique, chaque grand mouvement a un petit élan avant et un léger dépassement après, et la dernière
image est la première, pour que la boucle se rejoue. Propose-la ; ne la fais que si l'humain la demande.
