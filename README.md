<p align="center"><img src="docs/images/banniere.jpg" alt="Dérush par IABAI — Tu donnes la matière. Ton IA fait le montage." width="100%"></p>

# Dérush par IABAI

**Tu donnes la matière. Ton IA fait le montage.**

Dérush est un logiciel de montage vidéo qui travaille avec ton IA : **Claude**, **Codex** ou **Gemini**, avec ton propre compte. Tu déposes tes vidéos (ou tu enregistres ta voix, ta webcam), tu écris ce que tu veux, et ton IA monte : les plans, les titres, les effets, le son, les sous-titres. Ensuite, tu règles chaque détail d'un mot.

> **Bêta test — version 11.0.** Dérush vient de sortir : tout n'est pas encore parfait. Dis-nous ce qui coince dans l'onglet [Issues](../../issues), c'est le but de la bêta. Il a été essayé sur Mac ; Windows et Linux sont prévus, mais pas encore essayés pour de vrai.

<p align="center"><img src=".github/medias/trailer-derush-apercu.gif" alt="Le trailer de Dérush en aperçu : tu donnes la matière, ton IA fait le montage, tu vois tout se poser dans la timeline" width="100%"></p>

<p align="center"><sub>Un aperçu du trailer de lancement. <a href=".github/medias/trailer-derush.mp4?raw=true"><b>Télécharger le film entier</b></a> (MP4, avec le son). Il a été monté dans Dérush, par une IA, à partir d'un brief et de captures du logiciel.</sub></p>

---

## Installer Dérush

<p align="center"><img src="docs/images/installer-en-3-etapes.png" alt="Installer Dérush en trois étapes : aie ton IA, colle le message, ouvre Dérush" width="100%"></p>

### 1. D'abord, ton IA

Tu n'installes pas Dérush toi-même : **ton IA l'installe pour toi**, et c'est elle qui montera tes vidéos. Il te faut donc Claude ou Codex **sur ton ordinateur** (le site web ne suffit pas : il ne peut rien installer), et l'abonnement qui va avec.

<p align="center"><img src="docs/images/ton-ia-bureau-ou-terminal.png" alt="Ton IA : l'app de bureau ou le terminal, les deux marchent" width="100%"></p>

