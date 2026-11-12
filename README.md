<p align="center"><img src="public/marque/iabai.png" alt="IABAI" height="110"></p>

# Dérush par IABAI

**Tu donnes la matière. Ton IA fait le montage.** — bêta privée, version 9.3

Dérush est un logiciel de montage vidéo fait pour travailler avec une IA. Tu déposes tes vidéos, tu coupes si tu veux (comme dans CapCut), tu écris ce que tu attends. Ton IA — **Claude**, **Codex** ou **Gemini**, avec ton propre compte — monte la vidéo, ajoute les effets, le son, les sous-titres si tu les demandes, et peut la **publier** sur TikTok, YouTube Shorts, Instagram Reels et LinkedIn. Tu suis son travail en direct.

Dérush tourne sur **macOS, Windows et Linux**. Tes vidéos restent sur ton ordinateur.

**Nouveau dans la version 9.**
- **Quatre façons de créer** : *Montage* (tu déposes tes vidéos), *Motion design* (rien à déposer : tu décris, ton IA cherche, écrit et anime tout), *Extraits courts* (une longue vidéo devient plusieurs clips), *Sur un son* (une musique ou une voix devient une vidéo).
- **La table de montage se remplit en direct.** Tout ce que ton IA pose sur la vidéo (plans, titres, effets, sons) apparaît en blocs dans la timeline. Tu cliques un bloc, tu dis ce qui doit changer, et seul ce bloc est retouché.
- **Ton profil de créateur.** Avec Treg, ton IA lit tes vidéos déjà publiées et leurs chiffres (en lecture seule), repère ce qui a vraiment marché, ton style, ta direction artistique, ce que dit ton public. Elle relit ce profil avant chaque montage, chaque titre, chaque conseil.
- **Une mise en route** qui explique à quoi sert Treg et ce qui te protège ; **les sons tendance** proposés dans le plan de partage (à ajouter dans l'app, jamais dans le fichier).
- **Gemini** s'ajoute à Claude et Codex (avec la commande `agy` d'Antigravity et ton compte Google : Gemini 4 Argon, Gemini 3.8 Flash, et Carbon si ton compte le propose).
- 24 compétences de plus (Instagram et YouTube, de Jake Schincariol), et les vrais logos partout.

**9.1 — Gemini, essayé pour de vrai.** Le moteur Gemini a été réglé sur la vraie commande `agy` de Google (version 1.5.6). Gemini travaille toujours dans le bac à sable de Google, avec des permissions données pour chaque demande seulement : écrire dans son dossier de travail, lire les outils de Dérush et ce que tu lui as donné, rien d'autre de ton ordinateur. Ce bac à sable coupe le réseau local : le rendu des images passe par un relais en fichiers, et Dérush rend la vidéo pour lui. Les modèles sont ceux de ton compte Google : *Rapide* = Gemini 3.8 Flash, *Soigné* et *Maximum* = Gemini 4 Argon (ou Carbon s'il est proposé).

**9.2 — Gemini 4 Argon essayé, les blocs ne se cachent plus.** Gemini a été essayé aussi au niveau *Maximum* (Gemini 4 Argon) : la même animation, plus soignée et sans rien d'inventé. Dans la timeline, deux blocs de l'IA qui se chevauchent (un titre et sa date, un fond sous des transitions) se rangent maintenant sur plusieurs lignes : aucun ne cache l'autre, chacun se clique.

**9.3 — Le modèle de Claude, et les longs briefs.** Dans « Qui monte ta vidéo ? » (et dans Connexions), tu choisis maintenant le modèle de Claude : *Auto* (Opus 5.5, ou Sonnet 5.5 au niveau Rapide), Opus 5.5, **Fable 5.2** ou Sonnet 5.5. Un long brief collé dans la zone d'écriture part en entier (jusqu'à 24 000 caractères) : avant, Dérush le coupait à 8 000 sans prévenir. Au-delà, il le dit et propose de joindre le texte en fichier.

**Nouveau dans la version 8.** Sur Mac, Dérush est une vraie application : son icône dans le Dock, ses menus, sa fenêtre (plus de Chrome). Une vidéo déposée s'affiche en moins d'une seconde et se monte tout de suite ; la timeline reste fluide à tous les zooms. À la première ouverture, un tutoriel animé montre les gestes. Et avant de publier : une **analyse de viralité** (ce qui retient les gens, ce qui les fait partir, quoi changer) puis un **plan de partage** (légendes, hashtags, bon moment) pour chaque réseau.

