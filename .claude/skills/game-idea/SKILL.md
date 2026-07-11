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

Everything is procedural — **no image or audio asset files** (keep it that way; it
works offline). Rendered with three.js, bundled by Vite.

| File | What it does | Good for |
| --- | --- | --- |
| `config.js` | Central tuning knobs: palette colors, room size, fog, speeds | **Easiest safe tweaks** (colors, fog, sizes) |
| `world.js` | Streams the endless rooms/pillars around the player | Layout, density, geometry |
| `materials.js` | Procedural (canvas) textures for walls/carpet/ceiling | Look of surfaces |
| `player.js` | First-person movement + collision | Controls, speed, feel |
| `postfx.js` | VHS / found-footage post-processing (grain, tracking, bloom) | Screen effects, glitch |
| `audio.js` | Web Audio ambience (brown-noise bed, fluorescent hum) | Sound |
| `main.js` | Wires it all together in the render loop | How things connect |

**Start in `config.js`** for a first change — tweaking a color or the fog is a
one-line, low-risk win.

## 3. Keep the vibe

Match the game's feel: sickly-yellow liminal space, buzzing fluorescent light,
oppressive emptiness, and a degraded VHS / found-footage look. New things should
feel *uncanny and off*, not bright or cartoonish.

## 4. Ship it

1. Make the smallest version of the change.
2. See it running (use the `run-game` skill) and confirm it looks right.
3. Submit it as a pull request (use the `contribute` skill).
