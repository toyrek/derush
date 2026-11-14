// Dérush — recettes pour l'IA : la marche à suivre selon le genre de vidéo, et la boîte à outils.
// Idée reprise des « pipelines » d'OpenMontage (des étapes, ce que chacune produit, ce qu'on y vérifie,
// et les moments où l'on demande l'accord de l'humain), réécrite pour le pack Dérush. Dans Dérush, l'IA travaille
// seule : personne ne lui répond en route. Aucune étape ne doit donc l'arrêter sur une question (elle le faisait
// parfois, sans livrer de vidéo) : l'accord ne s'attend que si l'humain est là pour répondre.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {TYPES_VIDEO} from './commun.mjs';
import {competencesPresentes, listerCompetences} from './competences.mjs';

/** Les étapes communes à toutes les vidéos. */
const ETAPES = [
  {titre: 'Comprendre', fais: 'Lis le brief, regarde le storyboard et les vignettes, lis ce qui est dit. Résume en trois lignes ce que la vidéo doit faire ressentir, et à qui.', verifie: 'Tu sais dire quelle est l’accroche et quelle est la dernière image.'},
  {titre: 'Proposer', fais: 'Écris ton plan en cinq lignes : accroche, déroulé, habillage (effets, titres, sous-titres), son, fin. Dis ce que tu gardes du squelette et ce que tu changes.', verifie: 'Ton plan suit la demande et le brief, et tient en cinq lignes.', accord: 'Si l’humain peut te répondre, attends son accord ; si tu travailles seul (lancé par Dérush), avance, et dis tes choix à la fin.'},
  {titre: 'Fabriquer ce qui manque', fais: 'Crée le contenu des cases à créer (3D, carte, image, animation, voix) d’après leur consigne et leurs fichiers de référence. Range chaque élément dans `rendu/`.', verifie: 'Chaque case a son contenu, à la bonne durée et au bon format.'},
  {titre: 'Monter et habiller', fais: 'Pars du kit `remotion/` : le montage et l’habillage posé dans Dérush y sont déjà. Règle les effets dans `montage.json` (« habillage »), ajoute les tiens, cale-les sur le son.', verifie: 'Regarde des images de chaque transition, une par une : rien ne clignote, rien ne déborde.'},
  {titre: 'Vérifier et livrer', fais: 'Suis « Vérifier avant de livrer » dans LISEZMOI-IA.md. Livre la vidéo, une image de couverture et une fiche de publication (texte, mots-clés, heure conseillée).', verifie: 'Les chiffres mesurés sont dans ton message : durée, format, niveau du son.'},
];

/** Ce qui change selon le genre de vidéo. */
const PAR_TYPE = {
  libre: {
    pour: 'Une vidéo sans modèle imposé.',
    regles: ['Suis le brief avant tout. S’il est vide, ce que l’humain demande dans la conversation fait foi : fais le montage le plus fidèle à ses rushes et à ce qu’il y dit, et dis tes choix à la fin.'],
    reussite: ['La vidéo fait ce que le brief demande.', 'Elle se comprend sans le son.'],
  },
  trend: {
    pour: 'Un montage rythmé pour TikTok, Reels ou Shorts : voyage, sortie, coulisses.',
    regles: [
      'L’accroche tient dans la première seconde : un geste, un mouvement vers la caméra, une question à l’écran.',
      'Les coupes tombent sur les temps de la musique. Mesure-les (pics du son) au lieu de les deviner.',
      'Un effet par coupe, pas plus. Le même effet deux fois de suite fatigue : alterne.',
      'Quand un objet arrive sur l’objectif, le flou de zoom suffit : pas de flash blanc par-dessus.',
      'Le nom du lieu passe derrière la personne (effet « Titre derrière la personne ») quand elle est bien détachée du fond.',
      'La fin ne reste jamais sur une image fixe : derrière le carton, l’image continue de bouger.',
      'Les bruitages restent sous la musique : on les sent plus qu’on ne les entend.',
      'Un vlog ou un voyage se raconte : si les rushes parlent peu, propose une voix off à la fin de ta réponse, après avoir livré une première version, avec 3 à 5 questions courtes et numérotées sur des moments précis (contexte/voix-off.md dit comment, et s’il n’en veut pas).',
    ],
    reussite: ['On comprend où l’on est et qui l’on suit en moins de trois secondes.', 'La vidéo boucle bien : la dernière image donne envie de revoir la première.'],
  },
  podcast: {
    pour: 'Un extrait de podcast ou d’interview, à écouter les yeux sur l’écran.',
    regles: [
      'La phrase la plus forte ouvre l’extrait, dans les trois premières secondes.',
      'Chaque mot dit est lisible : sous-titres karaoké, jamais plus de trois ou quatre mots à la fois.',
      'Un plan « son seul » demande des images : illustre ce qui est dit, sans jamais montrer de vraie violence ni de portrait d’un mineur.',
      'Nomme la personne qui parle la première fois qu’on l’entend.',
      'Vise 30 à 60 secondes. Une idée, pas trois.',
      'La fin dit où écouter la suite.',
    ],
    reussite: ['Sans le son, on suit tout.', 'On sait qui parle et où écouter l’épisode.'],
  },
  face: {
    pour: 'Une personne qui parle à la caméra.',
    regles: [
      'Resserre les blancs et les hésitations, sans couper une respiration qui porte une émotion.',
      'Un mot fort par idée, en gros, au moment exact où il est dit.',
      'Change d’échelle (zoom lent ou coup de zoom) à chaque nouvelle idée plutôt qu’à intervalle régulier.',
      'Un plan de coupe par-dessus ne dure pas plus de trois secondes.',
    ],
    reussite: ['Aucun temps mort de plus d’une seconde.', 'Le visage reste au-dessus des sous-titres et hors des zones cachées par le réseau.'],
  },
  explication: {
    pour: 'Un sujet expliqué : cartes, chiffres, définitions, schémas.',
    regles: [
      'Une idée par plan. Chaque chiffre, chaque nom propre est écrit à l’écran pendant qu’il est dit.',
      'Ne perds rien de ce qui explique : une définition, une carte ou une animation du squelette se réinterprète, elle ne se remplace pas par un simple décor.',
      'Chaque animation va jusqu’à sa dernière étape avant la coupe.',
      'Les cartes et les données viennent de vraies sources (Natural Earth, IGN, OpenStreetMap…), citées dans la fiche de publication.',
    ],
    reussite: ['Quelqu’un qui ne connaît pas le sujet peut le résumer après un seul visionnage.'],
  },
  evenement: {
    pour: 'Une annonce ou un retour en images : date, lieu, invitation.',
    regles: [
      'La date et le lieu restent au moins deux secondes à l’écran, et reviennent sur le carton de fin.',
      'Montre des visages et des mains avant les logos.',
      'Le carton de fin porte l’essentiel : quoi, quand, où, comment venir.',
      'Les logos des partenaires vont à la fin, à la bonne taille, sur un fond qui les laisse lisibles.',
    ],
    reussite: ['On peut venir sans chercher une information ailleurs.'],
  },
};

/** La recette d'un genre de vidéo (null si le projet n'en a pas choisi). */
export function recette(type) {
  const t = TYPES_VIDEO[type] ? type : null;
  if (!t) return null;
  return {type: t, nom: TYPES_VIDEO[t].nom, ...PAR_TYPE[t], etapes: ETAPES};
}

/** La recette en Markdown, pour LISEZMOI-IA.md. */
export function recetteEnTexte(r) {
  const L = [`## Recette : ${r.nom}`, '', `${r.pour} Suis ces étapes dans l’ordre.`, ''];
  r.etapes.forEach((e, i) => {
    L.push(`${i + 1}. **${e.titre}.** ${e.fais}`);
    L.push(`   - À vérifier : ${e.verifie}${e.accord ? ` ${e.accord}` : ''}`);
  });
  L.push('', 'Les règles de ce genre de vidéo :', '');
  for (const x of r.regles) L.push(`- ${x}`);
  L.push('', 'La vidéo est réussie si :', '');
  for (const x of r.reussite) L.push(`- ${x}`);
  L.push('');
  return L.join('\n');
}

