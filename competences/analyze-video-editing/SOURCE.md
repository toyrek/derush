# D'où vient cette compétence

- Source : https://github.com/gitethanwoo/video-editing (dossier `skills/analyze-video-editing`), commit 8b633c2d698410e523f95335aa6433766264cc7f (12 novembre 2026).
- Auteur : Ethan Woo. Licence MIT (texte exact dans `LICENSE` et dans `../licences/gitethanwoo.txt`).
- Intégrée à Dérush le 14 novembre 2026, après lecture : la méthode et ses deux références, sans programme. Rien à installer, rien ne part sur le réseau, aucune clé n'est demandée, aucune publicité.

## Ce qui a été retiré

- `scripts/video_analyzer.py` : il se lançait avec « uv run » et téléchargeait à son premier lancement librosa, OpenCV, numpy, soundfile et leurs dépendances (environ 200 Mo). Ses mesures sont refaites avec `media-analysis`, `ffmpeg-skill` et FFmpeg, déjà dans Dérush. Ce qu'on perd : l'estimation automatique du mouvement de caméra, qui se lit maintenant sur les bandes d'images. Il avait aussi deux défauts (sous-titres VTT de Whisper ignorés sans le dire, bandes d'images qui relisaient le film depuis le début).
- `scripts/audio_listener.py` : sans option contraire, il envoyait le son de la vidéo au modèle en ligne de Google (Gemini), avec une clé lue dans l'environnement. Dans Dérush, l'écoute reste sur l'ordinateur.
- `tests/smoke_test.py` (un essai de développement) et `agents/openai.yaml` (une fiche d'affichage pour un autre assistant).
- Les commandes « uvx --from yt-dlp » qui téléchargeaient une vidéo depuis un lien : Dérush n'installe rien pour cela, on demande le fichier à la personne.
- L'option de lecture du texte par Tesseract (absent de Dérush) et la mention « OCR boxes » dans les preuves mesurées.
- Les renvois à la compétence voisine `video-editing`, qui n'est pas livrée ici.
- Hors du dossier de la compétence, non repris : le README, la CI et les autres compétences du dépôt (`find-broll` est livrée à part).

## Ce qui a été adapté

- Une partie « Dans Dérush » en tête : où trouver la référence (et ne jamais réutiliser ses images ni son son), le partage avec `steal` (copier le style chiffré d'un reel) et cette compétence (comprendre un montage), les commandes qui remplacent les deux programmes, l'écoute sur l'ordinateur (Earshot), et la comparaison du montage fini avec la référence (`media-analysis style diff`). Les trois commandes FFmpeg (bande de 12 images autour d'une coupe, spectrogramme, niveau par demi-seconde) reprennent les réglages des programmes de l'auteur. Toutes ces commandes ont été essayées le 14 novembre 2026 sur une vidéo d'essai (FFmpeg 9.0.1, `media-analysis` 0.1.15).
- Le champ `description`, récrit en une phrase, en français, centré sur « comprendre pourquoi une vidéo fonctionne » pour ne pas se confondre avec `steal`.
- Partie « Start with a source you can inspect » : resserrée sur ce qu'il faut réunir comme preuves, sans les commandes des programmes retirés.
- `references/audio-and-timing.md` : la fin, qui décrivait ce qu'écrivait `audio_listener.py`, est remplacée par trois phrases sur l'écoute dans Dérush. Le reste est inchangé, y compris la leçon tirée de l'essai de l'auteur (un modèle d'écoute comprend bien le sens, mal les limites exactes).
- `references/editorial-analysis.md` : inchangé.
- Tout le reste du SKILL.md (les trois niveaux mesuré, observé, interprété ; la grille par moment ; les deux échelles du rapport ; « des principes, pas des imitations » ; la barre de qualité) est le texte de l'auteur, sauf « Do not redistribute the downloaded reference media », devenu « the reference media » puisqu'on ne télécharge plus rien.
