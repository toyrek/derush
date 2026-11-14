# Provenance

- Source : https://github.com/Square-Zero-Labs/video-prompting-skill (dossier `video-prompting`), commit 79ecf65e696733670850cc3fe15e0c844e47bdeb (12 novembre 2026).
- Auteur : Square Zero Labs. Licence Apache-2.0 : le texte exact du fichier `LICENSE` du dépôt est dans `../licences/square-zero-labs.txt` (le dépôt n'a pas de fichier `NOTICE`, et son `LICENSE` ne nomme pas de titulaire).
- Intégrée à Dérush le 14 novembre 2026, après lecture : que du texte (Markdown), aucun programme, aucun appel réseau, aucune clé demandée. Les adresses web qui restent sont les sources citées par l'auteur (guides officiels de Google Cloud, ByteDance et Volcengine) ; rien ne demande à l'IA de les ouvrir.

## Ce qui a été retiré ou adapté pour Dérush

La licence Apache-2.0 demande de signaler les fichiers modifiés : chacun le dit aussi dans ses premières lignes.

Retiré (non copié) :

- Les guides des modèles que Dérush n'appelle pas : `references/models/minimax-h3/`, `ltx2/`, `ltx2-3/`, `ltx2-5/`, `wan22/`, `wan-animate-2/`, `ovi/` (avec leurs exemples et les 4 fichiers CSV d'Ovi) et `seedance2-5/` (sauf la méthode reprise plus bas).
- `references/models/seedance2/example_prompts/seedance2_examples.md` : des prompts copiés mot pour mot de la page de ByteDance, que la licence du dépôt ne couvre pas.
- À la racine du dépôt : `README.md` (consignes d'installation, lien vers les outils d'un autre éditeur, vidéo de démonstration), `.devcontainer/`, `.gitignore`.

Adapté :

- `SKILL.md` :
  - description réécrite en une phrase ; partie « Dans Dérush » ajoutée en tête (l'appel ElevenLabs, les quatre modèles, les réglages hors du prompt, `start_frame` et `end_frame`, les crédits, le son, les personnes réelles, où ranger le plan) ;
  - index réduit à Seedance 2 et Veo 3.1, avec les identifiants de modèle de Dérush ; la méthode de continuité ajoutée à l'index ;
  - « demande à l'utilisateur quel modèle, demande-lui l'image » remplacé par : l'IA choisit, le dit, et regarde l'image elle-même ;
  - consignes propres à MiniMax H3, Seedance 2.5, LTX-2.3 et LTX-2.5 retirées ;
  - la planche d'identité photographique (« photographic identity sheet ») retirée de l'aiguillage ;
  - sortie : le prompt part dans le champ `prompt` de l'appel, et une copie reste à côté du fichier généré.
- `references/models/seedance2/prompting.md` : parties « Reference-driven prompting » et « Edit / extend / reference-to-video » retirées (les références `@Image`, `@Video`, `@Audio`, la retouche et la prolongation ne font pas partie de l'appel décrit dans `OUTILS.md`) ; durée par défaut de 15 s remplacée par la plus courte qui convient (4 à 8 s) ; la phrase sur les portraits et les voix de personnes réelles remplacée par la règle de Dérush (jamais) ; renvoi au fichier d'exemples retiré ; « demande l'image » remplacé par « regarde l'image » ; une courte partie « Continuing a shot » (la dernière image d'un plan comme `start_frame` du suivant).
- `references/models/veo3/prompting.md` : identifiants de modèle de Dérush ; images de départ et d'arrivée reliées à `start_frame` et `end_frame` ; « demande l'image » remplacé par « regarde l'image » ; le son n'est dirigé que si le plan garde le sien.
- `references/workflows/character-sheets.md` : le mode « Photoreal identity-sheet » (reproduire une personne réelle à partir d'un portrait), ses conseils de pose, de fond et de mise en page, et ses deux gabarits sont retirés ; règle de Dérush ajoutée en tête (personnages inventés, mascottes et objets seulement) ; le gabarit « Wardrobe-only update » parle du personnage et non plus de la personne ; les questions à l'utilisateur deviennent des choix que l'IA fait d'après le brief.
- `references/workflows/continuity-and-refinement.md` : fichier nouveau, composé avec des parties du guide `references/models/seedance2-5/prompting.md` de l'auteur, reprises dans les mots de l'auteur (« Build the prompt », « Direct time and continuity », « Direct camera, performance, physics, and audio », l'image vers vidéo et la suite d'un plan à partir de sa dernière image, les gabarits de plan simple, de plan minuté et de suite, « Refine a miss », « Check the result »). N'ont pas été repris : les capacités et les réglages de Seedance 2.5 et de son fournisseur, les rôles des références et les lignes qui en parlent dans les listes, la synchronisation labiale sur un son fourni, la retouche d'un plan. Deux lignes sont de Dérush : la note d'en-tête, et « le son n'est dirigé que si le plan garde le sien ».
