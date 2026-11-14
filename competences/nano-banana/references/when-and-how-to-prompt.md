# When & How to Prompt Nano Banana

When to reach for Nano Banana, where its edges are, and the prompt anatomy that gets studio-quality
results. (How to call the model is in `OUTILS.md` — this is prompt craft.)

> Fast-moving model area — re-verify model names/capabilities quarterly. As of 2026: **Nano Banana
> Pro = Gemini 3 Pro Image** (`gemini-3-pro-image`, highest quality); **Nano Banana 2 = Gemini Flash
> Image** (`gemini-3.1-flash-image`, faster, cheaper). Use Pro for text-heavy/complex work and for a
> consistent set, Flash for the rest.

## Reach for Nano Banana when the job is…

Its genuine strengths:

- **Legible in-image TEXT** — correctly rendered, readable text in an image (short tagline → full
  paragraph, multiple languages, varied fonts). The killer use for social graphics.
- **Multi-image / character / brand CONSISTENCY** — keep the same character, product, or style across
  a set, using up to 10 reference images. The killer use for carousels and series.
- **Conversational EDITING** — natural-language edits to an existing image ("make it night," "remove
  the background"), with lighting/reflections adjusted automatically; localize/translate text in-image.
- **INFOGRAPHICS / factual scenes** — real-world knowledge for diagrams, recipes, accurate scenes.
  (Verify the facts — see caveats.)
- **Speed + many aspect ratios + up to 4K** — covers every social format.

## Where it is weaker

Be honest about the tool's edges (match the job, don't default):

- **Photoreal human portraits / luxury product realism** → skin and material detail can fall short of
  what the job needs.
- **Surreal / fine-art / highly stylized aesthetics** → less artistic range.
- **Pure typography-led layouts** → for a layout that is mostly type, set the type yourself (in
  Remotion) on a generated background.

## The prompt anatomy (natural language, not keyword spam)

Modern Gemini image models **reason over natural language** — drop the 2023-era "4k, masterpiece,
trending on artstation, ultra-detailed" token spam. Be **descriptive and specific** instead. Include:

- **Subject** — who/what, specifically ("a matte-black ceramic coffee mug," not "a mug").
- **Composition / camera** — framing, angle, distance ("close-up product shot, slight top-down").
- **Action / context** — what's happening / where ("resting on a wet city street at night").
- **Lighting / atmosphere** — ("soft radiant studio light"; "harsh directional chiaroscuro").
- **Style / medium** — ("clean vector art, pastel palette"; "commercial product photography").
- **Constraints / exact text** — aspect ratio, what to include/avoid, and any **text in quotes** (see
  `text-and-consistency.md`).

A workable shape: *"[Subject + adjectives] [action] in [context]. [Composition]. [Lighting]. [Style].
[Exact text + constraints]."*

## One careful generation, then refine

- **Think first, generate once.** Each generation costs credits: write the full prompt, generate at
  the resolution the image needs, look at the result, and only regenerate when it missed.
- **Refine conversationally** — adjust one thing at a time ("keep everything, make the background
  warmer") rather than rewriting the whole prompt. (In Dérush: send the image back in `images` with
  that instruction as the prompt.)
- **Set the aspect ratio for the platform** up front (see `social-recipes.md`).

## Brand-grounded

Read `brand-profile.md` and bake the brand into the prompt — **brand colours, visual style, do/don't**
— so the output looks like the brand, not generic stock. The image is the brand speaking visually.
