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
A browser-based, first-person exploration game built around the look and feel
of the **Backrooms** — the liminal-space horror mythos that began with an
anonymous 2019 post on 4chan's /x/ board: if you "noclip out of reality," you
fall into endless, uncannily empty rooms of mono-yellow wallpaper, damp carpet,
and fluorescent lights buzzing "at maximum hum-buzz." The base game is the
canonical entry point — **Level 0, "The Lobby"** — the classic yellow rooms
everyone pictures.

On top of that canon the game adds its own twist: it acts as a **shared lobby**,
a persistent space where the choices and inputs of other presences (NPCs now,
networked players later) bleed into the world around you. This isn't a departure
from the mythos so much as a lean into it — the Backrooms canonically *tries to
copy reality and gets it wrong*, and its halls are haunted by the lost and by
things that wear a human shape. So when another presence's world "leaks in," the
environment reinterprets their influence into a Backrooms distortion — accurate
in essence, never an exact copy.

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

Grounded in canonical **Level 0**: sickly mono-yellow, damp carpet, humming
fluorescents, a maze that quietly rearranges when you aren't looking.

- Dominant sickly-yellow wallpaper palette as the **base** state (the wallpaper
  shade shifts subtly by location but stays yellow — as in the canon).
- Fluorescent lighting with a subtle flicker/buzz; brightness varies
  unpredictably, with darker stretches between fixtures.
- Repetitive, disorienting room layouts that evoke endlessness — and, per canon,
  a layout that can change when unobserved (the streaming/reseeding already hints
  at this).
- Old moist Berber-style carpet underfoot; muffled ambient audio dominated by the
  fluorescent **hum**, with room-tone that can spike or drop to near-silence.
- Grainy / VHS-like visual treatment to reinforce the liminal mood.
- Canonical hazards to draw on later: **red rooms** (inescapable loops to avoid),
  **blackout zones** (sprint toward light), and half-heard whispers / familiar
  voices that may or may not be real.
- **Leaking / alteration state**: where another presence's influence bleeds in,
  the base yellow warps into a distorted interpretation of their input — altered
  color, geometry, textures, props — never a literal reproduction.

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
  an unaltered, pure-yellow region untouched by others' leakage. Framed in canon
  as **noclipping into Level 0**.

### 5.6 The "Leak" Model
- **Base state**: classic yellow Backrooms.
- **Leaked state**: as other presences' worlds bleed in, the environment
  reinterprets their influence — a Backrooms-flavored distortion, not a copy.

## 6. Grounding in the Backrooms mythos

There is no single official canon — the Backrooms grew from that one 2019 post
into a sprawling, collaborative mythos of community-invented "Levels,"
"Entities," "Objects," and "Groups." This game draws on three strands and stays
faithful to their spirit:

- the **original /x/ greentext** (2019) — the founding rules and atmosphere;
- the **community canon** (the Fandom / Wikidot "Backrooms" wikis) — the
  Level / Entity / Object / Group system;
- **Kane Pixels' _The Backrooms (Found Footage)_** — the analog-horror
  interpretation (being adapted into an A24 film) whose look this game borrows.

Each concept below is mapped to how it reinforces the shared-lobby / leak design.

### 6.1 The founding rules (2019)
- Entry is by **"noclipping"** out of reality; the Backrooms is ~600 million
  square miles of "randomly segmented" empty yellow rooms.
- Two rules set the whole tone: the maddening sameness of the mono-yellow, and —
  from the follow-up post — that *if you hear something wandering nearby, it has
  already heard you*. **Sound is danger.**
- **Use in game**: arrival at the fresh corner is framed as noclipping into
  Level 0; the endlessness is the procedural streaming; "sound is danger" is the
  seed for reactive audio-dread near presences.

### 6.2 Level 0 — "The Lobby"
- The base level and the image everyone pictures: yellow wallpaper, damp carpet,
  buzzing lights, a shifting non-Euclidean maze. Canonically classified "safe,"
  yet you die of dehydration and isolation, not claws — entities are rarely
  confirmed here, but wanderers still report **dark figures** and unexplained
  dread. Exits are **flickering walls leading to Level 1**.
