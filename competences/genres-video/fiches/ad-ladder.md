# Campagne de pub en déclinaisons (Ad Ladder)

> Ad ladder editor for Claude: turns one commercial shoot (talent takes, product shots, supers, a licensed track) into a full ad package - a 60 s or 30 s story master, a 15 s cutdown and a rebuilt 6 s bumper, each frame-exact, in 16:9, 1:1, 4:5 and 9:16, captioned and textless, mixed to platform or broadcast loudness.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

One idea, told at every length: the 30 sells the story, the 15 sells the benefit, the 6 sells the brand.

- **Best for:** TV and online commercials, paid social campaigns, YouTube pre-roll and bumpers, product launches
- **Inputs:** script/board, talent and product takes, logo PNG, legal supers text, brand colours/fonts, licensed music
- **Formats:** 16:9 master; 1:1, 4:5 and 9:16 versions of every length
- **Durations (frame-exact):** 60 s, 30 s, 15 s, 6 s bumper (YouTube bumpers are non-skippable and max 6 s)
- **Genre preset:** `--genre ad-ladder` (`python CORE/scripts/editor.py genre ad-ladder`)

## How a pro cuts this

**The ladder is rebuilt, not trimmed.** Each length has its own structure. Cutting the 30 down to 6 by trimming gives a
bumper with no idea in it; build the 6 around one image, one line and the logo.

| length | structure | rule of thumb |
| --- | --- | --- |
| 60 s | hook 0-3 s → situation → tension → product as the turn → proof → offer → logo + CTA | room for a mini-story and a second proof beat |
| 30 s | hook 0-2 s → problem → product → benefit shown → offer/CTA → logo (last 3-4 s) | one story, one proof |
| 15 s | hook 0-1.5 s → benefit shown → product → logo + CTA (last 3 s) | drop the setup, keep the payoff |
| 6 s | one striking image → product/benefit line → logo | one idea; brand visible by 2 s, logo on screen ≥ 1.5 s |

**Pacing.** ASL 1-2.5 s; a visual change every ~2 s; the 6 s holds 2-4 shots. Product and logo shots get the longest
holds. Brand visible early (within the first 5 s of a 30, 2 s of a 6) for skippable placements.

**Cut rules.** Cut on action and motion; match cuts between product moments; smash cut into the reveal. Picture leads,
VO follows: J-cut voice under the incoming shot by 2-4 frames. No dead frames at the head or tail.

**Frame-exact lengths.** A 30 is 30.00 s (900 frames at 30 fps), not 29.7 or 30.4. Check each output with `qc.py`
(duration row) and fix by adjusting the last shot, never by speeding the whole spot.

**Supers (legal text).** Readable: hold at least 3 s plus 1 s per extra line (about 15 cps), inside title-safe,
contrast against the footage. A super that flashes by fails legal review.

**Music and sound.** Track leads (bed about -18 dB, ducked about 8 dB under VO); every length ends on a resolved bar
(`music_fit.py` per length, `"endButton": true`). Logo sting or a soft hit on the logo; whooshes only on real motion.

**Colour.** Product true to its real colour first (match to a reference frame of the product), then a light look:
`clean-commercial`, `food-pop` (food), `cool-corporate` (tech), intensity 0.4-0.6. Skin protected.

**Captions.** Social versions get burned-in captions (`"preset": "clean"` or the skin's style), ≤ 15 cps;
TV versions get none on picture and a separate caption file.

**What the client judges.** Product looks right, logo time, legal supers readable, every version delivered at the exact
length and spec, the message survives in the 6 s.

**Common mistakes.** Bumper trimmed from the 30; logo appearing in the last 0.5 s only; supers too short to read; spots
a few frames long or short; music cut mid-phrase; vertical versions with the product cropped off.

## Check before delivering

- Every length is frame-exact (`qc.py` duration row) and every aspect exists for every length that needs it.
- The 6 s has one idea, the brand by 2 s, the logo ≥ 1.5 s.
- Supers readable (≥ 3 s, ≤ 15 cps), inside title-safe, legally approved text only.
- Product colour true; product and logo in frame in vertical versions.
- Loudness per destination (-14 LUFS social, -24 LKFS US TV, -23 LUFS EU TV), true peak within limits; music ends on a bar.
- Textless versions and the caption files delivered alongside.

---

_Adapté de « ad-ladder », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
