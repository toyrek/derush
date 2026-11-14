# D'où vient cette compétence

- Source : https://github.com/louisedesadeleer/clipify (racine du dépôt), commit 5f6b75e6c0bfdce3cc9c78b850a67e23d65d9783 (24 août 2026).
- Auteure : Louise de Sadeleer. Licence MIT (texte exact dans `LICENSE` et dans `../licences/louisedesadeleer.txt`). Le mode Action, la vérification sur l'image et `detect_transients.py` viennent d'une contribution d'Erik (Erik5000 sur GitHub, PR n° 2), versée sous la même licence.
- Intégrée à Dérush le 14 novembre 2026, après lecture : une version resserrée sur les deux techniques que Dérush n'avait pas (suivre la personne qui parle dans un plan fixe à deux, ou l'écran partagé ; couper sur chaque impact sonore). Ses trois programmes ne lisent que les fichiers qu'on leur donne et écrivent sur la sortie standard : pas de réseau, pas de clé, rien d'envoyé, aucun autre programme lancé. Deux n'utilisent que la bibliothèque standard de Python ; `detect_transients.py` a besoin de numpy, déjà installé dans le Python de Dérush (celui que trouve la commande `python3` de l'IA).

## Ce qui a été retiré

- Étape 1A (chercher les moments drôles avec Whisper `tiny.en`, en anglais seulement, sur une liste de mots anglais) : Dérush a déjà la transcription mot à mot et d'autres compétences pour choisir les passages.
- Étape 2 (couper en `-c copy`, donc sur une image-clé) et étape 3 (demander le format) : le montage et le format viennent du projet.
- Étape 4c (accélérer un plan) : en double avec `ffmpeg-skill`, et le texte avait deux erreurs (`-t` placé après `-i`, donc 12 s de sortie au lieu de 6 ; sans `atempo`, le son ne monte pas dans les aigus, il se décale).
- Étape 5 et `scripts/build_ass.py` (sous-titres incrustés : taille prévue pour le vertical seulement, marge sous l'interface des réseaux, paquets qui ignorent les pauses) : les sous-titres sont ceux de Dérush.
- Étape 6 (livrer à côté de la vidéo d'origine, ouvrir le résultat avec `open`) : la livraison est celle de Dérush.
- `scripts/audio_align.py` (en double avec `sync.py` de `ffmpeg-skill`, et il lui fallait un son brut que le texte ne disait pas comment produire).
- Les commandes `whisper`, l'option `-hwaccel videotoolbox` (propre au Mac), le conseil `-preset ultrafast`, le dossier de travail partagé dans `/tmp`, la mention `~/.claude/skills/clipify/`, et dans les pièges : la paire `atempo`, le son aligné, Whisper.
- Hors de la compétence, non repris : le README (consignes `pip install` et `git clone`, lien vers le service de l'employeur de l'auteure), `assets/preview.png`, `.gitignore`.

## Ce qui a été adapté

- Une partie « Dans Dérush » en tête : où choisir les passages, le dossier de travail (`atelier/clipify/`), la mesure sur la partie utile du plan (`fichier.debut_utile_s`, `duree.s` de `montage.json`), comment écrire le résultat dans le kit Remotion (les points `cadrage.points` du plan, en temps du montage, avec `fenetre` et `"coupe": true`, vérifiés dans `remotion/src/Montage.tsx` et dans `recouper.mjs`, qui refait ces points), l'écran partagé dans le kit, le montage d'une action avec `coupes.json` et `recouper.mjs`, les contrôles sur des images (`node remotion/images.mjs`) et la comparaison avec le champ `locuteur` de la transcription quand il existe.
- Le champ `description`, récrit en une phrase, en français.
- `scripts/analyze.py`, corrigé (l'en-tête du fichier le dit) : les temps des segments viennent des temps écrits par FFmpeg (`pts_time`) et non plus d'un « 30 images par seconde » fixe, qui décalait tout en 25 ou en 60 i/s ; la fenêtre de lissage vaut une demi-seconde à toute cadence ; une entrée vide s'arrête avec un message clair. Le format des fichiers qu'il lit a été vérifié sur la sortie réelle de FFmpeg 9.0.1 (lignes `frame:… pts:… pts_time:…`, temps partant de 0 avec `-ss` avant `-i`) ; le programme lui-même n'a pas été lancé, il a été relu ligne à ligne.
- `scripts/build_pan.py` et `scripts/detect_transients.py` : inchangés.
- Les chemins `/tmp/clipify/` deviennent `atelier/clipify/` ; la mesure du mouvement et le rendu prennent `-ss` et `-t` (la partie utile du plan) ; les images de travail se réécrivent dans `atelier/` (`-y`), mais le rendu hors kit n'écrase jamais un fichier (`-n`) et va dans `rendu/`.
- Étape 4 : la question posée d'office (suivre ou écran partagé) n'est posée que si le brief ne tranche pas ; la largeur de la bande verticale est donnée pour toute taille d'image (hauteur × 9/16, nombre pair).
- Étape 1B : deux phrases ajoutées sur le seuil `--min-flux`, qui dépend du volume de l'enregistrement et suppose le son mono à 16 kHz de la commande ; et, dans « Dans Dérush », la mesure par morceaux d'un son de plus d'une vingtaine de minutes (le programme garde tout en mémoire).
- Le piège « coupes de caméra » renvoie à `analyse/<rush>.json` (`coupes_camera` ; la commande d'origine n'avait pas de fichier d'entrée).
- Les commandes FFmpeg gardées (mesure du mouvement dans deux zones, recadrage par coupes franches, écran partagé) ont été essayées le 14 novembre 2026 sur une vidéo d'essai, avec FFmpeg 9.0.1.
