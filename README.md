<p align="center"><img src="public/marque/iabai.png" alt="IABAI" height="110"></p>

# Dérush par IABAI

**Tu donnes la matière. Ton IA fait le montage.** — bêta privée, version 7.0

Dérush est un logiciel de montage vidéo fait pour travailler avec une IA. Tu déposes tes vidéos, tu coupes si tu veux (comme dans CapCut), tu écris ce que tu attends. Ton IA — **Claude** ou **Codex**, avec ton propre compte — monte la vidéo, ajoute les effets, le son, les sous-titres si tu les demandes, et peut la **publier** sur TikTok, YouTube Shorts, Instagram Reels et LinkedIn. Tu suis son travail en direct.

Dérush tourne sur **macOS, Windows et Linux**. Tes vidéos restent sur ton ordinateur.

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

L'installateur fait le bilan de ta machine, installe ce qui manque (FFmpeg, les moteurs, les compétences Remotion) et pose un raccourci **Dérush** sur le Bureau. Options : `--leger` (sans Whisper, 2 Go de moins), `--blender` (ajoute Blender pour la 3D réaliste), `--bilan` (regarde sans rien installer). Il ne lance jamais de commande administrateur : s'il en faut une, il te l'écrit.

Le détail, système par système, est dans [INSTALLER.md](INSTALLER.md).

---

## 2. Brancher (une fois)

Ouvre Dérush, puis **Connexions** (la prise, en haut à droite). Chaque carte se branche en un clic.

| | Connexion | À quoi ça sert | Comment |
|---|---|---|---|
| <img src="public/logos/claude.svg" width="22"> | **Claude** | L'IA qui monte | *Installer*, puis *Me connecter* : ton compte Claude (Pro ou Max) |
| 🖥 | **Codex** | L'IA qui monte | *Installer*, puis *Me connecter* : ton compte ChatGPT (Plus, Pro ou Business) |
| <img src="public/logos/elevenlabs.svg" width="22"> | **ElevenLabs** | Musiques, voix off, bruitages, doublage, images, plans vidéo | *Brancher* : tu autorises Dérush dans ton navigateur |
| <img src="public/logos/googledrive.svg" width="22"> | **Google Drive** | Donner tes fichiers du Drive à l'IA, y envoyer tes vidéos | Un interrupteur (il faut Google Drive pour ordinateur) |
| 🔗 | **Treg** | Publier sur les réseaux | Relie tes comptes sur treg.to, puis colle ta clé |
| <img src="public/logos/blender.svg" width="22"> | **Blender** | La 3D réaliste (facultatif) | *Installer* |

