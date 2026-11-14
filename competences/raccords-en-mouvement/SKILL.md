---
name: raccords-en-mouvement
description: "À ouvrir avant d'animer une vidéo faite de plusieurs scènes dessinées (motion design, titres, cartons, démonstration d'une interface) ou d'écrire un raccord animé entre deux d'entre elles, pour que tout le film se lise comme un seul mouvement : la loi des raccords (même axe, même sens, même vitesse, coupe en plein mouvement), ce qui fait vivre une scène sans flottement, et sept techniques chiffrées (zoom traversant, cut-the-curve, coupe et entrée en cascade, flou de mise au point, glissade) écrites pour le kit Remotion."
license: Apache-2.0
---

# Raccords en mouvement

> **Compétence dérivée, modifiée pour Dérush.** Elle réunit et adapte à Remotion deux compétences internes du dépôt
> heygen-com/hyperframes, `motion-doctrine` (cette page) et `cut-the-curve` (`references/catalogue.md`), sous licence
> Apache-2.0, Copyright 2026 HeyGen, Inc. Ce n'est pas une compétence officielle de HeyGen ni de HyperFrames. Ce qui a
> été retiré ou changé est dit dans `SOURCE.md` ; les passages marqués « Dans Dérush » sont des ajouts.

## Dans Dérush

Ce savoir a été écrit pour un autre moteur (des scènes HTML animées avec GSAP). Les règles et les chiffres valent tels
quels ; voici comment les appliquer ici.

