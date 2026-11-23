# Lancement ou démo d’un logiciel (SaaS Launch Demo)

> SaaS launch and product demo editor for Claude: turns a screen recording plus optional founder voice/face into a 60-180 s launch or demo video (outcome, problem, walkthrough, result, CTA) with readable UI, targeted zoom-ins, callouts, cursor pointers, PII blurred, and a 15 s social cut and GIF loop.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Get the viewer to the "aha" fast: the outcome first, then the three moves that make it happen.

- **Best for:** product launches, feature announcements, Product Hunt videos, landing-page demos, onboarding videos
- **Inputs:** screen recording(s), optional webcam/founder clip or voice-over, logo, product name and URL
- **Formats:** 16:9 hero, 9:16 and 1:1 social cuts, GIF/WebP loops
- **Durations:** hero 60-180 s (launch film 60-90 s), social 15 s, loop 6 s
- **Genre preset:** `--genre saas-launch-demo`

## How a pro cuts this

**Structure (% of length)**

| beat | % | what goes here |
| --- | --- | --- |
| outcome | 10 | the finished result on screen in the first 2 s (dashboard, report, shipped thing) |
| problem | 10 | the painful old way in one line or one shot |
| walkthrough | 60 | three features, one idea each, each ending on its result |
| result | 10 | the payoff number or screen, said and shown |
| CTA | 10 | product name, URL, offer; logo |

**Pacing.** ASL 3-6 s; a visual change every 4 s (zoom, callout, pointer, cut). Cut every wait: loading, typing,
scrolling to find something. 2x-4x speed through boring but necessary steps.

**Cut rules.**
- Cut on the click: the result appears right after the action; never watch a spinner.
- Zoom in when the UI text is below ~24 px at 1080p; zoom out to re-orient after 2-3 moves.
- Jump cuts are fine in the screen recording; in the face cam cover them with the screen.
- Never show a feature that does not exist yet as if it ships (label "coming soon").

**Transition grammar.** Cuts and zoom punches; whip only between features; dissolve only for a scene change.

**Music and sound.** Light electronic bed ~-26 dB, ducked under the voice. UI SFX low: `click` / `ui-tap` on real
clicks, `success-chime` on the result, `whoosh-short` on feature changes (about 4/min).

**Colour.** No look on the UI (`grade` none): brand colours must stay accurate. Face cam only: `cool-corporate` 0.4.

**Captions.** Two-line subtitles low, sentence case, <= 20 cps (`"preset": "clean"`); keyboard shortcuts as `chip`s.

**What the client judges.** UI readability (on a phone too) and time to "aha".

**Common mistakes.** A 15 s logo intro; tiny unreadable UI; the cursor wandering; real customer data visible;
showing every setting; a feature tour with no outcome; CTA without a URL.

## Check before delivering

- Watch the contact sheet at phone size: every UI label readable, zooms land on the right element.
- No real personal data, keys or customer names visible in any frame (scrub the full render).
- Product name, prices and URL correct; every promised feature exists.
- `qc.py` passes; cut waits are gone; the CTA holds >= 2 s.

---

_Adapté de « saas-launch-demo », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
