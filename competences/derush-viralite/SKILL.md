---
name: derush-viralite
description: Analyser une vidéo courte finie (TikTok, Instagram Reels, YouTube Shorts) juste avant sa publication, noter son accroche, son rythme, sa structure, son son, ses textes, son format, sa fin et son originalité, puis dire quoi changer au montage. À utiliser quand Dérush demande une analyse de viralité ou un plan de publication.
---

# Analyser une vidéo avant de la publier

Une analyse de viralité ne prédit pas les vues : personne ne le peut. Elle vérifie que la vidéo ne perd pas de
spectateurs pour une raison évitable, et elle dit quoi changer, dans l'ordre. Chaque constat s'appuie sur une preuve :
une mesure, une phrase du texte, ou ce qu'on voit sur une image. Ce qui n'est pas vérifiable se dit comme tel.

Les faits datés sur les réseaux (ce qu'ils disent eux-mêmes, et ce que montrent les études) sont dans
[reperes.md](reperes.md). Lis-le avant de noter. Ce qui vient d'un blog ou d'une estimation y est signalé : ne le
présente jamais comme une règle officielle.

## Ce que tu reçois

- `contexte.md` : le projet, la vidéo, les mesures commentées, le texte dit avec ses horaires.
- `mesures.json` : les mêmes mesures, brutes.
- `planches/accroche.jpg` : six images des trois premières secondes (0 s, 0,5 s, 1 s, 1,5 s, 2 s, 2,5 s).
- `planches/ensemble.jpg` : douze images réparties sur toute la vidéo (lues de gauche à droite, puis ligne suivante).
- `planches/fin.jpg` : six images des trois dernières secondes.

Regarde vraiment les planches : c'est la seule façon de savoir s'il y a un texte à l'écran, des sous-titres, un visage,
du mouvement, un logo d'un autre réseau.

## Les huit axes, notés de 0 à 10

Note d'après ce que tu constates, pas d'après ce que la vidéo voulait faire. 5 veut dire « correct, sans plus ».

| Axe | Ce qu'on regarde | 8 à 10 | 5 à 7 | 0 à 4 |
|-----|------------------|--------|-------|-------|
| `accroche` | Les 3 premières secondes : la première image, la première phrase, le texte à l'écran | On comprend tout de suite pourquoi rester : une promesse, une tension ou une image forte, sans intro | Le sujet est clair mais rien n'accroche | Une intro, un logo, un « bonjour », un silence ou un plan vide |
| `structure` | La promesse est-elle tenue ? Y a-t-il une progression et une chute ? | Chaque passage fait avancer ; la fin récompense d'être resté | Bon contenu, mais des longueurs ou une fin plate | On ne sait pas où ça va, ou la promesse n'est pas tenue |
| `rythme` | Les coupes, les changements d'image, les blancs | Il se passe quelque chose de neuf toutes les 2 à 4 s ; aucun blanc inutile | Des plans un peu longs, quelques blancs | De longs plans fixes, des hésitations gardées |
| `son` | La voix se comprend-elle ? Le niveau, la musique, les bruitages | Voix nette, niveau des réseaux (autour de −14 LUFS), musique sous la voix | Audible mais terne, ou musique un peu forte | Voix couverte, saturée, ou trop faible |
| `texte` | Sous-titres et textes à l'écran : lisibles, bien placés | Lisibles sans le son, gros, dans la zone visible, synchrones | Présents mais petits, chargés ou mal placés | Absents alors que la vidéo est parlée, ou cachés par l'interface |
| `format` | Le cadre, la durée, la netteté pour le réseau visé | Vertical plein écran, durée justifiée, image propre | Bon format mais durée discutable ou cadrage serré | Bandes noires, mauvais sens, durée qui sort des recommandations |
| `fin` | Les dernières secondes : la chute, l'invitation à agir, la boucle | Une chute nette et une seule invitation claire (partager, commenter, suivre), ou une boucle | Ça s'arrête correctement, sans invitation | Coupé net, ou la vidéo traîne après la chute |
| `originalite` | Est-ce bien à soi ? Est-ce dans l'air du temps pour ce sujet ? Trouvable par la recherche ? | Contenu original, angle personnel, mots-clés dits et écrits | Format déjà vu mais propre | Reprise d'un contenu d'un autre, filigrane d'une autre appli |

Pour une vidéo sans parole (musique, images), note `texte` sur les textes à l'écran et `son` sur la musique ; ne
pénalise pas l'absence de sous-titres s'il n'y a rien à sous-titrer.

## Les conseils

- Un conseil par axe, concret et faisable au montage : « commence par la phrase de 0:12 », « coupe le blanc entre
  0:08 et 0:10 », « mets le titre en gros dès la première image ». Jamais « améliore l'accroche ».
- Pour chaque conseil, écris aussi `demande` : la phrase que la personne peut envoyer telle quelle à l'IA qui monte
  (« Refais le début : … »). Elle doit suffire sans autre explication.
- Trois priorités au plus, classées par effet attendu. Si un axe est déjà bon, dis-le et ne propose rien.
- Mots simples, tutoiement, phrases courtes. Pas de « rétention », « engagement », « hook » : dis « les gens
  restent », « les gens réagissent », « l'accroche ».

## Par réseau

Donne une note sur 10 pour TikTok, Instagram Reels et YouTube Shorts, avec une phrase qui dit pourquoi cette vidéo y
est plus ou moins à sa place (durée, ton, recherche, partage en privé). Les trois réseaux récompensent d'abord la même
chose : qu'on regarde jusqu'au bout et qu'on partage.

## Les tendances

Si tu as la recherche sur le web : deux ou trois recherches ciblées sur le sujet de la vidéo et son format (pas une
recherche générale), des sources de moins de trois mois si possible, l'adresse et la date de chacune. Préfère ce que
les réseaux publient eux-mêmes et les études chiffrées aux articles de blog. Sans recherche, ou si elle ne donne rien de
sûr : ne remplis pas la liste avec des généralités, appuie-toi sur reperes.md et dis-le dans `limites`.

Ne recommande jamais d'utiliser une musique ou une vidéo dont la personne n'a pas les droits, ni de faire croire à
quelque chose de faux pour accrocher.
