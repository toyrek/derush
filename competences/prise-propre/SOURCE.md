# D'où vient cette compétence

- Source : https://github.com/charlie947/reel-editing-skills (dossier `skills/video-intake`), commit d33f44988c0467c21d931aab35cc81d269e4b815 (21 octobre 2026).
- Auteur : Charlie Hills. Licence MIT (texte dans `LICENSE` et dans `../licences/charlie947.txt`).
- Intégrée à Dérush le 14 novembre 2026, après lecture, sous le nom `prise-propre` : dans son dépôt, elle s'appelle `video-intake` et prépare un dossier pour le moteur de page de l'auteur. Seule sa méthode de coupe est reprise, d'où le nouveau nom (et pour ne pas la confondre avec l'import de Dérush).
- Un seul fichier de texte est livré : aucun programme, aucun appel réseau, aucune clé, aucune publicité.

## Ce qui a été retiré ou adapté pour Dérush

Ce qui est gardé, mot pour mot ou presque : le contrôle du fichier (étape 2), le choix des prises et la coupe sur le vrai silence (son étape 4, ici étape 3), la relecture de la version coupée (son étape 5, ici étape 4) et « What I learned the hard way ».

- Non livré : tout le dossier `starter/` (le moteur de page `index.html`, `render.mjs` qui pilote un navigateur avec Puppeteer, `video.js`, `words.js`, une image d'exemple). Dérush monte avec son kit Remotion.
- Retirées : son étape 3 (`pip install openai-whisper`, modèle `small.en`, qui ne connaît que l'anglais) — Dérush transcrit à l'import, dans la langue de la vidéo ; son étape 6 (copie du starter, une image JPG par image de la vidéo) ; la partie « How the starter works » (dont `npm i puppeteer`).
- Étape 1 : « The look » (couleurs et police pour le starter) retiré ; « Ask for three things, then wait » devient « What you start from ».
- Étape 2 : `raw.mov` devient `plans/<rush>` ; « Bake it in on the first encode » retiré (on n'écrit pas dans `plans/`) ; « will drift » corrigé : un son qui commence en retard donne un décalage constant, pas une dérive, et seulement quand on traite le son à part ; le renvoi à l'étape 6 pour une source paysage devient une phrase générale.
- Étape 3 : la commande `silencedetect` lit le rush (`plans/<rush>`, première piste de son) au lieu de `audio.wav` ; « a whole number of 1/30s » précisé (des images entières du rush) ; `my-video/segments.json`, `trim`/`atrim`/`concat` et `cut-audio.wav` deviennent `coupes.json` et `node remotion/recouper.mjs coupes.json`.
- Étape 4 : « Run Step 3 on cut-audio.wav » devient un rendu suivi de `derush-controle`, qui retranscrit la version coupée et liste les redites.
- Le titre et la phrase d'introduction sont réécrits pour dire ce qui reste : une prise coupée proprement.
- Les renvois aux autres compétences du dépôt (non livrées) ont disparu avec les parties retirées.
- Ajouts de Dérush, en français et marqués « Dans Dérush » : le tableau du haut ; la pause de 0,15 à 0,2 s présentée comme le réglage de l'auteur pour un Reel serré (repères par genre dans `cutting-rhythm`) ; les silences déjà mesurés dans `analyse/` et leur limite ; ne jamais écrire dans `plans/` (une image tournée est déjà remise droite à l'import) ; le kit ne fait pas le fondu de 30 ms ; corriger les mots après le dernier recoupage.
