# Dérush 10 — le manuel

> **À lire d'abord.** Dans ce manuel, « Claude » désigne l'IA qui monte : **Claude** (compte Claude), **Codex** (compte ChatGPT) ou **Gemini** (compte Google), selon ton choix dans **Connexions**. L'installation, les connexions, la publication et les mises à jour sont dans le [README](../README.md) et dans [INSTALLER.md](../INSTALLER.md). Ce manuel décrit l'écran et les gestes ; les chemins cités (`~/Movies`, `~/Library/…`) sont ceux du Mac, et leurs équivalents sur Windows et Linux sont dans le README.

Dérush est un logiciel de montage fait pour travailler avec une IA. Tu fais ce qui est simple et qui t'appartient : donner tes vidéos, garder les bons passages si tu veux, dire ce que tu attends. Claude fait le reste : le montage, les effets, le motion design, la 3D, le son, et il te rend une ou plusieurs vidéos dans Dérush.

Trois gestes :

1. **Dépose** tes vidéos, tes sons, tes photos. Même sans rien trier. Ou **enregistre** ta voix, ta webcam, sans quitter Dérush.
2. **Coupe, ou pas.** Comme dans CapCut : tu glisses, tu coupes, tu supprimes. Ou tu ne touches à rien, et Claude choisit les passages.
3. **Demande.** Tu parles à Claude comme à un monteur, et tu lui joins ce qui l'aide : références, vidéos, charte graphique, logo, polices, zip. Il répond, ou il monte une ou plusieurs vidéos. Tu regardes son rendu **en direct**, dans le lecteur et sur la timeline.

Ton montage est un **squelette**, pas une contrainte : tu marques ce qui est essentiel, Claude garde l'intention et améliore le reste.

## Ouvrir Dérush

- **Double-clic sur « Dérush »** : sur le Bureau (Mac, Windows, Linux) ou dans le menu des applications.
- **Sur Mac, c'est une vraie application** : son icône reste dans le Dock, elle a ses menus (Fichier, Édition, Présentation, Aide), et tu peux poser des vidéos sur son icône pour les importer. Quand tu la fermes pendant un travail (un rendu, ton IA qui monte), elle te propose de **laisser finir** : la fenêtre se ferme et Dérush se quitte tout seul à la fin ; un clic sur son icône la rouvre.
- **Sur Windows et Linux**, Dérush s'ouvre dans une fenêtre de Chrome, Edge ou Brave, et s'arrête tout seul quelques secondes après sa fermeture (après la fin d'un travail en cours). Un nouveau double-clic ouvre une fenêtre neuve : l'ancienne enregistre tout, puis se ferme d'elle-même.
- **Le tutoriel.** À la première ouverture, six petites scènes animées montrent les gestes : déposer, demander à l'IA, retoucher, habiller, analyser, partager. Tu le revois quand tu veux : le « ? » de la bibliothèque, la fenêtre des raccourcis, ou le menu Aide.
- **En ligne de commande :** `node derush.mjs` ouvre la bibliothèque, et `node derush.mjs <dossier>` ouvre directement un projet.

## L'écran

- **En haut à droite**, la prise ouvre **Connexions** (ton IA, ElevenLabs, Google Drive, Treg, Blender, mises à jour), et l'engrenage les **Réglages** (les moteurs de l'ordinateur).
- **Au-dessus de la timeline**, le bouton **Sous-titres** les met ou les enlève sur tout le film (aucun sous-titre tant que tu ne le demandes pas), et les boutons **9:16 · 16:9 · 1:1 · 4:5 · Auto** choisissent le format de la vidéo. « Auto » prend le format de ta première vidéo ; des vidéos de formats différents se mélangent dans le même montage, chacune recadrée pour remplir l'image.
- **À gauche**, cinq onglets :
  - **Médias** : tes vidéos, tes sons et tes photos en vignettes, le bouton **Importer** et le bouton **Enregistrer** (ta voix ou ta webcam) ;
  - **Texte** : le texte du montage (pour couper en effaçant des mots) ou d'un média (pour choisir des phrases) ;
  - **Habiller** : le style de tout le film en un clic, ou des effets à poser un par un ;
  - **Créer** : musiques, voix off, dialogues, bruitages, voix nettoyées, doublages, images et vidéos, avec ElevenLabs ;
  - **Consignes** : le brief, des cases à créer et des notes.
- **Au milieu**, le lecteur. Il montre ton montage **au format exact de la vidéo finale**. Quand Claude travaille ou a livré, trois boutons : « Mon montage », « En direct » (son rendu, image par image) et « Vidéo de Claude ». S'il a livré plusieurs vidéos, les numéros 1, 2, 3… passent de l'une à l'autre.
- **À droite**, la conversation avec Claude : tes messages et tes pièces jointes, ses réponses, ses vidéos. Quand tu sélectionnes un plan ou un effet, ses réglages prennent la place ; la croix ou `Échap` ramène Claude.
- **En bas**, la timeline et ses outils : couper, ciseaux, supprimer, case IA, note IA, effets, zoom. Sous le montage, la **piste de Claude** : son rendu s'y pose en direct, puis sa vidéo s'y affiche en images. Un clic la lit à cet endroit.
- **En haut à droite**, le bouton « Demander à Claude ».

## Tous les formats, même très lourds

- **Glisse tes fichiers depuis le Finder**, n'importe où dans la fenêtre. Dérush les retrouve sur le disque et les lit **sur place, sans copie**, même s'ils pèsent des dizaines de Go ou sont sur un disque externe. S'il ne les trouve pas, il les copie dans le projet.
- **Lâchés sur la timeline**, ils se posent directement à cet endroit.
- **Vidéos** : MP4, MOV, MKV, AVI, MXF, MTS, HEVC des iPhone, ProRes, GoPro, DJI, Insta360, drones…
- **Sons** : MP3, WAV, M4A, AIFF, FLAC…
- **Photos** : JPEG, PNG, HEIC, TIFF, WebP… Une photo se pose pour 3 s ; tire son bord pour changer sa durée.
- Les formats **RAW de caméra de cinéma** (RED, Blackmagic RAW, ARRI) ne se lisent pas : exporte d'abord une version ProRes ou H.264.

