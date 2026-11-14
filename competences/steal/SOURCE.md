# D'où vient cette compétence

- Source : https://github.com/Melvynx/video-agent-skills (dossier `skills/steal`), commit f4542923f7f796a1fa0e544cbfc1109d5eec87d8 (6 novembre 2026).
- Auteur : Melvyn Malherbe. Licence MIT (texte dans `LICENSE` et dans `../licences/melvynx.txt`).
- Intégrée à Dérush le 14 novembre 2026, après lecture : deux fichiers de texte (`SKILL.md`, `references/learnings.md`), aucun programme livré, aucune publicité. Ses commandes sont du FFmpeg, et un appel facultatif à ElevenLabs.
- Le moteur de montage du dépôt (`short-editing`) et ses autres compétences ne sont pas livrés.

## Ce qui a été retiré ou adapté pour Dérush

La méthode de l'auteur est gardée telle quelle : les trois passes de mesure (images et coupes, son, zooms) et leurs commandes FFmpeg, le style écrit avec la mesure à côté de chaque valeur, l'essai, la comparaison image par image avec l'original, et `references/learnings.md` en entier (les six refus et leur correction). Ce qui la reliait à d'autres outils est retiré ou remplacé.

- En-tête : `argument-hint` et `allowed-tools` retirés (ils donnaient d'avance à l'IA le droit de lancer `yt-dlp` et `treg`). La description est réécrite en une phrase, en français.
- La vérification et l'installation des outils (`yt-dlp --version`, `/studio-setup tools`) sont retirées.
- Étape 1 : le téléchargement du modèle par `yt-dlp` et, pour Instagram et TikTok, par un appel payant à Treg, est retiré. Le modèle est un fichier que la personne a donné (`contexte/`, `references/`). Les deux phrases de l'auteur « un fichier local : prends-le » et « sinon, demande à la personne d'enregistrer la vidéo » sont gardées.
- Étape 2 : les chemins `video-agent/…` deviennent `atelier/steal-<name>/` (brouillons) et `rendu/livraison/annexes/style-<name>/` (le style). La ligne qui lisait la clé d'ElevenLabs dans `video-agent/.env` est retirée : quand la personne a branché ElevenLabs, Dérush donne déjà la clé à l'IA. Le reste de la mesure du niveau de la musique sous la voix est gardé, toujours facultatif et annoncé.
- Étape 3 : `style.json`, le schéma `style-schema.md`, `assets/looks.json` et toutes les clés du moteur `short-editing` sont retirés. Il reste `STYLE.md`, que l'IA applique dans le kit. Dans son modèle, la dernière partie (« How short-editing applies it ») devient « How it is applied here », et la ligne de renvoi à `style.md` du moteur est retirée.
- Bruitages : la bibliothèque du moteur (`<short-editing>/assets/sfx/`, `sfx.kit`, `sfx.extra`) devient les sons du kit et la bibliothèque de sons de Dérush (`sons-openverse`, Real SFX). La génération par ElevenLabs reste en dernier recours et avec l'accord de la personne ; la commande `curl` de l'auteur est gardée (elle écrit dans `atelier/`), avec un renvoi à la compétence `sound-effects`.
- Images : le renvoi à `/codex-images` (un service à part) et l'élément `img` du moteur sont retirés ; la règle « jamais un visage généré » est gardée, avec l'accord de la personne avant toute image générée.
- Étapes 4 à 6 : `/short-editing <take> style <name>` devient un essai de 10 à 20 s monté dans le kit et rendu dans `rendu/essai-<name>.mp4` ; les chemins de la commande de comparaison sont ceux du dossier de travail ; « ouvre la vidéo d'essai » devient « livre-la » ; « où se trouve le style » devient « la fiche du style arrive avec la vidéo ».
- Fin : l'auteur demandait d'ajouter les leçons générales dans `references/learnings.md`, donc de modifier la compétence elle-même. Elles vont dans `STYLE.md` et dans `carnet-ia.md`.
- `references/learnings.md` : gardé mot pour mot.
- Ajouts de Dérush, en français et marqués « Dans Dérush » : l'encadré du haut (le modèle est un fichier donné ; on copie un style, jamais les images, la musique ni les sons du modèle ; où ranger ; comment appliquer), l'écoute par Earshot et la mesure du tempo par `scenes.py --beats`.
