---
name: world-leak-system
description: Use when implementing the core "leak" mechanic — player/NPC input altering a section, proximity-based reflection of others' choices, and the "accurate but slightly off" distortion of the base yellow into a Backrooms interpretation.
---

# World Leak System

Implement the game's central mechanic from `SPECIFICATION.md` §5.2–5.6 and §6.2.

## Player influence
- A player's input (§5.3) writes an **alteration record** onto the section they
  occupy: a compact, serializable description of their influence (palette shift,
  geometry warp, props, textures, tendrils), NOT raw geometry.
- Alterations are localized to a section, layered over the deterministic base
  from `procedural-backrooms-generation`.

## Proximity reflection
- The area reflects the nearest player/NPC's alterations (§5.4). Use the
  proximity signal from `first-person-navigation`.
- Blend by distance: drive a `--leak` value (0 far → 1 at the presence) and
  crossfade base ↔ leaked skin. Define a rule for overlapping presences
  (e.g. weighted by inverse distance; strongest wins for conflicting features).

## "Accurate but slightly off"
- Reflections must be faithful in essence yet usually distorted (§5.2). When
  applying another presence's alteration, pass it through a deterministic
  **distortion function** (jitter colors, offset/duplicate features, corrupt a
  fraction of details) seeded by section + presence so it's stable but wrong.
- Never reproduce a source verbatim — it's a Backrooms *interpretation* (§6.2).

## Base vs leaked
- Fresh corners and un-visited sections stay pure yellow (leak = 0).
- Oldest/most-altered sections trend toward heavy corruption (`the Growth`, §6.6).

## Interface
- `applyLeak(baseSection, alterations, leakLevel) -> renderedSection` used by the
  client each frame; alterations come from the server (`realtime-shared-world`).
- Keep alteration records small — they are the unit synced over the network.

## Rules
- Distortion deterministic given the same inputs (server/clients must agree).
- Vanilla JS shared module.
