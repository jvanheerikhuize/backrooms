# Feature 04 — Found-Footage Camera (Cut-Scene Layer)

> Status: **built — pending review** (on `feature/04-found-footage-camera`)
> Derives from: [`../goal.md`](../goal.md) §4 (grainy/VHS treatment), §6.9
> (analog / found-footage presentation).
> This is a living feature doc; scope may shift as [`../goal.md`](../goal.md) evolves.

## 1. Purpose

Commit to the analog-horror conceit of the *Backrooms (Found Footage)* series —
but confine the heavy camcorder treatment to **cut-scenes**, not live gameplay.

During normal exploration the first-person view stays clean and readable (grain
+ vignette + scanlines from Feature 01 remain, nothing more). When the game
takes control for a **cut-scene** — the opening, a scripted reveal, an NPC leak
event, a "found tape" interstitial — the view switches into a fully degraded
handheld camera feed. Reserving the aggressive VHS look for cut-scenes keeps the
game playable while making those moments land as *footage someone recorded*.

## 2. Scope (in)

- **Cut-scene camera mode** — a togglable presentation layer that wraps a scene
  in the found-footage treatment and releases it back to the clean gameplay
  view when the cut-scene ends. Gameplay never runs in this mode.
- **Camcorder HUD** — a timestamp/date counter, a blinking `REC ●` indicator,
  and a low-battery / tracking marker, drawn in the corner like a camcorder.
  Only visible during cut-scenes.
- **Handheld sway & bob** — idle camera drift plus motion bob so the cut-scene
  reads as held by a person, not on rails.
- **Tracking distortion** — VHS tracking-error bands, horizontal roll, and brief
  signal dropouts layered into the cut-scene post pass. Default intensity is
  **moderate**: regular bands and periodic roll/dropout, clearly found-footage
  while keeping the scene legible.
- **Chromatic aberration & bloom** — slight RGB split toward the edges and a
  soft bloom on the fluorescent panels for the cheap-lens/overexposed look.
- **Intensity coupling** — expose a `distortion(amount)` control so a cut-scene
  script (or later systems) can ramp the degradation across the scene.
- **Motion-sickness guard** — bob/sway amplitude is capped to a comfortable
  default, and a "reduce camera motion" toggle further damps it. The toggle
  applies everywhere, including the opening loop and any in-game cut-scene.

## 3. Cut-scene background of the opening screen

The main opening / title screen should **read as a cut-scene**, not a menu over
a static image. Behind the title and start prompt, play a looping found-footage
cut-scene using the full mode above:

- **The shot** — a slow handheld drift down an empty mono-yellow Backrooms
  corridor: buzzing fluorescent panels, damp carpet, no exit in sight. The
  camera bobs and sways gently as if someone is walking while filming, and
  occasionally pans to a wall or doorway and back.
- **Full camcorder treatment** — grain, vignette, scanlines, chromatic
  aberration, and bloom are all on. The corner HUD shows a blinking `REC ●` and
  a **fixed, uncanny timestamp** — a frozen "found" date/time, so it reads as old
  recovered footage rather than a live clock.
- **Periodic tracking glitches** — at the moderate default, every several seconds
  a tracking band rolls up the frame or the signal briefly drops and recovers,
  so the loop never feels static or clean.
- **Title over the footage** — the game title and "start" prompt sit on top of
  the footage like an overlay burned into the tape, not a separate clean UI
  panel. The footage keeps playing (and glitching) underneath while the player
  decides to start.
- **Handoff** — when the player starts, the cut-scene mode releases and the
  clean gameplay view takes over, making the transition from "watching footage"
  to "you are here" explicit.

## 4. Scope (out — deferred)

- Applying the found-footage treatment to **live gameplay** — deliberately out;
  gameplay stays clean. (This reverses the earlier draft of this feature.)
- Actual video recording / export of the feed.
- A general, data-driven cut-scene **sequencer** — this feature ships the camera
  mode, the opening-screen loop, and one scripted in-game reveal (see §5). A
  reusable timeline/sequencer for authoring many mid-game cut-scenes is a
  follow-up.
- Driving the distortion from real leak/entity state — ships the control and a
  manual/scripted driver; wiring it to Feature 02/entities is a follow-up.

## 5. Acceptance criteria

1. Normal gameplay shows the clean view (no camcorder HUD, no tracking glitches).
2. A cut-scene can be entered and exited, switching the view into and out of the
   full found-footage treatment.
3. During a cut-scene the view shows the camcorder HUD (timestamp + blinking
   REC), handheld bob/drift, and occasional tracking bands / roll / chromatic
   aberration.
4. The opening screen plays the looping corridor cut-scene described in §3, with
   the title overlaid on the footage, and hands off to the clean gameplay view
   on start.
5. At least **one scripted in-game cut-scene** (e.g. an NPC leak / reveal moment)
   plays mid-game using the same mode, proving cut-scenes work outside the
   opening.
6. The corner HUD shows a fixed, uncanny "found" timestamp (not a live clock).
7. A "reduce camera motion" toggle damps bob/sway, and it applies to the opening
   loop and in-game cut-scenes alike.
8. A test control visibly ramps cut-scene distortion from calm to heavy.

## 6. Resolved decisions

- **Glitch default: moderate** — regular bands and periodic roll/dropout, kept
  legible. Not the subtle floor, not the heavy dread ceiling.
- **Timestamp: fixed uncanny date** — a frozen "found" date/time, reinforcing
  recovered-footage framing.
- **Motion guard: capped + toggle, everywhere** — amplitude capped by default,
  plus a "reduce camera motion" toggle that the opening loop and in-game
  cut-scenes both respect.
- **Cut-scene scope at ship: opening + one reveal** — the opening loop plus one
  scripted mid-game cut-scene; a general sequencer stays a follow-up.
