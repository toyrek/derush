# D'où vient cette compétence

**Source :** huashu-motion, de Huashu (花叔), https://github.com/alchaincyf/huashu-motion — commit `f4f38bfe295a3f768753857be9236cc3277c7dad` (version 0.6.1, lu le 24 novembre 2026).
**Licence :** MIT (texte complet : `LICENSE` ; aussi dans `../licences/alchaincyf-huashu-motion.txt`).

## Ce qui est repris

- `SKILL.md` : la direction (ce qu'on juge, les trois épreuves, les étapes d'un film, ce qui le rend bon), adaptée aux outils de Dérush. L'original pèse 29585 octets (SHA-256 `aec777e004a07928e0676c8da792e7f9690ca922d0c4e93b91b986c4440f5133`).
- `references/` : 41 documents repris tels quels. Chaque fichier `.md` reçoit une seule ligne de plus, à la fin, qui dit d'où il vient ; les trois partitions `.abc` sont à l'octet près celles du dépôt. Le tableau plus bas donne la taille et l'empreinte de chaque original : `node outils/essai-musique.mjs` vérifie que rien d'autre n'a changé.
- Son compositeur et son traceur de temps (`cli/lib/`) sont repris à part, sans un octet de changé, dans `lib/musique/` (voir son `LISEZ-MOI.md`) : c'est la commande `derush-musique`.

## Ce qui a été changé

- `SKILL.md` : un en-tête et un paragraphe « Dans Dérush » en français ; les commandes de leur outil `om` remplacées par celles de Dérush (`derush-toile`, `derush-controle`, `derush-musique`, `derush-son`) ; trois directions comparées dans le plan, et montrées à la personne seulement quand elle veut choisir ; l'ordre des sources de musique adapté (le morceau de la personne, ElevenLabs s'il est branché, la bibliothèque de sons, puis une partition jouée ici). Retirés : la liste des commandes `om`, le studio et sa boîte de remarques, le contrat de leur page, la signature « Made with huashu-motion » (la licence MIT ne la demande pas), `om share`, et le carnet d'expérience (`om learn`).
- `references/LISEZ-MOI.md` est écrit pour Dérush : ce que devient chaque commande `om`, et ce qui prime sur ces documents.

## Ce qui n'est pas repris

- `cli/om.js` et le reste de `cli/lib/` : leur outil, son studio, son rendu, sa voix (Kokoro, whisper.cpp), sa bibliothèque de musiques et son paquet d'instruments enregistrés (des téléchargements).
- `runtime/` : leur moteur de film, avec three.js recopié et le personnage « bean Huashu » (`runtime/clip/lib/toon.js`), qui n'est pas sous licence MIT. `templates/` : leurs gabarits, avec GSAP recopié (GSAP n'est pas un logiciel libre : Dérush ne le redistribue pas).
- `fonts/`, `examples/`, `site/`, `docs/`, `scripts/`.
- `music/` : le catalogue de leur bibliothèque de 11 morceaux. Les morceaux ne sont pas sous licence MIT (l'auteur les a faits avec des outils d'IA et les laisse libres de tout usage, sans garantie) et ne sont pas dans le dépôt : Dérush n'en livre aucun.
- `references/contract.md` (le contrat de leur page) et `references/grammars.md` (leurs gabarits) : ils décrivent leur outil.
- `references/experience.md` : leur carnet de bord. Il est écrit pour leur outil, et une de ses notes donne des façons de passer outre les protections de sites de vidéo : Dérush ne fait pas ça.
- `references/about-author.md` : la présentation de l'auteur et de ses autres projets.

## Les originaux des documents repris

