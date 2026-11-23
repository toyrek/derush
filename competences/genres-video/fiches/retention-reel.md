# Reel face caméra qui retient (Retention Reel)

> Professional retention editor for talking-head Reels, TikToks and YouTube Shorts (15-60 s). Cuts a raw clip the way a top short-form editor does - hook on screen by 1.5 s, open loop, one idea per beat, a visual change every 1.5-3 s, payoff, then a CTA or a seamless loop back to the first frame - and delivers 9:16 burned-in, clean and SRT versions.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Turns one raw talking clip into a short that holds the scroll: hook by 1.5 s, no dead air, payoff, loop or CTA.

- **Best for:** tips, opinions, stories, announcements, founder clips, one person talking to camera
- **Inputs:** one talking clip (any orientation; 16:9 gets a face-follow reframe), optional music, optional B-roll folder
- **Formats:** 9:16 1080x1920 master, 4:5 feed, clean (no captions), `captions.srt`
- **Duration target:** 15-60 s (sweet spot 20-40 s)

## How a pro cuts this

**Structure** (percent of the finished length):

| beat | % | what happens |
| --- | --- | --- |
| hook | 0-6 | the strongest line or visual, on screen as text (<= 7 words), lands by 1.5 s |
| open loop / setup | 6-18 | a number, question, contrast or stakes the end will pay off |
| value beats | 18-76 | one idea per beat, each 3-6 s, something changes every 1.5-3 s |
| payoff | 76-92 | close the loop; the line people will share |
| loop-back / CTA | last 2 s | a CTA, or the last line runs straight into the first frame |

- **Pacing:** ASL 1.5-3 s. Vary it: a 4 s hold on the emotional line, 1 s snaps in a list. Never uniform.
- **Cut rules:** cut at the end of a thought, in the quietest gap (`--smart-cuts`), keep 0.1 s of breath before a word. Jump cuts are allowed here, but alternate punch-in sizes (1.12x / 1.07x) so it doesn't feel like a metronome. Keep the last good take (`--retakes`).
- **Never open with** "hi guys", "welcome back", "in this video", a logo or > 0.3 s of silence. Start on the hook sentence even if it was said at 0:40 (`story.py reorder`).
- **J/L cuts:** rarely needed in a single-camera reel; use an L-cut only when B-roll runs over a statement.
- **Transitions:** cut. Zoom punch on key words, an occasional whip or flash on a topic change. One transition kind per reel.
- **Music/SFX:** optional bed 20-24 LU under the voice, ducked. SFX medium density (~10-15 per minute): pop on key words, swish on cuts, impact on the payoff. Drop the music 0.5 s before the payoff line.
- **Colour:** correct first, then `clean-commercial` or `punchy` at 0.6-0.8. Moody topics: `moody` 0.5.
- **Captions:** motion.md preset `hormozi` (or the skin's own), 1-3 words, <= 17 cps, inside 10-85 % height and clear of the right 12 %, `dodgeFace: true`.
- **Client judges:** 3-second hold, watch-through %, shares and saves, "does it look native".
- **Common mistakes:** slow open, every pause removed (breathless), 3+ overlays stacked, captions under the platform buttons, an outro after the payoff, a hook that the video never pays off.

## Check before delivering

- Hook on screen and spoken by 1.5 s; first word <= 0.3 s; no greeting.
- `review.md` has no HIGH items; contact sheet: nothing over the face, nothing under the right rail, <= 2 overlays plus captions.
- Captions match the audio word for word; names and numbers spelled right.
- `qc.py`: -14 LUFS, -1 dBTP, no black or flash frames, 9:16 safe zone passes.
- It loops cleanly or ends on the CTA; nothing after the payoff.
- Tell the user: seconds removed, the hook you chose and why, the look, every file path.

---

_Adapté de « retention-reel », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
