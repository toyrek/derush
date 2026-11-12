---
name: sons-openverse
description: Chercher des sons libres (effets sonores, bruitages, ambiances, whoosh, impacts, clics, pops) avec l'API Openverse, sans clé, ne garder que ceux qu'on a le droit de poser sur une vidéo commerciale, les télécharger dans la bibliothèque de sons de l'humain et noter leur crédit. À utiliser dès qu'il manque un son pour une vidéo, pour compléter la bibliothèque de sons, ou pour sortir les crédits des sons d'une vidéo.
---

# sons-openverse : des sons libres, avec leur crédit

Openverse est un moteur de recherche de contenus sous licence libre (Freesound, Wikimedia Commons, Jamendo…). Son
API est ouverte, sans clé. Cette compétence cherche un son, vérifie sa licence, le range dans la bibliothèque de
l'humain et note son crédit. Tout passe par une seule commande, qui compte aussi les appels pour respecter les limites.

Dans Dérush, la commande s'appelle `sons-openverse` et la bibliothèque est reliée dans ton dossier de travail :
`sons/` (ailleurs : `python3 scripts/openverse.py …` depuis le dossier de cette compétence, bibliothèque `~/Music/Sons`).

```bash
sons-openverse chercher "whoosh" --duree shortest
sons-openverse telecharger 3 --type whoosh
sons-openverse credits sons/whoosh/fichier.mp3
```

## Les règles

1. **Pars du principe que la vidéo est commerciale** (une marque, des clients, des revenus) : la recherche envoie
   toujours `license_type=commercial`. Ne retire ce filtre (`--non-commercial`) que si l'humain dit lui-même que la
   vidéo n'a aucun usage commercial.
2. **Le filtre ne suffit pas pour une vidéo.** `license_type=commercial` laisse passer toutes les licences sans « NC » :
   `cc0`, `pdm`, `by`, `by-sa`, `by-nd`, `sampling+`. Or poser un son sur une image est une adaptation au sens des
   licences Creative Commons (code juridique 4.0, article 1.a : un enregistrement sonore « synched in timed relation
   with a moving image » produit toujours une œuvre adaptée). La commande trie donc chaque résultat :

   | Licence | Sur une vidéo commerciale | Crédit |
   |---|---|---|
   | `cc0`, `pdm` (domaine public) | **OK** | facultatif (noté quand même) |
   | `by` | **OK** | **obligatoire** |
   | `by-sa` | **à éviter** : la vidéo devrait être partagée sous la même licence | obligatoire |
   | `by-nd` | **non** : pas d'adaptation, donc pas de vidéo | |
   | `sampling+` | **non** : interdit de s'en servir pour promouvoir autre chose que l'œuvre | |
   | tout ce qui contient `nc` | **non** : pas d'usage commercial | |

   `telecharger` refuse les « non », et les `by-sa` sauf avec `--accepter-sa` (seulement si l'humain le demande, en
   sachant ce que ça implique).
3. **Un son CC BY doit être crédité.** Chaque téléchargement ajoute une ligne à `CREDITS.md`. Quand un son crédité
   est utilisé dans une vidéo, sors ses crédits (`credits FICHIER …`) : l'humain les colle dans sa description.
4. **Les limites de l'API sans clé : 20 appels par minute, 200 par jour**, pour tout l'ordinateur. La commande les
   compte, attend si la minute est pleine, s'arrête si le jour est plein, et ne réessaie jamais après une réponse 429.
   N'appelle pas l'API autrement (curl, recherche web). `quota` dit ce qu'il reste. **Trois recherches par vidéo au plus.**
5. **Pas d'aspiration.** Les conditions d'Openverse interdisent de moissonner le catalogue. Une recherche répond à un
   besoin précis ; on télécharge les deux ou trois sons qu'on va vraiment essayer, pas des pages entières.
6. **Openverse relaie la licence indiquée par la source, il ne la garantit pas.** Pour une publicité ou un client
   important, dis à l'humain d'ouvrir la page source (colonne `page_source` du catalogue) avant de publier.

## Chercher

```bash
sons-openverse chercher "fast whoosh" --duree shortest
```

- Les mots en **anglais** trouvent beaucoup plus (`whoosh`, `swoosh`, `impact`, `thud`, `riser`, `click`, `pop`,
  `camera shutter`, `page turn`, `crowd cheer`, `rain ambience`). 200 caractères au plus.
- `--duree shortest` (ou `short`, `medium`, `long`, plusieurs avec des virgules) : pour un effet, `shortest`. La durée
  réelle de chaque son est affichée, en secondes.
- `--source freesound` : une seule source ; `--extension wav` ou `mp3,flac` ; `--page 2` pour la suite.
- `--categorie sound_effect` existe, mais il est très restrictif (« whoosh » avec ce filtre : 0 résultat). Ne le mets
  pas par défaut.
- `--json` donne les mêmes résultats en JSON.

