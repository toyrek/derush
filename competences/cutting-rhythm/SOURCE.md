# D'où vient cette compétence

- Source : https://github.com/agamm/video-agent (dossier `.claude/skills/cutting-rhythm`), commit cc00d2815869cbf2d708426a5082612f0c3b4dbf (29 juillet 2026).
- Auteur : Agam More. Licence MIT (texte dans `LICENSE` et dans `../licences/agamm.txt`).
- Intégrée à Dérush le 14 novembre 2026, après lecture : un seul fichier de texte, aucun programme, aucun appel réseau, aucune clé, aucune publicité.
- Seul `SKILL.md` a été repris. Le programme du dépôt (`video_agent.py`, sa commande `uv run video-agent`), ses essais et ses autres compétences ne sont pas livrés.

## Ce qui a été retiré ou adapté pour Dérush

Le savoir de l'auteur est gardé tel quel (coupes J et L et leurs durées, place de la coupe, grammaire des pauses, durée des plans, structure d'une bande-annonce, coupe sur le temps de la musique). Ses commandes venaient d'un outil que Dérush n'a pas : elles sont remplacées par ce que l'IA trouve dans son dossier de travail.

- La description est réécrite en une phrase, en français, sans renvoi à `edl-edit` (compétence du même dépôt, non livrée).
- `audio_lead` (un nombre, positif ou négatif) devient les deux champs de la table de montage : `son.avant_s` (coupe J) et `son.apres_s` (coupe L), posés sur le plan dont le son bouge. L'exemple JSON est réécrit avec ces champs.
- `transcribe --words`, `speech-segments` et `snap --to silence` deviennent `transcriptions/<rush>.json`, les silences de `analyse/<rush>.json` et `silence.py --list` de `ffmpeg-skill`.
- `tighten` (et ses options `--target-gap`, `--min-gap`) devient `coupes.json` puis `node remotion/recouper.mjs coupes.json`, avec un exemple chiffré. Le tableau des pauses par genre est gardé ; ses en-têtes ne nomment plus les options.
- `beats` et `snap --to beats` deviennent `scenes.py --beats --json` de `ffmpeg-skill`, et un calage fait sur les temps du montage. La phrase sur l'a priori de 120 BPM, propre au code de l'auteur, est retirée.
- `edl --report`, `--dry-run`, `--draft` et la règle « no-partial-previews » sont retirés : la boucle de contrôle est celle de Dérush (`node remotion/images.mjs`, `node remotion/rendre.mjs`, `derush-controle`, Earshot).
- Retirées aussi, parce qu'elles décrivaient le moteur de rendu de l'auteur : les chaînes de son et d'image indépendantes, l'erreur levée quand la matière manque, l'avertissement sur le premier plan, et le plan de coupe `vsrc`.
- Le renvoi à `filler-removal` (non livrée) devient « retire d'abord les hésitations et les redites ».
- L'ordre des étapes est gardé, sauf un point : les coupes décalées passent après le calage sur la musique, parce que `recouper.mjs` les remet à zéro.
- Ajouts de Dérush, en français et marqués « Dans Dérush » : le tableau du haut ; le kit joue le son débordant en plus de celui du voisin (il faut un silence, ou un voisin sans son) ; pas de coupe décalée sur un saut de coupe du même visage (les lèvres) ; le seuil de 0,7 s de `derush-controle` ; ne pas utiliser `cut.py --snap beats` avec une musique posée à part ; `recouper.mjs` remet les débordements à zéro ; la limite `son.avant_s` ≤ `fichier.debut_utile_s`.