| Question | Réponse |
|---|---|
| Qui décide ? | `MOTION.md` et la demande de la personne passent avant ces pages. Elles ajoutent une chose : la continuité du mouvement d'une scène à l'autre. |
| Où ça s'applique ? | Aux passages que tu animes toi-même dans le kit `remotion/` : titres, cartons, cartes, scènes de motion design, démonstration d'une interface, cases à créer. |
| Et entre deux rushes filmés ? | La règle de `MOTION.md` : une coupe franche, ou une transition qui prolonge un mouvement déjà dans l'image. Un fondu enchaîné reste permis si la personne le demande. « Never a crossfade » ne vaut qu'entre scènes animées. |
| Combien de transitions ? | Deux sortes au plus par vidéo (`MOTION.md`) : le raccord par défaut d'ici (cut-the-curve, dans le sens du film), et une seconde gardée pour un moment qui a un sens (une arrivée, une montée). |
| Avec quoi l'écrire ? | `useCurrentFrame()`, `interpolate()` et `Easing` de Remotion : tout part du numéro d'image. Pas de GSAP, pas de minuterie, rien à installer. Les courbes équivalentes et le code de chaque technique sont dans `references/remotion.md`. |
| Les durées ? | Elles sont en secondes : calcule avec `t = frame / fps`, sans arrondir les petits décalages (0,022 s fait moins d'une image à 30 images par seconde). Pose chaque coupe sur une image entière (`coupe = n / fps`) : l'échange des deux scènes tombe alors sur une image précise. |
| Les distances ? | Elles valent pour une image de 1080 px de petit côté (1920 × 1080 ou 1080 × 1920) : 230 px de course, sur les deux axes. Mets-les à l'échelle pour une autre définition. |
| Les durées très courtes (0,10 à 0,20 s) ? | Ce sont celles de chaque mot d'une cascade. Un élément qui entre seul garde les 8 à 14 images de `MOTION.md`. |
| Où écrire le plan des raccords ? | Dans `rendu/timeline.json`, une ligne par raccord : temps de la coupe, axe et sens de la sortie, axe et sens de l'entrée, technique. |
| Comment contrôler ? | `node remotion/images.mjs --de <s> --a <s> --pas 1` autour de chaque coupe (voir « The Seam Check »), puis `derush-controle` sur la vidéo finie. Avec Codex ou Gemini, où le navigateur de rendu ne démarre pas : rends la vidéo, puis tire les images autour de la coupe avec FFmpeg. |

Ce qui reste vrai de `MOTION.md`, même quand ces pages semblent dire autre chose :

- un zoom lent de 2 à 4 % sur un plan filmé reste bon : c'est une caméra qui a un but, pas un flottement ;
- le fond continue de bouger sous le carton de fin ;
- les zones sûres du réseau (`livraison` dans `montage.json`) et le temps de lecture d'un texte ne changent pas ;
- un léger rebond reste permis (`spring()` avec un `damping` de 14 à 20) : ce qui est banni ici, ce sont les rebonds
  répétés et les élastiques.

---

# The motion law

Read this before composing a multi-scene animation. It decides WHAT happens at every seam and how
every scene performs; the technique catalog (`references/catalogue.md`) implements it. The failure
this prevents: scenes authored in isolation — the eye's momentum dies at every cut, and scenes
wobble in place between entry and exit.

## Route map

| Decision (this page)                               | Parameters and mechanics                              |
| -------------------------------------------------- | ----------------------------------------------------- |
| Seam transition choice + parameters                | `references/catalogue.md` §1–5 (the catalog)          |
| Text / element entry cascades                      | `references/catalogue.md` §6 (waterfall entry)        |
| In-scene group repositioning (no cut)              | `references/catalogue.md` §7 (nudge curve)            |
| Writing any of them in the Remotion kit            | `references/remotion.md`                              |

Authoring order: **vector ledger (one row per seam, in the plan) → sustained-motion route per
phase → carriers and causes → build the scenes → CHECK every seam on rendered frames (the Seam
Check, below).**

---

# Part 1 — The Seam Law

## The Vector Law

> How Scene A exits determines how Scene B enters: same axis, same direction, matched
> speed, cut mid-motion on both sides.

1. **Axis** — x stays x, y stays y, Z stays Z. Never trade axes across a cut.
2. **Direction** — never mirror. On Z, direction = the SIGN of scale change: growing =
   push (camera forward), shrinking = pull (camera back). A receding exit answered by a
   grow-from-small entry is a mirrored vector — the most common violation, because
   grow-from-small is the default element entrance.
3. **Speed** — entry initial velocity ≈ exit final velocity, via mirrored eases (exit
   `power4.in` + entry `power4.out`, same distance and duration; the incoming side picks
   up ≥50% through the notional path). Mechanics in `references/catalogue.md`.
4. **Phase** — the cut lands mid-motion on BOTH sides. Settling to rest before the cut,
   or starting from rest after it, is a dead beat.

## The Current

Every film picks ONE dominant direction (default: LEFT — the content travels left, like a page
turned in reading order). Every ordinary seam uses
it. Other vectors are RESERVED — spending one means something:

| Vector                    | Meaning                                                         |
| ------------------------- | --------------------------------------------------------------- |
| The current (LEFT)        | "next beat" — neutral forward progress                          |
| Upward                    | elevation — a conclusion or reveal rises above what came before |
| Z forward (zoom-through)  | pushing deeper into the same thought                            |
| Z backward (inverse zoom) | ARRIVAL — something bigger lands                                |
| Scale-burst (explode out) | leaving a world — a surface blasts past camera                  |

- Never run consecutive seams in opposing directions — ping-pong reads as an error.
- A direction change needs a visible cause (click / bounce / impact) or a chapter boundary.

## The Vector Ledger

Write it before authoring any scene — in your plan (`rendu/timeline.json` in a Dérush work
folder). One row per seam: cut time, exit and entry vectors (axis + signed direction; Z rows
carry the scale sign), the elements that carry the motion, technique. Exit and entry must
match; if a row mismatches, fix the plan, not the easing.

## Carriers

The eye follows objects, not abstractions. The strongest seams hand a concrete carrier
across the cut at matched position AND velocity: a cursor mid-path, a container that
shrinks/docks into the next layout, a mark that flies into its exact slot, the word group
of a waterfall cut. With no natural carrier, the scene heroes carry it (partial travel +
early fade, entry mid-flight). Never a crossfade between animated scenes — it has no carrier
at all.

## Causal Motion

Chain motion so each move is visibly launched by the last: click → squash → release
spring → flight → impact → recoil → reveal.

- Effects start ON the causing frame — same timeline position, never "shortly after."
- Reactions scale with implied mass: big elements rebound slower, small ones snap.
- A force is a license to change direction; an uncaused flip is a ping-pong.

## The Seam Check (every seam, on rendered frames — or the seam is not done)

> **Dans Dérush.** L'auteur fait ces contrôles avec deux programmes propres à son moteur, qui ne sont pas livrés ici.
> Fais-les à l'œil, image par image : `node remotion/images.mjs --de <s> --a <s> --pas 1`, de 0,2 s avant la coupe à
> 0,5 s après. Les seuils cités ci-dessous (15 px/s, un rapport de 3, 12 px, 5 %) sont ceux de son programme.

Per seam, the frames must show:

1. **ledger-row consistency** — exit and entry vectors match in the PLAN (axis + direction);
2. the exit **still moving** at the cut — no settled exit (the author's checker counts under
   15 px/s as stopped: half a pixel a frame at 30 fps);
3. the entry **mid-flight** on its first frame — never from rest;
4. the measured direction = the ledger direction, on both sides;
5. entry speed ≈ exit speed — compare the distance travelled on the last frame before the cut
   and on the first frame after it (the author's checker warns beyond a ratio of 3; at 30 fps, the
   default cut-the-curve — 230 px in 0.33 s — shows about 61 px then 95 px, which is right);
6. **zero overlap** — one side visible per frame; the cut is not a dissolve;
7. the **Z sign** rule — d(scale)/dt has the same sign on both sides, and the incoming scene's
   own entrances do not fight that sign;
8. carrier continuity — same position and size at cut ± 1 frame (about 12px and 5% on a 1080p
   frame), ancestor scale included.

Also yours:

1. **Edits re-open the seam.** Any change to a scene's first/last ~1s (including
   re-timing to new VO) invalidates that boundary's check — do it again.
