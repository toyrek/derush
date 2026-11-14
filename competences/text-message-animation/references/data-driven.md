# Data-Driven Chat Videos — Script → Messages → Batch

A chat video is a template × data. Author the conversation as data, and one composition renders an endless supply of videos: per-script, per-row of a CSV. This file covers the script formats, the CSV → threads conversion, data-dependent duration, and rendering many videos.

> **Dans Dérush.** L'original passait par `csv-parse` et `@remotion/renderer` (à installer et à brancher) et proposait
> Remotion Lambda (service payant d'AWS). Ici : Python pour lire le tableau, une boucle Node qui appelle
> `remotion/rendre.mjs` du kit, rien à installer. Les deux programmes ont été essayés (deux fils, une ligne fausse
> écartée, deux vidéos avec leurs sons). Les garde-fous de `SKILL.md` valent pour chaque fil.

## 1. The data contract

The composition's props are `{app, contact, thread}` (the shapes from `bubble-recipes.md`). Everything else — appear frames, typing windows, sounds, scroll, duration — is derived. So "make N videos" is just "supply N threads". Always give the three props: a missing one falls back to the example of `defaultProps`.

## 2. Authoring threads — JSON

The most direct format. One file per video (`atelier/fil.json`), or an array of threads for a batch.

```json
{
  "app": "imessage",
  "contact": "Maman",
  "thread": [
    {"from": "them", "text": "t’as mangé ?", "typingMs": 700, "ts": "Aujourd’hui 12:10"},
    {"from": "me", "text": "oui maman 😅", "delayMs": 500, "status": "read"},
    {"from": "them", "text": "t’as mangé quoi", "typingMs": 1200}
  ]
}
```

## 3. Authoring threads — CSV

CSV is the friendliest format for non-coders and for writing threads in a spreadsheet. One row per message; a new `thread_id` starts a new video.

```csv
thread_id,app,contact,from,text,typingMs,delayMs,status,reaction,ts
1,imessage,Maman,them,t’as mangé ?,700,,,,Aujourd’hui 12:10
1,imessage,Maman,me,oui maman 😅,,500,read,,
1,imessage,Maman,them,t’as mangé quoi,1200,,,,
2,whatsapp,Alex,them,tu dors ?,900,,,,
2,whatsapp,Alex,me,non,,400,read,,
```

Map rows into threads — group by `thread_id`, coerce the numeric/optional fields, skip a wrong row and say so:

```python
# python3 fils.py fils.csv > atelier/fils.json — one thread per thread_id, messages in row order
import csv, json, sys

fils = {}
for n, r in enumerate(csv.DictReader(open(sys.argv[1], encoding='utf-8-sig')), start=2):
    if r['from'] not in ('me', 'them') or not r['text'].strip():
        print(f'ligne {n} ignorée : from doit valoir me ou them, text ne doit pas être vide', file=sys.stderr)
        continue
    f = fils.setdefault(r['thread_id'], {'id': r['thread_id'], 'app': r.get('app') or 'imessage', 'contact': r['contact'], 'thread': []})
    m = {'from': r['from'], 'text': r['text']}
    for k in ('typingMs', 'delayMs'):
        if r.get(k):
            m[k] = int(r[k])
    for k in ('status', 'reaction', 'ts'):
        if r.get(k):
            m[k] = r[k]
    f['thread'].append(m)
json.dump(list(fils.values()), sys.stdout, ensure_ascii=False, indent=1)
```

## 4. Data-dependent duration

A longer script must make a longer video — never hand-set frames. The composition computes it from the same timeline the renderer uses (`calculateMetadata` with `buildTimeline`, `bubble-recipes.md` §8). This runs per render, so each thread gets its own correct length automatically.

## 5. One video per thread

```js
// node rendre-fils.mjs atelier/fils.json — one chat video per thread, from the pack folder. Node only, nothing to install.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const fils = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
fs.mkdirSync('rendu/livraison', {recursive: true});
for (const f of fils) {
  if (!/^[\w-]+$/.test(String(f.id)) || !f.contact || !Array.isArray(f.thread) || !f.thread.length) { console.warn('ignoré :', f.id); continue; }
  const sortie = `rendu/livraison/chat-${f.id}.mp4`;
  if (fs.existsSync(sortie)) { console.log('déjà là :', sortie); continue; }
  // every prop the composition reads is given: nothing falls back to the example of defaultProps
  const props = {app: f.app ?? 'imessage', contact: f.contact, thread: f.thread};
  const fin = spawnSync('node', ['remotion/rendre.mjs', 'Chat', sortie, '--props', JSON.stringify(props), '--titre', `Chat ${f.id}`], {stdio: 'inherit'});
  console.log(fin.status === 0 ? `fait : ${sortie}` : `échec : ${f.id}`);
}
```

```bash
python3 fils.py fils.csv > atelier/fils.json
node rendre-fils.mjs atelier/fils.json          # rendu/livraison/chat-<id>.mp4
```

Tips:
- **Verify one before all.** Render stills for ONE representative thread (see SKILL.md "Deliver & verify") before the whole batch — catch a layout/timing bug once, not N times.
- **Stable assets.** Keep the send/receive sounds in `remotion/public/sons/` and load them via `staticFile()` so every render finds them.
- **Per-thread variety.** `app` and `contact` travel with each thread, so one template covers every look without code changes.
- **Reruns.** A video already in `rendu/livraison/` is skipped: delete it to redo it.
- **Licence.** Many videos for a company of more than three people: a Remotion licence (skill `remotion-license`).

## 6. Writing the threads

Because the contract is just `Message[]`, you can write the threads yourself from the person's brief (JSON or CSV rows), then check them against the guardrails of `SKILL.md` and feed them to the loop. Script in → finished vertical chat videos out, no manual timing.

---
The text-message format lives or dies on rhythm and chrome — get the drip and the app details right.
