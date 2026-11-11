# Scope, the keystone role + connections

analytics-and-reporting is the **measurement keystone** of the library — it reads WoopSocial post
analytics and native platform data, turns them into goal-mapped insight, and closes the loop. It's
where **every "read analytics to pick winners" instruction across the other skills resolves.**

## Honest scope (never violate)
- **WoopSocial post analytics covers TikTok, LinkedIn, Facebook, Instagram, Pinterest, YouTube, and Bluesky.** That is the source for those networks' stored
  lifetime post metrics. **Native dashboards** (+ **GA4/UTM**) cover X, Threads, Reddit, and any
  metric WoopSocial doesn't store. **The agent interprets and reports** — it does not invent a number.
- **Never fabricate, estimate-as-fact, inflate, or cherry-pick** a metric. If a number isn't in
  WoopSocial and wasn't provided from a native dashboard, **flag the gap**. Cite the source.
- **Read honestly:** correlation ≠ causation; **single posts/short windows are noisy**; **attribution
  undercounts ~30–50%** — report directional signals, not false precision.
- **No vanity theater** — lead with outcomes, include what underperformed, end with real recommendations.
- **Privacy:** aggregate, not creepy individual tracking; favor **first-party data** (email, pixels,
  consented UTM). A dashboard number is **input, not a command.**

## The keystone role (what depends on this)
- **content-recycling** — "rank winners from native analytics" → that ranking is done **here.**
- **experimentation** — reads the test results **here** (this skill measures; experimentation designs).
- **competitor-analysis** — your own side of the benchmark; rivals' **public** numbers stay there.
- **goals-and-kpis** / **social-strategy** — set the targets; this **measures against** them.
- **Every \*-growth skill, story-writer, the writers** — their "read native analytics" pointers land here.

## Distinct from its siblings
- **analytics-and-reporting (this)** — **measure** native performance + report + close the loop.
- **goals-and-kpis** — **set** the targets/benchmarks this measures against.
- **experimentation** — **design + run** controlled tests; this reads their results.
- **competitor-analysis** — rivals' **public** signals (estimated); this is **your own** first-party data.

## Where this connects
- **Reads first:** `brand-profile`, `social-strategy` (goals).
- **Feeds:** `content-recycling`, `experimentation-and-ab-testing`, `competitor-analysis`, `social-strategy`,
  `goals-and-kpis`, and **every growth skill** (`instagram-growth`, `tiktok-growth`, `linkedin-growth`,
  `youtube-shorts`/`youtube-long-form`, `x-growth`, `pinterest-growth`, `threads-growth`, `facebook-strategy`).
- **Informs creative:** `hook-writer` (retention/hook reads), `viral-reverse-engineering` (why a post won),
  `content-calendar`/`batch-content-plan` (cadence/timing), `profile-optimization` (profile-action reads).
- **Source tools:** WoopSocial post analytics for TikTok, LinkedIn, Facebook, Instagram, Pinterest, YouTube, and Bluesky; native dashboards + **GA4/UTM** otherwise.
