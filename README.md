# Backrooms

A browser-based, first-person **Backrooms exploration game** — a shared lobby
where the choices and inputs of other players (and NPCs) leak into the world
around you as slightly-off, dreamlike alterations.

## Concept

The Backrooms starts as the classic sickly-yellow liminal space. But it's a
**shared lobby**: as you move through it, the presence of other players and NPCs
bleeds in, and the world reinterprets their influence — accurate in essence, but
usually *slightly off*. Your own input, in turn, alters the section of the
Backrooms around you.

- **First-person exploration** — no win/lose; the draw is wandering and reading
  the world's mutations.
- **The leak** — base yellow warps into a distorted interpretation of a nearby
  presence's world. Never a copy, always a Backrooms interpretation.
- **Proximity** — get close to another player or NPC and the area reflects
  *their* choices.
- **Fresh corner** — every new player noclips in at an untouched, pure-yellow
  region of their own.

## Tech Stack

- **Frontend** — vanilla HTML / CSS / JavaScript.
- **Backend** — Node.js, for real-time shared-world state sync and persistence.

## Status

Early / spec-driven — no gameplay code yet. See **[context/goal.md](./context/goal.md)**
for the full design, mechanics, and open questions. `goal.md` is a living
document — it will evolve as insights change over time.

Work is broken into feature specs under **[context/features/](./context/features/)**.
First up: **[01 — The Empty Yellow](./context/features/01-empty-yellow.md)**, the
walkable single-player base Backrooms that every later system builds on.

## Inspiration

Draws on the Backrooms mythos and Kane Pixels' *The Backrooms (Found Footage)*
analog-horror series — noclipping, imperfect room mimicry, Still Lifes, entities
that mimic human voices, Null Zones, and a found-footage aesthetic. See the
specification for how these map onto the game's mechanics.
