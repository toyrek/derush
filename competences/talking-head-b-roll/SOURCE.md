# D'où vient cette compétence

- Source : https://github.com/iart-ai/b-roll-skills (dossier `skills/talking-head-b-roll`), commit bcd56742a8a99edaa699a6f7bc5a45922a8ec567 (11 novembre 2026).
- Auteur : iart.ai. Licence MIT (texte exact dans `LICENSE` et dans `../licences/iart-ai.txt`).
- Intégrée à Dérush le 14 novembre 2026, après lecture : seule la méthode est gardée (le plan A / B / C, ses règles de rythme, le calage élément par élément, la liste des contrôles). C'est un texte : aucun programme, rien à installer, rien ne part sur le réseau, aucune clé.

## Ce qui a été retiré

- `scripts/render.mjs` et `templates/b-roll.html` : le rendu passait par une page canvas filmée par un navigateur piloté (la bibliothèque npm `playwright-core` à installer, Chrome ou un Chromium téléchargé, des polices chargées chez Google). Dans Dérush, c'est le kit Remotion qui rend.
- `scripts/transcribe.mjs` : il retranscrivait la vidéo (whisper.cpp à installer, modèle anglais conseillé) et envoyait de lui-même le son à ElevenLabs, en dépensant des crédits, dès qu'une clé était dans l'environnement. Dérush a déjà la transcription mot à mot.
- `scripts/compare-timing.py` (une expérience que l'auteur dit dépassée) et `scripts/timing.test.mjs` (un essai de développement).
- La ligne « Needs » (installations par npm, npx et Homebrew), toutes les commandes de ces programmes (`--check`, `--sheet`, `--stills`, `--face`), et la livraison de la couche seule avec transparence (.mov ProRes 4444, .webm VP9).
- Hors du dossier de la compétence, non repris : le README (publicité pour iart.ai, liens de suivi, commandes `npx skills add`), les deux exemples (vidéos hébergées chez iart.ai), l'animation de démonstration (2 Mo), `.claude-plugin/`.

## Ce qui a été adapté

- Une partie « Dans Dérush » en tête : où sont les mots (`sous-titres/mots.json`, `transcriptions/`), monter la parole d'abord (`coupes.json`, `recouper.mjs`), écrire le plan dans `rendu/timeline.json` et le montrer si le brief ne tranche pas, poser chaque passage B ou C en `<Sequence>` dans `remotion/src/Montage.tsx` à partir des pièces du kit, les deux horloges traduites en numéros d'image, la boîte du visage (point de départ dans `analyse/<rush>.json`, vérification par une commande FFmpeg `drawbox`), les couleurs, polices et tailles de Dérush (2,8 % de la hauteur, 7 % pour une accroche, `ZONE_SURE`), les contrôles et le rendu (`node remotion/images.mjs`, `node remotion/rendre.mjs`, `derush-controle`), et le renvoi à `find-broll` pour des plans de coupe faits de vraies images.
- Deux défauts du modèle d'origine sont corrigés dans cette traduction : un passage qui finit avec la vidéo ne recule pas sa fin (l'original perdait ses 6 dernières images et laissait voir la personne un instant à la toute fin) ; la planche se fait en plusieurs appels pour un film long (l'original s'arrêtait à 80 images, ici l'outil du kit en prend 120 par appel).
- Le champ `description`, récrit en une phrase, en français.
- Partie 2 (le plan A / B / C, le rythme, le calage par élément) : le texte de l'auteur, mot pour mot, sauf deux choses : les noms de variables de son modèle (`s.now`, `s.audioNow`, `VISUAL_LEAD_FRAMES`, `SCENES.from/to`) sont dits en clair (horloge de structure, horloge de la voix, avance de six images, limites des scènes), et le renvoi à `compare-timing.py` est retiré.
- Parties 1, 3, 4 et 5 : les commandes de l'autre moteur sont retirées, les règles restent. Les seuils de son contrôle automatique (98,5 % de l'image opaque pour un plein cadre, 3 % de la boîte du visage, 0,6 s de carte vide, 40 % de l'image pour un graphique par-dessus, 1 s de la personne entre deux scènes, 3 % du bord pour un texte, plein cadre de 3 à 8 s, plus de 8 s de la personne seule) sont repris de `render.mjs`, vérifiés dans son code, en liste à contrôler soi-même. Les durées d'entrée et de sortie (0,5 s et 0,4 s) viennent du modèle `b-roll.html`.
- La phrase sur les polices Google est remplacée par une règle neutre (chaque police chargée avant de mesurer ou de dessiner).
