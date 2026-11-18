# Ce que Dérush doit à d'autres

Dérush s'appuie sur le travail de beaucoup de monde. Voici ce qui est livré dans ce dépôt, ce qui est installé chez toi,
et sous quelle licence.

## Livré dans ce dépôt

| Quoi | Où | Auteur | Licence |
|---|---|---|---|
| Compétences « réseaux » (51) | `competences/` | Frank Heijdenrijk — social-media-skills/skills | MIT |
| Compétences « viral » (7) | `competences/` | Vyral — vyralcontent/content-skills | MIT |
| Compétences Instagram (13, `ig-…`) et YouTube (11, `yt-…`) | `competences/` | Jake Schincariol — instagram-agent-skill, youtube-agent-skill | MIT |
| Compétences ElevenLabs (7) | `competences/` | ElevenLabs — elevenlabs/skills | MIT |
| ffmpeg-skill et les compétences de montage (12) | `competences/` | kajisho5 | MIT |
| Compétences de montage trouvées dans l'annuaire skills.sh (31, plus les deux de la ligne suivante : montage, son, musique, motion design, formats ; liste dans `competences/LICENCES.md`) | `competences/` | calesthio, iart.ai, Melvyn Malherbe, Charlie Hills, Ethan Woo, Louise de Sadeleer, Digital Samba, Leonxlnx, Sri Nath, Agam More, edotheDev, Frank Heijdenrijk | MIT |
| `video-prompting` et `raccords-en-mouvement` | `competences/` | Square Zero Labs ; HeyGen, Inc. (HyperFrames) | Apache-2.0 |
| Compétence `motion-design` (les principes du mouvement : intention, rythme, courbes, chorégraphie) | `competences/` | LottieFiles — motion-design-skill | MIT |
| Compétence `derush-serie-animee` (une série animée en images générées, sans que le personnage change) | `competences/` | IABAI, d'après la méthode d'un article public de Movez (12 novembre 2026), réécrite | celle de Dérush |
| Compétence `sons-openverse` (chercher des sons libres, noter leurs crédits) | `competences/` | IABAI | celle de Dérush |
| Compétence `derush-viralite` (analyser une vidéo avant de la publier) | `competences/` | IABAI | celle de Dérush |
| Compétences `derush-createur` (dresser le profil d'un créateur) et `derush-publier` | `competences/` | IABAI | celle de Dérush |
| Logos des services | `public/logos/` | Simple Icons | CC0 1.0 (les marques restent à leurs détenteurs) |
| Polices Anton, Archivo Black, Bebas Neue, Montserrat, Playfair Display, Poppins (droits de chacune et texte de la licence dans `public/polices/LICENCES.md` et `OFL.txt`) | `public/polices/` | leurs auteurs, via Google Fonts | SIL Open Font License 1.1 |
| Police Permanent Marker | `public/polices/` | Font Diner, via Google Fonts | Apache 2.0 |
| Polices Geist, Geist Mono et Geist Pixel | `public/polices/` | The Geist Project Authors (Vercel), paquet npm `geist` 1.9.2 | SIL Open Font License 1.1 |
| Compétences `hyperframes`, `hyperframes-cli`, `hyperframes-registry` (adaptées : commande `derush-hyperframes`, sans télémétrie ni avis envoyés) | `competences/` | HeyGen, Inc. (HyperFrames 0.9.64) | Apache-2.0 |
| Compétences `bang-motion` (ouvertures, typographie animée, motion design) et `lottie` (animations Lottie) | `competences/` | Bang Tutorial ; Diffusion Studio Inc. | MIT |
| Compétence `styles-video` : 96 recettes de style et 3 guides face caméra (adaptés : en-tête et outils de Dérush, noms et index en français, liens vers des vidéos d'autres créateurs retirés) | `competences/styles-video/` | nexu-io, OpenDesign (OpenMotion, commit 2b57cf6) | Apache-2.0 |
| Icône d'HyperFrames | `public/logos/hyperframes.png` | HeyGen, Inc. (dépôt sous Apache-2.0) | montrée seulement pour dire quel moteur Dérush installe |
| Logo IABAI | `public/marque/` | IABAI / YABAÏ | tous droits réservés |

Le détail compétence par compétence (source, version, ce qui a été retiré) est dans
[competences/LICENCES.md](competences/LICENCES.md), avec le texte des licences dans `competences/licences/`.
Les logos et leurs règles d'usage sont décrits dans [public/logos/LISEZMOI.md](public/logos/LISEZMOI.md).

## Installé chez toi par Dérush (jamais livré ici)

| Quoi | Pour quoi | Licence |
|---|---|---|
| Remotion | Le moteur de rendu (animations, titres, sous-titres) | Licence Remotion : gratuit pour les particuliers et les structures de trois personnes au plus, licence payante au-delà — https://remotion.dev/license |
| Les bibliothèques du kit de rendu : three, @react-three/fiber, @react-three/postprocessing, animejs, konva, react-konva, lottie-web, planck, regl, scenejs, zdog, React | Animer, la 3D, les effets de lumière de la 3D | MIT |
| postprocessing (avec n8ao, maath, three-stdlib) | Les effets de lumière de la 3D | Zlib (n8ao : ISC ; maath, three-stdlib : MIT) |
| Rapier (@dimforge/rapier3d-compat) | La physique en 3D | Apache-2.0 |
| GSAP 3.15.1 (dans le kit de rendu) | Animer, pour les vidéos écrites par l'IA | Licence « Standard No-Charge » de Webflow : gratuite, aussi pour un usage commercial ; elle interdit de s'en servir pour un outil d'animation visuelle sans code qui concurrence Webflow — https://gsap.com/standard-license |
| Lucide (`lucide-react` 1.74.0, dans le kit de rendu) | Plus de 2 000 icônes | ISC ; les icônes reprises de Feather : MIT |
| L'effaceur de texte : onnxruntime 1.31.1, opencv-python-headless 4.14.0.94, le modèle LaMa (big-lama, port ONNX de Carve/LaMa-ONNX) | Effacer le texte incrusté d'un rush | MIT (onnxruntime) ; Apache-2.0 (OpenCV, LaMa) |
| yt-dlp 2026.10.26 (téléchargé au premier lien de « Comme cette vidéo ») | Télécharger une vidéo de référence depuis TikTok, Instagram ou YouTube, pour en étudier le style | The Unlicense ; l'exécutable autonome contient du code sous GPLv3+ |
| HyperFrames 0.9.64 (HeyGen), et ce qu'il installe (sharp, puppeteer-core…) | Le second moteur de rendu : des vidéos écrites en HTML, et environ 450 blocs | Apache-2.0 (son catalogue : Apache-2.0, quelques blocs MIT ou OFL) ; il embarque GSAP (licence de Webflow ci-dessus) |
| Compétences Remotion (remotion-dev/skills) | Les fiches que l'IA lit pour Remotion | Pas de licence de redistribution : téléchargées chez toi depuis leur dépôt officiel |
| Real SFX (Clipwing/skills), à la version examinée | Poser de vrais sons à l'image près | Scripts sous licence MIT ; sons d'interface uisfx : code MIT, sons CC0 (d'après son README). Fait par Alexander Korbanov |
| Earshot (Leonxlnx/earshot), facultatif | Écouter, choisir, fabriquer des sons, sur ton ordinateur | MIT (Leon Lin) ; ses modèles : CLAP (Apache-2.0), AST (BSD-3-Clause) |
| Whisper large-v3-turbo (MLX ou faster-whisper) | Le texte des vidéos, sur ton ordinateur | MIT |
| Demucs | Séparer la voix de la musique | MIT |
| FFmpeg | Lire, couper, encoder | LGPL / GPL selon la version installée |
| Blender (facultatif) | La 3D réaliste | GPL |
| uv | Installer les moteurs Python | MIT / Apache 2.0 |
| Claude Code | L'IA qui monte (compte Claude) | Conditions d'Anthropic |
| Codex | L'IA qui monte (compte ChatGPT) | Apache 2.0 (l'outil), conditions d'OpenAI (le service) |
| Antigravity CLI (commande `agy`) | L'IA qui monte (compte Google, Gemini) | Conditions de Google |

## Services en ligne (avec tes comptes)

ElevenLabs (son, voix, images, vidéos générées), Treg (publication sur les réseaux), Google Drive, et les réseaux
eux-mêmes (TikTok, YouTube, Instagram, LinkedIn) : chacun a ses conditions et ses tarifs. Dérush ne publie et ne génère
rien avec eux sans que tu le demandes.

Openverse (WordPress) sert à chercher des sons libres, sans compte. Les sons gardent la licence de leurs auteurs : Dérush
ne télécharge que le domaine public (CC0, marque du domaine public) et la licence CC BY, et note chaque crédit dans
`CREDITS.md`, dans ta bibliothèque de sons.
