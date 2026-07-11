# Feature 02 — Player Influence & The Leak (single-player)

> Status: **planned / designed** (input model decided; not yet built)
> Derives from: [`../goal.md`](../goal.md) §5.3 (player influence), §5.6 (leak
> model), §6.2 (imperfect mimicry), §6.3 (room duplication).
> This is a living feature doc; scope may shift as [`../goal.md`](../goal.md) evolves.

## 1. Purpose

Build the game's signature mechanic — **the leak** — in a single-player,
offline context. The player leaves a mark on the section of Backrooms around
them, and that section warps from the pure yellow base state into a distorted
interpretation of the player's "signature." This is the creative core of the
game and its biggest open design question, so it is solved solo (fast
iteration, no networking) before the shared-world backend feeds it later.

## 2. Why before the backend

- The leak is the defining mechanic *and* the biggest unknown (`goal.md` §7
  leaves "what is player input?" and "what does an alteration look like?" open).
  That is a design risk, best answered cheaply and solo.
- Networking is an amplifier, not the mechanic: once the leak works locally,
  the backend's job is just to sync the influence state between clients.
- It is fully verifiable solo (drive headless, screenshot a base→leaked
  transition) — no need to simulate two networked clients to see value.
- It forces a clean **influence data model** that the shared-world feature will
  later serialize and sync.

## 3. Decided design — presence + signature

- **Signature.** Each presence has a seeded signature: a hue plus a few
  distortion parameters. Solo, that is just the player — but modelling it as a
  per-presence signature now means multiplayer drops in other signatures with
  no rework.
- **Presence accumulation.** Moving through and dwelling in the world raises an
  *influence* value in nearby cells, fading with distance so alterations stay
  localized to the player's section (§5.3). No typing, no menus — the leak
  marks where you have been.
- **Leak render.** A per-cell `leak` amount (0→1) drives three.js material
  uniforms plus small transform offsets: color warp toward the signature (kept
  grimy/desaturated — a Backrooms interpretation, never a clean copy), subtle
  geometry lean/duplication (a nod to §6.3), degraded wallpaper, tinted flicker.
  The transition animates smoothly as influence builds.

## 4. Scope (in)

- A grid-keyed **influence store** (`cell → { signature, amount }`), decoupled
  from rendering, ephemeral for now (optionally `localStorage`-backed).
- Presence-based influence accumulation with distance falloff.
- Per-cell leak rendering driven by influence, animated base→leaked.
- A seeded signature system built for *multiple* presences from day one.

## 5. Scope (out — deferred)

- All networking / backend / real-time sync (later feature; it swaps the store
  for a synced, persistent one).
- True proximity reflection of *other players* (§5.4) — there are no other
  players until the backend exists.
- NPCs, Still Lifes, entities.
- **Optional stretch:** one pre-baked "foreign" leaked zone so the player can
  preview what another presence's leak looks like — a cheap taste of proximity
  reflection without networking.

## 6. Acceptance criteria

1. Walking through / lingering in a section visibly warps it from yellow toward
   the player's signature over a few seconds.
2. The leak is localized — distant untouched sections stay pure yellow; the
   world reads as a patchwork.
3. The alteration is clearly a *distortion*, not a clean recolor (geometry
   and/or texture perturbation present).
4. Influence state is queryable independently of the meshes (proves the data
   model is decoupled and sync-ready).

## 7. Open questions

- Falloff radius and accumulation/decay rates.
- Does influence decay over time, or persist? (`goal.md` §7 persistence.)
- How strong should geometry perturbation be before it hurts navigation?
- Blending when a cell has influence from more than one signature (matters once
  multiplayer lands — design the store for it now).
