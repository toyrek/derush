# D'où vient cette compétence

- Source : https://github.com/iart-ai/explainer-video-skills (dossier `skills/diagram-animation`), commit 3c13a1bc360c08503f24f9c9a99fda6d3d35de56 (11 novembre 2026 ; le contenu de la compétence date du 22 juin 2026).
- Auteur : iart.ai. Licence MIT (texte dans `LICENSE` et dans `../licences/iart-ai.txt`). Le SKILL.md d'origine ne déclare pas d'autre licence.
- Intégrée à Dérush le 14 novembre 2026, après lecture : du texte et des extraits de code, aucun programme livré, aucune clé, aucun service payant ; une seule publicité (le pied de page de la référence). Elle comble un manque : aucune compétence de Dérush n'animait un schéma, une courbe ou un compteur.
- Le savoir de l'auteur est gardé (ordre nœuds → liaisons → étiquettes, une idée par temps, 0,5 à 1,5 s par étape, atténuation à 0,35, une couleur = un sens, tableau des courbes d'animation). Ses recettes visaient d'abord une page web : elles sont réécrites pour Remotion et rendues image par image avant livraison (planche de contrôle à chaque étape, compteurs vérifiés sur leur valeur finale).

## Ce qui a été retiré ou adapté pour Dérush

- La description est réécrite en une phrase, en français, qui dit quand ouvrir la compétence.
- Un encadré « Dans Dérush » en tête : le kit `remotion/`, l'horloge unique, `@remotion/paths`, les nombres à la française, les polices du kit (`usePolices()`), le calage sur les temps des mots, les commandes de contrôle (`images.mjs`, `rendre.mjs`, `derush-controle`). Deux notes « Dans Dérush » ailleurs (valeur exacte des compteurs, temps des mots).
- Recettes réécrites pour Remotion (`useCurrentFrame()`, `interpolate`, `spring`, `evolvePath`, `getPointAtLength`) : révélation nœuds puis liaisons, liaison où circulent des données, barres, courbe, compteur, et dans la référence : schéma d'architecture, diagramme de séquence, liaison dans les deux sens, barres en HTML, courbe avec points et aire, compteur à décimales, barres à ressort. Ajout d'un petit outil `focus()` pour l'atténuation, que l'auteur décrivait sans code.
- Retirés, parce qu'ils ne servent pas une vidéo ou qu'ils ne se figent pas sur une image : les versions GSAP (importé d'un CDN sans version), CSS (`@keyframes`, `transition`, `offset-path`), `requestAnimationFrame`, D3 et Framer Motion ; la partie « Build-tool choice » ; le livrable « un fichier HTML » avec son harnais `?t=N` et la commande `npx playwright screenshot` (elle installe un navigateur sans demander) ; les règles `prefers-reduced-motion`, remplacées par « la dernière image de chaque étape montre tout ».
- Corrigés : `gsap?.from(...)` (erreur si GSAP manque) disparaît avec GSAP ; `toLocaleString()` et `Intl.NumberFormat()` sans langue deviennent `'fr-FR'` (le format dépendait de la machine) ; le renvoi à une compétence `remotion-video` qui n'existe pas devient les commandes du kit.
- Le renvoi aux scripts `scripts/seek-shot.sh` et `scripts/contact-sheet.sh` (à la racine du dépôt d'origine, hors de la compétence) devient `node remotion/images.mjs`, qui fait les images fixes et la planche.
- Les étiquettes d'exemple du diagramme de séquence sont en français (« demande », « réponse », « accusé »).
- Le pied de page publicitaire « Built by iart.ai… » et son lien de suivi sont retirés. Le `README.md` vide n'est pas livré.
