---
name: motion-effects
description: Sixteen motion-design effect recipes (button to player, search to results, card to workspace, tabs to panels, chart morph, dashboard zoom, spring stack, magnetic dock, masked type, elastic type, text to layout, image reveal, perspective shift, glass focus, flowing paths, particle logo), each with its start state, end state, timing and the one detail that makes it look designed, to open when a motion-design scene has to show a product, a number, a word or a logo changing shape.
license: MIT
---

# Motion effects, built in your brand

## Dans Dérush

Note ajoutée par Dérush. Le reste est le texte de l'auteur (Charlie Hills) ; ce qui a été retiré ou adapté est dit dans `SOURCE.md`. Ses recettes visaient une page HTML pilotée par `window.seek()` : ici, chaque effet est une composition du kit Remotion. Les seize recettes (`references/effects.md`) sont celles de l'auteur, telles quelles.

- **Où.** Un fichier par effet dans `remotion/src/`, posé dans `Montage.tsx` ou enregistré comme composition dans `Racine.tsx`, au format du montage (`sortie` dans `montage.json`). Les recettes comptent en secondes : convertis une seule fois, images = secondes × fps (`sortie.fps`). À 30 images par seconde, la boucle de 8 s fait 240 images : mouvement de l'image 0 à 66, tenue jusqu'à 198, retour jusqu'à 240 (à 25 images par seconde : 0 à 55, 165, 200).
- **Une seule horloge** : `useCurrentFrame()`. `interpolate` avec `Easing.inOut(Easing.cubic)` pour le mouvement et le retour, `spring()` avec un amortissement par carte pour la pile (effet 07), `random('graine')` de Remotion pour tout ce qui est tiré au hasard (effet 16). Jamais `Math.random()`, de minuterie ni d'animation CSS.
- **La marque.** Là où les recettes parlent des couleurs et des polices de la marque : `contexte/espace/ESPACE.md`, `style` dans `montage.json` (accent, polices), la charte, le logo et les polices joints (`contexte/INDEX.md`), et `rendu/design.md` s'il existe (compétence `video-design`). Dans Dérush, `MOTION.md` est le guide « Bien animer » : lis-le, ne l'écris jamais.
- **Les polices et les images.** `usePolices()` des pièces du kit (ou `delayRender`) avant la première image ; les images dans `remotion/public/`, par `staticFile()`. Le vrai logo, jamais redessiné.
- **Regarder avant de rendre** (étape 4). `node remotion/images.mjs <Composition> --images 0,30,66,132,198,237,239`. Une composition de 240 images va de 0 à 239 : pour vérifier la boucle, rends une fois 241 images et compare la 240 à la 0, puis reviens à 240.
- **Rendre** (étape 5). `node remotion/rendre.mjs <Composition> rendu/effet.mp4`, puis `derush-controle rendu/effet.mp4`. Un GIF qui boucle se tire du MP4 avec FFmpeg (compétence `ffmpeg-skill`).
- **Ce qui reste sur la planche de démonstration.** Plusieurs recettes décrivent des annotations faites pour expliquer l'effet : le petit graphe de la courbe (effet 07), la courbe en pointillés au-dessus du dock (effet 08), le compteur « wdth » et la ligne de base étiquetée (effet 10), « Mark 01 », « assembling » et « assembled » (effet 16). Ne les mets pas dans une vraie vidéo, sauf demande. Le fantôme de l'état de départ et les repères qui relient départ et arrivée, eux, font partie de l'effet.
- **Dans un montage, sous une voix** : le mode « hold » (le mouvement une fois, puis l'image finie) ; pour un format court, l'auteur ne garde que le cœur du mouvement (environ 1,4 s, soit 42 images). Les chiffres viennent du brief ou des fichiers donnés ; un chiffre d'exemple garde son étiquette « exemple » à l'écran.
- **L'effet 10 (elastic type)** change la largeur des lettres : il lui faut une police variable avec un axe `wdth` ; sans elle, étire chaque lettre avec `scaleX`.
- **Le goût avant l'effet.** Un effet sert une idée (un objet qui en devient un autre), pas le décor : `MOTION.md` range les halos et les particules sans raison parmi ce qui trahit une vidéo faite par une machine. Si le projet a un `rendu/design.md`, un effet qui déroge à une de ses règles (le verre de l'effet 14, les lueurs de l'effet 15) se note sous « Rules turned off ».

---

Sixteen effects that make a product, a number or a word move like it was made by a motion designer. Each one is a recipe: what it is, where it starts, where it ends, when each part moves inside an 8-second loop, and the one detail that makes it look premium. You pick the effect, give it your real words, and it gets built from scratch in your colours and type.

**Before you start:** find the brand ("Dans Dérush" above says where it lives): hex codes, a font and a logo file. Never call a result on-brand without them.

## Step 1: Settle four things

Take them from the brief and the attached files. Ask only when the person is there to answer and the brief leaves it open; working alone, choose and say what you chose.

1. **The effect.** One of the 16 by name or number. If they describe a job instead ("show our pricing", "reveal the launch name"), suggest the two effects from the table below that fit best and let them pick.
2. **The real content.** The words, labels and numbers that go in it. Real figures, or say they are samples.
3. **The size.** 1080 x 1080 (square), 1080 x 1350 (LinkedIn portrait), 1080 x 1920 (Reel) or 1920 x 1080 (YouTube).
4. **Loop or hold.** Loop repeats forever (a post or a GIF). Hold plays once and stays on the finished frame (under a voiceover, so it never resets mid-sentence).

| # | Effect | Use it when you |
|---|---|---|
| 01 | Button → player | add a "watch the demo" moment to a landing page or launch email |
| 02 | Search → results | show what people find in your help centre or content library |
| 03 | Card → workspace | announce a feature, and one small card becomes the whole editor |
| 04 | Tabs → panels | compare plans, packages or channels without a wall of text |
| 05 | Chart morph | drop a weekly result into a client report or results post |
| 06 | Dashboard zoom | pull the one KPI that matters out of a dashboard |
| 07 | Spring stack | show three offers, case studies or testimonials in turn |
| 08 | Magnetic dock | show the tools you use, or a product's integrations |
| 09 | Masked type | reveal a campaign name, issue number or launch headline |
| 10 | Elastic type | open an event, webinar or podcast with a title card |
| 11 | Text → layout | turn a headline into a carousel cover or article teaser |
| 12 | Image reveal | tease a product drop, then swap in your own photo |
| 13 | Perspective shift | explain the layers of a service, brand system or stack |
| 14 | Glass focus | make people read the one line of a report that matters |
| 15 | Flowing paths | show one piece of content feeding several channels |
| 16 | Particle logo | close a video, reel or post on your mark |

## Step 2: Read the recipe

Open `references/effects.md` and read the chosen effect in full: start state, end state, timing, the premium detail. The recipe is the spec. Swap the demo words for the user's real ones, and map every colour role (ground, surface, ink, muted, accent, second accent) to a colour of the brand.

## Step 3: Build it

Build one composition (one file in `remotion/src/`) to these rules:

1. **One clock.** Every frame is worked out from the time alone (`useCurrentFrame()`), so the exact frame for any moment can be drawn in any order, as often as it is asked for. No `setTimeout`, no CSS animations running on their own, no randomness that is not seeded.
2. **One loop, 8 seconds.** Move from 0.0 to 2.2, hold to 6.6, return by 8.0. Second 0 and second 8 must draw the same frame. In hold mode, play the move once and stay on the finished frame from 6.6 onwards.
3. **Back to the start.** The return eases every element back to exactly where it began. Nothing snaps home.
4. **Real content, never lorem.** The user's words and numbers. Sample numbers carry a visible "illustrative" or "example" label on every frame.
5. **Self-contained.** Fonts and images are local files of the project, no network requests, so it renders the same every time.
6. **Scale the effect up.** It fills the frame at the chosen size, inside the project's margins and safe zones. It is not a small tile in a big empty canvas.

## Step 4: Check it before you show it

Capture frames at 0, 1, 2.2, 4.4, 6.6, 7.9 and 8 seconds and look at every one.

- **The loop:** frame 0 and frame 8 are identical.
- **The move:** frames 0, 1 and 2.2 are all different. If two match, part of the effect is not running.
- **The fit:** no text runs past its box, and nothing is cut off at any of the seven moments.
- **The still:** pause on 4.4. The point of the effect reads from that single frame.
- **The brand:** every colour and font on screen comes from the brand.

Fix what fails, capture again, and only then show the user the 2.2 and 4.4 frames with the file path.

## Step 5: Export it

Render the composition to an MP4 in H.264 at the chosen size, at the project's frame rate (240 frames for 8 seconds at 30 frames per second). If a GIF is wanted, make one that loops forever from the MP4. Look at three frames from the finished file to check it came out right.

## What I learned the hard way

- **"Make it premium" means one object changing shape.** Every one of the 16 effects is a thing turning into another thing: a button into a player, bars into a line, a card into a window. A fade from one picture to another looks cheap every time.
- **The hold is where people actually look.** 4.4 of the 8 seconds is the hold. If nothing moves in it, the loop feels dead. Each recipe keeps something small alive there: a progress bar, a cursor, a second wave of light.
- **A ghost of the start state sells the change.** A faint outline left where the button or card began lets the eye follow the move. Without it the end state looks like it appeared from nowhere.
- **Stagger by a beat, not all at once.** Rows, slats, letters and dots each start a fraction later than the last. Everything moving together reads as a slide transition.
- **Frame 0 drew in the wrong font.** An embedded font does not load until something uses it, so the first frame can paint in a fallback. Load every font explicitly before the first frame is drawn.
- **Scale it up, do not redraw it.** An effect drawn with fixed coordinates ends up in one corner when you just change the canvas size. Scale the whole drawing to fill the frame instead.
- **Eight seconds is too slow for a Reel cut.** A full loop dropped into Instagram B-roll failed a motion check. Cut the active move (about 1.4 seconds of it) and use hold mode under narration.
- **Pick one unit for time and keep it.** The recipes use seconds everywhere; in the composition, turn them into frames in one place.
- **Label made-up numbers on the frame.** I made up every figure on my own board for the demo, so every effect carries an "example" label until real numbers go in.

## Hand off

Give the user the MP4 (and the GIF if one was asked for), with the three checked frames. Then offer the next step in one line: another effect from the same group, or a vertical version with safe-zone text.
