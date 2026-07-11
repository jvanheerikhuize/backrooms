---
name: procedural-backrooms-generation
description: Use when generating the endless, disorienting Backrooms layout — rooms, hallways, room duplication, fresh spawn corners, and per-section identity. Deterministic and chunked so the shared server and clients agree.
---

# Procedural Backrooms Generation

Generate the endless liminal space from `SPECIFICATION.md` §5 and the lore in §6
(room mimicry, room duplication, fresh corners, Null Zones).

## Core model
- Infinite grid divided into **chunks/sections**. Each section has a stable ID.
- Generation is **deterministic** from `(seed, sectionId)` so the Node backend
  and every client produce identical base geometry without shipping full maps.
- Layout: repetitive rooms + hallways with pillars, doorframes, and dead-ends
  that evoke endlessness and disorientation (avoid readable landmarks in base
  state).

## Sections as the unit of alteration
- A section is the granularity a player alters (spec §5.3) and the granularity
  the server persists. Keep sections small enough that one presence "owns" a
  believable local area.

## Lore-driven features
- **Room duplication** (§6.3): occasionally spawn near-identical, drifting copies
  of an adjacent room, mutating slightly each copy.
- **Fresh corner** (§5.5): a spawn request returns an untouched, un-leaked
  section far from altered space — pure yellow, no other presences.
- **Null Zones / Green Glow** (§6.7): rare special sections that act as
  landmarks/waypoints, spawn points, exits, and seams between leaked worlds.

## Interface
- Expose `generateSection(seed, sectionId) -> { geometry, features }` used by
  both client (render/collision) and server (authority/persistence).
- Keep base geometry separate from applied alterations (those come from
  `world-leak-system`) so the same base can be re-skinned by different leaks.

## Rules
- Deterministic, no per-call randomness that clients can't reproduce.
- Vanilla JS, shareable between browser and Node (ES module).
