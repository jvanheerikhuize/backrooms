# Backrooms Game — Goal & Design

> ## 👋 Flynn — this is yours to shape!
> This file describes **what the game is and why**. There's no fixed feature
> roadmap anymore — *you* get to decide where it goes. Read it, then change
> anything you like: add a level, invent a creature, or change the whole idea.
> Open your terminal, start Claude, and say something like *"help me update the
> goal — I want the game to also have …"*. See **[../FLYNN.md](../FLYNN.md)** for
> how. Nothing here is set in stone. 🟡👾

> **Living document.** This captures the current intent and design direction.
> It will change over time as insights change — treat it as the evolving source
> of truth for *what we're building and why*, not a frozen contract.

> **Current scope (as of 2026-07): single-player.** To avoid the complexity of
> networking and a live backend, the game is single-player for now. The
> "shared lobby" and "other presences" below remain the long-term vision, but
> are **mocked with NPCs** — locally-simulated presences that carry a signature,
> leak into the world, and trigger proximity reflection exactly as a networked
> player eventually would. Real multiplayer (Node backend, real-time sync,
> persistence) is **deferred**, and every mechanic here is built to be driven by
> a local NPC now and a networked player later with no rework.

## 1. Overview
A browser-based, first-person exploration game built around the look and
feel of the "Backrooms" — the liminal-space internet mythos of endless,
uncannily empty rooms with mono-yellow wallpaper, damp carpet, and buzzing
fluorescent lights.

The game acts as a **shared lobby**: a persistent, wandering space where the
choices and inputs of other players (and NPCs) bleed into the world around
you. The base Backrooms is the classic yellow — but as other presences'
"world leaks in," the environment alters into a Backrooms *interpretation*
of their influence, never an exact copy.

## 2. Goals
- Deliver an atmospheric, browser-playable, first-person Backrooms experience.
- Capture the signature aesthetic: monochrome yellow walls, humming
  fluorescent lighting, oppressive emptiness, and a sense of being lost.
- Make the world feel *shared and reactive* — other players' presence
  visibly, but imperfectly, reshapes the space.

## 3. Tech Stack
- Frontend in **HTML / CSS / JavaScript**.
- Backend in **Node.js**, handling real-time state sync and persistence for
  the shared world. Specific Node libraries/frameworks are open.
  **Deferred** while the game is single-player (see the Current-scope note
  above) — nothing built so far needs it, and NPCs mock the multiplayer layer
  client-side.

## 4. Aesthetic / "Look & Feel" Requirements
- Dominant sickly-yellow wallpaper palette as the **base** state.
- Fluorescent lighting with a subtle flicker/buzz.
- Repetitive, disorienting room layouts that evoke endlessness.
- Muffled, ambient audio (buzzing hum) where feasible.
- Grainy / VHS-like visual treatment to reinforce the liminal mood.
- **Leaking / alteration state**: where another presence's influence bleeds
  in, the base yellow warps into a distorted interpretation of their input —
  altered color, geometry, textures, props — never a literal reproduction.

## 5. Gameplay & Mechanics

### 5.1 Genre & Perspective
- **First-person** navigation. (Fixed requirement.)
- **Exploration** game — no explicit win/lose objective; the draw is
  wandering, discovering, and reading the world's mutations.

### 5.2 The Lobby / Shared World
- The Backrooms functions as a persistent lobby that all players share.
- Actions and inputs by other players are reflected in the world.
- Reflections are **accurate in essence but usually slightly "off"** — the
  world remembers other players imperfectly, producing an uncanny,
  dreamlike distortion rather than a faithful mirror.
- **Single-player for now:** there are no networked players yet. NPCs stand in
  for "other players" as local presences (see §5.4, §7), so the shared-lobby
  *feel* is delivered without a backend.

### 5.3 Player Influence
- **Player input alters a section of the Backrooms.** Each player leaves a
  mark on their surrounding area through their choices/inputs.
- Alterations are localized to a section, not the whole world.

### 5.4 Proximity Reflection
- When you are **near another player or an NPC**, the surrounding area
  reflects *their* choices and input.
- Proximity is the trigger for another presence's alterations to become
  visible/dominant in your view.

### 5.5 Spawning
- A **new player always starts at a "fresh" corner** of the Backrooms —
  an unaltered, pure-yellow region untouched by others' leakage.

### 5.6 The "Leak" Model
- **Base state**: classic yellow Backrooms.
- **Leaked state**: as other presences' worlds bleed in, the environment
  reinterprets their influence — a Backrooms-flavored distortion, not a copy.

