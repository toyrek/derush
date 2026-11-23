# Pubs façon créateur, en variantes (UGC Ad Matrix)

> Performance-ad editor for UGC (creator-style) ads: builds a test matrix of 3-5 hook variants x one body x one or two CTAs, cut native to TikTok/Reels (selfie framing, platform-style captions, fast 1-2.5 s shots), and renders every combination in 9:16, 4:5 and 1:1 with captioned, clean and raw Spark/Partnership versions.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

One body, many hooks: an editor's test matrix of native-looking UGC ads, every ratio, every version.

- **Best for:** creator / customer selfie ads, app installs, DTC products, lead gen
- **Inputs:** separate takes for each hook (`hook1.mp4`...), the body (`body.mp4`), CTA take(s), product B-roll (optional), the offer text
- **Formats:** 9:16 1080x1920 master; 4:5 and 1:1; captioned + clean + raw (no graphics) for Spark / Partnership ads
- **Duration target:** 15-30 s (9-15 s cutdowns)

## How a pro cuts this

| beat | % (of 20-30 s) | what happens |
| --- | --- | --- |
| hook (variant) | 0-12 | thumb-stop in 1-1.5 s: problem, bold claim, result shown first, "POV", reaction |
| problem | 12-25 | the pain in the viewer's words |
| demo | 25-60 | product in hand, doing the thing; close-ups, B-roll every 1.5-2 s |
| proof | 60-80 | real result, real review, before/after (only if true) |
| offer + CTA | 80-100 | offer on screen, one CTA, product visible |

- **The matrix:** 3-5 hooks x 1 body x 1-2 CTAs = 3-10 ads. Hooks differ in *angle* (pain, result, curiosity, social proof), not just wording. Everything after the hook is identical so the test is fair.
- **Pacing:** ASL 1-2.5 s, a change at least every 2 s. Hook lands by 1.5 s with text on screen (most plays start muted).
- **Cut rules:** tight jump cuts are native here; remove every breath between sentences in the hook, keep a natural feel in the body. Keep it looking like a phone video: no cinematic grade, no letterbox.
- **Transitions:** hard cuts and zoom punches only. A whoosh at most once.
- **Music/SFX:** a light trending-style bed 22-26 LU under, ducked; pop / ding on the offer. Licensed music only (platform libraries for Spark).
- **Colour:** correct only; `clean-commercial` <= 0.4. True product colour matters.
- **Captions:** preset `boxed` or `hormozi`, 2-3 words, <= 15 cps, inside the ad safe zone (top 14 %, bottom 35 % on Meta Reels ads - keep key text in the middle band).
- **Client judges:** thumb-stop rate (3 s views), hold to 50 %, CTR, CPA - per hook.
- **Common mistakes:** hooks that are all the same angle, a logo first, text under the CTA button area, fake "customer" voices, offer not on screen, a body edited differently per variant (ruins the test).

## Check before delivering

- Hook text on screen by 0.5 s and spoken/shown by 1.5 s in every variant; body identical across variants.
- Real person, real words, real results; disclosure on paid ads; claims approved by the client.
- Key text and offer inside the safe band of every ratio; product visible at the CTA.
- `qc.py` passes for each file (-14 LUFS, -1 dBTP, length within platform limits).
- Tell the user: the matrix table, which hook you expect to win and why, every file path.

---

_Adapté de « ugc-ad-matrix », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
