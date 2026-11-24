# La méthode : diriger une toile comme un réalisateur

Écrite pour Dérush. Les idées viennent de la pratique du motion design en code, et pour une part du cours public « Motion Design with Fable 5.2 » de seeco (16 novembre 2026), réécrites ici avec les outils de Dérush.

## 1. La partition d'abord

Avant la première ligne de dessin, écris dix lignes. Elles tiennent dans un commentaire en haut de la page.

| Ligne | Ce qu'elle dit | Exemple |
|---|---|---|
| Sujet | une seule idée par plan | « le renard saute sur la caisse à la seconde 2,0 » |
| Temps | la durée, les images par seconde, la taille | 8 s, 30 images/s, 1080 × 1920 |
| Palette | des codes de couleur, pas des noms | fond `#FBFAF6`, encre `#0E0E10`, un accent `#D9541E` |
| Lettres | la police, sa graisse, sa taille, son approche | Archivo Black, 96 px, −0,04 em |
| Plans | ce qui bouge, de quelle seconde à quelle seconde | 0,0 → 0,6 le titre entre ; 0,6 → 2,0 il tient |
| Courbes | une courbe par geste, écrite | `bezier(0.16, 1, 0.3, 1)` |
| Tenues | combien de temps on lit | 0,3 s par mot + 0,5 s |
| Interdits | les réflexes que tu refuses | halo violet, tout qui apparaît en fondu, coins arrondis partout |
| Regards | les instants à contrôler en image fixe | 0,5 ; 1,8 ; 3,0 ; 4,6 s |
| Boucle | si c'en est une | la dernière image s'enchaîne avec la première |

Un adjectif ne se dessine pas. « Haut de gamme », « moderne », « fluide », « qui rebondit » : remplace chacun par un nombre (une rugosité, une focale, une courbe, un amorti). Chaque adjectif remplacé rend le film meilleur.

## 2. Une seule horloge

Tous les temps du film sont dans une seule liste, en haut de la page (`const T = {titre: 0.4, saut: 2.0, …}`). Chaque geste, chaque coupe, chaque son lit cette liste : l'image et le son ne peuvent plus se décaler, et rien n'est réglé « à l'œil » ailleurs.

- **Une grille de temps.** Avec une musique : images par temps = images par seconde × 60 ÷ BPM (à 120 BPM et 30 images/s, un temps fait 15 images). Pose les coupes et les impacts sur ces images-là : n'importe quelle musique au même tempo tombera juste. `toile.js` : `battements({bpm, fps})`.
- **Le son confirme l'image.** Un impact s'entend une image après qu'on l'a vu, jamais avant.
- **Chaque image est une fonction du temps.** `renderAt(t)` recalcule tout depuis `t`. Pas d'horloge, pas de hasard sans graine, rien qui s'additionne d'une image à l'autre.
- **Rends les défauts impossibles** plutôt que de les corriger : si deux choses peuvent se toucher par erreur, mets-les sur deux plans différents dès le dessin.

## 3. Les ressorts et les courbes : un nombre décide de l'atterrissage

Un ressort s'écrit comme une fonction du temps (`ressort(s, {amorti})` dans `toile.js`), jamais comme une vitesse qu'on additionne à chaque image : sinon l'image 300 n'est pas la même quand on la demande seule.

| Amorti | Ce qu'on voit | Pour quoi |
|---|---|---|
| 1,0 | se pose sans dépasser | le texte, l'interface, tout ce qui se lit |
| 0,8 | un seul petit dépassement | un objet, une carte, un logo |
| 0,5 | deux rebonds | un personnage, une mascotte, le comique |

Des valeurs de départ, à ajuster sur la planche :

| Geste | Valeur |
|---|---|
| Une entrée | `bezier(0.16, 1, 0.3, 1)` : l'essentiel du chemin dans les premières images, puis une longue fin |
| Une sortie | `bezier(0.7, 0, 0.84, 0)`, moitié plus courte que l'entrée |
| Un petit saut joyeux | `bezier(0.34, 1.56, 0.64, 1)` |
| Une réponse d'interface | 0,1 à 0,2 s |
| L'arrivée du sujet principal | 0,6 à 0,9 s |
| Un décalage entre éléments | les lettres : 1 image ; les mots : 60 à 120 ms ; les lignes d'une liste : 40 à 80 ms |
| Un chevauchement | le geste suivant part quand le précédent en est à 30 ou 50 % |
| Écraser et étirer | accroupi 1,2 × 0,75 ; décollage 0,85 × 1,28 ; atterrissage 1,25 × 0,75 : le volume reste le même |
| Ce qui suit | les bras ont 4 images de retard, une queue ou un ruban 6 |

