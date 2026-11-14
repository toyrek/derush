# Bubble Recipes — Chat Video Build Kit

A complete, copy-ready path from a messages array to an animated chat video: app chrome and palettes, the data-model → frame-timeline, spring bubbles with tails, the typing indicator, receipts/timestamps/tapbacks, scrolling, per-message sound, and the full Remotion composition with data-driven duration.

> **Dans Dérush.** Les blocs ci-dessous forment un seul fichier, `remotion/src/chat.tsx`, dans cet ordre. Ils ont été
> rendus image par image en iMessage, SMS et WhatsApp, puis en vidéos depuis un tableau. Ce qui a changé par rapport à
> l'original est dit dans `../SOURCE.md` ; les principaux : chaque `<Sequence>` empilait ses bulles en haut du cadre
> (`layout` par défaut), le défilement n'était pas écrit, la queue, l'accusé et la réaction n'étaient pas branchés, les
> proportions étaient trop petites pour l'application réelle, les zones des réseaux oubliaient la colonne de boutons.

## 1. The one data shape

Everything normalizes to a flat array of messages. Author the story as data; the renderer just plays it.

```tsx
import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

// ---------- 1. data
export type Sender = 'me' | 'them';               // me = sent (right), them = received (left)
export type Reaction = '❤️' | '👍' | '👎' | '😂' | '‼️' | '❓';
export type Message = {
  from: Sender;
  text: string;
  typingMs?: number;          // typing indicator shown this long before the bubble (received only)
  delayMs?: number;           // read-gap AFTER the previous bubble, before this one
  status?: 'delivered' | 'read';   // receipt under the last sent bubble
  reaction?: Reaction;        // tapback over the bubble's corner, ~400 ms after it lands
  ts?: string;                // optional timestamp divider, e.g. "Aujourd’hui 21:41"
};
export type App = 'imessage' | 'whatsapp' | 'sms';
export type ChatProps = {app: App; contact: string; thread: Message[]};
export type Timed = Message & {typingFrame: number; enterFrame: number; typingLenMs: number};

export const FPS = 30;   // one constant for the composition AND calculateMetadata
```

## 2. App chrome & palettes — pick ONE app, fully

The half-second "which app is this" read is what sells the format. Match one app's colors, bubble shape, tail, and receipts end-to-end. Do not mix iMessage bubbles with WhatsApp ticks.

| App | Sent bubble | Received bubble | Background | Receipt |
|---|---|---|---|---|
| iMessage (dark) | `#0A84FF` text `#fff` | `#3B3B3D` text `#fff` | `#000` | "Distribué" / "Lu" gray text under last sent |
| iMessage (light) | `#0A84FF` text `#fff` | `#E9E9EB` text `#000` | `#fff` | same |
| SMS (green) | `#37C24A` text `#fff` | `#3B3B3D` (dark) / `#E9E9EB` (light) | `#000` / `#fff` | "Distribué" only |
| WhatsApp (dark) | `#005C4B` text `#E9EDEF` | `#202C33` text `#E9EDEF` | `#0B141A` wallpaper | double-check: gray sent → blue `#53BDEB` read |

The themes below are the dark ones; for a light iMessage, add a theme with the light values.

```tsx
// ---------- 2. app chrome — ONE app, fully
const THEMES = {
  imessage: {bg: '#000', sent: '#0A84FF', sentInk: '#fff', recv: '#3B3B3D', recvInk: '#fff', meta: '#8e8e93', header: 'rgba(28,28,30,.96)'},
  sms:      {bg: '#000', sent: '#37C24A', sentInk: '#fff', recv: '#3B3B3D', recvInk: '#fff', meta: '#8e8e93', header: 'rgba(28,28,30,.96)'},
  whatsapp: {bg: '#0B141A', sent: '#005C4B', sentInk: '#E9EDEF', recv: '#202C33', recvInk: '#E9EDEF', meta: '#8696A0', header: '#202C33'},
};
const FONT = '-apple-system, system-ui, "Helvetica Neue", Arial, sans-serif';   // SF on a Mac
const SIZE = 48;            // ≈ iOS 17 pt body at 1080 px wide
const RADIUS = 46;          // ≈ iOS 18 pt corner
```

