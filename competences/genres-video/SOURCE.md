# D'où vient cette compétence

**Source :** Claude Video Editing Skills, de Viprasol Tech, https://github.com/Viprasol-Tech/claude-video-editing-skills — commit `0212f770474a2e72031335a52a2e0fc794686f9d` (23 novembre 2026).
**Licence :** MIT (texte complet : `LICENSE`, à côté de ce fichier).

## Ce qui est repris

- Les 42 fiches de genre du greffon `video-studio` (`plugins/video-studio/skills/<genre>/SKILL.md`) : `fiches/<genre>.md`.
- De chacune : le titre, la phrase de présentation, les repères (pour quoi, avec quoi, formats, durée), la partie « How a pro cuts this » (la structure, le rythme, les règles de coupe, le son, la couleur, les erreurs courantes) et la partie « Check before delivering ».

## Ce qui a été changé

- Une seule compétence, `genres-video`, au lieu de 42 : moins de place dans la liste des compétences de l'IA. Les en-têtes YAML des fiches sont retirés ; leur description anglaise devient la citation sous le titre (sans sa liste de phrases de déclenchement).
- Un nom et un résumé en français pour chaque genre (`catalogue.json`, l'index `SKILL.md`) ; le corps des fiches reste en anglais.
- Les parties propres à leur moteur sont retirées : « Before you start », « Make the edit », « Refine the plan », « Deliver », « Example requests », la ligne « Default skin » et le nom du préréglage de genre. Un en-tête de Dérush les remplace : il dit avec quels outils monter, et comment lire les noms de commandes ou de préréglages qui restent dans le texte.
- Chaque fiche dit sa provenance à sa fin.

## Ce qui n'est pas repris

- Le moteur `video-studio-core` (une quarantaine de programmes Python : transcription, coupe, recadrage, couleur, son, livraison, contrôle) : Dérush a déjà les siens, et deux chaînes de montage dans un même dossier se marcheraient dessus.
- `video-director` (le choix automatique d'un genre par leur moteur), les 46 habillages (`theme.css`, `theme.json`, faits pour leur moteur ; Dérush a `styles-video`) et les 5 utilitaires (`platform-pack`, `accessibility-pack`, `editor-handoff`, `finishing-pro`, `versions-review`).
- L'installateur, l'appli de relecture locale et le catalogue de leurs effets.

## Rafraîchir

Retélécharger le dépôt à un nouveau commit dans un dossier temporaire, relancer la fabrication (les mêmes changements), relire les fiches nouvelles ou changées, puis `node outils/essai-competences.mjs` : il vérifie que chaque genre du catalogue a sa fiche, qu'aucune commande de leur moteur n'y reste en titre de partie et que chaque fiche dit sa provenance.
