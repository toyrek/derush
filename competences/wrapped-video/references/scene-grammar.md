# Scene grammar: the Wrapped storyboard

A Wrapped is not a freeform film. It is a fixed sequence of short, reusable scene *types*, each a slot a data row fills. Lock the grammar once; only the data and palette change each year. This is why one template scales to millions of personalized videos.

> **Dans Dérush.** Les exemples de l'original (minutes d'écoute, artistes, auditeurs) sont remplacés par ceux d'un
> atelier vidéo, pour qu'aucune vidéo ne reprenne la formule d'un service connu. La carte des zones sûres est
> corrigée (voir plus bas). Le reste est le texte de l'auteur.

## The crescendo

Order scenes so personal stakes rise toward a climax, then resolve on a still share card:

1. **Context first** — small, framing facts ("tu es venu·e 34 mercredis").
2. **Build** — top-X lists, activities, time patterns.
3. **Climax** — the single most personal/impressive stat (the percentile, the hero number), held longest and largest.
4. **Resolve** — outro share card, motion settles to a clean freeze.

Never open on the biggest number; there is nowhere to go after it. Never end on motion; the last frame must be a clean, screenshot-ready card.

## A full 7-scene storyboard (22s @ 30fps = 660 frames)

| # | Scene | Frames | Sec | Beat |
|---|---|---|---|---|
| 1 | Intro: "{name}, ton année {year}" | 0–90 | 0–3 | Brand + palette set |
| 2 | Big number: minutes de montage | 90–210 | 3–7 | First count-up, hero scale |
| 3 | Top-5 videos, staggered | 210–330 | 7–11 | Ranked list builds 1→5 |
| 4 | Persona card | 330–420 | 11–14 | "Tu es la monteuse de l'équipe" |
| 5 | Comparison: "plus que {x} % des participants" | 420–540 | 14–18 | Bar fills, climax stat |
| 6 | Peak month / heatmap | 540–600 | 18–20 | "Mars, c'était ton mois" |
| 7 | Outro share card (holds still) | 600–660 | 20–22 | Logo + handle + CTA, frozen |

Scale by stretching/trimming the montage scenes (3–6), never the intro or the count-up payoffs. For 15s, drop scenes 4 and 6. For 45s, add a second list and a comparison scene.

## Scene-type recipes

**Intro.** Big name + year, palette wash. One line of motion: name slides/fades up over a gradient using the per-user `accent`. Sets the visual identity for the whole film.

**Big-number reveal.** One number, oversized (180–240px), counts up with a spring, label below. Nothing else on screen. This is the most-shared scene type — give it room.

**Top-X list.** Ranks 1→5 enter staggered (rank 1 first), each `{rank, label, value}`. Rank number small and accent-colored, label bold white, value muted. The stagger *is* the animation; keep each row's motion identical.

**Superlative / persona.** Map data to a named archetype ("le pilier", "l'oiseau de nuit", "le plus fidèle"). Compute the label from thresholds so it personalizes automatically. Big label, one supporting line.

**Comparison / percentile.** "Plus que 92 % des participants." A horizontal bar fills to that same 92 %, number counts up alongside — the key frame is a full bar. Strongest dopamine scene — usually the climax.

**Time / peak.** "Mars, c'était ton mois." A simple 12-bar mini-chart with the peak bar in accent, others muted. Reads instantly even frozen.

**Outro share card.** Holds **completely still ≥2s**. Name, @handle, product logo, short CTA/URL. No competing motion. This frame is the share asset — design it as a poster.

## Copywriting patterns (data → words)

Generate headline copy from the data, not hand-written per user:

- **Superlative tiers:** `ahead >= 99 ? "Plus que 99 % — tu es le pilier" : ahead >= 90 ? "Plus que 90 %" : "..."`.
- **Persona from dominant dimension:** pick the archetype whose threshold the row clears (genre share, late-night ratio, diversity count).
- **Comparison framing:** always "plus que X % des {peers}" — concrete peer group beats abstract numbers. Never a frame that ranks someone low.
- **Second person, present, short.** "Tu as monté 12 vidéos." Not "L'utilisateur a monté…" Each line ≤ 7 words so it fits one bold frame.

## 9:16 safe-area map

Render **1080×1920**. Story/Reels/TikTok UI overlays the edges and the platform may crop.

| Zone | Region | Rule |
|---|---|---|
| Top 10% | 0–192px | Avoid type; platform tabs/handle sit here |
| Bottom 22% | 1498–1920px | Avoid type/CTA; caption, sound and progress UI sit here |
| Right 14% | 929–1080px | Like/comment/share buttons sit here (lower half); keep centered type ~14% from both sides |
| Free band | ~192–1498px (68% h) | All numbers, names, lists, the share CTA |

> Dans Dérush : ce sont les zones de TikTok (`ZONE_SURE` de `src/pieces/commun.ts`), les plus larges des trois réseaux.
> L'original annonçait un « centre 80 % » tout en écartant 12 % en haut et 18 % en bas (il reste 70 %), et oubliait
> la colonne de boutons à droite.

Place the single most important element at vertical center (~960px) — it survives every crop and is where the eye lands. Test by checking frozen frames against these zones and confirming no number is occluded (`derush-controle` reports text hidden by a platform's interface).

## Motion language

Keep one motion vocabulary across all scenes so the film reads as one piece: same spring config for entrances, same fade for exits, accent color used consistently for "the number that matters." Consistency makes speed feel like confidence rather than chaos. Per-scene component code is in `remotion-recipes.md`.
