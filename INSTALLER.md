# Installer Dérush — le guide pour l'IA (Claude Code ou Codex)

Ce fichier s'adresse à l'IA à qui quelqu'un a demandé d'installer Dérush sur son ordinateur. Suis-le dans l'ordre. Ton but : que la personne puisse double-cliquer sur « Dérush », brancher son IA dans « Connexions » et monter sa première vidéo, sans avoir rien eu à comprendre.

## Les règles

- **Rien en administrateur sans accord.** Ne lance jamais une commande avec `sudo`, ni dans un terminal administrateur, sans la montrer d'abord à la personne. Si elle doit taper un mot de passe, donne-lui la commande et attends.
- **N'installe que ce que ce guide demande**, avec l'outil du système (Homebrew, winget, flatpak…). Ne touche pas aux autres logiciels ni aux réglages du système.
- **Ne modifie pas le code de Dérush** pour le faire marcher : si quelque chose casse, dis-le (et propose d'ouvrir une *issue* sur le dépôt). Une copie modifiée ne se met plus à jour.
- **Jamais de secret à l'écran.** N'affiche pas le fichier `.env.local` du dossier de Dérush, ne demande pas de clé dans la conversation : les clés se branchent dans l'app (Connexions).
- **Parle simplement**, dans la langue de la personne. À la fin, trois lignes suffisent.

## 0. Regarde la machine

Note le système (macOS, Windows, Linux), le processeur (`uname -m`, ou `echo %PROCESSOR_ARCHITECTURE%` sous Windows), la mémoire et la place libre sur le disque.

| Ce qu'il faut | Minimum | Confortable |
|---|---|---|
| Place sur le disque | 2 Go (`--leger`) | 8 Go (avec Whisper et Blender) |
| Mémoire | 8 Go | 16 Go ou plus |
| Système | macOS 13, Windows 10 (64 bits), une distribution Linux récente avec bureau | |

Adapte tout de suite :

- **moins de 6 Go de place, ou 8 Go de mémoire** : installe avec `--leger` (sans Whisper), et dis à la personne que le texte des vidéos pourra passer par ElevenLabs (en ligne) ;
- **Mac à puce Intel, Windows, Linux** : Whisper tourne avec `faster-whisper` (plus lent que sur une puce Apple) ; c'est automatique ;
- **Windows et Linux** : le recadrage qui suit les visages et le titre « derrière la personne » n'existent pas (Apple Vision) ; le reste marche pareil.

## 1. Git et Node.js

Il faut `git` et `node` **20.12 ou plus** (prends la version 22 LTS si tu l'installes).

| Système | Si ça manque |
|---|---|
| macOS | Avec Homebrew : `brew install node git`. Sans Homebrew : l'installateur de https://nodejs.org ; pour Git, `xcode-select --install` ouvre une fenêtre que la personne doit valider. |
| Windows | `winget install -e --id OpenJS.NodeJS.LTS` puis `winget install -e --id Git.Git`. Ouvre ensuite un **nouveau** terminal (le PATH change). |
| Linux | Le paquet de la distribution s'il est assez récent (commande `sudo` : à montrer d'abord), sinon `nvm` (sans sudo) : https://github.com/nvm-sh/nvm. |

## 2. Le dépôt

Le dépôt est privé : la personne y a été invitée. Clone-le dans son dossier personnel, dans un dossier `Derush` (sans accent, pour les outils qui n'aiment pas ça) :

```bash
git clone https://github.com/toyrek/derush.git ~/Derush
```

Sous Windows : `git clone https://github.com/toyrek/derush.git "$HOME\Derush"`.

- **Accès refusé** : la personne doit se connecter à GitHub. Le plus simple est l'outil `gh` (`brew install gh`, `winget install -e --id GitHub.cli`) puis `gh auth login --web` : elle recopie un code dans son navigateur. Ne lui demande ni mot de passe ni jeton.
- **Le dossier existe déjà** : c'est une mise à jour. Va dedans et lance `node derush.mjs mettre-a-jour`, puis passe à l'étape 3.
- **Pas de Git possible** : la personne peut télécharger le dépôt en zip depuis GitHub. Dérush marchera, mais ne se mettra pas à jour tout seul : dis-le-lui.

## 3. L'installateur

Dans le dossier de Dérush :

```bash
node derush.mjs installer --bilan
```

Lis le bilan (✓ présent, ✗ manque et nécessaire, · facultatif), puis lance l'installation :

```bash
node derush.mjs installer
```

Options : `--leger` (sans Whisper), `--blender` (avec Blender, pour la 3D réaliste : propose-le si la personne fait de la 3D ou si la machine est confortable). Compte 5 à 15 minutes selon la connexion ; Whisper pèse environ 2 Go.

Ce qu'il fait, et quoi faire si une ligne échoue :

| Étape | Ce que fait l'installateur | Si ça échoue |
|---|---|---|
| **FFmpeg** | macOS : `brew install ffmpeg`. Windows : `winget install -e --id Gyan.FFmpeg`. | macOS sans Homebrew : propose d'installer Homebrew (https://brew.sh), ou un FFmpeg tout fait. Windows : après winget, il faut un nouveau terminal. Linux : `sudo apt install ffmpeg` (ou `dnf`, `pacman`) : montre la commande à la personne. |
| **uv** | L'installateur officiel d'Astral (dans le dossier personnel, sans droits spéciaux). | Relance ; sinon https://docs.astral.sh/uv/. |
| **Python de Dérush** | Un environnement Python isolé, dans le dossier de Dérush (pour les compétences). | Vérifie que `uv` répond. |
| **Moteur de rendu** | Remotion et ses modules (npm), et un Chrome sans fenêtre pour dessiner les images. | Linux : il manque souvent des bibliothèques pour ce Chrome. Sur Debian ou Ubuntu : `sudo apt install -y libnss3 libatk-bridge2.0-0 libcups2 libgbm1 libasound2t64 libxkbcommon0 libxdamage1 libxrandr2 libpango-1.0-0` (`libasound2` sur les versions plus anciennes) : à montrer d'abord. |
| **Compétences Remotion** | Téléchargées depuis leur dépôt officiel (elles n'ont pas de licence de redistribution). | Pas grave : bouton « Ajouter Remotion » dans Connexions, plus tard. |
| **Whisper** | Le modèle qui écrit le texte des vidéos (2 Go). | Passe en `--leger` si la place ou la connexion manque. |
| **Blender** (option) | macOS : `brew install --cask blender`. Windows : winget. Linux : Flatpak, pour la personne seule. | Sinon https://www.blender.org/download/ ; Dérush marche sans lui. |
| **Raccourci** | macOS : `~/Applications/Dérush.app` et un alias sur le Bureau. Windows : Bureau et menu Démarrer. Linux : menu des applications et Bureau. | Dis à la personne qu'elle peut toujours lancer `node derush.mjs --app` dans le dossier. |

Sur **macOS**, au premier double-clic, le système peut dire qu'il ne peut pas vérifier le développeur : *Réglages Système → Confidentialité et sécurité → Ouvrir quand même* (une seule fois).

Il n'y a pas besoin de Chrome, d'Edge ou de Brave, mais s'il y en a un, Dérush s'ouvre dans sa propre fenêtre (sinon dans le navigateur par défaut).

## 4. L'IA qui monte

Dérush a besoin d'au moins une IA : **Claude Code** (compte Claude Pro ou Max) ou **Codex** (compte ChatGPT Plus, Pro ou Business). Tu es toi-même l'une des deux : elle est donc sans doute déjà installée et connectée, et le bilan le dit.

Pour l'autre, ou si le bilan dit « pas connecté » : dans Dérush, **Connexions** → *Installer* puis *Me connecter* (une page s'ouvre dans le navigateur, la personne s'y connecte elle-même). Ne te connecte jamais à sa place.

## 5. Vérifie

```bash
node derush.mjs installer --bilan
```

Tout ce qui est nécessaire doit être coché. Puis ouvre Dérush une fois pour voir qu'il démarre :

```bash
node derush.mjs --app
```

La fenêtre « Dérush par IABAI » doit apparaître. Si rien ne s'ouvre, regarde le journal : `~/Library/Logs/Dérush.log` (macOS), `%APPDATA%\Dérush\derush.log` (Windows), `~/.local/share/derush/derush.log` (Linux).

## 6. Dis-le à la personne

En trois lignes :

1. Dérush est installé : double-clique sur « Dérush » (Bureau).
2. Ouvre **Connexions** (la prise en haut à droite) : branche ton IA, puis ElevenLabs et Treg si tu veux le son et la publication.
3. Dépose une vidéo et écris ce que tu veux.

Ajoute ce qui n'a pas pu être installé, et la commande exacte que la personne doit lancer elle-même s'il y en a une.

## Plus tard

- **Mettre à jour** : dans Dérush, Connexions → Version → *Vérifier* ; ou `node derush.mjs mettre-a-jour` dans le dossier.
- **Ajouter un moteur** : `node derush.mjs installer whisper` (ou `voix`, `blender`, `remotion`, `rendu`, `outils`).
- **Désinstaller** : supprimer le dossier `Derush`, le dossier des moteurs (macOS `~/Library/Application Support/Dérush`, Windows `%APPDATA%\Dérush`, Linux `~/.local/share/derush`) et le raccourci. Les projets (`Movies/Dérush`, `Vidéos\Dérush`) restent : c'est à la personne de décider.
