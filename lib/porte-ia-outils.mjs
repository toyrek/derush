// Dérush — la porte des IA : la liste des outils que reçoit une IA branchée sur Dérush (Claude, ChatGPT, Gemini, Cursor…)
// par le protocole MCP. Ce fichier ne fait rien : il décrit. Il est lu par le serveur (lib/porte-ia.mjs), par le pont des
// apps (outils/derush-mcp.mjs, même quand Dérush est fermé) et par les essais.
// Les gestes eux-mêmes sont joués par la fenêtre de Dérush (public/porte.js) : chacun s'annule d'un ⌘Z, comme un geste fait
// à la main, et la personne voit l'IA travailler (son curseur sur la timeline). Les noms sont en français, sans accent.
// Idée reprise d'Editroom (Robbie Tilton, licence MIT) : un serveur MCP dans le logiciel de montage ; la liste, les noms,
// les textes et le modèle de montage sont ceux de Dérush.

export const NOM_SERVEUR = 'derush';

/** Ce que l'IA lit en se branchant : le modèle de montage de Dérush, en quelques lignes. */
export const CONSIGNES_PORTE = `Dérush est un logiciel de montage vidéo. Les temps sont en secondes.
Le montage est la piste du bas : magnétique, chaque élément suit le précédent sans trou (un plan d'un média, ou une
case « à créer »). Par-dessus se posent des plans de coupe, des photos, des logos, une voix off ou une musique, chacun
à son temps (début). Les effets (transitions sur une coupe, titres, mouvements, bruitages) et les notes se posent sur
une plage de temps. Chaque élément a un identifiant : P3 (plan du montage), B2 (case à créer), S4 (par-dessus), I5
(effet ou note), M1 (média). « entree » et « sortie » sont des temps dans le fichier du média ; « debut » et « fin »,
des temps dans le montage.
Commence par lire_projet et lister_medias. lire_transcription donne ce qui est dit (phrases et mots, avec leurs temps
dans le fichier) ; regarder_media montre des images d'un rush ; chercher_medias trouve un moment par ce qui est dit ;
noter_media garde ce que tu as vu (lister_medias te le rend la fois suivante). Chaque outil qui change le montage est
un seul geste, que la personne voit et peut annuler (historique). creer_video fabrique la vidéo finale.`;

const num = (description, extra = {}) => ({type: 'number', description, ...extra});
const ent = (description, extra = {}) => ({type: 'integer', description, ...extra});
const txt = (description, extra = {}) => ({type: 'string', description, ...extra});
const oui = (description) => ({type: 'boolean', description});
const ids = (description) => ({type: 'array', items: {type: 'string'}, description});
const outil = (name, title, description, proprietes = {}, {requis = [], lecture = false, destructif = false} = {}) => ({
  name, title, description,
  inputSchema: {type: 'object', properties: proprietes, ...(requis.length ? {required: requis} : {}), additionalProperties: false},
  annotations: {title, readOnlyHint: lecture, destructiveHint: destructif, idempotentHint: lecture, openWorldHint: false},
});

const ID_PLAN = txt('L’identifiant d’un élément du montage (P3, B2) ou d’un élément par-dessus (S4).');
const FORMATS = ['vertical', 'horizontal', 'carre', 'portrait'];

/**
 * Les outils. `ou` dit qui les joue : « fenetre » (la fenêtre de Dérush : le montage, tel qu'il est à l'écran) ou
 * « serveur » (ce qui lit les fichiers : transcription, images, recherche, vidéo finale).
 */
