---
name: explainer-video
description: À ouvrir pour faire une vidéo explicative animée de 30 à 90 secondes (« explique en vidéo comment ça marche », présenter un dispositif, un projet, un service ou un tuto en motion design) : une seule idée, l'arc problème → enjeu → solution → comment → bénéfice, le texte de la voix off écrit et minuté d'abord, le storyboard scène par scène, puis les coupes, la voix et les sous-titres tirés d'un seul tableau de temps.
---

# Explainer Video

> **Dans Dérush.** Ce savoir vient d'iart.ai (voir `SOURCE.md`). Il se fait ici avec les outils du dossier de
> travail ; rien à installer.
>
> | Ce qu'il te faut | Où c'est |
> |---|---|
> | La voix off | la voix de la personne si elle l'a enregistrée ; sinon ElevenLabs s'il est branché (`text-to-speech/<voix>/with-timestamps`, modèle `eleven_v4`, `language_code: "fr"` : le temps de chaque caractère), compétences `ai-voiceover` et `text-to-speech` |
> | Le temps de chaque mot | la réponse `with-timestamps`, ou `POST /v1/forced-alignment` d'ElevenLabs sur un texte connu ; pour une voix enregistrée, `sous-titres/mots.json` |
> | Les scènes | des compositions Remotion dans le kit `remotion/` ; schémas, barres et compteurs : compétence `diagram-animation` ; dessin au tableau blanc : `whiteboard-animation` ; pièces prêtes (titre géant, étiquette, carte, carton de fin) : `remotion/src/pieces/LISEZMOI.md` |
> | Les sous-titres | la pièce `SousTitres` du kit, avec les temps des mots (2 à 4 mots par bloc, le mot dit mis en valeur) ; règles détaillées : `subtitle-skill` |
> | Le son | `derush-son mixer` (voix devant, musique dessous, −14 LUFS), `derush-son mesurer` |
> | Regarder avant de rendre | `node remotion/images.mjs <Composition> --images …`, puis `node remotion/rendre.mjs`, `derush-controle` |
>
> La recette « explication » de `LISEZMOI-IA.md` s'applique aussi : chaque chiffre et chaque nom propre écrits à
> l'écran pendant qu'ils sont dits, de vraies sources citées. Les passages « Dans Dérush » sont des ajouts ; le reste
> est le texte de l'auteur.

Turn one message into a paced, narrated 30–90s short. Run the full pipeline: script → storyboard → scene build → narration/caption sync → edit → polish, with a consistent style system throughout.

## When to use

- Produce a 30–90s product, how-it-works, onboarding, or concept video.
- Go from a raw idea or feature to a script, storyboard, and assembled piece.
- Sync narration to visuals and add captions for muted playback.

## Story structure (decide this first)

An explainer is an argument, not a feature tour. Before any pipeline step, lock the narrative so every later choice serves it.

- **One core idea.** A single sentence the viewer should be able to repeat afterward. If you can't state it in one line, the video has no spine — cut scope until you can. Everything that doesn't serve that idea gets dropped, not shrunk.
- **Script-first.** The VO is the spine; visuals illustrate the line being spoken, never lead it. Write and time the words before you storyboard or animate — it is far cheaper to cut a sentence than a built scene.
- **Earn the "how" with stakes.** Don't jump from problem to mechanism. Make the viewer *feel* the cost of the problem first; that tension is what makes them watch the solution.

The explainer story arc — a beat per stage, in order:

| Stage | Narrative job | What the viewer should think |
|---|---|---|
| Problem | Name the pain in their words | "That's me." |
| Stakes | Show what the pain costs (time, money, risk) | "I need this fixed." |
| Solution | Introduce the product/idea as the fix, in one line | "Oh — that solves it." |
| How it works | The mechanism in 1–3 concrete steps | "I get how it does that." |
| Payoff / CTA | The after-state + one next action | "I want that. I'll do X." |

(The `Script formula` table below maps these stages to runtime shares and word budgets — this section is the *why* and order; that one is the *how long*.)

### Pick one analogy and ride it