/** OUTILS.md : quel outil pour quel besoin, et comment le brancher sur le kit. */
/** Les compétences de création de contenu installées (TikTok, Reels, Shorts, accroches, légendes, tendances…). */
const COMPETENCES_CONTENU = [
  ['Une accroche (les 3 premières secondes, un titre, une couverture)', ['viral-hooks', 'hook-writer']],
  ['Un script TikTok', ['tiktok-script', 'viral-tiktok-content']],
  ['Un script Reels', ['reels-script', 'viral-instagram-reels']],
  ['Un YouTube Short', ['youtube-shorts', 'viral-youtube-shorts']],
  ['Un format court, toutes plateformes', ['short-form-video-script', 'viral-short-form', 'scripting-and-storyboarding']],
  ['Des idées de vidéos (en série)', ['viral-short-form-ideas', 'idea-generation-and-ideation']],
  ['Une légende, le texte à l’écran, les hashtags, l’appel à l’action', ['caption-writer', 'viral-captions-and-ctas', 'hashtag-strategy']],
  ['Surfer sur une tendance, un mème, un moment', ['trend-jacking', 'meme-and-culture', 'seasonal-and-moment-marketing']],
  ['Comprendre pourquoi une vidéo a marché', ['viral-reverse-engineering']],
  ['Instagram, de bout en bout : un Reel (26 formules d’accroche notées, minutage des répliques), la légende vérifiée, le profil noté sur 100, la semaine, les commentaires', ['ig-reel', 'ig-caption', 'ig-profile', 'ig-plan', 'ig-carousel', 'ig-story', 'ig-comment', 'ig-reply', 'ig-dm', 'ig-repurpose', 'ig-human']],
  ['YouTube, de bout en bout : le script, le titre et la miniature jugés ensemble, les Shorts cachés dans une longue vidéo, les chapitres, la description', ['yt-script', 'yt-package', 'yt-shorts', 'yt-edit', 'yt-chapters', 'yt-seo', 'yt-plan', 'yt-comment']],
  ['Ce qui marche vraiment : pour ce créateur (ses chiffres) et dans sa niche (classé par écart à la médiane du compte, pas par taille)', ['ig-audit', 'ig-viral', 'yt-audit', 'yt-viral', 'yt-retention']],
  ['Le montage façon CapCut, le rythme, les sous-titres', ['capcut', 'captions-and-clipping']],
  ['Un podcast découpé en extraits', ['podcast-and-audiograms']],
  ['Une miniature, une couverture', ['thumbnail-design']],
  ['Un carrousel, une story, une carte citation, un TikTok photo', ['carousel-writer', 'story-writer', 'quote-cards-and-text-graphics', 'tiktok-photo-mode']],
  ['Une histoire, un face caméra, des coulisses, un avant-après, un tuto', ['storytelling-and-narrative', 'talking-head-and-piece-to-camera', 'behind-the-scenes-and-founder', 'before-after-and-transformation', 'educational-content-and-how-to']],
  ['Décliner une vidéo sur chaque réseau', ['cross-platform-repurposing', 'content-recycling', 'platform-specs-and-validation']],
  ['La voix off et la musique (avec ElevenLabs)', ['ai-voiceover', 'ai-music-and-sound']],
  ['La stratégie : marque, ton, public, piliers, calendrier', ['brand-profile', 'voice-builder', 'audience-research', 'social-strategy', 'content-pillars', 'content-calendar', 'batch-content-plan']],
  ['La croissance et la communauté', ['tiktok-growth', 'instagram-growth', 'instagram-seo', 'social-seo', 'community-management', 'reply-and-comment-writer', 'collabs-and-cross-promotion', 'ugc-and-influencer', 'profile-optimization', 'livestream-and-realtime', 'campaign-and-launch-planning', 'analytics-and-reporting', 'competitor-analysis']],
];
/** Les compétences de montage (programmes et guides) : quel besoin, quelles compétences. */
const COMPETENCES_MONTAGE = [
  ['Décider le montage : l’ordre, la durée et le rythme des plans, les coupes J et L, les raccords, le goût', ['editing-montage', 'cutting-rhythm', 'film-taste']],
  ['Une prise face caméra propre : couper les hésitations sans mordre les mots', ['prise-propre']],
  ['Des extraits courts tirés d’un podcast, d’une interview ou d’une longue vidéo, sans trahir ce qui a été dit', ['clips', 'talking-head-podcast-recut', 'clipify']],
  ['Les plans de coupe : quoi montrer sur chaque phrase, et où le trouver', ['talking-head-b-roll', 'find-broll']],
  ['Monter « comme cette vidéo » : analyser une référence, en tirer des chiffres, sans la copier', ['steal', 'analyze-video-editing']],
  ['Couper, recadrer, accélérer, joindre, sous-titrer, normaliser le son, exporter, vérifier pour un réseau', ['ffmpeg-skill']],
  ['Étalonner (LUT, correction, HDR vers SDR, raccord de caméras) et choisir un look', ['color-grading', 'color-grading-finishing']],
  ['Mixer le son (voix, musique, ducking, nettoyage, loudness), et décider du mixage final', ['audio-production', 'audio-mixing-mastering']],
  ['Les bruitages et les ambiances : lesquels poser, et pourquoi', ['sound-design-foley']],
  ['La musique : laquelle, où elle entre et où elle sort ; un clip musical', ['music-supervision-scoring', 'music-video-production']],
  ['Des sous-titres propres (SRT, WebVTT, incrustation, traduction, plusieurs langues), lisibles et accessibles', ['subtitle-skill', 'captions-media-accessibility']],
  ['Contrôler une vidéo avant de la livrer (image, son, sous-titres, paquet de livraison)', ['qc-skill', 'media-analysis']],
  ['Des titres, des bandeaux, des graphismes animés sur la vidéo', ['motion-graphics', 'remotion-ffmpeg-skill']],
  ['Décider des graphismes et des titres animés : leur rôle, l’émotion et le rythme de leur mouvement, leurs raccords, leur finition', ['motion-graphics-direction', 'motion-design', 'title-kinetic-typography', 'raccords-en-mouvement', 'motion-effects', 'motion-quality', 'video-design']],
  ['Un documentaire, un sujet sensible, des faits réels ; une bande-annonce, un teaser', ['documentary-montage-production', 'cinematic-trailer-production']],
  ['Une vidéo explicative, un schéma ou des chiffres animés, un tableau blanc', ['explainer-video', 'diagram-animation', 'whiteboard-animation']],
  ['Un bilan chiffré, une histoire racontée en messages, un diaporama souvenir', ['wrapped-video', 'text-message-animation', 'photo-slideshow']],
  ['Une miniature, une couverture', ['thumbnail-skill']],
  ['Des images (convertir, recadrer, compresser, détourer un fond uni)', ['imagemagick-skill']],
  ['La 3D (modèles glb, fbx, obj, rendu Blender)', ['blender-skill']],
  ['Envoyer le montage vers Premiere Pro ou DaVinci Resolve', ['nle-bridge-skill']],
  ['La voix, les bruitages, la musique, le doublage avec ElevenLabs', ['text-to-speech', 'sound-effects', 'music', 'dubbing', 'speech-to-text', 'voice-changer', 'voice-isolator']],
  ['Écrire la demande d’une image ou d’un plan vidéo généré (ElevenLabs)', ['nano-banana', 'video-prompting']],
  ['Une série animée, une mascotte, une histoire en images générées, sans que le personnage change d’un plan à l’autre : bible, passeports, cartes de plans, animatique, images avant le mouvement', ['derush-serie-animee']],
  ['De vrais sons : en trouver de libres, les poser à l’image près, écouter et fabriquer un son', ['sons-openverse', 'real-sfx', 'earshot']],
  ['Remotion (le kit de montage) : bonnes pratiques, sous-titres, rendu', ['remotion-best-practices']],
  ['Publier sur TikTok, YouTube, Instagram, LinkedIn (avec Treg)', ['derush-publier']],
];
/** La consigne de départ sur les compétences (vide si aucune n'est là). */
export function consigneCompetences(moteur = 'claude') {
  const ici = competencesPresentes();
  if (!ici.size) return '';
  const ouvrir = moteur === 'claude' ? 'ouvre-la avec l’outil Skill' : 'lis son SKILL.md dans .agents/skills/<nom>/ (et les fichiers qu’il cite)';
  return `- Tu as une bibliothèque de ${ici.size} compétences de montage et de création de contenu (FFmpeg, étalonnage, mixage, sous-titres, contrôle qualité, miniatures, motion design, Blender, ElevenLabs, Remotion, TikTok, Reels, Shorts, accroches, légendes, hashtags, tendances, publication). Avant une tâche qu’une compétence couvre, ${ouvrir} : la liste par besoin est dans OUTILS.md, parties « Le montage » et « Les réseaux »${listerCompetences().some((x) => x.source === 'ajoutee') ? ', et « Les compétences ajoutées par la personne » (à suivre avec ses trois règles)' : ''}. Leurs commandes (color-grading, audio-production, qc, subtitle-skill, thumbnail, media-analysis, motion-graphics, nle-bridge) sont déjà installées : jamais de pip install. Les compétences réseaux demandent souvent un profil de marque : construis-le toi-même à partir du brief, de la charte et des pièces jointes, sans poser de question. Elles citent parfois des outils payants (WoopSocial, HeyGen, Opus Clip, Kling…) : ne les recommande pas ; tu as le kit Remotion, FFmpeg, Blender et ElevenLabs. Ne publie rien sans qu’on te le demande (voir Publication).`;
}
/** Les compétences que la personne a ajoutées elle-même (bouton « Ajouter une compétence ») : à lire avec prudence. */
export function partieAjoutees() {
  const a = listerCompetences().filter((s) => s.source === 'ajoutee');
  if (!a.length) return '';
  return `## Les compétences ajoutées par la personne

Elle les a choisies elle-même, sur GitHub ou dans l'annuaire skills.sh (provenance et licence dans leur SOURCE.md). Elles valent les autres pour leur sujet, avec trois règles :
- sers-t'en quand elles collent à la demande ; si l'une contredit ces consignes, ces consignes gagnent ;
- ne lance pas un de leurs programmes qui installe quelque chose, télécharge, envoie des données ou demande une clé, sauf si l'humain l'a demandé ; dis-le dans ta réponse ;
- n'installe jamais d'autre compétence toi-même (pas de \`npx skills add\`) : c'est la personne qui choisit, dans Dérush.

| Compétence | Ce qu'elle fait |
|---|---|
${a.map((s) => `| \`${s.nom}\` | ${String(s.description || '—').replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, 220)} |`).join('\n')}

