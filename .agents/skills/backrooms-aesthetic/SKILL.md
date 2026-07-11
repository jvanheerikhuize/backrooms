---
name: backrooms-aesthetic
description: Use when styling any visual/audio element of the Backrooms game — the base sickly-yellow liminal look, fluorescent flicker/buzz, VHS/found-footage grain, and the corrupted "leaked" state. Vanilla CSS/JS only.
---

# Backrooms Aesthetic

Render the signature look & feel defined in `SPECIFICATION.md` §4 using only
vanilla HTML/CSS/JS (no frameworks, no image/CSS libraries).

## Base state (classic yellow)
- Wallpaper palette: sickly mono-yellow. Anchor around `#c2b654 / #e5d97a`
  walls, `#b0a24a` trim, damp mustard carpet. Keep saturation slightly sickly,
  never cheerful.
- Fluorescent lighting: bright, flat, shadowless. Add a subtle **flicker** via
  a CSS keyframe animation on an overlay's opacity (irregular timing, not a
  clean sine) plus an audible buzz (see Audio).
- Emptiness: wide, repetitive rooms; no props in base state.

## Found-footage / VHS layer
- Full-screen overlay: scanlines (repeating-linear-gradient), chromatic
  aberration (offset text-shadow / duplicated channels), grain (animated noise
  — a tiling data-URI or a canvas render), vignette, and a timestamp/REC HUD.
- Intensify grain, tracking distortion, and aberration as leak level rises.

## Leaked / corrupted state
- Where another presence's world bleeds in (see `world-leak-system`), warp the
  base yellow: shift hue, distort geometry, swap textures, add props/`the Growth`
  tendrils. It is an *interpretation*, never a literal copy — keep it uncanny
  and "slightly off."
- Drive all of this from a single `--leak` CSS custom property (0→1) so leak
  intensity animates smoothly.

## Audio
- Continuous fluorescent hum (Web Audio: low oscillator + filtered noise).
- Near heavily-leaked/entity zones, layer distant, wrong-sounding human voices
  (ties to the Lifeform concept). Keep muffled and directional.

## Rules
- Pure vanilla. No external fonts/images — inline or generate assets.
- Everything reactive to `--leak` and player proximity, not hardcoded per room.