Abstract mechanisms land when mapped to something the viewer already knows. Choose a single metaphor and keep it consistent across scenes — switching analogies mid-video resets comprehension.

- Pick a metaphor from the viewer's world (a queue, a thermostat, an assembly line), not the engineering domain.
- One metaphor per video; reuse it for both the visual grammar and the VO wording.
- Test it: if the analogy needs its own explanation, it's the wrong one.

### Pacing per beat

Pace tracks tension. Move quickly through Problem/Stakes to reach the value; slow down on the "how" so each step lands; let the payoff breathe.

| Beat | Feel | Cut rhythm |
|---|---|---|
| Problem / Stakes | Brisk, a little tense | Faster cuts, short holds |
| Solution | A beat of relief | One clear hold |
| How it works | Deliberate, one step at a time | Slowest — hold each step to read |
| Payoff / CTA | Confident, open | Hold the end card; one CTA |

## The pipeline

1. **Script** — one core message. Structure: problem → solution → how → payoff. Write tight voiceover (VO); time it at ~2.3 words/second (≈140 wpm). A 60s video is ~138 words.
2. **Storyboard** — one idea per scene. Sketch each frame plus its transition; map each VO line to a visual.
3. **Build scenes** — animate diagrams/data, kinetic text/keywords, and backgrounds (techniques below).
4. **Narration & captions** — record/generate VO, align scene cuts to VO beats, burn in captions (most plays are muted).
5. **Edit** — cut to the narration, hold each idea long enough to land, remove any scene that doesn't advance the message.
6. **Polish** — color pass, consistent easing, audio mix, end card.

## Script formula

| Beat | Job | Share of runtime |
|---|---|---|
| Problem | Name the pain the viewer feels | ~20% |
| Solution | Introduce the product/idea as the fix | ~15% |
| How | Show the mechanism, 1–3 concrete steps | ~45% |
| Payoff | The outcome + a clear next step (CTA) | ~20% |

Write VO first, in spoken language (contractions, short sentences). Read it aloud and time it before building anything.

## VO timing math

- Pace: ~2.3 words/sec (140 wpm) for clear, friendly narration; slow technical lines to ~2.0.
- Estimate scene length from its VO line: `seconds = words / 2.3`, then add ~0.4s breathing room.
- A scene with no VO (pure visual beat) still needs ≥1.0s to register.

> Dans Dérush : ces chiffres sont des repères anglais, pour budgéter le texte. En français, génère la voix (ou prends
> celle de la personne) avant de construire quoi que ce soit, mesure la durée réelle de chaque phrase, et tire les
> durées des scènes de ces mesures, jamais de l'estimation. Une voix trop longue pour la durée visée : coupe des mots,
> pas la vitesse.

## Scene-build techniques

All motion is a pure function of the frame (`useCurrentFrame()`): no CSS transition, no timer, no `Date.now()`, no `Math.random()`.

- Diagram / data reveal (progressive disclosure: nodes → edges → labels), bars, count-up stats: the Remotion recipes of the `diagram-animation` skill (`Flow`, `Bars`, `Count`…).
- Kinetic keyword (word pops in on the stressed word):

```tsx
import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';

// `at`: when its word is spoken, in seconds from the start of the scene (from the timing table)
export const Keyword: React.FC<{text: string; at: number}> = ({text, at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - Math.round(at * fps), fps, config: {damping: 200}, durationInFrames: Math.round(0.4 * fps)});
  return <span style={{display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 18}px)`}}>{text}</span>;
};
```

Render the assembled piece with Remotion (data-driven, deterministic).

## Caption sync

Captions are mandatory — assume muted autoplay. Keep ≤2 lines, ≤42 chars/line, on-screen ≥1.0s, gone before the next line starts.

```
1
00:00:00,300 --> 00:00:02,600
Managing releases by hand is slow.

2
00:00:02,800 --> 00:00:05,400
Shipfast automates the whole pipeline.
```

In Remotion, drive captions from the same timing array used for scene cuts so they never drift:

```tsx
// same file: add Audio, Sequence and staticFile to the import from 'remotion' above
import {SousTitres} from './pieces/SousTitres';

