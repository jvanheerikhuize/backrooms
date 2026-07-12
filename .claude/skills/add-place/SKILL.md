---
name: add-place
description: Add a new place to the game — a separate level, stage, or room you travel to, living in its own scene rather than in the infinite maze. Use when someone wants a new level, a new area, a second dimension, or somewhere the player can go that isn't the endless yellow rooms.
---

# Add a place (a new level or stage)

"A new level" can mean three different things. Work out which one first — they touch
completely different files.

| They want | Do this instead |
| --- | --- |
| The maze itself to feel different (denser, emptier, corridors) | Add a profile to `CONFIG.zones.profiles` in `src/config.js` — data-driven, no new file |
| A themed room to find inside the maze | Add a theme to `src/rooms.js` (the `themes` array + an `addXTheme` function + the if/else chain that dispatches on `room.theme`) |
| A **separate area you travel to**, like Stage 2 | This skill |

## The contract

A place is its own `THREE.Scene`, entirely decoupled from the infinite world. Model
it on `src/stage2.js`, and read `src/place.js` first — it's short, and it defines
everything below.

Two hard-won rules baked into the existing code:

- **Its own scene, not a far-away corner of the world.** Parking a room at distant
  world coordinates causes visible float-precision jitter. That's why `STAGE2_POS`
  is `{wx: 0, wz: 0}` — inside its own scene, nothing else is ever rendered there.
- **Colliders are axis-aligned boxes already padded by `CONFIG.playerRadius`.** The
  player (and the NPC) do a plain point-in-box test against them. Pad them yourself,
  the way `stage2.js` does.

## Steps

1. **Create `src/<name>.js`.** Export a `build<Name>(materials)` returning
   `{ group, colliders }`, and a `<NAME>_POS` spawn point. Reuse the shared
   `materials` (`src/materials.js`) unless the place is meant to look different — if
   it is, give it its own light colour and scene background, as Stage 2 does to read
   grey instead of Backrooms-yellow.
2. **Wire it into `src/main.js` — four separate edits**, scattered across the file.
   Copy Stage 2's, which is the reference implementation:
   - a `new THREE.Scene()` with its own `background` (and `fog`, if you want distance
     fade — Stage 2 deliberately has none);
   - a `new RoomPlace({ id, scene, spawn, colliders })`. Options worth knowing:
     `build` for lazy construction on first entry (the Prop Room needs its asset
     caches warm first), `placeCamera` for a custom arrival framing, `vignette`, and
     `mutesBed` to drop the ambient static bed;
   - a `toggle<Name>()` that calls `goTo(place)` — `goTo` applies scene, vignette,
     audio bed, and spawn in one go, so never set those by hand;
   - a `devConsole.register("<name>", ...)` command to get there (see `dev-command`).
3. **Verify it.** `run-game`, press `` ` ``, type your command. Walk the walls and
   confirm you can't clip through them and aren't blocked by invisible corners.
4. **Log it** with `close-out` — a new place is a real subsystem, so it wants a
   `context/knowledge.json` node and a `context/decisions.md` entry.

## Keep the vibe

A new place doesn't have to be yellow — Stage 2 is grey concrete on purpose. But it
should still feel *wrong*: too big, too quiet, too empty, lit by something that
hums. See `context/goal.md`.
