# Project State — read this first

Compact, canonical snapshot of where the project is. Load this before anything
else; follow the links only when you need detail. The **Feature status** block
below is auto-generated from the specs — do not hand-edit it.

## What this is

A browser-based, first-person **Backrooms exploration game**. Wander an endless
sickly-yellow liminal space; nearby presences "leak" into the world as
slightly-off distortions. Full vision: [`goal.md`](./goal.md).

## Current scope — SINGLE-PLAYER

No backend, no networking. "Other presences" are **NPCs** that mock what
networked players would do. Multiplayer is deferred. Build every
presence/leak/proximity mechanic so an NPC drives it now and a networked player
could later with no rework.

## Stack

- Frontend: vanilla JS + **three.js**, dev/build via **Vite**.
- No backend. Fully client-side.
- Assets are **procedural** (canvas textures, Web Audio) — nothing external.
- Run: `npm install` then `npm run dev` (→ http://localhost:5173).

## Feature status

<!-- context:features:start -->
**Done** — [01](./features/completed/01-empty-yellow.md) The Empty Yellow · [03](./features/completed/03-audio-ambience.md) Audio & Ambience

**Designed** — [02](./features/02-player-influence-leak.md) Player Influence & The Leak

**Proposed** — [04](./features/04-found-footage-camera.md) Found-Footage Camera Layer · [05](./features/05-fluorescent-flicker.md) Fluorescent Lighting Overhaul · [06](./features/06-liminal-detail-pass.md) Liminal Environmental Detail Pass · [07](./features/07-green-glow-null-zones.md) The Green Glow & Null Zones · [08](./features/08-the-growth.md) The Growth · [09](./features/09-npc-presences.md) NPC Presences
<!-- context:features:end -->

Full table + dependencies: [`features/backlog.md`](./features/backlog.md).
Specs live in `features/`; shipped ones move to `features/completed/`.

## Conventions

- **Features** are built on a branch (`feature/NN-slug`) → PR. Small tweaks to a
  shipped feature can go straight to `main`.
- **Before a feature PR**: flip the spec's `> Status:` to *implemented*, move the
  spec into `features/completed/`, then run **`npm run context`** to refresh this
  file and the backlog, and update the root README.
- **Verify** browser changes headlessly (Playwright + Chrome/SwiftShader) and
  capture before/after evidence; don't rely on tests alone.

## Key decisions

Terse, dated log: [`decisions.md`](./decisions.md). Highlights: three.js over raw
WebGL; single-player + NPC mock; procedural-only assets; status-by-folder layout.

## Keeping this fresh

`npm run context` regenerates the auto blocks in this file and the backlog from
the feature specs (their `> Status:` line + folder). `npm run context:check`
fails if they're stale — wire it into review if desired.
