---
name: video-design
description: Visual design for the scenes you draw in a video (title cards, data scenes, motion design, a whole video's palette) - colour by act, a five-step type scale, layout, chart and transition rules for 16:9 and 9:16, motion timing, a one-page design.md that records the decisions and a contact-sheet critique of the render, to open when deciding or refining how a video looks, when choosing its colours, or when a scene looks generic or busy.
license: MIT
---

# Video design

## Dans Dérush

Note ajoutée par Dérush. Le reste est le texte de l'auteur (Digital Samba), écrit pour sa propre boîte à outils Remotion ; ce qui a été retiré ou adapté est dit dans `SOURCE.md`.

- **Quand s'en servir.** Pour les scènes que tu dessines toi-même dans le kit (`remotion/src/`) : cartons, titres, scènes de chiffres, tout le mode Motion design, un teaser, un trailer. Sur une image filmée, `MOTION.md` garde la main : un texte posé sur un rush a besoin d'un contour, d'une ombre ou d'une plaque, et les pièces du kit (`remotion/src/pieces`) le font déjà.
- **La marque** (« the brand » dans le texte) : `contexte/espace/ESPACE.md` (couleurs, logo, interdits), `style` dans `montage.json` (couleur d'accent, polices), et la charte, le logo et les polices joints (`contexte/INDEX.md`). Ne demande rien à l'humain si ces fichiers répondent.
- **`design.md`** s'écrit dans `rendu/design.md`, à côté de ton plan (`rendu/timeline.json`). Ce qui doit servir aux prochains montages va aussi dans `carnet-ia.md`.
- **Les contrôles** (étape « Check »). `derush-controle rendu/final.mp4` : texte coupé, mots collés, texte sous l'interface du réseau, taille de l'accroche. Le contraste d'un texte : compétence `qc-skill` (`video.text_legible`, 4,5 au moins). Les plans figés que personne n'a voulus : `ffmpeg -hide_banner -i rendu/final.mp4 -vf freezedetect=n=0.003:d=3 -f null -`.
- **La planche contact** (étape « Look »). `python3 <dossier de cette compétence>/scripts/contact_sheet.py rendu/final.mp4` écrit `rendu/final.sheet.png`, une image posée par scène (`--keep-frames` garde chaque image, `--at 4.2,13.8` choisit les temps, `--help` dit le reste). Avant le rendu complet, `node remotion/images.mjs` fait déjà une planche d'images fixes.
- **Le format vertical (9:16).** Les tailles sont données pour du 1080p en 16:9. En 1080 × 1920, garde le plancher (2,6 % du petit côté, soit 28 px), compte la longueur d'une ligne sur 1 080 px de large (à peu près la moitié des caractères), et place le bord gauche commun des titres et tout ce qui compte dans la zone sûre du réseau : `ZONE_SURE` (`remotion/src/pieces/commun.ts`), `livraison` dans `montage.json`, compétence `platform-specs-and-validation`.
- **Les tailles de texte.** `MOTION.md` demande deux polices et trois tailles au plus. Sur un montage de rushes habillé, c'est la règle : prends trois des cinq tailles ci-dessous. Les cinq ne servent qu'à une vidéo faite de scènes dessinées (chiffres, étiquettes, sources), et jamais plus de trois dans une même scène.
- **Le rythme des images** : les nombres d'images de ce dossier sont comptés à 30 images par seconde. À une autre cadence (`sortie.fps` dans `montage.json`), pars des secondes : images = secondes × fps.
- **Ce que le kit n'a pas.** Les composants de graphiques, de pages qui tournent et de transitions à effet de l'auteur ne sont pas livrés : garde la règle et écris la scène avec le kit (`@remotion/transitions`, `@remotion/paths` et `@remotion/shapes` sont installés). Un changement se cale sur le mot qui le nomme avec `sous-titres/mots.json`, ou avec les temps de la voix off.
- **Le mouvement** : `motion-craft.md`, dans ce dossier. Pour un montage de rushes, `MOTION.md` passe avant lui (une coupe franche quand rien ne bouge : sur un face caméra ou un TikTok, presque tous les raccords sont des coupes franches) ; ses durées et ses transitions valent pour une vidéo faite de scènes dessinées. Le nombre de sortes de transitions suit toujours `MOTION.md` (deux au plus), sauf demande de l'humain : `motion-craft.md` dit comment les construire et leur donner une cause. Sa transition « Colour flood » (le fond change de couleur en 12 images) déroge à « the ground does not cross-fade » : garde-la pour un changement d'acte voulu, et note-la sous « Rules turned off ».

---

A web design skill knows pages: scrolling, hover states, a nav bar. A video has none of that. It has
scenes the viewer can't pause on, a narration that sets the pace, a phone in someone's hand or a
projector at the back of a room. This skill is the video layer: it takes a design direction
from wherever it comes from and turns it into scenes, then checks the render the way a juror would.

## Three layers

```
design source (optional, the user's choice)  →  design.md (the handoff)  →  video-design (this skill)  →  checks + critique
a design skill, a team's own house style,         palette, type, acts,        fields per act, one data        layout, contrast,
a brand guide, the brand's own files              rules on/off                accent, type steps, motion      stills, contact sheet
```

- **The design source** gives the direction: a palette, a typeface, an idea. Any skill that can do that
  works, and none is required: with ours (the default), this skill writes `design.md` itself from an act
  palette and the brand. Plug in your own design skill, or use ours. `design.md`
  records the choice on its `Source:` line. See `sources.md`.
- **`design.md`** lives in the project. It is the contract: what the source decided, mapped onto the
  video's acts, plus any house rule turned off and why. A different source means a different
  `design.md`, not different code. See `handoff.md`.
- **This skill** applies it with the rules below, which hold whatever the source says, because they
  come from how video is watched rather than from taste.

## Rules for video

**Colour follows the story.**
- Two or three fields at most, and a field changes only when the narrative does (a new act, not a new
  scene). A colour that changes every scene means nothing; one that changes at the turn tells the
  viewer something turned. Write the acts down first (`handoff.md`), then give each act its field.
- Neighbouring fields differ in **lightness**, not only hue: light, mid, dark. Two fields of the same
  lightness (orange and sky blue) flicker at the cut, and even ffmpeg's cut detector can't see the
  change.
- Fields meet with a hard cut. Content can fade out and in; the ground does not cross-fade.
- **One data accent.** The brand colour goes on the thing the narration is talking about (the bar it
  names, the line, the number) and nowhere else. Everything else is ink or one neutral step. Never a
  tint of the ground (45% black over lime renders as olive, a colour nobody chose).
- Text on a coloured field is the field's ink at full strength, or at 70-80% for secondary lines if it
  still passes contrast. Grey text on colour reads as dirt.

**Type.**
- Five sizes per video, decided once. At 1080p: display 200-260, figure 112-132, title 64-72,
  label 32-36, note 28. The phone floor is 28px at 1080p (2.6% of the short side).
- One family, two weights at most. Tracking -0.03 to -0.05em on display sizes, leading 0.9-1.0.
- A title or statement is two lines at most, broken by hand at the phrase (`<br />`), never left to
  wrap. Count it: a line holds about (usable width) / (0.5 x type size) characters, so ~15 at 220px on 1920px, ~45 at 72px, and half that on a 1080px-wide vertical frame. An orphan word on a third line is
  the most visible tell there is.
- Numbers in tabular figures, so a counting number doesn't jitter.

**Layout.**
- One left edge for every title in the video (the same x in every scene); charts and figures may run
  wider, but headings never move.
- One dominant thing per scene: the chart, the figure, or the statement. A big number and a chart can
  share a scene only when the number is what the chart adds up to.
- No row of identical tiles (four black boxes for four steps). Use one shape with stops on it, a
  sentence, or a sequence that reveals on the narration.
- No gradients, glows, drop shadows on things at rest, glass panels or decorative shapes. A flat field,
  the product itself, a real picture, or a ground drawn from the subject (below).
- Footnotes and sources: one line, at the note size, at the bottom left. A scene that needs three
  lines of notes needs a sentence of narration instead.

**A ground from the subject.** A flat field is the default and often right. When it reads dull, don't decorate
it: draw the subject's own structure on it. Ask what shape the thing already has: a calendar has a week grid, a
song a beat grid or staff, code a line-number gutter, a map its contours, a chat its message column, a
spreadsheet its cells. That shape, and nothing invented, becomes the ground.
- Hairlines in the field's ink at 10-16% (a little less on dark fields). It should read on a phone and
  disappear behind the type; if a viewer notices the lines before the words, halve them.
- One motif for the whole video, the same on every type scene. Scenes with the product or a chart get no
  ground: they are already the picture.
- Things on the ground use the subject's own vocabulary (a calendar's event cards, a chat's bubbles), as
  outlines in the ink, and land on the words that name them. They sit above and below the type,
  never under its lines.
- It can carry a turn: fill it while the narration lists, empty it on the question. That's the difference
  between texture and an idea.
- Record it in `design.md` under "Ground". Never noise, stock imagery, blobs or a generated background; those
  are the decoration this replaces.

**Charts.**
- Flat area fill at 15% or less, square columns, no legend on a single
  series, 3-7 gridlines or none.
- The accent lands on the narrated bar or line on its word; a
  second group, if any, in ink or white, never a second hue.
- Every number on screen comes from the data file, and every number the narration says is checked
  against it before the render.

**Transitions.** An act change is a hard cut, or `wipe()` from `@remotion/transitions` when a moving edge helps;
never a cross-fade between fields. When one scene shows the same thing again in a new way (the same chart in
another design, a screen after the fix), turn it in place (a page turn), each turn on the
word that names the new page. Effect transitions (glitch, light leak, zoom blur) are a brand
choice, not a default; record one under "Rules turned off" in `design.md`.

**Motion** belongs to `motion-craft.md`, in this folder: timing in frames, read time, and the
defaults that look generated. Each change on screen lands on the word that names it, so a
held scene always has a next action, which is what a still-stretch check looks for.

## Workflow

1. **Acts.** Write the video's acts (two to four) and which scenes each holds. This is the most
   important design decision and it is made in words.
2. **Direction.** Use the project's design source if it has one (`sources.md`); otherwise use ours:
   an act palette from `palettes.md` with the brand.
3. **`design.md`.** Fill it from the source's direction (`handoff.md`): a field per act, ink, the one
   accent, the five type steps, the ground (flat, or the subject's own shape), rules turned off with a reason.
4. **Build** the scenes to it.
5. **Check.** Layout before the render (contrast, text size, overflow) and held stills after it, with the
   commands listed under "Dans Dérush" above.
6. **Look.** `python3 scripts/contact_sheet.py rendu/final.mp4` (the script is in this skill's folder) tiles one settled frame per scene. Critique
   it with `critique.md`, fix the top three, render, look again. Three rounds at most.

## Files

| File | Read it when |
| --- | --- |
| `handoff.md` | Writing or reading `design.md`: the format, and a worked example. |
| `sources.md` | Choosing a design source, or plugging in another. |
| `critique.md` | Reviewing a render from its contact sheet: the passes, the score, the caps. |
| `palettes.md` | Act palettes that already work on video, mapped to roles, with their sources. |
| `motion-craft.md` | Animating a scene, or when one feels off: timing in frames, eases, springs, read time, transitions, the defaults that look generated. |
| `scripts/contact_sheet.py` | Making the contact sheet of a rendered video (Python standard library and FFmpeg). |

Parts of these rules (colour fields as chapters, lightness between neighbours, one accent, two-line
headlines, five sizes, the critique's score and caps) are adapted for video from
[taste-skill](https://github.com/Leonxlnx/taste-skill) by Leonxlnx (MIT). See `sources.md`.
