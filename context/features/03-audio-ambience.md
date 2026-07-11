# Feature 03 — Audio & Ambience (brown-noise bed)

> Status: **implemented** (Web Audio API, no assets)
> Derives from: [`../goal.md`](../goal.md) §4 (muffled ambient audio), §6.5
> (audio mimicry), and §7 (audio open question — this feature resolves it as
> *in scope*).
> This is a living feature doc; scope may shift as [`../goal.md`](../goal.md) evolves.
> How to run / the mute control lives in the root [`README.md`](../../README.md);
> this doc is the design record.

## 1. Purpose

Give the Backrooms a voice. Right now the world is silent, which undercuts the
oppressive, liminal mood the whole game is built on. This feature adds a
layered ambient soundscape, anchored by a **brown-noise bed** — the deep,
rounded room-tone rumble strongly associated with the Backrooms — plus the
signature fluorescent hum and reactive hooks for later systems.

All audio is **generated procedurally with the Web Audio API** (no audio
files), matching the asset-free, offline-friendly approach already used for the
procedural textures in Feature 01.

## 2. Why brown noise

- **It is the Backrooms sound.** The mythos' ambience is a low, enveloping
  hum / room tone. Brown (a.k.a. Brownian / red) noise rolls off at ~-6 dB per
  octave, so it is bass-heavy and soft — a warm, oppressive rumble rather than
  the harsh hiss of white noise. That deep "empty building at night" quality is
  exactly the target.
- **It masks and unsettles.** A constant low bed removes silence, makes the
  space feel enclosed, and gives later reactive sounds (buzz swells, distant
  voices) something to emerge from.

## 3. Scope (in)

- **Brown-noise ambient bed** — generated procedurally, looped seamlessly,
  played at a low, constant level as the base layer.
- **Fluorescent hum** — a low electrical hum (mains-style ~60 Hz tone + a
  ~120 Hz harmonic) whose amplitude is **coupled to the existing light
  flicker** so the buzz dips and buzzes in sync with the visuals.
- **Master mute / volume control** — a persistent, obvious way to mute or set
  volume (keyboard toggle + on-screen indicator), remembered via `localStorage`.
- **Autoplay-safe startup** — the `AudioContext` is created/resumed on the
  existing click-to-start gesture (browsers block audio without a user
  gesture); audio suspends when the pointer is released / tab hidden and
  resumes on re-entry.
- **A small mixer/bus abstraction** — a single audio module exposing named
  buses (bed, hum, sfx, reactive) and a master gain, so later features can add
  sources without touching startup/lifecycle code.

## 4. Scope (out — deferred)

- **Footsteps and movement foley** — nice, but a follow-up; keep v1 to ambience.
  (Listed as a stretch in §7.)
- **Positional / 3D spatial audio** for specific world objects — deferred until
  there are objects/entities to attach it to.
- **Reactive leak audio** (filter/volume shifts inside leaked sections) and
  **distant "wrong" human voices** (§6.5) — these depend on the leak system
  (Feature 02) and entity zones; this feature only exposes the *hooks* (buses +
  a `setReactivity(amount)` stub), it does not drive them.
- Music. There is no music in the Backrooms.

## 5. Technical approach

- **Brown noise generation.** Fill an `AudioBuffer` (a few seconds long) by
  integrating white noise — each sample `last = (last + 0.02 * white) / 1.02`,
  scaled up (~3.5×) to compensate for the low gain — then loop the buffer via a
  looping `AudioBufferSourceNode`. Cheap, deterministic-enough, no assets.
- **Seam-free loop.** Use a buffer long enough that the loop point is not
  obvious, and/or crossfade the buffer ends; brown noise is forgiving here.
- **Hum.** Two `OscillatorNode`s (~60 Hz + ~120 Hz) through a low gain, with a
  gentle low-pass; multiply their gain by the per-frame flicker value already
  computed in the render loop so audio and light buzz together.
- **Graph.** `sources → per-bus GainNodes → masterGain → destination`. Master
  gain is what mute/volume controls; buses let later features balance layers.
- **Lifecycle.** Create context lazily on first user gesture; `suspend()` on
  blur / pointer-unlock, `resume()` on focus / lock — mirrors the existing
  overlay wiring.

## 6. Acceptance criteria

A reviewer running the game can:

1. Hear a low brown-noise rumble begin when they click to enter (not before —
   no autoplay violation warning in the console).
2. Hear a fluorescent hum layered over the bed that audibly buzzes/dips in time
   with the on-screen light flicker.
3. Mute and unmute with a key, see an on-screen state change, and have that
   preference persist across a reload.
4. Have the audio pause when they release the pointer / hide the tab and resume
   on return, with no clipping, runaway gain, or console errors.
5. Confirm no audio asset files ship — the sound is fully procedural.

## 7. Stretch (only if cheap)

- Muffled carpet footstep foley tied to movement speed.
- A barely-perceptible slow amplitude drift on the bed so the room "breathes."
- A `setReactivity(0..1)` demo hook wired to a test key to preview how leaked
  zones will later color the mix (filter sweep + bed swell).

## 8. Open questions

- **Mute keybinding** — `M`? And should volume be discrete steps or a slider
  overlay?
- **Loudness target** — how loud is the bed by default relative to the hum;
  ship muted-by-default or low-by-default? (Leaning low-by-default with an
  obvious indicator.)
- **AudioWorklet vs. buffer** — the looping-buffer approach is simplest and
  well-supported; an `AudioWorklet` brown-noise generator is cleaner but heavier.
  Leaning buffer for v1.
