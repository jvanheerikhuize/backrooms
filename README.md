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

You start in **Level 0, "The Lobby"** — the classic sickly-yellow liminal space
everyone pictures. As you move through it, the presence of others (NPCs today,
networked players later) bleeds in, and the world reinterprets their influence —
accurate in essence, but usually *slightly off*. Your own input, in turn, alters
the section of the Backrooms around you. (The Backrooms canonically copies
reality and gets it wrong, so this "leak" is a lean into the mythos, not a
departure — see **[goal.md §6](./context/goal.md)**.)

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
| **Shift** | Run (drains the stamina bar) |
| **F** | Open / close the inventory |
| **~** | Open / close the developer console (type `help`) |
| **C** | Replay the found-footage cut-scene |
| **V** | Reduce camera motion (accessibility) |
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
  floor, with sprinting on a stamina bar. Black directional arrows scrawled on
  the occasional wall hint at a way through.
- **"Someone was here" rooms** — enclosed rooms scattered through the maze, each
  a themed trace of a past occupant (a party, a campsite, storage, toys). They're
  dressed with **real 3D models** and **wall signs** (exit, hazard, radiation…),
  never bare boxes. Some rooms are **"leaked"** — re-skinned with alternate
  wall/floor/ceiling textures, a different reality bleeding into the yellow.
- **Drop-a-file content** — props are real assets you can add without coding:
  **glTF/STL models** (`src/objects.js`), **SVG wall signs** (`src/svgprops.js`),
  and **image textures** (`src/textures.js`). Everything bundled is **CC0 /
  public-domain** (see the `NOTICE.md` files under `public/models/` and
  `public/textures/`). See **[Adding content](#adding-content)**.
- **Audio & ambience** — a procedural brown-noise room-tone bed and a fluorescent
  hum coupled to the light flicker, with a mute toggle (M). No audio assets — all
  Web Audio.
- **Found-footage camera** — a cut-scene layer (grain, VHS tracking, chromatic
  aberration, camcorder HUD) used for the opening title screen.
- **Dev console** — press **~** for a developer console: type commands like
  `room`, `arrow`, `seed`, `tp x z`, `home`, `spawn`, `noclip`, `speed`,
  `fullbright`, `fog`, `stage2`, `proproom` (`help` lists them all). It replaces
  the old numbered menu; the off-map test spaces (**Stage 2**, the **Prop Room**)
  are `stage2` / `proproom`.

Where it goes next is up for grabs — the leak/alteration system, NPCs as local
presences, new levels, creatures… decide in [goal.md](./context/goal.md).

## Adding content

Props are asset files, so you can grow the world without touching game logic:

- **A 3D prop** — drop a `.gltf`/`.stl` under `public/models/` and add an entry to
  `src/objects.js`.
- **A wall sign** — drop a filled-shape `.svg` under `public/models/svg/` and add
  an entry to `src/svgprops.js`.
- **A surface texture** ("leaked" wall/floor/ceiling) — drop a seamless image
  under `public/textures/` and add an entry to `src/textures.js`.

Keep bundled assets **CC0 / public-domain** (Poly Haven is a good source). The
`NOTICE.md` in each folder explains the format and lists sources.

## For contributors

- **Design & direction** live in **[context/goal.md](./context/goal.md)**; the
  running log of *why* things are the way they are is
  **[context/decisions.md](./context/decisions.md)**.
- **Knowledge graph** — a queryable map of the codebase's subsystems, concepts,
  decisions, and conventions. Instead of reading the docs end-to-end, run
  `npm run kg -- map` (overview), `npm run kg -- find <term>`, or
  `npm run kg -- why <id>`. See **[context/KNOWLEDGE.md](./context/KNOWLEDGE.md)**.

## Inspiration

Draws on the whole Backrooms mythos, which has no single canon:

- the **original 2019 /x/ greentext** — noclipping out of reality into ~600
  million square miles of mono-yellow rooms, and the rule that *if you hear
  something nearby, it has already heard you*;
- the **community "Levels / Entities" canon** (the Fandom & Wikidot wikis) —
  Level 0 "The Lobby," the Poolrooms, Almond Water, the M.E.G., and entities like
  Facelings, Skin-Stealers, and Smilers (the family our "presences" belong to);
- **Kane Pixels' *The Backrooms (Found Footage)*** — the analog-horror
  interpretation (now an A24 film) behind the Still Lifes, Null Zones, and the
  VHS/found-footage look.

The Backrooms is a collaborative internet mythos (much wiki content is CC-BY-SA);
this game is an original work *inspired by* it. See
**[context/goal.md §6](./context/goal.md)** for how each concept maps onto the
game's mechanics.
