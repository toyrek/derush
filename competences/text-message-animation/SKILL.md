---
name: text-message-animation
description: À ouvrir pour une vidéo de conversation par messages (histoire racontée en SMS, iMessage ou WhatsApp, « faux SMS » de fiction, conversation animée en 9:16) : bulles qui arrivent une à une, indicateur « en train d'écrire », accusés de lecture, réactions, son calé sur chaque message, défilement, avec une composition Remotion vérifiée et ses garde-fous.
---

# Text Message Animation

> **Dans Dérush.** Ce savoir vient d'iart.ai (voir `SOURCE.md`). La composition complète
> (`references/bubble-recipes.md`) a été corrigée et rendue avant livraison, en iMessage, SMS et WhatsApp, puis en
> deux vidéos depuis un tableau : celle de l'original empilait toutes les bulles au même endroit et laissait le
> défilement à écrire.
>
> | Ce qu'il te faut | Où c'est |
> |---|---|
> | La composition | `remotion/src/chat.tsx` (copie de la référence), déclarée dans `remotion/src/Racine.tsx` |
> | Les sons d'envoi et de réception | ceux du kit (`remotion/public/sons/pop.wav`, `declic.wav`) ; mieux : un vrai son de la bibliothèque, d'Openverse (`sons-openverse`, crédit dans `CREDITS.md`) ou d'ElevenLabs (`sound-effects`) |
> | Les zones des réseaux | `ZONE_SURE` de `src/pieces/commun.ts` : haut 10 %, bas 22 %, boutons à droite 14 % |
> | Regarder avant de rendre | `node remotion/images.mjs Chat --images …` (pendant une frappe, au milieu, à la fin) |
> | Rendre | `node remotion/rendre.mjs Chat rendu/final.mp4 --props "$(cat atelier/fil.json)"`, puis `derush-controle` |
>
> Les passages « Dans Dérush » sont des ajouts ; le reste est le texte de l'auteur.

## Garde-fous (Dans Dérush)

Une fausse conversation peut blesser ou tromper. Avant d'écrire le fil :

- **Fiction seulement.** Jamais le vrai nom, le numéro, la photo ou l'avatar d'une personne reconnaissable sans son
  accord ; jamais de vraie conversation recopiée sans l'accord des deux personnes.
- **Jamais présentée comme vraie.** Pas de « capture qui a fuité », pas de fausse preuve, pas de faux message prêté à
  une personne réelle, une marque ou une institution. Sur un sujet sensible (rixes, harcèlement, violences), le fil
  n'incite à rien, et la vidéo dit « fiction » ou « reconstitution » quand on pourrait la croire réelle.
- **Pas de marque.** On imite les codes d'une application (couleurs, côtés, accusés), jamais son logo ni ses sons
  système : les sons d'envoi et de réception d'Apple et de WhatsApp sont protégés.
- **Un public jeune** : relis le fil comme le lirait un parent ou un éducateur.

Turn a chat script into a scroll-stopping conversation video: bubbles appear one at a time, a typing indicator pulses before each reply, sounds pop on send, and the thread scrolls to keep the newest message in frame. This is one of the highest-retention faceless short-form formats — a story told in iMessage/WhatsApp/SMS bubbles that the viewer reads like they're peeking at someone's phone.

## When to use

- Chat-story videos for TikTok, Reels, and Shorts (9:16 vertical).
- Animating an iMessage, WhatsApp, or generic SMS conversation from a script.
- Reply/comment-reaction videos where a thread reveals a punchline message-by-message.
- Batch-producing many chat videos from one template + a messages array or CSV.

## Two non-negotiable rules

1. **One message reveals at a time, on a rhythm.** The retention comes from the drip: a beat of typing, then a bubble pops in, then a pause to read. Never dump the whole thread at frame 0 — pace it like a real conversation (a typing indicator before received replies, a short read-gap after each bubble).
2. **The chrome must read as the real app, instantly.** Sent = right, blue (iMessage) or green (SMS) / WhatsApp-green; received = left, gray. Tail on the last bubble of a run, correct header. If a viewer can't tell which app it is in the first half-second, the illusion breaks.

## The data model — script first, render second

Everything is one array of messages. Author the story as data; the renderer just plays it. This is what makes the format batchable: one template × N scripts → N videos.

