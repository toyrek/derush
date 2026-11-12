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
| `lib/relais.mjs` | Le relais de rendu pour une IA en bac à sable |
| `lib/competences.mjs` | La bibliothèque de compétences (`competences/`), reliée dans chaque dossier de travail |
| `lib/drive.mjs`, `lib/treg.mjs`, `lib/elevenlabs.mjs` | Google Drive, publication avec Treg (et la vérification des réseaux reliés), studio ElevenLabs |
| `lib/conseil.mjs` | Demander un avis à l'IA hors de la conversation de montage (sans connecteur, réponse en JSON) |
| `lib/publication.mjs` | Avant de publier : les mesures d'une vidéo finie, l'analyse de viralité, le plan de partage |
| `lib/sons.mjs` | Les vrais sons : la bibliothèque de sons libres (Openverse), Real SFX, Earshot ; leurs commandes et leurs consignes |
| `lib/installation.mjs`, `lib/maj.mjs` | L'installateur multi-systèmes et les mises à jour (GitHub) |
| `lib/plateforme.mjs` | Tout ce qui change entre macOS, Windows et Linux |
| `lib/pack.mjs`, `lib/recettes.mjs` | Le dossier de montage donné à l'IA et ses guides |
| `lib/medias.mjs`, `lib/transcription.mjs`, `lib/moteurs.mjs`, `lib/rendu.mjs` | Médias, texte (Whisper), moteurs, rendu sans IA |
| `public/` | L'interface (`app.js`, `style.css`, `index.html`), l'écran « Avant de publier » (`publication.js`), le tutoriel animé (`tuto.js`) et le moteur d'habillage partagé avec le rendu (`moteur.js`) |
| `modeles/kit-remotion/` | Le kit Remotion copié dans chaque dossier de montage |
| `competences/` | Les compétences livrées (sources et licences dans `competences/LICENCES.md`) |
| `outils/` | Scripts des moteurs (Python, Swift), la fenêtre native du Mac (`coque-mac.swift`), fabrication de l'app Mac, essai de l'interface |

## Essayer sans rien casser

Un serveur d'essai, sur une bibliothèque à part et sans ouvrir de fenêtre :

```bash
DERUSH_BIBLIOTHEQUE=/chemin/vers/un/dossier/d-essai DERUSH_SANS_NAVIGATEUR=1 node derush.mjs --port 4334
```

`outils/essai-interface.mjs` pilote ensuite l'interface sans fenêtre, dans Chrome (voir son en-tête).

L'app Mac native se pilote aussi sans la regarder : fabrique-la dans un dossier d'essai
(`node derush.mjs construire-app <dossier> --sans-raccourci`), ouvre-la avec `DERUSH_COQUE_PILOTE=<dossier>`
(`open -n … --env DERUSH_COQUE_PILOTE=…`), puis pose dans ce dossier un fichier `commande.json`
(`{"id": 1, "js": "return document.title", "capture": "/chemin/image.png"}`) : la réponse arrive dans
`reponse-1.json` (voir l'en-tête de `outils/coque-mac.swift`).
