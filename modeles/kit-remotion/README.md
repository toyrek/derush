# Kit de rendu Remotion

Ce kit fabrique déjà la vidéo du pack, telle que Dérush la montre dans son aperçu.

| Élément | Ce que fait le kit |
|---|---|
| Plans | Dans l'ordre, coupés à l'image près, recadrés sur le sujet si le format change. |
| Son | Avec les débordements J-cut et L-cut. Si le brief l'a demandé, on peut garder la voix seule ou seulement le fond. |
| Plans par-dessus | En plein écran ou en incrustation. |
| Habillage | Les effets posés dans Dérush : transitions, titres, titre derrière la personne, carton de fin, bruitages, et le style du film (sous-titres, grain, bords sombres…). |
| Cases à créer | Affichées comme des cases violettes pendant le travail. |

Il reste à créer ce que Dérush ne sait pas faire seul :
- les scènes des cases à créer ;
- tout ce qui rend la vidéo meilleure : 3D, images générées, motion design sur mesure.

## Commandes

```bash
npm install
npm run studio
npm run image
npm run rendu
```

- `npm install` installe Remotion (à faire une seule fois).
- `npm run studio` ouvre la prévisualisation dans le navigateur.
- `npm run image` produit une image de contrôle : `../rendu/image.png`.
- `npm run rendu` produit la vidéo finale : `../rendu/montage.mp4`. Il passe par `rendre.mjs`, qui montre le rendu en direct dans Dérush.
- `node rendre.mjs <Composition> <sortie.mp4> [--titre "…"] [--props '{…}']` rend une autre composition ou vers un autre fichier (plusieurs vidéos : une composition par vidéo, rendues dans `../rendu/livraison/`).

Les plans sont lus depuis `public/plans`, un lien vers `../plans`. Si ce lien manque, par exemple après un dézippage sous Windows, copie le dossier `plans` dans `public/`.

## Pour l'IA

- `src/Montage.tsx` contient la structure.
- Remplace `<ACreer>` par les vraies scènes. Garde les `from` et `durationInFrames` : ce sont les temps décidés par l'humain.
- `src/moteur.js` est le moteur d'habillage de Dérush (le même fichier que dans l'app). Il dessine les effets de `habillage.effets` et le `style` de `../montage.json` : pour changer un effet, change ses réglages là-bas.
- `AFFICHER_CONSIGNES`, dans `src/reglages.ts`, montre les cases et les notes pendant le travail. Passe-le à `false` pour le rendu final.
- Les données viennent de `../montage.json` et `../sous-titres/mots.json`, voir `src/donnees.ts`.
- Si un plan a déjà des sous-titres ou des titres incrustés, mets son ID dans `PLANS_SANS_SOUS_TITRES`, dans `src/reglages.ts`. Ses sous-titres ne seront pas doublés.
- Pour choisir d'autres passages, resserrer ou réordonner : `node recouper.mjs coupes.json` (depuis ce dossier, ou `node remotion/recouper.mjs` depuis le pack). Il refait `../montage.json` et recale les sous-titres. Son mode d'emploi est en tête du fichier.
- `../OUTILS.md` dit quel outil prendre pour aller plus loin (3D, physique, shaders, voix…) et comment le brancher.
- Après `npm run rendu`, vérifie la vidéo. La marche à suivre est dans la section « Vérifier avant de livrer » de `../LISEZMOI-IA.md`.
