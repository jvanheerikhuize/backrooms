# Backrooms

> ## 👋 Flynn — start here: **[FLYNN.md](./FLYNN.md)**
> Your step-by-step guide to adding your own ideas to the game. No git or coding
> experience needed. 🟡👾

A browser-based, first-person **Backrooms exploration game** where the choices
and inputs of nearby presences leak into the world around you as slightly-off,
dreamlike alterations.

> **Single-player for now.** To keep complexity down, the game runs entirely in
> the browser with no backend. The "shared lobby" of other presences is the
> long-term vision; for now those presences are **NPCs** that mock what
> networked players will eventually do. Real multiplayer is deferred.

## Concept

The Backrooms starts as the classic sickly-yellow liminal space. As you move
through it, the presence of others (NPCs today, networked players later) bleeds
in, and the world reinterprets their influence — accurate in essence, but
usually *slightly off*. Your own input, in turn, alters the section of the
Backrooms around you.

- **First-person exploration** — no win/lose; the draw is wandering and reading
  the world's mutations.
- **The leak** — base yellow warps into a distorted interpretation of a nearby
  presence's world. Never a copy, always a Backrooms interpretation.
- **Proximity** — get close to a presence (an NPC for now) and the area reflects
  *their* choices.
- **Fresh corner** — you noclip in at an untouched, pure-yellow region of your own.

## Tech Stack

- **Frontend** — vanilla HTML / CSS / JavaScript, rendered with
  [three.js](https://threejs.org/) and bundled/served by [Vite](https://vitejs.dev/).
- **Backend** — none. Single-player, fully client-side for now. A Node.js
  shared-world backend is deferred until multiplayer is on the table; NPCs mock
  it in the meantime.

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
| **M** | Mute / unmute audio |
| **Esc** | Release the pointer |

## Status

Early, and **open for direction** — there's no fixed feature roadmap. The design
lives in **[context/goal.md](./context/goal.md)**, a living document that anyone
(👋 especially Flynn — see **[FLYNN.md](./FLYNN.md)**) can help reshape.

What the game already does today:

- **The Empty Yellow** — a walkable, single-player base Backrooms: first-person
  navigation through an endless procedurally-streamed world. The map is carved
  into **layout zones** (`config.js`) that change character as you walk — open
  halls, dense wallpapered rooms, long corridors, and green-glowing encounter
  clearings — over sparse flickering fluorescent fixtures that pool light on the
  floor, with sprinting on a stamina bar.
- **Audio & ambience** — a procedural brown-noise room-tone bed and a fluorescent
  hum coupled to the light flicker, with a mute toggle (M). No audio assets — all
  Web Audio.
- **Found-footage camera** — a cut-scene layer (grain, VHS tracking, chromatic
  aberration, camcorder HUD) used for the opening title screen.

Where it goes next is up for grabs — the leak/alteration system, NPCs as local
presences, new levels, creatures… decide in [goal.md](./context/goal.md).

## Inspiration

Draws on the Backrooms mythos and Kane Pixels' *The Backrooms (Found Footage)*
analog-horror series — noclipping, imperfect room mimicry, Still Lifes, entities
that mimic human voices, Null Zones, and a found-footage aesthetic. See
[context/goal.md](./context/goal.md) for how these map onto the game's mechanics.
