# D'où vient cette compétence

- Source : https://github.com/Melvynx/video-agent-skills (dossier `skills/clips`), commit f4542923f7f796a1fa0e544cbfc1109d5eec87d8 (6 novembre 2026).
- Auteur : Melvyn Malherbe. Licence MIT (texte dans `LICENSE` et dans `../licences/melvynx.txt`).
- Intégrée à Dérush le 14 novembre 2026, après lecture : un seul fichier de texte, aucun programme livré, aucune clé, aucune publicité. Sur skills.sh, elle apparaît encore sous son ancien nom, `long-to-short-videos`.
- Seul `SKILL.md` a été repris. Le moteur de montage du dépôt (`short-editing`) et ses autres compétences ne sont pas livrés.

## Ce qui a été retiré ou adapté pour Dérush

La méthode de l'auteur est gardée telle quelle : l'inventaire de ce que la vidéo contient, les règles d'un extrait qui tient seul, la note sur 10 et son seuil, les nouveaux scripts, le plan écrit, la marge de 0,5 s, les limites dites honnêtement. Ce qui la reliait à d'autres outils est retiré ou remplacé.

- En-tête : `argument-hint` et `allowed-tools` retirés (ils donnaient d'avance à l'IA le droit de lancer `yt-dlp`, `node`, `ffmpeg`). La description est réécrite en une phrase, en français.
- La vérification et l'installation des outils (`yt-dlp --version`, `/studio-setup tools`) sont retirées.
- Étape 1 : la lecture des sous-titres et des chapitres YouTube par `yt-dlp` et la transcription par le moteur `short-editing` sont retirées. Dérush a déjà transcrit la longue vidéo : la commande `node -e` de l'auteur est gardée, réglée sur `transcriptions/<rush>.json` (champs `mots`, `t`, `debut`). La commande `awk` pour les sous-titres VTT est retirée avec `yt-dlp`.
- Étape 3 : le renvoi à `../studio-script/references/hooks.md` devient un renvoi à `hook-writer` et `viral-hooks`. La marque `*accent*` du moteur devient « un mot dans la couleur d'accent ».
- Étape 4 : le format imposé par `/studio-script` devient un renvoi à `short-form-video-script` ; le format de secours de l'auteur (accroche, 6 à 12 lignes, une demande) est gardé.
- Étape 5 : le plan et les scripts vont dans `rendu/livraison/annexes/` au lieu de `video-agent/repurpose/` et `video-agent/scripts/`. Le circuit `log.md` et « résumé READY » de `studio-script` est retiré. « Boards » devient « Cards ».
- Étape 6 : le téléchargement de la vidéo par `yt-dlp` et la découpe de chaque extrait par `ffmpeg` dans `video-agent/takes/` sont retirés (le kit lit le rush directement). La règle de la marge de 0,5 s, à rogner ensuite au mot, est gardée.
- Étape 7 : `/short-editing`, ses dossiers, ses durées, ses sous-agents et l'offre `/publish` sont retirés. La suppression de `video-agent/.tmp/` aussi.
- Limites : « short-editing keeps a single framing; for split screens, use an editor » devient une phrase sur l'écran partagé à faire dans la composition.
- Ajouts de Dérush, en français et marqués « Dans Dérush » : le tableau du haut ; pas de téléchargement depuis un lien ; l'analyse des rushes comme point de départ ; l'accord des autres personnes filmées ; comment rogner au mot ; les pièces du kit et la livraison de plusieurs vidéos.
