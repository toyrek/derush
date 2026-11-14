---
name: film-taste
description: Grille de goût pour qu'un montage ait l'air fait par une personne et non par un gabarit ou une IA (vraies images, texte sobre, coupes voulues, son mesuré, rien de généré qui se voit). À ouvrir pour un film de marque, un documentaire, un teaser, un récit, ou quand quelqu'un dit qu'un montage fait « IA », « banque d'images », « gabarit », « diaporama » ou « cheap ».
---

# Film taste

> **Dans Dérush.** Cette page est le goût d'un film de marque ou d'un documentaire, sobre et vrai. Sers-t'en comme d'une grille de relecture, avec trois règles.
>
> 1. **Elle passe après** la demande de la personne, la recette de son métier (`LISEZMOI-IA.md`), le kit de marque de l'espace (`contexte/espace/ESPACE.md`) et `MOTION.md`. Pour un format court de réseau (TikTok, Reel, Short, extrait de podcast, trend), les sous-titres mot à mot du kit avec le mot dit mis en valeur, les entrées en `spring()`, le titre derrière la personne et un bruitage sur chaque accent restent la règle. Ne les retire pas au nom de cette page. Les lignes « Dans Dérush » plus bas disent où cela joue.
> 2. **Tout se fait avec les outils d'ici.** Le kit `remotion/` du dossier de travail et FFmpeg pour monter, `derush-son` pour la voix, le mixage et les mesures, `derush-controle` pour relire la vidéo finie, `derush-detourer` pour passer un titre derrière la personne. Rien à installer.
> 3. **Ne l'ouvre pas avant chaque vidéo.** Ouvre-la pour un film de marque, un documentaire, un teaser, un récit, ou quand la personne dit que le montage fait « IA », « banque d'images », « gabarit » ou « diaporama ».

The baseline is neutral and human: real footage, real type, real sound, cut on purpose. Nothing on screen should look like a default someone forgot to change.

**The one test.** For every choice, ask whether a working editor would have made it on purpose. If the true answer is "the tool did it", change it.

## Footage

- **Real before generated, specific before generic.** A shot of the actual thing (the real company, place, person, document or product) beats any illustration of it.
- **The stock look is the first tell.** Posed models acting out a feeling, hands typing on a white desk, glass meeting rooms, rim lit portraits, a phone on a tripod in an empty office. They read as filler even from a free library and even with a film grade on top.
- **What reads as real:** candid moments, film scans (8 mm, 16 mm, Super 8), public domain archive film, nature, science and microscopy, official uploads from the subject itself, real interviews and news, screen recordings of the real product.
- **Mix sources.** One library makes every film look alike.
- **Full frame, natural colour.** Unify with a light grade and fine grain, never a heavy LUT. A brand palette is for type, grounds and the end card, not for repainting footage.
- **Each source moment appears once.** Count by camera setup, not by file: the same stage from a new in point or a new crop is the same shot. A longer voice means sourcing more clips, not re-cutting the ones you have.
- **HD is the floor.** Do not blow up SD archive to fill a vertical frame; window it so it stays sharp.
- **Clean the frame.** Crop out watermarks, burned in captions, creator handles, laurel cards and third party logos. Check the final frames, not just the sources.

> Dans Dérush : les images viennent d'abord des rushes et de `contexte/` (ce que la personne a donné). Une image prise ailleurs demande une licence qui le permet, et son crédit : sans cela, ne la prends pas et dis ce qui manque.

## Type on screen

- **One face per position for the whole film.** For example, centred lines in one face and bottom lines in another. Never swap faces from screen to screen and never mix faces inside a line.
- **One size per screen, no italic beside roman.** Emphasis comes from the picture, a pause or a held frame, not from a second size or style.
- **Words appear as they are said:** a short fade up out of a slight blur, timed to the voice. No bounce, no pop, no scramble, no typewriter at a constant rate, no karaoke colour sweep.
- **Text never jumps.** If a face sits under the words, reframe the footage, do not move the words.
- **Legibility without boxes.** Dim the shot under the words (20 to 45 percent) and use one soft shadow. Captions on a talking head get a thin outline, no backing box.
- **Safe areas.** Keep words and logos clear of the platform UI: nothing important in the bottom fifth of a vertical frame or along the right edge.
- **Copy reads like speech.** Short, plain, spoken lines. No hype words ("seamless", "effortless", "supercharge", "game changer", "AI powered").

> Dans Dérush : « no bounce, no pop, no karaoke » vaut pour un film posé. Un format court de réseau garde les sous-titres mot à mot du kit et ses entrées en `spring()`. Sur un fond clair (une page blanche), `MOTION.md` demande une plaque sombre derrière le texte : c'est elle qui gagne. Les zones exactes du réseau visé sont dans `livraison` (`montage.json`), et `derush-controle` signale un texte coupé ou caché.

## Pace and cuts