Pour chaque média, Dérush prépare tout seul une version légère pour la lecture, la forme du son, des vignettes, les coupes de caméra, les silences, le volume, le texte mot à mot (avec Whisper) et le **recadrage qui suit les visages**.

## Enregistrer : ta voix, ta webcam

Sous **Importer**, le bouton **Enregistrer** ouvre deux choix. Tout se passe sur ton ordinateur : rien n'est envoyé.

**Ma voix (voix off).** Un petit panneau se pose au-dessus de la timeline.

1. Place la tête de lecture là où ta voix doit commencer.
2. Choisis ton micro. La barre bouge quand tu parles ; si son contour devient rouge, tu es trop fort : éloigne-toi un peu.
3. Clique **Enregistrer** : ton montage défile, tu racontes ce que tu vois. Son son est coupé pendant la prise, pour que le micro ne l'enregistre pas ; avec un casque, décoche cette case pour l'entendre.
4. Clique **Arrêter** : ta voix se pose en vert sur la piste *Par-dessus*, là où tu as commencé. On y voit la forme de son son.
5. Ce que tu as dit s'écrit tout seul, en quelques secondes (avec Whisper, sur ton ordinateur, s'il est installé : voir *Réglages*). Un clic sur **Sous-titres**, au-dessus de la timeline, et ils s'affichent sur l'aperçu.

Ensuite, c'est un clip comme un autre : tu le glisses, tu le raccourcis par ses bords, tu le supprimes. Pour le couper, clique-le, place la tête de lecture dedans et clique **Couper** (ou `S`) ; ou prends les **Ciseaux** et clique à l'endroit voulu. Tu enlèves ainsi une hésitation, tu déplaces une phrase : c'est ton montage audio. Tu refais une prise autant de fois que tu veux. Dans sa fiche (un clic dessus), tu règles son volume, et la case « C'est ma voix off » dit à ton IA que cette voix est le fil du film. Si ton projet n'a pas encore de montage, la voix va seulement dans tes médias.

