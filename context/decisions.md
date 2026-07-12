# Decisions

Append-only, terse log of decisions that aren't obvious from the code. Newest
first. One entry per decision: date · what · why.

> **Tip:** for a quick structured map of the repo, query the knowledge graph —
> `npm run kg -- map` (overview), `-- find <term>`, `-- why <id>`, `-- show <id>`.
> It indexes this log + goal.md so you can pull one answer instead of reading
> everything. See `context/knowledge.json` and `context/KNOWLEDGE.md`.

- **2026-07-12 · A skill library for the repo's fiddly workflows.** Added six
  Claude Code skills (`.claude/skills/`) alongside the original three:
  `add-content` (the three asset registries), `add-entity`, `add-place`,
  `dev-command`, `verify-change`, and `close-out`. Why: the workflows that are
  easy to get *silently* wrong were the ones with no written procedure. Chief
  among them — registering a model in `OBJECT_REGISTRY` does nothing on its own:
  unless it's `category: "research"` or `rooms.js` asks for it by id, it loads
  fine and never appears, with no error. Likewise the pre-commit hook rejects any
  commit whose `KNOWLEDGE.md` is stale, which nothing warned you about until it
  bit you; and with no tests, linter, or CI, "verified in-browser" is the only
  gate we have, yet it lived as prose inside `run-game`. Each skill names the
  exact files and the specific trap. Also fixed the drift left by the dev-console
  commit (`81af172`): `FLYNN.md` still told Flynn to press **T** for a menu that
  no longer exists, and three graph summaries still described it.

- **2026-07-12 · A typed dev console replaces the numbered dev menu.** Dev actions
  used to be a `T` menu with numbered options; they're now typed commands in a
  Quake-style console toggled with `~` (`src/console.js`). Why: the menu didn't
  scale — every new dev action needed a key or a digit, and the useful ones
  (teleport *here*, set *this* seed, spawn *n*) need **arguments**, which a menu
  can't take. A console makes a new action one `register(name, help, run)` call
  and gives `help` for free. It captures keys in the capture phase while open, so
  typing a command can't also move the player, and `main.js` pauses the player on
  open. Commands live in `main.js` (closing over world/player/entities), not in
  `console.js`, which stays game-agnostic.

- **2026-07-12 · The first NPC — a wandering presence (entity step 3).** `src/npc.js`
  — a dark, slightly-too-tall "Still Life" figure (goal.md §6.4) that drifts near
  the player. The first code behind both the still-life and shared-lobby concepts:
  it carries a `signature` for the future presence-driven leak, and it's the first
  thing `nearestPresence` actually reports. It stays **leashed** to the player (24
  m) for two reasons: it's the eerie behaviour we want (a thing that lurks near
  you), and — practically — the world only streams chunks around the player, so a
  presence that wandered past that radius would have no colliders and would drift
  through walls.

- **2026-07-12 · The entity layer (step 2).** `src/entity.js` — `Entity` (a thing
  with `update(dt, ctx)`, optionally a mesh and a home place) and `EntitySet`
  (per-frame place-scoped update + `nearestPresence`). Deliberately **not an ECS**:
  the game needs a handful of presences, not a component store, and a tiny base
  class keeps the seam obvious. Shipped with zero entities on purpose — a runtime
  no-op — so the plumbing could land and be verified separately from the first NPC.
  `nearestPresence` is the shared "who's near you" signal that the leak and
  audio-dread systems are meant to read, rather than each re-deriving proximity.

- **2026-07-12 · A `Place` abstraction replaces the `inStage2`/`inPropRoom` flags
  (entity step 1).** `src/place.js` — `Place` / `WorldPlace` / `RoomPlace`, each
  owning its scene, spawn, colliders, vignette, and audio-bed state, with a single
  `goTo(place)` in `main.js`. Why: two booleans had fanned out into per-frame
  branches for collision, streaming, *and* render, so "which room am I in?" was
  answered in three scattered places and a new place meant touching all of them.
  One `activePlace` means one place to reason about a transition. It also fixed a
  real bug for free: entering the Prop Room from Stage 2 used to inherit Stage 2's
  muted/vignette-off state, because nothing applied those uniformly. This is the
  seam entities plug into — an entity belongs to a place.