```ts
type Message = {
  from: 'me' | 'them';        // me = sent (right/blue), them = received (left/gray)
  text: string;
  typingMs?: number;          // show typing indicator this long before the bubble (received only)
  delayMs?: number;           // read-gap AFTER the previous bubble, before this one
  status?: 'delivered' | 'read';  // receipt under the last sent bubble
  reaction?: '❤️' | '👍' | '👎' | '😂' | '‼️' | '❓'; // tapback, lands ~400ms after the bubble
  ts?: string;                // timestamp divider above this message, e.g. "Aujourd’hui 21:41"
};

const thread: Message[] = [
  {from: 'them', text: 't’es où ??', ts: 'Aujourd’hui 21:41'},
  {from: 'me', text: 'devant chez toi', status: 'read'},
  {from: 'them', text: '...', typingMs: 1400, reaction: '❓'},
];
```

Derive every frame from this array — see "Timing" below. Keep `text`/`from` as the only required fields so a CSV (`from,text,typingMs,delayMs,status`) maps straight in. The composition's props are `{app, contact, thread}`, `app` being `imessage`, `sms` or `whatsapp`.

## Bubble layout & alignment

A bubble is a max-width pill aligned to its side. Sent hugs the right rail; received hugs the left. Stack vertically in send order; the last bubble of a consecutive same-sender run gets the tail (decided frame by frame: the newest bubble of a run has it until the next one of the same sender lands).

Proportions at 1080 px wide, read from iOS (17 pt text, ~18 pt corners, ×2.77): text 48 px, corner radius 46 px, padding 18 × 30 px, max width 78% of the conversation band. The original's 34 px text and 22 px corners came out smaller and squarer than the real app, and small on a phone.

Palette cheat-sheet: iMessage dark: background `#000`, sent `#0A84FF`, received `#3B3B3D`, text `#fff`; iMessage light: background `#fff`, received `#E9E9EB` with text `#000`. SMS sent green `#37C24A`. WhatsApp sent `#005C4B`, received `#202C33` on a `#0B141A` chat wallpaper, with check-marks (gray = sent, blue `#53BDEB` = read). Match ONE app fully; don't mix iMessage chrome with WhatsApp ticks.

> Dans Dérush : la police est celle du téléphone, `-apple-system, system-ui` (SF sur un Mac). Les émojis s'affichent
> en Apple Color Emoji sur un Mac ; ailleurs, vérifie-les sur une image fixe.

## Staggered appear + typing indicator