**8.1 — YouTube.** L'envoi sur YouTube passe maintenant par une commande de Dérush (`derush-youtube`), avec ta clé Treg : la première méthode, par les outils Treg de l'IA, ne pouvait pas marcher (YouTube rend l'adresse d'envoi dans un en-tête que ces outils ne montrent pas). Dérush reprend l'envoi s'il est coupé, n'envoie jamais deux fois la même vidéo, et te dit la visibilité réelle de la vidéo une fois en ligne.

> **Bêta privée.** Tu as été invité à tester : merci de ne pas partager ce dépôt. Dis-nous ce qui coince (onglet *Issues* du dépôt) : c'est le but de la bêta.

---

## 1. Installer

### Le plus simple : demande à ton IA

Ouvre **Claude Code** ou **Codex** (dans un terminal, ou leur app) et colle ce message. L'IA installe Dérush et l'adapte à ta machine.

```text
Installe Dérush (bêta privée d'IABAI) sur cet ordinateur.

1. Vérifie que Git et Node.js 20.12 ou plus sont là (git --version, node --version). S'il en manque un,
   installe-le avec l'outil de ce système (Homebrew sur Mac, winget sur Windows, le gestionnaire de
   paquets sur Linux). Si cela demande mon mot de passe, donne-moi la commande à lancer moi-même.
2. Clone le dépôt privé https://github.com/toyrek/derush dans un dossier « Derush » de mon dossier
   personnel. S'il refuse l'accès, aide-moi à me connecter à GitHub (par exemple : gh auth login --web) :
   j'ai été invité sur ce dépôt.
3. Lis INSTALLER.md à la racine du dépôt et suis-le pas à pas : il explique comment adapter
   l'installation à cette machine (FFmpeg, moteurs, Blender en option, raccourci sur le Bureau).
4. À la fin, lance « node derush.mjs installer --bilan », montre-moi le bilan, et dis-moi en trois lignes
   comment ouvrir Dérush et brancher mon IA dans « Connexions ».

Ne lance aucune commande avec sudo ou en administrateur sans me la montrer d'abord.
```

### À la main

