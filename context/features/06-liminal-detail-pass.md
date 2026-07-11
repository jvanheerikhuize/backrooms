# Feature 06 — Liminal Environmental Detail Pass

> Status: **proposed / not started**
> Derives from: [`../goal.md`](../goal.md) §4 (damp carpet, oppressive
> emptiness, liminal mood).
> This is a living feature doc; scope may shift as [`../goal.md`](../goal.md) evolves.

## 1. Purpose

Sell the *liminality*. Feature 01 established clean yellow rooms; real Backrooms
imagery is unsettling because of small wrong details — moisture, wear, and the
occasional out-of-place object in an otherwise featureless void. This pass adds
sparse, seeded environmental detail that makes the space feel used, damp, and
faintly wrong without breaking the emptiness.

## 2. Scope (in)

- **Damp & stains** — seeded water stains on wallpaper and ceiling, darker
  damp patches bleeding across the carpet, subtle wet-sheen reflection on floor.
- **Wear & seams** — mismatched wallpaper seams, scuffs, baseboards, the odd
  exposed pipe or vent, so repetition feels imperfect rather than tiled.
- **Sparse anomalous props** — very occasionally a single out-of-place object
  in a room (a lone folding chair, a cardboard box, a puddle), seeded so it is
  rare and memorable, never cluttered.
- **Dust motes** — faint particles drifting in the fluorescent light to give
  the air volume.

## 3. Scope (out — deferred)

- Interactable objects / pickups — this is set dressing only.
- Anything narrative (notes, cameras, Async Research Institute props) — that is
  its own later feature.

## 4. Acceptance criteria

1. Rooms show seeded stains/wear that differ between sections yet stay stable
   across reloads.
2. Anomalous props appear rarely and read as uncanny, not as game pickups.
3. Dust motes are visible in the light without tanking performance.
4. The emptiness/oppression is preserved — detail is sparse, not busy.

## 5. Open questions

- Prop density — how rare is "rare"? (Leaning: most rooms have none.)
- Do detail placements share the world seed so they are consistent for all
  players once multiplayer lands? (Leaning yes.)
