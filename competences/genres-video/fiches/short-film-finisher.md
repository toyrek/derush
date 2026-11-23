# Finition d’un court métrage (Short Film Finisher)

> Finishing editor for a locked short film or narrative piece: per-shot colour correction and shot matching, a creative look on the footage only, film texture, dialogue / music / effects mix to the delivery loudness, room tone, titles and credits, then masters - ProRes 422 HQ, H.264 web, audio stems, M&E, textless, subtitles - and QC.

**Dans Dérush.** Cette fiche dit comment un monteur de métier coupe ce genre : la structure, le rythme, les règles de coupe, le son, la couleur, ce qu’il faut livrer et vérifier. Elle ne donne pas d’outil : monte avec ce que Dérush te donne (les rushes et leur texte dans `contexte/`, le kit `remotion/`, HyperFrames, `derush-son`, les compétences de sous-titres et d’étalonnage). Les noms entre accents graves qui restent dans le texte (`qc.py`, `--cut`, `hormozi`, `portra`…) sont ceux de l’outil d’origine : lis-les comme le nom d’un geste (contrôler la durée, couper un passage, des sous-titres de 2 ou 3 mots, un rendu de pellicule), et fais ce geste avec les outils de Dérush. La demande de la personne, son brief, sa marque et son carnet passent avant la fiche.

Picture is locked; now it has to look and sound finished, and ship in every format a festival or distributor asks for.

- **Best for:** short films, narrative branded films, music-video narratives, student films after lock
- **Inputs:** the locked cut (a single file, or a `scene-editor` / timeline work folder), the music and SFX files, credits text, the delivery spec (festival / platform)
- **Formats:** ProRes 422 HQ master, H.264 web master, stems (dialogue / music+effects mix), textless, `subtitles.srt`, EDL/FCPXML/OTIO
- **Duration target:** as locked (2-40 min)

## How a pro cuts this

| stage | what happens |
| --- | --- |
| 1. conform + lock | one locked file or spec; nothing moves after this |
| 2. technical correction | levels, white balance, exposure per shot; log -> Rec.709 |
| 3. shot matching | every shot in a scene matched to a hero frame |
| 4. look | one creative look on the footage (titles stay clean) |
| 5. texture | grain, halation, gentle vignette, letterbox |
| 6. sound | dialogue edit + chain, room tone, effects, music, mix to target |
| 7. titles + credits | opening title, end credits, spelling checked |
| 8. masters + QC | ProRes, web, stems, textless, subs, QC report |

- **Colour rules:** correct before look; skin on the skin line; don't brighten deep skin; one look per film (a different look only for a motivated section like a flashback). Check scopes, not just the monitor.
- **Looks:** `kodak-2383` 0.7-0.85 (classic print), `fuji-eterna` (muted drama), `bleach-bypass` (grit), `cinestill-800t` + halation (night), `teal-orange-pro` (commercial).
- **Sound rules:** dialogue first and always intelligible; room tone under every cut; ambience continuous across picture cuts within a scene; music supports, never fights the lines; silence before the big moment.
- **Loudness:** web -14 LUFS / -1 dBTP; festival/cinema ~ -27 LUFS dialogue-led (approximate: no LUFS spec, rooms are calibrated); broadcast EBU -23 / ATSC -24.
- **Client judges:** looks and sounds finished, spec met, every deliverable present, no QC failures.
- **Common mistakes:** grading before lock, a look that turns skin green, legal-level violations, music masking dialogue, missing textless/M&E, typos in the credits.

## Check before delivering

- Watch the whole master once, top to tail, with headphones and on a phone.
- `color.py qc` legal; scopes show sane blacks/whites; skin consistent across shots of a scene.
- Dialogue intelligible everywhere; no clicks at edits; room tone continuous; loudness on target.
- Credits and title spelled right (names triple-checked); textless and stems line up with the master frame-for-frame.
- Tell the user: look used, loudness measured, every file with its spec, known limits (M&E approximation).

---

_Adapté de « short-film-finisher », Claude Video Editing Skills (Viprasol Tech, licence MIT, commit `0212f770474a`) : les commandes de son moteur, ses réglages et ses habillages sont retirés, l’en-tête est celui de Dérush. Voir `../SOURCE.md`._