- **2026-07-12 · Persistent knowledge graph over the context docs.** Added
  `context/knowledge.json` (typed nodes + typed edges) and a zero-dep query CLI
  `context/kg.mjs` (`npm run kg -- <cmd>`: map / find / show / neighbors / why /
  path / check / render). Nodes capture the memory types worth keeping —
  subsystems, concepts, decisions, conventions, mechanics, people, asset
  sources — and edges the relations between them (uses, realizes, establishes,
  constrains, authored_by, …). Purpose: cheaper retrieval (query a few lines
  instead of loading goal.md + this file wholesale) and a way to "chat" with the
  codebase's own memory. The graph indexes the prose docs rather than replacing
  them — a node's `ref` points back here / to goal.md for the detail.
  `KNOWLEDGE.md` is a generated human view (`npm run kg -- render`).

- **2026-07-12 · Image-texture SKINS (surface re-skinning).** Added
  `src/textures.js`: a registry that ingests seamless image textures from
  `public/textures/` and turns each into an alternate wall/floor/ceiling
  material set ("skin"). ~40% of special rooms adopt a random skin — walls use
  the skin material, and an overlaid floor+ceiling plane re-skins those too — so
  the room reads as a "leaked" reinterpretation of the base yellow (goal.md leak
  idea; materials.js always flagged the base textures as swappable). Uses an
  independent RNG salt so re-skinning never shifts prop layouts. Seeded with 4
  CC0 Poly Haven textures (concrete, blue tiles, blue/beige plaster). Parallels
  the model (objects.js) and SVG (svgprops.js) registries — third "drop a file +
  register it" content pipeline.
- **2026-07-12 · Rooms are asset-only; added a dev Prop Room.** Stripped every
  procedurally-built prop and the box/cylinder fallbacks from `rooms.js` — themes
  now place ONLY registry models (glTF/STL) + SVG signs; the only primitives left
  are the room's own walls. (Deleted the trinket/confetti/cake/bedroll/box-wall-
  decor code and its materials.) Added 8 more CC0 props (TV, fire extinguisher,
  trash can, potted plant, rusted can, +3 SVG signs). New `src/proproom.js`: a
  dev-only test chamber (like Stage 2, off the world grid) laying out one of
  every registered prop in a grid with all signs on a wall — reached via **dev
  menu key 5**. Rationale: the user wants a pure asset-driven prop system and a
  single place to eyeball every prop.
