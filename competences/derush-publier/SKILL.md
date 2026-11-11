---
name: derush-publier
description: Publier une vidéo finie de Dérush sur TikTok, YouTube (Shorts), Instagram (Reels) et LinkedIn avec Treg, avec le bon titre, la bonne légende et les bons hashtags pour chaque réseau. À utiliser SEULEMENT quand l'humain demande de publier, poster ou mettre en ligne, sur les réseaux qu'il nomme.
---

# Publier avec Treg

Treg (treg.to) relie les comptes de l'humain (TikTok, YouTube, Instagram, LinkedIn) et fait les appels à sa place : tu n'as
jamais de clé. Ses outils sont ceux du serveur `treg` (ou `claude_ai_Treg`) : `catalog_get` (lire un point d'entrée) et
`call` (l'appeler). Les appels de publication sont gratuits.

## Les règles, avant tout

1. **Ne publie que si l'humain le demande dans son dernier message**, et seulement sur les réseaux qu'il nomme
   (« publie sur TikTok et YouTube »). « Prépare », « propose », « écris la légende » : tu écris, tu ne publies pas.
2. **Une seule fois par vidéo et par réseau.** Si un appel échoue après l'envoi, vérifie l'état avant de recommencer, et
   repasse le même `idempotency_key` à `call` pour une reprise.
3. **La vidéo** : celle que l'humain désigne (souvent dans `a-publier/`), sinon la dernière livrée (`rendu/final.mp4` ou
   `rendu/livraison/`). Vérifie-la d'abord pour le réseau (format, durée, son) avec ffmpeg-skill :
   `check.py VIDEO --platform tiktok|shorts|reels|linkedin`. Si elle ne passe pas, corrige (export) ou dis-le.
4. **Les textes** : écris-les pour chaque réseau avec les compétences `caption-writer`, `hashtag-strategy`,
   `viral-captions-and-ctas` (et `youtube-shorts` pour le titre d'un Short), dans la langue de l'humain, avec ses mots.
   Pas d'hashtags génériques en rafale : 3 à 6 bien choisis (Instagram : 30 au plus, LinkedIn : 3 au plus).
5. **Visibilité** : YouTube en **non répertorié** (`unlisted`) sauf si l'humain dit « public » ou « privé ». TikTok part
   en **brouillon** dans sa boîte TikTok (voir plus bas). Instagram et LinkedIn publient pour de vrai : ne le fais que
   si c'est demandé en toutes lettres.
6. **Contenu généré par IA** : si la vidéo montre une personne, une voix ou une scène réaliste générée par IA (voix
   ElevenLabs imitant quelqu'un, vidéo générée), dis-le à la plateforme quand elle le demande (YouTube :
   `status.containsSyntheticMedia: true`) et à l'humain.
7. **À la fin**, écris `rendu/publications.json` (voir plus bas) et dis à l'humain, pour chaque réseau, ce qui s'est
   passé : le lien, ou ce qu'il lui reste à faire (TikTok : ouvrir l'app, coller la légende, publier).

Avant chaque appel, lis le point d'entrée avec `catalog_get` : ses paramètres peuvent avoir changé.

## TikTok — brouillon dans la boîte de l'humain

La publication directe est refusée tant que TikTok n'a pas audité Treg (sauf compte privé en « moi seulement ») :
on envoie donc la vidéo **dans la boîte TikTok de l'humain**, qui finit de publier dans l'app (légende, couverture,
confidentialité). TikTok jette un brouillon au bout de 24 h.

1. Taille exacte du fichier en octets. Découpage : jusqu'à 64 Mo, **un seul morceau** de toute la taille ; au-delà,
   des morceaux de 10 Mo (`total_chunk_count` = partie entière de taille / 10 Mo, le dernier morceau prend le reste).
2. `call` `tiktok.tiktok.video.inbox.init`, `method: POST`, `body: {"source_info": {"source": "FILE_UPLOAD",
   "video_size": <octets>, "chunk_size": <octets>, "total_chunk_count": <n>}}` → `data.publish_id`, `data.upload_url`.
3. Envoie chaque morceau **directement** à `upload_url` (pas par Treg), par exemple pour un seul morceau :
   `curl -X PUT -H 'Content-Type: video/mp4' -H 'Content-Range: bytes 0-<taille-1>/<taille>' --data-binary @VIDEO "$UPLOAD_URL"`
   (206 pour un morceau intermédiaire, 201 pour le dernier). L'adresse expire au bout d'une heure.
4. `call` `tiktok.tiktok.publish.status` avec `{"publish_id": …}` toutes les 20 s, jusqu'à `SEND_TO_USER_INBOX`
   (c'est le succès ici) ou `FAILED`.
5. Donne à l'humain la légende et les hashtags prêts à coller.

## YouTube (Shorts) — envoi en deux temps

Un Short : vidéo verticale de 3 minutes au plus. Environ six envois par jour pour tous les comptes reliés à Treg.

1. `call` `youtube.youtube.video.upload`, `method: POST`,
   `query: {"part": "id,snippet,status", "uploadType": "resumable"}`,
   `body: {"snippet": {"title": "… (100 caractères au plus)", "description": "… (avec 2-3 #hashtags, dont #Shorts)",
   "tags": [ … ], "categoryId": "22"}, "status": {"privacyStatus": "unlisted", "selfDeclaredMadeForKids": false}}`.
   `selfDeclaredMadeForKids` est obligatoire (true seulement si l'humain dit que c'est pour les enfants).
2. La réponse donne l'en-tête `Location` : envoie-y la vidéo **directement** :
   `curl -X PUT -H 'Content-Type: video/mp4' --data-binary @VIDEO "$LOCATION"` → la réponse contient l'`id` de la vidéo.
3. Le lien : `https://youtube.com/shorts/<id>` (vertical) ou `https://youtu.be/<id>`.

## Instagram (Reels) — il faut une adresse publique

Instagram va chercher la vidéo lui-même sur une adresse web publique ; Treg n'héberge pas de fichiers.

1. L'identifiant du compte : `call` `instagram.instagram.user.profile` (le compte relié) → son `id`.
2. **Adresse temporaire** : dépose la vidéo sur un hébergement public qui s'efface tout seul, par exemple
   `curl -F reqtype=fileupload -F time=1h -F fileToUpload=@VIDEO https://litterbox.catbox.moe/resources/internals/api.php`
   (lien valable une heure). **Dis-le à l'humain** dans ton message de fin : la vidéo est passée par un lien public
   temporaire, nécessaire à Instagram. Si l'humain refuse ce passage ou si l'hébergement échoue, n'insiste pas : dis-lui
   de publier ce Reel depuis l'app Instagram, avec la légende que tu as écrite.
3. `call` `instagram.instagram.media.container.create`, `method: POST`, `query: {"ig_user_id": …, "media_type": "REELS",
   "video_url": …, "caption": "… (2 200 caractères et 30 hashtags au plus)", "thumb_offset": <ms de la meilleure image>}`
   → `id` du conteneur.
4. `call` `instagram.instagram.media.container.status` toutes les 10 s jusqu'à `status_code: FINISHED` (`ERROR` : arrête
   et dis pourquoi).
5. `call` `instagram.instagram.post.publish`, `query: {"ig_user_id": …, "creation_id": <conteneur>}` → `id` du média ;
   puis son lien (`permalink`) si le catalogue le permet.

## LinkedIn — vidéo en morceaux de 2 Mo

1. L'auteur : `call` `linkedin.linkedin.user.profile` → `sub` ; l'auteur est `urn:li:person:<sub>`.
2. `call` `linkedin.linkedin.video.upload.init`, `body: {"initializeUploadRequest": {"owner": "urn:li:person:<sub>",
   "fileSizeBytes": <octets exacts>, "uploadCaptions": false, "uploadThumbnail": false}}` → `value.video` et
   `value.uploadInstructions` (une adresse par morceau, avec `firstByte` et `lastByte`).
3. Pour chaque morceau, dans l'ordre : découpe-le (`dd` ou un petit script) et
   `curl -X PUT --data-binary @morceau -D en-tetes.txt "<uploadUrl>"` ; **garde l'en-tête `etag` de chaque morceau**.
4. `call` `linkedin.linkedin.video.upload.finalize`, `body: {"finalizeUploadRequest": {"video": "<urn>",
   "uploadToken": "", "uploadedPartIds": [<etags dans l'ordre>]}}`.
5. Attends que LinkedIn ait traité la vidéo (environ 30 s à quelques minutes), puis
   `call` `linkedin.linkedin.user.post.create`, `headers: {"LinkedIn-Version": "<AAAAMM récent>",
   "X-Restli-Protocol-Version": "2.0.0"}`, `body: {"author": "urn:li:person:<sub>", "commentary": "…",
   "visibility": "PUBLIC", "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [],
   "thirdPartyDistributionChannels": []}, "content": {"media": {"id": "<urn de la vidéo>", "title": "…"}},
   "lifecycleState": "PUBLISHED"}`. Dans `commentary`, échappe `( ) [ ] { } < > @ | ~` avec une barre oblique inverse.
   Si LinkedIn refuse la version, essaie un mois plus ancien. Le lien du post vient de l'en-tête `x-restli-id`.

## `rendu/publications.json`

Dérush lit ce fichier pour montrer chaque publication sous la vidéo (avec le logo du réseau, le lien, et un bouton
« Copier » pour la légende). Écris un tableau, une entrée par réseau tenté :

```json
[
  {"video": "rendu/final.mp4", "reseau": "youtube", "etat": "publie", "visibilite": "unlisted",
   "lien": "https://youtube.com/shorts/…", "titre": "…", "legende": "…", "hashtags": ["#…"]},
  {"video": "rendu/final.mp4", "reseau": "tiktok", "etat": "brouillon", "legende": "…", "hashtags": ["#…"],
   "message": "Ouvre TikTok › Boîte de réception : le brouillon t'attend (24 h)."}
]
```

`reseau` : `tiktok`, `youtube`, `instagram` ou `linkedin`. `etat` : `publie`, `brouillon`, `en_cours` ou `echec` (avec
`message` qui dit pourquoi, en mots simples).

## Si quelque chose manque

- Treg ne répond pas, ou le réseau n'est pas relié (erreur d'autorisation, `scope_not_authorized`, 401/403) : ne
  contourne rien. Dis à l'humain de relier ce réseau sur treg.to (Connexions dans Dérush), et donne-lui les textes prêts
  à coller.
- Jamais d'autre moyen de publier (navigateur, mot de passe, autre service) que Treg.
