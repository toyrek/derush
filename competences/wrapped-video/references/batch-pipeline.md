# Batch pipeline: one template → many personalized videos

The whole point of a Wrapped is scale: write the template once, render a unique MP4 for every row in a data table. This file covers turning a CSV of records into a folder of personalized videos, validating data, reruns, and share stills.

> **Dans Dérush.** L'original passait par `csv-parse`, `zod`, `tsx`, `p-limit` (paquets à installer) et proposait
> Remotion Lambda (service payant d'AWS) et un hébergement avec liens signés. Ici, rien à installer : Python pour lire
> le tableau, Node pour la boucle, et `remotion/rendre.mjs` du kit pour chaque vidéo (il montre le rendu en direct
> dans Dérush). Les deux programmes ci-dessous ont été essayés : deux vidéos rendues, une ligne invalide écartée. Tu
> les écris dans le dossier de travail et tu les lances depuis sa racine.

## The shape of the pipeline

```
data table (CSV)  →  rows  →  check each, type each  →  props
                                                    →  remotion/rendre.mjs → rendu/livraison/bilan-<id>.mp4 (+ .jpg)
```

Every video is a pure function of one validated row. If a row fails validation, skip it and log — never render a half-filled Wrapped.

## CSV → rows

Keep one column per field. Nested fields (top-X arrays) are easiest as a JSON string in a single cell, parsed on load.

```csv
id,prenom,annee,couleur,minutes,top,persona,devant
ines,Inès,2026,#FF5A36,1240,"[{""rank"":1,""label"":""Clip de fin d’année"",""value"":42},{""rank"":2,""label"":""Interview du maire"",""value"":31}]",Tu es la monteuse de l’équipe,92
sam,Sam,2026,#2EC4B6,860,"[{""rank"":1,""label"":""Tournoi de foot"",""value"":27}]",Tu es le roi du ralenti,71
```

```python
# python3 lignes.py donnees.csv > lignes.json — one record per row, typed and checked; a bad row is skipped, never half-filled
import csv, json, sys

rows = []
for n, r in enumerate(csv.DictReader(open(sys.argv[1], encoding='utf-8-sig')), start=2):
    try:
        rows.append({
            'id': r['id'].strip(),                         # stable: names the output file
            'name': r['prenom'].strip(),
            'year': int(r['annee']),
            'accent': r.get('couleur') or '#FF5A36',
            'big': {'value': float(r['minutes']), 'label': 'minutes de montage'},
            'top': json.loads(r['top']),                    # one cell: [{"rank":1,"label":"…","value":42}, …]
            'persona': r['persona'].strip(),
            'ahead': float(r['devant']),
            'peers': 'des jeunes de l’atelier',
            'handle': (r.get('compte') or '').strip(),     # every displayed field, even empty: missing ones would show the example's
        })
    except (KeyError, ValueError) as e:
        print(f'ligne {n} ignorée : {e!r}', file=sys.stderr)
json.dump(rows, sys.stdout, ensure_ascii=False, indent=1)
```

Every displayed field is set on every record, even empty (`"handle": ""`): Remotion merges the props of a render over the composition's `defaultProps`, so a missing field would silently show the example's value.

## The render loop

One render per record, one after the other: each already uses every core of the machine.

```js
// node rendre-lot.mjs atelier/lignes.json — one video per record, from the pack folder. Node only, nothing to install.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const lignes = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const ok = (r) => r && typeof r.id === 'string' && /^[\w-]+$/.test(r.id) && typeof r.name === 'string' && Number.isFinite(r.year)
  && Number.isFinite(r.big?.value) && Array.isArray(r.top) && r.top.length > 0 && Number.isFinite(r.ahead) && r.ahead >= 0 && r.ahead <= 100;
fs.mkdirSync('rendu/livraison', {recursive: true});
for (const r of lignes) {
  if (!ok(r)) { console.warn('ignorée (incomplète) :', r?.id); continue; }
  const sortie = `rendu/livraison/bilan-${r.id}.mp4`;
  if (fs.existsSync(sortie)) { console.log('déjà là :', sortie); continue; }   // a rerun only does what is missing
  const fin = spawnSync('node', ['remotion/rendre.mjs', 'Bilan', sortie, '--props', JSON.stringify(r), '--titre', r.name], {stdio: 'inherit'});
  if (fin.status !== 0) { console.error('échec :', r.id); continue; }
  // the share card, for a preview or a link: the last frame
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-sseof', '-0.2', '-i', sortie, '-frames:v', '1', '-q:v', '2', sortie.replace(/\.mp4$/, '.jpg')]);
  console.log('fait :', sortie);
}
```

```bash
python3 lignes.py donnees.csv > atelier/lignes.json
node rendre-lot.mjs atelier/lignes.json
```

`rendre.mjs` bundles the project on each call (a few seconds); with tens of videos that is fine. Rendering 22 s at 1080×1920 took about 10 s per video on the machine where this was tried.

## Reruns, naming, share stills

- **Verify one before all.** Render stills and one video of a representative row first (see SKILL.md "Deliver & verify") — catch a layout or data bug once, not N times.
- **Idempotent naming** — name outputs by a stable record id (`bilan-<id>.mp4`): a rerun skips what exists and only renders what is missing or was deleted (delete a video to redo it).
- **Validate upstream** — run the conversion over the whole table before rendering anything; fix data once, not mid-batch. The skipped rows are listed on the error output.
- **Share stills** — the loop also saves the last frame of each video (`bilan-<id>.jpg`), the share card, for previews.

| Concern | Pattern |
|---|---|
| Output name | `rendu/livraison/bilan-<recordId>.mp4` (stable, idempotent) |
| Share still | `rendu/livraison/bilan-<recordId>.jpg`, the last frame |
| Delivery | the folder `rendu/livraison/`; publishing goes through Treg (`derush-publier`) only if the person asks |

## Pipeline checklist

- Convert and check every row first; skip + log invalid rows.
- Every record gives every displayed field.
- One representative row verified by stills and one video before the batch.
- Stable per-record filenames so reruns are idempotent.
- A share still per record alongside the MP4.
- Many videos for a company of more than three people: a Remotion licence (skill `remotion-license`).