Il te faut **Git** et **Node.js 20.12 ou plus** (https://nodejs.org). Puis, dans un terminal :

```bash
git clone https://github.com/toyrek/derush.git Derush
```

```bash
cd Derush
```

```bash
node derush.mjs installer
```

L'installateur fait le bilan de ta machine, installe ce qui manque (FFmpeg, les moteurs, les compétences Remotion) et pose un raccourci **Dérush** sur le Bureau. Options : `--leger` (sans Whisper, 2 Go de moins), `--blender` (ajoute Blender pour la 3D réaliste), `--earshot` (ajoute Earshot, l'oreille de l'IA : 2,5 Go), `--bilan` (regarde sans rien installer). Il ne lance jamais de commande administrateur : s'il en faut une, il te l'écrit.

Le détail, système par système, est dans [INSTALLER.md](INSTALLER.md).

---

## 2. Brancher (une fois)

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
| <img src="public/logos/googledrive.svg" width="22"> | **Google Drive** | Donner tes fichiers du Drive à l'IA, y envoyer tes vidéos | Un interrupteur (il faut Google Drive pour ordinateur) |
| <img src="public/logos/treg.svg" width="22" style="background:#000"> | **Treg** (conseillé) | Publier sur les réseaux, lire tes chiffres et tes commentaires, dresser ton profil de créateur | *Relier mes réseaux* : trois gestes, Dérush te guide et te montre quels réseaux sont reliés |
| <img src="public/logos/blender.svg" width="22"> | **Blender** | La 3D réaliste (facultatif) | *Installer* |

Une seule IA suffit, mais tu peux en brancher plusieurs et passer de l'une à l'autre à tout moment (le nom de l'IA, en haut de la conversation). Trois niveaux de qualité : **Rapide**, **Soigné**, **Maximum**.

Tes comptes restent les tiens : Dérush ne voit jamais tes mots de passe. Les clés (ElevenLabs, Treg) sont rangées dans le dossier de Dérush sur ton ordinateur, jamais dans tes projets ni sur GitHub. L'IA ne reçoit que les connexions que tu lui donnes ici.

---

## 3. Monter

1. **Dépose** tes vidéos, tes sons, tes photos. Même sans rien trier. Ils restent à leur place sur ton disque.
2. **Coupe, ou pas.** Glisse, coupe, supprime, comme dans CapCut. Ou ne touche à rien : l'IA choisira les bons passages.
3. **Demande.** Écris ce que tu veux dans la colonne de droite, joins tes références, ta charte ou ton logo avec le trombone. L'IA répond, ou monte une ou plusieurs vidéos. Tu regardes son rendu en direct.

Deux réglages au-dessus de la timeline :

- **Le format** : `9:16`, `16:9`, `1:1`, `4:5`, ou **Auto** (le format de ta première vidéo). Tu peux mélanger des vidéos de formats différents : chacune est recadrée pour remplir l'image, en suivant les visages. Tu peux aussi demander à l'IA plusieurs formats d'un coup (« fais-en aussi une version 16:9 »).
- **Les sous-titres** : aucun tant que tu ne les demandes pas. Un clic sur *Sous-titres* les met sur tout le film ; leur style se règle dans *Habiller*.

**De vrais sons.** Allume *Bibliothèque de sons* dans Connexions : pour ses bruitages (whoosh, impacts, clics, pops…), l'IA prend de vrais enregistrements libres de droits au lieu de sons de synthèse. Elle en cherche d'autres sur [Openverse](https://openverse.org) quand il en manque, ne garde que ceux qu'on a le droit de poser sur une vidéo commerciale, et te donne sous sa réponse les **crédits à coller** dans ta description quand une licence le demande.

Le manuel complet (tous les gestes, les effets, le studio ElevenLabs, les vrais sons) est dans [docs/MANUEL.md](docs/MANUEL.md).

---

**Les modes.** À la création d'un projet, choisis *Montage*, *Motion design*, *Extraits courts* ou *Sur un son*. Tu peux en changer ensuite (menu « … » › *Brief et format*).

**Régler ce que l'IA a posé.** Sous sa vidéo, la timeline montre ses blocs : plans (gris), titres et textes (jaune), effets (violet), sons (vert). Clique un bloc : « Plus tôt », « Plus tard », « Plus gros », « Moins fort », « Retirer », ou tes propres mots. Les réglages partent avec ton prochain message.

**Ton profil de créateur.** Bouton *Mon profil* sur l'écran des projets (ou menu « … »). Il faut Treg relié, et Claude ou Codex. L'analyse prend 5 à 10 minutes, en lecture seule ; tu peux couper « Donner mon profil à mon IA », refaire l'analyse ou tout effacer.

## 4. Analyser, puis partager

Sous chaque vidéo livrée (et à la fin de « Créer la vidéo »), deux boutons ouvrent l'écran **Avant de publier**.

**Analyser.** Dérush mesure la vidéo finie (format, durée, niveau du son, coupes, première parole, débit, blancs), puis ton IA lit ce qui est dit, regarde les images, relit ses repères datés sur TikTok, Instagram et YouTube, et cherche ce qui marche en ce moment sur ton sujet. Tu obtiens une note sur 100, une note par réseau, huit points regardés (accroche, histoire, rythme, son, textes à l'écran, format, fin, originalité) avec la preuve de chaque constat, et trois choses à faire en premier. Un clic sur *Demander* met la correction dans ton message à l'IA. C'est une estimation pour améliorer la vidéo : personne ne peut promettre des vues.

**Partager.** Choisis tes réseaux : l'IA écrit pour chacun la légende, les hashtags, le bon moment, l'image de couverture, et une stratégie pour faire circuler la vidéo. Tu relis, tu corriges, tu copies, ou tu publies d'un clic avec [Treg](https://treg.to). Tu peux aussi l'écrire dans la conversation (« publie-la sur TikTok et YouTube »), ou publier tout de suite sans plan (menu ⋯ de la vidéo).

| Réseau | Ce qui se passe |
|---|---|
| **TikTok** | La vidéo arrive en **brouillon** dans ta boîte TikTok ; tu colles la légende (bouton *Copier*) et tu publies depuis l'app. C'est une limite de TikTok pour l'instant. |
| **YouTube Shorts** | Mise en ligne **non répertoriée** par défaut ; *Publique* ou *Privée* si tu le choisis. YouTube a besoin de ta **clé Treg** dans Dérush (Connexions › Treg › *Relier mes réseaux*) : le connecteur Treg d'un compte Claude ne lui suffit pas. |
| **Instagram Reels** | Publiée sur ton compte professionnel. Instagram doit aller chercher la vidéo sur une adresse web : elle passe par un lien public temporaire (une heure). L'IA te le dit. |
| **LinkedIn** | Publiée sur ton profil. |

**Rien ne part sans toi** : l'IA ne publie que si tu cliques *Publier* ou si tu l'écris dans ton message. Chaque publication apparaît sous la vidéo, avec son lien.

---

## 5. Mettre à jour

**Connexions → Version → Vérifier**, puis *Mettre à jour* : Dérush récupère la dernière version publiée sur ce dépôt et redémarre. Ou, dans le dossier de Dérush :

```bash
node derush.mjs mettre-a-jour
```

Tes projets, tes moteurs et tes clés ne sont pas touchés (ils sont rangés ailleurs, voir plus bas).

---

## Les compétences

Dérush livre **105 compétences** que l'IA lit avant de travailler, et en télécharge 15 de plus (Remotion, Real SFX, le guide d'Earshot) à l'installation ou depuis Connexions :

- **Montage** : FFmpeg (42 outils), étalonnage, mixage du son, sous-titres et traduction, contrôle qualité, motion design, miniatures, images, 3D avec Blender, passage vers Premiere Pro ou DaVinci Resolve ;
- **Son et voix** : les sept compétences ElevenLabs (voix off, bruitages, musique, doublage, transcription…) ;
- **Vrais sons** : `sons-openverse` (chercher des sons libres et noter leurs crédits), Real SFX (les poser à l'image près), Earshot (écouter et fabriquer un son) ;
- **Réseaux** : accroches, scripts TikTok / Reels / Shorts, légendes, hashtags, tendances, carrousels, stratégie, croissance ;
- **Instagram et YouTube, de bout en bout** : 24 compétences de Jake Schincariol (`ig-…`, `yt-…`) — accroches notées sur des formules éprouvées, minutage d'un script, légende vérifiée, titre et miniature jugés ensemble, audit d'un compte par écart à sa médiane ;
- **Publication et créateur** : `derush-viralite` (analyser une vidéo avant de la publier, avec des repères datés et sourcés), `derush-publier` (TikTok, YouTube, Instagram, LinkedIn avec Treg) et `derush-createur` (dresser ton profil de créateur à partir de tes comptes, en lecture seule).

Elles sont dans [competences/](competences/), avec leurs sources et leurs licences ([competences/LICENCES.md](competences/LICENCES.md)).

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
- **Sur Mac seulement** : le recadrage qui suit les visages et le titre « derrière la personne » (ils utilisent Apple Vision).
- **Codex** travaille dans un bac à sable : il écrit dans le dossier du projet, et Dérush fait les rendus pour lui. Claude, lui, travaille directement.
- **La publication** dépend de Treg et de tes comptes : TikTok en brouillon seulement, YouTube limité à quelques envois par jour, Instagram par un lien public temporaire. Elle n'a pas encore été essayée en vrai sur tous les réseaux.
- **Les vrais sons** viennent d'Openverse (Freesound, Wikimedia Commons…). Dérush ne garde que les licences qui permettent une vidéo commerciale (domaine public et CC BY) et note chaque crédit, mais Openverse relaie la licence indiquée par la source sans la garantir : pour une publicité ou un client important, ouvre la page du son avant de publier. 200 recherches par jour au plus. Real SFX et Earshot n'ont été essayés que sur Mac.
- **Remotion**, le moteur de rendu, est gratuit pour les particuliers et les structures de trois personnes au plus ; au-delà, il faut une licence (https://remotion.dev/license).
- **ElevenLabs et Treg** sont des services en ligne : ce que l'IA crée ou publie avec eux utilise tes crédits et tes comptes.

---

## Licences

Dérush est © 2026 IABAI (association YABAÏ) — bêta privée, voir [LICENCE.md](LICENCE.md). Les composants d'autres auteurs gardent leurs licences : [NOTICES.md](NOTICES.md).
