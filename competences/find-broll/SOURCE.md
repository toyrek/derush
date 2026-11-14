# D'où vient cette compétence

- Source : https://github.com/gitethanwoo/video-editing (dossier `skills/find-broll`), commit 8b633c2d698410e523f95335aa6433766264cc7f (12 novembre 2026).
- Auteur : Ethan Woo. Licence MIT (texte exact dans `LICENSE` et dans `../licences/gitethanwoo.txt`).
- La méthode est elle-même adaptée de B-Roll Finder, de Louise de Sadeleer (https://github.com/louisedesadeleer/b-roll-finder, licence MIT ; texte relu au commit 36b8a56d2a96e9e603535272df16726e878d9606, identique à celui de `../licences/louisedesadeleer.txt`, et recopié à la suite dans `LICENSE`). Le fichier `NOTICE.md` du dépôt d'Ethan Woo le dit ainsi : « The `find-broll` skill adapts methodology from B-Roll Finder, copyright Louise De Sadeleer, under the MIT License. » La partie « Attribution » du SKILL.md est gardée.
- Intégrée à Dérush le 14 novembre 2026, après lecture : une méthode et deux références, sans aucun programme. Rien ne part sur le réseau, aucune clé n'est demandée, aucune publicité.

## Ce qui a été retiré

- `agents/openai.yaml` (une fiche d'affichage pour un autre assistant).
- Les renvois aux deux compétences voisines du dépôt qui ne sont pas livrées ici : la transcription par `analyze-video-editing` (Dérush a déjà les mots horodatés) et l'établi `video-editing` (rendu basse définition, rapport de validation, somme de contrôle).
- Dans `references/sourcing-and-routing.md` : la ligne qui conseillait un téléchargeur de vidéos (yt-dlp) et un navigateur piloté. Dérush ne les a pas et n'installe rien sans accord.
- Hors du dossier de la compétence, non repris : le README, la CI, les tests et les trois autres compétences du dépôt.

## Ce qui a été adapté

- Une partie « Dans Dérush » en tête : où sont les mots, l'ordre des sources (ce que la personne a donné, ce qu'on fabrique avec le kit ou ElevenLabs s'il est branché, les images sous licence libre ou du domaine public, puis le reste seulement avec son accord ; un crédit à l'écran ne vaut pas une licence), rien à installer pour chercher, les interdits de Dérush (vraie violence, mineur reconnaissable, visage d'un particulier pris sur le web), où ranger le manifeste (`rendu/notes/broll-manifest.json`) et les fichiers (`remotion/public/broll/`), comment poser (une `<Sequence>` du kit, ou `broll.py` de `ffmpeg-skill`) et vérifier (`node remotion/images.mjs`, `derush-controle`), où vont les crédits (la fiche de publication).
- Le champ `description`, récrit en une phrase, en français.
- « Treat plan approval as authorization for read-only research and downloading public candidates » devient : l'accord sur le plan vaut pour la recherche ; télécharger ou capturer une source d'un tiers demande l'accord de la personne pour cette source. C'est le seul changement de fond : les montages de Dérush sont publiés, souvent par des jeunes, et « disponible » ne veut pas dire « permis ».
- « If only media is supplied, transcribe once… » devient un renvoi à la transcription déjà présente dans le dossier de travail.
- Partie « Verify the render » et livraison : sans l'établi d'origine, donc sans rapport de validation ni somme de contrôle.
- `references/manifest-and-timing.md` : l'emplacement du manifeste dans Dérush est ajouté à la première ligne ; le reste est inchangé.
- `references/sourcing-and-routing.md` : la ligne des outils (voir plus haut) devient FFprobe, `look.py` de `ffmpeg-skill` et `node remotion/images.mjs` ; le reste est inchangé.
- Tout le reste (les routes, l'ordre d'autorité, la note sur six critères, la densité selon le genre, le placement 0,2 à 0,5 s après le début du mot, les invariants du manifeste, la revue image par image) est le texte de l'auteur.
