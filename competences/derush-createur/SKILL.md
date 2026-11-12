---
name: derush-createur
description: Dresser le profil d'un créateur de contenu à partir de ses propres comptes (YouTube, Instagram, TikTok) lus avec Treg, en lecture seule — ses vidéos qui ont vraiment marché (classées par écart à sa médiane), son style, sa direction artistique, sa voix, ce que dit son public — pour que les montages, les titres et les conseils de Dérush soient faits sur mesure. À utiliser quand Dérush demande « le profil du créateur ».
---

# Le profil du créateur

Dérush te demande de regarder les comptes de l'humain et d'écrire ce que tu en apprends. Ce profil sera relu avant chaque
montage, chaque analyse et chaque plan de partage : il doit être **vrai, chiffré et utile à un monteur**.

## Les règles, avant tout

1. **Lecture seule.** Tu ne publies rien, tu ne commentes rien, tu n'envoies aucun message, tu ne supprimes rien, tu ne
   modifies aucun compte. Avec Treg, tu n'appelles que les fiches de lecture listées ici (`kind` absent, méthode de
   lecture). Jamais une fiche `kind: action`.
2. **Gratuit seulement.** Les fiches `own_account` (le compte relié de l'humain) ne coûtent rien. N'appelle aucune fiche
   payante (collecte de données par un prestataire : `tikhub.…`, `scrapecreators.…`, `justoneapi.…`, `apify.…`), même si
   elle semble pratique.
3. **Rien d'inventé.** Chaque chiffre du profil vient d'une réponse de Treg que tu as rangée dans `donnees/`. Un réseau
   qui n'a rien donné (pas relié, droit manquant, erreur) est dit dans `limites`, pas deviné.
4. **Sobre.** YouTube compte un quota : une liste coûte 1 unité, une *recherche* 100. N'utilise jamais
   `youtube.youtube.channel.videos` (c'est une recherche) : passe par la liste des envois, ci-dessous.

## 1. Ce qui est relié

`my_tools` (outil Treg) donne les réseaux reliés. Pour chaque fiche, lis-la d'abord avec `catalog_get` (ses paramètres
peuvent avoir changé), puis appelle-la avec `call`. Range chaque réponse utile, telle quelle, dans `donnees/<reseau>-<quoi>.json`.

## 2. Ce qu'il faut lire

**YouTube**
1. `youtube.youtube.channel.profile`, `query: {"part": "snippet,statistics,contentDetails", "mine": true}` → le nom, la
   description, les abonnés, le nombre de vidéos, et `contentDetails.relatedPlaylists.uploads` (la liste des envois).
2. `youtube.youtube.channel.videos.uploads`, `query: {"part": "contentDetails", "playlistId": <envois>, "maxResults": 50}`
   → les identifiants des 50 dernières vidéos (1 unité).
3. `youtube.youtube.video.detail`, `query: {"part": "snippet,statistics,contentDetails", "id": "<50 identifiants, séparés par des virgules>"}`
   → titres, dates, durées (`PT45S` = 45 s ; un Short fait 3 minutes au plus), vues, j'aime, commentaires, miniatures.
4. Pour les 3 meilleures vidéos : `youtube.youtube.video.comments`, `query: {"part": "snippet", "videoId": …, "order": "relevance", "maxResults": 20, "textFormat": "plainText"}`.

**Instagram** (compte professionnel)
1. L'identifiant du compte est donné par Treg (ressource reliée) ; sinon la fiche `instagram.instagram.user.profile` le
   demande en `ig_user_id` : lis sa note dans `catalog_get`. Champs : `id,username,name,biography,followers_count,media_count`.
2. `instagram.instagram.user.posts`, `query: {"ig_user_id": …, "fields": "id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count", "limit": 30}`.
3. Pour les Reels (10 au plus) : `instagram.instagram.media.insights`, `query: {"ig_media_id": …, "metric": "reach,saved,shares,views,total_interactions"}`.
   Une métrique refusée fait échouer tout l'appel : relance avec `reach,saved,shares` seulement.
4. Pour les 3 meilleurs : `instagram.instagram.post.comments`, `query: {"ig_media_id": …, "fields": "text,like_count", "limit": 25}`.

**TikTok**
1. `tiktok.tiktok.user.profile`, `query: {"fields": "display_name,bio_description,follower_count,likes_count,video_count"}`.
   Un champ hors des droits accordés fait échouer l'appel : retire alors les compteurs.
2. `tiktok.tiktok.user.videos` (méthode POST), `query: {"fields": "id,title,video_description,duration,cover_image_url,share_url,create_time,view_count,like_count,comment_count,share_count"}`, `body: {"max_count": 20}`.

**LinkedIn** : Treg ne donne que le nom du profil (pas les posts). Note-le dans `limites`.

## 3. Ce qui a vraiment marché

Les vues brutes ne prouvent rien : elles dépendent surtout de la taille du compte. Pour chaque réseau :

- la **médiane** des vues des vidéos lues (la valeur du milieu) ;
- pour chaque vidéo, son **multiple** = ses vues ÷ cette médiane. Au-dessus de 3, c'est un vrai succès. En dessous de
  1,5, c'est une journée normale ;
- quand tu as les partages et les enregistrements (Instagram, TikTok) : partages ÷ portée. C'est le signal le plus fort.

Calcule avec `python3` (une ligne suffit), jamais de tête. Mets côte à côte les 5 meilleures et les 5 moins bonnes, et
cherche ce qui les sépare : la première phrase, la durée, le sujet, le format, le titre, la miniature.
Les compétences `ig-audit`, `yt-audit` et `viral-reverse-engineering` donnent la méthode ; `ig-reel/hooks.json` et
`yt-script/hooks.json` nomment les formules d'accroche.

## 4. Regarder, pas seulement compter

- Télécharge les miniatures ou couvertures des 6 à 8 meilleures vidéos dans `images/` (`curl -sL -o images/<n>.jpg "<adresse>"`),
  et **regarde-les** (outil de lecture d'image) : couleurs, typographie, cadrage, texte à l'écran, visage ou non. C'est
  la direction artistique.
- Instagram donne l'adresse du fichier (`media_url`) : si une des meilleures vidéos pèse moins de 60 Mo, télécharge-la,
  tire 8 images réparties (`ffmpeg -i video.mp4 -vf "fps=1/N,scale=480:-2" images/reel-%02d.jpg`) et regarde-les : le
  rythme des plans, les sous-titres, les effets. YouTube et TikTok ne donnent pas le fichier : les miniatures suffisent.
- Lis les titres, les légendes et les commentaires : ses mots à lui, ce que son public demande.
- Si la recherche web est permise : deux ou trois recherches sur ce qui marche **en ce moment** dans sa niche, avec la
  source et la date. Pas plus.

## 5. Ce que tu rends

Écris `profil.json`, et rien d'autre comme réponse. En français, en tutoyant (« tes vidéos »), avec des mots simples.

```json
{
  "resume": "Deux ou trois phrases : qui tu es comme créateur, pour qui, ce que tu promets.",
  "niche": "Reviews de mangas",
  "comptes": [{"reseau": "youtube", "nom": "Nom de la chaîne", "abonnes": 1240, "videos_lues": 50, "mediane_vues": 830}],
  "ce_qui_marche": [{"reseau": "youtube", "titre": "Le titre exact", "lien": "https://…", "vues": 12400, "multiple": 14.9, "duree_s": 41,
                     "accroche": "La première phrase ou le titre qui accroche", "pourquoi": "Ce qui l'explique, en une phrase."}],
  "ce_qui_marche_moins": ["Une phrase par constat, avec le chiffre."],
  "style": {"ton": "…", "rythme": "…", "direction_artistique": "Ce que montrent les miniatures et les images : couleurs, typo, cadrage.",
            "formats": "Ce qu'il publie (Shorts de 30 à 45 s, face caméra…)", "duree_ideale": "Entre 30 et 45 secondes", "accroches": ["Les formules qui reviennent dans ses succès"],
            "ses_mots": ["les mots et tournures à lui"]},
  "public": "Qui regarde, d'après les commentaires et les chiffres.",
  "commentaires": ["Ce que son public dit ou demande (3 à 6 constats)"],
  "conseils": [{"titre": "Court", "quoi": "Quoi faire, concrètement.", "pourquoi": "Le chiffre ou l'exemple qui le justifie."}],
  "pour_le_montage": ["Des consignes de monteur : la première seconde, le rythme, les sous-titres, la musique, la durée."],
  "pour_les_titres": ["Comment écrire ses titres, ses légendes, ses hashtags."],
  "tendances": [{"quoi": "…", "source": "https://…", "vu_le": "2026-11-12"}],
  "voix": "Un portrait de sa façon de parler, pour écrire comme lui : son registre, ses tournures, ce qu'il ne dit jamais, trois phrases types tirées de ses vidéos.",
  "limites": "Ce que tu n'as pas pu lire, et ce qu'il faudrait pour aller plus loin."
}
```

`ce_qui_marche` : 3 à 8 vidéos, les plus forts multiples d'abord. `conseils` : 3 à 6, du plus utile au moins utile.
`pour_le_montage` : 4 à 8 lignes. Moins de 10 vidéos lues sur un réseau : dis que l'échantillon est petit.
