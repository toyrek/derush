# Provenance

- Source : https://github.com/social-media-skills/skills (dossier `skills/nano-banana`), commit f28cef2b7067ec64e79c9d85421c022c06659e03 (15 octobre 2026) : le même commit que les autres compétences de ce dépôt déjà livrées.
- Auteur : Frank Heijdenrijk. Licence MIT (texte dans `../licences/social-media-skills.txt` ; l'en-tête du `SKILL.md` dit aussi `license: MIT`).
- Intégrée à Dérush le 14 novembre 2026, après lecture : que du texte (Markdown), aucun programme, aucun appel réseau, aucune clé demandée, aucune adresse web.

## Ce qui a été retiré ou adapté pour Dérush

Retiré :

- Le dossier `evals/` (des cas de test), non copié.
- Toute la promotion du service de l'auteur (12 mentions) : le circuit « générer, téléverser chez lui, joindre au post », les phrases « ce service ne génère pas d'images », le renvoi à `scheduling-and-queue`. À la place : ranger l'image dans `remotion/public/images/`, dire ce qui a été généré, ne rien publier sans demande.
- Les 7 renvois à `tools/integrations/nano-banana.md` (un guide de l'API Gemini que Dérush ne livre pas : l'appel passe par ElevenLabs, voir `OUTILS.md`).
- Les renvois vers des outils que Dérush n'a pas (`ideogram`, `flux`, Midjourney, Canva) : la partie « Reach for something else when… » devient « Where it is weaker », sans nom de produit.
- La mention d'Imagen (datée) et l'ancrage par la recherche Google (« Search grounding »), qui ne fait pas partie de l'appel décrit dans `OUTILS.md`.
- Dans `references/examples.md` : l'exemple de création d'un logo au nom du service de l'auteur, remplacé par un fond de carton sans texte ; la phrase d'accroche d'un outil de programmation de posts, remplacée par un texte neutre ; la marque d'exemple (« SaaS social scheduler ») devient une marque inventée.
- Deux cas limites qui renvoyaient vers un autre modèle ou vers le service de l'auteur, et la dernière question de la liste de contrôle (même sujet).

Adapté :

- La description de l'en-tête, réécrite en une phrase (sans le renvoi au guide d'intégration ni au service de l'auteur).
- Une partie « Dans Dérush » en tête du `SKILL.md` : l'appel et les identifiants de modèle, les réglages, le texte d'une vidéo gardé en calque Remotion, les crédits, les personnes réelles, la marque du projet, où ranger l'image.
- La limite d'images de référence : 10 (celle de l'appel de Dérush) au lieu d'« environ 14 ».
- « Itère à 1K puis finalise en 2K ou 4K » devient « une génération réfléchie à la bonne définition » (la règle de crédits de Dérush).
- Les formules « le meilleur modèle, ce que tous les autres ratent » adoucies en « fort pour ».
- Le format 2:3 retiré de la liste (l'appel de Dérush ne le propose pas) ; 3:4 gardé.
- Retouche d'une image : une ligne sur la façon de l'envoyer (`images`), et l'interdit d'envoyer une photo où l'on reconnaît une personne.
- Les textes à vérifier : accents et guillemets compris ; un titre posé sur une vidéo reste un calque Remotion.
- Renvois : `video-prompting` (animer une image fixe) et `thumbnail-design` ajoutés.