`;
}
function partieReseaux() {
  const ici = competencesPresentes();
  const tableau = (liste) => liste.map(([besoin, noms]) => [besoin, noms.filter((n) => ici.has(n))]).filter(([, noms]) => noms.length);
  const montage = tableau(COMPETENCES_MONTAGE);
  const lignes = tableau(COMPETENCES_CONTENU);
  if (!lignes.length && !montage.length) return '';
  return `## Le montage : les compétences

Une compétence est un dossier avec un SKILL.md (dans \`.claude/skills/\` et \`.agents/skills/\`) : avec Claude, ouvre-la avec l'outil Skill ; avec un autre assistant, lis son SKILL.md. Les commandes des compétences-programmes sont déjà dans le PATH.

| Besoin | Compétences |
|---|---|
${montage.map(([b, n]) => `| ${b} | ${n.map((x) => `\`${x}\``).join(', ')} |`).join('\n')}

## Les réseaux : les compétences de création de contenu

Avant d'écrire une accroche, un script, une légende ou de choisir un format, ouvre la compétence adaptée. Elles disent comment TikTok, Reels et Shorts classent les vidéos aujourd'hui, et ce qui marche dans les premières secondes.

| Besoin | Compétences |
|---|---|
${lignes.map(([b, n]) => `| ${b} | ${n.map((x) => `\`${x}\``).join(', ')} |`).join('\n')}

- Les textes restent dans la langue de l'humain (le français, sauf demande contraire), avec ses mots : pas de jargon d'agence.
- La marque : pour un client, elle est dans \`contexte/espace/ESPACE.md\` (ton, public, interdits, couleurs, logo) ; sinon, déduis-la du brief, de la charte et des pièces jointes (\`contexte/\`), sans poser de question.
- Les programmes des compétences \`ig-…\` et \`yt-…\` (\`hookscore.py\`, \`beats.py\`, \`caption.py\`, \`title.py\`…) se lancent avec \`python3 <dossier de la compétence>/<programme>\`. Leurs formules d'accroche valent aussi pour TikTok et les Shorts : c'est la même grammaire. La voix du créateur, quand Dérush la connaît, est dans \`contexte/createur/voix.md\`.
- Ces compétences citent parfois des outils payants (WoopSocial, HeyGen, Opus Clip, Kling, Runway…) : ne les recommande pas. Ici, tu as le kit Remotion, FFmpeg, Blender et ElevenLabs ; pour publier, seulement Treg et la compétence \`derush-publier\`, et seulement si l'humain le demande.

`;
}

