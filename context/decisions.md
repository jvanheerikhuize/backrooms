# Decisions

Append-only, terse log of decisions that aren't obvious from the code. Newest
first. One entry per decision: date · what · why.

- **2026-07-11 · Single-player for now; NPCs mock multiplayer.** Avoid
  networking/backend complexity. Shared-lobby vision kept but delivered by NPCs
  (Feature 09); backend + real-time sync deferred. Presence mechanics built to
  swap NPC → networked player with no rework.
- **2026-07-11 · Persistent-context system.** Added `context/STATE.md` (read-first
  snapshot) + `context/decisions.md` + `scripts/update-context.mjs` so state is
  captured compactly and auto-maintained from the specs, instead of re-derived
  from sprawling docs each session.
- **2026-07-11 · Status-by-folder layout.** Shipped feature specs move to
  `context/features/completed/`; status is visible from the tree and derivable by
  tooling.
- **2026-07-11 · Feature workflow.** Build features on a branch → PR; update docs
  (spec status, backlog, README) before opening the PR. Small tweaks to shipped
  features may go straight to main.
- **2026-07-11 · Procedural-only assets.** Textures (canvas) and audio (Web Audio
  brown noise) are generated at runtime — no external asset files; works offline.
- **2026-07-11 · three.js over raw WebGL.** The roadmap is materials/shader/
  post-processing heavy (leak, VHS, growth, glow); three.js gives ShaderMaterial
  + EffectComposer + instancing out of the box. Escape hatch to raw GLSL kept.
