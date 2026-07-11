# Feature 05 — Fluorescent Lighting Overhaul

> Status: **proposed / not started**
> Derives from: [`../goal.md`](../goal.md) §4 (fluorescent lighting with a
> subtle flicker/buzz).
> This is a living feature doc; scope may shift as [`../goal.md`](../goal.md) evolves.

## 1. Purpose

Deepen the single most iconic Backrooms element: the buzzing fluorescent
lights. Feature 01 has one global flicker driving every panel identically. This
feature makes the lighting feel like a real, failing electrical system —
per-panel behavior, dead and dying tubes, and occasional blackouts — which is a
huge amount of atmosphere for relatively little code.

## 2. Scope (in)

- **Per-panel flicker** — each ceiling panel flickers on its own seeded phase
  instead of all in unison, so the ceiling shimmers unevenly.
- **Dead & dying panels** — a fraction of panels are fully dark or strobe
  erratically (buzzing on the edge of failure), seeded deterministically per cell.
- **Occasional blackout / relight** — rare moments where a whole area cuts to
  near-dark then stutters back, tied to the audio hum dropping out with it.
- **Warm-up flicker** — panels entering view can "start up" with a couple of
  stutters before settling.
- **Audio coupling** — per-panel and blackout events feed the buzz layer in
  Feature 03 so light and sound fail together.

## 3. Scope (out — deferred)

- Physically-based light bounce / global illumination — stay with emissive
  panels + the player-follow light established in Feature 01.
- Player-controllable lights / switches.

## 4. Acceptance criteria

1. Panels visibly flicker out of sync with each other.
2. Some panels are dead or violently strobing; their placement is stable across
   reloads (seeded), not random each frame.
3. A blackout/relight event occurs and reads as an electrical failure, not a bug.
4. Frame rate is unaffected — flicker is shader/uniform-driven, not new lights
   per panel.

## 5. Open questions

- Blackout frequency — rare landmark event, or a recurring dread beat?
- Should dead-panel density increase in older / more heavily-leaked zones
  (ties into Feature 02 and Feature 08)?
