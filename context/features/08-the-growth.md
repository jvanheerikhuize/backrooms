# Feature 08 — The Growth (corruption state)

> Status: **proposed / not started**
> Derives from: [`../goal.md`](../goal.md) §6.6 (the Growth), §6.3 (room
> duplication / decay of old zones).
> Depends on: Feature 02 (leak/influence) for a notion of zone age/heaviness.
> This is a living feature doc; scope may shift as [`../goal.md`](../goal.md) evolves.

## 1. Purpose

Give the world a terminal corruption state. In the lore, entities nest in **the
Growth** — masses of organic tendrils overtaking rooms. As a visual, it is the
end point of a section's decay: the most heavily-leaked or oldest zones get
consumed by tendrils creeping across the wallpaper, floor, and ceiling. It
turns the leak from "recolored" into "infested," and marks the oldest, most
dangerous-feeling parts of the map.

## 2. Scope (in)

- **Tendril overgrowth** — procedural organic tendrils spreading from corners
  and seams across surfaces, driven by a corruption amount per section.
- **Corruption coupling** — corruption rises with a section's leak influence /
  age (from Feature 02), so the Growth appears where the world has been most
  altered, not randomly.
- **Material takeover** — as corruption climbs, wallpaper darkens, dampens, and
  is progressively hidden under the Growth; carpet gets overgrown patches.
- **Audio hook** — a wetter, closer, more organic layer near heavy Growth
  (Feature 03 reactive bus), foreshadowing entities.

## 3. Scope (out — deferred)

- Entities / the Lifeform themselves and any combat or threat behavior — the
  Growth here is environmental only; entities are a separate later feature.
- Growth spreading in real time across the network — v1 is a render of the
  current corruption value, not a simulation synced between players.

## 4. Acceptance criteria

1. Heavily-leaked / old sections show tendril overgrowth; fresh yellow sections
   show none.
2. Corruption reads as a gradient (light infestation → consumed room), not a
   binary on/off.
3. The effect is localized and performant (instanced/shader-driven), not a
   global mesh explosion.

## 5. Open questions

- What exactly maps to corruption — cumulative influence, wall-clock age, or a
  dedicated decay timer per section?
- Should the Growth ever recede, or is it permanent once it takes hold?
- Can players be slowed/impeded by dense Growth, or is it purely visual for now?