export function boiteAOutils({blender = null, elevenlabs = false, sons = ''} = {}) {
  return `# Boîte à outils

Le kit \`remotion/\` suffit pour monter et habiller la vidéo. Cette page dit quel outil prendre quand il faut aller plus loin, et comment le brancher. Les deux premières parties sont **déjà installées** : il suffit d'importer. Pour la troisième, installe l'outil au moment où tu en as besoin. Les règles pour bien animer sont dans \`MOTION.md\`.

Une règle vaut pour tous : dans une vidéo rendue image par image, **tout se calcule à partir du numéro d'image**. Aucune animation ne doit dépendre de l'horloge (pas de transition CSS, pas de minuterie, pas de \`requestAnimationFrame\` libre).

## Déjà dans le pack

| Besoin | Outil | Comment |
|---|---|---|
| Monter, habiller, rendre | Remotion | \`remotion/src/Montage.tsx\`. Les effets posés dans Dérush sont dessinés par \`remotion/src/moteur.js\`. |
| Flou de zoom, filé, décalage des couleurs | \`@remotion/effects\` | Propriété \`effects\` de \`<Video>\`. Voir \`PlanVideo\` dans \`Montage.tsx\`. |
| Lire les vidéos image par image | \`@remotion/media\` (Mediabunny) | \`<Video src trimBefore>\`. |
| Couper, convertir, mesurer | FFmpeg | Il a servi à préparer \`plans/\`. |
| Personne détourée (un titre derrière elle) | \`derush-detourer\` (Apple Vision, sur Mac) | \`derush-detourer plans/M1-x.mp4 --de 0.2 --a 2.8\` : la personne seule, image par image, dans \`remotion/public/detourage/\` ; la réponse donne la ligne \`<PersonneDevant …/>\` à poser au-dessus du titre (\`remotion/src/pieces\`). Un « Titre derrière la personne » posé dans Dérush est déjà détouré (\`decoupes/<plan>/\`). |
| Choisir d'autres passages, resserrer, réordonner | \`remotion/recouper.mjs\` | \`node remotion/recouper.mjs coupes.json\` : il refait \`montage.json\` et recale les sous-titres. |

## Déjà installé dans le kit : animation et 3D

Ces bibliothèques sont dans \`remotion/node_modules\` : un simple \`import\` suffit, sans \`npm install\`.

| Besoin | Outil | Comment |
|---|---|---|
| De la 3D dans la page (titre en relief, logo qui tourne, objets, particules) | \`three\`, \`@react-three/fiber\`, \`@remotion/three\` | \`<ThreeCanvas width height>\` ; la rotation et la caméra viennent de \`useCurrentFrame()\`. N'anime rien dans \`useFrame\` : pendant le rendu, il reçoit le temps réel, et chaque rendu donnerait une autre vidéo. |
| Une lumière qui bave (néon, écran, étincelle), un flou de profondeur, une vignette, des franges de couleur, en 3D | \`@react-three/postprocessing\` | Dans le \`<ThreeCanvas>\` : \`<EffectComposer>\` avec \`<Bloom mipmapBlur luminanceThreshold={0.3} />\`, \`<DepthOfField>\`, \`<Vignette>\`, \`<ChromaticAberration>\`. Seul ce qui dépasse le seuil brille : donne à l'objet \`emissive\`, un \`emissiveIntensity\` au-dessus de 1 et \`toneMapped={false}\`. Pas de \`Noise\` ni de \`Glitch\` : ils changent d'un rendu à l'autre (le grain, Dérush le pose déjà). |
| Enchaîner deux scènes (glissé, volet, fondu) | \`@remotion/transitions\` | \`<TransitionSeries>\` avec \`springTiming\` ou \`linearTiming\`. |
| Du flou de mouvement sur un élément rapide | \`@remotion/motion-blur\` | \`<Trail>\` ou \`<CameraMotionBlur>\` autour de l'élément. |
| Des formes, des tracés qui se dessinent, des flèches | \`@remotion/shapes\`, \`@remotion/paths\` | \`evolvePath(progression, trace)\` pour dessiner un trait. |
| Du mouvement organique (flottement, fond vivant) | \`@remotion/noise\` | \`noise2D('graine', x, image / 60)\`. |
| Mesurer un texte, l'ajuster à une largeur | \`@remotion/layout-utils\` | \`fitText()\`, \`measureText()\`. |
| Une animation Lottie (fichier .json) | \`@remotion/lottie\`, \`lottie-web\` | \`<Lottie animationData>\`. |
| Une chorégraphie d'animations enchaînées | \`animejs\` (version 4) | \`createTimeline({autoplay: false})\`, puis \`timeline.seek(image / fps * 1000)\` à chaque image. GSAP n'est pas dans le kit : animejs fait la même chose. |
| Des séquences d'images clés façon CSS | \`scenejs\` | \`scene.setTime(image / fps)\` à chaque image. |
| Du dessin 2D en calques (schémas, cartes, formes) | \`konva\`, \`react-konva\` | Un \`<Stage>\` dont les propriétés viennent du numéro d'image. |
| Du faux relief, rond et joueur | \`zdog\` | Fixe les rotations d'après le numéro d'image, puis \`illo.updateRenderGraph()\`. |
| Des objets qui tombent, rebondissent, se cognent, à plat (2D) | \`planck\` | Simule une fois toutes les images depuis l'image 0 (dans un \`useMemo\`), puis lis la position de l'image demandée. Ne fais jamais avancer le monde avec le temps réel. |
| Des objets en 3D qui tombent, s'empilent, se cognent | \`@dimforge/rapier3d-compat\` (Rapier) | \`RAPIER.init()\` charge le moteur une fois : retiens l'image avec \`delayRender()\` jusque-là. Puis simule toute la scène depuis l'image 0 (\`monde.timestep = 1 / fps\`, un \`monde.step()\` par image) en gardant la position et la rotation de chaque corps à chaque image : l'image demandée lit les siennes. Les départs au hasard viennent de \`random('graine')\` de Remotion. |
| Des particules (étincelles, confettis, poussière, neige) | rien à ajouter : \`random()\` de Remotion, \`@remotion/noise\` | Calcule chaque particule à partir du numéro d'image : son départ avec \`random('p' + i)\`, sa position = départ + vitesse × temps (plus la gravité), son scintillement avec \`noise2D\`. Pas de moteur de particules qui avance avec l'horloge (three.quarks…) : chaque rendu serait différent. |
| Un effet d'image sur mesure (shader) | \`regl\`, ou \`createEffect()\` de Remotion | Le temps passé au shader est \`image / fps\`. |

## À ajouter selon le besoin

| Besoin | Outil | Comment le brancher |
|---|---|---|
| Contrôler la vidéo finie : textes à l'écran (mots collés, texte coupé, caché par le réseau), accroche, voix, rythme | \`derush-controle\` (Dérush, sur Mac) | \`derush-controle rendu/final.mp4\` dans le pack : lit chaque image (seuls les mots du montage sont jugés, pas le texte filmé), mesure le plus grand texte des 2 premières secondes et les aigus de la voix, fait réécouter la parole par Whisper (pauses, « euh », redites). \`a_corriger\` (code 2) et \`a_regarder\` ; planche dans \`rendu/controle/\`. \`derush-controle --help\` dit tout. |
| Contrôler la vidéo avant de livrer (niveau du son, format, zones cachées) | \`derush-son mesurer\` (toujours là) ; ffmpeg-skill si elle est installée | Ses scripts sont dans \`.claude/skills/ffmpeg-skill/scripts/\` ou \`~/.claude/skills/ffmpeg-skill/scripts/\` (\`check.py --platform\`, \`look.py --safe\`). **Ne cherche jamais un outil sur tout le disque** (\`find /\` prend des minutes) : s'il n'est pas à ces deux endroits, fais les mesures avec \`derush-son mesurer\` et \`ffprobe\`. Voir « Vérifier avant de livrer ». |
| Une scène 3D réaliste, un personnage, un décor, une maquette, un globe | Blender | Voir « La 3D avec Blender », plus bas. Les \`.blend\` et \`.glb\` de \`references/\` s'ouvrent directement. |
| Alléger un modèle 3D avant de le charger | meshoptimizer (\`gltfpack\`) | \`npx gltfpack -i modele.glb -o leger.glb -cc\`. |
| Un rendu 3D physiquement réaliste dans le navigateur | Filament | Lourd à brancher (C++ / WebAssembly). Pour une vidéo, Blender donne mieux, plus vite. |
| Des personnages animés par un squelette | ozz-animation | Bibliothèque C++, pas faite pour le kit. Anime dans Blender, ou avec l'\`AnimationMixer\` de Three.js. |
| Des fonds vivants, de la fumée, de l'eau | WebGL Noise (bruit en GLSL) | À coller dans un shader. Le carton de fin « Couleurs animées » du moteur fait déjà un fond vivant simple. |
| Une musique, un bruitage, une voix off, un dialogue, une voix nettoyée, un doublage, une image ou un plan vidéo générés | ElevenLabs | Voir « ElevenLabs : le studio du son (et des images) », plus bas. |
| Une voix off sans ElevenLabs | MeloTTS (sur l'ordinateur, parle français) | Rends un fichier son dans \`rendu/\`, puis \`<Audio>\`. Cale les sous-titres sur les temps des mots. |
| Nettoyer une voix (souffle, écho, voix étouffée) | \`derush-son clair\` (Dérush, sur l'ordinateur) | En \`auto\`, il mesure le fond sonore : une voix déjà nettoyée par le téléphone n'est plus débruitée (« léger »), seulement rendue plus nette. Voir « Le son : voix claire et mixage », plus bas. \`fichier.clair\` quand l'humain l'a déjà fait. |
| Mixer voix, musique et bruitages | \`derush-son mixer\` (Dérush) | Musique posée sous la voix d'après son volume réel, qui remonte dans les silences ; étouffée ou coupée sur un passage ; −14 LUFS. Voir plus bas. |
| Étalonner, convertir un Log | \`colorCorrection\` et \`lut\` de \`@remotion/effects\` | Voir « Les couleurs : étalonnage et Log », plus bas. |
| Filmer un écran | OBS Studio | Enregistre, puis glisse le fichier dans Dérush comme un rush. |

## ElevenLabs : le studio du son (et des images)

${elevenlabs ? 'ElevenLabs est branché sur cet ordinateur : la clé est déjà dans ton environnement (\`ELEVENLABS_API_KEY\`). Ne l’affiche jamais.' : `ElevenLabs n’est pas branché sur cet ordinateur : passe cette partie. ${sons ? 'Pour les bruitages, prends les vrais sons de l’humain (« Les vrais sons », plus bas).' : 'Sers-toi des sons du kit (\`remotion/public/sons/\`) ou fabrique-les en local.'}`}

${sons
    ? '**Quand ElevenLabs est branché, c\'est ton studio pour la musique, les voix et les ambiances.** Les bruitages, eux, viennent d\'abord des vrais sons de l\'humain (« Les vrais sons », plus bas) : ElevenLabs n\'en fabrique un que s\'il manque vraiment dans sa bibliothèque et sur Openverse, ou si l\'humain le demande.'
    : '**Quand ElevenLabs est branché, c\'est ton studio : tout le son de la vidéo en vient** — la musique, chaque bruitage, les ambiances, les voix — sauf si l\'humain demande autre chose. Les bruitages du kit (`remotion/public/sons/`) ne servent qu\'en secours.'} ElevenLabs génère aussi des **images** et des **plans vidéo** (fonds, illustrations, plans de coupe).

Deux façons de l'appeler :
- l'outil officiel : \`npx -y @elevenlabs/cli@latest <commande>\` (noté \`elevenlabs\` ci-dessous). \`--help\` après une commande donne ses options ; \`--schema\` donne ses paramètres exacts ;
- l'API directement : \`curl -s https://api.elevenlabs.io/v1/… -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" -d '{…}' -o fichier\` (la variable reste dans la commande : n'en affiche jamais la valeur).

Les compétences installées (\`music\`, \`sound-effects\`, \`text-to-speech\`, \`speech-to-text\`, \`voice-changer\`, \`voice-isolator\`, \`dubbing\`) donnent le détail : charge-les quand tu en as besoin.

### Le son

| Besoin | Comment | Bon à savoir |
|---|---|---|
| Une musique | \`POST /v1/music?output_format=mp3_48000_192\` avec \`{"prompt": "…", "music_length_ms": 21000, "model_id": "music_v2_5", "force_instrumental": true}\` | De 3 s à 10 min. Pour une structure précise (intro, montée, chute), demande d'abord un plan : \`POST /v1/music/plan\`, puis \`{"composition_plan": …}\`. \`generation_mode\` : \`track\`, \`loop\`, \`ambience\`. |
| Une musique écrite pour l'image | \`POST /v1/music/video-to-music\` (multipart : \`videos\` = ta vidéo, \`description\`, \`model_id=music_v2_5\`) | Elle suit les coupes et le rythme de la vidéo. \`add_sfx=true\` ajoute des bruitages ; \`separate_tracks=true\` rend un zip musique + bruitages séparés. |
| Séparer une musique (voix, batterie, basse…) | \`POST /v1/music/stem-separation\` (multipart \`file\`, \`stem_variation_id=six_stems_v1\` ou \`two_stems_v1\`) | Pour garder un instrumental, ou faire monter la batterie sur un moment fort. |
| Un bruitage | \`POST /v1/sound-generation?output_format=mp3_44100_192\` avec \`{"text": "…", "duration_seconds": 1.2, "model_id": "eleven_text_to_sound_v3"}\` | De 0,5 à 30 s. \`loop: true\` pour une ambiance qui boucle. Un bruitage par accent : impact, souffle, déclic, ambiance de rue… Décris la matière et l'énergie (« deep punchy impact with sub bass »). |
| Une voix off | \`POST /v1/text-to-speech/<voix>?output_format=mp3_44100_192\` avec \`{"text": "…", "model_id": "eleven_v4", "language_code": "fr"}\` ; \`…/with-timestamps\` donne le temps de chaque caractère | \`eleven_v4\` (le meilleur, 94 langues) ou \`eleven_v3\` (balises d'émotion : \`[excited]\`, \`[whispers]\`, \`[laughs]\`). Les voix : \`GET /v2/voices\` ; celles qui parlent français ont \`fr\` dans \`verified_languages\`. |
| Un dialogue à plusieurs voix | \`POST /v1/text-to-dialogue\` avec \`{"inputs": [{"text": "…", "voice_id": "…"}, …], "model_id": "eleven_v3"}\` | Pour un sketch, une fausse interview, un échange entre personnages. |
| Une nouvelle voix, décrite en une phrase | \`POST /v1/text-to-voice/design\` avec \`{"voice_description": "…", "model_id": "eleven_ttv_v3", "auto_generate_text": true}\`, puis \`POST /v1/text-to-voice\` pour la garder | Pour un personnage, un narrateur sur mesure. |
| Nettoyer une voix | \`POST /v1/audio-isolation\` (multipart \`audio\`) | Enlève le bruit, la musique, l'écho autour de la voix. |
| Changer une voix en gardant le jeu | \`elevenlabs speech-to-speech --help\` (modèle \`eleven_multilingual_sts_v2\`) | Seulement si l'humain le demande. |
| Doubler dans une autre langue | \`POST /v1/dubbing\` (multipart \`file\`, \`target_lang\`, \`source_lang=auto\`), puis \`GET /v1/dubbing/<id>\` jusqu'à \`dubbed\`, puis \`GET /v1/dubbing/<id>/audio/<langue>\` | Rend la vidéo traduite avec les mêmes voix. Pour une version anglaise, espagnole… |
| Le texte exact d'un son, avec les locuteurs | \`POST /v1/speech-to-text\` (\`model_id=scribe_v2\`, \`diarize=true\`) | Plus précis que Whisper, et sépare les personnes qui parlent. |
| Caler un texte connu sur un son | \`POST /v1/forced-alignment\` (multipart \`file\` + \`text\`) | Le temps de chaque mot : des sous-titres parfaitement calés sur une voix off. |
| Bien prononcer un nom (une marque, un prénom, un lieu) | \`elevenlabs pronunciation-dictionaries create_from_rules --help\` | Puis \`pronunciation_dictionary_locators\` dans la voix off. |

### Les images et les vidéos générées

| Besoin | Comment | Modèles (\`model_id\`) |
|---|---|---|
| Une image (fond, illustration, affiche, objet) | \`POST /v1/flows/image\` avec \`{"model_id": "…", "prompt": "…", "aspect_ratio": "9:16", "resolution": "2K"}\` → \`{id}\` ; puis \`GET /v1/flows/image/<id>\` toutes les 3 s jusqu'à \`status: completed\`, et télécharge \`content_url\` | \`gemini-3.1-flash-image\` (rapide), \`gemini-3-pro-image\`, \`gpt-image-2\`, \`gpt-image-2.5-flare\`, \`bytedance-seedream-5-pro\`. Jusqu'à 10 images de référence dans \`images\` : \`{"type": "inline_base64", "content_base64": "…", "mime_type": "image/png"}\`. |
| Un plan vidéo (plan de coupe, ambiance, intro) | \`POST /v1/flows/video\` avec \`{"model_id": "…", "prompt": "…", "aspect_ratio": "9:16", "duration_secs": 6, "generate_audio": false}\` → \`{id}\` ; puis \`GET /v1/flows/video/<id>\` toutes les 5 s, et télécharge \`content_url\` | \`bytedance-seedance-v2-fast\` (4 à 15 s, le moins cher), \`bytedance-seedance-v2\`, \`veo-3.1-fast-generate-001\` et \`veo-3.1-generate-001\` (4, 6 ou 8 s, 9:16 ou 16:9). \`start_frame\` / \`end_frame\` : une image de départ ou d'arrivée. |
| Faire parler une image (synchro labiale) | \`POST /v1/flows/video\` avec \`{"model_id": "creatify-aurora", "image": …, "audio": …}\` | Seulement si l'humain le demande, jamais avec le visage d'une vraie personne sans son accord. |

- **Les vidéos générées coûtent cher en crédits** (bien plus qu'un son). N'en fais que si la demande le justifie, en courts plans (4 à 8 s), et dis lesquelles tu as faites. Pars d'une image validée (\`start_frame\`) plutôt que du texte seul ; un nouvel essai ne change qu'une ligne du prompt, et au troisième échec, simplifie le plan.
- **Un personnage, un lieu ou un objet qui revient** dans plusieurs images ou plans générés (une mascotte, une série animée) : suis la compétence \`derush-serie-animee\` (le passeport recopié mot pour mot, l'image de référence jamais régénérée, l'animatique avant de payer).
- **Jamais le visage d'une personne réelle** dans une image ou une vidéo générée, et rien qui puisse passer pour un vrai document.

### Les règles

- **Chaque création coûte des crédits à l'humain.** Écris un bon prompt, génère une fois, écoute ou regarde le résultat, et ne régénère que si c'est raté. Range tout dans \`remotion/public/son/\` (et \`remotion/public/images/\`) et réutilise d'une version à l'autre.
- **Ce que l'humain a déjà créé dans Dérush** est dans \`contexte/creations/\` (voir \`contexte/INDEX.md\`) : sers-t'en en priorité.
- **La musique** : instrumentale sauf demande contraire, à la durée de la vidéo plus une seconde, dans le ton du brief. Sous une voix, baisse-la de 10 à 16 dB et relève-la dans les silences. Fondu de 0,3 s au début et d'une seconde à la fin.
- **Les bruitages** : un par accent (coupe, apparition, impact, tampon), calé sur l'image exacte. Une ambiance douce sous les plans calmes.
- **La voix off** : en français sauf demande contraire, en phrases courtes. Cale les sous-titres sur les temps rendus par l'outil.
- **Ne clone jamais la voix d'une personne des rushes**, et ne fais dire à personne ce qu'il n'a pas dit, sauf si l'humain le demande en toutes lettres.
- **N'affiche jamais la clé** : ni \`env\`, ni \`printenv\`, ni \`echo\` de la variable. Ne lance ni \`onboard\` ni \`auth\`.
- **Dis à la fin** ce que tu as créé avec ElevenLabs (musique, voix, bruitages, images, vidéos).

${sons}${partieReseaux()}${partieAjoutees()}## La 3D avec Blender

${blender?.ok ? `Blender ${blender.version} est installé sur cet ordinateur : \`${blender.chemin}\`.` : 'Si Blender est installé (le message de départ le dit), voici comment s’en servir. Sinon, fais la 3D dans la page avec \`@remotion/three\`.'}