| Fichier (dans `skills/huashu-motion/references/`) | Octets | SHA-256 |
|---|---|---|
| `director.md` | 18494 | `cb0b45497d501c386dd0a0d3da568e29711f3310c5d9e27b608e9149a7ac263d` |
| `rhythm.md` | 12739 | `c916c5456b8337484ad9b8a6da7cf09e6d1feaafb526039a9f05bb55d9baf955` |
| `punch-up.md` | 7183 | `db6c20920757555721e1e000a377b0c6827d42286253a08ad38276601f4ef7e5` |
| `colour.md` | 8864 | `11d0dede9e2608216a80645ae6a77caf1c3aacbc4c62425f105bb954c1a403df` |
| `depth.md` | 8370 | `f2663b6cf9bf12e123a2e31a8552c57aab9d698ec788ce21317fd2fc4fefb9f5` |
| `sound.md` | 25167 | `c3e8370fa73106c0fdf9ab86cfa3be1fef954cec263f1cea3799c9912cfe3381` |
| `music.md` | 16039 | `57c3e7bf20626160345d8d2daae4ae8c202a51f0f1262f1ab07726c3631b3f20` |
| `music-sources.md` | 5102 | `3157a9e33be894201daeee082149cbbdcd8ae181f2196a0196086cd73c4bb726` |
| `talking-head.md` | 10259 | `e78d08cf74028059e732ada71f7eabfc0f46a61b2d9be90a8143f6eb3c968ca4` |
| `product-demo-continuity.md` | 8652 | `84a545faf82bc7e8f94781a8d4313dd063bdd966dd77bd13a0f23b62fe98e41e` |
| `craft.md` | 3291 | `8848876be15b82e3c6f64cfbb4462b564b19b1beff69bd144b265baa4d6ffe1e` |
| `visual-direction.md` | 9036 | `5f514f094a221df53ac1354d481b780bc8d29394aa1f879fb94259d42efa8ca0` |
| `verification.md` | 2314 | `982ec8ee30be501e5ded5a6425bc8df7ceec29af0d94cf97a41cf6710d52b6cf` |
| `provenance.md` | 2229 | `139268157eade6168b9835ff2d3011dea6f788193c589b7ee131414382c8c145` |
| `scores/first-light.abc` | 3024 | `b776c1c6bebce76b06ee3995be470b7cd9ecfb390a632c09072ae808141d2872` |
| `scores/four-rooms.abc` | 4295 | `7a2bf30ec898bbc0e49d10dd639da8e18e5bae5913f868c0e05c81a1a26b8b13` |
| `scores/signal.abc` | 4038 | `99ec2f7633745412b01c1cfc1fc3c741f035b4a2c5e4d959d2ae693e26689733` |
| `library/README.md` | 6714 | `2339e200bfa35d2bfc1ec28745d914d381ccedc8b78392eb51b36639f6c58fd4` |
| `library/formats.md` | 9538 | `12caf909a415f392488b83dca6f13936733b2a4436daa7df0b6326a538a41536` |
| `library/product-fit.md` | 7212 | `3c7fe709105647b92cd881f947dd958c389035295f6fb89487476fb7e2018b55` |
| `library/techniques.md` | 20432 | `181fbe011ae69778a5a4e53ae10e98daf6bf061c55b16e8b44c1ee9d9f8b997f` |
| `library/languages/3d-object.md` | 2335 | `df7b540e602151387af462419ba00ea5133f4b66a46275be4982191a34e8a18b` |
| `library/languages/art-styles.md` | 1359 | `628c5a94285b53cd58f8203942c9ceeb7a4364326855a83a19cf6afff96ba965` |
| `library/languages/card-montage.md` | 3777 | `0cd6e5caad01738d41a9ba37ac9ae14bbbc2f896696b0a60bb57754e2608d476` |
| `library/languages/character.md` | 1963 | `0187538b564f5718e59652c3ec5066522b54404e299b024409ecab43ea8e58da` |
| `library/languages/continuous-morph.md` | 4492 | `ec261fb00859122320fa4a60e9c23ccb4862f1b1ce51f222d1d10fcbb4e64aab` |
| `library/languages/cursor-demo.md` | 4600 | `3d9cc40bfe891231cb601ebc2d75f8e575e42434d1c0b661310bdee1efd42768` |
| `library/languages/data-story.md` | 2060 | `72101951c0c6001c138886f92964252ba8af2f567cd3a57bb5ec9026c7d53d7b` |
| `library/languages/editorial-collage.md` | 1518 | `05423c1e4b27190c1621b879631846a36315e861d5368b665348b9963034ba0a` |
| `library/languages/flat-world.md` | 1234 | `29b9d635f63f27e8edcdeba6a9bed7597186d93ab14cd8d0344a47fcaa17cecd` |
| `library/languages/generative-field.md` | 1384 | `5539275e1e6d6c354999481ceb3dd2fcf6ac3aa7b6c72bbff22f5f296db3b564` |
| `library/languages/hand-drawn.md` | 1489 | `81749bdafd2ab5987984e71ec75ca86f2f4f77723418a749bb625e9acabe4256` |
| `library/languages/kinetic-type.md` | 3614 | `c7647d0e4893a39e2d8ef95fc3ba89ee4dabd2f3e84fd355150501e26f24d94f` |
| `library/languages/liquid-glass.md` | 1120 | `a1108a383ea7cbc63efa0062823d911717f8b623e3d9466db0277b3c9d7c3d89` |
| `library/languages/mechanism.md` | 1539 | `fb89085eabab7105bb7a96b192ead8a9eda27bfa091300240a693b1b74d69d39` |
| `library/languages/modular-grid.md` | 1726 | `a94a5256641b842d72cac87c7d8950d6efa1713839e8571cc19b66f0cb575545` |
| `library/languages/photo-led.md` | 1201 | `7b451709626a6da081a5ed2055705855c10a98bec1cd453e169abb9512d8db5a` |
| `library/languages/retro-digital.md` | 1076 | `28ee58df5753a0720c88a6cb6817c83c9c1a12cb159ff8e7abe8a479008b9f72` |
| `library/languages/showreel.md` | 2980 | `358df11aabe7c977c736d971e49b9508c4d69b1bb4b02216bf12884dfe6b5838` |
| `library/languages/system-diagram.md` | 1516 | `837cd2bfb4d1c93dc6f5d1a40d5974f514a841147bb1a2b555e028012abc9e71` |
| `library/languages/talking-head.md` | 473 | `6ca40ee1a4f85ac026dd1590150a39379a981f4f0d27ff1d11d5dbbf6660fb0b` |

## Rafraîchir

Retélécharger le dépôt à un nouveau commit dans un dossier temporaire, relire ce qui a changé (un document nouveau se lit en entier avant d'être repris), refaire ce tableau, reporter dans `SKILL.md` ce qui a bougé dans le leur, puis relancer `node outils/essai-musique.mjs` et `node outils/essai-competences.mjs`.