2. **Audio is the clock.** Re-time scenes to the VO's real word timestamps; never rush a
   read to fit a slot. A VO regen re-opens its seams.
3. **Visibility gotcha** (the usual cause of an overlap): the incoming scene must not be
   visible before the cut — mount it from the cut frame on (`<Sequence from>`), or keep its
   opacity at 0 until then.

---

# Part 2 — Performance (the scene keeps performing)

## No idle wobble

Idle sine loops (breathe, float, drift, glow pulse) are BANNED as sustained motion — they
read as "the video is waiting." A scene that finishes entering with seconds left is a
planning bug: add story, not wobble. Every phase between entry and exit is owned by one
of these routes (name the route in the plan):

| Route                  | What it is                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Staged reveals**     | Hold content back; pay it off on narration beats — the frame keeps gaining information (default for ≥2 content groups) |
| **Camera with intent** | A mapped scale+pan path: establish wide → travel → arrive on the subject                                               |
| **Sequenced UI life**  | The product behaves over time: progress advances, highlights step, counts tick                                         |
| **Animated sequences** | Elements act out a beat: a card files into a stack, an item gets dragged, a result assembles                           |
| **Cursor-led action**  | An oversized cursor walks the eye to a trigger; its CLICK ignites the next beat |

Test: pause at any second — something meaningful must be mid-flight (a reveal landing,
the camera traveling, the UI doing what the narration says).

## Stillness before climax

Schedule a **0.3–0.75s pause** between the major action and its result — the dramatic
comma. A scene that jumps straight from action to result loses it.

## Timing intents

- Single entry ≤ ~800ms; longer buildup = multi-element stagger, not one slow element.
- Exit ≈ 75% of entry. Exception: cut-the-curve inverts this (entry ~127% of exit).
- Total stagger ≤ 500ms; with 8+ elements, tighten per-item delay or stagger the first few.
- Forbidden eases: `bounce.out` / `elastic.out`. Entry overshoot `back.out(1.4–1.7)` is fine.
- Similar elements share one ease+duration intent — never a unique pair per element.

## Transition vocabulary

Use only 2–3 inter-scene transitions per film and repeat them (in Dérush: two kinds at most,
`MOTION.md`); the default boundary is **cut-the-curve in the current's direction**. Hand-written
shared-element morphs don't count against the budget.

---

## Anti-Patterns

| Don't                                                                      | Instead                                            |
| -------------------------------------------------------------------------- | -------------------------------------------------- |
| Author each scene's entrance in isolation                                  | Write the vector ledger first                      |
| Crossfade between animated scenes | Cut-the-curve in the current's direction           |
| Exit completes, THEN the scene changes                                     | Cut mid-motion on both sides                       |
| Entry starts from rest after a cut                                         | Enter ≥50% through the notional path               |
| Inverse-zoom exit → grow-from-small entry (or push → oversized retraction) | Match the scale-velocity sign (Seam Check 7) |
| Incoming scene's own pop-in intro under a Z-seam handoff                   | Hold its opening frame composed, or match the sign |
| Idle wobble / breathe / float to fill time                                 | Assign a sustained-motion route; or add story      |
| Direction flip without a cause                                             | Spend a force, or keep the current                 |
| Reserved vectors used as variety                                           | Default to the current; spend them on meaning      |
| Reaction a few frames after its cause                                      | Same-frame ignition                                |
| Action jumps straight to result                                            | Schedule stillness-before-climax (0.3–0.75s)       |

---

## Reference files

- `references/catalogue.md` — the seven techniques with their parameters: zoom-through, inverse zoom-through,
  cut-the-curve, waterfall cut, rack-focus blur-cut, waterfall entry, nudge curve; the Z sign rule, blur sizes, how to
  choose, and the anti-patterns.
- `references/remotion.md` — (en français) les courbes GSAP et leur équivalent Remotion, les durées en images, et le
  code de chaque technique pour le kit `remotion/`.