export const OUTILS = [
  // — lire —
  [outil('lire_projet', 'Lire le projet',
    'Le projet ouvert : son format (largeur, hauteur, images par seconde, durée), le montage dans l’ordre (chaque élément avec ses temps dans le montage et dans son fichier, son son, sa couleur, sa vitesse, ses fondus et sa transition), ce qui est posé par-dessus, les effets et les notes, les marqueurs, le style du film (sous-titres, polices, couleur), la tête de lecture.',
    {}, {lecture: true}), 'fenetre'],
  [outil('lister_medias', 'Lister les médias',
    'Tout ce qui a été importé dans le projet : identifiant, nom, genre (video, audio, image), durée, taille, images par seconde, ce qu’on y voit (les étiquettes d’Apple Vision), si l’on y parle (et le début de ce qui est dit), le résumé de l’analyse s’il y en a une, et les notes que tu as gardées en le regardant (noter_media).',
    {}, {lecture: true}), 'serveur'],
  [outil('lire_transcription', 'Lire la transcription',
    'Ce qui est dit dans un média, entendu sur cet ordinateur (Whisper) : ses phrases avec leurs temps dans le fichier, et chaque mot si tu le demandes. Sert à couper les silences, les hésitations et les redites, garder les phrases entières, trouver un moment par ce qui est dit, ou poser des images sur une voix.',
    {media: txt('L’identifiant d’un média (M1…).'), mots: oui('Aussi chaque mot avec son début et sa fin (non par défaut).')},
    {requis: ['media'], lecture: true}), 'serveur'],
  [outil('regarder_media', 'Regarder un média',
    'Te montre un média : une photo, ou des images prises dans toute une vidéo, en planche, chacune marquée de son temps dans le fichier. Pour voir ce qu’il y a dans chaque plan avant de choisir.',
    {media: txt('L’identifiant d’un média.'), images: ent('Combien d’images réparties dans la vidéo (6 par défaut, 12 au plus).'),
      temps: {type: 'array', items: {type: 'number'}, description: 'Ou bien exactement ces temps dans le fichier, en secondes (12 au plus).'}},
    {requis: ['media'], lecture: true}), 'serveur'],
  [outil('noter_media', 'Noter ce qu’on a vu',
    'Garde ce que tu as vu dans un média après l’avoir regardé, pour les prochains montages : ce qui se passe et quand (temps dans le fichier), les personnes, le lieu, la lumière, la stabilité, le meilleur et le moins bon moment. Deux ou trois lignes courtes. lister_medias te les rend. Remplace la note précédente ; gardé sur cet ordinateur, dans le projet.',
    {media: txt('L’identifiant d’un média.'), notes: txt('Ce que tu as vu, avec les temps, ex. « 0-3 s gros plan sur le cuisinier ; 3-8 s la salle, lumière chaude, caméra stable, meilleur moment 5 s ».')},
    {requis: ['media', 'notes']}), 'serveur'],
  [outil('voir_image', 'Voir une image du montage',
    'Une image du montage à un instant (par défaut : la tête de lecture), 640 pixels sur son plus grand côté : l’image du plan qui passe à ce moment, avec sa couleur, sans les titres ni les sous-titres.',
    {temps: num('Le temps dans le montage, en secondes.')}, {lecture: true}), 'serveur'],
  [outil('chercher_medias', 'Chercher dans les médias',
    'Trouve un moment dans les médias par ce qu’on y voit (des choses, des lieux, des gens : « plage », « chien », « voiture nuit » ; en français, ou les étiquettes anglaises d’Apple Vision comme « beach ») et/ou par ce qui est dit (des mots, dans l’ordre), avec les temps dans chaque fichier. Bien plus rapide que de regarder ou de lire chaque média. Vu et entendu sur cet ordinateur après l’import : un média tout juste importé n’est peut-être pas encore prêt.',
    {montre: txt('Ce qu’on voit dans le plan ; tous les mots doivent y être.'), dit: txt('Des mots que quelqu’un prononce, dans l’ordre.')}, {lecture: true}), 'serveur'],
  [outil('lister_effets', 'Lister les effets',
    'Les effets que Dérush dessine lui-même, avec leurs réglages : transitions à poser sur une coupe (coup de zoom, plongée, fouet, glitch, flash, fondu au noir), titres (titre, titre derrière la personne, lieu, carton de fin), mouvements (zoom lent, secousse) et bruitages.',
    {}, {lecture: true}), 'serveur'],

  // — poser, déplacer, couper —
  [outil('importer_medias', 'Importer des médias',
    'Ajoute des fichiers de cet ordinateur aux médias du projet (vidéos, sons, photos). Ils restent à leur place ; Dérush les prépare (aperçu, son, transcription) en arrière-plan.',
    {chemins: {type: 'array', items: {type: 'string'}, description: 'Chemins complets des fichiers.'}}, {requis: ['chemins']}), 'fenetre'],
  [outil('ajouter_plan', 'Ajouter un plan au montage',
    'Pose un passage d’un média dans le montage (la piste du bas). Le reste du montage se décale pour lui faire place.',
    {media: txt('L’identifiant d’un média.'), entree: num('Où commencer dans le fichier (0 par défaut).'),
      duree: num('Combien de temps (par défaut : jusqu’à la fin du fichier ; 3 s pour une photo).'),
      apres: txt('Le poser juste après cet élément du montage (P3, B2) ; « debut » pour le mettre en tête.'),
      temps: num('Ou bien le poser à la coupe la plus proche de ce temps du montage. Sans « apres » ni « temps » : à la fin.'),
      titre: txt('Un nom court pour ce plan (facultatif).')},
    {requis: ['media']}), 'fenetre'],
  [outil('poser_par_dessus', 'Poser par-dessus',
    'Pose un média par-dessus le montage, à un temps donné : un plan de coupe ou une photo (en plein cadre ou en petit, dans un coin), un logo, une voix off, une musique.',
    {media: txt('L’identifiant d’un média.'), debut: num('Le temps du montage où il commence.'), entree: num('Où commencer dans le fichier (0 par défaut).'),
      duree: num('Combien de temps (par défaut : tout le fichier, sans dépasser la fin du montage pour une image ; 3 s pour une photo).'),
      cadre: txt('« plein » (par défaut) ou « incrustation » (en petit, dans un coin).', {enum: ['plein', 'incrustation']}),
      son: oui('Garder son son (oui par défaut pour un son, non pour une vidéo).'), titre: txt('Un nom court (facultatif).')},
    {requis: ['media', 'debut']}), 'fenetre'],
  [outil('deplacer', 'Déplacer',
    'Déplace un élément. Dans le montage : le mettre après un autre élément (ou en tête). Par-dessus, un effet ou une note : changer son début.',
    {id: txt('L’identifiant de l’élément.'), apres: txt('Montage : le mettre après cet élément, ou « debut ».'), debut: num('Par-dessus, effet ou note : le nouveau début, en secondes.')},
    {requis: ['id']}), 'fenetre'],
  [outil('rogner', 'Rogner',
    'Change le début ou la fin d’un élément. Un plan (montage ou par-dessus) : entree et sortie, en secondes dans son fichier. Une case à créer : sa duree. Un effet ou une note : debut et fin dans le montage.',
    {id: txt('L’identifiant de l’élément.'), entree: num('Nouveau début dans le fichier.'), sortie: num('Nouvelle fin dans le fichier.'),
      duree: num('Case à créer : sa durée.'), debut: num('Effet ou note : début dans le montage.'), fin: num('Effet ou note : fin dans le montage.')},
    {requis: ['id']}), 'fenetre'],
  [outil('couper', 'Couper',
    'Coupe en deux, comme les ciseaux : le plan du montage qui passe à ce temps (ou l’élément par-dessus donné). Rend l’identifiant de la seconde moitié.',
    {temps: num('Le temps du montage où couper.'), id: txt('Facultatif : l’élément par-dessus à couper (sinon, le plan du montage).')},
    {requis: ['temps']}), 'fenetre'],
  [outil('supprimer', 'Supprimer',
    'Supprime des éléments : plans et cases du montage (le reste se recolle), éléments par-dessus, effets, notes, marqueurs (K1…).',
    {ids: ids('Les identifiants.')}, {requis: ['ids'], destructif: true}), 'fenetre'],
  [outil('dupliquer', 'Dupliquer',
    'Copie un élément du montage juste après lui (ou après un autre élément).',
    {id: txt('L’identifiant d’un élément du montage.'), apres: txt('Facultatif : le mettre après cet élément.')}, {requis: ['id']}), 'fenetre'],
  [outil('ajouter_case', 'Ajouter une case à créer',
    'Réserve une place dans le montage pour une scène que l’IA de Dérush créera ensuite (titre animé, motion design, carte, scène 3D, image générée…), avec une consigne.',
    {genre: txt('Le genre de scène.', {enum: ['scene', 'titre', 'animation', '3d', 'generee', 'carte', 'image', 'broll', 'transition', 'autre']}),
      duree: num('Sa durée (3 s par défaut).'), titre: txt('Un nom court.'), consigne: txt('Ce qu’il faut y créer.'),
      apres: txt('La poser après cet élément, ou « debut » (sinon à la fin).')}, {}), 'fenetre'],

  // — régler —
  [outil('regler_son', 'Régler le son',
    'Le son de plans ou d’éléments par-dessus : niveau en dB, coupé ou non, et la version (original, voix seule, sans la voix, voix claire) quand Dérush l’a préparée.',
    {ids: ids('Les identifiants.'), gain_db: num('Niveau en dB, de −60 à +12 (0 : tel quel).'), coupe: oui('Couper le son (oui) ou le remettre (non).'),
      version: txt('La version du son.', {enum: ['original', 'voix', 'fond', 'clair']})},
    {requis: ['ids']}), 'fenetre'],
  [outil('regler_couleur', 'Régler la couleur',
    'L’étalonnage de plans (le même dans l’aperçu et dans la vidéo finale) : de −100 à 100, 0 ne change rien. « ambiance » pose un réglage tout fait (chaud, froid, nb = noir et blanc, film, pastel, vif, nuit) ; « auto » corrige ce qui est franchement à côté d’après les mesures du rush ; « retirer » remet tout à zéro.',
    {ids: ids('Les plans.'), exposition: num('Plus clair ou plus sombre.'), contraste: num('Contraste.'), saturation: num('Saturation.'),
      temperature: num('Plus chaud (positif) ou plus froid.'), teinte: num('Vers le magenta (positif) ou vers le vert.'),
      auto: oui('L’étalonnage automatique de chaque plan.'), retirer: oui('Tout remettre à zéro.'),
      ambiance: txt('Une ambiance toute faite (elle remplace l’étalonnage ; les curseurs donnés en plus s’y ajoutent).', {enum: ['chaud', 'froid', 'nb', 'film', 'pastel', 'vif', 'nuit']})},
    {requis: ['ids']}), 'fenetre'],
  [outil('regler_vitesse', 'Régler la vitesse',
    'Ralentit ou accélère des plans du montage (vidéo ou son), en gardant le même passage de leur fichier : 0,5 joue deux fois plus lentement (un ralenti, deux fois plus long), 4 quatre fois plus vite (un accéléré, quatre fois plus court). Le son suit sans changer de hauteur ; ce qui vient après se recolle. 1 remet la vitesse normale.',
    {ids: ids('Les plans du montage.'), vitesse: num('De 0,05 à 100 (1 : normale).')}, {requis: ['ids', 'vitesse']}), 'fenetre'],
  [outil('regler_fondu', 'Régler les fondus',
    'Les fondus de plans (montage ou par-dessus) : à l’entrée et à la sortie, en secondes. Un plan du montage apparaît depuis le noir et y retourne ; un plan par-dessus apparaît et disparaît en douceur ; le son monte et s’éteint. La courbe : lineaire, lente (lente puis rapide), rapide (rapide puis lente) ou douce (en S). « quoi » : tout, image ou son. 0 retire un fondu.',
    {ids: ids('Les plans.'), entree: num('Durée du fondu d’entrée, en secondes (0 : aucun).'), sortie: num('Durée du fondu de sortie, en secondes (0 : aucun).'),
      courbe: txt('La courbe.', {enum: ['lineaire', 'lente', 'rapide', 'douce']}), quoi: txt('Ce qui fond.', {enum: ['tout', 'image', 'son']})},
    {requis: ['ids']}), 'fenetre'],
  [outil('poser_transition', 'Poser une transition',
    'Une transition entre deux plans du montage, centrée sur leur coupe : fondu enchaîné (l’un se fond dans l’autre) ou volet (l’autre balaie l’image de gauche à droite). Elle se pose sur le plan qui entre (id), ou sur la coupe la plus proche d’un temps. Raccourcie à ce que les fichiers permettent autour de la coupe (le résultat le dit). « aucune » retire la transition. Pour un passage au noir, un coup de zoom, un flash… : poser_effet.',
    {id: txt('Le plan qui entre (après la coupe).'), temps: num('Ou bien : le temps de la coupe visée.'), genre: txt('Le genre.', {enum: ['enchaine', 'volet', 'aucune']}),
      duree: num('Sa durée, en secondes (0,5 par défaut ; de 0,1 à 5).')}, {requis: ['genre']}), 'fenetre'],
  [outil('arret_sur_image', 'Arrêt sur image',
    'Fige une image d’un plan vidéo du montage : le plan est coupé à cet instant, l’image figée se pose entre les deux moitiés (ce qui suit se décale). Rend l’identifiant du plan figé.',
    {id: txt('Le plan vidéo du montage.'), temps: num('Le temps du montage à figer (par défaut : son milieu).'), secondes: num('Combien de temps l’image reste (2 s par défaut).')},
    {requis: ['id']}), 'fenetre'],
  [outil('a_l_envers', 'À l’envers',
    'Lit un plan du montage de la fin vers le début, son compris (Dérush fabrique le passage retourné, deux minutes au plus). Sur un plan déjà retourné, le remet à l’endroit.',
    {id: txt('Le plan du montage.')}, {requis: ['id']}), 'fenetre'],
  [outil('detacher_son', 'Détacher le son',
    'Le son d’un plan vidéo du montage devient un élément par-dessus, au même endroit, à déplacer, rogner ou couper à part ; le plan garde son image. Rend l’identifiant du son.',
    {id: txt('Le plan vidéo du montage.')}, {requis: ['id']}), 'fenetre'],
  [outil('poser_marqueur', 'Poser un marqueur',
    'Pose un marqueur sur la règle de la timeline (un temps fort, un battement, un endroit où couper), ou change un marqueur existant (id). La personne et l’IA de Dérush le voient.',
    {temps: num('Le temps du montage (pour un nouveau marqueur).'), nom: txt('Son nom.'), couleur: txt('Sa couleur.', {enum: ['rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet']}),
      id: txt('Pour changer un marqueur existant (K1…).')}, {}), 'fenetre'],
  [outil('copier_couleur', 'Copier l’étalonnage',
    'Copie l’étalonnage d’un plan sur d’autres plans du montage (les mêmes couleurs partout).',
    {de: txt('Le plan dont on copie les couleurs.'), vers: ids('Les plans qui les reçoivent.')}, {requis: ['de', 'vers']}), 'fenetre'],
  [outil('couper_sur_le_temps', 'Couper sur le temps',
    'Cale les coupes du montage sur les temps d’une musique posée par-dessus : chaque coupe qui tombe pendant la musique va au temps le plus proche (à 0,35 s au plus), en allongeant ou raccourcissant le plan d’avant. Rend le tempo et combien de coupes sont calées.',
    {musique: txt('L’élément par-dessus qui porte la musique (S2…).')}, {requis: ['musique']}), 'fenetre'],
  [outil('egaliser_son', 'Égaliser le son',
    'Met le son de plans du montage au même niveau : chaque passage est mesuré (LUFS) et reçoit le gain qui l’amène au niveau du plan médian (±12 dB au plus). Sans « ids » : tous les plans du montage qui ont du son. La vidéo finale est ensuite mise à −14 LUFS en entier.',
    {ids: ids('Les plans (facultatif).')}, {}), 'fenetre'],
  [outil('poser_effet', 'Poser un effet',
    'Pose un effet de lister_effets. Une transition se cale sur la coupe la plus proche de « temps » (une seule par coupe : elle remplace l’ancienne). Un titre ou un mouvement couvre « debut » à « fin ». Rend l’identifiant de l’effet.',
    {modele: txt('Le modèle (zoom, fondu, titre, lieu, fin, zoom-lent, son-pop…).'), temps: num('Transition ou bruitage : le temps visé.'),
      debut: num('Titre ou mouvement : son début.'), fin: num('Titre ou mouvement : sa fin (sinon sa durée habituelle).'),
      reglages: {type: 'object', description: 'Ses réglages, ex. {"texte": "SHIBUYA", "position": "haut"}.', additionalProperties: true}},
    {requis: ['modele']}), 'fenetre'],
  [outil('regler_effet', 'Régler un effet',
    'Change les réglages ou les temps d’un effet déjà posé (texte d’un titre, position, force…).',
    {id: txt('L’identifiant de l’effet (I5…).'), reglages: {type: 'object', additionalProperties: true, description: 'Les réglages à changer.'},
      debut: num('Nouveau début.'), fin: num('Nouvelle fin.')}, {requis: ['id']}), 'fenetre'],
  [outil('regler_style', 'Régler le style du film',
    'L’habillage de tout le film : style de départ, sous-titres (karaoké, mot à mot, classique, aucun), polices, couleur d’accent, transition sur chaque coupe, grain, bords sombres, bandes noires, barre de progression, bruitages.',
    {look: txt('Un style de départ.', {enum: ['simple', 'trend', 'voyage', 'podcast', 'cinema', 'yabai']}),
      sous_titres: txt('Le style des sous-titres.', {enum: ['karaoke', 'mot', 'phrase', 'aucun']}),
      position_sous_titres: txt('Où ils se placent.', {enum: ['haut', 'centre', 'bas']}), majuscules: oui('Sous-titres en majuscules.'),
      accent: txt('La couleur d’accent, ex. #FFD400.'), police_titres: txt('Police des titres (Anton, Bebas Neue, Archivo Black, Montserrat, Poppins, Playfair Display, Permanent Marker, Geist, Geist Mono, Geist Pixel).'),
      police_textes: txt('Police des textes.'), transition_auto: txt('Une transition sur chaque coupe : un modèle de transition, ou « aucune ».'),
      grain: num('Grain, de 0 à 1.'), vignette: num('Bords sombres, de 0 à 1.'), bandes: oui('Bandes noires de cinéma.'), barre: oui('Barre de progression.'),
      bruitages: oui('Les bruitages des effets.')}, {}), 'fenetre'],
  [outil('regler_format', 'Régler le format',
    'Le format de la vidéo : vertical 9:16 (Reels, TikTok, Shorts), horizontal 16:9 (YouTube), carré 1:1, portrait 4:5 ; et le nombre d’images par seconde. Le cadrage de chaque plan suit le sujet.',
    {format: txt('Le format.', {enum: FORMATS}), fps: ent('Images par seconde.', {enum: [24, 25, 30, 50, 60]})}, {}), 'fenetre'],

  // — lecture, historique, vidéo —
  [outil('lecture', 'Lecture',
    'Lance la lecture, la met en pause, ou place la tête de lecture.',
    {action: txt('Ce qu’il faut faire.', {enum: ['lire', 'pause', 'aller']}), temps: num('Pour « aller » : le temps du montage.')},
    {requis: ['action']}), 'fenetre'],
  [outil('historique', 'Annuler ou rétablir',
    'Annule ou rétablit le dernier changement (chaque appel d’outil est un seul changement).',
    {action: txt('Annuler ou rétablir.', {enum: ['annuler', 'retablir']})}, {requis: ['action']}), 'fenetre'],
  [outil('creer_video', 'Créer la vidéo',
    'Fabrique la vidéo finale du montage, avec tout son habillage (bouton « Créer la vidéo » de Dérush), en arrière-plan. etat_video dit où elle en est.',
    {attendre: oui('Attendre la fin (jusqu’à 4 minutes environ) au lieu de rendre la main tout de suite.')}, {}), 'serveur'],
  [outil('exporter', 'Exporter',
    'Exporte la timeline en un fichier, en arrière-plan (comme le bouton « Exporter ») : la qualité (1080, 1440 = 2K, 2160 = 4K si les rushes le permettent), le niveau du son (reseaux = −14 LUFS, podcast = −16, television = −23, tel = tel quel), la même vidéo dans d’autres formats (le cadrage suit le sujet), un passage seulement (de, a : temps du montage), et le son seul en WAV. Rangé dans « vidéos » ; jamais sur un fichier existant.',
    {qualite: ent('1080, 1440 ou 2160 (1080 par défaut).', {enum: [1080, 1440, 2160]}), son: txt('Le niveau du son.', {enum: ['reseaux', 'podcast', 'television', 'tel']}),
      formats: {type: 'array', items: {type: 'string', enum: ['vertical', 'horizontal', 'carre', 'portrait']}, description: 'D’autres formats en plus (3 au plus).'},
      de: num('Un passage seulement : son début, en secondes du montage.'), a: num('… et sa fin.'), wav: oui('Aussi le son seul, en WAV.'),
      attendre: oui('Attendre la fin (jusqu’à 4 minutes environ).')}, {}), 'serveur'],
  [outil('etat_video', 'Où en est la vidéo',
    'Les vidéos en cours de fabrication et les dernières finies : leur fichier, leur durée, leur niveau sonore et les contrôles de Dérush.',
    {}, {lecture: true}), 'serveur'],
];

