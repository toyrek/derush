# Dérush — repères pour une IA qui ouvre ce dépôt

Dérush par IABAI est un logiciel de montage vidéo piloté par une IA (Claude Code ou Codex), pour macOS, Windows et Linux.
Un petit serveur Node (127.0.0.1) sert une interface sans framework ; l'IA travaille dans un dossier de montage que
Dérush prépare, avec un kit Remotion, FFmpeg et une bibliothèque de compétences. Sur Mac, l'interface s'affiche dans
une vraie app (`outils/coque-mac.swift` : une fenêtre WebKit, les menus, le Dock) ; ailleurs, dans une fenêtre de
Chrome, Edge ou Brave.

## Si on te demande d'installer Dérush

Suis **[INSTALLER.md](INSTALLER.md)** pas à pas. Ne modifie pas le code pour « faire marcher » une installation.

## Si on te demande de mettre à jour

`node derush.mjs mettre-a-jour` (ou, dans l'app : Connexions → Version → Vérifier).

## Les règles de ce dépôt

- Tout est en **français simple** : l'interface, les messages, les commentaires, les noms de fonctions.
- **Aucune dépendance** pour le serveur et l'interface (Node 20.12+, modules standard). Les moteurs (Remotion, Whisper…)
  s'installent chez l'utilisateur, dans le dossier de Dérush, jamais dans ce dépôt.
- **Ce qui dépend du système** (chemins, raccourcis, corbeille, fenêtres, liens) est dans `lib/plateforme.mjs`, nulle part
  ailleurs : pas de `process.platform` dans le reste du code.
- **Jamais de secret** dans le dépôt ni dans un projet : les clés sont dans le dossier de Dérush (`.env.local`).
- L'IA ne reçoit que les connexions données dans « Connexions », et **ne publie rien** sans demande explicite.
  L'analyse de viralité et le plan de partage (`lib/conseil.mjs`) lancent l'IA sans aucun connecteur ni clé : elle lit,
  regarde, cherche sur le web, et écrit un fichier JSON. Rien ne se publie depuis là.
- **Un logiciel, pas une page web** : rien ne se sélectionne comme du texte (sauf les champs et les réponses de l'IA),
  pas de curseur « main », pas de menu de navigateur. La timeline ne dessine que ce qui est à l'écran (`vueTl`).
- **La coque Mac** (`outils/coque-mac.swift`) se recompile avec `swiftc` après chaque changement, pour les deux familles
  de Mac, et le résultat (`outils/coque-mac`) se range dans le dépôt : les testeurs n'ont pas Swift.
- **Le micro et la caméra, sur Mac** : l'`Info.plist` porte les deux phrases que macOS affiche (`NSMicrophoneUsageDescription`, `NSCameraUsageDescription`), et la coque accorde la demande de la page seulement si elle vient de l'adresse locale de Dérush (`requestMediaCapturePermissionFor`). Rien n'est enregistré sans un clic de la personne.
- **Codex tourne toujours dans son bac à sable** (`workspace-write`). Le rendu Remotion passe par `lib/relais.mjs`.
- **Les outils de son d'autres auteurs** (Real SFX, Earshot) ne sont pas livrés ici : `lib/sons.mjs` les télécharge chez
  l'utilisateur, à une version précise qui a été relue (`VERSIONS_SONS`). Avant d'en changer, relis leur code.
  `earshot llm` reste coupé : il envoie le son à Google.

## Le plan du code

| Fichier | Rôle |
|---|---|
| `derush.mjs` | Le point d'entrée : l'app, et les commandes (`installer`, `mettre-a-jour`, `demander`, `rendre`…) |
| `lib/serveur.mjs` | Le serveur local et toutes ses routes |
| `lib/claude.mjs` | La conversation avec l'IA (Claude ou Codex) : dossier de travail, lancement, suivi en direct, livraison |
| `lib/ia.mjs` | Trouver, installer, connecter Claude Code et Codex ; niveaux de qualité |
| `lib/relais.mjs`, `lib/boite.mjs` | Le relais de rendu pour une IA en bac à sable : par une adresse locale (Codex) ou par des fichiers du dossier de travail, « la boîte » (Gemini, dont le bac à sable coupe le réseau local) |
| `lib/gemini.mjs` | Ce que le bac à sable de Gemini (`agy`) a le droit de lire, d'écrire et de joindre : les réglages donnés à chaque demande par `--settings` |
| `lib/competences.mjs` | La bibliothèque de compétences (`competences/`), reliée dans chaque dossier de travail |
| `lib/drive.mjs`, `lib/treg.mjs`, `lib/elevenlabs.mjs` | Google Drive, publication avec Treg (et la vérification des réseaux reliés), studio ElevenLabs |
| `lib/conseil.mjs` | Demander un avis à l'IA hors de la conversation de montage (sans connecteur, réponse en JSON) |
| `lib/createur.mjs`, `public/createur.js` | Le profil du créateur (l'IA lit ses comptes avec Treg, en lecture seule) et la mise en route ; compétence `derush-createur` |
| `lib/ia.mjs` | Les trois assistants : Claude Code, Codex, Gemini (commande `agy`) — les trouver, les installer, les connecter, lire leur travail |
| `lib/youtube.mjs`, `outils/publier-youtube.mjs` | L'envoi d'une vidéo sur YouTube par la porte directe de Treg (commande `derush-youtube` donnée à l'IA ; relais pour Codex et Gemini) |
| `lib/publication.mjs` | Avant de publier : les mesures d'une vidéo finie, l'analyse de viralité, le plan de partage |
| `lib/sons.mjs` | Les vrais sons : la bibliothèque de sons libres (Openverse), Real SFX, Earshot ; leurs commandes et leurs consignes |
| `lib/installation.mjs`, `lib/maj.mjs` | L'installateur multi-systèmes et les mises à jour (GitHub) |
| `lib/plateforme.mjs` | Tout ce qui change entre macOS, Windows et Linux |
| `lib/pack.mjs`, `lib/recettes.mjs` | Le dossier de montage donné à l'IA et ses guides |
| `lib/medias.mjs`, `lib/transcription.mjs`, `lib/moteurs.mjs`, `lib/rendu.mjs` | Médias, texte (Whisper), moteurs, rendu sans IA |
| `lib/enregistrement.mjs`, `public/enregistrer.js` | Enregistrer sa voix (micro) ou soi-même (webcam) : la fenêtre envoie la prise par morceaux, Dérush l'écrit au fur et à mesure dans `<projet>/enregistrements/`, FFmpeg la met au propre (`.m4a`, `.mp4` à 30 i/s), elle rejoint les médias. Une voix off est un son posé par-dessus, marqué `voix_off` (projet, `montage.json`) |
| `public/` | L'interface (`app.js`, `style.css`, `index.html`), l'écran « Avant de publier » (`publication.js`), le tutoriel animé (`tuto.js`) et le moteur d'habillage partagé avec le rendu (`moteur.js`) |
| `modeles/kit-remotion/` | Le kit Remotion copié dans chaque dossier de montage |
| `competences/` | Les compétences livrées (sources et licences dans `competences/LICENCES.md`) |
| `outils/` | Scripts des moteurs (Python, Swift), la fenêtre native du Mac (`coque-mac.swift`), fabrication de l'app Mac, essai de l'interface |

## La page d'accueil du dépôt

`README.md` est la page que voient les nouveaux venus : courte, illustrée, avec le message à coller à leur IA (le même texte est dans `docs/message-d-installation.txt`). Ses images sont dans `docs/images/` : les dessins (bannière, étapes, modes) sont des pages HTML aux couleurs du logiciel photographiées par Chrome, les captures viennent de `outils/essai-interface.mjs` avec `DERUSH_ESSAI_ECHELLE=2`, sur des projets de démonstration dessinés (aucune image prise ailleurs, aucun nom de personne, aucun chemin de dossier). L'historique des versions est dans `docs/NOUVEAUTES.md`.

Le trailer de lancement est en haut de la page : un aperçu animé (`.github/medias/trailer-derush-apercu.gif`) et un lien qui télécharge le film entier (`.github/medias/trailer-derush.mp4`, en 720p ; GitHub ne lit pas une vidéo du dépôt dans la page, d'où le lien en `?raw=true`). Ces deux fichiers sont dans `.github/` et non dans `docs/`, pour ne pas partir dans l'app (qui embarque `docs/`). Les originaux en pleine qualité, horizontal et vertical, ne sont pas dans le dépôt.

## Essayer sans rien casser

Un serveur d'essai, sur une bibliothèque à part et sans ouvrir de fenêtre :

```bash
DERUSH_BIBLIOTHEQUE=/chemin/vers/un/dossier/d-essai DERUSH_SANS_NAVIGATEUR=1 node derush.mjs --port 4334
```

`outils/essai-interface.mjs` pilote ensuite l'interface sans fenêtre, dans Chrome (voir son en-tête).

Ajoute `DERUSH_SUPPORT=/chemin/vers/un/dossier/d-essai` pour ne toucher ni aux réglages, ni aux projets récents, ni aux commandes de la vraie installation (relie-y `moteurs`, `competences`, `node_modules` par des liens pour ne rien retélécharger). **Un clic sur « Envoyer » dans un essai lance la vraie IA choisie par la personne, à son niveau de qualité** : dans un essai d'interface, force l'assistant (`moteur`) dans la requête, ou sers-toi de la commande simulée `outils/faux-agy.mjs` (voir son en-tête) avec `DERUSH_AGY`.

`node outils/essai-youtube.mjs` rejoue les 41 essais de l'envoi vers YouTube contre un faux Treg (aucun appel réel, aucune clé), par la commande, par le relais de Codex et par la boîte de Gemini : à relancer après tout changement de `lib/youtube.mjs`, `lib/relais.mjs`, `lib/boite.mjs` ou `outils/publier-youtube.mjs`. Un envoi réel coûte 1 600 des 10 000 unités du quota quotidien que tous les comptes reliés à Treg se partagent : ne jamais en faire un « pour voir ».

`node outils/essai-gemini.mjs` rejoue les 50 essais du moteur Gemini sans appeler Google : le choix du modèle selon le compte, les arguments d'`agy` (jamais sans bac à sable), la lecture de ses événements, ce que son bac à sable a le droit de lire (jamais le dossier personnel) et la sécurité de la boîte du relais. À relancer après tout changement de `lib/ia.mjs`, `lib/gemini.mjs` ou `lib/relais.mjs`. `node outils/essai-pieces.mjs` rejoue les 17 essais du rôle deviné d'une pièce jointe (`roleProbable` dans `lib/pieces.mjs`). `outils/faux-agy.mjs` est une fausse commande `agy` qui parle comme la vraie (`DERUSH_AGY=…`, voir son en-tête) : avec `AGY_FAUX_RENDU`, elle lance le vrai script de rendu, qui passe par la boîte.

`node outils/essai-enregistrement.mjs` rejoue les 31 essais de l'enregistrement sans micro ni caméra (FFmpeg fabrique ce qu'une fenêtre enverrait, en webm comme Chrome et en mp4 par fragments comme l'app Mac) : les morceaux dans l'ordre, les refus, une prise abandonnée, Dérush qui s'arrête en pleine prise, la marque `voix_off`. `outils/essai-interface.mjs` ouvre Chrome avec un faux micro et une fausse caméra : toute la prise s'essaie donc dans l'interface. Dans l'app Mac native, macOS pose sa question au premier vrai `getUserMedia` (personne ne peut y répondre à la place de l'utilisateur) : pour essayer le reste du chemin, remplace d'abord `MediaDevices.prototype.getUserMedia` par un flux fabriqué dans la page (un oscillateur, une toile).

L'app Mac native se pilote aussi sans la regarder : fabrique-la dans un dossier d'essai
(`node derush.mjs construire-app <dossier> --sans-raccourci`), ouvre-la avec `DERUSH_COQUE_PILOTE=<dossier>`
(`open -n … --env DERUSH_COQUE_PILOTE=…`), puis pose dans ce dossier un fichier `commande.json`
(`{"id": 1, "js": "return document.title", "capture": "/chemin/image.png"}`) : la réponse arrive dans
`reponse-1.json` (voir l'en-tête de `outils/coque-mac.swift`).