- **2026-07-12 · SVG-ingested 2D props (wall signs).** Added `src/svgprops.js`:
  a second registry that parses SVG files (three's `SVGLoader`) into flat filled
  meshes — arrow, exit, hazard, radiation, no-entry — mounted flush on room
  walls (`rooms.js` addWallSign, reusing the wall-decor geometry). Rendered UNLIT
  (`MeshBasicMaterial`, `DoubleSide`) so signs stay readable in the dark and show
  from either side; overlapping fills are z-nudged in document order to avoid
  z-fighting. SVGs are authored in-repo (original ⇒ CC0), no `<text>` (SVGLoader
  rasterises paths, not fonts). Parallels the 3D object registry (objects.js).
  Also added three more CC0 Poly Haven props (sofa, boombox, ammo crate), placed
  via getObject() in rooms.js addExtraFurniture.
- **2026-07-12 · Added Stage 2 — a second area reachable only from the dev
  menu.** New `src/stage2.js`: a single plain enclosed room (reused wall/
  carpet/ceiling materials, one light — deliberately undecorated, a
  placeholder for whatever this becomes later) built once and added directly
  to the main scene, NOT through World's chunk streaming — it sits at a
  fixed coordinate (1,000,000, 1,000,000) far outside anything the seeded
  maze or specialRooms generation could ever reach on its own, so there's no
  route there except the new dev-menu option 4 ("Toggle Stage 2"), which
  parks the camera there and swaps player collision over to the room's own
  small fixed collider set. World streaming is paused while inside (no point
  building procedural chunks a million metres from anywhere relevant);
  toggling back returns to the spawn marker and resumes it. Verified
  collision stops the player at the wall (doesn't clip through) and the
  round-trip back to Stage 1 leaves normal streaming intact.
- **2026-07-12 · Fixed arrows still pointing at walls a couple of tiles out.**
  Two separate bugs in the "does this direction actually stay clear"
  arrow-facing check (world.js): (1) when NEITHER direction looked clear,
  the code fell back to a coin flip instead of skipping the arrow, so it
  could point at a wall on purpose; now it just doesn't place an arrow
  there. (2) The bigger one: `directionClear()` only checked the
  deterministic `wallSouth()`/`wallWest()` functions, but buildChunk's
  minimum-density "top-up" pass (added earlier so sparse chunks don't feel
  empty) adds extra walls afterward using a per-chunk shuffled RNG that
  those deterministic functions know nothing about — so an arrow's
  clearance check could pass while a top-up wall sat right in the "clear"
  path. Fixed by deferring all arrow placement in a chunk until after its
  top-up pass finishes, then checking the now-complete `wallSouthCells`/
  `wallWestCells` sets directly for any cell within the current chunk
  (falling back to the old deterministic check only for cells that spill
  into a neighbouring, possibly-not-yet-built chunk — a narrower, harder to
  fully close gap). Verified with a Playwright script that, for every
  discovered arrow, independently re-derives its pointing direction and
  walks 3 cells out checking the real collision system (sampled slightly
  off dead-centre so an incidental pillar — which doesn't fully block a
  4.2m-wide row — doesn't read as a false violation): 0 wall violations
  across 43 arrows over 5 seeds, and arrows still turn up plentifully (not
  over-suppressed) across normal play.
- **2026-07-12 · Sourced 5 more CC0 models for remaining procedural props.**
  Searched Poly Haven for real models of the last "basic" primitive-shaped
  decorations: `lantern` (camp), `oil-can` (camp supply items, alongside the
  existing crate/box models), `toy-duck`/`toy-baseball` (mixed into the toys
  theme's scatter, a third of the time, alongside the plain block/ball/puck
  shapes), and `picture-frame` (festival wall decor). Added a `wallMount`
  registry flag + matching `objects.js` normalize() path for the picture
  frame specifically — it's meant to hang, so it gets centred on Y instead of
  rested on the floor like every other prop, and `rooms.js` gained a
  `mountModel()` helper (parallel to the existing box-based `mountBox()`)
  that rotates the model to face outward from whichever wall it's on, reusing
  the same facing-math as the wall arrows. Verified visually (all 5 render
  right-side-up, correctly placed, the picture frame facing outward not
  backward) — no automated collider verification needed since wall decor in
  this game has always been cosmetic-only. Couldn't find a CC0 backpack or
  sleeping bag/bedroll on Poly Haven, so the camp theme's bedroll and
  backpack stay procedural boxes; confetti and bunting flags also stay
  procedural (see the 2026-07-12 streamers-removed entry below) since
  they're inherently small/abstract, not standing in for one specific
  real-world object the way the others were.
- **2026-07-12 · Fixed wall arrows going invisible after their chunk streamed
  out and back in.** `maybeAddArrow` (world.js) used to gate the ENTIRE
  function — including creating the decal mesh — behind `world._arrowKeys`,
  a set meant only to stop the "teleport to arrow" target list
  (`world.arrows`) from getting duplicate entries when a chunk re-streams.
  Since `disposeChunk` tears down a chunk's whole group (including its arrow
  mesh) when the player wanders away, and the key stayed marked "seen"
  forever, revisiting a known arrow later rebuilt its wall but skipped
  recreating the decal — a bare wall with nothing to look at, which is what
  "teleport to arrow barely works" turned out to mean. Root-caused via a
  Raycaster dev hook that showed the same arrow record hitting its decal mesh
  on first visit and only the wall behind it on a later revisit. Fix: the
  decal is now rebuilt unconditionally every time the wall segment's chunk
  builds; only the one-time push to `world.arrows` stays deduped by key.
  Verified 40/40 raycast hits on the decal across teleport-to-arrow calls
  (previously ~50% wall-only).
- **2026-07-12 · Replaced procedural box tables/crates/chairs/shelf with
  registered glTF models.** `rooms.js`'s tables (festival + party themes),
  chairs, storage crates/barrels, the toy chest, and the standing shelf now
  place the actual `table`/`school-chair`/`wooden-crate`/`cardboard-box`/
  `barrel`/`shelf` models instead of bare `BoxGeometry`/`CylinderGeometry`.
  Added a new CC0 Poly Haven table (`WoodenTable_01`, same author as the
  existing school chair) since no table model existed yet. Every call site
  keeps a procedural-box fallback for the rare case a model hasn't loaded, so
  a slow/broken fetch still can't break room generation. Also split
  `objects.js`'s `randomObject()` to a `category: "research"` subset (the STL
  "leftover equipment" props) and added `getObject(id)` for placing a specific
  piece of furniture by id — before this, the merge that added glTF support
  had accidentally put furniture models into the same random pool as research
  clutter, so a school chair or shelf could turn up scattered as "someone left
  this here" junk in any theme. Small dressing (tabletop trinkets, dropped
  festival items, camp supplies, scattered toys) stays procedural — no
  matching CC0 model registered for those, and they're too small/varied to be
  worth sourcing one.
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
