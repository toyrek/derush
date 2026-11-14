# D'où vient cette compétence

- Source : https://github.com/iart-ai/explainer-video-skills (dossier `skills/wrapped-video`), commit 3c13a1bc360c08503f24f9c9a99fda6d3d35de56 (11 novembre 2026 ; le contenu de la compétence date du 22 juin 2026).
- Auteur : iart.ai. Licence MIT (texte dans `LICENSE` et dans `../licences/iart-ai.txt`). Le SKILL.md d'origine ne déclare pas d'autre licence.
- Intégrée à Dérush le 14 novembre 2026, après lecture : du texte et des extraits de code, aucun programme livré, aucune clé ; une section publicitaire qui poussait le service payant de l'auteur, et un renvoi à Remotion Lambda (payant). C'est un format que Dérush n'avait pas : le bilan chiffré de l'année d'une association ou d'un créateur, ou une vidéo personnalisée par participant tirée d'un tableau.
- Le savoir de l'auteur est gardé : une ligne de données = une vidéo, la grammaire de scènes et le storyboard en 7 scènes, la montée du plus petit chiffre au plus fort (jamais le grand chiffre en ouverture), le tutoiement, chaque scène lisible en moins de 2 s et belle figée, la carte finale immobile au moins 2 s pensée comme une affiche, le compteur à ressort à chiffres fixes, `<Series>`, les règles « tout depuis l'image ».
- Le code a été essayé avant livraison : images fixes de chaque scène, puis deux vidéos rendues depuis un tableau CSV par la boucle (une ligne invalide écartée, une image de partage par vidéo).

## Ce qui a été retiré ou adapté pour Dérush

- La description est réécrite en une phrase, en français, qui dit quand ouvrir la compétence.
- Un encadré « Dans Dérush » en tête (format, zones sûres, polices, nombres, outils, interdiction de reprendre l'identité d'une marque, données personnelles, licence Remotion) et des notes « Dans Dérush » (bilan d'association à la première personne du pluriel, fusion des props par-dessus `defaultProps`).
- L'exemple imitait Spotify (nom « Spotify Wrapped », vert #1DB954, minutes d'écoute, artistes, auditeurs) : il devient un atelier vidéo, en français et au tutoiement, avec une couleur neutre. « Wrapped » reste un mot pour reconnaître la demande.
- Le schéma `zod` (absent du kit) devient un type TypeScript ; la vérification des lignes se fait à la conversion (Python) et dans la boucle (Node).
- Corrigé : `load-rows.ts` renvoyait la ligne CSV brute (`wrappedSchema.parse({...}) && {...r, id}`) et jetait l'objet validé ; `user.id` nommait les fichiers sans figurer au schéma. Remplacé par `lignes.py` (bibliothèque standard), qui rend des enregistrements typés avec leur `id` et écarte une ligne invalide en le disant.
- Corrigé : les zones sûres contradictoires (« centre 80 % » annoncé, 70 % restant hors des 12 % du haut et 18 % du bas) ; ce sont maintenant celles de TikTok dans le kit (haut 10 %, bas 22 %, droite 14 %), avec la colonne de boutons de droite que l'original oubliait.
- Corrigé : la scène centile annonçait « top 3 % » sur une barre remplie à 3 %, presque vide au moment-clé ; elle dit « plus que 92 % des… » et la barre se remplit jusqu'à 92 %.
- Corrigé : `toLocaleString()` sans langue devient `Intl.NumberFormat('fr-FR')` ; `@remotion/google-fonts` (réseau au rendu, absent du kit) devient les polices du kit avec `usePolices()`.
- Ajouté : les scènes d'intro, de persona et de carte finale (l'original les laissait « à ajouter de la même façon ») ; l'avertissement sur la fusion des props (un champ absent d'une ligne montrerait la valeur de l'exemple, constaté pendant l'essai).
- Retirés : `render-all.ts` (`@remotion/bundler`, `npx tsx`), `p-limit`, `csv-parse`, la boucle `jq` + `npx remotion render`, Remotion Lambda, l'hébergement en stockage objet avec liens signés, le GIF de démonstration. Remplacés par une boucle Node (bibliothèque standard) qui appelle `node remotion/rendre.mjs` pour chaque ligne, saute ce qui existe déjà et tire l'image de partage avec FFmpeg.
- « Deliver & verify » est réécrit avec les commandes du kit (`images.mjs`, `rendre.mjs`, `derush-controle`) ; les renvois aux scripts `scripts/contact-sheet.sh` et `scripts/probe-mp4.sh` (hors de la compétence) disparaissent.
- La section « Built by the team behind iart.ai » (publicité pour le service payant, avec lien de suivi) est retirée. Le `README.md` vide n'est pas livré.