export type Mot = {t: string; debut: number; fin: number};          // seconds, from the measured voice
export type Ligne = {scene: string; mots: Mot[]; coupeSur?: number}; // one VO line = one scene; the cut lands on word `coupeSur` (0 = its first word)

// the cuts, from the voice: each scene starts a hair before the word it lands on (the picture leads by 2–3 frames)
export function scenesDe(lignes: Ligne[], fps: number, finS: number) {
  const coupe = (l: Ligne) => l.mots[l.coupeSur ?? 0].debut - 0.08;
  return lignes.map((l, i) => {
    const from = Math.round((i === 0 ? 0 : coupe(l)) * fps);
    const to = Math.round((i < lignes.length - 1 ? coupe(lignes[i + 1]) : finS) * fps);
    return {scene: l.scene, from, durationInFrames: to - from};
  });
}
// the film ends after the last word, plus the end-card hold: use it in calculateMetadata
export const dureeExplainer = (lignes: Ligne[], fps: number, tenueFin = 2.5) =>
  Math.ceil((lignes[lignes.length - 1].mots.slice(-1)[0].fin + tenueFin) * fps);

// in the composition: the voice, the scenes, and the captions all read `lignes`
// <Audio src={staticFile('voix.mp3')} />
// {scenesDe(lignes, fps, durationInFrames / fps).map((s) => <Sequence key={s.scene} from={s.from} durationInFrames={s.durationInFrames}>…</Sequence>)}
// <SousTitres mots={lignes.flatMap((l) => l.mots)} />
```

> Dans Dérush : `SousTitres` (pièce du kit) coupe déjà les blocs aux bons endroits et met en valeur le mot dit. En
> vertical (9:16), garde 2 à 4 mots par bloc : la limite de 42 caractères est celle d'un écran horizontal.

## Style-system consistency

Lock one type scale, one color grammar (color = meaning, never reassigned), and one easing curve before building scene 2. Reuse the same enter/exit transitions across scenes so the piece feels like one object, not a montage of experiments. Visuals must illustrate the VO line currently spoken — show, don't decorate.

> Dans Dérush : les polices sont celles du kit (`Montserrat`, `Poppins`, `Anton`, `Bebas Neue`…, chargées par
> `usePolices()`), les couleurs celles du kit de marque de l'espace s'il y en a un (`contexte/espace/ESPACE.md`).

## Output checklist

- Single clear message; every scene advances it.
- VO timed; scene lengths derived from the measured VO.
- Storyboard maps each VO line to a visual.
- Captions burned in; readable, inside the safe zones.
- Consistent type/color/motion system across all scenes.
- End card with one clear CTA.

## Deliver & verify

> Dans Dérush, cette partie remplace celle de l'original (commandes `npx remotion` et scripts du dépôt d'origine).

The assembled explainer is a Remotion composition — frame-deterministic, so any exact frame renders with no seek harness.

**Contract:**
- A composition in the kit `remotion/`, declared in `src/Racine.tsx`, its props being the timing table (`lignes`) and the voice file; its length computed in `calculateMetadata` (`dureeExplainer`), never by hand.
- All motion frame-driven; narration via `<Audio src={staticFile(…)}>` with the file in `remotion/public/`; captions from the same table.

**Verify loop — stills → inspect → render.** Single frames first (cheap), the full video only once they are right.

1. `node remotion/images.mjs <Composition> --images 0,<a frame inside each scene's hold>,<last frame>`.
2. Inspect each full-size image: at every sampled frame, the caption and the spoken line match the visual on screen (no drift); text exact, not clipped, inside the safe zones; fonts loaded.
3. `node remotion/rendre.mjs <Composition> rendu/final.mp4`, then `derush-controle rendu/final.mp4` (nothing left in `a_corriger`), and `derush-son mesurer rendu/final.mp4` (−14 LUFS).

## Reference files

- `references/script-to-screen-workflow.md` — full pipeline detail: the problem→solution→how→payoff script formula with a worked example and word budget, VO timing tables, a fill-in storyboard template with timecodes, a per-scene build checklist, caption authoring guidance, and a style-system spec sheet for cross-scene consistency.
