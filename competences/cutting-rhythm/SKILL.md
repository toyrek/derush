---
name: cutting-rhythm
description: À ouvrir quand un montage est juste mais haché, mou, monotone ou « monté par une machine », quand on demande de resserrer ou de fluidifier, et avant de finir tout montage de plusieurs plans, pour savoir quand décaler le son de l'image (coupes J et L) et de combien, où placer la coupe par rapport à la parole et au mouvement, quelle longueur laisser aux pauses, combien de temps tenir un plan et comment couper sur le temps de la musique.
---

# Cutting rhythm — why an accurate edit still feels wrong

> **Dans Dérush.** Ce savoir vient d'Agam More (voir `SOURCE.md`). Il était écrit pour un autre outil : ses commandes
> sont remplacées ici par ce que tu as dans ton dossier de travail.
>
> | Ce qu'il te faut | Où c'est |
> |---|---|
> | Décaler le son d'un plan | `son.avant_s` (le son commence avant l'image : coupe J) et `son.apres_s` (il continue après : coupe L), en secondes, sur le plan, dans `montage.json`. Le kit `remotion/` les joue déjà. |
> | Choisir, resserrer, réordonner des passages | `coupes.json`, puis `node remotion/recouper.mjs coupes.json` (temps du rush) |
> | Les silences mesurés | `analyse/<rush>.json` (`silences`, temps du rush : sous −38 dBFS pendant 0,35 s au moins) ; `son.silences` d'un plan (temps du montage), tant qu'il n'a pas été recoupé |
> | Les mots et leurs temps | `transcriptions/<rush>.json` (temps du rush), `sous-titres/mots.json` (temps du montage) |
> | Les temps d'une musique | `scenes.py <musique> --beats --json` (compétence `ffmpeg-skill`, dossier `scripts/`) |
> | Regarder et écouter le résultat | `node remotion/images.mjs`, `derush-controle`, Earshot s'il est installé |
>
> Les passages marqués « Dans Dérush » sont des ajouts ; le reste est le texte de l'auteur.

Frame-accurate cuts in the right places still watch badly if the *timing* is wrong. Three
levers do almost all the work, and they map onto three concrete things you can set:

| Symptom | Lever | Where |
|---|---|---|
| Choppy, abrupt, "every cut is a slam" | **split edits** — move the sound edit off the picture edit | `son.avant_s` / `son.apres_s` per plan |
| Draggy, dead, lots of air | **pause length** — collapse gaps to a beat | `coupes.json` |
| Monotone, mechanical, nothing lands | **shot length** — vary the holds, accelerate to the climax | plan durations (`duree.s`) |

List the plan durations and the split edits of `montage.json` before you render: they tell you
which of the three you're missing.

## 1. Split edits (J/L cuts) — the single biggest flow win

A cut where picture and sound change on the **same frame** is a butt cut. It announces
itself. Real edits stagger the two so the viewer's ear carries them across the visual
change and the cut disappears.

- **J-cut** — the *next* clip's sound arrives before its picture. You hear the answer
  starting under the end of the question. Use on almost every dialogue/interview cut.
- **L-cut** — the *current* clip's sound continues over the next picture. You keep hearing
  the speaker while you cut to what they're describing. Use for cutaways, B-roll, reactions.

Two fields express them, set on the plan whose sound moves. Change only these two numbers in
`montage.json`; the rest of the plan stays as it is:

```jsonc
// plan P2 : its sound starts 0.4 s before its picture (J-cut into P2)
{"id": "P2", "son": {"avant_s": 0.4, "apres_s": 0}}
// plan P2 : its sound runs 0.5 s over the picture of P3 (L-cut out of P2)
{"id": "P2", "son": {"avant_s": 0, "apres_s": 0.5}}
```

**Typical amounts**: 0.2–0.5 s for conversational cuts, 0.5–1.0 s for a documentary cutaway,
up to ~2 s when laying B-roll under continuing narration. Below ~0.15 s it's inaudible —
you've paid for nothing.

