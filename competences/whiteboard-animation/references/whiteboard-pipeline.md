# Whiteboard Pipeline — Cookbook

From raw idea to a finished scribe: turning art into drawable paths, authoring draw order, handwriting, the marker hand asset, pacing to narration, and the build sequence.

> **Dans Dérush.** La mise en œuvre est celle de `draw-on-recipes.md` (Remotion, dans le kit `remotion/`). Les
> passages « Dans Dérush » sont des ajouts ; le reste est le texte de l'auteur, avec ses mentions d'outils absents
> d'ici remplacées.

## 1. Convert art to drawable single-stroke SVG

Draw-on animates strokes, not fills. The art must be open paths in the order a hand would draw them.

- **Author as line art**: draw with open strokes. Set fill to none, stroke to a real weight. Each visible line = one path.
- **Tracing a raster**: auto-trace gives filled compound shapes — the wrong thing. Either redraw the centerlines by hand, or trace, then run a centerline/stroke extraction so each region becomes a single stroke.
- **Filled shapes**: a solid blob has no stroke to animate. Draw its outline as a stroke (draws on), then reveal the fill behind it after the outline completes (see fill-after-outline in draw-on-recipes).
- **One path, one lift**: keep a line continuous where a real pen wouldn't lift; split into separate paths only at natural pen lifts.
- **Real lengths**: `evolvePath` and `getPointAtLength` measure each path themselves; do not add `pathLength="1"`.

> Dans Dérush : il n'y a ni Illustrator, ni Inkscape, ni outil de vectorisation. Tu écris les tracés toi-même, dans
> les coordonnées de la vidéo (1080 × 1920 ou 1920 × 1080) : lignes (`M x y L x y`), courbes (`C`, `Q`), arcs. Le
> style du tableau blanc est simple par nature : ampoule, flèche, maison, bonhomme, graphique, bulle. Si la personne
> fournit un dessin au trait en SVG, garde ses tracés ouverts et range-les dans l'ordre du geste.

Quick check that a path is drawable:

```tsx
import {getLength} from '@remotion/paths';
getLength(d) > 0;   // finite and > 0: it has a stroke to draw. Draw it with fill="none".
```

## 2. Author the draw order

The hand draws one tip at a time, in list order. Order the paths in the sequence a person would draw them.

- Top-to-bottom, left-to-right within a drawing, the way you'd sketch it.
- Structure before detail: outline first, then interior lines, then shading.
- Group each logical drawing as one beat (one `planifier()` call) so the build plays beats in order and holds between them.
- Keep handwriting blocks as their own elements, words in reading order.

## 3. Handwriting

- **Marker font**: the kit's `Permanent Marker` reads as marker handwriting. It is loaded by `usePolices()`; measure the words only after it returns `true`, so their width is right.
- **Glyphs to paths**: true per-letter draw-on needs a single-stroke (centerline) font converted to paths, drawn glyph by glyph in writing order. The kit has none: an outline font traced along its contours does not look like writing.
- **Fast fake**: keep live `<text>`, clip it with a rectangle, and sweep the clip left-to-right while the hand rides the edge — looks written without per-glyph paths (`mot()` in draw-on-recipes).
- **Cadence**: handwriting draws fast (150–250ms/letter); don't draw letters at illustration speed or it drags.

## 4. The marker hand asset

- A marker or a hand holding a marker. The **nib** (pen tip) must be at a known, fixed point in the art.
- **Calibrate the nib once**: drop the hand on a test path, freeze a few moments mid-stroke, and adjust the offset until the tip rides exactly on the line. Reuse that offset everywhere.
- **One hand for the whole piece** for consistency. Mirror it only if a left hand is needed (re-measure the nib after mirroring).
- Add a soft drop shadow under the hand for depth; remove/fade it during holds when the hand is lifted off the board.
- Keep the hand on top of everything (last in the SVG) so it's never drawn over.

> Dans Dérush : le `Feutre` de draw-on-recipes a sa pointe à l'origine, déjà calibrée. Une photo de main ne vient que
> de la personne, ou d'une image générée par ElevenLabs si elle est branchée (note-le dans ta fiche) ; jamais d'une
> image trouvée sur le web sans licence. Pour la calibrer : `node remotion/images.mjs <Composition> --images …` sur
> trois images au milieu d'un trait.

## 5. Pace draw time to the VO line

Draw-on duration tracks the spoken line, not a fixed timer (same VO math as the explainer-video skill).

- Baseline VO pace ~2.3 words/sec; set a drawing's total draw time to roughly the duration of the line it illustrates.
- A label the narrator names should finish drawing right as the word is spoken.
- Add a 0.4–1.0s hold after each element lands; move the hand off-board during the hold.
- Slow the hand on emphasis strokes; speed minor connective lines.
- Never let the hand idle on a finished board while narration continues — lift it or start the next beat.

```
seconds_to_draw ≈ line_words / 2.3          // match the narrated line
hold_after      ≈ 0.4–1.0s                  // beat to let it land
```

> Dans Dérush : en français, prends la durée réelle de la phrase dans la voix générée (temps des caractères rendus
> par ElevenLabs `with-timestamps`, ou `sous-titres/mots.json`) plutôt que ce calcul, et passe-la à
> `planifier(traits, {depart, duree})`.

## 6. Storyboard → board build sequence

```
BEAT 01 | VO: "Every project starts with one idea."
  DRAW : lightbulb outline (1.0s) → fill glow (0.4s)
  HOLD : 0.6s, hand lifts off-board
BEAT 02 | VO: "...that grows into a plan."
  DRAW : arrow from bulb → box (0.5s), handwriting "PLAN" (0.8s)
  HOLD : 0.6s
WIPE   : clear board left→right (0.6s) before the next section
BEAT 03 | ...
```

Build rules:

- One beat = one VO line = one drawing/handwriting element. Split a beat that has two ideas.
- Elements draw in narration order, one at a time — never two tips at once.
- Outline → fill → label, within a beat.
- Consistent erase grammar (always wipe the same direction) between sections; clear before the board over-clutters.

## 7. Finish checklist

- [ ] Every drawable path is an open stroke with `fill="none"` (or fill revealed after its outline).
- [ ] Paths ordered in true draw order; animated in that order.
- [ ] Nib offset calibrated; hand tip rides the line at every frozen mid-stroke frame.
- [ ] Hand lifts between strokes/beats; no sliding across blank board.
- [ ] Handwriting in reading order, at letter cadence.
- [ ] Each beat's draw time matches its VO line; hold after each.
- [ ] One consistent wipe/erase grammar between sections.
- [ ] Every drawing is complete before the wipe or the cut.

---
Order the strokes the way a hand would, glue the nib to the tip, and the board draws itself.