Chaque ligne commence par `OK`, `~` (à éviter) ou `NON`, avec la raison en dessous. Les résultats sont gardés : on
télécharge ensuite par numéro, ou par le début de l'identifiant (8 caractères) pour une recherche plus ancienne.

## Choisir

Le titre ne dit pas tout : regarde la durée, le poids et les mots-clés. Prends 2 ou 3 candidats, puis départage-les :

- avec `earshot`, s'il est installé : `earshot rank "a fast crisp air whoosh" sons/whoosh/ --top 3` classe les
  candidats, `earshot describe FICHIER` dit ce qu'on entend ;
- sinon avec `ffprobe` (durée, niveau), et en disant à l'humain que le choix n'a pas été écouté.

**Vérifie chaque son téléchargé avant de t'en servir.** Sur 31 sons essayés, 3 n'étaient pas ce que disait leur
titre (un « thud » qui était un souffle de tissu, un craquement « mouillé », un « bubble pop » qui claquait et
saturait). Un son qui ne correspond pas à son type : `retirer`.

Tu ne peux pas entendre : ne dis jamais qu'un son « sonne bien » sans mesure ni écoute humaine.

## Télécharger

```bash
sons-openverse telecharger 3 7 --type whoosh
sons-openverse telecharger 3 --type impact --nom "impact sourd court"
```

- `--type` est obligatoire : `whoosh`, `impact`, `riser`, `pop`, `chime`, `ui`, `click`, `typing`, `error`, `camera`,
  `paper`, `glass`, `cartoon`, `foley`, `water`, `ambience`, `glitch`, `scifi`, `other`. Choisis celui qui décrit ce
  que le son **est**, pas le mot du titre : c'est le rôle que Real SFX lui donnera.
- Le fichier arrive dans `sons/<type>/<titre>-<source>-<début de l'id>.<ext>`, vérifié avec `ffprobe` (un fichier qui
  n'est pas un son est supprimé), 50 Mo au plus (`--max-mo`).
- Un son déjà présent n'est pas retéléchargé. Le téléchargement du fichier ne compte pas dans le quota.
- Si Real SFX est installé, lance ensuite `sons-openverse indexer` : il refait son index.

## Retirer un son

```bash
sons-openverse retirer pop/bubble-pop-freesound-54410e5a.mp3
```

Le fichier va à la corbeille sur Mac (ailleurs il est supprimé), sa ligne de crédit et sa ligne de catalogue sont
enlevées. Ne retire que des sons que tu viens de télécharger et qui se révèlent mauvais : la bibliothèque est à l'humain.

## La bibliothèque

```
sons/                         la bibliothèque de l'humain (Musique › Sons), reliée dans le dossier de travail
  CREDITS.md                  une ligne par son : attribution, page source, identifiant, date, crédit obligatoire ou non
  catalog.csv                 le même contenu pour les outils : fichier, type, titre, auteur, licence, page source…
  whoosh/  impact/  click/ …  un dossier par type
```

- Une ligne de `CREDITS.md` reprend mot pour mot le champ `attribution` de l'API (la formule de crédit valable).
- `catalog.csv` suit le format de catalogue de Real SFX (colonnes `file`, `type`, `source`, `hit`,
  `hits_in_source`, plus les colonnes de crédit). Ne modifie pas ces fichiers à la main.
- L'humain peut y déposer ses propres sons : ils n'ont pas de ligne de crédit, et c'est à lui de savoir d'où ils
  viennent. Ne les renomme pas, ne les déplace pas.

```bash
sons-openverse credits                          # tous les crédits obligatoires de la bibliothèque
sons-openverse credits sons/whoosh/x.mp3 …      # ceux des sons d'une vidéo
sons-openverse credits --tous                   # aussi les facultatifs
```

## L'API, pour mémoire

`GET https://api.openverse.org/v1/audio/` (documentation : `https://api.openverse.org/v1/`).

- Paramètres utiles : `q`, `license_type` (`commercial`, `modification`, `all`, `all-cc`), `license`, `length`,
  `source`, `excluded_source`, `extension`, `category`, `tags` ou `title` (à la place de `q`), `page`, `page_size`.
- Par résultat : `id`, `title`, `creator`, `license`, `license_version`, `license_url`, `attribution`,
  `foreign_landing_url` (la page du son chez la source), `url` (le fichier), `filetype`, `filesize`, `duration` (en
  millisecondes), `source`, `tags`.
- En-têtes : `x-ratelimit-limit-anon_burst: 20/min`, `x-ratelimit-limit-anon_sustained: 200/day`. Au-delà : 429.

## Pièges

- Les fichiers de Freesound relayés par Openverse sont des aperçus MP3, pas les originaux WAV : suffisant pour un
  effet dans une vidéo de réseaux sociaux.
- Ne mets jamais de clé ni d'adresse e-mail dans les requêtes : l'API marche sans.