- **Cut on the beat of the music that ships.** Pace follows the music: short bursts where the song hits, about one cut a second between, longer holds where it thins or a headline is read.
- **Never a uniform rate.** Two identical actions never take identical time.
- **Hard cuts by default.** A transition has to mean something: a match cut, a dropout to black before the turn. Whoosh, slide and zoom transitions on every cut are the template look.
- **Stillness is a move.** A held frame after a hit and a beat of black before a twist land harder than any effect.
- **Vary the structure.** If a viewer who saw the last two videos can predict this one, change its spine.
- **Land the ending.** The voice finishes, the picture holds, the music plays on and fades over 2 to 3 s. Never a dead stop.

> Dans Dérush : un format court qui doit boucler finit sur une image qui peut se rejouer (`MOTION.md`, « La fin »). La fin qui se pose, avec la musique qui continue 2 à 3 s, est celle d'un film.

## Sound

- **Music under a voice is instrumental.** Check with a stem split, never from memory or a track's title.
- **One track, continuous, chosen for this film.** Say why it fits. A commercial song is a reference for rhythm, never the track.
- **Sound effects are the exception, not the texture.** Whooshes, risers and cinematic hits on every move fight the music. In a narrated piece, at most a soft click where a photo lands.
- **Leave a real voice alone.** Cut it, fade each join, set one gain.
- **Measure loudness.** About -14 LUFS integrated, true peak at or under -1 dBTP.

> Dans Dérush :
> - une musique générée se demande instrumentale (`force_instrumental`) ; pour un morceau fourni, la séparation de pistes d'ElevenLabs le vérifie, si ElevenLabs est branché (`OUTILS.md`). Sinon, dis que tu n'as pas pu le vérifier ;
> - dans un format court, un bruitage réel sur chaque accent reste la règle (`MOTION.md`, « Le son ») ; la sobriété ci-dessus est celle d'un film raconté ;
> - pas de chaîne de traitement maison sur une voix. `derush-son clair`, en `auto`, mesure d'abord : il ne débruite pas une voix déjà propre et dit ce qu'il a fait. Garde le fichier `clair` que la personne a déjà fait ;
> - `derush-son mixer` pose la musique sous la voix et sort à −14 LUFS ; `derush-son mesurer` le vérifie sur la vidéo finie.

## Colour, texture and graphics

- **Banned:** blurred gradient blobs and aurora backgrounds, violet to indigo ramps, gradient text, lens flares and light leaks as punctuation, glow on type, glassmorphism, rainbow status chips, sparkle icons for anything AI, floating 3D UI mockups, a fake cursor gliding in perfect arcs.
- **Graphics show something true:** a number counting to its real value, a highlight bar on a real headline, a tracking box on a real object. Never invented UI or invented numbers.
- **Texture unifies.** Fine grain and a light vignette, nothing heavier.
- **Impact frames** (flashes, negatives, glitch slices, stutters) belong to hype edits, where they are the style. Keep to 3 full frame flashes or fewer in any second.

## The slideshow trap

A video looks like slides when it is a still, a centred title and a fade, repeated; a slow zoom on every photo; bullet points on screen; title cards between sections; sixty seconds of symmetric centred layouts; a logo sting at the start.

The fix: video over stills; the voice carries the information and the picture carries the proof; one idea per screen; words appear as they are spoken instead of sitting there as a slide; vary the framing; photos only where a group of pictures tells the beat better than video, laid flat and landing one per beat.

## AI generation

- **Generate only what ships.** One attempt; a second only when the first is unusable (morphing, wrong face, broken hands, reads fake), never to polish something that already works.
- **Inside real footage, keep the real pixels.** Generate only the region that must change, composite the original back everywhere else, and match grain and softness. A generated shot cleaner than its neighbours is the first tell.
- **Never generate** text, logos, real people passing as real, or anything that could be read as a real event. Turn on the platform's AI label when a film carries photoreal generated shots.
- **Agree a budget first** and report what was spent.

> Dans Dérush : on ne génère qu'avec ElevenLabs, s'il est branché, et selon ses règles dans `OUTILS.md` (les crédits sont ceux de la personne, une génération par élément, jamais le visage d'une personne réelle). Dis à la fin ce que tu as généré, et rappelle à la personne d'activer l'étiquette « contenu généré par IA » du réseau quand la vidéo porte des plans générés réalistes.

## Review like a viewer

1. Watch it on a phone, full screen, full speed, with sound.
2. Read contact sheets end to end.
3. Measure what you cannot hear or see: loudness, the tail, faces under type, duplicate shots, flashes.
4. When a person rejects something, write down what and why next to the project. The useful rules all come from rejections.

> Dans Dérush : regarder sur un téléphone, c'est la personne qui le fait ; propose-le-lui, et dis ce que toi tu as vraiment regardé et écouté. Les planches : `node remotion/images.mjs` avant le rendu, une planche à deux images par seconde après. Les mesures : `derush-controle` sur la vidéo finie, `derush-son mesurer` pour le son, la compétence `qc-skill` pour un contrôle complet. Ce que la personne a refusé, et pourquoi, s'écrit dans `carnet-ia.md`.