## 6. Lore Concepts Derived from the Backrooms (Found Footage) Series
The following concepts are drawn from Kane Pixels' *The Backrooms (Found
Footage)* — the analog-horror series being adapted into the A24 film. Each
is mapped to how it can reinforce this game's shared-lobby / leak mechanics.

### 6.1 Noclipping — Entry & Thresholds
- In the mythos you enter the Backrooms by "noclipping" out of reality
  through a threshold/portal.
- **Use in game**: a new player's arrival at their fresh corner is framed
  as noclipping in. Thresholds can be visible seams where the world is
  thin — potential exits, transitions, or connection points between zones.

### 6.2 The Space Mimics Reality — Imperfectly
- The Backrooms is an anomalous dimension that *tries to copy real-world
  areas*, but the copies come out wrong.
- **Use in game**: this is the canonical justification for the core "leak"
  mechanic. Other players' influence manifests as the world attempting to
  reproduce their space and getting it **slightly off** — exactly the
  "accurate but usually off" behavior already specified.

### 6.3 Room Duplication
- The Backrooms "copies" rooms — and sometimes the people inside them —
  spawning near-identical, drifting variants.
- **Use in game**: a section a player alters can spawn duplicated,
  progressively-mutating copies nearby, seeding the disorienting endlessness.

### 6.4 Still Lifes — Distorted Human Copies
- **Still Lifes** are humanoid figures created when the Backrooms copies a
  room containing a person: disfigured, misaligned features (duplicated
  fingers, wrong faces), uncanny behavior.
- **Use in game**: an ideal manifestation for *absent or past* players and
  NPCs — you encounter a warped "still life" echo of someone who influenced
  this area rather than the real person. Reinforces "reflection, slightly off."

### 6.5 The Lifeform / Entities — Audio Mimicry
- **The Lifeform**: aimless, hive-like hunters with acute hearing that use
  the repurposed throats of victims to **mimic human cries for help**.
- **Use in game**: even in a non-combat exploration game, this seeds
  *reactive ambient audio* — distant, wrong-sounding human voices near
  heavily-leaked or entity-touched zones. Proximity + sound as tension.

### 6.6 The Growth
- Entities nest in **the Growth** — masses of their own tendrils spreading
  through rooms.
- **Use in game**: a visual corruption state for the most heavily-altered /
  oldest zones — organic tendrils overtaking the wallpaper.

### 6.7 The Green Glow & Null Zones
- The **Green Glow** (theorized gamma radiation) marks **Null Zones** —
  unstable spots where a portal between reality and the Backrooms can form.
- **Use in game**: green-glowing Null Zones as landmarks/waypoints — spawn
  points, exits, or the "seams" where one player's leaked world meets another's.

### 6.8 Async Research Institute — Hidden Overseers
- The **Async Research Institute** secretly studies and tries to exploit the
  Backrooms (bridging it to reality to solve overpopulation/storage).
- **Use in game**: a source of NPCs, environmental storytelling (found notes,
  cameras, equipment), and lore explaining *why* this shared lobby exists.

### 6.9 Analog / Found-Footage Presentation
- The series' signature is degraded VHS / found-footage camerawork.
- **Use in game**: reinforces the existing grain/VHS aesthetic requirement.
  The heavy handheld-camcorder treatment (timestamp, tracking distortion,
  chromatic aberration) is reserved for **cut-scenes** — the opening screen and
  scripted reveals — while live gameplay keeps a cleaner, readable view. See
  [`features/04-found-footage-camera.md`](features/04-found-footage-camera.md).

## 7. Open Questions / To Resolve
- **NPCs** *(now the near-term priority — they mock multiplayer while the game
  is single-player)*: what are they, and where do their "choices/input" come
  from (scripted, generated, echoes of past players)? They carry a signature
  and drive the leak + proximity reflection just as a networked player would.
- **Persistence**: do alterations persist over time, or decay/reset?
- **Player input surface**: what specifically can a player *input* to alter
  a section (movement traces, placed objects, text, choices from prompts)?
- **Proximity mechanics**: radius, blending when multiple presences overlap,
  transition in/out of a presence's zone.
- **Audio**: is ambient/reactive sound in scope for v1?

---
*Derived from `raw intent`, clarified gameplay direction, and concepts from
the Backrooms (Found Footage) series. Section 7 contains items that need
decisions before development begins.*
