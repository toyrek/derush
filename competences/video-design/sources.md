# Design sources

**Plug in your own design skill, or use ours.** A design source is any skill, guide or person that decides
how something should look: the palette, the type, the idea. This skill depends on none of them. Its own
source, **ours**, is `video-design` itself (the act palettes in `palettes.md` with the project's brand), and
any design skill that is already installed can take its place, because everything goes through the handoff (`design.md`).

## Choosing one for a project

1. If `design.md` already exists, its `Source:` line names the source: keep it.
2. Otherwise use **ours** (nothing to install), unless the user names a design skill or a guide that is
   already there. Never install one yourself.

   Don't treat every skill whose description mentions design or brand as a design source. That sweeps in
   skills that aren't design sources, such as a brand-guidelines skill that applies another company's colours.
3. Record the choice on the `Source:` line of `design.md`.

Whatever the source, its output goes into `design.md` (`handoff.md`) before anything is built, and the
rules in `SKILL.md` still apply on top. When a source contradicts one (a gradient, a glow, a third
field colour), the video rule wins unless the brand requires it; write the exception under "Rules
turned off".

## Bringing your own

Any skill works if it can tell `video-design` five things, which is what `design.md` asks for: the
grounds (one per act, two or three), the ink on each, the one accent, the type family and weights, and
the rules it wants off. It doesn't need to know about Remotion, frames or narration.

## Credit

Parts of `video-design` are adapted from taste-skill (https://github.com/Leonxlnx/taste-skill),
Copyright (c) 2026 Leonxlnx, MIT License: the colour-fields-as-chapters idea, lightness between
neighbouring fields, the one-accent rule, the two-line headline and five-size limits, and the critique's
weighted score and caps. The palettes in `palettes.md` marked "taste" are from its library. The rest is
the Digital Samba toolkit's own, from making these videos.
