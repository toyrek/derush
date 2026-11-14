---
name: talking-head-b-roll
description: À ouvrir quand une personne parle face caméra (explication, cours, pitch, extrait de podcast) et qu'il faut décider, phrase par phrase, quand on la montre seule, quand un graphisme se pose à côté d'elle et quand un graphisme plein cadre la remplace, puis caler chaque chiffre, comparaison ou étape sur le mot qui le dit.
---

# Talking-head b-roll

## Dans Dérush

Cette méthode a été écrite pour un autre moteur : des graphismes dessinés sur une page canvas, filmée par un navigateur piloté. Ce moteur n'est pas dans Dérush et ses programmes ne sont pas livrés. **Garde la méthode (le plan A / B / C, le rythme, le calage élément par élément, les contrôles) et fabrique avec le kit Remotion du dossier de travail.**

- **Les mots sont déjà là.** Ne retranscris rien : `sous-titres/mots.json` donne chaque mot du montage avec son temps et ses numéros d'image (`image_debut`, `image_fin`) ; `transcriptions/<rush>.json` donne les mots de chaque rush, en temps du rush.
- **Monte d'abord la parole** (blancs resserrés, passages choisis : `coupes.json`, puis `node remotion/recouper.mjs coupes.json`), et fais ensuite le plan A / B / C sur ce montage, en temps du montage. « The recording is never cut » veut dire ici : la couche de graphismes ne coupe, ne déplace et ne recadre jamais la parole.
- **Le plan s'écrit dans `rendu/timeline.json`** : un bloc par passage B ou C (ce qui est dit, le traitement, ce qu'on voit, le mot d'ancrage et son temps). Si le brief ne tranche pas et que l'humain peut répondre, montre-lui ce plan avant de fabriquer.
- **Chaque passage B ou C est une `<Sequence from durationInFrames>`** posée au-dessus des plans, dans `remotion/src/Montage.tsx`. B (« overlay ») : un élément transparent ; pars des pièces du kit (`Etiquette`, `CarteListe`… : `remotion/src/pieces/LISEZMOI.md`). C (« cover ») : un `<AbsoluteFill>` opaque qui porte le graphique. Tout se calcule depuis `useCurrentFrame()`.
- **Les deux horloges.** Prends le début et la fin d'un passage entre deux mots, puis pose toute la Sequence 6 images plus tôt : `from` = image du début du passage − 6 (jamais avant 0), `durationInFrames` inchangé, donc sa fin avance aussi de 6 images. La structure (carte, axes, cadre) arrive ainsi juste avant la voix. Dans la Sequence, un fait clé (montant, pourcentage, chute) reste caché tant que `useCurrentFrame()` est plus petit que `image_debut` de son mot − `from`. Ne décale pas la fin d'un passage qui finit avec la vidéo : sinon la personne réapparaît un instant sur les dernières images.
- **Le visage** (`FACE` dans le texte) : la boîte qui contient la tête pendant tout le passage, en parts de l'image, gardée dans une constante. `analyse/<rush>.json` (`cadrage`, points `visage`) dit où est le visage au fil du rush ; vérifie la boîte sur des images fixes du plan, par exemple `ffmpeg -v error -y -ss <s> -i plans/<plan> -frames:v 1 -vf "drawbox=x=iw*<gauche>:y=ih*<haut>:w=iw*<largeur>:h=ih*<hauteur>:color=red:t=6" atelier/visage-<s>.jpg`, à trois ou quatre moments. Si la personne bouge, prends la boîte la plus large.
- **Les couleurs et les polices** sont celles du projet (`style` dans `montage.json`, polices du kit, `usePolices()` des pièces avant toute mesure de texte). Rien ne se charge en ligne.
- **Les tailles de Dérush gagnent** : un texte fait au moins 2,8 % de la hauteur de l'image, une accroche 7 % ou plus ; en vertical, rien d'important dans les zones couvertes par TikTok, Reels ou Shorts (`ZONE_SURE` des pièces). L'accroche de Dérush (un grand titre derrière la personne) va très bien sur le premier passage A.
- **Contrôler** : avant le rendu, `node remotion/images.mjs --de 0 --a <durée> --pas <images par seconde du projet>` pour la planche (une image par seconde ; 120 images au plus par appel, donc un film de plus de deux minutes se regarde en plusieurs fois), et `--de <s> --a <s> --pas 1` autour de chaque entrée et de chaque sortie ; rends avec `node remotion/rendre.mjs Montage rendu/final.mp4`, puis `derush-controle rendu/final.mp4`. Les contrôles automatiques de l'outil d'origine sont devenus la liste de la partie 4 : fais-les toi-même.
- Pour des plans de coupe faits de vraies images (archives, documents, captures), ouvre plutôt `find-broll`.

## The method

The user's recording is already good: the words and delivery are final. A talking head alone is dull to watch, so the film's job is to decide, for each stretch of speech, what the picture shows. The voice never stops; only the picture changes.

The recording is never cut, moved, cropped or scaled. Everything you make is a layer drawn above it: transparent where the speaker should show, opaque where a graphic covers them.

Make it in one go: don't ask questions the recording or a sensible default answers, and list what you chose when you deliver.

## 1. Read the transcript

Read the whole transcript, with every word timed, before deciding anything. A transcript can mishear a figure: if one doesn't add up with the rest of what is said, keep it off screen and say so when you deliver.

## 2. Plan: three treatments

**A. Speaker.** The video alone, nothing over it. Use where the person is the point: the opening line, a personal opinion or story, an emotional beat, the call to action, the closing line.

