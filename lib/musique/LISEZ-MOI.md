# La musique : le compositeur et le traceur de temps de huashu-motion

Ces fichiers viennent de huashu-motion, de Huashu (花叔) : https://github.com/alchaincyf/huashu-motion, commit `f4f38bfe295a3f768753857be9236cc3277c7dad` (version 0.6.1), dossier `cli/lib/`. Licence MIT : `LICENSE`, à côté. Aucune dépendance : du JavaScript et FFmpeg pour lire un fichier son.

## Repris sans un octet de changé

| Fichier | Octets | SHA-256 |
|---|---|---|
| `sound.js` | 51482 | `5fc75f07c3c1ded939cef2ae4541588175e57d2ba462fdb1c526c988116c3e7e` |
| `soundprint.js` | 4449 | `a4e42a7a054b53c9fe32673535dd92c3b911da831958bb4c69822f1b21bc493c` |
| `beats.js` | 46945 | `60bb19dc09f69ff03cba92d31ac4ca7c42911dd64082445fc8952829b1e74104` |
| `arrange.js` | 54135 | `4512239c4ab030392799dbf89bac4eec5160cdc7ac7433c749b346b40e971d01` |
| `track.js` | 23196 | `4eb99c6b196219e60963d12669ca5f150fd4bf4bc5242338c456e0f808d56558` |
| `composed.js` | 8791 | `f16a70a128e1f7358fadc5a654dc48971b6f34ba987f9f8da87f348c06b6e36e` |
| `composer.js` | 25427 | `36de248fd819dd2df3ed45c1a0ba13f5e93b5c766a60b1bd3b013096236b67b1` |
| `dsp.js` | 12042 | `2609e6d93ac51667f67345d3ba84d71d83c3b792656de97e95d12da57c6235fa` |
| `fx.js` | 19397 | `ea7f52c6cc313221b739dbd305419f06becdb0117387fc593ad8a945cc7989d1` |
| `project.js` | 11368 | `d7140a102f421ff76248bc542481636d301f2d55c5bb7b336622eb40193dc4c8` |
| `samples.js` | 7645 | `834a5eaa0f0ed954a64ba75efe6226b4fe9bbf383a46b86767256e09cbd06bd1` |
| `score.js` | 48117 | `5e753eb638d4e0aee80cc9e878809bbb8344cfbecc947e2da6cbf4801fbc6215` |

- `composer.js` lit une partition en notation ABC et la joue (tempo, nuances, pédale, ralentis) ; `composed.js` la pose sur les instruments ; `score.js` compose tout seul d'après un style ; `dsp.js` et `fx.js` sont la synthèse et les effets ; `samples.js` lirait des instruments enregistrés s'il y en avait (Dérush n'en installe pas) ; `sound.js` mixe et met au niveau (`mixdown`, `toWav`).
- `beats.js` trouve le tempo, les temps, les débuts de mesure, les sections et les sommets d'une musique (flux spectral, autocorrélation, suivi des temps d'Ellis) ; `track.js` et `arrange.js` s'en servent.
- `project.js` et `soundprint.js` sont importés par les précédents ; Dérush n'appelle pas leurs fonctions de projet.

## Écrits pour Dérush

- `browser.js` et `capture.js` : deux petits remplaçants. Les fichiers d'origine cherchent Chrome et le pilotent pour lire la page d'un film ; Dérush ne s'en sert pas (`derush-musique` reçoit la partition ou le style), et `cdp.js` n'est pas repris.
- Le reste de huashu-motion (son studio, son moteur de film, sa commande `om`, ses gabarits avec GSAP, sa voix Kokoro, sa bibliothèque de musiques, son paquet d'instruments) n'est pas ici : voir `competences/huashu-motion/SOURCE.md`.

## Comment Dérush s'en sert

`lib/musique.mjs` prépare l'environnement (`OM_SAMPLES=off` : aucun instrument enregistré, tout est calculé ; `OM_HOME` dans le dossier de Dérush, jamais le dossier personnel), puis appelle :

- `mixdown`, `toWav`, `loudness`, `limit`, `STYLES` (`sound.js`) : jouer une partition ou un style, écrire le WAV ;
- `parseAbc`, `perform`, `DRUM_KITS` (`composer.js`) et `INSTRUMENTS` (`score.js`) : lire une partition sans la jouer ;
- `analyze` (`beats.js`) : les temps d'un morceau. Le son du fichier est lu par le FFmpeg de Dérush, dans `lib/musique.mjs` : `decode` et `analyzeFile` ne sont pas appelés.

Rien d'autre n'est appelé : ni `sound()` (qui écrit dans un projet et dans un carnet), ni `samples.js` (les instruments enregistrés), ni le recalage d'un morceau du commerce (`track.js`, `arrange.js`). La commande donnée à l'IA est `derush-musique` (`outils/derush-musique.mjs`). `node outils/essai-musique.mjs` vérifie les empreintes ci-dessus, et que ces fichiers ne vont pas sur Internet.

## Rafraîchir

Recopier les mêmes fichiers d'un nouveau commit, refaire ce tableau, relire ce qui a changé (réseau, disque, programmes lancés), relancer `node outils/essai-musique.mjs`.