**Where to use it**: cuts *within* a continuous thought. Do **not** split a cut that's meant
to be a hard break — a scene change, a chapter boundary, or the button at the end of a
trailer wants the slam.

> **Dans Dérush.** Trois choses que le kit ne fait pas à ta place :
>
> - **Le kit ajoute, il ne remplace pas.** Le son qui déborde se joue *en plus* de celui du plan voisin, qui n'est
>   pas raccourci. Deux voix l'une sur l'autre, c'est raté. Le débordement doit donc tomber sur un silence du voisin
>   (regarde les silences du rush à cet endroit), ou sur un voisin sans son (`son.garder: false` : un plan de coupe, un B-roll).
>   Sinon, raccourcis toi-même le son du voisin dans `remotion/src/Montage.tsx`. Écoute chaque coupe décalée.
> - **Les lèvres.** Pas de coupe J ou L sur un saut de coupe du même visage : le son décalé ne colle plus à la
>   bouche qu'on voit. Les coupes décalées servent quand l'image change vraiment : une autre personne, un plan de
>   coupe, un B-roll, une réaction, un plan large. Face caméra et en format court, la coupe franche reste la règle.
> - **L'image ne bouge pas.** Une coupe décalée ne change aucun temps du montage : seul le son du plan commence
>   plus tôt ou finit plus tard, pris dans le rush autour du plan.

## 2. Where the cut actually goes

- **Cut in the silence, not on the word.** Get the *what* from the transcript
  (`transcriptions/<rush>.json`) and the *where* from the measured silences
  (`analyse/<rush>.json`); the silence boundary is the truth (whisper word times
  jitter ±0.3–0.7 s).
- **Leave the breath.** The intake before a sentence belongs to that sentence. Cutting it
  off is the classic "why does this sound rushed and airless" mistake.
- **Cut on motion, not around it.** A cut placed while a subject is moving (a gesture
  mid-swing, a head turn, a step) hides itself; a cut between two still moments exposes
  itself. Never cut on the *peak* of a gesture — cut just after it starts or just before it
  lands.
- **Match the outgoing and incoming energy.** Cutting from a wide static shot to a fast
  handheld one reads as a mistake unless the audio motivates it.

> **Dans Dérush.** Les silences de `analyse/` ne comptent que les pauses de 0,35 s et plus. Pour des pauses plus
> courtes, `silence.py <plan> --list --min-silence 0.2` (compétence `ffmpeg-skill`) les mesure sans rien écrire.

## 3. Pause grammar — natural, not dead

"Tighten this up" almost never means cut content; it means shorten the gaps.

Take the time out of the **middle** of each long pause, so the breath at the end of
one sentence and the intake before the next both survive. In `coupes.json`, end the passage a
little after the last word and start the next one a little before the first word; what is left
on both sides adds up to the target gap:

```jsonc
// the rush is silent from 18.70 to 20.85 s (2.15 s) : keep 0.25 s on each side = a 0.5 s gap
[
  {"plan": "P1", "de": 12.40, "a": 18.95},
  {"plan": "P1", "de": 20.60, "a": 27.10}
]
```

```bash
node remotion/recouper.mjs coupes.json
```

Guidance for the gap you leave, and for which pauses to touch at all:

| Feel | target gap | leave alone pauses under |
|---|---|---|
| Snappy / social / explainer | 0.25–0.35 | 0.6 |
| Normal talking head, vlog, tutorial | 0.4–0.6 | 1.0 |
| Documentary, workshop — let it breathe | 0.7–1.0 | 1.5 |

**Do not tighten uniformly.** A pause *after a punchline or a reveal* is doing work —
it's the beat the viewer laughs or thinks in. Widen those back out by hand in `coupes.json`
after tightening. Uniform pacing is exactly what makes an edit sound machine-made.

