---
name: prise-propre
description: À ouvrir pour nettoyer une prise face caméra brute avant de l'habiller (« coupe les blancs », « enlève les ratés ») en gardant la bonne prise de chaque phrase, en coupant les pauses sur le vrai silence du son et jamais sur les temps de la transcription, sans mot mordu ni clic aux raccords, puis en réécoutant la version coupée pour trouver les redites.
---

# Clean take: from a raw recording to a cut that reads once

> **Dans Dérush.** Cette méthode vient de la compétence `video-intake` de Charlie Hills (voir `SOURCE.md`). Seule
> sa méthode de coupe est reprise ici : son moteur de page et ses installations ne sont pas livrés, Dérush a déjà
> les siens.
>
> | Dans le texte d'origine | Ici |
> |---|---|
> | Transcrire avec Whisper | Déjà fait à l'import : `transcriptions/<rush>.json`, mot à mot, en temps du rush |
> | Les passages gardés, puis la coupe avec FFmpeg | `coupes.json` (`de`, `a` en secondes du rush), puis `node remotion/recouper.mjs coupes.json` |
> | Retranscrire la version coupée | `derush-controle <vidéo>` : Whisper la réécoute et signale les redites, les mots repris, les pauses, les « euh » |
> | Les mots des sous-titres | `sous-titres/mots.json`, recalés par `recouper.mjs` |
>
> - **La pause de 0,15 à 0,2 s est le réglage de l'auteur pour un Reel très serré.** Pour un ton plus posé, prends
>   les repères par genre de la compétence `cutting-rhythm`. Dans tous les cas, c'est la méthode qui compte : couper
>   dans le vrai silence.
> - **`analyse/<rush>.json` donne déjà des silences**, mais seulement ceux de 0,35 s et plus, sous −38 dBFS. Pour
>   poser un bord au plus juste, refais la mesure de l'étape 3 sur le rush.
> - **N'écris jamais dans `plans/`.** Une image tournée, Dérush l'a déjà remise droite à l'import. Le contrôle de
>   l'étape 2 sert à savoir ce que tu as entre les mains : si le son te semble faux (deux pistes, un décalage),
>   travaille sur une copie dans `atelier/` et dis-le à la personne.
>
> Les passages marqués « Dans Dérush » sont des ajouts ; le reste est le texte de l'auteur.

You end with a cut take: the best take of every line, the pauses tightened, no clipped word, nothing said twice.

## Step 1: What you start from

1. **The recording.** The raw phone or camera file. Vertical is best.
2. **The script,** if there is one. The recording still wins: captions follow what was said.

## Step 2: Check the file before you touch it

```
ffprobe -v error -show_streams plans/<rush> | grep -E "codec_type|codec_name|width|height|start_time|rotat"
```

- A rotation tag means the picture needs turning.
- Two audio streams (iPhone spatial audio) means you map only the first: `-map 0:a:0`.
- Audio that starts more than 0.02s after the picture sits off the lips as soon as the sound is processed on its own. Carry the offset (`-itsoffset`) wherever you do that.
- Width bigger than height and no rotation tag means a landscape file. A vertical video crops the middle out of it. Shoot one frame through that crop first and look at it, so the head sits in frame.

## Step 3: Pick the takes, then cut on silence only

- Read the whole transcript. A re-recorded line near the end beats the first try. Keep the last complete take of each line.
- A take rejected out loud ("scratch that", "let me start again") goes. Coughs go. Laughter stays.
- Cut every pause down to 0.15-0.2s. No silence over 0.25s survives, except one planned beat before a reveal.
- Cut only where the sound is truly silent. Never cut on the transcript's word times: Whisper stretches words across pauses. Find the real silences on the audio:

```
ffmpeg -i plans/<rush> -map 0:a:0 -af silencedetect=noise=-50dB:d=0.2 -f null - 2>&1 | grep silence_
```

  If that finds nothing, raise the threshold (try -45dB). If it finds silence inside words, lower it. Check the tail of each word: an "s" can hiss 0.3s past where the transcript says the word ends.
- A filler word with no silence around it ("I'm, right, so") stays. You cannot cut it cleanly.
- Snap every cut edge to the frame grid (a whole number of frames of the rush: 1/30s at 30 fps) before you trim. Float edges drift the lips by a few frames over a minute.
- Give every audio join a 30ms fade each side so nothing clicks. One fixed gain, never a normaliser.

Write the kept spans in `coupes.json`, in the order of the video and in seconds of the rush (its format is at the top of `remotion/recouper.mjs`), and build the cut:

```
node remotion/recouper.mjs coupes.json
```

> **Dans Dérush.** Le kit ne fait pas le fondu de 30 ms : il joue le son de chaque plan d'un bloc. Écoute chaque
> raccord ; si l'un claque, donne au son du plan une rampe de volume d'une image à l'entrée et à la sortie, dans
> `remotion/src/Montage.tsx` (`volume` accepte une fonction de l'image).

## Step 4: Listen to the CUT again

Render the cut and have it transcribed again:

```
node remotion/rendre.mjs Montage rendu/montage.mp4
derush-controle rendu/montage.mp4
```

It lists what is said twice (`redites`, `reprises`), the pauses that are left and the fillers.

Captions and every word-timed move use the timings of the cut (`sous-titres/mots.json`). Raw timings drift after each cut.

Now read the kept words end to end. Nothing said twice, nothing that points at something the viewer has not heard yet. Whisper often merges a repeated line into one long word on the raw take, so a double only shows up here. Found one? Go back to Step 3, cut it, and run this step again until the text reads once.

Then fix the words Whisper got wrong by hand (names, product names, the comment keyword) and drop any zero-length word at the very end. Viewers read every caption.

> **Dans Dérush.** Corrige les mots dans `sous-titres/mots.json` après le dernier recoupage : `recouper.mjs` les
> refait à chaque passage.

## What I learned the hard way

- **The recording is the source of truth,** not the script. People change lines on camera. Build captions and on-screen words from the cut transcript.
- **Ending a scene mid-word is the cut people hear first.** End each beat about 0.1s after its phrase ends.
- **Never trust a transcript at a join.** Listen to every one.
