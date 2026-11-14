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

- `npm install` installe Remotion, une seule fois, **seulement si `node_modules` n'est pas déjà là**. Quand Dérush lance l'IA, `node_modules` est un lien vers son moteur de rendu, partagé par tous les projets : n'y lance jamais `npm install`.
- `npm run studio` ouvre la prévisualisation dans le navigateur (pour un humain).
- `npm run image` produit une image de contrôle : `../rendu/image.png`. Pour l'IA : `node images.mjs` (plus bas), qui marche aussi quand le navigateur de rendu est tenu par Dérush.
- `npm run rendu` rend le montage du kit dans `../rendu/montage.mp4`. Il passe par `rendre.mjs`, qui montre le rendu en direct dans Dérush.
- `node rendre.mjs <Composition> <sortie.mp4> [--titre "…"] [--props '{…}']` rend une autre composition ou vers un autre fichier. La vidéo à livrer : `node rendre.mjs Montage ../rendu/final.mp4` (plusieurs vidéos : une composition par vidéo, rendues dans `../rendu/livraison/`).

Les plans sont lus depuis `public/plans`, un lien vers `../plans`. Si ce lien manque, par exemple après un dézippage sous Windows, copie le dossier `plans` dans `public/`.

## Pour l'IA

- `src/pieces/` : des pièces d'habillage prêtes et vérifiées (accroche derrière la personne, sous-titres mot à mot, étiquette, carte, barreaux, vieux papier, cases, bouton d'abonnement, carton de fin). Leur mode d'emploi est dans `src/pieces/LISEZMOI.md` ; la composition « Pieces » les montre toutes.
- `node images.mjs [Composition] --de 0 --a 10 --pas 10` (ou `node remotion/images.mjs …` depuis le pack) : des images fixes et une planche, pour contrôler avant le rendu complet (`--help`).
- `src/Montage.tsx` contient la structure.
- Remplace `<ACreer>` par les vraies scènes. Garde les `from` et `durationInFrames` : ce sont les temps décidés par l'humain.
- `src/moteur.js` est le moteur d'habillage de Dérush (le même fichier que dans l'app). Il dessine les effets de `habillage.effets` et le `style` de `../montage.json` : pour changer un effet, change ses réglages là-bas.
- `AFFICHER_CONSIGNES`, dans `src/reglages.ts`, montre les cases et les notes de l'humain pendant le travail (le studio, `images.mjs`). Un rendu ne les dessine jamais : `rendre.mjs` passe `afficherConsignes: false`.
- Les données viennent de `../montage.json` et `../sous-titres/mots.json`, voir `src/donnees.ts`.
- Si un plan a déjà des sous-titres ou des titres incrustés, mets son ID dans `PLANS_SANS_SOUS_TITRES`, dans `src/reglages.ts`. Ses sous-titres ne seront pas doublés.
- Pour choisir d'autres passages, resserrer ou réordonner : `node recouper.mjs coupes.json` (depuis ce dossier, ou `node remotion/recouper.mjs` depuis le pack). Il refait les plans de `../montage.json` et recale les sous-titres, sans toucher à ce que tu as changé ailleurs dans ce fichier (style, effets, plans par-dessus). Son mode d'emploi est en tête du fichier.
- `../OUTILS.md` dit quel outil prendre pour aller plus loin (3D, physique, shaders, voix…) et comment le brancher.
- Après le rendu, vérifie la vidéo livrée (`../rendu/final.mp4`). La marche à suivre est dans la section « Vérifier avant de livrer » de `../LISEZMOI-IA.md`.