Une seule IA suffit, mais tu peux brancher les deux et passer de l'une à l'autre à tout moment (le nom de l'IA, en haut de la conversation). Trois niveaux de qualité : **Rapide**, **Soigné**, **Maximum**.

Tes comptes restent les tiens : Dérush ne voit jamais tes mots de passe. Les clés (ElevenLabs, Treg) sont rangées dans le dossier de Dérush sur ton ordinateur, jamais dans tes projets ni sur GitHub. L'IA ne reçoit que les connexions que tu lui donnes ici.

---

## 3. Monter

1. **Dépose** tes vidéos, tes sons, tes photos. Même sans rien trier. Ils restent à leur place sur ton disque.
2. **Coupe, ou pas.** Glisse, coupe, supprime, comme dans CapCut. Ou ne touche à rien : l'IA choisira les bons passages.
3. **Demande.** Écris ce que tu veux dans la colonne de droite, joins tes références, ta charte ou ton logo avec le trombone. L'IA répond, ou monte une ou plusieurs vidéos. Tu regardes son rendu en direct.

Deux réglages au-dessus de la timeline :

- **Le format** : `9:16`, `16:9`, `1:1`, `4:5`, ou **Auto** (le format de ta première vidéo). Tu peux mélanger des vidéos de formats différents : chacune est recadrée pour remplir l'image, en suivant les visages. Tu peux aussi demander à l'IA plusieurs formats d'un coup (« fais-en aussi une version 16:9 »).
- **Les sous-titres** : aucun tant que tu ne les demandes pas. Un clic sur *Sous-titres* les met sur tout le film ; leur style se règle dans *Habiller*.

Le manuel complet (tous les gestes, les effets, le studio ElevenLabs) est dans [docs/MANUEL.md](docs/MANUEL.md).

---

## 4. Publier

Sous chaque vidéo livrée, le bouton **Publier** : choisis les réseaux, et l'IA vérifie la vidéo, écrit le titre, la légende et les hashtags de chaque réseau, puis publie avec [Treg](https://treg.to). Tu peux aussi l'écrire dans la conversation (« publie-la sur TikTok et YouTube »).

| Réseau | Ce qui se passe |
|---|---|
| **TikTok** | La vidéo arrive en **brouillon** dans ta boîte TikTok ; tu colles la légende (bouton *Copier*) et tu publies depuis l'app. C'est une limite de TikTok pour l'instant. |
| **YouTube Shorts** | Mise en ligne **non répertoriée** par défaut ; *Publique* ou *Privée* si tu le choisis. |
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

Dérush livre **78 compétences** que l'IA lit avant de travailler, et en télécharge 13 de plus (Remotion) à l'installation :

- **Montage** : FFmpeg (42 outils), étalonnage, mixage du son, sous-titres et traduction, contrôle qualité, motion design, miniatures, images, 3D avec Blender, passage vers Premiere Pro ou DaVinci Resolve ;
- **Son et voix** : les sept compétences ElevenLabs (voix off, bruitages, musique, doublage, transcription…) ;
- **Réseaux** : accroches, scripts TikTok / Reels / Shorts, légendes, hashtags, tendances, carrousels, stratégie, croissance ;
- **Publication** : `derush-publier` (TikTok, YouTube, Instagram, LinkedIn avec Treg).

Elles sont dans [competences/](competences/), avec leurs sources et leurs licences ([competences/LICENCES.md](competences/LICENCES.md)).

---

## Où sont rangées les choses

| | macOS | Windows | Linux |
|---|---|---|---|
| Tes projets | `~/Movies/Dérush` | `Vidéos\Dérush` | `~/Videos/Dérush` |
| Moteurs, clés, réglages | `~/Library/Application Support/Dérush` | `%APPDATA%\Dérush` | `~/.local/share/derush` |
| Le programme | le dossier que tu as cloné | idem | idem |

Rien d'autre n'est installé ailleurs, sauf ce que tu acceptes (FFmpeg, Blender, Claude Code, Codex).

---

## Ce qu'il faut savoir sur cette bêta

- **Windows et Linux** : Dérush a été écrit pour les trois systèmes, mais il n'a été essayé pour de vrai que sur Mac (puce Apple). Sur Windows et Linux, attends-toi à des accrocs : dis-les-nous.
- **Sur Mac seulement** : le recadrage qui suit les visages et le titre « derrière la personne » (ils utilisent Apple Vision).
- **Codex** travaille dans un bac à sable : il écrit dans le dossier du projet, et Dérush fait les rendus pour lui. Claude, lui, travaille directement.
- **La publication** dépend de Treg et de tes comptes : TikTok en brouillon seulement, YouTube limité à quelques envois par jour, Instagram par un lien public temporaire. Elle n'a pas encore été essayée en vrai sur tous les réseaux.
- **Remotion**, le moteur de rendu, est gratuit pour les particuliers et les structures de trois personnes au plus ; au-delà, il faut une licence (https://remotion.dev/license).
- **ElevenLabs et Treg** sont des services en ligne : ce que l'IA crée ou publie avec eux utilise tes crédits et tes comptes.

---

## Licences

Dérush est © 2026 IABAI (association YABAÏ) — bêta privée, voir [LICENCE.md](LICENCE.md). Les composants d'autres auteurs gardent leurs licences : [NOTICES.md](NOTICES.md).
