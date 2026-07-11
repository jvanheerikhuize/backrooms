# Feature 04 — Found-Footage Camera Layer

> Status: **proposed / not started**
> Derives from: [`../goal.md`](../goal.md) §4 (grainy/VHS treatment), §6.9
> (analog / found-footage presentation).
> This is a living feature doc; scope may shift as [`../goal.md`](../goal.md) evolves.

## 1. Purpose

Reframe the first-person view as a **handheld camera feed**, not a clean game
camera. Feature 01 shipped grain + vignette + scanlines; this feature commits
to the analog-horror conceit that defines the *Backrooms (Found Footage)*
series — the view is degraded VHS footage someone is recording as they wander.

## 2. Scope (in)

- **HUD overlay** — a timestamp/date counter, a blinking `REC ●` indicator, and
  a low-battery / tracking marker, drawn in the corner like a camcorder.
- **Handheld sway & bob** — subtle idle camera drift plus a walk bob, so the
  view feels held by a person, not on rails (also a Feature 01 stretch goal).
- **Tracking distortion** — occasional VHS tracking-error bands, horizontal
  roll, and brief signal dropouts layered into the post pass.
- **Chromatic aberration & bloom** — slight RGB split toward the edges and a
  soft bloom on the fluorescent panels to sell the cheap-lens/overexposed look.
- **Intensity coupling** — expose a `distortion(amount)` control so later
  systems (the leak, entity proximity) can crank the degradation as the world
  gets weirder.

## 3. Scope (out — deferred)

- Actual video recording / export of the feed.
- Driving the distortion from real leak/entity state — this feature ships the
  control and a manual/test driver; wiring it to Feature 02/entities is a follow-up.

## 4. Acceptance criteria

1. The view shows a persistent camcorder HUD (timestamp + blinking REC).
2. Moving produces a believable handheld bob; standing still shows gentle drift.
3. Occasional tracking bands / roll / chromatic aberration are visible without
   making the game unplayable.
4. A test control visibly ramps overall distortion from calm to heavy.

## 5. Open questions

- How aggressive should tracking glitches be by default (readability vs. dread)?
- Should the timestamp be real wall-clock, a frozen "found" date, or count from
  session start? (Leaning a fixed uncanny date.)
- Motion-sickness guard: cap bob amplitude, offer a "reduce camera motion" toggle?
