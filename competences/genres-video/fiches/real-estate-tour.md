# Visite d’un bien immobilier (Real Estate Tour)

> Real-estate tour editor for Claude: turns gimbal, drone and phone clips of a property into a 60-120 s walk-through ordered like a buyer's visit (exterior, entry, living, kitchen, bedrooms, amenities), with price/beds/baths cards, a branded version, an unbranded MLS version and a 20-30 s vertical reel.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

A calm, bright walk through the home in the order a buyer would walk it, with the facts on screen and every version the agent needs.

- **Best for:** listings, rentals, holiday homes, new-build show homes, commercial spaces
- **Inputs:** one clip per room (gimbal glides, drone), optional photos, agent logo/contact, price + beds + baths + area, licensed music
- **Formats:** 16:9 branded master, 16:9 unbranded (MLS), 9:16 reel
- **Durations:** tour 60-120 s (MLS often 45-90 s), reel 20-30 s of 5-7 clips
- **Genre preset:** `--genre real-estate-tour`

## How a pro cuts this

**Structure (tour, % of length)**

| beat | % | shots |
| --- | --- | --- |
| exterior / drone | 15 | establishing drone or street approach, title card with address |
| entry | 10 | front door opening, hallway glide |
| living | 20 | widest angle first, then a detail (fireplace, view) |
| kitchen | 15 | wide, island, one appliance or finish detail |
| bedrooms | 20 | primary suite first, then the rest; bathrooms after their bedroom |
| amenities | 10 | garden, pool, garage, view, neighbourhood |
| outro + contact | 10 | hero exterior (dusk if you have it), agent card |

**Pacing.** ASL 2.5-5 s. Each room gets one wide (3-5 s) plus at most one detail. Total 60-120 s. Never more than 3
shots of one room.

**Cut rules.**
- **No jump cuts.** Each shot is a full glide with a clean start and end. Cut on the move, mid-glide, and let the next
  shot continue in the same direction (left-moving into left-moving).
- Speed-match glides: a slow push followed by a fast pan looks broken. Use `"speed"` in the spec to even them out.
- Straight verticals: walls must not lean. Reject tilted shots instead of using them.
- Order follows the walk; never jump back to a room you left.

**Transition grammar.** Short dissolves (0.4-0.6 s) between rooms, straight cuts inside a room, one dip to black before
the agent card. No whips, glitches or flashes.

**Music and sound.** Upbeat, light, licensed bed that leads (bed about -18 dB, no ducking unless there is a voice-over).
Cut to length on bars and end on a hit (`fitTo: "beats"`, `endButton: true`). Room sound muted. SFX none.

**Colour.** Accurate and bright: `real-estate-bright` at 0.5-0.7, or `clean-commercial`. Whites must look white, not
blue or yellow. Open the shadows; windows can clip a little but not the whole frame.

**Captions / text.** No creator captions. Facts as cards: address + price + beds/baths/area at the open, room chips
("Chef's kitchen") as a `chip` at the lower left for 2 s, agent `card` at the end. Text lives in the branded version only.

**What the client judges.** The space looks big and bright, the flow makes sense, the numbers are right, the MLS
version passes the board's rules, and they get a vertical for Instagram.

**Common mistakes.** Jump cuts inside rooms; tilted verticals; too many shots of one room; music that fades mid-phrase;
branding left in the MLS version; portrait video for YouTube; wrong price on screen.

## Check before delivering

- Contact sheet: verticals straight, rooms bright, nothing personal in frame, chips readable and inside the safe area.
- Every number (price, beds, baths, area, phone) matches the listing sheet, letter by letter.
- The unbranded file contains no name, phone, logo or URL anywhere (watch it end to end).
- Music ends on a downbeat; `qc.py` passes loudness and has no black or flash frames.
- Report: lengths of each version, the music credit, and which file goes where (MLS, YouTube, Instagram).

---

_Adapté de « real-estate-tour », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
