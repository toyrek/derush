---
name: steal
description: À ouvrir quand la personne donne une vidéo en modèle (« monte comme ce reel », « dans le style de @x ») pour mesurer ce style avec FFmpeg au lieu de le juger à l'œil (coupes par seconde, rythme et bruitages, niveau de la musique sous la voix, taille du visage et zooms), l'écrire dans un STYLE.md chiffré, monter un essai et le comparer image par image avec le modèle avant de le montrer.
---

# Steal

> **Dans Dérush.** Cette méthode vient de Melvyn Malherbe (voir `SOURCE.md`). Elle était branchée sur un autre
> moteur de montage : ici, le style mesuré s'applique avec le kit `remotion/`, FFmpeg et les commandes de Dérush.
>
> - **Le modèle est un fichier que la personne t'a donné** : il est dans `contexte/` (voir `contexte/INDEX.md`) ou
>   dans `references/`. Rien ne se télécharge d'ici.
> - **On copie un style, pas une vidéo.** Le modèle sert à mesurer. Aucune de ses images, ni sa musique, ni ses
>   sons, ni son logo, ni son visage ne vont dans la vidéo livrée.
> - **Où ranger.** Les brouillons dans `atelier/steal-<name>/` (`W` dans les commandes). Le style dans
>   `rendu/livraison/annexes/style-<name>/` : la personne le reçoit avec sa vidéo et peut le redonner en pièce
>   jointe dans un autre projet.
> - **Pour appliquer le style** : `style` et `habillage.effets` de `montage.json`, les pièces du kit
>   (`remotion/src/pieces/LISEZMOI.md`), `coupes.json` pour le rythme des coupes, `derush-son mixer` pour le niveau
>   de la musique sous la voix, `MOTION.md` pour le reste.
> - **Pour écouter** : Earshot, s'il est installé, entend le rythme et les bruitages ; `scenes.py --beats` de
>   `ffmpeg-skill` mesure le tempo. Le spectrogramme reste le bon outil pour situer un son sur une coupe.
>
> Les passages marqués « Dans Dérush » sont des ajouts ; le reste est le texte de l'auteur.

Someone's edit works and you want it on your own videos. This skill measures their edit, writes it down as a style, and proves it on one of your takes before you use it.

Output:

- `rendu/livraison/annexes/style-<name>/STYLE.md`: what was measured, and the rules to follow.
- `rendu/livraison/annexes/style-<name>/stills/`: key frames of the original, to compare against.
- the test video.

Read [references/learnings.md](references/learnings.md) before you start. Each rule in it comes from a copy that got rejected.

## How to run it

- Talk in the creator's language. Say what you do in one line before each long step.
- `<name>`: the creator's handle in lowercase with dashes, unless the user names the style.
- Scratch files go in `atelier/steal-<name>/` (`W` below). Copy the reel there as `W/reel.mp4`:
  `mkdir -p atelier/steal-<name> rendu/livraison/annexes/style-<name>/stills`.

## 1. Get the reel

- A local file: use it.
- No file: ask the user to save the video and give you the file.
- When you can, study 2 or 3 reels of the same format. One reel can be the exception.

## 2. Measure

Do all three passes. A style copied from the frames alone misses half of it: the sound and the rhythm.

**Faster with sub-agents.** If your agent can run sub-agents (Claude Code, Codex), make the sheets and `cuts.txt` yourself (first block below), then hand Frames, Sound and Zooms to three sub-agents at the same time. Give each one the absolute paths, its section copied whole, and one file to write: `W/notes-frames.md`, `W/notes-sound.md`, `W/notes-zooms.md`, numbers and timestamps only, never playing audio aloud. Look at the sheets yourself while they work: you judge the look, they bring the numbers. Then write the style from their notes. Without sub-agents, do the passes one after the other.

### Frames and cuts