This is distinct from removing fillers: that cuts spoken um/uh; this leaves every word and
shortens the space between them. Remove fillers and retakes first, then tighten.

> **Dans Dérush.** `derush-controle` signale toute pause de plus de 0,7 s dans la vidéo finie. C'est « à regarder »,
> pas « à corriger » : une pause voulue après une chute, ou dans un film posé, se garde, et tu le dis. Pour une
> personne face caméra, la recette de Dérush demande aucun temps mort de plus d'une seconde.

## 4. Shot length — the snap

- **Vary the holds.** If the plan durations vary by less than ~15% (standard deviation over
  mean), the cut list is monotone no matter how good the picks are. Aim for a mix of short and long.
- **Accelerate toward the climax.** Trailers/montages want shot lengths that *shorten* as
  they build — e.g. 3.0, 2.6, 2.0, 1.5, 1.0, then the payoff.
- **Hold the last shot.** Endings want air. The final shot should be at or above the mean,
  never the tightest cut in the piece.
- **Hold after a hit.** A punchline, reveal or big visual needs a beat before the next cut,
  or it doesn't land.

Trailer structure that works: **hook** (≤2 s, in the first two seconds) → **build**
(lengthening context shots) → **turn** (the problem/conflict) → **climax** (fastest cutting)
→ **button** (one held shot + title).

## 5. Cutting on the beat

```bash
# tempo + beat grid of the music (ffmpeg-skill ; .agents/skills/… with Codex or Gemini)
python3 .claude/skills/ffmpeg-skill/scripts/scenes.py atelier/musique.mp3 --beats --json
```

Move each cut so it lands on a beat in the **output** timeline (cumulative running time:
`debut.s` and `fin.s` of the plans in `montage.json`) — which is what "cut on the beat"
means; snapping source timestamps to beats is meaningless. Cuts with no beat within about
0.4 s are left alone.

If the music bed starts partway into the track, or does not start at 0 in the montage, shift
the grid by that offset first, or every cut lands off the beat.

If the reported BPM looks like half or double what you expect, the grid is still musically
valid (it's a metrical level) — just coarser or finer than intended.

> **Dans Dérush.** Ne te sers pas de `cut.py --snap beats` quand la musique est posée à part : il cale les temps
> de la *source*. Fais le calcul sur les temps du montage, puis allonge ou raccourcis chaque passage dans
> `coupes.json`, du premier au dernier, pour que chaque coupe tombe sur un temps. N'utilise une grille que si
> `beat_grid.usable` est vrai.

## 6. The review loop

```bash
node remotion/images.mjs --de 11 --a 13 --pas 2     # the frames around a cut, without a full render
node remotion/rendre.mjs Montage rendu/final.mp4    # the render
derush-controle rendu/final.mp4                     # pauses that drag, fillers, retakes
```

List the plan durations in a column **before** rendering — it's free, and monotony shows at
a glance. Then listen to every join of the render (Earshot when it is installed):
a cut is judged with the ears first.

## Gotchas

- **A J-cut needs material to reach into.** A plan whose useful part starts 0.2 s into its
  file has only 0.2 s to borrow. Keep `son.avant_s` at or under `fichier.debut_utile_s`, and
  `son.apres_s` at or under what the file holds after `fichier.fin_utile_s`: past that, the
  kit does not stop you — a J-cut slips out of sync, an L-cut falls silent.
- **No `son.avant_s` on the first plan** — nothing precedes it.
- **Cut points land on the frame grid** in the kit: give `de` and `a` as whole numbers of
  frames of the rush when a cut must fall on an exact frame.
- **Order**: fillers and retakes → pauses → structure → cuts on the beat (all four through
  `coupes.json` and `recouper.mjs`) → split edits → everything else. `recouper.mjs` puts
  `son.avant_s` and `son.apres_s` back to 0 on every plan it rebuilds: tightening after you've
  set split edits loses them.