Each bubble springs up from slightly below with a small scale pop, anchored to its own entrance frame. Received messages are preceded by a three-dot typing bubble that pulses, then is replaced by the real bubble. The dots breathe on a sine of the frame (no CSS animation). Only received messages type; sent messages just pop (you don't watch yourself type). Code: `Bubble` and `Typing` in `references/bubble-recipes.md`.

## Timing — turn the array into frames

Walk the messages, accumulating a cursor in ms, and compute every frame number ONCE. This is the single source of truth that the spring entrances, typing windows, sounds, and scroll all read from — the sound lands on the very frame the bubble does.

```ts
const readMs = (text: string) => Math.min(3000, Math.max(600, (text.length / 15) * 1000));   // ~15 characters a second

export function buildTimeline(thread: Message[], fps = FPS) {
  const f = (ms: number) => Math.round((ms / 1000) * fps);
  let cursor = 0;
  const timed = thread.map((m, i) => {
    // read-gap: time to read the previous bubble; the first bubble comes at once (the hook)
    cursor += m.delayMs ?? (i === 0 ? 0 : readMs(thread[i - 1].text));
    const typingLenMs = m.from === 'them' ? (m.typingMs ?? (i === 0 ? 400 : 800)) : 0;
    const typingFrame = f(cursor);
    cursor += typingLenMs;
    const enterFrame = f(cursor);
    cursor += 250;                                   // settle before the next read-gap
    return {...m, typingLenMs, typingFrame, enterFrame};
  });
  const last = thread[thread.length - 1];
  const durationInFrames = f(cursor + (last ? readMs(last.text) : 0) + 500);   // time to read the last one
  return {timed, durationInFrames};
}
```

Tune the feel: snappy/punchy threads use `delayMs` 300–500 and `typingMs` 500–900; suspenseful reveals stretch `typingMs` to 1500–2500 before the payoff line. Without `delayMs`, the read-gap follows the length of the previous message (a long message gets time to be read). Compute `durationInFrames` in `calculateMetadata` with the same `FPS` constant, so a longer script makes a longer video automatically.

> Dans Dérush : la première bulle est à l'écran en moins d'une demi-seconde (c'est l'accroche) ; si la conversation
> a besoin d'un contexte, mets plutôt un texte d'accroche au-dessus (compétence `viral-hooks`).

## Read receipts, timestamps & reactions

- **Receipt** ("Distribué" / "Lu") renders small and right-aligned under the last *sent* bubble only; fade it in ~300ms after the bubble lands, and it leaves when the next sent bubble lands. On WhatsApp this is the double-check turning blue instead. SMS has no read receipt.
- **Timestamp** ("Aujourd’hui 21:41", 24-hour clock) is a centered gray divider above the first message of a new time block — don't stamp every bubble.
- **Reaction / tapback** scales-in over the outer top corner of its target bubble (left for a sent bubble, right for a received one) ~400ms after the bubble appears, with a tiny overshoot. Anchor it to that bubble's entrance, not a global frame.

## Scrolling — keep the newest bubble in frame

The conversation runs in a clipped band between the header and the bottom zone, newest message at the bottom. Each new row (bubble, typing indicator, receipt) opens from 0 to its natural height with a spring, so the stack above glides up instead of jumping — no measurement needed (`Row` in the reference). The original's version was pseudo-code with undefined variables, and the function it named for measuring (`measureElement`) does not exist in `@remotion/layout-utils`.

## Sound-sync (pop per message)

A crisp pop on each send and a softer click on each receive is half of why this format feels real. Place one audio cue per message at that message's `enterFrame`, in the same timebase as the visuals:

```tsx
{timed.map((m, i) => (
  <Sequence key={`snd-${i}`} from={m.enterFrame} durationInFrames={Math.round(fps * 0.5)} layout="none">
    <Audio src={staticFile(m.from === 'me' ? 'sons/pop.wav' : 'sons/declic.wav')} volume={0.6} />
  </Sequence>
))}
```

Optionally add a quiet keyboard-tick bed under each typing window. Keep cues short (<300ms) so they don't pile up on fast threads. Never trigger sound off a timer — schedule it on the frame timeline so it survives headless render.

> Dans Dérush : `layout="none"` sur chaque `<Sequence>` qui ne doit pas couvrir l'image (par défaut, une Sequence
> s'étend sur tout le cadre). Le niveau des sons se règle à l'écoute, sous une éventuelle musique (`derush-son mixer`).

## Safe-area for 9:16 (1080×1920)

| Zone | Keep clear | Why |
|---|---|---|
| Top 10% (192 px) | the header starts below it | TikTok/Reels tabs and the creator's handle sit there |
| App header | ~150–190 px (avatar + name) | The contact header sells the app — keep it pinned and unobstructed |
| Bottom 22% (from 1498 px) | no bubble | The platform's caption, sound and progress UI |
| Right 14% (151 px) | sent bubbles stop before it | The like/comment/share buttons; sent bubbles hug the right rail |
| Left 5% | gutter | Bubbles never touch the screen edge |

Run the live conversation in the band between the header and the bottom zone; the newest bubble lands at the bottom of that band.

## Output checklist

- One messages array drives everything; timestamps derived, not hand-placed.
- One message at a time: read-gap → typing (received only) → pop, on a tuned rhythm; first bubble within 0.5s.
- Correct app chrome end-to-end (colors, tails, header, receipts) — no mixing apps, no logo, no system sounds.
- Sent right, received left; tail on the last visible bubble of each run.
- Receipt under the last sent bubble only; timestamp divider per time-block; tapbacks overshoot in on the right corner.
- The newest bubble stays in frame, clear of the platform zones.
- One pop/click per message, scheduled on the frame timeline (not timers).
- The guardrails above are met.

## Deliver & verify

> Dans Dérush, cette partie remplace celle de l'original (`npx remotion`, identifiant `TextThread` et propriété
> `threadSrc` que rien ne chargeait, scripts du dépôt, GIF de démonstration).

1. The composition `Chat` (props `{app, contact, thread}`) is declared in `remotion/src/Racine.tsx` with `calculateMetadata` from `buildTimeline`. Put the real thread in `defaultProps`, or pass it to the render with `--props`.
2. Freeze with `node remotion/images.mjs Chat --images …`: a frame during a typing window, a frame just after a bubble lands, a frame after the scroll has started, the last frame. Inspect the full-size images:
   - during typing the indicator (not the bubble) shows on the LEFT; the bubble pops only after;
   - each bubble on the correct side/color with the right tail; receipt/reaction/timestamp where expected, in French;
   - the newest bubble in frame, nothing under the header or in the platform zones.
3. `node remotion/rendre.mjs Chat rendu/final.mp4 --props "$(cat atelier/fil.json)"`, then `derush-controle rendu/final.mp4`, and listen to the sounds (Earshot if it is there).

## Reference files

- `references/bubble-recipes.md` — the complete, tested build: data, app chrome and palettes, the timeline, `Row` (scroll), `Bubble` + tail, typing indicator, receipts/timestamps/tapbacks, iMessage and WhatsApp headers, the full composition with `calculateMetadata`, and an example thread.
- `references/data-driven.md` — threads as JSON or CSV, the CSV → threads conversion (Python, nothing to install), data-dependent duration, and one video per thread with `rendre.mjs`.
