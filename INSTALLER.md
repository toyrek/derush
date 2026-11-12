# Installer Dérush — le guide pour l'IA (Claude Code, Codex ou Gemini)

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
| Place sur le disque | 2 Go (`--leger`) | 11 Go (avec Whisper, Blender et Earshot) |
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

Options : `--leger` (sans Whisper), `--blender` (avec Blender, pour la 3D réaliste : propose-le si la personne fait de la 3D ou si la machine est confortable), `--earshot` (avec Earshot, l'oreille de l'IA pour le son : 2,5 Go ; propose-le si la machine est confortable et que la personne soigne ses bruitages). Compte 5 à 15 minutes selon la connexion ; Whisper pèse environ 2 Go.

Ce qu'il fait, et quoi faire si une ligne échoue :

| Étape | Ce que fait l'installateur | Si ça échoue |
|---|---|---|
| **FFmpeg** | macOS : `brew install ffmpeg`. Windows : `winget install -e --id Gyan.FFmpeg`. | macOS sans Homebrew : propose d'installer Homebrew (https://brew.sh), ou un FFmpeg tout fait. Windows : après winget, il faut un nouveau terminal. Linux : `sudo apt install ffmpeg` (ou `dnf`, `pacman`) : montre la commande à la personne. |
| **uv** | L'installateur officiel d'Astral (dans le dossier personnel, sans droits spéciaux). | Relance ; sinon https://docs.astral.sh/uv/. |
| **Python de Dérush** | Un environnement Python isolé, dans le dossier de Dérush (pour les compétences). | Vérifie que `uv` répond. |
| **Moteur de rendu** | Remotion et ses modules (npm), et un Chrome sans fenêtre pour dessiner les images. | Linux : il manque souvent des bibliothèques pour ce Chrome. Sur Debian ou Ubuntu : `sudo apt install -y libnss3 libatk-bridge2.0-0 libcups2 libgbm1 libasound2t64 libxkbcommon0 libxdamage1 libxrandr2 libpango-1.0-0` (`libasound2` sur les versions plus anciennes) : à montrer d'abord. |
| **Compétences Remotion** | Téléchargées depuis leur dépôt officiel (elles n'ont pas de licence de redistribution). | Pas grave : bouton « Ajouter Remotion » dans Connexions, plus tard. |
| **Real SFX** | Téléchargé depuis son dépôt officiel, à la version que Dérush a examinée (9 Mo). Il pose de vrais sons à l'image près. | Pas grave : Connexions › Real SFX › *Ajouter*, plus tard. |
| **Earshot** (option) | Un Python à part, torch en version processeur, puis ses deux modèles (2,5 Go en tout). S'il est déjà sur la machine, Dérush le reprend. | Long sur une petite connexion : laisse-le pour plus tard (Connexions › Earshot › *Ajouter*). Dérush marche sans lui. |
| **Whisper** | Le modèle qui écrit le texte des vidéos (2 Go). | Passe en `--leger` si la place ou la connexion manque. |
| **Blender** (option) | macOS : `brew install --cask blender`. Windows : winget. Linux : Flatpak, pour la personne seule. | Sinon https://www.blender.org/download/ ; Dérush marche sans lui. |
| **Raccourci** | macOS : `~/Applications/Dérush.app` (une vraie app Mac : icône dans le Dock, menus, fenêtre à elle) et un alias sur le Bureau. Windows : Bureau et menu Démarrer. Linux : menu des applications et Bureau. | Dis à la personne qu'elle peut toujours lancer `node derush.mjs --app` dans le dossier. |

Sur **macOS**, au premier double-clic, le système peut dire qu'il ne peut pas vérifier le développeur : *Réglages Système → Confidentialité et sécurité → Ouvrir quand même* (une seule fois).

Sur **macOS**, Dérush n'a besoin d'aucun navigateur : il a sa propre fenêtre. Sa partie native est déjà compilée dans le dépôt (`outils/coque-mac`, pour les Mac Apple Silicon et Intel) ; si ce fichier manque, `construire-app` la compile avec Swift (outils de développement Apple), et sinon l'app s'ouvre comme avant dans une fenêtre de Chrome. Une ancienne installation (avant la version 8) se transforme toute seule en app native à son premier lancement après la mise à jour.

Sur **Windows et Linux**, il n'y a pas besoin de Chrome, d'Edge ou de Brave, mais s'il y en a un, Dérush s'ouvre dans sa propre fenêtre (sinon dans le navigateur par défaut).

Pour donner Dérush à quelqu'un sans passer par GitHub (Mac) : `node derush.mjs construire-app --dmg` fabrique une image disque (on l'ouvre, on glisse Dérush dans Applications), `--zip` un zip. Il faut quand même Node.js et FFmpeg sur la machine : l'app le dit clairement s'il en manque un.

## 4. L'IA qui monte

Dérush a besoin d'au moins une IA : **Claude Code** (compte Claude Pro ou Max), **Codex** (compte ChatGPT Plus, Pro ou Business) ou **Gemini** (la commande `agy` d'Antigravity, compte Google). Tu es toi-même l'une d'elles : elle est donc sans doute déjà installée et connectée, et le bilan le dit.

Pour l'autre, ou si le bilan dit « pas connecté » : dans Dérush, **Connexions** → *Installer* puis *Me connecter* (une page s'ouvre dans le navigateur, la personne s'y connecte elle-même). Ne te connecte jamais à sa place.

## 5. Vérifie

```bash
node derush.mjs installer --bilan
```

Tout ce qui est nécessaire doit être coché. Puis ouvre Dérush une fois pour voir qu'il démarre :

```bash
node derush.mjs --app
```

La fenêtre de Dérush doit apparaître (sur Mac, ouvre plutôt l'app : `open ~/Applications/Dérush.app`). À la toute première ouverture, un tutoriel animé se lance : c'est normal. Si rien ne s'ouvre, regarde le journal : `~/Library/Logs/Dérush.log` (macOS), `%APPDATA%\Dérush\derush.log` (Windows), `~/.local/share/derush/derush.log` (Linux).

## 6. Dis-le à la personne

En trois lignes :

1. Dérush est installé : double-clique sur « Dérush » (Bureau).
2. Ouvre **Connexions** (la prise en haut à droite) : branche ton IA, puis ElevenLabs si tu veux le son, « Relier mes réseaux » (Treg) si tu veux publier, et allume « Bibliothèque de sons » si tu veux de vrais bruitages libres de droits.
3. Dépose une vidéo et écris ce que tu veux.

Ajoute ce qui n'a pas pu être installé, et la commande exacte que la personne doit lancer elle-même s'il y en a une.

## Plus tard

- **Mettre à jour** : dans Dérush, Connexions → Version → *Vérifier* ; ou `node derush.mjs mettre-a-jour` dans le dossier.
- **Ajouter un moteur** : `node derush.mjs installer whisper` (ou `voix`, `blender`, `remotion`, `rendu`, `outils`, `real-sfx`, `earshot`).
- **Désinstaller** : supprimer le dossier `Derush`, le dossier des moteurs (macOS `~/Library/Application Support/Dérush`, Windows `%APPDATA%\Dérush`, Linux `~/.local/share/derush`) et le raccourci. Les projets (`Movies/Dérush`, `Vidéos\Dérush`) restent : c'est à la personne de décider.
