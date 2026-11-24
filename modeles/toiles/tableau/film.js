// Le film : une liste de scènes, dans l'ordre. Le moteur fait le reste (les temps, les transitions, le rendu).
//
//   {id, dur, transition}
//     id          le nom de la scène : scenes/<id>.js de ce dossier (déclarée dans SCENE_LIBS), ou une des 53 scènes
//                 du moteur (/tableaux/scenes/ : 01_cave, 09_postimp, 17_ink, 28_monet, 35_shinkai…)
//     dur         sa durée, en secondes (ou « eighths » : un nombre de croches, au tempo window.BPM, 128 par défaut)
//     transition  comment on y ENTRE : {type, dur} ; les 45 types sont dans /tableaux/transitions.js (crossfade, cut,
//                 dabs, swirl, inkBloom, pageTurn, ripple, iris, whip, push…) ; certains prennent un centre {cx, cy}
//
// Les scènes du moteur sont peintes pour 1920 × 1080, avec leur décor de démonstration : elles servent à voir une
// manière de peindre. Pour le sujet de la personne, écris ta scène (scenes/champ.js montre comment).

window.SCENE_LIBS = ['scenes/champ.js'];     // tes scènes, chargées d'abord
window.SCENE_DIR = '/tableaux/scenes';       // les scènes du moteur
window.FILM_SIZE = [1920, 1080];
// Le moteur garde des morceaux de décor en mémoire au premier dessin d'une scène : le film se rend dans l'ordre, d'un
// seul tenant (c'est ce que fait derush-toile rendre). « suite » le dit à Dérush ; « fps » : les images par seconde.
window.toile = {suite: true, fps: 30};

window.ERAS = [
  {id: 'champ', dur: 4.5},
  {id: '28_monet', dur: 2.5, transition: {type: 'dabs', dur: 0.6}},
  {id: '17_ink', dur: 3, transition: {type: 'inkBloom', dur: 0.7, cx: 960, cy: 620}},
];