## 3. Message array → frame timeline

```tsx
// ---------- 3. timeline: the array → frames, computed once (bubbles, sounds and scroll all read these numbers)
const readMs = (text: string) => Math.min(3000, Math.max(600, (text.length / 15) * 1000));   // ~15 characters a second

export function buildTimeline(thread: Message[], fps = FPS) {
  const f = (ms: number) => Math.round((ms / 1000) * fps);
  let cursor = 0;
  const timed: Timed[] = thread.map((m, i) => {
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

Feel tuning: snappy threads use `delayMs` 300–500 and `typingMs` 500–900; suspenseful reveals stretch `typingMs` to 1500–2500 before the payoff line.

## 4. Scrolling, bubbles, typing indicator

```tsx
// ---------- 4. pieces
// A row that opens from 0 to its natural height (and closes at `to`): the stack above glides up instead of jumping.
// grid-template-rows 0fr → 1fr reaches "auto" height without measuring anything; driven by the frame.
const Row: React.FC<{from: number; to?: number; children: React.ReactNode}> = ({from, to, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < from || (to !== undefined && frame >= to + 8)) return null;
  const open = spring({frame: frame - from, fps, config: {damping: 200}, durationInFrames: 8});
  const close = to === undefined ? 0 : spring({frame: frame - to, fps, config: {damping: 200}, durationInFrames: 8});
  const rows = open * (1 - close);
  return (
    <div style={{display: 'grid', gridTemplateRows: `${rows}fr`, flexShrink: 0}}>
      <div style={{minHeight: 0, overflow: rows < 1 ? 'hidden' : 'visible', display: 'flex', flexDirection: 'column'}}>{children}</div>
    </div>
  );
};

const Bubble: React.FC<{app: App; enterFrame: number; sent: boolean; tail: boolean; first: boolean; reaction?: string; children: React.ReactNode}> =
({app, enterFrame, sent, tail, first, reaction, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const th = THEMES[app];
  const p = spring({frame: frame - enterFrame, fps, config: {damping: 14, mass: 0.7}});
  const r = app === 'whatsapp' ? 22 : RADIUS;
  return (
    <div style={{
      position: 'relative', alignSelf: sent ? 'flex-end' : 'flex-start', maxWidth: '78%', marginTop: first ? 18 : 5,   // runs breathe apart, bubbles of one run sit close
      padding: '18px 30px', borderRadius: r, fontSize: SIZE, lineHeight: 1.22, wordBreak: 'break-word',
      background: sent ? th.sent : th.recv, color: sent ? th.sentInk : th.recvInk,
      // tail: pinch the bottom corner on the sender's side, only on the last bubble of a run.
      // Always give both values: a corner set to undefined is erased by React (it would turn square).
      borderBottomRightRadius: sent && tail ? 10 : r,
      borderBottomLeftRadius: !sent && tail ? 10 : r,
      transform: `translateY(${interpolate(p, [0, 1], [24, 0])}px) scale(${interpolate(p, [0, 1], [0.85, 1])})`,
      opacity: interpolate(p, [0, 1], [0, 1], {extrapolateRight: 'clamp'}),
      transformOrigin: sent ? 'bottom right' : 'bottom left',
    }}>
      {children}
      {reaction && <Tapback reaction={reaction} sent={sent} enterFrame={enterFrame} />}
    </div>
  );
};

// three dots breathing on a sine of the frame (no CSS animation)
const Typing: React.FC<{app: App}> = ({app}) => {
  const frame = useCurrentFrame();
  const dot = (i: number) => 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame / 4 - i * 0.9));
  return (
    <div style={{alignSelf: 'flex-start', marginTop: 10, display: 'flex', gap: 12, padding: '30px 34px',
      borderRadius: RADIUS, borderBottomLeftRadius: 10, background: THEMES[app].recv}}>
      {[0, 1, 2].map((i) => <span key={i} style={{width: 18, height: 18, borderRadius: 9, background: '#9a9a9f', opacity: dot(i)}} />)}
    </div>
  );
};
```

## 5. Read receipts, timestamps, tapbacks

```tsx
// receipt under the LAST sent bubble only, ~300 ms after it lands (WhatsApp: ticks, blue when read; SMS: never "read")
const Receipt: React.FC<{app: App; status: 'delivered' | 'read'; enterFrame: number}> = ({app, status, enterFrame}) => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig();
  const o = interpolate(frame - enterFrame, [fps * 0.3, fps * 0.5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const label = app === 'whatsapp' ? '✓✓' : status === 'read' && app === 'imessage' ? 'Lu' : 'Distribué';
  const color = app === 'whatsapp' && status === 'read' ? '#53BDEB' : THEMES[app].meta;
  return <div style={{alignSelf: 'flex-end', fontSize: 28, fontWeight: 600, color, marginTop: 6, marginRight: 8, opacity: o}}>{label}</div>;
};

// tapback: over the bubble's outer top corner (left for a sent bubble, right for a received one), with overshoot
const Tapback: React.FC<{reaction: string; sent: boolean; enterFrame: number}> = ({reaction, sent, enterFrame}) => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig();
  const p = spring({frame: frame - (enterFrame + Math.round(fps * 0.4)), fps, config: {damping: 9, mass: 0.5}});
  return <span style={{position: 'absolute', top: -30, [sent ? 'left' : 'right']: -22, fontSize: 44, transform: `scale(${p})`}}>{reaction}</span>;
};