```bash
ffmpeg -v error -y -i W/reel.mp4 -vf "fps=2,scale=270:480,tile=8x3:padding=4:color=black" W/sheet-%02d.jpg
ffmpeg -hide_banner -i W/reel.mp4 -vf "scdet=threshold=12" -an -f null - 2>&1 | grep -o "scd.time: [0-9.]*" | cut -d' ' -f2 > W/cuts.txt
ffprobe -v error -show_entries format=duration -of csv=p=0 W/reel.mp4
```

- Each sheet holds 24 tiles at 2 per second. Sheet N, tile i (from 0) shows second 12(N-1) + i/2.
- Seconds per shot = duration / (number of lines in `cuts.txt` + 1).

Read EVERY sheet and write down:

- **Layouts**: full camera, split screen (where the seam sits), flat color with text, cut-out person on a color, B-roll, screenshots.
- **Captions, per layout**: font feel (condensed, rounded, serif), case, weight, size, where they sit on the body, how a word appears, which word gets emphasised and how.
- **Boards and images**: type, border, size, when they land (on the word that names them?), whether they stack.
- **Hook** (first 2 s), **CTA** (last 3 s), **color grade** (bright and flat, or contrasty and dark).

Save 6 to 10 key stills to `rendu/livraison/annexes/style-<name>/stills/`:

```bash
ffmpeg -v error -y -ss <seconds> -i W/reel.mp4 -frames:v 1 rendu/livraison/annexes/style-<name>/stills/t<seconds>.jpg
```

### Sound

```bash
ffmpeg -v error -y -i W/reel.mp4 -lavfi "showspectrumpic=s=3000x500:legend=0:scale=log:stop=11000" W/spectrum.png
```

- The image is 3000 px wide, so a cut at t seconds sits at x = 3000 × t / duration. Read it next to `cuts.txt`.
- A bright thin vertical stroke high up = a click. Wide and low = a boom. A rising smear = a whoosh. A dark gap across the steady music band = the beat drops out.
- Zoom on one cut to see its hit: `ffmpeg -v error -y -ss <cut - 1> -t 2 -i W/reel.mp4 -lavfi "showspectrumpic=s=1000x500:legend=0:scale=log:stop=11000" W/cut-<n>.png`.
- **Beat**: count the regular low strokes over 10 s on the spectrogram (or tap along while it plays): strokes per 10 s × 6 = BPM.

**Music level under the voice** (optional: only when ElevenLabs is connected in Dérush, the key is then already in your environment; it uses a few credits, say so first):

```bash
ffmpeg -v error -y -i W/reel.mp4 -vn -ac 1 -ar 44100 W/full.wav
curl -s -X POST https://api.elevenlabs.io/v1/audio-isolation -H "xi-api-key: $ELEVENLABS_API_KEY" -F audio=@W/full.wav -o W/voice.mp3
ffmpeg -v error -y -i W/voice.mp3 -ac 1 -ar 44100 W/voice.wav
for f in full voice; do ffmpeg -v error -i W/$f.wav -af "asetnsamples=882,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-" -f null - | grep -o "RMS_level=.*" | cut -d= -f2 > W/rms-$f.txt; done
paste W/rms-voice.txt W/rms-full.txt | awk '$1<-40{print $2}' | sort -n | awk '{a[NR]=$1}END{print "music while the voice is silent:", a[int(NR/2)+1], "dB over", NR/50, "s"}'
awk '$1>-30' W/rms-voice.txt | sort -n | awk '{a[NR]=$1}END{print "voice while talking:", a[int(NR/2)+1], "dB"}'
```

- These commands measure the level every 20 ms. The music is the full mix in the moments the isolated voice is silent.
- Music under the voice = the voice level minus the music level.
- Under 1 s of silence (an edit with every pause cut) is too little to trust: judge it on the spectrogram.
- Never subtract the isolated voice from the mix: it is not in phase with the original, so the result comes out louder than the voice.
- Without a key, judge the level on the spectrogram.

Write down where the music starts and which event gets which sound: cut, board, zoom, impact.

### Zooms

On the sheets, measure the face height as a share of the frame height on 10 tiles or so, and list the jumps in face size from one tile to the next:

