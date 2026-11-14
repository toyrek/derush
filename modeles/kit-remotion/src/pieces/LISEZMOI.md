# Les pièces du kit

Des morceaux d'habillage prêts et vérifiés, faits d'après les meilleurs montages livrés par Dérush. Pars d'eux au lieu de
tout réécrire : tu gagnes du temps, et ils évitent les pièges déjà rencontrés (mots collés par un contour, texte qui
déborde, polices mesurées avant d'être chargées, accent d'un É qui touche la ligne du dessus). Règle leurs couleurs,
leurs textes et leurs temps avec leurs propriétés ; écris du neuf seulement pour ce qu'elles ne font pas.

```tsx
import {TitreGeant, PersonneDevant, SousTitres, Etiquette, CarteListe, Barreaux, VieuxPapier,
  CasesQuiSeDessinent, BoutonAbonnement, CartonDeFin} from './pieces';
```

Pour les voir toutes, au format du projet : `node remotion/images.mjs Pieces --de 0 --a 17 --pas 15` (composition
« Pieces », dans `Demo.tsx`). Chaque pièce se pose dans une `<Sequence from durationInFrames>` : ses temps partent du
début de la Sequence. `duree` (en images) la fait sortir en douceur à la fin.

## L'accroche derrière la personne

Les deux premières secondes décident si on reste. La plus sûre quand quelqu'un parle face caméra : 2 ou 3 mots en très
grand, derrière la personne.

1. `derush-detourer plans/M1-x.mp4 --de 0.2 --a 2.8` : la personne seule, image par image, dans
   `remotion/public/detourage/…`. La réponse donne la ligne `<PersonneDevant …/>` exacte.
2. Trois calques, dans cet ordre :

```tsx
<Sequence from={0} durationInFrames={78}>
  <Video src={staticFile('plans/M1-x.mp4')} trimBefore={6} muted style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} />
  <TitreGeant texte={'RÉCEPTION\nPRESSE'} surTitre="AKATA · HÉRITAGES" duree={78} />
  <PersonneDevant dossier="detourage/m1-x-0.2-2.8" fps={30} premiere={6} derniere={84} debutSource={0.2} />
</Sequence>
```

`debutSource` est le temps de la vidéo d'origine à la première image de la Sequence (ici `trimBefore / fps`).
`PersonneDevant` reçoit le même `style` que la vidéo si tu la recadres ou la zoomes, sinon la personne ne tombe pas
sur elle-même. Ce qui doit rester devant le titre (une main, un objet, des étincelles) l'est déjà s'il est détouré avec
la personne ; sinon, détoure-le ou garde le titre plus haut (`y`).

## Les pièces

| Pièce | Pour quoi | Propriétés principales |
|---|---|---|
| `TitreGeant` | L'accroche : 2 ou 3 mots qui disent le sujet | `texte` (« \n » pour couper), `surTitre`, `y` (0,3), `accent` (couleur de la dernière ligne), `entree` (`impact` ou `monte`), `police` (Anton), `duree` |
| `PersonneDevant` | La personne détourée par-dessus un titre | `dossier`, `fps`, `premiere`, `derniere`, `debutSource`, `style` (donnés par `derush-detourer`) |
| `SousTitres` | Les sous-titres mot à mot | `mots` ({t, debut, fin} en secondes de la vidéo, `sous-titres/mots.json`), `decalage`, `y` (0,69), `taille` (0,046), `accent`, `plaque` (sur un fond clair), `contour`, `majuscules`, `maxMots` (4) |
| `Etiquette` | Le nom qu'on prononce | `texte` (« SERVICE PRESSE · AKATA » : après « · », en couleur), `x`, `y`, `taille` (0,034, jamais sous 0,028) |
| `CarteListe` | Une collection, une liste, un lieu, qui se remplit quand on nomme ses éléments | `titre`, `surTitre`, `elements` (textes, ou {texte, a} avec `a` en secondes depuis le début de la pièce), `y` |
| `Barreaux` | « incarcéré », « enfermé » : des barreaux tombent, l'image s'assombrit | `nombre`, `epaisseur`, `chute` (durée de la chute, en images), `decalage`, `assombrir`, `traverses` ; le choc au sol : le premier barreau à `chute` images, le dernier à `Math.round((nombre - 1) / 2 * decalage) + chute` |
| `VieuxPapier` | « vintage », un souvenir : sépia, grain, bords sombres | entoure l'image : `<VieuxPapier><Img …/></VieuxPapier>` ; `force`, `entree`, `grain`, `vignette` |
| `CasesQuiSeDessinent` | « le découpage », « les cases » : des cadres de BD se tracent | `cases` ([x, y, l, h] en parts de l'image) ou `grille` ({lignes, colonnes}) dans `zone` ; `couleur`, `trace`, `decalage` |
| `BoutonAbonnement` | « abonnez-vous » : un curseur clique, le bouton devient « ABONNÉ », la cloche sonne | `texte`, `fait`, `accent`, `y` (0,62), `clic` (image du clic : pose un vrai clic dessus) |
| `CartonDeFin` | La fin : titre, auteur, éditeur, sur la vidéo qui continue, floutée | `titre`, `auteur`, `editeur`, `detail`, `image` (la couverture, dans public/) ; le fond en enfant : `<CartonDeFin …><Video …/></CartonDeFin>` |

Outils partagés (`commun.ts`) : `usePolices()` (attendre les polices avant de mesurer), `largeurTexte()`,
`tailleQuiTient()` (la plus grande taille qui tient dans une largeur), `lignesDe()`, `arrive()` (ressort), `glisse`
(courbe), `progres()`, `sortie()`, `ACCENT`, `ZONE_SURE` (ce que TikTok, Reels et Shorts couvrent).

## Les règles qu'elles suivent déjà

- Un texte se lit sur un téléphone : 2,8 % de la hauteur de l'image au moins, une accroche 7 % ou plus.
- Rien ne déborde : chaque texte prend la plus grande taille qui tient dans sa largeur, mesurée après le chargement des
  polices. Un sous-titre trop long passe sur deux lignes équilibrées plutôt que de rapetisser à l'excès.
- De vraies espaces entre les mots, même avec un contour : `derush-controle` ne doit trouver aucun mot collé.
- Tout se calcule depuis le numéro d'image : le rendu donne toujours la même chose.
- Les bruits qui vont avec (une page, un choc métallique, un clic) se posent sur l'image exacte du geste : les pièces ne
  jouent aucun son.
