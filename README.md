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

- **Frontend** — vanilla HTML / CSS / JavaScript, rendered with
  [three.js](https://threejs.org/) and bundled/served by [Vite](https://vitejs.dev/).
- **Backend** — Node.js, for real-time shared-world state sync and persistence
  *(not yet built — see Status)*.

## Getting Started

Requires [Node.js](https://nodejs.org/) 18+.

```bash
npm install       # install dependencies (three.js, Vite)
npm run dev        # start the dev server → http://localhost:5173
```

Open the printed URL and **click to enter**. To make a production build:

```bash
npm run build      # output to dist/
npm run preview    # serve the production build locally
```

### Controls

| Input | Action |
| --- | --- |
| **Click** | Enter (locks the mouse pointer) |
| **W A S D** / arrow keys | Move |
| **Mouse** | Look |
| **Shift** | Run |
| **Esc** | Release the pointer |

## Status

Early. The design lives in **[context/goal.md](./context/goal.md)** — a living
document that evolves as insights change. Work is broken into feature specs
under **[context/features/](./context/features/)**.

Implemented so far:

- **[01 — The Empty Yellow](./context/features/01-empty-yellow.md)** — the
  walkable, single-player base Backrooms: first-person navigation, an endless
  procedurally-streamed world of yellow rooms and pillars, flickering
  fluorescent lighting, and a VHS grain/vignette treatment. This is the base
  state every later system (the leak, proximity reflection, NPCs) builds on.

Not yet built: the shared-lobby backend, the leak/alteration system, proximity
reflection, NPCs, and audio.

## Inspiration

Draws on the Backrooms mythos and Kane Pixels' *The Backrooms (Found Footage)*
analog-horror series — noclipping, imperfect room mimicry, Still Lifes, entities
that mimic human voices, Null Zones, and a found-footage aesthetic. See
[context/goal.md](./context/goal.md) for how these map onto the game's mechanics.