- a jump at a cut = a change of framing between two shots
- a jump inside a shot = a punch-in
- a slow growth over a shot = a push

Write the range (e.g. face 12 to 25 % of the frame), the punch-ins per 10 s, and whether there is a push. These numbers are the ceiling for your copy.

## 3. Write the style

`rendu/livraison/annexes/style-<name>/STYLE.md`, in the user's language. Each line gives a value and the measurement behind it:

```markdown
# Style: <name>

Copied from <file or link>, measured on <date>.

## Cuts
- hard cut every 1.4 s on average (35 cuts in 50 s); no fade, no transition
## Framing
- face 12 to 25 % of the frame; punch-in 1.1 at most, about every 4 s, held until the next cut; slow push 0.6 %/s
## Captions
- ...
## Boards and images
- ...
## Sound
- boom bap beat ~90 BPM from the hook impact, 12 dB under the voice, drops out 0.3 s on punch-ins
- a dry high click on most cuts, a pop on each board
## Grade
- ffmpeg: eq=contrast=1.08:saturation=0.9,vignette=PI/5,unsharp=5:5:0.4
## Left out
- the AI video clips: replaced by your own footage or a board
## How it is applied here
- what goes in the style and the effects of montage.json, which pieces of the kit, what is written by hand in the composition
```

**Sound effects**: take them from a library of real sounds, never generate them by default.

- Pick the closest file in the sounds of the kit (`remotion/public/sons/`) or in the person's sound library (skills `sons-openverse` and `real-sfx`).
- Only when the original has a sound none of these comes close to, and the creator agrees (it uses their credits), generate 2 or 3 takes with ElevenLabs and keep the closest (the `sound-effects` skill has the options):
  ```bash
  curl -s -X POST https://api.elevenlabs.io/v1/sound-generation -H "xi-api-key: $ELEVENLABS_API_KEY" -H "content-type: application/json" -d '{"text":"single dry short high click, tight transient, no reverb","duration_seconds":0.5}' -o W/sfx-cut-a.mp3
  ```

**Images**: a picture the creator puts on screen (a product, a screenshot) comes from the person's own files; generate one only when they have none and they agree, never a generated face.

**Logos**: every app named on screen shows its real logo, never a letter in a circle.

## 4. Test it

1. Pick 10 to 20 s of the user's own rushes.
2. Edit them in the kit the way STYLE.md says: the cuts, the framing and the punch-ins, the captions, the boards on the word that names them, the sound, the grade.
3. Render the test: `node remotion/rendre.mjs <Composition> rendu/essai-<name>.mp4`.

## 5. Compare before showing

Put the original on top and the copy below, at the same seconds:

```bash
ffmpeg -v error -y -i W/reel.mp4 -i rendu/essai-<name>.mp4 -filter_complex "[0:v]fps=1,scale=216:384,trim=end_frame=15,tile=15x1[a];[1:v]fps=1,scale=216:384,trim=end_frame=15,tile=15x1[b];[a][b]vstack" -frames:v 1 W/compare.jpg
```

Go tile by tile:

- type size and weight
- board and logo size (they fill the space like in the original)
- grade
- no fade where the original cuts hard
- captions off the mouth
- nothing upside down

Run the spectrogram on the copy too: the hits must land on the cuts, the beat must sit at the same level under the voice. Measure the face size on its sheets: no more zooms than the original, the face never bigger.

With sub-agents, give the compare sheet, the key stills and the list above to a fresh-eyes sub-agent while you check the sound and the zooms: it reports every tile that differs. Fix every gap before showing. The user should never be the one to spot it.

## 6. Deliver

Deliver the test video, then tell the user in a few lines:

- what was measured (seconds per shot, BPM, music level, zooms)
- what was copied, and what was left out and why
- that the style sheet comes with the video, to give again with the next one

Each time the user rejects something, write it in STYLE.md. When the lesson is general, write it in `carnet-ia.md`: Dérush keeps it for the next projects.