**Me filmer (podcast, face caméra).** Une fenêtre montre ta webcam (en miroir, comme un selfie ; la vidéo enregistrée, elle, est à l'endroit). Choisis la caméra et le micro, clique **Enregistrer**, puis **Arrêter**. La vidéo arrive dans tes médias et, si la case est cochée, à la suite de ton montage.

**Ce que ton IA sait en faire.** Demande-lui, par exemple : « Nettoie ma voix et enlève les blancs », « Mets des sous-titres mot à mot », « Remonte les images sur ce que je raconte », « Ajoute une musique douce sous ma voix ». En mode *Voix off*, elle sait d'avance que ta voix passe avant tout. Tu peux aussi le faire toi-même : dans la fiche du son, *Isoler la voix* ; dans l'onglet *Créer*, les outils d'ElevenLabs.

**La première fois**, ton système demande si Dérush peut utiliser le micro (et la caméra) : réponds oui. Si tu as refusé, sur Mac : *Réglages Système › Confidentialité et sécurité › Micro* (ou *Caméra*), coche Dérush, puis rouvre Dérush.

Les fichiers sont rangés dans le dossier `enregistrements` de ton projet (`voix-off-<date>.m4a`, `camera-<date>.mp4`). Si Dérush se ferme en pleine prise, ce qui a été enregistré y reste, dans un fichier dont le nom contient `brut` : importe-le comme n'importe quel fichier.

## Choisir sa façon de créer (les modes)

À la création d'un projet, cinq cartes :

| Mode | Ce que tu donnes | Ce que fait ton IA |
|---|---|---|
| **Montage** | Tes vidéos, tes sons, tes photos | Elle choisit les passages, monte, habille |
| **Motion design** | Rien : une description (et ton logo, ta charte si tu en as) | Elle cherche sur le web, écrit un plan, anime tout dans Remotion, pose le son |
| **Extraits courts** | Une longue vidéo, un podcast | Elle trouve les meilleurs moments et fait un clip de chacun |
| **Voix off** | Tes images, et ta voix (enregistrée dans Dérush ou importée) | Elle garde ta voix comme fil du film, la nettoie et la sous-titre si tu le demandes, et remonte les images dessus |
| **Sur un son** | Une musique, une voix | Elle crée les images qui vont avec |

Le mode se change ensuite dans *Brief et format* (menu « … » de la conversation). Il est redit à l'IA à chaque message.

## Demander à Claude

La colonne de droite est une vraie conversation. Clique « Demander à Claude », ou clique dans le vide.

1. **Écris ce que tu veux**, comme à un monteur. Des idées toutes faites sont proposées : un clic les recopie, tu les adaptes. Un long brief se colle tel quel (jusqu'à 24 000 caractères) ; plus long, mets-le dans un fichier et joins-le.
2. **Joins ce qui l'aide** : le trombone (fenêtre « Ouvrir » du Mac), le nuage (directement dans ton Google Drive), ou glisse les fichiers sur la colonne de Claude, ou colle-les (`⌘V`, une capture d'écran par exemple).
   - Tout se joint : vidéos de référence, rushes en plus, charte graphique (PDF, images, zip), logo, polices, musiques, scripts, modèles 3D, fichiers Photoshop ou Illustrator…
   - Chaque pièce jointe a un **rôle** (Référence, Charte graphique, Logo, Police, Musique ou son, Rush à monter, Texte ou script) : Dérush le devine, tu peux le changer d'un clic.
   - Les fichiers restent à leur place sur ton Mac, même très lourds. Dérush prépare pour Claude un aperçu, une planche d'images pour une vidéo, le texte de ce qui est dit, et ouvre les zip.
3. Choisis **qui monte** et le **niveau de soin** : clique le nom de ton IA, en haut de la colonne (« Qui monte ta vidéo ? »). Dérush retient ton choix.
   - **Rapide**, **Soigné** ou **Maximum** : plus l'IA réfléchit, plus c'est soigné, et plus c'est long.
   - Avec Claude, tu peux aussi choisir le **modèle** : *Auto* (Opus 5.5, ou Sonnet 5.5 au niveau Rapide), **Opus 5.5** (le plus soigné), **Fable 5.2** (le plus récent) ou **Sonnet 5.5** (le plus rapide).
4. Envoie (`⌘↵`). Tu suis Claude geste par geste dans la conversation. Dès qu'il rend, **le lecteur passe « En direct »** : ses images arrivent au fur et à mesure, et se posent aussi sur la piste de Claude, sous ton montage. Tu peux **continuer à travailler** ou l'**arrêter** (le bouton rouge).
5. **Ses vidéos arrivent dans le lecteur**, avec son message et leurs contrôles (format, durée, niveau du son, couleurs). Elles sont rangées dans le dossier `vidéos` du projet. Une vidéo de Claude peut aussi aller **dans tes médias** (l'icône de flèche sur sa carte), pour la retoucher dans Dérush, ou **sur ton Google Drive** (l'icône de nuage) : elle est copiée dans Mon Drive › Dérush › le titre du projet.
6. **Continue la conversation** : « plus court », « un autre titre », « fais-en aussi une version carrée », ou une simple question. Claude se souvient de tout, et chaque version reste disponible.

**Une question, pas une vidéo.** Demande un avis, une idée, une explication : Claude répond, sans fabriquer de vidéo.

**D'autres fichiers avec la vidéo.** Demande une image fixe, un storyboard, un master de haute qualité, la liste des polices et des sons : ton IA les remet avec la vidéo. Sous la carte de la vidéo, une ligne « fichiers joints » les compte ; « Ouvrir » montre leur dossier (ils sont rangés dans `vidéos`, à côté de la vidéo).

**Plusieurs vidéos d'un coup.** « Fais 3 clips de 20 secondes », « une version TikTok et une version YouTube », « la même en anglais » : Claude les monte et les livre toutes. Elles apparaissent ensemble dans sa réponse.

Ce que Claude reçoit, en plus de ta demande :
- tes plans, coupés à l'image près, et le texte mot à mot ;
- **tout ce que tu lui as joint** dans la conversation (« Claude a reçu », en haut du fil, le liste ; tu peux y changer un rôle ou retirer un fichier) ;
- **tes créations ElevenLabs** prêtes (onglet Créer) ;
- **ton Google Drive** : il peut y chercher un fichier, lire un Google Doc, Sheet ou Slides (un brief, un script, un planning), copier une vidéo ou une image, et y déposer ses vidéos si tu le lui demandes. Il ne modifie, ne déplace, ne partage et ne supprime rien ;
- **les compétences de création de contenu** (voir plus bas) : accroches, scripts TikTok et Reels, légendes, tendances…
- le **brief** (onglet Consignes) : l'histoire, le public, le ton, la durée visée ;
- les **notes IA** posées sur la timeline (touche `N`) et les **cases à créer** (touche `B`) ;
- le style et les effets déjà posés dans Dérush.

**Sans rien couper.** Dépose tes vidéos et écris ta demande : Claude regarde et lit tous tes rushes, garde les meilleurs passages, les met dans l'ordre et monte la vidéo.

**Avec seulement du son.** Dépose un son (une chanson, un podcast), garde le passage que tu veux dans la timeline ou laisse tout, et demande un clip : Claude crée l'image.

**Si tu changes ton montage après une vidéo**, Dérush le voit. Tu choisis alors entre « Continuer avec Claude » (il continue sur son travail) et « Repartir de mon montage » (il reprend tes nouvelles coupes, en gardant ce que tu avais demandé et tout ce que tu lui as joint).

Bon à savoir :
- Claude travaille avec **ton abonnement Claude**. Un montage complet avec Opus 5.5 en réflexion max compte beaucoup plus qu'une retouche avec Sonnet.
- Compte quelques minutes pour une retouche, bien plus pour un film entier avec de la 3D.
- Claude ne reçoit que le dossier du montage, tes pièces jointes, ses outils vidéo et **ton Google Drive**. Tes autres connecteurs (mails, agenda, Notion, Canva…) ne lui sont jamais donnés : s'il en voit un au démarrage, Dérush l'arrête aussitôt et le relance sans lui. Pour lui retirer aussi le Drive : Réglages → « Ton Google Drive, pour Claude ».
- **Pour la 3D, il n'a pas besoin de connecteur** : il lance lui-même les programmes du Mac. Si **Blender** est installé, Dérush le trouve, lui dit où il est et comment s'en servir sans fenêtre (personnages, décors, objets, titres en relief). Sans Blender, il fait la 3D avec Three.js, déjà dans le moteur de rendu. Demande-lui simplement « une intro en 3D avec Blender ».
- **Le son vient d'ElevenLabs** quand ton compte est branché : musique, chaque bruitage, ambiances, voix off. Il peut aussi générer des images et des plans vidéo (voir « ElevenLabs », plus bas).
- Si tu fermes la fenêtre pendant qu'il travaille, il finit quand même. Tu retrouves les vidéos en rouvrant le projet.

### Autres façons de finir

En bas de la colonne de Claude, « Autres façons de finir » :
- **Créer avec ElevenLabs** : l'onglet Créer, pour faire toi-même musiques, voix, bruitages, images et vidéos.
- **Créer la vidéo sans IA** : Dérush fabrique seul le MP4, avec ton style et tes effets.
- **Pack pour une autre IA** : le même dossier de montage, à donner à l'IA de ton choix.
- **Brief et format**, **Dossier de travail de Claude** (le projet qu'il a écrit), **Effacer la conversation** (les vidéos et les fichiers joints restent).

## Régler ce que l'IA a posé (la table de montage)

Pendant qu'elle travaille, ton IA tient à jour la liste de ce qu'elle pose sur la vidéo : chaque plan gardé, chaque titre, chaque effet, chaque son. Dérush montre cette liste en blocs de couleur dans la timeline, sous sa vidéo, **en direct**.

- **Clique un bloc** : la vidéo se place à cet endroit, et la colonne de droite montre ce qu'est ce bloc. Deux blocs de la même sorte qui se chevauchent (un titre et sa date, par exemple) sont rangés sur deux lignes : aucun ne cache l'autre.
- **Règle-le** d'un geste (« Plus tôt », « Plus tard », « Plus court », « Plus long », « Plus gros », « Moins fort », « Retirer »), change le texte d'un titre, ou écris ce que tu veux avec tes mots.
- Les réglages s'ajoutent en haut de la zone d'écriture. Ils partent avec ton prochain message (ou d'un clic sur « Envoyer les réglages ») : l'IA ne touche qu'aux blocs que tu as réglés.

Ces blocs décrivent le travail de l'IA ; ils ne remplacent pas ta timeline à toi. Pour reprendre sa découpe dans ta timeline, le bouton « Mettre sa découpe dans ma timeline » reste là.

## Mon profil de créateur

Bouton **Mon profil** sur l'écran des projets, ou menu « … » de la conversation.

Ton IA lit tes comptes avec Treg, **en lecture seule** : tes vidéos publiées, leurs vues, leurs partages, tes miniatures, tes commentaires. Elle classe ce qui a vraiment marché (par écart à ta vidéo médiane, pas par vues brutes), décrit ton style et ta direction artistique, et en tire des consignes de montage et de titres.

- Il faut **Treg relié** et **Claude ou Codex** (Gemini n'a pas les outils Treg). Compte 5 à 10 minutes.
- Le profil est rangé dans le dossier de Dérush, sur ton ordinateur. Un seul profil, pour tous tes projets.
- Tant que « Donner mon profil à mon IA » est allumé, elle le relit avant chaque montage, chaque analyse de viralité et chaque plan de partage.
- « Refaire l'analyse » (une fois par mois suffit) et « Effacer mon profil » sont dans la colonne de gauche.

## Google Drive

Dérush donne à Claude **ton Google Drive, et lui seul** :
- **le connecteur Google Drive de ton compte Claude** (celui de l'app Claude) : Claude y cherche un fichier par son nom ou son contenu, et lit les Google Docs, Sheets et Slides. Les outils qui partagent, modifient ou mettent à la corbeille lui sont interdits ;
- **le dossier Google Drive du Mac** (l'app « Google Drive » pour ordinateur) : Claude y prend directement les gros fichiers (vidéos, sons, images), et y dépose ses vidéos quand tu le lui demandes, dans Mon Drive › Dérush › le titre du projet.

Dans Dérush :
- le **nuage** à côté du trombone ouvre ta fenêtre « Ouvrir » directement dans ton Drive, pour joindre un fichier à ton message ;
- le **nuage** sur une vidéo de Claude, ou sur une création de l'onglet Créer, la copie sur ton Drive ;
- **Réglages** → « Ton Google Drive, pour Claude » : décoche « donné » pour que Claude ne le voie plus.

Bon à savoir : ce qui est copié dans le dossier Drive du Mac ne part en ligne que si l'app **Google Drive** est ouverte (son icône est dans la barre des menus).

## Les compétences de création de contenu

58 compétences gratuites (licence MIT), trouvées sur GitHub, sont installées pour Claude, dans Dérush comme dans tes autres sessions Claude. Elles disent comment TikTok, Reels et Shorts classent les vidéos aujourd'hui, et ce qui marche dans les premières secondes. Claude ouvre lui-même celle qu'il lui faut.

| Pour | Compétences |
|---|---|
| Les accroches | viral-hooks, hook-writer |
| TikTok | tiktok-script, viral-tiktok-content, tiktok-growth, tiktok-photo-mode |
| Reels et Instagram | reels-script, viral-instagram-reels, instagram-growth, instagram-seo, story-writer, carousel-writer |
| YouTube Shorts | youtube-shorts, viral-youtube-shorts |
| Le format court en général | short-form-video-script, viral-short-form, scripting-and-storyboarding |
| Les idées | viral-short-form-ideas, idea-generation-and-ideation |
| Légendes, hashtags, appels à l'action | caption-writer, viral-captions-and-ctas, hashtag-strategy, social-seo |
| Tendances et mèmes | trend-jacking, meme-and-culture, seasonal-and-moment-marketing, viral-reverse-engineering |
| Le montage, les sous-titres | capcut, captions-and-clipping, thumbnail-design, platform-specs-and-validation |
| Les formats | storytelling-and-narrative, talking-head-and-piece-to-camera, behind-the-scenes-and-founder, before-after-and-transformation, educational-content-and-how-to, quote-cards-and-text-graphics, podcast-and-audiograms, livestream-and-realtime |
| Décliner une vidéo | cross-platform-repurposing, content-recycling |
| Voix et musique (avec ElevenLabs) | ai-voiceover, ai-music-and-sound |
| La stratégie | brand-profile, voice-builder, audience-research, social-strategy, content-pillars, content-calendar, batch-content-plan, campaign-and-launch-planning |
| La communauté | community-management, reply-and-comment-writer, collabs-and-cross-promotion, ugc-and-influencer, profile-optimization, analytics-and-reporting, competitor-analysis |

- Elles viennent de deux dépôts : **vyralcontent/content-skills** (7) et **social-media-skills/skills** (51). Chacune a été lue avant d'être installée : pas de code, pas d'appel réseau. Le passage qui demandait à Claude de faire la publicité d'un outil payant (Vyral) a été retiré.
- Claude ne publie et ne programme jamais rien, et ne te recommande pas les outils payants qu'elles citent (WoopSocial, HeyGen, Opus Clip…) : il a déjà le kit Remotion, FFmpeg, Blender et ElevenLabs.
- Pas retenues : celles qui publient à ta place, qui demandent un compte payant (HeyGen, Runway, Kling…), qui téléchargent des vidéos TikTok, ou qui visent d'autres réseaux (LinkedIn, X, Pinterest).
- Elles sont rangées dans `~/.claude/skills`, chacune avec un fichier `SOURCE.md` qui dit d'où elle vient.

## Couper, comme dans CapCut

1. **Poser dans la timeline.** Glisse la vignette dans la timeline (en bas pour le montage, sur la piste « Par-dessus » pour un plan de coupe), ou clique son **+**.
   Un clic sur la vignette l'ouvre en **aperçu**. Glisse alors sous l'image pour ne garder qu'un passage, puis « Ajouter ce passage ».
2. **Couper.** Place la tête de lecture, puis clique **Couper** ou appuie sur `S` (ou `⌘B`). Clique le morceau en trop et appuie sur `⌫` : la suite se recolle toute seule.
   - `Q` enlève le début du plan jusqu'à la tête de lecture, `W` la fin.
   - **Ciseaux** (`C`) : chaque clic sur un plan le coupe à cet endroit ; `V` ou `Échap` pour revenir.
   - Les bords d'un plan se tirent pour le raccourcir ; **l'aimant** les colle à la tête de lecture et aux autres bords (`⌘` pour s'en passer).
   - Un plan se glisse pour changer l'ordre. ⇧ ou ⌘ + clic en sélectionne plusieurs ; `⌘C`, `⌘X`, `⌘V`, `⌘D`, `⌘A` comme partout.
   - **Couper par le texte** : onglet **Texte**, « Texte du montage ». Glisse sur des mots puis `⌫` : ils sortent du montage.
   - **En un clic :** « Enlever les blancs » et « Enlever les « euh » », dans tout le montage.
   - **Pour un podcast**, « Texte d'un média » sert à choisir des phrases : glisse dessus, puis « Ajouter au montage ».
3. **Guider Claude.**
   - **★ Essentiel** (sur un plan) : Claude doit garder ce passage. Sans étoile, il peut le resserrer.
   - L'onglet **Consignes** pose d'un clic une case à créer (scène, **scène 3D Blender**, image générée, carte, titre…) ou une note (texte à l'écran, zoom, musique…), à la tête de lecture. Écris la consigne à droite.
   - **Des fichiers pour Claude** : glisse des images d'ambiance, un logo, un modèle 3D (`.blend`, `.glb`…), une police ou un PDF dans l'onglet Consignes, ou directement sur une case de la timeline.

Tout est enregistré tout de suite, et `⌘Z` annule. La touche `?` montre tous les raccourcis.

## Habiller : le style et les effets

**Un style en un clic** (onglet Habiller, « Style du film »). Il règle d'un coup les sous-titres, l'effet posé sur chaque coupe, le grain et les bords sombres. Six styles sont fournis : Simple, Trend, Voyage, Podcast, Cinéma et YABAÏ. Tout se règle ensuite au même endroit : sous-titres, couleur, police, effet sur chaque coupe, réseau visé.

**Des effets à poser** (onglet Habiller, « Effets à poser »). Un clic pose l'effet à la tête de lecture ; tu peux aussi le glisser dans la timeline. Il se règle à droite.

| Famille | Effets |
|---|---|
| Transitions | Coup de zoom, Plongée, Fouet, Glitch, Flash, Fondu au noir. Elles se calent toutes seules sur la coupe la plus proche. |
| Titres | Titre, **Titre derrière la personne**, Lieu (pastille avec une épingle), Carton de fin (sur un fond qui reste vivant). |
| Mouvements | Zoom lent, Secousse. |
| Bruitages | Souffle qui monte, Passage d'air, Fouet, Coup sourd, Déclic, Pop, Parasites. Les transitions et les titres ont déjà leur son. |

- **Titre derrière la personne** : Dérush détoure la personne tout seul, sur le Mac (Apple Vision).
- Un effet **suit son plan** : si tu raccourcis ou déplaces ce qui est avant, il reste au bon endroit.
- Si un plan a déjà des sous-titres dans l'image, coche « Ce plan a déjà des sous-titres » dans ses infos.

Ce que tu poses ici, Claude le reçoit et le garde, sauf si tu lui demandes autre chose.

## Tes vidéos sont utilisables tout de suite

Dès que tu déposes une vidéo, elle a une image (en moins d'une seconde), puis ses vignettes et sa courbe de son (une à deux secondes, même en 4K). Tu peux la regarder et la poser dans la timeline sans attendre : sa préparation complète (une copie légère pour se déplacer à l'image près, l'analyse, le recadrage) continue derrière, et un petit cercle tourne sur sa vignette tant qu'elle n'est pas finie. Plusieurs vidéos déposées ensemble apparaissent ensemble.

## Avant de publier : analyser et partager

Sous chaque vidéo de l'IA, et à la fin de « Créer la vidéo », les boutons **Analyser** et **Partager** ouvrent le même écran, avec la vidéo à gauche et ce que Dérush a mesuré dessus (format, durée, première parole, débit, blancs, coupes, niveau du son).

**L'analyse.** Ton IA regarde la vidéo finie : elle lit ce qui est dit, regarde les trois premières secondes, l'ensemble et la fin, relit ses repères datés sur TikTok, Instagram et YouTube, et cherche ce qui marche en ce moment sur ton sujet. Tu obtiens :
- une **note sur 100** (calculée par Dérush à partir des huit notes, toujours de la même façon) et une note par réseau ;
- **à faire en premier** : trois changements au plus, classés par effet ;
- **les huit points regardés** : accroche, histoire, rythme, son, textes à l'écran, format, fin, originalité, chacun avec ce qui est constaté (et sa preuve) et quoi changer ;
- **ce qui marche en ce moment**, seulement quand l'IA a trouvé une source datée ;
- **ce que l'analyse ne sait pas** (elle ne peut pas écouter le grain d'une voix, ne connaît ni ton compte ni ton public).

Chaque bouton *Demander* met la correction dans ton message à l'IA : tu relis, tu envoies, elle refait. Puis *Refaire l'analyse* pour voir la différence. C'est une estimation pour améliorer la vidéo, pas une promesse de vues.

**Le partage.** Choisis tes réseaux (TikTok, Instagram Reels, YouTube Shorts, LinkedIn) et, si tu veux, un mot pour l'IA. Elle écrit la stratégie (l'angle, l'ordre des réseaux, le rythme, quoi faire dans l'heure qui suit) et, pour chaque réseau : la légende, les hashtags, le bon moment, l'image de couverture, un premier commentaire. Tout se corrige sur place (c'est enregistré tout seul) et se copie d'un clic. *Publier* envoie tes textes relus, tels quels, avec Treg ; si tes réseaux ne sont pas reliés, tu peux tout copier et publier toi-même.

**Relier ses réseaux.** Connexions → Treg → *Relier mes réseaux* : crée ton compte Treg, relie tes réseaux dans Treg, puis copie ta clé et clique sur *Coller ma clé*. Dérush vérifie la clé auprès de Treg et te montre quels réseaux sont reliés. Avec Claude, le connecteur Treg de ton compte Claude suffit pour TikTok, Instagram et LinkedIn. **YouTube a besoin de la clé** : c'est Dérush lui-même qui envoie la vidéo (commande `derush-youtube`), parce que les outils donnés à une IA ne voient pas l'adresse d'envoi que YouTube rend.

## Créer la vidéo sans IA

« Autres façons de finir » → « Créer la vidéo sans IA » fabrique le MP4 final sur ton Mac : le montage, les effets, les titres, les sous-titres et les bruitages.
- Le son est réglé au niveau des réseaux (−14 LUFS).
- À la fin, Dérush affiche la vidéo et ses **contrôles** : format, durée, niveau du son, couleurs, textes hors des zones cachées.
- La vidéo est rangée dans le dossier `vidéos` du projet, avec une planche de contrôle.
- Sous les contrôles, « Et maintenant ? » propose de l'**analyser** et de la **partager** (voir plus haut).

## Le son

Pour chaque plan, dans le panneau de droite :
- **Garder ou couper** le son d'origine, et régler le **volume**.
- **Isoler la voix** avec Demucs, sur le Mac. Tu choisis ensuite « Original », « Voix seule » ou « Sans la voix ».
- **Débordements** : le son peut commencer avant l'image (J-cut) ou continuer après (L-cut).

Une voix off ou une musique posée *par-dessus* a les mêmes réglages (garder, volume, voix isolée), dans sa fiche.

## De vrais sons (bibliothèque, Real SFX, Earshot)

Par défaut, l'IA fabrique ses bruitages : sons de synthèse du kit, sons calculés, ou sons générés par ElevenLabs. Tu peux lui donner de **vrais enregistrements**, libres de droits. Tout se règle dans **Connexions**, partie « De vrais sons dans tes vidéos ».

- **Bibliothèque de sons** (un interrupteur) : un dossier `Sons` dans ta Musique, avec un dossier par type (`whoosh`, `impact`, `pop`, `click`…), un fichier `CREDITS.md` et un catalogue. Quand il manque un son, l'IA le cherche sur [Openverse](https://openverse.org), un moteur de recherche de contenus libres, sans compte ni clé. Elle ne garde que ce qu'on a le droit de poser sur une vidéo commerciale : le domaine public, et la licence CC BY (qui demande un crédit). Tu peux aussi y glisser tes propres sons. *Ouvrir* montre le dossier.
- **Real SFX** (*Ajouter*, 9 Mo) : il choisit les sons dans ta bibliothèque, les pose à l'image près sous ta voix et ta musique, mesure le résultat et corrige ses trois plus gros défauts. Sans lui, l'IA pose les sons elle-même.
- **Earshot** (*Ajouter*, facultatif, 2,5 Go) : l'IA n'entend pas. Earshot écoute pour elle, sur ton ordinateur : il décrit un son, classe plusieurs candidats, vérifie le niveau et la synchro d'une vidéo, et fabrique des sons en code. Rien ne part en ligne.

**Les crédits.** Quand une vidéo utilise un son sous licence CC BY, une ligne « Crédits des sons » apparaît sous la réponse de l'IA, avec un bouton pour les copier : colle-les dans la description de ta vidéo. Si l'IA publie pour toi, elle les ajoute à la légende.

**Dans la conversation**, tu peux le dire simplement : « mets de vrais bruitages », « trouve un bruit de foule », « écoute la vidéo et dis-moi si le son est trop fort », « fabrique un clic plus doux ».

À savoir : Openverse limite à 200 recherches par jour (Dérush compte pour toi) ; il relaie la licence indiquée par la source sans la garantir, alors pour une publicité importante, ouvre la page du son avant de publier ; les sons de Freesound arrivent en MP3.

## ElevenLabs : le studio du son (et des images)

Quand ton compte ElevenLabs est branché :

**Claude s'en sert pour tout le son** de ses vidéos, sauf si tu lui demandes autre chose : la musique (écrite pour la vidéo si besoin), un bruitage sur chaque accent, les ambiances, la voix off, les dialogues. Il peut aussi nettoyer une voix, doubler la vidéo dans une autre langue, caler des sous-titres sur une voix off, et générer des **images** (fonds, illustrations) et des **plans vidéo** (plans de coupe, intros).

**Tu peux tout créer toi-même**, dans l'onglet **Créer** :

| Création | Ce que tu donnes |
|---|---|
| Musique | Une description et une durée (5 s à 5 min), avec ou sans paroles. |
| Musique pour une vidéo | Une vidéo du projet : ElevenLabs la regarde et compose une musique qui suit ses coupes. |
| Voix off | Un texte et une voix (les voix françaises d'abord), avec ou sans émotions. |
| Dialogue | Plusieurs répliques, chacune avec sa voix. |
| Bruitage | Une description (0,5 à 30 s), éventuellement en boucle pour une ambiance. |
| Voix nettoyée | Une vidéo ou un son : le bruit, la musique et l'écho autour de la voix disparaissent. |
| Doublage | Une vidéo ou un son, et la langue voulue : les mêmes voix, traduites. |
| Image | Une description, un format, un modèle (Gemini, GPT Image, Seedream), une image de référence si tu veux. |
| Vidéo | Une description, un format, une durée, un modèle (Seedance, Veo), une image de départ si tu veux. |

- Chaque création apparaît dans « Tes créations » : un clic l'écoute ou la montre, la flèche la met **dans tes médias** (tu la glisses ensuite sur la timeline), la corbeille l'efface.
- **Claude reçoit tes créations prêtes** avec ton prochain message.
- **Les bruitages de Dérush en qualité ElevenLabs** : en bas de l'onglet Créer, « Refaire avec ElevenLabs » refait les 7 sons des transitions et des titres, calés au même endroit que ceux d'origine. Une seule fois, pour tous tes projets ; « Revenir aux sons d'origine » les annule.
- Les crédits qui te restent sont affichés en haut de l'onglet.

Dérush s'en sert aussi pour le **texte avec les locuteurs** : menu « … » d'un média, « ElevenLabs Scribe ».

**Brancher.** Réglages (l'engrenage) → « Musiques, bruitages et voix — ElevenLabs » → « Brancher » (ou le bouton de l'onglet Créer). Une page ElevenLabs s'ouvre dans ton navigateur : connecte-toi et clique « Autoriser ». L'outil d'ElevenLabs range alors la clé dans le dossier de Dérush (`~/Library/Application Support/Dérush/.env.local`). Elle n'est écrite nulle part ailleurs, et tu peux la révoquer depuis la page des clés API d'ElevenLabs.

Bon à savoir :
- Chaque création **consomme des crédits** de ton compte ElevenLabs ; une vidéo générée en consomme beaucoup plus qu'un son. Claude a pour consigne de ne générer qu'une fois, puis de réutiliser.
- Sans demande de ta part, Claude **ne clone jamais** la voix d'une personne filmée, et ne génère jamais le visage d'une personne réelle.
- Sans ElevenLabs, Claude se sert des bruitages fournis avec Dérush, ou fabrique les sons sur le Mac.

## Les retours de Claude

Quand Claude veut changer ta découpe, il l'écrit dans son dossier. Une pastille rouge apparaît sur l'icône de bulle, en haut. Pour chaque proposition, tu peux « Appliquer » ou « Ignorer » ; chaque changement appliqué s'annule avec `⌘Z`.

## Les moteurs (Réglages, l'icône engrenage)

| Moteur | Rôle | Où | Place |
|---|---|---|---|
| Claude Code | Monter la vidéo à ta demande | Sur le Mac, avec ton compte Claude | fourni avec l'app Claude |
| Whisper large-v3-turbo (MLX) | Texte mot à mot | Sur le Mac | 1,7 Go |
| Demucs (htdemucs) | Séparer la voix de la musique et du bruit | Sur le Mac | 450 Mo |
| Apple Vision | Repérer visages et sujets pour le recadrage | Intégré à macOS | — |
| Détourage (Apple Vision) | Détourer la personne, pour passer un titre derrière elle | Sur le Mac | 40 Mo |
| Rendu vidéo (Remotion) | Fabriquer la vidéo, avec les bibliothèques d'animation et de 3D | Sur le Mac | 600 Mo |
| Blender (option) | La 3D réaliste : Claude le lance sans fenêtre | Sur le Mac, s'il est installé (blender.org) | — |
| ElevenLabs (option) | Musiques, bruitages, voix off, doublage ; texte avec les locuteurs | En ligne, avec ton compte ElevenLabs | — |

Le moteur de rendu contient déjà ce qu'il faut à Claude pour animer : Three.js (3D), Anime.js, Scene.js, Konva, Zdog, Planck (physique), regl (shaders), Lottie, et les modules de Remotion (transitions, flou de mouvement, formes, tracés, bruit). Blender, s'il est installé, sert pour la 3D réaliste : les Réglages disent s'il est trouvé.
Remotion est gratuit pour une personne seule, une association ou une entreprise de trois personnes au plus ; au-delà, il lui faut une licence.

## Le dossier de montage (`exports/<titre>-pack-<date>/`)

C'est ce que Dérush prépare pour Claude, et ce que « Pack pour une autre IA » te donne.

| Fichier | Contenu |
|---|---|
| `LISEZMOI-IA.md` · `CLAUDE.md` | Le brief, la **recette** du genre de vidéo, l'esprit du squelette, le tableau du montage, l'habillage déjà posé, et ce qu'il faut vérifier avant de livrer. |
| `montage.json` | Tout en données exactes : secondes, numéro d'image, timecode. Pour chaque plan : essentiel ou non, le son, le recadrage, les mots dits, la présence d'un visage, les couleurs dominantes. `decoupe: "libre"` quand tu n'as rien coupé. |
| `plans/` | Chaque plan coupé à l'image près, avec des marges. Sans découpe : tes rushes entiers. |
| `references/` | Les fichiers donnés à Claude. |
| `vignettes/` · `storyboard/` | Les images de chaque plan, et des planches de 16 cases. |
| `sous-titres/` | `montage.srt`, `montage.vtt`, et `mots.json` pour le karaoké. |
| `transcriptions/` · `analyse/` | Pour chaque rush : texte, coupes, silences, volume et recadrage. |
| `remotion/` | Le **kit de rendu** : il fabrique déjà la vidéo de ton montage, avec le même moteur d'habillage que l'aperçu. |
| `remotion/recouper.mjs` | L'outil de découpe de l'IA : elle écrit la liste des passages choisis, il refait le montage et recale les sous-titres. |
| `OUTILS.md` | La boîte à outils : ce qui est déjà installé (animation, 3D), et quoi prendre pour le reste. |
| `MOTION.md` | Bien animer : le rythme, le texte, les transitions, la fin, le son, et ce qui trahit une vidéo faite par une machine. |
| `decoupes/` | La personne détourée image par image, quand un titre passe derrière elle. |
| `montage.otio` | Le montage au format OpenTimelineIO, lisible par DaVinci Resolve. |

## En ligne de commande

```bash
node derush.mjs ajouter <projet> rush1.mov podcast.mp3
node derush.mjs transcrire <projet> M1
node derush.mjs voix <projet> M1
node derush.mjs demander <projet> "Fais une vidéo de 30 secondes pour TikTok" --modele opus --effort max
node derush.mjs exporter <projet>
node derush.mjs rendre <projet> --reseau tiktok
node derush.mjs installer whisper
node derush.mjs construire-app
node derush.mjs construire-app --zip ~/Desktop
```

- `ajouter` importe des rushes et attend qu'ils soient prêts.
- `transcrire` lance Whisper sur un rush ; `voix` sépare la voix du reste.
- `demander` fait monter la vidéo par Claude, comme le bouton. `--modele opus|fable|sonnet`, `--effort max|high|medium`, `--nouveau` pour repartir du montage.
- `exporter` crée le dossier de montage ; `rendre` crée la vidéo sans IA.
- `installer whisper` (ou `voix`, `detourage`, `rendu`, `real-sfx`, `earshot`) installe un moteur.
- `construire-app` refait `Dérush.app` et l'alias du Bureau ; avec `--zip`, il fabrique le zip de l'app à partager.

## Limites connues

- Claude a besoin d'Internet et de ton abonnement Claude. Si la limite de l'abonnement est atteinte, il s'arrête et le dit dans la conversation.
- Pendant que ton IA travaille, Dérush empêche le Mac de s'endormir (l'écran peut s'éteindre). Un portable dont on ferme le capot s'endort quand même. Sous Windows et Linux, règle la mise en veille toi-même pour un long travail.
- **Enregistrer** (voix, webcam) : essayé sur Mac, dans l'app et dans Chrome. Sur Windows et Linux, il passe par la fenêtre de Chrome ou d'Edge, qui pose sa propre question pour le micro et la caméra : pas encore essayé sur ces systèmes. Pendant une prise, tu ne t'entends pas dans le casque. Dans l'aperçu, un seul son posé par-dessus s'entend à la fois ; la vidéo finale, elle, les a tous.
- Dans l'aperçu, les débordements de son (J-cut et L-cut) ne se chevauchent pas encore. Ils sont exacts dans la vidéo.
- L'aperçu peut être décalé d'une image. La vidéo, elle, est exacte, car chaque plan est recoupé depuis le rush d'origine.
- Dans l'aperçu, le flou des transitions est un flou simple ; la vidéo a un vrai flou de zoom ou de filé.
- Le détourage garde une seule personne, la plus grande dans l'image.
- Testé sur un Mac à puce Apple avec macOS 26. Whisper (MLX) exige une puce Apple.
- L'analyse de viralité s'appuie sur le texte dit : sans Whisper (Réglages), elle se fait sur les images et les mesures seulement.
- La vraie application (sans navigateur) n'existe que sur Mac ; elle demande macOS 13 ou plus.
- **Gemini** : essayé pour de vrai sur Mac avec la commande `agy` de Google (version 1.5.6, novembre 2026), en mode *Motion design* : au niveau *Rapide* (Gemini 3.8 Flash), une animation puis deux réglages de cette animation ; au niveau *Maximum* (Gemini 4 Argon), la même animation, plus soignée (compte une dizaine de minutes). Gemini travaille toujours dans le bac à sable de Google : il n'écrit que dans son dossier de travail (et dans ta bibliothèque de sons), il ne lit que ce dossier, les outils de Dérush et ce que tu lui as donné (pièces jointes, Google Drive s'il est allumé), et c'est Dérush qui fabrique les images de la vidéo à sa place. Les modèles sont ceux que ton compte Google propose : *Rapide* = Gemini 3.8 Flash ; *Soigné* et *Maximum* = Gemini 4 Argon, ou Gemini 4 Carbon si ton compte l'a (ce n'est pas le cas de tous). Avec Gemini, Dérush ne donne pas les outils Treg : seul YouTube peut être publié, et le profil de créateur se fait avec Claude ou Codex. Pas encore essayé avec Gemini : le niveau *Soigné*, un montage avec des rushes, ElevenLabs, les vrais sons, la publication sur YouTube, et Windows ou Linux (le bac à sable de Google demande Windows 11 24H2 ou plus récent ; sans lui, Gemini ne peut lancer aucune commande et Dérush te le dit). Le niveau *Rapide* de Gemini ajoute parfois des phrases que tu n'as pas demandées : relis la vidéo, et dis-lui de les retirer.
- Les blocs de la table de montage sont ce que l'IA déclare avoir posé : s'ils ne correspondent pas à la vidéo, dis-le-lui, elle les remettra à jour.
- Les sons tendance du plan de partage viennent d'une recherche sur le web, avec leur source et leur date : vérifie qu'ils sont encore dans l'app au moment de publier.
- YouTube : il faut ta clé Treg dans Dérush, et YouTube relié dans Treg avec le droit de publier. Compte environ six envois par jour pour tous les comptes reliés à Treg. YouTube peut garder en privé une vidéo envoyée par une application qu'il n'a pas encore auditée : Dérush te le dit après l'envoi. L'envoi a été vérifié contre un faux Treg (31 cas) ; il reste à le confirmer avec un vrai compte.
