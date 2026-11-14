---
name: clipify
description: À ouvrir pour passer en vertical un plan fixe où deux personnes se parlent (podcast, interview) en suivant celle qui parle ou en écran partagé, et pour monter une action en coupant sur chaque impact sonore (coup, frappe, batterie) après avoir vérifié sur l'image que le geste est dans le champ.
---

# Clipify

## Dans Dérush

De cette compétence, Dérush garde les deux techniques qu'il n'avait pas : **suivre la personne qui parle** dans un plan fixe à deux (ou la mettre en haut d'un écran partagé), et **couper sur chaque impact** d'une action. Le reste de l'original (chercher les moments drôles, retranscrire, sous-titrer, accélérer un plan) est déjà fait par Dérush et ses autres compétences : il n'est pas repris.

- **Choisir les passages** se fait comme d'habitude : `transcriptions/<rush>.json`, `coupes.json`, puis `node remotion/recouper.mjs coupes.json` (et les compétences `yt-shorts`, `podcast-and-audiograms`, `captions-and-clipping`). Les sous-titres sont ceux du projet (`<SousTitres>` du kit).
- **Le recadrage automatique de Dérush suit le plus grand visage**, pas la personne qui parle. Sers-toi de l'étape 4 quand un plan large montre deux personnes et que la sortie est verticale.
- **Les fichiers de travail** vont dans `atelier/clipify/` (crée le dossier). N'écris jamais dans `plans/`. `<skill-dir>` est le dossier de cette compétence. `python3` est le Python de Dérush, qui a déjà numpy : rien à installer.
- **Mesure sur la partie utile du plan** : mets `-ss <fichier.debut_utile_s> -t <duree.s>` avant `-i <fichier.chemin>` (valeurs du plan dans `montage.json`). Les temps de `segments.json` partent alors du début du plan.
- **Dans le kit Remotion, le chemin normal** : inutile de rendre un fichier recadré. Remplace `cadrage.points` du plan, dans `montage.json`, par un point à chaque changement de personne : `{"t": <debut.s du plan + start du segment>, "x": <centre du visage>, "y": 0.5, "type": "visage", "fenetre": [gauche, 0, l, 1], "coupe": true}`. Tout est en parts de l'image du rush : `l` = (largeur ÷ hauteur de la sortie) ÷ (largeur ÷ hauteur du rush), soit 0,3164 pour du 16:9 vers du 9:16 ; `gauche` = centre du visage − `l` ÷ 2, borné entre 0 et 1 − `l`. `"coupe": true` fait sauter le cadre d'un coup au lieu de glisser. Fais-le après ton dernier `recouper.mjs` : il repart du montage d'origine et efface ces points.
- **Hors du kit** (un extrait rendu par FFmpeg seul) : les commandes des étapes 4a et 4b telles qu'elles sont écrites, avec une sortie dans `rendu/`, sans jamais écraser un fichier.
- **L'écran partagé dans le kit** : deux `<Video muted>` du même plan, chacune dans une moitié de l'image et cadrée sur un visage ; celle qui parle passe en haut, d'après `segments.json`.
- **L'action** : les temps trouvés par `detect_transients.py` dans le son d'un fichier de `plans/` sont des temps du rush, ceux qu'attend `coupes.json`. Écris un passage `{"plan": "P1", "de": T − 0.4, "a": T + 0.5}` par coup gardé, puis `node remotion/recouper.mjs coupes.json`. Pour un son de plus d'une vingtaine de minutes, mesure par morceaux (`-ss`, `-t`) et ajoute le décalage : le programme garde tout le son en mémoire.
- **Vérifie toujours sur des images** : `node remotion/images.mjs --de <s> --a <s> --pas <images>`. À chaque changement, le cadre doit être sur la personne qui parle, tête entière. Si les mots de la transcription portent `locuteur`, compare avec `segments.json`.

## Modes

Pick one before you start.

- **Dialogue mode** (default for podcasts, interviews, talking-heads): once the moments are chosen, reframe on whoever is speaking. → Step 4.
- **Action mode** (woodchopping, sports, percussion, drumming, anything with repeated impact sounds): run `detect_transients.py` to find each strike, cut on each one. → Step 1B. No captions: the strike sounds *are* the rhythm and captions just clutter the visual.
- **Hybrid**: dialogue mode for talking sections, action mode for the rest, intercut.

If the user says "I'm not talking in this," you're in action mode. If they say "cut on each X" (chop, hit, punch, drumbeat, swing, footstep), you're in action mode. Default to dialogue mode otherwise.

## Tooling

- **ffmpeg** for the measurements; `-c:v libx264 -crf 20` for a master rendered outside the kit.
- **Scripts:** `<skill-dir>/scripts/` (where `<skill-dir>` is the directory containing this SKILL.md)
  - `analyze.py` — speaker timeline from two ROI motion files
  - `build_pan.py` — ffmpeg crop x-expression with hard cuts
  - `detect_transients.py` — find sharp impact sounds (action mode); see `--help`

Working dir: `atelier/clipify/` in the working folder. Run the commands from the working folder, with relative paths.

---

## Workflow

### Step 1B — Find each strike (action mode)

Find the strikes with audio-transient detection. The detector finds sharp impacts (axe-on-wood, fist-on-pad, drumhead, ball-on-bat, wood landing on a pile) by computing spectral flux on the 1–6 kHz band — the broadband impulse an impact creates that ambient/wind doesn't.

```bash
ffmpeg -y -i "$VIDEO" -vn -ac 1 -ar 16000 atelier/clipify/audio.wav
python3 <skill-dir>/scripts/detect_transients.py atelier/clipify/audio.wav \
  --min-flux 30 --min-gap 0.6 > atelier/clipify/strikes.json
```

Tuning:

- `--min-flux 30` is the sane default. Real impacts register 50–300; ambient/wind sits at 5–15. Too many false positives → raise to 40–50. Too few hits → drop to 20. The threshold is absolute: a very quiet or very loud recording shifts these figures, so look at the `flux` values it prints before settling. They also assume the 16 kHz mono WAV made by the command above: keep `-ac 1 -ar 16000`.
- `--min-gap 0.6` (seconds) is the closest two strikes can be. Fast drumming may need 0.2; chopping is fine at 0.6–1.0.
- `--band 1000:6000` covers wood/metal/glass impacts. Heavy thuds (kick drum, body shots) live lower (`--band 200:2000`); whistles/clinks/snare cracks higher (`--band 4000:10000`).
- For multi-clip sources (a folder of phone clips), run the detector on each clip and pick a varied set across angles. Aim for 50–65 strikes for a 45–60s montage at ~0.9s per shot.

Each "shot" should start ~0.4s before the strike (showing wind-up) and end ~0.5s after (strike + brief follow-through). That's ~0.9s per beat.

### Step 1.5 — Verify each candidate is in frame

**Always do this before rendering**, in either mode. Audio detection finds the *sound* of an event; the camera might not have captured it. Skipping this is the #1 way to get user feedback like "you cut on chops where I'm not even visible."

```bash
# Sample one frame at each candidate strike time T:
for T in $STRIKE_TIMES; do
  ffmpeg -y -ss "$T" -i "$VIDEO" -frames:v 1 -vf scale=320:-1 \
    atelier/clipify/verify_${T}.jpg
done
```

Read each verify image and drop the candidate if:

- The subject is bent down, off-frame, or behind an obstacle
- A thumb is on the lens (yes, this happens — and you only catch it visually)
- It's clearly a different sound source (door slam, dropped tool) that triggered the detector

For ~30 candidates this is one fast `ffmpeg` call each plus a single batch image read. Cheap insurance.

### Step 4 — If 16:9 → 9:16: pan-between-faces vs split-screen

Detect source aspect with `ffprobe`. If source is 16:9 and target is 9:16, there are two options: **(a) hard-cut pan** that follows whoever is speaking (single face on screen at a time), or **(b) split-screen** stack with both faces visible. Take the one the brief asks for; ask only when nothing settles it, in one question.

Skip this step if there's only one face (single-talker clip): the automatic reframing already follows it.

#### Step 4a — Pan-between-faces (recommended for fast-cut talking-head dialogue)

1. **Locate the two face ROIs.** Sample one frame: `ffmpeg -y -ss <middle> -i <clip> -frames:v 1 atelier/clipify/probe.jpg`. Read it. Eyeball each face's mouth+chin area as `x,y,w,h` in the source's pixel space. (No cv2 needed — camera is static within a clip; one frame is enough.) Verify by drawing boxes:

   ```bash
   ffmpeg -y -i atelier/clipify/probe.jpg -vf "drawbox=x=$LX:y=$LY:w=$LW:h=$LH:color=cyan@0.9:t=4,drawbox=x=$RX:y=$RY:w=$RW:h=$RH:color=magenta@0.9:t=4" atelier/clipify/verify.jpg
   ```

   Iterate **at most twice**. Boxes should cover mouth + chin and avoid hands/mics. Don't over-tune — frame differencing is forgiving.

2. **Extract per-frame motion energy in each ROI:**

   ```bash
   ffmpeg -y -ss "$START" -t "$DURATION" -i "$VIDEO" -filter_complex "
   [0:v]split=2[a][b];
   [a]crop=$LW:$LH:$LX:$LY,format=gray,tblend=all_mode=difference,signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=atelier/clipify/L.txt[la];
   [b]crop=$RW:$RH:$RX:$RY,format=gray,tblend=all_mode=difference,signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=atelier/clipify/R.txt[ra]
   " -map "[la]" -f null - -map "[ra]" -f null -
   ```

3. **Build speaker timeline** (min dwell 1.0s — short interjections merge into the prior speaker):

   ```bash
   python3 <skill-dir>/scripts/analyze.py atelier/clipify/L.txt atelier/clipify/R.txt 1.0 > atelier/clipify/segments.json
   ```

   Times in `segments.json` count from `$START`.

4. **Pick pan x-coordinates** for a 9:16 vertical strip from the source. With source W=1920 and target W=1080, crop strip width = 608 (in general: source height × 9/16, rounded to an even number; 1216 for a 2160p source).
   - LEFT_X = `face_left_center_x - 304` (clamp ≥ 0)
   - RIGHT_X = `face_right_center_x - 304` (clamp ≤ source_W - 608)

5. **Generate the hard-cut x expression and render** (outside the kit; in the kit, write the reframing points instead, see « Dans Dérush »):

   ```bash
   EXPR=$(python3 <skill-dir>/scripts/build_pan.py atelier/clipify/segments.json $LEFT_X $RIGHT_X)
   ffmpeg -n -ss "$START" -t "$DURATION" -i "$VIDEO" -filter_complex \
     "[0:v]crop=608:1080:x='$EXPR':y=0,scale=1080:1920:flags=lanczos[v]" \
     -map "[v]" -map 0:a -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
     -c:a aac -b:a 192k rendu/clip_panned.mp4
   ```

   Source 1920×1080 assumed; for 4K source either downscale first or double all coordinates.

#### Step 4b — Split-screen (both faces always visible)

Two stacked tiles, 1080×960 each. The active speaker's tile is on top — overlay flips at speaker changes.

```
[0:v]split=2[a0][a1];
[a0]crop=Wcrop:Hcrop:LX_tile:LY_tile,scale=1080:960,split=2[lt0][lt1];
[a1]crop=Wcrop:Hcrop:RX_tile:RY_tile,scale=1080:960,split=2[rt0][rt1];
[lt0][rt0]vstack[layoutL];
[rt1][lt1]vstack[layoutR];
[layoutL][layoutR]overlay=0:0:enable='<RIGHT_SPEAKER_ENABLE>'[v]
```

Build `<RIGHT_SPEAKER_ENABLE>` from `segments.json` as `between(t,a,b)+between(t,a,b)+...` over the right-speaker segments. Tile crops should target ~720×640 around each face (1.125:1 to match 1080×960).

---

## Pitfalls (lessons from prior runs — don't repeat)

- **Audio detection ≠ visible event.** Always run Step 1.5 (verify each candidate frame) before rendering. The detector finds the *sound* of a chop, not whether the chopper is in frame. Hits where the subject is bent over, off-camera, or where a thumb is on the lens still trigger the audio detector. Catch them before rendering.
- **Spectral-flux band matters.** Default `--band 1000:6000` covers wood/metal/glass impacts. Heavy low thuds (kick drum, body shots) need `--band 200:2000`. Whistles, clinks, snare cracks need `--band 4000:10000`. If `--min-flux 30` returns nothing, try lowering to 15 first; if it returns thousands, try a different band before raising the threshold.
- **Don't over-tune ROIs.** Two iterations max. Motion-diff is forgiving — wider ROIs covering mouth+chin work fine even if not perfectly mouth-centered.
- **Watch out for scene cuts inside a clip.** The camera cuts of each rush are in `analyse/<rush>.json` (`coupes_camera`). If a 16:9→9:16 clip has many cuts, the fixed face ROIs only work for the dominant scene; warn the user, and offer to either pick a single-take clip or accept off-center framing during cuts.
- **Source resolution matters.** If source is 4K, either downscale to 1920×1080 first (faster, fine for 9:16 output) or multiply all ROI/pan coordinates by 2.
- **State the plan in one line, then act.** Don't narrate every iteration.
