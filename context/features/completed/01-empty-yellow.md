# Feature 01 — The Empty Yellow (walkable base Backrooms)

> Status: **implemented** (three.js + Vite)
> Derives from: [`goal.md`](../../goal.md) §1, §4, §5.1, §5.5
> This is a living feature doc; scope may shift as [`goal.md`](../../goal.md) evolves.
> How to install/run the game lives in the root [`README.md`](../../../README.md) —
> this doc is the design record, not a run guide.

## 1. Purpose

Build the **base state** of the world: a first-person, browser-playable,
walkable Backrooms in its classic sickly-yellow, unaltered form. This is the
canvas every later system (the leak, proximity reflection, Still Lifes,
entities, Null Zones) paints on top of. Nothing can leak *into* the world until
there is a world to walk through.

Deliberately **single-player and offline** for this feature. No Node backend, no
networking, no persistence, no NPCs, no leak. Those are later features that
modify or connect this base.

## 2. Why this first

- It is the smallest slice that produces the signature *feel* of the game.
- It is independently testable in a browser with no server dependency.
- Every other mechanic in `goal.md` is a modification of this base state, so
  building it first de-risks and unblocks everything downstream.

## 3. Tech decision — three.js (not raw WebGL)

**Chosen: three.js** as the rendering layer, on top of the vanilla
HTML/CSS/JS frontend that `goal.md` §3 calls for. Backend stays Node.js for
later features; this feature ships no backend.

Rationale — optimized for *future enhancements*, which is the explicit ask:

- **The roadmap is materials- and post-processing-heavy.** The leak, VHS grain,
  fluorescent flicker, the Growth, the Green Glow, Still Lifes and entity
  distortion are all shader / material / post-effect work. three.js gives us
  `ShaderMaterial`, `EffectComposer` and a mature post-processing pipeline out
  of the box. In raw WebGL each of these is hand-rolled and becomes a
  maintenance liability.
- **Procedural geometry & instancing.** Endless repeating rooms and room
  duplication (§6.3) map cleanly onto `InstancedMesh` and scene-graph
  primitives. Raw WebGL means writing buffer/attribute management by hand.
- **Dynamic, per-section mutation.** The leak alters localized sections. A
  scene graph with swappable materials per region is far easier to mutate than
  manually-managed vertex buffers.
- **Team velocity & ecosystem.** Loaders, controls (`PointerLockControls`),
  and a large body of reference material shorten iteration loops. The cost is a
  bundle-size / abstraction overhead that is negligible for this project's
  goals.
- **Escape hatch preserved.** three.js still exposes raw GLSL via
  `ShaderMaterial` and `RawShaderMaterial`, so nothing about this choice blocks
  low-level effects later.

Dependency approach: pin a specific three.js version. Prefer a local/vendored
copy or an npm-managed build over a live CDN so the game is reproducible and
works offline during development.

## 4. Scope (in)

- First-person camera with **WASD movement + mouse-look** (pointer lock).
  Satisfies `goal.md` §5.1 (first-person is a fixed requirement).
- Collision so the player cannot walk through walls; gravity-free flat walking
  (no jumping needed for v1).
- **Procedural, repeating room layout** that reads as endless: mono-yellow
  wallpaper walls, damp-carpet floor, drop-ceiling with inset fluorescent light
  panels. Layout regenerates/tiles as the player moves so there is no visible
  edge of the world.
- **Aesthetic pass** (`goal.md` §4, base/unaltered subset):
  - Dominant sickly-yellow wallpaper palette.
  - Fluorescent lighting with subtle flicker.
  - Repetitive, disorienting geometry evoking endlessness.
  - Grainy / VHS-like post-processing treatment (grain + vignette at minimum).
- **Spawn**: player starts in a clean, unaltered region — the "fresh corner"
  of `goal.md` §5.5, minus its multiplayer meaning for now.
- Runs from a static `index.html` opened via a simple local static server.

## 5. Scope (out — explicitly deferred)

- Any networking, Node backend, real-time sync, or persistence.
- The leak / alteration system, proximity reflection, player input marks.
- NPCs, Still Lifes, entities, the Growth, Null Zones, thresholds/noclip
  transitions between zones.
- Audio (ambient hum) — **stretch goal only**; see §7. `goal.md` §7 lists audio
  as an open question for v1.
- Mobile/touch controls; save/load; menus beyond a click-to-start prompt.

## 6. Acceptance criteria

A reviewer opening the game in a desktop browser can:

1. See a click-to-start prompt; clicking locks the pointer and enters
   first-person view.
2. Walk with WASD and look with the mouse through a yellow room environment.
3. Move continuously in any direction without ever reaching an edge or void —
   the world keeps generating rooms ahead (endlessness).
4. Not pass through walls (basic collision holds).
5. Observe the signature look: sickly-yellow walls, fluorescent ceiling panels
   with a subtle flicker, and a VHS grain + vignette overlay on the whole view.
6. Maintain a smooth frame rate (target ~60 fps on a typical laptop) while
   moving — old geometry behind the player is culled/recycled, not accumulated
   unboundedly.
7. Run the whole thing from a static build with no backend process.

## 7. Stretch (only if cheap)

- Subtle ambient fluorescent hum tied to the flicker.
- Camera bob / handheld-cam sway to reinforce the found-footage framing
  (`goal.md` §6.9).

## 8. Open questions for this feature

- **Room generator model**: grid of tiled room cells vs. maze-like wall layout
  vs. open pillared hall. Which best sells "endless and disorienting"?
- **Chunking strategy**: how large is a generated chunk, and what is the
  load/unload radius around the player?
- **Determinism**: should the layout be seeded (reproducible) now, to make the
  later shared-world / fresh-corner logic easier? Leaning yes — a seeded
  generator is cheap insurance for `goal.md` §5.2–§5.5.
- **Collision approach**: grid-cell lookup vs. mesh raycast. Grid lookup is
  likely simpler and faster given a tiled layout.