| | L'app de bureau (le plus simple) | Le terminal (si tu préfères) | Le compte qu'il faut |
|---|---|---|---|
| <img src="public/logos/claude.svg" width="18"> **Claude** | [Télécharge Claude](https://claude.com/download), ouvre l'onglet **Code** | [Installe Claude Code](https://code.claude.com/docs/en/setup), puis tape `claude` | Claude Pro ou Max |
| <img src="public/logos/openai.svg" width="18"> **Codex** | [L'app Codex](https://developers.openai.com/codex/app) (Mac, Windows) | [Installe Codex](https://developers.openai.com/codex/cli), puis tape `codex` | ChatGPT Plus, Pro ou Business |

Une seule suffit. Ouvre-la, connecte-toi, vérifie qu'elle te répond. (Gemini marche aussi : il se branche plus tard, dans Dérush.)

### 2. Colle ce message à ton IA

Copie tout le bloc (le bouton est en haut à droite du bloc), colle-le dans ton IA, envoie.

```text
Installe Dérush sur cet ordinateur. C'est un logiciel de montage vidéo qui travaille avec une IA
(bêta test, par IABAI). Son dépôt : https://github.com/toyrek/derush

1. Il faut Git et Node.js 20.12 ou plus (git --version, node --version). S'il en manque un,
   installe-le avec l'outil de ce système (Homebrew sur Mac, winget sur Windows, le gestionnaire
   de paquets sur Linux).
2. Clone le dépôt dans un dossier « Derush » de mon dossier personnel. S'il existe déjà, mets-le
   à jour (node derush.mjs mettre-a-jour).
3. Lis INSTALLER.md, à la racine du dépôt, et suis-le pas à pas. Lance d'abord
   « node derush.mjs installer --bilan » : il décrit cette machine et conseille la formule
   d'installation qui lui va. Suis ce conseil.
4. À la fin, montre-moi le bilan, et dis-moi en trois lignes comment ouvrir Dérush et brancher
   mon IA dans « Connexions ».

Règles : ne lance aucune commande en administrateur (sudo) sans me la montrer d'abord. Ne me
demande ni mot de passe ni clé dans cette conversation. Ne modifie pas le code de Dérush.
```

Ton IA regarde ta machine, choisit la bonne formule, installe ce qui manque (FFmpeg, les moteurs, les compétences) et pose l'icône de Dérush sur ton Bureau. Compte 5 à 15 minutes. Elle te montre toute commande sensible avant de la lancer.

### 3. Ouvre Dérush

Double-clique sur **Dérush**. Un petit tutoriel animé te montre les gestes. Puis ouvre **Connexions** (la prise, en haut à droite) : ton IA y est déjà, branche le reste si tu veux.

> Sur Mac, à la première ouverture, le système peut dire qu'il ne peut pas vérifier le développeur : *Réglages Système → Confidentialité et sécurité → Ouvrir quand même*, une seule fois.

<details>
<summary><b>Installer à la main, sans IA</b></summary>

Il te faut **Git** et **Node.js 20.12 ou plus** (https://nodejs.org). Puis, dans un terminal :

```bash
git clone https://github.com/toyrek/derush.git Derush
```

```bash
cd Derush
```

```bash
node derush.mjs installer --bilan
```

Le bilan décrit ta machine et conseille la formule. Lance-la (le plus souvent) :

```bash
node derush.mjs installer
```

Options : `--leger` (sans Whisper, 2 Go de moins), `--blender` (ajoute Blender pour la 3D réaliste), `--earshot` (ajoute Earshot, l'oreille de l'IA : 2,5 Go). L'installateur ne lance jamais de commande administrateur : s'il en faut une, il te l'écrit. Le détail, système par système, est dans [INSTALLER.md](INSTALLER.md).

</details>

---

## Comment ça marche

<p align="center"><img src="docs/images/comment-ca-marche.png" alt="Comment ça marche : dépose, coupe ou pas, demande, règle" width="100%"></p>

<p align="center"><img src="docs/images/capture-montage.jpg" alt="Dérush : les médias, l'aperçu avec ses sous-titres, la timeline avec la voix off" width="100%"></p>

## Cinq façons de créer

<p align="center"><img src="docs/images/cinq-facons-de-creer.png" alt="Cinq façons de créer : Montage, Motion design, Extraits courts, Voix off, Sur un son" width="100%"></p>

Tu choisis à la création du projet, et tu peux changer ensuite.

## Ta voix, ta webcam

Sous *Importer*, le bouton **Enregistrer**. **Ma voix** : tu racontes pendant que ton montage défile, ta voix se pose en vert sur tes images, son texte s'écrit tout seul, et un clic sur *Sous-titres* les affiche. **Me filmer** : ta webcam et ton micro, pour un podcast ou un face caméra, directement dans ton projet.

| Une prise de voix off | Me filmer |
|---|---|
| <img src="docs/images/capture-voix-off.jpg" alt="Le panneau de voix off pendant une prise" width="100%"> | <img src="docs/images/capture-me-filmer.jpg" alt="La fenêtre Me filmer, avec la webcam" width="100%"> |

## Demande, puis règle

Tu écris comme à un monteur. Ton IA monte, et tout ce qu'elle pose (plans, titres, effets, sons) apparaît en blocs dans la timeline, en direct. Clique un bloc : « Plus tôt », « Plus gros », « Moins fort », « Retirer », ou tes propres mots. Seul ce bloc est retouché.

<p align="center"><img src="docs/images/capture-demander.jpg" alt="La demande à l'IA, écrite dans la colonne de droite" width="100%"></p>

Le bouton palette, à côté du trombone, propose **199 styles**, en deux collections, et 99 de plus à télécharger. *Styles vidéo* : 99 recettes pour habiller tes rushes (face caméra, explications racontées, promos, pubs produit, logos et affiches, effets, méthodes de montage). *Tableaux en mouvement* : 100 styles pour une image peinte, dessinée ou animée sans aucun rush (peinture de grotte, Van Gogh, estampe japonaise, fusain, risographie, un seul trait…) : ton IA écrit une page qui se dessine, et Dérush la rend image par image, sans Internet. *Films en 99 styles* : un film entier dans une manière précise (infos sous-titrées, aquarelle, tableau blanc, ombres chinoises, plan d'ingénieur, jeu de rôle 16 bits, néons, plan de métro…). Cette collection vient de Lemo-Opuscar ; sa licence te laisse t'en servir pour tes propres films mais pas la redonner, alors Dérush ne la livre pas : il la télécharge chez toi quand tu cliques (1,4 Mo, chaque fichier vérifié). Un clic, et elle suit la fiche avec tes mots et ta marque. Pendant qu'elle travaille, tu peux lui écrire et lui joindre des fichiers : ils lui arrivent tout de suite, ou *Après ce travail* si tu préfères. Dans *Mes espaces*, ton **kit média** (logos, charte, polices, fonds, logos de tes partenaires, chacun décrit) et ta **bibliothèque d'animations** (les cartons et transitions qu'elle a déjà faits pour toi) lui sont donnés à chaque montage.

**Le Mode Hollywood** (à choisir avant chaque demande : *Classique* ou *Hollywood*) : Gemini, la seule IA qui voit ET entend une vidéo, devient le réalisateur de l'équipe, avec la même grille d'analyse et les mêmes compétences que ton IA de montage. Il dérushe chaque rush en entier, propose le découpage, répond aux questions de ton IA sur un passage, contrôle la vidéo avant qu'elle parte, puis te dit ce qui coince. Ton IA reste le monteur. Par ton compte Google (la commande Gemini connectée, sans clé), ou par ta clé Google AI Studio, en secours. Et **ChatGPT devient le graphiste** : quand le montage a besoin d'une image qui n'existe pas dans tes rushes (un autocollant, une illustration, un fond, un personnage qui bouge en sprites ou en GIF), ton IA la lui demande, avec ton forfait ChatGPT. *Équipe* choisit le modèle de chaque IA ; si l'une n'a plus de quota, les deux autres continuent sans toi.

**Plusieurs comptes ChatGPT et Claude** (Connexions, « Un autre compte ») : chacun avec son quota. Quand celui qui travaille est à bout, Dérush te propose de continuer avec un autre, et c'est toi qui choisis, jamais lui. Le crédit API de Claude, lui, te dit environ ce qu'il te reste, d'après le crédit que tu as noté.

**Exporter**, en haut à droite, comme dans CapCut : ta timeline ou la vidéo de ton IA, en 1080p, 2K ou 4K quand tes rushes le permettent, avec une copie par réseau si tu veux.

## Suis ton montage depuis ton téléphone

Un montage au niveau Maximum dure souvent une heure. Lance-le, pars faire autre chose, et garde un œil dessus : clique sur le téléphone, en haut de l'éditeur, puis sur **Allumer**. Scanne le code avec l'appareil photo de ton téléphone, compare le nombre affiché des deux côtés, clique **Relier ce téléphone** sur l'ordinateur.

<p align="center"><img src="docs/images/capture-telephone.jpg" alt="La fenêtre « Suivre sur mon téléphone » avec son code à scanner, et deux téléphones : le rendu en direct, puis « C'est prêt »" width="100%"></p>

Sur ton téléphone, tu vois ton IA travailler : les images qu'elle fabrique ou regarde, où elle en est (préparation, montage, rendu, contrôle), le temps passé, ses derniers gestes. Quand la vidéo est prête, la page l'annonce en grand : tu la regardes, tu lis la réponse de ton IA, et **Enregistrer sur mon téléphone** la garde chez toi, prête à poster.

- **Par ton Wi-Fi, sans Internet.** Ton téléphone et ton ordinateur doivent être sur le même réseau. Rien ne passe par un serveur à nous.
- **Regarder d'abord.** Au départ, le téléphone regarde seulement. Si tu veux lui écrire ou l'arrêter de là-bas, allume **Écrire à l'IA depuis le téléphone** dans la même fenêtre.
- **Un Wi-Fi que tu connais.** La liaison n'est pas chiffrée (comme toute adresse d'un réseau local) : garde-la pour chez toi ou pour l'association, pas pour un Wi-Fi public. **Couper** referme tout, et un téléphone se retire d'un clic.

## Tes médias, analysés

À l'import, Dérush regarde et écoute chaque rush : image sombre, plate ou brûlée, dominante de couleur, tourné en **Log**, bruit de fond, voix étouffée, écho. Des pastilles le disent sur les vignettes ; la fiche du média (menu « … ») détaille tout. **Analyser** fait regarder tes rushes par ton IA, sans les poser dans la timeline : ce qu'ils contiennent, leurs meilleurs moments, leurs défauts. Ton IA de montage s'en sert, et voit tous tes médias, même ceux que tu n'as pas posés.

Sélectionne-en plusieurs au lasso (ou ⌘A, ⌘-clic, Maj-clic) et glisse le groupe dans la timeline, d'un geste.

| La sélection et les pastilles | La fiche d'un média : un rush Sony en S-Log3, converti |
|---|---|
| <img src="docs/images/capture-medias-analyse.jpg" alt="Les médias avec leurs pastilles (Log, bruit de fond, voix claire) et la barre de sélection" width="100%"> | <img src="docs/images/capture-fiche-media.jpg" alt="La fiche d'un média : mesures, couleurs de la caméra avec l'avant / après" width="100%"> |

## Le son et les couleurs

**Voix claire** : un clic retire le souffle et le bruit de fond, rend une voix étouffée plus nette, réduit l'écho de la pièce, et la met au bon volume, sans jamais la décaler des lèvres. **Couleurs** : chaque plan a ses curseurs (exposition, contraste, saturation, température, teinte), un bouton *Auto*, et *Sur tous les plans* ; ce que tu vois est ce qui sort dans la vidéo. Les rushes filmés en **Log** (Sony, Panasonic, Canon, Fujifilm, Nikon, ARRI, Apple, DJI) sont convertis en couleurs normales, ou avec le LUT officiel de ta caméra. Ton IA fait pareil sur sa vidéo : elle nettoie les voix, mixe (la musique se baisse sous la voix) et étalonne chaque plan.

**La musique** : ton IA lit n'importe quel morceau (son tempo, chaque temps, chaque mesure, ses moments forts) pour couper dessus, et le met à la durée de ta vidéo comme le ferait un monteur son : le début du morceau, un milieu raccourci par mesures entières, puis sa vraie fin sur la dernière image. Quand aucun morceau ne convient, elle peut en écrire un, en partition, joué sur ton ordinateur et calé sur les moments de ta vidéo, ou poser une musique de fond dans un des 13 styles : sans Internet, sans compte, sans crédit. Les instruments de cette musique-là sont calculés, pas enregistrés, et ça s'entend : un vrai morceau sonne toujours mieux, et ton IA te dit quand elle a écrit la musique elle-même.

**Le ralenti et l'agrandisseur** : ton IA ralentit un geste jusqu'à 8 fois sans saccades (le *Ralenti fluide* invente les images qui manquent ; un rush filmé à 120 ou 240 images par seconde n'a rien à inventer), et agrandit une image ou une vidéo trop petite jusqu'à la 4K en inventant les détails (l'*Agrandisseur*, en mode « dessin » ou « photo » ; pour une vidéo, elle te dit d'abord le temps que ça prendra). Deux outils à installer d'un clic dans Connexions, sur Mac.

<p align="center"><img src="docs/images/capture-couleurs.jpg" alt="Les couleurs d'un plan, réglées dans l'inspecteur, et l'aperçu qui suit" width="100%"></p>

**Ta disposition** : tire les bords des panneaux pour agrandir les médias, l'IA ou la timeline ; double-clic pour revenir. **Pendant que ton IA travaille**, tu peux lui écrire (Claude lit ton message au geste suivant) et continuer ton montage.

---

## Brancher (une fois)

<p align="center"><img src="docs/images/capture-connexions.jpg" alt="Connexions : Claude, Codex, Gemini, ElevenLabs, les sons" width="100%"></p>

Ouvre Dérush, puis **Connexions** (la prise, en haut à droite). Chaque carte se branche en un clic.

| | Connexion | À quoi ça sert | Comment |
|---|---|---|---|
| <img src="public/logos/claude.svg" width="22"> | **Claude** | L'IA qui monte | *Installer*, puis *Me connecter* : ton compte Claude (Pro ou Max) |
| <img src="public/logos/openai.svg" width="22"> | **Codex** | L'IA qui monte | *Installer*, puis *Me connecter* : ton compte ChatGPT (Plus, Pro ou Business) |
| <img src="public/logos/googlegemini.svg" width="22"> | **Gemini** | L'IA qui monte | *Installer* (la commande `agy` d'Antigravity), puis *Me connecter* : une fenêtre de terminal s'ouvre, tu te connectes avec ton compte Google |
| <img src="public/logos/elevenlabs.svg" width="22"> | **ElevenLabs** | Musiques, voix off, bruitages, doublage, images, plans vidéo | *Brancher* : tu autorises Dérush dans ton navigateur |
| <img src="public/logos/openverse.svg" width="22"> | **Bibliothèque de sons** | De vrais bruitages libres de droits (Openverse), rangés dans `Musique › Sons` avec leurs crédits | Un interrupteur |
| 🔊 | **Real SFX** | Poser ces sons à l'image près, sous ta voix et ta musique | *Ajouter* (9 Mo) |
| 👂 | **Earshot** | L'oreille de l'IA : écouter, choisir, fabriquer un son (facultatif) | *Ajouter* (2,5 Go) |
| ⏱️ | **Ralenti fluide** | Des ralentis sans saccades, jusqu'à 8 fois plus lents (RIFE) ; sans lui, l'IA ralentit avec FFmpeg, moins finement | *Installer* (18 Mo, sur Mac) |
| 🔍 | **Agrandisseur** | Agrandir une image ou une vidéo trop petite, jusqu'à la 4K, en inventant les détails (Real-ESRGAN) | *Installer* (43 Mo, sur Mac) |
| <img src="public/logos/googledrive.svg" width="22"> | **Google Drive** | Donner tes fichiers du Drive à l'IA, y envoyer tes vidéos | Un interrupteur (il faut Google Drive pour ordinateur) |
| <img src="public/logos/treg.svg" width="22" style="background:#000"> | **Treg** (conseillé) | Publier sur les réseaux, lire tes chiffres et tes commentaires, dresser ton profil de créateur | *Relier mes réseaux* : trois gestes, Dérush te guide et te montre quels réseaux sont reliés |
| <img src="public/logos/blender.svg" width="22"> | **Blender** | La 3D réaliste (facultatif) | *Installer* |

Une seule IA suffit, mais tu peux en brancher plusieurs et passer de l'une à l'autre à tout moment (le nom de l'IA, en haut de la conversation). Trois niveaux de qualité : **Rapide**, **Soigné**, **Maximum**.

Tes comptes restent les tiens : Dérush ne voit jamais tes mots de passe. Les clés (ElevenLabs, Treg) sont rangées dans le dossier de Dérush sur ton ordinateur, jamais dans tes projets ni sur GitHub. L'IA ne reçoit que les connexions que tu lui donnes ici.

---

## Monter, en détail

Deux réglages au-dessus de la timeline :

- **Le format** : `9:16`, `16:9`, `1:1`, `4:5`, ou **Auto** (le format de ta première vidéo). Tu peux mélanger des vidéos de formats différents : chacune est recadrée pour remplir l'image, en suivant les visages. Tu peux aussi demander à l'IA plusieurs formats d'un coup (« fais-en aussi une version 16:9 »).
- **Les sous-titres** : aucun tant que tu ne les demandes pas. Un clic sur *Sous-titres* les met sur tout le film ; leur style se règle dans *Habiller*.

**De vrais sons.** Allume *Bibliothèque de sons* dans Connexions : pour ses bruitages (whoosh, impacts, clics, pops…), l'IA prend de vrais enregistrements libres de droits au lieu de sons de synthèse. Elle en cherche d'autres sur [Openverse](https://openverse.org) quand il en manque, ne garde que ceux qu'on a le droit de poser sur une vidéo commerciale, et te donne sous sa réponse les **crédits à coller** dans ta description quand une licence le demande.

Le manuel complet (tous les gestes, les effets, le studio ElevenLabs, les vrais sons) est dans [docs/MANUEL.md](docs/MANUEL.md).


**Les modes.** À la création d'un projet, choisis *Montage*, *Motion design*, *Extraits courts*, *Voix off* ou *Sur un son*. Tu peux en changer ensuite (menu « … » › *Brief et format*).

**Régler ce que l'IA a posé.** Sous sa vidéo, la timeline montre ses blocs : plans (gris), titres et textes (jaune), effets (violet), sons (vert). Clique un bloc : « Plus tôt », « Plus tard », « Plus gros », « Moins fort », « Retirer », ou tes propres mots. Les réglages partent avec ton prochain message.

**Ton profil de créateur.** Bouton *Mon profil* sur l'écran des projets (ou menu « … »). Il faut Treg relié, et Claude ou Codex. L'analyse prend 5 à 10 minutes, en lecture seule ; tu peux couper « Donner mon profil à mon IA », refaire l'analyse ou tout effacer.

---

## Analyser, puis partager

Sous chaque vidéo livrée (et à la fin de « Créer la vidéo »), deux boutons ouvrent l'écran **Avant de publier**.

**Analyser.** Dérush mesure la vidéo finie (format, durée, niveau du son, coupes, première parole, débit, blancs), puis ton IA lit ce qui est dit, regarde les images, relit ses repères datés sur TikTok, Instagram et YouTube, et cherche ce qui marche en ce moment sur ton sujet. Tu obtiens une note sur 100, une note par réseau, huit points regardés (accroche, histoire, rythme, son, textes à l'écran, format, fin, originalité) avec la preuve de chaque constat, et trois choses à faire en premier. Un clic sur *Demander* met la correction dans ton message à l'IA. C'est une estimation pour améliorer la vidéo : personne ne peut promettre des vues.

**Partager.** Choisis tes réseaux : l'IA écrit pour chacun la légende, les hashtags, le bon moment, l'image de couverture (tu la changes parmi plusieurs images, celle du lecteur, ou la tienne), et une stratégie pour faire circuler la vidéo. Un 👍, un 👎 ou un mot sur chaque conseil de l'analyse : ton IA s'en souvient. *Copier le rapport* le garde, *Pour une autre IA* en fait un plan de travail à coller ailleurs. Tu relis, tu corriges, tu copies, ou tu publies d'un clic avec [Treg](https://treg.to). Tu peux aussi l'écrire dans la conversation (« publie-la sur TikTok et YouTube »), ou publier tout de suite sans plan (menu ⋯ de la vidéo).

| Réseau | Ce qui se passe |
|---|---|
| **TikTok** | La vidéo arrive en **brouillon** dans ta boîte TikTok ; tu colles la légende (bouton *Copier*) et tu publies depuis l'app. C'est une limite de TikTok pour l'instant. |
| **YouTube Shorts** | Mise en ligne **non répertoriée** par défaut ; *Publique* ou *Privée* si tu le choisis. YouTube a besoin de ta **clé API Treg** (créée dans ton tableau de bord Treg) dans Dérush (Connexions › Treg › *Relier mes réseaux*) : le connecteur Treg d'un compte Claude ne lui suffit pas. |
| **Instagram Reels** | Publiée sur ton compte professionnel. Instagram doit aller chercher la vidéo sur une adresse web : elle passe par un lien public temporaire (une heure). L'IA te le dit. |
| **LinkedIn** | Publiée sur ton profil. |

**Rien ne part sans toi** : l'IA ne publie que si tu cliques *Publier* ou si tu l'écris dans ton message. Chaque publication apparaît sous la vidéo, avec son lien.

---

## Mettre à jour

**Dérush te prévient.** Quand une nouvelle version sort, une petite fenêtre l'annonce dans Dérush, avec ce qui change. *Mettre à jour* l'installe et Dérush redémarre ; *Plus tard* remet l'annonce au lendemain. Ton IA te le dit aussi, une fois, à la fin de sa réponse.

<p align="center"><img src="docs/images/capture-mise-a-jour.jpg" alt="Dérush annonce une nouvelle version : ce qui change, Mettre à jour, Plus tard" width="100%"></p>

Tu peux aussi le faire à la main : **Connexions → Version → Vérifier**, puis *Mettre à jour*. Ou, dans le dossier de Dérush :

```bash
node derush.mjs mettre-a-jour
```

- Tes projets, tes moteurs et tes clés ne sont pas touchés (ils sont rangés ailleurs, voir plus bas).
- Dérush regarde seulement ce dépôt, au lancement puis toutes les six heures : rien n'est envoyé. Pour ne plus être prévenu, éteins l'interrupteur de **Connexions → Version**.
- Une copie de Dérush reçue en zip ou en image disque est prévenue aussi, mais ne se met pas à jour toute seule : recolle le message d'installation à ton IA.

---

## Questions fréquentes

**Est-ce que mes vidéos sont envoyées quelque part ?** Dérush tourne sur ton ordinateur et n'a aucun serveur à lui : il n'envoie tes fichiers nulle part. Ton IA, elle, travaille avec ton compte : pour monter, elle regarde des images de tes vidéos et lit leur texte, comme quand tu lui montres un fichier. Les services que tu branches toi-même (ElevenLabs pour le son, Treg pour publier) reçoivent ce que tu leur envoies.

**Qu'est-ce qu'il me faut ?** Un ordinateur (8 Go de mémoire au moins, 16 Go pour être à l'aise), et un abonnement à Claude (Pro ou Max) ou à ChatGPT (Plus, Pro ou Business) : c'est ton IA qui travaille, avec ton compte. ElevenLabs et Treg sont facultatifs.

**J'ai seulement Claude ou ChatGPT sur le web. Ça suffit ?** Non : il faut l'app de bureau ou la version terminal. C'est elle qui peut agir sur ton ordinateur, pour installer Dérush puis pour monter.

**Mac, Windows, Linux ?** Dérush est écrit pour les trois, mais il n'a été essayé pour de vrai que sur Mac (puce Apple). Sur Windows et Linux, attends-toi à des accrocs, et dis-les-nous.

**Quelque chose ne marche pas.** Ouvre une [issue](../../issues) : dis ce que tu as fait, ce que tu attendais, ce qui s'est passé. Tu peux aussi le demander à ton IA, dans le dossier de Dérush : elle sait lire son journal.

**Comment désinstaller ?** Supprime le dossier `Derush`, le dossier des moteurs (voir « Où sont rangées les choses ») et l'icône. Tes projets restent : c'est toi qui décides.

---

## Les compétences

Dérush livre **150 compétences** que l'IA lit avant de travailler, et en télécharge 15 de plus (Remotion, Real SFX, le guide d'Earshot) à l'installation ou depuis Connexions, plus les 99 styles de Lemo-Opuscar si tu les demandes :

- **Montage** : FFmpeg (42 outils), étalonnage, mixage du son, sous-titres et traduction, contrôle qualité, motion design, miniatures, images, 3D avec Blender, passage vers Premiere Pro ou DaVinci Resolve ;
- **Le savoir-faire d'un monteur** : 34 compétences trouvées sur skills.sh et GitHub, relues avec leur licence — l'ordre et le rythme des coupes, une prise propre, les extraits courts, les plans de coupe, monter « comme cette vidéo », les titres animés, les principes du mouvement (LottieFiles), les bruitages, la musique, le documentaire, la bande-annonce, l'explication animée ;
- **Tableaux en mouvement** : `tableaux-en-mouvement` (100 styles d'art, de dessin et de mouvement, un moteur de peinture et ses 53 scènes d'exemple, la méthode, et la commande `derush-toile` qui rend une page image par image) et `motionmaxxing` (diriger un motion design comme un directeur artistique, et ce qu'on ne livre jamais) ;
- **Diriger un film, et sa musique** : `huashu-motion` (lire le sujet, comparer trois directions, écrire le rythme avant de construire, reprendre un film « juste mais plat », 20 langages de mouvement, 16 mondes musicaux à écrire en partition), avec la commande `derush-musique` (les temps d'un morceau, un morceau ajusté à la durée du film, une partition ou un style joués sur l'ordinateur) ;
- **Une série animée** : `derush-serie-animee` garde le même personnage d'un plan à l'autre et d'un épisode à l'autre, avec les images et les plans vidéo d'ElevenLabs ;
- **Son et voix** : les sept compétences ElevenLabs (voix off, bruitages, musique, doublage, transcription…) ;
- **Vrais sons** : `sons-openverse` (chercher des sons libres et noter leurs crédits), Real SFX (les poser à l'image près), Earshot (écouter et fabriquer un son) ;
- **Réseaux** : accroches, scripts TikTok / Reels / Shorts, légendes, hashtags, tendances, carrousels, stratégie, croissance ;
- **Instagram et YouTube, de bout en bout** : 24 compétences de Jake Schincariol (`ig-…`, `yt-…`) — accroches notées sur des formules éprouvées, minutage d'un script, légende vérifiée, titre et miniature jugés ensemble, audit d'un compte par écart à sa médiane ;
- **Publication et créateur** : `derush-viralite` (analyser une vidéo avant de la publier, avec des repères datés et sourcés), `derush-publier` (TikTok, YouTube, Instagram, LinkedIn avec Treg) et `derush-createur` (dresser ton profil de créateur à partir de tes comptes, en lecture seule).

Elles sont dans [competences/](competences/), avec leurs sources et leurs licences ([competences/LICENCES.md](competences/LICENCES.md)).

Tu peux en ajouter d'autres : *Connexions › Compétences › Ajouter une compétence*, avec un lien GitHub ou skills.sh. Dérush la télécharge chez toi, te montre sa licence et ce qu'elle contient de risqué, et ton IA la lit avec prudence.

---

## Où sont rangées les choses

| | macOS | Windows | Linux |
|---|---|---|---|
| Tes projets | `~/Movies/Dérush` | `Vidéos\Dérush` | `~/Videos/Dérush` |
| Tes sons | `~/Music/Sons` | `Musique\Sons` | `~/Music/Sons` |
| Moteurs, clés, réglages | `~/Library/Application Support/Dérush` | `%APPDATA%\Dérush` | `~/.local/share/derush` |
| Le programme | le dossier que tu as cloné | idem | idem |

Rien d'autre n'est installé ailleurs, sauf ce que tu acceptes (FFmpeg, Blender, Claude Code, Codex).

---

## Ce qu'il faut savoir sur cette bêta

- **Windows et Linux** : Dérush a été écrit pour les trois systèmes, mais il n'a été essayé pour de vrai que sur Mac (puce Apple). Sur Windows et Linux, attends-toi à des accrocs : dis-les-nous. La vraie application (sans navigateur) n'existe que sur Mac pour l'instant ; ailleurs, Dérush s'ouvre dans une fenêtre de Chrome, Edge ou Brave.
- **Sur Mac, la première ouverture** : l'app n'est pas encore signée auprès d'Apple. Si macOS dit qu'il ne peut pas vérifier le développeur : *Réglages Système → Confidentialité et sécurité → Ouvrir quand même*, une seule fois.
- **L'analyse de viralité** est une estimation faite par ton IA à partir de mesures et de repères publics : elle aide à améliorer une vidéo, elle ne prédit pas ses vues. Elle utilise ton abonnement Claude ou ChatGPT (une à trois minutes par analyse).
- **Le suivi sur téléphone** a été essayé avec un téléphone simulé sur le même ordinateur, pas encore avec un vrai iPhone ni un vrai téléphone Android. Sur Windows, le pare-feu demande d'autoriser Node.js la première fois, et le réseau doit être réglé sur « Réseau privé » ; si l'ordinateur s'endort, le téléphone ne le voit plus (sur Mac, Dérush le garde éveillé tant que le téléphone regarde).
- **Sur Mac seulement** : le recadrage qui suit les visages et le titre « derrière la personne » (ils utilisent Apple Vision).
- **Codex** travaille dans un bac à sable : il écrit dans le dossier du projet, et Dérush fait les rendus pour lui. Claude, lui, travaille directement.
- **La publication** dépend de Treg et de tes comptes : TikTok en brouillon seulement, YouTube limité à quelques envois par jour, Instagram par un lien public temporaire. Elle n'a pas encore été essayée en vrai sur tous les réseaux.
- **Les vrais sons** viennent d'Openverse (Freesound, Wikimedia Commons…). Dérush ne garde que les licences qui permettent une vidéo commerciale (domaine public et CC BY) et note chaque crédit, mais Openverse relaie la licence indiquée par la source sans la garantir : pour une publicité ou un client important, ouvre la page du son avant de publier. 200 recherches par jour au plus. Real SFX et Earshot n'ont été essayés que sur Mac.
- **Remotion**, le moteur de rendu, est gratuit pour les particuliers et les structures de trois personnes au plus ; au-delà, il faut une licence (https://remotion.dev/license).
- **ElevenLabs et Treg** sont des services en ligne : ce que l'IA crée ou publie avec eux utilise tes crédits et tes comptes.

---

## Pour aller plus loin

- [Le manuel](docs/MANUEL.md) : tous les gestes, les effets, le studio ElevenLabs, les vrais sons.
- [Ce qui est nouveau](docs/NOUVEAUTES.md), version après version.
- [Le guide d'installation](INSTALLER.md), celui que ton IA suit.
- [Les repères du dépôt](AGENTS.md), pour qui veut modifier Dérush.

## Soutenir l'association

Dérush est gratuit et libre. Il est fait avec l'association **YABAÏ**, à Persan (Val-d'Oise), qui accompagne des jeunes des quartiers populaires par la création, l'entrepreneuriat et les échanges entre la France et le Japon : ce sont ces jeunes qui l'ont imaginé, pour monter leurs propres vidéos.

Chez YABAÏ, le voyage au Japon ne s'offre pas : il se construit. Chaque groupe monte ses projets, vend, organise des événements, va convaincre des partenaires, et finance lui-même son départ. La première génération a réuni 43 000 € et s'est envolée pour Tokyo en avril 2025. La deuxième a réuni 60 000 € en un an (un photobooth conçu, codé et fabriqué par eux, le YABAÏ Dōjō à la tour Eiffel, 48 heures de live pour Brick Matsuri) : treize jours d'Osaka à Tokyo, en octobre 2026. Le prochain départ : Tottori, en février 2027.

Si Dérush t'aide, tu peux les aider à ton tour : le cœur, en haut de Dérush, ouvre la page de l'association (son histoire, ses photos, le projet en cours, un don du montant que tu veux). Ou directement : [les projets de YABAÏ sur HelloAsso](https://www.helloasso.com/associations/yabai) · [YABAÏ sur Revolut Donations](https://revolut.com/app/donations/549cad02-8123-4062-bda1-f84543750d7d) (depuis un téléphone) · [yabai.fr](https://www.yabai.fr) · contact@yabai.fr.

## Licences

Dérush est un logiciel libre, sous licence **GPL-3.0** : © 2026 IABAI (association YABAÏ), voir [LICENCE.md](LICENCE.md) et [LICENSE](LICENSE). Les composants d'autres auteurs gardent leurs licences : [NOTICES.md](NOTICES.md).