Rien n'est linéaire, sauf une machine. Rien n'apparaît en simple fondu : une chose arrive en bougeant, en se démasquant ou par une coupe.

## 4. Le cadre

- **Le sujet a une taille minimale.** Les premières images sont toujours trop larges et le sujet devient un point. Fixe sa largeur minimale dès la partition (au moins 170 pixels de large sur une image de 1080 de haut, pour un personnage dans un plan large) et mesure-la sur chaque plan.
- **Le texte est tout entier dans le cadre, ou tout entier dehors.** Jamais coupé. Une marge d'au moins 5 % ; sur un réseau, hors des zones que son interface recouvre (`derush-controle` les connaît).
- **L'énergie vient des coupes sur le temps**, pas des zooms. Un bel angle tient un temps entier avant la coupe suivante.
- **La première image bouge déjà.** Pas de première seconde vide. **La dernière image est l'image** : pas de ligne de fin ajoutée dessous, et une fin tenue de 0,6 à 1,4 s, avec quelque chose qui vit encore (un fond, une lumière).

## 5. Le contrôle du mouvement

Une planche d'images fixes peut être parfaite alors que la moitié du film est figée. Avant de dire que c'est fini :

1. **Les images fixes aux instants de la partition**, et une planche serrée (toutes les 0,25 s) autour du geste le plus rapide : `derush-toile images … --instants … --planche …`. Regarde les poses, l'écartement, les contacts.
2. **La taille du sujet**, mesurée en pixels sur chaque plan.
3. **Le contrat** : `derush-toile verifier` (deux fois le même instant ; à froid et à chaud ; la couture de la boucle : l'écart entre la dernière image et la première doit être celui d'un pas normal).
4. **Les passages figés et le mouvement seconde par seconde** : `derush-toile rendre` les écrit après chaque rendu (`derush-toile mouvement <vidéo>` pour une vidéo déjà faite). Chaque geste prévu dans la partition doit faire une bosse sur le graphique ; un passage figé que tu n'as pas demandé est un défaut. « Presque rien ne bouge » veut dire qu'un détail seul change (un trait fin qui se trace) : sur un téléphone, c'est une image fixe. Donne du corps au geste, ou fais vivre le reste (une caméra qui ne s'arrête jamais, un fond).
5. **Un regard qui n'a pas fabriqué** : en Mode Hollywood, le réalisateur ; sinon la grille de `references/jury.md`, appliquée sans indulgence.

Donne chaque contrôle avec son nombre. Et dis à la personne ce qu'aucun outil ne remplace : regarder la vidéo en entier, avec le son.

## 6. Corriger

Une bonne correction nomme un temps et un nombre : « entre 3 et 6 s, tout ralentit de 30 % », « le titre 30 % plus grand, tenu 1,5 s avant que le reste bouge », « à 7 s, le slogan recouvre le disque : 40 px vers la droite ». Une ou deux choses à la fois : dix corrections d'un coup, et on ne sait plus laquelle a aidé. Garde la version d'avant (`toile-v1/`), travaille sur une copie.

| Ce qui ne va pas | La correction |
|---|---|
| ça ressemble à un diaporama | chaque élément entre par un geste ; rien en simple fondu |
| c'est raide | un petit dépassement à chaque atterrissage, posé en 0,4 s |
| la fin est vide | à partir de telle seconde, quelque chose bouge encore (6 px de flottement) |
| la boucle saute | la dernière image s'enchaîne avec la première : position, vitesse, lumière |
| ça fait bon marché | une ombre douce sous chaque forme, un grain très léger sur le fond |
| le début ennuie | l'image 1 bouge déjà |

## 7. L'effort

Un premier jet se construit avec un effort élevé ; les corrections ciblées n'ont pas besoin de plus qu'un effort moyen. Le maximum sert rarement pour une image : il sert pour un problème de logique (une boucle qui ne ferme pas, un contrat qui ne tient pas). Le choix reste à la personne : Dérush ne change jamais de modèle tout seul.
