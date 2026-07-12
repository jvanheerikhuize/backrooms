---
name: game-idea
description: Turn a Backrooms game idea into a real change — either update the game's goal/design (context/goal.md) or implement a small feature or tweak that matches the game's style. Use when someone has an idea for a new level, creature, effect, color, sound, or mechanic and wants to add it.
---

# Turn an idea into a change

Help someone (likely Flynn) go from "I have an idea" to a real, shippable change
that fits the game. Keep it **small, safe, and reversible** — build confidence
with wins, not giant rewrites.

## 1. Understand the idea

Ask what they want in concrete terms if it's fuzzy. Then decide the scope:

- **Design/story idea** (a new level concept, a creature, a direction) → write it
  into **`context/goal.md`**. `goal.md` is the living description of what the game
  is; it's meant to be reshaped (there is no fixed roadmap — this game's direction
  is Flynn's to set).
- **Something visible in the game** (a color, the fog, a light, a sound, an
  effect) → make a small code change (below).

A big idea can be **both**: capture it in `goal.md`, then implement the smallest
first slice.

## 2. Where the code lives (`src/`)

The base game is procedural — **no image or audio asset files**, works offline.
The deliberate exceptions are three asset *registries* (3D models, SVG signs,
surface textures); keep new asset types inside those rather than expanding the
exception casually, and see `context/decisions.md`. Rendered with three.js,
bundled by Vite.

| File | What it does | Good for |
| --- | --- | --- |
| `config.js` | Central tuning knobs: palette colors, room size, fog, speeds | **Easiest safe tweaks** (colors, fog, sizes) |
| `world.js` | Streams the endless rooms/pillars around the player | Layout, density, zone profiles |
| `rooms.js` | Special "someone was here" rooms (themes, doorways, props) | Room content, prop themes |
| `objects.js` | Registry + loader for glTF / STL 3D models | Adding real 3D props (`add-content`) |
| `svgprops.js` | Registry for SVG wall signs | Signs, posters (`add-content`) |
| `textures.js` | Registry for wall/floor/ceiling surface skins | Wallpaper, tiling (`add-content`) |
| `materials.js` | Procedural (canvas) textures for the base surfaces | Look of the default rooms |
| `player.js` | First-person movement + collision | Controls, speed, feel |
| `postfx.js` | VHS / found-footage post-processing (grain, tracking, bloom) | Screen effects, glitch |
| `audio.js` | Web Audio ambience (brown-noise bed, fluorescent hum) | Sound |
| `cutscene.js` | The found-footage cut-scene layer | Scripted reveals |
| `entity.js` / `npc.js` | The entity layer and the first wandering presence | Creatures (`add-entity`) |
| `place.js` / `stage2.js` / `proproom.js` | Places you can be in, each its own scene | New levels (`add-place`) |
| `console.js` | The tilde developer console | Debug commands (`dev-command`) |
| `main.js` | Wires it all together in the render loop | How things connect |

**Start in `config.js`** for a first change — tweaking a color or the fog is a
one-line, low-risk win.

## 3. Keep the vibe

Match the game's feel: sickly-yellow liminal space, buzzing fluorescent light,
oppressive emptiness, and a degraded VHS / found-footage look. New things should
feel *uncanny and off*, not bright or cartoonish.

## 4. Ship it

1. Make the smallest version of the change. If it's a prop, a creature, a new
   level, or a debug command, there's a skill that walks the exact wiring:
   `add-content`, `add-entity`, `add-place`, `dev-command`.
2. See it running (`run-game`) and *prove* it works (`verify-change`).
3. Update the docs and the knowledge graph (`close-out`) — the pre-commit hook
   will reject the commit otherwise.
4. Submit it as a pull request (`contribute`).
