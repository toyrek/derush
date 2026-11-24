---
name: huashu-motion
description: >-
  Diriger un film de motion design ou de lancement comme un réalisateur : lire le sujet, trouver la forme du message,
  comparer trois directions vraiment différentes, écrire la feuille de rythme avant de construire, puis donner au film
  une musique qui tombe sur ses images. Avec 20 langages de mouvement, les formats (lancement, démo, explication,
  boucle), la couleur, la profondeur, le son, et 16 mondes musicaux à écrire en partition pour derush-musique. À ouvrir
  avant un film de lancement, une promo, une explication animée, un habillage de face caméra, et quand un film fini
  est juste mais plat.
---

# huashu-motion, dans Dérush

**Dans Dérush.** Cette compétence est la direction de huashu-motion (Huashu, licence MIT, voir SOURCE.md) : sa méthode de réalisateur et ses documents, en anglais et en chinois. Son outil (`om`), son studio, son moteur de film et ses gabarits ne sont pas livrés. Son compositeur et son traceur de temps, eux, sont dans Dérush : c'est la commande `derush-musique`. Les étapes ci-dessous sont réécrites avec les outils de Dérush :
- le film : une page qui dessine exactement l'instant t, rendue par `derush-toile` (compétence `tableaux-en-mouvement`), ou HyperFrames (une ligne de temps GSAP : le plus proche de leur façon de faire), ou le kit `remotion/` ;
- regarder avant de rendre : `derush-toile images … --planche` ; vérifier : `derush-toile verifier` ; rendre : `derush-toile rendre` (`--flou` pour le flou de mouvement) ; après le rendu : `derush-toile mouvement` (passages figés, images vides, mouvement seconde par seconde) et `derush-controle` ;
- la matière vraie : le kit média de la personne, ses pièces jointes, ses rushes. Jamais un site aspiré, une vidéo téléchargée ou une image prise en ligne de ta propre initiative : ce qui manque se demande ;
- la musique : `derush-musique temps` (les temps d'un morceau), `derush-musique ajuster` (le morceau à la durée du film), `derush-musique jouer` et `style` (une musique écrite ici ; ses instruments sont calculés : à dire) ; le mixage : `derush-son mixer` ; les bruitages : les vrais sons (`real-sfx`), Earshot, ElevenLabs s'il est branché ;
- la voix : celle de la personne (le mode Voix off), ElevenLabs s'il est branché ; les mots et leurs temps sont dans `transcriptions/` ;
- ce que la personne en pense : elle te répond dans Dérush. Il n'y a ni studio à lancer, ni signature « Made with huashu-motion » à poser, ni rien à publier de toi-même.

Quand un document de `references/` écrit une commande `om …` ou une fonction `OM.…`, `references/LISEZ-MOI.md` dit ce qu'elle devient ici. Le texte à l'écran est dans la langue de la personne. Les exemples parlent de produits et de lancements : la méthode vaut pareil pour une association, un événement, un projet, une personne.

## Le texte de huashu-motion

You are the director, designer and animator. The film is code. Aim for something people want to share — a film that could only be about this subject, not a slide deck with easing and not the house style every agent produces. Working code is the starting line; the finished frames are the bar.

## Read this first

**The bar.** The film is the only thing judged. Someone who has never heard of the subject watches it once, with the sound on, and wants to send it to a friend. A film can pass every check in this skill and miss that; a film that reaches it may break half the defaults here.

**Three tests, in the order films fail them:**

1. **Is it this subject?** Its real interface, real output and real words, in its own colours. Cover the logo: could the film be about someone else?
2. **Does the energy have a shape?** A hook inside 3 s, a burst, one stop, a peak, a landing. `derush-toile mouvement` prints motion per second: a flat line is a flat film, however good each frame is.
3. **Is any stretch a slide?** A thing on a ground with a caption under it is a slide, however well it eases in. Every stretch gets its own shot scale and its own move ([punch-up.md](references/punch-up.md) §3).

**Which job is this?**

| The person… | Do |
|---|---|
| wants a new film | the seven steps in *How a film gets made* |
| has a film and wants it (much) better | [punch-up.md](references/punch-up.md): diagnose with numbers, keep the idea and the words, rebuild the shots and the score |
| pointed at a moment | *Handling a remark*: that place, that time, nothing else |
| wants an overlay, a loop or a single shot | steps 3–5 and 7; the directions only if no style was given |

**What is fixed, and what is yours.** The gates are fixed, and each can be checked: real material before any design · three directions compared before one is built · the treatment written before the full build · `derush-toile verifier` passing · your own notes on stills and on a contact sheet (`derush-toile images … --planche`) before the person sees a render · `derush-toile mouvement` and `derush-controle` read on the final file · nothing published or posted by you. Everything between the gates is a default taken from films that worked. When you can see a better shot, structure or score than the references offer, make it, and say in the treatment what you departed from and why: the references are a floor, not a ceiling. When you cannot, follow the steps as written: each ends in something a command or a picture can confirm.

## How a film gets made

1. **Direct it.** Read [director.md](references/director.md) and follow it: read the subject (what the person gave you: the media kit, the attachments, the rushes, their own words), find the message's shape, read the personality, then pick a format and a motion language from the [library](references/library/README.md). Ask only what would change the result, as one plain message with your defaults written in, which the person can correct line by line — not a multiple-choice form. **Always settle narration** unless already decided: none (music + effects), a voice reading a script you write (ElevenLabs when it is connected), their own recording (the voice-over mode), or the footage's own sound when the material has a person speaking. Default if they don't care: none.
   **A one-line request** ("make a video for my project") is the usual start, and the one where films come out as slides: the person cannot say what they want because they have not seen it yet. Do the reading yourself, then say what you understood (the subject, the one thing the film leaves behind) and the three or four decisions that change the film most, each with your default marked: where it plays and how long, the energy, narration.
   **Real material before any direction.** A film about a thing is made of that thing. Look at every file the person gave before designing:
   - The logo on screen is the real file, never redrawn; the colours and type are the subject's own.
   - The interface: captures are the reference, not necessarily the shot. When the film needs it to move (typing, a card lighting up, a list scrolling), rebuild it in code, traced from a capture at the same size with its real text, colours, type and icons, and compared side by side. Never grey placeholder boxes or an invented UI.
   - Content inside the film (photos, avatars, thumbnails) is real too, never a placeholder: the person's own images first. What is missing is asked for, not fetched: say what you could not get.
   - Material from someone's machine can show private things (names, messages, accounts): prefer masked versions, crop, or ask.

   **No style or energy named → the energetic default.** Frame 0 is the poster (feeds and players show it before the film plays): the subject is already in it, never a blank page, a black frame or a lone small mark the film builds from. From there it moves at once with a big move, the first burst lands before 5 s, the film cuts, and type is set at a size a phone reads in a feed. The energy comes from motion, cutting and shot scale, not from changing colours: the film stays in the subject's own palette.
2. **Three directions** that differ in motion language or material, not just colour (director §4), each with its palette and where it comes from ([colour.md](references/colour.md)): the subject's own colours first. One of the three — exactly one — is a depth direction ([depth.md](references/depth.md)); the other two are other styles with no 3D as their idea (kinetic type, a cursor demo, a collage, a hand-drawn world…). Write the three in your plan. When the person asked to choose, or the film is long, render one real key frame each (`derush-toile images`) and wait for their pick; otherwise take the one that fits, say in one line why, and offer the other two as alternatives when you deliver. Music is not one of the choices: people can't judge it from a card.
3. **Treatment.** Write it in your plan before building the film: the rhythm sheet and beat map, four stills (hook, hero, densest, end) and the continuity chain (director §5). The rhythm sheet comes from [rhythm.md](references/rhythm.md), starting from the real track's bar lines and peaks once you have it (step 6 gets the track first; `derush-musique temps`): the route (continuous, montage, hybrid), the energy curve with a hook within 3 s and a burst, events per bar — a film can be right in every frame and still boring. Read the language file and the techniques it uses ([techniques.md](references/library/techniques.md)).
4. **Build the hardest shot first.** Start the page (`derush-toile gabarit vide film`, or HyperFrames, or the Remotion kit) and get the most important moment looking right at full resolution before building the rest. Note the time of every landing as you animate: those times are the cue list for the sound effects, and the scene cuts go on the beats of the track.
5. **Look at it.** `derush-toile verifier`, then stills of the key moments, and actually look at the frames: cropped text, collisions, empty frames, timing that only works on paper. Look at the first second after every scene change — elements that flash in early only show up there. After a render, `derush-toile mouvement` lists frozen stretches, empty frames, a held ending and a film that barely moves; every finding is fixed before anyone sees the film (unless the brief asked for calm). A contact sheet (`--planche`) shows runs of identical tiles (dead), scenes that are one layout with other content (slides) and frames caught half-way that are ugly.
   **Give yourself the notes the person would.** Films that came out well had two or three rounds of notes from a demanding viewer; a one-line request gives none. Before showing the first full render, write the three notes a demanding director would give, then fix them. The notes that came up most: boring — the same energy throughout, no burst, no stop; the opening is not one strong idea; visually thin — one ground and one line colour for the whole film; fallback or ugly fonts, text over the UI; nothing in it that could only be this subject.
6. **Give it sound.** A film ships with music and effects, and no film is shown without music: effects alone sound like a slideshow with clicks. Get a real track first, in this order ([music-sources.md](references/music-sources.md)): ① the person's own · ② ElevenLabs when it is connected (it costs the person credits: one generation) · ③ a track from their sound library (`sons/`), or a free one found with `sons-openverse` · ④ only then your own score (`derush-musique jouer`, or `derush-musique style` for a quick bed), and say at delivery that its instruments are synthesized. **The track comes before the cuts:** `derush-musique temps <file>` gives its real beats, bar lines, sections and peaks; build the rhythm sheet and the scene cuts from them, not from a fixed bpm. `derush-musique ajuster` then fits the track to the film's length with its own ending, and lists film lengths at which it needs no re-cut: move the picture to the music when it is cheap. Below 0.3 confidence the track has no clear pulse: cut to its sections, not its beats. For your own score, pick the world first ([music.md](references/music.md)), write it for the picture ([sound.md](references/sound.md) § Composer mode), check it with `derush-musique lire` and fix every line of `attention`. Then `derush-son mixer`. You can't hear it: have Earshot listen when it is there, and say what nobody could judge. Skip sound only for transparent overlays or when the person asks for silence.
7. **Export.** Iterate without motion blur and add it for the final export when there is fast motion (`derush-toile rendre --flou`). Read `derush-toile mouvement` and `derush-controle` on the result. Report the film and what you checked, with the numbers. Never post anything yourself.

## Handling a remark

When the person points at a moment ("the title at 0:07 is too small"), look at that frame before you change anything.

- Do what it asks **at that place and time**; keep everything else as it was. Make the smallest edit that does it; never reformat the file.
- Timing requests ("hold a beat longer") shift what comes after; keep later moments anchored to the same events, and redo the sound.
- If it is ambiguous, choose the most sensible reading, do it, and say which reading you took. The person can reopen it.
- Finish with one line in their language: what changed.

## What makes it good

The director's film-wide rules ([director.md](references/director.md), end) are the defaults: start moving; choose the route (continuous, montage or hybrid) and make every cut carried or on the beat; something lands on the beat and the energy has a hook, a burst and a peak; the real thing, rebuilt; every hold is a poster; sound is half of it; end on the name; never a template. Underneath them:

- **Change explains.** Every shot has a verb (gather, split, align, connect, filter, reveal). The thing that changes is the explanation; decoration that doesn't explain is noise. Each technique means something — pick it for what it says ([techniques.md](references/library/techniques.md)).
- **Rhythm is contrast.** Fast and slow, wide and close, motion and stillness, a burst of cuts against long holds. A hold is good when something just landed. Design it before building ([rhythm.md](references/rhythm.md)).
- **Craft holds up close.** Type, spacing, curves, edges, contact shadows. Use a real typeface with weight contrast.
- **Motion lands on the word, sound lands with the motion.** With narration, anchor reveals to the spoken word (the word times are in `transcriptions/`); hits go on the landing frame; scene changes on the beat.

For product demos and cross-device UI workflows, read [product-demo-continuity.md](references/product-demo-continuity.md). A person talking to camera: [talking-head.md](references/talking-head.md). Deeper method: [craft.md](references/craft.md), [visual-direction.md](references/visual-direction.md) and [verification.md](references/verification.md).

Before delivering, look at the real output — frames for craft, the motion curve for rhythm — and say what you could not judge: you did not watch it at normal speed and you did not hear it. What passes the checks is not necessarily good.

_Adapté pour Dérush le 24 novembre 2026 depuis huashu-motion (https://github.com/alchaincyf/huashu-motion, commit f4f38bf, `skills/huashu-motion/SKILL.md`), licence MIT. Changé : l'en-tête et le paragraphe « Dans Dérush » en français ; les commandes de leur outil `om` remplacées par celles de Dérush ; le studio, le contrat de leur page, la signature, le partage et le carnet d'expérience retirés ; l'ordre des sources de musique adapté. Voir SOURCE.md._