- **Lance-le sans interface, avec les réglages d'usine** : \`"${blender?.chemin ?? '/Applications/Blender.app/Contents/MacOS/Blender'}" -b --factory-startup --python scene.py -- tes arguments\`. Sans \`--factory-startup\`, Blender peut être en français : les nœuds et les objets créés portent alors des noms traduits, et un script qui cherche « Principled BSDF » échoue.
- **N'appelle jamais Blender par un lien** (\`~/.local/bin/blender\`, par exemple) : il cherche ses fichiers à côté de son exécutable et ne démarre pas (« No module named 'bpy_types' »). Utilise le chemin complet ci-dessus.
- **Cherche un nœud par son type**, pas par son nom : \`next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')\`.
- **Moteur** : Eevee, rapide (une image en une seconde environ). Son nom change selon la version (\`BLENDER_EEVEE_NEXT\` de la 4.2 à la 4.5, \`BLENDER_EEVEE\` sinon) : lis la liste des moteurs avant de choisir. Garde Cycles pour une image fixe.
- **Fond transparent** : \`scene.render.film_transparent = True\`, images PNG en RGBA, rangées dans \`remotion/public/3d/<scène>/0001.png\`, \`0002.png\`…
- **Même cadence que la vidéo** (\`scene.render.fps\`), et une taille égale à celle où l'élément sera affiché, pas plus.
- **Couleurs fidèles** : \`scene.view_settings.view_transform = 'Standard'\`, sinon les couleurs du projet sortent ternes.
- **Texte en relief** : charge une police \`.ttf\` ou \`.otf\` (les \`.woff2\` du kit ne conviennent pas), par exemple \`/System/Library/Fonts/Supplemental/Impact.ttf\` ou \`DIN Condensed Bold.ttf\`.
- **Dans le kit** : une \`<Img>\` par image, choisie d'après le numéro d'image (\`staticFile('3d/intro/' + String(n).padStart(4, '0') + '.png')\`), comme le fait \`Decoupe\` dans \`Montage.tsx\`.
- Rends d'abord **une seule image** pour vérifier le cadrage et la lumière, regarde-la, puis rends la suite.

## Le son : voix claire et mixage

Une voix qu'on comprend sans effort, une musique qui ne la couvre jamais, un volume égal d'un plan à l'autre : c'est ce que l'humain entend d'abord. Les mesures de chaque rush (\`sources[].mesures.son\` dans \`montage.json\`, et \`analyse/\`) disent déjà où il y a du bruit de fond, une voix étouffée ou de l'écho.

1. **Nettoie chaque voix qui en a besoin.** Si un plan a \`fichier.clair\`, l'humain l'a déjà fait : prends ce fichier. Sinon :
   \`derush-son clair plans/M3-interview.mp4 rendu/son/M3-clair.wav\` (\`auto\` par défaut : Dérush mesure le fond sonore et choisit « léger » pour une voix déjà nettoyée par le téléphone ou une appli, « normal » sinon ; \`--force doux\` pour garder l'ambiance, \`fort\` pour un son très sale, \`--echo\` pour une voix qui résonne ; \`--debut s --duree s\` pour un passage). Regarde \`apres.brillance_db\` : entre −15 et −11, la voix est nette ; en dessous de −16, elle reste sourde. Ne garde pas la voix d'origine « parce qu'elle est plus naturelle » sans l'avoir mesurée : une voix sourde fatigue et se comprend mal sur un téléphone. Le résultat a exactement la durée du passage, reste synchrone avec l'image, et sort à −16 LUFS : remplace le son du plan par ce fichier (\`<Audio>\` muet sur la vidéo, la voix claire à côté, mêmes temps).
2. **Mixe.** La voix devant ; la musique bien en dessous quand quelqu'un parle, qui remonte dans les silences ; les bruitages sur l'image exacte du geste. Le plus simple : rends la vidéo sans son, puis
   \`derush-son mixer mix.json rendu/son/mix.wav\` avec \`{"duree": 46, "pistes": [{"fichier": "rendu/son/voix.wav", "role": "voix"}, {"fichier": "sons/musique.mp3", "role": "musique", "longueur": 46, "fondu_sortie": 2, "effets": [{"type": "etouffer", "de": 15.8, "a": 23.2}]}, {"fichier": "rendu/son/clic.wav", "role": "effet", "debut": 3.2, "gain_db": -8}]}\`.
   - **La musique se règle toute seule d'après la voix** : Dérush mesure les deux et la pose **15 dB sous la voix** pendant qu'on parle (\`"musique_sous_voix_db"\` à la racine du plan pour changer : 12 = plus présente, 18 = plus discrète), et la fait **remonter de 6 dB** dans les silences de plus d'une seconde (\`"remontee_db"\`, 0 pour un lit constant). Le \`gain_db\` d'une musique ajuste encore ce niveau (+3 = un peu plus présente). \`"ducking": false\` : chaque piste garde exactement son \`gain_db\`, rien d'automatique.
   - **La musique suit le sens** : \`"effets"\` d'une piste, en temps de la vidéo : \`etouffer\` (comme derrière un mur : un passage grave, un souvenir, une prison), \`couper\` (un silence qui fait effet), \`volume\` avec \`db\` (plus fort ou plus faible sur un passage). Fondus de 0,3 s.
   - Le tout sort à −14 LUFS, crête −1 dBTP ; la réponse donne le volume de la voix et le gain posé sur chaque musique. Colle ce son sur la vidéo : \`ffmpeg -i video.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k final.mp4\`.
3. **Mesure.** \`derush-son mesurer rendu/final.mp4\` : −14 LUFS (±1), crête sous −1 dBTP. Écoute ce que tu peux (Earshot, s'il est là) avant de livrer.

## Les couleurs : étalonnage et Log

Chaque plan doit avoir l'air de venir du même film : même exposition, même blanc, même saturation. Les mesures de chaque rush sont dans \`sources[].mesures.image\` (exposition, contraste, saturation, dominante, Log probable).

- **Le Log est déjà converti.** Si \`sources[].couleur_camera\` est donné (S-Log3, V-Log, D-Log M…), le fichier de \`plans/\` est déjà en couleurs normales (Rec.709). Si un rush a l'air gris et plat mais n'est pas converti (\`mesures.image.log_probable\`), dis-le à l'humain : il le convertit en un clic (menu « … » du média, Couleurs de la caméra).
- **Ce que l'humain a réglé, tu le gardes** : \`couleur\` d'un plan (déjà appliqué par le kit, avec \`colorCorrection\`), \`couleur_reglages\` (ses curseurs, de −100 à 100). Affine par-dessus, ne repars pas de zéro.
- **Étalonne toi-même les autres plans**, dans \`PlanVideo\` (\`Montage.tsx\`) : \`import {colorCorrection} from '@remotion/effects/color-correction'\`, puis \`effects={[colorCorrection({exposure, contrast, saturation, temperature, tint})]}\` (exposition en diaphragmes de −5 à 5 ; contraste et saturation : 1 = rien ; température et teinte de −1 à 1). Corrige d'abord ce qui est faux (une image trop sombre, une dominante orangée ou verte), puis donne un look discret et commun à tout le film. Pour un LUT : \`import {lut} from '@remotion/effects/lut'\` et \`lut({content: texteDuFichierCube})\`.
- **Vérifie** : rends une image fixe de chaque plan (\`npx remotion still\`) et pose-les côte à côte. Peau naturelle, blancs blancs, noirs pas bouchés, rien de brûlé.

## Pièges déjà rencontrés

Ils ont coûté du temps à des IA avant toi ; évite-les d'emblée.

- **Les commandes de Dérush disent tout avec \`--help\`** : \`derush-son\`, \`derush-controle\`, \`derush-detourer\`, \`derush-youtube\`, \`node remotion/images.mjs --help\`. Inutile d'ouvrir leur code.
- **FFmpeg de Dérush est récent (version 9)** : \`-vsync\` n'existe plus, écris \`-fps_mode passthrough\` (ou \`cfr\`).
- **Un son à travailler s'extrait en virgule flottante** (\`-c:a pcm_f32le\`) : en 16 bits, les crêtes d'un AAC au-dessus de 0 dB sont écrêtées.
- **Mesurer un texte avant que les polices soient chargées donne une mesure fausse** (\`measureText\` et \`fitText\` de @remotion/layout-utils la gardent en cache) : mesure après \`usePolices()\` (pièces du kit) ou \`document.fonts.load\`.
- **Un contour épais mange l'espace entre les mots** : de vraies espaces, ou un écart d'au moins 0,3 em plus le contour (\`derush-controle\` le voit).
- **Certains sons de la bibliothèque demandent un crédit** (CC BY) : après un choix automatique (Real SFX), regarde \`credit\` dans \`catalog.csv\` ; préfère un son sans crédit à citer, ou cite-le.
- **Le disque peut être presque plein** : \`df -h .\` avant un gros rendu ; efface au fil de l'eau tes intermédiaires lourds (rendus d'essai, extractions d'images). Ne cherche jamais un fichier sur tout le disque (\`find /\`).
- **Une voix « plus naturelle » sans mesure** : compare \`brillance_db\` avant et après \`derush-son clair\` ; une voix qui reste sourde (sous −16) se comprend mal sur un téléphone.

## Où mettre ton code

- Une scène à toi : un fichier dans \`remotion/src/\`, appelé depuis \`Montage.tsx\` à la place d'un \`<ACreer>\`. Garde le \`from\` et le \`durationInFrames\` de la case.
- Un effet du catalogue à régler : \`habillage.effets\` dans \`montage.json\`. Le catalogue complet, avec les réglages possibles, est dans \`habillage.catalogue\`.
- Un changement de découpe : \`retours-ia.json\`, pour que l'humain le voie dans Dérush.
`;
}

