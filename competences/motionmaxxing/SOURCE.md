# D'où vient cette compétence

**Source :** motionmaxxing, de Tejas Makwana, https://github.com/Tejashmakwana/motionmaxxing — commit `8c8ec0f2a6f6c9a0da15cd24f7b1298ab298368c` (lu le 24 novembre 2026).
**Licence :** Apache-2.0 (texte complet : `LICENSE` ; la notice du dépôt : `NOTICE` ; les deux aussi dans `../licences/tejashmakwana.txt`).

## Ce qui est repris

- `SKILL.md` : la direction (ce qu'est un bon film, ce qu'on ne livre jamais, les lois de métier, les contrôles, les étapes, les valeurs par défaut).
- `references/` : 13 documents (`brand`, `close`, `director`, `idea`, `judgment`, `layout`, `motion`, `slop`, `sound-sync`, `transitions`, `type`, `ui-demo`, `world`), inchangés à une ligne de provenance près.
- `taste/verdicts.md` et `taste/edits.md` : les réactions de la personne pour qui l'auteur travaillait. Des exemples, pas des règles ; Dérush ne les complète jamais.

## Ce qui a été changé (Apache-2.0, §4 b : chaque fichier changé le dit à sa fin)

- `SKILL.md` : un en-tête et un paragraphe « Dans Dérush » en français ; les commandes des scripts de motionmaxxing sont remplacées par les outils de Dérush (`derush-toile`, `derush-controle`, `derush-son`, `derush-image`, le kit média de la personne, la bibliothèque de sons, ElevenLabs s'il est branché) ; `NOTE.md` devient le compte rendu à la personne ; la table des fichiers ne garde que ce qui est livré. « Trouver le site officiel et le capturer » est retiré : Dérush n'aspire pas un site de sa propre initiative.
- Les contrôles G0, G2 et G3 (la vidéo se lit et bouge, pas de suite d'images vides, pas de fin tenue trop longue) sont calculés par Dérush (`lib/mouvement.mjs`, écrit pour Dérush d'après leurs définitions, sans reprendre le code de `look.py`). G1, G4 et G5 se jugent à l'œil sur la planche.

## Ce qui n'est pas repris

- `runtime/` : son moteur d'animation, avec GSAP 3.12.5 recopié dedans. GSAP n'est pas un logiciel libre (licence « No Charge » de GreenSock) : Dérush ne le redistribue pas ; le moteur de rendu de Dérush l'installe depuis npm chez la personne. three.js, opentype.js et la police Inter recopiés dans `runtime/` ne sont pas repris non plus. La notice `NOTICE` les cite parce qu'elle est celle du dépôt : aucun de ces fichiers n'est dans Dérush.
- `scripts/` (12 programmes : capture d'un site, recherche d'un logo, voix et musique ElevenLabs, rendu, contrôles, mixage, images générées, comparaison à l'aveugle) et `install.sh`.
- `templates/film.html`, `examples/`, `library/moments.jsonl`, `references/tools.md` (le mode d'emploi des scripts).
- `docs/` et `studies/` : les films et les images de démonstration, dont des comparaisons qui montrent des marques (Cluely, Spotify, Wispr Flow) sans lien avec elles.

## Rafraîchir

Retélécharger le dépôt à un nouveau commit dans un dossier temporaire, refaire les mêmes remplacements dans `SKILL.md` (aucune commande `$SKILL/scripts/…` ne doit y rester), relire les références changées, puis relancer `node outils/essai-competences.mjs` et `node outils/essai-tableaux.mjs`.
