# Decisions

Append-only, terse log of decisions that aren't obvious from the code. Newest
first. One entry per decision: date · what · why.

- **2026-07-12 · Object registry supports glTF too; props sourced from CC0
  libraries.** Extended `src/objects.js` with a `GLTFLoader` path alongside STL
  (registry entries take `format: "gltf"`); both normalise to a cloneable
  template Object3D (glTF keeps its own PBR materials, STL keeps the colour
  override). Added five real-world-sized props (barrel, school chair, wooden
  crate, shelf, cardboard box) from **Poly Haven**, whose entire library is
  **CC0 / public domain** — no attribution or redistribution restriction, so
  bundling into the repo is clean (see `public/models/gltf/NOTICE.md`).
  Constraint for future assets: **CC0 / public-domain only** — verify per file,
  since STL print libraries mix CC0/CC-BY/CC-BY-SA/CC-BY-NC/all-rights-reserved.
- **2026-07-11 · STL models are a deliberate exception to "procedural-only
  assets."** Added `src/objects.js` (a registry + STLLoader cache) and
  `public/models/stl/` so special-room props can use real geometry, not just
  boxes/cylinders. This breaks the "no external asset files, works offline"
  rule below — accepted knowingly, not by accident. Kept low-risk: the STL
  files are three.js's own MIT-licensed example models (same license as the
  `three` dependency already in use), so no new licensing exposure; see
  `public/models/stl/NOTICE.md`. Registration is Flynn's call — decided he
  wanted this over staying procedural-only.
- **2026-07-11 · Config-driven layout zones (world generation).** Flynn's second
  feature. The grid is
  partitioned into square zones, each assigned a weighted-random profile — open,
  rooms, corridor, encounter — so the space changes character as you walk.
  Profiles live entirely in `config.js` (`zones.profiles`), making zone shape the
  single knob for reshaping the world. Replaced the earlier per-region corridor
  system; corridors are now one profile among several. Encounter zones drop a
  green-glow floor marker, reserved for future Null-Zone content (goal.md §6.7).
- **2026-07-11 · Flynn's first pass: world, lighting, movement & stamina.** First
  contribution shaping the game's feel — sparser/brighter fixtures, a dark
  uniform ceiling, and a sprint system with a stamina bar (drains while running,
  regenerates when not, locks out sprint while exhausted). Established Flynn as a
  contributor (see `CONTRIBUTORS.md`).
- **2026-07-11 · Cleared the feature roadmap; handed direction to Flynn.**
  Removed all feature specs (`context/features/`), the auto-maintained
  `context/STATE.md`, and its generator (`scripts/update-context.mjs` + the
  `context` npm scripts). The game keeps everything already built; the *plan* is
  intentionally a blank slate so Flynn (14) can reshape the game's goal in
  `context/goal.md`. Earlier entries below that reference those files are kept as
  historical record. See `FLYNN.md`.
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