/** Les règles pour bien animer, écrites pour l'IA qui monte : elles partent dans chaque pack (MOTION.md). */
export function guideMotion() {
  return `# Bien animer

Ce que l'humain attend : une vidéo qui a l'air montée par un bon monteur, pas par une machine. Ces règles viennent de retours réels sur des vidéos faites avec Dérush.

## La méthode

C'est ainsi qu'ont été faits les meilleurs montages livrés par Dérush. Elle prend du temps : c'est ce temps qui fait la différence. Ne saute aucune étape.

1. **Regarde tout, en vrai.** Une planche d'une image par seconde de chaque rush ; 6 à 10 images par seconde sur les passages riches (un objet montré, des pages, un geste, un effet déjà incrusté) ; les images clés en pleine taille. L'analyse de Dérush a déjà repéré ce qui est incrusté dans les rushes (\`incrustes\` dans \`analyse/<rush>.json\` : images noires, flashs, flous, logo d'une appli, texte, son coupé) : sale, on le retire ou on le refait mieux.
2. **Relis le texte mot à mot.** Corrige chaque nom propre (vérifie l'orthographe sur le web : un auteur, une collection, un lieu) et chaque mot mal entendu ; réécoute un passage douteux (Whisper sur l'ordinateur). Repère les redites, les hésitations, les mots repris et les pauses qui traînent : garde tout ce qui est dit, dans l'ordre, sauf ce qui se répète ou hésite (la meilleure prise d'une redite).
3. **Choisis l'accroche avant tout le reste.** Les deux premières secondes décident si on reste. Écris trois idées dans ton plan et garde la plus forte. Quand une personne parle face caméra, la plus sûre : un grand titre de 2 ou 3 mots qui dit le sujet, **derrière elle** (\`derush-detourer\`, puis \`<TitreGeant>\` et \`<PersonneDevant>\` des pièces du kit). Jamais une petite étiquette : sous 7 % de la hauteur de l'image, un texte ne se lit pas en passant (\`derush-controle\` le mesure).
4. **Écris ton plan avant de fabriquer** : \`coupes.json\` avec un titre et une note par passage, puis \`rendu/timeline.json\` (l'accroche choisie, chaque titre, carte, effet, musique, bruitage, avec son temps).
5. **Prépare la matière en comparant.** Voix claire : \`derush-son clair\` en \`auto\`, puis compare \`brillance_db\` avant et après (entre −15 et −11 : nette). Étalonnage : trois essais côte à côte, le visage à 100 %, garde l'ambiance du lieu. Détourage pour un titre derrière la personne (garde devant ce qui doit rester devant : une main, des étincelles). Une image fixe filmée (une page, un document, un écran) : la moyenne de ses images immobiles est plus nette et sans bruit.
6. **Habille ce qui est dit, au moment où c'est dit** : une étiquette sur le nom qu'on prononce ; une carte quand on parle d'une collection, d'une liste, d'un lieu (avec ses éléments) ; un dessin sur le mot qui le décrit (« le découpage » → des cases qui se tracent) ; le bouton d'abonnement sur la phrase qui le demande ; une fiche à la fin (titre, auteur, éditeur). Jamais un texte qui répète la phrase. Pars des **pièces du kit** (\`remotion/src/pieces/LISEZMOI.md\` : accroche derrière la personne, sous-titres mot à mot, carte, étiquette, barreaux, vieux papier, cases, bouton d'abonnement, carton de fin) : elles sont prêtes et vérifiées ; règle-les, change leurs couleurs, et n'écris du neuf que pour ce qu'elles ne font pas.
7. **La musique raconte aussi.** Choisis-la au tempo (mesure-le), cale un temps fort sur l'arrivée d'un objet ou d'un titre, et fais-la suivre le sens : étouffée sur un passage grave, rouverte sur le tournant, coupée pour un silence qui fait effet (\`derush-son mixer\` et ses \`effets\`, voir \`OUTILS.md\`). Un bruitage réel sur chaque geste montré (une page qui tourne, un livre posé).
8. **Des sous-titres soignés** : 2 à 4 mots par bloc, calés sur la voix nettoyée (vérifie le début des mots qui suivent un silence), jamais un petit mot seul, le mot dit mis en valeur (\`<SousTitres>\` du kit le fait). Un contour épais mange l'espace entre les mots : écris de vraies espaces ou un écart d'au moins 0,3 em plus l'épaisseur du contour. Sur un fond clair (une page blanche), une plaque sombre derrière le texte.
9. **Contrôle avant le rendu complet** : \`node remotion/images.mjs --de 0 --a 10 --pas 10\` rend des images fixes et une planche ; fais-en pour toute la vidéo, partie par partie (20 à 30 images chacune), agrandis chaque effet (une page qui tourne, un titre qui arrive), corrige, recommence.
10. **Après le rendu** : une planche à deux images par seconde, chaque transition image par image, quatre images en pleine taille (titre, sous-titres, carte, carton de fin), puis \`derush-controle\` : rien dans \`a_corriger\`, et chaque point de \`a_regarder\` (accroche, voix, rythme) tranché, corrigé ou gardé pour une raison que tu dis. Les zones des réseaux, le son (−14 LUFS), et fais écouter le mixage par Earshot.
11. **Dis ce que tu n'as pas pu faire**, et pourquoi (une image d'origine trop floue, un son qui manque), et ce que tu as appris d'utile pour les prochains montages dans \`carnet-ia.md\` (voir \`LISEZMOI-IA.md\`).

## Avant d'animer

- Une seule idée par plan. Si deux choses bougent en même temps, l'œil n'en suit aucune.
- Reprends l'identité du projet : la couleur d'accent et les polices sont dans \`style\` (\`montage.json\`). Deux polices au plus, trois tailles de texte au plus.
- Écris ton plan en quelques lignes (ce qui se passe, seconde par seconde) avant de coder.
- N'invente rien : pas de chiffre, de nom ni de citation qui ne vienne pas des rushes, du brief ou des fichiers donnés.

## Le rythme

- Une entrée dure 8 à 14 images, une sortie 6 à 10. Plus court, c'est sec ; plus long, c'est mou.
- Décale les éléments d'un même groupe de 2 à 4 images : le titre, puis le sous-titre, puis le trait.
- Rien ne bouge à vitesse constante. \`spring()\` pour ce qui arrive (\`damping\` de 14 à 20 pour un léger rebond, 200 pour aucun), \`Easing.bezier(0.16, 1, 0.3, 1)\` pour ce qui glisse. Seule l'opacité peut être linéaire.
- Un texte reste à l'écran le temps de le lire deux fois : au moins 1,2 s, et 0,3 s par mot.
- Cale les coupes et les apparitions sur la parole (fin de phrase, mot fort) ou sur le temps de la musique. Les temps des mots sont dans \`sous-titres/mots.json\`.
- Les trois premières secondes décident de tout : commence par le plan ou la phrase la plus forte, jamais par un logo.

## Le texte

- Fais apparaître mot par mot ou ligne par ligne, derrière un cache (\`overflow: hidden\` et une translation), plutôt que lettre par lettre.
- Sur une image filmée, un texte a besoin d'un contour, d'une ombre ou d'un fond. Vérifie-le sur l'image la plus claire du plan.
- Un contour (\`WebkitTextStroke\`) déborde de moitié de chaque côté des lettres : entre deux mots, il mange l'espace. Avec \`display: flex\` et \`gap\`, prends un écart d'au moins 0,3 em **plus** l'épaisseur du contour, sinon les mots se collent (« cettecollection »). \`derush-controle\` le voit.
- Aucun texte ne touche le bord de l'image : mesure-le ou réduis-le pour qu'il tienne dans la zone sûre, même le plus long.
- Reste dans les zones sûres du réseau visé (\`livraison\` dans \`montage.json\`) : rien d'important sous les boutons ni sous la légende.
- Si un plan a déjà du texte incrusté, n'en rajoute pas par-dessus.

## Les transitions et les effets

- Une transition prolonge un mouvement qui existe déjà dans l'image : un geste, un panoramique, un objet qui passe. Sans mouvement à prolonger, une coupe franche est meilleure.
- Deux sortes de transitions au plus dans une vidéo.
- Pas de flash blanc sur une transition portée par un objet lancé vers la caméra : l'objet fait déjà le travail.
- Un zoom lent de 2 à 4 % sur un plan fixe suffit à le rendre vivant.
- Le flou de mouvement (\`@remotion/motion-blur\`) se garde pour ce qui va vite. Partout, il fatigue.

## La fin

- Le carton de fin ne se pose jamais sur une image figée : le fond continue de bouger (la vidéo, ralentie ou floutée, ou un fond animé).
- Termine sur une image qui peut se rejouer : la boucle doit paraître naturelle.

## Le son

- Une voix étouffée, bruitée ou qui résonne ne part jamais telle quelle : passe-la par \`derush-son clair\` (voir \`OUTILS.md\`).
- Chaque accent visuel a son bruit, posé sur l'image exacte de l'impact. Les sons du kit sont dans \`remotion/public/sons/\`.
- La voix reste devant : la musique environ 15 dB plus bas quand quelqu'un parle, qui remonte dans les silences (\`derush-son mixer\` le règle tout seul, d'après la voix mesurée).
- La musique suit le sens : étouffée sur un passage grave, rouverte sur le tournant, coupée pour un silence qui fait effet (\`effets\` d'une piste, dans \`derush-son mixer\`).
- Vise −14 LUFS, avec une crête à −1 dBTP au plus.

## Les couleurs

- Étalonne toujours : une vidéo montée avec des plans de couleurs différentes trahit l'amateur. Corrige, puis harmonise (voir \`OUTILS.md\`, « Les couleurs »).

## La 3D

- En accent, pas en décor : 1 à 3 secondes (un titre en relief, un objet qui tourne, une intro).
- Dans la page avec \`@remotion/three\` pour ce qui est simple ; avec Blender pour ce qui doit être réaliste. Voir \`OUTILS.md\`.
- Trois lumières au plus, les couleurs du projet, et une caméra qui bouge lentement.
- Un halo seulement sur ce qui émet de la lumière (un néon, un écran, une étincelle), jamais pour faire joli.
- Une chute, un choc, une pile d'objets se simulent (Rapier, voir \`OUTILS.md\`) plutôt que de s'animer à la main.

## Ce qui trahit une vidéo faite par une machine

- Tout bouge en même temps, tout le temps.
- Des dégradés, des halos et des particules sans raison.
- Des icônes génériques à la place des vraies images du projet.
- Des animations toutes à la même vitesse.
- Du texte qu'on n'a pas le temps de lire, ou qui répète mot pour mot ce qui est dit sans rien souligner.

## Contrôler son travail

1. Avant le rendu complet : \`node remotion/images.mjs --de <s> --a <s> --pas <images>\` pour chaque partie de la vidéo (20 à 30 images par planche, toute la vidéo y passe), regarde-les vraiment, agrandis chaque effet, corrige.
2. Rends la vidéo, fais une planche (deux images par seconde) et regarde l'enchaînement.
3. Regarde chaque transition image par image : pas d'image noire, pas de saut.
4. Quatre images en pleine taille (titre, sous-titres, carte, carton de fin) : la typographie se juge à 100 %.
5. \`derush-controle rendu/final.mp4\` : rien à corriger (mots collés, texte coupé ou caché par le réseau), puis chaque point à regarder : l'accroche (un grand texte dans les 2 premières secondes), la voix (assez d'aigus), le rythme (pauses, « euh », redites). Corrige et relance tant qu'il signale un problème.
6. Puis suis « Vérifier avant de livrer » dans \`LISEZMOI-IA.md\`.
`;
}