/** Les outils, tels que le protocole les donne (tools/list). */
export const DEFINITIONS = OUTILS.map(([d]) => d);
/** Qui joue un outil : « fenetre » ou « serveur » (null s'il n'existe pas). */
export const ouJouer = (nom) => OUTILS.find(([d]) => d.name === nom)?.[1] ?? null;
/** Les outils qui ne changent rien. */
export const enLecture = (nom) => !!OUTILS.find(([d]) => d.name === nom)?.[0].annotations.readOnlyHint;

/**
 * Le nom à montrer pour une IA branchée, d'après ce qu'elle annonce (clientInfo du protocole) ou ce que Dérush sait
 * (une IA lancée par Dérush lui-même).
 */
export function nomClient(info = {}) {
  const n = `${info?.title ?? ''} ${info?.name ?? ''}`.toLowerCase();
  if (/claude[- ]?code/.test(n)) return 'Claude Code';
  if (/claude|anthropic/.test(n)) return 'Claude';
  if (/codex|openai|chatgpt/.test(n)) return 'ChatGPT';
  if (/gemini|antigravity|google/.test(n)) return 'Gemini';
  if (/cursor/.test(n)) return 'Cursor';
  if (/windsurf|codeium/.test(n)) return 'Windsurf';
  if (/vscode|visual studio|copilot/.test(n)) return 'Copilot';
  const brut = String(info?.title || info?.name || '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 24);
  return brut || 'Une IA';
}