// timestamp divider, above the first message of a time block (not every bubble)
const Stamp: React.FC<{app: App; label: string}> = ({app, label}) =>
  <div style={{alignSelf: 'center', color: THEMES[app].meta, fontSize: 28, fontWeight: 600, margin: '22px 0 8px'}}>{label}</div>;
```

## 6. Header

Header bar (sells the app), pinned under the platform's top zone, never scrolled: iMessage = avatar + name centred; WhatsApp = back chevron, avatar, name and "en ligne" / "écrit…" while the other person types. The avatar is an initial on a gray disc: never the photo of a real person without their consent.

```tsx
// header: iMessage = avatar + name centred; WhatsApp = avatar left, name and "en ligne" / "écrit…"
const Header: React.FC<{app: App; name: string; typing: boolean; top: number}> = ({app, name, typing, top}) => {
  const th = THEMES[app];
  const avatar = <div style={{width: 96, height: 96, borderRadius: 48, background: '#6b6b70', color: '#fff', fontSize: 44, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{name.slice(0, 1).toUpperCase()}</div>;
  if (app === 'whatsapp') {
    return (
      <div style={{position: 'absolute', top, left: 0, right: 0, height: 150, background: th.header,
        display: 'flex', alignItems: 'center', gap: 26, padding: '0 40px'}}>
        <span style={{color: th.recvInk, fontSize: 56}}>‹</span>{avatar}
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <span style={{color: th.recvInk, fontSize: 40, fontWeight: 600}}>{name}</span>
          <span style={{color: typing ? '#25D366' : th.meta, fontSize: 28}}>{typing ? 'écrit…' : 'en ligne'}</span>
        </div>
      </div>
    );
  }
  return (
    <div style={{position: 'absolute', top, left: 0, right: 0, height: 190, background: th.header,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10}}>
      {avatar}
      <div style={{color: '#fff', fontSize: 30, fontWeight: 500}}>{name} ›</div>
    </div>
  );
};
```

## 7. The full composition (data-driven duration)

The conversation band is clipped (`overflow: hidden`) and sits between the header and the platform's bottom zone, its newest row at the bottom; the header is drawn after it, so it stays on top.

```tsx
// ---------- 5. the composition
export const Chat: React.FC<ChatProps> = ({app = 'imessage', thread, contact}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const {timed} = buildTimeline(thread, fps);
  const th = THEMES[app];
  // safe zones of TikTok / Reels / Shorts (the kit's ZONE_SURE): top 10 %, bottom 22 %, buttons on the right 14 %
  const top = Math.round(height * 0.1), bottom = Math.round(height * 0.22);
  const headerH = app === 'whatsapp' ? 150 : 190;
  const typingNow = timed.some((m) => m.typingLenMs > 0 && frame >= m.typingFrame && frame < m.enterFrame);
  return (
    <AbsoluteFill style={{background: th.bg, fontFamily: FONT}}>
      {/* the conversation band, between the header and the platform's bottom zone: clipped, newest at the bottom */}
      <div style={{position: 'absolute', top: top + headerH + 10, bottom, left: Math.round(width * 0.05), right: Math.round(width * 0.14),
        overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'}}>
        {timed.map((m, i) => {
          const sent = m.from === 'me';
          const next = timed[i + 1];
          const first = i === 0 || timed[i - 1].from !== m.from;
          // decided per frame: the tail goes to the last bubble of a run that is ON SCREEN
          const tail = !next || next.from !== m.from || frame < next.enterFrame;
          // the receipt stays under the last sent bubble only: it leaves when the next sent bubble lands
          const nextSent = timed.slice(i + 1).find((x) => x.from === 'me');
          return (
            <React.Fragment key={i}>
              {m.ts && <Row from={m.typingFrame}><Stamp app={app} label={m.ts} /></Row>}
              {m.typingLenMs > 0 && <Row from={m.typingFrame} to={m.enterFrame}><Typing app={app} /></Row>}
              <Row from={m.enterFrame}>
                <Bubble app={app} enterFrame={m.enterFrame} sent={sent} tail={tail} first={first} reaction={m.reaction}>{m.text}</Bubble>
              </Row>
              {sent && m.status && <Row from={m.enterFrame} to={nextSent?.enterFrame}><Receipt app={app} status={m.status} enterFrame={m.enterFrame} /></Row>}
            </React.Fragment>
          );
        })}
      </div>
      <Header app={app} name={contact} typing={typingNow} top={top} />
      {/* one sound per message, on the bubble's own frame (sounds of the kit: remotion/public/sons/) */}
      {timed.map((m, i) => (
        <Sequence key={`snd-${i}`} from={m.enterFrame} durationInFrames={Math.round(fps * 0.5)} layout="none">
          <Audio src={staticFile(m.from === 'me' ? 'sons/pop.wav' : 'sons/declic.wav')} volume={0.6} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
```

## 8. Example thread and registration

```tsx
export const THREAD: ChatProps = {app: 'imessage', contact: 'Inès', thread: [
  {from: 'them', text: 't’es où ??', ts: 'Aujourd’hui 21:41'},
  {from: 'me', text: 'devant chez toi', status: 'read'},
  {from: 'them', text: '...', typingMs: 1400, reaction: '❓'},
  {from: 'them', text: 'il est presque 22 h, mes parents sont là', typingMs: 1600},
  {from: 'me', text: 'j’ai ramené ce que tu m’avais demandé', reaction: '❤️'},
  {from: 'me', text: 'descends', delayMs: 300, status: 'delivered'},
  {from: 'them', text: 'ok', typingMs: 500},
  {from: 'them', text: 'j’arrive', typingMs: 900},
  {from: 'me', text: 'vite', status: 'read'},
  {from: 'them', text: 'c’est quoi ce sac ??', typingMs: 2200},
]};
// in Racine.tsx:
// <Composition id="Chat" component={Chat} width={1080} height={1920} fps={FPS} durationInFrames={300} defaultProps={THREAD}
//   calculateMetadata={({props}) => ({durationInFrames: buildTimeline(props.thread, FPS).durationInFrames})} />
export const THREAD_WA: ChatProps = {...THREAD, app: 'whatsapp'};
export const THREAD_SMS: ChatProps = {...THREAD, app: 'sms'};
```

`calculateMetadata` makes a longer script render a longer video automatically — never hand-set the duration.

## 9. Render

```bash
node remotion/images.mjs Chat --images 6,40,120,300      # stills first (pick frames from buildTimeline)
node remotion/rendre.mjs Chat rendu/final.mp4 --props "$(cat atelier/fil.json)"
```

`atelier/fil.json` holds `{"app": "…", "contact": "…", "thread": [ … ]}`: give all three, or the missing ones fall back to the example of `defaultProps`. For many videos from one template, see `data-driven.md`.
