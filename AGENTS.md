# Dérush — repères pour une IA qui ouvre ce dépôt

Dérush par IABAI est un logiciel de montage vidéo piloté par une IA (Claude Code ou Codex), pour macOS, Windows et Linux.
Un petit serveur Node (127.0.0.1) sert une interface sans framework ; l'IA travaille dans un dossier de montage que
Dérush prépare, avec un kit Remotion, FFmpeg et une bibliothèque de compétences.

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
- **Codex tourne toujours dans son bac à sable** (`workspace-write`). Le rendu Remotion passe par `lib/relais.mjs`.

## Le plan du code

| Fichier | Rôle |
|---|---|
| `derush.mjs` | Le point d'entrée : l'app, et les commandes (`installer`, `mettre-a-jour`, `demander`, `rendre`…) |
| `lib/serveur.mjs` | Le serveur local et toutes ses routes |
| `lib/claude.mjs` | La conversation avec l'IA (Claude ou Codex) : dossier de travail, lancement, suivi en direct, livraison |
| `lib/ia.mjs` | Trouver, installer, connecter Claude Code et Codex ; niveaux de qualité |
| `lib/relais.mjs` | Le relais de rendu pour une IA en bac à sable |
| `lib/competences.mjs` | La bibliothèque de compétences (`competences/`), reliée dans chaque dossier de travail |
| `lib/drive.mjs`, `lib/treg.mjs`, `lib/elevenlabs.mjs` | Google Drive, publication avec Treg, studio ElevenLabs |
| `lib/installation.mjs`, `lib/maj.mjs` | L'installateur multi-systèmes et les mises à jour (GitHub) |
| `lib/plateforme.mjs` | Tout ce qui change entre macOS, Windows et Linux |
| `lib/pack.mjs`, `lib/recettes.mjs` | Le dossier de montage donné à l'IA et ses guides |
| `lib/medias.mjs`, `lib/transcription.mjs`, `lib/moteurs.mjs`, `lib/rendu.mjs` | Médias, texte (Whisper), moteurs, rendu sans IA |
| `public/` | L'interface (`app.js`, `style.css`, `index.html`) et le moteur d'habillage partagé avec le rendu (`moteur.js`) |
| `modeles/kit-remotion/` | Le kit Remotion copié dans chaque dossier de montage |
| `competences/` | Les compétences livrées (sources et licences dans `competences/LICENCES.md`) |
| `outils/` | Scripts des moteurs (Python, Swift), fabrication de l'app Mac, essai de l'interface |

## Essayer sans rien casser

Un serveur d'essai, sur une bibliothèque à part et sans ouvrir de fenêtre :

```bash
DERUSH_BIBLIOTHEQUE=/chemin/vers/un/dossier/d-essai DERUSH_SANS_NAVIGATEUR=1 node derush.mjs --port 4334
```

`outils/essai-interface.mjs` pilote ensuite l'interface sans fenêtre (voir son en-tête).
