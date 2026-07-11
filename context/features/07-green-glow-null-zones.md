# Feature 07 — The Green Glow & Null Zones

> Status: **proposed / not started**
> Derives from: [`../goal.md`](../goal.md) §6.7 (Green Glow & Null Zones), §6.1
> (noclipping — thresholds/seams).
> This is a living feature doc; scope may shift as [`../goal.md`](../goal.md) evolves.

## 1. Purpose

Break the endless yellow monotony with rare, unsettling landmarks: the **Green
Glow** marking **Null Zones** — unstable spots where the world is thin and a
portal could form. These give the space orientation points, a jolt of wrong
color against the sickly yellow, and — later — natural anchors for spawns,
exits, and the seams where one player's leaked world meets another's.

## 2. Scope (in)

- **Green Glow zones** — seeded, rare regions where a sickly gamma-green light
  bleeds in: green-tinted fog, an emissive source, faint radiation-flicker.
- **Null Zone visuals** — geometry near a Null Zone destabilizes: a shimmering
  "thin" seam or portal-like distortion in the air, air haze, warped wallpaper.
- **Landmark behavior** — glow is visible from a distance through the fog so it
  reads as a waypoint, pulling the player toward it.
- **Audio hook** — a distinct tone/hum shift when near a Null Zone (drives the
  Feature 03 reactive bus).

## 3. Scope (out — deferred)

- Actual traversal/teleport through a portal (needs the zone/threshold graph
  and likely multiplayer).
- Using Null Zones as real spawn/exit points — that lands with the shared-world
  feature; this feature ships the *look and placement* only.

## 4. Acceptance criteria

1. Green Glow zones appear rarely, at seeded locations stable across reloads.
2. Approaching one shows green fog/light and a destabilized "thin" seam effect.
3. The glow is discernible from a distance as a landmark through the fog.
4. Performance holds — glow zones are localized effects, not a global change.

## 5. Open questions

- Placement density and whether Null Zones should preferentially sit at chunk
  seams / heavily-leaked boundaries.
- How strong the green is before it stops reading as "wrong yellow-world" and
  starts looking like a different game.
