# Témoignage client (Testimonial Film)

> Customer testimonial editor for Claude: turns a real customer interview into a 60-150 s case-study film (result hook, problem, solution, numbers, recommendation) plus a 30 s cut and vertical clips, with the best soundbite first and every jump cut covered.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

A real customer, in their own words, saying what changed: credible first, polished second.

- **Best for:** customer case studies, client reviews, agency results, B2B social proof, course student stories
- **Inputs:** customer interview (one or two angles), B-roll of the customer using the product, result screenshots, logo
- **Formats:** 16:9 master, 9:16 and 4:5 cutdowns
- **Durations:** film 60-150 s, cutdown 30 s, Shorts 15-45 s
- **Genre preset:** `--genre testimonial-film`

## How a pro cuts this

**Structure (% of length)**

| beat | % | what goes here |
| --- | --- | --- |
| result hook | 10 | the single best soundbite: the outcome in their words |
| problem before | 25 | what life was like, the cost of the problem |
| solution | 30 | how they found and used the product, specific moments |
| result / numbers | 25 | concrete results, shown with counters or screenshots |
| recommendation + CTA | 10 | "I'd tell anyone who..." then logo and CTA |

**Pacing.** ASL 3-6 s, visual change at least every 5 s. Hold the face on emotional or credibility lines; B-roll the
explanations.

**Cut rules.**
- Paper edit from the transcript; the hook may move up from later in the interview (log it), but every sentence stays
  whole. `story.py reorder` flags partial splices (HIGH) and back-references (MED): resolve every flag.
- Cover every join: B-roll >= 0.5 s each side, second angle, or a >= 1.2x punch-in (`speaker.zooms`).
- Light filler removal; keep natural hesitations that make them sound real. Keep the breath before the key line.
- Never use a reaction or B-roll that changes the meaning (Kuleshov).

**Transition grammar.** Cuts and J/L cuts; one dissolve at most into the CTA. No flashy transitions.

**Music and sound.** Bed ~-24 dB under speech, ducked (`duck: "speech-aware"`), lifted at the recommendation.
Room tone on every join. SFX low (4/min): a soft tick on a counter.

**Colour.** Natural and trustworthy: `documentary-natural` or `portra` at 0.5. Brief says "punchy": `clean-commercial` 0.6.

**Captions.** Two-line sentence-case subtitles low in frame (`"preset": "clean"`), <= 17 cps; burned captions on verticals.

**What the client judges.** Credibility, the customer sounding natural, a concrete result.

**Common mistakes.** Starting with "Hi, my name is"; numbers nobody can verify; over-polished audio; obvious jump
cuts; music louder than the customer; a quote stitched from two answers.

## Check before delivering

- Every sentence is whole and in context; `story_flags.md` has no unresolved HIGH flags.
- Name, title, company and numbers match the customer's approval; disclosure present if they were compensated.
- No visible jump cut; voice clean but natural; `qc.py` passes loudness and caption checks.
- The customer (or the client on their behalf) has approved the final cut.

---

_Adapté de « testimonial-film », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
