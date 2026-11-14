---
name: wrapped-video
description: À ouvrir pour une vidéo récap chiffrée façon « Wrapped » (bilan de l'année d'une association, d'une équipe ou d'un créateur, ou une vidéo personnalisée par participant tirée d'un tableau) : la grammaire de scènes, la montée du plus petit chiffre au plus fort, le compteur, la carte finale à partager, et le rendu d'une vidéo par ligne de données.
---

# Wrapped Video

> **Dans Dérush.** Ce savoir vient d'iart.ai (voir `SOURCE.md`). Tout se fait dans le kit `remotion/` du dossier de
> travail, sans rien installer : les composants ci-dessous et la boucle de rendu ont été essayés (deux vidéos rendues
> depuis un tableau, une ligne invalide écartée).
>
> | Ce qu'il te faut | Où c'est |
> |---|---|
> | Le format | 1080 × 1920, 30 images/s ; textes hors des zones des réseaux (`ZONE_SURE` de `src/pieces/commun.ts` : haut 10 %, bas 22 %, droite 14 %) |
> | Les polices | celles du kit (`Anton` pour les grands chiffres, `Montserrat`), attendues avec `usePolices()` |
> | Les nombres | `new Intl.NumberFormat('fr-FR')` (1 240 ; 92 %) et `tabular-nums` |
> | Un tableau (CSV) en données | Python sans rien installer (`csv`, `json`), voir `references/batch-pipeline.md` |
> | Une vidéo par ligne | une boucle Node qui appelle `node remotion/rendre.mjs <Composition> rendu/livraison/<id>.mp4 --props '…'` |
> | Regarder avant de tout rendre | `node remotion/images.mjs <Composition> --images …` sur UNE ligne représentative |
>
> - **Jamais l'identité d'une marque** : ni le nom « Spotify Wrapped », ni son vert, ni ses tournures. « Wrapped » ne
>   sert qu'à reconnaître la demande ; la vidéo porte les couleurs de la personne ou de son association.
> - **Données personnelles** : une vidéo par personne ne montre que ses propres chiffres, avec l'accord de
>   l'association, et pas de classement qui humilie (« le moins présent »).
> - **Licence Remotion** : rendre beaucoup de vidéos pour une entreprise de plus de trois personnes demande une licence
>   (voir la compétence `remotion-license`).
>
> Les passages « Dans Dérush » sont des ajouts ; le reste est le texte de l'auteur.

Build a "Wrapped"-style recap: take a row of data about one person (or account, team, year) and turn it into a punchy, shareable vertical video. The core idea is **one template × a data table → many personalized videos**. Write the template once, then render a unique film for every row.

## When to use

- Year-in-review / "your 2026 recap" videos for any group with per-person stats.
- Personalized data videos: fitness year, reading year, sports season, workshop attendance, student progress.
- Any time the deliverable is "the same video, but with each person's numbers" — at 1 or 1,000 copies.

This is a **data → share-bait** pattern, not a hand-edited film. If there is no data table (or no per-record data), use a different skill.

## The two non-negotiables

1. **Data drives everything.** Every headline, number, name, and color comes from props, never hardcoded. A scene that can't be filled from a data row does not belong in a Wrapped.
2. **Built to be screenshotted.** Each scene must read in under 2 seconds and look good frozen — that frozen frame is what gets shared to a story. Design for the pause, not the play.

## The Wrapped scene grammar

A Wrapped is a fixed sequence of short scene *types*, each ~2.5–4s. Pick 5–7 and order them as a build. Same grammar every year; only the data and palette change.

| Scene type | Job | Data shape |
|---|---|---|
| Intro / "{name}, ton année" | Brand the moment, set palette | name, year |
| Big-number reveal | One hero stat, counts up huge | one number + unit + label |
| Top-X list | Ranked 1→5, staggered in | array of `{rank, label, value}` |
| Superlative / persona | "Tu es le pilier de l'équipe", an archetype | computed tier/label |
| Comparison | "plus que 92 % des participants" | percentile or ratio |
| Time/heatmap | "ton mois le plus fort : mars" | series or peak |
| Outro / share card | Logo + handle + CTA, holds still | name, handle |

Order as a crescendo: small context first, biggest/most personal stat as the climax, then the still share card. See `references/scene-grammar.md` for a full 7-scene storyboard with timings.

## The recap story arc

The scene grammar is the skeleton; the *arc* is what makes a Wrapped feel like a gift instead of a dashboard. A recap is a tiny five-beat drama about one viewer — sequence it so each reveal feels bigger and more personal than the last.

| Beat | Job | Maps to |
|---|---|---|
| Build-up | Brand the moment, promise it's theirs | Intro: "{name}, ton année {year}" |
| Escalating reveals | Stack stats that rise in stakes | Top-X, activities, time patterns |
| The "big number" | One hero stat, max scale, held longest | Big-number / count-up climax |
| Personalized superlative | Name *who they are*, not just what they did | Persona/percentile tier |
| Shareable payoff | A still poster they want to post | Outro share card |

**Sequence stats for rising impact — smallest first, biggest last.** Rank every stat by emotional payload (raw size, rarity, how flattering) and play them in ascending order. Never open on the hero number: there's nowhere to climb after it, and the rest of the film feels like a comedown. Hold the climax stat largest and longest; everything before it is set-up.

**The hook is "this is about YOU."** A Wrapped wins because the viewer is the protagonist. Earn that in the first 2 seconds: lead with their name, use their per-record `accent`, and write every line in second person ("Tu as monté 12 vidéos"). Generic copy ("Activité préférée : foot") breaks the spell — reframe as "Toi, c'est le foot." If a frame would read identically for two different people, it isn't pulling its weight.

**Design the final share-frame as the destination.** The whole arc exists to deliver a poster worth posting. The outro is not a credits roll — it's the payoff: the headline superlative or hero number restated, name + @handle, logo, one short CTA, holding **completely still ≥2s** so a screenshot or auto-loop lands clean. Decide this frame first and build the crescendo toward it. Copywriting tiers and the full storyboard are in `references/scene-grammar.md`.

> Dans Dérush : le bilan d'une association (« Notre année 2026 ») suit la même grammaire, à la première personne du
> pluriel (« On a accueilli 312 jeunes »), et les chiffres viennent de ses vrais comptes (rapport d'activité, feuilles
> de présence), cités dans la fiche de publication.

## Data → video shape

Define a typed shape for one record. The whole video is a pure function of it.

```ts
// remotion/src/wrapped.tsx
export type Wrapped = {
  name: string;                                   // a person, a team, the association
  year: number;
  accent: string;                                 // per-record colour
  big: {value: number; label: string};            // the hero number
  top: {rank: number; label: string; value: number}[];
  persona: string;                                // computed from thresholds, second person
  ahead: number;                                  // 0–100: "more than {ahead} % of {peers}" — the bar fills to it
  peers: string;
  handle?: string;
};
```

Register it with `defaultProps` so each render just swaps props:

```tsx
// in remotion/src/Racine.tsx, next to the kit's compositions
<Composition id="Bilan" component={WrappedVideo} width={1080} height={1920} fps={30}
  durationInFrames={30 * 22}                      // 22 s: the sum of the scenes below
  defaultProps={EXEMPLE} />
```

> Dans Dérush : Remotion fusionne les props reçues PAR-DESSUS `defaultProps`. Un champ absent d'une ligne prend donc
> la valeur de l'exemple, sans erreur : la vidéo de Sam montrerait le @ ou le chiffre de l'exemple. Chaque ligne donne
> tous les champs affichés (même vides, `"handle": ""`), et la boucle de rendu écarte une ligne incomplète.

## The signature move: the big-number counter

The count-up is the heartbeat of every Wrapped. Drive it from `useCurrentFrame()` (never `setState`/`setInterval` — that flickers on render), ease it with a spring, and format it in French.

```tsx
import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

const fr = new Intl.NumberFormat('fr-FR');

export const BigNumber: React.FC<{value: number; label: string; accent: string}> = ({value, label, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = spring({frame, fps, config: {damping: 200}});        // 0 → 1, settles without overshoot
  const shown = Math.round(interpolate(progress, [0, 1], [0, value]));
  const pop = interpolate(progress, [0, 1], [0.6, 1]);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '0 14%', transform: `scale(${pop})`}}>
      <span style={{fontFamily: 'Anton', fontSize: 260, color: accent, lineHeight: 1, fontVariantNumeric: 'tabular-nums'}}>{fr.format(shown)}</span>
      <span style={{fontFamily: 'Montserrat', fontWeight: 800, fontSize: 60, color: '#fff', marginTop: 28, textAlign: 'center'}}>{label}</span>
    </AbsoluteFill>
  );
};
```

Use `tabular-nums` so digits don't jitter width as they roll. For the top-X list, reuse one spring per item with a staggered `delay` (rank 1 first) — see `references/remotion-recipes.md`.

## Vertical 9:16, designed for the pause

Render **1080×1920**. Stories/Reels/TikTok crop and overlay UI, so keep all type and key numbers clear of the **top 10%** (192 px), the **bottom 22%** (from 1498 px) and the **right 14%** (the like/comment/share buttons): the free band is the middle ~68% of the height, and centered type keeps ~14% on both sides. One bold idea per frame, oversized type, high-contrast accent on a flat/gradient background. Per-record `accent` color makes each share feel personal. Full safe-area map in `references/scene-grammar.md`.

## Batch: one template → many videos

The payoff. Render every data row to its own MP4, passing the row as props. Convert the table to typed records, check each one, loop, name files per record.

```bash
python3 lignes.py donnees.csv > atelier/lignes.json      # typed records; a bad row is skipped and reported
node rendre-lot.mjs atelier/lignes.json                  # one video per record in rendu/livraison/, + its share card
```

Both scripts (Python and Node standard libraries only) are in `references/batch-pipeline.md`.

## Build checklist

- Every visible string/number comes from props; nothing hardcoded; every record gives every displayed field.
- 5–7 scenes, crescendo order, biggest/most personal stat as the climax.
- Numbers count up via `useCurrentFrame` + spring, `tabular-nums`, French format.
- 9:16 1080×1920; key content clear of the platform zones.
- Each scene reads in <2s and looks good frozen (it will be screenshotted); the share card holds still ≥2s.
- Records checked before render; files named per record.

## Deliver & verify

> Dans Dérush, cette partie remplace celle de l'original (`npx remotion`, `npx tsx`, schéma zod, scripts du dépôt).

A Wrapped is a Remotion composition rendered per data row — frame-deterministic, so any exact frame renders headlessly. Verify one representative row by stills before you batch.

1. Put ONE representative record in `defaultProps` (the real one, not an invented example) and freeze it: `node remotion/images.mjs Bilan --images 20,180,330,450,600,659` (intro, big number settled, persona, climax, share card, last frame).
2. Inspect each full-size image: every visible string/number comes from that record and is EXACT (big-number reveal lands on the real value, top-X ranks/labels correct); key content clear of the platform zones; each frame reads frozen; fonts loaded.
3. Render that one video (`node remotion/rendre.mjs Bilan rendu/livraison/bilan-<id>.mp4 --props "$(…)"`), watch it, run `derush-controle` on it.
4. Only then run the batch loop; open a few share cards (`rendu/livraison/*.jpg`) to check that each person has their own numbers.

## Reference files

- `references/scene-grammar.md` — full 7-scene storyboard with frame timings, the build/crescendo logic, superlative & percentile copywriting patterns, and the 9:16 safe-area map.
- `references/remotion-recipes.md` — runnable scene components: staggered top-X list, percentile bar, intro, persona, share card, scene sequencing with `<Series>`, transitions, fonts, and the no-flicker animation rules.
- `references/batch-pipeline.md` — CSV → typed records (Python, nothing to install), the render loop over `rendre.mjs`, reruns, share stills, file naming.