- **Use in game**: this IS the base game. The lone wandering figure (our first
  NPC) is exactly the "dark figure glimpsed in isolation"; flickering-wall exits
  are a hook for real destinations.

### 6.3 The Level system
- Beyond Level 0 lie hundreds of community levels — e.g. **Level 1**, the
  water-filled tiled **Poolrooms**, **Level !** ("Run For Your Life," actively
  hostile), and **Level Fun =)** (a deranged party level). Wanderers move between
  them through thresholds.
- **Use in game**: our layout **zones** and the dev **Stage 2** are the seed of a
  level system; distinct levels (a Poolrooms, a hostile level) are natural future
  content, reached through Null-Zone seams / flickering thresholds.

### 6.4 Entities — the things in the halls
The canonical roster the game can draw on (community "Entity" numbers):
- **Faceling** — a faceless humanoid; often theorized to be a person who got
  lost forever and went mad.
- **Skin-Stealer** — wears human skin (visible stitches) and consumes not just
  flesh but *identity*.
- **Smiler** — glowing eyes and a grin in the dark; drawn to moving light.
- **Hound** — a naked, all-fours humanoid with too many teeth (a bite turns you
  into one).
- (others: Deathmoths, Clumps, …)
- **Use in game**: this canon *is* the game's "presences." A leaked NPC presence
  reads as a **Faceling / Still Life** — a lost human the space is copying badly;
  the audio-dread hunter is a **Smiler / Hound**; the "reflection that's slightly
  off" is literally a **Skin-Stealer**'s wrongness. The dark figure we already
  spawn sits squarely in this family.

### 6.5 Objects & Groups
- **Almond Water (Object 1)** — the iconic Backrooms item; the main thing keeping
  wanderers alive.
- **The M.E.G. (Major Explorer Group)** — the largest survivor faction, with
  outposts and field notes scattered across the levels.
- **Use in game**: Almond Water is the obvious first **inventory pickup** (the
  inventory panel already exists); M.E.G. field notes are a ready-made frame for
  environmental storytelling — and for what NPC "presences" *are*: other
  explorers, past and present.

### 6.6 Imperfect mimicry & the shifting maze — the "leak"
- Across the canon (and central to Kane Pixels), the Backrooms **tries to copy
  the real world and gets it wrong**, and its geometry **rearranges when
  unobserved**.
- **Use in game**: this is the canonical justification for the core leak
  mechanic — a presence's influence is the world trying to reproduce *their*
  space and coming out uncanny. Texture-skinned "leaked" rooms are the first taste.

### 6.7 Still Lifes & room duplication (Kane Pixels)
- **Still Lifes** — disfigured human copies made when the Backrooms duplicates a
  room containing a person (wrong faces, extra fingers). Rooms themselves get
  copied into drifting variants.
- **Use in game**: the ideal manifestation of *absent / past* presences — you
  meet a warped echo of whoever influenced this area, not the person. Room
  duplication seeds the disorienting sameness.

### 6.8 Kane Pixels' additions
The found-footage series adds its own layer this game borrows for mood and story:
- **The Green Glow / Null Zones** — green-glowing unstable spots where reality and
  the Backrooms touch → landmarks / spawn points / seams between leaked worlds
  (our green encounter markers).
- **The Growth** — the tendril-masses entities nest in → a corruption state for
  the oldest, most-leaked zones.
- **The Async Research Institute** — hidden overseers studying and exploiting the
  Backrooms → a source of NPCs, found equipment, and a *why* for the shared lobby.
- **Analog / found-footage presentation** — degraded VHS camerawork → our
  grain/VHS treatment, reserved for cut-scenes (the opening screen and scripted
  reveals) while live gameplay keeps a cleaner, readable view.

> **A note on canon.** The Backrooms has no single owner or official canon — it's
> a collaborative internet mythos (much community wiki content is CC-BY-SA). This
> game is an original work *inspired by* it: the names and concepts above are used
> the way any Backrooms project uses the shared mythos, and nothing is reproduced
> verbatim.

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
*Derived from `raw intent`, clarified gameplay direction, and the Backrooms
mythos — the original 2019 /x/ greentext, the community Level/Entity canon, and
Kane Pixels' _The Backrooms (Found Footage)_ (§6). Section 7 lists items still
open.*
