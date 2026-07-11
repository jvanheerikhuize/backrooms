---
name: first-person-navigation
description: Use when implementing the player's first-person view and movement through the Backrooms — pointer lock, WASD+mouse look, collision with room/hallway geometry, and the camera-feed framing. Vanilla JS.
---

# First-Person Navigation

Implement the fixed first-person perspective from `SPECIFICATION.md` §5.1 in
vanilla JS.

## Rendering approach
- Prefer WebGL via the raw API or a tiny hand-rolled renderer; if scope allows,
  a grid-based raycaster (Wolfenstein-style) is a legitimate vanilla option that
  suits the repetitive corridor layout well. Pick one and keep it dependency-free.
- The view is framed as a **handheld camera feed** — the found-footage overlay
  from `backrooms-aesthetic` sits on top of the 3D view.

## Controls
- Pointer Lock API for mouse look; WASD/arrows for movement; smooth acceleration
  and slight head-bob to sell the handheld feel.
- Clamp pitch; wrap yaw. Support gamepad optionally.

## Collision & space
- Player is a capsule/circle against axis-aligned walls from the generated grid
  (see `procedural-backrooms-generation`). Slide along walls, don't stop dead.
- No jumping/verticality required for v1 — floors are flat.

## Presence & proximity
- Continuously compute distance to other players/NPCs and expose the nearest
  presence + distance to the leak system (see `world-leak-system`) so the world
  can reflect their choices as you approach.

## Rules
- 60fps target; decouple simulation from render where practical.
- No engines/frameworks — vanilla only.