**B. Overlay.** The video stays visible; a transparent motion layer sits on top: a keyword or short phrase, a number counting up, an icon, an arrow, a logo, a short list building item by item. Use when a line has one concrete thing worth seeing while the speaker is still worth watching. Keep overlays toward the edges and the top or bottom third, where they will not sit on the speaker's face. One idea on screen at a time; it leaves when the line moves on.

**C. Cover.** An opaque full-frame motion scene hides the speaker while their voice carries on. Use when the line is better shown than said by a face: numbers and comparisons, a process or sequence of steps, how something works, a product or interface, anything with three or more parts. The motion should explain the line, not decorate it.

Split the transcript into lines at sentence or clause ends. Give each line A, B or C with a one-sentence reason, and say what B or C shows. Then check the rhythm:

- Open on A, so the viewer meets the person; close on A.
- No stretch of A longer than about 8 seconds; break it with B or C.
- A C stretch runs about 3–8 seconds; return to the speaker between C stretches so the film does not become a slideshow with a voice-over.
- Plan treatment changes at line boundaries and overlay reveals at the words they illustrate; choose which elements lead or synchronize using the timing rules below.
- Prefer fewer, clearer treatments over a change every line.

### Visual timing: decide per beat

Choose timing for each meaningful element, not once for the entire B-roll layer. Record its spoken word/phrase, timestamp, timing choice and a short reason in the plan:

| Timing | Use for | Clock |
| --- | --- | --- |
| Lead by about six frames | Context the eye can prepare: axes, cards, objects, process structure | structure clock (leads the voice) |
| Sync to the relevant word | New key facts: amounts, percentages, prices, ranks, final chart values | audio clock (the word's real time) |
| Wait for the reveal | Punchlines, negations, withheld answers and conclusions | audio clock, gated at the revealing word or phrase |

For “revenue grew 30%,” bring in the chart structure early, then make 30% readable and land the final bar value together on “30%.” Synchronization means the information is readable or settled, not merely that a long fade/count-up has started. Preparatory motion can start earlier, but must not reveal the answer early. Previously stated values can remain visible as context.

Keep scene boundaries and word anchors in transcript time. The structure clock runs about six frames ahead of the voice (240 ms at 25 fps, 200 ms at 30 fps): entrances, exits and structure follow it, while the audio clock stays the actual playback time. Gate each synchronized fact on its word's start, on the audio clock. Apply the lead once: do not shift the anchors as well, or retime the finished layer afterwards. Use a lead of 0 for exact-sync requests; within a mixed scene keep factual and withheld content on the audio clock.

Keep the recording, audio, captions and film length unchanged. Check that a shifted scene exit does not hide a synchronized reveal or cut its readable hold short; extend/replan that scene and its neighbor when needed. Preserve a speaker-only opening and closing. Listen around the anchors: estimated word times are not guaranteed frame-accurate. This is an editorial default informed by our sample review, not a universal perceptual rule.

Full burned-in captions are not part of this: add them only when the user asks. A B overlay's text is a few key words, not the sentence being spoken.

Text on screen uses words the speaker actually says, or numbers and names from the transcript or the user's materials. Do not invent figures, claims or quotes.

## 3. Build the layer

- `FACE`: where the speaker's head is (with hair, and a little room around it), as fractions of the frame. Look at stills of the recording with the box drawn on them; adjust until it holds the head in every still.
- Scenes: one per B or C stretch, with its start, its end and its kind (overlay or cover), times taken from the word timings. Everything not in a scene is A. Two scenes can meet (one's end is the next one's start); a sliver of the speaker between them reads as a flicker.
- One drawing per scene, written for what that line says. Give each an entrance and an exit (about half a second in, a little less out); structure follows the leading clock, synchronized facts and withheld reveals follow the audio clock and the original word anchor.

Surfaces default to LIGHT. Go dark only when (a) the user or brand explicitly asks for it, or (b) the subject inherently lives on a dark surface (terminal/code, night sky, cinema). Neon-on-black is the cliché default of every AI video; picking it unprompted is a design failure.

Fonts: list every face and weight you draw with and make sure each is loaded before measuring or drawing, so nothing renders in a fallback font.

## 4. Check it

The original tool checked the plan against the transcript and against the pixels of every frame. Do the same from your plan and the word timings, then on a contact sheet (one frame a second, over the recording) and on full-size stills of every scene. All of these must hold:

- every cover hides the speaker completely once its entrance is over (the original check asked for at least 98.5% of the frame opaque);
- no overlay reaches into `FACE` (at most 3% of the box), and an overlay never paints the whole frame: that is a cover;
- every speech anchor (a scene's start or end) falls between words; the displayed graphic may lead it;
- nothing is drawn outside a scene;
- no text runs off the frame or onto other text; text within 3% of the frame's edge is at risk, some players crop there;
- an overlay never shows an empty card: a shape with no words for more than 0.6 s reads as a glitch, so bring it in with its first words or start the scene later; an overlay that covers more than 40% of the frame is heavy for an overlay;
- less than 1 s of the speaker between two scenes reads as a flicker: let the scenes meet, or give the speaker a real beat.

Rhythm warnings: a long stretch of only the speaker (more than about 8 s), a cover shorter than 3 s or longer than 8 s, covers back to back, not opening or closing on the speaker. A warning can stand when you have a reason, so say it.

No check can tell whether a graphic says what its line says, whether text is legible, or whether it runs off its card or across a line of a chart: look at the sheet for the flow and at stills of every scene for the text. Fix and look again until it holds up.

## 5. Render and deliver

Hand over the finished film (the recording, the b-roll over it, the original sound) and the plan as a short table: time, what is said, treatment, what is on screen. Say what you chose that they didn't ask for.
