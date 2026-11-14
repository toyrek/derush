# D'où vient cette compétence

- Source : https://github.com/iart-ai/explainer-video-skills (dossier `skills/explainer-video`), commit 3c13a1bc360c08503f24f9c9a99fda6d3d35de56 (11 novembre 2026 ; le contenu de la compétence date du 22 juin 2026).
- Auteur : iart.ai. Licence MIT (texte dans `LICENSE` et dans `../licences/iart-ai.txt`). Le SKILL.md d'origine ne déclare pas d'autre licence.
- Intégrée à Dérush le 14 novembre 2026, après lecture : du texte et des extraits de code, aucun programme livré, aucune clé, aucun service payant ; une publicité (pied de page de la référence). Elle recoupe en partie `scripting-and-storyboarding` et `educational-content-and-how-to`, mais c'est la seule compétence qui mène de l'idée à la vidéo explicative montée : arc propre à l'explicatif avec ses parts de durée, budget de mots, storyboard avec la coupe posée sur un mot, voix, scènes et sous-titres tirés d'un seul tableau de temps. `diagram-animation` et `whiteboard-animation` s'appuient sur elle.
- Le texte de l'auteur (structure, analogie, rythme par temps, chaîne de fabrication, formule du script, exemple, gabarit de storyboard, règles des sous-titres, fiche de style) est gardé, en anglais.

## Ce qui a été retiré ou adapté pour Dérush

- La description est réécrite en une phrase, en français, qui dit quand ouvrir la compétence.
- Un encadré « Dans Dérush » en tête : la voix off (celle de la personne, ou ElevenLabs avec le temps des caractères), le temps des mots, les scènes dans le kit `remotion/`, les pièces du kit, les sous-titres (`SousTitres`, `subtitle-skill`), le son (`derush-son`), les commandes de contrôle ; et des notes « Dans Dérush » : 2,3 mots par seconde n'est qu'un repère anglais (mesurer la vraie voix), sous-titres plus courts en vertical, polices et couleurs du kit.
- Les techniques d'animation pour une page web (GSAP, transitions CSS, compteur par `requestAnimationFrame`) sont retirées : elles contredisaient le contrat Remotion de la même compétence, et l'extrait GSAP des liaisons ne dessinait rien (`strokeDasharray: 1` sans `pathLength="1"` sur les tracés). Elles renvoient aux recettes Remotion de `diagram-animation`, plus un composant `Keyword` (le mot qui apparaît sur l'image où il est dit).
- Ajouté et rendu image par image avant livraison : le tableau de temps unique en Remotion (`Ligne`, `scenesDe`, `dureeExplainer`), d'où viennent les coupes, la durée du film (`calculateMetadata`) et les sous-titres, avec la coupe posée sur un mot.
- « Deliver & verify » est réécrit avec les commandes du kit (`node remotion/images.mjs`, `node remotion/rendre.mjs`, `derush-controle`, `derush-son mesurer`) au lieu de `npx remotion still/render/compositions`, du GIF de démonstration pour un README et du schéma zod (absent du kit) ; les renvois aux scripts `scripts/contact-sheet.sh` et `scripts/probe-mp4.sh` (hors de la compétence) disparaissent.
- La fiche de style nommait Inter (absente du kit) : elle nomme Montserrat, police du kit. « After Effects » est retiré (absent d'ici).
- L'exemple « Shipfast » (fictif) est gardé, avec une note : il montre la forme, la vidéo s'écrit en français pour le public de la personne.
- Le pied de page publicitaire « Built by iart.ai… » et son lien de suivi sont retirés. Le `README.md` vide n'est pas livré.
