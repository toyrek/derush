---
name: whiteboard-animation
description: À ouvrir pour une vidéo façon tableau blanc (style VideoScribe ou Doodly) : des dessins et des mots qui se tracent trait par trait, un feutre qui suit la pointe, l'ordre du dessin calé sur la voix off, le remplissage après le contour et l'effacement entre deux parties.
---

# Whiteboard Animation

> **Dans Dérush.** Ce savoir vient d'iart.ai (voir `SOURCE.md`). L'original livrait d'abord une page web (GSAP,
> minuteurs) et donnait un portage Remotion qui ne marchait pas (main invisible, position calculée une image en
> retard). Ici tout est en Remotion, dans le kit `remotion/` du dossier de travail, et la recette complète
> (`references/draw-on-recipes.md`) a été rendue image par image : feutre sur la pointe, levées entre les traits,
> remplissage, écriture, effacement.
>
> | Ce qu'il te faut | Où c'est |
> |---|---|
> | Un trait qui se dessine | `evolvePath(k, tracé)` de `@remotion/paths` (déjà dans le kit) |
> | La pointe du feutre | `getPointAtLength(tracé, longueur * k)` et `getLength(tracé)`, calculés pendant le rendu (pas de `useEffect`, pas de DOM) |
> | Le feutre | dessiné en SVG (composant `Feutre` de la référence) : aucune image à chercher. Une photo de main ne vient que de la personne, ou d'ElevenLabs si elle est branchée. Jamais une image prise sur le web sans licence. |
> | L'écriture | la police `Permanent Marker` du kit, révélée par un masque que le feutre suit |
> | Caler le dessin sur la voix | les temps des mots : voix off ElevenLabs `with-timestamps`, ou `sous-titres/mots.json` |
> | Regarder avant de rendre | `node remotion/images.mjs <Composition> --images …` (dont une image AU MILIEU d'un trait), puis `node remotion/rendre.mjs` et `derush-controle` |
>
> Les passages « Dans Dérush » sont des ajouts ; le reste est le texte de l'auteur.

The VideoScribe / Doodly look: a hand draws illustrations and handwriting onto a board, stroke by stroke, while narration explains. Build it from animated SVG paths that draw themselves plus a marker hand that tracks the drawing tip, then sequence elements so the board fills up in narration order.

## When to use

- A "scribe" / doodle explainer where a hand draws art and text onto a whiteboard.
- Animating a sketch or logo being drawn live, line by line.
- Handwriting that writes itself in, synced to a voiceover.
- Turning a static illustration into a guided, stroke-by-stroke reveal.

## Core mechanic: SVG stroke draw-on

A path "draws itself" by animating `stroke-dashoffset` from its full length down to 0 — the dash gap shrinks, exposing the stroke from start to end. In Remotion, `evolvePath(k, d)` returns exactly that pair of `strokeDasharray` / `strokeDashoffset` for a progress `k` from 0 to 1, measured on the path's real length:

```tsx
import {evolvePath} from '@remotion/paths';
// k: 0 → 1, a pure function of the frame
<path d={d} fill="none" stroke="#1a1a1a" strokeWidth={6} strokeLinecap="round" {...evolvePath(k, d)} />
```

Use real lengths everywhere: do **not** add `pathLength="1"` to a path drawn this way (the dash values would be read in the wrong unit and the stroke would show almost whole from the start). `linear` progress (or a very gentle ease) reads as a steady hand; avoid `ease-in-out` on long strokes — it makes the marker lurch.

> Dans Dérush : la recette donne à chaque trait une durée égale à sa longueur divisée par une vitesse : le feutre va
> toujours au même pas, comme une vraie main.

## The marker hand follows the tip

The illusion lives or dies on the hand sitting at the exact point being drawn. Sample the path at the current draw progress and place the hand there each frame; the pen-nib of the hand asset must align to the path point (offset the image so its tip, not its corner, lands on the point).

```tsx
import {getLength, getPointAtLength} from '@remotion/paths';
const len = getLength(d);                      // real length, computed during the render
const p = getPointAtLength(d, len * k);        // current tip, in SVG coordinates
// the hand is an SVG <g> whose origin is the nib: <g transform={`translate(${p.x} ${p.y})`}>…</g>
```

`getPointAtLength(d, len * k)` is the workhorse: it returns the on-path coordinate at the same progress driving the dash, so the nib stays glued to the growing stroke. Lift the hand (fade out, jump to the next start) between separate strokes so it doesn't slide across blank board.

The hand must be SVG inside the `<svg>` (a `<g>`, or an `<image href={staticFile('main.png')}>`): `transform` set on an HTML `<img>` placed in an SVG does nothing, and an HTML element inside an SVG `<g>` is not drawn at all.

## Reveal order — the board fills up

Sequence elements the way a person would draw the scene, in narration order: each illustration and each handwriting block draws in, holds, then the next begins. Stagger strokes within one drawing; hold a beat after each element lands before moving the hand on. One drawing = one beat of the VO. Don't draw two things at once — the eye (and the single hand) can only follow one tip.

| Step | Mechanism |
|---|---|
| Draw a stroke | `evolvePath(k, d)`, hand at `getPointAtLength(d, len*k)` |
| Multi-stroke drawing | strokes in array order; hand hops (lifted) to each new stroke's start |
| Handwriting | a word revealed left to right by a mask, hand riding the mask edge |
| Hold | pause hand off-board after element completes (0.4–1.0s) |
| Next element | move hand to next start; begin its draw-on |
| Erase / clear | wipe or reverse-draw to clear the board for the next section |

## Converting art to drawable paths

Draw-on needs **single-stroke, open paths in draw order** — not filled compound shapes.

- Author or trace line art as open strokes (outline, not fill). A filled blob has no "stroke" to animate; convert fills to a centerline stroke or draw an outline path and fill it after the outline completes.
- Order matters: the paths should be listed in the order a hand would draw them — animate them in that order.
- Long continuous lines look most natural; break only where a real pen would lift.
- For solid color regions: draw the outline stroke first, then fade/grow the fill in behind it (`opacity` or a clip-reveal) so it reads as "colored in after."
- Handwriting: per-letter draw-on needs a single-stroke font converted to paths. Or fake it: mask the word and sweep a reveal left-to-right with the hand riding the mask edge.

> Dans Dérush : tu écris toi-même les tracés SVG (`M`, `L`, `C`, `Q`…) dans le format de la vidéo : une ampoule, une
> flèche, une maison, un bonhomme, une courbe. Reste simple, c'est le style du genre. Il n'y a pas d'outil pour
> vectoriser une photo : pour un dessin compliqué, demande une illustration au trait à la personne, ou passe à un autre
> style. `Permanent Marker` (police du kit) a des lettres à contour : tracer ces contours ne donne pas un geste
> d'écriture, d'où l'écriture par masque.

## Marker hand asset

A PNG/SVG of a hand holding a marker, with the nib at a known point. Measure the nib offset once and reuse it. Keep one hand asset for the whole piece for consistency. Mirror it (`scale(-1, 1)`) only if you need a left hand. Add a faint shadow under the hand for depth; drop it during holds when the hand is "off."

> Dans Dérush : le composant `Feutre` de la référence est un feutre dessiné en SVG, pointe à l'origine, avec son
> ombre qui s'écarte quand il se lève. Rien à télécharger. Une vraie main en photo : seulement celle que la personne
> donne, ou une image générée par ElevenLabs si elle est branchée ; mesure alors la pointe une fois (images fixes à
> plusieurs moments d'un trait) et note sa provenance.

## Erase / wipe transitions

Between sections, clear the board so it doesn't get cluttered:

- **Wipe**: animate a clip rectangle across the filled group to wipe it away, hand optionally "erasing."
- **Reverse draw-on**: run `evolvePath` from 1 back to 0 to un-draw, hand following backward.
- **Fade + redraw**: cross-fade the old group out and start the next group's draw-on.

Keep one clear grammar (always wipe left-to-right, say) so transitions feel deliberate.

## Pacing to narration

Draw-on duration should track the spoken line, not a fixed timer. Estimate from VO at ~2.3 words/sec; set each drawing's total draw time to roughly the length of the line it illustrates, plus a short hold. A label that the VO names should finish drawing right as the word is spoken. Slow the hand for emphasis lines; speed minor connective strokes. Never let the hand idle on a finished board while narration continues — move it off or start the next element.

> Dans Dérush : 2,3 mots par seconde est un repère anglais. Génère la voix d'abord, puis prends la vraie durée de
> chaque phrase (temps des caractères de la réponse `with-timestamps` d'ElevenLabs, ou `sous-titres/mots.json`) :
> `planifier(traits, {depart, duree})` répartit alors le dessin exactement sur la phrase.

## Output checklist

- Every stroke is a single open path in draw order; nothing pops in fully formed.
- The hand nib sits exactly on the draw tip throughout each stroke (no float, no lag).
- Hand lifts cleanly between separate strokes/elements; no sliding across blank board.
- Elements draw in narration order, one at a time; each holds before the next.
- Handwriting draws in reading order; fills appear after their outline.
- Erase/wipe grammar is consistent; the board never over-clutters.
- Draw timing tracks the VO line it illustrates.

## Deliver & verify

> Dans Dérush, cette partie remplace celle de l'original (une page HTML vérifiée avec Playwright).

1. The board is a Remotion composition in `remotion/src/`; the stroke progress AND the hand position come from the same schedule and the same frame (no timers, no `useEffect`, no DOM measurement). Its length comes from the schedule (`calculateMetadata`, or the end of the last beat).
2. Freeze with `node remotion/images.mjs <Composition> --images …` at start, mid-stroke, between two strokes, during a hold, and at the end. Pick at least one frame in the *middle of a stroke* — that is where the hand-on-tip illusion is proven or broken.
3. **Inspect** each full-size image — **fidelity**: at a mid-stroke frame the nib sits exactly on the leading tip of the drawn portion (not ahead, not behind, not floating); the path is drawn only up to the tip; at the end every stroke completes cleanly with no gaps, no overshoot, no leftover dash. **Artifacts**: hand sliding across blank board between strokes, nib offset wrong, strokes drawing out of order, fills appearing before their outline, clipped/off-canvas drawings, text drawn before the kit fonts loaded.
4. Iterate (nib offset, stroke order, durations) and re-freeze until each image looks like a hand mid-draw. Then `node remotion/rendre.mjs`, and `derush-controle` on the video.

## Reference files

- `references/draw-on-recipes.md` — the complete, tested Remotion recipe: the schedule (constant speed, or fitted to a spoken line), the nib position at any time (on the tip, hopping lifted, off-board during holds), strokes + words + fills read from one schedule, the SVG marker, handwriting by mask, erase/wipe and reverse draw, and a full two-beat composition.
- `references/whiteboard-pipeline.md` — turning art into drawable single-stroke SVGs, draw-order authoring, handwriting, the marker hand and nib calibration, pacing draw time to the VO line, and the storyboard-to-board build sequence.
